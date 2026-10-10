/// <reference path="../process-contracts.d.ts" />
/**
 * Draft recovery checks of the process-shell-browser suite (ENG-9, LWProcessRecovery), called from `process-shell-browser.ts`.
 * These checks keep `localStorage` across their own reloads (the fixture clears it on every other load) and remove the flag
 * and every copy when they finish.
 */
import assert from 'node:assert/strict';
import {waitForReady, openArtifact} from './browser-harness';
import {query, KEEP_STORAGE, type Studio} from './process-browser-fixture';

/** Registers the recovery checks on the suite's page. */
export async function recoveryChecks(studio: Studio): Promise<void> {
 const {page, context, file, fixtureUrls, check, freshStudio, activeId, openDef, closeDef, restoreDef, switchTo} = studio;
 const ask = page.locator('dialog.ask-dialog[open]'), message = () => page.locator('#message').innerText();
 const copies = () => page.evaluate(() => Object.keys(localStorage).filter(k => k.includes('.process-draft.v1:')).sort());
 const stored = () => page.waitForFunction(() => Object.keys(localStorage).some(k => k.includes('.process-draft.v1:')));
 const keep = (on: boolean) => page.evaluate(([flag, value]) => {
  if (value) sessionStorage.setItem(flag!, '1'); else sessionStorage.removeItem(flag!);
 }, [KEEP_STORAGE, on ? '1' : ''] as const);
 const reload = async () => { await openArtifact(page, file, {url: fixtureUrls[0]!}); await waitForReady(page, {host: 'process'}); };
 /** Saves a renamed task of the active process to the draft through the step editor (nothing is applied). */
 const editDraft = async (name: string) => {
  const task = (await query(page)).definition.steps.find(s => s.kind === 'task')!;
  await page.locator(`#steps [data-step="${task.id}"]`).click(); await page.locator('#edit-step').click();
  await page.locator('#se-name').fill(name); await page.locator('#se-save').click();
 };
 const choices = () => page.locator('dialog.ask-dialog [data-pd-choice]').allInnerTexts();
 await check('A draft kept in this browser survives a reload and is offered on load and after a switch; Not now keeps it and Discard removes it', async () => {
  await freshStudio(); const original = await query(page);
  assert.deepEqual(await copies(), [], 'a clean studio stores nothing');
  await editDraft('Kept draft'); await stored();
  const [key] = await copies(), digest = await page.locator('meta[name="wildlands-game-digest"]').getAttribute('content');
  const fingerprint = await page.evaluate(() => {
   const w = globalThis as unknown as {LWProcessCatalog: LWProcess.Catalog; LWProcessStudio: {definition(): LWProcess.Definition}};
   return w.LWProcessCatalog.fingerprint(w.LWProcessStudio.definition());
  });
  assert.equal(key, `wildlands.agency-delivery.process-draft.v1:${digest}:${original.definition.id}:${fingerprint}`);
  const value = await page.evaluate(k => JSON.parse(localStorage.getItem(k)!), key!);
  assert.deepEqual(Object.keys(value).sort(), ['processName', 'savedAt', 'text']); assert.equal(value.processName, original.definition.name);
  assert.match(value.text, /"name": "Kept draft"/);
  await keep(true); await reload();
  await ask.waitFor(); assert.match(await page.locator('#ask-title').innerText(), /^Recover draft from (\d{4}-\d\d-\d\d )?\d\d:\d\d\?$/);
  assert.deepEqual(await choices(), ['Not now', 'Discard saved draft', 'Recover draft']); assert.equal(await activeId(), 'ask-cancel', 'Not now is the default');
  assert.match(await page.locator('#ask-confirm-title').innerText(), new RegExp(`unapplied draft of ${original.definition.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  await page.keyboard.press('Escape'); await ask.waitFor({state: 'hidden'});
  assert.equal(await message(), 'Saved draft kept. It is offered again when this process opens.');
  assert.deepEqual([await page.locator('#draft-chip').isHidden(), await copies()], [true, [key]], 'nothing recovered, the copy is kept');
  assert.deepEqual((await query(page)).definition, original.definition); assert.equal((await query(page)).snapshot.minute, 0);
  await reload(); await ask.waitFor(); await page.locator('#ask-discard').click(); await ask.waitFor({state: 'hidden'});
  assert.equal(await message(), 'Saved draft discarded. The running definition is unchanged.'); assert.deepEqual(await copies(), []);
  await reload(); assert.equal(await ask.count(), 0, 'a discarded copy is not offered again');
  // A draft of another process is offered when that process opens, and focus returns to the Process selector.
  await switchTo(1); await editDraft('Vendor draft'); await stored(); await reload(); assert.equal(await ask.count(), 0);
  await page.locator('#process-switch').focus(); await page.locator('#process-switch').selectOption('1'); await ask.waitFor();
  assert.equal((await query(page)).active, 1); await page.locator('#ask-cancel').click(); await ask.waitFor({state: 'hidden'});
  assert.equal(await activeId(), 'process-switch');
  await reload(); await keep(false); await page.evaluate(() => localStorage.clear());
 });
 await check('Recover draft restores the saved draft without applying it; copies for another definition are ignored and blocked or full storage changes nothing else', async () => {
  await freshStudio(); const original = await query(page);
  await editDraft('Recovered draft'); await stored(); const [key] = await copies();
  await keep(true); await reload(); await ask.waitFor(); await page.locator('#ask-recover').click(); await ask.waitFor({state: 'hidden'});
  assert.match(await message(), /^Draft recovered from (\d{4}-\d\d-\d\d )?\d\d:\d\d\. Nothing is applied; review it in the Definition editor\.$/);
  assert.match(await page.locator('#draft-chip').innerText(), /^Unapplied draft/);
  const now = await query(page); assert.deepEqual([now.definition, now.snapshot.minute], [original.definition, 0], 'nothing is applied');
  await openDef(); assert.match(await page.locator('#draft').inputValue(), /"name": "Recovered draft"/);
  // Restoring the running definition removes the copy (after the same short pause as a save).
  await restoreDef(); await closeDef();
  await page.waitForFunction(k => localStorage.getItem(k) === null, key!);
  // A copy kept for an earlier revision of the definition (another fingerprint) is ignored.
  const stale = key!.replace(/:[^:]+$/, ':0000000000000000');
  await page.evaluate(([k, v]) => localStorage.setItem(k!, v!), [stale, JSON.stringify({text: '{}', savedAt: 1, processName: 'Old'})] as const);
  await reload(); assert.equal(await ask.count(), 0, 'a copy for another definition is not offered');
  // A draft over 1 MiB keeps no copy and says so once.
  await openDef(); await page.locator('#draft').fill(JSON.stringify({huge: 'x'.repeat(1100000)})); await closeDef();
  await page.waitForFunction(() => document.getElementById('message')!.textContent!.startsWith('This draft is larger than 1 MiB'));
  assert.deepEqual(await copies(), [stale], 'nothing new is stored');
  await keep(false); await page.evaluate(() => localStorage.clear()); await freshStudio();
  // Storage that throws (private mode, blocked site data): no copy, no offer, no error, and the studio works as before.
  const blocked = await context.newPage();
  await blocked.addInitScript(() => Object.defineProperty(window, 'localStorage', {get() { throw new DOMException('Blocked', 'SecurityError'); }}));
  await openArtifact(blocked, file, {url: fixtureUrls[0]!}); await waitForReady(blocked, {host: 'process'});
  await blocked.locator('#steps [data-step="discovery"]').click(); await blocked.locator('#edit-step').click();
  await blocked.locator('#se-name').fill('Blocked draft'); await blocked.locator('#se-save').click();
  await blocked.locator('#process-switch').selectOption('1'); await blocked.waitForFunction(() => (globalThis as any).LWProcessStudio.query().active === 1);
  assert.equal(await blocked.locator('#message').getAttribute('class'), 'process-message', 'no error is shown');
  await openArtifact(blocked, file, {url: fixtureUrls[0]!}); await waitForReady(blocked, {host: 'process'});
  assert.equal(await blocked.locator('dialog.ask-dialog[open]').count(), 0, 'nothing is offered');
  await blocked.locator('#advance').click(); assert.equal((await query(blocked)).snapshot.minute, 30); await blocked.close();
 });
}
