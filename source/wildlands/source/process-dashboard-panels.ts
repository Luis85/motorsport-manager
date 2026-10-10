/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-dashboard-model.ts" />
/**
 * Dashboard section 4 (LWProcessDashboardPanels): "Lead time and predictability": the lead-time distribution with percentile
 * brackets, recent finished cases and aging work in progress. Its `lead()` histogram panel is shared with the outcome
 * (LWProcessDashboardJourney) and step-focus (LWProcessDashboardFocus) distributions. Pure
 * view-models over the detached view and the optional read-model data (research 4.6 and 4.8); no DOM, session, clock or storage.
 *
 * Rules: percentiles are nearest-rank values, hidden below 10 finished cases: exact when the read model kept every value of the
 * distribution (`exact`, LWProcessLedgerExact; whole-run and per-outcome lead time of at most 50,000 completed cases), else
 * brackets of histogram bins (`[edges[i], edges[i + 1])`), and a note says which;
 * lead time is arrival to finish of completed cases (the studio's "cycle"); the scatter draws the retained (or `recent()`) finished
 * cases only and says so, with whole-run percentile bands, placed by finish minute on an axis that starts at the first drawn case
 * (so the latest cases of a long run are not pressed into its last sliver); aging dots use the case age (minute minus arrival) per open token, at
 * most 500, and pace per step needs 10 exits of the age-at-exit distribution. Jitter is a hash of the identity, never random.
 *
 * Target share (the whole-run panel, with the fine distribution only): the viewer may choose a target from the upper edges of the
 * populated fine bins; the share of finished cases under it is exact (the sum of the bins below that edge ÷ finished cases), because
 * the target is a bin edge. It is labelled as a target chosen for this view, not part of the process, and never stored.
 */
declare namespace LWProcessDashboardPanels {
 interface Api extends LWProcessDashboardSections.Builder {
  /**
   * A lead-time histogram panel over any bin counts (whole run or one outcome); `max` shares a count scale between panels; `exact`
   * (the read model's percentiles of the same values) makes the percentiles exact when it holds every value.
   */
  lead(input: LWProcessDashboardData.Input, counts: number[], edges: number[], id: string, title: string, max?: number,
   exact?: LWProcess.Percentiles): LWProcessDashboardModel.Panel;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessDashboardModel: LWProcessDashboardModel.Api; LWProcessTerms: LWProcessTerms.Api;
  LWProcessDashboardPanels?: LWProcessDashboardPanels.Api};
 type Input = LWProcessDashboardData.Input;
 type Panel = LWProcessDashboardModel.Panel;
 type Glyph = LWProcessChart.Glyph;
 type Tone = LWProcessChart.Tone;
 const u = () => root.LWProcessDashboardModel.util;
 const PERCENTILES = [[50, 'p50', '50th percentile'], [85, 'p85', '85th percentile'], [95, 'p95', '95th percentile']] as const;
 /** A stable 0..1 value per identity, for deterministic jitter (no Math.random). */
 function hash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
 }
 function bins(input: Input): {edges: number[]; counts: number[]} {
  const fine = input.distributions;
  return fine?.cycle.length ? {edges: fine.edges, counts: fine.cycle} : input.view.snapshot.metrics.cycleHistogram;
 }
 /** The exact nearest-rank value of quantile q in `set` when it holds all `n` values exactly; null when only a bracket is known. */
 function exactAt(set: LWProcess.Percentiles | undefined, n: number, q: number): number | null {
  const point = set?.exact && set.n === n ? set.points.find(p => p.q === q) : undefined;
  return point?.exact ? point.value : null;
 }
 /** The note that says whether the percentiles are exact or bin brackets, and why (`set` absent: no exact values are kept). */
 function kind(input: Input, set: LWProcess.Percentiles | undefined, exactly: boolean, n: number, many: string): string {
  const U = u(), limit = input.distributions?.percentiles?.limit;
  if (exactly) return `Percentiles are exact: nearest rank over all ${U.number(n)} finished ${many}; the bars group them in bins.`;
  return 'Percentiles are bin brackets (nearest rank over the bin counts): ' + (set && limit !== undefined
   ? `exact values are kept for at most ${U.count(limit)} finished ${many}.` : 'exact values are not kept for this distribution.');
 }
 /** The bracket [from, to) of quantile q, for horizontal bands; null below 10 values. */
 function band(input: Input, q: number, label: string): LWProcessChart.Band | null {
  const b = bins(input), n = b.counts.reduce((x, y) => x + y, 0), i = n >= 10 ? u().rank(b.counts, q) : null;
  return i === null ? null : {from: b.edges[i]!, to: b.edges[i + 1] ?? b.edges[i]! * 1.5, label};
 }
 function lead(input: Input, counts: number[], edges: number[], id: string, title: string, max?: number, exact?: LWProcess.Percentiles): Panel {
  const {definition: d, snapshot: q} = input.view, t = root.LWProcessTerms.of(d), U = u(), n = counts.reduce((a, b) => a + b, 0);
  const base = U.panel(id, title, `What ${t.one} lead time is typical, what are the 85th and 95th percentiles, and how long is the tail?`, {});
  if (!n) return {...base, empty: `No ${t.one} has finished yet.`};
  const first = counts.findIndex(c => c > 0), last = counts.map(c => c > 0).lastIndexOf(true), brackets = new Map<number, string[]>();
  const ranks = n >= 10 ? PERCENTILES.map(([p, label, words]) => {
   const value = exactAt(exact, n, p), i = value === null ? U.rank(counts, p)! : edges.reduce((at, e, k) => e <= value ? k : at, 0);
   return {label, words, i, value, text: value === null ? U.bin(edges, i) : `${U.count(value)} min`};
  }) : [];
  const exactly = ranks.length > 0 && ranks.every(r => r.value !== null);
  for (const r of ranks) brackets.set(r.i - first, [...brackets.get(r.i - first) ?? [], r.label]);
  const shown = counts.slice(first, last + 1).map((count, k) => ({label: U.number(edges[first + k]!), count,
   tip: `${U.bin(edges, first + k)}: ${U.plural(count, t.one, t.many)}`}));
  const finished = U.plural(n, `finished ${t.one}`, `finished ${t.many}`), tail = `the longest bin is ${U.bin(edges, last)}`;
  const [p50, p85, p95] = ranks.map(r => r.text), shown10 = `n = ${U.number(n)}: percentiles are shown from 10 finished ${t.many}; ${tail}.`;
  const caption = !ranks.length ? shown10 : exactly ? `The median of ${finished} is ${p50}, the 85th percentile ${p85} and the 95th ${p95}; ${tail}.`
   : `The median of ${finished} lies in ${p50}, the 85th percentile in ${p85} and the 95th in ${p95}; ${tail}.`;
  const notes: string[] = [];
  if (id === 'lead') notes.push(`Mean lead time ${U.minutes(q.metrics.meanCycleMinutes, d)} (arrival to finish). Bins widen with duration.`);
  if (q.metrics.active > 0) notes.push(`${U.plural(q.metrics.active, t.one, t.many)} still in progress ${q.metrics.active === 1 ? 'is' : 'are'} not included.`);
  if (ranks.length) notes.push(kind(input, exact, exactly, n, t.many));
  let cum = 0;
  const rows: (string | number)[][] = counts.slice(first, last + 1).map((c, k) => {
   cum += c;
   return [U.bin(edges, first + k), c, U.percent(cum, n)];
  });
  for (const r of ranks) rows.push([r.words, r.text, '']);
  const chart: LWProcessDashboardModel.Chart = {kind: 'histogram', title, axis: t.many, tone: 'join', bins: shown, brackets: [...brackets],
   ...max ? {max} : {}};
  const goal = id === 'lead' && input.distributions?.cycle.length ? target(input, counts, edges, first, last, n) : null;
  if (goal?.note) notes.push(goal.note);
  if (goal?.row) rows.push(goal.row);
  return {...base, caption, notes, chart, table: U.table(`${title}: ${t.many} per bin`, ['Lead time', t.Many, 'Cumulative share'], rows),
   ...goal ? {control: goal.control} : {}};
 }
 /** The target select over the upper edges of the populated bins, and for a chosen target its exact share (a note and a table row). */
 function target(input: Input, counts: number[], edges: number[], first: number, last: number, n: number) {
  const U = u(), t = root.LWProcessTerms.of(input.view.definition), options = edges.slice(first + 1, last + 2).filter(e => e > 0);
  const value = options.includes(input.target ?? -1) ? input.target! : null;
  const control = {kind: 'target' as const, label: t.journey ? 'Target time to outcome' : 'Target lead time', value,
   options: options.map(e => ({value: e, label: `${U.count(e)} min`}))};
  if (value === null) return {control, note: null, row: null};
  const below = counts.slice(0, edges.indexOf(value)).reduce((a, b) => a + b, 0), share = U.percent(below, n);
  const note = `Target ${U.count(value)} min, chosen for this view and not part of the process: ${share} of ${U.plural(n, `finished ${t.one}`,
   `finished ${t.many}`)} took less than ${U.count(value)} min (exact: the target is a bin edge).`;
  return {control, note, row: [`Less than the target of ${U.count(value)} min`, below, share] as (string | number)[]};
 }
 interface Finished {caseId: string; entered: number; finished: number; status: 'completed' | 'failed'; outcome: 'goal' | 'lost' | null}
 /** The finished cases to draw: `recent()` when offered, else the retained finished cases of the snapshot. */
 function finishedCases(input: Input): Finished[] {
  if (input.recent) return [...input.recent];
  return input.view.snapshot.cases.filter(c => c.status !== 'active' && c.finished !== null)
   .map(c => ({caseId: c.id, entered: c.entered, finished: c.finished!, status: c.status === 'failed' ? 'failed' : 'completed', outcome: null}));
 }
 const look = (c: Finished): {glyph: Glyph; tone: Tone} => ({glyph: c.outcome ? 'ring' : c.status === 'failed' ? 'failed' : 'active',
  tone: c.outcome === 'goal' ? 'goal' : c.outcome === 'lost' || c.status === 'failed' ? 'blocked' : 'join'});
 function recent(input: Input): Panel {
  const {definition: d, snapshot: q} = input.view, t = root.LWProcessTerms.of(d), U = u();
  const base = U.panel('recent', `Lead time of recent finished ${t.many}`, `Are recent ${t.many} slower than earlier ones? Which were outliers?`, {});
  const list = finishedCases(input).sort((a, b) => a.finished - b.finished);
  if (!list.length) return {...base, empty: `No ${t.one} has finished yet.`};
  // The finish-minute axis starts at the first drawn case: the latest cases of a long run spread over the plot instead of its last sliver.
  const first = list[0]!.finished, T = Math.max(first + 1, q.minute), span = T - first, ages = list.map(c => c.finished - c.entered);
  const bands = [band(input, 50, 'median, whole run'), band(input, 85, '85th percentile, whole run')].filter((b): b is LWProcessChart.Band => !!b);
  const points = list.map(c => ({x: Math.min(T, Math.max(first, c.finished + (hash(c.caseId) - .5) * span * .004)), y: c.finished - c.entered, ...look(c)}));
  const median = (xs: number[]) => [...xs].sort((x, y) => x - y)[Math.ceil(xs.length / 2) - 1] ?? 0, half = Math.floor(list.length / 2);
  const drawn = U.plural(list.length, `finished ${t.one}`, `finished ${t.many}`);
  const caption = list.length >= 4 ? `Median lead time of the earlier half ${U.minutes(median(ages.slice(0, half)), d)}, `
   + `of the later half ${U.minutes(median(ages.slice(half)), d)}.` : `${drawn} drawn.`;
  const notes = [`Dots are the latest ${drawn}, placed by finish minute; the bands use the whole run.`];
  const pruned = q.retention.finishedDropped;
  if (pruned > 0) notes.push(`${U.number(pruned)} earlier finished ${t.many} are counted in the totals but not drawn.`);
  const legend: LWProcessDashboardModel.Legend[] = [{label: 'Completed', tone: 'join', glyph: 'active'}, {label: 'Failed', tone: 'blocked', glyph: 'failed'}];
  if (list.some(c => c.outcome)) legend.push({label: 'Goal reached', tone: 'goal', glyph: 'ring'}, {label: 'Lost', tone: 'blocked', glyph: 'ring'});
  const rows = [...list].sort((x, y) => (y.finished - y.entered) - (x.finished - x.entered))
   .map(c => [c.caseId, c.entered, c.finished, c.finished - c.entered, c.status, c.outcome ?? '—']);
  const title = `Lead time by finish minute of recent finished ${t.many}`;
  const chart: LWProcessDashboardModel.Chart = {kind: 'points', title, points, columns: null, xMin: first, xMax: T, yMax: Math.max(...ages), bands};
  return {...base, caption, notes, legend, chart,
   table: U.table(`Recent finished ${t.many}, longest first`, [t.One, 'Arrived (minute)', 'Finished (minute)', 'Lead time (minutes)', 'Status', 'Outcome'],
    rows, [false, true, true, true, false, false])};
 }
 function aging(input: Input): Panel {
  const {definition: d, snapshot: q} = input.view, t = root.LWProcessTerms.of(d), U = u(), T = q.minute;
  const base = U.panel('aging', 'Aging work in progress', `Which open ${t.many} are older than finished ${t.many} usually are at that step?`, {});
  const entered = new Map(q.cases.filter(c => c.status === 'active').map(c => [c.id, c.entered]));
  const tokens = q.tokens.filter(k => U.state(k) && entered.has(k.caseId)), age = (k: LWProcess.Token) => T - entered.get(k.caseId)!;
  if (!tokens.length) return {...base, empty: `No open ${t.many}.`};
  const order = U.order(d).filter(s => tokens.some(k => k.stepId === s.id)), col = new Map(order.map((s, i) => [s.id, i]));
  const look = (k: LWProcess.Token) => U.STATES.find(x => x.key === U.state(k))!, exits = input.distributions?.steps ?? {};
  /** The upper edge of the 85th percentile age-at-exit bin of a step; null before 10 exits. Computed once per step. */
  const paces = new Map<string, number | null>();
  const pace = (id: string) => {
   if (!paces.has(id)) {
    const e = exits[id]?.exitAge, i = e && e.reduce((a, b) => a + b, 0) >= 10 ? U.rank(e, 85) : null;
    paces.set(id, i === null || !input.distributions ? null : input.distributions.edges[i + 1] ?? null);
   }
   return paces.get(id) ?? null;
  };
  const points = tokens.slice(0, 500).map(k => ({x: col.get(k.stepId)! + (hash(k.id) - .5) * .6, y: age(k), glyph: look(k).glyph, tone: look(k).tone}));
  const older = new Set(tokens.filter(k => { const p = pace(k.stepId); return p !== null && age(k) > p; }).map(k => k.caseId));
  const notes = tokens.length > 500 ? [`Showing 500 of ${U.number(tokens.length)} open work items.`] : [];
  const paced = Object.keys(exits).length > 0;
  notes.push(paced ? `Pace compares each open item with the 85th percentile age of ${t.many} that left its step (from 10 exits).`
   : 'Pace per step needs the age-at-exit distribution from the run.');
  const byCase = new Map<string, LWProcess.Token[]>();
  for (const k of tokens) byCase.set(k.caseId, [...byCase.get(k.caseId) ?? [], k]);
  const names = new Map(d.steps.map(s => [s.id, s.name])), verdict = (id: string, ks: LWProcess.Token[]) =>
   older.has(id) ? 'yes' : ks.some(k => pace(k.stepId) === null) ? 'no pace yet' : 'no';
  const where = (ks: LWProcess.Token[]) => ks.map(k => `${names.get(k.stepId)} (${look(k).label.toLowerCase()})`).join('; ');
  const rows = [...byCase].map(([id, ks]) => [id, age(ks[0]!), where(ks), verdict(id, ks)])
   .sort((x, y) => (y[1] as number) - (x[1] as number));
  const caption = `${U.plural(byCase.size, `open ${t.one}`, `open ${t.many}`)}; the oldest is ${U.minutes(rows[0]![1] as number, d)}`
   + (paced ? `; ${U.number(older.size)} ${older.size === 1 ? 'is' : 'are'} older than the 85th percentile pace of their step.` : '.');
  const bands = [band(input, 85, '85th percentile lead time, whole run')].filter((b): b is LWProcessChart.Band => !!b);
  const legend = U.STATES.filter(x => tokens.some(k => U.state(k) === x.key)).map(x => ({label: x.label, tone: x.tone, glyph: x.glyph}));
  return {...base, notes, caption, legend,
   chart: {kind: 'points', title: 'Age of open work by step, in route order', points, columns: order.map(s => s.name), xMax: order.length,
    yMax: Math.max(...points.map(p => p.y)), bands},
   table: U.table(`Open ${t.many} by age`, [t.One, 'Age (minutes)', 'Steps and states', 'Older than the 85th percentile pace'], rows,
    [false, true, false, false])};
 }
 function sections(input: Input): LWProcessDashboardModel.Section[] {
  const b = bins(input), title = root.LWProcessTerms.of(input.view.definition).journey ? 'Time to outcome' : 'Lead-time distribution';
  const exact = input.distributions?.cycle.length ? input.distributions.percentiles?.cycle : undefined;
  return [{id: 'lead', title: 'Lead time and predictability', panels: [lead(input, b.counts, b.edges, 'lead', title, undefined, exact), recent(input),
   aging(input)]}];
 }
 root.LWProcessDashboardPanels = {sections, lead};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessDashboardPanels;
})(globalThis);
