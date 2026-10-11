/// <reference path="./process-contracts.d.ts" />
/**
 * The main route of a process, shared by the SIPOC view, the slide model and the journey map so the rule exists once. Pure
 * functions over a detached definition: no DOM, session, clock or storage, and the definition is never changed.
 * Rule: from `start`, at each step follow the first outgoing flow without `when` that is not a deadline flow, else the first
 * non-deadline flow (`next`), and stop at a step already visited. A fork on the route is read in one of two explicit ways
 * (`RouteOptions.forks`):
 *  - 'expand' (the default; `walk`, the SIPOC view and the slides): the fork is walked with all of its branches up to its join,
 *    as one unit, and the route continues after the join.
 *  - 'first-branch' (the journey map): the fork is an ordinary step, so `next` keeps its first branch on the route and the other
 *    branches stay off it (the journey map draws them as branches).
 */
declare namespace LWProcessRoute {
 interface Walk {
  /** SIPOC units: a fork with its branches and join is one unit, a decision joins the unit before it; start and end steps are left out. */
  units: LWProcess.Step[][];
  /** Every step on the main route in walk order, start and end included (a fork is followed by its branches, then its join). */
  path: LWProcess.Step[];
 }
 interface Group { name: string; steps: LWProcess.Step[]; }
 interface RouteOptions {
  /** How a fork on the route is read: 'expand' (default) walks all of its branches up to its join; 'first-branch' follows `next`. */
  forks?: 'expand' | 'first-branch';
 }
 interface Api {
  /** The 'expand' walk: SIPOC units and the main-route path. */
  walk(definition: LWProcess.Definition): Walk;
  /** Every step on the main route in walk order, start and end included, with forks read as `options.forks` says. */
  mainRoute(definition: LWProcess.Definition, options?: RouteOptions): LWProcess.Step[];
  /** The flow the main route follows out of a step: the first non-deadline flow without `when`, else the first non-deadline flow. */
  next(definition: LWProcess.Definition, stepId: string): LWProcess.Flow | undefined;
  /**
   * Groups steps by `phase` in order of first appearance; an unphased step joins the phase before it (leading ones the first phase).
   * Null when no step has a phase.
   */
  phases(steps: readonly LWProcess.Step[]): Group[] | null;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessRoute?: LWProcessRoute.Api};
 type Step = LWProcess.Step;
 const ENDS = new Set(['start', 'end']);
 const outgoing = (d: LWProcess.Definition, id: string) => d.flows.filter(f => f.from === id && f.on !== 'deadline');
 function next(d: LWProcess.Definition, id: string): LWProcess.Flow | undefined { const o = outgoing(d, id); return o.find(f => !f.when) ?? o[0]; }
 function walk(d: LWProcess.Definition): LWProcessRoute.Walk {
  const by = new Map(d.steps.map(s => [s.id, s])), out = (id: string) => outgoing(d, id), pick = (id: string) => next(d, id)?.to;
  const units: Step[][] = [], path: Step[] = [], seen = new Set<string>(); let cur: string | undefined = d.start;
  while (cur && !seen.has(cur)) {
   const s = by.get(cur); if (!s) break; seen.add(cur);
   if (s.kind === 'fork') {
    const unit = [s]; let join: string | undefined;
    for (const f of out(cur)) for (let x: string | undefined = f.to; x && !seen.has(x);) {
     const st = by.get(x); if (!st) break; seen.add(x); unit.push(st);
     if (st.kind === 'join') {unit.pop(); join ??= x; break;}
     x = pick(x);
    }
    if (join) unit.push(by.get(join)!);
    units.push(unit); path.push(...unit); cur = join ? pick(join) : undefined; continue;
   }
   path.push(s);
   if (!ENDS.has(s.kind)) { if (s.kind === 'decision' && units.length) units[units.length - 1]!.push(s); else units.push([s]); }
   cur = pick(cur);
  }
  return {units, path};
 }
 /** The plain walk: `next` at every step, a fork included, so a fork keeps only its first branch on the route. */
 function firstBranch(d: LWProcess.Definition): Step[] {
  const by = new Map(d.steps.map(s => [s.id, s])), path: Step[] = [], seen = new Set<string>();
  for (let cur = by.get(d.start); cur && !seen.has(cur.id);) {
   seen.add(cur.id);
   path.push(cur);
   const flow = next(d, cur.id);
   cur = flow ? by.get(flow.to) : undefined;
  }
  return path;
 }
 function mainRoute(d: LWProcess.Definition, options: LWProcessRoute.RouteOptions = {}): Step[] {
  const forks = options.forks ?? 'expand';
  if (forks === 'first-branch') return firstBranch(d);
  if (forks !== 'expand') throw new Error(`Unknown fork rule: ${String(forks)}`);
  return walk(d).path;
 }
 function phases(steps: readonly Step[]): LWProcessRoute.Group[] | null {
  const first = steps.find(s => s.phase); if (!first) return null;
  let last = first.phase!; const groups = new Map<string, Step[]>();
  for (const s of steps) { last = s.phase ?? last; (groups.get(last) ?? groups.set(last, []).get(last)!).push(s); }
  return [...groups].map(([name, list]) => ({name, steps: list}));
 }
 root.LWProcessRoute = {walk, mainRoute, next, phases};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessRoute;
})(globalThis);
