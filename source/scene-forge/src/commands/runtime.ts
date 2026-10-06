import { promises as fs } from 'node:fs';
import type { CommandContext } from './context.js';
export function registerRuntimeCommands(c: CommandContext) {
  const { program, output } = c;
  program
    .command('doctor')
    .description('Check runtime and Chromium installation')
    .action(async () => {
      const { chromium } = await import('playwright');
      const browser = process.env.FORGE_CHROMIUM_PATH ?? chromium.executablePath();
      let available = true;
      try {
        await fs.access(browser);
      } catch {
        available = false;
      }
      output({
        node: process.version,
        chromium: { path: browser, installed: available },
        screenshotSetup: available
          ? 'Run a screenshot to verify OS libraries and WebGL.'
          : 'Run npx playwright install chromium, or npx playwright install --with-deps chromium on Linux.',
      });
    });
}
