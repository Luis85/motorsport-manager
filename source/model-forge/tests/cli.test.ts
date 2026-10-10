import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { cli, failure, ok, withTemp, boxModel } from './helpers.js';

test('every command prints exactly one JSON envelope and uses exit status', async () => {
  const success = await cli(['--compact', 'schema', '--kind', 'parameter']);
  assert.equal(success.status, 0);
  assert.equal(success.stderr, '');
  assert.equal(success.stdout.trim().split('\n').length, 1, 'compact output is one line');
  assert.equal(success.json.ok, true);
  assert.equal(success.json.data.type, 'object');
  const error = await cli(['inspect']);
  assert.equal(error.status, 1);
  assert.equal(error.stdout, '');
  assert.equal(error.json.error!.code, 'DOCUMENT_REQUIRED');
  assert.match(error.json.error!.hint!, /-d, --document/);
  assert.doesNotMatch(error.stderr, /\u001b\[/, 'no ANSI colors');
  assert.equal((await failure(['frobnicate'])).code, 'CLI_USAGE');
  assert.equal((await failure(['schema', '--kind', 'scene'])).code, 'CLI_USAGE');
  const raw = await cli(['schema', '--kind', 'batch', '--raw']);
  assert.equal(JSON.parse(raw.stdout).$schema, 'https://json-schema.org/draft/2020-12/schema');
});

test('discover publishes the ordered protocol, operations, exports and error remedies', async () => {
  const catalog = await ok(['discover']);
  assert.deepEqual(
    catalog.workflow.map((s: { step: string }) => s.step),
    [
      'discover',
      'schema',
      'generate',
      'create',
      'inspect',
      'dry-run',
      'apply',
      'verify',
      'review',
      'export',
    ],
  );
  assert.deepEqual(await ok(['catalog']), catalog, 'catalog is an alias');
  const operations = catalog.operations.map((o: { op: string }) => o.op);
  for (const op of ['putNode', 'groundNode', 'putParameter', 'setMetadata', 'putDependency'])
    assert.ok(operations.includes(op), op);
  assert.ok(catalog.sceneOnlyOperations.setCamera);
  const codes = catalog.errorCodes.map((e: { code: string }) => e.code);
  for (const code of [
    'DOCUMENT_NOT_FOUND',
    'DOCUMENT_EXISTS',
    'DOCUMENT_LOCKED',
    'DOCUMENT_KIND',
    'DEPENDENCY_READONLY',
    'HISTORY_NOT_FOUND',
    'REVISION_CONFLICT',
    'STATE_CONFLICT',
  ])
    assert.ok(codes.includes(code), code);
  const bundle = catalog.exports.find((e: { format: string }) => e.format === 'model-bundle');
  assert.match(bundle.consumers.join(' '), /scene-forge model import/);
  const littlewild = catalog.exports.find((e: { format: string }) => e.format === 'littlewild');
  assert.match(littlewild.consumers.join(' '), /wildlands creature attach-visual/);
  assert.ok(catalog.commands.includes('node place'));
  assert.ok(catalog.schemas.includes('operation'));
});

test('doctor reports the runtime and browser setup without failing', async () => {
  const doctor = await ok(['doctor']);
  assert.equal(doctor.nodeSupported, true);
  assert.equal(typeof doctor.playwright.installed, 'boolean');
  assert.equal(typeof doctor.reviewReady, 'boolean');
  assert.match(doctor.setup, /model-forge|review|chromium/i);
});

test('describe walks command paths and reports flags machine-readably', async () => {
  const apply = await ok(['describe', 'apply']);
  assert.equal(apply.command, 'model-forge apply');
  const flags = apply.options.map((o: { flags: string }) => o.flags);
  for (const flag of [
    '--file <path>',
    '--data <json>',
    '--expected-revision <n>',
    '--expected-state <hash>',
    '--dry-run',
  ])
    assert.ok(flags.includes(flag), flag);
  const place = await ok(['describe', 'node', 'place']);
  const side = place.options.find((o: { flags: string }) => o.flags === '--side <side>');
  assert.deepEqual(side.choices, ['right', 'left', 'front', 'back', 'above', 'below']);
  assert.deepEqual((await ok(['describe', 'catalog'])).aliases, ['catalog']);
  assert.equal((await failure(['describe', 'node', 'explode'])).code, 'NOT_FOUND');
});

test('wrappers compile to guarded model operations', () =>
  withTemp(async (cwd) => {
    const doc = ['-d', 'crate.model.json'];
    await ok(['create', 'crate.model.json', '--id', 'crate', '--name', 'Crate'], { cwd });
    assert.equal(
      (await failure(['create', 'crate.model.json', '--id', 'crate', '--name', 'X'], { cwd })).code,
      'DOCUMENT_EXISTS',
    );
    const added = await ok([...doc, 'add', 'box', 'body', '--size', '1,0.6,0.8'], { cwd });
    assert.deepEqual(added.changes.materials.added, ['clay']);
    await ok(
      [...doc, 'add', 'cylinder', 'post', '--radius', '0.1', '--height', '2', '--at', '1,0,0'],
      { cwd },
    );
    assert.equal((await failure([...doc, 'add', 'teapot', 'pot'], { cwd })).code, 'INVALID_OPTION');
    await ok([...doc, 'node', 'transform', 'post', '--rotate', '0,0,10'], { cwd });
    await ok([...doc, 'node', 'duplicate', 'post', 'post2', '--offset', '0,0,1'], { cwd });
    await ok([...doc, 'node', 'group', 'posts', '--nodes', 'post,post2'], { cwd });
    await ok([...doc, 'node', 'ground', 'posts'], { cwd });
    await ok([...doc, 'node', 'place', 'body', '--to', 'posts', '--side', 'left', '--gap', '0.1'], {
      cwd,
    });
    await ok([...doc, 'node', 'reparent', 'post2', '--local'], { cwd });
    await ok([...doc, 'node', 'patch', 'body', '--data', '{"tags":["hull"]}'], { cwd });
    const edited = await ok(
      [...doc, 'node', 'edit', '--tag', 'hull', '--data', '{"visible":false}'],
      { cwd },
    );
    assert.deepEqual(edited.changes.nodes.updated, ['body']);
    assert.equal(
      (await failure([...doc, 'node', 'edit', '--data', '{}'], { cwd })).code,
      'INPUT_REQUIRED',
    );
    await ok([...doc, 'parameter', 'put', 'height', '--default', '2', '--min', '1', '--max', '3'], {
      cwd,
    });
    await ok([...doc, 'put', 'parameter', 'radius', '--data', '{"default":0.1,"integer":false}'], {
      cwd,
    });
    await ok(
      [
        ...doc,
        'put',
        'geometry',
        'cap',
        '--data',
        '{"type":"sphere","radius":{"$param":"radius"}}',
      ],
      { cwd },
    );
    await ok(
      [...doc, 'put', 'material', 'steel', '--data', '{"color":"#999999","metalness":0.9}'],
      { cwd },
    );
    await ok([...doc, 'put', 'node', 'knob', '--file', '-'], {
      cwd,
      stdin: '{"type":"mesh","geometry":"cap","material":"steel"}',
    });
    await ok([...doc, 'parameter', 'remove', 'height'], { cwd });
    await ok([...doc, 'metadata', 'set', '--category', 'props', '--description', 'Test'], { cwd });
    const cleared = await ok([...doc, 'metadata', 'set', '--clear-category'], { cwd });
    assert.deepEqual(cleared.changes.metadata, ['category']);
    await ok([...doc, 'remove', 'posts', '--cascade'], { cwd });
    const listed = await ok([...doc, 'node', 'list', '--root', '--details', '--limit', '2'], {
      cwd,
    });
    assert.equal(listed.nodes.length, 2);
    assert.ok(listed.nodes[0].bounds);
    assert.equal(listed.nextOffset, 2);
    const inspected = await ok(
      [...doc, 'inspect', '--source', '--node', 'knob', '--parameters', '{"radius":0.2}'],
      { cwd },
    );
    assert.equal(inspected.revision, 19);
    assert.equal(inspected.source.revision, 19);
    assert.deepEqual(inspected.parameterOverrides, { radius: 0.2 });
    assert.ok(inspected.node.bounds);
    assert.equal(inspected.category, undefined);
    assert.equal((await ok([...doc, 'validate'], { cwd })).valid, true);
    assert.equal((await ok([...doc, 'history'], { cwd })).revisions.length, 20);
  }));

test('guards from flags and batches must agree, and dry runs write nothing', () =>
  withTemp(async (cwd) => {
    await fs.writeFile(path.join(cwd, 'crate.model.json'), JSON.stringify(boxModel()));
    const doc = ['-d', 'crate.model.json'];
    const { stateHash } = await ok([...doc, 'inspect'], { cwd });
    const batch = JSON.stringify({
      expectedRevision: 0,
      expectedState: stateHash,
      operations: [{ op: 'removeNode', id: 'lid' }],
    });
    assert.equal(
      (await failure([...doc, 'apply', '--data', batch, '--expected-revision', '3'], { cwd })).code,
      'GUARD_MISMATCH',
    );
    assert.equal(
      (await failure([...doc, 'apply', '--data', batch, '--file', 'x.json'], { cwd })).code,
      'INPUT_REQUIRED',
    );
    const dry = await ok([...doc, 'apply', '--data', batch, '--dry-run'], { cwd });
    assert.equal(dry.revision, 0);
    assert.equal(dry.proposedRevision, 1);
    assert.equal((await ok([...doc, 'inspect'], { cwd })).stateHash, stateHash);
    const applied = await ok([...doc, 'apply', '--data', batch], { cwd });
    assert.equal(applied.stateHash, dry.proposedStateHash);
    const stale = await failure([...doc, 'apply', '--data', batch], { cwd });
    assert.equal(stale.code, 'REVISION_CONFLICT');
    assert.match(stale.hint!, /inspect/);
    const restored = await ok([...doc, 'restore', '0', '--expected-revision', '1'], { cwd });
    assert.equal(restored.revision, 2);
    assert.equal((await failure([...doc, 'restore', '0'], { cwd })).code, 'GUARD_REQUIRED');
    assert.equal(
      (await failure([...doc, 'restore', '7', '--expected-revision', '2'], { cwd })).code,
      'HISTORY_NOT_FOUND',
    );
    assert.equal(
      (await failure(['-d', 'nope.model.json', 'inspect'], { cwd })).code,
      'DOCUMENT_NOT_FOUND',
    );
    assert.equal(
      (await failure([...doc, 'apply', '--data', '{"operations":[{"op":"setCamera"}]}'], { cwd }))
        .code,
      'UNKNOWN_OPERATION',
    );
    assert.equal(
      (await failure([...doc, 'apply', '--data', '{nope'], { cwd })).code,
      'JSON_INVALID',
    );
  }));

test('rig commands bind, pose, inspect and remove rigs on nested model instances', () =>
  withTemp(async (cwd) => {
    await ok(['example', 'create', 'fieldStation', 'station.model-bundle.json'], { cwd });
    const doc = ['-d', 'station.model-bundle.json'];
    const instance = (
      await ok([...doc, 'node', 'list', '--type', 'model', '--model', 'rover'], { cwd })
    ).nodes[0].id;
    const inspected = await ok([...doc, 'rig', 'inspect', instance], { cwd });
    assert.equal(inspected.rig, null);
    assert.ok(inspected.meshes.length > 3);
    assert.equal(
      (
        await failure([...doc, 'rig', 'pose', instance, '--joint', 'root', '--rotation', '0,1,0'], {
          cwd,
        })
      ).code,
      'RIG_MISSING',
    );
    const rig = { joints: [{ id: 'root', position: [0, 0, 0] }] };
    await ok([...doc, 'rig', 'bind', instance, '--data', JSON.stringify(rig)], { cwd });
    await ok([...doc, 'rig', 'pose', instance, '--joint', 'root', '--rotation', '0,15,0'], { cwd });
    assert.deepEqual((await ok([...doc, 'rig', 'inspect', instance], { cwd })).rig.pose, {
      root: [0, 15, 0],
    });
    await ok([...doc, 'rig', 'remove', instance], { cwd });
    assert.equal((await ok([...doc, 'rig', 'inspect', instance], { cwd })).rig, null);
    const mesh =
      (await ok([...doc, 'node', 'list', '--type', 'group'], { cwd })).nodes[0]?.id ?? 'none';
    assert.equal(
      (await failure([...doc, 'rig', 'inspect', mesh], { cwd })).code,
      'INVALID_NODE_TYPE',
    );
    const dependency = await failure(
      [...doc, 'dependency', 'put', '--data', JSON.stringify({ ...boxModel('rover') })],
      { cwd },
    );
    assert.equal(dependency.code, 'DEPENDENCY_READONLY');
    await ok([...doc, 'dependency', 'put', '--data', JSON.stringify(boxModel('spare'))], { cwd });
    await ok([...doc, 'dependency', 'remove', 'spare'], { cwd });
  }));

test('exports write each recipe and mesh format and refuse to replace the document', () =>
  withTemp(async (cwd) => {
    await ok(['example', 'create', 'barrel', 'barrel.model.json'], { cwd });
    const doc = ['-d', 'barrel.model.json'];
    for (const format of ['obj', 'stl', 'three', 'gltf']) {
      const result = await ok(
        [...doc, 'export', '--format', format, '--out', `out/barrel.${format}`],
        { cwd },
      );
      assert.ok(result.bytes > 0, format);
    }
    const glb = await ok(
      [...doc, 'export', '--out', 'out/barrel.glb', '--validate', '--parameters', '{}'],
      { cwd },
    );
    assert.equal(glb.validation.numErrors, 0);
    const model = await ok([...doc, 'export', '--format', 'model', '--out', 'out/barrel.json'], {
      cwd,
    });
    assert.deepEqual(model.models, ['barrel']);
    const written = JSON.parse(await fs.readFile(path.join(cwd, 'out/barrel.json'), 'utf8'));
    assert.equal('revision' in written, false, 'portable recipes carry no editor revision');
    assert.equal(
      (
        await failure([...doc, 'export', '--format', 'model', '--out', 'barrel.model.json'], {
          cwd,
        })
      ).code,
      'INVALID_PATH',
    );
    assert.equal(
      (
        await failure(
          [...doc, 'export', '--format', 'model', '--out', 'x.json', '--parameters', '{}'],
          { cwd },
        )
      ).code,
      'INVALID_OPTION',
    );
    assert.equal(
      (
        await failure([...doc, 'export', '--format', 'obj', '--out', 'x.obj', '--validate'], {
          cwd,
        })
      ).code,
      'INVALID_OPTION',
    );
    assert.equal(
      (
        await failure([...doc, 'export', '--format', 'glb', '--out', 'x.glb', '--family', 'pets'], {
          cwd,
        })
      ).code,
      'INVALID_OPTION',
    );
    const out = 'lw/items/barrel/definition.json';
    const dry = await ok([...doc, 'export', '--format', 'littlewild', '--out', out, '--dry-run'], {
      cwd,
    });
    assert.equal(dry.written, false);
    assert.equal(
      (
        await failure([...doc, 'export', '--format', 'littlewild', '--out', out, '--check'], {
          cwd,
        })
      ).code,
      'LITTLEWILD_STALE',
    );
    await ok([...doc, 'export', '--format', 'littlewild', '--out', out], { cwd });
    assert.equal(
      (await ok([...doc, 'export', '--format', 'littlewild', '--out', out, '--check'], { cwd }))
        .changed,
      false,
    );
    const audit = await ok(
      [
        ...doc,
        'audit',
        '--data',
        '{"schemaVersion":1,"kind":"quality-policy","maxTriangles":100000}',
      ],
      { cwd },
    );
    assert.equal(audit.passed, true);
    assert.equal(
      (
        await failure(
          [
            ...doc,
            'audit',
            '--data',
            '{"schemaVersion":1,"kind":"quality-policy","maxTriangles":1}',
          ],
          { cwd },
        )
      ).code,
      'QUALITY_GATE_FAILED',
    );
  }));
