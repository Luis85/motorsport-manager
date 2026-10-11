import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadOfflinePage } from './offline-page.js';
import { chromium } from 'playwright';
import { validateBytes } from 'gltf-validator';
import { loadProject } from '../../src/infra/project.js';
import { exportScene } from '../../src/infra/export.js';

const run = promisify(execFile);
const cli = async (...args: string[]) => {
  const result = await run(process.execPath, ['dist/cli.js', ...args], {
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(result.stderr, '', 'Successful CLI commands must keep stderr clean');
  return JSON.parse(result.stdout);
};
test('agent workflow through the built CLI, stdin, dry-run, exports and actionable errors', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-cli-'));
  try {
    await cli('init', root, '--name', 'Agent workflow');
    await cli('-p', root, 'apply', '--file', 'examples/quick-start.batch.json', '--dry-run');
    let state = await cli('-p', root, 'inspect');
    assert.equal(state.data.revision, 0);
    await cli(
      '-p',
      root,
      'apply',
      '--file',
      'examples/quick-start.batch.json',
      '--expected-revision',
      '0',
    );
    await cli('-p', root, 'add', 'sphere', 'beacon', '--at', '0,2,0');
    await cli('-p', root, 'model', 'import', '--file', 'examples/outpost/models/rover.model.json');
    await cli(
      '-p',
      root,
      'model',
      'instantiate',
      'rover',
      'scout',
      '--at',
      '3,0,0',
      '--parameters',
      '{"wheelRadius":0.6}',
    );
    await cli('-p', root, 'scene', 'create', 'alternate');
    await cli('-p', root, 'scene', 'use', 'alternate');
    state = await cli('-p', root, 'inspect');
    assert.equal(state.data.stats.meshes, 0);
    await cli('-p', root, 'scene', 'use', 'main');
    const file = path.join(root, 'scene.glb');
    await cli('-p', root, 'export', '--out', file);
    const report = await validateBytes(await fs.readFile(file));
    assert.equal(report.issues.numErrors, 0, JSON.stringify(report.issues));
    try {
      await cli('-p', root, 'add', 'box', 'bad', '--size=-1,1,1');
      assert.fail('Expected invalid dimension rejection');
    } catch (error: any) {
      assert.equal(JSON.parse(error.stderr).error.code, 'INVALID_GEOMETRY');
      assert.equal(error.stdout, '');
    }
    state = await cli('-p', root, 'inspect');
    assert.equal(state.data.revision, 3);
    const schema = await run(process.execPath, [
      'dist/cli.js',
      'schema',
      '--kind',
      'scene',
      '--raw',
    ]);
    assert.equal(JSON.parse(schema.stdout).type, 'object');
    const { spawn } = await import('node:child_process');
    const child = spawn(process.execPath, ['dist/cli.js', '-p', root, 'apply', '--file', '-']);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.stdin.end(
      JSON.stringify({ operations: [{ op: 'setParameter', id: 'scaleFactor', value: 2 }] }),
    );
    await new Promise<void>((resolve, reject) => {
      child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(stderr))));
    });
    assert.equal(JSON.parse(stdout).data.revision, 4);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test('outpost GLB and an isolated model subtree validate without glTF errors', async () => {
  const s = await loadProject('examples/outpost');
  for (const node of [undefined, 'scout']) {
    const result = await exportScene(s.scene, s.models, 'glb', node);
    const report = await validateBytes(result.data as Uint8Array);
    assert.equal(report.issues.numErrors, 0, JSON.stringify(report.issues));
  }
});
test('offline preview renders without network, exposes controls, downloads GLB/PNG and fits mobile', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-ui-'));
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.FORGE_CHROMIUM_PATH,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  });
  try {
    const html = path.join(root, 'preview.html');
    await cli('-p', 'examples/outpost', 'preview', '--out', html);
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors: string[] = [];
    const network: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (req) => {
      if (/^https?:/.test(req.url())) network.push(req.url());
    });
    await loadOfflinePage(page, html);
    await page.waitForFunction(() => window.forgeReady || window.forgeError);
    assert.equal(await page.evaluate(() => window.forgeError), undefined);
    assert.equal(await page.locator('canvas').count(), 1);
    assert.ok((await page.locator('.object').count()) > 20);
    await page.getByRole('button', { name: 'Top', exact: true }).click();
    assert.equal(await page.locator('#view-label').textContent(), 'Top');
    await page.getByRole('button', { name: 'Wireframe', exact: true }).click();
    assert.equal(await page.locator('#wireframe').getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: 'Wireframe', exact: true }).click();
    await page.getByRole('button', { name: 'Grid', exact: true }).click();
    assert.equal(await page.locator('#grid').getAttribute('aria-pressed'), 'false');
    await page.locator('#filter').fill('rover');
    assert.equal(await page.locator('.object:visible').count(), 1);
    await page.locator('.object:visible').click();
    assert.match((await page.locator('#details').textContent())!, /scout/);
    await page.locator('#filter').fill('');
    await page.getByRole('button', { name: 'View recipe' }).click();
    assert.equal(await page.locator('#source-panel').isVisible(), true);
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    const glbPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export GLB' }).click();
    const glb = await glbPromise;
    await glb.saveAs(path.join(root, 'download.glb'));
    assert.equal(
      (await validateBytes(await fs.readFile(path.join(root, 'download.glb')))).issues.numErrors,
      0,
    );
    const pngPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save PNG' }).click();
    const png = await pngPromise;
    await png.saveAs(path.join(root, 'download.png'));
    assert.equal(
      (await fs.readFile(path.join(root, 'download.png'))).subarray(1, 4).toString(),
      'PNG',
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Frame', exact: true }).click();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(network, []);
    const capture = path.join(root, 'capture.png');
    await cli(
      '-p',
      'examples/outpost',
      'screenshot',
      '--out',
      capture,
      '--width',
      '800',
      '--height',
      '600',
      '--view',
      'front',
    );
    const data = await fs.readFile(capture);
    assert.equal(data.readUInt32BE(16), 800);
    assert.equal(data.readUInt32BE(20), 600);
    assert.ok(data.length > 10000);
  } finally {
    await browser.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});
