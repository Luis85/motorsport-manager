/// <reference path="./process-contracts.d.ts" />
/**
 * Read-model checks for the dashboard data (business-process suite; loaded by test-process.cts): WIP area and cycle sum, minutes by
 * status, dominant-state lead time and flow efficiency, attributed cost and failed lifetimes, first pass and repeat visits, failures
 * by step and the recent finished cases, pinned on hand-computed fixtures. The every-demo identity, chunking and pruning sweeps
 * run in their own suite (test-process-sweeps.cts).
 */
import assert from 'node:assert/strict';
import {test, base, build, stepOf, flowOf, startEnd} from './test-process-helpers.cjs';
import {reads} from './test-process-readmodel-helpers.cjs';
const sum = (values: number[]) => values.reduce((n, v) => n + v, 0);
const zero = {waiting: 0, working: 0, blocked: 0, backlog: 0, timer: 0, joining: 0};
/** The base sample with a one-unit pool at 2 per minute, a fixed cost of 7 and two cases arriving at minute 0. */
function fifo(): LWProcess.Definition {
 const d = base();
 d.resources = [{id: 'worker', name: 'Worker', capacity: 1, costPerMinute: 2}];
 d.steps[1]!.resources = {worker: 1};
 d.steps[1]!.cost = 7;
 d.arrivals[0]!.count = 2;
 return d;
}

test('Read model pins minutes by status, dominant-state lead time, flow efficiency, attributed cost and recent cases for a FIFO queue', () => {
 const {q, recent} = reads(fifo(), [20]), m = q.metrics, work = q.steps.find(x => x.id === 'work')!;
 // Case 1 works minutes 1-5; case 2 waits minutes 1-5 and works 6-10. Each start charges 7, each busy minute 2.
 assert.equal(q.minute, 10);
 assert.deepEqual(work.minutesBy, {...zero, waiting: 5, working: 10});
 assert.deepEqual(q.steps.filter(x => x.id !== 'work').map(x => [x.minutesBy, x.failed]), [[zero, 0], [zero, 0]]);
 assert.deepEqual([m.wipArea, m.cycleSum, m.leadTime], [15, 15, {...zero, working: 10, waiting: 5}]);
 assert.deepEqual(m.flowEfficiency, {counts: [0, 0, 0, 0, 0, 1, 0, 0, 0, 1]}, 'a 50% case and a 100% case');
 assert.deepEqual([m.costOf, m.failedMinutes, m.firstPass, m.repeats], [{completed: 34, failed: 0}, 0, 2, {counts: [2, 0, 0, 0, 0, 0]}]);
 assert.deepEqual(recent, [
  {caseId: 'case-0001', entered: 0, finished: 5, status: 'completed', end: 'end', outcome: null, repeats: 0, working: 5},
  {caseId: 'case-0002', entered: 0, finished: 10, status: 'completed', end: 'end', outcome: null, repeats: 0, working: 5}]);
 const open = reads(fifo(), [7]).q.metrics;
 assert.deepEqual([open.wipArea, open.cycleSum, open.costOf, open.cost], [12, 5, {completed: 17, failed: 0}, 28], 'case 2 holds 7 + 2 × 2');
});

test('Read model counts repeat entries at non-join steps only and attributes a failure with its lifetime and cost to its step', () => {
 const loop = build(startEnd(stepOf('work', 'task', {duration: 2, add: {n: 1}}), stepOf('check', 'decision')),
  [flowOf('start', 'work'), flowOf('work', 'check'), flowOf('check', 'work', {field: 'n', op: 'lt', value: 3}), flowOf('check', 'end')],
  [{at: 0, count: 1, interval: 0, data: {n: 0}}]);
 const looped = reads(loop, [50]);
 assert.deepEqual([looped.q.metrics.firstPass, looped.q.metrics.repeats], [0, {counts: [0, 0, 0, 0, 1, 0]}], 'work and check entered 3 times each');
 assert.equal(looped.recent[0]!.repeats, 4);
 const join = build([stepOf('start', 'start'), stepOf('split', 'fork', {join: 'merge'}), stepOf('a', 'task', {duration: 3}),
  stepOf('b', 'task', {duration: 5}), stepOf('merge', 'join'), stepOf('end', 'end')],
  [flowOf('start', 'split'), flowOf('split', 'a'), flowOf('split', 'b'), flowOf('a', 'merge'), flowOf('b', 'merge'), flowOf('merge', 'end')]);
 const joined = reads(join, [20]), merge = joined.q.steps.find(x => x.id === 'merge')!;
 assert.deepEqual([joined.q.metrics.firstPass, joined.q.metrics.repeats!.counts[0], merge.entered, merge.reached], [1, 1, 2, 1], 'a join takes two entries');
 assert.deepEqual([merge.minutesBy, joined.q.metrics.leadTime], [{...zero, joining: 2}, {...zero, working: 5}], 'b is worked while a waits');
 const bad = build(startEnd(stepOf('work', 'task', {duration: 2, add: {n: 1}, resources: {worker: 1}, cost: 3})),
  [flowOf('start', 'work'), flowOf('work', 'end')], [{at: 0, count: 1, interval: 0, data: {n: 'x'}}],
  [{id: 'worker', name: 'Worker', capacity: 1, costPerMinute: 1}]);
 const failed = reads(bad, [10]), m = failed.q.metrics;
 assert.deepEqual([m.failed, m.failedMinutes, m.costOf, m.cost, m.wipArea], [1, 2, {completed: 0, failed: 5}, 5, 2]);
 assert.deepEqual(failed.q.steps.map(x => x.failed), [0, 1, 0], 'the unsafe add names the work step');
 assert.deepEqual(failed.recent, [{caseId: 'case-0001', entered: 0, finished: 2, status: 'failed', end: null, outcome: null, repeats: 0, working: null}]);
 assert.equal(failed.distributions.failed[2], 1, 'a 2-minute lifetime in the 2-3 bin');
});

