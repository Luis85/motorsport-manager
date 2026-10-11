import { z } from 'zod';
import { Color, type ScalarValue, type V3 } from '../../kernel/index.js';
import { ModelKit, add, div, half, mul, neg, shade, sub, tint } from './kit.js';
import { defineGenerator } from './types.js';

const parameters = z.strictObject({
  width: z.number().min(0.2).max(4).default(0.8).describe('X size in meters (model parameter)'),
  height: z.number().min(0.2).max(4).default(0.8).describe('Y size in meters (model parameter)'),
  depth: z.number().min(0.2).max(4).default(0.8).describe('Z size in meters (model parameter)'),
  frame: z
    .number()
    .min(0.02)
    .max(0.2)
    .default(0.07)
    .describe('Edge beam thickness in meters (model parameter)'),
  planks: z.int().min(1).max(8).default(4).describe('Horizontal planks per side'),
  handles: z.boolean().default(false).describe('Hand grips on the X sides'),
  woodColor: Color.default('#a0703c').describe('Panel color #rrggbb'),
  frameColor: Color.default('#6e4a26').describe('Edge beam color #rrggbb'),
  metal: z.boolean().default(false).describe('Metallic edge beams'),
});

/** Framed boxes: shipping crates, military cases and small boxes. */
export const crate = defineGenerator({
  id: 'crate',
  version: 1,
  category: 'props',
  description:
    'A framed crate resting on y = 0: inset plank panels with grooves, twelve edge beams and optional hand grips. width, height, depth and frame stay editable.',
  parameters,
  presets: {
    wooden: {
      description: 'A pine shipping crate (80 cm cube).',
      parameters: {},
    },
    military: {
      description: 'An olive ammunition case with steel edges and grips (1.1 x 0.5 x 0.6 m).',
      parameters: {
        width: 1.1,
        height: 0.5,
        depth: 0.6,
        frame: 0.04,
        planks: 2,
        handles: true,
        woodColor: '#56603a',
        frameColor: '#3b3f3a',
        metal: true,
      },
    },
    small: {
      description: 'A small fruit box (40 x 30 x 30 cm).',
      parameters: {
        width: 0.4,
        height: 0.3,
        depth: 0.3,
        frame: 0.03,
        planks: 3,
        woodColor: '#c39a62',
        frameColor: '#9a7444',
      },
    },
  },
  defaultPreset: 'wooden',
  limits: { maxTriangles: 2000 },
  build({ id, name, params, random }) {
    const kit = new ModelKit();
    const dimension = (key: 'width' | 'height' | 'depth', axis: string) =>
      kit.param(key, params[key], { min: 0.2, max: 4, description: `${axis} size in meters` });
    const w = dimension('width', 'X'),
      h = dimension('height', 'Y'),
      d = dimension('depth', 'Z');
    const f = kit.param('frame', params.frame, {
      min: 0.02,
      max: 0.2,
      description: 'Edge beam thickness in meters',
    });
    const wood = shade(params.woodColor, random.fork('color'), 0.06);
    kit.material('wood', { color: wood, roughness: 0.82 });
    kit.material('frame', {
      color: params.frameColor,
      roughness: params.metal ? 0.45 : 0.85,
      metalness: params.metal ? 0.6 : 0,
    });
    kit.material('groove', { color: tint(wood, 0.55), roughness: 0.9 });
    kit.group('crate', { transform: { position: [0, half(h), 0] } });
    const inset = mul(f, 0.5);
    kit.geometry('panel', { type: 'box', size: [sub(w, inset), sub(h, inset), sub(d, inset)] });
    kit.mesh('panel', 'panel', 'wood', { parent: 'crate', tags: ['panel'] });
    // Twelve edge beams: four along each axis, flush with the outer faces.
    const along = { x: w, y: h, z: d } as const;
    const offset = (size: ScalarValue) => half(sub(size, f));
    for (const axis of ['x', 'y', 'z'] as const) {
      const size: V3 = [axis === 'x' ? w : f, axis === 'y' ? h : f, axis === 'z' ? d : f];
      kit.geometry(`beam${axis.toUpperCase()}`, { type: 'box', size });
      const others = (['x', 'y', 'z'] as const).filter((other) => other !== axis);
      for (const [i, [a, b]] of [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ].entries()) {
        const position: Record<string, ScalarValue> = { x: 0, y: 0, z: 0 };
        position[others[0]] = mul(a, offset(along[others[0]]));
        position[others[1]] = mul(b, offset(along[others[1]]));
        kit.mesh(`beam${axis.toUpperCase()}${i + 1}`, `beam${axis.toUpperCase()}`, 'frame', {
          parent: 'crate',
          tags: ['frame'],
          transform: { position: [position.x, position.y, position.z] },
        });
      }
    }
    // Grooves between planks on the four sides: thin dark strips, evenly spaced.
    if (params.planks > 1) {
      const span = sub(h, mul(f, 2)),
        step = div(span, params.planks);
      const first = add(neg(half(span)), step);
      const grooves: [string, V3, V3][] = [
        ['Front', [sub(w, mul(f, 2)), 0.012, 0.01], [0, first, half(sub(d, inset))]],
        ['Back', [sub(w, mul(f, 2)), 0.012, 0.01], [0, first, neg(half(sub(d, inset)))]],
        ['Right', [0.01, 0.012, sub(d, mul(f, 2))], [half(sub(w, inset)), first, 0]],
        ['Left', [0.01, 0.012, sub(d, mul(f, 2))], [neg(half(sub(w, inset))), first, 0]],
      ];
      for (const [side, size, position] of grooves) {
        kit.geometry(`groove${side}`, { type: 'box', size });
        kit.mesh(`groove${side}`, `groove${side}`, 'groove', {
          parent: 'crate',
          tags: ['groove'],
          transform: { position },
          pattern: { type: 'linear', count: params.planks - 1, step: [0, step, 0] },
        });
      }
    }
    if (params.handles) {
      kit.geometry('handle', { type: 'box', size: [0.04, 0.05, mul(d, 0.35)] });
      for (const [side, sign] of [
        ['Right', 1],
        ['Left', -1],
      ] as const)
        kit.mesh(`handle${side}`, 'handle', 'frame', {
          parent: 'crate',
          tags: ['handle'],
          transform: { position: [mul(sign, add(half(w), 0.015)), mul(h, 0.22), 0] },
        });
    }
    return kit.finish({ id, name, category: 'props' });
  },
});
