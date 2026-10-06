import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { chromium, type Page } from 'playwright';
import { createCli } from '../../src/commands/create-cli.js';
import { Readable } from 'node:stream';
import { validateBytes } from 'gltf-validator';
async function command(cwd: string, ...args: string[]) {
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
  assert.equal(await cli.run(args), 0, stderr);
  return JSON.parse(stdout).data;
}
async function commitInput(page: Page, label: string, value: string) {
  const input = page.getByLabel(label, { exact: true });
  await input.fill(value);
  await input.press('Tab');
}
test(
  'workshop UI adds assets, materials, lights, looks and a rig; bundles and GLB retain edits',
  { timeout: 120000 },
  async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'forge-workshop-'));
    const browser = await chromium.launch({
      executablePath: process.env.FORGE_CHROMIUM_PATH,
      headless: true,
      args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
    });
    try {
      const project = path.join(root, 'project');
      await command(root, 'example', 'create', 'assetStudio', project);
      const html = path.join(root, 'workshop.html');
      await command(root, '-p', project, 'preview', '--out', html);
      const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
      const errors: string[] = [],
        network: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('request', (request) => {
        if (/^https?:/.test(request.url())) network.push(request.url());
      });
      await page.goto(pathToFileURL(html).href);
      await page.waitForFunction(() => window.forgeReady || window.forgeError);
      assert.equal(await page.evaluate(() => window.forgeError), undefined);
      await page.getByRole('tab', { name: /Models/ }).click();
      await page.getByLabel('Category', { exact: true }).selectOption('Primitives');
      await page.getByRole('button', { name: 'Add Capsule', exact: true }).click();
      await page.locator('[data-tool="materials"] summary').click();
      await page.getByLabel('Surface color', { exact: true }).fill('#df8844');
      await page.getByLabel('Shader', { exact: true }).selectOption('unlit');
      await page.getByRole('button', { name: 'Apply material', exact: true }).click();
      let source = await page.evaluate(() => window.forgeViewer.getSource());
      const painted = source.nodes.find((n) => n.id === 'primitiveCapsule');
      assert.equal(painted?.type, 'model');
      if (painted?.type !== 'model') throw new Error('Model missing');
      assert.equal(source.materials[painted.materialOverrides.surface].color, '#df8844');
      await page.getByRole('button', { name: 'Undo', exact: true }).click();
      assert.equal(
        Object.keys((await page.evaluate(() => window.forgeViewer.getSource())).materials).length,
        Object.keys(source.materials).length - 1,
      );
      await page.getByRole('button', { name: 'Redo', exact: true }).click();
      await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
      await page.getByLabel('Surface color', { exact: true }).fill('#3377aa');
      await page.getByRole('button', { name: 'Apply material', exact: true }).click();
      const repainted = await page.evaluate(() => window.forgeViewer.getSource());
      assert.equal(repainted.materials[painted.materialOverrides.surface].color, '#df8844');
      const duplicate = repainted.nodes.find((node) => node.id === 'primitiveCapsule_2');
      assert.ok(duplicate?.type === 'model');
      assert.equal(repainted.materials[duplicate.materialOverrides.surface].color, '#3377aa');
      await page.getByRole('button', { name: 'Undo', exact: true }).click();
      await page.getByRole('button', { name: 'Undo', exact: true }).click();
      await page.locator('[data-tool="rigging"] summary').click();
      await page.getByRole('button', { name: 'Create starter rig', exact: true }).click();
      await page.getByLabel('Joint', { exact: true }).selectOption('upper');
      await commitInput(page, 'Pose Z°', '45');
      await page.getByRole('button', { name: 'Apply joint & bind', exact: true }).click();
      await page.getByRole('button', { name: 'Keyframe selected joint', exact: true }).click();
      await page.getByRole('button', { name: 'Preview at time', exact: true }).click();
      const inspection = await page.evaluate(() =>
        window.forgeViewer.getSource().nodes.find((n) => n.id === 'primitiveCapsule'),
      );
      assert.ok(inspection?.type === 'model' && inspection.rig?.clips.length === 1);
      await page.locator('[data-tool="lights"] summary').click();
      await page.getByLabel('New light type', { exact: true }).selectOption('spot');
      await page.getByRole('button', { name: 'Add light', exact: true }).click();
      await commitInput(page, 'Light intensity', '65');
      await page.getByRole('button', { name: 'Apply light', exact: true }).click();
      await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
      await page.getByRole('button', { name: 'Undo', exact: true }).click();
      await page.locator('[data-tool="environment"] summary').click();
      await commitInput(page, 'Exposure', '1.4');
      await page.getByLabel('Display filter', { exact: true }).selectOption('neutral');
      await page.getByRole('button', { name: 'Apply scene look', exact: true }).click();
      source = await page.evaluate(() => window.forgeViewer.getSource());
      assert.equal(source.environment.exposure, 1.4);
      const glbDownload = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Export GLB', exact: true }).click();
      const glb = path.join(root, 'live.glb');
      await (await glbDownload).saveAs(glb);
      const bytes = await readFile(glb);
      const report = await validateBytes(bytes);
      assert.equal(report.issues.numErrors, 0, JSON.stringify(report.issues));
      const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
      assert.ok(json.skins?.length);
      assert.equal(json.animations?.length, 1);
      assert.ok(json.extensionsUsed.includes('KHR_lights_punctual'));
      assert.ok(json.extensionsUsed.includes('KHR_materials_unlit'));
      const bundleDownload = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Save bundle', exact: true }).click();
      const bundle = path.join(root, 'edited.scene-bundle.json');
      await (await bundleDownload).saveAs(bundle);
      const target = path.join(root, 'restored');
      await command(root, 'scene', 'unpack', target, '--file', bundle);
      const restored = await command(root, '-p', target, 'inspect', '--source');
      assert.deepEqual(restored.source.nodes, source.nodes);
      assert.deepEqual(restored.source.environment, source.environment);
      const inspected = await command(root, '-p', target, 'rig', 'inspect', 'primitiveCapsule');
      assert.equal(inspected.rig.joints.length, 2);
      await command(
        root,
        '-p',
        target,
        'rig',
        'pose',
        'primitiveCapsule',
        '--joint',
        'upper',
        '--rotation',
        '0,0,25',
      );
      await command(
        root,
        '-p',
        target,
        'export',
        '--out',
        path.join(root, 'roundtrip.glb'),
        '--validate',
      );
      // The same scene batch must also persist through the guarded existing-project path.
      const batch = await page.evaluate(() => window.forgeViewer.getEdits());
      await writeFile(path.join(root, 'edits.json'), JSON.stringify(batch));
      await command(root, '-p', project, 'apply', '--file', path.join(root, 'edits.json'));
      const applied = await command(root, '-p', project, 'inspect', '--source');
      assert.deepEqual(applied.source.nodes, source.nodes);
      assert.deepEqual(applied.source.materials, source.materials);
      await page.setViewportSize({ width: 390, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []);
      assert.deepEqual(network, []);
    } finally {
      await browser.close();
      await rm(root, { recursive: true, force: true });
    }
  },
);
test(
  'offline project chooser navigates embedded scenes, including animated examples',
  { timeout: 90000 },
  async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'forge-gallery-'));
    const browser = await chromium.launch({
      executablePath: process.env.FORGE_CHROMIUM_PATH,
      headless: true,
      args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
    });
    try {
      const html = path.join(root, 'gallery.html');
      await command(
        process.cwd(),
        '-p',
        'examples/showcase',
        'preview',
        '--all-scenes',
        '--out',
        html,
      );
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(pathToFileURL(html).href);
      await page.waitForFunction(() => window.forgeReady || window.forgeError);
      assert.equal(await page.evaluate(() => window.forgeError), undefined);
      assert.equal(await page.getByLabel('Example scene').locator('option').count(), 8);
      for (const id of ['courtyard', 'animationLab']) {
        await page.getByLabel('Example scene').selectOption(id);
        await page.waitForFunction(
          (id) => window.forgeReady && window.forgeViewer.getSource().id === id,
          id,
        );
        assert.equal(await page.evaluate(() => window.forgeError), undefined);
      }
      await page.evaluate(() => window.forgeViewer.select('wave'));
      await page.locator('[data-tool="rigging"] summary').click();
      await page.getByLabel('Clip ID').fill('wave');
      // Existing clips are discoverable and can be scrubbed by time.
      await page.getByLabel('Animation time · s').fill('.6');
      await page.getByRole('button', { name: 'Apply joint & bind' }).click();
      await page.getByRole('button', { name: 'Preview at time' }).click();
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await rm(root, { recursive: true, force: true });
    }
  },
);
