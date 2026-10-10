import type { SurfaceSpec } from '../domain/schema.js';
export declare const surfaceAlgorithm = "littlewild-surface-v1";
export declare function generateSurface(surface: SurfaceSpec): {
    width: number;
    height: number;
    color: Uint8Array<ArrayBuffer>;
    normal: Uint8Array<ArrayBuffer>;
};
/** Legacy meshes get a local spherical projection; authored seam-aware UVs take precedence. */
export declare function sphereUVs(positions: readonly number[]): number[];
