/// <reference path="./process-bpmn-flow.ts" />
/// <reference path="./process-bpmn-bpsim.ts" />
/// <reference path="./process-bpmn-tail.ts" />
/** Assembles a Wildlands definition from the flattened foreign graph: pools from lanes, steps with BPSim timing, costs and arrivals, flows with conditions, layout, SIPOC from collaborations and the per-element mapping report. */
declare namespace LWProcessBpmnParts {
 interface Api {run(source: string, ctx: LWProcessBpmnGraph.Ctx, info: LWProcessBpmn.Info, halt: () => void): LWProcess.Definition | undefined;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessXml: LWProcessXml.Api; LWProcessBpmnExport: {vocabulary: LWProcessBpmn.Vocabulary}; LWProcessBpmnExt: LWProcessBpmnExt.Api; LWProcessBpmnBpsim: LWProcessBpmnBpsim.Api; LWProcessBpmnGraph: LWProcessBpmnGraph.Api; LWProcessBpmnFlow: LWProcessBpmnFlow.Api; LWProcessBpmnTail: LWProcessBpmnTail.Api; LWProcessBpmnImportParts?: LWProcessBpmnParts.Api};
 const {MODEL, DI, DC, UNIT, COLORS} = root.LWProcessBpmnExport.vocabulary;
 type X = LWProcessXml.Node; type Item = LWProcessBpmnGraph.Item; type Ctx = LWProcessBpmnGraph.Ctx;
 const E = () => root.LWProcessBpmnExt, kids = (n: X, l: string, ns?: string) => E().kids(n, l, ns), first = (n: X, l: string) => E().first(n, l), extensions = (n: X, l: string) => E().extensions(n, l);
 const PERFORMERS = new Set(['performer', 'humanPerformer', 'potentialOwner', 'resourceRole']), SYSTEM_LANE = /system|service|automat|engine|robot|\bbot\b|\bapi\b|software|batch|server|platform|\bai\b/i;
 function run(source: string, ctx: Ctx, info: LWProcessBpmn.Info, halt: () => void): LWProcess.Definition | undefined {
  const o = ctx.o, warn = ctx.warn, graph = root.LWProcessBpmnGraph, flow = root.LWProcessBpmnFlow, ext = E();
  const doc = root.LWProcessXml.parse(source);
  if (doc.ns !== MODEL || doc.local !== 'definitions') throw Error('Expected a BPMN 2.0 definitions document.');
  const processes = kids(doc, 'process'); if (!processes.length) throw Error('Import needs at least one process; this file has 0.');
  ctx.processes = processes;
  info.processes = processes.map(p => ({id: p.attrs.id ?? '', name: p.attrs.name || p.attrs.id || '', executable: p.attrs.isExecutable === 'true'}));
  // ------------------------------------------------------------ process and BPSim choice
  const collab = kids(doc, 'collaboration')[0], participants = collab ? kids(collab, 'participant') : [];
  const viaParticipant = (id: string) => processes.find(p => p.attrs.id === participants.find(x => x.attrs.id === id || x.attrs.name === id)?.attrs.processRef);
  const proc = o.process !== null ? processes.find(p => p.attrs.id === o.process || p.attrs.name === o.process) ?? viaParticipant(o.process) : processes.find(p => p.attrs.isExecutable === 'true') ?? processes[0]!;
  if (!proc) throw Error('Process "' + o.process + '" was not found; the file has ' + processes.map(p => '"' + (p.attrs.id ?? '') + '"').join(', ') + '.');
  info.process = {id: proc.attrs.id ?? '', name: proc.attrs.name || proc.attrs.id || ''};
  info.scenarios = root.LWProcessBpmnBpsim.scenarios(doc);
  if (o.bpsim) {
   ctx.bps = root.LWProcessBpmnBpsim.read(doc, {minutesPerDay: o.minutesPerDay, minutesPerHour: o.minutesPerHour, scenario: o.scenario ?? undefined, warn});
   if (ctx.bps) { info.scenario = ctx.bps.scenario.id || ctx.bps.scenario.name; info.horizon = ctx.bps.horizon; } else if (o.scenario !== null) warn('The scenario option is ignored: the file has no BPSim data.');
  }
  const used = new Set<string>(), bp = (ref: string) => { const p = ctx.bps?.elements.get(ref); if (p) used.add(ref); return p; };
  // ------------------------------------------------------------ graph
  const net = graph.build(ctx, proc);
  const others = processes.filter(x => x !== proc && !net.callees.has(x.attrs.id ?? ''));
  if (others.length) ctx.warn('The file has ' + (others.length + 1) + ' processes; "' + (proc.attrs.id ?? '') + '" was imported. Not imported: ' + others.map(x => '"' + (x.attrs.id ?? '') + '"').join(', ') + '. Use the process option to choose another.');
  halt();
  const taken = {steps: new Set<string>(), flows: new Set<string>(), resources: new Set<string>()}, resources = new Map<string, LWProcess.Resource>(), poolOf = new Map<string, LWProcess.Resource>();
  const start = net.items.find(i => i.kind === 'start' && !i.trail.length), dropped = net.items.some(i => i.drop);
  if (dropped) graph.prune(ctx, net, start);
  graph.contract(ctx, net); halt();
  if (dropped && start) {
   const back = new Set(net.items.filter(i => i.kind === 'end').map(i => i.key)), fwd = new Set([start.key]);
   for (let go = true; go;) { go = false; for (const e of net.edges) { if (back.has(e.to) && !back.has(e.from)) { back.add(e.from); go = true; } if (fwd.has(e.from) && !fwd.has(e.to)) { fwd.add(e.to); go = true; } } }
   if (!net.items.some(i => i.kind === 'end' && fwd.has(i.key))) ctx.reject(start.xml, start.local, 'After dropping unsupported elements no end event is reachable from the start event.');
   else for (const i of net.items) if (!back.has(i.key)) ctx.reject(i.xml, i.local, 'After dropping unsupported elements ' + i.local + ' ' + i.xml + ' has no route to an end event.');
   halt();
  }
  flow.roles(ctx, net); halt();
  // ------------------------------------------------------------ resources
  const live = net.items;
  for (const r of kids(doc, 'resource')) {
   const wl = first(r, 'resource'), xmlId = r.attrs.id ?? '', where = 'Resource ' + xmlId; if (!xmlId) continue;
   ext.vet(r, 'resource', where);
   const id = wl?.attrs.id ?? E().sanitize(xmlId, taken.resources, 'resource'); taken.resources.add(id);
   const p = bp(xmlId), cost = p?.unitCost !== undefined ? Math.round(p.unitCost) : undefined;
   // A foreign resource only service-type tasks perform is a system pool; the extension (when present) is exact.
   const users = live.filter(i => i.kind === 'task' && i.node.children.some(c => c.ns === MODEL && PERFORMERS.has(c.local) && kids(c, 'resourceRef').some(x => x.text.trim().split(':').at(-1) === xmlId))), serviceOnly = o.autoSystemPool && users.length > 0 && users.every(i => i.system);
   const pool: LWProcess.Resource = {id, name: (r.attrs.name || id).slice(0, 120), capacity: (wl && ext.whole(wl.attrs, 'capacity', where)) ?? p?.quantity ?? o.defaultCapacity, costPerMinute: (wl && ext.whole(wl.attrs, 'costPerMinute', where)) ?? cost ?? 0, ...wl?.attrs.kind !== undefined ? {kind: ext.oneOf(wl.attrs, 'kind', ['people', 'machine', 'system'] as const, where)} : !wl && serviceOnly ? {kind: 'system' as const} : {}};
   if (wl && p?.quantity !== undefined && p.quantity !== pool.capacity) warn('BPSim Quantity ' + p.quantity + ' of resource ' + xmlId + ' disagrees with the Wildlands capacity ' + pool.capacity + '; the extension wins.');
   if (wl && cost !== undefined && cost !== pool.costPerMinute) warn('BPSim UnitCost of resource ' + xmlId + ' disagrees with the Wildlands cost per minute ' + pool.costPerMinute + '; the extension wins.');
   resources.set(xmlId, pool); poolOf.set(id, pool);
   if (p?.quantity !== undefined) ctx.note(xmlId, 'bpsim:Quantity', 'pool:' + id, 'capacity ' + p.quantity + (wl ? ' (the extension wins)' : ''));
   if (cost !== undefined) ctx.note(xmlId, 'bpsim:UnitCost', 'pool:' + id, 'cost per minute ' + cost + (wl ? ' (the extension wins)' : ''));
   ctx.note(xmlId, 'resource', 'pool:' + id, wl ? 'restored from the Wildlands extension' : 'pool' + (p ? ' with BPSim quantity/cost' : ''));
   if (!wl && !p) warn('Resources have capacity 1 and no cost unless set in Wildlands.');
  }
  // ------------------------------------------------------------ ids
  for (const i of live) { const id = first(i.node, 'step')?.attrs.id; if (id) { if (taken.steps.has(id)) ctx.reject(i.xml, i.local, 'Duplicate Wildlands step id ' + id + '.'); taken.steps.add(id); i.id = id; } }
  for (const i of live) i.id ??= E().sanitize([...i.trail, i.xml].join('-'), taken.steps, i.kind);
  for (const e of net.edges) { const id = (e.node && first(e.node, 'flow')?.attrs.id) ?? e.id; if (id) { taken.flows.add(id); e.id = id; } }
  for (const e of net.edges) e.id ??= E().sanitize(e.key.replaceAll('/', '-'), taken.flows, 'flow');
  halt();
  const joins = flow.pair(ctx, net); halt(); flow.conditions(ctx, net); halt();
  const byKey = new Map(live.map(i => [i.key, i] as const));
  // ------------------------------------------------------------ pools from lanes and the automation pool
  const autoPool = () => {
   let pool = [...poolOf.values()].find(p => p.name === 'Automation' && p.kind === 'system');
   if (!pool) { pool = {id: E().sanitize('automation', taken.resources, 'pool'), name: 'Automation', capacity: o.systemCapacity, costPerMinute: 1, kind: 'system'}; resources.set('~automation', pool); poolOf.set(pool.id, pool); }
   return pool;
  };
  const laneUse = new Map<string, {people: number; service: number}>();
  const bare = (i: Item) => i.kind === 'task' && !first(i.node, 'step') && !i.node.children.some(c => c.ns === MODEL && PERFORMERS.has(c.local));
  for (const i of live.filter(bare)) if (i.lane !== undefined && o.lanes === 'pools') { const u = laneUse.get(i.lane) ?? {people: 0, service: 0}; if (i.system && o.autoSystemPool) u.service++; else u.people++; laneUse.set(i.lane, u); }
  const lanePool = new Map<string, LWProcess.Resource>();
  for (const [laneId, use] of laneUse) {
   const name = net.lanes.get(laneId) || laneId, existing = [...poolOf.values()].find(p => p.name === name && (p.kind ?? 'people') === (use.people === 0 && o.autoSystemPool && (use.service > 0 || SYSTEM_LANE.test(name)) ? 'system' : 'people'));
   if (existing) { lanePool.set(laneId, existing); continue; }
   const system = use.people === 0 && o.autoSystemPool && (use.service > 0 || SYSTEM_LANE.test(name)), p = bp(laneId), cost = p?.unitCost !== undefined ? Math.round(p.unitCost) : 0;
   const pool: LWProcess.Resource = {id: E().sanitize(name, taken.resources, 'pool'), name: name.slice(0, 120), capacity: Math.max(1, Math.min(1000, p?.quantity ?? (system ? o.systemCapacity : o.defaultCapacity))), costPerMinute: cost, ...system ? {kind: 'system' as const} : {}};
   resources.set('~lane:' + laneId, pool); poolOf.set(pool.id, pool); lanePool.set(laneId, pool);
   if (p?.quantity !== undefined) ctx.note(laneId, 'bpsim:Quantity', 'pool:' + pool.id, 'capacity ' + p.quantity);
   if (p?.unitCost !== undefined) ctx.note(laneId, 'bpsim:UnitCost', 'pool:' + pool.id, 'cost per minute ' + cost);
   ctx.note(laneId, 'lane', 'pool:' + pool.id, (system ? 'system' : 'people') + ' pool, capacity ' + pool.capacity + (p?.quantity !== undefined ? ' (BPSim Quantity)' : ' (default capacity)') + '; its tasks demand 1');
  }
  if (o.lanes === 'pools') for (const [id, name] of net.lanes) if (!lanePool.has(id)) ctx.note(id, 'lane', 'none', 'lane "' + name + '" needs no pool: none of its tasks lacks an explicit performer or Wildlands step data');
  if (o.lanes === 'ignore' && net.lanes.size) { warn('Lanes are ignored (lanes option "ignore"): tasks demand no pools.'); for (const [id, name] of net.lanes) ctx.note(id, 'lane', 'none', 'ignored lane "' + name + '"'); }
  // ------------------------------------------------------------ layout
  const centers = new Map<string, [number, number]>();
  for (const shape of doc.children.filter(c => c.local === 'BPMNDiagram').flatMap(d => d.children.flatMap(p => p.children.filter(s => s.local === 'BPMNShape' && s.ns === DI)))) {
   const b = shape.children.find(c => c.local === 'Bounds' && c.ns === DC); if (b && shape.attrs.bpmnElement) centers.set(shape.attrs.bpmnElement, [Number(b.attrs.x) + Number(b.attrs.width) / 2, Number(b.attrs.y) + Number(b.attrs.height) / 2]);
  }
  const placed = new Map<string, [number, number]>(), centerOf = (i: Item) => centers.get(i.near ? byKey.get(i.near)?.xml ?? '' : i.xml);
  const coordinate = (i: Item, s: X, k: 'x' | 'y') => { const raw = s.attrs[k] ?? '', v = Number(raw); if (!raw.trim() || !Number.isFinite(v)) throw Error('Step ' + i.xml + ' scene: ' + k + ' "' + raw + '" must be a number.'); return v; };
  if (live.every(i => first(i.node, 'scene'))) live.forEach(i => { const s = first(i.node, 'scene')!; placed.set(i.key, [coordinate(i, s, 'x'), coordinate(i, s, 'y')]); });
  else if (live.every(i => centerOf(i))) {
   const minX = Math.min(...live.map(i => centerOf(i)![0])), minY = Math.min(...live.map(i => centerOf(i)![1]));
   live.forEach(i => placed.set(i.key, [Math.round((centerOf(i)![0] - minX) / UNIT * 10) / 10 + (i.near ? 8 : 0), Math.round((centerOf(i)![1] - minY) / UNIT * 10) / 10 + (i.near ? 6 : 0)]));
  } else {
   warn('The file has no complete diagram layout; scenes were arranged automatically.');
   const depth = new Map<string, number>([[(start ?? live[0]!).key, 0]]), queue = [...depth.keys()], rows = new Map<number, number>();
   while (queue.length) { const k = queue.shift()!; for (const f of net.edges) if (f.from === k && !depth.has(f.to)) { depth.set(f.to, depth.get(k)! + 1); queue.push(f.to); } }
   for (const i of live) { const x = depth.get(i.key) ?? 0, row = rows.get(x) ?? 0; rows.set(x, row + 1); placed.set(i.key, [x * 14, row * 12]); }
  }
  // ------------------------------------------------------------ steps
  const defaultDuration = o.defaultDuration, automated: string[] = []; let defaulted = 0;
  const flowId = new Map(net.edges.map(e => [e, e.id!] as const));
  const steps: LWProcess.Step[] = live.map(i => {
   const where = 'Step ' + i.xml; ext.vet(i.node, 'step', where);
   const sx = first(i.node, 'step'), scene = first(i.node, 'scene'), [x, y] = placed.get(i.key)!, asset = scene && extensions(i.node, 'scene')[0]?.children.find(c => c.local === 'asset'), p = bp(i.xml);
   const step: LWProcess.Step = {id: i.id!, name: (i.synthetic ? 'Repeat ' + (i.node.attrs.name || i.node.attrs.id) + '?' : i.node.attrs.name || i.xml).slice(0, 120), kind: i.kind as LWProcess.Kind, scene: {id: scene?.attrs.id ?? 'scene-' + i.id, position: [x, y], color: scene?.attrs.color ?? COLORS[i.kind]!, ...asset ? {asset: JSON.parse(asset.text) as object} : {}}};
   const description = ext.documentation(i.node, sx !== undefined);
   if (description !== undefined) { step.description = description.slice(0, 2000); if (description.length > 2000) warn('Documentation of ' + i.xml + ' was cut to 2000 characters.'); }
   if (i.phase) step.phase = i.phase.slice(0, 40);
   if (i.lost) step.outcome = 'lost';
   if (i.kind === 'task' || i.kind === 'timer') {
    const processing = p?.processing ?? (i.kind === 'timer' ? p?.wait : undefined);
    if (i.kind === 'task' || !i.timer) {
     if (sx?.attrs.duration) {
      step.duration = ext.whole(sx.attrs, 'duration', where)!;
      const mismatch = processing && (processing.dist ? ext.sig(processing.dist) !== ext.sig(single(i)) : single(i) !== undefined || processing.mean !== step.duration);
      if (mismatch) warn('BPSim time of ' + i.xml + ' disagrees with the Wildlands duration/timing; the extension wins.');
     } else if (processing) { step.duration = processing.mean; if (processing.dist) step.timing = processing.dist; ctx.note(i.xml, 'bpsim:' + (i.kind === 'timer' ? 'WaitTime' : 'ProcessingTime'), 'step:' + i.id, (processing.dist ? processing.dist.dist + ' distribution -> timing' : 'constant -> duration') + ' of ' + processing.mean + ' min'); }
     else { step.duration = defaultDuration; defaulted++; }
    }
    if (i.timer) {
     const given = sx?.attrs.duration !== undefined || sx?.attrs.until !== undefined;
     if (!given && processing) { step.duration = processing.mean; if (processing.dist) step.timing = processing.dist; ctx.note(i.xml, 'bpsim:WaitTime', 'step:' + i.id, 'wait ' + processing.mean + ' min replaces the BPMN timer duration'); }
     else { if (i.timer.duration !== undefined) step.duration = i.timer.duration; if (i.timer.until !== undefined) step.until = i.timer.until; }
    }
    if (sx?.attrs.cost) step.cost = ext.whole(sx.attrs, 'cost', where)!;
    else if (p?.fixedCost !== undefined && !sx && i.kind === 'task') { step.cost = Math.max(0, Math.round(p.fixedCost)); ctx.note(i.xml, 'bpsim:FixedCost', 'step:' + i.id, 'fixed cost ' + step.cost + ' per task start'); }
    if (sx?.attrs.cost && p?.fixedCost !== undefined && Math.round(p.fixedCost) !== Number(sx.attrs.cost)) warn('BPSim FixedCost of ' + i.xml + ' disagrees with the Wildlands cost; the extension wins.');
    if (i.wait) {
     if (!processing) { step.duration = defaultDuration; defaulted++; }
     ctx.note(i.xml, i.local, 'step:' + i.id, 'catch event simulated as a timer of ' + step.duration + ' min (message arrival is an assumption)');
    }
   }
   if (i.kind === 'task') {
    const demand: Record<string, number> = {};
    for (const perf of i.node.children.filter(c => c.ns === MODEL && PERFORMERS.has(c.local))) {
     const ref = kids(perf, 'resourceRef')[0]?.text.trim();
     if (!ref) { warn('A performer of ' + i.xml + ' names no resourceRef and is ignored.'); continue; }
     const r = resources.get(ref.includes(':') ? ref.split(':').at(-1)! : ref);
     if (!r) { ctx.reject(i.xml, i.local, 'Task ' + i.xml + ' references an unknown resource ' + ref + '.'); continue; }
     ext.vet(perf, 'performer', where + ' performer'); const wanted = first(perf, 'demand');
     demand[r.id] = (wanted ? ext.whole(wanted.attrs, 'quantity', where + ' demand') ?? 1 : 1) + (demand[r.id] ?? 0);
    }
    const hasExt = sx !== undefined, explicit = Object.keys(demand).length > 0, kindExt = sx?.attrs.kind;
    if (kindExt !== undefined) {
     step.kind = kindExt as LWProcess.Kind;
     const expected = kindExt === 'system' ? 'serviceTask' : kindExt === 'machine' ? 'task' : kindExt === 'touchpoint' ? 'userTask' : undefined;
     if (expected && i.local !== expected) warn('Step ' + i.xml + ' is a ' + i.local + ' but its Wildlands extension says ' + kindExt + '; the extension wins and admission checks apply.');
    } else if (!hasExt && i.system) {
     const kinds = Object.keys(demand).map(id => poolOf.get(id)?.kind ?? 'people');
     step.kind = o.autoSystemPool && (!explicit || kinds.every(k => k === 'system')) ? 'system' : 'task';
     if (!o.autoSystemPool) warn(i.local + ' ' + i.xml + ' imports as a timed task; no behaviour is executed.');
    }
    if (!hasExt && !explicit && o.lanes === 'pools' || !hasExt && !explicit && step.kind === 'system') {
     const lane = i.lane !== undefined && o.lanes === 'pools' ? lanePool.get(i.lane) : undefined;
     const pool = step.kind === 'system' ? (lane && lane.kind === 'system' ? lane : autoPool()) : lane && (lane.kind ?? 'people') === 'people' ? lane : undefined;
     if (pool) demand[pool.id] = 1;
     if (step.kind === 'system') automated.push(i.local + ' ' + i.xml + ' on "' + pool!.name + '"');
    }
    if (Object.keys(demand).length) step.resources = demand;
    if (i.local === 'receiveTask') warn('receiveTask ' + i.xml + ' waits for its processing time; message arrival is an assumption.');
    if (sx?.attrs.technology !== undefined) step.technology = sx.attrs.technology;
    const outputs = extensions(i.node, 'output'); if (outputs.length) step.outputs = outputs.map(out => ({field: out.attrs.field!, ...out.attrs.label !== undefined ? {label: out.attrs.label} : {}}));
    if (i.instances) { step.instances = i.instances; ctx.note(i.xml, 'multiInstanceLoopCharacteristics', 'step:' + i.id, 'instances ' + JSON.stringify(i.instances)); }
    if (i.loop) { step.add = {...step.add, [i.loop.field]: 1}; ctx.note(i.xml, 'standardLoopCharacteristics', 'field:' + i.loop.field, 'counter loop (max ' + i.loop.max + ')'); }
    if (i.deadline) {
     step.deadline = {mode: i.deadline.mode, flow: flowId.get(i.deadline.edge)!, ...i.deadline.after !== undefined ? {after: i.deadline.after} : {}, ...i.deadline.timing ? {timing: i.deadline.timing} : {}};
    }
   }
   if (sx?.attrs.until !== undefined && i.kind === 'timer') step.until = ext.whole(sx.attrs, 'until', where)!;
   const set = extensions(i.node, 'set'); if (set.length) step.set = Object.fromEntries(set.map(s => [s.attrs.name!, ext.typed(s.attrs)]));
   const adds = extensions(i.node, 'add'); if (adds.length) step.add = {...step.add, ...Object.fromEntries(adds.map(a => [a.attrs.name!, ext.whole(a.attrs, 'delta', where + ' add') ?? NaN]))};
   const needs = extensions(i.node, 'need'); if (needs.length) step.needs = needs.map(n => ({field: n.attrs.field!, ...n.attrs.op ? {op: ext.oneOf(n.attrs, 'op', ext.OPS, where + ' need'), value: ext.typed(n.attrs)} : {}, ...n.attrs.label ? {label: n.attrs.label} : {}}));
   const backlog = first(i.node, 'backlog'), at = where + ' backlog';
   if (backlog) step.backlog = {capacity: ext.whole(backlog.attrs, 'capacity', at) ?? NaN, ...backlog.attrs.order ? {order: ext.oneOf(backlog.attrs, 'order', ['fifo', 'lifo', 'priority'] as const, at)} : {}, ...backlog.attrs.priority ? {priority: backlog.attrs.priority} : {}, ...backlog.attrs.pull ? {pull: ext.whole(backlog.attrs, 'pull', at)!} : {}};
   if (sx) ext.journeyOf(sx, step, 'Step ' + i.xml);
   const timing = ext.single(extensions(i.node, 'timing'), 'timing', 'Step ' + i.xml); if (timing) step.timing = ext.distOf(timing, 'Step ' + i.xml + ' timing');
   const draws = extensions(i.node, 'draw'); if (draws.length) step.draws = ext.drawsOf(draws, 'Step ' + i.xml);
   if (i.kind === 'fork') { step.join = live.find(j => j.key === joins.get(i.key))!.id!; if (i.gateway === 'inclusive') { step.mode = 'inclusive'; } }
   // Containers an export wrote as present but empty come back empty, so a valid definition keeps its fingerprint.
   for (const k of ext.empties(sx, ['set', 'add', 'resources', 'needs', 'outputs', 'draws'] as const, where)) {
    if (step[k] !== undefined) throw Error(where + ': ' + k + ' is marked empty but has entries.');
    if (k === 'needs' || k === 'outputs' || k === 'draws') step[k] = []; else step[k] = {};
   }
   return step;
  });
  halt();
  if (automated.length) warn(automated.length + ' service-type task(s) run as automated system steps; no behaviour is executed: ' + automated.join(', ') + '.');
  if (defaulted) warn(defaulted + ' task(s) had no duration and were given ' + defaultDuration + ' minutes; tune them in the editor.');
  for (const e of net.edges) if (e.node) ext.vet(e.node, 'flow', 'Flow ' + e.xml);
  const flowList: LWProcess.Flow[] = net.edges.map(e => ({id: e.id!, from: byKey.get(e.from)!.id!, to: byKey.get(e.to)!.id!, ...e.label ? {label: e.label.slice(0, 120)} : {}, ...e.when ? {when: e.when} : {}, ...e.deadline ? {on: 'deadline' as const} : {}}));
  return root.LWProcessBpmnTail.finish(ctx, doc, proc, collab, participants, {steps, flows: flowList, resources: [...resources.values()], net, start, bp, used});
 }
 const single = (i: Item): LWProcess.Dist | undefined => { const t = E().single(E().extensions(i.node, 'timing'), 'timing', 'Step ' + i.xml); return t ? E().distOf(t, 'Step ' + i.xml + ' timing') : undefined; };
 root.LWProcessBpmnImportParts = {run};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessBpmnImportParts;
})(globalThis);
