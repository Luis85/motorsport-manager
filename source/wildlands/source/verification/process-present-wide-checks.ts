/// <reference path="../process-contracts.d.ts" />
/**
 * Present **Wide text** checks (PR-11), run by `process-present-screen-browser.ts`: the reader's choice of a wider slide column
 * gives long slide text most of a 1440 x 900 or 1920 x 1080 window while the map keeps a usable share, and Present keeps every
 * label whole without horizontal overflow at 1366 x 768, 1440 x 1060 and 390 x 844 (where the control is hidden because slide and
 * map stack), in the default font and in DejaVu Sans (what hosted CI renders, asserted through the platform fonts so the check
 * cannot pass without it), and at a 24 px root font. Waits are rendered frames after each resize or key.
 */
import assert from 'node:assert/strict';
import {nextFrames} from './browser-harness';
import {query, type Studio} from './process-browser-fixture';
import {renderedFamilies} from './process-map-probe';

const DEJAVU = '*{font-family:"DejaVu Sans",sans-serif !important}';
/** Side-by-side windows where Wide text applies, and the sizes every layout is checked at. */
const WIDE_SIZES = [[1440, 900], [1920, 1080]] as const;
const FIT_SIZES = [[1366, 768], [1440, 1060], [390, 844]] as const;

/** Registers the Wide text and layout checks on the suite's page. */
export async function presentWideChecks(studio: Studio): Promise<void> {
 const {page, check, freshStudio} = studio;
 const shown = page.locator('dialog#present[open]'), wide = page.locator('#present-wide');
 const openPresent = async () => { await page.locator('#mode-present').click(); await shown.waitFor(); };
 /** Column widths, overflow, clipped text and whether Previous, Next and the header controls are whole and on screen. */
 const layout = () => page.evaluate(() => {
  const d = document.getElementById('present')!, box = (s: string) => document.querySelector(s)!.getBoundingClientRect();
  const onScreen = (b: DOMRect) => b.width > 0 && b.left >= -1 && b.right <= innerWidth + 1 && b.top >= -1 && b.bottom <= innerHeight + 1;
  const text = [...d.querySelectorAll<HTMLElement>('h2,h3,p,li,button,span')].filter(e => e.getClientRects().length > 0 && !e.closest('#map'));
  const clipped = text.filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).display !== 'inline')
   .map(e => e.id || (e.textContent ?? '').slice(0, 30));
  const controls = ['present-toc', 'present-wide', 'present-fullscreen', 'present-exit'].map(id => document.getElementById(id)!)
   .filter(b => b.getClientRects().length > 0);
  return {slide: Math.round(box('#present-slide').width), map: Math.round(box('.present-map').width), width: innerWidth,
   page: document.documentElement.scrollWidth <= document.documentElement.clientWidth, dialog: d.scrollWidth <= d.clientWidth, clipped,
   ends: onScreen(box('#present-prev')) && onScreen(box('#present-next')), labels: controls.map(b => b.textContent),
   controls: controls.every(b => onScreen(b.getBoundingClientRect()) && b.scrollWidth <= b.clientWidth + 1)};
 });
 const setWide = async (on: boolean) => {
  if (await wide.getAttribute('aria-pressed') !== String(on)) await wide.click();
  assert.equal(await wide.getAttribute('aria-pressed'), String(on)); await nextFrames(page);
 };
 /** At the current size: the deck's first, middle and last slides lay out whole (Prev/Next on screen, nothing clipped). */
 const fits = async (where: string) => {
  for (const key of ['Home', 'PageDown', 'PageDown', 'PageDown', 'End']) {
   await page.keyboard.press(key); await nextFrames(page);
   const f = await layout(), at = `${where} slide ${(await query(page)).presenting!.index + 1} ${JSON.stringify(f)}`;
   assert.deepEqual([f.page, f.dialog, f.clipped, f.ends, f.controls], [true, true, [], true, true], at);
  }
 };

 await check('Wide text gives the slide most of a 1440x900 or 1920x1080 window, keeps a usable map and lasts across opens without ticking', async () => {
  await freshStudio(); const before = JSON.stringify((await query(page)).snapshot);
  await openPresent();
  const textMode = () => page.locator('#present').getAttribute('data-text');
  assert.deepEqual([await wide.innerText(), await wide.getAttribute('aria-pressed'), await textMode()], ['Wide text', 'false', null]);
  for (const [width, height] of WIDE_SIZES) {
   await page.setViewportSize({width, height}); await setWide(false); await page.keyboard.press('PageDown'); const standard = await layout();
   await setWide(true); const widened = await layout(), at = `${width}x${height} ${JSON.stringify([standard, widened])}`;
   assert(widened.slide >= 0.55 * width && widened.slide >= standard.slide + 200, 'the slide column widens at ' + at);
   assert(widened.map >= 0.3 * width, 'the map keeps at least three tenths of the window at ' + at);
   assert.equal(await textMode(), 'wide');
   assert.deepEqual(widened.labels, ['Contents', 'Wide text', 'Full screen', 'Exit'], 'full labels at ' + at);
   await fits(`${width}x${height} wide`);
  }
  await page.keyboard.press('Escape'); await shown.waitFor({state: 'hidden'}); await openPresent();
  assert.equal(await wide.getAttribute('aria-pressed'), 'true', 'the choice lasts across opens');
  await setWide(false); assert.equal(await textMode(), null);
  await page.keyboard.press('Escape'); await shown.waitFor({state: 'hidden'});
  assert.equal(JSON.stringify((await query(page)).snapshot), before, 'Wide text never ticks');
 });

 await check('Present fits 1366x768, 1440x1060 and 390x844 with and without Wide text in both fonts and at a 24 px root font', async () => {
  for (const font of ['default', 'DejaVu Sans', '24px root'] as const) {
   await page.setViewportSize({width: 1440, height: 1060}); await freshStudio();
   if (font === 'DejaVu Sans') await page.addStyleTag({content: DEJAVU});
   if (font === '24px root') await page.evaluate(() => { document.documentElement.style.fontSize = '24px'; });
   await page.evaluate(() => document.fonts.ready); await openPresent();
   if (font === 'DejaVu Sans') {
    const families = await renderedFamilies(page, ['#present-title', '#present-wide', '#present-keys']);
    for (const [selector, used] of Object.entries(families)) {
     assert.deepEqual(used, ['DejaVu Sans'], `${selector} renders with ${used.join(', ') || 'no font'}`);
    }
   }
   if (font === '24px root') {
    const [rootPx, titlePx] = await page.locator('#present-title')
     .evaluate(e => [getComputedStyle(document.documentElement).fontSize, parseFloat(getComputedStyle(e).fontSize)]);
    assert.equal(rootPx, '24px'); assert(Number(titlePx) >= 40, `the slide title follows the root size (${titlePx}px)`);
   }
   for (const [width, height] of FIT_SIZES) {
    await page.setViewportSize({width, height}); await nextFrames(page); const where = `${width}x${height} ${font}`;
    const side = await wide.isVisible();
    assert.equal(side, width >= 900, 'Wide text is offered only where slide and map sit side by side at ' + where);
    for (const on of side ? [false, true] : [false]) {
     if (side) await setWide(on);
     await fits(where + (on ? ' wide' : ''));
    }
   }
   await page.keyboard.press('Escape'); await shown.waitFor({state: 'hidden'});
  }
 });
}
