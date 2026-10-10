/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-html.ts" />
/// <reference path="./process-chart.ts" />
/// <reference path="./process-dashboard-model.ts" />
/**
 * Markup of the Dashboard model (LWProcessDashboardHtml): the run strip, the KPI tiles, a section heading and one panel at a time,
 * plus the spreadsheet-safe CSV text of every panel table. Pure strings from LWProcessDashboardModel values and LWProcessChart
 * primitives: no DOM, session, clock or storage, so Node checks read the same markup the studio shows. Every free text is escaped
 * with the studio's one escaping module (LWProcessHtml.esc); option values are finite numbers only (LWProcessHtml.num).
 *
 * Structure (a contract with the surface and the browser checks):
 *  - a panel is `section.db-panel[data-panel]` labelled by its `h3`; a chart sits in `figure.db-figure` named by its
 *    `figcaption`, with its data table in `details.db-table` (summary "Data table") holding a `table` with a caption and
 *    `th[scope]` headers inside a focusable, labelled scroll region; a table-only panel shows its table openly;
 *  - step rows are `button[data-select="<step id>"]`; "Show all" toggles are `button[data-more="<panel id>"]` with `aria-expanded`;
 *    rows past 10 (bar rows) or 24 (tables) are left out until expanded;
 *  - glyphs and decorative samples are `aria-hidden`; problem tiles carry the word "Problems" and a hidden glyph, never colour alone;
 *  - a panel control (the lead-time target) is a labelled `select[data-target]` whose first option, "No target", has the value "".
 */
declare namespace LWProcessDashboardHtml {
 interface Context {
  /** Content width of the panel in CSS px and the root font size in px. */
  width: number; rem: number;
  /** Expanded parts: `<panel id>` (all bar rows), `<panel id>-table` (all table rows) and `<panel id>-open` (the open data table). */
  expanded: ReadonlySet<string>;
 }
 interface Api {
  strip(strip: LWProcessDashboardModel.Strip): string;
  tiles(tiles: LWProcessDashboardModel.Tile[], label: string): string;
  panel(panel: LWProcessDashboardModel.Panel, context: Context): string;
  /** The data table of a panel inside its "Data table" disclosure (`open` shows it without one). */
  table(table: LWProcessDashboardModel.Table, id: string, context: Context, open?: boolean): string;
  /** Every panel table as CSV blocks (section, panel, caption, header, rows), separated by blank lines. */
  csv(model: LWProcessDashboardModel.Model, extra?: {section: string; panel: string; table: LWProcessDashboardModel.Table}[]): string;
  readonly ROWS: number; readonly TABLE_ROWS: number;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessChart: LWProcessChart.Api; LWProcessHtml: LWProcessHtml.Api; LWProcessDashboardHtml?: LWProcessDashboardHtml.Api};
 type Ctx = LWProcessDashboardHtml.Context;
 type Panel = LWProcessDashboardModel.Panel;
 type Table = LWProcessDashboardModel.Table;
 type Chart = LWProcessDashboardModel.Chart;
 const ROWS = 10, TABLE_ROWS = 24, SPARKS = 12;
 const C = () => root.LWProcessChart, esc = (s: unknown) => root.LWProcessHtml.esc(s), num = (n: unknown) => root.LWProcessHtml.num(n);
 const slug = (id: string) => id.replace(/[^a-z0-9-]/gi, '-');
 /** The "Show all" toggle of a list longer than `limit`. */
 function more(id: string, total: number, ctx: Ctx, limit: number, what: string): string {
  if (total <= limit) return '';
  const open = ctx.expanded.has(id), label = open ? `Show the first ${limit} ${what}` : `Show all ${total} ${what}`;
  return `<button type="button" class="db-more" data-more="${esc(id)}" aria-expanded="${open}">${label}</button>`;
 }
 /** The first (or, for a time series, the latest) `limit` entries unless the list is expanded. */
 function shown<T>(list: T[], id: string, ctx: Ctx, limit: number, tail = false): T[] {
  if (list.length <= limit || ctx.expanded.has(id)) return list;
  return tail ? list.slice(-limit) : list.slice(0, limit);
 }
 /**
  * Markup per chart or table object and drawing context. Panels drawn only from the run history are built once per series
  * (LWProcessDashboardModel.util.memo) and hand back the same objects, so their markup is not built again on every draw. Only a pure
  * function's result is kept, so the output never depends on it.
  */
 const drawn = new WeakMap<object, Map<string, string>>();
 function once(object: object, key: string, make: () => string): string {
  let held = drawn.get(object);
  if (!held) {
   held = new Map();
   drawn.set(object, held);
  }
  let markup = held.get(key);
  if (markup === undefined) {
   if (held.size >= 8) held.clear();
   markup = make();
   held.set(key, markup);
  }
  return markup;
 }
 function table(t: Table, id: string, ctx: Ctx, open = false): string {
  const key = [id, open, ctx.expanded.has(id + '-table'), ctx.expanded.has(id + '-open')].join('|');
  return once(t, key, () => drawTable(t, id, ctx, open));
 }
 function drawTable(t: Table, id: string, ctx: Ctx, open: boolean): string {
  const rows = shown(t.rows, id + '-table', ctx, TABLE_ROWS, t.tail), cut = rows.length < t.rows.length;
  const caption = t.caption + (cut ? ` (the ${t.tail ? 'latest' : 'first'} ${TABLE_ROWS} of ${t.rows.length} rows)` : '');
  const num = (i: number) => t.numeric[i] ? ' class="num"' : '';
  const cell = (c: string, i: number) => i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td${num(i)}>${esc(c)}</td>`;
  const head = t.head.map((h, i) => `<th scope="col"${num(i)}>${esc(h)}</th>`).join('');
  const body = `<div class="db-scroll" role="region" tabindex="0" aria-label="${esc(caption)}"><table><caption>${esc(caption)}</caption>`
   + `<thead><tr>${head}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(cell).join('')}</tr>`).join('')}</tbody></table></div>`
   + more(id + '-table', t.rows.length, ctx, TABLE_ROWS, 'rows');
  if (open) return `<div class="db-table open">${body}</div>`;
  return `<details class="db-table"${ctx.expanded.has(id + '-open') ? ' open' : ''}><summary>Data table</summary>${body}</details>`;
 }
 function legend(items: LWProcessDashboardModel.Legend[]): string {
  if (items.length < 2) return '';
  return `<ul class="db-legend" aria-label="Legend">${items.map(l => `<li>${C().key(l.tone, l.glyph)}<span>${esc(l.label)}</span></li>`).join('')}</ul>`;
 }
 const label = (name: string, detail: string) => `<span class="db-row-label"><strong>${esc(name)}</strong><span>${esc(detail)}</span></span>`;
 function rows(p: Panel, chart: Extract<Chart, {kind: 'rows'}>, ctx: Ctx): string {
  const bar = Math.max(40, Math.min(ctx.width, 640));
  const items = shown(chart.rows, p.id, ctx, ROWS).map(r => {
   const extra = r.extra ? `<span class="db-row-extra">${C().meter(r.extra.value, r.extra.max, bar / 3, 'idle')}<span>${esc(r.extra.text)}</span></span>` : '';
   const inner = label(r.label, r.detail) + C().meter(r.value, r.max, bar, r.tone) + extra;
   return `<li>${r.step ? `<button type="button" class="db-row" data-select="${esc(r.step)}">${inner}</button>` : `<div class="db-row">${inner}</div>`}</li>`;
  });
  return `<ol class="db-rows" aria-label="${esc(chart.title)}">${items.join('')}</ol>` + more(p.id, chart.rows.length, ctx, ROWS, 'rows');
 }
 /** The chart of a panel as markup (SVG or bar rows), drawn at the context width. */
 function chart(p: Panel, ctx: Ctx): string {
  return once(p.chart!, [p.id, ctx.width, ctx.rem, ctx.expanded.has(p.id)].join('|'), () => drawChart(p, ctx));
 }
 function drawChart(p: Panel, ctx: Ctx): string {
  const c = p.chart!, w = Math.max(160, Math.floor(ctx.width)), rem = ctx.rem, id = 'db-c-' + slug(p.id);
  const f = (h: number, title = c.title, suffix = '') => ({width: w, height: h, title, id: id + suffix});
  switch (c.kind) {
   case 'stack': {
    const bars = shown(c.bars, p.id, ctx, ROWS).map((b, i) => {
     const name = b.step ? `<button type="button" class="db-link" data-select="${esc(b.step)}">${esc(b.label)}</button>` : `<span>${esc(b.label)}</span>`;
     return `<li>${name}${C().stack(f(rem * 1.75, `${c.title}: ${b.label}`, '-' + i), b.segments, b.total)}</li>`;
    });
    return `<ul class="db-stacks">${bars.join('')}</ul>` + more(p.id, c.bars.length, ctx, ROWS, 'bars');
   }
   case 'bullets': {
    const items = c.rows.map((r, i) => {
     const spark = r.spark && r.spark.length > 1 ? `<span class="db-spark-row">${C().sparkline(r.spark, Math.min(w, 240), rem * 1.5, 'work', 100)}`
      + '<span>busy share per interval</span></span>' : '';
     return `<li>${label(r.label, r.detail)}${C().bullet(f(rem * 1.75, `${c.title}: ${r.label}`, '-' + i), r.value, r.compare, 100, 85, r.tip)}${spark}</li>`;
    });
    return `<ul class="db-bullets">${items.join('')}</ul>`;
   }
   case 'histogram': return C().histogram(f(rem * 11), rem, c.bins, new Map(c.brackets), c.tone, c.axis, c.max);
   case 'lines': return C().lines(f(rem * 12), rem, c.xs, c.series, {step: c.step, axis: c.axis, mark: c.mark});
   case 'columns': return C().columns(f(rem * 12), rem, c.xs, c.stacked, c.line, c.axis);
   case 'dots': return C().dots(f(rem * 1.75), rem, c.rows, c.zero);
   case 'points': {
    const key = c.columns ? `<p class="db-note">Columns in route order: ${c.columns.map((name, i) => `${i + 1} ${esc(name)}`).join(' · ')}</p>` : '';
    return C().points(f(rem * 13), rem, c.points, {columns: c.columns, xMax: c.xMax, yMax: c.yMax, bands: c.bands}) + key;
   }
   case 'rows': return rows(p, c, ctx);
   case 'sparks': {
    const spark = (r: {values: number[]; max: number}) => C().sparkline(r.values, Math.min(w, 320), rem * 2, 'wait', r.max);
    const items = shown(c.rows, p.id, ctx, SPARKS).map(r => `<li><span>${esc(r.label)}</span>${spark(r)}</li>`);
    return `<ul class="db-sparks">${items.join('')}</ul>` + more(p.id, c.rows.length, ctx, SPARKS, 'steps');
   }
   case 'text': return `<ul class="db-lines">${c.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>`;
  }
  return '';
 }
 function panel(p: Panel, ctx: Ctx): string {
  const h = 'db-h-' + slug(p.id), notes = p.notes.map(n => `<p class="db-note">${esc(n)}</p>`).join('');
  const head = `<h3 id="${h}">${esc(p.title)}</h3><p class="db-question">${esc(p.question)}</p>`
   + (p.control && p.empty === null ? control(p.control) : '');
  let body: string;
  if (p.empty !== null) body = `<p class="db-empty">${esc(p.empty)}</p>` + notes;
  else if (p.chart) {
   body = `<figure class="db-figure"><div class="db-plot" data-kind="${p.chart.kind}">${chart(p, ctx)}</div>${legend(p.legend)}`
    + `<figcaption>${esc(p.caption || p.chart.title)}</figcaption>${p.table ? table(p.table, p.id, ctx) : ''}</figure>` + notes;
  } else if (p.table) {
   body = `<figure class="db-figure"><figcaption>${esc(p.caption || p.table.caption)}</figcaption>${table(p.table, p.id, ctx, true)}</figure>` + notes;
  } else body = `<p class="db-caption">${esc(p.caption)}</p>` + notes;
  return `<section class="db-panel" data-panel="${esc(p.id)}" aria-labelledby="${h}">${head}${body}</section>`;
 }
 /** The lead-time target select: "No target" (value "") and the bin edges offered by the model. */
 function control(c: NonNullable<Panel['control']>): string {
  const option = (o: {value: number; label: string}) => `<option value="${num(o.value)}"${o.value === c.value ? ' selected' : ''}>${esc(o.label)}</option>`;
  const none = `<option value=""${c.value === null ? ' selected' : ''}>No target</option>`;
  return `<label class="db-target">${esc(c.label)} <select data-target>${none}${c.options.map(option).join('')}</select></label>`;
 }
 function strip(s: LWProcessDashboardModel.Strip): string {
  const option = (m: number) => `<option value="${Number.isFinite(m) ? m : 0}"${m === s.window ? ' selected' : ''}>${esc(C().compact(m))}</option>`;
  const select = `<select data-window>${s.windows.map(option).join('')}</select>`;
  const windows = s.windows.length > 1 ? `<label class="db-window">Measure from minute ${select}</label>` : '';
  const notes = s.notes.length ? `<ul class="db-notes">${s.notes.map(n => `<li data-note="${esc(n.id)}">${esc(n.text)}</li>`).join('')}</ul>` : '';
  return `<p class="db-identity">${esc(s.identity)}</p><p class="db-notice" role="note">${esc(s.notice)}</p>${notes}${windows}`;
 }
 function tiles(list: LWProcessDashboardModel.Tile[], name: string): string {
  const item = (t: LWProcessDashboardModel.Tile) => `<li class="db-tile${t.problem ? ' problem' : ''}" data-tile="${esc(t.id)}">`
   + `<span class="db-tile-label">${esc(t.label)}</span><strong class="db-tile-value">${esc(t.value)}</strong>`
   + `<span class="db-tile-line">${t.problem ? '<span aria-hidden="true">⚠ </span>' : ''}${esc(t.line)}</span>`
   + (t.spark && t.spark.length > 1 ? C().sparkline(t.spark, 96, 24, 'work') + `<span class="sr-only">${esc(t.trend)}</span>` : '') + '</li>';
  return `<ul class="db-tiles" aria-label="${esc(name)}">${list.map(item).join('')}</ul>`;
 }
 /**
  * One spreadsheet-safe CSV cell (the rule of the Activity export): RFC 4180 quoting of quotes, commas and line breaks, and a
  * leading apostrophe on text a spreadsheet would run as a formula (= + - @, tab or return first), such as a step or pool name.
  * A number or number range the dashboard formatted itself ("-8.7", "-67% to 149.9%") is left as it is.
  */
 const NUMERIC = /^[-+]?[\d.,]+%?( to [-+]?[\d.,]+%?)?$/;
 function quote(s: string): string {
  const safe = /^[=+\-@\t\r]/.test(s) && !NUMERIC.test(s) ? "'" + s : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
 }
 function csv(model: LWProcessDashboardModel.Model, extra: {section: string; panel: string; table: Table}[] = []): string {
  const panels = model.sections.flatMap(s => s.panels.filter(p => p.table).map(p => ({section: s.title, panel: p.title, table: p.table!})));
  const line = (cells: string[]) => cells.map(quote).join(',');
  const block = (b: {section: string; panel: string; table: Table}) =>
   [line([b.section, b.panel]), line([b.table.caption]), line(b.table.head), ...b.table.rows.map(line)].join('\n');
  return [line(['Dashboard', model.name, 'minute ' + model.minute]), ...[...panels, ...extra].map(block)].join('\n\n') + '\n';
 }
 root.LWProcessDashboardHtml = {strip, tiles, panel, table, csv, ROWS, TABLE_ROWS};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessDashboardHtml;
})(globalThis);
