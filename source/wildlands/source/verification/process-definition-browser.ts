/// <reference path="../process-contracts.d.ts" />
/**
 * Process Studio Definition editor suite entry: the modal and its Apply, restoring and applying over a run in progress, the phone
 * sheet, routing from the step editor, undo and redo, and a poisoned draft. Companion modules own the Tune values arrivals and
 * random distributions, the raw JSON pane, the journey and SIPOC fields, the calendar and the inspector; the entry calls them in
 * the original check order.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {nextFrames} from './browser-harness';
import {query, OUT, runSuite} from './process-browser-fixture';
import {calendarChecks} from './process-definition-calendar-checks';
import {inspectorChecks} from './process-definition-inspector-checks';
import {arrivalChecks, distributionChecks} from './process-definition-arrival-checks';
import {rawJsonChecks} from './process-definition-json-checks';
import {journeyChecks} from './process-definition-journey-checks';
runSuite('process definition editor browser harness', 'process-definition-browser-results.json', async studio => {
 const {page, dir, check, checkLifecycle, freshStudio, defOpen, openDef, closeDef} = studio;
 const {restoreDef, draftText, defOf, inSync, dialogOpen, activeId, pasteDraft} = studio;
 await check('Definition editor opens as a modal from the header, pauses the run and applies a fresh paused run', async () => {
  await page.setViewportSize({width: 1440, height: 1060});
  await freshStudio();
  const opener = page.locator('#open-definition');
  assert.equal(await opener.innerText(), 'Edit process…'); assert.equal(await opener.getAttribute('aria-haspopup'), 'dialog');
  assert.equal(
   await page.evaluate(() => {
    const a = document.querySelector('.process-file-actions')!, kids = [...a.children].map(c => c.id);
    return kids.indexOf('open-definition') >= 0 && kids.indexOf('open-definition') < kids.indexOf('import');
   }),
   true,
   'the opener sits in the header actions before Import'
  );
  assert.equal(await page.locator('#show-definition').count() + await page.locator('#editor').count(), 0, 'the bottom Definition tab and panel are gone');
  assert.equal(await page.locator('#draft-chip').isHidden(), true);
  const before = await query(page); await page.locator('#horizon').selectOption('1440'); await page.locator('#play').click();
  await page.waitForFunction(
   () => (globalThis as unknown as {LWProcessStudio: {query(): {snapshot: {minute: number}}}}).LWProcessStudio.query().snapshot.minute > 0
  );
  await opener.focus(); await page.keyboard.press('Enter'); await defOpen.waitFor();
  assert.equal(await page.evaluate(() => document.querySelector('dialog.de-dialog')!.matches(':modal')), true);
  assert.equal(await page.getByRole('dialog', {name: 'Definition editor'}).count(), 1);
  assert.equal(await page.locator('#de-title').innerText(), 'Definition editor');
  assert.equal(
   await page.locator('#de-subtitle').innerText(),
   `${before.definition.name} · revision ${before.definition.revision} · The run is paused while this window is open`
  );
  assert.equal(await page.locator('#de-chip').isHidden(), true);
  assert.equal(await activeId(), 'tune-name');
  assert.equal(await page.locator('#de-sync').innerText(), 'Form in sync');
  assert.equal(await page.locator('#de-apply').isDisabled(), true, 'a draft that holds the running definition has nothing to apply');
  assert.match(await page.locator('#de-reason').innerText(), /Nothing to apply: the draft holds the running definition\. Use Reset run to restart the run\./);
  const frozen = await query(page);
  assert.equal(frozen.playing, false);
  await nextFrames(page, 45);
  assert.equal((await query(page)).snapshot.minute, frozen.snapshot.minute, 'nothing ticks while the editor is open');
  await assert.rejects(page.locator('#play').click({timeout: 700}), 'the page behind the modal is inert');
  assert.equal(
   await page.evaluate(
    () =>
     ['de-form-h', 'de-json-h'].every(id => document.getElementById(id)!.tagName === 'H3') &&
     document.querySelectorAll('dialog.de-dialog section[aria-labelledby]').length >= 2 &&
     document.getElementById('draft-state')!.getAttribute('role') === 'status'
   ),
   true
  );
  await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 0); assert.equal(await activeId(), 'open-definition');
  await opener.click();
  await page.locator('#tune-name').fill('Renamed by the form');
  assert.equal(await page.locator('#de-chip').innerText(), 'Unapplied draft');
  await page.locator('#de-close').click(); assert.equal(await dialogOpen(), 0); assert.equal(await activeId(), 'open-definition');
  assert.equal(await page.locator('#draft-chip').innerText(), 'Unapplied draft · 1 process setting changed');
  assert.equal((await query(page)).definition.name, before.definition.name, 'the running definition is untouched until Apply');
  await page.locator('#draft-chip').click();
  await defOpen.waitFor();
  await page.locator('#de-validate').click();
  assert.equal(await page.locator('#de-message').innerText(), 'Valid definition. Applying starts a fresh paused run.');
  await page.locator('#de-apply').click();
  assert.equal(await page.locator('#de-confirm').isVisible(), true, 'a run past minute 0 asks first');
  await page.locator('#de-back').click();
  await page.locator('#de-close').click();
  await page.locator('#reset').click();
  await page.locator('#open-definition').click();
  await defOpen.waitFor();
  await page.locator('#de-apply').click();
  await defOpen.waitFor({state: 'hidden'});
  const applied = await query(page);
  assert.equal(applied.definition.name, 'Renamed by the form');
  assert.equal(applied.definition.revision, before.definition.revision + 1);
  assert.equal(applied.snapshot.minute, 0);
  assert.equal(applied.playing, false);
  assert.equal(await page.locator('#draft-chip').isHidden(), true);
  assert.equal(await activeId(), 'open-definition');
  assert.match(await page.locator('#message').innerText(), /Definition applied\. New run is paused\./);
 });
 await arrivalChecks(studio);
 await rawJsonChecks(studio);
 await check('Definition editor asks before restoring or applying over a run in progress', async () => {
  await page.setViewportSize({width: 1440, height: 1060});
  await freshStudio(); await page.locator('#advance').click(); const before = await query(page); assert.equal(before.snapshot.minute, 30);
  await openDef();
  assert.equal(await page.locator('#de-restore').isDisabled(), true);
  assert.match(await page.locator('#de-reason').innerText(), /Restore is unavailable while the draft matches/);
  await page.locator('#tune-name').fill('Edited while running');
  assert.equal(await page.locator('#de-restore').isDisabled(), false);
  const edited = await draftText();
  await page.locator('#de-restore').click();
  assert.equal(await page.locator('#de-confirm').isVisible(), true);
  assert.equal(await page.locator('#de-confirm-title').innerText(), 'Replace the draft with the running definition?');
  assert.deepEqual(await page.locator('#de-choices button').allInnerTexts(), ['Download draft first', 'Restore', 'Keep draft']);
  assert.equal(await activeId(), 'de-keep');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#de-confirm').isHidden(), true);
  assert.equal(await dialogOpen(), 1);
  assert.equal(await draftText(), edited);
  assert.equal(await activeId(), 'de-restore');
  await page.locator('#de-restore').click();
  const pending = page.waitForEvent('download');
  await page.locator('#de-download-first').click();
  const saved = await pending;
  const file2 = path.join(dir, 'before-restore.json');
  await saved.saveAs(file2);
  assert.equal(fs.readFileSync(file2, 'utf8'), edited);
  assert.equal(await draftText(), edited, 'downloading does not restore');
  await page.locator('#de-restore').click();
  await page.locator('#de-keep').click();
  assert.equal(await draftText(), edited);
  await restoreDef();
  assert.equal(await draftText(), JSON.stringify(before.definition, null, 2));
  assert.equal(await page.locator('#de-message').innerText(), 'Draft restored from the running definition.');
  assert.equal(await page.locator('#de-restore').isDisabled(), true);
  // Reformatted text of the same definition is a different draft text but nothing to apply: no reset and no revision bump.
  await pasteDraft(JSON.stringify(before.definition));
  assert.equal(await page.locator('#de-restore').isEnabled(), true);
  assert.equal(await page.locator('#de-apply').isDisabled(), true);
  assert.match(await page.locator('#de-reason').innerText(), /Nothing to apply/);
  assert.equal((await query(page)).definition.revision, before.definition.revision);
  // Applying past minute 0 names the minute that is discarded.
  await page.locator('#draft').fill('{bad');
  await page.locator('#de-apply').click();
  assert.equal(await page.locator('#de-status').getAttribute('role'), 'alert');
  assert.equal(await page.locator('#de-confirm').isHidden(), true, 'an invalid draft is refused before asking');
  assert.equal((await query(page)).snapshot.minute, 30);
  await page.locator('#tune-name').count();
  await restoreDef();
  await page.locator('#tune-name').fill('Applied over a run');
  await page.locator('#de-apply').click();
  assert.match(
   await page.locator('#de-confirm-title').innerText(),
   /^Applying starts a fresh paused run and discards minute 30 \(\d+ cases?\)\. Export the run report first if you need it\.$/
  );
  assert.equal(await activeId(), 'de-back');
  assert.equal(await page.locator('#de-apply-reset').innerText(), 'Apply and reset');
  assert.deepEqual((await query(page)).definition, before.definition);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#de-confirm').isHidden(), true);
  assert.equal(await dialogOpen(), 1);
  assert.equal((await query(page)).snapshot.minute, 30);
  await page.locator('#de-apply').click(); await page.locator('#de-back').click(); assert.equal((await query(page)).snapshot.minute, 30);
  await page.locator('#de-apply').click(); await page.locator('#de-apply-reset').click(); await defOpen.waitFor({state: 'hidden'});
  const after = await query(page);
  assert.equal(after.snapshot.minute, 0);
  assert.equal(after.definition.name, 'Applied over a run');
  assert.equal(after.definition.revision, before.definition.revision + 1);
  assert.equal(await activeId(), 'open-definition');
 });
 await check('Definition editor reflows to a full sheet at phone width without horizontal overflow', async () => {
  await page.setViewportSize({width: 1440, height: 1060});
  await freshStudio();
  await page.setViewportSize({width: 390, height: 844});
  await nextFrames(page);
  await page.locator('#open-definition').click();
  await defOpen.waitFor();
  const geometry = await page.evaluate(() => {
   const d = document.querySelector('dialog.de-dialog') as HTMLElement,
    r = d.getBoundingClientRect(),
    foot = d.querySelector('.pd-foot')!.getBoundingClientRect(),
    head = d.querySelector('.pd-head')!.getBoundingClientRect(),
    visible = (n: Element) => n.getClientRects().length > 0;
   const wide = [...d.querySelectorAll<HTMLElement>('input, select, textarea, button')]
    .filter(n => visible(n) && (n.getBoundingClientRect().right > r.right + 0.5 || n.getBoundingClientRect().left < r.left - 0.5))
    .map(n => n.id || n.textContent);
   const small = [...d.querySelectorAll<HTMLElement>('input[type=text], input[type=number], select, textarea, button')]
    .filter(n => visible(n) && n.getBoundingClientRect().height < 43.5)
    .map(n => n.id || n.textContent);
   return {
    x: r.x,
    y: r.y,
    w: r.width,
    h: r.height,
    vw: innerWidth,
    vh: innerHeight,
    page: document.documentElement.scrollWidth > innerWidth,
    own: d.scrollWidth > d.clientWidth,
    footBottom: foot.bottom,
    headTop: head.top,
    wide,
    small,
    tabs: visible(d.querySelector('.de-tabs')!),
    form: visible(d.querySelector('#de-pane-form')!),
    json: visible(d.querySelector('#de-pane-json')!)
   };
  });
  assert.deepEqual([geometry.x, geometry.y, geometry.w, geometry.h], [0, 0, geometry.vw, geometry.vh]);
  assert.equal(geometry.page, false);
  assert.equal(geometry.own, false);
  assert.deepEqual(geometry.wide, []);
  assert.deepEqual(geometry.small, [], 'touch targets are 44px');
  assert.equal(geometry.headTop, 0);
  assert.equal(Math.round(geometry.footBottom), geometry.vh);
  assert.deepEqual([geometry.tabs, geometry.form, geometry.json], [true, true, false]);
  await page.locator('#tune-arr-0').scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({path: path.join(OUT, 'process-definition-mobile-form.png')});
  await page.locator('#de-tab-json').click();
  assert.equal(await page.locator('#de-pane-json').isVisible(), true);
  assert.equal(await page.locator('#de-pane-form').isVisible(), false);
  assert.equal(await page.locator('#de-tab-json').getAttribute('aria-pressed'), 'true');
  assert((await page.locator('#draft').boundingBox())!.height >= 320);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({path: path.join(OUT, 'process-definition-mobile-json.png')});
  await page.setViewportSize({width: 800, height: 900});
  await nextFrames(page);
  assert.equal(await page.locator('.de-tabs').isVisible(), true, 'tabs below 1000px');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.setViewportSize({width: 1440, height: 1060}); await nextFrames(page);
  const columns = await page.evaluate(() => {
   const f = document.getElementById('de-pane-form')!.getBoundingClientRect(),
    j = document.getElementById('de-pane-json')!.getBoundingClientRect(),
    d = document.querySelector('dialog.de-dialog')!.getBoundingClientRect();
   return {tabs: document.querySelector('.de-tabs')!.getClientRects().length, fx: f.x, jx: j.x, fw: f.width, jw: j.width, dw: d.width};
  });
  assert.equal(columns.tabs, 0);
  assert(columns.fx < columns.jx && columns.fw > 300 && columns.jw > 300);
  assert(columns.dw <= 1000 && columns.dw > 900);
  await page.screenshot({path: path.join(OUT, 'process-definition-desktop.png')});
  await page.keyboard.press('Escape');
  assert.equal(await dialogOpen(), 0);
 });
 await check('Step editor routes to the Definition editor for an invalid draft', async () => {
  await page.setViewportSize({width: 1440, height: 1060});
  await freshStudio(); await openDef(); await page.locator('#draft').fill('{bad'); await closeDef(); await page.locator('[data-step="discovery"]').click();
  await page.locator('#edit-step').click();
  await defOpen.waitFor();
  assert.equal(await dialogOpen(), 1);
  assert.equal(await page.locator('#se-title').isVisible(), false);
  assert.equal(await activeId(), 'draft');
  assert.match(await page.locator('#draft-state').innerText(), /^Invalid JSON: line 1, column 2/);
  assert.equal(await page.evaluate(() => (document.getElementById('draft') as HTMLTextAreaElement).selectionStart), 1);
  await page.keyboard.press('Escape');
  assert.equal(await dialogOpen(), 0);
  assert.equal(await activeId(), 'edit-step', 'focus returns to the button that was used');
  await openDef();
  await restoreDef();
  await closeDef();
  // A valid draft with problems elsewhere: the step editor's link closes it and opens the Definition editor on the problem.
  await openDef(); const raw = await defOf(); delete raw.steps[1]!.duration; await page.locator('#draft').fill(JSON.stringify(raw)); await closeDef();
  await page.locator('[data-step="implementation"]').click();
  await page.locator('#edit-step').click();
  await page.locator('#se-name').waitFor();
  await page.locator('#se-status [data-act="open-definition"]').click();
  await defOpen.waitFor();
  assert.equal(await dialogOpen(), 1, 'one modal at a time');
  assert.equal(await page.locator('#se-title').isVisible(), false);
  assert.equal(await activeId(), 'draft');
  assert.match(await page.locator('#diagnostics').innerText(), /Discovery › duration/);
  await page.keyboard.press('Escape'); assert.equal(await activeId(), 'open-definition'); assert.equal(await dialogOpen(), 0);
  // A step editor with unsaved edits asks first; keeping them keeps the step editor, discarding opens the Definition editor.
  await page.locator('#edit-step').click();
  await page.locator('#se-name').fill('Unsaved rename');
  await page.locator('#se-status [data-act="open-definition"]').click();
  assert.equal(await page.locator('#se-confirm').isVisible(), true);
  await page.locator('#se-keep').click();
  assert.equal(await dialogOpen(), 1);
  assert.equal(await page.locator('#se-title').isVisible(), true);
  assert.equal(await page.locator('#se-name').inputValue(), 'Unsaved rename');
  await page.locator('#se-status [data-act="open-definition"]').click();
  assert.equal(await page.locator('#se-confirm-title').innerText(), 'Open the Definition editor? Your changes to Unsaved rename are not in the draft yet.');
  assert.deepEqual(await page.locator('#se-choices button').allInnerTexts(), ['Keep editing', 'Save to draft and open', 'Discard changes']);
  assert.equal(await activeId(), 'se-keep');
  await page.locator('#se-discard').click();
  await defOpen.waitFor();
  assert.equal(await dialogOpen(), 1);
  assert.doesNotMatch(await draftText(), /Unsaved rename/);
  await closeDef();
  // Save to draft and open keeps the edits: they are in the draft the Definition editor shows.
  await page.locator('#edit-step').click();
  await page.locator('#se-name').fill('Saved rename');
  await page.locator('#se-status [data-act="open-definition"]').click();
  assert.equal(await activeId(), 'se-keep'); await page.locator('#se-save-open').click(); await defOpen.waitFor(); assert.equal(await dialogOpen(), 1);
  assert.equal((await defOf()).steps.find(s => s.id === 'implementation')!.name, 'Saved rename');
  await restoreDef(); await closeDef();
 });
 await journeyChecks(studio);
 await distributionChecks(studio);
 await check('Definition editor undoes and redoes draft edits with Ctrl+Z and offers Undo after a removed row', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await freshStudio(); await page.locator('#open-definition').click(); await defOpen.waitFor();
  const original = await draftText(), name = async () => (await defOf()).name, arrivals = async () => (await defOf()).arrivals.length;
  const count = await arrivals(); assert(count >= 2, 'the agency process has two arrival streams');
  await page.locator('#tune-name').fill('Undo me'); assert.equal(await name(), 'Undo me');
  // A removed row is announced with an Undo button; Undo brings the row back and keeps the earlier rename.
  await page.locator('[data-act="arr-remove"]').last().click(); assert.equal(await arrivals(), count - 1);
  assert.equal(await page.locator('#de-message').innerText(), `Removed arrival ${count}. Undo`); await page.locator('#de-undo').click();
  assert.equal(await arrivals(), count); assert.equal(await name(), 'Undo me'); assert.match(await page.locator('#de-message').innerText(), /^Undone\./);
  assert.equal(await activeId(), 'de-form-h'); assert.equal(await page.locator('#de-undo').count(), 0);
  // Outside the JSON text the shortcut steps through the draft: undo the rename, then redo it and the removal.
  await page.locator('#tune-seed').focus();
  await page.keyboard.press('ControlOrMeta+Z');
  assert.equal(await draftText(), original);
  assert.equal(await page.locator('#tune-name').inputValue(), (await query(page)).definition.name);
  await page.keyboard.press('ControlOrMeta+Z');
  assert.equal(await page.locator('#de-message').innerText(), 'Nothing to undo.');
  assert.equal(await draftText(), original);
  await page.keyboard.press('ControlOrMeta+Shift+Z'); assert.equal(await name(), 'Undo me'); assert.equal(await arrivals(), count);
  await page.keyboard.press('ControlOrMeta+Shift+Z');
  assert.equal(await arrivals(), count - 1);
  assert.equal(await page.locator('#de-message').innerText(), 'Redone. Ctrl+Z (Cmd+Z on a Mac) undoes it again.');
  await page.keyboard.press('ControlOrMeta+Shift+Z'); assert.equal(await page.locator('#de-message').innerText(), 'Nothing to redo.');
  // A new edit after undo starts a new branch: redo has nothing left.
  await page.keyboard.press('ControlOrMeta+Z');
  await page.locator('#tune-seed').fill('9');
  await page.keyboard.press('ControlOrMeta+Shift+Z');
  assert.equal(await page.locator('#de-message').innerText(), 'Nothing to redo.');
  await restoreDef(); await closeDef();
 });
 await check('A poisoned draft opened in Tune values or the step editor creates no element and runs no handler', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await freshStudio(); await openDef();
  // The draft is only shape-checked JSON, so a number field can hold any text a person pastes.
  const payload = '"><img src=x onerror="globalThis.__pwned = (globalThis.__pwned || 0) + 1">';
  const poisoned = await defOf() as unknown as Record<string, any>;
  poisoned.resources[0].capacity = payload; poisoned.arrivals[0].at = payload; poisoned.seed = payload;
  // Names, descriptions, field names, pool names and arrival data hold the same text; every view must show it as text.
  poisoned.name = payload; poisoned.description = payload; poisoned.resources[0].name = payload; poisoned.arrivals[0].data[payload] = 1;
  poisoned.arrivals[0].data.note = payload; poisoned.arrivals[0].draws = [{field: payload, kind: 'chance', percent: 50}];
  poisoned.track = [{field: payload, label: payload}]; poisoned.sipoc = {suppliers: [{name: payload, supplies: payload}]};
  await pasteDraft(JSON.stringify(poisoned, null, 2)); await inSync();
  const dialogImages = () => page.locator('dialog.pd-dialog img').count(), pwned = () => page.evaluate(() => (globalThis as any).__pwned);
  assert.equal(await dialogImages(), 0); assert.equal(await pwned(), undefined);
  for (const id of ['tune-res-0-cap', 'tune-arr-0-at', 'tune-seed']) assert.equal(await page.locator('#' + id).inputValue(), '', id + ' shows no value');
  const named = ['tune-name', 'tune-desc', 'tune-res-0-name', 'tune-arr-0-draw-0-field', 'tune-track-0-field', 'tune-track-0-label',
   'tune-sipoc-suppliers-0-name'];
  for (const id of named) {
   assert.equal(await page.locator('#' + id).inputValue(), payload, id + ' holds the pasted text as its value');
  }
  assert.equal(await page.locator('#tune-res-0 legend').innerText(), `${payload} ${poisoned.resources[0].id}`);
  const badName = /Field "".*<img src=x onerror=.*" has characters the form cannot edit/;
  assert.match(await page.locator('#tune-arr-0').innerText(), badName, 'a bad field name is shown as text');
  assert.equal(await page.locator('[data-act="data-remove"][data-name="note"]').count(), 1, 'the value of a field is a control value, not markup');
  assert.equal(await page.locator('#tune-res-0-cap').getAttribute('max'), '1000');
  assert.match(await page.locator('#diagnostics').innerText(), /Expected integer/);
  await closeDef(); await page.locator('[data-step="discovery"]').click(); await page.locator('#edit-step').click(); await page.locator('#se-name').waitFor();
  assert.equal(await dialogImages(), 0);
  assert.equal(await page.locator('#se-pools-0-count').getAttribute('max'), null, 'a capacity that is not a number is not written as a bound');
  assert.match(await page.locator('#se-pools-0-count-help').innerText(), /<img src=x/); await nextFrames(page); assert.equal(await pwned(), undefined);
  await page.locator('#se-close').click(); await openDef(); await restoreDef(); await closeDef();
 });
 await calendarChecks(studio);
 await inspectorChecks(studio);
 await checkLifecycle('Process definition editor browser lifecycle emits no runtime errors or network requests');
});
