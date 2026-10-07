import * as THREE from 'three';
import { type SceneDocument, type ModelLibrary } from '../domain/schema.js';
export interface CompiledScene {
    scene: THREE.Scene;
    content: THREE.Group;
    stats: SceneStats;
    dispose(): void;
}
export interface SceneStats {
    nodes: number;
    meshes: number;
    triangles: number;
    materials: number;
    geometries: number;
    bounds: {
        min: number[];
        max: number[];
        size: number[];
    };
    warnings: string[];
}
export declare function compileScene(document: SceneDocument, models?: ModelLibrary, options?: {
    bindRigs?: boolean;
}): CompiledScene;
