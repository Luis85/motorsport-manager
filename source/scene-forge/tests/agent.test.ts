import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  parse,
  SceneSchema,
  Scalar,
  OperationSchema,
  type ScalarValue,
  scalar,
  applyOperations,
  inspectNodes,
  exportScene,
} from '../src/kernel.js';
import { jsonSchema } from '../src/domain/schema.js';
import { packScene, unpackScene } from '../src/infra/bundle.js';
import { initProject, loadProject, commitOperations } from '../src/infra/project.js';

const scene = () =>
  parse(SceneSchema, {
    schemaVersion: 1,
    kind: 'scene',
    id: 'main',
    name: 'Fixture',
    parameters: { width: 2 },
    materials: { paint: { color: '#e8aa55' } },
    geometries: { box: { type: 'box', size: [{ $param: 'width' }, 1, 1] } },
    nodes: [
      { id: 'one', type: 'mesh', geometry: 'box', material: 'paint', tags: ['cargo'] },
      {
        id: 'two',
        type: 'mesh',
        geometry: 'box',
        material: 'paint',
        transform: { position: [4, 0, 0] },
        tags: ['cargo'],
      },
    ],
  });
test('bounded arithmetic supports dimensions, degree trigonometry and actionable failures', () => {
  const expr = parse(Scalar, {
    $expr: 'add',
    args: [
      { $expr: 'mul', args: [{ $param: 'width' }, 2] },
      { $expr: 'sin', args: [90] },
    ],
  });
  assert.equal(scalar(expr, { width: 3 }), 7);
  assert.equal(scalar(parse(Scalar, { $expr: 'clamp', args: [10, 0, 4] }), {}), 4);
  for (const [value, code] of [
    [{ $expr: 'div', args: [1, 0] }, 'EXPRESSION_DIV_ZERO'],
    [{ $expr: 'sub', args: [1] }, 'EXPRESSION_ARITY'],
    [{ $param: 'missing' }, 'PARAMETER_MISSING'],
    [{ $expr: 'mul', args: [1e6, 2] }, 'EXPRESSION_RANGE'],
  ] as const)
    assert.throws(() => scalar(parse(Scalar, value), {}), { code });
  let deep: ScalarValue = 1;
  for (let i = 0; i < 18; i++) deep = { $expr: 'neg', args: [deep] };
  assert.throws(() => scalar(deep, {}), { code: 'EXPRESSION_DEPTH' });
  const schema = JSON.stringify(jsonSchema('scalar'));
  assert.match(schema, /\$ref/);
  assert.match(schema, /clamp/);
});
test('selector edits are atomic, report affected IDs, and preserve the dry-run state', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-agent-'));
  try {
    await initProject(root);
    const s = scene();
    await fs.writeFile(path.join(root, 'scenes/main.scene.json'), JSON.stringify(s));
    const operation = parse(OperationSchema, {
      op: 'patchNodes',
      selector: { tag: 'cargo' },
      patch: { transform: { rotation: [0, 45, 0] } },
    });
    const dry = await commitOperations(root, undefined, [operation], { dryRun: true });
    assert.deepEqual(dry.changes.nodes.updated, ['one', 'two']);
    assert.equal(dry.proposedRevision, 1);
    assert.equal((await loadProject(root)).scene.revision, 0);
    const committed = await commitOperations(root, undefined, [operation]);
    assert.equal(dry.proposedStateHash, committed.stateHash);
    const rows = inspectNodes((await loadProject(root)).scene, {}, { ids: ['two'] }, true) as any[];
    assert.deepEqual(rows[0].worldPosition, [4, 0, 0]);
    assert.equal(rows[0].triangles, 12);
    assert.throws(
      () =>
        applyOperations(s, [
          parse(OperationSchema, {
            op: 'patchNodes',
            selector: { tag: 'missing' },
            patch: { visible: false },
          }),
        ]),
      (error: any) => error.code === 'EMPTY_SELECTION' && error.details.operationIndex === 0,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test('editable scene bundles recreate deterministic exports in a new project', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-bundle-'));
  try {
    const s = scene();
    const bundle = packScene(s, {});
    const project = path.join(root, 'restored');
    await unpackScene(project, bundle);
    const restored = await loadProject(project);
    const a = await exportScene(s, {}, 'glb'),
      b = await exportScene(restored.scene, restored.models, 'glb');
    assert.deepEqual(a.data, b.data);
    await assert.rejects(() => unpackScene(project, bundle), { code: 'ALREADY_EXISTS' });
    const invalid = {
      ...bundle,
      scene: { ...s, nodes: [{ id: 'missing', type: 'model', model: 'absent' }] },
    };
    await assert.rejects(() => unpackScene(path.join(root, 'invalid'), invalid), {
      code: 'REFERENCE_MISSING',
    });
    await assert.rejects(() => fs.access(path.join(root, 'invalid')));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
