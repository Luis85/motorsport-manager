/// <reference path="./process-contracts.d.ts" />
/**
 * Exact SVG graph/step-scene projection with a presentation-only camera. Selection sends intent; no simulation ownership.
 * Cards come from LWProcessMapCard and shared marks from LWProcessMapMarks. Outside the SVG the surface owns its map dock (zoom
 * buttons and the card-number key, inside the map host so they travel with it into Present) and, in the studio legend row, the
 * "Zoom in" button and the caption that shows the hovered or focused card's full name and counts.
 */
declare namespace LWProcess2D {
 /** `neighbours`: frame a selected step together with its direct predecessors and successors (Present) instead of the studio's
  *  single-step scene. Each frame() call sets it; the map's own reset keeps the current choice. */
 interface FrameOptions {neighbours?: boolean}
 interface Surface {draw(view: LWProcessApp.View): void; frame(options?: FrameOptions): void; dispose(): void;}
 interface Api {create(host: HTMLElement, select: (id: string) => void): Surface; legend(): string;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcess2D?: LWProcess2D.Api; LWProcessMapMarks: LWProcessMapMarks.Api; LWProcessMapCard: LWProcessMapCard.Api};
 const {el, small, glyph, TONE} = root.LWProcessMapMarks, Card = root.LWProcessMapCard;
 /** A name needs about 7 readable characters per line, else cards show their list number; a line holds at most 24 characters. */
 const MIN_NAME_CHARS = 7, MAX_LINE_CHARS = 24, CHAR_EM = .56, DOCK_GAP = 6;
 const NUMBERS_KEY = 'Card numbers match the step list';
 const CAPTION = 'Hover over or focus a card to read its full name and work counts.';
 /**
  * Screen-size floors in CSS pixels at a 16px root font, scaled with the reader's text size: titles 11px, secondary text 9px,
  * non-text cues (pills, badges) 12px, work markers 8px and counts 10px; a numbered card is about 30 x 25px.
  */
 function floors(): LWProcessMapCard.Px {
  const k = Math.max(.5, (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16);
  const title = 11 * k, line = title * 1.2, pad = 5 * k, mark = 8 * k;
  // A zoomed-out card is its title lines plus `chrome`: top padding, a gap, the work row and the bottom band with the progress bar.
  return {title, text: 9 * k, cue: 12 * k, line, mark, count: 10 * k, pad, chrome: pad * 2.5 + mark, char: title * CHAR_EM,
   badgeW: 30 * k, badgeH: line + 12 * k};
 }
 const inclusive = (s: LWProcess.Step | undefined) => s?.kind === 'fork' && s.mode === 'inclusive';
 /** Pills stacked above a card (instances, deadline); a selected card that shows a phase tag starts one row higher. */
 const pillRows = (s: LWProcess.Step, selected: boolean) => (s.instances ? 1 : 0) + (s.deadline ? 1 : 0) + (selected && s.phase ? 1 : 0);
 /** The selected step and the steps one flow before or after it, in definition order. */
 function around(d: LWProcess.Definition, chosen: LWProcess.Step): LWProcess.Step[] {
  const ids = new Set([chosen.id]);
  for (const f of d.flows) { if (f.from === chosen.id) ids.add(f.to); if (f.to === chosen.id) ids.add(f.from); }
  return d.steps.filter(s => ids.has(s.id));
 }
 function create(host: HTMLElement, select: (id: string) => void): LWProcess2D.Surface {
  const label = 'Process graph and active work. Drag to pan, scroll or pinch to zoom, arrows pan, plus and minus zoom, zero resets.';
  const svg = el('svg', {role: 'group', tabindex: 0, 'aria-label': label, preserveAspectRatio: 'xMidYMid meet'}); host.append(svg);
  // Presentation-only camera over the fitted bounds: zoom 1 is the full fit; centre offsets are in world units.
  let fit = {x: 0, y: 0, w: 1, h: 1}, zoom = 1, cx = 0, cy = 0, framed: string | null | undefined, lastView: LWProcessApp.View | undefined, drawnKey = '';
  let dragStart: {x: number; y: number; pid: number} | null = null, panning = false, last = {x: 0, y: 0}, neighbours = false, hoverId: string | null = null;
  // Whether the camera still shows the framing that place() chose (no pan or zoom since), so a resize frames again.
  let atFit = false;
  // Absolute world distances [dx, dy, dx, dy, ...] between every two drawn steps, and their names, for the card-spacing rules below.
  let pairs: number[] = [], pairsOf: LWProcess.Definition | undefined, pairsKey = '', names: string[] = [];
  const pointers = new Map<number, {x: number; y: number}>();
  const scene = (view: LWProcessApp.View) => view.selected !== null && !neighbours;
  const clampCamera = () => {
   zoom = Math.max(.5, Math.min(8, zoom)); cx = Math.max(fit.x, Math.min(fit.x + fit.w, cx)); cy = Math.max(fit.y, Math.min(fit.y + fit.h, cy));
  };
  // The dock: the zoom buttons and, while cards show numbers, the key to them. It sits in the map host, so it also moves into Present.
  const dock = document.createElement('div'); dock.className = 'process-map-dock';
  const key = document.createElement('p'); key.className = 'process-map-key'; key.textContent = NUMBERS_KEY; key.hidden = true;
  const controls = document.createElement('div'); controls.className = 'process-map-controls';
  controls.setAttribute('role', 'group'); controls.setAttribute('aria-label', 'Map zoom');
  dock.append(key, controls); host.append(dock);
  /**
   * The svg size (`W`,`H`; an unmeasured map assumes the usual stage size) and the part the fitted map may use (`w`,`h`, from the
   * top-left corner). The dock stays clear of the fitted map: either a strip under the map or a column beside it is reserved,
   * whichever leaves the larger scale.
   */
  function area(): {W: number; H: number; w: number; h: number} {
   const r = svg.getBoundingClientRect(), d = dock.getBoundingClientRect();
   if (r.width <= 2 || r.height <= 2) return {W: 900, H: 480, w: 900, h: 480};
   if (!d.width) return {W: r.width, H: r.height, w: r.width, h: r.height};
   const strip = Math.max(0, r.bottom - d.top + DOCK_GAP), column = Math.max(0, r.right - d.left + DOCK_GAP);
   const below = Math.min(r.width / fit.w, (r.height - strip) / fit.h), beside = Math.min((r.width - column) / fit.w, r.height / fit.h);
   const size = {W: r.width, H: r.height};
   return below >= beside ? {...size, w: r.width, h: Math.max(1, r.height - strip)} : {...size, w: Math.max(1, r.width - column), h: r.height};
  }
  /** Screen pixels per world unit. */
  const scale = () => { const a = area(); return Math.max(1e-6, Math.min(a.w / (fit.w / zoom), a.h / (fit.h / zoom))); };
  /** Smallest horizontal distance between two steps whose cards, `hPx` tall, would share a row at `ppu`. */
  const gapX = (ppu: number, hPx: number) => {
   let m = Infinity; for (let i = 0; i < pairs.length; i += 2) if (pairs[i + 1]! * ppu < hPx + 4) m = Math.min(m, pairs[i]!);
   return m;
  };
  /**
   * Text keeps its screen size, not its world size. Zoomed in ('full') titles are world-sized; zoomed out ('names') they stay at the
   * title size in cards as wide as the neighbours allow, on the fewest lines (up to three, vertical spacing permitting) that hold every
   * name, each line at least 7 characters; when even that does not fit, cards show their two-digit list number ('numbers').
   * Secondary lines, pill and tag text appear only once they reach the secondary text size.
   */
  function layout(view: LWProcessApp.View): LWProcessMapCard.Layout {
   const px = floors(), ppu = scale(), single = scene(view), secondary = single || ppu * .46 >= px.text;
   if (single || ppu * .67 >= px.title) {
    return {mode: 'full', secondary, font: .67, single, lines: 2, per: 0, width: 8, ppu, px, key: `full|${secondary}|${single}`};
   }
   const font = px.title / ppu, zoomKey = Math.round(font * 40);
   let best: {lines: number; per: number; width: number} | null = null;
   for (const lines of [1, 2, 3]) {
    const width = Math.min(12, gapX(ppu, lines * px.line + px.chrome) - 1.2, (MAX_LINE_CHARS * px.char + px.pad * 2) / ppu);
    const per = Math.floor((width * ppu - px.pad * 2) / px.char);
    if (per < MIN_NAME_CHARS) break;
    best = {lines, per, width};
    if (names.every(n => root.LWProcessMapMarks.fits(n, per, lines))) break;
   }
   if (best) return {mode: 'names', secondary, font, single, ...best, ppu, px, key: `names|${best.lines}|${best.per}|${zoomKey}|${secondary}`};
   return {mode: 'numbers', secondary, font, single, lines: 1, per: 2, width: px.badgeW / ppu, ppu, px, key: `numbers|${zoomKey}|${secondary}`};
  }
  /** The zoom at which numbered cards no longer touch: any pair may be apart sideways or vertically. Zoom 1 is the whole map. */
  function readable(): number {
   if (!lastView || scene(lastView)) return 1;
   const a = area(), px = floors(), base = Math.min(a.w / fit.w, a.h / fit.h); let need = 0;
   for (let i = 0; i < pairs.length; i += 2) {
    need = Math.max(need, Math.min((px.badgeW + 4) / Math.max(1e-6, pairs[i]!), (px.badgeH + 4) / Math.max(1e-6, pairs[i + 1]!)));
   }
   return Math.max(1, Math.min(8, need / base));
  }
  /** Frames the map: the whole map when it is readable, else the readable zoom starting at the start (or framed) step. */
  function place(): void {
   zoom = readable(); cx = fit.x + fit.w / 2; cy = fit.y + fit.h / 2; atFit = true;
   const anchor = lastView && (neighbours && lastView.selected !== null ? lastView.selected : lastView.definition.start);
   const start = lastView?.definition.steps.find(s => s.id === anchor)?.scene.position;
   if (zoom > 1 && start) {
    const a = area(), ppu = scale(), hw = a.w / ppu / 2, hh = a.h / ppu / 2;
    const clamp = (v: number, lo: number, hi: number, mid: number) => lo > hi ? mid : Math.max(lo, Math.min(hi, v));
    cx = clamp(start[0], fit.x + hw, fit.x + fit.w - hw, cx); cy = clamp(start[1], fit.y + hh, fit.y + fit.h - hh, cy);
   }
  }
  /** The camera centre sits at the middle of the usable area, so the dock corner stays clear at fit. */
  function setViewBox(): void {
   clampCamera(); const a = area(), k = scale();
   svg.setAttribute('viewBox', `${cx - a.w / 2 / k} ${cy - a.h / 2 / k} ${a.W / k} ${a.H / k}`);
  }
  function applyCamera(): void {setViewBox(); if (lastView && layout(lastView).key !== drawnKey) draw(lastView);}
  /** The map's own reset (button, 0 or F): frames again and keeps the current neighbours choice. */
  function refit(): void { if (host.hidden || !lastView) { framed = undefined; return; } place(); applyCamera(); }
  function frame(options: LWProcess2D.FrameOptions = {}): void {
   neighbours = !!options.neighbours; framed = undefined;
   if (!host.hidden && lastView) { draw(lastView); applyCamera(); }
  }
  function zoomAt(factor: number, clientX?: number, clientY?: number): void {
   const r = svg.getBoundingClientRect(), a = area();
   const mx = (clientX ?? r.left + a.w / 2) - r.left - a.w / 2, my = (clientY ?? r.top + a.h / 2) - r.top - a.h / 2;
   const before = scale(), wx = cx + mx / before, wy = cy + my / before; zoom *= factor; clampCamera(); atFit = false;
   const after = scale(); cx = wx - mx / after; cy = wy - my / after; applyCamera();
  }
  /** "Zoom in for names / details": zooms about the middle of the map to the first level that shows names, or secondary details. */
  function zoomToRead(): void {
   if (!lastView) return; const view = lastView, numbers = layout(view).mode === 'numbers', focused = document.activeElement === hint;
   const ready = () => { const L = layout(view); return numbers ? L.mode !== 'numbers' : L.secondary; };
   while (!ready() && zoom < 8) { zoom = Math.min(8, zoom * 1.05); clampCamera(); atFit = false; }
   applyCamera(); if (focused && hint.hidden) svg.focus({preventScroll: true});
  }
  const panBy = (dx: number, dy: number) => {const k = scale(); cx -= dx / k; cy -= dy / k; atFit = false; applyCamera();};
  const wheel = (e: WheelEvent) => {e.preventDefault(); zoomAt(Math.exp(-e.deltaY * .0015), e.clientX, e.clientY);};
  const down = (e: PointerEvent) => {
   if (e.button > 2) return; pointers.set(e.pointerId, {x: e.clientX, y: e.clientY}); last = {x: e.clientX, y: e.clientY};
   dragStart = pointers.size === 1 ? {x: e.clientX, y: e.clientY, pid: e.pointerId} : null; panning = pointers.size > 1;
   if (panning && !svg.hasPointerCapture(e.pointerId)) svg.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
   const known = pointers.get(e.pointerId); if (!known) return;
   if (pointers.size === 2) {
    const [a, b] = [...pointers.values()] as [{x: number; y: number}, {x: number; y: number}], before = Math.hypot(a.x - b.x, a.y - b.y);
    known.x = e.clientX; known.y = e.clientY; const after = Math.hypot(a.x - b.x, a.y - b.y);
    if (before > 0 && after > 0) zoomAt(after / before, (a.x + b.x) / 2, (a.y + b.y) / 2);
    return;
   }
   known.x = e.clientX; known.y = e.clientY;
   if (!panning && dragStart && Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y) > 4) {panning = true; svg.setPointerCapture(e.pointerId); svg.classList.add('panning');}
   if (panning) {panBy(e.clientX - last.x, e.clientY - last.y); last = {x: e.clientX, y: e.clientY};}
  };
  const up = (e: PointerEvent) => {
   pointers.delete(e.pointerId); if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
   if (!pointers.size) {panning = false; dragStart = null; svg.classList.remove('panning');}
  };
  const keys = (e: KeyboardEvent) => {
   if (e.ctrlKey || e.metaKey || e.altKey) return; const step = 60;
   if (e.key === '+' || e.key === '=') zoomAt(1.25); else if (e.key === '-') zoomAt(.8); else if (e.key === '0' || e.key.toLowerCase() === 'f') refit();
   else if (e.key === 'ArrowLeft') panBy(step, 0); else if (e.key === 'ArrowRight') panBy(-step, 0); else if (e.key === 'ArrowUp') panBy(0, step);
   else if (e.key === 'ArrowDown') panBy(0, -step); else return;
   e.preventDefault();
  };
  svg.addEventListener('wheel', wheel, {passive: false}); svg.addEventListener('pointerdown', down); svg.addEventListener('pointermove', move);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) svg.addEventListener(type, up);
  svg.addEventListener('keydown', keys);
  for (const [name, text, action] of [['Zoom in', '+', () => zoomAt(1.25)], ['Zoom out', '−', () => zoomAt(.8)], ['Reset map view', '⌂', refit]] as const) {
   const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.title = name; b.setAttribute('aria-label', name);
   b.addEventListener('click', () => action()); controls.append(b);
  }
  // Studio legend row: the zoom button and the caption of the hovered or focused card (the caption keeps one fixed row).
  const legend = host.closest('.process-stage')?.querySelector('.process-legend');
  const hint = document.createElement('button'), caption = document.createElement('p');
  hint.type = 'button'; hint.id = 'map-zoom-hint'; hint.className = 'map-zoom-hint'; hint.textContent = 'Zoom in for details'; hint.hidden = true;
  hint.addEventListener('click', zoomToRead);
  caption.id = 'map-caption'; caption.className = 'process-map-caption'; caption.textContent = CAPTION; caption.hidden = true;
  legend?.insertBefore(hint, legend.querySelector('#camera-hint')); legend?.insertBefore(caption, legend.querySelector('#camera-hint'));
  function syncHint(L = lastView && layout(lastView)): void {
   const text = L?.mode === 'numbers' ? 'Zoom in for names' : 'Zoom in for details';
   hint.hidden = host.hidden || !L || L.secondary; if (hint.textContent !== text) hint.textContent = text; caption.hidden = host.hidden || !L;
  }
  /** The caption names the hovered card, else the focused one, else says how to use it. */
  function syncCaption(): void {
   const at = document.activeElement, focused = at && at !== svg && svg.contains(at) ? at.closest('g[role=button]') : null;
   const hovered = hoverId ? svg.querySelector('#' + CSS.escape('process-map-' + hoverId)) : null;
   const text = (hovered ?? focused)?.getAttribute('data-caption') ?? CAPTION;
   if (caption.textContent !== text) { caption.textContent = text; caption.title = text; }
  }
  svg.addEventListener('pointerover', e => {
   const g = (e.target as Element).closest('g[role=button]'); hoverId = g ? g.id.slice('process-map-'.length) : null; syncCaption();
  });
  svg.addEventListener('pointerleave', () => { hoverId = null; syncCaption(); });
  // Entering anything outside the map also ends the hover, so a leave missed during a redraw under the pointer cannot pin the caption.
  const outside = (e: PointerEvent) => { if (hoverId && !svg.contains(e.target as Node)) { hoverId = null; syncCaption(); } };
  document.addEventListener('pointerover', outside);
  svg.addEventListener('focusin', syncCaption); svg.addEventListener('focusout', syncCaption);
  const seen = new MutationObserver(() => { syncHint(); if (!host.hidden && lastView) applyCamera(); }); seen.observe(host, {attributes: true, attributeFilter: ['hidden']});
  // Screen-sized cards make the fitted bounds depend on the map size: a resize measures them again and keeps an untouched framing.
  const resize = () => { if (!lastView || host.hidden) return; if (atFit) framed = undefined; draw(lastView); };
  const resized = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null; resized?.observe(svg);
  if (document.getElementById('camera-hint')) svg.setAttribute('aria-describedby', 'camera-hint');
  function draw(view: LWProcessApp.View): void {
   lastView = view; const focusedId = svg.contains(document.activeElement) ? document.activeElement?.id : undefined;
   const {definition: d, snapshot: q} = view; svg.replaceChildren();
   const chosen = view.selected === null ? undefined : d.steps.find(s => s.id === view.selected), single = !!chosen && scene(view);
   const steps = !chosen ? d.steps : single ? [chosen] : around(d, chosen);
   const locations = new Map(steps.map(s => [s.id, single ? [0, 0] : s.scene.position] as const));
   const drawnSet = steps.map(s => s.id).join(',');
   if (pairsOf !== d || pairsKey !== drawnSet) {
    pairsOf = d; pairsKey = drawnSet; pairs = []; names = steps.map(s => s.name);
    const apart = (a: LWProcess.Step, b: LWProcess.Step, axis: number) => Math.abs(a.scene.position[axis]! - b.scene.position[axis]!);
    steps.forEach((a, i) => steps.slice(i + 1).forEach(b => pairs.push(apart(a, b, 0), apart(a, b, 1))));
   }
   fit = fitted(view, steps, locations, single);
   const placing = framed !== view.selected; framed = view.selected;
   // Showing or hiding the number key resizes the dock, which changes the usable area and so the layout: settle it in one more pass.
   let L = layout(view);
   for (let pass = 0; pass < 2; pass++) {
    if (placing) place(); setViewBox(); L = layout(view);
    if (key.hidden === (L.mode !== 'numbers')) break; key.hidden = L.mode !== 'numbers';
   }
   drawnKey = L.key; syncHint(L);
   const order = new Map(d.steps.map((s, i) => [s.id, String(i + 1).padStart(2, '0')]));
   const dims = new Map(steps.map(step => [step.id, Card.size(step, L, order.get(step.id)!)]));
   svg.append(arrows());
   const edge = (id: string, ux: number, uy: number) => { const m = dims.get(id); return m ? Math.min(m.w / 2 / Math.max(1e-6, Math.abs(ux)), m.h / 2 / Math.max(1e-6, Math.abs(uy))) : 0; };
   const byId = new Map(d.steps.map(s => [s.id, s]));
   if (!single) for (const f of d.flows) {
    const a = locations.get(f.from), b = locations.get(f.to), source = byId.get(f.from); if (!a || !b) continue;
    const late = f.on === 'deadline', mode = source?.deadline?.mode === 'escalate' ? 'escalate' : 'interrupt';
    const dx = b[0]! - a[0]!, dy = b[1]! - a[1]!, length = Math.hypot(dx, dy) || 1, ux = dx / length, uy = dy / length, s0 = edge(f.from, ux, uy) + .15, s1 = edge(f.to, ux, uy) + .3;
    const kind = late ? 'pm-edge pm-edge-deadline pm-edge-' + mode : f.when ? 'pm-edge pm-edge-conditional' + (inclusive(source) ? ' pm-edge-inclusive' : '') : 'pm-edge';
    const path = `M${a[0]! + ux * s0},${a[1]! + uy * s0} L${b[0]! - ux * s1},${b[1]! - uy * s1}`;
    svg.append(el('path', {class: kind, 'data-flow': f.id, d: path, 'marker-end': late ? `url(#process-arrow-${mode})` : 'url(#process-arrow)'}));
    const mx = (a[0]! + b[0]!) / 2, my = (a[1]! + b[1]!) / 2;
    if (f.label) {
     const text = el('text', {class: 'pm-edge-label', x: mx, y: my - .4, 'font-size': .55, 'text-anchor': 'middle'}, f.label);
     svg.append(small(text, L.ppu * .55 >= L.px.text));
    }
    if (late) svg.append(deadlineTag(f.id, mode, mx, my + (f.label ? .15 : -.45), L));
   }
   // Tokens are grouped by step once per draw.
   const metrics = new Map(q.steps.map(m => [m.id, m])), byStep = new Map<string, LWProcess.Token[]>();
   for (const t of q.tokens) { const list = byStep.get(t.stepId); if (list) list.push(t); else byStep.set(t.stepId, [t]); }
   for (const step of steps) {
    const at = locations.get(step.id)!, metric = metrics.get(step.id), size = dims.get(step.id)!; if (!metric) continue;
    const current = !single && step.id === view.selected;
    svg.append(Card.draw({step, metric, work: byStep.get(step.id) ?? [], x: at[0]!, y: at[1]!, size, current}, L, select));
   }
   if (focusedId) (document.getElementById(focusedId) as unknown as SVGElement | null)?.focus({preventScroll: true});
   syncCaption();
  }
  /**
   * World bounds of the drawn steps with room for their cards and the pills above them. Zoomed-out cards and cues keep a screen size,
   * so each card is bounded at the fitted scale (zoom 1, two passes settle it); the bounds then stay the same at every zoom level.
   */
  function fitted(view: LWProcessApp.View, steps: LWProcess.Step[], at: Map<string, readonly number[]>, single: boolean): typeof fit {
   const xs = [...at.values()].map(p => p[0]!), ys = [...at.values()].map(p => p[1]!), rows = Math.max(0, ...steps.map(s => pillRows(s, single)));
   const minX = Math.min(...xs) - 6.5, width = Math.max(...xs) - minX + 6.5, pillTop = Math.max(4.5, rows ? (single ? 3.5 : 3) + 1.5 + (rows - 1) * 1.05 : 0);
   fit = {x: minX, y: Math.min(...ys) - pillTop, w: width, h: Math.max(...ys) - Math.min(...ys) + pillTop + 4.5};
   if (single) return fit;
   for (let pass = 0; pass < 2; pass++) {
    const saved = zoom; zoom = 1; const L = layout(view); zoom = saved;
    if (L.mode === 'full') break;
    const half = (L.mode === 'names' ? L.lines * L.px.line + L.px.chrome : L.px.badgeH) / 2 / L.ppu, room = L.px.pad / L.ppu;
    const k = Math.max(1, L.px.cue / (.9 * L.ppu)), gate = .75 * Math.max(1, L.px.cue / (1.5 * L.ppu));
    let top = Infinity, bottom = -Infinity;
    for (const s of steps) {
     const y = at.get(s.id)![1]!, n = pillRows(s, false) + (s.kind === 'end' && s.outcome ? 1 : 0);
     top = Math.min(top, y - half - Math.max(n ? (1.15 + (n - 1) * 1.05) * k : 0, inclusive(s) ? gate : 0)); bottom = Math.max(bottom, y + half);
    }
    fit = {x: minX, y: top - room, w: width, h: bottom - top + 2 * room};
   }
   return fit;
  }
  function arrows(): SVGDefsElement {
   const defs = el('defs');
   for (const [id, size] of [['process-arrow', .6], ['process-arrow-interrupt', .85], ['process-arrow-escalate', .85]] as const) {
    const m = el('marker', {id, markerWidth: size, markerHeight: size, viewBox: '0 0 5 5', refX: 4, refY: 2.5, orient: 'auto', markerUnits: 'userSpaceOnUse'});
    m.append(el('path', {class: 'pm-arrow ' + id.replace('process-', 'pm-'), d: 'M0 0 L5 2.5 L0 5 Z'})); defs.append(m);
   }
   return defs;
  }
  /** The tag on a deadline path: its text follows the secondary-text rule; below it a clock disc of at least the cue size keeps the wording in its tooltip. */
  function deadlineTag(flow: string, mode: 'interrupt' | 'escalate', mx: number, my: number, L: LWProcessMapCard.Layout): SVGGElement {
   const text = 'deadline · ' + mode, k = L.secondary ? 1 : Math.max(1, L.px.cue / (.9 * L.ppu)), w = L.secondary ? text.length * .29 + .9 : .9;
   const tag = el('g', {class: 'pm-deadline-tag', 'data-flow': flow}), body = el('g', {transform: `translate(${mx} ${my}) scale(${k})`});
   body.append(el('rect', {class: 'pm-deadline-tag-box', x: -w / 2, y: 0, width: w, height: .9, rx: .45, 'stroke-width': .07, style: `stroke:${TONE[mode]}`}));
   if (!L.secondary) body.append(glyph('clock', 0, .45, .6, TONE[mode], 0));
   body.append(small(el('text', {class: 'pm-pill-text', x: 0, y: .64, 'font-size': .5, 'text-anchor': 'middle'}, text), L.secondary));
   tag.append(el('title', {}, `Deadline path (${mode === 'escalate' ? 'escalates: the work keeps going' : 'interrupts: the work is cancelled'})`), body);
   return tag;
  }
  return {draw, frame, dispose() {document.removeEventListener('pointerover', outside); seen.disconnect(); resized?.disconnect(); hint.remove(); caption.remove(); svg.remove(); dock.remove();}};
 }
 root.LWProcess2D = {create, legend: () => root.LWProcessMapMarks.legend()};
})(globalThis);
