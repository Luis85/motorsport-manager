// Littlewild export manifest contracts: engine families, asset identifiers and the
// model variants each asset projects into the Wildlands engine.
import { z } from 'zod';
import { Id, NumberValue } from './schema-values.js';
import { MaterialSchema } from './schema-content.js';

/** Littlewild engine families and the asset category each one projects. */
export const littlewildFamilies = {
  items: 'item',
  buildings: 'building',
  creatures: 'actor',
  pets: 'pet',
} as const;
export const LittlewildId = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,60}$/);
const LittlewildVariantSchema = z
  .object({
    model: Id,
    parameters: z.record(Id, NumberValue).default({}),
    /** Replace a model material with an inline specification for this variant. */
    materials: z.record(Id, MaterialSchema).default({}),
  })
  .strict();
export const LittlewildAssetSchema = z
  .object({
    id: LittlewildId,
    family: z.enum(['items', 'buildings', 'creatures', 'pets']),
    name: z.string().min(1).max(120),
    models: z.record(LittlewildId, LittlewildVariantSchema).refine((v) => Object.keys(v).length, {
      message: 'At least one Littlewild model variant is required.',
    }),
    metadata: z.record(z.string().max(64), z.union([z.number(), z.string().max(120)])).default({}),
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
export type LittlewildAsset = z.infer<typeof LittlewildAssetSchema>;
export type LittlewildExport = z.infer<typeof LittlewildExportSchema>;
