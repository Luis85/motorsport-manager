import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { writeNew } from '../infra/files.js';

export class CommandError extends Error {
  constructor(public code: string, message: string, public exitCode = 2, public details?: unknown) {
    super(message);
  }
}

export type Flags = Record<string, string | boolean>;
export type Descriptor = {
  description: string;
  required?: string[];
  optional?: string[];
  booleans?: string[];
  example: string;
};

export function parse(argv: string[], descriptors: Record<string, Descriptor>) {
  const tokens = [...argv];
  const command = tokens.shift() || 'help';
  if (command === '--help' || command === '-h') return { command: 'help', flags: {} as Flags };
  if (command === '--version') return { command: 'version', flags: {} as Flags };
  if (!Object.hasOwn(descriptors, command)) throw new CommandError('UNKNOWN_COMMAND', `Unknown command: ${command}. Use discover.`);
  const descriptor = descriptors[command];
  const flags: Flags = {};
  const allowed = new Set([...(descriptor.required || []), ...(descriptor.optional || []), ...(descriptor.booleans || [])]);
  while (tokens.length) {
    const token = tokens.shift()!;
    if (!token.startsWith('--')) throw new CommandError('INVALID_ARGUMENT', `Expected --flag; received ${token}.`);
    const [key, ...inline] = token.slice(2).split('=');
    if (!allowed.has(key)) throw new CommandError('UNKNOWN_FLAG', `Unknown flag --${key} for ${command}.`);
    if (Object.hasOwn(flags, key)) throw new CommandError('DUPLICATE_FLAG', `Flag --${key} was supplied twice.`);
    if (descriptor.booleans?.includes(key)) {
      if (inline.length) throw new CommandError('INVALID_ARGUMENT', `Flag --${key} does not take a value.`);
      flags[key] = true;
    } else {
      const value = inline.length ? inline.join('=') : tokens.shift();
      if (value === undefined || value === '' || value.startsWith('--')) {
        throw new CommandError('MISSING_ARGUMENT', `Flag --${key} needs a value.`);
      }
      flags[key] = value;
    }
  }
  for (const key of descriptor.required || []) {
    if (!Object.hasOwn(flags, key)) throw new CommandError('MISSING_ARGUMENT', `Required flag --${key} is missing.`);
  }
  return { command, flags };
}

export function stringFlag(flags: Flags, key: string, fallback?: string): string {
  return typeof flags[key] === 'string' ? flags[key] as string : fallback!;
}

export function integerFlag(flags: Flags, key: string, fallback?: number): number | undefined {
  if (flags[key] === undefined) return fallback;
  const value = String(flags[key]);
  if (!/^(0|[1-9]\d*)$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new CommandError('INVALID_ARGUMENT', `--${key} must be a nonnegative integer.`);
  }
  return Number(value);
}

export async function readJson(path: string): Promise<any> {
  let content: string;
  try {
    if (path === '-') {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of process.stdin) {
        const buffer = Buffer.from(chunk);
        size += buffer.length;
        if (size > 8 * 1024 * 1024) throw new Error('JSON input exceeds 8 MiB.');
        chunks.push(buffer);
      }
      content = Buffer.concat(chunks).toString('utf8');
    } else {
      if ((await stat(resolve(path))).size > 8 * 1024 * 1024) throw new Error('JSON input exceeds 8 MiB.');
      content = await readFile(resolve(path), 'utf8');
    }
  } catch (error) {
    throw new CommandError('FILE_READ_FAILED', `Cannot read JSON input ${path}.`, 1, { reason: (error as Error).message });
  }
  if (Buffer.byteLength(content) > 8 * 1024 * 1024) throw new CommandError('INPUT_TOO_LARGE', 'JSON input exceeds 8 MiB.', 1);
  try { return JSON.parse(content); }
  catch { throw new CommandError('INVALID_JSON', `Input ${path} is not valid JSON.`, 1); }
}

export async function writeOutput(path: string, value: unknown, html = false): Promise<string> {
  const file = resolve(path);
  try {
    await writeNew(file, html ? String(value) : `${JSON.stringify(value, null, 2)}\n`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new CommandError('OUTPUT_EXISTS', `Output already exists: ${file}. Choose a new path.`, 3);
    throw error;
  }
  return file;
}

export function failure(error: unknown) {
  const value = error as Error & { code?: string; exitCode?: number; details?: unknown; errors?: unknown };
  const code = value.code || 'COMMAND_FAILED';
  const exitCode = value.exitCode || (/CONFLICT|EXISTS|LOCKED|BUSY/.test(code) ? 3 : 1);
  return {
    exitCode,
    result: { ok: false, error: { code, message: value.message || String(error), ...(value.details !== undefined ? { details: value.details } : {}), ...(value.errors ? { errors: value.errors } : {}) } },
  };
}
