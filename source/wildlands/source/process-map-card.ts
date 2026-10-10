/// <reference path="./process-contracts.d.ts" />
/**
 * One step card of the 2D process map (LWProcessMapCard): its size for a layout, and its SVG group with title, state border,
 * work markers or counts, pills and badges. Presentation only: the card reads a detached view; the map delegates its events.
 *  - The border shows the card's work state only (Blocked, Working, Waiting, Timer, Backlog or idle), with the legend's colours
 *    (`data-status` on the group, styled by process.css). The room theme colours only the glyph and the progress bar.
 *  - Zoomed out ('names'), the title keeps its screen size and a row under it shows one marker and count per work state, so queues
 *    and blocked work read at the default framing. Zoomed in ('full') and in a step scene, each work item has its own marker. Markers
 *    never sit on the title and are at least `px.mark` on screen.
 *  - Held work (finished here, waiting for room in the next backlog) counts as **blocked**, never as waiting: the waiting count is
 *    `queued - held` in the counts row, the caption and the accessible name ("3 waiting, 2 blocked"). The snapshot is unchanged.
 *    Counts, the border state, each marker's state and the progress bar's share all come from LWProcessWorkState, the studio's
 *    one work-state derivation; other colours are palette roles (LWProcessPalette).
 *  - An end step's outcome badge (goal or lost) keeps a glyph of at least the cue size. Zoomed in it sits above the card's top-right
 *    corner with its count; zoomed out it sits inside the card, at the right end of the work row ('names') or right of the list
 *    number ('numbers', whose card is widened for it), so it never covers a title, a number or a neighbouring card.
 *  - The group carries `tabindex` 0 only for the map's roving tab stop (`tab`), else -1.
 */
declare namespace LWProcessMapCard {
 type Mode = 'full' | 'names' | 'numbers';
 /** Screen-size floors in CSS pixels, scaled with the root font size. */
 interface Px {
  title: number; text: number; cue: number; line: number; mark: number; count: number; pad: number; chrome: number; char: number;
  badgeW: number; badgeH: number;
 }
 interface Layout {
  mode: Mode; secondary: boolean; font: number; single: boolean; lines: number; per: number; width: number; ppu: number; key: string;
  px: Px;
 }
 interface Size {lines: string[]; w: number; h: number}
 interface Card {
  step: LWProcess.Step; metric: LWProcess.StepMetric; work: LWProcess.Token[]; x: number; y: number; size: Size; current: boolean;
  /** Whether this card is the map's roving tab stop. */
  tab: boolean;
 }
 interface Api {
  size(step: LWProcess.Step, L: Layout, order: string): Size;
  draw(card: Card, L: Layout): SVGGElement;
  /** On-screen width of a zoomed-out outcome badge, in CSS pixels. */
  badgePx(px: Px): number;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {
  LWProcessMapCard?: LWProcessMapCard.Api; LWProcessRooms: LWProcessRooms.Api; LWProcessMapMarks: LWProcessMapMarks.Api;
  LWProcessWorkState: LWProcessWorkState.Api; LWProcessPalette: LWProcessPalette.Api;
 };
 const M = root.LWProcessMapMarks, {el, small, glyph, pill, mark, TONE} = M, W = root.LWProcessWorkState;
 type Counts = LWProcessWorkState.Counts;
 const AUTOMATED = new Set(['machine', 'system']), WORK = new Set(['task', 'touchpoint', 'machine', 'system']);
 /** Order of the per-state counts under a zoomed-out title: what needs attention first. */
 const URGENCY: LWProcessMapMarks.Status[] = ['held', 'queued', 'active', 'timer', 'backlog'];
 /** World size of the glyph-only outcome badge before scaling: 1.3 wide, 0.9 tall. */
 const BADGE_W = 1.3, BADGE_H = .9;
 const inclusive = (s: LWProcess.Step) => s.kind === 'fork' && s.mode === 'inclusive';
 const outcomeOf = (s: LWProcess.Step) => s.kind === 'end' ? s.outcome : undefined;
 const badgePx = (px: LWProcessMapCard.Px) => BADGE_W / BADGE_H * px.cue;
 function size(step: LWProcess.Step, L: LWProcessMapCard.Layout, order: string): LWProcessMapCard.Size {
  const px = L.px;
  if (L.single) return {lines: M.wrap(step.name, 26, 2), w: 10, h: 7};
  if (L.mode === 'numbers') {
   const badge = outcomeOf(step) ? badgePx(px) + px.pad / 2 : 0;
   return {lines: [order], w: Math.max(L.width, (order.length * px.char + px.pad * 2 + badge) / L.ppu), h: px.badgeH / L.ppu};
  }
  if (L.mode === 'full') {
   const w = step.kind === 'touchpoint' ? 9.4 : 8, lines = M.wrap(step.name, Math.floor((w - .6) / (L.font * .56)), 2);
   return {lines, w, h: 4.8 + (lines.length - 1) * .8};
  }
  const lines = M.wrap(step.name, L.per, L.lines), text = (Math.max(...lines.map(l => l.length)) * px.char + px.pad * 2) / L.ppu;
  return {lines, w: Math.min(L.width, Math.max(Math.min(8, L.width), text)), h: (L.lines * px.line + px.chrome) / L.ppu};
 }
 /** Waiting work at a step: everything queued there except held (blocked) work. */
 const waitingOf = (metric: LWProcess.StepMetric) => W.step(metric).waiting;
 /** The accessible name, and the visible caption (full name, kind and counts) the map shows while the card is hovered or focused. */
 function speech(card: LWProcessMapCard.Card, n: Counts): {label: string; caption: string} {
  const {step, metric} = card, tp = step.kind === 'touchpoint', timers = metric.timers;
  const {waiting, blocked: held} = W.step(metric);
  const channel = step.channel ? root.LWProcessRooms.channels[step.channel]?.label : undefined;
  const tag = AUTOMATED.has(step.kind) ? ` (${step.kind}${step.technology ? ', ' + step.technology : ''})`
   : tp ? ` (touchpoint${channel ? ', ' + channel : ''})` : step.kind === 'end' && step.outcome ? ` (end, ${step.outcome})` : '';
  const backlog = n.backlog ? ` (${n.backlog} in backlog)` : '';
  const parts = [
   step.name + tag, step.phase ? 'phase ' + step.phase : '', tp ? metric.active + ' in this touchpoint' : metric.active + ' active',
   (tp ? waiting + ' waiting for a team' : waiting + ' waiting') + backlog, held ? held + ' blocked' : '',
   timers.waiting ? `${timers.waiting} on timer, next due minute ${timers.nextDue}` : '',
   AUTOMATED.has(step.kind) || tp ? metric.completed + ' completed' : '',
   step.kind === 'end' && step.outcome ? metric.reached + ' reached' : '', inclusive(step) ? 'inclusive fork' : '',
  ];
  const items = metric.items ? `, ${metric.items.started} items started, ${metric.items.finished} finished` : '';
  const fired = metric.deadlines ? `, ${metric.deadlines.escalated} escalated, ${metric.deadlines.interrupted} interrupted` : '';
  if (step.instances) parts.push(`${step.instances.count ?? 'case-driven number of'} instances ${step.instances.mode}` + items);
  if (step.deadline) parts.push(`${step.deadline.mode} deadline` + fired);
  const shown = [`${metric.active} ${tp ? 'here' : 'working'}`, `${waiting} waiting`, held ? `${held} blocked` : '',
   n.backlog ? `${n.backlog} in backlog` : '', timers.waiting ? `${timers.waiting} on timer` : ''];
  return {label: parts.filter(Boolean).join(', '), caption: [step.name, step.kind, ...shown].filter(Boolean).join(' · ')};
 }
 function draw(card: LWProcessMapCard.Card, L: LWProcessMapCard.Layout): SVGGElement {
  const {step, metric, work, x, y} = card, {lines, w, h} = card.size, px = L.px, top = y - h / 2, bottom = y + h / 2, left = x - w / 2;
  const th = root.LWProcessRooms.theme(step), n = W.counts(work), working = metric.active > 0, {label, caption} = speech(card, n);
  // Non-text cues keep at least the cue size on screen.
  const cue = (world: number) => Math.max(1, px.cue / (world * L.ppu));
  const group = el('g', {
   id: 'process-map-' + step.id, role: 'button', tabindex: card.tab ? 0 : -1, 'data-status': W.border(n), 'aria-label': label,
   'data-caption': caption,
  });
  if (card.current) group.setAttribute('aria-current', 'true');
  group.append(el('path', {class: 'pm-focus-ring', d: `M${left} ${top} h${w} v${h} h${-w} Z`, 'aria-hidden': 'true'}));
  group.append(el('rect', {class: 'pm-card', x: left, y: top, width: w, height: h, rx: .3}));
  if (card.current) {
   group.append(el('rect', {class: 'pm-current', x: left - .4, y: top - .4, width: w + .8, height: h + .8, rx: .5, 'aria-hidden': 'true'}));
  }
  title(group, card, L);
  const progress = W.progress(step, work);
  group.append(el('rect', {class: 'pm-track', x: left + .3, y: bottom - .35, width: w - .6, height: .08}));
  group.append(el('rect', {x: left + .3, y: bottom - .35, width: (w - .6) * progress, height: .08, style: `fill:${th.accent}`}));
  const tone = working ? th.accent : root.LWProcessPalette.css('axis');
  const extra = L.single ? .75 * (lines.length - 1) : L.mode === 'full' ? .8 * (lines.length - 1) : 0;
  if (L.mode === 'full' || L.single) group.append(glyph(th.id, left + .9, bottom - 1, L.single ? 1.3 : .85, tone, progress));
  texts(group, card, L, th, extra);
  const goal = outcomeOf(step);
  if (goal) group.append(badgeFor(card, goal, L));
  if (inclusive(step)) {
   const gate = el('g', {class: 'pm-gateway pm-gateway-inclusive', transform: `translate(${left} ${top}) scale(${cue(1.5)})`, 'aria-hidden': 'true'});
   gate.append(el('path', {d: 'M0 -.75 L.75 0 L0 .75 L-.75 0 Z'}), el('circle', {cx: 0, cy: 0, r: .3}));
   gate.append(el('title', {}, 'Inclusive fork: every branch whose condition is true starts'));
   group.append(gate);
  }
  pills(group, card, L, th.accent, cue(.9));
  if (L.single) scene(group, card);
  if (L.mode === 'names') row(group, card, n, th.id, tone, progress, L);
  else if (L.mode !== 'numbers') markers(group, card, L, extra);
  if (step.backlog && L.mode === 'full') backlog(group, card, L.secondary);
  return group;
 }
 /** Title lines: zoomed out they keep the title size with the work row below; numbered cards leave room for an outcome badge. */
 function title(group: SVGGElement, card: LWProcessMapCard.Card, L: LWProcessMapCard.Layout): void {
  const {step, x, y} = card, {lines, w, h} = card.size, px = L.px, top = y - h / 2;
  const line = L.mode === 'full' ? L.font * 1.2 : px.line / L.ppu;
  const first = L.mode === 'numbers' ? y + L.font * .35 : L.mode === 'names' ? top + (px.pad + px.title) / L.ppu : top + .85;
  // A numbered end card puts its number in the part left of the badge.
  const badge = L.mode === 'numbers' && outcomeOf(step) ? (badgePx(px) + px.pad * 1.5) / L.ppu : 0;
  const at = x - badge / 2;
  const weight = L.mode === 'numbers' ? {'font-weight': 650} : {};
  const text = el('text', {class: 'pm-title', x: at, y: first, 'font-size': L.font, 'text-anchor': 'middle', ...weight});
  lines.forEach((t, i) => text.append(el('tspan', {x: at, dy: i ? line : 0}, t)));
  group.append(text, el('title', {}, step.name + (step.technology ? ' · ' + step.technology : '')));
 }
 /** Secondary lines (status, kind and duration, technology or channel) and the phase tag of a step scene. */
 function texts(group: SVGGElement, card: LWProcessMapCard.Card, L: LWProcessMapCard.Layout, th: LWProcessRooms.Theme, extra: number): void {
  const {step, metric, x, y} = card, {w, h} = card.size, top = y - h / 2, left = x - w / 2, tp = step.kind === 'touchpoint';
  const automated = AUTOMATED.has(step.kind), working = metric.active > 0, timing = metric.timers.waiting > 0;
  const waiting = !working && (waitingOf(metric) > 0 || timing), blocked = !working && !waiting && metric.held > 0;
  const idle = blocked ? 'Blocked: the next backlog is full' : tp ? 'Idle' : 'Idle · standby';
  const status = tp ? (working ? 'In this touchpoint' : timing ? 'Waiting on timer' : waiting ? 'Waiting for a team' : idle)
   : working ? th.task : timing ? 'Waiting on timer' : waiting ? (automated ? 'Waiting for capacity' : 'Waiting to start') : idle;
  const at = {x: left + (L.single ? 1.8 : 1.5), y: y + h / 2 - .85, 'font-size': .46};
  group.append(small(el('text', {class: working ? 'pm-text' : 'pm-muted', ...at}, status), L.secondary), el('title', {}, th.label));
  const span = step.kind === 'timer' && step.until !== undefined ? 'until minute ' + step.until : (step.duration ?? 0) + ' min';
  const mid = {x, 'text-anchor': 'middle'};
  const facts = `${step.kind} · ${span} · ${metric.completed} completed`;
  group.append(small(el('text', {class: 'pm-muted', ...mid, y: top + 1.55 + extra, 'font-size': .46}, facts), L.secondary));
  const channel = step.channel ? root.LWProcessRooms.channels[step.channel]?.label : undefined;
  const subtitle = automated ? step.technology : tp ? channel : undefined;
  const sub = {...mid, y: top + (L.single ? 2.25 : 2.35) + extra, 'font-size': .44};
  if (subtitle) group.append(small(el('text', {...sub, style: `fill:${th.accent}`}, M.trunc(subtitle, 28)), L.secondary));
  if (L.single && step.phase) {
   const text = 'Phase · ' + M.trunc(step.phase, 26), tw = Math.min(w, text.length * .3 + 1);
   const tag = {class: 'pm-phase-tag', x: left, y: top - 1.15, width: tw, height: .9, rx: .45, 'stroke-width': .06, style: `stroke:${th.accent}`};
   group.append(el('rect', tag));
   group.append(el('text', {class: 'pm-phase-text', x: left + .45, y: top - .52, 'font-size': .5}, text));
  }
 }
 /** Where an end card's outcome badge goes (see the header): above the corner zoomed in, inside the card zoomed out. */
 function badgeFor(card: LWProcessMapCard.Card, kind: 'goal' | 'lost', L: LWProcessMapCard.Layout): SVGGElement {
  const {x, y, size: {w, h}} = card, px = L.px, right = x + w / 2, top = y - h / 2;
  if (L.mode === 'full' || L.single) {
   const k = Math.max(1, px.cue / (BADGE_H * L.ppu));
   return outcome(kind, card.metric.reached, right, top - 1.15 * k, k, L.secondary);
  }
  // Zoomed out: from the top of the work row (half a padding under the title lines), or centred beside the list number.
  const k = px.cue / (BADGE_H * L.ppu), inset = right - px.pad / L.ppu;
  const at = L.mode === 'names' ? top + (px.pad + L.lines * px.line + px.pad / 2) / L.ppu : y - BADGE_H / 2 * k;
  return outcome(kind, card.metric.reached, inset, at, k, false);
 }
 /** Outcome badge with its top-right corner at `right`,`top`: tick or cross always, the count only where secondary text is readable. */
 function outcome(kind: 'goal' | 'lost', reached: number, right: number, top: number, k: number, secondary: boolean): SVGGElement {
  const goal = kind === 'goal', text = (goal ? 'Goal' : 'Lost') + ' · ' + reached, bw = secondary ? text.length * .3 + 1.5 : BADGE_W;
  const badge = el('g', {class: 'pm-outcome-badge', 'data-outcome': kind, transform: `translate(${right} ${top}) scale(${k})`});
  const tick = goal ? 'M-.22 0 L-.05 .17 L.25 -.2' : 'M-.2 -.2 L.2 .2 M.2 -.2 L-.2 .2';
  badge.append(
   el('rect', {class: 'pm-outcome pm-outcome-' + kind, x: -bw, y: 0, width: bw, height: BADGE_H, rx: .45, 'stroke-width': .08}),
   el('path', {class: 'pm-outcome-mark', d: tick, transform: `translate(${-bw + .65} .45)`, 'aria-hidden': 'true'}),
   small(el('text', {class: 'pm-pill-text', x: -bw + 1.2, y: .64, 'font-size': .5}, text), secondary),
  );
  return badge;
 }
 /** Pills above the card: multiple instances (× N and item progress) and the deadline clock with its firing counters. */
 function pills(group: SVGGElement, card: LWProcessMapCard.Card, L: LWProcessMapCard.Layout, accent: string, k: number): void {
  const {step, metric, work, x, y} = card, right = x + card.size.w / 2, full = L.secondary || L.single;
  let row = L.single && step.phase ? 1 : 0;
  const top = () => y - card.size.h / 2 - (1.15 + row++ * 1.05) * k;
  if (step.instances) {
   // A count driven by a case field reads "× per case (field)" until items are live, then "× N".
   const live = work.find(t => t.items !== undefined)?.items, count = step.instances.count ?? live;
   const label = count !== undefined ? `× ${count}` : `× per case (${step.instances.field})`;
   const done = metric.items ? ` · ${metric.items.started} started · ${metric.items.finished} done` : '';
   const about = step.instances.count !== undefined ? `${step.instances.count} instances per case`
    : `One instance per item; the case field ${step.instances.field} sets how many` + (live !== undefined ? ` (${live} now)` : '');
   const tip = `${about}, ${step.instances.mode}${done}`;
   pill(group, {cls: 'pm-instances', right, top: top(), k, text: label + (full ? done : ''), tip, tone: accent, full, clock: false});
  }
  if (step.deadline) {
   const dl = metric.deadlines ?? {interrupted: 0, escalated: 0}, mode = step.deadline.mode;
   const text = `${dl.escalated} escalated · ${dl.interrupted} interrupted`;
   const tip = `Deadline ${step.deadline.after !== undefined ? 'after ' + step.deadline.after + ' min' : 'at a random time'}, ${mode}s: ${text}`;
   pill(group, {cls: 'pm-deadline-badge pm-deadline-' + mode, right, top: top(), k, text, tip, tone: TONE[mode], full, clock: true});
  }
 }
 /** Step scene extras: the counts line, the next deadline and the overall progress of the work here. */
 function scene(group: SVGGElement, card: LWProcessMapCard.Card): void {
  const {step, metric, work, x, y} = card, tp = step.kind === 'touchpoint', mid = {x, 'text-anchor': 'middle'};
  const pending = work.filter(t => t.deadlineAt !== undefined).map(t => t.deadlineAt!), n = W.step(metric);
  const timers = n.timers ? ` · ${n.timers} on timer, next due ${metric.timers.nextDue}` : '';
  const text = `${n.working} ${tp ? 'here' : 'working'} · ${n.waiting} waiting` + (n.blocked ? ` · ${n.blocked} blocked` : '') + timers;
  group.append(el('text', {class: 'pm-counts', ...mid, y: y - .65, 'font-size': .48}, text));
  if (pending.length) {
   const style = `fill:${TONE[step.deadline?.mode ?? 'interrupt']}`;
   group.append(el('text', {class: 'pm-deadline-due', ...mid, y: y + 1.6, 'font-size': .44, style}, `deadline at minute ${Math.min(...pending)}`));
  }
  if (!work.some(t => t.status === 'active')) return;
  const progress = W.progress(step, work);
  group.append(el('rect', {class: 'pm-track', x: x - 4, y: y - .35, width: 8, height: .07}));
  group.append(el('rect', {class: 'pm-progress', x: x - 4, y: y - .35, width: 8 * progress, height: .07}));
 }
 /** One marker per work item (escalated first) in a band of its own under the title lines; '+n' when more are here than fit. */
 function markers(group: SVGGElement, card: LWProcessMapCard.Card, L: LWProcessMapCard.Layout, extra: number): void {
  const {work, x, y} = card, {w, h} = card.size, size = Math.max(.4, L.px.mark / L.ppu), gap = size * 1.5;
  const perRow = L.single ? 10 : Math.max(1, Math.floor((w - 1) / gap)), cap = L.single ? 40 : Math.min(8, perRow);
  const top = L.single ? y + .65 : y - h / 2 + 2.95 + extra, start = L.single ? x - 4 : x - w / 2 + .5 + size / 2;
  const sorted = [...work].sort((a, b) => Number(!!b.escalated) - Number(!!a.escalated));
  for (const [i, t] of sorted.slice(0, cap).entries()) {
   const attrs = {class: 'pm-token' + (t.escalated ? ' pm-token-escalated' : ''), 'data-token': t.id, ...t.item !== undefined ? {'data-item': t.item} : {}};
   const cx = start + (i % perRow) * (L.single ? .8 : gap), cy = top + Math.floor(i / perRow) * (L.single ? .6 : gap);
   group.append(mark(W.statusOf(t), cx, cy, t.escalated ? size * 1.3 : size, t.escalated ? {...attrs, 'data-escalated': 'true'} : attrs));
  }
  if (work.length <= cap) return;
  const more = {x: L.single ? x + 3.1 : x + w / 2 - .5, y: L.single ? y + 1.4 : top + size / 2, 'font-size': .5, 'text-anchor': L.single ? 'start' : 'end'};
  group.append(small(el('text', {class: 'pm-text', ...more}, '+' + (work.length - cap)), L.secondary));
 }
 /**
  * Zoomed-out work row under the title: the room glyph, then one marker and count per work state (most urgent first) while they fit;
  * an end card keeps the row's right end for its outcome badge.
  */
 function row(group: SVGGElement, card: LWProcessMapCard.Card, n: Counts, room: string, tone: string, progress: number,
  L: LWProcessMapCard.Layout): void {
  const px = L.px, u = 1 / L.ppu, {x, y} = card, {w, h} = card.size;
  const cy = y - h / 2 + (px.pad + L.lines * px.line + px.pad / 2 + px.mark / 2) * u;
  const escalated = new Set(card.work.filter(t => t.escalated).map(W.statusOf));
  const end = x + w / 2 - (px.pad / 2 + (outcomeOf(card.step) ? badgePx(px) + px.pad : 0)) * u;
  let at = x - w / 2 + px.pad * u;
  group.append(glyph(room, at + px.mark / 2 * u, cy, (px.mark + 2) * u, tone, progress));
  at += (px.mark + 4) * u;
  for (const status of URGENCY) {
   if (!n[status]) continue;
   const text = String(n[status]), width = (px.mark + 2 + text.length * px.count * .62) * u;
   if (at + width > end) break;
   const chip = el('g', {class: 'pm-count', 'data-status': status});
   chip.append(mark(status, at + px.mark / 2 * u, cy, px.mark * u, escalated.has(status) ? {class: 'pm-token-escalated'} : {}));
   chip.append(el('text', {class: 'pm-count-text', x: at + (px.mark + 2) * u, y: cy + px.count * .36 * u, 'font-size': px.count * u}, text));
   group.append(chip);
   at += width + 4 * u;
  }
 }
 /** Backlog slots and their count at the card's bottom-right corner. */
 function backlog(group: SVGGElement, card: LWProcessMapCard.Card, secondary: boolean): void {
  const {step, work, x, y} = card, {w, h} = card.size, capacity = step.backlog!.capacity, right = x + w / 2 - .5, slots = Math.min(capacity, 8);
  const stored = work.filter(t => t.status === 'backlog' || WORK.has(step.kind) && t.status === 'queued').length;
  const filled = stored ? Math.max(1, Math.round(stored / capacity * slots)) : 0;
  for (let i = 0; i < slots; i++) {
   const slot = {x: right - (slots - i) * .38, y: y + h / 2 - 1.15, width: .3, height: .3, 'stroke-width': .05};
   group.append(el('rect', {class: 'pm-slot' + (i < filled ? ' pm-slot-full' : ''), ...slot}));
  }
  const at = {x: right, y: y + h / 2 - 1.3, 'font-size': .4, 'text-anchor': 'end'};
  group.append(small(el('text', {class: 'pm-slot-text', ...at}, `Backlog ${stored}/${capacity}`), secondary));
 }
 root.LWProcessMapCard = {size, draw, badgePx};
})(globalThis);
