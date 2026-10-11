/// <reference path="./process-contracts.d.ts" />
/**
 * The single derivation of the live work state at process steps (LWProcessWorkState), and its one wording. The 2D cards and their
 * markers, the 3D captions, room lamps and progress bars, the step list, the SIPOC stages, the journey funnel and the slide deck
 * all take their per-step counts, card state and progress from here, so no surface keeps a rule of its own. Pure functions over a
 * detached definition, snapshot and token list: no DOM, session, clock or storage, and nothing is changed.
 * Counts (`step`, from a step's read-model metric; a missing metric or field counts as zero):
 *  - working: active work (`active`); worded "running" at machine and system steps and "working" at every other step (`verb`);
 *  - waiting: work queued at the step minus held work (`queued - held`; `queued` already leaves out active work and timers);
 *  - blocked: held work, which finished at the step and waits for room in the next step's backlog (`held`);
 *  - on timer: work on a timer at the step (`timers.waiting`).
 * Work-item states (`statusOf`, the markers' states): active, timer, backlog and held tokens keep their status and every other
 * token (queued, routing, joining) reads as queued. `counts` tallies a step's tokens by these states, and `border` picks the card
 * state: Blocked first, then Working, Waiting, Timer and Backlog, else idle. The step list's dot is the same state, absent when idle.
 * Progress (`progress`): the mean share done of the step's active work, `1 - remaining / duration` per active token (a step without
 * a duration counts 1 minute), clamped to 0..1; 0 when nothing is active. The 2D progress bar, the step scene bar and the 3D room
 * bar and props all draw it.
 * Wording (`parts`): always names "working" (unless every step of the scope is a machine or system step), names "running" when the
 * scope has a machine or system step, always names "waiting", and names "blocked" only when some work is held: "2 working, 1 running,
 * 3 waiting, 1 blocked".
 */
declare namespace LWProcessWorkState {
 /** A work item's state as the markers, card borders and the legend show it. */
 type Status = 'active' | 'queued' | 'timer' | 'backlog' | 'held';
 type Counts = Record<Status, number>;
 /** One step's counts (see the header). */
 interface StepCounts {working: number; waiting: number; blocked: number; timers: number}
 interface Tally {
  working: number; running: number; waiting: number; blocked: number;
  /** The scope has a step people do (a task or a touchpoint); `machines`: it has a machine or system step. */
  people: boolean; machines: boolean;
 }
 interface Api {
  /** 'running' for machine and system steps, 'working' for every other step. */
  verb(kind: LWProcess.Kind): 'working' | 'running';
  /** One step's working, waiting, blocked and timer counts from its metric (all zero without one). */
  step(metric: Partial<LWProcess.StepMetric> | undefined): StepCounts;
  /** Work state sums of the given steps (every step of the definition when `stepIds` is omitted). */
  tally(definition: LWProcess.Definition, snapshot: Pick<LWProcess.Snapshot, 'steps'>, stepIds?: readonly string[]): Tally;
  /** The counts in words, in the order working, running, waiting, blocked (see the header); `format` writes each number (default String). */
  parts(tally: Tally, format?: (n: number) => string): string[];
  /** A work item's marker state. */
  statusOf(token: LWProcess.Token): Status;
  /** Work items per marker state. */
  counts(tokens: readonly LWProcess.Token[]): Counts;
  /** The card state of work with these counts: 'held', 'active', 'queued', 'timer' or 'backlog' in that order, else 'idle'. */
  border(counts: Counts): Status | 'idle';
  /** Each step's card state, for steps with work only (the step list's dots). */
  states(tokens: readonly LWProcess.Token[]): Map<string, Status>;
  /** The mean share done of the active work among `tokens` at `step`, 0..1 (see the header). */
  progress(step: Pick<LWProcess.Step, 'duration'>, tokens: readonly LWProcess.Token[]): number;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessWorkState?: LWProcessWorkState.Api};
 type Status = LWProcessWorkState.Status;
 const AUTOMATED = new Set<LWProcess.Kind>(['machine', 'system']), PEOPLE = new Set<LWProcess.Kind>(['task', 'touchpoint']);
 /** Card states in the order the border picks them: blocked first, then working, waiting, timer and backlog. */
 const RANK: readonly Status[] = ['held', 'active', 'queued', 'timer', 'backlog'];
 const verb = (kind: LWProcess.Kind): 'working' | 'running' => AUTOMATED.has(kind) ? 'running' : 'working';
 function step(m: Partial<LWProcess.StepMetric> | undefined): LWProcessWorkState.StepCounts {
  const held = m?.held ?? 0;
  return {working: m?.active ?? 0, waiting: Math.max(0, (m?.queued ?? 0) - held), blocked: held, timers: m?.timers?.waiting ?? 0};
 }
 function tally(d: LWProcess.Definition, q: Pick<LWProcess.Snapshot, 'steps'>, stepIds?: readonly string[]): LWProcessWorkState.Tally {
  const scope = stepIds ? new Set(stepIds) : null;
  const metrics = new Map((q.steps ?? []).map(m => [m.id, m]));
  const out: LWProcessWorkState.Tally = {working: 0, running: 0, waiting: 0, blocked: 0, people: false, machines: false};
  for (const s of d.steps) {
   if (scope && !scope.has(s.id)) continue;
   if (PEOPLE.has(s.kind)) out.people = true;
   if (AUTOMATED.has(s.kind)) out.machines = true;
   const m = metrics.get(s.id);
   if (!m) continue;
   const counts = step(m);
   out[verb(s.kind)] += counts.working;
   out.waiting += counts.waiting;
   out.blocked += counts.blocked;
  }
  return out;
 }
 function parts(t: LWProcessWorkState.Tally, format: (n: number) => string = String): string[] {
  return [
   ...t.people || !t.machines ? [`${format(t.working)} working`] : [],
   ...t.machines ? [`${format(t.running)} running`] : [],
   `${format(t.waiting)} waiting`,
   ...t.blocked ? [`${format(t.blocked)} blocked`] : [],
  ];
 }
 function statusOf(t: LWProcess.Token): Status {
  const s = t.status;
  return s === 'active' || s === 'timer' || s === 'backlog' || s === 'held' ? s : 'queued';
 }
 function counts(tokens: readonly LWProcess.Token[]): LWProcessWorkState.Counts {
  const n = {active: 0, queued: 0, timer: 0, backlog: 0, held: 0};
  for (const t of tokens) n[statusOf(t)]++;
  return n;
 }
 const border = (n: LWProcessWorkState.Counts): Status | 'idle' => RANK.find(status => n[status] > 0) ?? 'idle';
 function states(tokens: readonly LWProcess.Token[]): Map<string, Status> {
  const byStep = new Map<string, LWProcess.Token[]>();
  for (const t of tokens) {
   const list = byStep.get(t.stepId);
   if (list) list.push(t);
   else byStep.set(t.stepId, [t]);
  }
  const out = new Map<string, Status>();
  for (const [id, here] of byStep) {
   const state = border(counts(here));
   if (state !== 'idle') out.set(id, state);
  }
  return out;
 }
 function progress(s: Pick<LWProcess.Step, 'duration'>, tokens: readonly LWProcess.Token[]): number {
  const active = tokens.filter(t => t.status === 'active');
  if (!active.length) return 0;
  const duration = s.duration || 1;
  const share = active.reduce((sum, t) => sum + 1 - t.remaining / duration, 0) / active.length;
  return Math.max(0, Math.min(1, share));
 }
 root.LWProcessWorkState = Object.freeze({verb, step, tally, parts, statusOf, counts, border, states, progress});
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessWorkState;
})(globalThis);
