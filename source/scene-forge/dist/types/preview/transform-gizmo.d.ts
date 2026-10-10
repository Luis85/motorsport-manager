import type * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
interface TransformGizmoContext {
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    editable: boolean;
    controls(): OrbitControls;
    selectedObject(): THREE.Object3D | undefined;
    draw(): void;
    onDragStart(): void;
    onObjectChange(): void;
    onDragEnd(): void;
}
export declare function createTransformGizmo({ scene, renderer, editable, controls, selectedObject, draw, onDragStart, onObjectChange, onDragEnd, }: TransformGizmoContext): {
    setup: (camera: THREE.Camera) => void;
    attach: () => void;
    setMode: (next: string) => void;
    current: () => TransformControls;
    detach: () => TransformControls;
};
export {};
