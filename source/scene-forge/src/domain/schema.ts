import { z } from 'zod';
import {
  fail,
  Id,
  Scalar,
  nodeBase,
  guards,
  SceneSchema,
  ModelSchema,
  BatchSchema,
  NodeSchema,
  GeometrySchema,
  MaterialSchema,
  ModelBundleSchema,
  SelectorSchema,
  ReviewPlanSchema,
  CameraRequestSchema,
  CameraSnapshotSchema,
  QualityPolicySchema,
  PatternSchema,
  RigSchema,
  LittlewildAssetSchema,
} from '../kernel.js';

/** Scene Forge project, composition and bundle contracts built on the model recipe kernel. */
export const ProjectSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: z.string().min(1).max(120),
    activeScene: Id,
    scenes: z.record(Id, z.string()),
    models: z.record(Id, z.string()),
  })
  .strict();
export const CompositionSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal('composition'),
    ...guards,
    groups: z
      .array(z.object({ ...nodeBase, type: z.literal('group').default('group') }).strict())
      .default([]),
    instances: z
      .array(
        z
          .object({
            ...nodeBase,
            type: z.literal('model').default('model'),
            model: Id,
            parameters: z.record(Id, Scalar).default({}),
            materialOverrides: z.record(Id, Id).default({}),
          })
          .strict(),
      )
      .min(1)
      .max(10000),
  })
  .strict();
export const SceneBundleSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal('scene-bundle'),
    scene: SceneSchema,
    models: z.record(Id, ModelSchema),
  })
  .strict();
export const LittlewildExportSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal('littlewild-export'),
    target: z.string().min(1).max(512),
    assets: z.array(LittlewildAssetSchema).min(1).max(128),
  })
  .strict();
export type LittlewildExport = z.infer<typeof LittlewildExportSchema>;
export type SceneBundle = z.infer<typeof SceneBundleSchema>;
export type ProjectDocument = z.infer<typeof ProjectSchema>;

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
