/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-dashboard-model.ts" />
/// <reference path="./process-hours.ts" />
/**
 * "Measure from minute W" and the Dashboard's series cache (LWProcessDashboardWindow, presentation, pure: no DOM, session, clock or
 * storage). It owns two rules every dashboard module shares:
 *
 * - The window. W is offered only on sample-grid minutes of the run history (`series.minutes`) before the current minute, so every
 *   windowed value is an exact difference of cumulative totals: C(E) − C(W), with E the last sample minute. The partial interval after
 *   E is left out and named ("to minute E"). Windowed values: arrivals, finishes, failures, drops, goals and losses, work cost, the
 *   case-minute area (mean work in progress, Little's law), the cycle sum of the cases finished in the window (their mean lead time)
 *   and each pool's busy minutes (utilisation and pool cost). Distributions and per-case charts stay whole-run. Choosing W never
 *   changes the run: it is a view value the surface keeps in memory, and What-if receives it as its replications' warm-up.
 * - The series cache. `follow` reads the sampled series incrementally with a `{level, count}` cursor and appends the new samples; it
 *   reads everything again when the run changed (another definition revision or seed: `run`), the decimation level changed, or the
 *   payload does not start where the cache ends (a run restarted to an earlier minute). A run with the same definition and seed is
 *   the same run however it was chunked or restarted, so its cached samples stay valid.
 */
declare namespace LWProcessDashboardWindow {
 /** Differences of cumulative totals over [from, to] (two sample minutes); `wipStart` and `wipEnd` are the gauges at both ends. */
 interface Window {
  from: number; to: number; minutes: number; wipStart: number; wipEnd: number;
  arrived: number; completed: number; failed: number; dropped: number; goals: number; lost: number; cost: number; wipArea: number; cycleSum: number;
  /** Busy unit-minutes per pool id over the window. */
  busy: Record<string, number>;
  /** Minutes pools were available in the window: `minutes`, or with working hours only its working minutes (utilisation divides by it). */
  available?: number;
 }
 /** The cached series and the run it belongs to. */
 interface Cache {run: string; series: LWProcessDashboardData.Series | null}
 interface Api {
  /** The grid minutes W may take: sample minutes before the current minute (none until the run history has two samples). */
  choices(series: LWProcessDashboardData.Series | null | undefined, minute: number): number[];
  /** The window to use: `requested` when it is one of the choices, else 0 (the whole run). */
  pick(series: LWProcessDashboardData.Series | null | undefined, minute: number, requested: number | undefined): number;
  /** The windowed totals of `input` (its `window` must be a valid choice above 0), or null for the whole run. */
  of(input: LWProcessDashboardData.Input): Window | null;
  /** "from minute 1,440 to minute 4,320", the label every windowed value carries. */
  label(w: Window): string;
  /** The identity of a run whose samples can be cached: definition id, revision and seed. */
  run(view: LWProcessApp.View): string;
  /** Reads the series into the cache incrementally (see the header); `read` is the session's `series(after?)` query. */
  follow(cache: Cache, run: string, read: (after?: {level: number; count: number}) => LWProcessDashboardData.Series | null): Cache;
  /** Windowed utilisation of a pool: busy minutes over the window ÷ (window minutes × capacity); null for an empty window. */
  utilization(w: Window, pool: string, capacity: number): number | null;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 type Series = LWProcessDashboardData.Series;
 const root = inputRoot as {LWProcessDashboardModel: LWProcessDashboardModel.Api; LWProcessHours: LWProcessHours.Api;
  LWProcessDashboardWindow?: LWProcessDashboardWindow.Api};
 function choices(series: Series | null | undefined, minute: number): number[] {
  return series && series.minutes.length > 1 ? series.minutes.filter(x => x < minute) : [];
 }
 function pick(series: Series | null | undefined, minute: number, requested: number | undefined): number {
  const w = requested ?? 0;
  return w > 0 && choices(series, minute).includes(w) ? w : 0;
 }
 function of(input: LWProcessDashboardData.Input): LWProcessDashboardWindow.Window | null {
  const s = input.series, from = pick(s, input.view.snapshot.minute, input.window);
  if (!s || !from) return null;
  const i = s.minutes.indexOf(from), e = s.minutes.length - 1, r = s.run;
  const delta = (column: number[]) => column[e]! - column[i]!;
  const busy: Record<string, number> = {};
  for (const [id, pool] of Object.entries(s.pools)) busy[id] = delta(pool.busyMinutes);
  const h = input.view.definition.workingHours, working = (m: number) => h ? root.LWProcessHours.working(h, m) : m;
  return {from, to: s.minutes[e]!, minutes: s.minutes[e]! - from, available: working(s.minutes[e]!) - working(from), wipStart: r.wip[i]!, wipEnd: r.wip[e]!,
   arrived: delta(r.arrived), completed: delta(r.completed), failed: delta(r.failed), dropped: delta(r.dropped), goals: delta(r.goals),
   lost: delta(r.lost), cost: delta(r.cost), wipArea: delta(r.wipArea), cycleSum: delta(r.cycleSum), busy};
 }
 const label = (w: LWProcessDashboardWindow.Window) => {
  const n = root.LWProcessDashboardModel.util.count;
  return `from minute ${n(w.from)} to minute ${n(w.to)}`;
 };
 const run = (view: LWProcessApp.View) => [view.definition.id, view.definition.revision, view.snapshot.seed].join('|');
 type Read = (after?: {level: number; count: number}) => Series | null;
 function follow(cache: LWProcessDashboardWindow.Cache, id: string, read: Read): LWProcessDashboardWindow.Cache {
  const held = cache.run === id ? cache.series : null;
  if (!held) return {run: id, series: read()};
  const next = read({level: held.level, count: held.minutes.length});
  if (!next) return {run: id, series: null};
  // A payload of the same level starts where the cache ends; any other start means the run restarted, so everything is read again.
  const same = next.level === held.level && next.base === held.base;
  if (same && next.offset !== undefined && next.offset !== held.minutes.length) return {run: id, series: read()};
  return {run: id, series: root.LWProcessDashboardModel.util.merge(held, next)};
 }
 function utilization(w: LWProcessDashboardWindow.Window, pool: string, capacity: number): number | null {
  const busy = w.busy[pool];
  const minutes = w.available ?? w.minutes;
  return busy === undefined || !minutes || !capacity ? null : busy / (minutes * capacity);
 }
 root.LWProcessDashboardWindow = {choices, pick, of, label, run, follow, utilization};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessDashboardWindow;
})(globalThis);
