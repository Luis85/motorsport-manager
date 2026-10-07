/// <reference path="./process-contracts.d.ts" />
/** Browser/application command owner. Renderers receive detached values, never the live session. */
declare namespace LWProcessApp {
 interface View {definition: LWProcess.Definition; snapshot: LWProcess.Snapshot; selected: string | null; mode: '2d' | '3d'; playing: boolean; horizon: number | null;}
 interface Controller {
  query(): View; select(id: string | null): void; mode(value: '2d' | '3d'): void;
  play(value: boolean): void; horizon(value: number | null): void; advance(minutes: number): void; pulse(minutes: number): void;
  reset(): void; replace(input: unknown): void; dispose(): void;
 }
 interface Api {create(input: unknown): Controller;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessCatalog: LWProcess.Catalog; LWProcessRuntime: LWProcess.Runtime; LWProcessApplication?: LWProcessApp.Api};
 function create(input: unknown): LWProcessApp.Controller {
  let definition = root.LWProcessCatalog.admit(input), horizon: number | null = root.LWProcessRuntime.limits.minutes, session = root.LWProcessRuntime.create(definition, {horizon});
  let disposed = false, selected: string | null = null, mode: '2d' | '3d' = '3d', playing = false;
  const alive = () => { if (disposed) throw Error('Process controller is disposed.'); };
  const terminal = () => ['completed', 'blocked', 'limit'].includes(session.query().status);
  const advance = (minutes: number) => { session.advance(minutes); if (terminal()) playing = false; };
  return {
   query: () => ({definition: JSON.parse(JSON.stringify(definition)) as LWProcess.Definition, snapshot: session.query(), selected, mode, playing, horizon}),
   select(id) { if (id !== null && !definition.steps.some(s => s.id === id)) throw Error('Unknown step: ' + id); selected = id; },
   mode(value) { if (!['2d', '3d'].includes(value)) throw Error('Unknown view mode.'); mode = value; },
   play(value) { playing = value && !terminal(); }, advance,
   horizon(value) { alive(); session.setHorizon(value); horizon = value; if (terminal()) playing = false; },
   pulse(minutes) { if (playing) advance(horizon === null ? minutes : Math.min(minutes, horizon - session.query().minute)); },
   reset() { alive(); const next = root.LWProcessRuntime.create(definition, {horizon}); session.dispose(); session = next; playing = false; },
   replace(value) {
    alive();
    const checked = root.LWProcessCatalog.admit(value), next = root.LWProcessRuntime.create(checked, {horizon});
    session.dispose(); session = next; definition = checked; playing = false; selected = null;
   },
   dispose() { disposed = true; playing = false; session.dispose(); }
  };
 }
 root.LWProcessApplication = {create};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessApplication;
})(globalThis);
