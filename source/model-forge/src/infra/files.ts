import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fail, errorCode, ForgeError, readJson } from '../kernel/index.js';
export { readJson, writeJson, atomicWrite } from '../kernel/index.js';

/**
 * Read a JSON input file named by a command-line flag. A missing file keeps the NOT_FOUND
 * code and message, with a remedy about that flag's path instead of NOT_FOUND's general
 * remedy for missing IDs.
 */
export async function readInputJson(file: string, flag: string): Promise<unknown> {
  try {
    return await readJson(file);
  } catch (error) {
    if (error instanceof ForgeError && error.code === 'NOT_FOUND')
      fail('NOT_FOUND', error.message, { hint: missingInputHint(flag) });
    throw error;
  }
}
export const missingInputHint = (flag: string) =>
  `No file exists at the ${flag} path; relative paths resolve against the current directory. Check the path${flag === '--file' ? ', or pass --file - for stdin or --data <json>' : ''}.`;

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

interface LockRecord {
  pid?: unknown;
  hostname?: unknown;
  createdAt?: unknown;
  token?: unknown;
}
async function readLock(lock: string): Promise<LockRecord | undefined> {
  try {
    const value: unknown = JSON.parse(await fs.readFile(lock, 'utf8'));
    return value && typeof value === 'object' ? (value as LockRecord) : undefined;
  } catch {
    return undefined;
  }
}
/** A lock is stale only when it names a process on this host that no longer exists. */
function staleHolder(record: LockRecord | undefined) {
  if (!record || record.hostname !== os.hostname()) return false;
  if (typeof record.pid !== 'number' || !Number.isSafeInteger(record.pid) || record.pid <= 0)
    return false;
  try {
    process.kill(record.pid, 0);
    return false;
  } catch (error) {
    return errorCode(error) === 'ESRCH';
  }
}

/**
 * Exclusive advisory lock beside an existing file's directory. Held across read → prepare →
 * write; released even when the action throws, and only while it is still this holder's
 * lock. A crashed writer leaves the lock: DOCUMENT_LOCKED reports its holder and whether that
 * process is gone (`stale`), and the lock is never removed automatically.
 */
export async function withFileLock<T>(file: string, action: () => Promise<T>): Promise<T> {
  const lock = `${file}.lock`;
  const token = randomUUID();
  let handle;
  try {
    handle = await fs.open(lock, 'wx');
  } catch (error) {
    if (errorCode(error) === 'EEXIST') {
      const holder = await readLock(lock);
      const stale = staleHolder(holder);
      fail(
        'DOCUMENT_LOCKED',
        `Another command holds ${path.basename(lock)}${typeof holder?.pid === 'number' ? ` (pid ${holder.pid})` : ''}. Retry after it finishes.`,
        {
          lock,
          pid: holder?.pid ?? null,
          hostname: holder?.hostname ?? null,
          createdAt: holder?.createdAt ?? null,
          stale,
          hint: stale
            ? `The holder process ${String(holder?.pid)} no longer runs on this host, so the lock is stale. Verify that no writer is running, delete ${lock}, then retry.`
            : 'Retry after the holder finishes; do not delete a lock whose process may still be running.',
        },
      );
    }
    if (errorCode(error) === 'ENOENT')
      fail('DOCUMENT_NOT_FOUND', `The directory of ${file} does not exist.`, { path: file });
    throw error;
  }
  try {
    await handle.writeFile(
      JSON.stringify({
        pid: process.pid,
        hostname: os.hostname(),
        createdAt: new Date().toISOString(),
        token,
      }),
    );
    return await action();
  } finally {
    try {
      await handle.close();
    } finally {
      // Never remove a lock that another holder replaced after ours was deleted.
      if ((await readLock(lock))?.token === token) await fs.rm(lock, { force: true });
    }
  }
}
