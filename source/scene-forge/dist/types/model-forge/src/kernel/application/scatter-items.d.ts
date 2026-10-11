import type { ModelLibrary, NodeSpec, SceneDocument, ScatterRecipe } from '../domain/schema.js';
import type { Random } from '../domain/random.js';
/** One scatter item, checked against the document and the model library. */
export interface ScatterSource {
    weight: number;
    model?: string;
    template?: NodeSpec;
    /** Varied parameters in name order: [name, min, max, integer]. */
    vary: [string, number, number, boolean][];
}
/**
 * Check every item: registered models, copyable template nodes (a mesh or model without
 * children), and vary ranges inside each parameter's declared range.
 */
export declare function scatterSources(scene: SceneDocument, models: ModelLibrary, recipe: ScatterRecipe): ScatterSource[];
export interface InstanceDraw {
    position: [number, number, number];
    yaw: number;
    tilt: [number, number];
    scale: number;
}
/** The putNode payload of one placement. */
export declare function instanceNode(scene: SceneDocument, source: ScatterSource, id: string, group: string, tag: string, draw: InstanceDraw, random: Random): Record<string, unknown>;
