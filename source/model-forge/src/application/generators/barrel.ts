import { z } from 'zod';
import { Color } from '../../kernel/index.js';
import { ModelKit, add, mul, shade } from './kit.js';
import { defineGenerator } from './types.js';

const parameters = z.strictObject({
  radius: z
    .number()
    .min(0.1)
    .max(1.5)
    .default(0.3)
    .describe('Base radius in meters (model parameter)'),
  height: z.number().min(0.3).max(3).default(0.9).describe('Height in meters (model parameter)'),
  bulge: z
    .number()
    .min(0)
    .max(0.3)
    .default(0.12)
    .describe('Belly radius increase as a fraction of the radius (model parameter)'),
  hoops: z.int().min(0).max(6).default(4).describe('Hoops or rolling ribs around the body'),
  segments: z.int().min(8).max(48).default(14).describe('Segments around; few + faceted = staves'),
  faceted: z.boolean().default(true).describe('Flat-shaded facets that read as wooden staves'),
  bung: z.boolean().default(false).describe('A filler cap on the lid'),
  bodyColor: Color.default('#8b5a2b').describe('Body color #rrggbb'),
  hoopColor: Color.default('#3d3a36').describe('Hoop and rim color #rrggbb'),
  metalness: z.number().min(0).max(1).default(0).describe('Body metalness'),
  roughness: z.number().min(0).max(1).default(0.8).describe('Body roughness'),
});

/** Turned containers: bellied wooden barrels and straight steel drums. */
export const barrel = defineGenerator({
  id: 'barrel',
  version: 1,
  category: 'props',
  description:
    'A lathe-turned barrel resting on y = 0 with a recessed lid, a rim and hoops (or drum ribs). radius, height and bulge stay editable; hoops follow the belly.',
  parameters,
  presets: {
    wooden: {
      description: 'An oak barrel with staves and four iron hoops (0.9 m).',
      parameters: {},
    },
    oil: {
      description: 'A red steel oil drum with two rolling ribs and a filler cap (0.88 m).',
      parameters: {
        radius: 0.29,
        height: 0.88,
        bulge: 0,
        hoops: 2,
        segments: 32,
        faceted: false,
        bung: true,
        bodyColor: '#a8322a',
        hoopColor: '#8c2a23',
        metalness: 0.55,
        roughness: 0.4,
      },
    },
    rusty: {
      description: 'A weathered, rusted steel drum (0.88 m).',
      parameters: {
        radius: 0.29,
        height: 0.88,
        bulge: 0,
        hoops: 2,
        segments: 24,
        faceted: false,
        bung: true,
        bodyColor: '#8a4b2a',
        hoopColor: '#6b3a22',
        metalness: 0.3,
        roughness: 0.95,
      },
    },
  },
  defaultPreset: 'wooden',
  limits: { maxTriangles: 6000 },
  build({ id, name, params, random }) {
    const kit = new ModelKit();
    const r = kit.param('radius', params.radius, {
      min: 0.1,
      max: 1.5,
      description: 'Base radius in meters',
    });
    const h = kit.param('height', params.height, {
      min: 0.3,
      max: 3,
      description: 'Height in meters',
    });
    const bulge = kit.param('bulge', params.bulge, {
      min: 0,
      max: 0.3,
      description: 'Belly radius increase as a fraction of the radius',
    });
    /** Radius of the side at height fraction t: a parabola that is widest halfway. */
    const side = (t: number) => mul(r, add(1, mul(bulge, 4 * t * (1 - t))));
    const stations = [0.03, 1 / 6, 2 / 6, 0.5, 4 / 6, 5 / 6, 0.97];
    kit.geometry('body', {
      type: 'lathe',
      points: [
        [0, 0],
        [mul(r, 0.97), 0],
        ...stations.map((t) => [side(t), mul(h, t)]),
        [mul(r, 0.97), h],
        [mul(r, 0.9), mul(h, 0.985)],
        [0, mul(h, 0.985)],
      ],
      segments: params.segments,
    });
    kit.material('body', {
      color: shade(params.bodyColor, random.fork('color'), 0.06),
      metalness: params.metalness,
      roughness: params.roughness,
      flatShading: params.faceted,
    });
    kit.material('hoop', {
      color: params.hoopColor,
      metalness: Math.max(params.metalness, 0.4),
      roughness: 0.5,
    });
    kit.mesh('body', 'body', 'body', { tags: ['body'] });
    kit.geometry('rim', {
      type: 'torus',
      radius: mul(r, 0.965),
      tube: mul(r, 0.035),
      segments: 32,
    });
    kit.mesh('rim', 'rim', 'hoop', {
      tags: ['rim'],
      transform: { position: [0, h, 0], rotation: [90, 0, 0] },
    });
    const hoops =
      params.hoops === 1
        ? [0.5]
        : Array.from({ length: params.hoops }, (_, i) =>
            params.bulge > 0 || params.hoops > 2
              ? 0.08 + (0.84 * i) / (params.hoops - 1)
              : (i + 1) / 3,
          );
    for (const [i, t] of hoops.entries()) {
      kit.geometry(`hoop${i + 1}`, {
        type: 'torus',
        radius: add(side(t), mul(r, 0.006)),
        tube: mul(r, 0.03),
        segments: Math.max(24, params.segments),
      });
      kit.mesh(`hoop${i + 1}`, `hoop${i + 1}`, 'hoop', {
        tags: ['hoop'],
        transform: { position: [0, mul(h, t), 0], rotation: [90, 0, 0] },
      });
    }
    if (params.bung) {
      kit.geometry('bung', {
        type: 'cylinder',
        radiusTop: mul(r, 0.1),
        radiusBottom: mul(r, 0.1),
        height: 0.025,
        segments: 12,
      });
      kit.mesh('bung', 'bung', 'hoop', {
        tags: ['cap'],
        transform: { position: [mul(r, 0.55), add(mul(h, 0.985), 0.0125), 0] },
      });
    }
    return kit.finish({ id, name, category: 'props' });
  },
});
