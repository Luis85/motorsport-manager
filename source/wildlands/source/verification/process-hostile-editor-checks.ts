/// <reference path="../process-contracts.d.ts" />
/**
 * Editor checks of the process-hostile-editors-browser suite (ENG-16), called from `process-hostile-editors-browser.ts`: the step
 * editor for every hostile step, the Definition editor with a pasted hostile draft (one with a diagnostic that quotes hostile text,
 * then a valid one applied) and the Add step and New process dialogs with hostile names. Each asserts that the text is shown as
 * text or as a control value, that nothing ticked and that the probe saw nothing run.
 */
import assert from 'node:assert/strict';
import type {Page} from 'playwright';
import {query, type Studio} from './process-browser-fixture';
import {norm, type Kit} from './process-hostile-kit';

const textOf = async (page: Page, selector: string) => norm(await page.locator(selector).first().evaluate(e => e.textContent ?? ''));
/** A text input's value: the parser turns a carriage return into a line feed and a one-line input drops line feeds. */
const oneLine = (text: string) => text.replace(/[\r\n]/g, '');

export async function editorChecks(studio: Studio, kit: Kit): Promise<void> {
 const {page, check, openDef, closeDef, applyDef, pasteDraft, inSync, defOf} = studio;
 const {process: def, clean, live, importDefinition, select} = kit;

 await check('The step editor shows every hostile step in every section as control values and text without ticking', async () => {
  await importDefinition(def);
  const before = await live();
  for (const s of def.steps) {
   await select(s.id);
   await page.locator('#edit-step').click();
   await page.locator('#se-name').waitFor();
   assert.equal(await page.locator('#se-name').inputValue(), oneLine(s.name), s.id + ' name');
   const body = await textOf(page, 'dialog.pd-dialog[open]');
   for (const f of def.flows.filter(x => x.from === s.id && x.label)) {
    const labels = await page.locator('dialog.pd-dialog[open] input').evaluateAll(i => i.map(x => (x as HTMLInputElement).value));
    assert(labels.includes(oneLine(f.label!)), `${s.id} path label ${f.id} is a control value`);
   }
   if (s.technology) {
    const values = await page.locator('dialog.pd-dialog[open] input').evaluateAll(i => i.map(x => (x as HTMLInputElement).value));
    assert(values.includes(oneLine(s.technology)), s.id + ' technology is a control value');
   }
   assert(body.length > 0);
   await page.locator('#se-close').click();
   await page.locator('dialog.pd-dialog[open]').waitFor({state: 'hidden'});
  }
  assert.equal(await live(), before, 'the step editor never ticks');
  await clean('step editor');
 });

 await check('The Definition editor shows a pasted hostile draft in Tune values, its diff and its diagnostics as text and applies it', async () => {
  await studio.freshStudio();
  await openDef();
  const broken = structuredClone(def);
  broken.steps.find(s => s.id === 'pack')!.needs!.push({field: 'tier', op: 'eq', value: def.arrivals[0]!.data.note!, label: 'tier'});
  await pasteDraft(JSON.stringify(broken, null, 2));
  await page.waitForFunction(() => (document.getElementById('diagnostics')?.textContent ?? '').includes('Needs tier'));
  assert((await textOf(page, '#diagnostics')).includes('Needs tier = ' + norm(JSON.stringify(def.arrivals[0]!.data.note))), 'the diagnostic quotes the text');
  await clean('Definition editor diagnostics');
  await pasteDraft(JSON.stringify(def, null, 2));
  await inSync();
  assert.equal(await page.locator('#tune-name').inputValue(), oneLine(def.name));
  assert.equal(await page.locator('#tune-res-0-name').inputValue(), oneLine(def.resources[0]!.name));
  assert.equal(await page.locator('#tune-track-0-label').inputValue(), oneLine(def.track![0]!.label!));
  assert.equal(await page.locator('#tune-sipoc-suppliers-0-name').inputValue(), oneLine(def.sipoc!.suppliers![0]!.name));
  const form = await textOf(page, '#de-pane-form');
  assert(form.length > 0);
  const diff = await textOf(page, '#de-diff-list');
  assert(diff.includes(norm(def.steps[1]!.name)), 'the draft diff names a changed step as text');
  await clean('Tune values and the diff');
  await applyDef();
  const applied = (await query(page)).definition;
  assert.deepEqual(applied.steps.map(s => norm(s.name)), def.steps.map(s => norm(s.name)), 'the applied names are the pasted text');
  await openDef();
  assert.equal((await defOf()).name.length > 0, true);
  await closeDef();
  await clean('Definition editor');
 });

 await check('Add step and New process show hostile names as text in Place it after, the status line, the title and the Process selector', async () => {
  await importDefinition(def);
  const name = def.steps[1]!.name;
  await page.locator('#add-step').click();
  await page.locator('#as-after').waitFor();
  const after = await page.locator('#as-after option').evaluateAll(o => o.map(x => x.textContent ?? ''));
  assert.deepEqual(after.map(norm), def.steps.map(s => norm(s.name)), 'Place it after lists the names as text');
  await page.locator('#as-after').selectOption('intake');
  await page.locator('#as-name').fill(oneLine(name));
  await page.locator('#as-add').click();
  await page.locator('dialog.pd-dialog[open]').waitFor({state: 'hidden'});
  assert((await textOf(page, '#message')).startsWith('Added'), 'the status names the added step as text');
  await clean('Add step');
  await page.locator('#export-menu').click();
  await page.locator('#new-process').click();
  await page.locator('#np-name').fill(oneLine(def.name));
  await page.locator('#np-create').click();
  await page.waitForFunction(n => (globalThis as any).LWProcessStudio.query().definition.name === n, oneLine(def.name));
  assert.equal(await textOf(page, '#process-title'), oneLine(def.name));
  assert((await page.locator('#process-switch option').evaluateAll(o => o.map(x => x.textContent ?? ''))).includes(oneLine(def.name)));
  await clean('New process');
 });
}
