/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-bpmn-conformance-schema.ts" />
/**
 * LWProcessBpmnSchema, the compiled rules of the BPMN conformance check (part of the business-process-analysis suite): the rule
 * tables compile once into declarations with their substitution groups, derived types and simple types, and content matching
 * assigns children left to right and reports where a content model stops matching and what it expected there.
 */
import assert from 'node:assert/strict';
import './process-sdk.cjs';
import {test} from './test-process-helpers.cjs';
const S = (globalThis as unknown as {LWProcessBpmnSchema: LWProcessBpmnSchema.Api}).LWProcessBpmnSchema;
const XML = (globalThis as unknown as {LWProcessXml: LWProcessXml.Api}).LWProcessXml;
const MODEL = 'http://www.omg.org/spec/BPMN/20100524/MODEL', BPSIM = 'http://www.bpsim.org/schemas/1.0';
type Particle = LWProcessBpmnSchema.Particle;
type Node = LWProcessXml.Located;

test('The conformance schema compiles the rule tables once into declarations, groups and derived types', () => {
 const rules = S.rules();
 assert.equal(S.rules(), rules, 'the rules are compiled once and reused');
 assert.deepEqual([...rules.known].sort(), [BPSIM, 'http://www.omg.org/spec/BPMN/20100524/DI', MODEL,
  'http://www.omg.org/spec/DD/20100524/DC', 'http://www.omg.org/spec/DD/20100524/DI'].sort());
 const decl = (ns: string, local: string) => rules.decls.get(S.key(ns, local))!;
 const task = decl(MODEL, 'userTask'), flowElement = decl(MODEL, 'flowElement');
 assert.equal(task.label, 'bpmn:userTask');
 assert.equal(task.typeName, 'tUserTask');
 assert.equal(task.head, 'bpmn:flowElement');
 assert(flowElement.members.has(task) && flowElement.members.has(decl(MODEL, 'sequenceFlow')), 'a group admits its members');
 assert.equal(decl(MODEL, 'gateway').abstract, true, 'an abstract head is not a member of its own group');
 assert.equal(decl(MODEL, 'gateway').members.has(decl(MODEL, 'gateway')), false);
 assert.equal(decl(MODEL, 'choreography').covered, false, 'choreography is recognised but not covered');
 assert.equal(decl(BPSIM, 'BPSimData').typeName, '_Data');
 const model = rules.byPrefix.get('bpmn')!, type = S.typeOf(model, 'tUserTask');
 assert(!S.isSimple(type));
 const chain: string[] = [];
 for (let t: LWProcessBpmnSchema.Type | undefined = type; t; t = t.base) chain.push(t.label);
 assert.deepEqual(chain, ['bpmn:tUserTask', 'bpmn:tTask', 'bpmn:tActivity', 'bpmn:tFlowNode', 'bpmn:tFlowElement', 'bpmn:tBaseElement']);
 assert(type.attrs.has('implementation') && type.attrs.has('name') && type.attrs.has('id'), 'attributes are inherited');
 assert.equal(type.open, 'lax');
 assert.deepEqual(S.typeOf(model, 'boolean'), {simple: 'boolean', table: model});
 assert(S.isSimple(S.typeOf(model, 'GatewayDirection')), 'a table enumeration is a simple type');
 assert.throws(() => S.typeOf(model, 'tNoSuchType'), /unknown type tNoSuchType/);
});

test('The conformance schema matches children left to right and reports where a content model stops matching', () => {
 const rules = S.rules(), model = rules.byPrefix.get('bpmn')!;
 const content = (name: string) => (S.typeOf(model, name) as LWProcessBpmnSchema.Type).content;
 const accepts = (p: Particle, n: Node) => {
  const global = rules.decls.get(S.key(n.ns, n.local));
  if (p.k === 'el') return !!global && p.decl.members.has(global);
  if (p.k === 'local') return n.ns === p.ns && n.local === p.local;
  return p.k === 'any' && (p.not === null || n.ns !== '' && n.ns !== p.not);
 };
 const kids = (inner: string) => XML.parse(`<bpmn:x xmlns:bpmn="${MODEL}">${inner}</bpmn:x>`, {positions: true}).children;
 const flow = S.match(content('tSequenceFlow'), kids('<bpmn:documentation/><bpmn:conditionExpression/>'), accepts);
 assert.equal(flow.ok, true);
 assert.deepEqual(flow.assign.map(p => p?.k), ['el', 'local']);
 const swapped = S.match(content('tSequenceFlow'), kids('<bpmn:conditionExpression/><bpmn:documentation/>'), accepts);
 assert.equal(swapped.ok, false);
 assert.equal(swapped.at, 1, 'the documentation after the condition is where matching stops');
 const missing = S.match(content('tAssignment'), [], accepts);
 assert.equal(missing.ok, false);
 assert.equal(missing.at, 0);
 assert(missing.expected.has('bpmn:from'), [...missing.expected].join('; '));
 const process = S.match(content('tProcess'), kids('<bpmn:task/><bpmn:laneSet/>'), accepts);
 assert.equal(process.ok, false, 'a laneSet cannot follow flow elements');
 const group = content('tProcess').find(p => p.k === 'el' && p.decl.local === 'flowElement')!;
 assert.equal(S.labelOf(group), 'bpmn:flowElement (or an element of its group)');
});
