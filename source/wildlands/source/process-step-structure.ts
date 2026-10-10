/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-html.ts" />
/// <reference path="./process-step-model.ts" />
/// <reference path="./process-structure.ts" />
/// <reference path="./process-dialog.ts" />
/**
 * The step editor's "Step structure" section (owner: the authoring package): Add step after this one…, Duplicate step, Change
 * kind…, Delete step… and, for a start step the process does not name, Make this the start step. It renders the section and runs
 * each action through the editor's context:
 *  - every action first passes the editor's dirty guard ("Add the step? Your changes to Review are not in the draft yet." with
 *    Keep editing first, Save to draft and <verb> when the edits can be written, and Discard changes); deleting skips it and says
 *    instead that unsaved changes are discarded with the step;
 *  - Change kind… and Delete step… then ask in the shared Cancel-first footer confirm, naming the fields that are dropped or the
 *    paths that are removed, with a checked "Reconnect <predecessors> to <target>" option when reconnecting is possible;
 *  - the result of LWProcessStructure is written to the shared draft with its label ("Added step Review"), so the Definition
 *    editor's undo history covers it. Nothing applies or resets the run, ticks, or touches storage.
 * Controls carry `data-ui="structure-…"` (never `data-bind`), so they are not part of the step's form model or its undo history.
 */
declare namespace LWProcessStepStructure {
 interface Context {
  dialog: LWProcessDialog.Surface;
  draft: LWProcessDraft.Store;
  model(): LWProcessStepModel.Model;
  /** True when the form holds edits that are not in the draft. */
  dirty(): boolean;
  /** True when those edits can be written faithfully (no local problems). */
  writable(): boolean;
  /** Writes the form's edits to the draft (Save to draft without closing). */
  save(): void;
  /** Loads a step of the draft into the editor (title, form and history); false when it is not there. */
  load(stepId: string): boolean;
  /** Closes the editor after a delete and says what happened on the page. */
  closed(message: string): void;
  /** Re-renders this section (after its UI state changed) and focuses `focus` when given. */
  refresh(focus?: string): void;
 }
 interface Controller {
  render(): string;
  /** Handles a `data-act="structure-…"` button; false when the button is not one of this section's. */
  act(button: HTMLButtonElement): boolean;
  /** Keeps a `data-ui="structure-…"` control's value across re-renders; false when it is not one of this section's. */
  input(control: HTMLInputElement | HTMLSelectElement): boolean;
  /** Closes the inline forms (a new step was loaded). */
  reset(): void;
 }
 interface Api {create(context: Context): Controller}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessHtml: LWProcessHtml.Api; LWProcessStructure: LWProcessStructure.Api;
  LWProcessStepStructure?: LWProcessStepStructure.Api};
 type Kind = LWProcessStructure.AddKind;
 const {esc} = root.LWProcessHtml;
 const A_KIND: Record<string, string> = {task: 'a task', touchpoint: 'a touchpoint', machine: 'a machine step', system: 'a system step', timer: 'a timer',
  decision: 'a decision', fork: 'a fork', join: 'a join', end: 'an end step'};
 const START_WHY = 'The start step cannot be duplicated, deleted or changed: every process needs exactly one.';
 function create(c: LWProcessStepStructure.Context): LWProcessStepStructure.Controller {
  const S = () => root.LWProcessStructure;
  let open: '' | 'add' | 'kind' = '', kind: Kind = 'task', name = '', insert = true, newKind: Kind = 'task';
  const options = (list: [Kind, string][], chosen: string) =>
   list.map(([k, label]) => `<option value="${k}"${k === chosen ? ' selected' : ''}>${esc(label)}</option>`).join('');
  const button = (act: string, label: string, extra = '') =>
   `<button type="button" data-act="structure-${act}" id="se-structure-${act}"${extra}>${esc(label)}</button>`;
  function addForm(def: LWProcess.Definition, m: LWProcessStepModel.Model): string {
   const into = S().insertable(def, m.id), label = S().KINDS.find(([k]) => k === kind)![1];
   const box = `<input type="checkbox" id="se-structure-insert" data-ui="structure-insert"${insert ? ' checked' : ''}>`;
   const check = into && kind !== 'end' ? `<label class="se-check">${box} `
    + `Insert it between ${esc(m.name)} and ${esc(into.toName)}</label>` : '';
   const help = into && kind !== 'end' ? 'Inserting points this step’s path at the new step and connects the new step to where the path went.'
    : 'The new step starts without paths; connect it with Add path to… in this editor.';
   return `<fieldset class="se-card" id="se-structure-add-form"><legend>Add a step after ${esc(m.name)}</legend><div class="se-grid">`
    + `<div class="se-field"><label for="se-structure-kind">Kind of step</label>`
    + `<select id="se-structure-kind" data-ui="structure-kind">${options(S().KINDS, kind)}</select></div>`
    + `<div class="se-field"><label for="se-structure-name">Name</label><input type="text" id="se-structure-name" data-ui="structure-name" maxlength="120" `
    + `placeholder="New ${esc(label.toLowerCase())}" value="${esc(name)}"></div></div>${check}<p class="se-help">${esc(help)}</p>`
    + `<div class="se-actions">${button('add', 'Add step')}${button('add-cancel', 'Cancel')}</div></fieldset>`;
  }
  function kindForm(def: LWProcess.Definition, m: LWProcessStepModel.Model): string {
   const list = S().KINDS.filter(([k]) => k !== m.kind);
   if (!list.some(([k]) => k === newKind)) newKind = list[0]![0];
   const drops = S().drops(def, m.id, newKind);
   const preview = drops.length ? `Changing to ${A_KIND[newKind]} drops ${drops.join(', ')}.` : `Changing to ${A_KIND[newKind]} drops nothing.`;
   return `<fieldset class="se-card" id="se-structure-kind-form"><legend>Change the kind of ${esc(m.name)}</legend><div class="se-grid">`
    + `<div class="se-field"><label for="se-structure-newkind">New kind</label><select id="se-structure-newkind" data-ui="structure-newkind" `
    + `aria-describedby="se-structure-drops">${options(list, newKind)}</select>`
    + `<p class="se-help" id="se-structure-drops">${esc(preview)}</p></div></div>`
    + `<div class="se-actions">${button('change', 'Change kind…')}${button('kind-cancel', 'Cancel')}</div></fieldset>`;
  }
  function render(): string {
   const m = c.model(), def = c.draft.parse();
   if (!def) return '';
   const start = m.kind === 'start', why = start ? ' disabled aria-describedby="se-structure-why"' : '';
   const startAction = start && def.start !== m.id ? button('start', 'Make this the start step') : '';
   const actions = button('add-open', 'Add step after this one…', ` aria-expanded="${open === 'add'}"`) + button('duplicate', 'Duplicate step', why)
    + button('kind-open', 'Change kind…', `${why} aria-expanded="${open === 'kind'}"`) + button('delete', 'Delete step…', why) + startAction;
   const form = open === 'add' ? addForm(def, m) : open === 'kind' && !start ? kindForm(def, m) : '';
   return `<section class="se-section se-structure" aria-labelledby="se-h-structure"><h3 id="se-h-structure">Step structure</h3>`
    + '<p class="se-help">Add, duplicate, change or delete steps. Each change goes straight into the draft; nothing is applied and the run '
    + 'does not reset. Undo it in the Definition editor.</p>'
    + `<div class="se-actions">${actions}</div>${start ? `<p class="se-help" id="se-structure-why">${START_WHY}</p>` : ''}${form}</section>`;
  }
  /** The dirty guard of every structural action; true when it may go ahead (after saving the edits when asked to). */
  async function guard(question: string, verb: string): Promise<boolean> {
   if (!c.dirty()) return true;
   const m = c.model(), save = c.writable() ? [{id: 'save-structure', label: `Save to draft and ${verb}`}] : [];
   const choice = await c.dialog.confirm(`${question} Your changes to ${m.name || m.id} are not in the draft yet.`,
    [{id: 'keep', label: 'Keep editing', default: true}, ...save, {id: 'discard', label: 'Discard changes'}]);
   if (!c.dialog.isOpen() || choice === 'keep') return false;
   if (choice === 'save-structure') c.save();
   return true;
  }
  /** Writes a structural result to the draft, or shows why it was refused; true when written. */
  function commit(result: LWProcessStructure.Result): result is LWProcessStructure.Done {
   if (!result.ok) {
    c.dialog.setNote(`<strong>Not changed.</strong> ${esc(result.reason)}`);
    return false;
   }
   c.draft.write(JSON.stringify(result.definition, null, 2), 'step-editor', result.label);
   return true;
  }
  const announce = (r: LWProcessStructure.Done) => c.dialog.setNote(esc([r.label + '.', ...r.notes, 'Undo it in the Definition editor.'].join(' ')));
  async function add(): Promise<void> {
   const at = c.model().id;
   if (!(await guard('Add the step?', 'add'))) return;
   const def = c.draft.parse();
   if (!def) return;
   const result = S().add(def, {kind, name, after: at, insert});
   if (!commit(result)) return;
   reset();
   if (c.load(result.stepId)) {
    announce(result);
    c.refresh('#se-name');
   }
  }
  async function duplicate(): Promise<void> {
   const at = c.model().id;
   if (!(await guard('Duplicate the step?', 'duplicate'))) return;
   const def = c.draft.parse(), result = def ? S().duplicate(def, at) : undefined;
   if (!result || !commit(result)) return;
   reset();
   if (c.load(result.stepId)) {
    announce(result);
    c.refresh('#se-name');
   }
  }
  async function change(): Promise<void> {
   const m = c.model(), to = newKind;
   if (!(await guard(`Change ${m.name || m.id} to ${A_KIND[to]}?`, 'change'))) return;
   const def = c.draft.parse();
   if (!def) return;
   const drops = S().drops(def, m.id, to), name = def.steps.find(s => s.id === m.id)?.name ?? m.name;
   const lost = drops.length ? ` These are dropped: ${drops.join(', ')}.` : ' Nothing is dropped.';
   const choice = await c.dialog.confirm(`Change ${name} to ${A_KIND[to]}?${lost}`,
    [{id: 'kind-keep', label: 'Cancel', default: true}, {id: 'kind-go', label: 'Change kind'}]);
   if (!c.dialog.isOpen() || choice !== 'kind-go') return;
   const result = S().changeKind(def, m.id, to);
   if (!commit(result)) return;
   reset();
   if (c.load(m.id)) {
    announce(result);
    c.refresh('#se-structure-kind-open');
   }
  }
  async function remove(): Promise<void> {
   const m = c.model(), def = c.draft.parse();
   if (!def) return;
   const plan = S().removal(def, m.id);
   if (plan.blocked) {
    c.dialog.setNote(`<strong>Not deleted.</strong> ${esc(plan.blocked)}`);
    return;
   }
   const paths = [...plan.incoming.map(f => `from ${f.fromName}`), ...plan.outgoing.filter(f => f.to !== m.id).map(f => `to ${f.toName}`)];
   const what = paths.length ? `This removes the step and ${paths.length === 1 ? 'its path' : `its ${paths.length} paths`} (${paths.join(', ')}).`
    : 'It has no paths.';
   const unsaved = c.dirty() ? ' Your unsaved changes to it are discarded too.' : '';
   const check = plan.reconnect ? {label: `Reconnect ${plan.reconnect.from.join(', ')} to ${plan.reconnect.toName}`, checked: true} : undefined;
   const asked = await c.dialog.ask(`Delete ${plan.name}? ${what}${unsaved}`,
    [{id: 'delete-keep', label: 'Cancel', default: true}, {id: 'delete-go', label: 'Delete step'}], check ? {check} : {});
   if (!c.dialog.isOpen() || asked.choice !== 'delete-go') return;
   const result = S().remove(def, m.id, {reconnect: !!check && asked.checked});
   if (!commit(result)) return;
   c.closed([result.label + ' from the draft.', ...result.notes, 'Undo it in the Definition editor (Ctrl+Z).'].join(' '));
  }
  async function makeStart(): Promise<void> {
   const at = c.model().id;
   if (!(await guard('Make this the start step?', 'continue'))) return;
   const def = c.draft.parse(), result = def ? S().setStart(def, at) : undefined;
   if (!result || !commit(result)) return;
   if (c.load(at)) {
    announce(result);
    c.refresh('#se-h-structure');
   }
  }
  function reset(): void {
   open = '';
   name = '';
  }
  const ACTIONS: Record<string, () => void> = {
   'structure-add-open': () => { open = open === 'add' ? '' : 'add'; c.refresh(open ? '#se-structure-kind' : '#se-structure-add-open'); },
   'structure-kind-open': () => { open = open === 'kind' ? '' : 'kind'; c.refresh(open ? '#se-structure-newkind' : '#se-structure-kind-open'); },
   'structure-add-cancel': () => { open = ''; c.refresh('#se-structure-add-open'); },
   'structure-kind-cancel': () => { open = ''; c.refresh('#se-structure-kind-open'); },
   'structure-add': () => void add(),
   'structure-duplicate': () => void duplicate(),
   'structure-change': () => void change(),
   'structure-delete': () => void remove(),
   'structure-start': () => void makeStart(),
  };
  return {
   render,
   act(b) {
    const run = ACTIONS[b.dataset.act ?? ''];
    if (!run) return false;
    run();
    return true;
   },
   input(control) {
    const ui = control.dataset.ui ?? '';
    if (ui === 'structure-kind') {
     kind = control.value as Kind;
     c.refresh('#se-structure-kind');
    } else if (ui === 'structure-newkind') {
     newKind = control.value as Kind;
     c.refresh('#se-structure-newkind');
    } else if (ui === 'structure-name') name = control.value;
    else if (ui === 'structure-insert') insert = (control as HTMLInputElement).checked;
    else return false;
    return true;
   },
   reset,
  };
 }
 root.LWProcessStepStructure = {create};
})(globalThis);
