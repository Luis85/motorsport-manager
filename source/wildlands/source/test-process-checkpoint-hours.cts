/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-checkpoint.ts" />
/// <reference path="./process-hours.ts" />
/**
 * Checkpoints of working-hours runs (business-process-checkpoint suite; loaded by test-process-checkpoint.cts). A run with working
 * hours saves the ledger's `closedBy`, seven lead buckets, series frames of `width + 2` with the clock minute's openness, stream
 * cursors in working minutes and paused work's remaining minutes. Restored while closed or while open and continued across a
 * weekend, it equals the uninterrupted run byte for byte, exact percentiles included; malformed working-hours state is refused.
 */
import assert from 'node:assert/strict';
import {runtime} from './process-sdk.cjs';
import {test, build, stepOf, flowOf} from './test-process-helpers.cjs';
import {checkpoints, checkpointText, reads} from './test-process-checkpoint-helpers.cjs';
type Box = Record<string, any>;
const hours = (globalThis as unknown as {LWProcessHours: LWProcessHours.Api}).LWProcessHours;
/** 08:00 to 17:00, Monday to Friday: an open stream with random gaps, random work on two pools, a timer and an escalating deadline. */
function office(): LWProcess.Definition {
 const d = build([stepOf('start', 'start'), stepOf('triage', 'task', {duration: 20, timing: {dist: 'exponential', mean: 20}, resources: {clerks: 1},
  deadline: {after: 90, mode: 'escalate', flow: 'nudge'}}), stepOf('cool', 'timer', {duration: 45}),
 stepOf('fix', 'task', {duration: 50, timing: {dist: 'uniform', min: 30, max: 70}, resources: {fixers: 1}}), stepOf('end', 'end', {outcome: 'goal'}),
 stepOf('nudged', 'end')],
 [flowOf('start', 'triage'), flowOf('triage', 'cool'), flowOf('cool', 'fix'), flowOf('fix', 'end'),
  {id: 'nudge', from: 'triage', to: 'nudged', on: 'deadline'}],
 [{at: 30, open: true, interval: 25, gap: {dist: 'exponential', mean: 25}, data: {}}],
 [{id: 'clerks', name: 'Clerks', capacity: 1, costPerMinute: 2}, {id: 'fixers', name: 'Fixers', capacity: 2, costPerMinute: 3}]);
 return {...d, workingHours: {opensAt: 480, closesAt: 1020, daysPerWeek: 5}};
}
// Minute 700 is Monday 19:40 (closed, work paused); minute 4,600 is Thursday 12:40 (open); minute 13,000 is the next Tuesday.
const CLOSED = 700, OPEN = 4600, END = 13000;

test('A working-hours run restored while closed and while open and continued across a weekend equals the uninterrupted run byte for byte', () => {
 const d = office(), h = d.workingHours!;
 assert.deepEqual([hours.open(h, CLOSED), hours.open(h, OPEN)], [false, true]);
 for (const minute of [CLOSED, OPEN]) {
  const whole = runtime.create(d, {horizon: null});
  whole.advance(minute);
  const text = JSON.stringify(checkpoints.create(d, null, whole.state())), saved = checkpoints.verify(checkpoints.parse(text), d);
  const s = saved.snapshot, width = 12 + 11 * d.steps.length + 2 * d.resources.length;
  assert.equal(s.ledger.closedBy!.length, d.steps.length);
  assert.equal(s.ledger.leadTime.length, 7);
  assert(s.ledger.books.every(([, book]) => book.lead.length === 7));
  assert.equal(s.series!.previous.length, width + 2);
  assert.equal(s.series!.previous[width + 1], minute === OPEN ? 1 : 0, 'the frame says whether the clock minute is open');
  if (minute === CLOSED) {
   const paused = s.tokens.filter(t => t.status === 'active');
   assert(paused.length > 0 && paused.every(t => t.remaining > 0), 'paused work keeps its remaining minutes');
  }
  // The stream cursor is a working minute whose arrival begins after the clock minute.
  assert(s.streams.every(st => st.at === null || hours.at(h, st.at) > minute));
  const restored = runtime.create(d, {horizon: null, restore: saved.snapshot});
  assert.equal(reads(restored), reads(whole), minute + ': restored as saved');
  whole.advance(END - minute);
  for (let left = END - minute; left > 0; left -= 1499) restored.advance(Math.min(1499, left));
  assert.equal(reads(restored), reads(whole), minute + ': continued in chunks across the weekend');
  const percentiles = restored.distributions().percentiles!;
  assert.equal(percentiles.cycle.exact, true);
  assert.equal(JSON.stringify(percentiles), JSON.stringify(whole.distributions().percentiles));
  assert(restored.query().metrics.leadTime!.closed! > 0, 'the continued run booked closed minutes');
  whole.dispose();
  restored.dispose();
 }
});

test('Working-hours run state is checked strictly: closed books, lead buckets, frame openness, cursors and work started while closed', () => {
 const d = office(), closed = checkpointText(d, CLOSED, {horizon: null}), open = checkpointText(d, OPEN, {horizon: null});
 const cases: [string, string, LWProcess.Definition, (c: Box) => void, RegExp][] = [
  ['no closed books', closed, d, c => { delete c.snapshot.ledger.closedBy; }, /snapshot\.ledger\.closedBy is missing for a process with working hours/],
  ['closed books of the wrong length', closed, d, c => { c.snapshot.ledger.closedBy.pop(); }, /snapshot\.ledger\.closedBy must have 6 entries/],
  ['six lead buckets', closed, d, c => { c.snapshot.ledger.leadTime.pop(); }, /snapshot\.ledger\.leadTime must have 7 entries/],
  ['a book without its closed bucket', closed, d, c => { c.snapshot.ledger.books[0][1].lead.pop(); }, /\.lead must have 7 entries/],
  ['a frame without its openness', closed, d, c => { c.snapshot.series.previous.pop(); }, /snapshot\.series\.previous must have \d+ entries/],
  ['a closed minute said to be open', closed, d, c => { c.snapshot.series.previous[c.snapshot.series.previous.length - 1] = 1; },
   /does not say whether the clock minute is open/],
  ['a stream cursor already reached', open, d, c => { c.snapshot.streams[0].at = 0; }, /snapshot\.streams\[0\]\.at must begin after the clock minute/],
  ['work started while closed', closed, d, c => {
   const t = c.snapshot.tokens.find((x: Box) => x.status === 'active');
   t.started = CLOSED;
  }, /\.started is outside working hours, when no work starts/],
 ];
 for (const [label, text, definition, change, expected] of cases) {
  const value = JSON.parse(text) as Box;
  change(value);
  assert.throws(() => checkpoints.verify(value, definition), (e: Error) => expected.test(e.message), label);
 }
 assert.equal(checkpoints.verify(JSON.parse(open), d).minute, OPEN, 'the unedited checkpoints are accepted');
});
