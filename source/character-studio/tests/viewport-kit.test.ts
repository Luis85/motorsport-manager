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
