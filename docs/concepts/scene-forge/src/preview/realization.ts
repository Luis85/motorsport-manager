import * as THREE from 'three';
import type { SceneDocument, RigSpec } from '../domain/schema.js';
import { createMaterial } from '../application/materials.js';
import { orientLight } from '../application/lights.js';
import { bindRig } from '../application/rigging.js';

/** Owns transient resources. Geometry prototypes and authored data remain immutable. */
export function createRealization(source: SceneDocument) {
  let materials: THREE.Material[] = [],
    rigs: ReturnType<typeof bindRig>[] = [];
  let mixer: THREE.AnimationMixer | undefined;
  const dispose = () => {
    mixer?.stopAllAction();
    mixer = undefined;
    materials.forEach((m) => m.dispose());
    rigs.forEach((r) => r.dispose());
    materials = [];
    rigs = [];
  };
  function apply(content: THREE.Object3D) {
    dispose();
    const map = new Map(
      Object.entries(source.materials).map(([id, spec]) => [id, createMaterial(spec)]),
    );
    materials = [...map.values()];
    let lights = 0,
      shadows = 0;
    const pending: THREE.Object3D[] = [];
    content.traverse((object) => {
      if (object instanceof THREE.Light) {
        if (++lights > 32 || (object.castShadow && ++shadows > 4))
          throw new Error('Use at most 32 lights and 4 shadow-casting lights.');
        if (object instanceof THREE.DirectionalLight || object instanceof THREE.SpotLight)
          orientLight(object);
      }
      if (object.userData.rig) pending.push(object);
      if (!(object instanceof THREE.Mesh)) return;
      const slots: string[] = object.userData.materialSlots ?? [];
      let id = slots
        .find(
          (slot) =>
            slot.startsWith(source.id + '/') && !slot.slice(source.id.length + 1).includes('/'),
        )
        ?.split('/')
        .at(-1);
      for (const node of source.nodes) {
        if (node.type === 'mesh' && object.name === `${source.id}/${node.id}`) id = node.material;
        if (node.type === 'model' && object.name.startsWith(`${source.id}/${node.id}/`))
          for (const [slot, material] of Object.entries(node.materialOverrides))
            if (slots.includes(`${source.id}/${node.id}/${slot}`)) id = material;
      }
      if (id && map.has(id)) object.material = map.get(id)!;
    });
    if (pending.length > 32) throw new Error('A scene supports at most 32 rig instances.');
    // Child rigs bind before ancestors so overlapping rigs fail explicitly.
    for (const object of pending.reverse())
      rigs.push(bindRig(object, object.userData.rig as RigSpec));
  }
  function animate(content: THREE.Object3D, id: string, clipId: string, time: number) {
    const object = content.getObjectByName(`${source.id}/${id}`);
    const clip = object?.animations.find((clip) => clip.name === `${object.name}/${clipId}`);
    if (!object || !clip) return;
    mixer?.stopAllAction();
    mixer = new THREE.AnimationMixer(object);
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    mixer.setTime(Math.max(0, Math.min(time, clip.duration)));
    object.updateWorldMatrix(true, true);
    object.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh) {
        child.skeleton.update();
        child.computeBoundingBox();
        child.computeBoundingSphere();
      }
    });
  }
  return { apply, animate, dispose };
}
