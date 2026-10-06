/**
 * Converts a Littlewild `littlewild-3d-asset` into Scene Forge model documents, one per variant.
 * Littlewild's fixed primitives are baked with the exact engine geometry, so a model imported and
 * exported again keeps its node IDs, transforms, materials and silhouette.
 */
type Plain = Record<string, unknown>;
export declare function littlewildModels(asset: Plain, prefix?: string): Record<string, Plain>;
export {};
