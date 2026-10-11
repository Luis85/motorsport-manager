import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SceneSchema,
  ModelSchema,
  parse,
  ForgeError,
  compileScene,
  exportScene,
} from '../src/kernel/index.js';
import { ObjectLoader, Box3, Vector3 } from 'three';

const base = (extra: Record<string, unknown> = {}) =>
  parse(SceneSchema, {
    schemaVersion: 1,
    kind: 'scene',
    id: 'main',
    name: 'Test',
    materials: { mat: { color: '#aa7755' } },
    geometries: { box: { type: 'box', size: [2, 2, 2] } },
    nodes: [{ type: 'mesh', id: 'box', geometry: 'box', material: 'mat' }],
    ...extra,
  });
const code = (expected: string) => (error: unknown) =>
  error instanceof ForgeError && error.code === expected;
test('hierarchy transforms and bounds use meters and degree rotations', () => {
  const scene = base({
    nodes: [
      { id: 'parent', type: 'group', transform: { position: [5, 0, 0], rotation: [0, 90, 0] } },
      {
        id: 'child',
        type: 'mesh',
        geometry: 'box',
        material: 'mat',
        parent: 'parent',
        transform: { position: [0, 0, 3] },
      },
    ],
  });
  const built = compileScene(scene);
  assert.equal(built.stats.meshes, 1);
  assert.ok(Math.abs(built.stats.bounds.min[0] - 7) < 1e-6);
  built.dispose();
});
test('missing references, cycles, duplicate IDs and unknown keys fail with actionable codes', () => {
  assert.throws(
    () =>
      compileScene(
        base({ nodes: [{ id: 'a', type: 'mesh', geometry: 'missing', material: 'mat' }] }),
      ),
    code('REFERENCE_MISSING'),
  );
  assert.throws(
    () =>
      compileScene(
        base({
          nodes: [
            { id: 'a', type: 'group', parent: 'b' },
            { id: 'b', type: 'group', parent: 'a' },
          ],
        }),
      ),
    code('CYCLE'),
  );
  assert.throws(
    () =>
      compileScene(
        base({
          nodes: [
            { id: 'a', type: 'group' },
            { id: 'a', type: 'group' },
          ],
        }),
      ),
    code('DUPLICATE_ID'),
  );
  assert.throws(() => base({ spellingMistake: 3 }), code('SCHEMA_INVALID'));
});
test('parameters, nested reusable models, patterns and material overrides compile', () => {
  const model = parse(ModelSchema, {
    schemaVersion: 1,
    kind: 'model',
    id: 'block',
    name: 'Block',
    parameters: { width: { default: 1, min: 0.1, max: 4 } },
    materials: { shell: { color: '#ff0000' } },
    geometries: { cube: { type: 'box', size: [{ $param: 'width' }, 1, 1] } },
    nodes: [{ id: 'body', type: 'mesh', geometry: 'cube', material: 'shell' }],
  });
  const scene = base({
    nodes: [
      {
        id: 'blocks',
        type: 'model',
        model: 'block',
        parameters: { width: 2 },
        materialOverrides: { shell: 'mat' },
        pattern: { type: 'linear', count: 3, step: [3, 0, 0] },
      },
    ],
  });
  const built = compileScene(scene, { block: model });
  assert.equal(built.stats.meshes, 3);
  assert.equal(built.stats.nodes, 7);
  assert.deepEqual(built.stats.bounds.size, [8, 1, 1]);
  assert.equal(built.stats.materials, 1);
  built.dispose();
  scene.nodes[0].type === 'model' && (scene.nodes[0].parameters.width = 10);
  assert.throws(() => compileScene(scene, { block: model }), code('PARAMETER_RANGE'));
});
test('model and geometry cycles are rejected before expanding', () => {
  const model = parse(ModelSchema, {
    schemaVersion: 1,
    kind: 'model',
    id: 'loop',
    name: 'Loop',
    nodes: [{ type: 'model', id: 'self', model: 'loop' }],
  });
  assert.throws(
    () =>
      compileScene(base({ nodes: [{ type: 'model', id: 'loop', model: 'loop' }] }), {
        loop: model,
      }),
    code('CYCLE'),
  );
  assert.throws(
    () =>
      compileScene(
        base({
          geometries: { box: { type: 'boolean', operation: 'union', left: 'box', right: 'box' } },
        }),
      ),
    code('CYCLE'),
  );
});
test('negative dimensions, zero scale and invalid triangle indices are rejected', () => {
  assert.throws(
    () => compileScene(base({ geometries: { box: { type: 'box', size: [-1, 2, 3] } } })),
    code('INVALID_GEOMETRY'),
  );
  assert.throws(
    () =>
      compileScene(
        base({
          nodes: [
            {
              id: 'a',
              type: 'mesh',
              geometry: 'box',
              material: 'mat',
              transform: { scale: [1, 0, 1] },
            },
          ],
        }),
      ),
    code('INVALID_SCALE'),
  );
  assert.throws(
    () =>
      compileScene(
        base({
          geometries: {
            box: {
              type: 'mesh',
              positions: [
                [0, 0, 0],
                [1, 0, 0],
                [0, 1, 0],
              ],
              indices: [0, 1, 3],
            },
          },
        }),
      ),
    code('INVALID_GEOMETRY'),
  );
});
test('boolean subtraction produces new topology and retains expected bounds', () => {
  const scene = base({
    geometries: {
      box: { type: 'box', size: [2, 2, 2] },
      bore: { type: 'cylinder', radiusTop: 0.5, radiusBottom: 0.5, height: 3, segments: 16 },
      result: { type: 'boolean', operation: 'subtract', left: 'box', right: 'bore' },
    },
    nodes: [{ type: 'mesh', id: 'cut', geometry: 'result', material: 'mat' }],
  });
  const built = compileScene(scene);
  assert.ok(built.stats.triangles > 12);
  assert.deepEqual(built.stats.bounds.size, [2, 2, 2]);
  assert.ok(built.stats.warnings.length);
  built.dispose();
});
test('exports are deterministic, GLB validates, and Three.js JSON round-trips bounds', async () => {
  const { validateBytes } = await import('gltf-validator');
  const scene = base();
  const first = await exportScene(scene, {}, 'glb');
  const second = await exportScene(scene, {}, 'glb');
  assert.deepEqual(first.data, second.data);
  const report = await validateBytes(first.data as Uint8Array, { maxIssues: 100 });
  assert.equal(report.issues.numErrors, 0, JSON.stringify(report.issues));
  const json = await exportScene(scene, {}, 'three');
  const object = new ObjectLoader().parse(JSON.parse(json.data as string));
  assert.deepEqual(new Box3().setFromObject(object).getSize(new Vector3()).toArray(), [2, 2, 2]);
  const gltf = JSON.parse((await exportScene(scene, {}, 'gltf')).data as string);
  assert.equal(gltf.asset.version, '2.0');
  assert.match(gltf.buffers[0].uri, /^data:/);
  const stl = (await exportScene(scene, {}, 'stl')).data as Uint8Array;
  assert.equal(new DataView(stl.buffer, stl.byteOffset).getUint32(80, true), 12);
  assert.match((await exportScene(scene, {}, 'obj')).data as string, /\nf /);
});
test('all primitive/profile constructors compile and export valid GLB', async () => {
  const { validateBytes } = await import('gltf-validator');
  const geometries = {
    box: { type: 'box', size: [1, 2, 3] },
    sphere: { type: 'sphere', radius: 1 },
    cylinder: { type: 'cylinder', radiusTop: 0.5, radiusBottom: 1, height: 2 },
    cone: { type: 'cone', radius: 1, height: 2 },
    torus: { type: 'torus', radius: 1, tube: 0.2 },
    capsule: { type: 'capsule', radius: 0.3, length: 1 },
    plane: { type: 'plane', size: [2, 2] },
    lathe: {
      type: 'lathe',
      points: [
        [0, 0],
        [0.5, 0],
        [0.7, 1],
        [0, 1],
      ],
      segments: 24,
    },
    extrude: {
      type: 'extrude',
      points: [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ],
      holes: [
        [
          [-0.3, -0.3],
          [-0.3, 0.3],
          [0.3, 0.3],
          [0.3, -0.3],
        ],
      ],
      depth: 0.5,
      bevel: 0.03,
    },
    mesh: {
      type: 'mesh',
      positions: [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
      ],
      indices: [0, 1, 2],
    },
  };
  const scene = base({
    geometries,
    nodes: Object.keys(geometries).map((id, i) => ({
      type: 'mesh',
      id,
      geometry: id,
      material: 'mat',
      transform: { position: [i * 3, 0, 0] },
    })),
  });
  const result = await exportScene(scene, {}, 'glb');
  assert.equal(result.stats.meshes, 10);
  assert.equal((await validateBytes(result.data as Uint8Array)).issues.numErrors, 0);
});
test('export excludes hidden subtrees consistently and reports selected-subtree statistics', async () => {
  const scene = base({
    nodes: [
      { id: 'visible', type: 'mesh', geometry: 'box', material: 'mat' },
      { id: 'hidden', type: 'group', visible: false },
      { id: 'hiddenChild', parent: 'hidden', type: 'mesh', geometry: 'box', material: 'mat' },
    ],
  });
  for (const format of ['glb', 'obj', 'stl', 'three'] as const) {
    const result = await exportScene(scene, {}, format);
    assert.equal(result.stats.meshes, 1);
    assert.equal(result.stats.triangles, 12);
  }
  await assert.rejects(exportScene(scene, {}, 'glb', 'hiddenChild'), code('NODE_HIDDEN'));
  assert.equal((await exportScene(scene, {}, 'glb', 'visible')).stats.meshes, 1);
});
