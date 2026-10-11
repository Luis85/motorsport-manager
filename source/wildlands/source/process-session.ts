/// <reference path="./process-contracts.d.ts" />
/** Application-owned ECS session: explicit bounded clock commands and detached read models. */
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWECS: LWProcess.Ecs; LWProcessCatalog: LWProcess.Catalog; LWProcessSystems: LWProcess.Systems; LWProcessLimits: LWProcess.Limits; LWProcessRuntime?: LWProcess.Runtime};
 const limits = root.LWProcessLimits;
 const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
 // Largest seed (a positive 31-bit integer) and the most finished cases a caller may ask a session to keep in detail.
 const MAX_SEED = 2147483647, MAX_RETAINED = 10000;
 const checkHorizon = (value: number | null): number | null => {
  if (value !== null && (!Number.isSafeInteger(value) || value < 1)) throw Error('Run horizon must be a whole number of minutes (1 or more) or unlimited.');
  return value;
 };
 function create(input: unknown, options: LWProcess.RunOptions = {}): LWProcess.Session {
  let horizon = options.horizon === undefined ? limits.minutes : checkHorizon(options.horizon);
  const definition = root.LWProcessCatalog.admit(input);
  const seed = options.seed ?? definition.seed ?? 1, active = options.active ?? limits.active, retained = options.retained ?? limits.retained;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > MAX_SEED) throw Error('Seed must be a whole number from 0 to ' + MAX_SEED + '.');
  if (!Number.isSafeInteger(active) || active < 1 || active > limits.active) throw Error('Active case cap must be a whole number from 1 to ' + limits.active + '.');
  if (!Number.isSafeInteger(retained) || retained < 1 || retained > MAX_RETAINED) throw Error('Retained finished cases must be a whole number from 1 to ' + MAX_RETAINED + '.');
  const world = new root.LWECS.World(), scheduler = new root.LWECS.Scheduler();
  const clock: LWProcess.Clock = {minute: 0, serial: 0, forkSerial: 0, arrival: 0, cost: 0, arrived: 0, completed: 0, failed: 0, dropped: 0, cycle: 0, pruned: 0, goals: 0, lost: 0};
  world.create('process-clock'); world.set('process-clock', 'process-clock', clock);
  for (const r of definition.resources) { world.create('pool-' + r.id); world.set('pool-' + r.id, 'process-pool', {...r, busy: 0, busyMinutes: 0}); }
  for (const step of definition.steps) { world.create('station-' + step.id); world.set('station-' + step.id, 'process-station', {id: step.id, visits: 0, completed: 0, waitMinutes: 0, reached: 0,
   ...step.deadline ? {deadlines: {interrupted: 0, escalated: 0}} : {}, ...step.instances ? {items: {started: 0, finished: 0}} : {}}); }
  const state: LWProcess.State = {world, definition, clock, events: [], receipts: [], receiptsDropped: 0, failures: [], steps: new Map(definition.steps.map(s => [s.id, s])),
   // A deadline flow is not the step's normal route: `outgoing` holds only the flows a completed visit may take.
   outgoing: new Map(definition.steps.map(s => [s.id, definition.flows.filter(f => f.from === s.id && f.on !== 'deadline')])),
   deadlines: new Map(definition.flows.filter(f => f.on === 'deadline').map(f => [f.from, f])), groups: new Map(), spawns: [], outcomes: new Map(),
   // Arrival streams are lazy cursors: each next minute is computed on demand, so open streams never expand a list.
   streams: definition.arrivals.map((def, index) => ({def, index, k: 0, at: def.at})), seed, active, retained, finished: [], visits: new Map(), tokenList: null, poolList: null, seen: new Map(), finishAgg: new Map(), entryAgg: new Map()};
  // Scheduler owns timed ECS value updates; graph/structural changes happen after it releases its lock.
  scheduler.register({id: 'process-work', phase: 'simulate', order: 1, query: ['process-clock'], update: () => root.LWProcessSystems.work(state)});
  root.LWProcessSystems.admit(state); root.LWProcessSystems.settle(state);
  let disposed = false;
  const alive = () => { if (disposed) throw Error('Process session is disposed.'); };
  // Means are rounded to 3 decimals; an empty aggregate has no mean.
  const mean = (a: LWProcess.Aggregate | undefined) => a ? Math.round(a.sum / a.n * 1000) / 1000 : null;
  // Read-model only: neither value feeds the engine. Capacity cost charges every pool unit for every minute, busy or idle.
  const capacityCost = () => definition.resources.reduce((n, r) => {
   const pool = world.get<LWProcess.Pool>('pool-' + r.id, 'process-pool')!; return n + pool.capacity * r.costPerMinute * clock.minute;
  }, 0);
  /** Mean minutes since arrival of the cases still in progress (they are never pruned); null when none is. */
  const meanAge = (cases: LWProcess.Case[]) => {
   const open = cases.filter(c => c.status === 'active');
   return open.length ? Math.round(open.reduce((n, c) => n + clock.minute - c.entered, 0) / open.length * 1000) / 1000 : null;
  };
  function query(): LWProcess.Snapshot {
   alive();
   const cases = world.query(['process-case']).map(id => world.get<LWProcess.Case>(id, 'process-case')!).sort((a, b) => a.id.length - b.id.length || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
   const tokens = world.query(['process-token']).map(id => world.get<LWProcess.Token>(id, 'process-token')!);
   const live = clock.arrived - clock.completed - clock.failed;
   const timers = (id: string): LWProcess.TimerMetric => { const due = tokens.filter(t => t.stepId === id && t.status === 'timer').map(t => t.due!); return {waiting: due.length, nextDue: due.length ? Math.min(...due) : null}; };
   const future = root.LWProcessSystems.nextArrival(state) !== null;
   const status = horizon !== null && clock.minute >= horizon && (future || live) ? 'limit' : !future && !live ? 'completed'
    : !future && live && !tokens.some(t => t.status === 'active' || t.status === 'timer') ? 'blocked' : clock.minute === 0 ? 'ready' : 'running';
   return copy({minute: clock.minute, status, cases, tokens, events: state.events, receipts: state.receipts, receiptsDropped: state.receiptsDropped,
    steps: definition.steps.map(step => ({...world.get<LWProcess.Station>('station-' + step.id, 'process-station')!,
     queued: tokens.filter(t => t.stepId === step.id && t.status !== 'active' && t.status !== 'timer').length, active: tokens.filter(t => t.stepId === step.id && t.status === 'active').length,
     held: tokens.filter(t => t.stepId === step.id && t.status === 'held').length,
     entered: world.get<LWProcess.Station>('station-' + step.id, 'process-station')!.visits, timers: timers(step.id),
     tracked: Object.fromEntries((definition.track ?? []).map(t => { const a = state.entryAgg.get(step.id + '|' + t.field); return [t.field, {n: a?.n ?? 0, mean: mean(a)}]; }))})),
    resources: definition.resources.map(r => { const p = world.get<LWProcess.Pool>('pool-' + r.id, 'process-pool')!;
     return {id: r.id, kind: r.kind ?? 'people', capacity: p.capacity, busy: p.busy, busyMinutes: p.busyMinutes, utilization: clock.minute ? p.busyMinutes / (clock.minute * p.capacity) : 0}; }),
    metrics: {arrived: clock.arrived, completed: clock.completed, failed: clock.failed, dropped: clock.dropped, active: live, cost: clock.cost,
     capacityCost: capacityCost(), meanCycleMinutes: clock.completed ? clock.cycle / clock.completed : 0, meanAgeMinutes: meanAge(cases),
     throughputPerHour: clock.minute ? clock.completed * 60 / clock.minute : 0,
     goals: clock.goals, lost: clock.lost, conversion: clock.goals + clock.lost ? Math.floor((2000 * clock.goals + clock.goals + clock.lost) / (2 * (clock.goals + clock.lost))) : null,
     tracked: Object.fromEntries((definition.track ?? []).map(t => { const a = state.finishAgg.get(t.field); return [t.field, {label: t.label ?? t.field, n: a?.n ?? 0, mean: mean(a), min: a?.min ?? null, max: a?.max ?? null}]; }))},
    seed, retention: {finishedDropped: clock.pruned}});
  }
  function advance(minutes: number): LWProcess.Snapshot {
   alive();
   if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > limits.minutes || horizon !== null && clock.minute + minutes > horizon) throw Error('Advance needs 1–' + limits.minutes + ' whole minutes within the run horizon.');
   const target = clock.minute + minutes, systems = root.LWProcessSystems;
   while (clock.minute < target) {
    if (systems.nextArrival(state) === null && !systems.progress(state).tokens) break;
    // Quiet minutes (no arrival, completion or timer due) are applied in bulk with identical totals instead of being stepped one by one.
    systems.fastForward(state, target);
    scheduler.step(world, .1); systems.admit(state); systems.settle(state);
   }
   return query();
  }
  return {query, advance, horizon: () => horizon, setHorizon(value) { alive(); horizon = checkHorizon(value); }, dispose() { disposed = true; for (const id of world.query([])) world.destroy(id); }};
 }
 root.LWProcessRuntime = {create, limits};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessRuntime;
})(globalThis);
