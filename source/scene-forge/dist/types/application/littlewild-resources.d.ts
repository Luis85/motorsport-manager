type Plain = Record<string, unknown>;
/** Exact full-buffer equality, including normals and UVs. Retained names take precedence. */
export declare function reuseLittlewildMeshes(models: Plain, meshes: Plain, preferred: string[]): Plain;
/** Matches the engine's whole-definition JSON value/depth bound before publication. */
export declare function assertLittlewildComplexity(visual: Plain): void;
export {};
