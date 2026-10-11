/// <reference path="../process-contracts.d.ts" />
/// <reference path="../process-slides-contracts.d.ts" />
/**
 * Process Studio scale suite: a generated process exactly at the definition limits (`process-scale-models.ts`: 128 steps, 256
 * flows, four pools, decisions, forks, timers, deadlines and multiple instances) built as a game and imported as JSON. It checks,
 * with measured numbers in every assertion, the initial load, the 2D draw and a keyed incremental refresh, 3D draw calls within
 * the renderer budget, the Dashboard, Present building and paging, keyboard reach of the step list and the roving map focus,
 * numbered cards with their key and no horizontal overflow at 1366 x 768, and that Run to end over 10,000 minutes leaves the page
 * painting again promptly. Durations are measured in the page (`process-scale-probe.ts`); waits are explicit conditions.
 *
 * Bounds: each is about four times or more the largest duration measured on the shared 4-core review machine (load average 11
 * to 25 from other agents) in six runs, two of them beside three other browser suites, so a regression of the kind the review
 * found (a synchronous rebuild per refresh, a leaked renderer, an unbounded deck, a frozen page) fails while load alone does not.
 * The measured range is in the comment beside each bound; every run prints its values in the console line
 * `process-scale-measurements`.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {nextFrames, openArtifact, waitForReady} from './browser-harness';
import {buildGame, query, runSuite} from './process-browser-fixture';
import {DRAW_CALL_BUDGET} from './process-renderers-3d-checks';
import {SCALE, scaleProcess} from './process-scale-models';
import {drawCalls, frameGaps, scaleInit, timeClick} from './process-scale-probe';

/** Upper bounds in milliseconds (see the header), each with the range measured. */
const BOUND = {
 /** Navigation start to the ready signal of the 128-step game page: measured 1,089 to 2,448 ms. */
 load: 12000,
 /** The same with three more cores kept busy by workers in another tab: measured 5,989 to 16,451 ms (the bound stays under the 60 s navigation budget). */
 loadBusy: 45000,
 /** Import of the 128-step JSON, file chosen to the Imported message: measured 117 to 4,934 ms. */
 import: 20000,
 /** Whole map drawn after choosing 2D: measured 68 to 1,043 ms. */
 draw2d: 5000,
 /** Map refreshed after one Advance (30 minutes of work, keyed patch): measured 302 to 1,472 ms. */
 refresh2d: 6000,
 /** Every Dashboard section rendered after choosing Dashboard: measured 67 to 1,460 ms. */
 dashboard: 8000,
 /** Present opened on its first slide: measured 256 to 1,230 ms; after the Present speed work 258 to 1,234 ms (the first frame dominates). */
 present: 8000,
 /** Mean time to show the next slide while paging through the whole deck: measured 217 to 391 ms before the Present speed work
  *  (the hidden studio refreshed, laid out and painted behind the dialog, two map draws and an entrance animation per slide), 85 to
  *  192 ms after it; the bound keeps the earlier margin of about five times the largest. */
 page: 1000,
 /**
  * The longest gap between the five frames after Run to end: measured 300 to 517 ms after the engine fast paths, in six runs at load
  * average 7 to 16 from other agents (before them 333 to 600 ms). The long frame is the GPU process swapping the re-rastered map
  * (SwiftShader), not page script.
  */
 frame: 2200,
 /**
  * Run to end over 10,000 minutes, the click to the first frame after it: measured 762 to 1,202 ms in the same six runs after the
  * engine fast paths (token index, join plan, direct clock step; before them 2,257 to 3,138 ms under a 20,000 ms bound, whose margin
  * this bound keeps).
  */
 run: 8000,
} as const;

runSuite('process scale browser harness', 'process-scale-browser-results.json', async studio => {
 const {page, context, check, checkLifecycle, freshStudio, dir, gameDir, fixtureUrls} = studio;
 const measured: Record<string, number | number[]> = {};
 const definition = scaleProcess();
 await context.addInitScript({content: scaleInit()});
 const live = async () => JSON.stringify((await query(page)).snapshot);
 /** The 128-step game page: the agency manifest with the generated process as its only definition. */
 const gamePage = () => {
  const game = path.join(dir, 'scale-game', 'agency-delivery'), html = path.join(dir, 'scale-game.html');
  if (fs.existsSync(html)) return html;
  fs.mkdirSync(path.join(game, 'content'), {recursive: true});
  const manifest = JSON.parse(fs.readFileSync(path.join(gameDir, 'game.json'), 'utf8'));
  manifest.content = {definitions: ['content/scale.process.json']};
  fs.writeFileSync(path.join(game, 'game.json'), JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(path.join(game, 'content/scale.process.json'), JSON.stringify(definition, null, 2) + '\n');
  buildGame(game, html);
  return html;
 };
 const openGame = async () => {
  await openArtifact(page, gamePage(), {url: fixtureUrls[4]!});
  await waitForReady(page, {host: 'process'});
 };

 await check('A generated process at the limits (128 steps, 256 flows) opens as a game and imports as JSON within the load bounds', async () => {
  const kinds = new Set(definition.steps.map(s => s.kind));
  assert.deepEqual([definition.steps.length, definition.flows.length, definition.resources.length], [SCALE.steps, SCALE.flows, 4]);
  for (const k of ['decision', 'fork', 'join', 'timer', 'machine', 'system', 'task']) assert(kinds.has(k as LWProcess.Kind), k);
  assert(definition.steps.some(s => s.deadline) && definition.steps.some(s => s.instances), 'deadlines and multiple instances');
  await openGame();
  const ready = await page.evaluate(() => (window as unknown as {__readyAt: number}).__readyAt);
  measured.load = Math.round(ready);
  assert(ready > 0 && ready <= BOUND.load, `ready ${Math.round(ready)} ms after navigation (bound ${BOUND.load} ms)`);
  const q = await query(page);
  assert.deepEqual([q.definition.steps.length, q.definition.flows.length, q.snapshot.minute], [SCALE.steps, SCALE.flows, 0]);
  // Under load: three workers in another tab keep three of the machine's cores busy while the page loads again.
  const busy = await context.newPage();
  try {
   await busy.evaluate(() => {
    const code = URL.createObjectURL(new Blob(['for (;;) {}'], {type: 'text/javascript'}));
    for (let i = 0; i < 3; i++) new Worker(code);
   });
   await openGame();
   const loaded = await page.evaluate(() => (window as unknown as {__readyAt: number}).__readyAt);
   measured.loadBusy = Math.round(loaded);
   assert(loaded > 0 && loaded <= BOUND.loadBusy, `ready ${Math.round(loaded)} ms after navigation with three busy cores (bound ${BOUND.loadBusy} ms)`);
  } finally {
   await busy.close();
  }
  await freshStudio();
  await page.evaluate(() => {
   const w = window as unknown as {__importStart: number};
   document.getElementById('file')!.addEventListener('change', () => { w.__importStart = performance.now(); }, {capture: true, once: true});
  });
  await page.locator('#file').setInputFiles({name: 'scale.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(definition))});
  const imported = await page.evaluate(async () => {
   const w = window as unknown as {__importStart: number};
   const done = () => (document.getElementById('message')?.textContent ?? '').startsWith('Imported scale.json');
   while (!done()) await new Promise(resolve => requestAnimationFrame(resolve));
   return performance.now() - w.__importStart;
  });
  measured.import = Math.round(imported);
  assert(imported <= BOUND.import, `import took ${Math.round(imported)} ms (bound ${BOUND.import} ms)`);
  assert.equal((await query(page)).definition.steps.length, SCALE.steps);
 });

 await check('2D draws the 128-step map and refreshes it after Advance within bounds, keeping every card element', async () => {
  await openGame();
  const draw = await timeClick(page, 'mode-2d', '#map svg g[id^="process-map-"]', SCALE.steps);
  measured.draw2d = Math.round(draw);
  assert(draw > 0 && draw <= BOUND.draw2d, `2D map drawn in ${Math.round(draw)} ms (bound ${BOUND.draw2d} ms)`);
  await page.evaluate(() => {
   (window as unknown as {__cards: Element[]}).__cards = [...document.querySelectorAll('#map svg g[id^="process-map-"]')];
  });
  await page.locator('#horizon').selectOption('100000');
  const refresh = await timeClick(page, 'advance', '#clock');
  const kept = await page.evaluate(() => {
   const before = (window as unknown as {__cards: Element[]}).__cards;
   return before.filter(card => card.isConnected && document.getElementById(card.id) === card).length;
  });
  measured.refresh2d = Math.round(refresh);
  assert.equal((await query(page)).snapshot.minute, 30, 'Advance moved 30 minutes');
  assert(refresh > 0 && refresh <= BOUND.refresh2d, `2D refresh after Advance in ${Math.round(refresh)} ms (bound ${BOUND.refresh2d} ms)`);
  assert.equal(kept, SCALE.steps, 'the keyed refresh keeps all 128 card elements');
 });

 await check('3D draws the 128-step process within the renderer draw-call budget without ticking', async () => {
  await openGame();
  await page.locator('#mode-3d').click();
  await page.locator('#overview').click();
  await nextFrames(page, 4);
  const before = await live();
  const calls = await drawCalls(page);
  measured.calls = calls;
  assert(calls > 0 && calls <= DRAW_CALL_BUDGET, `${calls} draw calls in the overview frame (budget ${DRAW_CALL_BUDGET})`);
  const renderers = await page.evaluate(() => (window as unknown as {LWProcess3D: LWProcess3D.Api}).LWProcess3D.live().renderers);
  assert.equal(renderers, 1, 'one renderer serves the page');
  assert.equal(await live(), before);
 });

 await check('The Dashboard renders every section of the 128-step process within its bound', async () => {
  await openGame();
  await page.locator('#horizon').selectOption('100000');
  await page.locator('#advance').click();
  const took = await timeClick(page, 'mode-dashboard', '#dashboard .db-section', 8);
  measured.dashboard = Math.round(took);
  assert(took > 0 && took <= BOUND.dashboard, `Dashboard rendered in ${Math.round(took)} ms (bound ${BOUND.dashboard} ms)`);
  const headings = await page.locator('#dashboard .db-section h2').allInnerTexts();
  assert.deepEqual(headings, ['Flow over time', 'Where time goes', 'Lead time and predictability', 'Quality', 'Cost', 'Journey outcomes',
   'What-if: spread across seeds', 'Data and export']);
 });

 await check('Present builds the 128-step deck and pages through every slide within bounds without ticking', async () => {
  await openGame();
  const before = await live();
  const opened = await timeClick(page, 'mode-present', 'dialog#present[open] #present-title');
  measured.present = Math.round(opened);
  assert(opened > 0 && opened <= BOUND.present, `Present opened in ${Math.round(opened)} ms (bound ${BOUND.present} ms)`);
  const count = await page.evaluate(() => {
   const w = window as unknown as {LWProcessSlides: LWProcessSlides.Api; LWProcessStudio: {query(): LWProcessApp.View}};
   return w.LWProcessSlides.build(w.LWProcessStudio.query().definition, null).slides.length;
  });
  assert(count > SCALE.steps, `the deck has ${count} slides, one or more per step`);
  const paged = await page.evaluate(async total => {
   const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
   const state = () => (window as unknown as {LWProcessStudio: {query(): {presenting: {index: number} | null}}}).LWProcessStudio.query().presenting!.index;
   const start = performance.now();
   for (let i = 1; i < total; i++) {
    document.getElementById('present-next')!.click();
    while (state() !== i) await frame();
    await frame();
   }
   return {mean: (performance.now() - start) / (total - 1), last: state()};
  }, count);
  measured.page = Math.round(paged.mean);
  assert.equal(paged.last, count - 1, 'paged to the last slide');
  assert(paged.mean <= BOUND.page, `a slide every ${Math.round(paged.mean)} ms on average (bound ${BOUND.page} ms)`);
  await page.keyboard.press('Escape');
  await page.locator('dialog#present[open]').waitFor({state: 'hidden'});
  assert.equal(await live(), before, 'presenting never ticks');
 });

 await check('At 1366x768 the 128-step map shows numbered cards with their key, no horizontal overflow, and the keyboard reaches the last step', async () => {
  await page.setViewportSize({width: 1366, height: 768});
  await openGame();
  await page.locator('#mode-2d').click();
  await page.locator('#frame').click();
  await page.locator('.process-map-key:not([hidden])').waitFor();
  assert.equal(await page.locator('.process-map-key').innerText(), 'Card numbers match the step list');
  const numbers = await page.locator('#map svg g[id^="process-map-"] .pm-title').evaluateAll(t => t.map(x => x.textContent ?? ''));
  assert.equal(numbers.length, SCALE.steps);
  assert(numbers.every((n, i) => Number(n) === i + 1), 'every card shows its step-list number: ' + numbers.slice(0, 4).join(','));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert(overflow <= 0, `no horizontal overflow (${overflow} px)`);
  // The map is one roving tab stop: End moves focus to the last card in step-list order.
  await page.locator('#map svg g[tabindex="0"]').focus();
  await page.keyboard.press('End');
  const last = definition.steps[definition.steps.length - 1]!.id;
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'process-map-' + last);
  // The step list is a list of buttons: Tab from the first reaches the last.
  await page.locator('#steps button').first().focus();
  for (let i = 1; i < SCALE.steps; i++) await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-step')), last, 'Tab reaches the last step');
  assert(await page.evaluate(() => {
   const r = document.activeElement!.getBoundingClientRect();
   return r.bottom > 0 && r.top < innerHeight;
  }), 'the focused last step is scrolled into view');
 });

 await check('Run to end over 10,000 minutes of the 128-step process stops at the run length and the page paints again within its bound', async () => {
  await openGame();
  await page.locator('#mode-2d').click();
  await page.locator('#horizon').selectOption('custom');
  await page.locator('#horizon-custom').fill('10000');
  await page.locator('#horizon-custom').dispatchEvent('change');
  await page.waitForFunction(() => (window as unknown as {LWProcessStudio: {query(): {horizon: number}}}).LWProcessStudio.query().horizon === 10000);
  const ran = await timeClick(page, 'run-end', '#map svg');
  const gaps = await frameGaps(page, 5);
  const q = await query(page);
  measured.run = Math.round(ran);
  measured.frames = gaps.map(Math.round);
  assert(q.snapshot.minute <= 10000 && q.snapshot.status !== 'running', `stopped at minute ${q.snapshot.minute} (${q.snapshot.status})`);
  assert(q.snapshot.metrics.completed > 0, 'cases completed');
  assert(ran <= BOUND.run, `Run to end took ${Math.round(ran)} ms (bound ${BOUND.run} ms)`);
  assert(Math.max(...gaps) <= BOUND.frame, `frames ${gaps.map(Math.round).join(', ')} ms apart afterwards (bound ${BOUND.frame} ms)`);
  assert.match(await page.locator('#message').innerText(), /^Ran to minute [\d,]+: /);
 });

 console.log(JSON.stringify({kind: 'process-scale-measurements', ...measured}));
 await checkLifecycle('Process scale browser lifecycle emits no runtime errors or network requests');
});
