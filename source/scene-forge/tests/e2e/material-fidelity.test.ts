import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import { parse, SceneSchema } from '../../src/domain/schema.js';
import { createPreview } from '../../src/infra/preview.js';

test(
  'portrait studio and physical materials remain editable, undoable and portable on desktop/mobile',
  { timeout: 90000 },
  async () => {
    const scene = parse(SceneSchema, {
      schemaVersion: 1,
      kind: 'scene',
      id: 'portrait',
      name: 'Portrait material study',
      materials: { coat: { color: '#bc8151', roughness: 0.8 } },
      geometries: { body: { type: 'sphere', radius: 0.65, segments: 32 } },
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
    const html = await createPreview(scene, {}, { stateHash: 'fidelity-source' });
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
      await page.getByRole('button', { name: 'Apply material', exact: true }).click();
      const painted = await page.evaluate(() => window.forgeViewer.getSource());
      const node = painted.nodes[0];
      assert.ok(node.type === 'mesh');
      assert.equal(painted.materials[node.material].sheen, 0.75);
      assert.equal(painted.materials[node.material].clearcoat, 0.2);
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
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  },
);
