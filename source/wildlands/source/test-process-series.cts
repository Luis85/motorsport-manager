/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-application.ts" />
/**
 * Sampled time series and fine distributions of the dashboard read model (business-process suite; loaded by test-process.cts):
 * the exact fill rule over quiet minutes, decimation at K + 1 samples with merged peaks, a 100,000-minute open stream within K,
 * the option checks and memory bound, and the application controller's detached reads that never tick. The every-demo sample and
 * distribution sweeps run in their own suite (test-process-sweeps.cts).
 */
import assert from 'node:assert/strict';
import {runtime} from './process-sdk.cjs';
import {application, test, base, build, stepOf, flowOf, startEnd} from './test-process-helpers.cjs';
import {reads, sample, fromSnapshot, withoutPeaks} from './test-process-readmodel-helpers.cjs';
const steps = (n: number) => Array.from({length: n}, (_, i) => i);
test('Series fill quiet minutes exactly: a two-case FIFO queue sampled every minute matches the hand-computed run', () => {
 const d = base();
 d.resources = [{id: 'worker', name: 'Worker', capacity: 1, costPerMinute: 2}];
 Object.assign(d.steps[1]!, {resources: {worker: 1}, cost: 7});
 d.arrivals[0]!.count = 2;
 const s = reads(d, [20], {series: {every: 1, points: 64}}).series!;
 assert.deepEqual([s.base, s.every, s.level, s.count, s.offset, s.perSample, s.points], [1, 1, 0, 11, 0, 12 + 33 + 2, 64]);
 assert.deepEqual(s.minutes, steps(11));
 assert.deepEqual(s.run.wip, [2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 0]);
 assert.deepEqual(s.run.wipArea, [0, 2, 4, 6, 8, 10, 11, 12, 13, 14, 15]);
 assert.deepEqual(s.run.cost, [7, 9, 11, 13, 15, 24, 26, 28, 30, 32, 34], 'fixed cost at each start, 2 per busy minute');
 assert.deepEqual(s.run.completed, [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2]);
 assert.deepEqual(s.steps.work!.waiting, [1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0]);
 assert.deepEqual(s.steps.work!.waitingArea, [0, 1, 2, 3, 4, 5, 5, 5, 5, 5, 5]);
 assert.deepEqual(s.pools.worker!.busyMinutes, steps(11));
 const coarse = reads(d, [20], {series: {every: 4, points: 64}}).series!;
 assert.deepEqual([coarse.minutes, coarse.run.wipArea, coarse.run.wipPeak], [[0, 4, 8], [0, 8, 13], [2, 2, 1]], 'peaks of (0, 4] and (4, 8]');
});

test('Series decimate at K + 1 samples by doubling with merged peaks, and a 100,000-minute open stream stays within K', () => {
 const d = build(startEnd(stepOf('work', 'task', {duration: 3})), [flowOf('start', 'work'), flowOf('work', 'end')],
  [{at: 0, open: true, interval: 2, data: {}}]);
 const s = runtime.create(d, {series: {every: 1, points: 64}, horizon: null});
 s.advance(63);
 const full = s.series()!;
 assert.deepEqual([full.count, full.level, full.every], [64, 0, 1]);
 s.advance(1);
 const halved = s.series()!;
 assert.deepEqual([halved.count, halved.level, halved.every, halved.minutes], [33, 1, 2, steps(33).map(i => i * 2)]);
 for (let i = 1; i < 32; i++) {
  assert.equal(halved.run.wipPeak[i], Math.max(full.run.wipPeak[2 * i - 1]!, full.run.wipPeak[2 * i]!), 'merged peak ' + i);
  assert.equal(halved.run.wipArea[i], full.run.wipArea[2 * i], 'cumulatives are subsampled');
 }
 assert.deepEqual(s.series({level: 0, count: 64}), halved, 'a stale level returns every column again');
 const tail = s.series({level: 1, count: 30})!;
 assert.deepEqual([tail.offset, tail.minutes], [30, [60, 62, 64]], 'the current level returns only the new samples');
 s.dispose();
 const sparse = build(startEnd(stepOf('work', 'task', {duration: 10})), [flowOf('start', 'work'), flowOf('work', 'end')],
  [{at: 0, open: true, interval: 997, data: {}}]);
 const long = reads(sparse, [100000], {series: {every: 1, points: 64}, horizon: null});
 assert.deepEqual([long.series!.level, long.series!.every, long.series!.count], [11, 2048, 49], 'the smallest level whose grid fits in 64');
 const last = long.series!.count - 1;
 assert.deepEqual(withoutPeaks(sample(long.series!, last)), fromSnapshot(reads(sparse, [long.series!.minutes[last]!], {horizon: null}).q));
 const pieces = reads(sparse, [1, 99999], {series: {every: 1, points: 64}, horizon: null});
 assert.deepEqual(pieces.series, long.series, 'raising the level before a long quiet stretch is chunk-invariant');
});

test('Series options are validated, bounded by 400,000 values, and false turns the series off without changing the run', () => {
 const d = base();
 for (const [series, message] of [[{every: 0}, /every\) must be a whole number of minutes from 1 to 10000/], [{every: 1.5}, /every/],
  [{points: 63}, /points must be a whole number from 64 to 960/], [{points: 961}, /points/], [null, /must be false or an object/]] as const) {
  assert.throws(() => runtime.create(d, {series: series as never}), message);
 }
 const off = runtime.create(d, {series: false});
 assert.equal(off.series(), null);
 off.dispose();
 assert.deepEqual(reads(d, [30], {series: false}).q, reads(d, [30]).q, 'the series never changes a snapshot');
 const tasks = steps(126).map(i => stepOf('t' + i, 'task', {duration: 1, ...i < 32 ? {resources: {['p' + i]: 1}} : {}}));
 const wide = build(startEnd(...tasks), steps(127).map(i => flowOf(i ? 't' + (i - 1) : 'start', i < 126 ? 't' + i : 'end')), undefined,
  steps(32).map(i => ({id: 'p' + i, name: 'Pool ' + i, capacity: 1, costPerMinute: 1})));
 const big = reads(wide, [10]).series!;
 assert.deepEqual([big.perSample, big.points], [1484, 269], 'the schema maximum of 128 steps and 32 pools caps K at 269');
 assert(big.points * big.perSample <= 400000);
});

test('The application controller reads series, distributions and recent cases detached, while playing, without ticking', () => {
 const d = {...base(), arrivals: [{at: 0, interval: 7, data: {}, open: true}]} as unknown as LWProcess.Definition;
 const app = application.create(d);
 app.horizon(null); app.advance(600); app.play(true);
 const before = app.query().snapshot, series = app.series()!, distributions = app.distributions(), recent = app.recent();
 assert.deepEqual(app.query().snapshot, before, 'reads never tick');
 assert.equal(app.query().playing, true, 'and never pause');
 const direct = reads(d, [600], {horizon: null});
 assert.deepEqual([series, distributions, recent], [direct.series, direct.distributions, direct.recent]);
 series.run.wip[0] = -1; recent[0]!.caseId = 'changed'; distributions.cycle[0] = -1;
 assert.deepEqual([app.series(), app.distributions(), app.recent()], [direct.series, direct.distributions, direct.recent], 'detached copies');
 app.pulse(60);
 const next = app.series({level: series.level, count: series.count})!;
 assert.deepEqual([next.offset, next.minutes], [series.count, [660]], 'an incremental read after a pulse');
 app.dispose();
 assert.throws(() => app.series(), /disposed/);
});
