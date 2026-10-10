/// <reference path="./process-contracts.d.ts" />
/**
 * Drawing vocabulary of the 2D process map (LWProcessMapMarks): the SVG element helper, room glyphs, pills, the work-state markers
 * and the label wrapping rule. Presentation only; nothing here reads or changes a session.
 *  - Colours are process.css tokens. State colours come from `data-status` rules shared by map markers, card borders and the
 *    legend samples (`legend()`), so the key and the picture cannot drift apart; other colours are `var(--token)` styles. Only the
 *    room theme accent (data of LWProcessRooms) is passed in as a value.
 *  - Each work state has its own marker shape as well as its colour: Working disc, Waiting ring, Timer hourglass, Backlog square,
 *    Blocked cross.
 */
declare namespace LWProcessMapMarks {
 type Status = 'active' | 'queued' | 'timer' | 'backlog' | 'held';
 type Attrs = Record<string, string | number>;
 /** A pill above a card: its top-right corner at `right`,`top`, enlarged by `k`; `tone` is a CSS colour (a token or the room accent). */
 interface Pill {cls: string; right: number; top: number; k: number; text: string; tip: string; tone: string; full: boolean; clock: boolean}
 interface Api {
  el<K extends keyof SVGElementTagNameMap>(name: K, attrs?: Attrs, text?: string): SVGElementTagNameMap[K];
  /** Secondary text stays in the document (text content, tooltips) but is not painted while it would be too small to read. */
  small<T extends SVGElement>(node: T, visible: boolean): T;
  glyph(id: string, x: number, y: number, size: number, color: string, progress: number): SVGGElement;
  pill(parent: SVGElement, p: Pill): void;
  /** A work-state marker centred at x,y and `size` world units wide. */
  mark(status: Status, x: number, y: number, size: number, attrs?: Attrs): SVGPathElement;
  statusOf(token: LWProcess.Token): Status;
  /** Work states in legend order with their legend labels. */
  readonly STATES: readonly {status: Status; label: string}[];
  /** Legend entries (HTML): one marker sample per work state, then the conditional and deadline path samples. */
  legend(): string;
  /** Lines of at most `per` characters (see the implementation for the rule). */
  wrap(text: string, per: number, lines: number): string[];
  /** Whether `text` fits `lines` lines of `per` characters without an ellipsis. */
  fits(text: string, per: number, lines: number): boolean;
  /**
   * The length of the longest word that `wrap(text, per, lines)` shows broken by an added hyphen (0 when every shown word is whole
   * or breaks only at a hyphen of its own). The map's label rules use it to refuse layouts that would cut short words.
   */
  cutOf(text: string, per: number, lines: number): number;
  trunc(text: string, max: number): string;
  /** Deadline path tones: red when the work is interrupted, amber when it escalates beside the work. */
  readonly TONE: {interrupt: string; escalate: string};
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessMapMarks?: LWProcessMapMarks.Api; LWProcessRooms: LWProcessRooms.Api};
 const NS = 'http://www.w3.org/2000/svg';
 function el<K extends keyof SVGElementTagNameMap>(name: K, attrs: LWProcessMapMarks.Attrs = {}, text?: string): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  if (text !== undefined) n.textContent = text;
  return n;
 }
 function small<T extends SVGElement>(node: T, visible: boolean): T {
  node.classList.add('pm-secondary'); if (!visible) node.setAttribute('display', 'none'); return node;
 }
 /** Small per-theme icon: bright and progress-aware while working, muted when idle. Static so refresh redraws stay cheap. */
 function glyph(id: string, x: number, y: number, size: number, color: string, progress: number): SVGGElement {
  const g = el('g', {class: 'pm-glyph', transform: `translate(${x} ${y}) scale(${size})`, style: `stroke:${color}`, 'aria-hidden': 'true'});
  const add = (...nodes: SVGElement[]) => g.append(...nodes), p = (d: string) => el('path', {d});
  const bar = (i: number) => p(`M-.3 ${-.08 + i * .18} H${-.3 + .6 * Math.min(1, Math.max(.2, progress * 1.4 - i * .25))}`);
  const rooms = root.LWProcessRooms;
  if (id === 'office') add(el('rect', {x: -.5, y: -.4, width: 1, height: .65, rx: .06}), p('M-.25 .45 H.25 M0 .25 V.45'), bar(0), bar(1));
  else if (id === 'studio') add(p('M-.45 .4 L.3 -.35 L.45 -.2 L-.3 .55 Z M-.45 .4 L-.5 .55 L-.3 .55'), p(`M-.5 .62 H${-.5 + progress}`));
  else if (id === 'lab') add(p('M-.15 -.5 V-.1 L-.45 .45 H.45 L.15 -.1 V-.5 M-.2 -.5 H.2'), el('circle', {cx: 0, cy: .2 - progress * .15, r: .07}));
  else if (id === 'workshop') {
   const rays = 'M0 -.5 V-.3 M0 .3 V.5 M-.5 0 H-.3 M.3 0 H.5 M-.35 -.35 L-.22 -.22 M.22 .22 L.35 .35 M.35 -.35 L.22 -.22 M-.22 .22 L-.35 .35';
   add(el('circle', {cx: 0, cy: 0, r: .22}), p(rays));
  } else if (id === 'review') add(el('rect', {x: -.4, y: -.5, width: .8, height: 1, rx: .06}), p('M-.2 0 L-.05 .15 L.22 -.2'));
  else if (id === 'archive') add(p('M-.5 -.35 H-.1 L.05 -.2 H.5 V.4 H-.5 Z'), p('M-.5 -.05 H.5'));
  else if (id === 'reception') add(el('rect', {x: -.5, y: -.35, width: 1, height: .7, rx: .06}), p('M-.5 -.35 L0 .05 L.5 -.35'));
  else if (id === 'dispatch') add(el('rect', {x: -.45, y: -.2, width: .6, height: .6}), p('M.25 .1 H.55 M.45 -.05 L.58 .1 L.45 .25'));
  else if (id === 'clock') add(el('circle', {cx: 0, cy: 0, r: .42}), p('M0 -.25 V0 L.2 .12'));
  else if (id === 'machine') {
   const arm = .05 + .25 * progress;
   add(p('M-.45 .5 H-.05 M-.25 .5 V.25 M-.25 .25 L-.05 -.2 L.28 -.1'), p(`M.28 -.1 V${arm} M.18 ${arm} H.38`));
   add(el('circle', {cx: -.25, cy: .25, r: .08}), el('circle', {cx: -.05, cy: -.2, r: .08}));
  } else if (id === 'system') {
   add(el('rect', {x: -.42, y: -.5, width: .84, height: .4, rx: .05}), el('rect', {x: -.42, y: .02, width: .84, height: .4, rx: .05}));
   add(el('circle', {cx: -.26, cy: -.3, r: .035}), el('circle', {cx: -.26, cy: .22, r: .035}), p(`M-.42 .62 H${-.42 + .84 * progress}`));
  } else if (id === 'council') add(el('circle', {cx: 0, cy: 0, r: .3}), p('M0 -.5 V-.38 M0 .38 V.5 M-.5 0 H-.38 M.38 0 H.5'));
  else if (rooms.channels[id]) add(p(rooms.channels[id]!.glyph));
  else if (id === 'journey') add(el('circle', {cx: 0, cy: -.22, r: .2}), p('M-.42 .5 Q-.42 .08 0 .08 Q.42 .08 .42 .5 Z'));
  else add(el('circle', {cx: 0, cy: 0, r: .12}), p('M-.5 0 H-.12 M.12 0 H.5 M0 -.5 V-.12 M0 .12 V.5'));
  return g;
 }
 /**
  * Right-aligned pill above a card, enlarged by `k` so it never shrinks below the cue size. The text is painted only when `full`;
  * otherwise the pill keeps its shape and glyph (clock or item stack) and the wording stays in the tooltip, the text node and the
  * card's accessible name.
  */
 function pill(parent: SVGElement, p: LWProcessMapMarks.Pill): void {
  const lead = p.clock ? 1.1 : 1.2, w = p.full ? lead + p.text.length * .3 + .5 : lead + .2;
  const wrap = el('g', {class: 'pm-pill'}), g = el('g', {class: p.cls, transform: `translate(${p.right} ${p.top}) scale(${p.k})`});
  g.append(el('rect', {class: 'pm-pill-box', x: -w, y: 0, width: w, height: .9, rx: .45, 'stroke-width': .08, style: `stroke:${p.tone}`}));
  const stack = `M${-w + .35} .64 h.5 M${-w + .45} .45 h.5 M${-w + .55} .26 h.5`;
  const items = () => el('path', {d: stack, style: `stroke:${p.tone}`, 'stroke-width': .1, 'stroke-linecap': 'round', 'aria-hidden': 'true'});
  g.append(p.clock ? glyph('clock', -w + .6, .45, .6, p.tone, 0) : items());
  g.append(small(el('text', {class: 'pm-pill-text', x: -w + lead, y: .64, 'font-size': .5}, p.text), p.full));
  wrap.append(el('title', {}, p.tip), g); parent.append(wrap);
 }
 /** Marker outlines in a 1 x 1 box centred on 0,0; process.css fills or strokes them per `data-status`. */
 const SHAPES: Record<LWProcessMapMarks.Status, string> = {
  active: 'M0 -.5 A.5 .5 0 1 1 0 .5 A.5 .5 0 1 1 0 -.5 Z',
  queued: 'M0 -.38 A.38 .38 0 1 1 0 .38 A.38 .38 0 1 1 0 -.38 Z',
  timer: 'M-.36 -.46 H.36 L-.36 .46 H.36 Z',
  backlog: 'M-.42 -.42 H.42 V.42 H-.42 Z',
  held: 'M-.34 -.34 L.34 .34 M.34 -.34 L-.34 .34',
 };
 const STATES = [
  {status: 'active', label: 'Working'}, {status: 'queued', label: 'Waiting'}, {status: 'timer', label: 'Timer'},
  {status: 'backlog', label: 'Backlog'}, {status: 'held', label: 'Blocked'},
 ] as const;
 function mark(status: LWProcessMapMarks.Status, x: number, y: number, size: number, attrs: LWProcessMapMarks.Attrs = {}): SVGPathElement {
  const cls = 'pm-mark' + (attrs.class ? ' ' + attrs.class : '');
  return el('path', {...attrs, class: cls, 'data-status': status, d: SHAPES[status], transform: `translate(${x} ${y}) scale(${size})`});
 }
 function statusOf(t: LWProcess.Token): LWProcessMapMarks.Status {
  return t.status === 'active' || t.status === 'timer' || t.status === 'backlog' || t.status === 'held' ? t.status : 'queued';
 }
 function legend(): string {
  const sample = (inner: string, wide: boolean) => `<svg class="pm-key" width="${wide ? 24 : 12}" height="12" `
   + `viewBox="${wide ? '0 0 24 12' : '-.6 -.6 1.2 1.2'}" aria-hidden="true" focusable="false">${inner}</svg>`;
  const path = (cls: string) => sample(`<path class="${cls}" d="M1 6 H23"/>`, true);
  const marker = (s: LWProcessMapMarks.Status) => sample(`<path class="pm-mark" data-status="${s}" d="${SHAPES[s]}"/>`, false);
  return STATES.map(s => `<span data-legend="${s.status}">${marker(s.status)}${s.label}</span>`).join('')
   + `<span data-legend="conditional">${path('pm-edge pm-edge-conditional')}Conditional path</span>`
   + `<span data-legend="deadline">${path('pm-edge pm-edge-deadline pm-edge-interrupt')}Deadline path</span>`;
 }
 const trunc = (s: string, max: number) => s.length > max ? s.slice(0, Math.max(1, max - 1)).trimEnd() + '…' : s;
 /**
  * Greedy lines of at most `per` characters. A word longer than a line breaks after a hyphen of its own when one fits (keeping at
  * least 2 characters on each side), else it is hyphen-broken keeping at least 3 characters on each side. `cut` is the length of the
  * longest word broken by an added hyphen (0 when none). A closing ellipsis may use the line's side padding, so it does not count.
  */
 function lay(text: string, per: number): {lines: string[]; cut: number} {
  const out: string[] = [], size = (s: string) => s.length - (s.endsWith('…') ? 1 : 0);
  let line = '', cut = 0;
  for (let word of text.split(' ')) {
   const whole = size(word);
   for (;;) {
    const lead = line ? line + ' ' : '';
    if (lead.length + size(word) <= per) { line = lead + word; break; }
    const room = per - lead.length, own = word.lastIndexOf('-', room - 1);
    if (size(word) > per && own >= 2 && size(word) - own - 1 >= 2) {
     out.push(lead + word.slice(0, own + 1));
     line = ''; word = word.slice(own + 1);
     continue;
    }
    const take = Math.min(room - 1, size(word) - 3);
    if (size(word) > per && take >= 3) {
     out.push(lead + word.slice(0, take) + '-');
     cut = Math.max(cut, whole); line = ''; word = word.slice(take);
     continue;
    }
    if (line) { out.push(line); line = ''; continue; }
    out.push(word.slice(0, Math.max(1, per - 1)) + '-');
    cut = Math.max(cut, whole); word = word.slice(Math.max(1, per - 1));
   }
  }
  if (line) out.push(line);
  return {lines: out, cut};
 }
 const words = (text: string) => text.trim().split(/\s+/);
 const fits = (text: string, per: number, lines: number) => lay(words(text).join(' '), per).lines.length <= lines;
 /**
  * At most `lines` lines of about `per` characters. Text that does not fit keeps as many whole words as fit and ends in an ellipsis,
  * so a name is never cut inside a word while a line has room; only a first word longer than every line together is cut. The full name
  * stays in the card's title, accessible name and the map caption.
  */
 function laid(text: string, per: number, lines: number): {lines: string[]; cut: number} {
  const all = words(text);
  for (let n = all.length; n > 0; n--) {
   const out = lay(all.slice(0, n).join(' ') + (n < all.length ? '…' : ''), per);
   if (out.lines.length <= lines) return out;
  }
  const cut = lay(all[0]!, per).lines.slice(0, lines);
  cut[cut.length - 1] = trunc(cut[cut.length - 1]!.replace(/-$/, '') + '…', per);
  return {lines: cut, cut: all[0]!.length};
 }
 const wrap = (text: string, per: number, lines: number) => laid(text, per, lines).lines;
 const cutOf = (text: string, per: number, lines: number) => laid(text, per, lines).cut;
 const TONE = {interrupt: 'var(--danger)', escalate: 'var(--deadline-escalate)'};
 root.LWProcessMapMarks = {el, small, glyph, pill, mark, statusOf, STATES, legend, wrap, fits, cutOf, trunc, TONE};
})(globalThis);
