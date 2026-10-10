import { z } from 'zod';
import { fail, Color } from '../../kernel/index.js';
import { ModelKit, add, div, half, mul, neg, shade, sub, tint } from './kit.js';
import { defineGenerator } from './types.js';

const MAX_PATTERN = 256;
const parameters = z.strictObject({
  posts: z.int().min(2).max(64).default(6).describe('Posts along X (model parameter)'),
  spacing: z
    .number()
    .min(0.2)
    .max(5)
    .default(2)
    .describe('Post spacing in meters (model parameter)'),
  height: z
    .number()
    .min(0.3)
    .max(4)
    .default(1.1)
    .describe('Post height in meters (model parameter)'),
  post: z.number().min(0.04).max(0.5).default(0.1).describe('Post width in meters'),
  round: z.boolean().default(false).describe('Round logs instead of square posts'),
  pointed: z.boolean().default(false).describe('Pointed post tops'),
  rails: z.int().min(0).max(4).default(2).describe('Horizontal rails between the posts'),
  pickets: z.int().min(0).max(12).default(0).describe('Pointed pickets per span between posts'),
  color: Color.default('#d9d2c3').describe('Wood or paint color #rrggbb'),
});

/** Straight fence runs along X, centered on the origin: picket, ranch and palisade. */
export const fence = defineGenerator({
  id: 'fence',
  version: 1,
  category: 'architecture',
  description:
    'A straight fence run along X, centered on the origin and standing on y = 0: posts as a linear pattern, rails and optional pickets. posts, spacing and height stay editable model parameters (posts is an integer).',
  parameters,
  presets: {
    picket: {
      description: 'A white garden picket fence (5 spans of 2 m, 1.1 m high).',
      parameters: { pickets: 8, rails: 2, pointed: true },
    },
    ranch: {
      description: 'A brown three-rail ranch fence (4 spans of 2.5 m, 1.3 m high).',
      parameters: {
        posts: 5,
        spacing: 2.5,
        height: 1.3,
        post: 0.14,
        rails: 3,
        color: '#7a5634',
      },
    },
    palisade: {
      description: 'A stockade of pointed round logs (24 logs, 2.4 m high).',
      parameters: {
        posts: 24,
        spacing: 0.3,
        height: 2.4,
        post: 0.28,
        round: true,
        pointed: true,
        rails: 1,
        color: '#8a6a48',
      },
    },
  },
  defaultPreset: 'picket',
  limits: { maxTriangles: 24000 },
  build({ id, name, params, random }) {
    const postMax = Math.min(64, Math.floor((MAX_PATTERN - 1) / (params.pickets + 1)) + 1);
    if (params.posts > postMax)
      fail(
        'PARAMETER_RANGE',
        `With ${params.pickets} pickets per span, posts may be at most ${postMax}.`,
        {
          parameter: 'posts',
          max: postMax,
          hint: `A pattern holds at most ${MAX_PATTERN} copies: lower posts or pickets.`,
        },
      );
    const kit = new ModelKit();
    const posts = kit.param('posts', params.posts, {
      min: 2,
      max: postMax,
      integer: true,
      description: 'Number of posts along X',
    });
    const spacing = kit.param('spacing', params.spacing, {
      min: 0.2,
      max: 5,
      description: 'Distance between post centers in meters',
    });
    const height = kit.param('height', params.height, {
      min: 0.3,
      max: 4,
      description: 'Post height in meters',
    });
    const color = shade(params.color, random.fork('color'), 0.05);
    kit.material('wood', { color, roughness: 0.85, flatShading: true });
    kit.material('rail', { color: tint(color, 0.9), roughness: 0.85 });
    const length = mul(sub(posts, 1), spacing);
    kit.group('fence', { transform: { position: [neg(half(length)), 0, 0] } });
    const w = params.post;
    const cap = params.pointed ? w * (params.round ? 1.1 : 0.8) : 0;
    const shaft = sub(height, cap);
    kit.geometry(
      'post',
      params.round
        ? { type: 'cylinder', radiusTop: w / 2, radiusBottom: w / 2, height: shaft, segments: 7 }
        : { type: 'box', size: [w, shaft, w] },
    );
    kit.mesh('posts', 'post', 'wood', {
      parent: 'fence',
      tags: ['post'],
      transform: { position: [0, half(shaft), 0] },
      pattern: { type: 'linear', count: posts, step: [spacing, 0, 0] },
    });
    if (cap) {
      // Square posts get a four-sided pyramid aligned with their faces; logs a cone.
      const r = w / 2;
      kit.geometry(
        'cap',
        params.round
          ? { type: 'cone', radius: r, height: cap, segments: 7 }
          : {
              type: 'mesh',
              positions: [
                [-r, -cap / 2, -r],
                [r, -cap / 2, -r],
                [r, -cap / 2, r],
                [-r, -cap / 2, r],
                [0, cap / 2, 0],
              ],
              indices: [0, 1, 2, 0, 2, 3, 0, 4, 1, 1, 4, 2, 2, 4, 3, 3, 4, 0],
              uvs: [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 1],
                [0.5, 0.5],
              ],
            },
      );
      kit.mesh('caps', 'cap', 'wood', {
        parent: 'fence',
        tags: ['post'],
        transform: { position: [0, add(shaft, cap / 2), 0] },
        pattern: { type: 'linear', count: posts, step: [spacing, 0, 0] },
      });
    }
    const railDepth = params.round ? w * 0.35 : w * 0.45;
    for (let i = 0; i < params.rails; i++) {
      const at = params.rails === 1 ? 0.6 : 0.25 + (0.55 * i) / (params.rails - 1);
      kit.geometry(`rail${i + 1}`, { type: 'box', size: [length, w * 0.7, railDepth] });
      kit.mesh(`rail${i + 1}`, `rail${i + 1}`, 'rail', {
        parent: 'fence',
        tags: ['rail'],
        transform: {
          position: [
            half(length),
            mul(height, at),
            (params.round ? -1 : 1) * (w / 2 + railDepth / 2),
          ],
        },
      });
    }
    if (params.pickets) {
      const board = 0.08,
        tall = mul(height, 0.92);
      kit.geometry('picket', {
        type: 'extrude',
        points: [
          [-board / 2, 0],
          [board / 2, 0],
          [board / 2, sub(tall, board * 0.6)],
          [0, tall],
          [-board / 2, sub(tall, board * 0.6)],
        ],
        depth: 0.02,
      });
      // One picket every spacing / (pickets + 1), the first and last on the end posts.
      kit.mesh('pickets', 'picket', 'wood', {
        parent: 'fence',
        tags: ['picket'],
        transform: { position: [0, 0, w / 2 + railDepth] },
        pattern: {
          type: 'linear',
          count: add(mul(sub(posts, 1), params.pickets + 1), 1),
          step: [div(spacing, params.pickets + 1), 0, 0],
        },
      });
    }
    return kit.finish({ id, name, category: 'architecture' });
  },
});
