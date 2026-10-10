/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-dashboard-model.ts" />
/// <reference path="./process-dashboard-panels.ts" />
/// <reference path="./process-random-view.ts" />
/**
 * Dashboard section 8 (LWProcessDashboardFocus): "Step focus", shown while a step is selected in place of sections 3-6: the step's
 * counters as tiles, its wait, service and age-at-exit distributions (the service histogram marks the bin of the authored planning
 * duration), its waiting and working work over time, and what the author wrote about it (timing, deadline and instances in plain
 * words, the pools it uses, and for touchpoints the channel, phase, feeling, pain point and opportunity, each labelled "authored").
 * Pure view-models; no DOM, session, clock or storage. Repeat entries are not counted at joins, where entries are branch arrivals.
 */
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessDashboardModel: LWProcessDashboardModel.Api; LWProcessDashboardPanels: LWProcessDashboardPanels.Api;
  LWProcessTerms: LWProcessTerms.Api; LWProcessRandomView: LWProcessRandomView.Api; LWProcessSlidesText: LWProcessSlidesText.Api;
  LWProcessDashboardFocus?: LWProcessDashboardSections.Builder};
 type Input = LWProcessDashboardData.Input;
 type Panel = LWProcessDashboardModel.Panel;
 type Tile = LWProcessDashboardModel.Tile;
 const u = () => root.LWProcessDashboardModel.util;
 const NEEDS = 'Needs at least two sampling intervals of the run history.';
 const tile = (id: string, label: string, value: string, line = ''): Tile => ({id, label, value, line, problem: false, spark: null, trend: ''});
 function tiles(d: LWProcess.Definition, q: LWProcess.Snapshot, step: LWProcess.Step): Tile[] {
  const m = q.steps.find(s => s.id === step.id), U = u();
  if (!m) return [];
  const waiting = q.tokens.filter(k => k.stepId === step.id && k.status === 'queued').length, join = step.kind === 'join';
  return [tile('waiting', 'Waiting now', U.number(waiting)), tile('working', 'Working', U.number(m.active)), tile('blocked', 'Blocked', U.number(m.held)),
   tile('timers', 'On a timer', U.number(m.timers.waiting), m.timers.nextDue === null ? '' : `next due minute ${U.number(m.timers.nextDue)}`),
   tile('starts', 'Work starts', U.number(m.starts)), tile('completed', 'Completed', U.number(m.completed)),
   tile('wait', 'Mean wait per start', m.meanWaitMinutes === null ? '—' : U.minutes(m.meanWaitMinutes, d)),
   tile('repeats', 'Repeat entries', join ? '—' : U.number(m.entered - m.reached), join ? 'joins count branch arrivals' : ''),
   tile('cost', 'Work cost', U.number(m.workCost))];
 }
 /** A per-step histogram; `planned` marks the bin that holds the authored duration. */
 function distribution(input: Input, id: string, values: number[] | undefined, title: string, planned: number | null, question: string): Panel {
  const U = u(), edges = input.distributions?.edges ?? [];
  if (!values) return U.panel(id, title, question, {empty: 'Needs the per-step distributions from the run.'});
  const p = {...root.LWProcessDashboardPanels.lead(input, values, edges, id, title), question};
  if (planned === null || !p.chart || p.chart.kind !== 'histogram') return p;
  const first = values.findIndex(c => c > 0), at = edges.findIndex((e, i) => planned >= e && (edges[i + 1] === undefined || planned < edges[i + 1]!)) - first;
  if (at < 0 || at >= p.chart.bins.length) return p;
  const labels = [...p.chart.brackets.find(([i]) => i === at)?.[1] ?? [], 'planned'];
  p.chart.brackets = [...p.chart.brackets.filter(([i]) => i !== at), [at, labels]];
  return {...p, notes: [...p.notes, `The bin marked "planned" holds the authored duration (${U.number(planned)} min).`]};
 }
 function queue(input: Input, step: LWProcess.Step): Panel {
  const U = u(), s = input.series && input.series.minutes.length > 1 ? input.series : null, col = s?.steps[step.id];
  const base = U.panel('focus-queue', 'Waiting and working over time', 'When does work pile up at this step?', {});
  if (!s || !col) return {...base, empty: NEEDS};
  const series: LWProcessChart.Series[] = [{label: 'Waiting', values: col.waiting, tone: 'wait'}, {label: 'Working', values: col.working, tone: 'work'}];
  const rows = s.minutes.map((x, i) => [x, col.waiting[i]!, col.working[i]!, col.blocked[i]!]);
  return {...base, caption: `At its last sample, ${U.number(col.waiting.at(-1)!)} waiting and ${U.number(col.working.at(-1)!)} working.`,
   legend: series.map(x => ({label: x.label, tone: x.tone})),
   chart: {kind: 'lines', title: `Waiting and working at ${step.name} by business minute`, axis: 'work items', xs: s.minutes, series, step: true, mark: null},
   table: {...U.table(`Work at ${step.name} at each sample minute`, ['Minute', 'Waiting', 'Working', 'Blocked'], rows), tail: true}};
 }
 function about(d: LWProcess.Definition, q: LWProcess.Snapshot, step: LWProcess.Step): Panel {
  const U = u(), V = root.LWProcessRandomView, m = q.steps.find(s => s.id === step.id);
  const lines = [V.describeTiming(step), V.describeDeadline(step), V.describeInstances(step)].filter(Boolean);
  const deadlines = m?.deadlines;
  if (step.deadline && deadlines) lines.push(`Deadline so far: ${U.number(deadlines.interrupted)} interrupted, ${U.number(deadlines.escalated)} escalated.`);
  if (step.instances && m?.items) lines.push(`Items so far: ${U.number(m.items.started)} started, ${U.number(m.items.finished)} finished.`);
  for (const [id, units] of Object.entries(step.resources ?? {})) {
   const p = q.resources.find(r => r.id === id), name = d.resources.find(r => r.id === id)?.name ?? id;
   const use = q.minute && p ? `${Math.round(p.utilization * 100)}% average utilisation, ` : '';
   if (p) lines.push(`Uses ${U.plural(units, 'unit')} of ${name}: ${use}${p.busy} of ${p.capacity} busy now.`);
  }
  const authored = [step.channel ? `Channel: ${V.describeChannel(step.channel)}` : '', step.phase ? `Phase: ${step.phase}` : '',
   step.emotion !== undefined ? `Expected feeling: ${V.describeEmotion(step.emotion)}` : '', step.pain ? `Pain point: ${step.pain}` : '',
   step.opportunity ? `Opportunity: ${step.opportunity}` : ''].filter(Boolean).map(x => x + ' (authored)');
  const all = [...lines, ...authored];
  return U.panel('focus-about', `About ${step.name}`, 'What does this step do, and what did the author note?', {
   caption: root.LWProcessSlidesText.kindLabel(step),
   chart: {kind: 'text', title: `About ${step.name}`, lines: all.length ? all : ['No timing, pools or notes are authored for this step.']}});
 }
 function sections(input: Input): LWProcessDashboardModel.Section[] {
  const {definition: d, snapshot: q, selected} = input.view, step = d.steps.find(s => s.id === selected);
  if (!step) return [];
  const t = root.LWProcessTerms.of(d), dist = input.distributions?.steps[step.id];
  const planned = step.kind === 'timer' || step.duration === undefined ? null : step.duration;
  const panels = [distribution(input, 'focus-wait', dist?.wait, 'Wait before work starts', null, 'How long does work wait here before it starts?'),
   distribution(input, 'focus-service', dist?.service, 'Time from start to finish of a visit', planned, 'How long does a visit take compared with the plan?'),
   distribution(input, 'focus-pace', dist?.exitAge, `Age of ${t.many} when they leave this step`, null, `How old are ${t.many} when they leave this step?`),
   input.series && input.series.minutes.length > 1 ? u().memo(input, 'focus-queue', () => queue(input, step)) : queue(input, step), about(d, q, step)];
  return [{id: 'focus', title: `Step focus: ${step.name}`, panels, tiles: tiles(d, q, step)}];
 }
 root.LWProcessDashboardFocus = {sections};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessDashboardFocus;
})(globalThis);
