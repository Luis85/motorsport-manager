/// <reference path="../process-contracts.d.ts" />
/** Process Studio Definition editor: form and raw JSON, arrivals, touchpoints, process type, tracked measures and SIPOC parties. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {nextFrames} from './browser-harness';
import {query, OUT, runSuite} from './process-browser-fixture';
import {calendarChecks} from './process-definition-calendar-checks';
import {inspectorChecks} from './process-definition-inspector-checks';
runSuite('process definition editor browser harness', 'process-definition-browser-results.json', async studio => {
 const {page, diagnostics, dir, check, checkLifecycle, freshStudio, defOpen, openDef, closeDef, restoreDef, applyDef, draftText, defOf, inSync, dialogOpen, activeId, importFeed, importRandom, openRandom, savedStep, importJourney, pasteDraft} = studio;
 await check('Definition editor opens as a modal from the header, pauses the run and applies a fresh paused run', async () => {
  await page.setViewportSize({width: 1440, height: 1060});
  await freshStudio();
  const opener = page.locator('#open-definition');
  assert.equal(await opener.innerText(), 'Edit process…'); assert.equal(await opener.getAttribute('aria-haspopup'), 'dialog');
  assert.equal(await page.evaluate(() => { const a = document.querySelector('.process-file-actions')!, kids = [...a.children].map(c => c.id); return kids.indexOf('open-definition') >= 0 && kids.indexOf('open-definition') < kids.indexOf('import'); }), true, 'the opener sits in the header actions before Import');
  assert.equal(await page.locator('#show-definition').count() + await page.locator('#editor').count(), 0, 'the bottom Definition tab and panel are gone'); assert.equal(await page.locator('#draft-chip').isHidden(), true);
  const before = await query(page); await page.locator('#horizon').selectOption('1440'); await page.locator('#play').click();
  await page.waitForFunction(() => (globalThis as unknown as {LWProcessStudio: {query(): {snapshot: {minute: number}}}}).LWProcessStudio.query().snapshot.minute > 0);
  await opener.focus(); await page.keyboard.press('Enter'); await defOpen.waitFor();
  assert.equal(await page.evaluate(() => document.querySelector('dialog.de-dialog')!.matches(':modal')), true); assert.equal(await page.getByRole('dialog', {name: 'Definition editor'}).count(), 1);
  assert.equal(await page.locator('#de-title').innerText(), 'Definition editor'); assert.equal(await page.locator('#de-subtitle').innerText(), `${before.definition.name} · revision ${before.definition.revision} · The run is paused while this window is open`);
  assert.equal(await page.locator('#de-chip').isHidden(), true); assert.equal(await activeId(), 'tune-name'); assert.equal(await page.locator('#de-sync').innerText(), 'Form in sync');
  assert.equal(await page.locator('#de-apply').isDisabled(), true, 'a draft that holds the running definition has nothing to apply');
  assert.match(await page.locator('#de-reason').innerText(), /Nothing to apply: the draft holds the running definition\. Use Reset run to restart the run\./);
  const frozen = await query(page); assert.equal(frozen.playing, false); await nextFrames(page, 45); assert.equal((await query(page)).snapshot.minute, frozen.snapshot.minute, 'nothing ticks while the editor is open');
  await assert.rejects(page.locator('#play').click({timeout: 700}), 'the page behind the modal is inert');
  assert.equal(await page.evaluate(() => ['de-form-h', 'de-json-h'].every(id => document.getElementById(id)!.tagName === 'H3') && document.querySelectorAll('dialog.de-dialog section[aria-labelledby]').length >= 2 && document.getElementById('draft-state')!.getAttribute('role') === 'status'), true);
  await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 0); assert.equal(await activeId(), 'open-definition');
  await opener.click(); await page.locator('#tune-name').fill('Renamed by the form'); assert.equal(await page.locator('#de-chip').innerText(), 'Unapplied draft');
  await page.locator('#de-close').click(); assert.equal(await dialogOpen(), 0); assert.equal(await activeId(), 'open-definition');
  assert.equal(await page.locator('#draft-chip').innerText(), 'Unapplied draft · 1 process setting changed'); assert.equal((await query(page)).definition.name, before.definition.name, 'the running definition is untouched until Apply');
  await page.locator('#draft-chip').click(); await defOpen.waitFor(); await page.locator('#de-validate').click(); assert.equal(await page.locator('#de-message').innerText(), 'Valid definition. Applying starts a fresh paused run.');
  await page.locator('#de-apply').click(); assert.equal(await page.locator('#de-confirm').isVisible(), true, 'a run past minute 0 asks first'); await page.locator('#de-back').click(); await page.locator('#de-close').click();
  await page.locator('#reset').click(); await page.locator('#open-definition').click(); await defOpen.waitFor(); await page.locator('#de-apply').click(); await defOpen.waitFor({state: 'hidden'});
  const applied = await query(page); assert.equal(applied.definition.name, 'Renamed by the form'); assert.equal(applied.definition.revision, before.definition.revision + 1); assert.equal(applied.snapshot.minute, 0); assert.equal(applied.playing, false);
  assert.equal(await page.locator('#draft-chip').isHidden(), true); assert.equal(await activeId(), 'open-definition'); assert.match(await page.locator('#message').innerText(), /Definition applied\. New run is paused\./);
 });
 await check('Definition editor edits seed, resource kinds and arrival end rules, gaps and draws with inline problems', async () => {
  await page.setViewportSize({width: 1440, height: 1060});
  await freshStudio(); await openDef(); const seed = page.locator('#tune-seed'), arr = (id: string) => page.locator('#tune-arr-0-' + id), pool = page.locator('#tune-res-0-kind');
  assert.match(await page.locator('#tune-seed-help').innerText(), /Same seed, same run\. Change it to see another scenario/); assert.equal(await page.locator('label[for="tune-seed"]').innerText(), 'Seed');
  await seed.fill('42'); assert.equal((await defOf()).seed, 42); await seed.fill('1.5'); assert.equal((await defOf()).seed, 42, 'a fraction is not written');
  assert.match(await page.locator('#tune-seed-err').innerText(), /whole number/); assert.equal(await seed.getAttribute('aria-invalid'), 'true');
  await seed.fill('2147483648'); assert.match(await page.locator('#tune-seed-err').innerText(), /from 0 to 2,147,483,647/); assert.equal(await seed.getAttribute('aria-invalid'), 'true'); await inSync();
  await seed.fill('7'); assert.equal(await page.locator('#tune-seed-err').innerText(), ''); assert.equal(await seed.getAttribute('aria-invalid'), null); await seed.fill(''); assert.equal(Object.hasOwn(await defOf(), 'seed'), false);
  // Resource kind: written only when it is not people; the engine's own diagnostics speak.
  assert.equal(Object.hasOwn((await defOf()).resources[0]!, 'kind'), false); assert.deepEqual(await page.locator('#tune-res-0-kind option').allInnerTexts(), ['People', 'Machine', 'System']);
  await pool.selectOption('machine'); assert.equal((await defOf()).resources[0]!.kind, 'machine'); assert.match(await page.locator('#tune-res-0-kind-err').innerText(), /may demand only people pools/); assert.equal(await pool.getAttribute('aria-invalid'), 'true');
  assert.match(await page.locator('#diagnostics').innerText(), /may demand only people pools/); await pool.selectOption('system'); assert.equal((await defOf()).resources[0]!.kind, 'system');
  await pool.selectOption('people'); assert.equal(Object.hasOwn((await defOf()).resources[0]!, 'kind'), false); assert.equal(await page.locator('#diagnostics li').count(), 0);
  await page.locator('#tune-res-0-cap').fill('0'); assert.equal(await page.locator('#tune-res-0-cap').getAttribute('aria-invalid'), 'true'); assert.match(await page.locator('#tune-res-0-cap-err').innerText(), /from 1 to 1,000/); await page.locator('#tune-res-0-cap').fill('2'); assert.equal((await defOf()).resources[0]!.capacity, 2);
  // Arrival end rules.
  const first = (await defOf()).arrivals[0]!; assert.equal(await page.locator('#tune-arr-0-end-count').isChecked(), true);
  await arr('end-until').check(); let a = (await defOf()).arrivals[0]!; assert.equal(a.count, undefined); assert.equal(typeof a.until, 'number'); assert(a.until! > a.at); assert.equal(await arr('until').count(), 1);
  await arr('end-open').check(); a = (await defOf()).arrivals[0]!; assert.deepEqual([a.open, a.until, a.count], [true, undefined, undefined]); assert.equal(await arr('count').count(), 0);
  await arr('interval').fill('0'); assert.match(await page.locator('#tune-arr-0-interval-err').innerText(), /interval of at least 1 minute/); assert.equal(await arr('interval').getAttribute('aria-invalid'), 'true');
  await arr('interval').fill('10'); assert.equal(await page.locator('#tune-arr-0-interval-err').innerText(), ''); await arr('end-count').check(); a = (await defOf()).arrivals[0]!; assert.equal(a.open, undefined); assert.equal(typeof a.count, 'number');
  await arr('count').fill('201'); assert.match(await page.locator('#tune-arr-0-count-err').innerText(), /from 1 to 200/); await arr('count').fill(String(first.count ?? 3));
  // Random gap.
  assert.deepEqual(await arr('gap-dist').locator('option').allInnerTexts(), ['None (exact spacing)', 'Uniform (min to max)', 'Triangular (min, most likely, max)', 'Exponential (average, optional cap)', 'Normal (average and spread, optional bounds)', 'Erlang (phases and average)']);
  await arr('gap-dist').selectOption('uniform'); assert.equal((await defOf()).arrivals[0]!.gap!.dist, 'uniform'); await arr('gap-min').fill('9'); await arr('gap-max').fill('3');
  assert.match(await page.locator('#tune-arr-0-gap-group-err').innerText(), /min at most max/); assert.equal(await arr('gap-min').getAttribute('aria-invalid'), 'true'); await arr('gap-max').fill('12'); assert.equal(await page.locator('#tune-arr-0-gap-group-err').innerText(), '');
  await arr('gap-dist').selectOption('triangular'); assert.deepEqual(Object.keys((await defOf()).arrivals[0]!.gap!).sort(), ['dist', 'max', 'min', 'mode']); await arr('gap-dist').selectOption('exponential'); assert.deepEqual(Object.keys((await defOf()).arrivals[0]!.gap!).sort(), ['dist', 'mean']);
  assert.equal(await arr('gap-max').count(), 1); await arr('gap-dist').selectOption('none'); assert.equal((await defOf()).arrivals[0]!.gap, undefined);
  // Arrival data fields.
  await page.locator('[data-act="data-add"]').first().click(); let data = (await defOf()).arrivals[0]!.data; const added = Object.keys(data).at(-1)!; assert.equal(data[added], '');
  const idx = Object.keys(data).length - 1, rename = page.locator(`#tune-arr-0-data-${idx}-name`); await rename.fill('Bad name'); await rename.press('Tab'); assert.match(await page.locator(`#tune-arr-0-data-${idx}-name-err`).innerText(), /lowercase letter/); assert.equal(Object.hasOwn((await defOf()).arrivals[0]!.data, added), true);
  await rename.fill('urgency'); await rename.press('Tab'); data = (await defOf()).arrivals[0]!.data; assert.deepEqual(Object.keys(data).at(-1), 'urgency');
  await page.locator(`#tune-arr-0-data-${idx}-value-type`).selectOption('number'); await page.locator(`#tune-arr-0-data-${idx}-value`).fill('3'); assert.equal((await defOf()).arrivals[0]!.data.urgency, 3);
  await page.locator(`#tune-arr-0-data-${idx}-value-type`).selectOption('boolean'); assert.equal((await defOf()).arrivals[0]!.data.urgency, true); await page.locator('[data-act="data-remove"][data-name="urgency"]').click(); assert.equal(Object.hasOwn((await defOf()).arrivals[0]!.data, 'urgency'), false);
  // Arrival draws.
  await page.locator('[data-act="draw-add"]').first().click(); let draw = (await defOf()).arrivals[0]!.draws![0]!; assert.deepEqual([draw.kind, draw.percent], ['chance', 50]);
  await page.locator('#tune-arr-0-draw-0-percent').fill('100'); assert.match(await page.locator('#tune-arr-0-draw-0-percent-err').innerText(), /whole percent from 1 to 99/); await page.locator('#tune-arr-0-draw-0-percent').fill('30');
  await page.locator('#tune-arr-0-draw-0-true-type').selectOption('string'); await page.locator('#tune-arr-0-draw-0-true').fill('urgent'); await page.locator('#tune-arr-0-draw-0-false-type').selectOption('string'); await page.locator('#tune-arr-0-draw-0-false').fill('routine');
  draw = (await defOf()).arrivals[0]!.draws![0]!; assert.deepEqual([draw.percent, draw.whenTrue, draw.whenFalse], [30, 'urgent', 'routine']);
  await page.locator('#tune-arr-0-draw-0-kind').selectOption('choice'); draw = (await defOf()).arrivals[0]!.draws![0]!; assert.equal(draw.values!.length, 2); assert.equal(draw.percent, undefined);
  await page.locator('[data-act="value-add"]').first().click(); assert.equal((await defOf()).arrivals[0]!.draws![0]!.values!.length, 3); await page.locator('#tune-arr-0-draw-0-w0').fill('0'); assert.match(await page.locator('#tune-arr-0-draw-0-w0-err').innerText(), /from 1 to 1000/);
  await page.locator('#tune-arr-0-draw-0-w0').fill('5'); await page.locator('#tune-arr-0-draw-0-kind').selectOption('int'); draw = (await defOf()).arrivals[0]!.draws![0]!; assert.deepEqual([draw.min, draw.max, draw.values], [1, 10, undefined]);
  await page.locator('#tune-arr-0-draw-0-min').fill('20'); assert.match(await page.locator('#tune-arr-0-draw-0-err2').innerText(), /min at most max/); await page.locator('[data-act="draw-remove"]').first().click(); assert.equal((await defOf()).arrivals[0]!.draws, undefined);
  // Add and remove arrivals.
  await page.locator('#tune-arr-add').click(); const total = (await defOf()).arrivals.length; assert.equal(total, 3); await page.locator('[data-act="arr-remove"]').last().click(); await page.locator('[data-act="arr-remove"]').last().click(); assert.equal((await defOf()).arrivals.length, 1); assert.equal(await page.locator('[data-act="arr-remove"]').isDisabled(), true);
  // Each pool says which steps use it; removing a used pool asks first, starting on Cancel, and then clears those demands.
  const owner = page.locator('[data-act="res-remove"][data-i="0"]'), demands = async () => (await defOf()).steps.filter(s => s.resources && 'product-owner' in s.resources).map(s => s.id);
  assert.equal(await page.locator('#tune-res-0-used').innerText(), 'Used by Discovery and Client handover.'); assert.equal(await owner.getAttribute('aria-describedby'), 'tune-res-0-used');
  await owner.click(); assert.equal(await page.locator('#de-confirm-title').innerText(), 'Discovery and Client handover still use Product owner. Removing the pool also clears those demands.');
  assert.deepEqual(await page.locator('#de-choices button').allInnerTexts(), ['Cancel', 'Remove and clear demands']); assert.equal(await activeId(), 'de-keep-pool');
  await page.keyboard.press('Escape'); assert.equal(await page.locator('#de-confirm').isHidden(), true); assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.act), 'res-remove');
  assert.equal((await defOf()).resources[0]!.id, 'product-owner'); assert.deepEqual(await demands(), ['discovery', 'handover']);
  await owner.click(); await page.locator('#de-keep-pool').click(); assert.equal((await defOf()).resources[0]!.id, 'product-owner', 'Cancel keeps the pool');
  await owner.click(); await page.locator('#de-remove-pool').click(); assert.equal((await defOf()).resources.some(r => r.id === 'product-owner'), false); assert.deepEqual(await demands(), []);
  assert.equal(await activeId(), 'tune-res-add'); await page.locator('#tune-res-add').click(); const fresh = (await defOf()).resources.length - 1;
  assert.equal(await page.locator(`#tune-res-${fresh}-used`).innerText(), 'Not used by any step yet.'); await page.locator(`[data-act="res-remove"][data-i="${fresh}"]`).click();
  assert.equal(await page.locator('#de-confirm').isHidden(), true, 'an unused pool is removed without asking'); assert.equal((await defOf()).resources.length, fresh);
  await restoreDef(); await closeDef(); assert.equal(await page.locator('#draft-chip').isHidden(), true);
 });
 await check('Definition editor raw JSON reports line and column, lists every diagnostic and jumps to the offending text', async () => {
  await page.setViewportSize({width: 1440, height: 1060});
  await freshStudio(); await openDef(); const area = page.locator('#draft'), selection = () => page.evaluate(() => { const a = document.getElementById('draft') as HTMLTextAreaElement; return {text: a.value.slice(a.selectionStart, a.selectionEnd), start: a.selectionStart, active: document.activeElement?.id}; });
  await area.fill('{\n  "a": 1,\n  "b": [1 2]\n}'); assert.equal(await page.locator('#draft-state').innerText(), `Invalid JSON: line 3, column 11 · Expected ',' or ']' after the value`);
  assert.equal(await page.locator('#de-gutter .bad').innerText(), '3'); assert.equal(await page.locator('#de-format').isDisabled(), true); assert.equal(await area.getAttribute('aria-invalid'), 'true');
  await page.waitForFunction(() => document.getElementById('de-sync')!.textContent === 'Fix the JSON to use the form'); assert.equal(await page.locator('#tune-name').isDisabled(), true, 'the form is disabled while the JSON is invalid');
  await page.locator('#diagnostics button').click(); const syntax = await selection(); assert.equal(syntax.active, 'draft'); assert.equal(syntax.start, '{\n  "a": 1,\n  "b": [1 '.length); assert.equal(syntax.text, '2');
  // Every diagnostic the catalog returns is listed, labelled with the step name, and selects its text.
  const base = JSON.parse(JSON.stringify((await query(page)).definition)) as LWProcess.Definition; base.steps[1]!.duration = 0; base.resources[0]!.capacity = 0; delete (base.steps[2] as Partial<LWProcess.Step>).scene;
  await pasteDraft(JSON.stringify(base, null, 2)); await inSync();
  const expected = await page.evaluate(text => (globalThis as unknown as {LWProcessCatalog: LWProcess.Catalog}).LWProcessCatalog.validate(JSON.parse(text), true).diagnostics.map(d => d.path), await draftText());
  assert(expected.length >= 3, JSON.stringify(expected)); assert.equal(await page.locator('#diagnostics button').count(), expected.length); assert.equal(await page.locator('#de-diag-h').innerText(), `Problems (${expected.length})`);
  assert.deepEqual(await page.locator('#diagnostics button').evaluateAll(b => b.map(x => (x as HTMLElement).dataset.path)), expected); assert.match(await page.locator('#de-diag-note').innerText(), /Structure problems come first/);
  const entry = (path: string) => page.locator(`#diagnostics button[data-path="${path}"]`);
  assert.match(await entry('/steps/1/duration').innerText(), /^Discovery › duration\n/); await entry('/steps/1/duration').click(); const dur = await selection(); assert.match(dur.text, /^"duration": 0$/); assert.equal(dur.active, 'draft');
  await entry('/resources/0/capacity').click(); assert.match((await selection()).text, /^"capacity": 0$/); assert.match(await entry('/resources/0/capacity').innerText(), /^Resource .* › capacity/);
  await entry('/steps/2').click(); const block = await selection(); assert.equal(block.text, '{', 'a missing field selects the start of its block'); assert.match(await entry('/steps/2').innerText(), /Missing field: scene/);
  // With the structure repaired the relationship checks run and are listed too.
  const graph = JSON.parse(JSON.stringify((await query(page)).definition)) as LWProcess.Definition; graph.flows[0]!.to = 'nowhere'; graph.steps[1]!.resources = {ghost: 1};
  await area.fill(JSON.stringify(graph)); await inSync(); const expectedGraph = await page.evaluate(text => (globalThis as unknown as {LWProcessCatalog: LWProcess.Catalog}).LWProcessCatalog.validate(JSON.parse(text), true).diagnostics.length, await draftText());
  assert(expectedGraph >= 2); assert.equal(await page.locator('#diagnostics button').count(), expectedGraph); assert.doesNotMatch(await page.locator('#de-diag-note').innerText(), /Structure problems come first/);
  // Format, the diff summary and the gutter.
  await page.locator('#de-format').click(); assert.equal(await draftText(), JSON.stringify(JSON.parse(await draftText()), null, 2)); assert.equal(await page.locator('#de-diff').isVisible(), true);
  assert.match(await page.locator('#draft-state').innerText(), /^Unapplied draft: .*changed/); await page.locator('#de-diff summary').click(); assert.match(await page.locator('#de-diff-list').innerText(), /changed/);
  const gutter = await page.evaluate(() => new Promise<{lines: number; numbers: number; top: number; areaTop: number}>(resolve => { const a = document.getElementById('draft') as HTMLTextAreaElement, g = document.getElementById('de-gutter')!; a.scrollTop = 600; requestAnimationFrame(() => requestAnimationFrame(() => resolve({lines: a.value.split('\n').length, numbers: g.textContent!.split('\n').length, top: g.scrollTop, areaTop: a.scrollTop}))); }));
  assert.equal(gutter.lines, gutter.numbers); assert.equal(gutter.top, gutter.areaTop); assert(gutter.areaTop > 0);
  // Copy uses the clipboard and falls back to selecting everything.
  await page.evaluate(() => { (globalThis as any).copied = null; Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: (t: string) => { (globalThis as any).copied = t; return Promise.resolve(); }}}); });
  await page.locator('#de-copy').click(); assert.match(await page.locator('#de-copy-note').innerText(), /Copied/); assert.equal(await page.evaluate(() => (globalThis as any).copied === (document.getElementById('draft') as HTMLTextAreaElement).value), true);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: () => Promise.reject(new Error('blocked'))}}));
  await page.locator('#de-copy').click(); assert.match(await page.locator('#de-copy-note').innerText(), /selected.*Ctrl\+C/); const all = await selection(); assert.equal(all.text, await draftText());
  const box = (await area.boundingBox())!, wide = await page.evaluate(() => getComputedStyle(document.getElementById('draft')!)); assert(box.height >= 320); assert.match(wide.fontFamily, /mono/i); assert.equal(await area.getAttribute('wrap'), 'off');
  await restoreDef(); await closeDef();
 });
 await check('Definition editor asks before restoring or applying over a run in progress', async () => {
  await page.setViewportSize({width: 1440, height: 1060});
  await freshStudio(); await page.locator('#advance').click(); const before = await query(page); assert.equal(before.snapshot.minute, 30);
  await openDef(); assert.equal(await page.locator('#de-restore').isDisabled(), true); assert.match(await page.locator('#de-reason').innerText(), /Restore is unavailable while the draft matches/);
  await page.locator('#tune-name').fill('Edited while running'); assert.equal(await page.locator('#de-restore').isDisabled(), false); const edited = await draftText();
  await page.locator('#de-restore').click(); assert.equal(await page.locator('#de-confirm').isVisible(), true); assert.equal(await page.locator('#de-confirm-title').innerText(), 'Replace the draft with the running definition?');
  assert.deepEqual(await page.locator('#de-choices button').allInnerTexts(), ['Download draft first', 'Restore', 'Keep draft']); assert.equal(await activeId(), 'de-keep');
  await page.keyboard.press('Escape'); assert.equal(await page.locator('#de-confirm').isHidden(), true); assert.equal(await dialogOpen(), 1); assert.equal(await draftText(), edited); assert.equal(await activeId(), 'de-restore');
  await page.locator('#de-restore').click(); const pending = page.waitForEvent('download'); await page.locator('#de-download-first').click(); const saved = await pending; const file2 = path.join(dir, 'before-restore.json'); await saved.saveAs(file2); assert.equal(fs.readFileSync(file2, 'utf8'), edited);
  assert.equal(await draftText(), edited, 'downloading does not restore'); await page.locator('#de-restore').click(); await page.locator('#de-keep').click(); assert.equal(await draftText(), edited);
  await restoreDef(); assert.equal(await draftText(), JSON.stringify(before.definition, null, 2)); assert.equal(await page.locator('#de-message').innerText(), 'Draft restored from the running definition.'); assert.equal(await page.locator('#de-restore').isDisabled(), true);
  // Reformatted text of the same definition is a different draft text but nothing to apply: no reset and no revision bump.
  await pasteDraft(JSON.stringify(before.definition)); assert.equal(await page.locator('#de-restore').isEnabled(), true); assert.equal(await page.locator('#de-apply').isDisabled(), true);
  assert.match(await page.locator('#de-reason').innerText(), /Nothing to apply/); assert.equal((await query(page)).definition.revision, before.definition.revision);
  // Applying past minute 0 names the minute that is discarded.
  await page.locator('#draft').fill('{bad'); await page.locator('#de-apply').click(); assert.equal(await page.locator('#de-status').getAttribute('role'), 'alert'); assert.equal(await page.locator('#de-confirm').isHidden(), true, 'an invalid draft is refused before asking'); assert.equal((await query(page)).snapshot.minute, 30);
  await page.locator('#tune-name').count(); await restoreDef(); await page.locator('#tune-name').fill('Applied over a run'); await page.locator('#de-apply').click();
  assert.match(await page.locator('#de-confirm-title').innerText(), /^Applying starts a fresh paused run and discards minute 30 \(\d+ cases?\)\. Export the run report first if you need it\.$/); assert.equal(await activeId(), 'de-back'); assert.equal(await page.locator('#de-apply-reset').innerText(), 'Apply and reset');
  assert.deepEqual((await query(page)).definition, before.definition); await page.keyboard.press('Escape'); assert.equal(await page.locator('#de-confirm').isHidden(), true); assert.equal(await dialogOpen(), 1); assert.equal((await query(page)).snapshot.minute, 30);
  await page.locator('#de-apply').click(); await page.locator('#de-back').click(); assert.equal((await query(page)).snapshot.minute, 30);
  await page.locator('#de-apply').click(); await page.locator('#de-apply-reset').click(); await defOpen.waitFor({state: 'hidden'});
  const after = await query(page); assert.equal(after.snapshot.minute, 0); assert.equal(after.definition.name, 'Applied over a run'); assert.equal(after.definition.revision, before.definition.revision + 1); assert.equal(await activeId(), 'open-definition');
 });
 await check('Definition editor reflows to a full sheet at phone width without horizontal overflow', async () => {
  await page.setViewportSize({width: 1440, height: 1060});
  await freshStudio(); await page.setViewportSize({width: 390, height: 844}); await nextFrames(page); await page.locator('#open-definition').click(); await defOpen.waitFor();
  const geometry = await page.evaluate(() => {
   const d = document.querySelector('dialog.de-dialog') as HTMLElement, r = d.getBoundingClientRect(), foot = d.querySelector('.pd-foot')!.getBoundingClientRect(), head = d.querySelector('.pd-head')!.getBoundingClientRect(), visible = (n: Element) => n.getClientRects().length > 0;
   const wide = [...d.querySelectorAll<HTMLElement>('input, select, textarea, button')].filter(n => visible(n) && (n.getBoundingClientRect().right > r.right + 0.5 || n.getBoundingClientRect().left < r.left - 0.5)).map(n => n.id || n.textContent);
   const small = [...d.querySelectorAll<HTMLElement>('input[type=text], input[type=number], select, textarea, button')].filter(n => visible(n) && n.getBoundingClientRect().height < 43.5).map(n => n.id || n.textContent);
   return {x: r.x, y: r.y, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight, page: document.documentElement.scrollWidth > innerWidth, own: d.scrollWidth > d.clientWidth, footBottom: foot.bottom, headTop: head.top, wide, small,
    tabs: visible(d.querySelector('.de-tabs')!), form: visible(d.querySelector('#de-pane-form')!), json: visible(d.querySelector('#de-pane-json')!)};
  });
  assert.deepEqual([geometry.x, geometry.y, geometry.w, geometry.h], [0, 0, geometry.vw, geometry.vh]); assert.equal(geometry.page, false); assert.equal(geometry.own, false); assert.deepEqual(geometry.wide, []); assert.deepEqual(geometry.small, [], 'touch targets are 44px');
  assert.equal(geometry.headTop, 0); assert.equal(Math.round(geometry.footBottom), geometry.vh); assert.deepEqual([geometry.tabs, geometry.form, geometry.json], [true, true, false]);
  await page.locator('#tune-arr-0').scrollIntoViewIfNeeded(); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); await page.screenshot({path: path.join(OUT, 'process-definition-mobile-form.png')});
  await page.locator('#de-tab-json').click(); assert.equal(await page.locator('#de-pane-json').isVisible(), true); assert.equal(await page.locator('#de-pane-form').isVisible(), false); assert.equal(await page.locator('#de-tab-json').getAttribute('aria-pressed'), 'true');
  assert((await page.locator('#draft').boundingBox())!.height >= 320); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); await page.screenshot({path: path.join(OUT, 'process-definition-mobile-json.png')});
  await page.setViewportSize({width: 800, height: 900}); await nextFrames(page); assert.equal(await page.locator('.de-tabs').isVisible(), true, 'tabs below 1000px'); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.setViewportSize({width: 1440, height: 1060}); await nextFrames(page);
  const columns = await page.evaluate(() => { const f = document.getElementById('de-pane-form')!.getBoundingClientRect(), j = document.getElementById('de-pane-json')!.getBoundingClientRect(), d = document.querySelector('dialog.de-dialog')!.getBoundingClientRect(); return {tabs: document.querySelector('.de-tabs')!.getClientRects().length, fx: f.x, jx: j.x, fw: f.width, jw: j.width, dw: d.width}; });
  assert.equal(columns.tabs, 0); assert(columns.fx < columns.jx && columns.fw > 300 && columns.jw > 300); assert(columns.dw <= 1000 && columns.dw > 900); await page.screenshot({path: path.join(OUT, 'process-definition-desktop.png')}); await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 0);
 });
 await check('Step editor routes to the Definition editor for an invalid draft', async () => {
  await page.setViewportSize({width: 1440, height: 1060});
  await freshStudio(); await openDef(); await page.locator('#draft').fill('{bad'); await closeDef(); await page.locator('[data-step="discovery"]').click();
  await page.locator('#edit-step').click(); await defOpen.waitFor(); assert.equal(await dialogOpen(), 1); assert.equal(await page.locator('#se-title').isVisible(), false); assert.equal(await activeId(), 'draft');
  assert.match(await page.locator('#draft-state').innerText(), /^Invalid JSON: line 1, column 2/); assert.equal(await page.evaluate(() => (document.getElementById('draft') as HTMLTextAreaElement).selectionStart), 1);
  await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 0); assert.equal(await activeId(), 'edit-step', 'focus returns to the button that was used'); await openDef(); await restoreDef(); await closeDef();
  // A valid draft with problems elsewhere: the step editor's link closes it and opens the Definition editor on the problem.
  await openDef(); const raw = await defOf(); delete raw.steps[1]!.duration; await page.locator('#draft').fill(JSON.stringify(raw)); await closeDef();
  await page.locator('[data-step="implementation"]').click(); await page.locator('#edit-step').click(); await page.locator('#se-name').waitFor(); await page.locator('#se-status [data-act="open-definition"]').click(); await defOpen.waitFor();
  assert.equal(await dialogOpen(), 1, 'one modal at a time'); assert.equal(await page.locator('#se-title').isVisible(), false); assert.equal(await activeId(), 'draft'); assert.match(await page.locator('#diagnostics').innerText(), /Discovery › duration/);
  await page.keyboard.press('Escape'); assert.equal(await activeId(), 'open-definition'); assert.equal(await dialogOpen(), 0);
  // A step editor with unsaved edits asks first; keeping them keeps the step editor, discarding opens the Definition editor.
  await page.locator('#edit-step').click(); await page.locator('#se-name').fill('Unsaved rename'); await page.locator('#se-status [data-act="open-definition"]').click();
  assert.equal(await page.locator('#se-confirm').isVisible(), true); await page.locator('#se-keep').click(); assert.equal(await dialogOpen(), 1); assert.equal(await page.locator('#se-title').isVisible(), true); assert.equal(await page.locator('#se-name').inputValue(), 'Unsaved rename');
  await page.locator('#se-status [data-act="open-definition"]').click();
  assert.equal(await page.locator('#se-confirm-title').innerText(), 'Open the Definition editor? Your changes to Unsaved rename are not in the draft yet.');
  assert.deepEqual(await page.locator('#se-choices button').allInnerTexts(), ['Keep editing', 'Save to draft and open', 'Discard changes']); assert.equal(await activeId(), 'se-keep');
  await page.locator('#se-discard').click(); await defOpen.waitFor(); assert.equal(await dialogOpen(), 1); assert.doesNotMatch(await draftText(), /Unsaved rename/);
  await closeDef();
  // Save to draft and open keeps the edits: they are in the draft the Definition editor shows.
  await page.locator('#edit-step').click(); await page.locator('#se-name').fill('Saved rename'); await page.locator('#se-status [data-act="open-definition"]').click();
  assert.equal(await activeId(), 'se-keep'); await page.locator('#se-save-open').click(); await defOpen.waitFor(); assert.equal(await dialogOpen(), 1);
  assert.equal((await defOf()).steps.find(s => s.id === 'implementation')!.name, 'Saved rename');
  await restoreDef(); await closeDef();
 });
 await check('Step editor edits touchpoints with channels, phases, feelings, pain points and end outcomes', async () => {
  // The plain-language helpers are pure: words for feelings, channels and outcomes, and nothing for values outside the contract.
  const words = await page.evaluate(() => {
   const v = (globalThis as any).LWProcessRandomView;
   return {emotions: [-3, -2, -1, 0, 1, 2, 3, 4, 1.5, undefined].map(v.describeEmotion), channels: [...v.CHANNELS.map((c: [string, string]) => v.describeChannel(c[0])), v.describeChannel('fax'), v.describeChannel(undefined)], outcomes: [v.describeOutcome('goal'), v.describeOutcome('lost'), v.describeOutcome(undefined), v.describeOutcome('toString')]};
  });
  assert.deepEqual(words.emotions, ['Very frustrated', 'Frustrated', 'Slightly annoyed', 'Neutral', 'Pleased', 'Happy', 'Delighted', '', '', '']);
  assert.deepEqual(words.channels, ['Website', 'Mobile app', 'Physical store', 'Phone call', 'Chat', 'Email', 'Social media', 'Advertising', 'Delivery', 'Documents and forms', '', '']);
  assert.deepEqual(words.outcomes, ['Goal reached', 'Customer or user lost', '', '']);
  await importJourney(); const dlg = page.locator('dialog.pd-dialog[open]');
  const openStep = async (id: string) => { await page.locator(`[data-step="${id}"]`).click(); await page.locator('#edit-step').click(); await dlg.waitFor(); };
  // A touchpoint: Journey section, backstage pools of any kind with kind badges, no requirement and no technology.
  await openStep('browse'); assert.equal(await page.locator('#se-chip').innerText(), 'touchpoint'); assert.equal(await page.locator('#se-h-journey').innerText(), 'Journey');
  assert.equal(await page.locator('#se-h-people').innerText(), 'Backstage teams and systems (optional)'); assert.match(await page.locator('#se-h-people + .se-help').innerText(), /Customers and users are not a pool and never consume capacity/);
  assert.equal(await page.locator('#se-h-automation').count(), 0); assert.equal(await page.locator('#se-technology').count(), 0); assert.equal(await page.locator('#se-no-pools').count(), 0); assert.equal(await page.locator('#se-h-notes').count(), 0);
  assert.deepEqual(await page.locator('#se-h-people').locator('xpath=..').locator('.se-badge').allInnerTexts(), ['People', 'System', 'Machine']);
  assert.equal(await dlg.getByLabel('Support crew').count(), 1); assert.equal(await dlg.getByLabel('Shop platform').count(), 1); assert.equal(await dlg.getByLabel('Pickup kiosk').count(), 1);
  assert.match(await page.locator('#se-h-timing').innerText(), /Timing and cost/); assert.match(await dlg.innerText(), /Touchpoint duration/); assert.equal(await page.locator('#se-h-random-timing').count(), 1); assert.equal(await page.locator('#se-h-random-outcomes').count(), 1);
  assert.deepEqual(await page.locator('#se-channel option').allInnerTexts(), ['Not set', 'Website', 'Mobile app', 'Physical store', 'Phone call', 'Chat', 'Email', 'Social media', 'Advertising', 'Delivery', 'Documents and forms']);
  assert.deepEqual(await page.locator('#se-emotion option').allInnerTexts(), ['Not set', 'Very frustrated (-3)', 'Frustrated (-2)', 'Slightly annoyed (-1)', 'Neutral (0)', 'Pleased (+1)', 'Happy (+2)', 'Delighted (+3)']);
  assert.deepEqual([await page.locator('#se-channel').inputValue(), await page.locator('#se-emotion').inputValue(), await page.locator('#se-phase').inputValue(), await page.locator('#se-pain').inputValue(), await page.locator('#se-opportunity').inputValue()], ['web', '1', 'Consideration', 'Search results are slow.', '']);
  assert.deepEqual(await page.locator('#se-phase-list option').evaluateAll(o => o.map(n => (n as HTMLOptionElement).value)), ['Awareness', 'Consideration', 'Purchase']); assert.equal(await page.locator('#se-phase').getAttribute('list'), 'se-phase-list');
  assert.equal(await page.locator('#se-needs-summary').innerText(), 'Needs: 1 Shop platform');
  await page.locator('#se-channel').selectOption('mobile'); await page.locator('#se-emotion').selectOption('-2'); await page.locator('#se-phase').fill('Consideration'); await page.locator('#se-pain').fill('The cart empties when the app restarts.'); await page.locator('#se-opportunity').fill('Keep the cart for a week.');
  await dlg.getByLabel('Pickup kiosk').fill('1'); assert.equal(await page.locator('#se-needs-summary').innerText(), 'Needs: 1 Shop platform, 1 Pickup kiosk');
  // The engine's own problem shows beside the pool, in plain words, and blocks saving until it is fixed.
  await dlg.getByLabel('Pickup kiosk').fill('3'); assert.match(await page.locator('#se-err-pools-2').innerText(), /Pickup kiosk has only 1 available; ask for 1 or fewer/); assert.equal(await page.locator('#se-pools-2-count').getAttribute('aria-invalid'), 'true');
  await dlg.getByLabel('Pickup kiosk').fill('0'); assert.equal(await page.locator('#se-err-pools-2').innerText(), ''); await dlg.getByLabel('Shop platform').fill('0');
  assert.equal(await page.locator('#se-status').innerText(), '', 'a touchpoint with no backstage pool at all is valid: it never waits for capacity'); assert.equal(await page.locator('#se-save').isEnabled(), true);
  await page.locator('#se-save').click(); assert.equal(await dialogOpen(), 0);
  let browse = await savedStep('browse'); assert.deepEqual([browse.channel, browse.emotion, browse.phase, browse.pain, browse.opportunity, browse.resources, browse.kind], ['mobile', -2, 'Consideration', 'The cart empties when the app restarts.', 'Keep the cart for a week.', undefined, 'touchpoint']);
  // Clearing the notes removes the keys again instead of writing empty strings.
  await openStep('browse'); await page.locator('#se-channel').selectOption(''); await page.locator('#se-emotion').selectOption(''); await page.locator('#se-pain').fill('  '); await page.locator('#se-save').click();
  browse = await savedStep('browse'); for (const key of ['channel', 'emotion', 'pain'] as const) assert.equal(Object.hasOwn(browse, key), false, key + ' is removed when cleared');
  await openStep('ad'); assert.equal(await page.locator('#se-channel').inputValue(), 'social'); await page.locator('#se-channel').selectOption('phone'); await page.locator('#se-emotion').selectOption('3'); await page.locator('#se-save').click();
  // Every other kind keeps its own sections and gets collapsed Journey notes, so a business process can use phases too.
  await openStep('pack'); assert.equal(await page.locator('#se-chip').innerText(), 'task'); assert.equal(await page.locator('#se-h-journey').count(), 0); assert.equal(await page.locator('#se-channel').count(), 0); assert.equal(await page.locator('#se-outcome').count(), 0);
  assert.equal(await dlg.getByLabel('Shop platform').count(), 0, 'a task still demands only people pools'); assert.equal(await dlg.getByLabel('Support crew').count(), 1);
  assert.equal(await page.locator('#se-notes').evaluate((e: HTMLDetailsElement) => e.open), false); assert.equal(await page.locator('#se-h-notes').innerText(), 'Journey notes (optional)'); assert.equal(await page.locator('#se-phase').isVisible(), false);
  await page.locator('#se-h-notes').click(); assert.equal(await page.locator('#se-phase').isVisible(), true); await page.locator('#se-phase').fill('Fulfilment'); await page.locator('#se-emotion').selectOption('2'); await page.locator('#se-opportunity').fill('Pack within the hour.');
  await page.locator('#se-add-set').click(); assert.equal(await page.locator('#se-notes').evaluate((e: HTMLDetailsElement) => e.open), true, 'the notes stay open after the form is rebuilt'); assert.equal(await page.locator('#se-phase').inputValue(), 'Fulfilment');
  await page.locator('[data-bind="set.1.key"]').fill('boxed'); await page.locator('#se-save').click();
  const pack = await savedStep('pack'); assert.deepEqual([pack.phase, pack.emotion, pack.opportunity, pack.channel, pack.set], ['Fulfilment', 2, 'Pack within the hour.', undefined, {packed: true, boxed: true}]);
  // A start step gets notes but no outcome; end steps get the Outcome select.
  await openStep('start'); assert.equal(await page.locator('#se-notes').count(), 1); assert.equal(await page.locator('#se-outcome').count(), 0); await page.locator('#se-close').click();
  await openStep('won'); assert.equal(await page.locator('#se-h-outcome').innerText(), 'Outcome'); assert.deepEqual(await page.locator('#se-outcome option').allInnerTexts(), ['None', 'Goal reached', 'Customer or user lost']); assert.equal(await page.locator('#se-outcome').inputValue(), '');
  assert.equal(await page.locator('#se-h-notes').count(), 1); await page.locator('#se-outcome').selectOption('goal'); await page.locator('#se-save').click();
  await openStep('lost'); await page.locator('#se-outcome').selectOption('lost'); await page.locator('#se-save').click();
  assert.equal((await savedStep('won')).outcome, 'goal'); assert.equal((await savedStep('lost')).outcome, 'lost');
  await openStep('lost'); assert.equal(await page.locator('#se-outcome').inputValue(), 'lost'); await page.locator('#se-outcome').selectOption(''); await page.locator('#se-save').click(); assert.equal(Object.hasOwn(await savedStep('lost'), 'outcome'), false);
  await openStep('lost'); await page.locator('#se-outcome').selectOption('lost'); await page.locator('#se-save').click();
  // Applying through the Definition editor starts a fresh run, so the engine accepted the journey fields the editor wrote.
  await openDef(); await applyDef(); const applied = await query(page);
  assert.equal(await page.evaluate(d => (globalThis as any).LWProcessCatalog.validate(d).ok, applied.definition), true); assert.equal(applied.snapshot.minute, 0);
  const byId = (id: string) => applied.definition.steps.find(s => s.id === id)!;
  assert.deepEqual([byId('ad').channel, byId('ad').emotion, byId('won').outcome, byId('lost').outcome, byId('pack').phase], ['phone', 3, 'goal', 'lost', 'Fulfilment']); assert.equal(applied.definition.genre, 'customer-journey');
  await page.locator('#advance').click(); assert.equal((await query(page)).playing, false);
 });
 await check('Definition editor edits the process type and tracked measures with inline problems', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await importJourney(); await openDef();
  const genre = page.locator('#tune-genre'), track = (i: number, part: string) => page.locator(`#tune-track-${i}-${part}`), tracks = async () => (await defOf()).track;
  // Process type: three plain choices, each with its own one-sentence help; the default process is written as an absent key.
  assert.equal(await page.locator('label[for="tune-genre"]').innerText(), 'Process type'); assert.deepEqual(await page.locator('#tune-genre option').allInnerTexts(), ['Business process', 'Customer journey', 'User journey']); assert.equal(await genre.inputValue(), 'customer-journey');
  assert.match(await page.locator('#tune-genre-help').innerText(), /Cases are customers and steps are the touchpoints where they meet your business/); assert.match(await page.locator('#tune-genre-help').innerText(), /labels and the default view only/);
  await genre.selectOption('user-journey'); assert.equal((await defOf()).genre, 'user-journey'); assert.match(await page.locator('#tune-genre-help').innerText(), /Cases are users of a product or service/); assert.equal(await page.evaluate(() => document.activeElement?.id), 'tune-genre');
  await genre.selectOption('process'); assert.equal(Object.hasOwn(await defOf(), 'genre'), false); assert.match(await page.locator('#tune-genre-help').innerText(), /Cases are work items such as orders or tickets/); await genre.selectOption('customer-journey'); assert.equal((await defOf()).genre, 'customer-journey'); await inSync();
  // Tracked measures: the explanation, suggestions from fields the process already writes, and a bounded number of rows.
  assert.equal(await page.locator('#tune-h-track').innerText(), 'Tracked measures'); assert.equal(await page.locator('#tune-track-help').innerText(), 'The simulation averages these values when cases finish and at every step, to draw the measured curve. Choose up to 6 number fields, for example a mood score or a satisfaction rating.');
  assert.match(await page.locator('#tune-track-help').innerText(), /^The simulation averages these values when cases finish and at every step, to draw the measured curve/); assert.equal(await tracks(), undefined);
  assert.deepEqual(await page.locator('#tune-track-fields option').evaluateAll(o => o.map(n => (n as HTMLOptionElement).value)), ['mood', 'packed']);
  await page.locator('#tune-track-add').click(); assert.deepEqual(await tracks(), [{field: 'mood'}]); assert.equal(await page.evaluate(() => document.activeElement?.id), 'tune-track-0-field'); assert.equal(await track(0, 'field').getAttribute('list'), 'tune-track-fields');
  await track(0, 'label').fill('Mood'); assert.deepEqual(await tracks(), [{field: 'mood', label: 'Mood'}]); await track(0, 'label').fill(''); assert.deepEqual(await tracks(), [{field: 'mood'}]); await track(0, 'label').fill('Mood');
  // Inline problems: a repeated field is the engine's own message beside the row; a malformed name is explained.
  await page.locator('#tune-track-add').click(); assert.deepEqual((await tracks())!.map(t => t.field), ['mood', 'packed']); await track(1, 'field').fill('mood');
  assert.match(await page.locator('#tune-track-1-field-err').innerText(), /Tracked field mood is listed twice/); assert.equal(await track(1, 'field').getAttribute('aria-invalid'), 'true'); assert.match(await page.locator('#diagnostics').innerText(), /Tracked measure 2 › field/);
  assert.match(await page.locator('#tune-summary').innerText(), /1 problem in this form/);
  await track(1, 'field').fill('Bad name'); assert.match(await page.locator('#tune-track-1-field-err').innerText(), /Start with a lowercase letter/); assert.equal(await track(1, 'field').getAttribute('aria-invalid'), 'true');
  await track(1, 'field').fill('score'); assert.equal(await page.locator('#tune-track-1-field-err').innerText(), ''); assert.equal(await track(1, 'field').getAttribute('aria-invalid'), null); assert.equal(await page.locator('#diagnostics li').count(), 0);
  // At most six: the button disables with a visible reason, and removing a row enables it again.
  for (let i = 0; i < 4; i++) await page.locator('#tune-track-add').click();
  assert.equal((await tracks())!.length, 6); assert.equal(await page.locator('#tune-track-add').isDisabled(), true); assert.equal(await page.locator('#tune-track-full').innerText(), 'At most 6 measures are tracked.'); assert.equal(await page.locator('#tune-track-add').getAttribute('aria-describedby'), 'tune-track-full');
  assert.equal(await page.evaluate(d => (globalThis as any).LWProcessCatalog.validate(d).ok, await defOf()), true);
  await page.locator('[data-act="track-remove"][data-i="5"]').click(); assert.equal((await tracks())!.length, 5); assert.equal(await page.locator('#tune-track-add').isEnabled(), true); assert.equal(await page.locator('#tune-track-full').count(), 0);
  for (let i = 4; i >= 2; i--) await page.locator(`[data-act="track-remove"][data-i="${i}"]`).click();
  assert.deepEqual(await tracks(), [{field: 'mood', label: 'Mood'}, {field: 'score'}]); await page.locator('[data-act="track-remove"][data-i="1"]').click(); assert.equal(await page.evaluate(() => document.activeElement?.id), 'tune-track-add');
  // The Raw JSON pane names the new paths in plain words.
  const raw = JSON.parse(await draftText()) as Record<string, unknown>; raw.genre = 'funnel'; raw.track = [{field: 'Bad field'}]; await pasteDraft(JSON.stringify(raw, null, 2));
  await page.waitForFunction(() => document.querySelectorAll('#diagnostics li').length > 0);
  const listed = await page.locator('#diagnostics').innerText(); assert.match(listed, /Process › process type/); assert.match(listed, /Tracked measure 1 › field/); assert.match(listed, /Expected one of process, customer-journey, user-journey/);
  await restoreDef(); await inSync();
  // Applying keeps the type and the measures, and the engine reports the tracked field under its label.
  await genre.selectOption('user-journey'); await page.locator('#tune-track-add').click(); await track(0, 'label').fill('Mood score'); await applyDef();
  const applied = await query(page); assert.deepEqual([applied.definition.genre, applied.definition.track], ['user-journey', [{field: 'mood', label: 'Mood score'}]]); assert.equal(await page.evaluate(d => (globalThis as any).LWProcessCatalog.validate(d).ok, applied.definition), true);
  for (let i = 0; i < 12 && !Object.hasOwn((await query(page)).snapshot.metrics.tracked, 'mood'); i++) await page.locator('#advance').click();
  assert.equal((await query(page)).snapshot.metrics.tracked.mood!.label, 'Mood score');
 });
 await check('Definition editor edits SIPOC suppliers and customers with inline problems and applies them', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await freshStudio(); await openDef();
  // The shipped agency process already names its suppliers and customers: the form shows exactly those rows.
  const shipped = (await defOf()).sipoc!; assert(shipped.suppliers?.length && shipped.customers?.length);
  for (const [list, key] of [['suppliers', 'supplies'], ['customers', 'receives']] as const) for (const [i, p] of shipped[list]!.entries()) { assert.equal(await page.locator(`#tune-sipoc-${list}-${i}-name`).inputValue(), p.name); assert.equal(await page.locator(`#tune-sipoc-${list}-${i}-detail`).inputValue(), p[key] ?? ''); }
  await closeDef(); await importFeed(); await openDef();
  const party = (list: 'suppliers' | 'customers', i: number, part: 'name' | 'detail') => page.locator(`#tune-sipoc-${list}-${i}-${part}`), sipoc = async () => (await defOf()).sipoc;
  assert.equal(await page.locator('#tune-h-sipoc').innerText(), 'Suppliers and customers (SIPOC)'); assert.match(await page.locator('#tune-sipoc-help').innerText(), /^Inputs, process stages and outputs are derived automatically from the process; only suppliers and customers need to be written\./);
  assert.equal(Object.hasOwn(await defOf(), 'sipoc'), false); assert.equal(await page.locator('#tune-sipoc-suppliers-add').innerText(), 'Add supplier'); assert.equal(await page.locator('#tune-sipoc-customers-add').innerText(), 'Add customer');
  // Adding writes sipoc with a unique default name, focuses the name and labels fields with their limits.
  await page.locator('#tune-sipoc-suppliers-add').click(); assert.deepEqual(await sipoc(), {suppliers: [{name: 'Supplier 1'}]}); assert.equal(await page.evaluate(() => document.activeElement?.id), 'tune-sipoc-suppliers-0-name');
  assert.equal(await page.locator('label[for="tune-sipoc-suppliers-0-name"]').innerText(), 'Name (up to 60 characters)'); assert.equal(await page.locator('label[for="tune-sipoc-suppliers-0-detail"]').innerText(), 'What they supply (optional, up to 160 characters)');
  assert.equal(await party('suppliers', 0, 'name').getAttribute('maxlength'), '60'); assert.equal(await party('suppliers', 0, 'detail').getAttribute('maxlength'), '160');
  await party('suppliers', 0, 'name').fill('Payment provider'); await party('suppliers', 0, 'detail').fill('Payment confirmation');
  await page.locator('#tune-sipoc-customers-add').click(); await party('customers', 0, 'name').fill('Shopper'); assert.equal(await page.locator('label[for="tune-sipoc-customers-0-detail"]').innerText(), 'What they receive (optional, up to 160 characters)'); await party('customers', 0, 'detail').fill('Ordered goods');
  assert.deepEqual(await sipoc(), {suppliers: [{name: 'Payment provider', supplies: 'Payment confirmation'}], customers: [{name: 'Shopper', receives: 'Ordered goods'}]}); await inSync();
  // An emptied detail removes the key; an emptied name is a problem beside the field.
  await party('suppliers', 0, 'detail').fill(''); assert.deepEqual((await sipoc())!.suppliers, [{name: 'Payment provider'}]); await party('suppliers', 0, 'detail').fill('Payment confirmation');
  await party('customers', 0, 'name').fill(''); assert.match(await page.locator('#tune-sipoc-customers-0-name-err').innerText(), /Use 1 to 60 characters/); assert.equal(await party('customers', 0, 'name').getAttribute('aria-invalid'), 'true'); await party('customers', 0, 'name').fill('Shopper');
  assert.equal(await page.locator('#tune-sipoc-customers-0-name-err').innerText(), '');
  // A repeated name is the engine's own problem, shown beside the second row and listed with its readable path.
  await page.locator('#tune-sipoc-suppliers-add').click(); assert.equal((await sipoc())!.suppliers![1]!.name, 'Supplier 2'); await party('suppliers', 1, 'name').fill('Payment provider');
  assert.match(await page.locator('#tune-sipoc-suppliers-1-name-err').innerText(), /Party Payment provider is listed twice/); assert.equal(await party('suppliers', 1, 'name').getAttribute('aria-invalid'), 'true'); assert.match(await page.locator('#diagnostics').innerText(), /Supplier 2 › name/);
  assert.match(await page.locator('#tune-summary').innerText(), /1 problem in this form/); await party('suppliers', 1, 'name').fill('Courier'); assert.equal(await page.locator('#tune-sipoc-suppliers-1-name-err').innerText(), ''); assert.equal(await page.locator('#diagnostics li').count(), 0);
  // At most eight per list, with a visible reason; the draft stays valid for the engine.
  for (let i = 0; i < 6; i++) await page.locator('#tune-sipoc-suppliers-add').click();
  assert.equal((await sipoc())!.suppliers!.length, 8); assert.equal(await page.locator('#tune-sipoc-suppliers-add').isDisabled(), true); assert.equal(await page.locator('#tune-sipoc-suppliers-full').innerText(), 'At most 8 suppliers are listed.'); assert.equal(await page.locator('#tune-sipoc-customers-add').isEnabled(), true);
  assert.equal(await page.evaluate(d => (globalThis as any).LWProcessCatalog.validate(d).ok, await defOf()), true);
  for (let i = 7; i >= 2; i--) await page.locator(`[data-act="sipoc-remove"][data-list="suppliers"][data-i="${i}"]`).click();
  assert.equal(await page.locator('#tune-sipoc-suppliers-add').isEnabled(), true); assert.deepEqual((await sipoc())!.suppliers!.map(p => p.name), ['Payment provider', 'Courier']);
  // Raw JSON names the new paths in plain words.
  const raw = JSON.parse(await draftText()) as Record<string, any>; raw.sipoc = {suppliers: [{name: 'A'}, {name: 'A'}]}; await pasteDraft(JSON.stringify(raw, null, 2));
  await page.waitForFunction(() => document.querySelectorAll('#diagnostics li').length > 0); assert.match(await page.locator('#diagnostics').innerText(), /Supplier 2 › name/);
  raw.sipoc = {customers: [{name: 'B', receives: ''}]}; await pasteDraft(JSON.stringify(raw, null, 2));
  await page.waitForFunction(() => /Customer 1 › receives/.test(document.getElementById('diagnostics')!.textContent!));
  await restoreDef(); await page.waitForFunction(() => !('sipoc' in JSON.parse((document.getElementById('draft') as HTMLTextAreaElement).value))); await inSync();
  // Removing every party removes the key; the focus returns to the Add button.
  await page.locator('#tune-sipoc-suppliers-add').click(); await page.locator('#tune-sipoc-customers-add').click(); await page.locator('[data-act="sipoc-remove"][data-list="suppliers"]').click(); assert.deepEqual(Object.keys((await sipoc())!), ['customers']);
  await page.locator('[data-act="sipoc-remove"][data-list="customers"]').click(); assert.equal(Object.hasOwn(await defOf(), 'sipoc'), false); assert.equal(await page.evaluate(() => document.activeElement?.id), 'tune-sipoc-customers-add');
  // Applying keeps the parties, and the SIPOC view lists them as suppliers and customers.
  await page.locator('#tune-sipoc-suppliers-add').click(); await party('suppliers', 0, 'name').fill('Fabric mill'); await party('suppliers', 0, 'detail').fill('Rolls of cloth');
  await page.locator('#tune-sipoc-customers-add').click(); await party('customers', 0, 'name').fill('Boutique'); await applyDef();
  const applied = await query(page); assert.deepEqual(applied.definition.sipoc, {suppliers: [{name: 'Fabric mill', supplies: 'Rolls of cloth'}], customers: [{name: 'Boutique'}]}); assert.equal(applied.snapshot.minute, 0);
  await page.locator('#mode-lens').click(); await page.waitForFunction(() => document.querySelectorAll('#lens .sipoc-col-suppliers .sipoc-card').length > 0);
  assert.match(await page.locator('#lens .sipoc-col-suppliers').innerText(), /Fabric mill[\s\S]*Rolls of cloth/); assert.match(await page.locator('#lens .sipoc-col-customers').innerText(), /Boutique/);
 });
 await check('Random view and arrival editor describe and edit normal and Erlang distributions', async () => {
  await freshStudio();
  const out = await page.evaluate(() => {
   const v = (globalThis as unknown as {LWProcessRandomView: LWProcessRandomView.Api}).LWProcessRandomView, c = (f: string, op: LWProcess.Condition['op'], value: LWProcess.Scalar): LWProcess.Condition => ({field: f, op, value});
   return [v.describeDist({dist: 'normal', mean: 30, sd: 5}), v.describeDist({dist: 'normal', mean: 30, sd: 5, min: 20, max: 45}), v.describeDist({dist: 'normal', mean: 30, sd: 5, max: 40}), v.describeDist({dist: 'erlang', k: 3, mean: 30}), v.describeDist({dist: 'erlang', k: 1, mean: 30}),
    v.describeTiming({duration: 30, timing: {dist: 'normal', mean: 30, sd: 5}}), v.describeArrival({at: 0, open: true, interval: 10, gap: {dist: 'normal', mean: 10, sd: 2}, data: {}}), v.describeArrival({at: 0, open: true, interval: 10, gap: {dist: 'erlang', k: 3, mean: 10}, data: {}}),
    v.describeWhen({all: [c('amount', 'gte', 1000), {any: [c('region', 'eq', 'eu'), {not: c('vip', 'eq', true)}]}]}), v.describeWhen({not: {chance: 5}}), v.describeWhen({any: [{chance: 8}, c('a', 'lt', 3)]}), v.describeWhen({not: {all: [c('a', 'eq', 1), c('b', 'ne', 2)]}}),
    v.describeInstances({instances: {count: 3, mode: 'parallel'}}), v.describeInstances({instances: {field: 'lines', mode: 'sequential'}}), v.describeInstances({}),
    v.describeDeadline({deadline: {after: 20, mode: 'escalate', flow: 'x'}}), v.describeDeadline({deadline: {timing: {dist: 'exponential', mean: 4}, mode: 'interrupt', flow: 'x'}}), v.describeDeadline({}),
    v.describeFork({kind: 'fork'}), v.describeFork({kind: 'fork', mode: 'inclusive'}), v.describeFork({kind: 'task'})];
  });
  assert.deepEqual(out, ['Normal, mean 30 min, sd 5', 'Normal, mean 30 min, sd 5 (between 20 and 45)', 'Normal, mean 30 min, sd 5 (between 1 and 40)', 'Erlang, 3 phases, mean 30 min', 'Erlang, 1 phase, mean 30 min',
   'Planned 30 min (the average shown in estimates); each visit draws its own time: Normal, mean 30 min, sd 5', 'Keeps arriving: every ~10 min, random gap (normal, mean 10, sd 2), first at minute 0', 'Keeps arriving: every ~10 min, random gap (erlang, 3 phases, mean 10), first at minute 0',
   'If amount ≥ 1000 and (region = "eu" or not vip = true)', 'If not 5% of cases', 'If 8% of cases or a < 3', 'If not (a = 1 and b ≠ 2)',
   'Runs 3 instances in parallel: all are queued at once and start as capacity allows. The step completes once, when every instance is done.', 'Runs one instance for each unit counted in case field "lines" (1 to 50) one after another: each starts when the one before it is done. The step completes once, when every instance is done.', '',
   'After 20 min of work the deadline escalates: the work keeps going and the deadline path starts beside it.', 'After a random time of work (Exponential, mean 4 min) the deadline interrupts: the work is cancelled and the case takes the deadline path.', '',
   'Parallel fork: starts every branch at once, and its join waits for all of them.', 'Inclusive fork: starts every branch whose condition is true (the branch without a condition if none is), and its join waits for exactly those branches.', '']);
  // Step editor: normal needs mean and a spread of at least 1, optional bounds must leave a range; Erlang needs 1 to 32 phases.
  await importRandom(); await openRandom('pack'); await page.locator('#se-timing-dist').selectOption('normal'); assert.equal(await page.locator('#se-timing-mean').inputValue(), '12'); assert.equal(await page.locator('#se-timing-sd').inputValue(), '3');
  assert.equal(await page.locator('#se-timing-min').inputValue(), ''); assert.equal(await page.locator('#se-timing-max').getAttribute('placeholder'), 'Default mean + 6 × spread');
  await page.locator('#se-timing-sd').fill('0'); assert.match(await page.locator('#se-err-timing').innerText(), /spread.*from 1 to 100,000/); assert.equal(await page.locator('#se-timing-sd').getAttribute('aria-invalid'), 'true'); assert.equal(await page.locator('#se-save').isDisabled(), true); await page.locator('#se-timing-sd').fill('3');
  await page.locator('#se-timing-min').fill('40'); assert.match(await page.locator('#se-err-timing').innerText(), /minimum \(40\) must not be above the maximum \(30, the default of mean \+ 6 × sd\)/); await page.locator('#se-timing-max').fill('35'); assert.match(await page.locator('#se-err-timing').innerText(), /maximum \(35\)\./);
  await page.locator('#se-timing-min').fill('8'); await page.locator('#se-timing-max').fill('20'); assert.equal(await page.locator('#se-err-timing .se-err').count(), 0); await page.locator('#se-save').click(); assert.deepEqual((await savedStep('pack')).timing, {dist: 'normal', mean: 12, sd: 3, min: 8, max: 20});
  await openRandom('pack'); assert.equal(await page.locator('#se-timing-dist').inputValue(), 'normal'); assert.equal(await page.locator('#se-timing-min').inputValue(), '8'); await page.locator('#se-timing-dist').selectOption('erlang'); assert.equal(await page.locator('#se-timing-k').inputValue(), '3'); assert.equal(await page.locator('#se-timing-sd').count(), 0); assert.equal(await page.locator('#se-timing-min').count(), 0);
  for (const bad of ['0', '33']) { await page.locator('#se-timing-k').fill(bad); assert.match(await page.locator('#se-err-timing').innerText(), /phases from 1 to 32/); assert.equal(await page.locator('#se-timing-k').getAttribute('aria-invalid'), 'true'); }
  await page.locator('#se-timing-k').fill('2'); assert.equal(await page.locator('#se-err-timing .se-err').count(), 0); await page.locator('#se-save').click(); assert.deepEqual((await savedStep('pack')).timing, {dist: 'erlang', k: 2, mean: 12});
  await openRandom('pack'); await page.locator('#se-apply').click(); await page.waitForFunction(() => document.querySelectorAll('dialog.pd-dialog[open]').length === 0);
  for (let i = 0; i < 6; i++) await page.locator('#advance').click();
  const packs = (await query(page)).snapshot.receipts.filter(r => r.stepId === 'pack'); assert.ok(packs.length >= 4 && packs.every(r => r.duration !== undefined && r.duration >= 1 && r.duration === r.finished - r.started), 'Erlang visits record realized durations');
  // Definition editor: the arrival gap offers Normal and Erlang with local range checks and the engine's range message.
  await freshStudio(); await openDef(); const arr = (id: string) => page.locator('#tune-arr-0-' + id);
  assert.deepEqual(await arr('gap-dist').locator('option').allInnerTexts(), ['None (exact spacing)', 'Uniform (min to max)', 'Triangular (min, most likely, max)', 'Exponential (average, optional cap)', 'Normal (average and spread, optional bounds)', 'Erlang (phases and average)']);
  await arr('gap-dist').selectOption('normal'); let gap = (await defOf()).arrivals[0]!.gap!; assert.equal(gap.dist, 'normal'); assert.ok(gap.mean! >= 1 && gap.sd! >= 1); assert.equal(await arr('gap-sd').count(), 1); assert.equal(await arr('gap-min').count(), 1);
  await arr('gap-sd').fill('0'); assert.match(await page.locator('#tune-arr-0-gap-sd-err').innerText(), /from 1 to 100,000/); assert.equal(await arr('gap-sd').getAttribute('aria-invalid'), 'true'); await arr('gap-sd').fill('4');
  await arr('gap-min').fill('9'); await arr('gap-max').fill('3'); assert.match(await page.locator('#tune-arr-0-gap-group-err').innerText(), /min at most max/); await arr('gap-max').fill('20'); assert.equal(await page.locator('#tune-arr-0-gap-group-err').innerText(), '');
  gap = (await defOf()).arrivals[0]!.gap!; assert.deepEqual([gap.sd, gap.min, gap.max], [4, 9, 20]); await arr('gap-dist').selectOption('erlang'); gap = (await defOf()).arrivals[0]!.gap!; assert.deepEqual(Object.keys(gap).sort(), ['dist', 'k', 'mean']); assert.equal(gap.k, 3);
  await arr('gap-k').fill('40'); assert.match(await page.locator('#tune-arr-0-gap-k-err').innerText(), /from 1 to 32/); await arr('gap-k').fill('4'); assert.equal(await page.locator('#tune-arr-0-gap-k-err').innerText(), '');
  assert.equal(await arr('gap-dist').getAttribute('aria-invalid'), null); await applyDef(); const applied = await query(page); assert.deepEqual(applied.definition.arrivals[0]!.gap, {dist: 'erlang', k: 4, mean: applied.definition.arrivals[0]!.gap!.mean});
 });
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
  await page.locator('#tune-seed').focus(); await page.keyboard.press('ControlOrMeta+Z'); assert.equal(await draftText(), original); assert.equal(await page.locator('#tune-name').inputValue(), (await query(page)).definition.name);
  await page.keyboard.press('ControlOrMeta+Z'); assert.equal(await page.locator('#de-message').innerText(), 'Nothing to undo.'); assert.equal(await draftText(), original);
  await page.keyboard.press('ControlOrMeta+Shift+Z'); assert.equal(await name(), 'Undo me'); assert.equal(await arrivals(), count);
  await page.keyboard.press('ControlOrMeta+Shift+Z'); assert.equal(await arrivals(), count - 1); assert.equal(await page.locator('#de-message').innerText(), 'Redone. Ctrl+Z (Cmd+Z on a Mac) undoes it again.');
  await page.keyboard.press('ControlOrMeta+Shift+Z'); assert.equal(await page.locator('#de-message').innerText(), 'Nothing to redo.');
  // A new edit after undo starts a new branch: redo has nothing left.
  await page.keyboard.press('ControlOrMeta+Z'); await page.locator('#tune-seed').fill('9'); await page.keyboard.press('ControlOrMeta+Shift+Z'); assert.equal(await page.locator('#de-message').innerText(), 'Nothing to redo.');
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
  assert.equal(await dialogImages(), 0); assert.equal(await page.locator('#se-pools-0-count').getAttribute('max'), null, 'a capacity that is not a number is not written as a bound');
  assert.match(await page.locator('#se-pools-0-count-help').innerText(), /<img src=x/); await nextFrames(page); assert.equal(await pwned(), undefined);
  await page.locator('#se-close').click(); await openDef(); await restoreDef(); await closeDef();
 });
 await calendarChecks(studio);
 await inspectorChecks(studio);
 await checkLifecycle('Process definition editor browser lifecycle emits no runtime errors or network requests');
});
