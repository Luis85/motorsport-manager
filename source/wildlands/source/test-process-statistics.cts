/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-replicate.ts" />
/// <reference path="./process-ledger-exact.ts" />
/// <reference path="./process-dashboard-model.ts" />
/**
 * Exact statistics (business-process-analysis suite; loaded by test-process-analysis.cts): the exact Student t quantile of
 * LWProcessReplicate against independent reference values, the intervals that use it, and the exact lead-time percentiles of the
 * read model (LWProcessLedgerExact): a small run against a hand-computed list, the bracket fallback past the bound, invariance under
 * chunking and pruning, and the Dashboard wording that says which kind a percentile is.
 */
import assert from 'node:assert/strict';
import {replicate} from './process-sdk.cjs';
import {test, base} from './test-process-helpers.cjs';
import {reads, chunking} from './test-process-readmodel-helpers.cjs';
import {demo} from './test-process-dashboard.cjs';
for (const name of ['process-chart', 'process-dashboard-model', 'process-dashboard-window', 'process-dashboard-tiles', 'process-dashboard-flow',
 'process-dashboard-time', 'process-dashboard-quality', 'process-dashboard-panels', 'process-dashboard-journey', 'process-dashboard-focus',
 'process-dashboard-whatif']) {
 require(`./${name}.js`);
}
const root = globalThis as unknown as {LWProcessLedgerExact: LWProcessLedgerExact.Api; LWProcessLedger: LWProcessLedger.Api;
 LWProcessDashboardModel: LWProcessDashboardModel.Api; LWProcessDashboardWhatIf: LWProcessDashboardWhatIf.Api};
const Exact = root.LWProcessLedgerExact, M = root.LWProcessDashboardModel;
/**
 * Two-sided 95% Student t quantiles to 6 decimals, cross-checked against an independent inversion of the regularised incomplete beta
 * function (Lentz continued fraction, 200 bisections). 2.024394 and 2.009575, sometimes quoted for 40 and 50 degrees of freedom,
 * are the quantiles of 38 and 49; those of 40 and 50 are 2.021075 and 2.008559.
 */
const REFERENCE: [number, number][] = [[1, 12.706205], [2, 4.302653], [3, 3.182446], [5, 2.570582], [7, 2.364624], [10, 2.228139],
 [20, 2.085963], [30, 2.042272], [31, 2.039513], [38, 2.024394], [40, 2.021075], [49, 2.009575], [50, 2.008559], [100, 1.983972],
 [120, 1.97993], [1000, 1.962339]];
/** The classic 3-decimal table that intervals with 1 to 30 degrees of freedom used and still use. */
const TABLE = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086,
 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];
const NORMAL = 1.959963984540054;
const view = (d: LWProcess.Definition, q: LWProcess.Snapshot) => ({definition: d, snapshot: q, selected: null, mode: 'dashboard', playing: false,
 horizon: null, lens: 'sipoc', processes: [{id: d.id, name: d.name}], active: 0}) as unknown as LWProcessApp.View;
const panel = (m: LWProcessDashboardModel.Model, id: string) => m.sections.flatMap(s => s.panels).find(p => p.id === id)!;
/** Nearest rank of q over an ascending list, the definition `process replicate` uses. */
const nearest = (sorted: number[], q: number) => sorted[Math.max(0, Math.ceil(q * sorted.length / 100) - 1)]!;

test('Student t quantiles are exact to 1e-6 for any whole df, also where the expansion takes over, and fall towards 1.959964', () => {
 for (const [df, t] of REFERENCE) assert(Math.abs(replicate.t95(df) - t) <= 1e-6, `df ${df}: ${replicate.t95(df)} against ${t}`);
 assert.deepEqual([...replicate.T95], TABLE, 'the exact quantiles rounded to 3 decimals are the classic table');
 for (let df = 1; df <= 30; df++) assert.equal(replicate.interval95(df), TABLE[df - 1], 'intervals keep the table up to 30 df: ' + df);
 for (const df of [31, 40, 120, 1000, 5000]) assert.equal(replicate.interval95(df), replicate.t95(df), 'the exact quantile from 31: ' + df);
 // Both sides of the switch from the series (up to 1,000) to the expansion (from 1,001), to 1e-9 of the incomplete beta reference.
 for (const [df, t] of [[999, 1.962341461], [1000, 1.962339081], [1001, 1.962336705], [2000, 1.961150826], [5000, 1.960438552]]) {
  assert(Math.abs(replicate.t95(df!) - t!) < 1e-9, `df ${df}: ${replicate.t95(df!)} against ${t}`);
 }
 let previous = Infinity;
 for (let df = 1; df <= 2000; df++) {
  const t = replicate.t95(df);
  assert(t < previous && t > NORMAL, 'strictly falling towards the normal quantile at ' + df);
  previous = t;
 }
 assert(Math.abs(replicate.t95(1000000) - NORMAL) < 3e-6 && replicate.t95(Infinity) === NORMAL);
 for (const bad of [0, -1, 1.5, NaN]) assert.throws(() => replicate.t95(bad), /whole number of at least 1/);
});

test('Replication intervals use the exact t quantile from 31 degrees of freedom and keep every pinned value up to 30', () => {
 const ones = (n: number) => Array.from({length: n}, (_, i) => i + 1);
 // 1..32: mean 16.5, sample sd √(32 × 33 / 12) = √88, 31 degrees of freedom; the old 1.96 gave a half-width of 3.250291.
 const half = 2.039513 * Math.sqrt(88) / Math.sqrt(32), s = replicate.summarize(ones(32));
 assert.deepEqual([s.n, s.mean, s.sd], [32, 16.5, 9.380832]);
 assert(Math.abs(s.ci95![0] - (16.5 - half)) < 2e-6 && Math.abs(s.ci95![1] - (16.5 + half)) < 2e-6, JSON.stringify(s.ci95));
 assert.deepEqual(s.ci95, [13.11785, 19.88215]);
 assert.deepEqual(replicate.summarize([2, 4, 4, 4, 5, 5, 7, 9]).ci95, [3.212228, 6.787772], 'df 7 keeps 2.365');
 assert.deepEqual(replicate.summarize([3, 1]).ci95, [-10.706, 14.706], 'df 1 keeps 12.706');
 const W = root.LWProcessDashboardWhatIf, report = replicate.replicate(base(), {minutes: 30, runs: 3});
 assert.match(W.result(report, 3).honesty, / Intervals use Student t quantiles for runs − 1 degrees of freedom \(to 3 decimals up to 30, exact beyond\)\. /);
});

/** Twelve cases arriving at minute 0 on a one-unit pool with a 5-minute step: lead times 5, 10, …, 60. */
function queue(): LWProcess.Definition {
 const d = base();
 d.resources = [{id: 'worker', name: 'Worker', capacity: 1, costPerMinute: 2}];
 d.steps[1]!.resources = {worker: 1};
 d.arrivals[0]!.count = 12;
 return d;
}

test('Exact lead-time percentiles of a small run equal the nearest ranks of the hand-computed list, and the Dashboard says exact', () => {
 const d = queue(), r = reads(d, [100]), p = r.distributions.percentiles!;
 const list = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
 assert.deepEqual(r.recent.map(c => c.finished - c.entered), list);
 assert.deepEqual([p.limit, p.quantiles, p.byOutcome], [50000, [10, 25, 50, 75, 85, 90, 95, 99], undefined]);
 assert.deepEqual(p.cycle, {n: 12, exact: true, points: [[10, 10], [25, 15], [50, 30], [75, 45], [85, 55], [90, 55], [95, 60], [99, 60]]
  .map(([q, value]) => ({q, exact: true, value}))});
 for (const point of p.cycle.points) assert.equal(point.exact && point.value, nearest(list, point.q), 'the replicate rule at ' + point.q);
 const m = M.build({view: view(d, r.q), distributions: r.distributions, recent: r.recent}), lead = panel(m, 'lead');
 assert.equal(lead.caption, 'The median of 12 finished cases is 30 min, the 85th percentile 55 min and the 95th 60 min; the longest bin is 60–75 min.');
 assert(lead.notes.includes('Percentiles are exact: nearest rank over all 12 finished cases; the bars group them in bins.'), lead.notes.join(' | '));
 assert.deepEqual(lead.table!.rows.slice(-3), [['50th percentile', '30 min', ''], ['85th percentile', '55 min', ''], ['95th percentile', '60 min', '']]);
 const chart = lead.chart as Extract<LWProcessDashboardModel.Chart, {kind: 'histogram'}>, labels = chart.bins.map(b => b.label);
 assert.deepEqual(chart.brackets.map(([i, l]) => [labels[i], l]), [['30', ['p50']], ['50', ['p85']], ['60', ['p95']]], 'each mark on its value\'s bin');
 const tile = m.tiles.find(t => t.id === 'lead')!;
 assert.deepEqual([tile.value, tile.line.split(' · ')[0]], ['median 30 min', '85th percentile 55 min']);
});

test('Exact lead-time percentiles fall back to bin brackets past the bound, per outcome too, and the Dashboard says why', () => {
 const store = Exact.create(true, 5), cycles = [30, 7, 61, 7, 200, 13], fine = {cycle: Array(54).fill(0) as number[], outcomes: null};
 assert.throws(() => Exact.create(false, 50001), /from 1 to 50000/);
 cycles.slice(0, 5).forEach((c, i) => Exact.add(store, c, i % 2 ? 'goal' : null));
 const counts = (n: number) => {
  const f = {cycle: Array(54).fill(0) as number[], outcomes: {goal: Array(54).fill(0) as number[], lost: Array(54).fill(0) as number[],
   none: Array(54).fill(0) as number[]}};
  cycles.slice(0, n).forEach((c, i) => {
   f.cycle[root.LWProcessLedger.fineBin(c)]!++;
   f.outcomes[i % 2 ? 'goal' : 'none'][root.LWProcessLedger.fineBin(c)]!++;
  });
  return f;
 };
 const within = Exact.read(store, counts(5), root.LWProcessLedger.FINE);
 assert.deepEqual([within.cycle.exact, Exact.values(store), within.byOutcome!.goal.points.map(p => p.exact && p.value)], [true, [7, 7, 30, 61, 200], [7, 7,
  7, 7, 7, 7, 7, 7]]);
 Exact.add(store, cycles[5]!, null);
 const past = Exact.read(store, counts(6), root.LWProcessLedger.FINE), sorted = [...cycles].sort((a, b) => a - b);
 assert.deepEqual([past.cycle.n, past.cycle.exact, Exact.values(store), past.byOutcome!.none.exact, past.byOutcome!.lost], [6, false, null, false,
  {n: 0, exact: false, points: []}]);
 for (const point of past.cycle.points) {
  assert(!point.exact, 'a bracket at ' + point.q);
  const value = nearest(sorted, point.q), [lo, hi] = point.bracket;
  assert(lo <= value && (hi === null || value < hi), `the exact ${value} lies in [${lo}, ${hi}) at ${point.q}`);
 }
 assert.deepEqual(past.cycle.points.find(p => p.q === 50), {q: 50, exact: false, bracket: [12, 15]});
 assert.deepEqual(Exact.read(Exact.create(false), fine, root.LWProcessLedger.FINE).cycle, {n: 0, exact: true, points: []});
 // The Dashboard over the same twelve cases with an over-the-bound store: bracket wording, the bound named.
 const d = queue(), r = reads(d, [100]), over = Exact.create(false, 5);
 for (const c of r.recent) Exact.add(over, c.finished - c.entered, null);
 const percentiles = Exact.read(over, {cycle: r.distributions.cycle, outcomes: null}, r.distributions.edges);
 const m = M.build({view: view(d, r.q), distributions: {...r.distributions, percentiles}}), lead = panel(m, 'lead');
 assert.equal(lead.caption, 'The median of 12 finished cases lies in 30–40 min, the 85th percentile in 50–60 min and the 95th in 60–75 min; '
  + 'the longest bin is 60–75 min.');
 assert(lead.notes.includes('Percentiles are bin brackets (nearest rank over the bin counts): exact values are kept for at most 5 finished cases.'));
 assert.equal(m.tiles.find(t => t.id === 'lead')!.value, 'median 30–40 min');
 const focus = M.build({view: {...view(d, r.q), selected: 'work'}, distributions: r.distributions}), service = panel(focus, 'focus-service');
 assert(service.notes.includes('Percentiles are bin brackets (nearest rank over the bin counts): exact values are not kept for this distribution.'));
});

test('Kept lead times give the same percentiles under random chunkings, one-minute advances and pruning, whole-run and per outcome', () => {
 const d = demo('customer-journey-webshop'), options = {retained: 10000, series: false as const}, whole = reads(d, [900], options);
 const p = whole.distributions.percentiles!, m = whole.q.metrics;
 assert(p.cycle.exact && p.cycle.n === m.completed && m.completed >= 100, 'every completed case is kept: ' + m.completed);
 const outcomes = p.byOutcome!;
 assert.deepEqual([outcomes.goal.n, outcomes.lost.n, outcomes.goal.n + outcomes.lost.n + outcomes.none.n], [m.goals, m.lost, m.completed]);
 const lead = (keep: (c: LWProcess.FinishedCase) => boolean) => whole.recent.filter(c => c.status === 'completed' && keep(c))
  .map(c => c.finished - c.entered).sort((a, b) => a - b);
 for (const point of p.cycle.points) assert.equal(point.exact && point.value, nearest(lead(() => true), point.q), 'whole run at ' + point.q);
 for (const point of outcomes.goal.points) assert.equal(point.exact && point.value, nearest(lead(c => c.outcome === 'goal'), point.q), 'goals at ' + point.q);
 for (const seed of [1, 2, 3]) {
  assert.deepEqual(reads(d, chunking(900, seed * 104729, 97), options).distributions.percentiles, p, 'chunking ' + seed);
 }
 assert.deepEqual(reads(d, Array.from({length: 900}, () => 1), {retained: 1, series: false}).distributions.percentiles, p, 'one-minute advances, pruned');
 // The store keeps its values sorted by merging what arrived since the last read: reads between any batches give the same values.
 const minutes = chunking(3000, 17, 997), sorted = [...minutes].sort((a, b) => a - b);
 for (const batch of [1, 7, 64, 65, 250, 3000]) {
  const store = Exact.create(false);
  minutes.forEach((value, i) => {
   Exact.add(store, value, null);
   if ((i + 1) % batch === 0) Exact.values(store);
  });
  assert.deepEqual(Exact.values(store), sorted, 'reads every ' + batch + ' additions');
 }
});
