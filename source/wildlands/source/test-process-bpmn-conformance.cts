/// <reference path="./process-contracts.d.ts" />
/**
 * BPMN 2.0 / BPSim 1.0 conformance checks (part of the business-process-bpmn suite, entry test-process-bpmn.cts): every export
 * and example conforms to the built-in rule tables, hand-authored violations report the expected code, path and line, uncovered
 * elements are listed without changing the verdict, the CLI keeps its exit codes, and a large export is checked in bounded time.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {bpmn, conformance} from './process-sdk.cjs';
import {test, stepOf, flowOf, define} from './test-process-bpmn-helpers.cjs';
type Report = LWProcessBpmnConformance.Report;
const WL = 'urn:wildlands:process:1', EXAMPLES = path.join(__dirname, '..', 'examples', 'bpmn'), AGENCY = path.resolve(__dirname, '../../../docs/concepts/agency-delivery/content');
const example = (name: string) => fs.readFileSync(path.join(EXAMPLES, name + '.bpmn'), 'utf8');
const summary = (r: Report) => JSON.stringify(r.errors.slice(0, 4));
/** Conforms, nothing uncovered, and the only unchecked content is the Wildlands extension (exports) or none (the examples). */
function clean(name: string, xml: string, wildlands: boolean): Report {
 const r = conformance.validate(xml);
 assert(r.conforms, name + ' ' + summary(r)); assert.deepEqual(r.errors, [], name); assert.deepEqual(r.notCovered, [], name); assert.deepEqual(r.rules, {bpmn: '2.0', bpsim: '1.0'});
 assert.deepEqual(r.unchecked.map(u => u.namespace), wildlands ? [WL] : [], name); if (wildlands) assert.match(r.unchecked[0]!.note, /Wildlands process extension: .*not schema-checked/);
 assert(r.checked > 20, name + ' checked ' + r.checked);
 return r;
}

test('BPMN conformance: every agency process exported with and without BPSim, both examples and their import/export round trips conform to BPMN 2.0 and BPSim 1.0 with nothing uncovered', () => {
 const files = fs.readdirSync(AGENCY).filter(f => f.endsWith('.process.json')).sort(); assert(files.length >= 6, files.join());
 for (const f of files) {
  const d = JSON.parse(fs.readFileSync(path.join(AGENCY, f), 'utf8')) as LWProcess.Definition;
  for (const bpsim of [false, true]) {
   const out = bpmn.export(d, {bpsim}), plain = clean(f + (bpsim ? ' bpsim' : ''), out, true);
   assert.equal(/<bpsim:/.test(out), bpsim); if (bpsim) assert(plain.checked > clean(f, bpmn.export(d), true).checked, f + ': the BPSim scenario is checked, not skipped');
   clean(f + ' round trip' + (bpsim ? ' bpsim' : ''), bpmn.export(bpmn.import(out).definition!, {bpsim}), true);
  }
 }
 for (const name of ['loan-application', 'support-ticket']) {
  clean(name, example(name), false); const d = bpmn.import(example(name)).definition!;
  for (const bpsim of [false, true]) clean(name + ' round trip' + (bpsim ? ' bpsim' : ''), bpmn.export(d, {bpsim}), true);
 }
});

// One small valid file with a diagram and a BPSim scenario; each fixture below breaks one rule. Lines: 3 process, 5 task, 6 gateway, 8 boundary, 9-11 flows, 13 diagram, 14 relationship.
const BASE = [
 '<?xml version="1.0" encoding="UTF-8"?>',
 '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpsim="http://www.bpsim.org/schemas/1.0" xmlns:wl="urn:wildlands:process:1" id="D" targetNamespace="urn:test">',
 '  <bpmn:process id="P" isExecutable="false">',
 '    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>',
 '    <bpmn:task id="T" name="Work"><bpmn:documentation>Do it</bpmn:documentation><bpmn:extensionElements><wl:step id="t"/></bpmn:extensionElements><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing></bpmn:task>',
 '    <bpmn:exclusiveGateway id="G" gatewayDirection="Diverging" default="F3"/>',
 '    <bpmn:endEvent id="E"/>',
 '    <bpmn:boundaryEvent id="B" attachedToRef="T"><bpmn:timerEventDefinition><bpmn:timeDuration xsi:type="bpmn:tFormalExpression">PT5M</bpmn:timeDuration></bpmn:timerEventDefinition></bpmn:boundaryEvent>',
 '    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T"/>',
 '    <bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="G"/>',
 '    <bpmn:sequenceFlow id="F3" sourceRef="G" targetRef="E"/>',
 '  </bpmn:process>',
 '  <bpmndi:BPMNDiagram id="Di"><bpmndi:BPMNPlane id="Pl" bpmnElement="P"><bpmndi:BPMNShape id="T_di" bpmnElement="T"><dc:Bounds x="0" y="0" width="100" height="80"/></bpmndi:BPMNShape></bpmndi:BPMNPlane></bpmndi:BPMNDiagram>',
 '  <bpmn:relationship type="BPSimData"><bpmn:extensionElements><bpsim:BPSimData><bpsim:Scenario id="Sc"><bpsim:ElementParameters elementRef="T"><bpsim:TimeParameters><bpsim:ProcessingTime><bpsim:NumericParameter value="5" timeUnit="min"/></bpsim:ProcessingTime></bpsim:TimeParameters></bpsim:ElementParameters></bpsim:Scenario></bpsim:BPSimData></bpmn:extensionElements><bpmn:source>P</bpmn:source><bpmn:target>P</bpmn:target></bpmn:relationship>',
 '</bpmn:definitions>'].join('\n');
const swap = (text: string, a: string, b: string) => { assert(text.includes(a) && text.includes(b), a + ' / ' + b); return text.replace(a, '\u0000').replace(b, a).replace('\u0000', b); };
const edit = (a: string, b: string) => { assert(BASE.includes(a), a); return BASE.replace(a, b); };
const PROCESS = '/bpmn:definitions/bpmn:process', NUMERIC = '/bpmn:definitions/bpmn:relationship/bpmn:extensionElements/bpsim:BPSimData/bpsim:Scenario/bpsim:ElementParameters/bpsim:TimeParameters/bpsim:ProcessingTime/bpsim:';
/** [violation, file, expected [code, path, line] for every error]. */
const VIOLATIONS: [string, string, [string, string, number][]][] = [
 ['wrong child order (documentation after extensionElements)', swap(BASE, '<bpmn:documentation>Do it</bpmn:documentation>', '<bpmn:extensionElements><wl:step id="t"/></bpmn:extensionElements>'), [['element-unexpected', PROCESS + '/bpmn:task/bpmn:documentation', 5]]],
 ['unknown element in the MODEL namespace', edit('<bpmn:endEvent id="E"/>', '<bpmn:endEvnt id="E"/>'), [['element-unknown', PROCESS + '/bpmn:endEvnt', 7]]],
 ['missing required attribute', edit(' sourceRef="G" targetRef="E"', ' sourceRef="G"'), [['attribute-missing', PROCESS + '/bpmn:sequenceFlow[3]', 11]]],
 ['bad enumeration value', edit('gatewayDirection="Diverging"', 'gatewayDirection="Sideways"'), [['value-enumeration', PROCESS + '/bpmn:exclusiveGateway/@gatewayDirection', 6]]],
 ['duplicate id across BPMN and BPSim', edit('<bpsim:Scenario id="Sc">', '<bpsim:Scenario id="T">'), [['id-duplicate', '/bpmn:definitions/bpmn:relationship/bpmn:extensionElements/bpsim:BPSimData/bpsim:Scenario/@id', 14]]],
 ['dangling id reference', edit('sourceRef="S" targetRef="T"', 'sourceRef="Nowhere" targetRef="T"'), [['idref-unresolved', PROCESS + '/bpmn:sequenceFlow[1]/@sourceRef', 9]]],
 ['dangling qualified-name reference', edit('attachedToRef="T"', 'attachedToRef="Nowhere"'), [['reference-unresolved', PROCESS + '/bpmn:boundaryEvent/@attachedToRef', 8]]],
 ['text in element-only content', edit('<bpmn:process id="P" isExecutable="false">', '<bpmn:process id="P" isExecutable="false">stray text'), [['text-not-allowed', PROCESS, 3]]],
 ['unknown attribute without a namespace', edit('<bpmn:task id="T" name="Work">', '<bpmn:task id="T" name="Work" foo="1">'), [['attribute-unknown', PROCESS + '/bpmn:task/@foo', 5]]],
 ['BPSim timeUnit="hrs"', edit('timeUnit="min"', 'timeUnit="hrs"'), [['value-enumeration', NUMERIC + 'NumericParameter/@timeUnit', 14]]],
 ['BPSim LogNormal with scale and shape', edit('<bpsim:NumericParameter value="5" timeUnit="min"/>', '<bpsim:LogNormalDistribution scale="2" shape="1"/>'),
  [['attribute-unknown', NUMERIC + 'LogNormalDistribution/@scale', 14], ['attribute-unknown', NUMERIC + 'LogNormalDistribution/@shape', 14]]],
 ['relationship before BPMNDiagram', swap(BASE, BASE.split('\n')[12]!, BASE.split('\n')[13]!), [['element-unexpected', '/bpmn:definitions/bpmndi:BPMNDiagram', 14]]],
 ['two timer kinds in one definition', edit('PT5M</bpmn:timeDuration>', 'PT5M</bpmn:timeDuration><bpmn:timeCycle>R3/PT1H</bpmn:timeCycle>'), [['element-unexpected', PROCESS + '/bpmn:boundaryEvent/bpmn:timerEventDefinition/bpmn:timeCycle', 8]]],
 ['missing required child', edit('<bpmn:endEvent id="E"/>', '<bpmn:endEvent id="E"><bpmn:conditionalEventDefinition/></bpmn:endEvent>'), [['element-missing', PROCESS + '/bpmn:endEvent/bpmn:conditionalEventDefinition', 7]]],
 ['BPMN element inside extensionElements', edit('<wl:step id="t"/>', '<bpmn:task id="X"/>'), [['element-unexpected', PROCESS + '/bpmn:task/bpmn:extensionElements/bpmn:task', 5]]],
 ['abstract element', edit('<bpmn:endEvent id="E"/>', '<bpmn:endEvent id="E"/><bpmn:flowElement id="Z"/>'), [['element-abstract', PROCESS + '/bpmn:flowElement', 7]]],
 ['malformed BPSim number', edit('value="5"', 'value="5.5"'), [['value-invalid', NUMERIC + 'NumericParameter/@value', 14]]],
];

test('BPMN conformance: hand-authored violations each report the expected code, path and line', () => {
 clean('base fixture', BASE, true);
 for (const [name, xml, want] of VIOLATIONS) {
  const r = conformance.validate(xml);
  assert.equal(r.conforms, false, name); assert.deepEqual(r.errors.map(e => [e.code, e.path, e.line]), want, name + ' ' + summary(r));
  for (const e of r.errors) assert(e.message.length > 20 && !/undefined/.test(e.message), name + ': ' + e.message);
 }
 // Messages name the element, the attribute and what is expected.
 const [enumeration] = conformance.validate(VIOLATIONS[3]![1]).errors, [order] = conformance.validate(VIOLATIONS[11]![1]).errors;
 assert.equal(enumeration!.message, 'Attribute gatewayDirection of bpmn:exclusiveGateway must be one of Unspecified, Converging, Diverging, Mixed, not "Sideways".');
 assert.match(order!.message, /^bpmndi:BPMNDiagram is not allowed at this position inside bpmn:definitions\. Expected here: bpmn:relationship\. The children of bpmn:definitions come in this order: bpmn:import, bpmn:extension, bpmn:rootElement .*bpmndi:BPMNDiagram, bpmn:relationship\.$/);
 // Attributes of other namespaces and a derived expression type are allowed; text is allowed in an expression; a document that is not XML is reported, not thrown.
 for (const ok of [edit('<bpmn:task id="T" name="Work">', '<bpmn:task id="T" name="Work" wl:note="1">'), edit('PT5M', 'P1DT2H'), edit('isExecutable="false"', 'isExecutable="1"')]) assert(conformance.validate(ok).conforms, summary(conformance.validate(ok)));
 const broken = conformance.validate('<bpmn:definitions'); assert.equal(broken.conforms, false); assert.equal(broken.errors[0]!.code, 'xml-malformed');
 assert.equal(conformance.validate('<?xml version="1.0"?><process xmlns="urn:other"/>').errors[0]!.code, 'root-unknown');
});

test('BPMN conformance: the example files as they stood before the 2026-10-08 correction report exactly the three archived findings', () => {
 const loan = example('loan-application'), ticket = example('support-ticket');
 const before = (xml: string) => { const rel = /\n {2}<bpmn:relationship[\s\S]*<\/bpmn:relationship>/.exec(xml)![0]; return xml.replace(rel, '').replace('\n  <bpmndi:BPMNDiagram', rel + '\n  <bpmndi:BPMNDiagram'); };
 const oldLoan = before(loan).replace('standardDeviation="0.3" timeUnit="hour"', 'standardDeviation="0.3" timeUnit="hrs"').replace('<bpsim:LogNormalDistribution mean="8" standardDeviation="3"/>', '<bpsim:LogNormalDistribution scale="8" shape="3"/>');
 const r = conformance.validate(oldLoan);
 assert.deepEqual(r.errors.map(e => [e.code, e.path.split('/').pop()]), [['value-enumeration', '@timeUnit'], ['attribute-unknown', '@scale'], ['attribute-unknown', '@shape'], ['element-unexpected', 'bpmndi:BPMNDiagram']]);
 assert.deepEqual(conformance.validate(before(ticket)).errors.map(e => e.code), ['element-unexpected']);
});

test('BPMN conformance: recognised but uncovered elements are listed in notCovered with path and line and do not change conforms', () => {
 const choreography = edit('  <bpmndi:BPMNDiagram', '  <bpmn:choreography id="Ch"><bpmn:choreographyTask id="CT" initiatingParticipantRef="X"/></bpmn:choreography>\n  <bpmndi:BPMNDiagram');
 const r = conformance.validate(choreography);
 assert(r.conforms, summary(r)); assert.deepEqual(r.notCovered.map(n => [n.path, n.line, n.element, n.namespace]), [['/bpmn:definitions/bpmn:choreography', 13, 'bpmn:choreography', 'http://www.omg.org/spec/BPMN/20100524/MODEL']]);
 assert.match(r.notCovered[0]!.reason, /recognised in their places but not checked/);
 // A BPSim element placed where BPSim declares nothing top-level is skipped by lax extension processing: listed, never silently passed.
 const loose = edit('<wl:step id="t"/>', '<bpsim:Scenario id="Loose"/>'), l = conformance.validate(loose);
 assert(l.conforms, summary(l)); assert.deepEqual(l.notCovered.map(n => [n.path, n.line, n.element]), [[PROCESS + '/bpmn:task/bpmn:extensionElements/bpsim:Scenario', 5, 'bpsim:Scenario']]);
 // An uncovered element's ids still satisfy references; it is never treated as invalid either.
 const referenced = choreography.replace('bpmnElement="P"', 'bpmnElement="CT"'); assert(conformance.validate(referenced).conforms);
 assert.equal(conformance.validate(choreography.replace('<bpmn:choreography id="Ch">', '<bpmn:choreography id="Ch" bogus="1">')).conforms, true, 'uncovered content is not checked');
});

test('BPMN conformance: wildlands process validate-bpmn prints the report and exits 0 when the file conforms and 2 when it does not', () => {
 const cli = path.join(__dirname, 'tools/wildlands-cli.cjs'); assert(fs.existsSync(cli), 'build the CLI first');
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bpmn-conformance-'));
 try {
  const call = (args: string[], code: number) => { const p = spawnSync(process.execPath, [cli, 'process', ...args], {cwd: dir, encoding: 'utf8'}); assert.equal(p.status, code, args.join(' ') + p.stderr + p.stdout); return JSON.parse(p.stdout) as Record<string, any>; };
  const ok = call(['validate-bpmn', '--input', path.join(EXAMPLES, 'loan-application.bpmn')], 0);
  assert.deepEqual(Object.keys(ok), ['ok', 'protocolVersion', 'input', 'conforms', 'errors', 'notCovered', 'unchecked', 'checked', 'rules']);
  assert.deepEqual([ok.ok, ok.protocolVersion, ok.conforms, ok.errors, ok.notCovered, ok.rules], [true, 1, true, [], [], {bpmn: '2.0', bpsim: '1.0'}]); assert(ok.checked > 300);
  fs.writeFileSync(path.join(dir, 'bad.bpmn'), VIOLATIONS[9]![1]);
  const bad = call(['validate-bpmn', '--input', 'bad.bpmn'], 2);
  assert.deepEqual([bad.ok, bad.code, bad.conforms], [false, 'process-bpmn-nonconforming', false]); assert.deepEqual(Object.keys(bad.errors[0]).sort(), ['code', 'line', 'message', 'path']);
  assert.equal(bad.errors[0].code, 'value-enumeration'); assert.equal(bad.errors[0].line, 14);
  assert.match(call(['validate-bpmn'], 2).errors[0], /Missing --input/); assert.match(call(['validate-bpmn', '--input', 'bad.bpmn', '--output', 'x.json'], 2).errors[0], /Unknown or duplicate option: --output/);
  assert.equal(call(['validate-bpmn', '--input', 'missing.bpmn'], 2).code, 'process-operation-failed');
  const discover = call(['discover'], 0); assert(discover.operations.some((o: {id: string; options: string[]}) => o.id === 'validate-bpmn' && o.options.join() === '--input'));
 } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

test('BPMN conformance: a large BPSim export (16 maximum-size processes in one file) is validated within a bounded time', () => {
 // A definition holds at most 128 steps, so the large file joins the BPSim exports of 16 of them: their processes, diagrams and scenarios.
 const part = (k: number) => {
  const id = (s: string) => `c${k}-${s}`, steps = [stepOf(id('start'), 'start', 0), ...Array.from({length: 126}, (_, i) => stepOf(id('t' + i), 'task', i + 1, {duration: 1 + i % 7, description: `Step ${i} of copy ${k}: check & <record> "the" result. `.repeat(4)})), stepOf(id('end'), 'end', 127)];
  const xml = bpmn.export({...define(steps, steps.slice(1).map((s, i) => flowOf(steps[i]!.id, s.id))), id: 'big-' + k, start: id('start')}, {bpsim: true}).replace(/(Diagram|Plane)_1"/g, `$1_${k}"`);
  return {head: xml.slice(0, xml.indexOf('  <bpmn:process')), process: /<bpmn:process[\s\S]*<\/bpmn:process>/.exec(xml)![0], diagram: /<bpmndi:BPMNDiagram[\s\S]*<\/bpmndi:BPMNDiagram>/.exec(xml)![0], relationship: /<bpmn:relationship[\s\S]*<\/bpmn:relationship>/.exec(xml)![0]};
 };
 const parts = Array.from({length: 16}, (_, k) => part(k)), xml = parts[0]!.head + ['process', 'diagram', 'relationship'].flatMap(key => parts.map(p => p[key as 'process'])).join('\n') + '\n</bpmn:definitions>\n';
 assert(xml.length > 2 * 1024 * 1024, String(xml.length));
 const t = process.hrtime.bigint(), r = conformance.validate(xml), ms = Number(process.hrtime.bigint() - t) / 1e6;
 assert(r.conforms, summary(r)); assert(r.checked > 16 * 126 * 8, String(r.checked)); assert(ms < 5000, 'validation took ' + ms.toFixed(0) + ' ms');
});

test('XML reader positions are opt-in: plain parsing keeps the five node fields and positions add line, name and scope', () => {
 const xml = (globalThis as unknown as {LWProcessXml: LWProcessXml.Api}).LWProcessXml, source = '<a xmlns:p="u">\n <p:b x="1"/>\n\n <c/></a>';
 const plain = xml.parse(source); assert.deepEqual(Object.keys(plain), ['ns', 'local', 'attrs', 'children', 'text']); assert.deepEqual(Object.keys(plain.children[0]!), ['ns', 'local', 'attrs', 'children', 'text']);
 const located = xml.parse(source, {positions: true});
 assert.deepEqual(located.children.map(c => [c.line, c.name, c.ns, c.scope.p]), [[2, 'p:b', 'u', 'u'], [4, 'c', '', 'u']]); assert.equal(located.line, 1);
 assert.deepEqual(JSON.parse(JSON.stringify(plain)), JSON.parse(JSON.stringify(located, (k, v) => k === 'line' || k === 'name' || k === 'scope' ? undefined : v)));
});
