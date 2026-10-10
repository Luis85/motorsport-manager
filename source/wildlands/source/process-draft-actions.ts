/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-dom.ts" />
/// <reference path="./process-dialog.ts" />
/// <reference path="./process-draft.ts" />
/// <reference path="./process-structure.ts" />
/// <reference path="./process-layout.ts" />
/// <reference path="./process-renderer-2d.ts" />
/**
 * Draft actions of the studio shell (owner of these user flows; the authoring modules own the edits): **Add step…**, **Tidy layout**
 * and moving cards on the 2D map. Each writes ONE labelled step into the shared unapplied draft (`LWProcessDraft`), so the
 * Definition editor's undo covers it, and none of them applies, ticks, selects or touches storage. The status line says that the
 * draft changed and how to keep it ("Apply the draft to keep it.").
 *
 *  - **Add step…** (`#add-step` in the header from 1,200 px wide, else `#add-step-item` in the Export or phone ⋯ menu; Tidy layout
 *    likewise) opens a small dialog built on LWProcessDialog (id 'as'; Cancel first, then Add step; Cancel, Escape and Close add
 *    nothing and return focus to the opener, or to the menu button for the menu item; Enter in the name field adds): the kind
 *    (`LWProcessStructure.KINDS`), a name (blank gives "New <kind>"), the step to add after (default: the selected step when the draft
 *    has it, else the rightmost step) and **Insert into its path**, offered only while `LWProcessStructure.insertable` allows it for
 *    that step and the kind is not an end (otherwise disabled with its reason beside it). The result of `LWProcessStructure.add` is
 *    written with its label ("Added step Review"); a refusal is shown in the dialog and changes nothing. The running definition and
 *    its selection stay as they are.
 *  - **Tidy layout** (`#tidy-layout`, `#tidy-item`) writes `LWProcessLayout.tidy` with the label "Tidied the layout"; when no step
 *    would move it says so and writes nothing.
 *  - **Moving a card** (`move`, the 2D map's `move` option): reads the draft, writes `LWProcessLayout.move` with the label
 *    "Moved <step name>" (one undoable step per drop or Alt+Arrow press) and says "Moved <name> in the draft. Apply the draft to keep
 *    it.". While Present is open, when the draft is not valid JSON or no longer has the step, it refuses in the status line and the
 *    card returns to its drawn place. The map keeps showing a card moved here at its draft position while the draft holds a position
 *    other than the running one (`LWProcess2D.Surface.setMoves`): an undo or restore puts it back, and applying or switching process
 *    ends every such override.
 * All four controls carry `aria-disabled` and the reason as their title while the draft is not valid JSON (a press then repeats the
 * reason in the status line).
 */
declare namespace LWProcessDraftActions {
 interface Env {
  /** The studio root, made inert while the Add step dialog is open. */
  host: HTMLElement;
  view(): LWProcessApp.View;
  draft: LWProcessDraft.Store;
  status(message: string, error?: boolean): void;
  /** The 2D map surface drawn now (it is recreated after a process switch). */
  map(): LWProcess2D.Surface;
  /** True while Present is open: cards are not moved then. */
  presenting(): boolean;
  /** The visible opener of the Export or phone ⋯ menu, used as the invoker of a dialog opened from it. */
  menuTrigger(): HTMLElement | null;
 }
 interface Surface {
  /** The 2D map's `move` callback: one draft step per completed move. */
  move(stepId: string, position: [number, number]): void;
  /** Re-reads the draft for the controls' disabled state. */
  sync(): void;
  dispose(): void;
 }
 interface Api {create(env: Env): Surface;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessDraftActions?: LWProcessDraftActions.Api; LWProcessDom: LWProcessDom.Api; LWProcessDialog: LWProcessDialog.Api;
  LWProcessDraft: LWProcessDraft.Api; LWProcessStructure: LWProcessStructure.Api; LWProcessLayout: LWProcessLayout.Api};
 const get = <T extends HTMLElement = HTMLElement>(id: string) => root.LWProcessDom.must<T>(id);
 const esc = (v: unknown) => root.LWProcessDialog.escape(v);
 const INVALID = 'The draft is not valid JSON. Fix it in Edit process… first.';
 const KEEP = 'Apply the draft to keep it.';
 const TITLES: Record<string, string> = {'add-step': 'Add a step to the draft', 'add-step-item': 'Add a step to the draft',
  'tidy-layout': 'Place every step of the draft on a tidy grid', 'tidy-item': 'Place every step of the draft on a tidy grid'};
 const finite = (p: unknown): p is [number, number] => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]);
 function create(env: LWProcessDraftActions.Env): LWProcessDraftActions.Surface {
  const write = (d: LWProcess.Definition, source: string, label: string) => env.draft.write(root.LWProcessDraft.format(d), source, label);
  // ---- Moved cards: the map shows a card moved here at its draft position while that differs from the running one. ----
  const moved = new Set<string>();
  let placed = '{}';
  function overrides(): Record<string, [number, number]> {
   const draft = env.draft.parse(), running = env.view().definition, out: Record<string, [number, number]> = {};
   if (!draft) return out;
   for (const id of moved) {
    const at = draft.steps.find(s => s.id === id)?.scene?.position, was = running.steps.find(s => s.id === id)?.scene?.position;
    if (finite(at) && finite(was) && (at[0] !== was[0] || at[1] !== was[1])) out[id] = [at[0], at[1]];
   }
   return out;
  }
  /** Hands the overrides to the map when they changed (or always, after the map drew a refused move). */
  function place(force: boolean): void {
   const next = overrides(), key = JSON.stringify(next);
   if (!force && key === placed) return;
   placed = key; env.map().setMoves(next);
  }
  function move(stepId: string, position: [number, number]): void {
   const draft = env.draft.parse(), name = draft?.steps.find(s => s.id === stepId)?.name
    ?? env.view().definition.steps.find(s => s.id === stepId)?.name ?? stepId;
   const refuse = (message: string) => { env.status(message, true); place(true); };
   if (env.presenting()) { refuse(`Cards are not moved while presenting, so ${name} stays where it was.`); return; }
   if (!draft) { refuse(`The draft is not valid JSON, so ${name} was not moved. Fix it in Edit process… first.`); return; }
   const next = root.LWProcessLayout.move(draft, stepId, position);
   if (!next) { refuse(`${name} is not in the draft, so it was not moved.`); return; }
   moved.add(stepId); write(next, '2d', `Moved ${name}`); place(true);
   env.status(`Moved ${name} in the draft. ${KEEP}`);
  }
  // ---- Disabled state of the four controls. ----
  const controls = ['add-step', 'add-step-item', 'tidy-layout', 'tidy-item'];
  function sync(): void {
   const reason = env.draft.parse() ? '' : INVALID;
   for (const id of controls) {
    const control = get(id), title = reason || TITLES[id]!;
    if (reason) control.setAttribute('aria-disabled', 'true'); else control.removeAttribute('aria-disabled');
    if (control.title !== title) control.title = title;
   }
  }
  const unsubscribe = env.draft.subscribe(event => {
   if (event.source === 'enter') { moved.clear(); placed = '{}'; } else if (event.source !== '2d') place(false);
   sync();
  });
  // ---- Tidy layout ----
  function tidy(): void {
   const draft = env.draft.parse();
   if (!draft) { env.status(INVALID, true); return; }
   const {definition, moved: count} = root.LWProcessLayout.tidy(draft);
   if (!count) { env.status('Every step is already in its tidy place, so the draft is unchanged.'); return; }
   write(definition, 'layout', 'Tidied the layout');
   env.status(`Tidied the layout in the draft: ${count} ${count === 1 ? 'step' : 'steps'} moved. ${KEEP}`);
  }
  // ---- Add step… ----
  let dialog: LWProcessDialog.Surface | null = null, insertWanted = true;
  function build(): LWProcessDialog.Surface {
   const d = root.LWProcessDialog.create(document.body, {
    id: 'as', size: 'list', title: 'Add step', inertRoot: env.host,
    actions: [{id: 'cancel', label: 'Cancel', cancel: true}, {id: 'add', label: 'Add step', primary: true}],
    onAction: id => { if (id === 'add') add(); },
   });
   const kinds = root.LWProcessStructure.KINDS.map(([kind, label]) => `<option value="${kind}">${esc(label)}</option>`).join('');
   const form = document.createElement('div'); form.className = 'as-form';
   form.innerHTML = `<label for="as-kind">Kind of step</label><select id="as-kind" autofocus>${kinds}</select>`
    + '<label for="as-name">Name</label><input id="as-name" type="text" maxlength="120" autocomplete="off" aria-describedby="as-name-help">'
    + '<p id="as-name-help">Leave it empty to name the step after its kind, for example New task.</p>'
    + '<label for="as-after">Place it after</label><select id="as-after"></select>'
    + '<label class="as-check"><input id="as-insert" type="checkbox" aria-describedby="as-insert-note"> Insert into its path</label>'
    + '<p id="as-insert-note"></p>';
   d.body.append(form);
   get('as-kind').addEventListener('change', insertState); get('as-after').addEventListener('change', insertState);
   get<HTMLInputElement>('as-insert').addEventListener('change', () => { insertWanted = get<HTMLInputElement>('as-insert').checked; });
   get<HTMLInputElement>('as-name').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
   return d;
  }
  /** Offers Insert into its path only where the structure allows it, and says why not beside the disabled box. */
  function insertState(): void {
   const draft = env.draft.parse(), after = get<HTMLSelectElement>('as-after').value, kind = get<HTMLSelectElement>('as-kind').value;
   const box = get<HTMLInputElement>('as-insert'), name = draft?.steps.find(s => s.id === after)?.name ?? after;
   const into = draft && after && kind !== 'end' ? root.LWProcessStructure.insertable(draft, after) : null;
   const note = into ? `The path from ${name} to ${into.toName} then leads through the new step.`
    : !after ? 'Choose a step to place it after to insert it into that step’s path.'
     : kind === 'end' ? 'An end step finishes the process, so it is not inserted into a path.'
      : `${name} has no single outgoing path to insert the new step into.`;
   box.disabled = !into; box.checked = !!into && insertWanted;
   get('as-insert-note').textContent = note;
  }
  function add(): void {
   const draft = env.draft.parse();
   if (!draft) { dialog!.setStatus(`<p><strong>${esc(INVALID)}</strong></p>`, 'alert'); return; }
   const after = get<HTMLSelectElement>('as-after').value || undefined, box = get<HTMLInputElement>('as-insert');
   const kind = get<HTMLSelectElement>('as-kind').value as LWProcessStructure.AddKind;
   const result = root.LWProcessStructure.add(draft, {kind, name: get<HTMLInputElement>('as-name').value, after, insert: !box.disabled && box.checked});
   if (!result.ok) { dialog!.setStatus(`<p><strong>${esc(result.reason)}</strong></p>`, 'alert'); return; }
   write(result.definition, 'structure', result.label);
   dialog!.close('action');
   env.status([`${result.label} to the draft.`, ...result.notes, KEEP].join(' '));
  }
  function openAdd(invoker: HTMLElement | null): void {
   const draft = env.draft.parse();
   if (!draft) { env.status(INVALID, true); return; }
   dialog ??= build();
   const selected = env.view().selected, after = get<HTMLSelectElement>('as-after');
   const rightmost = draft.steps.reduce<LWProcess.Step | undefined>((best, s) => {
    const x = finite(s.scene?.position) ? s.scene.position[0] : 0, top = finite(best?.scene?.position) ? best!.scene.position[0] : -Infinity;
    return !best || x > top ? s : best;
   }, undefined);
   after.innerHTML = draft.steps.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
   after.value = draft.steps.some(s => s.id === selected) ? selected! : rightmost?.id ?? '';
   get<HTMLSelectElement>('as-kind').value = 'task'; get<HTMLInputElement>('as-name').value = '';
   insertWanted = true; insertState(); dialog.setStatus('');
   if (!dialog.open({invoker, focusFallback: () => env.menuTrigger()})) env.status('Close the open window first.', true);
  }
  get('add-step').onclick = () => openAdd(get('add-step'));
  get('add-step-item').onclick = () => openAdd(env.menuTrigger());
  get('tidy-layout').onclick = tidy;
  get('tidy-item').onclick = tidy;
  sync();
  return {move, sync, dispose() { unsubscribe(); dialog?.dispose(); dialog = null; }};
 }
 root.LWProcessDraftActions = {create};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessDraftActions;
})(globalThis);
