import * as THREE from 'three';
import type { SceneDocument } from '../domain/schema.js';
/** Meshes and triangles in the visible part of the hierarchy. */
export declare function visibleMeshStats(content: THREE.Object3D): {
    meshes: number;
    triangles: number;
};
export declare function renderEditStatus({ source, content, editable, editCount: count, canUndo, canRedo, bounds, }: {
    source: SceneDocument;
    content: THREE.Object3D;
    editable: boolean;
    editCount: number;
    canUndo: boolean;
    canRedo: boolean;
    bounds(): THREE.Box3;
}): void;
/** One-time header for the loaded scene; a non-editable preview hides edit entry points. */
export declare function renderSceneHeader({ source, modelCount, warnings, editable, }: {
    source: SceneDocument;
    modelCount: number;
    warnings: readonly string[];
    editable: boolean;
}): void;
