/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-ledger.ts" />
/// <reference path="./process-kernel.ts" />
/**
 * Sampled run time series (LWProcessSeries), owned by the process-definition context: a read-model store that the session feeds
 * after every settle and reads detached. It never feeds the engine, a fingerprint, a random key or a decision.
 *
 * Grid and values: samples sit at grid minutes g ≡ 0 (mod every), every = base × 2^level. A sample records the end-of-minute state
 * of g (after work, admission and settle): gauges (cases in progress, tokens per step by status, pool units busy), cumulative
 * event counts (arrived, completed, ..., starts, entries, wait minutes, cycle sum) and cumulative minute-charged totals (WIP area,
 * work cost, waiting and blocked token-minutes, busy minutes), plus interval peaks (largest end-of-minute WIP and waiting count in
 * (g − every, g]).
 *
 * Observations and the fill rule: `observe` runs after create's settle (minute 0) and after each advance loop iteration. Between
 * two observations p < m nothing changes status, and every minute p+1 … m is charged with the state of p. So for a quiet grid point
 * p < g < m: gauges and event counts are those of p, minute-charged totals are C(p) + R(p) × (g − p) with R(p) the per-minute rates
 * implied by the gauges of p (and the pools' cost per minute for work cost), and quiet minutes contribute the gauges of p to peaks.
 * The result depends only on the end-of-minute state sequence, so it is identical however the run is chunked.
 *
 * Decimation: the store holds at most K samples. Before filling up to minute m the level rises while floor(m / every) + 1 > K:
 * `every` doubles, only samples on the new grid stay, and each kept sample's peak merges (max) with the dropped one before it; a
 * dropped last sample merges into the open interval. The level is therefore the smallest one whose grid up to the last observed
 * minute fits in K samples: a function of that minute only, never of chunking, and the whole run stays covered from minute 0.
 *
 * Bounds: K = min(points, floor(400,000 / perSample)), perSample = 12 + 11 × steps + 2 × pools values (the schema's 128 steps and
 * 32 pools give perSample 1,484 and K 269), so the store never holds more than 400,000 values (3.2 MB as Float64Array); typical
 * processes (12 steps, 4 pools) hold 152 values per sample, about 0.6 MB at K = 480. Storage grows by doubling up to K rows.
 * Per observation the cost is O(perSample) plus the ledger's token profile, which the next charges reuse.
 *
 * Working hours: the clock stops at every opening and closing (LWProcessSystems), so the minutes between two observations share
 * one openness, that of the earlier one. A frame records it (slot `width + 1`), and the fill of a closed interval grows only the
 * WIP area: work cost, waiting and blocked token-minutes and busy minutes charge nothing while closed (their closed minutes are the
 * ledger's `closed` books). Without working hours the flag is always open and every value is the one from before the field existed.
 */
declare namespace LWProcessSeries {
 interface Store {
  steps: string[]; pools: string[]; costs: number[]; base: number; every: number; level: number; points: number; requested: number;
  width: number; kinds: Int8Array; sources: Int32Array; peakColumns: number[]; data: Float64Array; count: number;
  previous: Float64Array | null; live: Float64Array; peaks: Float64Array;
  stations: LWProcess.Station[] | null; poolState: LWProcess.Pool[] | null;
 }
 interface Api {
  /** Values a store may hold at most. */
  readonly BUDGET: number;
  /** Validates `options` (`every` whole 1..10,000, default 60; `points` whole 64..960, default 480). */
  create(definition: LWProcess.Definition, options?: {every?: number; points?: number}): Store;
  /** Records the settled state of `s` at its current minute (and fills the quiet grid points since the last observation). */
  observe(store: Store, s: LWProcess.State): void;
  /** Detached columns: everything, or only samples from `after.count` while `after.level` is still current. */
  read(store: Store, after?: LWProcess.SeriesCursor): LWProcess.Series;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 type Store = LWProcessSeries.Store;
 const root = inputRoot as {LWProcessLedger: LWProcessLedger.Api; LWProcessKernel: LWProcessKernel.Api;
  LWProcessHours: LWProcessHours.Api; LWProcessSeries?: LWProcessSeries.Api};
 const BUDGET = 400000, RUN = 12, STEP = 11, POOL = 2;
 /** Column kinds: the sample minute, a gauge, an event count (held over quiet minutes), a minute-charged total, an interval peak. */
 const MINUTE = 0, GAUGE = 1, EVENT = 2, CHARGED = 3, PEAK = 4;
 /** The run block's WIP area: the one minute-charged total that also grows outside working hours. */
 const WIP_AREA = 10;
 const RUN_NAMES = ['wip', 'wipPeak', 'arrived', 'completed', 'failed', 'dropped', 'goals', 'lost', 'cycleSum', 'wipArea', 'cost'] as const;
 const STEP_NAMES = ['waiting', 'working', 'blocked', 'timers', 'waitingPeak', 'starts', 'completed', 'entered', 'waitMinutes', 'waitingArea',
  'blockedArea'] as const;
 const whole = (value: unknown, min: number, max: number) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
 function create(definition: LWProcess.Definition, options: {every?: number; points?: number} = {}): Store {
  if (options === null || typeof options !== 'object') throw Error('Series options must be false or an object with every and points.');
  const every = options.every ?? 60, requested = options.points ?? 480;
  if (!whole(every, 1, 10000)) throw Error('Series spacing (every) must be a whole number of minutes from 1 to 10000.');
  if (!whole(requested, 64, 960)) throw Error('Series points must be a whole number from 64 to 960.');
  const steps = definition.steps.map(s => s.id), pools = definition.resources.map(r => r.id), width = RUN + STEP * steps.length + POOL * pools.length;
  // Column layout: the run block, one block per step, one block per pool. The extra slot `width` carries the work cost per minute.
  const kinds = new Int8Array(width), sources = new Int32Array(width);
  const set = (column: number, kind: number, source = 0) => { kinds[column] = kind; sources[column] = source; };
  set(0, MINUTE); set(1, GAUGE); set(2, PEAK, 1);
  for (let c = 3; c <= 9; c++) set(c, EVENT);
  set(10, CHARGED, 1); set(11, CHARGED, width);
  steps.forEach((_, i) => {
   const at = RUN + STEP * i;
   for (let c = 0; c < 4; c++) set(at + c, GAUGE);
   set(at + 4, PEAK, at);
   for (let c = 5; c < 9; c++) set(at + c, EVENT);
   set(at + 9, CHARGED, at); set(at + 10, CHARGED, at + 2);
  });
  pools.forEach((_, i) => {
   const at = RUN + STEP * steps.length + POOL * i;
   set(at, GAUGE); set(at + 1, CHARGED, at);
  });
  const points = Math.min(requested, Math.floor(BUDGET / width)), peakColumns = [...kinds.keys()].filter(c => kinds[c] === PEAK);
  return {steps, pools, costs: definition.resources.map(r => r.costPerMinute), base: every, every, level: 0, points, requested, width, kinds, sources,
   peakColumns, data: new Float64Array(Math.min(points, 64) * width), count: 0, previous: null, live: new Float64Array(width + 2),
   peaks: new Float64Array(width).fill(-1), stations: null, poolState: null};
 }
 /** Writes the settled state of `s` into `frame` (slot `width` holds the pools' work cost per minute, `width + 1` 1 when open, else 0). */
 function capture(store: Store, s: LWProcess.State, frame: Float64Array): void {
  const ledger = s.ledger!, clock = s.clock, counts = root.LWProcessLedger.profile(ledger, root.LWProcessKernel.tokens(s)).counts;
  store.stations ??= store.steps.map(id => root.LWProcessKernel.station(s, id));
  store.poolState ??= store.pools.map(id => root.LWProcessKernel.pool(s, id));
  const wip = clock.arrived - clock.completed - clock.failed, run = [clock.minute, wip, wip, clock.arrived, clock.completed, clock.failed,
   clock.dropped, clock.goals, clock.lost, clock.cycle, ledger.wipArea, clock.cost];
  for (let c = 0; c < RUN; c++) frame[c] = run[c]!;
  const by = root.LWProcessLedger.BUCKETS.length, area = ledger.minutesBy;
  for (let i = 0; i < store.stations.length; i++) {
   const at = RUN + STEP * i, k = i * by, station = store.stations[i]!;
   // Buckets are ordered working, waiting, blocked, backlog, timer, joining (LWProcessLedger.BUCKETS).
   frame[at] = counts[k + 1]!;
   frame[at + 1] = counts[k]!;
   frame[at + 2] = counts[k + 2]!;
   frame[at + 3] = counts[k + 4]!;
   frame[at + 4] = counts[k + 1]!;
   frame[at + 5] = ledger.stepCosts[i]!.starts;
   frame[at + 6] = station.completed;
   frame[at + 7] = station.visits;
   frame[at + 8] = station.waitMinutes;
   frame[at + 9] = area[k + 1]!;
   frame[at + 10] = area[k + 2]!;
  }
  let costRate = 0;
  store.poolState.forEach((pool, i) => {
   const at = RUN + STEP * store.steps.length + POOL * i;
   frame[at] = pool.busy;
   frame[at + 1] = pool.busyMinutes;
   costRate += pool.busy * store.costs[i]!;
  });
  frame[store.width] = costRate;
  const hours = s.definition.workingHours;
  frame[store.width + 1] = hours && !root.LWProcessHours.open(hours, clock.minute) ? 0 : 1;
 }
 /** Folds a frame's gauges into the open interval's peaks. */
 function fold(store: Store, frame: Float64Array): void {
  for (const c of store.peakColumns) store.peaks[c] = Math.max(store.peaks[c]!, frame[store.sources[c]!]!);
 }
 /** Appends the sample at grid minute `g` from `frame` (observed at minute `from`) and closes the open interval. */
 function record(store: Store, g: number, frame: Float64Array, from: number): void {
  const w = store.width;
  if ((store.count + 1) * w > store.data.length) {
   const grown = new Float64Array(Math.min(store.points, store.data.length / w * 2) * w);
   grown.set(store.data);
   store.data = grown;
  }
  const row = store.count * w, data = store.data, open = frame[w + 1] === 1;
  for (let c = 0; c < w; c++) {
   const kind = store.kinds[c];
   if (kind === MINUTE) data[row + c] = g;
   else if (kind === CHARGED) data[row + c] = frame[c]! + (open || c === WIP_AREA ? frame[store.sources[c]!]! * (g - from) : 0);
   else if (kind === PEAK) data[row + c] = store.peaks[c]!;
   else data[row + c] = frame[c]!;
  }
  store.count++;
  store.peaks.fill(-1);
 }
 /** One level up: every doubles; kept samples merge the peak of the dropped sample before them; a dropped last one joins the open interval. */
 function decimate(store: Store): void {
  const w = store.width, data = store.data, carried = new Float64Array(w);
  let kept = 0;
  for (let i = 0; i < store.count; i += 2) {
   if (i > 0) carried.set(data.subarray((i - 1) * w, i * w));
   data.copyWithin(kept * w, i * w, (i + 1) * w);
   if (i > 0) for (const c of store.peakColumns) data[kept * w + c] = Math.max(data[kept * w + c]!, carried[c]!);
   kept++;
  }
  // The dropped last row (an odd index) lies beyond every kept row, so the copies above never overwrote it.
  const last = (store.count - 1) * w;
  if (store.count % 2 === 0) for (const c of store.peakColumns) store.peaks[c] = Math.max(store.peaks[c]!, data[last + c]!);
  store.count = kept;
  store.every *= 2;
  store.level++;
 }
 function observe(store: Store, s: LWProcess.State): void {
  const live = store.live, previous = store.previous, m = s.clock.minute;
  if (previous && m <= previous[0]!) return;
  capture(store, s, live);
  if (previous) {
   const p = previous[0]!;
   while (Math.floor(m / store.every) + 1 > store.points) decimate(store);
   let g = (Math.floor(p / store.every) + 1) * store.every;
   for (; g < m; g += store.every) {
    fold(store, previous);
    record(store, g, previous, p);
   }
   const before = Math.floor((m - 1) / store.every) * store.every;
   if (Math.max(p, before) + 1 < m) fold(store, previous);
  }
  fold(store, live);
  if (m % store.every === 0) record(store, m, live, m);
  store.live = previous ?? new Float64Array(store.width + 2);
  store.previous = live;
 }
 function read(store: Store, after?: LWProcess.SeriesCursor): LWProcess.Series {
  if (after !== undefined && (after === null || typeof after !== 'object' || !whole(after.level, 0, 64) || !whole(after.count, 0, Number.MAX_SAFE_INTEGER))) {
   throw Error('A series cursor needs a whole level and count.');
  }
  const offset = after && after.level === store.level ? Math.min(after.count, store.count) : 0, w = store.width;
  const column = (c: number) => Array.from({length: store.count - offset}, (_, i) => store.data[(offset + i) * w + c]!);
  const block = <K extends string>(names: readonly K[], at: number) =>
   Object.fromEntries(names.map((name, i) => [name, column(at + i)])) as Record<K, number[]>;
  return {base: store.base, every: store.every, level: store.level, points: store.points, perSample: w, count: store.count, offset, minutes: column(0),
   run: block(RUN_NAMES, 1), steps: Object.fromEntries(store.steps.map((id, i) => [id, block(STEP_NAMES, RUN + STEP * i)])),
   pools: Object.fromEntries(store.pools.map((id, i) => [id, block(['busy', 'busyMinutes'] as const, RUN + STEP * store.steps.length + POOL * i)]))};
 }
 root.LWProcessSeries = {BUDGET, create, observe, read};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessSeries;
})(globalThis);
