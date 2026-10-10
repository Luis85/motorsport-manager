/// <reference path="./process-contracts.d.ts" />
/**
 * Keyboard focus of the 2D map's step cards (LWProcessMapFocus): the cards are one roving tab stop, as in the Journey lens. Exactly one
 * card has `tabindex=0` (the selected step, else the card focused last, else the start step, else the first drawn card) and the others
 * `-1`; the map surface (the svg) is focusable by pointer and script (`tabindex=-1`), not a Tab stop. Presentation only: it sends
 * selection intent and asks the map to reveal or nudge a card; it never ticks and never changes the definition.
 *
 * Which element owns which keys:
 *  - A focused card: Arrow keys focus the nearest card in that direction; Home and End focus the first and last card in step-list
 *    order; Enter and Space select the step; Alt+Arrow moves the card by one world unit when the map was given a `move` option.
 *    Shift+Arrow pans and `+`, `-`, `0`, `F` zoom or reset (LWProcessMapCamera), as on the surface.
 *  - The map surface: Arrow keys pan; `+`, `-`, `0`, `F` zoom and reset (LWProcessMapCamera).
 *  - During a card drag, Escape cancels the drag (LWProcessMapDrag); otherwise Escape anywhere on the stage returns to the whole
 *    process (the studio shell), and in Present it leaves Present.
 *
 * Spatial rule for Arrow keys, in screen space: candidates are the cards whose centre lies ahead of the focused card's centre in the
 * pressed direction (more than 1px along it); the one with the smallest `along + 2 × |across|` wins, ties going to the earlier card in
 * step-list order. Without a candidate focus stays. The newly focused card is brought into view.
 */
declare namespace LWProcessMapFocus {
 interface Options {
  svg: SVGSVGElement;
  select(id: string): void;
  /** Brings a card into view after a keyboard move of focus. */
  reveal(id: string): void;
  /** Present when keyboard moves are offered: Alt+Arrow calls it with a one-unit step (`dx`,`dy` of -1, 0 or 1). */
  nudge?: (id: string, dx: number, dy: number) => void;
 }
 interface Focus {
  /** The step whose card holds the tab stop among the drawn `ids` (step-list order). */
  stop(ids: string[], selected: string | null, start: string): string;
  /** Handles a keydown whose target is inside `card`; returns whether it was handled. */
  keydown(e: KeyboardEvent, card: SVGGElement): boolean;
  dispose(): void;
 }
 interface Api {
  create(options: Options): Focus;
  /** The step id of a card group, or null for anything else. */
  idOf(node: Element | null): string | null;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessMapFocus?: LWProcessMapFocus.Api};
 const PREFIX = 'process-map-';
 const DIRECTIONS: Record<string, [number, number]> = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};
 const idOf = (node: Element | null) => node?.matches('g[role=button]') && node.id.startsWith(PREFIX) ? node.id.slice(PREFIX.length) : null;
 function create(o: LWProcessMapFocus.Options): LWProcessMapFocus.Focus {
  let last: string | null = null;
  const cards = () => [...o.svg.querySelectorAll<SVGGElement>('g[role=button]')];
  const centre = (g: SVGGElement) => {
   const r = (g.querySelector('.pm-card') ?? g).getBoundingClientRect();
   return {x: r.left + r.width / 2, y: r.top + r.height / 2};
  };
  function stop(ids: string[], selected: string | null, start: string): string {
   for (const id of [selected, last, start]) if (id !== null && ids.includes(id)) return id;
   return ids[0] ?? start;
  }
  /** The nearest card ahead of `from` in direction `d` (screen space), by the documented spatial rule. */
  function nearest(from: SVGGElement, d: [number, number]): SVGGElement | undefined {
   const c = centre(from);
   let best: {g: SVGGElement; score: number} | undefined;
   for (const g of cards()) {
    if (g === from) continue;
    const p = centre(g), dx = p.x - c.x, dy = p.y - c.y, along = dx * d[0] + dy * d[1], across = Math.abs(dx * d[1] - dy * d[0]);
    if (along <= 1) continue;
    const score = along + 2 * across;
    if (!best || score < best.score) best = {g, score};
   }
   return best?.g;
  }
  function go(target: SVGGElement | undefined): void {
   if (!target) return;
   target.focus({preventScroll: true});
   const id = idOf(target);
   if (id) o.reveal(id);
  }
  function keydown(e: KeyboardEvent, card: SVGGElement): boolean {
   const id = idOf(card), d = DIRECTIONS[e.key];
   if (!id || e.ctrlKey || e.metaKey) return false;
   if (e.altKey) {
    if (!d || !o.nudge || e.shiftKey) return false;
    o.nudge(id, d[0], d[1]);
   } else if (e.shiftKey && d) {
    return false;
   } else if (e.key === 'Enter' || e.key === ' ') {
    o.select(id);
   } else if (d) {
    go(nearest(card, d));
   } else if (e.key === 'Home' || e.key === 'End') {
    const all = cards();
    go(e.key === 'Home' ? all[0] : all.at(-1));
   } else {
    return false;
   }
   e.preventDefault();
   // Keys a card used are not also slide or page navigation (Present listens on the document).
   e.stopPropagation();
   return true;
  }
  /** The focused card becomes the tab stop, as in the Journey lens. */
  const focusin = (e: FocusEvent) => {
   const g = (e.target as Element).closest?.('g[role=button]') as SVGGElement | null, id = idOf(g);
   if (!id || !g) return;
   last = id;
   for (const c of cards()) c.setAttribute('tabindex', c === g ? '0' : '-1');
  };
  o.svg.addEventListener('focusin', focusin);
  return {stop, keydown, dispose() { o.svg.removeEventListener('focusin', focusin); }};
 }
 root.LWProcessMapFocus = {create, idOf};
})(globalThis);
