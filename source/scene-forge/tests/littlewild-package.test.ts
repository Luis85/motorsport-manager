import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { createCli } from '../src/commands/create-cli.js';

async function workspace() {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-creature-'));
  const invoke = async (args: string[]) => {
    let stdout = '',
      stderr = '';
    const cli = createCli({
      cwd,
      stdin: Readable.from([]),
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
  return { cwd, invoke };
}

const appearance = {
  format: 'littlewild-3d-asset',
  schemaVersion: 1,
  category: 'actor',
  id: 'brookling',
  name: 'Brookling',
  materials: { fur: '#caa273' },
  models: {
    round: { nodes: [{ primitive: 'box', id: 'body', material: 'fur', scale: [0.4, 0.6, 0.4] }] },
  },
};

test('model refinement exposes guards and rejects intervening library edits', async (t) => {
  const { cwd, invoke } = await workspace();
  t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  const description = (await invoke(['describe', 'model', 'import'])).json.data;
  assert(
    description.options.some((option: { flags: string }) =>
      option.flags.startsWith('--expected-state'),
    ),
  );
  const file = path.join(cwd, 'visual.json');
  await fs.writeFile(file, JSON.stringify(appearance));
  assert.equal(
    (await invoke(['-p', 'project', 'littlewild', 'import', '--definition', file])).status,
    0,
  );
  const before = (await invoke(['-p', 'project', 'inspect'])).json.data;
  const bundle = path.join(cwd, 'model.json');
  await invoke(['-p', 'project', 'model', 'export', 'brooklingRound', '--out', bundle]);
  const recipe = JSON.parse(await fs.readFile(bundle, 'utf8'));
  recipe.models.brooklingRound.materials.fur.roughness = 0.75;
  await fs.writeFile(bundle, JSON.stringify(recipe));
  const args = [
    '-p',
    'project',
    'model',
    'import',
    '--file',
    bundle,
    '--replace',
    '--expected-revision',
    String(before.revision),
    '--expected-state',
    before.stateHash,
  ];
  assert.equal((await invoke([...args, '--dry-run'])).status, 0);
  assert.equal((await invoke(['-p', 'project', 'inspect'])).json.data.stateHash, before.stateHash);
  assert.equal((await invoke(args)).status, 0);
  const after = (await invoke(['-p', 'project', 'inspect'])).json.data;
  assert.notEqual(after.stateHash, before.stateHash);
  recipe.models.brooklingRound.materials.fur.roughness = 0.25;
  await fs.writeFile(bundle, JSON.stringify(recipe));
  const conflict = await invoke(args);
  assert.equal(conflict.status, 1);
  assert.equal(conflict.json.error.code, 'STATE_CONFLICT');
  assert.equal((await invoke(['-p', 'project', 'inspect'])).json.data.stateHash, after.stateHash);
});

test('creature package import is a guarded visual-only transaction', async (t) => {
  const { cwd, invoke } = await workspace();
  t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  const input = {
    format: 'littlewild-creature-package',
    schemaVersion: 1,
    appearanceManifest: appearance,
    gameplayDefinition: { id: 'brookling' },
    assetReferences: [],
  };
  const file = path.join(cwd, 'creature.json');
  await fs.writeFile(file, JSON.stringify(input));
  const before = (await invoke(['-p', 'project', 'inspect'])).json.data;
  const args = ['-p', 'project', 'littlewild', 'import', '--definition', file];
  const dry = await invoke([...args, '--dry-run', '--expected-state', before.stateHash]);
  assert.equal(dry.status, 0, JSON.stringify(dry.json));
  assert.equal(dry.json.data.importedFacet, 'visual');
  assert.equal(dry.json.data.sourceFormat, input.format);
  assert.match(dry.json.data.warnings[0], /Gameplay/);
  assert.deepEqual(dry.json.data.variants, ['brooklingRound']);
  assert.equal((await invoke(['-p', 'project', 'inspect'])).json.data.stateHash, before.stateHash);
  assert.equal((await invoke([...args, '--expected-state', before.stateHash])).status, 0);
  const modelFile = path.join(cwd, 'project/models/brooklingRound.model.json');
  const original = await fs.readFile(modelFile, 'utf8');
  input.appearanceManifest = { ...appearance, name: 'Updated brookling' };
  await fs.writeFile(file, JSON.stringify(input));
  const stale = await invoke([...args, '--replace', '--expected-state', before.stateHash]);
  assert.equal(stale.status, 1);
  assert.equal(stale.json.error.code, 'STATE_CONFLICT');
  assert.equal(await fs.readFile(modelFile, 'utf8'), original);
  const current = (await invoke(['-p', 'project', 'inspect'])).json.data;
  assert.equal(
    (await invoke([...args, '--replace', '--expected-state', current.stateHash])).status,
    0,
  );
  assert.equal(JSON.parse(await fs.readFile(modelFile, 'utf8')).name, 'Updated brookling (round)');
  assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')), input);
});

test('malformed package envelopes and visuals leave the model library unchanged', async (t) => {
  const { cwd, invoke } = await workspace();
  t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  const before = (await invoke(['-p', 'project', 'inspect'])).json.data.stateHash;
  const file = path.join(cwd, 'invalid.json');
  for (const input of [
    { format: 'littlewild-creature-package', schemaVersion: 2, appearanceManifest: appearance },
    { format: 'littlewild-creature-package', schemaVersion: 1 },
    {
      format: 'littlewild-creature-package',
      schemaVersion: 1,
      appearanceManifest: {
        ...appearance,
        models: { bad: { nodes: [{ primitive: 'unrecognized', material: 'fur' }] } },
      },
    },
  ]) {
    await fs.writeFile(file, JSON.stringify(input));
    const result = await invoke(['-p', 'project', 'littlewild', 'import', '--definition', file]);
    assert.equal(result.status, 1, JSON.stringify(result.json));
    assert.equal((await invoke(['-p', 'project', 'inspect'])).json.data.stateHash, before);
  }
  const catalog = (await invoke(['catalog'])).json.data;
  assert.ok(catalog.littlewild.importFormats.includes('littlewild-creature-package'));
  const description = (await invoke(['describe', 'littlewild', 'import'])).json.data;
  assert.match(JSON.stringify(description), /expected-state/);
});

test('long creature identities retain distinct variant suffixes and normalized collisions fail', async (t) => {
  const { cwd, invoke } = await workspace();
  t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  const file = path.join(cwd, 'long.json');
  const variant = appearance.models.round;
  const visual = {
    ...appearance,
    id: 'a'.repeat(61),
    models: {
      world: variant,
      'world-round': variant,
      'world-long': variant,
      'world-pointed': variant,
    },
  };
  await fs.writeFile(
    file,
    JSON.stringify({
      format: 'littlewild-creature-package',
      schemaVersion: 1,
      appearanceManifest: visual,
    }),
  );
  const imported = await invoke(['-p', 'project', 'littlewild', 'import', '--definition', file]);
  assert.equal(imported.status, 0, JSON.stringify(imported.json));
  assert.equal(imported.json.data.variants.length, 4);
  assert.equal(new Set(imported.json.data.variants).size, 4);
  assert.ok(imported.json.data.variants.every((id: string) => id.length <= 64));
  const before = (await invoke(['-p', 'project', 'inspect'])).json.data.stateHash;
  await fs.writeFile(
    file,
    JSON.stringify({ ...visual, models: { 'world-round': variant, world_round: variant } }),
  );
  const collision = await invoke(['-p', 'project', 'littlewild', 'import', '--definition', file]);
  assert.equal(collision.status, 1);
  assert.equal(collision.json.error.code, 'LITTLEWILD_IMPORT');
  assert.match(collision.json.error.message, /collide/);
  assert.equal((await invoke(['-p', 'project', 'inspect'])).json.data.stateHash, before);
});
