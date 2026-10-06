import * as THREE from 'three';
import { type SceneDocument, type ModelDocument } from '../domain/schema.js';
import type { Resolved } from '../domain/validate.js';
/** Owns every GPU resource allocated during one compilation, including failed builds. */
export declare function createResourcePool(warnings: Set<string>): {
    scopeResources: (scope: Resolved<SceneDocument | ModelDocument>, path: string, overrides?: Record<string, THREE.Material>) => {
        geometry: (id: string) => THREE.BufferGeometry;
        material: (id: string) => THREE.Material;
    };
    readonly geometryCount: number;
    readonly materialCount: number;
    dispose(): void;
};
