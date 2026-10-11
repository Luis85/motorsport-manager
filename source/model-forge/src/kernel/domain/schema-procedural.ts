import { z } from 'zod';
import { Id, NumberValue } from './schema-values.js';

/**
 * Procedural placement contracts. Coordinates are [x, z] meters in the frame of the
 * scatter group's parent (the document root when no parent is named). Every list and
 * count is bounded; a recipe is plain data, never code.
 */
export const PROCEDURAL_MAX_PLACEMENTS = 2000;
/** Candidate points one distribution may generate before filtering (PROCEDURAL_BUDGET). */
export const PROCEDURAL_MAX_CANDIDATES = 20000;
const Point = z.tuple([NumberValue, NumberValue]);
const positive = z.number().finite().positive().max(1e6);
const range = (min: number, max: number) =>
  z
    .tuple([z.number().min(min).max(max), z.number().min(min).max(max)])
    .refine(([low, high]) => low <= high, 'Range minimum must not exceed its maximum.');

export const AreaSchema = z.discriminatedUnion('type', [
  z
    .strictObject({ type: z.literal('rect'), min: Point, max: Point })
    .refine(
      (area) => area.min[0] < area.max[0] && area.min[1] < area.max[1],
      'rect min must be below max on both axes.',
    ),
  z.strictObject({ type: z.literal('circle'), center: Point, radius: positive }),
  z.strictObject({ type: z.literal('polygon'), points: z.array(Point).min(3).max(256) }),
  z.strictObject({
    type: z.literal('path'),
    points: z.array(Point).min(2).max(256),
    width: positive,
  }),
]);
export type Area = z.infer<typeof AreaSchema>;

export const DistributionSchema = z.discriminatedUnion('type', [
  /** Blue-noise points no closer than minDistance (Bridson, deterministic). */
  z.strictObject({ type: z.literal('poisson'), minDistance: positive }),
  /** A centered grid with step spacing; jitter moves each point up to jitter * step / 2. */
  z.strictObject({
    type: z.literal('grid'),
    step: positive,
    jitter: z.number().min(0).max(1).default(0),
  }),
  /** Points every spacing meters along a polyline; orient yaw faces +Z along the path. */
  z.strictObject({
    type: z.literal('path'),
    points: z.array(Point).min(2).max(256),
    spacing: positive,
    orient: z.enum(['none', 'yaw']).default('yaw'),
  }),
  /** count uniformly random points inside the area. */
  z.strictObject({
    type: z.literal('random'),
    count: z.number().int().min(1).max(PROCEDURAL_MAX_PLACEMENTS),
  }),
]);
export type Distribution = z.infer<typeof DistributionSchema>;

export const ScatterItemSchema = z
  .strictObject({
    /** A registered model to instance. */
    model: Id.optional(),
    /** Or an existing mesh/model node of the document to copy (in-model scatter). */
    node: Id.optional(),
    weight: z.number().finite().positive().max(1e6).default(1),
    /** Per-instance model parameters drawn uniformly from [min, max]. */
    vary: z.record(Id, range(-1e6, 1e6)).default({}),
  })
  .refine((item) => (item.model === undefined) !== (item.node === undefined), {
    message: 'Each item names exactly one of model or node.',
  });
export type ScatterItem = z.infer<typeof ScatterItemSchema>;

export const GroundSchema = z.discriminatedUnion('mode', [
  /** Place each origin on a heightfield mesh node, sunk by sink; reject slopes above maxSlope. */
  z.strictObject({
    mode: z.literal('terrain'),
    node: Id,
    sink: z.number().min(-1e3).max(1e3).default(0),
    maxSlope: z.number().min(0).max(90).default(90),
  }),
  z.strictObject({ mode: z.literal('plane'), y: NumberValue.default(0) }),
  z.strictObject({ mode: z.literal('none') }),
]);

export const ScatterRecipeSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    kind: z.literal('scatter'),
    seed: z.number().int().min(0).max(4294967295).default(1),
    /** The group node that owns every placement; instances are `<group>-<n>`. */
    group: Id.refine((id) => id.length <= 56, 'Group IDs are at most 56 characters.'),
    parent: Id.optional(),
    /** Required except for path distributions, where it optionally clips the path. */
    area: AreaSchema.optional(),
    exclude: z.array(AreaSchema).max(64).default([]),
    avoidNodes: z
      .strictObject({
        ids: z.array(Id).min(1).max(256),
        margin: z.number().min(0).max(1e3).default(0),
      })
      .optional(),
    distribution: DistributionSchema,
    maxCount: z
      .number()
      .int()
      .min(1)
      .max(PROCEDURAL_MAX_PLACEMENTS)
      .default(PROCEDURAL_MAX_PLACEMENTS),
    items: z.array(ScatterItemSchema).min(1).max(32),
    /** Uniform scale drawn from [min, max]. */
    scale: range(0.001, 1000).default([1, 1]),
    rotation: z
      .strictObject({
        /** Degrees; defaults to [0, 360], or [0, 0] added to the path heading for orient yaw. */
        yaw: range(-3600, 3600).optional(),
        /** Degrees about X and Z, each drawn from this range. */
        tilt: range(-90, 90).default([0, 0]),
      })
      .default({ tilt: [0, 0] }),
    ground: GroundSchema.default({ mode: 'none' }),
  })
  .refine((recipe) => recipe.area !== undefined || recipe.distribution.type === 'path', {
    message: 'area is required unless the distribution is a path.',
    path: ['area'],
  });
export type ScatterRecipe = z.infer<typeof ScatterRecipeSchema>;
export type ScatterRecipeInput = z.input<typeof ScatterRecipeSchema>;
