/// <reference path="./process-bpmn-ext.ts" />
/// <reference path="./process-bpmn-bpsim.ts" />
/// <reference path="./process-bpmn-graph.ts" />
/**
 * What one foreign BPMN flow node becomes during import (LWProcessBpmnNodes). process-bpmn-graph.ts owns the collection of a
 * process and calls these per element: the element vocabulary (tasks, service tasks, gateways, containers, artifacts), the
 * role of each start, end, intermediate catch and intermediate throw event, ISO-8601 timer readings in business minutes, and
 * standard and multi-instance task loops. Every unsupported form is rejected, or dropped in drop mode, through the import
 * context with its own message; nothing is guessed. The Wildlands extension restores exact values where an export wrote them.
 */
declare namespace LWProcessBpmnNodes {
 type Item = LWProcessBpmnGraph.Item;
 type Ctx = LWProcessBpmnGraph.Ctx;
 /** Where `event` files a start or a (non-error) end event of the container being collected. */
 interface Sink {starts: Item[]; ends: Item[];}
 interface Api {
  /** Plain tasks, service-type tasks, inlined containers, gateway roles, and artifacts without simulation meaning. */
  PLAIN: readonly string[]; SERVICE: readonly string[]; CONTAINERS: readonly string[];
  GATEWAYS: Readonly<Record<string, Item['gateway']>>; ARTIFACTS: ReadonlySet<string>;
  /** The events `event` classifies: start, end, intermediate catch and intermediate throw events. */
  EVENTS: readonly string[];
  /** Local names of the event definitions of an element, e.g. ['timerEventDefinition']. */
  defs(n: LWProcessXml.Node): string[];
  /** Catch and boundary timers share one ISO-8601 reading: weeks (5 days), days and hours in business minutes. */
  isoMinutes(ctx: Ctx, text: string): number | undefined;
  /** Why a timer text is not a readable ISO-8601 duration. */
  notIso(text: string): string;
  /** A unique camelCase case field made from an element id and `suffix`; it is added to `taken`. */
  camel(xml: string, suffix: string, taken: Set<string>): string;
  /** A gateway's role: decision or fork; a complex gateway is rejected, or approximated as exclusive in drop mode. */
  gateway(ctx: Ctx, item: Item, gateway: NonNullable<Item['gateway']>): void;
  /** Classifies one of `EVENTS`; `bad` rejects (or drops) the element with the reason. */
  event(ctx: Ctx, item: Item, sink: Sink, bad: (why: string) => void): void;
  /** Task loops: the Wildlands instances extension, a multi-instance loop or a standard loop; `fields` holds generated case fields. */
  taskLoops(ctx: Ctx, item: Item, fields: Set<string>): void;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessBpmnExport: {vocabulary: LWProcessBpmn.Vocabulary}; LWProcessBpmnExt: LWProcessBpmnExt.Api;
  LWProcessBpmnBpsim: LWProcessBpmnBpsim.Api; LWProcessBpmnExpr: LWProcessBpmnExpr.Api; LWProcessBpmnNodes?: LWProcessBpmnNodes.Api};
 const {MODEL} = root.LWProcessBpmnExport.vocabulary;
 type X = LWProcessXml.Node;
 type Item = LWProcessBpmnGraph.Item;
 type Ctx = LWProcessBpmnGraph.Ctx;
 const ext = () => root.LWProcessBpmnExt;
 const kids = (n: X, local: string, ns?: string) => ext().kids(n, local, ns);
 const PLAIN = ['task', 'userTask', 'manualTask'], SERVICE = ['serviceTask', 'scriptTask', 'businessRuleTask', 'sendTask', 'receiveTask'];
 const GATEWAYS: Record<string, Item['gateway']> = {exclusiveGateway: 'exclusive', parallelGateway: 'parallel', inclusiveGateway: 'inclusive',
  eventBasedGateway: 'event', complexGateway: 'complex'};
 const CONTAINERS = ['subProcess', 'transaction', 'adHocSubProcess', 'callActivity'];
 const ARTIFACTS = new Set(['documentation', 'extensionElements', 'textAnnotation', 'association', 'group', 'dataObject', 'dataObjectReference',
  'dataStoreReference', 'dataStore', 'property', 'ioSpecification', 'category', 'categoryValue', 'auditing', 'monitoring', 'resourceRole',
  'correlationSubscription']);
 const EVENTS = ['startEvent', 'endEvent', 'intermediateCatchEvent', 'intermediateThrowEvent'];
 const defs = (n: X): string[] => n.children.filter(c => c.ns === MODEL && c.local.endsWith('EventDefinition')).map(c => c.local);
 /** 'timer, message' from event definition names. */
 const plain = (d: string[], separator: string) => d.map(x => x.replace('EventDefinition', '')).join(separator);
 const isoMinutes = (ctx: Ctx, text: string) => root.LWProcessBpmnBpsim.isoMinutes(text, {minutesPerDay: ctx.o.minutesPerDay,
  minutesPerHour: ctx.o.minutesPerHour, warn: ctx.warn});
 const notIso = (text: string) => 'duration "' + text.trim() + '" is not an ISO-8601 duration (PnW, PnD, PTnH, PTnM, PTnS or a combination such as '
  + 'PT1H30M; years and months have no business-minute meaning).';
 /** The single timer definition of an event: an ISO-8601 `timeDuration` read like a boundary timer; the Wildlands extension restores exact values. */
 function timerOf(ctx: Ctx, node: X, xmlId: string, item: Item): void {
  const list = node.children.filter(c => c.ns === MODEL && c.local === 'timerEventDefinition'), step = ext().first(node, 'step');
  const fail = (why: string) => ctx.unsupported(item, xmlId, 'intermediateCatchEvent', 'Timer ' + xmlId + ' is not supported: ' + why);
  const forms = list[0]!.children.filter(c => c.ns === MODEL), form = forms[0];
  if (step?.attrs.until !== undefined) {
   item.timer = {until: Number(step.attrs.until)};
   return;
  }
  if (forms.length !== 1) {
   fail('define exactly one timeDuration.');
   return;
  }
  if (form!.local !== 'timeDuration') {
   fail(form!.local + ' has no business-minute meaning; use an ISO-8601 timeDuration such as PT45M or PT1H30M.');
   return;
  }
  const minutes = isoMinutes(ctx, form!.text);
  if (minutes === undefined) {
   fail(notIso(form!.text));
   return;
  }
  item.timer = {duration: step?.attrs.duration !== undefined ? ext().whole(step.attrs, 'duration', 'Step ' + xmlId)! : minutes};
 }
 const camel = (xml: string, suffix: string, taken: Set<string>): string => {
  let base = xml.replace(/[^A-Za-z0-9]/g, '');
  base = (/^[A-Za-z]/.test(base) ? base : 'n' + base).replace(/^./, c => c.toLowerCase()).slice(0, 40) + suffix;
  let name = base, n = 2;
  while (taken.has(name)) name = base + n++;
  taken.add(name);
  return name;
 };
 function gateway(ctx: Ctx, item: Item, kind: NonNullable<Item['gateway']>): void {
  item.gateway = kind;
  item.kind = kind === 'parallel' || kind === 'inclusive' ? 'fork' : 'decision';
  if (kind !== 'complex') return;
  if (ctx.o.unsupported === 'drop') {
   ctx.warn('Complex gateway ' + item.xml + ' has no simulation semantics; it is approximated as an exclusive gateway.');
   item.gateway = 'exclusive';
   item.how = 'complex gateway approximated as an exclusive decision';
  } else {
   ctx.reject(item.xml, item.local, item.local + ' ' + item.xml + ' is not supported: complex gateways have no simulation semantics. '
    + 'Model the decision with exclusive or inclusive gateways.');
  }
 }
 const linkName = (node: X) => node.children.find(c => c.local === 'linkEventDefinition')?.attrs.name ?? '';
 function endEvent(ctx: Ctx, item: Item, d: string[], sink: LWProcessBpmnNodes.Sink, bad: (why: string) => void): void {
  const only = d.length === 1 ? d[0]! : '', xml = item.xml;
  const unsupported = ['compensateEventDefinition', 'cancelEventDefinition', 'conditionalEventDefinition', 'timerEventDefinition', 'linkEventDefinition'];
  item.kind = 'end';
  if (d.length > 1 || unsupported.includes(only)) bad('end events with ' + plain(d, ' + ') + ' semantics cannot be simulated.');
  else if (only === 'errorEventDefinition') {
   item.lost = true;
   ctx.warn('Error end event ' + xml + ' imports as an end with outcome "lost".');
  } else if (only === 'terminateEventDefinition') {
   ctx.warn('Terminate end event ' + xml + ' is a plain end: other parallel branches of the case are not cancelled.');
  }
  else if (only) ctx.warn('Event definitions on ' + xml + ' are ignored; it is a plain event.');
  if (!item.lost) sink.ends.push(item);
 }
 function catchEvent(ctx: Ctx, item: Item, d: string[], bad: (why: string) => void): void {
  const xml = item.xml, first = d[0];
  item.kind = 'timer';
  if (d.length !== 1) {
   bad('it needs exactly one event definition (timer, message, signal, conditional or link); ' + (d.join(', ') || 'no event definition') + ' found.');
  } else if (first === 'timerEventDefinition') timerOf(ctx, item.node, xml, item);
  else if (['messageEventDefinition', 'signalEventDefinition', 'conditionalEventDefinition'].includes(first!)) {
   item.wait = true;
   ctx.warn(first!.replace('EventDefinition', '') + ' catch event ' + xml + ' is simulated as a timer; message arrival is an assumption '
    + '(duration from BPSim WaitTime or the default).');
  } else if (first === 'linkEventDefinition') {
   item.kind = 'pass';
   item.link = 'catch';
   item.linkName = linkName(item.node);
  } else bad(first!.replace('EventDefinition', '') + ' catch events cannot be simulated.');
 }
 function throwEvent(ctx: Ctx, item: Item, d: string[], bad: (why: string) => void): void {
  item.kind = 'pass';
  if (!d.length || d.length === 1 && ['messageEventDefinition', 'signalEventDefinition', 'escalationEventDefinition'].includes(d[0]!)) {
   ctx.warn('Throw event ' + item.xml + (d.length ? ' (' + d[0]!.replace('EventDefinition', '') + ')' : '') + ' is folded into the flow; nothing is thrown.');
  } else if (d.length === 1 && d[0] === 'linkEventDefinition') {
   item.link = 'throw';
   item.linkName = linkName(item.node);
  } else bad(plain(d, ' + ') + ' throw events cannot be simulated.');
 }
 function event(ctx: Ctx, item: Item, sink: LWProcessBpmnNodes.Sink, bad: (why: string) => void): void {
  const d = defs(item.node), xml = item.xml;
  if (item.local === 'startEvent') {
   item.kind = 'start';
   sink.starts.push(item);
   if (!d.length) return;
   const triggered = d.includes('timerEventDefinition') || d.includes('messageEventDefinition') || d.includes('signalEventDefinition');
   ctx.warn(triggered ? 'Start event ' + xml + ' (' + plain(d, ', ') + ') imports as a plain start; arrivals come from BPSim or the default single case.'
    : 'Event definitions on ' + xml + ' are ignored; it is a plain event.');
  } else if (item.local === 'endEvent') endEvent(ctx, item, d, sink, bad);
  else if (item.local === 'intermediateCatchEvent') catchEvent(ctx, item, d, bad);
  else throwEvent(ctx, item, d, bad);
 }
 /** A multi-instance loop: a literal cardinality, a case field reference, or a data collection counted in a generated field. */
 function multiInstance(ctx: Ctx, item: Item, multi: X, fields: Set<string>): void {
  const mode = multi.attrs.isSequential === 'true' ? 'sequential' : 'parallel', card = kids(multi, 'loopCardinality')[0]?.text.trim() ?? '';
  const at = (m: string) => ctx.warn(m), name = 'Multi-instance ' + item.xml;
  const unsupported = (why: string) => ctx.unsupported(item, item.xml, item.local, item.local + ' ' + item.xml + ' is not supported: ' + why);
  if (kids(multi, 'completionCondition')[0]) at('The completion condition of multi-instance ' + item.xml + ' is ignored: every item runs.');
  const lit = /^\d+$/.test(card) ? Number(card) : undefined, ref = /^[$#]?\{?\s*([A-Za-z_]\w*)\s*\}?$/.exec(card)?.[1];
  if (lit !== undefined) {
   if (lit < 1) {
    unsupported('multi-instance cardinality must be at least 1.');
    return;
   }
   if (lit === 1) {
    at(name + ' has cardinality 1 and runs once.');
    return;
   }
   if (lit > 50) at(name + ' cardinality ' + lit + ' is limited to 50 items.');
   item.instances = {count: Math.min(50, lit), mode};
  } else if (ref && root.LWProcessBpmnExpr.isField(ref)) {
   fields.add(ref);
   item.instances = {field: ref, mode};
   at(name + ' reads its item count from case field "' + ref + '"; arrivals must set it to 1..50.');
  } else if (kids(multi, 'loopDataInputRef')[0] || kids(multi, 'inputDataItem')[0] || card) {
   const field = camel(item.xml, 'Items', fields);
   item.instances = {field, mode};
   at(name + ' iterates a collection; its item count is read from the generated case field "' + field + '" that arrivals must set to 1..50.');
  } else unsupported('the multi-instance loop has neither a cardinality nor a data collection.');
 }
 function taskLoops(ctx: Ctx, item: Item, fields: Set<string>): void {
  const node = item.node, multi = kids(node, 'multiInstanceLoopCharacteristics')[0], standard = kids(node, 'standardLoopCharacteristics')[0];
  if (multi && standard) {
   ctx.reject(item.xml, item.local, item.local + ' ' + item.xml + ' declares both a standard and a multi-instance loop.');
   return;
  }
  const wl = ext().extensions(node, 'instances')[0];
  if (wl) {
   const where = 'Step ' + item.xml + ' instances', count = ext().whole(wl.attrs, 'count', where);
   const mode = ext().oneOf(wl.attrs, 'mode', ['parallel', 'sequential'], where);
   item.instances = {...count !== undefined ? {count} : {}, ...wl.attrs.field !== undefined ? {field: wl.attrs.field} : {}, mode};
   return;
  }
  // A task has at most one of the two loop forms (both are rejected above).
  if (multi) {
   multiInstance(ctx, item, multi, fields);
   return;
  }
  if (!standard) return;
  const max = Number(standard.attrs.loopMaximum), cond = kids(standard, 'loopCondition')[0]?.text.trim();
  const field = camel(item.xml, 'Runs', fields), bounded = Number.isInteger(max) && max >= 1;
  item.loop = {field, max: bounded ? Math.min(max, 1000) : 3, condition: cond || undefined};
  if (!bounded) ctx.warn('Loop ' + item.xml + ' has no loopMaximum; it is bounded at 3 repeats.');
  if (standard.attrs.testBefore === 'true') {
   ctx.warn('Loop ' + item.xml + ' tests before the first run in BPMN; it runs once, then repeats while the condition holds.');
  }
 }
 root.LWProcessBpmnNodes = {PLAIN, SERVICE, CONTAINERS, GATEWAYS, ARTIFACTS, EVENTS, defs, isoMinutes, notIso, camel, gateway, event, taskLoops};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessBpmnNodes;
})(globalThis);
