/**
 * Converts a Littlewild `littlewild-3d-asset` into Scene Forge model documents, one per variant.
 * Littlewild's fixed primitives are baked with the exact engine geometry, so a model imported and
 * exported again keeps its node IDs, transforms, materials and silhouette.
 */
type Plain = Record<string, unknown>;
/**
 * The Forge node ID import gives every node of one variant, in its depth-first walk: the
 * Littlewild `id` when present, else a synthetic `<primitive><n>`, made unique. The
 * lossless writer uses the same IDs to find the source node of an id-less exported node.
 */
export declare function importedNodeIds(roots: readonly unknown[]): Map<Plain, string>;
export declare function littlewildModels(asset: Plain, prefix?: string): Record<string, Plain>;
/** The variant-to-model mapping is produced by the same pass that allocates IDs. */
export declare function littlewildImportPlan(asset: Plain, prefix?: string): {
    models: Record<string, Plain>;
    variantModels: {
        [k: string]: string;
    };
};
export {};
