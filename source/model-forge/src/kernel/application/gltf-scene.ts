import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { orientLight } from './lights.js';

/** A detached export graph. glTF skin nodes live at scene root: their placement is
 * carried by joint transforms and inverse bind matrices, never a mesh ancestor. */
export function gltfScene(root: THREE.Object3D): THREE.Scene {
  const copy = clone(root);
  const original: THREE.Object3D[] = [],
    cloned: THREE.Object3D[] = [];
  root.traverse((object) => original.push(object));
  copy.traverse((object) => cloned.push(object));
  cloned.forEach((object, i) => {
    object.uuid = original[i].uuid;
  });
  const scene = copy instanceof THREE.Scene ? copy : new THREE.Scene();
  if (scene !== copy) {
    scene.name = root.name;
    scene.add(copy);
  }
  const skins: THREE.SkinnedMesh[] = [];
  scene.traverse((object) => {
    if (object instanceof THREE.SkinnedMesh) skins.push(object);
    if (object instanceof THREE.SpotLight || object instanceof THREE.DirectionalLight)
      orientLight(object);
  });
  for (const skin of skins) {
    for (let parent = skin.parent; parent; parent = parent.parent) skin.visible &&= parent.visible;
    scene.add(skin);
    skin.position.set(0, 0, 0);
    skin.quaternion.identity();
    skin.scale.set(1, 1, 1);
  }
  scene.updateMatrixWorld(true);
  return scene;
}
