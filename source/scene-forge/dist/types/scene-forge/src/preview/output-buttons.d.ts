import { type SceneDocument } from '../kernel-render.js';
import type * as THREE from 'three';
import type { TransformControls } from 'three/addons/controls/TransformControls.js';
export declare function setupOutputButtons({ source, content, helpers, gizmo, renderer, draw, toast, }: {
    source: SceneDocument;
    content(): THREE.Group;
    helpers: THREE.Group;
    gizmo(): TransformControls;
    renderer: THREE.WebGLRenderer;
    draw(): void;
    toast(message: string, error?: boolean): void;
}): void;
