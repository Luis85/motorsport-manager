/// <reference path="./process-bpmn-graph.ts" />
/// <reference path="./process-bpmn-bpsim.ts" />
/**
 * Resource pools of a foreign BPMN import (LWProcessBpmnPools), called by process-bpmn-assemble.ts: pools from
 * `<bpmn:resource>` elements (the Wildlands extension exactly, else BPSim quantity and unit cost, else the defaults), one pool
 * per lane whose bare tasks need one (people, or system for service-only and automation-named lanes), and the shared
 * Automation pool that service tasks without a pool run on. Pools keep their creation order, which is the order of the
 * definition's `resources`; every pool is reported in the mapping.
 */
declare namespace LWProcessBpmnPools {
 type Bp = (ref: string) => LWProcessBpmnBpsim.Params | undefined;
 /** The pools of one import. `resources` is keyed by BPMN resource id, `~lane:<id>` or `~automation`; `poolOf` by Wildlands id. */
 interface Pools {
  resources: Map<string, LWProcess.Resource>; poolOf: Map<string, LWProcess.Resource>;
  /** Wildlands pool ids in use. */
  taken: Set<string>;
  /** The shared Automation system pool, created on first use. */
  auto(): LWProcess.Resource;
 }
 interface Api {
  /** BPMN elements that name who performs a task. */
  PERFORMERS: ReadonlySet<string>;
  declared(ctx: LWProcessBpmnGraph.Ctx, doc: LWProcessXml.Node, live: LWProcessBpmnGraph.Item[], bp: Bp): Pools;
  /** Lane id -> the pool its bare tasks (among `live`, the imported items) demand. */
  lanes(ctx: LWProcessBpmnGraph.Ctx, net: LWProcessBpmnGraph.Net, live: LWProcessBpmnGraph.Item[], pools: Pools, bp: Bp): Map<string, LWProcess.Resource>;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessBpmnExport: {vocabulary: LWProcessBpmn.Vocabulary}; LWProcessBpmnExt: LWProcessBpmnExt.Api;
  LWProcessBpmnPools?: LWProcessBpmnPools.Api};
 const {MODEL} = root.LWProcessBpmnExport.vocabulary;
 type X = LWProcessXml.Node;
 type Item = LWProcessBpmnGraph.Item;
 type Ctx = LWProcessBpmnGraph.Ctx;
 type Pools = LWProcessBpmnPools.Pools;
 const E = () => root.LWProcessBpmnExt;
 const kids = (n: X, l: string) => E().kids(n, l), first = (n: X, l: string) => E().first(n, l);
 const PERFORMERS = new Set(['performer', 'humanPerformer', 'potentialOwner', 'resourceRole']);
 const SYSTEM_LANE = /system|service|automat|engine|robot|\bbot\b|\bapi\b|software|batch|server|platform|\bai\b/i;
 /** Whether a task names `xmlId` as the resource of one of its performers. */
 const performs = (i: Item, xmlId: string) => i.node.children.some(c => c.ns === MODEL && PERFORMERS.has(c.local)
  && kids(c, 'resourceRef').some(x => x.text.trim().split(':').at(-1) === xmlId));
 function declared(ctx: Ctx, doc: X, live: Item[], bp: LWProcessBpmnPools.Bp): Pools {
  const o = ctx.o, warn = ctx.warn, ext = E(), taken = new Set<string>();
  const resources = new Map<string, LWProcess.Resource>(), poolOf = new Map<string, LWProcess.Resource>();
  const auto = () => {
   let pool = [...poolOf.values()].find(p => p.name === 'Automation' && p.kind === 'system');
   if (!pool) {
    pool = {id: E().sanitize('automation', taken, 'pool'), name: 'Automation', capacity: o.systemCapacity, costPerMinute: 1, kind: 'system'};
    resources.set('~automation', pool);
    poolOf.set(pool.id, pool);
   }
   return pool;
  };
  for (const r of kids(doc, 'resource')) {
   const wl = first(r, 'resource'), xmlId = r.attrs.id ?? '', where = 'Resource ' + xmlId;
   if (!xmlId) continue;
   ext.vet(r, 'resource', where);
   const id = wl?.attrs.id ?? E().sanitize(xmlId, taken, 'resource');
   taken.add(id);
   const p = bp(xmlId), cost = p?.unitCost !== undefined ? Math.round(p.unitCost) : undefined;
   // A foreign resource only service-type tasks perform is a system pool; the extension (when present) is exact.
   const users = live.filter(i => i.kind === 'task' && performs(i, xmlId)), serviceOnly = o.autoSystemPool && users.length > 0 && users.every(i => i.system);
   // Read in this order (capacity, cost, kind), so the first malformed attribute is the one reported.
   const capacity = (wl && ext.whole(wl.attrs, 'capacity', where)) ?? p?.quantity ?? o.defaultCapacity;
   const costPerMinute = (wl && ext.whole(wl.attrs, 'costPerMinute', where)) ?? cost ?? 0;
   const kind = wl?.attrs.kind !== undefined ? {kind: ext.oneOf(wl.attrs, 'kind', ['people', 'machine', 'system'] as const, where)}
    : !wl && serviceOnly ? {kind: 'system' as const} : {};
   const pool: LWProcess.Resource = {id, name: (r.attrs.name || id).slice(0, 120), capacity, costPerMinute, ...kind};
   if (wl && p?.quantity !== undefined && p.quantity !== pool.capacity) {
    warn('BPSim Quantity ' + p.quantity + ' of resource ' + xmlId + ' disagrees with the Wildlands capacity ' + pool.capacity + '; the extension wins.');
   }
   if (wl && cost !== undefined && cost !== pool.costPerMinute) {
    warn('BPSim UnitCost of resource ' + xmlId + ' disagrees with the Wildlands cost per minute ' + pool.costPerMinute + '; the extension wins.');
   }
   resources.set(xmlId, pool);
   poolOf.set(id, pool);
   const wins = wl ? ' (the extension wins)' : '';
   if (p?.quantity !== undefined) ctx.note(xmlId, 'bpsim:Quantity', 'pool:' + id, 'capacity ' + p.quantity + wins);
   if (cost !== undefined) ctx.note(xmlId, 'bpsim:UnitCost', 'pool:' + id, 'cost per minute ' + cost + wins);
   ctx.note(xmlId, 'resource', 'pool:' + id, wl ? 'restored from the Wildlands extension' : 'pool' + (p ? ' with BPSim quantity/cost' : ''));
   if (!wl && !p) warn('Resources have capacity 1 and no cost unless set in Wildlands.');
  }
  return {resources, poolOf, taken, auto};
 }
 function lanes(ctx: Ctx, net: LWProcessBpmnGraph.Net, live: Item[], pools: Pools, bp: LWProcessBpmnPools.Bp): Map<string, LWProcess.Resource> {
  const o = ctx.o, laneUse = new Map<string, {people: number; service: number}>();
  // A bare task has neither Wildlands step data nor an explicit performer, so its lane decides its pool.
  const bare = (i: Item) => i.kind === 'task' && !first(i.node, 'step') && !i.node.children.some(c => c.ns === MODEL && PERFORMERS.has(c.local));
  for (const i of live.filter(bare)) {
   if (i.lane === undefined || o.lanes !== 'pools') continue;
   const u = laneUse.get(i.lane) ?? {people: 0, service: 0};
   if (i.system && o.autoSystemPool) u.service++;
   else u.people++;
   laneUse.set(i.lane, u);
  }
  const lanePool = new Map<string, LWProcess.Resource>();
  for (const [laneId, use] of laneUse) {
   const name = net.lanes.get(laneId) || laneId;
   const system = use.people === 0 && o.autoSystemPool && (use.service > 0 || SYSTEM_LANE.test(name));
   const existing = [...pools.poolOf.values()].find(p => p.name === name && (p.kind ?? 'people') === (system ? 'system' : 'people'));
   if (existing) {
    lanePool.set(laneId, existing);
    continue;
   }
   const p = bp(laneId), cost = p?.unitCost !== undefined ? Math.round(p.unitCost) : 0;
   const capacity = Math.max(1, Math.min(1000, p?.quantity ?? (system ? o.systemCapacity : o.defaultCapacity)));
   const pool: LWProcess.Resource = {id: E().sanitize(name, pools.taken, 'pool'), name: name.slice(0, 120), capacity, costPerMinute: cost,
    ...system ? {kind: 'system' as const} : {}};
   pools.resources.set('~lane:' + laneId, pool);
   pools.poolOf.set(pool.id, pool);
   lanePool.set(laneId, pool);
   if (p?.quantity !== undefined) ctx.note(laneId, 'bpsim:Quantity', 'pool:' + pool.id, 'capacity ' + p.quantity);
   if (p?.unitCost !== undefined) ctx.note(laneId, 'bpsim:UnitCost', 'pool:' + pool.id, 'cost per minute ' + cost);
   const source = p?.quantity !== undefined ? ' (BPSim Quantity)' : ' (default capacity)';
   ctx.note(laneId, 'lane', 'pool:' + pool.id, (system ? 'system' : 'people') + ' pool, capacity ' + pool.capacity + source + '; its tasks demand 1');
  }
  if (o.lanes === 'pools') {
   for (const [id, name] of net.lanes) {
    if (lanePool.has(id)) continue;
    ctx.note(id, 'lane', 'none', 'lane "' + name + '" needs no pool: none of its tasks lacks an explicit performer or Wildlands step data');
   }
  }
  if (o.lanes === 'ignore' && net.lanes.size) {
   ctx.warn('Lanes are ignored (lanes option "ignore"): tasks demand no pools.');
   for (const [id, name] of net.lanes) ctx.note(id, 'lane', 'none', 'ignored lane "' + name + '"');
  }
  return lanePool;
 }
 root.LWProcessBpmnPools = {PERFORMERS, declared, lanes};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessBpmnPools;
})(globalThis);
