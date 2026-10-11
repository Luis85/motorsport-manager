/// <reference path="../process-contracts.d.ts" />
/**
 * Working hours in the studio (package RC): the Working hours group of the Definition editor's Tune values (add, the engine's
 * diagnostics beside the fields, working days, the display calendar group giving way, and Remove working hours… that asks first
 * with Cancel as the default and then offers Undo), and the run bar clock with the run's day and time and "Closed until …",
 * plus the inspector's Working hours row. Registered under the `process-hours-browser` suite (process-hours-browser.ts).
 */
import assert from 'node:assert/strict';
import {query, type Studio} from './process-browser-fixture';

const OFFICE = {opensAt: 540, closesAt: 1020, daysPerWeek: 5};

export async function hoursChecks(studio: Studio): Promise<void> {
 const {page, check, freshStudio, openDef, closeDef, defOf, inSync, activeId, applyDraft} = studio;
 await check('Tune values adds, checks and removes working hours, Cancel first, and the display calendar group gives way', async () => {
  await freshStudio();
  await openDef();
  const add = page.locator('#tune-hours-add'), open = page.locator('#tune-hours-open'), close = page.locator('#tune-hours-close');
  const days = page.locator('#tune-hours-days'), remove = page.locator('#tune-hours-remove'), hours = async () => (await defOf()).workingHours;
  // Off by default: one sentence says what working hours do, and nothing is written until Add.
  assert.equal(await page.locator('#tune-hours legend').innerText(), 'Working hours');
  assert.match(await page.locator('#tune-hours-help').innerText(), /^Off: the run counts every minute as working time\. With working hours, work/);
  assert.equal(await add.getAttribute('aria-describedby'), 'tune-hours-help');
  assert.equal(await hours(), undefined);
  await add.click();
  assert.deepEqual(await hours(), OFFICE);
  assert.equal(await activeId(), 'tune-hours-open');
  assert.deepEqual([await open.inputValue(), await close.inputValue(), await days.inputValue()], ['09:00', '17:00', '5']);
  assert.deepEqual(await days.locator('option').allInnerTexts(), ['Monday only', 'Monday to Tuesday', 'Monday to Wednesday', 'Monday to Thursday',
   'Monday to Friday', 'Monday to Saturday', 'Every day']);
  assert.equal(await page.locator('#tune-hours-example').innerText(), 'Open 09:00–17:00, Monday to Friday: 40 working hours in each 168-hour week. '
   + 'The run starts on Monday at 09:00; outside these hours work pauses and no cases arrive, while timers and deadlines keep counting.');
  // The display calendar group says why it is unavailable instead of offering a choice the catalog would refuse.
  assert.equal(await page.locator('#tune-cal-mode').count(), 0);
  assert.match(await page.locator('#tune-cal-why').innerText(), /^Not available with working hours: they word times by the clock\./);
  await inSync();
  // A closing before the opening is the engine's own diagnostic beside Closes at, and nothing is repaired.
  await close.fill('08:00');
  await page.waitForFunction(() => /closesAt after opensAt/.test(document.getElementById('tune-hours-close-err')!.textContent ?? ''));
  assert.equal(await page.locator('#tune-hours-close-err').innerText(),
   'Working hours need closesAt after opensAt: the day would close at minute 480 but opens at minute 540.');
  assert.equal(await close.getAttribute('aria-invalid'), 'true');
  assert.equal((await hours())!.closesAt, 480);
  assert.equal(await page.locator('#tune-hours-example').count(), 0, 'no example for hours the engine refuses');
  await close.fill('18:00');
  await page.waitForFunction(() => document.getElementById('tune-hours-close-err')!.textContent === '');
  assert.equal(await close.getAttribute('aria-invalid'), null);
  await days.selectOption('6');
  assert.deepEqual(await hours(), {opensAt: 540, closesAt: 1080, daysPerWeek: 6});
  assert.match(await page.locator('#tune-hours-example').innerText(), /^Open 09:00–18:00, Monday to Saturday: 54 working hours/);
  // A closing of 00:00 is midnight at the end of the day.
  await close.fill('00:00');
  assert.equal((await hours())!.closesAt, 1440);
  assert.equal(await close.inputValue(), '00:00');
  await close.fill('17:00');
  await days.selectOption('5');
  assert.deepEqual(await hours(), OFFICE);
  await inSync();
  // Remove asks first and starts on Cancel; Escape and Cancel keep the hours and give focus back to the button.
  await remove.click();
  assert.equal(await page.locator('#de-confirm-title').innerText(), 'Remove the working hours? The run then counts every minute as working time again.');
  assert.deepEqual(await page.locator('#de-choices button').allInnerTexts(), ['Cancel', 'Remove working hours']);
  assert.equal(await activeId(), 'de-keep-hours');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#de-confirm').isHidden(), true);
  assert.equal(await activeId(), 'tune-hours-remove');
  await remove.click();
  await page.locator('#de-keep-hours').click();
  assert.deepEqual(await hours(), OFFICE, 'Cancel keeps the working hours');
  assert.equal(await activeId(), 'tune-hours-remove');
  await remove.click();
  await page.locator('#de-remove-hours').click();
  await page.waitForFunction(() => !!document.getElementById('tune-hours-add'));
  assert.equal(Object.hasOwn(await defOf(), 'workingHours'), false);
  assert.equal(await activeId(), 'tune-hours-add');
  assert.equal(await page.locator('#de-message').innerText(), 'Removed working hours. Undo');
  await page.locator('#de-undo').click();
  await page.waitForFunction(() => !!document.getElementById('tune-hours-open'));
  assert.deepEqual(await hours(), OFFICE, 'Undo brings the working hours back');
  await remove.click();
  await page.locator('#de-remove-hours').click();
  await page.waitForFunction(() => !!document.getElementById('tune-hours-add'));
  // With a display calendar, Add is disabled and the reason sits beside it.
  await page.locator('#tune-cal-mode').selectOption('set');
  assert.equal(await add.isDisabled(), true);
  assert.equal(await add.getAttribute('aria-describedby'), 'tune-hours-help tune-hours-why');
  assert.equal(await page.locator('#tune-hours-why').innerText(),
   'Remove the display calendar first: a process with working hours words its times by the clock, so it cannot have both.');
  await page.locator('#tune-cal-mode').selectOption('none');
  assert.equal(await add.isEnabled(), true);
  await closeDef();
 });
 await check('The run bar clock shows the day and time with working hours and says Closed until outside them', async () => {
  await freshStudio();
  // One working hour a day, so the shipped process is still running when the run length is reached in the evening.
  await applyDraft(d => { d.workingHours = {opensAt: 540, closesAt: 600, daysPerWeek: 5}; });
  const gloss = page.locator('#clock-hours');
  assert.equal((await query(page)).snapshot.minute, 0);
  assert.equal(await gloss.innerText(), 'Day 1 · Mon 09:00');
  assert.equal(await page.locator('#clock').innerText(), '0 min of 100,000');
  // The inspector overview says the run uses working hours, and pools average over working time.
  const row = page.locator('#inspector dt', {hasText: 'Working hours'});
  assert.equal(await row.locator('xpath=following-sibling::dd[1]').innerText(), '09:00–10:00, Monday to Friday; work and arrivals pause outside them');
  assert.match(await page.locator('#pools').innerText(), /Average over working hours since minute 0/);
  await page.locator('#step').click();
  await page.waitForFunction(() => document.getElementById('clock-hours')!.textContent === 'Day 1 · Mon 09:01');
  // Run to end with a 600-minute run length stops at 19:00, outside working hours.
  await page.locator('#horizon').selectOption('custom');
  await page.locator('#horizon-custom').fill('600');
  await page.locator('#horizon-custom').dispatchEvent('change');
  await page.locator('#run-end').click();
  const ended = await query(page);
  assert.deepEqual([ended.snapshot.minute, ended.snapshot.status], [600, 'limit']);
  assert.equal(await gloss.innerText(), 'Day 1 · Mon 19:00 · Closed until Tue 09:00 on day 2');
  // Opening and closing the editor never ticks the run.
  await openDef();
  await closeDef();
  assert.equal((await query(page)).snapshot.minute, 600);
  assert.equal(await gloss.innerText(), 'Day 1 · Mon 19:00 · Closed until Tue 09:00 on day 2');
  await page.locator('#reset').click();
  await page.locator('#horizon').selectOption('100000');
 });
}
