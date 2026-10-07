/// <reference path="./process-contracts.d.ts" />
/** Graph admission and deterministic branching are domain rules, independent of ECS and rendering. */
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessLimits: LWProcess.Limits; LWProcessNeeds: {check(d: LWProcess.Definition): LWProcess.Diagnostic[]}; LWProcessGraph?: {check(d: LWProcess.Definition): LWProcess.Diagnostic[]; matches(data: LWProcess.Fields, c: LWProcess.Condition): boolean}};
 function matches(data: LWProcess.Fields, c: LWProcess.Condition): boolean {
  if (!Object.hasOwn(data, c.field)) return false;
  const value = data[c.field];
  // A field-to-field comparison needs the other field too; a missing one never matches.
  if (c.valueField !== undefined && !Object.hasOwn(data, c.valueField)) return false;
  const other = c.valueField === undefined ? c.value : data[c.valueField];
  if (c.op === 'eq') return value === other;
  if (c.op === 'ne') return value !== other;
  if (typeof value !== 'number' || typeof other !== 'number') return false;
  return c.op === 'gt' ? value > other : c.op === 'gte' ? value >= other : c.op === 'lt' ? value < other : value <= other;
 }
 function check(d: LWProcess.Definition): LWProcess.Diagnostic[] {
  const limits = root.LWProcessLimits, errors: LWProcess.Diagnostic[] = [];
  const fail = (path: string, message: string) => errors.push({path, code: 'graph', message});
  const steps = new Map(d.steps.map(s => [s.id, s])), pools = new Map(d.resources.map(r => [r.id, r]));
  const outgoing = (id: string) => d.flows.filter(f => f.from === id);
  const incoming = (id: string) => d.flows.filter(f => f.to === id);
  const index = new Map(d.steps.map((s, i) => [s.id, i]));
  const at = (id: string) => '/steps/' + (index.get(id) ?? -1);
  const unique = (values: string[], path: string) => { const seen = new Set<string>(); values.forEach((v, i) => { if (seen.has(v)) fail(path + '/' + i + (path === '/steps' ? '/id' : ''), 'IDs must be unique.'); seen.add(v); }); };
  const seenScenes = new Set<string>();
  d.steps.forEach((s, i) => { if (seenScenes.has(s.scene.id)) fail('/steps/' + i + '/scene/id', 'IDs must be unique.'); seenScenes.add(s.scene.id); });
  unique(d.steps.map(s => s.id), '/steps'); unique(d.flows.map(f => f.id), '/flows');
  unique(d.resources.map(r => r.id), '/resources');
  if (steps.get(d.start)?.kind !== 'start' || d.steps.filter(s => s.kind === 'start').length !== 1) fail('/start', 'Name the single start step.');
  if (!d.steps.some(s => s.kind === 'end')) fail('/steps', 'An end step is required.');
  d.flows.forEach((f, i) => {
   if (!steps.has(f.from) || !steps.has(f.to)) fail('/flows/' + i, 'Both endpoints must exist.');
   if (f.when && steps.get(f.from)?.kind !== 'decision') fail('/flows/' + i + '/when', 'Only decisions have conditions.');
   if (f.when && (f.when.value === undefined) === (f.when.valueField === undefined)) fail('/flows/' + i + '/when', 'A condition compares to exactly one of a value or another case field (valueField).');
  });
  d.steps.forEach((s, i) => {
   const path = '/steps/' + i, out = outgoing(s.id), into = incoming(s.id);
   if (s.kind === 'end' ? out.length !== 0 : s.kind === 'decision' || s.kind === 'fork' ? out.length < 2 : out.length !== 1)
    fail(path, 'Invalid outgoing flow count for ' + s.kind + '.');
   if (s.kind === 'start' && into.length) fail(path, 'Start cannot have incoming flows.');
   if (s.kind === 'decision' && out.filter(f => !f.when).length !== 1) fail(path, 'Decision needs exactly one unconditional fallback.');
   if (s.kind === 'task') {
    if (s.duration === undefined) fail(path + '/duration', 'Tasks need a positive whole-minute duration.');
    if (s.until !== undefined) fail(path + '/until', 'Only timers wait until a minute.');
    for (const [id, count] of Object.entries(s.resources ?? {})) if (!pools.has(id) || count > pools.get(id)!.capacity) fail(path + '/resources/' + id, 'Demand exceeds the available pool.');
   } else if (s.kind === 'timer') {
    if ((s.duration === undefined) === (s.until === undefined)) fail(path, 'A timer needs exactly one of a whole-minute duration or an absolute until minute.');
    if (s.until !== undefined && s.until >= limits.minutes) fail(path + '/until', 'A timer must expire before the ' + limits.minutes + '-minute horizon.');
    for (const key of ['cost', 'resources', 'backlog']) if (Object.hasOwn(s, key)) fail(path + '/' + key, 'Timers hold work without resources, costs or a backlog.');
   } else if (['duration', 'until', 'cost', 'resources', 'set', 'add'].some(k => Object.hasOwn(s, k))) fail(path, 'Only tasks and timers declare work, waits, costs, resource demands or effects.');
   if (s.add !== undefined) {
    if (!Object.keys(s.add).length) fail(path + '/add', 'Name at least one counter field to add to.');
    for (const [field, delta] of Object.entries(s.add)) if (delta === 0) fail(path + '/add/' + field, 'A counter step must add a nonzero whole number.');
   }
   (s.needs ?? []).forEach((n, j) => {
    if (s.kind === 'start') fail(path + '/needs/' + j, 'The start step has no earlier step to deliver its needs.');
    if ((n.op === undefined) !== (n.value === undefined)) fail(path + '/needs/' + j, 'A need names an operator and a value together, or neither.');
   });
   if (s.backlog) {
    const b = s.backlog, next = s.kind === 'join' ? steps.get(out[0]?.to ?? '') : undefined;
    if (s.kind !== 'task' && s.kind !== 'join') fail(path + '/backlog', 'Only tasks and joins hold a backlog.');
    if (b.order === 'priority' && !b.priority) fail(path + '/backlog/priority', 'Priority order needs the numeric case field to rank by.');
    if (b.order !== 'priority' && b.priority !== undefined) fail(path + '/backlog/priority', 'A priority field needs priority order.');
    if (b.pull !== undefined && next?.kind !== 'task') fail(path + '/backlog/pull', 'A pull limit needs a join whose next step is a task.');
   }
   if (s.kind === 'fork' && steps.get(s.join ?? '')?.kind !== 'join') fail(path + '/join', 'A fork must name an existing join step.');
   else if (s.kind !== 'fork' && s.join !== undefined) fail(path + '/join', 'Only forks name a join step.');
  });
  const visit = (start: string, reverse: boolean) => {
   const seen = new Set<string>(), queue = [start];
   while (queue.length) { const id = queue.shift()!; if (seen.has(id)) continue; seen.add(id); queue.push(...(reverse ? incoming(id).map(f => f.from) : outgoing(id).map(f => f.to))); }
   return seen;
  };
  const reachable = visit(d.start, false), toEnd = new Set(d.steps.filter(s => s.kind === 'end').flatMap(s => [...visit(s.id, true)]));
  for (const s of d.steps) {
   if (!reachable.has(s.id)) fail(at(s.id), 'Step is unreachable from start.');
   if (!toEnd.has(s.id)) fail(at(s.id), 'Step has no route to an end.');
  }
  const owners = new Map<string, string>();
  for (const fork of d.steps.filter(s => s.kind === 'fork')) {
   const region = new Set<string>(), effects = new Set<string>();
   if (owners.has(fork.join ?? '')) fail(at(fork.id), 'A join belongs to exactly one fork.');
   owners.set(fork.join ?? '', fork.id);
   const expectedIncoming = new Set<string>();
   for (const flow of outgoing(fork.id)) {
    const path = new Set<string>(), fields = new Set<string>(); let current = flow.to, previous = fork.id;
    while (current !== fork.join) {
     const step = steps.get(current);
     if (!step || path.has(current) || region.has(current) || step.kind !== 'task' && step.kind !== 'timer' || outgoing(current).length !== 1 || incoming(current).length !== 1) {
      fail(at(fork.id), 'Parallel branches must be disjoint task or timer chains ending at their join.'); break;
     }
     path.add(current); region.add(current);
     Object.keys(step.set ?? {}).concat(Object.keys(step.add ?? {})).forEach(key => fields.add(key));
     previous = current; current = outgoing(current)[0]!.to;
    }
    if (current === fork.join) expectedIncoming.add(previous);
    for (const field of fields) { if (effects.has(field)) fail(at(fork.id), 'Parallel branches cannot both write ' + field + '.'); effects.add(field); }
   }
   const actual = incoming(fork.join ?? '');
   if (actual.length !== outgoing(fork.id).length || actual.some(f => !expectedIncoming.has(f.from))) fail(at(fork.id), 'Join has incoming work outside its fork.');
   if (new Set(outgoing(fork.id).map(f => f.to)).size !== outgoing(fork.id).length) fail(at(fork.id), 'Fork branches need distinct targets.');
  }
  for (const join of d.steps.filter(s => s.kind === 'join')) if (!owners.has(join.id)) fail(at(join.id), 'Join needs one owning fork.');
  if (!errors.length) errors.push(...root.LWProcessNeeds.check(d));
  const cases = d.arrivals.reduce((n, a) => n + a.count, 0);
  if (cases > limits.cases) fail('/arrivals', 'At most ' + limits.cases + ' cases are supported.');
  // An arrival at the horizon minute could never start work: tasks last at least one minute.
  d.arrivals.forEach((a, i) => { if (a.at + (a.count - 1) * a.interval >= limits.minutes) fail('/arrivals/' + i, 'An arrival must occur before the ' + limits.minutes + '-minute horizon.'); });
  return errors;
 }
 root.LWProcessGraph = {check, matches};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessGraph;
})(globalThis);
