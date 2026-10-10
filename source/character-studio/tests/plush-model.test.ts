import test from 'node:test';
import assert from 'node:assert/strict';
// Frozen output from the shipped compiler at e5da01ac; never regenerate with the current compiler.
// create --id legacy-pip --name Pip --preset pip, then export --format package.
import legacy from './fixtures/compiler-v1.package.json';
import { createCharacter } from '../src/domain/character.js';
import { compilePackage, compileVisual, importCharacter, type Data } from '../src/application/compiler.js';
import { plushMeshes } from '../src/application/plush-meshes.js';
import { validateAsset } from '../src/domain/engine-validation.js';

function nodes(model: Data): Map<string, Data> {
  const found = new Map<string, Data>();
  function walk(items: Data[]) {
    for (const item of items) {
      found.set(item.id, item);
      if (item.children) walk(item.children);
    }
  }
  walk(model.nodes);
  return found;
}

test('plush surfaces are closed outward smooth meshes with bounded nondegenerate triangles', () => {
  const meshes = plushMeshes();
  assert.deepEqual(meshes, plushMeshes());
  let vertices = 0;
  for (const mesh of Object.values(meshes)) {
    vertices += mesh.positions.length / 3;
    assert.equal(mesh.positions.length, mesh.normals.length);
    const edges = new Map<string, number>();
    let volume = 0;
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const ids = mesh.indices.slice(i, i + 3);
      const [a, b, c] = ids.map(id => mesh.positions.slice(id * 3, id * 3 + 3));
      const ab = b.map((v, axis) => v - a[axis]);
      const ac = c.map((v, axis) => v - a[axis]);
      const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
      assert.ok(Math.hypot(...cross) > 1e-7, 'Triangles must have area.');
      volume += a.reduce((sum, v, axis) => sum + v * cross[axis], 0) / 6;
      for (let edge = 0; edge < 3; edge++) {
        const key = [ids[edge], ids[(edge + 1) % 3]].sort((x, y) => x - y).join(':');
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    assert.ok(volume > 0, 'Outward winding is required by Three and the GLB exporter.');
    assert.ok([...edges.values()].every(count => count === 2), 'Surfaces must be closed.');
    for (let i = 0; i < mesh.normals.length; i += 3)
      assert.ok(Math.abs(Math.hypot(...mesh.normals.slice(i, i + 3)) - 1) < 1e-5);
  }
  assert.ok(vertices < 1600, 'Mesh buffers are shared across all body parts and variants.');
});

test('all compiled variants retain rig and sockets, expressive eyes, authored material roles and portable size', () => {
  const character = createCharacter();
  for (const value of [.7, 1.3]) {
    character.appearance.headSize = value;
    character.appearance.eyeSize = value;
    character.appearance.earSize = value;
    const visual = compileVisual(character);
    validateAsset(visual);
    assert.equal(visual.metadata.characterStudio.compilerRevision, 2);
    assert.equal(visual.materials.fur.sheen, .75);
    assert.equal(visual.materials.pupil.clearcoat, 1);
    assert.equal(visual.materials.fur.flatShading, false);
    for (const model of Object.values(visual.models)) {
      const found = nodes(model as Data);
      for (const ids of Object.values(visual.rig))
        for (const id of [ids].flat()) assert.ok(found.has(id as string));
      for (const ids of Object.values(visual.behaviors.sockets))
        for (const id of [ids].flat()) assert.ok(found.has(id as string));
      assert.equal(found.get('head-shell')!.primitive, 'mesh');
      assert.equal(found.get('eye-left-pupil')!.material, 'pupil');
      assert.ok(found.get('eye-left-white')!.scale[0] > .06);
      assert.equal(found.get('mouth-left')!.primitive, 'mesh');
      assert.equal(found.get('brow-left')!.primitive, 'mesh');
      assert.ok(found.has('crown-wisp-3'));
    }
    assert.ok(Buffer.byteLength(JSON.stringify(visual)) < 250000, 'Visual must fit CLI/API JSON intake budgets.');
    assert.deepEqual(importCharacter(visual), character);
  }
});

test('original compiler exports remain losslessly recoverable and edited legacy exports are rejected', () => {
  const recipe = legacy.appearanceManifest.metadata.characterStudio.recipe;
  assert.deepEqual(importCharacter(legacy), recipe);
  assert.deepEqual(importCharacter(legacy.appearanceManifest), recipe);
  const definition = {
    format: 'littlewild-definition', schemaVersion: 1, family: 'creatures',
    id: legacy.gameplayDefinition.id, creature: legacy.gameplayDefinition,
    visual: legacy.appearanceManifest,
  };
  assert.deepEqual(importCharacter(definition), recipe);
  const edited = structuredClone(legacy);
  edited.appearanceManifest.models.world.nodes[0].position![0] = .2;
  assert.throws(() => importCharacter(edited), /edited outside/);
  const gameplay = structuredClone(legacy);
  gameplay.gameplayDefinition.movement.baseSpeed = 2;
  assert.throws(() => importCharacter(gameplay), /advanced gameplay/);
  const upgraded = compilePackage(importCharacter(legacy));
  assert.deepEqual(upgraded.gameplayDefinition, legacy.gameplayDefinition);
  assert.equal(upgraded.appearanceManifest.metadata.characterStudio.compilerRevision, 2);
  assert.notDeepEqual(upgraded.appearanceManifest.models, legacy.appearanceManifest.models);
  const future = structuredClone(upgraded);
  future.appearanceManifest.metadata.characterStudio.compilerRevision = 999;
  assert.throws(() => importCharacter(future), /unsupported.*revision/);
});
