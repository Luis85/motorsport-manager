import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import {
  SceneSchema,
  ModelSchema,
  MaterialSchema,
  OperationSchema,
  parse,
  type SurfaceSpec,
} from '../src/domain/schema.js';
import { compileScene } from '../src/application/compiler.js';
import {
  generateSurface,
  sphereUVs,
  surfaceAlgorithm,
  resolveSurfaceAlgorithm,
} from '../src/application/surface-pattern.js';
import { littlewildModel } from '../src/application/littlewild.js';
import { littlewildModels } from '../src/application/littlewild-import.js';
import { createMaterial } from '../src/application/materials.js';
import { exportScene, validateExport } from '../src/infra/export.js';
import { initProject, loadProject, commitOperations } from '../src/infra/project.js';

const surface: SurfaceSpec = { kind: 'fur', seed: 7, scale: 3, strength: 0.4 };
const body = {
  type: 'organic',
  size: [0.9, 1.1, 0.72],
  roundness: 0.9,
  taper: 0.22,
  bend: 0.12,
  segments: 32,
};
const coat = { color: '#c89059', roughness: 0.9, sheen: 0.65, surface };
const fixture = () =>
  parse(SceneSchema, {
    schemaVersion: 1,
    kind: 'scene',
    id: 'plush',
    name: 'Plush form',
    geometries: { body },
    materials: { coat },
    nodes: [{ id: 'body', type: 'mesh', geometry: 'body', material: 'coat' }],
  });
const compiledMesh = (built: ReturnType<typeof compileScene>) =>
  built.content.children[0] as THREE.Mesh;

test('organic forms compile closed nondegenerate outward-facing surfaces with smooth UV seams', () => {
  const built = compileScene(fixture()),
    repeated = compileScene(fixture());
  try {
    assert.deepEqual(built.scene.toJSON(), repeated.scene.toJSON());
    const mesh = compiledMesh(built),
      geometry = mesh.geometry;
    const position = geometry.getAttribute('position'),
      normal = geometry.getAttribute('normal'),
      uv = geometry.getAttribute('uv');
    assert.equal(position.count, 561);
    assert.equal(uv.count, position.count);
    assert.ok(position.count <= 8192);
    for (let i = 0; i < position.count; i++) {
      assert.ok(Math.abs(new THREE.Vector3().fromBufferAttribute(normal, i).length() - 1) < 1e-6);
      assert.ok(uv.getX(i) >= 0 && uv.getX(i) <= 1);
      assert.ok(uv.getY(i) >= 0 && uv.getY(i) <= 1);
    }
    for (let row = 0; row <= 16; row++) {
      const a = row * 33,
        b = a + 32;
      assert.ok(
        new THREE.Vector3()
          .fromBufferAttribute(position, a)
          .distanceTo(new THREE.Vector3().fromBufferAttribute(position, b)) < 1e-5,
      );
      assert.ok(
        new THREE.Vector3()
          .fromBufferAttribute(normal, a)
          .distanceTo(new THREE.Vector3().fromBufferAttribute(normal, b)) < 1e-5,
      );
    }
    const index = geometry.index!;
    let signedVolume = 0;
    for (let i = 0; i < index.count; i += 3) {
      const [a, b, c] = [0, 1, 2].map((offset) =>
        new THREE.Vector3().fromBufferAttribute(position, index.getX(i + offset)),
      );
      assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() > 1e-14);
      signedVolume += a.dot(b.clone().cross(c)) / 6;
    }
    assert.ok(signedVolume > 0.1);
  } finally {
    built.dispose();
    repeated.dispose();
  }
});

test('surface pixels and legacy UV projection stay byte-identical with the engine contract', async () => {
  const code = await readFile(
    new URL('../../wildlands/source/asset-surface.ts', import.meta.url),
    'utf8',
  );
  const context = { module: { exports: {} } };
  vm.runInNewContext(
    ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
    context,
  );
  const engine = context.module.exports as {
    generate: typeof generateSurface;
    sphereUVs: typeof sphereUVs;
    algorithmVersion: string;
    algorithm: typeof resolveSurfaceAlgorithm;
  };
  assert.equal(engine.algorithmVersion, surfaceAlgorithm);
  for (const version of [undefined, 1, 2] as const)
    for (const kind of ['fur', 'cloth', 'leather'] as const)
      for (const seed of [0, 7, 65535])
        for (const strength of [0, 0.4, 1]) {
          const recipe = {
            kind,
            seed,
            strength,
            scale: seed === 7 ? 16 : 1,
            ...(version ? { version } : {}),
          };
          assert.equal(resolveSurfaceAlgorithm(recipe), engine.algorithm(recipe));
          const actual = generateSurface(recipe),
            expected = engine.generate(recipe);
          assert.deepEqual(Buffer.from(actual.color), Buffer.from(expected.color));
          assert.deepEqual(Buffer.from(actual.normal), Buffer.from(expected.normal));
        }
  const positions = [0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, -1, 0, -1, 0];
  assert.deepEqual(sphereUVs(positions), Array.from(engine.sphereUVs(positions)));
  assert.notDeepEqual(
    generateSurface(surface).normal,
    generateSurface({ ...surface, seed: 8 }).normal,
  );
});

test('surface schema rejects unsupported or unbounded data and textures dispose once with their owner', () => {
  for (const change of [
    { version: 0 },
    { version: 3 },
    { version: 1.5 },
    { seed: -1 },
    { seed: 0.5 },
    { seed: 65536 },
    { scale: 0 },
    { scale: 17 },
    { strength: 1.01 },
    { kind: 'shader' },
    { url: 'https://example.org' },
  ])
    assert.equal(
      MaterialSchema.safeParse({ ...coat, surface: { ...surface, ...change } }).success,
      false,
    );
  const incomplete = { kind: 'fur', seed: 7, scale: 3 };
  assert.equal(MaterialSchema.safeParse({ ...coat, surface: incomplete }).success, false);
  assert.throws(
    () => createMaterial(parse(MaterialSchema, { ...coat, shading: 'unlit' })),
    /standard PBR/,
  );
  const material = createMaterial(parse(MaterialSchema, coat)) as THREE.MeshStandardMaterial;
  let disposed = 0;
  material.map!.addEventListener('dispose', () => disposed++);
  material.normalMap!.addEventListener('dispose', () => disposed++);
  assert.equal(material.map!.repeat.x, 3);
  assert.equal(material.normalMap!.repeat.y, 3);
  material.dispose();
  material.dispose();
  assert.equal(disposed, 2);
});

test('organic and surface authoring is atomic, guarded, idempotent and dry-run reviewable', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'forge-plush-'));
  try {
    await initProject(root);
    const before = await loadProject(root);
    const operations = [
      { op: 'putGeometry', id: 'body', geometry: body },
      { op: 'putMaterial', id: 'coat', material: coat },
      { op: 'putNode', node: { id: 'body', type: 'mesh', geometry: 'body', material: 'coat' } },
    ].map((operation) => parse(OperationSchema, operation));
    const guard = { expectedRevision: before.scene.revision, expectedState: before.stateHash };
    const preview = await commitOperations(root, undefined, operations, { ...guard, dryRun: true });
    assert.equal((await loadProject(root)).stateHash, before.stateHash);
    const result = await commitOperations(root, undefined, operations, guard);
    assert.equal(result.stateHash, preview.proposedStateHash);
    await assert.rejects(() => commitOperations(root, undefined, operations, guard), {
      code: 'REVISION_CONFLICT',
    });
    const current = await loadProject(root);
    const repeated = await commitOperations(root, undefined, operations, {
      expectedState: current.stateHash,
    });
    assert.equal(repeated.changed, false);
    await assert.rejects(
      () =>
        commitOperations(root, undefined, [
          parse(OperationSchema, {
            op: 'putGeometry',
            id: 'body',
            geometry: { ...body, taper: 2 },
          }),
        ]),
      { code: 'INVALID_GEOMETRY' },
    );
    assert.equal((await loadProject(root)).stateHash, current.stateHash);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Littlewild roundtrip retains organic silhouette, UVs and role-scoped surface overrides', () => {
  const built = compileScene(fixture());
  try {
    const visual = littlewildModel(built.scene, { rig: false });
    const asset = {
      format: 'littlewild-3d-asset',
      schemaVersion: 1,
      id: 'plush',
      name: 'Plush',
      category: 'creature',
      ...visual,
      models: { world: { nodes: visual.nodes } },
    };
    const imported = parse(ModelSchema, Object.values(littlewildModels(asset))[0]);
    assert.deepEqual(Object.values(imported.materials)[0].surface, surface);
    const original = Object.values(visual.meshes)[0];
    const geometry = Object.values(imported.geometries)[0];
    assert.equal(geometry.type, 'mesh');
    if (geometry.type !== 'mesh') return;
    assert.deepEqual(geometry.uvs!.flat(), original.uvs);
    assert.deepEqual(geometry.positions.flat(), original.positions);
    assert.throws(
      () =>
        littlewildModels({
          ...asset,
          meshes: {
            ...visual.meshes,
            [Object.keys(visual.meshes)[0]]: { ...original, uvs: [0, 0] },
          },
        }),
      /UV pair/,
    );
  } finally {
    built.dispose();
  }
});

test('headless GLB and glTF embed deterministic surface PNGs, UVs, repeats and editable metadata', async () => {
  for (const format of ['glb', 'gltf'] as const) {
    const output = await exportScene(fixture(), {}, format),
      repeated = await exportScene(fixture(), {}, format);
    assert.deepEqual(output.data, repeated.data);
    const bytes = Buffer.from(output.data);
    const gltf = JSON.parse(
      format === 'glb'
        ? bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString()
        : bytes.toString(),
    );
    assert.equal(gltf.images.length, 2);
    assert.equal(gltf.images[0].mimeType, 'image/png');
    assert.ok(gltf.meshes[0].primitives[0].attributes.TEXCOORD_0 >= 0);
    assert.deepEqual(gltf.materials[0].extras.surface, surface);
    assert.equal(gltf.materials[0].extras.surfaceAlgorithm, surfaceAlgorithm);
    assert.deepEqual(
      gltf.materials[0].normalTexture.extensions.KHR_texture_transform.scale,
      [3, 3],
    );
    if (format === 'gltf') assert.match(gltf.images[0].uri, /^data:image\/png;base64,/);
    else assert.ok(gltf.images[0].bufferView >= 0);
    const report = await validateExport(output.data, format);
    assert.equal(report.numErrors, 0, JSON.stringify(report));
    assert.equal(report.numWarnings, 0, JSON.stringify(report));
  }
});

test('surface maps pool across colors and preserve distinct authored roles through Littlewild export', () => {
  const doc = fixture();
  doc.materials.other = parse(MaterialSchema, { ...coat, color: '#667755' });
  doc.materials.same = parse(MaterialSchema, coat);
  doc.nodes.push(
    { ...doc.nodes[0], id: 'other', material: 'other' } as (typeof doc.nodes)[0],
    { ...doc.nodes[0], id: 'same', material: 'same' } as (typeof doc.nodes)[0],
  );
  const built = compileScene(doc);
  const materials = built.content.children.map(
    (child) => (child as THREE.Mesh).material as THREE.MeshStandardMaterial,
  );
  assert.notEqual(materials[0], materials[1]);
  assert.equal(materials[0], materials[2]);
  assert.equal(materials[0].map, materials[1].map);
  assert.equal(materials[0].normalMap, materials[1].normalMap);
  let disposed = 0;
  materials[0].map!.addEventListener('dispose', () => disposed++);
  materials[0].normalMap!.addEventListener('dispose', () => disposed++);
  try {
    materials[1].dispose();
    assert.equal(disposed, 0, 'Compilation retains shared maps until its own disposal.');
    const visual = littlewildModel(built.scene, { rig: false });
    assert.deepEqual(Object.keys(visual.materials).sort(), ['coat', 'other', 'same']);
    assert.deepEqual(visual.materials.coat.surface, surface);
    assert.deepEqual(visual.materials.same.surface, surface);
  } finally {
    built.dispose();
    built.dispose();
  }
  assert.equal(disposed, 2);
});

test('unique surface budget fails atomically and releases all maps allocated by the failed compilation', () => {
  const doc = fixture();
  doc.nodes = [];
  for (let i = 0; i < 257; i++) {
    const id = `coat${i}`;
    doc.materials[id] = parse(MaterialSchema, { ...coat, surface: { ...surface, seed: i } });
    doc.nodes.push({ id, type: 'mesh', geometry: 'body', material: id, visible: true, tags: [] });
  }
  const original = THREE.Texture.prototype.dispose;
  let disposed = 0;
  THREE.Texture.prototype.dispose = function () {
    disposed++;
    return original.call(this);
  };
  try {
    assert.throws(
      () => compileScene(doc),
      (error: unknown) => {
        assert.ok(error instanceof Error && 'code' in error);
        assert.equal(error.code, 'SCENE_BUDGET');
        assert.match(error.message, /256 distinct surface recipes/);
        return true;
      },
    );
    assert.equal(disposed, 512);
  } finally {
    THREE.Texture.prototype.dispose = original;
  }
});

test('custom cube and edited native mesh UVs remain baked through Littlewild export', () => {
  for (const geometryId of ['cube', 'lw-soft']) {
    const original =
      geometryId === 'cube' ? new THREE.BoxGeometry(1, 1, 1) : new THREE.SphereGeometry(1, 10, 7);
    const position = original.getAttribute('position'),
      uv = original.getAttribute('uv'),
      normal = original.getAttribute('normal');
    const document = fixture();
    document.geometries = {
      [geometryId]: {
        type: 'mesh',
        positions: Array.from({ length: position.count }, (_, i) => [
          position.getX(i),
          position.getY(i),
          position.getZ(i),
        ]),
        normals: Array.from({ length: position.count }, (_, i) => [
          normal.getX(i),
          normal.getY(i),
          normal.getZ(i),
        ]),
        uvs: Array.from({ length: uv.count }, (_, i) => [uv.getY(i) + 0.25, uv.getX(i)]),
        indices: Array.from(original.index!.array),
      },
    };
    original.dispose();
    document.nodes = [
      {
        id: 'shape',
        type: 'mesh',
        material: 'coat',
        geometry: geometryId,
        visible: true,
        tags: [],
      },
    ];
    const built = compileScene(document);
    try {
      const visual = littlewildModel(built.scene, { rig: false });
      assert.equal(visual.nodes[0].children![0].primitive, 'mesh');
      const exported = Object.values(visual.meshes)[0];
      assert.ok(exported.uvs);
      assert.deepEqual(
        exported.uvs,
        // Authored UV decimals are now preserved exactly, rather than rounded again during export.
        (document.geometries[geometryId] as { uvs: number[][] }).uvs.flat(),
      );
    } finally {
      built.dispose();
    }
  }
});
