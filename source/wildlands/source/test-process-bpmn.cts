/// <reference path="./process-contracts.d.ts" />
/**
 * Entry of the business-process-bpmn suite. Its companions register first, in this order: the extension round trips
 * (test-process-bpmn-extensions.cts), extension strictness (test-process-bpmn-strict.cts), conformance
 * (test-process-bpmn-conformance.cts), foreign BPMN import (test-process-bpmn-import.cts), and standard export with the
 * pinned example files (test-process-bpmn-export.cts). This file then checks the XML reader, BPMN export of every agency
 * demo, BPSim WaitTime and export, and the import bounds, and writes one result file.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {catalog, bpmn} from './process-sdk.cjs';
import {results, test, stepOf, flowOf, define, flow} from './test-process-bpmn-helpers.cjs';
import {S, E, fdoc, chain, sim, ep, time, num, stepIn, whenIn, timerDef} from './test-process-bpmn-helpers.cjs';
import './test-process-bpmn-extensions.cjs';
import './test-process-bpmn-strict.cjs';
import './test-process-bpmn-conformance.cjs';
import './test-process-bpmn-import.cjs';
import './test-process-bpmn-export.cjs';

test('The XML reader stays linear on adversarial namespace and attribute input and refuses characters XML 1.0 forbids', () => {
 const xml = (globalThis as unknown as {LWProcessXml: LWProcessXml.Api}).LWProcessXml, timed = (source: string) => {
  const t = process.hrtime.bigint();
  try {
   xml.parse(source);
  } catch {
   /* malformed on purpose */
  }
  return Number(process.hrtime.bigint() - t) / 1e6;
 };
 // About 200 KiB each: thousands of inherited prefixes over thousands of elements (a copied scope per element was quadratic),
 // and a 200 KiB attribute run without '=' (a backtracking pattern was quadratic).
 const prefixes = Array.from({length: 4000}, (_, i) => ` xmlns:p${i}="u${i}"`).join(''), scoped = '<r' + prefixes + '>' + '<c/>'.repeat(20000) + '</r>';
 for (const [label, source] of [
  ['inherited namespace scope', scoped], ['attribute name without =', '<a ' + 'b'.repeat(200 * 1024) + '/>'],
  ['unterminated attribute value', '<a b="' + 'x'.repeat(200 * 1024)],
  ['many attributes', '<a' + Array.from({length: 12000}, (_, i) => ` a${i}='v'`).join('') + '/>'],
 ] as const) {
  assert(source.length > 100 * 1024, label);
  const ms = timed(source);
  assert(ms < 2000, label + ' took ' + ms.toFixed(0) + ' ms');
 }
 assert.equal(xml.parse(scoped).children.length, 20000);
 assert.equal(xml.parse('<a xmlns:p="u"><b xmlns:q="v"><p:c/></b><q:d xmlns:q="w"/></a>').children[1]!.ns, 'w');
 assert.throws(() => xml.parse('<a xmlns:p="u"><b xmlns:q="v"/><q:c/></a>'), /Undeclared namespace prefix: q/);
 assert.throws(() => xml.parse('<a><constructor:b/></a>'), /Undeclared namespace prefix: constructor/);
 assert.throws(() => xml.parse('<a b c="1"/>'), /Malformed attributes on a\./);
 assert.throws(() => xml.parse('<a b="1" b="2"/>'), /Duplicate attribute: b/);
 assert.deepEqual(xml.parse('<a b = "1"c=\'2\' />').attrs, {b: '1', c: '2'});
 for (const bad of ['<a>\u0001</a>', '<a b="\u001f"/>', '<a>￿</a>'])
  assert.throws(() => xml.parse(bad), /contains the character U\+[0-9A-F]{4}, which XML 1\.0 does not allow/);
 for (const bad of ['<a>&#1;</a>', '<a>&#x1F;</a>', '<a b="&#xFFFE;"/>']) assert.throws(() => xml.parse(bad), /Invalid character reference/);
 assert.equal(xml.parse('<a b="&#9;&#10;&#13;">x&#13;y</a>').attrs.b, '\t\n\r');
 assert.equal(xml.parse('<a>x&#13;y</a>').text, 'x\ry');
});

test('BPMN export of every agency demo and example is well-formed and re-imports with and without BPSim to the same definition without warnings', () => {
 const xml = (globalThis as unknown as {LWProcessXml: LWProcessXml.Api}).LWProcessXml;
 const dir = path.resolve(__dirname, '../../../docs/concepts/agency-delivery/content');
 const defs: [string, LWProcess.Definition][] = fs.readdirSync(dir).filter(f => f.endsWith('.process.json')).sort()
  .map(f => [f, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as LWProcess.Definition]);
 for (const f of ['loan-application', 'support-ticket'])
  defs.push([f, bpmn.import(fs.readFileSync(path.join(__dirname, '..', 'examples', 'bpmn', f + '.bpmn'), 'utf8')).definition!]);
 assert(defs.length >= 7, String(defs.length));
 for (const [name, d] of defs) for (const withSim of [false, true]) {
  const out = bpmn.export(d, {bpsim: withSim}), tree = xml.parse(out);
  assert.equal(tree.local, 'definitions', name);
  const back = bpmn.analyze(out);
  assert(back.ok, name + JSON.stringify(back.rejections));
  assert.deepEqual(back.warnings, [], name + ' bpsim ' + withSim);
  assert.equal(catalog.fingerprint(back.definition!), catalog.fingerprint(d), name);
 }
 // Nested same-kind and one-item combinators compare structurally with their standard expression, so no disagreement is reported.
 const gate = (when: LWProcess.When) => define(
  [stepOf('start', 'start', 0), stepOf('gate', 'decision', 1), stepOf('x', 'end', 2), stepOf('y', 'end', 2)],
  [flowOf('start', 'gate'), {id: 'c1', from: 'gate', to: 'x', when}, {id: 'fb', from: 'gate', to: 'y'}],
  {a: 1, b: 2, c: 3});
 for (const when of [
  {all: [{all: [{field: 'a', op: 'eq', value: 1}, {field: 'b', op: 'eq', value: 2}]}, {field: 'c', op: 'eq', value: 3}]},
  {any: [{field: 'a', op: 'eq', value: 1}]},
  {not: {any: [{field: 'a', op: 'gt', valueField: 'b'}]}},
 ] as LWProcess.When[]) {
  const back = bpmn.analyze(bpmn.export(gate(when)));
  assert(back.ok && !back.warnings.length, JSON.stringify([when, back.warnings]));
  assert.deepEqual(whenIn(back.definition!, 'c1'), when);
 }
 // The BPSim scenario Duration is the span from minute 0, so a stream that starts later still ends at its until minute for BPSim-only readers.
 const later = define(
  [stepOf('start', 'start', 0), stepOf('t', 'task', 1, {duration: 3}), stepOf('end', 'end', 2)],
  [flowOf('start', 't'), flowOf('t', 'end')]);
 later.arrivals = [{at: 30, until: 300, interval: 20, data: {}}];
 const sim2 = bpmn.export(later, {bpsim: true});
 assert.match(sim2, /<bpsim:Duration><bpsim:DurationParameter value="PT300M"\/><\/bpsim:Duration>/);
 const bpsimOnly = bpmn.analyze(sim2.replace(
  /<bpmn:extensionElements>(?:(?!<\/bpmn:extensionElements>)[\s\S])*?<\/bpmn:extensionElements>/g,
  m => /bpsim:/.test(m) ? m : '')).definition!;
 assert.deepEqual(bpsimOnly.arrivals, [{at: 0, until: 300, interval: 20, data: {}}]);
 assert.equal(bpsimOnly.arrivals[0]!.until, later.arrivals[0]!.until);
});

test('BPSim WaitTime on a timer boundary event replaces its duration and keeps a distribution as the deadline timing', () => {
 const boundary = fdoc(
  S + '<bpmn:task id="K"/><bpmn:boundaryEvent id="B" attachedToRef="K" cancelActivity="false">' + timerDef('PT5M')
  + '</bpmn:boundaryEvent><bpmn:endEvent id="E2"/>' + E + chain('S', 'K', 'E') + chain('B', 'E2'),
  '%');
 const read = (wait: string) => bpmn.analyze(boundary.replace('%', wait ? sim(ep('B', time(wait, 'WaitTime'))) : ''));
 assert.deepEqual(stepIn(read('').definition!, 'k').deadline, {mode: 'escalate', flow: 'b-e2', after: 5});
 const random = read('<bpsim:UniformDistribution min="10" max="50"/>');
 assert.deepEqual(stepIn(random.definition!, 'k').deadline, {mode: 'escalate', flow: 'b-e2', timing: {dist: 'uniform', min: 10, max: 50}});
 assert.deepEqual(random.mapping.filter(m => m.id === 'B').map(m => [m.type, m.how]), [
  ['bpsim:WaitTime', 'uniform distribution -> deadline timing (mean 30 min); replaces the timer duration'],
  ['boundaryEvent', 'non-interrupting timer boundary -> deadline (escalate) on K'],
 ]);
 const constant = read(num(12));
 assert.deepEqual(stepIn(constant.definition!, 'k').deadline, {mode: 'escalate', flow: 'b-e2', after: 12});
 assert(constant.mapping.some(m => m.id === 'B' && /constant -> deadline after \(mean 12 min\)/.test(m.how)));
});

test('BPMN import analysis stays bounded: an oversized file is rejected early in plain words, files within the bound fold quickly, '
 + 'and list limits name the limit and the count', () => {
 const chainOf = (tasks: number, events = 0) => {
  const parts = [S];
  let prev = 'S';
  for (let i = 0; i < tasks; i++) {
   parts.push(`<bpmn:task id="T${i}" name="Task ${i}"/>`, flow('F' + i, prev, 'T' + i));
   prev = 'T' + i;
   for (let k = 0; k < events; k++) {
    const id = `X${i}_${k}`;
    parts.push(`<bpmn:intermediateThrowEvent id="${id}"/>`, flow('G' + id, prev, id));
    prev = id;
   }
  }
  parts.push(E, flow('FE', prev, 'E'));
  return fdoc(parts.join(''));
 };
 const timed = (source: string) => {
  const t = process.hrtime.bigint(), r = bpmn.analyze(source);
  return {r, ms: Number(process.hrtime.bigint() - t) / 1e6};
 };
 // 40,000 tasks (about 4.7 MiB, inside the 8 MiB and 200,000-node reader limits) once took about a minute;
 // the size is now refused before any analysis that grows with it.
 const huge = chainOf(40000);
 assert(huge.length > 4 * 1024 * 1024 && huge.length < 8 * 1024 * 1024, String(huge.length));
 const big = timed(huge);
 assert(big.ms < 5000, 'analysis took ' + big.ms.toFixed(0) + ' ms');
 const message = 'This process is too large to import: it has 40,002 flow nodes and 40,001 sequence flows, but a Wildlands process holds at most 128 '
  + 'steps and 256 flows. Import reads at most 512 flow nodes and 1,024 sequence flows, which leaves room for events and gateways that fold away; '
  + 'split the model into smaller processes.';
 assert.deepEqual(big.r.rejections, [{id: '', type: 'import', message}]);
 assert.deepEqual([big.r.ok, big.r.definition, big.r.mapping], [false, undefined, []]);
 // Within the bound: 360 pass-through events fold away through indexed flows and the written order of steps and flows is kept.
 const folded = timed(chainOf(120, 3)), d = folded.r.definition!;
 assert(folded.r.ok, JSON.stringify(folded.r.rejections));
 assert(folded.ms < 2000, 'analysis took ' + folded.ms.toFixed(0) + ' ms');
 assert.deepEqual([d.steps.length, d.flows.length, d.steps[1]!.name, d.flows[1]!.from, d.flows[1]!.to], [122, 121, 'Task 0', d.steps[1]!.id, d.steps[2]!.id]);
 assert.equal(folded.r.mapping.filter(m => m.how === 'pass-through event folded into its flows').length, 360);
 // A file that folds into more steps than a definition holds is told the limit and its own count.
 const over = bpmn.analyze(chainOf(150));
 assert.deepEqual([over.ok, over.rejections], [false, []]);
 assert.deepEqual(over.diagnostics.map(x => [x.path, x.message]), [['/steps', 'A process holds at most 128 steps; this one has 152.']]);
 const base = define([stepOf('start', 'start', 0), stepOf('end', 'end', 1)], [flowOf('start', 'end')]);
 const shape = (edit: (x: LWProcess.Definition) => void) => {
  const x = JSON.parse(JSON.stringify(base)) as LWProcess.Definition;
  edit(x);
  return catalog.validate(x).diagnostics.map(e => e.path + ': ' + e.message);
 };
 const many = <T,>(n: number, make: (i: number) => T) => Array.from({length: n}, (_, i) => make(i));
 assert.deepEqual(shape(x => { x.flows = many(257, i => ({id: 'f' + i, from: 'start', to: 'end'})); }),
  ['/flows: A process holds at most 256 flows; this one has 257.']);
 assert.deepEqual(shape(x => { x.resources = many(33, i => ({id: 'r' + i, name: 'R' + i, capacity: 1, costPerMinute: 0})); }),
  ['/resources: A process holds at most 32 resource pools; this one has 33.']);
 assert.deepEqual(shape(x => { x.arrivals = many(1500, () => ({at: 0, interval: 0, data: {}})); }),
  ['/arrivals: A process holds at most 32 arrival rules; this one has 1,500.']);
 assert.deepEqual(shape(x => { x.arrivals = []; x.steps = x.steps.slice(0, 1); }),
  ['/steps: A process needs at least 2 steps; this one has 1.', '/arrivals: A process needs at least 1 arrival rule; this one has 0.']);
 assert.deepEqual(shape(x => { x.track = many(7, i => ({field: 'f' + i})); }), ['/track: Array length is out of range: at most 6 entries, found 7.']);
});

test('BPMN export with BPSim carries the first arrival rule\'s constants, whole-number draws and the seed without the Wildlands extension, '
 + 'and names what only the extension carries', () => {
 const dir = path.resolve(__dirname, '../../../docs/concepts/agency-delivery/content');
 const load = (id: string) => JSON.parse(fs.readFileSync(path.join(dir, id + '.process.json'), 'utf8')) as LWProcess.Definition;
 // A tool that drops vendor extensions keeps only standard BPMN and BPSim.
 const block = /<bpmn:extensionElements>(?:(?!<\/bpmn:extensionElements>)[\s\S])*?<\/bpmn:extensionElements>/g;
 const strip = (x: string) => x.replace(block, m => /bpsim:/.test(m) ? m : '');
 const bare = (d: LWProcess.Definition) => {
  const x = strip(bpmn.export(d, {bpsim: true}));
  assert.doesNotMatch(x, /<wl:/);
  const r = bpmn.analyze(x);
  assert(r.definition, JSON.stringify(r.rejections));
  return r.definition!;
 };
 const agency = load('agency'), exported = bpmn.export(agency, {bpsim: true});
 assert.match(exported, /<bpsim:PropertyParameters>\s*<bpsim:Property name="needsRework"><bpsim:BooleanParameter value="false"\/><\/bpsim:Property>/);
 assert.match(exported, /<bpsim:Property name="priority"><bpsim:NumericParameter value="2"\/><\/bpsim:Property>\s*<\/bpsim:PropertyParameters>/);
 assert.deepEqual(bare(agency).arrivals, [{at: 0, count: 3, interval: 8, data: {needsRework: false, priority: 2}}]);
 const notes = bpmn.fidelity(agency, {bpsim: true});
 assert.equal(notes[0], 'BPSim carries arrival rule 1 of 2; rule 2 is only in the Wildlands extension.');
 assert.match(notes[1]!, /^Case fields and counters written by Discovery, Product design, Technical design, Implementation and 2 more steps are only in/);
 const release = load('delivery-release'), loan = load('loan-application');
 assert.deepEqual([bare(release).seed, bare(release).arrivals[0]!.draws], [7, [{field: 'mvpIncrements', kind: 'int', min: 6, max: 8}]]);
 assert.deepEqual([bare(loan).seed, bare(loan).arrivals[0]!.draws], [7, loan.arrivals[0]!.draws]);
 assert.deepEqual(bpmn.fidelity(loan, {bpsim: true}), ['Pool kinds of Credit engine, Automation are only in the Wildlands extension.']);
 assert.equal(bpmn.fidelity(load('customer-journey-webshop'), {bpsim: true})[0],
  'Case field intent of arrival rule 1 is only in the Wildlands extension; BPSim properties carry constants and whole-number ranges.');
 assert.match(bpmn.fidelity(loan)[0]!, /^Without BPSim, case arrivals, durations, probabilities, pool sizes and costs are only in the Wildlands extension/);
 // The extension seed wins over a different BPSim seed with a warning; a seed the engine cannot use is reported and ignored, never coerced.
 const seeded = bpmn.export(release, {bpsim: true}), head = 'baseTimeUnit="min" seed=';
 assert.match(seeded, /<bpsim:ScenarioParameters baseTimeUnit="min" seed="7"\/>/);
 assert.deepEqual(bpmn.analyze(seeded.replace(head + '"7"', head + '"9"')).warnings, ['BPSim seed 9 disagrees with the Wildlands seed 7; the extension wins.']);
 const odd = bpmn.analyze(strip(seeded).replace('seed="7"', 'seed="1.5"'));
 assert.equal(odd.definition!.seed, undefined);
 assert(odd.warnings.includes('BPSim seed "1.5" is not a whole number from 0 to 2147483647 and is ignored.'), JSON.stringify(odd.warnings));
});

test('The XML reader refuses DOCTYPE and entity declarations as markup tokens, not as text inside comments or CDATA', () => {
 const xml = (globalThis as unknown as {LWProcessXml: LWProcessXml.Api}).LWProcessXml;
 assert.equal(xml.parse('<a><!-- never <!DOCTYPE x> here --><![CDATA[<!ENTITY y "z">]]></a>').text, '<!ENTITY y "z">');
 const refused = ['<!DOCTYPE x [<!ENTITY a "b">]><x/>', '<?xml version="1.0"?><!-- fine --><!doctype x><x/>', '<a><!ENTITY b "c"></a>',
  '<a><!ATTLIST a b CDATA "c"></a>'];
 for (const bad of refused) assert.throws(() => xml.parse(bad), /DOCTYPE and entity declarations are not allowed\./, bad);
 assert.throws(() => xml.parse('<a><!x></a>'), /Invalid markup declaration\./);
 const text = 'Never paste <!DOCTYPE html> into a ticket';
 const doc = fdoc(S + `<bpmn:task id="T"><bpmn:documentation><![CDATA[${text}]]></bpmn:documentation></bpmn:task>` + E + chain('S', 'T', 'E'));
 assert.equal(bpmn.import(doc).definition!.steps.find(s => s.name === 'T')!.description, text);
});

const report = {suite: 'business-process-bpmn', passed: results.filter(r => r.passed).length, total: results.length, results};
fs.writeFileSync(path.join(__dirname, 'process-bpmn-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`${report.passed}/${report.total} process BPMN checks passed`);
for (const r of results) if (!r.passed) console.error(r.name, r.error);
if (report.passed !== report.total) process.exitCode = 1;
