/// <reference path="../process-contracts.d.ts" />
/// <reference path="../process-slides-contracts.d.ts" />
/**
 * Dialog checks of the process-hostile-browser suite (ENG-16), called from `process-hostile-browser.ts`: Present (full and brief
 * decks, Contents) and Activity with its CSV and JSON exports. Each asserts that the hostile text is shown as text, that the
 * exports keep it in cells and strings, that nothing ticked and that the probe saw nothing run.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type {Page} from 'playwright';
import type {Studio} from './process-browser-fixture';
import {norm, type Kit} from './process-hostile-kit';
import {formulas, parseCsv} from './process-hostile-views-checks';

type W = {LWProcessSlides: LWProcessSlides.Api; LWProcessStudio: {query(): LWProcessApp.View}};
const textOf = async (page: Page, selector: string) => norm(await page.locator(selector).first().evaluate(e => e.textContent ?? ''));

export async function dialogChecks(studio: Studio, kit: Kit): Promise<void> {
 const {page, check, dir} = studio;
 const {process: def, clean, live, importDefinition, runToEnd} = kit;
 const shown = page.locator('dialog#present[open]');
 /** Pages from the first to the last slide, checking each title against the deck built in the page from the same view. */
 const pageThrough = async (brief: boolean) => {
  const titles = await page.evaluate(b => {
   const w = globalThis as unknown as W, q = w.LWProcessStudio.query();
   return w.LWProcessSlides.build(q.definition, q.snapshot.minute > 0 ? q.snapshot : null, {brief: b}).slides.map(s => s.title);
  }, brief);
  await page.keyboard.press('Home');
  for (let i = 0; i < titles.length; i++) {
   await page.waitForFunction(n => (globalThis as any).LWProcessStudio.query().presenting?.index === n, i);
   assert.equal(await textOf(page, '#present-title'), norm(titles[i]!), `slide ${i + 1}`);
   if (i < titles.length - 1) await page.locator('#present-next').click();
  }
  return titles;
 };

 await check('Present shows the hostile process in the full and brief decks and in Contents as text without ticking', async () => {
  await importDefinition(def);
  await runToEnd();
  const before = await live();
  await page.locator('#mode-present').click();
  await shown.waitFor();
  assert.equal(await textOf(page, '#present-process'), norm(def.name), 'the process line is the name as text');
  const titles = await pageThrough(false);
  assert(titles.some(t => t.includes(def.steps[1]!.name)), 'a step slide is titled by the hostile step name');
  await page.locator('#present-toc').click();
  await page.locator('#present-contents:not([hidden])').waitFor();
  const contents = await textOf(page, '#present-contents');
  for (const t of titles) assert(contents.includes(norm(t)), 'Contents lists ' + t.slice(0, 12));
  await page.locator('#present-brief').click();
  await page.waitForFunction(() => document.getElementById('present-brief')?.getAttribute('aria-pressed') === 'true');
  await page.locator('#present-toc').click();
  await pageThrough(true);
  await page.keyboard.press('Escape');
  await shown.waitFor({state: 'hidden'});
  assert.equal(await live(), before, 'presenting never ticks');
  await clean('Present');
 });

 await check('Activity lists hostile step names as text, and its CSV and JSON exports keep them in cells and strings', async () => {
  await importDefinition(def);
  await runToEnd();
  const before = await live();
  await page.locator('#open-activity').click();
  await page.locator('dialog.act-dialog[open]').waitFor();
  const rows = await textOf(page, '#act-rows');
  const named = def.steps.filter(s => rows.includes(norm(s.name)));
  assert(named.length >= 3, 'rows name steps as text: ' + named.length);
  const options = await page.locator('#act-step option').evaluateAll(o => o.map(x => x.textContent ?? ''));
  assert(options.map(norm).includes(norm(named[0]!.name)), 'the Step filter offers the name as text');
  await page.locator('#act-step').selectOption({index: 1});
  const saveAs = async (id: string, name: string) => {
   const pending = page.waitForEvent('download');
   await page.locator('#' + id).click();
   const file = path.join(dir, name);
   await (await pending).saveAs(file);
   return fs.readFileSync(file, 'utf8');
  };
  const csv = parseCsv(await saveAs('act-csv', 'hostile.events.csv'));
  assert.deepEqual(csv[0], ['minute', 'case', 'event', 'step_id', 'step', 'detail']);
  assert(csv.slice(1).every(r => r.length === 6), 'every row has six cells');
  assert.deepEqual(formulas(csv), [], 'no cell starts a spreadsheet formula');
  const json = JSON.parse(await saveAs('act-json', 'hostile.events.json')) as {events: {step: string}[]};
  assert(json.events.every(e => def.steps.some(s => s.name === e.step)), 'the JSON keeps the exact names');
  await page.keyboard.press('Escape');
  assert.equal(await live(), before, 'Activity never ticks');
  await clean('Activity');
 });
}
