/// <reference path="../process-contracts.d.ts" />
/// <reference path="../process-checkpoint.ts" />
/**
 * Process Studio run checkpoint suite: Export run checkpoint… and Load checkpoint… (LWProcessIO, LWProcessCheckpoint). The export
 * downloads the active run and is disabled with its reason at minute 0; the load reads the file through its own file chooser,
 * refuses a checkpoint of another definition (naming both fingerprints), of another process or a malformed one, and otherwise asks
 * first in a question that starts on Cancel and names both minutes. Cancel keeps the run and the unapplied draft and returns focus
 * to the menu button; confirming restores the exported run exactly, paused, and continuing it equals an uninterrupted run. Nothing
 * ticks before the question is answered, and nothing new is written to browser storage (only the draft recovery copy, the studio's
 * one storage policy, may change).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {query, runSuite} from './process-browser-fixture';

type W = {LWProcessStudio: {query(): LWProcessApp.View}; LWProcessApplication: LWProcessApp.Api; LWProcessCatalog: LWProcess.Catalog};
const NO_RUN = 'Run the process first: a run checkpoint saves a run that has started (past minute 0).';
runSuite('process checkpoint browser harness', 'process-checkpoint-browser-results.json', async studio => {
 const {page, check, dir, freshStudio, exportVia, activeId, openDef, closeDef, draftText, applyDraft, switchTo} = studio;
 const message = () => page.locator('#message').innerText(), ask = page.locator('dialog.ask-dialog[open]');
 /** Browser storage outside the draft recovery policy (`<namespace>.process-draft.v1:…` keys), both areas. */
 const storage = () => page.evaluate(() => {
  const read = (area: Storage) => Object.fromEntries(Array.from({length: area.length}, (_, i) => area.key(i)!)
   .filter(key => !/\.process-draft\.v1:/.test(key)).sort().map(key => [key, area.getItem(key)]));
  return {local: read(localStorage), session: read(sessionStorage)};
 });
 const live = async () => JSON.stringify((await query(page)).snapshot);
 /** Picks `file` (a path, or a name with text) through the Load checkpoint… item's own file chooser. */
 const load = async (file: string | {name: string; text: string}) => {
  await page.locator('#export-menu').click();
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#checkpoint-load').click();
  await (await chooser).setFiles(typeof file === 'string' ? file
   : {name: file.name, mimeType: 'application/json', buffer: Buffer.from(file.text)});
 };
 const settled = (start: string) => page.waitForFunction(s => document.getElementById('message')!.textContent!.startsWith(s)
  || !!document.querySelector('dialog.ask-dialog[open]'), start);
 let saved = '', savedAt = 0, savedSnapshot = '';
 await check('Export run checkpoint is disabled with its reason at minute 0 and downloads the active run without ticking or writing storage', async () => {
  await freshStudio();
  const stored = await storage();
  await page.locator('#export-menu').click();
  const item = page.locator('#checkpoint-export');
  assert.deepEqual([await item.innerText(), await item.getAttribute('aria-disabled'), await item.getAttribute('title')], ['Export run checkpoint…', 'true', NO_RUN]);
  // aria-disabled keeps the item in the keyboard order, so its reason is reachable: choosing it says why.
  await item.focus(); await page.keyboard.press('Enter');
  assert.equal(await message(), NO_RUN);
  for (let i = 0; i < 3; i++) await page.locator('#advance').click();
  const before = await query(page);
  assert(before.snapshot.minute > 0, 'the run has started');
  const pending = page.waitForEvent('download');
  await exportVia('#checkpoint-export');
  const download = await pending, name = `${before.definition.id}.minute-${before.snapshot.minute}.checkpoint.json`;
  assert.equal(download.suggestedFilename(), name);
  saved = path.join(dir, name);
  await download.saveAs(saved);
  const c = JSON.parse(fs.readFileSync(saved, 'utf8')) as LWProcessCheckpoint.Checkpoint;
  const fingerprint = await page.evaluate(d => (globalThis as unknown as W).LWProcessCatalog.fingerprint(d), before.definition);
  assert.deepEqual([c.kind, c.version, c.process, c.fingerprint, c.minute, c.seed, c.runLength],
   ['wildlands-process-checkpoint', 1, before.definition.id, fingerprint, before.snapshot.minute, before.snapshot.seed, before.horizon]);
  assert.equal(await live(), JSON.stringify(before.snapshot), 'exporting never ticks');
  assert.match(await message(), new RegExp(`^Exported ${name.replace(/\./g, '\\.')}: a run checkpoint of .+ at minute ${before.snapshot.minute}`));
  assert.equal(await page.locator('#checkpoint-export').getAttribute('aria-disabled'), null, 'enabled once the run has started');
  assert.deepEqual(await storage(), stored, 'exporting writes nothing to browser storage');
  savedAt = before.snapshot.minute; savedSnapshot = JSON.stringify(before.snapshot);
 });
 await check('Load checkpoint asks first, starting on Cancel and naming both minutes; Cancel keeps the run and draft and restores focus without ticking', async () => {
  for (let i = 0; i < 2; i++) await page.locator('#advance').click();
  await openDef(); await page.locator('#draft').fill('{\n  "unfinished":'); await closeDef();
  assert.match(await page.locator('#draft-chip').innerText(), /^Unapplied draft/);
  const before = await query(page), draft = await draftText(), stored = await storage(), run = await live();
  await load(saved);
  await ask.waitFor();
  assert.equal(await activeId(), 'ask-cancel', 'the question starts on Cancel');
  assert.equal(await page.locator('#ask-title').innerText(), `Load checkpoint into ${before.definition.name}?`);
  const text = await ask.innerText();
  assert(text.includes(`now at minute ${before.snapshot.minute.toLocaleString()}`) && text.includes(`run at minute ${savedAt.toLocaleString()}`), text);
  assert.equal(await live(), run, 'nothing ticks while the question is open');
  await page.keyboard.press('Escape');
  await ask.waitFor({state: 'hidden'});
  assert.equal(await activeId(), 'export-menu', 'focus returns to the menu button');
  assert.match(await message(), /^Load of .+\.checkpoint\.json cancelled\. The run of .+ is unchanged at minute \d+\.$/);
  assert.deepEqual([await live(), await draftText()], [run, draft], 'Cancel keeps the run and the draft');
  assert.deepEqual(await storage(), stored);
 });
 await check('Load checkpoint restores the exported run exactly and paused, keeps the unapplied draft, continues as one run and writes no storage', async () => {
  const draft = await draftText(), stored = await storage();
  await load(saved);
  await ask.waitFor();
  await page.locator('#ask-go').click();
  await page.waitForFunction(() => document.getElementById('message')!.textContent!.startsWith('Loaded '));
  const restored = await query(page);
  assert.equal(JSON.stringify(restored.snapshot), savedSnapshot, 'the exported run, exactly');
  assert.deepEqual([restored.playing, restored.snapshot.minute], [false, savedAt]);
  assert.deepEqual([await draftText(), await page.locator('#draft-chip').isHidden()], [draft, false], 'the unapplied draft stays');
  for (let i = 0; i < 2; i++) await page.locator('#advance').click();
  const now = await query(page);
  const straight = await page.evaluate(([d, minute]) => {
   const app = (globalThis as unknown as W).LWProcessApplication.create(d);
   app.advance(minute);
   const snapshot = app.query().snapshot; app.dispose(); return JSON.stringify(snapshot);
  }, [now.definition, now.snapshot.minute] as const);
  assert.equal(JSON.stringify(now.snapshot), straight, 'continuing the restored run equals one uninterrupted run');
  assert.deepEqual(await storage(), stored, 'loading writes nothing to browser storage');
 });
 await check('Load checkpoint refuses another definition naming both fingerprints, another process and a malformed file, and changes nothing', async () => {
  await freshStudio();
  await applyDraft(d => { d.name = d.name + ' (edited)'; });
  for (let i = 0; i < 2; i++) await page.locator('#advance').click();
  const edited = await query(page), run = await live(), c = JSON.parse(fs.readFileSync(saved, 'utf8')) as LWProcessCheckpoint.Checkpoint;
  const fingerprint = await page.evaluate(d => (globalThis as unknown as W).LWProcessCatalog.fingerprint(d), edited.definition);
  await load(saved); await settled('Load checkpoint refused');
  assert.equal(await message(), `Load checkpoint refused: This checkpoint was saved from definition fingerprint ${c.fingerprint}, but the applied`
   + ` definition of ${edited.definition.name} has fingerprint ${fingerprint}. Import or apply the definition the checkpoint was saved from,`
   + ' then load the checkpoint again.');
  assert.deepEqual([await ask.count(), await live()], [0, run], 'refused before any question; the run is unchanged');
  await load({name: 'broken.checkpoint.json', text: '{"kind": "wildlands-process-checkpoint",'});
  await settled('Load checkpoint refused');
  assert.equal(await message(), 'Load checkpoint refused: This file is not a run checkpoint: it is not valid JSON.');
  await freshStudio();
  const owner = (await query(page)).definition.name;
  await switchTo(1);
  const other = await live();
  await load(saved); await settled('Load checkpoint refused');
  assert.equal(await message(), `Load checkpoint refused: ${path.basename(saved)} belongs to ${owner}. Switch to ${owner} with the Process selector,`
   + ' then load the checkpoint again.');
  assert.deepEqual([await ask.count(), await live()], [0, other]);
 });
 await studio.checkLifecycle('Process checkpoint browser lifecycle emits no runtime errors or network requests');
});
