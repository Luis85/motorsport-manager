/// <reference path="./process-contracts.d.ts" />
/** Process token transitions, atomic pool allocation and structured joins over shared ECS storage. */
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessLimits: LWProcess.Limits; LWProcessNeeds: LWProcessNeeds.Api; LWProcessGraph: {matches(data: LWProcess.Fields, c: LWProcess.Condition): boolean}; LWProcessSystems?: LWProcess.Systems};
 const limits = root.LWProcessLimits;
 // Locale-independent code-unit order keeps replays identical across hosts.
 const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
 const tokens = (s: LWProcess.State) => s.world.query(['process-token']).map(id => s.world.get<LWProcess.Token>(id, 'process-token')!);
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
  c.status = 'failed'; c.error = message; c.finished = s.clock.minute;
  for (const t of tokens(s).filter(t => t.caseId === c.id)) { if (t.status === 'active') release(s, t); s.world.destroy(t.id); }
  event(s, 'failed', c.id, '', message);
 }
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
  const id = 'token-' + String(++s.clock.serial).padStart(8, '0');
  s.world.create(id);
  const token: LWProcess.Token = {id, caseId, stepId, entered: s.clock.minute, started: null, input: null, remaining: 0, status: 'routing', fork, branch};
  s.world.set(id, 'process-token', token); enter(s, token, stepId);
 }
 function admit(s: LWProcess.State): void {
  while (s.clock.arrival < s.arrivals.length && s.arrivals[s.clock.arrival]!.at <= s.clock.minute) {
   const arrival = s.arrivals[s.clock.arrival++]!, id = 'case-' + String(s.clock.arrival).padStart(4, '0');
   s.world.create(id);
   s.world.set<LWProcess.Case>(id, 'process-case', {id, input: {...arrival.data}, data: {...arrival.data}, entered: s.clock.minute, finished: null, status: 'active', transitions: 0, error: null});
   event(s, 'arrived', id, s.definition.start); spawn(s, id, s.definition.start, null, null);
  }
 }
 const SUM_LIMIT = 1000000000;
 /** Applies `set` then `add` atomically and records the receipt; returns false after failing the case on an unsafe sum. */
 function conclude(s: LWProcess.State, t: LWProcess.Token, step: LWProcess.Step, id: string, event_: string, deferred = false): boolean {
  const c = caseOf(s, t), changes: LWProcess.Fields = {...step.set ?? {}};
  // The scheduler forbids structural changes while it runs, so clock-driven failures wait for the next settle.
  const reject = (message: string) => { if (deferred) s.failures.push({caseId: c.id, message}); else fail(s, c, message); return false; };
  for (const [field, delta] of Object.entries(step.add ?? {})) {
   const current = Object.hasOwn(changes, field) ? changes[field]! : Object.hasOwn(c.data, field) ? c.data[field]! : 0;
   if (typeof current !== 'number' || !Number.isInteger(current)) return reject('Step "' + step.name + '" cannot add to ' + field + ' because it holds ' + JSON.stringify(current) + ', not a whole number.');
   if (Math.abs(current + delta) > SUM_LIMIT) return reject('Step "' + step.name + '" adding ' + delta + ' to ' + field + ' would reach ' + (current + delta) + ', beyond the ' + SUM_LIMIT + ' limit.');
   changes[field] = current + delta;
  }
  Object.assign(c.data, changes); station(s, step.id).completed++;
  s.receipts.push({id, caseId: c.id, stepId: step.id, started: t.started!, finished: s.clock.minute, input: {...t.input!}, output: {...c.data}, changes});
  if (s.receipts.length > limits.receipts) {s.receipts.shift(); s.receiptsDropped++;}
  event(s, event_, c.id, step.id);
  return true;
 }
 /** A timer holds its token without pool capacity or cost until its due minute; an `until` already reached fires at once. */
 function startTimer(s: LWProcess.State, t: LWProcess.Token, step: LWProcess.Step): void {
  const due = step.until ?? s.clock.minute + step.duration!;
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
  if (step.kind === 'task') { t.status = 'queued'; return; }
  if (step.kind === 'timer') { startTimer(s, t, step); return; }
  if (step.kind === 'end') {
   station(s, step.id).completed++; s.world.destroy(t.id);
   if (tokens(s).some(other => other.caseId === c.id)) { fail(s, c, 'End reached with outstanding work.'); return; }
   c.status = 'completed'; c.finished = s.clock.minute; event(s, 'completed', c.id, step.id); return;
  }
  if (step.kind === 'fork') {
   station(s, step.id).completed++;
   const occurrence = step.id + '-' + (++s.clock.forkSerial);
   s.world.destroy(t.id);
   for (const flow of out) spawn(s, c.id, flow.to, occurrence, flow.id);
   return;
  }
  if (step.kind === 'join') { t.status = 'joining'; return; }
  station(s, step.id).completed++;
  const flow = step.kind === 'decision' ? out.find(f => f.when && root.LWProcessGraph.matches(c.data, f.when)) ?? out.find(f => !f.when)! : out[0]!;
  event(s, 'routed', c.id, step.id, flow.id); enter(s, t, flow.to);
 }
 function join(s: LWProcess.State): boolean {
  let changed = false;
  for (const step of s.definition.steps.filter(s => s.kind === 'join')) {
   const fork = s.definition.steps.find(f => f.join === step.id)!;
   const waiting = tokens(s).filter(t => t.stepId === step.id && t.status === 'joining');
   const groups = new Set(waiting.map(t => t.fork));
   for (const group of groups) {
    const batch = waiting.filter(t => t.fork === group), expected = s.outgoing.get(fork.id)!.map(f => f.id);
    if (batch.length !== expected.length || !expected.every(id => batch.some(t => t.branch === id))) continue;
    const first = batch[0]!, c = caseOf(s, first);
    if (step.backlog && inStore(s, step.id).length >= step.backlog.capacity) continue;
    batch.forEach(t => s.world.destroy(t.id)); station(s, step.id).completed++; changed = true;
    event(s, 'joined', first.caseId, step.id);
    const missing = unmet(s, c, step); if (missing) { failNeed(s, c, step, missing); continue; }
    if (!step.backlog) { spawn(s, first.caseId, s.outgoing.get(step.id)![0]!.to, null, null); continue; }
    const id = 'token-' + String(++s.clock.serial).padStart(8, '0'); s.world.create(id);
    s.world.set<LWProcess.Token>(id, 'process-token', {id, caseId: first.caseId, stepId: step.id, entered: s.clock.minute, started: null, input: null, remaining: 0, status: 'backlog', fork: null, branch: null});
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
  for (const step of s.definition.steps) if (step.backlog && step.backlog.order && step.backlog.order !== 'fifo' && step.kind === 'task') {
   const slots = queued.flatMap((t, i) => t.stepId === step.id ? [i] : []), ranked = slots.map(i => queued[i]!).sort(ranking(s, step));
   slots.forEach((i, k) => { queued[i] = ranked[k]!; });
  }
  let started = false;
  for (const t of queued) {
   const step = s.steps.get(t.stepId)!, demands = Object.entries(step.resources ?? {});
   if (demands.some(([id, quantity]) => pool(s, id).busy + quantity > pool(s, id).capacity)) continue;
   for (const [id, quantity] of demands) pool(s, id).busy += quantity;
   t.input = {...caseOf(s, t).data}; t.started = s.clock.minute; t.status = 'active'; t.remaining = step.duration!; started = true;
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
 function work(s: LWProcess.State): void {
  s.clock.minute++;
  for (const id of s.world.query(['process-pool'])) {
   const p = s.world.get<LWProcess.Pool>(id, 'process-pool')!;
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
 root.LWProcessSystems = {settle, work, admit};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessSystems;
})(globalThis);
