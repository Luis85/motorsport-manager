import { promises as fs } from 'node:fs';
import type { CommandContext } from './context.js';
import {
  ForgeError,
  loadPlaywright,
  playwrightRemedies,
  type PlaywrightLocation,
} from '../kernel.js';
async function exists(file: string) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}
async function probe(): Promise<PlaywrightLocation | ForgeError> {
  try {
    return await loadPlaywright();
  } catch (error) {
    if (error instanceof ForgeError) return error;
    throw error;
  }
}
export function registerRuntimeCommands(c: CommandContext) {
  const { program, output } = c;
  program
    .command('doctor')
    .description('Check runtime, Playwright and Chromium installation')
    .action(async () => {
      const playwright = await probe();
      if (playwright instanceof ForgeError) {
        const browser = process.env.FORGE_CHROMIUM_PATH;
        return output({
          node: process.version,
          playwright: { installed: false, details: playwright.details },
          chromium: { path: browser ?? null, installed: browser ? await exists(browser) : false },
          screenshotSetup: playwrightRemedies.join(' '),
        });
      }
      const browser =
        process.env.FORGE_CHROMIUM_PATH ?? playwright.module.chromium.executablePath();
      const available = await exists(browser);
      output({
        node: process.version,
        playwright: { installed: true, resolvedFrom: playwright.resolvedFrom },
        chromium: { path: browser, installed: available },
        screenshotSetup: available
          ? 'Run a screenshot to verify OS libraries and WebGL.'
          : 'Run npx playwright install chromium, or npx playwright install --with-deps chromium on Linux.',
      });
    });
}
