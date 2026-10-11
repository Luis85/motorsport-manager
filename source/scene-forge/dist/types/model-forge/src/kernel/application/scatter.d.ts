import { type ModelLibrary, type Operation, type SceneDocument, type ScatterRecipe } from '../domain/schema.js';
export interface ScatterOptions {
    /** Return a plan with only the group node when nothing could be placed. */
    allowEmpty?: boolean;
    /** Remove an existing scatter group (tagged `scatter`) of the same ID and its subtree first. */
    replace?: boolean;
}
export interface ScatterPlacement {
    seed: number;
    /** sha256 of the canonical normalized recipe; its first 8 characters tag the group. */
    recipeHash: string;
    group: string;
    placed: number;
    candidates: number;
    rejected: {
        outside: number;
        exclusion: number;
        slope: number;
        budget: number;
    };
}
export interface ScatterPlan {
    /** The normalized recipe, with every default spelled out. */
    recipe: ScatterRecipe;
    operations: Operation[];
    placement: ScatterPlacement;
}
/**
 * Plan a scatter as ordinary operations: one group putNode tagged `scatter` and
 * `scatter:<recipeHash8>`, then one putNode per placement (`<group>-<n>`), preceded by a
 * cascading removeNode of the old group when `replace` is set. Pure and deterministic:
 * the same scene, models and recipe give the same operations. Each candidate draws its
 * item, scale, rotation and parameters from its own keyed stream, so filtering one
 * candidate never changes another placement.
 */
export declare function planScatter(scene: SceneDocument, models: ModelLibrary, input: unknown, options?: ScatterOptions): ScatterPlan;
