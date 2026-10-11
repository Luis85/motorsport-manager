import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import * as facade from '../src/domain/schema.js';
import * as project from '../src/domain/schema-project.js';
// The model recipe families are owned by the shared kernel (../model-forge/src/kernel).
import * as values from '../../model-forge/src/kernel/domain/schema-values.js';
import * as geometry from '../../model-forge/src/kernel/domain/schema-geometry.js';
import * as material from '../../model-forge/src/kernel/domain/schema-material.js';
import * as nodes from '../../model-forge/src/kernel/domain/schema-nodes.js';
import * as documents from '../../model-forge/src/kernel/domain/schema-documents.js';
import * as operations from '../../model-forge/src/kernel/domain/schema-operations.js';
import * as review from '../../model-forge/src/kernel/domain/schema-review.js';
import * as littlewild from '../../model-forge/src/kernel/domain/schema-littlewild.js';
import * as procedural from '../../model-forge/src/kernel/domain/schema-procedural.js';

const projectRoot = path.resolve(import.meta.dirname, '..');
const families = {
  values,
  geometry,
  material,
  nodes,
  documents,
  operations,
  review,
  littlewild,
  procedural,
  project,
};
/** The runtime surface `domain/schema.ts` exposes (the package index adds the whole kernel). */
const publicSchemaExports = [
  'BatchSchema',
  'CameraRequestSchema',
  'CameraSchema',
  'CameraSnapshotSchema',
  'CompositionSchema',
  'EnvironmentSchema',
  'FinishSchema',
  'ForgeError',
  'GeometrySchema',
  'Id',
  'LittlewildAssetSchema',
  'LittlewildExportSchema',
  'LittlewildId',
  'MaterialSchema',
  'ModelBundleSchema',
  'ModelSchema',
  'NodePatchSchema',
  'NodeSchema',
  'NumberValue',
  'OperationSchema',
  'PatternSchema',
  'ProjectSchema',
  'QualityPolicySchema',
  'ReviewPlanSchema',
  'RigSchema',
  'Scalar',
  'SceneBundleSchema',
  'SceneSchema',
  'SelectorSchema',
  'SurfaceSchema',
  'Transform',
  'Vec3',
  'expressionOperators',
  'fail',
  'jsonSchema',
  'littlewildFamilies',
  'parse',
  'schemaKinds',
  'schemas',
  'viewNames',
];

test('the schema facade keeps its public surface and re-exports family contracts by identity', () => {
  assert.deepEqual(Object.keys(facade).sort(), publicSchemaExports);
  const owners = new Map<string, string>();
  for (const [family, exports] of Object.entries(families))
    for (const [name, value] of Object.entries(exports)) {
      assert.equal(
        owners.has(name),
        false,
        `${name} is owned by ${owners.get(name)} and ${family}`,
      );
      owners.set(name, family);
      if (Object.hasOwn(facade, name))
        assert.equal(facade[name as keyof typeof facade], value, `${family}.${name}`);
    }
  // Building blocks shared between families stay out of the public schema facade.
  for (const internal of ['Vec2', 'Color', 'nodeBase', 'guards'])
    assert.equal(Object.hasOwn(facade, internal), false, internal);
  // Every registered kind is a contract owned by exactly one family module.
  const owned = new Set(Object.values(families).flatMap((exports) => Object.values(exports)));
  for (const [kind, schema] of Object.entries(facade.schemas))
    assert.ok(owned.has(schema), `${kind} is not owned by a schema family`);
});

test('checked-in JSON Schema files match the registry for every schema kind', async () => {
  const files = (await fs.readdir(path.join(projectRoot, 'schemas')))
    .filter((file) => file.endsWith('.schema.json'))
    .sort();
  assert.deepEqual(files, facade.schemaKinds.map((kind) => `${kind}.schema.json`).sort());
  for (const kind of facade.schemaKinds) {
    const file = await fs.readFile(
      path.join(projectRoot, 'schemas', `${kind}.schema.json`),
      'utf8',
    );
    assert.equal(JSON.stringify(facade.jsonSchema(kind), null, 2) + '\n', file, kind);
  }
});
