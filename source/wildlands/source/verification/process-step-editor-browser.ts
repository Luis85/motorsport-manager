/// <reference path="../process-contracts.d.ts" />
/** Process Studio step editor: the shared modal, sections, diagnostics, random timing, branching, instances, deadlines and the draft store. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {nextFrames} from './browser-harness';
import {query, OUT, runSuite} from './process-browser-fixture';
import {autoLine} from './process-browser-models';
runSuite('process step editor browser harness', 'process-step-editor-browser-results.json', async studio => {
 const {page, diagnostics, check, checkLifecycle, freshStudio, openDef, closeDef, restoreDef, applyDef, showIo, draftText, defOf, dialogOpen, activeId, importRandom, openRandom, savedStep, importClaims} = studio;
 const dlgText = () => page.locator('dialog.pd-dialog[open]').innerText();
 const catalogOk = (text: string) => page.evaluate(t => (globalThis as unknown as {LWProcessCatalog: LWProcess.Catalog}).LWProcessCatalog.validate(JSON.parse(t)).ok, text);
 const discard = async () => { await page.locator('#se-cancel').click(); const confirm = page.locator('#se-discard'); if (await confirm.count()) await confirm.click(); await page.waitForFunction(() => document.querySelectorAll('dialog.pd-dialog[open]').length === 0); };
 await check('Step editor opens as a modal from the inspector, traps focus, closes with Escape and restores the invoker focus', async () => {
  await freshStudio(); await page.locator('[data-step="discovery"]').click();
  await page.locator('#edit-step').focus(); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', {name: 'Discovery'}); await dialog.waitFor(); assert.equal(await dialogOpen(), 1);
  assert.equal(await page.evaluate(() => document.querySelector('dialog.pd-dialog[open]')!.matches(':modal')), true);
  assert.equal(await page.locator('#se-title').innerText(), 'Discovery'); assert.equal(await page.locator('#se-chip').innerText(), 'task'); assert.equal(await page.locator('#se-meta').innerText(), 'discovery');
  assert.equal(await activeId(), 'se-name'); assert.equal((await query(page)).selected, 'discovery');
  assert.equal(await page.locator('#se-apply').isDisabled(), true, 'an unchanged step and draft have nothing to apply');
  assert.match(await page.locator('#se-reason').innerText(), /Nothing to apply: this step and the draft hold the running definition\. Use Reset run to restart the run\./);
  await assert.rejects(page.locator('#play').click({timeout: 700}), 'the page behind the modal is inert');
  for (let i = 0; i < 70; i++) { await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => !!document.activeElement?.closest('dialog.pd-dialog')), true, 'forward Tab stays inside at ' + i); }
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Shift+Tab'); assert.equal(await page.evaluate(() => !!document.activeElement?.closest('dialog.pd-dialog')), true, 'Shift+Tab stays inside'); }
  assert.equal(await page.getByRole('button', {name: 'Close'}).count(), 1);
  await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 0); assert.equal(await activeId(), 'edit-step');
  await page.locator('#edit-step').focus(); await page.keyboard.press('Enter'); await dialog.waitFor(); await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 0); assert.equal(await activeId(), 'edit-step');
  await page.locator('#edit-step').click(); await page.locator('#se-close').click(); assert.equal(await dialogOpen(), 0); assert.equal(await activeId(), 'edit-step');
  await page.locator('#overview').click(); assert.equal(await page.locator('#edit-step').isHidden(), true);
  // Opening from a running simulation pauses it and the clock stays put while the editor is open.
  await page.locator('[data-step="discovery"]').click(); await page.locator('#horizon').selectOption('1440'); await page.locator('#play').click();
  await page.waitForFunction(() => (globalThis as unknown as {LWProcessStudio: {query(): {snapshot: {minute: number}}}}).LWProcessStudio.query().snapshot.minute > 0);
  await page.locator('#edit-step').click(); await dialog.waitFor(); const frozen = await query(page); assert.equal(frozen.playing, false); await nextFrames(page, 45);
  assert.equal((await query(page)).snapshot.minute, frozen.snapshot.minute); assert.match(await page.locator('#se-subtitle').innerText(), /paused/);
  await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 0);
 });
 await check('Step editor edits timing, resources, completion effects and flow conditions and applies a fresh paused run', async () => {
  await freshStudio(); await page.locator('#advance').click(); assert.equal((await query(page)).snapshot.minute, 30); const before = await query(page);
  await page.locator('[data-step="discovery"]').click(); await page.locator('#edit-step').click();
  await page.locator('#se-name').fill('Discovery workshop'); await page.locator('#se-duration').fill('20'); await page.locator('#se-cost').fill('12');
  assert.match(await page.locator('#se-needs-summary').innerText(), /^Needs: 1 Product owner$/);
  await page.locator('dialog.pd-dialog[open]').getByLabel('Business analysts').fill('2'); assert.match(await page.locator('#se-needs-summary').innerText(), /^Needs: 1 Product owner, 2 Business analysts$/);
  await page.locator('#se-add-set').click(); await page.locator('[data-bind="set.1.key"]').fill('budgetApproved');
  await page.locator('#se-add-set').click(); await page.locator('[data-bind="set.2.key"]').fill('clientTone'); await page.locator('[data-bind="set.2.value.type"]').selectOption('text'); await page.locator('[data-bind="set.2.value.text"]').fill('calm');
  await page.locator('#se-add-add').click(); await page.locator('[data-bind="add.0.key"]').fill('attempts'); await page.locator('[data-bind="add.0.delta"]').fill('-2');
  await page.locator('#se-save').click(); assert.equal(await dialogOpen(), 0); assert.equal(await page.locator('#message').innerText(), 'Saved to the draft. Apply the draft to start a fresh run.');
  assert.deepEqual((await query(page)).definition, before.definition); assert.equal((await query(page)).snapshot.minute, 30);
  const saved = JSON.parse(await draftText()) as LWProcess.Definition, discovery = saved.steps[1]!;
  assert.equal(discovery.name, 'Discovery workshop'); assert.equal(discovery.duration, 20); assert.equal(discovery.cost, 12); assert.deepEqual(discovery.resources, {'product-owner': 1, 'business-analyst': 2});
  assert.deepEqual(discovery.set, {problemFramed: true, budgetApproved: true, clientTone: 'calm'}); assert.deepEqual(discovery.add, {attempts: -2});
  // A decision's conditions: compare with another field and save, then reopen, switch back to a value, reorder and apply. The draft also carries the discovery edits, which the modal announces.
  await page.locator('[data-step="review-gate"]').click(); await page.locator('#edit-step').click();
  assert.match(await page.locator('#se-flows-0-label').inputValue(), /Findings/); assert.equal(await page.locator('#se-flows-1-cond-on').isChecked(), false); assert.equal(await page.locator('[data-act="up"][data-i="0"]').isDisabled(), true);
  assert.match(await page.locator('dialog.pd-dialog[open]').innerText(), /Cannot move up/); assert.match(await page.locator('dialog.pd-dialog[open]').innerText(), /add a path with Add path to… or remove one/);
  await page.locator('#se-flows-0-cond-mode-field').check(); await page.locator('#se-flows-0-cond-valueField').fill('reworkLimit'); await page.locator('#se-flows-0-cond-op').selectOption('lt'); await page.locator('#se-flows-0-cond-field').fill('reworks'); await page.locator('#se-save').click();
  const gate = (JSON.parse(await draftText()) as LWProcess.Definition).flows.find(f => f.id === 'review-gate-rework')!; assert.deepEqual(gate.when, {field: 'reworks', op: 'lt', valueField: 'reworkLimit'});
  await page.locator('#edit-step').click(); assert.equal(await page.locator('#se-banner').isVisible(), true); assert.equal(await page.locator('#se-flows-0-cond-mode-field').isChecked(), true);
  await page.locator('#se-flows-0-cond-mode-value').check(); await page.locator('#se-flows-0-cond-field').fill('needsRework'); await page.locator('#se-flows-0-cond-op').selectOption('eq'); assert.equal(await page.locator('#se-flows-0-cond-value-type').inputValue(), 'true');
  await page.locator('#se-flows-0-label').fill('Findings to fix'); await page.locator('[data-act="down"][data-i="0"]').click();
  assert.equal(await page.locator('#se-flows-1-label').inputValue(), 'Findings to fix'); assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.act), 'up');
  await page.locator('#se-apply').click(); assert.equal(await page.locator('#se-confirm').isVisible(), true, 'a run past minute 0 asks before it is discarded'); await page.locator('#se-apply-reset').click(); assert.equal(await dialogOpen(), 0);
  const applied = await query(page); assert.equal(applied.snapshot.minute, 0); assert.equal(applied.playing, false); assert.equal(applied.definition.revision, before.definition.revision + 1);
  assert.equal(applied.definition.steps[1]!.name, 'Discovery workshop'); assert.equal(applied.definition.steps[1]!.duration, 20);
  const out = applied.definition.flows.filter(f => f.from === 'review-gate'); assert.deepEqual(out.map(f => f.to), ['handover', 'rework']);
  assert.deepEqual(out[1]!.when, {field: 'needsRework', op: 'eq', value: true}); assert.equal(out[1]!.label, 'Findings to fix'); assert.equal(await page.locator('#message').innerText(), 'Definition applied. New run is paused.');
  // A new revision of the same process keeps the selected step (UX-10), so Edit step stays and takes focus back.
  assert.equal((await query(page)).selected, 'review-gate'); assert.equal(await activeId(), 'edit-step', 'focus returns to the invoker of the kept step');
 });
 await check('Step editor shows engine diagnostics inline, keeps the draft on Cancel and asks before discarding changes', async () => {
  await freshStudio(); const before = await query(page), original = await draftText();
  await page.locator('[data-step="implementation"]').click(); await page.locator('#edit-step').click();
  assert.equal(await page.locator('#se-status').innerText(), '', 'no problems means no status line'); assert.equal(await page.locator('#se-duration').getAttribute('aria-invalid'), null);
  await page.locator('#se-duration').fill(''); assert.match(await page.locator('#se-err-duration').innerText(), /Task duration must be 1 or more/); assert.match(await page.locator('#se-status').innerText(), /1 problem in this step/); assert.equal(await page.locator('#se-duration').getAttribute('aria-invalid'), 'true');
  assert.equal(await page.locator('#se-apply').isDisabled(), true); assert.match(await page.locator('#se-reason').innerText(), /Fix the problems in this step before applying\./);
  assert.equal(await dialogOpen(), 1); assert.equal(await draftText(), original, 'a refused apply never writes the draft'); assert.deepEqual((await query(page)).snapshot, before.snapshot);
  // Empty fields get plain local problems named after their row; the catalog's schema text never reaches the step editor.
  await page.locator('#se-add-need').click(); assert.match(await page.locator('#se-status').innerText(), /Need 3: Name the field earlier steps must deliver, or remove this row\./);
  await page.locator('#se-status a[data-goto="se-needs-2-field"]').click(); assert.equal(await activeId(), 'se-needs-2-field'); await page.locator('[data-act="remove-need"][data-i="2"]').click();
  await page.locator('#se-name').fill(''); assert.match(await page.locator('#se-status').innerText(), /Give the step a name \(1 to 120 characters\)/);
  assert.doesNotMatch(await page.locator('#se-status').innerText(), /String has invalid/); assert.equal(await page.locator('#se-apply').isDisabled(), true);
  await page.locator('#se-status a[data-goto="se-name"]').click(); assert.equal(await activeId(), 'se-name'); await page.locator('#se-name').fill('Implementation');
  // Case-field names come with suggestions: needs from fields delivered earlier, values and counters from every known field.
  const listed = (id: string) => page.locator(`#${id} option`).evaluateAll(o => o.map(n => (n as HTMLOptionElement).value));
  assert.equal(await page.locator('#se-needs-0-field').getAttribute('list'), 'se-fields-earlier'); assert.equal(await page.locator('[data-bind="set.0.key"]').getAttribute('list'), 'se-fields-all');
  assert.deepEqual(await listed('se-fields-earlier'), ['needsRework', 'priority', 'problemFramed', 'requirementsReady', 'techReady']);
  const known = await listed('se-fields-all'); assert.ok(['built', 'verified', 'needsRework', 'problemFramed'].every(n => known.includes(n)), known.join());
  await page.locator('#se-duration').fill('25'); assert.equal(await page.locator('#se-err-duration').innerText(), '');
  await page.locator('[data-bind="set.0.key"]').fill('built'); await page.locator('[data-bind="set.0.key"]').fill('');
  assert.match(await page.locator('#se-err-set').innerText(), /Name the field or remove this row/); assert.equal(await page.locator('#se-save').isDisabled(), true); assert.match(await page.locator('#se-reason').innerText(), /Fix the highlighted fields/);
  await page.locator('[data-bind="set.0.key"]').fill('built');
  await page.locator('[data-bind="needs.0.field"]').fill('ghostField'); assert.match(await page.locator('#se-err-needs-0').innerText(), /ghostField/);
  await page.locator('[data-bind="needs.0.field"]').press('Escape'); assert.equal(await dialogOpen(), 1);
  assert.equal(await page.locator('#se-confirm').isVisible(), true); assert.equal(await page.locator('#se-confirm-title').innerText(), 'Discard your changes to Implementation?'); assert.equal(await activeId(), 'se-keep');
  await page.keyboard.press('Escape'); assert.equal(await page.locator('#se-confirm').isHidden(), true); assert.equal(await dialogOpen(), 1); assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.bind), 'needs.0.field');
  await page.locator('#se-cancel').click(); assert.equal(await activeId(), 'se-keep'); await page.locator('#se-keep').click(); assert.equal(await activeId(), 'se-cancel'); assert.equal(await page.locator('[data-bind="needs.0.field"]').inputValue(), 'ghostField');
  await page.locator('#se-save').click(); assert.equal(await dialogOpen(), 0); assert.match(await draftText(), /ghostField/);
  await page.locator('#edit-step').click(); assert.match(await page.locator('#se-err-needs-0').innerText(), /ghostField/);
  await page.locator('#se-cancel').click(); assert.equal(await dialogOpen(), 0, 'Cancel with no new edits closes at once'); assert.match(await draftText(), /ghostField/);
  await page.locator('#edit-step').click(); await page.locator('#se-name').fill('Renamed only in the modal'); await page.locator('#se-close').click();
  assert.equal(await page.locator('#se-confirm').isVisible(), true); await page.locator('#se-discard').click(); assert.equal(await dialogOpen(), 0); assert.equal(await activeId(), 'edit-step');
  assert.doesNotMatch(await draftText(), /Renamed only/); assert.match(await draftText(), /ghostField/);
  await openDef(); await restoreDef(); assert.equal(await draftText(), original); await closeDef(); assert.deepEqual((await query(page)).definition, before.definition);
 });
 await check('Step editor reflows to a full-screen sheet at phone width without horizontal overflow', async () => {
  await freshStudio(); await page.locator('#mode-2d').click(); await page.setViewportSize({width: 390, height: 844}); await nextFrames(page);
  await page.locator('[data-step="review-gate"]').click(); await page.locator('#edit-step').click(); await page.locator('dialog.pd-dialog[open]').waitFor();
  const geometry = await page.evaluate(() => {
   const d = document.querySelector('dialog.pd-dialog[open]') as HTMLElement, r = d.getBoundingClientRect(), body = d.querySelector('.pd-body') as HTMLElement, foot = d.querySelector('.pd-foot')!.getBoundingClientRect(), head = d.querySelector('.pd-head')!.getBoundingClientRect();
   const wide = [...d.querySelectorAll<HTMLElement>('input, select, textarea, button')].filter(n => n.getBoundingClientRect().right > r.right + 0.5 || n.getBoundingClientRect().left < r.left - 0.5).map(n => n.id || n.dataset.bind || n.textContent);
   return {x: r.x, y: r.y, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight, page: document.documentElement.scrollWidth > innerWidth, own: d.scrollWidth > d.clientWidth, scrolls: body.scrollHeight > body.clientHeight, footBottom: foot.bottom, headTop: head.top, wide,
    label: parseFloat(getComputedStyle(d.querySelector('label')!).fontSize), help: parseFloat(getComputedStyle(d.querySelector('.se-help')!).fontSize), input: (d.querySelector('input[type=text]') as HTMLElement).getBoundingClientRect().height};
  });
  assert.deepEqual([geometry.x, geometry.y, geometry.w, geometry.h], [0, 0, geometry.vw, geometry.vh]); assert.equal(geometry.page, false); assert.equal(geometry.own, false); assert.deepEqual(geometry.wide, []);
  assert.equal(geometry.scrolls, true); assert.equal(geometry.headTop, 0); assert.equal(Math.round(geometry.footBottom), geometry.vh); assert(geometry.label >= 13 && geometry.help >= 12 && geometry.input >= 44, JSON.stringify(geometry));
  await page.screenshot({path: path.join(OUT, 'process-step-editor-mobile.png')});
  await page.locator('#se-flows-0-label').scrollIntoViewIfNeeded(); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.keyboard.press('Escape'); await page.setViewportSize({width: 1440, height: 1060}); await nextFrames(page);
  await page.locator('#edit-step').click(); const wide = (await page.locator('dialog.pd-dialog[open]').boundingBox())!; assert(wide.width <= 760 && wide.width > 600, 'desktop dialog is a centred sheet, not full screen'); assert(wide.x > 100);
  await page.screenshot({path: path.join(OUT, 'process-step-editor-desktop.png')}); await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 0);
 });
 await check('Shared dialog funnels Escape, Close and backdrop through one dirty guard and restores focus', async () => {
  await freshStudio(); await page.locator('[data-step="discovery"]').click(); const original = await draftText();
  assert.equal(await page.locator('#edit-step').getAttribute('aria-haspopup'), 'dialog');
  const shellInert = () => page.evaluate(() => (document.getElementById('process-shell') as HTMLElement).inert), locked = () => page.evaluate(() => document.documentElement.classList.contains('pd-locked'));
  const open = async () => { await page.locator('#edit-step').focus(); await page.keyboard.press('Enter'); await page.locator('dialog.pd-dialog[open]').waitFor(); };
  const backdrop = () => page.mouse.click(4, 4), confirmShown = () => page.locator('#se-confirm').isVisible();
  await open(); assert.equal(await shellInert(), true); assert.equal(await locked(), true); assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflow), 'hidden');
  await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 0); assert.equal(await activeId(), 'edit-step'); assert.equal(await shellInert(), false); assert.equal(await locked(), false);
  await open(); await backdrop(); assert.equal(await dialogOpen(), 0, 'a clean dialog closes on a backdrop click'); assert.equal(await activeId(), 'edit-step');
  await open(); await page.locator('#se-name').fill('Changed title');
  await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 1); assert.equal(await confirmShown(), true); assert.equal(await activeId(), 'se-keep');
  await page.keyboard.press('Escape'); assert.equal(await confirmShown(), false); assert.equal(await dialogOpen(), 1); assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.bind), 'name');
  await page.locator('#se-close').click(); assert.equal(await confirmShown(), true); assert.equal(await activeId(), 'se-keep');
  await backdrop(); assert.equal(await confirmShown(), false, 'a backdrop click while the guard shows keeps editing'); assert.equal(await dialogOpen(), 1);
  await backdrop(); assert.equal(await confirmShown(), true, 'a backdrop click on a dirty dialog raises the same guard'); assert.equal(await dialogOpen(), 1);
  await page.locator('#se-discard').click(); assert.equal(await dialogOpen(), 0); assert.equal(await activeId(), 'edit-step'); assert.equal(await draftText(), original);
  // The invoker may be hidden by the time the dialog closes; focus then falls back to the step list item. Only one modal may be open.
  await open(); await page.evaluate(() => { (document.getElementById('edit-step') as HTMLElement).hidden = true; });
  const stacked = await page.evaluate(() => { const D = (globalThis as any).LWProcessDialog, second = D.create(document.body, {id: 'x', size: 'list', title: 'Second', actions: [], onAction() {}}), blocked = second.open() === false, active = D.active() !== null; second.dispose(); return {blocked, active}; });
  assert.deepEqual(stacked, {blocked: true, active: true}); await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 0);
  assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.step), 'discovery'); await page.evaluate(() => { (document.getElementById('edit-step') as HTMLElement).hidden = false; });
  const sizes = await page.evaluate(() => {
   const D = (globalThis as any).LWProcessDialog, make = (id: string, size: string, extra: object = {}) => D.create(document.body, {id, size, title: 'Probe ' + id, actions: [{id: 'ok', label: 'OK'}], onAction() {}, ...extra}), out: Record<string, unknown> = {};
   const form = make('f', 'form'); form.open(); out.form = form.el.getBoundingClientRect().width; form.close(); form.dispose();
   const wide = make('w', 'wide'); wide.body.insertAdjacentHTML('beforeend', '<div class="pd-split"><p>a</p><p>b</p></div>'); wide.open();
   out.wide = wide.el.getBoundingClientRect().width; out.columns = getComputedStyle(wide.body.querySelector('.pd-split')!).gridTemplateColumns.split(' ').length; wide.close(); wide.dispose();
   const list = make('l', 'list'); list.open(); out.list = list.el.getBoundingClientRect().width; list.close(); list.dispose();
   const ro = make('r', 'form', {readOnly: true}); ro.open(); out.readOnlyFocus = document.activeElement?.id; ro.close(); ro.dispose(); return out;
  });
  assert.equal(sizes.form, 760); assert.equal(sizes.wide, 1000); assert.equal(sizes.columns, 2); assert.equal(sizes.list, 640); assert.equal(sizes.readOnlyFocus, 'r-title');
 });
 await check('Draft store keeps one unapplied draft per process and reports the diff for Save to draft', async () => {
  await freshStudio();
  const pure = await page.evaluate(() => {
   const w = globalThis as any, store = w.LWProcessDraft.create(), def = JSON.parse(JSON.stringify(w.LWProcessStudio.definition())), other = JSON.parse(JSON.stringify(w.LWProcessStudio.definitions()[1])), events: string[] = [];
   store.enter(0, def); store.subscribe((e: {source: string}) => events.push(e.source));
   const next = JSON.parse(JSON.stringify(def)); next.steps[1].name += ' a'; next.steps[2].name += ' b'; next.steps[3].name += ' c'; next.resources[0].capacity += 1;
   store.write(JSON.stringify(next, null, 2), 'definition'); store.write(JSON.stringify(next, null, 2), 'definition');
   const out: Record<string, unknown> = {events: events.slice(), summary: store.describeDiff(), ignoring: store.diff({ignoreStep: def.steps[1].id}).steps, names: store.diff().changedSteps.map((s: {name: string}) => s.name).length};
   store.leave(); store.enter(1, other); out.otherClean = !store.changed() && store.describeDiff() === ''; store.enter(0, def); out.restored = store.read() === JSON.stringify(next, null, 2) && store.changed();
   store.write('{"unfinished":', 'raw'); out.invalid = store.diff().invalid; out.invalidText = store.describeDiff(); out.parsed = store.parse() === undefined;
   store.restore(); out.reset = !store.changed() && store.describeDiff() === ''; store.write(JSON.stringify(next), 'definition'); store.enter(0, next); out.applied = !store.changed(); return out;
  });
  assert.deepEqual(pure.events, ['definition']); assert.equal(pure.summary, 'Unapplied draft: 3 steps, 1 resource changed'); assert.equal(pure.ignoring, 2); assert.equal(pure.names, 3);
  assert.equal(pure.otherClean, true); assert.equal(pure.restored, true); assert.equal(pure.invalid, true); assert.equal(pure.invalidText, 'Unapplied draft: not valid process JSON yet'); assert.equal(pure.parsed, true); assert.equal(pure.reset, true); assert.equal(pure.applied, true);
  const unapplied = (n: string) => `Unapplied draft \u00b7 ${n}`, chip = () => page.locator('#draft-chip').innerText(), clean = () => page.locator('#draft-chip').isHidden();
  await page.locator('[data-step="discovery"]').click(); await page.locator('#edit-step').click(); await page.locator('#se-name').fill('Discovery workshop'); await page.locator('#se-save').click();
  assert.equal(await chip(), unapplied('1 step changed')); assert.match(await draftText(), /Discovery workshop/);
  await page.locator('#process-switch').selectOption('1'); await page.waitForFunction(() => (globalThis as unknown as {LWProcessStudio: {query(): {active: number}}}).LWProcessStudio.query().active === 1);
  assert.equal(await clean(), true); assert.doesNotMatch(await draftText(), /Discovery workshop/);
  const work = (await query(page)).definition.steps.find(s => s.kind === 'task')!;
  await page.locator(`[data-step="${work.id}"]`).click(); await page.locator('#edit-step').click(); await page.locator('#se-name').fill('Vendor edit'); await page.locator('#se-save').click();
  assert.equal(await chip(), unapplied('1 step changed')); assert.match(await draftText(), /Vendor edit/);
  await page.locator('#process-switch').selectOption('0'); await page.waitForFunction(() => (globalThis as unknown as {LWProcessStudio: {query(): {active: number}}}).LWProcessStudio.query().active === 0);
  assert.equal(await chip(), unapplied('1 step changed')); assert.match(await draftText(), /Discovery workshop/); assert.doesNotMatch(await draftText(), /Vendor edit/);
  await page.locator('#process-switch').selectOption('1'); await page.waitForFunction(() => (globalThis as unknown as {LWProcessStudio: {query(): {active: number}}}).LWProcessStudio.query().active === 1);
  assert.match(await draftText(), /Vendor edit/); await openDef(); await applyDef();
  assert.equal(await clean(), true); assert.equal((await query(page)).definition.steps.find(s => s.id === work.id)!.name, 'Vendor edit');
  await page.locator('#process-switch').selectOption('0'); await page.waitForFunction(() => (globalThis as unknown as {LWProcessStudio: {query(): {active: number}}}).LWProcessStudio.query().active === 0);
  assert.equal(await chip(), unapplied('1 step changed'));
 });
 await check('Step editor edits machine and system steps with matching pool kinds, technology and declared outputs', async () => {
  await freshStudio(); const name = 'auto-line.json';
  await page.locator('#file').setInputFiles({name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(autoLine()))});
  await page.waitForFunction(n => document.getElementById('message')!.textContent!.includes('Imported ' + n), name);
  const dlg = page.locator('dialog.pd-dialog[open]'), openStep = async (id: string) => { await page.locator(`[data-step="${id}"]`).click(); await page.locator('#edit-step').click(); await dlg.waitFor(); };
  await openStep('weld'); assert.equal(await page.locator('#se-chip').innerText(), 'machine'); assert.equal(await page.locator('#se-h-automation').count(), 1);
  assert.equal(await page.locator('#se-technology').inputValue(), 'Robot arm'); assert.equal(await page.locator('#se-technology-count').innerText(), '9 / 80 characters');
  assert.equal(await dlg.getByLabel('Welding cell').count(), 1); assert.equal(await dlg.getByLabel('Operators').count(), 0); assert.equal(await dlg.getByLabel('CI runners').count(), 0);
  assert.equal(await page.locator('#se-pools-1-count-help').innerText(), '2 available · 0 = not needed'); assert.match(await dlg.innerText(), /Machine step duration/);
  await page.locator('#se-technology').fill('Laser welder'); assert.equal(await page.locator('#se-technology-count').innerText(), '12 / 80 characters');
  await page.locator('#se-add-output').click(); assert.equal(await activeId(), 'se-outputs-1-field'); await page.locator('#se-outputs-1-field').fill('checked');
  assert.match(await page.locator('#se-err-outputs-1').innerText(), /does not deliver it/); assert.equal(await page.locator('#se-outputs-1-field').getAttribute('aria-invalid'), 'true');
  assert.equal(await page.locator('#se-err-outputs-1 .se-err').count(), 1, 'one problem per field'); await page.locator('#se-status a[data-goto="se-outputs-1-field"]').click(); assert.equal(await activeId(), 'se-outputs-1-field');
  await page.locator('#se-add-add').click(); await page.locator('[data-bind="add.0.key"]').fill('checked'); assert.equal(await page.locator('#se-err-outputs-1').innerText(), ''); assert.equal(await page.locator('#se-outputs-1-field').getAttribute('aria-invalid'), null);
  await page.locator('#se-outputs-1-label').fill('Checks passed'); await page.locator('#se-save').click(); assert.equal(await dialogOpen(), 0);
  const saved = (JSON.parse(await draftText()) as LWProcess.Definition).steps.find(s => s.id === 'weld')!;
  assert.equal(saved.technology, 'Laser welder'); assert.deepEqual(saved.outputs, [{field: 'welded', label: 'Welded part'}, {field: 'checked', label: 'Checks passed'}]); assert.deepEqual(saved.add, {checked: 1}); assert.deepEqual(saved.resources, {welding: 1});
  await openStep('prep'); assert.equal(await page.locator('#se-chip').innerText(), 'task'); assert.equal(await page.locator('#se-h-automation').count(), 0); assert.equal(await page.locator('#se-technology').count(), 0);
  assert.equal(await dlg.getByLabel('Operators').count(), 1); assert.equal(await dlg.getByLabel('Welding cell').count(), 0); assert.equal(await dlg.getByLabel('CI runners').count(), 0); assert.equal(await page.locator('#se-h-outputs').count(), 1);
  await page.locator('#se-close').click(); assert.equal(await dialogOpen(), 0);
  await openStep('verify'); assert.equal(await page.locator('#se-chip').innerText(), 'system'); assert.equal(await page.locator('#se-technology').inputValue(), 'CI pipeline');
  assert.equal(await dlg.getByLabel('CI runners').count(), 1); assert.equal(await dlg.getByLabel('Operators').count(), 0); assert.equal(await dlg.getByLabel('Welding cell').count(), 0); await page.locator('#se-close').click();
  // A pool of the wrong kind is shown with its problem, and a missing kind is explained.
  const broken = autoLine(); broken.resources[1]!.kind = 'people'; await openDef(); await page.locator('#draft').fill(JSON.stringify(broken)); await closeDef();
  await openStep('weld'); assert.match(await page.locator('#se-no-pools').innerText(), /Add a machine pool in the Definition editor/);
  assert.equal(await page.locator('#se-pools-1-count').getAttribute('aria-invalid'), 'true'); assert.match(await page.locator('#se-err-pools-1').innerText(), /Welding cell is a people pool, but machine steps may use only machine pools/);
  await page.locator('#se-close').click(); assert.equal(await dialogOpen(), 0);
 });
 await check('Step editor confirms before applying over a run in progress and links errors to their fields', async () => {
  await freshStudio(); await page.locator('#advance').click(); const before = await query(page); assert.equal(before.snapshot.minute, 30);
  await page.locator('[data-step="discovery"]').click(); await page.locator('#edit-step').click(); await page.locator('#se-duration').fill('20'); await page.locator('#se-apply').click();
  assert.equal(await page.locator('#se-confirm').isVisible(), true); assert.match(await page.locator('#se-confirm-title').innerText(), /^Applying starts a fresh paused run and discards minute 30 \(\d+ cases?\)\. Export the run report first if you need it\.$/);
  assert.equal(await activeId(), 'se-back'); assert.equal(await page.locator('#se-apply-reset').innerText(), 'Apply and reset'); assert.deepEqual((await query(page)).definition, before.definition);
  await page.keyboard.press('Escape'); assert.equal(await page.locator('#se-confirm').isHidden(), true); assert.equal(await dialogOpen(), 1); assert.equal((await query(page)).snapshot.minute, 30);
  await page.locator('#se-apply').click(); await page.locator('#se-apply-reset').click(); assert.equal(await dialogOpen(), 0);
  const applied = await query(page); assert.equal(applied.snapshot.minute, 0); assert.equal(applied.definition.steps[1]!.duration, 20);
  assert.deepEqual([applied.selected, await activeId()], ['discovery', 'edit-step'], 'the selection survives the apply and focus returns to Edit step');
  // Errors link to fields, each field shows one problem, and problems elsewhere in the draft are listed with names.
  await openDef(); const raw = JSON.parse(await draftText()) as LWProcess.Definition; delete raw.steps[1]!.duration; await page.locator('#draft').fill(JSON.stringify(raw)); await closeDef();
  await page.locator('[data-step="implementation"]').click(); await page.locator('#edit-step').click(); await page.locator('#se-duration').fill('');
  assert.equal(await page.locator('#se-err-duration .se-err').count(), 1); assert.equal(await page.locator('#se-duration').getAttribute('aria-invalid'), 'true');
  await page.locator('#se-status a[data-goto="se-duration"]').click(); assert.equal(await activeId(), 'se-duration');
  const elsewhere = await page.locator('#se-status').innerText(); assert.match(elsewhere, /1 problem in this step/); assert.match(elsewhere, /Task duration must be 1 or more/); assert.match(elsewhere, /Elsewhere in the draft \(1\)/); assert.match(elsewhere, /Discovery › duration/); assert.match(elsewhere, /Definition editor/);
  await page.locator('#se-add-set').click(); await page.locator('[data-bind="set.1.key"]').fill(''); assert.equal(await page.locator('[data-bind="set.1.key"]').getAttribute('aria-invalid'), 'true'); assert.match(await page.locator('#se-status').innerText(), /Value 2: Name the field or remove this row/);
  await page.locator('[data-bind="set.1.key"]').fill('extra'); await page.locator('#se-duration').fill('25'); assert.doesNotMatch(await page.locator('#se-status').innerText(), /in this step/);
  await page.locator('#se-apply').click(); assert.equal(await page.locator('#se-apply-errors').isVisible(), true); assert.match(await page.locator('#se-apply-errors').innerText(), /Discovery › duration/); assert.equal(await dialogOpen(), 1);
  await page.locator('#se-cancel').click(); await page.locator('#se-discard').click(); assert.equal(await dialogOpen(), 0);
  // An unparseable draft cannot be edited as a step: Edit step opens the Definition editor on the JSON syntax error instead.
  await openDef(); await page.locator('#draft').fill('{bad'); await closeDef(); await page.locator('#edit-step').click();
  assert.equal(await dialogOpen(), 1); assert.equal(await page.locator('#de-title').isVisible(), true); assert.equal(await page.locator('#se-title').isVisible(), false); assert.match(await page.locator('#draft-state').innerText(), /Invalid JSON: line 1, column 2/);
  await restoreDef(); await closeDef();
 });
 await check('Step editor edits random timing, draws and chance routes and keeps them valid', async () => {
  await importRandom(); await openRandom('pack');
  assert.equal(await page.locator('#se-h-random-timing').count(), 1); assert.equal(await page.locator('#se-timing-dist').inputValue(), ''); assert.equal(await page.locator('#se-timing-min').count(), 0);
  await page.locator('#se-timing-dist').selectOption('uniform'); assert.equal(await page.locator('#se-timing-min').inputValue(), '6'); assert.equal(await page.locator('#se-timing-max').inputValue(), '18');
  await page.locator('#se-timing-min').fill('8'); await page.locator('#se-timing-max').fill('14'); assert.equal(await page.locator('#se-err-timing .se-err').count(), 0);
  // Random outcomes: chance, weighted choice and whole number rows.
  assert.equal(await page.locator('#se-h-random-outcomes').count(), 1); assert.match(await dlgText(), /applied when the step completes, after Set values and before counters/);
  await page.locator('#se-add-draw').click(); assert.equal(await activeId(), 'se-draws-0-field'); await page.locator('#se-draws-0-field').fill('defect'); await page.locator('#se-draws-0-percent').fill('12');
  await page.locator('#se-add-draw').click(); await page.locator('#se-draws-1-field').fill('defect'); assert.match(await page.locator('#se-err-draws-1').innerText(), /drawn twice/); assert.equal(await page.locator('#se-draws-1-field').getAttribute('aria-invalid'), 'true');
  await page.locator('#se-draws-1-field').fill('packed'); assert.match(await page.locator('#se-err-draws-1').innerText(), /also in Set a value/);
  await page.locator('#se-draws-1-field').fill('priority'); await page.locator('#se-draws-1-kind').selectOption('choice'); assert.equal(await page.locator('#se-draws-1-values-1-weight').count(), 1);
  await page.locator('#se-draws-1-values-0-value-text').fill('standard'); await page.locator('#se-draws-1-values-0-weight').fill('80'); await page.locator('#se-draws-1-values-1-value-text').fill('express'); await page.locator('#se-draws-1-values-1-weight').fill('20');
  assert.equal(await page.locator('[data-act="remove-choice"][data-i="1"][data-j="0"]').isDisabled(), true, 'a weighted choice keeps two values');
  await page.locator('#se-add-choice-1').click(); assert.equal(await page.locator('[data-act="remove-choice"][data-i="1"][data-j="2"]').isEnabled(), true); await page.locator('[data-act="remove-choice"][data-i="1"][data-j="2"]').click(); assert.equal(await page.locator('#se-draws-1-values-2-weight').count(), 0);
  await page.locator('#se-add-draw').click(); await page.locator('#se-draws-2-field').fill('size'); await page.locator('#se-draws-2-kind').selectOption('int'); await page.locator('#se-draws-2-min').fill('1'); await page.locator('#se-draws-2-max').fill('6');
  for (let i = 3; i < 8; i++) await page.locator('#se-add-draw').click(); assert.equal(await page.locator('#se-add-draw').isDisabled(), true); assert.match(await page.locator('#se-max-draws').innerText(), /At most 8/);
  for (let i = 7; i >= 3; i--) await page.locator(`[data-act="remove-draw"][data-i="${i}"]`).click(); assert.equal(await page.locator('#se-add-draw').isEnabled(), true); assert.equal(await activeId(), 'se-add-draw');
  assert.equal(await page.locator('#se-save').isEnabled(), true); await page.locator('#se-save').click(); assert.equal(await dialogOpen(), 0);
  const pack = await savedStep('pack'); assert.deepEqual(pack.timing, {dist: 'uniform', min: 8, max: 14}); assert.equal(pack.duration, 12);
  assert.deepEqual(pack.draws, [{field: 'defect', kind: 'chance', percent: 12}, {field: 'priority', kind: 'choice', values: [{value: 'standard', weight: 80}, {value: 'express', weight: 20}]}, {field: 'size', kind: 'int', min: 1, max: 6}]);
  // Chance routes are editable on a decision and show their share in the path summary.
  await openRandom('gate'); assert.equal(await page.locator('#se-h-random-timing').count(), 0); assert.equal(await page.locator('#se-h-random-outcomes').count(), 0);
  assert.deepEqual(await page.locator('#se-path-summary li').allInnerTexts(), ['20% of cases → Repack', 'Otherwise → Done']);
  assert.equal(await page.locator('#se-flows-0-cond-mode-chance').isChecked(), true); assert.equal(await page.locator('#se-flows-0-cond-chance').inputValue(), '20');
  await page.locator('#se-flows-0-cond-chance').fill('8'); assert.equal((await page.locator('#se-path-summary li').allInnerTexts())[0], '8% of cases → Repack');
  await page.locator('#se-flows-0-cond-chance').fill('0'); assert.match(await page.locator('#se-err-flows-0').innerText(), /whole percent from 1 to 99/); assert.equal(await page.locator('#se-save').isDisabled(), true);
  await page.locator('#se-flows-0-cond-mode-value').check(); assert.equal(await page.locator('#se-flows-0-cond-chance').count(), 0); assert.equal(await page.locator('#se-flows-0-cond-field').count(), 1);
  await page.locator('#se-flows-0-cond-mode-chance').check(); assert.equal(await page.locator('#se-flows-0-cond-chance').inputValue(), '0'); await page.locator('#se-flows-0-cond-chance').fill('8');
  await page.locator('#se-flows-1-cond-on').check(); await page.locator('#se-flows-1-cond-mode-chance').check(); await page.locator('#se-flows-1-cond-chance').fill('30');
  assert.match(await page.locator('#se-status').innerText(), /exactly one unconditional fallback/); await page.locator('#se-flows-1-cond-on').uncheck();
  await page.locator('#se-save').click(); const gate = (JSON.parse(await draftText()) as LWProcess.Definition).flows.filter(f => f.from === 'gate'); assert.deepEqual(gate.map(f => f.when), [{chance: 8}, undefined]);
  // The edited draft is accepted by the engine and a seeded run records realized durations and drawn values.
  const verdict = await page.evaluate(text => (globalThis as unknown as {LWProcessCatalog: LWProcess.Catalog}).LWProcessCatalog.validate(JSON.parse(text)).ok, await draftText()); assert.equal(verdict, true);
  await openRandom('pack'); await page.locator('#se-apply').click(); await page.waitForFunction(() => document.querySelectorAll('dialog.pd-dialog[open]').length === 0);
  for (let i = 0; i < 14; i++) if (!(await page.locator('#advance').isDisabled())) await page.locator('#advance').click();
  const run = (await query(page)).snapshot, packs = run.receipts.filter(r => r.stepId === 'pack');
  assert.ok(packs.length >= 4, 'several pack visits finished'); assert.ok(packs.every(r => r.duration !== undefined && r.duration === r.finished - r.started && r.duration >= 8 && r.duration <= 14));
  assert.ok(packs.every(r => typeof r.changes.defect === 'boolean' && ['standard', 'express'].includes(String(r.changes.priority)) && Number(r.changes.size) >= 1 && Number(r.changes.size) <= 6));
  assert.equal(run.receipts.filter(r => r.stepId === 'repack').every(r => r.duration === undefined), true, 'deterministic steps record no realized duration');
  await showIo(); await page.locator('[data-step="pack"]').click(); assert.match(await page.locator('#process-data').innerText(), /Took \d+ min \(planned 12\)/); assert.ok(await page.locator('#process-data .se-drawn').count() >= 3);
  await page.locator('[data-step="repack"]').click(); assert.doesNotMatch(await page.locator('#process-data').innerText(), /Took \d+ min/); assert.equal(await page.locator('#process-data .se-drawn').count(), 0);
 });
 await check('Step editor explains the planning duration next to random timing and rejects inconsistent distributions inline', async () => {
  await importRandom(); await openRandom('pack'); await page.locator('#se-timing-dist').selectOption('triangular');
  assert.equal(await page.locator('#se-timing-note').innerText(), 'Planning duration (12 min) stays the average shown in estimates; each visit draws its own time.');
  await page.locator('#se-duration').fill('20'); assert.match(await page.locator('#se-timing-note').innerText(), /Planning duration \(20 min\) stays the average/); await page.locator('#se-duration').fill('12');
  await page.locator('#se-timing-min').fill('20'); await page.locator('#se-timing-mode').fill('10'); await page.locator('#se-timing-max').fill('5');
  assert.match(await page.locator('#se-err-timing').innerText(), /minimum ≤ most likely ≤ maximum/); assert.equal(await page.locator('#se-timing-mode').getAttribute('aria-invalid'), 'true');
  assert.equal(await page.locator('#se-save').isDisabled(), true); assert.equal(await page.locator('#se-apply').isDisabled(), true);
  await page.locator('#se-timing-min').fill('4'); await page.locator('#se-timing-mode').fill('6'); await page.locator('#se-timing-max').fill('10'); assert.equal(await page.locator('#se-err-timing .se-err').count(), 0); assert.equal(await page.locator('#se-save').isEnabled(), true);
  await page.locator('#se-timing-dist').selectOption('uniform'); await page.locator('#se-timing-min').fill('9'); await page.locator('#se-timing-max').fill('4');
  assert.match(await page.locator('#se-err-timing').innerText(), /minimum \(9\) must not be above the maximum \(4\)/); assert.equal(await page.locator('#se-timing-min').getAttribute('aria-invalid'), 'true');
  await page.locator('#se-timing-dist').selectOption('exponential'); assert.equal(await page.locator('#se-timing-mean').inputValue(), '12'); await page.locator('#se-timing-max').fill('3');
  assert.match(await page.locator('#se-err-timing').innerText(), /cap \(3\) must not be below the mean \(12\)/); await page.locator('#se-timing-mean').fill('4'); await page.locator('#se-timing-max').fill('');
  assert.equal(await page.locator('#se-err-timing .se-err').count(), 0); await page.locator('#se-timing-max').fill('12'); await page.locator('#se-save').click();
  assert.deepEqual((await savedStep('pack')).timing, {dist: 'exponential', mean: 4, max: 12});
  // None removes the distribution again; the planning duration stays.
  await openRandom('pack'); await page.locator('#se-timing-dist').selectOption(''); assert.equal(await page.locator('#se-timing-note').count(), 0); await page.locator('#se-save').click(); assert.equal((await savedStep('pack')).timing, undefined); assert.equal((await savedStep('pack')).duration, 12);
  // Duration timers may be random; until timers and other kinds are not offered the section.
  await openRandom('cool'); assert.equal(await page.locator('#se-h-random-timing').count(), 1); await page.locator('#se-timing-dist').selectOption('exponential'); assert.equal(await page.locator('#se-timing-mean').inputValue(), '30'); await page.locator('#se-save').click();
  assert.deepEqual((await savedStep('cool')).timing, {dist: 'exponential', mean: 30});
  await openRandom('dock'); assert.equal(await page.locator('#se-h-random-timing').count(), 0); assert.equal(await page.locator('#se-h-random-outcomes').count(), 1); await page.locator('#se-close').click();
  await openRandom('start'); assert.equal(await page.locator('#se-h-random-timing').count(), 0); assert.equal(await page.locator('#se-h-random-outcomes').count(), 0); await page.locator('#se-close').click();
  // Engine diagnostics for timing and draws map to the editor fields as well.
  const mapped = await page.evaluate(() => {
   const g = globalThis as unknown as {LWProcessCatalog: LWProcess.Catalog; LWProcessStepModel: LWProcessStepModel.Api};
   const def = {...JSON.parse(JSON.stringify((globalThis as unknown as {LWProcessStudio: {query(): {definition: LWProcess.Definition}}}).LWProcessStudio.query().definition))} as LWProcess.Definition;
   const pack = def.steps.find(s => s.id === 'pack')!; pack.timing = {dist: 'uniform', min: 9, max: 4}; pack.draws = [{field: 'packed', kind: 'chance', percent: 12}, {field: 'x', kind: 'int', min: 5, max: 1}];
   return g.LWProcessStepModel.scope(def, 'pack', g.LWProcessCatalog.validate(def, true).diagnostics).map(i => i.key + '|' + i.message);
  });
  assert.ok(mapped.some(m => m.startsWith('timing|') && /min at most max/.test(m)), mapped.join('\n')); assert.ok(mapped.some(m => m.startsWith('draws.0.field|') && /one writer/.test(m))); assert.ok(mapped.some(m => m.startsWith('draws.1|') && /min at most max/.test(m)));
 });
 await check('Step editor edits inclusive forks, multiple instances, deadlines and combined conditions and keeps them valid', async () => {
  await importClaims(false); await openRandom('route');
  assert.equal(await page.locator('#se-h-branching').count(), 1); assert.equal(await page.locator('#se-branching').inputValue(), 'parallel'); assert.equal(await page.locator('#se-path-summary').count(), 0); assert.equal(await page.locator('#se-flows-0-cond-on').count(), 0);
  await page.locator('#se-branching').selectOption('inclusive'); assert.match(await page.locator('#se-branching-note').innerText(), /every branch whose condition is true/);
  assert.deepEqual(await page.locator('#se-path-summary li').allInnerTexts(), ['Otherwise (default branch) → Check insurance', 'Otherwise (default branch) → Check gift wrap']);
  assert.match(await page.locator('#se-status').innerText(), /at most one flow without a condition/);
  await page.locator('#se-flows-0-cond-on').check(); await page.locator('#se-flows-0-cond-field').fill('insured'); assert.equal((await page.locator('#se-path-summary li').allInnerTexts())[0], 'If insured = true → Check insurance');
  assert.doesNotMatch(await page.locator('#se-status').innerText(), /at most one flow without a condition/); assert.equal(await page.locator('#se-save').isEnabled(), true);
  // All of these / Any of these / Not: nested rows with real labels, a depth of three groups and at most eight tests.
  await page.locator('#se-flows-0-cond-mode-all').check(); assert.equal(await page.locator('#se-flows-0-cond-items-0-field').inputValue(), 'insured'); assert.equal(await page.locator('#se-flows-0-cond-items-1-field').count(), 1);
  assert.match(await page.locator('#se-err-flows-0').innerText(), /Name the case field to test/); assert.equal(await page.locator('#se-save').isDisabled(), true); assert.equal(await page.getByLabel('Case field to test (test 2)').count(), 1);
  await page.locator('#se-flows-0-cond-items-1-field').fill('gift'); await page.locator('#se-flows-0-cond-items-1-mode').selectOption('chance'); await page.locator('#se-flows-0-cond-items-1-chance').fill('8');
  assert.equal((await page.locator('#se-path-summary li').allInnerTexts())[0], 'If insured = true AND 8% of cases → Check insurance');
  await page.locator('#se-flows-0-cond-add').click(); assert.equal(await activeId(), 'se-flows-0-cond-items-2-field'); await page.locator('#se-flows-0-cond-items-2-mode').selectOption('any');
  await page.locator('#se-flows-0-cond-items-2-items-0-mode').selectOption('not'); assert.equal(await page.locator('#se-flows-0-cond-items-2-items-0-items-0-field').count(), 1);
  assert.deepEqual(await page.locator('#se-flows-0-cond-items-2-items-0-items-0-mode option').evaluateAll(o => o.map(x => (x as HTMLOptionElement).value)), ['value', 'field', 'chance'], 'a third-level group offers no further groups');
  await page.locator('#se-flows-0-cond-items-2-items-0-items-0-field').fill('vip'); await page.locator('#se-flows-0-cond-items-2-items-1-field').fill('region'); await page.locator('#se-flows-0-cond-items-2-items-1-value-type').selectOption('text'); await page.locator('#se-flows-0-cond-items-2-items-1-value-text').fill('eu');
  assert.equal((await page.locator('#se-path-summary li').allInnerTexts())[0], 'If insured = true AND 8% of cases AND (NOT vip = true OR region = "eu") → Check insurance'); assert.equal(await page.locator('#se-err-flows-0 .se-err').count(), 0);
  for (let i = 0; i < 4; i++) await page.locator('#se-flows-0-cond-add').click();
  assert.equal(await page.locator('#se-flows-0-cond-add').isDisabled(), true); assert.match(await page.locator('#se-flows-0-cond-max').innerText(), /At most 8 tests in a group and 8 in the whole condition/);
  for (let i = 6; i >= 3; i--) await page.locator(`[data-act="remove-cond"][data-path="flows.0.cond"][data-i="${i}"]`).click(); assert.equal(await page.locator('#se-flows-0-cond-add').isEnabled(), true); assert.equal(await page.locator('#se-flows-0-cond-items-3-field').count(), 0);
  await page.locator('#se-save').click(); assert.equal(await dialogOpen(), 0);
  const def = await defOf(), route = def.steps.find(s => s.id === 'route')!, when = def.flows.filter(f => f.from === 'route').map(f => f.when);
  assert.equal(route.mode, 'inclusive'); assert.deepEqual(when, [{all: [{field: 'insured', op: 'eq', value: true}, {chance: 8}, {any: [{not: {field: 'vip', op: 'eq', value: true}}, {field: 'region', op: 'eq', value: 'eu'}]}]}, undefined]); assert.equal(await catalogOk(await draftText()), true);
  // Back to parallel clears the conditions in the written draft; the saved inclusive draft reopens with its tree.
  await openRandom('route'); assert.equal(await page.locator('#se-branching').inputValue(), 'inclusive'); assert.equal((await page.locator('#se-path-summary li').allInnerTexts())[0]!.startsWith('If insured = true AND 8% of cases AND ('), true);
  await page.locator('#se-branching').selectOption('parallel'); assert.equal(await page.locator('#se-path-summary').count(), 0); await page.locator('#se-save').click(); assert.deepEqual((await defOf()).flows.filter(f => f.from === 'route').map(f => f.when), [undefined, undefined]); assert.equal((await defOf()).steps.find(s => s.id === 'route')!.mode, undefined);
  await openRandom('route'); await page.locator('#se-branching').selectOption('inclusive'); await page.locator('#se-flows-0-cond-on').check(); await page.locator('#se-flows-0-cond-field').fill('insured'); await page.locator('#se-save').click();
  // Multiple instances are blocked, with a visible reason, while a backlog exists.
  await openRandom('inspect'); assert.equal(await page.locator('#se-h-instances').count(), 1); assert.equal(await page.locator('#se-instances-kind').isDisabled(), true); assert.match(await page.locator('#se-instances-blocked').innerText(), /cannot be combined with a backlog/);
  assert.equal(await page.locator('#se-instances-kind').getAttribute('aria-describedby'), 'se-instances-blocked'); await page.locator('#se-backlog-on').uncheck(); assert.equal(await page.locator('#se-instances-kind').isEnabled(), true); assert.equal(await page.locator('#se-instances-blocked').count(), 0);
  await page.locator('#se-instances-kind').selectOption('count'); assert.equal(await page.locator('#se-instances-count').inputValue(), '3'); assert.equal(await page.locator('#se-instances-mode-parallel').isChecked(), true);
  await page.locator('#se-instances-count').fill('1'); assert.match(await page.locator('#se-err-instances').innerText(), /from 2 to 50/); assert.equal(await page.locator('#se-instances-count').getAttribute('aria-invalid'), 'true'); assert.equal(await page.locator('#se-save').isDisabled(), true);
  await page.locator('#se-instances-count').fill('60'); assert.match(await page.locator('#se-err-instances').innerText(), /from 2 to 50/); await page.locator('#se-instances-count').fill('4'); await page.locator('#se-instances-mode-sequential').check();
  assert.match(await page.locator('#se-instances-note').innerText(), /Runs 4 instances one after another/); await page.locator('#se-instances-kind').selectOption('field'); await page.locator('#se-instances-field').fill('Lines'); assert.match(await page.locator('#se-err-instances').innerText(), /lowercase letter/);
  await page.locator('#se-instances-field').fill('lines'); await page.locator('#se-instances-mode-parallel').check(); assert.match(await page.locator('#se-instances-note').innerText(), /one instance for each unit counted in case field "lines"/); await page.locator('#se-save').click();
  const inspect = (await defOf()).steps.find(s => s.id === 'inspect')!; assert.deepEqual(inspect.instances, {field: 'lines', mode: 'parallel'}); assert.equal(inspect.backlog, undefined);
  await openRandom('inspect'); await page.locator('#se-backlog-on').check(); assert.match(await page.locator('#se-status').innerText(), /cannot keep a backlog/); await page.locator('#se-backlog-on').uncheck(); await page.locator('#se-instances-kind').selectOption('none'); assert.equal(await page.locator('#se-instances-mode-parallel').count(), 0); await discard();
  // Deadlines: choose the deadline flow among the existing ones, random time, interrupt or escalate, with inline problems.
  await openRandom('approve'); assert.equal(await page.locator('#se-deadline-kind').inputValue(), 'after'); assert.equal(await page.locator('#se-deadline-after').inputValue(), '20'); assert.equal(await page.locator('#se-deadline-mode-escalate').isChecked(), true); assert.equal(await page.locator('#se-deadline-flow').inputValue(), 'approve-late');
  assert.deepEqual(await page.locator('#se-deadline-flow option').allInnerTexts(), ['Choose a flow', 'f7 → Paid out', 'approve-late → Notify the manager']); assert.match(await page.locator('#se-deadline-note').innerText(), /After 20 min of work the deadline escalates/);
  await page.locator('#se-deadline-after').fill('0'); assert.match(await page.locator('#se-err-deadline').innerText(), /from 1 to 100,000/); await page.locator('#se-deadline-after').fill('25'); assert.match(await page.locator('#se-deadline-note').innerText(), /After 25 min/);
  await page.locator('#se-deadline-kind').selectOption('timing'); assert.equal(await page.locator('#se-deadline-timing-dist').inputValue(), 'exponential'); assert.equal(await page.locator('#se-deadline-timing-mean').inputValue(), '15');
  await page.locator('#se-deadline-timing-dist').selectOption('normal'); assert.equal(await page.locator('#se-deadline-timing-sd').inputValue(), '4'); await page.locator('#se-deadline-timing-sd').fill('0'); assert.match(await page.locator('#se-err-deadline').innerText(), /spread.*from 1 to 100,000/);
  await page.locator('#se-deadline-timing-sd').fill('3'); await page.locator('#se-deadline-timing-min').fill('25'); await page.locator('#se-deadline-timing-max').fill('20'); assert.match(await page.locator('#se-err-deadline').innerText(), /minimum \(25\) must not be above the maximum \(20\)/); await page.locator('#se-deadline-timing-min').fill(''); await page.locator('#se-deadline-timing-max').fill('');
  await page.locator('#se-deadline-mode-interrupt').check(); await page.locator('#se-deadline-flow').selectOption('f7'); assert.match(await page.locator('#se-sections fieldset.se-deadline-path legend').innerText(), /to Paid out · deadline path/); await page.locator('#se-deadline-flow').selectOption('approve-late');
  await page.locator('#se-save').click(); const approve = (await defOf()); assert.deepEqual(approve.steps.find(s => s.id === 'approve')!.deadline, {timing: {dist: 'normal', mean: 15, sd: 3}, mode: 'interrupt', flow: 'approve-late'});
  assert.deepEqual(approve.flows.filter(f => f.from === 'approve').map(f => [f.id, f.on]), [['f7', undefined], ['approve-late', 'deadline']]);
  // A step with a single outgoing path explains that a deadline needs a second one and links to Add path to….
  await openRandom('notify'); await page.locator('#se-deadline-kind').selectOption('after'); assert.match(await page.locator('#se-deadline-noflow').innerText(), /only one outgoing path/); assert.equal(await page.locator('#se-deadline-flow').count(), 0);
  assert.match(await page.locator('#se-err-deadline').innerText(), /second path/); assert.equal(await page.locator('#se-save').isDisabled(), true); assert.match(await page.locator('#se-deadline-noflow').innerText(), /Add one with Add path to…/);
  await page.locator('#se-deadline-noflow a[data-goto="se-add-path-to"]').click(); assert.equal(await activeId(), 'se-add-path-to');
  await page.locator('#se-deadline-kind').selectOption('none'); assert.equal(await page.locator('#se-err-deadline .se-err').count(), 0); await discard();
  // The saved draft is accepted by the engine and a seeded run records items and deadlines in the metrics.
  assert.equal(await catalogOk(await draftText()), true); await openRandom('approve'); await page.locator('#se-apply').click(); await page.waitForFunction(() => document.querySelectorAll('dialog.pd-dialog[open]').length === 0);
  for (let i = 0; i < 3; i++) await page.locator('#advance').click();
  const run = (await query(page)).snapshot, steps = new Map(run.steps.map(s => [s.id, s]));
  assert.ok(steps.get('inspect')!.items!.started >= 3 && steps.get('inspect')!.items!.finished >= 3, 'instances run as items'); assert.ok(steps.get('approve')!.deadlines!.interrupted > 0, 'approvals past the random deadline are interrupted'); assert.equal(steps.get('route')!.id, 'route');
 });
 await check('Step editor adds, retargets and removes outgoing paths and offers a new path as the deadline path', async () => {
  await importClaims(false); await openRandom('notify');
  const legends = () => page.locator('#se-h-flows ~ fieldset > legend').allInnerTexts();
  assert.deepEqual(await legends(), ['Path 1 of 1 · to Escalated']); assert.equal(await page.locator('#se-flows-0-to').inputValue(), 'alert');
  // A task keeps exactly one normal path, so its only path cannot be removed; the reason is visible and referenced.
  const removeFirst = page.locator('[data-act="remove-path"][data-i="0"]');
  assert.equal(await removeFirst.isDisabled(), true); assert.equal(await removeFirst.getAttribute('aria-describedby'), 'se-flows-0-keep');
  assert.equal(await page.locator('#se-flows-0-keep').innerText(), 'A task needs exactly one outgoing path.');
  const targets = await page.locator('#se-flows-0-to option').evaluateAll(o => o.map(n => (n as HTMLOptionElement).value));
  assert.equal(targets.includes('start'), false, 'no path may lead back to the start'); assert.equal(targets.includes('notify'), false); assert.ok(targets.includes('done'));
  // Add a second path, choose it as the deadline path and apply.
  await page.locator('#se-deadline-kind').selectOption('after'); await page.locator('#se-add-path-to').selectOption('alert'); await page.locator('#se-add-path').click();
  assert.equal(await activeId(), 'se-flows-1-to'); assert.deepEqual(await legends(), ['Path 1 of 2 · to Escalated', 'Path 2 of 2 · to Escalated']);
  assert.deepEqual(await page.locator('#se-deadline-flow option').allInnerTexts(), ['Choose a flow', 'f8 → Escalated', 'notify-alert → Escalated']);
  await page.locator('#se-deadline-flow').selectOption('notify-alert'); assert.equal(await page.locator('[data-act="remove-path"][data-i="1"]').isEnabled(), true, 'the deadline path may be removed');
  // Go to points a path at another step and the deadline choice follows its new name.
  await page.locator('#se-flows-1-to').selectOption('done'); assert.match((await legends())[1]!, /to Paid out · deadline path/);
  assert.deepEqual(await page.locator('#se-deadline-flow option').allInnerTexts(), ['Choose a flow', 'f8 → Escalated', 'notify-alert → Paid out']);
  await page.locator('#se-flows-1-to').selectOption('alert'); assert.equal(await page.locator('#se-status').innerText(), '');
  await page.locator('#se-apply').click(); await page.waitForFunction(() => document.querySelectorAll('dialog.pd-dialog[open]').length === 0);
  const applied = (await query(page)).definition, notify = applied.steps.find(s => s.id === 'notify')!;
  assert.deepEqual(applied.flows.filter(f => f.from === 'notify'), [{id: 'f8', from: 'notify', to: 'alert'}, {id: 'notify-alert', from: 'notify', to: 'alert', on: 'deadline'}]);
  assert.deepEqual(notify.deadline, {after: 8, mode: 'interrupt', flow: 'notify-alert'});
  // Removing the deadline path leaves the deadline asking for a second path; a fork keeps at least two branches.
  await openRandom('notify'); await page.locator('[data-act="remove-path"][data-i="1"]').click(); assert.equal(await activeId(), 'se-add-path');
  assert.match(await page.locator('#se-err-deadline').innerText(), /second path/); await page.locator('#se-deadline-kind').selectOption('none'); await page.locator('#se-save').click();
  assert.deepEqual((await defOf()).flows.filter(f => f.from === 'notify').map(f => f.id), ['f8']);
  await openRandom('route'); assert.equal(await page.locator('#se-flows-1-keep').innerText(), 'A fork needs at least two outgoing paths.'); await page.locator('#se-close').click();
  // An end step has no paths and offers none.
  await openRandom('done'); assert.match(await dlgText(), /This step ends the process, so it has no outgoing paths\./); assert.equal(await page.locator('#se-add-path').count(), 0); await page.locator('#se-close').click();
 });
 await check('Step editor moves to the previous or next step behind the same dirty guard', async () => {
  await freshStudio(); const original = await draftText(); await page.locator('[data-step="discovery"]').click(); await page.locator('#edit-step').click(); await page.locator('#se-name').waitFor();
  const prev = page.locator('#se-step-prev'), next = page.locator('#se-step-next');
  assert.equal(await prev.innerText(), 'Previous step: Project intake'); assert.equal(await next.innerText(), 'Next step: Plan together');
  await next.click(); assert.equal(await page.locator('#se-title').innerText(), 'Plan together'); assert.equal(await page.locator('#se-chip').innerText(), 'fork');
  assert.equal(await activeId(), 'se-step-next', 'focus stays on Next for the following step'); await prev.click(); await prev.click();
  assert.equal(await page.locator('#se-title').innerText(), 'Project intake'); assert.equal(await prev.isDisabled(), true); assert.equal(await prev.getAttribute('aria-describedby'), 'se-step-prev-why');
  assert.equal(await page.locator('#se-step-prev-why').innerText(), 'This is the first step.'); assert.equal(await activeId(), 'se-step-next');
  // Unsaved edits ask first: Keep editing is the default, Save to draft and go keeps them, Discard changes drops them.
  await next.click(); await page.locator('#se-name').fill('Discovery workshop'); await next.click();
  assert.equal(await page.locator('#se-confirm-title').innerText(), 'Go to Plan together? Your changes to Discovery workshop are not in the draft yet.');
  assert.deepEqual(await page.locator('#se-choices button').allInnerTexts(), ['Keep editing', 'Save to draft and go', 'Discard changes']); assert.equal(await activeId(), 'se-keep');
  await page.keyboard.press('Escape'); assert.equal(await page.locator('#se-title').innerText(), 'Discovery'); assert.equal(await page.locator('#se-name').inputValue(), 'Discovery workshop');
  await next.click(); await page.locator('#se-save-go').click(); assert.equal(await page.locator('#se-title').innerText(), 'Plan together'); assert.match(await draftText(), /"name": "Discovery workshop"/);
  await prev.click(); assert.equal(await page.locator('#se-name').inputValue(), 'Discovery workshop'); await page.locator('#se-name').fill('Dropped rename');
  await prev.click(); await page.locator('#se-discard').click(); assert.equal(await page.locator('#se-title').innerText(), 'Project intake'); assert.doesNotMatch(await draftText(), /Dropped rename/);
  // With local problems the edits cannot be saved, so only Keep editing and Discard changes are offered.
  await next.click(); await page.locator('#se-add-set').click(); await next.click();
  assert.deepEqual(await page.locator('#se-choices button').allInnerTexts(), ['Keep editing', 'Discard changes']); await page.locator('#se-discard').click();
  for (let i = 0; i < 9; i++) await next.click();
  assert.equal(await page.locator('#se-title').innerText(), 'Delivered'); assert.equal(await next.isDisabled(), true); assert.equal(await page.locator('#se-step-next-why').innerText(), 'This is the last step.');
  await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 0); assert.equal(await activeId(), 'edit-step');
  await openDef(); await restoreDef(); assert.equal(await draftText(), original); await closeDef();
 });
 await checkLifecycle('Process step editor browser lifecycle emits no runtime errors or network requests');
});
