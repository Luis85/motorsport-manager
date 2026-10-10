import * as THREE from 'three';
import type { SurfaceSpec } from '../domain/schema.js';
export declare const maxSurfaceRecipes = 256;
/** One compilation/view owns a bounded map pool shared across material colors. */
export declare function createSurfacePool(): {
    apply: (material: THREE.MeshStandardMaterial, surface: SurfaceSpec) => void;
    dispose: () => void;
};
/** Standalone material callers own an isolated pool; scene compilers supply a shared owner. */
export declare function applySurface(material: THREE.MeshStandardMaterial, surface: SurfaceSpec, owner?: ReturnType<typeof createSurfacePool>): void;
/** Explicit portable tangent basis, including unused UV pole vertices and degenerate UV islands. */
export declare function ensureSurfaceTangents(geometry: THREE.BufferGeometry): void;
