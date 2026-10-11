/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-html.ts" />
/// <reference path="./process-step-model.ts" />
/// <reference path="./process-step-checks.ts" />
/// <reference path="./process-step-history.ts" />
/// <reference path="./process-draft.ts" />
/// <reference path="./process-dialog.ts" />
/// <reference path="./process-step-sections.ts" />
/// <reference path="./process-step-logic.ts" />
/// <reference path="./process-step-flows.ts" />
/// <reference path="./process-step-structure.ts" />
/// <reference path="./process-step-rows.ts" />
/// <reference path="./process-step-problems.ts" />
/**
 * Modal editor for one process step, built on the shared LWProcessDialog (id 'se', size 'form') and the shared draft store.
 * It edits a detached form model of the draft text, validates it live through the catalog and writes finished text back to
 * the draft; it never ticks or retains a session. Task, touchpoint, machine and system steps share the work sections; machine
 * and system steps add Automation (technology) and demand only pools of their own kind, a touchpoint adds Journey (phase,
 * channel, feeling, pain point, opportunity) and may use pools of any kind, every other kind has collapsed Journey notes and an
 * end step an Outcome. Random timing (work steps and duration timers), random outcomes (draws) and chance routes are ordinary
 * model fields validated live by the same catalog. Outgoing paths are added, removed and pointed at other steps through
 * LWProcessStepFlows; the catalog alone judges the result. Previous step and Next step move through the draft's steps in order
 * behind the same dirty guard (Keep editing first, then Save to draft and go, or Discard changes).
 *
 * Step structure (LWProcessStepStructure): add a step after this one, duplicate, change the kind or delete the step; each writes
 * the draft with a label the Definition editor can undo. Undo (LWProcessStepHistory): form edits have an in-dialog, in-memory
 * history while the dialog shows one step: Ctrl+Z (Cmd+Z) undoes and Ctrl+Shift+Z, Cmd+Shift+Z or Ctrl+Y redoes when focus is not
 * in a text field (text fields keep the browser's own text undo); a removed row offers "Removed … Undo" in the footer note.
 * Handing off to the Definition editor passes a `back` target so it can offer "Back to <step>"; with `env.exportReport` the
 * apply-over-run confirm offers Export report first.
 */
declare namespace LWProcessStepEditor {
 /** Where the Definition editor's "Back to <step>" returns to. */
 interface Back {name: string; reopen(): void}
 interface Env {
  /** The shared unapplied draft (the single source of truth also used by the Definition editor). */
  draft: LWProcessDraft.Store;
  /** The run in progress: applying discards it. */
  run(): {minute: number; cases: number};
  /** Validates and applies the text exactly like the Apply draft button; true when a fresh run started. */
  apply(text: string): boolean;
  notify(message: string, error?: boolean): void;
  /** Where focus goes after closing when the invoker is gone or hidden (normally the step list item). */
  focusFor(stepId: string): HTMLElement | null;
  /** Optional: opens the Definition editor, which offers "Back to <step>" through `back`. When absent the dialog only names it. */
  openDefinition?(back?: Back): void;
  /** Optional: exports the run report; the apply-over-run confirm then offers Export report first. */
  exportReport?(): void;
 }
 interface Surface {open(stepId: string, invoker?: HTMLElement | null): boolean; isOpen(): boolean; dispose(): void}
 interface Api {create(host: HTMLElement, env: Env): Surface}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessHtml: LWProcessHtml.Api;
  LWProcessStepModel: LWProcessStepModel.Api; LWProcessStepChecks: LWProcessStepChecks.Api; LWProcessCatalog: LWProcess.Catalog;
  LWProcessDraft: LWProcessDraft.Api; LWProcessDialog: LWProcessDialog.Api; LWProcessStepSections: LWProcessStepSections.Api;
  LWProcessStepLogic: LWProcessStepLogic.Api; LWProcessStepFlows: LWProcessStepFlows.Api; LWProcessStepHistory: LWProcessStepHistory.Api;
  LWProcessStepStructure: LWProcessStepStructure.Api; LWProcessStepRows: LWProcessStepRows.Api; LWProcessStepProblems: LWProcessStepProblems.Api;
  LWProcessStepEditor?: LWProcessStepEditor.Api};
 type M = LWProcessStepModel.Model;
 const {esc} = root.LWProcessHtml;
 const setPath = (target: unknown, path: string, value: unknown) => {
  const keys = path.split('.');
  let at = target as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) at = at[key] as Record<string, unknown>;
  at[keys.at(-1)!] = value;
 };
 const NOTHING = 'Nothing to apply: this step and the draft hold the running definition. Use Reset run to restart the run.';
 const SUBTITLE = 'The run is paused while this window is open and nothing ticks. Edits go to the draft; the run only restarts when you apply.';
 /** Text fields keep the browser's own undo; everywhere else in the dialog Ctrl/Cmd+Z steps through the form history. */
 const textField = (n: EventTarget | null) => n instanceof HTMLTextAreaElement
  || n instanceof HTMLInputElement && ['text', 'number', 'search'].includes(n.type);
 function create(host: HTMLElement, env: LWProcessStepEditor.Env): LWProcessStepEditor.Surface {
  const api = root.LWProcessStepModel, checks = root.LWProcessStepChecks, sections = root.LWProcessStepSections, logic = root.LWProcessStepLogic;
  const draft = env.draft, flows = root.LWProcessStepFlows, history = root.LWProcessStepHistory.create();
  let model: M, base: LWProcess.Definition, initial = '', stepId = '', shown = '', notesOpen = false, addTo = '', invokedBy: HTMLElement | null = null;
  const dirty = () => JSON.stringify(model) !== initial;
  const dialog = root.LWProcessDialog.create(host.ownerDocument.body, {
   id: 'se', size: 'form', title: '', inertRoot: host, isDirty: dirty, discardMessage: () => `Discard your changes to ${model.name || stepId}?`,
   actions: [{id: 'cancel', label: 'Cancel', cancel: true}, {id: 'save', label: 'Save to draft'}, {id: 'apply', label: 'Apply and reset run', primary: true}],
   onAction: id => {
    if (id === 'save') save();
    else if (id === 'apply') void apply();
   },
   onClose: () => history.reset(),
  });
  dialog.el.classList.add('se-dialog');
  dialog.body.insertAdjacentHTML('beforeend', '<nav class="se-stepnav" id="se-stepnav" aria-label="Other steps"></nav>'
   + '<div id="se-apply-errors" class="se-apply-errors" tabindex="-1" role="alert" hidden></div><div id="se-sections"></div><div id="se-structure"></div>');
  const q = <T extends HTMLElement = HTMLElement>(id: string) => dialog.el.querySelector<T>('#' + id)!;
  const candidate = () => api.write(base, stepId, model);
  const text = () => JSON.stringify(candidate(), null, 2);
  const structure = root.LWProcessStepStructure.create({
   dialog, draft, model: () => model, dirty, writable: () => !checks.problems(model).length,
   save: () => { draft.write(text(), 'step-editor'); },
   load: id => {
    if (!load(id)) return false;
    dialog.setTitle(model.name, SUBTITLE, model.kind, model.id);
    return true;
   },
   closed: message => {
    dialog.close('action');
    env.notify(message);
   },
   refresh: focus => {
    q('se-structure').innerHTML = structure.render();
    if (focus) dialog.el.querySelector<HTMLElement>(focus)?.focus();
   },
  });
  const problems = root.LWProcessStepProblems.create({body: dialog.body, model: () => model, stepId: () => stepId, candidate});
  /** Live sentences that follow typing: the needs summary, the timing note, the technology counter, the path summary. */
  function liveText(): void {
   const sum = dialog.el.querySelector('#se-needs-summary'), count = dialog.el.querySelector('#se-technology-count');
   const note = dialog.el.querySelector('#se-timing-note'), paths = dialog.el.querySelector<HTMLElement>('#se-path-summary');
   if (sum) sum.textContent = api.needsSummary(model);
   if (note) note.textContent = api.timingNote(model);
   if (count) count.textContent = `${model.technology.length} / 80 characters`;
   for (const [id, line] of Object.entries(sections.notes(model))) {
    const n = dialog.el.querySelector(`#${id}`);
    if (n && n.textContent !== line) n.textContent = line;
   }
   if (!paths) return;
   const next = sections.pathSummary(model);
   if (paths.dataset.html !== next) {
    paths.dataset.html = next;
    paths.innerHTML = next;
   }
  }
  function update(): void {
   const found = problems.check(), {items, text} = found;
   problems.place(items);
   dialog.setStatus(problems.status(found, !!env.openDefinition));
   const local = items.some(i => i.local), changed = dirty(), why = 'Fix the highlighted fields before saving or applying.';
   const unchanged = 'Save to draft is unavailable until you change something.';
   dialog.setActionState('save', {disabled: local || !changed, reason: local ? why : !changed ? unchanged : ''});
   // Apply needs a step without problems and a candidate that differs from the running definition (applying the same text only resets the run).
   const stop = local ? why : items.length ? 'Fix the problems in this step before applying.' : draft.same(text) ? NOTHING : '';
   dialog.setActionState('apply', {disabled: !!stop, reason: stop});
   liveText();
  }
  function render(focus?: string): void {
   const active = document.activeElement as HTMLElement | null;
   const radio = active instanceof HTMLInputElement && active.type === 'radio' ? `[value="${active.value}"]` : '';
   // Focus survives a re-render: a bound control by its binding, any other control (a row button) by its id.
   const inside = active && dialog.el.contains(active) ? active : null;
   const keep = focus ?? (inside?.dataset.bind ? `[data-bind="${inside.dataset.bind}"]${radio}` : inside?.id ? '#' + CSS.escape(inside.id) : '');
   const html = sections.render(model, {notesOpen, addTo});
   dialog.preserveScroll(() => {
    if (html !== shown) {
     shown = html;
     q('se-sections').innerHTML = html;
    }
    update();
   });
   if (keep) dialog.el.querySelector<HTMLElement>(keep)?.focus({preventScroll: false});
  }
  function save(): void {
   draft.write(text(), 'step-editor');
   dialog.close('action');
   env.notify('Saved to the draft. Apply the draft to start a fresh run.');
  }
  /** Lists why Apply was refused with the same plain, keyed items as the status: problems in this step link to their fields. */
  function refuse(result: LWProcess.Validation): void {
   const out = q('se-apply-errors');
   out.hidden = false;
   out.innerHTML = problems.refusal(problems.check(), result.diagnostics);
   out.focus();
  }
  /**
   * Opens the Definition editor with a way back to this step. Unsaved edits without local problems may be saved to the draft first;
   * Keep editing stays the default. With local problems the edits cannot be written faithfully, so the shared dirty guard offers
   * only Keep editing or Discard.
   */
  async function handoff(): Promise<void> {
   if (!env.openDefinition) return;
   const id = stepId, invoker = invokedBy;
   const back = (): LWProcessStepEditor.Back => ({name: model.name || id, reopen: () => { surface.open(id, invoker); }});
   if (!dirty() || checks.problems(model).length) {
    env.openDefinition(back());
    return;
   }
   const choice = await dialog.confirm(`Open the Definition editor? Your changes to ${model.name || stepId} are not in the draft yet.`,
    [{id: 'keep', label: 'Keep editing', default: true}, {id: 'save-open', label: 'Save to draft and open'}, {id: 'discard', label: 'Discard changes'}]);
   if (!dialog.isOpen()) return;
   const target = back();
   if (choice === 'save-open') {
    save();
    env.openDefinition(target);
   } else if (choice === 'discard') {
    dialog.close('discard');
    env.openDefinition({...target, name: draft.parse()?.steps.find(s => s.id === id)?.name ?? id});
   }
  }
  /** Loads step `id` of the draft into the form; false (with a notice) when the draft cannot be read or has no such step. */
  function load(id: string): boolean {
   const parsed = draft.parse();
   if (!parsed) {
    env.notify('The draft is not valid process JSON, so this step cannot be edited yet. '
     + 'Open the Definition editor and fix the JSON or restore the active definition, then choose Edit step again.', true);
    return false;
   }
   const read = api.read(parsed, id);
   if (!read) {
    env.notify('That step is not in the draft. Restore the active definition or choose another step.', true);
    return false;
   }
   base = parsed;
   model = read;
   initial = JSON.stringify(read);
   stepId = id;
   shown = '';
   notesOpen = false;
   addTo = '';
   history.reset();
   structure.reset();
   const others = draft.diff({ignoreStep: id}), total = others.steps + others.flows + others.resources + others.arrivals + others.meta;
   const banner = esc(root.LWProcessDraft.describe(others, 'The draft also has unapplied changes outside this step')) + '. Apply and reset run includes them.';
   dialog.setBanner(total ? banner : null, 'warn');
   dialog.setNote('');
   q('se-apply-errors').hidden = true;
   navigation();
   render();
   q('se-structure').innerHTML = structure.render();
   return true;
  }
  /** Previous step and Next step in draft order; at either end the button is disabled and says why. */
  function navigation(): void {
   const at = model.others.findIndex(o => o.id === stepId);
   const button = (act: 'step-prev' | 'step-next', word: string, to: {name: string} | undefined, why: string) => to
    ? `<button type="button" id="se-${act}" data-act="${act}">${word} step: ${esc(to.name)}</button>`
    : `<button type="button" id="se-${act}" data-act="${act}" disabled aria-describedby="se-${act}-why">${word} step</button>`
     + `<span class="se-help" id="se-${act}-why">${why}</span>`;
   q('se-stepnav').innerHTML = button('step-prev', 'Previous', model.others[at - 1], 'This is the first step.')
    + button('step-next', 'Next', model.others[at + 1], 'This is the last step.');
  }
  /** Moves to the step before or after this one, asking first when this step has edits that are not in the draft. */
  async function go(by: -1 | 1): Promise<void> {
   const at = model.others.findIndex(o => o.id === stepId), to = model.others[at + by];
   if (!to) return;
   if (dirty()) {
    const saveGo = checks.problems(model).length ? [] : [{id: 'save-go', label: 'Save to draft and go'}];
    const choices = [{id: 'keep', label: 'Keep editing', default: true}, ...saveGo, {id: 'discard', label: 'Discard changes'}];
    const choice = await dialog.confirm(`Go to ${to.name}? Your changes to ${model.name || stepId} are not in the draft yet.`, choices);
    if (!dialog.isOpen() || choice === 'keep') return;
    if (choice === 'save-go') {
     draft.write(text(), 'step-editor');
     env.notify('Saved to the draft. Apply the draft to start a fresh run.');
    }
   }
   if (!load(to.id)) return;
   dialog.setTitle(model.name, SUBTITLE, model.kind, model.id);
   const same = q<HTMLButtonElement>(by < 0 ? 'se-step-prev' : 'se-step-next');
   (same.disabled ? q(by < 0 ? 'se-step-next' : 'se-step-prev') : same).focus();
  }
  async function apply(): Promise<void> {
   let result = root.LWProcessCatalog.validate(candidate());
   if (!result.ok) {
    refuse(result);
    return;
   }
   const run = env.run();
   if (run.minute > 0) {
    if (!(await root.LWProcessDialog.confirmApplyOverRun(dialog, run, env.exportReport))) return;
    result = root.LWProcessCatalog.validate(candidate());
    if (!result.ok) {
     refuse(result);
     return;
    }
   }
   const out = q('se-apply-errors');
   out.hidden = true;
   if (env.apply(text())) dialog.close('action');
   else {
    out.hidden = false;
    out.textContent = 'The definition could not be applied. See the status message.';
    out.focus();
   }
  }
  /** Steps through the form history. A removal restores its row and focuses it; the footer note says what happened. */
  function travel(redo: boolean): void {
   const now = JSON.stringify(model), entry = redo ? history.redo(now) : history.undo(now);
   if (!entry) {
    dialog.setNote(redo ? 'Nothing to redo.' : 'Nothing to undo.');
    return;
   }
   model = JSON.parse(entry.snapshot) as M;
   const what = entry.label ? ` ${entry.label}.` : '';
   // Typing changes the controls without re-rendering, so the last rendered markup may equal the restored one: render it anew.
   shown = '';
   render();
   // Undoing a removal shows the row again and moves focus to it; otherwise focus stays, or returns to the name if its control went away.
   const restored = !redo && entry.focus ? dialog.el.querySelector<HTMLElement>(entry.focus) : null;
   if (restored) restored.focus();
   else if (!dialog.el.contains(document.activeElement)) q('se-title').focus();
   dialog.setNote(esc(redo ? `Redone.${what} Ctrl+Z (Cmd+Z on a Mac) undoes it again.` : `Undone.${what} Ctrl+Shift+Z (Cmd+Shift+Z on a Mac) redoes it.`));
   q('se-apply-errors').hidden = true;
  }
  /** Row and path buttons: each change is one undo step, and a removal offers Undo in the footer note. */
  function act(button: HTMLButtonElement): void {
   const what = button.dataset.act!;
   if (structure.act(button)) return;
   if (what === 'open-definition') {
    void handoff();
    return;
   }
   if (what === 'step-prev' || what === 'step-next') {
    void go(what === 'step-prev' ? -1 : 1);
    return;
   }
   const find = (selector: string) => dialog.el.querySelector<HTMLButtonElement>(selector);
   const before = JSON.stringify(model), done = root.LWProcessStepRows.run(model, button, {addTo, find, idOf: sections.idOf});
   if (!done) return;
   render(done.focus);
   if (JSON.stringify(model) === before) return;
   history.record(before, '', done.removed ?? '', done.restore ?? '');
   dialog.setNote(done.removed ? `${esc(done.removed)}. <button type="button" class="se-link" id="se-undo" data-act="undo">Undo</button>` : '');
  }
  dialog.el.addEventListener('click', e => {
   const t = e.target as HTMLElement, goto = t.closest<HTMLAnchorElement>('a[data-goto]');
   if (goto) {
    e.preventDefault();
    const target = document.getElementById(goto.dataset.goto!);
    target?.scrollIntoView({block: 'center'});
    target?.focus();
    return;
   }
   const b = t.closest<HTMLButtonElement>('button[data-act]');
   if (b && !b.disabled && b.dataset.act === 'undo') travel(false);
   else if (b && !b.disabled) act(b);
  });
  /** Applies one form input; the undo history records the model before it (typing in one field within a second is one step). */
  const edit = (e: Event) => {
   const t = e.target as HTMLInputElement;
   if (t.dataset?.ui === 'add-to') {
    addTo = t.value;
    return;
   }
   if (t.dataset?.ui && structure.input(t)) return;
   if (!t.dataset?.bind) return;
   const structural = t.dataset.rerender !== undefined;
   if (structural && e.type === 'input') return;
   const bind = t.dataset.bind, before = JSON.stringify(model), dist = /^(timing|deadline\.timing)\.dist$/.exec(bind);
   const mode = /^(flows\.\d+\.cond(?:\.items\.\d+)*)\.mode$/.exec(bind);
   const timing = dist ? logic.timingAt(model, dist[1]!) : undefined, previous = timing?.dist, cond = mode ? logic.condAt(model, mode[1]!) : undefined;
   const was = cond?.mode;
   setPath(model, bind, t.type === 'checkbox' ? t.checked : t.value);
   const kind = /^draws\.(\d+)\.kind$/.exec(bind), to = /^flows\.(\d+)\.to$/.exec(bind);
   if (dist && timing) {
    const value = t.value as LWProcessStepModel.DistKind;
    if (dist[1] === 'timing') api.chooseTiming(model, value, previous);
    else logic.chooseDist(timing, Math.max(1, Math.round((logic.whole(model.duration) ?? 2) / 2)), value, previous);
   } else if (kind) api.chooseDraw(model.draws[Number(kind[1])]!, t.value as LWProcess.Draw['kind']);
   else if (to) flows.retarget(model, Number(to[1]), t.value);
   else if (cond && was) logic.chooseCondMode(cond, was);
   else if (bind === 'deadline.kind') logic.chooseDeadline(model);
   if (JSON.stringify(model) !== before) {
    history.record(before, textField(t) ? bind : '');
    dialog.setNote('');
   }
   if (structural) render();
   else update();
   q('se-apply-errors').hidden = true;
  };
  dialog.el.addEventListener('input', edit);
  dialog.el.addEventListener('change', edit);
  dialog.el.addEventListener('toggle', e => {
   const t = e.target as HTMLDetailsElement;
   if (t.id === 'se-notes') notesOpen = t.open;
  }, true);
  // Undo and redo of the form, mirroring the Definition editor: text fields and an open footer confirm keep their own behaviour.
  dialog.el.addEventListener('keydown', e => {
   if (!(e.ctrlKey || e.metaKey) || e.altKey || textField(e.target) || !q('se-confirm').hidden) return;
   const key = e.key.toLowerCase();
   if (key !== 'z' && key !== 'y') return;
   e.preventDefault();
   travel(key === 'y' || e.shiftKey);
  });
  const surface: LWProcessStepEditor.Surface = {
   open(id, invoker) {
    if (dialog.isOpen() || !load(id)) return false;
    invokedBy = invoker ?? null;
    const focusFallback = () => env.focusFor(stepId);
    return dialog.open({title: model.name, subtitle: SUBTITLE, chip: model.kind, meta: model.id, invoker: invoker ?? null, focusFallback});
   },
   isOpen: () => dialog.isOpen(),
   dispose() { dialog.dispose(); },
  };
  return surface;
 }
 root.LWProcessStepEditor = {create};
})(globalThis);
