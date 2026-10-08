/// <reference path="./process-contracts.d.ts" />
/** Graph admission and deterministic branching are domain rules, independent of ECS and rendering. */
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessLimits: LWProcess.Limits; LWProcessNeeds: {check(d: LWProcess.Definition): LWProcess.Diagnostic[]}; LWProcessGraph?: {check(d: LWProcess.Definition): LWProcess.Diagnostic[]; matches(data: LWProcess.Fields, c: LWProcess.Condition): boolean;
  evaluate(data: LWProcess.Fields, when: LWProcess.When, chance: (path: string, percent: number) => boolean): boolean; hasChance(when: LWProcess.When | undefined): boolean}};
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
 /**
  * Evaluates any condition form against case data. `chance(path, percent)` answers a chance leaf; `path` is '' for a top-level chance and otherwise
  * the leaf's position ('0', '1.n', ...: list index, or `n` under a not), so every leaf can own a keyed random stream. all/any short-circuit in
  * authored order, which never changes a result because a keyed draw has no state. A missing field never matches, so `not` of it is true.
  */
 function evaluate(data: LWProcess.Fields, when: LWProcess.When, chance: (path: string, percent: number) => boolean, path = ''): boolean {
  const at = (segment: string | number) => path ? path + '.' + segment : String(segment);
  if (when.all !== undefined) return when.all.every((c, i) => evaluate(data, c, chance, at(i)));
  if (when.any !== undefined) return when.any.some((c, i) => evaluate(data, c, chance, at(i)));
  if (when.not !== undefined) return !evaluate(data, when.not, chance, at('n'));
  return when.chance !== undefined ? chance(path, when.chance) : matches(data, when);
 }
 /** Whether any leaf of a condition is a chance route; such a decision or fork counts visits so its draws are keyed. */
 function hasChance(when: LWProcess.When | undefined): boolean {
  return !!when && (when.chance !== undefined || !!when.all?.some(hasChance) || !!when.any?.some(hasChance) || !!when.not && hasChance(when.not));
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
  const article = dist.dist === 'exponential' || dist.dist === 'erlang' ? 'An ' : 'A ', label = article + dist.dist + ' distribution';
  const whole = (n: unknown, high = limit) => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= high;
  const has = (...keys: string[]) => keys.forEach(k => { if (!whole((dist as unknown as Record<string, unknown>)[k])) fail(path + '/' + k, label + ' needs ' + k + ' as a whole number of minutes from 1 to ' + limit + '.'); });
  const only = (...keys: string[]) => { for (const k of ['min', 'mode', 'max', 'mean', 'sd', 'k']) if (Object.hasOwn(dist, k) && !keys.includes(k)) fail(path + '/' + k, label + ' does not take ' + k + '.'); };
  if (dist.dist === 'uniform') { only('min', 'max'); has('min', 'max'); if (whole(dist.min) && whole(dist.max) && dist.min! > dist.max!) fail(path, 'A uniform distribution needs min at most max.'); }
  else if (dist.dist === 'triangular') {
   only('min', 'mode', 'max'); has('min', 'mode', 'max');
   if (whole(dist.min) && whole(dist.mode) && whole(dist.max) && !(dist.min! <= dist.mode! && dist.mode! <= dist.max!)) fail(path, 'A triangular distribution needs min <= mode <= max.');
  } else if (dist.dist === 'normal') {
   only('mean', 'sd', 'min', 'max'); has('mean', 'sd'); for (const k of ['min', 'max']) if (Object.hasOwn(dist, k)) has(k);
   // The result is clamped to [min (default 1), max (default mean + 6 sd, never above the limit)]; that range must not be empty.
   const low = dist.min ?? 1, high = whole(dist.mean) && whole(dist.sd) ? Math.min(limit, dist.max ?? dist.mean! + 6 * dist.sd!) : limit;
   if (whole(low) && whole(high) && low > high) fail(path, 'A normal distribution needs min at most max (max defaults to mean + 6 sd, at most ' + limit + ').');
  } else if (dist.dist === 'erlang') {
   only('k', 'mean'); has('mean');
   if (!whole(dist.k, 32)) fail(path + '/k', 'An erlang distribution needs k as a whole number from 1 to 32.');
  } else {
   only('mean', 'max'); has('mean'); if (Object.hasOwn(dist, 'max')) has('max');
   if (whole(dist.mean) && whole(dist.max) && dist.mean! > dist.max!) fail(path, 'An exponential distribution needs mean at most max.');
  }
 }
 /** Tasks, touchpoints, machine steps and system steps all execute work with duration, cost and resource demands. */
 const works = (s: LWProcess.Step) => s.kind === 'task' || s.kind === 'touchpoint' || s.kind === 'machine' || s.kind === 'system';
 function check(d: LWProcess.Definition): LWProcess.Diagnostic[] {
  const limits = root.LWProcessLimits, errors: LWProcess.Diagnostic[] = [];
  const fail = (path: string, message: string) => errors.push({path, code: 'graph', message});
  const steps = new Map(d.steps.map(s => [s.id, s])), pools = new Map(d.resources.map(r => [r.id, r]));
  const outgoing = (id: string) => d.flows.filter(f => f.from === id);
  // A step's normal outgoing flows exclude the extra flow of its deadline.
  const normal = (id: string) => outgoing(id).filter(f => f.on !== 'deadline');
  const incoming = (id: string) => d.flows.filter(f => f.to === id);
  const index = new Map(d.steps.map((s, i) => [s.id, i]));
  const at = (id: string) => '/steps/' + (index.get(id) ?? -1);
  const unique = (values: string[], path: string) => { const seen = new Set<string>(); values.forEach((v, i) => { if (seen.has(v)) fail(path + '/' + i + (path === '/steps' ? '/id' : ''), 'IDs must be unique.'); seen.add(v); }); };
  const seenScenes = new Set<string>();
  d.steps.forEach((s, i) => { if (seenScenes.has(s.scene.id)) fail('/steps/' + i + '/scene/id', 'IDs must be unique.'); seenScenes.add(s.scene.id); });
  unique(d.steps.map(s => s.id), '/steps'); unique(d.flows.map(f => f.id), '/flows');
  unique(d.resources.map(r => r.id), '/resources');
  const tracked = new Set<string>();
  (d.track ?? []).forEach((t, i) => { if (tracked.has(t.field)) fail('/track/' + i + '/field', 'Tracked field ' + t.field + ' is listed twice.'); tracked.add(t.field); });
  (['suppliers', 'customers'] as const).forEach(key => { const names = new Set<string>(); (d.sipoc?.[key] ?? []).forEach((p, i) => { if (names.has(p.name)) fail('/sipoc/' + key + '/' + i + '/name', 'Party ' + p.name + ' is listed twice.'); names.add(p.name); }); });
  if (steps.get(d.start)?.kind !== 'start' || d.steps.filter(s => s.kind === 'start').length !== 1) fail('/start', 'Name the single start step.');
  if (!d.steps.some(s => s.kind === 'end')) fail('/steps', 'An end step is required.');
  // A condition is exactly one form: field comparison, chance, or all/any/not (at most 3 combinator levels and 8 leaves per `when`).
  const checkWhen = (w: Record<string, unknown>, path: string, level: number, leaves: {n: number}): void => {
   const combinators = ['all', 'any', 'not'].filter(k => w[k] !== undefined);
   if (combinators.length) {
    if (combinators.length > 1 || ['field', 'op', 'value', 'valueField', 'chance'].some(k => w[k] !== undefined)) { fail(path, 'A condition uses exactly one form: a field comparison, chance, all, any or not.'); return; }
    if (level > 3) { fail(path, 'Conditions nest at most 3 combinators deep.'); return; }
    const kind = combinators[0]!, children = kind === 'not' ? [w.not] : w[kind] as unknown[];
    if (!Array.isArray(children) || !children.length) { fail(path + '/' + kind, 'The ' + kind + ' combinator needs a non-empty list of conditions.'); return; }
    children.forEach((c, j) => checkWhen(c as Record<string, unknown>, path + '/' + (kind === 'not' ? 'not' : kind + '/' + j), level + 1, leaves));
    return;
   }
   if (++leaves.n === 9) fail(path, 'A condition has at most 8 leaves (comparisons and chances).');
   if (w.chance !== undefined) {
    if (['field', 'op', 'value', 'valueField'].some(k => w[k] !== undefined)) fail(path, 'A condition uses exactly one form: chance, or field and op with a value or valueField.');
    else if (typeof w.chance !== 'number' || !Number.isInteger(w.chance) || w.chance < 1 || w.chance > 99) fail(path + '/chance', 'A chance route needs a whole percent from 1 to 99.');
   } else if (w.field === undefined || w.op === undefined) fail(path, 'A condition needs a field and an operator, or a chance percent.');
   else if ((w.value === undefined) === (w.valueField === undefined)) fail(path, 'A condition compares to exactly one of a value or another case field (valueField).');
  };
  d.flows.forEach((f, i) => {
   if (!steps.has(f.from) || !steps.has(f.to)) fail('/flows/' + i, 'Both endpoints must exist.');
   const from = steps.get(f.from);
   if (f.on !== undefined && (!from?.deadline || from.deadline.flow !== f.id)) fail('/flows/' + i + '/on', 'A flow marked on "deadline" must leave a work step whose deadline names it (deadline.flow).');
   if (f.on !== undefined && f.when) fail('/flows/' + i + '/when', 'A deadline flow takes no condition.');
   if (f.when && f.on === undefined && !(from?.kind === 'decision' || from?.kind === 'fork' && from.mode === 'inclusive')) fail('/flows/' + i + '/when', 'Only decisions have conditions (flows leaving an inclusive fork may also carry one).');
   if (f.when) checkWhen(f.when as unknown as Record<string, unknown>, '/flows/' + i + '/when', 1, {n: 0});
  });
  d.steps.forEach((s, i) => {
   const path = '/steps/' + i, out = normal(s.id), into = incoming(s.id);
   if (s.kind === 'end' ? out.length !== 0 : s.kind === 'decision' || s.kind === 'fork' ? out.length < 2 : out.length !== 1)
    fail(path, 'Invalid outgoing flow count for ' + s.kind + '.');
   if (s.channel !== undefined && s.kind !== 'touchpoint') fail(path + '/channel', 'A channel is declared only on touchpoint steps.');
   if (s.outcome !== undefined && s.kind !== 'end') fail(path + '/outcome', 'An outcome (goal or lost) is declared only on end steps.');
   if (s.kind === 'start' && into.length) fail(path, 'Start cannot have incoming flows.');
   if (s.kind === 'decision' && out.filter(f => !f.when).length !== 1) fail(path, 'Decision needs exactly one unconditional fallback.');
   if (s.mode !== undefined && s.kind !== 'fork') fail(path + '/mode', 'Only forks declare a mode.');
   if (s.kind === 'fork' && s.mode === 'inclusive' && out.filter(f => !f.when).length > 1) fail(path, 'An inclusive fork allows at most one flow without a condition (its default flow).');
   if (works(s)) {
    const label = s.kind === 'task' ? 'Tasks' : s.kind === 'touchpoint' ? 'Touchpoints' : s.kind === 'machine' ? 'Machine steps' : 'System steps', wanted = s.kind === 'task' ? 'people' : s.kind;
    if (s.duration === undefined) fail(path + '/duration', label + ' need a positive whole-minute duration.');
    if (s.until !== undefined) fail(path + '/until', 'Only timers wait until a minute.');
    for (const [id, count] of Object.entries(s.resources ?? {})) {
     const pool = pools.get(id);
     if (!pool || count > pool.capacity) fail(path + '/resources/' + id, 'Demand exceeds the available pool.');
     else if (s.kind !== 'touchpoint' && (pool.kind ?? 'people') !== wanted) fail(path + '/resources/' + id, label + ' may demand only ' + wanted + ' pools, but "' + id + '" is a ' + (pool.kind ?? 'people') + ' pool.');
    }
    if (s.kind !== 'task' && s.kind !== 'touchpoint' && !Object.keys(s.resources ?? {}).length) fail(path + '/resources', 'A ' + s.kind + ' step must demand at least one ' + s.kind + ' pool.');
    checkDist(s.timing, path + '/timing', fail, limits.minutes);
    if (s.instances) {
     if ((s.instances.count !== undefined) === (s.instances.field !== undefined)) fail(path + '/instances', 'Instances need exactly one of count (2 to 50) or field (a case field holding 1 to 50).');
     if (s.backlog) fail(path + '/backlog', 'A multi-instance step cannot declare a backlog.');
    }
    if (s.deadline) {
     const dl = s.deadline, mine = outgoing(s.id).filter(f => f.on === 'deadline');
     if ((dl.after === undefined) === (dl.timing === undefined)) fail(path + '/deadline', 'A deadline needs exactly one of after (whole minutes) or timing (a distribution).');
     checkDist(dl.timing, path + '/deadline/timing', fail, limits.minutes);
     if (mine.length !== 1 || mine[0]!.id !== dl.flow) fail(path + '/deadline/flow', 'A deadline needs exactly one flow leaving this step marked on "deadline", and deadline.flow must name it.');
    }
    if ((s.kind === 'task' || s.kind === 'touchpoint') && s.technology !== undefined) fail(path + '/technology', 'Technology is declared only on machine and system steps.');
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
    for (const key of ['instances', 'deadline']) if (Object.hasOwn(s, key)) fail(path + '/' + key, 'Only work steps (task, touchpoint, machine, system) take ' + key + '; timers do not.');
   } else if (['duration', 'until', 'cost', 'resources', 'set', 'add', 'technology', 'outputs', 'timing', 'draws', 'instances', 'deadline'].some(k => Object.hasOwn(s, k))) fail(path, 'Only work steps (task, machine, system) and timers declare work, waits, costs, resource demands, timing or effects; technology and outputs belong to work steps.');
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
    if (!works(s) && s.kind !== 'join') fail(path + '/backlog', 'Only work steps (task, touchpoint, machine, system) and joins hold a backlog.');
    if (b.order === 'priority' && !b.priority) fail(path + '/backlog/priority', 'Priority order needs the numeric case field to rank by.');
    if (b.order !== 'priority' && b.priority !== undefined) fail(path + '/backlog/priority', 'A priority field needs priority order.');
    if (b.pull !== undefined && !(next && works(next))) fail(path + '/backlog/pull', 'A pull limit needs a join whose next step is a work step (task, touchpoint, machine or system).');
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
  const owners = new Map<string, string>(), regionOf = new Map<string, string>();
  for (const fork of d.steps.filter(s => s.kind === 'fork')) {
   const region = new Set<string>(), effects = new Set<string>(), label = fork.mode === 'inclusive' ? 'Inclusive' : 'Parallel';
   if (owners.has(fork.join ?? '')) fail(at(fork.id), 'A join belongs to exactly one fork.');
   owners.set(fork.join ?? '', fork.id);
   const expectedIncoming = new Set<string>();
   for (const flow of outgoing(fork.id)) {
    const path = new Set<string>(), fields = new Set<string>(); let current = flow.to, previous = fork.id;
    while (current !== fork.join) {
     const step = steps.get(current);
     if (!step || path.has(current) || region.has(current) || !works(step) && step.kind !== 'timer' || normal(current).length !== 1 || incoming(current).length !== 1) {
      fail(at(fork.id), label + ' branches must be disjoint chains of work steps (task, touchpoint, machine, system) or timers ending at their join.'); break;
     }
     path.add(current); region.add(current); regionOf.set(current, fork.id);
     Object.keys(step.set ?? {}).concat(Object.keys(step.add ?? {}), (step.draws ?? []).map(x => x.field)).forEach(key => fields.add(key));
     previous = current; current = normal(current)[0]!.to;
    }
    if (current === fork.join) expectedIncoming.add(previous);
    for (const field of fields) { if (effects.has(field)) fail(at(fork.id), label + ' branches cannot both write ' + field + '.'); effects.add(field); }
   }
   const actual = incoming(fork.join ?? '');
   if (actual.length !== outgoing(fork.id).length || actual.some(f => !expectedIncoming.has(f.from))) fail(at(fork.id), 'Join has incoming work outside its fork.');
   if (new Set(outgoing(fork.id).map(f => f.to)).size !== outgoing(fork.id).length) fail(at(fork.id), 'Fork branches need distinct targets.');
  }
  for (const join of d.steps.filter(s => s.kind === 'join')) if (!owners.has(join.id)) fail(at(join.id), 'Join needs one owning fork.');
  // Boundary deadlines: an interrupt must not strand a join, and an escalation needs its own route to an end that shares nothing with the normal route.
  for (const s of d.steps) {
   const flow = s.deadline && outgoing(s.id).find(f => f.on === 'deadline' && f.id === s.deadline!.flow);
   if (!s.deadline || !flow || !steps.has(flow.to)) continue;
   const path = at(s.id) + '/deadline';
   if (s.deadline.mode === 'interrupt' && regionOf.has(s.id)) fail(path + '/mode', 'A step inside a parallel or inclusive region can only escalate; an interrupt would strand the join.');
   if (s.deadline.mode !== 'escalate') continue;
   // The normal route is everything reachable from the step's normal flow, except through this deadline flow itself (a rework loop returns to the step).
   const main = new Set([s.id]), queue = normal(s.id).map(f => f.to);
   while (queue.length) { const id = queue.shift()!; if (!main.has(id)) { main.add(id); queue.push(...outgoing(id).filter(f => f.id !== flow.id).map(f => f.to)); } }
   const away = visit(flow.to, false);
   if (![...away].some(id => steps.get(id)?.kind === 'end')) fail(path, 'The escalation path must reach an end step.');
   const shared = [...away].filter(id => main.has(id));
   if (shared.length) fail(path, 'The escalation path must not share steps with the normal route (shared: ' + shared.join(', ') + ').');
   for (const id of away) if (steps.get(id)?.deadline?.mode === 'escalate') fail(path, 'An escalated token cannot be escalated again, but step "' + id + '" on the escalation path declares an escalating deadline.');
  }
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
 root.LWProcessGraph = {check, matches, evaluate, hasChance};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessGraph;
})(globalThis);
