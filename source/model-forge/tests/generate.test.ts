import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { generators } from '../src/application/generators/index.js';
import { buildDocument, findGenerator, resolveRecipe } from '../src/application/generate.js';
import { validateEditorDocument } from '../src/application/document.js';
import { ForgeError } from '../src/kernel/index.js';
import { cli, failure, ok, sceneForgeBin, withTemp } from './helpers.js';

const run = promisify(execFile);
const sha256 = async (file: string) =>
  createHash('sha256')
    .update(await fs.readFile(file))
    .digest('hex');
const exists = (file: string) =>
  fs.access(file).then(
    () => true,
    () => false,
  );

/**
 * Golden bytes of every generator's default preset at seed 1, written as <generator>.model.json.
 * A change here changes generator output: bump that generator's version and say so.
 */
const golden: Record<string, string> = {
  rock: 'fc7a3f7a9909628481123314fc82156145c5de0672eb90c85f9436e798710e59',
  tree: 'd9e64b3cc2fedd0e261d461ffcb8d8c8fc31b3c194c1ac563e7705ba65bc4583',
  bush: '363b84980ba44ecdba5beacfa222358bfd2c8b57843deae6cd59417dde7e7655',
  crate: '63d2287def2770e4a2993e413a1a1beb415e466c5bb0c1606dce8718b47fcf8f',
  barrel: '5e3864b009e904d371b05282979832e88862cd7ce66eb0450be856362e09a0fa',
  fence: '676aa17e566504aa75bf02bd14a39f9991738be2dec3226c505f0ce8fb1a6773',
  building: '159cf647605b350edfa0e332b39a971ac3d315a92c6cbaa83143082c4f7e26a3',
  terrain: '2f374135ff0ea2c7d967881ce0d48c511345a5d9222ad1a4f1c65742306131db',
};

test('generate list and show describe every generator, its presets and parameters', async () => {
  const list = await ok(['generate', 'list']);
  assert.deepEqual(
    list.generators.map((g: { id: string }) => g.id),
    ['rock', 'tree', 'bush', 'crate', 'barrel', 'fence', 'building', 'terrain'],
  );
  assert.deepEqual(await ok(['generate']), list, 'generate alone lists the catalog');
  for (const summary of list.generators) {
    assert.ok(summary.presets.length >= 3, `${summary.id} has presets`);
    assert.match(summary.example, new RegExp(`^generate ${summary.id} --preset `));
    const shown = await ok(['generate', 'show', summary.id]);
    assert.equal(shown.parameterSchema.type, 'object');
    assert.deepEqual(Object.keys(shown.defaults), Object.keys(shown.parameterSchema.properties));
    for (const preset of shown.presets)
      assert.deepEqual(Object.keys(preset.parameters).sort(), Object.keys(shown.defaults).sort());
    assert.ok(shown.limits.maxTriangles > 0);
    const described = await ok(['describe', 'generate', summary.id]);
    assert.ok(described.options.some((o: { flags: string }) => o.flags.startsWith('--preset')));
  }
  for (const args of [
    ['generate', 'show', 'tower'],
    ['generate', 'tower', '--out', 'tower.model.json'],
  ]) {
    const error = await failure(args);
    assert.equal(error.code, 'GENERATOR_NOT_FOUND');
    assert.ok(error.details.available.includes('tree'));
    assert.match(error.hint!, /generate list/);
  }
  const unnamed = await failure(['generate', '--file', 'r.generate.json', '--out', 'r.model.json']);
  assert.equal(unnamed.code, 'INVALID_OPTION');
  assert.match(unnamed.hint!, /"generator" field/);
});

test('every preset builds a valid document within its triangle budget', () => {
  for (const generator of generators)
    for (const preset of Object.keys(generator.presets)) {
      const { recipe } = resolveRecipe(generator, { preset, seed: 9, defaultId: 'sample' });
      const { document, stats } = buildDocument(generator, recipe);
      assert.ok(stats.triangles > 0 && stats.triangles <= generator.limits.maxTriangles);
      assert.ok(stats.meshes > 0, `${generator.id}/${preset} has meshes`);
      assert.deepEqual(validateEditorDocument(document).stats.warnings, []);
      assert.ok(Object.keys(document.model.parameters).length >= 1, 'stays parametric');
      // Every number is rounded to 1e-4.
      JSON.stringify(document, (_, value) => {
        if (typeof value === 'number') assert.equal(Math.round(value * 1e4) / 1e4, value);
        return value;
      });
    }
  const tight = { ...findGenerator('rock'), limits: { maxTriangles: 10 } };
  const { recipe } = resolveRecipe(tight, { defaultId: 'rock' });
  assert.throws(
    () => buildDocument(tight, recipe),
    (error: unknown) =>
      error instanceof ForgeError &&
      error.code === 'PROCEDURAL_BUDGET' &&
      (error.details as { limit: number }).limit === 10,
  );
});

test('golden bytes per generator; same seed gives identical bytes, another seed differs', () =>
  withTemp(async (cwd) => {
    const actual: Record<string, string> = {};
    for (const generator of generators) {
      const id = generator.id;
      const result = await ok(['generate', id, '--out', `${id}.model.json`], { cwd });
      assert.equal(result.seed, 1);
      assert.equal(result.preset, generator.defaultPreset);
      actual[id] = await sha256(path.join(cwd, `${id}.model.json`));
      await ok(['generate', id, '--seed', '1', '--out', `again/${id}.model.json`], { cwd });
      assert.equal(await sha256(path.join(cwd, `again/${id}.model.json`)), actual[id]);
      await ok(['generate', id, '--seed', '2', '--out', `other/${id}.model.json`], { cwd });
      assert.notEqual(await sha256(path.join(cwd, `other/${id}.model.json`)), actual[id]);
      const other = JSON.parse(await fs.readFile(path.join(cwd, `other/${id}.model.json`), 'utf8'));
      const first = JSON.parse(await fs.readFile(path.join(cwd, `${id}.model.json`), 'utf8'));
      delete other.description;
      delete first.description;
      assert.notDeepEqual(other, first, `${id}: the seed changes content, not only metadata`);
    }
    assert.deepEqual(actual, golden);
  }));

test('a generated document validates, exports a valid GLB and imports into Scene Forge', () =>
  withTemp(async (cwd) => {
    await run(process.execPath, [sceneForgeBin, 'init', 'project', '--name', 'Generated'], { cwd });
    for (const generator of generators) {
      const file = `${generator.id}.model.json`;
      const generated = await ok(['generate', generator.id, '--seed', '5', '--out', file], { cwd });
      const document = generated.documents[0];
      const validated = await ok(['-d', file, 'validate'], { cwd });
      assert.equal(validated.stateHash, document.stateHash);
      const exported = await ok(
        ['-d', file, 'export', '--format', 'glb', '--validate', '--out', `${generator.id}.glb`],
        { cwd },
      );
      assert.equal(exported.validation.numErrors, 0);
      const { stdout } = await run(
        process.execPath,
        [
          sceneForgeBin,
          '--compact',
          '-p',
          'project',
          'model',
          'import',
          '--file',
          file,
          '--dry-run',
        ],
        { cwd, maxBuffer: 64 * 1024 * 1024 },
      );
      assert.equal(JSON.parse(stdout).data.id, generator.id);
      assert.ok(
        generated.nextCommands.some((c: string[]) => c.includes('scene-forge')),
        'nextCommands names the Scene Forge handoff',
      );
    }
  }));

test('sidecar recipes replay byte-identically; presets, --set and the recipe layer in order', () =>
  withTemp(async (cwd) => {
    const result = await ok(
      [
        'generate',
        'tree',
        '--preset',
        'conifer',
        '--seed',
        '42',
        '--set',
        'tiers=4',
        '--set',
        'leafColor=#336633',
        '--out',
        'fir.model.json',
      ],
      { cwd },
    );
    const sidecar = JSON.parse(await fs.readFile(path.join(cwd, 'fir.generate.json'), 'utf8'));
    assert.equal(result.documents[0].recipe, path.join(cwd, 'fir.generate.json'));
    assert.deepEqual(
      {
        kind: sidecar.kind,
        generator: sidecar.generator,
        version: sidecar.version,
        seed: sidecar.seed,
        preset: sidecar.preset,
        id: sidecar.id,
      },
      {
        kind: 'generator-recipe',
        generator: 'tree',
        version: 1,
        seed: 42,
        preset: 'conifer',
        id: 'fir',
      },
    );
    assert.equal(sidecar.parameters.kind, 'conifer');
    assert.equal(sidecar.parameters.tiers, 4);
    assert.equal(sidecar.parameters.leafColor, '#336633');
    assert.equal(Object.keys(sidecar.parameters).length, 11, 'every parameter is resolved');
    const replay = await ok(
      ['generate', 'tree', '--file', 'fir.generate.json', '--out', 'copy/fir.model.json'],
      { cwd },
    );
    assert.equal(replay.recipeHash, result.recipeHash);
    assert.equal(
      await sha256(path.join(cwd, 'copy/fir.model.json')),
      await sha256(path.join(cwd, 'fir.model.json')),
    );
    const data = JSON.stringify({
      schemaVersion: 1,
      kind: 'generator-recipe',
      generator: 'tree',
      seed: 42,
      parameters: { tiers: 3 },
    });
    const layered = await ok(
      [
        'generate',
        'tree',
        '--data',
        data,
        '--set',
        'tiers=5',
        '--seed',
        '7',
        '--out',
        'layered.model.json',
      ],
      { cwd },
    );
    assert.equal(layered.parameters.tiers, 5);
    assert.equal(layered.seed, 7);
    const errors = await Promise.all([
      failure(['generate', 'rock', '--file', 'fir.generate.json', '--out', 'r.model.json'], {
        cwd,
      }),
      failure(['generate', 'rock', '--set', 'colour=#ffffff', '--out', 'r.model.json'], { cwd }),
      failure(['generate', 'rock', '--set', 'size=50', '--out', 'r.model.json'], { cwd }),
      failure(['generate', 'rock', '--set', 'size', '--out', 'r.model.json'], { cwd }),
      failure(['generate', 'rock', '--preset', 'giant', '--out', 'r.model.json'], { cwd }),
      failure(['generate', 'rock', '--seed', '4294967296', '--out', 'r.model.json'], { cwd }),
      failure(['generate', 'rock', '--out', 'r.json'], { cwd }),
    ]);
    assert.deepEqual(
      errors.map((e) => e.code),
      [
        'INVALID_OPTION',
        'UNKNOWN_PARAMETER',
        'SCHEMA_INVALID',
        'INVALID_OPTION',
        'INVALID_OPTION',
        'INVALID_OPTION',
        'DOCUMENT_KIND',
      ],
    );
    assert.deepEqual(errors[4].details.available, ['pebble', 'stone', 'boulder']);
    assert.match(errors[1].hint!, /size/);
    assert.match(errors[2].hint!, /generate show rock/);
  }));

test('--count writes numbered documents with consecutive seeds; dry runs write nothing', () =>
  withTemp(async (cwd) => {
    const planned = await ok(
      ['generate', 'crate', '--count', '3', '--seed', '10', '--out', 'crates', '--dry-run'],
      { cwd },
    );
    assert.equal(planned.dryRun, true);
    assert.equal(await exists(path.join(cwd, 'crates')), false);
    assert.equal(planned.nextCommands, undefined);
    const single = await ok(
      ['generate', 'rock', '--out', 'rock.model.json', '--dry-run', '--review', 'r'],
      { cwd },
    );
    assert.deepEqual(await fs.readdir(cwd), []);
    assert.match(single.review.skipped, /dry run/);
    const result = await ok(
      ['generate', 'crate', '--count', '3', '--seed', '10', '--out', 'crates'],
      { cwd },
    );
    assert.deepEqual(
      result.documents.map((d: { id: string; seed: number }) => [d.id, d.seed]),
      [
        ['crates-01', 10],
        ['crates-02', 11],
        ['crates-03', 12],
      ],
    );
    assert.deepEqual(
      result.documents.map((d: { stateHash: string }) => d.stateHash),
      planned.documents.map((d: { stateHash: string }) => d.stateHash),
    );
    assert.deepEqual((await fs.readdir(path.join(cwd, 'crates'))).sort(), [
      'crates-01.generate.json',
      'crates-01.model.json',
      'crates-02.generate.json',
      'crates-02.model.json',
      'crates-03.generate.json',
      'crates-03.model.json',
    ]);
    const second = JSON.parse(
      await fs.readFile(path.join(cwd, 'crates/crates-02.generate.json'), 'utf8'),
    );
    assert.equal(second.seed, 11);
    await ok(
      ['generate', 'crate', '--file', 'crates/crates-02.generate.json', '--out', 'two.model.json'],
      { cwd },
    );
    assert.equal(
      JSON.parse(await fs.readFile(path.join(cwd, 'two.model.json'), 'utf8')).id,
      'crates-02',
    );
    assert.equal(
      (await failure(['generate', 'crate', '--count', '65', '--out', 'many'], { cwd })).code,
      'INVALID_OPTION',
    );
    assert.equal(
      (await failure(['generate', 'crate', '--count', '2', '--out', 'c.model.json'], { cwd })).code,
      'INVALID_OPTION',
    );
  }));

test('generation never overwrites and never writes inside a Scene Forge project', () =>
  withTemp(async (cwd) => {
    await ok(['generate', 'barrel', '--out', 'barrel.model.json'], { cwd });
    assert.equal(
      (await failure(['generate', 'barrel', '--seed', '3', '--out', 'barrel.model.json'], { cwd }))
        .code,
      'DOCUMENT_EXISTS',
    );
    await fs.rm(path.join(cwd, 'barrel.model.json'));
    assert.equal(
      (await failure(['generate', 'barrel', '--seed', '3', '--out', 'barrel.model.json'], { cwd }))
        .code,
      'ALREADY_EXISTS',
      'the sidecar is not replaced',
    );
    assert.equal(await exists(path.join(cwd, 'barrel.model.json')), false, 'nothing was written');
    await fs.mkdir(path.join(cwd, 'full'));
    await fs.writeFile(path.join(cwd, 'full/keep.txt'), 'keep');
    assert.equal(
      (await failure(['generate', 'barrel', '--count', '2', '--out', 'full'], { cwd })).code,
      'ALREADY_EXISTS',
    );
    assert.equal(
      (await failure(['generate', 'barrel', '--out', 'b.model.json', '--review', 'full'], { cwd }))
        .code,
      'ALREADY_EXISTS',
    );
    assert.equal(
      await exists(path.join(cwd, 'b.model.json')),
      false,
      'review is checked before writing',
    );
    await run(process.execPath, [sceneForgeBin, 'init', 'project', '--name', 'P'], { cwd });
    const refused = await failure(['generate', 'barrel', '--out', 'project/barrel.model.json'], {
      cwd,
    });
    assert.equal(refused.code, 'PROJECT_MODEL_READONLY');
    assert.equal(await exists(path.join(cwd, 'project/barrel.generate.json')), false);
    const result = await cli(['generate', 'barrel', '--out', 'x.model.json', '--count']);
    assert.equal(result.json.error!.code, 'CLI_USAGE');
  }));
