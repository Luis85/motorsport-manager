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
const valve = model(
  'valve',
  'Handwheel valve',
  { radius: param(0.32, 0.15, 0.65, 'Wheel radius') },
  {
    wheel: material('#d99b3d', { metalness: 0.55 }),
    steel: material('#87959b', { metalness: 0.75 }),
  },
  {
    hub: cylinder(0.1, 0.35, 16),
    wheel: { type: 'torus', radius: p('radius'), tube: 0.035, segments: 24 },
    spoke: box(mul(p('radius'), 1.85), 0.035, 0.035),
    housing: cylinder(0.15, 0.22),
  },
  [
    mesh('housing', 'housing', 'steel', [0, 0.11, 0]),
    mesh('stem', 'hub', 'steel', [0, 0.3, 0]),
    mesh('wheel', 'wheel', 'wheel', [0, 0.49, 0], {
      transform: { position: [0, 0.49, 0], rotation: [90, 0, 0] },
    }),
    mesh('spokeX', 'spoke', 'wheel', [0, 0.49, 0]),
    mesh('spokeZ', 'spoke', 'wheel', [0, 0.49, 0], {
      transform: { position: [0, 0.49, 0], rotation: [0, 90, 0] },
    }),
  ],
);
const h = p('height'),
  r = p('radius');
const vessel = model(
  'vessel',
  'Process vessel',
  {
    height: param(4, 2.5, 6, 'Cylindrical body height'),
    radius: param(1.05, 0.65, 1.5, 'Vessel radius'),
  },
  {
    shell: material('#afc1c2', { metalness: 0.5, roughness: 0.34 }),
    band: material('#397887', { metalness: 0.35 }),
    legs: material('#4c606a', { metalness: 0.7 }),
  },
  {
    body: cylinder(r, h, 40),
    cap: sphere(r, 32),
    leg: box(0.2, 0.75, 0.2),
    foot: box(0.45, 0.1, 0.45),
    band: cylinder(add(r, 0.016), 0.22, 40),
    outlet: cylinder(0.17, 0.45),
  },
  [
    mesh('body', 'body', 'shell', [0, add(div(h, 2), 0.7), 0]),
    mesh('top', 'cap', 'shell', [0, add(h, 0.7), 0], {
      transform: { position: [0, add(h, 0.7), 0], scale: [1, 0.36, 1] },
    }),
    mesh('baseCap', 'cap', 'shell', [0, 0.7, 0], {
      transform: { position: [0, 0.7, 0], scale: [1, 0.3, 1] },
    }),
    mesh('legs', 'leg', 'legs', [0, 0.375, 0], {
      pattern: {
        type: 'grid',
        counts: [2, 1, 2],
        step: [mul(r, 1.4), 0, mul(r, 1.4)],
        centered: true,
      },
    }),
    mesh('feet', 'foot', 'legs', [0, 0.05, 0], {
      pattern: {
        type: 'grid',
        counts: [2, 1, 2],
        step: [mul(r, 1.4), 0, mul(r, 1.4)],
        centered: true,
      },
    }),
    mesh('bands', 'band', 'band', [0, add(0.7, mul(h, 0.2)), 0], {
      pattern: { type: 'linear', count: 2, step: [0, mul(h, 0.6), 0] },
    }),
    mesh('outlet', 'outlet', 'legs', [0, 1.15, add(r, 0.1)], {
      transform: { position: [0, 1.15, add(r, 0.1)], rotation: [90, 0, 0] },
    }),
    instance('topValve', 'valve', [0, add(add(h, 0.7), mul(r, 0.36)), 0]),
  ],
);
const pump = model(
  'pump',
  'Motor pump assembly',
  { length: param(1.8, 1.2, 2.6, 'Motor and pump length') },
  {
    blue: material('#416f83', { metalness: 0.55 }),
    dark: material('#384951', { metalness: 0.65 }),
    steel: material('#abb7bb', { metalness: 0.8 }),
  },
  {
    motor: cylinder(0.35, mul(p('length'), 0.55), 24),
    collar: cylinder(0.4, 0.09, 24),
    foot: box(p('length'), 0.12, 0.85),
    pedestal: box(0.12, 0.42, 0.6),
    shaft: cylinder(0.12, 0.25, 16),
    casing: cylinder(0.43, 0.4, 32),
    fin: box(mul(p('length'), 0.5), 0.08, 0.025),
  },
  [
    mesh('skid', 'foot', 'dark', [0, 0.06, 0]),
    mesh('pedestals', 'pedestal', 'dark', [mul(p('length'), -0.3), 0.28, 0], {
      pattern: { type: 'linear', count: 2, step: [mul(p('length'), 0.6), 0, 0] },
    }),
    mesh('motor', 'motor', 'blue', [mul(p('length'), -0.12), 0.63, 0], {
      transform: { position: [mul(p('length'), -0.12), 0.63, 0], rotation: [0, 0, 90] },
    }),
    mesh('frontCasing', 'casing', 'blue', [mul(p('length'), 0.38), 0.63, 0], {
      transform: { position: [mul(p('length'), 0.38), 0.63, 0], rotation: [0, 0, 90] },
    }),
    mesh('endCollar', 'collar', 'steel', [mul(p('length'), -0.4), 0.63, 0], {
      transform: { position: [mul(p('length'), -0.4), 0.63, 0], rotation: [0, 0, 90] },
    }),
    mesh('shaft', 'shaft', 'steel', [mul(p('length'), 0.18), 0.63, 0], {
      transform: { position: [mul(p('length'), 0.18), 0.63, 0], rotation: [0, 0, 90] },
    }),
    mesh('coolingFins', 'fin', 'dark', [mul(p('length'), -0.12), 0.93, -0.21], {
      pattern: { type: 'linear', count: 7, step: [0, 0, 0.07] },
    }),
  ],
);
const walk = model(
  'catwalk',
  'Guarded catwalk',
  {
    length: param(12, 4, 18, 'Walkway length'),
    height: param(2.1, 1, 3, 'Deck height'),
    posts: param(7, 3, 12, 'Guard posts per side', true),
  },
  { deck: material('#65767d', { metalness: 0.6 }), rail: material('#dca54a', { metalness: 0.4 }) },
  {
    deck: box(p('length'), 0.16, 1),
    leg: box(0.12, p('height'), 0.12),
    post: box(0.045, 1.05, 0.045),
    rail: box(p('length'), 0.05, 0.05),
  },
  [
    mesh('deck', 'deck', 'deck', [0, p('height'), 0]),
    mesh('supports', 'leg', 'deck', [0, div(p('height'), 2), 0], {
      pattern: {
        type: 'grid',
        counts: [3, 1, 2],
        step: [sub(div(p('length'), 2), 0.25), 0, 0.75],
        centered: true,
      },
    }),
    mesh('guardPosts', 'post', 'rail', [mul(p('length'), -0.5), add(p('height'), 0.58), -0.5], {
      pattern: {
        type: 'grid',
        counts: [p('posts'), 1, 2],
        step: [div(p('length'), sub(p('posts'), 1)), 0, 1],
      },
    }),
    mesh('rails', 'rail', 'rail', [0, add(p('height'), 0.65), -0.5], {
      pattern: { type: 'grid', counts: [1, 2, 2], step: [0, 0.43, 1] },
    }),
  ],
);
export const plant = {
  models: [valve, vessel, pump, walk],
  scene: scene(
    'pipePlant',
    'Process Plant / Routing study',
    {
      floor: material('#616f75'),
      concrete: material('#8c999b'),
      blue: material('#397e95', { metalness: 0.45 }),
      warm: material('#c0784b', { metalness: 0.55 }),
      yellow: material('#dfb75f'),
      steel: material('#536772', { metalness: 0.65 }),
    },
    {
      floor: box(17, 0.25, 12),
      pad: box(3.4, 0.15, 3.3),
      line: box(0.06, 0.012, 4.7),
      step: box(1.1, 0.18, 0.43),
      manifold: tube(
        [
          [-6.8, 0.75, 2.7],
          [-3, 0.75, 2.7],
          [3, 0.75, 2.7],
          [6.8, 0.75, 2.7],
        ],
        0.18,
      ),
      branch: tube(
        [
          [0, 1.15, -1.75],
          [0, 1.15, -0.8],
          [0, 0.75, 0.8],
          [0, 0.75, 2.7],
        ],
        0.14,
      ),
      overhead: tube(
        [
          [-5, 4.5, -3],
          [-5, 5.7, -3],
          [-4, 6.25, -3],
          [-1, 6.25, -3],
          [0, 5.7, -3],
          [0, 5.1, -3],
        ],
        0.16,
      ),
      return: tube(
        [
          [5, 1.15, -1.75],
          [6.8, 1.15, -1.75],
          [7, 1.15, 0.2],
          [7, 1.15, 3.7],
          [5, 0.63, 4],
        ],
        0.12,
      ),
      pipeSupport: box(0.08, 0.7, 0.08),
    },
    [
      mesh('foundation', 'floor', 'floor', [0, -0.125, 0]),
      mesh('pads', 'pad', 'concrete', [-5, 0.075, -3], {
        pattern: { type: 'linear', count: 3, step: [5, 0, 0] },
      }),
      instance('tankA', 'vessel', [-5, 0.15, -3], {
        tags: ['vessels'],
        parameters: { height: 3.65 },
      }),
      instance('tankB', 'vessel', [0, 0.15, -3], {
        tags: ['vessels'],
        parameters: { height: 4.3 },
      }),
      instance('tankC', 'vessel', [5, 0.15, -3], {
        tags: ['vessels'],
        parameters: { height: 3.3 },
        materialOverrides: { band: 'warm' },
      }),
      instance('serviceDeck', 'catwalk', [0, 0, -0.5], {
        parameters: { length: 12.5, height: 2.1, posts: 8 },
        tags: ['access'],
      }),
      mesh('stairs', 'step', 'yellow', [6.5, 0.09, 3.7], {
        pattern: { type: 'linear', count: 11, step: [0, 0.2, -0.4] },
      }),
      mesh('supplyHeader', 'manifold', 'blue', [0, 0, 0], { tags: ['pipes'] }),
      mesh('vesselConnections', 'branch', 'blue', [-5, 0, 0], {
        pattern: { type: 'linear', count: 3, step: [5, 0, 0] },
        tags: ['pipes'],
      }),
      mesh('overheadTransfer', 'overhead', 'warm', [0, 0, 0], { tags: ['pipes'] }),
      mesh('returnLoop', 'return', 'warm', [0, 0, 0], { tags: ['pipes'] }),
      instance('lineValves', 'valve', [-5, 0.82, 1.65], {
        pattern: { type: 'linear', count: 3, step: [5, 0, 0] },
      }),
      instance('pumps', 'pump', [-4, 0, 4], {
        pattern: { type: 'linear', count: 3, step: [4, 0, 0] },
        tags: ['equipment'],
      }),
      mesh('pipeSupports', 'pipeSupport', 'steel', [0, 0, 0], {
        pattern: {
          type: 'path',
          points: [
            [-6, 0.35, 2.7],
            [-3, 0.35, 2.7],
            [0, 0.35, 2.7],
            [3, 0.35, 2.7],
            [6, 0.35, 2.7],
          ],
        },
      }),
      mesh('walkwayLines', 'line', 'yellow', [-7.5, 0.012, 1.8], {
        pattern: { type: 'linear', count: 2, step: [15, 0, 0] },
      }),
    ],
  ),
  features: [
    'Capped 3D spline pipes',
    'Reusable vessels and valves',
    'Nested equipment assemblies',
    'Catwalk count parameters',
    'Path-based pipe supports',
  ],
  description:
    'A compact industrial plant with color-coded pipe circuits, three vessel variants, motor pumps and a service catwalk.',
};
