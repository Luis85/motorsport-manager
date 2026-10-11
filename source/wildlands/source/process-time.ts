/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-hours.ts" />
/**
 * Shared wording of simulated time for Process Studio views, slides and Present (LWProcessTime). The engine counts whole
 * business minutes: the working time a definition models, not wall-clock time. Every view that prints a duration names that
 * unit the same way and adds an hours gloss once a value is long enough that minutes stop being readable. Pure functions over
 * plain numbers: no DOM, session, clock or storage.
 *
 * Days and weeks exist only through a definition's optional display calendar (`calendar: {minutesPerDay, daysPerWeek}`),
 * passed to `span`. Its rules: without a calendar (or with one that is not two positive finite numbers) `span` is exactly
 * `minutes`. With one, a duration shorter than one business day is also exactly `minutes`; from one business day up to one
 * business week (days = minutes / minutesPerDay, at most daysPerWeek) the gloss is business days, and above one week it is
 * business weeks (weeks = days / daysPerWeek). The gloss is rounded to one decimal and marked '≈' unless it is exact:
 * '2,000 min (≈ 4.2 business days)', '2,400 min (5 business days)', '3,600 min (1.5 business weeks)' for 480 minutes
 * per day and 5 days per week. The calendar never changes a run; it only changes these words.
 *
 * Working hours (`workingHours: {opensAt, closesAt, daysPerWeek}`, LWProcessHours) do change a run, and its clock then counts
 * elapsed minutes from Monday of day 1 at the opening time; durations keep the plain `minutes` wording (a definition cannot hold
 * both). `hours` names the hours ('09:00–17:00, Monday to Friday'), `clock` the day and time of a run minute ('Day 2 · Tue 09:30')
 * and `closedUntil` the next opening while closed ('Closed until Mon 09:00 on day 8', '' while open). These read LWProcessHours
 * when called; they never read a wall clock.
 */
declare namespace LWProcessTime {
 interface Api {
  /** The unit of every simulated time: 'business minutes'. */
  readonly UNIT: string;
  /** Durations from this many minutes up also show hours ('240 min (≈ 4 h)'); shorter ones stay in minutes. */
  readonly HOURS_FROM: number;
  /** Whole numbers with thousands separators ('119,928'); other numbers keep their decimals. */
  number(n: number): string;
  /** A duration in business minutes: '45 min', '19,007 min (≈ 316.8 h)'. Rounded to one decimal. */
  minutes(n: number): string;
  /** A duration, or '—' when there is none (`null`, or no value yet). */
  maybe(n: number | null | undefined): string;
  /** A duration with a business day or week gloss from a display calendar; exactly `minutes(n)` without one (see the header). */
  span(n: number, calendar?: LWProcess.Calendar | null): string;
  /** Working hours in words: '09:00–17:00, Monday to Friday'. */
  hours(h: LWProcess.WorkingHours): string;
  /** The day and time of run minute `minute` under working hours: 'Day 2 · Tue 09:30'. */
  clock(minute: number, h: LWProcess.WorkingHours): string;
  /** 'Closed until Tue 09:00 on day 2' while run minute `minute` is outside working hours; '' while open. */
  closedUntil(minute: number, h: LWProcess.WorkingHours): string;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessTime?: LWProcessTime.Api};
 const UNIT = 'business minutes', HOURS_FROM = 120;
 function number(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const [whole, fraction] = String(Math.abs(n)).split('.');
  return (n < 0 ? '-' : '') + whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction !== undefined ? '.' + fraction : '');
 }
 const tenth = (n: number) => Math.round(n * 10) / 10;
 function minutes(n: number): string {
  const text = number(tenth(n)) + ' min';
  return Math.abs(n) >= HOURS_FROM ? `${text} (≈ ${number(tenth(n / 60))} h)` : text;
 }
 const maybe = (n: number | null | undefined): string => n === null || n === undefined || !Number.isFinite(n) ? '—' : minutes(n);
 const usable = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0;
 function span(n: number, calendar?: LWProcess.Calendar | null): string {
  if (!calendar || !usable(calendar.minutesPerDay) || !usable(calendar.daysPerWeek) || !Number.isFinite(n)) return minutes(n);
  const days = Math.abs(n) / calendar.minutesPerDay;
  if (days < 1) return minutes(n);
  const weekly = days > calendar.daysPerWeek, value = weekly ? days / calendar.daysPerWeek : days, shown = tenth(value);
  const unit = (weekly ? 'business week' : 'business day') + (shown === 1 ? '' : 's');
  return `${number(tenth(n))} min (${shown === value ? '' : '≈ '}${number(shown)} ${unit})`;
 }
 const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
 const pad = (n: number) => String(n).padStart(2, '0');
 const calc = () => (globalThis as unknown as {LWProcessHours: LWProcessHours.Api}).LWProcessHours;
 const hours = (h: LWProcess.WorkingHours) => calc().describe(h);
 const at = (w: LWProcessHours.Where) => `${DAYS[w.weekday]} ${pad(Math.floor(w.minuteOfDay / 60))}:${pad(w.minuteOfDay % 60)}`;
 const clock = (minute: number, h: LWProcess.WorkingHours) => {
  const w = calc().where(h, minute);
  return `Day ${number(w.day)} · ${at(w)}`;
 };
 function closedUntil(minute: number, h: LWProcess.WorkingHours): string {
  const w = calc().where(h, minute);
  if (w.open) return '';
  const next = calc().where(h, w.opens);
  return `Closed until ${at(next)} on day ${number(next.day)}`;
 }
 root.LWProcessTime = Object.freeze({UNIT, HOURS_FROM, number, minutes, maybe, span, hours, clock, closedUntil});
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessTime;
})(globalThis);
