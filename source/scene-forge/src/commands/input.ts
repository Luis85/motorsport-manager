import { z } from 'zod';
import { Id, NumberValue, parse, fail } from '../kernel.js';
import path from 'node:path';
import { readJson } from '../infra/files.js';
import type { CliRuntime } from './context.js';
import { withHint } from './errors.js';

/**
 * Read a JSON input file named by a command-line flag. A missing file keeps the NOT_FOUND
 * code and message, with a remedy about that flag's path.
 */
export async function readInputFile(file: string, flag: string): Promise<unknown> {
  try {
    return await readJson(file);
  } catch (error) {
    throw withHint(error, { NOT_FOUND: missingInputHint(flag) });
  }
}
export const missingInputHint = (flag: string) =>
  `No file exists at the ${flag} path; relative paths resolve against the current directory. Check the path${flag === '--file' ? ', or pass --file - for stdin or --data <json>' : ''}.`;
export const parseJson = (value: string): unknown => {
  if (Buffer.byteLength(value) > 16 * 1024 * 1024)
    fail('INPUT_TOO_LARGE', 'JSON input exceeds 16 MiB.');
  try {
    return JSON.parse(value);
  } catch {
    fail('JSON_INVALID', 'Cannot parse JSON input. Pass valid JSON with double-quoted keys.');
  }
};
export async function readInput(runtime: CliRuntime, options: { data?: string; file?: string }) {
  if (!!options.data === !!options.file)
    fail('INPUT_REQUIRED', 'Supply exactly one of --file <path|-> or --data <json>.');
  if (options.data) return parseJson(options.data);
  if (options.file === '-') {
    if (runtime.stdin.isTTY) fail('INPUT_REQUIRED', 'Pipe JSON to stdin or pass a file path.');
    const chunks: Buffer[] = [];
    let bytes = 0;
    for await (const chunk of runtime.stdin) {
      bytes += chunk.length;
      if (bytes > 16 * 1024 * 1024) fail('INPUT_TOO_LARGE', 'Input exceeds 16 MiB.');
      chunks.push(Buffer.from(chunk));
    }
    return parseJson(Buffer.concat(chunks).toString('utf8'));
  }
  return readInputFile(path.resolve(runtime.cwd, options.file!), '--file');
}

export const parseParameters = (value: string) =>
  parse(z.record(Id, NumberValue), parseJson(value));
