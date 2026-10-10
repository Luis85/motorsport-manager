/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-dashboard-model.ts" />
/**
 * Dashboard sections 5 and 6 (LWProcessDashboardQuality): "Quality" (repeat visits and first pass; failures, drops, blocking and
 * deadlines) and "Cost" (pool work against idle capacity; cost by step and per finished case). Pure view-models over the detached
 * view and the optional read-model data (research 4.2, 4.4, 4.5 and 4.9); no DOM, session, clock or storage.
 *
 * Rules: repeat visits are entries minus distinct cases at non-join steps (at a join that difference counts parallel branches), and
 * they are rework or planned iteration, never called defects. Problem counts are totals; the latest problem events come from the
 * bounded event history and say so. Costs are simulated cost units, never currency; idle capacity cost is a pool's capacity cost
 * minus its work cost; cost per finished case is exact with the attributed costs (`metrics.costOf`) and otherwise labelled as the
 * work cost so far divided by finished cases.
 */
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessDashboardModel: LWProcessDashboardModel.Api; LWProcessTerms: LWProcessTerms.Api;
  LWProcessDashboardQuality?: LWProcessDashboardSections.Builder};
 type Input = LWProcessDashboardData.Input;
 type Panel = LWProcessDashboardModel.Panel;
 type Metrics = LWProcess.Snapshot['metrics'] & LWProcessDashboardData.Metrics;
 type StepMetric = LWProcess.StepMetric & LWProcessDashboardData.StepExtras;
 const u = () => root.LWProcessDashboardModel.util;
 const names = (d: LWProcess.Definition) => {
  const map = new Map(d.steps.map(s => [s.id, s.name]));
  return (id: string) => map.get(id) ?? id;
 };
 function repeats(input: Input): Panel {
  const {definition: d, snapshot: q} = input.view, m = q.metrics as Metrics, t = root.LWProcessTerms.of(d), U = u(), name = names(d);
  const joins = new Set(d.steps.filter(s => s.kind === 'join').map(s => s.id)), extra = (s: LWProcess.StepMetric) => s.entered - s.reached;
  const notes = ['Repeat visits are rework or planned iteration; the simulation cannot tell them apart. Escalated deadline work that re-enters '
   + 'a step counts as a repeat.'];
  const base = U.panel('repeats', 'Repeat visits', `How much work repeats? Do ${t.many} pass without loops?`, {notes});
  if (m.firstPass !== undefined && m.completed) {
   notes.push(`Finished without repeat visits: ${U.percent(m.firstPass, m.completed)} (${U.number(m.firstPass)} of ${U.number(m.completed)}).`);
  }
  if (m.repeats) {
   const counts = m.repeats.counts.map((c, i) => `${i === 5 ? '5 or more' : i}: ${U.number(c)}`).join(', ');
   notes.push(`Repeat entries per finished ${t.one}: ${counts}.`);
  }
  const list = q.steps.filter(s => !joins.has(s.id) && extra(s) > 0).sort((a, b) => extra(b) - extra(a));
  if (!list.length) return {...base, empty: `No step was visited twice by the same ${t.one}.`};
  const max = extra(list[0]!);
  const rows = list.map(s => ({label: name(s.id), detail: `${U.number(extra(s))} repeat entries · ${U.number(s.reached)} ${t.many}`,
   value: extra(s), max, tone: 'work' as const, step: s.id}));
  return {...base, caption: `${name(list[0]!.id)} has the most repeat entries: ${U.number(max)}.`,
   chart: {kind: 'rows', title: 'Repeat entries per step', rows},
   table: U.table('Repeat visits per step', ['Step', 'Entries', `${t.Many} that entered`, 'Repeat entries'],
    list.map(s => [name(s.id), s.entered, s.reached, extra(s)]))};
 }
 const PROBLEM_EVENTS: Record<string, string> = {
  failed: 'Failed', 'arrival-dropped': 'Arrival dropped', held: 'Blocked', 'deadline-interrupt': 'Deadline interrupted',
 };
 function failures(input: Input): Panel {
  const {definition: d, snapshot: q} = input.view, m = q.metrics, t = root.LWProcessTerms.of(d), U = u(), name = names(d);
  const steps = q.steps as StepMetric[], held = steps.reduce((a, s) => a + s.held, 0), rows: (string | number)[][] = [];
  const blocked = steps.some(s => s.minutesBy) ? steps.reduce((a, s) => a + (s.minutesBy?.blocked ?? 0), 0) : 0;
  if (m.failed) rows.push([`Failed ${t.many}`, m.failed]);
  if (m.dropped) rows.push(['Arrivals dropped at the in-progress limit', m.dropped]);
  if (held) rows.push(['Work blocked now after finishing', held]);
  if (blocked) rows.push(['Blocked token-minutes', blocked]);
  const pair = (a: number, b: number) => `${U.number(a)} / ${U.number(b)}`;
  for (const s of steps) {
   if (s.deadlines && (s.deadlines.interrupted || s.deadlines.escalated)) {
    rows.push([`${name(s.id)}: deadline interrupted / escalated`, pair(s.deadlines.interrupted, s.deadlines.escalated)]);
   }
   if (s.items?.started) rows.push([`${name(s.id)}: items started / finished`, pair(s.items.started, s.items.finished)]);
   if (s.failed) rows.push([`${name(s.id)}: failures`, s.failed]);
  }
  const base = U.panel('failures', 'Failures, drops, blocking and deadlines', 'Where does the process break or overflow?', {});
  if (!rows.length) return {...base, empty: 'No failures, drops, blocking or deadline interruptions so far.'};
  const latest = q.events.filter(e => PROBLEM_EVENTS[e.kind]).slice(-5)
   .map(e => `Minute ${U.number(e.minute)}: ${PROBLEM_EVENTS[e.kind]}${e.stepId ? ' at ' + name(e.stepId) : ''}`);
  const caption = rows.slice(0, 3).map(r => `${r[0]}: ${typeof r[1] === 'number' ? U.number(r[1]) : r[1]}`).join('; ') + '.';
  return {...base, caption, notes: latest.length ? ['Latest problem events (not totals): ' + latest.join('; ') + '.'] : [],
   table: U.table('Problem counts', ['What', 'Count'], rows)};
 }
 const costed = (d: LWProcess.Definition) => d.resources.some(r => r.costPerMinute > 0) || d.steps.some(s => (s.cost ?? 0) > 0);
 const NO_COSTS = 'Costs are not modelled in this process (every cost is 0).';
 function pools(input: Input): Panel {
  const {definition: d, snapshot: q} = input.view, U = u();
  const base = U.panel('pool-cost', 'Pool cost: work against idle capacity', 'How much capacity am I paying for that sits idle?', {});
  if (!costed(d)) return {...base, empty: NO_COSTS};
  const list = q.resources.map(p => ({p, name: d.resources.find(r => r.id === p.id)?.name ?? p.id})).filter(x => x.p.capacityCost > 0);
  if (!q.minute) return {...base, empty: 'No cost yet.'};
  if (!list.length) return {...base, empty: 'No pool has a cost per minute.'};
  const max = Math.max(...list.map(x => x.p.capacityCost)), idle = (p: LWProcess.PoolMetric) => p.capacityCost - p.workCost;
  const totalIdle = list.reduce((a, x) => a + idle(x.p), 0), cap = q.metrics.capacityCost;
  const bars = list.map(x => ({label: x.name, total: max, segments: [{label: `${x.name} busy`, value: x.p.workCost, tone: 'work' as const},
   {label: `${x.name} idle`, value: idle(x.p), tone: 'idle' as const}]}));
  const caption = `Idle capacity is ${U.percent(totalIdle, cap)} of the capacity cost (${U.number(totalIdle)} of ${U.number(cap)} simulated cost units).`;
  return {...base, caption,
   notes: ['Work cost charges pools only while they work, plus fixed step costs; capacity cost charges every pool unit for every minute.'],
   legend: [{label: 'Busy (work cost)', tone: 'work'}, {label: 'Idle capacity', tone: 'idle'}],
   chart: {kind: 'stack', title: 'Work and idle cost per pool, in simulated cost units', bars},
   table: U.table('Pool cost in simulated cost units', ['Pool', 'Work cost', 'Idle cost', 'Capacity cost', 'Utilisation'],
    list.map(x => [x.name, x.p.workCost, idle(x.p), x.p.capacityCost, `${Math.round(x.p.utilization * 1000) / 10}%`]))};
 }
 function steps(input: Input): Panel {
  const {definition: d, snapshot: q} = input.view, m = q.metrics as Metrics, t = root.LWProcessTerms.of(d), U = u(), name = names(d);
  const base = U.panel('step-cost', `Cost by step and per ${t.one}`, `Which steps drive cost? What does a finished ${t.one} cost?`, {});
  if (!costed(d)) return {...base, empty: NO_COSTS};
  const list = q.steps.filter(s => s.workCost > 0).sort((a, b) => b.workCost - a.workCost);
  if (!list.length) return {...base, empty: 'No cost yet.'};
  const per = !m.completed ? `No ${t.one} has finished yet, so there is no cost per ${t.one}.`
   : m.costOf ? `Work cost per finished ${t.one}: ${U.number(m.costOf.completed / m.completed)}.`
   : `Work cost so far ÷ finished ${t.many}: ${U.number(m.cost / m.completed)} (includes open and failed work).`;
  const top = list[0]!, bars = list.map(s => ({label: name(s.id), total: top.workCost, step: s.id, segments: [
   {label: `${name(s.id)} fixed`, value: s.fixedCost, tone: 'wait' as const},
   {label: `${name(s.id)} per minute`, value: s.workCost - s.fixedCost, tone: 'work' as const}]}));
  return {...base, caption: `${name(top.id)} drives the most work cost: ${U.percent(top.workCost, m.cost)} of ${U.number(m.cost)}.`, notes: [per],
   legend: [{label: 'Fixed step cost', tone: 'wait'}, {label: 'Per-minute pool cost', tone: 'work'}],
   chart: {kind: 'stack', title: 'Work cost per step, in simulated cost units', bars},
   table: U.table('Work cost per step in simulated cost units', ['Step', 'Fixed', 'Per minute', 'Total'],
    list.map(s => [name(s.id), s.fixedCost, s.workCost - s.fixedCost, s.workCost]))};
 }
 const sections = (input: Input): LWProcessDashboardModel.Section[] => [
  {id: 'quality', title: 'Quality', panels: [repeats(input), failures(input)]},
  {id: 'cost', title: 'Cost', panels: [pools(input), steps(input)]},
 ];
 root.LWProcessDashboardQuality = {sections};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessDashboardQuality;
})(globalThis);
