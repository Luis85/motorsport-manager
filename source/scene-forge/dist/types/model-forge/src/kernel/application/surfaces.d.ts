import * as THREE from 'three';
import type { SurfaceSpec, FinishSpec } from '../domain/schema.js';
export declare const maxSurfaceRecipes = 256;
/** One compilation/view owns a bounded map pool shared across material colors. */
export declare function createSurfacePool(): {
    apply: (material: THREE.MeshStandardMaterial, surface: SurfaceSpec) => void;
    applyFinish: (material: THREE.MeshStandardMaterial, finish: FinishSpec) => void;
    dispose: () => void;
};
/** Standalone material callers own an isolated pool; scene compilers supply a shared owner. */
export declare function applySurface(material: THREE.MeshStandardMaterial, surface: SurfaceSpec, owner?: ReturnType<typeof createSurfacePool>): void;
/** As with surfaces, a supplied scene pool owns resources independently of material disposal. */
export declare function applyFinish(material: THREE.MeshStandardMaterial, finish: FinishSpec, owner?: ReturnType<typeof createSurfacePool>): void;
/** Explicit portable tangent basis, including unused UV pole vertices and degenerate UV islands. */
export declare function ensureSurfaceTangents(geometry: THREE.BufferGeometry): void;
