/// <reference path="./process-contracts.d.ts" />
/**
 * Foreign BPMN import checks (part of the business-process-bpmn suite, entry test-process-bpmn.cts; they register after the
 * extension and conformance checks and before the export checks): lanes, task types, sub-processes and call activities;
 * gateways, condition expressions, multi-instance, loops and boundary timers; BPSim parameters; and the explicit rejection or
 * dropping of unsupported constructs under the `unsupported` option.
 */
import assert from 'node:assert/strict';
import {catalog, bpmn, runtime} from './process-sdk.cjs';
import {test, stepOf, flowOf, define, M, flow} from './test-process-bpmn-helpers.cjs';
import {S, E, fdoc, chain, cx, lane, sim, ep, param, time, prob, num, stepIn, whenIn, timerDef} from './test-process-bpmn-helpers.cjs';

test('BPMN import maps lanes, task types, sub-processes and call activities onto simulatable steps with a full mapping report', () => {
 const sub = '<bpmn:subProcess id="Sub" name="Document check">'
  + `<bpmn:startEvent id="Ss"/><bpmn:task id="In1" name="Check"/><bpmn:endEvent id="Se"/>${chain('Ss', 'In1', 'Se')}`
  + '</bpmn:subProcess>';
 const body = S
  + `<bpmn:laneSet id="LS">${lane('L1', 'Clerks', ['U1', 'M1', 'Sub'])}${lane('L2', 'Credit engine', ['V1', 'C1'])}</bpmn:laneSet>`
  + `<bpmn:userTask id="U1" name="Review"/><bpmn:manualTask id="M1"/>${sub}<bpmn:serviceTask id="V1"/>`
  + '<bpmn:callActivity id="C1" name="Screening" calledElement="Fraud"/><bpmn:callActivity id="C2" calledElement="Elsewhere"/>'
  + '<bpmn:receiveTask id="R1"/><bpmn:dataObjectReference id="DO"/>'
  + E + chain('S', 'U1', 'M1', 'Sub', 'V1', 'C1', 'C2', 'R1', 'E');
 const callee = '<bpmn:process id="Fraud" name="Fraud">'
  + `<bpmn:startEvent id="Fs"/><bpmn:businessRuleTask id="Fr"/><bpmn:endEvent id="Fe"/>${chain('Fs', 'Fr', 'Fe')}`
  + '</bpmn:process>';
 const r = bpmn.analyze(fdoc(body, callee), {defaultCapacity: 2, systemCapacity: 6}), d = r.definition!;
 assert(r.ok && d && !r.rejections.length, JSON.stringify([r.rejections, r.diagnostics]));
 assert.deepEqual(d.resources, [
  {id: 'clerks', name: 'Clerks', capacity: 2, costPerMinute: 0},
  {id: 'credit-engine', name: 'Credit engine', capacity: 6, costPerMinute: 0, kind: 'system'},
  {id: 'automation', name: 'Automation', capacity: 6, costPerMinute: 1, kind: 'system'},
 ]);
 assert.deepEqual(d.steps.map(s => [s.id, s.kind]), [
  ['s', 'start'], ['u1', 'task'], ['m1', 'task'], ['sub-in1', 'task'], ['v1', 'system'], ['c1-fr', 'system'], ['c2', 'task'],
  ['r1', 'system'], ['e', 'end'],
 ]);
 assert.deepEqual(stepIn(d, 'u1').resources, {clerks: 1});
 assert.deepEqual(stepIn(d, 'sub-in1').resources, {clerks: 1});
 assert.equal(stepIn(d, 'sub-in1').phase, 'Document check');
 assert.deepEqual(stepIn(d, 'v1').resources, {'credit-engine': 1});
 assert.deepEqual(stepIn(d, 'c1-fr').resources, {'credit-engine': 1});
 assert.equal(stepIn(d, 'c1-fr').phase, 'Screening');
 assert.deepEqual(stepIn(d, 'r1').resources, {automation: 1});
 assert.equal(stepIn(d, 'c2').resources, undefined);
 assert(r.warnings.some(w => /Call activity C2 calls "Elsewhere", which is not in this file; it imports as a placeholder task/.test(w)));
 assert(r.warnings.some(w => /Ignored 1 dataObjectReference element \(DO\)/.test(w)));
 assert(r.warnings.some(w => /receiveTask R1 waits for its processing time; message arrival is an assumption/.test(w)));
 assert(r.warnings.some(w =>
  /service-type task\(s\) run as automated system steps.*serviceTask V1 on "Credit engine".*receiveTask R1 on "Automation"/.test(w)));
 const mapped = (id: string) => r.mapping.filter(m => m.id === id);
 for (const id of ['S', 'U1', 'M1', 'Sub', 'In1', 'Ss', 'Se', 'V1', 'C1', 'Fr', 'Fs', 'Fe', 'C2', 'R1', 'DO', 'E', 'L1', 'L2', 'S-U1', 'Ss-In1', 'C1-C2'])
  assert(mapped(id).length > 0, 'mapping lacks ' + id);
 assert.match(mapped('Sub')[0]!.how, /inlined with 1 step\(s\) \(phase "Document check"\); ids prefixed "sub-"/);
 assert.equal(mapped('U1').at(-1)!.target, 'step:u1');
 assert.equal(mapped('L2')[0]!.target, 'pool:credit-engine');
 assert.equal(mapped('DO')[0]!.target, 'none');
 assert.equal(r.info.process!.id, 'P');
 assert.deepEqual(r.info.processes.map(p => p.id), ['P', 'Fraud']);
 const run = runtime.create(d, {seed: 3});
 assert.equal(run.advance(2000).metrics.completed, 1);
 run.dispose();
 const flat = bpmn.analyze(fdoc(body, callee), {lanes: 'ignore', autoSystemPool: false}).definition!;
 assert.deepEqual(flat.resources, []);
 assert.deepEqual(flat.steps.map(s => s.kind), ['start', 'task', 'task', 'task', 'task', 'task', 'task', 'task', 'end']);
 const loop = fdoc(
  S + '<bpmn:callActivity id="C" calledElement="Q"/>' + E + chain('S', 'C', 'E'),
  '<bpmn:process id="Q"><bpmn:startEvent id="Qs"/><bpmn:callActivity id="Cq" calledElement="Q"/><bpmn:endEvent id="Qe"/>'
   + chain('Qs', 'Cq', 'Qe') + '</bpmn:process>');
 assert.throws(() => bpmn.import(loop), /callActivity Cq is not supported: recursive call of process "Q"/);
 assert.equal(bpmn.analyze(loop).rejections[0]!.id, 'Cq');
 assert.equal(bpmn.analyze(fdoc(body, callee), {process: 'Fraud'}).definition!.steps.length, 3);
 assert.throws(() => bpmn.import(fdoc(body, callee), {process: 'Nope'}), /Process "Nope" was not found/);
 assert.equal(bpmn.inspect(fdoc(body, callee)).processes[0]!.lanes.join(), 'Clerks,Credit engine');
 const parts = '<bpmn:collaboration id="C"><bpmn:participant id="PA" name="Shop" processRef="P"/>'
  + '<bpmn:participant id="PB" name="Customer"/><bpmn:participant id="PC" name="Courier"/>'
  + '<bpmn:messageFlow id="m1" name="order" sourceRef="PB" targetRef="S"/>'
  + '<bpmn:messageFlow id="m2" name="parcel" sourceRef="E" targetRef="PC"/></bpmn:collaboration>';
 const collab = fdoc(
  S + E + chain('S', 'E'),
  '<bpmn:process id="Q" isExecutable="true"><bpmn:startEvent id="Qs"/><bpmn:endEvent id="Qe"/>' + chain('Qs', 'Qe') + '</bpmn:process>',
 ).replace('<bpmn:process id="P"', parts + '<bpmn:process id="P"');
 const c = bpmn.analyze(collab, {process: 'PA'});
 assert.deepEqual(c.definition!.sipoc, {
  suppliers: [{name: 'Customer', supplies: 'order'}],
  customers: [{name: 'Courier', receives: 'parcel'}],
 });
 assert(c.warnings.some(w => /Message flows are ignored \(2\); counterparties: Customer, Courier/.test(w)));
 assert.equal(bpmn.analyze(collab).info.process!.id, 'Q');
});

test('BPMN import maps inclusive and event-based gateways, expressions, multi-instance, loops and boundary timers', () => {
 const incl = fdoc(
  S + '<bpmn:inclusiveGateway id="G" default="G-J"/><bpmn:task id="A"/><bpmn:task id="B"/><bpmn:inclusiveGateway id="J"/>' + E
  + chain('S', 'G') + flow('G-A', 'G', 'A', cx('${a == 1}')) + chain('G', 'J') + flow('G-B', 'G', 'B', cx('${b &gt; 2}'))
  + chain('A', 'J') + chain('B', 'J') + chain('J', 'E'));
 const ir = bpmn.analyze(incl), id = ir.definition!;
 assert(ir.ok, JSON.stringify([ir.rejections, ir.diagnostics]));
 assert.equal(stepIn(id, 'g').kind, 'fork');
 assert.equal(stepIn(id, 'g').mode, 'inclusive');
 assert.equal(stepIn(id, 'g').join, 'j');
 assert.equal(stepIn(id, 'j').kind, 'join');
 assert.deepEqual(whenIn(id, 'g-a'), {field: 'a', op: 'eq', value: 1});
 assert.equal(whenIn(id, 'g-j'), undefined);
 assert.deepEqual(whenIn(id, 'g-b'), {field: 'b', op: 'gt', value: 2});
 const nested = fdoc(
  S + '<bpmn:inclusiveGateway id="G"/><bpmn:exclusiveGateway id="X"/><bpmn:task id="A"/><bpmn:task id="B"/><bpmn:task id="C"/>'
  + '<bpmn:inclusiveGateway id="J"/>' + E + chain('S', 'G') + flow('1', 'G', 'X', cx('${a == 1}')) + flow('2', 'G', 'C')
  + flow('3', 'X', 'A', cx('${b == 1}')) + flow('4', 'X', 'B') + chain('A', 'J') + chain('B', 'J') + chain('C', 'J') + chain('J', 'E'));
 assert.throws(
  () => bpmn.import(nested),
  /Inclusive gateway G is not a clean single-entry, single-exit region.*found exclusiveGateway X inside a branch/);
 assert.deepEqual(bpmn.analyze(nested).rejections.map(x => x.id), ['G']);
 const race = fdoc(
  S + '<bpmn:eventBasedGateway id="G"/>'
  + '<bpmn:intermediateCatchEvent id="M"><bpmn:messageEventDefinition/></bpmn:intermediateCatchEvent>'
  + '<bpmn:intermediateCatchEvent id="T">' + timerDef('PT30M') + '</bpmn:intermediateCatchEvent><bpmn:endEvent id="E2"/>'
  + E + chain('S', 'G', 'M', 'E') + chain('G', 'T', 'E2'));
 const rr = bpmn.analyze(race), rd = rr.definition!;
 assert.equal(stepIn(rd, 'g').kind, 'decision');
 assert.deepEqual(whenIn(rd, 'g-m'), {chance: 50});
 assert.equal(whenIn(rd, 'g-t'), undefined);
 assert.equal(stepIn(rd, 't').duration, 30);
 assert.equal(stepIn(rd, 'm').kind, 'timer');
 assert(rr.warnings.some(w => /Event-based gateway G: race between events simulated by chance \(equal shares\)/.test(w)));
 assert(rr.warnings.some(w => /message catch event M is simulated as a timer; message arrival is an assumption/.test(w)));
 const exp = (text: string) => fdoc(
  S + '<bpmn:exclusiveGateway id="G"/><bpmn:endEvent id="E2"/>' + E + chain('S', 'G') + flow('x', 'G', 'E', cx(text))
  + flow('y', 'G', 'E2'));
 const when = (text: string) => whenIn(bpmn.import(exp(text)).definition!, 'x');
 assert.deepEqual(when("${a &gt; 1 &amp;&amp; !(b == 'x')}"), {all: [{field: 'a', op: 'gt', value: 1}, {not: {field: 'b', op: 'eq', value: 'x'}}]});
 assert.deepEqual(
  when('${a == 1 or b != 2 and c}'),
  {any: [{field: 'a', op: 'eq', value: 1}, {all: [{field: 'b', op: 'ne', value: 2}, {field: 'c', op: 'eq', value: true}]}]});
 assert.deepEqual(when('${1000 &lt;= amount}'), {field: 'amount', op: 'gte', value: 1000});
 assert.deepEqual(when('not ok'), {not: {field: 'ok', op: 'eq', value: true}});
 assert.deepEqual(when('${a &lt; b || c == null}'), {any: [{field: 'a', op: 'lt', valueField: 'b'}, {field: 'c', op: 'eq', value: null}]});
 for (const [bad, shown] of [
  ['${x.y(1)}', '${x.y(1)}'], ['${a + 1}', '${a + 1}'], ['${a == B_Upper}', '${a == B_Upper}'],
  ['${a &gt; 1 &amp;&amp; (b == 2}', '${a > 1 && (b == 2}'],
 ] as const)
  assert.throws(() => bpmn.import(exp(bad)), (e: Error) => e.message.startsWith('Flow x: unsupported condition "' + shown + '" ('), bad);
 const mi = (inner: string) => fdoc(S + `<bpmn:userTask id="T">${inner}</bpmn:userTask>` + E + chain('S', 'T', 'E'));
 const card = (c: string, seq = '') =>
  `<bpmn:multiInstanceLoopCharacteristics${seq}><bpmn:loopCardinality>${c}</bpmn:loopCardinality>`
  + '<bpmn:completionCondition>${done}</bpmn:completionCondition></bpmn:multiInstanceLoopCharacteristics>';
 const m1 = bpmn.analyze(mi(card('7', ' isSequential="true"')));
 assert.deepEqual(stepIn(m1.definition!, 't').instances, {count: 7, mode: 'sequential'});
 assert(m1.warnings.some(w => /completion condition of multi-instance T is ignored/.test(w)));
 const m2 = bpmn.analyze(mi(card('99')));
 assert.deepEqual(stepIn(m2.definition!, 't').instances, {count: 50, mode: 'parallel'});
 assert(m2.warnings.some(w => /cardinality 99 is limited to 50/.test(w)));
 const m3 = bpmn.analyze(mi(
  '<bpmn:multiInstanceLoopCharacteristics><bpmn:loopDataInputRef>docs</bpmn:loopDataInputRef></bpmn:multiInstanceLoopCharacteristics>'));
 assert.deepEqual(stepIn(m3.definition!, 't').instances, {field: 'tItems', mode: 'parallel'});
 assert(m3.warnings.some(w => /iterates a collection.*generated case field "tItems"/.test(w)));
 const lp = bpmn.analyze(mi(
  '<bpmn:standardLoopCharacteristics loopMaximum="4"><bpmn:loopCondition>retry == true</bpmn:loopCondition></bpmn:standardLoopCharacteristics>'));
 const ld = lp.definition!;
 assert(lp.ok, JSON.stringify(lp.diagnostics));
 assert.deepEqual(stepIn(ld, 't').add, {tRuns: 1});
 assert.equal(stepIn(ld, 't-loop').kind, 'decision');
 assert.deepEqual(whenIn(ld, 't-repeat'), {all: [{field: 'retry', op: 'eq', value: true}, {field: 'tRuns', op: 'lt', value: 4}]});
 const lq = bpmn.analyze(mi(
  '<bpmn:standardLoopCharacteristics><bpmn:loopCondition>keep trying</bpmn:loopCondition></bpmn:standardLoopCharacteristics>'));
 assert.deepEqual(whenIn(lq.definition!, 't-repeat'), {all: [{chance: 50}, {field: 'tRuns', op: 'lt', value: 3}]});
 assert(lq.warnings.some(w => /loop condition "keep trying" cannot be evaluated.*50% chance/.test(w)));
 const bound = (attrs: string, def: string) => fdoc(
  S + '<bpmn:task id="T"/><bpmn:task id="H"/><bpmn:endEvent id="E2"/>'
  + `<bpmn:boundaryEvent id="B" attachedToRef="T"${attrs}>${timerDef(def)}</bpmn:boundaryEvent>`
  + E + chain('S', 'T', 'E') + chain('B', 'H', 'E2'));
 const b1 = bpmn.analyze(bound('', 'PT1H30M')), b2 = bpmn.analyze(bound(' cancelActivity="false"', 'P1D'));
 assert.deepEqual(stepIn(b1.definition!, 't').deadline, {mode: 'interrupt', flow: 'b-h', after: 90});
 assert.equal(b1.definition!.flows.find(f => f.id === 'b-h')!.on, 'deadline');
 assert.deepEqual(stepIn(b2.definition!, 't').deadline, {mode: 'escalate', flow: 'b-h', after: 480});
 const secs = bpmn.analyze(bound('', 'PT30S'));
 assert.equal(stepIn(secs.definition!, 't').deadline!.after, 1);
 assert(secs.warnings.some(w => /under one minute/.test(w)));
 assert.equal(stepIn(bpmn.analyze(bound('', 'PT1H'), {minutesPerHour: 50}).definition!, 't').deadline!.after, 50);
 assert.equal(stepIn(bpmn.analyze(bound('', 'P2D'), {minutesPerDay: 400}).definition!, 't').deadline!.after, 800);
 const link = fdoc(
  S + '<bpmn:intermediateThrowEvent id="M"><bpmn:messageEventDefinition/></bpmn:intermediateThrowEvent>'
  + '<bpmn:intermediateThrowEvent id="L1"><bpmn:linkEventDefinition name="go"/></bpmn:intermediateThrowEvent>'
  + '<bpmn:intermediateCatchEvent id="L2"><bpmn:linkEventDefinition name="go"/></bpmn:intermediateCatchEvent><bpmn:task id="T"/>'
  + E + chain('S', 'M', 'L1') + chain('L2', 'T', 'E'));
 const lk = bpmn.analyze(link);
 assert.deepEqual(lk.definition!.steps.map(s => s.id), ['s', 't', 'e']);
 assert(lk.warnings.some(w => /Throw event M \(message\) is folded into the flow; nothing is thrown/.test(w)));
 const ends = bpmn.analyze(fdoc(
  S + '<bpmn:exclusiveGateway id="G" default="G-E2"/><bpmn:endEvent id="E1"><bpmn:terminateEventDefinition/></bpmn:endEvent>'
  + '<bpmn:endEvent id="E2"><bpmn:errorEventDefinition/></bpmn:endEvent>'
  + chain('S', 'G') + flow('G-E1', 'G', 'E1', cx('${x == 1}')) + chain('G', 'E2')));
 assert.equal(stepIn(ends.definition!, 'e2').outcome, 'lost');
 assert(ends.warnings.some(w => /Terminate end event E1 is a plain end/.test(w)));
});

test('BPMN import reads BPSim parameters into timing, probabilities, arrivals, capacities and costs', () => {
 const tasks = ['A', 'B', 'V', 'W', 'X', 'Y', 'Z'], fixed = param('CostParameters', 'FixedCost', '<bpsim:FloatingParameter value="12.4"/>');
 const body = S
  + `<bpmn:laneSet id="LS">${lane('L1', 'Clerks', ['A', 'B', 'W', 'X', 'Y', 'Z'])}${lane('L2', 'Engine', ['V'])}</bpmn:laneSet>`
  + tasks.map(t => t === 'V' ? '<bpmn:serviceTask id="V"/>' : `<bpmn:userTask id="${t}"/>`).join('')
  + '<bpmn:exclusiveGateway id="G"/><bpmn:endEvent id="E1"/><bpmn:endEvent id="E2"/><bpmn:endEvent id="E3"/>'
  + chain('S', ...tasks, 'G') + chain('G', 'E1') + chain('G', 'E2') + chain('G', 'E3');
 const params = '<bpsim:ScenarioParameters baseTimeUnit="min" replication="5">'
  + '<bpsim:Duration><bpsim:DurationParameter value="PT8H"/></bpsim:Duration></bpsim:ScenarioParameters>'
  + ep('S', param('ControlParameters', 'InterTriggerTimer', '<bpsim:NegativeExponentialDistribution mean="20"/>')
   + param('ControlParameters', 'TriggerCount', num(5))
   + '<bpsim:PropertyParameters><bpsim:Property name="Amount"><bpsim:UniformDistribution min="100" max="900"/></bpsim:Property>'
   + '<bpsim:Property name="vip"><bpsim:BooleanParameter value="true"/></bpsim:Property></bpsim:PropertyParameters>')
  + ep('A', time('<bpsim:UniformDistribution min="2" max="10"/>') + fixed)
  + ep('B', time('<bpsim:TriangularDistribution min="1" mode="4" max="13"/>'))
  + ep('V', time('<bpsim:NegativeExponentialDistribution mean="3"/>'))
  + ep('W', time('<bpsim:NormalDistribution mean="1" standardDeviation="0.25" timeUnit="hrs"/>'))
  + ep('X', time('<bpsim:ErlangDistribution k="3" mean="2" timeUnit="days"/>'))
  + ep('Y', time('<bpsim:PoissonDistribution mean="4"/>')) + ep('Z', time(num(30, 's')))
  + ep('G-E1', prob(0.5)) + ep('G-E2', prob(0.3)) + ep('G-E3', prob(0.2))
  + ep('L1', param('ResourceParameters', 'Quantity', num(3))
   + param('CostParameters', 'UnitCost', '<bpsim:FloatingParameter value="2"/>')
   + '<bpsim:ResourceParameters><bpsim:Selection><bpsim:StringParameter value="any"/></bpsim:Selection></bpsim:ResourceParameters>')
  + ep('L2', param('ResourceParameters', 'Quantity', num(5))
   + param('CostParameters', 'UnitCost', '<bpsim:FloatingParameter value="120" timeUnit="hrs"/>'))
  + ep('Ghost', time(num(1)));
 const r = bpmn.analyze(fdoc(body, sim(params)), {minutesPerDay: 100, defaultDuration: 7}), d = r.definition!;
 assert(r.ok && !r.rejections.length, JSON.stringify([r.rejections, r.diagnostics]));
 assert.deepEqual([stepIn(d, 'a').duration, stepIn(d, 'a').timing, stepIn(d, 'a').cost], [6, {dist: 'uniform', min: 2, max: 10}, 12]);
 assert.deepEqual([stepIn(d, 'b').duration, stepIn(d, 'b').timing], [6, {dist: 'triangular', min: 1, mode: 4, max: 13}]);
 assert.deepEqual([stepIn(d, 'v').duration, stepIn(d, 'v').timing], [3, {dist: 'exponential', mean: 3}]);
 assert.deepEqual([stepIn(d, 'w').duration, stepIn(d, 'w').timing], [60, {dist: 'normal', mean: 60, sd: 15}]);
 assert.deepEqual([stepIn(d, 'x').duration, stepIn(d, 'x').timing], [200, {dist: 'erlang', k: 3, mean: 200}]);
 assert.deepEqual([stepIn(d, 'y').duration, stepIn(d, 'y').timing], [7, undefined]);
 assert.deepEqual([stepIn(d, 'z').duration, stepIn(d, 'z').timing], [1, undefined]);
 assert.deepEqual(d.resources, [
  {id: 'clerks', name: 'Clerks', capacity: 3, costPerMinute: 2},
  {id: 'engine', name: 'Engine', capacity: 5, costPerMinute: 2, kind: 'system'},
 ]);
 assert.deepEqual(whenIn(d, 'g-e1'), {chance: 50});
 assert.deepEqual(whenIn(d, 'g-e2'), {chance: 60});
 assert.equal(whenIn(d, 'g-e3'), undefined);
 assert.deepEqual(d.arrivals, [{
  at: 0, count: 5, interval: 20, gap: {dist: 'exponential', mean: 20}, draws: [{field: 'amount', kind: 'int', min: 100, max: 900}],
  data: {vip: true},
 }]);
 assert.equal(r.info.horizon, 480);
 assert.equal(r.info.scenario, 'base');
 for (const w of [
  /BPSim time of "Z" is under one minute/, /BPSim PoissonDistribution for ProcessingTime of "Y" is not supported; the default duration applies/,
  /BPSim replication 5 is ignored/, /BPSim Selection\/Priority parameters are ignored \(L1\)/, /BPSim parameters for "Ghost" match no element/,
  /1 task\(s\) had no duration and were given 7 minutes/,
 ]) assert(r.warnings.some(w2 => w.test(w2)), String(w));
 const mapped = (type: string) => r.mapping.filter(m => m.type === type);
 assert.equal(mapped('bpsim:ProcessingTime').length, 6);
 assert.equal(mapped('bpsim:FixedCost')[0]!.target, 'step:a');
 assert.equal(mapped('bpsim:Property').length, 2);
 assert.equal(mapped('bpsim:InterTriggerTimer')[0]!.target, 'arrival:1');
 const odd = bpmn.analyze(fdoc(body, sim(
  ep('G-E1', prob(0.6)) + ep('G-E2', prob(0.4)) + ep('G-E3', prob(0.2)) + ep('S', param('ControlParameters', 'InterTriggerTimer', num(15))))));
 assert.deepEqual([whenIn(odd.definition!, 'g-e1'), whenIn(odd.definition!, 'g-e2')], [{chance: 50}, {chance: 67}]);
 assert(odd.warnings.some(w => /BPSim probabilities of gateway G sum to 1.2; they were normalised to 1/.test(w)));
 assert(odd.warnings.some(w => /rounded to whole percents \(50%, 67% chained/.test(w)));
 assert.deepEqual(odd.definition!.arrivals, [{at: 0, open: true, interval: 15, data: {}}]);
 assert(odd.warnings.some(w => /defines an open arrival stream/.test(w)));
 const part = bpmn.analyze(fdoc(body, sim(ep('G-E1', prob(0.5)) + ep('G-E2', prob(0.25)))));
 assert.deepEqual([whenIn(part.definition!, 'g-e1'), whenIn(part.definition!, 'g-e2')], [{chance: 50}, {chance: 50}]);
 const two = fdoc(
  S + `<bpmn:laneSet id="LS">${lane('L1', 'Clerks', ['A'])}</bpmn:laneSet><bpmn:userTask id="A"/>` + E + chain('S', 'A', 'E'),
  sim(ep('A', time(num(11))) + ep('L1', param('ResourceParameters', 'Quantity', num(2)))).replace(
   '</bpsim:BPSimData>',
   '<bpsim:Scenario id="second">' + ep('A', time(num(77))) + ep('L1', param('ResourceParameters', 'Quantity', num(9)))
   + '</bpsim:Scenario></bpsim:BPSimData>'));
 const first2 = bpmn.analyze(two), timed = bpmn.analyze(two, {scenario: 'second'});
 assert.deepEqual([stepIn(first2.definition!, 'a').duration, first2.definition!.resources[0]!.capacity, first2.info.scenario], [11, 2, 'base']);
 assert(first2.warnings.some(w => /2 BPSim scenarios; the first, "base", is used/.test(w)));
 assert.deepEqual([stepIn(timed.definition!, 'a').duration, timed.definition!.resources[0]!.capacity, timed.info.scenario], [77, 9, 'second']);
 assert.deepEqual(timed.info.scenarios.map(s => s.id), ['base', 'second']);
 assert.throws(() => bpmn.import(fdoc(body, sim(params)), {scenario: 'nope'}), /BPSim scenario "nope" was not found; the file has "base"/);
 const small = S + '<bpmn:userTask id="A"/>' + E + chain('S', 'A', 'E');
 const smallSim = sim(ep('A', time(num(77))) + ep('S', param('ControlParameters', 'TriggerCount', num(4))));
 const on = bpmn.analyze(fdoc(small, smallSim)).definition!, off = bpmn.analyze(fdoc(small, smallSim), {bpsim: false}).definition!;
 assert.equal(stepIn(on, 'a').duration, 77);
 assert.deepEqual(on.arrivals, [{at: 0, count: 4, interval: 0, data: {}}]);
 assert.equal(stepIn(off, 'a').duration, 5);
 assert.deepEqual(off.arrivals, [{at: 0, count: 1, interval: 0, data: {}}]);
 // Extension values win over BPSim and the disagreement is reported.
 const own = define([
  stepOf('start', 'start', 0),
  stepOf('work', 'task', 1, {duration: 8, cost: 5, timing: {dist: 'uniform', min: 4, max: 12}, resources: {crew: 1}}),
  stepOf('end', 'end', 2),
 ], [flowOf('start', 'work'), flowOf('work', 'end')]);
 own.resources = [{id: 'crew', name: 'Crew', capacity: 2, costPerMinute: 3}];
 const xml = bpmn.export(own, {bpsim: true}), tampered = bpmn.analyze(xml
  .replace('<bpsim:UniformDistribution min="4" max="12"/>', '<bpsim:UniformDistribution min="5" max="9"/>')
  .replace('<bpsim:NumericParameter value="2"/>', '<bpsim:NumericParameter value="7"/>')
  .replace('<bpsim:FloatingParameter value="5"/>', '<bpsim:FloatingParameter value="99"/>'));
 assert.equal(catalog.fingerprint(tampered.definition!), catalog.fingerprint(own));
 for (const w of [
  /BPSim time of Activity_work disagrees with the Wildlands duration\/timing; the extension wins/,
  /BPSim Quantity 7 of resource Resource_crew disagrees with the Wildlands capacity 2/,
  /BPSim FixedCost of Activity_work disagrees with the Wildlands cost/,
 ]) assert(tampered.warnings.some(x => w.test(x)), String(w) + tampered.warnings.join('|'));
});

test('BPMN import rejects or drops unsupported constructs explicitly depending on the unsupported option', () => {
 const errorBoundary = fdoc(
  S + '<bpmn:task id="T"/><bpmn:task id="H"/><bpmn:endEvent id="E2"/>'
  + '<bpmn:boundaryEvent id="B" attachedToRef="T"><bpmn:errorEventDefinition/></bpmn:boundaryEvent>'
  + E + chain('S', 'T', 'E') + chain('B', 'H', 'E2'));
 const rejected = bpmn.analyze(errorBoundary);
 assert.equal(rejected.ok, false);
 assert.equal(rejected.definition, undefined);
 assert.deepEqual(rejected.rejections, [{
  id: 'B', type: 'boundaryEvent',
  message: 'boundaryEvent B is not supported: error boundary events cannot be simulated; only timer boundary events with a timeDuration can.',
 }]);
 assert.throws(() => bpmn.import(errorBoundary), /boundaryEvent B is not supported: error boundary events/);
 const dropped = bpmn.analyze(errorBoundary, {unsupported: 'drop'});
 assert(dropped.ok && dropped.definition && !dropped.rejections.length, JSON.stringify(dropped.diagnostics));
 assert.deepEqual(dropped.definition.steps.map(s => s.id), ['s', 't', 'e']);
 assert(dropped.warnings.some(w => /boundaryEvent B is not supported: error boundary events.* It was dropped\./.test(w)));
 assert(dropped.warnings.some(w => /Pruned 2 element\(s\) no longer reachable from the start: H, E2/.test(w)));
 assert(dropped.mapping.some(m => m.id === 'H' && m.target === 'none' && /pruned/.test(m.how)));
 assert(dropped.mapping.some(m => m.id === 'B' && /dropped \(unsupported\)/.test(m.how)));
 const complex = fdoc(
  S + '<bpmn:complexGateway id="G"/><bpmn:task id="A"/><bpmn:task id="B"/>' + E + chain('S', 'G')
  + flow('G-A', 'G', 'A', cx('${x &gt; 1}')) + chain('G', 'B') + chain('A', 'E') + chain('B', 'E'));
 assert.deepEqual(bpmn.analyze(complex).rejections.map(x => [x.id, x.type]), [['G', 'complexGateway']]);
 const approx = bpmn.analyze(complex, {unsupported: 'drop'});
 assert.equal(stepIn(approx.definition!, 'g').kind, 'decision');
 assert.deepEqual(whenIn(approx.definition!, 'g-a'), {field: 'x', op: 'gt', value: 1});
 assert(approx.warnings.some(w => /Complex gateway G has no simulation semantics; it is approximated as an exclusive gateway/.test(w)));
 const throwing = fdoc(
  S + '<bpmn:task id="T"/><bpmn:intermediateThrowEvent id="X"><bpmn:compensateEventDefinition/></bpmn:intermediateThrowEvent>'
  + E + chain('S', 'T', 'X', 'E'));
 assert.match(bpmn.analyze(throwing).rejections[0]!.message, /intermediateThrowEvent X is not supported: compensate throw events cannot be simulated/);
 const bridged = bpmn.analyze(throwing, {unsupported: 'drop'});
 assert.deepEqual(bridged.definition!.flows.map(f => [f.from, f.to]), [['s', 't'], ['t', 'e']]);
 assert(bridged.mapping.some(m => m.id === 'X' && /its flows were bridged/.test(m.how)));
 const transaction = fdoc(S + '<bpmn:transaction id="TX"/>' + E + chain('S', 'TX'));
 assert.match(bpmn.analyze(transaction).rejections[0]!.message, /transaction TX is not supported/);
 const lost = bpmn.analyze(transaction, {unsupported: 'drop'});
 assert.equal(lost.ok, false);
 assert.deepEqual(lost.rejections.map(x => x.message), ['After dropping unsupported elements no end event is reachable from the start event.']);
 assert(lost.warnings.some(w => /transaction TX is not supported.* It was dropped\./.test(w)));
 const bad = (text: string) => fdoc(
  S + '<bpmn:exclusiveGateway id="G"/><bpmn:endEvent id="E2"/>' + E + chain('S', 'G') + flow('x', 'G', 'E', cx(text))
  + flow('y', 'G', 'E2'));
 const noisy = bpmn.analyze(bad('${x.y(1)}'));
 assert.equal(noisy.rejections.length, 1);
 assert.deepEqual([noisy.rejections[0]!.id, noisy.rejections[0]!.type], ['x', 'sequenceFlow']);
 const chance = bpmn.analyze(bad('${x.y(1)}'), {unsupported: 'drop'});
 assert.deepEqual(whenIn(chance.definition!, 'x'), {chance: 50});
 assert(chance.warnings.some(w => /unsupported condition "\$\{x\.y\(1\)\}".*The flow becomes a 50% chance/.test(w)));
 const nonBranching = fdoc(S + '<bpmn:task id="T"/>' + E + chain('S', 'T') + flow('T-E', 'T', 'E', cx('${x == 1}')));
 assert(bpmn.analyze(nonBranching).warnings.some(w => /Condition on flow T-E is ignored; only exclusive and inclusive gateways branch/.test(w)));
 const unreachable = fdoc(S + '<bpmn:task id="A"/><bpmn:inclusiveGateway id="G"/>' + E + chain('S', 'A', 'E'));
 assert.match(bpmn.analyze(unreachable).rejections[0]!.message, /inclusiveGateway G must split \(1 in, 2\+ out\) or join/);
 const unconditioned = fdoc(
  S + '<bpmn:inclusiveGateway id="G"/><bpmn:task id="A"/><bpmn:task id="B"/><bpmn:inclusiveGateway id="J"/>' + E
  + chain('S', 'G', 'A', 'J', 'E') + chain('G', 'B', 'J') + flow('G-J', 'G', 'J', cx('${c == 1}')));
 assert.match(
  bpmn.analyze(unconditioned).rejections.map(x => x.message).join('|'),
  /Flow G-A leaving inclusive gateway G has no condition and is not the default flow/);
 assert.match(
  bpmn.analyze(unconditioned, {unsupported: 'drop'}).warnings.join('|'),
  /Flow G-A of inclusive gateway G has no condition; it becomes a 50% chance/);
 for (const [options, message] of [
  [{lanes: 'rows'}, /Option lanes must be pools or ignore/], [{unsupported: 'maybe'}, /Option unsupported must be reject or drop/],
  [{defaultCapacity: 0}, /Option defaultCapacity must be a whole number from 1 to 1000/], [{minutesPerDay: 2000}, /Option minutesPerDay/],
  [{bpsim: 'yes'}, /Option bpsim must be true or false/], [{colour: 'red'}, /Unknown import option: colour/],
 ] as const)
  assert.throws(() => bpmn.import(fdoc(S + E + chain('S', 'E')), options as never), message);
 assert.deepEqual(bpmn.options(), bpmn.options({}));
 assert.deepEqual(bpmn.options({}), {
  defaultDuration: 5, process: null, lanes: 'pools', defaultCapacity: 1, autoSystemPool: true, systemCapacity: 4, minutesPerDay: 480,
  minutesPerHour: 60, unsupported: 'reject', bpsim: true, scenario: null,
 });
 assert.throws(() => bpmn.import('<bpmn:definitions ' + M + '/>'), /Import needs at least one process/);
 assert.deepEqual(bpmn.analyze('<a xmlns="x"/>').rejections.map(x => x.message), ['Expected a BPMN 2.0 definitions document.']);
});
