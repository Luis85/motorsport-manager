import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { OperationSchema, parse, type SurfaceSpec } from '../src/kernel.js';
import { initProject, loadProject, commitOperations } from '../src/infra/project.js';

const surface: SurfaceSpec = { kind: 'fur', seed: 7, scale: 3, strength: 0.4 };
const body = {
  type: 'organic',
  size: [0.9, 1.1, 0.72],
  roundness: 0.9,
  taper: 0.22,
  bend: 0.12,
  segments: 32,
};
const coat = { color: '#c89059', roughness: 0.9, sheen: 0.65, surface };

test('organic and surface authoring is atomic, guarded, idempotent and dry-run reviewable', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'forge-plush-'));
  try {
    await initProject(root);
    const before = await loadProject(root);
    const operations = [
      { op: 'putGeometry', id: 'body', geometry: body },
      { op: 'putMaterial', id: 'coat', material: coat },
      { op: 'putNode', node: { id: 'body', type: 'mesh', geometry: 'body', material: 'coat' } },
    ].map((operation) => parse(OperationSchema, operation));
    const guard = { expectedRevision: before.scene.revision, expectedState: before.stateHash };
    const preview = await commitOperations(root, undefined, operations, { ...guard, dryRun: true });
    assert.equal((await loadProject(root)).stateHash, before.stateHash);
    const result = await commitOperations(root, undefined, operations, guard);
    assert.equal(result.stateHash, preview.proposedStateHash);
    await assert.rejects(() => commitOperations(root, undefined, operations, guard), {
      code: 'REVISION_CONFLICT',
    });
    const current = await loadProject(root);
    const repeated = await commitOperations(root, undefined, operations, {
      expectedState: current.stateHash,
    });
    assert.equal(repeated.changed, false);
    await assert.rejects(
      () =>
        commitOperations(root, undefined, [
          parse(OperationSchema, {
            op: 'putGeometry',
            id: 'body',
            geometry: { ...body, taper: 2 },
          }),
        ]),
      { code: 'INVALID_GEOMETRY' },
    );
    assert.equal((await loadProject(root)).stateHash, current.stateHash);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
