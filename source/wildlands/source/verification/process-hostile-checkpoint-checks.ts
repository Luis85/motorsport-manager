/// <reference path="../process-contracts.d.ts" />
/// <reference path="../process-checkpoint.ts" />
/**
 * Run checkpoint check of the process-hostile-editors-browser suite, called from `process-hostile-editors-browser.ts`: a checkpoint
 * of the hostile process is exported and loaded under a hostile file name; the Cancel-first question shows the hostile process
 * name as text; a checkpoint whose run carries markup in its case fields and event details restores and is listed by Activity as
 * text; a checkpoint with a `__proto__` key is refused and pollutes nothing. The probe must stay clean throughout.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type {Studio} from './process-browser-fixture';
import {norm, type Kit} from './process-hostile-kit';

export async function checkpointChecks(studio: Studio, kit: Kit): Promise<void> {
 const {page, check, dir, exportVia} = studio;
 const {process: def, clean, live, importDefinition} = kit;
 const ask = page.locator('dialog.ask-dialog[open]'), message = async () => norm(await page.locator('#message').innerText());
 const load = async (name: string, text: string) => {
  await page.locator('#export-menu').click();
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#checkpoint-load').click();
  await (await chooser).setFiles({name, mimeType: 'application/json', buffer: Buffer.from(text)});
 };
 await check('A hostile run checkpoint exports, asks with the hostile names as text, restores markup as text and refuses a __proto__ key', async () => {
  await importDefinition(def);
  await page.locator('#advance').click();
  const pending = page.waitForEvent('download');
  await exportVia('#checkpoint-export');
  const file = path.join(dir, 'hostile.checkpoint.json');
  await (await pending).saveAs(file);
  const text = fs.readFileSync(file, 'utf8'), c = JSON.parse(text) as LWProcessCheckpoint.Checkpoint;
  assert.equal(c.process, def.id);
  const hostileName = '<img src=x onerror=__hit(41)>.checkpoint.json', run = await live();
  await load(hostileName, text);
  await ask.waitFor();
  assert.equal(norm(await page.locator('#ask-title').evaluate(e => e.textContent ?? '')), norm(`Load checkpoint into ${def.name}?`));
  assert(norm(await ask.evaluate(e => e.textContent ?? '')).includes(hostileName), 'the hostile file name is shown as text');
  await clean('checkpoint question');
  await page.keyboard.press('Escape');
  await ask.waitFor({state: 'hidden'});
  assert.equal(await live(), run, 'the question never ticks; Cancel keeps the run');
  const marked = JSON.parse(text) as LWProcessCheckpoint.Checkpoint, event = marked.snapshot.events.at(-1)!;
  event.detail = '<img src=x onerror=__hit(42)>"\'><script>__hit(43)</script>';
  marked.snapshot.cases[0]!.data.note = '<svg onload=__hit(44)>';
  await load('marked.checkpoint.json', JSON.stringify(marked));
  await ask.waitFor();
  await page.locator('#ask-go').click();
  await page.waitForFunction(() => document.getElementById('message')!.textContent!.startsWith('Loaded '));
  await page.locator('#open-activity').click();
  await page.locator('dialog.act-dialog[open]').waitFor();
  const rows = norm(await page.locator('#act-rows').evaluate(e => e.textContent ?? ''));
  assert(rows.includes(norm(event.detail)), 'Activity lists the restored event detail as text');
  await clean('restored hostile run and its Activity');
  await page.keyboard.press('Escape');
  await page.locator('dialog.act-dialog[open]').waitFor({state: 'hidden'});
  const polluted = text.replace('{', '{"__proto__": {"polluted": "<img src=x onerror=__hit(45)>"}, ');
  await load('polluted.checkpoint.json', polluted);
  await page.waitForFunction(() => document.getElementById('message')!.textContent!.startsWith('Load checkpoint refused'));
  assert.equal(await message(), 'Load checkpoint refused: checkpoint has the forbidden key __proto__.');
  assert.equal(await page.evaluate(() => (({}) as {polluted?: unknown}).polluted === undefined), true, 'no prototype changed');
  await clean('refused polluted checkpoint');
 });
}
