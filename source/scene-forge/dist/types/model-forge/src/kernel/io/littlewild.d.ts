import { type LittlewildAsset, type ModelLibrary } from '../domain/schema.js';
type Plain = Record<string, unknown>;
/** Indented JSON whose numeric vectors and mesh buffers stay on one line for reviewable diffs. */
export declare function definitionText(value: unknown): string;
/** Compiles every requested variant and merges it into the existing definition wrapper. */
export declare function littlewildVisual(asset: LittlewildAsset, models: ModelLibrary, existing?: Plain, options?: {
    preserve?: boolean;
}): {
    visual: {
        [x: string]: unknown;
    };
    report: Plain[];
    warnings: string[];
};
export declare function readDefinition(file: string): Promise<Plain | undefined>;
/** Writes one definition wrapper; non-visual gameplay facets are preserved byte-for-byte in value. */
export declare function writeLittlewildAsset(asset: LittlewildAsset, models: ModelLibrary, file: string, options?: {
    dryRun?: boolean;
    check?: boolean;
    preserve?: boolean;
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
