import * as THREE from 'three';
import type { RigSpec } from '../domain/schema.js';
import { validateRig } from '../domain/rig.js';
import { fail } from '../domain/errors.js';
import { uuid } from './transforms.js';

const rotation = (value: number[]) =>
  new THREE.Euler(...(value.map(THREE.MathUtils.degToRad) as [number, number, number]));
export const rigClips = (root: THREE.Object3D) => {
  const clips: THREE.AnimationClip[] = [];
  root.traverse((object) => clips.push(...object.animations));
  return clips;
};
/** Build skin attributes from a rest-pose prototype, leaving its source geometry untouched.
 * Called after placement/hierarchy assembly. A runtime owns and disposes its new resources. */
export function bindRig(root: THREE.Object3D, spec: RigSpec) {
  validateRig(spec);
  const meshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.SkinnedMesh)
      fail('RIG_NESTED', 'A rig cannot contain another rig.');
    if (object instanceof THREE.Mesh) meshes.push(object);
  });
  if (!meshes.length) fail('RIG_EMPTY', 'A rig needs a model containing meshes.');
  if (meshes.reduce((sum, mesh) => sum + mesh.geometry.getAttribute('position').count, 0) > 200000)
    fail('RIG_BUDGET', 'A rig supports at most 200,000 skin vertices.');
  const knownPaths = new Set(meshes.map((mesh) => mesh.name.slice(root.name.length + 1)));
  for (const path of Object.keys(spec.bindings))
    if (!knownPaths.has(path))
      fail(
        'RIG_BINDING',
        `Rig binding ${path} does not match a mesh path relative to ${root.name}.`,
      );
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const ordered = [...spec.joints].sort((a, b) => Number(!!a.parent) - Number(!!b.parent));
  const bones = new Map(
    ordered.map((joint) => {
      const bone = new THREE.Bone();
      bone.name = `${root.name}/joints/${joint.id}`;
      bone.uuid = uuid(bone.name);
      bone.userData = { jointId: joint.id };
      bone.position.fromArray(joint.position);
      bone.rotation.copy(rotation(joint.rotation));
      return [joint.id, bone] as const;
    }),
  );
  for (const joint of ordered)
    (joint.parent ? bones.get(joint.parent)! : root).add(bones.get(joint.id)!);
  root.updateWorldMatrix(true, true);
  const skeleton = new THREE.Skeleton([...bones.values()]);
  const origins = [...bones.values()].map((bone) =>
    bone.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse),
  );
  const geometries: THREE.BufferGeometry[] = [];
  const skins: THREE.SkinnedMesh[] = [];
  for (const mesh of meshes) {
    const geometry = mesh.geometry.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));
    const positions = geometry.getAttribute('position');
    const indices = new Uint16Array(positions.count * 4),
      weights = new Float32Array(positions.count * 4);
    const explicit = spec.bindings[mesh.name.slice(root.name.length + 1)];
    const explicitIndex = ordered.findIndex((joint) => joint.id === explicit);
    for (let i = 0; i < positions.count; i++) {
      const point = new THREE.Vector3().fromBufferAttribute(positions, i);
      const nearest = origins
        .map((origin, index) => ({ index, distance: point.distanceTo(origin) }))
        .sort((a, b) => a.distance - b.distance || a.index - b.index);
      const first = explicit ? explicitIndex : nearest[0].index;
      indices[i * 4] = first;
      weights[i * 4] = 1;
      if (!explicit && spec.binding === 'smooth' && nearest.length > 1) {
        const a = nearest[0].distance,
          b = nearest[1].distance;
        const weight = b / Math.max(a + b, 1e-12);
        indices[i * 4 + 1] = nearest[1].index;
        weights[i * 4] = weight;
        weights[i * 4 + 1] = 1 - weight;
      }
    }
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
    const skin = new THREE.SkinnedMesh(geometry, mesh.material);
    skin.name = mesh.name;
    skin.uuid = mesh.uuid;
    skin.userData = { ...mesh.userData };
    skin.visible = mesh.visible;
    for (let parent = mesh.parent; parent && parent !== root; parent = parent.parent)
      skin.visible &&= parent.visible;
    skin.castShadow = mesh.castShadow;
    skin.receiveShadow = mesh.receiveShadow;
    mesh.removeFromParent();
    root.add(skin);
    skin.bind(skeleton, root.matrixWorld);
    geometries.push(geometry);
    skins.push(skin);
  }
  root.animations = spec.clips.map(
    (clip) =>
      new THREE.AnimationClip(
        `${root.name}/${clip.id}`,
        clip.duration,
        clip.tracks.map(
          (track) =>
            new THREE.QuaternionKeyframeTrack(
              `${bones.get(track.joint)!.uuid}.quaternion`,
              track.keyframes.map((frame) => frame.time),
              track.keyframes.flatMap((frame) =>
                new THREE.Quaternion().setFromEuler(rotation(frame.rotation)).toArray(),
              ),
            ),
        ),
      ),
  );
  function pose() {
    for (const joint of ordered)
      bones.get(joint.id)!.rotation.copy(rotation(spec.pose[joint.id] ?? joint.rotation));
    root.updateWorldMatrix(true, true);
    skeleton.update();
    skins.forEach((skin) => {
      skin.computeBoundingBox();
      skin.computeBoundingSphere();
    });
  }
  pose();
  return {
    bones,
    skeleton,
    pose,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      skeleton.dispose();
    },
  };
}
