import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Box3, Vector3 } from 'three';
import {
  parse,
  SceneSchema,
  ModelSchema,
  BatchSchema,
  CompositionSchema,
  ForgeError,
  type Operation,
} from '../src/domain/schema.js';
import { applyOperations } from '../src/application/operations.js';
import { captureModel, modelDependencies } from '../src/application/composition.js';
import { compileScene } from '../src/application/compiler.js';
import {
  initProject,
  commitOperations,
  loadProject,
  importModel,
  captureProjectModel,
  cloneScene,
} from '../src/infra/project.js';

const fixture = () =>
  parse(SceneSchema, {
    schemaVersion: 1,
    kind: 'scene',
    id: 'main',
    name: 'Scene',
    parameters: { height: 2 },
    materials: { m: { color: '#b9bdc8' }, unused: { color: '#aaaaaa' } },
    geometries: {
      box: { type: 'box', size: [2, { $param: 'height' }, 2] },
      unused: { type: 'sphere', radius: 1 },
    },
    nodes: [
      { type: 'group', id: 'assembly', transform: { position: [4, 0, 0] } },
      {
        type: 'mesh',
        id: 'body',
        parent: 'assembly',
        geometry: 'box',
        material: 'm',
        transform: { position: [0, 1, 0] },
      },
      {
        type: 'mesh',
        id: 'target',
        geometry: 'box',
        material: 'm',
        transform: { position: [-4, 1, 0] },
      },
    ],
  });
const operations = (items: unknown[]) => parse(BatchSchema, { operations: items }).operations;
const errorCode = (code: string) => (error: unknown) =>
  error instanceof ForgeError && error.code === code;
function bounds(scene: ReturnType<typeof fixture>, id: string) {
  const built = compileScene(scene);
  try {
    return new Box3().setFromObject(built.content.getObjectByName(`${scene.id}/${id}`)!);
  } finally {
    built.dispose();
  }
}

test('capture produces a reusable recipe with local pivot and minimal dependencies', () => {
  const model = captureModel(fixture(), ['assembly'], 'module', 'Module');
  assert.deepEqual(Object.keys(model.geometries), ['box']);
  assert.deepEqual(Object.keys(model.materials), ['m']);
  assert.deepEqual((model.geometries.box as any).size, [2, 2, 2]);
  assert.deepEqual(model.nodes[0].transform?.position, [0, 0, 0]);
  assert.equal(model.nodes[1].parent, 'assembly');
  const scene = parse(SceneSchema, {
    schemaVersion: 1,
    kind: 'scene',
    id: 'new',
    name: 'New scene',
    nodes: [
      { type: 'model', id: 'a', model: 'module', transform: { position: [10, 0, 0] } },
      { type: 'model', id: 'b', model: 'module', transform: { position: [-10, 0, 0] } },
    ],
  });
  const built = compileScene(scene, { module: model });
  assert.equal(built.stats.meshes, 2);
  assert.deepEqual(built.stats.bounds.size, [22, 2, 2]);
  built.dispose();
});
test('capture keeps root rotation and scale and rejects overlapping or unrelated roots', () => {
  const s = fixture();
  s.nodes[0].transform = { position: [8, 0, 0], rotation: [0, 90, 0], scale: [2, 2, 2] };
  const model = captureModel(s, ['assembly'], 'asset');
  assert.deepEqual(model.nodes[0].transform, {
    position: [0, 0, 0],
    rotation: [0, 90, 0],
    scale: [2, 2, 2],
  });
  assert.throws(() => captureModel(s, ['assembly', 'body'], 'bad'), errorCode('DIFFERENT_PARENTS'));
});
test('duplicate copies whole subtrees, rewires children and keeps resources shared', () => {
  const s = applyOperations(
    fixture(),
    operations([{ op: 'duplicateNode', id: 'assembly', newId: 'copy', offset: [3, 0, 0] }]),
  );
  assert.equal(s.nodes.length, 5);
  assert.equal(s.nodes.find((n) => n.id === 'copy--body')?.parent, 'copy');
  assert.deepEqual(s.nodes.find((n) => n.id === 'copy')?.transform?.position, [7, 0, 0]);
  assert.equal(Object.keys(s.geometries).length, 2);
  assert.throws(
    () => applyOperations(s, operations([{ op: 'duplicateNode', id: 'assembly', newId: 'copy' }])),
    errorCode('ALREADY_EXISTS'),
  );
});
test('transform patch preserves other components and supports partial parameter overrides', () => {
  const s = fixture();
  s.nodes[0].transform = { position: [4, 0, 0], rotation: [0, 40, 0], scale: [2, 2, 2] };
  const changed = applyOperations(
    s,
    operations([
      {
        op: 'patchNode',
        id: 'assembly',
        patch: { transform: { position: [3, 2, 1] }, visible: false },
      },
    ]),
  );
  assert.deepEqual(changed.nodes[0].transform?.rotation, [0, 40, 0]);
  assert.equal(changed.nodes[0].visible, false);
  assert.deepEqual(s.nodes[0].transform.position, [4, 0, 0]);
  assert.throws(
    () =>
      applyOperations(
        s,
        operations([{ op: 'patchNode', id: 'body', patch: { parameters: { width: 2 } } }]),
      ),
    errorCode('INVALID_NODE_TYPE'),
  );
});
test('reparent preserves world transforms and rejects cycles and unrepresentable shear', () => {
  const s = fixture();
  const before = bounds(s, 'body');
  const changed = applyOperations(
    s,
    operations([{ op: 'reparentNode', id: 'body', parent: null }]),
  );
  assert.ok(bounds(changed, 'body').min.distanceTo(before.min) < 1e-8);
  assert.equal(changed.nodes.find((n) => n.id === 'body')?.parent, undefined);
  assert.throws(
    () => applyOperations(s, operations([{ op: 'reparentNode', id: 'assembly', parent: 'body' }])),
    errorCode('CYCLE'),
  );
  s.nodes[0].transform = { scale: [2, 1, 1] };
  s.nodes[1].transform = { rotation: [0, 0, 45] };
  assert.throws(
    () => applyOperations(s, operations([{ op: 'reparentNode', id: 'body', parent: null }])),
    errorCode('SHEAR_UNSUPPORTED'),
  );
});
test('ground and relative placement operate correctly under rotated parents', () => {
  const s = fixture();
  s.nodes[0].transform = { position: [4, 5, 0], rotation: [0, 0, 30] };
  let changed = applyOperations(s, operations([{ op: 'groundNode', id: 'body', y: 0 }]));
  assert.ok(Math.abs(bounds(changed, 'body').min.y) < 1e-6);
  changed = applyOperations(
    changed,
    operations([
      { op: 'placeNode', id: 'assembly', target: 'target', side: 'right', gap: 1, center: true },
    ]),
  );
  assert.ok(
    Math.abs(bounds(changed, 'assembly').min.x - bounds(changed, 'target').max.x - 1) < 1e-6,
  );
  assert.ok(
    bounds(changed, 'assembly').getCenter(new Vector3()).y -
      bounds(changed, 'target').getCenter(new Vector3()).y <
      1e-6,
  );
  assert.throws(
    () =>
      applyOperations(
        s,
        operations([{ op: 'placeNode', id: 'body', target: 'assembly', side: 'right' }]),
      ),
    errorCode('DEPENDENT_NODES'),
  );
});
test('grouping preserves sibling placement and rejects mixed parent selections', () => {
  const s = fixture();
  const before = bounds(s, 'assembly');
  const grouped = applyOperations(
    s,
    operations([{ op: 'groupNodes', id: 'all', nodes: ['assembly', 'target'] }]),
  );
  assert.equal(grouped.nodes.find((n) => n.id === 'assembly')?.parent, 'all');
  assert.deepEqual(bounds(grouped, 'assembly').min.toArray(), before.min.toArray());
  assert.throws(
    () =>
      applyOperations(s, operations([{ op: 'groupNodes', id: 'bad', nodes: ['body', 'target'] }])),
    errorCode('DIFFERENT_PARENTS'),
  );
});
test('portable bundles include transitive dependencies and import into a new project', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-bundle-'));
  try {
    await initProject(root);
    const leaf = captureModel(fixture(), ['assembly'], 'leaf');
    const parent = parse(ModelSchema, {
      schemaVersion: 1,
      kind: 'model',
      id: 'parent',
      name: 'Parent',
      nodes: [{ type: 'model', id: 'child', model: 'leaf' }],
    });
    const models = modelDependencies({ leaf, parent }, 'parent');
    assert.deepEqual(Object.keys(models), ['leaf', 'parent']);
    await importModel(root, { schemaVersion: 1, kind: 'model-bundle', entry: 'parent', models });
    const s = await loadProject(root);
    assert.equal(Object.keys(s.models).length, 2);
    await importModel(root, { schemaVersion: 1, kind: 'model-bundle', entry: 'parent', models });
    assert.equal(Object.keys((await loadProject(root)).models).length, 2);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test('state guard rejects library changes that do not increment scene revision', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-guard-'));
  try {
    await initProject(root);
    const before = await loadProject(root);
    await importModel(root, captureModel(fixture(), ['assembly'], 'module'));
    const after = await loadProject(root);
    assert.equal(after.scene.revision, before.scene.revision);
    assert.notEqual(after.stateHash, before.stateHash);
    await assert.rejects(
      commitOperations(root, undefined, operations([{ op: 'setParameter', id: 'x', value: 1 }]), {
        expectedState: before.stateHash,
      }),
      errorCode('STATE_CONFLICT'),
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test('capture and composition persist, remain idempotent and clone scene identity', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-capture-'));
  try {
    await initProject(root);
    const s = fixture();
    await commitOperations(
      root,
      undefined,
      operations([
        { op: 'putMaterial', id: 'm', material: s.materials.m },
        { op: 'putGeometry', id: 'box', geometry: { type: 'box', size: [2, 2, 2] } },
        ...s.nodes.map((node) => ({ op: 'putNode', node })),
      ]),
    );
    const before = await loadProject(root);
    await captureProjectModel(root, undefined, ['assembly'], 'module', 'Module', false, {
      expectedState: before.stateHash,
    });
    const recipe = parse(CompositionSchema, {
      schemaVersion: 1,
      kind: 'composition',
      instances: [{ id: 'instance', model: 'module', transform: { position: [9, 0, 0] } }],
    });
    const ops: Operation[] = recipe.instances.map((node) => ({ op: 'putNode', node }));
    assert.equal((await commitOperations(root, undefined, ops)).changed, true);
    assert.equal((await commitOperations(root, undefined, ops)).changed, false);
    await cloneScene(root, undefined, 'copy');
    const copy = await loadProject(root, 'copy');
    assert.equal(copy.scene.revision, 0);
    assert.equal(copy.scene.id, 'copy');
    assert.equal(copy.scene.nodes.length, 4);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
