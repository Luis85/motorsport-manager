/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-step-model.ts" />
/// <reference path="./process-step-logic.ts" />
/// <reference path="./process-step-kit.ts" />
/// <reference path="./process-step-logic-sections.ts" />
/// <reference path="./process-step-sections.ts" />
/**
 * "Where work goes next": the outgoing paths of the step being edited. It owns the pure path operations on the detached
 * LWProcessStepModel.Model (add a path to an existing step, remove one, point one at another step, and why a path may not be
 * removed) and the markup of that section. The model writes the rows back into the draft and the catalog alone decides
 * whether the result is valid. Nothing here touches the DOM, a session or storage.
 */
declare namespace LWProcessStepFlows {
 interface Ui {
  /** The step chosen in "Add path to…", kept across re-renders. */
  addTo?: string;
 }
 interface Api {
  /** Steps a path may lead to, as [id, name]: every step of the draft except the start step and this step. */
  targets(m: LWProcessStepModel.Model): [string, string][];
  /** A flow id for a new path to `to`: `<step>-<to>`, numbered when taken, never longer than an id may be. */
  newId(m: LWProcessStepModel.Model, to: string): string;
  /** Adds a path to step `to` and returns its row index. */
  add(m: LWProcessStepModel.Model, to: string): number;
  /** Removes path `k`. A deadline that named it no longer names a path. */
  remove(m: LWProcessStepModel.Model, k: number): void;
  /** Points path `k` at step `to`. */
  retarget(m: LWProcessStepModel.Model, k: number, to: string): void;
  /** Why path `k` may not be removed ('A task needs exactly one outgoing path.'), or '' when it may. */
  removeBlocked(m: LWProcessStepModel.Model, k: number): string;
  /** The section markup. */
  render(m: LWProcessStepModel.Model, ui?: Ui): string;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessStepLogic: LWProcessStepLogic.Api; LWProcessStepLogicSections: LWProcessStepLogicSections.Api;
  LWProcessStepKit: LWProcessStepKit.Api; LWProcessStepFlows?: LWProcessStepFlows.Api};
 type M = LWProcessStepModel.Model;
 const kit = () => root.LWProcessStepKit, L = () => root.LWProcessStepLogic;
 const A_KIND: Partial<Record<LWProcess.Kind, string>> = {start: 'The start step', task: 'A task', touchpoint: 'A touchpoint', machine: 'A machine step',
  system: 'A system step', timer: 'A timer', decision: 'A decision', fork: 'A fork', join: 'A join'};
 /** The fewest normal (non-deadline) paths a kind needs. An end step has none and offers no paths at all. */
 const fewest = (kind: LWProcess.Kind) => kind === 'decision' || kind === 'fork' ? 2 : 1;
 const ID_MAX = 64;
 const targets = (m: M): [string, string][] => m.others.filter(s => s.kind !== 'start' && s.id !== m.id).map(s => [s.id, s.name]);
 function newId(m: M, to: string): string {
  const taken = new Set([...m.flowIds, ...m.flows.map(f => f.id)]), base = `${m.id}-${to}`.slice(0, ID_MAX).replace(/-+$/, '');
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base.slice(0, ID_MAX - String(n).length - 1).replace(/-+$/, '')}-${n}`;
  return id;
 }
 const nameOf = (m: M, id: string) => m.others.find(s => s.id === id)?.name ?? id;
 function add(m: M, to: string): number {
  m.flows.push({id: newId(m, to), to, toName: nameOf(m, to), label: '', cond: L().readCond(undefined)});
  return m.flows.length - 1;
 }
 function remove(m: M, k: number): void {
  const [row] = m.flows.splice(k, 1);
  if (row && m.deadline?.flow === row.id) m.deadline.flow = '';
 }
 function retarget(m: M, k: number, to: string): void {
  const row = m.flows[k]; if (!row) return;
  row.to = to; row.toName = nameOf(m, to);
 }
 function removeBlocked(m: M, k: number): string {
  const row = m.flows[k]; if (!row || L().isDeadlineFlow(m, row.id)) return '';
  const normal = m.flows.filter(f => !L().isDeadlineFlow(m, f.id)).length, need = fewest(m.kind);
  if (normal > need) return '';
  return `${A_KIND[m.kind] ?? 'This step'} needs ${need === 1 ? 'exactly one outgoing path' : 'at least two outgoing paths'}.`;
 }
 function card(m: M, k: number, choices: [string, string][]): string {
  const f = m.flows[k]!, s = kit(), logic = root.LWProcessStepLogicSections;
  const decision = m.kind === 'decision', conditional = decision || m.branching === 'inclusive';
  const late = L().isDeadlineFlow(m, f.id), last = m.flows.length - 1;
  const where = k === 0 ? 'Checked first. Cannot move up.' : k === last ? 'Checked last. Cannot move down.' : `Position ${k + 1} of ${m.flows.length}.`;
  const moves = decision && m.flows.length > 1
   ? `<div class="se-actions">${s.button('up', 'Move up', k, k === 0 ? ' disabled aria-describedby="se-first"' : '')}`
   + `${s.button('down', 'Move down', k, k === last ? ' disabled aria-describedby="se-last"' : '')}<span class="se-help">${where}</span></div>` : '';
  const rule = late ? '<p class="se-help">This is the deadline path: it is taken when the deadline fires and takes no condition.</p>'
   : conditional || f.cond.on ? logic.condition(m, f, k) : '';
  // A path that points somewhere no path may lead (a missing step or the start) keeps its value visible so the select never lies.
  const options = choices.some(([id]) => id === f.to) ? choices : [[f.to, f.toName] as [string, string], ...choices];
  const blocked = removeBlocked(m, k), keep = `se-flows-${k}-keep`;
  const removeButton = s.button('remove-path', 'Remove path', k, blocked ? ` disabled aria-describedby="${keep}"` : '', `Remove path ${k + 1} to ${f.toName}`)
   + (blocked ? `<span class="se-help" id="${keep}">${s.esc(blocked)}</span>` : '');
  const legend = `Path ${k + 1} of ${m.flows.length} · to ${s.esc(f.toName)}${late ? ' · deadline path' : ''}`;
  return `<fieldset class="se-card${late ? ' se-deadline-path' : ''}"><legend>${legend}</legend>`
   + `<div class="se-grid">${s.select(`flows.${k}.to`, 'Go to', options, f.to, true)}${s.field(`flows.${k}.label`, 'Label shown on this path', f.label)}</div>`
   + `${rule}${s.err(`flows.${k}`)}${moves}<div class="se-actions">${removeButton}</div></fieldset>`;
 }
 function adder(m: M, choices: [string, string][], ui: LWProcessStepFlows.Ui): string {
  if (!choices.length) return '<p class="se-help se-empty">There is no other step a path could lead to.</p>';
  const s = kit(), chosen = choices.some(([id]) => id === ui.addTo) ? ui.addTo! : choices[0]![0];
  const options = choices.map(([id, name]) => `<option value="${s.esc(id)}"${id === chosen ? ' selected' : ''}>${s.esc(name)}</option>`).join('');
  const help = m.deadline ? ' A second path can become the deadline path in the Deadline section.' : '';
  return `<div class="se-grid se-add-path"><div class="se-field"><label for="se-add-path-to">Add path to…</label>`
   + `<select id="se-add-path-to" data-ui="add-to" aria-describedby="se-add-path-help">${options}</select>`
   + `<p class="se-help" id="se-add-path-help">The new path starts without a label or condition.${help}</p></div></div>`
   + s.button('add-path', 'Add path', undefined, ' id="se-add-path"');
 }
 function render(m: M, ui: LWProcessStepFlows.Ui = {}): string {
  const s = kit();
  if (m.kind === 'end') return s.section('flows', 'Where work goes next', 'This step ends the process, so it has no outgoing paths.', '');
  const decision = m.kind === 'decision', inclusive = m.branching === 'inclusive', conditional = decision || inclusive, choices = targets(m);
  const deadline = m.flows.some(f => L().isDeadlineFlow(m, f.id));
  const label = decision ? 'Order in which the paths are checked' : 'Branches and the conditions that start them';
  const summary = conditional ? `<ol class="se-paths" id="se-path-summary" aria-label="${label}">${root.LWProcessStepLogicSections.pathSummary(m)}</ol>` : '';
  const intro = (decision ? 'The first path whose condition matches wins, so order matters; the path without a condition is the fallback. '
   : inclusive ? 'Every branch whose condition is true starts. The branch without a condition is the default: '
    + 'it starts only when no other branch matches. ' : '')
   + (deadline ? 'The deadline path is taken when the deadline fires. ' : '')
   + 'Choose where each path goes with Go to, add a path with Add path to… or remove one. The draft is checked as you edit.';
  const rows = m.flows.map((_, k) => card(m, k, choices)).join('');
  const body = summary + (rows || '<p class="se-help">This step has no outgoing path yet.</p>') + s.err('flows') + adder(m, choices, ui);
  return s.section('flows', 'Where work goes next', intro, body);
 }
 root.LWProcessStepFlows = {targets, newId, add, remove, retarget, removeBlocked, render};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessStepFlows;
})(globalThis);
