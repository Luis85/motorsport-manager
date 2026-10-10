import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ForgeError } from '../src/kernel/index.js';
import { importDocument } from '../src/infra/importers.js';
import { readDocument } from '../src/infra/store.js';
import { boxModel, copyProject, repository, withTemp } from './helpers.js';

const code = (expected: string) => (error: unknown) => {
  assert.ok(error instanceof ForgeError, String(error));
  assert.equal(error.code, expected, error.message);
  return true;
};
const mochi = path.join(repository, 'docs/concepts/pocket-pet/assets/pets/mochi/definition.json');
const creaturePackage = path.join(
  repository,
  'source/character-studio/tests/fixtures/compiler-v1.package.json',
);
const write = async (file: string, value: unknown) => {
  await fs.writeFile(file, JSON.stringify(value));
  return file;
};

test('a model file imports as revision 0 and a nested source needs a bundle document', () =>
  withTemp(async (directory) => {
    const from = await write(path.join(directory, 'in.json'), { ...boxModel(), revision: 9 });
    const out = path.join(directory, 'crate.model.json');
    const result = await importDocument({ from, out });
    assert.equal(result.revision, 0);
    assert.equal(result.sourceFormat, 'model');
    assert.equal((await readDocument(out)).document.model.revision, 0);
    await assert.rejects(importDocument({ from, out }), code('DOCUMENT_EXISTS'));
    await assert.rejects(
      importDocument({ from, out: path.join(directory, 'other.model.json'), entry: 'crate' }),
      code('INVALID_OPTION'),
    );
    await assert.rejects(
      importDocument({
        from: await write(path.join(directory, 's.json'), { kind: 'scene' }),
        out: path.join(directory, 's.model.json'),
      }),
      code('DOCUMENT_KIND'),
    );
  }));

test('bundles import one entry with exactly its dependency closure', () =>
  withTemp(async (directory) => {
    const from = await write(path.join(directory, 'kit.json'), {
      schemaVersion: 1,
      kind: 'model-bundle',
      entry: 'shelf',
      models: {
        crate: boxModel('crate'),
        spare: boxModel('spare'),
        shelf: {
          schemaVersion: 1,
          kind: 'model',
          id: 'shelf',
          name: 'Shelf',
          nodes: [{ id: 'item', type: 'model', model: 'crate' }],
        },
      },
    });
    await assert.rejects(
      importDocument({ from, out: path.join(directory, 'shelf.model.json') }),
      (error: unknown) => {
        code('DOCUMENT_KIND')(error);
        assert.equal(
          (error as ForgeError & { details: { suggestedPath: string } }).details.suggestedPath,
          'shelf.model-bundle.json',
        );
        return true;
      },
    );
    const out = path.join(directory, 'shelf.model-bundle.json');
    const result = await importDocument({ from, out });
    assert.deepEqual(result.dependencies, ['crate']);
    assert.deepEqual(result.droppedModels, ['spare']);
    const entry = await importDocument({
      from,
      out: path.join(directory, 'spare.model.json'),
      entry: 'spare',
    });
    assert.equal(entry.id, 'spare');
    await assert.rejects(
      importDocument({ from, out: path.join(directory, 'x.model.json'), entry: 'missing' }),
      code('NOT_FOUND'),
    );
  }));

test('scene-forge project models import read-only with their nested closure', () =>
  withTemp(async (directory) => {
    const project = await copyProject('composition', directory);
    const before = await fs.readFile(path.join(project, 'forge.project.json'));
    const out = path.join(directory, 'fieldStation.model-bundle.json');
    const dry = await importDocument({ project, id: 'fieldStation', out, dryRun: true });
    assert.equal(dry.dryRun, true);
    await assert.rejects(fs.access(out), 'dry run writes nothing');
    const result = await importDocument({ project, id: 'fieldStation', out });
    assert.equal(result.sourceFormat, 'scene-forge-project');
    assert.deepEqual(result.dependencies.sort(), [
      'barrel',
      'cargo',
      'habitat',
      'landingPad',
      'platform',
      'rover',
      'solar',
    ]);
    assert.ok(before.equals(await fs.readFile(path.join(project, 'forge.project.json'))));
    await assert.rejects(fs.access(path.join(project, '.forge.lock')), 'no lock left behind');
    await assert.rejects(
      importDocument({ project, id: 'nope', out: path.join(directory, 'nope.model.json') }),
      code('NOT_FOUND'),
    );
    await assert.rejects(
      importDocument({ project, out: path.join(directory, 'a.model.json') }),
      code('INVALID_OPTION'),
    );
    await fs.writeFile(path.join(project, '.forge.lock'), '{}');
    await assert.rejects(
      importDocument({ project, id: 'rover', out: path.join(directory, 'rover.model.json') }),
      code('PROJECT_LOCKED'),
    );
    await assert.rejects(
      importDocument({
        project: directory,
        id: 'rover',
        out: path.join(directory, 'r.model.json'),
      }),
      code('PROJECT_NOT_FOUND'),
    );
  }));

test('project manifests cannot point model files outside the project', () =>
  withTemp(async (directory) => {
    const project = path.join(directory, 'p');
    await fs.mkdir(project);
    await write(path.join(directory, 'outside.model.json'), boxModel('outside'));
    await write(path.join(project, 'forge.project.json'), {
      schemaVersion: 1,
      name: 'p',
      activeScene: 'main',
      scenes: {},
      models: { outside: '../outside.model.json' },
    });
    await assert.rejects(
      importDocument({ project, id: 'outside', out: path.join(directory, 'o.model.json') }),
      code('INVALID_PATH'),
    );
  }));

test('Littlewild definitions import one selected variant and map every variant', () =>
  withTemp(async (directory) => {
    const out = path.join(directory, 'mochi.model.json');
    const result = await importDocument({ from: mochi, out, variant: 'adult-bloom' });
    assert.equal(result.sourceFormat, 'littlewild-definition');
    assert.equal(result.variant, 'adult-bloom');
    assert.equal(result.importedFacet, 'visual');
    assert.deepEqual(Object.keys(result.variantModels!), [
      'egg',
      'baby',
      'teen',
      'adult-bloom',
      'adult-bramble',
    ]);
    assert.equal(result.id, result.variantModels!['adult-bloom']);
    assert.match(result.warnings!.join(' '), /--variant/);
    const first = await importDocument({
      from: mochi,
      out: path.join(directory, 'egg.model.json'),
      prefix: 'pip',
    });
    assert.equal(first.variant, 'egg');
    assert.equal(first.id, 'pipEgg');
    await assert.rejects(
      importDocument({ from: mochi, out: path.join(directory, 'x.model.json'), variant: 'adult' }),
      code('NOT_FOUND'),
    );
  }));

test('creature packages import appearance only and say so', () =>
  withTemp(async (directory) => {
    const result = await importDocument({
      from: creaturePackage,
      out: path.join(directory, 'creature.model.json'),
      variant: 'world-round',
    });
    assert.equal(result.sourceFormat, 'littlewild-creature-package');
    assert.match(result.warnings!.join(' '), /Only appearance models are imported/);
    const definition = JSON.parse(await fs.readFile(creaturePackage, 'utf8'));
    const asset = await importDocument({
      from: await write(path.join(directory, 'asset.json'), definition.appearanceManifest),
      out: path.join(directory, 'asset.model.json'),
    });
    assert.equal(asset.sourceFormat, 'littlewild-3d-asset');
    await assert.rejects(
      importDocument({
        from: await write(path.join(directory, 'v2.json'), { ...definition, schemaVersion: 2 }),
        out: path.join(directory, 'v2.model.json'),
      }),
      code('LITTLEWILD_IMPORT'),
    );
  }));
