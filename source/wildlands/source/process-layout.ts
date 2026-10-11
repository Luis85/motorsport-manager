/// <reference path="./process-contracts.d.ts" />
/**
 * Deterministic map placement for process steps (owner: the authoring package). Pure: no DOM, session, clock or storage, and it
 * changes only `scene.position` of steps.
 *
 *  - `positions(definition)` is a layered auto-layout. Layers are the longest path from the start over the flows (deadline flows
 *    included, back edges of loops found by a depth-first walk from the start ignored); x = layer × 14. Within a layer, rows are
 *    ordered by a barycentre pass (a fixed number of alternating sweeps over predecessors and successors, ties broken by draft order)
 *    and spaced 10 apart around y = 0. Steps reached only through a deadline (escalation) flow, or not reached from the start at all,
 *    are placed in rows below every main row. Every coordinate is rounded to 0.5 and kept inside the schema's ±10,000 bounds.
 *    The same definition always gives the same layout.
 *  - `tidy(definition)` returns a copy with those positions and how many steps moved; callers write it to the draft with the label
 *    "Tidied the layout" and never apply it.
 *  - `move(definition, stepId, [x, z])` returns a copy with one step moved, rounded to 0.5 and clamped to the bounds (for the 2D
 *    map's drag-to-move; callers write it with the label "Moved <step name>"); undefined when the step does not exist.
 */
declare namespace LWProcessLayout {
 interface Api {
  /** Map positions by step id. */
  positions(definition: LWProcess.Definition): Record<string, [number, number]>;
  tidy(definition: LWProcess.Definition): {definition: LWProcess.Definition; moved: number};
  move(definition: LWProcess.Definition, stepId: string, position: [number, number]): LWProcess.Definition | undefined;
  /** Grid spacing used by the layout and by new steps. */
  GRID: {x: number; y: number};
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessLayout?: LWProcessLayout.Api};
 type D = LWProcess.Definition;
 const GRID = {x: 14, y: 10}, BOUND = 10000, SWEEPS = 4;
 const round = (n: number) => Math.min(BOUND, Math.max(-BOUND, Math.round(n * 2) / 2));
 const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
 interface Edge {from: string; to: string; deadline: boolean}
 /** Flows between existing steps, normal flows of each step before its deadline flow, in draft order. */
 function edgesOf(d: D): Edge[] {
  const ids = new Set(d.steps.map(s => s.id));
  const all = d.flows.filter(f => ids.has(f.from) && ids.has(f.to) && f.from !== f.to)
   .map(f => ({from: f.from, to: f.to, deadline: f.on === 'deadline'}));
  return [...all.filter(e => !e.deadline), ...all.filter(e => e.deadline)];
 }
 /** Depth-first walk from the start (then any unvisited step in draft order): the visit order and the back edges of loops. */
 function walk(d: D, edges: Edge[]): {order: string[]; back: Set<Edge>} {
  const out = new Map<string, Edge[]>(d.steps.map(s => [s.id, []]));
  for (const e of edges) out.get(e.from)!.push(e);
  const state = new Map<string, 1 | 2>(), order: string[] = [], back = new Set<Edge>();
  const visit = (start: string) => {
   // An explicit stack keeps a 128-step chain from recursing deeply.
   const stack: {id: string; next: number}[] = [{id: start, next: 0}];
   state.set(start, 1);
   order.push(start);
   while (stack.length) {
    const top = stack.at(-1)!, list = out.get(top.id)!;
    if (top.next >= list.length) {
     state.set(top.id, 2);
     stack.pop();
     continue;
    }
    const e = list[top.next++]!, seen = state.get(e.to);
    if (seen === 1) back.add(e);
    else if (seen === undefined) {
     state.set(e.to, 1);
     order.push(e.to);
     stack.push({id: e.to, next: 0});
    }
   }
  };
  const start = d.steps.find(s => s.id === d.start) ?? d.steps.find(s => s.kind === 'start');
  if (start) visit(start.id);
  for (const s of d.steps) if (!state.has(s.id)) visit(s.id);
  return {order, back};
 }
 /** Longest path layers over the forward edges, in walk order (a topological order of the forward edges). */
 function layers(order: string[], forward: Edge[]): Map<string, number> {
  const layer = new Map(order.map(id => [id, 0])), into = new Map<string, Edge[]>(order.map(id => [id, []]));
  for (const e of forward) into.get(e.to)!.push(e);
  const sorted = topological(order, forward);
  for (const id of sorted) for (const e of into.get(id)!) layer.set(id, Math.max(layer.get(id)!, layer.get(e.from)! + 1));
  return layer;
 }
 /** Kahn's algorithm, picking ready steps in walk order so the result is deterministic. */
 function topological(order: string[], forward: Edge[]): string[] {
  const rank = new Map(order.map((id, i) => [id, i])), indegree = new Map(order.map(id => [id, 0]));
  const out = new Map<string, string[]>(order.map(id => [id, []]));
  for (const e of forward) {
   indegree.set(e.to, indegree.get(e.to)! + 1);
   out.get(e.from)!.push(e.to);
  }
  const ready = order.filter(id => indegree.get(id) === 0), sorted: string[] = [];
  while (ready.length) {
   ready.sort((a, b) => rank.get(a)! - rank.get(b)!);
   const id = ready.shift()!;
   sorted.push(id);
   for (const to of out.get(id)!) {
    indegree.set(to, indegree.get(to)! - 1);
    if (indegree.get(to) === 0) ready.push(to);
   }
  }
  return sorted;
 }
 /** Steps reached from the start over normal (non-deadline) forward flows. */
 function mainRoute(d: D, forward: Edge[]): Set<string> {
  const start = d.steps.find(s => s.id === d.start) ?? d.steps.find(s => s.kind === 'start'), seen = new Set<string>();
  const queue = start ? [start.id] : [];
  while (queue.length) {
   const id = queue.shift()!;
   if (seen.has(id)) continue;
   seen.add(id);
   for (const e of forward) if (e.from === id && !e.deadline) queue.push(e.to);
  }
  return seen;
 }
 /** Orders each layer's rows by the mean row of their neighbours, alternating downstream and upstream sweeps. */
 function order(rows: string[][], forward: Edge[]): void {
  const preds = new Map<string, string[]>(), succs = new Map<string, string[]>();
  for (const e of forward) {
   preds.set(e.to, [...preds.get(e.to) ?? [], e.from]);
   succs.set(e.from, [...succs.get(e.from) ?? [], e.to]);
  }
  const index = new Map<string, number>();
  const reindex = () => rows.forEach(row => row.forEach((id, i) => index.set(id, i)));
  reindex();
  for (let sweep = 0; sweep < SWEEPS; sweep++) {
   const down = sweep % 2 === 0, neighbours = down ? preds : succs, list = down ? rows : [...rows].reverse();
   for (const row of list) {
    const key = new Map(row.map(id => {
     const near = (neighbours.get(id) ?? []).filter(n => index.has(n)).map(n => index.get(n)!);
     return [id, near.length ? near.reduce((a, b) => a + b, 0) / near.length : index.get(id)!] as const;
    }));
    const before = new Map(row.map((id, i) => [id, i]));
    row.sort((a, b) => key.get(a)! - key.get(b)! || before.get(a)! - before.get(b)!);
    row.forEach((id, i) => index.set(id, i));
   }
  }
 }
 function positions(d: D): Record<string, [number, number]> {
  const edges = edgesOf(d), {order: visit, back} = walk(d, edges), forward = edges.filter(e => !back.has(e));
  const layer = layers(visit, forward), main = mainRoute(d, forward), depth = Math.max(0, ...layer.values());
  const mainRows: string[][] = Array.from({length: depth + 1}, () => []), branchRows: string[][] = Array.from({length: depth + 1}, () => []);
  for (const id of visit) (main.has(id) ? mainRows : branchRows)[layer.get(id)!]!.push(id);
  order(mainRows, forward);
  order(branchRows, forward);
  const out: Record<string, [number, number]> = {};
  let lowest = 0;
  mainRows.forEach((row, x) => row.forEach((id, i) => {
   const y = (i - (row.length - 1) / 2) * GRID.y;
   lowest = Math.max(lowest, y);
   out[id] = [round(x * GRID.x), round(y)];
  }));
  branchRows.forEach((row, x) => row.forEach((id, i) => {
   out[id] = [round(x * GRID.x), round(lowest + (i + 1) * GRID.y)];
  }));
  return out;
 }
 function tidy(d: D): {definition: D; moved: number} {
  const next = clone(d), placed = positions(d);
  let moved = 0;
  for (const step of next.steps) {
   const to = placed[step.id];
   if (!to || !step.scene) continue;
   const from = step.scene.position;
   if (!Array.isArray(from) || from[0] !== to[0] || from[1] !== to[1]) {
    step.scene.position = to;
    moved++;
   }
  }
  return {definition: next, moved};
 }
 function move(d: D, stepId: string, position: [number, number]): D | undefined {
  const next = clone(d), step = next.steps.find(s => s.id === stepId);
  if (!step || !step.scene || !position.every(n => Number.isFinite(n))) return undefined;
  step.scene.position = [round(position[0]), round(position[1])];
  return next;
 }
 root.LWProcessLayout = {positions, tidy, move, GRID};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessLayout;
})(globalThis);
