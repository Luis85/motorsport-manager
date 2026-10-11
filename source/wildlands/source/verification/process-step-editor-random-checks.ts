/// <reference path="../process-contracts.d.ts" />
/**
 * Companion of process-step-editor-browser.ts (the suite over its size budget once reflowed): random timing, case draws and
 * chance routes in the step editor, and the planning duration beside random timing with inline checks of inconsistent
 * distributions. Registered under the `process-step-editor-browser` suite; the suite entry calls `randomChecks` after the
 * apply-over-run check, so the check order is unchanged.
 */
import assert from 'node:assert/strict';
import {query, type Studio} from './process-browser-fixture';
import {stepEditorKit} from './process-step-editor-kit';

/** Random timing, draws and chance routes, and the planning duration with inline distribution problems. */
export async function randomChecks(studio: Studio): Promise<void> {
 const {page, check, showIo, draftText, dialogOpen, activeId, importRandom, openRandom, savedStep} = studio;
 const {dlgText} = stepEditorKit(page);
 await check('Step editor edits random timing, draws and chance routes and keeps them valid', async () => {
  await importRandom(); await openRandom('pack');
  assert.equal(await page.locator('#se-h-random-timing').count(), 1);
  assert.equal(await page.locator('#se-timing-dist').inputValue(), '');
  assert.equal(await page.locator('#se-timing-min').count(), 0);
  await page.locator('#se-timing-dist').selectOption('uniform');
  assert.equal(await page.locator('#se-timing-min').inputValue(), '6');
  assert.equal(await page.locator('#se-timing-max').inputValue(), '18');
  await page.locator('#se-timing-min').fill('8');
  await page.locator('#se-timing-max').fill('14');
  assert.equal(await page.locator('#se-err-timing .se-err').count(), 0);
  // Random outcomes: chance, weighted choice and whole number rows.
  assert.equal(await page.locator('#se-h-random-outcomes').count(), 1);
  assert.match(await dlgText(), /applied when the step completes, after Set values and before counters/);
  await page.locator('#se-add-draw').click();
  assert.equal(await activeId(), 'se-draws-0-field');
  await page.locator('#se-draws-0-field').fill('defect');
  await page.locator('#se-draws-0-percent').fill('12');
  await page.locator('#se-add-draw').click();
  await page.locator('#se-draws-1-field').fill('defect');
  assert.match(await page.locator('#se-err-draws-1').innerText(), /drawn twice/);
  assert.equal(await page.locator('#se-draws-1-field').getAttribute('aria-invalid'), 'true');
  await page.locator('#se-draws-1-field').fill('packed'); assert.match(await page.locator('#se-err-draws-1').innerText(), /also in Set a value/);
  await page.locator('#se-draws-1-field').fill('priority');
  await page.locator('#se-draws-1-kind').selectOption('choice');
  assert.equal(await page.locator('#se-draws-1-values-1-weight').count(), 1);
  await page.locator('#se-draws-1-values-0-value-text').fill('standard');
  await page.locator('#se-draws-1-values-0-weight').fill('80');
  await page.locator('#se-draws-1-values-1-value-text').fill('express');
  await page.locator('#se-draws-1-values-1-weight').fill('20');
  assert.equal(await page.locator('[data-act="remove-choice"][data-i="1"][data-j="0"]').isDisabled(), true, 'a weighted choice keeps two values');
  await page.locator('#se-add-choice-1').click();
  assert.equal(await page.locator('[data-act="remove-choice"][data-i="1"][data-j="2"]').isEnabled(), true);
  await page.locator('[data-act="remove-choice"][data-i="1"][data-j="2"]').click();
  assert.equal(await page.locator('#se-draws-1-values-2-weight').count(), 0);
  await page.locator('#se-add-draw').click();
  await page.locator('#se-draws-2-field').fill('size');
  await page.locator('#se-draws-2-kind').selectOption('int');
  await page.locator('#se-draws-2-min').fill('1');
  await page.locator('#se-draws-2-max').fill('6');
  for (let i = 3; i < 8; i++) await page.locator('#se-add-draw').click();
  assert.equal(await page.locator('#se-add-draw').isDisabled(), true);
  assert.match(await page.locator('#se-max-draws').innerText(), /At most 8/);
  for (let i = 7; i >= 3; i--) await page.locator(`[data-act="remove-draw"][data-i="${i}"]`).click();
  assert.equal(await page.locator('#se-add-draw').isEnabled(), true);
  assert.equal(await activeId(), 'se-add-draw');
  assert.equal(await page.locator('#se-save').isEnabled(), true); await page.locator('#se-save').click(); assert.equal(await dialogOpen(), 0);
  const pack = await savedStep('pack'); assert.deepEqual(pack.timing, {dist: 'uniform', min: 8, max: 14}); assert.equal(pack.duration, 12);
  assert.deepEqual(pack.draws, [
   {field: 'defect', kind: 'chance', percent: 12},
   {
    field: 'priority',
    kind: 'choice',
    values: [
     {value: 'standard', weight: 80},
     {value: 'express', weight: 20}
    ]
   },
   {field: 'size', kind: 'int', min: 1, max: 6}
  ]);
  // Chance routes are editable on a decision and show their share in the path summary.
  await openRandom('gate');
  assert.equal(await page.locator('#se-h-random-timing').count(), 0);
  assert.equal(await page.locator('#se-h-random-outcomes').count(), 0);
  assert.deepEqual(await page.locator('#se-path-summary li').allInnerTexts(), ['20% of cases → Repack', 'Otherwise → Done']);
  assert.equal(await page.locator('#se-flows-0-cond-mode-chance').isChecked(), true);
  assert.equal(await page.locator('#se-flows-0-cond-chance').inputValue(), '20');
  await page.locator('#se-flows-0-cond-chance').fill('8'); assert.equal((await page.locator('#se-path-summary li').allInnerTexts())[0], '8% of cases → Repack');
  await page.locator('#se-flows-0-cond-chance').fill('0');
  assert.match(await page.locator('#se-err-flows-0').innerText(), /whole percent from 1 to 99/);
  assert.equal(await page.locator('#se-save').isDisabled(), true);
  await page.locator('#se-flows-0-cond-mode-value').check();
  assert.equal(await page.locator('#se-flows-0-cond-chance').count(), 0);
  assert.equal(await page.locator('#se-flows-0-cond-field').count(), 1);
  await page.locator('#se-flows-0-cond-mode-chance').check();
  assert.equal(await page.locator('#se-flows-0-cond-chance').inputValue(), '0');
  await page.locator('#se-flows-0-cond-chance').fill('8');
  await page.locator('#se-flows-1-cond-on').check();
  await page.locator('#se-flows-1-cond-mode-chance').check();
  await page.locator('#se-flows-1-cond-chance').fill('30');
  assert.match(await page.locator('#se-status').innerText(), /exactly one unconditional fallback/); await page.locator('#se-flows-1-cond-on').uncheck();
  await page.locator('#se-save').click();
  const gate = (JSON.parse(await draftText()) as LWProcess.Definition).flows.filter(f => f.from === 'gate');
  assert.deepEqual(gate.map(f => f.when), [{chance: 8}, undefined]);
  // The edited draft is accepted by the engine and a seeded run records realized durations and drawn values.
  const verdict = await page.evaluate(
   text => (globalThis as unknown as {LWProcessCatalog: LWProcess.Catalog}).LWProcessCatalog.validate(JSON.parse(text)).ok,
   await draftText()
  );
  assert.equal(verdict, true);
  await openRandom('pack');
  await page.locator('#se-apply').click();
  await page.waitForFunction(() => document.querySelectorAll('dialog.pd-dialog[open]').length === 0);
  for (let i = 0; i < 14; i++) if (!(await page.locator('#advance').isDisabled())) await page.locator('#advance').click();
  const run = (await query(page)).snapshot, packs = run.receipts.filter(r => r.stepId === 'pack');
  assert.ok(packs.length >= 4, 'several pack visits finished');
  assert.ok(packs.every(r => r.duration !== undefined && r.duration === r.finished - r.started && r.duration >= 8 && r.duration <= 14));
  assert.ok(
   packs.every(
    r =>
     typeof r.changes.defect === 'boolean' &&
     ['standard', 'express'].includes(String(r.changes.priority)) &&
     Number(r.changes.size) >= 1 &&
     Number(r.changes.size) <= 6
   )
  );
  assert.equal(run.receipts.filter(r => r.stepId === 'repack').every(r => r.duration === undefined), true, 'deterministic steps record no realized duration');
  await showIo();
  await page.locator('[data-step="pack"]').click();
  assert.match(await page.locator('#process-data').innerText(), /Took \d+ min \(planned 12\)/);
  assert.ok(await page.locator('#process-data .se-drawn').count() >= 3);
  await page.locator('[data-step="repack"]').click();
  assert.doesNotMatch(await page.locator('#process-data').innerText(), /Took \d+ min/);
  assert.equal(await page.locator('#process-data .se-drawn').count(), 0);
 });
 await check('Step editor explains the planning duration next to random timing and rejects inconsistent distributions inline', async () => {
  await importRandom(); await openRandom('pack'); await page.locator('#se-timing-dist').selectOption('triangular');
  assert.equal(
   await page.locator('#se-timing-note').innerText(),
   'Planning duration (12 min) stays the average shown in estimates; each visit draws its own time.'
  );
  await page.locator('#se-duration').fill('20');
  // Draws that average more than 5% away from the planning duration say so, as the inspector does (LWProcessRandomView.meanOf).
  assert.equal(await page.locator('#se-timing-note').innerText(), 'Planning duration 20 min; draws average about 12 min.');
  await page.locator('#se-duration').fill('12');
  await page.locator('#se-timing-min').fill('20'); await page.locator('#se-timing-mode').fill('10'); await page.locator('#se-timing-max').fill('5');
  assert.match(await page.locator('#se-err-timing').innerText(), /minimum ≤ most likely ≤ maximum/);
  assert.equal(await page.locator('#se-timing-mode').getAttribute('aria-invalid'), 'true');
  assert.equal(await page.locator('#se-save').isDisabled(), true); assert.equal(await page.locator('#se-apply').isDisabled(), true);
  await page.locator('#se-timing-min').fill('4');
  await page.locator('#se-timing-mode').fill('6');
  await page.locator('#se-timing-max').fill('10');
  assert.equal(await page.locator('#se-err-timing .se-err').count(), 0);
  assert.equal(await page.locator('#se-save').isEnabled(), true);
  await page.locator('#se-timing-dist').selectOption('uniform'); await page.locator('#se-timing-min').fill('9'); await page.locator('#se-timing-max').fill('4');
  assert.match(await page.locator('#se-err-timing').innerText(), /minimum \(9\) must not be above the maximum \(4\)/);
  assert.equal(await page.locator('#se-timing-min').getAttribute('aria-invalid'), 'true');
  await page.locator('#se-timing-dist').selectOption('exponential');
  assert.equal(await page.locator('#se-timing-mean').inputValue(), '12');
  await page.locator('#se-timing-max').fill('3');
  assert.match(await page.locator('#se-err-timing').innerText(), /cap \(3\) must not be below the mean \(12\)/);
  await page.locator('#se-timing-mean').fill('4');
  await page.locator('#se-timing-max').fill('');
  assert.equal(await page.locator('#se-err-timing .se-err').count(), 0);
  await page.locator('#se-timing-max').fill('12');
  await page.locator('#se-save').click();
  assert.deepEqual((await savedStep('pack')).timing, {dist: 'exponential', mean: 4, max: 12});
  // None removes the distribution again; the planning duration stays.
  await openRandom('pack');
  await page.locator('#se-timing-dist').selectOption('');
  assert.equal(await page.locator('#se-timing-note').count(), 0);
  await page.locator('#se-save').click();
  assert.equal((await savedStep('pack')).timing, undefined);
  assert.equal((await savedStep('pack')).duration, 12);
  // Duration timers may be random; until timers and other kinds are not offered the section.
  await openRandom('cool');
  assert.equal(await page.locator('#se-h-random-timing').count(), 1);
  await page.locator('#se-timing-dist').selectOption('exponential');
  assert.equal(await page.locator('#se-timing-mean').inputValue(), '30');
  await page.locator('#se-save').click();
  assert.deepEqual((await savedStep('cool')).timing, {dist: 'exponential', mean: 30});
  await openRandom('dock');
  assert.equal(await page.locator('#se-h-random-timing').count(), 0);
  assert.equal(await page.locator('#se-h-random-outcomes').count(), 1);
  await page.locator('#se-close').click();
  await openRandom('start');
  assert.equal(await page.locator('#se-h-random-timing').count(), 0);
  assert.equal(await page.locator('#se-h-random-outcomes').count(), 0);
  await page.locator('#se-close').click();
  // Engine diagnostics for timing and draws map to the editor fields as well.
  const mapped = await page.evaluate(() => {
   const g = globalThis as unknown as {LWProcessCatalog: LWProcess.Catalog; LWProcessStepChecks: LWProcessStepChecks.Api};
   const def = {
    ...JSON.parse(
     JSON.stringify((globalThis as unknown as {LWProcessStudio: {query(): {definition: LWProcess.Definition}}}).LWProcessStudio.query().definition)
    )
   } as LWProcess.Definition;
   const pack = def.steps.find(s => s.id === 'pack')!;
   pack.timing = {dist: 'uniform', min: 9, max: 4};
   pack.draws = [{field: 'packed', kind: 'chance', percent: 12}, {field: 'x', kind: 'int', min: 5, max: 1}];
   return g.LWProcessStepChecks.scope(def, 'pack', g.LWProcessCatalog.validate(def, true).diagnostics).map(i => i.key + '|' + i.message);
  });
  assert.ok(mapped.some(m => m.startsWith('timing|') && /min at most max/.test(m)), mapped.join('\n'));
  assert.ok(mapped.some(m => m.startsWith('draws.0.field|') && /one writer/.test(m)));
  assert.ok(mapped.some(m => m.startsWith('draws.1|') && /min at most max/.test(m)));
 });
}
