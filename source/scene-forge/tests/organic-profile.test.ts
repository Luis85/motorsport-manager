import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SceneSchema, ModelSchema, OperationSchema, parse, compileScene } from '../src/kernel.js';
import { initProject, loadProject, commitOperations } from '../src/infra/project.js';

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
