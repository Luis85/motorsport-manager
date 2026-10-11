/// <reference path="./process-bpmn-graph.ts" />
/// <reference path="./process-bpmn-pools.ts" />
/**
 * Steps of a BPMN import (LWProcessBpmnSteps), called by process-bpmn-assemble.ts once ids, joins, pools and scene positions
 * are known. Each flattened flow node becomes one step: the Wildlands extension restores exact values (durations, costs,
 * kinds, effects, needs, backlogs, journey notes, timing, draws and empty containers); without it, BPSim processing, wait
 * times and fixed costs apply, then the import defaults, and work steps demand the pools of their performers or lanes.
 * Mismatches between BPSim and the extension are warned, with the extension winning. Warnings that summarise all steps
 * (automated service tasks, defaulted durations) are returned for the caller to report after its rejection check.
 */
declare namespace LWProcessBpmnSteps {
 interface Scope {
  ctx: LWProcessBpmnGraph.Ctx; live: LWProcessBpmnGraph.Item[]; placed: Map<string, [number, number]>; bp: LWProcessBpmnPools.Bp;
  pools: LWProcessBpmnPools.Pools; lanePool: Map<string, LWProcess.Resource>;
  /** Fork item key -> its join item key, and the resolved id of every flow. */
  joins: Map<string, string>; flowId: Map<LWProcessBpmnGraph.Edge, string>;
 }
 /** `automated` names the service-type tasks that run as system steps; `defaulted` counts steps given the default duration. */
 interface Result {steps: LWProcess.Step[]; automated: string[]; defaulted: number;}
 interface Api {build(scope: Scope): Result;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessBpmnExport: {vocabulary: LWProcessBpmn.Vocabulary}; LWProcessBpmnExt: LWProcessBpmnExt.Api;
  LWProcessBpmnPools: LWProcessBpmnPools.Api; LWProcessBpmnSteps?: LWProcessBpmnSteps.Api};
 const {MODEL, COLORS} = root.LWProcessBpmnExport.vocabulary;
 type X = LWProcessXml.Node;
 type Item = LWProcessBpmnGraph.Item;
 type Scope = LWProcessBpmnSteps.Scope;
 type Result = LWProcessBpmnSteps.Result;
 const E = () => root.LWProcessBpmnExt;
 const kids = (n: X, l: string) => E().kids(n, l), first = (n: X, l: string) => E().first(n, l), extensions = (n: X, l: string) => E().extensions(n, l);
 /** The exact timing of a step from the extension, if any. */
 const single = (i: Item): LWProcess.Dist | undefined => {
  const t = E().single(E().extensions(i.node, 'timing'), 'timing', 'Step ' + i.xml);
  return t ? E().distOf(t, 'Step ' + i.xml + ' timing') : undefined;
 };
 /** Durations, waits and costs of tasks and timers: the extension, else BPSim, else the defaults. */
 function timed(s: Scope, out: Result, i: Item, sx: X | undefined, p: LWProcessBpmnBpsim.Params | undefined, step: LWProcess.Step): void {
  const ctx = s.ctx, ext = E(), where = 'Step ' + i.xml, defaultDuration = ctx.o.defaultDuration;
  const processing = p?.processing ?? (i.kind === 'timer' ? p?.wait : undefined);
  if (i.kind === 'task' || !i.timer) {
   if (sx?.attrs.duration) {
    step.duration = ext.whole(sx.attrs, 'duration', where)!;
    const mismatch = processing && (processing.dist ? ext.sig(processing.dist) !== ext.sig(single(i))
     : single(i) !== undefined || processing.mean !== step.duration);
    if (mismatch) ctx.warn('BPSim time of ' + i.xml + ' disagrees with the Wildlands duration/timing; the extension wins.');
   } else if (processing) {
    step.duration = processing.mean;
    if (processing.dist) step.timing = processing.dist;
    const how = (processing.dist ? processing.dist.dist + ' distribution -> timing' : 'constant -> duration') + ' of ' + processing.mean + ' min';
    ctx.note(i.xml, 'bpsim:' + (i.kind === 'timer' ? 'WaitTime' : 'ProcessingTime'), 'step:' + i.id, how);
   } else {
    step.duration = defaultDuration;
    out.defaulted++;
   }
  }
  if (i.timer) {
   const given = sx?.attrs.duration !== undefined || sx?.attrs.until !== undefined;
   if (!given && processing) {
    step.duration = processing.mean;
    if (processing.dist) step.timing = processing.dist;
    ctx.note(i.xml, 'bpsim:WaitTime', 'step:' + i.id, 'wait ' + processing.mean + ' min replaces the BPMN timer duration');
   } else {
    if (i.timer.duration !== undefined) step.duration = i.timer.duration;
    if (i.timer.until !== undefined) step.until = i.timer.until;
   }
  }
  if (sx?.attrs.cost) step.cost = ext.whole(sx.attrs, 'cost', where)!;
  else if (p?.fixedCost !== undefined && !sx && i.kind === 'task') {
   step.cost = Math.max(0, Math.round(p.fixedCost));
   ctx.note(i.xml, 'bpsim:FixedCost', 'step:' + i.id, 'fixed cost ' + step.cost + ' per task start');
  }
  if (sx?.attrs.cost && p?.fixedCost !== undefined && Math.round(p.fixedCost) !== Number(sx.attrs.cost)) {
   ctx.warn('BPSim FixedCost of ' + i.xml + ' disagrees with the Wildlands cost; the extension wins.');
  }
  if (i.wait) {
   if (!processing) {
    step.duration = defaultDuration;
    out.defaulted++;
   }
   ctx.note(i.xml, i.local, 'step:' + i.id, 'catch event simulated as a timer of ' + step.duration + ' min (message arrival is an assumption)');
  }
 }
 /** Pool demands from the task's performers (with their Wildlands quantities). */
 function performers(s: Scope, i: Item): Record<string, number> {
  const ctx = s.ctx, ext = E(), where = 'Step ' + i.xml, demand: Record<string, number> = {};
  for (const perf of i.node.children.filter(c => c.ns === MODEL && root.LWProcessBpmnPools.PERFORMERS.has(c.local))) {
   const ref = kids(perf, 'resourceRef')[0]?.text.trim();
   if (!ref) {
    ctx.warn('A performer of ' + i.xml + ' names no resourceRef and is ignored.');
    continue;
   }
   const r = s.pools.resources.get(ref.includes(':') ? ref.split(':').at(-1)! : ref);
   if (!r) {
    ctx.reject(i.xml, i.local, 'Task ' + i.xml + ' references an unknown resource ' + ref + '.');
    continue;
   }
   ext.vet(perf, 'performer', where + ' performer');
   const wanted = first(perf, 'demand');
   demand[r.id] = (wanted ? ext.whole(wanted.attrs, 'quantity', where + ' demand') ?? 1 : 1) + (demand[r.id] ?? 0);
  }
  return demand;
 }
 /** Work kinds, pool demands (performers, lanes or the automation pool), outputs, instances, loops and deadlines of a task. */
 function work(s: Scope, out: Result, i: Item, sx: X | undefined, step: LWProcess.Step): void {
  const ctx = s.ctx, o = ctx.o, demand = performers(s, i);
  const hasExt = sx !== undefined, explicit = Object.keys(demand).length > 0, kindExt = sx?.attrs.kind;
  if (kindExt !== undefined) {
   step.kind = kindExt as LWProcess.Kind;
   const expected = kindExt === 'system' ? 'serviceTask' : kindExt === 'machine' ? 'task' : kindExt === 'touchpoint' ? 'userTask' : undefined;
   if (expected && i.local !== expected) {
    ctx.warn('Step ' + i.xml + ' is a ' + i.local + ' but its Wildlands extension says ' + kindExt + '; the extension wins and admission checks apply.');
   }
  } else if (!hasExt && i.system) {
   const kinds = Object.keys(demand).map(id => s.pools.poolOf.get(id)?.kind ?? 'people');
   step.kind = o.autoSystemPool && (!explicit || kinds.every(k => k === 'system')) ? 'system' : 'task';
   if (!o.autoSystemPool) ctx.warn(i.local + ' ' + i.xml + ' imports as a timed task; no behaviour is executed.');
  }
  if (!hasExt && !explicit && o.lanes === 'pools' || !hasExt && !explicit && step.kind === 'system') {
   const lane = i.lane !== undefined && o.lanes === 'pools' ? s.lanePool.get(i.lane) : undefined;
   const people = lane && (lane.kind ?? 'people') === 'people' ? lane : undefined;
   const pool = step.kind === 'system' ? (lane && lane.kind === 'system' ? lane : s.pools.auto()) : people;
   if (pool) demand[pool.id] = 1;
   if (step.kind === 'system') out.automated.push(i.local + ' ' + i.xml + ' on "' + pool!.name + '"');
  }
  if (Object.keys(demand).length) step.resources = demand;
  if (i.local === 'receiveTask') ctx.warn('receiveTask ' + i.xml + ' waits for its processing time; message arrival is an assumption.');
  if (sx?.attrs.technology !== undefined) step.technology = sx.attrs.technology;
  const outputs = extensions(i.node, 'output');
  if (outputs.length) step.outputs = outputs.map(x => ({field: x.attrs.field!, ...x.attrs.label !== undefined ? {label: x.attrs.label} : {}}));
  if (i.instances) {
   step.instances = i.instances;
   ctx.note(i.xml, 'multiInstanceLoopCharacteristics', 'step:' + i.id, 'instances ' + JSON.stringify(i.instances));
  }
  if (i.loop) {
   step.add = {...step.add, [i.loop.field]: 1};
   ctx.note(i.xml, 'standardLoopCharacteristics', 'field:' + i.loop.field, 'counter loop (max ' + i.loop.max + ')');
  }
  if (i.deadline) {
   const dl = i.deadline;
   step.deadline = {mode: dl.mode, flow: s.flowId.get(dl.edge)!, ...dl.after !== undefined ? {after: dl.after} : {}, ...dl.timing ? {timing: dl.timing} : {}};
  }
 }
 /** Effects, needs, backlog, journey notes, timing, draws, the fork's join and containers an export marked empty. */
 function effects(s: Scope, i: Item, sx: X | undefined, step: LWProcess.Step): void {
  const ext = E(), where = 'Step ' + i.xml;
  if (sx?.attrs.until !== undefined && i.kind === 'timer') step.until = ext.whole(sx.attrs, 'until', where)!;
  const set = extensions(i.node, 'set');
  if (set.length) step.set = Object.fromEntries(set.map(x => [x.attrs.name!, ext.typed(x.attrs)]));
  const adds = extensions(i.node, 'add');
  if (adds.length) step.add = {...step.add, ...Object.fromEntries(adds.map(a => [a.attrs.name!, ext.whole(a.attrs, 'delta', where + ' add') ?? NaN]))};
  const needs = extensions(i.node, 'need');
  if (needs.length) {
   step.needs = needs.map(n => ({field: n.attrs.field!,
    ...n.attrs.op ? {op: ext.oneOf(n.attrs, 'op', ext.OPS, where + ' need'), value: ext.typed(n.attrs)} : {},
    ...n.attrs.label ? {label: n.attrs.label} : {}}));
  }
  const backlog = first(i.node, 'backlog'), at = where + ' backlog';
  if (backlog) {
   const a = backlog.attrs;
   step.backlog = {capacity: ext.whole(a, 'capacity', at) ?? NaN, ...a.order ? {order: ext.oneOf(a, 'order', ['fifo', 'lifo', 'priority'] as const, at)} : {},
    ...a.priority ? {priority: a.priority} : {}, ...a.pull ? {pull: ext.whole(a, 'pull', at)!} : {}};
  }
  if (sx) ext.journeyOf(sx, step, 'Step ' + i.xml);
  const timing = ext.single(extensions(i.node, 'timing'), 'timing', 'Step ' + i.xml);
  if (timing) step.timing = ext.distOf(timing, 'Step ' + i.xml + ' timing');
  const draws = extensions(i.node, 'draw');
  if (draws.length) step.draws = ext.drawsOf(draws, 'Step ' + i.xml);
  if (i.kind === 'fork') {
   step.join = s.live.find(j => j.key === s.joins.get(i.key))!.id!;
   if (i.gateway === 'inclusive') step.mode = 'inclusive';
  }
  // Containers an export wrote as present but empty come back empty, so a valid definition keeps its fingerprint.
  for (const k of ext.empties(sx, ['set', 'add', 'resources', 'needs', 'outputs', 'draws'] as const, where)) {
   if (step[k] !== undefined) throw Error(where + ': ' + k + ' is marked empty but has entries.');
   if (k === 'needs' || k === 'outputs' || k === 'draws') step[k] = [];
   else step[k] = {};
  }
 }
 function stepOf(s: Scope, out: Result, i: Item): LWProcess.Step {
  const ext = E(), where = 'Step ' + i.xml;
  ext.vet(i.node, 'step', where);
  const sx = first(i.node, 'step'), scene = first(i.node, 'scene'), [x, y] = s.placed.get(i.key)!, p = s.bp(i.xml);
  const asset = scene && extensions(i.node, 'scene')[0]?.children.find(c => c.local === 'asset');
  const name = i.synthetic ? 'Repeat ' + (i.node.attrs.name || i.node.attrs.id) + '?' : i.node.attrs.name || i.xml;
  const step: LWProcess.Step = {id: i.id!, name: name.slice(0, 120), kind: i.kind as LWProcess.Kind, scene: {id: scene?.attrs.id ?? 'scene-' + i.id,
   position: [x, y], color: scene?.attrs.color ?? COLORS[i.kind]!, ...asset ? {asset: JSON.parse(asset.text) as object} : {}}};
  const description = ext.documentation(i.node, sx !== undefined);
  if (description !== undefined) {
   step.description = description.slice(0, 2000);
   if (description.length > 2000) s.ctx.warn('Documentation of ' + i.xml + ' was cut to 2000 characters.');
  }
  if (i.phase) step.phase = i.phase.slice(0, 40);
  if (i.lost) step.outcome = 'lost';
  if (i.kind === 'task' || i.kind === 'timer') timed(s, out, i, sx, p, step);
  if (i.kind === 'task') work(s, out, i, sx, step);
  effects(s, i, sx, step);
  return step;
 }
 function build(s: Scope): Result {
  const out: Result = {steps: [], automated: [], defaulted: 0};
  out.steps = s.live.map(i => stepOf(s, out, i));
  return out;
 }
 root.LWProcessBpmnSteps = {build};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessBpmnSteps;
})(globalThis);
