import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Box3, Vector3, Mesh, ObjectLoader } from 'three';
import {
  parse,
  SceneSchema,
  ModelSchema,
  CameraRequestSchema,
  CameraSnapshotSchema,
} from '../src/domain/schema.js';
import { compileScene } from '../src/application/compiler.js';
import { auditScene } from '../src/application/quality.js';
import { fitCamera, cameraData } from '../src/application/camera.js';
import { exportScene, validateExport } from '../src/infra/export.js';
import { readJson } from '../src/infra/project.js';

const fixture = (extra: Record<string, unknown> = {}) =>
  parse(SceneSchema, {
    schemaVersion: 1,
    kind: 'scene',
    id: 'main',
    name: 'Quality fixture',
    geometries: { box: { type: 'box', size: [1, 1, 1] } },
    materials: { paint: { color: '#ccbbaa' } },
    nodes: [{ id: 'box', type: 'mesh', geometry: 'box', material: 'paint' }],
    ...extra,
  });

test('resource pooling shares repeated models, preserves variants and produces lean valid glTF', async () => {
  const model = parse(ModelSchema, {
    schemaVersion: 1,
    name: 'Block',
    materials: fixture().materials,
    nodes: fixture().nodes,
    kind: 'model',
    id: 'block',
    parameters: { width: { default: 1 } },
    geometries: { box: { type: 'box', size: [{ $param: 'width' }, 1, 1] } },
  });
  const doc = fixture({
    nodes: [
      { id: 'a', type: 'model', model: 'block' },
      { id: 'b', type: 'model', model: 'block', transform: { position: [2, 0, 0] } },
      {
        id: 'c',
        type: 'model',
        model: 'block',
        parameters: { width: 3 },
        transform: { position: [5, 0, 0] },
      },
    ],
  });
  const built = compileScene(doc, { block: model });
  try {
    const meshes: Mesh[] = [];
    built.content.traverse((o) => {
      if (o instanceof Mesh) meshes.push(o);
    });
    assert.equal(meshes[0].geometry, meshes[1].geometry);
    assert.notEqual(meshes[0].geometry, meshes[2].geometry);
    assert.equal(meshes[0].material, meshes[2].material);
    assert.equal(built.stats.geometries, 2);
    assert.equal(built.stats.materials, 1);
    assert.equal(meshes[1].userData.forgePath, 'main/b/box');
    assert.equal(meshes[1].userData.material, 'paint');
  } finally {
    built.dispose();
  }
  const result = await exportScene(doc, { block: model }, 'gltf');
  const json = JSON.parse(result.data as string);
  assert.equal(json.meshes.length, 2);
  assert.equal(json.materials.length, 1);
  assert.equal((await validateExport(result.data, 'gltf')).numErrors, 0);
});

test('custom mesh normals and UVs survive export and invalid attributes fail early', async () => {
  const doc = fixture({
    geometries: {
      box: {
        type: 'mesh',
        positions: [
          [0, 0, 0],
          [1, 0, 0],
          [0, 1, 0],
        ],
        indices: [0, 1, 2],
        normals: [
          [0, 0, 2],
          [0, 0, 2],
          [0, 0, 2],
        ],
        uvs: [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
      },
    },
  });
  const built = compileScene(doc);
  try {
    const mesh = built.content.children[0] as Mesh;
    assert.deepEqual(
      Array.from(mesh.geometry.getAttribute('normal').array),
      [0, 0, 1, 0, 0, 1, 0, 0, 1],
    );
    assert.deepEqual(Array.from(mesh.geometry.getAttribute('uv').array), [0, 0, 1, 0, 0, 1]);
    assert.deepEqual(built.stats.warnings, []);
  } finally {
    built.dispose();
  }
  const exported = await exportScene(doc, {}, 'gltf');
  const primitive = JSON.parse(exported.data as string).meshes[0].primitives[0];
  assert.ok(primitive.attributes.NORMAL >= 0);
  assert.ok(primitive.attributes.TEXCOORD_0 >= 0);
  assert.equal((await validateExport(exported.data, 'gltf')).numErrors, 0);
  for (const patch of [
    {
      uvs: [
        [0, 0],
        [1, 0],
      ],
    },
    {
      normals: [
        [0, 0, 0],
        [0, 0, 1],
        [0, 0, 1],
      ],
    },
  ]) {
    const bad = structuredClone(doc);
    Object.assign(bad.geometries.box, patch);
    assert.throws(() => compileScene(bad), { code: 'INVALID_GEOMETRY' });
  }
});

test('quality budgets inspect visible output, report repairable failures and leave source unchanged', () => {
  const doc = fixture({
    nodes: [
      { id: 'box', type: 'mesh', geometry: 'box', material: 'paint' },
      { id: 'hidden', type: 'group', visible: false },
      { id: 'extra', type: 'mesh', geometry: 'box', material: 'paint', parent: 'hidden' },
    ],
  });
  const before = JSON.stringify(doc);
  const pass = auditScene(
    doc,
    {},
    { maxTriangles: 12, maxMeshes: 1, maxMaterials: 1, requireUVs: true },
  );
  assert.equal(pass.passed, true);
  assert.equal(pass.metrics.meshes, 1);
  assert.equal(pass.metrics.geometries, 1);
  const fail = auditScene(doc, {}, { maxTriangles: 11, maxExtent: 0.5 });
  assert.equal(fail.summary.errors, 2);
  assert.ok(fail.findings.every((f) => f.hint));
  assert.equal(JSON.stringify(doc), before);
  assert.equal(auditScene(fixture({ nodes: [] })).findings[0].code, 'EMPTY_DELIVERABLE');
});

test('quality findings aggregate instances and distinguish errors from review warnings', () => {
  const doc = fixture({
    geometries: {
      box: {
        type: 'mesh',
        positions: [
          [0, 0, 0],
          [1, 0, 0],
          [2, 0, 0],
        ],
        indices: [0, 1, 2],
      },
    },
    materials: { paint: { color: '#aabbcc', opacity: 0.5, doubleSided: true } },
    nodes: [
      {
        id: 'bad',
        type: 'mesh',
        geometry: 'box',
        material: 'paint',
        pattern: { type: 'linear', count: 20, step: [0, 1, 0] },
      },
    ],
  });
  const report = auditScene(doc, {}, { requireUVs: true, allowDoubleSided: false });
  const degenerate = report.findings.find((f) => f.code === 'DEGENERATE_TRIANGLES')!;
  assert.equal(degenerate.count, 20);
  assert.equal(degenerate.paths.length, 10);
  assert.equal(report.findings.find((f) => f.code === 'TRANSPARENCY')!.severity, 'warning');
  assert.equal(
    auditScene(doc, {}, { allowTransparency: false }).findings.find(
      (f) => f.code === 'TRANSPARENCY',
    )!.severity,
    'error',
  );
});

test('fixed perspective and orthographic cameras keep zoom and framing after scene bounds change', () => {
  for (const view of ['iso', 'top'] as const) {
    const original = fitCamera(
      new Box3(new Vector3(-2, -1, -3), new Vector3(2, 1, 3)),
      1.5,
      parse(CameraRequestSchema, { view }),
    );
    original.camera.zoom = 2.3;
    original.camera.updateProjectionMatrix();
    const snapshot = parse(CameraSnapshotSchema, cameraData(original.camera, original.target));
    const replay = fitCamera(
      new Box3(new Vector3(-100, -100, -100), new Vector3(100, 100, 100)),
      1.5,
      parse(CameraRequestSchema, { fixed: snapshot }),
    );
    assert.deepEqual(cameraData(replay.camera, replay.target), snapshot);
    assert.deepEqual(
      replay.camera.projectionMatrix.elements,
      original.camera.projectionMatrix.elements,
    );
  }
  const bad = {
    projection: 'perspective',
    position: [0, 0, 0],
    target: [0, 0, 0],
    up: [0, 1, 0],
    near: 1,
    far: 0.1,
    fov: 40,
    aspect: 1,
  };
  assert.throws(() => parse(CameraSnapshotSchema, bad), { code: 'SCHEMA_INVALID' });
});

test('subtree exports retain sheared world placement by preserving transform-only ancestors', async () => {
  const doc = fixture({
    nodes: [
      { id: 'parent', type: 'group', transform: { scale: [3, 1, 1], rotation: [20, 30, 10] } },
      {
        id: 'child',
        type: 'mesh',
        geometry: 'box',
        material: 'paint',
        parent: 'parent',
        transform: { rotation: [0, 45, 0], position: [2, 0, 1] },
      },
      { id: 'other', type: 'mesh', geometry: 'box', material: 'paint' },
    ],
  });
  const built = compileScene(doc);
  try {
    const expected = built.content.getObjectByName('main/child')!;
    const result = await exportScene(doc, {}, 'three', 'child');
    const restored = new ObjectLoader().parse(JSON.parse(result.data as string));
    restored.updateMatrixWorld(true);
    const actual = restored.getObjectByName('main/child')!;
    actual.matrixWorld.elements.forEach((v, i) =>
      assert.ok(Math.abs(v - expected.matrixWorld.elements[i]) < 1e-12),
    );
    assert.equal(restored.getObjectByName('main/other'), undefined);
    const glb = await exportScene(doc, {}, 'glb', 'child');
    assert.equal((await validateExport(glb.data, 'glb')).numErrors, 0);
  } finally {
    built.dispose();
  }
});

test('JSON reads enforce a byte limit without corrupting multibyte input', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-json-'));
  try {
    const file = path.join(root, 'data.json');
    const value = { text: 'λ'.repeat(40000) };
    await fs.writeFile(file, JSON.stringify(value));
    assert.deepEqual(await readJson(file), value);
    await fs.writeFile(file, ' '.repeat(16 * 1024 * 1024 + 1));
    await assert.rejects(readJson(file), { code: 'INPUT_TOO_LARGE' });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('camera snapshots support scaled scenes while overflowing hierarchy transforms fail clearly', () => {
  const fitted = fitCamera(
    new Box3(new Vector3(-2e6, -2e6, -2e6), new Vector3(2e6, 2e6, 2e6)),
    1,
    parse(CameraRequestSchema, { view: 'top' }),
  );
  assert.ok(
    parse(CameraSnapshotSchema, cameraData(fitted.camera, fitted.target)).position[1] > 1e6,
  );
  const nodes: any[] = Array.from({ length: 54 }, (_, i) => ({
    id: `group${i}`,
    type: 'group',
    ...(i ? { parent: `group${i - 1}` } : {}),
    transform: { scale: [1e6, 1e6, 1e6] },
  }));
  nodes.push({ id: 'box', type: 'mesh', parent: 'group53', geometry: 'box', material: 'paint' });
  assert.throws(() => compileScene(fixture({ nodes })), { code: 'TRANSFORM_RANGE' });
});

test('lathe axis caps omit redundant zero-area faces while retaining valid closed surfaces', async () => {
  const doc = fixture({
    geometries: {
      box: {
        type: 'lathe',
        points: [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
        segments: 8,
      },
    },
  });
  const report = auditScene(doc);
  assert.equal(report.passed, true);
  assert.equal(report.metrics.triangles, 32);
  assert.deepEqual(report.metrics.bounds.size, [2, 1, 2]);
  const result = await exportScene(doc, {}, 'glb');
  assert.equal((await validateExport(result.data, 'glb')).numErrors, 0);
});
