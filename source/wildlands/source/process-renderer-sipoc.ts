/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-sipoc-model.ts" />
/**
 * SIPOC lens: Suppliers, Inputs, Process, Outputs, Customers as a read-only DOM grid over the same definition and snapshot.
 * Selection sends intent only; this module never ticks, mutates or retains a run. The columns come from the pure model in
 * process-sipoc-model.ts (`LWProcessSipocModel`, also exposed here as `model`), whose main route is the shared LWProcessRoute walk.
 */
declare namespace LWProcessSipoc {
 interface ViewLike {definition: LWProcess.Definition; snapshot: LWProcess.Snapshot; selected: string | null;}
 interface Surface {draw(view: ViewLike): void; dispose(): void; frame?(): void;}
 interface Api {create(host: HTMLElement, onSelect: (stepId: string | null) => void): Surface; model(definition: LWProcess.Definition, snapshot: LWProcess.Snapshot): Model;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessSipoc?: LWProcessSipoc.Api; LWProcessSipocModel: LWProcessSipoc.ModelApi};
 const plural = (n: number, one: string, many = one + 's') => n + ' ' + (n === 1 ? one : many);
 const model = (d: LWProcess.Definition, q: LWProcess.Snapshot): LWProcessSipoc.Model => root.LWProcessSipocModel.model(d, q);
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
