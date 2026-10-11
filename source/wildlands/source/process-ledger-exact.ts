/// <reference path="./process-contracts.d.ts" />
/**
 * Exact lead-time percentiles (LWProcessLedgerExact), owned by the process-definition context and driven only by LWProcessLedger:
 * the read-model store of the exact lead time (finish minute − arrival minute) of every completed case, kept while the run has
 * completed at most `LIMIT` cases, so percentiles can be exact instead of brackets of the fine bins.
 *
 * Bound: `LIMIT` = 50,000 completed cases. Each value is kept once for the whole run and, when an end step declares an outcome,
 * once more for its outcome (goal, lost or none), so the store holds at most 2 × 50,000 = 100,000 numbers (0.8 MB as Float64Array),
 * a quarter of the series budget; storage grows by doubling. The completion that passes the bound releases every kept value, and
 * the store stays over the bound for the rest of the run: from then on every percentile, whole-run and per outcome, is a bracket.
 * (A 100,000-minute run of the bundled demos completes at most about 32,000 cases.)
 *
 * Percentiles (`read`), at `QUANTILES`: the nearest-rank rule of LWProcessReplicate, the value of rank ceil(q × n / 100) in
 * ascending order (the smallest value with at least q% of the values at or below it), `{q, exact: true, value}`. Over the bound,
 * the fine bin of that rank by the same rule over the bin counts, `{q, exact: false, bracket: [edges[i], edges[i + 1]]}` (`null`
 * upper edge for the open last bin); the exact value always lies in that bracket. Reading keeps the kept values sorted in place
 * (their order carries no meaning): only the values added since the last read are sorted and merged in from the back, so a read
 * during a long run costs about the new values' sort plus the values they pass, not a sort of all of them.
 *
 * Values depend only on which cases completed and their minutes, never on how the run is chunked, on pruning or on the retained
 * ring. Integer minutes, no randomness, no clock; never read by the engine, a fingerprint, a random key or a decision.
 */
declare namespace LWProcess {
 interface Ledger { exact: LWProcessLedgerExact.Store; }
 /** One nearest-rank percentile of completed cases' lead times: the exact value, or the fine bin [lo, hi) that holds it. */
 type Percentile = {q: number; exact: true; value: number} | {q: number; exact: false; bracket: [number, number | null]};
 /** Percentiles over `n` completed cases; `exact` says whether every value is exact (no points when n is 0). */
 interface Percentiles { n: number; exact: boolean; points: Percentile[]; }
 interface Distributions {
  /**
   * Lead-time percentiles at `quantiles` (LWProcessLedgerExact): exact while the run has completed at most `limit` cases, else
   * brackets of the fine bins; `byOutcome` only when an end declares an outcome.
   */
  percentiles?: {limit: number; quantiles: number[]; cycle: Percentiles; byOutcome?: {goal: Percentiles; lost: Percentiles; none: Percentiles}};
 }
}
declare namespace LWProcessLedgerExact {
 /** `data[0, count)` holds the kept values; its first `ordered` are in ascending order. */
 interface Values { data: Float64Array; count: number; ordered: number; }
 interface Store {
  limit: number; completed: number; over: boolean; cycle: Values; outcomes: {goal: Values; lost: Values; none: Values} | null;
 }
 interface Api {
  /** Completed cases whose exact lead times are kept at most. */
  readonly LIMIT: number;
  /** The percentiles `read` reports, in percent. */
  readonly QUANTILES: readonly number[];
  /** `outcomes` keeps per-outcome values too; `limit` (whole, 1..LIMIT, default LIMIT) exists for checks of the bound. */
  create(outcomes: boolean, limit?: number): Store;
  /** A case completed after `minutes` with its end's outcome. */
  add(store: Store, minutes: number, outcome: 'goal' | 'lost' | null): void;
  /** Detached percentiles; `fine` gives the bin counts over `edges` the brackets use. */
  read(store: Store, fine: {cycle: readonly number[]; outcomes: {goal: number[]; lost: number[]; none: number[]} | null},
   edges: readonly number[]): NonNullable<LWProcess.Distributions['percentiles']>;
  /** The kept values of the whole run in ascending order (a copy); null over the bound. */
  values(store: Store): number[] | null;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 type Store = LWProcessLedgerExact.Store; type Values = LWProcessLedgerExact.Values;
 const root = inputRoot as {LWProcessLedgerExact?: LWProcessLedgerExact.Api};
 const LIMIT = 50000, FIRST = 64, FEW = 64;
 const QUANTILES: readonly number[] = Object.freeze([10, 25, 50, 75, 85, 90, 95, 99]);
 const empty = (): Values => ({data: new Float64Array(0), count: 0, ordered: 0});
 function create(outcomes: boolean, limit = LIMIT): Store {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > LIMIT) throw Error('The exact lead-time bound must be a whole number from 1 to ' + LIMIT + '.');
  return {limit, completed: 0, over: false, cycle: empty(), outcomes: outcomes ? {goal: empty(), lost: empty(), none: empty()} : null};
 }
 function push(values: Values, value: number, limit: number): void {
  if (values.count === values.data.length) {
   const grown = new Float64Array(Math.min(limit, Math.max(FIRST, values.data.length * 2)));
   grown.set(values.data);
   values.data = grown;
  }
  values.data[values.count++] = value;
 }
 function add(store: Store, minutes: number, outcome: 'goal' | 'lost' | null): void {
  store.completed++;
  if (store.over) return;
  if (store.completed > store.limit) {
   // Past the bound: release every kept value; brackets of the fine bins take over for the rest of the run.
   store.over = true;
   store.cycle = empty();
   if (store.outcomes) store.outcomes = {goal: empty(), lost: empty(), none: empty()};
   return;
  }
  push(store.cycle, minutes, store.limit);
  if (store.outcomes) push(store.outcomes[outcome ?? 'none'], minutes, store.limit);
 }
 /** The number of values in `data[0, end)` (ascending) that are at most `value`. */
 function upper(data: Float64Array, end: number, value: number): number {
  let low = 0, high = end;
  while (low < high) {
   const middle = (low + high) >> 1;
   if (data[middle]! <= value) low = middle + 1;
   else high = middle;
  }
  return low;
 }
 /**
  * The kept values in ascending order. The values added since the last read are sorted, then merged into the sorted prefix from the
  * back. A few new values (at most `FEW`) each find their place by binary search and move the larger prefix values up in one block
  * copy; more are merged element by element, so a read never costs more than one pass over the kept values plus the new ones' sort.
  */
 function ascending(values: Values): Float64Array {
  const data = values.data, end = values.count;
  if (values.ordered < end) {
   const tail = data.slice(values.ordered, end).sort();
   let prefix = values.ordered;
   if (tail.length <= FEW) {
    for (let j = tail.length - 1; j >= 0; j--) {
     const at = upper(data, prefix, tail[j]!);
     data.copyWithin(at + j + 1, at, prefix);
     data[at + j] = tail[j]!;
     prefix = at;
    }
   } else {
    let i = prefix - 1, j = tail.length - 1, w = end - 1;
    while (j >= 0) data[w--] = i >= 0 && data[i]! > tail[j]! ? data[i--]! : tail[j--]!;
   }
   values.ordered = end;
  }
  return data.subarray(0, end);
 }
 /** Nearest rank (1-based) of quantile q over n values. */
 const rank = (q: number, n: number) => Math.max(1, Math.ceil(q * n / 100));
 function bracket(counts: readonly number[], edges: readonly number[], need: number): [number, number | null] {
  let cum = 0, i = 0;
  for (; i < counts.length - 1; i++) {
   cum += counts[i]!;
   if (cum >= need) break;
  }
  return [edges[i]!, edges[i + 1] ?? null];
 }
 function percentiles(store: Store, values: Values, counts: readonly number[], edges: readonly number[]): LWProcess.Percentiles {
  if (!store.over) {
   const kept = ascending(values), n = kept.length;
   return {n, exact: true, points: n ? QUANTILES.map(q => ({q, exact: true as const, value: kept[rank(q, n) - 1]!})) : []};
  }
  const n = counts.reduce((a, b) => a + b, 0);
  return {n, exact: false, points: n ? QUANTILES.map(q => ({q, exact: false as const, bracket: bracket(counts, edges, rank(q, n))})) : []};
 }
 function read(store: Store, fine: {cycle: readonly number[]; outcomes: {goal: number[]; lost: number[]; none: number[]} | null},
  edges: readonly number[]): NonNullable<LWProcess.Distributions['percentiles']> {
  const o = store.outcomes, f = fine.outcomes;
  return {limit: store.limit, quantiles: [...QUANTILES], cycle: percentiles(store, store.cycle, fine.cycle, edges),
   ...o && f ? {byOutcome: {goal: percentiles(store, o.goal, f.goal, edges), lost: percentiles(store, o.lost, f.lost, edges),
    none: percentiles(store, o.none, f.none, edges)}} : {}};
 }
 const values = (store: Store) => store.over ? null : [...ascending(store.cycle)];
 root.LWProcessLedgerExact = {LIMIT, QUANTILES, create, add, read, values};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessLedgerExact;
})(globalThis);
