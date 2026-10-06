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
  tube,
  mesh,
  instance,
  group,
  model,
  scene,
} from './recipe.mjs';
const gripper = model(
  'gripper',
  'Parallel-jaw gripper',
  { opening: param(0.42, 0.15, 0.85, 'Jaw opening') },
  {
    metal: material('#6d7a7f', { metalness: 0.75 }),
    pad: material('#333e46'),
    amber: material('#d6a24b'),
  },
  {
    body: box(add(p('opening'), 0.3), 0.22, 0.38),
    finger: box(0.09, 0.43, 0.13),
    pad: box(0.04, 0.19, 0.16),
    coupling: cylinder(0.13, 0.2),
  },
  [
    mesh('body', 'body', 'metal', [0, -0.11, 0]),
    mesh('coupling', 'coupling', 'amber', [0, 0.1, 0]),
    mesh('fingers', 'finger', 'metal', [div(p('opening'), -2), -0.39, 0], {
      pattern: { type: 'linear', count: 2, step: [p('opening'), 0, 0] },
    }),
    mesh('pads', 'pad', 'pad', [sub(div(p('opening'), -2), -0.025), -0.5, 0], {
      pattern: { type: 'linear', count: 2, step: [sub(p('opening'), 0.05), 0, 0] },
    }),
  ],
);
const arm = model(
  'robotArm',
  'Articulated robot arm',
  {
    upper: param(1.8, 1.1, 2.4, 'Shoulder-to-elbow length'),
    forearm: param(1.5, 1, 2.2, 'Elbow-to-wrist length'),
    shoulder: param(-30, -80, 30, 'Shoulder rotation in degrees'),
    elbow: param(-65, -130, 10, 'Elbow rotation in degrees'),
    wrist: param(95, -180, 180, 'Wrist rotation in degrees'),
    opening: param(0.42, 0.15, 0.85, 'Gripper opening'),
  },
  {
    yellow: material('#dba347', { metalness: 0.4 }),
    dark: material('#344650', { metalness: 0.6 }),
    steel: material('#a1adb1', { metalness: 0.8 }),
  },
  {
    base: cylinder(0.62, 0.18),
    turret: cylinder(0.38, 0.7),
    joint: cylinder(0.29, 0.62),
    cap: cylinder(0.18, 0.68),
    upper: box(0.44, p('upper'), 0.45),
    forearm: box(0.34, p('forearm'), 0.38),
    stripe: box(0.12, mul(p('upper'), 0.6), 0.015),
    hose: tube(
      [
        [0, 0.1, 0.31],
        [0.33, 0.4, 0.35],
        [0.35, mul(p('upper'), 0.6), 0.35],
        [0.05, p('upper'), 0.31],
      ],
      0.045,
      { tubularSegments: 28 },
    ),
  },
  [
    mesh('base', 'base', 'dark', [0, 0.09, 0]),
    mesh('turret', 'turret', 'yellow', [0, 0.53, 0]),
    group('shoulder', [0, 0.9, 0], {
      transform: { position: [0, 0.9, 0], rotation: [0, 0, p('shoulder')] },
    }),
    mesh('shoulderJoint', 'joint', 'dark', [0, 0, 0], {
      parent: 'shoulder',
      transform: { rotation: [90, 0, 0] },
    }),
    mesh('shoulderCap', 'cap', 'steel', [0, 0, 0], {
      parent: 'shoulder',
      transform: { rotation: [90, 0, 0] },
    }),
    mesh('upperLink', 'upper', 'yellow', [0, div(p('upper'), 2), 0], { parent: 'shoulder' }),
    mesh('upperStripe', 'stripe', 'dark', [0, div(p('upper'), 2), 0.233], { parent: 'shoulder' }),
    mesh('serviceHose', 'hose', 'dark', [0, 0, 0], { parent: 'shoulder' }),
    group('elbow', [0, p('upper'), 0], {
      parent: 'shoulder',
      transform: { position: [0, p('upper'), 0], rotation: [0, 0, p('elbow')] },
    }),
    mesh('elbowJoint', 'joint', 'dark', [0, 0, 0], {
      parent: 'elbow',
      transform: { rotation: [90, 0, 0] },
    }),
    mesh('elbowCap', 'cap', 'steel', [0, 0, 0], {
      parent: 'elbow',
      transform: { rotation: [90, 0, 0] },
    }),
    mesh('forearm', 'forearm', 'yellow', [0, div(p('forearm'), 2), 0], { parent: 'elbow' }),
    group('wrist', [0, p('forearm'), 0], {
      parent: 'elbow',
      transform: { position: [0, p('forearm'), 0], rotation: [0, 0, p('wrist')] },
    }),
    mesh('wristJoint', 'joint', 'dark', [0, 0, 0], {
      parent: 'wrist',
      transform: { rotation: [90, 0, 0], scale: [0.65, 0.75, 0.65] },
    }),
    instance('tool', 'gripper', [0, -0.05, 0], {
      parent: 'wrist',
      parameters: { opening: p('opening') },
    }),
  ],
);
const conveyor = model(
  'conveyor',
  'Roller conveyor',
  { length: param(8, 3, 12, 'Conveyor length'), rollers: param(24, 8, 36, 'Roller count', true) },
  {
    frame: material('#466c7b', { metalness: 0.6 }),
    roller: material('#a9b7bc', { metalness: 0.8 }),
    feet: material('#354650'),
  },
  {
    side: box(0.15, 0.24, add(p('length'), 0.35)),
    roller: cylinder(0.085, 1.6, 16),
    leg: box(0.1, 0.95, 0.1),
    foot: box(0.35, 0.12, 0.35),
  },
  [
    mesh('sideRails', 'side', 'frame', [-0.88, 1, 0], {
      pattern: { type: 'linear', count: 2, step: [1.76, 0, 0] },
    }),
    // Pattern wrapper carries the rotation; this roll axis is modeled as a nested assembly below.
    instance('rollers', 'conveyorRoller', [0, 1, mul(p('length'), -0.5)], {
      pattern: {
        type: 'linear',
        count: p('rollers'),
        step: [0, 0, div(p('length'), sub(p('rollers'), 1))],
      },
    }),
    mesh('legs', 'leg', 'feet', [0, 0.475, 0], {
      pattern: {
        type: 'grid',
        counts: [2, 1, 3],
        step: [1.6, 0, sub(div(p('length'), 2), 0.2)],
        centered: true,
      },
    }),
    mesh('feet', 'foot', 'feet', [0, 0.06, 0], {
      pattern: {
        type: 'grid',
        counts: [2, 1, 3],
        step: [1.6, 0, sub(div(p('length'), 2), 0.2)],
        centered: true,
      },
    }),
  ],
);
const roller = model(
  'conveyorRoller',
  'Conveyor roller',
  {},
  { steel: material('#a9b7bc', { metalness: 0.8 }) },
  { roller: cylinder(0.085, 1.6, 16) },
  [mesh('roller', 'roller', 'steel', [0, 0, 0], { transform: { rotation: [0, 0, 90] } })],
);
const cabinet = model(
  'controlCabinet',
  'Control cabinet',
  {},
  {
    body: material('#c8ceca', { metalness: 0.2 }),
    dark: material('#3d535e'),
    screen: material('#5dadaa', { emissive: '#153b3a', emissiveIntensity: 0.2 }),
    button: material('#dfaa55'),
  },
  {
    body: box(1.25, 1.9, 0.65),
    door: box(1.08, 1.69, 0.06),
    screen: box(0.6, 0.4, 0.08),
    button: cylinder(0.035, 0.04, 12),
    base: box(1.34, 0.15, 0.74),
  },
  [
    mesh('base', 'base', 'dark', [0, 0.075, 0]),
    mesh('body', 'body', 'body', [0, 1.1, 0]),
    mesh('door', 'door', 'dark', [0, 1.1, 0.34]),
    mesh('screen', 'screen', 'screen', [0, 1.55, 0.395]),
    mesh('buttons', 'button', 'button', [-0.25, 1.2, 0.405], {
      transform: { position: [-0.25, 1.2, 0.405], rotation: [90, 0, 0] },
      pattern: { type: 'linear', count: 4, step: [0.17, 0, 0] },
    }),
  ],
);
const arrow = model(
  'guideArrow',
  'Route arrow',
  {},
  { paint: material('#e6c578') },
  {
    arrow: {
      type: 'extrude',
      points: [
        [-0.09, 0],
        [0.09, 0],
        [0.09, 0.5],
        [0.25, 0.5],
        [0, 0.85],
        [-0.25, 0.5],
        [-0.09, 0.5],
      ],
      depth: 0.012,
    },
  },
  [
    mesh('arrow', 'arrow', 'paint', [0, 0.025, 0], {
      transform: { position: [0, 0.025, 0], rotation: [90, 0, 0] },
    }),
  ],
);
export const robot = {
  models: [gripper, arm, roller, conveyor, cabinet, arrow],
  scene: scene(
    'robotCell',
    'Robotic Assembly Cell',
    {
      floor: material('#738087'),
      panel: material('#52656c'),
      yellow: material('#e0b55c'),
      blue: material('#467e96'),
      part: material('#518e86', { metalness: 0.45 }),
    },
    {
      floor: box(14, 0.2, 12),
      pad: box(2.6, 0.09, 2.6),
      mark: box(0.08, 0.01, 8.8),
      blank: cylinder(0.23, 0.32, 24),
      rim: cylinder(0.3, 0.05, 24),
      bollard: cylinder(0.08, 0.85, 12),
    },
    [
      mesh('foundation', 'floor', 'floor', [0, -0.1, 0]),
      mesh('robotPads', 'pad', 'panel', [-3, 0.045, -0.9], {
        pattern: { type: 'linear', count: 2, step: [6, 0, 2.1] },
      }),
      instance('transferLine', 'conveyor', [0, 0, 0], { tags: ['conveyor'] }),
      instance('leftRobot', 'robotArm', [-3, 0.09, -0.9], {
        tags: ['robots'],
        parameters: { shoulder: -30, elbow: -65, wrist: 95, opening: 0.45 },
      }),
      instance('rightRobot', 'robotArm', [3, 0.09, 1.2], {
        tags: ['robots'],
        parameters: { shoulder: -40, elbow: -40, wrist: 80, opening: 0.6 },
        materialOverrides: { yellow: 'blue' },
        transform: { position: [3, 0.09, 1.2], rotation: [0, 180, 0] },
      }),
      instance('controller', 'controlCabinet', [-4.8, 0, -3.7]),
      mesh('parts', 'blank', 'part', [0, 1.26, -2.8], {
        pattern: { type: 'linear', count: 5, step: [0, 0, 1.4] },
      }),
      mesh('partRims', 'rim', 'part', [0, 1.43, -2.8], {
        pattern: { type: 'linear', count: 5, step: [0, 0, 1.4] },
      }),
      mesh('safetyLines', 'mark', 'yellow', [-5.8, 0.01, 0], {
        pattern: { type: 'linear', count: 2, step: [11.6, 0, 0] },
      }),
      mesh('bollards', 'bollard', 'yellow', [0, 0, 0], {
        pattern: {
          type: 'path',
          points: [
            [-5.4, 0.425, -4.2],
            [-5.4, 0.425, 0],
            [-5.4, 0.425, 4.2],
            [5.4, 0.425, -4.2],
            [5.4, 0.425, 0],
            [5.4, 0.425, 4.2],
          ],
        },
      }),
      instance('flowRoute', 'guideArrow', [0, 0, 0], {
        tags: ['wayfinding'],
        pattern: {
          type: 'path',
          orient: 'yaw',
          points: [
            [-4.5, 0, 4.8],
            [-2.5, 0, 4.8],
            [0, 0, 4.8],
            [2.5, 0, 4.8],
            [4.5, 0, 4.8],
            [4.5, 0, 2.8],
            [4.5, 0, 0.6],
            [4.5, 0, -1.5],
          ],
        },
      }),
    ],
  ),
  features: [
    'Articulated group pivots',
    'Nested gripper parameters',
    'Two robot pose variants',
    'Conveyor repetition',
    'Yaw-oriented route markers',
  ],
  description:
    'A static assembly-cell study with two articulated robot poses, a parametric conveyor, grippers and route markers. No simulation or animation is implied.',
};
