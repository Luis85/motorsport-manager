import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Readable } from 'node:stream';
import { createCli } from '../src/commands/create-cli.js';

/** Shared fixtures of the procedural command tests. */
/** One CLI invocation in `cwd`, parsed: {status, data | error}. */
export async function run(cwd: string, args: string[]) {
  let stdout = '',
    stderr = '';
  const cli = createCli({
    cwd,
    stdin: Readable.from([]),
    writeOut: (s) => {
      stdout += s;
    },
    writeErr: (s) => {
      stderr += s;
    },
  });
  const status = await cli.run(['--compact', ...args]);
  return {
    status,
    data: status === 0 && stdout.startsWith('{') ? JSON.parse(stdout).data : undefined,
    error: status ? JSON.parse(stderr).error : undefined,
  };
}
/** A successful invocation's data; fails the test with the CLI error otherwise. */
export async function ok(cwd: string, args: string[]) {
  const result = await run(cwd, args);
  assert.equal(result.status, 0, JSON.stringify(result.error));
  return result.data;
}
export async function failure(cwd: string, args: string[], code: string) {
  const result = await run(cwd, args);
  assert.equal(result.status, 1, `expected ${code} from ${args.join(' ')}`);
  assert.equal(result.error.code, code, JSON.stringify(result.error));
  return result.error;
}
export const models = {
  operations: [
    { op: 'putMaterial', id: 'wood', material: { color: '#8a5a2b' } },
    { op: 'putGeometry', id: 'postGeo', geometry: { type: 'box', size: [0.2, 1, 0.2] } },
    { op: 'putGeometry', id: 'stoneGeo', geometry: { type: 'sphere', radius: 0.4 } },
    { op: 'putNode', node: { id: 'post', type: 'group' } },
    {
      op: 'putNode',
      node: {
        id: 'postBody',
        type: 'mesh',
        parent: 'post',
        geometry: 'postGeo',
        material: 'wood',
        transform: { position: [0, 0.5, 0] },
      },
    },
    { op: 'putNode', node: { id: 'stone', type: 'group' } },
    {
      op: 'putNode',
      node: {
        id: 'stoneBody',
        type: 'mesh',
        parent: 'stone',
        geometry: 'stoneGeo',
        material: 'wood',
      },
    },
  ],
};
/** A project with registered models post and stone and a 32 m hills terrain `ground`. */
export async function project(root: string, name: string) {
  const dir = path.join(root, name);
  await ok(root, ['init', dir]);
  await ok(dir, ['apply', '--data', JSON.stringify(models)]);
  for (const id of ['post', 'stone']) {
    await ok(dir, ['model', 'capture', id, '--nodes', id]);
    await ok(dir, ['remove', id, '--cascade']);
  }
  await ok(dir, [
    'terrain',
    'add',
    'ground',
    '--size',
    '32,32',
    '--resolution',
    '33',
    '--seed',
    '5',
  ]);
  return dir;
}
export const source = async (dir: string) => (await ok(dir, ['inspect', '--source'])).source;
export const sceneBytes = (dir: string) =>
  fs.readFile(path.join(dir, 'scenes/main.scene.json'), 'utf8');
export const forest = ['scatter', '--model', 'post,stone:2', '--on', 'ground', '--spacing', '2.5'];
export const withRoot = async (body: (root: string) => Promise<void>) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-procedural-'));
  try {
    await body(root);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
};
