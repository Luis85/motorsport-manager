/// <reference path="./process-bpmn-graph.ts" />
/**
 * Scene positions of a BPMN import (LWProcessBpmnLayout), called by process-bpmn-assemble.ts: the exact `<wl:scene>`
 * positions when every step carries one, else the centres of the BPMN diagram (DI) shapes scaled to scene units, else an
 * automatic layout by flow depth with a warning. Synthetic loop decisions sit beside the task they repeat.
 */
declare namespace LWProcessBpmnLayout {
 interface Api {
  /** Item key -> scene position. `byKey` finds the task a synthetic item sits near; `start` roots the automatic layout. */
  place(ctx: LWProcessBpmnGraph.Ctx, doc: LWProcessXml.Node, net: LWProcessBpmnGraph.Net, live: LWProcessBpmnGraph.Item[],
   byKey: Map<string, LWProcessBpmnGraph.Item>, start: LWProcessBpmnGraph.Item | undefined): Map<string, [number, number]>;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessBpmnExport: {vocabulary: LWProcessBpmn.Vocabulary}; LWProcessBpmnExt: LWProcessBpmnExt.Api;
  LWProcessBpmnLayout?: LWProcessBpmnLayout.Api};
 const {DI, DC, UNIT} = root.LWProcessBpmnExport.vocabulary;
 type X = LWProcessXml.Node;
 type Item = LWProcessBpmnGraph.Item;
 const first = (n: X, l: string) => root.LWProcessBpmnExt.first(n, l);
 /** Centre of every diagram shape, by the BPMN element it draws. */
 function centres(doc: X): Map<string, [number, number]> {
  const out = new Map<string, [number, number]>();
  const shapes = doc.children.filter(c => c.local === 'BPMNDiagram')
   .flatMap(d => d.children.flatMap(p => p.children.filter(s => s.local === 'BPMNShape' && s.ns === DI)));
  for (const shape of shapes) {
   const b = shape.children.find(c => c.local === 'Bounds' && c.ns === DC);
   if (!b || !shape.attrs.bpmnElement) continue;
   out.set(shape.attrs.bpmnElement, [Number(b.attrs.x) + Number(b.attrs.width) / 2, Number(b.attrs.y) + Number(b.attrs.height) / 2]);
  }
  return out;
 }
 function place(ctx: LWProcessBpmnGraph.Ctx, doc: X, net: LWProcessBpmnGraph.Net, live: Item[], byKey: Map<string, Item>,
  start: Item | undefined): Map<string, [number, number]> {
  const centers = centres(doc), placed = new Map<string, [number, number]>();
  const centerOf = (i: Item) => centers.get(i.near ? byKey.get(i.near)?.xml ?? '' : i.xml);
  const coordinate = (i: Item, s: X, k: 'x' | 'y') => {
   const raw = s.attrs[k] ?? '', v = Number(raw);
   if (!raw.trim() || !Number.isFinite(v)) throw Error('Step ' + i.xml + ' scene: ' + k + ' "' + raw + '" must be a number.');
   return v;
  };
  if (live.every(i => first(i.node, 'scene'))) {
   live.forEach(i => {
    const s = first(i.node, 'scene')!;
    placed.set(i.key, [coordinate(i, s, 'x'), coordinate(i, s, 'y')]);
   });
  } else if (live.every(i => centerOf(i))) {
   const minX = Math.min(...live.map(i => centerOf(i)![0])), minY = Math.min(...live.map(i => centerOf(i)![1]));
   const scaled = (v: number, low: number) => Math.round((v - low) / UNIT * 10) / 10;
   live.forEach(i => placed.set(i.key, [scaled(centerOf(i)![0], minX) + (i.near ? 8 : 0), scaled(centerOf(i)![1], minY) + (i.near ? 6 : 0)]));
  } else {
   ctx.warn('The file has no complete diagram layout; scenes were arranged automatically.');
   const depth = new Map<string, number>([[(start ?? live[0]!).key, 0]]), queue = [...depth.keys()], rows = new Map<number, number>();
   while (queue.length) {
    const k = queue.shift()!;
    for (const f of net.edges) {
     if (f.from !== k || depth.has(f.to)) continue;
     depth.set(f.to, depth.get(k)! + 1);
     queue.push(f.to);
    }
   }
   for (const i of live) {
    const x = depth.get(i.key) ?? 0, row = rows.get(x) ?? 0;
    rows.set(x, row + 1);
    placed.set(i.key, [x * 14, row * 12]);
   }
  }
  return placed;
 }
 root.LWProcessBpmnLayout = {place};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessBpmnLayout;
})(globalThis);
