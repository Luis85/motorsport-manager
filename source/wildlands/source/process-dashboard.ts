/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-dashboard-model.ts" />
/// <reference path="./process-dashboard-html.ts" />
/// <reference path="./process-dashboard-window.ts" />
/// <reference path="./process-dashboard-whatif-view.ts" />
/**
 * The per-process Dashboard view (LWProcessDashboard), the stage's `'dashboard'` view mode. It renders detached values only: the
 * studio's `LWProcessApp.View` plus, when the environment offers them, the read-only session reads `series`, `distributions` and
 * `recent`. It never ticks, never pauses or plays, holds no session and writes nothing to storage; choosing a step is an intent
 * handed to `onSelect` (the studio's `app.select`), and Escape or "Whole process" clears it as on the 2D map.
 *
 * Layout, overview first: the run identity and honesty strip, the KPI tiles, then sections with `h2` headings (flow over time,
 * where time goes, lead time, quality, cost, journey outcomes, or the selected step's focus instead of sections 3-6), What-if and
 * Data and export. Each panel is drawn by LWProcessDashboardHtml at its measured width (1:1 SVG, text in rem).
 *
 * Update cost: `draw` returns at once when nothing it shows changed (minute, status, selection, definition, draft flag, width,
 * expanded lists, window, target, phone layout); otherwise it rebuilds the pure model and replaces only the panels whose markup
 * changed, keeping keyboard focus on the same control or mark. It reads every size first (the root font, the region, What-if and
 * all panel slots) and only then writes markup, so a draw forces at most one layout. The series is fetched incrementally and
 * belongs to one run (LWProcessDashboardWindow.follow: definition revision and seed; a restart reads it again); distributions are
 * read only when finished counts, step starts, completions or entries change, recent cases only when finishes change. A shared
 * tooltip shows a mark's value on hover and focus; every value is also in the panel's data table. The CSV export names the process
 * and minute and goes through `save`.
 *
 * View values kept in memory only (never storage): "Measure from minute W" (`select[data-window]` in the strip; also What-if's
 * warm-up), the lead-time target (`select[data-target]`), expanded lists and open data tables, and on phones (650 px and below)
 * the collapsed sections. There every section (the model sections, What-if, Data and export) is a `details.db-fold` whose summary
 * is the section heading, open by default; the closed ones are remembered for the page session (across process switches) and
 * their panels are not redrawn until opened.
 *
 * Sticky run bar: where the dashboard scrolls with the page (narrow windows) the studio's run bar sticks over it. The bar's measured
 * bottom edge becomes the page's scroll padding while the dashboard is shown (`followStickyBar`, process-dashboard.css), so Tab or
 * Shift+Tab to a control, a heading scrolled into view and Fit to view stop below the bar, and a mark's tooltip opens below the mark
 * when above it would be under the bar.
 */
declare namespace LWProcessDashboard {
 interface Env {
  /** Selects a step (null: the whole process); the studio's command, never a tick. */
  onSelect(stepId: string | null): void;
  /** The studio's download helper. */
  save(name: string, data: string, type: string): void;
  /** Status line text after an export. */
  status(message: string): void;
  /** The unapplied draft text and whether it differs from the running definition, and its strict validation (What-if). */
  draft(): {text: string; changed: boolean};
  validate(text: string): LWProcess.Definition | null;
  /** Switches the stage to the Journey map (a view command). */
  showLens?(): void;
  /** Read-only session reads of the active run (research 4.6-4.8); each is optional until the engine provides it. */
  series?(after?: {level: number; count: number}): LWProcessDashboardData.Series | null;
  distributions?(): LWProcessDashboardData.Distributions | null;
  recent?(): readonly LWProcessDashboardData.FinishedCase[] | null;
 }
 interface Surface {
  draw(view: LWProcessApp.View): void;
  /** Scrolls the dashboard back to its top (Fit to view). */
  frame(): void;
  /** Moves focus to the dashboard region (the phone menu entry). */
  focus(): void;
  /** Drops cached data and cancels What-if (process switch, apply, import, reset); the next draw starts fresh. */
  reset(): void;
  dispose(): void;
 }
 interface Api {create(host: HTMLElement, env: Env): Surface}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessDashboardModel: LWProcessDashboardModel.Api; LWProcessDashboardHtml: LWProcessDashboardHtml.Api;
  LWProcessDashboardWhatIfView: LWProcessDashboardWhatIfView.Api; LWProcessTerms: LWProcessTerms.Api; LWProcessDashboardWindow: LWProcessDashboardWindow.Api;
  LWProcessDashboard?: LWProcessDashboard.Api};
 type View = LWProcessApp.View;
 type Data = LWProcessDashboardData.Input;
 type FocusKey = {selector: string; slot: string | null};
 const SKELETON = '<div class="db-strip" data-part="strip"></div><div data-part="tiles"></div><div data-part="sections"></div>'
  + '<section class="db-section db-data" aria-labelledby="db-s-data"><h2 id="db-s-data">Data and export</h2>'
  + '<p class="db-question">Every chart has its data table under "Data table". The download holds every panel table and the latest What-if '
  + 'results as CSV.</p><button type="button" data-csv>Download dashboard data (CSV)</button></section>'
  + '<div class="db-tip" aria-hidden="true" hidden></div>';
 /** Attributes that identify a focusable control across a redraw of its panel. */
 const FOCUS_ATTRS = ['data-select', 'data-more', 'data-tip', 'data-window', 'data-target', 'data-back', 'data-lens'];
 /** The phone layout, where every section folds into a disclosure. */
 const PHONE = '(max-width: 650px)';
 /**
  * Wraps a section's content in a `details.db-fold` whose summary holds the section heading (on), or puts it back (off). The
  * heading returns to its place: the section head of a model section, else the start of the section.
  */
 function fold(section: HTMLElement, on: boolean, open: boolean): void {
  const box = section.querySelector<HTMLDetailsElement>(':scope > details.db-fold'), id = section.getAttribute('aria-labelledby')!;
  if (on === !!box) return;
  const heading = section.querySelector<HTMLElement>(`#${CSS.escape(id)}`)!;
  if (on) {
   const details = document.createElement('details'), summary = document.createElement('summary');
   details.className = 'db-fold';
   details.dataset.fold = id;
   details.open = open;
   summary.append(heading);
   details.append(summary, ...section.childNodes);
   section.append(details);
   return;
  }
  const head = box!.querySelector<HTMLElement>(':scope > .db-section-head');
  box!.querySelector(':scope > summary')!.remove();
  section.append(...box!.childNodes);
  box!.remove();
  if (head) head.prepend(heading);
  else section.prepend(heading);
 }
 /**
  * Narrow windows: the dashboard scrolls with the page while the studio's run bar (`.process-toolbar`) sticks to its top. The bar's
  * measured bottom edge is published as `--db-sticky-top` on the document element (0px when the bar does not stick: desktop, Run
  * options open, a short window), and process-dashboard.css makes it the page's `scroll-padding-top` while the dashboard is shown,
  * so a focused control, a heading scrolled into view and Fit to view all stop below the bar. It follows the bar's size (wrapping,
  * root font, Run options) and the window size; `offset()` is the last value, and `dispose()` removes the listeners and the value.
  */
 function followStickyBar(host: HTMLElement): {offset(): number; dispose(): void} {
  const bar = host.closest('.process-studio')?.querySelector<HTMLElement>('.process-toolbar') ?? null, doc = document.documentElement;
  let px = 0, written = false;
  if (!bar) return {offset: () => 0, dispose() {}};
  const measure = () => {
   const style = getComputedStyle(bar);
   const next = style.position === 'sticky' ? Math.ceil((parseFloat(style.top) || 0) + bar.getBoundingClientRect().height) : 0;
   if (next === px && written) return;
   px = next;
   written = true;
   doc.style.setProperty('--db-sticky-top', `${px}px`);
  };
  const observer = new ResizeObserver(measure);
  observer.observe(bar);
  addEventListener('resize', measure);
  measure();
  return {
   offset: () => px,
   dispose() {
    observer.disconnect();
    removeEventListener('resize', measure);
    doc.style.removeProperty('--db-sticky-top');
   },
  };
 }
 function sectionMarkup(s: LWProcessDashboardModel.Section, lens: boolean): string {
  const back = s.id === 'focus' ? '<button type="button" data-back>Whole process</button>' : '';
  const map = s.id === 'journey' && lens ? '<button type="button" data-lens>Open the Journey map</button>' : '';
  const slots = s.panels.map(p => `<div class="db-slot" data-slot="${p.id}"></div>`).join('');
  return `<section class="db-section" data-section="${s.id}" aria-labelledby="db-s-${s.id}"><div class="db-section-head"><h2 id="db-s-${s.id}"></h2>`
   + `${back}${map}</div><div data-part="tiles-${s.id}"></div><div class="db-grid">${slots}</div></section>`;
 }
 function create(host: HTMLElement, env: LWProcessDashboard.Env): LWProcessDashboard.Surface {
  const M = root.LWProcessDashboardModel, H = root.LWProcessDashboardHtml;
  const region = document.createElement('div');
  region.className = 'process-dashboard';
  region.setAttribute('role', 'region');
  region.tabIndex = -1;
  region.innerHTML = SKELETON;
  host.append(region);
  const part = (name: string) => region.querySelector<HTMLElement>(`[data-part="${name}"]`)!, tip = region.querySelector<HTMLElement>('.db-tip')!;
  const whatif = root.LWProcessDashboardWhatIfView.create({draft: () => env.draft(), validate: text => env.validate(text)});
  region.insertBefore(whatif.element, region.querySelector('.db-data'));
  const sticky = followStickyBar(host);
  let last: View | null = null, model: LWProcessDashboardModel.Model | null = null, signature = '', layout = '', windowAt = 0, width = 0, drawnRem = 0;
  let expanded = new Set<string>(), distKey = '', recentKey = '', targetAt: number | null = null, phoneAt: boolean | null = null;
  let data: Pick<Data, 'series' | 'distributions' | 'recent'> = {series: null, distributions: null, recent: null};
  let cache: LWProcessDashboardWindow.Cache = {run: '', series: null};
  /** Ids (`aria-labelledby`) of the sections closed on a phone; kept for the page session. */
  const folded = new Set<string>(), narrow = matchMedia(PHONE);
  /** Replaces a node's markup only when it changed (the studio's setHtml diff). */
  function setHtml(node: HTMLElement, html: string): void {
   if (node.dataset.html === html) return;
   node.dataset.html = html;
   node.innerHTML = html;
  }
  const remPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  /**
   * Reads the optional session data of the view's run: the series incrementally, distributions and recent cases only when the counts
   * they follow changed. Keys carry the run identity, so another seed or revision with equal counts still reads again.
   */
  function readData(view: View): void {
   const q = view.snapshot, run = root.LWProcessDashboardWindow.run(view), series = env.series;
   if (series) {
    cache = root.LWProcessDashboardWindow.follow(cache, run, after => series(after));
    data.series = cache.series;
   }
   const key = [run, q.metrics.completed, q.metrics.failed, ...q.steps.map(s => `${s.starts}:${s.completed}:${s.entered}`)].join(',');
   if (env.distributions && key !== distKey) {
    distKey = key;
    data.distributions = env.distributions();
   }
   const finished = `${run},${q.metrics.completed + q.metrics.failed}`;
   if (env.recent && finished !== recentKey) {
    recentKey = finished;
    data.recent = env.recent();
   }
  }
  /** The focused control, as a selector that finds it again after its markup is replaced. */
  function focusKey(): FocusKey | null {
   const a = document.activeElement as HTMLElement | null;
   if (!a || !region.contains(a) || whatif.element.contains(a)) return null;
   const slot = a.closest<HTMLElement>('[data-slot]')?.dataset.slot ?? null;
   for (const attr of FOCUS_ATTRS) {
    const v = a.getAttribute(attr);
    if (v !== null) return {selector: `[${attr}="${CSS.escape(v)}"]`, slot};
   }
   const box = a.matches('summary') ? a.parentElement as HTMLElement : null;
   if (box?.dataset.fold) return {selector: `[data-fold="${CSS.escape(box.dataset.fold)}"] > summary`, slot: null};
   if (a.matches('summary')) return {selector: 'summary', slot};
   return a.classList.contains('db-scroll') ? {selector: '.db-scroll', slot} : null;
  }
  function restore(key: FocusKey | null): void {
   if (!key || region.contains(document.activeElement) && document.activeElement !== document.body) return;
   const scope = key.slot ? region.querySelector<HTMLElement>(`[data-slot="${CSS.escape(key.slot)}"]`) : region;
   scope?.querySelector<HTMLElement>(key.selector)?.focus({preventScroll: true});
  }
  function render(view: View, force: boolean): void {
   // Sizes are read before any markup is written: a read after a write would force a layout for every panel.
   const rem = remPx(), w = region.clientWidth, side = whatif.element.clientWidth, phone = narrow.matches;
   const d = view.definition, q = view.snapshot, draft = env.draft().changed;
   const parts = [q.minute, q.status, q.seed, view.selected, d.id, d.revision, d.name, draft, w, rem, windowAt, targetAt, [...expanded].join(','),
    view.playing, phone, [...folded].join(',')];
   if (force || parts.join('|') !== signature) {
    signature = parts.join('|');
    width = w;
    drawnRem = rem;
    readData(view);
    const key = focusKey();
    model = M.build({view, ...data, draft, window: windowAt, target: targetAt});
    paint(model, rem, phone, d);
    restore(key);
   }
   // What-if follows the draft, the run seed and the measuring start even when nothing the panels show has changed.
   whatif.sync(view, Math.max(160, side - 2 * rem), rem, model?.strip.window ?? 0);
  }
  /** Writes the model: the section layout when its shape changed (one layout read follows), then strip, tiles and changed panels. */
  function paint(m: LWProcessDashboardModel.Model, rem: number, phone: boolean, d: LWProcess.Definition): void {
   const shape = phone + ';' + m.sections.map(s => s.id + ':' + s.panels.map(p => p.id).join(',')).join(';'), holder = part('sections');
   const open = (el: HTMLElement) => !folded.has(el.getAttribute('aria-labelledby')!);
   if (shape !== layout) {
    layout = shape;
    holder.innerHTML = m.sections.map(s => sectionMarkup(s, !!env.showLens)).join('');
    for (const el of holder.querySelectorAll<HTMLElement>(':scope > .db-section')) fold(el, phone, open(el));
   }
   if (phone !== phoneAt) {
    phoneAt = phone;
    for (const el of [whatif.element, region.querySelector<HTMLElement>('.db-data')!]) fold(el, phone, open(el));
   }
   // Panels of a closed section keep their markup and are drawn again when it opens.
   const shown = m.sections.filter(s => !(phone && folded.has('db-s-' + s.id)));
   const slots = shown.flatMap(s => s.panels.map(p => ({p, el: holder.querySelector<HTMLElement>(`[data-slot="${CSS.escape(p.id)}"]`)!})));
   const widths = slots.map(x => x.el.clientWidth);
   region.setAttribute('aria-label', `${d.name} dashboard`);
   setHtml(part('strip'), H.strip(m.strip));
   setHtml(part('tiles'), H.tiles(m.tiles, root.LWProcessTerms.of(d).journey ? 'Journey key figures' : 'Key figures'));
   for (const s of m.sections) {
    const title = holder.querySelector<HTMLElement>(`#db-s-${s.id}`)!;
    if (title.textContent !== s.title) title.textContent = s.title;
    setHtml(holder.querySelector<HTMLElement>(`[data-part="tiles-${s.id}"]`)!, s.tiles?.length ? H.tiles(s.tiles, s.title) : '');
   }
   slots.forEach(({p, el}, i) => setHtml(el, H.panel(p, {width: Math.max(160, widths[i]! - 2 * rem), rem, expanded})));
  }
  function draw(view: View): void {
   last = view;
   render(view, false);
  }
  const redraw = () => { if (last) render(last, true); };
  function showTip(target: Element | null): void {
   const text = target?.getAttribute('data-tip');
   if (!target || !text) { tip.hidden = true; return; }
   const box = target.getBoundingClientRect(), base = region.getBoundingClientRect();
   tip.textContent = text;
   tip.hidden = false;
   const left = Math.min(box.left - base.left + box.width / 2 - tip.offsetWidth / 2, region.clientWidth - tip.offsetWidth);
   tip.style.left = `${Math.max(0, left)}px`;
   // Above the mark, unless that would put it under the sticky run bar: then below it.
   const above = box.top - tip.offsetHeight - 6 >= sticky.offset();
   tip.style.top = `${above ? Math.max(0, box.top - base.top - tip.offsetHeight - 6) : box.bottom - base.top + 6}px`;
  }
  const hideTip = () => { tip.hidden = true; };
  region.addEventListener('pointerover', e => showTip((e.target as Element).closest('[data-tip]')));
  region.addEventListener('pointerleave', hideTip);
  region.addEventListener('focusin', e => showTip((e.target as Element).closest('[data-tip]')));
  region.addEventListener('focusout', hideTip);
  function download(): void {
   if (!model || !last) return;
   const extra = whatif.table(), csv = H.csv(model, extra ? [{section: 'What-if', panel: 'Replications', table: extra}] : []);
   const name = `${last.definition.id}-dashboard-minute-${last.snapshot.minute}.csv`;
   env.save(name, csv, 'text/csv');
   env.status(`Dashboard data downloaded as ${name}.`);
  }
  region.addEventListener('click', e => {
   const t = e.target as Element, select = t.closest<HTMLElement>('[data-select]'), more = t.closest<HTMLElement>('[data-more]');
   if (select) env.onSelect(select.dataset.select!);
   else if (more) {
    const id = more.dataset.more!;
    if (!expanded.delete(id)) expanded.add(id);
    redraw();
   } else if (t.closest('[data-back]')) env.onSelect(null);
   else if (t.closest('[data-lens]')) env.showLens?.();
   else if (t.closest('[data-csv]')) download();
  });
  // A data table's disclosure keeps its open state across redraws, as the `<panel id>-open` entry of the expanded set; a phone
  // section's disclosure keeps its state in `folded`, and opening one draws its panels at their width.
  region.addEventListener('toggle', e => {
   const d = e.target as HTMLDetailsElement, slot = d.closest<HTMLElement>('[data-slot]'), section = d.dataset.fold;
   if (section) {
    if (d.open !== folded.has(section)) return;
    if (d.open) folded.delete(section);
    else folded.add(section);
    redraw();
    return;
   }
   if (!slot || !d.matches('.db-table')) return;
   const id = slot.dataset.slot + '-open';
   if (d.open === expanded.has(id)) return;
   if (d.open) expanded.add(id);
   else expanded.delete(id);
   slot.dataset.html = '';
   signature = '';
  }, true);
  region.addEventListener('change', e => {
   const t = e.target as HTMLSelectElement;
   if (t.matches('[data-window]')) windowAt = Number(t.value) || 0;
   else if (t.matches('[data-target]')) targetAt = t.value === '' ? null : Number(t.value);
   else return;
   redraw();
  });
  // Escape in a form field keeps the selection; elsewhere it bubbles to the stage, which returns to the whole process.
  region.addEventListener('keydown', e => {
   if (e.key === 'Escape' && (e.target as Element).matches('input, select, textarea')) e.preventDefault();
  });
  // A new width or root font size redraws the charts at their new pixel size (they are drawn 1:1, never scaled).
  const resize = new ResizeObserver(() => {
   if (last && (Math.abs(region.clientWidth - width) > 1 || remPx() !== drawnRem)) requestAnimationFrame(redraw);
  });
  resize.observe(region);
  return {
   draw,
   frame() {
    host.scrollTop = 0;
    if (region.getBoundingClientRect().top < sticky.offset()) region.scrollIntoView({block: 'start'});
   },
   focus() { region.focus(); },
   reset() {
    whatif.reset();
    data = {series: null, distributions: null, recent: null};
    cache = {run: '', series: null};
    distKey = '';
    recentKey = '';
    targetAt = null;
    signature = '';
    layout = '';
    windowAt = 0;
    model = null;
    expanded = new Set();
    part('sections').innerHTML = '';
    hideTip();
   },
   dispose() {
    resize.disconnect();
    sticky.dispose();
    whatif.dispose();
    region.remove();
    last = null;
   },
  };
 }
 root.LWProcessDashboard = {create};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessDashboard;
})(globalThis);
