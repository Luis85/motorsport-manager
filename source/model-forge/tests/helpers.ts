import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { createCli } from '../src/commands/create-cli.js';

export const repository = path.resolve(import.meta.dirname, '../../..');
export const sceneForgeExamples = path.join(repository, 'source/scene-forge/examples');
export const sceneForgeBin = path.join(repository, 'bin/scene-forge');

export interface CliResult {
  status: number;
  stdout: string;
  stderr: string;
  /** The parsed envelope from stdout (success) or stderr (failure). */
  json: {
    ok: boolean;
    data?: any;
    error?: { code: string; message: string; hint?: string; details?: any };
  };
}
/** Run one in-process invocation with captured streams, like an agent's subprocess. */
export async function cli(args: string[], options: { cwd?: string; stdin?: string } = {}) {
  let stdout = '',
    stderr = '';
  const stdin = Readable.from(options.stdin === undefined ? [] : [Buffer.from(options.stdin)]);
  const status = await createCli({
    cwd: options.cwd ?? process.cwd(),
    stdin,
    writeOut: (text) => {
      stdout += text;
    },
    writeErr: (text) => {
      stderr += text;
    },
  }).run(args);
  const text = status === 0 ? stdout : stderr;
  let json: CliResult['json'];
  try {
    json = JSON.parse(text);
  } catch {
    json = { ok: false };
  }
  return { status, stdout, stderr, json } satisfies CliResult;
}
/** Successful data, or a thrown assertion naming the error envelope. */
export async function ok(args: string[], options?: { cwd?: string; stdin?: string }) {
  const result = await cli(args, options);
  if (result.status !== 0) throw new Error(`${args.join(' ')} failed: ${result.stderr}`);
  return result.json.data;
}
/** The error code of an invocation that must fail. */
export async function failure(args: string[], options?: { cwd?: string; stdin?: string }) {
  const result = await cli(args, options);
  if (result.status === 0) throw new Error(`${args.join(' ')} unexpectedly succeeded.`);
  return result.json.error!;
}

export async function tempDirectory(name = 'model-forge-test-') {
  return fs.mkdtemp(path.join(os.tmpdir(), name));
}
export async function withTemp<T>(action: (directory: string) => Promise<T>) {
  const directory = await tempDirectory();
  try {
    return await action(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}
/** A copy of a Scene Forge example project, so commands never touch the repository tree. */
export async function copyProject(name: string, directory: string) {
  const target = path.join(directory, name);
  await fs.cp(path.join(sceneForgeExamples, name), target, { recursive: true });
  return target;
}

export const boxModel = (id = 'crate') => ({
  schemaVersion: 1,
  kind: 'model',
  id,
  name: 'Crate',
  parameters: { width: { default: 1, min: 0.5, max: 3 } },
  materials: { wood: { color: '#a0703c' } },
  geometries: { body: { type: 'box', size: [{ $param: 'width' }, 0.6, 0.8] } },
  nodes: [
    { id: 'body', type: 'mesh', geometry: 'body', material: 'wood' },
    {
      id: 'lid',
      type: 'mesh',
      geometry: 'body',
      material: 'wood',
      transform: { position: [0, 0.7, 0], scale: [1, 0.1, 1] },
    },
  ],
});
