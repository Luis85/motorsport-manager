import { type Area, type SceneDocument, type ScatterRecipeInput } from '../kernel.js';
/**
 * Compile the procedural command flags into the same ScatterRecipe a `--file` accepts.
 * Pure text-to-data translation: the kernel's planner validates the result, so a flag
 * recipe and its echoed JSON recipe are interchangeable.
 */
export type Pair = [number, number];
/** `x,z;x,z;...` into points. */
export declare function parsePoints(text: string, flag: string, minimum?: number): Pair[];
/** `a..b` (inclusive range) or a single value `a` (fixed). */
export declare function parseRange(text: string, flag: string): Pair;
/** `rect:x0,z0,x1,z1`, `circle:x,z,r` or `polygon:x,z;x,z;x,z[;...]`. */
export declare function parseArea(text: string, flag?: string): Area;
/** `rock,tree:3` into weighted model items. */
export declare function parseItems(text: string): ({
    model: string;
    weight?: undefined;
} | {
    model: string;
    weight: number;
})[];
/** `CxR` grid counts. */
export declare function parseGrid(text: string): Pair;
/** Flags shared by scatter and layout. */
export interface PlacementFlags {
    model?: string;
    seed?: number;
    group?: string;
    parent?: string;
    on?: string;
    sink?: number;
    maxSlope?: number;
    scale?: string;
    yaw?: string;
    max?: number;
    exclude?: string[];
    avoid?: string;
    margin?: number;
}
export interface ScatterFlags extends PlacementFlags {
    area?: string;
    spacing?: number;
    count?: number;
}
export interface LayoutFlags extends PlacementFlags {
    path?: string;
    spacing?: number;
    orient?: 'yaw' | 'none';
    grid?: string;
    step?: string;
    jitter?: number;
    center?: string;
}
/** Recipe flags that conflict with a complete `--file`/`--data` recipe. */
export declare const recipeFlags: readonly ["model", "area", "spacing", "count", "parent", "on", "sink", "maxSlope", "scale", "yaw", "max", "exclude", "avoid", "margin"];
/** The world-space XZ footprint of a terrain node: a rect, or a polygon when it is turned. */
export declare function terrainFootprint(scene: SceneDocument, node: string): Area;
/**
 * `scatter` flags: poisson (--spacing) or uniform random (--count) placements in --area,
 * which defaults to the --on terrain's footprint when no --parent frame is involved.
 */
export declare function scatterRecipe(flags: ScatterFlags, scene: SceneDocument): ScatterRecipeInput;
/** `layout` flags: evenly spaced along --path, or a COLUMNSxROWS --grid; yaw defaults to 0. */
export declare function layoutRecipe(flags: LayoutFlags): ScatterRecipeInput;
