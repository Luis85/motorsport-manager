import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { initProject, loadProject } from '../../src/infra/project.js';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import { parse, SceneSchema } from '../../src/kernel.js';
import { createPreview } from '../../src/infra/preview.js';

test(
  'portrait studio and physical materials remain editable, undoable and portable on desktop/mobile',
  { timeout: 90000 },
  async () => {
    const scene = parse(SceneSchema, {
      schemaVersion: 1,
      kind: 'scene',
      id: 'main',
      name: 'Portrait material study',
      materials: { coat: { color: '#bc8151', roughness: 0.8 } },
      geometries: {
        body: {
          type: 'organic',
          size: [0.9, 1.1, 0.72],
          roundness: 0.9,
          taper: 0.22,
          segments: 32,
        },
      },
      nodes: [
        {
          type: 'mesh',
          id: 'body',
          geometry: 'body',
          material: 'coat',
          transform: { position: [0, 0.65, 0] },
        },
      ],
    });
    const root = await mkdtemp(path.join(tmpdir(), 'forge-surface-browser-'));
    await initProject(root);
    await writeFile(path.join(root, 'scenes/main.scene.json'), JSON.stringify(scene));
    const initial = await loadProject(root);
    const html = await createPreview(scene, {}, { stateHash: initial.stateHash });
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end(html);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({
      executablePath: process.env.FORGE_CHROMIUM_PATH,
      headless: true,
      args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
    });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${(server.address() as { port: number }).port}`);
      await page.waitForFunction(() => window.forgeReady || window.forgeError);
      assert.equal(await page.evaluate(() => window.forgeError), undefined);
      await page.evaluate(() => window.forgeViewer.select('body'));
      await page.locator('[data-tool="materials"] summary').click();
      await page.getByLabel('Sheen amount', { exact: true }).fill('0.75');
      await page.getByLabel('Sheen color', { exact: true }).fill('#ffe3bc');
      await page.getByLabel('Clearcoat amount', { exact: true }).fill('0.2');
      await page.getByLabel('Surface detail', { exact: true }).selectOption('fur');
      await page.getByLabel('Detail style', { exact: true }).selectOption('2');
      await page.getByLabel('Detail seed', { exact: true }).fill('7');
      await page.getByLabel('Detail repeat', { exact: true }).fill('3');
      await page.getByLabel('Detail strength', { exact: true }).fill('0.4');
      await page.getByRole('button', { name: 'Apply material', exact: true }).click();
      const painted = await page.evaluate(() => window.forgeViewer.getSource());
      const node = painted.nodes[0];
      assert.ok(node.type === 'mesh');
      assert.equal(painted.materials[node.material].sheen, 0.75);
      assert.equal(painted.materials[node.material].clearcoat, 0.2);
      assert.deepEqual(painted.materials[node.material].surface, {
        kind: 'fur',
        version: 2,
        seed: 7,
        scale: 3,
        strength: 0.4,
      });
      await page.evaluate(() => window.forgeViewer.undo());
      const undoSource = await page.evaluate(() => window.forgeViewer.getSource());
      const undoNode = undoSource.nodes[0];
      assert.ok(undoNode.type === 'mesh');
      assert.equal(undoSource.materials[undoNode.material].surface, undefined);
      await page.evaluate(() => window.forgeViewer.redo());
      assert.deepEqual(await page.evaluate(() => window.forgeViewer.getSource()), painted);
      await page.locator('[data-tool="environment"] summary').click();
      await page.getByRole('button', { name: 'Use portrait studio', exact: true }).click();
      const portrait = await page.evaluate(() => window.forgeViewer.getSource());
      assert.equal(portrait.environment.presentation, 'portrait');
      assert.deepEqual(portrait.nodes, painted.nodes);
      assert.deepEqual(portrait.geometries, painted.geometries);
      if (process.env.FORGE_FIDELITY_SCREENSHOTS)
        await page.screenshot({
          path: `${process.env.FORGE_FIDELITY_SCREENSHOTS}/scene-fidelity-desktop.png`,
        });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByLabel('Light rig', { exact: true }).selectOption('inspection');
      await page.getByRole('button', { name: 'Apply scene look', exact: true }).click();
      assert.equal(
        (await page.evaluate(() => window.forgeViewer.getSource())).environment.presentation,
        'inspection',
      );
      await page.evaluate(() => window.forgeViewer.undo());
      assert.equal(
        (await page.evaluate(() => window.forgeViewer.getSource())).environment.presentation,
        'portrait',
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      if (process.env.FORGE_FIDELITY_SCREENSHOTS)
        await page.screenshot({
          path: `${process.env.FORGE_FIDELITY_SCREENSHOTS}/scene-fidelity-mobile.png`,
        });
      const edits = (await page.evaluate(() => window.forgeViewer.getEdits())) as {
        operations: { op: string }[];
      };
      assert.ok(edits.operations.some((operation) => operation.op === 'putMaterial'));
      assert.ok(edits.operations.some((operation) => operation.op === 'setEnvironment'));
      const batch = path.join(root, 'surface-edits.json');
      await writeFile(batch, JSON.stringify(edits));
      const cli = fileURLToPath(new URL('../../../../bin/scene-forge', import.meta.url));
      const invoke = (...args: string[]) =>
        JSON.parse(
          execFileSync(process.execPath, [cli, '-p', root, ...args], { encoding: 'utf8' }),
        );
      const dry = invoke('apply', '--file', batch, '--dry-run');
      assert.equal(dry.ok, true);
      assert.equal((await loadProject(root)).stateHash, initial.stateHash);
      const applied = invoke('apply', '--file', batch);
      assert.equal(applied.ok, true);
      assert.equal(applied.data.stateHash, dry.data.proposedStateHash);
      const saved = (await loadProject(root)).scene;
      const savedNode = saved.nodes[0];
      assert.ok(savedNode.type === 'mesh');
      assert.deepEqual(saved.materials[savedNode.material].surface, {
        kind: 'fur',
        version: 2,
        seed: 7,
        scale: 3,
        strength: 0.4,
      });
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await rm(root, { recursive: true, force: true });
    }
  },
);
