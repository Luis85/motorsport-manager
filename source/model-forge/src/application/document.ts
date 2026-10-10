import {
  fail,
  parse,
  canonical,
  ForgeError,
  ModelSchema,
  ModelBundleSchema,
  SceneSchema,
  modelStateHash,
  modelDependencies,
  modelParameters,
  authoringTarget,
  compileScene,
  type ModelDocument,
  type ModelLibrary,
  type SceneDocument,
} from '../kernel/index.js';
import type { DocumentKind } from '../domain/document.js';

/** The one editable model of a document plus the frozen models it may instantiate. */
export interface EditorDocument {
  kind: DocumentKind;
  model: ModelDocument;
  dependencies: ModelLibrary;
}

const plain = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** Strip the editor revision from a model: dependencies and portable outputs carry none. */
export function withoutRevision(model: ModelDocument): ModelDocument {
  const copy = structuredClone(model);
  delete copy.revision;
  return copy;
}

/** Parse a document file's JSON. Other kinds are rejected with an import hint. */
export function parseDocument(input: unknown): EditorDocument {
  const kind = plain(input) ? input.kind : undefined;
  if (kind === 'model') return { kind, model: parse(ModelSchema, input), dependencies: {} };
  if (kind !== 'model-bundle')
    fail(
      'DOCUMENT_KIND',
      `Expected a model or model-bundle document, got ${kind === undefined ? 'no kind' : `kind ${String(kind)}`}.`,
      { hint: 'Convert other sources with import --from <file> --out <new document>.' },
    );
  const bundle = parse(ModelBundleSchema, input);
  for (const [id, model] of Object.entries(bundle.models))
    if (model.id !== id) fail('ID_MISMATCH', `Model ${model.id} is keyed as ${id}.`);
  if (!Object.hasOwn(bundle.models, bundle.entry))
    fail('REFERENCE_MISSING', `Bundle entry ${bundle.entry} is not in models.`);
  const dependencies = Object.fromEntries(
    Object.entries(bundle.models).filter(([id]) => id !== bundle.entry),
  );
  return { kind: 'model-bundle', model: bundle.models[bundle.entry], dependencies };
}

/** The exact JSON written for a document: the model, or a bundle with the entry first. */
export function serializeDocument(document: EditorDocument) {
  if (document.kind === 'model') return document.model;
  return {
    schemaVersion: 1 as const,
    kind: 'model-bundle' as const,
    entry: document.model.id,
    models: { [document.model.id]: document.model, ...document.dependencies },
  };
}

export const revisionOf = (document: EditorDocument) => document.model.revision ?? 0;
export const libraryOf = (document: EditorDocument): ModelLibrary => ({
  ...document.dependencies,
  [document.model.id]: document.model,
});
export const documentStateHash = (document: EditorDocument) =>
  modelStateHash(document.model, document.dependencies);
/** Content identity ignoring the revision: two documents with equal keys are no-op edits. */
export const contentKey = (document: EditorDocument) =>
  canonical({ model: withoutRevision(document.model), dependencies: document.dependencies });

/** Parameter defaults, or validated overrides, as the numeric values a scene resolves. */
export function parameterValues(model: ModelDocument, overrides?: Record<string, number>) {
  return overrides
    ? modelParameters(model, overrides)
    : Object.fromEntries(Object.entries(model.parameters).map(([id, p]) => [id, p.default]));
}

/**
 * Stage the model's own content as a scene so the kernel's scene operations, selectors and
 * spatial queries apply unchanged. Node names resolve as `<model id>/<node id>`.
 */
export function stageScene(model: ModelDocument, overrides?: Record<string, number>) {
  return parse(SceneSchema, {
    schemaVersion: 1,
    kind: 'scene',
    id: model.id,
    name: model.name,
    parameters: parameterValues(model, overrides),
    geometries: model.geometries,
    materials: model.materials,
    nodes: model.nodes,
  });
}
/** Map staged content back, retaining the model's metadata, parameters and key order. */
export function unstage(model: ModelDocument, scene: SceneDocument): ModelDocument {
  return parse(ModelSchema, {
    ...model,
    geometries: scene.geometries,
    materials: scene.materials,
    nodes: scene.nodes,
  });
}

/**
 * The render/export target: one instance of the model, exactly as Scene Forge builds
 * `--model <id>` targets, so exports are byte-identical.
 */
export function modelTarget(document: EditorDocument, parameters?: Record<string, number>) {
  const host = parse(SceneSchema, {
    schemaVersion: 1,
    kind: 'scene',
    id: 'model',
    name: document.model.name,
  });
  return authoringTarget(host, libraryOf(document), { model: document.model.id, parameters });
}

/** Validate references, dependency closure, parameters and generated geometry. */
export function validateEditorDocument(document: EditorDocument) {
  const { model, dependencies } = document;
  for (const [id, dependency] of Object.entries(dependencies)) {
    if (dependency.id !== id) fail('ID_MISMATCH', `Dependency ${dependency.id} is keyed as ${id}.`);
    if (id === model.id)
      fail('DUPLICATE_ID', `Dependency ${id} has the same ID as the editable model.`);
  }
  const closure = modelDependencies(libraryOf(document), model.id);
  const used = Object.keys(closure).filter((id) => id !== model.id);
  if (document.kind === 'model' && used.length)
    fail(
      'DOCUMENT_KIND',
      `Model ${model.id} instantiates ${used.join(', ')}; nested models need a model-bundle document.`,
      { dependencies: used },
    );
  modelParameters(model);
  const built = compileScene(modelTarget(document), libraryOf(document));
  try {
    const unused = Object.keys(dependencies).filter((id) => !Object.hasOwn(closure, id));
    const warnings = [
      ...built.stats.warnings,
      ...(unused.length
        ? [`Unused dependencies are kept but not exported: ${unused.join(', ')}.`]
        : []),
    ];
    return {
      stats: { ...built.stats, warnings },
      dependencies: used,
      unusedDependencies: unused,
    };
  } finally {
    built.dispose();
  }
}

/** Re-throw a kernel failure for one batch entry with its zero-based operation index. */
export function atOperation(error: unknown, index: number, op: string): never {
  if (!(error instanceof ForgeError)) throw error;
  const details = plain(error.details) && 'operationIndex' in error.details ? error.details : null;
  throw new ForgeError(error.code, error.message, {
    operationIndex: index,
    operation: op,
    ...(details
      ? { cause: details.cause }
      : error.details !== undefined
        ? { cause: error.details }
        : {}),
  });
}
