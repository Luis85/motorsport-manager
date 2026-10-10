import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  parse,
  SceneSchema,
  ModelSchema,
  BatchSchema,
  ForgeError,
  type Operation,
  captureModel,
  modelDependencies,
} from '../src/kernel.js';
import { CompositionSchema } from '../src/domain/schema.js';
import {
  initProject,
  commitOperations,
  loadProject,
  importModel,
  captureProjectModel,
  cloneScene,
} from '../src/infra/project.js';

const fixture = () =>
  parse(SceneSchema, {
    schemaVersion: 1,
    kind: 'scene',
    id: 'main',
    name: 'Scene',
    parameters: { height: 2 },
    materials: { m: { color: '#b9bdc8' }, unused: { color: '#aaaaaa' } },
    geometries: {
      box: { type: 'box', size: [2, { $param: 'height' }, 2] },
      unused: { type: 'sphere', radius: 1 },
    },
    nodes: [
      { type: 'group', id: 'assembly', transform: { position: [4, 0, 0] } },
      {
        type: 'mesh',
        id: 'body',
        parent: 'assembly',
        geometry: 'box',
        material: 'm',
        transform: { position: [0, 1, 0] },
      },
      {
        type: 'mesh',
        id: 'target',
        geometry: 'box',
        material: 'm',
        transform: { position: [-4, 1, 0] },
      },
    ],
  });
const operations = (items: unknown[]) => parse(BatchSchema, { operations: items }).operations;
const errorCode = (code: string) => (error: unknown) =>
  error instanceof ForgeError && error.code === code;
test('portable bundles include transitive dependencies and import into a new project', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-bundle-'));
  try {
    await initProject(root);
    const leaf = captureModel(fixture(), ['assembly'], 'leaf');
    const parent = parse(ModelSchema, {
      schemaVersion: 1,
      kind: 'model',
      id: 'parent',
      name: 'Parent',
      nodes: [{ type: 'model', id: 'child', model: 'leaf' }],
    });
    const models = modelDependencies({ leaf, parent }, 'parent');
    assert.deepEqual(Object.keys(models), ['leaf', 'parent']);
    await importModel(root, { schemaVersion: 1, kind: 'model-bundle', entry: 'parent', models });
    const s = await loadProject(root);
    assert.equal(Object.keys(s.models).length, 2);
    await importModel(root, { schemaVersion: 1, kind: 'model-bundle', entry: 'parent', models });
    assert.equal(Object.keys((await loadProject(root)).models).length, 2);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test('state guard rejects library changes that do not increment scene revision', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-guard-'));
  try {
    await initProject(root);
    const before = await loadProject(root);
    await importModel(root, captureModel(fixture(), ['assembly'], 'module'));
    const after = await loadProject(root);
    assert.equal(after.scene.revision, before.scene.revision);
    assert.notEqual(after.stateHash, before.stateHash);
    await assert.rejects(
      commitOperations(root, undefined, operations([{ op: 'setParameter', id: 'x', value: 1 }]), {
        expectedState: before.stateHash,
      }),
      errorCode('STATE_CONFLICT'),
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test('capture and composition persist, remain idempotent and clone scene identity', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-capture-'));
  try {
    await initProject(root);
    const s = fixture();
    await commitOperations(
      root,
      undefined,
      operations([
        { op: 'putMaterial', id: 'm', material: s.materials.m },
        { op: 'putGeometry', id: 'box', geometry: { type: 'box', size: [2, 2, 2] } },
        ...s.nodes.map((node) => ({ op: 'putNode', node })),
      ]),
    );
    const before = await loadProject(root);
    await captureProjectModel(root, undefined, ['assembly'], 'module', 'Module', false, {
      expectedState: before.stateHash,
    });
    const recipe = parse(CompositionSchema, {
      schemaVersion: 1,
      kind: 'composition',
      instances: [{ id: 'instance', model: 'module', transform: { position: [9, 0, 0] } }],
    });
    const ops: Operation[] = recipe.instances.map((node) => ({ op: 'putNode', node }));
    assert.equal((await commitOperations(root, undefined, ops)).changed, true);
    assert.equal((await commitOperations(root, undefined, ops)).changed, false);
    await cloneScene(root, undefined, 'copy');
    const copy = await loadProject(root, 'copy');
    assert.equal(copy.scene.revision, 0);
    assert.equal(copy.scene.id, 'copy');
    assert.equal(copy.scene.nodes.length, 4);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test('model import drops the Model Forge editor revision so raw and portable imports agree', async () => {
  const roots = await Promise.all(
    [0, 1].map(() => fs.mkdtemp(path.join(os.tmpdir(), 'forge-revision-'))),
  );
  try {
    const portable = captureModel(fixture(), ['assembly'], 'module');
    const [raw, plain] = roots;
    for (const root of roots) await initProject(root);
    type Imported = { warnings?: string[]; model?: { revision?: number } };
    const imported: Imported = await importModel(raw, { ...portable, revision: 4 });
    assert.deepEqual(imported.warnings, [
      'Dropped the editor-only revision 4 of model module; projects store portable recipes.',
    ]);
    const exported = await importModel(plain, portable);
    assert.equal('warnings' in exported, false, 'portable imports report no warning');
    const [a, b] = await Promise.all(roots.map((root) => loadProject(root)));
    assert.equal(a.models.module.revision, undefined);
    assert.equal(a.stateHash, b.stateHash);
    assert.equal(
      await fs.readFile(path.join(raw, 'models/module.model.json'), 'utf8'),
      await fs.readFile(path.join(plain, 'models/module.model.json'), 'utf8'),
    );
    const bundle: Imported = await importModel(
      plain,
      {
        schemaVersion: 1,
        kind: 'model-bundle',
        entry: 'module',
        models: { module: { ...portable, revision: 2 } },
      },
      false,
      { dryRun: true },
    );
    assert.equal(bundle.model?.revision, undefined);
    assert.match(String(bundle.warnings), /revision 2 of model module/);
  } finally {
    await Promise.all(roots.map((root) => fs.rm(root, { recursive: true, force: true })));
  }
});
