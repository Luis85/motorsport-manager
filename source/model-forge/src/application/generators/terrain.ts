import { z } from 'zod';
import {
  terrainPreset,
  terrainPresets,
  terrainPresetNames,
  HEIGHTFIELD_MAX_RESOLUTION,
} from '../../kernel/index.js';
import { ModelKit } from './kit.js';
import { defineGenerator } from './types.js';

const axis = z.int().min(2).max(HEIGHTFIELD_MAX_RESOLUTION);
const parameters = z.strictObject({
  style: z
    .enum(terrainPresetNames)
    .default('hills')
    .describe('Kernel terrain preset: noise, falloff and color bands'),
  width: z.number().min(1).max(4096).default(64).describe('X size in meters (model parameter)'),
  depth: z.number().min(1).max(4096).default(64).describe('Z size in meters (model parameter)'),
  amplitude: z
    .number()
    .min(0)
    .max(1000)
    .default(6)
    .describe('Height range in meters, from y = 0 (model parameter)'),
  resolution: axis.default(96).describe('Vertices per axis (2 to 256; triangles = 2 (n - 1)^2)'),
  terrace: z.int().min(0).max(32).default(0).describe('Terrace steps (0 = smooth)'),
});

const presetValues = (name: (typeof terrainPresetNames)[number]) => {
  const geometry = terrainPresets[name].geometry as {
    size: [number, number];
    amplitude: number;
    resolution: [number, number];
  };
  return {
    style: name,
    width: geometry.size[0],
    depth: geometry.size[1],
    amplitude: geometry.amplitude,
    resolution: geometry.resolution[0],
  };
};

/** A heightfield landscape from the kernel's terrain presets, as an editable model. */
export const terrain = defineGenerator({
  id: 'terrain',
  version: 1,
  category: 'terrain',
  description:
    "A heightfield terrain tile centered on the origin from the kernel's terrain presets (plains, hills, mountains, island, dunes), with vertex-colored height bands. The seed shapes the noise; width, depth and amplitude stay editable. Scatter onto it with ground mode terrain.",
  parameters,
  presets: Object.fromEntries(
    terrainPresetNames.map((name) => [
      name,
      { description: terrainPresets[name].description, parameters: presetValues(name) },
    ]),
  ),
  defaultPreset: 'hills',
  limits: { maxTriangles: 2 * (HEIGHTFIELD_MAX_RESOLUTION - 1) ** 2 },
  build({ id, name, params, random }) {
    const kit = new ModelKit();
    const width = kit.param('width', params.width, {
      min: 1,
      max: 4096,
      description: 'X size in meters',
    });
    const depth = kit.param('depth', params.depth, {
      min: 1,
      max: 4096,
      description: 'Z size in meters',
    });
    const amplitude = kit.param('amplitude', params.amplitude, {
      min: 0,
      max: 1000,
      description: 'Height range in meters',
    });
    const preset = terrainPreset(params.style, {
      resolution: [params.resolution, params.resolution],
      seed: random.seed,
    });
    kit.geometry('terrain', {
      ...preset.geometry,
      size: [width, depth],
      amplitude,
      terrace: params.terrace,
    });
    kit.material('ground', preset.material);
    kit.mesh('terrain', 'terrain', 'ground', { tags: ['terrain'] });
    return kit.finish({ id, name, category: 'terrain' });
  },
});
