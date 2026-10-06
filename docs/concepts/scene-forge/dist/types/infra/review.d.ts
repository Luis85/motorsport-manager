import { type ReviewPlan, type SceneDocument, type ModelLibrary } from '../domain/schema.js';
export declare function reviewScene(scene: SceneDocument, models: ModelLibrary, output: string, input: ReviewPlan, options?: {
    overwrite?: boolean;
    sourceStateHash?: string;
    target?: unknown;
}): Promise<{
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
