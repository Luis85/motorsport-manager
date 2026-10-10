/// <reference path="./process-contracts.d.ts" />
/**
 * One wording for the live work state at process steps (LWProcessWorkState), shared by the slide deck, the SIPOC view and the
 * journey map so they say what the 2D cards, the 3D captions and the step list say. Pure functions over a detached definition
 * and snapshot: no DOM, session, clock or storage, and nothing is changed.
 * Words and rules:
 *  - "working": active work at a step people do (every step kind except machine and system steps);
 *  - "running": active work at a machine or system step;
 *  - "waiting": work queued at a step minus held work (`queued - held`; `queued` already leaves out active work and timers);
 *  - "blocked": held work, which finished at the step and waits for room in the next step's backlog (`held`).
 * `parts` always names "working" (unless every step of the scope is a machine or system step), names "running" when the scope has
 * a machine or system step, always names "waiting", and names "blocked" only when some work is held: "2 working, 1 running,
 * 3 waiting, 1 blocked". A missing step metric counts as zero.
 */
declare namespace LWProcessWorkState {
 interface Tally {
  working: number; running: number; waiting: number; blocked: number;
  /** The scope has a step people do (a task or a touchpoint); `machines`: it has a machine or system step. */
  people: boolean; machines: boolean;
 }
 interface Api {
  /** 'running' for machine and system steps, 'working' for every other step. */
  verb(kind: LWProcess.Kind): 'working' | 'running';
  /** Work state sums of the given steps (every step of the definition when `stepIds` is omitted). */
  tally(definition: LWProcess.Definition, snapshot: Pick<LWProcess.Snapshot, 'steps'>, stepIds?: readonly string[]): Tally;
  /** The counts in words, in the order working, running, waiting, blocked (see the header); `format` writes each number (default String). */
  parts(tally: Tally, format?: (n: number) => string): string[];
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessWorkState?: LWProcessWorkState.Api};
 const AUTOMATED = new Set<LWProcess.Kind>(['machine', 'system']), PEOPLE = new Set<LWProcess.Kind>(['task', 'touchpoint']);
 const verb = (kind: LWProcess.Kind): 'working' | 'running' => AUTOMATED.has(kind) ? 'running' : 'working';
 function tally(d: LWProcess.Definition, q: Pick<LWProcess.Snapshot, 'steps'>, stepIds?: readonly string[]): LWProcessWorkState.Tally {
  const scope = stepIds ? new Set(stepIds) : null, metrics = new Map((q.steps ?? []).map(m => [m.id, m]));
  const out: LWProcessWorkState.Tally = {working: 0, running: 0, waiting: 0, blocked: 0, people: false, machines: false};
  for (const s of d.steps) {
   if (scope && !scope.has(s.id)) continue;
   if (PEOPLE.has(s.kind)) out.people = true;
   if (AUTOMATED.has(s.kind)) out.machines = true;
   const m = metrics.get(s.id);
   if (!m) continue;
   const held = m.held ?? 0;
   out[verb(s.kind)] += m.active ?? 0;
   out.waiting += (m.queued ?? 0) - held;
   out.blocked += held;
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
 root.LWProcessWorkState = Object.freeze({verb, tally, parts});
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessWorkState;
})(globalThis);
