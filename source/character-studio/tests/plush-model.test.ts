import test from 'node:test';
import assert from 'node:assert/strict';
// Frozen output from the shipped compiler at e5da01ac; never regenerate with the current compiler.
// create --id legacy-pip --name Pip --preset pip, then export --format package.
import legacy from './fixtures/compiler-v1.package.json';
// Frozen from the shipped revision 2 compiler before this fidelity correction.
import legacyV2 from './fixtures/compiler-v2.package.json';
import legacyV3 from './fixtures/compiler-v3.package.json';
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
  const meshes = compileVisual(createCharacter()).meshes;
  assert.deepEqual(meshes, compileVisual(createCharacter()).meshes);
  // Coat colors partition one head surface; verify their welded union is closed.
  const head = {positions: [] as number[], normals: [] as number[], indices: [] as number[], uvs: [] as number[]};
  for (const id of Object.keys(meshes)) {
    if (id !== 'studio4-head' && id !== 'studio4-face-coat' && !id.startsWith('studio4-blush-')) continue;
    const part = meshes[id], offset = head.positions.length / 3;
    head.positions.push(...part.positions); head.normals.push(...part.normals); head.uvs.push(...part.uvs);
    head.indices.push(...part.indices.map((index: number) => index + offset));
    delete meshes[id];
  }
  meshes['painted-head-union'] = head;
  let vertices = 0;
  for (const [meshId, mesh] of Object.entries(meshes) as [string, ReturnType<typeof plushMeshes>[string]][]) {
    vertices += mesh.positions.length / 3;
    assert.equal(mesh.positions.length, mesh.normals.length);
    const uvs = (mesh as typeof mesh & {uvs: number[]}).uvs;
    assert.equal(uvs.length, mesh.positions.length / 3 * 2);
    assert.ok(uvs.every(value => Number.isFinite(value) && value >= -.5 && value <= 1.5));
    const edges = new Map<string, number>();
    let volume = 0;
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const ids = mesh.indices.slice(i, i + 3);
      const us = ids.map(id => uvs[id * 2]);
      assert.ok(Math.max(...us) - Math.min(...us) <= .5, 'No triangle stretches across the UV seam.');
      const [a, b, c] = ids.map(id => mesh.positions.slice(id * 3, id * 3 + 3));
      const ab = b.map((v, axis) => v - a[axis]);
      const ac = c.map((v, axis) => v - a[axis]);
      const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
      // Paint boundaries can cut micron-scale corners from an otherwise full
      // triangle. Keep the unit-mesh bound and a squared-meter bound for these cuts.
      const minimumArea = meshId === 'painted-head-union' ? 1e-12 : 1e-7;
      assert.ok(Math.hypot(...cross) > minimumArea, 'Triangles must have area.');
      volume += a.reduce((sum, v, axis) => sum + v * cross[axis], 0) / 6;
      for (let edge = 0; edge < 3; edge++) {
        // UV seams duplicate vertices, so close the physical surface by position.
        const key = [ids[edge], ids[(edge + 1) % 3]]
          .map(id => mesh.positions.slice(id * 3, id * 3 + 3).join(','))
          .sort().join(':');
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    assert.ok(volume > 0, 'Outward winding is required by Three and the GLB exporter.');
    assert.ok([...edges.values()].every(count => count === 2), 'Surfaces must be closed.');
    for (let i = 0; i < mesh.normals.length; i += 3)
      assert.ok(Math.abs(Math.hypot(...mesh.normals.slice(i, i + 3)) - 1) < 1e-5);
  }
  assert.ok(vertices < 20000, 'Mesh buffers are shared across all body parts and variants.');
});

test('all compiled variants retain rig and sockets, expressive eyes, authored material roles and portable size', () => {
  const character = createCharacter();
  for (const value of [.7, 1.3]) {
    character.appearance.headSize = value;
    character.appearance.eyeSize = value;
    character.appearance.earSize = value;
    const visual = compileVisual(character);
    validateAsset(visual);
    assert.equal(visual.metadata.characterStudio.compilerRevision, 4);
    assert.equal(visual.materials.fur.sheen, .8);
    assert.equal(visual.materials.pupil.clearcoat, .8);
    assert.equal(visual.materials.eyeWhite.color, '#fff1d8');
    assert.equal(visual.materials.fur.flatShading, false);
    assert.deepEqual(visual.materials.fur.surface, {kind: 'fur', version: 2, seed: 17, scale: 5, strength: .55});
    for (const model of Object.values(visual.models)) {
      const found = nodes(model as Data);
      for (const ids of Object.values(visual.rig))
        for (const id of [ids].flat()) assert.ok(found.has(id as string));
      for (const ids of Object.values(visual.behaviors.sockets))
        for (const id of [ids].flat()) assert.ok(found.has(id as string));
      assert.equal(found.get('head-shell')!.primitive, 'mesh');
      assert.equal(found.get('eye-left-pupil')!.material, 'pupil');
      const sclera = found.get('eye-left-white')!;
      const iris = found.get('eye-left-pupil')!;
      const pupil = found.get('eye-left-depth')!;
      assert.ok(sclera.scale[0] > iris.scale[0] && sclera.scale[0] < iris.scale[0] * 1.25, 'Cream corners remain narrow instead of a complete white ring.');
      assert.ok(iris.scale[0] > pupil.scale[0] * 1.3, 'Warm iris remains visible around the pupil.');
      assert.ok(sclera.scale[2] < sclera.scale[0] / 2, 'Eye is a shallow dome within the carved socket.');
      assert.ok(found.get('eye-left-glint')!.scale[0] < pupil.scale[0] / 2);
      assert.ok(!found.has('eye-left-spark'), 'One coherent catchlight only.');
      assert.equal(found.get('muzzle-left')!.mesh, 'studio4-face-coat');
      assert.ok(found.has('eye-left-upper-lid'));
      assert.ok(found.has('foot-left-shin'));
      assert.deepEqual(found.get('foot-left')!.position, found.get('foot-left-socket')!.position);
      assert.ok(found.has('head-fibres'));
      assert.ok(found.has('body-fibres'));
      assert.equal(found.get('mouth-left')!.primitive, 'mesh');
      assert.equal(found.get('brow-left')!.primitive, 'mesh');
      assert.ok(found.has('crown-wisp-3'));
      if (found.get('ear-left-outer')!.mesh === 'studio-ear-cup') {
        const outer = found.get('ear-left-outer')!, inner = found.get('ear-left-inner')!;
        const innerFront = inner.position[2] + inner.scale[2];
        const cavityFloor = outer.scale[2] * .35;
        assert.ok(innerFront > cavityFloor, 'Pink ear patch must be visible over the cupped floor.');
        assert.ok(innerFront < outer.scale[2] * .75, 'Pink ear patch remains inside the rim.');
      }
    }
    assert.ok(Buffer.byteLength(JSON.stringify(visual)) < 1800000, 'Visual and explicit UV buffers must fit CLI/API JSON intake budgets.');
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
  assert.equal(upgraded.appearanceManifest.metadata.characterStudio.compilerRevision, 4);
  assert.notDeepEqual(upgraded.appearanceManifest.models, legacy.appearanceManifest.models);
  const future = structuredClone(upgraded);
  future.appearanceManifest.metadata.characterStudio.compilerRevision = 999;
  assert.throws(() => importCharacter(future), /unsupported.*revision/);
});

 test('revision 2 exports recover their recipe without silently accepting edits', () => {
  const recipe = legacyV2.appearanceManifest.metadata.characterStudio.recipe;
  assert.deepEqual(importCharacter(legacyV2), recipe);
  assert.deepEqual(importCharacter(legacyV2.appearanceManifest), recipe);
  const changed = structuredClone(legacyV2);
  changed.appearanceManifest.materials.fur.color = '#ff0000';
  assert.throws(() => importCharacter(changed), /edited outside/);
  const upgraded = compilePackage(importCharacter(legacyV2));
  assert.deepEqual(upgraded.gameplayDefinition, legacyV2.gameplayDefinition);
  assert.equal(upgraded.appearanceManifest.metadata.characterStudio.compilerRevision, 4);
});

test('refined clothes keep portable surface roles and open-front socket geometry', () => {
  const character = createCharacter();
  character.outfits.head = 'trail_cap';
  character.outfits.body = 'woodland_vest';
  character.outfits.feet = 'walking_boots';
  character.outfits.back = 'field_satchel';
  const visual = compileVisual(character);
  for (const role of ['head', 'body']) assert.equal(visual.materials[`outfit-${role}-primary`].surface.kind, 'cloth');
  for (const role of ['feet', 'back']) assert.equal(visual.materials[`outfit-${role}-primary`].surface.kind, 'leather');
  for (const model of Object.values(visual.models)) {
    const found = nodes(model as Data);
    assert.equal(found.get('outfit-head-headgear-socket-brim')!.primitive, 'mesh');
    assert.equal(found.get('outfit-head-headgear-socket-crown')!.mesh, 'outfit-cap-crown');
    assert.ok(found.has('outfit-head-headgear-socket-leaf-left'));
    const cap = found.get('outfit-head-headgear-socket-crown')!;
    const socket = found.get('headgear-socket')!;
    const capYs = visual.meshes[cap.mesh].positions.filter((_: number, index: number) => index % 3 === 1);
    const headYs = visual.meshes['studio4-head'].positions.filter((_: number, index: number) => index % 3 === 1);
    const capBottom = socket.position[1] + cap.position[1] + Math.min(...capYs) * cap.scale[1];
    assert.ok(capBottom <= Math.max(...headYs) - .04, 'Headwear must seat over the forehead instead of touching only its apex.');
    assert.ok(found.has('outfit-body-body-gear-socket-vest-left'));
    assert.ok(found.has('outfit-body-body-gear-socket-vest-right'));
    assert.ok(!found.has('outfit-body-body-gear-socket-vest'), 'Open-front vest must not cover the whole bib.');
  }
  assert.deepEqual(importCharacter(compilePackage(character)), character);
  for (const footwear of ['walking_boots', 'swift_shoes']) {
    character.outfits.feet = footwear;
    const dressed = compileVisual(character);
    for (const model of Object.values(dressed.models)) {
      const found = nodes(model as Data);
      for (const side of ['left', 'right']) {
        const prefix = `outfit-feet-foot-${side}-socket-`;
        const boot = found.get(prefix + 'boot')!, sole = found.get(prefix + 'sole')!;
        const boundsY = (node: Data) => {
          const mesh = dressed.meshes[node.mesh];
          const ys = mesh.positions.filter((_: number, index: number) => index % 3 === 1)
            .map((y: number) => node.position[1] + node.scale[1] * y);
          return [Math.min(...ys), Math.max(...ys)];
        };
        const [bootBottom] = boundsY(boot), [soleBottom, soleTop] = boundsY(sole);
        assert.ok(soleBottom < bootBottom, `${footwear}: leather must not protrude below its sole.`);
        assert.ok(soleTop > bootBottom, `${footwear}: sole must meet the leather without a gap.`);
        assert.ok(soleTop < boot.position[1] - boot.scale[1] / 2,
          `${footwear}: sole must stay at the foot base instead of bisecting the upper.`);
      }
    }
  }
});

test('revision 3 sculpt and dressed exports recover exactly while revision 4 preserves gameplay', () => {
  const recipe = legacyV3.appearanceManifest.metadata.characterStudio.recipe;
  assert.deepEqual(importCharacter(legacyV3), recipe);
  assert.deepEqual(importCharacter(legacyV3.appearanceManifest), recipe);
  const definition = {format: 'littlewild-definition', schemaVersion: 1, family: 'creatures',
    id: legacyV3.gameplayDefinition.id, creature: legacyV3.gameplayDefinition, visual: legacyV3.appearanceManifest};
  assert.deepEqual(importCharacter(definition), recipe);
  const edited = structuredClone(legacyV3);
  edited.appearanceManifest.materials.fur.color = '#ff0000';
  assert.throws(() => importCharacter(edited), /edited outside/);
  const upgraded = compilePackage(importCharacter(legacyV3));
  assert.deepEqual(upgraded.gameplayDefinition, legacyV3.gameplayDefinition);
  assert.equal(upgraded.appearanceManifest.metadata.characterStudio.compilerRevision, 4);
});

test('cached revision 4 geometry remains detached from every editable compiled asset', () => {
  const character = createCharacter();
  const expected = compileVisual(character);
  const changed = compileVisual(character);
  changed.meshes['studio4-head'].positions[0] += 100;
  changed.meshes['studio4-head-fibres'].normals[0] = 0;
  changed.materials.fur.color = '#ff0000';
  assert.deepEqual(compileVisual(character), expected);
});
