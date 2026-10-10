/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-dashboard-model.ts" />
/// <reference path="./process-dashboard-window.ts" />
/// <reference path="./process-dashboard-whatif.ts" />
/**
 * Dashboard panels on real runs (business-process-analysis suite): every panel model is built from the studio controller's detached
 * reads (`query`, `series`, `distributions`, `recent`) of a real session, as the Dashboard binding wires them, and its numbers are
 * checked against the engine: Little's law and the case-minute identity, the time breakdown against the cycle sum, histogram
 * brackets against the exact nearest-rank percentiles of the finished cases, the target share at a bin edge, first pass, repeats,
 * failures by step and attributed cost, conversion over time, "Measure from minute W" at grid minutes, the incremental series cache
 * across restarts and new seeds, empty states, and the window handed to What-if as its warm-up.
 */
import assert from 'node:assert/strict';
import {replicate} from './process-sdk.cjs';
import {test, application, build, stepOf, flowOf, startEnd} from './test-process-helpers.cjs';
import {reads, chunking} from './test-process-readmodel-helpers.cjs';
import {demo} from './test-process-dashboard.cjs';
require('./process-dashboard-whatif.js');
const root = globalThis as unknown as {LWProcessDashboardModel: LWProcessDashboardModel.Api; LWProcessDashboardWindow: LWProcessDashboardWindow.Api;
 LWProcessDashboardWhatIf: LWProcessDashboardWhatIf.Api};
const M = root.LWProcessDashboardModel, Win = root.LWProcessDashboardWindow, U = M.util;
type Model = LWProcessDashboardModel.Model;
type Chart = LWProcessDashboardModel.Chart;
type Input = LWProcessDashboardData.Input;
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
/** The value of the Little's law table row whose quantity ends with `suffix` (the row names carry the process's terms). */
const little = (m: Model, suffix: string) => panel(m, 'little').table!.rows.find(r => r[0]!.endsWith(suffix))![1];
const diff = (a: number[]) => a.slice(1).map((v, i) => v - a[i]!);
const panel = (m: Model, id: string) => {
 const p = m.sections.flatMap(s => s.panels).find(x => x.id === id);
 assert(p, 'panel ' + id);
 return p;
};
const chart = <K extends Chart['kind']>(m: Model, id: string, kind: K) => {
 const c = panel(m, id).chart;
 assert(c && c.kind === kind, `${id} draws a ${kind} chart`);
 return c as Extract<Chart, {kind: K}>;
};
/** The studio path: the controller's detached view and reads after advancing `minutes` (optionally in chunks), as the binding wires them. */
function studio(d: LWProcess.Definition, minutes: number[], extra: Partial<Input> = {}): {input: Input; model: Model} {
 const app = application.create(d);
 try {
  app.horizon(null);
  for (const n of minutes) app.advance(n);
  const input: Input = {view: app.query(), series: app.series(), distributions: app.distributions(), recent: app.recent(), draft: false, ...extra};
  return {input, model: M.build(input)};
 } finally { app.dispose(); }
}
/** A detached view of a session snapshot (for runs with options the controller does not set). */
const viewOf = (d: LWProcess.Definition, q: LWProcess.Snapshot) => ({definition: d, snapshot: q, selected: null, mode: 'dashboard', playing: false,
 horizon: null, lens: 'sipoc', processes: [{id: d.id, name: d.name}], active: 0}) as unknown as LWProcessApp.View;

test("Dashboard on real runs: Little's law, the flow charts and the series agree with the engine on several demos", () => {
 for (const id of ['order-fulfilment', 'customer-journey-webshop', 'user-journey-app-onboarding', 'agency']) {
  const {input, model} = studio(demo(id), [1000, 2000]), q = input.view.snapshot, m = q.metrics, s = input.series!, T = q.minute;
  // Mean work in progress × the run = the case-minutes of every case: finished, failed and still open.
  const open = sum(q.cases.filter(c => c.status === 'active').map(c => T - c.entered));
  assert.equal(m.wipArea, m.cycleSum! + m.failedMinutes! + open, id + ': Σ case-minutes');
  assert.equal(little(model, '(L)'), U.number(m.wipArea! / T), id + ': L = A / T');
  assert.equal(little(model, 'in progress (A)'), U.number(m.wipArea!), id + ': A is the engine area');
  assert.equal(little(model, '(W)'), U.minutes(m.wipArea! / m.arrived, input.view.definition), id + ': W = A / S');
  // A grid-aligned run's last sample is the snapshot; the cumulative chart, interval means and columns are differences of it.
  const e = s.minutes.length - 1;
  if (s.minutes[e] === T) {
   assert.deepEqual([s.run.arrived[e], s.run.completed[e], s.run.wipArea[e], s.run.cost[e]], [m.arrived, m.completed, m.wipArea, m.cost]);
  }
  const arrivals = chart(model, 'arrivals', 'lines');
  assert.deepEqual(arrivals.series[0]!.values, s.run.arrived, id + ': arrived line');
  const wip = chart(model, 'wip', 'lines'), spans = diff(s.minutes);
  const area = Math.round(sum(wip.series[0]!.values.map((v, i) => v! * spans[i]!)));
  assert.equal(area, s.run.wipArea[e]! - s.run.wipArea[0]!, id + ': interval means × spans = area');
  const columns = chart(model, 'throughput', 'columns');
  assert.equal(sum(columns.stacked[0]!.values as number[]), s.run.completed[e]! - s.run.completed[0]!, id + ': finishes per interval add up');
  assert.deepEqual(model.tiles.find(t => t.id === 'active')!.spark, s.run.wip.slice(-12), id + ': the in-progress sparkline is the sampled WIP');
 }
});

test('Dashboard on real runs: the time breakdown sums to the cycle sum, flow efficiency and waiting use the exact state minutes', () => {
 for (const id of ['order-fulfilment', 'user-journey-app-onboarding', 'loan-application']) {
  const {input, model} = studio(demo(id), [2400]), q = input.view.snapshot, m = q.metrics, lead = m.leadTime!;
  const order = U.STATES.map(x => x.key), total = sum(order.map(k => lead[k]));
  assert.equal(total, m.cycleSum, id + ': the six states sum to the cycle sum');
  assert.equal(sum(m.flowEfficiency!.counts), m.completed, id + ': one efficiency bin per completed case');
  const bars = chart(model, 'breakdown', 'stack').bars;
  assert.deepEqual(bars[0]!.segments.map(x => x.value), order.map(k => lead[k]), id + ': finished segments are the engine minutes');
  assert(panel(model, 'breakdown').notes[0]!.startsWith(`Flow efficiency: ${U.percent(lead.working, total)} of lead time was worked`), id);
  const waiting = panel(model, 'waiting'), steps = new Map(q.steps.map(x => [x.id, x]));
  assert.equal(waiting.notes[0], 'Waiting token-minutes include work still waiting.');
  if (waiting.empty) assert(q.steps.every(x => x.minutesBy!.waiting === 0), id + ': ' + waiting.empty);
  else for (const r of chart(model, 'waiting', 'rows').rows) assert.equal(r.value, steps.get(r.step!)!.minutesBy!.waiting, id + ': waiting at ' + r.step);
  // Queues over time are the per-interval means of each step's waiting area.
  const s = input.series!, sparks = panel(model, 'queues').chart;
  if (sparks?.kind === 'sparks') {
   const named = new Map(input.view.definition.steps.map(x => [x.name, x.id]));
   for (const r of sparks.rows) {
    const area = s.steps[named.get(r.label)!]!.waitingArea;
    assert.deepEqual(r.values, diff(area).map((a, i) => a / (s.minutes[i + 1]! - s.minutes[i]!)), id + ': queue of ' + r.label);
   }
  }
 }
});

test('Dashboard on real runs: lead-time brackets hold the exact nearest-rank percentiles, and the target share is exact at a bin edge', () => {
 for (const id of ['order-fulfilment', 'customer-journey-webshop', 'loan-application']) {
  const d = demo(id), r = reads(d, [900], {retained: 10000}), m = r.q.metrics, dist = r.distributions;
  const lead = r.recent.filter(c => c.status === 'completed').map(c => c.finished - c.entered).sort((a, b) => a - b);
  assert.equal(lead.length, m.completed, id + ': every finished case is retained');
  assert.equal(sum(dist.cycle), m.completed, id + ': the fine bins hold every completed case');
  // The coarse 1-2-5 histogram is a sum of fine bins.
  const coarse = m.cycleHistogram, fine = coarse.edges.map((lo, i) => sum(dist.cycle.filter((_, k) => dist.edges[k]! >= lo
   && (coarse.edges[i + 1] === undefined || dist.edges[k]! < coarse.edges[i + 1]!))));
  assert.deepEqual(fine, coarse.counts, id + ': coarse = sums of fine bins');
  const input: Input = {view: viewOf(d, r.q), series: r.series, distributions: dist, recent: r.recent}, model = M.build(input);
  const brackets = chart(model, 'lead', 'histogram').brackets, first = dist.cycle.findIndex(c => c > 0);
  for (const [q, label] of [[50, 'p50'], [85, 'p85'], [95, 'p95']] as const) {
   const exact = lead[Math.ceil(q * lead.length / 100) - 1]!, i = brackets.find(([, labels]) => labels.includes(label))![0] + first;
   assert(dist.edges[i]! <= exact && (dist.edges[i + 1] === undefined || exact < dist.edges[i + 1]!), `${id}: ${label} ${exact} in bin ${i}`);
  }
  const control = panel(model, 'lead').control!;
  assert.equal(control.value, null);
  assert(control.options.every(o => dist.edges.includes(o.value)), id + ': targets are bin edges');
  const target = control.options[Math.floor(control.options.length / 2)]!.value, under = lead.filter(x => x < target).length;
  const chosen = panel(M.build({...input, target}), 'lead');
  assert.equal(chosen.control!.value, target);
  assert(chosen.notes.some(n => n.includes(`${U.percent(under, lead.length)} of `) && n.includes('(exact: the target is a bin edge)')), id);
  assert.deepEqual(chosen.table!.rows.at(-1), [`Less than the target of ${U.count(target)} min`, U.number(under), U.percent(under, lead.length)]);
  assert.equal(panel(M.build({...input, target: target + .5}), 'lead').control!.value, null, id + ': a target off the edges is no target');
 }
});

test('Dashboard on real runs: recent cases, first pass, repeats, failures by step and attributed cost match the engine', () => {
 const {input, model} = studio(demo('order-fulfilment'), [3000]), m = input.view.snapshot.metrics;
 const recent = chart(model, 'recent', 'points');
 assert.equal(recent.points.length, input.recent!.length);
 assert(input.recent!.length === 200 && input.view.snapshot.retention.finishedDropped > 0, 'the run prunes old finished cases');
 assert.equal(sum(m.repeats!.counts), m.completed);
 const repeats = panel(model, 'repeats');
 assert(repeats.notes.includes(`Finished without repeat visits: ${U.percent(m.firstPass!, m.completed)} (${U.number(m.firstPass!)} of `
  + `${U.number(m.completed)}).`));
 const joins = new Set(input.view.definition.steps.filter(x => x.kind === 'join').map(x => x.id));
 const visited = input.view.snapshot.steps.filter(x => !joins.has(x.id) && x.entered > x.reached);
 if (repeats.chart?.kind === 'rows') assert.deepEqual(repeats.chart.rows.map(r => r.value).sort(), visited.map(x => x.entered - x.reached).sort());
 assert.equal(model.tiles.find(t => t.id === 'cost')!.value, U.number(m.costOf!.completed / m.completed), 'exact cost per finished case');
 assert(m.costOf!.completed + m.costOf!.failed <= m.cost, 'attributed cost never exceeds the work cost');
 // An unsafe `add` fails its case at the work step: the failures table names it, and the failed case is a cross in the scatter.
 const bad = build(startEnd(stepOf('work', 'task', {name: 'Work', duration: 2, add: {n: 1}})), [flowOf('start', 'work'), flowOf('work', 'end')],
  [{at: 0, count: 3, interval: 5, data: {n: 'x'}}]);
 const failed = studio(bad, [30]), rows = failed.model.sections.flatMap(s => s.panels).find(p => p.id === 'failures')!.table!.rows;
 assert.deepEqual(rows.filter(r => /failures$|^Failed/.test(r[0]!)), [['Failed cases', '3'], ['Work: failures', '3']]);
 assert.deepEqual(chart(failed.model, 'recent', 'points').points.map(p => p.glyph), ['failed', 'failed', 'failed']);
});

test('Dashboard on a real journey: conversion over time from the sampled goals and lost, and the empty states before two samples', () => {
 const {input, model} = studio(demo('customer-journey-webshop'), [3000]), s = input.series!;
 const conversion = chart(model, 'conversion', 'lines'), values = conversion.series[0]!.values;
 s.minutes.forEach((_, i) => {
  const n = s.run.goals[i]! + s.run.lost[i]!;
  assert.equal(values[i], n >= 20 ? Math.round(s.run.goals[i]! * 1000 / n) / 10 : null, 'conversion at sample ' + i);
 });
 const e = s.minutes.length - 1, m = input.view.snapshot.metrics;
 assert.equal(values[e], Math.round(m.goals * 1000 / (m.goals + m.lost)) / 10, 'the last sample is the run conversion');
 assert.match(panel(model, 'conversion').caption, /^Conversion went from [\d.]+% at minute [\d,]+ to [\d.]+% at minute 3,000 \([\d,]+ decided\)\.$/);
 const zero = studio(demo('customer-journey-webshop'), []).model;
 for (const id of ['arrivals', 'wip', 'throughput']) assert.equal(panel(zero, id).empty, 'No simulated time yet.');
 assert.equal(panel(zero, 'conversion').empty, 'Needs at least two sampling intervals of the run history.');
 assert.deepEqual(zero.strip.windows, [], 'no window before two samples');
 const early = studio(demo('customer-journey-webshop'), [30]).model;
 assert.equal(panel(early, 'wip').empty, 'Needs at least two sampling intervals of the run history.');
 assert.equal(panel(early, 'arrivals').empty, null, 'one sample draws the cumulative lines');
});

test('Dashboard window: offered at grid minutes only, windowed tiles and panels are exact differences, and choosing one never ticks', () => {
 const app = application.create(demo('order-fulfilment'));
 try {
  app.horizon(null);
  app.advance(3030);
  const view = app.query(), s = app.series()!, before = JSON.stringify(app.query().snapshot), base: Input = {view, series: s, draft: false};
  const windows = M.build(base).strip.windows;
  assert(windows.length > 2 && windows.every(w => w % s.every === 0 && w < view.snapshot.minute && s.minutes.includes(w)), 'grid minutes before now');
  const W = windows[Math.floor(windows.length / 2)]!, i = s.minutes.indexOf(W), e = s.minutes.length - 1, span = s.minutes[e]! - W;
  const model = M.build({...base, window: W}), w = Win.of({...base, window: W})!;
  assert.deepEqual([w.from, w.to, w.wipArea, w.completed, w.arrived], [W, s.minutes[e], s.run.wipArea[e]! - s.run.wipArea[i]!,
   s.run.completed[e]! - s.run.completed[i]!, s.run.arrived[e]! - s.run.arrived[i]!]);
  const label = `from minute ${U.count(W)} to minute ${U.count(s.minutes[e]!)}`;
  assert.equal(model.strip.window, W);
  assert(model.strip.notes.some(n => n.id === 'window' && n.text.includes(label)));
  assert(model.tiles.find(t => t.id === 'active')!.line.endsWith(` · mean ${U.number(w.wipArea / span)} ${label}`));
  assert(model.tiles.find(t => t.id === 'finished')!.line.startsWith(`${U.number(w.completed * 60 / span)} per hour ${label}`));
  const pool = view.snapshot.resources.map(p => ({p, u: (s.pools[p.id]!.busyMinutes[e]! - s.pools[p.id]!.busyMinutes[i]!) / (span * p.capacity)}))
   .filter(x => view.definition.steps.some(st => st.resources?.[x.p.id])).reduce((a, b) => b.u > a.u ? b : a);
  assert.equal(model.tiles.find(t => t.id === 'pool')!.value, `${Math.round(pool.u * 100)}%`, 'busiest pool over the window');
  assert.deepEqual([little(model, '(A)'), little(model, '(S)')], [U.number(w.wipArea), U.number(s.run.wip[i]! + w.arrived)]);
  assert.equal(chart(model, 'wip', 'lines').mark, W);
  assert.match(panel(model, 'capacity').caption, new RegExp(` average utilisation ${label}\\.$`));
  // A minute off the grid or not before now is no window: the whole run, without a note.
  for (const off of [W + 1, view.snapshot.minute, -60]) {
   assert.deepEqual([M.build({...base, window: off}).strip.window, Win.of({...base, window: off})], [0, null], 'no window at ' + off);
  }
  assert.equal(JSON.stringify(app.query().snapshot), before, 'building windowed models never ticks or changes the run');
 } finally { app.dispose(); }
});

test('Dashboard series cache follows a run incrementally and reads everything again after a restart or a new seed', () => {
 const app = application.create(demo('user-journey-app-onboarding'));
 try {
  app.horizon(null);
  let cache: LWProcessDashboardWindow.Cache = {run: '', series: null};
  const read = (after?: {level: number; count: number}) => app.series(after);
  const follow = () => { cache = Win.follow(cache, Win.run(app.query()), read); };
  const held = () => JSON.stringify({...cache.series, count: undefined, offset: undefined});
  const plain = () => JSON.stringify({...app.series(), count: undefined, offset: undefined});
  for (const n of chunking(3000, 7, 97)) { app.advance(n); follow(); }
  assert.equal(held(), plain(), 'chunked incremental reads equal one full read');
  const same = cache.series;
  follow();
  assert.equal(cache.series, same, 'a read without new samples keeps the cached object (no copy per pulse)');
  app.reset();
  app.advance(120);
  follow();
  assert.equal(held(), plain(), 'a restart to an earlier minute reads the history again');
  app.seed(9);
  app.advance(400);
  follow();
  assert.equal(held(), plain(), 'a new seed is another run');
 } finally { app.dispose(); }
});

test('What-if takes the dashboard window as each replication\'s warm-up and labels the windowed measures', () => {
 const W = root.LWProcessDashboardWhatIf, d = demo('order-fulfilment'), view = studio(d, [600]).input.view;
 const ok = {changed: false, valid: false};
 const inputs = {...W.defaults(view), runs: 3, minutes: 600, warmup: 120};
 const checked = W.check(inputs, view, ok);
 assert.equal(checked.ok, true);
 assert.match(checked.plan, / Measures labelled "after minute 120" leave out each run's first 120 minutes \(warm-up\)\.$/);
 assert.deepEqual(W.check({...inputs, minutes: 120}, view, ok).problems,
  ['Minutes per run must be more than the measuring start, minute 120, which is each run\'s warm-up.']);
 const report = replicate.replicate(d, {minutes: 600, runs: 3, warmup: 120}), r = W.result(report, 3);
 assert.match(r.honesty, /of runs that start empty; measures labelled "after minute 120" leave out the first 120 minutes \(warm-up\), the others /);
 assert(r.kpis.some(k => k.id === 'window.meanWip' && k.label === 'Mean work in progress after minute 120'), 'windowed measures are reported');
 const plain = W.result(replicate.replicate(d, {minutes: 600, runs: 3}), 3);
 assert.match(plain.honesty, /of runs that start empty, so start-up is included\./);
 assert(!plain.kpis.some(k => k.id.startsWith('window.')));
});
