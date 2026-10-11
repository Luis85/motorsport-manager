/// <reference path="../process-contracts.d.ts" />
/**
 * Companion checks of the process-step-editor-browser suite (owner: the authoring package): structural step editing from the step
 * editor and the Definition editor, the step editor's form undo, Back to <step>, Export report first in the apply-over-run confirm
 * and the compact phone sheet chrome. The suite entry calls `structureChecks(studio)`; every check name is registered for that suite.
 */
import assert from 'node:assert/strict';
import {nextFrames} from './browser-harness';
import {query, type Studio} from './process-browser-fixture';

export async function structureChecks(studio: Studio): Promise<void> {
 const {page, check, freshStudio, draftText, defOf, dialogOpen, activeId} = studio;
 const open = async (id: string) => {
  await page.locator(`[data-step="${id}"]`).click();
  await page.locator('#edit-step').click();
  await page.locator('#se-name').waitFor();
 };
 const title = () => page.locator('#se-title').innerText();
 const choices = () => page.locator('#se-choices button').allInnerTexts();
 const closed = () => page.waitForFunction(() => document.querySelectorAll('dialog.pd-dialog[open]').length === 0);
 const stepOf = async (id: string) => (await defOf()).steps.find(s => s.id === id);
 const flowOf = async (id: string) => (await defOf()).flows.find(f => f.id === id);

 await check('Step editor adds a step after this one and duplicates it, opening each new step and writing only the draft', async () => {
  await freshStudio();
  await page.locator('#advance').click();
  const before = await query(page), original = await draftText();
  await open('discovery');
  assert.equal(await page.locator('#se-h-structure').innerText(), 'Step structure');
  await page.locator('#se-structure-add-open').click();
  assert.equal(await activeId(), 'se-structure-kind');
  assert.equal(await page.locator('#se-structure-add-open').getAttribute('aria-expanded'), 'true');
  assert.match(await page.locator('#se-structure-add-form').innerText(), /Insert it between Discovery and Plan together/);
  await page.locator('#se-structure-kind').selectOption('timer');
  assert.equal(await page.locator('#se-structure-name').getAttribute('placeholder'), 'New timer');
  await page.locator('#se-structure-name').fill('Cool down');
  await page.locator('#se-structure-add').click();
  assert.equal(await title(), 'Cool down');
  assert.equal(await page.locator('#se-chip').innerText(), 'timer');
  assert.equal(await page.locator('#se-meta').innerText(), 'cool-down');
  assert.equal(await activeId(), 'se-name', 'the new step opens with focus on its name');
  assert.equal(await page.locator('#se-footnote').innerText(),
   'Added step Cool down. Inserted Cool down between Discovery and Plan together. Undo it in the Definition editor.');
  const added = await defOf();
  assert.deepEqual(added.steps.slice(1, 4).map(s => s.id), ['discovery', 'cool-down', 'design-split'], 'placed after Discovery in draft order');
  assert.deepEqual(added.steps[2]!.scene, {id: 'scene-cool-down', position: [28, 10], color: '#91b9d5'});
  assert.equal((await flowOf('discovery-design-split'))!.to, 'cool-down');
  assert.deepEqual(await flowOf('cool-down-design-split'), {id: 'cool-down-design-split', from: 'cool-down', to: 'design-split'});
  await page.locator('#se-structure-duplicate').click();
  assert.equal(await title(), 'Cool down (copy)');
  assert.equal(await page.locator('#se-meta').innerText(), 'cool-down-copy');
  assert.match(await page.locator('#se-footnote').innerText(), /^Duplicated Cool down\. The copy has no paths yet/);
  assert.equal((await stepOf('cool-down-copy'))!.duration, 60);
  // Nothing was applied: the run keeps its definition and its minute.
  const after = await query(page);
  assert.deepEqual(after.definition, before.definition);
  assert.equal(after.snapshot.minute, 30);
  // Both writes carry history labels, so the Definition editor undoes them one at a time.
  await page.keyboard.press('Escape');
  await closed();
  await page.locator('#open-definition').click();
  await page.locator('dialog.de-dialog[open]').waitFor();
  await page.keyboard.press('ControlOrMeta+z');
  assert.equal(await stepOf('cool-down-copy'), undefined);
  assert.ok(await stepOf('cool-down'));
  await page.keyboard.press('ControlOrMeta+z');
  assert.equal(await draftText(), original);
  await page.locator('#de-cancel').click();
 });

 await check('Step editor changes a step kind and deletes a step behind Cancel-first confirms that name what is dropped and offer to reconnect', async () => {
  await freshStudio();
  await open('qa');
  await page.locator('#se-structure-kind-open').click();
  assert.equal(await activeId(), 'se-structure-newkind');
  await page.locator('#se-structure-newkind').selectOption('timer');
  assert.equal(await page.locator('#se-structure-drops').innerText(), 'Changing to a timer drops resource demands.');
  await page.locator('#se-structure-change').click();
  assert.equal(await page.locator('#se-confirm-title').innerText(), 'Change Quality review to a timer? These are dropped: resource demands.');
  assert.deepEqual(await choices(), ['Cancel', 'Change kind']);
  assert.equal(await activeId(), 'se-kind-keep', 'the confirm starts on Cancel');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#se-confirm').isHidden(), true);
  assert.equal((await stepOf('qa'))!.kind, 'task', 'Escape cancels');
  await page.locator('#se-structure-change').click();
  await page.locator('#se-kind-go').click();
  assert.equal(await page.locator('#se-chip').innerText(), 'timer');
  assert.equal(await activeId(), 'se-structure-kind-open');
  const timer = (await stepOf('qa'))!;
  assert.deepEqual([timer.kind, timer.resources, timer.duration], ['timer', undefined, 10]);
  assert.match(await page.locator('#se-footnote').innerText(), /^Changed Quality review to a timer\. Dropped resource demands\./);
  // Delete names the paths and offers to reconnect the predecessors to the single target, checked.
  await page.locator('#se-structure-delete').click();
  assert.equal(await page.locator('#se-confirm-title').innerText(),
   'Delete Quality review? This removes the step and its 3 paths (from Implementation, from Resolve findings, to Accepted?).');
  assert.deepEqual(await choices(), ['Cancel', 'Delete step']);
  assert.equal(await activeId(), 'se-delete-keep');
  assert.equal(await page.locator('#se-confirm-check').isChecked(), true);
  assert.equal(await page.locator('#se-confirm label').innerText(), 'Reconnect Implementation, Resolve findings to Accepted?');
  await page.locator('#se-delete-keep').click();
  assert.equal(await dialogOpen(), 1);
  assert.ok(await stepOf('qa'), 'Cancel keeps the step');
  await page.locator('#se-structure-delete').click();
  await page.locator('#se-delete-go').click();
  await closed();
  const deleted = /^Deleted step Quality review from the draft\. Reconnected Implementation, Resolve findings to Accepted\?\./;
  assert.match(await page.locator('#message').innerText(), deleted);
  assert.equal(await stepOf('qa'), undefined);
  assert.deepEqual([(await flowOf('implementation-qa'))!.to, (await flowOf('rework-qa'))!.to], ['review-gate', 'review-gate']);
  // The start step cannot be duplicated, changed or deleted, and says why.
  await open('intake');
  for (const id of ['se-structure-duplicate', 'se-structure-kind-open', 'se-structure-delete']) {
   assert.equal(await page.locator('#' + id).isDisabled(), true, id);
   assert.equal(await page.locator('#' + id).getAttribute('aria-describedby'), 'se-structure-why');
  }
  const why = 'The start step cannot be duplicated, deleted or changed: every process needs exactly one.';
  assert.equal(await page.locator('#se-structure-why').innerText(), why);
  await page.keyboard.press('Escape');
 });

 await check('Step editor structure actions respect the dirty guard of unsaved field edits', async () => {
  await freshStudio();
  await open('discovery');
  await page.locator('#se-name').fill('Discovery workshop');
  await page.locator('#se-structure-add-open').click();
  await page.locator('#se-structure-name').fill('Estimate');
  await page.locator('#se-structure-add').click();
  assert.equal(await page.locator('#se-confirm-title').innerText(), 'Add the step? Your changes to Discovery workshop are not in the draft yet.');
  assert.deepEqual(await choices(), ['Keep editing', 'Save to draft and add', 'Discard changes']);
  assert.equal(await activeId(), 'se-keep');
  await page.locator('#se-keep').click();
  assert.equal(await page.locator('#se-name').inputValue(), 'Discovery workshop');
  assert.equal(await stepOf('estimate'), undefined, 'Keep editing adds nothing');
  await page.locator('#se-structure-add').click();
  await page.locator('#se-save-structure').click();
  assert.equal(await title(), 'Estimate');
  assert.equal((await stepOf('discovery'))!.name, 'Discovery workshop', 'the edits were saved first');
  assert.equal((await stepOf('estimate'))!.duration, 5);
  // Deleting the open step drops its unsaved edits with it, and says so.
  await page.locator('#se-name').fill('Estimate twice');
  await page.locator('#se-structure-delete').click();
  assert.match(await page.locator('#se-confirm-title').innerText(), /Your unsaved changes to it are discarded too\.$/);
  await page.locator('#se-delete-go').click();
  await closed();
  assert.equal(await stepOf('estimate'), undefined);
  assert.equal((await flowOf('discovery-design-split'))!.to, 'design-split', 'the reconnect restores the original path');
 });

 await check('Step editor undoes and redoes form edits outside text fields and offers Undo for a removed row', async () => {
  await freshStudio();
  await open('discovery');
  await page.locator('#se-add-need').click();
  await page.locator('[data-bind="needs.0.field"]').fill('scope');
  await page.locator('#se-add-need').focus();
  await page.keyboard.press('ControlOrMeta+z');
  assert.equal(await page.locator('[data-bind="needs.0.field"]').inputValue(), '', 'typing in one field is one step');
  assert.equal(await page.locator('#se-footnote').innerText(), 'Undone. Ctrl+Shift+Z (Cmd+Shift+Z on a Mac) redoes it.');
  await page.keyboard.press('ControlOrMeta+z');
  assert.equal(await page.locator('[data-bind="needs.0.field"]').count(), 0, 'then the added row goes');
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await page.keyboard.press('Control+y');
  assert.equal(await page.locator('[data-bind="needs.0.field"]').inputValue(), 'scope');
  await page.keyboard.press('Control+y');
  assert.equal(await page.locator('#se-footnote').innerText(), 'Nothing to redo.');
  // A removed row offers Undo, which restores it and moves focus to it.
  await page.locator('[data-act="remove-need"][data-i="0"]').click();
  assert.equal(await page.locator('#se-footnote').innerText(), 'Removed need 1 scope. Undo');
  await page.locator('#se-undo').click();
  assert.equal(await page.locator('[data-bind="needs.0.field"]').inputValue(), 'scope');
  assert.equal(await activeId(), 'se-needs-0-field');
  assert.equal(await page.locator('#se-footnote').innerText(), 'Undone. Removed need 1 scope. Ctrl+Shift+Z (Cmd+Shift+Z on a Mac) redoes it.');
  // A checkbox change is one step; text fields keep the browser's own undo, so the form history is not touched there.
  await page.locator('#se-backlog-on').check();
  await page.keyboard.press('ControlOrMeta+z');
  assert.equal(await page.locator('#se-backlog-on').isChecked(), false);
  await page.locator('#se-cost').focus();
  await page.keyboard.press('ControlOrMeta+z');
  assert.equal(await page.locator('[data-bind="needs.0.field"]').inputValue(), 'scope', 'Ctrl+Z in a text field leaves the form history alone');
  // The history lives only while the dialog shows this step.
  await page.locator('#se-cancel').click();
  await page.locator('#se-discard').click();
  await open('discovery');
  await page.locator('#se-add-need').focus();
  await page.keyboard.press('ControlOrMeta+z');
  assert.equal(await page.locator('#se-footnote').innerText(), 'Nothing to undo.');
  await page.keyboard.press('Escape');
 });

 await check('Apply over a run offers Export report first, which exports and keeps the run on the same Back-first confirm', async () => {
  await freshStudio();
  await page.locator('#advance').click();
  await open('discovery');
  await page.locator('#se-duration').fill('20');
  await page.locator('#se-apply').click();
  assert.deepEqual(await choices(), ['Back', 'Export report first', 'Apply and reset']);
  assert.equal(await activeId(), 'se-back');
  const pending = page.waitForEvent('download');
  await page.locator('#se-export-report').click();
  const download = await pending;
  assert.equal(download.suggestedFilename(), 'agency-delivery.report.json');
  assert.equal(await page.locator('#se-confirm').isVisible(), true, 'the confirm stays open');
  assert.equal(await activeId(), 'se-back', 'and starts on Back again');
  assert.match(await page.locator('#se-confirm-title').innerText(), /^Run report exported\. Applying starts a fresh paused run and discards minute 30 /);
  assert.equal((await query(page)).snapshot.minute, 30, 'exporting keeps the run');
  await page.locator('#se-back').click();
  assert.equal(await page.locator('#se-confirm').isHidden(), true);
  assert.equal((await query(page)).snapshot.minute, 30, 'Back cancels');
  await page.locator('#se-apply').click();
  await page.locator('#se-apply-reset').click();
  await closed();
  const applied = await query(page);
  assert.equal(applied.snapshot.minute, 0);
  assert.equal(applied.definition.steps.find(s => s.id === 'discovery')!.duration, 20);
  // The Definition editor's apply confirm offers the same choice.
  await page.locator('#advance').click();
  await page.locator('#open-definition').click();
  await page.locator('#tune-name').fill('Renamed over a run');
  await page.locator('#de-apply').click();
  assert.deepEqual(await page.locator('#de-choices button').allInnerTexts(), ['Back', 'Export report first', 'Apply and reset']);
  assert.equal(await activeId(), 'de-back');
  await page.locator('#de-back').click();
  await page.locator('#de-cancel').click();
 });

 await check('Definition editor adds a step and tidies the layout from Tune values, each undoable and never applied', async () => {
  await freshStudio();
  const original = await draftText(), before = await query(page);
  await page.locator('#open-definition').click();
  await page.locator('dialog.de-dialog[open]').waitFor();
  assert.equal(await page.locator('#de-back-bar').isHidden(), true, 'Back to a step appears only after a handoff');
  await page.locator('#de-add-kind').selectOption('task');
  await page.locator('#de-add-name').fill('Estimate');
  await page.locator('#de-add-after').selectOption('discovery');
  await page.locator('#de-add-step').click();
  assert.equal(await page.locator('#de-message').innerText(), 'Added step Estimate. Undo Inserted Estimate between Discovery and Plan together.');
  assert.equal((await flowOf('discovery-design-split'))!.to, 'estimate');
  assert.deepEqual((await query(page)).definition, before.definition, 'adding never applies');
  const added = await draftText();
  await page.locator('#de-tidy').click();
  assert.match(await page.locator('#de-message').innerText(), /^Tidied the layout\. Undo \d+ steps moved\.$/);
  const tidy = await defOf(), x = (id: string) => tidy.steps.find(s => s.id === id)!.scene.position[0];
  assert.ok(x('intake') < x('discovery') && x('discovery') < x('estimate') && x('estimate') < x('design-split'), 'the main route reads left to right');
  const cells = tidy.steps.map(s => s.scene.position.join(','));
  assert.equal(new Set(cells).size, cells.length, 'one step per cell');
  await page.locator('#de-tidy').click();
  assert.equal(await page.locator('#de-message').innerText(), 'The layout is already tidy: no step moved.');
  await page.keyboard.press('ControlOrMeta+z');
  assert.equal(await draftText(), added, 'Undo restores the positions');
  await page.keyboard.press('ControlOrMeta+z');
  assert.equal(await draftText(), original);
  await page.locator('#de-cancel').click();
 });

 await check('Definition editor opened from the step editor offers Back to the step, which reopens the step editor on it', async () => {
  await freshStudio();
  // A problem elsewhere in the draft (a handover duration of 0, saved from the step editor) offers Open the Definition editor.
  await open('handover');
  await page.locator('#se-duration').fill('0');
  await page.locator('#se-save').click();
  await closed();
  await open('discovery');
  await page.locator('#se-name').fill('Discovery workshop');
  await page.locator('[data-act="open-definition"]').click();
  await page.locator('#se-save-open').click();
  await page.locator('dialog.de-dialog[open]').waitFor();
  assert.equal(await page.locator('#de-back-step').innerText(), 'Back to Discovery workshop');
  await page.locator('#de-back-step').click();
  await page.locator('dialog.pd-dialog[open] #se-name').waitFor();
  assert.equal(await dialogOpen(), 1);
  assert.equal(await title(), 'Discovery workshop');
  assert.equal(await activeId(), 'se-name', 'focus is on the step editor’s first field');
  await page.keyboard.press('Escape');
  await closed();
  assert.equal(await activeId(), 'edit-step');
 });

 await check('Step editor and Definition editor sheet chrome stays within about 30% of a 390 by 844 phone screen without overflow', async () => {
  await freshStudio();
  await page.setViewportSize({width: 390, height: 844});
  await nextFrames(page);
  const measure = () => page.evaluate(() => {
   const d = document.querySelector('dialog.pd-dialog[open]') as HTMLElement, r = d.getBoundingClientRect();
   const height = (selector: string) => {
    const n = d.querySelector<HTMLElement>(selector);
    return n && !n.hidden ? n.getBoundingClientRect().height : 0;
   };
   const buttons = [...d.querySelectorAll<HTMLElement>('.pd-buttons button')].map(b => b.getBoundingClientRect());
   const wide = [...d.querySelectorAll<HTMLElement>('button, input, select, textarea')].filter(n => n.getClientRects().length > 0)
    .filter(n => n.getBoundingClientRect().right > r.right + 0.5 || n.getBoundingClientRect().left < r.left - 0.5).map(n => n.id || n.textContent);
   return {chrome: height('.pd-head') + height('.pd-foot') + height('.pd-banner'), vh: innerHeight, rows: new Set(buttons.map(b => Math.round(b.top))).size,
    bottom: Math.max(...buttons.map(b => b.bottom)), overflow: document.documentElement.scrollWidth > innerWidth || d.scrollWidth > d.clientWidth, wide,
    small: buttons.filter(b => b.height < 43.5).length, subtitle: parseFloat(getComputedStyle(d.querySelector('.pd-subtitle')!).fontSize)};
  });
  // Hosted CI has no Inter and renders in the wider DejaVu Sans, so the same limits are checked in both fonts.
  for (const fallback of [false, true]) {
   if (fallback) await page.addStyleTag({content: '*{font-family:"DejaVu Sans" !important}'})
    .then(h => h.evaluate(n => {(n as HTMLElement).id = 'dejavu-probe';}));
   await open('discovery');
   const step = await measure();
   assert.ok(step.chrome <= step.vh * 0.3, JSON.stringify(step));
   assert.deepEqual([step.overflow, step.wide, step.small, step.rows], [false, [], 0, 1], 'the three footer buttons share one row');
   assert.ok(step.bottom <= step.vh && step.subtitle >= 12, JSON.stringify(step));
   await page.keyboard.press('Escape');
   await page.locator('#open-definition').click();
   await page.locator('dialog.de-dialog[open]').waitFor();
   const definition = await measure();
   assert.ok(definition.chrome <= definition.vh * 0.3, JSON.stringify(definition));
   assert.deepEqual([definition.overflow, definition.wide, definition.small, definition.rows], [false, [], 0, 2], 'secondary actions share one row');
   assert.ok(definition.bottom <= definition.vh, JSON.stringify(definition));
   // The primary action keeps its own full row at the bottom of the sticky footer.
   const apply = (await page.locator('#de-apply').boundingBox())!;
   assert.ok(apply.width >= 390 - 32 - 1 && Math.round(apply.y + apply.height) <= 844);
   await page.keyboard.press('Escape');
  }
  await page.evaluate(() => document.getElementById('dejavu-probe')?.remove());
 });
}
