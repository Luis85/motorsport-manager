/// <reference path="./process-contracts.d.ts" />
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
 * - Cycle histogram: completed cases by cycle time (finish minus arrival) in fixed 1-2-5 bins.
 *
 * All costs are whole numbers (the schema admits only integer `cost` and `costPerMinute`), so every sum is exact.
 */
declare namespace LWProcessLedger {
 interface Api {
  /**
   * Lower bin edges of the cycle histogram in business minutes: 0, then 1-2-5 steps from 1 to 100,000. Bin `i` counts cycles
   * `c` with `EDGES[i] <= c < EDGES[i + 1]`; the last bin (100,000 and more) is open.
   */
  readonly EDGES: readonly number[];
  create(definition: LWProcess.Definition): LWProcess.Ledger;
  /** Work of `step` started: one more start, its fixed cost, and its pool cost per minute added to the step's running rate. */
  started(ledger: LWProcess.Ledger, step: LWProcess.Step): void;
  /** Work of the step with this id released its pool units (finished, interrupted or failed). */
  released(ledger: LWProcess.Ledger, stepId: string): void;
  /** Charges `minutes` of every step's running rate to that step's work cost (the same minutes the pools are charged). */
  charge(ledger: LWProcess.Ledger, minutes: number): void;
  /** A case completed with this cycle time. */
  finished(ledger: LWProcess.Ledger, cycle: number): void;
  /** Index of the histogram bin that holds `cycle`. */
  bin(cycle: number): number;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessLedger?: LWProcessLedger.Api};
 const EDGES: readonly number[] = Object.freeze([0, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000]);
 function bin(cycle: number): number {
  let index = 0;
  while (index + 1 < EDGES.length && EDGES[index + 1]! <= cycle) index++;
  return index;
 }
 function create(definition: LWProcess.Definition): LWProcess.Ledger {
  const cost = new Map(definition.resources.map(r => [r.id, r.costPerMinute]));
  const unit = new Map<string, number>(), steps = new Map<string, LWProcess.StepCosts>();
  for (const step of definition.steps) {
   const perMinute = Object.entries(step.resources ?? {}).reduce((n, [id, quantity]) => n + quantity * (cost.get(id) ?? 0), 0);
   if (perMinute) unit.set(step.id, perMinute);
   steps.set(step.id, {starts: 0, fixedCost: 0, workCost: 0});
  }
  return {unit, rate: new Map(), steps, cycles: EDGES.map(() => 0)};
 }
 function started(ledger: LWProcess.Ledger, step: LWProcess.Step): void {
  const costs = ledger.steps.get(step.id)!, fixed = step.cost ?? 0, perMinute = ledger.unit.get(step.id);
  costs.starts++;
  costs.fixedCost += fixed;
  costs.workCost += fixed;
  if (perMinute) ledger.rate.set(step.id, (ledger.rate.get(step.id) ?? 0) + perMinute);
 }
 function released(ledger: LWProcess.Ledger, stepId: string): void {
  const perMinute = ledger.unit.get(stepId);
  if (!perMinute) return;
  const left = ledger.rate.get(stepId)! - perMinute;
  if (left) ledger.rate.set(stepId, left);
  else ledger.rate.delete(stepId);
 }
 function charge(ledger: LWProcess.Ledger, minutes: number): void {
  for (const [stepId, perMinute] of ledger.rate) ledger.steps.get(stepId)!.workCost += perMinute * minutes;
 }
 function finished(ledger: LWProcess.Ledger, cycle: number): void { ledger.cycles[bin(cycle)]!++; }
 root.LWProcessLedger = {EDGES, create, started, released, charge, finished, bin};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessLedger;
})(globalThis);
