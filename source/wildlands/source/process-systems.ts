/// <reference path="./process-contracts.d.ts" />
/** Process token transitions, atomic pool allocation and structured joins over shared ECS storage. */
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessGraph: {matches(data: LWProcess.Fields, c: LWProcess.Condition): boolean}; LWProcessSystems?: LWProcess.Systems};
 const tokens = (s: LWProcess.State) => s.world.query(['process-token']).map(id => s.world.get<LWProcess.Token>(id, 'process-token')!);
 const caseOf = (s: LWProcess.State, t: LWProcess.Token) => s.world.get<LWProcess.Case>(t.caseId, 'process-case')!;
 const station = (s: LWProcess.State, id: string) => s.world.get<LWProcess.Station>('station-' + id, 'process-station')!;
 const pool = (s: LWProcess.State, id: string) => s.world.get<LWProcess.Pool>('pool-' + id, 'process-pool')!;
 const event = (s: LWProcess.State, kind: string, c: string, step: string, detail = '') => {
  s.events.push({minute: s.clock.minute, kind, caseId: c, stepId: step, detail});
  if (s.events.length > 128) s.events.shift();
 };
 function release(s: LWProcess.State, t: LWProcess.Token): void {
  for (const [id, quantity] of Object.entries(s.steps.get(t.stepId)!.resources ?? {})) pool(s, id).busy -= quantity;
 }
 function fail(s: LWProcess.State, c: LWProcess.Case, message: string): void {
  c.status = 'failed'; c.error = message; c.finished = s.clock.minute;
  for (const t of tokens(s).filter(t => t.caseId === c.id)) { if (t.status === 'active') release(s, t); s.world.destroy(t.id); }
  event(s, 'failed', c.id, '', message);
 }
 function enter(s: LWProcess.State, t: LWProcess.Token, stepId: string): void {
  t.stepId = stepId; t.entered = s.clock.minute; t.started = null; t.remaining = 0; t.input = null; t.status = 'routing';
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
 function route(s: LWProcess.State, t: LWProcess.Token): void {
  const c = caseOf(s, t), step = s.steps.get(t.stepId)!, out = s.outgoing.get(step.id)!;
  if (++c.transitions > 2048) { fail(s, c, 'Case exceeded 2048 step transitions.'); return; }
  if (step.kind === 'task') { t.status = 'queued'; return; }
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
    const first = batch[0]!;
    batch.forEach(t => s.world.destroy(t.id)); station(s, step.id).completed++;
    event(s, 'joined', first.caseId, step.id); spawn(s, first.caseId, s.outgoing.get(step.id)![0]!.to, null, null); changed = true;
   }
  }
  return changed;
 }
 function settle(s: LWProcess.State): void {
  // Control-only cycles cannot monopolize a browser frame: each case has a transition budget.
  while (true) {
   const pending = tokens(s).filter(t => t.status === 'routing');
   if (!pending.length) { if (join(s)) continue; break; }
   for (const t of pending) if (s.world.get(t.id, 'process-token')) route(s, t);
  }
  const queued = tokens(s).filter(t => t.status === 'queued').sort((a, b) => a.entered - b.entered || a.caseId.localeCompare(b.caseId) || a.id.localeCompare(b.id));
  for (const t of queued) {
   const step = s.steps.get(t.stepId)!, demands = Object.entries(step.resources ?? {});
   if (demands.some(([id, quantity]) => pool(s, id).busy + quantity > pool(s, id).capacity)) continue;
   for (const [id, quantity] of demands) pool(s, id).busy += quantity;
   t.input = {...caseOf(s, t).data}; t.started = s.clock.minute; t.status = 'active'; t.remaining = step.duration!;
   station(s, step.id).waitMinutes += s.clock.minute - t.entered; s.clock.cost += step.cost ?? 0;
   event(s, 'started', t.caseId, step.id);
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
  completed.forEach(t => release(s, t));
  for (const t of completed) {
   const step = s.steps.get(t.stepId)!, c = caseOf(s, t);
   Object.assign(c.data, step.set ?? {}); station(s, step.id).completed++;
   s.receipts.push({id: t.id + '@' + t.started, caseId: c.id, stepId: step.id, started: t.started!, finished: s.clock.minute,
    input: {...t.input!}, output: {...c.data}, changes: {...step.set ?? {}}});
   if (s.receipts.length > 128) {s.receipts.shift(); s.receiptsDropped++;}
   event(s, 'finished-task', c.id, step.id);
   enter(s, t, s.outgoing.get(step.id)![0]!.to);
  }
 }
 root.LWProcessSystems = {settle, work, admit};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessSystems;
})(globalThis);
