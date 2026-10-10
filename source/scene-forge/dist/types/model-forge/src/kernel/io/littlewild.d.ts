import { littlewildFamilies, type LittlewildAsset, type ModelLibrary } from '../domain/schema.js';
type Plain = Record<string, unknown>;
export type LittlewildFamily = keyof typeof littlewildFamilies;
/** Indented JSON whose numeric vectors and mesh buffers stay on one line for reviewable diffs. */
export declare function definitionText(value: unknown): string;
/**
 * Compiles every requested variant and merges it into the existing definition wrapper.
 * A new definition is written in canonical form; merging into an existing one keeps that
 * definition's own representation wherever content is unchanged (littlewild-preserve.ts).
 */
export declare function littlewildVisual(asset: LittlewildAsset, models: ModelLibrary, existing?: Plain): {
    visual: {
        [x: string]: unknown;
    };
    report: Plain[];
    warnings: string[];
};
export declare function readDefinition(file: string): Promise<Plain | undefined>;
/**
 * The family and display name a one-model export to `<family>/<id>/definition.json` writes,
 * shared by Model Forge and Scene Forge: an omitted family comes from the path (else
 * `items`), and an existing definition of that family keeps its display name unless a name
 * is given; a new definition takes `fallbackName` (the model name).
 */
export declare function littlewildExportIdentity(file: string, options: {
    family?: LittlewildFamily;
    name?: string;
    fallbackName: string;
}): Promise<{
    id: string;
    family: "items" | "buildings" | "creatures" | "pets";
    name: string;
}>;
/** Writes one definition wrapper; non-visual gameplay facets are preserved byte-for-byte in value. */
export declare function writeLittlewildAsset(asset: LittlewildAsset, models: ModelLibrary, file: string, options?: {
    dryRun?: boolean;
    check?: boolean;
}): Promise<{
    path: string;
    id: string;
    family: "items" | "buildings" | "creatures" | "pets";
    changed: boolean;
    written: boolean;
    bytes: number;
    variants: Plain[];
    warnings: string[];
}>;
export {};
