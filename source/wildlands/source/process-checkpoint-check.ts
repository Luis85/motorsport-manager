/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-engine-state.ts" />
/**
 * Untrusted saved engine state checks (LWProcessCheckpointCheck), owned by the process-definition context. A run checkpoint is a
 * file a person may edit or forge, so before a saved state (LWProcessEngineState.Saved) reaches a session it is checked here
 * against the definition it claims to continue. A state that passes can be reinstated and advanced without the engine meeting a
 * missing step, pool, case, group or stream; anything else is refused with an Error naming the first problem by its path
 * (`snapshot.tokens[3].stepId names no step of this process.`).
 *
 * What is checked:
 *  - Plain data only (`plain`): objects and arrays with data properties, at most 24 levels deep and `MAX_VALUES` values, and no
 *    `__proto__`, `constructor` or `prototype` key anywhere, so nothing can reach a prototype; accessors are never called.
 *  - Shape and types: every object has exactly its known fields; whole numbers are safe integers in their range; counters are not
 *    negative; case fields use the schema's field names and scalar values; text is bounded.
 *  - References: steps, pools, flows, tracked fields and arrival streams exist in the definition, in definition order where the
 *    engine indexes them; tokens, visit counters, groups, outcomes, journey sets and ledger books name active cases; token groups
 *    exist; the retirement queue is exactly the retained finished cases.
 *  - Minutes and the engine's invariants between clock commands: no time after the clock minute; timers due after it, running work
 *    with work left; pool units busy equal the demands of the running work and fit the capacity; case, arrival and pruning counts
 *    agree with the clock; series samples sit on their grid from minute 0 and the last observed frame is the clock minute.
 * The result is a detached copy built only from checked values. Nothing here ticks, reads a clock or touches storage.
 */
declare namespace LWProcessCheckpointCheck {
 interface Api {
  /** Most values (objects, arrays and leaves) one untrusted input may hold. */
  readonly MAX_VALUES: number;
  /** Refuses anything but plain JSON-like data (see the header); returns a detached copy. */
  plain(input: unknown, label?: string): unknown;
  /** Checks an untrusted saved state against `definition` and returns a detached checked copy; throws an Error naming the first problem. */
  state(definition: LWProcess.Definition, input: unknown): LWProcessEngineState.Saved;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 type Box = Record<string, unknown>;
 const root = inputRoot as {LWProcessLimits: LWProcess.Limits; LWProcessCheckpointCheck?: LWProcessCheckpointCheck.Api};
 const limits = root.LWProcessLimits;
 const MAX_VALUES = 4000000, MAX_DEPTH = 24, MAX_SEED = 2147483647, MAX_RETAINED = 10000, MAX_TOKENS = 200000, SAFE = Number.MAX_SAFE_INTEGER;
 const FIELD = /^[a-z][a-zA-Z0-9_]{0,63}$/, CASE = /^case-\d{4,12}$/, TOKEN = /^token-\d{8}$/, KIND = /^[a-z][a-z-]{0,39}$/;
 const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);
 const CLOCK = ['minute', 'serial', 'forkSerial', 'arrival', 'cost', 'arrived', 'completed', 'failed', 'dropped', 'cycle', 'pruned', 'goals', 'lost'];
 const STATUSES = ['queued', 'active', 'joining', 'backlog', 'held', 'timer'];
 const TOKEN_FIELDS = ['id', 'caseId', 'stepId', 'entered', 'started', 'input', 'remaining', 'status', 'fork', 'branch'];
 const TOKEN_OPTIONAL = ['target', 'due', 'visit', 'expected', 'item', 'items', 'group', 'deadlineAt', 'escalated'];
 const bad = (path: string, reason: string): never => { throw Error(`${path} ${reason}.`); };
 function plain(input: unknown, label = 'snapshot'): unknown {
  let values = 0;
  const stack: [unknown, string, number][] = [[input, label, 0]];
  while (stack.length) {
   const [value, path, depth] = stack.pop()!;
   if (++values > MAX_VALUES) bad(label, `holds more than ${MAX_VALUES.toLocaleString('en-US')} values`);
   if (value === null || typeof value === 'string' || typeof value === 'boolean') continue;
   if (typeof value === 'number') { if (!Number.isFinite(value)) bad(path, 'is not a finite number'); continue; }
   if (typeof value !== 'object') bad(path, 'is not JSON data');
   const proto = Object.getPrototypeOf(value), array = Array.isArray(value);
   if (proto !== (array ? Array.prototype : Object.prototype) && proto !== null) bad(path, 'is not plain data');
   if (depth >= MAX_DEPTH) bad(path, `is nested deeper than ${MAX_DEPTH} levels`);
   for (const key of Reflect.ownKeys(value as object)) {
    if (array && key === 'length') continue;
    if (typeof key !== 'string' || FORBIDDEN.has(key)) bad(path, `has the forbidden key ${String(key)}`);
    const d = Object.getOwnPropertyDescriptor(value, key)!;
    if (!('value' in d)) bad(`${path}.${key as string}`, 'is an accessor, not data');
    stack.push([d.value, array ? `${path}[${key as string}]` : `${path}.${key as string}`, depth + 1]);
   }
  }
  return JSON.parse(JSON.stringify(input)) as unknown;
 }
 function shape(v: unknown, path: string, required: readonly string[], optional: readonly string[] = []): Box {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return bad(path, 'must be an object');
  for (const key of Object.keys(v)) if (!required.includes(key) && !optional.includes(key)) bad(`${path}.${key}`, 'is not a known field');
  for (const key of required) if (!Object.hasOwn(v, key)) bad(`${path}.${key}`, 'is missing');
  return v as Box;
 }
 function whole(v: unknown, path: string, min = 0, max = SAFE): number {
  if (!Number.isSafeInteger(v) || (v as number) < min || (v as number) > max) bad(path, `must be a whole number from ${min} to ${max}`);
  return v as number;
 }
 const finite = (v: unknown, path: string) => typeof v === 'number' && Number.isFinite(v) ? v : bad(path, 'must be a finite number');
 function text(v: unknown, path: string, max = 2000, pattern?: RegExp): string {
  if (typeof v !== 'string' || v.length > max || pattern && !pattern.test(v)) {
   bad(path, pattern ? 'is not a valid id' : `must be text of at most ${max} characters`);
  }
  return v as string;
 }
 function list(v: unknown, path: string, max: number, length?: number): unknown[] {
  if (!Array.isArray(v)) return bad(path, 'must be a list');
  if (length !== undefined && v.length !== length) bad(path, `must have ${length} entries`);
  if (v.length > max) bad(path, `has more than ${max} entries`);
  return v;
 }
 const counts = (v: unknown, path: string, length: number) => list(v, path, length, length).map((n, i) => whole(n, `${path}[${i}]`));
 const nullable = <T>(v: unknown, check: (v: unknown) => T): T | null => v === null ? null : check(v);
 function fieldsOf(v: unknown, path: string): void {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) bad(path, 'must be an object of case fields');
  const box = v as Box, keys = Object.keys(box);
  if (keys.length > 256) bad(path, 'has more than 256 fields');
  for (const key of keys) {
   if (!FIELD.test(key)) bad(`${path}.${key}`, 'is not a valid field name');
   const value = box[key];
   if (typeof value === 'string') text(value, `${path}.${key}`, 256);
   else if (typeof value === 'number') finite(value, `${path}.${key}`);
   else if (value !== null && typeof value !== 'boolean') bad(`${path}.${key}`, 'must be text, a number, true, false or null');
  }
 }
 /** Unique ids; returns them as a set. */
 function unique(ids: string[], path: string): Set<string> {
  const set = new Set(ids);
  if (set.size !== ids.length) bad(path, 'repeats an id');
  return set;
 }
 function state(definition: LWProcess.Definition, input: unknown): LWProcessEngineState.Saved {
  const v = plain(input) as Box;
  shape(v, 'snapshot', ['seed', 'active', 'retained', 'clock', 'pools', 'stations', 'cases', 'tokens', 'events', 'receipts', 'receiptsDropped',
   'streams', 'finished', 'visits', 'groups', 'outcomes', 'seen', 'finishAgg', 'entryAgg', 'ledger', 'series']);
  whole(v.seed, 'snapshot.seed', 0, MAX_SEED);
  const active = whole(v.active, 'snapshot.active', 1, limits.active), retained = whole(v.retained, 'snapshot.retained', 1, MAX_RETAINED);
  const clock = shape(v.clock, 'snapshot.clock', CLOCK);
  for (const key of CLOCK) whole(clock[key], `snapshot.clock.${key}`);
  const minute = clock.minute as number, at = (n: unknown, path: string) => whole(n, path, 0, minute);
  const steps = new Map(definition.steps.map(s => [s.id, s])), step = (id: unknown, path: string) => {
   if (typeof id !== 'string' || !steps.has(id)) bad(path, 'names no step of this process');
   return steps.get(id as string)!;
  };
  const world = {v, minute, steps, step, at, active, retained, cases: new Map<string, Box>(), live: new Set<string>()};
  engine(definition, world);
  ledger(definition, v.ledger, world);
  series(definition, v.series, minute);
  return v as unknown as LWProcessEngineState.Saved;
 }
 type World = {v: Box; minute: number; steps: Map<string, LWProcess.Step>; step(id: unknown, path: string): LWProcess.Step;
  at(n: unknown, path: string): number; active: number; retained: number; cases: Map<string, Box>; live: Set<string>};
 function engine(d: LWProcess.Definition, w: World): void {
  const {v, minute, step, at} = w, clock = v.clock as Record<string, number>;
  list(v.pools, 'snapshot.pools', d.resources.length, d.resources.length);
  list(v.stations, 'snapshot.stations', d.steps.length, d.steps.length);
  d.steps.forEach((s, i) => {
   const path = `snapshot.stations[${i}]`, extra = [...s.deadline ? ['deadlines'] : [], ...s.instances ? ['items'] : []];
   const station = shape((v.stations as unknown[])[i], path, ['id', 'visits', 'completed', 'waitMinutes', 'reached', ...extra]);
   if (station.id !== s.id) bad(`${path}.id`, `must be ${s.id} (stations follow the step order)`);
   for (const key of ['visits', 'completed', 'waitMinutes', 'reached']) whole(station[key], `${path}.${key}`);
   const counters = (key: string, names: string[]) => {
    const box = shape(station[key], `${path}.${key}`, names);
    for (const name of names) whole(box[name], `${path}.${key}.${name}`);
   };
   if (s.deadline) counters('deadlines', ['interrupted', 'escalated']);
   if (s.instances) counters('items', ['started', 'finished']);
  });
  const caps = w.active + w.retained;
  list(v.cases, 'snapshot.cases', caps).forEach((c, i) => {
   const path = `snapshot.cases[${i}]`, box = shape(c, path, ['id', 'input', 'data', 'entered', 'finished', 'status', 'transitions', 'error']);
   const id = text(box.id, `${path}.id`, 24, CASE);
   if (Number(id.slice(5)) > clock.arrival!) bad(`${path}.id`, 'was never admitted (beyond the arrival counter)');
   fieldsOf(box.input, `${path}.input`); fieldsOf(box.data, `${path}.data`);
   const entered = at(box.entered, `${path}.entered`);
   whole(box.transitions, `${path}.transitions`, 0, limits.transitions + 1);
   if (!['active', 'completed', 'failed'].includes(box.status as string)) bad(`${path}.status`, 'must be active, completed or failed');
   const open = box.status === 'active';
   if (!open) whole(box.finished, `${path}.finished`, entered, minute);
   else if (box.finished !== null) bad(`${path}.finished`, 'must be null while the case is active');
   nullable(box.error, e => text(e, `${path}.error`, 4000));
   w.cases.set(id, box);
   if (open) w.live.add(id);
  });
  unique([...(v.cases as Box[]).map(c => c.id as string)], 'snapshot.cases');
  const done = list(v.finished, 'snapshot.finished', w.retained).map((id, i) => text(id, `snapshot.finished[${i}]`, 24, CASE));
  const doneSet = unique(done, 'snapshot.finished'), closed = [...w.cases.keys()].filter(id => !w.live.has(id));
  if (closed.length !== done.length || closed.some(id => !doneSet.has(id))) bad('snapshot.finished', 'must list exactly the retained finished cases');
  if (w.live.size !== clock.arrived! - clock.completed! - clock.failed!) bad('snapshot.cases', 'do not match the clock (arrived − completed − failed)');
  if (clock.arrival !== clock.arrived! + clock.dropped! || clock.pruned !== clock.completed! + clock.failed! - done.length) {
   bad('snapshot.clock', 'counts do not agree (arrival, arrived, dropped, completed, failed, pruned)');
  }
  if (clock.goals! + clock.lost! > clock.completed!) bad('snapshot.clock', 'counts more goals and losses than completed cases');
  const groups = list(v.groups, 'snapshot.groups', MAX_TOKENS).map((g, i) => {
   const path = `snapshot.groups[${i}]`, box = shape(g, path, ['id', 'count', 'done', 'started', 'input', 'visit']);
   const count = whole(box.count, `${path}.count`, 1, 50);
   whole(box.done, `${path}.done`, 0, count - 1); nullable(box.started, n => at(n, `${path}.started`));
   nullable(box.input, f => fieldsOf(f, `${path}.input`)); whole(box.visit, `${path}.visit`, 1);
   return text(box.id, `${path}.id`, 24, TOKEN);
  });
  const groupSet = unique(groups, 'snapshot.groups'), used = new Set<string>();
  const busy = new Map(d.resources.map(r => [r.id, 0]));
  const tokens = list(v.tokens, 'snapshot.tokens', MAX_TOKENS).map((t, i) => {
   const path = `snapshot.tokens[${i}]`, box = shape(t, path, TOKEN_FIELDS, TOKEN_OPTIONAL);
   const id = text(box.id, `${path}.id`, 24, TOKEN);
   if (Number(id.slice(6)) > clock.serial!) bad(`${path}.id`, 'is beyond the token serial counter');
   if (!w.live.has(box.caseId as string)) bad(`${path}.caseId`, 'names no active case');
   const s = step(box.stepId, `${path}.stepId`);
   at(box.entered, `${path}.entered`); nullable(box.started, n => at(n, `${path}.started`)); nullable(box.input, f => fieldsOf(f, `${path}.input`));
   const status = box.status as string, remaining = whole(box.remaining, `${path}.remaining`);
   if (!STATUSES.includes(status)) bad(`${path}.status`, 'is not a status a paused run can hold');
   nullable(box.fork, f => text(f, `${path}.fork`, 200)); nullable(box.branch, f => text(f, `${path}.branch`, 200));
   if (status === 'active') {
    if (remaining < 1 || box.started === null || box.input === null) bad(path, 'is running work without time left, a start or an input');
    for (const [pool, quantity] of Object.entries(s.resources ?? {})) busy.set(pool, busy.get(pool)! + quantity);
   }
   if (status === 'timer' && whole(box.due, `${path}.due`, minute + 1) <= minute) bad(`${path}.due`, 'must be after the clock minute');
   if (status === 'held' || box.target !== undefined) step(box.target, `${path}.target`);
   for (const key of ['visit', 'expected', 'item', 'items']) if (box[key] !== undefined) whole(box[key], `${path}.${key}`, 1);
   if (box.deadlineAt !== undefined) whole(box.deadlineAt, `${path}.deadlineAt`);
   if (box.due !== undefined) whole(box.due, `${path}.due`);
   if (box.escalated !== undefined && box.escalated !== true) bad(`${path}.escalated`, 'must be true when present');
   if (box.group !== undefined) {
    if (!groupSet.has(box.group as string)) bad(`${path}.group`, 'names no multi-instance group');
    used.add(box.group as string);
   }
   return id;
  });
  unique(tokens, 'snapshot.tokens');
  if (groups.some(g => !used.has(g))) bad('snapshot.groups', 'hold a group no token belongs to');
  d.resources.forEach((r, i) => {
   const path = `snapshot.pools[${i}]`, pool = shape((v.pools as unknown[])[i], path, ['id', 'busy', 'busyMinutes']);
   if (pool.id !== r.id) bad(`${path}.id`, `must be ${r.id} (pools follow the resource order)`);
   if (whole(pool.busy, `${path}.busy`, 0, r.capacity) !== busy.get(r.id)) bad(`${path}.busy`, 'does not match the running work');
   whole(pool.busyMinutes, `${path}.busyMinutes`);
  });
  history(d, w);
  maps(d, w);
 }
 function history(d: LWProcess.Definition, w: World): void {
  const {v, at} = w, stepOrEmpty = (id: unknown, path: string) => id === '' ? null : w.step(id, path);
  list(v.events, 'snapshot.events', limits.events).forEach((e, i) => {
   const path = `snapshot.events[${i}]`, box = shape(e, path, ['minute', 'kind', 'caseId', 'stepId', 'detail']);
   at(box.minute, `${path}.minute`); text(box.kind, `${path}.kind`, 40, KIND); text(box.caseId, `${path}.caseId`, 24, CASE);
   stepOrEmpty(box.stepId, `${path}.stepId`); text(box.detail, `${path}.detail`, 20000);
  });
  list(v.receipts, 'snapshot.receipts', limits.receipts).forEach((r, i) => {
   const path = `snapshot.receipts[${i}]`;
   const box = shape(r, path, ['id', 'caseId', 'stepId', 'started', 'finished', 'input', 'output', 'changes'], ['duration', 'instances']);
   text(box.id, `${path}.id`, 200); text(box.caseId, `${path}.caseId`, 24, CASE); w.step(box.stepId, `${path}.stepId`);
   at(box.started, `${path}.started`); at(box.finished, `${path}.finished`);
   for (const key of ['input', 'output', 'changes']) fieldsOf(box[key], `${path}.${key}`);
   if (box.duration !== undefined) whole(box.duration, `${path}.duration`);
   if (box.instances !== undefined) whole(box.instances, `${path}.instances`, 1, 50);
  });
  whole(v.receiptsDropped, 'snapshot.receiptsDropped');
  list(v.streams, 'snapshot.streams', d.arrivals.length, d.arrivals.length).forEach((st, i) => {
   const path = `snapshot.streams[${i}]`, box = shape(st, path, ['k', 'at']), arrival = d.arrivals[i]!;
   whole(box.k, `${path}.k`, 0, arrival.count ?? SAFE);
   nullable(box.at, n => whole(n, `${path}.at`, w.minute + 1));
  });
 }
 /** Per-case maps name active cases; aggregates name tracked fields. */
 function maps(d: LWProcess.Definition, w: World): void {
  const {v, live} = w, tracked = new Set((d.track ?? []).map(t => t.field));
  const pairs = (value: unknown, path: string) => list(value, path, MAX_TOKENS).map((p, i) => {
   const pair = list(p, `${path}[${i}]`, 2, 2);
   return [text(pair[0], `${path}[${i}][0]`, 200), pair[1], `${path}[${i}]`] as [string, unknown, string];
  });
  const caseKey = (id: string, path: string) => { if (!live.has(id)) bad(path, 'names no active case'); };
  const keys = (entries: [string, unknown, string][], path: string) => unique(entries.map(e => e[0]), path);
  const visits = pairs(v.visits, 'snapshot.visits');
  keys(visits, 'snapshot.visits');
  for (const [id, inner, path] of visits) {
   caseKey(id, path);
   const steps = pairs(inner, `${path}[1]`);
   keys(steps, `${path}[1]`);
   for (const [stepId, n, at] of steps) { if (stepId !== '#escalations') w.step(stepId, at); whole(n, at, 1); }
  }
  const outcomes = pairs(v.outcomes, 'snapshot.outcomes');
  keys(outcomes, 'snapshot.outcomes');
  for (const [id, o, path] of outcomes) { caseKey(id, path); if (o !== 'goal' && o !== 'lost') bad(path, 'must be goal or lost'); }
  const seen = pairs(v.seen, 'snapshot.seen');
  keys(seen, 'snapshot.seen');
  for (const [id, ids, path] of seen) {
   caseKey(id, path);
   unique(list(ids, path, d.steps.length).map((s, i) => w.step(s, `${path}[1][${i}]`).id), path);
  }
  const aggregate = (a: unknown, path: string) => {
   const box = shape(a, path, ['n', 'sum', 'min', 'max']);
   whole(box.n, `${path}.n`, 1); for (const key of ['sum', 'min', 'max']) finite(box[key], `${path}.${key}`);
  };
  const finish = pairs(v.finishAgg, 'snapshot.finishAgg'), entry = pairs(v.entryAgg, 'snapshot.entryAgg');
  keys(finish, 'snapshot.finishAgg'); keys(entry, 'snapshot.entryAgg');
  for (const [field, a, path] of finish) { if (!tracked.has(field)) bad(path, 'names no tracked field'); aggregate(a, `${path}[1]`); }
  for (const [key, a, path] of entry) {
   const [stepId, field] = key.split('|');
   w.step(stepId, path);
   if (!tracked.has(field ?? '')) bad(path, 'names no tracked field');
   aggregate(a, `${path}[1]`);
  }
 }
 function ledger(d: LWProcess.Definition, input: unknown, w: World): void {
  const p = 'snapshot.ledger', n = d.steps.length, FINE = 54;
  const l = shape(input, p, ['steps', 'cycles', 'minutesBy', 'failedAt', 'wipArea', 'fine', 'books', 'leadTime', 'flow', 'completedCost',
   'failedCost', 'failedMinutes', 'firstPass', 'repeats', 'ring', 'head']);
  list(l.steps, `${p}.steps`, n, n).forEach((s, i) => {
   const box = shape(s, `${p}.steps[${i}]`, ['starts', 'fixedCost', 'workCost']);
   for (const key of ['starts', 'fixedCost', 'workCost']) whole(box[key], `${p}.steps[${i}].${key}`);
  });
  counts(l.cycles, `${p}.cycles`, 17); counts(l.minutesBy, `${p}.minutesBy`, n * 6); counts(l.failedAt, `${p}.failedAt`, n);
  for (const key of ['wipArea', 'completedCost', 'failedCost', 'failedMinutes', 'firstPass']) whole(l[key], `${p}.${key}`);
  counts(l.leadTime, `${p}.leadTime`, 6); counts(l.flow, `${p}.flow`, 10); counts(l.repeats, `${p}.repeats`, 6);
  const fine = shape(l.fine, `${p}.fine`, ['cycle', 'failed', 'outcomes', 'steps']), outcomes = d.steps.some(s => s.kind === 'end' && s.outcome);
  counts(fine.cycle, `${p}.fine.cycle`, FINE); counts(fine.failed, `${p}.fine.failed`, FINE);
  if (outcomes === (fine.outcomes === null)) bad(`${p}.fine.outcomes`, outcomes ? 'is missing for a process with outcomes' : 'must be null');
  if (fine.outcomes !== null) {
   const byOutcome = shape(fine.outcomes, `${p}.fine.outcomes`, ['goal', 'lost', 'none']);
   for (const key of ['goal', 'lost', 'none']) counts(byOutcome[key], `${p}.fine.outcomes.${key}`, FINE);
  }
  list(fine.steps, `${p}.fine.steps`, n, n).forEach((s, i) => {
   list(s, `${p}.fine.steps[${i}]`, 3, 3).forEach((c, j) => counts(c, `${p}.fine.steps[${i}][${j}]`, FINE));
  });
  const running = new Set((w.v.tokens as Box[]).filter(t => t.status === 'active').map(t => t.caseId as string)), books = new Set<string>();
  list(l.books, `${p}.books`, w.active).forEach((b, i) => {
   const path = `${p}.books[${i}]`, pair = list(b, path, 2, 2), id = text(pair[0], `${path}[0]`, 24, CASE);
   if (!w.live.has(id) || books.has(id)) bad(`${path}[0]`, 'names no active case or repeats one');
   books.add(id);
   const box = shape(pair[1], `${path}[1]`, ['lead', 'cost', 'repeats']);
   counts(box.lead, `${path}[1].lead`, 6); whole(box.cost, `${path}[1].cost`); whole(box.repeats, `${path}[1].repeats`);
  });
  for (const id of running) if (!books.has(id)) bad(`${p}.books`, `has no book for ${id}, which has running work`);
  const ring = list(l.ring, `${p}.ring`, w.retained);
  ring.forEach((r, i) => {
   const path = `${p}.ring[${i}]`, box = shape(r, path, ['caseId', 'entered', 'finished', 'status', 'end', 'outcome', 'repeats', 'working']);
   text(box.caseId, `${path}.caseId`, 24, CASE); w.at(box.entered, `${path}.entered`); w.at(box.finished, `${path}.finished`);
   if (box.status !== 'completed' && box.status !== 'failed') bad(`${path}.status`, 'must be completed or failed');
   nullable(box.end, e => w.step(e, `${path}.end`));
   if (![null, 'goal', 'lost'].includes(box.outcome as string | null)) bad(`${path}.outcome`, 'must be goal, lost or null');
   whole(box.repeats, `${path}.repeats`); nullable(box.working, x => whole(x, `${path}.working`));
  });
  whole(l.head, `${p}.head`, 0, ring.length < w.retained ? 0 : w.retained - 1);
 }
 function series(d: LWProcess.Definition, input: unknown, minute: number): void {
  if (input === null) return;
  const p = 'snapshot.series', s = shape(input, p, ['every', 'points', 'level', 'count', 'data', 'previous', 'peaks']);
  const base = whole(s.every, `${p}.every`, 1, 10000), requested = whole(s.points, `${p}.points`, 64, 960);
  const width = 12 + 11 * d.steps.length + 2 * d.resources.length, points = Math.min(requested, Math.floor(400000 / width));
  // Decimation keeps the smallest level whose grid up to the last observed minute (the clock minute) fits, and every grid point is sampled.
  let level = 0;
  while (Math.floor(minute / (base * 2 ** level)) + 1 > points) level++;
  const every = base * 2 ** level, count = Math.floor(minute / every) + 1;
  if (s.level !== level || s.count !== count) bad(p, `must hold ${count} samples at level ${level} for minute ${minute}`);
  const data = list(s.data, `${p}.data`, count * width, count * width).map((x, i) => finite(x, `${p}.data[${i}]`));
  for (let i = 0; i < count; i++) if (data[i * width] !== i * every) bad(`${p}.data`, `sample ${i} is not on the grid of every ${every} minutes`);
  const previous = list(s.previous, `${p}.previous`, width + 1, width + 1).map((x, i) => finite(x, `${p}.previous[${i}]`));
  if (previous[0] !== minute) bad(`${p}.previous`, 'must be the frame of the clock minute');
  list(s.peaks, `${p}.peaks`, width, width).forEach((x, i) => finite(x, `${p}.peaks[${i}]`));
 }
 root.LWProcessCheckpointCheck = {MAX_VALUES, plain, state};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessCheckpointCheck;
})(globalThis);
