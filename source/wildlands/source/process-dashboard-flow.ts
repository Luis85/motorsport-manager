/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-dashboard-model.ts" />
/// <reference path="./process-dashboard-window.ts" />
/**
 * Dashboard section 2 (LWProcessDashboardFlow): "Flow over time": arrivals against finishes, work in progress over time, throughput
 * per interval and the Little's law identity. Pure view-models over the detached view and the optional sampled series (research
 * 4.1 and 4.7); helpers come from LWProcessDashboardModel.util. No DOM, session, clock or storage.
 *
 * Definitions: the run-level cumulative flow diagram plots arrived against finished (completed + failed); per-step bands are not
 * drawn because branches and loops make them invalid. Mean work in progress per interval is the difference of the case-minute area
 * divided by the interval length. Little's law over [W, T] is exact (L = A / (T - W), λ = S / (T - W), W̄ = A / S, with A the
 * case-minute area in the window and S the cases in progress at W plus the arrivals after it); the "stable flow" conditions are
 * listed as observations, never scored. Without a series, W is 0 and the snapshot's `wipArea` gives the whole-run identity.
 * With a window (LWProcessDashboardWindow) the time charts mark W ("measuring from here"), the arrivals and work-in-progress
 * captions add the window's exact totals with its label, and Little's law covers [W, last sample].
 */
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessDashboardModel: LWProcessDashboardModel.Api; LWProcessTerms: LWProcessTerms.Api;
  LWProcessDashboardWindow: LWProcessDashboardWindow.Api; LWProcessDashboardFlow?: LWProcessDashboardSections.Builder};
 type Input = LWProcessDashboardData.Input;
 type Panel = LWProcessDashboardModel.Panel;
 type Series = LWProcessDashboardData.Series;
 type Metrics = LWProcess.Snapshot['metrics'] & LWProcessDashboardData.Metrics;
 const u = () => root.LWProcessDashboardModel.util;
 const NEEDS_SERIES = 'Needs a sampled run history.', NEEDS_TWO = 'Needs at least two sampling intervals of the run history.';
 /** The series when it has at least `n` samples, else null. */
 const sampled = (input: Input, n: number): Series | null => input.series && input.series.minutes.length >= n ? input.series : null;
 const diff = (a: number[]) => a.slice(1).map((v, i) => v - a[i]!);
 const legendOf = (series: LWProcessChart.Series[]) => series.map(x => ({label: x.label, tone: x.tone}));
 /** A time-series table: a long one keeps its latest rows when shortened. */
 const timeTable = (caption: string, head: string[], rows: (string | number)[][]) => ({...u().table(caption, head, rows), tail: true});
 const upper = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
 function arrivals(input: Input): Panel {
  const {definition: d, snapshot: q} = input.view, m = q.metrics, t = root.LWProcessTerms.of(d), U = u(), s = sampled(input, 1);
  const finished = m.completed + m.failed;
  const text = `By minute ${U.number(q.minute)}, ${U.number(m.arrived)} arrived and ${U.number(finished)} finished; `
   + `${U.number(m.active)} ${m.active === 1 ? 'is' : 'are'} open.`;
  const base = U.panel('arrivals', 'Arrivals and finishes', 'Is work arriving faster than it finishes? How much is open?', {caption: text});
  if (q.minute === 0) return {...base, empty: 'No simulated time yet.'};
  if (!s) return {...base, empty: NEEDS_SERIES, notes: [text]};
  const w = root.LWProcessDashboardWindow.of(input), span = w ? upper(root.LWProcessDashboardWindow.label(w)) : '';
  const windowed = w ? ` ${span}, ${U.number(w.arrived)} arrived and ${U.number(w.completed + w.failed)} finished.` : '';
  const drawn = U.memo(input, 'arrivals', () => cumulative(input, s));
  return {...base, caption: text + drawn.growth + windowed, legend: drawn.legend, chart: drawn.chart, table: drawn.table};
 }
 /** The series part of the arrivals panel (chart, legend, table and the growth sentence), built once per series. */
 function cumulative(input: Input, s: Series): Pick<Panel, 'legend' | 'chart' | 'table'> & {growth: string} {
  const d = input.view.definition, t = root.LWProcessTerms.of(d), U = u();
  const fin = s.minutes.map((_, i) => s.run.completed[i]! + s.run.failed[i]!), outcomes = t.journey && d.steps.some(x => x.outcome);
  const series: LWProcessChart.Series[] = [{label: 'Arrived', values: s.run.arrived, tone: 'wait'}];
  if (outcomes) series.push({label: 'Goals reached', values: s.run.goals, tone: 'goal'}, {label: 'Lost', values: s.run.lost, tone: 'blocked'});
  else series.push({label: 'Finished (completed and failed)', values: fin, tone: 'join'});
  if (!outcomes && s.run.dropped.some(v => v > 0)) series.push({label: 'Dropped arrivals', values: s.run.dropped, tone: 'blocked'});
  // Open work that has grown at every sample for at least three samples names the minute it started growing.
  let k = s.minutes.length - 1;
  while (k > 0 && s.run.wip[k - 1]! < s.run.wip[k]!) k--;
  const growth = s.minutes.length - 1 - k >= 3 ? ` Open work has grown at every sample since minute ${U.number(s.minutes[k]!)}.` : '';
  const rows = s.minutes.map((x, i) => [x, s.run.arrived[i]!, fin[i]!, s.run.wip[i]!, s.run.dropped[i]!]);
  const title = `Cumulative arrived and finished ${t.many} by business minute`, W = input.window ?? 0;
  const chart: LWProcessDashboardModel.Chart = {kind: 'lines', title, axis: t.many, xs: s.minutes, series, step: true, mark: W || null};
  return {growth, legend: legendOf(series), chart,
   table: timeTable(`Cumulative ${t.many} at each sample minute`, ['Minute', 'Arrived', 'Finished', 'Open', 'Dropped'], rows)};
 }
 function work(input: Input): Panel {
  const {definition: d, snapshot: q} = input.view, t = root.LWProcessTerms.of(d), U = u(), s = sampled(input, 2), W = input.window ?? 0;
  const base = U.panel('wip', 'Work in progress over time', 'Is work in progress stable, growing or oscillating?', {});
  if (q.minute === 0) return {...base, empty: 'No simulated time yet.'};
  if (!s) return {...base, empty: NEEDS_TWO};
  const xs = s.minutes.slice(1), peak = s.run.wipPeak.slice(1), top = peak.indexOf(Math.max(...peak));
  const mean = diff(s.run.wipArea).map((a, i) => a / Math.max(1, s.minutes[i + 1]! - s.minutes[i]!));
  const w = root.LWProcessDashboardWindow.of(input);
  const windowed = w && w.minutes ? ` Mean ${U.number(w.wipArea / w.minutes)} ${root.LWProcessDashboardWindow.label(w)}.` : '';
  const caption = `Average open ${t.many} per interval went from ${U.number(mean[0]!)} to ${U.number(mean.at(-1)!)}; `
   + `the peak was ${U.number(peak[top]!)} in the interval to minute ${U.number(xs[top]!)}.${windowed}`;
  const series: LWProcessChart.Series[] = [{label: 'Mean in progress', values: mean, tone: 'work'},
   {label: 'Peak in the interval', values: peak, tone: 'idle'}];
  const title = `Open ${t.many} per interval of ${U.number(s.every)} min`;
  return {...base, caption, legend: legendOf(series), chart: {kind: 'lines', title, axis: t.many, xs, series, step: false, mark: W || null},
   table: timeTable(`Open ${t.many} per interval`, ['Interval end minute', 'Mean', 'Peak', 'At the end'],
    xs.map((x, i) => [x, U.round(mean[i]!), peak[i]!, s.run.wip[i + 1]!]))};
 }
 function throughput(input: Input): Panel {
  const {definition: d, snapshot: q} = input.view, t = root.LWProcessTerms.of(d), U = u(), s = sampled(input, 2), W = input.window ?? 0;
  const base = U.panel('throughput', 'Throughput per interval', 'Is output steady? Did it change after start-up?', {});
  if (q.minute === 0) return {...base, empty: 'No simulated time yet.'};
  if (!s) return {...base, empty: NEEDS_TWO};
  const xs = s.minutes.slice(1), done = diff(s.run.completed), failed = diff(s.run.failed), came = diff(s.run.arrived);
  const shown = done.slice(Math.max(0, xs.findIndex(x => x > W))), mean = shown.reduce((a, b) => a + b, 0) / Math.max(1, shown.length);
  const every = U.number(s.every), after = W ? ` after minute ${U.number(W)}` : '';
  const caption = `Finishes per ${every} min${after}: mean ${U.number(mean)}, range ${U.number(Math.min(...shown))}–${U.number(Math.max(...shown))}.`;
  const stacked: LWProcessChart.Series[] = [{label: 'Completed', values: done, tone: 'join'}, {label: 'Failed', values: failed, tone: 'blocked'}];
  const line: LWProcessChart.Series = {label: 'Arrived', values: came, tone: 'wait'};
  return {...base, caption, legend: legendOf([...stacked, line]),
   chart: {kind: 'columns', title: `${t.Many} per interval of ${every} min`, axis: `${t.many} per ${every} min`, xs, stacked, line},
   table: timeTable(`${t.Many} per interval`, ['Interval end minute', 'Arrived', 'Completed', 'Failed'],
    xs.map((x, i) => [x, came[i]!, done[i]!, failed[i]!]))};
 }
 interface Window {A: number; S: number; span: number; came: number; left: number; finishedMean: number | null; start: number | null; end: number | null}
 /** Little's law quantities over [W, last sample] from the series, or over [0, T] from the snapshot; null without the area. */
 function window(input: Input): Window | null {
  const q = input.view.snapshot, m = q.metrics as Metrics, s = input.series, w = root.LWProcessDashboardWindow.of(input);
  if (w) {
   return {A: w.wipArea, S: w.wipStart + w.arrived, span: w.minutes, came: w.arrived, left: w.completed + w.failed,
    finishedMean: w.completed ? w.cycleSum / w.completed : null, start: w.wipStart, end: w.wipEnd};
  }
  if (m.wipArea === undefined) return null;
  const finishedMean = m.completed ? (m.cycleSum ?? m.meanCycleMinutes * m.completed) / m.completed : null;
  const start = s && s.minutes.length > 1 ? s.run.wip[0]! : null, end = s && s.minutes.length > 1 ? s.run.wip.at(-1)! : null;
  return {A: m.wipArea, S: m.arrived, span: q.minute, came: m.arrived, left: m.completed + m.failed, finishedMean, start, end};
 }
 function little(input: Input): Panel {
  const {definition: d, snapshot: q} = input.view, m = q.metrics, t = root.LWProcessTerms.of(d), U = u(), W = input.window ?? 0;
  const base = U.panel('little', "Little's law", 'Do work in progress, arrival rate and time in system agree?', {});
  if (q.minute <= W) return {...base, empty: 'Needs simulated time after the measuring start.'};
  const w = window(input);
  if (!w) return {...base, empty: `Needs the ${t.one}-minute area of work in progress from the run history.`};
  if (!w.S || w.span <= 0) return {...base, empty: `No ${t.one} has arrived in the window yet.`};
  const L = w.A / w.span, rate = Math.round(w.S / w.span * 1000) / 1000, Wbar = w.A / w.S, from = W ? `from minute ${U.number(W)}` : 'since minute 0';
  const lines = [`Mean in progress L ${U.number(L)} = arrival rate λ ${rate} per minute × mean time in system W ${U.minutes(Wbar, d)} (${from}).`];
  if (w.finishedMean !== null) {
   const age = m.meanAgeMinutes, gap = Wbar > w.finishedMean * 1.05 && m.active > 0 && age !== null;
   const why = gap ? `; the ${U.number(m.active)} still open have been in the system ${U.minutes(age, d)} on average, so finished-only figures understate `
    + 'time in system.' : '.';
   lines.push(`Finished ${t.many} averaged ${U.minutes(w.finishedMean, d)}${why}`);
  }
  const apart = Math.abs(w.came - w.left);
  lines.push(apart <= .05 * Math.max(1, w.came) ? 'Observation: arrivals and finishes were within 5% of each other.'
   : `Observation: arrivals ${w.came > w.left ? 'exceeded' : 'trailed'} finishes by ${U.percent(apart, Math.max(1, w.left))}.`);
  if (w.start !== null && w.end !== null) {
   lines.push(`Observation: ${U.number(w.start)} in progress at the start of the window and ${U.number(w.end)} at its last sample.`);
  }
  const rows = [[`${t.One}-minutes in progress (A)`, U.number(w.A)], [`${t.Many} in the window (S)`, U.number(w.S)],
   ['Window length (minutes)', U.number(w.span)],
   ['Mean in progress (L)', U.number(L)], ['Arrival rate per minute (λ)', String(rate)], ['Mean time in system (W)', U.minutes(Wbar, d)],
   [`Mean lead time of finished ${t.many}`, w.finishedMean === null ? '—' : U.minutes(w.finishedMean, d)]];
  return {...base, caption: lines[0]!, chart: {kind: 'text', title: "Little's law over the window", lines},
   table: U.table("Little's law quantities", ['Quantity', 'Value'], rows)};
 }
 function sections(input: Input): LWProcessDashboardModel.Section[] {
  // Panels drawn only from a run history of two samples or more are built once per series (LWProcessDashboardModel.util.memo).
  const kept = (key: string, make: (i: Input) => Panel) => sampled(input, 2) ? u().memo(input, key, () => make(input)) : make(input);
  return [{id: 'flow', title: 'Flow over time', panels: [arrivals(input), kept('wip', work), kept('throughput', throughput), little(input)]}];
 }
 root.LWProcessDashboardFlow = {sections};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessDashboardFlow;
})(globalThis);
