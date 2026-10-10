/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-tuning-fields.ts" />
/// <reference path="./process-time.ts" />
/// <reference path="./process-html.ts" />
/**
 * The "Working calendar (display only)" group of the Definition editor's Tune values form (LWProcessTuningCalendar), shown in
 * the Process section and wired by process-tuning.ts. It edits the definition's optional `calendar` ({minutesPerDay,
 * daysPerWeek}): None removes it, "Business days and weeks" adds 480 minutes per day and 5 days per week, and the two number
 * fields edit it through the form's plain path edits (`calendar.minutesPerDay`, `calendar.daysPerWeek`), so the catalog's
 * diagnostics appear beside them. The calendar only changes how durations are worded (LWProcessTime.span), never a run.
 * Pure markup (LWProcessHtml `html`, returned as `Safe`) and draft-object edits: no DOM access beyond the element handed in,
 * no draft store, no session.
 */
declare namespace LWProcessTuningCalendar {
 /** The tuning form's edit result; a calendar choice never reports a local message. */
 interface Result {write: boolean; rerender: boolean; focus?: string; local?: [string, string]}
 interface Api {
  /** The calendar group: a None / business days and weeks choice and, with a calendar, its two whole-number fields. */
  markup(def: LWProcess.Definition): LWProcessHtml.Safe;
  /** A change to the calendar choice; null when the control is not it. */
  special(def: LWProcess.Definition, el: HTMLElement): Result | null;
  /** The calendar a new choice starts with: 480 minutes per business day, 5 business days per week. */
  DEFAULT: Readonly<LWProcess.Calendar>;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessTuningFields: LWProcessTuningFields.Api; LWProcessTime?: LWProcessTime.Api; LWProcessHtml: LWProcessHtml.Api;
  LWProcessTuningCalendar?: LWProcessTuningCalendar.Api};
 const F = root.LWProcessTuningFields, {html} = root.LWProcessHtml;
 const DEFAULT: Readonly<LWProcess.Calendar> = Object.freeze({minutesPerDay: 480, daysPerWeek: 5});
 const MODES: [string, string][] = [['none', 'None (minutes and hours only)'], ['set', 'Business days and weeks']];
 const HELP = 'It changes only how times are shown, never a run: durations stay business minutes, with a day or week gloss.';
 /** The draft's calendar as an object, whatever was pasted; values are judged by the catalog, not here. */
 const calendarOf = (def: LWProcess.Definition): Partial<Record<keyof LWProcess.Calendar, unknown>> | undefined =>
  def.calendar && typeof def.calendar === 'object' && !Array.isArray(def.calendar) ? def.calendar : undefined;
 const whole = (v: unknown, high: number) => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= high;
 /** One sentence showing a business week of work in the chosen calendar, when both values are valid. */
 function example(cal: Partial<Record<keyof LWProcess.Calendar, unknown>> | undefined): LWProcessHtml.Safe | '' {
  const time = root.LWProcessTime;
  if (!time || !cal || !whole(cal.minutesPerDay, 1440) || !whole(cal.daysPerWeek, 7)) return '';
  const valid = cal as LWProcess.Calendar, week = valid.minutesPerDay * valid.daysPerWeek;
  return html`<p class="de-help" id="tune-cal-example">A business week of work reads ${time.span(week, valid)}.</p>`;
 }
 function markup(def: LWProcess.Definition): LWProcessHtml.Safe {
  const present = Object.hasOwn(def, 'calendar'), cal = calendarOf(def);
  const choice = F.choice('tune-cal-mode', 'Working calendar', 'calendar', present ? 'set' : 'none', MODES, HELP);
  const fields = present ? html`<div class="de-grid">
    ${F.int('tune-cal-day', 'Minutes per business day', 'calendar.minutesPerDay', cal?.minutesPerDay as number | undefined,
     {min: 1, max: 1440, unit: 'business minutes', help: 'Whole number, 1 to 1,440. 480 is an eight-hour day.'})}
    ${F.int('tune-cal-week', 'Business days per week', 'calendar.daysPerWeek', cal?.daysPerWeek as number | undefined,
     {min: 1, max: 7, unit: 'days', help: 'Whole number, 1 to 7.'})}</div>${example(cal)}` : '';
  return html`<fieldset class="de-card" id="tune-cal"><legend>Working calendar (display only)</legend>
   <div class="de-errs" id="tune-cal-err" data-errs="calendar"></div>${choice}${fields}</fieldset>`;
 }
 function special(def: LWProcess.Definition, el: HTMLElement): LWProcessTuningCalendar.Result | null {
  if (el.dataset.path !== 'calendar') return null;
  const mode = (el as HTMLSelectElement).value;
  if (mode === 'none') delete def.calendar;
  else if (!calendarOf(def)) def.calendar = {...DEFAULT};
  return {write: true, rerender: true, focus: '#tune-cal-mode'};
 }
 root.LWProcessTuningCalendar = {markup, special, DEFAULT};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessTuningCalendar;
})(globalThis);
