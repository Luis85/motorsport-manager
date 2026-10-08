/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-step-model.ts" />
/** Modal editor for one process step. It edits a detached form model of the draft text, validates it live through the catalog and hands finished text back; it never ticks or retains a session. */
declare namespace LWProcessStepEditor {
 interface Env {
  /** The unapplied draft text (the single source of truth shared with the Definition editor tab). */
  read(): string;
  /** A detached copy of the active definition, used to tell whether the draft carries other unapplied changes. */
  active(): LWProcess.Definition;
  save(text: string): void;
  /** Validates and applies the text exactly like the Apply draft button; true when a fresh run started. */
  apply(text: string): boolean;
  notify(message: string, error?: boolean): void;
  /** The element that should regain focus after closing: the invoker if it still exists, else the step list item. */
  focusFor(invoker: string, stepId: string): HTMLElement | null;
 }
 interface Surface {open(stepId: string, invoker: string): boolean; isOpen(): boolean; dispose(): void}
 interface Api {create(host: HTMLElement, env: Env): Surface}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessStepModel: LWProcessStepModel.Api; LWProcessCatalog: LWProcess.Catalog; LWProcessStepEditor?: LWProcessStepEditor.Api};
 type M = LWProcessStepModel.Model;
 const esc = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
 const slug = (bind: string) => bind.replace(/\./g, '-'), idOf = (bind: string) => 'se-' + slug(bind);
 const TYPES: [string, string][] = [['text', 'Text'], ['number', 'Number'], ['true', 'True'], ['false', 'False'], ['null', 'Empty (null)']];
 const KIND_HELP: Record<string, string> = {task: 'Work done by people or equipment over time.', timer: 'Holds work without using people or equipment.', decision: 'Chooses one path for each case.', join: 'Waits for parallel paths to arrive.', fork: 'Starts parallel paths.', start: 'Where cases enter.', end: 'Where cases leave.'};
 const err = (key: string) => `<div class="se-errs" data-errs="${key}" id="se-err-${slug(key)}"></div>`;
 interface Opt {type?: 'number' | undefined; min?: number; max?: number; step?: string; help?: string; long?: boolean; desc?: string}
 function field(bind: string, label: string, value: string, o: Opt = {}): string {
  const id = idOf(bind), desc = [o.help ? id + '-help' : '', o.desc ?? ''].filter(Boolean).join(' '), attrs = `id="${id}" data-bind="${bind}"${desc ? ` aria-describedby="${desc}"` : ''}`;
  const control = o.long ? `<textarea ${attrs} rows="3" maxlength="2000">${esc(value)}</textarea>`
   : o.type === 'number' ? `<input ${attrs} type="number" inputmode="numeric" step="${o.step ?? '1'}"${o.min === undefined ? '' : ` min="${o.min}"`}${o.max === undefined ? '' : ` max="${o.max}"`} value="${esc(value)}">`
   : `<input ${attrs} type="text" maxlength="256" value="${esc(value)}">`;
  return `<div class="se-field"><label for="${id}">${esc(label)}</label>${control}${o.help ? `<p class="se-help" id="${id}-help">${esc(o.help)}</p>` : ''}</div>`;
 }
 const select = (bind: string, label: string, options: [string, string][], value: string, rerender = false) =>
  `<div class="se-field"><label for="${idOf(bind)}">${esc(label)}</label><select id="${idOf(bind)}" data-bind="${bind}"${rerender ? ' data-rerender' : ''}>${options.map(([v, t]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>`;
 const check = (bind: string, label: string, on: boolean) => `<label class="se-check"><input type="checkbox" id="${idOf(bind)}" data-bind="${bind}" data-rerender${on ? ' checked' : ''}> ${esc(label)}</label>`;
 const radios = (bind: string, legend: string, options: [string, string][], value: string) =>
  `<fieldset class="se-radios"><legend>${esc(legend)}</legend>${options.map(([v, t]) => `<label class="se-check"><input type="radio" name="${idOf(bind)}" id="${idOf(bind)}-${v}" data-bind="${bind}" data-rerender value="${v}"${v === value ? ' checked' : ''}> ${esc(t)}</label>`).join('')}</fieldset>`;
 const valueEditor = (bind: string, v: LWProcessStepModel.Value, desc: string) =>
  select(bind + '.type', 'Type of value', TYPES, v.type, true) + (v.type === 'text' || v.type === 'number' ? field(bind + '.text', 'Value', v.text, {type: v.type === 'number' ? 'number' : undefined, step: 'any', desc}) : '');
 const section = (id: string, title: string, intro: string, body: string) =>
  `<section class="se-section" aria-labelledby="se-h-${id}"><h3 id="se-h-${id}">${esc(title)}</h3>${intro ? `<p class="se-help">${esc(intro)}</p>` : ''}${body}</section>`;
 const button = (act: string, label: string, i?: number, extra = '', aria = '') => `<button type="button" data-act="${act}"${i === undefined ? '' : ` data-i="${i}"`}${aria ? ` aria-label="${esc(aria)}"` : ''}${extra}>${esc(label)}</button>`;
 function basics(m: M): string {
  return section('basics', 'Basics', KIND_HELP[m.kind] ?? '', `<div class="se-grid">${field('name', 'Name', m.name, {desc: 'se-err-name'})}${field('description', 'Description', m.description, {long: true, desc: 'se-err-description'})}</div>${err('name')}${err('description')}`);
 }
 function timing(m: M): string {
  if (m.kind !== 'task' && m.kind !== 'timer') return '';
  if (m.kind === 'task') return section('timing', 'Timing and cost', 'How long one visit takes and what each visit costs.', `<div class="se-grid">${field('duration', 'Task duration (minutes, at least 1)', m.duration, {type: 'number', min: 1, desc: 'se-err-duration'})}${field('cost', 'Fixed cost per visit (whole number, 0 or more)', m.cost, {type: 'number', min: 0, desc: 'se-err-cost'})}</div>${err('duration')}${err('cost')}`);
  const value = m.mode === 'until' ? field('until', 'Absolute minute to wait until (at least 1)', m.until, {type: 'number', min: 1, desc: 'se-err-until'}) : field('duration', 'Wait duration (minutes, at least 1)', m.duration, {type: 'number', min: 1, desc: 'se-err-duration'});
  return section('timing', 'Timing', 'A timer holds work without using people, equipment or cost.', `${radios('mode', 'What does this timer wait for?', [['duration', 'Wait a duration'], ['until', 'Wait until a minute']], m.mode)}<div class="se-grid">${value}</div>${err(m.mode === 'until' ? 'until' : 'duration')}`);
 }
 function people(m: M): string {
  if (m.kind !== 'task') return '';
  const body = m.pools.length ? `<div class="se-grid">${m.pools.map((p, i) => field(`pools.${i}.count`, p.name, p.count, {type: 'number', min: 0, max: p.capacity, help: `${p.capacity} available · 0 = not needed`, desc: 'se-err-pools'})).join('')}</div><p class="se-summary" id="se-needs-summary"></p>` : '<p class="se-help">This process defines no shared people or equipment. Add pools in the Definition editor tab.</p>';
  return section('people', 'People and capacity', 'How many of each shared pool one visit holds while it is working.', body + err('pools'));
 }
 function effects(m: M): string {
  if (m.kind !== 'task' && m.kind !== 'timer') return '';
  const sets = m.set.map((r, i) => `<fieldset class="se-card"><legend>Value ${i + 1}</legend><div class="se-grid">${field(`set.${i}.key`, 'Field name', r.key, {desc: 'se-err-set'})}${valueEditor(`set.${i}.value`, r.value, 'se-err-set')}</div>${button('remove-set', 'Remove', i, '', `Remove value ${i + 1}${r.key ? ' ' + r.key : ''}`)}</fieldset>`).join('');
  const adds = m.add.map((r, i) => `<fieldset class="se-card"><legend>Counter ${i + 1}</legend><div class="se-grid">${field(`add.${i}.key`, 'Counter field name', r.key, {desc: 'se-err-add'})}${field(`add.${i}.delta`, 'Change (whole number, may be negative)', r.delta, {type: 'number', desc: 'se-err-add'})}</div>${button('remove-add', 'Remove', i, '', `Remove counter ${i + 1}${r.key ? ' ' + r.key : ''}`)}</fieldset>`).join('');
  return section('effects', 'When this step completes', 'Each case keeps these values for later steps, conditions and the run report.',
   `<h4>Set a value</h4>${sets || '<p class="se-help">No values are set.</p>'}${err('set')}${button('add-set', 'Add value', undefined, ' id="se-add-set"')}<h4>Change a counter</h4>${adds || '<p class="se-help">No counters change.</p>'}${err('add')}${button('add-add', 'Add counter', undefined, ' id="se-add-add"')}`);
 }
 function needs(m: M): string {
  if (m.kind === 'start') return '';
  const rows = m.needs.map((n, j) => `<fieldset class="se-card"><legend>Need ${j + 1}</legend><div class="se-grid">${field(`needs.${j}.field`, 'Field earlier steps must deliver', n.field)}${select(`needs.${j}.op`, 'Condition', [['', 'Only that it is delivered'], ...root.LWProcessStepModel.OPS], n.op, true)}
   ${n.op ? valueEditor(`needs.${j}.value`, n.value, `se-err-needs-${j}`) : ''}${field(`needs.${j}.label`, 'Label (optional)', n.label)}</div>${err(`needs.${j}`)}${button('remove-need', 'Remove', j, '', `Remove need ${j + 1}${n.field ? ' ' + n.field : ''}`)}</fieldset>`).join('');
  return section('needs', 'Needs from earlier steps', 'This step waits until earlier steps have delivered these fields. A counter can only be required as delivered; the engine rejects a value test on a counter because its value cannot be proven.',
   (rows || '<p class="se-help">No needs.</p>') + button('add-need', 'Add need', undefined, ' id="se-add-need"'));
 }
 function backlog(m: M): string {
  const b = m.backlog; if (!b) return '';
  const body = b.on ? `<div class="se-grid">${field('backlog.capacity', 'Backlog capacity (1 to 200)', b.capacity, {type: 'number', min: 1, max: 200})}${select('backlog.order', 'Order', [['fifo', 'Oldest first'], ['lifo', 'Newest first'], ['priority', 'Highest priority field first']], b.order, true)}
   ${b.order === 'priority' ? field('backlog.priority', 'Priority field (numeric case value)', b.priority) : ''}${m.kind === 'join' ? field('backlog.pull', 'Pull limit (work allowed in the next step; blank for no limit)', b.pull, {type: 'number', min: 1, max: 200}) : ''}</div>` : '';
  return section('backlog', 'Backlog', 'A bounded store of waiting work before this step.', check('backlog.on', 'Keep a backlog of waiting work', b.on) + body + err('backlog'));
 }
 function condition(f: LWProcessStepModel.FlowRow, k: number): string {
  const c = f.cond, b = `flows.${k}.cond`;
  if (!c.on) return check(b + '.on', 'Take this path only when a condition is met', false) + '<p class="se-help">No condition: this is the fallback path, used when no other path matches.</p>';
  return check(b + '.on', 'Take this path only when a condition is met', true) + `<div class="se-grid">${field(b + '.field', 'Case field to test', c.field)}${select(b + '.op', 'Condition', root.LWProcessStepModel.OPS, c.op)}</div>`
   + radios(b + '.mode', 'Compare with', [['value', 'A value'], ['field', 'Another field']], c.mode)
   + (c.mode === 'field' ? `<div class="se-grid">${field(b + '.valueField', 'Other case field to compare with', c.valueField)}</div>` : `<div class="se-grid">${valueEditor(b + '.value', c.value, `se-err-flows-${k}`)}</div>`);
 }
 function flows(m: M): string {
  const note = 'Connections between steps are fixed here. To add or remove a flow, edit the raw JSON draft in the Definition editor tab.';
  if (!m.flows.length) return section('flows', 'Where work goes next', 'This step ends the process, so it has no outgoing flows. ' + note, '');
  const decision = m.kind === 'decision', rows = m.flows.map((f, k) => {
   const moves = decision && m.flows.length > 1 ? `<div class="se-actions">${button('up', 'Move up', k, k === 0 ? ' disabled aria-describedby="se-first"' : '')}${button('down', 'Move down', k, k === m.flows.length - 1 ? ' disabled aria-describedby="se-last"' : '')}<span class="se-help">${k === 0 ? 'Checked first. Cannot move up.' : k === m.flows.length - 1 ? 'Checked last. Cannot move down.' : `Position ${k + 1} of ${m.flows.length}.`}</span></div>` : '';
   return `<fieldset class="se-card"><legend>Path ${k + 1} of ${m.flows.length} · to ${esc(f.toName)}</legend>${field(`flows.${k}.label`, 'Label shown on this path', f.label)}${decision || f.cond.on ? condition(f, k) : ''}${err(`flows.${k}`)}${moves}</fieldset>`;
  }).join('');
  return section('flows', 'Where work goes next', (decision ? 'The first path whose condition matches wins, so order matters; the path without a condition is the fallback. ' : '') + note, rows);
 }
 const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
 const setPath = (target: unknown, path: string, value: unknown) => { const keys = path.split('.'); let at = target as Record<string, unknown>; for (const key of keys.slice(0, -1)) at = at[key] as Record<string, unknown>; at[keys.at(-1)!] = value; };
 function create(host: HTMLElement, env: LWProcessStepEditor.Env): LWProcessStepEditor.Surface {
  const api = root.LWProcessStepModel, dlg = document.createElement('dialog'); dlg.className = 'se-dialog'; dlg.setAttribute('aria-labelledby', 'se-title'); dlg.setAttribute('aria-describedby', 'se-note');
  dlg.innerHTML = `<div class="se-head"><div class="se-heading"><h2 id="se-title"></h2><p class="se-meta"><span class="se-chip" id="se-kind"></span> <code id="se-id"></code></p></div><button type="button" id="se-close" data-act="cancel"><span aria-hidden="true">×</span> Close</button></div>
   <div class="se-body" id="se-body"><p id="se-note" class="se-help">The run is paused while this window is open and nothing ticks. Edits go to the draft; the run only restarts when you apply.</p><p id="se-other" class="se-notice" hidden>The draft also has other unapplied changes outside this step. Apply and reset run includes them.</p>
   <div id="se-summary" class="se-status" role="status"></div><div id="se-apply-errors" class="se-apply-errors" tabindex="-1" role="alert" hidden></div><div id="se-sections"></div></div>
   <div class="se-foot"><p id="se-reason" class="se-help"></p><div class="se-confirm" id="se-confirm" role="alertdialog" aria-labelledby="se-confirm-title" hidden><p id="se-confirm-title"></p><div class="se-actions"><button type="button" id="se-keep" data-act="keep">Keep editing</button><button type="button" id="se-discard" data-act="discard">Discard changes</button></div></div>
   <div class="se-actions" id="se-buttons"><button type="button" id="se-cancel" data-act="cancel">Cancel</button><button type="button" id="se-save" data-act="save" aria-describedby="se-reason">Save to draft</button><button type="button" id="se-apply" class="primary" data-act="apply" aria-describedby="se-reason">Apply and reset run</button></div></div>`;
  host.append(dlg);
  const q = <T extends HTMLElement = HTMLElement>(id: string) => dlg.querySelector<T>('#' + id)!;
  let model: M, base: LWProcess.Definition, initial = '', stepId = '', invoker = '', opened = false, confirmFrom: HTMLElement | null = null, shown = '';
  const dirty = () => JSON.stringify(model) !== initial, parse = (): LWProcess.Definition | undefined => { try { const d = JSON.parse(env.read()) as LWProcess.Definition; return Array.isArray(d.steps) && Array.isArray(d.flows) && Array.isArray(d.resources) ? d : undefined; } catch { return undefined; } };
  const candidate = () => api.write(base, stepId, model);
  function items(): LWProcessStepModel.Scoped[] {
   let diagnostics: LWProcess.Diagnostic[] = []; try { diagnostics = root.LWProcessCatalog.validate(candidate(), true).diagnostics; } catch (e) { diagnostics = [{path: '/', code: 'data', message: String(e)}]; }
   return [...api.scope(candidate(), stepId, diagnostics), ...api.problems(model).map(p => ({key: p.key, message: p.message, path: ''}))];
  }
  function update(): void {
   const all = items(), slots = [...dlg.querySelectorAll<HTMLElement>('[data-errs]')], placed = new Set<LWProcessStepModel.Scoped>();
   for (const slot of slots) {
    const key = slot.dataset.errs!, mine = all.filter(i => i.key === key || i.key.startsWith(key + '.')); mine.forEach(i => placed.add(i));
    const html = mine.map(i => `<p class="se-err">${esc(i.message)}</p>`).join(''); if (slot.innerHTML !== html) slot.innerHTML = html;
   }
   const loose = all.filter(i => !placed.has(i)), text = all.length ? `${all.length} ${all.length === 1 ? 'problem' : 'problems'} in this step.${all.length > loose.length ? ' Details appear beside the fields.' : ''}` : 'No problems found in this step.';
   const summary = q('se-summary'), html = `<p>${esc(text)}</p>${loose.map(i => `<p class="se-err">${esc(i.message)}</p>`).join('')}`; if (summary.dataset.html !== html) { summary.dataset.html = html; summary.innerHTML = html; }
   const local = api.problems(model).length > 0, changed = dirty(), reason = local ? 'Fix the highlighted fields before saving or applying.' : !changed ? 'Save to draft is unavailable until you change something.' : '';
   q<HTMLButtonElement>('se-save').disabled = local || !changed; q<HTMLButtonElement>('se-apply').disabled = local; q('se-reason').textContent = reason;
   const sum = dlg.querySelector('#se-needs-summary'); if (sum) sum.textContent = api.needsSummary(model);
  }
  function render(focus?: string): void {
   const active = document.activeElement as HTMLElement | null, keep = focus ?? (active && dlg.contains(active) && active.dataset.bind ? `[data-bind="${active.dataset.bind}"]${active instanceof HTMLInputElement && active.type === 'radio' ? `[value="${active.value}"]` : ''}` : '');
   const html = [basics, timing, people, effects, needs, backlog, flows].map(f => f(model)).join(''), body = q('se-sections'), scroll = q('se-body').scrollTop;
   if (html !== shown) { shown = html; body.innerHTML = html; }
   q('se-body').scrollTop = scroll; update(); if (keep) dlg.querySelector<HTMLElement>(keep)?.focus({preventScroll: false});
  }
  function finish(message?: string): void {
   dlg.close(); opened = false; q('se-confirm').hidden = true; q('se-buttons').hidden = false; if (message) env.notify(message);
   env.focusFor(invoker, stepId)?.focus();
  }
  function request(from: HTMLElement | null): void {
   if (!q('se-confirm').hidden) { keep(); return; }
   if (!dirty()) { finish(); return; }
   confirmFrom = from; q('se-confirm-title').textContent = `Discard your changes to ${model.name || stepId}?`; q('se-confirm').hidden = false; q('se-buttons').hidden = true; q('se-keep').focus();
  }
  function keep(): void {
   q('se-confirm').hidden = true; q('se-buttons').hidden = false; (confirmFrom?.isConnected && dlg.contains(confirmFrom) && confirmFrom.getClientRects().length ? confirmFrom : q('se-cancel')).focus();
  }
  function save(): void { env.save(JSON.stringify(candidate(), null, 2)); finish('Saved to the draft. Apply the draft to start a fresh run.'); }
  function apply(): void {
   const next = candidate(), result = root.LWProcessCatalog.validate(next), out = q('se-apply-errors');
   if (!result.ok) {
    out.hidden = false; out.innerHTML = `<p><strong>The draft cannot be applied yet.</strong> Fix ${result.diagnostics.length === 1 ? 'this problem' : 'these problems'} and try again.</p><ul>${result.diagnostics.map(d => `<li>${esc(d.path)}: ${esc(d.message)}</li>`).join('')}</ul>`; out.focus(); return;
   }
   out.hidden = true; if (env.apply(JSON.stringify(next, null, 2))) finish(); else { out.hidden = false; out.textContent = 'The definition could not be applied. See the status message.'; out.focus(); }
  }
  const rows = (name: 'set' | 'add' | 'needs') => model[name] as unknown[];
  function act(button: HTMLButtonElement): void {
   const i = Number(button.dataset.i), what = button.dataset.act!;
   if (what === 'cancel') request(button); else if (what === 'keep') keep(); else if (what === 'discard') finish(); else if (what === 'save') save(); else if (what === 'apply') apply();
   else if (what === 'add-set') { model.set.push({key: '', value: api.newValue()}); render(`[data-bind="set.${model.set.length - 1}.key"]`); }
   else if (what === 'add-add') { model.add.push({key: '', delta: '1'}); render(`[data-bind="add.${model.add.length - 1}.key"]`); }
   else if (what === 'add-need') { model.needs.push({field: '', op: '', value: api.newValue(), label: ''}); render(`[data-bind="needs.${model.needs.length - 1}.field"]`); }
   else if (what.startsWith('remove-')) { rows(what === 'remove-set' ? 'set' : what === 'remove-add' ? 'add' : 'needs').splice(i, 1); render('#se-' + what.replace('remove', 'add')); }
   else if (what === 'up' || what === 'down') {
    const to = what === 'up' ? i - 1 : i + 1; [model.flows[i], model.flows[to]] = [model.flows[to]!, model.flows[i]!];
    const target = dlg.querySelector<HTMLButtonElement>(`[data-act="${what}"][data-i="${to}"]`); render(target && !target.disabled ? `[data-act="${what}"][data-i="${to}"]` : `[data-act="${what === 'up' ? 'down' : 'up'}"][data-i="${to}"]`);
   }
  }
  dlg.addEventListener('click', e => { const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]'); if (b && !b.disabled) act(b); });
  const edit = (e: Event) => {
   const t = e.target as HTMLInputElement; if (!t.dataset?.bind) return; const structural = t.dataset.rerender !== undefined;
   if (structural && e.type === 'input') return;
   setPath(model, t.dataset.bind, t.type === 'checkbox' ? t.checked : t.value);
   if (structural) render(); else update();
   q('se-apply-errors').hidden = true;
  };
  dlg.addEventListener('input', edit); dlg.addEventListener('change', edit);
  dlg.addEventListener('keydown', e => {
   if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); request(document.activeElement as HTMLElement | null); return; }
   if (e.key !== 'Tab') return;
   const list = [...dlg.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(n => n.getClientRects().length > 0 && !n.closest('[hidden]')); if (!list.length) return;
   const first = list[0]!, last = list.at(-1)!;
   if (e.shiftKey && (document.activeElement === first || !dlg.contains(document.activeElement))) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && (document.activeElement === last || !dlg.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
  });
  dlg.addEventListener('cancel', e => { e.preventDefault(); request(document.activeElement as HTMLElement | null); });
  dlg.addEventListener('close', () => { opened = false; });
  return {
   open(id, from) {
    const draft = parse(); if (!draft) { env.notify('The draft is not valid process JSON. Fix or restore it in the Definition editor tab before editing a step.', true); return false; }
    const read = api.read(draft, id); if (!read) { env.notify('That step is not in the draft. Restore the active definition or choose another step.', true); return false; }
    base = draft; model = read; initial = JSON.stringify(read); stepId = id; invoker = from; shown = ''; opened = true;
    q('se-title').textContent = read.name; q('se-kind').textContent = read.kind; q('se-id').textContent = read.id; q('se-other').hidden = !api.otherChanges(env.active(), draft, id);
    q('se-apply-errors').hidden = true; q('se-confirm').hidden = true; q('se-buttons').hidden = false; render(); dlg.showModal(); q('se-body').scrollTop = 0; (dlg.querySelector<HTMLElement>('#se-name') ?? q('se-close')).focus();
    return true;
   },
   isOpen: () => opened,
   dispose() { if (dlg.open) dlg.close(); dlg.remove(); opened = false; },
  };
 }
 root.LWProcessStepEditor = {create};
})(globalThis);
