import { fail, littlewildImportPlan } from '../kernel.js';
import { importModel } from './project.js';
import type { EditOptions } from './project.js';

/**
 * Registers each Littlewild variant as a Scene Forge model through the guarded model import.
 * `input` is the parsed JSON of `file`, which names the source in messages.
 */
export async function importLittlewildDefinition(
  project: string,
  file: string,
  input: unknown,
  options: EditOptions & { prefix?: string; replace?: boolean },
) {
  const record =
    input && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const isPackage = record.format === 'littlewild-creature-package';
  if (isPackage && record.schemaVersion !== 1)
    fail('LITTLEWILD_IMPORT', 'Expected a version 1 littlewild-creature-package.');
  const visual = isPackage
    ? record.appearanceManifest
    : record.format === 'littlewild-definition'
      ? record.visual
      : record;
  if (!visual || typeof visual !== 'object' || Array.isArray(visual))
    fail('LITTLEWILD_IMPORT', `${file} has no visual facet to import.`);
  const { models, variantModels } = littlewildImportPlan(
    visual as Record<string, unknown>,
    options.prefix,
  );
  const entry = Object.keys(models)[0];
  const result = await importModel(
    project,
    { schemaVersion: 1, kind: 'model-bundle', entry, models },
    options.replace,
    options,
  );
  return {
    ...result,
    source: file,
    sourceFormat: record.format,
    importedFacet: 'visual',
    variants: Object.keys(models),
    variantModels,
    ...(isPackage
      ? {
          warnings: [
            'Only appearance models are imported. Gameplay, companion state, behavior mappings and rig bindings remain in the source creature package.',
          ],
        }
      : {}),
  };
}
