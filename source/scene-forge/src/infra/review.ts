import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { REVISION } from 'three';
import {
  parse,
  fail,
  ReviewPlanSchema,
  SceneSchema,
  type ReviewPlan,
  type SceneDocument,
  type ModelLibrary,
} from '../domain/schema.js';
import { createPreview } from './preview.js';
import { atomicWrite, writeJson } from './files.js';
import { stateHash } from './state-hash.js';
import { withCaptureSession } from './capture.js';
import { VERSION } from '../version.js';
import { errorCode } from '../domain/errors.js';

export async function reviewScene(
  scene: SceneDocument,
  models: ModelLibrary,
  output: string,
  input: ReviewPlan,
  options: { overwrite?: boolean; sourceStateHash?: string; target?: unknown } = {},
) {
  scene = parse(SceneSchema, scene);
  const originalStateHash = stateHash(scene, models);
  const plan = parse(ReviewPlanSchema, input);
  if (plan.background)
    scene = { ...scene, environment: { ...scene.environment, background: plan.background } };
  const ids = plan.frames.map((f) => f.id);
  if (new Set(ids).size !== ids.length || (plan.contactSheet && ids.includes('contact-sheet')))
    fail('DUPLICATE_ID', 'Review frame IDs must be unique; contact-sheet is reserved.');
  if (plan.frames.some((f) => f.camera.view === 'authored' && !f.camera.fixed) && !scene.camera)
    fail('INVALID_CAMERA', 'No authored camera is defined. Use setCamera or another view.');
  const destination = path.resolve(output);
  const exists = await fs.readdir(destination).catch((error: unknown) => {
    if (errorCode(error) === 'ENOENT') return [];
    throw error;
  });
  if (exists.length && !options.overwrite)
    fail(
      'ALREADY_EXISTS',
      'Review directory is not empty. Choose a new directory or pass --overwrite.',
    );
  const started = Date.now();
  const html = await createPreview(scene, models, {
    editable: false,
    includeLibrary: false,
    stateHash: options.sourceStateHash,
  });
  return withCaptureSession(html, plan, async ({ temp, browser, page, capture }) => {
    const stats = await page.evaluate(() => window.forgeViewer.stats);
    const frames = [];
    for (const frame of plan.frames) {
      const { bytes, camera } = await capture(frame.camera, plan.grid, plan.wireframe);
      await fs.writeFile(path.join(temp, `${frame.id}.png`), bytes);
      frames.push({
        id: frame.id,
        file: `${frame.id}.png`,
        width: plan.width,
        height: plan.height,
        camera,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        bytes: bytes.length,
      });
    }
    let contactSheet: { file: string; width: number; height: number } | undefined;
    if (plan.contactSheet) {
      const images = await Promise.all(
        frames.map(async (f) => ({
          id: f.id,
          url:
            'data:image/png;base64,' +
            (await fs.readFile(path.join(temp, f.file))).toString('base64'),
        })),
      );
      const result = await page.evaluate(
        async ({ images, width, height }) => {
          const scale = Math.min(1, 640 / width, 480 / height),
            cellWidth = Math.max(1, Math.round(width * scale)),
            cellHeight = Math.max(1, Math.round(height * scale)),
            columns = Math.min(3, Math.ceil(Math.sqrt(images.length))),
            rows = Math.ceil(images.length / columns),
            label = 32;
          const canvas = document.createElement('canvas');
          canvas.width = columns * cellWidth;
          canvas.height = rows * (cellHeight + label);
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = '#171d25';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          for (const [i, frame] of images.entries()) {
            const image = new Image();
            image.src = frame.url;
            await image.decode();
            const x = (i % columns) * cellWidth,
              y = Math.floor(i / columns) * (cellHeight + label);
            ctx.drawImage(image, x, y + label, cellWidth, cellHeight);
            ctx.fillStyle = '#edf2f7';
            ctx.font = '14px sans-serif';
            ctx.fillText(frame.id, x + 12, y + 22, Math.max(1, cellWidth - 24));
          }
          return { url: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
        },
        { images, width: plan.width, height: plan.height },
      );
      await fs.writeFile(
        path.join(temp, 'contact-sheet.png'),
        Buffer.from(result.url.split(',')[1], 'base64'),
      );
      contactSheet = { file: 'contact-sheet.png', width: result.width, height: result.height };
    }
    const manifest = {
      schemaVersion: 1,
      kind: 'review-result',
      provenance: {
        tool: 'scene-forge',
        version: VERSION,
        three: REVISION,
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        chromium: browser.version(),
        rendererRequested: 'ANGLE SwiftShader',
      },
      scene: scene.id,
      revision: scene.revision,
      sourceStateHash: options.sourceStateHash ?? originalStateHash,
      renderStateHash: stateHash(scene, models),
      target: options.target ?? { scene: scene.id },
      plan,
      stats,
      frames,
      contactSheet,
      replayPlan: 'replay-plan.json',
      durationMs: Date.now() - started,
    };
    const replay = parse(ReviewPlanSchema, {
      ...plan,
      background: scene.environment.background,
      frames: frames.map((f) => ({ id: f.id, camera: { fixed: f.camera } })),
    });
    await fs.mkdir(destination, { recursive: true });
    for (const name of [...frames.map((f) => f.file), ...(contactSheet ? [contactSheet.file] : [])])
      await atomicWrite(path.join(destination, name), await fs.readFile(path.join(temp, name)));
    await writeJson(path.join(destination, 'replay-plan.json'), replay);
    await writeJson(path.join(destination, 'review.json'), manifest);
    return {
      directory: destination,
      manifest: path.join(destination, 'review.json'),
      replayPlan: path.join(destination, 'replay-plan.json'),
      contactSheet: contactSheet ? path.join(destination, contactSheet.file) : undefined,
      frames: frames.map((f) => ({ ...f, path: path.join(destination, f.file) })),
      stats,
      durationMs: manifest.durationMs,
      sourceStateHash: manifest.sourceStateHash,
    };
  });
}
