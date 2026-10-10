import { z } from 'zod';
import { Id, NumberValue, Color } from './schema-values.js';
import { GeometrySchema } from './schema-geometry.js';
import { MaterialSchema } from './schema-material.js';
import { NodeSchema } from './schema-nodes.js';

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
    presentation: z.enum(['inspection', 'portrait']).optional(),
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
    /** Optional editor document revision. Absent means 0 and keeps legacy bytes and hashes. */
    revision: z.number().int().nonnegative().optional(),
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
export const ModelBundleSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal('model-bundle'),
    entry: Id,
    models: z.record(Id, ModelSchema),
  })
  .strict();
export type SceneDocument = z.infer<typeof SceneSchema>;
export type ModelDocument = z.infer<typeof ModelSchema>;
export type ModelBundle = z.infer<typeof ModelBundleSchema>;
export type ModelLibrary = Record<string, ModelDocument>;
