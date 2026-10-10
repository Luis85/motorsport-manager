import { z } from 'zod';
import { Color } from '../../kernel/index.js';
import { ModelKit, mul, tint } from './kit.js';
import { lump } from './shapes.js';
import { defineGenerator } from './types.js';

const parameters = z.strictObject({
  size: z.number().min(0.2).max(4).default(1.2).describe('Depth in meters (model parameter)'),
  height: z
    .number()
    .min(0.3)
    .max(1.5)
    .default(0.75)
    .describe('Height as a fraction of the depth (model parameter)'),
  length: z
    .number()
    .min(1)
    .max(6)
    .default(1.15)
    .describe('X length as a multiple of the depth (model parameter; hedges are long)'),
  clumps: z.int().min(3).max(48).default(7).describe('Foliage clumps'),
  flowers: z.int().min(0).max(48).default(0).describe('Blossoms on the surface'),
  core: z.boolean().default(false).describe('A solid inner block that closes gaps (hedges)'),
  leafColor: Color.default('#4a7d34').describe('Foliage color #rrggbb'),
  flowerColor: Color.default('#e86a92').describe('Blossom color #rrggbb'),
});

/** Clumped low-poly shrubs: round bushes, clipped hedges and flowering shrubs. */
export const bush = defineGenerator({
  id: 'bush',
  version: 1,
  category: 'nature',
  description:
    'A seeded low-poly shrub of overlapping foliage clumps resting on y = 0, optionally with blossoms. size, height and length stay editable; a long length makes a hedge.',
  parameters,
  presets: {
    round: {
      description: 'A round garden shrub (1.2 m).',
      parameters: {},
    },
    hedge: {
      description: 'A clipped hedge section, four times as long as deep (0.9 m deep).',
      parameters: {
        size: 0.9,
        height: 1.1,
        length: 4,
        clumps: 42,
        core: true,
        leafColor: '#3f6e2e',
      },
    },
    flowering: {
      description: 'A rounded shrub dotted with pink blossoms (1 m).',
      parameters: { size: 1, height: 0.8, length: 1.1, clumps: 8, flowers: 22 },
    },
  },
  defaultPreset: 'round',
  limits: { maxTriangles: 8000 },
  build({ id, name, params, random }) {
    const kit = new ModelKit();
    const size = kit.param('size', params.size, {
      min: 0.2,
      max: 4,
      description: 'Depth in meters along Z',
    });
    const height = kit.param('height', params.height, {
      min: 0.3,
      max: 1.5,
      description: 'Height as a fraction of the depth',
    });
    const length = kit.param('length', params.length, {
      min: 1,
      max: 6,
      description: 'X length as a multiple of the depth',
    });
    // Built in a unit space (depth 1, height 1, length `params.length`) and scaled by the parameters.
    const stretch = params.length;
    kit.group('bush', {
      transform: {
        scale: [mul(size, length, 1 / stretch), mul(size, height), size],
      },
    });
    kit.material('leaf', { color: params.leafColor, roughness: 0.85, flatShading: true });
    kit.material('leafDark', {
      color: tint(params.leafColor, 0.78),
      roughness: 0.85,
      flatShading: true,
    });
    for (const key of ['A', 'B'])
      kit.geometry(`clump${key}`, {
        type: 'mesh',
        ...lump(random.fork(`clump${key}`), {
          detail: 1,
          roughness: 0.3,
          frequency: 1.8,
          facets: 0,
          floor: -0.7,
        }),
      });
    const clumps = random.fork('clumps');
    const placed: { x: number; y: number; z: number; r: number }[] = [];
    for (let i = 0; i < params.clumps; i++) {
      const t = params.clumps === 1 ? 0.5 : i / (params.clumps - 1);
      // A clipped hedge (core) wears small clumps on its top and long sides; a shrub piles
      // larger clumps inside its unit box.
      const r = params.core ? clumps.range(0.22, 0.3) : clumps.range(0.3, 0.42);
      const x = (t - 0.5) * (stretch - 2 * r) + clumps.range(-0.08, 0.08);
      const face = i % 3;
      const z = !params.core
        ? clumps.range(-0.5 + r, 0.5 - r) * 0.9
        : face === 0
          ? clumps.range(-0.25, 0.25)
          : (face === 1 ? 1 : -1) * (0.42 - r * 0.45);
      const y = !params.core
        ? clumps.range(0, Math.max(0, 1 - 2 * r)) * 0.8
        : (face === 0 ? 0.88 - r * 0.35 : clumps.range(0.3, 0.68)) - r * 0.95;
      placed.push({ x, y, z, r });
      kit.mesh(
        `clump${i + 1}`,
        `clump${clumps.pick(['A', 'B'])}`,
        i % 3 === 2 ? 'leafDark' : 'leaf',
        {
          parent: 'bush',
          tags: ['foliage'],
          transform: {
            position: [x, y, z],
            rotation: [0, clumps.range(0, 360), 0],
            scale: [2 * r, 2 * r * 0.95, 2 * r],
          },
        },
      );
    }
    if (params.core) {
      kit.geometry('core', { type: 'box', size: [stretch - 0.12, 0.86, 0.8] });
      kit.mesh('core', 'core', 'leafDark', {
        parent: 'bush',
        tags: ['foliage'],
        transform: { position: [0, 0.43, 0] },
      });
    }
    if (params.flowers) {
      kit.geometry('flower', { type: 'sphere', radius: 0.045, segments: 6 });
      kit.material('flower', { color: params.flowerColor, roughness: 0.6, flatShading: true });
      const blossoms = random.fork('flowers');
      for (let i = 0; i < params.flowers; i++) {
        const clump = blossoms.pick(placed);
        const yaw = blossoms.range(0, Math.PI * 2),
          rise = blossoms.range(0.15, 1.2);
        const reach = clump.r * 0.98;
        kit.mesh(`flower${i + 1}`, 'flower', 'flower', {
          parent: 'bush',
          tags: ['flower'],
          transform: {
            position: [
              clump.x + Math.cos(yaw) * Math.cos(rise) * reach,
              clump.y + clump.r * 0.95 + Math.sin(rise) * reach,
              clump.z + Math.sin(yaw) * Math.cos(rise) * reach,
            ],
          },
        });
      }
    }
    return kit.finish({ id, name, category: 'nature' });
  },
});
