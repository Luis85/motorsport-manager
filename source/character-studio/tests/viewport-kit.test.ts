import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createRenderKit, createStage} from '../src/ui/viewport-kit.ts';

test('preview renders the engine primitive dimensions and preserves material options', () => {
  const resources = createRenderKit(), root = new THREE.Group();
  const mesh = resources.kit.piece(root, 'soft', 1, 2, 3, .2, .3, .4, '#caa273', .5, {transparent:true,opacity:.4});
  assert.deepEqual(mesh.position.toArray(), [1,2,3]);
  assert.deepEqual(mesh.scale.toArray(), [.2,.3,.4]);
  assert.equal(mesh.rotation.y, .5);
  assert.equal(mesh.material.opacity, .4);
  assert.equal(mesh.material.transparent, true);
  const geometry = mesh.geometry as THREE.SphereGeometry;
  assert.equal(geometry.parameters.widthSegments, 10);
  assert.equal(geometry.parameters.heightSegments, 7);
  resources.dispose(root);
});

test('renderer lifecycle disposes each shared primitive, baked geometry and material once', () => {
  const resources = createRenderKit(), root = new THREE.Group();
  const first = resources.kit.piece(root, 'box', 0, 0, 0, 1, 1, 1, '#ffffff');
  const second = resources.kit.piece(root, 'box', 1, 0, 0, 1, 1, 1, '#ffffff');
  const baked = new THREE.BufferGeometry();
  baked.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0], 3));
  const bakedMaterial = resources.kit.mat('#eeeeee');
  root.add(new THREE.Mesh(baked, bakedMaterial));
  assert.equal(first.geometry, second.geometry);
  let primitiveDisposals = 0, bakedDisposals = 0, materialDisposals = 0;
  first.geometry.addEventListener('dispose', () => primitiveDisposals++);
  baked.addEventListener('dispose', () => bakedDisposals++);
  for (const material of [first.material,second.material,bakedMaterial]) material.addEventListener('dispose', () => materialDisposals++);
  resources.dispose(root);
  assert.equal(primitiveDisposals, 1);
  assert.equal(bakedDisposals, 1);
  assert.equal(materialDisposals, 3);
});

test('world scenery toggles without changing the detached character model', () => {
  const stage = createStage();
  const scenery = stage.root.children.find(node => node instanceof THREE.Group)!;
  assert.equal(scenery.visible, false);
  stage.setWorld(true);
  assert.equal(scenery.visible, true);
  assert.ok(scenery.children.length > 0);
  stage.setWorld(false);
  assert.equal(scenery.visible, false);
  stage.dispose();
});

test('authored cloth and glossy material fields use physical shading without changing base materials', () => {
  const resources = createRenderKit();
  const cloth = resources.kit.mat('#caa273', {sheen:.8,sheenRoughness:.7,sheenColor:'#eed8b4',flatShading:false});
  const eye = resources.kit.mat('#38251f', {clearcoat:1,clearcoatRoughness:.08,roughness:.15});
  const plain = resources.kit.mat('#ffffff');
  assert.ok(cloth instanceof THREE.MeshPhysicalMaterial);
  assert.ok(eye instanceof THREE.MeshPhysicalMaterial);
  assert.equal(cloth.sheen, .8);
  assert.equal(cloth.sheenRoughness, .7);
  assert.equal(cloth.sheenColor.getHexString(), 'eed8b4');
  assert.equal(eye.clearcoat, 1);
  assert.equal(eye.clearcoatRoughness, .08);
  assert.ok(!(plain instanceof THREE.MeshPhysicalMaterial));
  resources.dispose(new THREE.Group());
});

test('garden decoration batches draw calls and retains explicit lighting and resource lifetime', () => {
  const stage = createStage();
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  let meshes = 0;
  stage.root.traverse(node => {
    if (node instanceof THREE.Mesh) {
      meshes++; geometries.add(node.geometry); materials.add(node.material as THREE.Material);
    }
  });
  assert.ok(meshes > 0 && meshes < 35, `Static garden should be batched, saw ${meshes} meshes`);
  const lantern = [...materials].find(value => value instanceof THREE.MeshStandardMaterial && value.emissive.getHex() !== 0) as THREE.MeshStandardMaterial;
  assert.equal(lantern.emissiveIntensity, .65);
  stage.setLight(true); assert.equal(lantern.emissiveIntensity, 2);
  stage.setLight(false); assert.equal(lantern.emissiveIntensity, .65);
  let disposed = 0;
  for (const geometry of geometries) geometry.addEventListener('dispose', () => disposed++);
  stage.dispose();
  assert.equal(disposed, geometries.size);
});
