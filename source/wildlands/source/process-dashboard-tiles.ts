/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-dashboard-model.ts" />
/// <reference path="./process-dashboard-window.ts" />
/**
 * Dashboard section 1, the KPI tiles (LWProcessDashboardTiles): in progress, finished, lead time (time to outcome for journeys),
 * oldest open, busiest pool, cost per finished case, problems and conversion, each with a value, one comparison line in words and,
 * for in progress and finished, a sparkline of the sampled history with its trend in words. Pure view-models over the detached view
 * and the optional read model; helpers come from LWProcessDashboardModel.util. No DOM, session, clock or storage.
 *
 * Rules: an undefined value reads '—' with its reason (no lead time before the first finish, no utilisation at minute 0); lead time
 * is the median and 85th percentile from 10 finished cases, exact ('median 37 min') when the read model kept every lead time and
 * otherwise the bracket of the whole-run histogram bin ('median 20–50 min'), else the mean; problem tiles carry
 * the word and a glyph, never colour alone; journeys lead with conversion and drop the pool and cost tiles when nothing uses them.
 * With a window (LWProcessDashboardWindow) the lines of in progress, finished, lead time and cost add the window's exact figures
 * with its label, and the busiest pool is the busiest over the window, its value that utilisation.
 */
declare namespace LWProcessDashboardTiles {
 interface Api {tiles(input: LWProcessDashboardData.Input): LWProcessDashboardModel.Tile[]}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessDashboardModel: LWProcessDashboardModel.Api; LWProcessDashboardWindow: LWProcessDashboardWindow.Api;
  LWProcessTime: LWProcessTime.Api; LWProcessTerms: LWProcessTerms.Api; LWProcessDashboardTiles?: LWProcessDashboardTiles.Api};
 type Input = LWProcessDashboardData.Input;
 type Tile = LWProcessDashboardModel.Tile;
 type Series = LWProcessDashboardData.Series;
 type Metrics = LWProcess.Snapshot['metrics'] & LWProcessDashboardData.Metrics;
 const u = () => root.LWProcessDashboardModel.util, time = () => root.LWProcessTime;
 const number = (n: number) => u().number(n);
 const minutes = (n: number, d: LWProcess.Definition) => u().minutes(n, d);
 const plural = (n: number, one: string, many?: string) => u().plural(n, one, many);
 const rank = (counts: readonly number[], q: number) => u().rank(counts, q);
 const bin = (edges: readonly number[], i: number) => u().bin(edges, i);
 const state = (t: LWProcess.Token) => u().state(t);
 /** Whole-run cycle bins: the fine distribution when present, else the snapshot's 1-2-5 histogram. */
 function cycleBins(input: Input): {edges: number[]; counts: number[]} {
  const fine = input.distributions;
  return fine && fine.cycle.length ? {edges: fine.edges, counts: fine.cycle} : input.view.snapshot.metrics.cycleHistogram;
 }
 /** A monotone run rule over the last intervals: 'rising over the last 4 intervals', 'falling …' or 'steady …'. */
 function trend(values: number[]): string {
  if (values.length < 3) return '';
  const diffs = values.slice(1).map((v, i) => Math.sign(v - values[i]!)), last = diffs.at(-1)!;
  let run = 0;
  for (let i = diffs.length - 1; i >= 0 && diffs[i] === last; i--) run++;
  return last === 0 || run < 2 ? 'steady over the last intervals' : `${last > 0 ? 'rising' : 'falling'} over the last ${run} intervals`;
 }
 const tile = (id: string, label: string, value: string, line: string, extra: Partial<Tile> = {}): Tile =>
  ({id, label, value, line, problem: false, spark: null, trend: '', ...extra});
 /** The tiles' shared context: the view, its terms and the series when it has two samples. */
 interface Ctx {
  d: LWProcess.Definition; q: LWProcess.Snapshot; m: Metrics; terms: LWProcessTerms.Terms; s: Series | null; input: Input;
  /** The window's totals, or null for the whole run. */
  w: LWProcessDashboardWindow.Window | null;
 }
 const label = (w: LWProcessDashboardWindow.Window) => root.LWProcessDashboardWindow.label(w);
 function active({d, q, m, terms, s, w}: Ctx): Tile {
  const wip = s ? s.run.wip.slice(-12) : null;
  let overRun = m.wipArea !== undefined && q.minute > 0 ? ` · mean over the run ${number(m.wipArea / q.minute)}` : '';
  if (w && w.minutes > 0) overRun = ` · mean ${number(w.wipArea / w.minutes)} ${label(w)}`;
  const line = m.meanAgeMinutes === null ? `no open ${terms.many}` : `mean age ${minutes(m.meanAgeMinutes, d)}${overRun}`;
  return tile('active', 'In progress', number(m.active), line, {spark: wip, trend: wip ? 'In progress is ' + trend(wip) : ''});
 }
 function finished({m, terms, s, w}: Ctx): Tile {
  const done = s ? s.run.completed.slice(1).map((v, i) => v - s.run.completed[i]!).slice(-12) : null;
  const rate = m.throughputPerHour === null ? '—' : number(m.throughputPerHour);
  let line = `${rate} per hour · ${number(m.arrived)} arrived`;
  if (w && w.minutes > 0) {
   line = `${number(w.completed * 60 / w.minutes)} per hour ${label(w)} · ${number(w.completed)} finished and ${number(w.arrived)} arrived in it`;
  }
  return tile('finished', terms.finished, number(m.completed), line, {spark: done, trend: done ? 'Finishes per interval are ' + trend(done) : ''});
 }
 function lead({d, m, terms, input, w}: Ctx): Tile {
  const name = terms.journey ? 'Time to outcome' : 'Lead time', bins = cycleBins(input), median = rank(bins.counts, 50), p85 = rank(bins.counts, 85);
  if (!m.completed) return tile('lead', name, '—', `No ${terms.one} has finished yet`);
  let open = m.active ? ` · ${time().number(m.active)} open` : '';
  if (w && w.completed) open += ` · mean ${minutes(w.cycleSum / w.completed, d)} for ${terms.many} finished ${label(w)}`;
  if (m.completed < 10 || median === null || p85 === null) {
   return tile('lead', name, minutes(m.meanCycleMinutes, d), `mean of ${plural(m.completed, terms.one, terms.many)}${open}`);
  }
  // Exact values when the read model's percentiles hold every lead time of these bins (LWProcessLedgerExact), else bin brackets.
  const set = input.distributions?.cycle.length ? input.distributions.percentiles?.cycle : undefined;
  const exact = set?.exact && set.n === bins.counts.reduce((a, b) => a + b, 0) ? set.points : [];
  const at = (q: number, i: number) => {
   const point = exact.find(p => p.q === q);
   return point?.exact ? `${time().number(point.value)} min` : bin(bins.edges, i);
  };
  return tile('lead', name, 'median ' + at(50, median), `85th percentile ${at(85, p85)} · mean ${minutes(m.meanCycleMinutes, d)}${open}`);
 }
 function oldest({d, q}: Ctx): Tile | null {
  const open = q.cases.filter(c => c.status === 'active');
  if (!open.length) return null;
  const first = open.reduce((a, c) => c.entered < a.entered ? c : a), names = new Map(d.steps.map(st => [st.id, st.name]));
  const at = [...new Set(q.tokens.filter(t => t.caseId === first.id && state(t)).map(t => names.get(t.stepId) ?? t.stepId))];
  return tile('oldest', 'Oldest open', minutes(q.minute - first.entered, d), at.length ? 'at ' + at.join(', ') : 'between steps');
 }
 function pool({d, q, w}: Ctx): Tile | null {
  const demanded = new Set(d.steps.flatMap(st => Object.keys(st.resources ?? {}))), pools = q.resources.filter(p => demanded.has(p.id));
  if (!pools.length) return null;
  // With a window the busiest pool is the one with the highest utilisation over the window, and the value is that share.
  const use = (p: LWProcess.PoolMetric) => w ? root.LWProcessDashboardWindow.utilization(w, p.id, p.capacity) ?? 0 : p.utilization;
  const top = pools.reduce((a, p) => use(p) > use(a) ? p : a), name = d.resources.find(r => r.id === top.id)?.name ?? top.id;
  const idle = q.minute === 0, over = w ? ` · average ${label(w)}` : '';
  return tile('pool', 'Busiest pool', idle ? '—' : `${Math.round(use(top) * 100)}%`,
   `${name}${over} · busy now ${top.busy} of ${top.capacity}${idle ? ' · no time simulated yet' : ''}`);
 }
 function cost({d, m, terms, w}: Ctx): Tile | null {
  if (!d.resources.some(r => r.costPerMinute > 0) && !d.steps.some(st => (st.cost ?? 0) > 0)) return null;
  const name = `Cost per ${terms.finished.toLowerCase()} ${terms.one}`;
  if (!m.completed) return tile('cost', name, '—', `No ${terms.one} has finished yet`);
  const capacity = number(m.capacityCost / m.completed);
  // The window has no attributed costs: its figure is the work cost in the window ÷ finishes in it, open work included.
  const windowed = w && w.completed ? ` · ${label(w)}: work cost ÷ finished ${number(w.cost / w.completed)}, open work included` : '';
  if (m.costOf) {
   const line = `work cost of finished ${terms.many} · capacity ÷ finished ${capacity}${windowed}`;
   return tile('cost', name, number(m.costOf.completed / m.completed), line);
  }
  const line = `work cost so far ÷ finished, open work included · capacity ÷ finished ${capacity}${windowed}`;
  return tile('cost', name, number(m.cost / m.completed), line);
 }
 function problems({q, m}: Ctx): Tile | null {
  const held = q.steps.reduce((sum, st) => sum + st.held, 0), interrupted = q.steps.reduce((sum, st) => sum + (st.deadlines?.interrupted ?? 0), 0);
  const list = ([[m.failed, 'failed'], [m.dropped, 'dropped'], [held, 'blocked now'], [interrupted, 'deadline interruptions']] as const).filter(([n]) => n > 0);
  if (!list.length) return null;
  const total = list.reduce((a, [n]) => a + n, 0);
  return tile('problems', 'Problems', number(total), list.map(([n, w]) => `${number(n)} ${w}`).join(' · '), {problem: true});
 }
 function conversion({d, m}: Ctx): Tile | null {
  if (!d.steps.some(st => st.kind === 'end' && st.outcome)) return null;
  const n = m.goals + m.lost, value = m.conversion === null ? '—' : n < 10 ? `${number(m.goals)} of ${number(n)} decided` : `${m.conversion / 10}%`;
  return tile('conversion', 'Conversion', value, n ? `goals ${number(m.goals)} · lost ${number(m.lost)}` : 'no outcome reached yet');
 }
 function tiles(input: Input): Tile[] {
  const {definition: d, snapshot: q} = input.view, terms = root.LWProcessTerms.of(d), s = input.series && input.series.minutes.length > 1 ? input.series : null;
  const ctx: Ctx = {d, q, m: q.metrics as Metrics, terms, s, input, w: root.LWProcessDashboardWindow.of(input)};
  const build = {active, finished, lead, oldest, pool, cost, problems, conversion};
  // Journeys lead with conversion and drop the capacity and cost tiles when nothing uses them (each builder returns null then).
  const ids = terms.journey ? ['conversion', 'active', 'finished', 'lead', 'problems', 'oldest', 'pool', 'cost'] as const
   : ['active', 'finished', 'lead', 'oldest', 'pool', 'cost', 'problems', 'conversion'] as const;
  return ids.map(id => build[id](ctx)).filter((t): t is Tile => !!t);
 }
 root.LWProcessDashboardTiles = {tiles};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessDashboardTiles;
})(globalThis);
