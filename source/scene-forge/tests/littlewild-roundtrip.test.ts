import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { createCli } from '../src/commands/create-cli.js';

/**
 * Scene Forge's Littlewild writer shares Model Forge's lossless contract: merging into an
 * existing definition keeps that definition's own representation wherever content is unchanged.
 */
const repository = path.resolve(import.meta.dirname, '../../..');
const concepts = path.join(repository, 'docs/concepts');
const sproutling = path.join(concepts, 'littlewild/assets/creatures/sproutling/definition.json');
type Plain = Record<string, any>;

async function withWorkspace(action: (cwd: string, invoke: Invoke) => Promise<void>) {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-littlewild-roundtrip-'));
  const invoke: Invoke = async (args) => {
    let stdout = '',
      stderr = '';
    const status = await createCli({
      cwd,
      stdin: Readable.from(['']),
      writeOut: (s) => {
        stdout += s;
      },
      writeErr: (s) => {
        stderr += s;
      },
    }).run(['--compact', ...args]);
    if (status !== 0) throw new Error(`${args.join(' ')} failed: ${stderr}`);
    return JSON.parse(stdout).data;
  };
  try {
    await action(cwd, invoke);
  } finally {
    await fs.rm(cwd, { recursive: true, force: true });
  }
}
type Invoke = (args: string[]) => Promise<Plain>;

/** Every Littlewild definition with visual models in the concept games. */
async function definitions() {
  const files = (await fs.readdir(concepts, { recursive: true }))
    .filter((file) => file.endsWith('definition.json'))
    .map((file) => path.join(concepts, file))
    .sort();
  const found = [];
  for (const file of files) {
    const value = JSON.parse(await fs.readFile(file, 'utf8'));
    if (value.format === 'littlewild-definition' && value.visual?.models) found.push(file);
  }
  return found;
}

/** A copy of `source` at `<cwd>/<folder>/<family>/<id>/definition.json`, imported into a fresh project. */
async function imported(cwd: string, invoke: Invoke, source: string, folder: string) {
  const definition: Plain = JSON.parse(await fs.readFile(source, 'utf8'));
  const out = path.join(cwd, folder, definition.family, definition.id, 'definition.json');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.copyFile(source, out);
  const project = path.join(cwd, `${folder}-project`);
  await invoke(['init', project]);
  const result = await invoke(['-p', project, 'littlewild', 'import', '--definition', out]);
  return {
    definition,
    out,
    project,
    variantModels: result.variantModels as Record<string, string>,
  };
}

test('every Littlewild concept variant round-trips unedited through import and export', () =>
  withWorkspace(async (cwd, invoke) => {
    const files = await definitions();
    assert.ok(files.length > 50, 'the concept games provide the corpus');
    let variants = 0;
    for (const [index, file] of files.entries()) {
      const { out, project, variantModels } = await imported(cwd, invoke, file, String(index));
      const label = path.relative(concepts, file);
      for (const [variant, model] of Object.entries(variantModels)) {
        // --family comes from the path and the name from the existing definition.
        const args = ['-p', project, 'littlewild', 'export', '--model', model];
        const result = await invoke([...args, '--variant', variant, '--out', out]);
        assert.equal(result.changed, false, `${label} ${variant}`);
        assert.equal(result.written, false, `${label} ${variant}`);
        variants++;
      }
      assert.ok((await fs.readFile(out)).equals(await fs.readFile(file)), `${label} bytes`);
    }
    assert.ok(variants > 200, `${variants} variants`);
  }));

test('an edited variant changes only the edited fields and keeps engine-only data', () =>
  withWorkspace(async (cwd, invoke) => {
    const { definition: before, out, project } = await imported(cwd, invoke, sproutling, 'edit');
    const model = 'sproutlingWorld';
    const bundle = path.join(cwd, 'world.bundle.json');
    await invoke(['-p', project, 'model', 'export', model, '--out', bundle]);
    const edited: Plain = JSON.parse(await fs.readFile(bundle, 'utf8'));
    for (const node of edited.models[model].nodes)
      if (node.id === 'ear-left' || node.id === 'ear-right')
        node.transform = { ...node.transform, scale: [1, 1.15, 1] };
    await fs.writeFile(bundle, JSON.stringify(edited));
    const state = await invoke(['-p', project, 'inspect']);
    const guards = ['--expected-revision', String(state.revision), '--expected-state'];
    await invoke(
      ['-p', project, 'model', 'import', '--file', bundle, '--replace'].concat(
        guards,
        state.stateHash,
      ),
    );
    const exported = ['-p', project, 'littlewild', 'export', '--model', model, '--out', out];
    const dry = await invoke([...exported, '--variant', 'world', '--dry-run']);
    assert.equal(dry.changed, true);
    assert.equal(dry.written, false);
    const written = await invoke([...exported, '--variant', 'world']);
    assert.equal(written.written, true);
    assert.deepEqual(written.warnings, []);
    const after: Plain = JSON.parse(await fs.readFile(out, 'utf8'));
    const expected = structuredClone(before);
    const head = expected.visual.models.world.nodes[1].children[2].children;
    for (const ear of head.filter((node: Plain) => node.id.startsWith('ear-')))
      ear.scale = [1, 1.15, 1];
    assert.deepEqual(after, expected, 'only the two ear scales changed');
    assert.equal(after.visual.models.world.nodes[0].castShadow, false);
    assert.equal(after.visual.materials.gold, '#dfbf70', 'unreferenced palette entries stay');
    assert.equal(typeof after.visual.materials.fur, 'string', 'shared string references stay');
    assert.equal((await fs.readFile(out, 'utf8')).includes('"position": [\n'), true);
  }));
