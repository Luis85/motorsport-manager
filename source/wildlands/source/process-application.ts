/// <reference path="./process-contracts.d.ts" />
/** Browser/application command owner. Renderers receive detached values, never the live session. */
declare namespace LWProcessApp {
 type ViewMode = '2d' | '3d' | 'lens';
 type Lens = 'sipoc' | 'journey';
 interface View {definition: LWProcess.Definition; snapshot: LWProcess.Snapshot; selected: string | null; mode: ViewMode; playing: boolean; horizon: number | null;
  /** The second 2D lens of the active process, derived from its type: SIPOC for a business process, Journey map for a customer or user journey. `mode: 'lens'` shows it. */
  lens: Lens;
  /** Ordered identities of every process this controller holds, and the index of the active one. */
  processes: {id: string; name: string}[]; active: number;}
 interface Controller {
  query(): View; select(id: string | null): void; mode(value: ViewMode): void;
  play(value: boolean): void; horizon(value: number | null): void; advance(minutes: number): void; pulse(minutes: number): void;
  reset(): void; replace(input: unknown): void; dispose(): void;
  /** Starts a fresh paused run at minute 0 whose random draws use this whole-number seed (0 to 2,147,483,647); `null` returns to the definition's own seed. Reset keeps the choice; replacing or switching the process drops it. */
  seed(value: number | null): void;
  /** Switch the active process: a new paused session at minute 0, nothing selected. Never ticks. A journey opens on its Journey map; leaving a journey while its map is shown returns to the last 2D or 3D choice. */
  use(index: number): void;
  /** Detached copies of every process's applied definition, in list order. */
  definitions(): LWProcess.Definition[];
 }
 /** `input` is one definition, or an ordered array of 1-8 definitions. */
 interface Api {create(input: unknown): Controller;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessCatalog: LWProcess.Catalog; LWProcessRuntime: LWProcess.Runtime; LWProcessApplication?: LWProcessApp.Api};
 const lensOf = (d: LWProcess.Definition): LWProcessApp.Lens => d.genre === 'customer-journey' || d.genre === 'user-journey' ? 'journey' : 'sipoc';
 function create(input: unknown): LWProcessApp.Controller {
  const inputs = Array.isArray(input) ? input as unknown[] : [input];
  if (inputs.length < 1 || inputs.length > 8) throw Error('A process controller holds 1-8 definitions.');
  const slots = inputs.map(entry => root.LWProcessCatalog.admit(entry));
  let active = 0, definition = slots[0]!, horizon: number | null = root.LWProcessRuntime.limits.minutes, session = root.LWProcessRuntime.create(definition, {horizon});
  let disposed = false, selected: string | null = null, mode: LWProcessApp.ViewMode = lensOf(definition) === 'journey' ? 'lens' : '3d', flat: '2d' | '3d' = '3d', playing = false, seedOverride: number | undefined;
  /** Switching process re-evaluates the view: entering a journey shows its map; leaving a journey from its map returns to the remembered 2D or 3D choice. Otherwise the choice stays. Replacing the active definition keeps the mode: the lens always follows the new type. */
  const reconsider = (before: LWProcessApp.Lens, after: LWProcess.Definition) => {
   if (before !== 'journey' && lensOf(after) === 'journey') mode = 'lens'; else if (before === 'journey' && lensOf(after) === 'sipoc' && mode === 'lens') mode = flat;
  };
  const options = () => ({horizon, ...seedOverride === undefined ? {} : {seed: seedOverride}});
  const alive = () => { if (disposed) throw Error('Process controller is disposed.'); };
  const stopped = (s: LWProcess.Snapshot) => ['completed', 'blocked', 'limit'].includes(s.status), terminal = () => stopped(session.query());
  // `advance` already returns the snapshot `terminal` would build again, so a pulse makes one copy fewer.
  const advance = (minutes: number) => { if (stopped(session.advance(minutes))) playing = false; };
  return {
   query: () => ({definition: JSON.parse(JSON.stringify(definition)) as LWProcess.Definition, snapshot: session.query(), selected, mode, lens: lensOf(definition), playing, horizon, processes: slots.map(d => ({id: d.id, name: d.name})), active}),
   select(id) { if (id !== null && !definition.steps.some(s => s.id === id)) throw Error('Unknown step: ' + id); selected = id; },
   mode(value) { if (!['2d', '3d', 'lens'].includes(value)) throw Error('Unknown view mode.'); mode = value; if (value !== 'lens') flat = value; },
   play(value) { playing = value && !terminal(); }, advance,
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
    const checked = root.LWProcessCatalog.admit(value), next = root.LWProcessRuntime.create(checked, {horizon});
    session.dispose(); session = next; definition = checked; slots[active] = checked; playing = false; selected = null; seedOverride = undefined;
   },
   use(index) {
    alive();
    if (!Number.isInteger(index) || index < 0 || index >= slots.length) throw Error('Unknown process: ' + String(index));
    if (index === active) return;
    const next = root.LWProcessRuntime.create(slots[index]!, {horizon}), before = lensOf(definition);
    session.dispose(); session = next; active = index; definition = slots[index]!; reconsider(before, definition); playing = false; selected = null; seedOverride = undefined;
   },
   definitions: () => JSON.parse(JSON.stringify(slots)) as LWProcess.Definition[],
   dispose() { disposed = true; playing = false; session.dispose(); }
  };
 }
 root.LWProcessApplication = {create};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessApplication;
})(globalThis);
