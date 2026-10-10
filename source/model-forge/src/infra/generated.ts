import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fail, errorCode, errorMessage, ForgeError } from '../kernel/index.js';
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

/**
 * Write planned documents (never replacing one), their side files and any extra JSON
 * files, in order. Nothing is rolled back: a failure part way rethrows with every path
 * already written (including `options.written`, such as a rendered review) in
 * `details.written`, so the caller can see exactly what exists before retrying.
 */
export async function writePlanned(
  planned: PlannedDocument[],
  options: { files?: { path: string; data: unknown }[]; written?: string[] } = {},
) {
  const written = [...(options.written ?? [])];
  try {
    for (const entry of planned) {
      await fs.mkdir(path.dirname(entry.path), { recursive: true });
      await createDocument(entry.path, entry.document);
      written.push(entry.path);
      if (entry.sidecar) {
        await checkOutput(entry.sidecar.path);
        await writeJson(entry.sidecar.path, entry.sidecar.data);
        written.push(entry.sidecar.path);
      }
    }
    for (const file of options.files ?? []) {
      await checkOutput(file.path);
      await writeJson(file.path, file.data);
      written.push(file.path);
    }
  } catch (error) {
    if (!written.length) throw error;
    const forge =
      error instanceof ForgeError ? error : new ForgeError('INTERNAL_ERROR', errorMessage(error));
    const details = forge.details;
    fail(forge.code, `${forge.message} Already written: ${written.length} path(s).`, {
      ...(details && typeof details === 'object' && !Array.isArray(details)
        ? details
        : details === undefined
          ? {}
          : { cause: details }),
      written,
      hint: 'Nothing was rolled back. Inspect or delete the paths in details.written, then rerun with new output paths.',
    });
  }
  return written;
}
