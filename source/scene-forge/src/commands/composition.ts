import { Option } from 'commander';
import {
  parse,
  fail,
  CompositionSchema,
  SceneSchema,
  NodePatchSchema,
  type Operation,
  OperationSchema,
  type TransformSpec,
} from '../domain/schema.js';
import { compileScene } from '../application/compiler.js';
import { modelDependencies } from '../application/composition.js';
import { captureProjectModel, cloneScene, commitOperations, writeJson } from '../infra/project.js';

import type { CommandContext } from './context.js';
export type { CommandContext } from './context.js';
import type { EditOptions } from '../application/edit.js';
export function registerCompositionCommands(c: CommandContext) {
  const { program, scene, model, global, snapshot, output, input, sourceOptions, editOptions, at } =
    c;
  scene
    .command('clone <id>')
    .description('Copy the selected scene under a new ID')
    .option('--name <name>')
    .action(async (id, opts) =>
      output(await cloneScene(global().project, global().scene, id, opts.name)),
    );
  editOptions(
    sourceOptions(
      scene
        .command('compose')
        .description('Place model instances from a declarative composition recipe'),
    ),
  ).action(async (opts) => {
    const recipe = parse(CompositionSchema, await input(opts));
    const target = global().scene ?? recipe.scene;
    if (global().scene && recipe.scene && global().scene !== recipe.scene)
      fail('SCENE_MISMATCH', 'Composition targets another scene.');
    if (
      opts.expectedRevision !== undefined &&
      recipe.expectedRevision !== undefined &&
      opts.expectedRevision !== recipe.expectedRevision
    )
      fail('GUARD_MISMATCH', 'CLI revision conflicts with the recipe revision.');
    if (opts.expectedState && recipe.expectedState && opts.expectedState !== recipe.expectedState)
      fail('GUARD_MISMATCH', 'CLI state conflicts with the recipe state.');
    const operations: Operation[] = [...recipe.groups, ...recipe.instances].map((node) => ({
      op: 'putNode',
      node,
    }));
    output(
      await commitOperations(global().project, target, operations, {
        ...opts,
        expectedRevision: opts.expectedRevision ?? recipe.expectedRevision,
        expectedState: opts.expectedState ?? recipe.expectedState,
      }),
    );
  });
  editOptions(
    model
      .command('capture <id>')
      .description('Create a reusable model from selected scene nodes')
      .requiredOption('--nodes <ids>', 'Comma-separated root IDs')
      .option('--name <name>')
      .option('--replace', 'Replace an existing model after dependency validation'),
  ).action(async (id, opts) =>
    output(
      await captureProjectModel(
        global().project,
        global().scene,
        opts.nodes.split(',').map((v: string) => v.trim()),
        id,
        opts.name,
        opts.replace,
        opts,
      ),
    ),
  );
  model
    .command('export <id>')
    .description('Export a portable model bundle including nested model dependencies')
    .requiredOption('-o, --out <path>')
    .action(async (id, opts) => {
      const s = await snapshot();
      const models = modelDependencies(s.models, id);
      await writeJson(c.resolvePath(opts.out), {
        schemaVersion: 1,
        kind: 'model-bundle',
        entry: id,
        models,
      });
      output({ path: opts.out, entry: id, models: Object.keys(models) });
    });
  model
    .command('inspect <id>')
    .description('Inspect a model, parameters, dimensions and dependencies')
    .option('--parameters <json>', 'Inspect a parameter variant')
    .action(async (id, opts) => {
      const s = await snapshot();
      const library = modelDependencies(s.models, id);
      const built = compileScene(
        parse(SceneSchema, {
          schemaVersion: 1,
          kind: 'scene',
          id: 'model',
          name: s.models[id].name,
          nodes: [
            {
              type: 'model',
              id: 'root',
              model: id,
              parameters: opts.parameters ? await input({ data: opts.parameters }) : {},
            },
          ],
        }),
        library,
      );
      try {
        output({
          model: s.models[id],
          dependencies: Object.keys(library).filter((mid) => mid !== id),
          stats: built.stats,
        });
      } finally {
        built.dispose();
      }
    });
  const node = program
    .command('node')
    .description('Compose a scene with transforms, groups and relative placement');
  const commit = async (op: unknown, opts: EditOptions) =>
    output(
      await commitOperations(global().project, global().scene, [parse(OperationSchema, op)], opts),
    );
  editOptions(
    node
      .command('transform <id>')
      .description('Update selected local transform components')
      .option('--at <x,y,z>')
      .option('--rotate <x,y,z>')
      .option('--scale <x,y,z>'),
  ).action(async (id, opts) => {
    const transform: TransformSpec = {};
    if (opts.at) transform.position = at(opts.at);
    if (opts.rotate) transform.rotation = at(opts.rotate);
    if (opts.scale) transform.scale = at(opts.scale);
    if (!Object.keys(transform).length)
      fail('INPUT_REQUIRED', 'Provide --at, --rotate or --scale.');
    await commit({ op: 'patchNode', id, patch: { transform } }, opts);
  });
  editOptions(
    sourceOptions(
      node
        .command('patch <id>')
        .description('Change name, visibility, tags, transform or model overrides'),
    ),
  ).action(async (id, opts) =>
    commit({ op: 'patchNode', id, patch: parse(NodePatchSchema, await input(opts)) }, opts),
  );
  editOptions(
    node
      .command('duplicate <id> <newId>')
      .description('Duplicate a whole authored subtree')
      .option('--offset <x,y,z>', 'Local offset', '0,0,0'),
  ).action(async (id, newId, opts) =>
    commit({ op: 'duplicateNode', id, newId, offset: at(opts.offset) }, opts),
  );
  editOptions(
    node
      .command('group <id>')
      .description('Group sibling nodes without moving them')
      .requiredOption('--nodes <ids>')
      .option('--name <name>'),
  ).action(async (id, opts) =>
    commit(
      {
        op: 'groupNodes',
        id,
        nodes: opts.nodes.split(',').map((v: string) => v.trim()),
        name: opts.name,
      },
      opts,
    ),
  );
  editOptions(
    node
      .command('reparent <id>')
      .description('Move under a parent or to scene root; preserve world placement by default')
      .option('--parent <id>')
      .option('--local', 'Keep local transform instead of preserving world placement'),
  ).action(async (id, opts) =>
    commit({ op: 'reparentNode', id, parent: opts.parent ?? null, keepWorld: !opts.local }, opts),
  );
  editOptions(
    node
      .command('ground <id>')
      .description('Place the bottom of a subtree on a world Y plane')
      .option('--y <number>', 'World Y', Number, 0),
  ).action(async (id, opts) => commit({ op: 'groundNode', id, y: opts.y }, opts));
  editOptions(
    node
      .command('place <id>')
      .description('Place an object beside another using world-space bounds')
      .requiredOption('--to <id>', 'Target object')
      .addOption(
        new Option('--side <side>')
          .choices(['right', 'left', 'front', 'back', 'above', 'below'])
          .default('right'),
      )
      .option('--gap <meters>', 'Gap between bounds', Number, 0)
      .option('--keep-other-axes', 'Do not center along the other axes'),
  ).action(async (id, opts) =>
    commit(
      {
        op: 'placeNode',
        id,
        target: opts.to,
        side: opts.side,
        gap: opts.gap,
        center: !opts.keepOtherAxes,
      },
      opts,
    ),
  );
}
