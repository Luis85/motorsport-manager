/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-dashboard-model.ts" />
/// <reference path="./process-dashboard-window.ts" />
/// <reference path="./process-hours.ts" />
/**
 * Dashboard section 3 (LWProcessDashboardTime): "Where time goes": the lead-time breakdown by work state with flow efficiency,
 * waiting by step (the bottleneck ranking, each row selecting its step), pool capacity as bullet graphs and queues over time. Pure
 * view-models over the detached view and the optional read-model data (research 4.2, 4.3 and 4.7); no DOM, session, clock or storage.
 *
 * Rules: a case's state for the open-now bar is the highest-priority state among its tokens (working, waiting for capacity, blocked,
 * backlog, timer, joining); the finished breakdown needs the per-case state minutes (`metrics.leadTime`) and flow efficiency is
 * working over lead time, also without authored timer waiting. Waiting shares use the waiting token-minutes when the engine reports
 * them (`minutesBy.waiting`, exact, including work still waiting) and otherwise the waits of started work (`waitMinutes`), and say
 * which. Utilisation reads '—' at minute 0, never 0%; the 85-100% band is a reading aid for queueing near full use, not a target.
 * With a window (LWProcessDashboardWindow) pool utilisation is the busy minutes over the window ÷ (window × capacity), labelled.
 */
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessDashboardModel: LWProcessDashboardModel.Api; LWProcessTerms: LWProcessTerms.Api;
  LWProcessSlidesText: LWProcessSlidesText.Api; LWProcessDashboardWindow: LWProcessDashboardWindow.Api; LWProcessHours: LWProcessHours.Api;
  LWProcessDashboardTime?: LWProcessDashboardSections.Builder};
 type Input = LWProcessDashboardData.Input;
 type Panel = LWProcessDashboardModel.Panel;
 type Metrics = LWProcess.Snapshot['metrics'] & LWProcessDashboardData.Metrics;
 type StepMetric = LWProcess.StepMetric & LWProcessDashboardData.StepExtras;
 const u = () => root.LWProcessDashboardModel.util;
 const diff = (a: number[]) => a.slice(1).map((v, i) => v - a[i]!);
 const pct = (share: number) => `${Math.round(share * 100)}%`;
 /** Open cases by their highest-priority current state, in STATES order. */
 function openByState(q: LWProcess.Snapshot): number[] {
  const U = u(), order = U.STATES.map(x => x.key), cases = new Map<string, number>();
  for (const k of q.tokens) {
   const st = U.state(k);
   if (st) cases.set(k.caseId, Math.min(cases.get(k.caseId) ?? order.length, order.indexOf(st)));
  }
  return order.map((_, i) => [...cases.values()].filter(v => v === i).length);
 }
 function breakdown(input: Input): Panel {
  const {definition: d, snapshot: q} = input.view, m = q.metrics as Metrics, t = root.LWProcessTerms.of(d), U = u();
  const base = U.panel('breakdown', 'Lead-time breakdown', `Of the time a ${t.one} spends in the process, how much is work and how much is waiting?`, {});
  if (q.minute === 0) return {...base, empty: 'Nothing has been simulated yet.'};
  const order = U.STATES.map(x => x.key), open = openByState(q), lead = m.leadTime, notes: string[] = [];
  const total = lead ? order.reduce((a, k) => a + lead[k], 0) : 0, bars: {label: string; segments: LWProcessChart.Segment[]}[] = [];
  const segments = (values: number[]) => U.STATES.map((x, i) => ({label: x.label, value: values[i]!, tone: x.tone, glyph: x.glyph}));
  if (!m.completed) notes.push(`No ${t.one} has finished yet.`);
  else if (!lead) notes.push(`The breakdown of finished ${t.many} needs per-${t.one} state minutes from the run.`);
  else {
   bars.push({label: `Finished ${t.many}: share of lead time`, segments: segments(order.map(k => lead[k]))});
   const withoutTimers = lead.timer > 0 && total > lead.timer ? ` (${U.percent(lead.working, total - lead.timer)} excluding authored waiting on timers)` : '';
   notes.push(`Flow efficiency: ${U.percent(lead.working, total)} of lead time was worked${withoutTimers}.`);
   const fe = m.flowEfficiency?.counts;
   if (fe?.some(c => c > 0)) {
    const bins = fe.map((c, i) => c ? `${U.number(c)} at ${i * 10}–${i === 9 ? 100 : i * 10 + 10}%` : '').filter(Boolean);
    notes.push(`Per-${t.one} flow efficiency: ${bins.join(', ')}.`);
   }
  }
  if (open.some(n => n > 0)) bars.push({label: `Open ${t.many} now by current state`, segments: segments(open)});
  // Working hours: closed minutes are their own state (metrics.leadTime.closed), outside the shares above.
  const h = d.workingHours, closed = lead?.closed && m.completed ? U.minutes(lead.closed / m.completed, d) : '';
  const outside = closed ? `: finished ${t.many} spent ${closed} on average outside them.` : '.';
  if (h) notes.push(`This run uses working hours (${root.LWProcessHours.describe(h)}); minutes outside them count as neither work nor waiting${outside}`);
  if (t.journey) notes.push('Waiting by design (timers) is part of the journey you authored.');
  const name = (i: number) => U.STATES[i]!.label.toLowerCase();
  const ranked = lead && total ? order.map((k, i) => ({i, v: lead[k]})).sort((a, b) => b.v - a.v).slice(0, 3) : [];
  const top = ranked.map(e => `${U.percent(e.v, total)} ${name(e.i)}`);
  const now = open.map((n, i) => n ? `${U.number(n)} ${name(i)}` : '').filter(Boolean);
  const caption = top.length ? `Finished ${t.many} spent ${top.join(', ')}.` : now.length ? `Open now: ${now.join(', ')}.` : `No ${t.one} is open now.`;
  const rows = U.STATES.map((x, i) => [x.label, lead && m.completed ? U.minutes(lead[order[i]!] / m.completed, d) : '—',
   lead ? U.percent(lead[order[i]!], total) : '—', open[i]!]);
  return {...base, caption, notes, empty: bars.length ? null : notes[0] ?? `No ${t.one} is open now.`,
   chart: bars.length ? {kind: 'stack', title: `Lead time and open ${t.many} by work state`, bars} : null,
   legend: U.STATES.map(x => ({label: x.label, tone: x.tone, glyph: x.glyph})),
   table: U.table(`Work states of finished and open ${t.many}`,
    ['State', `Mean minutes per finished ${t.one}`, 'Share of lead time', `Open ${t.many} now`], rows)};
 }
 /** The busiest pool a step demands: its name and utilisation. */
 function busiest(d: LWProcess.Definition, q: LWProcess.Snapshot, step: LWProcess.Step): {name: string; utilization: number} | null {
  const ids = Object.keys(step.resources ?? {}), pools = q.resources.filter(p => ids.includes(p.id));
  if (!pools.length) return null;
  const p = pools.reduce((a, b) => b.utilization > a.utilization ? b : a);
  return {name: d.resources.find(r => r.id === p.id)?.name ?? p.id, utilization: p.utilization};
 }
 function waiting(input: Input): Panel {
  const {definition: d, snapshot: q} = input.view, t = root.LWProcessTerms.of(d), U = u(), steps = new Map(d.steps.map(s => [s.id, s]));
  const base = U.panel('waiting', 'Waiting by step', 'Which steps hold the most waiting work? This is where to look for the bottleneck.', {});
  if (q.minute === 0) return {...base, empty: 'Nothing has been simulated yet.'};
  const metric = q.steps as StepMetric[], exact = metric.some(m => m.minutesBy), now = new Map<string, number>();
  for (const k of q.tokens) if (k.status === 'queued') now.set(k.stepId, (now.get(k.stepId) ?? 0) + 1);
  const wait = (m: StepMetric) => exact ? m.minutesBy?.waiting ?? 0 : m.waitMinutes, total = metric.reduce((a, m) => a + wait(m), 0);
  const queued = (id: string) => now.get(id) ?? 0;
  if (!metric.some(m => m.starts > 0) && !now.size) return {...base, empty: 'No work has started yet.'};
  const listed = metric.filter(m => wait(m) > 0 || queued(m.id) > 0).sort((a, b) => wait(b) - wait(a) || queued(b.id) - queued(a.id));
  const notes = [exact ? 'Waiting token-minutes include work still waiting.'
   : 'Shares cover the waits of work that has started; work still waiting is counted once it starts.'];
  if (t.journey) notes.push('Touchpoints without resources never wait for capacity; only steps that have waited are listed.');
  if (!listed.length) return {...base, empty: 'No work has waited yet.', notes};
  const mean = (m: StepMetric) => m.meanWaitMinutes === null ? '—' : U.minutes(m.meanWaitMinutes, d), max = Math.max(1, wait(listed[0]!));
  const share = (m: StepMetric) => total ? `${U.percent(wait(m), total)} of waiting · ` : '';
  const rows = listed.map(m => {
   const pool = busiest(d, q, steps.get(m.id)!);
   const row: LWProcessDashboardModel.Row = {label: steps.get(m.id)!.name, value: wait(m), max, tone: 'wait', step: m.id,
    detail: `${share(m)}${mean(m)} mean wait · ${U.number(queued(m.id))} waiting now`};
   if (pool) row.extra = {value: pool.utilization, max: 1, text: `${pool.name} ${pct(pool.utilization)} busy`};
   return row;
  });
  const table = listed.map(m => {
   const pool = busiest(d, q, steps.get(m.id)!);
   return [steps.get(m.id)!.name, U.percent(wait(m), total), mean(m), queued(m.id), m.starts, pool ? `${pool.name} (${pct(pool.utilization)})` : 'none'];
  });
  const top = listed[0]!, name = steps.get(top.id)!.name;
  // Before any started work has waited, only the work waiting now is known: the caption says so instead of a share of nothing.
  const caption = total ? `${name} holds ${U.percent(wait(top), total)} of the waiting.`
   : `${name} has ${U.number(queued(top.id))} waiting now; no started work has waited yet.`;
  return {...base, notes, caption,
   chart: {kind: 'rows', title: 'Steps ranked by waiting', rows},
   table: U.table('Waiting by step', ['Step', 'Share of waiting', 'Mean wait per start', 'Waiting now', 'Work starts', 'Busiest pool'], table,
    [false, true, true, true, true, false])};
 }
 function capacity(input: Input): Panel {
  const {definition: d, snapshot: q} = input.view, t = root.LWProcessTerms.of(d), U = u(), T = q.minute;
  const s = input.series && input.series.minutes.length > 1 ? input.series : null;
  const base = U.panel('capacity', 'Capacity: pool utilisation', 'Which pools are saturated or idle?', {});
  if (!d.resources.length) {
   return {...base, empty: t.journey ? 'This journey uses no capacity pools; waiting comes from timers and interaction durations.'
    : 'This process declares no shared resources.'};
  }
  const users = (id: string) => d.steps.filter(st => (st.resources?.[id] ?? 0) > 0).map(st => st.name).join(', ') || 'no step';
  const kind = (r: LWProcess.Resource) => root.LWProcessSlidesText.poolKind(r);
  type Pair = {p: LWProcess.PoolMetric; r: LWProcess.Resource};
  const pools = q.resources.map(p => ({p, r: d.resources.find(r => r.id === p.id)})).filter((x): x is Pair => !!x.r);
  const Win = root.LWProcessDashboardWindow, w = Win.of(input), over = w ? Win.label(w) : 'since minute 0';
  const use = (p: LWProcess.PoolMetric) => w ? Win.utilization(w, p.id, p.capacity) ?? 0 : p.utilization;
  const share = (p: LWProcess.PoolMetric) => Math.round(use(p) * 1000) / 10;
  const spark = (p: LWProcess.PoolMetric) => {
   const c = s?.pools[p.id];
   // With working hours a pool is available only in working minutes (LWProcessHours), as the snapshot's utilisation counts them.
   const h = d.workingHours, open = (m: number) => h ? root.LWProcessHours.working(h, m) : m;
   return c && s ? diff(c.busyMinutes).map((b, i) => b / Math.max(1, (open(s.minutes[i + 1]!) - open(s.minutes[i]!)) * p.capacity) * 100) : null;
  };
  const rows = pools.map(({p, r}) => ({label: r.name, detail: `${kind(r)} · ${U.plural(p.capacity, 'unit')} · used by ${users(p.id)}`,
   value: T ? share(p) : null, compare: p.capacity ? Math.round(p.busy / p.capacity * 1000) / 10 : null, spark: spark(p),
   tip: T ? `${r.name}: ${pct(use(p))} average utilisation ${over}, ${p.busy} of ${p.capacity} busy now`
    : `${r.name}: ${p.capacity} units, no time simulated yet`}));
  const top = pools.reduce((a, b) => use(b.p) > use(a.p) ? b : a);
  const caption = T ? `${top.r.name} is the busiest pool at ${pct(use(top.p))} average utilisation ${over}.`
   : 'Capacities only: utilisation needs simulated time.';
  const busy = (p: LWProcess.PoolMetric) => w ? w.busy[p.id] ?? 0 : p.busyMinutes;
  const table = pools.map(({p, r}) => [r.name, kind(r), p.capacity, T ? `${share(p)}%` : '—', p.busy, busy(p), users(p.id)]);
  return {...base, caption, notes: ['The shaded band from 85% to 100% marks where queues grow quickly near full use; it is a reading aid, not a target.'],
   chart: {kind: 'bullets', title: 'Average utilisation per pool, with busy units now as a tick', rows},
   table: U.table('Pool utilisation', ['Pool', 'Kind', 'Capacity', w ? `Average utilisation ${over}` : 'Average utilisation', 'Busy now',
    w ? `Busy minutes ${over}` : 'Busy minutes', 'Used by'], table, [false, false, true, true, true, true, false])};
 }
 function queues(input: Input): Panel {
  const {definition: d} = input.view, U = u(), s = input.series && input.series.minutes.length > 1 ? input.series : null;
  const names = new Map(d.steps.map(st => [st.id, st.name])), name = (id: string) => names.get(id) ?? id;
  const base = U.panel('queues', 'Queues over time', 'When did a queue start building, and does it drain?', {});
  if (!s) return {...base, empty: 'Needs at least two sampling intervals of the run history.'};
  const per = Object.entries(s.steps).filter(([, c]) => (c.waitingArea.at(-1) ?? 0) > 0)
   .map(([id, c]) => ({id, c, mean: diff(c.waitingArea).map((a, i) => a / Math.max(1, s.minutes[i + 1]! - s.minutes[i]!))}))
   .sort((a, b) => b.c.waitingArea.at(-1)! - a.c.waitingArea.at(-1)!);
  if (!per.length) return {...base, empty: 'No step has had waiting work yet.'};
  const third = (v: number[], last: boolean) => {
   const n = Math.max(1, Math.floor(v.length / 3)), part = last ? v.slice(-n) : v.slice(0, n);
   return part.reduce((a, b) => a + b, 0) / part.length;
  };
  const grew = per.filter(x => third(x.mean, true) > 0 && third(x.mean, true) > third(x.mean, false) * 1.5).map(x => name(x.id));
  const max = Math.max(1, ...per.flatMap(x => x.mean));
  const caption = grew.length ? `Queues grew by more than half from the first to the last third of the run at ${grew.join(', ')}.`
   : 'No queue grew by more than half from the first to the last third of the run.';
  return {...base, caption,
   chart: {kind: 'sparks', title: 'Mean waiting work per interval at each step, on a shared scale',
    rows: per.map(x => ({label: name(x.id), values: x.mean, max}))},
   table: U.table('Queues over time', ['Step', 'Mean waiting, first third', 'Mean waiting, last third', 'Peak waiting'],
    per.map(x => [name(x.id), U.round(third(x.mean, false)), U.round(third(x.mean, true)), Math.max(...x.c.waitingPeak)]))};
 }
 function sections(input: Input): LWProcessDashboardModel.Section[] {
  // Queues over time read only the run history, so with two samples or more they are built once per series.
  const s = input.series, kept = s && s.minutes.length > 1 ? u().memo(input, 'queues', () => queues(input)) : queues(input);
  return [{id: 'time', title: 'Where time goes', panels: [breakdown(input), waiting(input), capacity(input), kept]}];
 }
 root.LWProcessDashboardTime = {sections};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessDashboardTime;
})(globalThis);
