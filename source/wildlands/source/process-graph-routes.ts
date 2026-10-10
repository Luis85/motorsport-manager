/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-needs.ts" />
/**
 * Route analysis of process admission (LWProcessGraphRoutes). process-graph.ts owns admission and calls `check` once, after
 * the per-step shape rules and before the needs analysis: reachability from the start and to an end, fork regions (disjoint
 * branch chains, one owning fork per join, no field written by two branches) and boundary deadlines (no interrupt inside a
 * region; an escalation path of its own that reaches an end and shares no field writes with the work that continues beside it).
 * It returns the concurrency map that the needs analysis widens reads with. Pure: it only reads the definition and reports
 * through `fail`, in the same order every time.
 */
declare namespace LWProcessGraphRoutes {
 type Fail = (path: string, message: string) => void;
 interface Api {
  /** `dangling` is true when a flow names a missing step: reachability is then not judged, since that flow is the root cause. */
  check(d: LWProcess.Definition, fail: Fail, dangling: boolean): LWProcessNeeds.Concurrency;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessGraphRoutes?: LWProcessGraphRoutes.Api};
 /** Tasks, touchpoints, machine steps and system steps all execute work with duration, cost and resource demands. */
 const works = (s: LWProcess.Step) => s.kind === 'task' || s.kind === 'touchpoint' || s.kind === 'machine' || s.kind === 'system';
 /** Fields a step writes: fixed values, counters and draws. */
 const writesOf = (s: LWProcess.Step) => Object.keys(s.set ?? {}).concat(Object.keys(s.add ?? {}), (s.draws ?? []).map(x => x.field));
 /** Lookups over one definition, shared by the three analyses. */
 interface Net {
  d: LWProcess.Definition; steps: Map<string, LWProcess.Step>; fail: LWProcessGraphRoutes.Fail;
  outgoing(id: string): LWProcess.Flow[];
  /** A step's normal outgoing flows exclude the extra flow of its deadline. */
  normal(id: string): LWProcess.Flow[];
  incoming(id: string): LWProcess.Flow[];
  /** The diagnostic path of a step. */
  at(id: string): string;
  /** Every step reachable from `start` along flows (or against them when `reverse`), `start` included. */
  visit(start: string, reverse: boolean): Set<string>;
 }
 function net(d: LWProcess.Definition, fail: LWProcessGraphRoutes.Fail): Net {
  const steps = new Map(d.steps.map(s => [s.id, s])), index = new Map(d.steps.map((s, i) => [s.id, i]));
  const outgoing = (id: string) => d.flows.filter(f => f.from === id);
  const incoming = (id: string) => d.flows.filter(f => f.to === id);
  const visit = (start: string, reverse: boolean) => {
   const seen = new Set<string>(), queue = [start];
   while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    queue.push(...(reverse ? incoming(id).map(f => f.from) : outgoing(id).map(f => f.to)));
   }
   return seen;
  };
  return {d, steps, fail, outgoing, incoming, visit,
   normal: id => outgoing(id).filter(f => f.on !== 'deadline'),
   at: id => '/steps/' + (index.get(id) ?? -1)};
 }
 function reachability(n: Net, dangling: boolean): void {
  const reachable = n.visit(n.d.start, false);
  const toEnd = new Set(n.d.steps.filter(s => s.kind === 'end').flatMap(s => [...n.visit(s.id, true)]));
  if (dangling) return;
  for (const s of n.d.steps) {
   if (!reachable.has(s.id)) n.fail(n.at(s.id), 'Step is unreachable from start.');
   if (!toEnd.has(s.id)) n.fail(n.at(s.id), 'Step has no route to an end.');
  }
 }
 /**
  * Every fork's branches must be disjoint chains of work steps or timers that end at its join, and no two branches may write
  * one field. Returns the fork that owns each step inside a region.
  */
 function forks(n: Net): Map<string, string> {
  const owners = new Map<string, string>(), regionOf = new Map<string, string>();
  for (const fork of n.d.steps.filter(s => s.kind === 'fork')) {
   const region = new Set<string>(), effects = new Set<string>(), label = fork.mode === 'inclusive' ? 'Inclusive' : 'Parallel';
   if (owners.has(fork.join ?? '')) n.fail(n.at(fork.id), 'A join belongs to exactly one fork.');
   owners.set(fork.join ?? '', fork.id);
   const expectedIncoming = new Set<string>();
   for (const flow of n.outgoing(fork.id)) {
    const path = new Set<string>(), fields = new Set<string>();
    let current = flow.to, previous = fork.id;
    while (current !== fork.join) {
     const step = n.steps.get(current);
     const fresh = !path.has(current) && !region.has(current);
     if (!step || !fresh || !works(step) && step.kind !== 'timer' || n.normal(current).length !== 1 || n.incoming(current).length !== 1) {
      n.fail(n.at(fork.id), label + ' branches must be disjoint chains of work steps (task, touchpoint, machine, system) or timers ending at their join.');
      break;
     }
     path.add(current);
     region.add(current);
     regionOf.set(current, fork.id);
     writesOf(step).forEach(key => fields.add(key));
     previous = current;
     current = n.normal(current)[0]!.to;
    }
    if (current === fork.join) expectedIncoming.add(previous);
    for (const field of fields) {
     if (effects.has(field)) n.fail(n.at(fork.id), label + ' branches cannot both write ' + field + '.');
     effects.add(field);
    }
   }
   const actual = n.incoming(fork.join ?? ''), branches = n.outgoing(fork.id);
   if (actual.length !== branches.length || actual.some(f => !expectedIncoming.has(f.from))) {
    n.fail(n.at(fork.id), 'Join has incoming work outside its fork.');
   }
   if (new Set(branches.map(f => f.to)).size !== branches.length) n.fail(n.at(fork.id), 'Fork branches need distinct targets.');
  }
  for (const join of n.d.steps.filter(s => s.kind === 'join')) if (!owners.has(join.id)) n.fail(n.at(join.id), 'Join needs one owning fork.');
  return regionOf;
 }
 /**
  * Boundary deadlines: an interrupt must not strand a join, and an escalation needs its own route to an end that shares nothing
  * with the normal route. An escalated token runs beside the work that continues (the normal route and, inside a fork region,
  * the sibling branches) on the same case data: both sides may not write one field, and needs analysis widens what each side
  * may read by the other side's writes.
  */
 function deadlines(n: Net, regionOf: Map<string, string>): LWProcessNeeds.Concurrency {
  const concurrent: LWProcessNeeds.Concurrency = new Map();
  const beside = (from: Iterable<string>, to: Iterable<string>) => {
   for (const x of from) {
    const set = concurrent.get(x) ?? new Set<string>();
    concurrent.set(x, set);
    for (const y of to) set.add(y);
   }
  };
  const writes = (ids: Iterable<string>) => new Set([...ids].flatMap(id => {
   const w = n.steps.get(id);
   return w ? writesOf(w) : [];
  }));
  for (const s of n.d.steps) {
   const flow = s.deadline && n.outgoing(s.id).find(f => f.on === 'deadline' && f.id === s.deadline!.flow);
   if (!s.deadline || !flow || !n.steps.has(flow.to)) continue;
   const path = n.at(s.id) + '/deadline';
   if (s.deadline.mode === 'interrupt' && regionOf.has(s.id)) {
    n.fail(path + '/mode', 'A step inside a parallel or inclusive region can only escalate; an interrupt would strand the join.');
   }
   if (s.deadline.mode !== 'escalate') continue;
   // The normal route is everything reachable from the step's normal flow, except through this deadline flow itself
   // (a rework loop returns to the step).
   const main = new Set([s.id]), queue = n.normal(s.id).map(f => f.to);
   while (queue.length) {
    const id = queue.shift()!;
    if (main.has(id)) continue;
    main.add(id);
    queue.push(...n.outgoing(id).filter(f => f.id !== flow.id).map(f => f.to));
   }
   const away = n.visit(flow.to, false);
   if (![...away].some(id => n.steps.get(id)?.kind === 'end')) n.fail(path, 'The escalation path must reach an end step.');
   const shared = [...away].filter(id => main.has(id));
   if (shared.length) n.fail(path, 'The escalation path must not share steps with the normal route (shared: ' + shared.join(', ') + ').');
   for (const id of away) {
    if (n.steps.get(id)?.deadline?.mode !== 'escalate') continue;
    n.fail(path, 'An escalated token cannot be escalated again, but step "' + id + '" on the escalation path declares an escalating deadline.');
   }
   const region = regionOf.get(s.id);
   const running = [...main, ...region === undefined ? [] : n.d.steps.filter(x => regionOf.get(x.id) === region).map(x => x.id)];
   const raced = [...writes(away)].filter(field => writes(running).has(field));
   if (raced.length) {
    n.fail(path, 'The escalation path and the work that continues beside it both write ' + raced.join(', ')
     + '; the result would depend on timing. Give each side its own fields.');
   }
   // Several escalated tokens of one case may share the path: one per late item, or one per visit when the normal route
   // loops back to this step.
   const repeated = s.instances !== undefined || n.normal(s.id).some(f => n.visit(f.to, false).has(s.id));
   beside(away, running);
   beside(running, away);
   if (repeated) beside(away, away);
  }
  return concurrent;
 }
 function check(d: LWProcess.Definition, fail: LWProcessGraphRoutes.Fail, dangling: boolean): LWProcessNeeds.Concurrency {
  const n = net(d, fail);
  reachability(n, dangling);
  return deadlines(n, forks(n));
 }
 root.LWProcessGraphRoutes = {check};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessGraphRoutes;
})(globalThis);
