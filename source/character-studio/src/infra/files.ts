import { mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export class StudioError extends Error {
  constructor(public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

export async function readJson(file: string): Promise<any> {
  const info = await stat(file);
  if (info.size > 2 * 1024 * 1024) throw new StudioError('SIZE_LIMIT', 'JSON files must be at most 2 MiB.');
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) throw new StudioError('INVALID_JSON', `Cannot parse JSON in ${file}.`);
    throw error;
  }
}

/** Atomic replacement: retain the previous document if staging or syncing fails. */
export async function replaceJson(file: string, value: unknown): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  const handle = await open(temporary, 'wx', 0o600);
  try {
    await handle.writeFile(JSON.stringify(value, null, 2) + '\n');
    await handle.sync();
    await handle.close();
    await rename(temporary, file);
  } finally {
    await handle.close().catch(() => {});
    await rm(temporary, { force: true });
  }
}

/** Exports never overwrite files. The caller must choose a new destination. */
export async function writeNew(file: string, contents: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const handle = await open(file, 'wx', 0o600);
  try {
    await handle.writeFile(contents);
    await handle.sync();
  } catch (error) {
    await handle.close();
    await rm(file, { force: true });
    throw error;
  } finally {
    await handle.close().catch(() => {});
  }
}
