/// <reference path="../process-contracts.d.ts" />
/**
 * Process Studio step editor suite entry: the shared modal, its sections and form edits, inline diagnostics, the phone sheet,
 * machine and system steps and applying over a run. Companion modules own the dirty guard and draft store, random timing,
 * branching, instances and deadlines, and structural edits; the entry calls them in the original check order.
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import {nextFrames} from './browser-harness';
import {query, OUT, runSuite} from './process-browser-fixture';
import {autoLine} from './process-browser-models';
import {structureChecks} from './process-step-editor-structure-checks';
import {dialogGuardChecks, stepNavigationChecks} from './process-step-editor-guard-checks';
import {randomChecks} from './process-step-editor-random-checks';
import {branchingChecks} from './process-step-editor-branching-checks';
runSuite('process step editor browser harness', 'process-step-editor-browser-results.json', async studio => {
 const {page, check, checkLifecycle, freshStudio, openDef, closeDef, restoreDef, draftText, dialogOpen, activeId} = studio;
 await check('Step editor opens as a modal from the inspector, traps focus, closes with Escape and restores the invoker focus', async () => {
  await freshStudio(); await page.locator('[data-step="discovery"]').click();
  await page.locator('#edit-step').focus(); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', {name: 'Discovery'}); await dialog.waitFor(); assert.equal(await dialogOpen(), 1);
  assert.equal(await page.evaluate(() => document.querySelector('dialog.pd-dialog[open]')!.matches(':modal')), true);
  assert.equal(await page.locator('#se-title').innerText(), 'Discovery');
  assert.equal(await page.locator('#se-chip').innerText(), 'task');
  assert.equal(await page.locator('#se-meta').innerText(), 'discovery');
  assert.equal(await activeId(), 'se-name'); assert.equal((await query(page)).selected, 'discovery');
  assert.equal(await page.locator('#se-apply').isDisabled(), true, 'an unchanged step and draft have nothing to apply');
  assert.match(
   await page.locator('#se-reason').innerText(),
   /Nothing to apply: this step and the draft hold the running definition\. Use Reset run to restart the run\./
  );
  await assert.rejects(page.locator('#play').click({timeout: 700}), 'the page behind the modal is inert');
  for (let i = 0; i < 70; i++) {
   await page.keyboard.press('Tab');
   assert.equal(await page.evaluate(() => !!document.activeElement?.closest('dialog.pd-dialog')), true, 'forward Tab stays inside at ' + i);
  }
  for (let i = 0; i < 6; i++) {
   await page.keyboard.press('Shift+Tab');
   assert.equal(await page.evaluate(() => !!document.activeElement?.closest('dialog.pd-dialog')), true, 'Shift+Tab stays inside');
  }
  assert.equal(await page.getByRole('button', {name: 'Close'}).count(), 1);
  await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 0); assert.equal(await activeId(), 'edit-step');
  await page.locator('#edit-step').focus();
  await page.keyboard.press('Enter');
  await dialog.waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await dialogOpen(), 0);
  assert.equal(await activeId(), 'edit-step');
  await page.locator('#edit-step').click();
  await page.locator('#se-close').click();
  assert.equal(await dialogOpen(), 0);
  assert.equal(await activeId(), 'edit-step');
  await page.locator('#overview').click(); assert.equal(await page.locator('#edit-step').isHidden(), true);
  // Opening from a running simulation pauses it and the clock stays put while the editor is open.
  await page.locator('[data-step="discovery"]').click(); await page.locator('#horizon').selectOption('1440'); await page.locator('#play').click();
  await page.waitForFunction(
   () => (globalThis as unknown as {LWProcessStudio: {query(): {snapshot: {minute: number}}}}).LWProcessStudio.query().snapshot.minute > 0
  );
  await page.locator('#edit-step').click();
  await dialog.waitFor();
  const frozen = await query(page);
  assert.equal(frozen.playing, false);
  await nextFrames(page, 45);
  assert.equal((await query(page)).snapshot.minute, frozen.snapshot.minute); assert.match(await page.locator('#se-subtitle').innerText(), /paused/);
  await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 0);
 });
 await check('Step editor edits timing, resources, completion effects and flow conditions and applies a fresh paused run', async () => {
  await freshStudio();
  await page.locator('#advance').click();
  assert.equal((await query(page)).snapshot.minute, 30);
  const before = await query(page);
  await page.locator('[data-step="discovery"]').click();
  await page.locator('#edit-step').click();
  await page.locator('#se-name').fill('Discovery workshop');
  await page.locator('#se-duration').fill('20');
  await page.locator('#se-cost').fill('12');
  assert.match(await page.locator('#se-needs-summary').innerText(), /^Needs: 1 Product owner$/);
  await page.locator('dialog.pd-dialog[open]').getByLabel('Business analysts').fill('2');
  assert.match(await page.locator('#se-needs-summary').innerText(), /^Needs: 1 Product owner, 2 Business analysts$/);
  await page.locator('#se-add-set').click();
  await page.locator('[data-bind="set.1.key"]').fill('budgetApproved');
  await page.locator('#se-add-set').click();
  await page.locator('[data-bind="set.2.key"]').fill('clientTone');
  await page.locator('[data-bind="set.2.value.type"]').selectOption('text');
  await page.locator('[data-bind="set.2.value.text"]').fill('calm');
  await page.locator('#se-add-add').click();
  await page.locator('[data-bind="add.0.key"]').fill('attempts');
  await page.locator('[data-bind="add.0.delta"]').fill('-2');
  await page.locator('#se-save').click();
  assert.equal(await dialogOpen(), 0);
  assert.equal(await page.locator('#message').innerText(), 'Saved to the draft. Apply the draft to start a fresh run.');
  assert.deepEqual((await query(page)).definition, before.definition);
  assert.equal((await query(page)).snapshot.minute, 30);
  const saved = JSON.parse(await draftText()) as LWProcess.Definition, discovery = saved.steps[1]!;
  assert.equal(discovery.name, 'Discovery workshop');
  assert.equal(discovery.duration, 20);
  assert.equal(discovery.cost, 12);
  assert.deepEqual(discovery.resources, {'product-owner': 1, 'business-analyst': 2});
  assert.deepEqual(discovery.set, {problemFramed: true, budgetApproved: true, clientTone: 'calm'});
  assert.deepEqual(discovery.add, {attempts: -2});
  // A decision's conditions: compare with another field and save, then reopen, switch back to a value, reorder and apply.
  // The draft also carries the discovery edits, which the modal announces.
  await page.locator('[data-step="review-gate"]').click();
  await page.locator('#edit-step').click();
  assert.match(await page.locator('#se-flows-0-label').inputValue(), /Findings/);
  assert.equal(await page.locator('#se-flows-1-cond-on').isChecked(), false);
  assert.equal(await page.locator('[data-act="up"][data-i="0"]').isDisabled(), true);
  assert.match(await page.locator('dialog.pd-dialog[open]').innerText(), /Cannot move up/);
  assert.match(await page.locator('dialog.pd-dialog[open]').innerText(), /add a path with Add path to… or remove one/);
  await page.locator('#se-flows-0-cond-mode-field').check();
  await page.locator('#se-flows-0-cond-valueField').fill('reworkLimit');
  await page.locator('#se-flows-0-cond-op').selectOption('lt');
  await page.locator('#se-flows-0-cond-field').fill('reworks');
  await page.locator('#se-save').click();
  const gate = (JSON.parse(await draftText()) as LWProcess.Definition).flows.find(f => f.id === 'review-gate-rework')!;
  assert.deepEqual(gate.when, {field: 'reworks', op: 'lt', valueField: 'reworkLimit'});
  await page.locator('#edit-step').click();
  assert.equal(await page.locator('#se-banner').isVisible(), true);
  assert.equal(await page.locator('#se-flows-0-cond-mode-field').isChecked(), true);
  await page.locator('#se-flows-0-cond-mode-value').check();
  await page.locator('#se-flows-0-cond-field').fill('needsRework');
  await page.locator('#se-flows-0-cond-op').selectOption('eq');
  assert.equal(await page.locator('#se-flows-0-cond-value-type').inputValue(), 'true');
  await page.locator('#se-flows-0-label').fill('Findings to fix');
  await page.locator('[data-act="down"][data-i="0"]').click();
  assert.equal(await page.locator('#se-flows-1-label').inputValue(), 'Findings to fix');
  assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.act), 'up');
  await page.locator('#se-apply').click();
  assert.equal(await page.locator('#se-confirm').isVisible(), true, 'a run past minute 0 asks before it is discarded');
  await page.locator('#se-apply-reset').click();
  assert.equal(await dialogOpen(), 0);
  const applied = await query(page);
  assert.equal(applied.snapshot.minute, 0);
  assert.equal(applied.playing, false);
  assert.equal(applied.definition.revision, before.definition.revision + 1);
  assert.equal(applied.definition.steps[1]!.name, 'Discovery workshop');
  assert.equal(applied.definition.steps[1]!.duration, 20);
  const out = applied.definition.flows.filter(f => f.from === 'review-gate');
  assert.deepEqual(out.map(f => f.to), ['handover', 'rework']);
  assert.deepEqual(out[1]!.when, {field: 'needsRework', op: 'eq', value: true});
  assert.equal(out[1]!.label, 'Findings to fix');
  assert.equal(await page.locator('#message').innerText(), 'Definition applied. New run is paused.');
  // A new revision of the same process keeps the selected step (UX-10), so Edit step stays and takes focus back.
  assert.equal((await query(page)).selected, 'review-gate');
  assert.equal(await activeId(), 'edit-step', 'focus returns to the invoker of the kept step');
 });
 await check('Step editor shows engine diagnostics inline, keeps the draft on Cancel and asks before discarding changes', async () => {
  await freshStudio(); const before = await query(page), original = await draftText();
  await page.locator('[data-step="implementation"]').click(); await page.locator('#edit-step').click();
  assert.equal(await page.locator('#se-status').innerText(), '', 'no problems means no status line');
  assert.equal(await page.locator('#se-duration').getAttribute('aria-invalid'), null);
  await page.locator('#se-duration').fill('');
  assert.match(await page.locator('#se-err-duration').innerText(), /Task duration must be 1 or more/);
  assert.match(await page.locator('#se-status').innerText(), /1 problem in this step/);
  assert.equal(await page.locator('#se-duration').getAttribute('aria-invalid'), 'true');
  assert.equal(await page.locator('#se-apply').isDisabled(), true);
  assert.match(await page.locator('#se-reason').innerText(), /Fix the problems in this step before applying\./);
  assert.equal(await dialogOpen(), 1);
  assert.equal(await draftText(), original, 'a refused apply never writes the draft');
  assert.deepEqual((await query(page)).snapshot, before.snapshot);
  // Empty fields get plain local problems named after their row; the catalog's schema text never reaches the step editor.
  await page.locator('#se-add-need').click();
  assert.match(await page.locator('#se-status').innerText(), /Need 3: Name the field earlier steps must deliver, or remove this row\./);
  await page.locator('#se-status a[data-goto="se-needs-2-field"]').click();
  assert.equal(await activeId(), 'se-needs-2-field');
  await page.locator('[data-act="remove-need"][data-i="2"]').click();
  await page.locator('#se-name').fill(''); assert.match(await page.locator('#se-status').innerText(), /Give the step a name \(1 to 120 characters\)/);
  assert.doesNotMatch(await page.locator('#se-status').innerText(), /String has invalid/); assert.equal(await page.locator('#se-apply').isDisabled(), true);
  await page.locator('#se-status a[data-goto="se-name"]').click();
  assert.equal(await activeId(), 'se-name');
  await page.locator('#se-name').fill('Implementation');
  // Case-field names come with suggestions: needs from fields delivered earlier, values and counters from every known field.
  const listed = (id: string) => page.locator(`#${id} option`).evaluateAll(o => o.map(n => (n as HTMLOptionElement).value));
  assert.equal(await page.locator('#se-needs-0-field').getAttribute('list'), 'se-fields-earlier');
  assert.equal(await page.locator('[data-bind="set.0.key"]').getAttribute('list'), 'se-fields-all');
  assert.deepEqual(await listed('se-fields-earlier'), ['needsRework', 'priority', 'problemFramed', 'requirementsReady', 'techReady']);
  const known = await listed('se-fields-all'); assert.ok(['built', 'verified', 'needsRework', 'problemFramed'].every(n => known.includes(n)), known.join());
  await page.locator('#se-duration').fill('25'); assert.equal(await page.locator('#se-err-duration').innerText(), '');
  await page.locator('[data-bind="set.0.key"]').fill('built'); await page.locator('[data-bind="set.0.key"]').fill('');
  assert.match(await page.locator('#se-err-set').innerText(), /Name the field or remove this row/);
  assert.equal(await page.locator('#se-save').isDisabled(), true);
  assert.match(await page.locator('#se-reason').innerText(), /Fix the highlighted fields/);
  await page.locator('[data-bind="set.0.key"]').fill('built');
  await page.locator('[data-bind="needs.0.field"]').fill('ghostField'); assert.match(await page.locator('#se-err-needs-0').innerText(), /ghostField/);
  await page.locator('[data-bind="needs.0.field"]').press('Escape'); assert.equal(await dialogOpen(), 1);
  assert.equal(await page.locator('#se-confirm').isVisible(), true);
  assert.equal(await page.locator('#se-confirm-title').innerText(), 'Discard your changes to Implementation?');
  assert.equal(await activeId(), 'se-keep');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#se-confirm').isHidden(), true);
  assert.equal(await dialogOpen(), 1);
  assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.bind), 'needs.0.field');
  await page.locator('#se-cancel').click();
  assert.equal(await activeId(), 'se-keep');
  await page.locator('#se-keep').click();
  assert.equal(await activeId(), 'se-cancel');
  assert.equal(await page.locator('[data-bind="needs.0.field"]').inputValue(), 'ghostField');
  await page.locator('#se-save').click(); assert.equal(await dialogOpen(), 0); assert.match(await draftText(), /ghostField/);
  await page.locator('#edit-step').click(); assert.match(await page.locator('#se-err-needs-0').innerText(), /ghostField/);
  await page.locator('#se-cancel').click();
  assert.equal(await dialogOpen(), 0, 'Cancel with no new edits closes at once');
  assert.match(await draftText(), /ghostField/);
  await page.locator('#edit-step').click(); await page.locator('#se-name').fill('Renamed only in the modal'); await page.locator('#se-close').click();
  assert.equal(await page.locator('#se-confirm').isVisible(), true);
  await page.locator('#se-discard').click();
  assert.equal(await dialogOpen(), 0);
  assert.equal(await activeId(), 'edit-step');
  assert.doesNotMatch(await draftText(), /Renamed only/); assert.match(await draftText(), /ghostField/);
  await openDef();
  await restoreDef();
  assert.equal(await draftText(), original);
  await closeDef();
  assert.deepEqual((await query(page)).definition, before.definition);
 });
 await check('Step editor reflows to a full-screen sheet at phone width without horizontal overflow', async () => {
  await freshStudio(); await page.locator('#mode-2d').click(); await page.setViewportSize({width: 390, height: 844}); await nextFrames(page);
  await page.locator('[data-step="review-gate"]').click(); await page.locator('#edit-step').click(); await page.locator('dialog.pd-dialog[open]').waitFor();
  const geometry = await page.evaluate(() => {
   const d = document.querySelector('dialog.pd-dialog[open]') as HTMLElement,
    r = d.getBoundingClientRect(),
    body = d.querySelector('.pd-body') as HTMLElement,
    foot = d.querySelector('.pd-foot')!.getBoundingClientRect(),
    head = d.querySelector('.pd-head')!.getBoundingClientRect();
   const wide = [...d.querySelectorAll<HTMLElement>('input, select, textarea, button')]
    .filter(n => n.getBoundingClientRect().right > r.right + 0.5 || n.getBoundingClientRect().left < r.left - 0.5)
    .map(n => n.id || n.dataset.bind || n.textContent);
   return {
    x: r.x,
    y: r.y,
    w: r.width,
    h: r.height,
    vw: innerWidth,
    vh: innerHeight,
    page: document.documentElement.scrollWidth > innerWidth,
    own: d.scrollWidth > d.clientWidth,
    scrolls: body.scrollHeight > body.clientHeight,
    footBottom: foot.bottom,
    headTop: head.top,
    wide,
    label: parseFloat(getComputedStyle(d.querySelector('label')!).fontSize),
    help: parseFloat(getComputedStyle(d.querySelector('.se-help')!).fontSize),
    input: (d.querySelector('input[type=text]') as HTMLElement).getBoundingClientRect().height
   };
  });
  assert.deepEqual([geometry.x, geometry.y, geometry.w, geometry.h], [0, 0, geometry.vw, geometry.vh]);
  assert.equal(geometry.page, false);
  assert.equal(geometry.own, false);
  assert.deepEqual(geometry.wide, []);
  assert.equal(geometry.scrolls, true);
  assert.equal(geometry.headTop, 0);
  assert.equal(Math.round(geometry.footBottom), geometry.vh);
  assert(geometry.label >= 13 && geometry.help >= 12 && geometry.input >= 44, JSON.stringify(geometry));
  await page.screenshot({path: path.join(OUT, 'process-step-editor-mobile.png')});
  await page.locator('#se-flows-0-label').scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.keyboard.press('Escape'); await page.setViewportSize({width: 1440, height: 1060}); await nextFrames(page);
  await page.locator('#edit-step').click();
  const wide = (await page.locator('dialog.pd-dialog[open]').boundingBox())!;
  assert(wide.width <= 760 && wide.width > 600, 'desktop dialog is a centred sheet, not full screen');
  assert(wide.x > 100);
  await page.screenshot({path: path.join(OUT, 'process-step-editor-desktop.png')}); await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 0);
 });
 await dialogGuardChecks(studio);
 await check('Step editor edits machine and system steps with matching pool kinds, technology and declared outputs', async () => {
  await freshStudio(); const name = 'auto-line.json';
  await page.locator('#file').setInputFiles({name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(autoLine()))});
  await page.waitForFunction(n => document.getElementById('message')!.textContent!.includes('Imported ' + n), name);
  const dlg = page.locator('dialog.pd-dialog[open]'),
   openStep = async (id: string) => {
    await page.locator(`[data-step="${id}"]`).click();
    await page.locator('#edit-step').click();
    await dlg.waitFor();
   };
  await openStep('weld'); assert.equal(await page.locator('#se-chip').innerText(), 'machine'); assert.equal(await page.locator('#se-h-automation').count(), 1);
  assert.equal(await page.locator('#se-technology').inputValue(), 'Robot arm');
  assert.equal(await page.locator('#se-technology-count').innerText(), '9 / 80 characters');
  assert.equal(await dlg.getByLabel('Welding cell').count(), 1);
  assert.equal(await dlg.getByLabel('Operators').count(), 0);
  assert.equal(await dlg.getByLabel('CI runners').count(), 0);
  assert.equal(await page.locator('#se-pools-1-count-help').innerText(), '2 available · 0 = not needed');
  assert.match(await dlg.innerText(), /Machine step duration/);
  await page.locator('#se-technology').fill('Laser welder'); assert.equal(await page.locator('#se-technology-count').innerText(), '12 / 80 characters');
  await page.locator('#se-add-output').click(); assert.equal(await activeId(), 'se-outputs-1-field'); await page.locator('#se-outputs-1-field').fill('checked');
  assert.match(await page.locator('#se-err-outputs-1').innerText(), /does not deliver it/);
  assert.equal(await page.locator('#se-outputs-1-field').getAttribute('aria-invalid'), 'true');
  assert.equal(await page.locator('#se-err-outputs-1 .se-err').count(), 1, 'one problem per field');
  await page.locator('#se-status a[data-goto="se-outputs-1-field"]').click();
  assert.equal(await activeId(), 'se-outputs-1-field');
  await page.locator('#se-add-add').click();
  await page.locator('[data-bind="add.0.key"]').fill('checked');
  assert.equal(await page.locator('#se-err-outputs-1').innerText(), '');
  assert.equal(await page.locator('#se-outputs-1-field').getAttribute('aria-invalid'), null);
  await page.locator('#se-outputs-1-label').fill('Checks passed'); await page.locator('#se-save').click(); assert.equal(await dialogOpen(), 0);
  const saved = (JSON.parse(await draftText()) as LWProcess.Definition).steps.find(s => s.id === 'weld')!;
  assert.equal(saved.technology, 'Laser welder');
  assert.deepEqual(saved.outputs, [{field: 'welded', label: 'Welded part'}, {field: 'checked', label: 'Checks passed'}]);
  assert.deepEqual(saved.add, {checked: 1});
  assert.deepEqual(saved.resources, {welding: 1});
  await openStep('prep');
  assert.equal(await page.locator('#se-chip').innerText(), 'task');
  assert.equal(await page.locator('#se-h-automation').count(), 0);
  assert.equal(await page.locator('#se-technology').count(), 0);
  assert.equal(await dlg.getByLabel('Operators').count(), 1);
  assert.equal(await dlg.getByLabel('Welding cell').count(), 0);
  assert.equal(await dlg.getByLabel('CI runners').count(), 0);
  assert.equal(await page.locator('#se-h-outputs').count(), 1);
  await page.locator('#se-close').click(); assert.equal(await dialogOpen(), 0);
  await openStep('verify');
  assert.equal(await page.locator('#se-chip').innerText(), 'system');
  assert.equal(await page.locator('#se-technology').inputValue(), 'CI pipeline');
  assert.equal(await dlg.getByLabel('CI runners').count(), 1);
  assert.equal(await dlg.getByLabel('Operators').count(), 0);
  assert.equal(await dlg.getByLabel('Welding cell').count(), 0);
  await page.locator('#se-close').click();
  // A pool of the wrong kind is shown with its problem, and a missing kind is explained.
  const broken = autoLine(); broken.resources[1]!.kind = 'people'; await openDef(); await page.locator('#draft').fill(JSON.stringify(broken)); await closeDef();
  await openStep('weld'); assert.match(await page.locator('#se-no-pools').innerText(), /Add a machine pool in the Definition editor/);
  assert.equal(await page.locator('#se-pools-1-count').getAttribute('aria-invalid'), 'true');
  assert.match(await page.locator('#se-err-pools-1').innerText(), /Welding cell is a people pool, but machine steps may use only machine pools/);
  await page.locator('#se-close').click(); assert.equal(await dialogOpen(), 0);
 });
 await check('Step editor confirms before applying over a run in progress and links errors to their fields', async () => {
  await freshStudio(); await page.locator('#advance').click(); const before = await query(page); assert.equal(before.snapshot.minute, 30);
  await page.locator('[data-step="discovery"]').click();
  await page.locator('#edit-step').click();
  await page.locator('#se-duration').fill('20');
  await page.locator('#se-apply').click();
  assert.equal(await page.locator('#se-confirm').isVisible(), true);
  assert.match(
   await page.locator('#se-confirm-title').innerText(),
   /^Applying starts a fresh paused run and discards minute 30 \(\d+ cases?\)\. Export the run report first if you need it\.$/
  );
  assert.equal(await activeId(), 'se-back');
  assert.equal(await page.locator('#se-apply-reset').innerText(), 'Apply and reset');
  assert.deepEqual((await query(page)).definition, before.definition);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#se-confirm').isHidden(), true);
  assert.equal(await dialogOpen(), 1);
  assert.equal((await query(page)).snapshot.minute, 30);
  await page.locator('#se-apply').click(); await page.locator('#se-apply-reset').click(); assert.equal(await dialogOpen(), 0);
  const applied = await query(page); assert.equal(applied.snapshot.minute, 0); assert.equal(applied.definition.steps[1]!.duration, 20);
  assert.deepEqual([applied.selected, await activeId()], ['discovery', 'edit-step'], 'the selection survives the apply and focus returns to Edit step');
  // Errors link to fields, each field shows one problem, and problems elsewhere in the draft are listed with names.
  await openDef();
  const raw = JSON.parse(await draftText()) as LWProcess.Definition;
  delete raw.steps[1]!.duration;
  await page.locator('#draft').fill(JSON.stringify(raw));
  await closeDef();
  await page.locator('[data-step="implementation"]').click(); await page.locator('#edit-step').click(); await page.locator('#se-duration').fill('');
  assert.equal(await page.locator('#se-err-duration .se-err').count(), 1);
  assert.equal(await page.locator('#se-duration').getAttribute('aria-invalid'), 'true');
  await page.locator('#se-status a[data-goto="se-duration"]').click(); assert.equal(await activeId(), 'se-duration');
  const elsewhere = await page.locator('#se-status').innerText();
  assert.match(elsewhere, /1 problem in this step/);
  assert.match(elsewhere, /Task duration must be 1 or more/);
  assert.match(elsewhere, /Elsewhere in the draft \(1\)/);
  assert.match(elsewhere, /Discovery › duration/);
  assert.match(elsewhere, /Definition editor/);
  await page.locator('#se-add-set').click();
  await page.locator('[data-bind="set.1.key"]').fill('');
  assert.equal(await page.locator('[data-bind="set.1.key"]').getAttribute('aria-invalid'), 'true');
  assert.match(await page.locator('#se-status').innerText(), /Value 2: Name the field or remove this row/);
  await page.locator('[data-bind="set.1.key"]').fill('extra');
  await page.locator('#se-duration').fill('25');
  assert.doesNotMatch(await page.locator('#se-status').innerText(), /in this step/);
  await page.locator('#se-apply').click();
  assert.equal(await page.locator('#se-apply-errors').isVisible(), true);
  assert.match(await page.locator('#se-apply-errors').innerText(), /Discovery › duration/);
  assert.equal(await dialogOpen(), 1);
  await page.locator('#se-cancel').click(); await page.locator('#se-discard').click(); assert.equal(await dialogOpen(), 0);
  // An unparseable draft cannot be edited as a step: Edit step opens the Definition editor on the JSON syntax error instead.
  await openDef(); await page.locator('#draft').fill('{bad'); await closeDef(); await page.locator('#edit-step').click();
  assert.equal(await dialogOpen(), 1);
  assert.equal(await page.locator('#de-title').isVisible(), true);
  assert.equal(await page.locator('#se-title').isVisible(), false);
  assert.match(await page.locator('#draft-state').innerText(), /Invalid JSON: line 1, column 2/);
  await restoreDef(); await closeDef();
 });
 await randomChecks(studio);
 await branchingChecks(studio);
 await stepNavigationChecks(studio);
 await structureChecks(studio);
 await checkLifecycle('Process step editor browser lifecycle emits no runtime errors or network requests');
});
