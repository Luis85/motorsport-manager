/// <reference path="../process-contracts.d.ts" />
/**
 * Draft-action and shell follow-up checks of the process-draft-browser suite, called from `process-draft-browser.ts`: moving 2D
 * cards into the draft (AUTH-11), the Add step… and Tidy layout entry points, the business-day clock and Run until lengths of a
 * display calendar, the step list's waiting and blocked counts, and the Activity feed after switching back to a kept run. Every
 * check acts through the studio's own controls and reads the public query; none of them expects the clock to move unless it
 * presses a clock control.
 */
import assert from 'node:assert/strict';
import type {Page} from 'playwright';
import {query, type Studio} from './process-browser-fixture';
import {feedFixture} from './process-browser-models';

/** The world centre of a step's card on the studio map (cards are drawn centred on their position). */
const cardAt = (page: Page, id: string) => page.locator(`#map #process-map-${id} > .pm-card`).evaluate(r => {
 const box = (r as SVGGraphicsElement).getBBox(), moved = r.parentElement!.getAttribute('transform');
 const round = (v: number) => Math.round(v * 100) / 100;
 return {x: round(box.x + box.width / 2), y: round(box.y + box.height / 2), moved};
});
/** Drags a step card on the studio map by a whole number of world units (screen pixels from the map's own scale). */
async function dragCard(page: Page, id: string, dx: number, dy: number): Promise<void> {
 const at = await page.locator(`#map #process-map-${id} > .pm-card`).evaluate(r => {
  const b = r.getBoundingClientRect(), ppu = (r as SVGGraphicsElement).ownerSVGElement!.getScreenCTM()!.a;
  return {x: b.left + b.width / 2, y: b.top + b.height / 2, ppu};
 });
 await page.mouse.move(at.x, at.y); await page.mouse.down();
 await page.mouse.move(at.x + dx * at.ppu, at.y + dy * at.ppu, {steps: 6}); await page.mouse.up();
}
const positionIn = (d: LWProcess.Definition, id: string) => d.steps.find(s => s.id === id)!.scene.position;

/** Registers the draft-action checks on the suite's page. */
export async function draftChecks(studio: Studio): Promise<void> {
 const {page, check, freshStudio, importFeed, importJson, openDef, closeDef, restoreDef, applyDef, draftText, defOf, activeId, dialogOpen, switchTo} = studio;
 const message = () => page.locator('#message').innerText();
 const undo = async (redo = false) => { await page.locator('#tune-seed').focus(); await page.keyboard.press(redo ? 'ControlOrMeta+Shift+Z' : 'ControlOrMeta+Z'); };
 const show2d = async () => { await page.locator('#mode-2d').click(); await page.locator('#map svg g[role=button]').first().waitFor(); };
 await check('Dragging a 2D card writes one undoable draft step without ticking: the status says to apply, undo puts the card back and apply keeps it', async () => {
  await importFeed(); await show2d(); const before = await query(page);
  await dragCard(page, 'work', 0, 3);
  assert.deepEqual(positionIn(await defOf(), 'work'), [14, 3], 'the draft holds the dropped position');
  assert.equal(await message(), 'Moved =1+1, "x" in the draft. Apply the draft to keep it.');
  const moved = await query(page);
  assert.deepEqual([moved.definition, moved.snapshot.minute, moved.selected], [before.definition, 0, null], 'the running definition, clock and selection stay');
  assert.match(await page.locator('#draft-chip').innerText(), /^Unapplied draft/);
  assert.deepEqual(await cardAt(page, 'work'), {x: 14, y: 3, moved: null}, 'the card is drawn at its draft position');
  // Undo in the Definition editor restores the draft and the card's place on the map.
  await openDef(); await undo(); assert.deepEqual(positionIn(await defOf(), 'work'), [14, 0]);
  assert.match(await page.locator('#draft-state').innerText(), /matches the running definition/);
  await closeDef(); assert.deepEqual(await cardAt(page, 'work'), {x: 14, y: 0, moved: null}, 'undo puts the card back');
  // Redo, then apply: the running definition keeps the position and the run restarts paused at minute 0.
  await openDef(); await undo(true); assert.deepEqual(positionIn(await defOf(), 'work'), [14, 3]); await applyDef();
  const applied = await query(page);
  assert.deepEqual([positionIn(applied.definition, 'work'), applied.snapshot.minute, applied.playing], [[14, 3], 0, false]);
  assert.deepEqual(await cardAt(page, 'work'), {x: 14, y: 3, moved: null}, 'apply keeps the card where it was moved');
  // After a process switch the new map still moves cards into that process's draft (Alt+Arrow is the keyboard move).
  const other = applied.processes.findIndex((p, i) => i > 0 && !/journey/.test(p.id)); await switchTo(other); await show2d();
  const start = (await query(page)).definition.steps.find(s => s.kind === 'start')!;
  await page.locator(`#map #process-map-${start.id}`).focus(); await page.keyboard.press('Alt+ArrowRight');
  assert.deepEqual(positionIn(await defOf(), start.id), [start.scene.position[0]! + 1, start.scene.position[1]]);
  assert.equal(await message(), `Moved ${start.name} in the draft. Apply the draft to keep it.`);
  assert.equal((await query(page)).snapshot.minute, 0); await openDef(); await restoreDef(); await closeDef();
 });
 await check('A card move with a draft that is not valid JSON is refused and the card stays; Add step and Tidy layout say why they are unavailable', async () => {
  await freshStudio(); await show2d(); const before = await query(page), discovery = positionIn(before.definition, 'discovery');
  await openDef(); await page.locator('#draft').fill('{bad'); await closeDef();
  const invalid = 'The draft is not valid JSON. Fix it in Edit process… first.';
  for (const id of ['#add-step', '#tidy-layout']) {
   assert.deepEqual([await page.locator(id).getAttribute('aria-disabled'), await page.locator(id).getAttribute('title')], ['true', invalid], id);
  }
  // aria-disabled keeps both in the keyboard order, so a press repeats the reason instead of acting.
  await page.locator('#tidy-layout').focus(); await page.keyboard.press('Enter'); assert.equal(await message(), invalid);
  await page.locator('#add-step').focus(); await page.keyboard.press('Enter');
  assert.equal(await dialogOpen(), 0, 'no dialog opens'); assert.equal(await message(), invalid);
  await dragCard(page, 'discovery', 2, 2);
  assert.equal(await message(), 'The draft is not valid JSON, so Discovery was not moved. Fix it in Edit process… first.');
  assert.equal(await draftText(), '{bad', 'the draft stays as written');
  assert.deepEqual(await cardAt(page, 'discovery'), {x: discovery[0], y: discovery[1], moved: null}, 'the card returns to its place');
  const after = await query(page); assert.deepEqual([after.definition, after.snapshot], [before.definition, before.snapshot]);
  await openDef(); await restoreDef(); await closeDef();
  assert.deepEqual([await page.locator('#add-step').getAttribute('aria-disabled'), await page.locator('#add-step').getAttribute('title')],
   [null, 'Add a step to the draft']);
 });
 await check('Add step adds to the draft through a Cancel-first dialog and can insert into a path; Tidy layout writes one draft step; both sit in the phone menu',
  async () => {
   await importFeed(); await page.locator('#steps [data-step="work"]').click(); const before = await query(page);
   const opened = page.locator('dialog.pd-dialog[open]:has(#as-kind)'), insert = page.locator('#as-insert');
   await page.locator('#add-step').click(); await opened.waitFor();
   assert.deepEqual([await activeId(), await page.locator('#as-buttons button').allInnerTexts()], ['as-kind', ['Cancel', 'Add step']]);
   await page.locator('#as-name').fill('Review'); await page.keyboard.press('Escape'); await opened.waitFor({state: 'hidden'});
   assert.deepEqual([await activeId(), await page.locator('#draft-chip').isHidden()], ['add-step', true], 'Cancel adds nothing and returns focus');
   await page.locator('#add-step').click(); await opened.waitFor();
   assert.deepEqual([await page.locator('#as-after').inputValue(), await page.locator('#as-name').inputValue()], ['work', ''], 'after the selected step');
   assert.deepEqual([await insert.isEnabled(), await insert.isChecked()], [true, true]);
   assert.equal(await page.locator('#as-insert-note').innerText(), 'The path from =1+1, "x" to Done then leads through the new step.');
   await page.locator('#as-kind').selectOption('end'); assert.deepEqual([await insert.isDisabled(), await insert.isChecked()], [true, false]);
   assert.equal(await page.locator('#as-insert-note').innerText(), 'An end step finishes the process, so it is not inserted into a path.');
   await page.locator('#as-kind').selectOption('task'); await page.locator('#as-name').fill('Review'); await page.locator('#as-add').click();
   await opened.waitFor({state: 'hidden'}); assert.equal(await activeId(), 'add-step');
   assert.equal(await message(), 'Added step Review to the draft. Inserted Review between =1+1, "x" and Done. Apply the draft to keep it.');
   const added = await defOf();
   assert.deepEqual(added.steps.map(s => s.id), ['start', 'work', 'review', 'end']);
   assert.deepEqual(added.flows.map(f => [f.from, f.to]), [['start', 'work'], ['work', 'review'], ['review', 'end']]);
   const now = await query(page);
   assert.deepEqual([now.definition, now.selected, now.snapshot.minute], [before.definition, 'work', 0], 'nothing new is selected or run');
   // Tidy layout: one labelled draft step that places the steps on the grid, and a plain answer when nothing would move.
   await page.locator('#tidy-layout').click();
   assert.equal(await message(), 'Tidied the layout in the draft: 2 steps moved. Apply the draft to keep it.');
   assert.deepEqual((await defOf()).steps.map(s => s.scene.position), [[0, 0], [14, 0], [28, 0], [42, 0]]);
   await page.locator('#tidy-layout').click(); assert.equal(await message(), 'Every step is already in its tidy place, so the draft is unchanged.');
   await openDef(); await undo(); assert.deepEqual(await defOf(), added, 'one undo step per tidy'); await restoreDef(); await closeDef();
   // Below 1,200 px they move into the Export menu, on a phone into ⋯; the dialog returns focus to the menu button.
   await page.setViewportSize({width: 1100, height: 700});
   const oneRow = () => page.evaluate(() => {
    const title = document.getElementById('process-title')!.getBoundingClientRect(), menu = document.getElementById('export-menu')!.getBoundingClientRect();
    return menu.top < title.bottom;
   });
   assert.deepEqual([await page.locator('#add-step').isHidden(), await oneRow()], [true, true], 'the header keeps one row');
   await page.locator('#export-menu').click(); assert.equal(await page.locator('#tidy-item').isVisible(), true); await page.keyboard.press('Escape');
   await page.setViewportSize({width: 390, height: 844});
   assert.deepEqual([await page.locator('#add-step').isHidden(), await page.locator('#tidy-layout').isHidden()], [true, true]);
   await page.locator('#more-menu').click(); assert.equal(await page.locator('#tidy-item').isVisible(), true);
   await page.locator('#add-step-item').click(); await opened.waitFor(); await page.keyboard.press('Escape'); await opened.waitFor({state: 'hidden'});
   assert.equal(await activeId(), 'more-menu');
  });
 await check('With a display calendar the clock and Run until lengths read in business days and weeks; without one they are unchanged', async () => {
  await freshStudio(); const plain = await page.locator('#horizon').innerHTML();
  await importJson('calendar-line.json', feedFixture({calendar: {minutesPerDay: 480, daysPerWeek: 5}}));
  assert.deepEqual((await page.locator('#horizon option').allInnerTexts()).slice(0, 4), ['Until: 1,440 min (3 business days)',
   'Until: 10,080 min (4.2 business weeks)', 'Until: 43,200 min (18 business weeks)', 'Until: 100,000 min (≈ 41.7 business weeks)']);
  await page.locator('#horizon').selectOption('1440'); assert.equal(await message(), 'Run length set to 1,440 minutes (24 h, 3 business days).');
  await page.locator('#advance').click(); assert.equal(await page.locator('#clock-hours').innerText(), '', 'below one business day');
  await page.locator('#run-end').click();
  assert.deepEqual([await page.locator('#clock').innerText(), await page.locator('#clock-hours').innerText()], ['1,440 min of 1,440', '3 business days']);
  // A process without a calendar reads exactly as before.
  await switchTo(1); assert.equal(await page.locator('#horizon').innerHTML(), plain, 'byte-identical Run until options');
  for (let i = 0; i < 4; i++) await page.locator('#advance').click();
  assert.equal(await page.locator('#clock-hours').innerText(), '2 h');
 });
 await check('The step list counts held work as blocked, never as waiting, in the card captions\' words, and its dot follows the map card state', async () => {
  const blocked = feedFixture(); (blocked.steps[1] as Record<string, unknown>).backlog = {capacity: 1};
  await freshStudio(); await importJson('blocked-line.json', blocked); await show2d();
  await page.locator('#step').click(); await page.locator('#advance').click();
  const q = (await query(page)).snapshot, start = q.steps.find(m => m.id === 'start')!;
  assert(start.held > 0, 'the start step holds blocked work');
  for (const step of blocked.steps) {
   const m = q.steps.find(x => x.id === step.id)!, item = page.locator(`#steps [data-step="${step.id}"]`);
   const waiting = Math.max(0, m.queued - m.held), text = await item.locator('small').innerText();
   const want = [m.active ? m.active + ' working' : '', waiting ? waiting + ' waiting' : '', m.held ? m.held + ' blocked' : ''];
   assert.equal(text, [step.kind, ...want.filter(Boolean)].join(' · '), step.id);
   const card = page.locator(`#map #process-map-${step.id}`), state = await card.getAttribute('data-status');
   const caption = (await card.getAttribute('data-caption'))!.split(' · ').filter(t => /^[1-9]\d* (working|waiting|blocked)$/.test(t));
   assert.deepEqual(caption, want.filter(Boolean), 'the list uses the caption words for ' + step.id);
   const dot = item.locator('i');
   assert.equal(state === 'idle' ? await dot.count() : await dot.getAttribute('data-state'), state === 'idle' ? 0 : state, 'dot of ' + step.id);
  }
 });
 await check('Switching back to a kept run restores its Activity feed silently: the badge keeps its count, nothing is announced and nothing ticks', async () => {
  const blocked = feedFixture(); (blocked.steps[1] as Record<string, unknown>).backlog = {capacity: 1};
  await freshStudio(); await importJson('blocked-line.json', blocked);
  await page.locator('#step').click(); await page.locator('#advance').click();
  const opener = page.locator('#open-activity'), badge = await opener.innerText(), latest = await page.locator('#latest').innerText();
  assert.match(badge, /^Activity · \d+$/); const left = await query(page);
  await switchTo(1); assert.deepEqual([await opener.innerText(), (await query(page)).snapshot.minute], ['Activity', 0], 'the other run has its own feed');
  await page.evaluate(() => {
   const w = globalThis as unknown as {spoken: string[]}; w.spoken = [];
   new MutationObserver(() => { const t = document.getElementById('feed-announcer')!.textContent; if (t) w.spoken.push(t); })
    .observe(document.getElementById('feed-announcer')!, {childList: true, characterData: true, subtree: true});
  });
  await switchTo(0);
  const n = Number(badge.split('· ')[1]);
  assert.deepEqual([await opener.innerText(), await opener.getAttribute('aria-label')], [badge, `Activity, ${n} new problem${n === 1 ? '' : 's'}`]);
  assert.equal(await page.locator('#latest').innerText(), latest);
  assert.deepEqual((await query(page)).snapshot, left.snapshot, 'switching never ticks');
  await opener.click(); await page.locator('dialog.act-dialog[open]').waitFor();
  assert.equal(await page.locator('#act-rows tr').count(), left.snapshot.events.length, 'the retained events are listed once');
  await page.keyboard.press('Escape');
  assert.deepEqual(await page.evaluate(() => (globalThis as unknown as {spoken: string[]}).spoken), [], 'nothing is announced again');
 });
}
