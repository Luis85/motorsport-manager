import { promises as fs, createReadStream } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fail, ForgeError, errorMessage, errorCode } from '../domain/errors.js';
/** Bounded JSON input and atomic file replacement shared by every forge tool. */
export async function readJson(file: string): Promise<unknown> {
  try {
    const chunks: Buffer[] = [];
    let bytes = 0;
    for await (const chunk of createReadStream(file)) {
      bytes += chunk.length;
      if (bytes > 16 * 1024 * 1024) fail('INPUT_TOO_LARGE', `JSON file exceeds 16 MiB: ${file}`);
      chunks.push(chunk as Buffer);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    if (error instanceof ForgeError) throw error;
    if (errorCode(error) === 'ENOENT') fail('NOT_FOUND', `File does not exist: ${file}`);
    fail('JSON_READ_FAILED', `Cannot read JSON file ${file}.`, { reason: errorMessage(error) });
  }
}
export async function atomicWrite(file: string, data: string | Uint8Array) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(tmp, data, { flag: 'wx' });
    await fs.rename(tmp, file);
  } finally {
    await fs.rm(tmp, { force: true });
  }
}
export const writeJson = (file: string, value: unknown) =>
  atomicWrite(file, JSON.stringify(value, null, 2) + '\n');
