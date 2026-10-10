import { z } from 'zod';
import { Color } from '../../kernel/index.js';
import { ModelKit, mul, shade } from './kit.js';
import { lump } from './shapes.js';
import { defineGenerator } from './types.js';

const parameters = z.strictObject({
  size: z.number().min(0.05).max(5).default(0.5).describe('Width in meters (model parameter)'),
  height: z
    .number()
    .min(0.2)
    .max(1.5)
    .default(0.65)
    .describe('Height as a fraction of the width (model parameter)'),
  stretch: z
    .number()
    .min(0.5)
    .max(2)
    .default(1.15)
    .describe('X length as a fraction of the Z depth (model parameter)'),
  detail: z.int().min(1).max(3).default(2).describe('Icosphere subdivisions (80 to 1280 faces)'),
  roughness: z.number().min(0).max(0.5).default(0.16).describe('Surface noise amplitude'),
  facets: z.int().min(0).max(12).default(5).describe('Flat chiseled faces cut by random planes'),
  smooth: z.boolean().default(false).describe('Smooth shading instead of flat facets'),
  color: Color.default('#6f6a63').describe('Base color #rrggbb (each seed shades it by up to 8%)'),
});

/** Seeded displaced icosphere: pebbles, stones and boulders that rest on y = 0. */
export const rock = defineGenerator({
  id: 'rock',
  version: 1,
  category: 'nature',
  description:
    'A seeded rock: a displaced icosphere mesh with flat chiseled faces and a flat base resting on y = 0. Each seed gives a different shape; size, height and stretch stay editable.',
  parameters,
  presets: {
    pebble: {
      description: 'A small, smooth, flattened river pebble (12 cm).',
      parameters: {
        size: 0.12,
        height: 0.45,
        stretch: 1.35,
        detail: 2,
        roughness: 0.12,
        facets: 1,
        smooth: true,
        color: '#857d72',
      },
    },
    stone: {
      description: 'A fist-to-knee-sized faceted field stone (50 cm).',
      parameters: { size: 0.5, height: 0.65, stretch: 1.15, detail: 2, roughness: 0.16, facets: 5 },
    },
    boulder: {
      description: 'A large weathered boulder with many flat faces (1.8 m).',
      parameters: {
        size: 1.8,
        height: 0.72,
        stretch: 1.25,
        detail: 3,
        roughness: 0.22,
        facets: 8,
        color: '#5f5b55',
      },
    },
  },
  defaultPreset: 'stone',
  limits: { maxTriangles: 1280 },
  build({ id, name, params, random }) {
    const kit = new ModelKit();
    const size = kit.param('size', params.size, {
      min: 0.05,
      max: 5,
      description: 'Width in meters along Z',
    });
    const height = kit.param('height', params.height, {
      min: 0.2,
      max: 1.5,
      description: 'Height as a fraction of the width',
    });
    const stretch = kit.param('stretch', params.stretch, {
      min: 0.5,
      max: 2,
      description: 'X length as a fraction of the width',
    });
    const shape = lump(random.fork('shape'), {
      detail: params.detail,
      roughness: params.roughness,
      frequency: 1.6,
      facets: params.facets,
      floor: -0.55,
    });
    kit.geometry('rock', { type: 'mesh', ...shape });
    kit.material('stone', {
      color: shade(params.color, random.fork('color'), 0.08),
      roughness: 0.92,
      flatShading: !params.smooth,
    });
    kit.mesh('rock', 'rock', 'stone', {
      tags: ['rock'],
      transform: { scale: [mul(size, stretch), mul(size, height), size] },
    });
    return kit.finish({ id, name, category: 'nature' });
  },
});
