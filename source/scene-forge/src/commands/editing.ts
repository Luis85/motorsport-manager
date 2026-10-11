import {
  parse,
  fail,
  BatchSchema,
  NodeSchema,
  GeometrySchema,
  MaterialSchema,
  Id,
  type Operation,
} from '../kernel.js';
import { commitOperations } from '../infra/project.js';
import type { CommandContext } from './context.js';
export function registerEditingCommands(c: CommandContext) {
  const { program, global, snapshot, input, output, sourceOptions, editOptions, at } = c;
  editOptions(
    sourceOptions(
      program.command('apply').description('Apply a batch transaction: {operations:[...]}'),
    ),
  ).action(async (opts) => {
    const batch = parse(BatchSchema, await input(opts));
    if (global().scene && batch.scene && global().scene !== batch.scene)
      fail('SCENE_MISMATCH', 'Batch targets another scene.');
    if (
      opts.expectedRevision !== undefined &&
      batch.expectedRevision !== undefined &&
      opts.expectedRevision !== batch.expectedRevision
    )
      fail('GUARD_MISMATCH', 'CLI revision conflicts with the batch.');
    if (opts.expectedState && batch.expectedState && opts.expectedState !== batch.expectedState)
      fail('GUARD_MISMATCH', 'CLI state conflicts with the batch.');
    output(
      await commitOperations(global().project, global().scene ?? batch.scene, batch.operations, {
        ...opts,
        expectedRevision: opts.expectedRevision ?? batch.expectedRevision,
        expectedState: opts.expectedState ?? batch.expectedState,
      }),
    );
  });
  editOptions(
    sourceOptions(
      program
        .command('put <kind> <id>')
        .description('Upsert a complete node, material or geometry by stable ID'),
    ),
  ).action(async (kind, id, opts) => {
    parse(Id, id);
    const data = await input(opts);
    let operation: Operation;
    if (kind === 'node') {
      if (!data || typeof data !== 'object' || Array.isArray(data))
        fail('SCHEMA_INVALID', 'Node input must be an object.');
      operation = { op: 'putNode', node: parse(NodeSchema, { ...data, id }) };
    } else if (kind === 'geometry')
      operation = { op: 'putGeometry', id, geometry: parse(GeometrySchema, data) };
    else if (kind === 'material')
      operation = { op: 'putMaterial', id, material: parse(MaterialSchema, data) };
    else return fail('INVALID_OPTION', 'put kind must be node, geometry or material.');
    output(await commitOperations(global().project, global().scene, [operation], opts));
  });
  editOptions(
    program
      .command('remove <id>')
      .description('Remove a node')
      .option('--cascade', 'Also remove its descendants'),
  ).action(async (id, opts) =>
    output(
      await commitOperations(
        global().project,
        global().scene,
        [{ op: 'removeNode', id, cascade: !!opts.cascade }],
        opts,
      ),
    ),
  );
  editOptions(
    program
      .command('add <type> <id>')
      .description('Quick primitive: box, sphere, cylinder, cone, torus, capsule or plane')
      .option('--size <x,y,z>', 'Box dimensions; plane uses x,y', '1,1,1')
      .option('--radius <n>', 'Radius', Number, 0.5)
      .option('--height <n>', 'Height/length', Number, 1)
      .option('--tube <n>', 'Torus tube radius', Number, 0.15)
      .option('--at <x,y,z>', 'Position', '0,0,0')
      .option('--rotate <x,y,z>', 'XYZ degrees', '0,0,0')
      .option('--material <id>', 'Existing material; default clay is created if absent', 'clay')
      .option('--parent <id>', 'Parent node'),
  ).action(async (type, id, opts) => {
    parse(Id, id);
    const s = await snapshot();
    const size = at(opts.size);
    const shapes: Record<string, unknown> = {
      box: { type: 'box', size },
      sphere: { type: 'sphere', radius: opts.radius },
      cylinder: {
        type: 'cylinder',
        radiusTop: opts.radius,
        radiusBottom: opts.radius,
        height: opts.height,
      },
      cone: { type: 'cone', radius: opts.radius, height: opts.height },
      torus: { type: 'torus', radius: opts.radius, tube: opts.tube },
      capsule: { type: 'capsule', radius: opts.radius, length: opts.height },
      plane: { type: 'plane', size: size.slice(0, 2) },
    };
    if (!Object.hasOwn(shapes, type))
      fail(
        'INVALID_OPTION',
        `Unsupported quick primitive ${type}. Use schema --kind geometry for advanced shapes.`,
      );
    const gid = id + '_geo';
    parse(Id, gid);
    const ops: Operation[] = [];
    if (opts.material === 'clay' && !Object.hasOwn(s.scene.materials, 'clay'))
      ops.push({
        op: 'putMaterial',
        id: 'clay',
        material: parse(MaterialSchema, { color: '#cc9270' }),
      });
    ops.push(
      { op: 'putGeometry', id: gid, geometry: parse(GeometrySchema, shapes[type]) },
      {
        op: 'putNode',
        node: parse(NodeSchema, {
          id,
          type: 'mesh',
          geometry: gid,
          material: opts.material,
          parent: opts.parent,
          transform: { position: at(opts.at), rotation: at(opts.rotate) },
        }),
      },
    );
    output(
      await commitOperations(global().project, global().scene, ops, {
        ...opts,
        expectedRevision: opts.expectedRevision ?? s.scene.revision,
      }),
    );
  });
}
