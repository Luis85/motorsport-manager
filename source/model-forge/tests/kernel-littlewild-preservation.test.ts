import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import * as THREE from 'three';
import {
  ModelSchema,
  SceneSchema,
  LittlewildAssetSchema,
  parse,
} from '../src/kernel/domain/schema.js';
import { littlewildModels } from '../src/kernel/application/littlewild-import.js';
import { littlewildModel } from '../src/kernel/application/littlewild.js';
import { littlewildVisual, writeLittlewildAsset } from '../src/kernel/io/littlewild.js';
import { compileScene } from '../src/kernel/application/compiler.js';
import { assertLittlewildComplexity } from '../src/kernel/application/littlewild-resources.js';

const mesh = {
  positions: [0.123456789, 0, 0, 1, 0, 0, 0, 1, 0],
  normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
  uvs: [0.0123456789, 0, 1, 0, 0, 1],
  indices: [0, 1, 2],
};
function fixture() {
  const visual = {
    format: 'littlewild-3d-asset',
    schemaVersion: 1,
    category: 'actor',
    id: 'sculpt',
    name: 'Sculpt',
    metadata: {},
    rig: { head: 'head' },
    materials: { fur: { color: '#996633', roughness: 0.9 } },
    meshes: { shared: structuredClone(mesh) },
    models: {
      world: { nodes: [{ id: 'head', primitive: 'mesh', mesh: 'shared', material: 'fur' }] },
      winter: { nodes: [{ id: 'head', primitive: 'mesh', mesh: 'shared', material: 'fur' }] },
    },
  };
  const models = Object.fromEntries(
    Object.entries(littlewildModels(visual)).map(([id, model]) => [id, parse(ModelSchema, model)]),
  );
  const asset = parse(LittlewildAssetSchema, {
    id: 'sculpt',
    family: 'creatures',
    name: 'Sculpt',
    models: { world: { model: 'sculptWorld' } },
  });
  return { visual, models, asset };
}

test('material-only variant maintenance keeps exact source buffers, shared resources and stable repeated output', () => {
  const { visual, models, asset } = fixture(),
    before = structuredClone(visual);
  models.sculptWorld.materials.fur.roughness = 0.84;
  const first = littlewildVisual(asset, models, { visual });
  assert.deepEqual(visual, before, 'merging must not mutate its caller');
  assert.deepEqual(first.visual.meshes, visual.meshes);
  assert.deepEqual(first.visual.rig, visual.rig);
  const variants = first.visual.models as Record<string, { nodes: { mesh: string }[] }>;
  assert.equal(variants.world.nodes[0].mesh, 'shared');
  assert.equal(variants.winter.nodes[0].mesh, 'shared');
  const second = littlewildVisual(asset, models, { visual: first.visual });
  assert.deepEqual(second.visual, first.visual, 're-exporting must not accumulate geometry');
});

test('small authored geometry and UV edits remain distinct from retained variant resources', () => {
  for (const field of ['positions', 'normals', 'uvs', 'indices'] as const) {
    const { visual, models, asset } = fixture();
    const geometry = Object.values(models.sculptWorld.geometries).find(
      (value) => value.type === 'mesh',
    )!;
    assert.equal(geometry.type, 'mesh');
    if (geometry.type !== 'mesh') return;
    if (field === 'indices') geometry.indices = [0, 2, 1];
    else geometry[field]![0][0] = Number(geometry[field]![0][0]) + 0.000001;
    const result = littlewildVisual(asset, models, { visual });
    const meshes = result.visual.meshes as Record<string, typeof mesh>,
      variants = result.visual.models as Record<string, { nodes: { mesh: string }[] }>;
    assert.equal(Object.keys(meshes).length, 2, field);
    assert.equal(variants.winter.nodes[0].mesh, 'shared');
    assert.notEqual(variants.world.nodes[0].mesh, 'shared');
    assert.deepEqual(meshes.shared, mesh);
    const changed = meshes[variants.world.nodes[0].mesh];
    assert.notDeepEqual(changed[field], mesh[field]);
  }
});

test('compiled buffer mutations invalidate precise-source reuse and FNV collisions never alias meshes', () => {
  const make = (z: number) => ({
    type: 'mesh',
    positions: [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, z],
    ],
    normals: [
      [0, 0, 1],
      [0, 0, 1],
      [0, 0, 1],
    ],
    uvs: [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    indices: [0, 1, 2],
  });
  // These two exact JSON buffers intentionally share the legacy FNV32 mesh ID.
  const document = parse(SceneSchema, {
    schemaVersion: 1,
    kind: 'scene',
    id: 'collision',
    name: 'Collision',
    materials: { fur: { color: '#996633' } },
    geometries: { one: make(0.0072006974), two: make(0.0786154716) },
    nodes: [
      { id: 'one', type: 'mesh', geometry: 'one', material: 'fur' },
      { id: 'two', type: 'mesh', geometry: 'two', material: 'fur' },
    ],
  });
  const built = compileScene(document);
  try {
    const result = littlewildModel(built.content, { rig: false });
    assert.equal(Object.keys(result.meshes).length, 2);
    assert.deepEqual(Object.keys(result.meshes), ['m-7ee66ac5', 'm-7ee66ac5-2']);
    const geometry = (built.content.children[0] as THREE.Mesh).geometry;
    geometry.getAttribute('position').setZ(0, 0.5);
    const changed = littlewildModel(built.content, { rig: false });
    assert(Object.values(changed.meshes).some((value) => value.positions[2] === 0.5));
    geometry.getAttribute('position').setZ(0, 0);
    geometry.setAttribute(
      'normal',
      new THREE.Uint8BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3, true),
    );
    const normalized = littlewildModel(built.content, { rig: false });
    assert(Object.values(normalized.meshes).some((value) => value.normals![2] < 0.01));
  } finally {
    built.dispose();
  }
});

test('existing resource IDs with different buffers cannot overwrite retained variants; complexity matches engine', () => {
  const { visual, models, asset } = fixture();
  const initial = littlewildVisual(asset, models),
    generatedId = Object.keys(initial.visual.meshes as object)[0];
  const different = { ...mesh, uvs: [0.7, 0, 1, 0, 0, 1] };
  const existing = {
    ...visual,
    meshes: { [generatedId]: different, unused: mesh },
    models: {
      winter: { nodes: [{ id: 'head', primitive: 'mesh', mesh: generatedId, material: 'fur' }] },
    },
  };
  const merged = littlewildVisual(asset, models, { visual: existing });
  const meshes = merged.visual.meshes as Record<string, typeof mesh>,
    variants = merged.visual.models as Record<string, { nodes: { mesh: string }[] }>;
  assert.deepEqual(meshes[generatedId], different);
  // No source variant referenced `unused`; like an unused palette entry, merging keeps it.
  assert.deepEqual(meshes.unused, mesh);
  assert.notEqual(variants.world.nodes[0].mesh, generatedId);
  assert.equal(variants.winter.nodes[0].mesh, generatedId);
  assertLittlewildComplexity({ values: Array(399998).fill(0) });
  assert.throws(() => assertLittlewildComplexity({ values: Array(399999).fill(0) }), {
    code: 'LITTLEWILD_BUDGET',
  });
});

test('whole-definition complexity rejection leaves the prior definition file unchanged', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'forge-littlewild-budget-'));
  try {
    const { visual, models, asset } = fixture();
    const file = path.join(root, 'creatures/sculpt/definition.json');
    await mkdir(path.dirname(file), { recursive: true });
    const original = JSON.stringify({
      format: 'littlewild-definition',
      schemaVersion: 1,
      family: 'creatures',
      id: 'sculpt',
      visual: { ...visual, metadata: { padding: Array(400000).fill(0) } },
    });
    await writeFile(file, original);
    await assert.rejects(() => writeLittlewildAsset(asset, models, file), {
      code: 'LITTLEWILD_BUDGET',
    });
    assert.equal(await readFile(file, 'utf8'), original);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
