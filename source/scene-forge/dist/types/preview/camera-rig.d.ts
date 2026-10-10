import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { CameraRequest, SceneDocument } from '../domain/schema.js';
export type ViewCamera = THREE.PerspectiveCamera | THREE.OrthographicCamera;
interface CameraRigContext {
    stage: HTMLElement;
    renderer: THREE.WebGLRenderer;
    source: SceneDocument;
    /** Visible bounds of an object, or of the whole scene content when omitted. */
    bounds(object?: THREE.Object3D): THREE.Box3;
    selectedObject(): THREE.Object3D | undefined;
    draw(): void;
    onCamera(camera: ViewCamera): void;
}
export declare function createCameraRig({ stage, renderer, source, bounds, selectedObject, draw, onCamera, }: CameraRigContext): {
    fit: (nextView?: string, selectionOnly?: boolean, overrides?: Partial<CameraRequest>) => void;
    resize: () => void;
    camera: () => ViewCamera;
    controls: () => OrbitControls;
    view: () => string;
    snapshot: () => {
        projection: "perspective" | "orthographic";
        position: [number, number, number];
        target: [number, number, number];
        up: [number, number, number];
        near: number;
        far: number;
        zoom: number;
        fov?: number | undefined;
        aspect?: number | undefined;
        left?: number | undefined;
        right?: number | undefined;
        top?: number | undefined;
        bottom?: number | undefined;
    };
};
export {};
