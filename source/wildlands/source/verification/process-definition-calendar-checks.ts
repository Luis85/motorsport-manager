/// <reference path="../process-contracts.d.ts" />
/**
 * Companion of process-definition-browser.ts (the suite near its size budget): the display-only working calendar in the
 * Definition editor's Tune values. Registered under the `process-definition-browser` suite; the suite entry calls
 * `calendarChecks` before its lifecycle check.
 */
import assert from 'node:assert/strict';
import {query, type Studio} from './process-browser-fixture';

export async function calendarChecks(studio: Studio): Promise<void> {
 const {page, check, freshStudio, openDef, defOf, inSync, applyDef, pasteDraft, restoreDef, closeDef} = studio;
 await check('Tune values sets, checks and clears the display calendar, and applying it leaves the run unchanged', async () => {
  await page.setViewportSize({width: 1440, height: 1060});
  await freshStudio();
  await openDef();
  const mode = page.locator('#tune-cal-mode'), day = page.locator('#tune-cal-day'), week = page.locator('#tune-cal-week');
  const calendar = async () => (await defOf()).calendar;
  // The group says what it is for and starts at None: the shipped process has no calendar.
  assert.equal(await page.locator('#tune-cal legend').innerText(), 'Working calendar (display only)');
  assert.equal(await page.locator('label[for="tune-cal-mode"]').innerText(), 'Working calendar');
  assert.deepEqual(await mode.locator('option').allInnerTexts(), ['None (minutes and hours only)', 'Business days and weeks']);
  assert.equal(await mode.inputValue(), 'none');
  assert.match(await page.locator('#tune-cal-mode-help').innerText(), /It changes only how times are shown, never a run/);
  assert.match(String(await mode.getAttribute('aria-describedby')), /tune-cal-mode-help/);
  assert.equal(await day.count(), 0);
  assert.equal(await calendar(), undefined);
  // Choosing business days writes an eight-hour, five-day calendar and shows its two fields and an example.
  await mode.selectOption('set');
  assert.deepEqual(await calendar(), {minutesPerDay: 480, daysPerWeek: 5});
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'tune-cal-mode');
  assert.deepEqual([await day.inputValue(), await week.inputValue()], ['480', '5']);
  assert.deepEqual([await day.getAttribute('min'), await day.getAttribute('max'), await week.getAttribute('max')], ['1', '1440', '7']);
  assert.equal(await page.locator('#tune-cal-example').innerText(), 'A business week of work reads 2,400 min (5 business days).');
  await inSync();
  // An out-of-range value is the engine's own plain diagnostic beside the field; a fraction is never written.
  await day.fill('1441');
  await page.waitForFunction(() => /1 to 1440/.test(document.getElementById('tune-cal-day-err')!.textContent ?? ''));
  assert.equal(await page.locator('#tune-cal-day-err').innerText(), 'The display calendar needs minutesPerDay as a whole number of minutes from 1 to 1440.');
  assert.equal(await day.getAttribute('aria-invalid'), 'true');
  assert.match(await page.locator('#diagnostics').innerText(), /minutesPerDay as a whole number of minutes from 1 to 1440/);
  await week.fill('2.5');
  assert.match(await page.locator('#tune-cal-week-err').innerText(), /whole number/);
  assert.equal((await calendar())!.daysPerWeek, 5, 'a fraction is not written');
  await day.fill('450');
  await week.fill('4');
  await page.waitForFunction(() => document.getElementById('tune-cal-day-err')!.textContent === '');
  assert.equal(await day.getAttribute('aria-invalid'), null);
  assert.equal(await week.getAttribute('aria-invalid'), null);
  assert.deepEqual(await calendar(), {minutesPerDay: 450, daysPerWeek: 4});
  // None removes the field again; choosing business days afterwards starts from the defaults.
  await mode.selectOption('none');
  assert.equal(Object.hasOwn(await defOf(), 'calendar'), false);
  assert.equal(await day.count(), 0);
  await mode.selectOption('set');
  await day.fill('450');
  await inSync();
  // A pasted calendar that is not numbers creates no element and writes no bound or value.
  const poisoned = await defOf() as unknown as Record<string, any>;
  poisoned.calendar = {minutesPerDay: '"><img src=x onerror="globalThis.__calendar = 1">', daysPerWeek: 5};
  await pasteDraft(JSON.stringify(poisoned, null, 2));
  await inSync();
  assert.equal(await page.locator('dialog.pd-dialog img').count(), 0);
  assert.equal(await day.inputValue(), '');
  assert.equal(await page.locator('#tune-cal-example').count(), 0);
  assert.equal(await page.evaluate(() => (globalThis as any).__calendar), undefined);
  assert.equal(await page.locator('#tune-cal-day-err').innerText(), 'The display calendar needs minutesPerDay as a whole number of minutes from 1 to 1440.');
  await restoreDef();
  await inSync();
  await mode.selectOption('set');
  await day.fill('450');
  // Applying keeps the calendar and starts the same run the definition gives without it.
  const without = await defOf();
  delete without.calendar;
  await applyDef();
  const applied = await query(page);
  assert.deepEqual(applied.definition.calendar, {minutesPerDay: 450, daysPerWeek: 5});
  assert.equal(applied.snapshot.minute, 0);
  for (let i = 0; i < 3; i++) await page.locator('#advance').click();
  const ran = await query(page);
  assert(ran.snapshot.minute > 0, 'the explicit advance command moved the run');
  const same = await page.evaluate(([d, horizon, minute, snapshot]) => {
   const s = (globalThis as any).LWProcessRuntime.create(d, {horizon});
   try {
    return JSON.stringify(s.advance(minute)) === JSON.stringify(snapshot);
   } finally {
    s.dispose();
   }
  }, [without, ran.horizon, ran.snapshot.minute, ran.snapshot] as const);
  assert.equal(same, true, 'the calendar changes no number of the run');
  await closeDef();
 });
}
