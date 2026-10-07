import {
  p,
  add,
  sub,
  mul,
  div,
  param,
  material,
  box,
  cylinder,
  sphere,
  tube,
  mesh,
  instance,
  model,
  scene,
} from './recipe.mjs';
const windowBay = model(
  'windowBay',
  'Framed window',
  { width: param(1, 0.5, 2, 'Window width'), height: param(1.3, 0.7, 2, 'Window height') },
  {
    trim: material('#eee2c7'),
    pane: material('#345967', { metalness: 0.25 }),
    sill: material('#a8987b'),
  },
  {
    pane: box(p('width'), p('height'), 0.08),
    side: box(0.075, add(p('height'), 0.15), 0.12),
    horizontal: box(add(p('width'), 0.15), 0.075, 0.12),
    mullion: box(0.05, p('height'), 0.13),
    sill: box(add(p('width'), 0.32), 0.11, 0.28),
  },
  [
    mesh('glass', 'pane', 'pane'),
    mesh('frameSides', 'side', 'trim', [mul(p('width'), -0.5), 0, 0.03], {
      pattern: { type: 'linear', count: 2, step: [p('width'), 0, 0] },
    }),
    mesh('frameCross', 'horizontal', 'trim', [0, mul(p('height'), -0.5), 0.03], {
      pattern: { type: 'linear', count: 2, step: [0, p('height'), 0] },
    }),
    mesh('mullion', 'mullion', 'trim', [0, 0, 0.06]),
    mesh('sill', 'sill', 'sill', [0, sub(mul(p('height'), -0.5), 0.1), 0.08]),
  ],
);
const w = p('width'),
  d = p('depth'),
  h = mul(p('floors'), 2.6),
  pitch = div(w, p('bays'));
const townhouse = model(
  'townhouse',
  'Modular townhouse',
  {
    width: param(4.8, 3.2, 8, 'Facade width in meters'),
    depth: param(3.5, 2, 6, 'Building depth'),
    floors: param(3, 2, 5, 'Number of floors', true),
    bays: param(3, 2, 5, 'Window columns', true),
  },
  {
    wall: material('#c88569'),
    trim: material('#ead7b2'),
    roof: material('#694c4a'),
    door: material('#40565b'),
    awning: material('#315e60'),
  },
  {
    body: box(w, h, d),
    cornice: box(add(w, 0.2), 0.13, add(d, 0.14)),
    roof: {
      type: 'extrude',
      points: [
        [mul(w, -0.5), 0],
        [mul(w, 0.5), 0],
        [0, mul(w, 0.32)],
      ],
      depth: add(d, 0.5),
    },
    door: box(0.95, 2.05, 0.13),
    doorFrame: box(1.2, 2.25, 0.1),
    step: box(1.65, 0.14, 0.65),
    canopy: box(mul(w, 0.76), 0.12, 1.0),
    shopSign: box(mul(w, 0.76), 0.35, 0.1),
    chimney: box(0.42, 1.3, 0.45),
  },
  [
    mesh('walls', 'body', 'wall', [0, div(h, 2), 0]),
    mesh('floorBands', 'cornice', 'trim', [0, 2.6, 0], {
      pattern: { type: 'linear', count: p('floors'), step: [0, 2.6, 0] },
    }),
    mesh('roof', 'roof', 'roof', [0, h, sub(mul(d, -0.5), 0.25)]),
    mesh('chimney', 'chimney', 'trim', [mul(w, 0.25), add(h, mul(w, 0.15)), -0.7]),
    instance(
      'upperWindows',
      'windowBay',
      [add(mul(w, -0.5), div(pitch, 2)), 3.85, add(div(d, 2), 0.07)],
      {
        parameters: { width: mul(pitch, 0.58), height: 1.4 },
        pattern: {
          type: 'grid',
          counts: [p('bays'), sub(p('floors'), 1), 1],
          step: [pitch, 2.6, 0],
        },
      },
    ),
    instance('shopWindows', 'windowBay', [mul(w, -0.32), 1.3, add(div(d, 2), 0.07)], {
      parameters: { width: mul(w, 0.19), height: 1.4 },
      pattern: { type: 'linear', count: 2, step: [mul(w, 0.64), 0, 0] },
    }),
    mesh('doorSurround', 'doorFrame', 'trim', [0, 1.125, add(div(d, 2), 0.06)]),
    mesh('door', 'door', 'door', [0, 1.025, add(div(d, 2), 0.13)]),
    mesh('step', 'step', 'trim', [0, 0.07, add(div(d, 2), 0.4)]),
    mesh('awning', 'canopy', 'awning', [0, 2.32, add(div(d, 2), 0.5)]),
    mesh('sign', 'shopSign', 'awning', [0, 2.14, add(div(d, 2), 0.98)]),
  ],
);
const tree = model(
  'planterTree',
  'Planter tree',
  { height: param(3.4, 2, 5, 'Overall height'), crown: param(1.1, 0.6, 1.8, 'Crown radius') },
  {
    stone: material('#bca98b'),
    earth: material('#564938'),
    wood: material('#735444'),
    leaf: material('#628260', { flatShading: true }),
    lightLeaf: material('#8c9c6a', { flatShading: true }),
  },
  {
    planter: box(1.1, 0.5, 1.1),
    soil: box(0.94, 0.02, 0.94),
    trunk: cylinder(0.11, mul(p('height'), 0.58), 8),
    crown: sphere(p('crown'), 12),
  },
  [
    mesh('planter', 'planter', 'stone', [0, 0.25, 0]),
    mesh('soil', 'soil', 'earth', [0, 0.51, 0]),
    mesh('trunk', 'trunk', 'wood', [0, add(0.5, mul(p('height'), 0.29)), 0]),
    mesh('crown', 'crown', 'leaf', [0, mul(p('height'), 0.72), 0], {
      transform: { position: [0, mul(p('height'), 0.72), 0], scale: [1, 1.05, 1] },
    }),
    mesh('crownTop', 'crown', 'lightLeaf', [0, mul(p('height'), 0.9), 0], {
      transform: { position: [0.2, mul(p('height'), 0.88), 0.05], scale: [0.72, 0.72, 0.72] },
    }),
  ],
);
const bench = model(
  'parkBench',
  'Slatted park bench',
  { width: param(1.8, 1, 3, 'Seat width') },
  { wood: material('#b77d49'), metal: material('#425153', { metalness: 0.6 }) },
  {
    slat: box(p('width'), 0.07, 0.095),
    back: box(p('width'), 0.09, 0.07),
    leg: box(0.07, 0.65, 0.07),
    backPost: box(0.055, 0.8, 0.055),
  },
  [
    mesh('slats', 'slat', 'wood', [0, 0.57, -0.22], {
      pattern: { type: 'linear', count: 5, step: [0, 0, 0.11] },
    }),
    mesh('legs', 'leg', 'metal', [0, 0.325, 0], {
      pattern: {
        type: 'grid',
        counts: [2, 1, 2],
        centered: true,
        step: [sub(p('width'), 0.3), 0, 0.4],
      },
    }),
    mesh('backPosts', 'backPost', 'metal', [mul(p('width'), -0.4), 0.72, -0.25], {
      pattern: { type: 'linear', count: 2, step: [mul(p('width'), 0.8), 0, 0] },
    }),
    mesh('backSlats', 'back', 'wood', [0, 0.83, -0.25], {
      pattern: { type: 'linear', count: 3, step: [0, 0.14, 0] },
    }),
  ],
);
const fountain = model(
  'fountain',
  'Courtyard fountain',
  { radius: param(1.7, 1, 3, 'Basin radius') },
  {
    stone: material('#c8baa1'),
    water: material('#5caaa5', { roughness: 0.28 }),
    metal: material('#477c74'),
  },
  {
    base: cylinder(add(p('radius'), 0.15), 0.18, 48),
    bowl: {
      type: 'lathe',
      segments: 48,
      points: [
        [0, 0.08],
        [p('radius'), 0.08],
        [p('radius'), 0.6],
        [sub(p('radius'), 0.15), 0.64],
        [sub(p('radius'), 0.2), 0.24],
        [0, 0.24],
      ],
    },
    water: cylinder(sub(p('radius'), 0.21), 0.025, 48),
    column: cylinder(0.16, 1.25),
    orb: sphere(0.3, 24),
    jet: tube(
      [
        [0, 1.55, 0],
        [0.45, 1.45, 0],
        [0.9, 0.8, 0],
        [1.15, 0.37, 0],
      ],
      0.028,
      { tubularSegments: 24, radialSegments: 6 },
    ),
  },
  [
    mesh('base', 'base', 'stone', [0, 0.09, 0]),
    mesh('basin', 'bowl', 'stone'),
    mesh('water', 'water', 'water', [0, 0.36, 0]),
    mesh('column', 'column', 'metal', [0, 0.825, 0]),
    mesh('orb', 'orb', 'stone', [0, 1.6, 0]),
    mesh('jets', 'jet', 'water', [0, 0, 0], { pattern: { type: 'radial', count: 6, radius: 0 } }),
  ],
);
export const courtyard = {
  models: [windowBay, townhouse, tree, bench, fountain],
  scene: scene(
    'courtyard',
    'The Linden Courtyard',
    {
      paving: material('#bcad94'),
      stone: material('#a09584'),
      blue: material('#779494'),
      cream: material('#d5b98b'),
      line: material('#d8cbb1'),
    },
    { ground: box(23, 0.3, 18), plaza: cylinder(3.1, 0.045, 64), joint: box(0.018, 0.01, 18) },
    [
      mesh('ground', 'ground', 'paving', [0, -0.15, 0]),
      mesh('plaza', 'plaza', 'stone', [2, 0.023, 2.6]),
      mesh('pavingJoints', 'joint', 'line', [-10.5, 0.01, 0], {
        pattern: { type: 'linear', count: 22, step: [1, 0, 0] },
      }),
      instance('copperHouse', 'townhouse', [-6, 0, -4.3], {
        tags: ['buildings'],
        parameters: { floors: 3, width: 4.8 },
      }),
      instance('blueHouse', 'townhouse', [-0.65, 0, -4.3], {
        tags: ['buildings'],
        parameters: { floors: 4, width: 4.6, bays: 3 },
        materialOverrides: { wall: 'blue' },
      }),
      instance('creamHouse', 'townhouse', [4.65, 0, -4.3], {
        tags: ['buildings'],
        parameters: { floors: 2, width: 4.9, bays: 3 },
        materialOverrides: { wall: 'cream' },
      }),
      instance('fountain', 'fountain', [2, 0, 2.6], { tags: ['landscape'] }),
      instance('avenueTrees', 'planterTree', [0, 0, 0], {
        tags: ['landscape'],
        pattern: {
          type: 'path',
          points: [
            [-9.7, 0, -2],
            [-9.7, 0, 2],
            [-9.7, 0, 6],
            [9.2, 0, -2],
            [9.2, 0, 2],
            [9.2, 0, 6],
          ],
        },
      }),
      instance('benches', 'parkBench', [-2.8, 0, 5.3], {
        pattern: { type: 'linear', count: 3, step: [3.2, 0, 0] },
        tags: ['furniture'],
      }),
    ],
  ),
  features: [
    'Nested facade modules',
    'Integer floor and window counts',
    'Parameter-driven grids',
    'Path planting',
    'Lathed fountain and spline jets',
  ],
  description:
    'A small architectural scene assembled from parametric townhouses, framed windows, street furniture and landscape models.',
};
