/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-ledger-cases.ts" />
/**
 * Run ledger (LWProcessLedger), owned by the process-definition context: exact running aggregates that exist only for the read
 * model. They never feed the engine, a fingerprint, a random key or a routing decision, and they are kept outside the case store,
 * so pruning finished cases never changes them and chunked advances give the same totals as one advance.
 *
 * - Per step: `starts` (work starts, every multi-instance item counted, exactly the visits whose wait is in `waitMinutes`),
 *   `fixedCost` (the step's fixed `cost` charged at each start) and `workCost` (that fixed cost plus the per-minute cost of the
 *   pool units occupied by work running at this step).
 * - Per step, while work runs: `rate`, the pool cost per minute of the work running at the step now. It changes exactly where
 *   pool `busy` changes (a start and a release), so at every minute the sum of the rates equals the sum over pools of
 *   `busy × costPerMinute`, and the sum of the steps' `workCost` equals the run's `metrics.cost`.
 * - Per step: `minutesBy`, token-minutes by status bucket, and `failed`, case failures attributed to the step.
 * - Run: `wipArea` (Σ cases in progress × minutes), the coarse cycle histogram (fixed 1-2-5 bins) and the fine distributions
 *   (`FINE`, 54 edges, a superset of the coarse edges): cycle, by outcome (only when an end declares one), failed lifetimes, and
 *   per step wait, service and exit age. Fixed size: 54 × (3 × steps + 5) integers at most.
 * - Per case (LWProcessLedgerCases): dominant-state lead minutes, attributed cost, repeats and the recent ring.
 *
 * Charging: `charge(minutes)` is called by the clock exactly where pools are charged, with the state at the end of the previous
 * minute (the pools' convention), so a case admitted at a and finished at f is charged exactly f − a minutes. The token profile
 * used for the per-status minutes (counts per step and bucket, each case's dominant bucket) is built once per settled state:
 * `settled` drops it at the end of every settle and the next `charge` or `profile` call rebuilds it in one pass over the tokens.
 * After a settle no `routing` or `spent` token remains, so every live case has a token in one of the six buckets.
 *
 * All costs are whole numbers (the schema admits only integer `cost` and `costPerMinute`), so every sum is exact.
 *
 * Working hours: a definition with `workingHours` adds a seventh state, `closed`. The clock books every minute outside working
 * time with `closed(minutes)` instead of `charge`: no pool rate or cost, the work-in-progress area as usual, each step's tokens to
 * that step's `closed` minutes and each live case's minutes to its `closed` lead minutes, whatever their status. `minutesBy` and
 * `leadTime` report `closed` only for such a definition, so other snapshots keep their exact shape.
 */
declare namespace LWProcess {
 /** Read-model extensions of the run ledger (LWProcessLedger); never read by the engine. */
 interface Ledger {
  index: Map<string, number>; stepCosts: StepCosts[]; minutesBy: number[]; failedAt: number[]; wipArea: number;
  /** Per step: token-minutes outside working hours; null without working hours. */
  closedBy: number[] | null;
  profile: LWProcessLedger.Profile | null; fine: LWProcessLedger.Fine; cases: LWProcessLedgerCases.Store;
 }
}
declare namespace LWProcessLedger {
 /** Token profile of one settled state: per step × bucket counts, and each live case's book with its dominant bucket. */
 interface Profile { counts: number[]; books: LWProcessLedgerCases.Book[]; buckets: number[]; }
 interface Fine { cycle: number[]; failed: number[]; outcomes: {goal: number[]; lost: number[]; none: number[]} | null; steps: number[][][]; }
 interface Api {
  /**
   * Lower bin edges of the cycle histogram in business minutes: 0, then 1-2-5 steps from 1 to 100,000. Bin `i` counts cycles
   * `c` with `EDGES[i] <= c < EDGES[i + 1]`; the last bin (100,000 and more) is open.
   */
  readonly EDGES: readonly number[];
  /** The 54 lower edges of the fine distributions (a superset of `EDGES`; above 2 minutes consecutive edges differ by at most 1.5×). */
  readonly FINE: readonly number[];
  /** Status buckets in dominant-state priority order: working, waiting, blocked, backlog, timer, joining. */
  readonly BUCKETS: readonly (keyof LWProcess.MinutesBy)[];
  /** `retained` sizes the recent ring (default 200). */
  create(definition: LWProcess.Definition, retained?: number): LWProcess.Ledger;
  /** Work of `step` started for a case after `wait` minutes: one more start, its fixed cost, and its pool cost per minute. */
  started(ledger: LWProcess.Ledger, step: LWProcess.Step, caseId: string, wait: number): void;
  /** Work of the step with this id released its pool units (finished, interrupted or failed). */
  released(ledger: LWProcess.Ledger, stepId: string, caseId: string): void;
  /** Charges `minutes` with the settled state: running rates, `wip` cases in progress, and the token profile of `tokens`. */
  charge(ledger: LWProcess.Ledger, minutes: number, tokens: readonly LWProcess.Token[], wip: number): void;
  /** Books `minutes` outside working hours: `wip` cases in progress, and every token and live case of `tokens` as closed. */
  closed(ledger: LWProcess.Ledger, minutes: number, tokens: readonly LWProcess.Token[], wip: number): void;
  /** The state was settled: the next charge or profile read rebuilds the token profile. */
  settled(ledger: LWProcess.Ledger): void;
  profile(ledger: LWProcess.Ledger, tokens: readonly LWProcess.Token[]): Profile;
  /** A visit concluded: `service` (work steps only, else null) and the case's age at exit. */
  concluded(ledger: LWProcess.Ledger, stepId: string, service: number | null, age: number): void;
  /** Accepted re-entry of a case into a non-join step. */
  repeated(ledger: LWProcess.Ledger, caseId: string): void;
  /** A case completed at the end step `end` (its `finished` minute is set). */
  finished(ledger: LWProcess.Ledger, c: LWProcess.Case, end: string, outcome: 'goal' | 'lost' | null): void;
  /** A case failed (its `finished` minute is set), at `stepId` when the failure names one. */
  failed(ledger: LWProcess.Ledger, c: LWProcess.Case, stepId: string | null): void;
  /** The kernel retired the case: its book is deleted. */
  retired(ledger: LWProcess.Ledger, caseId: string): void;
  /** Index of the histogram bin that holds `cycle`. */
  bin(cycle: number): number;
  /** Index of the fine bin that holds `minutes`. */
  fineBin(minutes: number): number;
  /** Detached `minutesBy` and `failed` of one step. */
  step(ledger: LWProcess.Ledger, stepId: string): {minutesBy: LWProcess.MinutesBy; failed: number};
  /** Detached run totals of the per-case books plus `wipArea`. */
  totals(ledger: LWProcess.Ledger): LWProcessLedgerCases.Totals & {wipArea: number};
  distributions(ledger: LWProcess.Ledger, definition: LWProcess.Definition): LWProcess.Distributions;
  recent(ledger: LWProcess.Ledger): LWProcess.FinishedCase[];
 }
}
(function(inputRoot: unknown) {
 'use strict';
 type Ledger = LWProcess.Ledger;
 const root = inputRoot as {LWProcessLedgerCases: LWProcessLedgerCases.Api; LWProcessLedger?: LWProcessLedger.Api};
 const cases = root.LWProcessLedgerCases;
 const EDGES: readonly number[] = Object.freeze([0, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000]);
 const FINE: readonly number[] = Object.freeze([0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 90, 100, 120, 150, 180, 200, 240, 300,
  360, 480, 500, 600, 720, 960, 1000, 1200, 1440, 1920, 2000, 2400, 2880, 3600, 4320, 5000, 5760, 7200, 8640, 10000, 14400, 20000, 28800, 40320,
  50000, 60480, 80640, 100000]);
 const BUCKETS: readonly (keyof LWProcess.MinutesBy)[] = Object.freeze(['working', 'waiting', 'blocked', 'backlog', 'timer', 'joining'] as const);
 /** Token status to bucket index; `routing` and `spent` never survive a settle and are not counted. */
 const BUCKET_OF: Record<string, number> = {active: 0, queued: 1, held: 2, backlog: 3, timer: 4, joining: 5};
 const WAIT = 0, SERVICE = 1, AGE = 2;
 /** Largest index i with `edges[i] <= value` (binary search; values are never negative). */
 function search(edges: readonly number[], value: number): number {
  let low = 0, high = edges.length - 1;
  while (low < high) {
   const middle = (low + high + 1) >> 1;
   if (edges[middle]! <= value) low = middle;
   else high = middle - 1;
  }
  return low;
 }
 const bin = (cycle: number) => search(EDGES, cycle);
 const fineBin = (minutes: number) => search(FINE, minutes);
 const zeros = () => FINE.map(() => 0);
 function create(definition: LWProcess.Definition, retained = 200): Ledger {
  const cost = new Map(definition.resources.map(r => [r.id, r.costPerMinute]));
  const unit = new Map<string, number>(), steps = new Map<string, LWProcess.StepCosts>(), stepCosts: LWProcess.StepCosts[] = [];
  for (const step of definition.steps) {
   const perMinute = Object.entries(step.resources ?? {}).reduce((n, [id, quantity]) => n + quantity * (cost.get(id) ?? 0), 0);
   if (perMinute) unit.set(step.id, perMinute);
   const costs = {starts: 0, fixedCost: 0, workCost: 0};
   steps.set(step.id, costs);
   stepCosts.push(costs);
  }
  const outcomes = definition.steps.some(s => s.kind === 'end' && s.outcome !== undefined) ? {goal: zeros(), lost: zeros(), none: zeros()} : null;
  const count = definition.steps.length;
  return {unit, rate: new Map(), steps, cycles: EDGES.map(() => 0), index: new Map(definition.steps.map((s, i) => [s.id, i])), stepCosts,
   minutesBy: Array(count * BUCKETS.length).fill(0), failedAt: Array(count).fill(0), wipArea: 0, profile: null,
   closedBy: definition.workingHours ? Array(count).fill(0) : null,
   fine: {cycle: zeros(), failed: zeros(), outcomes, steps: definition.steps.map(() => [zeros(), zeros(), zeros()])},
   cases: cases.create(retained, !!definition.workingHours)};
 }
 const fine = (ledger: Ledger, stepId: string, kind: number, minutes: number) => {
  ledger.fine.steps[ledger.index.get(stepId)!]![kind]![fineBin(minutes)]!++;
 };
 function started(ledger: Ledger, step: LWProcess.Step, caseId: string, wait: number): void {
  const costs = ledger.steps.get(step.id)!, fixed = step.cost ?? 0, perMinute = ledger.unit.get(step.id);
  costs.starts++;
  costs.fixedCost += fixed;
  costs.workCost += fixed;
  if (perMinute) ledger.rate.set(step.id, (ledger.rate.get(step.id) ?? 0) + perMinute);
  cases.started(ledger.cases, caseId, fixed, perMinute ?? 0);
  fine(ledger, step.id, WAIT, wait);
 }
 function released(ledger: Ledger, stepId: string, caseId: string): void {
  const perMinute = ledger.unit.get(stepId);
  if (!perMinute) return;
  const left = ledger.rate.get(stepId)! - perMinute;
  if (left) ledger.rate.set(stepId, left);
  else ledger.rate.delete(stepId);
  cases.released(ledger.cases, caseId, perMinute);
 }
 function profile(ledger: Ledger, tokens: readonly LWProcess.Token[]): LWProcessLedger.Profile {
  if (ledger.profile) return ledger.profile;
  const counts: number[] = Array(ledger.minutesBy.length).fill(0), books: LWProcessLedgerCases.Book[] = [], buckets: number[] = [];
  const at = new Map<string, number>();
  for (const t of tokens) {
   const bucket = BUCKET_OF[t.status];
   if (bucket === undefined) continue;
   counts[ledger.index.get(t.stepId)! * BUCKETS.length + bucket]!++;
   const i = at.get(t.caseId);
   if (i === undefined) {
    at.set(t.caseId, books.length);
    books.push(cases.book(ledger.cases, t.caseId));
    buckets.push(bucket);
   } else if (bucket < buckets[i]!) buckets[i] = bucket;
  }
  return ledger.profile = {counts, books, buckets};
 }
 function charge(ledger: Ledger, minutes: number, tokens: readonly LWProcess.Token[], wip: number): void {
  for (const [stepId, perMinute] of ledger.rate) ledger.steps.get(stepId)!.workCost += perMinute * minutes;
  ledger.wipArea += wip * minutes;
  const p = profile(ledger, tokens);
  for (let i = 0; i < p.counts.length; i++) if (p.counts[i]) ledger.minutesBy[i]! += p.counts[i]! * minutes;
  cases.charge(ledger.cases, p.books, p.buckets, minutes);
 }
 function closed(ledger: Ledger, minutes: number, tokens: readonly LWProcess.Token[], wip: number): void {
  ledger.wipArea += wip * minutes;
  const p = profile(ledger, tokens), by = ledger.closedBy!;
  for (let i = 0; i < p.counts.length; i++) if (p.counts[i]) by[Math.floor(i / BUCKETS.length)]! += p.counts[i]! * minutes;
  cases.closed(ledger.cases, p.books, minutes);
 }
 const settled = (ledger: Ledger) => { ledger.profile = null; };
 function concluded(ledger: Ledger, stepId: string, service: number | null, age: number): void {
  if (service !== null) fine(ledger, stepId, SERVICE, service);
  fine(ledger, stepId, AGE, age);
 }
 function finished(ledger: Ledger, c: LWProcess.Case, end: string, outcome: 'goal' | 'lost' | null): void {
  const cycle = c.finished! - c.entered;
  ledger.cycles[bin(cycle)]!++;
  ledger.fine.cycle[fineBin(cycle)]!++;
  if (ledger.fine.outcomes) ledger.fine.outcomes[outcome ?? 'none'][fineBin(cycle)]!++;
  cases.completed(ledger.cases, c, end, outcome);
 }
 function failed(ledger: Ledger, c: LWProcess.Case, stepId: string | null): void {
  ledger.fine.failed[fineBin(c.finished! - c.entered)]!++;
  if (stepId !== null) ledger.failedAt[ledger.index.get(stepId)!]!++;
  cases.failed(ledger.cases, c);
 }
 function step(ledger: Ledger, stepId: string): {minutesBy: LWProcess.MinutesBy; failed: number} {
  const at = ledger.index.get(stepId)!, i = at * BUCKETS.length, m = ledger.minutesBy;
  const closed = ledger.closedBy ? {closed: ledger.closedBy[at]!} : {};
  return {minutesBy: {waiting: m[i + 1]!, working: m[i]!, blocked: m[i + 2]!, backlog: m[i + 3]!, timer: m[i + 4]!, joining: m[i + 5]!, ...closed},
   failed: ledger.failedAt[at]!};
 }
 function distributions(ledger: Ledger, definition: LWProcess.Definition): LWProcess.Distributions {
  const f = ledger.fine, o = f.outcomes;
  return {edges: [...FINE], cycle: [...f.cycle], ...o ? {byOutcome: {goal: [...o.goal], lost: [...o.lost], none: [...o.none]}} : {},
   failed: [...f.failed], steps: Object.fromEntries(definition.steps.map((s, i) => {
    const [wait, service, exitAge] = f.steps[i]!;
    return [s.id, {wait: [...wait!], service: [...service!], exitAge: [...exitAge!]}];
   }))};
 }
 root.LWProcessLedger = {EDGES, FINE, BUCKETS, create, started, released, charge, closed, settled, profile, concluded, finished, failed, bin, fineBin, step,
  distributions,
  repeated: (ledger, caseId) => cases.repeated(ledger.cases, caseId),
  retired: (ledger, caseId) => cases.retired(ledger.cases, caseId),
  totals: ledger => ({wipArea: ledger.wipArea, ...cases.totals(ledger.cases)}),
  recent: ledger => cases.recent(ledger.cases)};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessLedger;
})(globalThis);
