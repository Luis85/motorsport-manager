/// <reference path="../process-contracts.d.ts" />
/**
 * Dashboard phone checks, called from `process-dashboard-browser.ts`: where the dashboard scrolls with the page, the studio's run
 * bar sticks over it. After a run to the end, Tab and Shift+Tab walk every focus stop of the dashboard, and every section and panel
 * heading is scrolled into view, at 390 x 844 and 320 x 640, at a 24 px root font and in DejaVu Sans (hosted CI has no Inter). At
 * each stop the focused element (or heading) must lie below the bar and `elementFromPoint` at its top edge must not hit the bar;
 * the bar must still stick to the top of the page, and nothing may overflow sideways.
 */
import assert from 'node:assert/strict';
import type {Page} from 'playwright';
import {nextFrames} from './browser-harness';
import type {Studio} from './process-browser-fixture';
import type {DashboardHelpers} from './process-dashboard-wire-checks';

/** The phone layouts: viewport and an extra style (root font, font family). */
const LAYOUTS = [
 {width: 390, height: 844, css: '', label: '390x844'},
 {width: 320, height: 640, css: '', label: '320x640'},
 {width: 390, height: 844, css: 'html{font-size:24px}', label: '390x844 at a 24 px root font'},
 {width: 390, height: 844, css: '*{font-family:"DejaVu Sans",sans-serif !important}', label: '390x844 in DejaVu Sans'},
] as const;
/**
 * Where an element sits against the sticky run bar: covered when it starts above the bar's bottom or the bar is hit at its top. A
 * focused chart mark also reports the top of the tooltip it shows (`tip`), which must open below the bar too.
 */
type Cover = {name: string; top: number; bar: number; hit: string | null; tip: number | null};
const coverOf = (el: Element): Cover => {
 const tip = el.hasAttribute('data-tip') ? document.querySelector<HTMLElement>('#dashboard .db-tip') : null;
 const bar = document.querySelector('.process-toolbar')!.getBoundingClientRect(), box = el.getBoundingClientRect();
 const x = Math.min(Math.max(box.left + Math.min(box.width / 2, 12), 1), innerWidth - 1), y = box.top + Math.min(box.height / 2, 4);
 const hit = y >= 0 && y < innerHeight ? document.elementFromPoint(x, y) : null;
 const label = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 50);
 const name = `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} "${label}"`;
 return {name, top: Math.round(box.top), bar: Math.round(bar.bottom), hit: hit ? hit.closest('.process-toolbar') ? 'run bar' : 'clear' : null,
  tip: tip && !tip.hidden ? Math.round(tip.getBoundingClientRect().top) : null};
};
const covered = (c: Cover) => c.top < c.bar || c.hit !== 'clear' || c.tip !== null && c.tip < c.bar;
/** The focused element against the bar, or null once focus has left the dashboard. */
const focusCover = (page: Page) => page.evaluate(`(() => {
 const a = document.activeElement;
 return a && a.closest('#dashboard') ? (${coverOf.toString()})(a) : null;
})()`) as Promise<Cover | null>;
/** Walks focus through the dashboard with `key` from where it is now; returns the number of stops and the covered ones. */
async function walk(page: Page, key: 'Tab' | 'Shift+Tab'): Promise<{stops: number; hidden: Cover[]}> {
 const hidden: Cover[] = [];
 let stops = 0;
 for (; stops < 400; stops++) {
  await page.keyboard.press(key);
  const c = await focusCover(page);
  if (!c) break;
  if (covered(c)) hidden.push(c);
 }
 return {stops, hidden};
}
/** Scrolls every section and panel heading to the top of the page in turn; returns the covered ones. */
const headingCovers = (page: Page) => page.evaluate(`[...document.querySelectorAll('#dashboard h2, #dashboard h3')]
 .filter(h => h.getClientRects().length).map(h => { h.scrollIntoView({block: 'start'}); return (${coverOf.toString()})(h); })`) as Promise<Cover[]>;

/** Registers the phone checks on the suite's page. */
export async function phoneChecks(studio: Studio, h: DashboardHelpers): Promise<void> {
 const {page, check, freshStudio} = studio;
 await check('On a phone no dashboard focus stop or scrolled-to heading hides under the sticky run bar, also at 24 px and in DejaVu Sans',
  async () => {
   await page.setViewportSize({width: 390, height: 844});
   await freshStudio();
   await page.locator('#more-menu').click();
   await page.locator('#dashboard-item').click();
   await page.locator('#dashboard .db-tiles').waitFor();
   await page.locator('#run-options-toggle').click();
   await page.locator('#run-end').click();
   await page.waitForFunction(() => (globalThis as any).LWProcessStudio.query().snapshot.status !== 'running');
   await page.locator('#run-options-toggle').click();
   const style = await page.addStyleTag({content: '/* phone layout */'});
   try {
    for (const layout of LAYOUTS) {
     await style.evaluate((node, css) => { node.textContent = css; }, layout.css);
     await page.setViewportSize({width: layout.width, height: layout.height});
     await nextFrames(page, 3);
     // The published offset follows the bar's measured size; the page keeps it as scroll padding while the dashboard is shown.
     await page.waitForFunction(() => {
      const bar = document.querySelector<HTMLElement>('.process-toolbar')!;
      return document.documentElement.style.getPropertyValue('--db-sticky-top') === `${Math.ceil(bar.getBoundingClientRect().height)}px`;
     });
     await page.locator('#dashboard .process-dashboard').focus();
     const forward = await walk(page, 'Tab');
     assert(forward.stops > 40, `${layout.label}: Tab walks the dashboard (${forward.stops} stops)`);
     assert.deepEqual(forward.hidden, [], `${layout.label}: Tab`);
     await page.evaluate(() => scrollTo(0, document.scrollingElement!.scrollHeight));
     await page.locator('#dashboard [data-csv]').focus();
     const backward = await walk(page, 'Shift+Tab');
     assert(backward.stops > 40, `${layout.label}: Shift+Tab walks the dashboard (${backward.stops} stops)`);
     assert.deepEqual(backward.hidden, [], `${layout.label}: Shift+Tab`);
     const heads = await headingCovers(page);
     assert(heads.length >= 20, `${layout.label}: headings ${heads.length}`);
     assert.deepEqual(heads.filter(covered), [], `${layout.label}: headings scrolled into view`);
     const bar = await page.evaluate(() => {
      const el = document.querySelector('.process-toolbar')!;
      return {position: getComputedStyle(el).position, top: Math.round(el.getBoundingClientRect().top), scrolled: scrollY > 0};
     });
     assert.deepEqual(bar, {position: 'sticky', top: 0, scrolled: true}, `${layout.label}: the run bar still sticks to the top`);
     assert.deepEqual(await h.layout(page), {page: true, dashboard: true, wide: 0}, layout.label);
    }
   } finally {
    await style.evaluate(node => (node as Element).remove());
   }
  });
}
