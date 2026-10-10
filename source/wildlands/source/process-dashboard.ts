/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-dashboard-model.ts" />
/// <reference path="./process-dashboard-html.ts" />
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
 * expanded lists); otherwise it rebuilds the pure model and replaces only the panels whose markup changed, keeping keyboard focus
 * on the same control or mark. The series is fetched incrementally (`series({level, count})`), distributions only when finished
 * counts or step starts change, recent cases only when finishes change. A shared tooltip shows a mark's value on hover and focus;
 * every value is also in the panel's data table. The CSV export names the process and minute and goes through `save`.
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
  LWProcessDashboardWhatIfView: LWProcessDashboardWhatIfView.Api; LWProcessTerms: LWProcessTerms.Api; LWProcessDashboard?: LWProcessDashboard.Api};
 type View = LWProcessApp.View;
 type Data = LWProcessDashboardData.Input;
 type FocusKey = {selector: string; slot: string | null};
 const SKELETON = '<div class="db-strip" data-part="strip"></div><div data-part="tiles"></div><div data-part="sections"></div>'
  + '<section class="db-section db-data" aria-labelledby="db-s-data"><h2 id="db-s-data">Data and export</h2>'
  + '<p class="db-question">Every chart has its data table under "Data table". The download holds every panel table and the latest What-if '
  + 'results as CSV.</p><button type="button" data-csv>Download dashboard data (CSV)</button></section>'
  + '<div class="db-tip" aria-hidden="true" hidden></div>';
 /** Attributes that identify a focusable control across a redraw of its panel. */
 const FOCUS_ATTRS = ['data-select', 'data-more', 'data-tip', 'data-window', 'data-back', 'data-lens'];
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
  let last: View | null = null, model: LWProcessDashboardModel.Model | null = null, signature = '', layout = '', windowAt = 0, width = 0;
  let expanded = new Set<string>(), distKey = '', recentKey = -1;
  let data: Pick<Data, 'series' | 'distributions' | 'recent'> = {series: null, distributions: null, recent: null};
  /** Replaces a node's markup only when it changed (the studio's setHtml diff). */
  function setHtml(node: HTMLElement, html: string): void {
   if (node.dataset.html === html) return;
   node.dataset.html = html;
   node.innerHTML = html;
  }
  const remPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  /** Reads the optional session data: the series incrementally, distributions and recent cases only when their counts changed. */
  function readData(q: LWProcess.Snapshot): void {
   if (env.series) {
    const s = data.series, next = env.series(s ? {level: s.level, count: s.minutes.length} : undefined);
    data.series = next ? M.util.merge(s ?? null, next) : null;
   }
   const key = [q.metrics.completed, q.metrics.failed, ...q.steps.map(s => s.starts + ':' + s.completed)].join(',');
   if (env.distributions && key !== distKey) {
    distKey = key;
    data.distributions = env.distributions();
   }
   const finished = q.metrics.completed + q.metrics.failed;
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
   if (a.matches('summary')) return {selector: 'summary', slot};
   return a.classList.contains('db-scroll') ? {selector: '.db-scroll', slot} : null;
  }
  function restore(key: FocusKey | null): void {
   if (!key || region.contains(document.activeElement) && document.activeElement !== document.body) return;
   const scope = key.slot ? region.querySelector<HTMLElement>(`[data-slot="${CSS.escape(key.slot)}"]`) : region;
   scope?.querySelector<HTMLElement>(key.selector)?.focus({preventScroll: true});
  }
  function render(view: View, force: boolean): void {
   const rem = remPx(), w = region.clientWidth, d = view.definition, q = view.snapshot, draft = env.draft().changed;
   // What-if follows the draft and the run seed even when nothing the panels show has changed.
   whatif.sync(view, Math.max(160, whatif.element.clientWidth - 2 * rem), rem);
   const parts = [q.minute, q.status, q.seed, view.selected, d.id, d.revision, d.name, draft, w, rem, windowAt, [...expanded].join(','), view.playing];
   if (!force && parts.join('|') === signature) return;
   signature = parts.join('|');
   width = w;
   readData(q);
   const key = focusKey();
   model = M.build({view, ...data, draft, window: windowAt});
   region.setAttribute('aria-label', `${d.name} dashboard`);
   setHtml(part('strip'), H.strip(model.strip));
   setHtml(part('tiles'), H.tiles(model.tiles, root.LWProcessTerms.of(d).journey ? 'Journey key figures' : 'Key figures'));
   const shape = model.sections.map(s => s.id + ':' + s.panels.map(p => p.id).join(',')).join(';'), holder = part('sections');
   if (shape !== layout) {
    layout = shape;
    holder.innerHTML = model.sections.map(s => sectionMarkup(s, !!env.showLens)).join('');
   }
   for (const s of model.sections) {
    holder.querySelector(`#db-s-${s.id}`)!.textContent = s.title;
    setHtml(holder.querySelector<HTMLElement>(`[data-part="tiles-${s.id}"]`)!, s.tiles?.length ? H.tiles(s.tiles, s.title) : '');
    for (const p of s.panels) {
     const slot = holder.querySelector<HTMLElement>(`[data-slot="${CSS.escape(p.id)}"]`)!;
     setHtml(slot, H.panel(p, {width: Math.max(160, slot.clientWidth - 2 * rem), rem, expanded}));
    }
   }
   restore(key);
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
   tip.style.top = `${Math.max(0, box.top - base.top - tip.offsetHeight - 6)}px`;
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
  // A data table's disclosure keeps its open state across redraws, as the `<panel id>-open` entry of the expanded set.
  region.addEventListener('toggle', e => {
   const d = e.target as HTMLDetailsElement, slot = d.closest<HTMLElement>('[data-slot]');
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
   if (!t.matches('[data-window]')) return;
   windowAt = Number(t.value) || 0;
   redraw();
  });
  // Escape in a form field keeps the selection; elsewhere it bubbles to the stage, which returns to the whole process.
  region.addEventListener('keydown', e => {
   if (e.key === 'Escape' && (e.target as Element).matches('input, select, textarea')) e.preventDefault();
  });
  const resize = new ResizeObserver(() => { if (last && Math.abs(region.clientWidth - width) > 1) requestAnimationFrame(redraw); });
  resize.observe(region);
  return {
   draw,
   frame() {
    host.scrollTop = 0;
    if (region.getBoundingClientRect().top < 0) region.scrollIntoView({block: 'start'});
   },
   focus() { region.focus(); },
   reset() {
    whatif.reset();
    data = {series: null, distributions: null, recent: null};
    distKey = '';
    recentKey = -1;
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
    whatif.dispose();
    region.remove();
    last = null;
   },
  };
 }
 root.LWProcessDashboard = {create};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessDashboard;
})(globalThis);
