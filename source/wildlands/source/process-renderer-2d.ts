/// <reference path="./process-contracts.d.ts" />
/** Exact SVG graph/step-scene projection. Selection sends intent; no simulation ownership. */
declare namespace LWProcess2D {
 interface Surface {draw(view: LWProcessApp.View): void; dispose(): void;}
 interface Api {create(host: HTMLElement, select: (id: string) => void): Surface;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcess2D?: LWProcess2D.Api};
 const NS = 'http://www.w3.org/2000/svg';
 function el<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number> = {}, text?: string): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, name); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v)); if (text !== undefined) n.textContent = text; return n;
 }
 function create(host: HTMLElement, select: (id: string) => void): LWProcess2D.Surface {
  const svg = el('svg', {role: 'group', 'aria-label': 'Process graph and active work', preserveAspectRatio: 'xMidYMid meet'}); host.append(svg);
  function draw(view: LWProcessApp.View): void {
   const focusedId = svg.contains(document.activeElement) ? document.activeElement?.id : undefined;
   const {definition: d, snapshot: q} = view; svg.replaceChildren();
   const selected = d.steps.find(s => s.id === view.selected), steps = selected ? [selected] : d.steps;
   const locations = new Map(steps.map(s => [s.id, selected ? [0, 0] : s.scene.position]));
   const xs = [...locations.values()].map(p => p[0]!), ys = [...locations.values()].map(p => p[1]!);
   const minX = Math.min(...xs) - 6, minY = Math.min(...ys) - 5, width = Math.max(...xs) - minX + 6, height = Math.max(...ys) - minY + 5;
   svg.setAttribute('viewBox', `${minX} ${minY} ${width} ${height}`);
   const defs = el('defs'), marker = el('marker', {id: 'process-arrow', markerWidth: 5, markerHeight: 5, refX: 4, refY: 2.5, orient: 'auto', markerUnits: 'strokeWidth'});
   marker.append(el('path', {d: 'M0 0 L5 2.5 L0 5 Z', fill: '#7b8b9f'})); defs.append(marker); svg.append(defs);
   if (!selected) for (const f of d.flows) {
    const a = locations.get(f.from)!, b = locations.get(f.to)!;
    const dx = b[0]! - a[0]!, dy = b[1]! - a[1]!, length = Math.hypot(dx, dy) || 1;
    const start = [a[0]! + dx / length * 4.2, a[1]! + dy / length * 2.2], end = [b[0]! - dx / length * 4.4, b[1]! - dy / length * 2.4];
    svg.append(el('path', {d: `M${start[0]},${start[1]} L${end[0]},${end[1]}`, fill: 'none', stroke: f.when ? '#c79871' : '#65778b', 'stroke-width': .12, 'marker-end': 'url(#process-arrow)'}));
    if (f.label) svg.append(el('text', {x: (a[0]! + b[0]!) / 2, y: (a[1]! + b[1]!) / 2 - .4, fill: '#b1bdcd', 'font-size': .55, 'text-anchor': 'middle'}, f.label));
   }
   for (const step of steps) {
    const [x, y] = locations.get(step.id)! as [number, number], metric = q.steps.find(s => s.id === step.id)!;
    const group = el('g', {id: 'process-map-' + step.id, role: 'button', tabindex: 0, 'aria-label': step.name + ', ' + metric.active + ' active, ' + metric.queued + ' waiting'});
    const w = selected ? 10 : 8, h = selected ? 6 : 4;
    group.append(el('rect', {x: x - w / 2, y: y - h / 2, width: w, height: h, rx: .3, fill: '#1d242e', stroke: step.scene.color, 'stroke-width': .1}));
    const title = el('text', {x, y: y - h / 2 + .85, fill: '#edf2f7', 'font-size': .67, 'text-anchor': 'middle'}, step.name);
    if (step.name.length > 22) {title.setAttribute('textLength', String(w - .8)); title.setAttribute('lengthAdjust', 'spacingAndGlyphs');}
    group.append(title, el('title', {}, step.name));
    group.append(el('text', {x, y: y - h / 2 + 1.55, fill: '#b1bdcd', 'font-size': .48, 'text-anchor': 'middle'}, `${step.kind} · ${step.duration ?? 0} min · ${metric.completed} completed`));
    const work = q.tokens.filter(t => t.stepId === step.id);
    if (selected) {
     group.append(el('text', {x, y: y - .65, fill: '#ffbb73', 'font-size': .48, 'text-anchor': 'middle'}, `${metric.active} working · ${metric.queued} waiting`));
     const active = work.filter(t => t.status === 'active');
     if (active.length) {
      const duration = step.duration, progress = duration ? Math.max(0, Math.min(1, active.reduce((n, t) => n + 1 - t.remaining / duration, 0) / active.length)) : 0;
      group.append(el('rect', {x: x - 4, y: y - .35, width: 8, height: .07, fill: '#364150'}));
      group.append(el('rect', {x: x - 4, y: y - .35, width: 8 * progress, height: .07, fill: '#ffbb73'}));
     }
    }
    for (const [i, t] of work.slice(0, selected ? 40 : 8).entries()) group.append(el('circle', {cx: x - (selected ? 4 : 3) + (i % (selected ? 10 : 8)) * .8, cy: y + .65 + Math.floor(i / 10) * .6, r: .2, fill: t.status === 'active' ? '#ffbb73' : '#91b9d5'}));
    if (work.length > (selected ? 40 : 8)) group.append(el('text', {x: x + 3.1, y: y + 1.4, fill: '#edf2f7', 'font-size': .5}, '+' + (work.length - (selected ? 40 : 8))));
    group.addEventListener('click', () => select(step.id));
    group.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(step.id); } });
    svg.append(group);
   }
   if (focusedId) (document.getElementById(focusedId) as unknown as SVGElement | null)?.focus({preventScroll: true});
  }
  return {draw, dispose() {svg.remove();}};
 }
 root.LWProcess2D = {create};
})(globalThis);
