import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const run = promisify(execFile);
async function cli(...args: string[]) {
  const result = await run(process.execPath, ['dist/cli.js', ...args], { maxBuffer: 8e6 });
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout).data;
}
function close(actual: any, expected: any) {
  if (typeof expected === 'number')
    assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
  else if (expected && typeof expected === 'object')
    for (const k of Object.keys(expected)) close(actual[k], expected[k]);
  else assert.equal(actual, expected);
}

test('CLI quality gate and validated export provide structured results without mutating a project', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-quality-cli-'));
  try {
    const before = await cli('-p', 'examples/procedural', 'inspect');
    const good = await cli(
      '-p',
      'examples/procedural',
      'audit',
      '--data',
      '{"schemaVersion":1,"kind":"quality-policy","maxMaterials":10,"maxTriangles":2000}',
    );
    assert.equal(good.passed, true);
    assert.ok(good.metrics.materials < 10);
    try {
      await cli(
        '-p',
        'examples/procedural',
        'audit',
        '--data',
        '{"schemaVersion":1,"kind":"quality-policy","maxTriangles":10}',
      );
      assert.fail('Expected quality failure');
    } catch (error: any) {
      assert.equal(error.code, 1);
      assert.equal(error.stdout, '');
      const report = JSON.parse(error.stderr).error;
      assert.equal(report.code, 'QUALITY_GATE_FAILED');
      assert.ok(report.details.findings.some((f: any) => f.code === 'BUDGET_TRIANGLES'));
    }
    const file = path.join(root, 'model.glb');
    const exported = await cli(
      '-p',
      'examples/procedural',
      'export',
      '--model',
      'rack',
      '--validate',
      '--out',
      file,
    );
    assert.equal(exported.validation.numErrors, 0);
    assert.equal((await cli('-p', 'examples/procedural', 'inspect')).stateHash, before.stateHash);
    assert.equal((await cli('schema', '--kind', 'quality-policy')).type, 'object');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('review replay locks cameras when geometry changes and records the render environment', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-replay-'));
  try {
    const first = await cli(
      '-p',
      'examples/procedural',
      'review',
      '--model',
      'rack',
      '--views',
      'iso,top',
      '--width',
      '320',
      '--height',
      '240',
      '--out',
      path.join(root, 'first'),
    );
    const before = JSON.parse(await fs.readFile(first.manifest, 'utf8'));
    assert.ok(before.provenance.chromium);
    assert.ok(before.provenance.three);
    const next = await cli(
      '-p',
      'examples/procedural',
      'review',
      '--model',
      'rack',
      '--parameters',
      '{"width":4,"height":4}',
      '--file',
      first.replayPlan,
      '--out',
      path.join(root, 'next'),
    );
    const after = JSON.parse(await fs.readFile(next.manifest, 'utf8'));
    for (let i = 0; i < 2; i++) close(after.frames[i].camera, before.frames[i].camera);
    assert.notEqual(after.renderStateHash, before.renderStateHash);
    assert.notDeepEqual(after.stats.bounds, before.stats.bounds);
    assert.equal(after.plan.frames[0].camera.fixed.projection, 'perspective');
    assert.equal(after.plan.frames[1].camera.fixed.projection, 'orthographic');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('offline editor downloads an exact orthographic review plan that the CLI can render', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-camera-ui-'));
  let browser;
  try {
    const html = path.join(root, 'preview.html');
    await cli('-p', 'examples/procedural', 'preview', '--out', html);
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.FORGE_CHROMIUM_PATH,
      args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(pathToFileURL(html).href);
    await page.waitForFunction(() => window.forgeReady);
    await page.getByRole('button', { name: 'Top', exact: true }).click();
    const expected = await page.evaluate(() => window.forgeViewer.getCamera());
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save review plan', exact: true }).click();
    const planFile = path.join(root, 'camera.json');
    await (await pending).saveAs(planFile);
    const plan = JSON.parse(await fs.readFile(planFile, 'utf8'));
    close(plan.frames[0].camera.fixed, expected);
    assert.equal(plan.frames[0].camera.fixed.projection, 'orthographic');
    const result = await cli(
      '-p',
      'examples/procedural',
      'review',
      '--file',
      planFile,
      '--out',
      path.join(root, 'capture'),
    );
    close(result.frames[0].camera, expected);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});
