import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fail, errorCode } from '../kernel.js';
export { readJson, atomicWrite, writeJson } from '../kernel.js';
export async function inside(root: string, relative: string) {
  const candidate = path.resolve(root, relative);
  const rel = path.relative(root, candidate);
  if (path.isAbsolute(relative) || rel.startsWith('..') || path.isAbsolute(rel))
    fail('INVALID_PATH', `Project path escapes the project: ${relative}`);
  let ancestor = candidate;
  let actual: string;
  while (true) {
    try {
      actual = await fs.realpath(ancestor);
      break;
    } catch (error) {
      if (errorCode(error) !== 'ENOENT') throw error;
      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw error;
      ancestor = parent;
    }
  }
  const resolved = path.resolve(actual!, path.relative(ancestor, candidate));
  if (path.relative(root, resolved).startsWith('..'))
    fail('INVALID_PATH', `Project path resolves outside the project: ${relative}`);
  return candidate;
}
export async function findProject(start: string) {
  let current = await fs
    .realpath(path.resolve(start))
    .catch(() => fail('PROJECT_NOT_FOUND', `Directory ${start} does not exist.`));
  while (true) {
    try {
      await fs.access(path.join(current, 'forge.project.json'));
      return current;
    } catch {
      /* ascend */
    }
    const parent = path.dirname(current);
    if (parent === current)
      fail(
        'PROJECT_NOT_FOUND',
        'No forge.project.json found. Run init <directory> to create a project.',
      );
    current = parent;
  }
}
export async function withLock<T>(root: string, action: () => Promise<T>): Promise<T> {
  const lock = path.join(root, '.forge.lock');
  let handle;
  try {
    handle = await fs.open(lock, 'wx');
  } catch (error) {
    if (errorCode(error) === 'EEXIST')
      fail(
        'PROJECT_LOCKED',
        'Another command holds the project lock. Retry after it finishes. If the process crashed, remove .forge.lock only after verifying no writer is running.',
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
