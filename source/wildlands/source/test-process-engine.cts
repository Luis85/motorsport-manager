/// <reference path="./process-contracts.d.ts" />
/** Engine core: business-minute clock, detached queries, capacity, decisions, joins, rework, chunking, horizons, backlogs and needs. */
import assert from 'node:assert/strict';
import {catalog, runtime} from './process-sdk.cjs';
import {test, base, copy, agency, run, stepOf, flowOf, build, startEnd} from './test-process-helpers.cjs';

test('One task completes at its declared business minute with detached read queries', () => {
 const s = runtime.create(base()), first = s.query(); first.cases[0]!.data.changed = true;
 assert.equal(s.query().minute, 0); assert.equal(s.query().cases[0]!.data.changed, undefined);
 assert.equal(s.advance(4).metrics.completed, 0); const q = s.advance(1);
 assert.equal(q.minute, 5); assert.equal(q.metrics.meanCycleMinutes, 5); assert.equal(q.metrics.completed, 1); s.dispose(); assert.throws(() => s.query());
});
test('Process inputs and per-visit outputs remain detached after later changes', () => {
 const d = base(); d.arrivals[0]!.data = {approved: false, note: '<input>', empty: null, count: 0}; d.steps[1]!.set = {approved: true};
 const session = runtime.create(d), first = session.query();
 assert.deepEqual(first.tokens[0]!.input, d.arrivals[0]!.data); first.tokens[0]!.input!.approved = 'tampered';
 const q = session.advance(5); assert.equal(q.cases[0]!.input.approved, false); assert.equal(q.cases[0]!.data.approved, true);
 assert.equal(q.receipts[0]!.input.approved, false); assert.equal(q.receipts[0]!.output.approved, true);
 assert.deepEqual(q.receipts[0]!.changes, {approved: true}); assert.equal(q.receipts[0]!.started, 0); assert.equal(q.receipts[0]!.finished, 5);
 q.receipts[0]!.output.approved = 'tampered'; assert.equal(session.query().receipts[0]!.output.approved, true); session.dispose();
});
test('Queued visits have no captured inputs or completed outputs until started', () => {
 const d = base(); d.resources = [{id: 'worker', name: 'Worker', capacity: 1, costPerMinute: 0}]; d.steps[1]!.resources = {worker: 1}; d.arrivals[0]!.count = 2;
 const session = runtime.create(d); assert.equal(session.query().tokens[1]!.input, null); assert.equal(session.query().receipts.length, 0);
 const q = session.advance(5); assert.equal(q.receipts.length, 1); assert.equal(q.tokens[0]!.started, 5); assert.deepEqual(q.tokens[0]!.input, {}); session.dispose();
});
test('Rework and parallel visits retain actual start data and explicit writes', () => {
 const q = run(agency, 500), rework = q.receipts.find(r => r.stepId === 'rework')!;
 assert.equal(rework.input.needsRework, true); assert.equal(rework.output.needsRework, false);
 const repeated = q.receipts.filter(r => r.caseId === rework.caseId && r.stepId === 'qa');
 assert.equal(repeated.length, 2); assert.notEqual(repeated[0]!.id, repeated[1]!.id);
 const ux = q.receipts.find(r => r.stepId === 'product-design')!, tech = q.receipts.find(r => r.stepId === 'architecture')!;
 assert.deepEqual(ux.changes, {requirementsReady: true}); assert.deepEqual(tech.changes, {techReady: true});
 assert.equal(ux.input.requirementsReady, undefined); assert.equal(tech.input.techReady, undefined);
});
test('Completion history is bounded without dropping process inputs or final outputs', () => {
 const d = base(); d.arrivals[0]!.count = 200; d.arrivals[0]!.data = {request: 'kept'}; d.steps[1]!.set = {done: true};
 const q = run(d, 5); assert.equal(q.receipts.length, 128); assert.equal(q.receiptsDropped, 72);
 assert.equal(q.cases.length, 200); assert(q.cases.every(c => c.input.request === 'kept' && c.data.done));
});
test('FIFO shared capacity produces exact queue times, utilization and costs', () => {
 const d = base(); d.resources = [{id: 'worker', name: 'Worker', capacity: 1, costPerMinute: 2}];
 d.steps[1]!.resources = {worker: 1}; d.steps[1]!.cost = 7; d.arrivals[0]!.count = 2;
 const q = run(d, 20); assert.equal(q.minute, 10); assert.equal(q.metrics.completed, 2); assert.equal(q.metrics.cost, 34);
 assert.equal(q.steps.find(s => s.id === 'work')!.waitMinutes, 5); assert.equal(q.resources[0]!.busyMinutes, 10); assert.equal(q.resources[0]!.utilization, 1);
 assert.deepEqual(q.cases.map(c => c.finished), [5, 10]);
});
test('Multiple resources allocate atomically and never exceed capacity', () => {
 const d = base(); d.resources = [{id: 'a', name: 'A', capacity: 2, costPerMinute: 1}, {id: 'b', name: 'B', capacity: 1, costPerMinute: 1}];
 d.steps[1]!.resources = {a: 2, b: 1}; d.arrivals[0]!.count = 3;
 const s = runtime.create(d); for (let i = 0; i < 15; i++) {const q = s.query(); assert(q.resources.every(r => r.busy <= r.capacity)); s.advance(1);}
 const q = s.query(); assert.equal(q.metrics.cost, 45); assert.equal(q.metrics.completed, 3); assert(q.resources.every(r => !r.busy)); s.dispose();
});
test('Future arrivals and zero interval batches preserve authored arrival order', () => {
 const d = base(); d.arrivals = [{at: 10, count: 2, interval: 0, data: {label: 'batch'}}, {at: 0, count: 1, interval: 0, data: {label: 'first'}}];
 const s = runtime.create(d); assert.equal(s.query().cases[0]!.data.label, 'first');
 assert.equal(s.advance(9).metrics.arrived, 1); assert.equal(s.advance(1).metrics.arrived, 3); assert.equal(s.advance(5).metrics.completed, 3); s.dispose();
});
test('Agency parallel joins and rework complete with exact deterministic evidence', () => {
 const q = run(agency, 500); assert.equal(q.minute, 217); assert.equal(q.metrics.completed, 6); assert.equal(q.metrics.failed, 0); assert.equal(q.metrics.cost, 1752);
 assert.equal(q.steps.find(s => s.id === 'design-ready')!.completed, 6); assert.equal(q.steps.find(s => s.id === 'qa')!.completed, 9);
 assert.equal(q.steps.find(s => s.id === 'rework')!.completed, 3); assert(q.cases.every(c => c.data.requirementsReady && c.data.techReady && !c.data.needsRework));
});
test('Chunked clock commands and one bounded run produce identical snapshots', () => {
 const whole = run(agency, 150), s = runtime.create(agency); for (let i = 0; i < 15; i++) s.advance(10);
 assert.deepEqual(s.query(), whole); s.dispose();
});
test('Decisions take matching rules before fallback regardless of fallback position', () => {
 const d = copy(agency); const fallback = d.flows.findIndex(f => f.from === 'review-gate' && !f.when); d.flows.unshift(d.flows.splice(fallback, 1)[0]!);
 const q = run(d, 500); assert.equal(q.steps.find(s => s.id === 'rework')!.completed, 3);
});
test('Missing condition fields choose fallback and numeric comparisons are typed', () => {
 const d = copy(agency); d.arrivals.forEach(a => a.data = {}); d.steps.find(s => s.id === 'handover')!.needs!.pop(); const q = run(d, 500); assert.equal(q.steps.find(s => s.id === 'rework')!.completed, 0);
 const graph = (globalThis as unknown as {LWProcessGraph: {matches(data: LWProcess.Fields, c: LWProcess.Condition): boolean}}).LWProcessGraph;
 for (const op of ['gt', 'gte', 'lt', 'lte'] as const) assert.equal(graph.matches({value: '5'}, {field: 'value', op, value: 3}), false);
 assert.equal(graph.matches({}, {field: 'missing', op: 'ne', value: true}), false);
});
test('Zero-work routing loops fail explicitly within the transition budget', () => {
 const d = base(); d.steps[1]!.kind = 'decision'; delete d.steps[1]!.duration;
 d.flows.push({id: 'repeat', from: 'work', to: 'work', when: {field: 'again', op: 'eq', value: true}}); d.arrivals[0]!.data.again = true;
 const s = runtime.create(d), q = s.query(); assert.equal(q.metrics.failed, 1); assert.equal(q.tokens.length, 0); assert.match(q.cases[0]!.error!, /2048/); s.dispose();
});
test('Bounded run limits and rejected clock commands preserve state', () => {
 const d = base(); d.steps[1]!.duration = 100000; d.arrivals[0]!.at = 1;
 const s = runtime.create(d), before = s.query(); for (const n of [0, -1, .5, NaN, Infinity, 100001]) assert.throws(() => s.advance(n));
 assert.deepEqual(s.query(), before); assert.equal(s.advance(100000).status, 'limit'); assert.throws(() => s.advance(1)); s.dispose();
});
test('Run horizon is configurable per session, defaults to the engine limit and may be unlimited', () => {
 const d = base(); d.steps[1]!.duration = 100000; d.arrivals[0]!.at = 1;
 const short = runtime.create(d, {horizon: 10}); assert.equal(short.horizon(), 10); assert.throws(() => short.advance(11)); assert.equal(short.advance(10).status, 'limit');
 short.setHorizon(null); assert.equal(short.advance(5).status, 'running'); assert.throws(() => short.setHorizon(0)); assert.throws(() => short.setHorizon(1.5)); short.dispose();
 const open = runtime.create(d, {horizon: null}); assert.equal(open.advance(100000).minute, 100000); assert.equal(open.query().status, 'running'); assert.equal(open.advance(100000).status, 'completed'); open.dispose();
 const fixed = runtime.create(d); assert.equal(fixed.horizon(), runtime.limits.minutes); assert.equal(fixed.advance(100000).status, 'limit'); fixed.dispose();
});
/** start -> intake task (1 min) -> bench task (10 min, one worker, optional backlog) -> end, with one arrival per listed priority. */
function bench(backlog: LWProcess.Backlog | undefined, priorities: number[], gap = 2): LWProcess.Definition {
 const d = base(); d.resources = [{id: 'worker', name: 'Worker', capacity: 1, costPerMinute: 1}];
 d.steps[1]!.id = 'intake'; d.steps[1]!.duration = 1; d.steps[1]!.scene.id = 'scene-intake'; d.flows[0]!.to = 'intake'; d.flows[1]!.from = 'bench'; d.flows[0]!.id = 'start-intake';
 d.steps.splice(2, 0, {id: 'bench', name: 'Bench', kind: 'task', duration: 10, resources: {worker: 1}, scene: {id: 'scene-bench', position: [24, 0], color: '#ffbb73'}});
 d.steps[3]!.scene.position = [36, 0]; if (backlog) d.steps[2]!.backlog = backlog;
 d.flows.splice(1, 0, {id: 'intake-bench', from: 'intake', to: 'bench'}); d.flows[2]!.id = 'bench-end';
 d.arrivals = priorities.map((priority, i) => ({at: i * gap, count: 1, interval: 0, data: {priority}}));
 return catalog.admit(d);
}
const startedOrder = (d: LWProcess.Definition) => {const s = runtime.create(d); try {s.advance(100); return s.query().events.filter(e => e.kind === 'started' && e.stepId === 'bench').map(e => e.caseId);} finally {s.dispose();}};
test('Task backlogs bound waiting work, hold upstream work and honour fifo, lifo and priority order', () => {
 const d = bench({capacity: 1}, [1, 1, 1, 1]), s = runtime.create(d); let held = false;
 for (let i = 0; i < 60; i++) {
  const q = s.advance(1), waiting = q.tokens.filter(t => t.stepId === 'bench' && t.status !== 'active' && t.status !== 'held').length;
  assert(waiting <= 1, 'backlog exceeded capacity'); held ||= q.tokens.some(t => t.status === 'held');
 }
 assert(held); assert.equal(s.advance(40).metrics.completed, 4); s.dispose();
 // The first case starts at once; the rest wait while it works, so their order shows the backlog rule.
 assert.deepEqual(startedOrder(bench(undefined, [1, 1, 3, 2])), ['case-0001', 'case-0002', 'case-0003', 'case-0004']);
 assert.deepEqual(startedOrder(bench({capacity: 3, order: 'lifo'}, [1, 1, 3, 2])), ['case-0001', 'case-0004', 'case-0003', 'case-0002']);
 assert.deepEqual(startedOrder(bench({capacity: 3, order: 'priority', priority: 'priority'}, [1, 1, 3, 2])), ['case-0001', 'case-0003', 'case-0004', 'case-0002']);
});
test('Join backlogs fill on merge and release work downstream only within the pull limit', () => {
 const q = run(agency, 500), steps = new Map(agency.steps.map(s => [s.id, s])); assert.deepEqual(steps.get('design-ready')!.backlog, {capacity: 3, order: 'priority', priority: 'priority', pull: 1});
 const s = runtime.create(agency); let most = 0, deepest = 0;
 for (let i = 0; i < 260; i++) {
  const now = s.advance(1);
  most = Math.max(most, now.tokens.filter(t => t.stepId === 'design-ready' && t.status === 'backlog').length);
  deepest = Math.max(deepest, now.tokens.filter(t => t.stepId === 'implementation' && ['queued', 'active', 'routing'].includes(t.status)).length);
 }
 s.dispose(); assert(most >= 2 && most <= 3); assert.equal(deepest, 1);
 const priorities = q.events.filter(e => e.kind === 'pulled').map(e => e.caseId); assert(priorities.length >= 3);
 assert.equal(q.minute, 217); assert(q.cases.every(c => c.status === 'completed'));
});
test('Backlog configuration is validated for kind, order fields and pull targets', () => {
 const bad = (mutate: (d: LWProcess.Definition) => void) => {const d = copy(agency); mutate(d); return catalog.validate(d).ok;};
 const step = (d: LWProcess.Definition, id: string) => d.steps.find(s => s.id === id)!;
 assert.equal(bad(d => {step(d, 'discovery').backlog = {capacity: 2, pull: 1};}), false);
 assert.equal(bad(d => {step(d, 'review-gate').backlog = {capacity: 2};}), false);
 assert.equal(bad(d => {delete step(d, 'design-ready').backlog!.priority;}), false);
 assert.equal(bad(d => {step(d, 'design-ready').backlog!.order = 'fifo';}), false);
 assert.equal(bad(d => {step(d, 'design-ready').backlog!.capacity = 0;}), false);
 assert.equal(bad(d => {step(d, 'design-ready').backlog = {capacity: 4};}), true);
});
test('Needs are checked statically against arrivals, earlier deliveries, parallel merges and decision routes', () => {
 const bad = (mutate: (d: LWProcess.Definition) => void) => {const d = copy(agency); mutate(d); return catalog.validate(d).diagnostics.filter(e => e.code === 'needs').map(e => e.path);};
 const step = (d: LWProcess.Definition, id: string) => d.steps.find(s => s.id === id)!;
 assert.deepEqual(bad(() => {}), []);
 assert.deepEqual(bad(d => {delete step(d, 'product-design').set;}), ['/steps/5/needs/0', '/steps/6/needs/0']);
 assert.deepEqual(bad(d => {step(d, 'product-design').set = {requirementsReady: false};}), ['/steps/5/needs/0', '/steps/6/needs/0']);
 assert.deepEqual(bad(d => {step(d, 'handover').needs = [{field: 'needsRework', op: 'eq', value: true}];}), ['/steps/10/needs/0']);
 assert.deepEqual(bad(d => {step(d, 'handover').needs = [{field: 'priority', op: 'gte', value: 1}, {field: 'missing'}];}), ['/steps/10/needs/1']);
 assert.deepEqual(bad(d => {step(d, 'architecture').needs = [{field: 'requirementsReady'}];}), ['/steps/4/needs/0']);
 const diagnostics = (mutate: (d: LWProcess.Definition) => void) => {const d = copy(agency); mutate(d); return catalog.validate(d).diagnostics.map(e => e.path);};
 assert.deepEqual(diagnostics(d => {step(d, 'intake').needs = [{field: 'x'}];}), ['/steps/0/needs/0']);
 assert.deepEqual(diagnostics(d => {step(d, 'handover').needs = [{field: 'priority', op: 'gte'}];}), ['/steps/10/needs/0']);
});
test('Needs report earlier deliveries and describe themselves', () => {
 const steps = agency.steps, deliveries = (id: string) => (globalThis as unknown as {LWProcessNeeds: LWProcessNeeds.Api}).LWProcessNeeds.deliveries(agency, id);
 assert.deepEqual(deliveries('implementation'), [{field: 'requirementsReady', steps: ['product-design'], arrivals: false}, {field: 'techReady', steps: ['architecture'], arrivals: false}]);
 assert.deepEqual(deliveries('handover').map(x => x.field), ['verified', 'needsRework']); assert.equal(steps.length, 12);
 const needs = (globalThis as unknown as {LWProcessNeeds: LWProcessNeeds.Api}).LWProcessNeeds;
 assert.equal(needs.holds({field: 'built', op: 'eq', value: true}, {built: true}), true); assert.equal(needs.holds({field: 'built'}, {}), false);
 assert.equal(needs.describe({field: 'priority', op: 'gte', value: 2}), 'priority \u2265 2'); assert.equal(needs.describe({field: 'built'}), 'built delivered');
});

test('Escalation routes cannot race the normal route on case fields and needs analysis widens what each side may read', () => {
 // slow escalates after 2 minutes to wait -> check while the normal route continues to setx, on the same case data.
 const steps = (extra: {setx?: Partial<LWProcess.Step>; check?: Partial<LWProcess.Step>}) => [stepOf('start', 'start'), stepOf('slow', 'task', {duration: 10, deadline: {after: 2, mode: 'escalate', flow: 'esc'}}),
  stepOf('setx', 'task', {duration: 1, set: {x: 2}, ...extra.setx}), stepOf('end', 'end'), stepOf('wait', 'timer', {duration: 20}), stepOf('check', 'task', {duration: 1, ...extra.check}), stepOf('end2', 'end')];
 const flows: LWProcess.Flow[] = [flowOf('start', 'slow'), flowOf('slow', 'setx'), flowOf('setx', 'end'), {id: 'esc', from: 'slow', to: 'wait', on: 'deadline'}, flowOf('wait', 'check'), flowOf('check', 'end2')];
 const data = (fields: LWProcess.Fields): LWProcess.Arrival[] => [{at: 0, count: 1, interval: 0, data: fields}];
 const why = (d: LWProcess.Definition) => catalog.validate(d).diagnostics.map(x => x.path + ' ' + x.message);
 // The escalation path reads x, which the normal route rewrites at any moment: x may be 1 or 2 there (the run used to fail the case).
 assert.deepEqual(why(build(steps({check: {needs: [{field: 'x', op: 'eq', value: 1}]}}), flows, data({x: 1}))), ['/steps/5/needs/0 Needs x = 1, but it is delivered only on some routes; possible values: 1, 2.']);
 assert.deepEqual(why(build(steps({check: {needs: [{field: 'x'}]}}), flows, data({x: 1}))), []);
 // Both sides writing one field is a race whatever reads it.
 assert.deepEqual(why(build(steps({check: {set: {x: 99}}}), flows, data({x: 1}))), ['/steps/1/deadline The escalation path and the work that continues beside it both write x; the result would depend on timing. Give each side its own fields.']);
 // The normal route sees the escalation path's writes too.
 assert.deepEqual(why(build(steps({check: {set: {y: 1}}, setx: {needs: [{field: 'y', op: 'eq', value: 0}]}}), flows, data({x: 1, y: 0}))), ['/steps/2/needs/0 Needs y = 0, but it is delivered only on some routes; possible values: 0, 1.']);
 // Separate fields stay admitted and run as before.
 const fine = build(steps({check: {set: {alerted: true}, needs: [{field: 'x'}]}}), flows, data({x: 1}));
 assert.deepEqual(why(fine), []); const q = run(fine, 100); assert.deepEqual([q.metrics.completed, q.metrics.failed, q.steps.find(x => x.id === 'slow')!.deadlines], [1, 0, {interrupted: 0, escalated: 1}]);
});

test('Needs analysis reports an instance count field that nothing delivers and names only upstream writers', () => {
 const d = build(startEnd(stepOf('t', 'task', {duration: 2, instances: {field: 'lines', mode: 'parallel'}})), [flowOf('start', 't'), flowOf('t', 'end')]), v = catalog.validate(d);
 assert.equal(v.ok, false); assert.deepEqual(v.diagnostics, [{path: '/steps/1/instances/field', code: 'needs', message: 'Instances read case field lines as a whole number from 1 to 50, but no earlier step or arrival delivers lines, so every case would fail at this step.'}]);
 // A delivered value is judged per case when the step is entered, as documented.
 assert.equal(catalog.validate({...d, arrivals: [{at: 0, count: 1, interval: 0, data: {lines: 3}}]}).ok, true);
 const needs = (globalThis as unknown as {LWProcessNeeds: LWProcessNeeds.Api}).LWProcessNeeds;
 const later = build(startEnd(stepOf('t', 'task', {duration: 2, needs: [{field: 'n'}]}), stepOf('later', 'task', {duration: 1, add: {n: 1}})), [flowOf('start', 't'), flowOf('t', 'later'), flowOf('later', 'end')]);
 assert.deepEqual(needs.deliveries(later, 't'), [{field: 'n', steps: [], arrivals: false}]);
 const earlier = build(startEnd(stepOf('first', 'task', {duration: 1, add: {n: 1}}), stepOf('t', 'task', {duration: 2, needs: [{field: 'n'}]})), [flowOf('start', 'first'), flowOf('first', 't'), flowOf('t', 'end')]);
 assert.deepEqual(needs.deliveries(earlier, 't'), [{field: 'n', steps: ['first'], arrivals: false}]);
});

test('The token serial limit stops a run before a fork, an item group or an arrival is half applied', () => {
 const g = globalThis as unknown as {LWECS: LWProcess.Ecs; LWProcessSystems: LWProcess.Systems}, LIMIT = 99999999;
 const state = (d: LWProcess.Definition, serial: number): LWProcess.State => {
  const world = new g.LWECS.World(), clock: LWProcess.Clock = {minute: 0, serial, forkSerial: 0, arrival: 0, cost: 0, arrived: 0, completed: 0, failed: 0, dropped: 0, cycle: 0, pruned: 0, goals: 0, lost: 0};
  world.create('process-clock'); world.set('process-clock', 'process-clock', clock);
  for (const r of d.resources) { world.create('pool-' + r.id); world.set('pool-' + r.id, 'process-pool', {...r, busy: 0, busyMinutes: 0}); }
  for (const s of d.steps) { world.create('station-' + s.id); world.set('station-' + s.id, 'process-station', {id: s.id, visits: 0, completed: 0, waitMinutes: 0, reached: 0, ...s.instances ? {items: {started: 0, finished: 0}} : {}}); }
  return {world, definition: d, clock, events: [], receipts: [], receiptsDropped: 0, failures: [], steps: new Map(d.steps.map(s => [s.id, s])), outgoing: new Map(d.steps.map(s => [s.id, d.flows.filter(f => f.from === s.id)])),
   deadlines: new Map(), groups: new Map(), spawns: [], outcomes: new Map(), streams: d.arrivals.map((def, index) => ({def, index, k: 0, at: def.at})), seed: 1, active: 500, retained: 200, finished: [], visits: new Map(),
   tokenList: null, poolList: null, seen: new Map(), finishAgg: new Map(), entryAgg: new Map()};
 };
 const tokens = (s: LWProcess.State) => s.world.query(['process-token']).map(id => s.world.get<LWProcess.Token>(id, 'process-token')!);
 const exhaust = (s: LWProcess.State) => assert.throws(() => { g.LWProcessSystems.admit(s); g.LWProcessSystems.settle(s); }, /The run created more than 99999999 tokens; start a new run\./);
 const forked = build([stepOf('start', 'start'), stepOf('fork', 'fork', {join: 'merge'}), stepOf('a', 'task', {duration: 1}), stepOf('b', 'task', {duration: 1}), stepOf('merge', 'join'), stepOf('end', 'end')],
  [flowOf('start', 'fork'), flowOf('fork', 'a'), flowOf('fork', 'b'), flowOf('a', 'merge'), flowOf('b', 'merge'), flowOf('merge', 'end')]);
 const fork = state(forked, LIMIT - 1); exhaust(fork);
 // The fork has not consumed its token, counted a completion or opened an occurrence.
 assert.deepEqual(tokens(fork).map(t => [t.stepId, t.status]), [['fork', 'routing']]); assert.equal(fork.clock.forkSerial, 0); assert.equal(fork.world.get<LWProcess.Station>('station-fork', 'process-station')!.completed, 0);
 const items = state(build(startEnd(stepOf('t', 'task', {duration: 2, instances: {count: 3, mode: 'parallel'}})), [flowOf('start', 't'), flowOf('t', 'end')]), LIMIT - 2); exhaust(items);
 assert.deepEqual(tokens(items).map(t => [t.stepId, t.status, t.group ?? null]), [['t', 'routing', null]]); assert.equal(items.groups.size, 0); assert.equal(items.visits.get('case-0001')?.get('t'), undefined);
 const arrival = state(base(), LIMIT); exhaust(arrival);
 assert.deepEqual([arrival.world.query(['process-case']).length, arrival.clock.arrived, arrival.clock.arrival, arrival.streams[0]!.k], [0, 0, 0, 0]);
});
