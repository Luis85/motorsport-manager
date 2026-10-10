/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-graph-routes.ts" />
/**
 * Graph admission and deterministic branching are domain rules, independent of ECS and rendering. This module owns the
 * semantic checks of an admitted shape (identities, conditions, flows, per-step and per-arrival rules, distributions and
 * draws) and the condition evaluation the runtime uses. Route analysis (reachability, fork regions, deadlines) lives in
 * process-graph-routes.ts and the needs analysis in process-needs.ts; `check` calls both in a fixed order, so the
 * diagnostics of a definition always come out in the same order.
 */
(function(inputRoot: unknown) {
 'use strict';
 type Fail = (path: string, message: string) => void;
 type Evaluate = (data: LWProcess.Fields, when: LWProcess.When, chance: (path: string, percent: number) => boolean) => boolean;
 const root = inputRoot as {
  LWProcessLimits: LWProcess.Limits;
  LWProcessNeeds: {check(d: LWProcess.Definition, concurrent?: LWProcessNeeds.Concurrency): LWProcess.Diagnostic[]};
  LWProcessGraphRoutes: LWProcessGraphRoutes.Api;
  LWProcessGraph?: {
   check(d: LWProcess.Definition): LWProcess.Diagnostic[]; matches(data: LWProcess.Fields, c: LWProcess.Condition): boolean;
   evaluate: Evaluate; hasChance(when: LWProcess.When | undefined): boolean;
  };
 };
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
  * Evaluates any condition form against case data. `chance(path, percent)` answers a chance leaf; `path` is '' for a top-level
  * chance and otherwise the leaf's position ('0', '1.n', ...: list index, or `n` under a not), so every leaf can own a keyed
  * random stream. all/any short-circuit in authored order, which never changes a result because a keyed draw has no state.
  * A missing field never matches, so `not` of it is true.
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
  if (!when) return false;
  return when.chance !== undefined || !!when.all?.some(hasChance) || !!when.any?.some(hasChance) || !!when.not && hasChance(when.not);
 }
 const whole = (n: unknown) => typeof n === 'number' && Number.isInteger(n);
 /**
  * Draw rules shared by step, timer and arrival declarations; `set` holds fixed-value fields and `add` counter fields a draw
  * may not collide with.
  */
 function checkDraws(draws: LWProcess.Draw[] | undefined, path: string, fail: Fail, set: Set<string>, add: Set<string>): void {
  const seen = new Set<string>();
  (draws ?? []).forEach((d, i) => {
   const at = path + '/' + i;
   if (seen.has(d.field)) fail(at + '/field', 'Draw field ' + d.field + ' is declared twice.');
   seen.add(d.field);
   if (set.has(d.field)) fail(at + '/field', 'Draw field ' + d.field + ' is also given a fixed value (set or arrival data); a field has one writer.');
   if (add.has(d.field) && d.kind !== 'int') fail(at + '/field', 'Draw field ' + d.field + ' is also a counter; only an int draw may feed an add.');
   const extra = (keys: string[], kind: string) => {
    for (const key of keys) if (Object.hasOwn(d, key)) fail(at + '/' + key, 'A ' + kind + ' draw does not take ' + key + '.');
   };
   if (d.kind === 'chance') {
    extra(['values', 'min', 'max'], 'chance');
    if (!whole(d.percent) || d.percent! < 1 || d.percent! > 99) fail(at + '/percent', 'A chance draw needs a whole percent from 1 to 99.');
    const yes = Object.hasOwn(d, 'whenTrue') ? d.whenTrue : true, no = Object.hasOwn(d, 'whenFalse') ? d.whenFalse : false;
    if (JSON.stringify(yes) === JSON.stringify(no)) fail(at, 'A chance draw needs different whenTrue and whenFalse values.');
   } else if (d.kind === 'choice') {
    extra(['percent', 'whenTrue', 'whenFalse', 'min', 'max'], 'choice');
    const values = d.values ?? [];
    if (values.length < 2 || values.length > 12) fail(at + '/values', 'A choice draw needs 2 to 12 weighted values.');
    values.forEach((v, j) => {
     if (!whole(v.weight) || v.weight < 1 || v.weight > 1000) fail(at + '/values/' + j + '/weight', 'A choice weight must be a whole number from 1 to 1000.');
    });
    if (new Set(values.map(v => JSON.stringify(v.value))).size !== values.length) fail(at + '/values', 'Choice values must be distinct.');
   } else {
    extra(['percent', 'whenTrue', 'whenFalse', 'values'], 'int');
    if (!whole(d.min) || !whole(d.max) || d.min! > d.max!) fail(at, 'An int draw needs whole min and max with min at most max.');
   }
  });
 }
 /** Per-kind parameters and ranges of a timing, deadline or gap distribution; values are whole minutes from 1 to `limit`. */
 function checkDist(dist: LWProcess.Dist | undefined, path: string, fail: Fail, limit: number): void {
  if (!dist) return;
  const article = dist.dist === 'exponential' || dist.dist === 'erlang' ? 'An ' : 'A ', label = article + dist.dist + ' distribution';
  const inRange = (n: unknown, high = limit) => whole(n) && (n as number) >= 1 && (n as number) <= high;
  const has = (...keys: string[]) => keys.forEach(k => {
   if (inRange((dist as unknown as Record<string, unknown>)[k])) return;
   fail(path + '/' + k, label + ' needs ' + k + ' as a whole number of minutes from 1 to ' + limit + '.');
  });
  const only = (...keys: string[]) => {
   for (const k of ['min', 'mode', 'max', 'mean', 'sd', 'k']) {
    if (Object.hasOwn(dist, k) && !keys.includes(k)) fail(path + '/' + k, label + ' does not take ' + k + '.');
   }
  };
  if (dist.dist === 'uniform') {
   only('min', 'max');
   has('min', 'max');
   if (inRange(dist.min) && inRange(dist.max) && dist.min! > dist.max!) fail(path, 'A uniform distribution needs min at most max.');
  } else if (dist.dist === 'triangular') {
   only('min', 'mode', 'max');
   has('min', 'mode', 'max');
   const ordered = dist.min! <= dist.mode! && dist.mode! <= dist.max!;
   if (inRange(dist.min) && inRange(dist.mode) && inRange(dist.max) && !ordered) fail(path, 'A triangular distribution needs min <= mode <= max.');
  } else if (dist.dist === 'normal') {
   only('mean', 'sd', 'min', 'max');
   has('mean', 'sd');
   for (const k of ['min', 'max']) if (Object.hasOwn(dist, k)) has(k);
   // The result is clamped to [min (default 1), max (default mean + 6 sd, never above the limit)]; that range must not be empty.
   const low = dist.min ?? 1, high = inRange(dist.mean) && inRange(dist.sd) ? Math.min(limit, dist.max ?? dist.mean! + 6 * dist.sd!) : limit;
   if (inRange(low) && inRange(high) && low > high) {
    fail(path, 'A normal distribution needs min at most max (max defaults to mean + 6 sd, at most ' + limit + ').');
   }
  } else if (dist.dist === 'erlang') {
   only('k', 'mean');
   has('mean');
   if (!inRange(dist.k, 32)) fail(path + '/k', 'An erlang distribution needs k as a whole number from 1 to 32.');
  } else {
   only('mean', 'max');
   has('mean');
   if (Object.hasOwn(dist, 'max')) has('max');
   if (inRange(dist.mean) && inRange(dist.max) && dist.mean! > dist.max!) fail(path, 'An exponential distribution needs mean at most max.');
  }
 }
 const A_KIND: Record<LWProcess.Kind, string> = {start: 'The start step', task: 'A task', touchpoint: 'A touchpoint', machine: 'A machine step',
  system: 'A system step', timer: 'A timer', decision: 'A decision', fork: 'A fork', join: 'A join', end: 'An end step'};
 /** What a step of this kind needs and what it has, e.g. 'A task needs exactly 1 outgoing flow; this one has 0.' A deadline flow is not counted. */
 function flowCount(s: LWProcess.Step, found: number): string {
  const branching = s.kind === 'decision' || s.kind === 'fork';
  const wanted = s.kind === 'end' ? 'no outgoing flow' : branching ? 'at least 2 outgoing flows' : 'exactly 1 outgoing flow';
  const deadline = s.deadline ? ' besides its deadline flow' : '';
  return (A_KIND[s.kind] ?? 'A ' + s.kind + ' step') + ' needs ' + wanted + deadline + '; this one has ' + found + '.';
 }
 /** Tasks, touchpoints, machine steps and system steps all execute work with duration, cost and resource demands. */
 const works = (s: LWProcess.Step) => s.kind === 'task' || s.kind === 'touchpoint' || s.kind === 'machine' || s.kind === 'system';
 /** Lookups the per-step rules share within one check. */
 interface Scope {
  fail: Fail; limits: LWProcess.Limits; steps: Map<string, LWProcess.Step>; pools: Map<string, LWProcess.Resource>;
  outgoing(id: string): LWProcess.Flow[]; normal(id: string): LWProcess.Flow[]; incoming(id: string): LWProcess.Flow[];
 }
 // Every key of every condition form, read loosely: admission judges data that only passed the structural schema.
 type Loose = {[K in 'field' | 'op' | 'value' | 'valueField' | 'chance' | 'all' | 'any' | 'not']?: unknown};
 /** A condition is exactly one form: field comparison, chance, or all/any/not (at most 3 combinator levels and 8 leaves per `when`). */
 function checkWhen(fail: Fail, w: Loose, path: string, level: number, leaves: {n: number}): void {
  const combinators = (['all', 'any', 'not'] as const).filter(k => w[k] !== undefined);
  if (combinators.length) {
   if (combinators.length > 1 || (['field', 'op', 'value', 'valueField', 'chance'] as const).some(k => w[k] !== undefined)) {
    fail(path, 'A condition uses exactly one form: a field comparison, chance, all, any or not.');
    return;
   }
   if (level > 3) {
    fail(path, 'Conditions nest at most 3 combinators deep.');
    return;
   }
   const kind = combinators[0]!, children = kind === 'not' ? [w.not] : w[kind] as unknown[];
   if (!Array.isArray(children) || !children.length) {
    fail(path + '/' + kind, 'The ' + kind + ' combinator needs a non-empty list of conditions.');
    return;
   }
   children.forEach((c, j) => checkWhen(fail, c as Loose, path + '/' + (kind === 'not' ? 'not' : kind + '/' + j), level + 1, leaves));
   return;
  }
  if (++leaves.n === 9) fail(path, 'A condition has at most 8 leaves (comparisons and chances).');
  if (w.chance !== undefined) {
   if ((['field', 'op', 'value', 'valueField'] as const).some(k => w[k] !== undefined)) {
    fail(path, 'A condition uses exactly one form: chance, or field and op with a value or valueField.');
   } else if (typeof w.chance !== 'number' || !Number.isInteger(w.chance) || w.chance < 1 || w.chance > 99) {
    fail(path + '/chance', 'A chance route needs a whole percent from 1 to 99.');
   }
  } else if (w.field === undefined || w.op === undefined) fail(path, 'A condition needs a field and an operator, or a chance percent.');
  else if ((w.value === undefined) === (w.valueField === undefined)) {
   fail(path, 'A condition compares to exactly one of a value or another case field (valueField).');
  }
 }
 /** Rules of the flows themselves; returns true when a flow names a missing endpoint (a dangling flow). */
 function checkFlows(d: LWProcess.Definition, g: Scope): boolean {
  // A flow whose endpoint is missing makes every route through it look broken; its own message is the root cause.
  let dangling = false;
  d.flows.forEach((f, i) => {
   const path = '/flows/' + i;
   if (!g.steps.has(f.from) || !g.steps.has(f.to)) {
    dangling = true;
    g.fail(path, 'Both endpoints must exist.');
   }
   const from = g.steps.get(f.from);
   if (f.on !== undefined && (!from?.deadline || from.deadline.flow !== f.id)) {
    g.fail(path + '/on', 'A flow marked on "deadline" must leave a work step whose deadline names it (deadline.flow).');
   }
   if (f.on !== undefined && f.when) g.fail(path + '/when', 'A deadline flow takes no condition.');
   const conditional = from?.kind === 'decision' || from?.kind === 'fork' && from.mode === 'inclusive';
   if (f.when && f.on === undefined && !conditional) {
    g.fail(path + '/when', 'Only decisions have conditions (flows leaving an inclusive fork may also carry one).');
   }
   if (f.when) checkWhen(g.fail, f.when, path + '/when', 1, {n: 0});
  });
  return dangling;
 }
 /** Work steps (task, touchpoint, machine, system): duration, pool demands, timing, instances, deadline, technology and outputs. */
 function checkWork(s: LWProcess.Step, path: string, g: Scope): void {
  const fail = g.fail, kind = s.kind;
  const label = kind === 'task' ? 'Tasks' : kind === 'touchpoint' ? 'Touchpoints' : kind === 'machine' ? 'Machine steps' : 'System steps';
  const wanted = kind === 'task' ? 'people' : kind;
  if (s.duration === undefined) fail(path + '/duration', label + ' need a positive whole-minute duration.');
  if (s.until !== undefined) fail(path + '/until', 'Only timers wait until a minute.');
  for (const [id, count] of Object.entries(s.resources ?? {})) {
   const pool = g.pools.get(id), at = path + '/resources/' + id;
   if (!pool) fail(at, 'Uses pool "' + id + '", which is not defined.');
   else if (count > pool.capacity) fail(at, 'Demand exceeds the available pool.');
   else if (kind !== 'touchpoint' && (pool.kind ?? 'people') !== wanted) {
    fail(at, label + ' may demand only ' + wanted + ' pools, but "' + id + '" is a ' + (pool.kind ?? 'people') + ' pool.');
   }
  }
  if (kind !== 'task' && kind !== 'touchpoint' && !Object.keys(s.resources ?? {}).length) {
   fail(path + '/resources', 'A ' + kind + ' step must demand at least one ' + kind + ' pool.');
  }
  checkDist(s.timing, path + '/timing', fail, g.limits.minutes);
  if (s.instances) {
   if ((s.instances.count !== undefined) === (s.instances.field !== undefined)) {
    fail(path + '/instances', 'Instances need exactly one of count (2 to 50) or field (a case field holding 1 to 50).');
   }
   if (s.backlog) fail(path + '/backlog', 'A multi-instance step cannot declare a backlog.');
  }
  if (s.deadline) {
   const dl = s.deadline, mine = g.outgoing(s.id).filter(f => f.on === 'deadline');
   if ((dl.after === undefined) === (dl.timing === undefined)) {
    fail(path + '/deadline', 'A deadline needs exactly one of after (whole minutes) or timing (a distribution).');
   }
   checkDist(dl.timing, path + '/deadline/timing', fail, g.limits.minutes);
   if (mine.length !== 1 || mine[0]!.id !== dl.flow) {
    fail(path + '/deadline/flow', 'A deadline needs exactly one flow leaving this step marked on "deadline", and deadline.flow must name it.');
   }
  }
  if ((kind === 'task' || kind === 'touchpoint') && s.technology !== undefined) {
   fail(path + '/technology', 'Technology is declared only on machine and system steps.');
  }
  const outputs = new Set<string>();
  (s.outputs ?? []).forEach((o, j) => {
   if (outputs.has(o.field)) fail(path + '/outputs/' + j, 'Output ' + o.field + ' is declared twice.');
   outputs.add(o.field);
   const delivered = Object.hasOwn(s.set ?? {}, o.field) || Object.hasOwn(s.add ?? {}, o.field) || (s.draws ?? []).some(d => d.field === o.field);
   if (!delivered) fail(path + '/outputs/' + j, 'Step "' + s.name + '" declares output ' + o.field + ' but does not deliver it with set, add or draws.');
  });
 }
 /** Timers wait a duration or until an absolute minute; they hold no work, resources, costs or backlog. */
 function checkTimer(s: LWProcess.Step, path: string, g: Scope): void {
  const fail = g.fail, horizon = g.limits.minutes;
  if ((s.duration === undefined) === (s.until === undefined)) fail(path, 'A timer needs exactly one of a whole-minute duration or an absolute until minute.');
  if (s.until !== undefined && s.until >= horizon) fail(path + '/until', 'A timer must expire before the ' + horizon + '-minute horizon.');
  if (s.timing !== undefined && s.until !== undefined) fail(path + '/timing', 'Timing applies to duration timers only, not to an until timer.');
  checkDist(s.timing, path + '/timing', fail, horizon);
  for (const key of ['cost', 'resources', 'backlog', 'technology', 'outputs']) {
   if (Object.hasOwn(s, key)) fail(path + '/' + key, 'Timers hold work without resources, costs or a backlog.');
  }
  for (const key of ['instances', 'deadline']) {
   if (Object.hasOwn(s, key)) fail(path + '/' + key, 'Only work steps (task, touchpoint, machine, system) take ' + key + '; timers do not.');
  }
 }
 const WORK_ONLY = ['duration', 'until', 'cost', 'resources', 'set', 'add', 'technology', 'outputs', 'timing', 'draws', 'instances', 'deadline'];
 /** Counters, needs, backlogs and fork joins, after the kind rules of one step. */
 function checkStepData(s: LWProcess.Step, path: string, out: LWProcess.Flow[], g: Scope): void {
  const fail = g.fail;
  if (s.add !== undefined) {
   if (!Object.keys(s.add).length) fail(path + '/add', 'Name at least one counter field to add to.');
   for (const [field, delta] of Object.entries(s.add)) if (delta === 0) fail(path + '/add/' + field, 'A counter step must add a nonzero whole number.');
  }
  (s.needs ?? []).forEach((n, j) => {
   if (s.kind === 'start') fail(path + '/needs/' + j, 'The start step has no earlier step to deliver its needs.');
   if ((n.op === undefined) !== (n.value === undefined)) fail(path + '/needs/' + j, 'A need names an operator and a value together, or neither.');
  });
  if (s.backlog) {
   const b = s.backlog, next = s.kind === 'join' ? g.steps.get(out[0]?.to ?? '') : undefined;
   if (!works(s) && s.kind !== 'join') fail(path + '/backlog', 'Only work steps (task, touchpoint, machine, system) and joins hold a backlog.');
   if (b.order === 'priority' && !b.priority) fail(path + '/backlog/priority', 'Priority order needs the numeric case field to rank by.');
   if (b.order !== 'priority' && b.priority !== undefined) fail(path + '/backlog/priority', 'A priority field needs priority order.');
   if (b.pull !== undefined && !(next && works(next))) {
    fail(path + '/backlog/pull', 'A pull limit needs a join whose next step is a work step (task, touchpoint, machine or system).');
   }
  }
  if (s.kind === 'fork' && g.steps.get(s.join ?? '')?.kind !== 'join') fail(path + '/join', 'A fork must name an existing join step.');
  else if (s.kind !== 'fork' && s.join !== undefined) fail(path + '/join', 'Only forks name a join step.');
 }
 function checkStep(s: LWProcess.Step, i: number, g: Scope): void {
  const fail = g.fail, path = '/steps/' + i, out = g.normal(s.id), into = g.incoming(s.id);
  const branching = s.kind === 'decision' || s.kind === 'fork';
  if (s.kind === 'end' ? out.length !== 0 : branching ? out.length < 2 : out.length !== 1) fail(path, flowCount(s, out.length));
  if (s.channel !== undefined && s.kind !== 'touchpoint') fail(path + '/channel', 'A channel is declared only on touchpoint steps.');
  if (s.outcome !== undefined && s.kind !== 'end') fail(path + '/outcome', 'An outcome (goal or lost) is declared only on end steps.');
  if (s.kind === 'start' && into.length) fail(path, 'Start cannot have incoming flows.');
  if (s.kind === 'decision' && out.filter(f => !f.when).length !== 1) fail(path, 'Decision needs exactly one unconditional fallback.');
  if (s.mode !== undefined && s.kind !== 'fork') fail(path + '/mode', 'Only forks declare a mode.');
  if (s.kind === 'fork' && s.mode === 'inclusive' && out.filter(f => !f.when).length > 1) {
   fail(path, 'An inclusive fork allows at most one flow without a condition (its default flow).');
  }
  if (works(s)) checkWork(s, path, g);
  else if (s.kind === 'timer') checkTimer(s, path, g);
  else if (WORK_ONLY.some(k => Object.hasOwn(s, k))) {
   fail(path, 'Only work steps (task, machine, system) and timers declare work, waits, costs, resource demands, timing or effects; '
    + 'technology and outputs belong to work steps.');
  }
  if (works(s) || s.kind === 'timer') {
   checkDraws(s.draws, path + '/draws', fail, new Set(Object.keys(s.set ?? {})), new Set(Object.keys(s.add ?? {})));
  }
  checkStepData(s, path, out, g);
 }
 /** Count limits and the end rule, horizon and spacing of every arrival rule. */
 function checkArrivals(d: LWProcess.Definition, g: Scope): void {
  const fail = g.fail, limits = g.limits;
  const cases = d.arrivals.reduce((n, a) => n + (a.count ?? 0), 0);
  if (cases > limits.cases) fail('/arrivals', 'At most ' + limits.cases + ' cases are supported in count arrivals; use until or open for longer streams.');
  d.arrivals.forEach((a, i) => {
   const path = '/arrivals/' + i, rules = [a.count !== undefined, a.until !== undefined, a.open !== undefined].filter(Boolean).length;
   if (rules !== 1) fail(path, 'An arrival needs exactly one end rule: count, until or open.');
   // An arrival at the horizon minute could never start work: tasks last at least one minute.
   const lastCounted = a.count !== undefined && a.gap === undefined && a.at + (a.count - 1) * a.interval >= limits.minutes;
   if (lastCounted || a.at >= limits.minutes) fail(path, 'An arrival must occur before the ' + limits.minutes + '-minute horizon.');
   if (a.until !== undefined && a.until <= a.at) fail(path + '/until', 'An arrival stream must end after its first arrival minute (until greater than at).');
   if ((a.until !== undefined || a.open !== undefined || a.gap !== undefined) && a.interval < 1) {
    fail(path + '/interval', 'Streams with until, open or gap need an interval of at least 1 minute (the mean spacing).');
   }
   checkDist(a.gap, path + '/gap', fail, limits.minutes);
   checkDraws(a.draws, path + '/draws', fail, new Set(Object.keys(a.data)), new Set());
  });
 }
 /** Identities must be unique: step, flow, resource and scene ids, tracked fields and SIPOC party names. */
 function checkIdentities(d: LWProcess.Definition, fail: Fail): void {
  const unique = (values: string[], path: string) => {
   const seen = new Set<string>();
   values.forEach((v, i) => {
    if (seen.has(v)) fail(path + '/' + i + (path === '/steps' ? '/id' : ''), 'IDs must be unique.');
    seen.add(v);
   });
  };
  const seenScenes = new Set<string>();
  d.steps.forEach((s, i) => {
   if (seenScenes.has(s.scene.id)) fail('/steps/' + i + '/scene/id', 'IDs must be unique.');
   seenScenes.add(s.scene.id);
  });
  unique(d.steps.map(s => s.id), '/steps');
  unique(d.flows.map(f => f.id), '/flows');
  unique(d.resources.map(r => r.id), '/resources');
  const tracked = new Set<string>();
  (d.track ?? []).forEach((t, i) => {
   if (tracked.has(t.field)) fail('/track/' + i + '/field', 'Tracked field ' + t.field + ' is listed twice.');
   tracked.add(t.field);
  });
  (['suppliers', 'customers'] as const).forEach(key => {
   const names = new Set<string>();
   (d.sipoc?.[key] ?? []).forEach((p, i) => {
    if (names.has(p.name)) fail('/sipoc/' + key + '/' + i + '/name', 'Party ' + p.name + ' is listed twice.');
    names.add(p.name);
   });
  });
 }
 function check(d: LWProcess.Definition): LWProcess.Diagnostic[] {
  const errors: LWProcess.Diagnostic[] = [];
  const fail = (path: string, message: string) => errors.push({path, code: 'graph', message});
  const outgoing = (id: string) => d.flows.filter(f => f.from === id);
  const g: Scope = {fail, limits: root.LWProcessLimits, steps: new Map(d.steps.map(s => [s.id, s])), pools: new Map(d.resources.map(r => [r.id, r])),
   outgoing, normal: id => outgoing(id).filter(f => f.on !== 'deadline'), incoming: id => d.flows.filter(f => f.to === id)};
  checkIdentities(d, fail);
  if (g.steps.get(d.start)?.kind !== 'start' || d.steps.filter(s => s.kind === 'start').length !== 1) fail('/start', 'Name the single start step.');
  if (!d.steps.some(s => s.kind === 'end')) fail('/steps', 'An end step is required.');
  const dangling = checkFlows(d, g);
  d.steps.forEach((s, i) => checkStep(s, i, g));
  const concurrent = root.LWProcessGraphRoutes.check(d, fail, dangling);
  if (!errors.length) errors.push(...root.LWProcessNeeds.check(d, concurrent));
  checkArrivals(d, g);
  return errors;
 }
 root.LWProcessGraph = {check, matches, evaluate, hasChance};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessGraph;
})(globalThis);
