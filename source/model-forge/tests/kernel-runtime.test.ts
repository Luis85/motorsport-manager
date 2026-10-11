import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { promisify } from 'node:util';
import { ForgeError } from '../src/kernel/domain/errors.js';
import { withCaptureSession } from '../src/kernel/io/capture.js';
import { playwrightSearchRoots } from '../src/kernel/io/playwright.js';

const run = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, '..');
/** Child environment that cannot reach a module directory through NODE_PATH. */
function withoutNodePath() {
  const environment = { ...process.env };
  delete environment.NODE_PATH;
  return environment;
}

test('Playwright fallback roots cover the working directory, repository package and global npm root', () => {
  const roots = playwrightSearchRoots({
    cwd: '/work/project',
    entry: '/repo/bin/scene-forge',
    execPath: '/opt/node/bin/node',
    platform: 'linux',
  });
  assert.deepEqual(roots, ['/work/project', '/repo/source/scene-forge', '/opt/node/lib']);
});

test('missing Playwright is a structured error with remedies rather than a launch failure', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-playwright-missing-'));
  try {
    // A child process without NODE_PATH keeps the result independent of global installs.
    const script = `
      import { loadPlaywright } from './src/kernel/io/playwright.ts';
      const missing = Object.assign(new Error('Cannot find package playwright'), { code: 'ERR_MODULE_NOT_FOUND' });
      const env = { cwd: ${JSON.stringify(temp)}, entry: ${JSON.stringify(path.join(temp, 'bin', 'scene-forge'))}, execPath: ${JSON.stringify(path.join(temp, 'node', 'bin', 'node'))}, platform: 'linux' };
      try { await loadPlaywright(env, () => Promise.reject(missing)); console.log('loaded'); }
      catch (error) { console.log(JSON.stringify({ code: error.code, details: error.details })); }`;
    const { stdout } = await run(
      process.execPath,
      ['--import', 'tsx', '--input-type=module', '--eval', script],
      { cwd: projectRoot, env: withoutNodePath() },
    );
    const result = JSON.parse(stdout);
    assert.equal(result.code, 'PLAYWRIGHT_UNAVAILABLE');
    assert.equal(result.details.searched.length, 4);
    assert.match(
      result.details.remedies.join('\n'),
      /npm ci[\s\S]*npm install --global playwright/,
    );
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});

test('capture passes PLAYWRIGHT_UNAVAILABLE through unchanged and cleans its workspace', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-capture-playwright-'));
  await assert.rejects(
    withCaptureSession(
      '<html></html>',
      { width: 100, height: 100 },
      async () => assert.fail('must not capture'),
      {
        createTemp: async () => temp,
        launch: async () => {
          throw new ForgeError('PLAYWRIGHT_UNAVAILABLE', 'missing', { remedies: [] });
        },
      },
    ),
    (error: unknown) => error instanceof ForgeError && error.code === 'PLAYWRIGHT_UNAVAILABLE',
  );
  await assert.rejects(fs.access(temp), { code: 'ENOENT' });
});
