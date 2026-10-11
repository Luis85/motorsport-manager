/// <reference path="./process-contracts.d.ts" />
/**
 * Drag-to-move for the 2D map's step cards (LWProcessMapDrag), active only when the map was created with a `move` option.
 *  - A primary-button press on a card starts nothing until the pointer travels more than 4px, so a click still selects. Past that the
 *    card follows the pointer in world units, snapped to 0.5, as a `transform` on its group (the map draws nothing else for it);
 *    releasing calls `drop(stepId, position)` once when the position changed, and the click that ends the gesture selects nothing.
 *  - Escape during a press or a drag cancels it: the card returns to its place and nothing is called. A second pointer (a pinch), a
 *    pointer cancel or a lost capture also cancel. Dragging the map background still pans (LWProcessMapCamera).
 *  - Presentation only: moving never ticks the run and never mutates the definition; the owner of `drop` writes the draft.
 */
declare namespace LWProcessMapDrag {
 interface Options {
  svg: SVGSVGElement;
  /** Screen pixels per world unit. */
  scale(): number;
  /** The drawn world position of a step, or undefined when it is not drawn. */
  position(id: string): readonly [number, number] | undefined;
  /** Called once per completed drag with the snapped new position. */
  drop(id: string, position: [number, number]): void;
 }
 interface Drag {
  /** A pointer went down on `card`; returns whether the drag took the pointer (the camera then ignores it). */
  down(e: PointerEvent, card: SVGGElement, id: string): boolean;
  /** Returns whether the drag owns this pointer. */
  move(e: PointerEvent): boolean;
  up(e: PointerEvent): boolean;
  /** A pointer cancel or lost capture: cancels a press or drag of that pointer; returns whether it did. */
  lost(e: PointerEvent): boolean;
  /** Escape cancels a press or drag; returns whether it did. */
  keydown(e: KeyboardEvent): boolean;
  /** The step being dragged and its current snapped offset from its drawn position, for redraws during a drag. */
  current(): {id: string; dx: number; dy: number} | null;
  /** True once for the click that ends a drag, so it does not select. */
  swallowClick(): boolean;
  cancel(): void;
 }
 interface Api {
  create(options: Options): Drag;
  /** Snaps a world coordinate to the 0.5 grid. */
  snap(value: number): number;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessMapDrag?: LWProcessMapDrag.Api};
 const THRESHOLD = 4;
 const snap = (value: number) => Math.round(value * 2) / 2;
 function create(o: LWProcessMapDrag.Options): LWProcessMapDrag.Drag {
  type Press = {id: string; card: SVGGElement; pid: number; x: number; y: number; from: readonly [number, number]; dx: number; dy: number};
  let press: Press | null = null, dragging = false, swallow = false;
  const show = (p: Press) => {
   if (p.dx || p.dy) p.card.setAttribute('transform', `translate(${p.dx} ${p.dy})`); else p.card.removeAttribute('transform');
  };
  function end(): void {
   if (press && o.svg.hasPointerCapture(press.pid)) o.svg.releasePointerCapture(press.pid);
   press?.card.classList.remove('pm-dragging'); o.svg.classList.remove('dragging');
   press = null; dragging = false;
  }
  /** Puts the card back; the click that may follow a cancelled drag selects nothing either. */
  function cancel(): void {
   if (press) { press.dx = 0; press.dy = 0; show(press); }
   if (dragging) swallow = true;
   end();
  }
  function down(e: PointerEvent, card: SVGGElement, id: string): boolean {
   swallow = false;
   if (press) { cancel(); return false; }
   const from = o.position(id);
   if (e.button !== 0 || !e.isPrimary || !from) return false;
   press = {id, card, pid: e.pointerId, x: e.clientX, y: e.clientY, from, dx: 0, dy: 0};
   return true;
  }
  function move(e: PointerEvent): boolean {
   if (!press || e.pointerId !== press.pid) return false;
   const k = o.scale(), sx = e.clientX - press.x, sy = e.clientY - press.y;
   if (!dragging) {
    if (Math.hypot(sx, sy) <= THRESHOLD) return true;
    dragging = true; o.svg.setPointerCapture(press.pid);
    press.card.classList.add('pm-dragging'); o.svg.classList.add('dragging');
   }
   press.dx = snap(press.from[0] + sx / k) - press.from[0];
   press.dy = snap(press.from[1] + sy / k) - press.from[1];
   show(press);
   return true;
  }
  function up(e: PointerEvent): boolean {
   if (!press || e.pointerId !== press.pid) return false;
   const done = dragging ? press : null;
   end();
   if (done) {
    swallow = true;
    if (done.dx || done.dy) o.drop(done.id, [done.from[0] + done.dx, done.from[1] + done.dy]);
   }
   return true;
  }
  function lost(e: PointerEvent): boolean {
   if (!press || e.pointerId !== press.pid) return false;
   cancel();
   return true;
  }
  function keydown(e: KeyboardEvent): boolean {
   if (!press || e.key !== 'Escape') return false;
   cancel(); e.preventDefault(); e.stopPropagation();
   return true;
  }
  const current = () => press && dragging ? {id: press.id, dx: press.dx, dy: press.dy} : null;
  function swallowClick(): boolean { const was = swallow; swallow = false; return was; }
  return {down, move, up, lost, keydown, current, swallowClick, cancel};
 }
 root.LWProcessMapDrag = {create, snap};
})(globalThis);
