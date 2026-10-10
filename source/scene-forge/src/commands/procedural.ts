import { Command, Option } from 'commander';
import {
  parse,
  fail,
  ForgeError,
  Id,
  MaterialSchema,
  planScatter,
  round4,
  sampleTerrainNode,
  terrainPreset,
  terrainPresetNames,
  defaultTerrainPreset,
  type Operation,
  type SceneDocument,
} from '../kernel.js';
import {
  layoutRecipe,
  parsePoints,
  recipeFlags,
  scatterRecipe,
  type LayoutFlags,
  type ScatterFlags,
} from '../domain/procedural.js';
import { commitPlanned } from '../infra/project.js';
import { withHint } from './errors.js';
import { integer } from './options.js';
import type { CommandContext } from './context.js';

const numeric = (value: string) => {
  const n = Number(value);
  if (!value.trim() || !Number.isFinite(n))
    fail('INVALID_OPTION', `Expected a number, got ${JSON.stringify(value)}.`);
  return n;
};
const collect = (value: string, previous: string[] = []) => [...previous, value];
/** CLI remedies for planner failures, in flag terms. */
const placementHints: Record<string, string> = {
  DUPLICATE_ID:
    'The group (or one of its <group>-<n> IDs) exists. Pass --replace with --expected-revision/--expected-state to regenerate the group, or choose another --group.',
  SCATTER_EMPTY:
    'Nothing was placed; read details.rejected. Lower --spacing, widen --area, relax --max-slope, --exclude or --avoid/--margin, or pass --allow-empty.',
  PROCEDURAL_BUDGET:
    'Raise --spacing or --step, shrink --area or the path, or lower --max/--count. Limits: catalog procedural.limits.',
};
/** With --replace a duplicate is never a scatter group to regenerate: only another ID helps. */
const replaceHints = {
  ...placementHints,
  DUPLICATE_ID:
    'Choose another --group. --replace regenerates only a group tagged scatter (made by scatter or layout), never other content of that ID, and its <group>-<n> IDs must be free.',
};
const placementOptions = (cmd: Command) =>
  cmd
    .option(
      '--seed <n>',
      'Seed 0..4294967295; the same seed replays identically (default 1)',
      integer,
    )
    .option('--group <id>', 'Group node owning the placements <group>-<n>')
    .option('--parent <id>', 'Existing parent node; x,z coordinates are in its frame')
    .option('--on <node>', 'Ground every placement on this heightfield terrain node')
    .option('--sink <meters>', 'With --on: sink origins below the surface', numeric)
    .option('--max-slope <degrees>', 'With --on: reject steeper ground (0-90)', numeric)
    .option('--scale <min..max>', 'Uniform scale range, or one value')
    .option('--yaw <min..max>', 'Yaw range in degrees, or one value')
    .option('--tilt <min..max>', 'Tilt range about X and Z in degrees, or one value (default 0)')
    .option('--max <n>', 'Keep at most n placements (keyed subset)', integer)
    .option('--exclude <area>', 'Keep-out area (repeatable), same syntax as --area', collect)
    .option('--avoid <ids>', "Keep clear of these nodes' XZ bounds")
    .option('--margin <meters>', 'With --avoid: extra clearance', numeric)
    .option('--replace', 'Regenerate: remove an existing scatter group of the same ID first')
    .option('--allow-empty', 'Write an empty group instead of failing with SCATTER_EMPTY');

type PlacementOptions = (ScatterFlags | LayoutFlags) & {
  file?: string;
  data?: string;
  replace?: boolean;
  allowEmpty?: boolean;
  expectedRevision?: number;
  expectedState?: string;
  dryRun?: boolean;
};

export function registerProceduralCommands(c: CommandContext) {
  const { program, global, output, input, sourceOptions, editOptions, snapshot } = c;
  const name = program.name();
  /** Plan inside the project lock against the guarded snapshot, then commit or dry-run. */
  async function place(opts: PlacementOptions, recipeOf: (scene: SceneDocument) => unknown) {
    const { project, scene } = global();
    const result = await commitPlanned(
      project,
      scene,
      (s) => {
        try {
          const plan = planScatter(s.scene, s.models, recipeOf(s.scene), {
            replace: !!opts.replace,
            allowEmpty: !!opts.allowEmpty,
          });
          return {
            operations: plan.operations,
            report: { recipe: plan.recipe, placement: plan.placement },
          };
        } catch (error) {
          throw withHint(error, opts.replace ? replaceHints : placementHints);
        }
      },
      opts,
    );
    const cli = [name, '-p', project, ...(scene ? ['-s', scene] : [])];
    const tag = `scatter:${result.placement.recipeHash.slice(0, 8)}`;
    const nextCommands = result.dryRun
      ? [
          [
            ...cli,
            'scatter',
            '--data',
            JSON.stringify(result.recipe),
            ...(opts.replace ? ['--replace'] : []),
            ...(opts.allowEmpty ? ['--allow-empty'] : []),
            '--expected-revision',
            String(result.revision),
            '--expected-state',
            result.stateHash,
          ],
        ]
      : [
          [...cli, 'node', 'list', '--tag', tag, '--details', '--limit', '5'],
          [...cli, 'review', '--out', `${project}/exports/review-r${result.revision}`],
        ];
    return { ...result, nextCommands };
  }
  /** A complete recipe (--file/--data) excludes recipe flags except --seed/--group overrides. */
  async function recipeInput(opts: PlacementOptions & Record<string, unknown>) {
    const used = recipeFlags.filter((flag) => opts[flag] !== undefined);
    if (used.length)
      throw withHint(
        new ForgeError(
          'INVALID_OPTION',
          'A recipe file already defines the placement; drop the recipe flags.',
          { flags: used },
        ),
        { INVALID_OPTION: 'With --file/--data only --seed and --group override the recipe.' },
      );
    const recipe = await input(opts);
    if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) return recipe;
    return {
      ...recipe,
      ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
      ...((opts as { group?: string }).group !== undefined ? { group: opts.group } : {}),
    };
  }

  editOptions(
    placementOptions(
      sourceOptions(
        program
          .command('scatter')
          .description(
            'Scatter registered models over an area or terrain, deterministically from a seed',
          ),
      )
        .option('--model <ids>', 'Registered models, optionally weighted: rock,tree:3')
        .option(
          '--area <area>',
          'rect:x0,z0,x1,z1 | circle:x,z,r | polygon:x,z;x,z;x,z (default with --on: the terrain)',
        )
        .option('--spacing <meters>', 'Minimum distance between placements (blue noise)', numeric)
        .option('--count <n>', 'Uniform random placements instead of --spacing', integer),
    ),
  ).action(async (opts) => {
    const fromRecipe = opts.file !== undefined || opts.data !== undefined;
    const recipe = fromRecipe ? await recipeInput(opts) : undefined;
    output(await place(opts, (scene) => (fromRecipe ? recipe : scatterRecipe(opts, scene))));
  });

  editOptions(
    placementOptions(
      program
        .command('layout')
        .description('Place models evenly along a path or on a grid (yaw 0 unless --yaw)')
        .option('--model <ids>', 'Registered models, optionally weighted: post,lamp:0.2')
        .option('--path <points>', 'Polyline "x,z;x,z;..."; instances face along it')
        .option('--spacing <meters>', 'With --path: distance between placements', numeric)
        .addOption(
          new Option('--orient <mode>', 'With --path: yaw follows the path').choices([
            'yaw',
            'none',
          ]),
        )
        .option('--grid <CxR>', 'Grid of COLUMNSxROWS placements, e.g. 4x3')
        .option('--step <meters>', 'With --grid: spacing on both axes')
        .option('--jitter <0..1>', 'With --grid: random offset up to jitter * step / 2', numeric)
        .option('--center <x,z>', 'With --grid: grid center (default 0,0)'),
    ),
  ).action(async (opts) => output(await place(opts, () => layoutRecipe(opts))));

  const terrain = program
    .command('terrain')
    .description('Heightfield terrain: create from presets, then sample heights and normals');
  editOptions(
    terrain
      .command('add <id>')
      .description(
        'Create a heightfield mesh node <id> with geometry <id>_geo and material <id>_mat',
      )
      .addOption(
        new Option('--preset <name>', 'Terrain preset')
          .choices(terrainPresetNames)
          .default(defaultTerrainPreset),
      )
      .option('--size <w,d>', 'Width (X) and depth (Z) in meters')
      .option('--resolution <n|nx,nz>', 'Vertices per axis (2-256)')
      .option('--amplitude <meters>', 'Height range', numeric)
      .option('--seed <n>', 'Noise seed 0..4294967295 (default 1)', integer)
      .option('--at <x,y,z>', 'Node position')
      .option('--material <id>', 'Use an existing material (solid; drops the height bands)')
      .option('--color <hex>', 'Solid #rrggbb material instead of the height bands')
      .option('--replace', 'Replace an existing node, geometry or material of these IDs'),
  ).action(async (id: string, opts) => {
    parse(Id, id);
    if (opts.material && opts.color)
      fail('INVALID_OPTION', 'Pass --material or --color, not both.');
    const pair = (text: string, flag: string): [number, number] => {
      const values = text.split(',').map((v) => (v.trim() ? Number(v) : NaN));
      if (values.length === 1) values.push(values[0]);
      if (values.length !== 2 || values.some((v) => !Number.isFinite(v)))
        fail('INVALID_OPTION', `${flag} expects one number or two comma-separated numbers.`);
      return values as [number, number];
    };
    const { geometry, material } = terrainPreset(opts.preset, {
      size: opts.size ? pair(opts.size, '--size') : undefined,
      resolution: opts.resolution ? pair(opts.resolution, '--resolution') : undefined,
      amplitude: opts.amplitude,
      seed: opts.seed,
    });
    const solid = opts.material || opts.color;
    if (solid) delete geometry.bands;
    const ids = { node: id, geometry: `${id}_geo`, material: opts.material ?? `${id}_mat` };
    const { project, scene } = global();
    const result = await commitPlanned(
      project,
      scene,
      (s) => {
        const taken = [
          s.scene.nodes.some((n) => n.id === ids.node) && `node ${ids.node}`,
          Object.hasOwn(s.scene.geometries, ids.geometry) && `geometry ${ids.geometry}`,
          !opts.material &&
            Object.hasOwn(s.scene.materials, ids.material) &&
            `material ${ids.material}`,
        ].filter(Boolean);
        if (taken.length && !opts.replace)
          throw withHint(
            new ForgeError('DUPLICATE_ID', `Terrain ${id} would overwrite ${taken.join(', ')}.`, {
              taken,
            }),
            {
              DUPLICATE_ID:
                'Pass --replace (with the guards) to regenerate this terrain, then rerun its scatters with --replace; or choose another ID.',
            },
          );
        if (opts.material && !Object.hasOwn(s.scene.materials, opts.material))
          fail('REFERENCE_MISSING', `Material ${opts.material} does not exist.`);
        const operations = [
          ...(opts.material
            ? []
            : [
                {
                  op: 'putMaterial',
                  id: ids.material,
                  material: opts.color
                    ? parse(MaterialSchema, { color: opts.color, roughness: 0.95 })
                    : material,
                },
              ]),
          { op: 'putGeometry', id: ids.geometry, geometry },
          {
            op: 'putNode',
            node: {
              id,
              type: 'mesh',
              geometry: ids.geometry,
              material: ids.material,
              tags: ['terrain'],
              ...(opts.at ? { transform: { position: c.at(opts.at) } } : {}),
            },
          },
        ] as Operation[];
        return {
          operations,
          report: {
            terrain: { ...ids, preset: opts.preset, bands: !solid, geometry },
            // Placements keep the heights they were planned on; regenerate them on new ground.
            ...(taken.length
              ? {
                  staleScatterGroups: s.scene.nodes
                    .filter((n) => n.type === 'group' && n.tags.includes('scatter'))
                    .map((n) => n.id),
                }
              : {}),
          },
        };
      },
      opts,
    );
    const cli = [name, '-p', project, ...(scene ? ['-s', scene] : [])];
    output({
      ...result,
      nextCommands: [
        [...cli, 'terrain', 'sample', id, '--at', '0,0'],
        [...cli, 'scatter', '--model', '<model>', '--on', id, '--spacing', '4', '--dry-run'],
        [...cli, 'review', '--out', `${project}/exports/review-r${result.revision}`],
      ],
    });
  });
  terrain
    .command('sample <node>')
    .description('Read-only world-space terrain heights and normals at x,z points')
    .requiredOption('--at <points>', 'World x,z points: "x,z;x,z;..." (at most 256)')
    .action(async (node: string, opts) => {
      const points = parsePoints(opts.at, '--at');
      if (points.length > 256) fail('INVALID_OPTION', '--at accepts at most 256 points.');
      const s = await snapshot();
      output({
        scene: s.scene.id,
        revision: s.scene.revision,
        stateHash: s.stateHash,
        terrain: node,
        samples: sampleTerrainNode(s.scene, node, points).map((p) => ({
          x: p.x,
          z: p.z,
          y: round4(p.y),
          normal: p.normal.map(round4),
          inside: p.inside,
        })),
      });
    });
}
