/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-application.ts" />
/// <reference path="./process-chart.ts" />
/// <reference path="./process-time.ts" />
/// <reference path="./process-terms.ts" />
/// <reference path="./process-route.ts" />
/// <reference path="./process-slides-contracts.d.ts" />
/**
 * Pure view-model of the per-process Dashboard (LWProcessDashboardModel): it turns one detached `LWProcessApp.View`, plus the
 * optional read-model data of `LWProcessDashboardData`, into panels of plain numbers, percentile brackets, sentences, table rows and
 * empty-state reasons. No DOM, session, clock, randomness or storage; the same input gives the same model, and the input is never
 * changed. The panels of sections 2-8 are built by LWProcessDashboardFlow (flow over time), LWProcessDashboardTime (where time
 * goes), LWProcessDashboardPanels (lead time), LWProcessDashboardQuality (quality and cost), LWProcessDashboardJourney (journey
 * outcomes) and LWProcessDashboardFocus (step focus); this module owns the run identity and honesty
 * strip (R0), the KPI tiles (section 1), the shared helpers and the section order.
 *
 * Honesty rules every panel follows: one seeded run is one sample, so the strip always carries the single-run notice (its seed
 * sentence is dropped when the definition has no random behaviour); a value that is undefined (mean lead time before the first
 * finish, utilisation at minute 0) reads '—' with a reason and never 0; lead-time figures name the cases still open (censoring)
 * and retained-case charts name the pruned cases; percentiles are brackets of histogram bins (nearest rank), shown from 10
 * finished cases; nothing is worded as a forecast. Business minutes use LWProcessTime and the definition's display calendar.
 *
 * Data that a later read model adds (the shapes of research section 4) is optional input: a panel that needs it shows its
 * `empty` reason ('Needs a sampled run history.') instead of failing.
 */
declare namespace LWProcessDashboardData {
 /** Token-minutes or case-minutes by work state (research 4.2, 4.3). */
 interface StateMinutes {working: number; waiting: number; blocked: number; backlog: number; timer: number; joining: number}
 /** Sampled time series on a fixed business-minute grid (research 4.7); every array has the length of `minutes`. */
 interface Series {
  base: number; every: number; level: number; minutes: number[];
  run: {wip: number[]; wipPeak: number[]; arrived: number[]; completed: number[]; failed: number[]; dropped: number[]; goals: number[]; lost: number[];
   cycleSum: number[]; wipArea: number[]; cost: number[]};
  steps: Record<string, {waiting: number[]; working: number[]; blocked: number[]; timers: number[]; waitingPeak: number[]; starts: number[];
   completed: number[]; entered: number[]; waitMinutes: number[]; waitingArea: number[]; blockedArea: number[]}>;
  pools: Record<string, {busy: number[]; busyMinutes: number[]}>;
 }
 /** Fine distributions (research 4.6): bin i counts x with edges[i] <= x < edges[i + 1]; the last bin is open. */
 interface Distributions {
  edges: number[]; cycle: number[]; byOutcome?: {goal: number[]; lost: number[]; none: number[]}; failed: number[];
  steps: Record<string, {wait: number[]; service: number[]; exitAge: number[]}>;
 }
 /** One recently finished case (research 4.8). */
 interface FinishedCase {
  caseId: string; entered: number; finished: number; status: 'completed' | 'failed'; end: string | null; outcome: 'goal' | 'lost' | null;
  repeats: number; working: number | null;
 }
 /** Snapshot metrics that research 4.1-4.5 adds; every field is optional until the engine provides it. */
 interface Metrics {
  wipArea?: number; cycleSum?: number; leadTime?: StateMinutes; flowEfficiency?: {counts: number[]}; costOf?: {completed: number; failed: number};
  failedMinutes?: number; firstPass?: number; repeats?: {counts: number[]};
 }
 /** Step metrics that research 4.2 and 4.9 add. */
 interface StepExtras {minutesBy?: StateMinutes; failed?: number}
 interface Input {
  view: LWProcessApp.View;
  series?: Series | null; distributions?: Distributions | null; recent?: readonly FinishedCase[] | null;
  /** True while an unapplied draft differs from the running definition. */
  draft?: boolean;
  /** "Measure from minute W": a sample minute of `series` (0 by default). */
  window?: number;
 }
}
declare namespace LWProcessDashboardModel {
 /** A data table; `tail` (time series) keeps the latest rows when a long table is shortened, otherwise the first ones. */
 interface Table {caption: string; head: string[]; rows: string[][]; numeric: boolean[]; tail?: boolean}
 interface Legend {label: string; tone: LWProcessChart.Tone; glyph?: LWProcessChart.Glyph}
 /** An HTML bar row; `step` makes it a button that selects the step; `extra` is a second, thin meter with its text. */
 interface Row {
  label: string; detail: string; value: number; max: number; tone: LWProcessChart.Tone; step?: string;
  extra?: {value: number; max: number; text: string};
 }
 /** One stacked bar; `total` sets an absolute scale shared by the bars (a 100% bar without it); `step` makes the label select it. */
 interface StackBar {label: string; segments: LWProcessChart.Segment[]; total?: number; step?: string}
 interface Bullet {label: string; detail: string; value: number | null; compare: number | null; tip: string; spark: number[] | null}
 type Chart =
  | {kind: 'stack'; title: string; bars: StackBar[]}
  | {kind: 'bullets'; title: string; rows: Bullet[]}
  | {kind: 'histogram'; title: string; axis: string; tone: LWProcessChart.Tone; bins: LWProcessChart.Bin[]; brackets: [number, string[]][]; max?: number}
  | {kind: 'lines'; title: string; axis: string; xs: number[]; series: LWProcessChart.Series[]; step: boolean; mark: number | null}
  | {kind: 'columns'; title: string; axis: string; xs: number[]; stacked: LWProcessChart.Series[]; line: LWProcessChart.Series | null}
  | {kind: 'dots'; title: string; rows: LWProcessChart.Interval[]; zero: boolean}
  | ({kind: 'points'; title: string; points: LWProcessChart.Point[]} & LWProcessChart.PointOptions)
  | {kind: 'rows'; title: string; rows: Row[]}
  | {kind: 'sparks'; title: string; rows: {label: string; values: number[]; max: number}[]}
  | {kind: 'text'; title: string; lines: string[]};
 interface Panel {
  id: string; title: string; question: string;
  /** The plain reason no chart is drawn ('No case has finished yet.'); null when the panel has content. */
  empty: string | null;
  /** One-sentence summary, the figure caption. */
  caption: string; notes: string[]; chart: Chart | null; legend: Legend[]; table: Table | null;
 }
 /** A dashboard section; `tiles` (step focus) are drawn above its panels. */
 interface Section {id: string; title: string; panels: Panel[]; tiles?: Tile[]}
 interface Tile {id: string; label: string; value: string; line: string; problem: boolean; spark: number[] | null; trend: string}
 interface Strip {identity: string; notice: string; notes: {id: string; text: string}[]; windows: number[]; window: number}
 interface Model {name: string; journey: boolean; minute: number; focus: string | null; strip: Strip; tiles: Tile[]; sections: Section[]}
 type State = keyof LWProcessDashboardData.StateMinutes;
 /** Shared helpers of the dashboard model modules. */
 interface Util {
  number(n: number): string;
  minutes(n: number, d: LWProcess.Definition): string;
  percent(part: number, whole: number): string;
  /** At most 3 significant digits from 1,000 up, whole numbers from 100, one decimal below. */
  round(n: number): number;
  plural(n: number, one: string, many?: string): string;
  /** Whether the definition draws anything at random (timing, draws, chance routes, random arrival gaps). */
  random(d: LWProcess.Definition): boolean;
  /** Steps in main-route order, then the off-route steps in definition order. */
  order(d: LWProcess.Definition): LWProcess.Step[];
  /** The work state a token is in, or null for routing and spent tokens. */
  state(t: LWProcess.Token): State | null;
  /** Nearest-rank bin of quantile q (0..100) over `counts`; null when n is 0. */
  rank(counts: readonly number[], q: number): number | null;
  /** '120–150 min' for bin i of `edges` ('≥ 100,000 min' for the open last bin). */
  bin(edges: readonly number[], i: number): string;
  /** Appends an incremental `series()` result to the cached one; a new level or base replaces it. */
  merge(cache: LWProcessDashboardData.Series | null, next: LWProcessDashboardData.Series): LWProcessDashboardData.Series;
  table(caption: string, head: string[], rows: (string | number)[][], numeric?: boolean[]): Table;
  panel(id: string, title: string, question: string, fields: Partial<Panel>): Panel;
  /** The work states in priority and stack order, with their label, colour role and glyph. */
  STATES: readonly {key: State; label: string; tone: LWProcessChart.Tone; glyph: LWProcessChart.Glyph}[];
 }
 interface Api {
  build(input: LWProcessDashboardData.Input): Model;
  strip(input: LWProcessDashboardData.Input): Strip;
  tiles(input: LWProcessDashboardData.Input): Tile[];
  util: Util;
 }
}
declare namespace LWProcessDashboardSections {
 /** A builder of sections 2-8 (flow, time, lead, quality and cost, journey, focus); each returns its sections or none. */
 interface Builder {sections(input: LWProcessDashboardData.Input): LWProcessDashboardModel.Section[]}
}
(function(inputRoot: unknown) {
 'use strict';
 type Builder = LWProcessDashboardSections.Builder;
 const root = inputRoot as {LWProcessTime: LWProcessTime.Api; LWProcessTerms: LWProcessTerms.Api; LWProcessRoute: LWProcessRoute.Api;
  LWProcessSlidesText: LWProcessSlidesText.Api; LWProcessDashboardFlow?: Builder; LWProcessDashboardTime?: Builder; LWProcessDashboardPanels?: Builder;
  LWProcessDashboardQuality?: Builder; LWProcessDashboardJourney?: Builder; LWProcessDashboardFocus?: Builder;
  LWProcessDashboardModel?: LWProcessDashboardModel.Api};
 type Input = LWProcessDashboardData.Input;
 type Tile = LWProcessDashboardModel.Tile;
 type Panel = LWProcessDashboardModel.Panel;
 type Series = LWProcessDashboardData.Series;
 type Metrics = LWProcess.Snapshot['metrics'] & LWProcessDashboardData.Metrics;
 const time = () => root.LWProcessTime;
 function round(n: number): number {
  if (!Number.isFinite(n)) return n;
  const a = Math.abs(n);
  if (a >= 1000) {
   const f = 10 ** (Math.floor(Math.log10(a)) - 2);
   return Math.round(n / f) * f;
  }
  return a >= 100 ? Math.round(n) : Math.round(n * 10) / 10;
 }
 const number = (n: number) => time().number(round(n));
 const minutes = (n: number, d: LWProcess.Definition) => time().span(round(n), d.calendar ?? null);
 const percent = (part: number, whole: number) => whole > 0 ? `${Math.round(part * 1000 / whole) / 10}%` : '—';
 const plural = (n: number, one: string, many = one + 's') => `${time().number(n)} ${n === 1 ? one : many}`;
 function chance(w: LWProcess.When | undefined): boolean {
  if (!w) return false;
  return typeof w.chance === 'number' || (w.all ?? w.any ?? []).some(chance) || (w.not !== undefined && chance(w.not));
 }
 const random = (d: LWProcess.Definition) => d.steps.some(s => s.timing || s.draws?.length || s.deadline?.timing)
  || d.flows.some(f => chance(f.when)) || d.arrivals.some(a => a.gap || a.draws?.length);
 function order(d: LWProcess.Definition): LWProcess.Step[] {
  const path = root.LWProcessRoute.walk(d).path, seen = new Set(path.map(s => s.id));
  return [...path, ...d.steps.filter(s => !seen.has(s.id))];
 }
 const STATES = [
  {key: 'working', label: 'Working', tone: 'work', glyph: 'active'},
  {key: 'waiting', label: 'Waiting for capacity', tone: 'wait', glyph: 'queued'},
  {key: 'blocked', label: 'Blocked after finishing', tone: 'blocked', glyph: 'held'},
  {key: 'backlog', label: 'In a backlog', tone: 'backlog', glyph: 'backlog'},
  {key: 'timer', label: 'On a timer', tone: 'timer', glyph: 'timer'},
  {key: 'joining', label: 'Waiting at a join', tone: 'join', glyph: 'joining'},
 ] as const;
 const STATUS_KEY: Record<string, LWProcessDashboardModel.State> = {
  active: 'working', queued: 'waiting', held: 'blocked', backlog: 'backlog', timer: 'timer', joining: 'joining',
 };
 const state = (t: LWProcess.Token) => STATUS_KEY[t.status] ?? null;
 function rank(counts: readonly number[], q: number): number | null {
  const n = counts.reduce((s, c) => s + c, 0);
  if (!n) return null;
  const need = Math.ceil(q * n / 100);
  let cum = 0;
  for (let i = 0; i < counts.length; i++) {
   cum += counts[i]!;
   if (cum >= need) return i;
  }
  return counts.length - 1;
 }
 function bin(edges: readonly number[], i: number): string {
  const lo = edges[i] ?? 0, hi = edges[i + 1];
  return hi === undefined ? `≥ ${time().number(lo)} min` : `${time().number(lo)}–${time().number(hi)} min`;
 }
 type Columns = Record<string, unknown>;
 /** Appends every array of `b` to the same array of `a`, recursing into records (the columnar series). */
 function append(a: Columns, b: Columns): Columns {
  for (const [k, v] of Object.entries(b)) {
   const old = a[k];
   if (Array.isArray(v)) a[k] = Array.isArray(old) ? [...old, ...v] : v;
   else if (v && typeof v === 'object') a[k] = append(old && typeof old === 'object' ? old as Columns : {}, v as Columns);
   else a[k] = v;
  }
  return a;
 }
 function merge(cache: Series | null, next: Series): Series {
  const copy = JSON.parse(JSON.stringify(next)) as Series;
  if (!cache || cache.level !== next.level || cache.base !== next.base) return copy;
  return append(JSON.parse(JSON.stringify(cache)) as Columns, copy as unknown as Columns) as unknown as Series;
 }
 function table(caption: string, head: string[], rows: (string | number)[][], numeric = head.map((_, i) => i > 0)): LWProcessDashboardModel.Table {
  return {caption, head, rows: rows.map(r => r.map(c => typeof c === 'number' ? number(c) : c)), numeric};
 }
 const panel = (id: string, title: string, question: string, f: Partial<Panel>): Panel =>
  ({id, title, question, empty: null, caption: '', notes: [], chart: null, legend: [], table: null, ...f});
 const util: LWProcessDashboardModel.Util = {number, minutes, percent, round, plural, random, order, state, rank, bin, merge, table, panel, STATES};
 /** Whole-run cycle bins: the fine distribution when present, else the snapshot's 1-2-5 histogram. */
 function cycleBins(input: Input): {edges: number[]; counts: number[]} {
  const fine = input.distributions;
  return fine && fine.cycle.length ? {edges: fine.edges, counts: fine.cycle} : input.view.snapshot.metrics.cycleHistogram;
 }
 function notice(d: LWProcess.Definition, q: LWProcess.Snapshot): string {
  const at = time().number(q.minute);
  if (q.minute === 0) return 'Minute 0 — nothing has been simulated yet. Run or advance to collect results.';
  if (random(d)) {
   return `One simulated run (seed ${q.seed}) at business minute ${at}. These numbers follow from the authored assumptions and one random seed; `
    + 'another seed gives different numbers. They are not measurements or a forecast. Use What-if to see the spread across seeds.';
  }
  return `One simulated run at business minute ${at}. These numbers follow from the authored assumptions; this process has no random behaviour, `
   + 'so every seed gives the same run. They are not measurements or a forecast.';
 }
 function strip(input: Input): LWProcessDashboardModel.Strip {
  const {definition: d, snapshot: q, horizon} = input.view, m = q.metrics, terms = root.LWProcessTerms.of(d), T = q.minute;
  const notes: {id: string; text: string}[] = [], verb = (n: number) => n === 1 ? 'is' : 'are';
  const length = horizon === null ? 'no run length' : time().number(horizon);
  const status = root.LWProcessSlidesText.statusText(q);
  const identity = [d.name, 'revision ' + d.revision, 'seed ' + q.seed, `minute ${time().number(T)} of ${length}`, status].join(' · ');
  if (input.draft) notes.push({id: 'draft', text: 'Showing the applied definition; your draft is not included.'});
  if (m.active > 0 && m.completed > 0) {
   const oldest = Math.max(0, ...q.cases.filter(c => c.status === 'active').map(c => T - c.entered));
   const finished = plural(m.completed, 'finished ' + terms.one, 'finished ' + terms.many);
   notes.push({id: 'censoring', text: `Lead-time figures cover ${finished}; ${time().number(m.active)} ${verb(m.active)} still in progress `
    + `(oldest ${minutes(oldest, d)}) and ${verb(m.active)} not included.`});
  }
  if (q.retention.finishedDropped > 0) {
   const kept = q.cases.filter(c => c.status !== 'active').length;
   notes.push({id: 'pruning', text: `Totals cover every ${terms.one}; ${terms.one}-level charts show the latest ${time().number(kept)} finished `
    + `${terms.many} (${time().number(q.retention.finishedDropped)} earlier ones are counted but not drawn).`});
  }
  if (d.arrivals.some(a => a.open)) {
   const text = 'Arrivals continue for the whole run; there is no natural end. Consider measuring from a later minute to leave out start-up.';
   notes.push({id: 'open', text});
  }
  const s = input.series, windows = s && s.minutes.length > 1 ? s.minutes.filter(x => x < T) : [];
  const window = windows.includes(input.window ?? 0) ? input.window ?? 0 : 0;
  if (window > 0) notes.push({id: 'window', text: `Windowed values measure from minute ${time().number(window)}; distributions stay whole-run.`});
  return {identity, notice: notice(d, q), notes, windows, window};
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
 interface Ctx {d: LWProcess.Definition; q: LWProcess.Snapshot; m: Metrics; terms: LWProcessTerms.Terms; s: Series | null; input: Input}
 function active({d, q, m, terms, s}: Ctx): Tile {
  const wip = s ? s.run.wip.slice(-12) : null, overRun = m.wipArea !== undefined && q.minute > 0 ? ` · mean over the run ${number(m.wipArea / q.minute)}` : '';
  const line = m.meanAgeMinutes === null ? `no open ${terms.many}` : `mean age ${minutes(m.meanAgeMinutes, d)}${overRun}`;
  return tile('active', 'In progress', number(m.active), line, {spark: wip, trend: wip ? 'In progress is ' + trend(wip) : ''});
 }
 function finished({m, terms, s}: Ctx): Tile {
  const done = s ? s.run.completed.slice(1).map((v, i) => v - s.run.completed[i]!).slice(-12) : null;
  const rate = m.throughputPerHour === null ? '—' : number(m.throughputPerHour);
  return tile('finished', terms.finished, number(m.completed), `${rate} per hour · ${number(m.arrived)} arrived`,
   {spark: done, trend: done ? 'Finishes per interval are ' + trend(done) : ''});
 }
 function lead({d, m, terms, input}: Ctx): Tile {
  const label = terms.journey ? 'Time to outcome' : 'Lead time', bins = cycleBins(input), median = rank(bins.counts, 50), p85 = rank(bins.counts, 85);
  if (!m.completed) return tile('lead', label, '—', `No ${terms.one} has finished yet`);
  const open = m.active ? ` · ${time().number(m.active)} open` : '';
  if (m.completed < 10 || median === null || p85 === null) {
   return tile('lead', label, minutes(m.meanCycleMinutes, d), `mean of ${plural(m.completed, terms.one, terms.many)}${open}`);
  }
  return tile('lead', label, 'median ' + bin(bins.edges, median), `85th percentile ${bin(bins.edges, p85)} · mean ${minutes(m.meanCycleMinutes, d)}${open}`);
 }
 function oldest({d, q}: Ctx): Tile | null {
  const open = q.cases.filter(c => c.status === 'active');
  if (!open.length) return null;
  const first = open.reduce((a, c) => c.entered < a.entered ? c : a), names = new Map(d.steps.map(st => [st.id, st.name]));
  const at = [...new Set(q.tokens.filter(t => t.caseId === first.id && state(t)).map(t => names.get(t.stepId) ?? t.stepId))];
  return tile('oldest', 'Oldest open', minutes(q.minute - first.entered, d), at.length ? 'at ' + at.join(', ') : 'between steps');
 }
 function pool({d, q}: Ctx): Tile | null {
  const demanded = new Set(d.steps.flatMap(st => Object.keys(st.resources ?? {}))), pools = q.resources.filter(p => demanded.has(p.id));
  if (!pools.length) return null;
  const top = pools.reduce((a, p) => p.utilization > a.utilization ? p : a), name = d.resources.find(r => r.id === top.id)?.name ?? top.id;
  const idle = q.minute === 0;
  return tile('pool', 'Busiest pool', idle ? '—' : `${Math.round(top.utilization * 100)}%`,
   `${name} · busy now ${top.busy} of ${top.capacity}${idle ? ' · no time simulated yet' : ''}`);
 }
 function cost({d, m, terms}: Ctx): Tile | null {
  if (!d.resources.some(r => r.costPerMinute > 0) && !d.steps.some(st => (st.cost ?? 0) > 0)) return null;
  const label = `Cost per ${terms.finished.toLowerCase()} ${terms.one}`;
  if (!m.completed) return tile('cost', label, '—', `No ${terms.one} has finished yet`);
  const capacity = number(m.capacityCost / m.completed);
  if (m.costOf) return tile('cost', label, number(m.costOf.completed / m.completed), `work cost of finished ${terms.many} · capacity ÷ finished ${capacity}`);
  return tile('cost', label, number(m.cost / m.completed), `work cost so far ÷ finished, open work included · capacity ÷ finished ${capacity}`);
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
  const ctx: Ctx = {d, q, m: q.metrics as Metrics, terms, s, input};
  const build = {active, finished, lead, oldest, pool, cost, problems, conversion};
  // Journeys lead with conversion and drop the capacity and cost tiles when nothing uses them (each builder returns null then).
  const ids = terms.journey ? ['conversion', 'active', 'finished', 'lead', 'problems', 'oldest', 'pool', 'cost'] as const
   : ['active', 'finished', 'lead', 'oldest', 'pool', 'cost', 'problems', 'conversion'] as const;
  return ids.map(id => build[id](ctx)).filter((t): t is Tile => !!t);
 }
 function build(input: Input): LWProcessDashboardModel.Model {
  const {definition: d, snapshot: q, selected} = input.view, journey = root.LWProcessTerms.of(d).journey;
  const builders = [root.LWProcessDashboardFlow, root.LWProcessDashboardTime, root.LWProcessDashboardPanels, root.LWProcessDashboardQuality,
   root.LWProcessDashboardJourney, root.LWProcessDashboardFocus];
  const byId = new Map(builders.flatMap(b => b?.sections(input) ?? []).map(s => [s.id, s]));
  // Overview first: flow, then where time goes, lead time, quality and cost. Journey outcomes move up for journeys, and a selected
  // step's focus replaces sections 3-6 (the whole-process detail) until the selection is cleared.
  const middle = selected ? ['focus'] : ['time', 'lead', 'quality', 'cost'];
  const ids = journey ? ['journey', 'flow', ...middle] : ['flow', ...middle, 'journey'];
  const sections = ids.map(id => byId.get(id)).filter((s): s is LWProcessDashboardModel.Section => !!s);
  return {name: d.name, journey, minute: q.minute, focus: selected, strip: strip(input), tiles: tiles(input), sections};
 }
 root.LWProcessDashboardModel = {build, strip, tiles, util};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessDashboardModel;
})(globalThis);
