import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fail, errorCode } from '../kernel/index.js';
export { readJson, writeJson, atomicWrite } from '../kernel/index.js';

export async function exists(file: string) {
  try {
    await fs.access(file);
    return true;
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return false;
    throw error;
  }
}

/** Resolve a manifest-relative path, rejecting escapes through `..` or symbolic links. */
export async function inside(root: string, relative: string) {
  const candidate = path.resolve(root, relative);
  const rel = path.relative(root, candidate);
  if (path.isAbsolute(relative) || rel.startsWith('..') || path.isAbsolute(rel))
    fail('INVALID_PATH', `Project path escapes the project: ${relative}`);
  const real = await fs.realpath(candidate).catch((error: unknown) => {
    if (errorCode(error) === 'ENOENT') return candidate;
    throw error;
  });
  if (path.relative(await fs.realpath(root), real).startsWith('..'))
    fail('INVALID_PATH', `Project path resolves outside the project: ${relative}`);
  return candidate;
}

/**
 * Exclusive advisory lock beside a file. Held across read → prepare → write; released even
 * when the action throws. A crashed writer leaves the lock for a human to remove.
 */
export async function withFileLock<T>(file: string, action: () => Promise<T>): Promise<T> {
  const lock = `${file}.lock`;
  await fs.mkdir(path.dirname(lock), { recursive: true });
  let handle;
  try {
    handle = await fs.open(lock, 'wx');
  } catch (error) {
    if (errorCode(error) === 'EEXIST')
      fail(
        'DOCUMENT_LOCKED',
        `Another command holds ${path.basename(lock)}. Retry after it finishes. If a process crashed, remove the lock only after verifying no writer is running.`,
        { lock },
      );
    throw error;
  }
  try {
    await handle.writeFile(JSON.stringify({ pid: process.pid }));
    return await action();
  } finally {
    try {
      await handle.close();
    } finally {
      await fs.rm(lock, { force: true });
    }
  }
}
