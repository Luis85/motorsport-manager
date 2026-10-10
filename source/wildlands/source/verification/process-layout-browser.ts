/// <reference path="../process-contracts.d.ts" />
/** Process Studio layout: responsive reflow, the desktop fit, the phone layout, the activity modal and fallback-font geometry. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {waitForReady, openArtifact, nextFrames} from './browser-harness';
import {query, OUT, runSuite} from './process-browser-fixture';
import {feedFixture} from './process-browser-models';
runSuite('process layout browser harness', 'process-layout-browser-results.json', async studio => {
 const {page, dir, file, fixtureUrls, check, checkLifecycle, freshStudio, dialogOpen, activeId, switchTo, applyDraft, importFeed, importJson} = studio;
 await check('Desktop and mobile reflow retain controls without horizontal overflow', async () => {
  await openArtifact(page, file, {url: fixtureUrls[0]!}); await waitForReady(page, {host: 'process'});
  await page.locator('[data-step="discovery"]').click(); await page.locator('#step').click(); await nextFrames(page);
  await page.screenshot({path: path.join(OUT, 'process-desktop.png'), fullPage: true});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.setViewportSize({width: 390, height: 844}); await page.screenshot({path: path.join(OUT, 'process-mobile.png'), fullPage: true});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.locator('#mode-2d').click(); assert.equal(await page.locator('#map').isVisible(), true);
  await page.screenshot({path: path.join(OUT, 'process-mobile-2d.png'), fullPage: true});
  await page.setViewportSize({width: 900, height: 900}); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const long = (await query(page)).definition; long.name = 'LongProcessName'.repeat(8); long.steps[0]!.name = 'LongStepName'.repeat(7);
  await importJson('long-labels.json', long); await page.waitForFunction(name => document.getElementById('process-title')!.textContent === name, long.name);
  await page.locator('[data-step]').first().click();
  for (const width of [1440, 900, 390]) {await page.setViewportSize({width, height: 900}); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);}
  await page.setViewportSize({width: 1440, height: 1060});
 });
 await check('Process switch reflows at phone width without horizontal overflow and wraps long names', async () => {
  await openArtifact(page, file, {url: fixtureUrls[0]!}); await waitForReady(page, {host: 'process'});
  await switchTo(1); await applyDraft(d => {d.name = 'LongProcessName'.repeat(8);});
  for (const width of [390, 900, 1440]) {
   await page.setViewportSize({width, height: 900}); await nextFrames(page);
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'width ' + width);
   const box = (await page.locator('#process-switch').boundingBox())!; assert(box.x >= 0 && box.x + box.width <= width, 'switch inside viewport at ' + width);
   assert.equal(await page.locator('#process-switch-label').isVisible(), true);
  }
  await page.setViewportSize({width: 390, height: 844}); await page.screenshot({path: path.join(OUT, 'process-switch-mobile.png'), fullPage: true});
  await switchTo(0); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.setViewportSize({width: 1440, height: 1060});
 });
 const actOpen = page.locator('dialog.act-dialog[open]'), actRows = () => page.locator('#act-rows tr');
 /** The colour a studio token resolves to, so an element's paint can be compared with the legend's tokens. */
 const tokenColour = (token: string) => page.evaluate(t => {
  const probe = document.createElement('i'); probe.style.color = `var(${t})`; document.querySelector('.process-studio')!.append(probe);
  const colour = getComputedStyle(probe).color; probe.remove(); return colour;
 }, token);
 const paint = (selector: string, property: 'color' | 'backgroundColor') => page.locator(selector).evaluate((e, p) => getComputedStyle(e)[p], property);
 await check('Activity opens as a modal from the toolbar, filters, links to steps and exports without pausing the run', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await freshStudio();
  const opener = page.locator('#open-activity');
  assert.equal(await opener.getAttribute('aria-haspopup'), 'dialog'); assert.match(await opener.innerText(), /^Activity/); assert.equal(await actOpen.count(), 0, 'the modal never opens by itself');
  assert.equal(await page.locator('#show-events').count() + await page.locator('.process-bottom').count() + await page.locator('#events').count(), 0, 'the bottom Activity tab, panel and 25-event list are gone');
  const placed = await page.evaluate(() => { const o = document.getElementById('open-activity')!, g = o.parentElement!, c = document.getElementById('clock')!.getBoundingClientRect(), b = o.getBoundingClientRect();
   return {group: g.className, before: [...g.children].indexOf(o) < [...g.children].indexOf(document.getElementById('clock')!.parentElement!), gap: c.left - b.right, sameRow: Math.abs(c.top + c.height / 2 - (b.top + b.height / 2)) < 20}; });
  assert.deepEqual([placed.group, placed.before, placed.gap >= 0 && placed.gap < 40, placed.sameRow], ['run-status', true, true, true], 'the opener sits immediately left of the clock');
  // Opening while the run plays does not pause it.
  await page.locator('#horizon').selectOption('1440'); await page.locator('#play').click();
  await page.waitForFunction(() => (globalThis as any).LWProcessStudio.query().snapshot.minute > 0);
  await opener.click(); await actOpen.waitFor(); assert.equal(await page.evaluate(() => document.querySelector('dialog.act-dialog')!.matches(':modal')), true); assert.equal(await page.getByRole('dialog', {name: 'Run activity'}).count(), 1);
  const running = await query(page); assert.equal(running.playing, true);
  await page.waitForFunction(m => (globalThis as any).LWProcessStudio.query().snapshot.minute > m, running.snapshot.minute); assert.equal((await query(page)).playing, true, 'the run keeps playing behind the modal');
  assert.deepEqual(await page.locator('#act-scroll thead th').allInnerTexts(), ['Minute', 'Case', 'Event', 'Step', 'Detail']); assert.match(await page.locator('#act-subtitle').innerText(), /^Minute [\d,]+ · (showing the latest \d+ of \d+ events|\d+ events)$/);
  assert.equal(await page.locator('#act-rows').evaluate(e => !e.closest('[aria-live]') && !e.closest('[role=status]')), true, 'the list itself is never a live region');
  assert.deepEqual(await page.locator('#act-scroll thead th').evaluateAll(h => h.map(x => getComputedStyle(x).position)), ['sticky', 'sticky', 'sticky', 'sticky', 'sticky']);
  assert.equal(await page.locator('#act-scroll').evaluate(e => getComputedStyle(e).overflowY), 'auto');
  await page.keyboard.press('Escape'); assert.equal(await activeId(), 'open-activity'); await page.locator('#play').click(); assert.equal((await query(page)).playing, false);
  // Filters over the retained events (newest first).
  await opener.click(); await actOpen.waitFor(); const events = (await query(page)).snapshot.events, cell = async (col: number) => page.locator(`#act-rows tr td:nth-child(${col})`).allInnerTexts();
  assert.equal(await actRows().count(), events.length); assert.deepEqual((await cell(1)).map(t => Number(t.replace(',', ''))), [...events].reverse().map(e => e.minute));
  const kinds = await page.locator('#act-kind option').allInnerTexts(); assert.equal(kinds[0], 'All kinds'); for (const k of ['arrived', 'started', 'entered']) assert(kinds.includes(k), k + ' in ' + kinds.join('|'));
  await page.locator('#act-kind').selectOption('started'); const started = events.filter(e => e.kind === 'started');
  assert.equal(await actRows().count(), started.length); assert.deepEqual([...new Set(await cell(3))], ['started']); assert.match(await page.locator('#act-subtitle').innerText(), new RegExp(`· ${started.length} match$`));
  await page.locator('#act-step').selectOption('discovery'); assert.deepEqual([...new Set(await page.locator('#act-rows .act-step').allInnerTexts())], ['Discovery']);
  await page.locator('#act-case').selectOption('case-0001'); assert.deepEqual([...new Set(await cell(2))], ['case-0001']);
  await page.locator('#act-clear').click(); assert.equal(await actRows().count(), events.length); assert.equal(await page.locator('#act-clear').isHidden(), true);
  await page.locator('#act-kind').selectOption('arrived'); await page.locator('#act-step').selectOption('discovery');
  assert.match(await page.locator('#act-rows').innerText(), /No events match these filters\. Clear filters/); assert.equal(await page.locator('#act-csv').isDisabled(), true); assert.equal(await page.locator('#act-json').isDisabled(), true); assert.match(await page.locator('#act-reason').innerText(), /no events to export/i);
  await page.locator('[data-act-clear]').click(); assert.equal(await actRows().count(), events.length);
  // A step name selects that step, closes the modal and moves focus to the step's list item.
  await page.locator('#act-step').selectOption('discovery'); await page.locator('#act-rows .act-step').first().click(); assert.equal(await actOpen.count(), 0);
  assert.equal((await query(page)).selected, 'discovery'); assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.step), 'discovery');
  // Exports respect the filters and are named after the process.
  await opener.click(); await actOpen.waitFor(); assert.equal(await page.locator('#act-step').inputValue(), 'discovery', 'filters are kept between openings');
  await page.locator('#act-step').selectOption(''); await page.locator('#act-kind').selectOption('started'); const id = (await query(page)).definition.id;
  let pending = page.waitForEvent('download'); await page.locator('#act-csv').click(); let saved = await pending; assert.equal(saved.suggestedFilename(), id + '.events.csv');
  const csvFile = path.join(dir, 'events.csv'); await saved.saveAs(csvFile); const lines = fs.readFileSync(csvFile, 'utf8').trim().split('\r\n');
  assert.equal(lines[0], 'minute,case,event,step_id,step,detail'); assert.equal(lines.length - 1, started.length); assert(lines.slice(1).every(l => l.split(',')[2] === 'started'));
  pending = page.waitForEvent('download'); await page.locator('#act-json').click(); saved = await pending; assert.equal(saved.suggestedFilename(), id + '.events.json');
  const jsonFile = path.join(dir, 'events.json'); await saved.saveAs(jsonFile); const exported = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  assert.equal(exported.format, 'wildlands-process-events'); assert.equal(exported.process, id); assert.equal(exported.filters.kind, 'started'); assert.equal(exported.events.length, started.length);
  assert.deepEqual(exported.events.map((e: {minute: number}) => e.minute), started.map(e => e.minute), 'exported oldest first'); assert.equal(await actOpen.count(), 1, 'exporting keeps the modal open');
  await page.keyboard.press('Escape'); assert.equal(await activeId(), 'open-activity');
  // CSV is escaped (quotes, commas) and spreadsheet formulas are neutralised; an empty feed explains itself.
  await importFeed(); await page.locator('#step').click(); await opener.click(); await actOpen.waitFor(); await page.locator('#act-kind').selectOption('started');
  pending = page.waitForEvent('download'); await page.locator('#act-csv').click(); saved = await pending; const feedCsv = path.join(dir, 'feed.csv'); await saved.saveAs(feedCsv);
  const csv = fs.readFileSync(feedCsv, 'utf8'); assert(csv.includes(`"'=1+1, ""x"""`), csv); await page.keyboard.press('Escape');
  await importFeed({arrivals: [{at: 100, count: 1, interval: 0, data: {}}]}); await opener.click(); await actOpen.waitFor();
  assert.match(await page.locator('#act-rows').innerText(), /No events yet\. Run the simulation\./); assert.match(await page.locator('#act-subtitle').innerText(), /^Minute 0 · 0 events$/); assert.equal(await page.locator('#act-csv').isDisabled(), true); await page.keyboard.press('Escape');
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
  await opener.click(); await actOpen.waitFor(); assert.match(await page.locator('#act-subtitle').innerText(), /showing the latest 128 of \d+ events/); assert.equal(await actRows().count(), 128);
  assert.equal(await page.locator('#act-note').isVisible(), true); assert.match(await page.locator('#act-note').innerText(), /Earlier events are not kept/); await page.keyboard.press('Escape'); assert.equal(await opener.innerText(), 'Activity');
  // Live: at the top the list follows the run; scrolled or with a filter focused it freezes and a status pill offers the update.
  await page.locator('#play').click(); await opener.click(); await actOpen.waitFor();
  const newest = () => page.locator('#act-rows tr td').first().innerText(), start = await newest();
  await page.waitForFunction(first => document.querySelector('#act-rows tr td')?.textContent !== first, start);
  assert.equal(await page.locator('.act-live').getAttribute('role'), 'status'); assert.equal(await page.locator('#act-new').isHidden(), true);
  await page.locator('#act-scroll').evaluate(e => { e.scrollTop = 240; });
  await page.locator('#act-new').waitFor(); assert.match(await page.locator('#act-new').innerText(), /^\d+ new events? — Show$/);
  const frozen = await page.locator('#act-rows').innerHTML(), count = Number((await page.locator('#act-new').innerText()).split(' ')[0]);
  await page.waitForFunction(c => Number(document.getElementById('act-new')!.textContent!.split(' ')[0]) > c, count); assert.equal(await page.locator('#act-rows').innerHTML(), frozen, 'a scrolled list does not move');
  assert(await page.locator('#act-scroll').evaluate(e => e.scrollTop) >= 200); assert.equal((await query(page)).playing, true);
  await page.locator('#act-new').click(); assert.equal(await page.locator('#act-new').isHidden(), true); assert.equal(await page.locator('#act-scroll').evaluate(e => e.scrollTop), 0); assert.notEqual(await newest(), start);
  await page.locator('#act-kind').focus(); await page.locator('#act-new').waitFor(); const held = await page.locator('#act-rows').innerHTML(); await page.waitForFunction(() => Number(document.getElementById('act-new')!.textContent!.split(' ')[0]) > 1);
  assert.equal(await page.locator('#act-rows').innerHTML(), held, 'a focused filter holds the list'); await page.locator('#act-done').focus(); await page.locator('#act-new').waitFor({state: 'hidden'});
  await page.keyboard.press('Escape');
  // The announcer: a visually hidden polite status that batches at most one sentence per five seconds.
  const announcer = page.locator('#feed-announcer'); assert.deepEqual([await announcer.getAttribute('role'), await announcer.getAttribute('aria-live'), await announcer.getAttribute('aria-atomic')], ['status', 'polite', 'true']);
  const box = (await announcer.boundingBox())!; assert(box.width <= 1 && box.height <= 1);
  await page.evaluate(() => { const w = globalThis as any, node = document.getElementById('feed-announcer')!; w.feed = []; new MutationObserver(() => w.feed.push({t: performance.now(), text: node.textContent})).observe(node, {childList: true, characterData: true, subtree: true}); });
  await page.waitForFunction(() => (globalThis as any).feed.length >= 2, undefined, {timeout: 25000}); const feed = await page.evaluate(() => (globalThis as any).feed as {t: number; text: string}[]);
  assert(feed[1]!.t - feed[0]!.t >= 4500, 'one announcement per ~5 s'); assert.match(feed[0]!.text, /^\d+ new events?, latest: case-\d+ \S/); await page.locator('#play').click();
 });
 await check('Header and toolbar fit one desktop viewport without document scrolling and keep exports in a menu', async () => {
  await page.setViewportSize({width: 1366, height: 768}); await freshStudio();
  const fits = () => page.evaluate(() => { const r = (s: string) => document.querySelector(s)!.getBoundingClientRect(), view = r('#viewport'), nav = r('.process-nav'), ins = r('.process-inspector');
   return {docH: document.documentElement.scrollHeight - innerHeight, docW: document.documentElement.scrollWidth - innerWidth, band: r('.process-toolbar').bottom, workspaceBottom: r('.process-workspace').bottom - innerHeight, viewH: view.height, viewW: view.width, navW: nav.width, insW: ins.width,
    navOverflow: getComputedStyle(document.querySelector('.process-nav')!).overflowY, insOverflow: getComputedStyle(document.querySelector('.process-inspector')!).overflowY, io: (document.getElementById('io-panel') as HTMLDetailsElement).open}; });
  for (const [width, height] of [[1366, 768], [1440, 900], [1920, 1080], [2560, 1080], [1100, 700]] as const) {
   await page.setViewportSize({width, height}); await nextFrames(page); const f = await fits(), at = `${width}x${height}`;
   assert(f.docH <= 0 && f.docW <= 0, 'the document does not scroll at ' + at + ' ' + JSON.stringify(f)); assert(f.band <= (width >= 1366 ? 110 : 160), `header and toolbar band is ${f.band}px at ${at}`);
   assert(Math.abs(f.workspaceBottom) <= 1, 'the workspace fills the rest at ' + at); assert(f.viewH >= 320 && f.viewW > f.navW && f.viewW > f.insW, 'the stage is the hero at ' + at + ' ' + JSON.stringify(f)); assert.deepEqual([f.navOverflow, f.insOverflow], ['auto', 'auto']);
   assert.equal(f.io, width >= 1600, 'Inputs & outputs opens by default only on wide screens (' + at + ')');
  }
  await page.setViewportSize({width: 1366, height: 768}); await nextFrames(page);
  const ids = ['process-switch', 'open-definition', 'import', 'export-menu', 'play', 'step', 'advance', 'run-end', 'reset', 'speed', 'horizon', 'seed',
   'open-activity'];
  const heights = await page.evaluate(list => list.map(id => Math.round(document.getElementById(id)!.getBoundingClientRect().height)), ids);
  assert.deepEqual([...new Set(heights)], [36], 'header and toolbar controls share one height');
  assert.equal(await page.locator('.process-toolbar button.primary').count(), 1); assert.equal(await page.locator('#play').getAttribute('class'), 'primary'); assert.match(await page.locator('#reset').getAttribute('class') ?? '', /ghost/);
  assert.equal(await page.locator('#message').evaluate(e => !!e.closest('.process-toolbar') || !e.closest('.process-stagebar')), false, 'the status line lives in the stage header'); assert.equal(await page.locator('#message').getAttribute('role'), 'status');
  assert.doesNotMatch(await page.locator('#process-subtitle').innerText(), /export/i);
  // Exports live in one menu.
  for (const id of ['#json', '#bpmn', '#report', '#html']) assert.equal(await page.locator(id).isHidden(), true, id + ' hides inside the closed menu');
  const trigger = page.locator('#export-menu'); assert.deepEqual([await trigger.getAttribute('aria-haspopup'), await trigger.getAttribute('aria-expanded'), await page.locator('#import').innerText()], ['menu', 'false', 'Import…']);
  await trigger.click(); assert.equal(await trigger.getAttribute('aria-expanded'), 'true'); assert.equal(await activeId(), 'json'); assert.match(await page.locator('#export-hint').innerText(), /use this process\. Download HTML keeps all \d+ processes/);
  assert.deepEqual(await page.locator('#export-items [role=menuitem]:visible').allInnerTexts(),
   ['Export JSON', 'Export BPMN', 'Export BPMN with BPSim', 'Export run report', 'Export run checkpoint…', 'Load checkpoint…', 'Download HTML',
    'New process…', 'Import as a new process…']);
  const focusAfter = async (key: string) => { await page.keyboard.press(key); return activeId(); };
  const keyed = [await focusAfter('ArrowDown'), await focusAfter('End'), await focusAfter('ArrowDown'), await focusAfter('Home'), await focusAfter('ArrowUp')];
  // The Light theme toggle (a menuitemcheckbox, LWProcessTheme) ends the menu, after Import as a new process….
  assert.deepEqual(keyed, ['bpmn', 'theme-item', 'json', 'json', 'theme-item']);
  await page.keyboard.press('Escape'); assert.equal(await activeId(), 'export-menu'); assert.equal(await trigger.getAttribute('aria-expanded'), 'false'); assert.equal(await page.locator('#json').isHidden(), true);
  await page.keyboard.press('ArrowDown'); assert.equal(await activeId(), 'json'); await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowUp'); assert.equal(await activeId(), 'theme-item'); await page.keyboard.press('Escape');
  await trigger.click(); await page.locator('#scene-title').click(); assert.equal(await trigger.getAttribute('aria-expanded'), 'false', 'an outside click closes the menu');
  await trigger.focus(); await page.keyboard.press('Enter'); assert.equal(await activeId(), 'json'); let pending = page.waitForEvent('download'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); let saved = await pending;
  assert.match(saved.suggestedFilename(), /\.bpmn$/); assert.equal(await trigger.getAttribute('aria-expanded'), 'false', 'activating an item closes the menu'); assert.equal(await activeId(), 'export-menu');
  await trigger.click(); pending = page.waitForEvent('download'); await page.locator('#report').click(); saved = await pending; assert.match(saved.suggestedFilename(), /\.report\.json$/);
  // The primary button swaps its label; the stage keeps its place while the run plays.
  await page.locator('#play').click(); assert.equal(await page.locator('#play').innerText(), 'Pause'); await page.locator('#play').click(); assert.equal(await page.locator('#play').innerText(), 'Run simulation');
  // A stopped run moves the primary emphasis to Reset: the disabled Run loses the accent fill, and focus moves from Run to Reset.
  await page.locator('#horizon').selectOption('custom'); await page.locator('#horizon-custom').fill('20');
  await page.locator('#horizon-custom').dispatchEvent('change');
  await page.locator('#play').focus(); await page.keyboard.press('Enter');
  await page.waitForFunction(() => (globalThis as any).LWProcessStudio.query().snapshot.status === 'limit');
  const emphasis = await page.evaluate(() => ({
   primary: [...document.querySelectorAll('.process-toolbar button.primary')].map(b => b.id), focus: document.activeElement?.id,
   reset: !(document.getElementById('reset') as HTMLButtonElement).disabled, play: (document.getElementById('play') as HTMLButtonElement).disabled,
  }));
  assert.deepEqual(emphasis, {primary: ['reset'], focus: 'reset', reset: true, play: true});
  assert.notEqual(await paint('#play', 'backgroundColor'), await tokenColour('--accent'), 'the disabled Run loses the accent fill');
  await page.keyboard.press('Enter');
  assert.deepEqual([await page.locator('#play').getAttribute('class'), await page.locator('#reset').getAttribute('class')], ['primary', 'ghost']);
  await page.locator('#horizon').selectOption('100000');
  // Inputs & outputs: remembered per session, with its own scroll.
  await page.setViewportSize({width: 1920, height: 1080}); await nextFrames(page); assert.equal((await fits()).io, true); assert.equal(await page.locator('#process-data').evaluate(e => getComputedStyle(e).overflowY), 'auto');
  await page.locator('#io-panel > summary').click(); assert.equal((await fits()).io, false); await page.setViewportSize({width: 1366, height: 768}); await page.setViewportSize({width: 2560, height: 1080}); await nextFrames(page); assert.equal((await fits()).io, false, 'the choice outlives resizing');
  // Choosing a step on the map scrolls its list item into view.
  await page.setViewportSize({width: 1366, height: 768}); await nextFrames(page); await page.locator('#mode-2d').click(); const last = (await query(page)).definition.steps.at(-1)!.id; await page.locator(`#process-map-${last}`).click({force: true});
  await page.waitForFunction(id => { const li = document.querySelector(`[data-step="${id}"]`)!.closest('li')!.getBoundingClientRect(), nav = document.querySelector('.process-nav')!.getBoundingClientRect(); return li.bottom <= nav.bottom + 1 && li.top >= nav.top; }, last);
  await page.locator('#mode-3d').click(); await page.locator('#overview').click(); await page.screenshot({path: path.join(OUT, 'process-desktop-fit.png')});
 });
 await check('Phone layout keeps the run bar, step navigation and dialogs usable without horizontal overflow', async () => {
  // A business process opens on the readable 2D map on a phone; 3D stays one press away.
  await page.setViewportSize({width: 390, height: 844}); await freshStudio(); assert.equal((await query(page)).mode, '2d');
  assert.equal(await page.locator('#map').isVisible(), true);
  await page.locator('#mode-3d').click(); assert.equal((await query(page)).mode, '3d'); await page.setViewportSize({width: 1440, height: 1060});
  await freshStudio(); const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  const small = (selector: string) => page.evaluate(s => [...document.querySelectorAll<HTMLElement>(s)].filter(n => n.getClientRects().length && n.getBoundingClientRect().height < 43.5).map(n => n.id || n.textContent), selector);
  for (const [width, height] of [[320, 640], [390, 844], [768, 1024], [1100, 800]] as const) { await page.setViewportSize({width, height}); await nextFrames(page); assert.equal(await noOverflow(), true, `no horizontal overflow at ${width}`); }
  await page.setViewportSize({width: 390, height: 844}); await nextFrames(page);
  const bar = page.locator('.process-toolbar'); assert.equal(await bar.evaluate(e => getComputedStyle(e).position), 'sticky');
  await page.evaluate(() => window.scrollTo(0, 500)); assert(await page.evaluate(() => document.querySelector('.process-toolbar')!.getBoundingClientRect().top) <= 1, 'the run bar stays at the top while the page scrolls'); await page.evaluate(() => window.scrollTo(0, 0));
  for (const id of ['#play', '#step', '#open-activity', '#clock']) assert.equal(await page.locator(id).isVisible(), true, id);
  const folded = ['#advance', '#run-end', '#reset', '#speed', '#horizon', '#seed'];
  for (const id of folded) assert.equal(await page.locator(id).isHidden(), true, id + ' sits under Run options');
  const toggle = page.locator('#run-options-toggle'); assert.deepEqual([await toggle.getAttribute('aria-expanded'), await toggle.innerText()], ['false', 'Run options ▾']); await toggle.click();
  for (const id of folded) assert.equal(await page.locator(id).isVisible(), true, id);
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  assert.deepEqual(await small('.process-toolbar button, .process-toolbar select, .process-toolbar input, .process-header button, .process-header select, .process-nav button'), [], 'touch targets are 44px'); await toggle.click(); assert.equal(await page.locator('#advance').isHidden(), true);
  await page.locator('#play').click(); assert.equal(await page.locator('#play').innerText(), 'Pause'); await page.locator('#play').click(); await page.locator('#step').click(); assert.equal((await query(page)).playing, false);
  // A stopped run keeps Reset outside Run options as the primary action and moves focus to it from the disabled Run; Reset hands focus back to Run.
  await toggle.click(); await page.locator('#speed').selectOption('120'); await toggle.click();
  await page.locator('#play').focus(); await page.keyboard.press('Enter');
  await page.waitForFunction(() => (globalThis as any).LWProcessStudio.query().snapshot.status === 'completed');
  const stopped = () => page.evaluate(() => { const shown = (id: string) => document.getElementById(id)!.getClientRects().length > 0;
   const get = (id: string) => document.getElementById(id)!;
   return [document.activeElement?.id, shown('reset'), get('reset').className, get('play').className, shown('step'), get('run-options-toggle').getAttribute('aria-expanded')];
   });
  assert.deepEqual(await stopped(), ['reset', true, 'primary', '', false, 'false']); assert.equal(await noOverflow(), true);
  await page.screenshot({path: path.join(OUT, 'process-mobile-stopped.png')});
  await page.keyboard.press('Enter'); assert.deepEqual(await stopped(), ['play', false, 'ghost', 'primary', true, 'false']);
  // Compact header: Edit and an overflow menu holding Import and the exports. The short label keeps the full accessible name.
  assert.equal(await page.locator('#open-definition').innerText(), 'Edit');
  assert.equal(await page.getByRole('button', {name: 'Edit process', exact: true}).count(), 1);
  assert.equal(await page.locator('#export-menu').isHidden(), true); assert.equal(await page.locator('#import').isHidden(), true);
  await page.locator('#more-menu').click();
  assert.deepEqual(await page.locator('#export-items [role=menuitem]:visible').allInnerTexts(), ['Import JSON or BPMN…', 'Present slides', 'Dashboard',
   'Add step…', 'Tidy layout', 'Export JSON', 'Export BPMN', 'Export BPMN with BPSim', 'Export run report', 'Export run checkpoint…',
   'Load checkpoint…', 'Download HTML', 'New process…', 'Import as a new process…']);
  const menuBox = (await page.locator('#export-popup').boundingBox())!; assert(menuBox.x >= 0 && menuBox.x + menuBox.width <= 390, 'the menu stays on screen'); await page.keyboard.press('Escape'); assert.equal(await activeId(), 'more-menu');
  // Steps are a horizontal scroller above the stage; the stage is about 45vh; the inspector and Inputs & outputs collapse.
  const layout = await page.evaluate(() => { const nav = document.querySelector('.process-nav')!.getBoundingClientRect(), view = document.getElementById('viewport')!.getBoundingClientRect(), steps = document.getElementById('steps')!;
   return {above: nav.bottom <= view.top + 1, scroller: steps.scrollWidth > document.querySelector('.process-nav')!.clientWidth, row: getComputedStyle(steps).display, viewH: view.height}; });
  assert.deepEqual([layout.above, layout.scroller, layout.row], [true, true, 'flex']); assert(layout.viewH >= 300 && layout.viewH <= 844 * .55, 'stage height ' + layout.viewH);
  await page.locator('#mode-2d').click(); const lastStep = (await query(page)).definition.steps.at(-1)!.id;
  await page.locator(`#process-map-${lastStep}`).scrollIntoViewIfNeeded();
  const scrolled = await page.evaluate(() => scrollY); await page.locator(`#process-map-${lastStep}`).click({force: true});
  await page.waitForFunction(id => { const li = document.querySelector(`[data-step="${id}"]`)!.closest('li')!.getBoundingClientRect(), nav = document.querySelector('.process-nav')!.getBoundingClientRect(); return li.right <= nav.right + 1 && li.left >= nav.left - 1; }, lastStep);
  // Selecting on the map scrolls only the step strip, never the page; a visible control in the stage bar leads back to the whole process.
  const back = await page.evaluate(() => {
   const b = document.getElementById('back-overview')!.getBoundingClientRect(), bar = document.querySelector('.process-toolbar')!.getBoundingClientRect();
   return {y: scrollY, inside: b.left >= 0 && b.right <= innerWidth && b.top >= bar.bottom - .5 && b.bottom <= innerHeight};
  });
  assert.deepEqual(back, {y: scrolled, inside: true}, 'the page stays put and the way back is on screen below the run bar');
  await page.locator('#back-overview').click(); assert.equal((await query(page)).selected, null);
  await page.waitForFunction(() => {
   const o = document.getElementById('overview')!.getBoundingClientRect(), nav = document.querySelector('.process-nav')!.getBoundingClientRect();
   return o.left >= nav.left - 1 && o.right <= nav.right + 1;
  });
  await page.locator(`#process-map-${lastStep}`).click({force: true});
  const inspectorToggle = page.locator('#inspector-toggle'); assert.equal(await inspectorToggle.isVisible(), true); assert.equal(await page.locator('#inspector-body').isVisible(), true); await inspectorToggle.click(); assert.equal(await page.locator('#inspector-body').isHidden(), true); assert.equal(await inspectorToggle.getAttribute('aria-expanded'), 'false'); await inspectorToggle.click();
  assert.equal(await page.locator('#io-panel').evaluate((d: HTMLDetailsElement) => d.open), false); await page.locator('#io-panel > summary').click(); assert.equal(await page.locator('#process-data').isVisible(), true); assert.equal(await noOverflow(), true);
  assert.deepEqual(await small('.process-inspector button, #io-panel summary, .process-view-controls button'), [], 'inspector and stage targets are 44px');
  // Dialogs are full sheets at phone width, down to 320.
  for (const [width, height] of [[390, 844], [320, 640]] as const) {
   await page.setViewportSize({width, height}); await nextFrames(page);
   for (const [opener, dialogSelector, hint] of [['#open-activity', 'dialog.act-dialog[open]', 'activity'], ['#open-definition', 'dialog.de-dialog[open]', 'definition']] as const) {
    await page.locator(opener).click(); await page.locator(dialogSelector).waitFor();
    const g = await page.evaluate(sel => { const d = document.querySelector(sel) as HTMLElement, r = d.getBoundingClientRect(), foot = d.querySelector('.pd-foot')!.getBoundingClientRect(), wide = [...d.querySelectorAll<HTMLElement>('button, select, input, textarea')].filter(n => n.getClientRects().length && (n.getBoundingClientRect().right > r.right + .5 || n.getBoundingClientRect().left < r.left - .5)).map(n => n.id);
     return {box: [r.x, r.y, r.width, r.height], vw: innerWidth, vh: innerHeight, own: d.scrollWidth > d.clientWidth, footBottom: Math.round(foot.bottom), wide}; }, dialogSelector);
    assert.deepEqual(g.box, [0, 0, g.vw, g.vh], `${hint} is a full sheet at ${width}`); assert.deepEqual([g.own, g.wide, g.footBottom], [false, [], g.vh]); assert.equal(await noOverflow(), true);
    if (hint === 'activity') { assert((await actRows().count()) > 0); assert.deepEqual(await small('.act-dialog .act-controls select, .act-dialog .act-step, .act-dialog .pd-foot button'), [], 'activity targets are 44px'); const own = await page.locator('#act-scroll').evaluate(e => e.scrollWidth > e.clientWidth); assert.equal(own, false, 'rows reflow instead of scrolling sideways'); await page.screenshot({path: path.join(OUT, 'process-activity-mobile.png')}); }
    await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 0); assert.equal(await activeId(), opener.slice(1));
   }
  }
  await page.setViewportSize({width: 1440, height: 1060});
 });
 await check('At 400% zoom no focus stop hides under sticky chrome; forced colours, larger text and lens views keep state cues and plain control names',
  async () => {
  // 320x256 is 1280x1024 at 400% zoom: the run bar scrolls away with the page instead of covering the focused control.
  await page.setViewportSize({width: 320, height: 256}); await freshStudio();
  await page.evaluate(() => { scrollTo(0, 0); (document.activeElement as HTMLElement | null)?.blur(); });
  assert.equal(await page.locator('.process-toolbar').evaluate(e => getComputedStyle(e).position), 'static');
  const hidden: string[] = []; let stops = 0;
  for (let i = 0; i < 70; i++) {
   await page.keyboard.press('Tab');
   const f = await page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null; if (!a || a === document.body) return null; const r = a.getBoundingClientRect();
    const pinned = (n: HTMLElement) => ['sticky', 'fixed'].includes(getComputedStyle(n).position) && !n.contains(a) && !a.contains(n)
     && n.getClientRects().length > 0;
    const inside = (c: DOMRect) => r.top >= c.top - .5 && r.bottom <= c.bottom + .5 && r.left >= c.left - .5 && r.right <= c.right + .5;
    const covered = [...document.querySelectorAll<HTMLElement>('body *')].filter(pinned).some(n => inside(n.getBoundingClientRect()));
    return {name: a.id || (a.textContent ?? '').trim().slice(0, 24), hidden: covered || r.bottom <= 0 || r.top >= innerHeight};
   });
   if (!f) continue; stops++; if (f.hidden) hidden.push(f.name);
  }
  assert(stops >= 30, `the walk reached ${stops} stops`); assert.deepEqual(hidden, [], 'no focused control is hidden at 320x256');
  // Forced colours keep the state swatches, the meter fills, the pressed view and the current step.
  await page.setViewportSize({width: 1440, height: 1060}); await page.emulateMedia({forcedColors: 'active'});
  await page.locator('#mode-2d').click(); await page.locator('[data-step="discovery"]').click(); await page.locator('#step').click();
  const forced = await page.evaluate(() => {
   const style = (s: string) => getComputedStyle(document.querySelector(s)!);
   const swatches = [...document.querySelectorAll<Element>('.process-legend [data-legend] svg, .pool-bar i, .process-step i')];
   return {swatches: swatches.length > 0 && swatches.every(i => getComputedStyle(i).forcedColorAdjust === 'none'),
    pressed: [style('#mode-2d').outlineStyle, style('#mode-3d').outlineStyle],
    step: [style('.process-step.selected').borderLeftWidth, style('.process-step:not(.selected)').borderLeftWidth !== '4px']};
  });
  assert.deepEqual(forced, {swatches: true, pressed: ['solid', 'none'], step: ['4px', true]}); await page.emulateMedia({forcedColors: 'none'});
  // A larger default text size widens the side columns (rem) and never splits the step count.
  await page.evaluate(() => { document.documentElement.style.fontSize = '24px'; }); await nextFrames(page);
  const big = await page.evaluate(() => {
   const r = (s: string) => document.querySelector(s)!.getBoundingClientRect(), count = document.getElementById('step-count')!;
   return {nav: r('.process-nav').width, inspector: r('.process-inspector').width, 
    lines: r('#step-count').height / parseFloat(getComputedStyle(count).lineHeight)};
  });
  assert(big.nav >= 13.5 * 24 - 1 && big.inspector >= 16.5 * 24 - 1 && big.lines < 1.5, JSON.stringify(big));
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  // Decorative glyphs stay out of accessible names; the metrics are a named group; lens views show no work-marker legend.
  const snapshot = async (selectors: string[]) => (await Promise.all(selectors.map(s => page.locator(s).ariaSnapshot()))).join('\n');
  const names = await snapshot(['.process-header', '.process-toolbar', '.process-stage']);
  assert.doesNotMatch(names, /[▾▸←]/); assert.match(names, /button "Export"/); assert.match(names, /group "Run metrics"/);
  await page.setViewportSize({width: 390, height: 844}); await nextFrames(page);
  const phone = await snapshot(['.process-toolbar', '.process-inspector']);
  assert.match(phone, /button "Run options"/); assert.match(phone, /button "Details"/); assert.doesNotMatch(phone, /[▾▸]/);
  await page.setViewportSize({width: 1440, height: 1060}); assert(await page.locator('.process-legend [data-legend]:visible').count() > 0);
  await page.locator('#mode-lens').click();
  assert.deepEqual(await page.locator('.process-legend > :visible').evaluateAll(n => n.map(x => x.id)), ['camera-hint']);
  await page.locator('#mode-2d').click(); assert(await page.locator('.process-legend [data-legend]:visible').count() > 0);
 });
 // Hosted CI has no Inter and falls back to DejaVu Sans, which is wider: a toolbar that fits locally can wrap there.
 // Forcing that font here makes the fit and phone geometry independent of the fonts the host happens to have.
 const renderedFamilies = async (selectors: string[]) => {
  const cdp = await page.context().newCDPSession(page), out: Record<string, string[]> = {};
  try {
   await cdp.send('DOM.enable'); await cdp.send('CSS.enable'); const {root} = await cdp.send('DOM.getDocument');
   for (const selector of selectors) {
    const {nodeId} = await cdp.send('DOM.querySelector', {nodeId: root.nodeId, selector});
    out[selector] = [...new Set((await cdp.send('CSS.getPlatformFontsForNode', {nodeId})).fonts.map(f => f.familyName))];
   }
  } finally {await cdp.detach();}
  return out;
 };
 /** Header and toolbar geometry: band bottom, the top of each run group shown, document overflow, and controls that leave the viewport or clip their own content. */
 const headerGeometry = () => page.evaluate(() => {
  const shown = (n: Element) => n.getClientRects().length > 0 && !n.closest('.process-menu-popup');
  const controls = [...document.querySelectorAll<HTMLElement>('.process-header button, .process-header select, .process-header label, .process-toolbar button, .process-toolbar select, .process-toolbar input, .process-toolbar label, .process-toolbar output')].filter(shown);
  const name = (n: HTMLElement) => n.id || n.className || n.tagName;
  return {band: document.querySelector('.process-toolbar')!.getBoundingClientRect().bottom, docW: document.documentElement.scrollWidth - innerWidth, docH: document.documentElement.scrollHeight - innerHeight,
   rows: ['.run-actions', '.run-config', '.run-status'].map(s => document.querySelector(s)!).filter(shown).map(n => Math.round(n.getBoundingClientRect().top)),
   offscreen: controls.filter(n => n.getBoundingClientRect().left < -0.5 || n.getBoundingClientRect().right > innerWidth + 0.5).map(name),
   clipped: controls.filter(n => !['SELECT', 'INPUT'].includes(n.tagName) && n.scrollWidth > n.clientWidth + 1).map(name)};
 });
 await check('Desktop fit and phone layout keep one toolbar row, no overflow and no clipped header controls in the wider DejaVu Sans fallback font', async () => {
  await page.setViewportSize({width: 1366, height: 768}); await freshStudio();
  await page.addStyleTag({content: '*{font-family:"DejaVu Sans",sans-serif !important}'}); await nextFrames(page);
  // Never pass vacuously: the header and toolbar text must really be drawn with DejaVu Sans, so a host without the font fails here.
  for (const [selector, families] of Object.entries(await renderedFamilies(['#process-title', '#open-definition', '#export-menu', '#play', '#open-activity']))) {
   assert.deepEqual(families, ['DejaVu Sans'], `${selector} renders with ${families.join(', ') || 'no font'}; DejaVu Sans must be installed for this check`);
  }
  for (const [width, height] of [[1366, 768], [1440, 900], [1920, 1080], [2560, 1080], [1100, 700]] as const) {
   await page.setViewportSize({width, height}); await nextFrames(page); const g = await headerGeometry(), at = `${width}x${height} ` + JSON.stringify(g);
   assert(g.docH <= 0 && g.docW <= 0, 'the document does not scroll at ' + at); assert(g.band <= (width >= 1366 ? 110 : 160), `header and toolbar band is ${g.band}px at ${at}`);
   if (width >= 1366) assert.equal(new Set(g.rows).size, 1, 'run actions, settings and status share one toolbar row at ' + at);
   assert.deepEqual([g.offscreen, g.clipped], [[], []], 'no header or toolbar control leaves the viewport or clips its label at ' + at);
   if (width === 1366) await page.screenshot({path: path.join(OUT, 'process-desktop-fit-dejavu.png')});
  }
  // A custom run length that has been reached (minutes field, long status, hours reading) still fits one row without a stray divider.
  await page.setViewportSize({width: 1366, height: 768}); await page.locator('#horizon').selectOption('custom');
  await page.locator('#horizon-custom').fill('95'); await page.locator('#horizon-custom').dispatchEvent('change');
  for (let i = 0; i < 4; i++) if (await page.locator('#advance').isEnabled()) await page.locator('#advance').click();
  assert.equal(await page.locator('#run-status').innerText(), 'Run limit reached'); assert.equal(await page.locator('#clock-hours').innerText(), '1.6 h');
  assert.equal(await page.locator('#horizon-custom').evaluate(e => getComputedStyle(e).appearance), 'textfield', 'no spin buttons, like the seed field');
  for (const [width, height] of [[1366, 768], [1440, 900], [1920, 1080]] as const) {
   await page.setViewportSize({width, height}); await nextFrames(page);
   const g = await headerGeometry(), at = `custom run length at ${width}x${height} ` + JSON.stringify(g);
   assert(g.band <= 110, at); assert.equal(new Set(g.rows).size, 1, 'one toolbar row with a custom run length at ' + at);
   assert.deepEqual([g.offscreen, g.clipped], [[], []], at);
   const rules = await page.evaluate(() => ['.run-config', '.run-status'].map(s => getComputedStyle(document.querySelector(s)!).borderLeftStyle));
   assert.deepEqual(rules, ['none', 'none'], 'groups are separated by space, so a wrapped row never starts with a divider');
   if (width === 1366) await page.screenshot({path: path.join(OUT, 'process-desktop-custom-dejavu.png')});
  }
  for (const [width, height] of [[320, 640], [390, 844], [768, 1024], [1100, 800]] as const) {
   await page.setViewportSize({width, height}); await nextFrames(page); let g = await headerGeometry();
   assert.deepEqual([g.docW <= 0, g.offscreen, g.clipped], [true, [], []], `phone and tablet layout at ${width}x${height} ` + JSON.stringify(g));
   const toggle = page.locator('#run-options-toggle');
   if (await toggle.isVisible()) {
    await toggle.click(); await nextFrames(page); g = await headerGeometry();
    assert.deepEqual([g.docW <= 0, g.offscreen, g.clipped], [true, [], []], `open run options at ${width}x${height} ` + JSON.stringify(g)); await toggle.click();
   }
   if (width === 390) await page.screenshot({path: path.join(OUT, 'process-mobile-dejavu.png'), fullPage: true});
  }
  await freshStudio();
 });
 await checkLifecycle('Process layout browser lifecycle emits no runtime errors or network requests');
});
