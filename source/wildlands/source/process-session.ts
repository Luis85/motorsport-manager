/// <reference path="./process-contracts.d.ts" />
/** Application-owned ECS session: explicit bounded clock commands and detached read models. */
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWECS: LWProcess.Ecs; LWProcessCatalog: LWProcess.Catalog; LWProcessSystems: LWProcess.Systems; LWProcessLimits: LWProcess.Limits; LWProcessRuntime?: LWProcess.Runtime};
 const limits = root.LWProcessLimits;
 const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
 function create(input: unknown): LWProcess.Session {
  const definition = root.LWProcessCatalog.admit(input), world = new root.LWECS.World(), scheduler = new root.LWECS.Scheduler();
  const clock: LWProcess.Clock = {minute: 0, serial: 0, forkSerial: 0, arrival: 0, cost: 0};
  world.create('process-clock'); world.set('process-clock', 'process-clock', clock);
  for (const r of definition.resources) { world.create('pool-' + r.id); world.set('pool-' + r.id, 'process-pool', {...r, busy: 0, busyMinutes: 0}); }
  for (const step of definition.steps) { world.create('station-' + step.id); world.set('station-' + step.id, 'process-station', {id: step.id, visits: 0, completed: 0, waitMinutes: 0}); }
  const state: LWProcess.State = {world, definition, clock, events: [], receipts: [], receiptsDropped: 0, steps: new Map(definition.steps.map(s => [s.id, s])),
   outgoing: new Map(definition.steps.map(s => [s.id, definition.flows.filter(f => f.from === s.id)])),
   arrivals: definition.arrivals.flatMap(a => Array.from({length: a.count}, (_, i) => ({at: a.at + i * a.interval, data: {...a.data}}))).sort((a, b) => a.at - b.at)};
  // Scheduler owns timed ECS value updates; graph/structural changes happen after it releases its lock.
  scheduler.register({id: 'process-work', phase: 'simulate', order: 1, query: ['process-clock'], update: () => root.LWProcessSystems.work(state)});
  root.LWProcessSystems.admit(state); root.LWProcessSystems.settle(state);
  let disposed = false;
  const alive = () => { if (disposed) throw Error('Process session is disposed.'); };
  function query(): LWProcess.Snapshot {
   alive();
   const cases = world.query(['process-case']).map(id => world.get<LWProcess.Case>(id, 'process-case')!);
   const tokens = world.query(['process-token']).map(id => world.get<LWProcess.Token>(id, 'process-token')!);
   const finished = cases.filter(c => c.status === 'completed'), active = cases.filter(c => c.status === 'active').length;
   const future = clock.arrival < state.arrivals.length;
   const status = clock.minute >= limits.minutes && (future || active) ? 'limit' : !future && !active ? 'completed'
    : !future && active && !tokens.some(t => t.status === 'active') ? 'blocked' : clock.minute === 0 ? 'ready' : 'running';
   return copy({minute: clock.minute, status, cases, tokens, events: state.events, receipts: state.receipts, receiptsDropped: state.receiptsDropped,
    steps: definition.steps.map(step => ({...world.get<LWProcess.Station>('station-' + step.id, 'process-station')!,
     queued: tokens.filter(t => t.stepId === step.id && t.status !== 'active').length, active: tokens.filter(t => t.stepId === step.id && t.status === 'active').length})),
    resources: definition.resources.map(r => { const p = world.get<LWProcess.Pool>('pool-' + r.id, 'process-pool')!;
     return {id: r.id, capacity: p.capacity, busy: p.busy, busyMinutes: p.busyMinutes, utilization: clock.minute ? p.busyMinutes / (clock.minute * p.capacity) : 0}; }),
    metrics: {arrived: cases.length, completed: finished.length, failed: cases.filter(c => c.status === 'failed').length, active, cost: clock.cost,
     meanCycleMinutes: finished.length ? finished.reduce((n, c) => n + c.finished! - c.entered, 0) / finished.length : 0,
     throughputPerHour: clock.minute ? finished.length * 60 / clock.minute : 0}});
  }
  function advance(minutes: number): LWProcess.Snapshot {
   alive();
   if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > limits.minutes || clock.minute + minutes > limits.minutes) throw Error('Advance needs 1–' + limits.minutes + ' whole minutes within the run horizon.');
   for (let i = 0; i < minutes; i++) {
    if (clock.arrival === state.arrivals.length && !world.query(['process-token']).length) break;
    scheduler.step(world, .1); root.LWProcessSystems.admit(state); root.LWProcessSystems.settle(state);
   }
   return query();
  }
  return {query, advance, dispose() { disposed = true; for (const id of world.query([])) world.destroy(id); }};
 }
 root.LWProcessRuntime = {create, limits};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessRuntime;
})(globalThis);
