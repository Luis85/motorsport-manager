/** Original stylized vehicles; guarded authoring, never hand-patched compiled exports. */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { formatAuthoredJson } from './format-authored-json.mjs';
const root = resolve(import.meta.dirname, '../../..');
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index < 0 ? fallback : args[index + 1];
};
const models = option('models', 'source/model-forge/examples/armored-platoon');
const project = option('project', 'source/scene-forge/examples/armored-platoon');
const output = `${project}/exports`;
const evidence = [];
if (args.includes('--normalize-only')) {
  await formatAuthoredJson(resolve(root, models));
  await formatAuthoredJson(resolve(root, project));
  console.log('Normalized authored JSON with pinned Prettier; all parsed values preserved.');
  process.exit(0);
}
function cli(tool, args) {
  const execution = spawnSync(resolve(root, 'bin', tool), ['--compact', ...args], {
    cwd: root,
    encoding: 'utf8',
  });
  const value = JSON.parse(execution.stdout || execution.stderr);
  if (execution.status !== 0 || !value.ok) throw new Error(JSON.stringify(value));
  evidence.push({ tool, args, result: value.data });
  return value.data;
}
function json(path, value) {
  writeFileSync(resolve(root, path), JSON.stringify(value, null, 2) + '\n');
}
function recipe(german) {
  const operations = [];
  const material = (id, color, metalness = 0.2) =>
    operations.push({
      op: 'putMaterial',
      id,
      material: { color, roughness: 0.84, metalness, flatShading: true },
    });
  const geometry = (id, value) => operations.push({ op: 'putGeometry', id, geometry: value });
  const node = (id, type, parent, position, extra = {}) =>
    operations.push({
      op: 'putNode',
      node: { id, type, ...(parent ? { parent } : {}), transform: { position }, ...extra },
    });
  const group = (id, parent, at, tags = []) => node(id, 'group', parent, at, { tags });
  const mesh = (id, geo, mat, parent, at, extra = {}) =>
    node(id, 'mesh', parent, at, { geometry: geo, material: mat, ...extra });
  const box = (id, size) => geometry(id, { type: 'box', size });
  const cylinder = (id, radius, height, segments = 16) =>
    geometry(id, { type: 'cylinder', radiusTop: radius, radiusBottom: radius, height, segments });
  material('armor', german ? '#857b59' : '#62714b');
  material('raised', german ? '#a19973' : '#78855b');
  material('dark', '#323b32');
  material('track', '#292c29', 0.65);
  material('steel', '#77786d', 0.7);
  material('rubber', '#202521', 0);
  material('markings', german ? '#ece5cd' : '#e3dfc9', 0);
  material('glass', '#536c73', 0.6);
  material('mud', '#685c42', 0);
  box('lowerHull', [2.15, 0.65, german ? 4.5 : 4.2]);
  box('deck', [2.8, 0.3, 4.9]);
  box('sidePlate', [0.14, 0.65, 4.2]);
  box('frontSlope', [2.58, 0.12, 1.25]);
  box('rearPlate', [2.62, 0.65, 0.18]);
  box('fender', [0.57, 0.12, 5.5]);
  box('trackShoe', [0.48, 0.12, 0.24]);
  cylinder('wheel', german ? 0.29 : 0.37, 0.36, 16);
  cylinder('wheelHub', german ? 0.15 : 0.19, 0.41, 12);
  cylinder('sprocket', 0.42, 0.4, 14);
  cylinder('turretRing', german ? 1 : 0.99, 0.15, 20);
  cylinder('hatch', 0.3, 0.08, 14);
  cylinder('cupola', 0.38, 0.22, 16);
  cylinder('gunTube', german ? 0.065 : 0.073, german ? 3.3 : 2.4, 16);
  cylinder('gunSleeve', 0.13, 0.65, 16);
  cylinder('muzzle', 0.1, 0.26, 12);
  box('muzzleBaffle', [0.34, 0.23, 0.38]);
  box('blackMuzzle', [0.12, 0.11, 0.015]);
  box('mantlet', german ? [0.9, 0.62, 0.32] : [1.27, 0.6, 0.35]);
  box('vent', [1.62, 0.065, 0.08]);
  box('stowage', [1.4, 0.45, 0.38]);
  box('tool', [0.08, 0.055, 1.6]);
  box('vision', [0.32, 0.11, 0.075]);
  box('crossLong', [0.04, 0.36, 0.065]);
  box('crossWide', [0.04, 0.065, 0.36]);
  cylinder('antenna', 0.011, 1.6, 6);
  cylinder('exhaust', 0.11, 0.65, 10);
  box('volumeEngine', [1.65, 0.65, 1.5]);
  box('volumeAmmo', [0.62, 0.65, 0.9]);
  if (german) {
    geometry('turretShell', {
      type: 'extrude',
      points: [
        [-1.0, -0.8],
        [1.0, -0.8],
        [0.93, 0.7],
        [0.6, 1.25],
        [-0.6, 1.25],
        [-0.93, 0.7],
      ],
      depth: 0.75,
      bevel: 0.035,
    });
    box('schurzen', [0.075, 0.7, 0.93]);
  } else {
    geometry('turretShell', { type: 'sphere', radius: 1, segments: 20 });
    box('bogie', [0.14, 0.48, 0.8]);
  }
  group('chassis', null, [0, 0, 0], ['articulation:hull']);
  mesh('lowerHull', 'lowerHull', 'dark', 'chassis', [0, 0.76, 0]);
  mesh('upperDeck', 'deck', 'armor', 'chassis', [0, 1.36, -0.04]);
  mesh('glacis', 'frontSlope', 'armor', 'chassis', [0, 1.13, 2.1], {
    transform: { position: [0, 1.13, 2.1], rotation: [german ? -30 : -44, 0, 0] },
  });
  mesh('rearPlate', 'rearPlate', 'armor', 'chassis', [0, 1.0, -2.4]);
  for (const side of [-1, 1]) {
    const prefix = side < 0 ? 'left' : 'right';
    group(`${prefix}Track`, 'chassis', [side * 1.38, 0, 0], [`articulation:${prefix}Track`]);
    mesh(`${prefix}SideArmor`, 'sidePlate', 'armor', 'chassis', [side * 1.27, 1.13, -0.05]);
    mesh(`${prefix}Fender`, 'fender', 'armor', 'chassis', [side * 1.42, 1.33, 0]);
    const count = german ? 8 : 6;
    for (let index = 0; index < count; index++) {
      const z = -1.8 + (index * 3.6) / (count - 1);
      group(
        `${prefix}Wheel${index}`,
        `${prefix}Track`,
        [0, german ? 0.48 : 0.51, z],
        [`articulation:${prefix}Wheel${index}`],
      );
      mesh(`${prefix}Tire${index}`, 'wheel', 'rubber', `${prefix}Wheel${index}`, [0, 0, 0], {
        transform: { position: [0, 0, 0], rotation: [0, 0, 90] },
      });
      mesh(
        `${prefix}Hub${index}`,
        'wheelHub',
        'raised',
        `${prefix}Wheel${index}`,
        [side * 0.03, 0, 0],
        { transform: { position: [side * 0.03, 0, 0], rotation: [0, 0, 90] } },
      );
    }
    for (const z of [-2.27, 2.27])
      mesh(
        `${prefix}Sprocket${z < 0 ? 'Rear' : 'Front'}`,
        'sprocket',
        'steel',
        `${prefix}Track`,
        [0, 0.65, z],
        { transform: { position: [0, 0.65, z], rotation: [0, 0, 90] } },
      );
    for (let n = 0; n < 21; n++)
      for (const upper of [false, true]) {
        mesh(
          `${prefix}Shoe${upper ? 'Top' : 'Bottom'}${n}`,
          'trackShoe',
          n % 4 === 0 ? 'mud' : 'track',
          `${prefix}Track`,
          [0, upper ? 1.1 : 0.1, -2.3 + n * 0.23],
        );
      }
    for (const end of [-1, 1])
      for (let n = 1; n < 6; n++) {
        const angle = -Math.PI / 2 + (n * Math.PI) / 6;
        const at = [0, 0.6 + Math.sin(angle) * 0.5, end * (2.3 + Math.cos(angle) * 0.5)];
        mesh(
          `${prefix}ShoeArc${end < 0 ? 'Rear' : 'Front'}${n}`,
          'trackShoe',
          'track',
          `${prefix}Track`,
          at,
          { transform: { position: at, rotation: [(-end * angle * 180) / Math.PI + 90, 0, 0] } },
        );
      }
    if (german)
      for (let n = 0; n < 5; n++)
        mesh(`${prefix}Skirt${n}`, 'schurzen', n % 2 ? 'raised' : 'armor', 'chassis', [
          side * 1.74,
          1.1,
          -2 + n,
        ]);
    else
      for (let n = 0; n < 3; n++)
        mesh(`${prefix}Bogie${n}`, 'bogie', 'armor', 'chassis', [
          side * 1.55,
          0.66,
          -1.45 + n * 1.45,
        ]);
    mesh(`${prefix}Tool`, 'tool', 'steel', 'chassis', [side * 1.0, 1.55, -1.2]);
  }
  for (let n = 0; n < 9; n++)
    mesh(`engineVent${n}`, 'vent', 'dark', 'chassis', [0, 1.54, -2.03 + n * 0.12]);
  mesh('engineVolume', 'volumeEngine', 'dark', 'chassis', [0, 0.93, -1.48], {
    visible: false,
    tags: ['volume:engine'],
  });
  mesh('ammoVolume', 'volumeAmmo', 'dark', 'chassis', [0.65, 0.95, 0.2], {
    visible: false,
    tags: ['volume:ammunition'],
  });
  mesh('turretRing', 'turretRing', 'dark', 'chassis', [0, 1.58, 0.28]);
  group('turretPivot', 'chassis', [0, 1.65, 0.28], ['articulation:turret']);
  mesh('turretShell', 'turretShell', 'armor', 'turretPivot', [0, 0.36, 0], {
    transform: german
      ? { position: [0, 0.03, 0], rotation: [-90, 0, 0] }
      : { position: [0, 0.29, 0], scale: [1.03, 0.53, 1.16] },
  });
  mesh('turretStowage', 'stowage', 'raised', 'turretPivot', [0, 0.31, -1.02]);
  mesh('cupola', 'cupola', 'raised', 'turretPivot', [german ? 0 : -0.34, 0.82, -0.42]);
  mesh('commanderHatch', 'hatch', 'armor', 'turretPivot', [german ? 0 : -0.34, 0.98, -0.42]);
  mesh('loaderHatch', 'hatch', 'armor', 'turretPivot', [0.4, 0.8, 0.25]);
  mesh('sight', 'vision', 'glass', 'turretPivot', [0.5, 0.63, 0.95]);
  mesh('antenna', 'antenna', 'dark', 'turretPivot', [-0.75, 1.42, -0.72]);
  group('commanderSocket', 'turretPivot', [-0.34, 1.1, -0.42], ['socket:commander']);
  group('opticSocket', 'turretPivot', [0.42, 0.65, 0.96], ['socket:optic']);
  group('gunPivot', 'turretPivot', [0, 0.32, 1.05], ['articulation:gun']);
  mesh('mantlet', 'mantlet', 'raised', 'gunPivot', [0, 0, 0]);
  group('recoilSlide', 'gunPivot', [0, 0, 0], ['articulation:recoil']);
  const barrel = german ? 3.3 : 2.4;
  mesh('barrel', 'gunTube', 'armor', 'recoilSlide', [0, 0, barrel / 2], {
    transform: { position: [0, 0, barrel / 2], rotation: [90, 0, 0] },
  });
  mesh('gunSleeve', 'gunSleeve', 'raised', 'recoilSlide', [0, 0, 0.37], {
    transform: { position: [0, 0, 0.37], rotation: [90, 0, 0] },
  });
  mesh('muzzleBrake', german ? 'muzzleBaffle' : 'muzzle', 'dark', 'recoilSlide', [0, 0, barrel], {
    transform: { position: [0, 0, barrel], rotation: german ? [0, 0, 0] : [90, 0, 0] },
  });
  mesh('muzzleBore', 'blackMuzzle', 'rubber', 'recoilSlide', [0, 0, barrel + 0.2]);
  group('muzzleSocket', 'recoilSlide', [0, 0, barrel + 0.22], ['socket:muzzle']);
  group('exhaustSocket', 'chassis', [0.75, 1, -2.54], ['socket:exhaust']);
  return { operations };
}
for (const directory of [models, output]) mkdirSync(resolve(root, directory), { recursive: true });
if (existsSync(resolve(root, project, 'forge.project.json')))
  throw new Error('Choose fresh authoring paths; existing Scene Forge project is protected.');
cli('scene-forge', ['init', project, '--name', 'Armored Platoon original vehicle library']);
for (const [id, name, german] of [
  ['m4-sherman', 'M4 Sherman study', false],
  ['panzer-iv', 'Panzer IV study', true],
]) {
  const doc = `${models}/${id}.model.json`;
  const batch = `${models}/${id}.batch.json`;
  const bundle = `${models}/${id}.model-bundle.json`;
  json(batch, recipe(german));
  cli('model-forge', ['create', doc, '--id', id, '--name', name, '--category', 'vehicles']);
  const before = cli('model-forge', ['-d', doc, 'inspect', '--source']);
  const guard = [
    '--expected-revision',
    String(before.revision),
    '--expected-state',
    before.stateHash,
  ];
  cli('model-forge', ['-d', doc, 'apply', '--file', batch, ...guard, '--dry-run']);
  cli('model-forge', ['-d', doc, 'apply', '--file', batch, ...guard]);
  cli('model-forge', ['-d', doc, 'validate']);
  cli('model-forge', ['-d', doc, 'node', 'list', '--details', '--limit', '1000']);
  cli('model-forge', ['-d', doc, 'audit', '--strict']);
  cli('model-forge', ['-d', doc, 'export', '--format', 'model-bundle', '--out', bundle]);
  const scene = cli('scene-forge', ['-p', project, 'inspect', '--source']);
  const sceneGuard = [
    '--expected-revision',
    String(scene.revision),
    '--expected-state',
    scene.stateHash,
  ];
  cli('scene-forge', [
    '-p',
    project,
    'model',
    'import',
    '--file',
    bundle,
    ...sceneGuard,
    '--dry-run',
  ]);
  cli('scene-forge', ['-p', project, 'model', 'import', '--file', bundle, ...sceneGuard]);
  cli('scene-forge', [
    '-p',
    project,
    'export',
    '--format',
    'three',
    '--model',
    id,
    '--out',
    `${output}/${id}.three.json`,
  ]);
}
// Execution identity and guarded mutation receipts; omit large duplicated node/mesh payloads.
json(
  `${models}/workflow.json`,
  evidence.map(({ tool, args, result }) => ({
    tool,
    args,
    result: {
      revision: result.revision,
      stateHash: result.stateHash,
      proposedRevision: result.proposedRevision,
      proposedStateHash: result.proposedStateHash,
      valid: result.valid,
      stats: result.stats,
      changes: result.changes,
      dryRun: result.dryRun,
      path: result.path,
    },
  })),
);
await formatAuthoredJson(resolve(root, models));
await formatAuthoredJson(resolve(root, project));
console.log('Authored both tanks through guarded Model Forge and Scene Forge workflows.');
