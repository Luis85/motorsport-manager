import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fail, errorCode } from '../kernel/index.js';
import type { EditorDocument } from '../application/document.js';
import { checkNewDocument, createDocument } from './store.js';
import { checkOutput } from './paths.js';
import { writeJson } from './files.js';

/** A document a procedural command will write, with an optional JSON side file. */
export interface PlannedDocument {
  path: string;
  document: EditorDocument;
  sidecar?: { path: string; data: unknown };
}

/** A directory that is absent or empty; anything else fails without writing. */
export async function checkNewDirectory(directory: string, flag: string) {
  await checkOutput(directory, { directory: true });
  const entries = await fs.readdir(directory).catch((error: unknown) => {
    if (errorCode(error) === 'ENOENT') return [];
    throw error;
  });
  if (entries.length)
    fail('ALREADY_EXISTS', `${directory} is not empty; ${flag} needs a new or empty directory.`, {
      path: directory,
      hint: `Choose a new ${flag} directory; procedural commands never replace files.`,
    });
}

/**
 * Check every planned path before anything is written: new documents (DOCUMENT_EXISTS,
 * PROJECT_MODEL_READONLY, INVALID_PATH), absent side files (ALREADY_EXISTS) and no path twice.
 */
export async function checkPlanned(planned: PlannedDocument[], extraFiles: string[] = []) {
  const seen = new Set<string>();
  const once = (file: string) => {
    if (seen.has(file))
      fail('INVALID_OPTION', `Two outputs would be written to ${file}.`, { path: file });
    seen.add(file);
  };
  for (const entry of planned) {
    once(entry.path);
    await checkNewDocument(entry.path, entry.document.kind);
    if (entry.sidecar) {
      once(entry.sidecar.path);
      await checkOutput(entry.sidecar.path);
    }
  }
  for (const file of extraFiles) {
    once(file);
    await checkOutput(file);
  }
}

/** Write planned documents (never replacing one) and their side files, in order. */
export async function writePlanned(planned: PlannedDocument[]) {
  const written = [];
  for (const entry of planned) {
    await fs.mkdir(path.dirname(entry.path), { recursive: true });
    const created = await createDocument(entry.path, entry.document);
    if (entry.sidecar) {
      await checkOutput(entry.sidecar.path);
      await writeJson(entry.sidecar.path, entry.sidecar.data);
    }
    written.push(created);
  }
  return written;
}
