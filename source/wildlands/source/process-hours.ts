/// <reference path="./process-contracts.d.ts" />
/**
 * Run calendar arithmetic for opt-in working hours (LWProcessHours), owned by the process-definition context. Pure integer
 * functions over a definition's optional `workingHours: {opensAt, closesAt, daysPerWeek}`: no clock, no state, no randomness.
 *
 * Model. A day has 1,440 minutes and a week 7 days. `opensAt` (0..1439) and `closesAt` (1..1440, after `opensAt`) are minutes
 * after midnight; the working days are the first `daysPerWeek` days of each week, counted from Monday (5 is Monday to Friday).
 * Minute 0 of every run is the first opening: Monday of day 1 at `opensAt`. The run clock counts elapsed minutes; slot `m` is the
 * minute from `m` to `m + 1`, and it is working time when its weekday is a working day and its time of day lies in
 * [opensAt, closesAt). Seen from the run start, every working day is the window [d × 1440, d × 1440 + length) of the week
 * (length = closesAt − opensAt), so the engine arithmetic depends only on the length and the working days; `opensAt` names the
 * time of day for wording and the fingerprint.
 *
 * - `open(h, m)`: slot `m` is working time.
 * - `boundary(h, m)`: the first minute after `m` whose slot differs in openness from slot `m` (a closing or an opening), or
 *   Infinity when the hours never close (seven days of 00:00 to 24:00).
 * - `working(h, m)`: working slots in [0, m), the working minutes elapsed by minute `m`.
 * - `at(h, w)`: the elapsed minute at which working minute `w` (0-based) begins; `working(h, at(h, w)) === w` and slot `at(h, w)` is open.
 * - `where(h, m)`: day number (1-based), weekday (0 is Monday), minute of the day, openness, and the next opening when closed.
 * - `describe(h)`: the hours in words, '09:00–17:00, Monday to Friday' (shared by the BPMN notes and LWProcessTime).
 * - `check(d, fail)`: the semantic rules the schema cannot state (closing after opening, no display calendar beside working hours).
 *
 * Engine semantics built on these (LWProcessSystems, LWProcessLedger, the session): outside working time no work starts or
 * progresses (running work pauses with its remaining minutes and keeps its pool units), arrival streams pause (their `at`,
 * `interval`, `gap` and `until` count working minutes, so an arrival is admitted at `at(h, w)`, never while closed), timers and
 * deadlines count elapsed minutes and may fire while closed, pools charge work and capacity cost only for working minutes, and
 * every token-minute and case-minute outside working time is booked as `closed` in minutes-by-state and lead time.
 */
declare namespace LWProcessHours {
 interface Where {
  /** Day of the run, 1-based: day 1 is the Monday the run starts on. */
  day: number;
  /** Weekday, 0 (Monday) to 6 (Sunday). */
  weekday: number;
  /** Minutes after midnight, 0..1439. */
  minuteOfDay: number;
  open: boolean;
  /** The elapsed minute of the next opening when closed; the minute itself when open. */
  opens: number;
 }
 interface Api {
  readonly DAY: number;
  readonly WEEK: number;
  open(h: LWProcess.WorkingHours, minute: number): boolean;
  boundary(h: LWProcess.WorkingHours, minute: number): number;
  working(h: LWProcess.WorkingHours, minute: number): number;
  at(h: LWProcess.WorkingHours, workingMinute: number): number;
  where(h: LWProcess.WorkingHours, minute: number): Where;
  describe(h: LWProcess.WorkingHours): string;
  check(d: LWProcess.Definition, fail: (path: string, message: string) => void): void;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessHours?: LWProcessHours.Api};
 const DAY = 1440, WEEK = 7 * DAY;
 const length = (h: LWProcess.WorkingHours) => h.closesAt - h.opensAt;
 /** Position of slot `minute` in its week, seen from the run start: [week index, day of that week, minute of that day]. */
 function frame(minute: number): [number, number, number] {
  const j = minute % WEEK;
  return [Math.floor(minute / WEEK), Math.floor(j / DAY), j % DAY];
 }
 function open(h: LWProcess.WorkingHours, minute: number): boolean {
  const [, d, r] = frame(minute);
  return d < h.daysPerWeek && r < length(h);
 }
 function boundary(h: LWProcess.WorkingHours, minute: number): number {
  const len = length(h), j = minute % WEEK, [, d, r] = frame(minute);
  if (len === DAY && h.daysPerWeek === 7) return Infinity;
  if (open(h, minute)) return len === DAY ? minute + h.daysPerWeek * DAY - j : minute + len - r;
  return minute + (d + 1 < h.daysPerWeek ? (d + 1) * DAY : WEEK) - j;
 }
 function working(h: LWProcess.WorkingHours, minute: number): number {
  const len = length(h), [q, d, r] = frame(minute);
  return q * h.daysPerWeek * len + Math.min(d, h.daysPerWeek) * len + (d < h.daysPerWeek ? Math.min(r, len) : 0);
 }
 function at(h: LWProcess.WorkingHours, workingMinute: number): number {
  const len = length(h), perWeek = h.daysPerWeek * len, rest = workingMinute % perWeek;
  return Math.floor(workingMinute / perWeek) * WEEK + Math.floor(rest / len) * DAY + rest % len;
 }
 function where(h: LWProcess.WorkingHours, minute: number): LWProcessHours.Where {
  const absolute = h.opensAt + minute, isOpen = open(h, minute);
  return {day: Math.floor(absolute / DAY) + 1, weekday: Math.floor(absolute / DAY) % 7, minuteOfDay: absolute % DAY, open: isOpen,
   opens: isOpen ? minute : boundary(h, minute)};
 }
 const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
 const pad = (n: number) => String(n).padStart(2, '0');
 /** Minutes after midnight as a 24-hour time; 1440 reads '24:00'. */
 const timeOfDay = (m: number) => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
 function describe(h: LWProcess.WorkingHours): string {
  const n = h.daysPerWeek, days = n === 7 ? 'every day' : n === 1 ? 'Monday only' : 'Monday to ' + WEEKDAYS[n - 1];
  return `${timeOfDay(h.opensAt)}–${timeOfDay(h.closesAt)}, ${days}`;
 }
 function check(d: LWProcess.Definition, fail: (path: string, message: string) => void): void {
  const h = d.workingHours;
  if (!h) return;
  if (h.closesAt <= h.opensAt) {
   fail('/workingHours/closesAt', `Working hours need closesAt after opensAt: the day would close at minute ${h.closesAt} but opens at minute ${h.opensAt}.`);
  }
  if (d.calendar) {
   fail('/workingHours', 'A process with working hours cannot also have a display calendar: its times count elapsed minutes. '
    + 'Remove calendar or workingHours.');
  }
 }
 root.LWProcessHours = Object.freeze({DAY, WEEK, open, boundary, working, at, where, describe, check});
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessHours;
})(globalThis);
