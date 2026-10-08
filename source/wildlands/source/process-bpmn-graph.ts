/// <reference path="./process-bpmn.ts" />
/// <reference path="./process-bpmn-ext.ts" />
/// <reference path="./process-bpmn-bpsim.ts" />
/** Foreign BPMN to a flat flow-node graph: inlined sub-processes and call activities, boundary timers, link events, standard loops, dropped constructs and folded pass-through nodes. Gateway roles and conditions follow in process-bpmn-flow.ts. */
declare namespace LWProcessBpmnGraph {
 type X = LWProcessXml.Node;
 interface Item {
  key: string; xml: string; local: string; node: X; trail: string[]; kind: LWProcess.Kind | 'pass'; gateway?: 'exclusive' | 'parallel' | 'inclusive' | 'event' | 'complex';
  lane?: string | undefined; phase?: string | undefined; near?: string; drop?: boolean; folded?: string; synthetic?: boolean; system?: boolean; wait?: boolean; placeholder?: boolean; lost?: boolean; linkName?: string; link?: 'throw' | 'catch';
  timer?: {duration?: number; until?: number}; instances?: LWProcess.Instances; deadline?: {after?: number; timing?: LWProcess.Dist; mode: 'interrupt' | 'escalate'; edge: Edge}; loop?: {field: string; max: number; condition: string | undefined};
  attached?: string; how: string; id?: string;
 }
 interface Edge {key: string; xml: string; from: string; to: string; node: X | undefined; label?: string | undefined; expression?: string | undefined; exprNode?: X | undefined; when?: LWProcess.When; deadline?: boolean; synthetic?: boolean; id?: string;}
 interface Net {items: Item[]; edges: Edge[]; byKey: Map<string, Item>; lanes: Map<string, string>; callees: Set<string>; ignored: Map<string, string[]>;}
 interface Ctx {
  o: LWProcessBpmn.Info['options']; processes: X[]; bps: LWProcessBpmnBpsim.Data | undefined; warn(m: string): void; reject(id: string, type: string, message: string): void;
  /** Rejects the construct, or in drop mode warns and marks `item` dropped. */
  unsupported(item: Item | undefined, id: string, type: string, message: string): void;
  note(id: string, type: string, target: string, how: string): void;
 }
 interface Api {build(ctx: Ctx, proc: X): Net; defs(n: X): string[]; prune(ctx: Ctx, net: Net, start: Item | undefined): void; contract(ctx: Ctx, net: Net): void;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessBpmnExport: {vocabulary: LWProcessBpmn.Vocabulary}; LWProcessBpmnExt: LWProcessBpmnExt.Api; LWProcessBpmnBpsim: LWProcessBpmnBpsim.Api; LWProcessBpmnExpr: LWProcessBpmnExpr.Api; LWProcessBpmnGraph?: LWProcessBpmnGraph.Api};
 const {MODEL} = root.LWProcessBpmnExport.vocabulary;
 type X = LWProcessXml.Node; type Item = LWProcessBpmnGraph.Item; type Edge = LWProcessBpmnGraph.Edge; type Net = LWProcessBpmnGraph.Net; type Ctx = LWProcessBpmnGraph.Ctx;
 const ext = () => root.LWProcessBpmnExt, kids = (n: X, local: string, ns?: string) => ext().kids(n, local, ns), first = (n: X, local: string) => ext().first(n, local);
 const PLAIN = ['task', 'userTask', 'manualTask'], SERVICE = ['serviceTask', 'scriptTask', 'businessRuleTask', 'sendTask', 'receiveTask'];
 const GATEWAYS: Record<string, Item['gateway']> = {exclusiveGateway: 'exclusive', parallelGateway: 'parallel', inclusiveGateway: 'inclusive', eventBasedGateway: 'event', complexGateway: 'complex'};
 const CONTAINERS = ['subProcess', 'transaction', 'adHocSubProcess', 'callActivity'];
 const ARTIFACTS = new Set(['documentation', 'extensionElements', 'textAnnotation', 'association', 'group', 'dataObject', 'dataObjectReference', 'dataStoreReference', 'dataStore', 'property', 'ioSpecification', 'category', 'categoryValue', 'auditing', 'monitoring', 'resourceRole', 'correlationSubscription']);
 const MAX_DEPTH = 3;
 const defs = (n: X): string[] => n.children.filter(c => c.ns === MODEL && c.local.endsWith('EventDefinition')).map(c => c.local);
 /** The single timer definition of an event: an ISO-8601 `timeDuration` read like a boundary timer; the Wildlands extension restores exact values. */
 function timerOf(ctx: Ctx, node: X, xmlId: string, item: Item): void {
  const list = node.children.filter(c => c.ns === MODEL && c.local === 'timerEventDefinition'), step = first(node, 'step');
  const fail = (why: string) => ctx.unsupported(item, xmlId, 'intermediateCatchEvent', 'Timer ' + xmlId + ' is not supported: ' + why);
  const forms = list[0]!.children.filter(c => c.ns === MODEL), form = forms[0];
  if (step?.attrs.until !== undefined) { item.timer = {until: Number(step.attrs.until)}; return; }
  if (forms.length !== 1) { fail('define exactly one timeDuration.'); return; }
  if (form!.local !== 'timeDuration') { fail(form!.local + ' has no business-minute meaning; use an ISO-8601 timeDuration such as PT45M or PT1H30M.'); return; }
  const minutes = isoMinutes(ctx, form!.text);
  if (minutes === undefined) { fail(notIso(form!.text)); return; }
  item.timer = {duration: step?.attrs.duration !== undefined ? ext().whole(step.attrs, 'duration', 'Step ' + xmlId)! : minutes};
 }
 const camel = (xml: string, suffix: string, taken: Set<string>): string => {
  let base = xml.replace(/[^A-Za-z0-9]/g, ''); base = (/^[A-Za-z]/.test(base) ? base : 'n' + base).replace(/^./, c => c.toLowerCase()).slice(0, 40) + suffix;
  let name = base, n = 2; while (taken.has(name)) name = base + n++;
  taken.add(name); return name;
 };
 function build(ctx: Ctx, proc: X): Net {
  const net: Net = {items: [], edges: [], byKey: new Map(), lanes: new Map(), callees: new Set(), ignored: new Map()}, boundaries: Item[] = [];
  const containers = new Map<string, {entry: string; exits: string[]}>(), fields = new Set<string>();
  const ignore = (local: string, id: string) => { if (!net.ignored.has(local)) net.ignored.set(local, []); net.ignored.get(local)!.push(id); };
  /** Marks every flow node of a lane (and nested lanes) so tasks can later demand its pool. */
  function laneMap(container: X): Map<string, string> {
   const out = new Map<string, string>();
   const walk = (set: X) => { for (const lane of kids(set, 'lane')) {
    const id = lane.attrs.id ?? ''; net.lanes.set(id, lane.attrs.name || id); ext().vet(lane, 'lane', 'Lane ' + id);
    for (const ref of kids(lane, 'flowNodeRef')) out.set(ref.text.trim(), id);
    for (const child of kids(lane, 'childLaneSet')) walk(child);
   } };
   for (const set of kids(container, 'laneSet')) walk(set);
   return out;
  }
  function collect(container: X, scope: string, trail: string[], phase: string | undefined, inherited: string | undefined, depth: number, stack: string[]): {starts: Item[]; ends: Item[]} {
   const lanes = laneMap(container), starts: Item[] = [], ends: Item[] = [];
   for (const child of container.children) {
    if (child.ns !== MODEL) { ctx.warn('Ignored non-BPMN element ' + child.local + '.'); continue; }
    const local = child.local, xml = child.attrs.id ?? '';
    if (local === 'sequenceFlow' || local === 'laneSet') continue;
    if (ARTIFACTS.has(local)) { if (local !== 'documentation' && local !== 'extensionElements') { ignore(local, xml || '(no id)'); ctx.note(xml || '(no id)', local, 'none', 'ignored: documentation artifact without simulation meaning'); } continue; }
    const gateway = GATEWAYS[local], isEvent = local.endsWith('Event'), isTask = PLAIN.includes(local) || SERVICE.includes(local);
    if (!gateway && !isEvent && !isTask && !CONTAINERS.includes(local)) { ctx.warn('Ignored element ' + local + '.'); continue; }
    if (!xml) { ctx.reject('', local, local + ' needs an id.'); continue; }
    const key = scope + xml;
    if (net.byKey.has(key)) { ctx.reject(xml, local, 'Duplicate BPMN id ' + xml + '.'); continue; }
    const item: Item = {key, xml, local, node: child, trail, kind: 'task', lane: lanes.get(xml) ?? inherited, phase, how: ''};
    net.byKey.set(key, item);
    const bad = (why: string) => ctx.unsupported(item, xml, local, local + ' ' + xml + ' is not supported: ' + why);
    const d = defs(child);
    if (gateway) {
     item.gateway = gateway; item.kind = gateway === 'parallel' || gateway === 'inclusive' ? 'fork' : 'decision';
     if (gateway === 'complex') {
      if (ctx.o.unsupported === 'drop') { ctx.warn('Complex gateway ' + xml + ' has no simulation semantics; it is approximated as an exclusive gateway.'); item.gateway = 'exclusive'; item.how = 'complex gateway approximated as an exclusive decision'; }
      else ctx.reject(xml, local, local + ' ' + xml + ' is not supported: complex gateways have no simulation semantics. Model the decision with exclusive or inclusive gateways.');
     }
    } else if (local === 'startEvent') {
     item.kind = 'start'; starts.push(item);
     if (d.length) ctx.warn((d.includes('timerEventDefinition') || d.includes('messageEventDefinition') || d.includes('signalEventDefinition') ? 'Start event ' + xml + ' (' + d.map(x => x.replace('EventDefinition', '')).join(', ') + ') imports as a plain start;' + ' arrivals come from BPSim or the default single case.' : 'Event definitions on ' + xml + ' are ignored; it is a plain event.'));
    } else if (local === 'endEvent') {
     item.kind = 'end';
     const only = d.length === 1 ? d[0]! : '';
     if (d.length > 1 || ['compensateEventDefinition', 'cancelEventDefinition', 'conditionalEventDefinition', 'timerEventDefinition', 'linkEventDefinition'].includes(only)) bad('end events with ' + d.map(x => x.replace('EventDefinition', '')).join(' + ') + ' semantics cannot be simulated.');
     else if (only === 'errorEventDefinition') { item.lost = true; ctx.warn('Error end event ' + xml + ' imports as an end with outcome "lost".'); }
     else if (only === 'terminateEventDefinition') ctx.warn('Terminate end event ' + xml + ' is a plain end: other parallel branches of the case are not cancelled.');
     else if (only) ctx.warn('Event definitions on ' + xml + ' are ignored; it is a plain event.');
     if (!item.lost) ends.push(item);
    } else if (local === 'intermediateCatchEvent') {
     item.kind = 'timer';
     if (d.length !== 1) bad('it needs exactly one event definition (timer, message, signal, conditional or link); ' + (d.join(', ') || 'no event definition') + ' found.');
     else if (d[0] === 'timerEventDefinition') timerOf(ctx, child, xml, item);
     else if (['messageEventDefinition', 'signalEventDefinition', 'conditionalEventDefinition'].includes(d[0]!)) { item.wait = true; ctx.warn(d[0]!.replace('EventDefinition', '') + ' catch event ' + xml + ' is simulated as a timer; message arrival is an assumption (duration from BPSim WaitTime or the default).'); }
     else if (d[0] === 'linkEventDefinition') { item.kind = 'pass'; item.link = 'catch'; item.linkName = child.children.find(c => c.local === 'linkEventDefinition')?.attrs.name ?? ''; }
     else bad(d[0]!.replace('EventDefinition', '') + ' catch events cannot be simulated.');
    } else if (local === 'intermediateThrowEvent') {
     item.kind = 'pass';
     if (!d.length || d.length === 1 && ['messageEventDefinition', 'signalEventDefinition', 'escalationEventDefinition'].includes(d[0]!)) ctx.warn('Throw event ' + xml + (d.length ? ' (' + d[0]!.replace('EventDefinition', '') + ')' : '') + ' is folded into the flow; nothing is thrown.');
     else if (d.length === 1 && d[0] === 'linkEventDefinition') { item.link = 'throw'; item.linkName = child.children.find(c => c.local === 'linkEventDefinition')?.attrs.name ?? ''; }
     else bad((d.map(x => x.replace('EventDefinition', '')).join(' + ')) + ' throw events cannot be simulated.');
    } else if (local === 'boundaryEvent') {
     item.kind = 'pass'; item.attached = scope + (child.attrs.attachedToRef ?? ''); boundaries.push(item);
    } else if (isTask) {
     item.system = SERVICE.includes(local);
     if (child.attrs.isForCompensation === 'true') bad('compensation activities have no simulation semantics.');
     taskLoops(item);
    } else containerNode(item, bad);
    if (!containers.has(key)) net.items.push(item);
   }
   for (const f of kids(container, 'sequenceFlow')) {
    const id = f.attrs.id ?? '', exprs = kids(f, 'conditionExpression');
    if (exprs.length > 1) { ctx.reject(id, 'sequenceFlow', 'Flow ' + id + ' has ' + exprs.length + ' conditionExpression elements; at most one is allowed.'); continue; }
    net.edges.push({key: scope + id, xml: id, from: scope + (f.attrs.sourceRef ?? ''), to: scope + (f.attrs.targetRef ?? ''), node: f, label: f.attrs.name || undefined, expression: exprs[0]?.text, exprNode: exprs[0]});
   }
   return {starts, ends};

   function taskLoops(item: Item): void {
    const node = item.node, multi = kids(node, 'multiInstanceLoopCharacteristics')[0], standard = kids(node, 'standardLoopCharacteristics')[0];
    if (multi && standard) { ctx.reject(item.xml, item.local, item.local + ' ' + item.xml + ' declares both a standard and a multi-instance loop.'); return; }
    const wl = ext().extensions(node, 'instances')[0];
    if (wl) {
     const where = 'Step ' + item.xml + ' instances', count = ext().whole(wl.attrs, 'count', where), mode = ext().oneOf(wl.attrs, 'mode', ['parallel', 'sequential'], where);
     item.instances = {...count !== undefined ? {count} : {}, ...wl.attrs.field !== undefined ? {field: wl.attrs.field} : {}, mode}; return;
    }
    if (multi) {
     const mode = multi.attrs.isSequential === 'true' ? 'sequential' : 'parallel', card = kids(multi, 'loopCardinality')[0]?.text.trim() ?? '';
     const at = (m: string) => ctx.warn(m);
     if (kids(multi, 'completionCondition')[0]) at('The completion condition of multi-instance ' + item.xml + ' is ignored: every item runs.');
     const lit = /^\d+$/.test(card) ? Number(card) : undefined, ref = /^[$#]?\{?\s*([A-Za-z_]\w*)\s*\}?$/.exec(card)?.[1];
     if (lit !== undefined) {
      if (lit < 1) { ctx.unsupported(item, item.xml, item.local, item.local + ' ' + item.xml + ' is not supported: multi-instance cardinality must be at least 1.'); return; }
      if (lit === 1) { at('Multi-instance ' + item.xml + ' has cardinality 1 and runs once.'); return; }
      if (lit > 50) at('Multi-instance ' + item.xml + ' cardinality ' + lit + ' is limited to 50 items.');
      item.instances = {count: Math.min(50, lit), mode};
     } else if (ref && root.LWProcessBpmnExpr.isField(ref)) { fields.add(ref); item.instances = {field: ref, mode}; at('Multi-instance ' + item.xml + ' reads its item count from case field "' + ref + '"; arrivals must set it to 1..50.'); }
     else if (kids(multi, 'loopDataInputRef')[0] || kids(multi, 'inputDataItem')[0] || card) {
      const field = camel(item.xml, 'Items', fields); item.instances = {field, mode};
      at('Multi-instance ' + item.xml + ' iterates a collection; its item count is read from the generated case field "' + field + '" that arrivals must set to 1..50.');
     } else { ctx.unsupported(item, item.xml, item.local, item.local + ' ' + item.xml + ' is not supported: the multi-instance loop has neither a cardinality nor a data collection.'); return; }
    }
    if (standard) {
     const max = Number(standard.attrs.loopMaximum), cond = kids(standard, 'loopCondition')[0]?.text.trim();
     const field = camel(item.xml, 'Runs', fields);
     item.loop = {field, max: Number.isInteger(max) && max >= 1 ? Math.min(max, 1000) : 3, condition: cond || undefined};
     if (!(Number.isInteger(max) && max >= 1)) ctx.warn('Loop ' + item.xml + ' has no loopMaximum; it is bounded at 3 repeats.');
     if (standard.attrs.testBefore === 'true') ctx.warn('Loop ' + item.xml + ' tests before the first run in BPMN; it runs once, then repeats while the condition holds.');
    }
   }
   function containerNode(item: Item, bad: (why: string) => void): void {
    const node = item.node, local = item.local;
    if (local === 'transaction' || local === 'adHocSubProcess') { bad('transactions and ad-hoc sub-processes have no simulation semantics.'); return; }
    if (kids(node, 'multiInstanceLoopCharacteristics')[0] || kids(node, 'standardLoopCharacteristics')[0]) { bad('a looping or multi-instance ' + local + ' cannot be inlined.'); return; }
    let source: X | undefined = node, name = node.attrs.name || item.xml, nextStack = stack;
    if (local === 'subProcess' && node.attrs.triggeredByEvent === 'true') { bad('event sub-processes have no simulation semantics.'); return; }
    if (local === 'callActivity') {
     const target = (node.attrs.calledElement ?? '').split(':').at(-1) ?? '';
     source = ctx.processes.find(p => p.attrs.id === target);
     if (!source) { item.placeholder = true; item.how = 'placeholder task for the call to "' + (target || 'unknown') + '"'; ctx.warn('Call activity ' + item.xml + ' calls "' + (target || 'no process') + '", which is not in this file; it imports as a placeholder task.'); return; }
     if (stack.includes(target)) { bad('recursive call of process "' + target + '" (' + [...stack, target].join(' -> ') + ').'); return; }
     nextStack = [...stack, target]; net.callees.add(target);
    }
    if (depth >= MAX_DEPTH) { bad('sub-processes nest deeper than ' + MAX_DEPTH + ' levels.'); return; }
    const inner = collect(source, item.key + '/', [...trail, item.xml], name.slice(0, 40), item.lane, depth + 1, nextStack);
    if (inner.starts.length !== 1 || !inner.ends.length) { bad('it needs exactly one start event and at least one end event (found ' + inner.starts.length + ' and ' + inner.ends.length + ').'); return; }
    inner.starts[0]!.kind = 'pass'; inner.starts[0]!.how = 'start of inlined ' + local + ' ' + item.xml + '; folded';
    for (const e of inner.ends) { e.kind = 'pass'; e.how = 'end of inlined ' + local + ' ' + item.xml + '; folded'; }
    containers.set(item.key, {entry: inner.starts[0]!.key, exits: inner.ends.map(e => e.key)});
    const count = net.items.filter(i => i.key.startsWith(item.key + '/') && i.kind !== 'pass').length;
    ctx.note(item.xml, local, 'none', 'inlined with ' + count + ' step(s) (phase "' + name.slice(0, 40) + '"); ids prefixed "' + item.xml.toLowerCase().replace(/[^a-z0-9-]+/g, '-') + '-"');
   }
  }
  collect(proc, '', [], undefined, undefined, 0, [proc.attrs.id ?? '']);
  // Re-point flows at inlined containers: into the inner start, out of every inner end.
  const flows: Edge[] = [];
  for (const e of net.edges) {
   const target = containers.get(e.to), source = containers.get(e.from);
   if (target) e.to = target.entry;
   if (source) source.exits.forEach((x, i) => flows.push({...e, from: x, key: i ? e.key + '~' + (i + 1) : e.key})); else flows.push(e);
  }
  net.edges = flows;
  for (const e of net.edges) if (!net.byKey.has(e.from) || !net.byKey.has(e.to) || containers.has(e.from)) ctx.reject(e.xml || '(no id)', 'sequenceFlow', 'Sequence flow ' + (e.xml || '(no id)') + ' must connect two supported nodes.');
  boundaryEvents(ctx, net, boundaries, new Set(containers.keys()));
  links(ctx, net);
  loops(ctx, net);
  return net;
 }
 /** Timer boundary events become the `deadline` of their work step; every other boundary event is unsupported. */
 function boundaryEvents(ctx: Ctx, net: Net, boundaries: Item[], inlined: Set<string>): void {
  for (const b of boundaries) {
   const target = net.byKey.get(b.attached ?? ''), wl = first(b.node, 'deadline'), d = defs(b.node), id = b.xml;
   const out = net.edges.filter(e => e.from === b.key), bad = (why: string) => ctx.unsupported(b, id, 'boundaryEvent', 'boundaryEvent ' + id + ' is not supported: ' + why);
   if (inlined.has(b.attached ?? '')) { bad('boundary events on sub-processes and call activities are not supported: a deadline cannot cover several steps.'); continue; }
   if (!target) { ctx.reject(id, 'boundaryEvent', 'boundaryEvent ' + id + ' is attached to unknown activity ' + (b.node.attrs.attachedToRef ?? '(none)') + '.'); continue; }
   if (target.kind !== 'task' || !(PLAIN.includes(target.local) || SERVICE.includes(target.local) || target.placeholder)) { bad('boundary events are supported on tasks only, not on ' + target.local + ' ' + target.xml + '.'); continue; }
   if (d.length !== 1 || d[0] !== 'timerEventDefinition') { bad((d.map(x => x.replace('EventDefinition', '')).join(' + ') || 'plain') + ' boundary events cannot be simulated; only timer boundary events with a timeDuration can.'); continue; }
   if (out.length !== 1) { bad('it has ' + out.length + ' outgoing flows; a deadline needs exactly one.'); continue; }
   if (target.deadline) { bad('task ' + target.xml + ' already has a deadline; the engine allows one per task.'); continue; }
   const form = b.node.children.find(c => c.local === 'timerEventDefinition')!.children.find(c => c.ns === MODEL), params = ctx.bps?.elements.get(b.xml), timing = wl ? first(b.node, 'timing') : undefined;
   const standard = form?.local === 'timeDuration' ? isoMinutes(ctx, form.text) : undefined;
   // Without the extension a BPSim WaitTime replaces the standard duration; a random one stays random as the deadline's timing.
   const wait = wl ? undefined : params?.wait, where = 'Deadline ' + id;
   if (wl) ext().vet(b.node, 'boundary', where);
   const after = wl ? ext().whole(wl.attrs, 'after', where) : wait ? (wait.dist ? undefined : wait.mean) : standard;
   if (!(wl ? after !== undefined || timing !== undefined : after !== undefined || wait?.dist)) { bad(form?.local === 'timeDuration' ? notIso(form.text) : (form?.local ?? 'an empty timer') + ' has no business-minute meaning; use a timeDuration.'); continue; }
   const mode: 'interrupt' | 'escalate' = wl ? ext().oneOf(wl.attrs, 'mode', ['interrupt', 'escalate'], where) : b.node.attrs.cancelActivity === 'false' ? 'escalate' : 'interrupt', edge = out[0]!;
   edge.from = target.key; edge.deadline = true; target.deadline = {mode, edge, ...after !== undefined ? {after} : {}, ...timing ? {timing: ext().distOf(timing, where + ' timing')} : wait?.dist ? {timing: wait.dist} : {}};
   if (wait) ctx.note(id, 'bpsim:WaitTime', 'flow:' + (edge.xml || '?'), (wait.dist ? wait.dist.dist + ' distribution -> deadline timing' : 'constant -> deadline after') + ' (mean ' + wait.mean + ' min); replaces the timer duration');
   if (wl?.attrs.flow) edge.id = wl.attrs.flow;
   b.folded = 'boundary'; b.how = (mode === 'interrupt' ? 'interrupting' : 'non-interrupting') + ' timer boundary -> deadline (' + mode + ') on ' + target.xml;
   net.items.splice(net.items.indexOf(b), 1); ctx.note(id, 'boundaryEvent', 'flow:' + (edge.xml || '?'), b.how);
  }
 }
 /** Catch and boundary timers share one ISO-8601 reading: weeks (5 days), days and hours in business minutes, sub-minute values rounded up to 1 with a warning. */
 const isoMinutes = (ctx: Ctx, text: string) => root.LWProcessBpmnBpsim.isoMinutes(text, {minutesPerDay: ctx.o.minutesPerDay, minutesPerHour: ctx.o.minutesPerHour, warn: ctx.warn});
 const notIso = (text: string) => 'duration "' + text.trim() + '" is not an ISO-8601 duration (PnW, PnD, PTnH, PTnM, PTnS or a combination such as PT1H30M; years and months have no business-minute meaning).';
 /** Link throw events jump straight to the catch event of the same name. */
 function links(ctx: Ctx, net: Net): void {
  const catches = new Map(net.items.filter(i => i.link === 'catch').map(i => [i.linkName ?? '', i] as const));
  for (const t of net.items.filter(i => i.link === 'throw')) {
   const c = catches.get(t.linkName ?? '');
   if (!c) { ctx.reject(t.xml, 'intermediateThrowEvent', 'intermediateThrowEvent ' + t.xml + ' is a link throw event named "' + (t.linkName ?? '') + '" without a matching catch event.'); continue; }
   net.edges.push({key: t.key + '~link', xml: t.xml + '~link', from: t.key, to: c.key, node: undefined, synthetic: true});
   t.how = 'link throw -> direct flow to catch event ' + c.xml; c.how = 'link catch of "' + (c.linkName ?? '') + '"; folded';
  }
 }
 /** Standard loops: the task is followed by a decision that repeats it while the loop condition and the bounded counter allow. */
 function loops(ctx: Ctx, net: Net): void {
  for (const t of net.items.filter(i => i.loop)) {
   const loop = t.loop!;
   let base: LWProcess.When | undefined;
   if (loop.condition) { try { base = root.LWProcessBpmnExpr.parse(loop.condition); } catch (error) { ctx.warn('Loop ' + t.xml + ': the loop condition "' + loop.condition + '" cannot be evaluated (' + (error as Error).message + '); it repeats with a 50% chance while the counter allows.'); } }
   else ctx.warn('Loop ' + t.xml + ' has no loop condition; it repeats with a 50% chance while the counter allows.');
   const bound = {field: loop.field, op: 'lt', value: loop.max} as LWProcess.When, leaf: LWProcess.When = base ?? {chance: 50};
   const out = net.edges.filter(e => e.from === t.key && !e.deadline), d: Item = {key: t.key + '~loop', xml: t.xml + '-loop', local: 'exclusiveGateway', node: t.node, trail: t.trail, kind: 'decision', gateway: 'exclusive', synthetic: true, near: t.key, how: 'loop decision for ' + t.xml, lane: t.lane, phase: t.phase};
   net.items.push(d); net.byKey.set(d.key, d);
   for (const e of out) e.from = d.key;
   net.edges.push({key: t.key + '~next', xml: t.xml + '-next', from: t.key, to: d.key, node: undefined, synthetic: true}, {key: t.key + '~repeat', xml: t.xml + '-repeat', from: d.key, to: t.key, node: undefined, synthetic: true, label: 'repeat', when: leaf.all ? {all: [...leaf.all, bound]} : {all: [leaf, bound]}});
  }
 }
 /** Removes dropped items: a dropped node with one way out is bridged (in-flows re-pointed), otherwise its flows vanish; whatever can no longer be reached from the start is pruned. */
 function prune(ctx: Ctx, net: Net, start: Item | undefined): void {
  const dropped = net.items.filter(i => i.drop);
  for (const x of dropped) {
   const out = net.edges.filter(e => e.from === x.key), into = net.edges.filter(e => e.to === x.key);
   if (out.length === 1 && into.length) for (const e of into) e.to = out[0]!.to;
   net.edges = net.edges.filter(e => e.from !== x.key && !(e.to === x.key && !(out.length === 1 && into.length)));
   x.folded = 'dropped'; net.items = net.items.filter(i => i !== x);
   ctx.note(x.xml, x.local, 'none', 'dropped (unsupported)' + (out.length === 1 && into.length ? '; its flows were bridged' : ''));
  }
  if (!start) return;
  const reach = new Set<string>([start.key]), queue = [start.key];
  while (queue.length) { const k = queue.shift()!; for (const e of net.edges) if (e.from === k && !reach.has(e.to)) { reach.add(e.to); queue.push(e.to); } }
  const gone = net.items.filter(i => !reach.has(i.key) && !i.synthetic);
  if (gone.length) ctx.warn('Pruned ' + gone.length + ' element(s) no longer reachable from the start: ' + gone.map(i => i.xml).join(', ') + '.');
  for (const x of gone) { x.folded = 'pruned'; ctx.note(x.xml, x.local, 'none', 'pruned: reachable only through dropped or unsupported elements'); }
  net.items = net.items.filter(i => reach.has(i.key)); net.edges = net.edges.filter(e => reach.has(e.from) && reach.has(e.to));
 }
 /** Folds pass-through nodes: events, merging exclusive gateways and one-in-one-out parallel or inclusive gateways disappear into their flows. */
 function contract(ctx: Ctx, net: Net): void {
  const into = (k: string) => net.edges.filter(e => e.to === k), outOf = (k: string) => net.edges.filter(e => e.from === k);
  const passes = (i: Item) => {
   const out = outOf(i.key).length;
   if (i.kind === 'pass') return out === 1;
   if (i.gateway === 'exclusive' || i.gateway === 'event') return out === 1;
   return (i.gateway === 'parallel' || i.gateway === 'inclusive') && into(i.key).length < 2 && out === 1;
  };
  for (let progress = true; progress;) {
   progress = false;
   for (const g of net.items.filter(passes)) {
    const o = outOf(g.key)[0]!; if (o.to === g.key) { ctx.reject(g.xml, g.local, 'Gateway ' + g.xml + ' loops onto itself.'); return; }
    for (const e of into(g.key)) e.to = o.to;
    net.edges = net.edges.filter(e => e !== o); net.items = net.items.filter(i => i !== g); g.folded = 'folded'; progress = true;
    ctx.note(o.xml, 'sequenceFlow', 'none', 'folded: the flow leaving ' + g.xml + ' is replaced by the flow into the next element');
    if (g.gateway) { ctx.warn('Merge or pass-through gateway ' + g.xml + ' was folded into its flows; Wildlands steps accept several incoming flows.'); g.how = 'merge or pass-through gateway folded into its flows'; }
    else g.how = g.how || 'pass-through event folded into its flows';
    ctx.note(g.xml, g.local, 'none', g.how);
   }
  }
 }
 root.LWProcessBpmnGraph = {build, defs, prune, contract};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessBpmnGraph;
})(globalThis);
