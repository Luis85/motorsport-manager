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
const report = {suite: 'business-process-bpmn', passed: results.filter(r => r.passed).length, total: results.length, results};
fs.writeFileSync(path.join(__dirname, 'process-bpmn-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`${report.passed}/${report.total} process BPMN checks passed`); for (const r of results) if (!r.passed) console.error(r.name, r.error);
if (report.passed !== report.total) process.exitCode = 1;
