/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-replicate.ts" />
/**
 * Read-model analytics, the streaming event sink, replications and paired comparisons (business-process suite; loaded by
 * test-process.cts). The CLI side of the same features is checked in test-process-analytics-cli.cts.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {runtime, replicate} from './process-sdk.cjs';
import {test, base, copy, run, build, stepOf, flowOf, startEnd} from './test-process-helpers.cjs';
const CONTENT = path.resolve(__dirname, '../../../docs/concepts/agency-delivery/content');
const demos = () => fs.readdirSync(CONTENT).filter(f => f.endsWith('.process.json')).sort()
 .map(f => JSON.parse(fs.readFileSync(path.join(CONTENT, f), 'utf8')) as LWProcess.Definition);
const sum = (values: number[]) => values.reduce((n, v) => n + v, 0);
const EDGES = [0, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
/** Advances a fresh session in the given chunks and returns the last snapshot (and every event the sink saw). */
function chunked(d: LWProcess.Definition, chunks: number[], options: LWProcess.RunOptions = {}): {q: LWProcess.Snapshot; events: LWProcess.Event[]} {
 const events: LWProcess.Event[] = [], s = runtime.create(d, {...options, onEvent: e => events.push(e)});
 try {
  let q = s.query();
  for (const n of chunks) q = s.advance(n);
  return {q, events};
 } finally { s.dispose(); }
}
const analytic = (q: LWProcess.Snapshot) => ({steps: q.steps, resources: q.resources, metrics: q.metrics});
/** A small open queue: exponential gaps (mean 10) and exponential work (mean 8) on a crew of `capacity`. */
const queue = (capacity: number) => build(
 startEnd(stepOf('work', 'task', {duration: 8, timing: {dist: 'exponential', mean: 8, max: 60}, resources: {crew: 1}})),
 [flowOf('start', 'work'), flowOf('work', 'end')], [{at: 0, until: 2000, interval: 10, gap: {dist: 'exponential', mean: 10, max: 60}, data: {}}],
 [{id: 'crew', name: 'Crew', capacity, costPerMinute: 1}]);

test('Run ledger reports mean wait, throughput, per-pool and per-step cost and the cycle histogram exactly for a FIFO queue', () => {
 const d = base(); d.resources = [{id: 'worker', name: 'Worker', capacity: 1, costPerMinute: 2}];
 d.steps[1]!.resources = {worker: 1}; d.steps[1]!.cost = 7; d.arrivals[0]!.count = 2;
 const s = runtime.create(d), first = s.query(), work = (q: LWProcess.Snapshot) => q.steps.find(x => x.id === 'work')!;
 assert.equal(first.metrics.throughputPerHour, null, 'no throughput at minute 0');
 assert.deepEqual([work(first).starts, work(first).meanWaitMinutes, work(first).fixedCost, work(first).workCost], [1, 0, 7, 7]);
 assert.equal(first.steps.find(x => x.id === 'start')!.meanWaitMinutes, null, 'a step without work starts has no mean wait');
 const q = s.advance(20); s.dispose();
 assert.equal(q.minute, 10); assert.equal(q.metrics.cost, 34);
 // Case 1 waits 0 and case 2 waits 5 minutes; each start charges 7, and 10 busy minutes at 2 per minute add 20.
 assert.deepEqual([work(q).starts, work(q).waitMinutes, work(q).meanWaitMinutes, work(q).fixedCost, work(q).workCost], [2, 5, 2.5, 14, 34]);
 assert.deepEqual([q.resources[0]!.workCost, q.resources[0]!.capacityCost], [20, 20]);
 assert.equal(q.metrics.throughputPerHour, 12);
 const counts = EDGES.map(() => 0); counts[3] = 1; counts[4] = 1;
 assert.deepEqual(q.metrics.cycleHistogram, {edges: EDGES, counts}, 'cycles of 5 and 10 minutes fall in the 5-10 and 10-20 bins');
});

test('Every demo keeps the cost breakdown, mean wait and cycle histogram exact under chunked advances and pruning', () => {
 for (const d of demos()) {
  const whole = chunked(d, [3000]).q, pieces = chunked(d, [7, 293, 1, 699, 2000]).q, pruned = chunked(d, [3000], {retained: 1}).q;
  assert.deepEqual(analytic(pieces), analytic(whole), d.id + ': chunked advances');
  assert.deepEqual(analytic(pruned), analytic(whole), d.id + ': pruning keeps every analytic value');
  const q = whole, m = q.metrics, fixed = sum(q.steps.map(x => x.fixedCost));
  assert.equal(sum(q.steps.map(x => x.workCost)), m.cost, d.id + ': steps sum to the work cost');
  assert.equal(sum(q.resources.map(r => r.workCost)) + fixed, m.cost, d.id + ': pools plus fixed costs sum to the work cost');
  assert.equal(sum(q.resources.map(r => r.capacityCost)), m.capacityCost, d.id + ': pools sum to the capacity cost');
  assert.equal(sum(m.cycleHistogram.counts), m.completed, d.id + ': the histogram counts every completed case');
  assert.equal(m.throughputPerHour, q.minute ? m.completed * 60 / q.minute : null);
  for (const x of q.steps) {
   assert.equal(x.meanWaitMinutes, x.starts ? Math.round(x.waitMinutes / x.starts * 1000) / 1000 : null, d.id + '/' + x.id);
   if (x.items) assert.equal(x.starts, x.items.started, d.id + '/' + x.id + ': every item start counts');
  }
  for (const r of q.resources) assert.equal(r.workCost, r.busyMinutes * d.resources.find(p => p.id === r.id)!.costPerMinute);
  const kept = chunked(d, [3000], {retained: 10000}).q, recount = EDGES.map(() => 0);
  for (const c of kept.cases) if (c.status === 'completed') recount[EDGES.filter(e => e <= c.finished! - c.entered).length - 1]!++;
  assert.deepEqual(m.cycleHistogram.counts, recount, d.id + ': a recount from every retained case');
 }
});

test('The event sink streams every engine event in order as detached values, identical across chunks, with the history as its tail', () => {
 const d = queue(1), whole = chunked(d, [1500]), steps = chunked(d, Array.from({length: 150}, () => 10));
 assert(whole.events.length > 10 * runtime.limits.events, 'the sink sees far more than the retained history');
 assert.deepEqual(steps.events, whole.events, 'chunked advances stream the same events');
 assert.deepEqual(whole.q.events, whole.events.slice(-runtime.limits.events), 'the retained history is the tail of the stream');
 assert.deepEqual(whole.q, run(d, 1500), 'a sink changes nothing in the snapshot');
 const seen: LWProcess.Event[] = [], s = runtime.create(d, {onEvent: e => seen.push(e)});
 assert(seen.length > 0 && seen.every(e => e.minute === 0), 'events of minute 0 settled by create are streamed too');
 const q = s.advance(30); seen.at(-1)!.detail = 'changed by the consumer';
 assert.deepEqual(s.query().events, q.events, 'received events are copies'); s.dispose();
 const holder: {session?: LWProcess.Session} = {};
 holder.session = runtime.create(d, {onEvent: () => { holder.session?.query(); }});
 assert.throws(() => holder.session!.advance(5), /The event sink cannot use the process session while a clock command runs\./);
 assert.throws(() => holder.session!.query(), /Process session stopped because its event sink failed; dispose it and start a new run\./);
 holder.session.dispose();
 assert.throws(() => runtime.create(d, {onEvent: 5 as never}), /The event sink must be a function\./);
 assert.throws(() => runtime.create(d, {onEvent: () => { throw Error('disk full'); }}), /disk full/);
});

test('Replication statistics use the sample sd, Student t intervals and nearest-rank percentiles as computed by hand', () => {
 assert.deepEqual(replicate.summarize([2, 4, 4, 4, 5, 5, 7, 9]), {n: 8, mean: 5, sd: 2.13809, ci95: [3.212512, 6.787488], p10: 2, p50: 4, p90: 9});
 assert.deepEqual(replicate.summarize([3, null, 1]), {n: 2, mean: 2, sd: 1.414214, ci95: [-10.706205, 14.706205], p10: 1, p50: 1, p90: 3});
 assert.deepEqual(replicate.summarize([null, 4]), {n: 1, mean: 4, sd: null, ci95: null, p10: 4, p50: 4, p90: 4});
 assert.deepEqual(replicate.summarize([null]), {n: 0, mean: null, sd: null, ci95: null, p10: null, p50: null, p90: null});
 assert.deepEqual(replicate.summarize([7, 7, 7]), {n: 3, mean: 7, sd: 0, ci95: [7, 7], p10: 7, p50: 7, p90: 7});
 // The exact quantile for every df (formerly a 3-decimal table to 30 degrees of freedom and the normal 1.96 beyond).
 for (const [df, t] of [[1, 12.706205], [7, 2.364624], [30, 2.042272], [31, 2.039513]]) assert(Math.abs(replicate.t95(df!) - t!) < 1e-6, 'df ' + df);
 const tens = Array.from({length: 30}, (_, i) => i + 1), stats = replicate.summarize(tens);
 assert.deepEqual([stats.p10, stats.p50, stats.p90], [3, 15, 27], 'q × n / 100 is exact for whole ranks');
});

test('Replications run consecutive seeds in fresh sessions, step one at a time and refuse bad plans before any run', () => {
 const d = queue(1), report = replicate.replicate(d, {minutes: 240, runs: 4, seed: 11});
 assert.deepEqual(report.seeds, [11, 12, 13, 14]); assert.equal(report.complete, true); assert.equal(report.definition.id, 'timed');
 assert.deepEqual(report.kpis.map(k => k.id), ['completed', 'failed', 'dropped', 'workCost', 'capacityCost', 'meanCycleMinutes', 'meanAgeMinutes',
  'throughputPerHour', 'utilization.crew']);
 report.rows.forEach((row, i) => {
  const s = runtime.create(d, {seed: 11 + i}), q = s.advance(240); s.dispose();
  assert.deepEqual(row, {seed: 11 + i, minute: q.minute, status: q.status, values: replicate.measure(d, q)});
 });
 const completed = report.kpis.find(k => k.id === 'completed')!;
 assert.deepEqual(completed, {id: 'completed', label: 'Completed cases', ...replicate.summarize(report.rows.map(r => r.values.completed!))});
 assert.deepEqual(replicate.replicate(d, {minutes: 240, runs: 4, seed: 11}), report, 'deterministic');
 const runner = replicate.replications(d, {minutes: 240, runs: 4, seed: 11});
 assert.equal(runner.step(), true); assert.deepEqual([runner.done(), runner.total, runner.report().complete], [1, 4, false]);
 while (runner.step()) { /* the rest */ }
 assert.deepEqual(runner.report(), report); assert.equal(runner.step(), false);
 const early = replicate.replicate(base(), {minutes: 1, runs: 3});
 assert.deepEqual(early.seeds, [1, 2, 3], 'the definition has no seed, so seeds start at 1');
 assert.deepEqual(early.kpis.find(k => k.id === 'meanCycleMinutes')!.n, 0, 'a run without a finished case has no mean cycle');
 const created = runtime.create;
 let sessions = 0;
 runtime.create = (input, options) => { sessions++; return created(input, options); };
 try {
  const bad: [LWProcessReplicate.Options, RegExp][] = [[{minutes: 0, runs: 2}, /Minutes must be a whole number from 1 to 100000\./],
   [{minutes: 10, runs: 201}, /Replications must be a whole number from 1 to 200\./], [{minutes: 10, runs: 1.5}, /Replications/],
   [{minutes: 100000, runs: 11}, /at most 1000000 minutes in total; this one needs 1100000\./],
   [{minutes: 10, runs: 2, seed: 2147483647}, /Seeds 2147483647 to 2147483648 pass the largest seed/],
   [{minutes: 10, runs: 2, horizon: 5}, /Horizon must be unlimited or a whole number of at least the run minutes\./]];
  for (const [options, message] of bad) assert.throws(() => replicate.replicate(d, options), message);
  assert.throws(() => replicate.compare(d, d, {minutes: 100000, runs: 6}), /this one needs 1200000/, 'a comparison counts both definitions');
  assert.equal(sessions, 0, 'no session was created for a refused plan');
 } finally { runtime.create = created; }
});

test('Paired comparisons share seeds: identical definitions differ by exactly zero and more capacity shortens a small queue', () => {
 const same = replicate.compare(queue(1), copy(queue(1)), {minutes: 600, runs: 5});
 for (const k of same.kpis) {
  assert.deepEqual(k.a, k.b, k.id);
  if (k.difference.n > 1) assert.deepEqual([k.difference.mean, k.difference.sd, k.difference.ci95], [0, 0, [0, 0]], k.id);
 }
 const more = replicate.compare(queue(2), queue(1), {minutes: 1500, runs: 6, seed: 3}), kpi = (id: string) => more.kpis.find(k => k.id === id)!;
 assert.deepEqual(more.seeds, [3, 4, 5, 6, 7, 8]); assert.equal(more.rows.length, 6);
 assert(more.rows.every(r => r.difference.meanCycleMinutes! < 0), 'two crew members finish every seed\'s cases sooner on average');
 assert(kpi('meanCycleMinutes').difference.ci95![1] < 0, 'the 95% interval of the paired cycle difference lies below zero');
 assert.equal(kpi('capacityCost').difference.mean, 1500, 'one more unit at 1 per minute for 1,500 minutes');
 assert.deepEqual(kpi('completed').difference, replicate.summarize(more.rows.map(r => r.difference.completed!)));
 assert.deepEqual(replicate.compare(queue(2), queue(1), {minutes: 1500, runs: 6, seed: 3}), more, 'deterministic');
 assert.deepEqual([more.a.fingerprint === more.b.fingerprint, more.format, more.complete], [false, 'wildlands-process-comparison', true]);
});
