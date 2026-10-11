import * as THREE from 'three';
import type { HeightfieldGeometry } from '../domain/schema.js';
import type { Resolved } from '../domain/validate.js';
/**
 * Deterministic heightfield terrain. Heights come from fBm noise on an integer lattice
 * using only + - * / and 32-bit integer hashing, so every JavaScript engine computes the
 * same values. The mesh and sampleHeightfield share one grid and one triangulation:
 * each cell (ix, iz) splits along the diagonal from (ix+1, iz) to (ix, iz+1).
 */
export type HeightfieldSpec = Resolved<HeightfieldGeometry>;
/** Heights in meters (0..amplitude) for every grid vertex, row-major by z then x. */
export declare function heightGrid(spec: HeightfieldSpec): Float64Array;
export interface HeightSample {
    /** Height on the rendered surface in the geometry's local frame. */
    y: number;
    /** Unit normal of the rendered triangle under the point. */
    normal: [number, number, number];
    /** False when (x, z) lies outside the terrain extent; the sample is then clamped to the edge. */
    inside: boolean;
}
/** A sampler over one computed grid, for many queries against the same terrain. */
export declare function heightfieldSampler(spec: HeightfieldSpec): (x: number, z: number) => HeightSample;
/** Height and surface normal of the rendered mesh at local (x, z). */
export declare function sampleHeightfield(spec: HeightfieldSpec, x: number, z: number): HeightSample;
/** The terrain mesh: grid positions, shared-vertex triangles, UVs and optional band colors. */
export declare function heightfieldGeometry(spec: HeightfieldSpec): THREE.BufferGeometry;
