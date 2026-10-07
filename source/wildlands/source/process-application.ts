/// <reference path="./process-contracts.d.ts" />
/** Browser/application command owner. Renderers receive detached values, never the live session. */
declare namespace LWProcessApp {
 interface View {definition: LWProcess.Definition; snapshot: LWProcess.Snapshot; selected: string | null; mode: '2d' | '3d'; playing: boolean; horizon: number | null;
  /** Ordered identities of every process this controller holds, and the index of the active one. */
  processes: {id: string; name: string}[]; active: number;}
 interface Controller {
  query(): View; select(id: string | null): void; mode(value: '2d' | '3d'): void;
  play(value: boolean): void; horizon(value: number | null): void; advance(minutes: number): void; pulse(minutes: number): void;
  reset(): void; replace(input: unknown): void; dispose(): void;
  /** Switch the active process: a new paused session at minute 0, nothing selected. Never ticks. */
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
 function create(input: unknown): LWProcessApp.Controller {
  const inputs = Array.isArray(input) ? input as unknown[] : [input];
  if (inputs.length < 1 || inputs.length > 8) throw Error('A process controller holds 1-8 definitions.');
  const slots = inputs.map(entry => root.LWProcessCatalog.admit(entry));
  let active = 0, definition = slots[0]!, horizon: number | null = root.LWProcessRuntime.limits.minutes, session = root.LWProcessRuntime.create(definition, {horizon});
  let disposed = false, selected: string | null = null, mode: '2d' | '3d' = '3d', playing = false;
  const alive = () => { if (disposed) throw Error('Process controller is disposed.'); };
  const terminal = () => ['completed', 'blocked', 'limit'].includes(session.query().status);
  const advance = (minutes: number) => { session.advance(minutes); if (terminal()) playing = false; };
  return {
   query: () => ({definition: JSON.parse(JSON.stringify(definition)) as LWProcess.Definition, snapshot: session.query(), selected, mode, playing, horizon, processes: slots.map(d => ({id: d.id, name: d.name})), active}),
   select(id) { if (id !== null && !definition.steps.some(s => s.id === id)) throw Error('Unknown step: ' + id); selected = id; },
   mode(value) { if (!['2d', '3d'].includes(value)) throw Error('Unknown view mode.'); mode = value; },
   play(value) { playing = value && !terminal(); }, advance,
   horizon(value) { alive(); session.setHorizon(value); horizon = value; if (terminal()) playing = false; },
   pulse(minutes) { if (playing) advance(horizon === null ? minutes : Math.min(minutes, horizon - session.query().minute)); },
   reset() { alive(); const next = root.LWProcessRuntime.create(definition, {horizon}); session.dispose(); session = next; playing = false; },
   replace(value) {
    alive();
    const checked = root.LWProcessCatalog.admit(value), next = root.LWProcessRuntime.create(checked, {horizon});
    session.dispose(); session = next; definition = checked; slots[active] = checked; playing = false; selected = null;
   },
   use(index) {
    alive();
    if (!Number.isInteger(index) || index < 0 || index >= slots.length) throw Error('Unknown process: ' + String(index));
    if (index === active) return;
    const next = root.LWProcessRuntime.create(slots[index]!, {horizon});
    session.dispose(); session = next; active = index; definition = slots[index]!; playing = false; selected = null;
   },
   definitions: () => JSON.parse(JSON.stringify(slots)) as LWProcess.Definition[],
   dispose() { disposed = true; playing = false; session.dispose(); }
  };
 }
 root.LWProcessApplication = {create};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessApplication;
})(globalThis);
