/// <reference path="./process-contracts.d.ts" />
/**
 * Label-fitting and framing rules of the 2D process map (LWProcessMapFit). Pure functions of the drawn steps, their positions, the
 * camera scale (screen pixels per world unit) and the reader's root font size; nothing here touches the map's DOM or a session.
 *  - Text keeps a screen size, not a world size. Zoomed in ('full') titles are world-sized. Zoomed out ('names') they keep the title
 *    size in cards as wide as the neighbouring steps allow, leaving a screen gap of at least two paddings between neighbours, on the
 *    fewest lines (up to three, vertical spacing permitting) that hold every name.
 *  - A names layout needs lines of at least `MIN_NAME_CHARS` (7) characters and must keep every shown word of up to `wholeWord`
 *    characters whole: `WHOLE_WORD` (10) characters of the default 11px title, about 62px on screen, so 10 at a 16px root font and 6
 *    at 24px. Only longer words are hyphen-broken, at a hyphen of their own when they have one. When no line count meets both, cards
 *    show their two-digit list number ('numbers') and "Zoom in for names" zooms to the first level that meets them.
 *  - The 7-character minimum alone caused the cramped maps reported for process 7 at 1366 x 768: cards just wide enough for 7
 *    characters split most ordinary words ("Incept-ion:", "stand-/-up"), stood about 6px apart, and their pills touched the
 *    neighbours. Neighbouring cards now also keep a screen gap of at least two paddings, and a hyphenated word breaks at its hyphen.
 *  - Secondary lines, pill and tag text appear only once they reach the secondary text size.
 */
declare namespace LWProcessMapFit {
 /** Absolute world distances [dx, dy, dx, dy, ...] between every two drawn steps, and the drawn names, in drawing order. */
 interface Spacing {pairs: number[]; names: string[]}
 /** World bounds of the fitted map. */
 interface Box {x: number; y: number; w: number; h: number}
 interface Api {
  /** Screen-size floors in CSS pixels, scaled with the root font size. */
  floors(): LWProcessMapCard.Px;
  spacing(steps: LWProcess.Step[], at: ReadonlyMap<string, readonly number[]>): Spacing;
  /** The card layout at `ppu` screen pixels per world unit; `single` is a step scene (one large card). */
  layout(spacing: Spacing, ppu: number, single: boolean): LWProcessMapCard.Layout;
  /**
   * The zoom (relative to the whole-map fit, 1 to 8) at which numbered cards `wide` pixels wide no longer touch: every pair of steps
   * is apart sideways or vertically. `base` is the fitted scale in pixels per world unit.
   */
  readable(spacing: Spacing, base: number, wide: number): number;
  /**
   * World bounds of the drawn steps with room for their cards and the pills above them. Zoomed-out cards and cues keep a screen
   * size, so each card is bounded at the fitted scale: `atFit(box)` returns the layout at zoom 1 for a candidate box (two passes
   * settle it); the bounds then stay the same at every zoom level.
   */
  bounds(steps: LWProcess.Step[], at: ReadonlyMap<string, readonly number[]>, single: boolean,
   atFit: (box: Box) => LWProcessMapCard.Layout): Box;
  /** Pills stacked above a card (instances, deadline); a selected card that shows a phase tag starts one row higher. */
  pillRows(step: LWProcess.Step, selected: boolean): number;
  readonly MIN_NAME_CHARS: number;
  readonly WHOLE_WORD: number;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessMapFit?: LWProcessMapFit.Api; LWProcessMapMarks: LWProcessMapMarks.Api};
 const M = root.LWProcessMapMarks;
 /** A name needs lines of at least 7 characters that keep words of up to 10 characters whole; a line holds at most 24. */
 const MIN_NAME_CHARS = 7, WHOLE_WORD = 10, MAX_LINE_CHARS = 24, CHAR_EM = .56;
 /**
  * Screen-size floors in CSS pixels at a 16px root font, scaled with the reader's text size: titles 11px, secondary text 9px,
  * non-text cues (pills, badges) 12px, work markers 8px and counts 10px; a numbered card is about 30 x 25px.
  */
 function floors(): LWProcessMapCard.Px {
  const k = Math.max(.5, (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16);
  const title = 11 * k, line = title * 1.2, pad = 5 * k, mark = 8 * k;
  // A zoomed-out card is its title lines plus `chrome`: top padding, a gap, the work row and the bottom band with the progress bar.
  return {
   title, text: 9 * k, cue: 12 * k, line, mark, count: 10 * k, pad, chrome: pad * 2.5 + mark, char: title * CHAR_EM,
   badgeW: 30 * k, badgeH: line + 12 * k,
  };
 }
 const inclusive = (s: LWProcess.Step) => s.kind === 'fork' && s.mode === 'inclusive';
 const pillRows = (s: LWProcess.Step, selected: boolean) => (s.instances ? 1 : 0) + (s.deadline ? 1 : 0) + (selected && s.phase ? 1 : 0);
 function spacing(steps: LWProcess.Step[], at: ReadonlyMap<string, readonly number[]>): LWProcessMapFit.Spacing {
  const pairs: number[] = [], where = steps.map(s => at.get(s.id) ?? s.scene.position);
  where.forEach((a, i) => where.slice(i + 1).forEach(b => pairs.push(Math.abs(a[0]! - b[0]!), Math.abs(a[1]! - b[1]!))));
  return {pairs, names: steps.map(s => s.name)};
 }
 /** Smallest horizontal distance between two steps whose cards, `hPx` tall, would share a row at `ppu`. */
 function gapX(pairs: number[], ppu: number, hPx: number): number {
  let m = Infinity;
  for (let i = 0; i < pairs.length; i += 2) if (pairs[i + 1]! * ppu < hPx + 4) m = Math.min(m, pairs[i]!);
  return m;
 }
 /**
  * The longest word that must stay whole, in characters: words up to WHOLE_WORD characters of the default 11px title, about 62px on
  * screen. A larger text size leaves fewer characters per card at every zoom, so it tolerates breaking shorter words (6 characters
  * at a 24px root font) rather than hiding every name behind a number.
  */
 const wholeWord = (px: LWProcessMapCard.Px) => Math.floor(WHOLE_WORD * 11 * CHAR_EM / px.char + 1e-9);
 /** Whether a name would show a word of up to `whole` characters broken by an added hyphen. */
 const needlessCut = (name: string, per: number, lines: number, whole: number) => {
  const cut = M.cutOf(name, per, lines);
  return cut > 0 && cut <= whole;
 };
 function layout(s: LWProcessMapFit.Spacing, ppu: number, single: boolean): LWProcessMapCard.Layout {
  const px = floors(), secondary = single || ppu * .46 >= px.text;
  if (single || ppu * .67 >= px.title) {
   const key = `full|${secondary}|${single}`;
   return {mode: 'full', secondary, font: .67, single, lines: 2, per: 0, width: 8, ppu, px, key};
  }
  const font = px.title / ppu, zoomKey = Math.round(font * 40), gap = Math.max(1.2, 2 * px.pad / ppu), whole = wholeWord(px);
  // The fewest lines (up to three) that hold every name, among the line counts that keep short words whole.
  let best: {lines: number; per: number; width: number} | null = null;
  for (const lines of [1, 2, 3]) {
   const room = gapX(s.pairs, ppu, lines * px.line + px.chrome) - gap;
   const width = Math.min(12, room, (MAX_LINE_CHARS * px.char + px.pad * 2) / ppu);
   const per = Math.floor((width * ppu - px.pad * 2) / px.char);
   if (per < MIN_NAME_CHARS) break;
   if (s.names.some(n => needlessCut(n, per, lines, whole))) continue;
   best = {lines, per, width};
   if (s.names.every(n => M.fits(n, per, lines))) break;
  }
  if (best) {
   const key = `names|${best.lines}|${best.per}|${zoomKey}|${secondary}`;
   return {mode: 'names', secondary, font, single, ...best, ppu, px, key};
  }
  const width = px.badgeW / ppu;
  return {mode: 'numbers', secondary, font, single, lines: 1, per: 2, width, ppu, px, key: `numbers|${zoomKey}|${secondary}`};
 }
 function readable(s: LWProcessMapFit.Spacing, base: number, wide: number): number {
  const px = floors();
  let need = 0;
  for (let i = 0; i < s.pairs.length; i += 2) {
   const apart = Math.min((wide + 4) / Math.max(1e-6, s.pairs[i]!), (px.badgeH + 4) / Math.max(1e-6, s.pairs[i + 1]!));
   need = Math.max(need, apart);
  }
  return Math.max(1, Math.min(8, need / base));
 }
 function bounds(steps: LWProcess.Step[], at: ReadonlyMap<string, readonly number[]>, single: boolean,
  atFit: (box: LWProcessMapFit.Box) => LWProcessMapCard.Layout): LWProcessMapFit.Box {
  const xs = [...at.values()].map(p => p[0]!), ys = [...at.values()].map(p => p[1]!);
  const rows = Math.max(0, ...steps.map(s => pillRows(s, single)));
  const minX = Math.min(...xs) - 6.5, width = Math.max(...xs) - minX + 6.5;
  const pillTop = Math.max(4.5, rows ? (single ? 3.5 : 3) + 1.5 + (rows - 1) * 1.05 : 0);
  let box = {x: minX, y: Math.min(...ys) - pillTop, w: width, h: Math.max(...ys) - Math.min(...ys) + pillTop + 4.5};
  if (single) return box;
  for (let pass = 0; pass < 2; pass++) {
   const L = atFit(box);
   if (L.mode === 'full') break;
   const half = (L.mode === 'names' ? L.lines * L.px.line + L.px.chrome : L.px.badgeH) / 2 / L.ppu, room = L.px.pad / L.ppu;
   const k = Math.max(1, L.px.cue / (.9 * L.ppu)), gate = .75 * Math.max(1, L.px.cue / (1.5 * L.ppu));
   let top = Infinity, bottom = -Infinity;
   for (const s of steps) {
    // Outcome badges of zoomed-out cards sit inside the card, so only the instance and deadline pills rise above it.
    const y = at.get(s.id)![1]!, n = pillRows(s, false), pills = n ? (1.15 + (n - 1) * 1.05) * k : 0;
    top = Math.min(top, y - half - Math.max(pills, inclusive(s) ? gate : 0));
    bottom = Math.max(bottom, y + half);
   }
   box = {x: minX, y: top - room, w: width, h: bottom - top + 2 * room};
  }
  return box;
 }
 root.LWProcessMapFit = {floors, spacing, layout, readable, bounds, pillRows, MIN_NAME_CHARS, WHOLE_WORD};
})(globalThis);
