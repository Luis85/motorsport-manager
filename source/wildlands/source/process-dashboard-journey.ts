/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-dashboard-model.ts" />
/// <reference path="./process-dashboard-panels.ts" />
/// <reference path="./process-random-view.ts" />
/**
 * Dashboard section 7 (LWProcessDashboardJourney): "Journey outcomes", for journeys and for processes whose end steps declare
 * outcomes: the main-route funnel, outcomes over time, time to outcome by outcome, authored feeling beside the measured value,
 * channel mix and tracked measures at finish. Pure view-models; no DOM, session, clock or storage.
 *
 * The funnel follows the main route (LWProcessRoute.walk, the rule the SIPOC view, the Journey map and the slides share); cases
 * still at a step are "in progress", never lost. Drop-off by stretch stays in the Journey map, which the section links to.
 * Measured and authored feeling have different scales, so they appear side by side in a table, never on a dual axis.
 * Conversion over time (goals ÷ decided outcomes at each sample, from the series' cumulative goals and lost) is drawn as its own
 * chart beside the cumulative counts, never on a second axis, and only at samples with at least 20 decided outcomes.
 */
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessDashboardModel: LWProcessDashboardModel.Api; LWProcessDashboardPanels: LWProcessDashboardPanels.Api;
  LWProcessTerms: LWProcessTerms.Api; LWProcessRoute: LWProcessRoute.Api; LWProcessRandomView: LWProcessRandomView.Api;
  LWProcessDashboardJourney?: LWProcessDashboardSections.Builder};
 type Input = LWProcessDashboardData.Input;
 type Panel = LWProcessDashboardModel.Panel;
 const u = () => root.LWProcessDashboardModel.util;
 const text = (c: string | number) => typeof c === 'number' ? String(c) : c;
 const NEEDS_TWO = 'Needs at least two sampling intervals of the run history.', DECIDED = 20;
 const sampled = (input: Input) => input.series && input.series.minutes.length > 1 ? input.series : null;
 function funnel(input: Input): Panel {
  const {definition: d, snapshot: q} = input.view, t = root.LWProcessTerms.of(d), U = u(), metric = new Map(q.steps.map(s => [s.id, s]));
  const notes = ['Drop-off by stretch and alternative paths are in the Journey map.'];
  const base = U.panel('funnel', 'Funnel along the main route', `How many ${t.many} reach each stage?`, {notes});
  const route = root.LWProcessRoute.walk(d).path, first = metric.get(route[0]?.id ?? '')?.reached ?? 0;
  if (!first) return {...base, empty: `No ${t.one} has arrived yet.`};
  const here = new Map<string, Set<string>>();
  for (const k of q.tokens) if (U.state(k)) here.set(k.stepId, new Set([...here.get(k.stepId) ?? [], k.caseId]));
  const list = route.map(s => ({s, reached: metric.get(s.id)?.reached ?? 0, open: here.get(s.id)?.size ?? 0})), last = list.at(-1)!;
  const rows = list.map(r => ({label: r.s.name, value: r.reached, max: first, tone: 'work' as const, step: r.s.id,
   detail: `${U.number(r.reached)} reached · ${U.percent(r.reached, first)} of the first step` + (r.open ? ` · ${U.number(r.open)} in progress here` : '')}));
  const caption = `${U.number(first)} entered at ${route[0]!.name}; ${U.number(last.reached)} (${U.percent(last.reached, first)}) reached ${last.s.name}.`;
  return {...base, caption,
   chart: {kind: 'rows', title: `${t.Many} reaching each main-route step`, rows},
   table: U.table('Funnel along the main route', ['Step', 'Reached', 'Share of the first step', 'In progress here'],
    list.map(r => [r.s.name, r.reached, U.percent(r.reached, first), r.open]))};
 }
 function outcomes(input: Input): Panel {
  const t = root.LWProcessTerms.of(input.view.definition), U = u(), s = sampled(input);
  const base = U.panel('outcomes', 'Outcomes over time', 'Is conversion settling?', {});
  if (!s) return {...base, empty: NEEDS_TWO};
  const series: LWProcessChart.Series[] = [{label: 'Goals reached', values: s.run.goals, tone: 'goal'}, {label: 'Lost', values: s.run.lost, tone: 'blocked'}];
  const conversion = (i: number) => {
   const n = s.run.goals[i]! + s.run.lost[i]!;
   return n >= DECIDED ? U.percent(s.run.goals[i]!, n) : '—';
  };
  const rows = s.minutes.map((m, i) => [m, s.run.goals[i]!, s.run.lost[i]!, conversion(i)]);
  const caption = `By minute ${U.number(s.minutes.at(-1)!)}, ${U.number(s.run.goals.at(-1)!)} reached a goal and ${U.number(s.run.lost.at(-1)!)} were lost.`;
  return {...base, caption,
   notes: ['Conversion at a sample is shown once 20 outcomes are decided.'], legend: series.map(x => ({label: x.label, tone: x.tone})),
   chart: {kind: 'lines', title: `Cumulative goals and lost ${t.many} by business minute`, axis: t.many, xs: s.minutes, series, step: true, mark: null},
   table: {...U.table('Outcomes at each sample minute', ['Minute', 'Goals', 'Lost', 'Conversion'], rows), tail: true}};
 }
 /** Conversion at each sample, in percent of the outcomes decided by then (null below 20 decided outcomes). */
 function conversion(input: Input): Panel {
  const t = root.LWProcessTerms.of(input.view.definition), U = u(), s = sampled(input);
  const base = U.panel('conversion', 'Conversion over time', `What share of the decided ${t.many} had reached a goal at each sample?`, {});
  if (!s) return {...base, empty: NEEDS_TWO};
  const decided = s.minutes.map((_, i) => s.run.goals[i]! + s.run.lost[i]!);
  const values = decided.map((n, i) => n >= DECIDED ? Math.round(s.run.goals[i]! * 1000 / n) / 10 : null);
  const first = values.findIndex(v => v !== null), last = values.map(v => v !== null).lastIndexOf(true);
  if (first < 0) return {...base, empty: `Conversion is drawn once ${DECIDED} outcomes are decided at a sample.`};
  const at = (i: number) => `${values[i]}% at minute ${U.number(s.minutes[i]!)}`;
  const caption = first === last ? `Conversion was ${at(last)} (${U.number(decided[last]!)} decided).`
   : `Conversion went from ${at(first)} to ${at(last)} (${U.number(decided[last]!)} decided).`;
  const rows = s.minutes.map((m, i) => [m, decided[i]!, s.run.goals[i]!, values[i] === null ? '—' : `${values[i]}%`]);
  const series: LWProcessChart.Series[] = [{label: 'Conversion', values, tone: 'goal'}];
  const w = input.window ?? 0;
  return {...base, caption,
   notes: [`Goals ÷ (goals + lost) among the ${t.many} decided by each sample, drawn from ${DECIDED} decided outcomes; ${t.many} still in `
    + 'progress are not counted. It describes this run, not a forecast.'],
   chart: {kind: 'lines', title: 'Conversion at each sample minute, in percent of decided outcomes', axis: '% of decided', xs: s.minutes, series,
    step: false, mark: w || null},
   table: {...U.table('Conversion at each sample minute', ['Minute', 'Decided', 'Goals', 'Conversion'], rows), tail: true}};
 }
 function byOutcome(input: Input): Panel[] {
  const b = input.distributions?.byOutcome, edges = input.distributions?.edges ?? [], U = u(), t = root.LWProcessTerms.of(input.view.definition);
  if (!b) {
   return [U.panel('outcome-time', 'Time to outcome by outcome', 'How long until a goal, and how long until a loss?',
    {empty: 'Needs the time-to-outcome distribution by outcome from the run.'})];
  }
  const max = Math.max(1, ...b.goal, ...b.lost, ...b.none), lead = root.LWProcessDashboardPanels.lead;
  const panels = [lead(input, b.goal, edges, 'outcome-goal', 'Time to a goal', max),
   lead(input, b.lost, edges, 'outcome-lost', `Time until a ${t.one} is lost`, max)];
  if (b.none.some(c => c > 0)) panels.push(lead(input, b.none, edges, 'outcome-none', 'Time to an end without an outcome', max));
  return panels;
 }
 function feeling(input: Input): Panel {
  const {definition: d, snapshot: q} = input.view, U = u(), V = root.LWProcessRandomView, field = d.track?.[0], metric = new Map(q.steps.map(s => [s.id, s]));
  const notes = ['The Journey map draws both curves; their scales differ, so they are listed side by side here.'];
  const base = U.panel('feeling', 'Authored feeling and measured value', 'Does the tracked measure follow the authored feeling?', {notes});
  const steps = d.steps.filter(s => s.emotion !== undefined);
  if (!steps.length) return {...base, empty: 'No step declares an expected feeling.'};
  const label = field ? field.label ?? field.field : 'tracked measure', signed = (n: number) => `${n > 0 ? '+' : ''}${n}`;
  const measured = (s: LWProcess.Step) => text(field ? metric.get(s.id)?.tracked[field.field]?.mean ?? '—' : '—');
  const rows = steps.map(s => [s.name, `${V.describeEmotion(s.emotion)} (${signed(s.emotion!)})`, measured(s)]);
  const column = field ? `; the measured column is the mean ${label} on entry.` : '; no field is tracked.';
  return {...base, caption: `${U.plural(steps.length, 'step')} declare an expected feeling${column}`,
   table: U.table('Authored feeling and measured value per step', ['Step', 'Authored feeling', `Measured ${label} (mean on entry)`], rows,
    [false, false, true])};
 }
 function channels(input: Input): Panel {
  const {definition: d, snapshot: q} = input.view, U = u(), V = root.LWProcessRandomView, entered = new Map(q.steps.map(s => [s.id, s.entered]));
  const base = U.panel('channels', 'Channel mix', 'Which channels carry the journey?', {});
  const touch = d.steps.filter(s => s.kind === 'touchpoint' && s.channel), mix = new Map<string, number>();
  if (!touch.length) return {...base, empty: 'No touchpoint declares a channel.'};
  for (const s of touch) mix.set(s.channel!, (mix.get(s.channel!) ?? 0) + (entered.get(s.id) ?? 0));
  const list = [...mix].sort((a, b) => b[1] - a[1]), total = list.reduce((a, [, n]) => a + n, 0);
  if (!total) return {...base, empty: 'No touchpoint has been entered yet.'};
  const rows = list.map(([c, n]) => ({label: V.describeChannel(c), detail: `${U.number(n)} entries · ${U.percent(n, total)}`,
   value: n, max: list[0]![1], tone: 'work' as const}));
  return {...base, caption: `${V.describeChannel(list[0]![0])} carries ${U.percent(list[0]![1], total)} of touchpoint entries.`,
   chart: {kind: 'rows', title: 'Touchpoint entries per channel', rows},
   table: U.table('Touchpoint entries per channel', ['Channel', 'Entries', 'Share'], list.map(([c, n]) => [V.describeChannel(c), n, U.percent(n, total)]))};
 }
 function tracked(input: Input): Panel {
  const U = u(), list = Object.values(input.view.snapshot.metrics.tracked), t = root.LWProcessTerms.of(input.view.definition);
  const base = U.panel('tracked', 'Tracked measures at finish', 'Where did the tracked values end?', {});
  if (!list.length) return {...base, empty: `No ${t.one} field is tracked.`};
  const rows = list.map(f => [f.label, U.number(f.n), text(f.mean ?? '—'), text(f.min ?? '—'), text(f.max ?? '—')]);
  const caption = list.map(f => f.n ? `${f.label}: mean ${f.mean} (${f.min} to ${f.max}, n = ${U.number(f.n)})` : `${f.label}: —`).join('; ') + '.';
  const one = list.length === 1 && list[0]!.n > 0 ? list[0]! : null;
  const chart: LWProcessDashboardModel.Chart | null = one ? {kind: 'dots', title: `${one.label} at finish: mean with its range`, zero: false,
   rows: [{label: one.label, mean: one.mean, low: null, high: null, p10: one.min, p90: one.max,
    tip: `${one.label}: mean ${one.mean}, from ${one.min} to ${one.max}`}]} : null;
  return {...base, caption, chart, table: U.table(`Tracked measures over completed ${t.many}`, ['Measure', t.Many, 'Mean', 'Minimum', 'Maximum'], rows)};
 }
 function sections(input: Input): LWProcessDashboardModel.Section[] {
  const d = input.view.definition, t = root.LWProcessTerms.of(d), outcome = d.steps.some(s => s.kind === 'end' && s.outcome);
  if (!t.journey && !outcome) return [];
  // The two time charts are drawn only from a run history of two samples or more, so they are built once per series.
  const kept = (key: string, make: (i: Input) => Panel) => sampled(input) ? u().memo(input, key, () => make(input)) : make(input);
  const panels = [funnel(input), ...outcome ? [kept('outcomes', outcomes), kept('conversion', conversion), ...byOutcome(input)] : []];
  if (t.journey) panels.push(feeling(input), channels(input));
  panels.push(tracked(input));
  return [{id: 'journey', title: 'Journey outcomes', panels}];
 }
 root.LWProcessDashboardJourney = {sections};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessDashboardJourney;
})(globalThis);
