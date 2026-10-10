import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Mesh, Raycaster, Vector3, type BufferGeometry, type Material } from 'three';
import {
  parse,
  canonical,
  ForgeError,
  GeometrySchema,
  HeightfieldGeometrySchema,
  MaterialSchema,
  SceneSchema,
  compileScene,
  exportScene,
  validateExport,
  heightGrid,
  heightfieldGeometry,
  sampleHeightfield,
  heightfieldSampler,
  terrainPreset,
  terrainPresetNames,
  terrainPresets,
  type HeightfieldSpec,
} from '../src/kernel/index.js';

const spec = (input: Record<string, unknown> = {}) =>
  parse(HeightfieldGeometrySchema, {
    type: 'heightfield',
    size: [20, 12],
    amplitude: 4,
    resolution: [17, 11],
    seed: 5,
    ...input,
  }) as HeightfieldSpec;

const terrainScene = (geometry: Record<string, unknown>, material: Record<string, unknown>) =>
  parse(SceneSchema, {
    schemaVersion: 1,
    kind: 'scene',
    id: 'land',
    name: 'Land',
    geometries: { ground: geometry },
    materials: { ground: material },
    nodes: [{ id: 'terrain', type: 'mesh', geometry: 'ground', material: 'ground' }],
  });

test('heightfield schema applies defaults and bounds resolution, noise and bands', () => {
  const minimal = parse(GeometrySchema, { type: 'heightfield', size: [10, 10], amplitude: 2 });
  assert.deepEqual(minimal, {
    type: 'heightfield',
    size: [10, 10],
    amplitude: 2,
    resolution: [64, 64],
    seed: 1,
    noise: { kind: 'value', octaves: 4, frequency: 3, lacunarity: 2, gain: 0.5 },
    falloff: 'none',
    terrace: 0,
  });
  for (const bad of [
    { resolution: [257, 64] },
    { resolution: [1, 64] },
    { noise: { octaves: 9 } },
    { noise: { frequency: 65 } },
    { terrace: 33 },
    { seed: 2 ** 32 },
    { bands: Array.from({ length: 9 }, (_, i) => ({ below: i / 9, color: '#000000' })) },
    { falloff: 'crater' },
    { extra: true },
  ])
    assert.throws(
      () => parse(GeometrySchema, { type: 'heightfield', size: [10, 10], amplitude: 2, ...bad }),
      (error: unknown) => error instanceof ForgeError && error.code === 'SCHEMA_INVALID',
      JSON.stringify(bad),
    );
  for (const bad of [
    { amplitude: -1 },
    {
      bands: [
        { below: 0.5, color: '#000000' },
        { below: 0.5, color: '#ffffff' },
      ],
    },
  ])
    assert.throws(
      () => compileScene(terrainScene({ ...spec(), ...bad }, { color: '#ffffff' })),
      (error: unknown) => error instanceof ForgeError && error.code === 'INVALID_GEOMETRY',
    );
});

test('heights are deterministic, bounded by amplitude and depend on seed and noise', () => {
  const grid = heightGrid(spec());
  assert.equal(grid.length, 17 * 11);
  assert.deepEqual(heightGrid(spec()), grid);
  assert.ok(grid.every((h) => h >= 0 && h <= 4));
  assert.ok(Math.max(...grid) - Math.min(...grid) > 0.5, 'the terrain is not flat');
  assert.notDeepEqual(heightGrid(spec({ seed: 6 })), grid);
  for (const kind of ['ridged', 'billow'] as const)
    assert.notDeepEqual(heightGrid(spec({ noise: { kind } })), grid);
  const island = heightGrid(spec({ falloff: 'island' }));
  assert.equal(island[0], 0, 'island corners fall to zero');
  assert.equal(island[16], 0);
  const terraced = heightGrid(spec({ terrace: 4 }));
  assert.notDeepEqual(terraced, grid);
  assert.ok(heightGrid(spec({ amplitude: 0 })).every((h) => h === 0));
});

test('sampleHeightfield equals mesh vertex heights and lies on the rendered triangle', () => {
  const s = spec();
  const geometry = heightfieldGeometry(s);
  const position = geometry.getAttribute('position');
  const index = geometry.index!;
  assert.equal(position.count, 17 * 11);
  assert.equal(index.count / 3, 2 * 16 * 10);
  const sample = heightfieldSampler(s);
  for (let i = 0; i < position.count; i++) {
    const hit = sample(position.getX(i), position.getZ(i));
    assert.ok(hit.inside);
    assert.ok(Math.abs(hit.y - position.getY(i)) < 1e-5, `vertex ${i}`);
  }
  // Points inside every triangle: barycentric interpolation of the rendered corners.
  const a = new Vector3(),
    b = new Vector3(),
    c = new Vector3();
  for (let t = 0; t < index.count; t += 3) {
    a.fromBufferAttribute(position, index.getX(t));
    b.fromBufferAttribute(position, index.getX(t + 1));
    c.fromBufferAttribute(position, index.getX(t + 2));
    for (const [wa, wb] of [
      [0.2, 0.3],
      [0.6, 0.1],
      [0.1, 0.8],
    ]) {
      const wc = 1 - wa - wb;
      const p = a.clone().multiplyScalar(wa).addScaledVector(b, wb).addScaledVector(c, wc);
      const hit = sampleHeightfield(s, p.x, p.z);
      assert.ok(Math.abs(hit.y - p.y) < 1e-4, `triangle ${t / 3}`);
      const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
      assert.ok(normal.y > 0, 'triangles face up');
      assert.ok(new Vector3(...hit.normal).distanceTo(normal) < 1e-4, 'face normal');
    }
  }
  const outside = sample(100, 0);
  assert.equal(outside.inside, false);
  assert.ok(Number.isFinite(outside.y));
});

test('a compiled heightfield node raycasts to the sampled height', () => {
  const s = spec({ resolution: [33, 33] });
  const built = compileScene(terrainScene(s, { color: '#77aa55' }));
  try {
    const mesh = built.content.getObjectByName('land/terrain') as Mesh;
    const ray = new Raycaster();
    for (const [x, z] of [
      [0.3, 0.2],
      [-7.1, 4.4],
      [9.2, -5.3],
    ]) {
      ray.set(new Vector3(x, 100, z), new Vector3(0, -1, 0));
      const [hit] = ray.intersectObject(mesh);
      assert.ok(Math.abs(hit.point.y - sampleHeightfield(s, x, z).y) < 1e-4, `${x},${z}`);
    }
  } finally {
    built.dispose();
  }
});

test('heightfield GLB export validates, is deterministic and carries band colors', async () => {
  const preset = terrainPreset('island', { resolution: [48, 48], seed: 11 });
  const scene = terrainScene(preset.geometry, preset.material);
  const first = await exportScene(scene, {}, 'glb');
  const second = await exportScene(scene, {}, 'glb');
  const digest = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex');
  assert.equal(digest(first.data), digest(second.data));
  const report = (await validateExport(first.data, 'glb')) as {
    numErrors: number;
    numWarnings: number;
  };
  assert.equal(report.numErrors, 0);
  assert.equal(report.numWarnings, 0);
  const gltf = await exportScene(scene, {}, 'gltf');
  const json = JSON.parse(String(gltf.data));
  assert.ok(json.meshes[0].primitives[0].attributes.COLOR_0 !== undefined, 'vertex colors');
  const plain = terrainScene(spec(), { color: '#77aa55' });
  const plainJson = JSON.parse(String((await exportScene(plain, {}, 'gltf')).data));
  assert.equal(plainJson.meshes[0].primitives[0].attributes.COLOR_0, undefined);
  const built = compileScene(scene);
  try {
    const mesh = built.content.getObjectByName('land/terrain') as Mesh<BufferGeometry, Material>;
    assert.equal((mesh.material as Material & { vertexColors: boolean }).vertexColors, true);
    assert.equal(built.stats.triangles, 2 * 47 * 47);
  } finally {
    built.dispose();
  }
});

test('vertexColors is optional and leaves existing material keys and builds unchanged', () => {
  const material = parse(MaterialSchema, { color: '#123456' });
  assert.equal(Object.hasOwn(material, 'vertexColors'), false);
  assert.equal(
    canonical(material),
    '{"color":"#123456","doubleSided":false,"flatShading":false,"metalness":0,"opacity":1,"roughness":0.65}',
  );
  const built = compileScene(terrainScene({ type: 'box', size: [1, 1, 1] }, { color: '#123456' }));
  try {
    const mesh = built.content.getObjectByName('land/terrain') as Mesh<BufferGeometry, Material>;
    assert.equal((mesh.material as Material & { vertexColors: boolean }).vertexColors, false);
  } finally {
    built.dispose();
  }
});

test('terrain presets are valid data with overridable size, resolution and seed', () => {
  assert.deepEqual([...terrainPresetNames], ['plains', 'hills', 'mountains', 'island', 'dunes']);
  for (const name of terrainPresetNames) {
    const { geometry, material } = terrainPreset(name);
    assert.equal(geometry.type, 'heightfield');
    assert.equal(material.vertexColors, true);
    assert.ok(terrainPresets[name].description.length > 10);
    const built = compileScene(terrainScene(geometry, material));
    built.dispose();
  }
  const custom = terrainPreset('dunes', { size: [10, 20], resolution: [8, 9], seed: 3 });
  assert.deepEqual(
    [custom.geometry.size, custom.geometry.resolution, custom.geometry.seed],
    [[10, 20], [8, 9], 3],
  );
  assert.throws(
    () => terrainPreset('volcano'),
    (error: unknown) => error instanceof ForgeError && error.code === 'NOT_FOUND',
  );
  assert.throws(
    () => terrainPreset('hills', { resolution: [512, 512] }),
    (error: unknown) => error instanceof ForgeError && error.code === 'SCHEMA_INVALID',
  );
});
