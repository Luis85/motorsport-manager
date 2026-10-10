/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-ledger.ts" />
/**
 * Entry of the business-process-readmodel suite: the every-demo sweeps of the dashboard read model, kept apart from the
 * business-process suite for its time budget. Identities (WIP area, lead time, cost, failures, repeats, recent cases), random
 * chunkings, one-minute advances and pruning, series samples equal to a run stopped at their minute, and fine distributions that
 * reproduce the coarse histogram; then the engine fast-path checks on the generated 128-step process (test-process-scale.cts).
 * One result file is written.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test, results} from './test-process-helpers.cjs';
import {demos, reads, chunking, demoRun, SPAN, SHARED, sample, fromSnapshot, withoutPeaks, CUMULATIVE, STEP_CUMULATIVE}
 from './test-process-readmodel-helpers.cjs';
import {scaleChecks} from './test-process-scale.cjs';
const ledgerApi = (globalThis as unknown as {LWProcessLedger: LWProcessLedger.Api}).LWProcessLedger;
const sum = (values: number[]) => values.reduce((n, v) => n + v, 0);

test('Every demo satisfies the read-model identities: WIP area, lead time, cost, failures, repeats and recent cases', () => {
 for (const d of demos()) {
  const {q, recent} = demoRun(d), m = q.metrics, id = d.id;
  const cases = (status: string) => q.cases.filter(c => c.status === status);
  const lifetimes = (status: string) => sum(cases(status).map(c => c.finished! - c.entered));
  assert.equal(m.cycleSum, lifetimes('completed'), id + ': cycle sum');
  assert.equal(m.failedMinutes, lifetimes('failed'), id + ': failed lifetimes');
  assert.equal(m.wipArea, m.cycleSum! + m.failedMinutes! + sum(cases('active').map(c => q.minute - c.entered)), id + ': Little\'s A');
  assert.equal(sum(Object.values(m.leadTime!)), m.cycleSum, id + ': the six lead-time buckets sum to the cycle sum');
  assert.equal(sum(m.flowEfficiency!.counts), m.completed, id + ': flow efficiency bins');
  assert.equal(sum(m.repeats!.counts), m.completed, id + ': repeat bins');
  assert.equal(m.firstPass, m.repeats!.counts[0], id + ': first pass');
  assert(m.costOf!.completed + m.costOf!.failed <= m.cost, id + ': attributed cost');
  if (!cases('active').length) assert.equal(m.costOf!.completed + m.costOf!.failed, m.cost, id + ': no open case holds cost');
  assert(sum(q.steps.map(x => x.failed!)) <= m.failed, id + ': failures by step');
  assert.equal(sum(q.steps.map(x => sum(Object.values(x.minutesBy!)))) >= m.wipArea!, true, id + ': every case-minute has a token');
  const finished = [...cases('completed'), ...cases('failed')].map(c => [c.id, c.entered, c.finished, c.status]).sort();
  assert.deepEqual(recent.map(r => [r.caseId, r.entered, r.finished, r.status]).sort(), finished, id + ': recent holds every finished case');
  assert(recent.every((r, i) => !i || recent[i - 1]!.finished <= r.finished), id + ': recent cases are oldest first');
  for (const r of recent.filter(r => r.status === 'completed')) assert(r.working! <= r.finished - r.entered && r.end !== null, id + '/' + r.caseId);
 }
});

test('Read-model values, distributions, series and recent cases are identical under random chunkings, one-minute advances and pruning', () => {
 const reduced = (r: ReturnType<typeof reads>) => ({metrics: r.q.metrics, steps: r.q.steps, series: r.series, distributions: r.distributions});
 for (const d of demos()) {
  const whole = demoRun(d);
  for (const seed of [1, 2, 3]) {
   const pieces = reads(d, chunking(SPAN, seed * 7919 + d.id.length, 400), SHARED);
   assert.deepEqual({...reduced(pieces), recent: pieces.recent}, {...reduced(whole), recent: whole.recent}, d.id + ': chunking ' + seed);
  }
  const pruned = reads(d, [SPAN], {...SHARED, retained: 1});
  assert.deepEqual(reduced(pruned), reduced(whole), d.id + ': pruning');
  assert.deepEqual(pruned.recent, whole.recent.slice(-1), d.id + ': the recent ring keeps the latest retained case');
 }
 // One-minute advances return a full snapshot each, so they run (with one retained case) on the demos with pools, timers, outcomes and loops.
 const rich = demos().filter(x => ['order-fulfilment-line', 'user-journey-app-onboarding', 'loan-application'].includes(x.id));
 assert.equal(rich.length, 3);
 for (const d of rich) {
  const small = {...SHARED, retained: 1}, once = reads(d, [1000], small), minutes = reads(d, Array.from({length: 1000}, () => 1), small);
  assert.deepEqual(minutes, once, d.id + ': 1,000 one-minute advances equal one 1,000-minute advance');
 }
});

test('Every demo samples the state at the end of each grid minute, with monotone cumulatives and areas equal to minutes by status', () => {
 for (const d of demos()) {
  const s = demoRun(d).series!;
  assert(s.count <= s.points && s.minutes.every((m, i) => m === i * s.every), d.id + ': the grid');
  for (const i of new Set([s.count >> 1, s.count - 1].filter(i => i > 0))) {
   assert.deepEqual(withoutPeaks(sample(s, i)), fromSnapshot(reads(d, [s.minutes[i]!]).q), d.id + ': sample at minute ' + s.minutes[i]);
  }
  const columns = [...CUMULATIVE.map(k => s.run[k]), ...Object.values(s.steps).flatMap(b => STEP_CUMULATIVE.map(k => b[k])),
   ...Object.values(s.pools).map(p => p.busyMinutes)];
  for (const c of columns) assert(c.every((v, i) => !i || c[i - 1]! <= v), d.id + ': cumulative columns never fall');
  assert(s.run.wipPeak.every((v, i) => v >= s.run.wip[i]!), d.id + ': a peak covers its own minute');
 }
});

test('Fine distributions use 54 edges whose sums reproduce the coarse histogram, count every start, visit, timer and finish', () => {
 const fine = ledgerApi.FINE;
 assert.equal(fine.length, 54);
 assert(ledgerApi.EDGES.every(e => fine.includes(e)), 'a superset of the coarse edges');
 assert(fine.every((e, i) => i < 3 || e <= fine[i - 1]! * 1.5), 'consecutive edges within 1.5× above 2 minutes');
 for (const d of demos()) {
  const {q, distributions: x} = demoRun(d), m = q.metrics, coarse = ledgerApi.EDGES;
  assert.deepEqual(x.edges, [...fine]);
  const regrouped = coarse.map((e, i) => sum(x.cycle.filter((_, j) => fine[j]! >= e && (i + 1 === coarse.length || fine[j]! < coarse[i + 1]!))));
  assert.deepEqual(regrouped, m.cycleHistogram.counts, d.id + ': fine bins sum to the coarse histogram');
  assert.deepEqual([sum(x.cycle), sum(x.failed)], [m.completed, m.failed], d.id);
  const outcomes = d.steps.some(s => s.kind === 'end' && s.outcome);
  assert.equal(x.byOutcome !== undefined, outcomes, d.id + ': by outcome only when an end declares one');
  if (x.byOutcome) assert.deepEqual([sum(x.byOutcome.goal), sum(x.byOutcome.lost), sum(Object.values(x.byOutcome).flat())], [m.goals, m.lost, m.completed]);
  for (const step of d.steps) {
   const got = x.steps[step.id]!, metric = q.steps.find(s => s.id === step.id)!, works = ['task', 'touchpoint', 'machine', 'system'].includes(step.kind);
   assert.equal(sum(got.wait), metric.starts, d.id + '/' + step.id + ': one wait per start');
   assert.equal(sum(got.service), works ? metric.completed : 0, d.id + '/' + step.id + ': one service time per completed work visit');
   assert.equal(sum(got.exitAge), works || step.kind === 'timer' ? metric.completed : 0, d.id + '/' + step.id + ': exit ages');
  }
 }
});

scaleChecks();

const report = {suite: 'business-process-readmodel', passed: results.filter(r => r.passed).length, total: results.length, results};
fs.writeFileSync(path.join(__dirname, 'process-readmodel-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`${report.passed}/${report.total} process read-model checks passed`);
for (const r of results) if (!r.passed) console.error(r.name, r.error);
if (report.passed !== report.total) process.exitCode = 1;
