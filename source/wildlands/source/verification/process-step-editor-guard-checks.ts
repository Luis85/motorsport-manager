/// <reference path="../process-contracts.d.ts" />
/**
 * Companion of process-step-editor-browser.ts (the suite over its size budget once reflowed): the shared dialog's one dirty guard
 * for Escape, Close and the backdrop, the draft store with one unapplied draft per process, and moving to the previous or next
 * step behind the same guard. Registered under the `process-step-editor-browser` suite; the suite entry calls `dialogGuardChecks`
 * after the phone sheet check and `stepNavigationChecks` after `branchingChecks`, so the check order is unchanged.
 */
import assert from 'node:assert/strict';
import {query, type Studio} from './process-browser-fixture';

/** The shared dialog's dirty guard and the per-process draft store. */
export async function dialogGuardChecks(studio: Studio): Promise<void> {
 const {page, check, freshStudio, openDef, applyDef, draftText, dialogOpen, activeId} = studio;
 await check('Shared dialog funnels Escape, Close and backdrop through one dirty guard and restores focus', async () => {
  await freshStudio(); await page.locator('[data-step="discovery"]').click(); const original = await draftText();
  assert.equal(await page.locator('#edit-step').getAttribute('aria-haspopup'), 'dialog');
  const shellInert = () => page.evaluate(() => (document.getElementById('process-shell') as HTMLElement).inert),
   locked = () => page.evaluate(() => document.documentElement.classList.contains('pd-locked'));
  const open = async () => {
   await page.locator('#edit-step').focus();
   await page.keyboard.press('Enter');
   await page.locator('dialog.pd-dialog[open]').waitFor();
  };
  const backdrop = () => page.mouse.click(4, 4), confirmShown = () => page.locator('#se-confirm').isVisible();
  await open();
  assert.equal(await shellInert(), true);
  assert.equal(await locked(), true);
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflow), 'hidden');
  await page.keyboard.press('Escape');
  assert.equal(await dialogOpen(), 0);
  assert.equal(await activeId(), 'edit-step');
  assert.equal(await shellInert(), false);
  assert.equal(await locked(), false);
  await open(); await backdrop(); assert.equal(await dialogOpen(), 0, 'a clean dialog closes on a backdrop click'); assert.equal(await activeId(), 'edit-step');
  await open(); await page.locator('#se-name').fill('Changed title');
  await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 1); assert.equal(await confirmShown(), true); assert.equal(await activeId(), 'se-keep');
  await page.keyboard.press('Escape');
  assert.equal(await confirmShown(), false);
  assert.equal(await dialogOpen(), 1);
  assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.bind), 'name');
  await page.locator('#se-close').click(); assert.equal(await confirmShown(), true); assert.equal(await activeId(), 'se-keep');
  await backdrop(); assert.equal(await confirmShown(), false, 'a backdrop click while the guard shows keeps editing'); assert.equal(await dialogOpen(), 1);
  await backdrop(); assert.equal(await confirmShown(), true, 'a backdrop click on a dirty dialog raises the same guard'); assert.equal(await dialogOpen(), 1);
  await page.locator('#se-discard').click();
  assert.equal(await dialogOpen(), 0);
  assert.equal(await activeId(), 'edit-step');
  assert.equal(await draftText(), original);
  // The invoker may be hidden by the time the dialog closes; focus then falls back to the step list item. Only one modal may be open.
  await open(); await page.evaluate(() => { (document.getElementById('edit-step') as HTMLElement).hidden = true; });
  const stacked = await page.evaluate(() => {
   const D = (globalThis as any).LWProcessDialog,
    second = D.create(document.body, {id: 'x', size: 'list', title: 'Second', actions: [], onAction() {}}),
    blocked = second.open() === false,
    active = D.active() !== null;
   second.dispose();
   return {blocked, active};
  });
  assert.deepEqual(stacked, {blocked: true, active: true}); await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 0);
  assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.step), 'discovery');
  await page.evaluate(() => { (document.getElementById('edit-step') as HTMLElement).hidden = false; });
  const sizes = await page.evaluate(() => {
   const D = (globalThis as any).LWProcessDialog,
    make = (id: string, size: string, extra: object = {}) =>
     D.create(document.body, {id, size, title: 'Probe ' + id, actions: [{id: 'ok', label: 'OK'}], onAction() {}, ...extra}),
    out: Record<string, unknown> = {};
   const form = make('f', 'form'); form.open(); out.form = form.el.getBoundingClientRect().width; form.close(); form.dispose();
   const wide = make('w', 'wide'); wide.body.insertAdjacentHTML('beforeend', '<div class="pd-split"><p>a</p><p>b</p></div>'); wide.open();
   out.wide = wide.el.getBoundingClientRect().width;
   out.columns = getComputedStyle(wide.body.querySelector('.pd-split')!).gridTemplateColumns.split(' ').length;
   wide.close();
   wide.dispose();
   const list = make('l', 'list'); list.open(); out.list = list.el.getBoundingClientRect().width; list.close(); list.dispose();
   const ro = make('r', 'form', {readOnly: true}); ro.open(); out.readOnlyFocus = document.activeElement?.id; ro.close(); ro.dispose(); return out;
  });
  assert.equal(sizes.form, 760);
  assert.equal(sizes.wide, 1000);
  assert.equal(sizes.columns, 2);
  assert.equal(sizes.list, 640);
  assert.equal(sizes.readOnlyFocus, 'r-title');
 });
 await check('Draft store keeps one unapplied draft per process and reports the diff for Save to draft', async () => {
  await freshStudio();
  const pure = await page.evaluate(() => {
   const w = globalThis as any,
    store = w.LWProcessDraft.create(),
    def = JSON.parse(JSON.stringify(w.LWProcessStudio.definition())),
    other = JSON.parse(JSON.stringify(w.LWProcessStudio.definitions()[1])),
    events: string[] = [];
   store.enter(0, def); store.subscribe((e: {source: string}) => events.push(e.source));
   const next = JSON.parse(JSON.stringify(def));
   next.steps[1].name += ' a';
   next.steps[2].name += ' b';
   next.steps[3].name += ' c';
   next.resources[0].capacity += 1;
   store.write(JSON.stringify(next, null, 2), 'definition'); store.write(JSON.stringify(next, null, 2), 'definition');
   const out: Record<string, unknown> = {
    events: events.slice(),
    summary: store.describeDiff(),
    ignoring: store.diff({ignoreStep: def.steps[1].id}).steps,
    names: store.diff().changedSteps.map((s: {name: string}) => s.name).length
   };
   store.leave();
   store.enter(1, other);
   out.otherClean = !store.changed() && store.describeDiff() === '';
   store.enter(0, def);
   out.restored = store.read() === JSON.stringify(next, null, 2) && store.changed();
   store.write('{"unfinished":', 'raw'); out.invalid = store.diff().invalid; out.invalidText = store.describeDiff(); out.parsed = store.parse() === undefined;
   store.restore();
   out.reset = !store.changed() && store.describeDiff() === '';
   store.write(JSON.stringify(next), 'definition');
   store.enter(0, next);
   out.applied = !store.changed();
   return out;
  });
  assert.deepEqual(pure.events, ['definition']);
  assert.equal(pure.summary, 'Unapplied draft: 3 steps, 1 resource changed');
  assert.equal(pure.ignoring, 2);
  assert.equal(pure.names, 3);
  assert.equal(pure.otherClean, true);
  assert.equal(pure.restored, true);
  assert.equal(pure.invalid, true);
  assert.equal(pure.invalidText, 'Unapplied draft: not valid process JSON yet');
  assert.equal(pure.parsed, true);
  assert.equal(pure.reset, true);
  assert.equal(pure.applied, true);
  const unapplied = (n: string) => `Unapplied draft \u00b7 ${n}`,
   chip = () => page.locator('#draft-chip').innerText(),
   clean = () => page.locator('#draft-chip').isHidden();
  await page.locator('[data-step="discovery"]').click();
  await page.locator('#edit-step').click();
  await page.locator('#se-name').fill('Discovery workshop');
  await page.locator('#se-save').click();
  assert.equal(await chip(), unapplied('1 step changed')); assert.match(await draftText(), /Discovery workshop/);
  await page.locator('#process-switch').selectOption('1');
  await page.waitForFunction(() => (globalThis as unknown as {LWProcessStudio: {query(): {active: number}}}).LWProcessStudio.query().active === 1);
  assert.equal(await clean(), true); assert.doesNotMatch(await draftText(), /Discovery workshop/);
  const work = (await query(page)).definition.steps.find(s => s.kind === 'task')!;
  await page.locator(`[data-step="${work.id}"]`).click();
  await page.locator('#edit-step').click();
  await page.locator('#se-name').fill('Vendor edit');
  await page.locator('#se-save').click();
  assert.equal(await chip(), unapplied('1 step changed')); assert.match(await draftText(), /Vendor edit/);
  await page.locator('#process-switch').selectOption('0');
  await page.waitForFunction(() => (globalThis as unknown as {LWProcessStudio: {query(): {active: number}}}).LWProcessStudio.query().active === 0);
  assert.equal(await chip(), unapplied('1 step changed'));
  assert.match(await draftText(), /Discovery workshop/);
  assert.doesNotMatch(await draftText(), /Vendor edit/);
  await page.locator('#process-switch').selectOption('1');
  await page.waitForFunction(() => (globalThis as unknown as {LWProcessStudio: {query(): {active: number}}}).LWProcessStudio.query().active === 1);
  assert.match(await draftText(), /Vendor edit/); await openDef(); await applyDef();
  assert.equal(await clean(), true); assert.equal((await query(page)).definition.steps.find(s => s.id === work.id)!.name, 'Vendor edit');
  await page.locator('#process-switch').selectOption('0');
  await page.waitForFunction(() => (globalThis as unknown as {LWProcessStudio: {query(): {active: number}}}).LWProcessStudio.query().active === 0);
  assert.equal(await chip(), unapplied('1 step changed'));
 });
}

/** Previous and next step behind the same dirty guard. */
export async function stepNavigationChecks(studio: Studio): Promise<void> {
 const {page, check, freshStudio, openDef, closeDef, restoreDef, draftText, dialogOpen, activeId} = studio;
 await check('Step editor moves to the previous or next step behind the same dirty guard', async () => {
  await freshStudio();
  const original = await draftText();
  await page.locator('[data-step="discovery"]').click();
  await page.locator('#edit-step').click();
  await page.locator('#se-name').waitFor();
  const prev = page.locator('#se-step-prev'), next = page.locator('#se-step-next');
  assert.equal(await prev.innerText(), 'Previous step: Project intake'); assert.equal(await next.innerText(), 'Next step: Plan together');
  await next.click();
  assert.equal(await page.locator('#se-title').innerText(), 'Plan together');
  assert.equal(await page.locator('#se-chip').innerText(), 'fork');
  assert.equal(await activeId(), 'se-step-next', 'focus stays on Next for the following step'); await prev.click(); await prev.click();
  assert.equal(await page.locator('#se-title').innerText(), 'Project intake');
  assert.equal(await prev.isDisabled(), true);
  assert.equal(await prev.getAttribute('aria-describedby'), 'se-step-prev-why');
  assert.equal(await page.locator('#se-step-prev-why').innerText(), 'This is the first step.'); assert.equal(await activeId(), 'se-step-next');
  // Unsaved edits ask first: Keep editing is the default, Save to draft and go keeps them, Discard changes drops them.
  await next.click(); await page.locator('#se-name').fill('Discovery workshop'); await next.click();
  assert.equal(await page.locator('#se-confirm-title').innerText(), 'Go to Plan together? Your changes to Discovery workshop are not in the draft yet.');
  assert.deepEqual(await page.locator('#se-choices button').allInnerTexts(), ['Keep editing', 'Save to draft and go', 'Discard changes']);
  assert.equal(await activeId(), 'se-keep');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#se-title').innerText(), 'Discovery');
  assert.equal(await page.locator('#se-name').inputValue(), 'Discovery workshop');
  await next.click();
  await page.locator('#se-save-go').click();
  assert.equal(await page.locator('#se-title').innerText(), 'Plan together');
  assert.match(await draftText(), /"name": "Discovery workshop"/);
  await prev.click(); assert.equal(await page.locator('#se-name').inputValue(), 'Discovery workshop'); await page.locator('#se-name').fill('Dropped rename');
  await prev.click();
  await page.locator('#se-discard').click();
  assert.equal(await page.locator('#se-title').innerText(), 'Project intake');
  assert.doesNotMatch(await draftText(), /Dropped rename/);
  // With local problems the edits cannot be saved, so only Keep editing and Discard changes are offered.
  await next.click(); await page.locator('#se-add-set').click(); await next.click();
  assert.deepEqual(await page.locator('#se-choices button').allInnerTexts(), ['Keep editing', 'Discard changes']); await page.locator('#se-discard').click();
  for (let i = 0; i < 9; i++) await next.click();
  assert.equal(await page.locator('#se-title').innerText(), 'Delivered');
  assert.equal(await next.isDisabled(), true);
  assert.equal(await page.locator('#se-step-next-why').innerText(), 'This is the last step.');
  await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 0); assert.equal(await activeId(), 'edit-step');
  await openDef(); await restoreDef(); assert.equal(await draftText(), original); await closeDef();
 });
}
