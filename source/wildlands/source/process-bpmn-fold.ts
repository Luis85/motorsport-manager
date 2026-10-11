/// <reference path="./process-bpmn-graph.ts" />
/**
 * Folding of a collected foreign BPMN net (LWProcessBpmnFold), called by process-bpmn-assemble.ts after
 * process-bpmn-graph.ts has built the net: `prune` removes dropped constructs (bridging a node with one way out) and
 * whatever is then unreachable from the start; `contract` folds pass-through nodes (events, merging exclusive gateways and
 * one-in-one-out parallel or inclusive gateways) into their flows. Both report every change through the import context, in
 * document order, and never reorder the remaining items or flows.
 */
declare namespace LWProcessBpmnFold {
 interface Api {
  prune(ctx: LWProcessBpmnGraph.Ctx, net: LWProcessBpmnGraph.Net, start: LWProcessBpmnGraph.Item | undefined): void;
  contract(ctx: LWProcessBpmnGraph.Ctx, net: LWProcessBpmnGraph.Net): void;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessBpmnFold?: LWProcessBpmnFold.Api};
 type Item = LWProcessBpmnGraph.Item;
 type Edge = LWProcessBpmnGraph.Edge;
 type Net = LWProcessBpmnGraph.Net;
 type Ctx = LWProcessBpmnGraph.Ctx;
 /**
  * Removes dropped items: a dropped node with one way out is bridged (in-flows re-pointed), otherwise its flows vanish;
  * whatever can no longer be reached from the start is pruned.
  */
 function prune(ctx: Ctx, net: Net, start: Item | undefined): void {
  const dropped = net.items.filter(i => i.drop);
  for (const x of dropped) {
   const out = net.edges.filter(e => e.from === x.key), into = net.edges.filter(e => e.to === x.key), bridged = out.length === 1 && into.length > 0;
   if (bridged) for (const e of into) e.to = out[0]!.to;
   net.edges = net.edges.filter(e => e.from !== x.key && !(e.to === x.key && !bridged));
   x.folded = 'dropped';
   net.items = net.items.filter(i => i !== x);
   ctx.note(x.xml, x.local, 'none', 'dropped (unsupported)' + (bridged ? '; its flows were bridged' : ''));
  }
  if (!start) return;
  const reach = new Set<string>([start.key]), queue = [start.key];
  while (queue.length) {
   const k = queue.shift()!;
   for (const e of net.edges) {
    if (e.from !== k || reach.has(e.to)) continue;
    reach.add(e.to);
    queue.push(e.to);
   }
  }
  const gone = net.items.filter(i => !reach.has(i.key) && !i.synthetic);
  if (gone.length) ctx.warn('Pruned ' + gone.length + ' element(s) no longer reachable from the start: ' + gone.map(i => i.xml).join(', ') + '.');
  for (const x of gone) {
   x.folded = 'pruned';
   ctx.note(x.xml, x.local, 'none', 'pruned: reachable only through dropped or unsupported elements');
  }
  net.items = net.items.filter(i => reach.has(i.key));
  net.edges = net.edges.filter(e => reach.has(e.from) && reach.has(e.to));
 }
 /** Folds pass-through nodes: events, merging exclusive gateways and one-in-one-out parallel or inclusive gateways disappear into their flows. */
 function contract(ctx: Ctx, net: Net): void {
  // Edges are indexed by source and target once; folding re-points in-flows, so only the target index changes.
  // Edge and item order stay as written.
  const ins = new Map<string, Set<Edge>>(), outs = new Map<string, Edge[]>(), gone = new Set<Edge>(), folded = new Set<Item>();
  const list = <V>(m: Map<string, V>, k: string, make: () => V) => {
   let v = m.get(k);
   if (!v) m.set(k, v = make());
   return v;
  };
  for (const e of net.edges) {
   list(outs, e.from, () => [] as Edge[]).push(e);
   list(ins, e.to, () => new Set<Edge>()).add(e);
  }
  const outOf = (k: string) => outs.get(k) ?? [], into = (k: string) => ins.get(k)?.size ?? 0;
  const settle = () => {
   net.edges = net.edges.filter(e => !gone.has(e));
   net.items = net.items.filter(i => !folded.has(i));
  };
  const passes = (i: Item) => {
   const out = outOf(i.key).length;
   if (i.kind === 'pass') return out === 1;
   if (i.gateway === 'exclusive' || i.gateway === 'event') return out === 1;
   return (i.gateway === 'parallel' || i.gateway === 'inclusive') && into(i.key) < 2 && out === 1;
  };
  for (let progress = true; progress;) {
   progress = false;
   for (const g of net.items.filter(passes)) {
    const o = outOf(g.key)[0]!;
    if (o.to === g.key) {
     settle();
     ctx.reject(g.xml, g.local, 'Gateway ' + g.xml + ' loops onto itself.');
     return;
    }
    const target = list(ins, o.to, () => new Set<Edge>());
    target.delete(o);
    for (const e of ins.get(g.key) ?? []) {
     e.to = o.to;
     target.add(e);
    }
    ins.delete(g.key);
    gone.add(o);
    folded.add(g);
    g.folded = 'folded';
    progress = true;
    ctx.note(o.xml, 'sequenceFlow', 'none', 'folded: the flow leaving ' + g.xml + ' is replaced by the flow into the next element');
    if (g.gateway) {
     ctx.warn('Merge or pass-through gateway ' + g.xml + ' was folded into its flows; Wildlands steps accept several incoming flows.');
     g.how = 'merge or pass-through gateway folded into its flows';
    } else g.how = g.how || 'pass-through event folded into its flows';
    ctx.note(g.xml, g.local, 'none', g.how);
   }
   settle();
  }
 }
 root.LWProcessBpmnFold = {prune, contract};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessBpmnFold;
})(globalThis);
