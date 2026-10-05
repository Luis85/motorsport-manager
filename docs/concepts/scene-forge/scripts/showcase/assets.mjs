import {
  p,
  add,
  mul,
  div,
  param,
  material,
  box,
  cylinder,
  sphere,
  mesh,
  instance,
  group,
  model,
  scene,
} from './recipe.mjs';
const asset = (value, category, description) => ({ ...value, category, description });
const clay = { surface: material('#73a3b0', { roughness: 0.45 }) };
export const assets = [
  asset(
    model(
      'primitiveBox',
      'Box',
      {
        width: param(1, 0.05, 20, 'Width'),
        height: param(1, 0.05, 20, 'Height'),
        depth: param(1, 0.05, 20, 'Depth'),
      },
      clay,
      { body: box(p('width'), p('height'), p('depth')) },
      [mesh('body', 'body', 'surface', [0, div(p('height'), 2), 0])],
    ),
    'Primitives',
    'A box with independent dimensions.',
  ),
  asset(
    model(
      'primitiveSphere',
      'Sphere',
      { radius: param(0.5, 0.025, 10, 'Radius') },
      clay,
      { body: sphere(p('radius'), 24) },
      [mesh('body', 'body', 'surface', [0, p('radius'), 0])],
    ),
    'Primitives',
    'A smooth sphere centered one radius above its local origin.',
  ),
  asset(
    model(
      'primitiveCylinder',
      'Cylinder',
      { radius: param(0.5, 0.025, 10, 'Radius'), height: param(1, 0.05, 20, 'Height') },
      clay,
      { body: cylinder(p('radius'), p('height'), 32) },
      [mesh('body', 'body', 'surface', [0, div(p('height'), 2), 0])],
    ),
    'Primitives',
    'A capped cylinder along the local Y axis.',
  ),
  asset(
    model(
      'primitiveCone',
      'Cone',
      { radius: param(0.5, 0.025, 10, 'Base radius'), height: param(1, 0.05, 20, 'Height') },
      clay,
      { body: { type: 'cone', radius: p('radius'), height: p('height'), segments: 32 } },
      [mesh('body', 'body', 'surface', [0, div(p('height'), 2), 0])],
    ),
    'Primitives',
    'A cone with editable radius and height.',
  ),
  asset(
    model(
      'primitiveTorus',
      'Torus',
      { radius: param(0.5, 0.1, 8, 'Major radius'), tube: param(0.12, 0.02, 1, 'Tube radius') },
      clay,
      { body: { type: 'torus', radius: p('radius'), tube: p('tube'), segments: 32 } },
      [mesh('body', 'body', 'surface', [0, add(p('radius'), p('tube')), 0])],
    ),
    'Primitives',
    'A vertical ring in the XY plane.',
  ),
  asset(
    model(
      'primitiveCapsule',
      'Capsule',
      {
        radius: param(0.3, 0.03, 5, 'Radius'),
        length: param(0.8, 0, 12, 'Straight section length'),
      },
      clay,
      { body: { type: 'capsule', radius: p('radius'), length: p('length'), segments: 24 } },
      [mesh('body', 'body', 'surface', [0, add(div(p('length'), 2), p('radius')), 0])],
    ),
    'Primitives',
    'A Y-aligned capsule for blocking out forms.',
  ),
  asset(
    model(
      'primitivePlane',
      'Plane',
      { width: param(2, 0.1, 20, 'Width'), depth: param(2, 0.1, 20, 'Depth') },
      clay,
      { body: { type: 'plane', size: [p('width'), p('depth')] } },
      [mesh('body', 'body', 'surface', [0, 0, 0], { transform: { rotation: [-90, 0, 0] } })],
    ),
    'Primitives',
    'An upward-facing horizontal plane.',
  ),
];
function character(id, name, colors, helmet = false) {
  const result = model(
    id,
    name,
    {
      height: param(1.75, 1, 2.5, 'Overall stature'),
      leftArm: param(8, -160, 160, 'Left shoulder angle in degrees'),
      rightArm: param(-8, -160, 160, 'Right shoulder angle in degrees'),
      stride: param(0, -35, 35, 'Leg pose in degrees'),
      headTurn: param(0, -80, 80, 'Head yaw in degrees'),
    },
    {
      outfit: material(colors[0]),
      skin: material(colors[1]),
      dark: material(colors[2]),
      accent: material(colors[3]),
    },
    {
      body: box(0.46, 0.6, 0.26),
      hip: box(0.41, 0.18, 0.25),
      head: sphere(0.16, 16),
      limb: box(0.12, 0.5, 0.14),
      arm: box(0.12, 0.46, 0.13),
      hand: sphere(0.073, 12),
      shoe: box(0.17, 0.12, 0.28),
      eye: sphere(0.022, 8),
      visor: box(0.245, 0.105, 0.045),
      pack: box(0.3, 0.4, 0.14),
      badge: box(0.09, 0.12, 0.015),
    },
    [
      group('bodyRoot', [0, 0, 0], {
        transform: {
          scale: [div(p('height'), 1.75), div(p('height'), 1.75), div(p('height'), 1.75)],
        },
      }),
      mesh('torso', 'body', 'outfit', [0, 1.1, 0], { parent: 'bodyRoot' }),
      mesh('hip', 'hip', 'dark', [0, 0.72, 0], { parent: 'bodyRoot' }),
      mesh('badge', 'badge', 'accent', [-0.1, 1.18, 0.14], { parent: 'bodyRoot' }),
      group('headPivot', [0, 1.57, 0], {
        parent: 'bodyRoot',
        transform: { position: [0, 1.57, 0], rotation: [0, p('headTurn'), 0] },
      }),
      mesh('head', 'head', helmet ? 'outfit' : 'skin', [0, 0, 0], { parent: 'headPivot' }),
      ...(helmet
        ? [
            mesh('visor', 'visor', 'dark', [0, 0.015, 0.153], { parent: 'headPivot' }),
            mesh('backpack', 'pack', 'accent', [0, 1.12, -0.19], { parent: 'bodyRoot' }),
          ]
        : [
            mesh('leftEye', 'eye', 'dark', [-0.06, 0.02, 0.143], { parent: 'headPivot' }),
            mesh('rightEye', 'eye', 'dark', [0.06, 0.02, 0.143], { parent: 'headPivot' }),
          ]),
      group('leftShoulder', [-0.3, 1.35, 0], {
        parent: 'bodyRoot',
        transform: { position: [-0.3, 1.35, 0], rotation: [0, 0, p('leftArm')] },
      }),
      group('rightShoulder', [0.3, 1.35, 0], {
        parent: 'bodyRoot',
        transform: { position: [0.3, 1.35, 0], rotation: [0, 0, p('rightArm')] },
      }),
      mesh('leftArm', 'arm', 'outfit', [0, -0.23, 0], { parent: 'leftShoulder' }),
      mesh('leftHand', 'hand', 'skin', [0, -0.5, 0], { parent: 'leftShoulder' }),
      mesh('rightArm', 'arm', 'outfit', [0, -0.23, 0], { parent: 'rightShoulder' }),
      mesh('rightHand', 'hand', 'skin', [0, -0.5, 0], { parent: 'rightShoulder' }),
      group('leftHip', [-0.13, 0.67, 0], {
        parent: 'bodyRoot',
        transform: { position: [-0.13, 0.67, 0], rotation: [p('stride'), 0, 0] },
      }),
      group('rightHip', [0.13, 0.67, 0], {
        parent: 'bodyRoot',
        transform: { position: [0.13, 0.67, 0], rotation: [mul(p('stride'), -1), 0, 0] },
      }),
      mesh('leftLeg', 'limb', 'dark', [0, -0.25, 0], { parent: 'leftHip' }),
      mesh('rightLeg', 'limb', 'dark', [0, -0.25, 0], { parent: 'rightHip' }),
      mesh('leftShoe', 'shoe', 'accent', [0, -0.58, 0.06], { parent: 'leftHip' }),
      mesh('rightShoe', 'shoe', 'accent', [0, -0.58, 0.06], { parent: 'rightHip' }),
    ],
  );
  return asset(
    result,
    'Characters',
    'A static, poseable group hierarchy. Change dimensions, joint angles and materials through the recipe; no skeleton or animation is included.',
  );
}
assets.push(
  character('person', 'Everyday person', ['#75969b', '#cf9c7b', '#374957', '#a56d4f']),
  character('astronaut', 'Astronaut', ['#ddd8c4', '#dbd7c6', '#304854', '#c4874c'], true),
  character(
    'serviceCharacter',
    'Service robot character',
    ['#a0b7b8', '#84999c', '#344b56', '#dbaf59'],
    true,
  ),
);
assets.push(
  asset(
    model(
      'desk',
      'Writing desk',
      { width: param(2, 1, 3.5), depth: param(0.85, 0.5, 1.5), height: param(0.75, 0.35, 1.2) },
      { top: material('#b18559'), frame: material('#3e525a') },
      { top: box(p('width'), 0.09, p('depth')), leg: box(0.07, p('height'), 0.07) },
      [
        mesh('top', 'top', 'top', [0, p('height'), 0]),
        mesh('legs', 'leg', 'frame', [0, div(p('height'), 2), 0], {
          pattern: {
            type: 'grid',
            counts: [2, 1, 2],
            step: [add(p('width'), -0.2), 0, add(p('depth'), -0.2)],
            centered: true,
          },
        }),
      ],
    ),
    'Everyday',
    'A table or desk with editable dimensions.',
  ),
  asset(
    model(
      'chair',
      'Dining chair',
      {},
      { wood: material('#b58a5d'), seat: material('#667f7e') },
      {
        seat: box(0.48, 0.08, 0.48),
        leg: box(0.055, 0.46, 0.055),
        backPost: box(0.05, 0.5, 0.05),
        back: box(0.47, 0.3, 0.065),
      },
      [
        mesh('seat', 'seat', 'seat', [0, 0.48, 0]),
        mesh('legs', 'leg', 'wood', [0, 0.23, 0], {
          pattern: { type: 'grid', counts: [2, 1, 2], step: [0.37, 0, 0.37], centered: true },
        }),
        mesh('backPosts', 'backPost', 'wood', [-0.195, 0.7, -0.2], {
          pattern: { type: 'linear', count: 2, step: [0.39, 0, 0] },
        }),
        mesh('back', 'back', 'wood', [0, 0.8, -0.2]),
      ],
    ),
    'Everyday',
    'A four-legged chair with separate seat and frame materials.',
  ),
  asset(
    model(
      'mug',
      'Coffee mug',
      {},
      { ceramic: material('#c89470'), coffee: material('#594332') },
      {
        cup: {
          type: 'lathe',
          segments: 32,
          points: [
            [0, 0],
            [0.16, 0],
            [0.18, 0.36],
            [0.155, 0.37],
            [0.135, 0.06],
            [0, 0.06],
          ],
        },
        handle: { type: 'torus', radius: 0.12, tube: 0.03, segments: 24 },
        coffee: cylinder(0.148, 0.01, 32),
      },
      [
        mesh('cup', 'cup', 'ceramic'),
        mesh('handle', 'handle', 'ceramic', [0.2, 0.22, 0]),
        mesh('coffee', 'coffee', 'coffee', [0, 0.29, 0]),
      ],
    ),
    'Everyday',
    'A lathed ceramic mug with a handle and opaque coffee surface.',
  ),
  asset(
    model(
      'bottle',
      'Reusable bottle',
      { height: param(0.65, 0.25, 1.2, 'Bottle height') },
      {
        body: material('#4d8a84', { metalness: 0.35 }),
        cap: material('#374b54', { metalness: 0.5 }),
      },
      {
        body: {
          type: 'lathe',
          segments: 24,
          points: [
            [0, 0],
            [0.12, 0],
            [0.13, mul(p('height'), 0.08)],
            [0.13, mul(p('height'), 0.7)],
            [0.07, mul(p('height'), 0.82)],
            [0.065, mul(p('height'), 0.94)],
            [0, mul(p('height'), 0.94)],
          ],
        },
        cap: cylinder(0.071, mul(p('height'), 0.09), 24),
      },
      [mesh('bottle', 'body', 'body'), mesh('cap', 'cap', 'cap', [0, mul(p('height'), 0.955), 0])],
    ),
    'Everyday',
    'An opaque metal bottle with editable height.',
  ),
  asset(
    model(
      'book',
      'Hardcover book',
      {
        width: param(0.24, 0.12, 0.5),
        height: param(0.035, 0.015, 0.12),
        depth: param(0.32, 0.16, 0.6),
      },
      { cover: material('#637f95'), pages: material('#dfd6bb') },
      {
        cover: box(p('width'), 0.008, p('depth')),
        pages: box(add(p('width'), -0.012), p('height'), add(p('depth'), -0.018)),
        spine: box(0.012, add(p('height'), 0.012), p('depth')),
      },
      [
        mesh('pages', 'pages', 'pages', [0, add(div(p('height'), 2), 0.008), 0]),
        mesh('covers', 'cover', 'cover', [0, 0.004, 0], {
          pattern: { type: 'linear', count: 2, step: [0, add(p('height'), 0.008), 0] },
        }),
        mesh('spine', 'spine', 'cover', [
          mul(p('width'), -0.5),
          add(div(p('height'), 2), 0.008),
          0,
        ]),
      ],
    ),
    'Everyday',
    'A closed book with independent cover and page materials.',
  ),
  asset(
    model(
      'sofa',
      'Two-seat sofa',
      { width: param(2.1, 1.4, 3.5, 'Sofa width') },
      { fabric: material('#71898e'), base: material('#465960'), wood: material('#906b4b') },
      {
        base: box(p('width'), 0.22, 0.85),
        seat: box(add(div(p('width'), 2), -0.18), 0.2, 0.64),
        back: box(add(p('width'), -0.15), 0.58, 0.19),
        arm: box(0.18, 0.52, 0.85),
        leg: box(0.08, 0.19, 0.08),
      },
      [
        mesh('base', 'base', 'base', [0, 0.3, 0]),
        mesh('seats', 'seat', 'fabric', [mul(p('width'), -0.24), 0.5, 0.06], {
          pattern: { type: 'linear', count: 2, step: [mul(p('width'), 0.48), 0, 0] },
        }),
        mesh('back', 'back', 'fabric', [0, 0.74, -0.36]),
        mesh('arms', 'arm', 'fabric', [mul(p('width'), -0.5), 0.56, 0], {
          pattern: { type: 'linear', count: 2, step: [p('width'), 0, 0] },
        }),
        mesh('feet', 'leg', 'wood', [0, 0.095, 0], {
          pattern: {
            type: 'grid',
            counts: [2, 1, 2],
            step: [add(p('width'), -0.25), 0, 0.65],
            centered: true,
          },
        }),
      ],
    ),
    'Everyday',
    'A modular sofa with a parametric width.',
  ),
  asset(
    model(
      'tableLamp',
      'Table lamp',
      {},
      {
        metal: material('#bb965e', { metalness: 0.5 }),
        shade: material('#dcd2b6'),
        bulb: material('#ffe4af', { emissive: '#ffd27a', emissiveIntensity: 1.5 }),
      },
      {
        base: cylinder(0.18, 0.04),
        stem: cylinder(0.018, 0.5, 12),
        shade: {
          type: 'cylinder',
          radiusTop: 0.12,
          radiusBottom: 0.24,
          height: 0.25,
          segments: 24,
        },
        bulb: sphere(0.055, 16),
      },
      [
        mesh('base', 'base', 'metal', [0, 0.02, 0]),
        mesh('stem', 'stem', 'metal', [0, 0.29, 0]),
        mesh('shade', 'shade', 'shade', [0, 0.66, 0]),
        mesh('bulb', 'bulb', 'bulb', [0, 0.53, 0]),
        {
          id: 'bulbLight',
          type: 'light',
          light: 'point',
          intensity: 2.5,
          color: '#ffe2aa',
          distance: 2,
          transform: { position: [0, 0.5, 0] },
        },
      ],
    ),
    'Everyday',
    'A table lamp with an authored warm point light.',
  ),
  asset(
    model(
      'monitor',
      'Desktop monitor',
      {},
      {
        case: material('#34434b'),
        screen: material('#6398a5', { shading: 'unlit' }),
        stand: material('#7b8b91', { metalness: 0.7 }),
      },
      {
        screen: box(0.8, 0.46, 0.045),
        case: box(0.85, 0.51, 0.08),
        stem: box(0.08, 0.23, 0.08),
        base: box(0.38, 0.035, 0.24),
      },
      [
        mesh('base', 'base', 'stand', [0, 0.0175, 0]),
        mesh('stem', 'stem', 'stand', [0, 0.14, 0]),
        mesh('case', 'case', 'case', [0, 0.47, 0]),
        mesh('screen', 'screen', 'screen', [0, 0.47, 0.045]),
      ],
    ),
    'Everyday',
    'An unlit screen shader and metallic stand, portable through glTF.',
  ),
);
export const assetStudio = {
  models: assets,
  description:
    'A ready-to-compose asset workshop: primitives, poseable characters, furniture and everyday props, with authored lights and material slots.',
  features: [
    'Primitive palette',
    'Poseable character groups',
    'Everyday props',
    'Authored point and spot lights',
    'Unlit and PBR materials',
  ],
  scene: scene(
    'assetStudio',
    'The Asset Workshop',
    {
      floor: material('#8f9997'),
      wall: material('#c5bcaa'),
      rug: material('#b28660'),
      plinth: material('#657b83'),
      accent: material('#d4a358'),
    },
    {
      floor: box(11, 0.2, 9),
      wall: box(11, 3.3, 0.15),
      rug: box(3.9, 0.025, 2.5),
      plinth: box(1.25, 0.15, 1.1),
    },
    [
      mesh('floor', 'floor', 'floor', [0, -0.1, 0]),
      mesh('backdrop', 'wall', 'wall', [0, 1.65, -4.3]),
      mesh('rug', 'rug', 'rug', [-2.3, 0.015, -0.4]),
      instance('sofa', 'sofa', [-2.6, 0, -1.1]),
      instance('sideTable', 'desk', [-2.2, 0, 0.6], {
        parameters: { width: 1.4, depth: 0.65, height: 0.45 },
      }),
      instance('coffee', 'mug', [-2.5, 0.5, 0.7]),
      instance('reading', 'book', [-1.95, 0.5, 0.62]),
      instance('desk', 'desk', [2.4, 0, -2.7]),
      instance('chair', 'chair', [2.3, 0, -1.45], {
        transform: { position: [2.3, 0, -1.45], rotation: [0, 180, 0] },
      }),
      instance('screen', 'monitor', [2.35, 0.8, -2.7]),
      instance('taskLamp', 'tableLamp', [3.18, 0.8, -2.66]),
      instance('bottle', 'bottle', [1.65, 0.8, -2.6]),
      instance('host', 'person', [-4.3, 0, 1.5], {
        parameters: { leftArm: -55, rightArm: 12, headTurn: 15 },
      }),
      instance('astronaut', 'astronaut', [0.1, 0, 1.6], {
        parameters: { rightArm: 70, headTurn: -20 },
      }),
      instance('assistant', 'serviceCharacter', [3.2, 0, 0.65], {
        parameters: { height: 1.5, leftArm: -30 },
      }),
      mesh('plinths', 'plinth', 'plinth', [-3.2, 0.075, 3.5], {
        pattern: { type: 'linear', count: 5, step: [1.6, 0, 0] },
      }),
      instance('box', 'primitiveBox', [-3.2, 0.15, 3.5], {
        parameters: { width: 0.65, height: 0.65, depth: 0.65 },
      }),
      instance('sphere', 'primitiveSphere', [-1.6, 0.15, 3.5], { parameters: { radius: 0.35 } }),
      instance('cone', 'primitiveCone', [0, 0.15, 3.5], {
        parameters: { radius: 0.35, height: 0.8 },
      }),
      instance('torus', 'primitiveTorus', [1.6, 0.15, 3.5], {
        parameters: { radius: 0.3, tube: 0.09 },
      }),
      instance('capsule', 'primitiveCapsule', [3.2, 0.15, 3.5], {
        parameters: { radius: 0.2, length: 0.42 },
      }),
      {
        id: 'warmFill',
        type: 'light',
        light: 'point',
        color: '#ffdcad',
        intensity: 35,
        distance: 14,
        transform: { position: [-3, 3, 2] },
      },
      {
        id: 'coolRim',
        type: 'light',
        light: 'spot',
        color: '#c0d8ff',
        intensity: 80,
        distance: 16,
        angle: 45,
        transform: { position: [4, 4, -2], rotation: [-55, 0, 0] },
      },
    ],
  ),
};
assetStudio.scene.environment = {
  background: '#171d25',
  ambient: 1.2,
  keyIntensity: 2.5,
  keyPosition: [5, 10, 7],
  exposure: 1,
  toneMapping: 'filmic',
};
