/// <reference path="./process-contracts.d.ts" />
/**
 * Entry of the business-process-bpmn suite. The extension round trips register first; this file then
 * checks foreign BPMN mapping, BPSim, standard export and the pinned example files, and writes one result file.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {catalog, bpmn, runtime} from './process-sdk.cjs';
import {results, test, stepOf, flowOf, define, M, flow} from './test-process-bpmn-helpers.cjs';
import './test-process-bpmn-extensions.cjs';

// ---------------------------------------------------------------- foreign BPMN with simulation semantics
const BP = M + ' xmlns:bpsim="http://www.bpsim.org/schemas/1.0"', S = '<bpmn:startEvent id="S"/>', E = '<bpmn:endEvent id="E"/>';
const fdoc = (body: string, after = '') => `<?xml version="1.0"?><bpmn:definitions ${BP} id="D"><bpmn:process id="P" name="Edge">${body}</bpmn:process>${after}</bpmn:definitions>`;
const chain = (...ids: string[]) => ids.slice(1).map((id, i) => flow(ids[i]! + '-' + id, ids[i]!, id)).join('');
const cx = (t: string) => `<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">${t}</bpmn:conditionExpression>`;
const lane = (id: string, name: string, refs: string[]) => `<bpmn:lane id="${id}" name="${name}">${refs.map(r => `<bpmn:flowNodeRef>${r}</bpmn:flowNodeRef>`).join('')}</bpmn:lane>`;
const sim = (inner: string, id = 'base') => `<bpmn:relationship type="BPSimData"><bpmn:extensionElements><bpsim:BPSimData><bpsim:Scenario id="${id}">${inner}</bpsim:Scenario></bpsim:BPSimData></bpmn:extensionElements><bpmn:source>P</bpmn:source><bpmn:target>P</bpmn:target></bpmn:relationship>`;
const ep = (ref: string, inner: string) => `<bpsim:ElementParameters elementRef="${ref}">${inner}</bpsim:ElementParameters>`;
const param = (group: string, name: string, inner: string) => `<bpsim:${group}><bpsim:${name}>${inner}</bpsim:${name}></bpsim:${group}>`;
const time = (inner: string, name = 'ProcessingTime') => param('TimeParameters', name, inner), prob = (p: number) => param('ControlParameters', 'Probability', `<bpsim:FloatingParameter value="${p}"/>`);
const num = (v: number, unit = '') => `<bpsim:NumericParameter value="${v}"${unit ? ` timeUnit="${unit}"` : ''}/>`;
const stepIn = (d: LWProcess.Definition, id: string) => d.steps.find(s => s.id === id)!, whenIn = (d: LWProcess.Definition, id: string) => d.flows.find(f => f.id === id)?.when;
const timerDef = (text: string) => `<bpmn:timerEventDefinition><bpmn:timeDuration>${text}</bpmn:timeDuration></bpmn:timerEventDefinition>`;

test('BPMN import maps lanes, task types, sub-processes and call activities onto simulatable steps with a full mapping report', () => {
 const sub = `<bpmn:subProcess id="Sub" name="Document check"><bpmn:startEvent id="Ss"/><bpmn:task id="In1" name="Check"/><bpmn:endEvent id="Se"/>${chain('Ss', 'In1', 'Se')}</bpmn:subProcess>`;
 const body = S + `<bpmn:laneSet id="LS">${lane('L1', 'Clerks', ['U1', 'M1', 'Sub'])}${lane('L2', 'Credit engine', ['V1', 'C1'])}</bpmn:laneSet><bpmn:userTask id="U1" name="Review"/><bpmn:manualTask id="M1"/>${sub}<bpmn:serviceTask id="V1"/>` +
  '<bpmn:callActivity id="C1" name="Screening" calledElement="Fraud"/><bpmn:callActivity id="C2" calledElement="Elsewhere"/><bpmn:receiveTask id="R1"/><bpmn:dataObjectReference id="DO"/>' + E + chain('S', 'U1', 'M1', 'Sub', 'V1', 'C1', 'C2', 'R1', 'E');
 const callee = `<bpmn:process id="Fraud" name="Fraud"><bpmn:startEvent id="Fs"/><bpmn:businessRuleTask id="Fr"/><bpmn:endEvent id="Fe"/>${chain('Fs', 'Fr', 'Fe')}</bpmn:process>`;
 const r = bpmn.analyze(fdoc(body, callee), {defaultCapacity: 2, systemCapacity: 6}), d = r.definition!;
 assert(r.ok && d && !r.rejections.length, JSON.stringify([r.rejections, r.diagnostics]));
 assert.deepEqual(d.resources, [{id: 'clerks', name: 'Clerks', capacity: 2, costPerMinute: 0}, {id: 'credit-engine', name: 'Credit engine', capacity: 6, costPerMinute: 0, kind: 'system'}, {id: 'automation', name: 'Automation', capacity: 6, costPerMinute: 1, kind: 'system'}]);
 assert.deepEqual(d.steps.map(s => [s.id, s.kind]), [['s', 'start'], ['u1', 'task'], ['m1', 'task'], ['sub-in1', 'task'], ['v1', 'system'], ['c1-fr', 'system'], ['c2', 'task'], ['r1', 'system'], ['e', 'end']]);
 assert.deepEqual(stepIn(d, 'u1').resources, {clerks: 1}); assert.deepEqual(stepIn(d, 'sub-in1').resources, {clerks: 1}); assert.equal(stepIn(d, 'sub-in1').phase, 'Document check');
 assert.deepEqual(stepIn(d, 'v1').resources, {'credit-engine': 1}); assert.deepEqual(stepIn(d, 'c1-fr').resources, {'credit-engine': 1}); assert.equal(stepIn(d, 'c1-fr').phase, 'Screening');
 assert.deepEqual(stepIn(d, 'r1').resources, {automation: 1}); assert.equal(stepIn(d, 'c2').resources, undefined);
 assert(r.warnings.some(w => /Call activity C2 calls "Elsewhere", which is not in this file; it imports as a placeholder task/.test(w))); assert(r.warnings.some(w => /Ignored 1 dataObjectReference element \(DO\)/.test(w)));
 assert(r.warnings.some(w => /receiveTask R1 waits for its processing time; message arrival is an assumption/.test(w))); assert(r.warnings.some(w => /service-type task\(s\) run as automated system steps.*serviceTask V1 on "Credit engine".*receiveTask R1 on "Automation"/.test(w)));
 const mapped = (id: string) => r.mapping.filter(m => m.id === id);
 for (const id of ['S', 'U1', 'M1', 'Sub', 'In1', 'Ss', 'Se', 'V1', 'C1', 'Fr', 'Fs', 'Fe', 'C2', 'R1', 'DO', 'E', 'L1', 'L2', 'S-U1', 'Ss-In1', 'C1-C2']) assert(mapped(id).length > 0, 'mapping lacks ' + id);
 assert.match(mapped('Sub')[0]!.how, /inlined with 1 step\(s\) \(phase "Document check"\); ids prefixed "sub-"/); assert.equal(mapped('U1').at(-1)!.target, 'step:u1'); assert.equal(mapped('L2')[0]!.target, 'pool:credit-engine'); assert.equal(mapped('DO')[0]!.target, 'none');
 assert.equal(r.info.process!.id, 'P'); assert.deepEqual(r.info.processes.map(p => p.id), ['P', 'Fraud']);
 const run = runtime.create(d, {seed: 3}); assert.equal(run.advance(2000).metrics.completed, 1); run.dispose();
 const flat = bpmn.analyze(fdoc(body, callee), {lanes: 'ignore', autoSystemPool: false}).definition!;
 assert.deepEqual(flat.resources, []); assert.deepEqual(flat.steps.map(s => s.kind), ['start', 'task', 'task', 'task', 'task', 'task', 'task', 'task', 'end']);
 const loop = fdoc(S + '<bpmn:callActivity id="C" calledElement="Q"/>' + E + chain('S', 'C', 'E'), '<bpmn:process id="Q"><bpmn:startEvent id="Qs"/><bpmn:callActivity id="Cq" calledElement="Q"/><bpmn:endEvent id="Qe"/>' + chain('Qs', 'Cq', 'Qe') + '</bpmn:process>');
 assert.throws(() => bpmn.import(loop), /callActivity Cq is not supported: recursive call of process "Q"/); assert.equal(bpmn.analyze(loop).rejections[0]!.id, 'Cq');
 assert.equal(bpmn.analyze(fdoc(body, callee), {process: 'Fraud'}).definition!.steps.length, 3); assert.throws(() => bpmn.import(fdoc(body, callee), {process: 'Nope'}), /Process "Nope" was not found/);
 assert.equal(bpmn.inspect(fdoc(body, callee)).processes[0]!.lanes.join(), 'Clerks,Credit engine');
 const parts = '<bpmn:collaboration id="C"><bpmn:participant id="PA" name="Shop" processRef="P"/><bpmn:participant id="PB" name="Customer"/><bpmn:participant id="PC" name="Courier"/><bpmn:messageFlow id="m1" name="order" sourceRef="PB" targetRef="S"/><bpmn:messageFlow id="m2" name="parcel" sourceRef="E" targetRef="PC"/></bpmn:collaboration>';
 const collab = fdoc(S + E + chain('S', 'E'), '<bpmn:process id="Q" isExecutable="true"><bpmn:startEvent id="Qs"/><bpmn:endEvent id="Qe"/>' + chain('Qs', 'Qe') + '</bpmn:process>').replace('<bpmn:process id="P"', parts + '<bpmn:process id="P"');
 const c = bpmn.analyze(collab, {process: 'PA'});
 assert.deepEqual(c.definition!.sipoc, {suppliers: [{name: 'Customer', supplies: 'order'}], customers: [{name: 'Courier', receives: 'parcel'}]}); assert(c.warnings.some(w => /Message flows are ignored \(2\); counterparties: Customer, Courier/.test(w)));
 assert.equal(bpmn.analyze(collab).info.process!.id, 'Q');
});

test('BPMN import maps inclusive and event-based gateways, expressions, multi-instance, loops and boundary timers', () => {
 const incl = fdoc(S + '<bpmn:inclusiveGateway id="G" default="G-J"/><bpmn:task id="A"/><bpmn:task id="B"/><bpmn:inclusiveGateway id="J"/>' + E + chain('S', 'G') + flow('G-A', 'G', 'A', cx('${a == 1}')) + chain('G', 'J') + flow('G-B', 'G', 'B', cx('${b &gt; 2}')) + chain('A', 'J') + chain('B', 'J') + chain('J', 'E'));
 const ir = bpmn.analyze(incl), id = ir.definition!;
 assert(ir.ok, JSON.stringify([ir.rejections, ir.diagnostics])); assert.equal(stepIn(id, 'g').kind, 'fork'); assert.equal(stepIn(id, 'g').mode, 'inclusive'); assert.equal(stepIn(id, 'g').join, 'j'); assert.equal(stepIn(id, 'j').kind, 'join');
 assert.deepEqual(whenIn(id, 'g-a'), {field: 'a', op: 'eq', value: 1}); assert.equal(whenIn(id, 'g-j'), undefined); assert.deepEqual(whenIn(id, 'g-b'), {field: 'b', op: 'gt', value: 2});
 const nested = fdoc(S + '<bpmn:inclusiveGateway id="G"/><bpmn:exclusiveGateway id="X"/><bpmn:task id="A"/><bpmn:task id="B"/><bpmn:task id="C"/><bpmn:inclusiveGateway id="J"/>' + E + chain('S', 'G') + flow('1', 'G', 'X', cx('${a == 1}')) + flow('2', 'G', 'C') + flow('3', 'X', 'A', cx('${b == 1}')) + flow('4', 'X', 'B') + chain('A', 'J') + chain('B', 'J') + chain('C', 'J') + chain('J', 'E'));
 assert.throws(() => bpmn.import(nested), /Inclusive gateway G is not a clean single-entry, single-exit region.*found exclusiveGateway X inside a branch/); assert.deepEqual(bpmn.analyze(nested).rejections.map(x => x.id), ['G']);
 const race = fdoc(S + '<bpmn:eventBasedGateway id="G"/><bpmn:intermediateCatchEvent id="M"><bpmn:messageEventDefinition/></bpmn:intermediateCatchEvent><bpmn:intermediateCatchEvent id="T">' + timerDef('PT30M') + '</bpmn:intermediateCatchEvent><bpmn:endEvent id="E2"/>' + E + chain('S', 'G', 'M', 'E') + chain('G', 'T', 'E2'));
 const rr = bpmn.analyze(race), rd = rr.definition!;
 assert.equal(stepIn(rd, 'g').kind, 'decision'); assert.deepEqual(whenIn(rd, 'g-m'), {chance: 50}); assert.equal(whenIn(rd, 'g-t'), undefined); assert.equal(stepIn(rd, 't').duration, 30); assert.equal(stepIn(rd, 'm').kind, 'timer');
 assert(rr.warnings.some(w => /Event-based gateway G: race between events simulated by chance \(equal shares\)/.test(w))); assert(rr.warnings.some(w => /message catch event M is simulated as a timer; message arrival is an assumption/.test(w)));
 const exp = (text: string) => fdoc(S + '<bpmn:exclusiveGateway id="G"/><bpmn:endEvent id="E2"/>' + E + chain('S', 'G') + flow('x', 'G', 'E', cx(text)) + flow('y', 'G', 'E2'));
 const when = (text: string) => whenIn(bpmn.import(exp(text)).definition!, 'x');
 assert.deepEqual(when("${a &gt; 1 &amp;&amp; !(b == 'x')}"), {all: [{field: 'a', op: 'gt', value: 1}, {not: {field: 'b', op: 'eq', value: 'x'}}]});
 assert.deepEqual(when('${a == 1 or b != 2 and c}'), {any: [{field: 'a', op: 'eq', value: 1}, {all: [{field: 'b', op: 'ne', value: 2}, {field: 'c', op: 'eq', value: true}]}]});
 assert.deepEqual(when('${1000 &lt;= amount}'), {field: 'amount', op: 'gte', value: 1000}); assert.deepEqual(when('not ok'), {not: {field: 'ok', op: 'eq', value: true}}); assert.deepEqual(when('${a &lt; b || c == null}'), {any: [{field: 'a', op: 'lt', valueField: 'b'}, {field: 'c', op: 'eq', value: null}]});
 for (const [bad, shown] of [['${x.y(1)}', '${x.y(1)}'], ['${a + 1}', '${a + 1}'], ['${a == B_Upper}', '${a == B_Upper}'], ['${a &gt; 1 &amp;&amp; (b == 2}', '${a > 1 && (b == 2}']] as const)
  assert.throws(() => bpmn.import(exp(bad)), (e: Error) => e.message.startsWith('Flow x: unsupported condition "' + shown + '" ('), bad);
 const mi = (inner: string) => fdoc(S + `<bpmn:userTask id="T">${inner}</bpmn:userTask>` + E + chain('S', 'T', 'E'));
 const card = (c: string, seq = '') => `<bpmn:multiInstanceLoopCharacteristics${seq}><bpmn:loopCardinality>${c}</bpmn:loopCardinality><bpmn:completionCondition>\${done}</bpmn:completionCondition></bpmn:multiInstanceLoopCharacteristics>`;
 const m1 = bpmn.analyze(mi(card('7', ' isSequential="true"'))); assert.deepEqual(stepIn(m1.definition!, 't').instances, {count: 7, mode: 'sequential'}); assert(m1.warnings.some(w => /completion condition of multi-instance T is ignored/.test(w)));
 const m2 = bpmn.analyze(mi(card('99'))); assert.deepEqual(stepIn(m2.definition!, 't').instances, {count: 50, mode: 'parallel'}); assert(m2.warnings.some(w => /cardinality 99 is limited to 50/.test(w)));
 const m3 = bpmn.analyze(mi('<bpmn:multiInstanceLoopCharacteristics><bpmn:loopDataInputRef>docs</bpmn:loopDataInputRef></bpmn:multiInstanceLoopCharacteristics>')); assert.deepEqual(stepIn(m3.definition!, 't').instances, {field: 'tItems', mode: 'parallel'});
 assert(m3.warnings.some(w => /iterates a collection.*generated case field "tItems"/.test(w)));
 const lp = bpmn.analyze(mi('<bpmn:standardLoopCharacteristics loopMaximum="4"><bpmn:loopCondition>retry == true</bpmn:loopCondition></bpmn:standardLoopCharacteristics>')), ld = lp.definition!;
 assert(lp.ok, JSON.stringify(lp.diagnostics)); assert.deepEqual(stepIn(ld, 't').add, {tRuns: 1}); assert.equal(stepIn(ld, 't-loop').kind, 'decision'); assert.deepEqual(whenIn(ld, 't-repeat'), {all: [{field: 'retry', op: 'eq', value: true}, {field: 'tRuns', op: 'lt', value: 4}]});
 const lq = bpmn.analyze(mi('<bpmn:standardLoopCharacteristics><bpmn:loopCondition>keep trying</bpmn:loopCondition></bpmn:standardLoopCharacteristics>'));
 assert.deepEqual(whenIn(lq.definition!, 't-repeat'), {all: [{chance: 50}, {field: 'tRuns', op: 'lt', value: 3}]}); assert(lq.warnings.some(w => /loop condition "keep trying" cannot be evaluated.*50% chance/.test(w)));
 const bound = (attrs: string, def: string) => fdoc(S + '<bpmn:task id="T"/><bpmn:task id="H"/><bpmn:endEvent id="E2"/>' + `<bpmn:boundaryEvent id="B" attachedToRef="T"${attrs}>${timerDef(def)}</bpmn:boundaryEvent>` + E + chain('S', 'T', 'E') + chain('B', 'H', 'E2'));
 const b1 = bpmn.analyze(bound('', 'PT1H30M')), b2 = bpmn.analyze(bound(' cancelActivity="false"', 'P1D'));
 assert.deepEqual(stepIn(b1.definition!, 't').deadline, {mode: 'interrupt', flow: 'b-h', after: 90}); assert.equal(b1.definition!.flows.find(f => f.id === 'b-h')!.on, 'deadline'); assert.deepEqual(stepIn(b2.definition!, 't').deadline, {mode: 'escalate', flow: 'b-h', after: 480});
 const secs = bpmn.analyze(bound('', 'PT30S')); assert.equal(stepIn(secs.definition!, 't').deadline!.after, 1); assert(secs.warnings.some(w => /under one minute/.test(w)));
 assert.equal(stepIn(bpmn.analyze(bound('', 'PT1H'), {minutesPerHour: 50}).definition!, 't').deadline!.after, 50); assert.equal(stepIn(bpmn.analyze(bound('', 'P2D'), {minutesPerDay: 400}).definition!, 't').deadline!.after, 800);
 const link = fdoc(S + '<bpmn:intermediateThrowEvent id="M"><bpmn:messageEventDefinition/></bpmn:intermediateThrowEvent><bpmn:intermediateThrowEvent id="L1"><bpmn:linkEventDefinition name="go"/></bpmn:intermediateThrowEvent><bpmn:intermediateCatchEvent id="L2"><bpmn:linkEventDefinition name="go"/></bpmn:intermediateCatchEvent><bpmn:task id="T"/>' + E + chain('S', 'M', 'L1') + chain('L2', 'T', 'E'));
 const lk = bpmn.analyze(link); assert.deepEqual(lk.definition!.steps.map(s => s.id), ['s', 't', 'e']); assert(lk.warnings.some(w => /Throw event M \(message\) is folded into the flow; nothing is thrown/.test(w)));
 const ends = bpmn.analyze(fdoc(S + '<bpmn:exclusiveGateway id="G" default="G-E2"/><bpmn:endEvent id="E1"><bpmn:terminateEventDefinition/></bpmn:endEvent><bpmn:endEvent id="E2"><bpmn:errorEventDefinition/></bpmn:endEvent>' + chain('S', 'G') + flow('G-E1', 'G', 'E1', cx('${x == 1}')) + chain('G', 'E2')));
 assert.equal(stepIn(ends.definition!, 'e2').outcome, 'lost'); assert(ends.warnings.some(w => /Terminate end event E1 is a plain end/.test(w)));
});

test('BPMN import reads BPSim parameters into timing, probabilities, arrivals, capacities and costs', () => {
 const tasks = ['A', 'B', 'V', 'W', 'X', 'Y', 'Z'], fixed = param('CostParameters', 'FixedCost', '<bpsim:FloatingParameter value="12.4"/>');
 const body = S + `<bpmn:laneSet id="LS">${lane('L1', 'Clerks', ['A', 'B', 'W', 'X', 'Y', 'Z'])}${lane('L2', 'Engine', ['V'])}</bpmn:laneSet>` + tasks.map(t => t === 'V' ? '<bpmn:serviceTask id="V"/>' : `<bpmn:userTask id="${t}"/>`).join('') +
  '<bpmn:exclusiveGateway id="G"/><bpmn:endEvent id="E1"/><bpmn:endEvent id="E2"/><bpmn:endEvent id="E3"/>' + chain('S', ...tasks, 'G') + chain('G', 'E1') + chain('G', 'E2') + chain('G', 'E3');
 const params = '<bpsim:ScenarioParameters baseTimeUnit="min" replication="5"><bpsim:Duration><bpsim:DurationParameter value="PT8H"/></bpsim:Duration></bpsim:ScenarioParameters>' +
  ep('S', param('ControlParameters', 'InterTriggerTimer', '<bpsim:NegativeExponentialDistribution mean="20"/>') + param('ControlParameters', 'TriggerCount', num(5)) + '<bpsim:PropertyParameters><bpsim:Property name="Amount"><bpsim:UniformDistribution min="100" max="900"/></bpsim:Property><bpsim:Property name="vip"><bpsim:BooleanParameter value="true"/></bpsim:Property></bpsim:PropertyParameters>') +
  ep('A', time('<bpsim:UniformDistribution min="2" max="10"/>') + fixed) + ep('B', time('<bpsim:TriangularDistribution min="1" mode="4" max="13"/>')) + ep('V', time('<bpsim:NegativeExponentialDistribution mean="3"/>')) +
  ep('W', time('<bpsim:NormalDistribution mean="1" standardDeviation="0.25" timeUnit="hrs"/>')) + ep('X', time('<bpsim:ErlangDistribution k="3" mean="2" timeUnit="days"/>')) + ep('Y', time('<bpsim:PoissonDistribution mean="4"/>')) + ep('Z', time(num(30, 's'))) +
  ep('G-E1', prob(0.5)) + ep('G-E2', prob(0.3)) + ep('G-E3', prob(0.2)) + ep('L1', param('ResourceParameters', 'Quantity', num(3)) + param('CostParameters', 'UnitCost', '<bpsim:FloatingParameter value="2"/>') + '<bpsim:ResourceParameters><bpsim:Selection><bpsim:StringParameter value="any"/></bpsim:Selection></bpsim:ResourceParameters>') +
  ep('L2', param('ResourceParameters', 'Quantity', num(5)) + param('CostParameters', 'UnitCost', '<bpsim:FloatingParameter value="120" timeUnit="hrs"/>')) + ep('Ghost', time(num(1)));
 const r = bpmn.analyze(fdoc(body, sim(params)), {minutesPerDay: 100, defaultDuration: 7}), d = r.definition!;
 assert(r.ok && !r.rejections.length, JSON.stringify([r.rejections, r.diagnostics]));
 assert.deepEqual([stepIn(d, 'a').duration, stepIn(d, 'a').timing, stepIn(d, 'a').cost], [6, {dist: 'uniform', min: 2, max: 10}, 12]); assert.deepEqual([stepIn(d, 'b').duration, stepIn(d, 'b').timing], [6, {dist: 'triangular', min: 1, mode: 4, max: 13}]);
 assert.deepEqual([stepIn(d, 'v').duration, stepIn(d, 'v').timing], [3, {dist: 'exponential', mean: 3}]); assert.deepEqual([stepIn(d, 'w').duration, stepIn(d, 'w').timing], [60, {dist: 'normal', mean: 60, sd: 15}]);
 assert.deepEqual([stepIn(d, 'x').duration, stepIn(d, 'x').timing], [200, {dist: 'erlang', k: 3, mean: 200}]); assert.deepEqual([stepIn(d, 'y').duration, stepIn(d, 'y').timing], [7, undefined]); assert.deepEqual([stepIn(d, 'z').duration, stepIn(d, 'z').timing], [1, undefined]);
 assert.deepEqual(d.resources, [{id: 'clerks', name: 'Clerks', capacity: 3, costPerMinute: 2}, {id: 'engine', name: 'Engine', capacity: 5, costPerMinute: 2, kind: 'system'}]);
 assert.deepEqual(whenIn(d, 'g-e1'), {chance: 50}); assert.deepEqual(whenIn(d, 'g-e2'), {chance: 60}); assert.equal(whenIn(d, 'g-e3'), undefined);
 assert.deepEqual(d.arrivals, [{at: 0, count: 5, interval: 20, gap: {dist: 'exponential', mean: 20}, draws: [{field: 'amount', kind: 'int', min: 100, max: 900}], data: {vip: true}}]); assert.equal(r.info.horizon, 480); assert.equal(r.info.scenario, 'base');
 for (const w of [/BPSim time of "Z" is under one minute/, /BPSim PoissonDistribution for ProcessingTime of "Y" is not supported; the default duration applies/, /BPSim replication 5 is ignored/, /BPSim Selection\/Priority parameters are ignored \(L1\)/, /BPSim parameters for "Ghost" match no element/, /1 task\(s\) had no duration and were given 7 minutes/]) assert(r.warnings.some(w2 => w.test(w2)), String(w));
 const mapped = (type: string) => r.mapping.filter(m => m.type === type);
 assert.equal(mapped('bpsim:ProcessingTime').length, 6); assert.equal(mapped('bpsim:FixedCost')[0]!.target, 'step:a'); assert.equal(mapped('bpsim:Property').length, 2); assert.equal(mapped('bpsim:InterTriggerTimer')[0]!.target, 'arrival:1');
 const odd = bpmn.analyze(fdoc(body, sim(ep('G-E1', prob(0.6)) + ep('G-E2', prob(0.4)) + ep('G-E3', prob(0.2)) + ep('S', param('ControlParameters', 'InterTriggerTimer', num(15))))));
 assert.deepEqual([whenIn(odd.definition!, 'g-e1'), whenIn(odd.definition!, 'g-e2')], [{chance: 50}, {chance: 67}]); assert(odd.warnings.some(w => /BPSim probabilities of gateway G sum to 1.2; they were normalised to 1/.test(w))); assert(odd.warnings.some(w => /rounded to whole percents \(50%, 67% chained/.test(w)));
 assert.deepEqual(odd.definition!.arrivals, [{at: 0, open: true, interval: 15, data: {}}]); assert(odd.warnings.some(w => /defines an open arrival stream/.test(w)));
 const part = bpmn.analyze(fdoc(body, sim(ep('G-E1', prob(0.5)) + ep('G-E2', prob(0.25))))); assert.deepEqual([whenIn(part.definition!, 'g-e1'), whenIn(part.definition!, 'g-e2')], [{chance: 50}, {chance: 50}]);
 const two = fdoc(S + `<bpmn:laneSet id="LS">${lane('L1', 'Clerks', ['A'])}</bpmn:laneSet><bpmn:userTask id="A"/>` + E + chain('S', 'A', 'E'), sim(ep('A', time(num(11))) + ep('L1', param('ResourceParameters', 'Quantity', num(2)))).replace('</bpsim:BPSimData>',
  '<bpsim:Scenario id="second">' + ep('A', time(num(77))) + ep('L1', param('ResourceParameters', 'Quantity', num(9))) + '</bpsim:Scenario></bpsim:BPSimData>'));
 const first2 = bpmn.analyze(two), timed = bpmn.analyze(two, {scenario: 'second'});
 assert.deepEqual([stepIn(first2.definition!, 'a').duration, first2.definition!.resources[0]!.capacity, first2.info.scenario], [11, 2, 'base']); assert(first2.warnings.some(w => /2 BPSim scenarios; the first, "base", is used/.test(w)));
 assert.deepEqual([stepIn(timed.definition!, 'a').duration, timed.definition!.resources[0]!.capacity, timed.info.scenario], [77, 9, 'second']); assert.deepEqual(timed.info.scenarios.map(s => s.id), ['base', 'second']);
 assert.throws(() => bpmn.import(fdoc(body, sim(params)), {scenario: 'nope'}), /BPSim scenario "nope" was not found; the file has "base"/);
 const small = S + '<bpmn:userTask id="A"/>' + E + chain('S', 'A', 'E'), smallSim = sim(ep('A', time(num(77))) + ep('S', param('ControlParameters', 'TriggerCount', num(4))));
 const on = bpmn.analyze(fdoc(small, smallSim)).definition!, off = bpmn.analyze(fdoc(small, smallSim), {bpsim: false}).definition!;
 assert.equal(stepIn(on, 'a').duration, 77); assert.deepEqual(on.arrivals, [{at: 0, count: 4, interval: 0, data: {}}]); assert.equal(stepIn(off, 'a').duration, 5); assert.deepEqual(off.arrivals, [{at: 0, count: 1, interval: 0, data: {}}]);
 // Extension values win over BPSim and the disagreement is reported.
 const own = define([stepOf('start', 'start', 0), stepOf('work', 'task', 1, {duration: 8, cost: 5, timing: {dist: 'uniform', min: 4, max: 12}, resources: {crew: 1}}), stepOf('end', 'end', 2)], [flowOf('start', 'work'), flowOf('work', 'end')]);
 own.resources = [{id: 'crew', name: 'Crew', capacity: 2, costPerMinute: 3}];
 const xml = bpmn.export(own, {bpsim: true}), tampered = bpmn.analyze(xml.replace('<bpsim:UniformDistribution min="4" max="12"/>', '<bpsim:UniformDistribution min="5" max="9"/>').replace('<bpsim:NumericParameter value="2"/>', '<bpsim:NumericParameter value="7"/>').replace('<bpsim:FloatingParameter value="5"/>', '<bpsim:FloatingParameter value="99"/>'));
 assert.equal(catalog.fingerprint(tampered.definition!), catalog.fingerprint(own)); for (const w of [/BPSim time of Activity_work disagrees with the Wildlands duration\/timing; the extension wins/, /BPSim Quantity 7 of resource Resource_crew disagrees with the Wildlands capacity 2/, /BPSim FixedCost of Activity_work disagrees with the Wildlands cost/]) assert(tampered.warnings.some(x => w.test(x)), String(w) + tampered.warnings.join('|'));
});

test('BPMN import rejects or drops unsupported constructs explicitly depending on the unsupported option', () => {
 const errorBoundary = fdoc(S + '<bpmn:task id="T"/><bpmn:task id="H"/><bpmn:endEvent id="E2"/><bpmn:boundaryEvent id="B" attachedToRef="T"><bpmn:errorEventDefinition/></bpmn:boundaryEvent>' + E + chain('S', 'T', 'E') + chain('B', 'H', 'E2'));
 const rejected = bpmn.analyze(errorBoundary);
 assert.equal(rejected.ok, false); assert.equal(rejected.definition, undefined); assert.deepEqual(rejected.rejections, [{id: 'B', type: 'boundaryEvent', message: 'boundaryEvent B is not supported: error boundary events cannot be simulated; only timer boundary events with a timeDuration can.'}]);
 assert.throws(() => bpmn.import(errorBoundary), /boundaryEvent B is not supported: error boundary events/);
 const dropped = bpmn.analyze(errorBoundary, {unsupported: 'drop'});
 assert(dropped.ok && dropped.definition && !dropped.rejections.length, JSON.stringify(dropped.diagnostics)); assert.deepEqual(dropped.definition.steps.map(s => s.id), ['s', 't', 'e']);
 assert(dropped.warnings.some(w => /boundaryEvent B is not supported: error boundary events.* It was dropped\./.test(w))); assert(dropped.warnings.some(w => /Pruned 2 element\(s\) no longer reachable from the start: H, E2/.test(w)));
 assert(dropped.mapping.some(m => m.id === 'H' && m.target === 'none' && /pruned/.test(m.how))); assert(dropped.mapping.some(m => m.id === 'B' && /dropped \(unsupported\)/.test(m.how)));
 const complex = fdoc(S + '<bpmn:complexGateway id="G"/><bpmn:task id="A"/><bpmn:task id="B"/>' + E + chain('S', 'G') + flow('G-A', 'G', 'A', cx('${x &gt; 1}')) + chain('G', 'B') + chain('A', 'E') + chain('B', 'E'));
 assert.deepEqual(bpmn.analyze(complex).rejections.map(x => [x.id, x.type]), [['G', 'complexGateway']]); const approx = bpmn.analyze(complex, {unsupported: 'drop'});
 assert.equal(stepIn(approx.definition!, 'g').kind, 'decision'); assert.deepEqual(whenIn(approx.definition!, 'g-a'), {field: 'x', op: 'gt', value: 1}); assert(approx.warnings.some(w => /Complex gateway G has no simulation semantics; it is approximated as an exclusive gateway/.test(w)));
 const throwing = fdoc(S + '<bpmn:task id="T"/><bpmn:intermediateThrowEvent id="X"><bpmn:compensateEventDefinition/></bpmn:intermediateThrowEvent>' + E + chain('S', 'T', 'X', 'E'));
 assert.match(bpmn.analyze(throwing).rejections[0]!.message, /intermediateThrowEvent X is not supported: compensate throw events cannot be simulated/);
 const bridged = bpmn.analyze(throwing, {unsupported: 'drop'}); assert.deepEqual(bridged.definition!.flows.map(f => [f.from, f.to]), [['s', 't'], ['t', 'e']]); assert(bridged.mapping.some(m => m.id === 'X' && /its flows were bridged/.test(m.how)));
 const transaction = fdoc(S + '<bpmn:transaction id="TX"/>' + E + chain('S', 'TX'));
 assert.match(bpmn.analyze(transaction).rejections[0]!.message, /transaction TX is not supported/); const lost = bpmn.analyze(transaction, {unsupported: 'drop'});
 assert.equal(lost.ok, false); assert.deepEqual(lost.rejections.map(x => x.message), ['After dropping unsupported elements no end event is reachable from the start event.']); assert(lost.warnings.some(w => /transaction TX is not supported.* It was dropped\./.test(w)));
 const bad = (text: string) => fdoc(S + '<bpmn:exclusiveGateway id="G"/><bpmn:endEvent id="E2"/>' + E + chain('S', 'G') + flow('x', 'G', 'E', cx(text)) + flow('y', 'G', 'E2'));
 const noisy = bpmn.analyze(bad('${x.y(1)}')); assert.equal(noisy.rejections.length, 1); assert.deepEqual([noisy.rejections[0]!.id, noisy.rejections[0]!.type], ['x', 'sequenceFlow']);
 const chance = bpmn.analyze(bad('${x.y(1)}'), {unsupported: 'drop'}); assert.deepEqual(whenIn(chance.definition!, 'x'), {chance: 50}); assert(chance.warnings.some(w => /unsupported condition "\$\{x\.y\(1\)\}".*The flow becomes a 50% chance/.test(w)));
 const nonBranching = fdoc(S + '<bpmn:task id="T"/>' + E + chain('S', 'T') + flow('T-E', 'T', 'E', cx('${x == 1}')));
 assert(bpmn.analyze(nonBranching).warnings.some(w => /Condition on flow T-E is ignored; only exclusive and inclusive gateways branch/.test(w)));
 const unreachable = fdoc(S + '<bpmn:task id="A"/><bpmn:inclusiveGateway id="G"/>' + E + chain('S', 'A', 'E'));
 assert.match(bpmn.analyze(unreachable).rejections[0]!.message, /inclusiveGateway G must split \(1 in, 2\+ out\) or join/);
 const unconditioned = fdoc(S + '<bpmn:inclusiveGateway id="G"/><bpmn:task id="A"/><bpmn:task id="B"/><bpmn:inclusiveGateway id="J"/>' + E + chain('S', 'G', 'A', 'J', 'E') + chain('G', 'B', 'J') + flow('G-J', 'G', 'J', cx('${c == 1}')));
 assert.match(bpmn.analyze(unconditioned).rejections.map(x => x.message).join('|'), /Flow G-A leaving inclusive gateway G has no condition and is not the default flow/); assert.match(bpmn.analyze(unconditioned, {unsupported: 'drop'}).warnings.join('|'), /Flow G-A of inclusive gateway G has no condition; it becomes a 50% chance/);
 for (const [options, message] of [[{lanes: 'rows'}, /Option lanes must be pools or ignore/], [{unsupported: 'maybe'}, /Option unsupported must be reject or drop/], [{defaultCapacity: 0}, /Option defaultCapacity must be a whole number from 1 to 1000/], [{minutesPerDay: 2000}, /Option minutesPerDay/], [{bpsim: 'yes'}, /Option bpsim must be true or false/], [{colour: 'red'}, /Unknown import option: colour/]] as const)
  assert.throws(() => bpmn.import(fdoc(S + E + chain('S', 'E')), options as never), message);
 assert.deepEqual(bpmn.options(), bpmn.options({})); assert.deepEqual(bpmn.options({}), {defaultDuration: 5, process: null, lanes: 'pools', defaultCapacity: 1, autoSystemPool: true, systemCapacity: 4, minutesPerDay: 480, minutesPerHour: 60, unsupported: 'reject', bpsim: true, scenario: null});
 assert.throws(() => bpmn.import('<bpmn:definitions ' + M + '/>'), /Import needs at least one process/); assert.deepEqual(bpmn.analyze('<a xmlns="x"/>').rejections.map(x => x.message), ['Expected a BPMN 2.0 definitions document.']);
});

const rich = () => {
 const d = define([stepOf('start', 'start', 0), stepOf('intake', 'task', 1, {duration: 6, timing: {dist: 'normal', mean: 6, sd: 2}, resources: {crew: 1}, instances: {count: 3, mode: 'parallel'}}),
  stepOf('gate', 'fork', 2, {join: 'merge', mode: 'inclusive'}), stepOf('a', 'system', 3, {duration: 4, timing: {dist: 'erlang', k: 2, mean: 4}, resources: {bots: 1}}),
  stepOf('b', 'task', 4, {duration: 5, cost: 7, timing: {dist: 'triangular', min: 2, mode: 4, max: 9}, resources: {crew: 2}}), stepOf('merge', 'join', 5),
  stepOf('review', 'task', 6, {duration: 20, resources: {crew: 1}, deadline: {after: 30, mode: 'escalate', flow: 'late'}}), stepOf('alert', 'task', 7, {duration: 3}), stepOf('breach', 'end', 8),
  stepOf('check', 'task', 9, {duration: 9, resources: {crew: 1}, instances: {field: 'lines', mode: 'sequential'}, deadline: {timing: {dist: 'exponential', mean: 20}, mode: 'interrupt', flow: 'slow'}}), stepOf('rework', 'task', 10, {duration: 2}),
  stepOf('choose', 'decision', 11), stepOf('wait', 'timer', 12, {duration: 10, timing: {dist: 'uniform', min: 5, max: 15}}), stepOf('good', 'end', 13), stepOf('bad', 'end', 14)],
 [flowOf('start', 'intake'), flowOf('intake', 'gate'), {id: 'gate-a', from: 'gate', to: 'a', when: {all: [{field: 'amount', op: 'gt', value: 100}, {not: {field: 'region', op: 'eq', value: 'eu'}}]} as LWProcess.When},
  {id: 'gate-b', from: 'gate', to: 'b', when: {all: [{chance: 30}, {field: 'vip', op: 'eq', value: true}]} as LWProcess.When}, flowOf('gate', 'merge'), flowOf('a', 'merge'), flowOf('b', 'merge'), flowOf('merge', 'review'), flowOf('review', 'check'),
  {id: 'late', from: 'review', to: 'alert', on: 'deadline'}, flowOf('alert', 'breach'), flowOf('check', 'choose'), {id: 'slow', from: 'check', to: 'rework', on: 'deadline'}, flowOf('rework', 'choose'),
  {id: 'choose-bad', from: 'choose', to: 'bad', when: {chance: 25}}, flowOf('choose', 'wait'), flowOf('wait', 'good')], {amount: 150, vip: true, region: 'us', lines: 2});
 d.resources = [{id: 'crew', name: 'Crew', capacity: 3, costPerMinute: 1}, {id: 'bots', name: 'Bots', capacity: 2, costPerMinute: 0, kind: 'system'}];
 d.arrivals = [{at: 0, count: 5, interval: 15, gap: {dist: 'exponential', mean: 15}, data: {amount: 150, vip: true, region: 'us', lines: 2}}, {at: 5, open: true, interval: 30, data: {amount: 50, vip: false, region: 'eu', lines: 1}}];
 return d;
};

test('BPMN export emits standard constructs and optional BPSim and re-imports to the identical definition', () => {
 const d = rich(), checked = catalog.validate(d, true); assert(checked.definition && checked.ok, JSON.stringify(checked.diagnostics));
 const plain = bpmn.export(d), withSim = bpmn.export(d, {bpsim: true});
 assert.doesNotMatch(plain, /bpsim|relationship/); for (const xml of [plain, withSim]) {
  const back = bpmn.analyze(xml);
  assert(back.ok && back.definition && !back.rejections.length, JSON.stringify([back.rejections, back.diagnostics])); assert.deepEqual(back.warnings, []); assert.deepEqual(back.definition, checked.definition); assert.equal(catalog.fingerprint(back.definition), catalog.fingerprint(d));
  assert.equal(bpmn.export(back.definition, {bpsim: xml === withSim}), xml);
 }
 assert.match(plain, /<bpmn:inclusiveGateway id="Gateway_gate" name="gate" default="Flow_gate-merge" gatewayDirection="Diverging">/); assert.match(plain, /<bpmn:inclusiveGateway id="Gateway_merge" name="merge" gatewayDirection="Converging">/); assert.doesNotMatch(plain, /parallelGateway/);
 assert.match(plain, /<bpmn:multiInstanceLoopCharacteristics isSequential="false">\s*<bpmn:loopCardinality xsi:type="bpmn:tFormalExpression">3<\/bpmn:loopCardinality>/); assert.match(plain, /<bpmn:loopCardinality [^>]*>\$\{lines\}<\/bpmn:loopCardinality>/); assert.match(plain, /isSequential="true"/);
 assert.match(plain, /<bpmn:boundaryEvent id="Boundary_review" name="Deadline" attachedToRef="Activity_review" cancelActivity="false">[\s\S]*?<wl:deadline mode="escalate" flow="late" after="30"\/>[\s\S]*?<bpmn:outgoing>Flow_late<\/bpmn:outgoing>[\s\S]*?PT30M/);
 assert.match(plain, /<bpmn:boundaryEvent id="Boundary_check"[^>]*cancelActivity="true">[\s\S]*?<wl:deadline mode="interrupt" flow="slow"\/>\s*<wl:timing dist="exponential" mean="20"\/>[\s\S]*?PT20M/); assert.match(plain, /<bpmn:sequenceFlow id="Flow_late" sourceRef="Boundary_review" targetRef="Activity_alert">/);
 assert.match(plain, /<bpmndi:BPMNShape id="Boundary_review_di" bpmnElement="Boundary_review">/); assert.match(plain, /<wl:timing dist="normal" mean="6" sd="2"\/>/); assert.match(plain, /<wl:timing dist="erlang" mean="4" k="2"\/>/);
 assert.match(plain, /\$\{amount &gt; 100 &amp;&amp; !\(region == 'eu'\)\}<\/bpmn:conditionExpression>/); assert.match(plain, /<wl:when combine="all">\s*<wl:when field="amount" op="gt" type="number" value="100"\/>\s*<wl:when combine="not">\s*<wl:when field="region"/);
 const flowB = plain.slice(plain.indexOf('<bpmn:sequenceFlow id="Flow_gate-b"'), plain.indexOf('</bpmn:sequenceFlow>', plain.indexOf('<bpmn:sequenceFlow id="Flow_gate-b"')));
 assert.doesNotMatch(flowB, /conditionExpression/); assert.match(flowB, /<wl:when combine="all">\s*<wl:when chance="30"\/>/);
 assert.match(plain, /<bpmn:serviceTask id="Activity_a"/); assert.match(plain, /<bpmn:laneSet id="LaneSet_timed">\s*<bpmn:lane id="Lane_crew" name="Crew">[\s\S]*?<bpmn:flowNodeRef>Activity_intake<\/bpmn:flowNodeRef>[\s\S]*?<bpmn:flowNodeRef>Activity_b<\/bpmn:flowNodeRef>/);
 assert.doesNotMatch(plain.slice(plain.indexOf('<bpmn:laneSet'), plain.indexOf('</bpmn:laneSet>')), /Activity_a</); assert.doesNotMatch(plain.slice(plain.indexOf('<bpmn:laneSet'), plain.indexOf('</bpmn:laneSet>')), /Lane_bots/);
 const scenario = withSim.slice(withSim.indexOf('<bpmn:relationship type="BPSimData">'));
 assert.match(withSim, /<bpmn:definitions [^>]*xmlns:bpsim="http:\/\/www\.bpsim\.org\/schemas\/1\.0"/); assert.match(scenario, /<bpsim:ScenarioParameters baseTimeUnit="min"\/>/); assert.match(scenario, /<bpmn:source>Process_timed<\/bpmn:source>/);
 for (const part of ['<bpsim:NormalDistribution mean="6" standardDeviation="2"/>', '<bpsim:ErlangDistribution k="2" mean="4"/>', '<bpsim:TriangularDistribution min="2" mode="4" max="9"/>', '<bpsim:NegativeExponentialDistribution mean="15"/>', '<bpsim:UniformDistribution min="5" max="15"/>',
  '<bpsim:WaitTime><bpsim:UniformDistribution', '<bpsim:TriggerCount><bpsim:NumericParameter value="5"/>', '<bpsim:InterTriggerTimer><bpsim:NegativeExponentialDistribution mean="15"/>', 'elementRef="Resource_crew"', '<bpsim:Quantity><bpsim:NumericParameter value="3"/>',
  '<bpsim:UnitCost><bpsim:FloatingParameter value="1"/>', '<bpsim:FixedCost><bpsim:FloatingParameter value="7"/>', 'elementRef="Flow_choose-bad"', '<bpsim:Probability><bpsim:FloatingParameter value="0.25"/>', '<bpsim:Probability><bpsim:FloatingParameter value="0.75"/>']) assert(scenario.includes(part), part);
 assert.doesNotMatch(scenario, /Flow_gate-b|Flow_gate-a/);
 const small = define([stepOf('start', 'start', 0), stepOf('t', 'task', 1, {duration: 3, resources: {crew: 1}}), stepOf('end', 'end', 2)], [flowOf('start', 't'), flowOf('t', 'end')]);
 small.resources = [{id: 'crew', name: 'Crew', capacity: 2, costPerMinute: 1}]; small.arrivals = [{at: 0, until: 300, interval: 20, data: {}}];
 const until = bpmn.export(small, {bpsim: true}); assert.match(until, /<bpsim:Duration><bpsim:DurationParameter value="PT300M"\/><\/bpsim:Duration>/); assert.match(until, /<bpsim:InterTriggerTimer><bpsim:FloatingParameter value="20"\/>/); assert.equal(catalog.fingerprint(bpmn.import(until).definition!), catalog.fingerprint(small));
 const foreignSide = bpmn.analyze(until.replace(/<bpmn:extensionElements>(?:(?!<\/bpmn:extensionElements>)[\s\S])*?<\/bpmn:extensionElements>/g, m => /bpsim:/.test(m) ? m : '')).definition!;
 assert.deepEqual(foreignSide.arrivals, [{at: 0, until: 300, interval: 20, data: {}}]); assert.deepEqual(foreignSide.resources.map(r => [r.capacity, r.costPerMinute]), [[2, 1]]); assert.deepEqual(foreignSide.steps.map(s => [s.kind, s.duration]), [['start', undefined], ['task', 3], ['end', undefined]]);
});

test('BPMN example files import, validate and simulate deterministically', () => {
 const read = (name: string) => fs.readFileSync(path.join(__dirname, '..', 'examples', 'bpmn', name + '.bpmn'), 'utf8');
 const snapshot = (d: LWProcess.Definition, seed: number, chunks = 1) => { const s = runtime.create(d, {seed}); try { for (let i = 0; i < chunks; i++) s.advance(5000 / chunks); return s.query(); } finally { s.dispose(); } };
 const visits = (snap: LWProcess.Snapshot) => Object.fromEntries(snap.steps.filter(x => x.visits).map(x => [x.id, x.visits]));
 const loan = bpmn.analyze(read('loan-application')), ticket = bpmn.analyze(read('support-ticket'));
 for (const r of [loan, ticket]) { assert(r.ok && r.definition && !r.rejections.length, JSON.stringify([r.rejections, r.diagnostics])); assert(catalog.validate(r.definition).ok); }
 assert.deepEqual([loan.definition!.steps.length, loan.definition!.flows.length, loan.mapping.length, loan.warnings.length], [21, 24, 93, 8]); assert.deepEqual([ticket.definition!.steps.length, ticket.definition!.flows.length, ticket.mapping.length, ticket.warnings.length], [14, 15, 54, 6]);
 assert.equal(catalog.fingerprint(loan.definition!), 'eb23a64e7012e3f6'); assert.equal(catalog.fingerprint(ticket.definition!), '271b0b721b26913e');
 for (const w of [/BPSim time of "Task_Rules" is under one minute/, /BPSim LogNormalDistribution for ProcessingTime of "Task_Notify" is not supported/, /BPSim replication 3 is ignored/, /Merge or pass-through gateway Gw_Merge was folded/, /Probabilities of gateway Gw_Risk were rounded to whole percents \(45%, 55% chained/,
  /6 service-type task\(s\) run as automated system steps.*serviceTask Task_Archive on "Automation".*serviceTask Task_Rules on "Credit engine"/, /1 task\(s\) had no duration and were given 5 minutes/, /Message flows are ignored \(2\); counterparties: Credit bureau/]) assert(loan.warnings.some(x => w.test(x)), String(w));
 for (const w of [/Start event Start_Opened \(message\) imports as a plain start/, /message catch event Catch_Reply is simulated as a timer; message arrival is an assumption/, /Loop Task_Fix: the loop condition "fix failed" cannot be evaluated.*50% chance/, /Event-based gateway Gw_Await: race between events simulated by chance \(BPSim probabilities\)/,
  /receiveTask Task_Wait waits for its processing time/, /4 service-type task\(s\) run as automated system steps/]) assert(ticket.warnings.some(x => w.test(x)), String(w));
 const ld = loan.definition!, td = ticket.definition!;
 assert.deepEqual(ld.resources.map(r => [r.id, r.kind ?? 'people', r.capacity, r.costPerMinute]), [['customer', 'people', 50, 0], ['bank-clerk', 'people', 3, 2], ['credit-engine', 'system', 4, 1], ['automation', 'system', 4, 1]]); assert.deepEqual(stepIn(ld, 'sub-docs-task-verify').instances, {count: 3, mode: 'parallel'});
 assert.deepEqual(stepIn(ld, 'task-review').deadline, {mode: 'escalate', flow: 'f-sla', after: 90}); assert.equal(stepIn(ld, 'gw-extra').mode, 'inclusive'); assert.deepEqual(ld.sipoc, {suppliers: [{name: 'Credit bureau', supplies: 'Credit report'}], customers: [{name: 'Credit bureau', receives: 'Credit report request'}]});
 assert.deepEqual(ld.arrivals, [{at: 0, until: 960, interval: 30, gap: {dist: 'exponential', mean: 30}, draws: [{field: 'amount', kind: 'int', min: 1000, max: 50000}, {field: 'years', kind: 'int', min: 0, max: 10}], data: {}}]);
 assert.deepEqual(stepIn(td, 'task-investigate').deadline, {mode: 'interrupt', flow: 's9', after: 75}); assert.deepEqual(td.arrivals, [{at: 0, count: 20, interval: 45, gap: {dist: 'exponential', mean: 45}, data: {}}]); assert.deepEqual(whenIn(td, 'task-fix-repeat'), {all: [{chance: 50}, {field: 'taskFixRuns', op: 'lt', value: 3}]});
 const a = snapshot(ld, 7), b = snapshot(td, 7);
 assert.deepEqual([a.minute, a.status, a.metrics.arrived, a.metrics.completed, a.metrics.failed, a.metrics.cost, a.metrics.meanCycleMinutes], [984, 'completed', 32, 32, 0, 2414, 50.125]);
 assert.deepEqual(visits(a), {'start-received': 32, 'task-submit': 32, 'sub-docs-task-verify': 32, 'sub-docs-task-archive': 32, 'call-fraud-task-rules': 32, 'call-fraud-task-lists': 32, 'task-score': 32, 'gw-risk': 32, 'gw-extra': 9, 'task-income': 7, 'task-employer': 2, 'gw-extrajoin': 11, 'task-review': 3, 'gw-review': 3, 'task-rejectnotice': 1, 'end-rejected': 1, 'task-notify': 1, 'end-breach': 1, 'task-sign': 31, 'task-disburse': 31, 'end-paid': 31});
 assert.deepEqual(a.steps.find(x => x.id === 'task-review')!.deadlines, {interrupted: 0, escalated: 1}); assert.deepEqual(a.steps.find(x => x.id === 'sub-docs-task-verify')!.items, {started: 96, finished: 96}); assert.deepEqual(a.resources.map(x => [x.id, x.busyMinutes]), [['customer', 656], ['bank-clerk', 923], ['credit-engine', 253], ['automation', 64]]);
 assert.deepEqual([b.minute, b.status, b.metrics.arrived, b.metrics.completed, b.metrics.cost, b.metrics.meanCycleMinutes], [1094, 'completed', 20, 20, 2671, 226.15]);
 assert.deepEqual(visits(b), {'start-opened': 20, 'task-triage': 20, 'task-ask': 20, 'gw-await': 20, 'catch-reply': 13, 'catch-timeout': 7, 'end-closed': 7, 'task-investigate': 13, 'task-handover': 4, 'task-fix': 26, 'task-wait': 13, 'task-notice': 13, 'end-resolved': 13, 'task-fix-loop': 26});
 assert.deepEqual(b.steps.find(x => x.id === 'task-investigate')!.deadlines, {interrupted: 4, escalated: 0});
 assert.deepEqual(snapshot(ld, 7, 100), a); assert.deepEqual(snapshot(td, 7, 100), b); assert.deepEqual(snapshot(ld, 7), a);
 const other = snapshot(ld, 8), otherTicket = snapshot(td, 8);
 assert.deepEqual([other.minute, other.metrics.arrived, other.metrics.completed, other.metrics.cost], [1104, 34, 34, 3301]); assert.deepEqual([otherTicket.minute, otherTicket.metrics.cost, otherTicket.steps.find(x => x.id === 'task-investigate')!.deadlines!.interrupted], [950, 3392, 7]);
 // The extension keeps an imported example lossless; the standard constructs alone import back as well.
 for (const r of [loan, ticket]) for (const withSim of [false, true]) {
  const xml = bpmn.export(r.definition!, {bpsim: withSim}), back = bpmn.analyze(xml);
  assert(back.ok && !back.warnings.length, JSON.stringify([back.warnings, back.rejections])); assert.equal(catalog.fingerprint(back.definition!), catalog.fingerprint(r.definition!));
 }
 const standard = bpmn.analyze(bpmn.export(ld, {bpsim: true}).replace(/<bpmn:extensionElements>(?:(?!<\/bpmn:extensionElements>)[\s\S])*?<\/bpmn:extensionElements>/g, m => /bpsim:/.test(m) ? m : '')).definition!;
 assert.equal(standard.steps.filter(s => s.mode === 'inclusive').length, 1); assert.deepEqual(standard.steps.find(s => s.name === 'Verify document')!.instances, {count: 3, mode: 'parallel'}); assert.deepEqual(standard.steps.find(s => s.name === 'Manual review')!.deadline, {mode: 'escalate', flow: standard.flows.find(f => f.on === 'deadline')!.id, after: 90});
 assert.deepEqual(standard.resources.map(r => [r.name, r.kind ?? 'people', r.capacity]), [['Customer', 'people', 50], ['Bank clerk', 'people', 3], ['Credit engine', 'system', 4], ['Automation', 'system', 4]]);
 const bare = bpmn.analyze(read('loan-application'), {bpsim: false}); assert.deepEqual(bare.rejections.map(x => x.id), ['Gw_Risk', 'Gw_Review']); assert.match(bare.rejections[0]!.message, /several flows without a condition; mark one as the default flow/);
 const equal = bpmn.analyze(read('loan-application'), {bpsim: false, unsupported: 'drop'}); assert(equal.ok, JSON.stringify(equal.rejections)); assert.deepEqual(equal.definition!.arrivals, [{at: 0, count: 1, interval: 0, data: {}}]);
 assert.equal(runtime.create(equal.definition!, {seed: 1}).advance(3000).metrics.completed, 1);
 const cli = path.join(__dirname, 'tools/wildlands-cli.cjs');
 if (fs.existsSync(cli)) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bpmn-cli-'));
  try {
   const call = (args: string[], code: number) => { const p = spawnSync(process.execPath, [cli, 'process', ...args], {cwd: dir, encoding: 'utf8'}); assert.equal(p.status, code, args.join(' ') + p.stderr + p.stdout); return JSON.parse(p.stdout) as Record<string, any>; };
   const input = path.join(__dirname, '..', 'examples', 'bpmn', 'loan-application.bpmn');
   const bad = call(['import-bpmn', '--input', input, '--output', 'x.json', '--lanes', 'rows'], 2); assert.match(bad.errors[0], /Option lanes must be pools or ignore/); assert.equal(fs.existsSync(path.join(dir, 'x.json')), false);
   call(['import-bpmn', '--input', input, '--output', 'x.json', '--scenario', 'a', '--no-bpsim'], 2); call(['import-bpmn', '--input', input, '--output', 'x.json', '--default-capacity', '0'], 2);
   const ok = call(['import-bpmn', '--input', input, '--output', 'loan.json', '--report', 'report.json', '--default-capacity', '2'], 0);
   assert.equal(ok.ok, true); assert.equal(ok.runnable, true); assert.equal(ok.mapping.total, 93); assert.equal(ok.mapping.byType.sequenceFlow, 29); assert.deepEqual(ok.rejections, []); assert.equal(ok.process.id, 'Process_Loan'); assert.equal(ok.scenario, 'Scenario_Base'); assert.equal(ok.horizon, 960);
   assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8')).mapping.length, 93);
   const ran = call(['run', '--input', 'loan.json', '--minutes', '3000', '--output', 'run.json', '--seed', '7'], 0); assert.deepEqual([ran.advancedMinutes, ran.status, ran.metrics.completed, ran.metrics.cost], [984, 'completed', 32, 2414]);
   const rejected = path.join(dir, 'bad.bpmn'); fs.writeFileSync(rejected, fdoc(S + '<bpmn:task id="T"/><bpmn:boundaryEvent id="B" attachedToRef="T"><bpmn:errorEventDefinition/></bpmn:boundaryEvent><bpmn:task id="H"/>' + E + chain('S', 'T', 'E') + chain('B', 'H', 'E')));
   const refused = call(['import-bpmn', '--input', rejected, '--output', 'bad.json'], 2); assert.equal(refused.ok, false); assert.equal(refused.rejections[0].id, 'B'); assert.equal(fs.existsSync(path.join(dir, 'bad.json')), false);
   const dropped = call(['import-bpmn', '--input', rejected, '--output', 'bad.json', '--unsupported', 'drop'], 0); assert(dropped.warnings.some((w: string) => /It was dropped/.test(w)));
   const exported = call(['export-bpmn', '--input', 'loan.json', '--output', 'loan.bpmn', '--bpsim'], 0); assert.equal(exported.bpsim, true); assert.match(fs.readFileSync(path.join(dir, 'loan.bpmn'), 'utf8'), /<bpsim:BPSimData>/);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
 }
});

test('The XML reader stays linear on adversarial namespace and attribute input and refuses characters XML 1.0 forbids', () => {
 const xml = (globalThis as unknown as {LWProcessXml: LWProcessXml.Api}).LWProcessXml, timed = (source: string) => { const t = process.hrtime.bigint(); try { xml.parse(source); } catch { /* malformed on purpose */ } return Number(process.hrtime.bigint() - t) / 1e6; };
 // About 200 KiB each: thousands of inherited prefixes over thousands of elements (a copied scope per element was quadratic), and a 200 KiB attribute run without '=' (a backtracking pattern was quadratic).
 const prefixes = Array.from({length: 4000}, (_, i) => ` xmlns:p${i}="u${i}"`).join(''), scoped = '<r' + prefixes + '>' + '<c/>'.repeat(20000) + '</r>';
 for (const [label, source] of [['inherited namespace scope', scoped], ['attribute name without =', '<a ' + 'b'.repeat(200 * 1024) + '/>'], ['unterminated attribute value', '<a b="' + 'x'.repeat(200 * 1024)], ['many attributes', '<a' + Array.from({length: 12000}, (_, i) => ` a${i}='v'`).join('') + '/>']] as const) {
  assert(source.length > 100 * 1024, label); const ms = timed(source); assert(ms < 2000, label + ' took ' + ms.toFixed(0) + ' ms');
 }
 assert.equal(xml.parse(scoped).children.length, 20000); assert.equal(xml.parse('<a xmlns:p="u"><b xmlns:q="v"><p:c/></b><q:d xmlns:q="w"/></a>').children[1]!.ns, 'w');
 assert.throws(() => xml.parse('<a xmlns:p="u"><b xmlns:q="v"/><q:c/></a>'), /Undeclared namespace prefix: q/); assert.throws(() => xml.parse('<a><constructor:b/></a>'), /Undeclared namespace prefix: constructor/);
 assert.throws(() => xml.parse('<a b c="1"/>'), /Malformed attributes on a\./); assert.throws(() => xml.parse('<a b="1" b="2"/>'), /Duplicate attribute: b/);
 assert.deepEqual(xml.parse('<a b = "1"c=\'2\' />').attrs, {b: '1', c: '2'});
 for (const bad of ['<a>\u0001</a>', '<a b="\u001f"/>', '<a>￿</a>']) assert.throws(() => xml.parse(bad), /contains the character U\+[0-9A-F]{4}, which XML 1\.0 does not allow/);
 for (const bad of ['<a>&#1;</a>', '<a>&#x1F;</a>', '<a b="&#xFFFE;"/>']) assert.throws(() => xml.parse(bad), /Invalid character reference/);
 assert.equal(xml.parse('<a b="&#9;&#10;&#13;">x&#13;y</a>').attrs.b, '\t\n\r'); assert.equal(xml.parse('<a>x&#13;y</a>').text, 'x\ry');
});

test('BPMN export of every agency demo and example is well-formed and re-imports with and without BPSim to the same definition without warnings', () => {
 const xml = (globalThis as unknown as {LWProcessXml: LWProcessXml.Api}).LWProcessXml, dir = path.resolve(__dirname, '../../../docs/concepts/agency-delivery/content');
 const defs: [string, LWProcess.Definition][] = fs.readdirSync(dir).filter(f => f.endsWith('.process.json')).sort().map(f => [f, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as LWProcess.Definition]);
 for (const f of ['loan-application', 'support-ticket']) defs.push([f, bpmn.import(fs.readFileSync(path.join(__dirname, '..', 'examples', 'bpmn', f + '.bpmn'), 'utf8')).definition!]);
 assert(defs.length >= 7, String(defs.length));
 for (const [name, d] of defs) for (const withSim of [false, true]) {
  const out = bpmn.export(d, {bpsim: withSim}), tree = xml.parse(out); assert.equal(tree.local, 'definitions', name);
  const back = bpmn.analyze(out); assert(back.ok, name + JSON.stringify(back.rejections)); assert.deepEqual(back.warnings, [], name + ' bpsim ' + withSim);
  assert.equal(catalog.fingerprint(back.definition!), catalog.fingerprint(d), name);
 }
 // Nested same-kind and one-item combinators compare structurally with their standard expression, so no disagreement is reported.
 const gate = (when: LWProcess.When) => define([stepOf('start', 'start', 0), stepOf('gate', 'decision', 1), stepOf('x', 'end', 2), stepOf('y', 'end', 2)], [flowOf('start', 'gate'), {id: 'c1', from: 'gate', to: 'x', when}, {id: 'fb', from: 'gate', to: 'y'}], {a: 1, b: 2, c: 3});
 for (const when of [{all: [{all: [{field: 'a', op: 'eq', value: 1}, {field: 'b', op: 'eq', value: 2}]}, {field: 'c', op: 'eq', value: 3}]}, {any: [{field: 'a', op: 'eq', value: 1}]}, {not: {any: [{field: 'a', op: 'gt', valueField: 'b'}]}}] as LWProcess.When[]) {
  const back = bpmn.analyze(bpmn.export(gate(when))); assert(back.ok && !back.warnings.length, JSON.stringify([when, back.warnings])); assert.deepEqual(whenIn(back.definition!, 'c1'), when);
 }
 // The BPSim scenario Duration is the span from minute 0, so a stream that starts later still ends at its until minute for BPSim-only readers.
 const later = define([stepOf('start', 'start', 0), stepOf('t', 'task', 1, {duration: 3}), stepOf('end', 'end', 2)], [flowOf('start', 't'), flowOf('t', 'end')]); later.arrivals = [{at: 30, until: 300, interval: 20, data: {}}];
 const sim2 = bpmn.export(later, {bpsim: true}); assert.match(sim2, /<bpsim:Duration><bpsim:DurationParameter value="PT300M"\/><\/bpsim:Duration>/);
 const bpsimOnly = bpmn.analyze(sim2.replace(/<bpmn:extensionElements>(?:(?!<\/bpmn:extensionElements>)[\s\S])*?<\/bpmn:extensionElements>/g, m => /bpsim:/.test(m) ? m : '')).definition!;
 assert.deepEqual(bpsimOnly.arrivals, [{at: 0, until: 300, interval: 20, data: {}}]); assert.equal(bpsimOnly.arrivals[0]!.until, later.arrivals[0]!.until);
});

test('BPSim WaitTime on a timer boundary event replaces its duration and keeps a distribution as the deadline timing', () => {
 const boundary = fdoc(S + '<bpmn:task id="K"/><bpmn:boundaryEvent id="B" attachedToRef="K" cancelActivity="false">' + timerDef('PT5M') + '</bpmn:boundaryEvent><bpmn:endEvent id="E2"/>' + E + chain('S', 'K', 'E') + chain('B', 'E2'), '%');
 const read = (wait: string) => bpmn.analyze(boundary.replace('%', wait ? sim(ep('B', time(wait, 'WaitTime'))) : ''));
 assert.deepEqual(stepIn(read('').definition!, 'k').deadline, {mode: 'escalate', flow: 'b-e2', after: 5});
 const random = read('<bpsim:UniformDistribution min="10" max="50"/>');
 assert.deepEqual(stepIn(random.definition!, 'k').deadline, {mode: 'escalate', flow: 'b-e2', timing: {dist: 'uniform', min: 10, max: 50}});
 assert.deepEqual(random.mapping.filter(m => m.id === 'B').map(m => [m.type, m.how]), [['bpsim:WaitTime', 'uniform distribution -> deadline timing (mean 30 min); replaces the timer duration'], ['boundaryEvent', 'non-interrupting timer boundary -> deadline (escalate) on K']]);
 const constant = read(num(12)); assert.deepEqual(stepIn(constant.definition!, 'k').deadline, {mode: 'escalate', flow: 'b-e2', after: 12}); assert(constant.mapping.some(m => m.id === 'B' && /constant -> deadline after \(mean 12 min\)/.test(m.how)));
});

const report = {suite: 'business-process-bpmn', passed: results.filter(r => r.passed).length, total: results.length, results};
fs.writeFileSync(path.join(__dirname, 'process-bpmn-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`${report.passed}/${report.total} process BPMN checks passed`); for (const r of results) if (!r.passed) console.error(r.name, r.error);
if (report.passed !== report.total) process.exitCode = 1;
