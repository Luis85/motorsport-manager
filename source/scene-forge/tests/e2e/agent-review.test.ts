import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { validateBytes } from 'gltf-validator';

const run = promisify(execFile);
async function cli(...args: string[]) {
  const result = await run(process.execPath, ['dist/cli.js', ...args], { maxBuffer: 8e6 });
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout).data;
}
test('agent discovers, imports procedural recipes, edits a selection and transfers a portable scene', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-agent-cli-'));
  try {
    const description = await cli('describe', 'node', 'edit');
    assert.ok(description.options.some((o: any) => o.flags === '--tag <tag>'));
    assert.equal((await cli('schema', '--kind', 'review')).type, 'object');
    const project = path.join(root, 'project');
    await cli('scene', 'unpack', project, '--file', 'examples/logistics.scene-bundle.json');
    const list = await cli(
      '-p',
      project,
      'node',
      'list',
      '--tag',
      'storage',
      '--details',
      '--limit',
      '2',
    );
    assert.equal(list.total, 3);
    assert.equal(list.nextOffset, 2);
    assert.equal(list.nodes[0].bounds.size[1] > 2, true);
    const edited = await cli(
      '-p',
      project,
      'node',
      'edit',
      '--tag',
      'storage',
      '--data',
      '{"parameters":{"height":3.5}}',
      '--expected-state',
      list.stateHash,
    );
    assert.equal(edited.changes.nodes.updated.length, 3);
    const variant = await cli(
      '-p',
      project,
      'model',
      'inspect',
      'rack',
      '--parameters',
      '{"height":4,"levels":5}',
    );
    assert.ok(Math.abs(variant.stats.bounds.size[1] - 4) < 1e-6);
    const bundle = path.join(root, 'portable.json');
    await cli('-p', project, 'scene', 'pack', '--out', bundle);
    const restored = path.join(root, 'restored');
    await cli('scene', 'unpack', restored, '--file', bundle);
    assert.equal(
      (await cli('-p', restored, 'inspect')).stateHash,
      (await cli('-p', project, 'inspect')).stateHash,
    );
    const file = path.join(root, 'rack.glb');
    await cli(
      '-p',
      restored,
      'export',
      '--model',
      'rack',
      '--parameters',
      '{"width":4}',
      '--out',
      file,
    );
    assert.equal((await validateBytes(await fs.readFile(file))).issues.numErrors, 0);
    const compact = await run(process.execPath, [
      'dist/cli.js',
      '--compact',
      '-p',
      project,
      'node',
      'list',
      '--tag',
      'storage',
    ]);
    assert.equal(compact.stdout.trim().split('\n').length, 1);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test('inline HTML review yields labeled views, exact frame sizes, camera metadata and an immutable source', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-review-test-'));
  try {
    const project = path.join(root, 'project');
    await fs.cp('examples/procedural', project, {
      recursive: true,
      filter: (file) => !['exports', '.forge.lock'].includes(path.basename(file)),
    });
    const before = await cli('-p', project, 'inspect');
    const directory = path.join(root, 'views');
    const result = await cli(
      '-p',
      project,
      'review',
      '--model',
      'rack',
      '--parameters',
      '{"width":4,"height":3.5}',
      '--views',
      'iso,front,top',
      '--width',
      '480',
      '--height',
      '360',
      '--out',
      directory,
    );
    assert.equal(result.frames.length, 3);
    assert.equal(new Set(result.frames.map((f: any) => f.sha256)).size, 3);
    for (const frame of result.frames) {
      const bytes = await fs.readFile(frame.path);
      assert.equal(bytes.readUInt32BE(16), 480);
      assert.equal(bytes.readUInt32BE(20), 360);
      assert.ok(frame.camera.position.every(Number.isFinite));
    }
    const manifest = JSON.parse(await fs.readFile(result.manifest, 'utf8'));
    assert.equal(manifest.sourceStateHash, before.stateHash);
    assert.equal(manifest.provenance.documentTransport, 'inline-html');
    assert.equal(manifest.target.model, 'rack');
    assert.equal(manifest.frames[1].camera.projection, 'orthographic');
    const sheet = await fs.readFile(result.contactSheet);
    assert.equal(sheet.readUInt32BE(16), 960);
    assert.equal(sheet.readUInt32BE(20), 784);
    assert.equal((await cli('-p', project, 'inspect')).stateHash, before.stateHash);
    await assert.rejects(
      () => cli('-p', project, 'review', '--out', directory),
      (e: any) => JSON.parse(e.stderr).error.code === 'ALREADY_EXISTS',
    );
    const plan = path.join(root, 'plan.json');
    await fs.writeFile(
      plan,
      JSON.stringify({
        schemaVersion: 1,
        kind: 'review',
        width: 320,
        height: 240,
        contactSheet: false,
        frames: [
          {
            id: 'angle',
            camera: { view: 'orbit', azimuth: 135, elevation: 20, projection: 'orthographic' },
          },
        ],
      }),
    );
    const planned = await cli(
      '-p',
      project,
      'review',
      '--node',
      'rackB',
      '--file',
      plan,
      '--out',
      path.join(root, 'planned'),
    );
    assert.equal(planned.frames.length, 1);
    assert.equal(planned.contactSheet, undefined);
    const orbit = await cli(
      '-p',
      project,
      'review',
      '--model',
      'crate',
      '--turntable',
      '4',
      '--width',
      '256',
      '--height',
      '256',
      '--no-contact-sheet',
      '--out',
      path.join(root, 'orbit'),
    );
    assert.equal(orbit.frames.length, 4);
    assert.equal(new Set(orbit.frames.map((f: any) => JSON.stringify(f.camera.position))).size, 4);
    const shot = await cli(
      '-p',
      project,
      'screenshot',
      '--node',
      'rackB',
      '--view',
      'left',
      '--width',
      '320',
      '--height',
      '240',
      '--out',
      path.join(root, 'left.png'),
    );
    assert.equal(shot.camera.projection, 'orthographic');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test('procedural transforms survive a browser edit and model import dry-run leaves the registry unchanged', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-expression-ui-'));
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.FORGE_CHROMIUM_PATH,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  });
  try {
    await cli('init', root);
    await cli(
      '-p',
      root,
      'model',
      'import',
      '--file',
      'examples/outpost/models/barrel.model.json',
      '--dry-run',
    );
    assert.equal((await cli('-p', root, 'model', 'list')).length, 0);
    await cli('-p', root, 'apply', '--file', 'examples/quick-start.batch.json');
    await cli(
      '-p',
      root,
      'apply',
      '--data',
      JSON.stringify({
        operations: [
          { op: 'setParameter', id: 'offset', value: 3 },
          {
            op: 'patchNode',
            id: 'body',
            patch: {
              transform: { position: [{ $expr: 'mul', args: [{ $param: 'offset' }, 2] }, 0.5, 0] },
            },
          },
        ],
      }),
    );
    const html = path.join(root, 'preview.html');
    await cli('-p', root, 'preview', '--out', html);
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(pathToFileURL(html).href);
    await page.waitForFunction(() => window.forgeReady || window.forgeError);
    assert.equal(await page.evaluate(() => window.forgeError), undefined);
    await page.evaluate(() => window.forgeViewer.select('body'));
    assert.equal(await page.locator('#position-x').inputValue(), '6');
    await page.locator('#node-name').fill('Named crate');
    await page.locator('#node-name').press('Tab');
    assert.equal(await page.locator('#position-x').inputValue(), '6');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});
