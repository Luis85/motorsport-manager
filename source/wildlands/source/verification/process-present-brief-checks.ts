/// <reference path="../process-contracts.d.ts" />
/// <reference path="../process-slides-contracts.d.ts" />
/**
 * Present brief-deck checks of the process-present-browser suite, called from `process-present-browser.ts`: the Contents
 * **Section slides only** switch (PR-6) rebuilds the deck in place, keeps the position (a step slide moves to its section's slide
 * and comes back), says which cut is shown, keeps the map framing and map selection working, never ticks, and every open starts
 * with the full deck. Waits are explicit DOM conditions; expected decks are built in the page from the same detached view.
 */
import assert from 'node:assert/strict';
import {query, type Studio} from './process-browser-fixture';

interface Facts {ids: string[]; titles: string[]; steps: (string | null)[]; sections: string[]}
type W = {LWProcessSlides: LWProcessSlides.Api; LWProcessStudio: {query(): LWProcessApp.View}};

/** Registers the brief-deck check on the suite's page. */
export async function presentBriefChecks(studio: Studio): Promise<void> {
 const {page, check, freshStudio, activeId} = studio;
 const shown = page.locator('dialog#present[open]'), toggle = page.locator('#present-brief'), toc = page.locator('#present-toc');
 /** The full (or brief) deck of the active definition at minute 0, as Present builds it. */
 const deckOf = (brief: boolean) => page.evaluate((b): Facts => {
  const w = globalThis as unknown as W, q = w.LWProcessStudio.query(), d = w.LWProcessSlides.build(q.definition, null, {brief: b});
  return {ids: d.slides.map(s => s.id), titles: d.slides.map(s => s.title), steps: d.slides.map(s => s.step), sections: d.slides.map(s => s.section)};
 }, brief);
 const presenting = async () => (await query(page)).presenting!;
 const text = (id: string) => page.locator('#' + id).innerText();
 const pressed = (value: boolean) => page.waitForFunction(v => document.getElementById('present-brief')?.getAttribute('aria-pressed') === String(v), value);
 const openContents = async () => { if (await toc.getAttribute('aria-expanded') !== 'true') await toc.click(); await toggle.waitFor(); };
 const mapSteps = () => page.locator('#present-stage [id^="process-map-"]').evaluateAll(g => g.map(x => x.id.slice('process-map-'.length)));

 await check('Present switches to section slides only and back in place, keeping the section of the current step, the map framing and the clock', async () => {
  await freshStudio(); const full = await deckOf(false), brief = await deckOf(true), before = JSON.stringify((await query(page)).snapshot);
  assert.equal(brief.ids.length, 10); assert(brief.ids.every(id => !id.startsWith('step-')), 'the brief deck has no step slides');
  await page.locator('#steps [data-step="product-design"]').click(); await page.locator('#mode-present').click(); await shown.waitFor();
  const step = full.ids.indexOf('step-product-design'), section = full.sections[step]!;
  assert.equal((await presenting()).id, 'step-product-design');
  // The switch lives in Contents: a pressed-state button with a full label and an explanation.
  await openContents();
  assert.deepEqual([await toggle.innerText(), await toggle.getAttribute('aria-pressed'), await toggle.getAttribute('aria-describedby')],
   ['Section slides only', 'false', 'present-brief-hint']);
  assert.match(await text('present-brief-hint'), /^Title, overview, resources, one slide per section and the summary; no step slides\.$/);
  // Switching on: the step slide becomes its section's slide, the deck is rebuilt in place and says so; focus stays on the switch.
  await toggle.click(); await pressed(true);
  const at = brief.ids.indexOf('section-' + section);
  assert.deepEqual(await presenting(), {index: at, count: brief.ids.length, id: 'section-' + section});
  assert.equal(await text('present-count'), `Slide ${at + 1} of ${brief.ids.length} · section slides only`);
  assert.equal(await page.locator('#present-live').textContent(),
   `Section slides only: ${brief.ids.length} slides. Slide ${at + 1}: ${brief.titles[at]}, the section of “${full.titles[step]}”.`);
  assert.equal(await activeId(), 'present-brief');
  assert.deepEqual(await page.locator('#present-contents button[data-slide] span:last-child').allInnerTexts(), brief.titles, 'Contents lists the brief deck');
  assert.deepEqual(await page.locator('#present-contents [aria-current="true"]').evaluateAll(b => b.map(x => Number((x as HTMLElement).dataset.slide))), [at]);
  // Switching back without moving returns to the same step slide.
  await toggle.click(); await pressed(false);
  assert.deepEqual(await presenting(), {index: step, count: full.ids.length, id: 'step-product-design'});
  assert.match((await page.locator('#present-live').textContent())!, new RegExp(`^All slides: ${full.ids.length} slides\\. Slide ${step + 1}: `));
  assert.equal(await text('present-count'), `Slide ${step + 1} of ${full.ids.length}`);
  // In the brief deck, paging frames each section's first step on the map, and a step chosen on the map shows its section's slide.
  await toggle.click(); await pressed(true); await page.keyboard.press('Escape'); await page.locator('#present-contents').waitFor({state: 'hidden'});
  await page.keyboard.press('PageDown'); const next = await presenting();
  assert.equal(next.id, brief.ids[at + 1]); assert.equal((await query(page)).selected, brief.steps[at + 1]);
  assert((await mapSteps()).includes(brief.steps[at + 1]!), 'the map frames the section slide\'s step');
  // A neighbour on the map that belongs to another section: choosing it moves the brief deck to that section's slide.
  const sectionOfStep = (id: string) => full.sections[full.ids.indexOf('step-' + id)]!;
  const other = (await mapSteps()).find(id => sectionOfStep(id) !== brief.sections[at + 1])!, owner = sectionOfStep(other);
  assert(other, 'the framed map shows a neighbour from another section');
  await page.locator(`#present-stage #process-map-${other}`).click();
  await page.waitForFunction(id => (globalThis as unknown as {LWProcessStudio: {query(): {presenting: {id: string} | null}}}).LWProcessStudio.query().presenting?.id === id,
   'section-' + owner);
  assert.equal((await query(page)).selected, other);
  // After moving, switching back keeps the section slide; nothing ticked, and the next open starts with the full deck.
  await openContents(); await toggle.click(); await pressed(false);
  assert.deepEqual(await presenting(), {index: full.ids.indexOf('section-' + owner), count: full.ids.length, id: 'section-' + owner});
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await shown.waitFor({state: 'hidden'});
  const after = await query(page); assert.equal(after.snapshot.minute, 0); assert.equal(JSON.stringify(after.snapshot), before, 'the brief deck never ticks');
  await page.locator('#mode-present').click(); await shown.waitFor(); assert.equal((await presenting()).count, full.ids.length, 'each open starts with the full deck');
  await openContents(); assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await shown.waitFor({state: 'hidden'});
 });
}
