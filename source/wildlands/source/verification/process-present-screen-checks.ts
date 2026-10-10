/// <reference path="../process-contracts.d.ts" />
/**
 * Present view checks (PR-11), run by `process-present-screen-browser.ts`: **Full screen** (the Fullscreen API on the page root,
 * its pressed state, the F shortcut, Escape that leaves full screen before it closes anything, focus kept in the dialog, and the
 * disabled reason where the API is missing, not permitted or refused), and the studio behind the dialog, which is not rendered
 * while presenting and comes back unchanged. Headless Chromium grants full screen to the page and lets Escape reach it, so the
 * checks read `document.fullscreenElement` and the dialog's own state; a real browser keeps that first Escape for itself, which
 * these checks cannot reach. Waits are explicit DOM or event conditions.
 */
import assert from 'node:assert/strict';
import {nextFrames} from './browser-harness';
import {query, type Studio} from './process-browser-fixture';

/** What the Full screen control and the dialog say now. */
interface Screen {full: boolean; pressed: string | null; disabled: string | null; title: string; keys: string; label: string; focusIn: boolean}

/** Registers the full-screen and studio-behind checks on the suite's page. */
export async function presentScreenChecks(studio: Studio): Promise<void> {
 const {page, check, freshStudio, activeId} = studio;
 const shown = page.locator('dialog#present[open]'), button = page.locator('#present-fullscreen');
 const openPresent = async () => { await page.locator('#mode-present').click(); await shown.waitFor(); };
 const screen = () => page.evaluate((): Screen => {
  const b = document.getElementById('present-fullscreen')!;
  return {full: document.fullscreenElement === document.documentElement, pressed: b.getAttribute('aria-pressed'), disabled: b.getAttribute('aria-disabled'),
   title: b.title, keys: document.getElementById('present-keys')!.textContent ?? '', label: b.textContent ?? '',
   focusIn: !!document.activeElement?.closest('#present')};
 });
 /** Full screen is on (or off) and the button says so: its pressed state follows `fullscreenchange`, a frame after the request. */
 const fullIs = (on: boolean) => page.waitForFunction(v => (document.fullscreenElement === document.documentElement) === v
  && document.getElementById('present-fullscreen')?.getAttribute('aria-pressed') === String(v), on);
 const index = async () => (await query(page)).presenting?.index ?? null;
 const live = () => page.locator('#present-live').innerText();

 await check('Full screen enters and leaves with its button and F, keeps the slide and focus in the dialog, '
  + 'and the first Escape only leaves full screen', async () => {
  await freshStudio(); const before = JSON.stringify((await query(page)).snapshot);
  await openPresent(); await page.keyboard.press('PageDown'); await page.keyboard.press('PageDown'); assert.equal(await index(), 2);
  let s = await screen();
  assert.deepEqual([s.label, s.pressed, s.disabled, s.full, await button.getAttribute('aria-keyshortcuts')], ['Full screen', 'false', null, false, 'F']);
  assert.equal(s.keys, 'Arrow keys or Page Up and Page Down change slides · F full screen · Escape exits');
  await button.click(); await fullIs(true); s = await screen();
  assert.deepEqual([s.pressed, s.focusIn, await activeId(), await index()], ['true', true, 'present-fullscreen', 2], 'pressed, focus kept on the button');
  assert.equal(s.keys, 'Arrow keys or Page Up and Page Down change slides · F or Escape leaves full screen');
  assert.equal(await live(), 'Full screen. Press F or Escape to leave it.');
  assert.equal(await page.evaluate(() => !!document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest('#present')), true, 'Present covers the screen');
  // The first Escape leaves full screen; the dialog stays open on the same slide with focus inside.
  await page.keyboard.press('Escape'); await fullIs(false); await nextFrames(page); s = await screen();
  assert.deepEqual([await shown.count(), await index(), s.pressed, s.focusIn, await live()], [1, 2, 'false', true, 'Full screen off.']);
  // F from the slide toggles full screen both ways; the slide and focus stay.
  await page.locator('#present-slide').focus(); await page.keyboard.press('f'); await fullIs(true);
  assert.deepEqual([await activeId(), await index(), (await screen()).pressed], ['present-slide', 2, 'true']);
  await page.keyboard.press('Shift+F'); await fullIs(false); assert.deepEqual([await activeId(), await index()], ['present-slide', 2]);
  // In the map F fits the map (its own key) and never toggles full screen.
  await page.locator('#present-stage #map svg').focus(); await page.keyboard.press('f'); await nextFrames(page);
  assert.equal((await screen()).full, false, 'F inside the map is the map key');
  // Escape with Contents open in full screen: full screen first, then Contents, then Present.
  await page.locator('#present-toc').click(); await page.keyboard.press('f'); await fullIs(true);
  await page.keyboard.press('Escape'); await fullIs(false);
  assert.deepEqual([await shown.count(), await page.locator('#present-contents').isVisible()], [1, true], 'Contents stays open');
  await page.keyboard.press('Escape'); assert.equal(await page.locator('#present-contents').isHidden(), true);
  await page.keyboard.press('Escape'); await shown.waitFor({state: 'hidden'}); assert.equal(await activeId(), 'mode-present');
  // Exit while full screen leaves full screen too.
  await openPresent(); await button.click(); await fullIs(true); await page.locator('#present-exit').click();
  await shown.waitFor({state: 'hidden'}); await page.waitForFunction(() => document.fullscreenElement === null);
  assert.equal(await activeId(), 'mode-present');
  assert.equal(JSON.stringify((await query(page)).snapshot), before, 'full screen never ticks');
 });

 await check('An Escape dated before full screen was left does not close Present, and a later Escape does', async () => {
  await freshStudio(); await openPresent(); await page.keyboard.press('End'); const last = await index();
  await button.click(); await fullIs(true);
  // A browser that leaves full screen on Escape and still passes the key on delivers it after the exit: the key is dated before it.
  await page.evaluate(async () => {
   const early = new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true});
   const left = new Promise(resolve => document.addEventListener('fullscreenchange', resolve, {once: true}));
   await document.exitFullscreen(); await left;
   document.getElementById('present-slide')!.dispatchEvent(early);
  });
  assert.deepEqual([await shown.count(), await index(), (await screen()).pressed], [1, last, 'false'], 'the late key of the exit is ignored');
  await page.keyboard.press('Escape'); await shown.waitFor({state: 'hidden'});
 });

 await check('Full screen says why it is unavailable without the API, permission or a granted request, stays focusable and keeps Present open', async () => {
  // A frame without full-screen permission: fullscreenEnabled is false.
  await freshStudio();
  await page.evaluate(() => Object.defineProperty(Document.prototype, 'fullscreenEnabled', {configurable: true, get: () => false}));
  await openPresent(); await page.keyboard.press('PageDown'); let s = await screen();
  const embedded = 'Full screen is not available: this page is embedded without permission to use full screen.';
  assert.deepEqual([s.label, s.disabled, s.pressed, s.title], ['Full screen', 'true', 'false', embedded]);
  assert.equal(s.keys, 'Arrow keys or Page Up and Page Down change slides · Escape exits', 'the hint offers no F');
  await button.focus(); assert.equal(await activeId(), 'present-fullscreen', 'the unavailable control stays focusable');
  await page.keyboard.press('Enter'); assert.equal(await live(), embedded, 'a press says why');
  await page.locator('#present-slide').focus(); await page.keyboard.press('f'); assert.equal(await live(), embedded, 'F says why');
  assert.deepEqual([(await screen()).full, await shown.count(), await index()], [false, 1, 1]);
  await page.keyboard.press('Escape'); await shown.waitFor({state: 'hidden'});
  // A browser without the API.
  await page.evaluate(() => Object.defineProperty(Element.prototype, 'requestFullscreen', {configurable: true, value: undefined}));
  await openPresent(); s = await screen();
  assert.deepEqual([s.disabled, s.title], ['true', 'Full screen is not available: this browser does not offer it to pages.']);
  await page.keyboard.press('Escape'); await shown.waitFor({state: 'hidden'});
  // A request the browser refuses: announced, and the button stays unpressed.
  await freshStudio();
  await page.evaluate(() => Object.defineProperty(Element.prototype, 'requestFullscreen', {configurable: true,
   value: () => Promise.reject(new TypeError('Permissions check failed'))}));
  await openPresent(); await button.click();
  await page.waitForFunction(() => document.getElementById('present-live')!.textContent === 'The browser did not allow full screen.');
  s = await screen(); assert.deepEqual([s.disabled, s.pressed, s.full, await shown.count()], [null, 'false', false, 1]);
  await page.keyboard.press('Escape'); await shown.waitFor({state: 'hidden'});
 });

 await check('Presenting does not render the studio behind the dialog, and exit returns it with its size, step-list scroll and selection', async () => {
  await page.setViewportSize({width: 1440, height: 640}); await freshStudio();
  const behind = () => page.evaluate(() => {
   const shell = document.getElementById('process-shell')!, nav = document.querySelector<HTMLElement>('.process-nav')!, r = shell.getBoundingClientRect();
   return {hidden: getComputedStyle(shell).contentVisibility, w: Math.round(r.width), h: Math.round(r.height), navTop: Math.round(nav.scrollTop),
    pageTop: Math.round(document.scrollingElement!.scrollTop)};
  });
  const scrolled = await page.evaluate(() => {
   const nav = document.querySelector<HTMLElement>('.process-nav')!;
   nav.scrollTop = 120;
   return Math.round(nav.scrollTop);
  });
  assert(scrolled > 0, 'the step list scrolls at this height');
  const was = await behind(), selected = (await query(page)).selected; assert.equal(was.hidden, 'visible');
  await openPresent(); const during = await behind();
  assert.deepEqual([during.hidden, during.w, during.h, during.navTop], ['hidden', was.w, was.h, was.navTop], 'not rendered, same size');
  for (const key of ['PageDown', 'PageDown', 'PageDown', 'End']) await page.keyboard.press(key);
  assert.equal((await behind()).navTop, was.navTop, 'paging does not scroll the hidden step list');
  await page.keyboard.press('Escape'); await shown.waitFor({state: 'hidden'}); const after = await behind();
  assert.deepEqual(after, was, 'the studio returns exactly as it was'); assert.equal((await query(page)).selected, selected);
  // The entrance animation: a slide shown right after another appears at once; one shown later enters.
  await page.emulateMedia({reducedMotion: 'no-preference'}); await openPresent();
  await page.evaluate(() => { document.getElementById('present-next')!.click(); document.getElementById('present-next')!.click(); });
  assert.equal(await page.locator('#present-slide .present-body').evaluate(b => b.classList.contains('present-quick')), true, 'quick paging skips it');
  // Frames until more than the entrance time has passed since that slide was shown.
  await page.evaluate(() => {
   const at = performance.now();
   return new Promise(resolve => { const wait = () => performance.now() - at > 250 ? resolve(0) : requestAnimationFrame(wait); wait(); });
  });
  await page.locator('#present-next').click();
  const entered = await page.locator('#present-slide .present-body').evaluate(b => [b.classList.contains('present-quick'), b.getAnimations().length > 0]);
  assert.deepEqual(entered, [false, true], 'a slide shown later enters');
  await page.keyboard.press('Escape'); await shown.waitFor({state: 'hidden'});
 });
}
