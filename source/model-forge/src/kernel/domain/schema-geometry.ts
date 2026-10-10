import { z } from 'zod';
import { Id, Scalar, Vec2, Vec3, Transform, Color } from './schema-values.js';

const segments = z.number().int().min(3).max(128);
/** Vertices per axis of a heightfield grid: at most 256 x 256 (130,050 triangles). */
export const HEIGHTFIELD_MAX_RESOLUTION = 256;
const gridAxis = z.number().int().min(2).max(HEIGHTFIELD_MAX_RESOLUTION);
export const HeightfieldNoiseSchema = z.strictObject({
  kind: z.enum(['value', 'ridged', 'billow']).default('value'),
  octaves: z.number().int().min(1).max(8).default(4),
  frequency: z.number().min(0.1).max(64).default(3),
  lacunarity: z.number().min(1).max(4).default(2),
  gain: z.number().min(0).max(1).default(0.5),
});
/**
 * Deterministic terrain: fBm noise on an integer lattice (+ - * / only), sampled on a
 * resolution[0] x resolution[1] vertex grid centered on the origin, from y = 0 up to amplitude.
 */
export const HeightfieldGeometrySchema = z.strictObject({
  type: z.literal('heightfield'),
  size: Vec2,
  amplitude: Scalar,
  resolution: z.tuple([gridAxis, gridAxis]).default([64, 64]),
  seed: z.number().int().min(0).max(4294967295).default(1),
  noise: HeightfieldNoiseSchema.default({
    kind: 'value',
    octaves: 4,
    frequency: 3,
    lacunarity: 2,
    gain: 0.5,
  }),
  falloff: z.enum(['none', 'island', 'basin']).default('none'),
  terrace: z.number().int().min(0).max(32).default(0),
  /** Vertex colors by normalized height (0..1 of amplitude); the first band at or above wins. */
  bands: z
    .array(z.strictObject({ below: z.number().min(0).max(1), color: Color }))
    .min(1)
    .max(8)
    .optional(),
});
export const GeometrySchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('box'), size: Vec3 }),
  z.strictObject({ type: z.literal('sphere'), radius: Scalar, segments: segments.optional() }),
  z.strictObject({
    type: z.literal('organic'),
    size: Vec3,
    roundness: Scalar.default(1),
    taper: Scalar.default(0),
    bend: Scalar.default(0),
    segments: z.number().int().min(12).max(96).default(32),
    profile: z
      .array(
        z.strictObject({
          at: Scalar,
          width: Scalar,
          depth: Scalar,
          offset: Vec2.default([0, 0]),
        }),
      )
      .min(2)
      .max(12)
      .optional(),
  }),
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
  HeightfieldGeometrySchema,
]);

export type Geometry = z.infer<typeof GeometrySchema>;
export type HeightfieldGeometry = z.infer<typeof HeightfieldGeometrySchema>;
