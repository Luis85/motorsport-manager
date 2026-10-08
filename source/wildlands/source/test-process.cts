/// <reference path="./process-contracts.d.ts" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import {catalog, runtime, authoring, bpmn} from './process-sdk.cjs';
require('./process-application.js');
const application = (globalThis as unknown as {LWProcessApplication: LWProcessApp.Api}).LWProcessApplication;
const results: {name: string; passed: boolean; error?: string}[] = [];
function test(name: string, work: () => void): void {try {work(); results.push({name, passed: true});} catch (e) {results.push({name, passed: false, error: String(e)});}}
const base = () => authoring.create('sample', 'Sample');
const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const agency = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../docs/concepts/agency-delivery/content/agency.process.json'), 'utf8')) as LWProcess.Definition;
function guard(d: LWProcess.Definition, operations: LWProcess.Recipe['operations']): LWProcess.Recipe {return {expectedRevision: d.revision, expectedFingerprint: catalog.fingerprint(d), operations};}
const run = (d: LWProcess.Definition, minutes: number) => {const s = runtime.create(d); try {return s.advance(minutes);} finally {s.dispose();}};

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
const M = 'xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"';
const foreign = (body: string, extra = '') => `<?xml version="1.0"?><bpmn:definitions ${M} id="Definitions_1">${extra}<bpmn:process id="Process_Order.1" name="Order handling">${body}</bpmn:process></bpmn:definitions>`;
const flow = (id: string, from: string, to: string, inner = '') => `<bpmn:sequenceFlow id="${id}" sourceRef="${from}" targetRef="${to}">${inner}</bpmn:sequenceFlow>`;
test('BPMN export is well-formed, standards-shaped and imports back losslessly', () => {
 const xml = bpmn.export(agency), again = bpmn.import(xml);
 assert(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')); assert.match(xml, /<bpmn:definitions [^>]*xmlns:bpmn="http:\/\/www\.omg\.org\/spec\/BPMN\/20100524\/MODEL"/);
 for (const tag of ['startEvent', 'endEvent', 'task', 'exclusiveGateway', 'parallelGateway', 'sequenceFlow', 'performer', 'resource', 'BPMNShape', 'BPMNEdge', 'conditionExpression']) assert(xml.includes('<' + (/^BPMN/.test(tag) ? 'bpmndi:' : tag === 'conditionExpression' || tag === 'resource' || tag === 'performer' ? 'bpmn:' : 'bpmn:') + tag), tag);
 assert.deepEqual(again.warnings, []); assert.equal(again.ok, true); assert.deepEqual(again.definition, agency); assert.equal(catalog.fingerprint(again.definition), catalog.fingerprint(agency));
 assert.equal(bpmn.export(again.definition), xml);
 const ids = [...xml.matchAll(/<(?:bpmn|bpmndi):\w+[^>]*?\sid="([^"]+)"/g)].map(m => m[1]); assert.equal(new Set(ids).size, ids.length, 'BPMN ids must be unique');
 const refs = [...xml.matchAll(/(?:sourceRef|targetRef|bpmnElement)="([^"]+)"/g)].map(m => m[1]!); assert(refs.every(r => ids.includes(r)), 'every reference resolves');
 const withAsset = copy(agency); assert(withAsset.steps.some(st => st.scene.asset)); assert.deepEqual(bpmn.import(bpmn.export(withAsset)).definition!.steps.map(st => st.scene.asset), withAsset.steps.map(st => st.scene.asset));
});
test('Foreign BPMN imports with defaults, folded merges, parsed conditions, inferred joins and diagram layout', () => {
 const xml = foreign(`<bpmn:startEvent id="Start_1" name="Request"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
  <bpmn:exclusiveGateway id="Merge_1"/><bpmn:userTask id="Review" name="Review request"><bpmn:performer><bpmn:resourceRef>Res_Clerk</bpmn:resourceRef></bpmn:performer></bpmn:userTask>
  <bpmn:exclusiveGateway id="Valid" name="Valid?" default="F_fix"/><bpmn:serviceTask id="Fix" name="Fix data"/><bpmn:parallelGateway id="Split"/><bpmn:task id="Pack" name="Pack"/><bpmn:task id="Bill" name="Bill"/>
  <bpmn:parallelGateway id="Sync"/><bpmn:endEvent id="Done" name="Done"/><bpmn:laneSet id="Lanes"/>
  ${flow('F1', 'Start_1', 'Merge_1')}${flow('F2', 'Merge_1', 'Review')}${flow('F3', 'Review', 'Valid')}
  ${flow('F_ok', 'Valid', 'Split', '<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">${approved == true}</bpmn:conditionExpression>')}${flow('F_fix', 'Valid', 'Fix')}${flow('F_back', 'Fix', 'Merge_1')}
  ${flow('P1', 'Split', 'Pack')}${flow('P2', 'Split', 'Bill')}${flow('P3', 'Pack', 'Sync')}${flow('P4', 'Bill', 'Sync')}${flow('F9', 'Sync', 'Done')}`,
  '<bpmn:resource id="Res_Clerk" name="Clerk"/>');
 const r = bpmn.import(xml); assert(r.acceptable, JSON.stringify(r.diagnostics)); const d = r.definition!;
 assert.equal(d.id, 'process-order-1'); assert.equal(d.name, 'Order handling'); assert.equal(d.start, 'start-1');
 assert.deepEqual(d.steps.map(s => [s.id, s.kind]), [['start-1', 'start'], ['review', 'task'], ['valid', 'decision'], ['fix', 'task'], ['split', 'fork'], ['pack', 'task'], ['bill', 'task'], ['sync', 'join'], ['done', 'end']]);
 assert.equal(d.steps.find(s => s.id === 'split')!.join, 'sync'); assert.deepEqual(d.steps.find(s => s.id === 'review')!.resources, {'res-clerk': 1}); assert.equal(d.steps.find(s => s.id === 'fix')!.duration, 5);
 assert.deepEqual(d.flows.find(f => f.id === 'f-ok')!.when, {field: 'approved', op: 'eq', value: true}); assert.equal(d.flows.find(f => f.id === 'f-fix')!.when, undefined);
 assert.equal(d.flows.find(f => f.id === 'f-back')!.to, 'review'); assert(!d.steps.some(s => s.id === 'merge-1'));
 assert(r.warnings.some(w => /folded/.test(w))); assert(r.warnings.some(w => /no duration/.test(w))); assert(r.warnings.some(w => /serviceTask/.test(w))); assert(r.warnings.some(w => /arrivals/.test(w)));
 assert.equal(d.arrivals.length, 1); const ok = catalog.validate(d); assert(!ok.diagnostics.length || r.ok === false);
 const shaped = xml.replace('</bpmn:process>', '</bpmn:process><bpmndi:BPMNDiagram id="D"><bpmndi:BPMNPlane id="P" bpmnElement="Process_Order.1">' + ['Start_1', 'Review', 'Valid', 'Fix', 'Split', 'Pack', 'Bill', 'Sync', 'Done'].map((id, i) => `<bpmndi:BPMNShape id="${id}_di" bpmnElement="${id}"><dc:Bounds x="${100 + i * 150}" y="${100 + i % 2 * 100}" width="100" height="80"/></bpmndi:BPMNShape>`).join('') + '</bpmndi:BPMNPlane></bpmndi:BPMNDiagram>');
 const laid = bpmn.import(shaped).definition!; assert.deepEqual(laid.steps.map(s => s.scene.position), [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => [i * 15, i % 2 * 10]));
});
test('BPMN import rejects unsupported behaviour, hostile XML and unreadable conditions explicitly', () => {
 const start = '<bpmn:startEvent id="S"><bpmn:outgoing>A</bpmn:outgoing></bpmn:startEvent><bpmn:endEvent id="E"/>';
 assert.throws(() => bpmn.import(foreign(start + '<bpmn:subProcess id="Sub"/><bpmn:boundaryEvent id="B" attachedToRef="Sub"/>' + flow('A', 'S', 'E'))), /subProcess Sub is not supported[\s\S]*boundaryEvent B/);
 assert.throws(() => bpmn.import(foreign(start + '<bpmn:inclusiveGateway id="I"/>' + flow('A', 'S', 'E'))), /inclusiveGateway I/);
 assert.throws(() => bpmn.import('<!DOCTYPE x [<!ENTITY a "b">]><x/>'), /DOCTYPE/); assert.throws(() => bpmn.import('<bpmn:definitions'), /Unterminated|Undeclared|incomplete/);
 assert.throws(() => bpmn.import(`<a xmlns="x">&bogus;</a>`), /entities|Expected a BPMN/); assert.throws(() => bpmn.import('<a xmlns="x"/>'), /Expected a BPMN 2.0/);
 assert.throws(() => bpmn.import(foreign(start + '<bpmn:exclusiveGateway id="G"/><bpmn:endEvent id="E2"/>' + flow('A', 'S', 'G') + flow('B', 'G', 'E', '<bpmn:conditionExpression>x.y(1)</bpmn:conditionExpression>') + flow('C', 'G', 'E2'))), /unsupported condition/);
 assert.throws(() => bpmn.import(foreign('<bpmn:startEvent id="S"/><bpmn:startEvent id="S2"/>')), /start/);
 assert.throws(() => bpmn.import(foreign(start + '<bpmn:task id="T"/>' + flow('A', 'S', 'T') + flow('B', 'T', 'E') + flow('C', 'T', 'E'))), /outgoing flows/);
 assert.throws(() => bpmn.import(foreign('') + foreign('')), /Multiple root|Text outside/);
 assert.throws(() => bpmn.import('<bpmn:definitions ' + M + '>' + '<bpmn:process id="A"/><bpmn:process id="B"/></bpmn:definitions>'), /exactly one process/);
 const draft = bpmn.import(foreign('<bpmn:startEvent id="S"><bpmn:outgoing>A</bpmn:outgoing></bpmn:startEvent><bpmn:task id="T"/>' + flow('A', 'S', 'T'))); assert.equal(draft.ok, false); assert(draft.acceptable);
});
test('Malformed, unknown and unsafe JSON values never pass admission', () => {
 for (const value of [null, [], {...base(), surprise: true}, {...base(), revision: NaN}, {...base(), format: 'bpmn'}]) assert.equal(catalog.validate(value).ok, false);
 const d = base(); Object.defineProperty(d, 'name', {get() {throw Error('getter executed');}, enumerable: true});
 assert(!catalog.validate(d).diagnostics.some(e => e.message.includes('getter executed')));
 const unsafe = JSON.parse(JSON.stringify(base()).replace('"data":{}', '"data":{"__proto__":true}'));
 assert.equal(catalog.validate(unsafe).ok, false);
});
test('Dangling links, duplicate IDs and scene identities are rejected', () => {
 for (const mutate of [(d: LWProcess.Definition) => {d.flows[0]!.to = 'missing';}, (d: LWProcess.Definition) => {d.steps[1]!.id = 'start';}, (d: LWProcess.Definition) => {d.steps[1]!.scene.id = d.steps[0]!.scene.id;}]) {
  const d = base(); mutate(d); assert.equal(catalog.validate(d).ok, false);
 }
});
test('Unreachable work and paths with no end are rejected', () => {
 const d = base(); d.steps.push({...copy(d.steps[1]!), id: 'orphan', scene: {...d.steps[1]!.scene, id: 'scene-orphan'}}); d.flows.push({id: 'orphan-end', from: 'orphan', to: 'end'});
 assert.equal(catalog.validate(d).ok, false); d.flows[1]!.to = 'work'; assert(catalog.validate(d).diagnostics.some(e => e.message.includes('route to an end')));
});
test('Impossible resources and invalid task fields are rejected before execution', () => {
 const d = base(); d.steps[1]!.resources = {missing: 1}; assert.equal(catalog.validate(d).ok, false);
 delete d.steps[1]!.resources; d.steps[0]!.duration = 1; assert.equal(catalog.validate(d).ok, false);
});
test('Parallel region rejects branch overlap, nested controls and conflicting writes', () => {
 for (const mutate of [(d: LWProcess.Definition) => {d.steps.find(s => s.id === 'architecture')!.set = {requirementsReady: true};},
  (d: LWProcess.Definition) => {d.flows.find(f => f.id === 'design-split-architecture')!.to = 'product-design';},
  (d: LWProcess.Definition) => {const s = d.steps.find(s => s.id === 'product-design')!; s.kind = 'decision'; delete s.duration; delete s.resources; delete s.set;}]) {
  const d = copy(agency); mutate(d); assert.equal(catalog.validate(d).ok, false);
 }
});
test('Scene Forge exports are admitted as world assets and executable asset fields reject', () => {
 assert(agency.steps.every(s => s.scene.asset)); assert.equal(catalog.validate(agency).ok, true);
 const d = copy(agency); (d.steps[0]!.scene.asset as Record<string, unknown>).script = 'alert(1)'; assert.equal(catalog.validate(d).ok, false);
});
test('Fingerprint ignores object key order and tracks complete definition changes', () => {
 const d = base(); const reordered = Object.fromEntries(Object.entries(d).reverse()); assert.equal(catalog.fingerprint(d), catalog.fingerprint(reordered));
 d.steps[1]!.duration!++; assert.notEqual(catalog.fingerprint(d), catalog.fingerprint(base()));
});
test('Guarded edits validate atomically and stale guards preserve input', () => {
 const d = base(), before = copy(d); const result = authoring.edit(d, guard(d, [{op: 'rename', value: 'Edited'}]));
 assert.equal(result.definition.revision, 1); assert.equal(result.definition.name, 'Edited'); assert.deepEqual(d, before);
 assert.throws(() => authoring.edit(result.definition, guard(d, [{op: 'rename', value: 'Stale'}])));
 assert.throws(() => authoring.edit(d, guard(d, [{op: 'rename', value: 'Would change'}, {op: 'removeStep', id: 'work'}]))); assert.deepEqual(d, before);
});
test('Incremental drafts retain explicit diagnostics and become runnable when connected', () => {
 const d = base(), added = {...copy(d.steps[1]!), id: 'extra', scene: {...d.steps[1]!.scene, id: 'scene-extra'}};
 const draft = authoring.edit(d, guard(d, [{op: 'putStep', value: added}]), true);
 assert(draft.diagnostics.length); assert.throws(() => runtime.create(draft.definition));
 const complete = authoring.edit(draft.definition, guard(draft.definition, [{op: 'putFlow', value: {id: 'work-end', from: 'work', to: 'extra'}}, {op: 'putFlow', value: {id: 'extra-end', from: 'extra', to: 'end'}}]));
 assert.equal(run(complete.definition, 20).minute, 10);
});
test('Scene and renderer navigation leaves the authoritative run untouched', () => {
 const app = application.create(agency); app.advance(30); const q = app.query().snapshot;
 app.select('product-design'); app.mode('2d'); app.select('qa'); app.mode('3d'); assert.deepEqual(app.query().snapshot, q);
 app.dispose();
});
test('Rejected imports preserve session and definition; valid import starts paused', () => {
 const app = application.create(agency); app.advance(30); const previous = app.query();
 assert.throws(() => app.replace({})); assert.deepEqual(app.query(), previous);
 app.replace(base()); assert.equal(app.query().snapshot.minute, 0); assert.equal(app.query().playing, false); app.dispose();
});
test('Definition JSON Schema and runtime agree on structural fixtures', () => {
 const Ajv = require('ajv'); const ajv = new Ajv({strict: false, allowUnionTypes: true}); const validate = ajv.compile(catalog.schema);
 for (const d of [base(), agency]) assert(validate(d), JSON.stringify(validate.errors));
 for (const field of ['name', 'revision', 'steps', 'flows', 'resources']) {const d = base() as unknown as Record<string, unknown>; delete d[field]; assert(!validate(d)); assert(!catalog.validate(d).ok);}
});
test('CLI agent workflow supports create, dry-run, guarded edit, inspect and bounded run', () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'process-tools-'));
 try {
  const cli = path.join(__dirname, 'tools/wildlands-cli.cjs');
  const call = (args: string[], code = 0) => {const p = spawnSync(process.execPath, [cli, 'process', ...args], {cwd: dir, encoding: 'utf8'}); assert.equal(p.status, code, p.stderr + p.stdout); return JSON.parse(p.stdout) as Record<string, any>;};
  const created = call(['create', '--id', 'sample', '--output', 'a.json']); const d = JSON.parse(fs.readFileSync(path.join(dir, 'a.json'), 'utf8')) as LWProcess.Definition;
  assert.equal(call(['inspect', '--input', 'a.json']).fingerprint, created.fingerprint);
  fs.writeFileSync(path.join(dir, 'recipe.json'), JSON.stringify(guard(d, [{op: 'rename', value: 'Agent workflow'}])));
  const dry = call(['edit', '--input', 'a.json', '--recipe', 'recipe.json', '--dry-run']); assert(dry.dryRun); assert.equal(fs.readdirSync(dir).length, 2);
  call(['edit', '--input', 'a.json', '--recipe', 'recipe.json', '--output', 'b.json']);
  const report = call(['run', '--input', 'b.json', '--minutes', '20', '--output', 'report.json']); assert.equal(report.advancedMinutes, 5);
  call(['run', '--input', 'b.json', '--minutes', '20', '--output', 'b.json'], 2);
  fs.linkSync(path.join(dir, 'b.json'), path.join(dir, 'alias.json')); call(['run', '--input', 'b.json', '--minutes', '20', '--output', 'alias.json'], 2);
  assert(call(['schema', '--kind', 'recipe']).schema); assert.equal(call(['discover']).operations.length, 12);
  call(['export-bpmn', '--input', 'b.json', '--output', 'b.bpmn']); call(['export-bpmn', '--input', 'b.json', '--output', 'b.txt'], 2); call(['export-bpmn', '--input', 'b.json', '--output', 'b.bpmn'], 0);
  const imported = call(['import-bpmn', '--input', 'b.bpmn', '--output', 'c.json']); assert.equal(imported.runnable, true); assert.deepEqual(imported.warnings, []);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'c.json'), 'utf8')), JSON.parse(fs.readFileSync(path.join(dir, 'b.json'), 'utf8')));
  fs.writeFileSync(path.join(dir, 'bad.bpmn'), '<?xml version="1.0"?><!DOCTYPE x><x/>'); call(['import-bpmn', '--input', 'bad.bpmn', '--output', 'd.json'], 2); assert(!fs.existsSync(path.join(dir, 'd.json')));
  call(['import-bpmn', '--input', 'b.bpmn', '--output', 'b.bpmn'], 2);
 } finally {fs.rmSync(dir, {recursive: true, force: true});}
});
test('Scene Forge attachment requires exact edit guards and retains compiled geometry', () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'process-attach-'));
 try {
  const d = base(); fs.writeFileSync(path.join(dir, 'process.json'), JSON.stringify(d));
  fs.writeFileSync(path.join(dir, 'asset.json'), JSON.stringify({visual: agency.steps[1]!.scene.asset}));
  const args = ['process', 'attach', '--input', 'process.json', '--asset', 'asset.json', '--step', 'work', '--expected-revision', '0', '--expected-fingerprint', catalog.fingerprint(d), '--output', 'new.json'];
  const p = spawnSync(process.execPath, [path.join(__dirname, 'tools/wildlands-cli.cjs'), ...args], {cwd: dir, encoding: 'utf8'}); assert.equal(p.status, 0, p.stdout);
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'new.json'), 'utf8')) as LWProcess.Definition; assert.deepEqual(saved.steps[1]!.scene.asset, agency.steps[1]!.scene.asset);
 } finally {fs.rmSync(dir, {recursive: true, force: true});}
});
test('CLI rejects bad arguments before work, forges once, builds html and guards outputs', () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'process-cli-'));
 try {
  const cli = path.join(__dirname, 'tools/wildlands-cli.cjs');
  const call = (args: string[], code = 0) => {const p = spawnSync(process.execPath, [cli, 'process', ...args], {cwd: dir, encoding: 'utf8'}); assert.equal(p.status, code, args.join(' ') + p.stderr + p.stdout); return JSON.parse(p.stdout) as Record<string, any>;};
  const list = () => fs.readdirSync(dir).sort().join();
  const d = base(); fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify(d));
  fs.writeFileSync(path.join(dir, 'recipe.json'), JSON.stringify(guard(d, [{op: 'rename', value: 'X'}])));
  const before = list(), guards = ['--expected-fingerprint', catalog.fingerprint(d)], attach = ['attach', '--input', 'a.json', '--asset', 'a.json', '--step', 'work', ...guards];
  const bad: string[][] = [['bogus'], ['create', '--id', 'x', '--bogus', '1', '--output', 'x.json'], ['create', '--id', 'x', '--id', 'y', '--output', 'x.json'], ['create', '--id'],
   ['create', '--output', 'x.json'], ['edit', '--input', 'a.json', '--recipe', 'recipe.json', '--dry-run', '--output', 'x.json'], ['edit', '--input', 'a.json', '--recipe', 'recipe.json'],
   ['build', '--input', 'a.json', '--output', 'x.txt'], ['run', '--input', 'a.json', '--minutes', 'ten', '--output', 'x.json'], ['run', '--input', 'a.json', '--minutes', '-1', '--output', 'x.json'],
   [...attach, '--expected-revision', 'one', '--output', 'x.json'], [...attach, '--expected-revision', '0'], [...attach, '--expected-revision', '0', '--dry-run', '--output', 'x.json'],
   ['schema', '--kind', 'other'], ['forge', '--input', 'a.json', '--output', 'missing/parent']];
  for (const args of bad) {const r = call(args, 2); assert.equal(r.ok, false); assert.equal(r.code, 'process-operation-failed'); assert(r.errors.length);}
  assert.equal(list(), before, 'rejected invocations write nothing');
  for (const flag of ['--help', '-h']) assert.deepEqual(call([flag]).operations, call(['discover']).operations);
  assert.deepEqual(call(['discover']).editOperations, ((call(['schema', '--kind', 'recipe']).schema.properties.operations.items.oneOf as {properties: {op: {const: string}}}[]).map(o => o.properties.op.const)));
  call(['forge', '--input', 'a.json', '--output', 'forged']); assert(JSON.parse(fs.readFileSync(path.join(dir, 'forged/forge.project.json'), 'utf8')).scenes);
  assert(fs.readFileSync(path.join(dir, 'forged/README.md'), 'utf8').includes(JSON.stringify(path.join(dir, 'forged'))));
  call(['forge', '--input', 'a.json', '--output', 'forged'], 2);
  assert.equal(call(['build', '--input', 'a.json', '--output', 'p.html']).ok, true); assert(fs.readFileSync(path.join(dir, 'p.html'), 'utf8').startsWith('<!'));
  fs.writeFileSync(path.join(dir, 'bad.json'), '{}'); const invalid = call(['validate', '--input', 'bad.json'], 1); assert.equal(invalid.ok, false); assert.equal(invalid.code, undefined);
  fs.symlinkSync('a.json', path.join(dir, 'link.json')); call(['run', '--input', 'a.json', '--minutes', '5', '--output', 'link.json'], 2);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'a.json'), 'utf8')), d);
 } finally {fs.rmSync(dir, {recursive: true, force: true});}
});
test('Diagnostics use step-index pointers, strict ok, draft acceptability and the arrival horizon', () => {
 const dup = base(); dup.steps[1]!.scene.id = dup.steps[0]!.scene.id;
 assert(catalog.validate(dup).diagnostics.some(e => e.path === '/steps/1/scene/id'));
 const orphan = base(); orphan.steps.push({...copy(orphan.steps[1]!), id: 'orphan', scene: {...orphan.steps[1]!.scene, id: 'scene-orphan'}});
 const draft = catalog.validate(orphan, true); assert.equal(draft.ok, false); assert.equal(draft.acceptable, true);
 assert(draft.diagnostics.every(e => /^\/(steps|flows|arrivals|start)(\/\d+)?/.test(e.path)) && draft.diagnostics.some(e => e.path === '/steps/3'));
 assert.equal(catalog.validate(orphan).acceptable, false); assert.equal(catalog.validate(null, true).acceptable, false);
 const late = base(); late.arrivals[0]!.at = runtime.limits.minutes; assert.equal(catalog.validate(late).ok, false);
 late.arrivals[0]!.at = runtime.limits.minutes - 1; assert.equal(catalog.validate(late).ok, true); assert.equal(runtime.limits.receipts, 128);
 for (const op of [{}, {op: 5}, {op: null, value: 1}]) { const d = base(); assert.throws(() => authoring.edit(d, guard(d, [op as never])), /Invalid operation 0/); }
});
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
/** Builds a small admitted process from step overrides and flows; every step gets a scene on a line. */
const stepOf = (id: string, kind: LWProcess.Kind, extra: Partial<LWProcess.Step> = {}, at = 0): LWProcess.Step => ({id, name: id, kind, scene: {id: 'scene-' + id, position: [at, 0], color: '#ffbb73'}, ...extra});
const flowOf = (from: string, to: string, when?: LWProcess.Condition): LWProcess.Flow => ({id: from + '-' + to, from, to, ...when ? {when} : {}});
const build = (steps: LWProcess.Step[], flows: LWProcess.Flow[], arrivals: LWProcess.Arrival[] = [{at: 0, count: 1, interval: 0, data: {}}], resources: LWProcess.Resource[] = []) =>
 ({format: 'wildlands-process', schemaVersion: 1, revision: 0, id: 'timed', name: 'Timed', start: 'start', resources, steps: steps.map((s, i) => ({...s, scene: {...s.scene, position: [i * 12, 0] as [number, number]}})), flows, arrivals}) as LWProcess.Definition;
const startEnd = (...middle: LWProcess.Step[]) => [stepOf('start', 'start'), ...middle, stepOf('end', 'end')];
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
 assert.match(bad(d => { arrival(d).gap = {dist: 'normal' as never, mean: 3}; }), /Expected one of uniform, triangular, exponential/);
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
const report = {suite: 'business-process', passed: results.filter(r => r.passed).length, total: results.length, results};
fs.writeFileSync(path.join(__dirname, 'process-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`${report.passed}/${report.total} process checks passed`); for (const r of results) if (!r.passed) console.error(r.name, r.error);
if (report.passed !== report.total) process.exitCode = 1;
