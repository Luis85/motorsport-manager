// Material contracts: physically based properties (including sheen, clearcoat and depth
// writes) and the seeded fur/cloth/leather surface a material may carry.
import { z } from 'zod';
import { Color } from './schema-values.js';

export const SurfaceSchema = z.strictObject({
  kind: z.enum(['fur', 'cloth', 'leather']),
  version: z.union([z.literal(1), z.literal(2)]).optional(),
  seed: z.number().int().min(0).max(65535),
  scale: z.number().min(1).max(16),
  strength: z.number().min(0).max(1),
});
export type SurfaceSpec = z.infer<typeof SurfaceSchema>;
/** Offline PBR detail on existing UVs; no paths, image URLs or executable shaders. */
export const FinishSchema = z.strictObject({
  version: z.literal(1),
  kind: z.enum(['painted-metal', 'bare-metal', 'rubber']),
  seed: z.number().int().min(0).max(65535),
  scale: z.number().min(1).max(16),
  wear: z.number().min(0).max(1),
  palette: z.array(Color).min(1).max(4).optional(),
});
export type FinishSpec = z.infer<typeof FinishSchema>;
export const MaterialSchema = z
  .object({
    color: Color,
    metalness: z.number().min(0).max(1).default(0),
    roughness: z.number().min(0).max(1).default(0.65),
    surface: SurfaceSchema.optional(),
    finish: FinishSchema.optional(),
    sheen: z.number().min(0).max(1).optional(),
    sheenColor: Color.optional(),
    sheenRoughness: z.number().min(0).max(1).optional(),
    clearcoat: z.number().min(0).max(1).optional(),
    clearcoatRoughness: z.number().min(0).max(1).optional(),
    emissive: Color.optional(),
    emissiveIntensity: z.number().min(0).max(20).optional(),
    opacity: z.number().min(0).max(1).default(1),
    depthWrite: z.boolean().optional(),
    doubleSided: z.boolean().default(false),
    flatShading: z.boolean().default(false),
    shading: z.enum(['standard', 'unlit']).optional(),
    /** Multiply the base color by the geometry's vertex colors (heightfield bands). */
    vertexColors: z.boolean().optional(),
  })
  .strict();
export type MaterialSpec = z.infer<typeof MaterialSchema>;
