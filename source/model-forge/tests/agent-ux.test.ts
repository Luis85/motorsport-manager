import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { boxModel, cli, failure, ok, withTemp } from './helpers.js';

test('hints fit the failing context and guard formats are checked on the command line', () =>
  withTemp(async (cwd) => {
    const unknown = await failure(['describe', 'node', 'frobnicate']);
    assert.equal(unknown.code, 'NOT_FOUND');
    assert.match(unknown.hint!, /discover/);
    assert.ok(unknown.details.available.includes('place'));
    assert.equal(unknown.details.hint, undefined, 'the hint is not repeated in details');
    await fs.writeFile(path.join(cwd, 'crate.model.json'), JSON.stringify(boxModel()));
    const doc = ['-d', 'crate.model.json'];
    const duplicate = await failure([...doc, 'node', 'duplicate', 'body', 'lid'], { cwd });
    assert.equal(duplicate.code, 'DUPLICATE_ID');
    assert.match(duplicate.hint!, /another node ID/);
    assert.doesNotMatch(duplicate.hint!, /directory|--overwrite/);
    const malformed = await failure(
      [...doc, 'apply', '--expected-state', 'xyz', '--data', '{"operations":[]}'],
      { cwd },
    );
    assert.equal(malformed.code, 'INVALID_OPTION');
    assert.match(malformed.message, /stateHash/);
    const range = await failure(
      [...doc, 'parameter', 'put', 'width', '--default', '9', '--min', '0', '--max', '1'],
      { cwd },
    );
    assert.equal(range.code, 'PARAMETER_RANGE');
    assert.equal(range.details.operationIndex, 0);
    const missing = await failure(
      [...doc, 'apply', '--data', '{"operations":[{"op":"removeMaterial","id":"steel"}]}'],
      { cwd },
    );
    assert.equal(missing.code, 'NOT_FOUND');
    assert.equal(missing.details.operationIndex, 0);
    assert.deepEqual(missing.details.cause.available, ['wood']);
  }));

test('discover publishes the safety codes and the output policy', async () => {
  const catalog = await ok(['discover']);
  const codes = catalog.errorCodes.map((entry: { code: string }) => entry.code);
  for (const code of ['PROJECT_MODEL_READONLY', 'DEPENDENCY_IN_USE', 'HISTORY_CONFLICT'])
    assert.ok(codes.includes(code), code);
  assert.match(catalog.outputs.existing, /--overwrite/);
  assert.match(catalog.outputs.forbidden, /\*\.lock/);
  assert.match(catalog.documents.sceneForgeProjects, /PROJECT_MODEL_READONLY/);
  assert.match(catalog.documents.revision, /explicit 0 reads as absent/);
});

test('raw JSON honours --compact and the help names what needs a browser', async () => {
  for (const args of [
    ['schema', '--kind', 'node', '--raw'],
    ['example', 'show', 'barrel', '--raw'],
  ]) {
    const pretty = await cli(args);
    const compact = await cli(['--compact', ...args]);
    assert.ok(pretty.stdout.trim().split('\n').length > 1);
    assert.equal(compact.stdout.trim().split('\n').length, 1, args.join(' '));
    assert.deepEqual(JSON.parse(compact.stdout), JSON.parse(pretty.stdout));
  }
  const doctor = await ok(['describe', 'doctor']);
  assert.match(doctor.description, /preview needs neither/);
  const footer = await fs.readFile(new URL('../src/standalone.ts', import.meta.url), 'utf8');
  assert.match(footer, /preview only writes HTML/);
  assert.doesNotMatch(footer, /review and preview capture/);
});

test('document paths, history entries and snapshots fail precisely', () =>
  withTemp(async (cwd) => {
    await fs.mkdir(path.join(cwd, 'folder.model.json'));
    const folder = await failure(['-d', 'folder.model.json', 'inspect'], { cwd });
    assert.equal(folder.code, 'DOCUMENT_NOT_FOUND');
    assert.match(folder.message, /directory/);
    const file = path.join(cwd, 'crate.model.json');
    await fs.writeFile(file, JSON.stringify(boxModel()));
    const doc = ['-d', 'crate.model.json'];
    await ok([...doc, 'add', 'box', 'one'], { cwd });
    await ok([...doc, 'add', 'box', 'two'], { cwd });
    await fs.writeFile(`${file}.history/0.json`, '{broken');
    const history = await ok([...doc, 'history'], { cwd });
    assert.deepEqual(
      history.revisions.map((entry: { revision: number }) => entry.revision),
      [0, 1, 2],
    );
    assert.equal(history.revisions[0].error.code, 'JSON_INVALID');
    assert.match(history.revisions[1].stateHash, /^[a-f0-9]{64}$/);
    // A snapshot for the current revision already exists: nothing is replaced or written.
    await fs.writeFile(`${file}.history/2.json`, '"keep"');
    const before = await fs.readFile(file);
    const conflict = await failure([...doc, 'add', 'box', 'three'], { cwd });
    assert.equal(conflict.code, 'HISTORY_CONFLICT');
    assert.equal(await fs.readFile(`${file}.history/2.json`, 'utf8'), '"keep"');
    assert.ok((await fs.readFile(file)).equals(before));
    // An orphaned history directory blocks a dry-run import exactly like a real one.
    await fs.mkdir(path.join(cwd, 'orphan.model.json.history'));
    for (const dry of [['--dry-run'], []])
      assert.equal(
        (await failure(['import', '--from', file, '--out', 'orphan.model.json', ...dry], { cwd }))
          .code,
        'DOCUMENT_EXISTS',
        dry.join(''),
      );
  }));

test('new documents carry no revision field and warn when the file stem differs from the ID', () =>
  withTemp(async (cwd) => {
    const created = await ok(['create', 'lamp.model.json', '--id', 'lamp', '--name', 'Lamp'], {
      cwd,
    });
    assert.equal(created.revision, 0);
    assert.equal(created.warnings, undefined);
    const raw = JSON.parse(await fs.readFile(path.join(cwd, 'lamp.model.json'), 'utf8'));
    assert.equal('revision' in raw, false, 'revision 0 is written as no field');
    // The same content with an explicit revision 0 has the same stateHash.
    await fs.writeFile(path.join(cwd, 'zero.model.json'), JSON.stringify({ ...raw, revision: 0 }));
    const zero = await ok(['-d', 'zero.model.json', 'inspect'], { cwd });
    assert.equal(zero.stateHash, created.stateHash);
    assert.equal(zero.revision, 0);
    const misnamed = await ok(['create', 'desk.model.json', '--id', 'table', '--name', 'T'], {
      cwd,
    });
    assert.match(misnamed.warnings.join(' '), /desk\.model\.json does not match model ID table/);
    const imported = await ok(
      ['import', '--from', 'lamp.model.json', '--out', 'other.model.json', '--dry-run'],
      { cwd },
    );
    assert.match(imported.warnings.join(' '), /other\.model\.json does not match model ID lamp/);
    const edited = await ok(['-d', 'lamp.model.json', 'add', 'box', 'shade'], { cwd });
    assert.equal(edited.revision, 1);
    const history = await ok(['-d', 'lamp.model.json', 'history'], { cwd });
    assert.equal(history.revisions[0].stateHash, created.stateHash);
  }));

test('a missing input file and an unknown preset name the flag to fix', () =>
  withTemp(async (cwd) => {
    await fs.writeFile(path.join(cwd, 'crate.model.json'), JSON.stringify(boxModel()));
    const missing = [
      [['-d', 'crate.model.json', 'apply', '--file', 'missing.batch.json'], '--file'],
      [['generate', 'tree', '--file', 'missing.generate.json', '--out', 't.model.json'], '--file'],
      [['import', '--from', 'missing.model.json', '--out', 'copy.model.json'], '--from'],
      [
        ['-d', 'crate.model.json', 'scatter', '--count', '2', '--model', 'oak'],
        '--dependency',
        ['--dependency', 'missing-oak.model.json'],
      ],
    ] as const;
    for (const [args, flag, extra = []] of missing) {
      const error = await failure([...args, ...extra], { cwd });
      assert.equal(error.code, 'NOT_FOUND', args.join(' '));
      assert.match(error.message, /^File does not exist: .*missing/);
      assert.ok(error.hint!.includes(`${flag} path`), error.hint);
      assert.doesNotMatch(error.hint!, /node list/, 'not the remedy for a missing ID');
      assert.equal(error.details, undefined);
    }
    const preset = await failure(['generate', 'tree', '--preset', 'oak', '--out', 'o.model.json'], {
      cwd,
    });
    assert.equal(preset.code, 'INVALID_OPTION');
    assert.match(preset.message, /tree has no preset oak/);
    assert.deepEqual(preset.details.available, ['deciduous', 'conifer', 'palm', 'dead']);
    assert.match(preset.hint!, /--preset deciduous\|conifer\|palm\|dead/);
    const described = await ok(['describe', 'generate', 'tree']);
    const option = described.options.find((o: { flags: string }) => o.flags.startsWith('--preset'));
    assert.deepEqual(option.choices, ['deciduous', 'conifer', 'palm', 'dead'], 'choices stay');
    assert.equal(
      (
        await ok(['generate', 'tree', '--preset', 'palm', '--out', 'p.model.json', '--dry-run'], {
          cwd,
        })
      ).preset,
      'palm',
    );
  }));
