/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-slides-contracts.d.ts" />
/// <reference path="./process-random-view.ts" />
/// <reference path="./process-time.ts" />
/// <reference path="./process-inspector.ts" />
/**
 * DOM-7 for the shared randomness sentences (LWProcessRandomView): with a display calendar the durations of `describeTiming`,
 * `describeDeadline` and `describeArrival` read in business days and weeks through `LWProcessTime.span`; without one every
 * sentence is byte-identical to the plain-minutes wording, for pinned fixtures and every step and arrival of the seven demos.
 * The slide deck and the inspector pass the definition's calendar to those sentences. Part of business-process-analysis.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {runtime, slides} from './process-sdk.cjs';
import {test, build, stepOf, flowOf, startEnd} from './test-process-helpers.cjs';
require('./process-inspector.js');
const view = (globalThis as unknown as {LWProcessRandomView: LWProcessRandomView.Api}).LWProcessRandomView;
const time = (globalThis as unknown as {LWProcessTime: LWProcessTime.Api}).LWProcessTime;
const inspector = (globalThis as unknown as {LWProcessInspector: LWProcessInspector.Api}).LWProcessInspector;
/** A business day of 8 hours and a week of 5 days. */
const CAL: LWProcess.Calendar = {minutesPerDay: 480, daysPerWeek: 5};
const CONTENT = path.resolve(__dirname, '../../../docs/concepts/agency-delivery/content');
const demos = fs.readdirSync(CONTENT).filter(f => f.endsWith('.process.json')).sort()
 .map(f => JSON.parse(fs.readFileSync(path.join(CONTENT, f), 'utf8')) as LWProcess.Definition);
const triangular = (min: number, mode: number, max: number): LWProcess.Dist => ({dist: 'triangular', min, mode, max});
const escalate = (after: number): Pick<LWProcess.Step, 'deadline'> => ({deadline: {after, mode: 'escalate', flow: 'late'}});

test('Random-view duration sentences use business days and weeks with a calendar and are byte-identical without one', () => {
 const skewed = {duration: 720, timing: triangular(240, 720, 1800)}, even = {duration: 960, timing: triangular(480, 960, 1440)};
 // Without a calendar (omitted, undefined or null) the wording is the plain-minutes wording it always was.
 for (const calendar of [undefined, null]) {
  assert.equal(view.describeTiming({duration: 2400}, calendar), 'Takes 2400 min');
  assert.equal(view.describeTiming(skewed, calendar),
   'Planned 720 min; draws average about 920 min; each visit draws its own time: Random between 240 and 1800 min, most often 720');
  assert.equal(view.describeTiming(even, calendar),
   'Planned 960 min (the average shown in estimates); each visit draws its own time: Random between 480 and 1440 min, most often 960');
  assert.equal(view.describeDeadline(escalate(2400), calendar),
   'After 2400 min of work the deadline escalates: the work keeps going and the deadline path starts beside it.');
  assert.equal(view.describeArrival({at: 30, open: true, interval: 960, data: {}}, undefined, calendar),
   'Keeps arriving: every 960 min, first at minute 30');
 }
 // With a calendar each stated duration is LWProcessTime.span of it; distribution parameters and clock minutes stay minutes.
 assert.equal(view.describeTiming({duration: 2400}, CAL), 'Takes 2,400 min (5 business days)');
 assert.equal(view.describeTiming({duration: 45}, CAL), 'Takes 45 min', 'less than one business day reads as minutes');
 assert.equal(view.describeTiming(skewed, CAL), `Planned ${time.span(720, CAL)}; draws average about ${time.span(920, CAL)}; `
  + 'each visit draws its own time: Random between 240 and 1800 min, most often 720');
 assert.match(view.describeTiming(skewed, CAL), /^Planned 720 min \(1\.5 business days\); draws average about 920 min \(≈ 1\.9 business days\); /);
 assert.equal(view.describeTiming(even, CAL), 'Planned 960 min (2 business days), the average shown in estimates; '
  + 'each visit draws its own time: Random between 480 and 1440 min, most often 960');
 assert.equal(view.describeDeadline(escalate(4800), CAL),
  'After 4,800 min (2 business weeks) of work the deadline escalates: the work keeps going and the deadline path starts beside it.');
 const random = {deadline: {timing: {dist: 'exponential', mean: 4}, mode: 'interrupt', flow: 'late'}} as Pick<LWProcess.Step, 'deadline'>;
 assert.equal(view.describeDeadline(random, CAL), view.describeDeadline(random), 'a random deadline names its distribution only');
 assert.equal(view.describeArrival({at: 600, until: 9000, interval: 960, gap: {dist: 'exponential', mean: 960}, data: {}}, undefined, CAL),
  'Until minute 9000: every ~960 min (2 business days), random gap (exponential, mean 960), first at minute 600');
 assert.equal(view.describeArrival({at: 0, count: 3, interval: 5, data: {}}, {one: 'visitor', many: 'visitors'}, CAL),
  '3 visitors: every 5 min, first at minute 0');
 // Every step and arrival of the seven demos reads exactly the same with the calendar left out, undefined or null.
 assert.equal(demos.length, 7);
 for (const d of demos) {
  for (const s of d.steps) {
   for (const calendar of [undefined, null]) {
    assert.equal(view.describeTiming(s, calendar), view.describeTiming(s), `${d.id}/${s.id} timing`);
    assert.equal(view.describeDeadline(s, calendar), view.describeDeadline(s), `${d.id}/${s.id} deadline`);
   }
   if (s.duration !== undefined && !s.timing) assert.equal(view.describeTiming(s), `Takes ${s.duration} min`, `${d.id}/${s.id}`);
  }
  for (const a of d.arrivals) assert.equal(view.describeArrival(a, undefined, null), view.describeArrival(a), d.id);
 }
});

/** One reviewed task with random timing and a two-week escalation, fed by an arrival every two business days. */
function dated(calendar?: LWProcess.Calendar): LWProcess.Definition {
 const review = stepOf('review', 'task', {name: 'Review', duration: 960, timing: triangular(480, 960, 1440), resources: {crew: 1},
  deadline: {after: 4800, mode: 'escalate', flow: 'late'}});
 const steps = startEnd(review, stepOf('chase', 'end', {name: 'Chased'}));
 const flows = [flowOf('start', 'review'), flowOf('review', 'end'), {id: 'late', from: 'review', to: 'chase', on: 'deadline' as const}];
 const d = build(steps, flows, [{at: 0, open: true, interval: 960, data: {}}], [{id: 'crew', name: 'Crew', capacity: 1, costPerMinute: 1}]);
 return calendar ? {...d, calendar} : d;
}

test('Slides and the inspector pass the display calendar to the random timing, deadline and arrival sentences', () => {
 for (const [d, timing, deadline, arrival] of [
  [dated(), 'Planned 960 min (the average', 'After 4800 min of work', 'every 960 min, first at minute 0'],
  [dated(CAL), 'Planned 960 min (2 business days), the average', 'After 4,800 min (2 business weeks) of work',
   'every 960 min (2 business days), first at minute 0'],
 ] as const) {
  const markdown = slides.markdown(slides.build(d)), s = runtime.create(d);
  try {
   const q = s.query(), review = d.steps.find(x => x.id === 'review')!;
   const at = {definition: d, snapshot: q, selected: review.id} as unknown as LWProcessApp.View;
   for (const text of [timing, deadline]) {
    assert(markdown.includes(text), `the deck says ${text}`);
    assert(inspector.step(at, review).includes(text), `the inspector says ${text}`);
   }
   assert(markdown.includes(arrival), `the deck's arrivals say ${arrival}`);
   assert(inspector.overview(at, false).includes(arrival), `the inspector's arrivals say ${arrival}`);
  } finally {
   s.dispose();
  }
 }
});
