/// <reference path="./process-contracts.d.ts" />
/**
 * SIPOC lens: Suppliers, Inputs, Process, Outputs, Customers as a read-only DOM grid over the same definition and snapshot.
 * Selection sends intent only; this module never ticks, mutates or retains a run. Everything is derived, nothing is invented:
 * - SUPPLIERS and CUSTOMERS come from `definition.sipoc` (name plus what is supplied / received); absent, one muted placeholder asks the author to add them.
 * - INPUTS are external: fields in arrival `data` and arrival `draws`, plus `needs` fields that no step delivers through set/add/draws.
 *   Label is needs.label, else outputs.label, else the field name; the example is the first arrival value (or a plain description of the draw);
 *   arrival inputs show the live number of cases that arrived.
 * - PROCESS is the main route (from start, first unconditional flow at decisions, a fork with its branches as one "in parallel" stage), start and end excluded.
 *   Steps group by `phase` (order of first appearance, unphased steps follow the phase before them) when phases exist, else consecutive units collapse into at most 7
 *   stages named by their first step plus "and N more steps". Off-route steps (rework) join the stage they flow into or out of. Each stage shows kind icons, step count,
 *   live in-progress/waiting/completed sums of steps[].active/queued/completed and a dashed "variant" marker when it holds a decision, rework loop or back edge.
 * - OUTPUTS are declared step `outputs`, fields delivered (set/add/draws) by the steps right before end steps, and one entry per end step (goal/lost outcome or reaching the end),
 *   with the end or declaring step's completed count.
 * - MEASURES: completed, in progress, mean cycle, simulated cost, throughput per 100 minutes, conversion when known, tracked finish means when present.
 */
declare namespace LWProcessSipoc {
 interface Party {name: string; detail?: string; placeholder?: boolean;}
 interface Input {field: string; label: string; example: string | null; arrived: number | null;}
 interface Stage {id: string; name: string; first: string; stepIds: string[]; kinds: LWProcess.Kind[]; steps: number; active: number; queued: number; completed: number; variant: boolean; parallel: boolean;}
 interface Output {id: string; label: string; detail: string; count: number | null; kind: 'declared' | 'delivered' | 'outcome';}
 interface Measure {id: string; label: string; value: string;}
 interface Model {suppliers: Party[]; inputs: Input[]; stages: Stage[]; outputs: Output[]; customers: Party[]; measures: Measure[];}
 interface ViewLike {definition: LWProcess.Definition; snapshot: LWProcess.Snapshot; selected: string | null;}
 interface Surface {draw(view: ViewLike): void; dispose(): void; frame?(): void;}
 interface Api {create(host: HTMLElement, onSelect: (stepId: string | null) => void): Surface; model(definition: LWProcess.Definition, snapshot: LWProcess.Snapshot): Model;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessSipoc?: LWProcessSipoc.Api};
 type Step = LWProcess.Step;
 type Sipoc = {suppliers?: {name: string; supplies?: string}[]; customers?: {name: string; receives?: string}[]};
 const MAX_STAGES = 7, ENDS = new Set(['start', 'end']);
 const plural = (n: number, one: string, many = one + 's') => n + ' ' + (n === 1 ? one : many);
 const fieldsOf = (s: Step) => [...Object.keys(s.set ?? {}), ...Object.keys(s.add ?? {}), ...(s.draws ?? []).map(d => d.field)];
 /** Plain description of a random draw for the "example" line. */
 function describe(d: LWProcess.Draw): string {
  if (d.kind === 'chance') return `random, ${d.percent ?? 0}% chance`;
  if (d.kind === 'int') return `random, ${d.min ?? 0} to ${d.max ?? 0}`;
  return 'random: ' + (d.values ?? []).map(v => String(v.value)).join(' or ');
 }
 /** Main route as units: a fork with its branches and join is one unit, a decision attaches to the unit before it. */
 function route(d: LWProcess.Definition): Step[][] {
  const by = new Map(d.steps.map(s => [s.id, s])), out = (id: string) => d.flows.filter(f => f.from === id && f.on !== 'deadline');
  const pick = (id: string) => { const o = out(id); return (o.find(f => !f.when) ?? o[0])?.to; };
  const units: Step[][] = [], seen = new Set<string>(); let cur: string | undefined = d.start;
  while (cur && !seen.has(cur)) {
   const s = by.get(cur); if (!s) break; seen.add(cur);
   if (s.kind === 'fork') {
    const unit = [s]; let join: string | undefined;
    for (const f of out(cur)) for (let x: string | undefined = f.to; x && !seen.has(x);) {
     const st = by.get(x); if (!st) break; seen.add(x); unit.push(st);
     if (st.kind === 'join') {unit.pop(); join ??= x; break;}
     x = pick(x);
    }
    if (join) unit.push(by.get(join)!);
    units.push(unit); cur = join ? pick(join) : undefined; continue;
   }
   if (!ENDS.has(s.kind)) { if (s.kind === 'decision' && units.length) units[units.length - 1]!.push(s); else units.push([s]); }
   cur = pick(cur);
  }
  return units;
 }
 /** Assign route steps to stages by phase when any exist, else by balanced chunks of units. */
 function grouping(units: Step[][]): {name: string; steps: Step[]}[] {
  const flat = units.flat();
  if (flat.some(s => s.phase)) {
   let last = flat.find(s => s.phase)!.phase!; const groups = new Map<string, Step[]>();
   for (const s of flat) { last = s.phase ?? last; (groups.get(last) ?? groups.set(last, []).get(last)!).push(s); }
   const all = [...groups].map(([name, steps]) => ({name, steps}));
   if (all.length <= MAX_STAGES) return all;
   const tail = all.slice(MAX_STAGES - 1), keep = all.slice(0, MAX_STAGES - 1);
   return [...keep, {name: `${tail[0]!.name} and ${plural(tail.length - 1, 'more phase')}`, steps: tail.flatMap(g => g.steps)}];
  }
  const k = Math.min(MAX_STAGES, units.length), base = Math.floor(units.length / Math.max(1, k)), extra = units.length % Math.max(1, k), out: {name: string; steps: Step[]}[] = [];
  for (let i = 0, at = 0; i < k; i++) {
   const part = units.slice(at, at += base + (i < extra ? 1 : 0)), steps = part.flat(), first = steps[0]!;
   out.push({name: part.length > 1 ? `${first.name} and ${plural(steps.length - 1, 'more step')}` : first.name, steps});
  }
  return out;
 }
 function stagesOf(d: LWProcess.Definition, q: LWProcess.Snapshot): LWProcessSipoc.Stage[] {
  const units = route(d), groups = grouping(units), stageOf = new Map<string, number>(), pos = new Map<string, number>();
  groups.forEach((g, i) => g.steps.forEach(s => stageOf.set(s.id, i))); units.flat().forEach((s, i) => pos.set(s.id, i));
  const attached = new Set<string>(), floating = d.steps.filter(s => !ENDS.has(s.kind) && !stageOf.has(s.id));
  for (let moved = true; moved;) {
   moved = false;
   for (const s of floating) {
    if (stageOf.has(s.id)) continue;
    const target = d.flows.filter(f => f.from === s.id).map(f => stageOf.get(f.to)).find(x => x !== undefined) ?? d.flows.filter(f => f.to === s.id).map(f => stageOf.get(f.from)).find(x => x !== undefined);
    if (target !== undefined) { stageOf.set(s.id, target); attached.add(s.id); moved = true; }
   }
  }
  const back = new Set<number>(); for (const f of d.flows) if (pos.has(f.from) && pos.has(f.to) && pos.get(f.to)! <= pos.get(f.from)!) back.add(stageOf.get(f.from)!);
  const metric = new Map(q.steps.map(m => [m.id, m]));
  return groups.map((g, i) => {
   const members = d.steps.filter(s => stageOf.get(s.id) === i), sum = (key: 'active' | 'queued' | 'completed') => members.reduce((n, s) => n + (metric.get(s.id)?.[key] ?? 0), 0);
   return {
    id: 'stage-' + (i + 1), name: g.name, first: g.steps[0]!.id, stepIds: members.map(s => s.id), kinds: [...new Set(members.map(s => s.kind))], steps: members.length,
    active: sum('active'), queued: sum('queued'), completed: sum('completed'), variant: members.some(s => s.kind === 'decision' || attached.has(s.id)) || back.has(i), parallel: members.some(s => s.kind === 'fork'),
   };
  });
 }
 function model(d: LWProcess.Definition, q: LWProcess.Snapshot): LWProcessSipoc.Model {
  const sipoc = (d as {sipoc?: Sipoc}).sipoc, delivered = new Set(d.steps.flatMap(fieldsOf)), needLabel = new Map<string, string>(), outLabel = new Map<string, string>(), done = new Map(q.steps.map(m => [m.id, m.completed]));
  for (const s of d.steps) { for (const n of s.needs ?? []) if (n.label && !needLabel.has(n.field)) needLabel.set(n.field, n.label); for (const o of s.outputs ?? []) if (o.label && !outLabel.has(o.field)) outLabel.set(o.field, o.label); }
  const labelOf = (field: string) => needLabel.get(field) ?? outLabel.get(field) ?? field, inputs = new Map<string, LWProcessSipoc.Input>();
  for (const a of d.arrivals) {
   for (const [field, value] of Object.entries(a.data)) { const known = inputs.get(field); if (!known) inputs.set(field, {field, label: labelOf(field), example: String(value), arrived: q.metrics.arrived}); }
   for (const dr of a.draws ?? []) if (!inputs.has(dr.field)) inputs.set(dr.field, {field: dr.field, label: labelOf(dr.field), example: describe(dr), arrived: q.metrics.arrived});
  }
  for (const s of d.steps) for (const n of s.needs ?? []) if (!delivered.has(n.field) && !inputs.has(n.field)) inputs.set(n.field, {field: n.field, label: labelOf(n.field), example: null, arrived: null});
  const outputs = new Map<string, LWProcessSipoc.Output>(), names = (ids: Step[]) => ids.map(s => s.name).join(', ');
  for (const s of d.steps) for (const o of s.outputs ?? []) {
   const known = outputs.get(o.field), count = done.get(s.id) ?? 0;
   if (known) { known.count = Math.max(known.count ?? 0, count); known.detail += ', ' + s.name; } else outputs.set(o.field, {id: 'out-' + o.field, label: o.label ?? needLabel.get(o.field) ?? o.field, detail: 'from ' + s.name, count, kind: 'declared'});
  }
  const ends = d.steps.filter(s => s.kind === 'end');
  for (const e of ends) {
   const before = d.steps.filter(s => d.flows.some(f => f.from === s.id && f.to === e.id) && !['decision', 'fork', 'join', 'start'].includes(s.kind));
   for (const field of new Set(before.flatMap(fieldsOf))) if (!outputs.has(field)) outputs.set(field, {id: 'out-' + field, label: labelOf(field), detail: 'delivered by ' + names(before.filter(s => fieldsOf(s).includes(field))), count: done.get(e.id) ?? 0, kind: 'delivered'});
  }
  const outcomes = ends.map<LWProcessSipoc.Output>(e => ({id: 'end-' + e.id, kind: 'outcome', count: done.get(e.id) ?? 0, label: e.outcome ? `${e.name}: ${e.outcome === 'goal' ? 'goal reached' : 'lost'}` : 'Reached ' + e.name, detail: e.outcome ? 'end outcome' : 'end of the process'}));
  const m = q.metrics, tracked = Object.values(m.tracked).filter(t => t.n > 0 && t.mean !== null), measures: LWProcessSipoc.Measure[] = [
   {id: 'completed', label: 'Completed', value: String(m.completed)}, {id: 'active', label: 'In progress', value: String(m.active)}, {id: 'cycle', label: 'Mean cycle', value: Math.round(m.meanCycleMinutes * 10) / 10 + ' min'},
   {id: 'cost', label: 'Simulated cost', value: String(Math.round(m.cost * 100) / 100)}, {id: 'throughput', label: 'Throughput per 100 min', value: String(q.minute > 0 ? Math.round(m.completed * 1000 / q.minute) / 10 : 0)},
  ];
  if (m.conversion !== null) measures.push({id: 'conversion', label: 'Conversion', value: m.conversion / 10 + '%'});
  for (const t of tracked) measures.push({id: 'tracked-' + t.label, label: t.label + ' (mean)', value: String(Math.round(t.mean! * 100) / 100)});
  return {
   suppliers: sipoc?.suppliers?.length ? sipoc.suppliers.map(s => ({name: s.name, ...(s.supplies ? {detail: s.supplies} : {})})) : [{name: 'Add suppliers in Edit process', placeholder: true}],
   inputs: [...inputs.values()], stages: stagesOf(d, q), outputs: [...outputs.values(), ...outcomes],
   customers: sipoc?.customers?.length ? sipoc.customers.map(c => ({name: c.name, ...(c.receives ? {detail: c.receives} : {})})) : [{name: 'Add customers in Edit process', placeholder: true}], measures,
  };
 }
 const NS = 'http://www.w3.org/2000/svg';
 const GLYPHS: Record<string, string> = {
  task: 'M8 3a2.5 2.5 0 1 0 0 5a2.5 2.5 0 0 0 0-5ZM3 14c0-3 2-4.5 5-4.5s5 1.5 5 4.500', touchpoint: 'M2.5 3h11v7h-5l-3 3v-3h-3Z', machine: 'M8 5.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 0 0 0-5ZM8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2',
  system: 'M2.5 2.5h11v4h-11ZM2.5 9.500h11v4h-11Z', timer: 'M8 2.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 0 0 0-11ZM8 5v3l2 1.5', decision: 'M8 1.5l6 6.5l-6 6.5l-6-6.5Z', fork: 'M2 8h4l5-4h3M6 8l5 4h3', join: 'M2 4h3l5 4h4M2 12h3l5-4',
 };
 function icon(kind: string): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg'), path = document.createElementNS(NS, 'path'), title = document.createElementNS(NS, 'title');
  svg.setAttribute('viewBox', '0 0 16 16'); svg.setAttribute('width', '16'); svg.setAttribute('height', '16'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', 'sipoc-icon');
  path.setAttribute('d', GLYPHS[kind] ?? GLYPHS.task!); path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '1.4'); path.setAttribute('stroke-linejoin', 'round'); path.setAttribute('stroke-linecap', 'round');
  title.textContent = kind; svg.append(title, path); return svg;
 }
 function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string, attrs: Record<string, string> = {}): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag); n.className = cls; if (text !== undefined) n.textContent = text; for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n;
 }
 const COLUMNS: [string, string, string][] = [['S', 'Suppliers', 'Who provides what the process needs'], ['I', 'Inputs', 'What goes in'], ['P', 'Process', 'The main route in stages'], ['O', 'Outputs', 'What comes out'], ['C', 'Customers', 'Who receives it']];
 function create(host: HTMLElement, onSelect: (stepId: string | null) => void): LWProcessSipoc.Surface {
  const rootEl = h('div', 'sipoc'), scroller = h('div', 'sipoc-scroll', undefined, {tabindex: '0', role: 'group', 'aria-label': 'SIPOC: suppliers, inputs, process, outputs and customers'}), strip = h('dl', 'sipoc-measures', undefined, {'aria-label': 'Run measures'});
  rootEl.append(scroller, strip); host.append(rootEl); let drawn = '';
  const party = (p: LWProcessSipoc.Party) => { const li = h('li', 'sipoc-card' + (p.placeholder ? ' sipoc-muted' : '')); li.append(h('strong', 'sipoc-name', p.name)); if (p.detail) li.append(h('span', 'sipoc-detail', p.detail)); return li; };
  function stage(s: LWProcessSipoc.Stage, index: number, selected: boolean): HTMLLIElement {
   const li = h('li', 'sipoc-stage-item'), label = `Stage ${s.name}, ${plural(s.steps, 'step')}, ${s.active} in progress, ${s.queued ? s.queued + ' waiting, ' : ''}${s.completed} completed${s.variant ? ', has alternative paths' : ''}`;
   const b = h('button', 'sipoc-card sipoc-stage' + (s.variant ? ' sipoc-variant' : '') + (selected ? ' selected' : ''), undefined, {type: 'button', 'aria-label': label, 'aria-pressed': String(selected), 'data-stage': s.id});
   const head = h('span', 'sipoc-stage-head'), kinds = h('span', 'sipoc-kinds'), counts = h('span', 'sipoc-counts');
   head.append(h('span', 'sipoc-badge', String(index + 1)), h('strong', 'sipoc-name', s.name));
   kinds.append(...s.kinds.slice(0, 6).map(icon), h('span', 'sipoc-detail', plural(s.steps, 'step')));
   if (s.parallel) kinds.append(h('span', 'sipoc-tag', 'in parallel'));
   if (s.variant) kinds.append(h('span', 'sipoc-tag sipoc-tag-variant', 'variant', {title: 'Contains a decision or rework loop'}));
   counts.append(h('span', 'sipoc-count', `${s.active} in progress`), h('span', 'sipoc-count', `${s.queued} waiting`), h('span', 'sipoc-count', `${s.completed} completed`));
   b.append(head, kinds, counts); b.addEventListener('click', () => onSelect(s.first)); li.append(b); return li;
  }
  function draw(view: LWProcessSipoc.ViewLike): void {
   const m = model(view.definition, view.snapshot), key = JSON.stringify([m, view.selected]); if (key === drawn) return; drawn = key;
   const focused = scroller.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.stage : undefined, grid = h('div', 'sipoc-grid');
   const selectedStage = m.stages.find(s => view.selected !== null && s.stepIds.includes(view.selected))?.id;
   const bodies = [m.suppliers.map(party), m.inputs.map(i => {
    const li = h('li', 'sipoc-card'); li.append(h('strong', 'sipoc-name', i.label)); if (i.label !== i.field) li.append(h('span', 'sipoc-detail sipoc-field', i.field));
    if (i.example !== null) li.append(h('span', 'sipoc-detail', 'e.g. ' + i.example)); if (i.arrived !== null) li.append(h('span', 'sipoc-count', plural(i.arrived, 'case') + ' arrived')); return li;
   }), m.stages.map((s, i) => stage(s, i, s.id === selectedStage)), m.outputs.map(o => {
    const li = h('li', 'sipoc-card'); li.append(h('strong', 'sipoc-name', o.label), h('span', 'sipoc-detail', o.detail)); if (o.count !== null) li.append(h('span', 'sipoc-count', o.count + ' completed')); return li;
   }), m.customers.map(party)];
   if (!m.inputs.length) { const none = h('li', 'sipoc-card sipoc-muted'); none.append(h('strong', 'sipoc-name', 'No arrival data or external needs')); bodies[1] = [none]; }
   COLUMNS.forEach(([letter, word, hint], c) => {
    const id = 'sipoc-h-' + word.toLowerCase(), col = h('section', 'sipoc-col sipoc-col-' + word.toLowerCase(), undefined, {'aria-labelledby': id}), head = h('h3', 'sipoc-head', undefined, {id, title: hint});
    head.append(h('span', 'sipoc-letter', letter, {'aria-hidden': 'true'}), h('span', 'sipoc-word', word)); const list = h(c === 2 ? 'ol' : 'ul', 'sipoc-list'); list.append(...bodies[c]!); col.append(head, list); grid.append(col);
   });
   scroller.replaceChildren(grid);
   strip.replaceChildren(...m.measures.map(x => { const box = h('div', 'sipoc-measure'); box.append(h('dt', 'sipoc-detail', x.label), h('dd', 'sipoc-value', x.value)); return box; }));
   if (focused) scroller.querySelector<HTMLElement>(`[data-stage="${focused}"]`)?.focus({preventScroll: true});
  }
  return {draw, frame() { scroller.scrollLeft = 0; }, dispose() { rootEl.remove(); drawn = ''; }};
 }
 root.LWProcessSipoc = {create, model};
})(globalThis);
