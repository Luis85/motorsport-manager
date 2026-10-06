import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { createCli } from '../src/commands/create-cli.js';
import { definitionText } from '../src/infra/littlewild.js';
import { littlewildId } from '../src/application/littlewild.js';

async function workspace() {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-littlewild-'));
  const invoke = async (args: string[]) => {
    let stdout = '',
      stderr = '';
    const cli = createCli({
      cwd,
      stdin: Readable.from(['']),
      writeOut: (s) => {
        stdout += s;
      },
      writeErr: (s) => {
        stderr += s;
      },
    });
    const status = await cli.run(args);
    return { status, json: JSON.parse(status === 0 ? stdout : stderr) };
  };
  assert.equal((await invoke(['init', 'project'])).status, 0);
  const pet = {
    schemaVersion: 1,
    kind: 'model',
    id: 'petBaby',
    name: 'Pet baby',
    parameters: { size: { default: 0.4, min: 0.1, max: 2 } },
    materials: {
      skinTone: { color: '#f2b5c4', roughness: 0.7 },
      ink: { color: '#2b2b33', flatShading: true },
      glow: { color: '#ffffff', emissive: '#ffcc66', emissiveIntensity: 0.5, opacity: 0.5 },
    },
    geometries: {
      egg: {
        type: 'lathe',
        points: [
          [0, -0.5],
          [0.4, -0.35],
          [0.45, 0],
          [0.3, 0.4],
          [0, 0.55],
        ],
        segments: 12,
      },
      eye: { type: 'sphere', radius: 0.06, segments: 8 },
      block: { type: 'box', size: [0.2, { $param: 'size' }, 0.1] },
    },
    nodes: [
      { id: 'bodyRoot', type: 'group', tags: ['rig:body'], transform: { position: [0, 0.5, 0] } },
      { id: 'shell', type: 'mesh', parent: 'bodyRoot', geometry: 'egg', material: 'skinTone' },
      {
        id: 'eyeL',
        type: 'mesh',
        parent: 'bodyRoot',
        geometry: 'eye',
        material: 'ink',
        tags: ['rig:eyes'],
        transform: { position: [-0.12, 0.1, 0.38], rotation: [0, 0, 30] },
      },
      {
        id: 'eyeR',
        type: 'mesh',
        parent: 'bodyRoot',
        geometry: 'eye',
        material: 'ink',
        tags: ['rig:eyes'],
        transform: { position: [0.12, 0.1, 0.38] },
      },
      { id: 'crest', type: 'mesh', parent: 'bodyRoot', geometry: 'block', material: 'glow' },
    ],
  };
  const project = path.join(cwd, 'project');
  await fs.writeFile(path.join(cwd, 'pet.model.json'), JSON.stringify(pet));
  assert.equal(
    (await invoke(['-p', 'project', 'model', 'import', '--file', 'pet.model.json'])).status,
    0,
  );
  return { cwd, project, invoke };
}

test('littlewild IDs become lowercase kebab-case', () => {
  assert.equal(littlewildId('eyeLeft'), 'eye-left');
  assert.equal(littlewildId('Body_Root'), 'body_root');
  assert.equal(littlewildId('--'), 'node');
});

test('definition text keeps numeric vectors on one line', () => {
  assert.equal(
    definitionText({ a: [1, -2.5, 3e-7], b: ['x'] }),
    '{\n  "a": [1, -2.5, 3e-7],\n  "b": [\n    "x"\n  ]\n}\n',
  );
});

test('sync exports pets with baked meshes, native boxes, rigs and variant materials', async () => {
  const { cwd, invoke } = await workspace();
  const manifest = {
    schemaVersion: 1,
    kind: 'littlewild-export',
    target: 'assets',
    assets: [
      {
        id: 'test-pet',
        family: 'pets',
        name: 'Test pet',
        metadata: { radius: 0.6 },
        models: {
          baby: { model: 'petBaby' },
          'baby-blue': {
            model: 'petBaby',
            parameters: { size: 0.6 },
            materials: { skinTone: { color: '#8fc4f2' } },
          },
        },
      },
    ],
  };
  await fs.writeFile(path.join(cwd, 'export.json'), JSON.stringify(manifest));
  const file = path.join(cwd, 'assets/pets/test-pet/definition.json');
  await fs.mkdir(path.dirname(file), { recursive: true });
  // Unrelated variants and facets in an existing wrapper are retained.
  await fs.writeFile(
    file,
    JSON.stringify({
      format: 'littlewild-definition',
      schemaVersion: 1,
      family: 'pets',
      id: 'test-pet',
      visual: {
        materials: { old: '#123456' },
        models: { legacy: { nodes: [{ primitive: 'soft', id: 'blob', material: 'old' }] } },
        metadata: { hitHeight: 1 },
      },
    }),
  );
  const check = await invoke([
    '-p',
    'project',
    'littlewild',
    'sync',
    '--file',
    'export.json',
    '--check',
  ]);
  assert.equal(check.status, 1);
  assert.equal(check.json.error.code, 'LITTLEWILD_STALE');
  const sync = await invoke(['-p', 'project', 'littlewild', 'sync', '--file', 'export.json']);
  assert.equal(sync.status, 0, JSON.stringify(sync.json));
  assert.deepEqual(sync.json.data.stale, ['test-pet']);
  const definition = JSON.parse(await fs.readFile(file, 'utf8'));
  const visual = definition.visual;
  assert.equal(visual.category, 'pet');
  assert.deepEqual(Object.keys(visual.models).sort(), ['baby', 'baby-blue', 'legacy']);
  assert.equal(visual.materials.old, '#123456');
  assert.equal(visual.materials.skinTone.color, '#f2b5c4');
  assert.equal(visual.materials['skinTone-baby-blue'].color, '#8fc4f2');
  assert.equal(visual.materials.glow.transparent, true);
  assert.equal(visual.materials.ink.flatShading, true);
  assert.deepEqual(visual.metadata, { hitHeight: 1, radius: 0.6 });
  assert.deepEqual(visual.rig.baby, { body: 'body-root', eyes: ['eye-l', 'eye-r'] });
  const [root] = visual.models.baby.nodes;
  assert.equal(root.id, 'body-root');
  assert.deepEqual(root.position, [0, 0.5, 0]);
  const byId = Object.fromEntries(root.children.map((n: { id: string }) => [n.id, n]));
  assert.equal(byId.shell.primitive, 'mesh');
  assert.equal(byId['eye-l'].mesh, byId['eye-r'].mesh, 'repeated geometry is baked once');
  assert.ok(Math.abs(byId['eye-l'].rotation[2] - Math.PI / 6) < 1e-4);
  assert.equal(byId.crest.primitive, 'box');
  assert.deepEqual(byId.crest.scale, [0.2, 0.4, 0.1]);
  const blue = visual.models['baby-blue'].nodes[0].children;
  assert.equal(blue.find((n: { id: string }) => n.id === 'shell').material, 'skinTone-baby-blue');
  assert.deepEqual(blue.find((n: { id: string }) => n.id === 'crest').scale, [0.2, 0.6, 0.1]);
  const mesh = visual.meshes[byId.shell.mesh];
  assert.equal(mesh.positions.length % 3, 0);
  assert.equal(mesh.normals.length, mesh.positions.length);
  assert.ok(mesh.indices.every((i: number) => i < mesh.positions.length / 3));
  const again = await invoke([
    '-p',
    'project',
    'littlewild',
    'sync',
    '--file',
    'export.json',
    '--check',
  ]);
  assert.equal(again.status, 0);
  assert.deepEqual(again.json.data.stale, []);
});

test('export rejects mismatched folders and unknown rig roles', async () => {
  const { cwd, invoke } = await workspace();
  const wrong = await invoke([
    '-p',
    'project',
    'littlewild',
    'export',
    '--model',
    'petBaby',
    '--family',
    'pets',
    '--out',
    'x/definition.json',
  ]);
  assert.equal(wrong.status, 1);
  assert.match(wrong.json.error.message, /pets\/x\/definition.json/);
  const model = JSON.parse(
    await fs.readFile(path.join(cwd, 'project/models/petBaby.model.json'), 'utf8'),
  );
  model.nodes[0].tags = ['rig:wings'];
  await fs.writeFile(path.join(cwd, 'project/models/petBaby.model.json'), JSON.stringify(model));
  const role = await invoke([
    '-p',
    'project',
    'littlewild',
    'export',
    '--model',
    'petBaby',
    '--family',
    'pets',
    '--variant',
    'baby',
    '--out',
    'pets/p/definition.json',
  ]);
  assert.equal(role.status, 1);
  assert.equal(role.json.error.code, 'LITTLEWILD_EXPORT');
});

test('import turns Littlewild variants into editable models that export back losslessly', async () => {
  const { cwd, invoke } = await workspace();
  const visual = {
    format: 'littlewild-3d-asset',
    schemaVersion: 1,
    category: 'pet',
    id: 'round-trip',
    name: 'Round trip',
    materials: { fur: '#caa273', eyeWhite: { color: '#faf6de', roughness: 0.5 } },
    models: {
      world: {
        nodes: [
          {
            primitive: 'group',
            id: 'body',
            position: [0, 0.2, 0],
            children: [
              { primitive: 'soft', id: 'head', scale: [0.3, 0.25, 0.3], material: 'fur' },
              {
                primitive: 'box',
                id: 'brow',
                position: [0, 0.3, 0.2],
                rotation: [0, 0, 0.04],
                scale: [0.08, 0.01, 0.02],
                material: 'eyeWhite',
              },
              { primitive: 'cone', id: 'ear', scale: [0.1, 0.2, 0.1], material: '#806040' },
            ],
          },
        ],
      },
    },
    metadata: { radius: 0.4 },
    rig: { world: { body: 'body', head: 'head' } },
  };
  const source = path.join(cwd, 'assets/pets/round-trip/definition.json');
  await fs.mkdir(path.dirname(source), { recursive: true });
  await fs.writeFile(
    source,
    JSON.stringify({
      format: 'littlewild-definition',
      schemaVersion: 1,
      family: 'pets',
      id: 'round-trip',
      visual,
    }),
  );
  const imported = await invoke(['-p', 'project', 'littlewild', 'import', '--definition', source]);
  assert.equal(imported.status, 0, JSON.stringify(imported.json));
  assert.deepEqual(imported.json.data.variants, ['roundTripWorld']);
  const model = JSON.parse(
    await fs.readFile(path.join(cwd, 'project/models/roundTripWorld.model.json'), 'utf8'),
  );
  assert.deepEqual(model.nodes.find((n: { id: string }) => n.id === 'head').tags, ['rig:head']);
  assert.equal(model.geometries['lw-soft'].type, 'mesh');
  const exported = await invoke([
    '-p',
    'project',
    'littlewild',
    'export',
    '--model',
    'roundTripWorld',
    '--family',
    'pets',
    '--variant',
    'world',
    '--name',
    'Round trip',
    '--out',
    source,
  ]);
  assert.equal(exported.status, 0, JSON.stringify(exported.json));
  const result = JSON.parse(await fs.readFile(source, 'utf8')).visual;
  assert.equal(result.meshes, undefined, 'engine primitives return as native primitives');
  const [body] = result.models.world.nodes;
  assert.deepEqual(
    body.children.map((n: { id: string; primitive: string; material: string }) => [
      n.id,
      n.primitive,
      n.material,
    ]),
    [
      ['head', 'soft', 'fur'],
      ['brow', 'box', 'eyeWhite'],
      ['ear', 'cone', 'c806040'],
    ],
  );
  assert.ok(Math.abs(body.children[1].rotation[2] - 0.04) < 1e-6);
  assert.deepEqual(body.children[1].scale, [0.08, 0.01, 0.02]);
  assert.deepEqual(result.rig.world, { body: 'body', head: 'head' });
  assert.equal(result.metadata.radius, 0.4);
});
