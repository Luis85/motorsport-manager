/// <reference path="./process-contracts.d.ts" />
/**
 * Process clock systems (LWProcessSystems), owned by the process-definition context: lazy arrival streams and admission, atomic
 * pool allocation when work starts, the settle loop, the per-minute work step with completions, multi-instance items and
 * deadlines, and the bulk fast-forward over quiet minutes. Token, case and receipt primitives live in LWProcessKernel, routing
 * and joins in LWProcessRouting, and read-model-only aggregates (per-step work cost, starts, minutes by status, distributions,
 * per-case books) in LWProcessLedger, which this module charges at the same points it charges pools so the totals stay exact and
 * chunk-invariant. Every settle ends with `LWProcessLedger.settled`, so the ledger's token profile always describes the settled state.
 */
(function(inputRoot: unknown) {
 'use strict';
 type State = LWProcess.State; type Token = LWProcess.Token; type Step = LWProcess.Step;
 const root = inputRoot as {LWProcessKernel: LWProcessKernel.Api; LWProcessRouting: LWProcessRouting.Api; LWProcessRandom: LWProcessRandom.Api;
  LWProcessLedger: LWProcessLedger.Api; LWProcessSystems?: LWProcess.Systems};
 const k = root.LWProcessKernel, routing = root.LWProcessRouting, random = root.LWProcessRandom, ledger = root.LWProcessLedger;
 // Most tokens one case may spawn through non-interrupting deadlines; beyond it the case fails explicitly.
 const MAX_ESCALATIONS = 16;
 /** Arrival order of waiting work: entry minute, then case id, then token id. */
 const byEntry = (a: Token, b: Token) => a.entered - b.entered || k.compare(a.caseId, b.caseId) || k.compare(a.id, b.id);
 /** The earliest minute at which an arrival is due, or null when every stream has ended. */
 function nextArrival(s: State): number | null {
  let at: number | null = null;
  for (const st of s.streams) if (st.at !== null && (at === null || st.at < at)) at = st.at;
  return at;
 }
 /** Moves a stream past its just-admitted arrival; gaps are keyed by stream and arrival index, so the next minute never depends on scheduling. */
 function advanceStream(s: State, st: LWProcess.Stream): void {
  const def = st.def;
  st.k++;
  if (def.count !== undefined && st.k >= def.count) {
   st.at = null;
   return;
  }
  const next = st.at! + (def.gap ? random.sample(s.seed, 'gap|' + st.index + '|' + st.k, def.gap) : def.interval);
  st.at = def.until !== undefined && next >= def.until ? null : next;
 }
 function admit(s: State): void {
  for (let due = nextArrival(s); due !== null && due <= s.clock.minute; due = nextArrival(s)) {
   // Ties go to the earlier-declared stream, which equals a stable sort of the fully expanded schedule.
   k.reserve(s, 1);
   const st = s.streams.find(x => x.at === due)!, def = st.def, index = st.k, id = 'case-' + String(++s.clock.arrival).padStart(4, '0');
   advanceStream(s, st);
   if (s.clock.arrived - s.clock.completed - s.clock.failed >= s.active) {
    s.clock.dropped++;
    k.event(s, 'arrival-dropped', id, s.definition.start, 'system full');
    continue;
   }
   const data: LWProcess.Fields = {...def.data};
   for (const draw of def.draws ?? []) data[draw.field] = k.drawn(s, draw, 'arrive|' + st.index + '|' + index + '|' + draw.field);
   s.clock.arrived++;
   s.world.create(id);
   s.world.set<LWProcess.Case>(id, 'process-case', {id, input: {...data}, data: {...data}, entered: s.clock.minute, finished: null, status: 'active',
    transitions: 0, error: null});
   k.event(s, 'arrived', id, s.definition.start);
   k.spawn(s, id, s.definition.start, null, null);
  }
 }
 /** Allocates pool capacity atomically to queued work in arrival order (backlog orders re-rank within their own step). */
 function start(s: State): boolean {
  const queued = k.tokens(s).filter(t => t.status === 'queued').sort(byEntry);
  // Backlog orders re-rank only within their own step's positions, so other steps keep first-in order.
  for (const step of s.definition.steps) {
   if (!step.backlog || !step.backlog.order || step.backlog.order === 'fifo' || !k.works(step)) continue;
   const slots = queued.flatMap((t, i) => t.stepId === step.id ? [i] : []), ranked = slots.map(i => queued[i]!).sort(k.ranking(s, step));
   slots.forEach((i, n) => { queued[i] = ranked[n]!; });
  }
  let started = false;
  for (const t of queued) {
   const step = s.steps.get(t.stepId)!, demands = Object.entries(step.resources ?? {});
   if (demands.some(([id, quantity]) => k.pool(s, id).busy + quantity > k.pool(s, id).capacity)) continue;
   for (const [id, quantity] of demands) k.pool(s, id).busy += quantity;
   const group = t.group ? s.groups.get(t.group) : undefined, deadline = step.deadline;
   if (!group && (step.timing || step.draws || deadline?.timing)) t.visit = k.visitOf(s, t.caseId, step.id);
   // Items of one visit share the visit number; each item keys its own random timing and deadline by its index.
   const key = t.caseId + '|' + step.id + '|' + t.visit + (group ? '|' + t.item : '');
   if (group && group.started === null) {
    group.started = s.clock.minute;
    group.input = {...k.caseOf(s, t).data};
   }
   t.input = group ? group.input : {...k.caseOf(s, t).data};
   t.started = s.clock.minute;
   t.status = 'active';
   started = true;
   t.remaining = step.timing ? random.sample(s.seed, 'time|' + key, step.timing) : step.duration!;
   if (deadline && !(deadline.mode === 'escalate' && t.escalated)) {
    t.deadlineAt = s.clock.minute + (deadline.after ?? random.sample(s.seed, 'deadline|' + key, deadline.timing!));
   }
   k.station(s, step.id).waitMinutes += s.clock.minute - t.entered;
   s.clock.cost += step.cost ?? 0;
   if (s.ledger) ledger.started(s.ledger, step, t.caseId, s.clock.minute - t.entered);
   if (group) k.station(s, step.id).items!.started++;
   k.event(s, 'started', t.caseId, step.id, group ? 'item ' + t.item + ' of ' + t.items : '');
  }
  return started;
 }
 function settle(s: State): void {
  for (const f of s.failures.splice(0)) {
   const c = s.world.get<LWProcess.Case>(f.caseId, 'process-case')!;
   if (c.status === 'active') k.fail(s, c, f.message, f.stepId);
  }
  // Cancelled or surplus multi-instance items are removed here because the clock may not change structure; escalations are spawned here for the same reason.
  for (const t of k.tokens(s).filter(t => t.status === 'spent')) k.destroyToken(s, t.id);
  for (const sp of s.spawns.splice(0)) {
   const c = s.world.get<LWProcess.Case>(sp.caseId, 'process-case');
   if (!c || c.status !== 'active') continue;
   k.reserve(s, 1);
   const target = s.definition.flows.find(f => f.id === sp.flow)!.to;
   if (k.visitOf(s, c.id, '#escalations') > MAX_ESCALATIONS) {
    k.fail(s, c, 'Case spawned more than ' + MAX_ESCALATIONS + ' escalations.', target);
    continue;
   }
   k.spawn(s, c.id, target, null, null, {escalated: true});
  }
  // Control-only cycles cannot monopolize a browser frame: each case has a transition budget.
  while (true) {
   const pending = k.tokens(s).filter(t => t.status === 'routing');
   if (pending.length) {
    for (const t of pending) if (s.world.get(t.id, 'process-token')) routing.route(s, t);
    continue;
   }
   if (routing.join(s) || routing.pull(s) || start(s)) continue;
   break;
  }
  if (s.ledger) ledger.settled(s.ledger);
 }
 const pools = (s: State) => s.poolList ??= s.world.query(['process-pool']).map(id => s.world.get<LWProcess.Pool>(id, 'process-pool')!);
 /** Charges `minutes` of the pools' current occupation to busy minutes and work cost (and the ledger's per-step rates). */
 function charge(s: State, minutes: number): void {
  for (const p of pools(s)) {
   p.busyMinutes += p.busy * minutes;
   s.clock.cost += p.busy * p.costPerMinute * minutes;
  }
  if (s.ledger) ledger.charge(s.ledger, minutes, k.tokens(s), s.clock.arrived - s.clock.completed - s.clock.failed);
 }
 /**
  * Jumps over minutes in which nothing can change: after a settle, state moves only at an arrival, a task completion or a timer due minute.
  * Busy-minute, cost and remaining-work totals are added in bulk, exactly as stepping each minute would; the event minute itself is left to `work`.
  */
 function fastForward(s: State, target: number): void {
  let next = target;
  const arrival = nextArrival(s);
  if (arrival !== null) next = Math.min(next, arrival);
  const running = k.tokens(s).filter(t => t.status === 'active');
  for (const t of running) {
   const deadline = t.deadlineAt === undefined ? Infinity : Math.max(t.deadlineAt, s.clock.minute + 1);
   next = Math.min(next, s.clock.minute + t.remaining, deadline);
  }
  for (const t of k.tokens(s)) if (t.status === 'timer') next = Math.min(next, Math.max(t.due!, s.clock.minute + 1));
  const skip = next - 1 - s.clock.minute;
  if (skip <= 0) return;
  charge(s, skip);
  for (const t of running) t.remaining -= skip;
  s.clock.minute += skip;
 }
 /** One multi-instance item is done: a sequential visit queues its next item, the last item of the visit completes it once and routes it. */
 function finishItem(s: State, t: Token, step: Step): void {
  const group = s.groups.get(t.group!)!;
  group.done++;
  k.station(s, step.id).items!.finished++;
  k.event(s, 'finished-task', t.caseId, step.id, 'item ' + t.item + ' of ' + group.count);
  if (group.done < group.count) {
   // Surplus items of a parallel visit wait as spent tokens (removed at the next settle); a sequential visit reuses its token for the next item.
   if (step.instances!.mode === 'parallel') t.status = 'spent';
   else {
    t.item = t.item! + 1;
    t.status = 'queued';
    t.entered = s.clock.minute;
    t.started = null;
    t.remaining = 0;
   }
   return;
  }
  s.groups.delete(group.id);
  if (k.conclude(s, t, step, group.id + '@' + group.started, '', true, group)) {
   delete t.group;
   delete t.item;
   delete t.items;
   k.enter(s, t, s.outgoing.get(step.id)![0]!.to);
  }
 }
 /** A running token reached its deadline: interrupt cancels the visit and routes along the deadline flow, escalate asks the next settle for a new token. */
 function expire(s: State, t: Token): void {
  const step = s.steps.get(t.stepId)!, flow = s.deadlines.get(step.id)!, stats = k.station(s, step.id).deadlines!;
  const detail = flow.id + (t.group ? ' item ' + t.item + ' of ' + t.items : '');
  delete t.deadlineAt;
  if (step.deadline!.mode === 'escalate') {
   stats.escalated++;
   k.event(s, 'deadline-escalate', t.caseId, step.id, detail);
   s.spawns.push({caseId: t.caseId, flow: flow.id});
   return;
  }
  stats.interrupted++;
  k.event(s, 'deadline-interrupt', t.caseId, step.id, detail);
  k.release(s, t);
  if (t.group) {
   for (const other of k.tokens(s)) {
    if (other.group !== t.group || other.id === t.id) continue;
    if (other.status === 'active') k.release(s, other);
    other.status = 'spent';
   }
   s.groups.delete(t.group);
   delete t.group;
   delete t.item;
   delete t.items;
  }
  k.enter(s, t, flow.to);
 }
 function work(s: State): void {
  s.clock.minute++;
  charge(s, 1);
  const completed: Token[] = [], expired: Token[] = [];
  for (const t of k.tokens(s)) {
   if (t.status !== 'active') continue;
   t.remaining--;
   if (t.remaining === 0) completed.push(t);
   else if (t.deadlineAt !== undefined && t.deadlineAt <= s.clock.minute) expired.push(t);
  }
  // Release all simultaneous completions before admitting the next set of tasks. Work that finishes in its deadline minute completes normally.
  completed.forEach(t => {
   k.release(s, t);
   delete t.deadlineAt;
   t.status = 'routing';
  });
  const live = (t: Token) => k.caseOf(s, t).status === 'active' && !s.failures.some(f => f.caseId === t.caseId);
  for (const t of completed) {
   if (!live(t)) continue;
   const step = s.steps.get(t.stepId)!;
   if (t.group) {
    finishItem(s, t, step);
    continue;
   }
   if (k.conclude(s, t, step, t.id + '@' + t.started, 'finished-task', true)) k.enter(s, t, s.outgoing.get(step.id)![0]!.to);
  }
  for (const t of expired) if (t.status === 'active' && live(t)) expire(s, t);
  const due = k.tokens(s).filter(t => t.status === 'timer' && t.due! <= s.clock.minute);
  due.sort((a, b) => a.due! - b.due! || k.compare(a.caseId, b.caseId) || k.compare(a.id, b.id));
  for (const t of due) if (live(t)) routing.fireTimer(s, t, s.steps.get(t.stepId)!, true);
 }
 /** Whether any token exists and whether any is running work or a timer (the only things that change state between arrivals). */
 const progress = (s: State) => ({tokens: k.tokens(s).length, running: k.tokens(s).some(t => t.status === 'active' || t.status === 'timer')});
 root.LWProcessSystems = {settle, work, admit, nextArrival, progress, fastForward};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessSystems;
})(globalThis);
