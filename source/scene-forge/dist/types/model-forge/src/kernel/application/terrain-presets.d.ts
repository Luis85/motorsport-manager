import { type HeightfieldGeometry, type MaterialSpec } from '../domain/schema.js';
/**
 * Named terrain starting points, as data shared by both forges. A preset is an ordinary
 * heightfield geometry plus a vertex-colored material; callers may override size,
 * amplitude, resolution and seed, and the result is validated like any authored recipe.
 */
export declare const terrainPresetNames: readonly ["plains", "hills", "mountains", "island", "dunes"];
export type TerrainPresetName = (typeof terrainPresetNames)[number];
export declare const defaultTerrainPreset: TerrainPresetName;
export declare const terrainPresets: Record<TerrainPresetName, {
    description: string;
    geometry: Record<string, unknown>;
    material: Record<string, unknown>;
}>;
export interface TerrainPresetOptions {
    size?: [number, number];
    amplitude?: number;
    resolution?: [number, number];
    seed?: number;
}
/** A validated heightfield geometry and its material for a named preset. */
export declare function terrainPreset(name: string, options?: TerrainPresetOptions): {
    geometry: HeightfieldGeometry;
    material: MaterialSpec;
};
