/// <reference path="./process-contracts.d.ts" />
/** Randomness: seeded streams, open arrivals, distributions, draws, chance routes, retention and random-definition admission. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import {catalog, runtime} from './process-sdk.cjs';
import {test, base, copy, run} from './test-process-helpers.cjs';

/** start -> work (4 min, 2 workers) -> check (20% chance route) -> end/rework, with one open stream, random gap, timing, draws; every random mechanism at once. */
function randomized(extra: Partial<LWProcess.Arrival> = {}, seed?: number): LWProcess.Definition {
 const d = base(); d.resources = [{id: 'worker', name: 'Worker', capacity: 2, costPerMinute: 1}]; if (seed !== undefined) d.seed = seed;
 d.steps[1] = {...d.steps[1]!, duration: 4, resources: {worker: 1}, timing: {dist: 'exponential', mean: 4, max: 30}, draws: [{field: 'defect', kind: 'chance', percent: 15}]};
 d.steps.splice(2, 0, {id: 'check', name: 'Check', kind: 'decision', scene: {id: 'scene-check', position: [18, 0], color: '#ffffff'}},
  {id: 'rework', name: 'Rework', kind: 'task', duration: 3, resources: {worker: 1}, timing: {dist: 'uniform', min: 2, max: 6}, scene: {id: 'scene-rework', position: [18, 10], color: '#ffbb73'}});
 d.steps[4]!.scene.position = [30, 0];
 d.flows = [{id: 'f1', from: 'start', to: 'work'}, {id: 'f2', from: 'work', to: 'check'}, {id: 'f3', from: 'check', to: 'rework', when: {chance: 20}}, {id: 'f4', from: 'check', to: 'end'}, {id: 'f5', from: 'rework', to: 'end'}];
 d.arrivals = [{at: 0, open: true, interval: 3, gap: {dist: 'uniform', min: 1, max: 5}, draws: [{field: 'size', kind: 'int', min: 1, max: 5}], data: {}, ...extra}];
 return catalog.admit(d);
}
const json = (d: LWProcess.Definition, minutes: number, chunks: number[], options: LWProcess.RunOptions = {horizon: null}) => {
 const s = runtime.create(d, options); try { for (let done = 0, i = 0; done < minutes; i++) { const n = Math.min(chunks[i % chunks.length]!, minutes - done); s.advance(n); done += n; } return JSON.stringify(s.query()); } finally { s.dispose(); }
};
test('Seeded streams are deterministic, independent of advance chunking and change with the seed', () => {
 const d = randomized(), whole = json(d, 3000, [3000]);
 for (const chunks of [[1], [7], [1, 2, 3, 5, 8], [100, 1, 999], [2999, 1]]) assert.equal(json(d, 3000, chunks), whole);
 assert.equal(json(d, 3000, [3000]), whole); // a reset (new session, same seed) reproduces the run
 const q = JSON.parse(whole) as LWProcess.Snapshot; assert.equal(q.seed, 1); assert(q.metrics.arrived > 500 && q.metrics.completed > 400);
 assert.equal(JSON.stringify((JSON.parse(json(d, 3000, [3000], {horizon: null, seed: 1})) as LWProcess.Snapshot)), whole);
 assert.notEqual(json(d, 3000, [3000], {horizon: null, seed: 2}), whole);
 assert.equal(json(randomized({}, 9), 3000, [250]), json(d, 3000, [3000], {horizon: null, seed: 9}));
 assert.notEqual(catalog.fingerprint(randomized({}, 9)), catalog.fingerprint(d));
 const rnd = (globalThis as unknown as {LWProcessRandom: LWProcessRandom.Api}).LWProcessRandom;
 assert.equal(rnd.unit(1, 'a'), rnd.unit(1, 'a')); assert.notEqual(rnd.unit(1, 'a'), rnd.unit(2, 'a')); assert.notEqual(rnd.unit(1, 'a'), rnd.unit(1, 'b'));
 for (let i = 0; i < 2000; i++) { const u = rnd.unit(3, 'k' + i); assert(u >= 0 && u < 1); }
 // Draws are keyed by case, step and visit, so resource contention (one worker instead of two) cannot change a visit's realized duration.
 const one = randomized(); one.resources[0]!.capacity = 1; one.steps[1]!.timing = {dist: 'uniform', min: 1, max: 3};
 const two = copy(one); two.resources[0]!.capacity = 2;
 const visits = (def: LWProcess.Definition) => new Map(run(def, 60).receipts.filter(r => r.stepId === 'work').map(r => [r.caseId, r.duration]));
 const slow = visits(one), fast = visits(two); assert(slow.size > 5 && fast.size >= slow.size);
 for (const [id, minutes] of slow) assert.equal(fast.get(id), minutes);
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'process-seed-'));
 try {
  const cli = path.join(__dirname, 'tools/wildlands-cli.cjs'); fs.writeFileSync(path.join(dir, 'p.json'), JSON.stringify(d));
  const call = (seed: string) => spawnSync(process.execPath, [cli, 'process', 'run', '--input', 'p.json', '--minutes', '400', '--output', 'r' + seed + '.json', '--seed', seed], {cwd: dir, encoding: 'utf8'});
  const read = (seed: string) => (JSON.parse(fs.readFileSync(path.join(dir, 'r' + seed + '.json'), 'utf8')) as {snapshot: LWProcess.Snapshot}).snapshot;
  assert.equal(call('3').status, 0); assert.equal(call('4').status, 0); assert.equal(read('3').seed, 3); assert.equal(read('4').seed, 4);
  assert.notDeepEqual(read('3').metrics, read('4').metrics); assert.deepEqual(read('3').metrics, (JSON.parse(json(d, 400, [400], {horizon: null, seed: 3})) as LWProcess.Snapshot).metrics);
  for (const bad of ['-1', '2147483648', 'x', '1.5']) { const p = call(bad); assert.equal(p.status, 2, bad); assert(!fs.existsSync(path.join(dir, 'r' + bad + '.json'))); }
 } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});
test('Open arrival streams keep an unlimited run alive and drop arrivals when the system is full', () => {
 const steady = base(); steady.resources = [{id: 'worker', name: 'Worker', capacity: 1, costPerMinute: 0}]; Object.assign(steady.steps[1]!, {duration: 3, resources: {worker: 1}});
 steady.arrivals = [{at: 0, open: true, interval: 5, data: {}}];
 const s = runtime.create(steady, {horizon: null}); let last = 0;
 for (let i = 1; i <= 5; i++) { const q = s.advance(1000); assert.equal(q.status, 'running'); assert(q.metrics.arrived > last); last = q.metrics.arrived; assert.equal(q.minute, i * 1000); }
 const q = s.query(); assert.equal(q.metrics.arrived, 1001); assert.equal(q.metrics.completed, 1000); assert.equal(q.metrics.dropped, 0); assert.equal(q.minute, 5000); s.dispose();
 const limited = runtime.create(steady, {horizon: 100}); assert.equal(limited.advance(100).status, 'limit'); limited.dispose();
 const ends = copy(steady); ends.arrivals = [{at: 0, until: 50, interval: 10, data: {}}]; const finite = run(ends, 500); assert.equal(finite.status, 'completed'); assert.equal(finite.metrics.arrived, 5);
 const gone = copy(steady); gone.arrivals = [{at: 0, open: true, interval: 1000, data: {}}]; const idle = runtime.create(gone, {horizon: null}); assert.equal(idle.advance(100000).status, 'running'); assert.equal(idle.advance(100000).status, 'running'); idle.dispose();
 // One worker finishes a case per 10 minutes while one arrives every minute: the 500-case cap fills and later arrivals are refused.
 const jam = copy(steady); jam.steps[1]!.duration = 10; jam.arrivals = [{at: 0, open: true, interval: 1, data: {}}];
 const t0 = Date.now(), full = run(jam, 1500); assert(Date.now() - t0 < 15000);
 assert.equal(full.status, 'running'); assert(full.metrics.active >= 499 && full.metrics.active <= 500); // a completion frees its slot only after that minute's arrivals were admitted assert(full.metrics.dropped > 800); assert.equal(full.metrics.arrived + full.metrics.dropped, 1501);
 assert.equal(full.metrics.completed, 150); assert.equal(full.metrics.arrived - full.metrics.completed, full.metrics.active); const dropped = full.events.filter(e => e.kind === 'arrival-dropped'); assert(dropped.length > 0); assert(dropped.every(e => e.detail === 'system full'));
 assert.equal(run(jam, 100).metrics.dropped, 0); assert.equal(runtime.limits.active, 500); assert.equal(runtime.limits.retained, 200);
 const tight = runtime.create(jam, {horizon: null, active: 3}); tight.advance(30); assert(tight.query().metrics.active >= 2 && tight.query().metrics.active <= 3); assert(tight.query().metrics.dropped > 0); tight.dispose();
 const heavy = runtime.create(randomized(), {horizon: null}), start = Date.now(); heavy.advance(100000); const spent = Date.now() - start; assert(spent < 30000, spent + ' ms'); assert.equal(heavy.query().status, 'running'); heavy.dispose();
});
/** One stream of `n` one-minute-spaced cases through a single unresourced step with the given timing and draws, then an end. */
function sampled(n: number, step: Partial<LWProcess.Step>, arrival: Partial<LWProcess.Arrival> = {}, resources: LWProcess.Resource[] = []): LWProcess.Definition {
 const d = base(); d.resources = resources; Object.assign(d.steps[1]!, {duration: 5}, step); d.arrivals = [{at: 0, until: n, interval: 1, data: {}, ...arrival}]; return catalog.admit(d);
}
/** start -> roll (optional) -> decision with the given flows -> one task per target -> end; a task's `completed` count is how often its route was taken. */
function routed(n: number, when: (LWProcess.Condition | LWProcess.ChanceCondition | undefined)[], arrival: Partial<LWProcess.Arrival> = {}): LWProcess.Definition {
 const d = base(), scene = (id: string, y: number) => ({id: 'scene-' + id, position: [24, y] as [number, number], color: '#ffbb73'});
 d.steps = [d.steps[0]!, {id: 'pick', name: 'Pick', kind: 'decision', scene: {id: 'scene-pick', position: [12, 0], color: '#ffffff'}}, ...when.map((_, i) => ({id: 'r' + i, name: 'Route ' + i, kind: 'task' as const, duration: 1, scene: scene('r' + i, i * 10)})), d.steps[2]!];
 d.steps[d.steps.length - 1]!.scene.position = [36, 0];
 d.flows = [{id: 'f-start', from: 'start', to: 'pick'}, ...when.flatMap((w, i) => [{id: 'to-r' + i, from: 'pick', to: 'r' + i, ...w ? {when: w} : {}}, {id: 'r' + i + '-end', from: 'r' + i, to: 'end'}])];
 d.arrivals = [{at: 0, until: n, interval: 1, data: {}, ...arrival}]; return catalog.admit(d);
}
const done = (q: LWProcess.Snapshot, id: string) => q.steps.find(s => s.id === id)!.completed;
test('Random timing, draws and chance routes follow their distributions and record realized values', () => {
 const N = 3000, mean = (def: LWProcess.Definition) => run(def, 3200).metrics.meanCycleMinutes;
 const uniform = mean(sampled(N, {timing: {dist: 'uniform', min: 2, max: 6}})), triangular = mean(sampled(N, {timing: {dist: 'triangular', min: 2, mode: 4, max: 10}}));
 const exponential = mean(sampled(N, {timing: {dist: 'exponential', mean: 10, max: 100}}));
 assert(Math.abs(uniform - 4) < .15, String(uniform)); assert(Math.abs(triangular - 16 / 3) < .2, String(triangular)); assert(Math.abs(exponential - 10) < .8, String(exponential));
 const q = run(sampled(N, {timing: {dist: 'uniform', min: 2, max: 6}}), 3200), seen = new Set(q.receipts.map(r => r.duration));
 assert.equal(q.metrics.completed, N); assert([...seen].every(d => d! >= 2 && d! <= 6) && seen.size === 5);
 assert(q.receipts.every(r => r.duration === r.finished - r.started)); assert.equal(run(base(), 10).receipts[0]!.duration, undefined);
 const capped = run(sampled(500, {timing: {dist: 'exponential', mean: 50, max: 60}}), 4000); assert(capped.receipts.every(r => r.duration! >= 1 && r.duration! <= 60));
 // Draws apply after set and before add, appear in the receipt changes and the case data, and may satisfy declared outputs and bare needs.
 const rolled = sampled(50, {set: {grade: 'a'}, add: {score: 10}, draws: [{field: 'score', kind: 'int', min: 3, max: 3}, {field: 'ok', kind: 'chance', percent: 50, whenTrue: 'yes', whenFalse: 'no'}, {field: 'tier', kind: 'choice', values: [{value: 1, weight: 1}, {value: 'gold', weight: 3}]}],
  outputs: [{field: 'ok'}, {field: 'tier'}]});
 const r = run(rolled, 100).receipts[0]!; assert.equal(r.changes.score, 13); assert.equal(r.changes.grade, 'a'); assert(['yes', 'no'].includes(r.changes.ok as string)); assert([1, 'gold'].includes(r.changes.tier as never));
 assert.equal(r.output.ok, r.changes.ok); assert.deepEqual(Object.keys(r.changes).sort(), ['grade', 'ok', 'score', 'tier']);
 const need = copy(rolled); need.steps.splice(2, 0, {id: 'after', name: 'After', kind: 'task', duration: 1, needs: [{field: 'ok'}, {field: 'size'}], scene: {id: 'scene-after', position: [18, 0], color: '#ffffff'}}); need.flows = [need.flows[0]!, {id: 'work-after', from: 'work', to: 'after'}, {id: 'after-end', from: 'after', to: 'end'}];
 need.arrivals[0]!.draws = [{field: 'size', kind: 'int', min: 1, max: 9}]; assert.equal(catalog.validate(need).ok, true, JSON.stringify(catalog.validate(need).diagnostics));
 assert.equal(run(need, 100).receipts.find(x => x.stepId === 'after')!.input.size !== undefined, true);
 const arrivals = run(sampled(200, {}, {draws: [{field: 'size', kind: 'int', min: 1, max: 9}]}), 400);
 assert(arrivals.cases.every(c => Number.isInteger(c.input.size) && (c.input.size as number) >= 1 && (c.input.size as number) <= 9 && c.input.size === c.data.size)); assert.equal(new Set(arrivals.cases.map(c => c.input.size)).size, 9);
 // Chance routes: first matching flow in authored order wins, the keyed draw is per flow and case, and the fallback takes the rest.
 const sweep = run(routed(N, [{chance: 30}, {chance: 50}, undefined]), 3200); const hits = [done(sweep, 'r0'), done(sweep, 'r1'), done(sweep, 'r2')];
 assert.equal(hits[0]! + hits[1]! + hits[2]!, N); assert(Math.abs(hits[0]! - .3 * N) < 110, String(hits)); assert(Math.abs(hits[1]! - .35 * N) < 110, String(hits)); assert(Math.abs(hits[2]! - .35 * N) < 110, String(hits));
 const flag = run(routed(N, [{field: 'flag', op: 'eq', value: true}, undefined], {draws: [{field: 'flag', kind: 'chance', percent: 20}]}), 3200);
 assert(Math.abs(done(flag, 'r0') - .2 * N) < 90, String(done(flag, 'r0'))); assert.equal(done(flag, 'r0') + done(flag, 'r1'), N);
 const pick = run(routed(N, [{field: 'kind', op: 'eq', value: 'a'}, undefined], {draws: [{field: 'kind', kind: 'choice', values: [{value: 'a', weight: 1}, {value: 'b', weight: 3}]}]}), 3200);
 assert(Math.abs(done(pick, 'r0') - .25 * N) < 100, String(done(pick, 'r0')));
 assert.deepEqual([uniform, triangular, exponential].map(x => Math.round(x * 1000)), [4010, 5345, 10040]); // exact values for seed 1; the bounds above document the distributions
 assert.deepEqual(hits, [965, 1022, 1013]); assert.equal(done(flag, 'r0'), 602); assert.equal(done(pick, 'r0'), 754);
 // The inspector's 'draws average about' value is the sampler's own mean, whole-minute rounding and clamping included.
 type Sampler = {sample(seed: number, key: string, d: LWProcess.Dist): number};
 const g = globalThis as unknown as {LWProcessRandom: Sampler; LWProcessRandomView: LWProcessRandomView.Api};
 const dists = [{dist: 'triangular', min: 240, mode: 720, max: 1800}, {dist: 'uniform', min: 1, max: 3}, {dist: 'exponential', mean: 1},
  {dist: 'exponential', mean: 4, max: 12}, {dist: 'normal', mean: 6, sd: 1}, {dist: 'normal', mean: 3, sd: 3},
  {dist: 'erlang', k: 2, mean: 3}] as LWProcess.Dist[];
 for (const dist of dists) {
  let sum = 0; for (let i = 0; i < 20000; i++) sum += g.LWProcessRandom.sample(9, 'mean-check|' + i, dist);
  const want = g.LWProcessRandomView.meanOf(dist)!, got = sum / 20000;
  assert(Math.abs(got - want) / want < .02, `${JSON.stringify(dist)}: sampled ${got}, stated ${want}`);
 }
 assert.equal(g.LWProcessRandomView.describeTiming({duration: 720, timing: {dist: 'triangular', min: 240, mode: 720, max: 1800}}),
  'Planned 720 min; draws average about 920 min; each visit draws its own time: Random between 240 and 1800 min, most often 720');
});
test('Finished-case retention prunes detail but keeps run metrics exact', () => {
 const N = 3000, ready = (retained: number, d: LWProcess.Definition, minutes = 3010) => { const s = runtime.create(d, {retained}); try { return s.advance(minutes); } finally { s.dispose(); } };
 const flow = sampled(N, {duration: 2, cost: 1, resources: {worker: 1}}, {}, [{id: 'worker', name: 'Worker', capacity: 2, costPerMinute: 1}]);
 const kept = ready(5000, flow), defaults = ready(200, flow), tiny = ready(10, flow);
 assert.equal(kept.cases.length, N); assert.equal(kept.retention.finishedDropped, 0); assert.equal(defaults.cases.length, 200); assert.equal(defaults.retention.finishedDropped, 2800); assert.equal(tiny.cases.length, 10);
 assert.equal(tiny.retention.finishedDropped, 2990); assert.deepEqual(defaults.cases.map(c => c.id), kept.cases.slice(-200).map(c => c.id)); assert.equal(defaults.cases.at(-1)!.id, 'case-3000');
 for (const q of [kept, defaults, tiny]) { assert.equal(q.status, 'completed'); assert.equal(q.metrics.arrived, N); assert.equal(q.metrics.completed, N); assert.equal(q.metrics.failed, 0); assert.equal(q.metrics.active, 0);
  assert.equal(q.metrics.cost, 3 * N); assert.equal(q.metrics.meanCycleMinutes, 2); assert.equal(q.resources[0]!.busyMinutes, 2 * N); assert.equal(q.steps.find(s => s.id === 'work')!.completed, N); }
 const strip = (q: LWProcess.Snapshot) => JSON.stringify({...q, cases: [], retention: null}); assert.equal(strip(defaults), strip(kept)); assert.equal(strip(tiny), strip(kept));
 const mid = ready(10, flow, 1500); assert.equal(mid.cases.filter(c => c.status === 'active').length, mid.metrics.active); assert(mid.metrics.active > 0 && mid.metrics.active <= 3);
 assert(mid.cases.length <= 10 + mid.metrics.active);
 // Mixed outcomes: half the cases fail on a non-numeric counter; completed and failed totals still add up and match an unpruned control.
 const mixed = sampled(N, {add: {n: 1}}, {draws: [{field: 'n', kind: 'choice', values: [{value: 1, weight: 1}, {value: 'x', weight: 1}]}]});
 const a = ready(10, mixed, 3100), b = ready(5000, mixed, 3100); assert(a.metrics.failed > 1000 && a.metrics.completed > 1000); assert.equal(a.metrics.failed + a.metrics.completed, N);
 assert.deepEqual(a.metrics, b.metrics); assert.equal(a.retention.finishedDropped, N - 10); assert.equal(b.cases.length, N);
});
test('Random definitions are rejected explicitly when malformed', () => {
 const bad = (mutate: (d: LWProcess.Definition) => void, base_: () => LWProcess.Definition = () => randomized()) => { const d = copy(base_()) as LWProcess.Definition; mutate(d); const v = catalog.validate(d); assert.equal(v.ok, false); return v.diagnostics.map(x => x.path + ' ' + x.message).join('|'); };
 const arrival = (d: LWProcess.Definition) => d.arrivals[0]!, work = (d: LWProcess.Definition) => d.steps[1]!;
 assert.match(bad(d => { arrival(d).count = 3; }), /\/arrivals\/0 An arrival needs exactly one end rule: count, until or open/);
 assert.match(bad(d => { arrival(d).until = 50; }), /exactly one end rule/); assert.match(bad(d => { delete arrival(d).open; }), /exactly one end rule/);
 assert.match(bad(d => { (arrival(d) as unknown as {open: boolean}).open = false; }), /Expected true/);
 assert.match(bad(d => { delete arrival(d).open; arrival(d).until = 3; arrival(d).at = 3; }), /\/until An arrival stream must end after its first arrival/);
 assert.match(bad(d => { arrival(d).interval = 0; }), /\/interval Streams with until, open or gap need an interval of at least 1/);
 assert.match(bad(d => { arrival(d).gap = {dist: 'uniform', min: 5, max: 2}; }), /\/gap A uniform distribution needs min at most max/);
 assert.match(bad(d => { arrival(d).gap = {dist: 'uniform', min: 0, max: 2}; }), /\/gap\/min Number is out of range/);
 assert.match(bad(d => { arrival(d).gap = {dist: 'uniform', min: 1}; }), /\/gap\/max A uniform distribution needs max/);
 assert.match(bad(d => { arrival(d).gap = {dist: 'triangular', min: 1, mode: 9, max: 5}; }), /needs min <= mode <= max/);
 assert.match(bad(d => { arrival(d).gap = {dist: 'exponential', max: 5}; }), /\/gap\/mean An exponential distribution needs mean/);
 assert.match(bad(d => { arrival(d).gap = {dist: 'exponential', mean: 9, max: 5}; }), /needs mean at most max/);
 assert.match(bad(d => { arrival(d).gap = {dist: 'uniform', min: 1, max: 3, mean: 2}; }), /\/gap\/mean A uniform distribution does not take mean/);
 assert.match(bad(d => { arrival(d).gap = {dist: 'lognormal' as never, mean: 3}; }), /Expected one of uniform, triangular, exponential, normal, erlang/);
 assert.match(bad(d => { arrival(d).draws = [{field: 'x', kind: 'chance', percent: 0}]; }), /\/draws\/0\/percent A chance draw needs a whole percent from 1 to 99/);
 assert.match(bad(d => { arrival(d).draws = [{field: 'x', kind: 'chance', percent: 100}]; }), /whole percent from 1 to 99/);
 assert.match(bad(d => { arrival(d).draws = [{field: 'x', kind: 'chance', percent: 50, whenTrue: 1, whenFalse: 1}]; }), /different whenTrue and whenFalse/);
 assert.match(bad(d => { arrival(d).draws = [{field: 'x', kind: 'choice', values: [{value: 1, weight: 1}]}]; }), /\/draws\/0\/values A choice draw needs 2 to 12 weighted values/);
 assert.match(bad(d => { arrival(d).draws = [{field: 'x', kind: 'choice', values: [{value: 1, weight: 0}, {value: 2, weight: 1}]}]; }), /values\/0\/weight A choice weight must be a whole number from 1 to 1000/);
 assert.match(bad(d => { arrival(d).draws = [{field: 'x', kind: 'choice', values: [{value: 1, weight: 1}, {value: 1, weight: 1}]}]; }), /Choice values must be distinct/);
 assert.match(bad(d => { arrival(d).draws = [{field: 'x', kind: 'choice', values: Array.from({length: 13}, (_, i) => ({value: i, weight: 1}))}]; }), /Array length is out of range/);
 assert.match(bad(d => { arrival(d).draws = [{field: 'x', kind: 'int', min: 5, max: 1}]; }), /An int draw needs whole min and max with min at most max/);
 assert.match(bad(d => { arrival(d).draws = [{field: 'x', kind: 'int', min: 1, max: 2, percent: 5}]; }), /\/draws\/0\/percent A int draw does not take percent/);
 assert.match(bad(d => { arrival(d).draws = [{field: 'size', kind: 'int', min: 1, max: 2}, {field: 'size', kind: 'int', min: 1, max: 2}]; }), /Draw field size is declared twice/);
 assert.match(bad(d => { arrival(d).data = {size: 1}; }), /Draw field size is also given a fixed value/);
 assert.match(bad(d => { arrival(d).draws = Array.from({length: 9}, (_, i) => ({field: 'f' + i, kind: 'int' as const, min: 1, max: 2})); }), /Array length is out of range/);
 assert.match(bad(d => { work(d).timing = {dist: 'uniform', min: 3, max: 2}; }), /\/steps\/1\/timing A uniform distribution needs min at most max/);
 assert.match(bad(d => { work(d).draws = [{field: 'ok', kind: 'chance', percent: 10, whenTrue: 1, whenFalse: 1}]; }), /different whenTrue and whenFalse/);
 assert.match(bad(d => { work(d).set = {defect: true}; }), /Draw field defect is also given a fixed value/);
 assert.match(bad(d => { work(d).add = {defect: 1}; }), /Draw field defect is also a counter; only an int draw may feed an add/);
 assert.match(bad(d => { work(d).outputs = [{field: 'nothing'}]; }), /declares output nothing but does not deliver it with set, add or draws/);
 const timer = (extra: Partial<LWProcess.Step>) => (d: LWProcess.Definition) => { d.steps[1] = {id: 'work', name: 'Wait', kind: 'timer', scene: d.steps[1]!.scene, ...extra}; delete d.steps[1]!.resources; };
 assert.match(bad(timer({until: 20, timing: {dist: 'uniform', min: 1, max: 3}})), /Timing applies to duration timers only, not to an until timer/);
 assert.match(bad(timer({duration: 5, timing: {dist: 'uniform', min: 1, max: 3}, cost: 1})), /Timers hold work without resources, costs or a backlog/);
 assert.match(bad(d => { d.steps[2]!.timing = {dist: 'uniform', min: 1, max: 2}; }), /\/steps\/2 Only work steps \(task, machine, system\) and timers declare work, waits, costs, resource demands, timing or effects/);
 assert.match(bad(d => { d.steps[2]!.draws = [{field: 'x', kind: 'int', min: 1, max: 2}]; }), /\/steps\/2 Only work steps/);
 assert.equal(catalog.validate((() => { const d = randomized(); timer({duration: 5, timing: {dist: 'triangular', min: 1, mode: 2, max: 3}, draws: [{field: 'z', kind: 'int', min: 1, max: 2}]})(d); return d; })()).ok, true);
 assert.match(bad(d => { d.flows[1]!.when = {chance: 10}; }), /\/flows\/1\/when Only decisions have conditions/);
 assert.match(bad(d => { d.flows[2]!.when = {chance: 0}; }), /\/when\/chance A chance route needs a whole percent from 1 to 99/);
 assert.match(bad(d => { d.flows[2]!.when = {chance: 100}; }), /whole percent from 1 to 99/);
 assert.match(bad(d => { d.flows[2]!.when = {chance: 10, field: 'defect', op: 'eq', value: true} as never; }), /\/flows\/2\/when A condition uses exactly one form: chance, or field and op with a value or valueField/);
 assert.match(bad(d => { d.flows[2]!.when = {} as never; }), /A condition needs a field and an operator, or a chance percent/);
 assert.match(bad(d => { d.flows[3]!.when = {chance: 40}; }), /Decision needs exactly one unconditional fallback/);
 assert.match(bad(d => { d.flows[2]!.when = {field: 'defect', op: 'eq', value: true, valueField: 'size'} as never; }), /exactly one of a value or another case field/);
 for (const seed of [-1, 2147483648, 1.5]) assert.equal(catalog.validate({...randomized(), seed}).ok, false);
 assert.equal(catalog.validate({...randomized(), seed: 0}).ok, true); assert.equal(catalog.validate({...randomized(), seed: 2147483647}).ok, true);
 for (const options of [{seed: -1}, {seed: 2 ** 31}, {seed: 1.5}, {active: 0}, {active: 501}, {retained: 0}, {retained: 10001}]) assert.throws(() => runtime.create(randomized(), options), /must be a whole number/);
 // Drawn fields are delivered with an unknown value: bare needs pass; value tests, like counters, are rejected; parallel branches cannot both draw one field.
 const needing = (need: LWProcess.Need) => (d: LWProcess.Definition) => { d.steps.splice(3, 0, {id: 'gate', name: 'Gate', kind: 'task', duration: 1, needs: [need], scene: {id: 'scene-gate', position: [24, 10], color: '#ffffff'}}); d.flows[3] = {id: 'f4', from: 'check', to: 'gate'}; d.flows.push({id: 'f6', from: 'gate', to: 'end'}); };
 assert.match(bad(needing({field: 'defect', op: 'eq', value: true})), /Needs defect = true, but Delivered only on some routes|Needs defect = true.*a counter or drawn value/);
 assert.match(bad(needing({field: 'size', op: 'gte', value: 1})), /Needs size ≥ 1.*a counter or drawn value/);
 const ok = copy(randomized()); needing({field: 'defect'})(ok); assert.equal(catalog.validate(ok).ok, true, JSON.stringify(catalog.validate(ok).diagnostics));
 const forks = (d: LWProcess.Definition) => {
  const task = (id: string, extra: Partial<LWProcess.Step>): LWProcess.Step => ({id, name: id, kind: 'task', duration: 2, scene: {id: 'scene-' + id, position: [10, 10], color: '#ffbb73'}, ...extra});
  d.steps = [d.steps[0]!, {id: 'fan', name: 'Fan', kind: 'fork', join: 'merge', scene: {id: 'scene-fan', position: [5, 0], color: '#ffffff'}}, task('left', {draws: [{field: 'mood', kind: 'int', min: 1, max: 3}]}), task('right', {draws: [{field: 'mood', kind: 'int', min: 1, max: 3}]}),
   {id: 'merge', name: 'Merge', kind: 'join', scene: {id: 'scene-merge', position: [15, 0], color: '#ffffff'}}, d.steps.at(-1)!];
  d.flows = [{id: 'a', from: 'start', to: 'fan'}, {id: 'b', from: 'fan', to: 'left'}, {id: 'c', from: 'fan', to: 'right'}, {id: 'd', from: 'left', to: 'merge'}, {id: 'e', from: 'right', to: 'merge'}, {id: 'g', from: 'merge', to: 'end'}];
 };
 assert.match(bad(forks), /Parallel branches cannot both write mood/);
});
