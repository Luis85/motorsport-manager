import {
  parse,
  fail,
  NodeSchema,
  GeometrySchema,
  MaterialSchema,
  Id,
  type Operation,
} from '../kernel/index.js';
import { ParameterSpecSchema, type ModelOperation } from '../domain/document.js';
import { parseBatch } from '../application/edit.js';
import { restoreRevision } from '../infra/store.js';
import { editOptions, integer, sourceOptions, vector } from './options.js';
import type { CommandContext } from './context.js';

/** Guard options merged with batch guards; disagreeing guards are an error, not a choice. */
export function mergeGuards(
  cli: { expectedRevision?: number; expectedState?: string; dryRun?: boolean },
  batch: { expectedRevision?: number; expectedState?: string },
) {
  if (
    cli.expectedRevision !== undefined &&
    batch.expectedRevision !== undefined &&
    cli.expectedRevision !== batch.expectedRevision
  )
    fail('GUARD_MISMATCH', '--expected-revision conflicts with the batch expectedRevision.');
  if (cli.expectedState && batch.expectedState && cli.expectedState !== batch.expectedState)
    fail('GUARD_MISMATCH', '--expected-state conflicts with the batch expectedState.');
  return {
    dryRun: cli.dryRun,
    expectedRevision: cli.expectedRevision ?? batch.expectedRevision,
    expectedState: cli.expectedState ?? batch.expectedState,
  };
}

const primitives = ['box', 'sphere', 'cylinder', 'cone', 'torus', 'capsule', 'plane'] as const;

export function registerWriteCommands(c: CommandContext) {
  const { program, output, input, commit } = c;
  editOptions(
    sourceOptions(
      program
        .command('apply')
        .description(
          'Apply one atomic batch: {expectedRevision?, expectedState?, operations:[...]}',
        ),
    ),
  ).action(async (opts) => {
    const batch = parseBatch(await input(opts));
    output(await commit(batch.operations, mergeGuards(opts, batch)));
  });
  editOptions(
    sourceOptions(
      program
        .command('put <kind> <id>')
        .description('Insert or fully replace a node, geometry, material or parameter by ID'),
    ),
  ).action(async (kind: string, id: string, opts) => {
    parse(Id, id);
    const data = await input(opts);
    let operation: ModelOperation;
    if (kind === 'node') {
      if (!data || typeof data !== 'object' || Array.isArray(data))
        fail('SCHEMA_INVALID', 'Node input must be an object.');
      operation = { op: 'putNode', node: parse(NodeSchema, { ...data, id }) };
    } else if (kind === 'geometry')
      operation = { op: 'putGeometry', id, geometry: parse(GeometrySchema, data) };
    else if (kind === 'material')
      operation = { op: 'putMaterial', id, material: parse(MaterialSchema, data) };
    else if (kind === 'parameter')
      operation = { op: 'putParameter', id, ...parse(ParameterSpecSchema, data) };
    else return fail('INVALID_OPTION', 'put kind must be node, geometry, material or parameter.');
    output(await commit([operation], opts));
  });
  editOptions(
    program
      .command('remove <id>')
      .description('Remove a node')
      .option('--cascade', 'Also remove its descendants'),
  ).action(async (id: string, opts) =>
    output(await commit([{ op: 'removeNode', id, cascade: !!opts.cascade }], opts)),
  );
  editOptions(
    program
      .command('add <primitive> <id>')
      .description(`Quick primitive mesh: ${primitives.join(', ')}`)
      .option('--size <x,y,z>', 'Box dimensions; plane uses x,y', '1,1,1')
      .option('--radius <n>', 'Radius', Number, 0.5)
      .option('--height <n>', 'Height or capsule length', Number, 1)
      .option('--tube <n>', 'Torus tube radius', Number, 0.15)
      .option('--at <x,y,z>', 'Position', '0,0,0')
      .option('--rotate <x,y,z>', 'XYZ degrees', '0,0,0')
      .option('--material <id>', 'Existing material; clay is created when absent', 'clay')
      .option('--parent <id>', 'Parent node'),
  ).action(async (type: string, id: string, opts) => {
    parse(Id, id);
    const loaded = await c.load();
    const size = vector(opts.size);
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
        `Unsupported primitive ${type}. Use apply with putGeometry for other shapes.`,
        {
          available: primitives,
        },
      );
    const geometry = parse(Id, `${id}_geo`);
    const operations: Operation[] = [];
    if (opts.material === 'clay' && !Object.hasOwn(loaded.document.model.materials, 'clay'))
      operations.push({
        op: 'putMaterial',
        id: 'clay',
        material: parse(MaterialSchema, { color: '#cc9270' }),
      });
    operations.push(
      { op: 'putGeometry', id: geometry, geometry: parse(GeometrySchema, shapes[type]) },
      {
        op: 'putNode',
        node: parse(NodeSchema, {
          id,
          type: 'mesh',
          geometry,
          material: opts.material,
          parent: opts.parent,
          transform: { position: vector(opts.at), rotation: vector(opts.rotate) },
        }),
      },
    );
    output(
      await commit(operations as ModelOperation[], {
        ...opts,
        expectedRevision: opts.expectedRevision ?? loaded.revision,
      }),
    );
  });
  editOptions(
    program
      .command('restore <revision>')
      .description('Restore a stored revision as a new revision (identical content is a no-op)'),
  ).action(async (revision: string, opts) =>
    output(await restoreRevision(c.documentPath(), integer(revision), opts)),
  );
}
