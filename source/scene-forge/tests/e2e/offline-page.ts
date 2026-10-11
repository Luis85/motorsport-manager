import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import type { Page } from 'playwright';

/** Normal Chromium/CI exercises real file navigation. Managed environments which forbid
 * file URLs can explicitly set FORGE_TEST_INLINE_HTML=1 to exercise the exact generated
 * self-contained HTML. No rendering, edit, download or zero-network assertion is skipped. */
export async function loadOfflinePage(
  page: Page,
  file: string,
  options: { navigable?: boolean } = {},
) {
  if (process.env.FORGE_TEST_INLINE_HTML !== '1') {
    await page.goto(pathToFileURL(file).href);
    return;
  }
  const html = await readFile(file, 'utf8');
  if (options.navigable) {
    // The embedded scene chooser navigates ?scene=. Intercept this explicit test origin
    // entirely in Playwright: no server, DNS lookup or network content supplies the page.
    const origin = 'http://forge-preview.invalid';
    await page.route(`${origin}/**`, async (route) => {
      if (!route.request().isNavigationRequest()) return route.abort();
      await route.fulfill({ status: 200, contentType: 'text/html', body: html });
    });
    await page.goto(`${origin}/preview.html`);
  } else await page.setContent(html, { waitUntil: 'load' });
}
