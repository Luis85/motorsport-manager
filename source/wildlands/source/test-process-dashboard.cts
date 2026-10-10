/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-dashboard-model.ts" />
/**
 * Dashboard model checks (LWProcessDashboardModel and its section builders), part of the business-process suite: the honesty strip,
 * the KPI tiles and every panel at minute 0, before the first finish, in a mid-run open stream, after a completed run, for a journey
 * with outcomes, a journey without pools and a deterministic process, plus fixtures of the read-model shapes that are still being
 * added (sampled series, distributions, recent cases and the new snapshot metrics), so every panel is checked with and without them.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {catalog} from './process-sdk.cjs';
import {test, application, copy, stepOf, flowOf, build} from './test-process-helpers.cjs';
for (const name of ['process-chart', 'process-dashboard-model', 'process-dashboard-flow', 'process-dashboard-time', 'process-dashboard-quality',
 'process-dashboard-panels', 'process-dashboard-journey', 'process-dashboard-focus']) require(`./${name}.js`);
const M = (globalThis as unknown as {LWProcessDashboardModel: LWProcessDashboardModel.Api}).LWProcessDashboardModel;
type View = LWProcessApp.View;
type Model = LWProcessDashboardModel.Model;
type Data = LWProcessDashboardData.Input;
const CONTENT = path.resolve(__dirname, '../../../docs/concepts/agency-delivery/content');
export const demo = (file: string) => JSON.parse(fs.readFileSync(path.join(CONTENT, file + '.process.json'), 'utf8')) as LWProcess.Definition;
/** A detached studio view of a fresh run after `minutes`, optionally with a step selected. */
export function viewAt(d: LWProcess.Definition, minutes: number, select?: string): View {
 const app = application.create(d);
 try {
  if (minutes) app.advance(minutes);
  if (select) app.select(select);
  return app.query();
 } finally { app.dispose(); }
}
const model = (view: View, extra: Partial<Data> = {}): Model => M.build({view, ...extra});
const panel = (m: Model, id: string) => {
 const p = m.sections.flatMap(s => s.panels).find(x => x.id === id);
 assert(p, 'panel ' + id);
 return p;
};
const tile = (m: Model, id: string) => m.tiles.find(t => t.id === id);
const ids = (m: Model) => m.sections.map(s => s.id);
/** A customer journey without pools or costs: two touchpoints, a chance route to a lost end and a goal end. */
export function poolless(): LWProcess.Definition {
 const d = build([stepOf('start', 'start', {phase: 'Find'}), stepOf('ad', 'touchpoint', {name: 'Sees ad', channel: 'social', emotion: 1, duration: 2}),
  stepOf('shop', 'touchpoint', {name: 'Visits shop', channel: 'web', emotion: -1, duration: 5}), stepOf('choice', 'decision'),
  stepOf('won', 'end', {name: 'Buys', outcome: 'goal'}), stepOf('lost', 'end', {name: 'Leaves', outcome: 'lost'})],
 [flowOf('start', 'ad'), flowOf('ad', 'shop'), flowOf('shop', 'choice'), flowOf('choice', 'lost', {chance: 40} as unknown as LWProcess.Condition),
  flowOf('choice', 'won')],
 [{at: 0, count: 30, interval: 3, data: {}}]);
 return catalog.admit({...d, id: 'pool-less', name: 'Pool-less journey', genre: 'customer-journey'});
}
const SERIES: LWProcessDashboardData.Series = {base: 60, every: 60, level: 0, minutes: [0, 60, 120, 180],
 run: {wip: [0, 4, 6, 9], wipPeak: [0, 5, 7, 9], arrived: [0, 6, 10, 15], completed: [0, 2, 4, 6], failed: [0, 0, 0, 0], dropped: [0, 0, 0, 0],
  goals: [0, 1, 2, 4], lost: [0, 1, 1, 2], cycleSum: [0, 100, 220, 330], wipArea: [0, 180, 480, 900], cost: [0, 50, 100, 150]},
 steps: {
  implementation: {waiting: [0, 1, 3, 5], working: [0, 1, 1, 1], blocked: [0, 0, 0, 0], timers: [0, 0, 0, 0], waitingPeak: [0, 2, 3, 5], starts: [0, 1, 2, 3],
   completed: [0, 1, 2, 2], entered: [0, 2, 5, 8], waitMinutes: [0, 10, 40, 90], waitingArea: [0, 30, 150, 390], blockedArea: [0, 0, 0, 0]},
  qa: {waiting: [0, 1, 0, 0], working: [0, 0, 1, 0], blocked: [0, 0, 0, 0], timers: [0, 0, 0, 0], waitingPeak: [0, 1, 1, 0], starts: [0, 0, 1, 2],
   completed: [0, 0, 1, 2], entered: [0, 1, 2, 2], waitMinutes: [0, 0, 20, 30], waitingArea: [0, 60, 90, 100], blockedArea: [0, 0, 0, 0]},
 },
 pools: {developer: {busy: [0, 1, 2, 2], busyMinutes: [0, 30, 120, 240]}}};
const EDGES = [0, 1, 2, 5, 10, 20, 50, 100, 200, 500];
const DISTRIBUTIONS: LWProcessDashboardData.Distributions = {edges: EDGES, cycle: [0, 0, 0, 1, 2, 3, 3, 2, 1, 0], failed: EDGES.map(() => 0),
 byOutcome: {goal: [0, 0, 0, 0, 2, 3, 0, 0, 0, 0], lost: [0, 0, 1, 1, 0, 0, 0, 0, 0, 0], none: EDGES.map(() => 0)},
 steps: {implementation: {wait: [0, 2, 3, 1, 0, 0, 0, 0, 0, 0], service: [0, 0, 0, 0, 0, 4, 5, 3, 0, 0], exitAge: [0, 0, 0, 0, 0, 2, 4, 4, 2, 0]}}};
const RECENT: LWProcessDashboardData.FinishedCase[] = [
 {caseId: 'c-1', entered: 0, finished: 40, status: 'completed', end: 'delivered', outcome: null, repeats: 0, working: 20},
 {caseId: 'c-2', entered: 10, finished: 90, status: 'completed', end: 'delivered', outcome: null, repeats: 1, working: 30},
 {caseId: 'c-3', entered: 20, finished: 70, status: 'failed', end: null, outcome: null, repeats: 0, working: null},
 {caseId: 'c-4', entered: 30, finished: 150, status: 'completed', end: 'delivered', outcome: null, repeats: 2, working: 50},
 {caseId: 'c-5', entered: 60, finished: 170, status: 'completed', end: 'delivered', outcome: null, repeats: 0, working: 40}];
/** The agency view at `minute` with the research section 4 snapshot additions attached (as the engine will report them). */
function enriched(minute: number, select?: string): View {
 const view = copy(viewAt(demo('agency'), minute, select)), m = view.snapshot.metrics as LWProcessDashboardData.Metrics & typeof view.snapshot.metrics;
 Object.assign(m, {wipArea: 900, cycleSum: 330, leadTime: {working: 100, waiting: 150, blocked: 0, backlog: 20, timer: 30, joining: 30},
  flowEfficiency: {counts: [0, 1, 2, 2, 1, 0, 0, 0, 0, 0]}, costOf: {completed: 600, failed: 0}, firstPass: 4, repeats: {counts: [4, 1, 1, 0, 0, 0]}});
 for (const s of view.snapshot.steps as (LWProcess.StepMetric & LWProcessDashboardData.StepExtras)[]) {
  s.minutesBy = {waiting: s.id === 'implementation' ? 390 : s.id === 'qa' ? 100 : 0, working: 10, blocked: 0, backlog: 0, timer: 0, joining: 0};
 }
 return view;
}
const full = (minute: number, extra: Partial<Data> = {}, select?: string) =>
 model(enriched(minute, select), {series: SERIES, distributions: DISTRIBUTIONS, recent: RECENT, ...extra});

test('Dashboard model at minute 0 says nothing has been simulated and shows undefined values as dashes, never as 0', () => {
 const m = model(viewAt(demo('agency'), 0));
 assert.equal(m.strip.notice, 'Minute 0 — nothing has been simulated yet. Run or advance to collect results.');
 assert.match(m.strip.identity, /^Agency delivery lab · revision \d+ · seed 1 · minute 0 of 100,000 · not started$/);
 assert.deepEqual(m.tiles.map(t => t.id), ['active', 'finished', 'lead', 'oldest', 'pool', 'cost']);
 assert.deepEqual([tile(m, 'lead')!.value, tile(m, 'lead')!.line, tile(m, 'pool')!.value, tile(m, 'cost')!.value], ['—', 'No case has finished yet', '—', '—']);
 assert.equal(tile(m, 'finished')!.line, '— per hour · 1 arrived');
 assert.deepEqual(ids(m), ['flow', 'time', 'lead', 'quality', 'cost']);
 for (const id of ['arrivals', 'wip', 'throughput']) assert.equal(panel(m, id).empty, 'No simulated time yet.');
 assert.equal(panel(m, 'little').empty, 'Needs simulated time after the measuring start.');
 for (const id of ['breakdown', 'waiting']) assert.equal(panel(m, id).empty, 'Nothing has been simulated yet.');
 assert.equal(panel(m, 'capacity').caption, 'Capacities only: utilisation needs simulated time.');
 const bullets = panel(m, 'capacity').chart as Extract<LWProcessDashboardModel.Chart, {kind: 'bullets'}>;
 assert(bullets.rows.every(r => r.value === null), 'utilisation is undefined at minute 0');
 assert.equal(panel(m, 'lead').empty, 'No case has finished yet.');
 assert.equal(panel(m, 'pool-cost').empty, 'No cost yet.');
 assert.equal(panel(m, 'repeats').empty, 'No step was visited twice by the same case.');
});

test('Dashboard model before the first finish keeps lead time undefined and shows the open work by age', () => {
 const m = model(viewAt(demo('delivery-release'), 600));
 assert.equal(m.minute, 600);
 assert.deepEqual([tile(m, 'lead')!.value, tile(m, 'lead')!.line], ['—', 'No case has finished yet']);
 assert.equal(m.strip.notes.find(n => n.id === 'censoring'), undefined, 'no censoring line before the first finish');
 assert.equal(panel(m, 'lead').empty, 'No case has finished yet.');
 assert.equal(panel(m, 'recent').empty, 'No case has finished yet.');
 const aging = panel(m, 'aging'), chart = aging.chart as Extract<LWProcessDashboardModel.Chart, {kind: 'points'}>;
 assert.equal(aging.empty, null);
 assert(chart.points.length > 0 && chart.points.every(p => p.y === 600), 'every open token is as old as its case');
 assert.match(aging.caption, /^1 open case; the oldest is 600 min/);
 assert.equal(tile(m, 'oldest')!.value, '600 min (≈ 10 h)');
 assert.match(panel(m, 'breakdown').caption, /^Open now: 1 /);
 // Without exact minutes by status the share comes from the waits of started work, so there is no share of zero waiting yet;
 // with them (every session now reports minutesBy) work still waiting counts, and the share is exact.
 const earlyView = viewAt(demo('agency'), 5), legacyEarly = copy(earlyView);
 for (const s of legacyEarly.snapshot.steps) delete s.minutesBy;
 const early = panel(model(legacyEarly), 'waiting');
 assert.equal(early.caption, 'Discovery has 1 waiting now; no started work has waited yet.', 'no share of zero waiting');
 assert.equal(panel(model(earlyView), 'waiting').caption, 'Discovery holds 100% of the waiting.', 'exact minutes count work still waiting');
 assert.doesNotMatch(JSON.stringify(early.chart), /of waiting/);
});

test('Dashboard model of a mid-run open stream names censoring, pruning and the open stream, and the seed sentence', () => {
 const view = viewAt(demo('order-fulfilment'), 5000), m = model(view), q = view.snapshot;
 assert(q.metrics.active > 0 && q.retention.finishedDropped > 0);
 assert.match(m.strip.notice, new RegExp(`^One simulated run \\(seed ${q.seed}\\) at business minute 5,000\\. .*another seed gives different numbers\\. `
  + 'They are not measurements or a forecast\\. Use What-if to see the spread across seeds\\.$'));
 assert.deepEqual(m.strip.notes.map(n => n.id), ['censoring', 'pruning', 'open']);
 const censoring = /^Lead-time figures cover [\d,]+ finished cases; \d+ (is|are) still in progress \(oldest \d+ min\) and (is|are) not included\.$/;
 const pruning = /^Totals cover every case; case-level charts show the latest 200 finished cases \([\d,]+ earlier ones are counted but not drawn\)\.$/;
 assert.match(m.strip.notes[0]!.text, censoring);
 assert.match(m.strip.notes[1]!.text, pruning);
 assert.match(tile(m, 'lead')!.value, /^median \d+–\d+ min$/);
 assert.match(tile(m, 'lead')!.line, /^85th percentile \d+–\d+ min · mean [\d.]+ min · \d+ open$/);
 const lead = panel(m, 'lead'), chart = lead.chart as Extract<LWProcessDashboardModel.Chart, {kind: 'histogram'}>;
 assert.deepEqual(chart.brackets.flatMap(([, labels]) => labels).sort(), ['p50', 'p85', 'p95']);
 assert.equal(chart.bins.reduce((a, b) => a + b.count, 0), q.metrics.completed);
 assert(lead.notes.some(n => /still in progress (is|are) not included\.$/.test(n)));
 assert.match(panel(m, 'recent').notes.join(' '), /earlier finished cases are counted in the totals but not drawn\./);
 const ranked = panel(m, 'waiting').chart as Extract<LWProcessDashboardModel.Chart, {kind: 'rows'}>;
 assert(ranked.rows.every((r, i) => !i || r.value <= ranked.rows[i - 1]!.value), 'waiting rows are ranked');
 assert(ranked.rows.every(r => r.step && view.definition.steps.some(s => s.id === r.step)), 'every row selects its step');
});

test('Dashboard model of a completed deterministic run drops the seed sentence and keeps percentiles hidden below 10 cases', () => {
 const view = viewAt(demo('agency'), 5000), m = model(view);
 assert.equal(view.snapshot.status, 'completed');
 assert.equal(M.util.random(view.definition), false);
 assert.equal(m.strip.notice, `One simulated run at business minute ${M.util.number(view.snapshot.minute)}. `
  + 'These numbers follow from the authored assumptions; '
  + 'this process has no random behaviour, so every seed gives the same run. They are not measurements or a forecast.');
 assert.match(m.strip.identity, / · completed$/);
 assert.equal(panel(m, 'aging').empty, 'No open cases.');
 assert.match(panel(m, 'lead').caption, /^n = 6: percentiles are shown from 10 finished cases; the longest bin is /);
 assert.deepEqual((panel(m, 'lead').chart as Extract<LWProcessDashboardModel.Chart, {kind: 'histogram'}>).brackets, []);
 assert.equal(tile(m, 'lead')!.line, 'mean of 6 cases');
 assert.match(panel(m, 'pool-cost').caption, /^Idle capacity is [\d.]+% of the capacity cost \([\d,]+ of [\d,]+ simulated cost units\)\.$/);
 const cost = panel(m, 'step-cost'), bars = (cost.chart as Extract<LWProcessDashboardModel.Chart, {kind: 'stack'}>).bars;
 assert.equal(bars.reduce((a, b) => a + b.segments.reduce((x, s) => x + s.value, 0), 0), view.snapshot.metrics.cost, 'step costs add up to the work cost');
 // With the attributed costs (metrics.costOf) the cost per finished case is exact; without them it is labelled as an estimate.
 assert.equal(cost.notes[0], `Work cost per finished case: ${M.util.number(view.snapshot.metrics.costOf!.completed / view.snapshot.metrics.completed)}.`);
 const legacyCost = copy(view);
 delete legacyCost.snapshot.metrics.costOf;
 const estimate = panel(model(legacyCost), 'step-cost');
 assert.match(estimate.notes[0]!, /^Work cost so far ÷ finished cases: [\d,.]+ \(includes open and failed work\)\.$/);
 assert.equal(tile(m, 'problems'), undefined);
});

test('Dashboard model of a journey leads with outcomes, the funnel, feeling and channels', () => {
 const view = viewAt(demo('customer-journey-webshop'), 600), m = model(view), q = view.snapshot;
 assert.deepEqual(ids(m), ['journey', 'flow', 'time', 'lead', 'quality', 'cost']);
 assert.deepEqual(m.tiles.slice(0, 4).map(t => t.label), ['Conversion', 'In progress', 'Finished', 'Time to outcome']);
 assert.equal(tile(m, 'conversion')!.value, `${q.metrics.conversion! / 10}%`);
 assert.equal(tile(m, 'conversion')!.line, `goals ${q.metrics.goals} · lost ${q.metrics.lost}`);
 const journey = m.sections[0]!.panels.map(p => p.id);
 assert.deepEqual(journey, ['funnel', 'outcomes', 'outcome-time', 'feeling', 'channels', 'tracked']);
 const funnel = panel(m, 'funnel').chart as Extract<LWProcessDashboardModel.Chart, {kind: 'rows'}>;
 const first = q.steps.find(s => s.id === view.definition.start)!.reached;
 assert.equal(funnel.rows[0]!.value, first);
 assert(funnel.rows.every(r => r.value <= first && r.step), 'the funnel never exceeds the first step and selects steps');
 assert.equal(panel(m, 'outcomes').empty, 'Needs at least two sampling intervals of the run history.');
 assert.equal(panel(m, 'outcome-time').empty, 'Needs the time-to-outcome distribution by outcome from the run.');
 assert.match(panel(m, 'channels').caption, /^\w[\w ]* carries [\d.]+% of touchpoint entries\.$/);
 assert(panel(m, 'feeling').table!.rows.length > 0);
 assert.equal(panel(m, 'breakdown').notes.at(-1), 'Waiting by design (timers) is part of the journey you authored.');
});

test('Dashboard model of a journey without pools or costs omits the pool and cost tiles and says why', () => {
 const m = model(viewAt(poolless(), 60));
 assert.equal(tile(m, 'pool'), undefined);
 assert.equal(tile(m, 'cost'), undefined);
 assert.equal(panel(m, 'capacity').empty, 'This journey uses no capacity pools; waiting comes from timers and interaction durations.');
 assert.equal(panel(m, 'pool-cost').empty, 'Costs are not modelled in this process (every cost is 0).');
 assert.equal(panel(m, 'step-cost').empty, 'Costs are not modelled in this process (every cost is 0).');
 const channels = panel(m, 'channels').chart as Extract<LWProcessDashboardModel.Chart, {kind: 'rows'}>;
 assert.deepEqual(channels.rows.map(r => r.label).sort(), ['Social media', 'Website']);
});

test('Dashboard model is pure: the same view gives the same model and the input is never changed', () => {
 const view = viewAt(demo('order-fulfilment'), 900), before = JSON.stringify(view);
 const deepFreeze = <T,>(v: T): T => { if (v && typeof v === 'object') { for (const x of Object.values(v)) deepFreeze(x); Object.freeze(v); } return v; };
 const a = model(deepFreeze(view), {series: deepFreeze(copy(SERIES)), distributions: deepFreeze(copy(DISTRIBUTIONS)), recent: deepFreeze(copy(RECENT))});
 const b = model(copy(view), {series: SERIES, distributions: DISTRIBUTIONS, recent: RECENT});
 assert.deepEqual(a, b);
 assert.equal(JSON.stringify(view), before);
});

test('Dashboard flow panels read the sampled series: cumulative lines, interval means, throughput and Little over a window', () => {
 const m = full(200);
 const arrivals = panel(m, 'arrivals'), lines = arrivals.chart as Extract<LWProcessDashboardModel.Chart, {kind: 'lines'}>;
 assert.deepEqual(lines.series.map(s => [s.label, s.values]), [['Arrived', [0, 6, 10, 15]], ['Finished (completed and failed)', [0, 2, 4, 6]]]);
 assert.equal(arrivals.table!.tail, true);
 assert.match(arrivals.caption, /Open work has grown at every sample since minute 0\.$/);
 const wip = panel(m, 'wip');
 assert.deepEqual((wip.chart as Extract<LWProcessDashboardModel.Chart, {kind: 'lines'}>).series[0]!.values, [3, 5, 7]);
 assert.equal(wip.caption, 'Average open cases per interval went from 3 to 7; the peak was 9 in the interval to minute 180.');
 assert.equal(panel(m, 'throughput').caption, 'Finishes per 60 min: mean 2, range 2–2.');
 const whole = panel(m, 'little').chart as Extract<LWProcessDashboardModel.Chart, {kind: 'text'}>;
 assert.match(whole.lines[0]!, /^Mean in progress L 4\.5 = arrival rate λ [\d.]+ per minute × mean time in system W 150 min \(≈ 2\.5 h\) \(since minute 0\)/);
 const windowed = full(200, {window: 60});
 assert.deepEqual(windowed.strip.windows, [0, 60, 120, 180]);
 assert.equal(windowed.strip.window, 60);
 const text = (panel(windowed, 'little').chart as Extract<LWProcessDashboardModel.Chart, {kind: 'text'}>).lines;
 assert.deepEqual(text, ['Mean in progress L 6 = arrival rate λ 0.108 per minute × mean time in system W 55.4 min (from minute 60).',
  'Finished cases averaged 57.5 min.', 'Observation: arrivals exceeded finishes by 125%.',
  'Observation: 4 in progress at the start of the window and 9 at its last sample.']);
 assert(windowed.strip.notes.some(n => n.id === 'window'));
 assert.equal((panel(windowed, 'wip').chart as Extract<LWProcessDashboardModel.Chart, {kind: 'lines'}>).mark, 60);
});

test('Dashboard time panels use state minutes, exact waiting areas, pool series and queue trends when the engine reports them', () => {
 const m = full(200), breakdown = panel(m, 'breakdown'), bars = (breakdown.chart as Extract<LWProcessDashboardModel.Chart, {kind: 'stack'}>).bars;
 assert.equal(bars[0]!.label, 'Finished cases: share of lead time');
 assert.deepEqual(bars[0]!.segments.map(s => s.value), [100, 150, 0, 20, 30, 30]);
 assert.equal(breakdown.notes[0], 'Flow efficiency: 30.3% of lead time was worked (33.3% excluding authored waiting on timers).');
 assert.match(breakdown.caption, /^Finished cases spent 45\.5% waiting for capacity, 30\.3% working, /);
 const waiting = panel(m, 'waiting');
 assert.equal(waiting.notes[0], 'Waiting token-minutes include work still waiting.');
 assert.equal(waiting.caption, 'Implementation holds 79.6% of the waiting.');
 const capacity = panel(m, 'capacity').chart as Extract<LWProcessDashboardModel.Chart, {kind: 'bullets'}>;
 const developer = capacity.rows.find(r => r.label === 'Developers')!;
 assert.equal(developer.spark!.length, 3);
 const queues = panel(m, 'queues');
 assert.equal(queues.caption, 'Queues grew by more than half from the first to the last third of the run at Implementation.');
 assert.deepEqual((queues.chart as Extract<LWProcessDashboardModel.Chart, {kind: 'sparks'}>).rows.map(r => r.label), ['Implementation', 'Quality review']);
});

test('Dashboard lead, recent, aging, quality and cost panels read the distributions, recent cases and attributed costs', () => {
 const m = full(60), lead = panel(m, 'lead'), chart = lead.chart as Extract<LWProcessDashboardModel.Chart, {kind: 'histogram'}>;
 assert.equal(lead.caption, 'The median of 12 finished cases lies in 20–50 min, the 85th percentile in 100–200 min and the 95th in 200–500 min; '
  + 'the longest bin is 200–500 min.');
 assert.deepEqual(chart.brackets, [[2, ['p50']], [4, ['p85']], [5, ['p95']]]);
 assert.deepEqual(chart.bins.map(b => b.label), ['5', '10', '20', '50', '100', '200']);
 assert.deepEqual(lead.table!.rows.slice(-3).map(r => r[0]), ['50th percentile', '85th percentile', '95th percentile']);
 const recent = panel(m, 'recent').chart as Extract<LWProcessDashboardModel.Chart, {kind: 'points'}>;
 assert.deepEqual(recent.points.map(p => p.glyph), ['active', 'failed', 'active', 'active', 'active']);
 assert.deepEqual(recent.bands.map(b => b.label), ['median, whole run', '85th percentile, whole run']);
 assert.equal(panel(m, 'recent').caption, 'Median lead time of the earlier half 40 min, of the later half 110 min.');
 assert.match(panel(m, 'aging').notes.join(' '), /Pace compares each open item with the 85th percentile age of cases that left its step \(from 10 exits\)\./);
 const repeats = panel(full(200), 'repeats');
 assert(repeats.notes.includes(`Repeat entries per finished case: 0: 4, 1: 1, 2: 1, 3: 0, 4: 0, 5 or more: 0.`));
 assert.match(repeats.notes.join(' '), /Finished without repeat visits: [\d.]+% \(4 of \d+\)\./);
 const completed = enriched(60).snapshot.metrics.completed;
 const perCase = completed ? `Work cost per finished case: ${M.util.number(600 / completed)}.` : 'No case has finished yet, so there is no cost per case.';
 assert.equal(panel(m, 'step-cost').notes[0], perCase);
 assert.equal(tile(m, 'cost')!.value, completed ? M.util.number(600 / completed) : '—');
});

test('Dashboard step focus replaces sections 3-6 with the step tiles, its distributions, queue and authored notes', () => {
 const m = full(60, {}, 'implementation');
 assert.deepEqual(ids(m), ['flow', 'focus']);
 const focus = m.sections[1]!;
 assert.equal(focus.title, 'Step focus: Implementation');
 assert.deepEqual(focus.tiles!.map(t => t.label),
  ['Waiting now', 'Working', 'Blocked', 'On a timer', 'Work starts', 'Completed', 'Mean wait per start', 'Repeat entries', 'Work cost']);
 assert.deepEqual(focus.panels.map(p => p.id), ['focus-wait', 'focus-service', 'focus-pace', 'focus-queue', 'focus-about']);
 const service = panel(m, 'focus-service'), chart = service.chart as Extract<LWProcessDashboardModel.Chart, {kind: 'histogram'}>;
 assert.deepEqual(chart.brackets.find(([i]) => i === 0)![1].at(-1), 'planned');
 assert.equal(service.notes.at(-1), 'The bin marked "planned" holds the authored duration (25 min).');
 assert.equal(panel(m, 'focus-queue').caption, 'At its last sample, 5 waiting and 1 working.');
 const about = (panel(m, 'focus-about').chart as Extract<LWProcessDashboardModel.Chart, {kind: 'text'}>).lines;
 assert(about.includes('Takes 25 min') && about.some(l => /^Uses 1 unit of Developers: /.test(l)));
 const plain = model(viewAt(demo('agency'), 60, 'design-ready'));
 assert.deepEqual(plain.sections.find(s => s.id === 'focus')!.tiles!.find(t => t.id === 'repeats')!.line, 'joins count branch arrivals');
 assert.equal(panel(plain, 'focus-wait').empty, 'Needs the per-step distributions from the run.');
});

test('Dashboard journey outcomes read outcome series and distributions on one shared scale', () => {
 const view = copy(viewAt(demo('customer-journey-webshop'), 300)), m = model(view, {series: SERIES, distributions: DISTRIBUTIONS});
 assert.deepEqual(m.sections[0]!.panels.map(p => p.id), ['funnel', 'outcomes', 'outcome-goal', 'outcome-lost', 'feeling', 'channels', 'tracked']);
 const outcomes = panel(m, 'outcomes');
 assert.equal(outcomes.caption, 'By minute 180, 4 reached a goal and 2 were lost.');
 assert.deepEqual(outcomes.table!.rows.at(-1), ['180', '4', '2', '—']);
 const goal = panel(m, 'outcome-goal').chart as Extract<LWProcessDashboardModel.Chart, {kind: 'histogram'}>;
 const lost = panel(m, 'outcome-lost').chart as Extract<LWProcessDashboardModel.Chart, {kind: 'histogram'}>;
 assert.equal(goal.max, 3);
 assert.equal(lost.max, 3);
});

test('Dashboard series merge appends incremental samples and replaces the history when the level changes', () => {
 const cut = (from: number, to?: number) => Object.fromEntries(Object.entries(SERIES.run).map(([k, v]) => [k, v.slice(from, to)])) as typeof SERIES.run;
 const head: LWProcessDashboardData.Series = {...copy(SERIES), minutes: [0, 60], run: cut(0, 2),
  steps: {}, pools: {developer: {busy: [0, 1], busyMinutes: [0, 30]}}};
 const tail: LWProcessDashboardData.Series = {...copy(SERIES), minutes: [120, 180], run: cut(2),
  steps: {}, pools: {developer: {busy: [2, 2], busyMinutes: [120, 240]}}};
 const merged = M.util.merge(head, tail);
 assert.deepEqual([merged.minutes, merged.run.wipArea, merged.pools['developer']!.busyMinutes],
  [SERIES.minutes, SERIES.run.wipArea, SERIES.pools['developer']!.busyMinutes]);
 assert.deepEqual(head.minutes, [0, 60], 'the cache is not changed');
 const decimated = {...copy(SERIES), level: 1, every: 120, minutes: [0, 120]};
 assert.deepEqual(M.util.merge(merged, decimated).minutes, [0, 120]);
});

test('The dashboard view mode never ticks, stays shown across process switches and is not remembered as the flat 2D or 3D choice', () => {
 const app = application.create([demo('agency'), demo('customer-journey-webshop')]);
 try {
  app.advance(30);
  const before = JSON.stringify(app.query().snapshot);
  app.mode('2d');
  app.mode('dashboard');
  assert.equal(app.query().mode, 'dashboard');
  assert.equal(JSON.stringify(app.query().snapshot), before, 'entering the dashboard never ticks');
  app.use(1);
  assert.equal(app.query().mode, 'dashboard', 'a journey keeps the dashboard instead of opening its map');
  app.mode('lens');
  app.use(0);
  assert.equal(app.query().mode, '2d', 'leaving a journey map returns to the last flat choice, not to the dashboard');
  assert.equal(JSON.stringify(app.query().snapshot), before, 'switching back restores the run without ticking');
  assert.throws(() => app.mode('chart' as LWProcessApp.ViewMode), /Unknown view mode/);
 } finally { app.dispose(); }
});
