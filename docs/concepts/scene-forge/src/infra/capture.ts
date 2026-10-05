import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import type { Browser, Page } from 'playwright';
import { fail, errorMessage } from '../domain/errors.js';
import type { CameraRequest } from '../domain/schema.js';

export type CaptureBrowser = Pick<Browser, 'newPage' | 'close' | 'version'>;
export interface CaptureDependencies {
  createTemp(): Promise<string>;
  launch(): Promise<CaptureBrowser>;
}
const dependencies: CaptureDependencies = {
  createTemp: () => fs.mkdtemp(path.join(os.tmpdir(), 'forge-capture-')),
  async launch() {
    const { chromium } = await import('playwright');
    return chromium.launch({
      headless: true,
      executablePath: process.env.FORGE_CHROMIUM_PATH,
      args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
    });
  },
};
export interface CaptureSession {
  temp: string;
  browser: CaptureBrowser;
  page: Page;
  capture(
    request: CameraRequest,
    grid: boolean,
    wireframe?: boolean,
  ): Promise<{
    bytes: Buffer;
    camera: import('../domain/schema.js').CameraSnapshot;
  }>;
}
/** A capture owns exactly one browser and workspace. Cleanup also runs on partial initialization. */
export async function withCaptureSession<T>(
  html: string,
  options: { width: number; height: number; ui?: boolean },
  action: (session: CaptureSession) => Promise<T>,
  ports: CaptureDependencies = dependencies,
): Promise<T> {
  const temp = await ports.createTemp();
  let browser: CaptureBrowser | undefined;
  let failed = false;
  try {
    const file = path.join(temp, 'scene.html');
    await fs.writeFile(file, html);
    try {
      browser = await ports.launch();
    } catch (error) {
      fail(
        'BROWSER_UNAVAILABLE',
        'Screenshot capture needs Chromium. Run npx playwright install chromium (or install --with-deps chromium on Linux), or set FORGE_CHROMIUM_PATH.',
        { reason: errorMessage(error) },
      );
    }
    const page = await browser.newPage({
      viewport: { width: options.width, height: options.height },
      deviceScaleFactor: 1,
    });
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    const assertRendered = async () => {
      const error = await page.evaluate(() => window.forgeError);
      if (error || pageErrors.length)
        fail('RENDER_FAILED', 'Scene preview failed to render.', { error, pageErrors });
    };
    await page.goto(pathToFileURL(file).href + (options.ui ? '' : '?capture=1'));
    await page.waitForFunction(
      () => window.forgeReady || window.forgeError,
      {},
      { timeout: 30000 },
    );
    await assertRendered();
    return await action({
      temp,
      browser,
      page,
      async capture(request, grid, wireframe = false) {
        const camera = await page.evaluate(
          async ({ request, grid, wireframe }) => {
            const viewer = window.forgeViewer;
            viewer.clearSelection();
            viewer.configureCapture(request, wireframe);
            viewer.setGrid(grid);
            await new Promise<void>((resolve) =>
              requestAnimationFrame(() => {
                viewer.render();
                resolve();
              }),
            );
            return viewer.getCamera();
          },
          { request, grid, wireframe },
        );
        await assertRendered();
        const bytes = await page.screenshot({ type: 'png' });
        await assertRendered();
        return { bytes, camera };
      },
    });
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    try {
      await browser?.close();
    } catch (error) {
      if (!failed) throw error;
    } finally {
      await fs.rm(temp, { recursive: true, force: true });
    }
  }
}
