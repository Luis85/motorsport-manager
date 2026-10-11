/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-tuning-fields.ts" />
/// <reference path="./process-time.ts" />
/// <reference path="./process-html.ts" />
/**
 * The "Working hours" group of the Definition editor's Tune values form (LWProcessTuningHours), shown in the Process section right
 * after the display calendar group and wired by process-tuning.ts. It edits the definition's optional run calendar `workingHours`
 * ({opensAt, closesAt, daysPerWeek}, LWProcessHours), which unlike the display calendar changes the run: work and arrivals pause
 * outside working hours and the clock counts elapsed minutes from Monday of day 1 at the opening.
 *
 * - Without working hours: one sentence on what they do and **Add working hours** (09:00 to 17:00, Monday to Friday). While the
 *   draft has a display calendar the button is disabled and an adjacent sentence gives the reason (a definition holds at most one).
 * - With working hours: **Opens at** and **Closes at** time fields (24-hour; a closing of 00:00 is midnight at the end of the day,
 *   1440), **Working days** (Monday only up to every day), a sentence with the hours per week and what pauses, and **Remove working
 *   hours…**, which asks first (Cancel is the default and keeps the hours) and is then offered as an Undo by its label.
 * - The catalog judges the values: its diagnostics (`/workingHours/...`) appear beside the fields; a time that cannot be read gets
 *   a local message and writes nothing.
 * Pure markup (LWProcessHtml `html`, returned as `Safe`) and draft-object edits: no DOM access beyond the element handed in, no
 * draft store, no session, nothing ticks.
 */
declare namespace LWProcessTuningHours {
 /** The tuning form's edit result (the same shape as the other groups'). */
 interface Result {write: boolean; rerender: boolean; focus?: string; local?: [string, string]}
 type Confirm = (message: string, choices: {id: string; label: string; default?: boolean}[]) => Promise<string>;
 interface Api {
  markup(def: LWProcess.Definition): LWProcessHtml.Safe;
  /** A change to an opening, closing or working-days control; null when the control is not one of them. */
  special(def: LWProcess.Definition, el: HTMLElement): Result | null;
  /** Add working hours; null when the button is not this group's add button. */
  act(def: LWProcess.Definition, button: HTMLElement): Result | null;
  /** Asks (Cancel first, when `confirm` is given) and resolves with the current draft without working hours, or null when kept. */
  remove(confirm: Confirm | undefined, current: () => LWProcess.Definition | undefined): Promise<LWProcess.Definition | null>;
  /** The hours a new choice starts with: 09:00 to 17:00, Monday to Friday. */
  DEFAULT: Readonly<LWProcess.WorkingHours>;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessTuningFields: LWProcessTuningFields.Api; LWProcessTime?: LWProcessTime.Api; LWProcessHtml: LWProcessHtml.Api;
  LWProcessTuningHours?: LWProcessTuningHours.Api};
 const F = root.LWProcessTuningFields, {html} = root.LWProcessHtml;
 type Hours = Partial<Record<keyof LWProcess.WorkingHours, unknown>>;
 const DEFAULT: Readonly<LWProcess.WorkingHours> = Object.freeze({opensAt: 540, closesAt: 1020, daysPerWeek: 5});
 const DAYS: [string, string][] = [['1', 'Monday only'], ['2', 'Monday to Tuesday'], ['3', 'Monday to Wednesday'], ['4', 'Monday to Thursday'],
  ['5', 'Monday to Friday'], ['6', 'Monday to Saturday'], ['7', 'Every day']];
 const OFF = 'Off: the run counts every minute as working time. With working hours, work and arrivals pause outside them, '
  + 'and the clock shows the day and the time.';
 const WHY = 'Remove the display calendar first: a process with working hours words its times by the clock, so it cannot have both.';
 const ASK = 'Remove the working hours? The run then counts every minute as working time again.';
 /** The draft's working hours as an object, whatever was pasted; values are judged by the catalog, not here. */
 const hoursOf = (def: LWProcess.Definition): Hours | undefined =>
  def.workingHours && typeof def.workingHours === 'object' && !Array.isArray(def.workingHours) ? def.workingHours : undefined;
 const whole = (v: unknown, low: number, high: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= low && v <= high;
 const pad = (n: number) => String(n).padStart(2, '0');
 /** A time field's value: minutes after midnight as 'HH:MM' (1440 is shown as 00:00), '' for anything else. */
 const clockText = (v: unknown) => whole(v, 0, 1440) ? `${pad(Math.floor(v % 1440 / 60))}:${pad(v % 60)}` : '';
 function clock(id: string, label: string, key: 'opensAt' | 'closesAt', value: unknown, help: string): LWProcessHtml.Safe {
  const path = 'workingHours.' + key;
  const input = html`<input id="${id}" type="time" step="60" data-path="${path}" data-kind="clock" value="${clockText(value)}"
   aria-describedby="${id}-help ${id}-err">`;
  return F.field(id, label, input, path, help);
 }
 /** One sentence with the hours per week and what pauses, when all three values are valid and the day closes after it opens. */
 function example(h: Hours): LWProcessHtml.Safe | '' {
  const time = root.LWProcessTime;
  if (!time || !whole(h.opensAt, 0, 1439) || !whole(h.closesAt, 1, 1440) || !whole(h.daysPerWeek, 1, 7) || h.closesAt <= h.opensAt) return '';
  const valid = h as LWProcess.WorkingHours, perWeek = Math.round((valid.closesAt - valid.opensAt) * valid.daysPerWeek / 6) / 10;
  return html`<p class="de-help" id="tune-hours-example">Open ${time.hours(valid)}: ${time.number(perWeek)} working hours in each 168-hour week.
   The run starts on Monday at ${clockText(valid.opensAt)}; outside these hours work pauses and no cases arrive, while timers and deadlines
   keep counting.</p>`;
 }
 function markup(def: LWProcess.Definition): LWProcessHtml.Safe {
  const h = hoursOf(def), errors = html`<div class="de-errs" id="tune-hours-err" data-errs="workingHours"></div>`;
  if (!Object.hasOwn(def, 'workingHours')) {
   const blocked = Object.hasOwn(def, 'calendar'), why = blocked ? html`<p class="de-help" id="tune-hours-why">${WHY}</p>` : '';
   const described = blocked ? 'tune-hours-help tune-hours-why' : 'tune-hours-help';
   const add = html`<button type="button" class="de-add" id="tune-hours-add" data-act="hours-add" aria-describedby="${described}"${blocked
    ? html` disabled title="${WHY}"` : ''}>Add working hours</button>`;
   return html`<fieldset class="de-card" id="tune-hours"><legend>Working hours</legend>${errors}
    <p class="de-help" id="tune-hours-help">${OFF}</p>${add}${why}</fieldset>`;
  }
  const days = typeof h?.daysPerWeek === 'number' ? String(h.daysPerWeek) : '';
  const options = DAYS.map(([v, name]) => html`<option value="${v}"${v === days ? html` selected` : ''}>${name}</option>`);
  const fields = html`<div class="de-grid">
    ${clock('tune-hours-open', 'Opens at', 'opensAt', h?.opensAt, '24-hour time; the run starts on Monday at this time.')}
    ${clock('tune-hours-close', 'Closes at', 'closesAt', h?.closesAt, 'After the opening; 00:00 is midnight at the end of the day.')}
    ${F.field('tune-hours-days', 'Working days', html`<select id="tune-hours-days" data-path="workingHours.daysPerWeek" data-kind="days"
     aria-describedby="tune-hours-days-help tune-hours-days-err">${options}</select>`, 'workingHours.daysPerWeek', 'Counted from Monday.')}</div>`;
  const remove = html`<button type="button" class="de-mini de-remove" id="tune-hours-remove" data-act="hours-remove">Remove working hours…</button>`;
  return html`<fieldset class="de-card" id="tune-hours"><legend>Working hours</legend>${errors}${fields}${h ? example(h) : ''}${remove}</fieldset>`;
 }
 /** Minutes after midnight from a time field ('HH:MM'); a closing of 00:00 is the end of the day. Undefined when it is not a time. */
 function minutesOf(text: string, closing: boolean): number | undefined {
  const m = /^(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(text.trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return undefined;
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  return closing && minutes === 0 ? 1440 : minutes;
 }
 function special(def: LWProcess.Definition, el: HTMLElement): LWProcessTuningHours.Result | null {
  const path = el.dataset.path ?? '', kind = el.dataset.kind;
  if (!path.startsWith('workingHours.') || (kind !== 'clock' && kind !== 'days')) return null;
  const h = hoursOf(def);
  if (!h) return {write: false, rerender: true};
  const key = path.slice('workingHours.'.length) as keyof LWProcess.WorkingHours, value = (el as HTMLInputElement).value;
  const minutes = kind === 'days' ? Number(value) : minutesOf(value, key === 'closesAt');
  if (minutes === undefined || !Number.isInteger(minutes)) return {write: false, rerender: false, local: [path, 'Enter a time such as 09:00.']};
  h[key] = minutes;
  return {write: true, rerender: true, focus: '#' + el.id};
 }
 function act(def: LWProcess.Definition, button: HTMLElement): LWProcessTuningHours.Result | null {
  if (button.dataset.act !== 'hours-add' || Object.hasOwn(def, 'calendar')) return null;
  def.workingHours = {...DEFAULT};
  return {write: true, rerender: true, focus: '#tune-hours-open'};
 }
 async function remove(confirm: LWProcessTuningHours.Confirm | undefined, current: () => LWProcess.Definition | undefined) {
  if (confirm) {
   const choice = await confirm(ASK, [{id: 'keep-hours', label: 'Cancel', default: true}, {id: 'remove-hours', label: 'Remove working hours'}]);
   if (choice !== 'remove-hours') return null;
  }
  // The draft may have changed while the question was open: act on the current text.
  const def = current();
  if (!def || !Object.hasOwn(def, 'workingHours')) return null;
  delete def.workingHours;
  return def;
 }
 root.LWProcessTuningHours = {markup, special, act, remove, DEFAULT};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessTuningHours;
})(globalThis);
