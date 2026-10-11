/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-html.ts" />
/// <reference path="./process-draft.ts" />
/// <reference path="./process-dialog.ts" />
/// <reference path="./process-tuning.ts" />
/// <reference path="./process-definition-json.ts" />
/// <reference path="./process-definition-structure.ts" />
/**
 * Modal Definition editor, built on the shared LWProcessDialog (id 'de', size 'wide') and the shared draft store.
 * Two panes over ONE draft text: "Tune values" (LWProcessTuning: name, description, seed, resources, arrivals, followed by
 * LWProcessDefinitionStructure: Add step and Tidy layout) and "Raw JSON" (LWProcessDefinitionJson: textarea, line numbers, every
 * catalog diagnostic as a jump button). Both write the draft on every input, so closing the window can never lose text and there is
 * deliberately no dirty guard; Ctrl/Cmd+Z and Shift+Z (outside the JSON text, which keeps its own native undo) step through the
 * draft's in-memory history, and a removed row, an added step or a tidied layout offers Undo. Opening it pauses a running
 * simulation (a command, never a tick). Restore and Apply (past minute 0) ask in the footer first; with `env.exportReport` the
 * apply confirm also offers Export report first. Opened from the step editor with `back`, it shows "Back to <step>", which closes it
 * through the normal close path and calls `back.reopen()`. Applying still goes through the catalog and `env.apply`, which starts a
 * fresh paused run; this module never ticks, retains a session or touches storage.
 */
declare namespace LWProcessDefinitionEditor {
 interface Env {
  /** The shared unapplied draft (also used by the step editor and the toolbar chip). */
  draft: LWProcessDraft.Store;
  /** Name and revision of the running definition, for the subtitle. */
  active(): {name: string; revision: number};
  /** The run in progress: applying discards it. */
  run(): {minute: number; cases: number};
  /** Pauses a running simulation. */
  pause(): void;
  /** Validates and applies the text exactly like the Apply button; true when a fresh paused run started. */
  apply(text: string): boolean;
  /** Saves the draft text as a file, exactly as written. */
  download(text: string): void;
  /** Where focus goes after closing when the invoker is gone or hidden. */
  focusFor(): HTMLElement | null;
  /** Optional: exports the run report; the apply-over-run confirm then offers Export report first. */
  exportReport?(): void;
 }
 /**
  * Where focus lands: 'auto' (the JSON syntax error if there is one, else the first field), 'form', 'json', 'problems' (the first
  * diagnostic) or a form path such as 'seed'.
  */
 type Focus = 'auto' | 'form' | 'json' | 'problems' | {field: string};
 /** A way back to the dialog that handed off to this one: "Back to <name>" closes this editor, then calls `reopen`. */
 interface Back {name: string; reopen(): void}
 interface OpenOptions {invoker?: HTMLElement | null; focus?: Focus; back?: Back | undefined}
 interface Surface {
  /** False when another dialog is open. */
  open(options?: OpenOptions): boolean;
  isOpen(): boolean;
  close(): void;
  dispose(): void;
 }
 interface Api {
  create(host: HTMLElement, env: Env): Surface;
  /**
   * Closes `active` (through its own dirty guard) and calls `then` once it is really closed. If the user keeps editing
   * instead, `then` is never called. Used to hand over from one modal to the next without stacking.
   */
  handoff(active: LWProcessDialog.Surface | null, then: () => void): void;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessHtml: LWProcessHtml.Api;
  LWProcessDialog: LWProcessDialog.Api; LWProcessTuning: LWProcessTuning.Api; LWProcessDefinitionJson: LWProcessDefinitionJson.Api;
  LWProcessCatalog: LWProcess.Catalog; LWProcessJsonPath: LWProcessJsonPath.Api; LWProcessDefinitionStructure: LWProcessDefinitionStructure.Api;
  LWProcessDefinitionEditor?: LWProcessDefinitionEditor.Api};
 const {esc} = root.LWProcessHtml;
 const VALID = 'Valid definition. Applying starts a fresh paused run.', DEBOUNCE = 250;
 function create(host: HTMLElement, env: LWProcessDefinitionEditor.Env): LWProcessDefinitionEditor.Surface {
  const draft = env.draft, dialog = root.LWProcessDialog.create(host.ownerDocument.body, {
   id: 'de', size: 'wide', title: 'Definition editor', inertRoot: host, closeLabel: 'Close',
   actions: [{id: 'cancel', label: 'Close', cancel: true}, {id: 'validate', label: 'Validate'}, {id: 'export', label: 'Export draft'},
    {id: 'restore', label: 'Restore active definition'}, {id: 'apply', label: 'Apply draft and reset run', primary: true}],
   onAction: id => {
    if (id === 'validate') validateNow();
    else if (id === 'export') exportDraft();
    else if (id === 'restore') void restore();
    else if (id === 'apply') void apply();
   },
   onClose: () => {
    window.clearTimeout(timer);
    timer = 0;
   },
  });
  dialog.el.classList.add('de-dialog');
  dialog.body.insertAdjacentHTML('beforeend', `<p class="de-back" id="de-back-bar" hidden><button type="button" id="de-back-step"></button></p>
   <p class="de-message" id="de-message" role="status"></p>
   <div class="de-tabs" role="group" aria-label="Definition editor sections"><button type="button" id="de-tab-form" aria-pressed="true">Tune values</button>`
   + `<button type="button" id="de-tab-json" aria-pressed="false">Raw JSON</button></div>
   <div class="de-split" id="de-split" data-tab="form">
    <section class="de-pane de-form-pane" id="de-pane-form" aria-labelledby="de-form-h">`
   + `<div class="de-pane-head"><h3 id="de-form-h" tabindex="-1">Tune values</h3>`
   + `<span class="de-sync" id="de-sync" role="status">Form in sync</span></div>
     <p class="de-help">Process-level values. The draft updates as you type; applying starts a fresh paused run.</p><div id="tuning"></div></section>
    <section class="de-pane de-json-pane" id="de-pane-json" aria-labelledby="de-json-h"></section></div>`);
  const q = <T extends HTMLElement = HTMLElement>(id: string) => dialog.el.querySelector<T>('#' + id)!;
  const ask = (m: string, choices: LWProcessDialog.Choice[]) => dialog.confirm(m, choices, {escape: 'keep-pool'});
  const tuning = root.LWProcessTuning.create(q('tuning'), () => draft.read(), (text, label) => draft.write(text, 'tuning', label), ask);
  const json = root.LWProcessDefinitionJson.create(q('de-pane-json'), draft);
  const steps = root.LWProcessDefinitionStructure.create(q('de-pane-form'), {
   read: () => draft.parse(),
   write: (text, label) => draft.write(text, 'definition', label),
   message: (text, append) => {
    if (append && text) q('de-message').insertAdjacentText('beforeend', ' ' + text);
    else if (!append) message(text);
   },
  });
  let opener: HTMLElement | null = null, timer = 0, back: LWProcessDefinitionEditor.Back | undefined;
  const showTab = (tab: 'form' | 'json') => {
   q('de-split').dataset.tab = tab;
   q('de-tab-form').setAttribute('aria-pressed', String(tab === 'form'));
   q('de-tab-json').setAttribute('aria-pressed', String(tab === 'json'));
  };
  const message = (text: string) => {
   const m = q('de-message');
   if (m.textContent !== text || m.childElementCount) m.textContent = text;
  };
  /** A removal is announced with an Undo button beside it; the next draft change replaces the message. */
  const undoable = (label: string) => {
   const m = q('de-message');
   m.textContent = label + '. ';
   m.insertAdjacentHTML('beforeend', '<button type="button" class="de-link" id="de-undo">Undo</button>');
  };
  function history(redo: boolean): void {
   const done = redo ? draft.redo() : draft.undo();
   message(done ? (redo ? 'Redone. Ctrl+Z (Cmd+Z on a Mac) undoes it again.' : 'Undone. Ctrl+Shift+Z (Cmd+Shift+Z on a Mac) redoes it.')
    : redo ? 'Nothing to redo.' : 'Nothing to undo.');
  }
  const parsed = (): unknown => {
   try {
    return JSON.parse(draft.read());
   } catch {
    return undefined;
   }
  };
  /** The catalog's whole answer for the draft: syntax problem, or every diagnostic it returns, and which stage produced them. */
  function inspect(): {syntax: boolean; diagnostics: LWProcess.Diagnostic[]; stage: 'structure' | 'graph' | 'none'} {
   const value = parsed();
   if (value === undefined) return {syntax: true, diagnostics: [], stage: 'none'};
   let diagnostics: LWProcess.Diagnostic[];
   try {
    diagnostics = root.LWProcessCatalog.validate(value, true).diagnostics;
   } catch (e) {
    diagnostics = [{path: '/', code: 'data', message: String(e)}];
   }
   const stage = !diagnostics.length ? 'none' : diagnostics.some(d => ['shape', 'data', 'asset'].includes(d.code)) ? 'structure' : 'graph';
   return {syntax: false, diagnostics, stage};
  }
  function footer(): void {
   const same = !draft.changed(), nothing = draft.same();
   dialog.setActionState('restore', {disabled: same, reason: same ? 'Restore is unavailable while the draft matches the running definition.' : ''});
   // Applying an identical definition would only reset the run and bump the revision; Reset run does the first honestly.
   const why = 'Nothing to apply: the draft holds the running definition. Use Reset run to restart the run.';
   dialog.setActionState('apply', {disabled: nothing, reason: nothing ? why : ''});
  }
  const subtitle = () => {
   const a = env.active();
   return `${a.name} · revision ${a.revision} · The run is paused while this window is open`;
  };
  const header = () => dialog.setTitle('Definition editor', subtitle(), draft.changed() ? 'Unapplied draft' : '');
  /** Re-reads everything derived from the draft: diagnostics, the form and its sync state. `own` is true when the form wrote the change itself. */
  function recompute(own: boolean): void {
   timer = 0;
   const result = inspect(), form = result.syntax ? false : own ? true : tuning.refresh();
   if (result.syntax || !form) tuning.setDisabled(true, 'Fix the JSON to use the form');
   else tuning.setDisabled(false);
   steps.setDisabled(result.syntax || !form);
   steps.refresh();
   if (!result.syntax && form) tuning.setDiagnostics(result.diagnostics);
   json.setDiagnostics(result.diagnostics, result.stage);
   const sync = q('de-sync'), text = result.syntax || !form ? 'Fix the JSON to use the form' : 'Form in sync';
   if (sync.textContent !== text) sync.textContent = text;
   sync.classList.toggle('bad', text !== 'Form in sync');
  }
  const unsubscribe = draft.subscribe(e => {
   const area = json.textarea;
   if (!dialog.isOpen()) {
    if (e.source !== 'raw' && area.value !== e.text) area.value = e.text;
    return;
   }
   message('');
   dialog.setStatus('');
   header();
   footer();
   json.render(e.source);
   if (e.label) undoable(e.label);
   window.clearTimeout(timer);
   if (e.source === 'raw') {
    q('de-sync').textContent = 'Updating form…';
    timer = window.setTimeout(() => recompute(false), DEBOUNCE);
   } else recompute(e.source === 'tuning');
  });
  function exportDraft(): void {
   env.download(draft.read());
   message('Draft downloaded as written. Apply a valid draft to update the simulation.');
  }
  function validateNow(): void {
   window.clearTimeout(timer);
   recompute(false);
   const result = inspect(), bad = json.syntax();
   if (bad) {
    message(`Invalid JSON: line ${bad.line}, column ${bad.column}. Fix it, then validate again.`);
    showTab('json');
    json.jumpToSyntax();
    return;
   }
   if (!result.diagnostics.length) {
    message(VALID);
    return;
   }
   message(`${result.diagnostics.length} ${result.diagnostics.length === 1 ? 'problem' : 'problems'} found. They are listed under Raw JSON.`);
   showTab('json');
   q('de-diag-h').focus();
  }
  async function restore(): Promise<void> {
   if (!draft.changed()) return;
   const choices = [{id: 'download-first', label: 'Download draft first'}, {id: 'restore-confirm', label: 'Restore'},
    {id: 'keep', label: 'Keep draft', default: true}];
   const choice = await dialog.confirm('Replace the draft with the running definition?', choices, {escape: 'keep'});
   if (!dialog.isOpen()) return;
   if (choice === 'download-first') {
    exportDraft();
    message('Draft downloaded. Choose Restore active definition again if you still want to replace it.');
   } else if (choice === 'restore-confirm') {
    draft.restore('definition');
    message('Draft restored from the running definition.');
   }
  }
  function refuse(syntax: boolean, list: LWProcess.Diagnostic[]): void {
   showTab('json');
   const value = parsed(), bad = json.syntax();
   const items = syntax && bad ? `<li>Invalid JSON: line ${bad.line}, column ${bad.column} · ${esc(bad.message)}</li>`
    : list.map(d => `<li><a href="#" data-path="${esc(d.path)}">${esc(root.LWProcessJsonPath.label(value, d.path))}</a>: ${esc(d.message)}</li>`).join('');
   const these = syntax || list.length === 1 ? 'this problem' : 'these problems';
   dialog.setStatus(`<p><strong>The draft cannot be applied yet.</strong> Fix ${these} and try again.</p><ul>${items}</ul>`, 'alert');
   if (syntax) json.jumpToSyntax();
  }
  async function apply(): Promise<void> {
   let result = inspect();
   if (result.syntax || result.diagnostics.length) {
    refuse(result.syntax, result.diagnostics);
    return;
   }
   const run = env.run();
   if (run.minute > 0) {
    if (!(await root.LWProcessDialog.confirmApplyOverRun(dialog, run, env.exportReport))) return;
    result = inspect();
    if (result.syntax || result.diagnostics.length) {
     refuse(result.syntax, result.diagnostics);
     return;
    }
   }
   dialog.setStatus('');
   if (env.apply(draft.read())) dialog.close('action');
   else dialog.setStatus('<p><strong>The definition could not be applied.</strong> See the status message on the page.</p>', 'alert');
  }
  /** "Back to <step>": closes through the normal close path, then the step editor reopens on that step. */
  function goBack(): void {
   const target = back;
   if (!target) return;
   dialog.requestClose('close');
   if (!dialog.isOpen()) target.reopen();
  }
  dialog.el.addEventListener('click', e => {
   const t = e.target as HTMLElement, link = t.closest<HTMLAnchorElement>('a[data-path]');
   if (link) {
    e.preventDefault();
    json.jump(link.dataset.path!);
    return;
   }
   if (t.closest('#de-back-step')) goBack();
   else if (t.closest('#de-undo')) {
    history(false);
    q('de-form-h').focus();
   } else if (t.closest('#de-tab-form')) showTab('form');
   else if (t.closest('#de-tab-json')) showTab('json');
   else if (t.closest('[data-act="show-json"]')) {
    showTab('json');
    q('de-diag-h').focus();
    q('de-diag-h').scrollIntoView({block: 'nearest'});
   }
  });
  // Undo and redo for the whole draft. The JSON textarea keeps the browser's own text undo, so the shortcut is left alone there.
  dialog.el.addEventListener('keydown', e => {
   if (!(e.ctrlKey || e.metaKey) || e.altKey || e.target === json.textarea) return;
   const key = e.key.toLowerCase();
   if (key !== 'z' && key !== 'y') return;
   e.preventDefault();
   history(key === 'y' || e.shiftKey);
  });
  function focusPane(focus: LWProcessDefinitionEditor.Focus): void {
   const bad = json.syntax(), problems = bad ? [] : inspect().diagnostics, first = problems[0];
   if (typeof focus === 'object') {
    showTab('form');
    tuning.focusField(focus.field);
    return;
   }
   if (focus === 'form' || focus === 'auto' && !bad) {
    showTab('form');
    tuning.focusField();
    return;
   }
   showTab('json');
   if (bad) json.jumpToSyntax();
   else if (focus === 'problems' && first && json.jump(first.path)) return;
   else json.focus();
  }
  return {
   open(options = {}) {
    if (dialog.isOpen() || root.LWProcessDialog.active()) return false;
    opener = options.invoker ?? null;
    back = options.back;
    q('de-back-bar').hidden = !back;
    q('de-back-step').textContent = back ? `Back to ${back.name}` : '';
    env.pause();
    message('');
    dialog.setStatus('');
    header();
    footer();
    json.render();
    recompute(false);
    const chip = draft.changed() ? 'Unapplied draft' : '';
    if (!dialog.open({title: 'Definition editor', subtitle: subtitle(), chip, invoker: opener, focusFallback: env.focusFor})) return false;
    showTab('form');
    focusPane(options.focus ?? 'auto');
    return true;
   },
   isOpen: () => dialog.isOpen(),
   close: () => dialog.close('programmatic'),
   dispose() {
    window.clearTimeout(timer);
    unsubscribe();
    tuning.dispose();
    json.dispose();
    steps.dispose();
    dialog.dispose();
   },
  };
 }
 function handoff(active: LWProcessDialog.Surface | null, then: () => void): void {
  if (!active || !active.isOpen()) {
   then();
   return;
  }
  active.requestClose('programmatic');
  if (!active.isOpen()) {
   then();
   return;
  }
  // A dirty dialog is asking "Keep editing / Discard changes". Continue only if it really closes; the confirm hiding while the dialog stays open means "keep".
  const box = active.el.querySelector<HTMLElement>('[role="alertdialog"]');
  if (!box) return;
  const watch = new MutationObserver(() => {
   if (!box.hidden) return;
   window.setTimeout(() => {
    watch.disconnect();
    if (!active.isOpen()) then();
   }, 0);
  });
  watch.observe(box, {attributes: true, attributeFilter: ['hidden']});
 }
 root.LWProcessDefinitionEditor = {create, handoff};
})(globalThis);
