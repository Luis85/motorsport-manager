// Public schema boundary. The model recipe contracts live in one module per family inside
// the shared kernel (../model-forge/src/kernel/domain: values, geometry, material, nodes,
// documents, operations, review, Littlewild and procedural), reached only through the
// kernel bridge; Scene Forge's own project, composition, scene-bundle and Littlewild export
// contracts live in schema-project.ts. This module re-exports exactly the public schema
// surface, including the kernel's guarded `parse` entry point that rejects cyclic or
// over-deep input before validation, and owns the named schema registry that drives
// `schema` discovery and the generated JSON Schema files.
import { z } from 'zod';
import {
  fail,
  Scalar,
  GeometrySchema,
  MaterialSchema,
  PatternSchema,
  RigSchema,
  NodeSchema,
  SceneSchema,
  ModelSchema,
  ModelBundleSchema,
  SelectorSchema,
  BatchSchema,
  CameraSnapshotSchema,
  CameraRequestSchema,
  ReviewPlanSchema,
  QualityPolicySchema,
  ScatterRecipeSchema,
} from '../kernel.js';
import {
  ProjectSchema,
  CompositionSchema,
  SceneBundleSchema,
  LittlewildExportSchema,
} from './schema-project.js';

export { ForgeError, fail, parse } from '../kernel.js';
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
} from '../kernel.js';
export {
  GeometrySchema,
  MaterialSchema,
  SurfaceSchema,
  FinishSchema,
  PatternSchema,
  RigSchema,
  NodeSchema,
  type Geometry,
  type SurfaceSpec,
  type FinishSpec,
  type RigSpec,
  type NodeSpec,
  type MaterialSpec,
} from '../kernel.js';
export {
  CameraSchema,
  EnvironmentSchema,
  SceneSchema,
  ModelSchema,
  ModelBundleSchema,
  type SceneDocument,
  type ModelDocument,
  type ModelLibrary,
} from '../kernel.js';
export {
  NodePatchSchema,
  SelectorSchema,
  OperationSchema,
  BatchSchema,
  type NodeSelector,
  type Operation,
} from '../kernel.js';
export {
  littlewildFamilies,
  LittlewildId,
  LittlewildAssetSchema,
  type LittlewildAsset,
} from '../kernel.js';
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
} from '../kernel.js';
export {
  ProjectSchema,
  CompositionSchema,
  SceneBundleSchema,
  LittlewildExportSchema,
  type ProjectDocument,
  type SceneBundle,
  type LittlewildExport,
} from './schema-project.js';

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
  scatter: ScatterRecipeSchema,
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
