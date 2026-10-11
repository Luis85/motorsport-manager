import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3 } from 'three';
import {
  parse,
  SceneSchema,
  ModelSchema,
  NodeSchema,
  CameraRequestSchema,
  OperationSchema,
  compileScene,
  applyOperations,
  inspectNodes,
  fitCamera,
  authoringTarget,
} from '../src/kernel/index.js';

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
