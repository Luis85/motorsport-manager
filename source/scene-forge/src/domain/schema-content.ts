// Scene content contracts: geometry definitions, materials, repetition patterns,
// model rigs and the scene node union (light, group, mesh and model instance).
// Scenes and models share these; `nodeBase` is also reused by composition entries.
import { z } from 'zod';
import { Id, NumberValue, Scalar, Vec3, Vec2, Color, Transform } from './schema-values.js';

const segments = z.number().int().min(3).max(128);
export const GeometrySchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('box'), size: Vec3 }),
  z.strictObject({ type: z.literal('sphere'), radius: Scalar, segments: segments.optional() }),
  z.strictObject({
    type: z.literal('cylinder'),
    radiusTop: Scalar,
    radiusBottom: Scalar,
    height: Scalar,
    segments: segments.optional(),
    openEnded: z.boolean().optional(),
  }),
  z.strictObject({
    type: z.literal('cone'),
    radius: Scalar,
    height: Scalar,
    segments: segments.optional(),
  }),
  z.strictObject({
    type: z.literal('torus'),
    radius: Scalar,
    tube: Scalar,
    segments: segments.optional(),
  }),
  z.strictObject({
    type: z.literal('capsule'),
    radius: Scalar,
    length: Scalar,
    segments: segments.optional(),
  }),
  z.strictObject({ type: z.literal('plane'), size: Vec2 }),
  z.strictObject({
    type: z.literal('tube'),
    points: z.array(Vec3).min(2).max(256),
    radius: Scalar,
    tubularSegments: z.number().int().min(4).max(512).default(64),
    radialSegments: z.number().int().min(3).max(32).default(8),
    closed: z.boolean().default(false),
    capEnds: z.boolean().default(true),
  }),
  z.strictObject({
    type: z.literal('lathe'),
    points: z.array(Vec2).min(2).max(512),
    segments: segments.optional(),
  }),
  z.strictObject({
    type: z.literal('extrude'),
    points: z.array(Vec2).min(3).max(512),
    holes: z.array(z.array(Vec2).min(3).max(512)).max(32).optional(),
    depth: Scalar,
    bevel: Scalar.optional(),
    bevelSegments: segments.optional(),
  }),
  z.strictObject({
    type: z.literal('mesh'),
    positions: z.array(Vec3).min(3).max(100000),
    indices: z.array(z.number().int().nonnegative()).min(3).max(600000),
    normals: z.array(Vec3).min(3).max(100000).optional(),
    uvs: z.array(Vec2).min(3).max(100000).optional(),
  }),
  z.strictObject({
    type: z.literal('boolean'),
    operation: z.enum(['union', 'subtract', 'intersect']),
    left: Id,
    right: Id,
    leftTransform: Transform.optional(),
    rightTransform: Transform.optional(),
  }),
]);

export type Geometry = z.infer<typeof GeometrySchema>;

export const MaterialSchema = z
  .object({
    color: Color,
    metalness: z.number().min(0).max(1).default(0),
    roughness: z.number().min(0).max(1).default(0.65),
    emissive: Color.optional(),
    emissiveIntensity: z.number().min(0).max(20).optional(),
    opacity: z.number().min(0).max(1).default(1),
    doubleSided: z.boolean().default(false),
    flatShading: z.boolean().default(false),
    shading: z.enum(['standard', 'unlit']).optional(),
  })
  .strict();
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
export type NodeSpec = z.infer<typeof NodeSchema>;
export type MaterialSpec = z.infer<typeof MaterialSchema>;
