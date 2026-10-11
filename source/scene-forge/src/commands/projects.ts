import {
  initProject,
  createScene,
  useScene,
  restoreScene,
  importModel,
  commitOperations,
} from '../infra/project.js';
import { parse, NodeSchema } from '../domain/schema.js';
import { integer } from './options.js';
import { parseJson } from './input.js';
import type { CommandContext } from './context.js';
export function registerProjectsCommands(c: CommandContext) {
  const {
    program,
    scene,
    model,
    global,
    snapshot,
    input,
    output,
    sourceOptions,
    editOptions,
    at,
    resolvePath,
  } = c;
  program
    .command('init <directory>')
    .description('Create a project with an empty main scene')
    .option('--name <name>', 'Project name')
    .action(async (dir, opts) => output(await initProject(resolvePath(dir), opts.name)));
  scene.command('list').action(async () => {
    const s = await snapshot();
    output({ activeScene: s.manifest.activeScene, scenes: s.manifest.scenes });
  });
  scene
    .command('create <id>')
    .option('--name <name>')
    .action(async (id, opts) => output(await createScene(global().project, id, opts.name)));
  scene.command('use <id>').action(async (id) => output(await useScene(global().project, id)));
  scene
    .command('restore <revision>')
    .option('--expected-revision <n>', 'Current revision guard', integer)
    .action(async (revision, opts) =>
      output(
        await restoreScene(
          global().project,
          global().scene,
          integer(revision),
          opts.expectedRevision,
        ),
      ),
    );
  model.command('list').action(async () => {
    const s = await snapshot();
    output(
      Object.entries(s.models).map(([id, m]) => ({
        id,
        name: m.name,
        category: m.category,
        description: m.description,
        parameters: m.parameters,
        path: s.manifest.models[id],
      })),
    );
  });
  editOptions(
    sourceOptions(
      model
        .command('import')
        .description('Copy a model recipe or dependency bundle into this project'),
    ),
  )
    .option('--replace', 'Replace an existing model after validating every scene')
    .action(async (opts) =>
      output(await importModel(global().project, await input(opts), opts.replace, opts)),
    );
  editOptions(
    model
      .command('instantiate <model> <id>')
      .description('Place a reusable model in the scene')
      .option('--at <x,y,z>', 'Position in meters', '0,0,0')
      .option('--parameters <json>', 'Named numeric overrides', '{}')
      .option('--parent <id>', 'Parent node')
      .option('--rotate <x,y,z>', 'XYZ degrees', '0,0,0')
      .option('--scale <x,y,z>', 'Local scale', '1,1,1')
      .option('--name <name>', 'Display name'),
  ).action(async (mid, id, opts) => {
    const node = parse(NodeSchema, {
      type: 'model',
      id,
      name: opts.name,
      model: mid,
      parent: opts.parent,
      parameters: parseJson(opts.parameters),
      transform: { position: at(opts.at), rotation: at(opts.rotate), scale: at(opts.scale) },
    });
    output(
      await commitOperations(global().project, global().scene, [{ op: 'putNode', node }], opts),
    );
  });
}
