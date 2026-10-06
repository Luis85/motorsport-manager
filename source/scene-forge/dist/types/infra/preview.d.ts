import { type CameraRequest, type SceneDocument, type ModelLibrary } from '../domain/schema.js';
export interface PreviewOptions {
    stateHash?: string;
    editable?: boolean;
    includeLibrary?: boolean;
}
export declare function createPreview(document: SceneDocument, models: ModelLibrary, options?: PreviewOptions): Promise<string>;
/** Build one offline workshop; compiled library prototypes are shared by all embedded scenes. */
export declare function createProjectPreview(documents: SceneDocument[], models: ModelLibrary, activeScene?: string): Promise<string>;
export declare function screenshot(html: string, output: string, options: {
    width: number;
    height: number;
    view: string;
    grid: boolean;
    ui: boolean;
    camera?: Partial<CameraRequest>;
    wireframe?: boolean;
}): Promise<{
    path: string;
    width: number;
    height: number;
    view: string;
    camera: {
        projection: "perspective" | "orthographic";
        position: [number, number, number];
        target: [number, number, number];
        up: [number, number, number];
        near: number;
        far: number;
        zoom: number;
        fov?: number | undefined;
        aspect?: number | undefined;
        left?: number | undefined;
        right?: number | undefined;
        top?: number | undefined;
        bottom?: number | undefined;
    };
}>;
