/// <reference path="../process-contracts.d.ts" />
/**
 * Companion of process-definition-browser.ts (the suite over its size budget once reflowed): the Tune values form for the seed,
 * resource kinds and capacities and arrival streams (end rules, random gaps, data fields and draws), and the Normal and Erlang
 * distributions in the random view, the step editor's timing and the arrival gap. Registered under the `process-definition-browser`
 * suite; the suite entry calls `arrivalChecks` after its opening check and `distributionChecks` after the SIPOC check, so the
 * check order is unchanged.
 */
import assert from 'node:assert/strict';
import {query, type Studio} from './process-browser-fixture';

/** Seed, resource kinds and arrival end rules, gaps, data fields and draws in Tune values. */
export async function arrivalChecks(studio: Studio): Promise<void> {
 const {page, check, freshStudio, openDef, closeDef, restoreDef, defOf, inSync, activeId} = studio;
 await check('Definition editor edits seed, resource kinds and arrival end rules, gaps and draws with inline problems', async () => {
  await page.setViewportSize({width: 1440, height: 1060});
  await freshStudio();
  await openDef();
  const seed = page.locator('#tune-seed'), arr = (id: string) => page.locator('#tune-arr-0-' + id), pool = page.locator('#tune-res-0-kind');
  assert.match(await page.locator('#tune-seed-help').innerText(), /Same seed, same run\. Change it to see another scenario/);
  assert.equal(await page.locator('label[for="tune-seed"]').innerText(), 'Seed');
  await seed.fill('42'); assert.equal((await defOf()).seed, 42); await seed.fill('1.5'); assert.equal((await defOf()).seed, 42, 'a fraction is not written');
  assert.match(await page.locator('#tune-seed-err').innerText(), /whole number/); assert.equal(await seed.getAttribute('aria-invalid'), 'true');
  await seed.fill('2147483648');
  assert.match(await page.locator('#tune-seed-err').innerText(), /from 0 to 2,147,483,647/);
  assert.equal(await seed.getAttribute('aria-invalid'), 'true');
  await inSync();
  await seed.fill('7');
  assert.equal(await page.locator('#tune-seed-err').innerText(), '');
  assert.equal(await seed.getAttribute('aria-invalid'), null);
  await seed.fill('');
  assert.equal(Object.hasOwn(await defOf(), 'seed'), false);
  // Resource kind: written only when it is not people; the engine's own diagnostics speak.
  assert.equal(Object.hasOwn((await defOf()).resources[0]!, 'kind'), false);
  assert.deepEqual(await page.locator('#tune-res-0-kind option').allInnerTexts(), ['People', 'Machine', 'System']);
  await pool.selectOption('machine');
  assert.equal((await defOf()).resources[0]!.kind, 'machine');
  assert.match(await page.locator('#tune-res-0-kind-err').innerText(), /may demand only people pools/);
  assert.equal(await pool.getAttribute('aria-invalid'), 'true');
  assert.match(await page.locator('#diagnostics').innerText(), /may demand only people pools/);
  await pool.selectOption('system');
  assert.equal((await defOf()).resources[0]!.kind, 'system');
  await pool.selectOption('people');
  assert.equal(Object.hasOwn((await defOf()).resources[0]!, 'kind'), false);
  assert.equal(await page.locator('#diagnostics li').count(), 0);
  await page.locator('#tune-res-0-cap').fill('0');
  assert.equal(await page.locator('#tune-res-0-cap').getAttribute('aria-invalid'), 'true');
  assert.match(await page.locator('#tune-res-0-cap-err').innerText(), /from 1 to 1,000/);
  await page.locator('#tune-res-0-cap').fill('2');
  assert.equal((await defOf()).resources[0]!.capacity, 2);
  // Arrival end rules.
  const first = (await defOf()).arrivals[0]!; assert.equal(await page.locator('#tune-arr-0-end-count').isChecked(), true);
  await arr('end-until').check();
  let a = (await defOf()).arrivals[0]!;
  assert.equal(a.count, undefined);
  assert.equal(typeof a.until, 'number');
  assert(a.until! > a.at);
  assert.equal(await arr('until').count(), 1);
  await arr('end-open').check();
  a = (await defOf()).arrivals[0]!;
  assert.deepEqual([a.open, a.until, a.count], [true, undefined, undefined]);
  assert.equal(await arr('count').count(), 0);
  await arr('interval').fill('0');
  assert.match(await page.locator('#tune-arr-0-interval-err').innerText(), /interval of at least 1 minute/);
  assert.equal(await arr('interval').getAttribute('aria-invalid'), 'true');
  await arr('interval').fill('10');
  assert.equal(await page.locator('#tune-arr-0-interval-err').innerText(), '');
  await arr('end-count').check();
  a = (await defOf()).arrivals[0]!;
  assert.equal(a.open, undefined);
  assert.equal(typeof a.count, 'number');
  await arr('count').fill('201');
  assert.match(await page.locator('#tune-arr-0-count-err').innerText(), /from 1 to 200/);
  await arr('count').fill(String(first.count ?? 3));
  // Random gap.
  assert.deepEqual(await arr('gap-dist').locator('option').allInnerTexts(), [
   'None (exact spacing)',
   'Uniform (min to max)',
   'Triangular (min, most likely, max)',
   'Exponential (average, optional cap)',
   'Normal (average and spread, optional bounds)',
   'Erlang (phases and average)'
  ]);
  await arr('gap-dist').selectOption('uniform');
  assert.equal((await defOf()).arrivals[0]!.gap!.dist, 'uniform');
  await arr('gap-min').fill('9');
  await arr('gap-max').fill('3');
  assert.match(await page.locator('#tune-arr-0-gap-group-err').innerText(), /min at most max/);
  assert.equal(await arr('gap-min').getAttribute('aria-invalid'), 'true');
  await arr('gap-max').fill('12');
  assert.equal(await page.locator('#tune-arr-0-gap-group-err').innerText(), '');
  await arr('gap-dist').selectOption('triangular');
  assert.deepEqual(Object.keys((await defOf()).arrivals[0]!.gap!).sort(), ['dist', 'max', 'min', 'mode']);
  await arr('gap-dist').selectOption('exponential');
  assert.deepEqual(Object.keys((await defOf()).arrivals[0]!.gap!).sort(), ['dist', 'mean']);
  assert.equal(await arr('gap-max').count(), 1); await arr('gap-dist').selectOption('none'); assert.equal((await defOf()).arrivals[0]!.gap, undefined);
  // Arrival data fields.
  await page.locator('[data-act="data-add"]').first().click();
  let data = (await defOf()).arrivals[0]!.data;
  const added = Object.keys(data).at(-1)!;
  assert.equal(data[added], '');
  const idx = Object.keys(data).length - 1, rename = page.locator(`#tune-arr-0-data-${idx}-name`);
  await rename.fill('Bad name');
  await rename.press('Tab');
  assert.match(await page.locator(`#tune-arr-0-data-${idx}-name-err`).innerText(), /lowercase letter/);
  assert.equal(Object.hasOwn((await defOf()).arrivals[0]!.data, added), true);
  await rename.fill('urgency'); await rename.press('Tab'); data = (await defOf()).arrivals[0]!.data; assert.deepEqual(Object.keys(data).at(-1), 'urgency');
  await page.locator(`#tune-arr-0-data-${idx}-value-type`).selectOption('number');
  await page.locator(`#tune-arr-0-data-${idx}-value`).fill('3');
  assert.equal((await defOf()).arrivals[0]!.data.urgency, 3);
  await page.locator(`#tune-arr-0-data-${idx}-value-type`).selectOption('boolean');
  assert.equal((await defOf()).arrivals[0]!.data.urgency, true);
  await page.locator('[data-act="data-remove"][data-name="urgency"]').click();
  assert.equal(Object.hasOwn((await defOf()).arrivals[0]!.data, 'urgency'), false);
  // Arrival draws.
  await page.locator('[data-act="draw-add"]').first().click();
  let draw = (await defOf()).arrivals[0]!.draws![0]!;
  assert.deepEqual([draw.kind, draw.percent], ['chance', 50]);
  await page.locator('#tune-arr-0-draw-0-percent').fill('100');
  assert.match(await page.locator('#tune-arr-0-draw-0-percent-err').innerText(), /whole percent from 1 to 99/);
  await page.locator('#tune-arr-0-draw-0-percent').fill('30');
  await page.locator('#tune-arr-0-draw-0-true-type').selectOption('string');
  await page.locator('#tune-arr-0-draw-0-true').fill('urgent');
  await page.locator('#tune-arr-0-draw-0-false-type').selectOption('string');
  await page.locator('#tune-arr-0-draw-0-false').fill('routine');
  draw = (await defOf()).arrivals[0]!.draws![0]!; assert.deepEqual([draw.percent, draw.whenTrue, draw.whenFalse], [30, 'urgent', 'routine']);
  await page.locator('#tune-arr-0-draw-0-kind').selectOption('choice');
  draw = (await defOf()).arrivals[0]!.draws![0]!;
  assert.equal(draw.values!.length, 2);
  assert.equal(draw.percent, undefined);
  await page.locator('[data-act="value-add"]').first().click();
  assert.equal((await defOf()).arrivals[0]!.draws![0]!.values!.length, 3);
  await page.locator('#tune-arr-0-draw-0-w0').fill('0');
  assert.match(await page.locator('#tune-arr-0-draw-0-w0-err').innerText(), /from 1 to 1000/);
  await page.locator('#tune-arr-0-draw-0-w0').fill('5');
  await page.locator('#tune-arr-0-draw-0-kind').selectOption('int');
  draw = (await defOf()).arrivals[0]!.draws![0]!;
  assert.deepEqual([draw.min, draw.max, draw.values], [1, 10, undefined]);
  await page.locator('#tune-arr-0-draw-0-min').fill('20');
  assert.match(await page.locator('#tune-arr-0-draw-0-err2').innerText(), /min at most max/);
  await page.locator('[data-act="draw-remove"]').first().click();
  assert.equal((await defOf()).arrivals[0]!.draws, undefined);
  // Add and remove arrivals.
  await page.locator('#tune-arr-add').click();
  const total = (await defOf()).arrivals.length;
  assert.equal(total, 3);
  await page.locator('[data-act="arr-remove"]').last().click();
  await page.locator('[data-act="arr-remove"]').last().click();
  assert.equal((await defOf()).arrivals.length, 1);
  assert.equal(await page.locator('[data-act="arr-remove"]').isDisabled(), true);
  // Each pool says which steps use it; removing a used pool asks first, starting on Cancel, and then clears those demands.
  const owner = page.locator('[data-act="res-remove"][data-i="0"]'),
   demands = async () => (await defOf()).steps.filter(s => s.resources && 'product-owner' in s.resources).map(s => s.id);
  assert.equal(await page.locator('#tune-res-0-used').innerText(), 'Used by Discovery and Client handover.');
  assert.equal(await owner.getAttribute('aria-describedby'), 'tune-res-0-used');
  await owner.click();
  assert.equal(
   await page.locator('#de-confirm-title').innerText(),
   'Discovery and Client handover still use Product owner. Removing the pool also clears those demands.'
  );
  assert.deepEqual(await page.locator('#de-choices button').allInnerTexts(), ['Cancel', 'Remove and clear demands']);
  assert.equal(await activeId(), 'de-keep-pool');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#de-confirm').isHidden(), true);
  assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.act), 'res-remove');
  assert.equal((await defOf()).resources[0]!.id, 'product-owner'); assert.deepEqual(await demands(), ['discovery', 'handover']);
  await owner.click(); await page.locator('#de-keep-pool').click(); assert.equal((await defOf()).resources[0]!.id, 'product-owner', 'Cancel keeps the pool');
  await owner.click();
  await page.locator('#de-remove-pool').click();
  assert.equal((await defOf()).resources.some(r => r.id === 'product-owner'), false);
  assert.deepEqual(await demands(), []);
  assert.equal(await activeId(), 'tune-res-add'); await page.locator('#tune-res-add').click(); const fresh = (await defOf()).resources.length - 1;
  assert.equal(await page.locator(`#tune-res-${fresh}-used`).innerText(), 'Not used by any step yet.');
  await page.locator(`[data-act="res-remove"][data-i="${fresh}"]`).click();
  assert.equal(await page.locator('#de-confirm').isHidden(), true, 'an unused pool is removed without asking');
  assert.equal((await defOf()).resources.length, fresh);
  await restoreDef(); await closeDef(); assert.equal(await page.locator('#draft-chip').isHidden(), true);
 });
}

/** Normal and Erlang distributions in the random view, the step editor and the arrival gap. */
export async function distributionChecks(studio: Studio): Promise<void> {
 const {page, check, freshStudio, openDef, applyDef, defOf, importRandom, openRandom, savedStep} = studio;
 await check('Random view and arrival editor describe and edit normal and Erlang distributions', async () => {
  await freshStudio();
  const out = await page.evaluate(() => {
   const v = (globalThis as unknown as {LWProcessRandomView: LWProcessRandomView.Api}).LWProcessRandomView,
    c = (f: string, op: LWProcess.Condition['op'], value: LWProcess.Scalar): LWProcess.Condition => ({field: f, op, value});
   return [
    v.describeDist({dist: 'normal', mean: 30, sd: 5}),
    v.describeDist({dist: 'normal', mean: 30, sd: 5, min: 20, max: 45}),
    v.describeDist({dist: 'normal', mean: 30, sd: 5, max: 40}),
    v.describeDist({dist: 'erlang', k: 3, mean: 30}),
    v.describeDist({dist: 'erlang', k: 1, mean: 30}),
    v.describeTiming({duration: 30, timing: {dist: 'normal', mean: 30, sd: 5}}),
    v.describeArrival({at: 0, open: true, interval: 10, gap: {dist: 'normal', mean: 10, sd: 2}, data: {}}),
    v.describeArrival({at: 0, open: true, interval: 10, gap: {dist: 'erlang', k: 3, mean: 10}, data: {}}),
    v.describeWhen({all: [c('amount', 'gte', 1000), {any: [c('region', 'eq', 'eu'), {not: c('vip', 'eq', true)}]}]}),
    v.describeWhen({not: {chance: 5}}),
    v.describeWhen({any: [{chance: 8}, c('a', 'lt', 3)]}),
    v.describeWhen({not: {all: [c('a', 'eq', 1), c('b', 'ne', 2)]}}),
    v.describeInstances({instances: {count: 3, mode: 'parallel'}}),
    v.describeInstances({instances: {field: 'lines', mode: 'sequential'}}),
    v.describeInstances({}),
    v.describeDeadline({deadline: {after: 20, mode: 'escalate', flow: 'x'}}),
    v.describeDeadline({deadline: {timing: {dist: 'exponential', mean: 4}, mode: 'interrupt', flow: 'x'}}),
    v.describeDeadline({}),
    v.describeFork({kind: 'fork'}),
    v.describeFork({kind: 'fork', mode: 'inclusive'}),
    v.describeFork({kind: 'task'})
   ];
  });
  assert.deepEqual(out, [
   'Normal, mean 30 min, sd 5',
   'Normal, mean 30 min, sd 5 (between 20 and 45)',
   'Normal, mean 30 min, sd 5 (between 1 and 40)',
   'Erlang, 3 phases, mean 30 min',
   'Erlang, 1 phase, mean 30 min',
   'Planned 30 min (the average shown in estimates); each visit draws its own time: Normal, mean 30 min, sd 5',
   'Keeps arriving: every ~10 min, random gap (normal, mean 10, sd 2), first at minute 0',
   'Keeps arriving: every ~10 min, random gap (erlang, 3 phases, mean 10), first at minute 0',
   'If amount ≥ 1000 and (region = "eu" or not vip = true)',
   'If not 5% of cases',
   'If 8% of cases or a < 3',
   'If not (a = 1 and b ≠ 2)',
   'Runs 3 instances in parallel: all are queued at once and start as capacity allows. The step completes once, when every instance is done.',
   'Runs one instance for each unit counted in case field "lines" (1 to 50) one after another: ' +
    'each starts when the one before it is done. The step completes once, when every instance is done.',
   '',
   'After 20 min of work the deadline escalates: the work keeps going and the deadline path starts beside it.',
   'After a random time of work (Exponential, mean 4 min) the deadline interrupts: the work is cancelled and the case takes the deadline path.',
   '',
   'Parallel fork: starts every branch at once, and its join waits for all of them.',
   'Inclusive fork: starts every branch whose condition is true (the branch without a condition if none is), and its join waits for exactly those branches.',
   ''
  ]);
  // Step editor: normal needs mean and a spread of at least 1, optional bounds must leave a range; Erlang needs 1 to 32 phases.
  await importRandom();
  await openRandom('pack');
  await page.locator('#se-timing-dist').selectOption('normal');
  assert.equal(await page.locator('#se-timing-mean').inputValue(), '12');
  assert.equal(await page.locator('#se-timing-sd').inputValue(), '3');
  assert.equal(await page.locator('#se-timing-min').inputValue(), '');
  assert.equal(await page.locator('#se-timing-max').getAttribute('placeholder'), 'Default mean + 6 × spread');
  await page.locator('#se-timing-sd').fill('0');
  assert.match(await page.locator('#se-err-timing').innerText(), /spread.*from 1 to 100,000/);
  assert.equal(await page.locator('#se-timing-sd').getAttribute('aria-invalid'), 'true');
  assert.equal(await page.locator('#se-save').isDisabled(), true);
  await page.locator('#se-timing-sd').fill('3');
  await page.locator('#se-timing-min').fill('40');
  assert.match(await page.locator('#se-err-timing').innerText(), /minimum \(40\) must not be above the maximum \(30, the default of mean \+ 6 × sd\)/);
  await page.locator('#se-timing-max').fill('35');
  assert.match(await page.locator('#se-err-timing').innerText(), /maximum \(35\)\./);
  await page.locator('#se-timing-min').fill('8');
  await page.locator('#se-timing-max').fill('20');
  assert.equal(await page.locator('#se-err-timing .se-err').count(), 0);
  await page.locator('#se-save').click();
  assert.deepEqual((await savedStep('pack')).timing, {dist: 'normal', mean: 12, sd: 3, min: 8, max: 20});
  await openRandom('pack');
  assert.equal(await page.locator('#se-timing-dist').inputValue(), 'normal');
  assert.equal(await page.locator('#se-timing-min').inputValue(), '8');
  await page.locator('#se-timing-dist').selectOption('erlang');
  assert.equal(await page.locator('#se-timing-k').inputValue(), '3');
  assert.equal(await page.locator('#se-timing-sd').count(), 0);
  assert.equal(await page.locator('#se-timing-min').count(), 0);
  for (const bad of ['0', '33']) {
   await page.locator('#se-timing-k').fill(bad);
   assert.match(await page.locator('#se-err-timing').innerText(), /phases from 1 to 32/);
   assert.equal(await page.locator('#se-timing-k').getAttribute('aria-invalid'), 'true');
  }
  await page.locator('#se-timing-k').fill('2');
  assert.equal(await page.locator('#se-err-timing .se-err').count(), 0);
  await page.locator('#se-save').click();
  assert.deepEqual((await savedStep('pack')).timing, {dist: 'erlang', k: 2, mean: 12});
  await openRandom('pack');
  await page.locator('#se-apply').click();
  await page.waitForFunction(() => document.querySelectorAll('dialog.pd-dialog[open]').length === 0);
  for (let i = 0; i < 6; i++) await page.locator('#advance').click();
  const packs = (await query(page)).snapshot.receipts.filter(r => r.stepId === 'pack');
  assert.ok(
   packs.length >= 4 && packs.every(r => r.duration !== undefined && r.duration >= 1 && r.duration === r.finished - r.started),
   'Erlang visits record realized durations'
  );
  // Definition editor: the arrival gap offers Normal and Erlang with local range checks and the engine's range message.
  await freshStudio(); await openDef(); const arr = (id: string) => page.locator('#tune-arr-0-' + id);
  assert.deepEqual(await arr('gap-dist').locator('option').allInnerTexts(), [
   'None (exact spacing)',
   'Uniform (min to max)',
   'Triangular (min, most likely, max)',
   'Exponential (average, optional cap)',
   'Normal (average and spread, optional bounds)',
   'Erlang (phases and average)'
  ]);
  await arr('gap-dist').selectOption('normal');
  let gap = (await defOf()).arrivals[0]!.gap!;
  assert.equal(gap.dist, 'normal');
  assert.ok(gap.mean! >= 1 && gap.sd! >= 1);
  assert.equal(await arr('gap-sd').count(), 1);
  assert.equal(await arr('gap-min').count(), 1);
  await arr('gap-sd').fill('0');
  assert.match(await page.locator('#tune-arr-0-gap-sd-err').innerText(), /from 1 to 100,000/);
  assert.equal(await arr('gap-sd').getAttribute('aria-invalid'), 'true');
  await arr('gap-sd').fill('4');
  await arr('gap-min').fill('9');
  await arr('gap-max').fill('3');
  assert.match(await page.locator('#tune-arr-0-gap-group-err').innerText(), /min at most max/);
  await arr('gap-max').fill('20');
  assert.equal(await page.locator('#tune-arr-0-gap-group-err').innerText(), '');
  gap = (await defOf()).arrivals[0]!.gap!;
  assert.deepEqual([gap.sd, gap.min, gap.max], [4, 9, 20]);
  await arr('gap-dist').selectOption('erlang');
  gap = (await defOf()).arrivals[0]!.gap!;
  assert.deepEqual(Object.keys(gap).sort(), ['dist', 'k', 'mean']);
  assert.equal(gap.k, 3);
  await arr('gap-k').fill('40');
  assert.match(await page.locator('#tune-arr-0-gap-k-err').innerText(), /from 1 to 32/);
  await arr('gap-k').fill('4');
  assert.equal(await page.locator('#tune-arr-0-gap-k-err').innerText(), '');
  assert.equal(await arr('gap-dist').getAttribute('aria-invalid'), null);
  await applyDef();
  const applied = await query(page);
  assert.deepEqual(applied.definition.arrivals[0]!.gap, {dist: 'erlang', k: 4, mean: applied.definition.arrivals[0]!.gap!.mean});
 });
}
