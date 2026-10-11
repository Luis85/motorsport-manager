/// <reference path="../process-contracts.d.ts" />
/**
 * Companion of process-definition-browser.ts (the suite over its size budget once reflowed): the descriptive fields a journey or
 * process carries beside its mechanics. Touchpoint channels, phases, feelings, pain points and end outcomes in the step editor; the
 * process type and tracked measures; SIPOC suppliers and customers in Tune values. Registered under the
 * `process-definition-browser` suite; the suite entry calls `journeyChecks` after the step editor routing check, so the check order
 * is unchanged.
 */
import assert from 'node:assert/strict';
import {query, type Studio} from './process-browser-fixture';

/** Touchpoints and end outcomes, the process type and tracked measures, and SIPOC suppliers and customers. */
export async function journeyChecks(studio: Studio): Promise<void> {
 const {page, check, freshStudio, openDef, closeDef, restoreDef, applyDef, draftText} = studio;
 const {defOf, inSync, dialogOpen, importFeed, savedStep, importJourney, pasteDraft} = studio;
 await check('Step editor edits touchpoints with channels, phases, feelings, pain points and end outcomes', async () => {
  // The plain-language helpers are pure: words for feelings, channels and outcomes, and nothing for values outside the contract.
  const words = await page.evaluate(() => {
   const v = (globalThis as any).LWProcessRandomView;
   return {
    emotions: [-3, -2, -1, 0, 1, 2, 3, 4, 1.5, undefined].map(v.describeEmotion),
    channels: [...v.CHANNELS.map((c: [string, string]) => v.describeChannel(c[0])), v.describeChannel('fax'), v.describeChannel(undefined)],
    outcomes: [v.describeOutcome('goal'), v.describeOutcome('lost'), v.describeOutcome(undefined), v.describeOutcome('toString')]
   };
  });
  assert.deepEqual(words.emotions, ['Very frustrated', 'Frustrated', 'Slightly annoyed', 'Neutral', 'Pleased', 'Happy', 'Delighted', '', '', '']);
  assert.deepEqual(words.channels, [
   'Website',
   'Mobile app',
   'Physical store',
   'Phone call',
   'Chat',
   'Email',
   'Social media',
   'Advertising',
   'Delivery',
   'Documents and forms',
   '',
   ''
  ]);
  assert.deepEqual(words.outcomes, ['Goal reached', 'Customer or user lost', '', '']);
  await importJourney(); const dlg = page.locator('dialog.pd-dialog[open]');
  const openStep = async (id: string) => { await page.locator(`[data-step="${id}"]`).click(); await page.locator('#edit-step').click(); await dlg.waitFor(); };
  // A touchpoint: Journey section, backstage pools of any kind with kind badges, no requirement and no technology.
  await openStep('browse');
  assert.equal(await page.locator('#se-chip').innerText(), 'touchpoint');
  assert.equal(await page.locator('#se-h-journey').innerText(), 'Journey');
  assert.equal(await page.locator('#se-h-people').innerText(), 'Backstage teams and systems (optional)');
  assert.match(await page.locator('#se-h-people + .se-help').innerText(), /Customers and users are not a pool and never consume capacity/);
  assert.equal(await page.locator('#se-h-automation').count(), 0);
  assert.equal(await page.locator('#se-technology').count(), 0);
  assert.equal(await page.locator('#se-no-pools').count(), 0);
  assert.equal(await page.locator('#se-h-notes').count(), 0);
  assert.deepEqual(await page.locator('#se-h-people').locator('xpath=..').locator('.se-badge').allInnerTexts(), ['People', 'System', 'Machine']);
  assert.equal(await dlg.getByLabel('Support crew').count(), 1);
  assert.equal(await dlg.getByLabel('Shop platform').count(), 1);
  assert.equal(await dlg.getByLabel('Pickup kiosk').count(), 1);
  assert.match(await page.locator('#se-h-timing').innerText(), /Timing and cost/);
  assert.match(await dlg.innerText(), /Touchpoint duration/);
  assert.equal(await page.locator('#se-h-random-timing').count(), 1);
  assert.equal(await page.locator('#se-h-random-outcomes').count(), 1);
  assert.deepEqual(await page.locator('#se-channel option').allInnerTexts(), [
   'Not set',
   'Website',
   'Mobile app',
   'Physical store',
   'Phone call',
   'Chat',
   'Email',
   'Social media',
   'Advertising',
   'Delivery',
   'Documents and forms'
  ]);
  assert.deepEqual(await page.locator('#se-emotion option').allInnerTexts(), [
   'Not set',
   'Very frustrated (-3)',
   'Frustrated (-2)',
   'Slightly annoyed (-1)',
   'Neutral (0)',
   'Pleased (+1)',
   'Happy (+2)',
   'Delighted (+3)'
  ]);
  assert.deepEqual(
   [
    await page.locator('#se-channel').inputValue(),
    await page.locator('#se-emotion').inputValue(),
    await page.locator('#se-phase').inputValue(),
    await page.locator('#se-pain').inputValue(),
    await page.locator('#se-opportunity').inputValue()
   ],
   ['web', '1', 'Consideration', 'Search results are slow.', '']
  );
  assert.deepEqual(await page.locator('#se-phase-list option').evaluateAll(o => o.map(n => (n as HTMLOptionElement).value)), [
   'Awareness',
   'Consideration',
   'Purchase'
  ]);
  assert.equal(await page.locator('#se-phase').getAttribute('list'), 'se-phase-list');
  assert.equal(await page.locator('#se-needs-summary').innerText(), 'Needs: 1 Shop platform');
  await page.locator('#se-channel').selectOption('mobile');
  await page.locator('#se-emotion').selectOption('-2');
  await page.locator('#se-phase').fill('Consideration');
  await page.locator('#se-pain').fill('The cart empties when the app restarts.');
  await page.locator('#se-opportunity').fill('Keep the cart for a week.');
  await dlg.getByLabel('Pickup kiosk').fill('1'); assert.equal(await page.locator('#se-needs-summary').innerText(), 'Needs: 1 Shop platform, 1 Pickup kiosk');
  // The engine's own problem shows beside the pool, in plain words, and blocks saving until it is fixed.
  await dlg.getByLabel('Pickup kiosk').fill('3');
  assert.match(await page.locator('#se-err-pools-2').innerText(), /Pickup kiosk has only 1 available; ask for 1 or fewer/);
  assert.equal(await page.locator('#se-pools-2-count').getAttribute('aria-invalid'), 'true');
  await dlg.getByLabel('Pickup kiosk').fill('0');
  assert.equal(await page.locator('#se-err-pools-2').innerText(), '');
  await dlg.getByLabel('Shop platform').fill('0');
  assert.equal(await page.locator('#se-status').innerText(), '', 'a touchpoint with no backstage pool at all is valid: it never waits for capacity');
  assert.equal(await page.locator('#se-save').isEnabled(), true);
  await page.locator('#se-save').click(); assert.equal(await dialogOpen(), 0);
  let browse = await savedStep('browse');
  assert.deepEqual(
   [browse.channel, browse.emotion, browse.phase, browse.pain, browse.opportunity, browse.resources, browse.kind],
   ['mobile', -2, 'Consideration', 'The cart empties when the app restarts.', 'Keep the cart for a week.', undefined, 'touchpoint']
  );
  // Clearing the notes removes the keys again instead of writing empty strings.
  await openStep('browse');
  await page.locator('#se-channel').selectOption('');
  await page.locator('#se-emotion').selectOption('');
  await page.locator('#se-pain').fill('  ');
  await page.locator('#se-save').click();
  browse = await savedStep('browse');
  for (const key of ['channel', 'emotion', 'pain'] as const) assert.equal(Object.hasOwn(browse, key), false, key + ' is removed when cleared');
  await openStep('ad');
  assert.equal(await page.locator('#se-channel').inputValue(), 'social');
  await page.locator('#se-channel').selectOption('phone');
  await page.locator('#se-emotion').selectOption('3');
  await page.locator('#se-save').click();
  // Every other kind keeps its own sections and gets collapsed Journey notes, so a business process can use phases too.
  await openStep('pack');
  assert.equal(await page.locator('#se-chip').innerText(), 'task');
  assert.equal(await page.locator('#se-h-journey').count(), 0);
  assert.equal(await page.locator('#se-channel').count(), 0);
  assert.equal(await page.locator('#se-outcome').count(), 0);
  assert.equal(await dlg.getByLabel('Shop platform').count(), 0, 'a task still demands only people pools');
  assert.equal(await dlg.getByLabel('Support crew').count(), 1);
  assert.equal(await page.locator('#se-notes').evaluate((e: HTMLDetailsElement) => e.open), false);
  assert.equal(await page.locator('#se-h-notes').innerText(), 'Journey notes (optional)');
  assert.equal(await page.locator('#se-phase').isVisible(), false);
  await page.locator('#se-h-notes').click();
  assert.equal(await page.locator('#se-phase').isVisible(), true);
  await page.locator('#se-phase').fill('Fulfilment');
  await page.locator('#se-emotion').selectOption('2');
  await page.locator('#se-opportunity').fill('Pack within the hour.');
  await page.locator('#se-add-set').click();
  assert.equal(await page.locator('#se-notes').evaluate((e: HTMLDetailsElement) => e.open), true, 'the notes stay open after the form is rebuilt');
  assert.equal(await page.locator('#se-phase').inputValue(), 'Fulfilment');
  await page.locator('[data-bind="set.1.key"]').fill('boxed'); await page.locator('#se-save').click();
  const pack = await savedStep('pack');
  assert.deepEqual(
   [pack.phase, pack.emotion, pack.opportunity, pack.channel, pack.set],
   ['Fulfilment', 2, 'Pack within the hour.', undefined, {packed: true, boxed: true}]
  );
  // A start step gets notes but no outcome; end steps get the Outcome select.
  await openStep('start');
  assert.equal(await page.locator('#se-notes').count(), 1);
  assert.equal(await page.locator('#se-outcome').count(), 0);
  await page.locator('#se-close').click();
  await openStep('won');
  assert.equal(await page.locator('#se-h-outcome').innerText(), 'Outcome');
  assert.deepEqual(await page.locator('#se-outcome option').allInnerTexts(), ['None', 'Goal reached', 'Customer or user lost']);
  assert.equal(await page.locator('#se-outcome').inputValue(), '');
  assert.equal(await page.locator('#se-h-notes').count(), 1); await page.locator('#se-outcome').selectOption('goal'); await page.locator('#se-save').click();
  await openStep('lost'); await page.locator('#se-outcome').selectOption('lost'); await page.locator('#se-save').click();
  assert.equal((await savedStep('won')).outcome, 'goal'); assert.equal((await savedStep('lost')).outcome, 'lost');
  await openStep('lost');
  assert.equal(await page.locator('#se-outcome').inputValue(), 'lost');
  await page.locator('#se-outcome').selectOption('');
  await page.locator('#se-save').click();
  assert.equal(Object.hasOwn(await savedStep('lost'), 'outcome'), false);
  await openStep('lost'); await page.locator('#se-outcome').selectOption('lost'); await page.locator('#se-save').click();
  // Applying through the Definition editor starts a fresh run, so the engine accepted the journey fields the editor wrote.
  await openDef(); await applyDef(); const applied = await query(page);
  assert.equal(await page.evaluate(d => (globalThis as any).LWProcessCatalog.validate(d).ok, applied.definition), true);
  assert.equal(applied.snapshot.minute, 0);
  const byId = (id: string) => applied.definition.steps.find(s => s.id === id)!;
  assert.deepEqual(
   [byId('ad').channel, byId('ad').emotion, byId('won').outcome, byId('lost').outcome, byId('pack').phase],
   ['phone', 3, 'goal', 'lost', 'Fulfilment']
  );
  assert.equal(applied.definition.genre, 'customer-journey');
  await page.locator('#advance').click(); assert.equal((await query(page)).playing, false);
 });
 await check('Definition editor edits the process type and tracked measures with inline problems', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await importJourney(); await openDef();
  const genre = page.locator('#tune-genre'),
   track = (i: number, part: string) => page.locator(`#tune-track-${i}-${part}`),
   tracks = async () => (await defOf()).track;
  // Process type: three plain choices, each with its own one-sentence help; the default process is written as an absent key.
  assert.equal(await page.locator('label[for="tune-genre"]').innerText(), 'Process type');
  assert.deepEqual(await page.locator('#tune-genre option').allInnerTexts(), ['Business process', 'Customer journey', 'User journey']);
  assert.equal(await genre.inputValue(), 'customer-journey');
  assert.match(await page.locator('#tune-genre-help').innerText(), /Cases are customers and steps are the touchpoints where they meet your business/);
  assert.match(await page.locator('#tune-genre-help').innerText(), /labels and the default view only/);
  await genre.selectOption('user-journey');
  assert.equal((await defOf()).genre, 'user-journey');
  assert.match(await page.locator('#tune-genre-help').innerText(), /Cases are users of a product or service/);
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'tune-genre');
  await genre.selectOption('process');
  assert.equal(Object.hasOwn(await defOf(), 'genre'), false);
  assert.match(await page.locator('#tune-genre-help').innerText(), /Cases are work items such as orders or tickets/);
  await genre.selectOption('customer-journey');
  assert.equal((await defOf()).genre, 'customer-journey');
  await inSync();
  // Tracked measures: the explanation, suggestions from fields the process already writes, and a bounded number of rows.
  assert.equal(await page.locator('#tune-h-track').innerText(), 'Tracked measures');
  assert.equal(
   await page.locator('#tune-track-help').innerText(),
   'The simulation averages these values when cases finish and at every step, to draw the measured curve. ' +
    'Choose up to 6 number fields, for example a mood score or a satisfaction rating.'
  );
  assert.match(
   await page.locator('#tune-track-help').innerText(),
   /^The simulation averages these values when cases finish and at every step, to draw the measured curve/
  );
  assert.equal(await tracks(), undefined);
  assert.deepEqual(await page.locator('#tune-track-fields option').evaluateAll(o => o.map(n => (n as HTMLOptionElement).value)), ['mood', 'packed']);
  await page.locator('#tune-track-add').click();
  assert.deepEqual(await tracks(), [{field: 'mood'}]);
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'tune-track-0-field');
  assert.equal(await track(0, 'field').getAttribute('list'), 'tune-track-fields');
  await track(0, 'label').fill('Mood');
  assert.deepEqual(await tracks(), [{field: 'mood', label: 'Mood'}]);
  await track(0, 'label').fill('');
  assert.deepEqual(await tracks(), [{field: 'mood'}]);
  await track(0, 'label').fill('Mood');
  // Inline problems: a repeated field is the engine's own message beside the row; a malformed name is explained.
  await page.locator('#tune-track-add').click();
  assert.deepEqual((await tracks())!.map(t => t.field), ['mood', 'packed']);
  await track(1, 'field').fill('mood');
  assert.match(await page.locator('#tune-track-1-field-err').innerText(), /Tracked field mood is listed twice/);
  assert.equal(await track(1, 'field').getAttribute('aria-invalid'), 'true');
  assert.match(await page.locator('#diagnostics').innerText(), /Tracked measure 2 › field/);
  assert.match(await page.locator('#tune-summary').innerText(), /1 problem in this form/);
  await track(1, 'field').fill('Bad name');
  assert.match(await page.locator('#tune-track-1-field-err').innerText(), /Start with a lowercase letter/);
  assert.equal(await track(1, 'field').getAttribute('aria-invalid'), 'true');
  await track(1, 'field').fill('score');
  assert.equal(await page.locator('#tune-track-1-field-err').innerText(), '');
  assert.equal(await track(1, 'field').getAttribute('aria-invalid'), null);
  assert.equal(await page.locator('#diagnostics li').count(), 0);
  // At most six: the button disables with a visible reason, and removing a row enables it again.
  for (let i = 0; i < 4; i++) await page.locator('#tune-track-add').click();
  assert.equal((await tracks())!.length, 6);
  assert.equal(await page.locator('#tune-track-add').isDisabled(), true);
  assert.equal(await page.locator('#tune-track-full').innerText(), 'At most 6 measures are tracked.');
  assert.equal(await page.locator('#tune-track-add').getAttribute('aria-describedby'), 'tune-track-full');
  assert.equal(await page.evaluate(d => (globalThis as any).LWProcessCatalog.validate(d).ok, await defOf()), true);
  await page.locator('[data-act="track-remove"][data-i="5"]').click();
  assert.equal((await tracks())!.length, 5);
  assert.equal(await page.locator('#tune-track-add').isEnabled(), true);
  assert.equal(await page.locator('#tune-track-full').count(), 0);
  for (let i = 4; i >= 2; i--) await page.locator(`[data-act="track-remove"][data-i="${i}"]`).click();
  assert.deepEqual(await tracks(), [{field: 'mood', label: 'Mood'}, {field: 'score'}]);
  await page.locator('[data-act="track-remove"][data-i="1"]').click();
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'tune-track-add');
  // The Raw JSON pane names the new paths in plain words.
  const raw = JSON.parse(await draftText()) as Record<string, unknown>;
  raw.genre = 'funnel';
  raw.track = [{field: 'Bad field'}];
  await pasteDraft(JSON.stringify(raw, null, 2));
  await page.waitForFunction(() => document.querySelectorAll('#diagnostics li').length > 0);
  const listed = await page.locator('#diagnostics').innerText();
  assert.match(listed, /Process › process type/);
  assert.match(listed, /Tracked measure 1 › field/);
  assert.match(listed, /Expected one of process, customer-journey, user-journey/);
  await restoreDef(); await inSync();
  // Applying keeps the type and the measures, and the engine reports the tracked field under its label.
  await genre.selectOption('user-journey'); await page.locator('#tune-track-add').click(); await track(0, 'label').fill('Mood score'); await applyDef();
  const applied = await query(page);
  assert.deepEqual([applied.definition.genre, applied.definition.track], ['user-journey', [{field: 'mood', label: 'Mood score'}]]);
  assert.equal(await page.evaluate(d => (globalThis as any).LWProcessCatalog.validate(d).ok, applied.definition), true);
  for (let i = 0; i < 12 && !Object.hasOwn((await query(page)).snapshot.metrics.tracked, 'mood'); i++) await page.locator('#advance').click();
  assert.equal((await query(page)).snapshot.metrics.tracked.mood!.label, 'Mood score');
 });
 await check('Definition editor edits SIPOC suppliers and customers with inline problems and applies them', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await freshStudio(); await openDef();
  // The shipped agency process already names its suppliers and customers: the form shows exactly those rows.
  const shipped = (await defOf()).sipoc!; assert(shipped.suppliers?.length && shipped.customers?.length);
  for (const [list, key] of [
   ['suppliers', 'supplies'],
   ['customers', 'receives']
  ] as const)
   for (const [i, p] of shipped[list]!.entries()) {
    assert.equal(await page.locator(`#tune-sipoc-${list}-${i}-name`).inputValue(), p.name);
    assert.equal(await page.locator(`#tune-sipoc-${list}-${i}-detail`).inputValue(), p[key] ?? '');
   }
  await closeDef(); await importFeed(); await openDef();
  const party = (list: 'suppliers' | 'customers', i: number, part: 'name' | 'detail') => page.locator(`#tune-sipoc-${list}-${i}-${part}`),
   sipoc = async () => (await defOf()).sipoc;
  assert.equal(await page.locator('#tune-h-sipoc').innerText(), 'Suppliers and customers (SIPOC)');
  assert.match(
   await page.locator('#tune-sipoc-help').innerText(),
   /^Inputs, process stages and outputs are derived automatically from the process; only suppliers and customers need to be written\./
  );
  assert.equal(Object.hasOwn(await defOf(), 'sipoc'), false);
  assert.equal(await page.locator('#tune-sipoc-suppliers-add').innerText(), 'Add supplier');
  assert.equal(await page.locator('#tune-sipoc-customers-add').innerText(), 'Add customer');
  // Adding writes sipoc with a unique default name, focuses the name and labels fields with their limits.
  await page.locator('#tune-sipoc-suppliers-add').click();
  assert.deepEqual(await sipoc(), {suppliers: [{name: 'Supplier 1'}]});
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'tune-sipoc-suppliers-0-name');
  assert.equal(await page.locator('label[for="tune-sipoc-suppliers-0-name"]').innerText(), 'Name (up to 60 characters)');
  assert.equal(await page.locator('label[for="tune-sipoc-suppliers-0-detail"]').innerText(), 'What they supply (optional, up to 160 characters)');
  assert.equal(await party('suppliers', 0, 'name').getAttribute('maxlength'), '60');
  assert.equal(await party('suppliers', 0, 'detail').getAttribute('maxlength'), '160');
  await party('suppliers', 0, 'name').fill('Payment provider'); await party('suppliers', 0, 'detail').fill('Payment confirmation');
  await page.locator('#tune-sipoc-customers-add').click();
  await party('customers', 0, 'name').fill('Shopper');
  assert.equal(await page.locator('label[for="tune-sipoc-customers-0-detail"]').innerText(), 'What they receive (optional, up to 160 characters)');
  await party('customers', 0, 'detail').fill('Ordered goods');
  assert.deepEqual(await sipoc(), {
   suppliers: [{name: 'Payment provider', supplies: 'Payment confirmation'}],
   customers: [{name: 'Shopper', receives: 'Ordered goods'}]
  });
  await inSync();
  // An emptied detail removes the key; an emptied name is a problem beside the field.
  await party('suppliers', 0, 'detail').fill('');
  assert.deepEqual((await sipoc())!.suppliers, [{name: 'Payment provider'}]);
  await party('suppliers', 0, 'detail').fill('Payment confirmation');
  await party('customers', 0, 'name').fill('');
  assert.match(await page.locator('#tune-sipoc-customers-0-name-err').innerText(), /Use 1 to 60 characters/);
  assert.equal(await party('customers', 0, 'name').getAttribute('aria-invalid'), 'true');
  await party('customers', 0, 'name').fill('Shopper');
  assert.equal(await page.locator('#tune-sipoc-customers-0-name-err').innerText(), '');
  // A repeated name is the engine's own problem, shown beside the second row and listed with its readable path.
  await page.locator('#tune-sipoc-suppliers-add').click();
  assert.equal((await sipoc())!.suppliers![1]!.name, 'Supplier 2');
  await party('suppliers', 1, 'name').fill('Payment provider');
  assert.match(await page.locator('#tune-sipoc-suppliers-1-name-err').innerText(), /Party Payment provider is listed twice/);
  assert.equal(await party('suppliers', 1, 'name').getAttribute('aria-invalid'), 'true');
  assert.match(await page.locator('#diagnostics').innerText(), /Supplier 2 › name/);
  assert.match(await page.locator('#tune-summary').innerText(), /1 problem in this form/);
  await party('suppliers', 1, 'name').fill('Courier');
  assert.equal(await page.locator('#tune-sipoc-suppliers-1-name-err').innerText(), '');
  assert.equal(await page.locator('#diagnostics li').count(), 0);
  // At most eight per list, with a visible reason; the draft stays valid for the engine.
  for (let i = 0; i < 6; i++) await page.locator('#tune-sipoc-suppliers-add').click();
  assert.equal((await sipoc())!.suppliers!.length, 8);
  assert.equal(await page.locator('#tune-sipoc-suppliers-add').isDisabled(), true);
  assert.equal(await page.locator('#tune-sipoc-suppliers-full').innerText(), 'At most 8 suppliers are listed.');
  assert.equal(await page.locator('#tune-sipoc-customers-add').isEnabled(), true);
  assert.equal(await page.evaluate(d => (globalThis as any).LWProcessCatalog.validate(d).ok, await defOf()), true);
  for (let i = 7; i >= 2; i--) await page.locator(`[data-act="sipoc-remove"][data-list="suppliers"][data-i="${i}"]`).click();
  assert.equal(await page.locator('#tune-sipoc-suppliers-add').isEnabled(), true);
  assert.deepEqual((await sipoc())!.suppliers!.map(p => p.name), ['Payment provider', 'Courier']);
  // Raw JSON names the new paths in plain words.
  const raw = JSON.parse(await draftText()) as Record<string, any>;
  raw.sipoc = {suppliers: [{name: 'A'}, {name: 'A'}]};
  await pasteDraft(JSON.stringify(raw, null, 2));
  await page.waitForFunction(() => document.querySelectorAll('#diagnostics li').length > 0);
  assert.match(await page.locator('#diagnostics').innerText(), /Supplier 2 › name/);
  raw.sipoc = {customers: [{name: 'B', receives: ''}]}; await pasteDraft(JSON.stringify(raw, null, 2));
  await page.waitForFunction(() => /Customer 1 › receives/.test(document.getElementById('diagnostics')!.textContent!));
  await restoreDef();
  await page.waitForFunction(() => !('sipoc' in JSON.parse((document.getElementById('draft') as HTMLTextAreaElement).value)));
  await inSync();
  // Removing every party removes the key; the focus returns to the Add button.
  await page.locator('#tune-sipoc-suppliers-add').click();
  await page.locator('#tune-sipoc-customers-add').click();
  await page.locator('[data-act="sipoc-remove"][data-list="suppliers"]').click();
  assert.deepEqual(Object.keys((await sipoc())!), ['customers']);
  await page.locator('[data-act="sipoc-remove"][data-list="customers"]').click();
  assert.equal(Object.hasOwn(await defOf(), 'sipoc'), false);
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'tune-sipoc-customers-add');
  // Applying keeps the parties, and the SIPOC view lists them as suppliers and customers.
  await page.locator('#tune-sipoc-suppliers-add').click();
  await party('suppliers', 0, 'name').fill('Fabric mill');
  await party('suppliers', 0, 'detail').fill('Rolls of cloth');
  await page.locator('#tune-sipoc-customers-add').click(); await party('customers', 0, 'name').fill('Boutique'); await applyDef();
  const applied = await query(page);
  assert.deepEqual(applied.definition.sipoc, {suppliers: [{name: 'Fabric mill', supplies: 'Rolls of cloth'}], customers: [{name: 'Boutique'}]});
  assert.equal(applied.snapshot.minute, 0);
  await page.locator('#mode-lens').click(); await page.waitForFunction(() => document.querySelectorAll('#lens .sipoc-col-suppliers .sipoc-card').length > 0);
  assert.match(await page.locator('#lens .sipoc-col-suppliers').innerText(), /Fabric mill[\s\S]*Rolls of cloth/);
  assert.match(await page.locator('#lens .sipoc-col-customers').innerText(), /Boutique/);
 });
}
