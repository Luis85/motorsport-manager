/// <reference path="./process-contracts.d.ts" />
/** Static delivery analysis: every step's declared needs must be guaranteed by arrivals or earlier steps on every route. */
declare namespace LWProcessNeeds {
 interface Delivery {field: string; steps: string[]; arrivals: boolean;}
 /** Step id -> ids of steps whose effects may land while it runs (escalated tokens beside their normal route); their values widen what it may see. */
 type Concurrency = Map<string, Set<string>>;
 interface Api {
  check(d: LWProcess.Definition, concurrent?: Concurrency): LWProcess.Diagnostic[];
  /** Earlier steps that write each needed field, plus whether every arrival supplies it. */
  deliveries(d: LWProcess.Definition, stepId: string): Delivery[];
  describe(need: LWProcess.Need): string;
  holds(need: LWProcess.Need, data: LWProcess.Fields): boolean;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessGraph: {matches(data: LWProcess.Fields, c: LWProcess.Condition): boolean}; LWProcessNeeds?: LWProcessNeeds.Api};
 // A counter's or random draw's exact value is data-dependent; the marker means "some delivered value" and satisfies only a bare delivered need.
 const ABSENT = '∅', NUMBER = '#', SYMBOL: Record<string, string> = {eq: '=', ne: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤'};
 type State = Map<string, Set<string>>;
 const describe = (n: LWProcess.Need) => n.field + (n.op ? ' ' + SYMBOL[n.op] + ' ' + JSON.stringify(n.value) : ' delivered');
 const holds = (n: LWProcess.Need, data: LWProcess.Fields) => Object.hasOwn(data, n.field) && (n.op === undefined || root.LWProcessGraph.matches(data, {field: n.field, op: n.op, value: n.value ?? null}));
 const satisfied = (n: LWProcess.Need, value: string) => value !== ABSENT && (value === NUMBER ? n.op === undefined : holds(n, {[n.field]: JSON.parse(value) as LWProcess.Scalar}));
 const clone = (s: State): State => new Map([...s].map(([k, v]) => [k, new Set(v)]));
 function union(into: State, from: State): boolean {
  let changed = false;
  for (const [field, values] of from) { const set = into.get(field) ?? new Set<string>(); if (!into.has(field)) into.set(field, set);
   for (const v of values) if (!set.has(v)) { set.add(v); changed = true; } }
  return changed;
 }
 /** The fields a step writes when it completes and the value each then holds (`set` literals; draws and counters as NUMBER), in application order. */
 const writes = (s: LWProcess.Step): [string, string][] => [...Object.entries(s.set ?? {}).map(([k, v]): [string, string] => [k, JSON.stringify(v)]),
  ...(s.draws ?? []).map((x): [string, string] => [x.field, NUMBER]), ...Object.keys(s.add ?? {}).map((k): [string, string] => [k, NUMBER])];
 /** Possible values of every tracked field on entry to each reachable step. Absent fields are an explicit value. */
 function analyse(d: LWProcess.Definition, concurrent?: LWProcessNeeds.Concurrency): Map<string, State> {
  const steps = new Map(d.steps.map(s => [s.id, s])), fields = new Set<string>();
  for (const a of d.arrivals) Object.keys(a.data).concat((a.draws ?? []).map(x => x.field)).forEach(k => fields.add(k));
  for (const s of d.steps) { writes(s).forEach(([k]) => fields.add(k)); (s.needs ?? []).forEach(n => fields.add(n.field)); if (s.instances?.field !== undefined) fields.add(s.instances.field); }
  for (const f of d.flows) if (f.when?.field !== undefined) { fields.add(f.when.field); if (f.when.valueField !== undefined) fields.add(f.when.valueField); }
  const start: State = new Map([...fields].map(f => [f, new Set(d.arrivals.map(a => Object.hasOwn(a.data, f) ? JSON.stringify(a.data[f]) : (a.draws ?? []).some(x => x.field === f) ? NUMBER : ABSENT))]));
  const entry = new Map<string, State>([[d.start, start]]);
  const out = (s: LWProcess.Step, state: State): State => { const next = clone(state); for (const [k, v] of writes(s)) next.set(k, new Set([v])); return next; };
  const edge = (flow: LWProcess.Flow): State | null => {
   const from = steps.get(flow.from)!, state = entry.get(flow.from); if (!state) return null;
   // A deadline flow leaves while the work is still unfinished: none of the step's own effects have been applied.
   if (flow.on === 'deadline') return clone(state);
   const next = out(from, state);
   if (from.kind === 'decision') {
    // Chance routes are random, so they never narrow a field; only field comparisons do.
    const conditions = d.flows.flatMap(f => f.from === from.id && f.when?.field !== undefined ? [f.when] : []);
    const keep = (field: string, test: (v: string) => boolean) => { const kept = new Set([...next.get(field) ?? []].filter(test)); next.set(field, kept); };
    // Counters and field-to-field comparisons cannot be narrowed statically, so both routes keep every possible value.
    const matches = (c: LWProcess.Condition, v: string) => v !== ABSENT && root.LWProcessGraph.matches({[c.field]: JSON.parse(v) as LWProcess.Scalar}, c);
    const open = (c: LWProcess.Condition, v: string) => v === NUMBER || c.valueField !== undefined && v !== ABSENT;
    if (flow.when?.field !== undefined) { const c = flow.when; keep(c.field, v => open(c, v) || matches(c, v)); } else if (!flow.when) for (const c of conditions) keep(c.field, v => open(c, v) || !matches(c, v));
    if ([...next.values()].some(v => !v.size)) return null;
   }
   return next;
  };
  /** Branch tokens share case data; a join keeps the value written by whichever branch wrote each field. */
  const merge = (join: LWProcess.Step): State | null => {
   const fork = d.steps.find(f => f.join === join.id), incoming = d.flows.filter(f => f.to === join.id), states = incoming.map(edge);
   if (!fork || states.some(s => !s)) return null;
   const result = clone(states[0]!), before = fork.mode === 'inclusive' ? entry.get(fork.id) : undefined;
   // An inclusive fork may skip any conditional branch, so a field a branch writes is only guaranteed if it also held before the fork.
   if (fork.mode === 'inclusive' && !before) return null;
   incoming.forEach((flow, i) => {
    let current = flow.from; const written = new Set<string>();
    for (let guard = 0; current !== fork.id && guard <= d.steps.length; guard++) {
     const step = steps.get(current); if (!step) break; Object.keys(step.set ?? {}).concat(Object.keys(step.add ?? {}), (step.draws ?? []).map(x => x.field)).forEach(k => written.add(k));
     current = d.flows.find(f => f.to === current)?.from ?? fork.id;
    }
    for (const k of written) result.set(k, new Set([...states[i]!.get(k) ?? [], ...before?.get(k) ?? []]));
   });
   return result;
  };
  for (let pass = 0, changed = true; changed && pass < d.steps.length * 4 + 8; pass++) {
   changed = false;
   for (const step of d.steps) {
    if (step.id === d.start) continue;
    const incoming = d.flows.filter(f => f.to === step.id);
    const states = step.kind === 'join' ? [merge(step)] : incoming.map(edge);
    const next: State = new Map();
    for (const s of states) if (s) union(next, s);
    if (!next.size) continue;
    // Effects of work running beside this step may land at any moment, so each such value is possible here too.
    for (const id of concurrent?.get(step.id) ?? []) for (const [k, v] of writes(steps.get(id)!)) next.get(k)?.add(v);
    const before = entry.get(step.id); if (!before) { entry.set(step.id, next); changed = true; } else if (union(before, next)) changed = true;
   }
  }
  return entry;
 }
 function check(d: LWProcess.Definition, concurrent?: LWProcessNeeds.Concurrency): LWProcess.Diagnostic[] {
  const entry = analyse(d, concurrent), errors: LWProcess.Diagnostic[] = [];
  d.steps.forEach((step, i) => {
   const state = entry.get(step.id); if (!state) return;
   (step.needs ?? []).forEach((need, j) => {
    const values = [...state.get(need.field) ?? []], unmet = values.filter(v => !satisfied(need, v));
    if (!unmet.length) return;
    const by = deliveries(d, step.id).find(x => x.field === need.field), source = by && (by.steps.length || by.arrivals) ? 'it is delivered only on some routes' : 'no earlier step or arrival delivers ' + need.field;
    errors.push({path: '/steps/' + i + '/needs/' + j, code: 'needs', message: `Needs ${describe(need)}, but ${source}; possible values: ${values.map(v => v === ABSENT ? 'not delivered' : v === NUMBER ? 'a counter or drawn value' : v).join(', ')}.`});
   });
   // `instances.field` is read when the step is entered. A field nothing delivers would fail every case; a delivered value is judged per case at run time.
   const field = step.instances?.field;
   if (field !== undefined && [...state.get(field) ?? [ABSENT]].every(v => v === ABSENT)) errors.push({path: '/steps/' + i + '/instances/field', code: 'needs', message: `Instances read case field ${field} as a whole number from 1 to 50, but no earlier step or arrival delivers ${field}, so every case would fail at this step.`});
  });
  return errors;
 }
 function deliveries(d: LWProcess.Definition, stepId: string): LWProcessNeeds.Delivery[] {
  const upstream = new Set<string>(), queue = [stepId];
  while (queue.length) { const current = queue.shift(); for (const flow of d.flows.filter(f => f.to === current)) if (!upstream.has(flow.from)) { upstream.add(flow.from); queue.push(flow.from); } }
  return (d.steps.find(s => s.id === stepId)?.needs ?? []).map(need => ({field: need.field,
   steps: d.steps.filter(s => upstream.has(s.id) && writes(s).some(([k]) => k === need.field)).map(s => s.id), arrivals: d.arrivals.every(a => Object.hasOwn(a.data, need.field) || (a.draws ?? []).some(x => x.field === need.field))}));
 }
 root.LWProcessNeeds = {check, deliveries, describe, holds};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessNeeds;
})(globalThis);
