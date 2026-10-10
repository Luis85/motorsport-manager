/// <reference path="./process-contracts.d.ts" />
/**
 * The stage's second 2D lens: the SIPOC grid for a business process, the Journey map for a customer or user journey. The surface is
 * created on demand for the lens the view names and replaced when that lens changes. It draws detached view values only; selecting
 * a step is an intent handed to `onSelect`, and it never ticks, retains a run or touches storage.
 */
declare namespace LWProcessLens {
 interface Surface {
  draw(view: LWProcessApp.View): void;
  /** Resets the lens' own scroll or fit state (the Fit to view button). */
  frame(): void;
  /** Drops the current lens surface (a different process or a replaced definition); the next draw builds a fresh one. */
  reset(): void;
  dispose(): void;
 }
 interface Api {create(host: HTMLElement, onSelect: (stepId: string | null) => void): Surface;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessSipoc: LWProcessSipoc.Api; LWProcessJourney: LWProcessJourney.Api; LWProcessLens?: LWProcessLens.Api};
 type Inner = {draw(view: LWProcessApp.View): void; frame?(): void; dispose(): void};
 function create(host: HTMLElement, onSelect: (stepId: string | null) => void): LWProcessLens.Surface {
  let inner: Inner | null = null, kind: LWProcessApp.Lens | null = null;
  // The SIPOC grid has no keyboard handling of its own; Escape inside it clears the selection like the journey map does.
  const escape = (e: KeyboardEvent) => {if (e.key === 'Escape' && kind === 'sipoc' && !e.defaultPrevented) onSelect(null);};
  host.addEventListener('keydown', escape);
  function reset(): void {inner?.dispose(); inner = null; kind = null; host.replaceChildren();}
  return {
   draw(view) {
    if (kind !== view.lens) {
     reset();
     kind = view.lens;
     inner = view.lens === 'journey' ? root.LWProcessJourney.create(host, onSelect) : root.LWProcessSipoc.create(host, onSelect);
    }
    inner!.draw(view);
   },
   frame() {inner?.frame?.();},
   reset,
   dispose() {reset(); host.removeEventListener('keydown', escape);},
  };
 }
 root.LWProcessLens = {create};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessLens;
})(globalThis);
