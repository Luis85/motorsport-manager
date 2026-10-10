import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  parse,
  ModelSchema,
  ModelBundleSchema,
  SceneSchema,
  ForgeError,
  stateHash,
  modelStateHash,
  modelDependencies,
  authoringTarget,
  exportScene,
  compileScene,
  type ModelLibrary,
} from '../src/kernel/index.js';

// Fixture and expected digests were produced by bin/scene-forge before the kernel moved into
// Model Forge (model import of this bundle, model instantiate lamp lamp1, inspect, export).
const bundle = {
  schemaVersion: 1,
  kind: 'model-bundle',
  entry: 'lamp',
  models: {
    bulb: {
      schemaVersion: 1,
      kind: 'model',
      id: 'bulb',
      name: 'Bulb',
      parameters: { r: { default: 0.2, min: 0.05, max: 1 } },
      geometries: { ball: { type: 'sphere', radius: { $param: 'r' } } },
      materials: { glass: { color: '#ffeeaa', emissive: '#ffcc66', emissiveIntensity: 2 } },
      nodes: [{ id: 'ball', type: 'mesh', geometry: 'ball', material: 'glass' }],
    },
    lamp: {
      schemaVersion: 1,
      kind: 'model',
      id: 'lamp',
      name: 'Lamp',
      category: 'props',
      geometries: {
        post: { type: 'cylinder', radiusTop: 0.05, radiusBottom: 0.08, height: 2 },
      },
      materials: { metal: { color: '#333333', metalness: 0.8, roughness: 0.3 } },
      nodes: [
        {
          id: 'post',
          type: 'mesh',
          geometry: 'post',
          material: 'metal',
          transform: { position: [0, 1, 0] },
        },
        {
          id: 'head',
          type: 'model',
          model: 'bulb',
          parameters: { r: 0.25 },
          transform: { position: [0, 2.1, 0] },
        },
      ],
    },
  },
};
const storedLamp =
  '{"schemaVersion":1,"kind":"model","id":"lamp","category":"props","name":"Lamp","parameters":{},"geometries":{"post":{"type":"cylinder","radiusTop":0.05,"radiusBottom":0.08,"height":2}},"materials":{"metal":{"color":"#333333","metalness":0.8,"roughness":0.3,"opacity":1,"doubleSided":false,"flatShading":false}},"nodes":[{"id":"post","transform":{"position":[0,1,0]},"visible":true,"tags":[],"type":"mesh","geometry":"post","material":"metal"},{"id":"head","transform":{"position":[0,2.1,0]},"visible":true,"tags":[],"type":"model","model":"bulb","parameters":{"r":0.25},"materialOverrides":{}}]}';
const scene = () =>
  parse(SceneSchema, {
    schemaVersion: 1,
    kind: 'scene',
    id: 'main',
    name: 'Main scene',
    revision: 1,
    nodes: [
      {
        id: 'lamp1',
        type: 'model',
        model: 'lamp',
        transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      },
    ],
  });
const library = (): ModelLibrary => parse(ModelBundleSchema, bundle).models;
const code = (expected: string) => (error: unknown) =>
  error instanceof ForgeError && error.code === expected;

test('absent model revisions keep the pre-kernel parse bytes and scene state hash', () => {
  const models = library();
  assert.equal(Object.hasOwn(models.lamp, 'revision'), false);
  assert.equal(JSON.stringify(models.lamp), storedLamp);
  assert.equal(
    stateHash(scene(), models),
    '8ee66ca834707a87ab527dae853ab3af2dff414c9b407fac909b7ab45567be6a',
  );
});

test('nested model GLB export is byte-identical to the pre-kernel executable', async () => {
  const models = library();
  const target = authoringTarget(scene(), models, { model: 'lamp' });
  const { data } = await exportScene(target, models, 'glb');
  assert.equal(
    createHash('sha256').update(data).digest('hex'),
    '7d4c13a652df7a757819e49b20e26a81606e46d2afc46cdca82c45dc8a910618',
  );
});

test('model revision is an optional nonnegative integer that compiles unchanged', () => {
  const revised = parse(ModelSchema, { ...bundle.models.lamp, revision: 3 });
  assert.equal(revised.revision, 3);
  const plain = library();
  const withRevision = { ...plain, lamp: revised };
  const before = compileScene(scene(), plain);
  const after = compileScene(scene(), withRevision);
  try {
    assert.deepEqual(after.stats, before.stats);
    assert.deepEqual(after.scene.toJSON(), before.scene.toJSON());
  } finally {
    before.dispose();
    after.dispose();
  }
  assert.notEqual(stateHash(scene(), withRevision), stateHash(scene(), plain));
  for (const revision of [-1, 1.5, '2'])
    assert.throws(
      () => parse(ModelSchema, { ...bundle.models.lamp, revision }),
      code('SCHEMA_INVALID'),
    );
});

test('model state hashes cover the document and its frozen dependencies, not key order', () => {
  const models = library();
  const dependencies = modelDependencies(models, 'lamp');
  delete dependencies.lamp;
  const hash = modelStateHash(models.lamp, dependencies);
  assert.match(hash, /^[a-f0-9]{64}$/);
  const reordered = Object.fromEntries(Object.entries(models.lamp).reverse());
  assert.equal(modelStateHash(parse(ModelSchema, reordered), dependencies), hash);
  const changed = structuredClone(dependencies);
  changed.bulb.parameters.r.default = 0.3;
  assert.notEqual(modelStateHash(models.lamp, changed), hash);
  assert.notEqual(modelStateHash({ ...models.lamp, revision: 1 }, dependencies), hash);
});
