/// <reference path="./process-bpmn.ts" />
/// <reference path="./process-bpmn-ext.ts" />
/// <reference path="./process-bpmn-bpsim.ts" />
/// <reference path="./process-bpmn-nodes.ts" />
/**
 * Foreign BPMN to a flat flow-node graph: inlined sub-processes and call activities, boundary timers, link events, standard
 * loops. What one flow node becomes (event roles, timers, task loops) is read by process-bpmn-nodes.ts; dropped constructs
 * and pass-through nodes are folded away by process-bpmn-fold.ts; gateway roles and conditions follow in process-bpmn-flow.ts.
 */
declare namespace LWProcessBpmnGraph {
 type X = LWProcessXml.Node;
 interface Item {
  key: string; xml: string; local: string; node: X; trail: string[]; kind: LWProcess.Kind | 'pass';
  gateway?: 'exclusive' | 'parallel' | 'inclusive' | 'event' | 'complex';
  lane?: string | undefined; phase?: string | undefined; near?: string; drop?: boolean; folded?: string; synthetic?: boolean; system?: boolean;
  wait?: boolean; placeholder?: boolean; lost?: boolean; linkName?: string; link?: 'throw' | 'catch';
  timer?: {duration?: number; until?: number}; instances?: LWProcess.Instances;
  deadline?: {after?: number; timing?: LWProcess.Dist; mode: 'interrupt' | 'escalate'; edge: Edge};
  loop?: {field: string; max: number; condition: string | undefined};
  attached?: string; how: string; id?: string;
 }
 interface Edge {
  key: string; xml: string; from: string; to: string; node: X | undefined; label?: string | undefined; expression?: string | undefined;
  exprNode?: X | undefined; when?: LWProcess.When; deadline?: boolean; synthetic?: boolean; id?: string;
 }
 interface Net {items: Item[]; edges: Edge[]; byKey: Map<string, Item>; lanes: Map<string, string>; callees: Set<string>; ignored: Map<string, string[]>;}
 interface Ctx {
  o: LWProcessBpmn.Info['options']; processes: X[]; bps: LWProcessBpmnBpsim.Data | undefined; warn(m: string): void;
  reject(id: string, type: string, message: string): void;
  /** Rejects the construct, or in drop mode warns and marks `item` dropped. */
  unsupported(item: Item | undefined, id: string, type: string, message: string): void;
  note(id: string, type: string, target: string, how: string): void;
 }
 /** `build` collects a process into a net; process-bpmn-fold.ts then removes dropped elements and folds pass-through nodes. */
 interface Api {build(ctx: Ctx, proc: X): Net; defs(n: X): string[];}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessBpmnExport: {vocabulary: LWProcessBpmn.Vocabulary}; LWProcessBpmnExt: LWProcessBpmnExt.Api;
  LWProcessBpmnNodes: LWProcessBpmnNodes.Api; LWProcessBpmnExpr: LWProcessBpmnExpr.Api; LWProcessBpmnGraph?: LWProcessBpmnGraph.Api;
  LWProcessCatalog: LWProcess.Catalog};
 const {MODEL} = root.LWProcessBpmnExport.vocabulary;
 type X = LWProcessXml.Node;
 type Item = LWProcessBpmnGraph.Item;
 type Edge = LWProcessBpmnGraph.Edge;
 type Net = LWProcessBpmnGraph.Net;
 type Ctx = LWProcessBpmnGraph.Ctx;
 const ext = () => root.LWProcessBpmnExt, nodes = () => root.LWProcessBpmnNodes;
 const kids = (n: X, local: string, ns?: string) => ext().kids(n, local, ns), first = (n: X, local: string) => ext().first(n, local);
 const MAX_DEPTH = 3;
 /** Events, pass-through gateways and inlined container boundaries fold away, so a file may hold this many times the steps and flows of a definition. */
 const FOLD = 4;
 /** The analysis bound, derived from the definition limits (`maxItems` of steps and flows in the schema). */
 function bound(): {steps: number; flows: number; nodes: number; edges: number} {
  const p = root.LWProcessCatalog.schema.properties as Record<string, {maxItems: number}>, steps = p.steps!.maxItems, flows = p.flows!.maxItems;
  return {steps, flows, nodes: steps * FOLD, edges: flows * FOLD};
 }
 const isFlowNode = (local: string) => {
  const n = nodes();
  return local.endsWith('Event') || Object.hasOwn(n.GATEWAYS, local) || [...n.PLAIN, ...n.SERVICE, ...n.CONTAINERS].includes(local);
 };
 /** Flow nodes and sequence flows written in a process and its nested sub-processes, counted in one linear pass. */
 function written(proc: X): {nodes: number; flows: number} {
  let found = 0, flows = 0;
  const walk = (n: X): void => {
   for (const c of n.children) {
    if (c.ns !== MODEL) continue;
    if (c.local === 'sequenceFlow') flows++;
    else if (isFlowNode(c.local)) {
     found++;
     walk(c);
    }
   }
  };
  walk(proc);
  return {nodes: found, flows};
 }
 const count = (n: number) => n.toLocaleString('en-US');
 /** Rejects before any analysis that grows with the file: a process this large could never become a definition. */
 function tooLarge(b: ReturnType<typeof bound>, found: string): Error {
  return Error('This process is too large to import: ' + found + ', but a Wildlands process holds at most ' + b.steps + ' steps and ' + b.flows + ' flows. '
   + 'Import reads at most ' + count(b.nodes) + ' flow nodes and ' + count(b.edges) + ' sequence flows, which leaves room for events and gateways '
   + 'that fold away; split the model into smaller processes.');
 }
 function build(ctx: Ctx, proc: X): Net {
  const net: Net = {items: [], edges: [], byKey: new Map(), lanes: new Map(), callees: new Set(), ignored: new Map()}, boundaries: Item[] = [];
  const containers = new Map<string, {entry: string; exits: string[]}>(), fields = new Set<string>(), limit = bound(), size = written(proc);
  if (size.nodes > limit.nodes || size.flows > limit.edges) {
   throw tooLarge(limit, 'it has ' + count(size.nodes) + ' flow nodes and ' + count(size.flows) + ' sequence flows');
  }
  const inlined = (what: string, n: number) => tooLarge(limit, 'with its call activities inlined it has more than ' + count(n) + ' ' + what);
  const ignore = (local: string, id: string) => {
   if (!net.ignored.has(local)) net.ignored.set(local, []);
   net.ignored.get(local)!.push(id);
  };
  /** Marks every flow node of a lane (and nested lanes) so tasks can later demand its pool. */
  function laneMap(container: X): Map<string, string> {
   const out = new Map<string, string>();
   const walk = (set: X) => {
    for (const lane of kids(set, 'lane')) {
     const id = lane.attrs.id ?? '';
     net.lanes.set(id, lane.attrs.name || id);
     ext().vet(lane, 'lane', 'Lane ' + id);
     for (const ref of kids(lane, 'flowNodeRef')) out.set(ref.text.trim(), id);
     for (const child of kids(lane, 'childLaneSet')) walk(child);
    }
   };
   for (const set of kids(container, 'laneSet')) walk(set);
   return out;
  }
  /** Reads one container (a process or an inlined sub-process or called process) into the net; returns its start and end events. */
  function collect(container: X, scope: string, trail: string[], phase: string | undefined, inherited: string | undefined, depth: number,
   stack: string[]): {starts: Item[]; ends: Item[]} {
   const lanes = laneMap(container), sink = {starts: [] as Item[], ends: [] as Item[]}, vocabulary = nodes();
   for (const child of container.children) {
    if (child.ns !== MODEL) {
     ctx.warn('Ignored non-BPMN element ' + child.local + '.');
     continue;
    }
    const local = child.local, xml = child.attrs.id ?? '';
    if (local === 'sequenceFlow' || local === 'laneSet') continue;
    if (vocabulary.ARTIFACTS.has(local)) {
     if (local !== 'documentation' && local !== 'extensionElements') {
      ignore(local, xml || '(no id)');
      ctx.note(xml || '(no id)', local, 'none', 'ignored: documentation artifact without simulation meaning');
     }
     continue;
    }
    const gateway = vocabulary.GATEWAYS[local], isEvent = local.endsWith('Event');
    const isTask = vocabulary.PLAIN.includes(local) || vocabulary.SERVICE.includes(local);
    if (!gateway && !isEvent && !isTask && !vocabulary.CONTAINERS.includes(local)) {
     ctx.warn('Ignored element ' + local + '.');
     continue;
    }
    if (!xml) {
     ctx.reject('', local, local + ' needs an id.');
     continue;
    }
    const key = scope + xml;
    if (net.byKey.has(key)) {
     ctx.reject(xml, local, 'Duplicate BPMN id ' + xml + '.');
     continue;
    }
    const item: Item = {key, xml, local, node: child, trail, kind: 'task', lane: lanes.get(xml) ?? inherited, phase, how: ''};
    net.byKey.set(key, item);
    if (net.byKey.size > limit.nodes) throw inlined('flow nodes', limit.nodes);
    const bad = (why: string) => ctx.unsupported(item, xml, local, local + ' ' + xml + ' is not supported: ' + why);
    if (gateway) vocabulary.gateway(ctx, item, gateway);
    else if (vocabulary.EVENTS.includes(local)) vocabulary.event(ctx, item, sink, bad);
    else if (local === 'boundaryEvent') {
     item.kind = 'pass';
     item.attached = scope + (child.attrs.attachedToRef ?? '');
     boundaries.push(item);
    } else if (isTask) {
     item.system = vocabulary.SERVICE.includes(local);
     if (child.attrs.isForCompensation === 'true') bad('compensation activities have no simulation semantics.');
     vocabulary.taskLoops(ctx, item, fields);
    } else containerNode(item, bad);
    if (!containers.has(key)) net.items.push(item);
   }
   for (const f of kids(container, 'sequenceFlow')) {
    const id = f.attrs.id ?? '', exprs = kids(f, 'conditionExpression');
    if (exprs.length > 1) {
     ctx.reject(id, 'sequenceFlow', 'Flow ' + id + ' has ' + exprs.length + ' conditionExpression elements; at most one is allowed.');
     continue;
    }
    net.edges.push({key: scope + id, xml: id, from: scope + (f.attrs.sourceRef ?? ''), to: scope + (f.attrs.targetRef ?? ''), node: f,
     label: f.attrs.name || undefined, expression: exprs[0]?.text, exprNode: exprs[0]});
    if (net.edges.length > limit.edges) throw inlined('sequence flows', limit.edges);
   }
   return sink;

   /** Inlines a sub-process or called process; its inner start and ends fold into the flows around the container. */
   function containerNode(item: Item, bad: (why: string) => void): void {
    const node = item.node, local = item.local;
    if (local === 'transaction' || local === 'adHocSubProcess') {
     bad('transactions and ad-hoc sub-processes have no simulation semantics.');
     return;
    }
    if (kids(node, 'multiInstanceLoopCharacteristics')[0] || kids(node, 'standardLoopCharacteristics')[0]) {
     bad('a looping or multi-instance ' + local + ' cannot be inlined.');
     return;
    }
    let source: X | undefined = node, nextStack = stack;
    const name = node.attrs.name || item.xml;
    if (local === 'subProcess' && node.attrs.triggeredByEvent === 'true') {
     bad('event sub-processes have no simulation semantics.');
     return;
    }
    if (local === 'callActivity') {
     const target = (node.attrs.calledElement ?? '').split(':').at(-1) ?? '';
     source = ctx.processes.find(p => p.attrs.id === target);
     if (!source) {
      item.placeholder = true;
      item.how = 'placeholder task for the call to "' + (target || 'unknown') + '"';
      ctx.warn('Call activity ' + item.xml + ' calls "' + (target || 'no process') + '", which is not in this file; it imports as a placeholder task.');
      return;
     }
     if (stack.includes(target)) {
      bad('recursive call of process "' + target + '" (' + [...stack, target].join(' -> ') + ').');
      return;
     }
     nextStack = [...stack, target];
     net.callees.add(target);
    }
    if (depth >= MAX_DEPTH) {
     bad('sub-processes nest deeper than ' + MAX_DEPTH + ' levels.');
     return;
    }
    const inner = collect(source, item.key + '/', [...trail, item.xml], name.slice(0, 40), item.lane, depth + 1, nextStack);
    if (inner.starts.length !== 1 || !inner.ends.length) {
     bad('it needs exactly one start event and at least one end event (found ' + inner.starts.length + ' and ' + inner.ends.length + ').');
     return;
    }
    inner.starts[0]!.kind = 'pass';
    inner.starts[0]!.how = 'start of inlined ' + local + ' ' + item.xml + '; folded';
    for (const e of inner.ends) {
     e.kind = 'pass';
     e.how = 'end of inlined ' + local + ' ' + item.xml + '; folded';
    }
    containers.set(item.key, {entry: inner.starts[0]!.key, exits: inner.ends.map(e => e.key)});
    const steps = net.items.filter(i => i.key.startsWith(item.key + '/') && i.kind !== 'pass').length;
    const prefix = item.xml.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    ctx.note(item.xml, local, 'none', 'inlined with ' + steps + ' step(s) (phase "' + name.slice(0, 40) + '"); ids prefixed "' + prefix + '-"');
   }
  }
  collect(proc, '', [], undefined, undefined, 0, [proc.attrs.id ?? '']);
  // Re-point flows at inlined containers: into the inner start, out of every inner end.
  const flows: Edge[] = [];
  for (const e of net.edges) {
   const target = containers.get(e.to), source = containers.get(e.from);
   if (target) e.to = target.entry;
   if (source) source.exits.forEach((x, i) => flows.push({...e, from: x, key: i ? e.key + '~' + (i + 1) : e.key}));
   else flows.push(e);
  }
  net.edges = flows;
  for (const e of net.edges) {
   if (net.byKey.has(e.from) && net.byKey.has(e.to) && !containers.has(e.from)) continue;
   ctx.reject(e.xml || '(no id)', 'sequenceFlow', 'Sequence flow ' + (e.xml || '(no id)') + ' must connect two supported nodes.');
  }
  boundaryEvents(ctx, net, boundaries, new Set(containers.keys()));
  links(ctx, net);
  loops(ctx, net);
  return net;
 }
 /** Timer boundary events become the `deadline` of their work step; every other boundary event is unsupported. */
 function boundaryEvents(ctx: Ctx, net: Net, boundaries: Item[], inlined: Set<string>): void {
  const vocabulary = nodes();
  for (const b of boundaries) {
   const target = net.byKey.get(b.attached ?? ''), wl = first(b.node, 'deadline'), d = vocabulary.defs(b.node), id = b.xml;
   const out = net.edges.filter(e => e.from === b.key);
   const bad = (why: string) => ctx.unsupported(b, id, 'boundaryEvent', 'boundaryEvent ' + id + ' is not supported: ' + why);
   if (inlined.has(b.attached ?? '')) {
    bad('boundary events on sub-processes and call activities are not supported: a deadline cannot cover several steps.');
    continue;
   }
   if (!target) {
    ctx.reject(id, 'boundaryEvent', 'boundaryEvent ' + id + ' is attached to unknown activity ' + (b.node.attrs.attachedToRef ?? '(none)') + '.');
    continue;
   }
   const task = vocabulary.PLAIN.includes(target.local) || vocabulary.SERVICE.includes(target.local) || target.placeholder;
   if (target.kind !== 'task' || !task) {
    bad('boundary events are supported on tasks only, not on ' + target.local + ' ' + target.xml + '.');
    continue;
   }
   if (d.length !== 1 || d[0] !== 'timerEventDefinition') {
    const kinds = d.map(x => x.replace('EventDefinition', '')).join(' + ') || 'plain';
    bad(kinds + ' boundary events cannot be simulated; only timer boundary events with a timeDuration can.');
    continue;
   }
   if (out.length !== 1) {
    bad('it has ' + out.length + ' outgoing flows; a deadline needs exactly one.');
    continue;
   }
   if (target.deadline) {
    bad('task ' + target.xml + ' already has a deadline; the engine allows one per task.');
    continue;
   }
   const form = b.node.children.find(c => c.local === 'timerEventDefinition')!.children.find(c => c.ns === MODEL);
   const params = ctx.bps?.elements.get(b.xml), timing = wl ? first(b.node, 'timing') : undefined;
   const standard = form?.local === 'timeDuration' ? vocabulary.isoMinutes(ctx, form.text) : undefined;
   // Without the extension a BPSim WaitTime replaces the standard duration; a random one stays random as the deadline's timing.
   const wait = wl ? undefined : params?.wait, where = 'Deadline ' + id;
   if (wl) ext().vet(b.node, 'boundary', where);
   const after = wl ? ext().whole(wl.attrs, 'after', where) : wait ? (wait.dist ? undefined : wait.mean) : standard;
   if (!(wl ? after !== undefined || timing !== undefined : after !== undefined || wait?.dist)) {
    const meaningless = (form?.local ?? 'an empty timer') + ' has no business-minute meaning; use a timeDuration.';
    bad(form?.local === 'timeDuration' ? vocabulary.notIso(form.text) : meaningless);
    continue;
   }
   const cancel = b.node.attrs.cancelActivity === 'false' ? 'escalate' : 'interrupt';
   const mode: 'interrupt' | 'escalate' = wl ? ext().oneOf(wl.attrs, 'mode', ['interrupt', 'escalate'], where) : cancel, edge = out[0]!;
   edge.from = target.key;
   edge.deadline = true;
   const drawn = timing ? {timing: ext().distOf(timing, where + ' timing')} : wait?.dist ? {timing: wait.dist} : {};
   target.deadline = {mode, edge, ...after !== undefined ? {after} : {}, ...drawn};
   if (wait) {
    const how = wait.dist ? wait.dist.dist + ' distribution -> deadline timing' : 'constant -> deadline after';
    ctx.note(id, 'bpsim:WaitTime', 'flow:' + (edge.xml || '?'), how + ' (mean ' + wait.mean + ' min); replaces the timer duration');
   }
   if (wl?.attrs.flow) edge.id = wl.attrs.flow;
   b.folded = 'boundary';
   b.how = (mode === 'interrupt' ? 'interrupting' : 'non-interrupting') + ' timer boundary -> deadline (' + mode + ') on ' + target.xml;
   net.items.splice(net.items.indexOf(b), 1);
   ctx.note(id, 'boundaryEvent', 'flow:' + (edge.xml || '?'), b.how);
  }
 }
 /** Link throw events jump straight to the catch event of the same name. */
 function links(ctx: Ctx, net: Net): void {
  const catches = new Map(net.items.filter(i => i.link === 'catch').map(i => [i.linkName ?? '', i] as const));
  for (const t of net.items.filter(i => i.link === 'throw')) {
   const c = catches.get(t.linkName ?? '');
   if (!c) {
    const message = 'intermediateThrowEvent ' + t.xml + ' is a link throw event named "' + (t.linkName ?? '') + '" without a matching catch event.';
    ctx.reject(t.xml, 'intermediateThrowEvent', message);
    continue;
   }
   net.edges.push({key: t.key + '~link', xml: t.xml + '~link', from: t.key, to: c.key, node: undefined, synthetic: true});
   t.how = 'link throw -> direct flow to catch event ' + c.xml;
   c.how = 'link catch of "' + (c.linkName ?? '') + '"; folded';
  }
 }
 /** Standard loops: the task is followed by a decision that repeats it while the loop condition and the bounded counter allow. */
 function loops(ctx: Ctx, net: Net): void {
  for (const t of net.items.filter(i => i.loop)) {
   const loop = t.loop!;
   let base: LWProcess.When | undefined;
   if (loop.condition) {
    try {
     base = root.LWProcessBpmnExpr.parse(loop.condition);
    } catch (error) {
     ctx.warn('Loop ' + t.xml + ': the loop condition "' + loop.condition + '" cannot be evaluated (' + (error as Error).message
      + '); it repeats with a 50% chance while the counter allows.');
    }
   } else ctx.warn('Loop ' + t.xml + ' has no loop condition; it repeats with a 50% chance while the counter allows.');
   const bound = {field: loop.field, op: 'lt', value: loop.max} as LWProcess.When, leaf: LWProcess.When = base ?? {chance: 50};
   const out = net.edges.filter(e => e.from === t.key && !e.deadline);
   const d: Item = {key: t.key + '~loop', xml: t.xml + '-loop', local: 'exclusiveGateway', node: t.node, trail: t.trail, kind: 'decision',
    gateway: 'exclusive', synthetic: true, near: t.key, how: 'loop decision for ' + t.xml, lane: t.lane, phase: t.phase};
   net.items.push(d);
   net.byKey.set(d.key, d);
   for (const e of out) e.from = d.key;
   const when = leaf.all ? {all: [...leaf.all, bound]} : {all: [leaf, bound]};
   net.edges.push({key: t.key + '~next', xml: t.xml + '-next', from: t.key, to: d.key, node: undefined, synthetic: true},
    {key: t.key + '~repeat', xml: t.xml + '-repeat', from: d.key, to: t.key, node: undefined, synthetic: true, label: 'repeat', when});
  }
 }
 root.LWProcessBpmnGraph = {build, defs: n => root.LWProcessBpmnNodes.defs(n)};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessBpmnGraph;
})(globalThis);
