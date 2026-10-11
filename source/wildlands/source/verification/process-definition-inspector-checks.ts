/// <reference path="../process-contracts.d.ts" />
/**
 * Companion of process-definition-browser.ts (the suite near its size budget): the inspector's read-model analytics at a pinned
 * minute of the agency demo, its modelling notes and rounding note, its calendar wording and a hostile definition rendered as text.
 * Registered under the `process-definition-browser` suite; the suite entry calls `inspectorChecks` before its lifecycle check.
 */
import assert from 'node:assert/strict';
import {query, type Studio} from './process-browser-fixture';

/** Closes a quote, opens an element with a handler: harmless only when every view escapes it. Short enough for every name field. */
const HOSTILE = '"><img src=x onerror=__pwned=1>';

export async function inspectorChecks(studio: Studio): Promise<void> {
 const {page, check, freshStudio, applyDraft, showIo} = studio;
 const inspector = () => page.locator('#inspector').innerText();
 const select = async (id: string) => {
  await page.locator(`#steps [data-step="${id}"]`).click();
  await page.waitForFunction(s => (globalThis as any).LWProcessStudio.query().selected === s, id);
 };
 const advanceTo = async (minute: number) => {
  while ((await query(page)).snapshot.minute < minute) await page.locator('#advance').click();
  assert.equal((await query(page)).snapshot.minute, minute, 'Advance moves 30 minutes at a time');
 };
 const kpi = (label: string) => page.locator('#metrics > div', {has: page.locator('span', {hasText: new RegExp(`^${label}$`)})}).locator('strong').innerText();
 const span = (n: number, calendar?: LWProcess.Calendar) =>
  page.evaluate(([v, c]) => (globalThis as any).LWProcessTime.span(v, c) as string, [n, calendar] as const);

 await check('The inspector shows mean wait, work cost, idle cost and throughput at minute 120 of the agency demo without ticking', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await freshStudio();
  assert.match(await inspector(), /Throughput\s+—/, 'no throughput at minute 0');
  await advanceTo(120);
  const before = (await query(page)).snapshot;
  // Pinned agency numbers at minute 120: two cases finished, so one case per business hour.
  assert.match(await inspector(), /Throughput\s+1 case finished per business hour/);
  const pools = await page.locator('#pools').innerText();
  assert.match(pools, /Developers[\s\S]*Work cost 546 of 720 capacity cost · idle cost 174/);
  assert.match(pools, /Product owner[\s\S]*Work cost 168 of 240 capacity cost · idle cost 72/);
  assert.match(pools, /Idle cost is capacity cost minus work cost\./);
  await select('discovery'); const detail = await inspector();
  assert.match(detail, /Mean wait per start\s+20 min/); assert.match(detail, /Work cost\s+204 = 60 fixed \+ 144 for pool minutes/);
  assert.match(detail, /Total queue time\s+120 min \(≈ 2 h\)/, 'a wait of two hours reads in minutes with an hours gloss');
  await select('architecture'); assert.match(await inspector(), /Mean wait per start\s+3\.3 min/);
  await select('intake'); assert.doesNotMatch(await inspector(), /Mean wait per start|Work cost/, 'the start step has no work starts');
  assert.equal(await kpi('Mean cycle'), await span(before.metrics.meanCycleMinutes));
  assert.deepEqual((await query(page)).snapshot, before, 'reading the inspector never ticks the run');
 });

 await check('The inspector lists modelling notes and shows the rounding note beside Random timing in the inspector and the step editor', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await freshStudio();
  assert.equal(await page.locator('#inspector .process-notes').count(), 0, 'the agency demo has no modelling notes');
  await applyDraft(d => {
   d.steps.find(s => s.id === 'discovery')!.timing = {dist: 'exponential', mean: 2};
   d.arrivals[0]!.gap = {dist: 'exponential', mean: 1};
  });
  const lead = 'Whole-minute rounding: an exponential distribution with mean ';
  const step = lead + '2 min draws about 2.2 min on average.', gap = lead + '1 min draws about 1.4 min on average.';
  assert.deepEqual(await page.locator('#inspector .process-notes li').allInnerTexts(), [`Discovery, random timing: ${step}`, `Arrival 1, random gap: ${gap}`]);
  assert.equal(await page.locator('#inspector .process-notes').getAttribute('aria-label'), 'Modelling notes');
  await select('discovery');
  assert.equal(await page.locator('#inspector .process-random + .process-rounding').innerText(), step, 'the note follows the Random timing sentence');
  await page.locator('#edit-step').click(); await page.locator('#se-name').waitFor();
  assert.equal(await page.locator('#se-timing-rounding').innerText(), step, 'the step editor shows the same note in Random timing');
  await page.locator('#se-close').click(); await page.locator('dialog.pd-dialog[open]').waitFor({state: 'hidden'});
  await select('product-design'); assert.equal(await page.locator('#inspector .process-rounding').count(), 0, 'a step without random timing has no note');
 });

 await check('The inspector and the KPI strip word durations with the display calendar', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await freshStudio();
  const calendar = {minutesPerDay: 60, daysPerWeek: 5};
  await applyDraft(d => { d.calendar = calendar; });
  await advanceTo(210);
  const q = (await query(page)).snapshot; assert(q.metrics.completed > 0 && q.metrics.meanCycleMinutes >= 60, 'cases finish after more than one business day');
  const cycle = await kpi('Mean cycle');
  assert.equal(cycle, await span(q.metrics.meanCycleMinutes, calendar)); assert.match(cycle, /^[\d,.]+ min \((≈ )?[\d.]+ business days?\)$/);
  const age = await kpi('Mean age in progress');
  assert.equal(age, q.metrics.meanAgeMinutes === null ? '—' : await span(q.metrics.meanAgeMinutes, calendar));
  await select('discovery'); const detail = await inspector();
  assert.match(detail, /Total queue time\s+120 min \(2 business days\)/);
  assert.match(detail, /Mean wait per start\s+20 min/, 'a wait under one day stays in minutes');
  assert.match(detail, /Duration\s+12 min/);
 });

 await check('A hostile definition renders as text in the inspector, the pools, the KPI strip and Inputs & outputs and runs no handler', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await freshStudio();
  await applyDraft(d => {
   const discovery = d.steps.find(s => s.id === 'discovery')!;
   d.name = HOSTILE; d.description = HOSTILE; discovery.name = HOSTILE; discovery.description = HOSTILE + ' work';
   discovery.set = {...discovery.set, verdict: HOSTILE}; discovery.outputs = [{field: 'verdict', label: HOSTILE}];
   d.resources[0]!.name = HOSTILE; d.flows.find(f => f.from === 'discovery')!.label = HOSTILE;
   for (const a of d.arrivals) a.data.note = HOSTILE;
  });
  await advanceTo(60); await showIo();
  const images = () => page.locator('#inspector img, #pools img, #metrics img, #process-data img, #steps img').count();
  const pwned = () => page.evaluate(() => (globalThis as any).__pwned);
  assert.equal(await images(), 0); assert.equal(await pwned(), undefined);
  assert.match(await inspector(), new RegExp(HOSTILE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'the description is shown as text');
  assert.match(await page.locator('#pools').innerText(), /"><img src=x onerror=__pwned=1>/);
  await select('discovery'); const detail = await inspector();
  assert.match(detail, /"><img src=x onerror=__pwned=1> work/); assert.match(detail, /verdict = "\\"><img src=x onerror=__pwned=1>"/);
  assert.match(await page.locator('#inspector .next-step').first().innerText(), /· "><img src=x onerror=__pwned=1>/);
  assert.match(await page.locator('#process-data').innerText(), /"><img src=x onerror=__pwned=1>/, 'case data shows the value as text');
  assert.equal(await images(), 0); assert.equal(await pwned(), undefined);
 });
}
