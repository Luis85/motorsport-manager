import type { FinishSpec } from '../domain/schema.js';
/** Immutable v1 recipe. Generic runtimes must retain byte parity before accepting this version. */
export declare const finishAlgorithm = "forge-finish-v1";
/** Color is sRGB; normals and roughness(G)/metalness(B) are linear data, with opaque alpha. */
export declare function generateFinish(finish: FinishSpec): {
    width: number;
    height: number;
    color: Uint8Array;
    normal: Uint8Array;
    orm: Uint8Array;
};
