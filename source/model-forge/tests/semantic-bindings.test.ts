import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Group, Mesh, ObjectLoader } from 'three';
import { semanticBindings } from '../src/kernel/index.js';

test('articulation, sockets and hidden semantic bounds survive the Three handoff', () => {
  const root = new Group();
  root.name = 'vehicle';
  const turret = new Group();
  turret.name = 'vehicle/turret';
  turret.position.set(0, 2, 0);
  turret.rotation.y = Math.PI / 2;
  turret.userData.tags = ['articulation:turret'];
  root.add(turret);
  const muzzle = new Group();
  muzzle.name = 'vehicle/muzzle';
  muzzle.position.z = 3;
  muzzle.userData.tags = ['socket:muzzle'];
  turret.add(muzzle);
  const volume = new Mesh(new BoxGeometry(2, 1, 4));
  volume.name = 'vehicle/engine';
  volume.visible = false;
  volume.userData.tags = ['volume:engine'];
  root.add(volume);
  root.updateMatrixWorld(true);
  const result = semanticBindings(new ObjectLoader().parse(root.toJSON()), ['socket:muzzle']);
  const socket = result.bindings.find((value) => value.role === 'muzzle')!;
  assert.equal(socket.parent, 'vehicle/turret');
  assert.ok(Math.abs(socket.worldMatrix[12] - 3) < 1e-8);
  assert.equal(socket.worldMatrix[13], 2);
  assert.deepEqual(result.bindings.find((value) => value.role === 'engine')!.bounds, {
    min: [-1, -0.5, -2],
    max: [1, 0.5, 2],
  });
  volume.geometry.dispose();
});

test('semantic handoff rejects absent, repeated and empty volume roles', () => {
  const root = new Group();
  root.name = 'root';
  assert.throws(() => semanticBindings(root, ['socket:muzzle']), /Missing required/);
  root.userData.tags = ['socket:muzzle', 'socket:muzzle'];
  assert.throws(() => semanticBindings(root), /Duplicate semantic/);
  root.userData.tags = ['volume:engine'];
  assert.throws(() => semanticBindings(root), /nonempty finite geometry/);
  root.userData.tags = ['socket:'];
  assert.throws(() => semanticBindings(root), /Invalid semantic/);
});

test('different semantic objects require distinct paths and finite matrices', () => {
  const root = new Group();
  const a = new Group();
  const b = new Group();
  a.name = b.name = 'same';
  a.userData.tags = ['socket:a'];
  b.userData.tags = ['socket:b'];
  root.add(a, b);
  assert.throws(() => semanticBindings(root), /Duplicate semantic path/);
  b.name = 'other';
  b.position.x = Infinity;
  assert.throws(() => semanticBindings(root), /Non-finite semantic transform/);
});

test('untagged nodes cannot shadow the stable path of a semantic attachment', () => {
  const root = new Group();
  const untagged = new Group();
  const tagged = new Group();
  untagged.name = tagged.name = 'muzzle';
  tagged.userData.tags = ['socket:muzzle'];
  root.add(untagged, tagged);
  assert.throws(() => semanticBindings(root), /Duplicate semantic path/);
});
