import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { promisify } from 'node:util';
import { ForgeError } from '../src/domain/errors.js';
import { withCaptureSession } from '../src/infra/capture.js';
import { playwrightSearchRoots } from '../src/infra/playwright.js';
import { readAsset } from '../src/infra/assets.js';

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
      import { loadPlaywright } from './src/infra/playwright.ts';
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

test('source runs read example assets from the catalog', async () => {
  const index = JSON.parse(await readAsset('examples/index.json'));
  assert.ok(Array.isArray(index) && index.length > 0);
  await assert.rejects(
    readAsset('examples/missing.json'),
    (error: unknown) => error instanceof ForgeError && error.code === 'BUILD_REQUIRED',
  );
});

test('standalone executable is deterministic and runs without node_modules', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-standalone-'));
  try {
    const { buildStandalone } = await import('../scripts/standalone.mjs');
    const [first, second] = [await buildStandalone(), await buildStandalone()];
    assert.ok(first.equals(second), 'two builds must be byte-identical');
    const text = first.toString('utf8');
    assert.ok(text.startsWith('#!/usr/bin/env node\n/*!'));
    assert.match(text, /three@[\d.]+ \(MIT\)/);
    assert.doesNotMatch(text, new RegExp(projectRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(text, /sourceMappingURL/);
    const executable = path.join(temp, 'scene-forge');
    await fs.writeFile(executable, first, { mode: 0o755 });
    const cli = (...args: string[]) =>
      run(process.execPath, [executable, ...args], { cwd: temp, env: withoutNodePath() });
    assert.match((await cli('--version')).stdout, /^\d+\.\d+\.\d+\n$/);
    const help = (await cli('--help')).stdout;
    assert.match(help, /Usage: scene-forge/);
    assert.match(help, /docs\/reference\/scene-forge-cli\.md/);
    const examples = JSON.parse((await cli('--compact', 'example', 'list')).stdout);
    assert.ok(examples.ok && examples.data.length > 0);
    const created = JSON.parse(
      (await cli('--compact', 'example', 'create', examples.data[0].id, 'demo')).stdout,
    );
    assert.equal(created.data.nextCommands[0][0], 'scene-forge');
    await cli('-p', 'demo', 'preview', '--out', 'demo.html');
    const html = await fs.readFile(path.join(temp, 'demo.html'), 'utf8');
    const viewer = await fs.readFile(path.join(projectRoot, 'src/preview/styles.css'), 'utf8');
    assert.ok(html.includes(viewer.trim().split('\n')[0]), 'preview embeds the packaged CSS');
    await cli('-p', 'demo', 'export', '--validate', '--out', 'demo.glb');
    assert.equal(
      (await fs.readFile(path.join(temp, 'demo.glb'))).subarray(0, 4).toString(),
      'glTF',
    );
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});
