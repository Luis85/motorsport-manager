/// <reference path="../process-contracts.d.ts" />
/**
 * View checks of the process-hostile-browser suite (ENG-16), called from `process-hostile-browser.ts`: the hostile process imported
 * as JSON in the studio shell, every step in 2D and 3D, the SIPOC and Journey lenses and the Dashboard (every section, every step
 * focus, What-if and the CSV export). Each check runs the process with the explicit Run to end command first, then visits views
 * and asserts that the visits never ticked, that the hostile text is shown as text and that the probe saw nothing run.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type {Page} from 'playwright';
import {nextFrames} from './browser-harness';
import {query, type Studio} from './process-browser-fixture';
import {norm, type Kit} from './process-hostile-kit';

/** Text of the first element matching `selector`, exactly as the DOM holds it. */
const textOf = async (page: Page, selector: string) => norm(await page.locator(selector).first().evaluate(e => e.textContent ?? ''));

/** Parses RFC 4180 CSV (quoted fields, doubled quotes, CRLF or LF rows) into rows of cells. */
export function parseCsv(text: string): string[][] {
 const rows: string[][] = [];
 let row: string[] = [], cell = '', quoted = false;
 for (let i = 0; i < text.length; i++) {
  const c = text[i]!;
  if (quoted) {
   if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
   else if (c === '"') quoted = false;
   else cell += c;
  } else if (c === '"') quoted = true;
  else if (c === ',') { row.push(cell); cell = ''; }
  else if (c === '\n' || c === '\r') {
   if (c === '\r' && text[i + 1] === '\n') i++;
   row.push(cell); rows.push(row); row = []; cell = '';
  } else cell += c;
 }
 if (cell || row.length) { row.push(cell); rows.push(row); }
 return rows;
}
/** CSV cells a spreadsheet would run as a formula: a leading = + - @ (or tab, return) on anything but a plain number. */
export const formulas = (rows: string[][]) => rows.flat().filter(c => /^[=+\-@\t\r]/.test(c) && !/^[-+]?[\d.,]+%?( to [-+]?[\d.,]+%?)?$/.test(c));

export async function viewChecks(studio: Studio, kit: Kit): Promise<void> {
 const {page, check, showIo, dir} = studio;
 const {process: def, journey, clean, live, importDefinition, runToEnd, select} = kit;

 await check('A hostile process imported as JSON shows its text in the header, step list, inspector, pools and Inputs & outputs and runs nothing', async () => {
  await importDefinition(def);
  await clean('after import');
  assert.equal(await textOf(page, '#process-title'), norm(def.name), 'the title is the name as text');
  for (const s of def.steps) assert((await textOf(page, `#steps [data-step="${s.id}"]`)).includes(norm(s.name)), s.id + ' in the step list');
  const pools = await textOf(page, '#pools');
  for (const r of def.resources) assert(pools.includes(norm(r.name)), 'pool ' + r.id + ' is named as text');
  await runToEnd();
  await showIo();
  const note = JSON.stringify(def.arrivals[0]!.data.note);
  assert((await textOf(page, '#process-data')).includes(note), 'case data shows the arrival note as JSON text');
  await select('intake');
  const inspector = await textOf(page, '#inspector');
  assert(inspector.includes(norm(def.steps[1]!.description!)), 'the step description is text');
  assert(inspector.includes(norm(def.flows[1]!.label!)), 'the next path label is text');
  await select('pack');
  assert((await textOf(page, '#inspector')).includes(norm(def.steps[3]!.technology!)), 'the technology label is text');
  await clean('shell, inspector and Inputs & outputs');
 });

 await check('Every hostile step in 2D and 3D shows its name as text in the scene title, card title and caption without ticking', async () => {
  await importDefinition(def);
  await runToEnd();
  const before = await live();
  await page.locator('#mode-2d').click();
  await page.locator('#map svg').waitFor();
  for (const s of def.steps) {
   await select(s.id);
   assert.equal(await textOf(page, '#scene-title'), norm(s.name), s.id + ' scene title');
   const card = page.locator(`#process-map-${s.id}`);
   assert(norm(await card.locator(':scope > title').first().evaluate(e => e.textContent ?? '')).startsWith(norm(s.name)), s.id + ' card title');
   assert(norm((await card.getAttribute('aria-label')) ?? '').includes(norm(s.name)), s.id + ' card name');
   await card.focus();
   await page.waitForFunction(n => (document.getElementById('map-caption')?.textContent ?? '').replace(/\r\n?/g, '\n').includes(n), norm(s.name));
  }
  await page.locator('#overview').click();
  await clean('2D');
  await page.locator('#mode-3d').click();
  for (const s of def.steps) {
   await select(s.id);
   assert.equal(await textOf(page, '#scene-title'), norm(s.name), s.id + ' 3D scene title');
   await nextFrames(page);
  }
  await page.locator('#overview').click();
  await nextFrames(page);
  assert.equal(await live(), before, 'navigating 2D and 3D never ticks');
  await clean('3D');
 });

 await check('The SIPOC lens of the hostile process and the Journey lens of the hostile journey show parties, phases and notes as text', async () => {
  await importDefinition(def);
  await runToEnd();
  await page.locator('#mode-lens').click();
  await page.locator('#lens > *').first().waitFor();
  const sipoc = await textOf(page, '#lens');
  const parties = [...def.sipoc!.suppliers!, ...def.sipoc!.customers!];
  for (const p of parties) assert(sipoc.includes(norm(p.name)), 'party ' + p.name.slice(0, 8));
  const [supplies, receives] = [def.sipoc!.suppliers![0]!.supplies!, def.sipoc!.customers![0]!.receives!].map(norm);
  assert(sipoc.includes(supplies!) && sipoc.includes(receives!), 'supplies and receives');
  await clean('SIPOC lens');
  await importDefinition(journey);
  await runToEnd();
  const before = await live();
  await page.locator('#mode-lens').click();
  await page.locator('#lens [data-step]').first().waitFor();
  const lens = await textOf(page, '#lens');
  const visit = journey.steps.find(s => s.id === 'visit')!;
  assert(lens.includes(norm(visit.phase!)) && lens.includes(norm(visit.name)), 'the journey shows the phase and the touchpoint name');
  for (const id of await page.locator('#lens [data-step]').evaluateAll(e => e.map(x => x.getAttribute('data-step')!))) {
   await page.locator(`#lens [data-step="${id}"]`).first().click();
   await page.waitForFunction(s => (globalThis as any).LWProcessStudio.query().selected === s, id);
  }
  assert((await textOf(page, '#inspector')).length > 0);
  assert.equal(await live(), before, 'the lenses never tick');
  await clean('Journey lens');
 });

 await check('The Dashboard of the hostile process renders every section, every step focus and What-if, and its CSV keeps the text in cells', async () => {
  await importDefinition(def);
  await runToEnd();
  const before = await live();
  await page.locator('#mode-dashboard').click();
  await page.locator('#dashboard .db-tiles').waitFor();
  const named = await page.locator('#dashboard .process-dashboard').getAttribute('aria-label');
  assert.equal(norm(named ?? ''), norm(def.name) + ' dashboard', 'the dashboard is named by the process name as an attribute value');
  for (const s of def.steps) {
   await select(s.id);
   await page.locator('#dashboard [data-section="focus"]').waitFor();
   assert.equal(await textOf(page, '#db-s-focus'), 'Step focus: ' + norm(s.name), s.id + ' focus heading');
  }
  await page.locator('#overview').click();
  await page.locator('#dashboard [data-section="time"]').waitFor();
  await clean('Dashboard sections and step focus');
  const whatif = page.locator('#dashboard .db-whatif');
  await whatif.locator('#db-runs').fill('2');
  await whatif.locator('#db-minutes').fill('240');
  await whatif.locator('#db-start').click();
  await page.waitForFunction(() => document.getElementById('db-progress')?.textContent === 'Replications complete.', null, {timeout: 60000});
  const pending = page.waitForEvent('download');
  await page.locator('#dashboard [data-csv]').click();
  const saved = path.join(dir, 'hostile-dashboard.csv');
  await (await pending).saveAs(saved);
  const rows = parseCsv(fs.readFileSync(saved, 'utf8'));
  assert.deepEqual(rows[0], ['Dashboard', def.name, 'minute ' + (await query(page)).snapshot.minute], 'the name is one quoted cell');
  const cells = new Set(rows.flat().map(c => c.replace(/^'/, '')));
  for (const r of def.resources) assert(cells.has(r.name), 'pool ' + r.id + ' is one cell');
  assert.deepEqual(formulas(rows), [], 'no cell starts a spreadsheet formula');
  assert.equal(await live(), before, 'the dashboard, What-if and the export never tick');
  await clean('What-if and CSV');
 });

 await check('The Dashboard of the hostile journey renders its journey sections and every step focus as text', async () => {
  await importDefinition(journey);
  await runToEnd();
  const before = await live();
  await page.locator('#mode-dashboard').click();
  await page.locator('#dashboard [data-section="journey"]').waitFor();
  for (const s of journey.steps) {
   await select(s.id);
   await page.locator('#dashboard [data-section="focus"]').waitFor();
   assert.equal(await textOf(page, '#db-s-focus'), 'Step focus: ' + norm(s.name), s.id + ' focus heading');
  }
  await page.keyboard.press('Escape');
  assert.equal(await live(), before, 'the journey dashboard never ticks');
  await clean('journey Dashboard');
 });
}
