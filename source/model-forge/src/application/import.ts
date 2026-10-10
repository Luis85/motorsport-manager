import {
  fail,
  parse,
  ModelSchema,
  ModelBundleSchema,
  modelDependencies,
  littlewildImportPlan,
  type ModelDocument,
  type ModelLibrary,
} from '../kernel/index.js';
import { documentSuffixes, type DocumentKind } from '../domain/document.js';
import { type EditorDocument, validateEditorDocument, withoutRevision } from './document.js';

type Plain = Record<string, unknown>;
const plain = (value: unknown): value is Plain =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/**
 * A new document for `id` and exactly its dependency closure, at revision 0 (no field).
 * `kind` comes from the output path suffix; a nested model needs a bundle.
 */
export function documentFor(library: ModelLibrary, id: string, kind: DocumentKind): EditorDocument {
  if (!Object.hasOwn(library, id))
    fail('NOT_FOUND', `Model ${id} is not in the source.`, { available: Object.keys(library) });
  const closure = modelDependencies(library, id);
  const dependencies = Object.fromEntries(
    Object.entries(closure)
      .filter(([key]) => key !== id)
      .map(([key, model]) => [key, withoutRevision(model)]),
  );
  if (kind === 'model' && Object.keys(dependencies).length)
    fail(
      'DOCUMENT_KIND',
      `Model ${id} nests ${Object.keys(dependencies).join(', ')}; write it to <id>${documentSuffixes['model-bundle']}.`,
      {
        dependencies: Object.keys(dependencies),
        suggestedPath: `${id}${documentSuffixes['model-bundle']}`,
      },
    );
  // A new document has no revision field (revision 0) until its first committed edit.
  const document: EditorDocument = { kind, model: withoutRevision(library[id]), dependencies };
  validateEditorDocument(document);
  return document;
}

/** Recognized source files: recipe documents and the three Littlewild visual carriers. */
export type SourceFormat =
  | 'model'
  | 'model-bundle'
  | 'littlewild-definition'
  | 'littlewild-creature-package'
  | 'littlewild-3d-asset';
export function sourceFormat(input: unknown): SourceFormat {
  if (plain(input)) {
    if (input.kind === 'model' || input.kind === 'model-bundle') return input.kind;
    if (
      input.format === 'littlewild-definition' ||
      input.format === 'littlewild-creature-package' ||
      input.format === 'littlewild-3d-asset'
    )
      return input.format;
  }
  return fail(
    'DOCUMENT_KIND',
    'Import accepts model, model-bundle, littlewild-definition, littlewild-creature-package or littlewild-3d-asset JSON.',
    {
      received: plain(input) ? (input.kind ?? input.format ?? null) : typeof input,
    },
  );
}

/** What an import produces besides the document; Littlewild fields only for Littlewild sources. */
export interface ImportPlan {
  sourceFormat: SourceFormat | 'scene-forge-project';
  document: EditorDocument;
  /** Bundle models outside the selected entry's dependency closure. */
  droppedModels?: string[];
  variant?: string;
  /** Every source variant name mapped to the model ID it imports as. */
  variantModels?: Record<string, string>;
  importedFacet?: 'visual';
  warnings?: string[];
}
export interface ImportOptions {
  entry?: string;
  variant?: string;
  prefix?: string;
}
/** Plan a document from a recipe file or a Littlewild visual. Pure; the store writes it. */
export function planImport(
  input: unknown,
  kind: DocumentKind,
  options: ImportOptions = {},
): ImportPlan {
  const format = sourceFormat(input);
  if (format === 'model' || format === 'model-bundle') {
    if (options.variant || options.prefix)
      fail('INVALID_OPTION', '--variant and --prefix apply to Littlewild sources only.');
    if (format === 'model') {
      if (options.entry) fail('INVALID_OPTION', '--entry applies to model-bundle sources only.');
      const model: ModelDocument = parse(ModelSchema, input);
      return { sourceFormat: format, document: documentFor({ [model.id]: model }, model.id, kind) };
    }
    const bundle = parse(ModelBundleSchema, input);
    const entry = options.entry ?? bundle.entry;
    const document = documentFor(bundle.models, entry, kind);
    const dropped = Object.keys(bundle.models).filter(
      (id) => id !== entry && !Object.hasOwn(document.dependencies, id),
    );
    return { sourceFormat: format, document, droppedModels: dropped };
  }
  if (options.entry) fail('INVALID_OPTION', '--entry applies to model-bundle sources only.');
  const record = input as Plain;
  if (format === 'littlewild-creature-package' && record.schemaVersion !== 1)
    fail('LITTLEWILD_IMPORT', 'Expected a version 1 littlewild-creature-package.');
  const visual =
    format === 'littlewild-creature-package'
      ? record.appearanceManifest
      : format === 'littlewild-definition'
        ? record.visual
        : record;
  if (!plain(visual)) fail('LITTLEWILD_IMPORT', 'The source has no visual facet to import.');
  const plan = littlewildImportPlan(visual, options.prefix);
  const variants = Object.keys(plan.variantModels);
  const variant = options.variant ?? variants[0];
  if (!Object.hasOwn(plan.variantModels, variant))
    fail('NOT_FOUND', `Variant ${variant} is not in the Littlewild source.`, {
      available: variants,
    });
  const library: ModelLibrary = Object.fromEntries(
    Object.entries(plan.models).map(([id, model]) => [id, parse(ModelSchema, model)]),
  );
  return {
    sourceFormat: format,
    document: documentFor(library, plan.variantModels[variant], kind),
    variant,
    variantModels: plan.variantModels,
    importedFacet: 'visual' as const,
    warnings: [
      ...(variants.length > 1
        ? [
            `One document holds one model: imported variant ${variant}. Import the others with --variant <name> into their own documents.`,
          ]
        : []),
      ...(format === 'littlewild-creature-package'
        ? [
            'Only appearance models are imported. Gameplay, companion state, behavior mappings and rig bindings remain in the source package.',
          ]
        : []),
    ],
  };
}

/** Build a document from a scene-forge project's model library (already read from disk). */
export function planProjectImport(
  library: ModelLibrary,
  id: string,
  kind: DocumentKind,
): ImportPlan {
  return { sourceFormat: 'scene-forge-project', document: documentFor(library, id, kind) };
}

/** A new, empty model document at revision 0 (no revision field). */
export function emptyDocument(
  kind: DocumentKind,
  metadata: { id: string; name: string; category?: string; description?: string },
): EditorDocument {
  const model = parse(ModelSchema, {
    schemaVersion: 1,
    kind: 'model',
    id: metadata.id,
    name: metadata.name,
    ...(metadata.category !== undefined ? { category: metadata.category } : {}),
    ...(metadata.description !== undefined ? { description: metadata.description } : {}),
  });
  return { kind, model, dependencies: {} };
}
