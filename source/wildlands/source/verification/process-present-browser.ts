/// <reference path="../process-contracts.d.ts" />
/// <reference path="../process-slides-contracts.d.ts" />
/**
 * Process Studio Present mode: the full-window slide dialog over the studio's own 2D map. Keyboard paging, Escape and focus
 * restore, the clock that never ticks while presenting, pause on enter, the selected-step start, the contents list, phone and
 * short-window layout in both fonts, every bundled demo's deck, and the refusal to stack with another studio dialog.
 * Waits are explicit conditions or rendered frames; the expected deck is built in the page from the same detached view.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {nextFrames} from './browser-harness';
import {query, runSuite, type StudioQuery} from './process-browser-fixture';

/** Pinned slide counts of the bundled demos, in game order (docs/concepts/agency-delivery/game.json). */
const PINNED = [22, 36, 23, 34, 43, 30, 36] as const;
const DEJAVU = '*{font-family:"DejaVu Sans",sans-serif !important}';
/** Rendered frames that cover several of the studio's 0.35 s play pulses: a playing run would advance within them. */
const PULSE_FRAMES = 90;
interface DeckFacts {
 sections: {title: string; first: number; count: number}[];
 slides: {id: string; title: string; step: string | null; kind: string; live: string | null}[];
}
interface PageGlobals {LWProcessSlides: LWProcessSlides.Api; LWProcessStudio: {query(): StudioQuery}}
interface UiFacts {
 count: string; live: string; title: string; prev: boolean; next: boolean; prevLabel: string; nextLabel: string; focus: string;
}

runSuite('process present browser harness', 'process-present-browser-results.json', async studio => {
 const {page, check, checkLifecycle, freshStudio, switchTo, openDef, defOpen, closeDef, activeId, diagnostics, gameDir, gameDefinitions, COUNT} = studio;
 const shown = page.locator('dialog#present[open]');
 /** The deck the studio should present: built in the page from the active definition, with the snapshot only past minute 0. */
 const expectedDeck = () => page.evaluate((): DeckFacts => {
  const w = globalThis as unknown as PageGlobals, q = w.LWProcessStudio.query();
  const d = w.LWProcessSlides.build(q.definition, q.snapshot.minute > 0 ? q.snapshot : null);
  return {
   sections: d.sections.map(s => ({title: s.title, first: s.first, count: s.count})),
   slides: d.slides.map(s => ({id: s.id, title: s.title, step: s.step, kind: s.kind, live: s.live?.heading ?? null})),
  };
 });
 const ui = () => page.evaluate((): UiFacts => {
  const text = (id: string) => document.getElementById(id)?.textContent ?? '', button = (id: string) => document.getElementById(id) as HTMLButtonElement;
  return {
   count: text('present-count'), live: text('present-live'), title: text('present-title'),
   prev: button('present-prev').disabled, next: button('present-next').disabled,
   prevLabel: text('present-prev'), nextLabel: text('present-next'), focus: document.activeElement?.id ?? '',
  };
 });
 /** The deck shows slide `index`: query, counter, live region, title and the disabled ends all agree. */
 const at = async (deck: DeckFacts, index: number, why = '') => {
  const count = deck.slides.length, slide = deck.slides[index]!, state = (await query(page)).presenting;
  assert.deepEqual(state, {index, count, id: slide.id}, why);
  const u = await ui();
  assert.deepEqual(
   [u.count, u.live, u.title, u.prev, u.next, u.prevLabel, u.nextLabel],
   [`Slide ${index + 1} of ${count}`, `Slide ${index + 1} of ${count}: ${slide.title}`, slide.title, index === 0, index === count - 1, 'Previous', 'Next'],
   why,
  );
  return u;
 };
 const press = async (key: string) => { await page.keyboard.press(key); };
 const openPresent = async (via = '#mode-present') => { await page.locator(via).click(); await shown.waitFor(); };
 const escapeOut = async () => { await press('Escape'); await shown.waitFor({state: 'hidden'}); };
 const minuteOf = async () => (await query(page)).snapshot.minute;
 /** Where the studio's single map element sits: its parent and the element after it. */
 const mapHome = () => page.evaluate(() => {
  const m = document.getElementById('map')!;
  return {count: document.querySelectorAll('#map').length, parent: m.parentElement?.id ?? '', next: m.nextElementSibling?.id ?? ''};
 });
 const mapSteps = () => page.locator('#present-stage [id^="process-map-"]').evaluateAll(g => g.map(x => x.id.slice('process-map-'.length)));

 await check('Present pages with Right, Left, PageDown, PageUp, Home and End, announces each slide and disables Previous and Next at the ends', async () => {
  await freshStudio(); const deck = await expectedDeck(), last = PINNED[0] - 1;
  assert.equal(deck.slides.length, PINNED[0]); assert.equal(await page.locator('#mode-present').getAttribute('aria-haspopup'), 'dialog');
  assert.equal(await page.locator('#mode-present').innerText(), 'Present');
  await openPresent(); assert.equal((await at(deck, 0, 'opens on the title slide')).focus, 'present-next', 'focus lands on Next');
  assert.equal(
   await page.locator('#present').evaluate(
    d => d.matches(':modal') && d.parentElement === document.body && d.getAttribute('aria-labelledby') === 'present-title',
   ),
   true,
  );
  assert.deepEqual(
   await page.locator('#present-live').evaluate(e => [e.getAttribute('role'), e.getAttribute('aria-live'), e.getAttribute('aria-atomic')]),
   ['status', 'polite', 'true'],
  );
  const steps = [
   ['ArrowRight', 1], ['PageDown', 2], ['ArrowRight', 3], ['ArrowLeft', 2], ['PageUp', 1], ['PageUp', 0], ['ArrowLeft', 0], ['PageUp', 0],
  ] as const;
  for (const [key, index] of steps) { await press(key); await at(deck, index, key + ' to ' + index); }
  await press('End'); assert.equal((await at(deck, last, 'End')).focus, 'present-prev', 'Next was disabled at the end, so focus moves to Previous');
  await press('ArrowRight'); await press('PageDown'); await at(deck, last, 'no slide after the last');
  await press('Home'); assert.equal((await at(deck, 0, 'Home')).focus, 'present-next', 'Previous was disabled at the start, so focus moves to Next');
  await page.locator('#present-next').click(); await page.locator('#present-next').click(); await at(deck, 2, 'Next button');
  await page.locator('#present-prev').click(); await at(deck, 1, 'Previous button');
  // Arrow keys inside the map pan it (after zooming in so there is room to pan); the slide stays.
  await press('Home'); const svg = page.locator('#present-stage #map svg'); await svg.focus(); await press('+');
  const before = await svg.getAttribute('viewBox');
  for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) await press(key);
  const after = await svg.getAttribute('viewBox'); assert.notEqual(after, before, 'the arrow keys panned the map');
  await at(deck, 0, 'arrow keys inside the map do not page');
  assert.equal(await page.evaluate(() => document.getElementById('map')!.contains(document.activeElement)), true);
  await press('PageDown'); await at(deck, 1, 'PageDown still pages from the map'); await escapeOut();
 });

 await check('Escape closes Contents first, then exits to the invoker with the previous view mode, selection and map position restored', async () => {
  await freshStudio(); const home = await mapHome(); assert.deepEqual(home, {count: 1, parent: 'viewport', next: 'lens'});
  // From 3D with a selected step: paging changes the shown step, exit restores both.
  await page.locator('#steps [data-step="qa"]').click(); assert.deepEqual([(await query(page)).mode, (await query(page)).selected], ['3d', 'qa']);
  await openPresent(); const deck = await expectedDeck(); assert.equal((await query(page)).mode, '2d', 'presenting shows the 2D map');
  assert.deepEqual(await mapHome(), {count: 1, parent: 'present-stage', next: ''}, 'the one map element moved into the slide');
  await press('ArrowRight'); await press('ArrowRight'); const moved = (await query(page)).presenting!;
  assert.equal((await query(page)).selected, deck.slides[moved.index]!.step); assert.notEqual((await query(page)).selected, 'qa');
  await page.locator('#present-toc').click(); assert.equal(await page.locator('#present-toc').getAttribute('aria-expanded'), 'true');
  await press('Escape'); assert.equal(await shown.count(), 1, 'the first Escape closes Contents only');
  assert.deepEqual(
   [await page.locator('#present-toc').getAttribute('aria-expanded'), await page.locator('#present-contents').isHidden(), await activeId()],
   ['false', true, 'present-toc'],
  );
  await escapeOut(); let q = await query(page);
  assert.deepEqual([q.presenting, q.mode, q.selected, await activeId()], [null, '3d', 'qa', 'mode-present']);
  assert.deepEqual(await mapHome(), home, 'the map returned before the lens');
  assert.deepEqual(await page.evaluate(() => [
   document.getElementById('process-shell')!.inert,
   document.documentElement.classList.contains('pd-locked'),
   document.getElementById('map')!.hidden,
   document.getElementById('canvas')!.hidden,
  ]), [false, false, true, false]);
  assert.equal(await page.locator('#message').innerText(), 'Presentation closed.');
  // From the SIPOC lens (entered from 3D): the lens returns and so does the remembered flat view behind it.
  await page.locator('#overview').click(); await page.locator('#mode-lens').click(); assert.equal((await query(page)).mode, 'lens');
  await page.locator('#mode-present').focus(); await press('Enter'); await shown.waitFor(); await at(deck, 0, 'the overview opens on slide 1');
  await escapeOut(); q = await query(page); assert.deepEqual([q.mode, q.selected, await activeId()], ['lens', null, 'mode-present']);
  assert.equal(await page.locator('#lens').isVisible(), true); assert.deepEqual(await mapHome(), home);
  await switchTo(3); assert.equal((await query(page)).mode, 'lens', 'a journey opens on its map');
  await switchTo(0); assert.equal((await query(page)).mode, '3d', 'the flat view behind the lens is still 3D');
  // From 2D the map is visible again in its place.
  await page.locator('#mode-2d').click(); await openPresent(); await escapeOut();
  assert.deepEqual([(await query(page)).mode, await page.locator('#map').isVisible()], ['2d', true]); assert.deepEqual(await mapHome(), home);
 });

 await check('Presenting never ticks: minute and snapshot stay fixed across the whole deck, Contents and map interaction', async () => {
  await freshStudio(); await page.locator('#advance').click();
  await page.waitForFunction(() => (globalThis as unknown as PageGlobals).LWProcessStudio.query().snapshot.minute === 30);
  const before = await query(page); assert.equal(before.playing, false); const snapshot = JSON.stringify(before.snapshot);
  await page.locator('#steps [data-step="discovery"]').click(); await openPresent(); const deck = await expectedDeck();
  const run = `Live facts come from one simulated run at business minute 30 (seed ${before.snapshot.seed}, still running).`;
  // The studio behind Present is not rendered while presenting (content-visibility), so its status line is read as text content.
  const message = () => page.locator('#message').textContent();
  assert.deepEqual([await page.locator('#present-note').isHidden(), await page.locator('#present-run').innerText(), await message()],
   [true, run, 'Presenting slides.']);
  await press('Home');
  for (let i = 0; i < deck.slides.length; i++) {
   if (i > 0) await press('ArrowRight');
   const q = await query(page); assert.equal(q.presenting!.index, i); assert.equal(q.snapshot.minute, 30, 'slide ' + (i + 1)); assert.equal(q.playing, false);
   const facts = page.locator('#present-slide .present-facts h3'), live = deck.slides[i]!.live;
   assert.deepEqual(await facts.allTextContents(), live === null ? [] : [live], 'live facts of slide ' + (i + 1));
  }
  assert.ok(deck.slides.filter(s => s.kind === 'step').every(s => s.live !== null), 'every step slide carries the live facts of this run');
  await page.locator('#present-toc').click(); await page.locator('#present-contents [data-slide="4"]').click(); await press('Home');
  await page.locator('#present-stage #process-map-qa').click(); assert.equal((await query(page)).presenting!.id, 'step-qa');
  await page.locator('#present-stage #map svg').focus(); await press('+'); await press('ArrowUp'); await nextFrames(page, PULSE_FRAMES);
  assert.equal(JSON.stringify((await query(page)).snapshot), snapshot, 'the snapshot is unchanged while presenting');
  await escapeOut(); await nextFrames(page, PULSE_FRAMES); const after = await query(page);
  assert.equal(JSON.stringify(after.snapshot), snapshot, 'exiting never ticks'); assert.equal(after.playing, false); assert.equal(after.selected, 'discovery');
 });

 await check('Present pauses a playing run with a command, says so, and leaves it paused after exit', async () => {
  await freshStudio(); await page.locator('#horizon').selectOption('1440'); await page.locator('#speed').selectOption('30');
  await page.locator('#play').click();
  await page.waitForFunction(() => { const q = (globalThis as unknown as PageGlobals).LWProcessStudio.query(); return q.playing && q.snapshot.minute >= 60; });
  const running = await minuteOf();
  await page.waitForFunction(m => (globalThis as unknown as PageGlobals).LWProcessStudio.query().snapshot.minute > m, running);
  await openPresent(); const entered = await query(page), minute = entered.snapshot.minute;
  assert.equal(entered.playing, false, 'entering paused the run'); assert.ok(minute > running);
  // The studio behind Present is not rendered while presenting (content-visibility), so its status line is read as text content.
  const message = await page.locator('#message').textContent();
  assert.deepEqual([await page.locator('#present-note').isVisible(), await page.locator('#present-note').innerText(), message],
   [true, 'The run is paused while you present.', 'Presenting slides. The run is paused while you present.']);
  const run = `Live facts come from one simulated run at business minute ${minute.toLocaleString('en-US')} (seed ${entered.snapshot.seed}, still running).`;
  assert.equal(await page.locator('#present-run').innerText(), run);
  await nextFrames(page, PULSE_FRAMES); await press('End'); await press('Home');
  assert.deepEqual([await minuteOf(), (await query(page)).playing], [minute, false], 'nothing ticks while presenting');
  await escapeOut(); await nextFrames(page, PULSE_FRAMES); const left = await query(page);
  assert.deepEqual([left.snapshot.minute, left.playing, await page.locator('#play').innerText()], [minute, false, 'Run simulation'], 'nothing resumes on exit');
  assert.equal(await page.locator('#message').innerText(), 'Presentation closed. The run stays paused; choose Run simulation to continue.');
 });

 await check('Present opens on the selected step slide or slide 1, and a step chosen on the map moves the deck to its slide', async () => {
  await freshStudio(); const deck = await expectedDeck(), index = deck.slides.findIndex(s => s.id === 'step-design-ready');
  assert.equal(index, 10); await page.locator('#steps [data-step="design-ready"]').click(); await openPresent();
  await at(deck, index, 'opens on the selected step'); assert.equal((await query(page)).selected, 'design-ready');
  const near = ['architecture', 'design-ready', 'implementation', 'product-design'];
  assert.deepEqual((await mapSteps()).sort(), near, 'the map shows that step with its direct neighbours');
  await escapeOut(); assert.equal((await query(page)).selected, 'design-ready');
  await page.locator('#overview').click(); await openPresent(); await at(deck, 0, 'the overview opens on slide 1');
  assert.equal((await query(page)).selected, null);
  const all = (await query(page)).definition.steps.map(s => s.id); assert.deepEqual((await mapSteps()).sort(), [...all].sort(), 'slide 1 shows the whole map');
  await page.locator('#present-stage #process-map-review-gate').click(); const target = deck.slides.findIndex(s => s.id === 'step-review-gate');
  await at(deck, target, 'a map click moves the deck'); assert.equal((await query(page)).selected, 'review-gate');
  // The clicked step keeps focus on the map, so its arrow keys pan; PageDown still pages.
  assert.equal(await page.evaluate(() => document.getElementById('map')!.contains(document.activeElement)), true);
  await press('ArrowRight'); await at(deck, target, 'arrow keys on the map');
  await press('PageDown'); await at(deck, target + 1); assert.equal((await query(page)).selected, deck.slides[target + 1]!.step);
  await escapeOut(); assert.equal((await query(page)).selected, null);
 });

 await check('Contents lists every slide once under its section, toggles aria-expanded, jumps to the chosen slide and marks it current', async () => {
  await freshStudio(); const deck = await expectedDeck(); await openPresent();
  const toc = page.locator('#present-toc'), contents = page.locator('#present-contents');
  assert.deepEqual(
   [await toc.innerText(), await toc.getAttribute('aria-expanded'), await toc.getAttribute('aria-controls'), await contents.isHidden()],
   ['Contents', 'false', 'present-contents', true],
  );
  await toc.click();
  assert.deepEqual([await toc.getAttribute('aria-expanded'), await contents.isVisible(), await page.locator('.present-main').isHidden()], ['true', true, true]);
  const listed = await contents.evaluate(c => [...c.querySelectorAll('.present-group')].map(g => ({
   title: g.querySelector('h3')!.textContent,
   start: Number(g.querySelector('ol')!.getAttribute('start')),
   items: [...g.querySelectorAll('button[data-slide]')].map(b => ({
    slide: Number((b as HTMLElement).dataset.slide), num: b.firstElementChild!.textContent, title: b.lastElementChild!.textContent,
   })),
  })));
  assert.deepEqual(listed.map(g => g.title), deck.sections.map(s => s.title), 'groups follow the deck sections in order');
  assert.deepEqual(listed.map(g => g.start), deck.sections.map(s => s.first + 1));
  assert.deepEqual(
   listed.flatMap(g => g.items),
   deck.slides.map((s, i) => ({slide: i, num: String(i + 1), title: s.title})),
   'every slide is listed once, in order',
  );
  for (const [g, s] of deck.sections.entries()) assert.deepEqual(listed[g]!.items.map(i => i.slide), Array.from({length: s.count}, (_, j) => s.first + j));
  const current = () => contents.locator('[aria-current="true"]').evaluateAll(b => b.map(x => Number((x as HTMLElement).dataset.slide)));
  assert.deepEqual(
   [await current(), await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.slide)],
   [[0], '0'],
   'opening focuses the current entry',
  );
  for (const pick of [7, deck.slides.length - 1, 3]) {
   if (await contents.isHidden()) await toc.click();
   await contents.locator(`[data-slide="${pick}"]`).click(); await at(deck, pick, 'chosen ' + pick);
   assert.deepEqual(
    [await contents.isHidden(), await toc.getAttribute('aria-expanded'), await activeId()],
    [true, 'false', 'present-title'],
    'choosing closes the list and focuses the title',
   );
   assert.deepEqual(await current(), [pick]);
  }
  await press('ArrowRight'); assert.deepEqual(await current(), [4], 'aria-current follows paging'); await toc.click(); await press('Enter');
  await at(deck, 4, 'Enter on the current entry'); await escapeOut();
 });

 /** Layout facts of the open dialog: no horizontal overflow, Previous/Next on screen, nothing clipped sideways. */
 const layout = () => page.evaluate(() => {
  const d = document.getElementById('present')!, box = (id: string) => document.getElementById(id)!.getBoundingClientRect();
  const visible = (b: DOMRect) => b.width > 0 && b.top >= -1 && b.bottom <= innerHeight + 1 && b.left >= -1 && b.right <= innerWidth + 1;
  const clipped = [...d.querySelectorAll<HTMLElement>('h2,h3,p,li,button,span')]
   .filter(e => e.getClientRects().length > 0 && !e.closest('#map') && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).display !== 'inline')
   .map(e => e.id || e.textContent!.slice(0, 30));
  const title = document.getElementById('present-title');
  return {
   page: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
   dialog: d.scrollWidth <= d.clientWidth,
   prev: visible(box('present-prev')),
   next: visible(box('present-next')),
   heights: [Math.round(box('present-prev').height), Math.round(box('present-next').height)],
   clipped,
   title: !title || (title.scrollWidth <= title.clientWidth + 1 && title.scrollHeight <= title.clientHeight + 1),
  };
 });
 await check('Present fits phones and short windows in both fonts: menu entry, no sideways overflow, 44 px Previous and Next, unclipped text', async () => {
  for (const [width, height] of [[390, 844], [320, 640], [1366, 500]] as const) {
   for (const dejavu of [false, true]) {
    await freshStudio(); if (dejavu) await page.addStyleTag({content: DEJAVU}); await page.evaluate(() => document.fonts.ready);
    await page.setViewportSize({width, height}); await nextFrames(page); const phone = width <= 650, where = `${width}x${height}${dejavu ? ' DejaVu' : ''}`;
    assert.equal(await page.locator('#mode-present').isVisible(), !phone, 'the toolbar button is hidden on phones at ' + where);
    if (phone) {
     await page.locator('#more-menu').click();
     const items = await page.locator('#export-items > button').evaluateAll(b => b.filter(x => x.getClientRects().length > 0).map(x => x.id));
     assert.deepEqual(items.slice(0, 2), ['import-item', 'present-item'], where);
     assert.equal(await page.locator('#present-item').innerText(), 'Present slides');
     await page.locator('#present-item').click(); await shown.waitFor(); assert.equal(await page.locator('#export-popup').isHidden(), true, 'the menu closed');
    } else await openPresent();
    const deck = await expectedDeck();
    for (const key of ['Home', 'PageDown', 'PageDown', 'PageDown', 'PageDown', 'End']) {
     await press(key); const f = await layout(), slide = (await query(page)).presenting!.index + 1;
     assert.deepEqual(
      [f.page, f.dialog, f.prev, f.next, f.clipped, f.title],
      [true, true, true, true, [], true],
      `${where} slide ${slide} ${JSON.stringify(f)}`,
     );
     if (phone) assert.ok(f.heights.every(h => h >= 44), `44 px targets at ${where}: ${f.heights.join()}`);
    }
    await page.locator('#present-toc').click(); const toc = await layout();
    assert.deepEqual([toc.page, toc.dialog, toc.clipped], [true, true, []], `contents at ${where}`);
    assert.equal(await page.locator('#present-contents button[data-slide]').count(), deck.slides.length); await press('Escape');
    await escapeOut(); assert.equal(await activeId(), phone ? 'more-menu' : 'mode-present', 'focus returns to the invoker at ' + where);
   }
  }
  // Narrowing the window while presenting hides the toolbar invoker, so exit focuses the phone menu button instead.
  await freshStudio(); await openPresent(); await page.setViewportSize({width: 390, height: 844}); await nextFrames(page);
  assert.equal((await layout()).page, true); await escapeOut(); assert.equal(await activeId(), 'more-menu', 'focus falls back to the visible menu button');
 });

 await check('Every bundled process presents its pinned deck with each step on exactly one slide and no errors', async () => {
  assert.equal(COUNT, PINNED.length); const errors = diagnostics.errors.length, problems = diagnostics.consoleProblems.length; await freshStudio();
  for (let i = 0; i < COUNT; i++) {
   if (i > 0) await switchTo(i);
   const file = JSON.parse(fs.readFileSync(path.join(gameDir, gameDefinitions[i]!), 'utf8')) as LWProcess.Definition, q = await query(page);
   assert.equal(q.definition.id, file.id); const deck = await expectedDeck(), name = file.id;
   assert.equal(deck.slides.length, PINNED[i], name + ' slide count');
   const stepIds = deck.slides.filter(s => s.id.startsWith('step-')).map(s => s.id.slice(5));
   assert.deepEqual([...stepIds].sort(), file.steps.map(s => s.id).sort(), name + ': each step on exactly one slide');
   await openPresent(); assert.equal(await page.locator('#present-process').innerText(), file.name); await at(deck, 0, name);
   const seen = [(await query(page)).presenting!.id];
   for (let s = 1; s < deck.slides.length; s++) { await page.locator('#present-next').click(); seen.push((await query(page)).presenting!.id); }
   assert.deepEqual(seen, deck.slides.map(s => s.id), name + ': paging visits every slide in order'); await at(deck, deck.slides.length - 1, name + ' end');
   await press('Home'); await press('End'); await at(deck, deck.slides.length - 1, name + ' End');
   assert.equal(await page.locator('#present-contents button[data-slide]').count(), deck.slides.length);
   await page.locator('#present-exit').click(); await shown.waitFor({state: 'hidden'});
   assert.equal(await activeId(), 'mode-present'); assert.equal((await query(page)).snapshot.minute, 0);
  }
  assert.deepEqual(diagnostics.errors.slice(errors), []);
  assert.deepEqual(diagnostics.consoleProblems.slice(problems).filter(x => x.startsWith('error:')), []);
 });

 await check('Present refuses to open over another studio dialog and keeps the studio behind it unreachable', async () => {
  await freshStudio();
  await page.locator('#open-activity').click(); await page.locator('dialog.act-dialog[open]').waitFor();
  await page.evaluate(() => document.getElementById('mode-present')!.click());
  assert.deepEqual(
   [await shown.count(), (await query(page)).presenting, await page.locator('#message').innerText()],
   [0, null, 'Close the open window first.'],
   'not over Activity',
  );
  await press('Escape'); await page.locator('dialog.act-dialog[open]').waitFor({state: 'hidden'});
  await openDef(); await page.evaluate(() => document.getElementById('present-item')!.click());
  assert.deepEqual([await shown.count(), (await query(page)).presenting, await defOpen.count()], [0, null, 1], 'not over Edit process'); await closeDef();
  await openPresent();
  assert.deepEqual(
   await page.evaluate(() => [document.getElementById('process-shell')!.inert, document.documentElement.classList.contains('pd-locked')]),
   [true, true],
  );
  const hits = await page.evaluate(() => ['open-definition', 'open-activity', 'import', 'play', 'export-menu'].map(id => {
   const b = document.getElementById(id)!.getBoundingClientRect(), hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
   return !!hit && !!hit.closest('#present');
  }));
  assert.deepEqual(hits, [true, true, true, true, true], 'the presentation covers the studio controls');
  for (const key of ['Tab', 'Shift+Tab']) {
   for (let i = 0; i < 12; i++) {
    await press(key);
    assert.equal(await page.evaluate(() => !!document.activeElement?.closest('#present')), true, `${key} ${i} stays in the presentation`);
   }
  }
  assert.deepEqual([await page.locator('dialog.pd-dialog[open]').count(), await defOpen.count()], [0, 0]);
  await escapeOut(); assert.equal(await page.evaluate(() => document.getElementById('process-shell')!.inert), false);
 });

 await check('Present names the run status and an unapplied draft, shows key results and pool use, '
  + 'and pages with Space, ArrowDown, n and p from the slide', async () => {
  await freshStudio(); await page.setViewportSize({width: 1440, height: 1060});
  // A completed run: the header says so, the title slide leads with key results, the resources slide shows pool use.
  await page.locator('#horizon').selectOption('100000');
  for (let i = 0; i < 40 && (await query(page)).snapshot.status !== 'completed'; i++) await page.locator('#advance').click();
  const q = await query(page); assert.equal(q.snapshot.status, 'completed');
  const deck = await expectedDeck(); await openPresent(); await at(deck, 0, 'title');
  const run = `Live facts come from one simulated run at business minute ${q.snapshot.minute.toLocaleString('en-US')} (seed ${q.snapshot.seed}, completed).`;
  assert.equal(await page.locator('#present-run').innerText(), run);
  assert.equal(await page.locator('#present-draft').isHidden(), true, 'no draft, no draft note');
  const facts = () => page.locator('#present-slide .present-facts').innerText();
  const key = /^Key results · One simulated run · business minute [\d,]+ · seed \d+\n[\s\S]*Run status: completed[\s\S]*Most utilised pool: /;
  assert.match(await facts(), key);
  assert.match(await page.locator('#present-slide').innerText(), /Times are simulated business minutes \(min\)/);
  await press('ArrowRight'); await press('ArrowRight'); await at(deck, 2, 'resources');
  const pools = await facts(); assert.match(pools, /\d+% average utilisation since minute 0, busy /);
  for (const pool of q.definition.resources) assert(pools.includes(pool.name + ': '), pool.name);
  // The summary speaks to the audience: no command-line tip on screen.
  await press('End'); assert.match(await facts(), /Run status: completed/);
  assert.doesNotMatch(await page.locator('#present').innerText(), /command line|process slides/);
  // Paging from the focused slide: Space, ArrowDown and n forward, p, Shift+Space and ArrowUp back.
  await press('Home'); await press('PageDown'); await press('PageDown'); await press('PageDown'); await at(deck, 3);
  await page.locator('#present-slide').focus(); assert.equal(await activeId(), 'present-slide');
  for (const [key, index] of [['Space', 4], ['ArrowDown', 5], ['n', 6], ['p', 5], ['Shift+Space', 4], ['ArrowUp', 3]] as const) {
   await press(key); await at(deck, index, key + ' from the slide');
  }
  assert.equal(await activeId(), 'present-slide', 'focus stays on the slide'); assert.equal((await query(page)).snapshot.minute, q.snapshot.minute);
  await escapeOut();
  // A long slide scrolls with Space first and pages only once its end is in view.
  await switchTo(gameDefinitions.findIndex(f => f.includes('delivery-release')));
  await page.setViewportSize({width: 1440, height: 700}); await nextFrames(page);
  const long = await expectedDeck(); await openPresent(); await at(long, 0); const slide = page.locator('#present-slide'); await slide.focus();
  assert.ok(await slide.evaluate(e => e.scrollHeight > e.clientHeight + 40), 'the title slide is longer than the window');
  await press('Space'); await at(long, 0, 'Space scrolls a long slide first');
  await page.waitForFunction(() => document.getElementById('present-slide')!.scrollTop > 0);
  for (let i = 0; i < 40 && (await query(page)).presenting!.index === 0; i++) await press('Space');
  await at(long, 1, 'then pages'); await escapeOut();
  // An unapplied draft is not presented, and Present says so (also to assistive technology).
  await page.setViewportSize({width: 1440, height: 1060}); await openDef();
  const draft = JSON.parse(await page.locator('#draft').inputValue()) as LWProcess.Definition;
  await page.locator('#draft').fill(JSON.stringify({...draft, name: 'Draft name only'})); await closeDef();
  assert.equal(await page.locator('#draft-chip').isVisible(), true);
  await openPresent(); assert.equal(await page.locator('#present-process').innerText(), draft.name, 'the applied definition is presented');
  const note = page.locator('#present-draft');
  assert.deepEqual([await note.isVisible(), await note.innerText()], [true, 'Showing the applied definition; your unapplied draft is not included.']);
  assert.match((await page.locator('#present').getAttribute('aria-describedby'))!, /\bpresent-draft\b/); await escapeOut();
 });

 await checkLifecycle('Process present browser lifecycle emits no runtime errors or network requests');
});
