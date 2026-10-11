/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-replicate.ts" />
/**
 * Replication warm-up windows, sliced runners and their disposal, and `--warmup` on the process CLI (business-process suite;
 * loaded by test-process.cts after the read-model checks).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {runtime, replicate} from './process-sdk.cjs';
import {test, base, build, stepOf, flowOf, startEnd} from './test-process-helpers.cjs';
import {chunking} from './test-process-readmodel-helpers.cjs';
const CLI = path.join(__dirname, 'tools/wildlands-cli.cjs');
const ORDERS = path.resolve(__dirname, '../../../docs/concepts/agency-delivery/content/order-fulfilment.process.json');
/** A small open queue with random gaps and work on a crew of `capacity` (cost 1 per minute). */
const queue = (capacity: number) => build(
 startEnd(stepOf('work', 'task', {duration: 8, timing: {dist: 'exponential', mean: 8, max: 60}, resources: {crew: 1}})),
 [flowOf('start', 'work'), flowOf('work', 'end')], [{at: 0, until: 2000, interval: 10, gap: {dist: 'exponential', mean: 10, max: 60}, data: {}}],
 [{id: 'crew', name: 'Crew', capacity, costPerMinute: 1}]);
/** Drives a runner with `advance` over a fixed list of budgets (repeated) until it reports false. */
function sliced<R>(runner: LWProcessReplicate.Runner<R>, budgets: number[]): R {
 let i = 0;
 while (runner.advance(budgets[i++ % budgets.length]!)) { /* the next slice */ }
 return runner.report();
}

test('Replication warm-up adds windowed KPIs after minute W from differences of cumulative totals, and leaves plans without it unchanged', () => {
 const d = queue(1), report = replicate.replicate(d, {minutes: 600, runs: 3, seed: 4, warmup: 120});
 assert.equal(report.warmup, 120);
 const windowed = report.kpis.filter(k => k.id.startsWith('window.')).map(k => [k.id, k.label]);
 assert.deepEqual(windowed, [['window.completed', 'Completed cases after minute 120'], ['window.failed', 'Failed cases after minute 120'],
  ['window.dropped', 'Dropped arrivals after minute 120'], ['window.workCost', 'Work cost after minute 120'],
  ['window.capacityCost', 'Capacity cost after minute 120'], ['window.meanCycleMinutes', 'Mean cycle of cases finished after minute 120 (minutes)'],
  ['window.meanWip', 'Mean work in progress after minute 120'], ['window.throughputPerHour', 'Throughput after minute 120 (completed per hour)'],
  ['window.utilization.crew', 'Utilisation of Crew after minute 120']]);
 report.rows.forEach((row, i) => {
  const s = runtime.create(d, {seed: 4 + i}), w = s.advance(120), q = s.advance(480), a = w.metrics, b = q.metrics;
  s.dispose();
  const done = b.completed - a.completed;
  assert.deepEqual(row.values, {...replicate.measure(d, q), 'window.completed': done, 'window.failed': b.failed - a.failed,
   'window.dropped': b.dropped - a.dropped, 'window.workCost': b.cost - a.cost, 'window.capacityCost': 480,
   'window.meanCycleMinutes': done ? (b.cycleSum! - a.cycleSum!) / done : null, 'window.meanWip': (b.wipArea! - a.wipArea!) / 480,
   'window.throughputPerHour': done * 60 / 480, 'window.utilization.crew': (q.resources[0]!.busyMinutes - w.resources[0]!.busyMinutes) / 480});
 });
 const plain = replicate.replicate(d, {minutes: 600, runs: 3, seed: 4});
 assert.equal('warmup' in plain, false);
 assert.deepEqual(plain.rows.map(r => r.seed), report.rows.map(r => r.seed));
 assert.deepEqual(plain.kpis, report.kpis.filter(k => !k.id.startsWith('window.')), 'the whole-run KPIs are the same with a warm-up');
 const zero = replicate.replicate(d, {minutes: 600, runs: 2, warmup: 0}).kpis, whole = replicate.replicate(d, {minutes: 600, runs: 2}).kpis;
 assert.deepEqual(zero.find(k => k.id === 'window.completed')!.mean, whole.find(k => k.id === 'completed')!.mean, 'a window from minute 0');
 const stops = replicate.replicate(base(), {minutes: 100, runs: 1, warmup: 50}).rows[0]!;
 assert.deepEqual([stops.minute, stops.values['window.completed'], stops.values['window.meanWip']], [5, 0, null], 'stopped before W: empty window');
 for (const warmup of [-1, 600, 1.5]) {
  assert.throws(() => replicate.replicate(d, {minutes: 600, runs: 1, warmup}), /Warm-up must be a whole number of minutes from 0 to 599\./);
 }
 const compared = replicate.compare(queue(2), d, {minutes: 600, runs: 3, warmup: 120});
 assert.equal(compared.kpis.find(k => k.id === 'window.capacityCost')!.difference.mean, 480, 'one more unit for the 480-minute window');
});

test('Sliced replication runners advance within a minute budget and report exactly what step() reports, then dispose their session', () => {
 const d = queue(1), options = {minutes: 700, runs: 4, seed: 2, warmup: 100};
 const stepped = replicate.replicate(d, options);
 for (const budgets of [[1000000], [1], [7, 333, 50], chunking(5000, 3, 400)]) {
  assert.deepEqual(sliced(replicate.replications(d, options), budgets), stepped, 'budgets ' + budgets.slice(0, 3).join(','));
 }
 const pairs = replicate.compare(queue(2), d, options);
 assert.deepEqual(sliced(replicate.comparison(queue(2), d, options), [90, 1, 400]), pairs);
 const mixed = replicate.replications(d, options);
 mixed.advance(350); assert.equal(mixed.done(), 0, 'half a replication');
 mixed.step(); assert.equal(mixed.done(), 1, 'step finishes the open replication');
 while (mixed.advance(600)) { /* the rest */ }
 assert.deepEqual([mixed.report(), mixed.advance(5), mixed.step()], [stepped, false, false]);
 const created = runtime.create, live = new Set<LWProcess.Session>();
 runtime.create = (input, opts) => {
  const s = created(input, opts), dispose = s.dispose;
  live.add(s);
  s.dispose = () => { live.delete(s); dispose(); };
  return s;
 };
 try {
  const runner = replicate.comparison(queue(2), d, options);
  runner.advance(900);
  assert.equal(live.size, 1, 'one open session between slices');
  runner.dispose();
  assert.equal(live.size, 0, 'dispose closes it');
  assert.throws(() => runner.advance(10), /The replication runner is disposed\./);
  assert.throws(() => runner.step(), /disposed/);
  assert.equal(runner.report().complete, false, 'the report of the rows so far stays available');
  assert.throws(() => replicate.replications(d, options).advance(0), /The minute budget must be a whole number \(1 or more\)\./);
  replicate.replicate(d, options);
  assert.equal(live.size, 0, 'a drained runner leaves no session open');
 } finally { runtime.create = created; }
});

test('CLI process replicate and compare accept --warmup, match the pure module and name the flag in their errors', () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'process-warmup-'));
 try {
  fs.copyFileSync(ORDERS, path.join(dir, 'a.json'));
  const call = (args: string[], code = 0) => {
   const p = spawnSync(process.execPath, [CLI, 'process', ...args], {cwd: dir, encoding: 'utf8'});
   assert.equal(p.status, code, args.join(' ') + '\n' + p.stdout + p.stderr);
   return JSON.parse(p.stdout) as Record<string, any>;
  };
  const d = JSON.parse(fs.readFileSync(ORDERS, 'utf8')) as LWProcess.Definition;
  const printed = call(['replicate', '--input', 'a.json', '--minutes', '240', '--runs', '2', '--seed', '3', '--warmup', '60']);
  assert.deepEqual(printed.report, replicate.replicate(d, {minutes: 240, runs: 2, seed: 3, warmup: 60}));
  const compared = call(['compare', '--input', 'a.json', '--against', 'a.json', '--minutes', '240', '--runs', '2', '--warmup', '60']).report;
  assert.equal(compared.warmup, 60);
  assert.equal(compared.kpis.find((k: {id: string}) => k.id === 'window.completed').difference.mean, 0);
  const message = '--warmup must be a whole number of minutes from 0 to 239 (below --minutes).';
  for (const bad of ['240', '-1', '1.5', 'x']) {
   assert.deepEqual(call(['replicate', '--input', 'a.json', '--minutes', '240', '--runs', '2', '--warmup', bad], 2).errors, [message], bad);
  }
  assert.deepEqual(call(['run', '--input', 'a.json', '--minutes', '10', '--output', 'r.json', '--warmup', '5'], 2).errors,
   ['Unknown or duplicate option: --warmup']);
 } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});
