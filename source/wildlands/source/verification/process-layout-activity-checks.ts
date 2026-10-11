/// <reference path="../process-contracts.d.ts" />
/**
 * Activity checks of the process layout suite (process-layout-browser.ts calls `activityChecks` once, in its own order): the
 * Activity modal opened from the toolbar beside the clock, its filters, step links and exports while the run keeps going; the
 * frozen list while scrolled with its new-events pill, the badge that counts unseen problems only, and the polite feed
 * announcer. `layoutProbes` owns the page probes these checks share with the suite entry: the open Activity dialog and its
 * rows, and the colour a studio token or an element paints.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type {Page} from 'playwright';
import {query, type Studio} from './process-browser-fixture';
import {feedFixture} from './process-browser-models';

/** Page probes shared by the Activity checks and the layout suite entry; each one only reads the page. */
export function layoutProbes(page: Page) {
 const actOpen = page.locator('dialog.act-dialog[open]'), actRows = () => page.locator('#act-rows tr');
 /** The colour a studio token resolves to, so an element's paint can be compared with the legend's tokens. */
 const tokenColour = (token: string) => page.evaluate(t => {
  const probe = document.createElement('i'); probe.style.color = `var(${t})`; document.querySelector('.process-studio')!.append(probe);
  const colour = getComputedStyle(probe).color; probe.remove(); return colour;
 }, token);
 const paint = (selector: string, property: 'color' | 'backgroundColor') => page.locator(selector).evaluate((e, p) => getComputedStyle(e)[p], property);
 return {actOpen, actRows, tokenColour, paint};
}

export async function activityChecks(studio: Studio): Promise<void> {
 const {page, dir, check, freshStudio, activeId, importFeed, importJson} = studio;
 const {actOpen, actRows, tokenColour, paint} = layoutProbes(page);
 await check('Activity opens as a modal from the toolbar, filters, links to steps and exports without pausing the run', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await freshStudio();
  const opener = page.locator('#open-activity');
  assert.equal(await opener.getAttribute('aria-haspopup'), 'dialog');
  assert.match(await opener.innerText(), /^Activity/);
  assert.equal(await actOpen.count(), 0, 'the modal never opens by itself');
  assert.equal(await page.locator('#show-events').count() + await page.locator('.process-bottom').count() + await page.locator('#events').count(), 0,
   'the bottom Activity tab, panel and 25-event list are gone');
  const placed = await page.evaluate(() => {
   const o = document.getElementById('open-activity')!, g = o.parentElement!, c = document.getElementById('clock')!.getBoundingClientRect(),
    b = o.getBoundingClientRect();
   return {group: g.className, before: [...g.children].indexOf(o) < [...g.children].indexOf(document.getElementById('clock')!.parentElement!),
    gap: c.left - b.right, sameRow: Math.abs(c.top + c.height / 2 - (b.top + b.height / 2)) < 20};
  });
  assert.deepEqual([placed.group, placed.before, placed.gap >= 0 && placed.gap < 40, placed.sameRow], ['run-status', true, true, true],
   'the opener sits immediately left of the clock');
  // Opening while the run plays does not pause it.
  await page.locator('#horizon').selectOption('1440'); await page.locator('#play').click();
  await page.waitForFunction(() => (globalThis as any).LWProcessStudio.query().snapshot.minute > 0);
  await opener.click();
  await actOpen.waitFor();
  assert.equal(await page.evaluate(() => document.querySelector('dialog.act-dialog')!.matches(':modal')), true);
  assert.equal(await page.getByRole('dialog', {name: 'Run activity'}).count(), 1);
  const running = await query(page); assert.equal(running.playing, true);
  await page.waitForFunction(m => (globalThis as any).LWProcessStudio.query().snapshot.minute > m, running.snapshot.minute);
  assert.equal((await query(page)).playing, true, 'the run keeps playing behind the modal');
  assert.deepEqual(await page.locator('#act-scroll thead th').allInnerTexts(), ['Minute', 'Case', 'Event', 'Step', 'Detail']);
  assert.match(await page.locator('#act-subtitle').innerText(), /^Minute [\d,]+ · (showing the latest \d+ of \d+ events|\d+ events)$/);
  assert.equal(await page.locator('#act-rows').evaluate(e => !e.closest('[aria-live]') && !e.closest('[role=status]')), true,
   'the list itself is never a live region');
  assert.deepEqual(await page.locator('#act-scroll thead th').evaluateAll(h => h.map(x => getComputedStyle(x).position)),
   ['sticky', 'sticky', 'sticky', 'sticky', 'sticky']);
  assert.equal(await page.locator('#act-scroll').evaluate(e => getComputedStyle(e).overflowY), 'auto');
  await page.keyboard.press('Escape');
  assert.equal(await activeId(), 'open-activity');
  await page.locator('#play').click();
  assert.equal((await query(page)).playing, false);
  // Filters over the retained events (newest first).
  await opener.click();
  await actOpen.waitFor();
  const events = (await query(page)).snapshot.events, cell = async (col: number) => page.locator(`#act-rows tr td:nth-child(${col})`).allInnerTexts();
  assert.equal(await actRows().count(), events.length);
  assert.deepEqual((await cell(1)).map(t => Number(t.replace(',', ''))), [...events].reverse().map(e => e.minute));
  const kinds = await page.locator('#act-kind option').allInnerTexts();
  assert.equal(kinds[0], 'All kinds');
  for (const k of ['arrived', 'started', 'entered']) assert(kinds.includes(k), k + ' in ' + kinds.join('|'));
  await page.locator('#act-kind').selectOption('started'); const started = events.filter(e => e.kind === 'started');
  assert.equal(await actRows().count(), started.length);
  assert.deepEqual([...new Set(await cell(3))], ['started']);
  assert.match(await page.locator('#act-subtitle').innerText(), new RegExp(`· ${started.length} match$`));
  await page.locator('#act-step').selectOption('discovery');
  assert.deepEqual([...new Set(await page.locator('#act-rows .act-step').allInnerTexts())], ['Discovery']);
  await page.locator('#act-case').selectOption('case-0001'); assert.deepEqual([...new Set(await cell(2))], ['case-0001']);
  await page.locator('#act-clear').click();
  assert.equal(await actRows().count(), events.length);
  assert.equal(await page.locator('#act-clear').isHidden(), true);
  await page.locator('#act-kind').selectOption('arrived'); await page.locator('#act-step').selectOption('discovery');
  assert.match(await page.locator('#act-rows').innerText(), /No events match these filters\. Clear filters/);
  assert.equal(await page.locator('#act-csv').isDisabled(), true);
  assert.equal(await page.locator('#act-json').isDisabled(), true);
  assert.match(await page.locator('#act-reason').innerText(), /no events to export/i);
  await page.locator('[data-act-clear]').click(); assert.equal(await actRows().count(), events.length);
  // A step name selects that step, closes the modal and moves focus to the step's list item.
  await page.locator('#act-step').selectOption('discovery'); await page.locator('#act-rows .act-step').first().click(); assert.equal(await actOpen.count(), 0);
  assert.equal((await query(page)).selected, 'discovery');
  assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.step), 'discovery');
  // Exports respect the filters and are named after the process.
  await opener.click(); await actOpen.waitFor(); assert.equal(await page.locator('#act-step').inputValue(), 'discovery', 'filters are kept between openings');
  await page.locator('#act-step').selectOption(''); await page.locator('#act-kind').selectOption('started'); const id = (await query(page)).definition.id;
  let pending = page.waitForEvent('download');
  await page.locator('#act-csv').click();
  let saved = await pending;
  assert.equal(saved.suggestedFilename(), id + '.events.csv');
  const csvFile = path.join(dir, 'events.csv'); await saved.saveAs(csvFile); const lines = fs.readFileSync(csvFile, 'utf8').trim().split('\r\n');
  assert.equal(lines[0], 'minute,case,event,step_id,step,detail');
  assert.equal(lines.length - 1, started.length);
  assert(lines.slice(1).every(l => l.split(',')[2] === 'started'));
  pending = page.waitForEvent('download');
  await page.locator('#act-json').click();
  saved = await pending;
  assert.equal(saved.suggestedFilename(), id + '.events.json');
  const jsonFile = path.join(dir, 'events.json'); await saved.saveAs(jsonFile); const exported = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  assert.equal(exported.format, 'wildlands-process-events');
  assert.equal(exported.process, id);
  assert.equal(exported.filters.kind, 'started');
  assert.equal(exported.events.length, started.length);
  assert.deepEqual(exported.events.map((e: {minute: number}) => e.minute), started.map(e => e.minute), 'exported oldest first');
  assert.equal(await actOpen.count(), 1, 'exporting keeps the modal open');
  await page.keyboard.press('Escape'); assert.equal(await activeId(), 'open-activity');
  // CSV is escaped (quotes, commas) and spreadsheet formulas are neutralised; an empty feed explains itself.
  await importFeed();
  await page.locator('#step').click();
  await opener.click();
  await actOpen.waitFor();
  await page.locator('#act-kind').selectOption('started');
  pending = page.waitForEvent('download');
  await page.locator('#act-csv').click();
  saved = await pending;
  const feedCsv = path.join(dir, 'feed.csv');
  await saved.saveAs(feedCsv);
  const csv = fs.readFileSync(feedCsv, 'utf8'); assert(csv.includes(`"'=1+1, ""x"""`), csv); await page.keyboard.press('Escape');
  await importFeed({arrivals: [{at: 100, count: 1, interval: 0, data: {}}]}); await opener.click(); await actOpen.waitFor();
  assert.match(await page.locator('#act-rows').innerText(), /No events yet\. Run the simulation\./);
  assert.match(await page.locator('#act-subtitle').innerText(), /^Minute 0 · 0 events$/);
  assert.equal(await page.locator('#act-csv').isDisabled(), true);
  await page.keyboard.press('Escape');
 });
 await check('Activity freezes while scrolled and shows a new-events pill, the badge counts unseen problems only', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await importFeed();
  const opener = page.locator('#open-activity'), label = () => opener.getAttribute('aria-label');
  // Routine events (arrived, entered, started, routed) never raise the badge.
  await page.locator('#step').click(); assert(((await query(page)).snapshot.events.length) > 0); assert.equal(await opener.innerText(), 'Activity');
  assert.equal(await label(), 'Activity');
  // A full backlog blocks arrivals: the badge counts those problems in the danger tone, and opening the list marks them seen.
  const blocked = feedFixture(); (blocked.steps[1] as Record<string, unknown>).backlog = {capacity: 1};
  await importJson('blocked-line.json', blocked); await page.locator('#step').click();
  assert.equal(await opener.innerText(), 'Activity', 'nothing is blocked yet');
  await page.locator('#advance').click(); const few = await opener.innerText(); assert.match(few, /^Activity · \d+$/); const n = Number(few.split('· ')[1]);
  assert(n >= 1 && n < 99, few);
  assert.equal(await label(), `Activity, ${n} new problem${n === 1 ? '' : 's'}`);
  assert.equal(await paint('#activity-count', 'color'), await tokenColour('--danger-text'), 'the badge uses the danger tone');
  // The step list dot shows live state in the legend colours: the start step holds blocked work and says so; an idle step has no dot.
  const dot = page.locator('[data-step="start"] i');
  assert.deepEqual([await dot.getAttribute('data-state'), await dot.getAttribute('aria-hidden')], ['held', 'true']);
  assert.equal(await paint('[data-step="start"] i', 'backgroundColor'), await tokenColour('--danger'), 'blocked work in the legend colour');
  assert.match(await page.locator('[data-step="start"] small').innerText(), / · \d+ blocked$/);
  assert.equal(await page.locator('[data-step="end"] i').count(), 0, 'an idle step has no state dot');
  for (let i = 0; i < 12 && await opener.innerText() !== 'Activity · 99+'; i++) await page.locator('#advance').click();
  assert.equal(await opener.innerText(), 'Activity · 99+'); assert.equal(await label(), 'Activity, more than 99 new problems');
  await opener.click(); await actOpen.waitFor(); await page.keyboard.press('Escape');
  assert.equal(await opener.innerText(), 'Activity', 'opening marks the problems as seen'); assert.equal(await label(), 'Activity');
  await importFeed(); await page.locator('#advance').click(); await page.locator('#advance').click();
  assert.equal(await opener.innerText(), 'Activity', 'a long routine run stays quiet');
  await opener.click();
  await actOpen.waitFor();
  assert.match(await page.locator('#act-subtitle').innerText(), /showing the latest 128 of \d+ events/);
  assert.equal(await actRows().count(), 128);
  assert.equal(await page.locator('#act-note').isVisible(), true);
  assert.match(await page.locator('#act-note').innerText(), /Earlier events are not kept/);
  await page.keyboard.press('Escape');
  assert.equal(await opener.innerText(), 'Activity');
  // Live: at the top the list follows the run; scrolled or with a filter focused it freezes and a status pill offers the update.
  await page.locator('#play').click(); await opener.click(); await actOpen.waitFor();
  const newest = () => page.locator('#act-rows tr td').first().innerText(), start = await newest();
  await page.waitForFunction(first => document.querySelector('#act-rows tr td')?.textContent !== first, start);
  assert.equal(await page.locator('.act-live').getAttribute('role'), 'status'); assert.equal(await page.locator('#act-new').isHidden(), true);
  await page.locator('#act-scroll').evaluate(e => { e.scrollTop = 240; });
  await page.locator('#act-new').waitFor(); assert.match(await page.locator('#act-new').innerText(), /^\d+ new events? — Show$/);
  const frozen = await page.locator('#act-rows').innerHTML(), count = Number((await page.locator('#act-new').innerText()).split(' ')[0]);
  await page.waitForFunction(c => Number(document.getElementById('act-new')!.textContent!.split(' ')[0]) > c, count);
  assert.equal(await page.locator('#act-rows').innerHTML(), frozen, 'a scrolled list does not move');
  assert(await page.locator('#act-scroll').evaluate(e => e.scrollTop) >= 200); assert.equal((await query(page)).playing, true);
  await page.locator('#act-new').click();
  assert.equal(await page.locator('#act-new').isHidden(), true);
  assert.equal(await page.locator('#act-scroll').evaluate(e => e.scrollTop), 0);
  assert.notEqual(await newest(), start);
  await page.locator('#act-kind').focus();
  await page.locator('#act-new').waitFor();
  const held = await page.locator('#act-rows').innerHTML();
  await page.waitForFunction(() => Number(document.getElementById('act-new')!.textContent!.split(' ')[0]) > 1);
  assert.equal(await page.locator('#act-rows').innerHTML(), held, 'a focused filter holds the list');
  await page.locator('#act-done').focus();
  await page.locator('#act-new').waitFor({state: 'hidden'});
  await page.keyboard.press('Escape');
  // The announcer: a visually hidden polite status that batches at most one sentence per five seconds.
  const announcer = page.locator('#feed-announcer');
  assert.deepEqual([await announcer.getAttribute('role'), await announcer.getAttribute('aria-live'), await announcer.getAttribute('aria-atomic')],
   ['status', 'polite', 'true']);
  const box = (await announcer.boundingBox())!; assert(box.width <= 1 && box.height <= 1);
  await page.evaluate(() => {
   const w = globalThis as any, node = document.getElementById('feed-announcer')!;
   w.feed = [];
   new MutationObserver(() => w.feed.push({t: performance.now(), text: node.textContent}))
    .observe(node, {childList: true, characterData: true, subtree: true});
  });
  await page.waitForFunction(() => (globalThis as any).feed.length >= 2, undefined, {timeout: 25000});
  const feed = await page.evaluate(() => (globalThis as any).feed as {t: number; text: string}[]);
  assert(feed[1]!.t - feed[0]!.t >= 4500, 'one announcement per ~5 s');
  assert.match(feed[0]!.text, /^\d+ new events?, latest: case-\d+ \S/);
  await page.locator('#play').click();
 });
}
