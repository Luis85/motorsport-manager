/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-step-model.ts" />
/// <reference path="./process-step-logic.ts" />
/// <reference path="./process-step-flows.ts" />
/**
 * The step editor's row buttons (owner: the authoring package): add and remove set values, counters, declared outputs, needs,
 * random fields and their choices, condition tests and outgoing paths, and move a decision's paths up or down. Each action changes
 * the detached LWProcessStepModel.Model in place and says where focus goes next; a removal also names what was removed
 * ("Removed need 2 budget") and the control that shows the row again when it is undone, so the editor can offer "Removed … Undo".
 * No DOM writes, session or storage: the editor renders, records the undo step and writes the draft.
 */
declare namespace LWProcessStepRows {
 interface Context {
  /** The step chosen in "Add path to…". */
  addTo: string;
  /** Finds a rendered control (to choose a Move up/Move down focus that is not disabled). */
  find(selector: string): HTMLButtonElement | null;
  idOf(bind: string): string;
 }
 interface Done {
  /** The control to focus after the re-render. */
  focus?: string;
  /** "Removed need 2 budget" for a removal. */
  removed?: string;
  /** The control that shows the removed row again after Undo. */
  restore?: string;
 }
 interface Api {
  /** Runs the row action of `button` (its `data-act`, `data-i`, `data-j`, `data-path`); undefined when it is not a row action. */
  run(model: LWProcessStepModel.Model, button: HTMLButtonElement, context: Context): Done | undefined;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessStepModel: LWProcessStepModel.Api; LWProcessStepLogic: LWProcessStepLogic.Api; LWProcessStepFlows: LWProcessStepFlows.Api;
  LWProcessStepRows?: LWProcessStepRows.Api};
 type M = LWProcessStepModel.Model;
 type Done = LWProcessStepRows.Done;
 const bind = (key: string) => `[data-bind="${key}"]`;
 /** The four simple row lists: model key, the add button, the field focused in a new row and the removal word. */
 const LISTS = {
  set: {add: 'add-set', first: 'key', word: 'value', name: (m: M, i: number) => m.set[i]?.key ?? ''},
  add: {add: 'add-add', first: 'key', word: 'counter', name: (m: M, i: number) => m.add[i]?.key ?? ''},
  outputs: {add: 'add-output', first: 'field', word: 'output', name: (m: M, i: number) => m.outputs[i]?.field ?? ''},
  needs: {add: 'add-need', first: 'field', word: 'need', name: (m: M, i: number) => m.needs[i]?.field ?? ''},
 } as const;
 type ListName = keyof typeof LISTS;
 const REMOVE: Record<string, ListName> = {'remove-set': 'set', 'remove-add': 'add', 'remove-output': 'outputs', 'remove-need': 'needs'};
 const named = (word: string, n: number, name: string) => `Removed ${word} ${n}${name ? ' ' + name : ''}`;
 function addRow(m: M, what: string): Done | undefined {
  const api = root.LWProcessStepModel;
  if (what === 'add-set') m.set.push({key: '', value: api.newValue()});
  else if (what === 'add-add') m.add.push({key: '', delta: '1'});
  else if (what === 'add-output') m.outputs.push({field: '', label: ''});
  else if (what === 'add-need') m.needs.push({field: '', op: '', value: api.newValue(), label: ''});
  else if (what === 'add-draw') {
   m.draws.push(api.newDraw());
   return {focus: bind(`draws.${m.draws.length - 1}.field`)};
  } else return undefined;
  const list = (Object.keys(LISTS) as ListName[]).find(k => LISTS[k].add === what)!;
  return {focus: bind(`${list}.${(m[list] as unknown[]).length - 1}.${LISTS[list].first}`)};
 }
 function removeRow(m: M, what: string, i: number): Done | undefined {
  const list = REMOVE[what];
  if (!list) return undefined;
  const spec = LISTS[list], removed = named(spec.word, i + 1, spec.name(m, i));
  (m[list] as unknown[]).splice(i, 1);
  return {focus: '#se-' + spec.add, removed, restore: bind(`${list}.${i}.${spec.first}`)};
 }
 function draws(m: M, what: string, i: number, j: number): Done | undefined {
  if (what === 'remove-draw') {
   const removed = named('random field', i + 1, m.draws[i]?.field ?? '');
   m.draws.splice(i, 1);
   return {focus: '#se-add-draw', removed, restore: bind(`draws.${i}.field`)};
  }
  if (what === 'add-choice') {
   const row = m.draws[i]!;
   row.values.push({value: {type: 'text', text: ''}, weight: '1'});
   return {focus: bind(`draws.${i}.values.${row.values.length - 1}.value.text`)};
  }
  if (what === 'remove-choice') {
   m.draws[i]!.values.splice(j, 1);
   return {focus: `#se-add-choice-${i}`, removed: `Removed value ${j + 1} of random field ${i + 1}`, restore: bind(`draws.${i}.values.${j}.value.type`)};
  }
  return undefined;
 }
 function conditions(m: M, what: string, i: number, path: string, c: LWProcessStepRows.Context): Done | undefined {
  const logic = root.LWProcessStepLogic;
  if (what === 'add-cond') {
   const cond = logic.condAt(m, path)!;
   (cond.items ??= []).push(logic.newLeaf());
   return {focus: bind(`${path}.items.${cond.items.length - 1}.field`)};
  }
  if (what === 'remove-cond') {
   logic.condAt(m, path)?.items?.splice(i, 1);
   return {focus: '#' + c.idOf(path + '.add'), removed: `Removed test ${i + 1}`, restore: `[data-bind^="${path}.items.${i}."]`};
  }
  return undefined;
 }
 function paths(m: M, what: string, i: number, c: LWProcessStepRows.Context): Done | undefined {
  const flows = root.LWProcessStepFlows;
  if (what === 'add-path') {
   const choices = flows.targets(m), to = choices.some(([id]) => id === c.addTo) ? c.addTo : choices[0]?.[0];
   if (!to) return {};
   return {focus: bind(`flows.${flows.add(m, to)}.to`)};
  }
  if (what === 'remove-path') {
   const removed = `Removed path ${i + 1}${m.flows[i] ? ' to ' + m.flows[i]!.toName : ''}`;
   flows.remove(m, i);
   return {focus: '#se-add-path', removed, restore: bind(`flows.${i}.to`)};
  }
  if (what === 'up' || what === 'down') {
   const to = what === 'up' ? i - 1 : i + 1;
   [m.flows[i], m.flows[to]] = [m.flows[to]!, m.flows[i]!];
   const same = `[data-act="${what}"][data-i="${to}"]`, target = c.find(same);
   return {focus: target && !target.disabled ? same : `[data-act="${what === 'up' ? 'down' : 'up'}"][data-i="${to}"]`};
  }
  return undefined;
 }
 function run(m: M, button: HTMLButtonElement, c: LWProcessStepRows.Context): Done | undefined {
  const what = button.dataset.act ?? '', i = Number(button.dataset.i), j = Number(button.dataset.j);
  return addRow(m, what) ?? removeRow(m, what, i) ?? draws(m, what, i, j) ?? conditions(m, what, i, button.dataset.path ?? '', c) ?? paths(m, what, i, c);
 }
 root.LWProcessStepRows = {run};
})(globalThis);
