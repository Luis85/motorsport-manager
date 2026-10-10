import path from 'node:path';
import {
  fail,
  parse,
  exportScene,
  validateExport,
  writeLittlewildAsset,
  modelDependencies,
  exportFormats,
  LittlewildAssetSchema,
  type ExportFormat,
} from '../kernel/index.js';
import {
  type EditorDocument,
  libraryOf,
  modelTarget,
  withoutRevision,
} from '../application/document.js';
import { atomicWrite, writeJson } from './files.js';
import { historyDirectory, type LoadedDocument } from './store.js';

export const documentExportFormats = [
  ...exportFormats,
  'model',
  'model-bundle',
  'littlewild',
] as const;
export type DocumentExportFormat = (typeof documentExportFormats)[number];

export interface LittlewildOptions {
  family: 'items' | 'buildings' | 'creatures' | 'pets';
  variant: string;
  name?: string;
  materials?: unknown;
  check?: boolean;
  dryRun?: boolean;
}
export interface ExportRequest {
  format: DocumentExportFormat;
  out: string;
  validate?: boolean;
  parameters?: Record<string, number>;
  littlewild?: LittlewildOptions;
}

/** The portable recipe Scene Forge `model import` accepts; the editor revision is removed. */
export function portableRecipe(document: EditorDocument, format: 'model' | 'model-bundle') {
  const model = withoutRevision(document.model);
  if (format === 'model') {
    if (Object.keys(modelDependencies(libraryOf(document), model.id)).length > 1)
      fail('DOCUMENT_KIND', `Model ${model.id} nests other models. Export --format model-bundle.`);
    return model;
  }
  return {
    schemaVersion: 1,
    kind: 'model-bundle',
    entry: model.id,
    models: modelDependencies({ ...libraryOf(document), [model.id]: model }, model.id),
  };
}

function refuseSelfOverwrite(loaded: LoadedDocument, out: string) {
  const history = historyDirectory(loaded.path);
  if (
    out === loaded.path ||
    out === `${loaded.path}.lock` ||
    out === history ||
    out.startsWith(history + path.sep)
  )
    fail('INVALID_PATH', 'Export cannot replace the document or its lock and history files.');
}

/** Write one deliverable. Geometry formats compile the model exactly as Scene Forge does. */
export async function exportDocument(loaded: LoadedDocument, request: ExportRequest) {
  const { document } = loaded;
  const out = path.resolve(request.out);
  refuseSelfOverwrite(loaded, out);
  if (request.validate && request.format !== 'glb' && request.format !== 'gltf')
    fail('INVALID_OPTION', '--validate applies to glb and gltf exports.');
  if (request.littlewild && request.format !== 'littlewild')
    fail('INVALID_OPTION', 'Littlewild options apply to --format littlewild only.');
  const source = { sourceStateHash: loaded.stateHash, revision: loaded.revision };
  if (request.format === 'model' || request.format === 'model-bundle') {
    if (request.parameters)
      fail('INVALID_OPTION', 'Recipes stay parametric; --parameters applies to rendered formats.');
    const recipe = portableRecipe(document, request.format);
    await writeJson(out, recipe);
    return {
      path: out,
      format: request.format,
      id: document.model.id,
      models: 'models' in recipe ? Object.keys(recipe.models) : [document.model.id],
      ...source,
    };
  }
  if (request.format === 'littlewild') {
    const options = request.littlewild!;
    const asset = parse(LittlewildAssetSchema, {
      id: path.basename(path.dirname(out)),
      family: options.family,
      name: options.name ?? document.model.name,
      models: {
        [options.variant]: {
          model: document.model.id,
          parameters: request.parameters ?? {},
          materials: options.materials ?? {},
        },
      },
    });
    const result = await writeLittlewildAsset(asset, libraryOf(document), out, {
      dryRun: options.dryRun,
      check: options.check,
    });
    if (options.check && result.changed)
      fail('LITTLEWILD_STALE', `${out} differs from model ${document.model.id}.`, result);
    return { ...result, format: 'littlewild', ...source };
  }
  const format: ExportFormat = request.format;
  const result = await exportScene(
    modelTarget(document, request.parameters),
    libraryOf(document),
    format,
  );
  const validation = request.validate ? await validateExport(result.data, format) : undefined;
  if (validation && validation.numErrors)
    fail(
      'EXPORT_INVALID',
      'Khronos validation rejected the export; no output was written.',
      validation,
    );
  await atomicWrite(out, result.data);
  return {
    path: out,
    format,
    bytes: Buffer.byteLength(result.data),
    stats: result.stats,
    warnings: result.warnings,
    ...(validation ? { validation } : {}),
    ...source,
  };
}
