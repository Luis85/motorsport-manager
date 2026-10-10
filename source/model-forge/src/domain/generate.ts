import { z } from 'zod';
import { Id, Color, NumberValue, SEED_MAX } from '../kernel/index.js';

/** Most documents one `generate --count` or `variants` call writes. */
export const MAX_GENERATED_DOCUMENTS = 64;
/** Most frames one review session renders (one per document in a lineup). */
export const MAX_REVIEW_FRAMES = 36;

const seed = z.number().int().min(0).max(SEED_MAX);
/**
 * A replayable generator invocation: `generate <generator> --file <recipe>` rebuilds the same
 * document bytes with the same generator version. Written beside every generated document as
 * `<id>.generate.json` with every parameter resolved.
 */
export const GeneratorRecipeSchema = z.strictObject({
  schemaVersion: z.literal(1),
  kind: z.literal('generator-recipe'),
  generator: Id,
  /** The generator version that wrote the recipe; another version may give other bytes. */
  version: z.number().int().positive().optional(),
  seed: seed.default(1),
  preset: Id.optional(),
  /** Generator parameter values over the preset (see generate show <generator>). */
  parameters: z.record(Id, z.unknown()).default({}),
  id: Id.optional(),
  name: z.string().min(1).max(120).optional(),
});
export type GeneratorRecipe = z.infer<typeof GeneratorRecipeSchema>;

const range = z.tuple([NumberValue, NumberValue]);
/** The manifest `variants` writes beside the variant documents. */
export const ModelVariantsSchema = z.strictObject({
  schemaVersion: z.literal(1),
  kind: z.literal('model-variants'),
  source: z.strictObject({
    id: Id,
    revision: z.number().int().nonnegative(),
    stateHash: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  seed,
  count: z.number().int().min(1).max(MAX_GENERATED_DOCUMENTS),
  /** Parameter ranges sampled uniformly (integer parameters inclusively). */
  vary: z.record(Id, range),
  /** Material color choices picked uniformly per variant. */
  materials: z.record(Id, z.array(Color).min(1).max(32)),
  /** sha256 of the canonical {source stateHash, seed, count, vary, materials}. */
  recipeHash: z.string().regex(/^[a-f0-9]{64}$/),
  variants: z.array(
    z.strictObject({
      id: Id,
      file: z.string(),
      parameters: z.record(Id, NumberValue),
      materials: z.record(Id, Color),
      stateHash: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  ),
});
export type ModelVariants = z.infer<typeof ModelVariantsSchema>;
