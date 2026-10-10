/// <reference path="./process-contracts.d.ts" />
/** Step kinds and the example processes that exercise them: timers, counters, field conditions, machine and system steps. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {catalog, runtime} from './process-sdk.cjs';
import {test, copy, agency, run, stepOf, flowOf, build, startEnd} from './test-process-helpers.cjs';

test('Agile vendor project completes three projects with variable iterations, UAT rework and UX in product design', () => {
 const agile = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../docs/concepts/agency-delivery/content/agile-vendor.process.json'), 'utf8')) as LWProcess.Definition;
 const admission = catalog.validate(agile); assert.equal(admission.ok, true); assert.deepEqual(admission.diagnostics, []);
 assert(agile.steps.every(s => !s.scene.asset), 'themed rooms render without attached assets');
 assert(agile.steps.every(s => !admission.diagnostics.some(e => /asset/.test(e.path + e.code))));
 assert(agile.steps.find(s => s.id === 'product-design')!.resources!.ux! >= 1);
 const kickoffDate = agile.steps.find(s => s.id === 'kickoff-date')!; assert.equal(kickoffDate.kind, 'timer'); assert.equal(kickoffDate.until, 12); assert.equal(kickoffDate.duration, undefined);
 const timers = agile.steps.filter(s => s.kind === 'timer'); assert.deepEqual(timers.map(s => s.id), ['kickoff-date', 'sprint-review', 'hypercare']);
 const auto = agile.steps.filter(s => s.kind === 'system'); assert.deepEqual(auto.map(s => s.id), ['ci-build', 'regression-suite', 'auto-deploy']); assert(auto.every(s => Object.keys(s.resources!).every(id => agile.resources.find(p => p.id === id)!.kind === 'system')), 'system steps demand only system pools');
 assert(timers.every(s => !s.resources && s.cost === undefined && !s.backlog), 'timers declare no resources, cost or backlog');
 const ids = ['case-0001', 'case-0002', 'case-0003'], s = runtime.create(agile); let q: ReturnType<typeof s.advance>;
 try {
  q = s.advance(1);
  for (let i = 1; i < 308; i++) {
   for (const r of q.resources) assert(r.busy <= r.capacity, `${r.id} within capacity`);
   if (q.minute === 5) assert(q.tokens.some(t => t.status === 'timer' && t.due === 12) && q.resources.every(r => r.busy === 0), 'a case waiting for the kickoff date occupies nobody');
   q = s.advance(1);
  }
  for (const r of q.resources) assert(r.busy <= r.capacity);
 } finally {s.dispose();}
 const whole = run(agile, 600); assert.equal(whole.status, 'completed'); assert.equal(whole.minute, 308); assert.equal(whole.metrics.completed, 3); assert.equal(whole.metrics.failed, 0); assert.equal(whole.metrics.cost, 2362);
 assert(whole.cases.every(c => c.status === 'completed')); assert.equal(whole.receiptsDropped, 0);
 const visits = (caseId: string, stepId: string) => whole.receipts.filter(r => r.caseId === caseId && r.stepId === stepId).length;
 const per = (stepId: string) => ids.map(c => visits(c, stepId));
 assert.deepEqual(per('sprint'), [6, 2, 3], 'iterations x releases');
 assert.deepEqual(per('ci-build'), per('sprint'), 'CI runs for every iteration'); assert.deepEqual(per('ci-build'), [6, 2, 3]); assert.deepEqual(per('regression-suite'), [2, 1, 3]); assert.deepEqual(per('auto-deploy'), per('release-go-live'), 'one automated deployment per go-live');
 assert.deepEqual(per('sprint-review'), [6, 2, 3]); assert.deepEqual(per('release-go-live'), [2, 1, 3]); assert.deepEqual(per('kickoff'), [1, 1, 1]);
 assert.deepEqual(ids.map(c => whole.cases.find(x => x.id === c)!.data.increments), [6, 2, 3], 'increments counter equals iteration visits');
 assert.deepEqual(ids.map(c => whole.cases.find(x => x.id === c)!.data.release), [2, 1, 3]); assert.deepEqual(whole.cases.map(c => c.data.iteration), [0, 0, 0]);
 assert.deepEqual(per('fix'), [1, 0, 1], 'fix visits only for cases arriving with findings'); assert.deepEqual(per('release-uat'), [3, 1, 4]);
 assert.deepEqual(whole.cases.map(c => c.data.findings), [false, false, false]);
 for (const c of ids) assert(whole.receipts.filter(r => r.caseId === c && r.stepId === 'kickoff').every(r => r.started >= 12), 'no case passes kickoff before the contractual date');
 assert.deepEqual(ids.map(c => whole.receipts.find(r => r.caseId === c && r.stepId === 'kickoff-date')!.finished), [12, 15, 30]);
 const free = whole.receipts.filter(r => timers.some(t => t.id === r.stepId)); assert(free.length > 0 && free.every(r => r.finished >= r.started));
 for (const u of whole.resources) assert(u.utilization <= 1, `${u.id} utilization`);
 assert(whole.resources.find(u => u.id === 'delivery-manager')!.busyMinutes > 0);
 assert.deepEqual(whole.resources.filter(u => u.kind === 'system').map(u => [u.id, u.busyMinutes]), [['ci-pipeline', 34], ['test-automation', 18]]);
 assert(whole.receipts.filter(r => auto.some(a => a.id === r.stepId)).every(r => r.finished > r.started), 'system steps ran as timed work');
 assert(whole.cases.every(c => c.data.buildGreen === true && c.data.regressionGreen === true && c.data.releaseDeployed === true));
});
test('Order fulfilment line completes with robots, systems and a human spot-check', () => {
 const line = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../docs/concepts/agency-delivery/content/order-fulfilment.process.json'), 'utf8')) as LWProcess.Definition;
 const admission = catalog.validate(line); assert.equal(admission.ok, true); assert.deepEqual(admission.diagnostics, []); assert(line.steps.every(s => !s.scene.asset));
 const kindOf = (id: string) => line.resources.find(p => p.id === id)!.kind ?? 'people';
 const automated = line.steps.filter(s => s.kind === 'machine' || s.kind === 'system'); assert.deepEqual(automated.map(s => s.id), ['validate-order', 'fraud-check', 'pick-items', 'shipping-documents', 'pack', 'label-parcel', 'notify-customer']);
 for (const st of automated) assert(Object.keys(st.resources!).every(id => kindOf(id) === st.kind), `${st.id} demands only ${st.kind} pools`);
 for (const st of line.steps.filter(s => s.kind === 'task')) assert(Object.keys(st.resources!).every(id => kindOf(id) === 'people'), `${st.id} uses people`);
 assert(automated.filter(s => s.outputs).length >= 3 && line.resources.filter(p => p.kind !== 'people').every(p => p.costPerMinute > 0));
 const at = (d: LWProcess.Definition, minutes: number, options: LWProcess.RunOptions = {}) => { const s = runtime.create(d, options); try { return s.advance(minutes); } finally { s.dispose(); } };
 const seeded = (d: LWProcess.Definition, minutes: number, chunks: number[], options: LWProcess.RunOptions = {}) => { const s = runtime.create(d, options); try { let q = s.query(); for (let done = 0, i = 0; done < minutes; i++) { const n = Math.min(chunks[i % chunks.length]!, minutes - done); q = s.advance(n); done += n; for (const r of q.resources) assert(r.busy <= r.capacity, `${r.id} within capacity at ${q.minute}`); } return JSON.stringify(q); } finally { s.dispose(); } };
 assert.equal(line.seed, 20260607); assert.equal(line.arrivals.length, 1); assert.equal(line.arrivals[0]!.open, true); assert.equal(line.arrivals[0]!.gap!.dist, 'exponential'); assert(line.arrivals[0]!.draws!.some(x => x.field === 'priority') && line.arrivals[0]!.draws!.some(x => x.field === 'defect'));
 const whole = at(line, 1000, {horizon: null}); assert.equal(whole.seed, 20260607); assert.equal(whole.status, 'running'); assert.equal(whole.minute, 1000);
 assert.deepEqual([whole.metrics.arrived, whole.metrics.completed, whole.metrics.failed, whole.metrics.dropped, whole.metrics.active, whole.metrics.cost], [262, 256, 0, 0, 6, 21344]);
 const use = (q: LWProcess.Snapshot, id: string) => q.resources.find(u => u.id === id)!; assert.deepEqual(['packing-line', 'robots', 'inspector', 'packer'].map(id => [id, use(whole, id).kind, use(whole, id).busyMinutes]), [['packing-line', 'machine', 2307], ['robots', 'machine', 1725], ['inspector', 'people', 1808], ['packer', 'people', 240]]);
 const repacks = whole.steps.find(x => x.id === 'repack')!.completed; assert.equal(repacks, 48); assert.equal(whole.receipts.filter(r => r.stepId === 'repack').length > 0, true);
 assert.equal(whole.steps.find(x => x.id === 'spot-check')!.completed, 304, 'every repack adds one more spot-check visit'); assert.equal(whole.metrics.arrived - whole.metrics.completed, whole.metrics.active);
 for (const st of automated) for (const o of st.outputs ?? []) assert(whole.receipts.filter(r => r.stepId === st.id).every(r => o.field in r.output), `${st.id} delivers ${o.field}`);
 assert(whole.receipts.filter(r => r.stepId === 'pack').every(r => r.duration! >= 7 && r.duration! <= 11) && whole.receipts.filter(r => r.stepId === 'pick-items').every(r => r.duration! >= 4 && r.duration! <= 10));
 assert(whole.cases.every(c => (c.input.priority === 'express' || c.input.priority === 'standard') && typeof c.input.defect === 'boolean'));
 const finished = whole.cases.filter(c => c.status === 'completed'); assert(finished.length > 0 && finished.every(c => c.data.defect === false && c.data.notified === true && c.data.parcels === 1));
 const reference = JSON.stringify(whole); assert.equal(JSON.stringify(at(line, 1000, {horizon: null})), reference); assert.equal(seeded(line, 1000, [1000], {horizon: null}), reference);
 assert.equal(seeded(line, 1000, [1], {horizon: null}), reference); assert.equal(seeded(line, 1000, [7, 33, 250], {horizon: null}), reference);
 const other = at(line, 1000, {horizon: null, seed: 7}); assert.equal(other.seed, 7); assert.notEqual(JSON.stringify(other), reference); assert.deepEqual([other.metrics.arrived, other.metrics.completed, other.metrics.cost, use(other, 'packing-line').busyMinutes], [273, 268, 22664, 2464]);
 const unlimited = runtime.create(line, {horizon: null});
 try { const early = unlimited.advance(10000), late = unlimited.advance(10000); assert.equal(early.status, 'running'); assert.equal(late.status, 'running'); assert.equal(late.minute, 20000); assert(late.metrics.completed > early.metrics.completed + 2000); assert.equal(late.metrics.failed, 0); } finally { unlimited.dispose(); }
});
test('Order fulfilment line stays stable under steady random demand with bounded queues', () => {
 const line = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../docs/concepts/agency-delivery/content/order-fulfilment.process.json'), 'utf8')) as LWProcess.Definition, limit = runtime.limits.active;
 const s = runtime.create(line, {horizon: null});
 try {
  let q = s.query(); for (let i = 0; i < 50; i++) { q = s.advance(100); assert(q.metrics.active <= limit, `active within ${limit}`); assert.equal(q.metrics.failed, 0); assert.equal(q.status, 'running'); for (const r of q.resources) assert(r.busy <= r.capacity); }
  assert.equal(q.minute, 5000); const lane = q.resources.find(u => u.id === 'packing-line')!;
  assert(lane.utilization > .6 && lane.utilization < .95, String(lane.utilization)); assert.equal(Math.round(lane.utilization * 1000), 762); assert.equal(lane.busyMinutes, 11437);
  assert.deepEqual([q.metrics.arrived, q.metrics.completed, q.metrics.dropped, q.metrics.active], [1274, 1261, 0, 13]);
  assert(q.metrics.active < 40, 'the queue stays small, not growing without bound'); const kept = q.cases.filter(c => c.status !== 'active').length; assert(kept <= runtime.limits.retained); assert.equal(q.retention.finishedDropped, q.metrics.completed + q.metrics.failed - kept); assert.equal(q.retention.finishedDropped, 1061);
 } finally { s.dispose(); }
});
const matches = (globalThis as unknown as {LWProcessGraph: {matches(data: LWProcess.Fields, c: LWProcess.Condition): boolean}}).LWProcessGraph.matches;
const loop = (data: LWProcess.Fields, entry = 'work') => build(startEnd(stepOf('work', 'task', {duration: 2, add: {iteration: 1}}), stepOf('gate', 'decision', {needs: [{field: 'iteration'}]})),
 [flowOf('start', entry), flowOf('work', 'gate'), flowOf('gate', 'work', {field: 'iteration', op: 'lt', valueField: 'iterations'} as LWProcess.Condition), flowOf('gate', 'end')], [{at: 0, count: 1, interval: 0, data}]);
test('Counters increment at completion, compare to other fields and loop a bounded number of times', () => {
 const three = loop({iterations: 3}), q = run(three, 100); assert.equal(catalog.validate(three).ok, true);
 assert.equal(q.status, 'completed'); assert.equal(q.minute, 6); assert.deepEqual(q.receipts.map(r => r.changes), [{iteration: 1}, {iteration: 2}, {iteration: 3}]);
 assert.deepEqual(q.receipts.map(r => r.output.iteration), [1, 2, 3]); assert.deepEqual(q.receipts.map(r => r.input.iteration), [undefined, 1, 2]); assert.equal(q.cases[0]!.data.iteration, 3);
 assert.equal(run(loop({iterations: 1}), 100).receipts.length, 1); assert.equal(run(loop({iterations: 0}), 100).receipts.length, 1);
 const lowered = loop({iterations: 3}); delete lowered.steps[1]!.add; lowered.steps[1]!.set = {other: 1}; assert(catalog.validate(lowered).diagnostics.some(e => e.code === 'needs' && e.path === '/steps/2/needs/0'));
 const combined = build(startEnd(stepOf('work', 'task', {duration: 1, set: {n: 5}, add: {n: 2, m: -3}})), [flowOf('start', 'work'), flowOf('work', 'end')], [{at: 0, count: 1, interval: 0, data: {m: 10}}]);
 assert.deepEqual(run(combined, 5).receipts[0]!.changes, {n: 7, m: 7}); assert.deepEqual(run(combined, 5).cases[0]!.data, {m: 7, n: 7});
 const high = combined; high.steps[1]!.add = {n: 1}; high.steps[1]!.needs = [{field: 'n', op: 'gte', value: 1}]; assert.equal(catalog.validate(high).ok, false);
});
test('Counter failures and field-to-field conditions reject unsafe or missing values explicitly', () => {
 const bump = (data: LWProcess.Fields, delta = 1, resources?: Record<string, number>) => build(startEnd(stepOf('work', 'task', {duration: 2, add: {n: delta}, ...resources ? {resources} : {}})), [flowOf('start', 'work'), flowOf('work', 'end')],
  [{at: 0, count: 1, interval: 0, data}], resources ? [{id: 'worker', name: 'Worker', capacity: 1, costPerMinute: 1}] : []);
 for (const bad of [1.5, 'x', true, null]) { const q = run(bump({n: bad}), 10); assert.equal(q.cases[0]!.status, 'failed'); assert.match(q.cases[0]!.error!, /cannot add to n because it holds/); assert.equal(q.receipts.length, 0); assert.equal(q.status, 'completed'); }
 assert.equal(run(bump({n: 999999999}), 10).cases[0]!.data.n, 1000000000); assert.equal(run(bump({n: -999999999}, -1), 10).cases[0]!.data.n, -1000000000);
 const over = run(bump({n: 999999999}, 2), 10); assert.equal(over.cases[0]!.status, 'failed'); assert.match(over.cases[0]!.error!, /beyond the 1000000000 limit/); assert.equal(over.cases[0]!.data.n, 999999999);
 const shared = bump({}, 1, {worker: 1}); shared.arrivals = [{at: 0, count: 1, interval: 0, data: {n: 'x'}}, {at: 0, count: 1, interval: 0, data: {n: 1}}];
 const pool = run(shared, 10); assert.deepEqual(pool.cases.map(c => c.status), ['failed', 'completed']); assert.equal(pool.resources[0]!.busy, 0); assert.equal(pool.cases[1]!.data.n, 2);
 const a = {field: 'a', op: 'eq', valueField: 'b'} as LWProcess.Condition, as = (op: LWProcess.Condition['op']) => ({...a, op});
 assert.equal(matches({a: 1, b: 1}, a), true); assert.equal(matches({a: 1, b: 2}, as('ne')), true); assert.equal(matches({a: 1, b: 2}, as('lt')), true); assert.equal(matches({a: 2, b: 2}, as('lte')), true); assert.equal(matches({a: 2, b: 2}, as('gt')), false);
 assert.equal(matches({a: 'x', b: 'y'}, as('gt')), false); assert.equal(matches({a: 'x', b: 'x'}, a), true); assert.equal(matches({a: 1}, a), false); assert.equal(matches({a: 1}, as('ne')), false); assert.equal(matches({b: 1}, as('ne')), false);
 assert.equal(run(loop({}), 100).receipts.length, 1, 'missing iterations never matches'); const direct = loop({iterations: 3}, 'gate'); assert.equal(catalog.validate(direct).ok, false); delete direct.steps[2]!.needs; assert.equal(run(direct, 100).receipts.length, 0, 'missing counter never matches');
 const invalid = (mutate: (d: LWProcess.Definition) => void) => { const d = copy(loop({iterations: 3})); mutate(d); return catalog.validate(d).ok; };
 assert.equal(invalid(() => {}), true);
 for (const add of [{}, {iteration: 0}, {iteration: 1.5}, {iteration: 1000001}, {iteration: -1000001}, {Bad: 1}, {iteration: '1'}, Object.fromEntries('abcdefghi'.split('').map(k => [k, 1]))]) assert.equal(invalid(d => { d.steps[1]!.add = add as Record<string, number>; }), false, JSON.stringify(add));
 assert.equal(invalid(d => { d.steps[1]!.add = {iteration: 1, ...Object.fromEntries('abcdefg'.split('').map(k => [k, 1]))}; }), true);
 assert.equal(invalid(d => { d.steps[2]!.add = {x: 1}; }), false); assert.equal(invalid(d => { d.steps[0]!.add = {x: 1}; }), false);
 const when = (c: object) => invalid(d => { d.flows[2]!.when = c as LWProcess.Condition; });
 assert.equal(when({field: 'iteration', op: 'lt', value: 1, valueField: 'iterations'}), false); assert.equal(when({field: 'iteration', op: 'lt'}), false);
 assert.equal(when({field: 'iteration', op: 'lt', valueField: 'Bad'}), false); assert.equal(when({field: 'iteration', op: 'lt', value: null}), true);
});
test('Timers hold work for exact durations or until an absolute minute without using resources', () => {
 const timer = (extra: Partial<LWProcess.Step>, before?: LWProcess.Step, arrivals?: LWProcess.Arrival[], resources?: LWProcess.Resource[]) => {
  const first = before ? [before] : [], head = before ? before.id : 'wait';
  return build(startEnd(...first, stepOf('wait', 'timer', extra)), [flowOf('start', head), ...before ? [flowOf(before.id, 'wait')] : [], flowOf('wait', 'end')], arrivals, resources);
 };
 const by = timer({duration: 30, set: {phase: 'done'}, add: {waits: 1}}), s = runtime.create(by);
 try {
  assert.equal(s.query().tokens[0]!.status, 'timer'); assert.equal(s.query().tokens[0]!.due, 30); const mid = s.advance(5);
  assert.equal(mid.status, 'running'); assert.deepEqual(mid.steps.find(x => x.id === 'wait')!.timers, {waiting: 1, nextDue: 30}); assert.equal(mid.steps.find(x => x.id === 'wait')!.queued, 0); assert.equal(mid.steps.find(x => x.id === 'wait')!.active, 0);
  assert.deepEqual(mid.steps.find(x => x.id === 'start')!.timers, {waiting: 0, nextDue: null}); assert.equal(s.advance(24).metrics.completed, 0);
  const done = s.advance(1); assert.equal(done.minute, 30); assert.equal(done.status, 'completed'); assert.equal(done.metrics.completed, 1); assert.equal(done.metrics.cost, 0);
  assert.deepEqual(done.receipts, [{id: 'token-00000001@0:wait', caseId: 'case-0001', stepId: 'wait', started: 0, finished: 30, input: {}, output: {phase: 'done', waits: 1}, changes: {phase: 'done', waits: 1}}]);
  assert.deepEqual(done.events.filter(e => e.kind.startsWith('timer')).map(e => [e.minute, e.kind, e.stepId, e.detail]), [[0, 'timer-started', 'wait', 'due 30'], [30, 'timer-fired', 'wait', '']]);
 } finally {s.dispose();}
 const task = stepOf('prep', 'task', {duration: 10}), until = (at: number, prep = task) => run(timer({until: at}, prep), 200);
 assert.deepEqual([until(45).minute, until(45).receipts.find(r => r.stepId === 'wait')!.started, until(45).receipts.find(r => r.stepId === 'wait')!.finished], [45, 10, 45]);
 const late = until(5); assert.equal(late.minute, 10); assert.equal(late.status, 'completed'); assert.deepEqual(late.events.filter(e => e.stepId === 'wait' && e.kind.startsWith('timer')).map(e => [e.minute, e.kind]), [[10, 'timer-started'], [10, 'timer-fired']]);
 assert.equal(until(10).minute, 10); assert.equal(run(timer({until: 1}), 5).minute, 1); assert.equal(run(timer({until: 99999}), 100000).minute, 99999);
 const pool = [{id: 'worker', name: 'Worker', capacity: 1, costPerMinute: 5}], many = run(timer({duration: 20}, undefined, [{at: 0, count: 3, interval: 0, data: {}}], pool), 10);
 assert.deepEqual(many.steps.find(x => x.id === 'wait')!.timers, {waiting: 3, nextDue: 20}); assert.equal(many.resources[0]!.busyMinutes, 0); assert.equal(run(timer({duration: 20}, undefined, [{at: 0, count: 3, interval: 0, data: {}}], pool), 25).metrics.cost, 0);
 const staggered = run(timer({duration: 10}, undefined, [{at: 0, count: 1, interval: 0, data: {}}, {at: 3, count: 1, interval: 0, data: {}}]), 5); assert.equal(staggered.steps.find(x => x.id === 'wait')!.timers.nextDue, 10);
 const invalid = (extra: Partial<LWProcess.Step>) => catalog.validate(timer(extra)).ok;
 assert.equal(invalid({duration: 5}), true); assert.equal(invalid({until: 5}), true);
 for (const extra of [{}, {duration: 5, until: 6}, {duration: 5, resources: {worker: 1}}, {duration: 5, cost: 3}, {duration: 5, backlog: {capacity: 2}}, {until: 0}, {until: 100000}, {duration: 0}, {duration: 100001}, {until: 2.5}]) assert.equal(invalid(extra), false, JSON.stringify(extra));
 assert.equal(catalog.validate(build(startEnd(stepOf('wait', 'timer', {duration: 5, resources: {worker: 1}})), [flowOf('start', 'wait'), flowOf('wait', 'end')], undefined, pool)).ok, false);
 const taskUntil = build(startEnd(stepOf('work', 'task', {duration: 2, until: 5})), [flowOf('start', 'work'), flowOf('work', 'end')]); assert.equal(catalog.validate(taskUntil).ok, false);
 const split = timer({duration: 5}); split.flows.push(flowOf('wait', 'start')); assert.equal(catalog.validate(split).ok, false);
 assert.equal(catalog.validate(timer({duration: 5, description: 'Wait a sprint', needs: [{field: 'ready'}]}), true).diagnostics.some(e => e.code === 'needs'), true);
});
test('Timers inside parallel regions, pending timers and run limits stay deterministic and never read as blocked', () => {
 const region = (a: LWProcess.Step, b: LWProcess.Step[] = [stepOf('review', 'task', {duration: 5, set: {reviewed: true}, add: {reviews: 1}})]) => build(
  [stepOf('start', 'start'), stepOf('fork', 'fork', {join: 'join'}), a, ...b, stepOf('join', 'join'), stepOf('end', 'end')],
  [flowOf('start', 'fork'), flowOf('fork', a.id), flowOf('fork', b[0]!.id), flowOf(a.id, 'join'), ...b.slice(1).map((x, i) => flowOf(b[i]!.id, x.id)), flowOf(b.at(-1)!.id, 'join'), flowOf('join', 'end')]);
 const sprint = region(stepOf('timebox', 'timer', {duration: 20, add: {sprints: 1}}));
 assert.equal(catalog.validate(sprint).ok, true);
 const s = runtime.create(sprint), states: LWProcess.Snapshot[] = [];
 try {
  for (let i = 0; i < 24; i++) {
   const q = s.advance(1); states.push(q); assert.deepEqual(s.query(), q, 'queries do not tick');
   if (q.minute >= 5 && q.minute < 20) {assert.equal(q.status, 'running', 'minute ' + q.minute); assert(!q.tokens.some(t => t.status === 'active')); assert.equal(q.steps.find(x => x.id === 'timebox')!.timers.waiting, 1);}
  }
 } finally {s.dispose();}
 const final = states.at(-1)!; assert.equal(final.status, 'completed'); assert.equal(final.minute, 20); assert.deepEqual(final.cases[0]!.data, {reviewed: true, reviews: 1, sprints: 1});
 assert.deepEqual(states[3]!.tokens.map(t => [t.status, t.due ?? null]).sort(), [['active', null], ['timer', 20]]); assert.deepEqual(final.receipts.map(r => [r.stepId, r.started, r.finished]), [['review', 0, 5], ['timebox', 0, 20]]);
 for (const minute of [1, 5, 7, 19, 20, 21]) assert.deepEqual(run(sprint, minute), states[Math.min(minute, 24) - 1], 'one advance equals ' + minute + ' single steps');
 const lone = region(stepOf('timebox', 'timer', {duration: 20}), [stepOf('review', 'task', {duration: 5}), stepOf('pause', 'timer', {until: 12})]);
 assert.equal(catalog.validate(lone).ok, true); assert.deepEqual(run(lone, 12).tokens.map(t => t.status).sort(), ['joining', 'timer']); assert.equal(run(lone, 12).status, 'running'); assert.equal(run(lone, 20).status, 'completed');
 const clash = (a: Partial<LWProcess.Step>, b: Partial<LWProcess.Step>) => catalog.validate(region(stepOf('timebox', 'timer', {duration: 5, ...a}), [stepOf('review', 'task', {duration: 5, ...b})])).ok;
 assert.equal(clash({set: {x: 1}}, {set: {y: 1}}), true); assert.equal(clash({add: {x: 1}}, {add: {y: 1}}), true);
 assert.equal(clash({add: {x: 1}}, {add: {x: 2}}), false); assert.equal(clash({add: {x: 1}}, {set: {x: 2}}), false); assert.equal(clash({set: {x: 1}}, {add: {x: 2}}), false);
 const capped = runtime.create(sprint, {horizon: 10}); try {
  const q = capped.advance(10); assert.equal(q.status, 'limit'); assert.equal(q.cases[0]!.status, 'active'); assert.equal(q.steps.find(x => x.id === 'timebox')!.timers.nextDue, 20);
  capped.setHorizon(null); assert.equal(capped.advance(10).status, 'completed');
 } finally {capped.dispose();}
 const far = runtime.create(build(startEnd(stepOf('wait', 'timer', {duration: 99999})), [flowOf('start', 'wait'), flowOf('wait', 'end')], [{at: 5, count: 1, interval: 0, data: {}}])); try {
  assert.equal(far.advance(99990).status, 'running'); assert.equal(far.advance(10).status, 'limit'); assert.equal(far.query().cases[0]!.status, 'active');
 } finally {far.dispose();}
 const flows = build(startEnd(stepOf('wait', 'timer', {duration: 4})), [flowOf('start', 'wait'), flowOf('wait', 'end')], [{at: 0, count: 3, interval: 2, data: {}}]);
 assert.deepEqual(run(flows, 7).receipts.map(r => [r.caseId, r.finished]), [['case-0001', 4], ['case-0002', 6]]); assert.deepEqual(run(flows, 50), run(flows, 50));
});
const pools: LWProcess.Resource[] = [{id: 'staff', name: 'Staff', capacity: 1, costPerMinute: 2}, {id: 'robot', name: 'Robot cell', capacity: 1, costPerMinute: 5, kind: 'machine'}, {id: 'ci', name: 'Build farm', capacity: 2, costPerMinute: 1, kind: 'system'}];
const automated = (steps: LWProcess.Step[] = [], flows: LWProcess.Flow[] = []) => build(
 [stepOf('start', 'start'), stepOf('prep', 'task', {duration: 4, cost: 10, resources: {staff: 1}, set: {prepared: true}}),
  stepOf('weld', 'machine', {duration: 6, cost: 20, resources: {robot: 1}, technology: 'Robot arm', needs: [{field: 'prepared'}], set: {welded: true}, add: {parts: 3}, outputs: [{field: 'welded', label: 'Welded frame'}, {field: 'parts'}]}),
  stepOf('split', 'fork', {join: 'sync'}), stepOf('build', 'system', {duration: 5, cost: 7, resources: {ci: 1}, technology: 'CI/CD pipeline', needs: [{field: 'welded'}], set: {built: true}, outputs: [{field: 'built'}]}),
  stepOf('inspect', 'task', {duration: 3, resources: {staff: 1}, set: {checked: true}, outputs: [{field: 'checked'}]}), stepOf('sync', 'join'), stepOf('end', 'end'), ...steps],
 [flowOf('start', 'prep'), flowOf('prep', 'weld'), flowOf('weld', 'split'), flowOf('split', 'build'), flowOf('split', 'inspect'), flowOf('build', 'sync'), flowOf('inspect', 'sync'), flowOf('sync', 'end'), ...flows],
 [{at: 0, count: 1, interval: 0, data: {}}], pools);
test('Machine and system steps run like tasks on machine and system pools with receipts and without people', () => {
 const d = automated(); assert.equal(catalog.validate(d).ok, true, JSON.stringify(catalog.validate(d).diagnostics));
 const q = run(d, 60); assert.equal(q.status, 'completed'); assert.equal(q.metrics.completed, 1); assert.equal(q.metrics.cost, 86); assert.equal(q.metrics.meanCycleMinutes, 15);
 assert.deepEqual(q.receipts.map(r => [r.stepId, r.started, r.finished]), [['prep', 0, 4], ['weld', 4, 10], ['inspect', 10, 13], ['build', 10, 15]]);
 const weld = q.receipts.find(r => r.stepId === 'weld')!;
 assert.deepEqual(weld.input, {prepared: true}); assert.deepEqual(weld.changes, {welded: true, parts: 3}); assert.deepEqual(weld.output, {prepared: true, welded: true, parts: 3});
 assert.deepEqual(q.receipts.find(r => r.stepId === 'build')!.changes, {built: true}); assert.deepEqual(q.cases[0]!.data, {prepared: true, welded: true, parts: 3, checked: true, built: true});
 const kinds = (id: string) => q.events.filter(e => e.stepId === id).map(e => e.kind);
 assert.deepEqual(kinds('weld'), ['entered', 'started', 'finished-task']); assert.deepEqual(kinds('build'), ['entered', 'started', 'finished-task']);
 const pool = (id: string) => q.resources.find(r => r.id === id)!;
 assert.deepEqual([pool('staff').kind, pool('robot').kind, pool('ci').kind], ['people', 'machine', 'system']);
 assert.equal(pool('robot').busyMinutes, 6); assert.equal(pool('robot').utilization, 0.4); assert.equal(pool('ci').busyMinutes, 5); assert.equal(pool('ci').utilization, 5 / 30); assert.equal(pool('staff').busyMinutes, 7);
 const mid = run(d, 7); assert.equal(mid.steps.find(s => s.id === 'weld')!.active, 1); assert.equal(mid.resources.find(r => r.id === 'robot')!.busy, 1); assert.equal(mid.resources.find(r => r.id === 'staff')!.busy, 0);
 const queued = build([stepOf('start', 'start'), stepOf('weld', 'machine', {duration: 5, resources: {robot: 1}}), stepOf('end', 'end')], [flowOf('start', 'weld'), flowOf('weld', 'end')], [{at: 0, count: 2, interval: 0, data: {}}], pools);
 const two = run(queued, 20); assert.deepEqual(two.receipts.map(r => [r.caseId, r.started, r.finished]), [['case-0001', 0, 5], ['case-0002', 5, 10]]); assert.equal(two.steps.find(s => s.id === 'weld')!.waitMinutes, 5);
 assert.deepEqual(run(d, 60), run(d, 60)); assert.equal(catalog.fingerprint(d), catalog.fingerprint(copy(d)));
});
test('Resource kinds, automated steps and declared outputs are validated explicitly', () => {
 const bad = (d: LWProcess.Definition) => catalog.validate(d).diagnostics.map(x => x.path + ' ' + x.message).join('|');
 const step = (id: string, kind: LWProcess.Kind, extra: Partial<LWProcess.Step>) => automated().steps.map(s => s.id === id ? {...s, kind, ...extra} : s);
 const mutate = (id: string, extra: Partial<LWProcess.Step>, kind?: LWProcess.Kind) => ({...automated(), steps: step(id, kind ?? automated().steps.find(s => s.id === id)!.kind, extra)});
 assert.match(bad(mutate('weld', {resources: {staff: 1}})), /machine pools, but "staff" is a people pool/);
 assert.match(bad(mutate('build', {resources: {robot: 1}})), /system pools, but "robot" is a machine pool/);
 assert.match(bad(mutate('weld', {resources: {}})), /\/resources A machine step must demand at least one machine pool/);
 const noResources = mutate('build', {}); delete noResources.steps.find(s => s.id === 'build')!.resources; assert.match(bad(noResources), /A system step must demand at least one system pool/);
 assert.match(bad(mutate('prep', {resources: {robot: 1}})), /Tasks may demand only people pools, but "robot" is a machine pool/);
 assert.match(bad(mutate('prep', {technology: 'Clipboard'})), /Technology is declared only on machine and system steps/);
 assert.match(bad(mutate('prep', {outputs: [{field: 'missing'}]})), /Step "prep" declares output missing but does not deliver it/);
 assert.match(bad(mutate('weld', {outputs: [{field: 'welded'}, {field: 'welded'}]})), /Output welded is declared twice/);
 assert.match(bad(mutate('build', {outputs: [{field: 'shipped'}]})), /Step "build" declares output shipped/);
 assert.equal(catalog.validate(mutate('weld', {technology: ''})).ok, false); assert.equal(catalog.validate(mutate('weld', {technology: 'x'.repeat(81)})).ok, false);
 assert.equal(catalog.validate(mutate('weld', {outputs: Array.from({length: 17}, (_, i) => ({field: 'f' + i}))})).ok, false);
 assert.equal(catalog.validate({...automated(), steps: [...automated().steps, stepOf('wait', 'timer', {duration: 2, resources: {robot: 1}})]}).ok, false);
 const timerTech = build(startEnd(stepOf('wait', 'timer', {duration: 2, technology: 'Clock'})), [flowOf('start', 'wait'), flowOf('wait', 'end')]); assert.equal(catalog.validate(timerTech).ok, false);
 const decisionTech = mutate('split', {technology: 'x'}); assert.equal(catalog.validate(decisionTech).ok, false);
 const unknown = copy(automated()); (unknown.resources[1] as unknown as {kind: string}).kind = 'robot'; assert.equal(catalog.validate(unknown).ok, false);
 assert.equal(catalog.validate({...automated(), resources: pools.map(p => ({...p, kind: undefined}))}).ok, false);
 const legacy = copy(agency); assert.equal(legacy.resources.every(r => r.kind === undefined), true); assert.equal(catalog.validate(legacy).ok, true);
 const people = build(startEnd(stepOf('work', 'task', {duration: 2, resources: {staff: 1}})), [flowOf('start', 'work'), flowOf('work', 'end')], undefined, [{id: 'staff', name: 'Staff', capacity: 1, costPerMinute: 0}]);
 assert.equal(catalog.validate(people).ok, true); assert.equal(run(people, 5).resources[0]!.kind, 'people');
 assert.throws(() => runtime.create(mutate('weld', {resources: {staff: 1}})), /machine pools/);
});
test('Loan application demo converted from BPMN completes with exact inclusive, multi-instance and SLA escalation evidence', () => {
 const loan = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../docs/concepts/agency-delivery/content/loan-application.process.json'), 'utf8')) as LWProcess.Definition;
 const admission = catalog.validate(loan); assert.equal(admission.ok, true); assert.deepEqual(admission.diagnostics, []); assert.equal(catalog.fingerprint(loan), '221bcc4d80ed5e55');
 assert.equal(loan.id, 'loan-application'); assert.equal(loan.seed, 7); assert(loan.steps.every(s => s.scene && !s.scene.asset && typeof s.phase === 'string'), 'every step has a scene marker and a phase');
 const at = (id: string) => loan.steps.find(s => s.id === id)!;
 assert.equal(at('gw-extra').mode, 'inclusive'); assert.deepEqual(at('sub-docs-task-verify').instances, {count: 3, mode: 'parallel'}); assert.deepEqual(at('task-review').deadline, {mode: 'escalate', flow: 'f-sla', after: 90});
 // The applicant is the case, not a capacity: its two steps are pool-free touchpoints and no Customer pool remains.
 const applicant = ['task-submit', 'task-sign'].map(id => [at(id).kind, at(id).channel, at(id).resources]);
 assert.deepEqual(applicant, [['touchpoint', 'web', undefined], ['touchpoint', 'document', undefined]]);
 assert.deepEqual(loan.resources.map(r => r.id), ['bank-clerk', 'credit-engine', 'automation']);
 // Main-route ends carry outcomes; the escalation end has none (an escalation end's outcome is never counted).
 assert.deepEqual(['end-paid', 'end-rejected', 'end-breach'].map(id => at(id).outcome), ['goal', 'lost', undefined]);
 assert.deepEqual(loan.arrivals, [{at: 0, until: 960, interval: 30, gap: {dist: 'exponential', mean: 30}, draws: [{field: 'amount', kind: 'int', min: 1000, max: 50000}, {field: 'years', kind: 'int', min: 0, max: 10}], data: {}}]);
 const q = run(loan, 1500), step = (id: string) => q.steps.find(s => s.id === id)!;
 assert.deepEqual([q.seed, q.minute, q.status, q.metrics.arrived, q.metrics.completed, q.metrics.failed, q.metrics.cost, q.metrics.meanCycleMinutes], [7, 984, 'completed', 32, 32, 0, 2414, 50.125]);
 assert.deepEqual([q.metrics.goals, q.metrics.lost, q.metrics.conversion, q.metrics.capacityCost], [31, 1, 969, 13776]);
 assert.deepEqual(q.resources.map(r => [r.id, r.kind, r.busyMinutes]), [['bank-clerk', 'people', 923], ['credit-engine', 'system', 253], ['automation', 'system', 64]]);
 assert.equal(Math.round(q.resources.find(r => r.id === 'bank-clerk')!.utilization * 1000), 313);
 assert.deepEqual(step('sub-docs-task-verify').items, {started: 96, finished: 96}); assert.equal(step('sub-docs-task-verify').completed, 32);
 assert.deepEqual(step('task-review').deadlines, {interrupted: 0, escalated: 1}); assert.deepEqual(['task-notify', 'end-breach'].map(id => step(id).completed), [1, 1]);
 // Inclusive fork: 9 medium-risk cases; 7 income and 2 employer branches plus 2 default (empty) branches reach the join, which continues 9 times.
 assert.deepEqual(['gw-extra', 'task-income', 'task-employer', 'gw-extrajoin'].map(id => [step(id).visits, step(id).completed]), [[9, 9], [7, 7], [2, 2], [11, 9]]);
 assert.deepEqual(['gw-risk', 'task-review', 'gw-review', 'task-sign', 'end-paid', 'end-rejected'].map(id => step(id).completed), [32, 3, 3, 31, 31, 1]);
 // Clock chunking: one advance equals 1, 7 and 60 minute chunks (and a mixed cycle); capacity is never exceeded.
 const chunked = (chunks: number[]) => { const s = runtime.create(loan); try { let r = s.query(); for (let done = 0, i = 0; done < 1500; i++) { const n = Math.min(chunks[i % chunks.length]!, 1500 - done); r = s.advance(n); done += n; for (const u of r.resources) assert(u.busy <= u.capacity, `${u.id} within capacity at ${r.minute}`); } return JSON.stringify(r); } finally { s.dispose(); } };
 const reference = JSON.stringify(q); for (const chunks of [[1500], [1], [7], [60], [1, 7, 60]]) assert.equal(chunked(chunks), reference, `chunks ${chunks.join('/')}`);
 assert.deepEqual(JSON.parse(JSON.stringify(run(copy(loan), 1500))), q);
 const other = (() => { const s = runtime.create(loan, {seed: 8}); try { return s.advance(1500); } finally { s.dispose(); } })();
 assert.deepEqual([other.seed, other.minute, other.metrics.arrived, other.metrics.completed, other.metrics.cost], [8, 1104, 34, 34, 3301]);
 assert.deepEqual([other.metrics.goals, other.metrics.lost, other.metrics.conversion], [31, 3, 912]);
});

test('Weekly delivery and release train runs refinement, planning, dailies, review and retro from a 0.1.0 skeleton to the 1.0.0 MVP with exact evidence', () => {
 const train = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../docs/concepts/agency-delivery/content/delivery-release.process.json'), 'utf8')) as LWProcess.Definition;
 const admission = catalog.validate(train); assert.equal(admission.ok, true); assert.deepEqual(admission.diagnostics, []); assert.equal(catalog.fingerprint(train), 'bb5b3b08b28b3bb6');
 assert.equal(train.id, 'delivery-release'); assert.equal(train.seed, 7); assert.equal(train.genre, undefined); assert(train.steps.every(s => s.scene && !s.scene.asset && typeof s.phase === 'string'), 'every step has a scene marker and a phase');
 const at = (id: string) => train.steps.find(s => s.id === id)!;
 assert.deepEqual(at('build').instances, {field: 'plannedItems', mode: 'parallel'}); assert.deepEqual(at('dailies').instances, {count: 4, mode: 'sequential'});
 assert.deepEqual(at('build').deadline, {after: 1440, mode: 'escalate', flow: 'build-impediment'}); assert.equal(at('release-prep').mode, 'inclusive'); assert.equal(at('iteration').mode, undefined);
 assert.deepEqual(train.flows.filter(f => f.from === 'feedback').map(f => [f.to, f.when ?? null]), [['reprioritise', {chance: 30}], ['retro', null]]);
 assert.deepEqual(train.arrivals, [{at: 0, count: 1, interval: 0, data: {}, draws: [{field: 'mvpIncrements', kind: 'int', min: 6, max: 8}]}]);
 const q = run(train, 20000), step = (id: string) => q.steps.find(s => s.id === id)!;
 assert.deepEqual([q.seed, q.minute, q.status, q.metrics.arrived, q.metrics.completed, q.metrics.failed, q.metrics.cost, q.metrics.meanCycleMinutes], [7, 19007, 'completed', 1, 1, 0, 119928, 19007]);
 assert.deepEqual(q.resources.map(r => [r.id, r.kind, r.busyMinutes]), [['product-owner', 'people', 3180], ['delivery-lead', 'people', 1860], ['developers', 'people', 33602], ['ux-designer', 'people', 1095], ['stakeholders', 'people', 1725], ['ci-pipeline', 'system', 372]]);
 assert.equal(Math.round(q.resources.find(r => r.id === 'developers')!.utilization * 1000), 589);
 // Eight weekly iterations after 0.1.0 release 0.2.0 to 0.9.0; one review asked for more, so the drawn MVP scope of 8 grew to 9 before 1.0.0.
 assert.deepEqual(q.cases[0]!.input, {mvpIncrements: 8}); assert.deepEqual([q.cases[0]!.data.increments, q.cases[0]!.data.iteration, q.cases[0]!.data.mvpIncrements, q.cases[0]!.data.impediments], [9, 8, 9, 1]);
 assert.deepEqual(['skeleton-release', 'refinement', 'planning', 'review', 'feedback', 'reprioritise', 'retro', 'release-pipeline', 'mvp-launch', 'mvp-live'].map(id => step(id).completed), [1, 8, 8, 8, 8, 1, 8, 8, 1, 1]);
 // Parallel items queue for three developers; four sequential iteration days per week; one overdue item escalated to the impediment route.
 assert.deepEqual([step('build').items, step('build').waitMinutes, step('dailies').items], [{started: 30, finished: 30}, 3986, {started: 32, finished: 32}]);
 assert.deepEqual(step('build').deadlines, {interrupted: 0, escalated: 1}); assert.deepEqual(['impediment', 'impediment-handled'].map(id => step(id).completed), [1, 1]);
 // Inclusive release gateway: 8 releases; 3 UX and 4 migration branches plus 3 default (empty) branches reach the join, which continues 8 times.
 assert.deepEqual(['release-prep', 'ux-acceptance', 'migration-rehearsal', 'release-ready'].map(id => [step(id).visits, step(id).completed]), [[8, 8], [3, 3], [4, 4], [10, 8]]);
 // Clock chunking: one advance equals 1, 7 and 60 minute chunks (and a mixed cycle); capacity is never exceeded.
 const chunked = (chunks: number[]) => { const s = runtime.create(train); try { let r = s.query(); for (let done = 0, i = 0; done < 20000; i++) { const n = Math.min(chunks[i % chunks.length]!, 20000 - done); r = s.advance(n); done += n; for (const u of r.resources) assert(u.busy <= u.capacity, `${u.id} within capacity at ${r.minute}`); } return JSON.stringify(r); } finally { s.dispose(); } };
 const reference = JSON.stringify(q); for (const chunks of [[20000], [1], [7], [60], [1, 7, 60]]) assert.equal(chunked(chunks), reference, `chunks ${chunks.join('/')}`);
 assert.deepEqual(JSON.parse(JSON.stringify(run(copy(train), 20000))), q);
 const other = (() => { const s = runtime.create(train, {seed: 8}); try { return s.advance(20000); } finally { s.dispose(); } })();
 assert.deepEqual([other.seed, other.minute, other.status, other.metrics.completed, other.metrics.cost, other.cases[0]!.data.increments, other.cases[0]!.data.mvpIncrements], [8, 20000, 'running', 0, 136123, 8, 9]);
});
