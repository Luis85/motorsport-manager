/// <reference path="./process-contracts.d.ts" />
/** Exact SVG graph/step-scene projection. Selection sends intent; no simulation ownership. */
declare namespace LWProcess2D {
 interface Surface {draw(view: LWProcessApp.View): void; frame(): void; dispose(): void;}
 interface Api {create(host: HTMLElement, select: (id: string) => void): Surface;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcess2D?: LWProcess2D.Api; LWProcessRooms: LWProcessRooms.Api};
 const NS = 'http://www.w3.org/2000/svg';
 function el<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number> = {}, text?: string): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, name); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v)); if (text !== undefined) n.textContent = text; return n;
 }
 const MIN_TITLE_PX = 11, MIN_TEXT_PX = 9, MAX_TITLE_CHARS = 20, AUTOMATED = new Set(['machine', 'system']);
 const trunc = (s: string, max: number) => s.length > max ? s.slice(0, Math.max(1, max - 1)).trimEnd() + '…' : s;
 /** Break at spaces into at most `lines` lines of about `per` characters; overflow ends in an ellipsis (the full name stays in the element's title). */
 function wrap(text: string, per: number, lines: number): string[] {
  const words = text.trim().split(/\s+/), out: string[] = []; let line = '', i = 0;
  for (; i < words.length; i++) {
   const word = words[i]!, next = line ? line + ' ' + word : word;
   if (next.length <= per) {line = next; continue;}
   if (line) {out.push(line); line = ''; if (out.length === lines) break;}
   line = trunc(word, per); if (word.length > per) {out.push(line); line = ''; if (out.length === lines) {i++; break;}}
  }
  if (line) out.push(line);
  if (i < words.length && out.length) out[out.length - 1] = trunc(out[out.length - 1] + ' ' + words.slice(i).join(' '), per);
  return out;
 }
 /** Secondary text stays in the document (readable text content and tooltips) but is not painted while it would render below the minimum screen size. */
 function small<T extends SVGElement>(node: T, visible: boolean): T {node.setAttribute('class', 'pm-secondary'); if (!visible) node.setAttribute('display', 'none'); return node;}
 /** Small per-theme icon: bright and progress-aware while working, muted when idle. Static so refresh redraws stay cheap. */
 function glyph(id: string, x: number, y: number, size: number, color: string, progress: number): SVGGElement {
  const g = el('g', {transform: `translate(${x} ${y}) scale(${size})`, fill: 'none', stroke: color, 'stroke-width': .09, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true'});
  const bars = (n: number) => { for (let i = 0; i < n; i++) g.append(el('path', {d: `M-.3 ${-.08 + i * .18} H${-.3 + .6 * Math.min(1, Math.max(.2, progress * 1.4 - i * .25))}`})); };
  if (id === 'office') {g.append(el('rect', {x: -.5, y: -.4, width: 1, height: .65, rx: .06}), el('path', {d: 'M-.25 .45 H.25 M0 .25 V.45'})); bars(2);}
  else if (id === 'studio') g.append(el('path', {d: 'M-.45 .4 L.3 -.35 L.45 -.2 L-.3 .55 Z M-.45 .4 L-.5 .55 L-.3 .55'}), el('path', {d: `M-.5 .62 H${-.5 + progress}`}));
  else if (id === 'lab') g.append(el('path', {d: 'M-.15 -.5 V-.1 L-.45 .45 H.45 L.15 -.1 V-.5 M-.2 -.5 H.2'}), el('circle', {cx: 0, cy: .2 - progress * .15, r: .07}));
  else if (id === 'workshop') g.append(el('circle', {cx: 0, cy: 0, r: .22}), el('path', {d: 'M0 -.5 V-.3 M0 .3 V.5 M-.5 0 H-.3 M.3 0 H.5 M-.35 -.35 L-.22 -.22 M.22 .22 L.35 .35 M.35 -.35 L.22 -.22 M-.22 .22 L-.35 .35'}));
  else if (id === 'review') g.append(el('rect', {x: -.4, y: -.5, width: .8, height: 1, rx: .06}), el('path', {d: 'M-.2 0 L-.05 .15 L.22 -.2'}));
  else if (id === 'archive') g.append(el('path', {d: 'M-.5 -.35 H-.1 L.05 -.2 H.5 V.4 H-.5 Z'}), el('path', {d: 'M-.5 -.05 H.5'}));
  else if (id === 'reception') g.append(el('rect', {x: -.5, y: -.35, width: 1, height: .7, rx: .06}), el('path', {d: 'M-.5 -.35 L0 .05 L.5 -.35'}));
  else if (id === 'dispatch') g.append(el('rect', {x: -.45, y: -.2, width: .6, height: .6}), el('path', {d: 'M.25 .1 H.55 M.45 -.05 L.58 .1 L.45 .25'}));
  else if (id === 'clock') g.append(el('circle', {cx: 0, cy: 0, r: .42}), el('path', {d: 'M0 -.25 V0 L.2 .12'}));
  else if (id === 'machine') g.append(el('path', {d: 'M-.45 .5 H-.05 M-.25 .5 V.25 M-.25 .25 L-.05 -.2 L.28 -.1'}), el('path', {d: `M.28 -.1 V${.05 + .25 * progress} M.18 ${.05 + .25 * progress} H.38`}), el('circle', {cx: -.25, cy: .25, r: .08}), el('circle', {cx: -.05, cy: -.2, r: .08}));
  else if (id === 'system') g.append(el('rect', {x: -.42, y: -.5, width: .84, height: .4, rx: .05}), el('rect', {x: -.42, y: .02, width: .84, height: .4, rx: .05}), el('circle', {cx: -.26, cy: -.3, r: .035}), el('circle', {cx: -.26, cy: .22, r: .035}), el('path', {d: `M-.42 .62 H${-.42 + .84 * progress}`}));
  else if (id === 'council') g.append(el('circle', {cx: 0, cy: 0, r: .3}), el('path', {d: 'M0 -.5 V-.38 M0 .38 V.5 M-.5 0 H-.38 M.38 0 H.5'}));
  else g.append(el('circle', {cx: 0, cy: 0, r: .12}), el('path', {d: 'M-.5 0 H-.12 M.12 0 H.5 M0 -.5 V-.12 M0 .12 V.5'}));
  return g;
 }
 function create(host: HTMLElement, select: (id: string) => void): LWProcess2D.Surface {
  const svg = el('svg', {role: 'group', tabindex: 0, 'aria-label': 'Process graph and active work. Drag to pan, scroll or pinch to zoom, arrows pan, plus and minus zoom, zero resets.', preserveAspectRatio: 'xMidYMid meet'}); host.append(svg);
  // Presentation-only camera over the fitted bounds: zoom 1 is the full fit; centre offsets are in world units.
  let fit = {x: 0, y: 0, w: 1, h: 1}, zoom = 1, cx = 0, cy = 0, framed: string | null | undefined, lastView: LWProcessApp.View | undefined, drawnKey = '', dragStart: {x: number; y: number; pid: number} | null = null, panning = false, last = {x: 0, y: 0};
  const pointers = new Map<number, {x: number; y: number}>();
  const clampCamera = () => {zoom = Math.max(.5, Math.min(8, zoom)); cx = Math.max(fit.x, Math.min(fit.x + fit.w, cx)); cy = Math.max(fit.y, Math.min(fit.y + fit.h, cy));};
  // Screen pixels per world unit; a hidden or unmeasured map assumes the usual stage size so the first layout is already sensible.
  const scale = () => { const r = svg.getBoundingClientRect(), width = r.width > 2 ? r.width : 900, height = r.height > 2 ? r.height : 480; return Math.max(1e-6, Math.min(width / (fit.w / zoom), height / (fit.h / zoom))); };
  /** Text keeps its screen size, not its world size: titles never fall below about 11px and secondary lines appear only once they can be 9px or larger. */
  function layout(view: LWProcessApp.View) {
   const ppu = scale(), single = view.selected !== null, compact = !single && ppu * .67 < MIN_TITLE_PX, secondary = single || ppu * .46 >= MIN_TEXT_PX, font = compact ? MIN_TITLE_PX / ppu : .67;
   return {compact, secondary, font, single, key: `${compact}|${secondary}|${compact ? Math.round(font * 40) : ''}|${single}`};
  }
  function setViewBox(): void {clampCamera(); const w = fit.w / zoom, h = fit.h / zoom; svg.setAttribute('viewBox', `${cx - w / 2} ${cy - h / 2} ${w} ${h}`);}
  function applyCamera(): void {setViewBox(); if (lastView && layout(lastView).key !== drawnKey) draw(lastView);}
  function frame(): void {zoom = 1; cx = fit.x + fit.w / 2; cy = fit.y + fit.h / 2; applyCamera();}
  function zoomAt(factor: number, clientX?: number, clientY?: number): void {
   const r = svg.getBoundingClientRect(), mx = (clientX ?? r.left + r.width / 2) - r.left - r.width / 2, my = (clientY ?? r.top + r.height / 2) - r.top - r.height / 2, before = scale();
   const wx = cx + mx / before, wy = cy + my / before; zoom *= factor; clampCamera(); const after = scale(); cx = wx - mx / after; cy = wy - my / after; applyCamera();
  }
  const panBy = (dx: number, dy: number) => {const k = scale(); cx -= dx / k; cy -= dy / k; applyCamera();};
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
    known.x = e.clientX; known.y = e.clientY; const after = Math.hypot(a.x - b.x, a.y - b.y); if (before > 0 && after > 0) zoomAt(after / before, (a.x + b.x) / 2, (a.y + b.y) / 2); return;
   }
   known.x = e.clientX; known.y = e.clientY;
   if (!panning && dragStart && Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y) > 4) {panning = true; svg.setPointerCapture(e.pointerId); svg.classList.add('panning');}
   if (panning) {panBy(e.clientX - last.x, e.clientY - last.y); last = {x: e.clientX, y: e.clientY};}
  };
  const up = (e: PointerEvent) => {
   pointers.delete(e.pointerId); if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
   if (!pointers.size) {panning = false; dragStart = null; svg.classList.remove('panning');}
  };
  const key = (e: KeyboardEvent) => {
   if (e.ctrlKey || e.metaKey || e.altKey) return; const step = 60;
   if (e.key === '+' || e.key === '=') zoomAt(1.25); else if (e.key === '-') zoomAt(.8); else if (e.key === '0' || e.key.toLowerCase() === 'f') frame();
   else if (e.key === 'ArrowLeft') panBy(step, 0); else if (e.key === 'ArrowRight') panBy(-step, 0); else if (e.key === 'ArrowUp') panBy(0, step); else if (e.key === 'ArrowDown') panBy(0, -step); else return;
   e.preventDefault();
  };
  svg.addEventListener('wheel', wheel, {passive: false}); svg.addEventListener('pointerdown', down); svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up); svg.addEventListener('lostpointercapture', up); svg.addEventListener('keydown', key);
  const controls = document.createElement('div'); controls.className = 'process-map-controls'; controls.setAttribute('role', 'group'); controls.setAttribute('aria-label', 'Map zoom');
  for (const [label, text, action] of [['Zoom in', '+', () => zoomAt(1.25)], ['Zoom out', '−', () => zoomAt(.8)], ['Reset map view', '⌂', frame]] as const) {
   const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.title = label; b.setAttribute('aria-label', label); b.addEventListener('click', action); controls.append(b);
  }
  host.append(controls);
  const legend = host.closest('.process-stage')?.querySelector('.process-legend'), hint = document.createElement('span'); hint.id = 'map-zoom-hint'; hint.className = 'map-zoom-hint'; hint.textContent = 'Zoom in for details'; hint.hidden = true;
  legend?.insertBefore(hint, legend.querySelector('#camera-hint'));
  const syncHint = () => {hint.hidden = host.hidden || !lastView || layout(lastView).secondary;};
  const seen = new MutationObserver(() => { syncHint(); if (!host.hidden && lastView) applyCamera(); }); seen.observe(host, {attributes: true, attributeFilter: ['hidden']});
  const resized = typeof ResizeObserver === 'function' ? new ResizeObserver(() => applyCamera()) : null; resized?.observe(svg);
  if (document.getElementById('camera-hint')) svg.setAttribute('aria-describedby', 'camera-hint');
  function draw(view: LWProcessApp.View): void {
   lastView = view; const focusedId = svg.contains(document.activeElement) ? document.activeElement?.id : undefined;
   const {definition: d, snapshot: q} = view; svg.replaceChildren();
   const selected = d.steps.find(s => s.id === view.selected), steps = selected ? [selected] : d.steps;
   const locations = new Map(steps.map(s => [s.id, selected ? [0, 0] : s.scene.position]));
   const xs = [...locations.values()].map(p => p[0]!), ys = [...locations.values()].map(p => p[1]!);
   const minX = Math.min(...xs) - 6.5, minY = Math.min(...ys) - 4.5, width = Math.max(...xs) - minX + 6.5, height = Math.max(...ys) - minY + 4.5;
   fit = {x: minX, y: minY, w: width, h: height};
   if (framed !== view.selected) {framed = view.selected; zoom = 1; cx = minX + width / 2; cy = minY + height / 2;}
   setViewBox(); const L = layout(view); drawnKey = L.key; syncHint();
   // Card size per step: fixed in world units, except that a zoomed-out map wraps the screen-sized title over two lines and widens the card to hold it.
   const dims = new Map(steps.map(step => {
    const lines = selected ? wrap(step.name, 26, 2) : L.compact ? wrap(trunc(step.name, MAX_TITLE_CHARS), Math.max(4, Math.floor(11 / (L.font * .54))), 2) : [trunc(step.name, Math.min(MAX_TITLE_CHARS, Math.floor(7.2 / (L.font * .56))))];
    const w = selected ? 10 : L.compact ? Math.min(12, Math.max(8, Math.max(...lines.map(l => l.length)) * L.font * .54 + 1.2)) : 8, h = selected ? 7 : Math.max(4.8, lines.length * L.font * 1.2 + 1.5);
    return [step.id, {lines, w, h}] as const;
   }));
   const defs = el('defs'), marker = el('marker', {id: 'process-arrow', markerWidth: 5, markerHeight: 5, refX: 4, refY: 2.5, orient: 'auto', markerUnits: 'strokeWidth'});
   marker.append(el('path', {d: 'M0 0 L5 2.5 L0 5 Z', fill: '#7b8b9f'})); defs.append(marker); svg.append(defs);
   const edge = (id: string, ux: number, uy: number) => { const m = dims.get(id)!; return Math.min(m.w / 2 / Math.max(1e-6, Math.abs(ux)), m.h / 2 / Math.max(1e-6, Math.abs(uy))); };
   if (!selected) for (const f of d.flows) {
    const a = locations.get(f.from)!, b = locations.get(f.to)!;
    const dx = b[0]! - a[0]!, dy = b[1]! - a[1]!, length = Math.hypot(dx, dy) || 1, ux = dx / length, uy = dy / length, s0 = edge(f.from, ux, uy) + .15, s1 = edge(f.to, ux, uy) + .3;
    svg.append(el('path', {d: `M${a[0]! + ux * s0},${a[1]! + uy * s0} L${b[0]! - ux * s1},${b[1]! - uy * s1}`, fill: 'none', stroke: f.when ? '#c79871' : '#65778b', 'stroke-width': .12, 'marker-end': 'url(#process-arrow)'}));
    if (f.label) svg.append(small(el('text', {x: (a[0]! + b[0]!) / 2, y: (a[1]! + b[1]!) / 2 - .4, fill: '#b1bdcd', 'font-size': .55, 'text-anchor': 'middle'}, f.label), scale() * .55 >= MIN_TEXT_PX));
   }
   for (const step of steps) {
    const [x, y] = locations.get(step.id)! as [number, number], metric = q.steps.find(s => s.id === step.id)!, automated = AUTOMATED.has(step.kind);
    const {lines, w, h} = dims.get(step.id)!, th = root.LWProcessRooms.theme(step), timing = metric.timers.waiting > 0, working = metric.active > 0, waiting = !working && (metric.queued > 0 || timing);
    const group = el('g', {id: 'process-map-' + step.id, role: 'button', tabindex: 0, 'aria-label': step.name + (automated ? ` (${step.kind}${step.technology ? ', ' + step.technology : ''})` : '') + ', ' + metric.active + ' active, ' + metric.queued + ' waiting' + (metric.timers.waiting ? ', ' + metric.timers.waiting + ' on timer, next due minute ' + metric.timers.nextDue : '') + (automated ? ', ' + metric.completed + ' completed' : '')});
    const outline = `M${x - w / 2} ${y - h / 2} h${w} v${h} h${-w} Z`;
    group.append(el('path', {class: 'pm-focus-ring', d: outline, 'aria-hidden': 'true'}));
    // Idle cards use the neutral line colour (CSS class); amber stays for the selected card, the theme accent marks work and light blue marks waiting.
    group.append(el('rect', {class: 'pm-card' + (working || selected ? ' pm-work' : waiting ? '' : ' pm-idle'), x: x - w / 2, y: y - h / 2, width: w, height: h, rx: .3, fill: working ? '#222c37' : '#181e26', stroke: working ? th.accent : selected ? '#ffbb73' : waiting ? '#91b9d5' : '#364150', 'stroke-width': working || selected ? .18 : .1, opacity: working || waiting || selected ? 1 : .9}));
    const title = el('text', {class: 'pm-title', x, y: L.compact ? y - (lines.length - 1) * L.font * .6 + L.font * .35 : y - h / 2 + .85, fill: '#edf2f7', 'font-size': L.font, 'text-anchor': 'middle'});
    lines.forEach((line, i) => title.append(el('tspan', {x, dy: i ? L.font * 1.2 : 0}, line)));
    group.append(title, el('title', {}, step.name + (step.technology ? ' · ' + step.technology : '')));
    const progress = working ? Math.max(0, Math.min(1, q.tokens.filter(t => t.stepId === step.id && t.status === 'active').reduce((n, t) => n + 1 - t.remaining / (step.duration || 1), 0) / metric.active)) : 0;
    group.append(el('rect', {x: x - w / 2 + .3, y: y + h / 2 - .35, width: w - .6, height: .08, fill: '#364150'}), el('rect', {x: x - w / 2 + .3, y: y + h / 2 - .35, width: (w - .6) * progress, height: .08, fill: th.accent}));
    group.append(glyph(th.id, x - w / 2 + .9, y + h / 2 - 1, selected ? 1.3 : .85, working ? th.accent : '#6a7684', progress));
    const extra = selected ? .75 * (lines.length - 1) : 0;
    const status = working ? th.task : timing ? 'Waiting on timer' : waiting ? (automated ? 'Waiting for capacity' : 'Waiting to start') : 'Idle · standby';
    group.append(small(el('text', {x: x - w / 2 + (selected ? 1.8 : 1.5), y: y + h / 2 - .85, fill: working ? '#edf2f7' : '#8a97a8', 'font-size': .46}, status), L.secondary), el('title', {}, th.label));
    const span = step.kind === 'timer' ? (step.until !== undefined ? 'until minute ' + step.until : (step.duration ?? 0) + ' min') : (step.duration ?? 0) + ' min';
    group.append(small(el('text', {x, y: y - h / 2 + 1.55 + extra, fill: '#b1bdcd', 'font-size': .46, 'text-anchor': 'middle'}, `${step.kind} · ${span} · ${metric.completed} completed`), L.secondary));
    if (automated && step.technology) group.append(small(el('text', {x, y: y - h / 2 + (selected ? 2.25 : 2.35) + extra, fill: th.accent, 'font-size': .44, 'text-anchor': 'middle'}, trunc(step.technology, 28)), L.secondary));
    const work = q.tokens.filter(t => t.stepId === step.id);
    if (selected) {
     group.append(el('text', {x, y: y - .65, fill: '#ffbb73', 'font-size': .48, 'text-anchor': 'middle'}, `${metric.active} working · ${metric.queued} waiting` + (metric.timers.waiting ? ` · ${metric.timers.waiting} on timer, next due ${metric.timers.nextDue}` : '')));
     const active = work.filter(t => t.status === 'active');
     if (active.length) {
      const duration = step.duration, progress = duration ? Math.max(0, Math.min(1, active.reduce((n, t) => n + 1 - t.remaining / duration, 0) / active.length)) : 0;
      group.append(el('rect', {x: x - 4, y: y - .35, width: 8, height: .07, fill: '#364150'}));
      group.append(el('rect', {x: x - 4, y: y - .35, width: 8 * progress, height: .07, fill: '#ffbb73'}));
     }
    }
    for (const [i, t] of work.slice(0, selected ? 40 : 8).entries()) group.append(el('circle', {cx: x - (selected ? 4 : 3) + (i % (selected ? 10 : 8)) * .8, cy: y + .65 + Math.floor(i / 10) * .6, r: .2, fill: t.status === 'active' ? '#ffbb73' : t.status === 'held' ? '#e07a7a' : t.status === 'backlog' ? '#b79ad6' : t.status === 'timer' ? '#d9c58a' : '#91b9d5'}));
    if (work.length > (selected ? 40 : 8)) group.append(el('text', {x: x + 3.1, y: y + 1.4, fill: '#edf2f7', 'font-size': .5}, '+' + (work.length - (selected ? 40 : 8))));
    if (step.backlog) {
     const stored = work.filter(t => t.status === 'backlog' || (step.kind === 'task' || automated) && t.status === 'queued').length, slots = Math.min(step.backlog.capacity, 8), filled = stored ? Math.max(1, Math.round(stored / step.backlog.capacity * slots)) : 0;
     for (let i = 0; i < slots; i++) group.append(el('rect', {x: x + w / 2 - .5 - (slots - i) * .38, y: y + h / 2 - 1.15, width: .3, height: .3, fill: i < filled ? '#b79ad6' : 'none', stroke: '#6a7684', 'stroke-width': .05}));
     group.append(small(el('text', {x: x + w / 2 - .5, y: y + h / 2 - 1.3, fill: '#b79ad6', 'font-size': .4, 'text-anchor': 'end'}, `Backlog ${stored}/${step.backlog.capacity}`), L.secondary));
    }
    group.addEventListener('click', () => select(step.id));
    group.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(step.id); } });
    svg.append(group);
   }
   if (focusedId) (document.getElementById(focusedId) as unknown as SVGElement | null)?.focus({preventScroll: true});
  }
  return {draw, frame, dispose() {seen.disconnect(); resized?.disconnect(); hint.remove(); svg.remove(); controls.remove();}};
 }
 root.LWProcess2D = {create};
})(globalThis);
