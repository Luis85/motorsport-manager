import type { SurfaceSpec } from '../domain/schema.js';
export declare const surfaceAlgorithm = "littlewild-surface-v1";
export declare function resolveSurfaceAlgorithm(surface: SurfaceSpec): 'littlewild-surface-v1' | 'littlewild-surface-v2';
export declare function generateSurface(surface: SurfaceSpec): {
    width: number;
    height: number;
    color: Uint8Array;
    normal: Uint8Array;
};
/** Legacy meshes get a local spherical projection; authored seam-aware UVs take precedence. */
export declare function sphereUVs(positions: readonly number[]): number[];
