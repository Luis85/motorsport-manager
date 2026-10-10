/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-inspector.ts" />
/// <reference path="./process-dashboard-model.ts" />
/// <reference path="./process-dashboard-window.ts" />
/// <reference path="./process-json-path.ts" />
/**
 * Working hours in the views (business-process-analysis): the inspector's Working hours row, throughput and pool wording, the slide
 * deck's reading note, the Dashboard's lead-time note, and utilisation over working minutes in the Dashboard window and What-if
 * windows, all from detached reads of real sessions. Without working hours none of these words appear.
 */
import assert from 'node:assert/strict';
import {replicate, slides} from './process-sdk.cjs';
import {test, application, copy, build, stepOf, flowOf, startEnd} from './test-process-helpers.cjs';
import {demo} from './test-process-dashboard.cjs';
require('./process-inspector.js');
require('./process-json-path.js');
const root = globalThis as unknown as {LWProcessInspector: LWProcessInspector.Api; LWProcessJsonPath: LWProcessJsonPath.Api;
 LWProcessDashboardModel: LWProcessDashboardModel.Api;
 LWProcessDashboardWindow: LWProcessDashboardWindow.Api};
const OFFICE: LWProcess.WorkingHours = {opensAt: 540, closesAt: 1020, daysPerWeek: 5};
/** A clerk working 60 minutes on each case of a stream every `every` working minutes, under office hours. */
const desk = (every = 120) => ({...build(startEnd(stepOf('work', 'task', {duration: 60, resources: {clerks: 1}})),
 [flowOf('start', 'work'), flowOf('work', 'end')], [{at: 0, open: true, interval: every, data: {}}],
 [{id: 'clerks', name: 'Clerks', capacity: 1, costPerMinute: 2}]), workingHours: {...OFFICE}}) as LWProcess.Definition;
function reads(d: LWProcess.Definition, minutes: number) {
 const app = application.create(d);
 try {
  app.horizon(null);
  app.advance(minutes);
  return {view: app.query(), series: app.series(), distributions: app.distributions(), recent: app.recent(), draft: false};
 } finally {
  app.dispose();
 }
}

test('Inspector, slides and Dashboard say the run uses working hours, and only then', () => {
 // A case every 150 working minutes: the one arriving at 16:30 finishes the next morning, so finished cases have closed minutes.
 const bare = copy(desk(150));
 delete bare.workingHours;
 const timed = reads(desk(150), 3000), plain = reads(bare, 3000);
 const overview = root.LWProcessInspector.overview(timed.view, false), pools = root.LWProcessInspector.pools(timed.view);
 assert.match(overview, /<dt>Working hours<\/dt><dd>09:00–17:00, Monday to Friday; work and arrivals pause outside them<\/dd>/);
 assert.match(overview, /finished per elapsed hour/);
 assert.match(pools, /Average over working hours since minute 0/);
 assert.doesNotMatch(root.LWProcessInspector.overview(plain.view, false), /Working hours|elapsed hour/);
 assert.doesNotMatch(root.LWProcessInspector.pools(plain.view), /working hours/);
 const reading = (d: LWProcess.Definition) => slides.build(d, null).slides[0]!.blocks.flatMap(b => b.items);
 assert(reading(desk()).includes('This process uses working hours (09:00–17:00, Monday to Friday): its run starts on Monday at the opening, '
  + 'times count every elapsed minute, and work and arrivals pause outside working hours.'));
 assert(!reading(demo('agency')).some(x => /working hours/.test(x)));
 const notes = (input: typeof timed) => root.LWProcessDashboardModel.build(input).sections.flatMap(s => s.panels).find(p => p.id === 'breakdown')!.notes;
 const said = notes(timed).find(n => n.startsWith('This run uses working hours'));
 assert.match(said!, /^This run uses working hours \(09:00–17:00, Monday to Friday\); minutes outside them count as neither work nor waiting: /);
 assert.match(said!, /: finished cases spent \d[\d,.]* min( \(≈ [\d.]+ h\))? on average outside them\.$/);
 assert(!notes(plain).some(n => /working hours/.test(n)));
 const leadNotes = (input: typeof timed) => root.LWProcessDashboardModel.build(input).sections.flatMap(s => s.panels).find(p => p.id === 'lead')!.notes;
 assert(leadNotes(timed).includes('With working hours, lead times and their percentiles count every elapsed minute, including the time outside them.'));
 assert(!leadNotes(plain).some(n => /working hours/.test(n)));
 assert.equal(root.LWProcessJsonPath.label(desk(), '/workingHours/closesAt'), 'Process › working hours › closesAt');
});

test('Dashboard and What-if windows count utilisation over working minutes, like the snapshot', () => {
 const timed = reads(desk(), 4320), q = timed.view.snapshot, pool = q.resources[0]!;
 // A case every 120 working minutes takes 60: four a day, so the clerk is busy for half of every working day. By Thursday 09:00 (minute
 // 4,320) three working days have passed (1,440 working minutes, 720 busy); from Tuesday 09:00 (1,440) two (960 working, 480 busy).
 assert.equal(pool.utilization, 0.5);
 const window = root.LWProcessDashboardWindow.of({...timed, window: 1440})!;
 assert.equal(window.minutes, 4320 - 1440);
 assert.equal(window.available, 960);
 assert.equal(root.LWProcessDashboardWindow.utilization(window, 'clerks', 1), 0.5);
 const report = replicate.replicate(desk(), {minutes: 4320, runs: 1, warmup: 1440});
 const kpi = (id: string) => report.kpis.find(k => k.id === id)!.mean;
 assert.equal(kpi('utilization.clerks'), 0.5);
 assert.equal(kpi('window.utilization.clerks'), 0.5);
});
