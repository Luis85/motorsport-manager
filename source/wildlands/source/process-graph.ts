/// <reference path="./process-contracts.d.ts" />
/** Graph admission and deterministic branching are domain rules, independent of ECS and rendering. */
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessGraph?: {check(d: LWProcess.Definition): LWProcess.Diagnostic[]; matches(data: LWProcess.Fields, c: LWProcess.Condition): boolean}};
 function matches(data: LWProcess.Fields, c: LWProcess.Condition): boolean {
  if (!Object.hasOwn(data, c.field)) return false;
  const value = data[c.field];
  if (c.op === 'eq') return value === c.value;
  if (c.op === 'ne') return value !== c.value;
  if (typeof value !== 'number' || typeof c.value !== 'number') return false;
  return c.op === 'gt' ? value > c.value : c.op === 'gte' ? value >= c.value : c.op === 'lt' ? value < c.value : value <= c.value;
 }
 function check(d: LWProcess.Definition): LWProcess.Diagnostic[] {
  const errors: LWProcess.Diagnostic[] = [];
  const fail = (path: string, message: string) => errors.push({path, code: 'graph', message});
  const steps = new Map(d.steps.map(s => [s.id, s])), pools = new Map(d.resources.map(r => [r.id, r]));
  const outgoing = (id: string) => d.flows.filter(f => f.from === id);
  const incoming = (id: string) => d.flows.filter(f => f.to === id);
  const unique = (values: string[], path: string) => { if (new Set(values).size !== values.length) fail(path, 'IDs must be unique.'); };
  unique(d.steps.map(s => s.id), '/steps'); unique(d.flows.map(f => f.id), '/flows');
  unique(d.resources.map(r => r.id), '/resources'); unique(d.steps.map(s => s.scene.id), '/steps/scene');
  if (steps.get(d.start)?.kind !== 'start' || d.steps.filter(s => s.kind === 'start').length !== 1) fail('/start', 'Name the single start step.');
  if (!d.steps.some(s => s.kind === 'end')) fail('/steps', 'An end step is required.');
  d.flows.forEach((f, i) => {
   if (!steps.has(f.from) || !steps.has(f.to)) fail('/flows/' + i, 'Both endpoints must exist.');
   if (f.when && steps.get(f.from)?.kind !== 'decision') fail('/flows/' + i + '/when', 'Only decisions have conditions.');
  });
  d.steps.forEach((s, i) => {
   const path = '/steps/' + i, out = outgoing(s.id), into = incoming(s.id);
   if (s.kind === 'end' ? out.length !== 0 : s.kind === 'decision' || s.kind === 'fork' ? out.length < 2 : out.length !== 1)
    fail(path, 'Invalid outgoing flow count for ' + s.kind + '.');
   if (s.kind === 'start' && into.length) fail(path, 'Start cannot have incoming flows.');
   if (s.kind === 'decision' && out.filter(f => !f.when).length !== 1) fail(path, 'Decision needs exactly one unconditional fallback.');
   if (s.kind === 'task') {
    if (s.duration === undefined) fail(path + '/duration', 'Tasks need a positive whole-minute duration.');
    for (const [id, count] of Object.entries(s.resources ?? {})) if (!pools.has(id) || count > pools.get(id)!.capacity) fail(path + '/resources/' + id, 'Demand exceeds the available pool.');
   } else if (['duration', 'cost', 'resources', 'set'].some(k => Object.hasOwn(s, k))) fail(path, 'Only tasks declare work, costs, resource demands or effects.');
   if (s.kind === 'fork' ? steps.get(s.join ?? '')?.kind !== 'join' : s.join !== undefined) fail(path + '/join', 'Only forks name a matching join step.');
  });
  const visit = (start: string, reverse: boolean) => {
   const seen = new Set<string>(), queue = [start];
   while (queue.length) { const id = queue.shift()!; if (seen.has(id)) continue; seen.add(id); queue.push(...(reverse ? incoming(id).map(f => f.from) : outgoing(id).map(f => f.to))); }
   return seen;
  };
  const reachable = visit(d.start, false), toEnd = new Set(d.steps.filter(s => s.kind === 'end').flatMap(s => [...visit(s.id, true)]));
  for (const s of d.steps) {
   if (!reachable.has(s.id)) fail('/steps/' + s.id, 'Step is unreachable from start.');
   if (!toEnd.has(s.id)) fail('/steps/' + s.id, 'Step has no route to an end.');
  }
  const owners = new Map<string, string>();
  for (const fork of d.steps.filter(s => s.kind === 'fork')) {
   const region = new Set<string>(), effects = new Set<string>();
   if (owners.has(fork.join ?? '')) fail('/steps/' + fork.id, 'A join belongs to exactly one fork.');
   owners.set(fork.join ?? '', fork.id);
   const expectedIncoming = new Set<string>();
   for (const flow of outgoing(fork.id)) {
    const path = new Set<string>(), fields = new Set<string>(); let current = flow.to, previous = fork.id;
    while (current !== fork.join) {
     const step = steps.get(current);
     if (!step || path.has(current) || region.has(current) || !['task'].includes(step.kind) || outgoing(current).length !== 1 || incoming(current).length !== 1) {
      fail('/steps/' + fork.id, 'Parallel branches must be disjoint task chains ending at their join.'); break;
     }
     path.add(current); region.add(current);
     Object.keys(step.set ?? {}).forEach(key => fields.add(key));
     previous = current; current = outgoing(current)[0]!.to;
    }
    if (current === fork.join) expectedIncoming.add(previous);
    for (const field of fields) { if (effects.has(field)) fail('/steps/' + fork.id, 'Parallel branches cannot both write ' + field + '.'); effects.add(field); }
   }
   const actual = incoming(fork.join ?? '');
   if (actual.length !== outgoing(fork.id).length || actual.some(f => !expectedIncoming.has(f.from))) fail('/steps/' + fork.id, 'Join has incoming work outside its fork.');
   if (new Set(outgoing(fork.id).map(f => f.to)).size !== outgoing(fork.id).length) fail('/steps/' + fork.id, 'Fork branches need distinct targets.');
  }
  for (const join of d.steps.filter(s => s.kind === 'join')) if (!owners.has(join.id)) fail('/steps/' + join.id, 'Join needs one owning fork.');
  const cases = d.arrivals.reduce((n, a) => n + a.count, 0);
  if (cases > 200) fail('/arrivals', 'At most 200 cases are supported.');
  for (const a of d.arrivals) if (a.at + (a.count - 1) * a.interval > 100000) fail('/arrivals', 'An arrival exceeds the 100000-minute horizon.');
  return errors;
 }
 root.LWProcessGraph = {check, matches};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessGraph;
})(globalThis);
