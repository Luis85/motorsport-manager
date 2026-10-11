/// <reference path="../process-contracts.d.ts" />
/**
 * File checks of the process-hostile-browser suite (ENG-16), called from `process-hostile-browser.ts`: BPMN export of the hostile
 * process (refused in plain words for control characters XML cannot carry; the XML-safe copy round-trips through the Import BPMN
 * dialog preview), the export notes dialog, a foreign BPMN file with hostile names that the preview rejects, Download HTML reopened
 * in a probed page, and a game folder whose own definitions are hostile, built with the CLI, opened, edited and reloaded to its
 * draft recovery prompt. Every page asserts the probe stayed clean.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type {Page} from 'playwright';
import {buildGame, KEEP_STORAGE, query, type Studio} from './process-browser-fixture';
import {norm, type Kit} from './process-hostile-kit';
import {foreignBpmn, xmlSafe} from './process-hostile-models';
import {serveWithPolicy} from './process-hostile-probe';

type W = {LWProcessBpmn: LWProcessBpmn.Api; LWProcessStudio: {query(): LWProcessApp.View}};
const textOf = async (page: Page, selector: string) => norm(await page.locator(selector).first().evaluate(e => e.textContent ?? ''));

export async function ioChecks(studio: Studio, kit: Kit): Promise<void> {
 const {page, context, check, dir, exportVia, fixtureUrls, gameDir} = studio;
 const {process: def, journey, clean, live, importDefinition, ready, select} = kit;
 /** Saves the download that `act` starts and returns its text. */
 const downloaded = async (act: () => Promise<void>, name: string) => {
  const pending = page.waitForEvent('download');
  await act();
  const file = path.join(dir, name);
  await (await pending).saveAs(file);
  return fs.readFileSync(file, 'utf8');
 };
 /** Opens `html` in a new probed page served with the report-only policy and waits for the studio. */
 const openProbed = async (url: string, html: string) => {
  const other = await context.newPage();
  await serveWithPolicy(other, url, html);
  await other.goto(url);
  await ready(other);
  return other;
 };

 await check('BPMN export refuses hostile control characters in plain words, and the XML-safe copy round-trips through the Import BPMN preview', async () => {
  await importDefinition(def);
  await exportVia('#bpmn');
  await page.waitForFunction(() => (document.getElementById('message')?.textContent ?? '').startsWith('Export failed: '));
  assert.match(await textOf(page, '#message'), /contains the character U\+0001, which XML 1\.0 cannot represent; remove it before exporting\.$/);
  await clean('refused BPMN export');
  const safe = xmlSafe(def);
  await importDefinition(safe, 'hostile-xml-safe.json');
  const xml = await downloaded(() => exportVia('#bpmn-bpsim'), 'hostile.bpsim.bpmn');
  assert(!xml.includes('<img') && xml.includes('&lt;img src=x onerror=__hit(1)&gt;'), 'the XML carries the markup as escaped text');
  await page.locator('#export-menu').click();
  await page.locator('#export-notes').click();
  const notes = page.locator('dialog.pd-dialog[open]:has(.xn-notes)');
  await notes.waitFor();
  const expected = await page.evaluate(() => {
   const w = globalThis as unknown as W;
   return w.LWProcessBpmn.fidelity(w.LWProcessStudio.query().definition, {bpsim: true});
  });
  assert.deepEqual((await notes.locator('.xn-notes li').evaluateAll(l => l.map(x => x.textContent ?? ''))).map(norm), expected.map(norm));
  await page.keyboard.press('Escape');
  await notes.waitFor({state: 'hidden'});
  await clean('export notes');
  await studio.freshStudio();
  await page.locator('#file').setInputFiles({name: 'hostile.bpmn', mimeType: 'application/xml', buffer: Buffer.from(xml)});
  await page.locator('dialog.bi-dialog[open]').waitFor();
  await page.waitForFunction(() => document.getElementById('bi-preview')?.dataset.state !== 'pending');
  // The preview maps element ids; the names show in the Process picker and the lanes list.
  assert((await textOf(page, '#bi-process option')).startsWith(norm(safe.name)), 'the Process picker names the process as text');
  const lanes = await page.locator('#bi-contents .bi-inline').first().locator('li').evaluateAll(l => l.map(x => x.textContent ?? ''));
  assert(lanes.length > 0 && lanes.every(l => safe.resources.some(r => norm(r.name) === norm(l))), 'the lanes are pool names as text');
  await clean('Import BPMN preview');
  await page.locator('#bi-import').click();
  await page.locator('dialog.bi-dialog[open]').waitFor({state: 'hidden'});
  const imported = (await query(page)).definition;
  assert.deepEqual(imported.steps.map(s => norm(s.name)), safe.steps.map(s => norm(s.name)), 'the BPMN-imported names are the exported text');
  assert.equal(norm(imported.name), norm(safe.name));
  await page.locator('#mode-2d').click();
  await select('intake');
  await clean('BPMN-imported process');
 });

 await check('A foreign BPMN file with hostile names, an unsupported gateway and a dangling flow shows them as text and imports nothing', async () => {
  await importDefinition(def);
  const before = await live();
  const xml = foreignBpmn();
  await page.locator('#file').setInputFiles({name: 'foreign.bpmn', mimeType: 'application/xml', buffer: Buffer.from(xml.text)});
  await page.locator('dialog.bi-dialog[open]').waitFor();
  await page.waitForFunction(() => document.getElementById('bi-preview')?.dataset.state !== 'pending');
  assert.match(await textOf(page, '#bi-preview'), /^Cannot import: 2 rejections\./, 'the gateway and the dangling flow are rejected');
  assert((await textOf(page, '#bi-preview .bi-bad')).includes('Gateway_1'), 'the rejection names the gateway');
  assert((await textOf(page, '#bi-process option')).startsWith(xml.names.process), 'the Process picker names the process as text');
  assert.equal(await textOf(page, '#bi-contents .bi-inline li'), xml.names.lane, 'the lane is named as text');
  assert.match(await textOf(page, '#bi-standards'), /problems? against BPMN 2\.0/, 'the standards note lists the dangling reference');
  assert.equal(await page.locator('#bi-import').isDisabled(), true, 'a rejected file cannot be imported');
  await clean('foreign BPMN preview');
  await page.keyboard.press('Escape');
  await page.locator('dialog.bi-dialog[open]').waitFor({state: 'hidden'});
  assert.equal(await live(), before, 'the active process and its run are unchanged');
  await clean('foreign BPMN cancelled');
 });

 await check('Download HTML of the hostile process reopens with the same definition, shows it as text and runs nothing', async () => {
  await importDefinition(def);
  const html = await downloaded(() => exportVia('#html'), 'hostile.html');
  assert(!html.includes('<img src=x'), 'the embedded definition carries no raw markup');
  const other = await openProbed(fixtureUrls[1]!, html);
  try {
   assert.deepEqual((await query(other)).definition, (await query(page)).definition);
   assert.equal(await textOf(other, '#process-title'), norm(def.name));
   await other.locator('#mode-2d').click();
   await other.locator(`#steps [data-step="intake"]`).click();
   assert.equal(await textOf(other, '#scene-title'), norm(def.steps[1]!.name));
   await clean('reopened Download HTML', other);
  } finally {
   await other.close();
  }
 });

 await check('A game whose own definitions are hostile builds, opens, switches and offers its hostile draft for recovery as text', async () => {
  // A game folder is named by its id, so the hostile game lives in a folder of its own named like the agency game.
  const game = path.join(dir, 'hostile-game', 'agency-delivery'), html = path.join(dir, 'hostile-game.html');
  fs.mkdirSync(path.join(game, 'content'), {recursive: true});
  const manifest = JSON.parse(fs.readFileSync(path.join(gameDir, 'game.json'), 'utf8'));
  manifest.content = {definitions: ['content/hostile.process.json', 'content/hostile-journey.process.json']};
  fs.writeFileSync(path.join(game, 'game.json'), JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(path.join(game, 'content/hostile.process.json'), JSON.stringify(def, null, 2) + '\n');
  fs.writeFileSync(path.join(game, 'content/hostile-journey.process.json'), JSON.stringify(journey, null, 2) + '\n');
  buildGame(game, html);
  const built = fs.readFileSync(html, 'utf8');
  assert(!built.includes('<img src=x'), 'the built page embeds no raw markup');
  const other = await openProbed(fixtureUrls[4]!, built);
  try {
   const q = await query(other);
   assert.deepEqual(q.processes.map(p => p.name), [def.name, journey.name]);
   const options = await other.locator('#process-switch option').evaluateAll(o => o.map(x => x.textContent ?? ''));
   assert.deepEqual(options.map(norm), [norm(def.name), norm(journey.name)]);
   await other.locator('#process-switch').selectOption('1');
   await other.waitForFunction(() => (globalThis as any).LWProcessStudio.query().active === 1);
   await other.locator('#mode-lens').click();
   await other.locator('#lens [data-step]').first().waitFor();
   await other.locator('#process-switch').selectOption('0');
   await other.waitForFunction(() => (globalThis as any).LWProcessStudio.query().active === 0);
   await clean('hostile game', other);
   // A draft of the hostile process kept in this tab's storage is offered on the next load, naming the process as text.
   await other.evaluate(flag => sessionStorage.setItem(flag, '1'), KEEP_STORAGE);
   await other.locator('#steps [data-step="intake"]').click();
   await other.locator('#edit-step').click();
   await other.locator('#se-name').fill('Renamed ' + def.steps[2]!.name.replace(/[\r\n]/g, ''));
   await other.locator('#se-save').click();
   await other.waitForFunction(() => Object.keys(localStorage).some(k => k.includes('.process-draft.v1:')));
   await other.goto(fixtureUrls[4]!);
   await ready(other);
   const ask = other.locator('dialog.ask-dialog[open]');
   await ask.waitFor();
   assert((await textOf(other, '#ask-confirm-title')).includes(`unapplied draft of ${norm(def.name)} from `), 'the prompt names the process as text');
   await clean('recovery prompt', other);
   await other.locator('#ask-discard').click();
   await ask.waitFor({state: 'hidden'});
   await other.evaluate(flag => { sessionStorage.removeItem(flag); localStorage.clear(); }, KEEP_STORAGE);
  } finally {
   await other.close();
  }
 });
}
