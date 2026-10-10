import type { BufferGeometry } from 'three';
/** Native recovery must preserve authored topology and UVs, not merely vertex count. */
export declare function unchangedNative(kind: string, geometry: BufferGeometry, create: () => BufferGeometry): boolean;
