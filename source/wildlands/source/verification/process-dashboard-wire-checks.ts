/// <reference path="../process-contracts.d.ts" />
/**
 * Dashboard checks on real runs, called from `process-dashboard-browser.ts`: every panel of sections 2-6 (and a journey's outcomes)
 * draws a chart with its data table from the wired read model after a run, "Measure from minute W" and the lead-time target change
 * the windowed figures without ticking, What-if takes the window as its replications' warm-up, and on a phone every section folds
 * into a keyboard-operable disclosure whose state lasts for the page session.
 */
import assert from 'node:assert/strict';
import type {Page} from 'playwright';
import {nextFrames} from './browser-harness';
import {query, type Studio} from './process-browser-fixture';

/** Helpers the suite shares with these checks. */
export interface DashboardHelpers {
 live(page: Page): Promise<string>;
 openDashboard(page: Page): Promise<void>;
 headings(page: Page): Promise<string[]>;
 layout(page: Page): Promise<{page: boolean; dashboard: boolean; wide: number}>;
}
/** Panels that may show their empty reason after a run (nothing of that kind happened); every other panel draws. */
const MAY_BE_EMPTY = new Set(['aging', 'failures', 'repeats']);
/** Each panel of the given sections: its empty reason, whether it draws a chart and whether it has a data table. */
const panels = (page: Page, sections: string[]) => page.evaluate(ids => ids.flatMap(id => [...document.querySelectorAll(
 `#dashboard [data-section="${id}"] .db-panel`)].map(p => ({id: p.getAttribute('data-panel')!, empty: p.querySelector('.db-empty')?.textContent ?? null,
 chart: !!p.querySelector('.db-plot svg.db-chart, .db-plot .db-rows, .db-plot .db-lines, .db-plot .db-stacks, .db-plot .db-bullets, .db-plot .db-sparks'),
 table: !!p.querySelector('table > caption') && !!p.querySelector('th[scope=col]')}))), sections);
/** Runs the active process to minute 1,440 (or to its end) with one Run to end command. */
async function runDay(page: Page): Promise<void> {
 await page.locator('#horizon').selectOption('1440');
 await page.locator('#run-end').click();
 await page.waitForFunction(() => {
  const q = (globalThis as unknown as {LWProcessStudio: {query(): LWProcessApp.View}}).LWProcessStudio.query().snapshot;
  return q.minute >= 1440 || q.status !== 'running';
 });
}
/** Registers the real-run checks on the suite's page. */
export async function wireChecks(studio: Studio, h: DashboardHelpers): Promise<void> {
 const {page, check, freshStudio, switchTo} = studio;
 const tile = (id: string) => page.locator(`#dashboard [data-tile="${id}"] .db-tile-line`).innerText();
 await check('Dashboard draws every flow, time, lead, quality and cost panel and the journey outcomes with charts and data tables after a run', async () => {
  await freshStudio();
  await switchTo(2);
  await h.openDashboard(page);
  await runDay(page);
  const business = await panels(page, ['flow', 'time', 'lead', 'quality', 'cost']);
  assert.deepEqual(business.map(p => p.id), ['arrivals', 'wip', 'throughput', 'little', 'breakdown', 'waiting', 'capacity', 'queues', 'lead', 'recent',
   'aging', 'repeats', 'failures', 'pool-cost', 'step-cost']);
  for (const p of business) {
   assert.doesNotMatch(p.empty ?? '', /^Needs /, `${p.id} has its read-model data`);
   if (p.empty === null) assert(p.chart && p.table, `${p.id} draws a chart with a data table`);
   else assert(MAY_BE_EMPTY.has(p.id), `${p.id} is drawn: ${p.empty}`);
  }
  assert.equal(await page.locator('#dashboard [data-tile="active"] svg.db-spark').count(), 1, 'the in-progress tile has its sparkline');
  assert.equal(await page.locator('#dashboard [data-tile="finished"] svg.db-spark').count(), 1, 'the finished tile has its sparkline');
  await switchTo(3);
  await page.locator('#dashboard [data-section="journey"]').waitFor();
  await runDay(page);
  const journey = await panels(page, ['journey']);
  assert.deepEqual(journey.map(p => p.id), ['funnel', 'outcomes', 'conversion', 'outcome-goal', 'outcome-lost', 'feeling', 'channels', 'tracked']);
  for (const p of journey) assert(p.empty === null && (p.chart || p.table), `${p.id} is drawn`);
  assert(journey.find(p => p.id === 'conversion')!.chart, 'conversion over time is a chart');
 });
 await check('Measure from minute W and the lead-time target change the windowed figures without ticking the run', async () => {
  await freshStudio();
  await switchTo(2);
  await h.openDashboard(page);
  await runDay(page);
  const before = await h.live(page), lines = [await tile('active'), await tile('finished'), await tile('pool')];
  const select = page.locator('#dashboard select[data-window]');
  const options = await select.locator('option').evaluateAll(o => o.map(x => Number((x as HTMLOptionElement).value)));
  assert.deepEqual(options, Array.from({length: 24}, (_, i) => i * 60), 'the sample-grid minutes before now');
  await select.focus();
  await select.selectOption('720');
  await page.locator('#dashboard [data-note="window"]').waitFor();
  const label = 'from minute 720 to minute 1,440';
  assert.match(await page.locator('#dashboard [data-note="window"]').innerText(), new RegExp(`^Windowed values measure ${label}, the last sample;`));
  const after = [await tile('active'), await tile('finished'), await tile('pool')];
  for (let i = 0; i < 3; i++) assert.notEqual(after[i], lines[i], 'windowed tile line ' + i);
  assert(after.every(l => l.includes(label)), 'every windowed tile line names the window');
  assert.match(await page.locator('#dashboard [data-panel="capacity"] figcaption').innerText(), new RegExp(` average utilisation ${label}\\.$`));
  assert.equal(await page.locator('#dashboard [data-panel="wip"] .db-rule').count(), 1, 'the WIP chart marks where measuring starts');
  assert.equal(await page.evaluate(() => document.activeElement?.matches('select[data-window]')), true, 'focus stays on the window select');
  const target = page.locator('#dashboard [data-panel="lead"] select[data-target]');
  const edge = await target.locator('option').nth(3).getAttribute('value');
  await target.selectOption(edge!);
  await page.locator('#dashboard [data-panel="lead"] .db-note', {hasText: '(exact: the target is a bin edge)'}).waitFor();
  assert.equal(await h.live(page), before, 'choosing a window or a target never ticks the run');
  await select.selectOption('0');
  assert.equal(await page.locator('#dashboard [data-note="window"]').count(), 0);
  assert.deepEqual([await tile('active'), await tile('finished'), await tile('pool')], lines, 'the whole run again');
 });
 await check('What-if takes the measuring start as each replication\'s warm-up and marks results out of date when it changes', async () => {
  await freshStudio();
  await switchTo(2);
  await h.openDashboard(page);
  await runDay(page);
  const before = await h.live(page), whatif = page.locator('#dashboard .db-whatif');
  await page.locator('#dashboard select[data-window]').selectOption('720');
  await whatif.locator('#db-runs').fill('2');
  assert.match(await whatif.locator('#db-plan').innerText(), / Measures labelled "after minute 720" leave out each run's first 720 minutes \(warm-up\)\./);
  await whatif.locator('#db-start').click();
  await page.waitForFunction(() => document.getElementById('db-progress')?.textContent === 'Replications complete.', null, {timeout: 60000});
  assert.match(await whatif.locator('.db-notice').innerText(), /measures labelled "after minute 720" leave out the first 720 minutes \(warm-up\)/);
  const rows = await whatif.locator('.db-intervals .db-row-label strong').allTextContents();
  assert(rows.includes('Mean work in progress after minute 720') && rows.includes('Completed cases after minute 720'), rows.join(' | '));
  assert.equal(await whatif.locator('[data-stale]').isVisible(), false);
  await page.locator('#dashboard select[data-window]').selectOption('360');
  await whatif.locator('[data-stale]').waitFor();
  assert.equal(await h.live(page), before, 'What-if and the window never touch the live run');
 });
 await check('On a phone every dashboard section folds into a keyboard disclosure whose state lasts for the session', async () => {
  await freshStudio();
  await h.openDashboard(page);
  await runDay(page);
  await page.setViewportSize({width: 390, height: 844});
  await page.locator('#dashboard details.db-fold').first().waitFor();
  const folds = () => page.locator('#dashboard details.db-fold').evaluateAll(d => d.map(x => [x.querySelector(':scope > summary > h2')?.textContent,
   (x as HTMLDetailsElement).open]));
  assert.deepEqual(await folds(), ['Flow over time', 'Where time goes', 'Lead time and predictability', 'Quality', 'Cost', 'What-if: spread across seeds',
   'Data and export'].map(t => [t, true]));
  const summary = page.locator('#dashboard details.db-fold[data-fold="db-s-flow"] > summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !(document.querySelector('#dashboard [data-fold="db-s-flow"]') as HTMLDetailsElement).open);
  assert.equal(await page.locator('#dashboard [data-panel="arrivals"]').isVisible(), false, 'a closed section hides its panels');
  await page.locator('#dashboard [data-fold="db-s-data"] > summary').click();
  await switchTo(1);
  await switchTo(0);
  await page.locator('#dashboard details.db-fold[data-fold="db-s-flow"]').waitFor();
  const closed = (await folds()).filter(([, open]) => !open).map(([t]) => t);
  assert.deepEqual(closed, ['Flow over time', 'Data and export'], 'closed sections stay closed across redraws and process switches');
  assert.deepEqual(await h.layout(page), {page: true, dashboard: true, wide: 0});
  await page.locator('#dashboard [data-fold="db-s-flow"] > summary').focus();
  await page.keyboard.press(' ');
  await page.locator('#dashboard [data-panel="arrivals"] svg.db-chart').waitFor();
  const width = await page.locator('#dashboard [data-panel="arrivals"] svg.db-chart').evaluate(s => Number(s.getAttribute('width')));
  assert(width > 250, 'an opened section draws its charts at the phone width: ' + width);
  await page.setViewportSize({width: 1440, height: 1060});
  await nextFrames(page, 3);
  await page.waitForFunction(() => !document.querySelector('#dashboard details.db-fold'));
  assert.deepEqual(await h.headings(page), ['Flow over time', 'Where time goes', 'Lead time and predictability', 'Quality', 'Cost',
   'What-if: spread across seeds', 'Data and export'], 'desktop headings are back in place');
  assert.equal((await query(page)).mode, 'dashboard');
 });
}
