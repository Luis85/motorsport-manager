import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BatchSchema, parse, ForgeError } from '../src/kernel.js';
import { jsonSchema } from '../src/domain/schema.js';
import {
  initProject,
  loadProject,
  commitOperations,
  restoreScene,
  importModel,
} from '../src/infra/project.js';
const code = (expected: string) => (error: unknown) =>
  error instanceof ForgeError && error.code === expected;
test('batch edits are idempotent, guarded, rollback on invalid geometry and restore as a new revision', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-test-'));
  try {
    await initProject(root, 'Test');
    const ops = parse(BatchSchema, {
      operations: [
        { op: 'putMaterial', id: 'mat', material: { color: '#112233' } },
        { op: 'putGeometry', id: 'box', geometry: { type: 'box', size: [1, 1, 1] } },
        { op: 'putNode', node: { type: 'mesh', id: 'cube', geometry: 'box', material: 'mat' } },
      ],
    }).operations;
    const dry = await commitOperations(root, undefined, ops, { dryRun: true });
    assert.equal(dry.revision, 0);
    assert.equal((await loadProject(root)).scene.nodes.length, 0);
    const first = await commitOperations(root, undefined, ops, { expectedRevision: 0 });
    assert.equal(first.revision, 1);
    const again = await commitOperations(root, undefined, ops, { expectedRevision: 1 });
    assert.equal(again.changed, false);
    assert.equal(again.revision, 1);
    await assert.rejects(
      commitOperations(root, undefined, ops, { expectedRevision: 0 }),
      code('REVISION_CONFLICT'),
    );
    await assert.rejects(
      commitOperations(root, undefined, [{ op: 'removeGeometry', id: 'box' }]),
      code('REFERENCE_MISSING'),
    );
    assert.equal((await loadProject(root)).scene.revision, 1);
    const restored = await restoreScene(root, undefined, 0, 1);
    assert.equal(restored.revision, 2);
    assert.equal((await loadProject(root)).scene.nodes.length, 0);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test('model replacement validates all registered scenes before changing disk', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-model-test-'));
  try {
    await initProject(root);
    const model = {
      schemaVersion: 1,
      kind: 'model',
      id: 'thing',
      name: 'Thing',
      parameters: { width: { default: 1, min: 0.5, max: 3 } },
      geometries: { box: { type: 'box', size: [{ $param: 'width' }, 1, 1] } },
      materials: { m: { color: '#aabbcc' } },
      nodes: [{ type: 'mesh', id: 'body', geometry: 'box', material: 'm' }],
    };
    await importModel(root, model);
    await commitOperations(
      root,
      undefined,
      parse(BatchSchema, {
        operations: [
          {
            op: 'putNode',
            node: { type: 'model', id: 'instance', model: 'thing', parameters: { width: 2 } },
          },
        ],
      }).operations,
    );
    await assert.rejects(
      importModel(
        root,
        { ...model, parameters: { width: { default: 1, min: 0.5, max: 1.5 } } },
        true,
      ),
      code('PARAMETER_RANGE'),
    );
    assert.equal((await loadProject(root)).models.thing.parameters.width.max, 3);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test('JSON Schema exposes the discriminated input contract', () => {
  const schema: any = jsonSchema('batch');
  assert.equal(schema.type, 'object');
  assert.ok(schema.properties.operations);
  assert.equal(schema.additionalProperties, false);
});
test('project write rejects a model directory symlink escaping the project', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-path-test-'));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-outside-test-'));
  try {
    await initProject(root);
    await fs.rmdir(path.join(root, 'models'));
    await fs.symlink(outside, path.join(root, 'models'), 'dir');
    await assert.rejects(
      importModel(root, { schemaVersion: 1, kind: 'model', id: 'thing', name: 'Thing' }),
      code('INVALID_PATH'),
    );
    assert.deepEqual(await fs.readdir(outside), []);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  }
});
