/// <reference path="../process-contracts.d.ts" />
/**
 * Definition import, export and download checks of the process browser suite (process-browser.ts calls `definitionIoChecks` once,
 * in its own order): rejected JSON imports that keep the active definition and run, the definition editor's validated apply and
 * explicit reset, lossless draft and JSON exports, the report bound to the definition and its observed metrics, downloaded
 * self-contained HTML that reopens offline, and imported text that stays inert through an escaped standalone export.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {waitForReady, openArtifact} from './browser-harness';
import {query, type Studio} from './process-browser-fixture';

export async function definitionIoChecks(studio: Studio): Promise<void> {
 const {page, context, diagnostics, dir, file, fixtureUrls, check, defOpen, openDef, closeDef, restoreDef, applyDef, exportVia, activeId} = studio;
 const message = () => page.locator('#message').innerText(), ask = page.locator('dialog.ask-dialog[open]');
 const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
 await check('Invalid JSON import preserves the active definition and run', async () => {
  const before = await query(page), rejected = async (name: string, text: string) => {
   const prior = await message();
   await page.locator('#file').setInputFiles({name, mimeType: 'application/json', buffer: Buffer.from(text)});
   await page.waitForFunction(p => {
    const now = document.getElementById('message')!.textContent!; return now !== p && now.startsWith('Import rejected');
   }, prior);
   const said = await message(); assert.doesNotMatch(said, /Error: |SyntaxError|: :/, 'plain language, no developer prefixes');
   assert.deepEqual(await query(page), before); return said;
  };
  const expected = literal('Choose a .process.json exported from the studio, or a BPMN file.');
  const notProcess = new RegExp(`^Import rejected: this file is not a Wildlands process \\(\\d+ problems\\)\\. ${expected}$`);
  assert.match(await rejected('broken.json', '{"format":"wrong"}'), notProcess);
  assert.match(await rejected('syntax.json', '{bad'), new RegExp(`^Import rejected: the file is not valid JSON \\(line 1, column 2\\)\\. ${expected}$`));
  const missing = JSON.parse(JSON.stringify(before.definition)) as LWProcess.Definition; delete (missing.steps[1] as Partial<LWProcess.Step>).scene;
  assert.match(await rejected('missing.json', JSON.stringify(missing)),
   /^Import rejected: this process has 1 problem; first, \/steps\/1: .*\. Fix the file, then import it again\.$/);
  // A long eleven-problem summary stays within two lines and never reflows the stage bar.
  await rejected('not-a-process.json', '{"not":"a process"}');
  const bar = await page.evaluate(() => {
   const m = document.getElementById('message')!, line = parseFloat(getComputedStyle(m).lineHeight);
   const shown = [...document.querySelectorAll('.process-view-controls button')].filter(b => b.getClientRects().length);
   return {lines: m.getBoundingClientRect().height / line, tops: shown.map(b => Math.round(b.getBoundingClientRect().top))};
  });
  assert(bar.lines <= 2.05, 'the status line is clamped to two lines: ' + bar.lines); assert.equal(new Set(bar.tops).size, 1, 'the view buttons keep one row');
  // The error gives way to the next successful command.
  assert.equal(await page.locator('#message').getAttribute('class'), 'process-message error');
  await page.locator('#step').click(); assert.equal(await page.locator('#message').getAttribute('class'), 'process-message');
  assert.match(await message(), /^Advanced to minute/);
 });
 await check('Definition editor validates before applying and resets a valid edit explicitly', async () => {
  await openDef(); const before = await query(page);
  await page.locator('#draft').fill('{bad'); await page.locator('#de-apply').click(); assert.deepEqual((await query(page)).snapshot, before.snapshot);
  assert.equal(await defOpen.count(), 1, 'an invalid draft is refused and the editor stays open');
  assert.equal(await page.locator('#de-status').getAttribute('role'), 'alert');
  assert.match(await page.locator('#de-status').innerText(), /cannot be applied yet.*line 1, column 2/s);
  const d = before.definition; d.name = 'Reviewed agency process';
  await page.locator('#draft').fill(JSON.stringify(d));
  await page.locator('#de-validate').click();
  assert.match(await page.locator('#de-message').innerText(), /^Valid definition\. Applying starts a fresh paused run\.$/);
  await applyDef();
  const next = await query(page);
  assert.equal(next.snapshot.minute, 0);
  assert.equal(next.definition.revision, before.definition.revision + 1);
  assert.equal(next.playing, false);
 });
 await check('Unapplied drafts export losslessly without changing the active process or retaining stale validation', async () => {
  await openDef(); const before = await query(page);
  await page.locator('#de-validate').click(); assert.match(await page.locator('#de-message').innerText(), /Valid definition/);
  const raw = '{\n  "unfinished":'; await page.locator('#draft').fill(raw);
  assert.equal(await page.locator('#de-message').innerText(), '', 'a stale validation result is cleared by the next edit');
  assert.equal(await page.locator('#de-chip').innerText(), 'Unapplied draft');
  assert.match(await page.locator('#draft-state').innerText(), /Invalid JSON: line 2, column \d+/);
  await page.locator('#de-validate').click(); assert.equal(await page.locator('#draft').getAttribute('aria-invalid'), 'true');
  let pending = page.waitForEvent('download'); await page.locator('#de-export').click(); let saved = await pending;
  const draftFile = path.join(dir, 'unfinished.json'); await saved.saveAs(draftFile); assert.equal(fs.readFileSync(draftFile, 'utf8'), raw);
  await closeDef(); assert.match(await page.locator('#draft-chip').innerText(), /^Unapplied draft/);
  pending = page.waitForEvent('download'); await exportVia('#json'); saved = await pending;
  const activeFile = path.join(dir, 'active.json');
  await saved.saveAs(activeFile);
  assert.deepEqual(JSON.parse(fs.readFileSync(activeFile, 'utf8')), before.definition);
  assert.deepEqual(await query(page), before);
  await openDef(); assert.equal(await page.locator('#draft').inputValue(), raw);
  await restoreDef(); assert.equal(await page.locator('#draft').getAttribute('aria-invalid'), null);
  assert.match(await page.locator('#draft-state').innerText(), /matches the running definition/);
  await closeDef();
  assert.equal(await page.locator('#draft-chip').isHidden(), true);
 });
 await check('Browser exported JSON imports losslessly and report binds definition to observed metrics', async () => {
  let pending = page.waitForEvent('download');
  await exportVia('#json');
  let download = await pending;
  const jsonFile = path.join(dir, 'export.json');
  await download.saveAs(jsonFile);
  const definition = (await query(page)).definition; assert.deepEqual(JSON.parse(fs.readFileSync(jsonFile, 'utf8')), definition);
  assert.equal(await message(), `Exported ${definition.id}.process.json (the running definition).`);
  await page.locator('#advance').click();
  pending = page.waitForEvent('download');
  await exportVia('#report');
  download = await pending;
  const reportFile = path.join(dir, 'report.json');
  await download.saveAs(reportFile);
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8')); assert.equal(report.snapshot.minute, 30); assert.deepEqual(report.definition, definition);
  assert.equal(await message(), `Exported ${definition.id}.report.json: the run report at minute 30.`);
  // With an unapplied draft the menu says exports use the running definition and offers the draft as written.
  await page.locator('[data-step="discovery"]').click(); await page.locator('#edit-step').click(); await page.locator('#se-name').fill('Discovery v2');
  await page.locator('#se-save').click();
  await page.locator('#export-menu').click();
  assert.match(await page.locator('#export-hint').innerText(), /Your unapplied draft is not included; Export draft JSON saves it as written\.$/);
  pending = page.waitForEvent('download'); await page.locator('#draft-json').click(); download = await pending;
  assert.equal(download.suggestedFilename(), definition.id + '.draft.json');
  const draftFile = path.join(dir, 'draft.json'); await download.saveAs(draftFile);
  assert.equal(JSON.parse(fs.readFileSync(draftFile, 'utf8')).steps[1].name, 'Discovery v2');
  // Importing over a run in progress or a draft asks first, starting on Cancel; Cancel keeps everything and returns focus to Import.
  const running = await query(page), pick = async () => {
   const chooser = page.waitForEvent('filechooser'); await page.locator('#import').click(); await (await chooser).setFiles(jsonFile);
  };
  await pick(); await ask.waitFor(); assert.equal(await activeId(), 'ask-cancel');
  assert.equal(await page.locator('#ask-title').innerText(), `Replace ${definition.name}?`);
  assert.equal(await page.locator('#ask-confirm-title').innerText(), `Importing export.json replaces ${definition.name} and discards minute 30`
   + ' of the current run'
   + ' and the unapplied draft (1 step changed). Export the run report or the draft first if you need them.'
   + ` Add as a new process keeps ${definition.name} and its run.`);
  assert.deepEqual(await page.locator('dialog.ask-dialog [data-pd-choice]').allInnerTexts(), ['Cancel', 'Add as a new process', 'Import and replace']);
  await page.keyboard.press('Escape'); await ask.waitFor({state: 'hidden'}); assert.equal(await activeId(), 'import');
  assert.deepEqual(await query(page), running);
  assert.match(await page.locator('#draft-chip').innerText(), /^Unapplied draft/); assert.match(await message(), /^Import of export\.json cancelled/);
  await pick(); await ask.waitFor(); await page.locator('#ask-go').click();
  await page.waitForFunction(() => document.getElementById('message')!.textContent!.includes('Imported'));
  assert.deepEqual((await query(page)).definition, definition); assert.equal((await query(page)).snapshot.minute, 0);
  assert.equal(await page.locator('#draft-chip').isHidden(), true);
  await page.locator('#export-menu').click(); assert.equal(await page.locator('#draft-json').isHidden(), true);
  assert.doesNotMatch(await page.locator('#export-hint').innerText(), /draft/);
  await page.keyboard.press('Escape');
 });
 await check('Downloaded self-contained HTML reopens offline with the edited definition and no requests', async () => {
  const pending = page.waitForEvent('download');
  await exportVia('#html');
  const download = await pending, exported = path.join(dir, 'exported.html');
  await download.saveAs(exported);
  const other = await context.newPage(); await openArtifact(other, exported, {url: fixtureUrls[1]!}); await waitForReady(other, {host: 'process'});
  assert.deepEqual((await query(other)).definition, (await query(page)).definition); assert.equal((await query(other)).snapshot.minute, 0);
  assert.equal(await other.locator('#process-title').count(), 1); await other.close(); assert.deepEqual(diagnostics.requests, []);
 });
 await check('Imported text renders inertly and survives escaped standalone HTML export', async () => {
  const d = (await query(page)).definition; d.name = '</script><img src=x onerror=alert(1)>';
  await page.locator('#file').setInputFiles({name: 'text.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(d))});
  await page.waitForFunction(() => document.getElementById('process-title')!.textContent!.startsWith('</script>'));
  assert.equal(await page.locator('img').count(), 0);
  const pending = page.waitForEvent('download');
  await exportVia('#html');
  const download = await pending, escaped = path.join(dir, 'escaped.html');
  await download.saveAs(escaped);
  const other = await context.newPage();
  await openArtifact(other, escaped, {url: fixtureUrls[2]!});
  await waitForReady(other, {host: 'process'});
  assert.equal((await query(other)).definition.name, d.name);
  await other.close();
 });
}
