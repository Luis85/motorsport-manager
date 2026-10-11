import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parse, LittlewildAssetSchema, writeLittlewildAsset } from '../src/kernel/index.js';
import { libraryOf } from '../src/application/document.js';
import { planImport } from '../src/application/import.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { failure, ok, repository, sceneForgeBin, withTemp } from './helpers.js';

const concepts = path.join(repository, 'docs/concepts');
const sproutling = path.join(concepts, 'littlewild/assets/creatures/sproutling/definition.json');
type Plain = Record<string, any>;
const run = promisify(execFile);

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

test('an unedited Littlewild import re-exports byte-identically through the CLI', () =>
  withTemp(async (cwd) => {
    const target = path.join(cwd, 'assets/creatures/sproutling/definition.json');
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(sproutling, target);
    const source = await fs.readFile(sproutling);
    await ok(['import', '--from', target, '--variant', 'world', '--out', 'world.model.json'], {
      cwd,
    });
    const doc = ['-d', 'world.model.json', 'export', '--format', 'littlewild', '--out', target];
    // --family comes from the path and --name from the existing definition.
    const checked = await ok([...doc, '--check'], { cwd });
    assert.equal(checked.changed, false);
    assert.equal(checked.family, 'creatures');
    assert.deepEqual(checked.warnings, []);
    assert.equal((await ok(doc, { cwd })).written, false);
    assert.ok((await fs.readFile(target)).equals(source), 'the definition keeps its bytes');
    const misplaced = await failure(
      ['-d', 'world.model.json', 'export', '--format', 'glb', '--out', 'w.glb', '--dry-run'],
      { cwd },
    );
    assert.equal(misplaced.code, 'INVALID_OPTION');
    assert.match(misplaced.message, /--dry-run/);
    assert.doesNotMatch(misplaced.message, /dryRun/);
  }));

test('an edited variant changes only the edited fields and keeps engine-only data', () =>
  withTemp(async (cwd) => {
    const target = path.join(cwd, 'creatures/sproutling/definition.json');
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(sproutling, target);
    const before: Plain = JSON.parse(await fs.readFile(sproutling, 'utf8'));
    const doc = ['-d', 'world.model.json'];
    await ok(['import', '--from', target, '--out', 'world.model.json'], { cwd });
    await ok(
      [...doc, 'node', 'edit', '--ids', 'ear-left,ear-right', '--data'].concat(
        '{"transform":{"scale":[1,1.15,1]}}',
      ),
      { cwd },
    );
    const written = await ok([...doc, 'export', '--format', 'littlewild', '--out', target], {
      cwd,
    });
    assert.equal(written.written, true);
    assert.deepEqual(written.warnings, []);
    const after: Plain = JSON.parse(await fs.readFile(target, 'utf8'));
    const expected = structuredClone(before);
    const head = expected.visual.models.world.nodes[1].children[2].children;
    for (const ear of head.filter((node: Plain) => node.id.startsWith('ear-')))
      ear.scale = [1, 1.15, 1];
    assert.deepEqual(after, expected, 'only the two ear scales changed');
    assert.equal(after.visual.models.world.nodes[0].castShadow, false);
    assert.equal(after.visual.materials.gold, '#dfbf70', 'unreferenced palette entries stay');
    assert.equal((await fs.readFile(target, 'utf8')).includes('"position": [\n'), true);

    // A changed material is re-exported and shared, with the retained-variant warning.
    await ok([...doc, 'put', 'material', 'fur', '--data', '{"color":"#aa7744"}'], { cwd });
    const recolored = await ok([...doc, 'export', '--format', 'littlewild', '--out', target], {
      cwd,
    });
    const definition: Plain = JSON.parse(await fs.readFile(target, 'utf8'));
    assert.equal(definition.visual.materials.fur.color, '#aa7744');
    assert.equal(definition.visual.materials.light, '#eed8b4');
    assert.match(recolored.warnings.join(' '), /world-round now uses the re-exported material fur/);
    assert.deepEqual(definition.visual.models['world-round'], before.visual.models['world-round']);
  }));

test('every Littlewild concept variant round-trips unedited, with or without the CLI', async () => {
  const files = await definitions();
  assert.ok(files.length > 50, 'the concept games provide the corpus');
  let variants = 0;
  await withTemp(async (cwd) => {
    for (const [index, file] of files.entries()) {
      const definition: Plain = JSON.parse(await fs.readFile(file, 'utf8'));
      const out = path.join(
        cwd,
        String(index),
        definition.family,
        definition.id,
        'definition.json',
      );
      await fs.mkdir(path.dirname(out), { recursive: true });
      await fs.copyFile(file, out);
      for (const variant of Object.keys(definition.visual.models)) {
        const { document } = planImport(definition, 'model-bundle', { variant });
        const asset = parse(LittlewildAssetSchema, {
          id: definition.id,
          family: definition.family,
          name: definition.visual.name,
          models: { [variant]: { model: document.model.id } },
        });
        const result = await writeLittlewildAsset(asset, libraryOf(document), out, {
          check: true,
        });
        assert.equal(result.changed, false, `${path.relative(concepts, file)} ${variant}`);
        variants++;
      }
    }
    // The kernel writer has one lossless contract (it used to normalize unless asked to
    // preserve): a plain write, as Scene Forge's commands make it, keeps the definition.
    const definition: Plain = JSON.parse(await fs.readFile(sproutling, 'utf8'));
    const { document } = planImport(definition, 'model', { variant: 'world' });
    const asset = parse(LittlewildAssetSchema, {
      id: 'sproutling',
      family: 'creatures',
      name: 'Sproutling',
      models: { world: { model: document.model.id } },
    });
    const out = path.join(cwd, 'plain/creatures/sproutling/definition.json');
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.copyFile(sproutling, out);
    const plain = await writeLittlewildAsset(asset, libraryOf(document), out, {});
    assert.equal(plain.changed, false);
    const written: Plain = JSON.parse(await fs.readFile(out, 'utf8'));
    assert.equal(typeof written.visual.materials.fur, 'string');
    assert.ok((await fs.readFile(out)).equals(await fs.readFile(sproutling)));
  });
  assert.ok(variants > 200, `${variants} variants`);
});

/** Scene Forge's checked-in executable, the other writer of Littlewild definitions. */
async function sceneForge(cwd: string, ...args: string[]) {
  const { stdout } = await run(process.execPath, [sceneForgeBin, '--compact', ...args], {
    cwd,
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(stdout).data;
}

test('Model Forge and Scene Forge write identical Littlewild bytes, new or merged and edited', () =>
  withTemp(async (cwd) => {
    const copy = async (folder: string) => {
      const out = path.join(cwd, folder, 'creatures/sproutling/definition.json');
      await fs.mkdir(path.dirname(out), { recursive: true });
      await fs.copyFile(sproutling, out);
      return out;
    };
    const [mf, sf] = [await copy('mf'), await copy('sf')];
    const doc = ['-d', 'world.model.json'];
    await ok(['import', '--from', mf, '--variant', 'world', '--out', 'world.model.json'], { cwd });
    await ok(
      [...doc, 'node', 'edit', '--ids', 'ear-left,ear-right', '--data'].concat(
        '{"transform":{"scale":[1,1.15,1]}}',
      ),
      { cwd },
    );
    await ok([...doc, 'export', '--format', 'littlewild', '--out', mf], { cwd });

    // The same edit in Scene Forge: import, refine the model through a guarded bundle, export.
    const project = path.join(cwd, 'project'),
      model = 'sproutlingWorld',
      bundle = path.join(cwd, 'world.bundle.json');
    await sceneForge(cwd, 'init', project);
    await sceneForge(cwd, '-p', project, 'littlewild', 'import', '--definition', sf);
    await sceneForge(cwd, '-p', project, 'model', 'export', model, '--out', bundle);
    const edited: Plain = JSON.parse(await fs.readFile(bundle, 'utf8'));
    for (const node of edited.models[model].nodes)
      if (node.id === 'ear-left' || node.id === 'ear-right')
        node.transform = { ...node.transform, scale: [1, 1.15, 1] };
    await fs.writeFile(bundle, JSON.stringify(edited));
    const state = await sceneForge(cwd, '-p', project, 'inspect');
    await sceneForge(
      cwd,
      ...['-p', project, 'model', 'import', '--file', bundle, '--replace'],
      ...['--expected-revision', String(state.revision), '--expected-state', state.stateHash],
    );
    const lw = ['-p', project, 'littlewild', 'export', '--model', model, '--variant', 'world'];
    await sceneForge(cwd, ...lw, '--out', sf);
    const merged = await fs.readFile(mf, 'utf8');
    assert.notEqual(merged, await fs.readFile(sproutling, 'utf8'), 'the edit was exported');
    assert.equal(await fs.readFile(sf, 'utf8'), merged, 'merged definitions are identical');

    // New definitions: both write the canonical form.
    const fresh = (folder: string) =>
      path.join(cwd, folder, 'creatures/sproutling/definition.json');
    await ok(
      [...doc, 'export', '--format', 'littlewild', '--name', 'Sproutling', '--out'].concat(
        fresh('mf-new'),
      ),
      { cwd },
    );
    await sceneForge(cwd, ...lw, '--name', 'Sproutling', '--out', fresh('sf-new'));
    assert.equal(
      await fs.readFile(fresh('sf-new'), 'utf8'),
      await fs.readFile(fresh('mf-new'), 'utf8'),
      'new definitions are identical',
    );
  }));
