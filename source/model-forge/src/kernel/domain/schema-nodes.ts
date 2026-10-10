import { z } from 'zod';
import { Id, NumberValue, Scalar, Vec3, Color, Transform } from './schema-values.js';

export const PatternSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('path'),
    points: z.array(Vec3).min(1).max(256),
    orient: z.enum(['none', 'yaw']).default('none'),
  }),
  z.object({ type: z.literal('linear'), count: Scalar, step: Vec3 }).strict(),
  z
    .object({
      type: z.literal('radial'),
      count: Scalar,
      radius: Scalar,
      startAngle: Scalar.default(0),
      sweep: Scalar.default(360),
      orient: z.boolean().default(true),
    })
    .strict(),
  z
    .object({
      type: z.literal('grid'),
      counts: Vec3,
      step: Vec3,
      centered: z.boolean().default(false),
    })
    .strict(),
]);
const JointVector = z.tuple([NumberValue, NumberValue, NumberValue]);
export const RigSchema = z.strictObject({
  joints: z
    .array(
      z.strictObject({
        id: Id,
        parent: Id.optional(),
        position: JointVector,
        rotation: JointVector.default([0, 0, 0]),
      }),
    )
    .min(1)
    .max(64),
  binding: z.enum(['rigid', 'smooth']).default('rigid'),
  bindings: z.record(z.string().min(1).max(512), Id).default({}),
  pose: z.record(Id, JointVector).default({}),
  clips: z
    .array(
      z.strictObject({
        id: Id,
        duration: z.number().positive().max(600),
        tracks: z
          .array(
            z.strictObject({
              joint: Id,
              keyframes: z
                .array(
                  z.strictObject({
                    time: z.number().min(0).max(600),
                    rotation: JointVector,
                  }),
                )
                .min(2)
                .max(256),
            }),
          )
          .min(1)
          .max(64),
      }),
    )
    .max(16)
    .default([]),
});
export type RigSpec = z.infer<typeof RigSchema>;
export const nodeBase = {
  id: Id,
  name: z.string().max(120).optional(),
  parent: Id.optional(),
  transform: Transform.optional(),
  visible: z.boolean().default(true),
  tags: z.array(z.string().max(64)).max(32).default([]),
  pattern: PatternSchema.optional(),
};
export const NodeSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...nodeBase,
      type: z.literal('light'),
      light: z.enum(['point', 'spot', 'directional']),
      color: Color.default('#ffffff'),
      intensity: z.number().finite().min(0).max(10000).default(50),
      distance: z.number().finite().min(0).max(100000).default(0),
      angle: z.number().min(1).max(89).default(35),
      penumbra: z.number().min(0).max(1).default(0.25),
      castShadow: z.boolean().default(false),
    })
    .strict(),
  z.object({ ...nodeBase, type: z.literal('group') }).strict(),
  z.object({ ...nodeBase, type: z.literal('mesh'), geometry: Id, material: Id }).strict(),
  z
    .object({
      ...nodeBase,
      type: z.literal('model'),
      model: Id,
      rig: RigSchema.optional(),
      parameters: z.record(Id, Scalar).default({}),
      materialOverrides: z.record(Id, Id).default({}),
    })
    .strict(),
]);
export const NodePatchSchema = z
  .object({
    name: z.string().max(120).optional(),
    visible: z.boolean().optional(),
    tags: z.array(z.string().max(64)).max(32).optional(),
    transform: Transform.optional(),
    pattern: PatternSchema.nullable().optional(),
    rig: RigSchema.nullable().optional(),
    color: Color.optional(),
    intensity: z.number().finite().min(0).max(10000).optional(),
    distance: z.number().finite().min(0).max(100000).optional(),
    angle: z.number().min(1).max(89).optional(),
    penumbra: z.number().min(0).max(1).optional(),
    castShadow: z.boolean().optional(),
    parameters: z.record(Id, Scalar).optional(),
    materialOverrides: z.record(Id, Id).optional(),
  })
  .strict();
export const SelectorSchema = z
  .object({
    ids: z.array(Id).min(1).max(1000).optional(),
    tag: z.string().max(64).optional(),
    type: z.enum(['group', 'mesh', 'model', 'light']).optional(),
    model: Id.optional(),
    parent: Id.nullable().optional(),
  })
  .strict();
export type NodeSpec = z.infer<typeof NodeSchema>;
export type NodeSelector = z.infer<typeof SelectorSchema>;
