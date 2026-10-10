import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { BufferGeometry, Mesh, Material } from 'three';
import {
  canonical,
  parse,
  SceneSchema,
  NodeSchema,
  ForgeError,
  type Operation,
  prepareSceneEdit,
  applyOperations,
  compileScene,
  stateHash,
  withCaptureSession,
} from '../src/kernel/index.js';

const scene = () =>
  parse(SceneSchema, {
    schemaVersion: 1,
    kind: 'scene',
    id: 'main',
    name: 'Main',
    nodes: [{ id: 'assembly', type: 'group' }],
  });
const patch: Operation[] = [{ op: 'patchNode', id: 'assembly', patch: { name: 'Renamed' } }];

test('pure edit preparation keeps inputs intact and aligns dry-run, commit and no-op tokens', () => {
  const original = scene(),
    models = {},
    snapshot = { scene: original, models, stateHash: stateHash(original, models) };
  const before = structuredClone(snapshot);
  const dry = prepareSceneEdit(
    snapshot,
    patch,
    { dryRun: true, expectedState: snapshot.stateHash },
    stateHash,
  );
  assert.equal(dry.result.revision, 0);
  assert.equal(dry.result.stateHash, snapshot.stateHash);
  const committed = prepareSceneEdit(snapshot, patch, {}, stateHash);
  assert.equal(committed.result.stateHash, dry.result.proposedStateHash);
  assert.equal(committed.next.revision, 1);
  const noOp = prepareSceneEdit(
    { ...snapshot, scene: committed.next, stateHash: committed.result.stateHash },
    patch,
    {},
    stateHash,
  );
  assert.equal(noOp.result.changed, false);
  assert.equal(noOp.next.revision, 1);
  assert.deepEqual(snapshot, before);
  assert.throws(
    () => prepareSceneEdit(snapshot, patch, { expectedRevision: 7 }, stateHash),
    (error: unknown) => error instanceof ForgeError && error.code === 'REVISION_CONFLICT',
  );
});

test('operation application never aliases or mutates caller-owned operation data', () => {
  const input = scene();
  const node = parse(NodeSchema, { type: 'group', id: 'added' });
  const operations: Operation[] = [
    { op: 'putNode', node },
    { op: 'patchNode', id: 'added', patch: { name: 'changed' } },
  ];
  const next = applyOperations(input, operations);
  next.nodes[1].tags.push('local');
  assert.equal(node.name, undefined);
  assert.deepEqual(node.tags, []);
  assert.equal(input.nodes.length, 1);
});

test('state guards retain the canonical SHA-256 representation across key ordering', () => {
  const doc = scene();
  assert.equal(stateHash(doc, {}), stateHash({ ...doc, environment: { ...doc.environment } }, {}));
  assert.equal(canonical({ b: 2, a: [1, null], ignored: undefined }), '{"a":[1,null],"b":2}');
  // Golden value computed before extraction of the original stateHash implementation.
  assert.equal(
    stateHash(doc, {}),
    'c4358e002cd9611d46ab89f1dfaca0ae1010881ac9e9fc717270e78af7562e91',
  );
});

test('capture cleans its workspace when Chromium cannot launch', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-capture-failure-'));
  await assert.rejects(
    withCaptureSession(
      '<html></html>',
      { width: 100, height: 100 },
      async () => assert.fail('must not capture'),
      {
        createTemp: async () => temp,
        launch: async () => {
          throw new Error('unavailable');
        },
      },
    ),
    (error: unknown) => error instanceof ForgeError && error.code === 'BROWSER_UNAVAILABLE',
  );
  await assert.rejects(fs.access(temp), { code: 'ENOENT' });
});

test('capture preserves setup errors and removes workspace even when browser close fails', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-capture-close-'));
  let closed = false;
  await assert.rejects(
    withCaptureSession(
      '<html></html>',
      { width: 100, height: 100 },
      async () => assert.fail('must not capture'),
      {
        createTemp: async () => temp,
        launch: async () => ({
          newPage: async () => {
            throw new Error('page failed');
          },
          version: () => 'fake',
          close: async () => {
            closed = true;
            throw new Error('close failed');
          },
        }),
      },
    ),
    /page failed/,
  );
  assert.equal(closed, true);
  await assert.rejects(fs.access(temp), { code: 'ENOENT' });
});

test('compiler disposes pooled geometry and materials once, even when called twice', () => {
  const doc = parse(SceneSchema, {
    ...scene(),
    geometries: { box: { type: 'box', size: [1, 1, 1] } },
    materials: { clay: { color: '#cc9270' } },
    nodes: [
      {
        id: 'box',
        type: 'mesh',
        geometry: 'box',
        material: 'clay',
        pattern: { type: 'linear', count: 3, step: [2, 0, 0] },
      },
    ],
  });
  const built = compileScene(doc),
    meshes: Mesh[] = [];
  built.content.traverse((object) => {
    if (object instanceof Mesh) meshes.push(object);
  });
  assert.ok(meshes[0].geometry instanceof BufferGeometry);
  assert.equal(meshes[0].geometry, meshes[1].geometry);
  let geometries = 0,
    materials = 0;
  meshes[0].geometry.addEventListener('dispose', () => {
    geometries++;
  });
  (meshes[0].material as Material).addEventListener('dispose', () => {
    materials++;
  });
  built.dispose();
  built.dispose();
  assert.equal(geometries, 1);
  assert.equal(materials, 1);
});
