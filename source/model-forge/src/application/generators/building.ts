import { z } from 'zod';
import { Color, type ScalarValue, type V3 } from '../../kernel/index.js';
import { ModelKit, add, div, half, mul, neg, shade, smallest, sub, tint } from './kit.js';
import { defineGenerator } from './types.js';

const parameters = z.strictObject({
  floors: z.int().min(1).max(12).default(2).describe('Storeys (model parameter)'),
  bays: z.int().min(2).max(12).default(3).describe('Window bays along the front (model parameter)'),
  floorHeight: z
    .number()
    .min(2.4)
    .max(8)
    .default(3)
    .describe('Storey height in meters (model parameter)'),
  bayWidth: z.number().min(1.8).max(6).default(3).describe('Bay width in meters (model parameter)'),
  depth: z.number().min(4).max(30).default(8).describe('Depth in meters (model parameter)'),
  roof: z.enum(['gable', 'flat']).default('gable').describe('Roof form'),
  roofHeight: z
    .number()
    .min(0.5)
    .max(8)
    .default(2.5)
    .describe('Gable ridge height in meters (model parameter for gable roofs)'),
  sideWindows: z.int().min(0).max(8).default(2).describe('Window columns on each gable end'),
  chimney: z.boolean().default(true).describe('A chimney on a gable roof'),
  wallColor: Color.default('#d8c7a6').describe('Wall color #rrggbb'),
  roofColor: Color.default('#9b3b2e').describe('Roof color #rrggbb'),
  trimColor: Color.default('#f2efe8').describe('Window frame and trim color #rrggbb'),
  glassColor: Color.default('#3a5468').describe('Glass color #rrggbb'),
  doorColor: Color.default('#5b3a26').describe('Door color #rrggbb'),
});

/** Box-massed buildings: windows by floor and bay patterns, gable or flat roof. */
export const building = defineGenerator({
  id: 'building',
  version: 1,
  category: 'architecture',
  description:
    'A building centered on the origin, front facing +Z: storeys and bays as grid patterns of framed windows, a door, a plinth and an eave band, and a gable roof extruded from its profile (or a flat roof). floors, bays, floorHeight, bayWidth, depth and roofHeight stay editable.',
  parameters,
  presets: {
    cottage: {
      description: 'A one-storey cottage with a steep red roof and chimney (7.8 x 6.5 m).',
      parameters: {
        floors: 1,
        bays: 3,
        floorHeight: 2.8,
        bayWidth: 2.6,
        depth: 6.5,
        roofHeight: 2.8,
        sideWindows: 1,
        wallColor: '#ebdfc6',
        roofColor: '#8f3a2c',
      },
    },
    townhouse: {
      description: 'A three-storey brick townhouse with a slate roof (8.4 x 9 m).',
      parameters: {
        floors: 3,
        bays: 3,
        floorHeight: 3.1,
        bayWidth: 2.8,
        depth: 9,
        roofHeight: 2.4,
        sideWindows: 2,
        wallColor: '#a5553a',
        roofColor: '#4a4f57',
        doorColor: '#26384a',
      },
    },
    warehouse: {
      description: 'A tall single-storey steel warehouse with a flat roof (24 x 16 m).',
      parameters: {
        floors: 1,
        bays: 6,
        floorHeight: 6,
        bayWidth: 4,
        depth: 16,
        roof: 'flat',
        sideWindows: 3,
        chimney: false,
        wallColor: '#8d969c',
        roofColor: '#5c6166',
        trimColor: '#c9ced2',
        glassColor: '#2f3b45',
        doorColor: '#3f6b8a',
      },
    },
  },
  defaultPreset: 'cottage',
  limits: { maxTriangles: 40000 },
  build({ id, name, params, random }) {
    const kit = new ModelKit();
    const floors = kit.param('floors', params.floors, {
      min: 1,
      max: 12,
      integer: true,
      description: 'Number of storeys',
    });
    const bays = kit.param('bays', params.bays, {
      min: 2,
      max: 12,
      integer: true,
      description: 'Window bays along the front',
    });
    const fh = kit.param('floorHeight', params.floorHeight, {
      min: 2.4,
      max: 8,
      description: 'Storey height in meters',
    });
    const bw = kit.param('bayWidth', params.bayWidth, {
      min: 1.8,
      max: 6,
      description: 'Bay width in meters',
    });
    const d = kit.param('depth', params.depth, { min: 4, max: 30, description: 'Depth in meters' });
    const w = mul(bays, bw),
      h = mul(floors, fh);
    const wall = shade(params.wallColor, random.fork('wall'), 0.05);
    kit.material('wall', { color: wall, roughness: 0.9 });
    kit.material('trim', { color: params.trimColor, roughness: 0.7 });
    kit.material('base', { color: tint(wall, 0.62), roughness: 0.95 });
    kit.material('glass', { color: params.glassColor, roughness: 0.15, metalness: 0.3 });
    kit.material('door', { color: params.doorColor, roughness: 0.6 });
    kit.material('roof', {
      color: shade(params.roofColor, random.fork('roof'), 0.05),
      roughness: 0.8,
      flatShading: true,
    });
    const box = (id: string, size: V3, material: string, position: V3, tags: string[]) => {
      kit.geometry(id, { type: 'box', size });
      kit.mesh(id, id, material, { tags, transform: { position } });
    };
    box('walls', [w, h, d], 'wall', [0, half(h), 0], ['wall']);
    box('plinth', [add(w, 0.12), 0.35, add(d, 0.12)], 'base', [0, 0.175, 0], ['trim']);
    box('eave', [add(w, 0.16), 0.18, add(d, 0.16)], 'trim', [0, sub(h, 0.09), 0], ['trim']);

    // Windows: one grid pattern per part and facade; counts and steps follow the parameters.
    const ww = mul(bw, 0.4),
      wh = mul(fh, 0.45),
      sill = sub(mul(fh, 0.55), add(half(wh), 0.04));
    const facade = (
      key: string,
      across: 'x' | 'z',
      origin: [ScalarValue, ScalarValue],
      outward: number,
      counts: V3,
      step: V3,
    ) => {
      const part = (
        id: string,
        size: [ScalarValue, ScalarValue, number],
        material: string,
        y: ScalarValue,
        out: number,
      ) => {
        const [wide, tall, thick] = size;
        const geometry = `${id}${across.toUpperCase()}`;
        if (!kit.hasGeometry(geometry))
          kit.geometry(geometry, {
            type: 'box',
            size: across === 'x' ? [wide, tall, thick] : [thick, tall, wide],
          });
        const position: V3 =
          across === 'x'
            ? [origin[0], y, add(origin[1], outward * out)]
            : [add(origin[0], outward * out), y, origin[1]];
        kit.mesh(`${id}${key}`, geometry, material, {
          tags: ['window'],
          transform: { position },
          pattern: { type: 'grid', counts, step },
        });
      };
      const centre = mul(fh, 0.55);
      part('frame', [add(ww, 0.16), add(wh, 0.16), 0.08], 'trim', centre, 0);
      part('glass', [ww, wh, 0.1], 'glass', centre, 0);
      part('mullion', [0.06, wh, 0.14], 'trim', centre, 0);
      part('transom', [ww, 0.06, 0.14], 'trim', centre, 0);
      part('sill', [add(ww, 0.3), 0.08, 0.24], 'trim', sill, 0.06);
    };
    const firstBay = add(neg(half(w)), half(bw));
    facade('Front', 'x', [firstBay, half(d)], 1, [bays, floors, 1], [bw, fh, 0]);
    facade('Back', 'x', [firstBay, neg(half(d))], -1, [bays, floors, 1], [bw, fh, 0]);
    if (params.sideWindows) {
      const n = params.sideWindows,
        first = add(neg(half(d)), div(d, 2 * n));
      facade('Right', 'z', [half(w), first], 1, [1, floors, n], [0, fh, div(d, n)]);
      facade('Left', 'z', [neg(half(w)), first], -1, [1, floors, n], [0, fh, div(d, n)]);
    }

    // The door stands between the first two bays, clear of their windows.
    const dw = mul(bw, 0.32),
      dh = smallest(2.3, mul(fh, 0.78));
    const doorX = add(neg(half(w)), bw);
    box(
      'doorFrame',
      [add(dw, 0.2), add(dh, 0.1), 0.1],
      'trim',
      [doorX, half(add(dh, 0.1)), half(d)],
      ['door'],
    );
    box('door', [dw, dh, 0.14], 'door', [doorX, half(dh), half(d)], ['door']);
    box('step', [add(dw, 0.6), 0.16, 0.5], 'base', [doorX, 0.08, add(half(d), 0.25)], ['door']);

    if (params.roof === 'gable') {
      const rh = kit.param('roofHeight', params.roofHeight, {
        min: 0.5,
        max: 8,
        description: 'Gable ridge height above the eaves in meters',
      });
      const o = 0.4,
        t = 0.22,
        slope = div(rh, half(w)),
        drop = neg(mul(slope, o)),
        eave = add(half(w), o);
      kit.geometry('gable', {
        type: 'extrude',
        points: [
          [neg(half(w)), 0],
          [half(w), 0],
          [0, rh],
        ],
        depth: d,
      });
      kit.mesh('gable', 'gable', 'wall', {
        tags: ['wall'],
        transform: { position: [0, h, neg(half(d))] },
      });
      kit.geometry('roof', {
        type: 'extrude',
        points: [
          [neg(eave), drop],
          [neg(eave), add(drop, t)],
          [0, add(rh, t)],
          [eave, add(drop, t)],
          [eave, drop],
          [0, rh],
        ],
        depth: add(d, 2 * o),
      });
      kit.mesh('roof', 'roof', 'roof', {
        tags: ['roof'],
        transform: { position: [0, h, neg(add(half(d), o))] },
      });
      if (params.chimney) {
        const tall = add(mul(rh, 0.1), 1);
        kit.material('chimney', { color: tint(wall, 0.75), roughness: 0.95 });
        box(
          'chimney',
          [0.7, tall, 0.7],
          'chimney',
          [mul(w, 0.25), add(h, mul(rh, 0.4), half(tall)), mul(d, -0.15)],
          ['roof'],
        );
      }
    } else box('roof', [add(w, 0.3), 0.3, add(d, 0.3)], 'roof', [0, add(h, 0.15), 0], ['roof']);
    return kit.finish({ id, name, category: 'architecture' });
  },
});
