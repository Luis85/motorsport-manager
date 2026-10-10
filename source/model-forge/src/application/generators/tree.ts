import { z } from 'zod';
import { Color } from '../../kernel/index.js';
import { ModelKit, div } from './kit.js';
import { buildConifer, buildDeciduous, buildDead, buildPalm } from './tree-parts.js';
import { defineGenerator } from './types.js';

export const treeKinds = ['deciduous', 'conifer', 'palm', 'dead'] as const;
const parameters = z.strictObject({
  kind: z.enum(treeKinds).default('deciduous').describe('Tree form'),
  height: z.number().min(1).max(30).default(6).describe('Height in meters (model parameter)'),
  trunkRadius: z.number().min(0.03).max(1.5).default(0.2).describe('Trunk base radius in meters'),
  canopyRadius: z
    .number()
    .min(0.3)
    .max(8)
    .default(2)
    .describe('Crown radius in meters (deciduous, conifer, palm frond length)'),
  lean: z.number().min(0).max(0.3).default(0.05).describe('Trunk lean as a fraction of height'),
  clusters: z.int().min(1).max(12).default(7).describe('Deciduous: foliage clumps'),
  tiers: z.int().min(2).max(9).default(6).describe('Conifer: stacked foliage cones'),
  fronds: z.int().min(4).max(16).default(10).describe('Palm: fronds in the crown'),
  branches: z.int().min(0).max(10).default(6).describe('Dead: bare branches'),
  barkColor: Color.default('#6b4a32').describe('Trunk color #rrggbb'),
  leafColor: Color.default('#4f8a3a').describe('Foliage color #rrggbb'),
});
export type TreeParameters = z.output<typeof parameters>;

/** Stylized low-poly trees in four forms, rooted at the origin. */
export const tree = defineGenerator({
  id: 'tree',
  version: 1,
  category: 'nature',
  description:
    'A seeded low-poly tree rooted at the origin: deciduous (clumped crown), conifer (stacked cones), palm (curved trunk and drooping fronds) or dead (bare branches). height and canopy stay editable.',
  parameters,
  presets: {
    deciduous: {
      description: 'A broadleaf tree with a round, clumped crown (6 m).',
      parameters: { kind: 'deciduous' },
    },
    conifer: {
      description: 'A fir with stacked, narrowing cones (9 m).',
      parameters: {
        kind: 'conifer',
        height: 9,
        trunkRadius: 0.22,
        canopyRadius: 2.2,
        barkColor: '#5a3e2b',
        leafColor: '#2f5e3a',
      },
    },
    palm: {
      description: 'A leaning palm with a curved trunk and drooping fronds (7 m).',
      parameters: {
        kind: 'palm',
        height: 7,
        trunkRadius: 0.16,
        canopyRadius: 3.2,
        lean: 0.14,
        barkColor: '#8a6e4e',
        leafColor: '#5f9a3c',
      },
    },
    dead: {
      description: 'A leafless, weathered tree with bare branches (5 m).',
      parameters: { kind: 'dead', height: 5, trunkRadius: 0.2, barkColor: '#6e6259' },
    },
  },
  defaultPreset: 'deciduous',
  limits: { maxTriangles: 12000 },
  build({ id, name, params, random }) {
    const kit = new ModelKit();
    const height = kit.param('height', params.height, {
      min: 1,
      max: 40,
      description: 'Overall height in meters (scales the whole tree)',
    });
    const s = div(height, params.height);
    kit.group('tree', { transform: { scale: [s, s, s] } });
    kit.material('bark', { color: params.barkColor, roughness: 0.95, flatShading: true });
    if (params.kind !== 'dead') {
      kit.param('canopy', 1, {
        min: 0.5,
        max: 2,
        description: 'Crown scale relative to the generated crown',
      });
      kit.material('leaf', { color: params.leafColor, roughness: 0.85, flatShading: true });
    }
    const build = {
      deciduous: buildDeciduous,
      conifer: buildConifer,
      palm: buildPalm,
      dead: buildDead,
    };
    build[params.kind](kit, params, random);
    return kit.finish({ id, name, category: 'nature' });
  },
});
