/// <reference path="./process-contracts.d.ts" />
/**
 * Process routing (LWProcessRouting), owned by the process-definition context: what a token does when it is routed at a step
 * (queue work, open multi-instance items, start or fire a timer, finish the case at an end, fork, decide), structured joins,
 * and the release of held work and join backlogs. Allocation of pool capacity and the clock live in LWProcessSystems; the
 * shared token, case and receipt primitives in LWProcessKernel. A completed case is handed to the read-model ledger
 * (LWProcessLedger.finished) with its end step and outcome; failures name the step that caused them.
 */
declare namespace LWProcessRouting {
 type State = LWProcess.State; type Token = LWProcess.Token; type Step = LWProcess.Step;
 interface Api {
  route(s: State, t: Token): void;
  /** Merges complete branch sets at joins; true when anything changed. */
  join(s: State): boolean;
  /** Held work retries its blocked step and join backlogs release work downstream; true when anything changed. */
  pull(s: State): boolean;
  /** A due timer concludes its step and enters the next one; `deferred` defers a failure to the next settle. */
  fireTimer(s: State, t: Token, step: Step, deferred?: boolean): void;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 type State = LWProcess.State; type Token = LWProcess.Token; type Step = LWProcess.Step;
 const root = inputRoot as {LWProcessLimits: LWProcess.Limits; LWProcessKernel: LWProcessKernel.Api; LWProcessRandom: LWProcessRandom.Api;
  LWProcessLedger: LWProcessLedger.Api;
  LWProcessGraph: {
   evaluate(data: LWProcess.Fields, when: LWProcess.When, chance: (path: string, percent: number) => boolean): boolean;
   hasChance(when: LWProcess.When | undefined): boolean;
  };
  LWProcessRouting?: LWProcessRouting.Api};
 const limits = root.LWProcessLimits, k = root.LWProcessKernel, random = root.LWProcessRandom, graph = root.LWProcessGraph;
 /** A timer holds its token without pool capacity or cost until its due minute; an `until` already reached fires at once. */
 function startTimer(s: State, t: Token, step: Step): void {
  if (step.timing || step.draws) t.visit = k.visitOf(s, t.caseId, step.id);
  const drawnMinutes = () => step.timing ? random.sample(s.seed, 'time|' + t.caseId + '|' + step.id + '|' + t.visit, step.timing) : step.duration!;
  const due = step.until ?? s.clock.minute + drawnMinutes();
  t.input = {...k.caseOf(s, t).data};
  t.started = s.clock.minute;
  t.remaining = 0;
  k.event(s, 'timer-started', t.caseId, step.id, 'due ' + due);
  if (due <= s.clock.minute) {
   fireTimer(s, t, step);
   return;
  }
  t.status = 'timer';
  t.due = due;
 }
 function fireTimer(s: State, t: Token, step: Step, deferred = false): void {
  if (k.conclude(s, t, step, t.id + '@' + t.started + ':' + step.id, 'timer-fired', deferred)) k.enter(s, t, s.outgoing.get(step.id)![0]!.to);
 }
 /** Opens a multi-instance visit: reads the item count, records the visit's group and queues the items (parallel: all now; sequential: the first). */
 function openItems(s: State, c: LWProcess.Case, t: Token, step: Step): boolean {
  const spec = step.instances!, raw = spec.count ?? c.data[spec.field!];
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1 || raw > 50) {
   const found = Object.hasOwn(c.data, spec.field!) ? 'holds ' + JSON.stringify(raw) : 'is not set';
   const message = 'Step "' + step.name + '" needs case field ' + spec.field + ' as a whole number from 1 to 50 for its instances, but it ' + found + '.';
   k.fail(s, c, message, step.id);
   return false;
  }
  if (spec.mode === 'parallel') k.reserve(s, raw - 1);
  const visit = k.visitOf(s, c.id, step.id);
  s.groups.set(t.id, {id: t.id, count: raw, done: 0, started: null, input: null, visit});
  Object.assign(t, {group: t.id, item: 1, items: raw, visit});
  if (spec.mode === 'parallel') {
   for (let i = 2; i <= raw; i++) {
    k.createToken(s, {id: k.nextSerial(s), caseId: t.caseId, stepId: step.id, entered: s.clock.minute, started: null, input: null, remaining: 0,
     status: 'queued', fork: t.fork, branch: t.branch, group: t.id, item: i, items: raw, visit,
     ...t.expected !== undefined ? {expected: t.expected} : {}, ...t.escalated ? {escalated: true as const} : {}});
   }
  }
  return true;
 }
 /** Chance leaves draw from keys of flow, leaf position, case and visit; the top-level leaf keeps the plain `route|flow|case|visit` key. */
 const chanceOf = (s: State, f: LWProcess.Flow, caseId: string, visit: number) => (path: string, percent: number) =>
  random.chance(s.seed, 'route|' + f.id + '|' + (path ? path + '|' : '') + caseId + '|' + visit, percent);
 /** An end step: the case completes with its last token; escalated tokens run beside the main route. */
 function finish(s: State, t: Token, c: LWProcess.Case, step: Step): void {
  k.station(s, step.id).completed++;
  k.destroyToken(s, t.id);
  const others = k.tokens(s).filter(other => other.caseId === c.id);
  // Escalated tokens run beside the main route: the case finishes with the last of them, and counts the outcome of the main token's end.
  if (others.length && !t.escalated && !others.every(other => other.escalated)) {
   k.fail(s, c, 'End reached with outstanding work.', step.id);
   return;
  }
  if (others.length) {
   if (!t.escalated && step.outcome) s.outcomes.set(c.id, step.outcome);
   return;
  }
  const outcome = t.escalated ? s.outcomes.get(c.id) : step.outcome;
  c.status = 'completed';
  c.finished = s.clock.minute;
  s.clock.completed++;
  s.clock.cycle += c.finished - c.entered;
  if (s.ledger) root.LWProcessLedger.finished(s.ledger, c, step.id, outcome ?? null);
  if (outcome === 'goal') s.clock.goals++;
  else if (outcome === 'lost') s.clock.lost++;
  for (const track of s.definition.track ?? []) k.note(s.finishAgg, track.field, c.data[track.field]);
  k.event(s, 'completed', c.id, step.id);
  k.retire(s, c.id);
 }
 function fork(s: State, t: Token, c: LWProcess.Case, step: Step, out: LWProcess.Flow[]): void {
  let flows = out;
  if (step.mode === 'inclusive') {
   // Every matching conditional flow activates; the default flow only when none matches.
   const visit = out.some(f => graph.hasChance(f.when)) ? k.visitOf(s, c.id, step.id) : 0;
   const matched = out.filter(f => f.when && graph.evaluate(c.data, f.when, chanceOf(s, f, c.id, visit)));
   flows = matched.length ? matched : out.filter(f => !f.when);
   if (!flows.length) {
    k.fail(s, c, 'Inclusive fork "' + step.name + '" matched no outgoing flow.', step.id);
    return;
   }
   k.reserve(s, flows.length);
   k.event(s, 'forked', c.id, step.id, flows.map(f => f.id).join(','));
  }
  k.reserve(s, flows.length);
  k.station(s, step.id).completed++;
  const occurrence = step.id + '-' + (++s.clock.forkSerial);
  k.destroyToken(s, t.id);
  for (const flow of flows) {
   const expected = step.mode === 'inclusive' ? {expected: flows.length} : {}, carried = t.escalated ? {escalated: true as const} : {};
   k.spawn(s, c.id, flow.to, occurrence, flow.id, {...expected, ...carried});
  }
 }
 function route(s: State, t: Token): void {
  const c = k.caseOf(s, t), step = s.steps.get(t.stepId)!, out = s.outgoing.get(step.id)!;
  if (++c.transitions > limits.transitions) {
   k.fail(s, c, 'Case exceeded ' + limits.transitions + ' step transitions.', step.id);
   return;
  }
  // A join merges branch tokens, so its needs are checked once at the merge instead of at each arrival.
  const missing = step.kind === 'join' ? undefined : k.unmet(s, c, step);
  if (missing) {
   k.failNeed(s, c, step, missing);
   return;
  }
  if (k.works(step)) {
   if (step.instances && !openItems(s, c, t, step)) return;
   t.status = 'queued';
   return;
  }
  if (step.kind === 'timer') {
   startTimer(s, t, step);
   return;
  }
  if (step.kind === 'end') {
   finish(s, t, c, step);
   return;
  }
  if (step.kind === 'fork') {
   fork(s, t, c, step, out);
   return;
  }
  if (step.kind === 'join') {
   t.status = 'joining';
   return;
  }
  k.station(s, step.id).completed++;
  let flow = out[0]!;
  if (step.kind === 'decision') {
   // Chance routes draw per flow, case and decision visit; a visit is counted only when the decision has one.
   const visit = out.some(f => graph.hasChance(f.when)) ? k.visitOf(s, c.id, step.id) : 0;
   const taken = (f: LWProcess.Flow) => !!f.when && graph.evaluate(c.data, f.when, chanceOf(s, f, c.id, visit));
   flow = out.find(taken) ?? out.find(f => !f.when)!;
  }
  k.event(s, 'routed', c.id, step.id, flow.id);
  k.enter(s, t, flow.to);
 }
 function join(s: State): boolean {
  let changed = false;
  for (const step of s.definition.steps.filter(x => x.kind === 'join')) {
   const fork = s.definition.steps.find(f => f.join === step.id)!;
   const waiting = k.tokens(s).filter(t => t.stepId === step.id && t.status === 'joining');
   const groups = new Set(waiting.map(t => t.fork));
   for (const group of groups) {
    const batch = waiting.filter(t => t.fork === group && s.world.get(t.id, 'process-token'));
    const expected = s.outgoing.get(fork.id)!.map(f => f.id);
    // An inclusive fork occurrence records how many branches it activated; a parallel one waits for every branch.
    const wanted = batch[0]?.expected;
    if (batch.length !== (wanted ?? expected.length)) continue;
    if (wanted === undefined && !expected.every(id => batch.some(t => t.branch === id))) continue;
    const first = batch[0]!, c = k.caseOf(s, first);
    if (step.backlog && k.inStore(s, step.id).length >= step.backlog.capacity) continue;
    k.reserve(s, 1);
    batch.forEach(t => k.destroyToken(s, t.id));
    k.station(s, step.id).completed++;
    changed = true;
    k.event(s, 'joined', first.caseId, step.id);
    const missing = k.unmet(s, c, step);
    if (missing) {
     k.failNeed(s, c, step, missing);
     continue;
    }
    const carried = first.escalated ? {escalated: true as const} : {};
    if (!step.backlog) {
     k.spawn(s, first.caseId, s.outgoing.get(step.id)![0]!.to, null, null, carried);
     continue;
    }
    k.createToken(s, {id: k.nextSerial(s), caseId: first.caseId, stepId: step.id, entered: s.clock.minute, started: null, input: null, remaining: 0,
     status: 'backlog', fork: null, branch: null, ...carried});
    k.event(s, 'backlogged', first.caseId, step.id);
   }
  }
  return changed;
 }
 /** Held work retries its blocked step; joins release backlog items downstream while the pull limit allows. */
 function pull(s: State): boolean {
  let changed = false;
  const held = k.tokens(s).filter(t => t.status === 'held');
  held.sort((a, b) => a.entered - b.entered || k.compare(a.caseId, b.caseId) || k.compare(a.id, b.id));
  for (const t of held) {
   if (k.accepts(s, t.target!)) {
    k.enter(s, t, t.target!);
    changed = true;
   }
  }
  for (const step of s.definition.steps.filter(x => x.kind === 'join' && x.backlog)) {
   const next = s.outgoing.get(step.id)![0]!.to;
   const load = () => k.tokens(s).filter(t => t.stepId === next && ['routing', 'queued', 'active'].includes(t.status)).length;
   for (const t of k.tokens(s).filter(t => t.stepId === step.id && t.status === 'backlog').sort(k.ranking(s, step))) {
    if (step.backlog!.pull !== undefined && load() >= step.backlog!.pull || !k.accepts(s, next)) break;
    k.event(s, 'pulled', t.caseId, step.id, next);
    k.enter(s, t, next);
    changed = true;
   }
  }
  return changed;
 }
 root.LWProcessRouting = {route, join, pull, fireTimer};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessRouting;
})(globalThis);
