import { type ReviewPlan, type SceneDocument, type ModelLibrary } from '../domain/schema.js';
import { type CaptureDependencies } from './capture.js';
/** The product that renders a review: its render-only page and provenance identity. */
export interface ReviewRenderer {
    tool: string;
    version: string;
    /** Build a self-contained, render-only page that publishes the RenderPageWindow contract. */
    buildHtml(scene: SceneDocument, models: ModelLibrary, options: {
        stateHash?: string;
    }): Promise<string>;
    capture?: CaptureDependencies;
}
export interface ReviewOptions {
    overwrite?: boolean;
    sourceStateHash?: string;
    target?: unknown;
    /**
     * The reviewed subject's identity for the manifest's top-level `scene` and `revision`;
     * defaults to the rendered scene's own. A model editor names its model and document revision.
     */
    identity?: {
        scene: string;
        revision: number;
    };
}
/** Capture a review plan into a new directory with PNGs, a contact sheet and review.json. */
export declare function reviewRender(scene: SceneDocument, models: ModelLibrary, output: string, input: ReviewPlan, renderer: ReviewRenderer, options?: ReviewOptions): Promise<{
    directory: string;
    manifest: string;
    replayPlan: string;
    contactSheet: string | undefined;
    frames: {
        path: string;
        id: string;
        file: string;
        width: number;
        height: number;
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
        sha256: string;
        bytes: number;
    }[];
    stats: import("../index.js").SceneStats;
    durationMs: number;
    sourceStateHash: string;
}>;
