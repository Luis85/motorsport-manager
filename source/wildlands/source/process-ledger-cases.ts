/// <reference path="./process-contracts.d.ts" />
/**
 * Per-case run books (LWProcessLedgerCases), owned by the process-definition context and driven only by LWProcessLedger: the
 * read-model bookkeeping of each case in progress, folded into exact run aggregates when the case completes or fails.
 *
 * - Book of a case in progress: minutes by its dominant state (`lead`, six buckets in priority order working, waiting, blocked,
 *   backlog, timer, joining), its attributed work cost (fixed cost at each start plus the pool cost per minute of its running work,
 *   `rate`) and its repeat entries at non-join steps. A book is created lazily, folded at completion or failure and deleted when
 *   the kernel retires the case, so live books never exceed the active-case cap (at most 500; 9 numbers each).
 * - Run aggregates: `leadTime` (completed cases' lead minutes by dominant state, summing to the run's cycle sum), the flow
 *   efficiency bins, `costOf` completed and failed, the failed cases' lifetime sum, first-pass cases and the repeat bins. Fixed size.
 * - Recent ring: the latest `retained` finished or failed cases as `FinishedCase` values (oldest dropped first).
 *
 * Dominant-state convention: a case's state for a charged minute is the highest-priority status among its tokens at the end of the
 * previous minute (if any branch is being worked, the case is being worked). Flow efficiency bins `floor(10 × working / lead)`,
 * clamped to 9; a zero-length case falls in bin 9 by definition. Everything is integer arithmetic, never read by the engine, a
 * fingerprint, a random key or a decision, and independent of pruning and of how a run is chunked.
 *
 * Working hours: only a store created with `closed` keeps a seventh lead bucket, `closed` (minutes outside working time, booked by
 * `closed` for every live case whatever its state; its books' and run lead lists then have 7 entries, else 6), and `totals` reports
 * it in `leadTime`; without it the six buckets are reported exactly as before. Lead minutes then still sum to the cycle sum, and
 * flow efficiency divides working by the whole lead time.
 */
declare namespace LWProcessLedgerCases {
 interface Book { lead: number[]; cost: number; rate: number; repeats: number; }
 interface Store {
  books: Map<string, Book>; running: Set<Book>; hours: boolean;
  leadTime: number[]; flow: number[]; completedCost: number; failedCost: number; failedMinutes: number; firstPass: number; repeats: number[];
  ring: LWProcess.FinishedCase[]; head: number; capacity: number;
 }
 interface Totals {
  leadTime: LWProcess.MinutesBy; flowEfficiency: {counts: number[]}; costOf: {completed: number; failed: number}; failedMinutes: number;
  firstPass: number; repeats: {counts: number[]};
 }
 interface Api {
  /** `retained` is the capacity of the recent ring (the session's retained finished cases); `closed` adds the closed lead bucket. */
  create(retained: number, closed?: boolean): Store;
  book(store: Store, caseId: string): Book;
  started(store: Store, caseId: string, fixed: number, perMinute: number): void;
  released(store: Store, caseId: string, perMinute: number): void;
  /** Charges `minutes` to each listed book's bucket and the running work's pool cost to its case. */
  charge(store: Store, books: readonly Book[], buckets: readonly number[], minutes: number): void;
  /** Books `minutes` outside working hours to each listed book's closed lead minutes; no cost accrues. */
  closed(store: Store, books: readonly Book[], minutes: number): void;
  repeated(store: Store, caseId: string): void;
  completed(store: Store, c: LWProcess.Case, end: string, outcome: 'goal' | 'lost' | null): void;
  failed(store: Store, c: LWProcess.Case): void;
  retired(store: Store, caseId: string): void;
  totals(store: Store): Totals;
  recent(store: Store): LWProcess.FinishedCase[];
 }
}
(function(inputRoot: unknown) {
 'use strict';
 type Store = LWProcessLedgerCases.Store; type Book = LWProcessLedgerCases.Book;
 const root = inputRoot as {LWProcessLedgerCases?: LWProcessLedgerCases.Api};
 const WORKING = 0, CLOSED = 6, REPEAT_BINS = 6, FLOW_BINS = 10;
 const create = (retained: number, closed = false): Store => ({books: new Map(), running: new Set(), hours: closed,
  leadTime: Array(closed ? 7 : 6).fill(0), flow: Array(FLOW_BINS).fill(0),
  completedCost: 0, failedCost: 0, failedMinutes: 0, firstPass: 0, repeats: Array(REPEAT_BINS).fill(0), ring: [], head: 0, capacity: retained});
 function book(store: Store, caseId: string): Book {
  let entry = store.books.get(caseId);
  if (!entry) {
   entry = {lead: Array(store.hours ? 7 : 6).fill(0), cost: 0, rate: 0, repeats: 0};
   store.books.set(caseId, entry);
  }
  return entry;
 }
 function started(store: Store, caseId: string, fixed: number, perMinute: number): void {
  const entry = book(store, caseId);
  entry.cost += fixed;
  if (!perMinute) return;
  entry.rate += perMinute;
  store.running.add(entry);
 }
 function released(store: Store, caseId: string, perMinute: number): void {
  const entry = store.books.get(caseId);
  if (!entry || !perMinute) return;
  entry.rate -= perMinute;
  if (!entry.rate) store.running.delete(entry);
 }
 function charge(store: Store, books: readonly Book[], buckets: readonly number[], minutes: number): void {
  for (let i = 0; i < books.length; i++) books[i]!.lead[buckets[i]!]! += minutes;
  for (const entry of store.running) entry.cost += entry.rate * minutes;
 }
 function closed(_store: Store, books: readonly Book[], minutes: number): void {
  for (const entry of books) entry.lead[CLOSED]! += minutes;
 }
 const repeated = (store: Store, caseId: string) => { book(store, caseId).repeats++; };
 /** Flow efficiency bin of `working` minutes out of `lead`, in exact integer steps: the largest i ≤ 9 with i × lead ≤ 10 × working. */
 function flowBin(working: number, lead: number): number {
  if (!lead) return FLOW_BINS - 1;
  let bin = 0;
  while (bin < FLOW_BINS - 1 && (bin + 1) * lead <= 10 * working) bin++;
  return bin;
 }
 function remember(store: Store, entry: LWProcess.FinishedCase): void {
  if (store.ring.length < store.capacity) {
   store.ring.push(entry);
   return;
  }
  store.ring[store.head] = entry;
  store.head = (store.head + 1) % store.capacity;
 }
 function completed(store: Store, c: LWProcess.Case, end: string, outcome: 'goal' | 'lost' | null): void {
  const entry = book(store, c.id), lead = c.finished! - c.entered;
  entry.lead.forEach((minutes, i) => { store.leadTime[i]! += minutes; });
  store.flow[flowBin(entry.lead[WORKING]!, lead)]!++;
  store.completedCost += entry.cost;
  store.repeats[Math.min(entry.repeats, REPEAT_BINS - 1)]!++;
  if (!entry.repeats) store.firstPass++;
  remember(store, {caseId: c.id, entered: c.entered, finished: c.finished!, status: 'completed', end, outcome, repeats: entry.repeats,
   working: entry.lead[WORKING]!});
 }
 function failed(store: Store, c: LWProcess.Case): void {
  const entry = book(store, c.id);
  store.failedCost += entry.cost;
  store.failedMinutes += c.finished! - c.entered;
  remember(store, {caseId: c.id, entered: c.entered, finished: c.finished!, status: 'failed', end: null, outcome: null, repeats: entry.repeats,
   working: null});
 }
 function retired(store: Store, caseId: string): void {
  const entry = store.books.get(caseId);
  if (entry) store.running.delete(entry);
  store.books.delete(caseId);
 }
 const totals = (store: Store): LWProcessLedgerCases.Totals => {
  const [working, waiting, blocked, backlog, timer, joining, closed] = store.leadTime as [number, number, number, number, number, number, number];
  return {leadTime: {working, waiting, blocked, backlog, timer, joining, ...store.hours ? {closed} : {}}, flowEfficiency: {counts: [...store.flow]},
   costOf: {completed: store.completedCost, failed: store.failedCost}, failedMinutes: store.failedMinutes, firstPass: store.firstPass,
   repeats: {counts: [...store.repeats]}};
 };
 const recent = (store: Store) => [...store.ring.slice(store.head), ...store.ring.slice(0, store.head)].map(entry => ({...entry}));
 root.LWProcessLedgerCases = {create, book, started, released, charge, closed, repeated, completed, failed, retired, totals, recent};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessLedgerCases;
})(globalThis);
