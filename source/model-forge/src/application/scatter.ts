import {
  fail,
  ForgeError,
  planScatter,
  compileScene,
  gridArea,
  type ModelLibrary,
} from '../kernel/index.js';
import type { ModelOperation } from '../domain/document.js';
import {
  type EditorDocument,
  libraryOf,
  modelTarget,
  stageScene,
  withoutRevision,
} from './document.js';

/** Scatter flags as typed on the command line; a recipe file replaces all of them. */
export interface ScatterFlags {
  group?: string;
  model?: string;
  node?: string;
  area?: string;
  exclude?: string[];
  spacing?: number;
  /** `CxR` grid counts, with `step` (and optional `jitter`, `center`). */
  grid?: string;
  step?: number;
  jitter?: number;
  center?: string;
  count?: number;
  on?: string;
  sink?: number;
  maxSlope?: number;
  scale?: string;
  yaw?: string;
  tilt?: string;
  max?: number;
  seed?: number;
  parent?: string;
  avoid?: string;
  margin?: number;
}

const numbers = (text: string, flag: string, count?: number) => {
  const values = text.split(',').map((part) => Number(part));
  if (
    text.split(',').some((part) => !part.trim()) ||
    values.some((value) => !Number.isFinite(value)) ||
    (count !== undefined && values.length !== count)
  )
    fail(
      'INVALID_OPTION',
      `${flag} expects ${count ?? 'several'} comma-separated numbers: ${text}.`,
    );
  return values;
};
/** `rect:x0,z0,x1,z1`, `circle:x,z,r` or `polygon:x,z;x,z;x,z` as a kernel area. */
export function parseArea(text: string, flag = '--area') {
  const [type, rest = ''] = text.split(/:(.*)/s);
  if (type === 'rect') {
    const [x0, z0, x1, z1] = numbers(rest, flag, 4);
    return {
      type,
      min: [Math.min(x0, x1), Math.min(z0, z1)],
      max: [Math.max(x0, x1), Math.max(z0, z1)],
    };
  }
  if (type === 'circle') {
    const [x, z, radius] = numbers(rest, flag, 3);
    return { type, center: [x, z], radius };
  }
  if (type === 'polygon')
    return { type, points: rest.split(';').map((point) => numbers(point, flag, 2)) };
  return fail(
    'INVALID_OPTION',
    `${flag} must be rect:x0,z0,x1,z1, circle:x,z,r or polygon:x,z;x,z;x,z.`,
    {
      value: text,
    },
  );
}
/** `a..b` (negative numbers allowed) as [a, b], or one value `a` as [a, a], like Scene Forge. */
export function parseRange(text: string, flag: string): [number, number] {
  const match = /^(.+)\.\.(.+)$/.exec(text);
  const range = match
    ? [Number(match[1]), Number(match[2])]
    : text.trim()
      ? [Number(text), Number(text)]
      : [];
  if (range.length !== 2 || !range.every(Number.isFinite) || range[0] > range[1])
    fail('INVALID_OPTION', `${flag} expects <min>..<max> (or one value), got ${text}.`);
  return range as [number, number];
}
/** `a,b:3` as weighted items of one kind. */
const items = (text: string, kind: 'model' | 'node') =>
  text.split(',').map((entry) => {
    const [id, weight] = entry.split(':');
    return {
      [kind]: id,
      ...(weight !== undefined ? { weight: Number(weight) } : {}),
    } as { model?: string; node?: string; weight?: number };
  });

/** XZ footprint of the model's compiled content: the default scatter area. */
function footprint(document: EditorDocument) {
  const built = compileScene(modelTarget(document), libraryOf(document), { bindRigs: false });
  try {
    const { min, max } = built.stats.bounds;
    if (!(max[0] > min[0] && max[2] > min[2]))
      fail('INVALID_OPTION', 'The model has no footprint to scatter over; pass --area.', {
        hint: 'Pass --area rect:x0,z0,x1,z1 (meters in the model frame).',
      });
    return { type: 'rect', min: [min[0], min[2]], max: [max[0], max[2]] };
  } finally {
    built.dispose();
  }
}

/** `CxR` grid counts, as Scene Forge's `layout --grid`. */
function gridCounts(text: string): [number, number] {
  const match = /^(\d+)x(\d+)$/i.exec(text.trim());
  const counts = match ? [Number(match[1]), Number(match[2])] : [];
  if (!match || counts.some((n) => n < 1))
    fail('INVALID_OPTION', `--grid expects COLUMNSxROWS such as 4x3, got ${text}.`, {
      hint: 'Pass --grid 4x3 --step 1.5 [--center x,z] [--jitter 0..1].',
    });
  return counts as [number, number];
}

/** The area and distribution of `--grid CxR --step s [--center x,z] [--jitter j]`. */
function gridPlacement(flags: ScatterFlags) {
  if (flags.step === undefined)
    fail('INVALID_OPTION', '--grid needs --step <m>.', {
      hint: 'Pass --grid 4x3 --step 1.5: COLUMNSxROWS placements spaced step apart.',
    });
  if (flags.area !== undefined)
    fail('INVALID_OPTION', '--grid places exactly COLUMNSxROWS around --center; drop --area.', {
      hint: 'Move the grid with --center x,z, or use --spacing or --count inside an --area.',
    });
  const [columns, rows] = gridCounts(flags.grid!);
  const center = flags.center ? numbers(flags.center, '--center', 2) : [0, 0];
  return {
    area: gridArea(columns, rows, flags.step, [center[0], center[1]]),
    distribution: { type: 'grid', step: flags.step, jitter: flags.jitter ?? 0 },
  };
}

/**
 * A scatter recipe (`schema --kind scatter`) from command-line flags, with Scene Forge's
 * flag meanings. Without --area the model's current XZ footprint is the area (for example
 * the terrain it scatters onto); --grid CxR --step s places exactly CxR around --center.
 */
export function recipeFromFlags(document: EditorDocument, flags: ScatterFlags) {
  const distributions = [flags.spacing, flags.grid, flags.count].filter((v) => v !== undefined);
  if (distributions.length !== 1)
    fail(
      'INVALID_OPTION',
      'Choose exactly one distribution: --spacing <m> (Poisson), --grid <CxR> --step <m> or --count <n> (random).',
      {
        hint: 'For an even natural spread use --spacing; pass a recipe with --file for paths.',
      },
    );
  if (flags.grid === undefined)
    for (const [flag, value] of [
      ['--step', flags.step],
      ['--jitter', flags.jitter],
      ['--center', flags.center],
    ] as const)
      if (value !== undefined) fail('INVALID_OPTION', `${flag} applies only with --grid <CxR>.`);
  if (!flags.model && !flags.node)
    fail(
      'INVALID_OPTION',
      'Name what to place: --model <dependency ids> or --node <template node ids>.',
    );
  if (flags.area === undefined && flags.parent !== undefined && flags.grid === undefined)
    fail('INVALID_OPTION', '--parent needs an explicit --area in the parent frame.');
  const placed = [
    ...(flags.model ? items(flags.model, 'model') : []),
    ...(flags.node ? items(flags.node, 'node') : []),
  ];
  const first = String(placed[0].model ?? placed[0].node);
  const grid = flags.grid !== undefined ? gridPlacement(flags) : undefined;
  return {
    schemaVersion: 1,
    kind: 'scatter',
    seed: flags.seed ?? 1,
    // Scene Forge's rule: the first item's ID, then -scatter.
    group: flags.group ?? `${first.slice(0, 48)}-scatter`,
    ...(flags.parent ? { parent: flags.parent } : {}),
    area: grid ? grid.area : flags.area ? parseArea(flags.area) : footprint(document),
    exclude: (flags.exclude ?? []).map((area) => parseArea(area, '--exclude')),
    ...(flags.avoid
      ? { avoidNodes: { ids: flags.avoid.split(','), margin: flags.margin ?? 0 } }
      : {}),
    distribution: grid
      ? grid.distribution
      : flags.spacing !== undefined
        ? { type: 'poisson', minDistance: flags.spacing }
        : { type: 'random', count: flags.count },
    ...(flags.max !== undefined ? { maxCount: flags.max } : {}),
    items: placed,
    ...(flags.scale ? { scale: parseRange(flags.scale, '--scale') } : {}),
    rotation: {
      ...(flags.yaw ? { yaw: parseRange(flags.yaw, '--yaw') } : {}),
      tilt: flags.tilt ? parseRange(flags.tilt, '--tilt') : [0, 0],
    },
    ground: flags.on
      ? { mode: 'terrain', node: flags.on, sink: flags.sink ?? 0, maxSlope: flags.maxSlope ?? 90 }
      : { mode: 'none' },
  };
}

export interface ScatterOptions {
  replace?: boolean;
  allowEmpty?: boolean;
  /** Models to add as frozen dependencies first (bundle documents only). */
  dependencies?: EditorDocument[];
}

/**
 * Plan a scatter inside one model: the kernel planner runs on the model staged as a scene,
 * with its frozen dependencies (plus any added ones) as the model library. The result is
 * ordinary operations for the guarded edit: putDependency for added models, then the
 * kernel's group and instance putNode operations.
 */
export function planDocumentScatter(
  document: EditorDocument,
  recipe: unknown,
  options: ScatterOptions = {},
) {
  if (document.kind === 'model' && options.dependencies?.length)
    fail(
      'DOCUMENT_KIND',
      `${document.model.id} is a self-contained model; dependencies need a model-bundle document.`,
      {
        hint: 'Convert it once: import --from <this document> --out <id>.model-bundle.json, then scatter into that bundle with --dependency.',
      },
    );
  const added: ModelLibrary = {};
  for (const source of options.dependencies ?? [])
    for (const model of Object.values(libraryOf(source))) added[model.id] = withoutRevision(model);
  const models = { ...document.dependencies, ...added };
  let plan;
  try {
    plan = planScatter(stageScene(document.model), models, recipe, options);
  } catch (error) {
    if (
      error instanceof ForgeError &&
      error.code === 'REFERENCE_MISSING' &&
      /unregistered model/.test(error.message)
    )
      fail(error.code, error.message, {
        ...(error.details as object),
        hint:
          document.kind === 'model'
            ? 'Model items need a model-bundle document: import --from <this document> --out <id>.model-bundle.json, then scatter with --dependency <model file>.'
            : 'Add the model in the same command with --dependency <model or model-bundle file>, or use a node template item.',
      });
    throw error;
  }
  const operations: ModelOperation[] = [
    ...Object.values(added).map((model) => ({
      op: 'putDependency' as const,
      model,
      replace: false,
    })),
    ...(plan.operations as ModelOperation[]),
  ];
  return { operations, recipe: plan.recipe, placement: plan.placement };
}
