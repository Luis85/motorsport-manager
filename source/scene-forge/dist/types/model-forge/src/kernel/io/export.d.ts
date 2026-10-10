import { type SceneDocument, type ModelLibrary } from '../domain/schema.js';
export declare const exportFormats: readonly ["glb", "gltf", "obj", "stl", "three"];
export type ExportFormat = (typeof exportFormats)[number];
/** Official Khronos validation. No external resources are fetched. */
export declare function validateExport(data: Uint8Array | string, format: ExportFormat): Promise<{
    numErrors: number;
    numWarnings: number;
    messages: unknown[];
    validator: string;
}>;
export declare function exportScene(document: SceneDocument, models: ModelLibrary, format: ExportFormat, nodeId?: string): Promise<{
    data: string | Uint8Array<ArrayBufferLike>;
    stats: {
        nodes: number;
        meshes: number;
        triangles: number;
        materials: number;
        geometries: number;
        bounds: {
            min: number[];
            max: number[];
            size: number[];
        };
        warnings: string[];
    };
    warnings: string[];
}>;
