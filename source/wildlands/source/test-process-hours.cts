/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-hours.ts" />
/**
 * Opt-in working hours (`workingHours: {opensAt, closesAt, daysPerWeek}`), engine semantics: work pauses and resumes outside
 * working time, arrival streams pause, timers and deadlines count elapsed minutes, weekends are skipped, pools charge only working
 * minutes, closed minutes are their own state, and runs stay deterministic and chunk-invariant. Every expected number is worked
 * out by hand in the comment beside it (09:00 to 17:00 is minute 0 to 480 of day 1, which is a Monday).
 */
import assert from 'node:assert/strict';
import {catalog, runtime} from './process-sdk.cjs';
import {test, agency, copy, build, stepOf, flowOf, startEnd} from './test-process-helpers.cjs';
const hours = (globalThis as unknown as {LWProcessHours: LWProcessHours.Api}).LWProcessHours;
const OFFICE: LWProcess.WorkingHours = {opensAt: 540, closesAt: 1020, daysPerWeek: 5};
const CLERKS: LWProcess.Resource[] = [{id: 'clerks', name: 'Clerks', capacity: 1, costPerMinute: 2}];
const office = (d: LWProcess.Definition, h: LWProcess.WorkingHours = OFFICE) => ({...copy(d), workingHours: h}) as LWProcess.Definition;
/** One task of `duration` minutes on one clerk, for one case arriving at working minute `at`. */
const oneTask = (at: number, duration = 60) => office(build(startEnd(stepOf('work', 'task', {duration, cost: 5, resources: {clerks: 1}})),
 [flowOf('start', 'work'), flowOf('work', 'end')], [{at, count: 1, interval: 0, data: {}}], CLERKS));
function runOf(d: LWProcess.Definition, minutes: number, options: LWProcess.RunOptions = {}): LWProcess.Snapshot {
 const s = runtime.create(d, options);
 try {
  return s.advance(minutes);
 } finally {
  s.dispose();
 }
}
const kinds = (q: LWProcess.Snapshot, kind: string) => q.events.filter(e => e.kind === kind).map(e => e.minute);

test('Working hours are optional: without them fingerprints are unchanged and always-open hours change only the closed books', () => {
 assert.equal(catalog.fingerprint(agency), 'b21c5344f7ef2ea2');
 const always = office(agency, {opensAt: 0, closesAt: 1440, daysPerWeek: 7});
 assert(catalog.validate(always).ok);
 assert.notEqual(catalog.fingerprint(always), catalog.fingerprint(agency), 'the fingerprint covers working hours');
 const plain = runOf(agency, 2400), open = runOf(always, 2400);
 // Every minute is working time, so only the added `closed` fields (all zero) tell the runs apart.
 assert.deepEqual(open.metrics.leadTime!.closed, 0);
 assert(open.steps.every(s => s.minutesBy!.closed === 0));
 const strip = (q: LWProcess.Snapshot) => {
  const c = copy(q);
  delete c.metrics.leadTime!.closed;
  for (const s of c.steps) delete s.minutesBy!.closed;
  return c;
 };
 assert.deepEqual(strip(open), plain);
 assert(!('closed' in plain.metrics.leadTime!) && plain.steps.every(s => !('closed' in s.minutesBy!)), 'no closed fields without working hours');
});

test('Working hours pause work overnight: 60 minutes started at 16:30 finish at 09:30 the next working day', () => {
 // Arrival at working minute 450 is Monday 16:30 (elapsed 450); 30 minutes run until 17:00 (480), the other 30 from Tuesday 09:00
 // (1440) to 09:30 (1470). Lead time 1,020 = 60 working + 960 closed (17:00 to 09:00).
 const q = runOf(oneTask(450), 3000);
 assert.equal(q.status, 'completed');
 assert.equal(q.minute, 1470, 'the clock stops when the last case is done');
 assert.deepEqual(q.cases.map(c => [c.entered, c.finished]), [[450, 1470]]);
 assert.deepEqual(kinds(q, 'started'), [450]);
 assert.deepEqual(kinds(q, 'finished-task'), [1470]);
 assert.deepEqual(q.metrics.leadTime, {working: 60, waiting: 0, blocked: 0, backlog: 0, timer: 0, joining: 0, closed: 960});
 assert.equal(q.metrics.cycleSum, 1020);
 assert.deepEqual(q.steps.find(s => s.id === 'work')!.minutesBy, {waiting: 0, working: 60, blocked: 0, backlog: 0, timer: 0, joining: 0, closed: 960});
 assert.deepEqual(q.receipts.map(r => [r.started, r.finished]), [[450, 1470]]);
 const mid = runtime.create(oneTask(450));
 try {
  const night = mid.advance(600);
  // At 19:00 the work is paused, not blocked: it holds its clerk and has 30 minutes left.
  assert.equal(night.status, 'running');
  assert.deepEqual(night.tokens.map(t => [t.status, t.remaining]), [['active', 30]]);
  assert.equal(night.resources[0]!.busy, 1);
 } finally {
  mid.dispose();
 }
});

test('Working hours charge pools only in working time: work cost, capacity cost and utilisation', () => {
 // Work cost: fixed 5 + 60 working minutes × 2 = 125 (the paused night charges nothing). Capacity cost: 1 × 2 × 510 working minutes
 // by minute 1,470 (480 on Monday, 30 on Tuesday) = 1,020. Utilisation 60 / 510.
 const q = runOf(oneTask(450), 3000), pool = q.resources[0]!;
 assert.equal(q.metrics.cost, 125);
 assert.equal(pool.busyMinutes, 60);
 assert.equal(pool.workCost, 120);
 assert.equal(pool.capacityCost, 1020);
 assert.equal(q.metrics.capacityCost, 1020);
 assert.equal(pool.utilization, 60 / 510);
 assert.deepEqual(q.metrics.costOf, {completed: 125, failed: 0});
 // Throughput per hour stays on the elapsed clock: 1 case in 1,470 minutes.
 assert.equal(q.metrics.throughputPerHour, 60 / 1470);
 assert.equal(hours.working(OFFICE, 1470), 510);
});

test('Working hours skip weekends: work started on Friday at 16:30 finishes on Monday at 09:30', () => {
 // Working minute 2,370 is Friday 16:30 (day 5): elapsed 4 × 1,440 + 450 = 6,210. 30 minutes until 17:00, then closed until Monday
 // of day 8 at 09:00 (elapsed 10,080), finishing at 10,110. Closed: 10,110 − 6,210 − 60 = 3,840 minutes.
 const q = runOf(oneTask(2370), 20000);
 assert.deepEqual(q.cases.map(c => [c.entered, c.finished]), [[6210, 10110]]);
 assert.deepEqual(q.metrics.leadTime, {working: 60, waiting: 0, blocked: 0, backlog: 0, timer: 0, joining: 0, closed: 3840});
 assert.deepEqual(hours.where(OFFICE, 10110), {day: 8, weekday: 0, minuteOfDay: 570, open: true, opens: 10110});
 assert.deepEqual(hours.where(OFFICE, 6240), {day: 5, weekday: 4, minuteOfDay: 1020, open: false, opens: 10080});
});

test('Working hours pause arrival streams: no case arrives while closed and a gap resumes at the next opening', () => {
 // A stream every 200 working minutes from working minute 0: 0, 200, 400 on Monday; 600 is 120 minutes into Tuesday (1,560).
 // A stream starting at working minute 480 (the closing) arrives at Tuesday's opening, never at 17:00. Waiting stays 0 overnight.
 const d = office(build(startEnd(stepOf('work', 'task', {duration: 10, resources: {clerks: 1}})), [flowOf('start', 'work'), flowOf('work', 'end')],
  [{at: 0, count: 4, interval: 200, data: {}}, {at: 480, count: 1, interval: 0, data: {}}], CLERKS));
 const q = runOf(d, 3000);
 assert.deepEqual(kinds(q, 'arrived'), [0, 200, 400, 1440, 1560]);
 assert.deepEqual(q.cases.map(c => c.id), ['case-0001', 'case-0002', 'case-0003', 'case-0004', 'case-0005']);
 assert(kinds(q, 'arrived').every(m => hours.open(OFFICE, m)));
 assert.equal(q.metrics.leadTime!.waiting, 0);
 // `until` counts working minutes too: arrivals at 0, 300 and 600 (Tuesday 10:00, elapsed 1,560) while earlier than 700.
 const until = office(build(startEnd(), [flowOf('start', 'end')], [{at: 0, until: 700, interval: 300, data: {}}]));
 assert.deepEqual(kinds(runOf(until, 3000), 'arrived'), [0, 300, 1560]);
});

test('Timers and deadlines count elapsed minutes across a closed period', () => {
 // A 120-minute timer entered at 16:30 fires at 18:30 (570) while closed; the task after it waits for Tuesday 09:00 (1,440).
 const timed = office(build(startEnd(stepOf('wait', 'timer', {duration: 120}), stepOf('work', 'task', {duration: 30, resources: {clerks: 1}})),
  [flowOf('start', 'wait'), flowOf('wait', 'work'), flowOf('work', 'end')], [{at: 450, count: 1, interval: 0, data: {}}], CLERKS));
 const q = runOf(timed, 3000);
 assert.deepEqual(kinds(q, 'timer-fired'), [570]);
 assert.deepEqual(kinds(q, 'started'), [1440]);
 assert.deepEqual(q.cases.map(c => c.finished), [1470]);
 // Timer minutes 450..480 are on the timer; the closed books take 480..1440 whatever the state (timer, then waiting).
 assert.deepEqual(q.metrics.leadTime, {working: 30, waiting: 0, blocked: 0, backlog: 0, timer: 30, joining: 0, closed: 960});
 // A 120-minute task with a 60-minute interrupting deadline started at 16:30 is cut at 17:30 (510), while it is paused.
 const late = office(build([stepOf('start', 'start'), stepOf('work', 'task', {duration: 120, resources: {clerks: 1},
  deadline: {after: 60, mode: 'interrupt', flow: 'late'}}), stepOf('end', 'end'), stepOf('late-end', 'end')],
 [flowOf('start', 'work'), flowOf('work', 'end'), {id: 'late', from: 'work', to: 'late-end', on: 'deadline'}],
 [{at: 450, count: 1, interval: 0, data: {}}], CLERKS));
 const cut = runOf(late, 3000);
 assert.deepEqual(kinds(cut, 'deadline-interrupt'), [510]);
 assert.deepEqual(cut.cases.map(c => [c.status, c.finished]), [['completed', 510]]);
 assert.equal(cut.resources[0]!.busyMinutes, 30, 'only the 30 working minutes before 17:00 were worked');
});

/** A busier process: an open stream with random gaps, random task timing, a timer, an escalating deadline and two pools. */
function busy(): LWProcess.Definition {
 return office(build([stepOf('start', 'start'), stepOf('triage', 'task', {duration: 20, timing: {dist: 'exponential', mean: 20}, resources: {clerks: 1},
  deadline: {after: 90, mode: 'escalate', flow: 'nudge'}}), stepOf('cool', 'timer', {duration: 45}),
 stepOf('fix', 'task', {duration: 50, timing: {dist: 'uniform', min: 30, max: 70}, resources: {fixers: 1}}), stepOf('end', 'end'), stepOf('nudged', 'end')],
 [flowOf('start', 'triage'), flowOf('triage', 'cool'), flowOf('cool', 'fix'), flowOf('fix', 'end'),
  {id: 'nudge', from: 'triage', to: 'nudged', on: 'deadline'}],
 [{at: 30, open: true, interval: 25, gap: {dist: 'exponential', mean: 25}, data: {}}],
 [...CLERKS, {id: 'fixers', name: 'Fixers', capacity: 2, costPerMinute: 3}]), {opensAt: 480, closesAt: 1020, daysPerWeek: 5});
}

test('Working-hours runs are deterministic and chunk-invariant: random chunkings equal one advance', () => {
 const total = 12000, d = busy(), whole = runtime.create(d);
 const read = (s: LWProcess.Session) => ({q: s.query(), series: s.series(), distributions: s.distributions(), recent: s.recent()});
 let expected: ReturnType<typeof read>;
 try {
  whole.advance(total);
  expected = read(whole);
 } finally {
  whole.dispose();
 }
 assert(expected.q.metrics.completed > 50, 'the stream keeps the run busy');
 assert(expected.q.metrics.leadTime!.closed! > 0);
 assert(kinds(expected.q, 'arrived').every(m => hours.open(d.workingHours!, m)));
 // A fixed linear congruential sequence of chunk lengths (1 to 997 minutes), so the check is itself deterministic.
 let x = 12345;
 const next = () => (x = (x * 1103515245 + 12345) % 2147483648) % 997 + 1;
 for (let round = 0; round < 3; round++) {
  const s = runtime.create(d);
  try {
   for (let left = total; left > 0;) {
    const n = Math.min(left, next());
    s.advance(n);
    left -= n;
   }
   assert.deepEqual(read(s), expected, 'chunking ' + round);
  } finally {
   s.dispose();
  }
 }
 const again = runtime.create(d);
 try {
  again.advance(total);
  assert.deepEqual(read(again), expected, 'a rerun with the same seed is identical');
 } finally {
  again.dispose();
 }
});

test('Working hours keep the series exact: closed intervals grow only the WIP area', () => {
 const s = runtime.create(oneTask(450), {series: {every: 60, points: 64}});
 try {
  s.advance(1500);
  const series = s.series()!, at = (m: number) => series.minutes.indexOf(m);
  // Paused overnight: one case in progress the whole time, so the WIP area grows by 60 per hour; work cost and busy minutes do not.
  assert.equal(series.run.wipArea[at(1380)]! - series.run.wipArea[at(540)]!, 840);
  assert.equal(series.run.cost[at(1380)], series.run.cost[at(540)]);
  assert.equal(series.pools.clerks!.busyMinutes[at(1380)], 30);
  assert.equal(series.steps.work!.waitingArea[at(1380)], 0);
 } finally {
  s.dispose();
 }
});
