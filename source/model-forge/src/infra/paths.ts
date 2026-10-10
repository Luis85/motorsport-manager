import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fail, errorCode } from '../kernel/index.js';
import { documentSuffixes } from '../domain/document.js';

/** The manifest file that marks a Scene Forge project directory (scene-forge infra/project.ts). */
export const sceneForgeManifest = 'forge.project.json';

async function isFile(file: string) {
  return fs.stat(file).then(
    (stat) => stat.isFile(),
    (error: unknown) => {
      if (errorCode(error) === 'ENOENT' || errorCode(error) === 'ENOTDIR') return false;
      throw error;
    },
  );
}
/** The real path of a file's nearest existing ancestor, joined with the rest of its path. */
async function realTarget(file: string) {
  const resolved = path.resolve(file);
  let existing = resolved;
  const rest: string[] = [];
  for (;;) {
    try {
      return path.join(await fs.realpath(existing), ...rest.reverse());
    } catch (error) {
      if (errorCode(error) !== 'ENOENT' && errorCode(error) !== 'ENOTDIR') throw error;
      const parent = path.dirname(existing);
      if (parent === existing) return resolved;
      rest.push(path.basename(existing));
      existing = parent;
    }
  }
}

/** The Scene Forge project directory containing `file`, if any ancestor holds a manifest. */
export async function enclosingProject(file: string): Promise<string | undefined> {
  const real = await realTarget(file);
  for (let directory = path.dirname(real); ; directory = path.dirname(directory)) {
    if (await isFile(path.join(directory, sceneForgeManifest))) return directory;
    if (path.dirname(directory) === directory) return undefined;
  }
}

/**
 * Model Forge never writes a model document inside a Scene Forge project: the project owns
 * its registry, scenes and guards. Reads stay allowed.
 */
export async function refuseProjectDocument(file: string, action: 'edit' | 'create' | 'export') {
  const project = await enclosingProject(file);
  if (!project) return;
  const stem = path.basename(file).replace(/\.model(-bundle)?\.json$/, '');
  const copy = `${stem}${documentSuffixes['model-bundle']}`;
  fail(
    'PROJECT_MODEL_READONLY',
    `${file} is inside the Scene Forge project ${project}; Model Forge does not ${action} model documents in a project.`,
    {
      document: file,
      project,
      hint: `Edit a copy, then hand it back through Scene Forge's guarded import: model-forge import --project ${project} --id <id> --out <new>/${copy}; edit it; model-forge -d <new>/${copy} export --format model-bundle --out <file>; scene-forge -p ${project} model import --file <file> --replace --expected-revision <project revision> (or --expected-state <project stateHash>).`,
    },
  );
}

/** A path inside a document side directory (`*.history`) or naming a lock file (`*.lock`). */
export function sideFilePath(file: string) {
  const parts = path.resolve(file).split(path.sep);
  return parts.at(-1)!.endsWith('.lock') || parts.some((part) => part.endsWith('.history'));
}

export interface OutputPolicy {
  /** Replace an existing file deliberately. */
  overwrite?: boolean;
  /** The document being read; an output may never replace it. */
  source?: string;
  /** Merge into an existing file instead of replacing it (Littlewild definitions). */
  merge?: boolean;
  /** Directory outputs (review) are checked by their writer for emptiness. */
  directory?: boolean;
}
/**
 * Every file an output command writes. Locks and history snapshots are never targets, even
 * with --overwrite; the source document is never replaced; an existing file is replaced only
 * with --overwrite (ALREADY_EXISTS otherwise).
 */
export async function checkOutput(out: string, policy: OutputPolicy = {}) {
  if (sideFilePath(out))
    fail(
      'INVALID_PATH',
      `${out} is a lock file or inside a document history directory; outputs never replace them.`,
      { path: out, hint: 'Choose an output path outside <document>.lock and <document>.history/.' },
    );
  const real = await realTarget(out);
  if (policy.source && real === (await realTarget(policy.source)))
    fail('INVALID_PATH', `${out} is the source document; outputs never replace it.`, {
      path: out,
      hint: 'Choose another output path; edit the document with apply and restore earlier revisions with restore.',
    });
  const stat = await fs.stat(out).catch((error: unknown) => {
    if (errorCode(error) === 'ENOENT') return undefined;
    throw error;
  });
  if (!stat) return out;
  if (policy.directory) {
    if (!stat.isDirectory())
      fail('INVALID_PATH', `${out} is a file; pass a directory path.`, { path: out });
    return out;
  }
  if (stat.isDirectory())
    fail('INVALID_PATH', `${out} is a directory; pass a file path.`, { path: out });
  if (!policy.overwrite && !policy.merge)
    fail('ALREADY_EXISTS', `${out} already exists. Choose a new path or pass --overwrite.`, {
      path: out,
    });
  return out;
}
