import * as THREE from 'three';
import type { RigSpec } from '../domain/schema.js';
export declare const rigClips: (root: THREE.Object3D) => THREE.AnimationClip[];
/** Build skin attributes from a rest-pose prototype, leaving its source geometry untouched.
 * Called after placement/hierarchy assembly. A runtime owns and disposes its new resources. */
export declare function bindRig(root: THREE.Object3D, spec: RigSpec): {
    bones: Map<string, THREE.Bone<THREE.Object3DEventMap>>;
    skeleton: THREE.Skeleton;
    pose: () => void;
    dispose: () => void;
};
