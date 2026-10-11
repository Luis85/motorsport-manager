import test from 'node:test';
import assert from 'node:assert/strict';
import { ForgeError } from '../src/kernel/index.js';
import { parseDocument, documentStateHash } from '../src/application/document.js';
import { parseBatch, parseOperations, prepareModelEdit } from '../src/application/edit.js';
import type { ModelOperation } from '../src/domain/document.js';
import { boxModel } from './helpers.js';

const fails =
  (expected: string, operationIndex?: number) =>
  (error: unknown): boolean => {
    assert.ok(error instanceof ForgeError, String(error));
    assert.equal(error.code, expected, error.message);
    if (operationIndex !== undefined)
      assert.equal((error.details as { operationIndex: number }).operationIndex, operationIndex);
    return true;
  };
const document = () => parseDocument(boxModel());
const bundle = () =>
  parseDocument({
    schemaVersion: 1,
    kind: 'model-bundle',
    entry: 'shelf',
    models: {
      shelf: {
        schemaVersion: 1,
        kind: 'model',
        id: 'shelf',
        name: 'Shelf',
        nodes: [{ id: 'item', type: 'model', model: 'crate', transform: { position: [0, 2, 0] } }],
      },
      crate: boxModel('crate'),
    },
  });
const edit = (doc = document(), ops: unknown[], options = {}) =>
  prepareModelEdit(doc, parseOperations(ops), options);

test('kernel operations edit the model content and report grouped changes', () => {
  const { next, result } = edit(document(), [
    { op: 'putMaterial', id: 'metal', material: { color: '#888888', metalness: 1 } },
    { op: 'patchNode', id: 'lid', patch: { tags: ['top'] } },
    { op: 'duplicateNode', id: 'lid', newId: 'lid2', offset: [0, 0.2, 0] },
    { op: 'removeNode', id: 'lid2' },
    { op: 'groupNodes', id: 'assembly', nodes: ['body', 'lid'] },
  ]);
  assert.equal(result.changed, true);
  assert.equal(result.revision, 1);
  assert.equal(next.model.revision, 1);
  assert.deepEqual(result.changes.nodes, {
    added: ['assembly'],
    updated: ['body', 'lid'],
    removed: [],
  });
  assert.deepEqual(result.changes.materials.added, ['metal']);
  assert.equal(result.operations, 5);
  assert.equal(result.stats.meshes, 2);
  assert.deepEqual(next.model.parameters, document().model.parameters, 'parameters are retained');
  assert.equal(result.stateHash, documentStateHash(next));
});

test('dry runs keep the current guards and propose the next ones exactly', () => {
  const current = document();
  const ops = [{ op: 'setMetadata', name: 'Tall crate' }];
  const { result } = edit(current, ops, { dryRun: true });
  assert.equal(result.dryRun, true);
  assert.equal(result.revision, 0);
  assert.equal(result.stateHash, documentStateHash(current));
  assert.equal(result.proposedRevision, 1);
  const applied = edit(current, ops);
  assert.equal(applied.result.stateHash, result.proposedStateHash);
  assert.deepEqual(applied.result.changes.metadata, ['name']);
});

test('no-op batches keep the revision and the document identity', () => {
  const current = document();
  const { next, result } = edit(current, [
    { op: 'putMaterial', id: 'wood', material: { color: '#a0703c' } },
  ]);
  assert.equal(result.changed, false);
  assert.equal(result.revision, 0);
  assert.equal(result.proposedRevision, 0);
  assert.equal(next, current);
});

test('stale guards fail with conflict codes before any change is prepared', () => {
  assert.throws(
    () => edit(document(), [{ op: 'removeGeometry', id: 'x' }], { expectedRevision: 4 }),
    fails('REVISION_CONFLICT'),
  );
  assert.throws(
    () => edit(document(), [{ op: 'removeGeometry', id: 'x' }], { expectedState: 'a'.repeat(64) }),
    fails('STATE_CONFLICT'),
  );
  const guarded = edit(document(), [{ op: 'setMetadata', category: 'props' }], {
    expectedRevision: 0,
    expectedState: documentStateHash(document()),
  });
  assert.equal(guarded.result.revision, 1);
});

test('failures carry the zero-based operation index; scene-only and unknown operations are refused', () => {
  assert.throws(
    () =>
      edit(document(), [
        { op: 'setMetadata', name: 'Fine' },
        { op: 'removeNode', id: 'ghost' },
      ]),
    fails('NOT_FOUND', 1),
  );
  assert.throws(
    () =>
      edit(document(), [
        { op: 'removeNode', id: 'body' },
        { op: 'patchNode', id: 'x', patch: {} },
      ]),
    fails('NOT_FOUND', 1),
  );
  for (const op of ['setCamera', 'setEnvironment', 'setParameter'])
    assert.throws(
      () => parseOperations([{ op: 'removeGeometry', id: 'x' }, { op }]),
      (error: unknown) => {
        fails('UNKNOWN_OPERATION', 1)(error);
        assert.match((error as Error).message, /scene operation/);
        return true;
      },
    );
  assert.throws(() => parseOperations([{ op: 'explode' }]), fails('UNKNOWN_OPERATION', 0));
  assert.throws(
    () => parseOperations([{ op: 'putNode', node: { id: 'x' } }]),
    fails('SCHEMA_INVALID', 0),
  );
  assert.throws(() => parseBatch({ operations: [] }), fails('SCHEMA_INVALID'));
  assert.throws(
    () => parseBatch({ scene: 'main', operations: [{ op: 'removeGeometry', id: 'x' }] }),
    fails('SCHEMA_INVALID'),
  );
});

test('parameters are declared on the model and resolve inside spatial operations', () => {
  const { next } = edit(document(), [
    { op: 'putParameter', id: 'height', default: 2, min: 1, max: 4, description: 'Lid height' },
    {
      op: 'patchNode',
      id: 'lid',
      patch: { transform: { position: [0, { $param: 'height' }, 0] } },
    },
    { op: 'groundNode', id: 'lid', y: 3 },
  ]);
  assert.deepEqual(next.model.parameters.height, {
    default: 2,
    min: 1,
    max: 4,
    description: 'Lid height',
  });
  const lid = next.model.nodes.find((node) => node.id === 'lid')!;
  assert.ok(
    Math.abs(Number(lid.transform!.position![1]) - 3.03) < 1e-6,
    'grounded with world bounds',
  );
  assert.throws(
    () => edit(document(), [{ op: 'removeParameter', id: 'width' }]),
    fails('PARAMETER_MISSING'),
  );
  assert.throws(
    () => edit(document(), [{ op: 'removeParameter', id: 'nope' }]),
    fails('NOT_FOUND', 0),
  );
  assert.throws(
    () => edit(document(), [{ op: 'putParameter', id: 'width', default: 9, max: 3 }]),
    fails('PARAMETER_RANGE'),
  );
});

test('metadata can be set and cleared', () => {
  const { next } = edit(document(), [{ op: 'setMetadata', category: 'props', description: 'Box' }]);
  assert.equal(next.model.category, 'props');
  const cleared = edit(next, [{ op: 'setMetadata', category: null }]).next;
  assert.equal('category' in cleared.model, false);
  assert.equal(cleared.model.description, 'Box');
});

test('dependencies are frozen: only explicit bundle operations change them', () => {
  assert.throws(
    () => edit(document(), [{ op: 'putDependency', model: boxModel('spare') }]),
    fails('DOCUMENT_KIND', 0),
  );
  assert.throws(
    () => edit(bundle(), [{ op: 'patchNode', id: 'lid', patch: { visible: false } }]),
    (error: unknown) => {
      fails('DEPENDENCY_READONLY', 0)(error);
      assert.deepEqual((error as ForgeError).details, {
        operationIndex: 0,
        operation: 'patchNode',
        cause: { node: 'lid', dependency: 'crate' },
      });
      return true;
    },
  );
  const changed = { ...boxModel('crate'), name: 'Changed' };
  assert.throws(
    () => edit(bundle(), [{ op: 'putDependency', model: changed }]),
    fails('DEPENDENCY_READONLY', 0),
  );
  assert.throws(
    () => edit(bundle(), [{ op: 'putDependency', model: { ...boxModel('shelf') } }]),
    fails('DEPENDENCY_READONLY', 0),
  );
  const replaced = edit(bundle(), [
    { op: 'putDependency', model: { ...changed, revision: 7 }, replace: true },
  ]);
  assert.equal(replaced.next.dependencies.crate.name, 'Changed');
  assert.equal(
    replaced.next.dependencies.crate.revision,
    undefined,
    'dependencies carry no revision',
  );
  assert.deepEqual(replaced.result.changes.dependencies.updated, ['crate']);
  assert.throws(
    () => edit(bundle(), [{ op: 'removeDependency', id: 'crate' }]),
    fails('DEPENDENCY_IN_USE', 0),
  );
  const added = edit(bundle(), [
    { op: 'putDependency', model: boxModel('bin') },
    { op: 'putNode', node: { id: 'bin1', type: 'model', model: 'bin' } },
  ]);
  assert.deepEqual(added.result.changes.dependencies.added, ['bin']);
  const unused = edit(bundle(), [{ op: 'putDependency', model: boxModel('spare') }]);
  assert.match(unused.result.stats.warnings.join(' '), /Unused dependencies .*spare/);
  const removed = edit(added.next, [
    { op: 'removeNode', id: 'bin1' },
    { op: 'removeDependency', id: 'bin' },
  ]);
  assert.deepEqual(removed.result.changes.dependencies.removed, ['bin']);
});

test('nested instances accept rigs as patches on model-instance nodes', () => {
  const rig = {
    joints: [{ id: 'root', position: [0, 0, 0] }],
    bindings: {},
    pose: { root: [0, 30, 0] },
  };
  const { next } = edit(bundle(), [
    { op: 'patchNode', id: 'item', patch: { rig } },
  ] as unknown as ModelOperation[]);
  const item = next.model.nodes.find((node) => node.id === 'item');
  assert.equal(item?.type === 'model' && item.rig?.pose.root[1], 30);
  assert.throws(
    () =>
      edit(bundle(), [
        { op: 'patchNode', id: 'item', patch: { rig: { ...rig, pose: { nope: [0, 0, 0] } } } },
      ]),
    (error: unknown) => error instanceof ForgeError && error.code.startsWith('RIG'),
  );
});

test('removals and IDs fail on the operation that caused them, with contextual remedies', () => {
  const withSecond = (op: unknown) =>
    [{ op: 'putMaterial', id: 'extra', material: { color: '#ffffff' } }, op] as ModelOperation[];
  assert.throws(
    () => edit(document(), withSecond({ op: 'removeGeometry', id: 'missing' })),
    fails('NOT_FOUND', 1),
  );
  assert.throws(
    () => edit(document(), withSecond({ op: 'removeMaterial', id: 'missing' })),
    fails('NOT_FOUND', 1),
  );
  const nested = bundle();
  assert.throws(
    () => edit(nested, withSecond({ op: 'removeGeometry', id: 'body' })),
    (error: unknown) =>
      fails('DEPENDENCY_READONLY', 1)(error) &&
      (error as ForgeError).message.includes('frozen dependency crate'),
  );
  assert.throws(
    () => edit(nested, withSecond({ op: 'removeMaterial', id: 'wood' })),
    fails('DEPENDENCY_READONLY', 1),
  );
  assert.equal(nested.dependencies.crate.materials.wood.color, '#a0703c', 'input is unchanged');
  assert.throws(
    () => edit(document(), withSecond({ op: 'duplicateNode', id: 'body', newId: 'lid' })),
    (error: unknown) =>
      fails('DUPLICATE_ID', 1)(error) &&
      /node list/.test(String(((error as ForgeError).details as { hint?: string }).hint)),
  );
  assert.throws(
    () => edit(nested, withSecond({ op: 'removeDependency', id: 'crate' })),
    (error: unknown) =>
      fails('DEPENDENCY_IN_USE', 1)(error) &&
      JSON.stringify((error as ForgeError).details).includes('"nodes":["item"]'),
  );
  for (const [spec, code] of [
    [{ default: 5, min: 0, max: 1 }, 'PARAMETER_RANGE'],
    [{ default: 0.5, integer: true }, 'PARAMETER_INTEGER'],
    [{ default: 1, min: 2, max: 0 }, 'PARAMETER_RANGE'],
  ] as const)
    assert.throws(
      () => edit(document(), withSecond({ op: 'putParameter', id: 'w', ...spec })),
      fails(code, 1),
    );
});
