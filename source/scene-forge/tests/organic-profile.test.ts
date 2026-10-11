import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as THREE from 'three';
import { SceneSchema, ModelSchema, OperationSchema, parse } from '../src/domain/schema.js';
import { createSurfacePool } from '../src/application/surfaces.js';
import { generateSurface } from '../src/application/surface-pattern.js';
import { compileScene } from '../src/application/compiler.js';
import { littlewildModel } from '../src/application/littlewild.js';
import { littlewildModels } from '../src/application/littlewild-import.js';
import { initProject, loadProject, commitOperations } from '../src/infra/project.js';
import { exportScene, validateExport } from '../src/infra/export.js';

const profile = [
  { at: -1, width: 1, depth: 1, offset: [0, 0] },
  { at: -0.35, width: 1.12, depth: 1.15, offset: [0, 0.12] },
  { at: 0.35, width: 0.75, depth: 0.8, offset: [0, 0] },
  { at: 1, width: 0.65, depth: 0.7, offset: [0.1, -0.08] },
];
const body = { type: 'organic', size: [1, 2, 1], profile, segments: 32 };
const surface = { kind: 'cloth', version: 2, seed: 9, scale: 3, strength: 0.4 };
const scene = (geometry: unknown = body) =>
  parse(SceneSchema, {
    schemaVersion: 1,
    kind: 'scene',
    id: 'sculpt',
    name: 'Profile sculpture',
    geometries: { body: geometry },
    materials: { cloth: { color: '#76865b', surface } },
    nodes: [{ id: 'torso', type: 'mesh', geometry: 'body', material: 'cloth', tags: ['rig:body'] }],
  });

test('profile stations produce deterministic closed UV meshes with exact authored crosssections', () => {
  const compiled = compileScene(scene()),
    repeated = compileScene(scene());
  try {
    assert.deepEqual(compiled.scene.toJSON(), repeated.scene.toJSON());
    const mesh = compiled.content.children[0] as THREE.Mesh;
    const positions = mesh.geometry.getAttribute('position'),
      uv = mesh.geometry.getAttribute('uv');
    assert.equal(uv.count, positions.count);
    assert(positions.count <= 5723);
    const station = profile[1],
      ring: number[] = [];
    for (let i = 0; i < positions.count; i++)
      if (Math.abs(positions.getY(i) - station.at) < 1e-6) ring.push(i);
    assert.equal(ring.length, 33, 'off-grid authored station gets its own ring');
    const radius = Math.sqrt(1 - station.at ** 2) / 2;
    assert(
      Math.abs(Math.max(...ring.map((i) => positions.getX(i))) - radius * station.width) < 1e-6,
    );
    assert(
      Math.abs(
        Math.max(...ring.map((i) => positions.getZ(i))) -
          (radius * station.depth + station.offset[1] / 2),
      ) < 1e-6,
    );
    const normals = mesh.geometry.getAttribute('normal');
    const edges = new Map<string, number>();
    const vertex = (index: number) =>
      [positions.getX(index), positions.getY(index), positions.getZ(index)]
        .map((v) => v.toFixed(5).replace('-0.00000', '0.00000'))
        .join(',');
    const indices = mesh.geometry.index!;
    for (let i = 0; i < indices.count; i += 3) {
      const ids = [indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)];
      const points = ids.map((id) => new THREE.Vector3().fromBufferAttribute(positions, id));
      const outward = points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0]));
      assert(outward.length() > 1e-8, 'triangle must not collapse');
      assert(
        outward.dot(new THREE.Vector3().fromBufferAttribute(normals, ids[0])) > 0,
        'outward winding',
      );
      for (let edge = 0; edge < 3; edge++) {
        const key = [vertex(ids[edge]), vertex(ids[(edge + 1) % 3])].sort().join('|');
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    assert(
      [...edges.values()].every((count) => count === 2),
      'every welded edge has two incident faces',
    );
  } finally {
    compiled.dispose();
    repeated.dispose();
  }
});

test('profiles resolve parameters and reject unsafe shapes without changing a guarded project', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'forge-profile-'));
  try {
    await initProject(root);
    const before = await loadProject(root);
    const operations = [
      { op: 'putGeometry', id: 'body', geometry: body },
      { op: 'putMaterial', id: 'cloth', material: { color: '#76865b', surface } },
      { op: 'putNode', node: { id: 'torso', type: 'mesh', geometry: 'body', material: 'cloth' } },
    ].map((value) => parse(OperationSchema, value));
    const guards = { expectedRevision: before.scene.revision, expectedState: before.stateHash };
    const dry = await commitOperations(root, undefined, operations, { ...guards, dryRun: true });
    assert.equal((await loadProject(root)).stateHash, before.stateHash);
    const applied = await commitOperations(root, undefined, operations, guards);
    assert.equal(applied.stateHash, dry.proposedStateHash);
    await assert.rejects(() => commitOperations(root, undefined, operations, guards), {
      code: 'REVISION_CONFLICT',
    });
    for (const edit of [
      (p: typeof profile) => {
        p[0].at = -0.9;
      },
      (p: typeof profile) => {
        p[2].at = p[1].at;
      },
      (p: typeof profile) => {
        p[2].at = p[1].at + 0.01;
      },
      (p: typeof profile) => {
        p[1].width = 0;
      },
      (p: typeof profile) => {
        p[1].depth = 2.1;
      },
      (p: typeof profile) => {
        p[1].offset[0] = 0.8;
      },
    ]) {
      const changed = structuredClone(profile);
      edit(changed);
      await assert.rejects(
        () =>
          commitOperations(root, undefined, [
            parse(OperationSchema, {
              op: 'putGeometry',
              id: 'body',
              geometry: { ...body, profile: changed },
            }),
          ]),
        { code: 'INVALID_GEOMETRY' },
      );
      assert.equal((await loadProject(root)).stateHash, applied.stateHash);
    }
    const parametric = parse(ModelSchema, {
      schemaVersion: 1,
      kind: 'model',
      id: 'sculpted',
      name: 'Sculpted body',
      materials: scene().materials,
      nodes: scene().nodes,
      parameters: { waist: { default: 0.75, min: 0.1, max: 2 } },
      geometries: {
        body: {
          ...body,
          profile: profile.map((p, i) => (i === 2 ? { ...p, width: { $param: 'waist' } } : p)),
        },
      },
    });
    const doc = scene();
    doc.nodes = parse(SceneSchema, {
      ...doc,
      nodes: [{ id: 'actor', type: 'model', model: parametric.id, parameters: { waist: 0.6 } }],
    }).nodes;
    const compiled = compileScene(doc, { [parametric.id]: parametric });
    compiled.dispose();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('profile surfaces survive Littlewild roundtrip and Khronos-valid GLB with versioned material metadata', async () => {
  const built = compileScene(scene()),
    root = await mkdtemp(path.join(tmpdir(), 'forge-profile-export-'));
  try {
    const visual = littlewildModel(built.scene, { rig: false });
    const imported = parse(
      ModelSchema,
      Object.values(
        littlewildModels({
          format: 'littlewild-3d-asset',
          schemaVersion: 1,
          id: 'sculpt',
          name: 'Sculpt',
          category: 'creature',
          ...visual,
          models: { world: { nodes: visual.nodes } },
        }),
      )[0],
    );
    assert.deepEqual(Object.values(imported.materials)[0].surface, surface);
    const source = Object.values(visual.meshes)[0],
      mesh = Object.values(imported.geometries)[0];
    assert.equal(mesh.type, 'mesh');
    if (mesh.type !== 'mesh') return;
    assert.deepEqual(mesh.positions.flat(), source.positions);
    assert.deepEqual(mesh.uvs!.flat(), source.uvs);
    const output = await exportScene(scene(), {}, 'glb');
    const report = await validateExport(output.data, 'glb');
    assert.equal(report.numErrors, 0);
    assert.equal(report.numWarnings, 0);
    const bytes = Buffer.from(output.data),
      json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    assert.equal(json.materials[0].extras.surfaceAlgorithm, 'littlewild-surface-v2');
    assert.deepEqual(json.materials[0].extras.surface, surface);
  } finally {
    built.dispose();
    await rm(root, { recursive: true, force: true });
  }
});

test('explicit version one shares original texture ownership while fine detail stays separate', () => {
  const pool = createSurfacePool(),
    materials = [
      new THREE.MeshStandardMaterial(),
      new THREE.MeshStandardMaterial(),
      new THREE.MeshStandardMaterial(),
    ];
  const legacy = { kind: 'fur' as const, seed: 8, scale: 3, strength: 0.4 };
  try {
    pool.apply(materials[0], legacy);
    pool.apply(materials[1], { ...legacy, version: 1 });
    pool.apply(materials[2], { ...legacy, version: 2 });
    assert.equal(materials[0].map, materials[1].map);
    assert.notEqual(materials[0].map, materials[2].map);
    assert.deepEqual(generateSurface(legacy), generateSurface({ ...legacy, version: 1 }));
    assert.notDeepEqual(
      generateSurface(legacy).normal,
      generateSurface({ ...legacy, version: 2 }).normal,
    );
    assert.equal(materials[2].userData.surfaceAlgorithm, 'littlewild-surface-v2');
  } finally {
    pool.dispose();
    for (const material of materials) material.dispose();
  }
});
