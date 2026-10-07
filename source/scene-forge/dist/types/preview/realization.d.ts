import * as THREE from 'three';
import type { SceneDocument } from '../domain/schema.js';
/** Owns transient resources. Geometry prototypes and authored data remain immutable. */
export declare function createRealization(source: SceneDocument): {
    apply: (content: THREE.Object3D) => void;
    animate: (content: THREE.Object3D, id: string, clipId: string, time: number) => void;
    dispose: () => void;
};
