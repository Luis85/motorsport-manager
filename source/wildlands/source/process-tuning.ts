/// <reference path="./process-contracts.d.ts" />
/** Form editor over the unapplied JSON draft. It only edits draft text; applying still goes through catalog admission and resets the run. */
declare namespace LWProcessTuning {
 interface Surface {refresh(): void; dispose(): void;}
 interface Api {create(host: HTMLElement, read: () => string, write: (text: string) => void): Surface;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessTuning?: LWProcessTuning.Api};
 const esc = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
 const MAX = 100000, num = (id: string, label: string, path: string, value: number | undefined, min: number, max: number) =>
  `<label for="${id}">${esc(label)}<input id="${id}" type="number" inputmode="numeric" data-path="${esc(path)}" data-kind="int" min="${min}" max="${max}" step="1" value="${value ?? ''}"></label>`;
 const text = (id: string, label: string, path: string, value: string | undefined, long = false) =>
  `<label for="${id}">${esc(label)}${long ? `<textarea id="${id}" rows="2" maxlength="2000" data-path="${esc(path)}" data-kind="text">${esc(value ?? '')}</textarea>` : `<input id="${id}" type="text" maxlength="256" data-path="${esc(path)}" data-kind="text" value="${esc(value ?? '')}">`}</label>`;
 const OPS = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'], OP_LABEL: Record<string, string> = {eq: 'equals', ne: 'is not', gt: 'greater than', gte: 'at least', lt: 'less than', lte: 'at most'};
 const select = (id: string, label: string, path: string, kind: string, options: [string, string][], value: string | undefined) =>
  `<label for="${id}">${esc(label)}<select id="${id}" data-path="${esc(path)}" data-kind="${kind}">${options.map(([v, t]) => `<option value="${esc(v)}"${v === (value ?? '') ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
 const raw = (n: LWProcess.Scalar | undefined) => n === undefined ? '' : typeof n === 'string' ? n : JSON.stringify(n);
 function backlogMarkup(s: LWProcess.Step, i: number): string {
  if (s.kind !== 'task' && s.kind !== 'join') return '';
  const b = s.backlog, toggle = `<label class="tune-check"><input type="checkbox" id="tune-backlog-${i}" data-action="toggle-backlog" data-path="steps.${i}"${b ? ' checked' : ''}> Keep a backlog of waiting work</label>`;
  if (!b) return toggle;
  return toggle + num(`tune-backlog-cap-${i}`, 'Backlog capacity', `steps.${i}.backlog.capacity`, b.capacity, 1, 200) +
   select(`tune-backlog-order-${i}`, 'Order', `steps.${i}.backlog.order`, 'order', [['fifo', 'Oldest first'], ['lifo', 'Newest first'], ['priority', 'Highest priority field first']], b.order ?? 'fifo') +
   (b.order === 'priority' ? text(`tune-backlog-field-${i}`, 'Priority field (numeric case value)', `steps.${i}.backlog.priority`, b.priority) : '') +
   (s.kind === 'join' ? `<label for="tune-backlog-pull-${i}">Pull limit (work allowed in the next step; blank for no limit)<input id="tune-backlog-pull-${i}" type="number" min="1" max="200" step="1" data-path="steps.${i}.backlog.pull" data-kind="optional-int" value="${b.pull ?? ''}"></label>` : '');
 }
 function timerMarkup(s: LWProcess.Step, i: number): string {
  return s.until !== undefined ? num(`tune-step-until-${i}`, 'Wait until absolute minute', `steps.${i}.until`, s.until, 0, MAX) : num(`tune-step-dur-${i}`, 'Wait duration (minutes)', `steps.${i}.duration`, s.duration, 0, MAX);
 }
 function addMarkup(s: LWProcess.Step, i: number): string {
  const keys = Object.keys(s.add ?? {}); if (!keys.length) return '';
  return keys.map((k, j) => num(`tune-step-add-${i}-${j}`, `Adds to counter ${k} (whole number, may be negative)`, `steps.${i}.add.${k}`, s.add![k], -MAX, MAX)).join('');
 }
 function needsMarkup(s: LWProcess.Step, i: number): string {
  if (s.kind === 'start') return '';
  const rows = (s.needs ?? []).map((n, j) => `<fieldset class="tune-need"><legend>Need ${j + 1}</legend>${text(`tune-need-field-${i}-${j}`, 'Field earlier steps must deliver', `steps.${i}.needs.${j}.field`, n.field)}
   ${select(`tune-need-op-${i}-${j}`, 'Condition', `steps.${i}.needs.${j}.op`, 'op', [['', 'Only delivered'], ...OPS.map(o => [o, OP_LABEL[o]!] as [string, string])], n.op)}
   ${n.op ? `<label for="tune-need-value-${i}-${j}">Value<input id="tune-need-value-${i}-${j}" type="text" maxlength="256" data-path="steps.${i}.needs.${j}.value" data-kind="scalar" value="${esc(raw(n.value))}"></label>` : ''}
   ${text(`tune-need-label-${i}-${j}`, 'Label', `steps.${i}.needs.${j}.label`, n.label)}<button type="button" data-action="remove" data-path="steps.${i}.needs.${j}">Remove need</button></fieldset>`).join('');
  return `<h4>Needs from earlier steps</h4>${rows}<button type="button" data-action="add-need" data-path="steps.${i}" id="tune-add-need-${i}">Add need</button>`;
 }
 function markup(d: LWProcess.Definition): string {
  const res = d.resources.map((r, i) => `<fieldset><legend>${esc(r.name)}</legend>${text('tune-res-name-' + i, 'Name', `resources.${i}.name`, r.name)}${num('tune-res-cap-' + i, 'Capacity', `resources.${i}.capacity`, r.capacity, 1, 1000)}${num('tune-res-cost-' + i, 'Cost per minute', `resources.${i}.costPerMinute`, r.costPerMinute, 0, MAX)}</fieldset>`).join('') || '<p>No shared resources defined.</p>';
  const steps = d.steps.map((s, i) => `<details class="tune-step"><summary>${esc(s.name)} <small>${esc(s.kind)}</small></summary>${text('tune-step-name-' + i, 'Name', `steps.${i}.name`, s.name)}${text('tune-step-desc-' + i, 'Description', `steps.${i}.description`, s.description, true)}
   ${s.kind === 'task' ? num('tune-step-dur-' + i, 'Duration (minutes)', `steps.${i}.duration`, s.duration, 1, MAX) : ''}${s.kind === 'timer' ? timerMarkup(s, i) : num('tune-step-cost-' + i, 'Fixed cost per visit', `steps.${i}.cost`, s.cost ?? 0, 0, 100000000)}${addMarkup(s, i)}
   ${s.kind === 'task' ? d.resources.map((r, j) => num(`tune-step-res-${i}-${j}`, `Needs ${r.name}`, `steps.${i}.resources.${r.id}`, s.resources?.[r.id] ?? 0, 0, r.capacity)).join('') : ''}${backlogMarkup(s, i)}${needsMarkup(s, i)}</details>`).join('');
  const arrivals = d.arrivals.map((a, i) => `<fieldset><legend>Arrival ${i + 1}</legend>${num('tune-arr-at-' + i, 'First arrival (minute)', `arrivals.${i}.at`, a.at, 0, MAX)}${num('tune-arr-count-' + i, 'Cases', `arrivals.${i}.count`, a.count, 1, 200)}${num('tune-arr-int-' + i, 'Interval (minutes)', `arrivals.${i}.interval`, a.interval, 0, MAX)}</fieldset>`).join('') || '<p>No arrivals defined.</p>';
  return `<h3>Tune values</h3><p class="process-note">Edit numbers and names here. Changes update the draft below; apply it to start a fresh paused run.</p>
   <fieldset><legend>Process</legend>${text('tune-name', 'Name', 'name', d.name)}${text('tune-desc', 'Description', 'description', d.description, true)}</fieldset>
   <h4>Shared resources</h4>${res}<h4>Steps</h4>${steps}<h4>Case arrivals</h4>${arrivals}`;
 }
 const pathTo = (target: any, path: string): any => path.split('.').filter(Boolean).reduce((at, key) => at[key], target);
 function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.'); let at: any = target;
  for (const key of keys.slice(0, -1)) at = at[key];
  const last = keys.at(-1)!;
  if (value === undefined) delete at[last]; else at[last] = value;
 }
 function create(host: HTMLElement, read: () => string, write: (text: string) => void): LWProcessTuning.Surface {
  const change = (e: Event) => {
   const input = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement; if (!input.dataset.path || input.dataset.action) return;
   let draft: any; try {draft = JSON.parse(read());} catch {refresh(); return;}
   let value: unknown;
   if (input.dataset.kind === 'op') {
    const need = pathTo(draft, input.dataset.path.replace(/\.op$/, ''));
    if (input.value) {need.op = input.value; if (need.value === undefined) need.value = true;} else {delete need.op; delete need.value;}
    write(JSON.stringify(draft, null, 2)); refresh(); return;
   }
   if (input.dataset.kind === 'order') {
    const backlog = pathTo(draft, input.dataset.path.replace(/\.order$/, ''));
    backlog.order = input.value; if (input.value !== 'priority') delete backlog.priority; else backlog.priority ??= 'priority';
    write(JSON.stringify(draft, null, 2)); refresh(); return;
   }
   if (input.dataset.kind === 'scalar') value = input.value === 'true' ? true : input.value === 'false' ? false : input.value.trim() !== '' && Number.isFinite(Number(input.value)) ? Number(input.value) : input.value;
   else if (input.dataset.kind === 'int' || input.dataset.kind === 'optional-int') {
    if (input.dataset.kind === 'optional-int' && input.value === '') {setPath(draft, input.dataset.path, undefined); write(JSON.stringify(draft, null, 2)); return;}
    const n = input.value === '' ? NaN : Number(input.value);
    if (!Number.isFinite(n)) {input.setAttribute('aria-invalid', 'true'); return;}
    input.removeAttribute('aria-invalid'); value = Math.round(n);
    if (input.dataset.path!.includes('.resources.') && value === 0) value = undefined;
   } else if (input.dataset.kind !== 'scalar') value = input.value === '' && /\.(description|label)$/.test(input.dataset.path!) ? undefined : input.value;
   setPath(draft, input.dataset.path!, value); write(JSON.stringify(draft, null, 2));
  };
  let shown = '';
  function refresh(): void {
   const open = new Set([...host.querySelectorAll('details[open]')].map(n => n.querySelector('summary')?.textContent));
   const focused = (document.activeElement as HTMLElement | null)?.id;
   let draft: LWProcess.Definition; try {draft = JSON.parse(read()) as LWProcess.Definition; if (!Array.isArray(draft.steps) || !Array.isArray(draft.resources) || !Array.isArray(draft.arrivals)) throw Error('shape');}
   catch {shown = ''; host.innerHTML = '<p class="process-note" role="status">The draft is not valid JSON yet. Fix it below or restore the active definition to use the form.</p>'; return;}
   const html = markup(draft); if (html === shown && host.childElementCount) return; shown = html; host.innerHTML = html;
   host.querySelectorAll('details').forEach(n => {if (open.has(n.querySelector('summary')?.textContent)) n.setAttribute('open', '');});
   if (focused && host.contains(document.getElementById(focused))) document.getElementById(focused)!.focus({preventScroll: true});
  }
  const click = (e: Event) => {
   const target = e.target as HTMLElement; if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLButtonElement) || !target.dataset.action) return;
   let draft: any; try {draft = JSON.parse(read());} catch {refresh(); return;}
   const at = target.dataset.path!, action = target.dataset.action;
   if (action === 'toggle-backlog') {const step = pathTo(draft, at); if ((target as HTMLInputElement).checked) step.backlog = {capacity: 8, order: 'fifo'}; else delete step.backlog;}
   else if (action === 'add-need') {const step = pathTo(draft, at); (step.needs ??= []).push({field: 'delivered' + ((step.needs?.length ?? 0) + 1)});}
   else if (action === 'remove') {const parts = at.split('.'), index = Number(parts.pop()), list = pathTo(draft, parts.join('.')) as unknown[]; list.splice(index, 1); if (!list.length) delete pathTo(draft, parts.slice(0, -1).join('.'))[parts.at(-1)!];}
   write(JSON.stringify(draft, null, 2)); refresh();
  };
  host.addEventListener('change', change); host.addEventListener('click', click);
  return {refresh, dispose() {host.removeEventListener('change', change); host.removeEventListener('click', click); host.replaceChildren();}};
 }
 root.LWProcessTuning = {create};
})(globalThis);
