/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-ledger.ts" />
/// <reference path="./process-series.ts" />
/**
 * Saved engine state (LWProcessEngineState), owned by the process-definition context: the complete state of a paused run as one
 * detached, JSON-safe value (`capture`), and its exact reinstatement into a freshly built session state (`apply`). It is the
 * `snapshot` of a run checkpoint (LWProcessCheckpoint); untrusted values are checked by LWProcessCheckpointCheck before `apply`.
 *
 * What is saved (version 1):
 *  - Engine: the run options that key draws and caps (seed, active-case cap, retained finished cases), the clock, every pool's busy
 *    units and busy minutes, every station's counters, the cases and tokens in the world (active cases and the retained finished
 *    ones), the bounded event and receipt histories, the arrival stream cursors, the retirement queue, the per-case visit counters,
 *    multi-instance groups, pending outcomes, journey bookkeeping and the tracked-field aggregates.
 *  - Read model, in full: the run ledger (per-step starts and costs, minutes by status, failures by step, WIP area, the cycle
 *    histogram, the fine distributions, the per-case books of cases in progress, the completed/failed aggregates and the recent ring),
 *    the exact lead-time store (LWProcessLedgerExact: its bound, completed count, whether it passed the bound and released its
 *    values, and the kept values of the whole run and per outcome in their stored order with the length of their sorted prefix)
 *    and the sampled series (level, samples, the last observed frame and the open interval's peaks).
 *
 * Read-model decision: measurements are carried, not restarted. Every read-model structure is bounded (the series by its
 * 400,000-value budget, the books by the active-case cap, the ring by the retained count, the distributions by 54 bins per
 * column), so the checkpoint includes them, and a restored run continued to minute M equals an uninterrupted run to M exactly:
 * the same snapshot, the same events after the restore, the same series, distributions and recent cases. Nothing is fabricated:
 * every value is a copy of what the run measured. Derived values are rebuilt instead of saved: the ledger's running pool cost per
 * minute of each step and each case follows from the active tokens (each holds its step's pool units), and caches (token and pool
 * lists, the token profile, the series' station and pool references) are rebuilt on first use.
 *
 * Engine caches (LWProcessKernel, LWProcessRouting, LWProcessSystems) are never saved and never restored. `apply` adds the tokens
 * through LWProcessKernel.createToken in id order, so the kernel's live-token index is either still absent (it is then built from
 * the world on first read) or kept current token by token; the cached token list is dropped. The join plan and the re-ranked work
 * steps depend only on the definition and are derived on first use from the fresh state, so none can be stale.
 *
 * A run can be saved only between clock commands: no clock-step failure or escalation may be pending (both are applied by the
 * settle that ends every command). Nothing here reads a clock, ticks, or touches storage.
 */
declare namespace LWProcessEngineState {
 type Pairs<T> = [string, T][];
 interface Book { lead: number[]; cost: number; repeats: number; }
 interface Ledger {
  steps: LWProcess.StepCosts[]; cycles: number[]; minutesBy: number[]; failedAt: number[]; wipArea: number;
  fine: {cycle: number[]; failed: number[]; outcomes: {goal: number[]; lost: number[]; none: number[]} | null; steps: number[][][]};
  books: Pairs<Book>; leadTime: number[]; flow: number[]; completedCost: number; failedCost: number; failedMinutes: number;
  firstPass: number; repeats: number[]; ring: LWProcess.FinishedCase[]; head: number; exact: Exact;
 }
 /** `every` and `points` are the series options the run was created with; `level` and `count` say where decimation stands. */
 interface Series { every: number; points: number; level: number; count: number; data: number[]; previous: number[]; peaks: number[]; }
 /** Kept exact lead times in their stored order; the first `ordered` are ascending. */
 interface ExactValues { values: number[]; ordered: number; }
 interface Exact {
  limit: number; completed: number; over: boolean; cycle: ExactValues; outcomes: {goal: ExactValues; lost: ExactValues; none: ExactValues} | null;
 }
 interface Saved {
  seed: number; active: number; retained: number; clock: LWProcess.Clock;
  pools: {id: string; busy: number; busyMinutes: number}[]; stations: LWProcess.Station[];
  cases: LWProcess.Case[]; tokens: LWProcess.Token[]; events: LWProcess.Event[]; receipts: LWProcess.Receipt[]; receiptsDropped: number;
  streams: {k: number; at: number | null}[]; finished: string[]; visits: Pairs<Pairs<number>>; groups: LWProcess.Group[];
  outcomes: Pairs<'goal' | 'lost'>; seen: Pairs<string[]>; finishAgg: Pairs<LWProcess.Aggregate>; entryAgg: Pairs<LWProcess.Aggregate>;
  ledger: Ledger; series: Series | null;
 }
 interface Api {
  /** A detached copy of the complete run state; throws while a clock command's work is still pending. */
  capture(s: LWProcess.State, series: LWProcessSeries.Store | null): Saved;
  /**
   * Reinstates `saved` into `s`, a state just built from the same definition and options with nothing admitted yet (no case, token,
   * event or settle), and into `series`, a fresh store with the saved options. `saved` must already be checked against the definition.
   */
  apply(s: LWProcess.State, series: LWProcessSeries.Store | null, saved: Saved): void;
 }
}
declare namespace LWProcess {
 interface Session {
  /** The complete detached run state (LWProcessEngineState.Saved), the snapshot of a run checkpoint. Never ticks; allowed between commands. */
  state(): LWProcessEngineState.Saved;
 }
 interface RunOptions {
  /**
   * Continue a saved run (LWProcessEngineState.Saved, untrusted; checked against the definition first) instead of starting at minute 0.
   * Its seed, case caps and series options are used, so `seed`, `active`, `retained` and `series` must be left out. Nothing is
   * admitted or settled on creation, so the event sink sees only the events of later clock commands.
   */
  restore?: unknown;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 type Saved = LWProcessEngineState.Saved;
 const root = inputRoot as {LWProcessKernel: LWProcessKernel.Api; LWProcessLedgerExact: LWProcessLedgerExact.Api;
  LWProcessEngineState?: LWProcessEngineState.Api};
 const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
 const pairs = <T, U>(map: Map<string, T>, value: (v: T) => U): [string, U][] => [...map].map(([k, v]) => [k, value(v)]);
 const fill = (target: number[], source: readonly number[]) => { for (let i = 0; i < target.length; i++) target[i] = source[i]!; };
 const valuesOf = (v: LWProcessLedgerExact.Values) => ({values: Array.from(v.data.subarray(0, v.count)), ordered: v.ordered});
 function exactOf(e: LWProcessLedgerExact.Store): LWProcessEngineState.Exact {
  const o = e.outcomes;
  return {limit: e.limit, completed: e.completed, over: e.over, cycle: valuesOf(e.cycle),
   outcomes: o ? {goal: valuesOf(o.goal), lost: valuesOf(o.lost), none: valuesOf(o.none)} : null};
 }
 /** A fresh exact store holding the saved values in their order; its capacity (at least the values, at most the bound) changes no value. */
 function exactFrom(saved: LWProcessEngineState.Exact): LWProcessLedgerExact.Store {
  const store = root.LWProcessLedgerExact.create(saved.outcomes !== null, saved.limit), FIRST = 64;
  const fill = (v: LWProcessEngineState.ExactValues): LWProcessLedgerExact.Values => {
   const data = new Float64Array(v.values.length ? Math.min(saved.limit, Math.max(FIRST, v.values.length)) : 0);
   data.set(v.values);
   return {data, count: v.values.length, ordered: v.ordered};
  };
  store.completed = saved.completed;
  store.over = saved.over;
  store.cycle = fill(saved.cycle);
  if (saved.outcomes) store.outcomes = {goal: fill(saved.outcomes.goal), lost: fill(saved.outcomes.lost), none: fill(saved.outcomes.none)};
  return store;
 }
 function ledgerOf(s: LWProcess.State): LWProcessEngineState.Ledger {
  const l = s.ledger!, c = l.cases, f = l.fine;
  return {steps: l.stepCosts.map(v => ({starts: v.starts, fixedCost: v.fixedCost, workCost: v.workCost})), cycles: [...l.cycles],
   minutesBy: [...l.minutesBy], failedAt: [...l.failedAt], wipArea: l.wipArea,
   fine: {cycle: [...f.cycle], failed: [...f.failed], outcomes: f.outcomes ? copy(f.outcomes) : null, steps: copy(f.steps)},
   books: pairs(c.books, b => ({lead: [...b.lead], cost: b.cost, repeats: b.repeats})), leadTime: [...c.leadTime], flow: [...c.flow],
   completedCost: c.completedCost, failedCost: c.failedCost, failedMinutes: c.failedMinutes, firstPass: c.firstPass, repeats: [...c.repeats],
   ring: copy(c.ring), head: c.head, exact: exactOf(l.exact)};
 }
 function seriesOf(store: LWProcessSeries.Store): LWProcessEngineState.Series {
  return {every: store.base, points: store.requested, level: store.level, count: store.count,
   data: Array.from(store.data.subarray(0, store.count * store.width)), previous: Array.from(store.previous!), peaks: Array.from(store.peaks)};
 }
 function capture(s: LWProcess.State, series: LWProcessSeries.Store | null): Saved {
  if (s.failures.length || s.spawns.length) throw Error('A run can be saved only between clock commands.');
  const world = s.world, k = root.LWProcessKernel;
  return copy({seed: s.seed, active: s.active, retained: s.retained, clock: s.clock,
   pools: s.definition.resources.map(r => ({id: r.id, busy: k.pool(s, r.id).busy, busyMinutes: k.pool(s, r.id).busyMinutes})),
   stations: s.definition.steps.map(step => k.station(s, step.id)),
   cases: world.query(['process-case']).map(id => world.get<LWProcess.Case>(id, 'process-case')!), tokens: k.tokens(s),
   events: s.events, receipts: s.receipts, receiptsDropped: s.receiptsDropped, streams: s.streams.map(st => ({k: st.k, at: st.at})),
   finished: s.finished, visits: pairs(s.visits, steps => [...steps]), groups: [...s.groups.values()], outcomes: [...s.outcomes],
   seen: pairs(s.seen, steps => [...steps]), finishAgg: [...s.finishAgg], entryAgg: [...s.entryAgg],
   ledger: ledgerOf(s), series: series ? seriesOf(series) : null});
 }
 /** The ledger's saved values; the running pool cost per minute (per step and per case book) follows from the active tokens. */
 function applyLedger(s: LWProcess.State, saved: LWProcessEngineState.Ledger): void {
  const l = s.ledger!, c = l.cases, f = l.fine;
  saved.steps.forEach((v, i) => Object.assign(l.stepCosts[i]!, v));
  fill(l.cycles, saved.cycles); fill(l.minutesBy, saved.minutesBy); fill(l.failedAt, saved.failedAt);
  l.wipArea = saved.wipArea;
  fill(f.cycle, saved.fine.cycle); fill(f.failed, saved.fine.failed);
  if (f.outcomes && saved.fine.outcomes) for (const key of ['goal', 'lost', 'none'] as const) fill(f.outcomes[key], saved.fine.outcomes[key]);
  f.steps.forEach((columns, i) => columns.forEach((column, j) => fill(column, saved.fine.steps[i]![j]!)));
  for (const [id, book] of saved.books) c.books.set(id, {lead: [...book.lead], cost: book.cost, rate: 0, repeats: book.repeats});
  for (const t of root.LWProcessKernel.tokens(s)) {
   const unit = t.status === 'active' ? l.unit.get(t.stepId) : undefined;
   if (!unit) continue;
   l.rate.set(t.stepId, (l.rate.get(t.stepId) ?? 0) + unit);
   const book = c.books.get(t.caseId)!;
   book.rate += unit;
   c.running.add(book);
  }
  fill(c.leadTime, saved.leadTime); fill(c.flow, saved.flow); fill(c.repeats, saved.repeats);
  Object.assign(c, {completedCost: saved.completedCost, failedCost: saved.failedCost, failedMinutes: saved.failedMinutes, firstPass: saved.firstPass,
   ring: copy(saved.ring), head: saved.head});
  l.exact = exactFrom(saved.exact);
  l.profile = null;
 }
 function applySeries(store: LWProcessSeries.Store, saved: LWProcessEngineState.Series): void {
  const w = store.width, rows = Math.min(store.points, Math.max(64, saved.count));
  store.level = saved.level;
  store.every = store.base * 2 ** saved.level;
  store.count = saved.count;
  store.data = new Float64Array(rows * w);
  store.data.set(saved.data);
  store.previous = Float64Array.from(saved.previous);
  store.live = new Float64Array(w + 1);
  store.peaks = Float64Array.from(saved.peaks);
  store.stations = null;
  store.poolState = null;
 }
 function apply(s: LWProcess.State, series: LWProcessSeries.Store | null, saved: Saved): void {
  const world = s.world, k = root.LWProcessKernel;
  Object.assign(s.clock, copy(saved.clock));
  saved.pools.forEach(p => Object.assign(k.pool(s, p.id), {busy: p.busy, busyMinutes: p.busyMinutes}));
  for (const station of saved.stations) Object.assign(k.station(s, station.id), copy(station));
  for (const c of saved.cases) world.set(world.create(c.id), 'process-case', copy(c));
  // Through the kernel, in id order, so its live-token index is kept current (or built later from the world), never stale.
  for (const t of [...saved.tokens].sort((a, b) => k.compare(a.id, b.id))) k.createToken(s, copy(t));
  s.tokenList = null;
  s.poolList = null;
  s.events.push(...copy(saved.events));
  s.receipts.push(...copy(saved.receipts));
  s.receiptsDropped = saved.receiptsDropped;
  saved.streams.forEach((cursor, i) => Object.assign(s.streams[i]!, {k: cursor.k, at: cursor.at}));
  s.finished.push(...saved.finished);
  for (const [id, steps] of saved.visits) s.visits.set(id, new Map(steps));
  for (const group of saved.groups) s.groups.set(group.id, copy(group));
  for (const [id, outcome] of saved.outcomes) s.outcomes.set(id, outcome);
  for (const [id, steps] of saved.seen) s.seen.set(id, new Set(steps));
  for (const [key, a] of saved.finishAgg) s.finishAgg.set(key, {...a});
  for (const [key, a] of saved.entryAgg) s.entryAgg.set(key, {...a});
  applyLedger(s, saved.ledger);
  if (series && saved.series) applySeries(series, saved.series);
 }
 root.LWProcessEngineState = {capture, apply};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessEngineState;
})(globalThis);
