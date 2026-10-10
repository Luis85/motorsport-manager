/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-journey-model.ts" />
/// <reference path="./process-palette.ts" />
/**
 * Journey map: phases as columns, lanes for touchpoints, channel, feeling, pain points, opportunities and the live funnel. Renders
 * detached view values; selection sends intent only. The map shows no durations, so the display calendar does not change it. The
 * phase columns, cards and funnel facts come from the pure LWProcessJourneyModel (process-journey-model.ts), whose funnel words the
 * work still in progress between two route steps like the 2D cards and the step list (LWProcessWorkState). Phase colours and the
 * feeling faces are studio palette roles (LWProcessPalette.PHASES, LWProcessRooms.moods and the `face-ink` role).
 */
declare namespace LWProcessJourney {
 interface Surface {draw(view: LWProcessApp.View): void; frame(): void; dispose(): void;}
 interface Api {create(host: HTMLElement, onSelect: (stepId: string | null) => void): Surface;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {
  LWProcessJourney?: LWProcessJourney.Api; LWProcessRooms: LWProcessRooms.Api; LWProcessJourneyModel: LWProcessJourney.ModelApi;
  LWProcessPalette: LWProcessPalette.Api;
 };
 const NS = 'http://www.w3.org/2000/svg', LANE_WIDE = 132, LANE_NARROW = 112, SLOT_DEFAULT = 172, SLOT_MIN = 148, SLOT_MAX = 172;
 const FEEL_H = 176, FACE_R = 12;
 const KINDS: Record<string, string> = {
  start: 'Start', task: 'Task', touchpoint: 'Touchpoint', machine: 'Machine', system: 'System', timer: 'Timer', decision: 'Decision',
  fork: 'Fork', join: 'Join', end: 'End',
 };
 const PHASE_COLORS = root.LWProcessPalette.PHASES;
 const KIND_GLYPHS: Record<string, string> = {
  start: 'M-.4 0 A.4 .4 0 1 0 .4 0 A.4 .4 0 1 0 -.4 0 M-.12 -.2 L.25 0 L-.12 .2 Z',
  end: 'M-.35 .5 V-.5 H.4 L.2 -.2 L.4 .1 H-.35',
  decision: 'M0 -.5 L.5 0 L0 .5 L-.5 0 Z',
  timer: 'M-.45 0 A.45 .45 0 1 0 .45 0 A.45 .45 0 1 0 -.45 0 M0 -.25 V0 L.2 .12',
  fork: 'M-.5 0 H-.1 L.4 -.3 M-.1 0 L.4 .3',
  join: 'M-.4 -.3 L.1 0 L-.4 .3 M.1 0 H.5',
  machine: 'M-.45 .5 H-.05 M-.25 .5 V.25 L-.05 -.2 L.3 -.1 V.2',
  system: 'M-.45 -.45 H.45 V-.05 H-.45 Z M-.45 .05 H.45 V.45 H-.45 Z',
 };
 const TASK_GLYPH = 'M-.4 -.45 H.4 V.45 H-.4 Z M-.2 -.15 H.2 M-.2 .1 H.2';
 type Attrs = Record<string, string | number>;
 const svg = <K extends keyof SVGElementTagNameMap>(name: K, attrs: Attrs = {}, text?: string): SVGElementTagNameMap[K] => {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  if (text !== undefined) n.textContent = text;
  return n;
 };
 const div = (cls: string, text?: string, tag: 'div' | 'span' | 'button' | 'b' | 'em' | 'i' = 'div'): HTMLElement => {
  const n = document.createElement(tag);
  n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
 };
 const signed = (n: number, minus = '-') => n > 0 ? '+' + n : n < 0 ? minus + Math.abs(n) : '0';
 const pct = (part: number, whole: number) => whole > 0 ? Math.round(part * 100 / whole) : 0;
 /** Catmull-Rom spline through the points as a cubic Bezier path. */
 function smooth(points: {x: number; y: number}[]): string {
  if (!points.length) return '';
  let d = `M${points[0]!.x} ${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i++) {
   const p0 = points[Math.max(0, i - 1)]!, p1 = points[i]!, p2 = points[i + 1]!, p3 = points[Math.min(points.length - 1, i + 2)]!;
   d += ` C${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6} ${p2.x} ${p2.y}`;
  }
  return d;
 }
 function glyph(path: string, size = 20): SVGSVGElement {
  const s = svg('svg', {viewBox: '-.6 -.6 1.2 1.2', width: size, height: size, 'aria-hidden': 'true', focusable: 'false', class: 'jm-glyph'});
  const stroke = {fill: 'none', stroke: 'currentColor', 'stroke-width': .1, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'};
  s.append(svg('path', {d: path, ...stroke}));
  return s;
 }
 function face(level: number, x: number, y: number, r: number): SVGGElement {
  const moods = root.LWProcessRooms.moods, mood = moods.find(m => m.level === level) ?? moods[3]!;
  const ink = root.LWProcessPalette.value('face-ink');
  const g = svg('g', {class: 'jm-face', transform: `translate(${x - r} ${y - r}) scale(${r / 50})`, 'aria-hidden': 'true'});
  g.append(
   svg('circle', {cx: 50, cy: 50, r: 46, fill: mood.color, stroke: ink, 'stroke-width': 5}),
   svg('circle', {cx: 35, cy: 40, r: 5.5, fill: ink}),
   svg('circle', {cx: 65, cy: 40, r: 5.5, fill: ink}),
  );
  if (mood.brow) g.append(svg('path', {d: mood.brow, fill: 'none', stroke: ink, 'stroke-width': 5, 'stroke-linecap': 'round'}));
  const mouth = {d: mood.mouth, fill: mood.open ? ink : 'none', stroke: ink, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'};
  g.append(svg('path', mouth));
  return g;
 }
 function create(host: HTMLElement, onSelect: (stepId: string | null) => void): LWProcessJourney.Surface {
  const region = div('lw-journey'), bar = div('jm-bar'), summary = div('jm-summary', '', 'span');
  const fitButton = div('jm-fit', 'Fit', 'button') as HTMLButtonElement, scroller = div('jm-scroll'), grid = div('jm-grid');
  region.setAttribute('role', 'region');
  region.setAttribute('aria-label', 'Journey map');
  fitButton.type = 'button';
  fitButton.setAttribute('aria-pressed', 'false');
  fitButton.title = 'Fit the map to the available width when it can stay readable';
  grid.setAttribute('role', 'table');
  grid.setAttribute('aria-label', 'Journey lanes by phase');
  scroller.append(grid);
  bar.append(summary, fitButton);
  region.append(bar, scroller);
  host.append(region);
  let laneW = LANE_WIDE, slotW = SLOT_DEFAULT, fitted = false, lastView: LWProcessApp.View | undefined;
  let lastDefinition: LWProcess.Definition | undefined, lastSignature = '', map: LWProcessJourney.Layout | undefined;
  let selected: string | null = null;
  function draw(view: LWProcessApp.View): void {
   lastView = view;
   if (view.definition !== lastDefinition) {
    lastDefinition = view.definition;
    map = root.LWProcessJourneyModel.layout(view.definition);
    lastSignature = '';
   }
   const d = view.definition, q = view.snapshot, m = map!, field = d.track?.[0]?.field, metrics = new Map(q.steps.map(s => [s.id, s]));
   laneW = region.clientWidth > 0 && region.clientWidth < 600 ? LANE_NARROW : LANE_WIDE;
   const reachedKey = m.nodes.map(n => {
    const s = metrics.get(n.step.id);
    return `${s?.reached ?? 0}:${field ? s?.tracked[field]?.mean ?? '' : ''}`;
   });
   // Work moving between steps, or starting or blocking at one, changes the funnel's in-progress words without changing any reached count.
   const workKey = m.nodes.map(n => {
    const s = metrics.get(n.step.id);
    return `${s?.active ?? 0}:${s?.queued ?? 0}:${s?.held ?? 0}`;
   }).join(',');
   const signature = [view.selected, slotW, laneW, q.metrics.goals, q.metrics.lost, q.metrics.conversion, ...reachedKey].join('|') + '|' + workKey;
   if (signature === lastSignature) return;
   lastSignature = signature;
   const active = document.activeElement as HTMLElement | null;
   const focusId = grid.contains(active) ? active!.dataset.step : undefined, previousSelected = selected;
   selected = view.selected;
   render(d, q, m, field, metrics);
   rove();
   if (focusId) grid.querySelector<HTMLElement>(`[data-step="${CSS.escape(focusId)}"]`)?.focus({preventScroll: true});
   if (selected && selected !== previousSelected) reveal(grid.querySelector<HTMLElement>(`[data-step="${CSS.escape(selected)}"]`));
  }
  function reveal(card: HTMLElement | null | undefined): void {
   if (!card) return;
   const box = scroller.getBoundingClientRect(), r = card.getBoundingClientRect();
   if (r.left < box.left + laneW) scroller.scrollLeft -= box.left + laneW - r.left + 8;
   else if (r.right > box.right) scroller.scrollLeft += r.right - box.right + 8;
  }
  function render(d: LWProcess.Definition, q: LWProcess.Snapshot, m: LWProcessJourney.Layout, field: string | undefined,
   metrics: Map<string, LWProcess.StepMetric>): void {
   const conv = q.metrics.conversion, first = m.nodes.find(n => n.main), start = metrics.get(first?.step.id ?? '')?.reached ?? 0;
   const phases = `${m.groups.length} ${m.groups.length === 1 ? 'phase' : 'phases'}`;
   const conversion = conv === null ? '–' : (conv / 10).toFixed(1) + '%';
   summary.textContent = `${phases} · ${m.nodes.length} steps · Goals ${q.metrics.goals} · Lost ${q.metrics.lost} · Conversion ${conversion}`;
   grid.replaceChildren();
   grid.style.setProperty('--slot', slotW + 'px');
   grid.style.setProperty('--lane', laneW + 'px');
   grid.style.gridTemplateColumns = `${laneW}px repeat(${m.slots}, ${slotW}px)`;
   // ARIA table columns: 1 is the lane header, 2 + slot a step column; a phase or lane cell spans its slots, so every cell sits under its phase header.
   let row = 0;
   grid.setAttribute('aria-colcount', String(m.slots + 1));
   const addRow = (name: string, cls = ''): HTMLElement => {
    row++;
    const r = div('jm-row');
    r.setAttribute('role', 'row');
    const head = div('jm-lane ' + cls);
    head.setAttribute('role', 'rowheader');
    head.style.gridRow = String(row);
    head.style.gridColumn = '1';
    head.setAttribute('aria-colindex', '1');
    head.append(div('jm-lane-name', name, 'b'));
    r.append(head);
    grid.append(r);
    return r;
   };
   const cell = (r: HTMLElement, start: number, span: number, cls = ''): HTMLElement => {
    const c = div('jm-cell ' + cls);
    c.setAttribute('role', 'cell');
    c.setAttribute('aria-colindex', String(2 + start));
    if (span > 1) c.setAttribute('aria-colspan', String(span));
    c.style.gridRow = String(row);
    c.style.gridColumn = `${2 + start} / span ${span}`;
    r.append(c);
    return c;
   };
   // Phase header row.
   row++;
   const header = div('jm-row');
   header.setAttribute('role', 'row');
   const corner = div('jm-lane jm-corner');
   corner.setAttribute('role', 'columnheader');
   corner.style.gridRow = String(row);
   corner.style.gridColumn = '1';
   corner.append(div('jm-lane-name', 'Phase', 'b'));
   header.append(corner);
   corner.setAttribute('aria-colindex', '1');
   m.groups.forEach((g, i) => {
    const c = cell(header, g.start, g.span, 'jm-phase'), count = g.main.length + g.branches.length;
    c.setAttribute('role', 'columnheader');
    c.style.borderTopColor = PHASE_COLORS[i % PHASE_COLORS.length]!;
    c.append(div('jm-phase-name', g.phase, 'b'), div('jm-phase-count', `${count} ${count === 1 ? 'step' : 'steps'}`, 'span'));
   });
   grid.append(header);
   const card = (n: LWProcessJourney.Node): HTMLElement => {
    const s = n.step, st = metrics.get(s.id), reached = st?.reached ?? 0;
    const channel = s.channel ? root.LWProcessRooms.channels[s.channel] : undefined;
    const kind = s.kind === 'touchpoint' ? channel?.label ?? 'Touchpoint' : KINDS[s.kind] ?? s.kind;
    const outcome = s.kind === 'end' && s.outcome ? s.outcome : undefined;
    const cls = 'jm-card' + (selected === s.id ? ' selected' : '') + (n.main ? '' : ' branch') + (outcome ? ' end-' + outcome : '');
    const b = div(cls, undefined, 'button') as HTMLButtonElement;
    b.type = 'button';
    b.dataset.step = s.id;
    b.id = 'jm-card-' + s.id;
    b.setAttribute('aria-pressed', String(selected === s.id));
    const feeling = s.emotion !== undefined ? ['feeling ' + signed(s.emotion)] : [];
    b.setAttribute('aria-label', [s.name, kind, ...(outcome ? [outcome] : []), 'phase ' + n.phase, ...feeling, reached + ' reached'].join(', '));
    const top = div('jm-card-top');
    const fallback = s.kind === 'task' || s.kind === 'touchpoint' ? TASK_GLYPH : KIND_GLYPHS[s.kind] ?? TASK_GLYPH;
    top.append(glyph(channel?.glyph ?? fallback), div('jm-card-name', s.name, 'span'));
    b.append(top);
    b.append(div('jm-card-kind', s.kind === 'touchpoint' ? 'Touchpoint · ' + kind : kind, 'span'));
    if (outcome) b.append(div('jm-badge ' + outcome, `${outcome === 'goal' ? 'Goal' : 'Lost'} · ${reached}`, 'span'));
    else if (!n.main) b.append(div('jm-card-reached', `${reached} reached`, 'span'));
    const tip = [s.pain ? 'Pain: ' + s.pain : '', s.opportunity ? 'Opportunity: ' + s.opportunity : ''].filter(Boolean).join('\n');
    if (tip) b.title = tip;
    return b;
   };
   // Touchpoints: one card per step on the main route, in its phase column and flow order.
   let r = addRow('Touchpoints', 'jm-lane-touch');
   for (const g of m.groups) for (const n of g.main) cell(r, n.slot, 1, 'jm-slot').append(card(n));
   for (const g of m.groups) if (!g.main.length) cell(r, g.start, g.span, 'jm-empty');
   if (m.nodes.some(n => !n.main)) {
    r = addRow('Branches', 'jm-lane-branch');
    for (const g of m.groups) {
     const c = cell(r, g.start, g.span, 'jm-branches');
     for (const n of g.branches) c.append(card(n));
    }
   }
   r = addRow('Channel');
   for (const g of m.groups) for (const n of g.main) {
    const ch = n.step.channel ? root.LWProcessRooms.channels[n.step.channel] : undefined, c = cell(r, n.slot, 1, 'jm-slot jm-channel');
    if (ch) c.append(glyph(ch.glyph, 16), div('', ch.label, 'span'));
    else c.append(div('jm-none', '–', 'span'));
    if (!ch) c.setAttribute('aria-label', 'No channel');
   }
   feeling(d, m, field, metrics);
   r = addRow('Pain points');
   for (const g of m.groups) for (const n of g.main) cell(r, n.slot, 1, 'jm-slot jm-pain').append(div('jm-note', n.step.pain ?? '', 'span'));
   r = addRow('Opportunities');
   for (const g of m.groups) for (const n of g.main) cell(r, n.slot, 1, 'jm-slot jm-opp').append(div('jm-note', n.step.opportunity ?? '', 'span'));
   funnel(d, q, m, metrics, start);
   /**
    * Feeling: authored expectation (solid) and, when a tracked field exists, the measured mean on entry (dashed) on the same -3..3
    * axis.
    */
   function feeling(d: LWProcess.Definition, m: LWProcessJourney.Layout, field: string | undefined,
    metrics: Map<string, LWProcess.StepMetric>): void {
    const r = addRow('Feeling', 'jm-lane-feel'), lane = r.firstElementChild as HTMLElement, feel = cell(r, 0, m.slots, 'jm-feel');
    const mid = FEEL_H / 2, unit = (FEEL_H / 2 - FACE_R - 10) / 3, W = m.slots * slotW;
    const chart = svg('svg', {width: W, height: FEEL_H, viewBox: `0 0 ${W} ${FEEL_H}`, role: 'img', 'aria-label': 'Feeling curve by step', class: 'jm-chart'});
    feel.append(chart);
    for (const v of [3, 0, -3]) {
     chart.append(svg('line', {x1: 0, x2: W, y1: mid - v * unit, y2: mid - v * unit, class: v ? 'jm-grid-line' : 'jm-zero'}));
     chart.append(svg('text', {x: 6, y: mid - v * unit - 4, class: 'jm-axis'}, signed(v, '−')));
    }
    const centre = (n: LWProcessJourney.Node) => (n.slot + .5) * slotW;
    const authored = m.groups.flatMap(g => g.main).filter(n => n.step.emotion !== undefined)
     .map(n => ({x: centre(n), y: mid - n.step.emotion! * unit, n}));
    if (authored.length > 1) {
     const path = smooth(authored);
     const area = `${path} L${authored.at(-1)!.x} ${mid} L${authored[0]!.x} ${mid} Z`;
     chart.append(svg('path', {d: area, class: 'jm-area'}), svg('path', {d: path, class: 'jm-line'}));
    }
    const legend = div('jm-legend');
    legend.append(div('jm-key authored', 'Authored feeling', 'span'));
    const measured = field ? m.groups.flatMap(g => g.main).map(n => ({n, e: metrics.get(n.step.id)?.tracked[field]}))
     .filter(x => x.e && x.e.n > 0 && x.e.mean !== null).map(x => ({x: centre(x.n), v: x.e!.mean!})) : [];
    if (measured.length) {
     const top = Math.max(...measured.map(p => Math.abs(p.v)));
     const points = measured.map(p => ({x: p.x, y: mid - (top > 0 ? p.v / top * 3 : 0) * unit, v: p.v}));
     if (points.length > 1) chart.append(svg('path', {d: smooth(points), class: 'jm-line measured'}));
     for (const p of points) chart.append(svg('circle', {cx: p.x, cy: p.y, r: 4, class: 'jm-dot measured'}, undefined));
     const name = d.track?.find(t => t.field === field)?.label ?? field!;
     legend.append(div('jm-key measured', `Measured ${name} (mean on entry, ±${+top.toFixed(2)} = ±3)`, 'span'));
    }
    for (const p of authored) {
     const f = face(p.n.step.emotion!, p.x, p.y, FACE_R);
     f.append(svg('title', {}, `${p.n.step.name}: feeling ${signed(p.n.step.emotion!, '−')}`));
     chart.append(f);
    }
    lane.append(legend);
   }
   /**
    * Funnel: distinct cases that reached each main-route step, relative to the first step. Drop-off is only the cases lost since the
    * previous step; a split that rejoins later and the cases still in progress are said apart, so neither reads as a loss.
    */
   function funnel(d: LWProcess.Definition, q: LWProcess.Snapshot, m: LWProcessJourney.Layout, metrics: Map<string, LWProcess.StepMetric>,
    start: number): void {
    const r = addRow('Funnel', 'jm-lane-funnel'), routeOrder = m.nodes.filter(n => n.main).sort((a, b) => a.depth - b.depth);
    const facts = root.LWProcessJourneyModel.funnelFacts(d, q, routeOrder.map(n => n.step));
    for (const n of routeOrder) {
     const reached = metrics.get(n.step.id)?.reached ?? 0, before = routeOrder[routeOrder.indexOf(n) - 1];
     const prev = before ? metrics.get(before.step.id)?.reached ?? 0 : 0;
     const f = facts.get(n.step.id)!, drop = before && prev > 0 ? Math.round(f.lost * 100 / prev) : 0;
     const lossText = f.lost > 0 ? `−${drop}% lost (${f.lost})` : 'no drop-off';
     const c = cell(r, n.slot, 1, 'jm-slot jm-funnel'), track = div('jm-track'), fill = div('jm-fill', undefined, 'i');
     fill.style.height = Math.round(start > 0 ? Math.max(reached > 0 ? 3 : 0, reached / start * 64) : 0) + 'px';
     track.append(fill);
     c.append(track, div('jm-count', String(reached), 'b'), div('jm-pct', `${pct(reached, start)}% of start`, 'span'));
     c.append(div('jm-drop' + (f.lost > 0 ? ' loss' : ''), before ? lossText : 'entry point', 'em'));
     if (f.rejoin) c.append(div('jm-drop jm-split', `split, rejoins at ${f.rejoin}`, 'em'));
     if (f.wip) c.append(div('jm-drop jm-wip', `${f.wip} in progress`, 'em'));
     if (f.work.length) c.append(div('jm-drop jm-work', f.work.join(' · '), 'em'));
     const loss = before ? ', ' + (f.lost > 0 ? `${drop}% drop-off, ${f.lost} lost` : 'no drop-off') : '';
     const work = f.work.length ? ` (${f.work.join(', ')})` : '';
     const extra = [f.rejoin ? `split after the previous step, rejoins at ${f.rejoin}` : '', f.wip ? `${f.wip} still in progress before it${work}` : '']
      .filter(Boolean);
     c.setAttribute('aria-label', `${n.step.name}: ${reached} reached, ${pct(reached, start)}% of start${loss}${extra.map(x => ', ' + x).join('')}`);
    }
   }
  }
  /** Roving tab stop: the selected card (else the first) is the single Tab target of the map. */
  function rove(): void {
   const cards = [...grid.querySelectorAll<HTMLElement>('.jm-card')], at = cards.find(c => c.classList.contains('selected')) ?? cards[0];
   for (const c of cards) c.tabIndex = c === at ? 0 : -1;
  }
  const click = (e: Event) => {
   const b = (e.target as HTMLElement).closest<HTMLElement>('.jm-card');
   if (b) onSelect(b.dataset.step!);
  };
  /** The card an arrow, Home or End key moves to (the same phase's branch or main-route card for Down and Up); undefined otherwise. */
  function targetOf(key: string, order: LWProcessJourney.Node[], index: number, here: LWProcessJourney.Node): LWProcessJourney.Node | undefined {
   if (key === 'ArrowRight') return order[Math.min(order.length - 1, index + 1)];
   if (key === 'ArrowLeft') return order[Math.max(0, index - 1)];
   if (key === 'Home') return order[0];
   if (key === 'End') return order.at(-1);
   if (key === 'ArrowDown') return here.main ? order.find(n => !n.main && n.phase === here.phase) : undefined;
   return here.main ? undefined : order.filter(n => n.main && n.phase === here.phase).at(-1);
  }
  const MOVES = new Set(['ArrowRight', 'ArrowLeft', 'Home', 'End', 'ArrowDown', 'ArrowUp']);
  const key = (e: KeyboardEvent) => {
   const b = (e.target as HTMLElement).closest<HTMLElement>('.jm-card');
   if (!b || e.ctrlKey || e.metaKey || e.altKey) return;
   const order = map!.groups.flatMap(g => [...g.main, ...g.branches]), index = order.findIndex(n => n.step.id === b.dataset.step);
   const here = order[index];
   if (!here) return;
   if (e.key === 'Escape') {
    onSelect(null);
    return;
   }
   if (!MOVES.has(e.key)) return;
   const target = targetOf(e.key, order, index, here);
   e.preventDefault();
   if (target) {
    const el = grid.querySelector<HTMLElement>(`[data-step="${CSS.escape(target.step.id)}"]`);
    el?.focus();
    reveal(el);
   }
  };
  const focusin = (e: FocusEvent) => {
   const t = (e.target as HTMLElement).closest<HTMLElement>('.jm-card');
   if (t) for (const c of grid.querySelectorAll<HTMLElement>('.jm-card')) c.tabIndex = c === t ? 0 : -1;
  };
  grid.addEventListener('click', click);
  grid.addEventListener('keydown', key);
  grid.addEventListener('focusin', focusin);
  const refit = () => {
   const avail = scroller.clientWidth - laneW, slots = map?.slots ?? 1;
   const want = fitted ? Math.max(SLOT_MIN, Math.min(SLOT_MAX, Math.floor(avail / slots))) : SLOT_DEFAULT;
   if (want !== slotW) {
    slotW = want;
    lastSignature = '';
    if (lastView) draw(lastView);
   }
   fitButton.setAttribute('aria-pressed', String(fitted));
   scroller.scrollLeft = 0;
  };
  fitButton.addEventListener('click', () => {
   fitted = !fitted;
   refit();
  });
  const resized = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
   const narrow = region.clientWidth > 0 && region.clientWidth < 600;
   if (narrow !== (laneW === LANE_NARROW) && lastView) {
    lastSignature = '';
    draw(lastView);
   }
   if (fitted) refit();
  }) : null;
  resized?.observe(scroller);
  return {
   draw,
   frame() {
    fitted = true;
    refit();
   },
   dispose() {
    resized?.disconnect();
    grid.removeEventListener('click', click);
    grid.removeEventListener('keydown', key);
    grid.removeEventListener('focusin', focusin);
    region.remove();
   },
  };
 }
 root.LWProcessJourney = {create};
})(globalThis);
