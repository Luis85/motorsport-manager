import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { ok, withTemp } from '../helpers.js';

// Chromium is required: npx playwright install chromium, or FORGE_CHROMIUM_PATH.
const png = (bytes: Buffer) => ({
  signature: bytes.subarray(1, 4).toString(),
  width: bytes.readUInt32BE(16),
  height: bytes.readUInt32BE(20),
});

test('generate --review renders one lineup frame per document in one session', () =>
  withTemp(async (cwd) => {
    const result = await ok(
      ['generate', 'rock', '--count', '3', '--out', 'rocks', '--review', 'rocks-review'],
      { cwd },
    );
    assert.equal(result.review.frames, 3);
    const manifest = JSON.parse(await fs.readFile(result.review.manifest, 'utf8'));
    assert.equal(manifest.provenance.tool, 'model-forge');
    assert.deepEqual(
      manifest.frames.map((f: { id: string }) => f.id),
      ['rocks-01', 'rocks-02', 'rocks-03'],
    );
    assert.deepEqual(manifest.target.models, ['rocks-01', 'rocks-02', 'rocks-03']);
    assert.deepEqual(
      manifest.target.documents,
      result.documents.map((d: { path: string }) => d.path),
    );
    assert.equal(manifest.target.generator, 'rock');
    assert.equal(new Set(manifest.frames.map((f: { sha256: string }) => f.sha256)).size, 3);
    // Every frame uses a fixed camera, replayable from replay-plan.json.
    const replay = JSON.parse(
      await fs.readFile(`${result.review.directory}/replay-plan.json`, 'utf8'),
    );
    assert.ok(replay.frames.every((f: { camera: { fixed?: unknown } }) => f.camera.fixed));
    assert.equal(png(await fs.readFile(result.review.contactSheet)).signature, 'PNG');

    const single = await ok(
      ['generate', 'building', '--out', 'house.model.json', '--review', 'house-review'],
      { cwd },
    );
    assert.equal(single.review.frames, 4, 'one document gets iso, front, right and top views');
  }));

test('variants --review renders the variants at one common scale', () =>
  withTemp(async (cwd) => {
    await ok(['generate', 'tree', '--preset', 'conifer', '--out', 'fir.model.json'], { cwd });
    const result = await ok(
      [
        '-d',
        'fir.model.json',
        'variants',
        '--count',
        '4',
        '--vary',
        'height=5..12',
        '--out',
        'firs',
        '--review',
      ],
      { cwd },
    );
    assert.equal(result.review.frames, 4);
    const manifest = JSON.parse(await fs.readFile(result.review.manifest, 'utf8'));
    assert.equal(manifest.target.documents.length, 4);
    const cameras = manifest.frames.map((f: { camera: { position: number[]; target: number[] } }) =>
      Math.hypot(...f.camera.position.map((v, i) => v - f.camera.target[i])),
    );
    for (const distance of cameras) assert.ok(Math.abs(distance - cameras[0]) < 1e-6);
    for (const frame of manifest.frames)
      assert.deepEqual(png(await fs.readFile(`${result.review.directory}/${frame.file}`)), {
        signature: 'PNG',
        width: 480,
        height: 360,
      });
  }));
