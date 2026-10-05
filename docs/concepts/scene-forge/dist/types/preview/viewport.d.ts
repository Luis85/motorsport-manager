import * as THREE from 'three';
import type { SceneDocument } from '../domain/schema.js';
export declare function boundsOf(object: THREE.Object3D): THREE.Box3;
export declare function createViewport(scene: THREE.Scene, source: SceneDocument, stage: HTMLElement): {
    renderer: THREE.WebGLRenderer;
    lighting: (content: THREE.Object3D, gridVisible: boolean) => THREE.GridHelper;
};
