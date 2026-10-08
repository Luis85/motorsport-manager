/// <reference path="./process-contracts.d.ts" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {catalog, bpmn} from './process-sdk.cjs';
const results: {name: string; passed: boolean; error?: string}[] = [];
function test(name: string, work: () => void): void {try {work(); results.push({name, passed: true});} catch (e) {results.push({name, passed: false, error: String(e)});}}
const stepOf = (id: string, kind: LWProcess.Kind, at: number, extra: Partial<LWProcess.Step> = {}): LWProcess.Step => ({id, name: id, kind, scene: {id: 'scene-' + id, position: [at * 12, 0], color: '#ffbb73'}, ...extra});
const flowOf = (from: string, to: string, when?: LWProcess.Condition): LWProcess.Flow => ({id: from + '-' + to, from, to, ...when ? {when} : {}});
const cond = (c: object) => c as LWProcess.Condition;
const define = (steps: LWProcess.Step[], flows: LWProcess.Flow[], data: LWProcess.Fields = {}) =>
 ({format: 'wildlands-process', schemaVersion: 1, revision: 0, id: 'timed', name: 'Timed', start: 'start', resources: [], steps, flows, arrivals: [{at: 0, count: 1, interval: 0, data}]}) as LWProcess.Definition;
const M = 'xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"';
const foreign = (body: string) => `<?xml version="1.0"?><bpmn:definitions ${M} id="D"><bpmn:process id="P" name="Timer">${body}</bpmn:process></bpmn:definitions>`;
const flow = (id: string, from: string, to: string, inner = '') => `<bpmn:sequenceFlow id="${id}" sourceRef="${from}" targetRef="${to}">${inner}</bpmn:sequenceFlow>`;
const withTimer = (inner: string, event = 'intermediateCatchEvent') => foreign(`<bpmn:startEvent id="S"/><bpmn:${event} id="T">${inner}</bpmn:${event}><bpmn:endEvent id="E"/>${flow('A', 'S', 'T')}${flow('B', 'T', 'E')}`);
const duration = (text: string) => `<bpmn:timerEventDefinition><bpmn:timeDuration xsi:type="bpmn:tFormalExpression">${text}</bpmn:timeDuration></bpmn:timerEventDefinition>`;

test('BPMN round trip preserves timer steps, counters and field-to-field conditions losslessly', () => {
 const d = define([stepOf('start', 'start', 0), stepOf('work', 'task', 1, {duration: 3, add: {tries: 1, slack: -2}}), stepOf('wait', 'timer', 2, {duration: 90, add: {waits: 1}}), stepOf('gate', 'decision', 3),
  stepOf('hold', 'timer', 4, {until: 200}), stepOf('end', 'end', 5)],
 [flowOf('start', 'work'), flowOf('work', 'wait'), flowOf('wait', 'gate'), flowOf('gate', 'hold', cond({field: 'a', op: 'lt', valueField: 'b'})), flowOf('gate', 'end', cond({field: 'a', op: 'eq', value: 'b'})), flowOf('hold', 'end')], {a: 1, b: 2, tries: 0});
 d.flows.push({id: 'gate-end-literal', from: 'gate', to: 'end', when: cond({field: 'a', op: 'ne', valueField: 'true'})}, {id: 'gate-end-fallback', from: 'gate', to: 'end'});
 const xml = bpmn.export(d), back = bpmn.import(xml);
 assert(back.definition, JSON.stringify(back.diagnostics)); assert.deepEqual(back.warnings, []);
 assert.equal(catalog.fingerprint(back.definition), catalog.fingerprint(d)); assert.deepEqual(back.definition, d); assert.equal(bpmn.export(back.definition), xml);
 assert.match(xml, /<bpmn:intermediateCatchEvent id="Event_wait"[^>]*>[\s\S]*?<bpmn:timeDuration xsi:type="bpmn:tFormalExpression">PT90M<\/bpmn:timeDuration>/);
 assert.match(xml, /<bpmn:intermediateCatchEvent id="Event_hold"[\s\S]*?<bpmn:timeDate [^>]*>1970-01-01T03:20:00Z<\/bpmn:timeDate>/); assert.match(xml, /<wl:step id="hold" until="200"\/>/);
 assert.match(xml, /<wl:add name="tries" delta="1"\/>/); assert.match(xml, /<wl:when field="a" op="lt" valueField="b"\/>/);
 assert(xml.includes('${a &lt; b}') || xml.includes('${a < b}')); assert(xml.includes("'b'")); assert.doesNotMatch(xml, /\$\{a != true\}/);
 assert.match(xml, /<bpmndi:BPMNShape id="Event_wait_di"[\s\S]*?width="36" height="36"/);
 const expressionOnly = bpmn.import(xml.replace(/<bpmn:sequenceFlow id="Flow_gate-end-literal"[\s\S]*?<\/bpmn:sequenceFlow>/, '').replace(/<wl:when [^>]*\/>/g, '').replace(/<wl:add [^>]*\/>/g, '')).definition!.flows;
 assert.deepEqual(expressionOnly.find(f => f.id === 'gate-hold')?.when, {field: 'a', op: 'lt', valueField: 'b'}); assert.deepEqual(expressionOnly.find(f => f.id === 'gate-end')?.when, {field: 'a', op: 'eq', value: 'b'});
});

test('BPMN import accepts duration timer events and rejects unsupported timer and event forms explicitly', () => {
 const minutes = (xml: string) => bpmn.import(xml).definition!.steps.find(s => s.kind === 'timer')!;
 const m = minutes(withTimer(duration('PT45M'))), h = minutes(withTimer(duration('PT2H')));
 assert.equal(m.duration, 45); assert.equal(m.until, undefined); assert.equal(h.duration, 120); assert.equal(m.id, 't');
 for (const bad of ['PT1H30M', 'P1D', 'PT0M', 'PT1.5H', 'PT30S', '45', '']) assert.throws(() => bpmn.import(withTimer(duration(bad))), /Timer T is not supported: duration/, bad);
 const form = (name: string) => `<bpmn:timerEventDefinition><bpmn:${name}>2026-01-01T00:00:00Z</bpmn:${name}></bpmn:timerEventDefinition>`;
 assert.throws(() => bpmn.import(withTimer(form('timeDate'))), /Timer T is not supported: timeDate has no business-minute meaning/);
 assert.throws(() => bpmn.import(withTimer(form('timeCycle'))), /timeCycle has no business-minute meaning/);
 assert.throws(() => bpmn.import(withTimer('<bpmn:timerEventDefinition/>')), /define exactly one timeDuration/);
 assert.throws(() => bpmn.import(withTimer('<bpmn:messageEventDefinition messageRef="M"/>')), /intermediateCatchEvent T is not supported[\s\S]*messageEventDefinition/);
 assert.throws(() => bpmn.import(withTimer('')), /no event definition/);
 assert.throws(() => bpmn.import(withTimer(duration('PT5M') + '<bpmn:signalEventDefinition/>')), /intermediateCatchEvent T is not supported/);
 assert.throws(() => bpmn.import(withTimer(duration('PT5M'), 'intermediateThrowEvent')), /intermediateThrowEvent T is not supported/);
 assert.throws(() => bpmn.import(foreign(`<bpmn:startEvent id="S"/><bpmn:task id="K"/><bpmn:boundaryEvent id="B" attachedToRef="K">${duration('PT5M')}</bpmn:boundaryEvent><bpmn:endEvent id="E"/>${flow('A', 'S', 'K')}${flow('C', 'K', 'E')}`)), /boundaryEvent B is not supported/);
 assert.throws(() => bpmn.import(foreign(`<bpmn:startEvent id="S"/><bpmn:intermediateCatchEvent id="T">${duration('PT5M')}</bpmn:intermediateCatchEvent><bpmn:endEvent id="E"/><bpmn:endEvent id="E2"/>${flow('A', 'S', 'T')}${flow('B', 'T', 'E')}${flow('C', 'T', 'E2')}`)), /Timer T has 2 outgoing flows/);
 const field = (text: string) => foreign(`<bpmn:startEvent id="S"/><bpmn:exclusiveGateway id="G" default="C"/><bpmn:endEvent id="E"/><bpmn:endEvent id="E2"/>${flow('A', 'S', 'G')}${flow('B', 'G', 'E', `<bpmn:conditionExpression>${text}</bpmn:conditionExpression>`)}${flow('C', 'G', 'E2')}`);
 assert.deepEqual(bpmn.import(field('${a >= b}')).definition!.flows.find(f => f.id === 'b')!.when, {field: 'a', op: 'gte', valueField: 'b'});
 assert.deepEqual(bpmn.import(field("${a == 'b'}")).definition!.flows.find(f => f.id === 'b')!.when, {field: 'a', op: 'eq', value: 'b'});
 assert.deepEqual(bpmn.import(field('${a == true}')).definition!.flows.find(f => f.id === 'b')!.when, {field: 'a', op: 'eq', value: true});
 assert.throws(() => bpmn.import(field('${a == B_Upper}')), /unsupported condition/);
});
const automated = () => {
 const d = define([stepOf('start', 'start', 0), stepOf('weld', 'machine', 1, {duration: 4, cost: 2, resources: {arm: 1}, technology: 'Robot arm', set: {welded: true}, outputs: [{field: 'welded', label: 'Welded'}]}),
  stepOf('build', 'system', 2, {duration: 3, resources: {ci: 2}, technology: 'CI/CD pipeline', add: {builds: 1}, outputs: [{field: 'builds'}]}),
  stepOf('check', 'task', 3, {duration: 2, resources: {crew: 1}, set: {ok: true}, outputs: [{field: 'ok', label: 'Checked'}]}), stepOf('end', 'end', 4)],
 [flowOf('start', 'weld'), flowOf('weld', 'build'), flowOf('build', 'check'), flowOf('check', 'end')], {builds: 0});
 d.resources = [{id: 'arm', name: 'Arm', capacity: 1, costPerMinute: 1, kind: 'machine'}, {id: 'ci', name: 'CI', capacity: 2, costPerMinute: 0, kind: 'system'}, {id: 'crew', name: 'Crew', capacity: 1, costPerMinute: 1, kind: 'people'}];
 return d;
};
const fingerprint = (d: LWProcess.Definition) => catalog.fingerprint(d);

test('BPMN round trip preserves machine and system steps, technology, outputs and resource kinds losslessly', () => {
 const d = automated(), xml = bpmn.export(d), back = bpmn.import(xml);
 assert(back.ok && back.definition, JSON.stringify(back.diagnostics)); assert.deepEqual(back.warnings, []);
 assert.deepEqual(back.definition, catalog.validate(d, true).definition); assert.equal(fingerprint(back.definition), fingerprint(d));
 assert.match(xml, /<bpmn:serviceTask id="Activity_build"/); assert.match(xml, /<bpmn:task id="Activity_weld"/);
 assert.match(xml, /<wl:step id="weld" kind="machine"[^>]*technology="Robot arm"/); assert.match(xml, /<wl:output field="welded" label="Welded"\/>/);
 assert.match(xml, /<wl:resource id="arm"[^>]*kind="machine"\/>/);
 assert.match(xml, /<bpmndi:BPMNShape id="Activity_build_di"[\s\S]*?width="100" height="80"/);
 const again = bpmn.import(bpmn.export(back.definition)); assert.deepEqual(again.definition, back.definition);
});

test('BPMN import keeps foreign service tasks as tasks and reports inconsistent automated-step extensions explicitly', () => {
 const WL = 'xmlns:wl="urn:wildlands:process:1"', body = (el: string, ext: string, perf = '') => `<bpmn:startEvent id="S"/><bpmn:${el} id="K">${ext}${perf}</bpmn:${el}><bpmn:endEvent id="E"/>${flow('A', 'S', 'K')}${flow('B', 'K', 'E')}`;
 for (const el of ['serviceTask', 'scriptTask', 'sendTask', 'receiveTask', 'businessRuleTask']) {
  const r = bpmn.import(foreign(body(el, '')));
  assert(r.ok && r.definition, el + JSON.stringify(r.diagnostics)); assert.equal(r.definition.steps.find(s => s.id === 'k')!.kind, 'task');
  assert(r.warnings.some(w => w.includes(el + ' K imports as a timed task')), el);
 }
 const doc = (el: string, step: string, resKind = 'machine') => `<?xml version="1.0"?><bpmn:definitions ${M} ${WL} id="D"><bpmn:resource id="R"><bpmn:extensionElements><wl:resource id="r" capacity="1" costPerMinute="0" kind="${resKind}"/></bpmn:extensionElements></bpmn:resource><bpmn:process id="P" name="P">` +
  body(el, `<bpmn:extensionElements>${step}</bpmn:extensionElements>`, '<bpmn:performer id="PF"><bpmn:resourceRef>R</bpmn:resourceRef></bpmn:performer>') + '</bpmn:process></bpmn:definitions>';
 const ok = bpmn.import(doc('serviceTask', '<wl:step id="k" kind="system" duration="3" technology="API"/><wl:output field="done"/><wl:set name="done" type="boolean" value="true"/>', 'system'));
 assert(ok.ok && ok.definition, JSON.stringify(ok.diagnostics)); const k = ok.definition.steps.find(s => s.id === 'k')!;
 assert.equal(k.kind, 'system'); assert.equal(k.technology, 'API'); assert.deepEqual(k.outputs, [{field: 'done'}]); assert.equal(ok.definition.resources[0]!.kind, 'system'); assert.deepEqual(ok.warnings.filter(w => w.includes('K')), []);
 const mismatch = bpmn.import(doc('userTask', '<wl:step id="k" kind="machine" duration="3"/>', 'people'));
 assert.equal(mismatch.ok, false); assert(mismatch.diagnostics.length > 0);
 assert(mismatch.warnings.some(w => w.includes('userTask but its Wildlands extension says machine')), mismatch.warnings.join('|'));
 const wrongPool = bpmn.import(doc('serviceTask', '<wl:step id="k" kind="system" duration="3"/>', 'machine'));
 assert.equal(wrongPool.ok, false); assert(wrongPool.diagnostics.length > 0, JSON.stringify(wrongPool.diagnostics));
 const techOnTask = bpmn.import(doc('task', '<wl:step id="k" duration="3" technology="Robot"/>', 'people'));
 assert.equal(techOnTask.ok, false); assert(techOnTask.diagnostics.length > 0);
 const badKind = bpmn.import(doc('task', '<wl:step id="k" kind="robot" duration="3"/>', 'people'));
 assert.equal(badKind.ok, false); assert(badKind.diagnostics.length > 0);
});
const randomised = () => {
 const d = define([stepOf('start', 'start', 0), stepOf('work', 'task', 1, {duration: 6, timing: {dist: 'triangular', min: 2, mode: 5, max: 12}, resources: {crew: 1}, draws: [{field: 'defect', kind: 'chance', percent: 20, whenTrue: 'yes', whenFalse: 'no'}, {field: 'grade', kind: 'choice', values: [{value: 'a', weight: 3}, {value: 7, weight: 1}, {value: true, weight: 2}]}, {field: 'size', kind: 'int', min: 1, max: 9}]}),
  stepOf('wait', 'timer', 2, {duration: 10, timing: {dist: 'exponential', mean: 10, max: 60}}), stepOf('gate', 'decision', 3), stepOf('fix', 'task', 4, {duration: 3, timing: {dist: 'uniform', min: 1, max: 5}}), stepOf('end', 'end', 5)],
 [flowOf('start', 'work'), flowOf('work', 'wait'), flowOf('wait', 'gate'), {id: 'gate-fix', from: 'gate', to: 'fix', when: {chance: 15}}, {id: 'gate-end', from: 'gate', to: 'end'}, flowOf('fix', 'end')]);
 d.seed = 4242; d.resources = [{id: 'crew', name: 'Crew', capacity: 2, costPerMinute: 1}];
 d.arrivals = [{at: 0, count: 3, interval: 5, gap: {dist: 'exponential', mean: 5, max: 30}, draws: [{field: 'rush', kind: 'chance', percent: 50}], data: {}}, {at: 10, until: 300, interval: 20, data: {a: 1}}, {at: 5, open: true, interval: 15, gap: {dist: 'uniform', min: 5, max: 25}, data: {}}];
 return d;
};

test('BPMN round trip preserves seeds, random timing, draws, chance routes and open or until arrivals losslessly', () => {
 const d = randomised(), checked = catalog.validate(d, true); assert(checked.definition, JSON.stringify(checked.diagnostics));
 const xml = bpmn.export(d), back = bpmn.import(xml);
 assert(back.definition, JSON.stringify(back.diagnostics)); assert.deepEqual(back.warnings, []);
 assert.equal(catalog.fingerprint(back.definition), catalog.fingerprint(d)); assert.deepEqual(back.definition, checked.definition); assert.equal(bpmn.export(back.definition), xml);
 assert.match(xml, /<wl:process [^>]*seed="4242"/); assert.match(xml, /<wl:timing dist="triangular" min="2" mode="5" max="12"\/>/); assert.match(xml, /<wl:timing dist="exponential" max="60" mean="10"\/>/);
 assert.match(xml, /<wl:arrival at="0" count="3" interval="5">/); assert.match(xml, /<wl:arrival at="10" until="300" interval="20">/); assert.match(xml, /<wl:arrival at="5" open="true" interval="15">/);
 assert.doesNotMatch(xml, /count="undefined"/); assert.doesNotMatch(xml, /<wl:arrival at="10"[^>]*count=/);
 assert.match(xml, /<wl:when chance="15"\/>/); assert.match(xml, /language="urn:wildlands:process:1#chance">15%<\/bpmn:conditionExpression>/);
 const noDefault = xml.replace(/ seed="4242"/, ''); assert.equal(bpmn.import(noDefault).definition!.seed, undefined);
 // The expression alone carries a chance; the extension alone carries the exact value.
 const exprOnly = bpmn.import(xml.replace(/<wl:when chance="15"\/>/, '')).definition!, extOnly = bpmn.import(xml.replace(/<bpmn:conditionExpression[^>]*chance">15%<\/bpmn:conditionExpression>/, '')).definition!;
 assert.deepEqual(exprOnly.flows.find(f => f.id === 'gate-fix')!.when, {chance: 15}); assert.deepEqual(extOnly.flows.find(f => f.id === 'gate-fix')!.when, {chance: 15});
 const plain = define([stepOf('start', 'start', 0), stepOf('end', 'end', 1)], [flowOf('start', 'end')]);
 assert.equal(catalog.fingerprint(bpmn.import(bpmn.export(plain)).definition!), catalog.fingerprint(plain));
});

test('BPMN import rejects malformed random extensions with explicit diagnostics', () => {
 const xml = bpmn.export(randomised()), bad = (from: RegExp | string, to: string, message: RegExp) => assert.throws(() => bpmn.import(xml.replace(from, to)), message, String(from) + ' -> ' + to);
 bad(/seed="4242"/, 'seed="4.5"', /Process: seed "4\.5" must be a whole number/);
 bad(/dist="triangular"/, 'dist="normal"', /dist "normal" must be uniform, triangular or exponential/);
 bad(/<wl:timing dist="triangular" min="2"/, '<wl:timing dist="triangular" min="x"', /min "x" must be a whole number/);
 bad(/<wl:timing dist="triangular" min="2"/, '<wl:timing speed="2" dist="triangular" min="2"', /unknown attribute speed/);
 bad(/<wl:timing dist="exponential"[^>]*\/>/, '$&<wl:timing dist="uniform" min="1" max="2"/>', /2 timing elements/);
 bad(/kind="chance" percent="20"/, 'kind="coin" percent="20"', /kind "coin" must be chance, choice or int/);
 bad(/<wl:choice weight="3"/, '<wl:choice ', /choice needs a weight/);
 bad(/<wl:choice weight="3"/, '<wl:choice weight="1.5"', /weight "1\.5" must be a whole number/);
 bad(/<wl:whenTrue [^>]*\/>/, '<wl:whenTrue type="string" value="a"/><wl:whenTrue type="string" value="b"/>', /2 whenTrue elements/);
 bad(/<wl:when chance="15"\/>/, '<wl:when chance="15.5"/>', /chance "15\.5" must be a whole number/);
 bad(/<wl:when chance="15"\/>/, '<wl:when chance="20"/>', /chance extension 20 disagrees with expression 15%/);
 bad(/>15%</, '>fifteen%<', /chance expression "fifteen%" must be a whole percent such as 15%/);
 bad(/<wl:when chance="15"\/>/, '<wl:when chance="15" field="a" op="eq" type="number" value="1"/>', /unknown attribute field/);
 bad(/(<bpmn:conditionExpression[^>]*chance">15%<\/bpmn:conditionExpression>)/, '$1<bpmn:conditionExpression>a == 1</bpmn:conditionExpression>', /2 conditionExpression elements/);
 bad(/ language="urn:wildlands:process:1#chance"/, '', /cannot also carry the field condition "15%"|chance route/);
 bad(/<wl:arrival at="10" until="300"/, '<wl:arrival at="10" until="300" count="2"', /Arrival 2: declare exactly one of count, until or open \(found 2\)/);
 bad(/<wl:arrival at="10" until="300" interval="20"/, '<wl:arrival at="10" interval="20"', /Arrival 2: declare exactly one of count, until or open \(found 0\)/);
 bad(/open="true"/, 'open="yes"', /open "yes" must be true or absent/);
 bad(/<wl:arrival at="10"/, '<wl:arrival bogus="1" at="10"', /unknown attribute bogus/);
 bad(/<wl:gap dist="exponential"[^>]*\/>/, '$&<wl:gap dist="uniform" min="1" max="2"/>', /2 gap elements/);
 // Chance only belongs after an exclusive gateway.
 const wrongSource = foreign(`<bpmn:startEvent id="S"/><bpmn:task id="K"/><bpmn:endEvent id="E"/>${flow('A', 'S', 'K')}${flow('B', 'K', 'E', '<bpmn:conditionExpression language="urn:wildlands:process:1#chance">10%</bpmn:conditionExpression>')}`);
 assert.throws(() => bpmn.import(wrongSource), /chance route but leaves K, which is not an exclusive gateway/);
 // Range errors are the engine validator's, returned as diagnostics rather than repaired.
 const range = bpmn.import(xml.replace(/<wl:when chance="15"\/>/, '<wl:when chance="150"/>').replace(/>15%</, '>150%<'));
 assert.equal(range.ok, false); assert(range.diagnostics.length > 0);
});
const report = {suite: 'business-process-bpmn', passed: results.filter(r => r.passed).length, total: results.length, results};
fs.writeFileSync(path.join(__dirname, 'process-bpmn-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`${report.passed}/${report.total} process BPMN checks passed`); for (const r of results) if (!r.passed) console.error(r.name, r.error);
if (report.passed !== report.total) process.exitCode = 1;
