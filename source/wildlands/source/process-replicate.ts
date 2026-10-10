/// <reference path="./process-contracts.d.ts" />
/**
 * Replications and paired comparisons (LWProcessReplicate), owned by the process-application context because it creates runtimes.
 * Pure and browser-safe: it runs fresh `LWProcessRuntime.create(definition, {seed, horizon})` sessions over a list of seeds for a
 * fixed number of business minutes, disposes each one, and never touches a live studio session, storage, the DOM or the wall
 * clock. Same definition(s), options and seeds give the same report.
 *
 * Seeds are `seed, seed + 1, ...` (`seed` defaults to the definition's seed, else 1; a comparison uses the first definition's).
 * Bounds, checked before any run: 1 to 200 replications, 1 to 100,000 minutes, and at most 1,000,000 simulated minutes in total
 * (replications × minutes, counted twice for a comparison, which runs both definitions per seed).
 *
 * KPIs per run (as the snapshot reports them at the end of the run): completed, failed and dropped cases, work cost, capacity cost,
 * mean cycle (`null` when no case completed), mean age in progress (`null` when none is in progress), throughput per hour (`null`
 * at minute 0), utilisation per pool (`utilization.<pool id>`, a 0..1 share), and, when an end step declares an outcome, goals,
 * lost and conversion (permille, `null` when neither happened). A run whose KPI is `null` is left out of that KPI's statistics,
 * so `n` says how many runs had a value.
 *
 * Statistics per KPI over the runs with a value: `n`; `mean`; `sd`, the sample standard deviation (n - 1; `null` below 2 values);
 * `ci95`, the two-sided 95% confidence interval of the mean, mean ± t × sd / √n with the Student t quantile for n - 1 degrees of
 * freedom from a table for 1 to 30 and the normal value 1.96 beyond (slightly narrow from 31 to about 120 degrees of freedom: at 40
 * the exact quantile is 2.021), `null` below 2 values; and `p10`, `p50`, `p90` by the nearest-rank rule (the smallest observed
 * value with at least q% of the values at or below it). Every statistic is rounded to 6 decimals.
 *
 * A comparison runs both definitions with the same seeds. Draws are keyed by seed and stable identities (case, step, visit), so
 * the runs share common random numbers wherever the definitions agree. Per KPI it reports A's and B's statistics and the paired
 * difference A − B over the seeds where both have a value, with its own sd and t-based 95% interval.
 *
 * Incremental use: `replications` and `comparison` return a runner whose `step()` performs one replication (one seed; both
 * definitions for a comparison), so a page can spread the work over frames; `report()` summarises the rows so far and says
 * whether the plan is `complete`.
 */
declare namespace LWProcessReplicate {
 interface Options { minutes: number; runs: number; seed?: number; horizon?: number | null; }
 interface Plan { minutes: number; horizon: number | null; seeds: number[]; }
 interface Kpi { id: string; label: string; }
 interface Stats {
  n: number; mean: number | null; sd: number | null; ci95: [number, number] | null; p10: number | null; p50: number | null; p90: number | null;
 }
 interface Summary extends Stats { id: string; label: string; }
 interface Outcome { minute: number; status: LWProcess.Snapshot['status']; values: Record<string, number | null>; }
 interface Row extends Outcome { seed: number; }
 interface Identity { id: string; name: string; revision: number; fingerprint: string; }
 interface Report {
  format: 'wildlands-process-replications'; schemaVersion: 1; definition: Identity; minutes: number; horizon: number | null;
  runs: number; complete: boolean; seeds: number[]; kpis: Summary[]; rows: Row[];
 }
 interface Difference { id: string; label: string; a: Stats; b: Stats; difference: Stats; }
 interface PairRow { seed: number; a: Outcome; b: Outcome; difference: Record<string, number | null>; }
 interface Comparison {
  format: 'wildlands-process-comparison'; schemaVersion: 1; a: Identity; b: Identity; minutes: number; horizon: number | null;
  runs: number; complete: boolean; seeds: number[]; kpis: Difference[]; rows: PairRow[];
 }
 interface Runner<R> {
  /** Replications planned. */
  readonly total: number;
  /** Replications done so far. */
  done(): number;
  /** Runs the next replication; false (doing nothing) once all are done. */
  step(): boolean;
  /** A detached report of the rows so far. */
  report(): R;
 }
 interface Api {
  readonly LIMITS: {readonly runs: number; readonly work: number};
  /** Two-sided 95% Student t quantiles for 1..30 degrees of freedom (index 0 is df 1). */
  readonly T95: readonly number[];
  t95(df: number): number;
  summarize(values: readonly (number | null)[]): Stats;
  /** Validates options and expands the seeds; `work` is the simulated minutes per replication factor (2 for a comparison). */
  plan(options: Options, definitionSeed?: number, work?: number): Plan;
  kpis(definition: LWProcess.Definition): Kpi[];
  measure(definition: LWProcess.Definition, snapshot: LWProcess.Snapshot): Record<string, number | null>;
  replications(input: unknown, options: Options): Runner<Report>;
  replicate(input: unknown, options: Options): Report;
  comparison(a: unknown, b: unknown, options: Options): Runner<Comparison>;
  compare(a: unknown, b: unknown, options: Options): Comparison;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessRuntime: LWProcess.Runtime; LWProcessCatalog: LWProcess.Catalog; LWProcessReplicate?: LWProcessReplicate.Api};
 type Stats = LWProcessReplicate.Stats; type Options = LWProcessReplicate.Options; type Kpi = LWProcessReplicate.Kpi;
 const LIMITS = Object.freeze({runs: 200, work: 1000000}), MAX_SEED = 2147483647;
 const T95: readonly number[] = Object.freeze([12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131,
  2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042]);
 const NORMAL95 = 1.96;
 const t95 = (df: number) => df >= 1 && df <= T95.length ? T95[df - 1]! : NORMAL95;
 /** Six decimals; `|| 0` turns a rounded -0 into 0. */
 const round = (value: number) => Math.round(value * 1e6) / 1e6 || 0;
 const whole = (value: unknown, min: number, max: number) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
 function summarize(values: readonly (number | null)[]): Stats {
  const xs = values.filter((v): v is number => v !== null), n = xs.length;
  if (!n) return {n, mean: null, sd: null, ci95: null, p10: null, p50: null, p90: null};
  const mean = xs.reduce((sum, x) => sum + x, 0) / n, sorted = [...xs].sort((a, b) => a - b);
  // Nearest rank with integer arithmetic: q * n / 100 is exact whenever it is a whole number.
  const rank = (q: number) => sorted[Math.max(0, Math.ceil(q * n / 100) - 1)]!;
  const sd = n > 1 ? Math.sqrt(xs.reduce((sum, x) => sum + (x - mean) * (x - mean), 0) / (n - 1)) : null;
  const half = sd === null ? null : t95(n - 1) * sd / Math.sqrt(n);
  return {n, mean: round(mean), sd: sd === null ? null : round(sd), ci95: half === null ? null : [round(mean - half), round(mean + half)],
   p10: round(rank(10)), p50: round(rank(50)), p90: round(rank(90))};
 }
 function plan(options: Options, definitionSeed?: number, work = 1): LWProcessReplicate.Plan {
  const limit = root.LWProcessRuntime.limits.minutes, {minutes, runs} = options;
  if (!whole(minutes, 1, limit)) throw Error('Minutes must be a whole number from 1 to ' + limit + '.');
  if (!whole(runs, 1, LIMITS.runs)) throw Error('Replications must be a whole number from 1 to ' + LIMITS.runs + '.');
  if (runs * minutes * work > LIMITS.work) {
   throw Error('A replication plan may simulate at most ' + LIMITS.work + ' minutes in total; this one needs ' + runs * minutes * work + '.');
  }
  const horizon = options.horizon === undefined ? limit : options.horizon;
  if (horizon !== null && !whole(horizon, minutes, Number.MAX_SAFE_INTEGER)) {
   throw Error('Horizon must be unlimited or a whole number of at least the run minutes.');
  }
  const seed = options.seed ?? definitionSeed ?? 1;
  if (!whole(seed, 0, MAX_SEED)) throw Error('Seed must be a whole number from 0 to ' + MAX_SEED + '.');
  if (seed + runs - 1 > MAX_SEED) throw Error('Seeds ' + seed + ' to ' + (seed + runs - 1) + ' pass the largest seed, ' + MAX_SEED + '.');
  return {minutes, horizon, seeds: Array.from({length: runs}, (_, i) => seed + i)};
 }
 const outcomes = (d: LWProcess.Definition) => d.steps.some(s => s.kind === 'end' && s.outcome !== undefined);
 function kpis(d: LWProcess.Definition): Kpi[] {
  return [{id: 'completed', label: 'Completed cases'}, {id: 'failed', label: 'Failed cases'}, {id: 'dropped', label: 'Dropped arrivals'},
   {id: 'workCost', label: 'Work cost'}, {id: 'capacityCost', label: 'Capacity cost'}, {id: 'meanCycleMinutes', label: 'Mean cycle (minutes)'},
   {id: 'meanAgeMinutes', label: 'Mean age in progress (minutes)'}, {id: 'throughputPerHour', label: 'Throughput (completed per hour)'},
   ...d.resources.map(r => ({id: 'utilization.' + r.id, label: 'Utilisation of ' + r.name})),
   ...outcomes(d) ? [{id: 'goals', label: 'Goals'}, {id: 'lost', label: 'Lost'}, {id: 'conversion', label: 'Conversion (permille)'}] : []];
 }
 function measure(d: LWProcess.Definition, q: LWProcess.Snapshot): Record<string, number | null> {
  const m = q.metrics, values: Record<string, number | null> = {completed: m.completed, failed: m.failed, dropped: m.dropped, workCost: m.cost,
   capacityCost: m.capacityCost, meanCycleMinutes: m.completed ? m.meanCycleMinutes : null, meanAgeMinutes: m.meanAgeMinutes,
   throughputPerHour: m.throughputPerHour};
  for (const pool of q.resources) values['utilization.' + pool.id] = pool.utilization;
  if (outcomes(d)) Object.assign(values, {goals: m.goals, lost: m.lost, conversion: m.conversion});
  return values;
 }
 const identity = (d: LWProcess.Definition): LWProcessReplicate.Identity =>
  ({id: d.id, name: d.name, revision: d.revision, fingerprint: root.LWProcessCatalog.fingerprint(d)});
 function runOne(d: LWProcess.Definition, seed: number, p: LWProcessReplicate.Plan): LWProcessReplicate.Outcome {
  const session = root.LWProcessRuntime.create(d, {seed, horizon: p.horizon});
  try {
   const q = session.advance(p.minutes);
   return {minute: q.minute, status: q.status, values: measure(d, q)};
  } finally { session.dispose(); }
 }
 const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
 function replications(input: unknown, options: Options): LWProcessReplicate.Runner<LWProcessReplicate.Report> {
  const d = root.LWProcessCatalog.admit(input), p = plan(options, d.seed), rows: LWProcessReplicate.Row[] = [], list = kpis(d);
  const report = (): LWProcessReplicate.Report => copy({format: 'wildlands-process-replications', schemaVersion: 1, definition: identity(d),
   minutes: p.minutes, horizon: p.horizon, runs: p.seeds.length, complete: rows.length === p.seeds.length, seeds: p.seeds,
   kpis: list.map(k => ({id: k.id, label: k.label, ...summarize(rows.map(r => r.values[k.id] ?? null))})), rows});
  return {total: p.seeds.length, done: () => rows.length, report,
   step() {
    if (rows.length >= p.seeds.length) return false;
    const seed = p.seeds[rows.length]!;
    rows.push({seed, ...runOne(d, seed, p)});
    return true;
   }};
 }
 function comparison(inputA: unknown, inputB: unknown, options: Options): LWProcessReplicate.Runner<LWProcessReplicate.Comparison> {
  const a = root.LWProcessCatalog.admit(inputA), b = root.LWProcessCatalog.admit(inputB), p = plan(options, a.seed, 2);
  const rows: LWProcessReplicate.PairRow[] = [], seen = new Set<string>(), list: Kpi[] = [];
  for (const k of [...kpis(a), ...kpis(b)]) if (!seen.has(k.id)) { seen.add(k.id); list.push(k); }
  const value = (o: LWProcessReplicate.Outcome, id: string) => o.values[id] ?? null;
  const report = (): LWProcessReplicate.Comparison => copy({format: 'wildlands-process-comparison', schemaVersion: 1, a: identity(a), b: identity(b),
   minutes: p.minutes, horizon: p.horizon, runs: p.seeds.length, complete: rows.length === p.seeds.length, seeds: p.seeds,
   kpis: list.map(k => ({id: k.id, label: k.label, a: summarize(rows.map(r => value(r.a, k.id))), b: summarize(rows.map(r => value(r.b, k.id))),
    difference: summarize(rows.map(r => r.difference[k.id] ?? null))})), rows});
  return {total: p.seeds.length, done: () => rows.length, report,
   step() {
    if (rows.length >= p.seeds.length) return false;
    const seed = p.seeds[rows.length]!, runA = runOne(a, seed, p), runB = runOne(b, seed, p), difference: Record<string, number | null> = {};
    for (const k of list) {
     const x = value(runA, k.id), y = value(runB, k.id);
     difference[k.id] = x === null || y === null ? null : x - y;
    }
    rows.push({seed, a: runA, b: runB, difference});
    return true;
   }};
 }
 function drain<R>(runner: LWProcessReplicate.Runner<R>): R {
  while (runner.step()) { /* one replication per step */ }
  return runner.report();
 }
 root.LWProcessReplicate = {LIMITS, T95, t95, summarize, plan, kpis, measure, replications, comparison,
  replicate: (input, options) => drain(replications(input, options)), compare: (a, b, options) => drain(comparison(a, b, options))};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessReplicate;
})(globalThis);
