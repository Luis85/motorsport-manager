import { type LittlewildNode } from './littlewild.js';
/**
 * Source-preserving Littlewild maintenance, the one contract of every writer (Model Forge's
 * `export --format littlewild`, Scene Forge's `littlewild export` and `littlewild sync`) when
 * it merges into an existing definition. A re-exported variant keeps that definition's own
 * representation wherever it is semantically unchanged: node key order, explicit zero
 * transforms, empty children, shared string material references, per-node `materialProps`,
 * mesh resource names and engine-only node fields the recipe cannot express (for example
 * `castShadow: false`). Changed fields take the normalized exported form.
 */
type Plain = Record<string, unknown>;
type Node = LittlewildNode & Plain;
export interface PreservedVariants {
    /** Material keys whose source definition value the merged nodes rely on. */
    materials: Set<string>;
    /** Source mesh IDs the merged nodes still reference. */
    meshes: Set<string>;
    /** Exported nodes that reference a newly exported material role. */
    exportedMaterialNodes: Node[];
}
/** Merge one exported variant's nodes onto the source variant's nodes. */
export declare function preserveVariantNodes(exported: LittlewildNode[], source: unknown[], tables: {
    previous: Plain;
    previousMeshes: Plain;
    materials: Plain;
    meshes: Plain;
}, kept: PreservedVariants): LittlewildNode[];
/** Every material and mesh key the variants reference. */
export declare function referencedResources(models: unknown): {
    materials: Set<string>;
    meshes: Set<string>;
};
/** Order keys like the source object; keys the source lacks follow in their own order. */
export declare function inSourceOrder<T extends Plain>(value: T, source: unknown): T;
/**
 * Merge every exported variant onto its source variant, then rebuild the exported material
 * table: kept source keys keep their source values; an exported role that would change a
 * kept key's meaning for its users is renamed. Mutates `exported`, `materials` and `meshes`.
 */
export declare function preserveExported(previous: Plain, exported: Record<string, {
    nodes: LittlewildNode[];
}>, materials: Plain, meshes: Plain): void;
/**
 * Restore the source's own layout: materials and meshes no source variant referenced
 * (hand-authored palette entries) are kept, and keys follow the source order.
 */
export declare function preserveTables(visual: Plain, previous: Plain): Plain;
export {};
