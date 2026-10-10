import type { SceneDocument } from '../domain/schema.js';
import { type HeightfieldSpec, type HeightSample } from './heightfield.js';
/**
 * Terrain frames. Grounding samples a heightfield node through its node chain, which may
 * only translate, turn about Y and scale uniformly (TERRAIN_TRANSFORM otherwise): those
 * transforms keep "up" vertical, so a height sample stays a height sample in every frame.
 */
export interface Similarity {
    scale: number;
    /** Radians about +Y. */
    yaw: number;
    translation: [number, number, number];
}
export declare function applySimilarity(f: Similarity, p: readonly number[]): [number, number, number];
export declare function invertSimilarity(f: Similarity, p: readonly number[]): [number, number, number];
/** World frame of a node (or the document root for undefined) as a similarity. */
export declare function nodeFrame(scene: SceneDocument, id: string | undefined, role: string): Similarity;
/** The resolved heightfield of a terrain node. */
export declare function terrainSpec(scene: SceneDocument, id: string): HeightfieldSpec;
/**
 * Sample a terrain node in the frame of `frameNode` (world when undefined): (x, z) are
 * coordinates in that frame, and y and normal come back in it.
 */
export declare function terrainSampler(scene: SceneDocument, terrain: string, frameNode?: string): (x: number, z: number) => HeightSample;
/** World-space samples of a terrain node, for terrain queries. */
export declare function sampleTerrainNode(scene: SceneDocument, terrain: string, points: readonly (readonly [number, number])[]): {
    y: number;
    normal: [number, number, number];
    inside: boolean;
    x: number;
    z: number;
}[];
