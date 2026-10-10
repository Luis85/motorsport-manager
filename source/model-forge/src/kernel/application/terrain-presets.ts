import { parse } from '../domain/parse.js';
import { fail } from '../domain/errors.js';
import {
  HeightfieldGeometrySchema,
  MaterialSchema,
  type HeightfieldGeometry,
  type MaterialSpec,
} from '../domain/schema.js';

/**
 * Named terrain starting points, as data shared by both forges. A preset is an ordinary
 * heightfield geometry plus a vertex-colored material; callers may override size,
 * amplitude, resolution and seed, and the result is validated like any authored recipe.
 */
export const terrainPresetNames = ['plains', 'hills', 'mountains', 'island', 'dunes'] as const;
export type TerrainPresetName = (typeof terrainPresetNames)[number];
export const defaultTerrainPreset: TerrainPresetName = 'hills';

const material = { color: '#ffffff', roughness: 0.95, vertexColors: true };
export const terrainPresets: Record<
  TerrainPresetName,
  { description: string; geometry: Record<string, unknown>; material: Record<string, unknown> }
> = {
  plains: {
    description: 'Gently rolling grassland, nearly flat; good for layouts and roads.',
    geometry: {
      size: [64, 64],
      amplitude: 1.5,
      resolution: [64, 64],
      noise: { kind: 'value', octaves: 3, frequency: 2, lacunarity: 2, gain: 0.45 },
      falloff: 'none',
      terrace: 0,
      bands: [
        { below: 0.4, color: '#5f8f3e' },
        { below: 1, color: '#7aa851' },
      ],
    },
    material,
  },
  hills: {
    description: 'Rolling hills with grass valleys and earthy tops.',
    geometry: {
      size: [64, 64],
      amplitude: 6,
      resolution: [96, 96],
      noise: { kind: 'value', octaves: 5, frequency: 3, lacunarity: 2, gain: 0.5 },
      falloff: 'none',
      terrace: 0,
      bands: [
        { below: 0.45, color: '#5b8a3a' },
        { below: 0.75, color: '#7c9a4a' },
        { below: 1, color: '#8a7a55' },
      ],
    },
    material,
  },
  mountains: {
    description: 'Ridged peaks with rock faces and snow caps.',
    geometry: {
      size: [128, 128],
      amplitude: 28,
      resolution: [128, 128],
      noise: { kind: 'ridged', octaves: 6, frequency: 2.5, lacunarity: 2.1, gain: 0.55 },
      falloff: 'none',
      terrace: 0,
      bands: [
        { below: 0.3, color: '#4f7a3a' },
        { below: 0.65, color: '#7a7268' },
        { below: 0.85, color: '#9a948c' },
        { below: 1, color: '#f2f4f7' },
      ],
    },
    material,
  },
  island: {
    description: 'A single island falling off to sea level at the edges, with beaches.',
    geometry: {
      size: [96, 96],
      amplitude: 10,
      resolution: [96, 96],
      noise: { kind: 'value', octaves: 5, frequency: 3, lacunarity: 2, gain: 0.5 },
      falloff: 'island',
      terrace: 0,
      bands: [
        { below: 0.04, color: '#d9c58f' },
        { below: 0.5, color: '#5b8a3a' },
        { below: 0.8, color: '#6f7d4a' },
        { below: 1, color: '#8c8478' },
      ],
    },
    material,
  },
  dunes: {
    description: 'Soft desert dunes with billowed crests.',
    geometry: {
      size: [64, 64],
      amplitude: 4,
      resolution: [96, 96],
      noise: { kind: 'billow', octaves: 3, frequency: 4, lacunarity: 2, gain: 0.4 },
      falloff: 'none',
      terrace: 0,
      bands: [
        { below: 0.5, color: '#d6b77a' },
        { below: 1, color: '#e6cc92' },
      ],
    },
    material,
  },
};

export interface TerrainPresetOptions {
  size?: [number, number];
  amplitude?: number;
  resolution?: [number, number];
  seed?: number;
}

/** A validated heightfield geometry and its material for a named preset. */
export function terrainPreset(
  name: string,
  options: TerrainPresetOptions = {},
): { geometry: HeightfieldGeometry; material: MaterialSpec } {
  if (!(terrainPresetNames as readonly string[]).includes(name))
    fail('NOT_FOUND', `Terrain preset ${name} does not exist.`, {
      available: terrainPresetNames,
      hint: `Use one of ${terrainPresetNames.join(', ')}.`,
    });
  const preset = terrainPresets[name as TerrainPresetName];
  const geometry = parse(HeightfieldGeometrySchema, {
    type: 'heightfield',
    ...structuredClone(preset.geometry),
    ...Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined)),
  });
  return { geometry, material: parse(MaterialSchema, structuredClone(preset.material)) };
}
