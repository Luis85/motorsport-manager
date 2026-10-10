import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadPlaywright, playwrightEnvironment } from '../../src/kernel/index.js';
import { failure, ok, withTemp } from '../helpers.js';

// Chromium is required: npx playwright install chromium, or FORGE_CHROMIUM_PATH.
const png = (bytes: Buffer) => ({
  signature: bytes.subarray(1, 4).toString(),
  width: bytes.readUInt32BE(16),
  height: bytes.readUInt32BE(20),
});

/** Deep equality with a relative tolerance for orbit-control floating-point round trips. */
function close(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number')
    return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every((k) => close((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
    );
  }
  return a === b;
}

test('review renders parameter variants with Model Forge provenance and replays fixed cameras', () =>
  withTemp(async (cwd) => {
    await ok(['example', 'create', 'rover', 'rover.model.json'], { cwd });
    const doc = ['-d', 'rover.model.json'];
    const inspected = await ok([...doc, 'inspect'], { cwd });
    const result = await ok(
      [
        ...doc,
        'review',
        '--out',
        'views',
        '--views',
        'iso,front,top',
        '--width',
        '320',
        '--height',
        '240',
        '--parameters',
        '{"mastHeight":2}',
      ],
      { cwd },
    );
    assert.equal(result.frames.length, 3);
    assert.equal(new Set(result.frames.map((f: { sha256: string }) => f.sha256)).size, 3);
    for (const frame of result.frames)
      assert.deepEqual(png(await fs.readFile(frame.path)), {
        signature: 'PNG',
        width: 320,
        height: 240,
      });
    const manifest = JSON.parse(await fs.readFile(result.manifest, 'utf8'));
    assert.equal(manifest.kind, 'review-result');
    assert.equal(manifest.provenance.tool, 'model-forge');
    assert.equal(manifest.sourceStateHash, inspected.stateHash);
    assert.deepEqual(manifest.target, {
      document: path.join(cwd, 'rover.model.json'),
      model: 'rover',
      revision: 0,
      parameters: { mastHeight: 2 },
    });
    assert.ok(manifest.stats.triangles > 0);
    assert.equal(png(await fs.readFile(result.contactSheet)).signature, 'PNG');

    const replay = await ok(
      [
        ...doc,
        'review',
        '--out',
        'replay',
        '--file',
        path.join(cwd, 'views/replay-plan.json'),
        '--parameters',
        '{"mastHeight":2}',
      ],
      { cwd },
    );
    assert.ok(
      close(
        replay.frames.map((f: { camera: unknown }) => f.camera),
        result.frames.map((f: { camera: unknown }) => f.camera),
      ),
      'a replay plan holds cameras fixed',
    );
    assert.equal(
      (await failure([...doc, 'review', '--out', 'views'], { cwd })).code,
      'ALREADY_EXISTS',
    );
    assert.equal(
      (
        await failure(
          [...doc, 'review', '--out', 'x', '--file', 'views/replay-plan.json', '--width', '100'],
          { cwd },
        )
      ).code,
      'INVALID_OPTION',
    );
  }));

test('nested bundles render as turntables and the read-only preview boots in Chromium', () =>
  withTemp(async (cwd) => {
    await ok(['example', 'create', 'fieldStation', 'station.model-bundle.json'], { cwd });
    const doc = ['-d', 'station.model-bundle.json'];
    const result = await ok(
      [
        ...doc,
        'review',
        '--out',
        'orbit',
        '--turntable',
        '4',
        '--width',
        '256',
        '--height',
        '192',
        '--no-contact-sheet',
        '--background',
        '#203040',
      ],
      { cwd },
    );
    assert.deepEqual(
      result.frames.map((f: { id: string }) => f.id),
      ['orbit-00', 'orbit-01', 'orbit-02', 'orbit-03'],
    );
    assert.equal(result.contactSheet, undefined);
    const preview = await ok([...doc, 'preview', '--out', 'station.html'], { cwd });
    assert.equal(preview.readOnly, true);
    const html = await fs.readFile(path.join(cwd, 'station.html'), 'utf8');
    assert.doesNotMatch(html, /<(script|link|img)[^>]+(src|href)=/i, 'the page loads no resources');
    const { chromium } = (await loadPlaywright(playwrightEnvironment('source/model-forge'))).module;
    const browser = await chromium.launch({
      headless: true,
      executablePath: process.env.FORGE_CHROMIUM_PATH,
      args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
    });
    try {
      const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setContent(html, { waitUntil: 'load' });
      await page.waitForFunction(() => {
        const host = window as unknown as { forgeReady?: boolean; forgeError?: string };
        return host.forgeReady || host.forgeError;
      });
      const state = await page.evaluate(() => {
        const host = window as unknown as {
          forgeError?: string;
          forgeViewer: { stats: { triangles: number }; getCamera(): { projection: string } };
        };
        return {
          error: host.forgeError,
          triangles: host.forgeViewer.stats.triangles,
          projection: host.forgeViewer.getCamera().projection,
          title: document.getElementById('title')?.textContent,
        };
      });
      assert.deepEqual(errors, []);
      assert.equal(state.error, undefined);
      assert.ok(state.triangles > 0);
      assert.equal(state.projection, 'perspective');
      assert.match(state.title ?? '', /Complete field station/);
    } finally {
      await browser.close();
    }
  }));
