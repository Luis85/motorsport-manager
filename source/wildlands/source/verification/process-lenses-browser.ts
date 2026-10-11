/// <reference path="../process-contracts.d.ts" />
/**
 * Process Studio lenses: plain-language random views, the SIPOC view (process-lenses-sipoc-checks.ts), the journey map
 * (process-lenses-journey-checks.ts) and the lens that follows the process type.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {nextFrames} from './browser-harness';
import {query, runSuite} from './process-browser-fixture';
import {randomLine} from './process-browser-models';
import {sipocLensChecks} from './process-lenses-sipoc-checks';
import {journeyMapChecks} from './process-lenses-journey-checks';
runSuite('process lenses browser harness', 'process-lenses-browser-results.json', async studio => {
 const {page, gameDir, gameDefinitions, COUNT, check, checkLifecycle, freshStudio, showIo, switchTo, applyDraft, importJson} = studio;
 await check('Random view helpers describe distributions, draws, chance routes and arrival streams in plain language', async () => {
  await freshStudio();
  const out = await page.evaluate(() => {
   const v = (globalThis as unknown as {LWProcessRandomView: LWProcessRandomView.Api}).LWProcessRandomView;
   return [v.describeDist({dist: 'triangular', min: 4, mode: 6, max: 10}), v.describeDist({dist: 'uniform', min: 7, max: 11}),
    v.describeDist({dist: 'exponential', mean: 4, max: 12}), v.describeDist({dist: 'exponential', mean: 4}),
    v.describeTiming({duration: 12}), v.describeTiming({duration: 12, timing: {dist: 'uniform', min: 7, max: 11}}), v.describeTiming({until: 5}),
    v.describeTiming({duration: 9, timing: {dist: 'uniform', min: 7, max: 11}}),
    v.describeTiming({duration: 720, timing: {dist: 'triangular', min: 240, mode: 720, max: 1800}}),
    v.describeDraw({field: 'defect', kind: 'chance', percent: 12}),
    v.describeDraw({field: 'priority', kind: 'choice', values: [{value: 'express', weight: 20}, {value: 'standard', weight: 80}]}),
    v.describeDraw({field: 'x', kind: 'int', min: 1, max: 6}), v.describeDraw({field: 'ok', kind: 'chance', percent: 30, whenTrue: 'pass', whenFalse: 'fail'}),
    v.describeWhen({chance: 8}), v.describeWhen({field: 'iteration', op: 'lt', valueField: 'iterations'} as unknown as LWProcess.Condition),
    v.describeWhen({field: 'priority', op: 'eq', value: 'express'}), v.describeWhen(undefined),
    v.describeArrival({at: 0, open: true, interval: 4, gap: {dist: 'exponential', mean: 4}, data: {}}),
    v.describeArrival({at: 10, until: 600, interval: 5, data: {}}), v.describeArrival({at: 0, count: 8, interval: 3, data: {}})];
  });
  assert.deepEqual(out, ['Random between 4 and 10 min, most often 6', 'Uniform 7–11 min', 'Exponential, mean 4 min (max 12)', 'Exponential, mean 4 min',
   'Takes 12 min',
   'Planned 12 min; draws average about 9 min; each visit draws its own time: Uniform 7–11 min', '',
   'Planned 9 min (the average shown in estimates); each visit draws its own time: Uniform 7–11 min',
   'Planned 720 min; draws average about 920 min; each visit draws its own time: Random between 240 and 1800 min, most often 720',
   'Sets defect to true in 12% of cases, otherwise false', 'Sets priority to express (20%) or standard (80%)',
   'Sets x to a whole number from 1 to 6', 'Sets ok to pass in 30% of cases, otherwise fail', '8% of cases take this path', 'If iteration < iterations',
   'If priority = "express"', 'Otherwise (no condition)',
   'Keeps arriving: every ~4 min, random gap (exponential, mean 4), first at minute 0', 'Until minute 600: every 5 min, first at minute 10',
   '8 cases: every 3 min, first at minute 0']);
 });
 await check('Inspector shows random timing, outcomes, chance routes and the arrival stream in plain language', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await freshStudio();
  const long = 'A long walk through a random packing line. '.repeat(10).trim(), random = {...randomLine(), id: 'plain-random', name: 'Plain random',
   description: long, arrivals: [{at: 0, open: true, interval: 4, gap: {dist: 'exponential', mean: 4}, data: {}}, {at: 10, count: 8, interval: 3, data: {}}]};
  (random.steps[1] as any).timing = {dist: 'uniform', min: 7, max: 11};
  (random.steps[1] as any).draws = [{field: 'defect', kind: 'chance', percent: 12}];
  (random.resources[0] as any).capacity = 1;
  await importJson('plain-random.json', random); const text = () => page.locator('#inspector').innerText();
  const overview = await text();
  assert.match(overview, /Arrivals/);
  assert.match(overview, /Keeps arriving: every ~4 min, random gap \(exponential, mean 4\), first at minute 0/);
  assert.match(overview, /8 cases: every 3 min, first at minute 10/);
  assert.match(overview, /Seed\s*1/); assert.match(overview, /Steps\s*7/);
  assert.equal(await page.evaluate(() => {
   const pools = document.getElementById('pools')!, inspector = document.getElementById('inspector')!;
   return !!(pools.compareDocumentPosition(inspector) & Node.DOCUMENT_POSITION_FOLLOWING)
    && document.getElementById('pools-title')!.textContent === 'Shared resources';
  }), true, 'Shared resources come first');
  // The long description is clamped to three lines behind a More disclosure.
  const more = page.locator('#desc-more');
  assert.equal(await more.isVisible(), true);
  assert.deepEqual([await more.innerText(), await more.getAttribute('aria-expanded')], ['More', 'false']);
  const lines = () => page.locator('#process-desc').evaluate(e => ({
   shown: e.clientHeight, full: e.scrollHeight, line: parseFloat(getComputedStyle(e).lineHeight)}));
  let l = await lines();
  assert(l.shown <= l.line * 3 + 2 && l.full > l.shown, JSON.stringify(l));
  await more.click();
  assert.deepEqual([await more.innerText(), await more.getAttribute('aria-expanded')], ['Less', 'true']);
  l = await lines();
  assert(l.shown >= l.full - 1 && l.shown > l.line * 3, JSON.stringify(l));
  await more.click();
  assert.equal(await more.innerText(), 'More');
  await page.locator('[data-step="pack"]').click(); let detail = await text();
  assert.match(detail, /Random timing/); assert.match(detail, /Random outcomes/);
  const timing = /Planned 12 min; draws average about 9 min; each visit draws its own time: Uniform 7–11 min/;
  assert.match(detail, timing); assert.match(detail, /Sets defect to true in 12% of cases, otherwise false/);
  await page.locator('[data-step="gate"]').click(); detail = await text(); const next = await page.locator('.next-step').allInnerTexts();
  assert.deepEqual(next, ['Repack\n20% of cases take this path', 'Done\nOtherwise, 80% of cases']);
  await page.locator('[data-step="repack"]').click();
  detail = await text();
  assert.doesNotMatch(detail, /Random timing|Random outcomes/);
  assert.match(detail, /Takes|Duration/);
  await page.locator('[data-step="pack"]').click(); assert.equal(await page.locator('.process-random').count(), 1);
  // Resource meters: 8px bars on a #2c3744 track, filled by utilisation, with the percentage beside the name.
  await page.locator('#horizon').selectOption('100000'); for (let i = 0; i < 4; i++) await page.locator('#advance').click();
  const meter = page.locator('#pools [role=meter]').first(), pct = Number(await meter.getAttribute('aria-valuenow'));
  assert(pct > 0 && pct <= 100);
  assert.equal(await meter.getAttribute('aria-label'), 'Operators utilisation');
  assert.equal(await page.locator('#pools .pool-pct').first().innerText(), pct + '%');
  const bar = await meter.evaluate(e => ({h: e.getBoundingClientRect().height, track: getComputedStyle(e).backgroundColor,
   fill: getComputedStyle(e.firstElementChild!).backgroundColor, level: (e as HTMLElement).dataset.level}));
  const busy = (await query(page)).snapshot.resources[0]!;
  const valuetext = `${pct}% average utilisation since minute 0${pct >= 85 ? ', nearly full' : ''}; ${busy.busy} of ${busy.capacity} busy now`;
  assert.equal(await meter.getAttribute('aria-valuetext'), valuetext);
  assert.equal(await page.locator('#pools .process-pool small').first().innerText(), `Average since minute 0 · ${busy.busy}/${busy.capacity} busy now`);
  const note = await page.locator('#pools .process-cost-note').innerText();
  assert.match(note, /^Work cost charges pools only for the minutes they work, plus fixed step costs\. Capacity cost charges every pool unit/);
  assert.equal(bar.h, 8);
  assert.equal(bar.track, 'rgb(44, 55, 68)');
  assert.equal(bar.fill, {ok: 'rgb(255, 187, 115)', warm: 'rgb(245, 158, 91)', hot: 'rgb(255, 122, 89)'}[bar.level as 'ok'], JSON.stringify(bar));
  assert.equal(bar.level, pct >= 85 ? 'hot' : pct >= 70 ? 'warm' : 'ok');
  await page.locator('#overview').click();
 });
 await sipocLensChecks(studio);
 await journeyMapChecks(studio);
 const modeOf = async () => (await query(page)).mode, minuteOf = async () => (await query(page)).snapshot.minute;
 const SIPOC_TITLE = 'SIPOC view: suppliers, inputs, process, outputs, customers', JOURNEY_TITLE = 'Journey map: stages, touchpoints, feeling, funnel';
 const lensState = (kind: 'sipoc' | 'journey') => page.evaluate(k => {
  const host = document.getElementById('lens')!, box = host.getBoundingClientRect(), shown = !host.hidden && box.width > 0;
  return {shown, sipoc: host.querySelectorAll('.sipoc').length, journey: host.querySelectorAll('.lw-journey').length,
   canvas: !document.getElementById('canvas')!.hidden, map: !document.getElementById('map')!.hidden, wanted: k, right: box.right, innerWidth};
 }, kind);
 await check('View lens follows the process type: SIPOC for processes, journey map for journeys, with the right default and selection', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await freshStudio();
  const journeyAt = (q: {definition: LWProcess.Definition}) => q.definition.genre === 'customer-journey' || q.definition.genre === 'user-journey';
  // The switcher is [2D] [3D] [lens] [Dashboard] [Present] [Fit to view]; a business process offers SIPOC only, with the stated title and pressed state.
  const controls = ['mode-2d', 'mode-3d', 'mode-lens', 'mode-dashboard', 'mode-present', 'frame'];
  assert.deepEqual(await page.locator('.process-view-controls > button:not([hidden])').evaluateAll(b => b.map(x => x.id)), controls);
  const lensButton = page.locator('#mode-lens');
  assert.equal(await lensButton.innerText(), 'SIPOC');
  assert.equal(await lensButton.getAttribute('title'), SIPOC_TITLE);
  assert.equal(await lensButton.getAttribute('aria-label'), SIPOC_TITLE);
  assert.equal(await lensButton.getAttribute('aria-pressed'), 'false');
  assert.equal(await page.locator('#mode-3d').getAttribute('aria-pressed'), 'true');
  assert.equal(await modeOf(), '3d');
  // Keyboard: the lens button is a plain pressed-state toggle, activated with Enter like 2D and 3D.
  await lensButton.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('mode-lens')!.getAttribute('aria-pressed') === 'true');
  assert.equal(await modeOf(), 'lens');
  assert.equal(await page.locator('#mode-3d').getAttribute('aria-pressed'), 'false');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'mode-lens');
  let state = await lensState('sipoc');
  assert.equal(state.shown, true);
  assert.equal(state.sipoc, 1);
  assert.equal(state.journey, 0);
  assert.equal(state.canvas, false);
  assert.equal(state.map, false);
  assert.equal(await minuteOf(), 0, 'switching the view never ticks');
  // Selecting a stage in the lens selects its first step, shows it in the inspector and keeps the lens; Escape clears it.
  const stage = page.locator('#lens .sipoc-stage').first(); await stage.click();
  const selected = (await query(page)).selected;
  assert(selected, 'the lens selected a step');
  assert.equal(await modeOf(), 'lens');
  assert.equal(await page.locator('#inspector-title').innerText(), 'Scene details');
  assert.equal(await minuteOf(), 0);
  assert.equal(await page.locator(`[data-step="${selected}"]`).getAttribute('aria-current'), 'step');
  assert.equal(await page.locator('#lens .sipoc-stage.selected').count(), 1);
  await page.keyboard.press('Escape'); await page.waitForFunction(() => (globalThis as any).LWProcessStudio.query().selected === null);
  assert.equal(await page.locator('#inspector-title').innerText(), 'Process overview'); assert.equal(await modeOf(), 'lens');
  await page.locator('#lens .sipoc-scroll').evaluate(e => { e.scrollLeft = 40; });
  await page.locator('#frame').click();
  assert.equal(await page.locator('#lens .sipoc-scroll').evaluate(e => e.scrollLeft), 0);
  // The game folder sets each process's type: business processes switch to their SIPOC lens and journeys open on their Journey map.
  // Leaving a journey map for a business process returns to the last flat view, so the lens is chosen again there.
  const seen: string[] = [];
  for (let i = 0; i < COUNT; i++) {
   if (i > 0) await switchTo(i);
   let q = await query(page); const journey = journeyAt(q);
   if (!journey && seen.at(-1) === 'journey') {
    assert.equal(q.mode, '3d', 'leaving a journey map returns to the last flat view');
    await page.locator('#mode-lens').click();
    q = await query(page);
   }
   seen.push(journey ? 'journey' : 'sipoc'); await nextFrames(page);
   assert.equal(q.mode, 'lens', 'process ' + (i + 1)); assert.equal(q.snapshot.minute, 0); assert.equal(q.selected, null);
   state = await lensState(journey ? 'journey' : 'sipoc');
   assert.equal(state.shown, true);
   assert.equal(state.sipoc, journey ? 0 : 1, 'SIPOC for process ' + (i + 1));
   assert.equal(state.journey, journey ? 1 : 0, 'Journey map for process ' + (i + 1));
   assert.equal(await lensButton.innerText(), journey ? 'Journey map' : 'SIPOC');
   assert.equal(await lensButton.getAttribute('title'), journey ? JOURNEY_TITLE : SIPOC_TITLE);
   assert.equal(await lensButton.getAttribute('aria-pressed'), 'true');
   assert.equal(await page.locator('#mode-lens').count(), 1, 'only the matching lens is offered');
  }
  assert.deepEqual(seen, gameDefinitions.map(file => {
   const g = (JSON.parse(fs.readFileSync(path.join(gameDir, file), 'utf8')) as LWProcess.Definition).genre;
   return g === 'customer-journey' || g === 'user-journey' ? 'journey' : 'sipoc';
  }));
  // On a journey, a card selects its step; the inspector shows it; Escape clears; nothing ticks.
  await switchTo(3);
  await nextFrames(page);
  const card = page.locator('#lens .jm-card').nth(1);
  await card.click();
  const picked = (await query(page)).selected;
  assert(picked);
  assert.equal(await card.getAttribute('data-step'), picked);
  assert.equal(await page.locator('#inspector-title').innerText(), 'Scene details');
  assert.equal(await minuteOf(), 0);
  assert.equal(await modeOf(), 'lens');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (globalThis as any).LWProcessStudio.query().selected === null);
  await page.locator('#frame').click();
  // The user's 2D choice is remembered across a journey: 2D on a journey, lens again, then back to a business process returns to 2D.
  await page.locator('#mode-2d').click(); assert.equal(await modeOf(), '2d'); assert.equal((await lensState('journey')).shown, false);
  await page.locator('#mode-lens').click();
  await switchTo(4);
  assert.equal(await modeOf(), 'lens', 'a journey keeps its map when switching to another journey');
  await switchTo(0);
  assert.equal(await modeOf(), '2d', 'leaving a journey from its map returns to the last 2D or 3D choice');
  assert.equal((await lensState('sipoc')).shown, false);
  await page.locator('#mode-3d').click();
  await switchTo(3);
  assert.equal(await modeOf(), 'lens', 'a journey defaults to its map');
  await page.locator('#mode-3d').click();
  await switchTo(4);
  assert.equal(await modeOf(), '3d', 'an explicit 3D choice on a journey stays');
  await switchTo(0); assert.equal(await modeOf(), '3d'); assert.equal(await minuteOf(), 0);
  // Applying a draft that changes the process type swaps the lens, never the chosen view.
  await applyDraft(d => { d.genre = 'customer-journey'; });
  assert.equal(await modeOf(), '3d', 'a 3D choice is not a lens and stays');
  assert.equal(await lensButton.innerText(), 'Journey map');
  assert.equal(await lensButton.getAttribute('title'), JOURNEY_TITLE);
  await lensButton.click(); state = await lensState('journey'); assert.equal(state.journey, 1); assert.equal(state.sipoc, 0);
  await applyDraft(d => { delete d.genre; });
  assert.equal(await modeOf(), 'lens', 'the lens follows the new type');
  state = await lensState('sipoc');
  assert.equal(state.sipoc, 1);
  assert.equal(state.journey, 0);
  assert.equal(await lensButton.innerText(), 'SIPOC');
  await page.locator('#mode-3d').click();
  assert.equal(await page.locator('#canvas').isVisible(), true);
  await lensButton.click();
  await applyDraft(d => { d.name = 'Renamed agency'; });
  assert.equal(await modeOf(), 'lens');
  assert.equal((await lensState('sipoc')).sipoc, 1);
  // Phones: both lenses fit 390px with no page overflow.
  for (const index of [0, 3, 4]) {
   await switchTo(index); await page.setViewportSize({width: 390, height: 844}); await nextFrames(page);
   const q = await query(page);
   await page.locator('#mode-lens').click();
   state = await lensState(q.definition.genre === 'process' || !q.definition.genre ? 'sipoc' : 'journey');
   assert.equal(state.shown, true);
   assert(state.right <= 390 + 1, `lens inside the viewport for process ${index + 1}`);
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal page overflow for process ' + (index + 1));
   await page.setViewportSize({width: 1440, height: 1060});
  }
 });
 await check('Journey terminology, conversion and tracked measures appear for journey processes and not for business processes', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await freshStudio(); await showIo();
  const kpis = async () => Object.fromEntries(await page.locator('#metrics > div').evaluateAll(
   cells => cells.map(c => [c.querySelector('span')!.textContent, c.querySelector('strong')!.textContent])));
  const labelsOf = async () => Object.keys(await kpis());
  // The KPI strip: mean cycle beside the mean age of the cases in progress, then the work cost and the capacity-basis cost.
  const PROCESS_KPIS = ['Completed', 'In progress', 'Mean cycle', 'Mean age in progress', 'Work cost', 'Capacity cost', 'Failed'];
  const JOURNEY_KPIS = ['Finished', ...PROCESS_KPIS.slice(1)];
  // A business process keeps its wording and shows no journey numbers, even after it has run. Nothing has finished yet: Mean cycle is '—'.
  const fresh = await kpis(), m0 = (await query(page)).snapshot.metrics;
  const age0 = m0.meanAgeMinutes === null ? '—' : `${m0.meanAgeMinutes} min`;
  assert.deepEqual([fresh['Mean cycle'], fresh['Mean age in progress'], m0.completed], ['—', age0, 0]);
  assert.deepEqual(await labelsOf(), PROCESS_KPIS); assert.equal(await page.locator('#steps-heading').innerText(), 'Steps');
  assert.equal(await page.locator('label[for="process-case"]').innerText(), 'Case');
  assert.match(await page.locator('#scene-subtitle').innerText(), /\d cases? admitted$/);
  for (let i = 0; i < 6; i++) await page.locator('#advance').click();
  const ran = (await query(page)).snapshot, after = await kpis(); assert(ran.metrics.completed > 0);
  // Durations in the strip use the shared time wording (DOM-7): business minutes with an hours gloss from 120 minutes.
  const cycle = await page.evaluate(n => (globalThis as any).LWProcessTime.span(n) as string, ran.metrics.meanCycleMinutes);
  assert.equal(after['Mean cycle'], cycle); assert.match(cycle, /^[\d,.]+ min( \(≈ [\d,.]+ h\))?$/);
  assert.equal(after['Capacity cost'], Number(ran.metrics.capacityCost.toFixed(1)).toLocaleString());
  assert.deepEqual(await labelsOf(), PROCESS_KPIS);
  assert.doesNotMatch(await page.locator('#inspector').innerText(), /Process type|Tracked measures|Conversion/);
  await page.locator('#open-activity').click();
  await page.locator('dialog.act-dialog[open]').waitFor();
  assert.equal(await page.locator('#act-case-label').innerText(), 'Case');
  assert.equal(await page.locator('#act-case option').first().innerText(), 'All cases');
  await page.keyboard.press('Escape');
  await page.locator('dialog.act-dialog[open]').waitFor({state: 'hidden'});
  // The two journeys: customers and users, journey headings, and conversion with tracked measures once cases have finished.
  for (const [index, one, many, label, tracked] of [
   [3, 'customer', 'customers', 'Customer journey', 'Customer sentiment'], [4, 'user', 'users', 'User journey', 'Sessions']] as const) {
   await switchTo(index); await showIo(); const def = (await query(page)).definition;
   assert.equal(await page.locator('#steps-heading').innerText(), 'Touchpoints and steps');
   assert.equal(await page.locator('label[for="process-case"]').innerText(), one[0]!.toUpperCase() + one.slice(1));
   assert.match(await page.locator('#scene-subtitle').innerText(), new RegExp(`\\d ${one}s? admitted$`)); assert.deepEqual(await labelsOf(), JOURNEY_KPIS);
   assert.match(await page.locator('#inspector').innerText(), new RegExp(`Process type\\s+${label}`));
   assert.doesNotMatch(await page.locator('#inspector [aria-label="Arrival streams"]').innerText(), /\bcases?\b/i);
   for (let i = 0; i < 80; i++) {
    const m = (await query(page)).snapshot.metrics;
    if (m.goals + m.lost >= 3 && Object.values(m.tracked).every(t => t.n > 0)) break;
    await page.locator('#advance').click();
   }
   const q = await query(page), m = q.snapshot.metrics;
   assert(m.goals + m.lost >= 3 && m.conversion !== null, 'the journey finished with outcomes');
   assert.equal(q.snapshot.minute > 0, true);
   const cells = await kpis(), names = Object.keys(cells); assert.deepEqual(names.slice(0, 4), ['Finished', 'Goals', 'Lost', 'Conversion']);
   assert.equal(cells.Goals, String(m.goals)); assert.equal(cells.Lost, String(m.lost)); assert.equal(cells.Conversion, (m.conversion! / 10).toFixed(1) + '%');
   const extra = names.filter(n => n.endsWith(' (avg)'));
   assert.equal(extra.length, Math.min(2, def.track!.length));
   assert(extra.includes(tracked + ' (avg)'), JSON.stringify(extra));
   for (const t of def.track!.slice(0, 2)) assert.equal(cells[(t.label ?? t.field) + ' (avg)'], String(Number(m.tracked[t.field]!.mean!.toFixed(2))));
   // Overview: every tracked measure with its average and range; activity names the cases with the journey word.
   assert.match(await page.locator('#inspector').innerText(), /Tracked measures/);
   for (const t of def.track!) assert.match(await page.locator('#inspector').innerText(), new RegExp(t.label ?? t.field));
   // Step inspector: phase, channel, feeling words, pain, opportunity, funnel numbers and the tracked average on entry.
   const touch = def.steps.find(s => s.kind === 'touchpoint' && s.channel && s.emotion !== undefined && s.pain && s.opportunity)!;
   await page.locator(`#steps [data-step="${touch.id}"]`).click();
   const text = await page.locator('#inspector').innerText(), metric = q.snapshot.steps.find(s => s.id === touch.id)!,
    v = (name: string) => page.evaluate(([n, c, e]) => {
     const api = (globalThis as any).LWProcessRandomView;
     return n === 'channel' ? api.describeChannel(c) : api.describeEmotion(e);
    }, [name, touch.channel, touch.emotion]);
   assert.match(text, new RegExp('Phase\\s+' + touch.phase));
   assert.match(text, new RegExp('Channel\\s+' + (await v('channel'))));
   assert.match(text, new RegExp('Feeling\\s+' + (await v('feeling'))));
   assert.match(text, /Pain point/);
   assert.match(text, /Opportunity/);
   assert.match(text, new RegExp(`Reached\\s+[\\d,]+ ${many}`)); assert.match(text, /Entered\s+[\d,]+ times?/);
   const first = def.track![0]!, seen = (await query(page)).snapshot.steps.filter(s => s.tracked[first.field]?.n).map(s => s.id);
   if (seen.length) {
    await page.locator(`#steps [data-step="${seen[0]}"]`).click();
    assert.match(await page.locator('#inspector').innerText(), new RegExp(`Average ${first.label ?? first.field} on entry\\s+-?[\\d.]+`));
   }
   assert(metric.reached >= 0);
   const end = def.steps.find(s => s.kind === 'end' && s.outcome === 'goal')!;
   await page.locator(`#steps [data-step="${end.id}"]`).click();
   assert.match(await page.locator('#inspector').innerText(), /Goal reached/);
   await page.locator('#overview').click(); await page.locator('#open-activity').click(); await page.locator('dialog.act-dialog[open]').waitFor();
   assert.equal(await page.locator('#act-case-label').innerText(), one[0]!.toUpperCase() + one.slice(1));
   assert.equal(await page.locator('#act-case option').first().innerText(), 'All ' + many);
   await page.keyboard.press('Escape');
   await page.locator('dialog.act-dialog[open]').waitFor({state: 'hidden'});
  }
  await switchTo(0); assert.deepEqual(await labelsOf(), PROCESS_KPIS); assert.equal(await page.locator('#steps-heading').innerText(), 'Steps');
  assert.equal(await page.locator('label[for="process-case"]').innerText(), 'Case');
 });
 await checkLifecycle('Process lenses browser lifecycle emits no runtime errors or network requests');
});
