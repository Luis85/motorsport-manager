/// <reference path="./process-contracts.d.ts" />
/**
 * Process engine kernel (LWProcessKernel), owned by the process-definition context: the token store and serial guard, per-case
 * visit counters for keyed draws, the bounded event history with its optional streaming sink, case failure and retention, step
 * entry with backlog admission, and completion receipts. Routing (LWProcessRouting) and the clock systems (LWProcessSystems) build
 * on these primitives; nothing here reads a clock, the wall time or a stateful random generator.
 *
 * Event sink: when the state carries `sink`, every event is passed to it in engine order as a detached copy right after it joins
 * the bounded history, so a consumer sees every event, not only the latest `limits.events`. The sink never changes the history,
 * a decision or a draw; without one the only cost is a property check.
 *
 * Read-model hooks (LWProcessLedger, write-only): pool release, case failure (with the step it names, when known), retirement,
 * repeat entries at non-join steps, and each concluded visit's service time and exit age. Nothing here reads them back.
 */
declare namespace LWProcessKernel {
 type State = LWProcess.State; type Token = LWProcess.Token; type Step = LWProcess.Step;
 interface Api {
  /** Locale-independent order: shorter ids first, then code-unit order, so case-10000 follows case-9999. */
  compare(a: string, b: string): number;
  /** Tokens in creation order; rebuilt only after tokens are created or destroyed. Callers must not mutate the list. */
  tokens(s: State): Token[];
  createToken(s: State, token: Token): void;
  destroyToken(s: State, id: string): void;
  /** Throws before a transition that needs `count` new tokens would pass the serial limit. */
  reserve(s: State, count: number): void;
  nextSerial(s: State): string;
  /** Per-case visit counter for a step; the number keys that visit's random draws, independent of scheduling order. */
  visitOf(s: State, caseId: string, stepId: string): number;
  drawn(s: State, draw: LWProcess.Draw, key: string): LWProcess.Scalar;
  caseOf(s: State, t: Token): LWProcess.Case;
  station(s: State, id: string): LWProcess.Station;
  pool(s: State, id: string): LWProcess.Pool;
  event(s: State, kind: string, caseId: string, stepId: string, detail?: string): void;
  /** Returns the token's pool units (and its step's ledger rate). */
  release(s: State, t: Token): void;
  /** Fails an active case; `stepId` names the step the failure is attributed to in the read model (LWProcessLedger). */
  fail(s: State, c: LWProcess.Case, message: string, stepId?: string): void;
  /** Tasks, touchpoints, machine steps and system steps execute identically. */
  works(step: Step): boolean;
  /** Work waiting at a step: a task's queue or a join's backlog. */
  inStore(s: State, id: string): Token[];
  accepts(s: State, id: string): boolean;
  ranking(s: State, step: Step): (a: Token, b: Token) => number;
  unmet(s: State, c: LWProcess.Case, step: Step): LWProcess.Need | undefined;
  failNeed(s: State, c: LWProcess.Case, step: Step, need: LWProcess.Need): void;
  /** Adds one value to a running aggregate; non-numbers and non-finite numbers are ignored. */
  note(map: Map<string, LWProcess.Aggregate>, key: string, value: unknown): void;
  /** A finished case is queued for oldest-first pruning beyond the retention limit. */
  retire(s: State, caseId: string): void;
  enter(s: State, t: Token, stepId: string): void;
  spawn(s: State, caseId: string, stepId: string, fork: string | null, branch: string | null, extra?: Partial<Token>): void;
  /** Applies `set`, draws and `add` atomically and records the receipt; false after failing (or deferring the failure of) the case. */
  conclude(s: State, t: Token, step: Step, id: string, event: string, deferred?: boolean, group?: LWProcess.Group): boolean;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 type State = LWProcess.State; type Token = LWProcess.Token; type Step = LWProcess.Step;
 const root = inputRoot as {LWProcessLimits: LWProcess.Limits; LWProcessNeeds: LWProcessNeeds.Api; LWProcessRandom: LWProcessRandom.Api;
  LWProcessLedger: LWProcessLedger.Api; LWProcessKernel?: LWProcessKernel.Api};
 const limits = root.LWProcessLimits, random = root.LWProcessRandom, ledger = root.LWProcessLedger;
 // Locale-independent code-unit order keeps replays identical across hosts.
 // Shorter ids sort first so case-10000 follows case-9999 in long streams.
 const compare = (a: string, b: string) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
 /** Tokens in creation order. The list is rebuilt only after tokens are created or destroyed; callers must not mutate it. */
 const tokens = (s: State) => s.tokenList ??= s.world.query(['process-token']).map(id => s.world.get<Token>(id, 'process-token')!);
 const SERIAL_LIMIT = 99999999;
 function createToken(s: State, token: Token): void {
  s.world.create(token.id);
  s.world.set<Token>(token.id, 'process-token', token);
  s.tokenList = null;
 }
 function destroyToken(s: State, id: string): void {
  s.world.destroy(id);
  s.tokenList = null;
 }
 /** Throws before a transition that needs `count` new tokens would pass the serial limit, so no case is ever left half-forked or half-admitted. */
 const reserve = (s: State, count: number) => {
  if (s.clock.serial + count > SERIAL_LIMIT) throw Error('The run created more than ' + SERIAL_LIMIT + ' tokens; start a new run.');
 };
 const nextSerial = (s: State) => {
  reserve(s, 1);
  return 'token-' + String(++s.clock.serial).padStart(8, '0');
 };
 /** Per-case visit counter for a step; the number keys that visit's random draws, independent of scheduling order. */
 function visitOf(s: State, caseId: string, stepId: string): number {
  let byStep = s.visits.get(caseId);
  if (!byStep) {
   byStep = new Map();
   s.visits.set(caseId, byStep);
  }
  const n = (byStep.get(stepId) ?? 0) + 1;
  byStep.set(stepId, n);
  return n;
 }
 function drawn(s: State, draw: LWProcess.Draw, key: string): LWProcess.Scalar {
  if (draw.kind === 'chance') {
   if (random.chance(s.seed, key, draw.percent!)) return Object.hasOwn(draw, 'whenTrue') ? draw.whenTrue! : true;
   return Object.hasOwn(draw, 'whenFalse') ? draw.whenFalse! : false;
  }
  return draw.kind === 'int' ? random.int(s.seed, key, draw.min!, draw.max!) : random.weighted(s.seed, key, draw.values!);
 }
 const caseOf = (s: State, t: Token) => s.world.get<LWProcess.Case>(t.caseId, 'process-case')!;
 const station = (s: State, id: string) => s.world.get<LWProcess.Station>('station-' + id, 'process-station')!;
 const pool = (s: State, id: string) => s.world.get<LWProcess.Pool>('pool-' + id, 'process-pool')!;
 function event(s: State, kind: string, caseId: string, stepId: string, detail = ''): void {
  const entry: LWProcess.Event = {minute: s.clock.minute, kind, caseId, stepId, detail};
  s.events.push(entry);
  if (s.events.length > limits.events) s.events.shift();
  if (s.sink) s.sink({...entry});
 }
 function release(s: State, t: Token): void {
  for (const [id, quantity] of Object.entries(s.steps.get(t.stepId)!.resources ?? {})) pool(s, id).busy -= quantity;
  if (s.ledger) ledger.released(s.ledger, t.stepId, t.caseId);
 }
 function fail(s: State, c: LWProcess.Case, message: string, stepId?: string): void {
  if (c.status !== 'active') return;
  c.status = 'failed';
  c.error = message;
  c.finished = s.clock.minute;
  s.clock.failed++;
  for (const t of tokens(s).filter(t => t.caseId === c.id)) {
   if (t.status === 'active') release(s, t);
   if (t.group) s.groups.delete(t.group);
   destroyToken(s, t.id);
  }
  if (s.ledger) ledger.failed(s.ledger, c, stepId ?? null);
  event(s, 'failed', c.id, '', message);
  retire(s, c.id);
 }
 /** A finished case leaves the world oldest-first once more than the retention limit is kept; run aggregates already hold its totals. */
 function retire(s: State, caseId: string): void {
  s.visits.delete(caseId);
  s.seen.delete(caseId);
  s.outcomes.delete(caseId);
  if (s.ledger) ledger.retired(s.ledger, caseId);
  s.finished.push(caseId);
  while (s.finished.length > s.retained) {
   s.world.destroy(s.finished.shift()!);
   s.clock.pruned++;
  }
 }
 // Tasks, touchpoints, machine steps and system steps execute identically; only the pool kinds they may demand differ.
 const works = (step: Step) => step.kind === 'task' || step.kind === 'touchpoint' || step.kind === 'machine' || step.kind === 'system';
 const holds = ['routing', 'queued'], stored = ['backlog'];
 /** Work waiting at a step: a task's queue or a join's backlog. Joins' branch arrivals never count against capacity. */
 const inStore = (s: State, id: string) => {
  const statuses = s.steps.get(id)!.kind === 'join' ? stored : holds;
  return tokens(s).filter(t => t.stepId === id && statuses.includes(t.status));
 };
 const accepts = (s: State, id: string) => {
  const step = s.steps.get(id)!;
  return !step.backlog || step.kind === 'join' || inStore(s, id).length < step.backlog.capacity;
 };
 const ranking = (s: State, step: Step) => {
  const base = (a: Token, b: Token) => a.entered - b.entered || compare(a.caseId, b.caseId) || compare(a.id, b.id);
  const rank = (t: Token) => {
   const v = caseOf(s, t).data[step.backlog!.priority!];
   return typeof v === 'number' ? v : 0;
  };
  const order = step.backlog?.order ?? 'fifo';
  if (order === 'lifo') return (a: Token, b: Token) => base(b, a);
  return order === 'priority' ? (a: Token, b: Token) => rank(b) - rank(a) || base(a, b) : base;
 };
 const unmet = (s: State, c: LWProcess.Case, step: Step) => (step.needs ?? []).find(n => !root.LWProcessNeeds.holds(n, c.data));
 function failNeed(s: State, c: LWProcess.Case, step: Step, need: LWProcess.Need): void {
  const label = need.label ? ' (' + need.label + ')' : '';
  fail(s, c, 'Step "' + step.name + '" needs ' + root.LWProcessNeeds.describe(need) + label + ' but earlier steps did not deliver it.', step.id);
 }
 /** Adds one value to a running aggregate; non-numbers and non-finite numbers are ignored. */
 function note(map: Map<string, LWProcess.Aggregate>, key: string, value: unknown): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) return;
  const a = map.get(key);
  if (!a) {
   map.set(key, {n: 1, sum: value, min: value, max: value});
   return;
  }
  a.n++;
  a.sum += value;
  a.min = Math.min(a.min, value);
  a.max = Math.max(a.max, value);
 }
 /** Funnel and sentiment bookkeeping at every accepted step entry: distinct-case marker plus the case's tracked values. */
 function journey(s: State, t: Token, stepId: string): void {
  let seen = s.seen.get(t.caseId);
  if (!seen) {
   seen = new Set();
   s.seen.set(t.caseId, seen);
  }
  if (!seen.has(stepId)) {
   seen.add(stepId);
   station(s, stepId).reached++;
  } else if (s.ledger && s.steps.get(stepId)!.kind !== 'join') ledger.repeated(s.ledger, t.caseId);
  const data = caseOf(s, t).data;
  for (const track of s.definition.track ?? []) note(s.entryAgg, stepId + '|' + track.field, data[track.field]);
 }
 function enter(s: State, t: Token, stepId: string): void {
  if (!accepts(s, stepId)) {
   if (t.status !== 'held') event(s, 'held', t.caseId, t.stepId, 'Backlog of ' + s.steps.get(stepId)!.name + ' is full.');
   t.status = 'held';
   t.target = stepId;
   return;
  }
  delete t.target;
  delete t.due;
  t.stepId = stepId;
  t.entered = s.clock.minute;
  t.started = null;
  t.remaining = 0;
  t.input = null;
  t.status = 'routing';
  station(s, stepId).visits++;
  journey(s, t, stepId);
  event(s, 'entered', t.caseId, stepId);
 }
 function spawn(s: State, caseId: string, stepId: string, fork: string | null, branch: string | null, extra: Partial<Token> = {}): void {
  const id = nextSerial(s);
  const token: Token = {id, caseId, stepId, entered: s.clock.minute, started: null, input: null, remaining: 0, status: 'routing', fork, branch, ...extra};
  createToken(s, token);
  enter(s, token, stepId);
 }
 const SUM_LIMIT = 1000000000;
 /** Applies `set` then `add` atomically and records the receipt; returns false after failing the case on an unsafe sum. */
 function conclude(s: State, t: Token, step: Step, id: string, event_: string, deferred = false, group?: LWProcess.Group): boolean {
  const c = caseOf(s, t), changes: LWProcess.Fields = {...step.set ?? {}};
  for (const draw of step.draws ?? []) changes[draw.field] = drawn(s, draw, 'draw|' + c.id + '|' + step.id + '|' + t.visit + '|' + draw.field);
  // The scheduler forbids structural changes while it runs, so clock-driven failures wait for the next settle.
  const reject = (message: string) => {
   if (deferred) s.failures.push({caseId: c.id, message, stepId: step.id});
   else fail(s, c, message, step.id);
   return false;
  };
  for (const [field, delta] of Object.entries(step.add ?? {})) {
   const current = Object.hasOwn(changes, field) ? changes[field]! : Object.hasOwn(c.data, field) ? c.data[field]! : 0;
   if (typeof current !== 'number' || !Number.isInteger(current)) {
    return reject('Step "' + step.name + '" cannot add to ' + field + ' because it holds ' + JSON.stringify(current) + ', not a whole number.');
   }
   if (Math.abs(current + delta) > SUM_LIMIT) {
    return reject('Step "' + step.name + '" adding ' + delta + ' to ' + field + ' would reach ' + (current + delta) + ', beyond the ' + SUM_LIMIT + ' limit.');
   }
   changes[field] = current + delta;
  }
  Object.assign(c.data, changes);
  station(s, step.id).completed++;
  // A multi-instance visit records one receipt: first item start, last item end, the first item's input.
  const began = group ? group.started! : t.started!;
  if (s.ledger) ledger.concluded(s.ledger, step.id, works(step) ? s.clock.minute - began : null, s.clock.minute - c.entered);
  s.receipts.push({id, caseId: c.id, stepId: step.id, started: began, finished: s.clock.minute, input: {...group ? group.input! : t.input!},
   output: {...c.data}, changes, ...step.timing ? {duration: s.clock.minute - began} : {}, ...group ? {instances: group.count} : {}});
  if (s.receipts.length > limits.receipts) {
   s.receipts.shift();
   s.receiptsDropped++;
  }
  if (event_) event(s, event_, c.id, step.id);
  return true;
 }
 root.LWProcessKernel = {compare, tokens, createToken, destroyToken, reserve, nextSerial, visitOf, drawn, caseOf, station, pool, event, release, fail,
  works, inStore, accepts, ranking, unmet, failNeed, note, retire, enter, spawn, conclude};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessKernel;
})(globalThis);
