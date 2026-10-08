/// <reference path="./process-contracts.d.ts" />
/** Process token transitions, atomic pool allocation and structured joins over shared ECS storage. */
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessLimits: LWProcess.Limits; LWProcessNeeds: LWProcessNeeds.Api; LWProcessGraph: {matches(data: LWProcess.Fields, c: LWProcess.Condition): boolean}; LWProcessRandom: LWProcessRandom.Api; LWProcessSystems?: LWProcess.Systems};
 const limits = root.LWProcessLimits;
 // Locale-independent code-unit order keeps replays identical across hosts.
 // Shorter ids sort first so case-10000 follows case-9999 in long streams.
 const compare = (a: string, b: string) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
 const random = root.LWProcessRandom;
 /** Tokens in creation order. The list is rebuilt only after tokens are created or destroyed; callers must not mutate it. */
 const tokens = (s: LWProcess.State) => s.tokenList ??= s.world.query(['process-token']).map(id => s.world.get<LWProcess.Token>(id, 'process-token')!);
 const SERIAL_LIMIT = 99999999;
 function createToken(s: LWProcess.State, token: LWProcess.Token): void {
  s.world.create(token.id); s.world.set<LWProcess.Token>(token.id, 'process-token', token); s.tokenList = null;
 }
 function destroyToken(s: LWProcess.State, id: string): void { s.world.destroy(id); s.tokenList = null; }
 const nextSerial = (s: LWProcess.State) => {
  if (s.clock.serial >= SERIAL_LIMIT) throw Error('The run created more than ' + SERIAL_LIMIT + ' tokens; start a new run.');
  return 'token-' + String(++s.clock.serial).padStart(8, '0');
 };
 /** Per-case visit counter for a step; the number keys that visit's random draws, independent of scheduling order. */
 function visitOf(s: LWProcess.State, caseId: string, stepId: string): number {
  let byStep = s.visits.get(caseId); if (!byStep) { byStep = new Map(); s.visits.set(caseId, byStep); }
  const n = (byStep.get(stepId) ?? 0) + 1; byStep.set(stepId, n); return n;
 }
 const drawn = (s: LWProcess.State, draw: LWProcess.Draw, key: string): LWProcess.Scalar => draw.kind === 'chance'
  ? random.chance(s.seed, key, draw.percent!) ? Object.hasOwn(draw, 'whenTrue') ? draw.whenTrue! : true : Object.hasOwn(draw, 'whenFalse') ? draw.whenFalse! : false
  : draw.kind === 'int' ? random.int(s.seed, key, draw.min!, draw.max!) : random.weighted(s.seed, key, draw.values!);
 const caseOf = (s: LWProcess.State, t: LWProcess.Token) => s.world.get<LWProcess.Case>(t.caseId, 'process-case')!;
 const station = (s: LWProcess.State, id: string) => s.world.get<LWProcess.Station>('station-' + id, 'process-station')!;
 const pool = (s: LWProcess.State, id: string) => s.world.get<LWProcess.Pool>('pool-' + id, 'process-pool')!;
 const event = (s: LWProcess.State, kind: string, c: string, step: string, detail = '') => {
  s.events.push({minute: s.clock.minute, kind, caseId: c, stepId: step, detail});
  if (s.events.length > limits.events) s.events.shift();
 };
 function release(s: LWProcess.State, t: LWProcess.Token): void {
  for (const [id, quantity] of Object.entries(s.steps.get(t.stepId)!.resources ?? {})) pool(s, id).busy -= quantity;
 }
 function fail(s: LWProcess.State, c: LWProcess.Case, message: string): void {
  if (c.status !== 'active') return;
  c.status = 'failed'; c.error = message; c.finished = s.clock.minute; s.clock.failed++;
  for (const t of tokens(s).filter(t => t.caseId === c.id)) { if (t.status === 'active') release(s, t); destroyToken(s, t.id); }
  event(s, 'failed', c.id, '', message); retire(s, c.id);
 }
 /** A finished case leaves the world oldest-first once more than the retention limit is kept; run aggregates already hold its totals. */
 function retire(s: LWProcess.State, caseId: string): void {
  s.visits.delete(caseId); s.finished.push(caseId);
  while (s.finished.length > s.retained) { s.world.destroy(s.finished.shift()!); s.clock.pruned++; }
 }
 // Tasks, machine steps and system steps execute identically; only the pool kind they may demand differs.
 const works = (step: LWProcess.Step) => step.kind === 'task' || step.kind === 'machine' || step.kind === 'system';
 const holds = ['routing', 'queued'], stored = ['backlog'];
 /** Work waiting at a step: a task's queue or a join's backlog. Joins' branch arrivals never count against capacity. */
 const inStore = (s: LWProcess.State, id: string) => tokens(s).filter(t => t.stepId === id && (s.steps.get(id)!.kind === 'join' ? stored : holds).includes(t.status));
 const accepts = (s: LWProcess.State, id: string) => { const step = s.steps.get(id)!; return !step.backlog || step.kind === 'join' || inStore(s, id).length < step.backlog.capacity; };
 const ranking = (s: LWProcess.State, step: LWProcess.Step) => {
  const base = (a: LWProcess.Token, b: LWProcess.Token) => a.entered - b.entered || compare(a.caseId, b.caseId) || compare(a.id, b.id);
  const rank = (t: LWProcess.Token) => { const v = caseOf(s, t).data[step.backlog!.priority!]; return typeof v === 'number' ? v : 0; };
  const order = step.backlog?.order ?? 'fifo';
  return order === 'lifo' ? (a: LWProcess.Token, b: LWProcess.Token) => base(b, a) : order === 'priority' ? (a: LWProcess.Token, b: LWProcess.Token) => rank(b) - rank(a) || base(a, b) : base;
 };
 const unmet = (s: LWProcess.State, c: LWProcess.Case, step: LWProcess.Step) => (step.needs ?? []).find(n => !root.LWProcessNeeds.holds(n, c.data));
 function failNeed(s: LWProcess.State, c: LWProcess.Case, step: LWProcess.Step, need: LWProcess.Need): void {
  fail(s, c, 'Step "' + step.name + '" needs ' + root.LWProcessNeeds.describe(need) + (need.label ? ' (' + need.label + ')' : '') + ' but earlier steps did not deliver it.');
 }
 function enter(s: LWProcess.State, t: LWProcess.Token, stepId: string): void {
  if (!accepts(s, stepId)) {
   if (t.status !== 'held') event(s, 'held', t.caseId, t.stepId, 'Backlog of ' + s.steps.get(stepId)!.name + ' is full.');
   t.status = 'held'; t.target = stepId; return;
  }
  delete t.target; delete t.due; t.stepId = stepId; t.entered = s.clock.minute; t.started = null; t.remaining = 0; t.input = null; t.status = 'routing';
  station(s, stepId).visits++;
  event(s, 'entered', t.caseId, stepId);
 }
 function spawn(s: LWProcess.State, caseId: string, stepId: string, fork: string | null, branch: string | null): void {
  const id = nextSerial(s), token: LWProcess.Token = {id, caseId, stepId, entered: s.clock.minute, started: null, input: null, remaining: 0, status: 'routing', fork, branch};
  createToken(s, token); enter(s, token, stepId);
 }
 /** The earliest minute at which an arrival is due, or null when every stream has ended. */
 function nextArrival(s: LWProcess.State): number | null {
  let at: number | null = null;
  for (const st of s.streams) if (st.at !== null && (at === null || st.at < at)) at = st.at;
  return at;
 }
 /** Moves a stream past its just-admitted arrival; gaps are keyed by stream and arrival index, so the next minute never depends on scheduling. */
 function advanceStream(s: LWProcess.State, st: LWProcess.Stream): void {
  const def = st.def; st.k++;
  if (def.count !== undefined && st.k >= def.count) { st.at = null; return; }
  const next = st.at! + (def.gap ? random.sample(s.seed, 'gap|' + st.index + '|' + st.k, def.gap) : def.interval);
  st.at = def.until !== undefined && next >= def.until ? null : next;
 }
 function admit(s: LWProcess.State): void {
  for (let due = nextArrival(s); due !== null && due <= s.clock.minute; due = nextArrival(s)) {
   // Ties go to the earlier-declared stream, which equals a stable sort of the fully expanded schedule.
   const st = s.streams.find(x => x.at === due)!, def = st.def, k = st.k, id = 'case-' + String(++s.clock.arrival).padStart(4, '0');
   advanceStream(s, st);
   if (s.clock.arrived - s.clock.completed - s.clock.failed >= s.active) { s.clock.dropped++; event(s, 'arrival-dropped', id, s.definition.start, 'system full'); continue; }
   const data: LWProcess.Fields = {...def.data};
   for (const draw of def.draws ?? []) data[draw.field] = drawn(s, draw, 'arrive|' + st.index + '|' + k + '|' + draw.field);
   s.clock.arrived++; s.world.create(id);
   s.world.set<LWProcess.Case>(id, 'process-case', {id, input: {...data}, data: {...data}, entered: s.clock.minute, finished: null, status: 'active', transitions: 0, error: null});
   event(s, 'arrived', id, s.definition.start); spawn(s, id, s.definition.start, null, null);
  }
 }
 const SUM_LIMIT = 1000000000;
 /** Applies `set` then `add` atomically and records the receipt; returns false after failing the case on an unsafe sum. */
 function conclude(s: LWProcess.State, t: LWProcess.Token, step: LWProcess.Step, id: string, event_: string, deferred = false): boolean {
  const c = caseOf(s, t), changes: LWProcess.Fields = {...step.set ?? {}};
  for (const draw of step.draws ?? []) changes[draw.field] = drawn(s, draw, 'draw|' + c.id + '|' + step.id + '|' + t.visit + '|' + draw.field);
  // The scheduler forbids structural changes while it runs, so clock-driven failures wait for the next settle.
  const reject = (message: string) => { if (deferred) s.failures.push({caseId: c.id, message}); else fail(s, c, message); return false; };
  for (const [field, delta] of Object.entries(step.add ?? {})) {
   const current = Object.hasOwn(changes, field) ? changes[field]! : Object.hasOwn(c.data, field) ? c.data[field]! : 0;
   if (typeof current !== 'number' || !Number.isInteger(current)) return reject('Step "' + step.name + '" cannot add to ' + field + ' because it holds ' + JSON.stringify(current) + ', not a whole number.');
   if (Math.abs(current + delta) > SUM_LIMIT) return reject('Step "' + step.name + '" adding ' + delta + ' to ' + field + ' would reach ' + (current + delta) + ', beyond the ' + SUM_LIMIT + ' limit.');
   changes[field] = current + delta;
  }
  Object.assign(c.data, changes); station(s, step.id).completed++;
  s.receipts.push({id, caseId: c.id, stepId: step.id, started: t.started!, finished: s.clock.minute, input: {...t.input!}, output: {...c.data}, changes, ...step.timing ? {duration: s.clock.minute - t.started!} : {}});
  if (s.receipts.length > limits.receipts) {s.receipts.shift(); s.receiptsDropped++;}
  event(s, event_, c.id, step.id);
  return true;
 }
 /** A timer holds its token without pool capacity or cost until its due minute; an `until` already reached fires at once. */
 function startTimer(s: LWProcess.State, t: LWProcess.Token, step: LWProcess.Step): void {
  if (step.timing || step.draws) t.visit = visitOf(s, t.caseId, step.id);
  const due = step.until ?? s.clock.minute + (step.timing ? random.sample(s.seed, 'time|' + t.caseId + '|' + step.id + '|' + t.visit, step.timing) : step.duration!);
  t.input = {...caseOf(s, t).data}; t.started = s.clock.minute; t.remaining = 0;
  event(s, 'timer-started', t.caseId, step.id, 'due ' + due);
  if (due <= s.clock.minute) { fireTimer(s, t, step); return; }
  t.status = 'timer'; t.due = due;
 }
 function fireTimer(s: LWProcess.State, t: LWProcess.Token, step: LWProcess.Step, deferred = false): void {
  if (conclude(s, t, step, t.id + '@' + t.started + ':' + step.id, 'timer-fired', deferred)) enter(s, t, s.outgoing.get(step.id)![0]!.to);
 }
 function route(s: LWProcess.State, t: LWProcess.Token): void {
  const c = caseOf(s, t), step = s.steps.get(t.stepId)!, out = s.outgoing.get(step.id)!;
  if (++c.transitions > limits.transitions) { fail(s, c, 'Case exceeded ' + limits.transitions + ' step transitions.'); return; }
  // A join merges branch tokens, so its needs are checked once at the merge instead of at each arrival.
  const missing = step.kind === 'join' ? undefined : unmet(s, c, step); if (missing) { failNeed(s, c, step, missing); return; }
  if (works(step)) { t.status = 'queued'; return; }
  if (step.kind === 'timer') { startTimer(s, t, step); return; }
  if (step.kind === 'end') {
   station(s, step.id).completed++; destroyToken(s, t.id);
   if (tokens(s).some(other => other.caseId === c.id)) { fail(s, c, 'End reached with outstanding work.'); return; }
   c.status = 'completed'; c.finished = s.clock.minute; s.clock.completed++; s.clock.cycle += c.finished - c.entered;
   event(s, 'completed', c.id, step.id); retire(s, c.id); return;
  }
  if (step.kind === 'fork') {
   station(s, step.id).completed++;
   const occurrence = step.id + '-' + (++s.clock.forkSerial);
   destroyToken(s, t.id);
   for (const flow of out) spawn(s, c.id, flow.to, occurrence, flow.id);
   return;
  }
  if (step.kind === 'join') { t.status = 'joining'; return; }
  station(s, step.id).completed++;
  let flow = out[0]!;
  if (step.kind === 'decision') {
   // Chance routes draw per flow, case and decision visit; a visit is counted only when the decision has one.
   const visit = out.some(f => f.when?.chance !== undefined) ? visitOf(s, c.id, step.id) : 0;
   const taken = (f: LWProcess.Flow) => f.when?.chance !== undefined ? random.chance(s.seed, 'route|' + f.id + '|' + c.id + '|' + visit, f.when.chance) : !!f.when && root.LWProcessGraph.matches(c.data, f.when);
   flow = out.find(taken) ?? out.find(f => !f.when)!;
  }
  event(s, 'routed', c.id, step.id, flow.id); enter(s, t, flow.to);
 }
 function join(s: LWProcess.State): boolean {
  let changed = false;
  for (const step of s.definition.steps.filter(s => s.kind === 'join')) {
   const fork = s.definition.steps.find(f => f.join === step.id)!;
   const waiting = tokens(s).filter(t => t.stepId === step.id && t.status === 'joining');
   const groups = new Set(waiting.map(t => t.fork));
   for (const group of groups) {
    const batch = waiting.filter(t => t.fork === group && s.world.get(t.id, 'process-token')), expected = s.outgoing.get(fork.id)!.map(f => f.id);
    if (batch.length !== expected.length || !expected.every(id => batch.some(t => t.branch === id))) continue;
    const first = batch[0]!, c = caseOf(s, first);
    if (step.backlog && inStore(s, step.id).length >= step.backlog.capacity) continue;
    batch.forEach(t => destroyToken(s, t.id)); station(s, step.id).completed++; changed = true;
    event(s, 'joined', first.caseId, step.id);
    const missing = unmet(s, c, step); if (missing) { failNeed(s, c, step, missing); continue; }
    if (!step.backlog) { spawn(s, first.caseId, s.outgoing.get(step.id)![0]!.to, null, null); continue; }
    createToken(s, {id: nextSerial(s), caseId: first.caseId, stepId: step.id, entered: s.clock.minute, started: null, input: null, remaining: 0, status: 'backlog', fork: null, branch: null});
    event(s, 'backlogged', first.caseId, step.id);
   }
  }
  return changed;
 }
 /** Held work retries its blocked step; joins release backlog items downstream while the pull limit allows. */
 function pull(s: LWProcess.State): boolean {
  let changed = false;
  for (const t of tokens(s).filter(t => t.status === 'held').sort((a, b) => a.entered - b.entered || compare(a.caseId, b.caseId) || compare(a.id, b.id))) {
   if (accepts(s, t.target!)) { enter(s, t, t.target!); changed = true; }
  }
  for (const step of s.definition.steps.filter(x => x.kind === 'join' && x.backlog)) {
   const next = s.outgoing.get(step.id)![0]!.to, load = () => tokens(s).filter(t => t.stepId === next && ['routing', 'queued', 'active'].includes(t.status)).length;
   for (const t of tokens(s).filter(t => t.stepId === step.id && t.status === 'backlog').sort(ranking(s, step))) {
    if (step.backlog!.pull !== undefined && load() >= step.backlog!.pull || !accepts(s, next)) break;
    event(s, 'pulled', t.caseId, step.id, next); enter(s, t, next); changed = true;
   }
  }
  return changed;
 }
 function start(s: LWProcess.State): boolean {
  const queued = tokens(s).filter(t => t.status === 'queued').sort((a, b) => a.entered - b.entered || compare(a.caseId, b.caseId) || compare(a.id, b.id));
  // Backlog orders re-rank only within their own step's positions, so other steps keep first-in order.
  for (const step of s.definition.steps) if (step.backlog && step.backlog.order && step.backlog.order !== 'fifo' && works(step)) {
   const slots = queued.flatMap((t, i) => t.stepId === step.id ? [i] : []), ranked = slots.map(i => queued[i]!).sort(ranking(s, step));
   slots.forEach((i, k) => { queued[i] = ranked[k]!; });
  }
  let started = false;
  for (const t of queued) {
   const step = s.steps.get(t.stepId)!, demands = Object.entries(step.resources ?? {});
   if (demands.some(([id, quantity]) => pool(s, id).busy + quantity > pool(s, id).capacity)) continue;
   for (const [id, quantity] of demands) pool(s, id).busy += quantity;
   if (step.timing || step.draws) t.visit = visitOf(s, t.caseId, step.id);
   t.input = {...caseOf(s, t).data}; t.started = s.clock.minute; t.status = 'active'; started = true;
   t.remaining = step.timing ? random.sample(s.seed, 'time|' + t.caseId + '|' + step.id + '|' + t.visit, step.timing) : step.duration!;
   station(s, step.id).waitMinutes += s.clock.minute - t.entered; s.clock.cost += step.cost ?? 0;
   event(s, 'started', t.caseId, step.id);
  }
  return started;
 }
 function settle(s: LWProcess.State): void {
  for (const f of s.failures.splice(0)) { const c = s.world.get<LWProcess.Case>(f.caseId, 'process-case')!; if (c.status === 'active') fail(s, c, f.message); }
  // Control-only cycles cannot monopolize a browser frame: each case has a transition budget.
  while (true) {
   const pending = tokens(s).filter(t => t.status === 'routing');
   if (pending.length) { for (const t of pending) if (s.world.get(t.id, 'process-token')) route(s, t); continue; }
   if (join(s) || pull(s) || start(s)) continue;
   break;
  }
 }
 const pools = (s: LWProcess.State) => s.poolList ??= s.world.query(['process-pool']).map(id => s.world.get<LWProcess.Pool>(id, 'process-pool')!);
 /**
  * Jumps over minutes in which nothing can change: after a settle, state moves only at an arrival, a task completion or a timer due minute.
  * Busy-minute, cost and remaining-work totals are added in bulk, exactly as stepping each minute would; the event minute itself is left to `work`.
  */
 function fastForward(s: LWProcess.State, target: number): void {
  let event = target; const arrival = nextArrival(s); if (arrival !== null) event = Math.min(event, arrival);
  const running = tokens(s).filter(t => t.status === 'active');
  for (const t of running) event = Math.min(event, s.clock.minute + t.remaining);
  for (const t of tokens(s)) if (t.status === 'timer') event = Math.min(event, Math.max(t.due!, s.clock.minute + 1));
  const skip = event - 1 - s.clock.minute; if (skip <= 0) return;
  for (const p of pools(s)) { p.busyMinutes += p.busy * skip; s.clock.cost += p.busy * p.costPerMinute * skip; }
  for (const t of running) t.remaining -= skip;
  s.clock.minute += skip;
 }
 function work(s: LWProcess.State): void {
  s.clock.minute++;
  for (const p of pools(s)) {
   p.busyMinutes += p.busy; s.clock.cost += p.busy * p.costPerMinute;
  }
  const completed: LWProcess.Token[] = [];
  for (const t of tokens(s)) if (t.status === 'active') { t.remaining--; if (t.remaining === 0) completed.push(t); }
  // Release all simultaneous completions before admitting the next set of tasks.
  completed.forEach(t => { release(s, t); t.status = 'routing'; });
  const live = (t: LWProcess.Token) => caseOf(s, t).status === 'active' && !s.failures.some(f => f.caseId === t.caseId);
  for (const t of completed) {
   if (!live(t)) continue;
   const step = s.steps.get(t.stepId)!;
   if (conclude(s, t, step, t.id + '@' + t.started, 'finished-task', true)) enter(s, t, s.outgoing.get(step.id)![0]!.to);
  }
  const due = tokens(s).filter(t => t.status === 'timer' && t.due! <= s.clock.minute).sort((a, b) => a.due! - b.due! || compare(a.caseId, b.caseId) || compare(a.id, b.id));
  for (const t of due) if (live(t)) fireTimer(s, t, s.steps.get(t.stepId)!, true);
 }
 /** Whether any token exists and whether any is running work or a timer (the only things that change state between arrivals). */
 const progress = (s: LWProcess.State) => ({tokens: tokens(s).length, running: tokens(s).some(t => t.status === 'active' || t.status === 'timer')});
 root.LWProcessSystems = {settle, work, admit, nextArrival, progress, fastForward};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessSystems;
})(globalThis);
