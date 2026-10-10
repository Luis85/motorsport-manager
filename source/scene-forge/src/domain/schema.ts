// Public schema boundary. The contracts themselves live in one module per family
// (values, content, documents, operations, Littlewild and capture); this module
// re-exports exactly that public surface, owns the guarded `parse` entry point that
// rejects cyclic or over-deep input before validation, and the named schema registry
// that drives `schema` discovery and the generated JSON Schema files.
import { fail } from './errors.js';
export { ForgeError, fail } from './errors.js';
import { z } from 'zod';
import { Scalar } from './schema-values.js';
import {
  GeometrySchema,
  MaterialSchema,
  PatternSchema,
  RigSchema,
  NodeSchema,
} from './schema-content.js';
import {
  SceneSchema,
  ModelSchema,
  ProjectSchema,
  ModelBundleSchema,
  SceneBundleSchema,
} from './schema-documents.js';
import { SelectorSchema, BatchSchema, CompositionSchema } from './schema-operations.js';
import { LittlewildExportSchema } from './schema-littlewild.js';
import {
  CameraSnapshotSchema,
  CameraRequestSchema,
  ReviewPlanSchema,
  QualityPolicySchema,
} from './schema-capture.js';

export {
  Id,
  NumberValue,
  expressionOperators,
  Scalar,
  Vec3,
  Transform,
  type ScalarValue,
  type V3,
  type V2,
  type TransformSpec,
} from './schema-values.js';
export {
  GeometrySchema,
  MaterialSchema,
  PatternSchema,
  RigSchema,
  NodeSchema,
  type Geometry,
  type RigSpec,
  type NodeSpec,
  type MaterialSpec,
} from './schema-content.js';
export {
  CameraSchema,
  EnvironmentSchema,
  SceneSchema,
  ModelSchema,
  ProjectSchema,
  ModelBundleSchema,
  SceneBundleSchema,
  type SceneBundle,
  type SceneDocument,
  type ModelDocument,
  type ProjectDocument,
  type ModelLibrary,
} from './schema-documents.js';
export {
  NodePatchSchema,
  SelectorSchema,
  OperationSchema,
  BatchSchema,
  CompositionSchema,
  type NodeSelector,
  type Operation,
} from './schema-operations.js';
export {
  littlewildFamilies,
  LittlewildId,
  LittlewildAssetSchema,
  LittlewildExportSchema,
  type LittlewildAsset,
  type LittlewildExport,
} from './schema-littlewild.js';
export {
  viewNames,
  CameraSnapshotSchema,
  CameraRequestSchema,
  ReviewPlanSchema,
  QualityPolicySchema,
  type CameraSnapshot,
  type CameraRequest,
  type ReviewPlan,
  type QualityPolicy,
} from './schema-capture.js';

export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const pending: [unknown, number, boolean][] = [[input, 0, false]];
  const visited = new WeakSet<object>(),
    active = new WeakSet<object>();
  while (pending.length) {
    const [value, depth, leaving] = pending.pop()!;
    if (value && typeof value === 'object') {
      if (leaving) {
        active.delete(value);
        continue;
      }
      if (active.has(value)) fail('CYCLE', 'Input must be acyclic JSON data.');
      if (depth > 128) fail('DEPTH_LIMIT', 'Input nesting exceeds 128 levels.');
      if (visited.has(value)) continue;
      visited.add(value);
      active.add(value);
      pending.push([value, depth, true]);
      for (const child of Object.values(value)) pending.push([child, depth + 1, false]);
    }
  }
  const result = schema.safeParse(input);
  if (!result.success)
    fail(
      'SCHEMA_INVALID',
      'Input does not match the schema. Use the schema command to inspect the contract.',
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  return result.data;
}
export const schemas = {
  scene: SceneSchema,
  model: ModelSchema,
  project: ProjectSchema,
  batch: BatchSchema,
  node: NodeSchema,
  geometry: GeometrySchema,
  material: MaterialSchema,
  composition: CompositionSchema,
  'model-bundle': ModelBundleSchema,
  'scene-bundle': SceneBundleSchema,
  selector: SelectorSchema,
  scalar: Scalar,
  review: ReviewPlanSchema,
  camera: CameraRequestSchema,
  'camera-snapshot': CameraSnapshotSchema,
  'quality-policy': QualityPolicySchema,
  pattern: PatternSchema,
  rig: RigSchema,
  'littlewild-export': LittlewildExportSchema,
} satisfies Record<string, z.ZodType>;

export const schemaKinds = Object.keys(schemas) as (keyof typeof schemas)[];
export function jsonSchema(kind: string) {
  if (!Object.hasOwn(schemas, kind))
    fail('UNKNOWN_SCHEMA', `Unknown schema ${kind}.`, { available: Object.keys(schemas) });
  return z.toJSONSchema(schemas[kind as keyof typeof schemas], {
    target: 'draft-2020-12',
    io: 'input',
  });
}
