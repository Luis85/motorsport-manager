/// <reference path="./process-contracts.d.ts" />
/**
 * Step kinds: timers, counters, field conditions, machine and system steps. The bundled example processes that exercise
 * them keep their pinned end-to-end evidence in test-process-demos.cts.
 */
import assert from 'node:assert/strict';
import {catalog, runtime} from './process-sdk.cjs';
import {test, copy, agency, run, stepOf, flowOf, build, startEnd} from './test-process-helpers.cjs';

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
