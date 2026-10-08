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
 /** Draw rules shared by step, timer and arrival declarations; `set` holds fixed-value fields and `add` counter fields a draw may not collide with. */
 function checkDraws(draws: LWProcess.Draw[] | undefined, path: string, fail: (path: string, message: string) => void, set: Set<string>, add: Set<string>): void {
  const seen = new Set<string>(), whole = (n: unknown) => typeof n === 'number' && Number.isInteger(n);
  (draws ?? []).forEach((d, i) => {
   const at = path + '/' + i;
   if (seen.has(d.field)) fail(at + '/field', 'Draw field ' + d.field + ' is declared twice.'); seen.add(d.field);
   if (set.has(d.field)) fail(at + '/field', 'Draw field ' + d.field + ' is also given a fixed value (set or arrival data); a field has one writer.');
   if (add.has(d.field) && d.kind !== 'int') fail(at + '/field', 'Draw field ' + d.field + ' is also a counter; only an int draw may feed an add.');
   const extra = (keys: string[], kind: string) => { for (const key of keys) if (Object.hasOwn(d, key)) fail(at + '/' + key, 'A ' + kind + ' draw does not take ' + key + '.'); };
   if (d.kind === 'chance') {
    extra(['values', 'min', 'max'], 'chance');
    if (!whole(d.percent) || d.percent! < 1 || d.percent! > 99) fail(at + '/percent', 'A chance draw needs a whole percent from 1 to 99.');
    if (JSON.stringify(Object.hasOwn(d, 'whenTrue') ? d.whenTrue : true) === JSON.stringify(Object.hasOwn(d, 'whenFalse') ? d.whenFalse : false)) fail(at, 'A chance draw needs different whenTrue and whenFalse values.');
   } else if (d.kind === 'choice') {
    extra(['percent', 'whenTrue', 'whenFalse', 'min', 'max'], 'choice');
    const values = d.values ?? [];
    if (values.length < 2 || values.length > 12) fail(at + '/values', 'A choice draw needs 2 to 12 weighted values.');
    values.forEach((v, j) => { if (!whole(v.weight) || v.weight < 1 || v.weight > 1000) fail(at + '/values/' + j + '/weight', 'A choice weight must be a whole number from 1 to 1000.'); });
    if (new Set(values.map(v => JSON.stringify(v.value))).size !== values.length) fail(at + '/values', 'Choice values must be distinct.');
   } else {
    extra(['percent', 'whenTrue', 'whenFalse', 'values'], 'int');
    if (!whole(d.min) || !whole(d.max) || d.min! > d.max!) fail(at, 'An int draw needs whole min and max with min at most max.');
   }
  });
 }
 function checkDist(dist: LWProcess.Dist | undefined, path: string, fail: (path: string, message: string) => void, limit: number): void {
  if (!dist) return;
  const whole = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= limit;
  const has = (...keys: string[]) => keys.forEach(k => { if (!whole((dist as unknown as Record<string, unknown>)[k])) fail(path + '/' + k, (dist.dist === 'exponential' ? 'An ' : 'A ') + dist.dist + ' distribution needs ' + k + ' as a whole number of minutes from 1 to ' + limit + '.'); });
  const only = (...keys: string[]) => { for (const k of ['min', 'mode', 'max', 'mean']) if (Object.hasOwn(dist, k) && !keys.includes(k)) fail(path + '/' + k, (dist.dist === 'exponential' ? 'An ' : 'A ') + dist.dist + ' distribution does not take ' + k + '.'); };
  if (dist.dist === 'uniform') { only('min', 'max'); has('min', 'max'); if (whole(dist.min) && whole(dist.max) && dist.min! > dist.max!) fail(path, 'A uniform distribution needs min at most max.'); }
  else if (dist.dist === 'triangular') {
   only('min', 'mode', 'max'); has('min', 'mode', 'max');
   if (whole(dist.min) && whole(dist.mode) && whole(dist.max) && !(dist.min! <= dist.mode! && dist.mode! <= dist.max!)) fail(path, 'A triangular distribution needs min <= mode <= max.');
  } else {
   only('mean', 'max'); has('mean'); if (Object.hasOwn(dist, 'max')) has('max');
   if (whole(dist.mean) && whole(dist.max) && dist.mean! > dist.max!) fail(path, 'An exponential distribution needs mean at most max.');
  }
 }
 /** Tasks, machine steps and system steps all execute work with duration, cost and resource demands. */
 const works = (s: LWProcess.Step) => s.kind === 'task' || s.kind === 'machine' || s.kind === 'system';
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
   const w = f.when as Record<string, unknown> | undefined;
   if (w && w.chance !== undefined) {
    if (['field', 'op', 'value', 'valueField'].some(k => w[k] !== undefined)) fail('/flows/' + i + '/when', 'A condition uses exactly one form: chance, or field and op with a value or valueField.');
    else if (typeof w.chance !== 'number' || !Number.isInteger(w.chance) || w.chance < 1 || w.chance > 99) fail('/flows/' + i + '/when/chance', 'A chance route needs a whole percent from 1 to 99.');
   } else if (w && (w.field === undefined || w.op === undefined)) fail('/flows/' + i + '/when', 'A condition needs a field and an operator, or a chance percent.');
   else if (w && (w.value === undefined) === (w.valueField === undefined)) fail('/flows/' + i + '/when', 'A condition compares to exactly one of a value or another case field (valueField).');
  });
  d.steps.forEach((s, i) => {
   const path = '/steps/' + i, out = outgoing(s.id), into = incoming(s.id);
   if (s.kind === 'end' ? out.length !== 0 : s.kind === 'decision' || s.kind === 'fork' ? out.length < 2 : out.length !== 1)
    fail(path, 'Invalid outgoing flow count for ' + s.kind + '.');
   if (s.kind === 'start' && into.length) fail(path, 'Start cannot have incoming flows.');
   if (s.kind === 'decision' && out.filter(f => !f.when).length !== 1) fail(path, 'Decision needs exactly one unconditional fallback.');
   if (works(s)) {
    const label = s.kind === 'task' ? 'Tasks' : s.kind === 'machine' ? 'Machine steps' : 'System steps', wanted = s.kind === 'task' ? 'people' : s.kind;
    if (s.duration === undefined) fail(path + '/duration', label + ' need a positive whole-minute duration.');
    if (s.until !== undefined) fail(path + '/until', 'Only timers wait until a minute.');
    for (const [id, count] of Object.entries(s.resources ?? {})) {
     const pool = pools.get(id);
     if (!pool || count > pool.capacity) fail(path + '/resources/' + id, 'Demand exceeds the available pool.');
     else if ((pool.kind ?? 'people') !== wanted) fail(path + '/resources/' + id, label + ' may demand only ' + wanted + ' pools, but "' + id + '" is a ' + (pool.kind ?? 'people') + ' pool.');
    }
    if (s.kind !== 'task' && !Object.keys(s.resources ?? {}).length) fail(path + '/resources', 'A ' + s.kind + ' step must demand at least one ' + s.kind + ' pool.');
    checkDist(s.timing, path + '/timing', fail, limits.minutes);
    if (s.kind === 'task' && s.technology !== undefined) fail(path + '/technology', 'Technology is declared only on machine and system steps.');
    const outputs = new Set<string>();
    (s.outputs ?? []).forEach((o, j) => {
     if (outputs.has(o.field)) fail(path + '/outputs/' + j, 'Output ' + o.field + ' is declared twice.');
     outputs.add(o.field);
     if (!Object.hasOwn(s.set ?? {}, o.field) && !Object.hasOwn(s.add ?? {}, o.field) && !(s.draws ?? []).some(d => d.field === o.field)) fail(path + '/outputs/' + j, 'Step "' + s.name + '" declares output ' + o.field + ' but does not deliver it with set, add or draws.');
    });
   } else if (s.kind === 'timer') {
    if ((s.duration === undefined) === (s.until === undefined)) fail(path, 'A timer needs exactly one of a whole-minute duration or an absolute until minute.');
    if (s.until !== undefined && s.until >= limits.minutes) fail(path + '/until', 'A timer must expire before the ' + limits.minutes + '-minute horizon.');
    if (s.timing !== undefined && s.until !== undefined) fail(path + '/timing', 'Timing applies to duration timers only, not to an until timer.');
    checkDist(s.timing, path + '/timing', fail, limits.minutes);
    for (const key of ['cost', 'resources', 'backlog', 'technology', 'outputs']) if (Object.hasOwn(s, key)) fail(path + '/' + key, 'Timers hold work without resources, costs or a backlog.');
   } else if (['duration', 'until', 'cost', 'resources', 'set', 'add', 'technology', 'outputs', 'timing', 'draws'].some(k => Object.hasOwn(s, k))) fail(path, 'Only work steps (task, machine, system) and timers declare work, waits, costs, resource demands, timing or effects; technology and outputs belong to work steps.');
   if (works(s) || s.kind === 'timer') checkDraws(s.draws, path + '/draws', fail, new Set(Object.keys(s.set ?? {})), new Set(Object.keys(s.add ?? {})));
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
    if (!works(s) && s.kind !== 'join') fail(path + '/backlog', 'Only work steps (task, machine, system) and joins hold a backlog.');
    if (b.order === 'priority' && !b.priority) fail(path + '/backlog/priority', 'Priority order needs the numeric case field to rank by.');
    if (b.order !== 'priority' && b.priority !== undefined) fail(path + '/backlog/priority', 'A priority field needs priority order.');
    if (b.pull !== undefined && !(next && works(next))) fail(path + '/backlog/pull', 'A pull limit needs a join whose next step is a work step (task, machine or system).');
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
     if (!step || path.has(current) || region.has(current) || !works(step) && step.kind !== 'timer' || outgoing(current).length !== 1 || incoming(current).length !== 1) {
      fail(at(fork.id), 'Parallel branches must be disjoint chains of work steps (task, machine, system) or timers ending at their join.'); break;
     }
     path.add(current); region.add(current);
     Object.keys(step.set ?? {}).concat(Object.keys(step.add ?? {}), (step.draws ?? []).map(x => x.field)).forEach(key => fields.add(key));
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
  const cases = d.arrivals.reduce((n, a) => n + (a.count ?? 0), 0);
  if (cases > limits.cases) fail('/arrivals', 'At most ' + limits.cases + ' cases are supported in count arrivals; use until or open for longer streams.');
  d.arrivals.forEach((a, i) => {
   const path = '/arrivals/' + i, rules = [a.count !== undefined, a.until !== undefined, a.open !== undefined].filter(Boolean).length;
   if (rules !== 1) fail(path, 'An arrival needs exactly one end rule: count, until or open.');
   // An arrival at the horizon minute could never start work: tasks last at least one minute.
   if (a.count !== undefined && a.gap === undefined && a.at + (a.count - 1) * a.interval >= limits.minutes || a.at >= limits.minutes) fail(path, 'An arrival must occur before the ' + limits.minutes + '-minute horizon.');
   if (a.until !== undefined && a.until <= a.at) fail(path + '/until', 'An arrival stream must end after its first arrival minute (until greater than at).');
   if ((a.until !== undefined || a.open !== undefined || a.gap !== undefined) && a.interval < 1) fail(path + '/interval', 'Streams with until, open or gap need an interval of at least 1 minute (the mean spacing).');
   checkDist(a.gap, path + '/gap', fail, limits.minutes);
   checkDraws(a.draws, path + '/draws', fail, new Set(Object.keys(a.data)), new Set());
  });
  return errors;
 }
 root.LWProcessGraph = {check, matches};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessGraph;
})(globalThis);
