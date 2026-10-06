import { mkdir, writeFile } from 'node:fs/promises';
const write = async (file, data) => {
  await mkdir(new URL('../' + file, import.meta.url).pathname.split('/').slice(0, -1).join('/'), {
    recursive: true,
  });
  await writeFile(new URL('../' + file, import.meta.url), JSON.stringify(data, null, 2) + '\n');
};
const mat = (color, metalness = 0, roughness = 0.65) => ({ color, metalness, roughness });
const mesh = (id, geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], extra = {}) => ({
  id,
  type: 'mesh',
  geometry,
  material,
  transform: { position, rotation },
  ...extra,
});
const box = (...size) => ({ type: 'box', size });
const cylinder = (radius, height, segments = 24) => ({
  type: 'cylinder',
  radiusTop: radius,
  radiusBottom: radius,
  height,
  segments,
});
const rover = {
  schemaVersion: 1,
  kind: 'model',
  id: 'rover',
  name: 'Survey rover',
  parameters: {
    wheelRadius: { default: 0.48, min: 0.25, max: 0.7, description: 'Wheel radius in meters' },
    mastHeight: { default: 1.3, min: 0.5, max: 2.5 },
  },
  materials: {
    body: mat('#e99045', 0.2, 0.45),
    ivory: mat('#d8e0dc', 0.15, 0.5),
    dark: mat('#26323b', 0.3, 0.55),
    rubber: mat('#10191e', 0, 0.92),
    glass: mat('#4babb4', 0.45, 0.22),
    light: { ...mat('#a2e8de'), emissive: '#57bfb1', emissiveIntensity: 0.5 },
  },
  geometries: {
    hull: box(1.8, 0.55, 2.65),
    underbody: box(1.5, 0.35, 2.35),
    cabin: {
      type: 'extrude',
      points: [
        [-0.75, 0],
        [0.75, 0],
        [0.61, 0.82],
        [-0.42, 1.02],
        [-0.75, 0.65],
      ],
      depth: 1.1,
      bevel: 0.06,
    },
    roof: box(1.3, 0.13, 1.4),
    window: box(1.12, 0.43, 0.04),
    wheel: {
      type: 'cylinder',
      radiusTop: { $param: 'wheelRadius' },
      radiusBottom: { $param: 'wheelRadius' },
      height: 0.38,
      segments: 16,
    },
    hub: cylinder(0.23, 0.41, 16),
    axle: cylinder(0.1, 2.3, 12),
    bumper: box(2, 0.14, 0.18),
    lamp: box(0.35, 0.15, 0.055),
    mast: {
      type: 'cylinder',
      radiusTop: 0.045,
      radiusBottom: 0.07,
      height: { $param: 'mastHeight' },
      segments: 12,
    },
    camera: box(0.5, 0.24, 0.25),
    lens: cylinder(0.075, 0.035, 16),
    crate: box(0.6, 0.43, 0.64),
    strap: box(0.63, 0.07, 0.69),
    vent: box(0.065, 0.025, 0.32),
    panel: box(0.62, 0.06, 0.65),
    fender: box(0.18, 0.14, 2.5),
  },
  nodes: [
    mesh('chassis', 'hull', 'body', [0, 0.87, 0]),
    mesh('undercarriage', 'underbody', 'dark', [0, 0.55, 0]),
    mesh('cab', 'cabin', 'ivory', [0, 1.15, -0.15]),
    mesh('canopy', 'roof', 'body', [0, 2.18, 0.35]),
    mesh('windshield', 'window', 'glass', [0.04, 1.75, 0.975]),
    mesh('frontBumper', 'bumper', 'dark', [0, 0.7, 1.48]),
    mesh('rearBumper', 'bumper', 'dark', [0, 0.7, -1.48]),
    mesh('leftFender', 'fender', 'body', [-1.02, 1.05, 0]),
    mesh('rightFender', 'fender', 'body', [1.02, 1.05, 0]),
    mesh('leftLight', 'lamp', 'light', [-0.58, 1.0, 1.35]),
    mesh('rightLight', 'lamp', 'light', [0.58, 1, 1.35]),
    mesh('mast', 'mast', 'dark', [0.58, 2.55, -0.65]),
    mesh('camera', 'camera', 'body', [0.58, 3.2, -0.65]),
    mesh('lens', 'lens', 'glass', [0.58, 3.2, -0.505], [90, 0, 0]),
    mesh('cargo', 'crate', 'dark', [-0.45, 1.37, -0.94]),
    mesh('cargoStrap', 'strap', 'ivory', [-0.45, 1.55, -0.94]),
    mesh('solar', 'panel', 'glass', [0.45, 1.2, -0.88]),
    mesh('vents', 'vent', 'dark', [-0.36, 2.26, 0.35], [0, 0, 0], {
      pattern: { type: 'linear', count: 8, step: [0.105, 0, 0] },
    }),
  ],
};
for (const x of [-1.06, 1.06])
  for (const z of [-0.88, 0.88]) {
    const id = (x < 0 ? 'left' : 'right') + (z < 0 ? 'Rear' : 'Front');
    rover.nodes.push(
      mesh(id + 'Wheel', 'wheel', 'rubber', [x, 0.49, z], [0, 0, 90]),
      mesh(id + 'Hub', 'hub', 'ivory', [x, 0.49, z], [0, 0, 90]),
    );
  }
for (const z of [-0.88, 0.88])
  rover.nodes.push(
    mesh('axle' + (z < 0 ? 'Rear' : 'Front'), 'axle', 'dark', [0, 0.49, z], [0, 0, 90]),
  );
await write('examples/outpost/models/rover.model.json', rover);
const barrel = {
  schemaVersion: 1,
  kind: 'model',
  id: 'barrel',
  name: 'Supply barrel',
  parameters: {},
  materials: { shell: mat('#587a81', 0.35, 0.5), rim: mat('#bac8c4', 0.65, 0.45) },
  geometries: {
    body: {
      type: 'lathe',
      points: [
        [0, 0],
        [0.34, 0],
        [0.38, 0.1],
        [0.4, 0.45],
        [0.38, 0.85],
        [0.34, 0.95],
        [0, 0.95],
      ],
      segments: 24,
    },
    ring: { type: 'torus', radius: 0.375, tube: 0.025, segments: 24 },
  },
  nodes: [
    mesh('body', 'body', 'shell'),
    mesh('ringLow', 'ring', 'rim', [0, 0.15, 0], [90, 0, 0]),
    mesh('ringHigh', 'ring', 'rim', [0, 0.78, 0], [90, 0, 0]),
  ],
};
await write('examples/outpost/models/barrel.model.json', barrel);
const scene = {
  schemaVersion: 1,
  kind: 'scene',
  id: 'main',
  name: 'Kestrel · Survey outpost',
  revision: 0,
  units: 'meters',
  parameters: {},
  environment: { background: '#171d25', ambient: 2.4, keyIntensity: 4, keyPosition: [-4, 10, 7] },
  camera: { position: [10, 8, 12], target: [0, 1, 0], fov: 39 },
  materials: {
    sand: mat('#ae9680', 0, 0.95),
    edge: mat('#403e3b', 0.1, 0.8),
    ivory: mat('#d8dfd6', 0.1, 0.65),
    dark: mat('#354551', 0.4, 0.55),
    solar: mat('#31556c', 0.35, 0.35),
    orange: mat('#e89550', 0.1, 0.5),
    cyan: mat('#65aeb4', 0.2, 0.5),
  },
  geometries: {
    base: cylinder(5.2, 0.28, 64),
    soil: cylinder(5.1, 0.12, 64),
    pad: cylinder(2.2, 0.055, 48),
    post: cylinder(0.09, 2.5, 12),
    panel: box(2.2, 0.09, 1.4),
    cell: box(0.012, 0.02, 1.3),
    station: box(1.6, 1.4, 1.3),
    stationTrim: box(1.68, 0.16, 1.38),
    door: box(0.66, 1.1, 0.08),
    step: box(1, 0.12, 0.5),
    antenna: cylinder(0.024, 1.35, 8),
    crate: box(0.8, 0.65, 0.8),
    stripe: box(0.84, 0.08, 0.84),
    marker: box(0.14, 0.04, 0.45),
    rock: { type: 'sphere', radius: 0.35, segments: 6 },
  },
  nodes: [
    mesh('base', 'base', 'edge', [0, -0.22, 0]),
    mesh('terrain', 'soil', 'sand', [0, -0.03, 0]),
    mesh('servicePad', 'pad', 'ivory', [0.7, 0.048, 1]),
    {
      type: 'model',
      id: 'scout',
      name: 'Kestrel survey rover',
      model: 'rover',
      transform: { position: [0.7, 0.09, 1], rotation: [0, -25, 0] },
      tags: ['vehicle', 'hero'],
    },
    mesh('station', 'station', 'ivory', [-2.15, 0.74, -1.8]),
    mesh('stationTop', 'stationTrim', 'orange', [-2.15, 1.49, -1.8]),
    mesh('stationFoot', 'stationTrim', 'dark', [-2.15, 0.12, -1.8]),
    mesh('stationDoor', 'door', 'dark', [-2.15, 0.64, -1.115]),
    mesh('entryStep', 'step', 'ivory', [-2.15, 0.08, -0.85]),
    mesh('antenna', 'antenna', 'dark', [-2.65, 2.2, -1.9]),
    {
      type: 'group',
      id: 'array',
      name: 'Solar collector',
      transform: { position: [0.5, 0, -2.6] },
    },
    mesh('solarPost', 'post', 'dark', [0, 1.25, 0], [0, 0, 0], { parent: 'array' }),
    {
      type: 'group',
      id: 'solarHead',
      parent: 'array',
      transform: { position: [0, 2.5, 0], rotation: [20, 0, 0] },
    },
    mesh('solarPanel', 'panel', 'solar', [0, 0, 0], [0, 0, 0], { parent: 'solarHead' }),
    mesh('solarCells', 'cell', 'ivory', [-0.94, 0.052, 0], [0, 0, 0], {
      parent: 'solarHead',
      pattern: { type: 'linear', count: 9, step: [0.235, 0, 0] },
    }),
    {
      type: 'model',
      id: 'barrels',
      name: 'Supply barrels',
      model: 'barrel',
      transform: { position: [2.7, 0.04, -1.1] },
      pattern: { type: 'linear', count: 3, step: [0, 0, -0.85] },
    },
    mesh('crate1', 'crate', 'orange', [-2.7, 0.37, 0.2]),
    mesh('crate1Band', 'stripe', 'ivory', [-2.7, 0.55, 0.2]),
    mesh('crate2', 'crate', 'dark', [-3.35, 0.37, 1.1]),
    mesh('crate2Band', 'stripe', 'orange', [-3.35, 0.55, 1.1]),
    mesh('padMarks', 'marker', 'orange', [0.7, 0.083, 1], [0, 0, 0], {
      pattern: { type: 'radial', count: 16, radius: 2.02, startAngle: 0, sweep: 360, orient: true },
    }),
  ],
};
for (const [i, p] of [
  [0, [-3.6, 0.13, -2.2]],
  [1, [3.6, 0.09, 1.7]],
  [2, [2.7, 0.14, 3.3]],
  [3, [-1.7, 0.09, 3.6]],
])
  scene.nodes.push({
    ...mesh('rock' + i, 'rock', 'sand', p),
    transform: { position: p, scale: [1, 0.6, 0.8], rotation: [0, i * 37, 10] },
  });
await write('examples/outpost/scenes/main.scene.json', scene);
await write('examples/outpost/forge.project.json', {
  schemaVersion: 1,
  name: 'Kestrel Outpost',
  activeScene: 'main',
  scenes: { main: 'scenes/main.scene.json' },
  models: { rover: 'models/rover.model.json', barrel: 'models/barrel.model.json' },
});
await write('examples/quick-start.batch.json', {
  operations: [
    {
      op: 'putMaterial',
      id: 'enamel',
      material: { color: '#e99045', metalness: 0.2, roughness: 0.4 },
    },
    { op: 'putGeometry', id: 'bodyGeo', geometry: { type: 'box', size: [2, 1, 3] } },
    {
      op: 'putNode',
      node: {
        type: 'mesh',
        id: 'body',
        geometry: 'bodyGeo',
        material: 'enamel',
        transform: { position: [0, 0.5, 0] },
      },
    },
  ],
});
await write('examples/boolean.batch.json', {
  operations: [
    {
      op: 'putMaterial',
      id: 'metal',
      material: { color: '#a9c1bf', metalness: 0.35, roughness: 0.4 },
    },
    { op: 'putGeometry', id: 'block', geometry: { type: 'box', size: [2, 2, 2] } },
    { op: 'putGeometry', id: 'bore', geometry: cylinder(0.65, 3, 32) },
    {
      op: 'putGeometry',
      id: 'bracket',
      geometry: { type: 'boolean', operation: 'subtract', left: 'block', right: 'bore' },
    },
    {
      op: 'putNode',
      node: {
        type: 'mesh',
        id: 'bracket',
        geometry: 'bracket',
        material: 'metal',
        transform: { position: [0, 1, 0] },
      },
    },
  ],
});
console.log('Created the outpost project, reusable models and batch recipes.');
