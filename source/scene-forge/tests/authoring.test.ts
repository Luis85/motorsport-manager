import { parse, SceneSchema, compileScene, applyOperations } from '../src/kernel.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { listExamples, createExample } from '../src/infra/examples.js';
import { loadProject } from '../src/infra/project.js';
import { createEditHistory, sceneEdits } from '../src/preview/edit-state.js';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { createCli } from '../src/commands/create-cli.js';
const scene = (extra = {}) =>
  parse(SceneSchema, { schemaVersion: 1, kind: 'scene', id: 'main', name: 'Main', ...extra });
test('appearance-only editor changes round-trip through operations and undo', () => {
  const before = scene();
  const after = structuredClone(before);
  after.environment.exposure = 2;
  after.materials.blue = {
    color: '#3366ff',
    metalness: 0,
    roughness: 0.5,
    opacity: 1,
    doubleSided: false,
    flatShading: false,
  };
  const edits = sceneEdits(before, after);
  assert.equal(edits.operations.length, 2);
  assert.deepEqual(applyOperations(before, edits.operations), after);
  const history = createEditHistory();
  history.commit(before, after);
  assert.ok(history.canUndo);
  let restored = after;
  history.travel('undo', after, (state) => {
    restored = { ...restored, ...state };
  });
  assert.deepEqual(restored.environment, before.environment);
});
test('catalog points one-model authoring to Model Forge and keeps the import handoff', async () => {
  let stdout = '';
  const cli = createCli({
    cwd: os.tmpdir(),
    stdin: Readable.from([]),
    writeOut: (s) => {
      stdout += s;
    },
    writeErr: () => {},
  });
  assert.equal(await cli.run(['catalog']), 0);
  const { modelAuthoring, workflow } = JSON.parse(stdout).data;
  assert.equal(modelAuthoring.tool, 'bin/model-forge');
  assert.match(modelAuthoring.handoff[0], /export --format model-bundle/);
  assert.match(modelAuthoring.handoff[1], /model import --file <file> --dry-run$/);
  assert.match(modelAuthoring.handoff[2], /--expected-revision <n> --expected-state <hash>/);
  assert.ok(workflow.includes('model capture'), 'existing catalog workflow is retained');
});
test('bundled examples compile and create portable projects without overwriting files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-examples-'));
  try {
    const examples = await listExamples();
    assert.ok(examples.length >= 7);
    for (const example of examples) {
      const directory = path.join(root, example.id);
      await createExample(example.id, directory);
      const snapshot = await loadProject(directory);
      const built = compileScene(snapshot.scene, snapshot.models);
      assert.ok(built.stats.meshes > 0);
      built.dispose();
      await assert.rejects(createExample(example.id, directory));
    }
    await assert.rejects(createExample('../other', path.join(root, 'escape')));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('a missing input file fails with a remedy that names its flag', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-missing-input-'));
  const run = async (args: string[]) => {
    let stdout = '',
      stderr = '';
    const cli = createCli({
      cwd: root,
      stdin: Readable.from([]),
      writeOut: (s) => {
        stdout += s;
      },
      writeErr: (s) => {
        stderr += s;
      },
    });
    const status = await cli.run(args);
    return { status, stdout, stderr };
  };
  try {
    assert.equal((await run(['init', 'yard', '--name', 'Yard'])).status, 0);
    const cases: [string[], string][] = [
      [['-p', 'yard', 'apply', '--file', 'missing.batch.json'], '--file'],
      [['-p', 'yard', 'scatter', '--file', 'missing.scatter.json'], '--file'],
      [['-p', 'yard', 'littlewild', 'sync', '--file', 'missing.export.json'], '--file'],
      [['-p', 'yard', 'littlewild', 'import', '--definition', 'missing.json'], '--definition'],
    ];
    for (const [args, flag] of cases) {
      const result = await run(args);
      assert.equal(result.status, 1, args.join(' '));
      const { error } = JSON.parse(result.stderr);
      assert.equal(error.code, 'NOT_FOUND');
      assert.match(error.message, /^File does not exist: .*missing/);
      assert.ok(error.hint.includes(`${flag} path`), error.hint);
      assert.equal(error.details, undefined);
    }
    assert.equal((await run(['-p', 'yard', 'inspect'])).status, 0, 'nothing was written');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
