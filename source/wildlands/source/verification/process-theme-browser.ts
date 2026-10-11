/// <reference path="../process-contracts.d.ts" />
/// <reference path="../process-palette.ts" />
/**
 * Process Studio theme suite (package LT): the Light theme toggle of the studio menu (LWProcessTheme) and the light token set.
 * This entry holds the toggle checks (keyboard, state in words, no tick, no storage, the 2D map's room accents re-patched once,
 * gone after a reload, also in the phone ⋯ menu) and the contrast floor of the computed light colours, measured with the same
 * LWProcessPalette.contrast maths as the token check (test-process-theme.cts). The companion `process-theme-view-checks.ts`
 * checks the 3D re-colouring, every view and dialog following the theme across Present and process switches, the light
 * layouts in both fonts and forced colours. Its own suite keeps the older suites inside their time budgets.
 */
import assert from 'node:assert/strict';
import type {Page} from 'playwright';
import {nextFrames} from './browser-harness';
import {query, runSuite, type Studio} from './process-browser-fixture';
import {setTheme, themeState, themeViewChecks} from './process-theme-view-checks';

/** Every Storage write and IndexedDB open from now on, counted in the page, and the storage contents with the cookie. */
const watchStorage = (page: Page) => page.evaluate(() => {
 const w = globalThis as unknown as {__writes: string[]};
 w.__writes = [];
 for (const name of ['setItem', 'removeItem', 'clear'] as const) {
  const original = Storage.prototype[name] as (...args: unknown[]) => unknown;
  Storage.prototype[name] = function(this: Storage, ...args: unknown[]) { w.__writes.push(name); return original.apply(this, args); } as never;
 }
 const open = indexedDB.open.bind(indexedDB);
 indexedDB.open = ((...args: Parameters<IDBFactory['open']>) => { w.__writes.push('indexedDB.open'); return open(...args); }) as IDBFactory['open'];
});
const storageFacts = (page: Page) => page.evaluate(() => ({
 writes: (globalThis as unknown as {__writes: string[]}).__writes, cookie: document.cookie,
 local: JSON.stringify(Object.entries(localStorage)), session: JSON.stringify(Object.entries(sessionStorage)),
}));

/** The studio's run, draft, selection, view and 2D camera, to compare across a theme change. */
const studioFacts = async (page: Page) => {
 const q = await query(page);
 const page2 = await page.evaluate(() => ({draft: (document.getElementById('draft') as HTMLTextAreaElement).value,
  viewBox: document.querySelector('#map svg')?.getAttribute('viewBox') ?? null}));
 return {snapshot: JSON.stringify(q.snapshot), selected: q.selected, mode: q.mode, active: q.active, ...page2};
};

/** Each drawn 2D card's room accent fill against the palette's accent for that room in a scheme. */
const accentsMatch = (page: Page, scheme: LWProcessPalette.Scheme) => page.evaluate(s => {
 const w = globalThis as unknown as {LWProcessPalette: LWProcessPalette.Api; LWProcessRooms: {theme(step: unknown): {id: string}};
  LWProcessStudio: {definition(): LWProcess.Definition}};
 const steps = new Map(w.LWProcessStudio.definition().steps.map(step => [step.id, step]));
 const cards = [...document.querySelectorAll<SVGGElement>('#map svg g[role=button]')];
 const wrong = cards.filter(g => {
  const step = steps.get(g.id.slice('process-map-'.length))!, want = 'fill:' + w.LWProcessPalette.accent(w.LWProcessRooms.theme(step).id, s);
  return g.querySelector('rect[style^="fill:"]')?.getAttribute('style') !== want;
 }).map(g => g.id);
 return {cards: cards.length, wrong};
}, scheme);

runSuite('process theme browser harness', 'process-theme-browser-results.json', async (studio: Studio) => {
 const {page, check, freshStudio} = studio;
 await check('The Light theme toggle in the studio menu works by keyboard, keeps focus and states, never ticks, writes no storage and ends at reload',
  async () => {
   await freshStudio();
   await page.locator('#mode-2d').click();
   await page.locator('#advance').click();
   await page.locator('#steps button[data-step]').nth(1).click();
   await nextFrames(page);
   assert.deepEqual(await themeState(page), {scheme: 'dark', checked: 'false', words: 'Off', colorScheme: ['dark', 'dark']});
   const dark = await accentsMatch(page, 'dark');
   assert(dark.cards > 0 && !dark.wrong.length, 'the map draws the dark room accents ' + JSON.stringify(dark));
   const before = await studioFacts(page);
   assert(before.selected && before.viewBox, 'a selected step on a drawn map');
   await watchStorage(page);
   const stored = await storageFacts(page);
   // Keyboard: the Export menu opens on its first item, End reaches the toggle, Space and Enter switch it and focus stays there.
   await page.locator('#export-menu').focus();
   await page.keyboard.press('Enter');
   await page.keyboard.press('End');
   const toggle = page.locator('#theme-item');
   assert.equal(await page.evaluate(() => document.activeElement?.id), 'theme-item');
   assert.deepEqual([await toggle.getAttribute('role'), await toggle.getAttribute('aria-label'), await toggle.isVisible()],
    ['menuitemcheckbox', 'Light theme', true]);
   await page.keyboard.press('Space');
   await nextFrames(page);
   assert.deepEqual(await themeState(page), {scheme: 'light', checked: 'true', words: 'On', colorScheme: ['light', 'light']});
   assert.equal(await page.evaluate(() => document.activeElement?.id), 'theme-item', 'focus stays on the toggle');
   assert(await page.locator('#export-popup').isVisible(), 'the menu stays open on a toggle');
   assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(243, 245, 248)');
   const lit = await accentsMatch(page, 'light');
   assert(lit.cards > 0 && !lit.wrong.length, 'the map re-colours its room accents at once ' + JSON.stringify(lit));
   assert.deepEqual(await studioFacts(page), before, 'the run, draft, selection, view and camera stay as they were');
   await page.keyboard.press('Enter');
   await nextFrames(page);
   assert.deepEqual(await themeState(page), {scheme: 'dark', checked: 'false', words: 'Off', colorScheme: ['dark', 'dark']});
   assert.deepEqual((await accentsMatch(page, 'dark')).wrong, []);
   await page.keyboard.press('Escape');
   assert.equal(await page.evaluate(() => document.activeElement?.id), 'export-menu', 'Escape returns focus to the menu button');
   assert.deepEqual(await studioFacts(page), before, 'toggling back changes nothing either');
   assert.deepEqual(await storageFacts(page), {...stored, writes: []}, 'no storage write, no IndexedDB, no cookie');
   // The choice lasts for the page only: after a reload the studio is dark again.
   await setTheme(page, 'light');
   await freshStudio();
   assert.deepEqual(await themeState(page), {scheme: 'dark', checked: 'false', words: 'Off', colorScheme: ['dark', 'dark']});
   // On a phone the same toggle ends the ⋯ menu.
   await page.setViewportSize({width: 390, height: 844});
   await nextFrames(page);
   await page.locator('#more-menu').click();
   assert(await page.locator('#theme-item').isVisible(), 'the toggle is in the phone menu');
   await page.keyboard.press('Escape');
   await setTheme(page, 'light');
   assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(243, 245, 248)');
  });

 await check('In light mode text, muted text, the focus ring, button borders, 2D card borders per state and chart marks reach WCAG 2.2 AA',
  async () => {
   await freshStudio();
   await setTheme(page, 'light');
   await page.locator('#mode-2d').click();
   await nextFrames(page);
   // Keyboard focus on a view button shows the focus ring.
   await page.locator('#mode-3d').focus();
   await page.keyboard.press('Shift+Tab');
   const shell = await page.evaluate(() => {
    const P = (globalThis as unknown as {LWProcessPalette: LWProcessPalette.Api}).LWProcessPalette;
    const css = (s: string) => getComputedStyle(document.querySelector(s)!);
    const stage = getComputedStyle(document.body).backgroundColor, panel = css('.process-nav').backgroundColor, out: string[] = [];
    const need = (what: string, fg: string, bg: string, min: number) => {
     const r = P.contrast(fg, bg);
     out.push(`${r >= min ? 'ok' : 'LOW'} ${what} ${r.toFixed(2)} >= ${min}`);
    };
    need('step name on the panel', css('.process-step strong').color, panel, 4.5);
    need('muted step kind on the panel', css('.process-step small').color, panel, 4.5);
    need('stage title on the stage', css('#scene-title').color, stage, 4.5);
    need('muted subtitle on the stage', css('#scene-subtitle').color, stage, 4.5);
    need('legend text on the stage', css('.process-legend').color, stage, 4.5);
    const focused = document.activeElement as HTMLElement;
    need('focus ring on the stage', getComputedStyle(focused).outlineColor, stage, 3);
    need('button border on the stage', css('#frame').borderTopColor, stage, 3);
    need('button border on the panel', css('#overview').borderTopColor, panel, 3);
    need('select border on the run bar', css('#speed').borderTopColor, stage, 3);
    // Every card state's border against the map background and the card fill: each state set in turn on one card.
    const card = document.querySelector<SVGGElement>('#map svg g[role=button]')!, saved = card.dataset.status!;
    for (const status of ['idle', 'active', 'queued', 'timer', 'backlog', 'held']) {
     card.dataset.status = status;
     const rect = getComputedStyle(card.querySelector('.pm-card')!);
     need(status + ' card border on the stage', rect.stroke, stage, 3);
     need(status + ' card border on its fill', rect.stroke, rect.fill, 3);
    }
    card.dataset.status = saved;
    return {out, focused: focused.id};
   });
   assert.equal(shell.focused, 'mode-2d');
   assert.deepEqual(shell.out.filter(l => l.startsWith('LOW')), [], shell.out.join('\n'));
   // Chart marks: every filled or stroked data mark of the Dashboard against its panel.
   await page.locator('#advance').click();
   await page.locator('#advance').click();
   await page.locator('#mode-dashboard').click();
   await page.locator('#dashboard .db-panel .db-fill').first().waitFor();
   const marks = await page.evaluate(() => {
    const P = (globalThis as unknown as {LWProcessPalette: LWProcessPalette.Api}).LWProcessPalette, low: string[] = [];
    let count = 0;
    for (const mark of document.querySelectorAll<SVGElement>('#dashboard .db-panel :is(.db-fill,.db-line,.db-dot,.db-whisker)')) {
     const style = getComputedStyle(mark), stroked = mark.matches('.db-line,.db-whisker'), paint = stroked ? style.stroke : style.fill;
     const panel = getComputedStyle(mark.closest('.db-panel')!).backgroundColor, tone = mark.closest('[data-tone]')?.getAttribute('data-tone');
     if (paint === 'none' || tone === 'idle') continue;
     count++;
     const r = P.contrast(paint, panel);
     if (r < 3) low.push(`${tone} ${mark.getAttribute('class')} ${paint} on ${panel} ${r.toFixed(2)}`);
    }
    return {count, low};
   });
   assert(marks.count > 10, 'the dashboard drew data marks: ' + marks.count);
   assert.deepEqual(marks.low, [], 'chart marks under 3:1 on their panel');
  });

 await themeViewChecks(studio);
 await studio.checkLifecycle('Process theme browser lifecycle emits no runtime errors or network requests');
});
