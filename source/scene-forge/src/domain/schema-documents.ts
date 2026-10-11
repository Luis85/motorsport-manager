// Persisted document contracts: scenes (with camera and environment), parametric
// models, the project index, and the portable model/scene bundles that carry a
// document together with its model dependency closure.
import { z } from 'zod';
import { Id, NumberValue, Color } from './schema-values.js';
import { GeometrySchema, MaterialSchema, NodeSchema } from './schema-content.js';

const content = {
  geometries: z.record(Id, GeometrySchema).default({}),
  materials: z.record(Id, MaterialSchema).default({}),
  nodes: z.array(NodeSchema).max(10000).default([]),
};
export const CameraSchema = z
  .object({
    position: z.tuple([NumberValue, NumberValue, NumberValue]),
    target: z.tuple([NumberValue, NumberValue, NumberValue]),
    fov: z.number().min(5).max(120).default(40),
  })
  .strict();
export const EnvironmentSchema = z
  .object({
    background: Color.default('#171d25'),
    exposure: z.number().min(0.1).max(4).optional(),
    toneMapping: z.enum(['filmic', 'neutral', 'linear']).optional(),
    ambient: z.number().min(0).max(5).default(1.8),
    keyIntensity: z.number().min(0).max(10).default(3.5),
    keyPosition: z.tuple([NumberValue, NumberValue, NumberValue]).default([5, 10, 7]),
  })
  .strict();
export const SceneSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal('scene'),
    id: Id,
    name: z.string().min(1).max(120),
    revision: z.number().int().nonnegative().default(0),
    units: z.literal('meters').default('meters'),
    parameters: z.record(Id, NumberValue).default({}),
    ...content,
    camera: CameraSchema.optional(),
    environment: EnvironmentSchema.default({
      background: '#171d25',
      ambient: 1.8,
      keyIntensity: 3.5,
      keyPosition: [5, 10, 7],
    }),
  })
  .strict();
export const ModelSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal('model'),
    id: Id,
    category: z.string().max(64).optional(),
    description: z.string().max(600).optional(),
    name: z.string().min(1).max(120),
    parameters: z
      .record(
        Id,
        z
          .object({
            default: NumberValue,
            min: NumberValue.optional(),
            max: NumberValue.optional(),
            description: z.string().max(300).optional(),
            integer: z.boolean().optional(),
          })
          .strict(),
      )
      .default({}),
    ...content,
  })
  .strict();
export const ProjectSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: z.string().min(1).max(120),
    activeScene: Id,
    scenes: z.record(Id, z.string()),
    models: z.record(Id, z.string()),
  })
  .strict();
export const ModelBundleSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal('model-bundle'),
    entry: Id,
    models: z.record(Id, ModelSchema),
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
export type SceneBundle = z.infer<typeof SceneBundleSchema>;
export type SceneDocument = z.infer<typeof SceneSchema>;
export type ModelDocument = z.infer<typeof ModelSchema>;
export type ProjectDocument = z.infer<typeof ProjectSchema>;
export type ModelLibrary = Record<string, ModelDocument>;
