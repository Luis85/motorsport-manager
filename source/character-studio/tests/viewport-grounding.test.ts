import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {groundPreviewFoot} from '../src/ui/viewport-grounding.js';

test('walking preview keeps boot toes above the floor and moves both equipment pivots equally', () => {
  for (const scale of [.9, 1, 1.1]) for (const angle of [-.48, 0, .48]) {
    const body = new THREE.Group(); body.scale.y = scale;
    const foot = new THREE.Group(), socket = new THREE.Group(); body.add(foot, socket);
    foot.position.set(.118, .083, .045); socket.position.copy(foot.position);
    foot.rotation.x = angle; socket.rotation.x = angle;
    const hidden = new THREE.Mesh(new THREE.BoxGeometry(1, 5, 1)); hidden.visible = false; foot.add(hidden);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(.2, .15, .3)); shoe.position.z = .04; socket.add(shoe);
    groundPreviewFoot(foot, socket);
    const bounds = new THREE.Box3().setFromObject(socket);
    assert.ok(bounds.min.y >= -1e-8, `toe clipped below floor at ${angle}`);
    assert.ok(bounds.min.y < .02, 'invisible geometry must not lift a visible shoe');
    assert.deepEqual(foot.position.toArray(), socket.position.toArray());
    hidden.geometry.dispose(); shoe.geometry.dispose();
  }
});
