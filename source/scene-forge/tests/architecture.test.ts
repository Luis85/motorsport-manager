import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Readable } from 'node:stream';
import { parse, SceneSchema, NodeSchema } from '../src/kernel.js';
import { createCli } from '../src/commands/create-cli.js';
import {
  createEditHistory,
  transactEdit,
  sceneEdits,
  type EditState,
} from '../src/preview/edit-state.js';

const scene = () =>
  parse(SceneSchema, {
    schemaVersion: 1,
    kind: 'scene',
    id: 'main',
    name: 'Main',
    nodes: [{ id: 'assembly', type: 'group' }],
  });

test('CLI instances isolate output, error status, working directory and piped input', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-cli-factory-'));
  try {
    const invoke = async (args: string[], input = '') => {
      let stdout = '',
        stderr = '';
      const cli = createCli({
        cwd,
        stdin: Readable.from([input]),
        writeOut: (s) => {
          stdout += s;
        },
        writeErr: (s) => {
          stderr += s;
        },
      });
      return { status: await cli.run(args), stdout, stderr };
    };
    const init = await invoke(['init', 'project']);
    assert.equal(init.status, 0);
    assert.equal(init.stderr, '');
    assert.equal(JSON.parse(init.stdout).data.project, path.join(cwd, 'project'));
    const applied = await invoke(
      ['-p', 'project', '--compact', 'apply', '--file', '-'],
      JSON.stringify({ operations: [{ op: 'putNode', node: { id: 'one', type: 'group' } }] }),
    );
    assert.equal(applied.status, 0);
    assert.equal(applied.stdout.trim().split('\n').length, 1);
    const bad = await invoke(['-p', 'project', 'apply', '--data', '{']);
    assert.equal(bad.status, 1);
    assert.equal(bad.stdout, '');
    assert.equal(JSON.parse(bad.stderr).error.code, 'JSON_INVALID');
    const help = await invoke(['--help']);
    assert.equal(help.status, 0);
    assert.match(help.stdout, /Usage: forge3d/);
    const inspect = await invoke(['-p', 'project', 'inspect']);
    assert.equal(inspect.status, 0);
    assert.equal(inspect.stderr, '');
    assert.equal(JSON.parse(inspect.stdout).data.revision, 1);
    assert.ok(inspect.stdout.trim().split('\n').length > 1);
  } finally {
    await fs.rm(cwd, { recursive: true, force: true });
  }
});

test('failed editor rebuild restores nodes and selection without adding undo history', () => {
  let state: EditState = { nodes: scene().nodes, selectedId: 'assembly' };
  const original = structuredClone(state),
    history = createEditHistory();
  let attempts = 0;
  assert.throws(
    () =>
      transactEdit(
        history,
        () => state,
        (next) => {
          state = next;
        },
        () => {
          state.nodes[0].name = 'bad';
          state.selectedId = undefined;
        },
        () => {
          if (++attempts === 1) throw new Error('render failed');
        },
      ),
    /render failed/,
  );
  assert.deepEqual(state, original);
  assert.equal(attempts, 2);
  assert.equal(history.canUndo, false);
});

test('editor undo snapshots are isolated, no-ops retain redo, and new edits clear redo', () => {
  let state: EditState = { nodes: scene().nodes, selectedId: 'assembly' };
  const history = createEditHistory(2);
  const change = (name: string) =>
    transactEdit(
      history,
      () => state,
      (next) => {
        state = next;
      },
      () => {
        state.nodes[0].name = name;
      },
      () => {},
    );
  change('one');
  change('two');
  history.travel('undo', state, (next) => {
    state = next;
  });
  assert.equal(state.nodes[0].name, 'one');
  assert.equal(history.canRedo, true);
  change('one');
  assert.equal(history.canRedo, true);
  change('branch');
  assert.equal(history.canRedo, false);
  history.travel('undo', state, (next) => {
    state = next;
  });
  assert.equal(state.nodes[0].name, 'one');
});

test('failed undo rebuild retains both history stacks and restores the current selection', () => {
  const history = createEditHistory();
  const before: EditState = { nodes: scene().nodes, selectedId: 'assembly' };
  let current = structuredClone(before);
  current.nodes[0].name = 'new';
  current.selectedId = undefined;
  history.commit(before, current);
  const saved = structuredClone(current);
  let first = true;
  assert.throws(
    () =>
      history.travel('undo', current, (state) => {
        current = state;
        if (first) {
          first = false;
          throw new Error('failed');
        }
      }),
    /failed/,
  );
  assert.deepEqual(current, saved);
  assert.equal(history.canUndo, true);
  assert.equal(history.canRedo, false);
});

test('editor diff emits one cascade removal and preserves revision and library guards', () => {
  const initial = scene();
  initial.nodes.push(parse(NodeSchema, { id: 'child', type: 'group', parent: 'assembly' }));
  const current = structuredClone(initial);
  current.nodes = [];
  const batch = sceneEdits(initial, current, 'abc');
  assert.deepEqual(batch, {
    scene: 'main',
    expectedRevision: 0,
    expectedState: 'abc',
    operations: [{ op: 'removeNode', id: 'assembly', cascade: true }],
  });
});
