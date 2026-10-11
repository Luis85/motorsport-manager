import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import {
  FinishSchema,
  MaterialSchema,
  SceneSchema,
  ModelSchema,
  parse,
  generateFinish,
  finishAlgorithm,
  compileScene,
  createMaterial,
  littlewildModel,
  littlewildModels,
  exportScene,
  validateExport,
  type FinishSpec,
} from '../src/kernel/index.js';

const finish: FinishSpec = {
  version: 1,
  kind: 'painted-metal',
  seed: 7,
  scale: 2,
  wear: 0.35,
  palette: ['#485239', '#736746', '#313b2b'],
};
const paint = { color: '#ffffff', metalness: 0.85, roughness: 0.9, finish };
const fixture = () =>
  parse(SceneSchema, {
    schemaVersion: 1,
    kind: 'scene',
    id: 'finish',
    name: 'Finish',
    geometries: { body: { type: 'box', size: [2, 1, 3] } },
    materials: { paint },
    nodes: [{ id: 'body', type: 'mesh', geometry: 'body', material: 'paint' }],
  });

test('finish contract rejects unsupported versions, unbounded recipes and incompatible shading', () => {
  for (const change of [
    { version: 0 },
    { version: 2 },
    { seed: -1 },
    { seed: 0.5 },
    { seed: 65536 },
    { scale: 0 },
    { scale: 17 },
    { wear: -0.1 },
    { wear: 1.1 },
    { kind: 'shader' },
    { palette: [] },
    { palette: ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff'] },
    { palette: ['red'] },
    { palette: ['#abcdef00'] },
    { url: 'https://example.org/image.png' },
  ])
    assert.equal(FinishSchema.safeParse({ ...finish, ...change }).success, false);
  const { version: _version, ...missing } = finish;
  assert.equal(FinishSchema.safeParse(missing).success, false);
  for (const wear of [NaN, Infinity]) assert.throws(() => generateFinish({ ...finish, wear }));
  assert.throws(
    () => createMaterial(parse(MaterialSchema, { ...paint, shading: 'unlit' })),
    /standard PBR/,
  );
  assert.throws(
    () =>
      createMaterial(
        parse(MaterialSchema, {
          ...paint,
          surface: { kind: 'cloth', seed: 0, scale: 1, strength: 0.2 },
        }),
      ),
    /surface or finish/,
  );
});

test('finish v1 pixels have fixed identity, distinct recipes and bounded physically meaningful channels', () => {
  const pixels = generateFinish(finish);
  const digest = createHash('sha256')
    .update(pixels.color)
    .update(pixels.normal)
    .update(pixels.orm)
    .digest('hex');
  // Captured from implementation 09ed6726 before lattice precomputation.
  // Cross-runtime parity alone would miss a simultaneous regression in both copies.
  const history = createHash('sha256');
  for (const kind of ['painted-metal', 'bare-metal', 'rubber'] as const)
    for (const seed of [0, 7, 65535])
      for (const wear of [0, 0.35, 1])
        for (const palette of [
          undefined,
          ['#ffffff'],
          ['#000000', '#ffffff', '#485239', '#AbCdEf'],
        ]) {
          const sample = generateFinish({
            version: 1,
            kind,
            seed,
            scale: seed === 7 ? 16 : 1,
            wear,
            ...(palette ? { palette } : {}),
          });
          history.update(sample.color).update(sample.normal).update(sample.orm);
        }
  assert.equal(
    history.digest('hex'),
    '0e645858b3f3af227e367a64dee336d84cb41b47915edc35ae8ce6e41961d8c2',
  );
  assert.equal(finishAlgorithm, 'forge-finish-v1');
  assert.equal(digest, '7c6615684c36f6d9db1be7fecf7733bd2dee0387bfa5bdb38d291f25963cbc78');
  assert.deepEqual(generateFinish(finish), pixels);
  assert.notDeepEqual(generateFinish({ ...finish, seed: 8 }).color, pixels.color);
  assert.notDeepEqual(generateFinish({ ...finish, wear: 1 }).orm, pixels.orm);
  for (const kind of ['painted-metal', 'bare-metal', 'rubber'] as const) {
    const sample = generateFinish({ ...finish, kind });
    assert.equal(sample.width, 128);
    assert.equal(sample.height, 128);
    for (let i = 0; i < sample.color.length; i += 4) {
      assert.equal(sample.color[i + 3], 255);
      assert.equal(sample.normal[i + 3], 255);
      assert.equal(sample.orm[i], 255, 'No fabricated ambient occlusion.');
      assert.ok(sample.orm[i + 1] >= 0 && sample.orm[i + 1] <= 255);
      assert.equal(sample.orm[i + 3], 255);
      if (kind === 'rubber') assert.equal(sample.orm[i + 2], 0);
      if (kind === 'bare-metal') assert.equal(sample.orm[i + 2], 255);
      const vector = [0, 1, 2].map((channel) => (sample.normal[i + channel] / 255) * 2 - 1);
      assert.ok(Math.abs(Math.hypot(...vector) - 1) < 0.01);
    }
  }
  const pristine = generateFinish({ ...finish, wear: 0 });
  for (let i = 2; i < pristine.orm.length; i += 4) assert.equal(pristine.orm[i], 0);
});

test('finish maps pool independently of tint, retain scalar multipliers, and dispose exactly once', () => {
  const doc = fixture();
  doc.materials.other = parse(MaterialSchema, { ...paint, color: '#445544' });
  doc.nodes.push({ ...doc.nodes[0], id: 'other', material: 'other' } as (typeof doc.nodes)[number]);
  const built = compileScene(doc);
  const [first, second] = built.content.children.map(
    (child) => (child as THREE.Mesh).material as THREE.MeshStandardMaterial,
  );
  assert.notEqual(first, second);
  assert.equal(first.map, second.map);
  assert.equal(first.normalMap, second.normalMap);
  assert.equal(first.roughnessMap, second.metalnessMap);
  assert.equal(first.map!.colorSpace, THREE.SRGBColorSpace);
  assert.equal(first.normalMap!.colorSpace, THREE.NoColorSpace);
  assert.equal(first.roughnessMap!.colorSpace, THREE.NoColorSpace);
  assert.equal(first.roughness, 0.9);
  assert.equal(first.metalness, 0.85);
  assert.deepEqual(first.map!.repeat.toArray(), [2, 2]);
  let disposed = 0;
  for (const map of [first.map!, first.normalMap!, first.roughnessMap!])
    map.addEventListener('dispose', () => disposed++);
  first.dispose();
  assert.equal(disposed, 0);
  built.dispose();
  built.dispose();
  assert.equal(disposed, 3);
  const standalone = createMaterial(parse(MaterialSchema, paint)) as THREE.MeshStandardMaterial;
  let standaloneDisposed = 0;
  for (const map of [standalone.map!, standalone.normalMap!, standalone.roughnessMap!])
    map.addEventListener('dispose', () => standaloneDisposed++);
  standalone.dispose();
  standalone.dispose();
  assert.equal(standaloneDisposed, 3);
});

test('finish and legacy surfaces share one bounded pool and a rejected compilation releases every texture', () => {
  const doc = fixture();
  doc.nodes = [];
  doc.materials = {};
  for (let i = 0; i < 257; i++) {
    const id = `coat${i}`;
    doc.materials[id] = parse(
      MaterialSchema,
      i === 0
        ? { color: '#ffffff', surface: { kind: 'cloth', seed: 0, scale: 1, strength: 0.2 } }
        : { ...paint, finish: { ...finish, seed: i } },
    );
    doc.nodes.push({ id, type: 'mesh', geometry: 'body', material: id, visible: true, tags: [] });
  }
  const original = THREE.Texture.prototype.dispose;
  let disposed = 0;
  THREE.Texture.prototype.dispose = function () {
    disposed++;
    return original.call(this);
  };
  try {
    assert.throws(() => compileScene(doc), /256 distinct surface recipes/);
    assert.equal(disposed, 2 + 255 * 3);
  } finally {
    THREE.Texture.prototype.dispose = original;
  }
});

test('Littlewild roundtrip retains editable finish recipes and Three JSON embeds closed typed images', async () => {
  const built = compileScene(fixture());
  try {
    const visual = littlewildModel(built.scene, { rig: false });
    assert.deepEqual(visual.materials.paint.finish, finish);
    const asset = {
      format: 'littlewild-3d-asset',
      schemaVersion: 1,
      id: 'finish',
      name: 'Finish',
      category: 'prop',
      ...visual,
      models: { world: { nodes: visual.nodes } },
    };
    const imported = parse(ModelSchema, Object.values(littlewildModels(asset))[0]);
    assert.deepEqual(Object.values(imported.materials)[0].finish, finish);
  } finally {
    built.dispose();
  }
  const first = await exportScene(fixture(), {}, 'three');
  assert.deepEqual(first.data, (await exportScene(fixture(), {}, 'three')).data);
  const json = JSON.parse(first.data as string);
  assert.equal(json.images.length, 3);
  assert.equal(json.textures.length, 3);
  for (const image of json.images) {
    assert.equal(typeof image.url, 'object');
    assert.equal(image.url.type, 'Uint8Array');
    assert.equal(image.url.width, 128);
    assert.equal(image.url.height, 128);
    assert.equal(image.url.data.length, 65536);
  }
  assert.equal(json.materials[0].roughnessMap, json.materials[0].metalnessMap);
  assert.deepEqual(json.materials[0].userData.finish, finish);
  assert.ok(json.geometries[0].data.attributes.uv);
  assert.ok(json.geometries[0].data.attributes.tangent);
});

test('headless GLB and glTF embed finish PNGs with portable UV transforms and valid PBR channels', async () => {
  for (const format of ['glb', 'gltf'] as const) {
    const output = await exportScene(fixture(), {}, format);
    assert.deepEqual(output.data, (await exportScene(fixture(), {}, format)).data);
    const bytes = Buffer.from(output.data);
    const gltf = JSON.parse(
      format === 'glb'
        ? bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString()
        : bytes.toString(),
    );
    assert.equal(gltf.images.length, 3);
    const material = gltf.materials[0];
    assert.deepEqual(material.extras.finish, finish);
    assert.equal(material.extras.finishAlgorithm, finishAlgorithm);
    assert.deepEqual(
      material.pbrMetallicRoughness.metallicRoughnessTexture.extensions.KHR_texture_transform.scale,
      [2, 2],
    );
    assert.ok(gltf.meshes[0].primitives[0].attributes.TEXCOORD_0 >= 0);
    assert.ok(gltf.meshes[0].primitives[0].attributes.TANGENT >= 0);
    for (const image of gltf.images) {
      assert.equal(image.mimeType, 'image/png');
      if (format === 'gltf') assert.match(image.uri, /^data:image\/png;base64,/);
      else assert.ok(image.bufferView >= 0);
    }
    const report = await validateExport(output.data, format);
    assert.equal(report.numErrors, 0, JSON.stringify(report));
    assert.equal(report.numWarnings, 0, JSON.stringify(report));
  }
});
