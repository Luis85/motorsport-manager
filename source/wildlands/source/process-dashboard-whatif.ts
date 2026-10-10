/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-html.ts" />
/// <reference path="./process-replicate.ts" />
/// <reference path="./process-chart.ts" />
/// <reference path="./process-dashboard-model.ts" />
/**
 * The What-if model of the Dashboard (LWProcessDashboardWhatIf), also the studio's "Run N seeds" summary: bounded inputs and their
 * plain validation, the replication plan line, and the results of an LWProcessReplicate report (spread of the applied design) or
 * comparison (applied against the unapplied draft) as rows, sentences, dot-interval markup and a table. Pure: no DOM, session,
 * clock or storage; it never runs a replication itself (LWProcessDashboardWhatIfView owns the runner).
 *
 * Bounds: 2 to 50 runs; 1 minute up to the run length (100,000 without one); a first seed from 0 with every seed at most
 * 2,147,483,647; and at most 1,000,000 simulated minutes per plan (runs × minutes, twice for a comparison), LWProcessReplicate's
 * own limit. A comparison needs a draft that differs from the running definition and is valid. Utilisation reads as a percentage
 * and conversion (permille in the report) as a percentage; the difference is applied minus draft, worded from the draft's side, and
 * "no clear difference" when its 95% interval contains 0. Results always carry the honesty text: spread under the authored
 * assumptions, from runs that start empty, never a forecast. When every seed gave the same values (`flat`) no intervals are drawn:
 * a design without random behaviour says so, and a random design (`random`, from the runner) says its draws did not change the
 * measures in that run length, never that it has no random behaviour. Each dot-interval row has its own scale, and the caption says so.
 *
 * Warm-up: `warmup` is the dashboard's "Measure from minute W" (0 or absent: none). It must be less than the minutes per run; the
 * replications then report, besides the whole-run measures, the measures labelled "after minute W" (LWProcessReplicate `warmup`),
 * and the plan line and the honesty text say which measures leave out start-up.
 */
declare namespace LWProcessDashboardWhatIf {
 type Mode = 'spread' | 'compare';
 interface Inputs {
  mode: Mode; runs: number; minutes: number; seed: number;
  /** The measuring start W used as each run's warm-up (0 or absent: none). */
  warmup?: number;
 }
 interface Draft {changed: boolean; valid: boolean}
 interface Check {ok: boolean; problems: string[]; plan: string; advice: string}
 interface Kpi {id: string; label: string; n: number; mean: string; ci: string; spread: string; sentence: string; interval: LWProcessChart.Interval | null}
 interface Result {
  kind: Mode; complete: boolean; done: number; runs: number; minutes: number; seeds: number[]; kpis: Kpi[];
  honesty: string; status: string;
  /** Every run gave the same values: there is no spread to draw. */
  flat: boolean;
  /**
   * The design draws at random. A flat result of such a design means its draws did not change these measures within the minutes
   * run, not that the process has no random behaviour, and is worded so.
   */
  random: boolean;
 }
 interface Limits {readonly runsMin: number; readonly runsMax: number; readonly minutes: number; readonly work: number; readonly seed: number}
 interface Api {
  readonly LIMITS: Limits;
  defaults(view: LWProcessApp.View): Inputs;
  /** The longest run the inputs allow: the run length, or 100,000 minutes without one. */
  maxMinutes(view: LWProcessApp.View): number;
  /** Why a comparison cannot run, or null when it can. */
  compareReason(draft: Draft): string | null;
  check(inputs: Inputs, view: LWProcessApp.View, draft: Draft): Check;
  result(report: LWProcessReplicate.Report | LWProcessReplicate.Comparison, done: number, random?: boolean): Result;
  /** The results as markup: honesty text, one dot-interval chart per KPI and the table (`rem` in px, `width` of the panel). */
  markup(result: Result, width: number, rem: number): string;
  table(result: Result): LWProcessDashboardModel.Table;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessDashboardModel: LWProcessDashboardModel.Api; LWProcessChart: LWProcessChart.Api; LWProcessHtml: LWProcessHtml.Api;
  LWProcessDashboardHtml: LWProcessDashboardHtml.Api; LWProcessDashboardWhatIf?: LWProcessDashboardWhatIf.Api};
 type Inputs = LWProcessDashboardWhatIf.Inputs;
 type Result = LWProcessDashboardWhatIf.Result;
 type Stats = LWProcessReplicate.Stats;
 const LIMITS = Object.freeze({runsMin: 2, runsMax: 50, minutes: 100000, work: 1000000, seed: 2147483647});
 const u = () => root.LWProcessDashboardModel.util;
 const whole = (v: number, lo: number, hi: number) => Number.isSafeInteger(v) && v >= lo && v <= hi;
 const maxMinutes = (view: LWProcessApp.View) => Math.min(LIMITS.minutes, view.horizon ?? LIMITS.minutes);
 function defaults(view: LWProcessApp.View): Inputs {
  const T = view.snapshot.minute, max = maxMinutes(view);
  return {mode: 'spread', runs: 20, minutes: Math.min(max, T > 0 ? T : max), seed: view.snapshot.seed};
 }
 function compareReason(draft: LWProcessDashboardWhatIf.Draft): string | null {
  if (!draft.changed) return 'The draft holds the running definition, so there is nothing to compare. Edit the process to compare a change.';
  return draft.valid ? null : 'Fix the draft before comparing: it is not a valid definition yet.';
 }
 function check(i: Inputs, view: LWProcessApp.View, draft: LWProcessDashboardWhatIf.Draft): LWProcessDashboardWhatIf.Check {
  const U = u(), problems: string[] = [], max = maxMinutes(view), work = i.mode === 'compare' ? 2 : 1, last = i.seed + i.runs - 1;
  if (!whole(i.runs, LIMITS.runsMin, LIMITS.runsMax)) problems.push(`Runs must be a whole number from ${LIMITS.runsMin} to ${LIMITS.runsMax}.`);
  const length = view.horizon === null ? '' : ' (the run length)';
  if (!whole(i.minutes, 1, max)) problems.push(`Minutes per run must be a whole number from 1 to ${U.count(max)}${length}.`);
  if (!whole(i.seed, 0, LIMITS.seed)) problems.push(`The first seed must be a whole number from 0 to ${U.count(LIMITS.seed)}.`);
  else if (whole(i.runs, 1, LIMITS.runsMax) && last > LIMITS.seed) problems.push(`Seeds ${i.seed} to ${last} pass the largest seed, ${U.count(LIMITS.seed)}.`);
  const total = i.runs * i.minutes * work;
  if (!problems.length && total > LIMITS.work) {
   problems.push(`This plan simulates ${U.count(total)} minutes; the limit is ${U.count(LIMITS.work)}. Lower the runs or the minutes.`);
  }
  const warm = i.warmup ?? 0;
  if (warm > 0 && whole(i.minutes, 1, max) && i.minutes <= warm) {
   problems.push(`Minutes per run must be more than the measuring start, minute ${U.count(warm)}, which is each run's warm-up.`);
  }
  const why = i.mode === 'compare' ? compareReason(draft) : null;
  if (why) problems.push(why);
  const designs = work === 2 ? ' × 2 designs' : '';
  const warmup = warm > 0 ? ` Measures labelled "after minute ${U.count(warm)}" leave out each run's first ${U.count(warm)} minutes (warm-up).` : '';
  const plan = problems.length ? '' : `Seeds ${i.seed} to ${last} · ${i.runs} × ${U.count(i.minutes)} minutes${designs} = `
   + `${U.count(total)} of at most ${U.count(LIMITS.work)} simulated minutes.${warmup}`;
  const advice = whole(i.runs, LIMITS.runsMin, 9) ? 'Intervals are wide with few runs.' : '';
  return {ok: !problems.length, problems, plan, advice};
 }
 /** Display of a KPI value: utilisation as a percentage, conversion from permille to a percentage, others with 3 significant digits. */
 function show(id: string, v: number | null): string {
  if (v === null) return '—';
  if (id.startsWith('utilization.')) return `${Math.round(v * 1000) / 10}%`;
  if (id === 'conversion') return `${Math.round(v) / 10}%`;
  return u().number(v);
 }
 const scaleOf = (id: string) => id.startsWith('utilization.') ? 100 : id === 'conversion' ? .1 : 1;
 const UNDEFINED: Record<string, string> = {
  meanCycleMinutes: 'no case finished', meanAgeMinutes: 'no case was in progress', throughputPerHour: 'no time passed', conversion: 'no outcome was reached',
 };
 function sentence(id: string, label: string, s: Stats, runs: number, compare: boolean, ci: string): string {
  const parts: string[] = [];
  if (compare && s.mean !== null) {
   const zero = !s.ci95 || (s.ci95[0] <= 0 && s.ci95[1] >= 0), size = show(id, Math.abs(s.mean));
   parts.push(zero ? `No clear difference in ${label.toLowerCase()} at ${s.n} paired runs.`
    : `${label} per run is ${size} ${s.mean > 0 ? 'lower' : 'higher'} with the draft than with the applied design `
     + `(95% interval of applied minus draft ${ci}; ${s.n} paired seeds).`);
  }
  const missing = runs - s.n;
  if (missing > 0) parts.push(`${label} is undefined in ${missing} ${missing === 1 ? 'run' : 'runs'}${UNDEFINED[id] ? ' where ' + UNDEFINED[id] : ''}.`);
  return parts.join(' ');
 }
 function kpi(id: string, label: string, s: Stats, runs: number, compare: boolean): LWProcessDashboardWhatIf.Kpi {
  const ci = s.ci95 ? `${show(id, s.ci95[0])} to ${show(id, s.ci95[1])}` : '—';
  const spread = s.p10 === null ? '—' : `${show(id, s.p10)} · ${show(id, s.p50)} · ${show(id, s.p90)}`;
  const k = scaleOf(id), at = (v: number | null) => v === null ? null : v * k;
  const interval = s.mean === null ? null : {label, mean: at(s.mean), low: at(s.ci95?.[0] ?? null), high: at(s.ci95?.[1] ?? null), p10: at(s.p10),
   p90: at(s.p90), tip: `${label}: mean ${show(id, s.mean)}, 95% interval ${ci}, n ${s.n}`};
  return {id, label, n: s.n, mean: show(id, s.mean), ci, spread, sentence: sentence(id, label, s, runs, compare, ci), interval};
 }
 function result(r: LWProcessReplicate.Report | LWProcessReplicate.Comparison, done: number, random = false): Result {
  const U = u(), compare = r.format === 'wildlands-process-comparison';
  const pairs = compare ? (r as LWProcessReplicate.Comparison).kpis : [], single = compare ? [] : (r as LWProcessReplicate.Report).kpis;
  const kpis = compare ? pairs.map(k => kpi(k.id, k.label, k.difference, done, true)) : single.map(k => kpi(k.id, k.label, k, done, false));
  const stats = compare ? pairs.flatMap(k => [k.a, k.b]) : single;
  const flat = done > 1 && stats.every(s => s.sd === null || s.sd === 0), seeds = r.seeds.slice(0, Math.max(1, done));
  const start = r.warmup ? `; measures labelled "after minute ${U.count(r.warmup)}" leave out the first ${U.count(r.warmup)} minutes `
   + '(warm-up), the others include start-up' : ', so start-up is included';
  const honesty = `Spread under the authored assumptions across ${U.plural(done, 'seed')} (${seeds[0]} to ${seeds.at(-1)}), measured at minute `
   + `${U.count(r.minutes)} of runs that start empty${start}. Intervals use Student t (normal 1.96 above 30 degrees of freedom, `
   + 'slightly narrow between 31 and about 120). This is not a forecast.'
   + (compare ? ' Both designs run on the same seeds, so they share random numbers wherever they agree.' : '');
  const status = r.complete ? (compare ? 'Comparison complete.' : 'Replications complete.') : `Partial results (${done} of ${r.runs} runs).`;
  return {kind: compare ? 'compare' : 'spread', complete: r.complete, done, runs: r.runs, minutes: r.minutes, seeds: r.seeds, kpis, honesty, status, flat,
   random};
 }
 function table(r: Result): LWProcessDashboardModel.Table {
  const compare = r.kind === 'compare', range = '10th · 50th · 90th percentile';
  const head = compare ? ['Measure (applied minus draft)', 'Mean difference', '95% interval', range, 'Paired runs']
   : ['Measure', 'Mean', '95% interval of the mean', range, 'Runs with a value'];
  const caption = compare ? 'Applied design minus draft, per run' : 'Spread of the applied design across seeds';
  return u().table(caption, head, r.kpis.map(k => [k.label, k.mean, k.ci, k.spread, String(k.n)]));
 }
 function markup(r: Result, width: number, rem: number): string {
  const C = root.LWProcessChart, esc = root.LWProcessHtml.esc, w = Math.max(160, Math.floor(width)), compare = r.kind === 'compare';
  const same = r.random ? `Every seed gave the same value for every measure by minute ${u().count(r.minutes)}: the random draws did not change `
   + 'them in this run length, so there is no spread to show.'
   : 'This process has no random behaviour; every seed gives the same result, so there is no spread to show.';
  const flat = r.flat ? `<p class="db-note">${esc(same)}</p>` : '';
  const title = (k: LWProcessDashboardWhatIf.Kpi) => `${k.label}: dot is the mean, bold line the 95% interval, thin line the 10th to 90th percentile`;
  const item = (k: LWProcessDashboardWhatIf.Kpi, i: number) => '<li>'
   + `<span class="db-row-label"><strong>${esc(k.label)}</strong><span>mean ${esc(k.mean)} · 95% interval ${esc(k.ci)} · n ${k.n}</span></span>`
   + (k.interval ? C.dots({width: w, height: rem * 1.75, title: title(k), id: `db-wi-${i}`}, rem, [k.interval], compare) : '')
   + (k.sentence ? `<span class="db-note">${esc(k.sentence)}</span>` : '') + '</li>';
  const named = compare ? 'Applied minus draft per measure' : 'Spread per measure';
  const list = r.flat ? '' : `<ul class="db-intervals" aria-label="${named}">${r.kpis.map(item).join('')}</ul>`;
  const caption = r.flat ? 'Per measure across seeds; every seed gave the same value.'
   : compare ? 'Paired difference per measure: applied design minus draft; the vertical rule marks no difference. Each row has its own scale.'
   : 'Per measure: the dot is the mean, the bold line its 95% interval and the thin line the 10th to 90th percentile across seeds. Each row '
   + 'has its own scale from 0, so rows are not compared by position.';
  const data = root.LWProcessDashboardHtml.table(table(r), 'whatif', {width: w, rem, expanded: new Set()});
  // A complete run is announced by the section's status line; partial results say how far they got.
  return `${r.complete ? '' : `<p class="db-status">${esc(r.status)}</p>`}<p class="db-notice" role="note">${esc(r.honesty)}</p>${flat}`
   + `<figure class="db-figure">${list}<figcaption>${esc(caption)}</figcaption>${data}</figure>`;
 }
 root.LWProcessDashboardWhatIf = {LIMITS, defaults, maxMinutes, compareReason, check, result, markup, table};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessDashboardWhatIf;
})(globalThis);
