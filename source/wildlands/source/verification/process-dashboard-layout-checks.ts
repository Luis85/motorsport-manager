/// <reference path="../process-contracts.d.ts" />
/**
 * Dashboard layout checks from the visual review, called from `process-dashboard-browser.ts`. On a customer journey run for a day
 * (its authored-feeling table is shown openly, and more than 200 finished customers prune the recent-case chart) with every data
 * table opened, at 1440 x 1060 and 390 x 844: no panel is wider than its column and nothing scrolls sideways (wide tables scroll in
 * their own region), the recent cases spread over their chart instead of pressing against its right edge, a section heading sits
 * nearer its own panels than the section above, and the download button keeps its own width.
 */
import assert from 'node:assert/strict';
import type {Page} from 'playwright';
import {nextFrames} from './browser-harness';
import type {Studio} from './process-browser-fixture';
import type {DashboardHelpers} from './process-dashboard-wire-checks';

/** Panels wider than their column, the dashboard and page overflow, the spread of the recent points and the section spacing. */
const facts = (page: Page) => page.evaluate(() => {
 const dash = document.getElementById('dashboard')!, region = dash.querySelector('.process-dashboard')!;
 const wide = [...dash.querySelectorAll<HTMLElement>('.db-panel, .db-whatif, .db-data')].filter(p => p.scrollWidth > p.clientWidth + 1)
  .map(p => `${p.dataset.panel ?? p.className} ${p.scrollWidth}>${p.clientWidth}`);
 const svg = dash.querySelector('[data-panel="recent"] svg.db-chart'), dots = [...dash.querySelectorAll('[data-panel="recent"] .db-glyph.point')];
 const xs = dots.map(d => d.getBoundingClientRect().left), plot = svg ? svg.getBoundingClientRect().width : 1;
 const sections = [...region.querySelectorAll<HTMLElement>(':scope > [data-part="sections"] > .db-section')];
 const spacing = sections.slice(1).map((s, i) => {
  const heading = s.querySelector('h2')!.getBoundingClientRect(), first = s.querySelector('.db-panel')!.getBoundingClientRect();
  return {above: Math.round(heading.top - sections[i]!.getBoundingClientRect().bottom), below: Math.round(first.top - heading.bottom)};
 });
 const data = dash.querySelector<HTMLElement>('.db-data')!, button = data.querySelector<HTMLElement>('[data-csv]')!;
 return {wide, dashboard: dash.scrollWidth <= dash.clientWidth + 1, page: document.documentElement.scrollWidth <= innerWidth,
  spread: dots.length ? (Math.max(...xs) - Math.min(...xs)) / plot : 0, dots: dots.length, spacing,
  button: button.getBoundingClientRect().width / data.getBoundingClientRect().width};
});

/** Registers the layout checks on the suite's page. */
export async function layoutChecks(studio: Studio, h: DashboardHelpers): Promise<void> {
 const {page, check, freshStudio, switchTo} = studio;
 await check('Opened data tables scroll inside their panels, recent cases spread over their chart and headings sit by their panels at 1440 and 390 px',
  async () => {
   await freshStudio();
   await switchTo(3);
   await h.openDashboard(page);
   await page.locator('#horizon').selectOption('1440');
   await page.locator('#run-end').click();
   await page.waitForFunction(() => (globalThis as any).LWProcessStudio.query().snapshot.minute === 1440);
   await page.locator('#dashboard [data-panel="feeling"] .db-table.open').waitFor();
   for (const [width, height] of [[1440, 1060], [390, 844]] as const) {
    await page.setViewportSize({width, height});
    await nextFrames(page, 3);
    await page.locator('#dashboard details.db-table:not([open]) > summary').evaluateAll(list => list.forEach(s => (s as HTMLElement).click()));
    await page.waitForFunction(() => !document.querySelector('#dashboard details.db-table:not([open])'));
    await nextFrames(page, 3);
    const f = await facts(page), at = `${width}x${height}`;
    assert.deepEqual([f.wide, f.dashboard, f.page], [[], true, true], at + ': no panel or page overflow with every data table open');
    assert(f.dots > 200 / 2 && f.spread > .5, `${at}: ${f.dots} recent cases spread over ${Math.round(f.spread * 100)}% of the chart`);
    for (const s of f.spacing) assert(s.above > s.below, `${at}: a heading sits nearer its own panels ${JSON.stringify(f.spacing)}`);
    if (width > 650) assert(f.button < .5, `${at}: the download button keeps its own width (${f.button})`);
   }
  });
}
