/// <reference path="./process-contracts.d.ts" />
/**
 * The main route of a process, shared by the SIPOC view and the slide model so the rule exists once. Pure functions over a
 * detached definition: no DOM, session, clock or storage, and the definition is never changed.
 * Rule: from `start`, at each step follow the first outgoing flow without `when` that is not a deadline flow, else the first
 * non-deadline flow, and stop at a step already visited. A fork is walked with all of its branches up to its join, as one unit.
 */
declare namespace LWProcessRoute {
 interface Walk {
  /** SIPOC units: a fork with its branches and join is one unit, a decision joins the unit before it; start and end steps are left out. */
  units: LWProcess.Step[][];
  /** Every step on the main route in walk order, start and end included (a fork is followed by its branches, then its join). */
  path: LWProcess.Step[];
 }
 interface Group { name: string; steps: LWProcess.Step[]; }
 interface Api {
  walk(definition: LWProcess.Definition): Walk;
  /** The flow the main route follows out of a step: the first non-deadline flow without `when`, else the first non-deadline flow. */
  next(definition: LWProcess.Definition, stepId: string): LWProcess.Flow | undefined;
  /** Groups steps by `phase` in order of first appearance; an unphased step joins the phase before it (leading ones the first phase). Null when no step has a phase. */
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
 function phases(steps: readonly Step[]): LWProcessRoute.Group[] | null {
  const first = steps.find(s => s.phase); if (!first) return null;
  let last = first.phase!; const groups = new Map<string, Step[]>();
  for (const s of steps) { last = s.phase ?? last; (groups.get(last) ?? groups.set(last, []).get(last)!).push(s); }
  return [...groups].map(([name, list]) => ({name, steps: list}));
 }
 root.LWProcessRoute = {walk, next, phases};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessRoute;
})(globalThis);
