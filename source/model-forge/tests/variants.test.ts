import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { failure, ok, withTemp } from './helpers.js';

const read = async (file: string) => JSON.parse(await fs.readFile(file, 'utf8'));

test('variants writes N documents and a model-variants manifest, deterministically', () =>
  withTemp(async (cwd) => {
    await ok(['generate', 'rock', '--preset', 'boulder', '--out', 'boulder.model.json'], { cwd });
    const args = [
      '-d',
      'boulder.model.json',
      'variants',
      '--count',
      '5',
      '--seed',
      '9',
      '--vary',
      'size=1.2..2.4',
      '--vary',
      'height=0.5..0.9',
      '--materials',
      'stone=#5f5b55,#6f6a63,#7d776f',
    ];
    const planned = await ok([...args, '--out', 'planned', '--dry-run'], { cwd });
    assert.equal(planned.dryRun, true);
    await assert.rejects(fs.access(path.join(cwd, 'planned')));
    const result = await ok([...args, '--out', 'set'], { cwd });
    const again = await ok([...args, '--out', 'again'], { cwd });
    assert.equal(result.recipeHash, planned.recipeHash);
    assert.equal(again.recipeHash, result.recipeHash);
    assert.deepEqual(
      result.documents.map((d: { id: string }) => d.id),
      ['boulder-01', 'boulder-02', 'boulder-03', 'boulder-04', 'boulder-05'],
    );
    for (const [i, document] of result.documents.entries()) {
      assert.equal(document.stateHash, planned.documents[i].stateHash);
      const a = await fs.readFile(document.path);
      assert.ok(a.equals(await fs.readFile(again.documents[i].path)), 'same seed, same bytes');
      const model = await read(document.path);
      assert.equal(model.parameters.size.default, document.parameters.size);
      assert.ok(document.parameters.size >= 1.2 && document.parameters.size < 2.4);
      assert.ok(document.parameters.height >= 0.5 && document.parameters.height < 0.9);
      assert.ok(['#5f5b55', '#6f6a63', '#7d776f'].includes(model.materials.stone.color));
      assert.equal(model.parameters.size.min, 0.05, 'declared ranges are kept');
      assert.equal(model.revision, undefined);
      const validated = await ok(['-d', document.path, 'validate'], { cwd });
      assert.equal(validated.stateHash, document.stateHash);
    }
    assert.ok(new Set(result.documents.map((d: { stateHash: string }) => d.stateHash)).size === 5);
    const manifest = await read(path.join(cwd, 'set/variants.json'));
    assert.equal(manifest.kind, 'model-variants');
    assert.deepEqual(manifest.vary, { size: [1.2, 2.4], height: [0.5, 0.9] });
    assert.equal(manifest.variants[2].file, 'boulder-03.model.json');
    assert.equal(
      manifest.source.stateHash,
      (await ok(['-d', 'boulder.model.json', 'inspect'], { cwd })).stateHash,
    );
    // Variant i does not depend on the count: a shorter run repeats the same first documents.
    const fewer = await ok([...args.map((a) => (a === '5' ? '2' : a)), '--out', 'fewer'], { cwd });
    assert.deepEqual(
      fewer.documents.map((d: { parameters: unknown }) => d.parameters),
      result.documents.slice(0, 2).map((d: { parameters: unknown }) => d.parameters),
    );
    const other = await ok([...args.map((a) => (a === '9' ? '10' : a)), '--out', 'other'], { cwd });
    assert.notDeepEqual(other.documents[0].parameters, result.documents[0].parameters);
  }));

test('variant ranges must narrow the declared range; integers stay whole', () =>
  withTemp(async (cwd) => {
    await ok(['generate', 'fence', '--preset', 'ranch', '--out', 'fence.model.json'], { cwd });
    const doc = ['-d', 'fence.model.json', 'variants', '--count', '4'];
    const ranged = await failure([...doc, '--vary', 'spacing=0.1..3', '--out', 'v'], { cwd });
    assert.equal(ranged.code, 'VARIANT_RANGE');
    assert.deepEqual(ranged.details.declared, { min: 0.2, max: 5 });
    assert.match(ranged.hint!, /0\.2\.\.5/);
    assert.equal(
      (await failure([...doc, '--vary', 'spacing=3..2', '--out', 'v'], { cwd })).code,
      'VARIANT_RANGE',
    );
    assert.equal(
      (await failure([...doc, '--vary', 'posts=3.2..3.8', '--out', 'v'], { cwd })).code,
      'VARIANT_RANGE',
    );
    assert.equal(
      (await failure([...doc, '--vary', 'width=1..2', '--out', 'v'], { cwd })).code,
      'UNKNOWN_PARAMETER',
    );
    assert.equal(
      (await failure([...doc, '--vary', 'spacing=a..b', '--out', 'v'], { cwd })).code,
      'INVALID_OPTION',
    );
    assert.equal(
      (await failure([...doc, '--materials', 'paint=#ffffff', '--out', 'v'], { cwd })).code,
      'NOT_FOUND',
    );
    assert.equal(
      (await failure([...doc, '--materials', 'wood=white', '--out', 'v'], { cwd })).code,
      'INVALID_OPTION',
    );
    assert.equal((await failure([...doc, '--out', 'v'], { cwd })).code, 'INPUT_REQUIRED');
    assert.equal(
      (
        await failure(
          [
            '-d',
            'fence.model.json',
            'variants',
            '--count',
            '65',
            '--vary',
            'spacing=2..3',
            '--out',
            'v',
          ],
          { cwd },
        )
      ).code,
      'INVALID_OPTION',
    );
    assert.equal(
      (
        await failure(
          [
            '-d',
            'fence.model.json',
            'variants',
            '--count',
            '37',
            '--vary',
            'spacing=2..3',
            '--out',
            'v',
            '--review',
          ],
          { cwd },
        )
      ).code,
      'INVALID_OPTION',
    );
    await assert.rejects(fs.access(path.join(cwd, 'v')), 'failures write nothing');
    const result = await ok(
      [...doc, '--vary', 'posts=3..7', '--vary', 'spacing=1.5..3', '--out', 'v'],
      { cwd },
    );
    for (const document of result.documents) {
      assert.ok(Number.isInteger(document.parameters.posts));
      assert.ok(document.parameters.posts >= 3 && document.parameters.posts <= 7);
    }
  }));

test('bundle variants keep frozen dependencies; outputs never replace files', () =>
  withTemp(async (cwd) => {
    await ok(['generate', 'terrain', '--set', 'resolution=24', '--out', 'field.model.json'], {
      cwd,
    });
    await ok(['generate', 'rock', '--out', 'rock.model.json'], { cwd });
    await ok(['import', '--from', 'field.model.json', '--out', 'field.model-bundle.json'], { cwd });
    await ok(
      [
        '-d',
        'field.model-bundle.json',
        'scatter',
        '--model',
        'rock',
        '--dependency',
        'rock.model.json',
        '--spacing',
        '8',
        '--on',
        'terrain',
      ],
      { cwd },
    );
    const args = [
      '-d',
      'field.model-bundle.json',
      'variants',
      '--count',
      '2',
      '--vary',
      'amplitude=2..8',
    ];
    const result = await ok([...args, '--materials', 'ground=#ffffff,#eeddcc', '--out', 'fields'], {
      cwd,
    });
    for (const document of result.documents) {
      assert.match(document.path, /field-0[12]\.model-bundle\.json$/);
      const bundle = await read(document.path);
      assert.equal(bundle.entry, document.id);
      assert.deepEqual(Object.keys(bundle.models), [document.id, 'rock']);
      assert.ok(
        bundle.models[document.id].nodes.some((n: { model?: string }) => n.model === 'rock'),
      );
    }
    assert.equal((await failure([...args, '--out', 'fields'], { cwd })).code, 'ALREADY_EXISTS');
  }));
