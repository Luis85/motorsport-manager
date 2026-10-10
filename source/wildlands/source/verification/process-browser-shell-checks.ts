/// <reference path="../process-contracts.d.ts" />
/**
 * Studio shell checks of the process-shell-browser suite, called from `process-shell-browser.ts`: Run to end (UX-12), adding
 * processes with New process… and Import as a new process (AUTH-2 slots), the BPMN export notes (DOM-11) and the plain
 * studio copy (UX-15).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {waitForReady, openArtifact} from './browser-harness';
import {query, type Studio} from './process-browser-fixture';

type W = {LWProcessStudio: {query(): LWProcessApp.View}; LWProcessApplication: LWProcessApp.Api; LWProcessBpmn: LWProcessBpmn.Api};

/** Registers the shell checks on the suite's page. */
export async function shellChecks(studio: Studio): Promise<void> {
 const {page, context, dir, cli, gameDir, gameDefinitions, COUNT, fixtureUrls, check, freshStudio, activeId, exportVia, switchTo} = studio;
 const message = () => page.locator('#message').innerText(), ask = page.locator('dialog.ask-dialog[open]');
 const newDialog = page.locator('dialog.pd-dialog[open]:has(#np-name)');
 const active = (i: number) => page.waitForFunction(n => (globalThis as unknown as W).LWProcessStudio.query().active === n, i);
 await check('Run to end is one clock command that stops at the end of the run, equals stepping the same minutes and is disabled with its reason', async () => {
  await freshStudio(); await page.locator('#horizon').selectOption('1440');
  const end = page.locator('#run-end'); assert.equal(await end.innerText(), 'Run to end'); assert.equal(await end.isEnabled(), true);
  // Navigation never moves the clock.
  await page.locator('[data-step="discovery"]').click(); await page.locator('#mode-2d').click(); await page.locator('#mode-3d').click();
  await page.locator('#overview').click(); assert.equal((await query(page)).snapshot.minute, 0);
  await page.evaluate(() => {
   const w = globalThis as unknown as {clockWrites: number}; w.clockWrites = 0;
   new MutationObserver(() => { w.clockWrites++; }).observe(document.getElementById('clock')!, {childList: true, characterData: true, subtree: true});
  });
  await end.click(); const ended = await query(page);
  assert.equal(ended.snapshot.status, 'completed'); assert.equal(ended.playing, false);
  assert.equal(await message(), `Ran to minute ${ended.snapshot.minute.toLocaleString()}: the run completed.`);
  assert.equal(await page.evaluate(() => (globalThis as unknown as {clockWrites: number}).clockWrites), 1, 'one command, one refresh');
  // The same minutes advanced in 30-minute steps by a separate controller give the same snapshot.
  const stepped = await page.evaluate(minutes => {
   const w = globalThis as unknown as W, app = w.LWProcessApplication.create(w.LWProcessStudio.query().definition); app.horizon(1440);
   for (let at = 0; at < minutes; at += 30) app.advance(Math.min(30, minutes - at));
   const snapshot = app.query().snapshot; app.dispose(); return snapshot;
  }, ended.snapshot.minute);
  assert.deepEqual(stepped, ended.snapshot);
  const stopped = 'Run completed. Export the report or reset to run again.';
  assert.deepEqual([await end.isDisabled(), await end.getAttribute('title'), await activeId()], [true, stopped, 'reset'], 'disabled with its reason; focus moves to Reset');
  await page.locator('#reset').click(); await page.locator('#horizon').selectOption('unlimited');
  assert.deepEqual([await end.isDisabled(), await end.getAttribute('title')], [true, 'Set a run length to run to the end.']);
  // A playing run is paused first, then runs to its run length.
  await page.locator('#horizon').selectOption('custom'); await page.locator('#horizon-custom').fill('90'); await page.locator('#horizon-custom').dispatchEvent('change');
  await page.locator('#play').click(); await page.waitForFunction(() => (globalThis as unknown as W).LWProcessStudio.query().snapshot.minute > 0);
  await end.click(); const limited = await query(page);
  assert.deepEqual([limited.playing, limited.snapshot.minute, limited.snapshot.status], [false, 90, 'limit']);
  assert.equal(await message(), 'Ran to minute 90: the run length is reached.');
  await page.locator('#reset').click(); await page.locator('#horizon').selectOption('100000');
 });
 /** A one-process game page, built once for the checks that need it. */
 const singlePage = () => {
  const single = path.join(dir, 'single-new', 'agency-delivery'), html = path.join(dir, 'single-new.html');
  if (fs.existsSync(html)) return html;
  fs.cpSync(gameDir, single, {recursive: true}); for (const extra of gameDefinitions.slice(1)) fs.rmSync(path.join(single, extra));
  const manifest = JSON.parse(fs.readFileSync(path.join(single, 'game.json'), 'utf8'));
  manifest.content = {definition: gameDefinitions[0]}; fs.writeFileSync(path.join(single, 'game.json'), JSON.stringify(manifest, null, 2) + '\n');
  const made = spawnSync(process.execPath, [cli, 'build-game', '--game', single, '--output', html], {encoding: 'utf8', timeout: 300000});
  assert.equal(made.status, 0, made.stderr + made.stdout); return html;
 };
 await check('New process and Import as a new process add a slot and switch to it without ticking; at 8 processes both say why they are unavailable', async () => {
  await freshStudio(); const first = await query(page);
  await page.locator('#export-menu').click(); await page.locator('#new-process').click(); await newDialog.waitFor();
  assert.equal(await activeId(), 'np-name'); await page.keyboard.press('Escape'); await newDialog.waitFor({state: 'hidden'});
  assert.deepEqual([await activeId(), (await query(page)).processes.length], ['export-menu', COUNT], 'Cancel creates nothing and returns focus');
  await page.locator('#export-menu').click(); await page.locator('#new-process').click(); await newDialog.waitFor();
  await page.locator('#np-create').click(); assert.match(await page.locator('#np-status').innerText(), /Enter a name/);
  await page.locator('#np-name').fill('Quarterly review'); await page.locator('#np-create').click(); await active(COUNT);
  const made = await query(page);
  assert.deepEqual([made.definition.id, made.definition.name, made.definition.steps.length, made.snapshot.minute, made.playing], ['quarterly-review', 'Quarterly review', 3, 0, false]);
  assert.equal(await message(), 'Created Quarterly review as a new process. Its run is paused at minute 0.');
  assert.equal(await page.locator('#process-switch option').count(), COUNT + 1);
  // The 8th process fills the studio: both items stay reachable and give the reason.
  assert.equal(COUNT + 1, 8, 'the agency game holds seven processes');
  await page.locator('#export-menu').click();
  for (const id of ['#new-process', '#import-new']) {
   assert.deepEqual([await page.locator(id).getAttribute('aria-disabled'), await page.locator(id).getAttribute('title')], ['true', 'A studio holds at most 8 processes.']);
  }
  assert.match(await page.locator('#export-hint').innerText(), /A studio holds at most 8 processes\.$/);
  // aria-disabled keeps the item in the keyboard order, so its reason is reachable: End, ArrowUp and Enter choose New process….
  await page.keyboard.press('End'); assert.equal(await activeId(), 'import-new'); await page.keyboard.press('ArrowUp');
  assert.equal(await activeId(), 'new-process'); await page.keyboard.press('Enter');
  assert.equal(await message(), 'A studio holds at most 8 processes.'); assert.equal(await newDialog.count(), 0);
  // Download HTML keeps the added process.
  const pending = page.waitForEvent('download'); await exportVia('#html'); const saved = path.join(dir, 'with-new.html'); await (await pending).saveAs(saved);
  const other = await context.newPage(); await openArtifact(other, saved, {url: fixtureUrls[3]!}); await waitForReady(other, {host: 'process'});
  assert.deepEqual((await query(other)).processes.map(p => p.name), [...first.processes.map(p => p.name), 'Quarterly review']); await other.close();
  // Import as a new process renames a clashing id; the replace question's Add choice keeps the current run.
  await freshStudio(); const json = path.join(dir, 'as-new.json'); fs.writeFileSync(json, JSON.stringify(first.definition));
  const chooser = page.waitForEvent('filechooser'); await page.locator('#export-menu').click(); await page.locator('#import-new').click();
  await (await chooser).setFiles(json); await active(COUNT);
  const copy = await query(page); assert.deepEqual([copy.definition.id, copy.definition.name], [first.definition.id + '-2', first.definition.name]);
  assert.equal(await message(), `Imported as-new.json as a new process. Its run is paused at minute 0. Its id is ${first.definition.id}-2 because ${first.definition.id} is already open.`);
  await freshStudio(); await page.locator('#advance').click();
  await page.locator('#file').setInputFiles(json); await ask.waitFor(); await page.locator('#ask-add').click(); await active(COUNT);
  await switchTo(0); assert.equal((await query(page)).snapshot.minute, 30, 'Add as a new process keeps the current process and its run');
  // A BPMN file imported as a new process goes through the BPMN dialog, which adds instead of replacing.
  const bpmn = path.join(dir, 'as-new.bpmn');
  fs.writeFileSync(bpmn, await page.evaluate(() => (globalThis as unknown as W).LWProcessBpmn.export((globalThis as unknown as W).LWProcessStudio.query().definition)));
  await freshStudio();
  const picker = page.waitForEvent('filechooser'); await page.locator('#export-menu').click(); await page.locator('#import-new').click();
  await (await picker).setFiles(bpmn); await page.locator('dialog.bi-dialog[open]').waitFor();
  assert.match(await page.locator('#bi-subtitle').innerText(), /^Importing adds a new process/);
  await page.locator('#bi-import').click(); await page.locator('dialog.bi-dialog[open]').waitFor({state: 'hidden'}); await active(COUNT);
  assert.match(await message(), /^Imported as-new\.bpmn as a new process\. Its run is paused at minute 0\./);
  // A one-process page shows the Process selector once a second process exists.
  const one = await context.newPage(); await openArtifact(one, singlePage(), {url: fixtureUrls[4]!}); await waitForReady(one, {host: 'process'});
  assert.equal(await one.locator('#process-switch-label').isVisible(), false);
  await one.locator('#export-menu').click(); await one.locator('#new-process').click(); await one.locator('#np-name').fill('Second line');
  await one.keyboard.press('Enter');
  await one.waitForFunction(() => (globalThis as unknown as W).LWProcessStudio.query().processes.length === 2);
  assert.equal(await one.locator('#process-switch-label').isVisible(), true); assert.equal(await one.locator('#process-switch option').count(), 2);
  // Its Download HTML gains the process list, so the page reopens with both processes.
  const singleDownload = one.waitForEvent('download'); await one.locator('#export-menu').click(); await one.locator('#html').click();
  const twoFile = path.join(dir, 'single-plus-one.html'); await (await singleDownload).saveAs(twoFile); await one.close();
  const two = await context.newPage(); await openArtifact(two, twoFile, {url: fixtureUrls[1]!}); await waitForReady(two, {host: 'process'});
  assert.deepEqual((await query(two)).processes.map(p => p.id), [first.processes[0]!.id, 'second-line']); await two.close();
 });
 await check('BPMN exports say how many notes name values that travel only in the Wildlands extension and list them in a read-only dialog', async () => {
  await freshStudio(); await page.locator('#export-menu').click(); assert.equal(await page.locator('#export-notes').isHidden(), true); await page.keyboard.press('Escape');
  const notesOf = (bpsim: boolean) => page.evaluate(b => {
   const w = globalThis as unknown as W; return w.LWProcessBpmn.fidelity(w.LWProcessStudio.query().definition, {bpsim: b});
  }, bpsim);
  for (const bpsim of [true, false]) {
   const notes = await notesOf(bpsim), id = (await query(page)).definition.id, name = id + (bpsim ? '.bpsim.bpmn' : '.bpmn');
   const pending = page.waitForEvent('download'); await exportVia(bpsim ? '#bpmn-bpsim' : '#bpmn'); await pending;
   const what = bpsim ? 'with a BPSim scenario in minutes' : 'with diagram layout', count = notes.length === 1 ? '1 note names' : `${notes.length} notes name`;
   assert(notes.length > 0); assert.equal(await message(), `Exported BPMN 2.0 XML ${what} (${name}). ${count} values that travel only in the Wildlands extension;`
    + ' Show export notes in the Export menu lists them.');
   await page.locator('#export-menu').click(); await page.locator('#export-notes').click(); const notesDialog = page.locator('dialog.pd-dialog[open]:has(.xn-notes)');
   await notesDialog.waitFor(); assert.deepEqual(await notesDialog.locator('.xn-notes li').allInnerTexts(), notes);
   assert.equal(await page.locator('#xn-subtitle').innerText(), name);
   await page.keyboard.press('Escape'); await notesDialog.waitFor({state: 'hidden'}); assert.equal(await activeId(), 'export-menu');
  }
 });
 await check('Studio copy reads Steps and Fit to view, subtitles name the step kind in plain words without scene ids, and the seed shows once', async () => {
  await freshStudio(); const q = await query(page);
  assert.equal(await page.locator('#steps-heading').innerText(), 'Steps'); assert.equal(await page.locator('#frame').innerText(), 'Fit to view');
  assert.match(await page.locator('#scene-subtitle').innerText(), new RegExp(`^${q.definition.steps.length} steps · \\d+ cases? admitted$`));
  assert.doesNotMatch(await page.locator('#scene-subtitle').innerText(), /connected scenes/);
  const task = q.definition.steps.find(s => s.kind === 'task')!; await page.locator(`#steps [data-step="${task.id}"]`).click();
  const shown = await page.locator('#scene-subtitle').innerText(); assert.equal(shown, 'Task' + (task.phase ? ' · ' + task.phase : ''));
  assert(!shown.includes(task.scene.id), 'no internal scene id');
  assert.equal(await page.locator('#metrics .metric-seed').count(), 0); assert.equal(await page.locator('#seed').inputValue(), String(q.snapshot.seed));
  // A journey touchpoint names its kind and phase.
  const journey = q.processes.findIndex((p, i) => i > 0 && /journey/.test(p.id)); await switchTo(journey);
  const point = (await query(page)).definition.steps.find(s => s.kind === 'touchpoint' && s.phase)!;
  await page.locator(`#steps [data-step="${point.id}"]`).click(); assert.equal(await page.locator('#scene-subtitle').innerText(), `Touchpoint · ${point.phase}`);
 });
}
