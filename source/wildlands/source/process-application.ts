/// <reference path="./process-contracts.d.ts" />
/**
 * Browser/application command owner. Renderers receive detached values, never the live session.
 *
 * The controller holds 1-8 process slots. Each slot keeps its applied definition and, once visited, one detached run: its session,
 * the run seed chosen with `seed()`, the selected step and the run length. At most one session per slot exists (8 in total), and each
 * session stays inside the engine's retained limits, so memory is bounded. Only the active slot's session is ever advanced; switching
 * pauses a playing run and never ticks. Replace, apply, import, reset and seed act on the active slot only.
 *
 * Clock commands: `advance` (1-100,000 whole minutes), `pulse` (the playing run's tick) and `runToEnd` (one command that advances in
 * bounded chunks until the run stops or reaches its run length, at most `LWProcessRuntime.limits.minutes` minutes per command).
 * Nothing else moves the clock: queries, selection, view modes, switching and adding a process never tick.
 */
declare namespace LWProcessApp {
 type ViewMode = '2d' | '3d' | 'lens';
 type Lens = 'sipoc' | 'journey';
 interface View {
  definition: LWProcess.Definition; snapshot: LWProcess.Snapshot; selected: string | null; mode: ViewMode; playing: boolean; horizon: number | null;
  /** The second 2D lens of the active process, derived from its type: SIPOC for a business process, Journey map for a journey. `mode: 'lens'` shows it. */
  lens: Lens;
  /** Ordered identities of every process this controller holds, and the index of the active one. */
  processes: {id: string; name: string}[]; active: number;
 }
 interface Controller {
  query(): View; select(id: string | null): void; mode(value: ViewMode): void;
  play(value: boolean): void; horizon(value: number | null): void; advance(minutes: number): void; pulse(minutes: number): void;
  /**
   * One clock command: pauses a playing run, then advances the active run in bounded chunks until it stops (completed, blocked or
   * limit) or reaches its run length, at most `LWProcessRuntime.limits.minutes` minutes in this command. Returns the minutes
   * advanced. Throws (and changes nothing) when the run has no run length or has already stopped. The result equals advancing the
   * same minutes with `advance` in any chunks.
   */
  runToEnd(): number;
  reset(): void; dispose(): void;
  /**
   * Replaces the active definition with a fresh paused run. A new revision of the same process (same id) keeps the run seed chosen
   * with `seed()` while the definition's own seed is unchanged, and keeps the selected step while it still exists; anything else
   * starts on the definition's seed with nothing selected. Other slots and their runs are untouched.
   */
  replace(input: unknown): void;
  /**
   * Starts a fresh paused run at minute 0 whose random draws use this whole-number seed (0 to 2,147,483,647); `null` returns to the
   * definition's own seed. Reset keeps the choice; it stays with its process across switches; replacing keeps it only as `replace` describes.
   */
  seed(value: number | null): void;
  /**
   * Switches the active process. The run left behind is paused and kept as it is (minute, snapshot, run seed, selection and run
   * length); switching back restores it exactly. A process opened for the first time starts a fresh paused run at minute 0 with
   * nothing selected, using the current run length. Never ticks. A journey opens on its Journey map; leaving a journey while its map
   * is shown returns to the last 2D or 3D choice.
   */
  use(index: number): void;
  /**
   * Admits a definition into a new slot after the last one and returns its index; the active process and every run are unchanged.
   * Refused (an Error with a plain reason) when the studio already holds 8 processes or another slot has the same id; callers that
   * want a copy rename it first. (`replace` keeps its earlier rule and does not check ids across slots.)
   */
  add(input: unknown): number;
  /** Detached copies of every process's applied definition, in list order. */
  definitions(): LWProcess.Definition[];
 }
 /** `input` is one definition, or an ordered array of 1-8 definitions. */
 interface Api {create(input: unknown): Controller; readonly MAX_PROCESSES: number;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessCatalog: LWProcess.Catalog; LWProcessRuntime: LWProcess.Runtime; LWProcessApplication?: LWProcessApp.Api};
 const MAX = 8, CHUNK = 1440;
 const lensOf = (d: LWProcess.Definition): LWProcessApp.Lens => d.genre === 'customer-journey' || d.genre === 'user-journey' ? 'journey' : 'sipoc';
 const stopped = (s: LWProcess.Snapshot) => ['completed', 'blocked', 'limit'].includes(s.status);
 /** A slot's run while another process is active: kept paused exactly as it was left. */
 interface Kept {session: LWProcess.Session; seed: number | undefined; selected: string | null; horizon: number | null}
 function create(input: unknown): LWProcessApp.Controller {
  const inputs = Array.isArray(input) ? input as unknown[] : [input];
  if (inputs.length < 1 || inputs.length > MAX) throw Error('A process controller holds 1-8 definitions.');
  const slots = inputs.map(entry => root.LWProcessCatalog.admit(entry));
  const kept = new Map<number, Kept>();
  let active = 0, definition = slots[0]!, horizon: number | null = root.LWProcessRuntime.limits.minutes;
  let session = root.LWProcessRuntime.create(definition, {horizon});
  let disposed = false, selected: string | null = null, playing = false, seedOverride: number | undefined;
  let mode: LWProcessApp.ViewMode = lensOf(definition) === 'journey' ? 'lens' : '3d', flat: '2d' | '3d' = '3d';
  /**
   * Switching process re-evaluates the view: entering a journey shows its map; leaving a journey from its map returns to the remembered
   * 2D or 3D choice. Otherwise the choice stays. Replacing the active definition keeps the mode: the lens always follows the new type.
   */
  const reconsider = (before: LWProcessApp.Lens, after: LWProcess.Definition) => {
   if (before !== 'journey' && lensOf(after) === 'journey') mode = 'lens';
   else if (before === 'journey' && lensOf(after) === 'sipoc' && mode === 'lens') mode = flat;
  };
  const options = () => ({horizon, ...seedOverride === undefined ? {} : {seed: seedOverride}});
  const alive = () => { if (disposed) throw Error('Process controller is disposed.'); };
  const terminal = () => stopped(session.query());
  // `advance` already returns the snapshot `terminal` would build again, so a pulse makes one copy fewer.
  const advance = (minutes: number) => { if (stopped(session.advance(minutes))) playing = false; };
  function runToEnd(): number {
   alive();
   if (horizon === null) throw Error('Set a run length to run to the end.');
   if (terminal()) throw Error('The run has already stopped. Reset the run to run it again.');
   playing = false;
   const start = session.query().minute, end = Math.min(horizon, start + root.LWProcessRuntime.limits.minutes);
   let minute = start;
   while (minute < end) {
    const q = session.advance(Math.min(CHUNK, end - minute));
    minute = q.minute;
    if (stopped(q)) break;
   }
   return minute - start;
  }
  function use(index: number): void {
   alive();
   if (!Number.isInteger(index) || index < 0 || index >= slots.length) throw Error('Unknown process: ' + String(index));
   if (index === active) return;
   const before = lensOf(definition), back = kept.get(index);
   const next = back?.session ?? root.LWProcessRuntime.create(slots[index]!, {horizon});
   kept.set(active, {session, seed: seedOverride, selected, horizon});
   kept.delete(index);
   session = next; active = index; definition = slots[index]!; playing = false;
   selected = back?.selected ?? null; seedOverride = back?.seed; horizon = back ? back.horizon : horizon;
   reconsider(before, definition);
  }
  function add(value: unknown): number {
   alive();
   if (slots.length >= MAX) throw Error('A studio holds at most 8 processes.');
   const checked = root.LWProcessCatalog.admit(value);
   if (slots.some(d => d.id === checked.id)) throw Error(`A process with the id "${checked.id}" is already open. Give the new process another id.`);
   slots.push(checked);
   return slots.length - 1;
  }
  return {
   query: () => ({
    definition: JSON.parse(JSON.stringify(definition)) as LWProcess.Definition, snapshot: session.query(), selected, mode, lens: lensOf(definition),
    playing, horizon, processes: slots.map(d => ({id: d.id, name: d.name})), active,
   }),
   select(id) { if (id !== null && !definition.steps.some(s => s.id === id)) throw Error('Unknown step: ' + id); selected = id; },
   mode(value) { if (!['2d', '3d', 'lens'].includes(value)) throw Error('Unknown view mode.'); mode = value; if (value !== 'lens') flat = value; },
   play(value) { playing = value && !terminal(); }, advance, runToEnd,
   horizon(value) { alive(); session.setHorizon(value); horizon = value; if (terminal()) playing = false; },
   pulse(minutes) { if (playing) advance(horizon === null ? minutes : Math.min(minutes, horizon - session.query().minute)); },
   reset() { alive(); const next = root.LWProcessRuntime.create(definition, options()); session.dispose(); session = next; playing = false; },
   seed(value) {
    alive();
    // The runtime validates the range; the live session is replaced only after the new one exists.
    const next = root.LWProcessRuntime.create(definition, {horizon, ...value === null ? {} : {seed: value}});
    session.dispose(); session = next; seedOverride = value ?? undefined; playing = false;
   },
   replace(value) {
    alive();
    const checked = root.LWProcessCatalog.admit(value), same = checked.id === definition.id;
    const seed = same && (checked.seed ?? 1) === (definition.seed ?? 1) ? seedOverride : undefined;
    const next = root.LWProcessRuntime.create(checked, {horizon, ...seed === undefined ? {} : {seed}});
    session.dispose(); session = next; definition = checked; slots[active] = checked; playing = false; seedOverride = seed;
    if (!same || selected !== null && !checked.steps.some(s => s.id === selected)) selected = null;
   },
   use, add,
   definitions: () => JSON.parse(JSON.stringify(slots)) as LWProcess.Definition[],
   dispose() {
    disposed = true; playing = false; session.dispose();
    for (const run of kept.values()) run.session.dispose();
    kept.clear();
   },
  };
 }
 root.LWProcessApplication = {create, MAX_PROCESSES: MAX};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessApplication;
})(globalThis);
