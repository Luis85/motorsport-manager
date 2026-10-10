import { z } from 'zod';
import {
  fail,
  Scalar,
  ModelSchema,
  ModelBundleSchema,
  NodeSchema,
  NodePatchSchema,
  GeometrySchema,
  MaterialSchema,
  SelectorSchema,
  ReviewPlanSchema,
  CameraRequestSchema,
  CameraSnapshotSchema,
  QualityPolicySchema,
  PatternSchema,
  RigSchema,
  LittlewildAssetSchema,
} from '../kernel/index.js';
import { ModelBatchSchema, ModelOperationSchema, ParameterSpecSchema } from './document.js';

/** The machine-readable contracts `schema --kind` publishes. */
export const schemas = {
  model: ModelSchema,
  'model-bundle': ModelBundleSchema,
  batch: ModelBatchSchema,
  operation: ModelOperationSchema,
  node: NodeSchema,
  'node-patch': NodePatchSchema,
  geometry: GeometrySchema,
  material: MaterialSchema,
  parameter: ParameterSpecSchema,
  rig: RigSchema,
  pattern: PatternSchema,
  selector: SelectorSchema,
  scalar: Scalar,
  review: ReviewPlanSchema,
  camera: CameraRequestSchema,
  'camera-snapshot': CameraSnapshotSchema,
  'quality-policy': QualityPolicySchema,
  'littlewild-asset': LittlewildAssetSchema,
} satisfies Record<string, z.ZodType>;
export const schemaKinds = Object.keys(schemas) as (keyof typeof schemas)[];

export function jsonSchema(kind: string) {
  if (!Object.hasOwn(schemas, kind))
    fail('UNKNOWN_SCHEMA', `Unknown schema ${kind}.`, { available: schemaKinds });
  return z.toJSONSchema(schemas[kind as keyof typeof schemas], {
    target: 'draft-2020-12',
    io: 'input',
  });
}
