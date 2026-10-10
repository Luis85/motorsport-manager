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
 * `ci95`, the two-sided 95% confidence interval of the mean, mean ± t × sd / √n with t the Student t quantile for n - 1 degrees of
 * freedom (`interval95`), `null` below 2 values; and `p10`, `p50`, `p90` by the nearest-rank rule (the smallest observed value with
 * at least q% of the values at or below it). Every statistic is rounded to 6 decimals.
 *
 * Student t quantile (`t95`): the exact two-sided 95% (one-sided 97.5%) quantile for any whole df ≥ 1, pure and dependency-free.
 * Up to 1,000 degrees of freedom it inverts the exact central probability P(|T| ≤ t) (Abramowitz and Stegun 26.7.3 and 26.7.4, a
 * finite series in θ = atan(t / √df) for whole df) by 64 bisection steps between 1.959964 and 12.75; beyond, the four-term
 * Cornish-Fisher expansion around the normal quantile 1.959964 (A&S 26.7.5), whose error there is below 1e-12. Both agree with
 * independent references to better than 1e-9 (12.706205 at 1, 2.042272 at 30, 2.021075 at 40, 1.983972 at 100, 1.962339 at 1,000).
 * Intervals with 1 to 30 degrees of freedom use that quantile rounded to 3 decimals (`T95`, the classic printed table, which
 * reports pinned before this used; within 0.0005 of the exact value), and from 31 on the exact quantile; until then 31 and more used
 * the normal 1.96, slightly narrow up to about 120.
 *
 * A comparison runs both definitions with the same seeds. Draws are keyed by seed and stable identities (case, step, visit), so
 * the runs share common random numbers wherever the definitions agree. Per KPI it reports A's and B's statistics and the paired
 * difference A − B over the seeds where both have a value, with its own sd and t-based 95% interval.
 *
 * Incremental use: `replications` and `comparison` return a runner whose `step()` performs one replication (one seed; both
 * definitions for a comparison), so a page can spread the work over frames; `report()` summarises the rows so far and says
 * whether the plan is `complete`. `advance(budget)` is the sliced form: it requests at most `budget` simulated minutes per call,
 * keeps the open replication's session between calls (finishing replications on the way) and gives exactly the rows of `step()`,
 * because a session advanced in any chunks equals one advance. `dispose()` closes the open session (cancel, process switch);
 * the runner then refuses `step` and `advance` but still reports its rows. Replication sessions run with `series: false`.
 *
 * Warm-up (`warmup`, a whole number from 0 to minutes − 1, optional): each run snapshots at minute W and reports, besides the
 * whole-run KPIs, windowed KPIs labelled "after minute W" from differences of cumulative totals over (W, end]: completed,
 * failed, dropped, work and capacity cost, mean cycle of the cases finished in the window (Δ cycleSum / Δ completed), mean work in
 * progress (Δ wipArea / window minutes), throughput per hour and per-pool utilisation (Δ busyMinutes / (window × capacity)).
 * A run that stops before W takes its warm-up snapshot where it stopped (an empty window: per-minute KPIs are `null`). Without
 * `warmup`, plans, reports and KPIs are exactly as before.
 */
declare namespace LWProcessReplicate {
 interface Options { minutes: number; runs: number; seed?: number; horizon?: number | null; warmup?: number; }
 interface Plan { minutes: number; horizon: number | null; seeds: number[]; warmup?: number; }
 interface Kpi { id: string; label: string; }
 interface Stats {
  n: number; mean: number | null; sd: number | null; ci95: [number, number] | null; p10: number | null; p50: number | null; p90: number | null;
 }
 interface Summary extends Stats { id: string; label: string; }
 interface Outcome { minute: number; status: LWProcess.Snapshot['status']; values: Record<string, number | null>; }
 interface Row extends Outcome { seed: number; }
 interface Identity { id: string; name: string; revision: number; fingerprint: string; }
 interface Report {
  format: 'wildlands-process-replications'; schemaVersion: 1; definition: Identity; minutes: number; horizon: number | null; warmup?: number;
  runs: number; complete: boolean; seeds: number[]; kpis: Summary[]; rows: Row[];
 }
 interface Difference { id: string; label: string; a: Stats; b: Stats; difference: Stats; }
 interface PairRow { seed: number; a: Outcome; b: Outcome; difference: Record<string, number | null>; }
 interface Comparison {
  format: 'wildlands-process-comparison'; schemaVersion: 1; a: Identity; b: Identity; minutes: number; horizon: number | null; warmup?: number;
  runs: number; complete: boolean; seeds: number[]; kpis: Difference[]; rows: PairRow[];
 }
 interface Runner<R> {
  /** Replications planned. */
  readonly total: number;
  /** Replications done so far. */
  done(): number;
  /** Runs (or finishes the open) replication; false (doing nothing) once all are done. */
  step(): boolean;
  /**
   * Requests at most `budgetMinutes` (a whole number, 1 or more) simulated minutes, keeping the open replication's session between
   * calls; false (doing nothing) once all are done.
   */
  advance(budgetMinutes: number): boolean;
  /** Closes the open session; later `step` and `advance` calls throw. */
  dispose(): void;
  /** A detached report of the rows so far. */
  report(): R;
 }
 interface Api {
  readonly LIMITS: {readonly runs: number; readonly work: number};
  /** The exact two-sided 95% Student t quantiles for 1..30 degrees of freedom rounded to 3 decimals (index 0 is df 1). */
  readonly T95: readonly number[];
  /** The exact two-sided 95% Student t quantile for a whole df ≥ 1 (Infinity gives the normal 1.959964); throws otherwise. */
  t95(df: number): number;
  /** The quantile `ci95` uses: `T95[df - 1]` for 1..30 degrees of freedom, `t95(df)` beyond. */
  interval95(df: number): number;
  summarize(values: readonly (number | null)[]): Stats;
  /** Validates options and expands the seeds; `work` is the simulated minutes per replication factor (2 for a comparison). */
  plan(options: Options, definitionSeed?: number, work?: number): Plan;
  /** The KPIs of a plan; with `warmup` the windowed `window.*` KPIs follow the whole-run ones. */
  kpis(definition: LWProcess.Definition, warmup?: number): Kpi[];
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
 /** The two-sided 95% normal quantile, the limit of the Student t quantile as df grows. */
 const NORMAL95 = 1.959963984540054, SERIES_DF = 1000, BISECTIONS = 64, UPPER = 12.75;
 /** P(|T| ≤ t) for Student t with a whole `df` ≥ 1 (A&S 26.7.3 for odd df, 26.7.4 for even df). */
 function central(t: number, df: number): number {
  const theta = Math.atan(t / Math.sqrt(df)), cos = Math.cos(theta), c2 = cos * cos, odd = df % 2 === 1;
  if (df === 1) return 2 * theta / Math.PI;
  let term = odd ? cos : 1, sum = term;
  for (let k = odd ? 3 : 2; k <= df - 2; k += 2) {
   term *= c2 * (k - 1) / k;
   sum += term;
  }
  return odd ? 2 / Math.PI * (theta + Math.sin(theta) * sum) : Math.sin(theta) * sum;
 }
 /** The Cornish-Fisher expansion of the 97.5% t quantile in 1 / df, to the fourth power. */
 function expansion(df: number): number {
  const z = NORMAL95, z2 = z * z, z3 = z2 * z, z5 = z3 * z2, z7 = z5 * z2, z9 = z7 * z2;
  const g1 = (z3 + z) / 4, g2 = (5 * z5 + 16 * z3 + 3 * z) / 96, g3 = (3 * z7 + 19 * z5 + 17 * z3 - 15 * z) / 384;
  const g4 = (79 * z9 + 776 * z7 + 1482 * z5 - 1920 * z3 - 945 * z) / 92160;
  return z + g1 / df + g2 / (df * df) + g3 / df ** 3 + g4 / df ** 4;
 }
 const solved = new Map<number, number>();
 function t95(df: number): number {
  if (df === Infinity) return NORMAL95;
  if (!Number.isSafeInteger(df) || df < 1) throw Error('Degrees of freedom must be a whole number of at least 1.');
  if (df > SERIES_DF) return expansion(df);
  let t = solved.get(df);
  if (t === undefined) {
   let low = NORMAL95, high = UPPER;
   for (let i = 0; i < BISECTIONS; i++) {
    const middle = (low + high) / 2;
    if (central(middle, df) < .95) low = middle;
    else high = middle;
   }
   t = (low + high) / 2;
   solved.set(df, t);
  }
  return t;
 }
 const T95: readonly number[] = Object.freeze(Array.from({length: 30}, (_, i) => Math.round(t95(i + 1) * 1000) / 1000));
 const interval95 = (df: number) => df >= 1 && df <= T95.length ? T95[df - 1]! : t95(df);
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
  const half = sd === null ? null : interval95(n - 1) * sd / Math.sqrt(n);
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
  const warmup = options.warmup;
  if (warmup !== undefined && !whole(warmup, 0, minutes - 1)) throw Error('Warm-up must be a whole number of minutes from 0 to ' + (minutes - 1) + '.');
  return {minutes, horizon, seeds: Array.from({length: runs}, (_, i) => seed + i), ...warmup === undefined ? {} : {warmup}};
 }
 const outcomes = (d: LWProcess.Definition) => d.steps.some(s => s.kind === 'end' && s.outcome !== undefined);
 /** Windowed KPIs over (W, end] of a plan with a warm-up of W minutes. */
 function windowed(d: LWProcess.Definition, warmup: number): Kpi[] {
  const after = ' after minute ' + warmup;
  return [{id: 'window.completed', label: 'Completed cases' + after}, {id: 'window.failed', label: 'Failed cases' + after},
   {id: 'window.dropped', label: 'Dropped arrivals' + after}, {id: 'window.workCost', label: 'Work cost' + after},
   {id: 'window.capacityCost', label: 'Capacity cost' + after},
   {id: 'window.meanCycleMinutes', label: 'Mean cycle of cases finished' + after + ' (minutes)'},
   {id: 'window.meanWip', label: 'Mean work in progress' + after},
   {id: 'window.throughputPerHour', label: 'Throughput' + after + ' (completed per hour)'},
   ...d.resources.map(r => ({id: 'window.utilization.' + r.id, label: 'Utilisation of ' + r.name + after}))];
 }
 function kpis(d: LWProcess.Definition, warmup?: number): Kpi[] {
  return [{id: 'completed', label: 'Completed cases'}, {id: 'failed', label: 'Failed cases'}, {id: 'dropped', label: 'Dropped arrivals'},
   {id: 'workCost', label: 'Work cost'}, {id: 'capacityCost', label: 'Capacity cost'}, {id: 'meanCycleMinutes', label: 'Mean cycle (minutes)'},
   {id: 'meanAgeMinutes', label: 'Mean age in progress (minutes)'}, {id: 'throughputPerHour', label: 'Throughput (completed per hour)'},
   ...d.resources.map(r => ({id: 'utilization.' + r.id, label: 'Utilisation of ' + r.name})),
   ...outcomes(d) ? [{id: 'goals', label: 'Goals'}, {id: 'lost', label: 'Lost'}, {id: 'conversion', label: 'Conversion (permille)'}] : [],
   ...warmup === undefined ? [] : windowed(d, warmup)];
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
 /** Differences of cumulative totals between the warm-up snapshot `w` and the end snapshot `q`. */
 function measureWindow(w: LWProcess.Snapshot, q: LWProcess.Snapshot): Record<string, number | null> {
  const a = w.metrics, b = q.metrics, span = q.minute - w.minute, completed = b.completed - a.completed;
  const values: Record<string, number | null> = {'window.completed': completed, 'window.failed': b.failed - a.failed,
   'window.dropped': b.dropped - a.dropped, 'window.workCost': b.cost - a.cost, 'window.capacityCost': b.capacityCost - a.capacityCost,
   'window.meanCycleMinutes': completed ? (b.cycleSum! - a.cycleSum!) / completed : null,
   'window.meanWip': span ? (b.wipArea! - a.wipArea!) / span : null, 'window.throughputPerHour': span ? completed * 60 / span : null};
  q.resources.forEach((pool, i) => {
   values['window.utilization.' + pool.id] = span ? (pool.busyMinutes - w.resources[i]!.busyMinutes) / (span * pool.capacity) : null;
  });
  return values;
 }
 /** One replication's run of one definition: its session, minute, warm-up snapshot and, once done, its outcome. */
 interface Job {
  d: LWProcess.Definition; session: LWProcess.Session; minute: number; stopped: boolean; last: LWProcess.Snapshot | null;
  warm: LWProcess.Snapshot | null; outcome: LWProcessReplicate.Outcome | null;
 }
 const open = (d: LWProcess.Definition, seed: number, p: LWProcessReplicate.Plan): Job => ({d, minute: 0, stopped: false, last: null, warm: null,
  outcome: null, session: root.LWProcessRuntime.create(d, {seed, horizon: p.horizon, series: false})});
 /**
  * Advances a job by at most `budget` requested minutes: to the warm-up minute (snapshot), then to the run minutes (outcome, session
  * disposed). A session that stops early (no arrivals and no work left) cannot move further, so its last snapshot is final.
  * Returns the minutes requested.
  */
 function drive(job: Job, p: LWProcessReplicate.Plan, budget: number): number {
  let used = 0;
  while (true) {
   const warming = p.warmup !== undefined && job.warm === null, stop = warming ? p.warmup! : p.minutes;
   if (job.stopped || job.minute >= stop) {
    const q = job.last ?? job.session.query();
    if (warming) {
     job.warm = q;
     continue;
    }
    job.outcome = {minute: q.minute, status: q.status, values: {...measure(job.d, q), ...job.warm ? measureWindow(job.warm, q) : {}}};
    job.session.dispose();
    return used;
   }
   if (used >= budget) return used;
   const n = Math.min(budget - used, stop - job.minute), q = job.session.advance(n);
   used += n;
   job.stopped = q.minute < job.minute + n;
   job.minute = q.minute;
   job.last = q;
  }
 }
 /**
  * The incremental runner shared by replications and comparisons: each seed runs `definitions` in order, and `push` receives the
  * seed's outcomes when the last one is done. `step` finishes one replication; `advance` spends a minute budget across them.
  */
 function runner<R>(definitions: LWProcess.Definition[], p: LWProcessReplicate.Plan, count: () => number,
  push: (seed: number, outcomes: LWProcessReplicate.Outcome[]) => void, report: () => R): LWProcessReplicate.Runner<R> {
  let job: Job | null = null, outcomes: LWProcessReplicate.Outcome[] = [], disposed = false;
  const total = p.seeds.length;
  function spend(budget: number, single: boolean): void {
   let left = budget;
   try {
    while (count() < total) {
     const seed = p.seeds[count()]!;
     job ??= open(definitions[outcomes.length]!, seed, p);
     left -= drive(job, p, left);
     if (!job.outcome) return;
     outcomes.push(job.outcome);
     job = null;
     if (outcomes.length < definitions.length) continue;
     push(seed, outcomes);
     outcomes = [];
     if (single || left <= 0) return;
    }
   } catch (error) {
    job?.session.dispose();
    job = null;
    outcomes = [];
    throw error;
   }
  }
  const usable = () => { if (disposed) throw Error('The replication runner is disposed.'); };
  return {total, done: count, report,
   step() {
    usable();
    if (count() >= total) return false;
    spend(Infinity, true);
    return true;
   },
   advance(budgetMinutes) {
    usable();
    if (!whole(budgetMinutes, 1, Number.MAX_SAFE_INTEGER)) throw Error('The minute budget must be a whole number (1 or more).');
    if (count() >= total) return false;
    spend(budgetMinutes, false);
    return true;
   },
   dispose() {
    disposed = true;
    job?.session.dispose();
    job = null;
   }};
 }
 const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
 const warmupOf = (p: LWProcessReplicate.Plan) => p.warmup === undefined ? {} : {warmup: p.warmup};
 function replications(input: unknown, options: Options): LWProcessReplicate.Runner<LWProcessReplicate.Report> {
  const d = root.LWProcessCatalog.admit(input), p = plan(options, d.seed), rows: LWProcessReplicate.Row[] = [], list = kpis(d, p.warmup);
  const report = (): LWProcessReplicate.Report => copy({format: 'wildlands-process-replications', schemaVersion: 1, definition: identity(d),
   minutes: p.minutes, horizon: p.horizon, ...warmupOf(p), runs: p.seeds.length, complete: rows.length === p.seeds.length, seeds: p.seeds,
   kpis: list.map(k => ({id: k.id, label: k.label, ...summarize(rows.map(r => r.values[k.id] ?? null))})), rows});
  return runner([d], p, () => rows.length, (seed, [run]) => { rows.push({seed, ...run!}); }, report);
 }
 function comparison(inputA: unknown, inputB: unknown, options: Options): LWProcessReplicate.Runner<LWProcessReplicate.Comparison> {
  const a = root.LWProcessCatalog.admit(inputA), b = root.LWProcessCatalog.admit(inputB), p = plan(options, a.seed, 2);
  const rows: LWProcessReplicate.PairRow[] = [], seen = new Set<string>(), list: Kpi[] = [];
  for (const k of [...kpis(a, p.warmup), ...kpis(b, p.warmup)]) if (!seen.has(k.id)) { seen.add(k.id); list.push(k); }
  const value = (o: LWProcessReplicate.Outcome, id: string) => o.values[id] ?? null;
  const report = (): LWProcessReplicate.Comparison => copy({format: 'wildlands-process-comparison', schemaVersion: 1, a: identity(a), b: identity(b),
   minutes: p.minutes, horizon: p.horizon, ...warmupOf(p), runs: p.seeds.length, complete: rows.length === p.seeds.length, seeds: p.seeds,
   kpis: list.map(k => ({id: k.id, label: k.label, a: summarize(rows.map(r => value(r.a, k.id))), b: summarize(rows.map(r => value(r.b, k.id))),
    difference: summarize(rows.map(r => r.difference[k.id] ?? null))})), rows});
  return runner([a, b], p, () => rows.length, (seed, [runA, runB]) => {
   const difference: Record<string, number | null> = {};
   for (const k of list) {
    const x = value(runA!, k.id), y = value(runB!, k.id);
    difference[k.id] = x === null || y === null ? null : x - y;
   }
   rows.push({seed, a: runA!, b: runB!, difference});
  }, report);
 }
 function drain<R>(runner: LWProcessReplicate.Runner<R>): R {
  while (runner.step()) { /* one replication per step */ }
  return runner.report();
 }
 root.LWProcessReplicate = {LIMITS, T95, t95, interval95, summarize, plan, kpis, measure, replications, comparison,
  replicate: (input, options) => drain(replications(input, options)), compare: (a, b, options) => drain(comparison(a, b, options))};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessReplicate;
})(globalThis);
