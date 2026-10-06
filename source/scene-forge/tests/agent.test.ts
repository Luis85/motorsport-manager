import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Box3, Vector3 } from 'three';
import {
  parse,
  SceneSchema,
  ModelSchema,
  NodeSchema,
  Scalar,
  CameraRequestSchema,
  OperationSchema,
  jsonSchema,
  type ScalarValue,
} from '../src/domain/schema.js';
import { scalar } from '../src/domain/validate.js';
import { compileScene } from '../src/application/compiler.js';
import { applyOperations } from '../src/application/operations.js';
import { inspectNodes } from '../src/application/inspection.js';
import { fitCamera } from '../src/application/camera.js';
import { authoringTarget } from '../src/application/target.js';
import { packScene, unpackScene } from '../src/infra/bundle.js';
import { initProject, loadProject, commitOperations } from '../src/infra/project.js';
import { exportScene } from '../src/infra/export.js';

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
test('nested parameters and expression-driven grid counts produce predictable geometry', () => {
  const beam = parse(ModelSchema, {
    schemaVersion: 1,
    kind: 'model',
    id: 'beam',
    name: 'Beam',
    parameters: { length: { default: 1, min: 0.1, max: 20 } },
    materials: { paint: { color: '#eeeeee' } },
    geometries: { shape: { type: 'box', size: [{ $param: 'length' }, 1, 1] } },
    nodes: [{ type: 'mesh', id: 'body', geometry: 'shape', material: 'paint' }],
  });
  const rack = parse(ModelSchema, {
    schemaVersion: 1,
    kind: 'model',
    id: 'rack',
    name: 'Rack',
    parameters: { span: { default: 4 }, rows: { default: 2 } },
    nodes: [
      {
        type: 'model',
        id: 'beams',
        model: 'beam',
        parameters: { length: { $expr: 'sub', args: [{ $param: 'span' }, 1] } },
        pattern: {
          type: 'grid',
          counts: [1, { $param: 'rows' }, 2],
          step: [0, 2, 3],
          centered: true,
        },
      },
    ],
  });
  const doc = parse(SceneSchema, {
    schemaVersion: 1,
    kind: 'scene',
    id: 'main',
    name: 'Rack',
    parameters: { width: 6 },
    nodes: [
      {
        type: 'model',
        id: 'rack',
        model: 'rack',
        parameters: { span: { $param: 'width' }, rows: 3 },
      },
    ],
  });
  const compiled = compileScene(doc, { beam, rack });
  try {
    assert.equal(compiled.stats.meshes, 6);
    assert.deepEqual(compiled.stats.bounds.size, [5, 5, 4]);
  } finally {
    compiled.dispose();
  }
});
test('invalid pattern counts and group patterns are rejected before expansion', () => {
  for (const pattern of [
    { type: 'linear', count: 1.5, step: [1, 0, 0] },
    { type: 'grid', counts: [17, 17, 1], step: [1, 1, 1] },
    { type: 'grid', counts: [0, 1, 1], step: [1, 1, 1] },
  ]) {
    const doc = scene();
    doc.nodes[0].pattern = pattern as any;
    assert.throws(() => compileScene(doc), { code: 'PATTERN_COUNT' });
  }
  const doc = scene();
  doc.nodes.push(
    parse(NodeSchema, {
      id: 'bad',
      type: 'group',
      pattern: { type: 'linear', count: 2, step: [1, 0, 0] },
    }),
  );
  assert.throws(() => compileScene(doc), { code: 'INVALID_NODE_TYPE' });
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
test('pattern patches can remove repetition without replacing unrelated fields', () => {
  const s = scene();
  s.nodes[0].pattern = { type: 'linear', count: 3, step: [3, 0, 0] };
  const next = applyOperations(s, [
    parse(OperationSchema, { op: 'patchNode', id: 'one', patch: { pattern: null } }),
  ]);
  assert.equal(next.nodes[0].pattern, undefined);
  assert.deepEqual(next.nodes[0].tags, ['cargo']);
});
test('fitted cameras contain every corner in all views and wide/narrow frames', () => {
  const box = new Box3(new Vector3(-5, -0.1, -1), new Vector3(9, 4, 2));
  for (const view of ['iso', 'front', 'back', 'left', 'right', 'top', 'bottom', 'orbit'] as const)
    for (const aspect of [0.1, 0.5, 1, 3, 8])
      for (const projection of ['perspective', 'orthographic'] as const) {
        const { camera } = fitCamera(
          box,
          aspect,
          parse(CameraRequestSchema, { view, projection, azimuth: 123, elevation: -15 }),
        );
        for (const x of [box.min.x, box.max.x])
          for (const y of [box.min.y, box.max.y])
            for (const z of [box.min.z, box.max.z]) {
              const p = new Vector3(x, y, z).project(camera);
              assert.ok(
                Math.abs(p.x) <= 1.000001 && Math.abs(p.y) <= 1.000001 && Math.abs(p.z) <= 1,
                JSON.stringify({ view, aspect, projection, p }),
              );
            }
      }
});
test('subtree review retains ancestor transforms while excluding sibling geometry', () => {
  const s = scene();
  s.nodes.push({
    id: 'parent',
    type: 'group',
    visible: true,
    tags: [],
    transform: { position: [10, 2, 4], scale: [2, 1, 3], rotation: [0, 20, 0] },
  });
  s.nodes[0].parent = 'parent';
  s.nodes[0].transform = { rotation: [0, 45, 0] };
  const original = inspectNodes(s, {}, { ids: ['one'] }, true) as any[];
  const isolated = authoringTarget(s, {}, { node: 'one' });
  const built = compileScene(isolated);
  try {
    assert.equal(built.stats.meshes, 1);
    assert.deepEqual(built.stats.bounds, original[0].bounds);
  } finally {
    built.dispose();
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
