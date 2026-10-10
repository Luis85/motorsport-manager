/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-structure.ts" />
/// <reference path="./process-layout.ts" />
/// <reference path="./process-dialog.ts" />
/**
 * The Definition editor's "Steps" section in Tune values (owner: the authoring package): **Add step** (kind, name, after which
 * step, and whether to insert it into that step's only path) for adding a step without a selection, and **Tidy layout**
 * (LWProcessLayout.tidy). Both build a new draft definition and hand it to `env.write(text, label)` with a label ("Added step
 * Review", "Tidied the layout"), so the Definition editor's undo history covers them; nothing applies, ticks or touches storage.
 * The section follows the draft through `refresh()` (the step list of "After") and is disabled with the form while the JSON
 * cannot be read.
 */
declare namespace LWProcessDefinitionStructure {
 interface Env {
  /** The draft as a definition shape, or undefined while it is not valid JSON of that shape. */
  read(): LWProcess.Definition | undefined;
  /** Writes a new draft text with a history label. */
  write(text: string, label: string): void;
  /** Shows a sentence in the editor's message line; `append` adds it after the current message (the Undo button). */
  message(text: string, append?: boolean): void;
 }
 interface Surface {
  /** Re-reads the draft's steps for "After"; keeps the chosen values. */
  refresh(): void;
  setDisabled(disabled: boolean): void;
  dispose(): void;
 }
 interface Api {create(host: HTMLElement, env: Env): Surface}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessStructure: LWProcessStructure.Api; LWProcessLayout: LWProcessLayout.Api; LWProcessDialog: LWProcessDialog.Api;
  LWProcessDefinitionStructure?: LWProcessDefinitionStructure.Api};
 const esc = (v: unknown) => root.LWProcessDialog.escape(v);
 function create(host: HTMLElement, env: LWProcessDefinitionStructure.Env): LWProcessDefinitionStructure.Surface {
  const S = root.LWProcessStructure;
  const kinds = S.KINDS.map(([k, label]) => `<option value="${k}">${esc(label)}</option>`).join('');
  host.insertAdjacentHTML('beforeend', `<section class="de-sec de-structure" aria-labelledby="de-structure-h">
   <h4 id="de-structure-h" tabindex="-1">Steps</h4>
   <p class="de-help">Add a step, or tidy the map so the main route reads left to right. Both change the draft only; Ctrl+Z (Cmd+Z on a Mac) undoes them.</p>
   <fieldset class="de-form" id="de-structure-form" aria-labelledby="de-structure-h"><div class="de-grid">
    <div class="de-field"><label for="de-add-kind">Kind of step</label><select id="de-add-kind">${kinds}</select></div>
    <div class="de-field"><label for="de-add-name">Name</label><input type="text" id="de-add-name" maxlength="120" placeholder="New task"></div>
    <div class="de-field"><label for="de-add-after">After</label><select id="de-add-after"></select></div></div>
    <label class="de-radio"><input type="checkbox" id="de-add-insert" checked> Insert it into that step’s path when the step has exactly one</label>
    <div class="de-actions"><button type="button" class="de-add" id="de-add-step">Add step</button>
     <button type="button" class="de-add" id="de-tidy" aria-describedby="de-tidy-help">Tidy layout</button></div>
    <p class="de-help" id="de-tidy-help">Tidy layout places every step on the map by the order of the paths; the step list and the paths stay as they are.</p>
   </fieldset></section>`);
  const q = <T extends HTMLElement>(id: string) => host.querySelector<T>('#' + id)!;
  const kind = q<HTMLSelectElement>('de-add-kind'), name = q<HTMLInputElement>('de-add-name'), after = q<HTMLSelectElement>('de-add-after');
  function refresh(): void {
   const steps = env.read()?.steps ?? [], chosen = after.value || steps.at(-1)?.id || '';
   const html = steps.map(s => `<option value="${esc(s.id)}"${s.id === chosen ? ' selected' : ''}>${esc(s.name)}</option>`).join('');
   if (after.dataset.html !== html) {
    after.dataset.html = html;
    after.innerHTML = html;
   }
  }
  function add(): void {
   const def = env.read();
   if (!def) return;
   const result = S.add(def, {kind: kind.value as LWProcessStructure.AddKind, name: name.value, after: after.value || undefined,
    insert: q<HTMLInputElement>('de-add-insert').checked});
   if (!result.ok) {
    env.message(`Not added. ${result.reason}`);
    return;
   }
   name.value = '';
   env.write(JSON.stringify(result.definition, null, 2), result.label);
   env.message(result.notes.join(' '), true);
  }
  function tidy(): void {
   const def = env.read();
   if (!def) return;
   const result = root.LWProcessLayout.tidy(def);
   if (!result.moved) {
    env.message('The layout is already tidy: no step moved.');
    return;
   }
   env.write(JSON.stringify(result.definition, null, 2), 'Tidied the layout');
   env.message(`${result.moved} ${result.moved === 1 ? 'step' : 'steps'} moved.`, true);
  }
  kind.addEventListener('change', () => { name.placeholder = 'New ' + (S.KINDS.find(([k]) => k === kind.value)?.[1] ?? 'step').toLowerCase(); });
  const click = (e: Event) => {
   const t = e.target as HTMLElement;
   if (t.closest('#de-add-step')) add();
   else if (t.closest('#de-tidy')) tidy();
  };
  host.addEventListener('click', click);
  refresh();
  return {
   refresh,
   setDisabled(disabled) { q<HTMLFieldSetElement>('de-structure-form').disabled = disabled; },
   dispose() { host.removeEventListener('click', click); },
  };
 }
 root.LWProcessDefinitionStructure = {create};
})(globalThis);
