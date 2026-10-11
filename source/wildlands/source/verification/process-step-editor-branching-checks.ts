/// <reference path="../process-contracts.d.ts" />
/**
 * Companion of process-step-editor-browser.ts (the suite over its size budget once reflowed): inclusive forks, multiple
 * instances, deadlines and combined conditions, and adding, retargeting and removing outgoing paths with a new path offered as
 * the deadline path. Registered under the `process-step-editor-browser` suite; the suite entry calls `branchingChecks` after
 * `randomChecks`, so the check order is unchanged.
 */
import assert from 'node:assert/strict';
import {query, type Studio} from './process-browser-fixture';
import {stepEditorKit} from './process-step-editor-kit';

/** Inclusive forks, instances, deadlines, combined conditions and outgoing paths. */
export async function branchingChecks(studio: Studio): Promise<void> {
 const {page, check, draftText, defOf, dialogOpen, activeId, openRandom, importClaims} = studio;
 const {dlgText, catalogOk, discard} = stepEditorKit(page);
 await check('Step editor edits inclusive forks, multiple instances, deadlines and combined conditions and keeps them valid', async () => {
  await importClaims(false); await openRandom('route');
  assert.equal(await page.locator('#se-h-branching').count(), 1);
  assert.equal(await page.locator('#se-branching').inputValue(), 'parallel');
  assert.equal(await page.locator('#se-path-summary').count(), 0);
  assert.equal(await page.locator('#se-flows-0-cond-on').count(), 0);
  await page.locator('#se-branching').selectOption('inclusive');
  assert.match(await page.locator('#se-branching-note').innerText(), /every branch whose condition is true/);
  assert.deepEqual(await page.locator('#se-path-summary li').allInnerTexts(), [
   'Otherwise (default branch) → Check insurance',
   'Otherwise (default branch) → Check gift wrap'
  ]);
  assert.match(await page.locator('#se-status').innerText(), /at most one flow without a condition/);
  await page.locator('#se-flows-0-cond-on').check();
  await page.locator('#se-flows-0-cond-field').fill('insured');
  assert.equal((await page.locator('#se-path-summary li').allInnerTexts())[0], 'If insured = true → Check insurance');
  assert.doesNotMatch(await page.locator('#se-status').innerText(), /at most one flow without a condition/);
  assert.equal(await page.locator('#se-save').isEnabled(), true);
  // All of these / Any of these / Not: nested rows with real labels, a depth of three groups and at most eight tests.
  await page.locator('#se-flows-0-cond-mode-all').check();
  assert.equal(await page.locator('#se-flows-0-cond-items-0-field').inputValue(), 'insured');
  assert.equal(await page.locator('#se-flows-0-cond-items-1-field').count(), 1);
  assert.match(await page.locator('#se-err-flows-0').innerText(), /Name the case field to test/);
  assert.equal(await page.locator('#se-save').isDisabled(), true);
  assert.equal(await page.getByLabel('Case field to test (test 2)').count(), 1);
  await page.locator('#se-flows-0-cond-items-1-field').fill('gift');
  await page.locator('#se-flows-0-cond-items-1-mode').selectOption('chance');
  await page.locator('#se-flows-0-cond-items-1-chance').fill('8');
  assert.equal((await page.locator('#se-path-summary li').allInnerTexts())[0], 'If insured = true AND 8% of cases → Check insurance');
  await page.locator('#se-flows-0-cond-add').click();
  assert.equal(await activeId(), 'se-flows-0-cond-items-2-field');
  await page.locator('#se-flows-0-cond-items-2-mode').selectOption('any');
  await page.locator('#se-flows-0-cond-items-2-items-0-mode').selectOption('not');
  assert.equal(await page.locator('#se-flows-0-cond-items-2-items-0-items-0-field').count(), 1);
  assert.deepEqual(
   await page.locator('#se-flows-0-cond-items-2-items-0-items-0-mode option').evaluateAll(o => o.map(x => (x as HTMLOptionElement).value)),
   ['value', 'field', 'chance'],
   'a third-level group offers no further groups'
  );
  await page.locator('#se-flows-0-cond-items-2-items-0-items-0-field').fill('vip');
  await page.locator('#se-flows-0-cond-items-2-items-1-field').fill('region');
  await page.locator('#se-flows-0-cond-items-2-items-1-value-type').selectOption('text');
  await page.locator('#se-flows-0-cond-items-2-items-1-value-text').fill('eu');
  assert.equal(
   (await page.locator('#se-path-summary li').allInnerTexts())[0],
   'If insured = true AND 8% of cases AND (NOT vip = true OR region = "eu") → Check insurance'
  );
  assert.equal(await page.locator('#se-err-flows-0 .se-err').count(), 0);
  for (let i = 0; i < 4; i++) await page.locator('#se-flows-0-cond-add').click();
  assert.equal(await page.locator('#se-flows-0-cond-add').isDisabled(), true);
  assert.match(await page.locator('#se-flows-0-cond-max').innerText(), /At most 8 tests in a group and 8 in the whole condition/);
  for (let i = 6; i >= 3; i--) await page.locator(`[data-act="remove-cond"][data-path="flows.0.cond"][data-i="${i}"]`).click();
  assert.equal(await page.locator('#se-flows-0-cond-add').isEnabled(), true);
  assert.equal(await page.locator('#se-flows-0-cond-items-3-field').count(), 0);
  await page.locator('#se-save').click(); assert.equal(await dialogOpen(), 0);
  const def = await defOf(), route = def.steps.find(s => s.id === 'route')!, when = def.flows.filter(f => f.from === 'route').map(f => f.when);
  assert.equal(route.mode, 'inclusive');
  assert.deepEqual(when, [
   {
    all: [
     {field: 'insured', op: 'eq', value: true},
     {chance: 8},
     {any: [{not: {field: 'vip', op: 'eq', value: true}}, {field: 'region', op: 'eq', value: 'eu'}]}
    ]
   },
   undefined
  ]);
  assert.equal(await catalogOk(await draftText()), true);
  // Back to parallel clears the conditions in the written draft; the saved inclusive draft reopens with its tree.
  await openRandom('route');
  assert.equal(await page.locator('#se-branching').inputValue(), 'inclusive');
  assert.equal((await page.locator('#se-path-summary li').allInnerTexts())[0]!.startsWith('If insured = true AND 8% of cases AND ('), true);
  await page.locator('#se-branching').selectOption('parallel');
  assert.equal(await page.locator('#se-path-summary').count(), 0);
  await page.locator('#se-save').click();
  assert.deepEqual((await defOf()).flows.filter(f => f.from === 'route').map(f => f.when), [undefined, undefined]);
  assert.equal((await defOf()).steps.find(s => s.id === 'route')!.mode, undefined);
  await openRandom('route');
  await page.locator('#se-branching').selectOption('inclusive');
  await page.locator('#se-flows-0-cond-on').check();
  await page.locator('#se-flows-0-cond-field').fill('insured');
  await page.locator('#se-save').click();
  // Multiple instances are blocked, with a visible reason, while a backlog exists.
  await openRandom('inspect');
  assert.equal(await page.locator('#se-h-instances').count(), 1);
  assert.equal(await page.locator('#se-instances-kind').isDisabled(), true);
  assert.match(await page.locator('#se-instances-blocked').innerText(), /cannot be combined with a backlog/);
  assert.equal(await page.locator('#se-instances-kind').getAttribute('aria-describedby'), 'se-instances-blocked');
  await page.locator('#se-backlog-on').uncheck();
  assert.equal(await page.locator('#se-instances-kind').isEnabled(), true);
  assert.equal(await page.locator('#se-instances-blocked').count(), 0);
  await page.locator('#se-instances-kind').selectOption('count');
  assert.equal(await page.locator('#se-instances-count').inputValue(), '3');
  assert.equal(await page.locator('#se-instances-mode-parallel').isChecked(), true);
  await page.locator('#se-instances-count').fill('1');
  assert.match(await page.locator('#se-err-instances').innerText(), /from 2 to 50/);
  assert.equal(await page.locator('#se-instances-count').getAttribute('aria-invalid'), 'true');
  assert.equal(await page.locator('#se-save').isDisabled(), true);
  await page.locator('#se-instances-count').fill('60');
  assert.match(await page.locator('#se-err-instances').innerText(), /from 2 to 50/);
  await page.locator('#se-instances-count').fill('4');
  await page.locator('#se-instances-mode-sequential').check();
  assert.match(await page.locator('#se-instances-note').innerText(), /Runs 4 instances one after another/);
  await page.locator('#se-instances-kind').selectOption('field');
  await page.locator('#se-instances-field').fill('Lines');
  assert.match(await page.locator('#se-err-instances').innerText(), /lowercase letter/);
  await page.locator('#se-instances-field').fill('lines');
  await page.locator('#se-instances-mode-parallel').check();
  assert.match(await page.locator('#se-instances-note').innerText(), /one instance for each unit counted in case field "lines"/);
  await page.locator('#se-save').click();
  const inspect = (await defOf()).steps.find(s => s.id === 'inspect')!;
  assert.deepEqual(inspect.instances, {field: 'lines', mode: 'parallel'});
  assert.equal(inspect.backlog, undefined);
  await openRandom('inspect');
  await page.locator('#se-backlog-on').check();
  assert.match(await page.locator('#se-status').innerText(), /cannot keep a backlog/);
  await page.locator('#se-backlog-on').uncheck();
  await page.locator('#se-instances-kind').selectOption('none');
  assert.equal(await page.locator('#se-instances-mode-parallel').count(), 0);
  await discard();
  // Deadlines: choose the deadline flow among the existing ones, random time, interrupt or escalate, with inline problems.
  await openRandom('approve');
  assert.equal(await page.locator('#se-deadline-kind').inputValue(), 'after');
  assert.equal(await page.locator('#se-deadline-after').inputValue(), '20');
  assert.equal(await page.locator('#se-deadline-mode-escalate').isChecked(), true);
  assert.equal(await page.locator('#se-deadline-flow').inputValue(), 'approve-late');
  assert.deepEqual(await page.locator('#se-deadline-flow option').allInnerTexts(), ['Choose a flow', 'f7 → Paid out', 'approve-late → Notify the manager']);
  assert.match(await page.locator('#se-deadline-note').innerText(), /After 20 min of work the deadline escalates/);
  await page.locator('#se-deadline-after').fill('0');
  assert.match(await page.locator('#se-err-deadline').innerText(), /from 1 to 100,000/);
  await page.locator('#se-deadline-after').fill('25');
  assert.match(await page.locator('#se-deadline-note').innerText(), /After 25 min/);
  await page.locator('#se-deadline-kind').selectOption('timing');
  assert.equal(await page.locator('#se-deadline-timing-dist').inputValue(), 'exponential');
  assert.equal(await page.locator('#se-deadline-timing-mean').inputValue(), '15');
  await page.locator('#se-deadline-timing-dist').selectOption('normal');
  assert.equal(await page.locator('#se-deadline-timing-sd').inputValue(), '4');
  await page.locator('#se-deadline-timing-sd').fill('0');
  assert.match(await page.locator('#se-err-deadline').innerText(), /spread.*from 1 to 100,000/);
  await page.locator('#se-deadline-timing-sd').fill('3');
  await page.locator('#se-deadline-timing-min').fill('25');
  await page.locator('#se-deadline-timing-max').fill('20');
  assert.match(await page.locator('#se-err-deadline').innerText(), /minimum \(25\) must not be above the maximum \(20\)/);
  await page.locator('#se-deadline-timing-min').fill('');
  await page.locator('#se-deadline-timing-max').fill('');
  await page.locator('#se-deadline-mode-interrupt').check();
  await page.locator('#se-deadline-flow').selectOption('f7');
  assert.match(await page.locator('#se-sections fieldset.se-deadline-path legend').innerText(), /to Paid out · deadline path/);
  await page.locator('#se-deadline-flow').selectOption('approve-late');
  await page.locator('#se-save').click();
  const approve = (await defOf());
  assert.deepEqual(approve.steps.find(s => s.id === 'approve')!.deadline, {timing: {dist: 'normal', mean: 15, sd: 3}, mode: 'interrupt', flow: 'approve-late'});
  assert.deepEqual(approve.flows.filter(f => f.from === 'approve').map(f => [f.id, f.on]), [['f7', undefined], ['approve-late', 'deadline']]);
  // A step with a single outgoing path explains that a deadline needs a second one and links to Add path to….
  await openRandom('notify');
  await page.locator('#se-deadline-kind').selectOption('after');
  assert.match(await page.locator('#se-deadline-noflow').innerText(), /only one outgoing path/);
  assert.equal(await page.locator('#se-deadline-flow').count(), 0);
  assert.match(await page.locator('#se-err-deadline').innerText(), /second path/);
  assert.equal(await page.locator('#se-save').isDisabled(), true);
  assert.match(await page.locator('#se-deadline-noflow').innerText(), /Add one with Add path to…/);
  await page.locator('#se-deadline-noflow a[data-goto="se-add-path-to"]').click(); assert.equal(await activeId(), 'se-add-path-to');
  await page.locator('#se-deadline-kind').selectOption('none'); assert.equal(await page.locator('#se-err-deadline .se-err').count(), 0); await discard();
  // The saved draft is accepted by the engine and a seeded run records items and deadlines in the metrics.
  assert.equal(await catalogOk(await draftText()), true);
  await openRandom('approve');
  await page.locator('#se-apply').click();
  await page.waitForFunction(() => document.querySelectorAll('dialog.pd-dialog[open]').length === 0);
  for (let i = 0; i < 3; i++) await page.locator('#advance').click();
  const run = (await query(page)).snapshot, steps = new Map(run.steps.map(s => [s.id, s]));
  assert.ok(steps.get('inspect')!.items!.started >= 3 && steps.get('inspect')!.items!.finished >= 3, 'instances run as items');
  assert.ok(steps.get('approve')!.deadlines!.interrupted > 0, 'approvals past the random deadline are interrupted');
  assert.equal(steps.get('route')!.id, 'route');
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
  assert.equal(targets.includes('start'), false, 'no path may lead back to the start');
  assert.equal(targets.includes('notify'), false);
  assert.ok(targets.includes('done'));
  // Add a second path, choose it as the deadline path and apply.
  await page.locator('#se-deadline-kind').selectOption('after');
  await page.locator('#se-add-path-to').selectOption('alert');
  await page.locator('#se-add-path').click();
  assert.equal(await activeId(), 'se-flows-1-to'); assert.deepEqual(await legends(), ['Path 1 of 2 · to Escalated', 'Path 2 of 2 · to Escalated']);
  assert.deepEqual(await page.locator('#se-deadline-flow option').allInnerTexts(), ['Choose a flow', 'f8 → Escalated', 'notify-alert → Escalated']);
  await page.locator('#se-deadline-flow').selectOption('notify-alert');
  assert.equal(await page.locator('[data-act="remove-path"][data-i="1"]').isEnabled(), true, 'the deadline path may be removed');
  // Go to points a path at another step and the deadline choice follows its new name.
  await page.locator('#se-flows-1-to').selectOption('done'); assert.match((await legends())[1]!, /to Paid out · deadline path/);
  assert.deepEqual(await page.locator('#se-deadline-flow option').allInnerTexts(), ['Choose a flow', 'f8 → Escalated', 'notify-alert → Paid out']);
  await page.locator('#se-flows-1-to').selectOption('alert'); assert.equal(await page.locator('#se-status').innerText(), '');
  await page.locator('#se-apply').click(); await page.waitForFunction(() => document.querySelectorAll('dialog.pd-dialog[open]').length === 0);
  const applied = (await query(page)).definition, notify = applied.steps.find(s => s.id === 'notify')!;
  assert.deepEqual(
   applied.flows.filter(f => f.from === 'notify'),
   [
    {id: 'f8', from: 'notify', to: 'alert'},
    {id: 'notify-alert', from: 'notify', to: 'alert', on: 'deadline'}
   ]
  );
  assert.deepEqual(notify.deadline, {after: 8, mode: 'interrupt', flow: 'notify-alert'});
  // Removing the deadline path leaves the deadline asking for a second path; a fork keeps at least two branches.
  await openRandom('notify'); await page.locator('[data-act="remove-path"][data-i="1"]').click(); assert.equal(await activeId(), 'se-add-path');
  assert.match(await page.locator('#se-err-deadline').innerText(), /second path/);
  await page.locator('#se-deadline-kind').selectOption('none');
  await page.locator('#se-save').click();
  assert.deepEqual((await defOf()).flows.filter(f => f.from === 'notify').map(f => f.id), ['f8']);
  await openRandom('route');
  assert.equal(await page.locator('#se-flows-1-keep').innerText(), 'A fork needs at least two outgoing paths.');
  await page.locator('#se-close').click();
  // An end step has no paths and offers none.
  await openRandom('done');
  assert.match(await dlgText(), /This step ends the process, so it has no outgoing paths\./);
  assert.equal(await page.locator('#se-add-path').count(), 0);
  await page.locator('#se-close').click();
 });
}
