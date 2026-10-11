/// <reference path="./process-contracts.d.ts" />
/**
 * Standard BPMN export and the pinned example files (part of the business-process-bpmn suite, entry test-process-bpmn.cts; they
 * register after the foreign import checks and before the XML reader checks): a rich definition exports standard constructs
 * and optional BPSim and re-imports identically; the example files import, validate, simulate deterministically, round-trip
 * through export with and without the Wildlands extension, and drive the import-bpmn/export-bpmn CLI.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {catalog, bpmn, runtime} from './process-sdk.cjs';
import {test, stepOf, flowOf, define, S, E, fdoc, chain, stepIn, whenIn, joinRegExp} from './test-process-bpmn-helpers.cjs';

const rich = () => {
 const d = define([
  stepOf('start', 'start', 0),
  stepOf('intake', 'task', 1, {
   duration: 6, timing: {dist: 'normal', mean: 6, sd: 2}, resources: {crew: 1}, instances: {count: 3, mode: 'parallel'},
  }),
  stepOf('gate', 'fork', 2, {join: 'merge', mode: 'inclusive'}),
  stepOf('a', 'system', 3, {duration: 4, timing: {dist: 'erlang', k: 2, mean: 4}, resources: {bots: 1}}),
  stepOf('b', 'task', 4, {duration: 5, cost: 7, timing: {dist: 'triangular', min: 2, mode: 4, max: 9}, resources: {crew: 2}}),
  stepOf('merge', 'join', 5),
  stepOf('review', 'task', 6, {duration: 20, resources: {crew: 1}, deadline: {after: 30, mode: 'escalate', flow: 'late'}}),
  stepOf('alert', 'task', 7, {duration: 3}),
  stepOf('breach', 'end', 8),
  stepOf('check', 'task', 9, {
   duration: 9, resources: {crew: 1}, instances: {field: 'lines', mode: 'sequential'},
   deadline: {timing: {dist: 'exponential', mean: 20}, mode: 'interrupt', flow: 'slow'},
  }),
  stepOf('rework', 'task', 10, {duration: 2}),
  stepOf('choose', 'decision', 11),
  stepOf('wait', 'timer', 12, {duration: 10, timing: {dist: 'uniform', min: 5, max: 15}}),
  stepOf('good', 'end', 13),
  stepOf('bad', 'end', 14)],
 [
  flowOf('start', 'intake'), flowOf('intake', 'gate'),
  {
   id: 'gate-a', from: 'gate', to: 'a',
   when: {all: [{field: 'amount', op: 'gt', value: 100}, {not: {field: 'region', op: 'eq', value: 'eu'}}]} as LWProcess.When,
  },
  {id: 'gate-b', from: 'gate', to: 'b', when: {all: [{chance: 30}, {field: 'vip', op: 'eq', value: true}]} as LWProcess.When},
  flowOf('gate', 'merge'), flowOf('a', 'merge'), flowOf('b', 'merge'), flowOf('merge', 'review'), flowOf('review', 'check'),
  {id: 'late', from: 'review', to: 'alert', on: 'deadline'}, flowOf('alert', 'breach'), flowOf('check', 'choose'),
  {id: 'slow', from: 'check', to: 'rework', on: 'deadline'}, flowOf('rework', 'choose'),
  {id: 'choose-bad', from: 'choose', to: 'bad', when: {chance: 25}}, flowOf('choose', 'wait'), flowOf('wait', 'good')],
 {amount: 150, vip: true, region: 'us', lines: 2});
 d.resources = [
  {id: 'crew', name: 'Crew', capacity: 3, costPerMinute: 1},
  {id: 'bots', name: 'Bots', capacity: 2, costPerMinute: 0, kind: 'system'},
 ];
 d.arrivals = [
  {at: 0, count: 5, interval: 15, gap: {dist: 'exponential', mean: 15}, data: {amount: 150, vip: true, region: 'us', lines: 2}},
  {at: 5, open: true, interval: 30, data: {amount: 50, vip: false, region: 'eu', lines: 1}},
 ];
 return d;
};

test('BPMN export emits standard constructs and optional BPSim and re-imports to the identical definition', () => {
 const d = rich(), checked = catalog.validate(d, true);
 assert(checked.definition && checked.ok, JSON.stringify(checked.diagnostics));
 const plain = bpmn.export(d), withSim = bpmn.export(d, {bpsim: true});
 assert.doesNotMatch(plain, /bpsim|relationship/);
 for (const xml of [plain, withSim]) {
  const back = bpmn.analyze(xml);
  assert(back.ok && back.definition && !back.rejections.length, JSON.stringify([back.rejections, back.diagnostics]));
  assert.deepEqual(back.warnings, []);
  assert.deepEqual(back.definition, checked.definition);
  assert.equal(catalog.fingerprint(back.definition), catalog.fingerprint(d));
  assert.equal(bpmn.export(back.definition, {bpsim: xml === withSim}), xml);
 }
 assert.match(plain, /<bpmn:inclusiveGateway id="Gateway_gate" name="gate" default="Flow_gate-merge" gatewayDirection="Diverging">/);
 assert.match(plain, /<bpmn:inclusiveGateway id="Gateway_merge" name="merge" gatewayDirection="Converging">/);
 assert.doesNotMatch(plain, /parallelGateway/);
 assert.match(
  plain,
  /<bpmn:multiInstanceLoopCharacteristics isSequential="false">\s*<bpmn:loopCardinality xsi:type="bpmn:tFormalExpression">3<\/bpmn:loopCardinality>/);
 assert.match(plain, /<bpmn:loopCardinality [^>]*>\$\{lines\}<\/bpmn:loopCardinality>/);
 assert.match(plain, /isSequential="true"/);
 assert.match(plain, joinRegExp(
  /<bpmn:boundaryEvent id="Boundary_review" name="Deadline" attachedToRef="Activity_review" cancelActivity="false">[\s\S]*?/,
  /<wl:deadline mode="escalate" flow="late" after="30"\/>[\s\S]*?<bpmn:outgoing>Flow_late<\/bpmn:outgoing>[\s\S]*?PT30M/));
 assert.match(plain, joinRegExp(
  /<bpmn:boundaryEvent id="Boundary_check"[^>]*cancelActivity="true">[\s\S]*?<wl:deadline mode="interrupt" flow="slow"\/>\s*/,
  /<wl:timing dist="exponential" mean="20"\/>[\s\S]*?PT20M/));
 assert.match(plain, /<bpmn:sequenceFlow id="Flow_late" sourceRef="Boundary_review" targetRef="Activity_alert">/);
 assert.match(plain, /<bpmndi:BPMNShape id="Boundary_review_di" bpmnElement="Boundary_review">/);
 assert.match(plain, /<wl:timing dist="normal" mean="6" sd="2"\/>/);
 assert.match(plain, /<wl:timing dist="erlang" mean="4" k="2"\/>/);
 assert.match(plain, /\$\{amount &gt; 100 &amp;&amp; !\(region == 'eu'\)\}<\/bpmn:conditionExpression>/);
 assert.match(
  plain,
  /<wl:when combine="all">\s*<wl:when field="amount" op="gt" type="number" value="100"\/>\s*<wl:when combine="not">\s*<wl:when field="region"/);
 const flowB = plain.slice(
  plain.indexOf('<bpmn:sequenceFlow id="Flow_gate-b"'),
  plain.indexOf('</bpmn:sequenceFlow>', plain.indexOf('<bpmn:sequenceFlow id="Flow_gate-b"')));
 assert.doesNotMatch(flowB, /conditionExpression/);
 assert.match(flowB, /<wl:when combine="all">\s*<wl:when chance="30"\/>/);
 assert.match(plain, /<bpmn:serviceTask id="Activity_a"/);
 assert.match(plain, joinRegExp(
  /<bpmn:laneSet id="LaneSet_timed">\s*<bpmn:lane id="Lane_crew" name="Crew">[\s\S]*?/,
  /<bpmn:flowNodeRef>Activity_intake<\/bpmn:flowNodeRef>[\s\S]*?<bpmn:flowNodeRef>Activity_b<\/bpmn:flowNodeRef>/));
 assert.doesNotMatch(plain.slice(plain.indexOf('<bpmn:laneSet'), plain.indexOf('</bpmn:laneSet>')), /Activity_a</);
 assert.doesNotMatch(plain.slice(plain.indexOf('<bpmn:laneSet'), plain.indexOf('</bpmn:laneSet>')), /Lane_bots/);
 const scenario = withSim.slice(withSim.indexOf('<bpmn:relationship type="BPSimData">'));
 assert.match(withSim, /<bpmn:definitions [^>]*xmlns:bpsim="http:\/\/www\.bpsim\.org\/schemas\/1\.0"/);
 assert.match(scenario, /<bpsim:ScenarioParameters baseTimeUnit="min"\/>/);
 assert.match(scenario, /<bpmn:source>Process_timed<\/bpmn:source>/);
 for (const part of [
  '<bpsim:NormalDistribution mean="6" standardDeviation="2"/>', '<bpsim:ErlangDistribution k="2" mean="4"/>',
  '<bpsim:TriangularDistribution min="2" mode="4" max="9"/>', '<bpsim:NegativeExponentialDistribution mean="15"/>',
  '<bpsim:UniformDistribution min="5" max="15"/>', '<bpsim:WaitTime><bpsim:UniformDistribution',
  '<bpsim:TriggerCount><bpsim:NumericParameter value="5"/>', '<bpsim:InterTriggerTimer><bpsim:NegativeExponentialDistribution mean="15"/>',
  'elementRef="Resource_crew"', '<bpsim:Quantity><bpsim:NumericParameter value="3"/>', '<bpsim:UnitCost><bpsim:FloatingParameter value="1"/>',
  '<bpsim:FixedCost><bpsim:FloatingParameter value="7"/>', 'elementRef="Flow_choose-bad"',
  '<bpsim:Probability><bpsim:FloatingParameter value="0.25"/>', '<bpsim:Probability><bpsim:FloatingParameter value="0.75"/>',
 ]) assert(scenario.includes(part), part);
 assert.doesNotMatch(scenario, /Flow_gate-b|Flow_gate-a/);
 const small = define(
  [stepOf('start', 'start', 0), stepOf('t', 'task', 1, {duration: 3, resources: {crew: 1}}), stepOf('end', 'end', 2)],
  [flowOf('start', 't'), flowOf('t', 'end')]);
 small.resources = [{id: 'crew', name: 'Crew', capacity: 2, costPerMinute: 1}];
 small.arrivals = [{at: 0, until: 300, interval: 20, data: {}}];
 const until = bpmn.export(small, {bpsim: true});
 assert.match(until, /<bpsim:Duration><bpsim:DurationParameter value="PT300M"\/><\/bpsim:Duration>/);
 assert.match(until, /<bpsim:InterTriggerTimer><bpsim:FloatingParameter value="20"\/>/);
 assert.equal(catalog.fingerprint(bpmn.import(until).definition!), catalog.fingerprint(small));
 const foreignSide = bpmn.analyze(until.replace(
  /<bpmn:extensionElements>(?:(?!<\/bpmn:extensionElements>)[\s\S])*?<\/bpmn:extensionElements>/g,
  m => /bpsim:/.test(m) ? m : '')).definition!;
 assert.deepEqual(foreignSide.arrivals, [{at: 0, until: 300, interval: 20, data: {}}]);
 assert.deepEqual(foreignSide.resources.map(r => [r.capacity, r.costPerMinute]), [[2, 1]]);
 assert.deepEqual(foreignSide.steps.map(s => [s.kind, s.duration]), [['start', undefined], ['task', 3], ['end', undefined]]);
});

test('BPMN example files import, validate and simulate deterministically', () => {
 const read = (name: string) => fs.readFileSync(path.join(__dirname, '..', 'examples', 'bpmn', name + '.bpmn'), 'utf8');
 const snapshot = (d: LWProcess.Definition, seed: number, chunks = 1) => {
  const s = runtime.create(d, {seed});
  try {
   for (let i = 0; i < chunks; i++) s.advance(5000 / chunks);
   return s.query();
  } finally {
   s.dispose();
  }
 };
 const visits = (snap: LWProcess.Snapshot) => Object.fromEntries(snap.steps.filter(x => x.visits).map(x => [x.id, x.visits]));
 const loan = bpmn.analyze(read('loan-application')), ticket = bpmn.analyze(read('support-ticket'));
 for (const r of [loan, ticket]) {
  assert(r.ok && r.definition && !r.rejections.length, JSON.stringify([r.rejections, r.diagnostics]));
  assert(catalog.validate(r.definition).ok);
 }
 assert.deepEqual(
  [loan.definition!.steps.length, loan.definition!.flows.length, loan.mapping.length, loan.warnings.length],
  [21, 24, 93, 8]);
 assert.deepEqual(
  [ticket.definition!.steps.length, ticket.definition!.flows.length, ticket.mapping.length, ticket.warnings.length],
  [14, 15, 54, 6]);
 assert.equal(catalog.fingerprint(loan.definition!), 'eb23a64e7012e3f6');
 assert.equal(catalog.fingerprint(ticket.definition!), '271b0b721b26913e');
 for (const w of [
  /BPSim time of "Task_Rules" is under one minute/, /BPSim LogNormalDistribution for ProcessingTime of "Task_Notify" is not supported/,
  /BPSim replication 3 is ignored/, /Merge or pass-through gateway Gw_Merge was folded/,
  /Probabilities of gateway Gw_Risk were rounded to whole percents \(45%, 55% chained/,
  /6 service-type task\(s\) run as automated system steps.*serviceTask Task_Archive on "Automation".*serviceTask Task_Rules on "Credit engine"/,
  /1 task\(s\) had no duration and were given 5 minutes/, /Message flows are ignored \(2\); counterparties: Credit bureau/,
 ]) assert(loan.warnings.some(x => w.test(x)), String(w));
 for (const w of [
  /Start event Start_Opened \(message\) imports as a plain start/,
  /message catch event Catch_Reply is simulated as a timer; message arrival is an assumption/,
  /Loop Task_Fix: the loop condition "fix failed" cannot be evaluated.*50% chance/,
  /Event-based gateway Gw_Await: race between events simulated by chance \(BPSim probabilities\)/,
  /receiveTask Task_Wait waits for its processing time/, /4 service-type task\(s\) run as automated system steps/,
 ]) assert(ticket.warnings.some(x => w.test(x)), String(w));
 const ld = loan.definition!, td = ticket.definition!;
 assert.deepEqual(ld.resources.map(r => [r.id, r.kind ?? 'people', r.capacity, r.costPerMinute]), [
  ['customer', 'people', 50, 0], ['bank-clerk', 'people', 3, 2], ['credit-engine', 'system', 4, 1], ['automation', 'system', 4, 1],
 ]);
 assert.deepEqual(stepIn(ld, 'sub-docs-task-verify').instances, {count: 3, mode: 'parallel'});
 assert.deepEqual(stepIn(ld, 'task-review').deadline, {mode: 'escalate', flow: 'f-sla', after: 90});
 assert.equal(stepIn(ld, 'gw-extra').mode, 'inclusive');
 assert.deepEqual(ld.sipoc, {
  suppliers: [{name: 'Credit bureau', supplies: 'Credit report'}],
  customers: [{name: 'Credit bureau', receives: 'Credit report request'}],
 });
 assert.deepEqual(ld.arrivals, [{
  at: 0, until: 960, interval: 30, gap: {dist: 'exponential', mean: 30},
  draws: [{field: 'amount', kind: 'int', min: 1000, max: 50000}, {field: 'years', kind: 'int', min: 0, max: 10}], data: {},
 }]);
 assert.deepEqual(stepIn(td, 'task-investigate').deadline, {mode: 'interrupt', flow: 's9', after: 75});
 assert.deepEqual(td.arrivals, [{at: 0, count: 20, interval: 45, gap: {dist: 'exponential', mean: 45}, data: {}}]);
 assert.deepEqual(whenIn(td, 'task-fix-repeat'), {all: [{chance: 50}, {field: 'taskFixRuns', op: 'lt', value: 3}]});
 const a = snapshot(ld, 7), b = snapshot(td, 7);
 assert.deepEqual(
  [a.minute, a.status, a.metrics.arrived, a.metrics.completed, a.metrics.failed, a.metrics.cost, a.metrics.meanCycleMinutes],
  [984, 'completed', 32, 32, 0, 2414, 50.125]);
 assert.deepEqual(visits(a), {
  'start-received': 32, 'task-submit': 32, 'sub-docs-task-verify': 32, 'sub-docs-task-archive': 32, 'call-fraud-task-rules': 32,
  'call-fraud-task-lists': 32, 'task-score': 32, 'gw-risk': 32, 'gw-extra': 9, 'task-income': 7, 'task-employer': 2, 'gw-extrajoin': 11,
  'task-review': 3, 'gw-review': 3, 'task-rejectnotice': 1, 'end-rejected': 1, 'task-notify': 1, 'end-breach': 1, 'task-sign': 31,
  'task-disburse': 31, 'end-paid': 31,
 });
 assert.deepEqual(a.steps.find(x => x.id === 'task-review')!.deadlines, {interrupted: 0, escalated: 1});
 assert.deepEqual(a.steps.find(x => x.id === 'sub-docs-task-verify')!.items, {started: 96, finished: 96});
 assert.deepEqual(
  a.resources.map(x => [x.id, x.busyMinutes]),
  [['customer', 656], ['bank-clerk', 923], ['credit-engine', 253], ['automation', 64]]);
 assert.deepEqual(
  [b.minute, b.status, b.metrics.arrived, b.metrics.completed, b.metrics.cost, b.metrics.meanCycleMinutes],
  [1094, 'completed', 20, 20, 2671, 226.15]);
 assert.deepEqual(visits(b), {
  'start-opened': 20, 'task-triage': 20, 'task-ask': 20, 'gw-await': 20, 'catch-reply': 13, 'catch-timeout': 7, 'end-closed': 7,
  'task-investigate': 13, 'task-handover': 4, 'task-fix': 26, 'task-wait': 13, 'task-notice': 13, 'end-resolved': 13, 'task-fix-loop': 26,
 });
 assert.deepEqual(b.steps.find(x => x.id === 'task-investigate')!.deadlines, {interrupted: 4, escalated: 0});
 assert.deepEqual(snapshot(ld, 7, 100), a);
 assert.deepEqual(snapshot(td, 7, 100), b);
 assert.deepEqual(snapshot(ld, 7), a);
 const other = snapshot(ld, 8), otherTicket = snapshot(td, 8);
 assert.deepEqual([other.minute, other.metrics.arrived, other.metrics.completed, other.metrics.cost], [1104, 34, 34, 3301]);
 assert.deepEqual(
  [otherTicket.minute, otherTicket.metrics.cost, otherTicket.steps.find(x => x.id === 'task-investigate')!.deadlines!.interrupted],
  [950, 3392, 7]);
 // The extension keeps an imported example lossless; the standard constructs alone import back as well.
 for (const r of [loan, ticket]) for (const withSim of [false, true]) {
  const xml = bpmn.export(r.definition!, {bpsim: withSim}), back = bpmn.analyze(xml);
  assert(back.ok && !back.warnings.length, JSON.stringify([back.warnings, back.rejections]));
  assert.equal(catalog.fingerprint(back.definition!), catalog.fingerprint(r.definition!));
 }
 const standard = bpmn.analyze(bpmn.export(ld, {bpsim: true}).replace(
  /<bpmn:extensionElements>(?:(?!<\/bpmn:extensionElements>)[\s\S])*?<\/bpmn:extensionElements>/g,
  m => /bpsim:/.test(m) ? m : '')).definition!;
 assert.equal(standard.steps.filter(s => s.mode === 'inclusive').length, 1);
 assert.deepEqual(standard.steps.find(s => s.name === 'Verify document')!.instances, {count: 3, mode: 'parallel'});
 assert.deepEqual(
  standard.steps.find(s => s.name === 'Manual review')!.deadline,
  {mode: 'escalate', flow: standard.flows.find(f => f.on === 'deadline')!.id, after: 90});
 assert.deepEqual(standard.resources.map(r => [r.name, r.kind ?? 'people', r.capacity]), [
  ['Customer', 'people', 50], ['Bank clerk', 'people', 3], ['Credit engine', 'system', 4], ['Automation', 'system', 4],
 ]);
 const bare = bpmn.analyze(read('loan-application'), {bpsim: false});
 assert.deepEqual(bare.rejections.map(x => x.id), ['Gw_Risk', 'Gw_Review']);
 assert.match(bare.rejections[0]!.message, /several flows without a condition; mark one as the default flow/);
 const equal = bpmn.analyze(read('loan-application'), {bpsim: false, unsupported: 'drop'});
 assert(equal.ok, JSON.stringify(equal.rejections));
 assert.deepEqual(equal.definition!.arrivals, [{at: 0, count: 1, interval: 0, data: {}}]);
 assert.equal(runtime.create(equal.definition!, {seed: 1}).advance(3000).metrics.completed, 1);
 const cli = path.join(__dirname, 'tools/wildlands-cli.cjs');
 if (fs.existsSync(cli)) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bpmn-cli-'));
  try {
   const call = (args: string[], code: number) => {
    const p = spawnSync(process.execPath, [cli, 'process', ...args], {cwd: dir, encoding: 'utf8'});
    assert.equal(p.status, code, args.join(' ') + p.stderr + p.stdout);
    return JSON.parse(p.stdout) as Record<string, any>;
   };
   const input = path.join(__dirname, '..', 'examples', 'bpmn', 'loan-application.bpmn');
   const bad = call(['import-bpmn', '--input', input, '--output', 'x.json', '--lanes', 'rows'], 2);
   assert.match(bad.errors[0], /Option lanes must be pools or ignore/);
   assert.equal(fs.existsSync(path.join(dir, 'x.json')), false);
   call(['import-bpmn', '--input', input, '--output', 'x.json', '--scenario', 'a', '--no-bpsim'], 2);
   call(['import-bpmn', '--input', input, '--output', 'x.json', '--default-capacity', '0'], 2);
   const ok = call(['import-bpmn', '--input', input, '--output', 'loan.json', '--report', 'report.json', '--default-capacity', '2'], 0);
   assert.equal(ok.ok, true);
   assert.equal(ok.runnable, true);
   assert.equal(ok.mapping.total, 93);
   assert.equal(ok.mapping.byType.sequenceFlow, 29);
   assert.deepEqual(ok.rejections, []);
   assert.equal(ok.process.id, 'Process_Loan');
   assert.equal(ok.scenario, 'Scenario_Base');
   assert.equal(ok.horizon, 960);
   assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8')).mapping.length, 93);
   const ran = call(['run', '--input', 'loan.json', '--minutes', '3000', '--output', 'run.json', '--seed', '7'], 0);
   assert.deepEqual([ran.advancedMinutes, ran.status, ran.metrics.completed, ran.metrics.cost], [984, 'completed', 32, 2414]);
   const rejected = path.join(dir, 'bad.bpmn');
   fs.writeFileSync(rejected, fdoc(
    S + '<bpmn:task id="T"/><bpmn:boundaryEvent id="B" attachedToRef="T"><bpmn:errorEventDefinition/></bpmn:boundaryEvent>'
    + '<bpmn:task id="H"/>' + E + chain('S', 'T', 'E') + chain('B', 'H', 'E')));
   const refused = call(['import-bpmn', '--input', rejected, '--output', 'bad.json'], 2);
   assert.equal(refused.ok, false);
   assert.equal(refused.rejections[0].id, 'B');
   assert.equal(fs.existsSync(path.join(dir, 'bad.json')), false);
   const dropped = call(['import-bpmn', '--input', rejected, '--output', 'bad.json', '--unsupported', 'drop'], 0);
   assert(dropped.warnings.some((w: string) => /It was dropped/.test(w)));
   const exported = call(['export-bpmn', '--input', 'loan.json', '--output', 'loan.bpmn', '--bpsim'], 0);
   assert.equal(exported.bpsim, true);
   assert.match(fs.readFileSync(path.join(dir, 'loan.bpmn'), 'utf8'), /<bpsim:BPSimData>/);
   // The CLI prints what only the Wildlands extension carries, exactly as LWProcessBpmn.fidelity words it.
   const fidelity = bpmn.fidelity(JSON.parse(fs.readFileSync(path.join(dir, 'loan.json'), 'utf8')), {bpsim: true});
   assert.deepEqual(exported.fidelity, fidelity);
   assert(fidelity.length > 0);
  } finally {
   fs.rmSync(dir, {recursive: true, force: true});
  }
 }
});
