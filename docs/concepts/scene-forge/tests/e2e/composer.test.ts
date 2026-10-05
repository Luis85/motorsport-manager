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
test('CLI creates a model, transfers its bundle, composes a scene and spatially arranges instances', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-compose-cli-'));
  try {
    const a = path.join(root, 'author'),
      b = path.join(root, 'level');
    await cli('init', a);
    await cli('-p', a, 'apply', '--file', 'examples/quick-start.batch.json');
    await cli('-p', a, 'node', 'group', 'crate', '--nodes', 'body');
    await cli('-p', a, 'model', 'capture', 'cargo', '--nodes', 'crate', '--name', 'Cargo crate');
    const bundle = path.join(root, 'cargo.models.json');
    await cli('-p', a, 'model', 'export', 'cargo', '--out', bundle);
    await cli('init', b);
    await cli('-p', b, 'model', 'import', '--file', bundle);
    const composition = {
      schemaVersion: 1,
      kind: 'composition',
      scene: 'main',
      groups: [{ id: 'supplies', name: 'Supplies' }],
      instances: [
        { id: 'one', model: 'cargo', parent: 'supplies' },
        { id: 'two', model: 'cargo', parent: 'supplies', transform: { position: [5, 0, 0] } },
      ],
    };
    await cli('-p', b, 'scene', 'compose', '--data', JSON.stringify(composition), '--dry-run');
    assert.equal((await cli('-p', b, 'inspect')).revision, 0);
    const result = await cli('-p', b, 'scene', 'compose', '--data', JSON.stringify(composition));
    const inspected = await cli('-p', b, 'inspect');
    assert.equal(result.stateHash, inspected.stateHash);
    await cli('-p', b, 'node', 'place', 'two', '--to', 'one', '--side', 'right', '--gap', '1');
    await cli('-p', b, 'node', 'ground', 'two');
    await cli('-p', b, 'node', 'duplicate', 'two', 'three', '--offset', '0,0,4');
    await cli('-p', b, 'node', 'reparent', 'three');
    await cli('-p', b, 'scene', 'clone', 'variation');
    assert.equal((await cli('-p', b, '-s', 'variation', 'inspect')).revision, 0);
    const source = await cli('-p', b, 'inspect', '--source');
    assert.equal(source.stats.meshes, 3);
    assert.equal(source.source.nodes.find((n: any) => n.id === 'three').parent, undefined);
    const file = path.join(root, 'composition.glb');
    await cli('-p', b, 'export', '--out', file);
    assert.equal((await validateBytes(await fs.readFile(file))).issues.numErrors, 0);
    const preview = path.join(root, 'model.html');
    await cli('-p', b, 'preview', '--model', 'cargo', '--out', preview);
    assert.match(await fs.readFile(preview, 'utf8'), /"editable":false/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test('offline composer adds models, edits transforms, undoes changes and round-trips a guarded batch', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-composer-ui-'));
  const project = path.join(root, 'project');
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.FORGE_CHROMIUM_PATH,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  });
  try {
    await fs.cp('examples/outpost', project, {
      recursive: true,
      filter: (file) => !['exports', '.forge.lock'].includes(path.basename(file)),
    });
    const html = path.join(root, 'composer.html');
    await cli('-p', project, 'preview', '--out', html);
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(pathToFileURL(html).href);
    await page.waitForFunction(() => window.forgeReady || window.forgeError);
    assert.equal(await page.evaluate(() => window.forgeError), undefined);
    const baseline = await page.evaluate(() => window.forgeViewer.getSource().nodes.length);
    await page.getByRole('tab', { name: /Models/ }).click();
    await page.getByRole('button', { name: 'Add Survey rover', exact: true }).click();
    assert.equal(
      await page.evaluate(() => window.forgeViewer.getSource().nodes.length),
      baseline + 1,
    );
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Alpha rover');
    await page.locator('#node-name').press('Tab');
    await page.getByRole('spinbutton', { name: 'position x', exact: true }).fill('4');
    await page.locator('#position-x').press('Tab');
    await page.getByRole('spinbutton', { name: 'rotation y', exact: true }).fill('45');
    await page.locator('#rotation-y').press('Tab');
    assert.equal(
      await page.evaluate(
        () =>
          window.forgeViewer.getSource().nodes.find((n) => n.id === 'rover')!.transform!
            .position?.[0],
      ),
      4,
    );
    await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
    assert.equal(
      await page.evaluate(() => window.forgeViewer.getSource().nodes.length),
      baseline + 2,
    );
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    assert.equal(
      await page.evaluate(() => window.forgeViewer.getSource().nodes.length),
      baseline + 1,
    );
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    assert.equal(
      await page.evaluate(() => window.forgeViewer.getSource().nodes.length),
      baseline + 2,
    );
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    assert.equal(
      await page.evaluate(() => window.forgeViewer.getSource().nodes.length),
      baseline + 1,
    );
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save edits', exact: true }).click();
    const batchFile = path.join(root, 'edits.json');
    await (await downloadPromise).saveAs(batchFile);
    const batch = JSON.parse(await fs.readFile(batchFile, 'utf8'));
    assert.equal(batch.scene, 'main');
    assert.match(batch.expectedState, /^[a-f0-9]{64}$/);
    assert.equal(batch.operations.length, 1);
    const glbPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export GLB', exact: true }).click();
    const glbFile = path.join(root, 'live.glb');
    await (await glbPromise).saveAs(glbFile);
    const bytes = await fs.readFile(glbFile);
    assert.equal((await validateBytes(bytes)).issues.numErrors, 0);
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    assert.ok(gltf.nodes.some((n: any) => n.name === 'main/rover'));
    await cli('-p', project, 'apply', '--file', batchFile);
    const source = await cli('-p', project, 'inspect', '--source');
    const rover = source.source.nodes.find((n: any) => n.id === 'rover');
    assert.equal(rover.name, 'Alpha rover');
    assert.equal(rover.transform.position[0], 4);
    assert.equal(rover.transform.position[2], 0);
    assert.equal(rover.transform.rotation[1], 45);
    try {
      await cli('-p', project, 'apply', '--file', batchFile);
      assert.fail('Stale batch must fail');
    } catch (error: any) {
      assert.equal(JSON.parse(error.stderr).error.code, 'REVISION_CONFLICT');
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});
test('an empty scene can be composed on mobile and invalid numeric input is recoverable', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-empty-ui-'));
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.FORGE_CHROMIUM_PATH,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  });
  try {
    await cli('init', root);
    await cli('-p', root, 'model', 'import', '--file', 'examples/outpost/models/barrel.model.json');
    const html = path.join(root, 'empty.html');
    await cli('-p', root, 'preview', '--out', html);
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(pathToFileURL(html).href);
    await page.waitForFunction(() => window.forgeReady || window.forgeError);
    assert.equal(await page.evaluate(() => window.forgeError), undefined);
    assert.match((await page.locator('#objects').textContent()) ?? '', /empty/);
    await page.getByRole('tab', { name: /Models/ }).click();
    await page.getByRole('button', { name: 'Add Supply barrel' }).click();
    await page.locator('#scale-x').fill('0');
    await page.locator('#scale-x').press('Tab');
    assert.match((await page.locator('#toast').textContent()) ?? '', /scale cannot be zero/);
    assert.notEqual(await page.locator('#scale-x').inputValue(), '0');
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});
