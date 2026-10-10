import type * as THREE from 'three';
import type { Geometry } from '../domain/schema.js';
import type { Resolved } from '../domain/validate.js';
type Mesh = Resolved<Extract<Geometry, {
    type: 'mesh';
}>>;
/** Keep authored decimals outside Three JSON/extras; the compilation owns their lifetime. */
export declare function rememberMeshSource(geometry: THREE.BufferGeometry, source: Mesh): void;
/** Reuse precise source data only while every compiled buffer still matches its captured value. */
export declare function authoredMeshBuffers(geometry: THREE.BufferGeometry): {
    uvs?: number[] | undefined;
    normals?: number[] | undefined;
    positions: number[];
    indices: number[];
} | undefined;
export {};
