import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MeshPhysicalMaterial, MeshStandardMaterial } from 'three';
import { MaterialSchema, ModelSchema, SceneSchema, parse } from '../src/kernel/domain/schema.js';
import { createMaterial } from '../src/kernel/application/materials.js';
import { compileScene } from '../src/kernel/application/compiler.js';
import { littlewildModel } from '../src/kernel/application/littlewild.js';
import { littlewildModels } from '../src/kernel/application/littlewild-import.js';
import { exportScene, validateExport } from '../src/kernel/io/export.js';

const coat = {
  color: '#bc8151',
  roughness: 0.88,
  sheen: 0.75,
  sheenColor: '#ffe3bc',
  sheenRoughness: 0.8,
  clearcoat: 0.1,
  clearcoatRoughness: 0.3,
};
const fixture = () =>
  parse(SceneSchema, {
    schemaVersion: 1,
    kind: 'scene',
    id: 'portrait',
    name: 'Portrait',
    materials: { coat },
    geometries: { body: { type: 'sphere', radius: 1 } },
    nodes: [{ type: 'mesh', id: 'body', geometry: 'body', material: 'coat' }],
    environment: { presentation: 'portrait', background: '#eee7d8' },
  });

test('physical materials validate bounded portable values and preserve legacy shading', () => {
  const material = createMaterial(parse(MaterialSchema, coat));
  assert.ok(material instanceof MeshPhysicalMaterial);
  assert.equal(material.sheen, 0.75);
  assert.equal(material.sheenColor.getHexString(), 'ffe3bc');
  assert.equal(material.clearcoat, 0.1);
  material.dispose();
  const legacy = createMaterial(parse(MaterialSchema, { color: '#ffffff' }));
  assert.ok(legacy instanceof MeshStandardMaterial);
  assert.equal(legacy instanceof MeshPhysicalMaterial, false);
  legacy.dispose();
  for (const field of ['sheen', 'sheenRoughness', 'clearcoat', 'clearcoatRoughness'])
    for (const value of [-0.01, 1.01, '0.5', NaN])
      assert.equal(MaterialSchema.safeParse({ ...coat, [field]: value }).success, false);
  assert.equal(MaterialSchema.safeParse({ ...coat, sheenColor: 'white' }).success, false);
  assert.throws(
    () => createMaterial(parse(MaterialSchema, { color: '#000000', depthWrite: false })),
    /opacity below 1/,
  );
});

test('physical materials survive Littlewild export and editable import without losing values', () => {
  const built = compileScene(fixture());
  try {
    const visual = littlewildModel(built.scene, { rig: false });
    const model = Object.values(
      littlewildModels({
        format: 'littlewild-3d-asset',
        schemaVersion: 1,
        id: 'portrait',
        name: 'Portrait',
        category: 'creature',
        materials: visual.materials,
        meshes: visual.meshes,
        models: { default: { nodes: visual.nodes } },
      }),
    )[0];
    const imported = parse(ModelSchema, model);
    const material = Object.values(imported.materials)[0];
    for (const [key, value] of Object.entries(coat))
      assert.equal(material[key as keyof typeof material], value, key);
  } finally {
    built.dispose();
  }
});

test('GLB exports physical material extensions and excludes preview portrait fixtures', async () => {
  const document = fixture();
  const before = JSON.stringify(document);
  const result = await exportScene(document, {}, 'glb');
  assert.equal(JSON.stringify(document), before);
  const bytes = Buffer.from(result.data);
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  assert.ok(json.extensionsUsed.includes('KHR_materials_sheen'));
  assert.ok(json.extensionsUsed.includes('KHR_materials_clearcoat'));
  assert.equal(json.meshes.length, 1);
  assert.equal(json.materials[0].extensions.KHR_materials_clearcoat.clearcoatFactor, 0.1);
  assert.equal((await validateExport(bytes, 'glb')).numErrors, 0);
});

const perNodeAsset = () => ({
  format: 'littlewild-3d-asset',
  schemaVersion: 1,
  id: 'plush',
  name: 'Plush',
  category: 'creature',
  materials: { ink: { color: '#32221a', roughness: 0.6 }, fur: coat },
  models: {
    world: {
      nodes: [
        { primitive: 'soft', id: 'eye', material: 'ink' },
        {
          primitive: 'soft',
          id: 'nose',
          material: 'ink',
          materialProps: { roughness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.2 },
        },
        {
          primitive: 'soft',
          id: 'cheek-left',
          material: 'fur',
          materialProps: { roughness: 1, sheen: 0.5, sheenRoughness: 1 },
        },
        {
          primitive: 'soft',
          id: 'cheek-right',
          material: 'fur',
          materialProps: { sheenRoughness: 1, sheen: 0.5, roughness: 1 },
        },
        { primitive: 'soft', id: 'body', material: 'fur' },
        {
          primitive: 'soft',
          id: 'inner-ear',
          material: 'fur',
          materialProps: { roughness: 0.95, sheen: 0.6, sheenRoughness: 0.9 },
        },
      ],
    },
  },
});

test('node material overrides bake into isolated deduplicated slots and portable GLB surfaces', async () => {
  const asset = perNodeAsset();
  const before = JSON.stringify(asset);
  const model = parse(ModelSchema, Object.values(littlewildModels(asset))[0]);
  const slot = (id: string) => {
    const node = model.nodes.find((node) => node.id === id);
    assert.ok(node?.type === 'mesh');
    return node.material;
  };
  const material = (id: string) => model.materials[slot(id)];
  assert.equal(JSON.stringify(asset), before);
  assert.equal(material('nose').roughness, 0.25);
  assert.equal(material('nose').clearcoat, 0.6);
  assert.equal(material('nose').clearcoatRoughness, 0.2);
  assert.equal(material('eye').roughness, 0.6);
  assert.equal(material('eye').clearcoat, undefined);
  assert.equal(material('cheek-left').sheen, 0.5);
  assert.equal(slot('cheek-left'), slot('cheek-right'));
  assert.equal(material('body').sheen, coat.sheen);
  assert.equal(material('inner-ear').sheen, 0.6);
  const scene = parse(SceneSchema, {
    schemaVersion: 1,
    kind: 'scene',
    id: 'study',
    name: 'Study',
    nodes: [{ id: 'plush', type: 'model', model: model.id }],
  });
  const result = await exportScene(scene, { [model.id]: model }, 'glb');
  const bytes = Buffer.from(result.data);
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  assert.ok(
    json.materials.some(
      (entry: { extensions?: { KHR_materials_clearcoat?: { clearcoatFactor?: number } } }) =>
        entry.extensions?.KHR_materials_clearcoat?.clearcoatFactor === 0.6,
    ),
  );
  assert.equal((await validateExport(bytes, 'glb')).numErrors, 0);
});

test('Littlewild import rejects unsupported transparency or depth semantics instead of losing them', () => {
  for (const props of [
    { depthWrite: false },
    { transparent: true },
    { opacity: 0.5, transparent: false },
    { opacity: 0.5 },
    { emissiveIntensity: 21 },
    { unsupportedFinish: 1 },
  ]) {
    const asset = perNodeAsset();
    Object.assign(asset.models.world.nodes[1], { materialProps: props });
    assert.throws(
      () => littlewildModels(asset),
      (error: unknown) => {
        assert.ok(error instanceof Error && 'code' in error);
        assert.equal(error.code, 'LITTLEWILD_MATERIAL_UNSUPPORTED');
        assert.match(error.message, /nose/);
        return true;
      },
    );
  }
  const asset = perNodeAsset();
  Object.assign(asset.models.world.nodes[1], {
    materialProps: { opacity: 0.5, transparent: true, depthWrite: true },
  });
  const model = parse(ModelSchema, Object.values(littlewildModels(asset))[0]);
  const node = model.nodes.find((node) => node.id === 'nose');
  assert.ok(node?.type === 'mesh');
  const material = createMaterial(model.materials[node.material]);
  assert.equal(material.transparent, true);
  assert.equal(material.opacity, 0.5);
  assert.equal(material.depthWrite, true);
  material.dispose();
});

test('equal named material roles stay distinct for downstream appearance palettes', () => {
  const asset = perNodeAsset();
  Object.assign(asset.materials, { alternateInk: { ...asset.materials.ink } });
  asset.models.world.nodes.push({
    primitive: 'soft',
    id: 'alternate-eye',
    material: 'alternateInk',
  });
  const model = parse(ModelSchema, Object.values(littlewildModels(asset))[0]);
  const eye = model.nodes.find((node) => node.id === 'eye');
  const alternate = model.nodes.find((node) => node.id === 'alternate-eye');
  assert.ok(eye?.type === 'mesh' && alternate?.type === 'mesh');
  assert.notEqual(eye.material, alternate.material);
  assert.deepEqual(model.materials[eye.material], model.materials[alternate.material]);
});

test('native Sproutling shadow imports, renders without depth writes and exports as GLB blend', async () => {
  const definition = JSON.parse(
    readFileSync(
      new URL(
        '../../../docs/concepts/littlewild/assets/creatures/sproutling/definition.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const model = parse(ModelSchema, Object.values(littlewildModels(definition.visual))[0]);
  const shadow = model.nodes.find((node) => node.id === 'shadow');
  assert.ok(shadow?.type === 'mesh');
  assert.equal(model.materials[shadow.material].depthWrite, false);
  const material = createMaterial(model.materials[shadow.material]);
  assert.equal(material.opacity, 0.16);
  assert.equal(material.transparent, true);
  assert.equal(material.depthWrite, false);
  material.dispose();
  const scene = parse(SceneSchema, {
    schemaVersion: 1,
    kind: 'scene',
    id: 'native',
    name: 'Native',
    nodes: [{ id: 'pet', type: 'model', model: model.id }],
  });
  const built = compileScene(scene, { [model.id]: model });
  try {
    const visual = littlewildModel(built.scene, { rig: false });
    assert.ok(
      Object.values(visual.materials).some(
        (material) =>
          material.opacity === 0.16 &&
          material.transparent === true &&
          material.depthWrite === false,
      ),
    );
  } finally {
    built.dispose();
  }
  const output = await exportScene(scene, { [model.id]: model }, 'glb');
  const bytes = Buffer.from(output.data);
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  assert.ok(
    gltf.materials.some(
      (material: { alphaMode?: string; pbrMetallicRoughness?: { baseColorFactor?: number[] } }) =>
        material.alphaMode === 'BLEND' &&
        material.pbrMetallicRoughness?.baseColorFactor?.[3] === 0.16,
    ),
  );
  assert.equal((await validateExport(bytes, 'glb')).numErrors, 0);
});
