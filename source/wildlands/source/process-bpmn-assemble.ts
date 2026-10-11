/// <reference path="./process-bpmn-flow.ts" />
/// <reference path="./process-bpmn-bpsim.ts" />
/// <reference path="./process-bpmn-tail.ts" />
/// <reference path="./process-bpmn-fold.ts" />
/// <reference path="./process-bpmn-pools.ts" />
/// <reference path="./process-bpmn-layout.ts" />
/// <reference path="./process-bpmn-steps.ts" />
/**
 * Assembles a Wildlands definition from foreign BPMN (LWProcessBpmnImportParts): chooses the process and the BPSim scenario,
 * builds and folds the flat graph (process-bpmn-graph.ts, process-bpmn-fold.ts), gives gateways their roles, resolves ids,
 * joins and conditions (process-bpmn-flow.ts), then delegates pools (process-bpmn-pools.ts), scene positions
 * (process-bpmn-layout.ts), steps (process-bpmn-steps.ts) and the definition with its report (process-bpmn-tail.ts).
 * `halt` stops the import at each stage that collected rejections, so later stages never judge a broken graph.
 */
declare namespace LWProcessBpmnParts {
 interface Api {run(source: string, ctx: LWProcessBpmnGraph.Ctx, info: LWProcessBpmn.Info, halt: () => void): LWProcess.Definition | undefined;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessXml: LWProcessXml.Api; LWProcessBpmnExport: {vocabulary: LWProcessBpmn.Vocabulary}; LWProcessBpmnExt: LWProcessBpmnExt.Api;
  LWProcessBpmnBpsim: LWProcessBpmnBpsim.Api; LWProcessBpmnGraph: LWProcessBpmnGraph.Api; LWProcessBpmnFold: LWProcessBpmnFold.Api;
  LWProcessBpmnFlow: LWProcessBpmnFlow.Api; LWProcessBpmnPools: LWProcessBpmnPools.Api; LWProcessBpmnLayout: LWProcessBpmnLayout.Api;
  LWProcessBpmnSteps: LWProcessBpmnSteps.Api; LWProcessBpmnTail: LWProcessBpmnTail.Api; LWProcessBpmnImportParts?: LWProcessBpmnParts.Api};
 const {MODEL} = root.LWProcessBpmnExport.vocabulary;
 type X = LWProcessXml.Node;
 type Item = LWProcessBpmnGraph.Item;
 type Ctx = LWProcessBpmnGraph.Ctx;
 type Net = LWProcessBpmnGraph.Net;
 const E = () => root.LWProcessBpmnExt;
 const kids = (n: X, l: string, ns?: string) => E().kids(n, l, ns), first = (n: X, l: string) => E().first(n, l);
 /** The process to import: the `process` option (by id, name or participant), else the first executable process, else the first. */
 function choose(ctx: Ctx, doc: X, info: LWProcessBpmn.Info): {proc: X; collab: X | undefined; participants: X[]} {
  const o = ctx.o, processes = kids(doc, 'process');
  if (!processes.length) throw Error('Import needs at least one process; this file has 0.');
  ctx.processes = processes;
  info.processes = processes.map(p => ({id: p.attrs.id ?? '', name: p.attrs.name || p.attrs.id || '', executable: p.attrs.isExecutable === 'true'}));
  const collab = kids(doc, 'collaboration')[0], participants = collab ? kids(collab, 'participant') : [];
  const viaParticipant = (id: string) => processes.find(p => p.attrs.id === participants.find(x => x.attrs.id === id || x.attrs.name === id)?.attrs.processRef);
  const proc = o.process !== null ? processes.find(p => p.attrs.id === o.process || p.attrs.name === o.process) ?? viaParticipant(o.process)
   : processes.find(p => p.attrs.isExecutable === 'true') ?? processes[0]!;
  if (!proc) throw Error('Process "' + o.process + '" was not found; the file has ' + processes.map(p => '"' + (p.attrs.id ?? '') + '"').join(', ') + '.');
  info.process = {id: proc.attrs.id ?? '', name: proc.attrs.name || proc.attrs.id || ''};
  info.scenarios = root.LWProcessBpmnBpsim.scenarios(doc);
  if (o.bpsim) {
   const options = {minutesPerDay: o.minutesPerDay, minutesPerHour: o.minutesPerHour, scenario: o.scenario ?? undefined, warn: ctx.warn};
   ctx.bps = root.LWProcessBpmnBpsim.read(doc, options);
   if (ctx.bps) {
    info.scenario = ctx.bps.scenario.id || ctx.bps.scenario.name;
    info.horizon = ctx.bps.horizon;
   } else if (o.scenario !== null) ctx.warn('The scenario option is ignored: the file has no BPSim data.');
  }
  return {proc, collab, participants};
 }
 /** After dropping unsupported elements, the start must still reach an end and every step must still have a route to one. */
 function stillRoutes(ctx: Ctx, net: Net, start: Item): void {
  const back = new Set(net.items.filter(i => i.kind === 'end').map(i => i.key)), fwd = new Set([start.key]);
  for (let go = true; go;) {
   go = false;
   for (const e of net.edges) {
    if (back.has(e.to) && !back.has(e.from)) {
     back.add(e.from);
     go = true;
    }
    if (fwd.has(e.from) && !fwd.has(e.to)) {
     fwd.add(e.to);
     go = true;
    }
   }
  }
  if (!net.items.some(i => i.kind === 'end' && fwd.has(i.key))) {
   ctx.reject(start.xml, start.local, 'After dropping unsupported elements no end event is reachable from the start event.');
   return;
  }
  for (const i of net.items) {
   if (!back.has(i.key)) ctx.reject(i.xml, i.local, 'After dropping unsupported elements ' + i.local + ' ' + i.xml + ' has no route to an end event.');
  }
 }
 /** Wildlands ids of steps and flows: the extension's exact ids first, then ids sanitized from the BPMN ids. */
 function ids(ctx: Ctx, net: Net, live: Item[]): void {
  const steps = new Set<string>(), flows = new Set<string>();
  for (const i of live) {
   const id = first(i.node, 'step')?.attrs.id;
   if (!id) continue;
   if (steps.has(id)) ctx.reject(i.xml, i.local, 'Duplicate Wildlands step id ' + id + '.');
   steps.add(id);
   i.id = id;
  }
  for (const i of live) i.id ??= E().sanitize([...i.trail, i.xml].join('-'), steps, i.kind);
  for (const e of net.edges) {
   const id = (e.node && first(e.node, 'flow')?.attrs.id) ?? e.id;
   if (!id) continue;
   flows.add(id);
   e.id = id;
  }
  for (const e of net.edges) e.id ??= E().sanitize(e.key.replaceAll('/', '-'), flows, 'flow');
 }
 function run(source: string, ctx: Ctx, info: LWProcessBpmn.Info, halt: () => void): LWProcess.Definition | undefined {
  const warn = ctx.warn, graph = root.LWProcessBpmnGraph, fold = root.LWProcessBpmnFold, flow = root.LWProcessBpmnFlow, ext = E();
  const doc = root.LWProcessXml.parse(source);
  if (doc.ns !== MODEL || doc.local !== 'definitions') throw Error('Expected a BPMN 2.0 definitions document.');
  const {proc, collab, participants} = choose(ctx, doc, info);
  const used = new Set<string>(), bp = (ref: string) => {
   const p = ctx.bps?.elements.get(ref);
   if (p) used.add(ref);
   return p;
  };
  // ------------------------------------------------------------ graph
  const net = graph.build(ctx, proc);
  const others = ctx.processes.filter(x => x !== proc && !net.callees.has(x.attrs.id ?? ''));
  if (others.length) {
   ctx.warn('The file has ' + (others.length + 1) + ' processes; "' + (proc.attrs.id ?? '') + '" was imported. Not imported: '
    + others.map(x => '"' + (x.attrs.id ?? '') + '"').join(', ') + '. Use the process option to choose another.');
  }
  halt();
  const start = net.items.find(i => i.kind === 'start' && !i.trail.length), dropped = net.items.some(i => i.drop);
  if (dropped) fold.prune(ctx, net, start);
  fold.contract(ctx, net);
  halt();
  if (dropped && start) {
   stillRoutes(ctx, net, start);
   halt();
  }
  flow.roles(ctx, net);
  halt();
  // ------------------------------------------------------------ resources, ids, joins and conditions
  const live = net.items, pools = root.LWProcessBpmnPools.declared(ctx, doc, live, bp);
  ids(ctx, net, live);
  halt();
  const joins = flow.pair(ctx, net);
  halt();
  flow.conditions(ctx, net);
  halt();
  const byKey = new Map(live.map(i => [i.key, i] as const));
  const lanePool = root.LWProcessBpmnPools.lanes(ctx, net, live, pools, bp);
  // ------------------------------------------------------------ layout and steps
  const placed = root.LWProcessBpmnLayout.place(ctx, doc, net, live, byKey, start);
  const flowId = new Map(net.edges.map(e => [e, e.id!] as const));
  const made = root.LWProcessBpmnSteps.build({ctx, live, placed, bp, pools, lanePool, joins, flowId});
  halt();
  if (made.automated.length) {
   warn(made.automated.length + ' service-type task(s) run as automated system steps; no behaviour is executed: ' + made.automated.join(', ') + '.');
  }
  if (made.defaulted) warn(made.defaulted + ' task(s) had no duration and were given ' + ctx.o.defaultDuration + ' minutes; tune them in the editor.');
  for (const e of net.edges) if (e.node) ext.vet(e.node, 'flow', 'Flow ' + e.xml);
  const flowList: LWProcess.Flow[] = net.edges.map(e => ({id: e.id!, from: byKey.get(e.from)!.id!, to: byKey.get(e.to)!.id!,
   ...e.label ? {label: e.label.slice(0, 120)} : {}, ...e.when ? {when: e.when} : {}, ...e.deadline ? {on: 'deadline' as const} : {}}));
  const resources = [...pools.resources.values()];
  return root.LWProcessBpmnTail.finish(ctx, doc, proc, collab, participants, {steps: made.steps, flows: flowList, resources, net, start, bp, used});
 }
 root.LWProcessBpmnImportParts = {run};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessBpmnImportParts;
})(globalThis);
