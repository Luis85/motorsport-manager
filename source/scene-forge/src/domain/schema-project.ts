// Scene Forge's own document contracts, built on the model recipe kernel: the project
// index, composition files that upsert groups and model instances (sharing the kernel's
// revision/state guards with batches), portable scene bundles that carry a scene with its
// model dependency closure, and the Littlewild export manifest. Scene, model, content,
// operation, review and procedural contracts are owned by the kernel's schema modules.
import { z } from 'zod';
import {
  Id,
  Scalar,
  nodeBase,
  guards,
  SceneSchema,
  ModelSchema,
  LittlewildAssetSchema,
} from '../kernel.js';

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
