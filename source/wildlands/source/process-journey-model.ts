/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-route.ts" />
/// <reference path="./process-work-state.ts" />
/**
 * The journey map's model (LWProcessJourneyModel): phase columns, main-route and branch cards, and the live funnel facts between
 * main-route steps, derived from a detached definition and snapshot. Pure functions: no DOM, session, clock or storage, and nothing
 * is changed. LWProcessJourney (process-renderer-journey.ts) draws it. The funnel words the work still in progress between two route
 * steps like the 2D cards and the step list, with the studio's one work-state derivation (LWProcessWorkState).
 */
declare namespace LWProcessJourney {
 /** One card of the map: a step on the main route (`main`) or reached only through a side branch. */
 interface Node {step: LWProcess.Step; phase: string; depth: number; main: boolean; slot: number;}
 interface Group {phase: string; main: Node[]; branches: Node[]; start: number; span: number;}
 interface Layout {nodes: Node[]; groups: Group[]; slots: number; byId: Map<string, Node>;}
 /**
  * Funnel facts of one main-route step about the stretch from the previous main-route step to it: `lost` counts cases that
  * finished at a lost end branching off in that stretch, `wip` the cases still in progress there (at the previous step or on
  * a branch from it), and `rejoin` names the later main-route step where a branch from the previous step comes back. `work` words
  * the work at those steps while cases are in progress there ('1 working', '2 waiting', … from LWProcessWorkState), else [].
  */
 interface FunnelFacts {lost: number; wip: number; rejoin: string | null; work: string[];}
 interface ModelApi {
  layout(definition: LWProcess.Definition): Layout;
  /** Facts per main-route step id, `order` being the main-route steps in route order. */
  funnelFacts(definition: LWProcess.Definition, snapshot: LWProcess.Snapshot, order: LWProcess.Step[]): Map<string, FunnelFacts>;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {
  LWProcessJourneyModel?: LWProcessJourney.ModelApi; LWProcessRoute: LWProcessRoute.Api; LWProcessWorkState: LWProcessWorkState.Api;
 };
 /**
  * Phase columns in order of first appearance along the main route; everything else is a branch under the phase it hangs from. The
  * route is the shared LWProcessRoute main route (the rule SIPOC and the slides use) with its explicit 'first-branch' fork rule: a
  * fork is not expanded, its first branch stays on the route and the other branches are drawn as branches.
  */
 function layout(d: LWProcess.Definition): LWProcessJourney.Layout {
  const steps = new Map(d.steps.map(s => [s.id, s])), route = root.LWProcessRoute.mainRoute(d, {forks: 'first-branch'});
  const anyPhase = d.steps.some(s => s.phase), fallback = !anyPhase && (d.genre ?? 'process') === 'process' ? 'Process' : 'Journey';
  const phaseOf = new Map<string, string>();
  let previous = fallback;
  for (const s of route) {
   previous = s.phase ?? previous;
   phaseOf.set(s.id, previous);
  }
  const depth = new Map(route.map((s, i) => [s.id, i]));
  // Side branches inherit the phase (and a depth just after) the step they hang from; unreachable steps stay in the fallback phase.
  let changed = true;
  while (changed) {
   changed = false;
   for (const f of d.flows) {
    const to = steps.get(f.to);
    if (!to || depth.has(to.id) || !depth.has(f.from) && !phaseOf.has(f.from)) continue;
    depth.set(to.id, (depth.get(f.from) ?? 0) + 1);
    phaseOf.set(to.id, to.phase ?? phaseOf.get(f.from) ?? fallback);
    changed = true;
   }
  }
  for (const s of d.steps) {
   if (phaseOf.has(s.id)) continue;
   phaseOf.set(s.id, s.phase ?? fallback);
   depth.set(s.id, route.length);
  }
  const order: string[] = [];
  for (const s of [...route, ...d.steps]) {
   const p = phaseOf.get(s.id)!;
   if (!order.includes(p)) order.push(p);
  }
  const mainIds = new Set(route.map(s => s.id)), nodes: LWProcessJourney.Node[] = [], groups: LWProcessJourney.Group[] = [];
  const byId = new Map<string, LWProcessJourney.Node>();
  let slot = 0;
  for (const phase of order) {
   const make = (s: LWProcess.Step, main: boolean): LWProcessJourney.Node => ({step: s, phase, depth: depth.get(s.id) ?? 0, main, slot: -1});
   const main = route.filter(s => phaseOf.get(s.id) === phase).map(s => make(s, true));
   const branches = d.steps.filter(s => !mainIds.has(s.id) && phaseOf.get(s.id) === phase).map(s => make(s, false))
    .sort((a, b) => a.depth - b.depth);
   const g: LWProcessJourney.Group = {phase, main, branches, start: slot, span: Math.max(1, main.length)};
   main.forEach((n, i) => {n.slot = slot + i;});
   slot += g.span;
   groups.push(g);
   for (const n of [...main, ...branches]) {
    nodes.push(n);
    byId.set(n.step.id, n);
   }
  }
  return {nodes, groups, slots: slot, byId};
 }
 /**
  * Funnel facts per main-route step (see FunnelFacts). A branch step belongs to the last main-route step it can be reached from
  * without passing another main-route step; only cases at a `lost` end count as drop-off, so an alternative route that rejoins
  * is a split and unfinished cases are in progress, never lost. Failed cases carry no step in the snapshot and are not counted.
  */
 function funnelFacts(d: LWProcess.Definition, q: LWProcess.Snapshot, order: LWProcess.Step[]): Map<string, LWProcessJourney.FunnelFacts> {
  const index = new Map(order.map((s, i) => [s.id, i])), origin = new Map<string, number>(), rejoin = new Map<number, string>();
  order.forEach((s, i) => {
   const queue = d.flows.filter(f => f.from === s.id).map(f => f.to), seen = new Set<string>();
   for (let k = 0; k < queue.length; k++) {
    const id = queue[k]!, j = index.get(id);
    if (seen.has(id)) continue;
    seen.add(id);
    if (j !== undefined) {
     if (j > i + 1 && !rejoin.has(i)) rejoin.set(i, order[j]!.name);
     continue;
    }
    origin.set(id, i);
    queue.push(...d.flows.filter(f => f.from === id).map(f => f.to));
   }
  });
  const at = (id: string) => index.get(id) ?? origin.get(id), lost = new Map<number, number>(), wip = new Map<number, Set<string>>();
  const reached = new Map(q.steps.map(m => [m.id, m.reached])), left = new Map(q.steps.map(m => [m.id, m.completed]));
  const count = (i: number, n: number) => {
   if (n > 0) lost.set(i, (lost.get(i) ?? 0) + n);
  };
  // A lost end shared by several stretches is split by its ways in: a branch step whose only way out is this end hands over every case
  // that completed it; the rest came straight from a main-route step (or a busier branch) and counts at the latest such stretch.
  for (const e of d.steps.filter(s => s.kind === 'end' && s.outcome === 'lost' && !index.has(s.id))) {
   let rest = reached.get(e.id) ?? 0, last = -1;
   for (const f of d.flows.filter(x => x.to === e.id)) {
    const i = at(f.from);
    if (i === undefined) continue;
    const branchOnlyHere = !index.has(f.from) && d.flows.filter(x => x.from === f.from).length === 1;
    if (branchOnlyHere) {
     const n = Math.min(rest, left.get(f.from) ?? 0);
     count(i, n);
     rest -= n;
    } else last = Math.max(last, i);
   }
   if (last < 0) last = origin.get(e.id) ?? -1;
   if (last >= 0) count(last, rest);
  }
  // A detached view built by hand (a test or an export) may carry no tokens; nothing is then in progress.
  for (const t of q.tokens ?? []) {
   const i = t.status === 'spent' ? undefined : at(t.stepId);
   if (i !== undefined) (wip.get(i) ?? wip.set(i, new Set()).get(i)!).add(t.caseId);
  }
  // The work at the stretch's steps (the route step and the branches hanging from it), worded only while cases are in progress there.
  const members = (i: number) => d.steps.filter(s => at(s.id) === i).map(s => s.id), words = root.LWProcessWorkState;
  const work = (i: number) => wip.get(i)?.size ? words.parts(words.tally(d, q, members(i))) : [];
  const facts = (i: number): LWProcessJourney.FunnelFacts =>
   ({lost: lost.get(i) ?? 0, wip: wip.get(i)?.size ?? 0, rejoin: rejoin.get(i) ?? null, work: work(i)});
  return new Map(order.map((s, i) => [s.id, i ? facts(i - 1) : {lost: 0, wip: 0, rejoin: null, work: []}]));
 }
 root.LWProcessJourneyModel = Object.freeze({layout, funnelFacts});
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessJourneyModel;
})(globalThis);
