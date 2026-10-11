/// <reference path="./process-contracts.d.ts" />
/**
 * SVG chart primitives of the process Dashboard (LWProcessChart). Pure string builders: no DOM, session, clock or storage, so the
 * same markup is built in the browser and checked in Node. Every free text is escaped with `esc`; every coordinate is a finite number
 * rounded to 0.5 px. Charts are drawn 1:1 at a measured pixel width (`width`), with `rem` the root font size in px, so SVG text keeps
 * the browser's text size instead of scaling with a viewBox.
 *
 * Mark specs (shared by every chart): bars at most 24 px thick with a 4 px rounded data end and a square baseline, a 2 px surface gap
 * between touching segments, 2 px lines with round joins, end dots of radius 4 with a 2 px surface ring, area washes at 10% opacity,
 * hairline solid axes and gridlines. Scales that encode length start at zero; ticks are 1-2-5 values, at most five per axis, and
 * whole numbers when every plotted value is whole (counts never read "0.5 cases"). Time axes label round multiples of a 1-2-5 step
 * (never offsets from the first sample); interval columns label their own interval-end minutes under the columns, and so many
 * intervals that a column and its 2 px gap no longer fit are drawn as lines through the interval centres instead of a solid block.
 * Percentile bracket labels that would touch are joined into one label over their bins; band labels sit on top of the points.
 *
 * Colour is a role (`Tone`), never a hex value here: `data-tone` attributes take their colour from the `--viz-*` tokens of
 * process-dashboard.css. Text never wears a data colour. Marks that carry a value are keyboard-reachable (`tabindex="0"`) with an
 * accessible name in `aria-label`, mirrored in `data-tip` for the surface's hover and focus tooltip; the panel's data table carries
 * every value as well. A chart frame is an `svg role="group"` named by its `<title>`, so its focusable marks stay reachable.
 */
declare namespace LWProcessChart {
 /** Colour roles: work, waiting, blocked/failed/lost, backlog, timer, joining/finished, goal and idle (de-emphasis). */
 type Tone = 'work' | 'wait' | 'blocked' | 'backlog' | 'timer' | 'join' | 'goal' | 'idle';
 /** Glyph shapes, the 2D map's marker vocabulary (Working disc, Waiting ring, Timer hourglass, Backlog square, Blocked cross) and more. */
 type Glyph = 'active' | 'queued' | 'timer' | 'backlog' | 'held' | 'joining' | 'failed' | 'ring';
 interface Frame {width: number; height: number; title: string; id: string; cls?: string}
 interface Segment {label: string; value: number; tone: Tone; glyph?: Glyph}
 interface Series {label: string; values: (number | null)[]; tone: Tone}
 interface Bin {label: string; count: number; tip: string}
 interface Interval {label: string; mean: number | null; low: number | null; high: number | null; p10: number | null; p90: number | null; tip: string}
 interface Point {x: number; y: number; glyph: Glyph; tone: Tone}
 interface Band {from: number; to: number; label: string}
 /** `xMin` (default 0) starts a linear x scale at the first drawn value, so recent points are not pressed against its end. */
 interface PointOptions {columns: string[] | null; xMin?: number; xMax: number; yMax: number; bands: Band[]}
 interface Api {
  esc(text: unknown): string;
  /** '1,284', '12.9K', '3.1M' for axis ticks; values below 10,000 keep one decimal at most. */
  compact(n: number): string;
  /** 1-2-5 tick values from 0 covering `max` with at most `count` ticks (default 5); `whole` keeps steps of at least 1 (counts). */
  ticks(max: number, count?: number, whole?: boolean): number[];
  /** Linear map of [d0, d1] onto [r0, r1]; a zero-width domain maps to r0. */
  scale(d0: number, d1: number, r0: number, r1: number): (v: number) => number;
  frame(f: Frame, body: string): string;
  /** A one-bar inline SVG (aria-hidden): `value` of `max` across `width` px. */
  meter(value: number, max: number, width: number, tone: Tone): string;
  /** One horizontal stacked bar, 100% wide or scaled to `total`, with glyphs in segments wide enough for them. */
  stack(f: Frame, segments: Segment[], total?: number): string;
  /** A bullet graph: featured bar (0..max), a comparative tick and an optional qualitative band [bandFrom, max]. */
  bullet(f: Frame, value: number | null, compare: number | null, max: number, bandFrom: number | null, label: string): string;
  /** A word-sized trend line (aria-hidden) with a final dot; null values are skipped. */
  sparkline(values: (number | null)[], width: number, height: number, tone: Tone, max?: number): string;
  /** Equal-width columns per bin with shaded percentile brackets (`brackets` maps a bin index to its labels); `max` shares a scale. */
  histogram(f: Frame, rem: number, bins: Bin[], brackets: Map<number, string[]>, tone: Tone, axis: string, max?: number): string;
  /** Lines over a shared x axis (minutes), drawn as steps or straight segments, with an end dot per series. */
  lines(f: Frame, rem: number, xs: number[], series: Series[], options: {step: boolean; axis: string; mark?: number | null}): string;
  /** Columns per interval (stacked series) and an optional line on the same axis. */
  columns(f: Frame, rem: number, xs: number[], stacked: Series[], line: Series | null, axis: string): string;
  /** Rows of dot (mean), bold whisker (95% interval) and thin whisker (p10-p90); `zero` draws a reference rule at 0. */
  dots(f: Frame, rem: number, rows: Interval[], zero: boolean): string;
  /** Points in columns or on an x scale: `columns` names categorical columns (aging), otherwise x is linear. */
  points(f: Frame, rem: number, points: Point[], options: PointOptions): string;
  /** A small legend sample (aria-hidden SVG) of a tone and glyph. */
  key(tone: Tone, glyph?: Glyph): string;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessChart?: LWProcessChart.Api; LWProcessHtml: LWProcessHtml.Api};
 type Tone = LWProcessChart.Tone;
 type Glyph = LWProcessChart.Glyph;
 type Frame = LWProcessChart.Frame;
 /** Free text through the studio's one escaping module (LWProcessHtml.esc); `null` and `undefined` are empty text. */
 const esc = (text: unknown) => root.LWProcessHtml.esc(text ?? '');
 /** Half-pixel rounding keeps 1 px strokes crisp; non-finite values collapse to 0 so no NaN reaches an attribute. */
 const px = (n: number) => Number.isFinite(n) ? Math.round(n * 2) / 2 : 0;
 const BAR = 24, RADIUS = 4, GAP = 2, DOT = 4;
 function group(n: number): string {
  const [whole, fraction] = String(Math.abs(n)).split('.');
  return (n < 0 ? '-' : '') + whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction ? '.' + fraction : '');
 }
 function compact(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const a = Math.abs(n), one = (v: number) => String(Math.round(v * 10) / 10);
  if (a >= 1e6) return one(n / 1e6) + 'M';
  if (a >= 1e4) return one(n / 1e3) + 'K';
  return group(Math.round(n * 10) / 10);
 }
 function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(raw)), f = raw / power;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * power;
 }
 function ticks(max: number, count = 5, whole = false): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1];
  const nice = niceStep(max / Math.max(1, count - 1)), step = whole ? Math.max(1, nice) : nice, top = Math.ceil(max / step - 1e-9) * step, out: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
 }
 /** True when every finite value is a whole number: such an axis gets whole ticks. */
 const integral = (values: readonly (number | null)[]) => values.every(v => v === null || !Number.isFinite(v) || Number.isInteger(v));
 /** The next smaller 1-2-5 step (10 → 5 → 2 → 1 → 0.5). */
 const smaller = (step: number) => {
  const power = 10 ** Math.floor(Math.log10(step) + 1e-9), f = Math.round(step / power);
  return (f === 1 ? .5 : f === 2 ? 1 : 2) * power;
 };
 /** Approximate width of a label at the tick text size, for collision decisions. */
 const textWidth = (content: string, rem: number) => content.length * rem * .45;
 const scale = (d0: number, d1: number, r0: number, r1: number) => (v: number) => d1 === d0 ? r0 : r0 + (v - d0) * (r1 - r0) / (d1 - d0);
 /** Attributes of a mark that carries a value: a keyboard stop with an accessible name, mirrored for the tooltip. */
 const mark = (label: string) => ` tabindex="0" role="img" aria-label="${esc(label)}" data-tip="${esc(label)}"`;
 const path = (cls: string, d: string, extra = '') => `<path class="${cls}"${extra} d="${d}"/>`;
 const rect = (cls: string, x: number, y: number, w: number, h: number) =>
  `<rect class="${cls}" x="${px(x)}" y="${px(y)}" width="${px(w)}" height="${px(h)}"/>`;
 const text = (cls: string, x: number, y: number, anchor: string, content: string) =>
  `<text class="${cls}" x="${px(x)}" y="${px(y)}" text-anchor="${anchor}">${esc(content)}</text>`;
 const toned = (tone: Tone) => ` data-tone="${tone}"`;
 function frame(f: Frame, body: string): string {
  const w = px(f.width), h = px(f.height), cls = f.cls ? ' ' + esc(f.cls) : '';
  return `<svg class="db-chart${cls}" role="group" aria-labelledby="${esc(f.id)}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
   + `<title id="${esc(f.id)}">${esc(f.title)}</title>${body}</svg>`;
 }
 /** A horizontal bar from `x0` (the baseline, square) to `x1` (the data end, rounded) over the row y..y+h. */
 function hbar(x0: number, x1: number, y: number, h: number): string {
  const r = Math.min(RADIUS, Math.abs(x1 - x0), h / 2);
  return `M${px(x0)} ${px(y)}H${px(x1 - r)}Q${px(x1)} ${px(y)} ${px(x1)} ${px(y + r)}`
   + `V${px(y + h - r)}Q${px(x1)} ${px(y + h)} ${px(x1 - r)} ${px(y + h)}H${px(x0)}Z`;
 }
 /** A vertical bar from `base` (square) up to `top` (rounded). */
 function vbar(x: number, w: number, base: number, top: number): string {
  const r = Math.min(RADIUS, Math.abs(base - top), w / 2);
  return `M${px(x)} ${px(base)}V${px(top + r)}Q${px(x)} ${px(top)} ${px(x + r)} ${px(top)}`
   + `H${px(x + w - r)}Q${px(x + w)} ${px(top)} ${px(x + w)} ${px(top + r)}V${px(base)}Z`;
 }
 const square = (x0: number, x1: number, y0: number, y1: number) => `M${px(x0)} ${px(y0)}H${px(x1)}V${px(y1)}H${px(x0)}Z`;
 /** Glyph paths in a unit box centred on 0,0 (the 2D map's marker shapes, plus joining, failed and outcome ring). */
 const SHAPES: Record<Glyph, string> = {
  active: 'M0 -.5A.5 .5 0 1 1 0 .5A.5 .5 0 1 1 0 -.5Z',
  queued: 'M0 -.38A.38 .38 0 1 1 0 .38A.38 .38 0 1 1 0 -.38Z',
  timer: 'M-.36 -.46H.36L-.36 .46H.36Z',
  backlog: 'M-.42 -.42H.42V.42H-.42Z',
  held: 'M-.34 -.34L.34 .34M.34 -.34L-.34 .34',
  joining: 'M-.45 -.3L0 0L-.45 .3M0 0H.45',
  failed: 'M-.34 -.34L.34 .34M.34 -.34L-.34 .34',
  ring: 'M0 -.42A.42 .42 0 1 1 0 .42A.42 .42 0 1 1 0 -.42Z',
 };
 const OUTLINED = new Set<Glyph>(['queued', 'held', 'joining', 'failed', 'ring']);
 function glyph(g: Glyph, x: number, y: number, size: number, cls: string, tone?: Tone): string {
  const line = OUTLINED.has(g) ? ' line' : '', place = ` transform="translate(${px(x)} ${px(y)}) scale(${px(size)})"`;
  return path(`db-glyph ${cls}${line}`, SHAPES[g], (tone ? toned(tone) : '') + place);
 }
 function key(tone: Tone, g?: Glyph): string {
  const sample = g ? glyph(g, 0, 0, 12, 'db-key-glyph', tone) : `<rect class="db-fill"${toned(tone)} x="-6" y="-6" width="12" height="12" rx="2"/>`;
  return `<svg class="db-key" width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true" focusable="false">${sample}</svg>`;
 }
 function meter(value: number, max: number, width: number, tone: Tone): string {
  const w = px(Math.max(1, width)), x1 = max > 0 ? Math.max(0, Math.min(1, value / max)) * w : 0;
  const fill = x1 > 0 ? path('db-fill', hbar(0, Math.max(x1, 2), 2, 6), toned(tone)) : '';
  return `<svg class="db-meter" width="${w}" height="10" viewBox="0 0 ${w} 10" aria-hidden="true" focusable="false">`
   + `<rect class="db-track" x="0" y="2" width="${w}" height="6" rx="3"/>${fill}</svg>`;
 }
 function stack(f: Frame, segments: LWProcessChart.Segment[], scaleTo?: number): string {
  const sum = segments.reduce((s, x) => s + Math.max(0, x.value), 0), total = Math.max(sum, scaleTo ?? 0);
  if (sum <= 0) return frame(f, '');
  const h = Math.min(BAR, f.height), y = (f.height - h) / 2, parts: string[] = [], last = segments.map(s => s.value > 0).lastIndexOf(true);
  let x = 0;
  segments.forEach((s, i) => {
   if (s.value <= 0) return;
   const w = s.value / total * f.width, x1 = x + Math.max(1, w - (i === last ? 0 : GAP)), share = Math.round(s.value / sum * 1000) / 10;
   const value = scaleTo === undefined ? `${share}%` : `${compact(s.value)} (${share}%)`;
   parts.push(path('db-fill db-seg', i === last ? hbar(x, x1, y, h) : square(x, x1, y, y + h), toned(s.tone) + mark(`${s.label}: ${value}`)));
   if (s.glyph && x1 - x >= 18) parts.push(glyph(s.glyph, x + 9, y + h / 2, 10, 'on-mark'));
   x += w;
  });
  return frame(f, parts.join(''));
 }
 function bullet(f: Frame, value: number | null, compare: number | null, max: number, bandFrom: number | null, label: string): string {
  const s = scale(0, max, 0, f.width - 2), h = Math.min(12, f.height / 2), y = (f.height - h) / 2;
  const parts = [rect('db-track', 0, y - 4, f.width - 2, h + 8)];
  if (bandFrom !== null && bandFrom < max) parts.push(rect('db-band', s(bandFrom), y - 4, s(max) - s(bandFrom), h + 8));
  if (value !== null && value > 0) parts.push(path('db-fill', hbar(0, Math.max(2, s(Math.min(value, max))), y, h), toned('work') + mark(label)));
  if (compare !== null) parts.push(path('db-tick', `M${px(s(Math.min(compare, max)))} ${px(y - 6)}V${px(y + h + 6)}`));
  return frame(f, parts.join(''));
 }
 function sparkline(values: (number | null)[], width: number, height: number, tone: Tone, max?: number): string {
  const xs = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null && Number.isFinite(p[1]));
  const top = max ?? Math.max(1, ...xs.map(p => p[1]));
  const sx = scale(0, Math.max(1, values.length - 1), DOT, width - DOT), sy = scale(0, top, height - DOT, DOT);
  const d = xs.map((p, i) => `${i ? 'L' : 'M'}${px(sx(p[0]))} ${px(sy(p[1]))}`).join(''), end = xs.at(-1);
  const dot = end ? `<circle class="db-dot"${toned(tone)} cx="${px(sx(end[0]))}" cy="${px(sy(end[1]))}" r="3"/>` : '';
  return `<svg class="db-spark" width="${px(width)}" height="${px(height)}" viewBox="0 0 ${px(width)} ${px(height)}" aria-hidden="true" focusable="false">`
   + (d ? path('db-line', d, toned(tone)) : '') + dot + '</svg>';
 }
 interface Axis {html: string; left: number; y: (v: number) => number}
 /** The y axis: its title, gridlines and tick labels in a left band sized to the longest label. */
 function yAxis(f: Frame, rem: number, max: number, top: number, bottom: number, title: string, whole = false): Axis {
  const t = ticks(max, 5, whole), y = scale(0, t.at(-1)!, bottom, top);
  const left = Math.ceil(Math.max(...t.map(v => compact(v).length)) * rem * .45 + 12);
  const grid = t.map(v => path('db-gridline', `M${px(left)} ${px(y(v)) + .5}H${px(f.width)}`)
   + text('db-tick-label', left - 6, y(v) + rem * .25, 'end', compact(v)));
  const axis = path('db-axis', `M${px(left)} ${px(bottom) + .5}H${px(f.width)}`);
  return {html: text('db-axis-title', 0, rem * .75, 'start', title) + grid.join('') + axis, left, y};
 }
 /**
  * Minute labels under a time axis: round multiples of a 1-2-5 step inside [first, last], as many as fit (about 4.5 root ems each).
  * A smaller step is tried when fewer than two multiples fall inside; failing that, the first and last minute are labelled. A label
  * at the left edge is anchored at its start and one near the right edge at its end, so none leaves the frame.
  */
 function xLabels(xs: number[], x: (v: number) => number, y: number, rem: number, width: number): string {
  if (!xs.length) return '';
  const first = xs[0]!, last = xs.at(-1)!, room = Math.max(2, Math.min(5, Math.floor(width / (rem * 4.5))));
  const multiples = (step: number) => {
   const out: number[] = [];
   for (let v = Math.ceil(first / step - 1e-9) * step; v <= last + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
   return out;
  };
  let marks: number[] = [];
  if (last > first) {
   let step = niceStep((last - first) / (room - 1));
   marks = multiples(step);
   for (let tries = 0; marks.length < 2 && tries < 3; tries++) {
    step = smaller(step);
    const next = multiples(step);
    if (next.length > room) break;
    marks = next;
   }
  }
  if (marks.length < 2) marks = last > first ? [first, last] : [first];
  return marks.map(v => {
   const at = x(v), half = textWidth(compact(v), rem) / 2;
   const anchor = at - half < x(first) - rem * .25 ? 'start' : at + half > width ? 'end' : 'middle';
   return text('db-tick-label', at, y, anchor, compact(v));
  }).join('');
 }
 /**
  * Labels centred under (or over) slots: `labels[i]` at `centre(i)`, keeping half a root em between neighbours; a label that would
  * touch the previous one is joined to it (`join`) or skipped, and labels at the frame edges are anchored inside it.
  */
 function slotLabels(labels: (string | null)[], centre: (i: number) => number, y: number, rem: number, width: number, cls: string, join: boolean): string {
  const groups: {from: number; to: number; text: string}[] = [];
  const mid = (g: {from: number; to: number}) => (centre(g.from) + centre(g.to)) / 2;
  labels.forEach((label, i) => {
   if (!label) return;
   const g = {from: i, to: i, text: label}, prev = groups.at(-1);
   const touches = prev && mid(g) - textWidth(label, rem) / 2 < mid(prev) + textWidth(prev.text, rem) / 2 + rem / 2;
   if (!touches) groups.push(g);
   else if (join) {
    prev.to = i;
    prev.text += ' ' + label;
   }
  });
  return groups.map(g => {
   const at = mid(g), half = textWidth(g.text, rem) / 2, anchor = at - half < 0 ? 'start' : at + half > width ? 'end' : 'middle';
   return text(cls, anchor === 'start' ? 2 : anchor === 'end' ? width - 2 : at, y, anchor, g.text);
  }).join('');
 }
 function histogram(f: Frame, rem: number, bins: LWProcessChart.Bin[], brackets: Map<number, string[]>, tone: Tone, axis: string, max?: number): string {
  const counts = bins.map(b => b.count), top = rem * 1.6, bottom = f.height - rem * 1.6;
  const ax = yAxis(f, rem, Math.max(1, max ?? 0, ...counts), top, bottom, axis, integral([...counts, max ?? 0]));
  const slot = (f.width - ax.left) / Math.max(1, bins.length), w = Math.min(BAR, Math.max(2, slot - GAP)), parts = [ax.html];
  bins.forEach((b, i) => {
   const x = ax.left + i * slot;
   if (brackets.has(i)) parts.push(rect('db-bracket', x, top, slot, bottom - top));
   if (b.count > 0) parts.push(path('db-fill', vbar(x + (slot - w) / 2, w, bottom, Math.min(bottom - 1, ax.y(b.count))), toned(tone) + mark(b.tip)));
  });
  // Bracket labels over narrow neighbouring bins would touch ("p85p95"): those are joined into one label over their bins.
  const marked = bins.map((_, i) => brackets.get(i)?.join(' ') ?? null);
  parts.push(slotLabels(marked, i => ax.left + (i + .5) * slot, top - 4, rem, f.width, 'db-bracket-label', true));
  // Bin labels thin out so that each keeps about three root ems of room.
  const every = Math.max(1, Math.ceil(bins.length * rem * 3.2 / Math.max(1, f.width - ax.left)));
  bins.forEach((b, i) => {
   if (i % every === 0) parts.push(text('db-tick-label', ax.left + i * slot + slot / 2, f.height - rem * .4, 'middle', b.label));
  });
  return frame(f, parts.join(''));
 }
 /** The plot box shared by the time charts: y axis on the left, minute labels below. */
 function timeBox(f: Frame, rem: number, xs: number[], max: number, axis: string, whole = false) {
  const top = rem * 1.4, bottom = f.height - rem * 1.6, ax = yAxis(f, rem, max, top, bottom, axis, whole), right = f.width - DOT - 2;
  const x = scale(xs[0] ?? 0, xs.at(-1) ?? 1, ax.left + DOT, right);
  return {ax, x, top, bottom, right, labels: xLabels(xs, x, f.height - rem * .4, rem, f.width)};
 }
 function lines(f: Frame, rem: number, xs: number[], series: LWProcessChart.Series[], o: {step: boolean; axis: string; mark?: number | null}): string {
  const all = series.flatMap(s => s.values.filter((v): v is number => v !== null));
  const box = timeBox(f, rem, xs, Math.max(1, ...all), o.axis, integral(all)), parts = [box.ax.html, box.labels];
  if (o.mark !== undefined && o.mark !== null) parts.push(path('db-rule', `M${px(box.x(o.mark))} ${px(box.top)}V${px(box.bottom)}`));
  for (const s of series) {
   let d = '', open = false;
   s.values.forEach((v, i) => {
    if (v === null) { open = false; return; }
    const x = px(box.x(xs[i]!)), y = px(box.ax.y(v));
    d += !open ? `M${x} ${y}` : o.step ? `H${x}V${y}` : `L${x} ${y}`;
    open = true;
   });
   const at = s.values.map(v => v !== null).lastIndexOf(true);
   if (d) parts.push(path('db-line', d, toned(s.tone)));
   if (at < 0) continue;
   const cx = px(box.x(xs[at]!)), cy = px(box.ax.y(s.values[at]!)), label = `${s.label}: ${compact(s.values[at]!)} at minute ${compact(xs[at]!)}`;
   parts.push(`<circle class="db-dot"${toned(s.tone)} cx="${cx}" cy="${cy}" r="${DOT}"${mark(label)}/>`);
  }
  return frame(f, parts.join(''));
 }
 function columns(f: Frame, rem: number, xs: number[], stacked: LWProcessChart.Series[], line: LWProcessChart.Series | null, axis: string): string {
  const totals = xs.map((_, i) => stacked.reduce((s, x) => s + (x.values[i] ?? 0), 0)), lineValues = line?.values ?? [];
  const lineMax = Math.max(0, ...lineValues.map(v => v ?? 0)), whole = integral([...totals, ...lineValues]);
  const box = timeBox(f, rem, xs, Math.max(1, ...totals, lineMax), axis, whole), slot = (box.right - box.ax.left) / Math.max(1, xs.length);
  const centre = (i: number) => box.ax.left + (i + .5) * slot, w = Math.min(BAR, Math.max(1, slot - GAP)), focus = xs.length <= 60;
  // Columns wide enough for their label carry their own interval-end minute under the column; narrower ones share round minute
  // labels placed on the same (regular) interval grid.
  const widest = Math.max(...xs.map(m => textWidth(compact(m), rem))), y = f.height - rem * .4, n = xs.length;
  const along = (m: number) => n > 1 ? centre(0) + (m - xs[0]!) / (xs[n - 1]! - xs[0]!) * (centre(n - 1) - centre(0)) : centre(0);
  const labels = widest + rem / 2 <= slot ? slotLabels(xs.map(compact), centre, y, rem, f.width, 'db-tick-label', false)
   : xLabels(xs, along, y, rem, f.width);
  const parts = [box.ax.html, labels], through = (values: (number | null)[]) => values.map((v, i) => `${i ? 'L' : 'M'}${px(centre(i))} ${px(box.ax.y(v ?? 0))}`)
   .join('');
  if (slot < GAP + 2) {
   // Too many intervals for a column and its surface gap each: every stacked series becomes a line through the interval centres.
   for (const s of stacked) if (s.values.some(v => (v ?? 0) > 0)) parts.push(path('db-line', through(s.values), toned(s.tone)));
  } else xs.forEach((m, i) => {
   const cx = centre(i) - w / 2, last = stacked.map(s => (s.values[i] ?? 0) > 0).lastIndexOf(true);
   let sum = 0;
   stacked.forEach((s, k) => {
    const v = s.values[i] ?? 0;
    if (v <= 0) return;
    const base = box.ax.y(sum), top = box.ax.y(sum + v), d = k === last ? vbar(cx, w, base, top) : square(cx, cx + w, top + GAP, base);
    sum += v;
    parts.push(path('db-fill', d, toned(s.tone) + (focus ? mark(`${s.label}: ${compact(v)} in the interval to minute ${compact(m)}`) : '')));
   });
  });
  if (line) parts.push(path('db-line', through(line.values), toned(line.tone)));
  return frame(f, parts.join(''));
 }
 function dots(f: Frame, rem: number, rows: LWProcessChart.Interval[], zero: boolean): string {
  const values = rows.flatMap(r => [r.mean, r.low, r.high, r.p10, r.p90]).filter((v): v is number => v !== null && Number.isFinite(v));
  let lo = Math.min(0, ...values), hi = Math.max(0, ...values);
  if (hi === lo) hi = lo + 1;
  const pad = (hi - lo) * .05;
  if (lo < 0) lo -= pad;
  hi += pad;
  const left = 4, right = f.width - 8, x = scale(lo, hi, left, right), row = Math.max(rem * 1.6, 22), parts: string[] = [];
  if (zero) parts.push(path('db-rule zero', `M${px(x(0))} 0V${px(rows.length * row)}`));
  rows.forEach((r, i) => {
   const cy = px(i * row + row / 2), span = (a: number, b: number) => `M${px(x(a))} ${cy}H${px(x(b))}`;
   parts.push(path('db-gridline', `M${left} ${cy + .5}H${px(right)}`));
   if (r.p10 !== null && r.p90 !== null) parts.push(path('db-whisker thin', span(r.p10, r.p90)));
   if (r.low !== null && r.high !== null) parts.push(path('db-whisker', span(r.low, r.high), toned('work')));
   if (r.mean !== null) parts.push(`<circle class="db-dot"${toned('work')} cx="${px(x(r.mean))}" cy="${cy}" r="${DOT}"${mark(r.tip)}/>`);
  });
  return frame({...f, height: Math.max(f.height, rows.length * row)}, parts.join(''));
 }
 function points(f: Frame, rem: number, list: LWProcessChart.Point[], o: LWProcessChart.PointOptions): string {
  const top = rem * 1.4, bottom = f.height - rem * 1.6, ys = [...list.map(p => p.y), ...o.bands.flatMap(b => [b.from, b.to])];
  const ax = yAxis(f, rem, Math.max(1, o.yMax, ...o.bands.map(b => b.to)), top, bottom, 'minutes', integral([...ys, o.yMax]));
  const slot = o.columns ? (f.width - ax.left) / Math.max(1, o.columns.length) : 0, parts = [ax.html], x0 = o.xMin ?? 0;
  const x = o.columns ? (v: number) => ax.left + (v + .5) * slot : scale(x0, Math.max(x0 + 1, o.xMax), ax.left + DOT, f.width - DOT);
  for (const b of o.bands) parts.push(rect('db-bracket', ax.left, ax.y(b.to), f.width - ax.left, Math.max(1, ax.y(b.from) - ax.y(b.to))));
  // Column names that do not fit their slot are replaced by their route numbers; the panel lists the names under the chart.
  const named = !!o.columns && o.columns.every(c => c.length * rem * .45 <= slot - 6);
  o.columns?.forEach((c, i) => parts.push(text('db-tick-label', x(i), f.height - rem * .4, 'middle', named ? c : String(i + 1))));
  if (!o.columns) parts.push(xLabels([x0, Math.max(x0 + 1, o.xMax)], x, f.height - rem * .4, rem, f.width));
  for (const p of list) parts.push(glyph(p.glyph, x(p.x), ax.y(p.y), 9, 'point', p.tone));
  // Band labels are drawn last, with their surface halo, so points never hide them. Bands that end on the same edge share one label;
  // a label that would overlap the one above it moves down below it.
  const ends = [...new Set(o.bands.map(b => b.to))].sort((p, q) => q - p);
  let below = -Infinity;
  for (const to of ends) {
   const y = Math.max(ax.y(to) + rem * .8, below + rem * 1.1);
   parts.push(text('db-bracket-label', f.width - 4, y, 'end', o.bands.filter(b => b.to === to).map(b => b.label).join(' · ')));
   below = y;
  }
  return frame(f, parts.join(''));
 }
 root.LWProcessChart = {esc, compact, ticks, scale, frame, meter, stack, bullet, sparkline, histogram, lines, columns, dots, points, key};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessChart;
})(globalThis);
