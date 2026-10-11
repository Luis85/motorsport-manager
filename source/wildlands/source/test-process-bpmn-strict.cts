/// <reference path="./process-contracts.d.ts" />
/**
 * Strict reading and exact writing of the Wildlands BPMN extension (part of the business-process-bpmn suite, entry
 * test-process-bpmn.cts; they register right after the extension round trips in test-process-bpmn-extensions.cts): unknown or
 * invalid extension attributes, elements and values are rejected instead of coerced, and export keeps descriptions and empty
 * containers exactly, writes only safe standard expressions and refuses text XML 1.0 cannot carry.
 */
import assert from 'node:assert/strict';
import {catalog, bpmn} from './process-sdk.cjs';
import {test, stepOf, flowOf, cond, define} from './test-process-bpmn-helpers.cjs';

test('BPMN import rejects unknown or invalid Wildlands extension attributes, elements and values instead of coercing them', () => {
 const d = define([
  stepOf('start', 'start', 0),
  stepOf('t', 'task', 1, {
   duration: 3, resources: {crew: 1}, set: {done: true}, instances: {count: 3, mode: 'sequential'},
   deadline: {after: 5, mode: 'escalate', flow: 'late'},
  }),
  stepOf('gate', 'decision', 2),
  stepOf('end', 'end', 3),
  stepOf('alert', 'task', 2, {duration: 1}),
  stepOf('end2', 'end', 3)],
 [
  flowOf('start', 't'), flowOf('t', 'gate'), flowOf('gate', 'end', cond({field: 'x', op: 'eq', value: 1})),
  {id: 'gate-end-b', from: 'gate', to: 'end'}, {id: 'late', from: 't', to: 'alert', on: 'deadline'}, flowOf('alert', 'end2')],
 {x: 1});
 d.resources = [{id: 'crew', name: 'Crew', capacity: 2, costPerMinute: 1}];
 const xml = bpmn.export(d), back = bpmn.analyze(xml);
 assert(back.ok, JSON.stringify(back.rejections));
 assert.equal(catalog.fingerprint(back.definition!), catalog.fingerprint(d));
 const bad = (from: string, to: string, message: RegExp) => {
  assert(xml.includes(from), from);
  const r = bpmn.analyze(xml.replace(from, to));
  assert.equal(r.definition, undefined, to);
  assert.match(r.rejections.map(x => x.message).join('\n'), message, to);
 };
 bad('mode="escalate"', 'mode="esclate"', /Deadline Boundary_t: mode "esclate" must be interrupt or escalate\./);
 bad('<wl:deadline mode="escalate"', '<wl:deadline bogus="1" mode="escalate"', /Deadline Boundary_t deadline: unknown attribute bogus\./);
 bad('mode="sequential"', 'mode="sequental"', /Step Activity_t instances: mode "sequental" must be parallel or sequential\./);
 bad('<wl:instances count="3"', '<wl:instances size="2" count="3"', /Step Activity_t instances: unknown attribute size\./);
 bad('<wl:when field="x" op="eq"', '<wl:when colour="red" field="x" op="eq"', /Flow Flow_gate-end: unknown attribute colour\./);
 bad('<wl:when field="x" op="eq"', '<wl:when field="x" op="equals"', /Flow Flow_gate-end: op "equals" must be eq or ne or gt or gte or lt or lte\./);
 bad('op="eq" type="number" value="1"', 'op="eq" type="integer" value="1"', /Value type "integer" must be string, number, boolean or null\./);
 bad('type="boolean" value="true"', 'type="boolean" value="yes"', /A boolean value must be true or false, not "yes"\./);
 bad('<wl:step id="t"', '<wl:step colour="red" id="t"', /Step Activity_t step: unknown attribute colour\./);
 bad('<wl:step id="t" duration="3"/>', '<wl:step id="t" duration="3.5"/>', /Step Activity_t: duration "3.5" must be a whole number\./);
 bad('<wl:scene id="scene-t"', '<wl:widget/><wl:scene id="scene-t"', /Step Activity_t: unknown Wildlands element widget\./);
 bad('<wl:scene id="scene-t" x="12"', '<wl:scene id="scene-t" x="twelve"', /Step Activity_t scene: x "twelve" must be a number\./);
 bad(
  '<wl:set name="done" type="boolean" value="true"/>',
  '<wl:set name="done" type="boolean" value="true"><wl:note/></wl:set>',
  /Step Activity_t set: unknown element note\./);
 bad('<wl:demand quantity="1"/>', '<wl:demand quantity="1" share="2"/>', /Step Activity_t performer demand: unknown attribute share\./);
 bad(
  '<wl:resource id="crew" capacity="2"',
  '<wl:resource id="crew" kind="robot" capacity="2"',
  /Resource Resource_crew: kind "robot" must be people or machine or system\./);
 bad('<wl:flow id="late"/>', '<wl:flow id="late" on="deadline"/>', /Flow Flow_late flow: unknown attribute on\./);
 bad('<wl:lane resource="crew"/>', '<wl:lane resource="crew" colour="red"/>', /Lane Lane_crew lane: unknown attribute colour\./);
 bad('<wl:process id="timed" revision="0"/>', '<wl:process id="timed" revision="0" owner="x"/>', /Process process: unknown attribute owner\./);
 bad('<wl:data name="x" type="number" value="1"/>', '<wl:data name="x" type="number" value="1" unit="m"/>', /Arrival 1 data: unknown attribute unit\./);
 bad(
  '<wl:process id="timed" revision="0"/>',
  '<wl:process id="timed" revision="0" empty="steps"/>',
  /Process: empty "steps" must name one of track, sipoc, suppliers, customers\./);
});

test('BPMN export keeps descriptions and empty containers exactly, writes only safe standard expressions and refuses text XML cannot carry', () => {
 const d = define([
  stepOf('start', 'start', 0),
  stepOf('t', 'task', 1, {duration: 2, description: '', set: {}, needs: [], resources: {}, outputs: [], draws: []}),
  stepOf('gate', 'decision', 2),
  stepOf('end', 'end', 3)],
 [
  flowOf('start', 't'), flowOf('t', 'gate'), flowOf('gate', 'end', cond({field: 'note', op: 'eq', value: 'it\'s "x"'})),
  {id: 'gate-end-b', from: 'gate', to: 'end'}],
 {note: 'a'});
 Object.assign(d, {description: '  padded\nline\twith tab\r\n', track: [], sipoc: {suppliers: []}});
 d.arrivals[0]!.draws = [];
 d.steps[3]!.description = 'Tab\tand quotes \'"';
 const xml = bpmn.export(d), back = bpmn.analyze(xml);
 assert(back.ok && !back.warnings.length, JSON.stringify([back.warnings, back.diagnostics]));
 assert.deepEqual(back.definition, d);
 assert.equal(catalog.fingerprint(back.definition!), catalog.fingerprint(d));
 assert.equal(bpmn.export(back.definition!), xml);
 assert.match(xml, /<wl:step id="t" duration="2" empty="set resources needs outputs draws"\/>/);
 assert.match(xml, /<wl:process id="timed" revision="0" empty="track suppliers"\/>/);
 assert.match(xml, /<wl:arrival [^>]*empty="draws">/);
 // A carriage return in text and tabs or line breaks in attributes travel as references, so a conforming reader cannot normalise them away.
 assert(xml.includes('<bpmn:documentation>  padded\nline\twith tab&#13;\n</bpmn:documentation>'));
 assert(xml.includes('<bpmn:documentation></bpmn:documentation>'));
 const named = bpmn.export({...d, name: 'Two\nlines\tand\rreturn'});
 assert(named.includes('name="Two&#10;lines&#9;and&#13;return"'));
 assert.equal(bpmn.import(named).definition!.name, 'Two\nlines\tand\rreturn');
 // Text holding both quote kinds has no standard expression (the extension carries it); one quote kind uses the other as delimiter.
 assert.doesNotMatch(xml, /conditionExpression[^>]*>\$\{note/);
 const quoted = (value: string) => /<bpmn:conditionExpression[^>]*>([^<]*)</.exec(bpmn.export({
  ...d,
  flows: d.flows.map(f => f.id === 'gate-end' ? {...f, when: cond({field: 'note', op: 'eq', value})} : f),
 }))?.[1];
 assert.equal(quoted("it's"), '${note == "it\'s"}');
 assert.equal(quoted('say "hi"'), '${note == \'say "hi"\'}');
 // A field named like a literal, an operator word or and/or/not gets no expression; the extension stays exact and nothing disagrees.
 for (const field of ['and', 'or', 'not', 'eq', 'gte', 'le', 'true', 'null']) {
  const words = {
   ...d,
   flows: d.flows.map(f => f.id === 'gate-end' ? {...f, when: cond({field, op: 'eq', value: 1})} : f),
   arrivals: [{at: 0, count: 1, interval: 0, data: {[field]: 1}}],
  };
  const out = bpmn.export(words), again = bpmn.analyze(out);
  assert.doesNotMatch(out, /<bpmn:conditionExpression/, field);
  assert(again.ok && !again.warnings.length, field);
  assert.equal(catalog.fingerprint(again.definition!), catalog.fingerprint(words), field);
 }
 const other = {...d, flows: d.flows.map(f => f.id === 'gate-end' ? {...f, when: cond({field: 'note', op: 'eq', valueField: 'or'})} : f)};
 assert.doesNotMatch(bpmn.export(other), /<bpmn:conditionExpression/);
 // C0 control characters other than tab, line feed and carriage return cannot be written as XML 1.0 at all: export refuses them by name.
 for (const ch of ['\u0001', '\u001f', '\u000b'])
  assert.throws(
   () => bpmn.export({...d, steps: d.steps.map(s => s.id === 'gate' ? {...s, name: 'Gate' + ch + 'one'} : s)}),
   /contains the character U\+00(01|1F|0B), which XML 1\.0 cannot represent; remove it before exporting\./);
 assert.throws(() => bpmn.export({...d, description: 'lone \ud800 surrogate'}), /U\+D800/);
});
