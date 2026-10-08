/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-step-model.ts" />
/// <reference path="./process-draft.ts" />
/// <reference path="./process-dialog.ts" />
/// <reference path="./process-step-sections.ts" />
/**
 * Modal editor for one process step, built on the shared LWProcessDialog (id 'se', size 'form') and the shared draft store.
 * It edits a detached form model of the draft text, validates it live through the catalog and writes finished text back to
 * the draft; it never ticks or retains a session. Task, machine and system steps share the work sections; machine and system
 * steps add Automation (technology) and demand only pools of their own kind. Random timing (work steps and duration timers), random
 * outcomes (draws) and chance routes are ordinary model fields validated live by the same catalog.
 */
declare namespace LWProcessStepEditor {
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
  /** Optional: opens the Definition editor. When absent the dialog only names it. */
  openDefinition?(): void;
 }
 interface Surface {open(stepId: string, invoker?: HTMLElement | null): boolean; isOpen(): boolean; dispose(): void}
 interface Api {create(host: HTMLElement, env: Env): Surface}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessStepModel: LWProcessStepModel.Api; LWProcessCatalog: LWProcess.Catalog; LWProcessDraft: LWProcessDraft.Api; LWProcessDialog: LWProcessDialog.Api; LWProcessStepSections: LWProcessStepSections.Api; LWProcessStepEditor?: LWProcessStepEditor.Api};
 type M = LWProcessStepModel.Model;
 const esc = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
 const setPath = (target: unknown, path: string, value: unknown) => { const keys = path.split('.'); let at = target as Record<string, unknown>; for (const key of keys.slice(0, -1)) at = at[key] as Record<string, unknown>; at[keys.at(-1)!] = value; };
 const LABELS: [RegExp, (n: number) => string][] = [[/^set\.(\d+)/, n => `Value ${n}`], [/^add\.(\d+)/, n => `Counter ${n}`], [/^outputs\.(\d+)/, n => `Output ${n}`], [/^needs\.(\d+)/, n => `Need ${n}`], [/^flows\.(\d+)/, n => `Path ${n}`], [/^draws\.(\d+)/, n => `Random field ${n}`], [/^pools\.(\d+)/, () => '']];
 const overlap = (a: string, b: string) => a === b || a.startsWith(b + '.') || b.startsWith(a + '.');
 interface Item extends LWProcessStepModel.Scoped {local: boolean}
 function create(host: HTMLElement, env: LWProcessStepEditor.Env): LWProcessStepEditor.Surface {
  const api = root.LWProcessStepModel, sections = root.LWProcessStepSections, draft = env.draft;
  let model: M, base: LWProcess.Definition, initial = '', stepId = '', shown = '';
  const dialog = root.LWProcessDialog.create(host.ownerDocument.body, {
   id: 'se', size: 'form', title: '', inertRoot: host, isDirty: () => JSON.stringify(model) !== initial, discardMessage: () => `Discard your changes to ${model.name || stepId}?`,
   actions: [{id: 'cancel', label: 'Cancel', cancel: true}, {id: 'save', label: 'Save to draft'}, {id: 'apply', label: 'Apply and reset run', primary: true}],
   onAction: id => { if (id === 'save') save(); else if (id === 'apply') void apply(); },
  });
  dialog.body.insertAdjacentHTML('beforeend', '<div id="se-apply-errors" class="se-apply-errors" tabindex="-1" role="alert" hidden></div><div id="se-sections"></div>');
  const q = <T extends HTMLElement = HTMLElement>(id: string) => dialog.el.querySelector<T>('#' + id)!;
  const candidate = () => api.write(base, stepId, model);
  const control = (key: string) => key ? dialog.body.querySelector<HTMLElement>(`[data-bind="${key}"]`) ?? dialog.body.querySelector<HTMLElement>(`[data-bind^="${key}."]`) : null;
  const label = (key: string) => { for (const [re, name] of LABELS) { const m = re.exec(key); if (m) return name(Number(m[1]) + 1); } return key === 'technology' ? 'Technology' : key.startsWith('timing') ? 'Random timing' : ''; };
  function check(): {items: Item[]; elsewhere: {where: string; message: string}[]} {
   let diagnostics: LWProcess.Diagnostic[] = []; const next = candidate();
   try { diagnostics = root.LWProcessCatalog.validate(next, true).diagnostics; } catch (e) { diagnostics = [{path: '/', code: 'data', message: String(e)}]; }
   const local: Item[] = api.problems(model).map(p => ({key: p.key, message: p.message, path: '', local: true}));
   const engine: Item[] = api.scope(next, stepId, diagnostics).filter(i => !local.some(l => overlap(l.key, i.key))).map(i => ({...i, local: false}));
   const items = [...local, ...engine].filter((i, at, all) => all.findIndex(o => o.key === i.key && o.message === i.message) === at);
   return {items, elsewhere: api.elsewhere(next, stepId, diagnostics)};
  }
  function update(): void {
   const {items, elsewhere} = check(), slots = [...dialog.body.querySelectorAll<HTMLElement>('[data-errs]')], placed = new Set<Item>();
   for (const slot of slots) {
    const key = slot.dataset.errs!, mine = items.filter(i => i.key === key || i.key.startsWith(key + '.')); mine.forEach(i => placed.add(i));
    const html = mine.map(i => `<p class="se-err">${esc(i.message)}</p>`).join(''); if ((slot.dataset.html ?? '') !== html) { slot.dataset.html = html; slot.innerHTML = html; }
   }
   const marked = new Set<HTMLElement>(); items.forEach(i => { const c = control(i.key); if (c) marked.add(c); });
   dialog.body.querySelectorAll<HTMLElement>('[aria-invalid]').forEach(n => { if (!marked.has(n)) n.removeAttribute('aria-invalid'); }); marked.forEach(n => n.setAttribute('aria-invalid', 'true'));
   const link = (i: Item) => { const c = control(i.key), name = label(i.key), text = (name && i.local ? name + ': ' : '') + i.message; return c?.id ? `<a href="#${c.id}" data-goto="${c.id}">${esc(text)}</a>` : esc(text); };
   let html = items.length ? `<p class="pd-status-title"><strong>${items.length} ${items.length === 1 ? 'problem' : 'problems'} in this step</strong></p><ul class="se-problems">${items.map(i => `<li>${link(i)}</li>`).join('')}</ul>` : '';
   if (elsewhere.length) html += `<p class="pd-status-title"><strong>Elsewhere in the draft (${elsewhere.length})</strong></p><ul class="se-problems">${elsewhere.map(e => `<li>${esc(e.where)}: ${esc(e.message)}</li>`).join('')}</ul><p class="se-help">These are outside this step. ${env.openDefinition ? '<button type="button" data-act="open-definition">Open the Definition editor</button>' : 'Open the Definition editor to fix them.'} They do not stop Save to draft, but Apply and reset run needs a valid draft.</p>`;
   dialog.setStatus(html);
   const local = api.problems(model).length > 0, changed = JSON.stringify(model) !== initial, why = 'Fix the highlighted fields before saving or applying.';
   dialog.setActionState('save', {disabled: local || !changed, reason: local ? why : !changed ? 'Save to draft is unavailable until you change something.' : ''}); dialog.setActionState('apply', {disabled: local, reason: local ? why : ''});
   const sum = q('se-needs-summary'), count = dialog.el.querySelector('#se-technology-count'), note = dialog.el.querySelector('#se-timing-note'), paths = dialog.el.querySelector<HTMLElement>('#se-path-summary');
   if (sum) sum.textContent = api.needsSummary(model); if (note) note.textContent = api.timingNote(model); if (count) count.textContent = `${model.technology.length} / 80 characters`;
   if (paths) { const next = sections.pathSummary(model); if (paths.dataset.html !== next) { paths.dataset.html = next; paths.innerHTML = next; } }
  }
  function render(focus?: string): void {
   const active = document.activeElement as HTMLElement | null, keep = focus ?? (active && dialog.el.contains(active) && active.dataset.bind ? `[data-bind="${active.dataset.bind}"]${active instanceof HTMLInputElement && active.type === 'radio' ? `[value="${active.value}"]` : ''}` : '');
   const html = sections.render(model);
   dialog.preserveScroll(() => { if (html !== shown) { shown = html; q('se-sections').innerHTML = html; } update(); });
   if (keep) dialog.el.querySelector<HTMLElement>(keep)?.focus({preventScroll: false});
  }
  function save(): void { draft.write(JSON.stringify(candidate(), null, 2), 'step-editor'); dialog.close('action'); env.notify('Saved to the draft. Apply the draft to start a fresh run.'); }
  const needsPlural = (n: number) => `${n.toLocaleString()} ${n === 1 ? 'case' : 'cases'}`;
  function refuse(result: LWProcess.Validation): void {
   const out = q('se-apply-errors'); out.hidden = false;
   out.innerHTML = `<p><strong>The draft cannot be applied yet.</strong> Fix ${result.diagnostics.length === 1 ? 'this problem' : 'these problems'} and try again.</p><ul>${result.diagnostics.map(d => `<li>${esc(api.describePath(candidate(), d.path))}: ${esc(d.message)}</li>`).join('')}</ul>`; out.focus();
  }
  async function apply(): Promise<void> {
   let result = root.LWProcessCatalog.validate(candidate()); if (!result.ok) { refuse(result); return; }
   const run = env.run();
   if (run.minute > 0) {
    const choice = await dialog.confirm(`Applying starts a fresh paused run and discards minute ${run.minute.toLocaleString()} (${needsPlural(run.cases)}). Export the run report first if you need it.`, [{id: 'back', label: 'Back', default: true}, {id: 'apply-reset', label: 'Apply and reset'}]);
    if (choice !== 'apply-reset' || !dialog.isOpen()) return;
    result = root.LWProcessCatalog.validate(candidate()); if (!result.ok) { refuse(result); return; }
   }
   const out = q('se-apply-errors'); out.hidden = true;
   if (env.apply(JSON.stringify(candidate(), null, 2))) dialog.close('action'); else { out.hidden = false; out.textContent = 'The definition could not be applied. See the status message.'; out.focus(); }
  }
  const rows = (name: 'set' | 'add' | 'needs' | 'outputs') => model[name] as unknown[];
  function act(button: HTMLButtonElement): void {
   const i = Number(button.dataset.i), what = button.dataset.act!;
   if (what === 'add-set') { model.set.push({key: '', value: api.newValue()}); render(`[data-bind="set.${model.set.length - 1}.key"]`); }
   else if (what === 'add-add') { model.add.push({key: '', delta: '1'}); render(`[data-bind="add.${model.add.length - 1}.key"]`); }
   else if (what === 'add-output') { model.outputs.push({field: '', label: ''}); render(`[data-bind="outputs.${model.outputs.length - 1}.field"]`); }
   else if (what === 'add-need') { model.needs.push({field: '', op: '', value: api.newValue(), label: ''}); render(`[data-bind="needs.${model.needs.length - 1}.field"]`); }
   else if (what === 'add-draw') { model.draws.push(api.newDraw()); render(`[data-bind="draws.${model.draws.length - 1}.field"]`); }
   else if (what === 'remove-draw') { model.draws.splice(i, 1); render('#se-add-draw'); }
   else if (what === 'add-choice') { const row = model.draws[i]!; row.values.push({value: {type: 'text', text: ''}, weight: '1'}); render(`[data-bind="draws.${i}.values.${row.values.length - 1}.value.text"]`); }
   else if (what === 'remove-choice') { model.draws[i]!.values.splice(Number(button.dataset.j), 1); render(`#se-add-choice-${i}`); }
   else if (what === 'open-definition') env.openDefinition?.();
   else if (what.startsWith('remove-')) { rows(what === 'remove-set' ? 'set' : what === 'remove-add' ? 'add' : what === 'remove-output' ? 'outputs' : 'needs').splice(i, 1); render('#se-' + what.replace('remove', 'add')); }
   else if (what === 'up' || what === 'down') {
    const to = what === 'up' ? i - 1 : i + 1; [model.flows[i], model.flows[to]] = [model.flows[to]!, model.flows[i]!];
    const target = dialog.el.querySelector<HTMLButtonElement>(`[data-act="${what}"][data-i="${to}"]`); render(target && !target.disabled ? `[data-act="${what}"][data-i="${to}"]` : `[data-act="${what === 'up' ? 'down' : 'up'}"][data-i="${to}"]`);
   }
  }
  dialog.el.addEventListener('click', e => {
   const t = e.target as HTMLElement, goto = t.closest<HTMLAnchorElement>('a[data-goto]');
   if (goto) { e.preventDefault(); const target = document.getElementById(goto.dataset.goto!); target?.scrollIntoView({block: 'center'}); target?.focus(); return; }
   const b = t.closest<HTMLButtonElement>('button[data-act]'); if (b && !b.disabled) act(b);
  });
  const edit = (e: Event) => {
   const t = e.target as HTMLInputElement; if (!t.dataset?.bind) return; const structural = t.dataset.rerender !== undefined;
   if (structural && e.type === 'input') return;
   setPath(model, t.dataset.bind, t.type === 'checkbox' ? t.checked : t.value);
   const kind = /^draws\.(\d+)\.kind$/.exec(t.dataset.bind);
   if (t.dataset.bind === 'timing.dist') api.chooseTiming(model, t.value as LWProcessStepModel.DistKind); else if (kind) api.chooseDraw(model.draws[Number(kind[1])]!, t.value as LWProcess.Draw['kind']);
   if (structural) render(); else update();
   q('se-apply-errors').hidden = true;
  };
  dialog.el.addEventListener('input', edit); dialog.el.addEventListener('change', edit);
  return {
   open(id, invoker) {
    const parsed = draft.parse();
    if (!parsed) { env.notify('The draft is not valid process JSON, so this step cannot be edited yet. Open the Definition editor and fix the JSON or restore the active definition, then choose Edit step again.', true); return false; }
    const read = api.read(parsed, id); if (!read) { env.notify('That step is not in the draft. Restore the active definition or choose another step.', true); return false; }
    base = parsed; model = read; initial = JSON.stringify(read); stepId = id; shown = '';
    const others = draft.diff({ignoreStep: id}), total = others.steps + others.flows + others.resources + others.arrivals + others.meta;
    dialog.setBanner(total ? esc(root.LWProcessDraft.describe(others, 'The draft also has unapplied changes outside this step')) + '. Apply and reset run includes them.' : null, 'warn');
    q('se-apply-errors').hidden = true; render();
    return dialog.open({title: read.name, subtitle: 'The run is paused while this window is open and nothing ticks. Edits go to the draft; the run only restarts when you apply.', chip: read.kind, meta: read.id, invoker: invoker ?? null, focusFallback: () => env.focusFor(id)});
   },
   isOpen: () => dialog.isOpen(),
   dispose() { dialog.dispose(); },
  };
 }
 root.LWProcessStepEditor = {create};
})(globalThis);
