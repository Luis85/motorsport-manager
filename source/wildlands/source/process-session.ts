/// <reference path="./process-contracts.d.ts" />
/**
 * Application-owned ECS session (LWProcessRuntime): explicit bounded clock commands and detached read models.
 *
 * Read-model values (capacity cost, mean age, mean wait per visit, throughput, per-pool and per-step cost, the cycle histogram) are
 * computed from exact running aggregates when a snapshot is built; they never feed the engine, a fingerprint or a decision.
 *
 * Additional read-model values (LWProcessLedger): per step `minutesBy` and `failed`; run `wipArea`, `cycleSum`, `leadTime`,
 * `flowEfficiency`, `costOf`, `failedMinutes`, `firstPass` and `repeats`. The larger structures stay out of `query()`, which views
 * call on every pulse: `series(after?)` (LWProcessSeries; option `series`, `false` turns it off), `distributions()` and `recent()`
 * are separate detached reads. Like `query()` they never tick and are refused while a clock command runs.
 *
 * Event sink: `create(definition, {onEvent})` streams every engine event in order as a detached plain value, starting with the
 * events of minute 0 that `create` itself settles. The sink runs inside a clock command, so it may not call the session (query,
 * advance, setHorizon or dispose throw while a command runs). A sink that throws aborts the command and stops the session:
 * later calls throw, and the caller should dispose it and start a new run.
 *
 * Checkpoints (LWProcessEngineState, LWProcessCheckpoint): `state()` returns the complete detached run state between commands and
 * never ticks; `create(definition, {restore})` continues such a state (checked first by LWProcessCheckpointCheck) instead of starting
 * at minute 0, with its own seed, case caps and series options, and admits or settles nothing on creation.
 */
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWECS: LWProcess.Ecs; LWProcessCatalog: LWProcess.Catalog; LWProcessSystems: LWProcess.Systems; LWProcessLimits: LWProcess.Limits;
  LWProcessLedger: LWProcessLedger.Api; LWProcessSeries: LWProcessSeries.Api; LWProcessRuntime?: LWProcess.Runtime;
  LWProcessEngineState: LWProcessEngineState.Api; LWProcessCheckpointCheck: LWProcessCheckpointCheck.Api};
 const limits = root.LWProcessLimits;
 const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
 // Largest seed (a positive 31-bit integer) and the most finished cases a caller may ask a session to keep in detail.
 const MAX_SEED = 2147483647, MAX_RETAINED = 10000;
 const checkHorizon = (value: number | null): number | null => {
  if (value !== null && (!Number.isSafeInteger(value) || value < 1)) throw Error('Run horizon must be a whole number of minutes (1 or more) or unlimited.');
  return value;
 };
 // Means are rounded to 3 decimals.
 const round3 = (value: number) => Math.round(value * 1000) / 1000;
 /** An empty aggregate has no mean. */
 const mean = (a: LWProcess.Aggregate | undefined) => a ? round3(a.sum / a.n) : null;
 function create(input: unknown, options: LWProcess.RunOptions = {}): LWProcess.Session {
  let horizon = options.horizon === undefined ? limits.minutes : checkHorizon(options.horizon);
  const definition = root.LWProcessCatalog.admit(input), saved = restored(definition, options);
  const seed = saved ? saved.seed : options.seed ?? definition.seed ?? 1;
  const active = saved ? saved.active : options.active ?? limits.active, retained = saved ? saved.retained : options.retained ?? limits.retained;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > MAX_SEED) throw Error('Seed must be a whole number from 0 to ' + MAX_SEED + '.');
  if (!Number.isSafeInteger(active) || active < 1 || active > limits.active) {
   throw Error('Active case cap must be a whole number from 1 to ' + limits.active + '.');
  }
  if (!Number.isSafeInteger(retained) || retained < 1 || retained > MAX_RETAINED) {
   throw Error('Retained finished cases must be a whole number from 1 to ' + MAX_RETAINED + '.');
  }
  if (options.onEvent !== undefined && typeof options.onEvent !== 'function') throw Error('The event sink must be a function.');
  const seriesOptions = !saved ? options.series : saved.series ? {every: saved.series.every, points: saved.series.points} : false;
  const series = seriesOptions === false ? null : root.LWProcessSeries.create(definition, seriesOptions);
  let sinkFailed = false;
  const onEvent = options.onEvent, sink = onEvent ? (event: LWProcess.Event) => {
   try { onEvent(event); } catch (error) { sinkFailed = true; throw error; }
  } : null;
  const world = new root.LWECS.World(), scheduler = new root.LWECS.Scheduler(), ledger = root.LWProcessLedger.create(definition, retained);
  const clock: LWProcess.Clock = {minute: 0, serial: 0, forkSerial: 0, arrival: 0, cost: 0, arrived: 0, completed: 0, failed: 0, dropped: 0, cycle: 0,
   pruned: 0, goals: 0, lost: 0};
  world.create('process-clock');
  world.set('process-clock', 'process-clock', clock);
  for (const r of definition.resources) {
   world.create('pool-' + r.id);
   world.set('pool-' + r.id, 'process-pool', {...r, busy: 0, busyMinutes: 0});
  }
  for (const step of definition.steps) {
   world.create('station-' + step.id);
   world.set('station-' + step.id, 'process-station', {id: step.id, visits: 0, completed: 0, waitMinutes: 0, reached: 0,
    ...step.deadline ? {deadlines: {interrupted: 0, escalated: 0}} : {}, ...step.instances ? {items: {started: 0, finished: 0}} : {}});
  }
  const state: LWProcess.State = {world, definition, clock, events: [], receipts: [], receiptsDropped: 0, failures: [],
   steps: new Map(definition.steps.map(s => [s.id, s])),
   // A deadline flow is not the step's normal route: `outgoing` holds only the flows a completed visit may take.
   outgoing: new Map(definition.steps.map(s => [s.id, definition.flows.filter(f => f.from === s.id && f.on !== 'deadline')])),
   deadlines: new Map(definition.flows.filter(f => f.on === 'deadline').map(f => [f.from, f])), groups: new Map(), spawns: [], outcomes: new Map(),
   // Arrival streams are lazy cursors: each next minute is computed on demand, so open streams never expand a list.
   streams: definition.arrivals.map((def, index) => ({def, index, k: 0, at: def.at})), seed, active, retained, finished: [], visits: new Map(),
   tokenList: null, poolList: null, seen: new Map(), finishAgg: new Map(), entryAgg: new Map(), ledger, sink};
  // Scheduler owns timed ECS value updates; graph/structural changes happen after it releases its lock.
  scheduler.register({id: 'process-work', phase: 'simulate', order: 1, query: ['process-clock'], update: () => root.LWProcessSystems.work(state)});
  if (saved) root.LWProcessEngineState.apply(state, series, saved);
  else {
   root.LWProcessSystems.admit(state);
   root.LWProcessSystems.settle(state);
   if (series) root.LWProcessSeries.observe(series, state);
  }
  let disposed = false, running = false;
  const alive = () => {
   if (disposed) throw Error('Process session is disposed.');
   if (running) throw Error('The event sink cannot use the process session while a clock command runs.');
   if (sinkFailed) throw Error('Process session stopped because its event sink failed; dispose it and start a new run.');
  };
  const pool = (r: LWProcess.Resource) => world.get<LWProcess.Pool>('pool-' + r.id, 'process-pool')!;
  const station = (step: LWProcess.Step) => world.get<LWProcess.Station>('station-' + step.id, 'process-station')!;
  // Read-model only: neither value feeds the engine. Capacity cost charges every pool unit for every minute, busy or idle.
  const capacityOf = (r: LWProcess.Resource) => pool(r).capacity * r.costPerMinute * clock.minute;
  const capacityCost = () => definition.resources.reduce((n, r) => n + capacityOf(r), 0);
  /** Mean minutes since arrival of the cases still in progress (they are never pruned); null when none is. */
  const meanAge = (cases: LWProcess.Case[]) => {
   const open = cases.filter(c => c.status === 'active');
   return open.length ? round3(open.reduce((n, c) => n + clock.minute - c.entered, 0) / open.length) : null;
  };
  const ordered = (a: LWProcess.Case, b: LWProcess.Case) => a.id.length - b.id.length || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  function stepMetrics(tokens: LWProcess.Token[]): LWProcess.StepMetric[] {
   const timers = (id: string): LWProcess.TimerMetric => {
    const due = tokens.filter(t => t.stepId === id && t.status === 'timer').map(t => t.due!);
    return {waiting: due.length, nextDue: due.length ? Math.min(...due) : null};
   };
   const tracked = (id: string) => Object.fromEntries((definition.track ?? []).map(t => {
    const a = state.entryAgg.get(id + '|' + t.field);
    return [t.field, {n: a?.n ?? 0, mean: mean(a)}];
   }));
   return definition.steps.map(step => {
    const here = tokens.filter(t => t.stepId === step.id), metric = station(step), costs = ledger.steps.get(step.id)!;
    return {...metric, queued: here.filter(t => t.status !== 'active' && t.status !== 'timer').length, active: here.filter(t => t.status === 'active').length,
     held: here.filter(t => t.status === 'held').length, entered: metric.visits, timers: timers(step.id), tracked: tracked(step.id),
     starts: costs.starts, meanWaitMinutes: costs.starts ? round3(metric.waitMinutes / costs.starts) : null,
     fixedCost: costs.fixedCost, workCost: costs.workCost, ...root.LWProcessLedger.step(ledger, step.id)};
   });
  }
  /** Run-level read-model totals, in contract order after the existing metrics. */
  const readModel = () => {
   const {wipArea, ...books} = root.LWProcessLedger.totals(ledger);
   return {wipArea, cycleSum: clock.cycle, ...books};
  };
  function query(): LWProcess.Snapshot {
   alive();
   const cases = world.query(['process-case']).map(id => world.get<LWProcess.Case>(id, 'process-case')!).sort(ordered);
   const tokens = world.query(['process-token']).map(id => world.get<LWProcess.Token>(id, 'process-token')!);
   const live = clock.arrived - clock.completed - clock.failed;
   const future = root.LWProcessSystems.nextArrival(state) !== null, working = tokens.some(t => t.status === 'active' || t.status === 'timer');
   const status = horizon !== null && clock.minute >= horizon && (future || live) ? 'limit' : !future && !live ? 'completed'
    : !future && live && !working ? 'blocked' : clock.minute === 0 ? 'ready' : 'running';
   const resources = definition.resources.map(r => {
    const p = pool(r);
    return {id: r.id, kind: r.kind ?? 'people', capacity: p.capacity, busy: p.busy, busyMinutes: p.busyMinutes,
     utilization: clock.minute ? p.busyMinutes / (clock.minute * p.capacity) : 0, workCost: p.busyMinutes * r.costPerMinute, capacityCost: capacityOf(r)};
   });
   const decided = clock.goals + clock.lost;
   const finishTracked = Object.fromEntries((definition.track ?? []).map(t => {
    const a = state.finishAgg.get(t.field);
    return [t.field, {label: t.label ?? t.field, n: a?.n ?? 0, mean: mean(a), min: a?.min ?? null, max: a?.max ?? null}];
   }));
   return copy({minute: clock.minute, status, cases, tokens, events: state.events, receipts: state.receipts, receiptsDropped: state.receiptsDropped,
    steps: stepMetrics(tokens), resources,
    metrics: {arrived: clock.arrived, completed: clock.completed, failed: clock.failed, dropped: clock.dropped, active: live, cost: clock.cost,
     capacityCost: capacityCost(), meanCycleMinutes: clock.completed ? clock.cycle / clock.completed : 0, meanAgeMinutes: meanAge(cases),
     throughputPerHour: clock.minute ? clock.completed * 60 / clock.minute : null,
     cycleHistogram: {edges: [...root.LWProcessLedger.EDGES], counts: ledger.cycles},
     goals: clock.goals, lost: clock.lost, conversion: decided ? Math.floor((2000 * clock.goals + decided) / (2 * decided)) : null,
     tracked: finishTracked, ...readModel()},
    seed, retention: {finishedDropped: clock.pruned}});
  }
  function advance(minutes: number): LWProcess.Snapshot {
   alive();
   const beyond = horizon !== null && clock.minute + minutes > horizon;
   if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > limits.minutes || beyond) {
    throw Error('Advance needs 1–' + limits.minutes + ' whole minutes within the run horizon.');
   }
   const target = clock.minute + minutes, systems = root.LWProcessSystems;
   running = true;
   try {
    while (clock.minute < target) {
     if (systems.nextArrival(state) === null && !systems.progress(state).tokens) break;
     // Quiet minutes (no arrival, completion or timer due) are applied in bulk with identical totals instead of being stepped one by one.
     systems.fastForward(state, target);
     scheduler.step(world, .1);
     systems.admit(state);
     systems.settle(state);
     if (series) root.LWProcessSeries.observe(series, state);
    }
   } finally { running = false; }
   return query();
  }
  return {query, advance, horizon: () => horizon,
   state() {
    alive();
    return root.LWProcessEngineState.capture(state, series);
   },
   series(after) {
    alive();
    return series ? root.LWProcessSeries.read(series, after) : null;
   },
   distributions() {
    alive();
    return root.LWProcessLedger.distributions(ledger, definition);
   },
   recent() {
    alive();
    return root.LWProcessLedger.recent(ledger);
   },
   setHorizon(value) {
    alive();
    horizon = checkHorizon(value);
   },
   dispose() {
    if (running) throw Error('The event sink cannot use the process session while a clock command runs.');
    disposed = true;
    for (const id of world.query([])) world.destroy(id);
   }};
 }
 /** The checked saved state of `options.restore`, or null; a restored run takes its seed, case caps and series from it. */
 function restored(definition: LWProcess.Definition, options: LWProcess.RunOptions): LWProcessEngineState.Saved | null {
  if (options.restore === undefined) return null;
  if ([options.seed, options.active, options.retained, options.series].some(value => value !== undefined)) {
   throw Error('A restored run takes its seed, case caps and series from the saved state; leave those options out.');
  }
  return root.LWProcessCheckpointCheck.state(definition, options.restore);
 }
 root.LWProcessRuntime = {create, limits};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessRuntime;
})(globalThis);
