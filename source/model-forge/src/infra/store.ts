import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fail, errorCode, ForgeError } from '../kernel/index.js';
import {
  kindForPath,
  documentSuffixes,
  stemWarnings,
  type DocumentKind,
} from '../domain/document.js';
import {
  type EditorDocument,
  contentKey,
  documentStateHash,
  parseDocument,
  revisionOf,
  serializeDocument,
  validateEditorDocument,
} from '../application/document.js';
import { checkGuards, prepareModelEdit, type EditOptions } from '../application/edit.js';
import { documentHeader } from '../application/inspect.js';
import type { ModelOperation } from '../domain/document.js';
import { exists, withFileLock, writeJson } from './files.js';
import { refuseProjectDocument, sideFilePath } from './paths.js';

/**
 * The document store: one JSON file per model, `<doc>.lock` held across read → prepare →
 * write, `<doc>.history/<revision>.json` holding every replaced version byte-for-byte, and
 * atomic replacement. Reads never lock: writers replace the file atomically.
 */
export interface LoadedDocument {
  path: string;
  document: EditorDocument;
  revision: number;
  stateHash: string;
  bytes: Buffer;
}
const maxBytes = 16 * 1024 * 1024;
export const historyDirectory = (file: string) => `${file}.history`;
export const historyFile = (file: string, revision: number) =>
  path.join(historyDirectory(file), `${revision}.json`);

/** The document kind a path declares; other file names are rejected. */
export function documentKindForPath(file: string): DocumentKind {
  const kind = kindForPath(file);
  if (!kind)
    fail(
      'DOCUMENT_KIND',
      `Document paths end with ${documentSuffixes.model} or ${documentSuffixes['model-bundle']}: ${file}`,
    );
  return kind;
}

async function readBounded(file: string, missing: string, message: string) {
  let bytes: Buffer;
  try {
    const stat = await fs.stat(file);
    if (stat.isDirectory())
      fail(missing, `${file} is a directory, not a JSON file.`, {
        path: file,
        hint: 'Pass the document file itself: <directory>/<id>.model.json or <id>.model-bundle.json.',
      });
    if (stat.size > maxBytes) fail('INPUT_TOO_LARGE', `Document exceeds 16 MiB: ${file}`);
    bytes = await fs.readFile(file);
  } catch (error) {
    if (errorCode(error) === 'ENOENT' || errorCode(error) === 'ENOTDIR')
      fail(missing, message, { path: file });
    throw error;
  }
  try {
    return { bytes, value: JSON.parse(bytes.toString('utf8')) as unknown };
  } catch {
    return fail('JSON_INVALID', `${file} is not valid JSON.`);
  }
}
function parseAt(file: string, value: unknown) {
  try {
    return parseDocument(value);
  } catch (error) {
    if (error instanceof ForgeError && error.code === 'SCHEMA_INVALID')
      fail(error.code, `${path.basename(file)}: ${error.message}`, error.details);
    throw error;
  }
}

export async function readDocument(file: string): Promise<LoadedDocument> {
  const declared = documentKindForPath(file);
  const { bytes, value } = await readBounded(
    file,
    'DOCUMENT_NOT_FOUND',
    `Model document ${file} does not exist.`,
  );
  const document = parseAt(file, value);
  if (document.kind !== declared)
    fail(
      'DOCUMENT_KIND',
      `${path.basename(file)} declares kind ${document.kind}, but its name says ${declared}.`,
    );
  return {
    path: file,
    document,
    revision: revisionOf(document),
    stateHash: documentStateHash(document),
    bytes,
  };
}

/**
 * Checks for a new document path, without side effects: the kind its suffix declares, no
 * Scene Forge project, no lock or history location, and neither the file nor an orphaned
 * history directory may exist.
 */
export async function checkNewDocument(file: string, kind: DocumentKind) {
  if (documentKindForPath(file) !== kind)
    fail('DOCUMENT_KIND', `A ${kind} document must be named <id>${documentSuffixes[kind]}.`);
  if (sideFilePath(file))
    fail('INVALID_PATH', `${file} is inside a document history directory.`, { path: file });
  await refuseProjectDocument(file, 'create');
  for (const existing of [file, historyDirectory(file)])
    if (await exists(existing))
      fail('DOCUMENT_EXISTS', `${existing} already exists. Choose a new document path.`, {
        path: existing,
      });
}

/** Write a new document. Never overwrites a document or an orphaned history directory. */
export async function createDocument(file: string, document: EditorDocument) {
  await checkNewDocument(file, document.kind);
  await fs.mkdir(path.dirname(file), { recursive: true });
  return withFileLock(file, async () => {
    await checkNewDocument(file, document.kind);
    const { stats } = validateEditorDocument(document);
    await writeJson(file, serializeDocument(document));
    const warnings = stemWarnings(file, document.model.id);
    return {
      path: file,
      ...documentHeader(document),
      stats,
      ...(warnings.length ? { warnings } : {}),
    };
  });
}

/** Apply one guarded batch. Unchanged results write nothing and keep the revision. */
export async function commitEdit(file: string, operations: ModelOperation[], options: EditOptions) {
  await refuseProjectDocument(file, 'edit');
  return withFileLock(file, async () => {
    const current = await readDocument(file);
    const { next, result } = prepareModelEdit(current.document, operations, options);
    if (result.changed && !options.dryRun) await persist(file, current, next);
    return { path: file, ...result };
  });
}
async function persist(file: string, current: LoadedDocument, next: EditorDocument) {
  await fs.mkdir(historyDirectory(file), { recursive: true });
  // The replaced version is kept byte-for-byte (never replacing a stored snapshot), then the
  // document is replaced atomically.
  const snapshot = historyFile(file, current.revision);
  const temporary = `${snapshot}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, current.bytes, { flag: 'wx' });
    // link() publishes the complete snapshot atomically and fails when one exists.
    await fs.link(temporary, snapshot);
  } catch (error) {
    if (errorCode(error) === 'EEXIST')
      fail(
        'HISTORY_CONFLICT',
        `${snapshot} already stores revision ${current.revision}; the document was not changed.`,
        { path: snapshot, revision: current.revision },
      );
    throw error;
  } finally {
    await fs.rm(temporary, { force: true });
  }
  await writeJson(file, serializeDocument(next));
}

/** Every stored revision plus the current one, oldest first. */
export async function listHistory(file: string) {
  const current = await readDocument(file);
  const names = await fs.readdir(historyDirectory(file)).catch((error: unknown) => {
    if (errorCode(error) === 'ENOENT') return [] as string[];
    throw error;
  });
  const revisions = names
    .filter((name) => /^\d+\.json$/.test(name))
    .map((name) => Number(name.slice(0, -5)))
    .sort((a, b) => a - b);
  const entries = [];
  for (const revision of revisions) {
    const snapshot = historyFile(file, revision);
    try {
      const saved = await readBounded(snapshot, 'HISTORY_NOT_FOUND', `${snapshot} is missing.`);
      entries.push({
        revision,
        stateHash: documentStateHash(parseAt(snapshot, saved.value)),
        path: snapshot,
      });
    } catch (error) {
      // One unreadable snapshot is reported in place; the others stay listed and restorable.
      if (!(error instanceof ForgeError)) throw error;
      entries.push({
        revision,
        path: snapshot,
        error: { code: error.code, message: error.message },
      });
    }
  }
  return {
    ...documentHeader(current.document),
    path: file,
    history: historyDirectory(file),
    revisions: [
      ...entries,
      { revision: current.revision, stateHash: current.stateHash, current: true },
    ],
  };
}

/** Restore a stored revision as a new revision. Identical content is a no-op. */
export async function restoreRevision(file: string, revision: number, options: EditOptions) {
  await refuseProjectDocument(file, 'edit');
  return withFileLock(file, async () => {
    const current = await readDocument(file);
    checkGuards(current.document, options);
    const source = historyFile(file, revision);
    const saved = await readBounded(
      source,
      'HISTORY_NOT_FOUND',
      `Revision ${revision} of ${path.basename(file)} is not stored. Run history for the available revisions.`,
    );
    const restored = parseAt(source, saved.value);
    if (restored.model.id !== current.document.model.id || restored.kind !== current.document.kind)
      fail('ID_MISMATCH', `${source} belongs to another document.`);
    const { stats } = validateEditorDocument(restored);
    const changed = contentKey(restored) !== contentKey(current.document);
    const proposedRevision = current.revision + (changed ? 1 : 0);
    const next = { ...restored, model: { ...restored.model, revision: proposedRevision } };
    if (changed && !options.dryRun) await persist(file, current, next);
    const written = changed && !options.dryRun;
    return {
      path: file,
      id: current.document.model.id,
      kind: current.document.kind,
      restoredFrom: revision,
      revision: written ? proposedRevision : current.revision,
      stateHash: written ? documentStateHash(next) : current.stateHash,
      proposedRevision,
      proposedStateHash: changed ? documentStateHash(next) : current.stateHash,
      changed,
      dryRun: !!options.dryRun,
      stats,
    };
  });
}
