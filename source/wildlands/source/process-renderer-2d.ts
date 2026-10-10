/// <reference path="./process-contracts.d.ts" />
/**
 * Exact SVG graph/step-scene projection of a process (LWProcess2D) with a presentation-only camera. Selection sends intent; the map
 * owns no simulation, never ticks a run and never changes the definition it is given.
 * It composes: step cards (LWProcessMapCard) and shared marks (LWProcessMapMarks), laid out by the label rules of LWProcessMapFit; the
 * camera and its dock of zoom buttons and card-number key (LWProcessMapCamera); keyboard focus with one roving tab stop
 * (LWProcessMapFocus, whose header lists which element owns which keys); card drags (LWProcessMapDrag); the legend row's zoom button
 * and caption (LWProcessMapLegend); and the keyed SVG update (LWProcessMapPatch).
 *  - Updates are keyed and incremental: every draw builds a detached copy of the content. While the structure is unchanged it is
 *    patched into the live svg (card groups keyed by step id, edges and deadline tags by flow id, work markers by token id), so a
 *    snapshot refresh changes only the attributes, text and markers that differ. The structure is rebuilt only when the definition,
 *    the drawn steps or their positions, or the layout key (label mode, lines and characters per line, the zoom-dependent text size,
 *    secondary detail) changes. Selection, the hovered or focused card's caption, keyboard focus and the camera survive both paths.
 *  - Framing is path-independent: a camera nobody panned or zoomed since its last framing is framed again on every draw (number key
 *    state included) for the svg size the last rendering update reported, so an untouched map always equals a fresh draw of the same
 *    view in a host of the same size, also when the studio draws it while text around the stage is about to change (see the camera's
 *    `settled`). A camera the reader panned or zoomed keeps its view across ticks.
 *  - `options.move` (optional) lets cards be moved: dragging a card past 4px, or Alt+Arrow on a focused card (one world unit, the
 *    keyboard alternative). The map calls `move(stepId, [x, y])` once per drop or key press, in world units snapped to 0.5, and keeps
 *    drawing the card there as a presentation-only override until the definition it draws changes (the callback's owner writes the
 *    draft; applying it ends the override). Moving is off in a single-step scene. Without the option dragging a card pans the map.
 *    `setMoves(positions)` replaces those overrides ({} clears them), so the owner keeps them in step with its draft (a refused move,
 *    an undo).
 */
declare namespace LWProcess2D {
 /** `neighbours`: frame a selected step together with its direct predecessors and successors (Present) instead of the studio's
  *  single-step scene. Each frame() call sets it; the map's own reset keeps the current choice. */
 interface FrameOptions {neighbours?: boolean}
 interface Options {
  /** Called once per completed card move (pointer drop or Alt+Arrow) with the step id and its new world position, snapped to 0.5. */
  move?: (stepId: string, position: [number, number]) => void;
 }
 interface Surface {
  draw(view: LWProcessApp.View): void; frame(options?: FrameOptions): void; dispose(): void;
  /** Replaces the presentation-only positions of moved cards by step id ({} clears them) and redraws a shown map. */
  setMoves(positions: Record<string, [number, number]>): void;
 }
 interface Api {create(host: HTMLElement, select: (id: string) => void, options?: Options): Surface; legend(): string;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {
  LWProcess2D?: LWProcess2D.Api; LWProcessMapMarks: LWProcessMapMarks.Api; LWProcessMapCard: LWProcessMapCard.Api;
  LWProcessMapFit: LWProcessMapFit.Api; LWProcessMapCamera: LWProcessMapCamera.Api; LWProcessMapFocus: LWProcessMapFocus.Api;
  LWProcessMapDrag: LWProcessMapDrag.Api; LWProcessMapLegend: LWProcessMapLegend.Api; LWProcessMapPatch: LWProcessMapPatch.Api;
 };
 const {el, small, glyph, TONE} = root.LWProcessMapMarks, Card = root.LWProcessMapCard, Fit = root.LWProcessMapFit;
 const idOf = root.LWProcessMapFocus.idOf;
 const LABEL = 'Process map. Tab reaches the step cards: arrow keys move between them, Enter selects, Escape returns to the whole process.'
  + ' On the map: drag or arrow keys pan, scroll, pinch, plus and minus zoom, zero resets.';
 const inclusive = (s: LWProcess.Step | undefined) => s?.kind === 'fork' && s.mode === 'inclusive';
 /** The selected step and the steps one flow before or after it, in definition order. */
 function around(d: LWProcess.Definition, chosen: LWProcess.Step): LWProcess.Step[] {
  const ids = new Set([chosen.id]);
  for (const f of d.flows) { if (f.from === chosen.id) ids.add(f.to); if (f.to === chosen.id) ids.add(f.from); }
  return d.steps.filter(s => ids.has(s.id));
 }
 const cardOf = (target: EventTarget | null) => (target as Element | null)?.closest?.('g[role=button]') as SVGGElement | null ?? null;
 function create(host: HTMLElement, select: (id: string) => void, options: LWProcess2D.Options = {}): LWProcess2D.Surface {
  const svg = el('svg', {role: 'group', tabindex: -1, 'aria-label': LABEL, preserveAspectRatio: 'xMidYMid meet'});
  if (options.move) svg.classList.add('movable');
  host.append(svg);
  let lastView: LWProcessApp.View | undefined, framed: string | null | undefined, neighbours = false, hoverId: string | null = null;
  let drawnKey = '', structure = '', fingerprint = '', spacingKey = '';
  let spacing: LWProcessMapFit.Spacing = {pairs: [], names: []};
  /** World positions drawn now, and presentation-only positions of moved cards (until the drawn definition changes). */
  let drawnAt = new Map<string, readonly [number, number]>();
  const moved = new Map<string, [number, number]>();
  const scene = (view: LWProcessApp.View) => view.selected !== null && !neighbours;
  const camera = root.LWProcessMapCamera.create(svg, host, {moved: applyCamera, refit});
  const row = root.LWProcessMapLegend.attach(host, zoomToRead), {hint, caption} = row;
  const drag = options.move ? root.LWProcessMapDrag.create({svg, scale: camera.scale, position: movable, drop}) : null;
  const focus = root.LWProcessMapFocus.create({svg, select, reveal, ...options.move ? {nudge} : {}});
  const worldOf = (s: LWProcess.Step): readonly [number, number] => moved.get(s.id) ?? [s.scene.position[0]!, s.scene.position[1]!];
  const layout = (view: LWProcessApp.View) => Fit.layout(spacing, camera.scale(), scene(view));
  /** A card's position while it can be moved (never in a single-step scene). */
  function movable(id: string): readonly [number, number] | undefined {
   return lastView && !scene(lastView) ? drawnAt.get(id) : undefined;
  }
  function drop(id: string, position: [number, number]): void {
   moved.set(id, position);
   try { options.move!(id, position); } finally { if (lastView) draw(lastView); }
  }
  function nudge(id: string, dx: number, dy: number): void {
   const at = movable(id);
   if (!at) return;
   drop(id, [root.LWProcessMapDrag.snap(at[0] + dx), root.LWProcessMapDrag.snap(at[1] + dy)]);
   reveal(id);
  }
  /** Pans the least distance that shows the whole card with 24px to spare (a card larger than the map shows its centre). */
  function reveal(id: string): void {
   const at = drawnAt.get(id), card = svg.querySelector('#' + CSS.escape('process-map-' + id) + ' > .pm-card')?.getBoundingClientRect();
   if (!at || !card || !lastView || scene(lastView)) return;
   camera.reveal(at[0], at[1], card.width / 2 + 24, card.height / 2 + 24);
  }
  /** The zoom at which numbered cards no longer touch; an end card with an outcome badge is wider. Zoom 1 is the whole map. */
  function readable(): number {
   if (!lastView || scene(lastView)) return 1;
   const a = camera.area(), fit = camera.fit, px = Fit.floors();
   const badge = lastView.definition.steps.some(s => drawnAt.has(s.id) && s.kind === 'end' && s.outcome);
   const wide = badge ? Math.max(px.badgeW, 2 * px.char + 2.5 * px.pad + Card.badgePx(px)) : px.badgeW;
   return Fit.readable(spacing, Math.min(a.w / fit.w, a.h / fit.h), wide);
  }
  /** Frames the map: the whole map when it is readable, else the readable zoom starting at the start (or framed) step. */
  function place(): void {
   const fit = camera.fit;
   camera.zoom = readable(); camera.cx = fit.x + fit.w / 2; camera.cy = fit.y + fit.h / 2; camera.atFit = true;
   const view = lastView, anchor = view && (neighbours && view.selected !== null ? view.selected : view.definition.start);
   const start = anchor ? drawnAt.get(anchor) : undefined;
   if (camera.zoom > 1 && start) {
    const a = camera.area(), ppu = camera.scale(), hw = a.w / ppu / 2, hh = a.h / ppu / 2;
    const clamp = (v: number, lo: number, hi: number, mid: number) => lo > hi ? mid : Math.max(lo, Math.min(hi, v));
    camera.cx = clamp(start[0], fit.x + hw, fit.x + fit.w - hw, camera.cx);
    camera.cy = clamp(start[1], fit.y + hh, fit.y + fit.h - hh, camera.cy);
   }
  }
  function applyCamera(): void {
   camera.setViewBox();
   if (lastView && layout(lastView).key !== drawnKey) draw(lastView);
  }
  /** The map's own reset (button, 0 or F): frames again and keeps the current neighbours choice. */
  function refit(): void {
   if (host.hidden || !lastView) { framed = undefined; return; }
   place(); applyCamera();
  }
  function frame(frameOptions: LWProcess2D.FrameOptions = {}): void {
   neighbours = !!frameOptions.neighbours; framed = undefined;
   if (!host.hidden && lastView) { draw(lastView); applyCamera(); }
  }
  /** "Zoom in for names / details": zooms about the middle of the map to the first level that shows names, or secondary details. */
  function zoomToRead(): void {
   if (!lastView) return;
   const view = lastView, numbers = layout(view).mode === 'numbers', focused = document.activeElement === hint;
   const ready = () => { const L = layout(view); return numbers ? L.mode !== 'numbers' : L.secondary; };
   while (!ready() && camera.zoom < 8) { camera.zoom = Math.min(8, camera.zoom * 1.05); camera.clamp(); camera.atFit = false; }
   applyCamera();
   if (focused && hint.hidden) svg.focus({preventScroll: true});
  }
  function syncHint(L = lastView && layout(lastView)): void {
   const text = L?.mode === 'numbers' ? 'Zoom in for names' : 'Zoom in for details';
   hint.hidden = host.hidden || !L || L.secondary;
   if (hint.textContent !== text) hint.textContent = text;
   caption.hidden = host.hidden || !L;
  }
  /** The caption names the hovered card, else the focused one, else says how to use it. */
  function syncCaption(): void {
   const at = document.activeElement, focused = at && at !== svg && svg.contains(at) ? at.closest('g[role=button]') : null;
   const hovered = hoverId ? svg.querySelector('#' + CSS.escape('process-map-' + hoverId)) : null;
   const text = (hovered ?? focused)?.getAttribute('data-caption') ?? root.LWProcessMapLegend.CAPTION;
   if (caption.textContent !== text) { caption.textContent = text; caption.title = text; }
  }
  // Pointer: a card drag (with `move`) owns its pointer; everything else is the camera's pan and pinch.
  const down = (e: PointerEvent) => {
   const card = cardOf(e.target), id = idOf(card);
   if (drag && card && id && drag.down(e, card, id)) return;
   camera.down(e);
  };
  const pointerMove = (e: PointerEvent) => { if (!drag?.move(e)) camera.move(e); };
  const up = (e: PointerEvent) => { if (!drag?.up(e)) camera.up(e); };
  // Only the svg ever takes pointer capture; a card part losing the browser's implicit touch capture to it is not a lost gesture.
  const lost = (e: PointerEvent) => {
   if (e.type === 'lostpointercapture' && e.target !== svg) return;
   if (!drag?.lost(e)) camera.up(e);
  };
  const click = (e: MouseEvent) => {
   if (drag?.swallowClick()) return;
   const id = idOf(cardOf(e.target));
   if (id) select(id);
  };
  const keydown = (e: KeyboardEvent) => {
   if (drag?.keydown(e)) return;
   const card = cardOf(e.target);
   if (card && focus.keydown(e, card)) return;
   camera.keydown(e, !!card);
  };
  svg.addEventListener('pointerdown', down); svg.addEventListener('pointermove', pointerMove); svg.addEventListener('pointerup', up);
  for (const type of ['pointercancel', 'lostpointercapture'] as const) svg.addEventListener(type, lost);
  svg.addEventListener('click', click); svg.addEventListener('keydown', keydown);
  svg.addEventListener('pointerover', e => { hoverId = idOf(cardOf(e.target)); syncCaption(); });
  svg.addEventListener('pointerleave', () => { hoverId = null; syncCaption(); });
  // Entering anything outside the map also ends the hover, so a leave missed during a redraw under the pointer cannot pin the caption.
  const outside = (e: PointerEvent) => { if (hoverId && !svg.contains(e.target as Node)) { hoverId = null; syncCaption(); } };
  document.addEventListener('pointerover', outside);
  svg.addEventListener('focusin', syncCaption); svg.addEventListener('focusout', syncCaption);
  const seen = new MutationObserver(() => { syncHint(); if (!host.hidden && lastView) applyCamera(); });
  seen.observe(host, {attributes: true, attributeFilter: ['hidden']});
  // Screen-sized cards make the fitted bounds depend on the map size: a resize measures them again and frames an untouched map again.
  // The camera frames for the size this observer last reported (LWProcessMapCamera `settled`), so a draw inside a command never
  // frames for a passing layout; a real resize is reported before it is painted and draws the map again.
  const resize = () => { camera.settled(); if (lastView && !host.hidden) draw(lastView); };
  const resized = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  resized?.observe(svg);
  if (document.getElementById('camera-hint')) svg.setAttribute('aria-describedby', 'camera-hint');
  /** The layout at zoom 1 for a candidate world box, used while measuring the fitted bounds. */
  function atFit(view: LWProcessApp.View, box: LWProcessMapFit.Box): LWProcessMapCard.Layout {
   const saved = camera.zoom;
   camera.fit = box; camera.zoom = 1;
   const L = layout(view);
   camera.zoom = saved;
   return L;
  }
  /**
   * Measures the fitted bounds and frames the camera (when `placing`) for the number key's state, then shows or hides the key for the
   * layout found. The key sits in the dock, so toggling it changes the usable area, which changes the bounds (cards keep a screen
   * size) and the layout: the bounds are measured again in up to two more passes. A framing starts where a fresh map starts, with the
   * key hidden, so the result never depends on the map's earlier states; a kept camera starts from the key it shows.
   */
  function settle(view: LWProcessApp.View, steps: LWProcess.Step[], single: boolean, placing: boolean): LWProcessMapCard.Layout {
   if (placing) camera.key.hidden = true;
   for (let pass = 0; ; pass++) {
    camera.fit = Fit.bounds(steps, drawnAt, single, box => atFit(view, box));
    if (placing) place();
    camera.setViewBox();
    const L = layout(view), hide = L.mode !== 'numbers';
    if (camera.key.hidden === hide || pass === 2) return L;
    camera.key.hidden = hide;
   }
  }
  function draw(view: LWProcessApp.View): void {
   lastView = view;
   const active = document.activeElement, focusedId = active && svg.contains(active) ? active.id : undefined;
   const d = view.definition, print = JSON.stringify(d);
   if (print !== fingerprint) { fingerprint = print; moved.clear(); }
   const chosen = view.selected === null ? undefined : d.steps.find(s => s.id === view.selected), single = !!chosen && scene(view);
   const steps = !chosen ? d.steps : single ? [chosen] : around(d, chosen);
   drawnAt = new Map(steps.map(s => [s.id, single ? [0, 0] as const : worldOf(s)]));
   const shape = steps.map(s => s.id + '@' + drawnAt.get(s.id)!.join(',')).join(';');
   if (shape !== spacingKey) { spacingKey = shape; spacing = Fit.spacing(steps, drawnAt); }
   // An untouched camera is framed again on every draw, so it always shows what a fresh draw of the same view would; a camera the
   // reader panned or zoomed keeps its view until the selection changes or the map is reset.
   const placing = framed !== view.selected || camera.atFit;
   framed = view.selected;
   const L = settle(view, steps, single, placing);
   drawnKey = L.key; syncHint(L);
   const fresh = content(view, steps, L, single), next = [print, shape, L.key, single].join('|');
   if (next !== structure) {
    structure = next; svg.replaceChildren(...fresh.children);
    if (focusedId) svg.querySelector<SVGElement>('#' + CSS.escape(focusedId))?.focus({preventScroll: true});
   } else {
    root.LWProcessMapPatch.children(svg, fresh);
   }
   syncCaption();
  }
  /** A detached copy of the map's content: arrow markers, paths with their labels and deadline tags, then the cards. */
  function content(view: LWProcessApp.View, steps: LWProcess.Step[], L: LWProcessMapCard.Layout, single: boolean): SVGGElement {
   const {definition: d, snapshot: q} = view, fresh = el('g');
   const order = new Map(d.steps.map((s, i) => [s.id, String(i + 1).padStart(2, '0')]));
   const dims = new Map(steps.map(step => [step.id, Card.size(step, L, order.get(step.id)!)]));
   fresh.append(arrows());
   if (!single) edges(fresh, d, dims, L);
   // Tokens are grouped by step once per draw.
   const metrics = new Map(q.steps.map(m => [m.id, m])), byStep = new Map<string, LWProcess.Token[]>();
   for (const t of q.tokens) { const list = byStep.get(t.stepId); if (list) list.push(t); else byStep.set(t.stepId, [t]); }
   const tab = focus.stop(steps.map(s => s.id), view.selected, d.start), dragged = drag?.current();
   for (const step of steps) {
    const at = drawnAt.get(step.id)!, metric = metrics.get(step.id), size = dims.get(step.id)!;
    if (!metric) continue;
    const current = !single && step.id === view.selected, work = byStep.get(step.id) ?? [];
    const g = Card.draw({step, metric, work, x: at[0], y: at[1], size, current, tab: step.id === tab}, L);
    // A card being dragged keeps following the pointer across a refresh.
    if (dragged?.id === step.id) { g.setAttribute('transform', `translate(${dragged.dx} ${dragged.dy})`); g.classList.add('pm-dragging'); }
    fresh.append(g);
   }
   return fresh;
  }
  function edges(fresh: SVGGElement, d: LWProcess.Definition, dims: Map<string, LWProcessMapCard.Size>, L: LWProcessMapCard.Layout): void {
   const edge = (id: string, ux: number, uy: number) => {
    const m = dims.get(id);
    return m ? Math.min(m.w / 2 / Math.max(1e-6, Math.abs(ux)), m.h / 2 / Math.max(1e-6, Math.abs(uy))) : 0;
   };
   const byId = new Map(d.steps.map(s => [s.id, s]));
   for (const f of d.flows) {
    const a = drawnAt.get(f.from), b = drawnAt.get(f.to), source = byId.get(f.from);
    if (!a || !b) continue;
    const late = f.on === 'deadline', mode = source?.deadline?.mode === 'escalate' ? 'escalate' : 'interrupt';
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy) || 1, ux = dx / length, uy = dy / length;
    const s0 = edge(f.from, ux, uy) + .15, s1 = edge(f.to, ux, uy) + .3;
    const conditional = 'pm-edge pm-edge-conditional' + (inclusive(source) ? ' pm-edge-inclusive' : '');
    const kind = late ? 'pm-edge pm-edge-deadline pm-edge-' + mode : f.when ? conditional : 'pm-edge';
    const path = `M${a[0] + ux * s0},${a[1] + uy * s0} L${b[0] - ux * s1},${b[1] - uy * s1}`;
    const marker = late ? `url(#process-arrow-${mode})` : 'url(#process-arrow)';
    fresh.append(el('path', {class: kind, 'data-flow': f.id, d: path, 'marker-end': marker}));
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    if (f.label) {
     const text = el('text', {class: 'pm-edge-label', x: mx, y: my - .4, 'font-size': .55, 'text-anchor': 'middle'}, f.label);
     fresh.append(small(text, L.ppu * .55 >= L.px.text));
    }
    if (late) fresh.append(deadlineTag(f.id, mode, mx, my + (f.label ? .15 : -.45), L));
   }
  }
  function arrows(): SVGDefsElement {
   const defs = el('defs');
   for (const [id, size] of [['process-arrow', .6], ['process-arrow-interrupt', .85], ['process-arrow-escalate', .85]] as const) {
    const attrs = {id, markerWidth: size, markerHeight: size, viewBox: '0 0 5 5', refX: 4, refY: 2.5, orient: 'auto', markerUnits: 'userSpaceOnUse'};
    const m = el('marker', attrs);
    m.append(el('path', {class: 'pm-arrow ' + id.replace('process-', 'pm-'), d: 'M0 0 L5 2.5 L0 5 Z'}));
    defs.append(m);
   }
   return defs;
  }
  /** The tag on a deadline path: its text follows the secondary-text rule; below it a clock disc of at least the cue size keeps the
   *  wording in its tooltip. */
  function deadlineTag(flow: string, mode: 'interrupt' | 'escalate', mx: number, my: number, L: LWProcessMapCard.Layout): SVGGElement {
   const text = 'deadline · ' + mode, k = L.secondary ? 1 : Math.max(1, L.px.cue / (.9 * L.ppu)), w = L.secondary ? text.length * .29 + .9 : .9;
   const tag = el('g', {class: 'pm-deadline-tag', 'data-flow': flow}), body = el('g', {transform: `translate(${mx} ${my}) scale(${k})`});
   const box = {class: 'pm-deadline-tag-box', x: -w / 2, y: 0, width: w, height: .9, rx: .45, 'stroke-width': .07, style: `stroke:${TONE[mode]}`};
   body.append(el('rect', box));
   if (!L.secondary) body.append(glyph('clock', 0, .45, .6, TONE[mode], 0));
   body.append(small(el('text', {class: 'pm-pill-text', x: 0, y: .64, 'font-size': .5, 'text-anchor': 'middle'}, text), L.secondary));
   const why = mode === 'escalate' ? 'escalates: the work keeps going' : 'interrupts: the work is cancelled';
   tag.append(el('title', {}, `Deadline path (${why})`), body);
   return tag;
  }
  function dispose(): void {
   document.removeEventListener('pointerover', outside);
   seen.disconnect(); resized?.disconnect(); drag?.cancel(); focus.dispose(); row.dispose(); camera.dispose(); svg.remove();
  }
  function setMoves(positions: Record<string, [number, number]>): void {
   moved.clear();
   for (const [id, at] of Object.entries(positions)) moved.set(id, [at[0], at[1]]);
   if (lastView && !host.hidden) draw(lastView);
  }
  return {draw, frame, dispose, setMoves};
 }
 root.LWProcess2D = {create, legend: () => root.LWProcessMapLegend.markup()};
})(globalThis);
