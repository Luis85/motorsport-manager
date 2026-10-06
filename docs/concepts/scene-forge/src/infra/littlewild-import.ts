import { fail } from '../domain/errors.js';
import { littlewildModels } from '../application/littlewild-import.js';
import { importModel } from './project.js';
import { readJson } from './files.js';

/** Registers each Littlewild variant as a Scene Forge model through the guarded model import. */
export async function importLittlewildDefinition(
  project: string,
  file: string,
  options: { prefix?: string; dryRun?: boolean; replace?: boolean },
) {
  const input = await readJson(file);
  const record =
    input && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const visual = record.format === 'littlewild-definition' ? record.visual : record;
  if (!visual || typeof visual !== 'object' || Array.isArray(visual))
    fail('LITTLEWILD_IMPORT', `${file} has no visual facet to import.`);
  const models = littlewildModels(visual as Record<string, unknown>, options.prefix);
  const entry = Object.keys(models)[0];
  const result = await importModel(
    project,
    { schemaVersion: 1, kind: 'model-bundle', entry, models },
    options.replace,
    { dryRun: options.dryRun },
  );
  return { ...result, source: file, variants: Object.keys(models) };
}
