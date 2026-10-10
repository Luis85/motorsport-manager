import path from 'node:path';
import { z } from 'zod';
import { fail, parse, Id, ModelSchema, type ModelLibrary } from '../kernel/index.js';
import {
  planImport,
  planProjectImport,
  type ImportOptions,
  type ImportPlan,
} from '../application/import.js';
import { validateEditorDocument } from '../application/document.js';
import { documentHeader } from '../application/inspect.js';
import { stemWarnings } from '../domain/document.js';
import { exists, inside, readJson } from './files.js';
import { checkNewDocument, createDocument, documentKindForPath } from './store.js';

/** The read-only slice of a Scene Forge `forge.project.json` that names model files. */
const SceneForgeManifest = z.looseObject({
  schemaVersion: z.literal(1),
  models: z.record(Id, z.string()),
});

/**
 * Read one model and its nested closure from a Scene Forge project without writing to it.
 * A project being written (its `.forge.lock` exists) is refused rather than read half-way.
 */
export async function readProjectModels(project: string, id: string): Promise<ModelLibrary> {
  const manifestFile = path.join(project, 'forge.project.json');
  if (!(await exists(manifestFile)))
    fail('PROJECT_NOT_FOUND', `${project} has no forge.project.json.`);
  if (await exists(path.join(project, '.forge.lock')))
    fail('PROJECT_LOCKED', `${project} is locked by a running Scene Forge command.`);
  const manifest = parse(SceneForgeManifest, await readJson(manifestFile));
  const library: ModelLibrary = {};
  const pending = [id];
  while (pending.length) {
    const next = pending.pop()!;
    if (Object.hasOwn(library, next)) continue;
    if (!Object.hasOwn(manifest.models, next))
      fail('NOT_FOUND', `Model ${next} is not registered in ${manifestFile}.`, {
        available: Object.keys(manifest.models),
      });
    const model = parse(ModelSchema, await readJson(await inside(project, manifest.models[next])));
    if (model.id !== next)
      fail('ID_MISMATCH', `Model file declares ${model.id}, but is registered as ${next}.`);
    library[next] = model;
    for (const node of model.nodes) if (node.type === 'model') pending.push(node.model);
  }
  return library;
}

export interface ImportRequest extends ImportOptions {
  from?: string;
  project?: string;
  id?: string;
  out: string;
  dryRun?: boolean;
}
/** Create a new document from a file or a Scene Forge project model. Never overwrites. */
export async function importDocument(request: ImportRequest) {
  if (!!request.from === !!request.project)
    fail(
      'INVALID_OPTION',
      'Supply exactly one of --from <file> or --project <directory> --id <model>.',
    );
  const kind = documentKindForPath(request.out);
  let plan: ImportPlan;
  if (request.project) {
    if (!request.id) fail('INVALID_OPTION', '--project requires --id <model>.');
    if (request.entry || request.variant || request.prefix)
      fail('INVALID_OPTION', '--entry, --variant and --prefix do not apply to --project.');
    const library = await readProjectModels(request.project, request.id);
    plan = planProjectImport(library, request.id, kind);
  } else {
    if (request.id) fail('INVALID_OPTION', '--id applies to --project; use --entry for bundles.');
    plan = planImport(await readJson(request.from!), kind, request);
  }
  const { document, ...planned } = plan;
  const warnings = [...(planned.warnings ?? []), ...stemWarnings(request.out, document.model.id)];
  const report = { ...planned, ...(warnings.length ? { warnings } : {}) };
  if (request.dryRun) {
    // The same path checks as a real import: kind, project, history and existing files.
    await checkNewDocument(request.out, kind);
    // The same shape a write returns: the new document's revision, stateHash and statistics.
    return {
      path: request.out,
      ...documentHeader(document),
      stats: validateEditorDocument(document).stats,
      dryRun: true,
      dependencies: Object.keys(document.dependencies),
      source: request.from ?? request.project,
      ...report,
    };
  }
  const { warnings: _created, ...created } = await createDocument(request.out, document);
  return {
    ...created,
    dryRun: false,
    dependencies: Object.keys(document.dependencies),
    source: request.from ?? request.project,
    ...report,
  };
}
