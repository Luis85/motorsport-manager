/// <reference path="../process-contracts.d.ts" />
/**
 * Process Dashboard suite: the per-process Dashboard view (`mode: 'dashboard'`, LWProcessDashboard). It checks that entering and
 * leaving the view never ticks, that panels render for a business process and a journey at minute 0 and after running, that every
 * chart has a data table and an accessible name with keyboard-reachable marks and step buttons, step focus with Escape and Whole
 * process, the CSV download, What-if replications (complete, cancelled, never touching the live run), layout at three viewport
 * sizes in two fonts, forced colours, a 24 px root font and a clean page lifecycle; the real-run checks (every panel drawn from the
 * wired read model, the measuring window and lead-time target, What-if warm-up, folding sections on a phone) live in
 * `process-dashboard-wire-checks.ts`. It runs in its own browser on the shared fixture.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type {Page} from 'playwright';
import {nextFrames} from './browser-harness';
import {query, runSuite} from './process-browser-fixture';
import {wireChecks} from './process-dashboard-wire-checks';
const DEJAVU = '*{font-family:"DejaVu Sans",sans-serif !important}';
/** The live run as JSON: equal before and after means nothing ticked and nothing changed it. */
const live = async (page: Page) => JSON.stringify((await query(page)).snapshot);
const openDashboard = async (page: Page) => {
 await page.locator('#mode-dashboard').click();
 await page.locator('#dashboard .db-tiles').waitFor();
};
const headings = (page: Page) => page.locator('#dashboard .db-section > .db-section-head > h2, #dashboard .db-section > h2').allInnerTexts();
/** Layout facts of the dashboard: page and dashboard overflow, and charts wider than their panel. */
const layout = (page: Page) => page.evaluate(() => {
 const dash = document.getElementById('dashboard')!, wide = [...dash.querySelectorAll<SVGElement>('svg.db-chart')].filter(svg => {
  const panel = svg.closest('.db-panel, .db-whatif')!.getBoundingClientRect(), box = svg.getBoundingClientRect();
  return box.right > panel.right + 1 || box.left < panel.left - 1;
 }).length;
 return {page: document.documentElement.scrollWidth <= innerWidth, dashboard: dash.scrollWidth <= dash.clientWidth + 1, wide};
});
runSuite('process dashboard browser harness', 'process-dashboard-browser-results.json', async studio => {
 const {page, check, checkLifecycle, freshStudio, switchTo, dir} = studio;
 await check('Dashboard opens from the stage controls and the phone menu without ticking, and leaving it never ticks', async () => {
  await freshStudio();
  assert.deepEqual(await page.locator('.process-view-controls > button:not([hidden])').evaluateAll(b => b.map(x => x.id)),
   ['mode-2d', 'mode-3d', 'mode-lens', 'mode-dashboard', 'mode-present', 'frame']);
  await page.locator('#horizon').selectOption('100000');
  await page.locator('#advance').click();
  const before = await live(page);
  await openDashboard(page);
  const q = await query(page);
  assert.equal(q.mode, 'dashboard');
  assert.equal(await page.locator('#mode-dashboard').getAttribute('aria-pressed'), 'true');
  const hosts = [await page.locator('#map').isHidden(), await page.locator('#lens').isHidden(), await page.locator('#dashboard').isVisible()];
  assert.deepEqual(hosts, [true, true, true]);
  assert.equal(await page.locator('#dashboard .process-dashboard').getAttribute('aria-label'), `${q.definition.name} dashboard`);
  assert.equal(await page.locator('.process-legend [data-legend]').first().isHidden(), true, 'the legend key hides like in the lenses');
  assert.equal(await page.locator('#frame').getAttribute('title'), 'Scroll the dashboard back to its top');
  assert.equal(await live(page), before, 'entering the dashboard never ticks');
  // Present shows its slides over the 2D map and returns to the dashboard on exit; Fit to view scrolls the dashboard to its top.
  await page.locator('#mode-present').click();
  await page.locator('dialog#present[open]').waitFor();
  assert.equal((await query(page)).mode, '2d');
  await page.keyboard.press('Escape');
  await page.locator('dialog#present[open]').waitFor({state: 'hidden'});
  assert.equal((await query(page)).mode, 'dashboard', 'leaving Present returns to the dashboard');
  await page.locator('#dashboard').evaluate(e => { e.scrollTop = 400; });
  await page.locator('#frame').click();
  assert.equal(await page.locator('#dashboard').evaluate(e => e.scrollTop), 0, 'Fit to view scrolls the dashboard to its top');
  await page.locator('#mode-2d').click();
  assert.equal(await live(page), before, 'leaving the dashboard never ticks');
  assert.equal((await query(page)).mode, '2d');
  await page.setViewportSize({width: 390, height: 844});
  await nextFrames(page);
  assert.equal(await page.locator('#mode-dashboard').isVisible(), false, 'phones offer the dashboard in the ⋯ menu');
  await page.locator('#more-menu').click();
  await page.locator('#dashboard-item').click();
  await page.locator('#dashboard .db-tiles').waitFor();
  assert.equal((await query(page)).mode, 'dashboard');
  assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('process-dashboard')), true, 'focus moves to the dashboard');
  assert.equal(await live(page), before);
 });
 await check('Dashboard panels render for a business process and a journey at minute 0 and after running', async () => {
  await freshStudio();
  await openDashboard(page);
  assert.deepEqual(await headings(page), ['Flow over time', 'Where time goes', 'Lead time and predictability', 'Quality', 'Cost',
   'What-if: spread across seeds', 'Data and export']);
  assert.match(await page.locator('#dashboard .db-notice').first().innerText(), /^Minute 0 — nothing has been simulated yet\./);
  assert.equal(await page.locator('#dashboard [data-tile="lead"] .db-tile-value').innerText(), '—');
  await page.locator('#horizon').selectOption('100000');
  for (let i = 0; i < 4; i++) await page.locator('#advance').click();
  const q = await query(page);
  assert(q.snapshot.minute > 0);
  assert.equal(await page.locator('#dashboard [data-tile="finished"] .db-tile-value').innerText(), q.snapshot.metrics.completed.toLocaleString('en-US'));
  assert(await page.locator('#dashboard [data-panel="waiting"] button.db-row').count() > 0, 'waiting by step lists steps after running');
  assert(await page.locator('#dashboard [data-panel="capacity"] svg.db-chart').count() > 0);
  await switchTo(3);
  assert.equal((await query(page)).mode, 'dashboard', 'the dashboard stays shown when switching to a journey');
  await page.locator('#dashboard [data-section="journey"]').waitFor();
  assert.equal((await headings(page))[0], 'Journey outcomes');
  assert.equal(await page.locator('#dashboard [data-tile]').first().getAttribute('data-tile'), 'conversion');
  for (let i = 0; i < 4; i++) await page.locator('#advance').click();
  assert(await page.locator('#dashboard [data-panel="funnel"] button.db-row').count() > 1, 'the funnel lists the main route');
  assert(await page.locator('#dashboard [data-panel="channels"] .db-row').count() > 0);
 });
 await check('Every dashboard chart has a data table and an accessible name, and the keyboard reaches marks and step buttons', async () => {
  await freshStudio();
  await openDashboard(page);
  await page.locator('#horizon').selectOption('100000');
  for (let i = 0; i < 6; i++) await page.locator('#advance').click();
  const facts = await page.evaluate(() => [...document.querySelectorAll('#dashboard figure')].map(f => ({
   caption: f.querySelector(':scope > figcaption')?.textContent?.trim() ?? '', svgs: [...f.querySelectorAll('svg.db-chart')].map(s =>
    s.getAttribute('role') === 'group' && document.getElementById(s.getAttribute('aria-labelledby')!)?.textContent?.trim()),
   table: !!f.querySelector('table > caption') && !!f.querySelector('th[scope=col]'), text: !!f.querySelector('.db-plot[data-kind=text]')})));
  assert(facts.length >= 8, 'figures: ' + facts.length);
  for (const f of facts) {
   assert(f.caption, 'every figure has a caption');
   assert(f.svgs.every(Boolean), 'every SVG chart is a named group: ' + f.caption);
   assert(f.table || f.text, 'every chart has a data table: ' + f.caption);
  }
  const marks = page.locator('#dashboard svg [tabindex="0"][role="img"][aria-label]');
  assert(await marks.count() > 0);
  await page.locator('#dashboard .process-dashboard').focus();
  const reached = new Set<string>();
  for (let i = 0; i < 120 && reached.size < 2; i++) {
   await page.keyboard.press('Tab');
   const kind = await page.evaluate(() => {
    const a = document.activeElement;
    return a?.closest('#dashboard') ? a.hasAttribute('data-tip') ? 'mark' : a.hasAttribute('data-select') ? 'step' : 'other' : 'outside';
   });
   if (kind === 'mark') {
    const name = await page.evaluate(() => document.activeElement!.getAttribute('aria-label'));
    assert.equal(await page.locator('#dashboard .db-tip').innerText(), name, 'a focused mark shows its value in the tooltip');
   }
   if (kind === 'mark' || kind === 'step') reached.add(kind);
  }
  assert.deepEqual([...reached].sort(), ['mark', 'step'], 'Tab reaches chart marks (with their tooltip) and step buttons');
 });
 await check('Choosing a step shows its focus, and Escape or Whole process returns to the whole process without ticking', async () => {
  await freshStudio();
  await openDashboard(page);
  await page.locator('#horizon').selectOption('100000');
  for (let i = 0; i < 4; i++) await page.locator('#advance').click();
  const before = await live(page), row = page.locator('#dashboard [data-panel="waiting"] button.db-row').first(), id = (await row.getAttribute('data-select'))!;
  await row.focus();
  await page.keyboard.press('Enter');
  await page.locator('#dashboard [data-section="focus"]').waitFor();
  const q = await query(page), name = q.definition.steps.find(s => s.id === id)!.name;
  assert.deepEqual([q.selected, q.mode], [id, 'dashboard']);
  assert.equal(await page.locator('#dashboard #db-s-focus').innerText(), 'Step focus: ' + name);
  assert.deepEqual((await headings(page)).slice(0, 2), ['Flow over time', 'Step focus: ' + name]);
  assert.equal(await page.locator('#dashboard [data-section="focus"] [data-tile]').count(), 9);
  assert.equal(await page.locator('#scene-title').innerText(), name);
  await page.locator('#dashboard [data-tile="waiting"]').click();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (globalThis as any).LWProcessStudio.query().selected === null);
  await page.locator('#dashboard [data-section="time"]').waitFor();
  await page.locator('#dashboard [data-panel="waiting"] button.db-row').first().click();
  await page.locator('#dashboard [data-back]').click();
  await page.waitForFunction(() => (globalThis as any).LWProcessStudio.query().selected === null);
  await page.locator('#dashboard [data-panel="waiting"] button.db-row').first().click();
  await page.locator('#back-overview').click();
  assert.equal((await query(page)).selected, null);
  assert.equal(await live(page), before, 'selection never ticks');
 });
 await check('Download dashboard data saves a named CSV of the panel tables through the studio download', async () => {
  await freshStudio();
  await openDashboard(page);
  await page.locator('#advance').click();
  const pending = page.waitForEvent('download');
  await page.locator('#dashboard [data-csv]').click();
  const download = await pending, saved = path.join(dir, 'dashboard.csv'), q = await query(page);
  assert.equal(download.suggestedFilename(), `${q.definition.id}-dashboard-minute-${q.snapshot.minute}.csv`);
  await download.saveAs(saved);
  const csv = fs.readFileSync(saved, 'utf8');
  assert(csv.startsWith(`Dashboard,${q.definition.name},minute ${q.snapshot.minute}\n`));
  assert.match(csv, /\nWhere time goes,Capacity: pool utilisation\nPool utilisation\nPool,Kind,Capacity,Average utilisation,Busy now,Busy minutes,Used by\n/);
  assert.match(await page.locator('#message').innerText(), /^Dashboard data downloaded as .+\.csv\.$/);
 });
 await check('What-if runs seeds in slices, can be cancelled, explains a disabled comparison and never changes the live run', async () => {
  await freshStudio();
  await switchTo(2);
  await openDashboard(page);
  await page.locator('#advance').click();
  const before = await live(page), whatif = page.locator('#dashboard .db-whatif');
  assert.equal(await whatif.locator('input[value=compare]').isDisabled(), true);
  assert.match(await whatif.locator('#db-compare-why').innerText(), /^The draft holds the running definition, so there is nothing to compare\./);
  await whatif.locator('#db-runs').fill('1');
  assert.equal(await whatif.locator('#db-start').isDisabled(), true);
  assert.equal(await whatif.locator('#db-problems').innerText(), 'Runs must be a whole number from 2 to 50.');
  assert.equal(await whatif.locator('#db-start').getAttribute('title'), 'Runs must be a whole number from 2 to 50.');
  await whatif.locator('#db-runs').fill('3');
  await whatif.locator('#db-minutes').fill('240');
  await whatif.locator('#db-start').click();
  await page.waitForFunction(() => document.getElementById('db-progress')?.textContent === 'Replications complete.', null, {timeout: 60000});
  assert.match(await whatif.locator('.db-notice').innerText(), /^Spread under the authored assumptions across 3 seeds .*This is not a forecast\.$/);
  assert(await whatif.locator('.db-intervals > li').count() > 3);
  assert.equal(await whatif.locator('details.db-table table caption').textContent(), 'Spread of the applied design across seeds');
  assert.equal(await live(page), before, 'replications never touch the live run');
  await whatif.locator('#db-runs').fill('50');
  await whatif.locator('#db-minutes').fill('5000');
  await whatif.locator('#db-start').click();
  await whatif.locator('#db-cancel').click();
  await page.waitForFunction(() => /^Cancelled after \d+ of 50 runs\.$/.test(document.getElementById('db-progress')?.textContent ?? ''));
  assert.equal(await whatif.locator('#db-cancel').isHidden(), true);
  assert.equal(await whatif.locator('#db-progress-bar').isHidden(), true);
  assert.match(await whatif.locator('#db-results').innerText(), /Partial results \(\d+ of 50 runs\)\./);
  assert.equal(await live(page), before, 'a cancelled plan leaves the live run as it was');
  await page.locator('#seed').fill('11');
  await page.locator('#seed').press('Tab');
  await page.waitForFunction(() => (globalThis as any).LWProcessStudio.query().snapshot.seed === 11);
  await page.locator('#mode-dashboard').click();
  assert.equal(await whatif.locator('[data-stale]').isVisible(), true, 'a new run seed marks the results out of date');
 });
 await check('Dashboard fits 1366x768, 1440x1060 and 390x844 without horizontal overflow, also in DejaVu Sans', async () => {
  for (const dejavu of [false, true]) {
   await page.setViewportSize({width: 1440, height: 1060});
   await freshStudio();
   if (dejavu) await page.addStyleTag({content: DEJAVU});
   await openDashboard(page);
   await page.locator('#horizon').selectOption('100000');
   for (let i = 0; i < 4; i++) await page.locator('#advance').click();
   for (const [width, height] of [[1366, 768], [1440, 1060], [390, 844]] as const) {
    await page.setViewportSize({width, height});
    await nextFrames(page, 3);
    const f = await layout(page);
    assert.deepEqual(f, {page: true, dashboard: true, wide: 0}, `${width}x${height}${dejavu ? ' DejaVu' : ''}`);
   }
  }
 });
 await check('Forced colours keep dashboard marks visible and a 24 px root font stays readable without overflow', async () => {
  await freshStudio();
  await openDashboard(page);
  await page.locator('#horizon').selectOption('100000');
  for (let i = 0; i < 4; i++) await page.locator('#advance').click();
  await page.emulateMedia({forcedColors: 'active'});
  const forced = await page.evaluate(() => {
   const fill = document.querySelector('#dashboard [data-panel="capacity"] .db-fill')!, panel = document.querySelector('#dashboard .db-panel')!;
   return {fill: getComputedStyle(fill).fill, stroke: getComputedStyle(fill).stroke, panel: getComputedStyle(panel).backgroundColor};
  });
  assert.notEqual(forced.fill, 'none');
  assert.notEqual(forced.fill, forced.panel, JSON.stringify(forced));
  await page.emulateMedia({forcedColors: 'none'});
  await page.addStyleTag({content: 'html{font-size:24px}'});
  await page.waitForFunction(() => document.querySelector('#dashboard [data-panel="capacity"] svg.db-chart')?.getAttribute('height') === '42');
  const sizes = await page.evaluate(() => [...document.querySelectorAll('#dashboard *')]
   .filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent!.trim())
   && e.getClientRects().length).map(e => parseFloat(getComputedStyle(e).fontSize)));
  assert(Math.min(...sizes) >= 18, 'smallest text ' + Math.min(...sizes));
  assert.deepEqual(await layout(page), {page: true, dashboard: true, wide: 0});
 });
 await wireChecks(studio, {live, openDashboard, headings, layout});
 await checkLifecycle('Process dashboard browser lifecycle emits no runtime errors or network requests');
});
