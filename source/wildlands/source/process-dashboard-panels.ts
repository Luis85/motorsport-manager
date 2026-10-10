/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-dashboard-model.ts" />
/**
 * Dashboard section 4 (LWProcessDashboardPanels): "Lead time and predictability": the lead-time distribution with percentile
 * brackets, recent finished cases and aging work in progress. Its `lead()` histogram panel is shared with the outcome
 * (LWProcessDashboardJourney) and step-focus (LWProcessDashboardFocus) distributions. Pure
 * view-models over the detached view and the optional read-model data (research 4.6 and 4.8); no DOM, session, clock or storage.
 *
 * Rules: percentiles are nearest-rank brackets of histogram bins (`[edges[i], edges[i + 1])`), hidden below 10 finished cases;
 * lead time is arrival to finish of completed cases (the studio's "cycle"); the scatter draws the retained (or `recent()`) finished
 * cases only and says so, with whole-run percentile bands; aging dots use the case age (minute minus arrival) per open token, at
 * most 500, and pace per step needs 10 exits of the age-at-exit distribution. Jitter is a hash of the identity, never random.
 */
declare namespace LWProcessDashboardPanels {
 interface Api extends LWProcessDashboardSections.Builder {
  /** A lead-time histogram panel over any bin counts (whole run or one outcome); `max` shares a count scale between panels. */
  lead(input: LWProcessDashboardData.Input, counts: number[], edges: number[], id: string, title: string, max?: number): LWProcessDashboardModel.Panel;
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
 /** The bracket [from, to) of quantile q, for horizontal bands; null below 10 values. */
 function band(input: Input, q: number, label: string): LWProcessChart.Band | null {
  const b = bins(input), n = b.counts.reduce((x, y) => x + y, 0), i = n >= 10 ? u().rank(b.counts, q) : null;
  return i === null ? null : {from: b.edges[i]!, to: b.edges[i + 1] ?? b.edges[i]! * 1.5, label};
 }
 function lead(input: Input, counts: number[], edges: number[], id: string, title: string, max?: number): Panel {
  const {definition: d, snapshot: q} = input.view, t = root.LWProcessTerms.of(d), U = u(), n = counts.reduce((a, b) => a + b, 0);
  const base = U.panel(id, title, `What ${t.one} lead time is typical, what are the 85th and 95th percentiles, and how long is the tail?`, {});
  if (!n) return {...base, empty: `No ${t.one} has finished yet.`};
  const first = counts.findIndex(c => c > 0), last = counts.map(c => c > 0).lastIndexOf(true), brackets = new Map<number, string[]>();
  const ranks = n >= 10 ? PERCENTILES.map(([p, label, words]) => ({label, words, i: U.rank(counts, p)!})) : [];
  for (const r of ranks) brackets.set(r.i - first, [...brackets.get(r.i - first) ?? [], r.label]);
  const shown = counts.slice(first, last + 1).map((count, k) => ({label: U.number(edges[first + k]!), count,
   tip: `${U.bin(edges, first + k)}: ${U.plural(count, t.one, t.many)}`}));
  const finished = U.plural(n, `finished ${t.one}`, `finished ${t.many}`), tail = `the longest bin is ${U.bin(edges, last)}`;
  const caption = ranks.length ? `The median of ${finished} lies in ${U.bin(edges, ranks[0]!.i)}, the 85th percentile in ${U.bin(edges, ranks[1]!.i)} `
   + `and the 95th in ${U.bin(edges, ranks[2]!.i)}; ${tail}.` : `n = ${U.number(n)}: percentiles are shown from 10 finished ${t.many}; ${tail}.`;
  const notes: string[] = [];
  if (id === 'lead') notes.push(`Mean lead time ${U.minutes(q.metrics.meanCycleMinutes, d)} (arrival to finish). Bins widen with duration.`);
  if (q.metrics.active > 0) notes.push(`${U.plural(q.metrics.active, t.one, t.many)} still in progress ${q.metrics.active === 1 ? 'is' : 'are'} not included.`);
  let cum = 0;
  const rows: (string | number)[][] = counts.slice(first, last + 1).map((c, k) => {
   cum += c;
   return [U.bin(edges, first + k), c, U.percent(cum, n)];
  });
  for (const r of ranks) rows.push([r.words, U.bin(edges, r.i), '']);
  const chart: LWProcessDashboardModel.Chart = {kind: 'histogram', title, axis: t.many, tone: 'join', bins: shown, brackets: [...brackets],
   ...max ? {max} : {}};
  return {...base, caption, notes, chart, table: U.table(`${title}: ${t.many} per bin`, ['Lead time', t.Many, 'Cumulative share'], rows)};
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
  const T = Math.max(1, q.minute), ages = list.map(c => c.finished - c.entered);
  const bands = [band(input, 50, 'median, whole run'), band(input, 85, '85th percentile, whole run')].filter((b): b is LWProcessChart.Band => !!b);
  const points = list.map(c => ({x: Math.min(T, Math.max(0, c.finished + (hash(c.caseId) - .5) * T * .004)), y: c.finished - c.entered, ...look(c)}));
  const median = (xs: number[]) => [...xs].sort((x, y) => x - y)[Math.ceil(xs.length / 2) - 1] ?? 0, half = Math.floor(list.length / 2);
  const drawn = U.plural(list.length, `finished ${t.one}`, `finished ${t.many}`);
  const caption = list.length >= 4 ? `Median lead time of the earlier half ${U.minutes(median(ages.slice(0, half)), d)}, `
   + `of the later half ${U.minutes(median(ages.slice(half)), d)}.` : `${drawn} drawn.`;
  const notes = [`Dots are the latest ${drawn}; the bands use the whole run.`];
  const pruned = q.retention.finishedDropped;
  if (pruned > 0) notes.push(`${U.number(pruned)} earlier finished ${t.many} are counted in the totals but not drawn.`);
  const legend: LWProcessDashboardModel.Legend[] = [{label: 'Completed', tone: 'join', glyph: 'active'}, {label: 'Failed', tone: 'blocked', glyph: 'failed'}];
  if (list.some(c => c.outcome)) legend.push({label: 'Goal reached', tone: 'goal', glyph: 'ring'}, {label: 'Lost', tone: 'blocked', glyph: 'ring'});
  const rows = [...list].sort((x, y) => (y.finished - y.entered) - (x.finished - x.entered))
   .map(c => [c.caseId, c.entered, c.finished, c.finished - c.entered, c.status, c.outcome ?? '—']);
  const title = `Lead time by finish minute of recent finished ${t.many}`;
  return {...base, caption, notes, legend, chart: {kind: 'points', title, points, columns: null, xMax: T, yMax: Math.max(...ages), bands},
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
  /** The upper edge of the 85th percentile age-at-exit bin of a step; null before 10 exits. */
  const pace = (id: string) => {
   const e = exits[id]?.exitAge, i = e && e.reduce((a, b) => a + b, 0) >= 10 ? U.rank(e, 85) : null;
   return i === null || !input.distributions ? null : input.distributions.edges[i + 1] ?? null;
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
  return [{id: 'lead', title: 'Lead time and predictability', panels: [lead(input, b.counts, b.edges, 'lead', title), recent(input), aging(input)]}];
 }
 root.LWProcessDashboardPanels = {sections, lead};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessDashboardPanels;
})(globalThis);
