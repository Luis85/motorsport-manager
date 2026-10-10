/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-tuning-fields.ts" />
/// <reference path="./process-tuning-arrivals.ts" />
/// <reference path="./process-tuning-track.ts" />
/// <reference path="./process-tuning-sipoc.ts" />
/// <reference path="./process-tuning-calendar.ts" />
/// <reference path="./process-json-path.ts" />
/**
 * The "Tune values" form of the Definition editor: process name, description, process type, seed and display-only working
 * calendar (process-tuning-calendar.ts), shared resources (name, kind,
 * capacity, cost), case arrivals, tracked measures and the SIPOC suppliers and customers. It edits the unapplied draft TEXT through the `write` callback; applying still goes through
 * catalog admission and resets the run. The catalog's diagnostics are handed in with `setDiagnostics` and shown beside the field
 * they name, with `aria-invalid` on the control; the form never decides what is valid. Per-step values belong to the step editor.
 */
declare namespace LWProcessTuning {
 interface Surface {
  /** Rebuilds the form from the draft when its markup changed. False when the draft cannot be shown as a form (the form is left as it was). */
  refresh(): boolean;
  /** The catalog's diagnostics for the draft; each is shown by the field its path names. Returns how many belong to steps or flows. */
  setDiagnostics(list: LWProcess.Diagnostic[]): number;
  /** Disables every control (the draft is not valid JSON), keeping the last form visible. */
  setDisabled(disabled: boolean, reason?: string): void;
  /** Moves focus to the control editing `path` (dot path, e.g. 'seed'), or the first control. */
  focusField(path?: string): boolean;
  dispose(): void;
 }
 /** Asks a question in the hosting dialog (Cancel first) and resolves with the chosen id. */
 /** Writes the draft text; `label` names a removal ('Removed Product owner') so the editor can offer Undo. */
 type Write = (text: string, label?: string) => void;
 type Confirm = (message: string, choices: {id: string; label: string; default?: boolean}[]) => Promise<string>;
 interface Api {
  /** Without `confirm`, removing a pool that steps still use removes it at once. */
  create(host: HTMLElement, read: () => string, write: Write, confirm?: Confirm): Surface;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessTuningFields: LWProcessTuningFields.Api; LWProcessTuningArrivals: LWProcessTuningArrivals.Api;
  LWProcessTuningTrack: LWProcessTuningTrack.Api; LWProcessTuningSipoc: LWProcessTuningSipoc.Api; LWProcessTuningCalendar: LWProcessTuningCalendar.Api;
  LWProcessJsonPath: LWProcessJsonPath.Api; LWProcessTuning?: LWProcessTuning.Api};
 const F = root.LWProcessTuningFields, A = root.LWProcessTuningArrivals, T = root.LWProcessTuningTrack, P = root.LWProcessTuningSipoc, esc = F.esc;
 const C = root.LWProcessTuningCalendar;
 const KINDS: [string, string][] = [['people', 'People'], ['machine', 'Machine'], ['system', 'System']];
 const SEED = 2147483647, SEED_HELP = 'Same seed, same run. Change it to see another scenario. Leave empty for the default seed (1).';
 /** Names of the steps that demand pool `id`, in draft order. */
 const users = (d: LWProcess.Definition, id: string) =>
  d.steps.filter(s => s.resources && typeof s.resources === 'object' && Object.hasOwn(s.resources, id)).map(s => String(s.name));
 const list = (names: string[]) => names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
 function resource(r: LWProcess.Resource, i: number, total: number, by: string[]): string {
  const p = `resources.${i}`, id = `tune-res-${i}`, used = by.length ? `Used by ${list(by)}.` : 'Not used by any step yet.';
  return `<fieldset class="de-card" id="${id}"><legend>${esc(r.name)} <code>${esc(r.id)}</code></legend><div class="de-errs" id="${id}-err" data-errs="${p}"></div>
   <div class="de-grid">${F.text(id + '-name', 'Name', p + '.name', r.name)}${F.choice(id + '-kind', 'Kind', p + '.kind', r.kind ?? 'people', KINDS, 'People work on task steps; machine and system steps may only use machine and system pools.')}
   ${F.int(id + '-cap', 'Capacity', p + '.capacity', r.capacity, {min: 1, max: 1000, unit: 'parallel units'})}${F.int(id + '-cost', 'Cost per minute', p + '.costPerMinute', r.costPerMinute, {min: 0, max: 100000, unit: 'cost units'})}</div>
   <p class="de-help" id="${id}-used">${esc(used)}</p>
   <button type="button" class="de-mini de-remove" data-act="res-remove" data-i="${i}" aria-describedby="${id}-used"${total < 1 ? ' disabled' : ''}>
   Remove ${esc(r.name)}</button></fieldset>`;
 }
 function markup(d: LWProcess.Definition): string {
  const res = d.resources.map((r, i) => resource(r, i, d.resources.length, users(d, r.id))).join('')
   || '<p class="de-help">No shared resources are defined.</p>';
  const arrivals = (d.arrivals ?? []).map((a, i, all) => A.markup(a, i, all.length)).join('');
  return `<div id="tune-summary" class="de-summary"></div>
   <section class="de-sec" aria-labelledby="tune-h-process"><h4 id="tune-h-process" tabindex="-1">Process</h4><div class="de-errs" id="tune-err" data-errs=""></div>
    ${F.text('tune-name', 'Name', 'name', d.name)}${F.text('tune-desc', 'Description', 'description', d.description, {max: 4000, long: true})}
    ${T.genreMarkup(d)}${F.int('tune-seed', 'Seed', 'seed', d.seed, {min: 0, max: SEED, optional: true, help: SEED_HELP})}
    ${C.markup(d)}</section>
   <section class="de-sec" aria-labelledby="tune-h-res"><h4 id="tune-h-res" tabindex="-1">Shared resources</h4><div class="de-errs" id="tune-res-err" data-errs="resources"></div><p class="de-help">Pools of people, machines or systems that steps wait for.</p>${res}<button type="button" class="de-add" id="tune-res-add" data-act="res-add">Add resource</button></section>
   <section class="de-sec" aria-labelledby="tune-h-arr"><h4 id="tune-h-arr" tabindex="-1">Case arrivals</h4><div class="de-errs" id="tune-arr-err" data-errs="arrivals"></div><p class="de-help">When new cases enter the process.</p>${arrivals || '<p class="de-help">No arrivals are defined.</p>'}<button type="button" class="de-add" id="tune-arr-add" data-act="arr-add">Add arrival</button></section>
   ${T.trackMarkup(d)}
   ${P.markup(d)}
   <p class="de-help">Steps and flows are edited with Edit step… or in Raw JSON.</p>`;
 }
 function setPath(target: unknown, path: string, value: unknown): void {
  const keys = path.split('.'); let at = target as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) { if (typeof at[key] !== 'object' || at[key] === null) return; at = at[key] as Record<string, unknown>; }
  const last = keys.at(-1)!; if (value === undefined) delete at[last]; else at[last] = value;
 }
 const getPath = (target: unknown, path: string) => path.split('.').reduce<unknown>((at, key) => (at && typeof at === 'object' ? (at as Record<string, unknown>)[key] : undefined), target);
 const WAIT_FOR_CHANGE = new Set(['choice', 'end', 'scalar-type', 'data-name']);
 function create(host: HTMLElement, read: () => string, write: LWProcessTuning.Write, confirm?: LWProcessTuning.Confirm): LWProcessTuning.Surface {
  let shown = '', diagnostics: LWProcess.Diagnostic[] = [], other = 0; const local = new Map<string, string>();
  const form = () => host.querySelector<HTMLFieldSetElement>('fieldset.de-form');
  const parse = (): LWProcess.Definition | undefined => { try { const d = JSON.parse(read()) as LWProcess.Definition; return d && Array.isArray(d.resources) && Array.isArray(d.steps) && (d.arrivals === undefined || Array.isArray(d.arrivals)) ? d : undefined; } catch { return undefined; } };
  const controlOf = (slot: Element) => (slot.closest('.de-field, .de-radios, .de-card, .de-sec') ?? host).querySelector<HTMLElement>('input, select, textarea, button');
  function show(): void {
   const slots = [...host.querySelectorAll<HTMLElement>('[data-errs]')], placed = new Map<HTMLElement, string[]>(), links: {slot: HTMLElement; key: string; text: string}[] = [];
   let outside = 0; const def = parse();
   // A step that demands a pool of the wrong kind, or more than its capacity, is a problem with that pool: show it beside the pool's kind or capacity.
   const poolKey = (d: LWProcess.Diagnostic) => {
    const m = /^\/steps\/\d+\/resources\/([^/]+)$/.exec(d.path), at = m ? def?.resources.findIndex(r => r.id === m[1]) ?? -1 : -1;
    return at >= 0 ? `resources.${at}.${/exceeds/.test(d.message) ? 'capacity' : 'kind'}` : F.keyOf(d);
   };
   const seen = new Set<string>(), entries = [...diagnostics.map(d => ({key: poolKey(d), message: d.message, path: d.path})), ...[...local].map(([key, message]) => ({key, message, path: '/' + key.replaceAll('.', '/')}))].filter(e => { const id = e.key + '|' + e.message; if (seen.has(id)) return false; seen.add(id); return true; });
   for (const e of entries) {
    let best: HTMLElement | undefined;
    for (const s of slots) { const k = s.dataset.errs!; if (k === '' ? false : k === e.key || e.key.startsWith(k + '.')) { if (!best || k.length > best.dataset.errs!.length) best = s; } }
    if (!best) { if (['steps', 'flows', ''].includes(e.key.split('.')[0]!)) { outside++; continue; } best = host.querySelector<HTMLElement>('#tune-err') ?? undefined; if (!best) continue; }
    const message = F.plain(e.message, host.querySelector(`[data-path="${CSS.escape(e.key)}"]`)); placed.set(best, [...placed.get(best) ?? [], message]);
    links.push({slot: best, key: e.key, text: `${root.LWProcessJsonPath.label(def, e.path)}: ${message}`});
   }
   for (const s of slots) { const html = (placed.get(s) ?? []).map(m => `<p class="de-err">${esc(m)}</p>`).join(''); if ((s.dataset.html ?? '') !== html) { s.dataset.html = html; s.innerHTML = html; } }
   const keys = entries.map(e => e.key);
   host.querySelectorAll<HTMLElement>('[data-path]').forEach(c => {
    const path = c.dataset.path!, bad = keys.some(k => k === path || k.split('.').length >= 3 && path.startsWith(k + '.'));
    if (bad) c.setAttribute('aria-invalid', 'true'); else c.removeAttribute('aria-invalid');
   });
   other = outside; const summary = host.querySelector<HTMLElement>('#tune-summary');
   if (summary) {
    const html = (links.length ? `<p><strong>${links.length} ${links.length === 1 ? 'problem' : 'problems'} in this form</strong></p><ul>${links.map((l, i) => `<li><a href="#" data-goto="${i}">${esc(l.text)}</a></li>`).join('')}</ul>` : '')
     + (outside ? `<p>${outside} more ${outside === 1 ? 'problem is' : 'problems are'} in steps, flows or other parts of the draft. <button type="button" class="de-link" data-act="show-json">Show them in Raw JSON</button></p>` : '');
    if ((summary.dataset.html ?? '') !== html) { summary.dataset.html = html; summary.innerHTML = html; }
    summary.querySelectorAll<HTMLAnchorElement>('a[data-goto]').forEach(a => { a.onclick = ev => { ev.preventDefault(); const l = links[Number(a.dataset.goto)]; const c = l ? controlOf(l.slot) : null; c?.scrollIntoView({block: 'center'}); c?.focus(); }; });
   }
  }
  function render(focus?: string): boolean {
   const def = parse(); if (!def) return false;
   let html: string; try { html = `<fieldset class="de-form">${markup(def)}</fieldset>`; } catch { return false; }
   if (html !== shown || !host.childElementCount) {
    const active = document.activeElement as HTMLElement | null, keep = active && host.contains(active) ? active.id : '', pane = host.closest<HTMLElement>('.de-pane'), top = pane?.scrollTop ?? 0;
    const caret = active instanceof HTMLInputElement && active.type === 'text' ? [active.selectionStart, active.selectionEnd] as const : null;
    shown = html; host.innerHTML = html; local.clear(); if (pane) pane.scrollTop = top;
    const target = focus ? host.querySelector<HTMLElement>(focus) : keep ? document.getElementById(keep) : null;
    if (target && host.contains(target)) { target.focus({preventScroll: true}); if (caret && target instanceof HTMLInputElement && !focus) target.setSelectionRange(caret[0], caret[1]); }
   }
   show(); return true;
  }
  function commit(def: LWProcess.Definition, focus?: string, rerender = false, label?: string): void {
   write(JSON.stringify(def, null, 2), label);
   // Plain value edits leave the typed text in place, so the stored markup is stale; forget it so the next refresh rebuilds from the draft.
   if (rerender) render(focus); else { shown = ''; show(); }
  }
  function edit(e: Event): void {
   const el = e.target as HTMLInputElement, kind = el.dataset?.kind, path = el.dataset?.path; if (!kind || !path) return;
   if (WAIT_FOR_CHANGE.has(kind) !== (e.type === 'change')) return;
   const def = parse(); if (!def) { render(); return; }
   const special = T.special(def, el) ?? C.special(def, el) ?? A.special(def, el);
   if (special) { if (special.local) { local.set(...special.local); show(); } else { local.delete(path); if (special.write) commit(def, special.focus, special.rerender); else show(); } return; }
   let value: unknown;
   if (kind === 'int') {
    const raw = el.value.trim();
    if (raw === '') { if (el.dataset.optional) value = undefined; else { local.set(path, el.validity?.badInput ? 'Enter a whole number.' : 'Enter a whole number; this field cannot be empty.'); show(); return; } }
    else if (!Number.isInteger(Number(raw))) { local.set(path, 'Enter a whole number.'); show(); return; }
    else value = Number(raw);
   } else if (kind === 'choice') value = el.value === 'people' && path.endsWith('.kind') ? undefined : el.value;
   else if (kind === 'scalar-type') { value = F.coerce(el.value, getPath(def, path) as LWProcess.Scalar | undefined, ''); local.delete(path); setPath(def, path, value); commit(def, '#' + el.id, true); return; }
   else if (kind === 'scalar') {
    const current = getPath(def, path);
    value = typeof current === 'boolean' ? el.value === 'true' : typeof current === 'number' ? (el.value.trim() !== '' && Number.isInteger(Number(el.value)) ? Number(el.value) : current) : el.value;
    if (typeof current === 'number' && !(el.value.trim() !== '' && Number.isInteger(Number(el.value)))) { local.set(path, 'Enter a whole number.'); show(); return; }
   } else value = el.value === '' && (path === 'description' || /^track\.\d+\.label$/.test(path) || P.isDetail(path)) ? undefined : el.value;
   local.delete(path); setPath(def, path, value); commit(def);
  }
  function click(e: MouseEvent): void {
   const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]'); if (!b || b.disabled) return;
   const what = b.dataset.act!; if (what === 'show-json') return;
   const def = parse(); if (!def) return;
   if (what === 'res-add') {
    let n = def.resources.length + 1; const ids = new Set(def.resources.map(r => r.id)); while (ids.has('resource-' + n)) n++;
    def.resources.push({id: 'resource-' + n, name: 'New resource', capacity: 1, costPerMinute: 0}); commit(def, `#tune-res-${def.resources.length - 1}-name`, true); return;
   }
   if (what === 'res-remove') { void removePool(def, Number(b.dataset.i)); return; }
   // A removed row is named after its button ('Remove arrival 2' becomes 'Removed arrival 2') so it can be undone by name.
   const result = T.act(def, b) ?? P.act(def, b) ?? A.act(def, b), named = (b.getAttribute('aria-label') ?? b.textContent ?? '').trim();
   if (result) commit(def, result.focus, result.rerender, /-remove$/.test(what) && /^Remove\b/.test(named) ? named.replace(/^Remove\b/, 'Removed') : undefined);
  }
  /** Removes a pool. While steps still demand it, asks first (Cancel is the default) and then clears those demands with it. */
  async function removePool(def: LWProcess.Definition, at: number): Promise<void> {
   const pool = def.resources[at]; if (!pool) return;
   const by = users(def, pool.id);
   if (by.length && confirm) {
    const one = by.length === 1;
    const question = `${list(by)} still ${one ? 'uses' : 'use'} ${pool.name}. Removing the pool also clears ${one ? 'that demand' : 'those demands'}.`;
    const choice = await confirm(question, [{id: 'keep-pool', label: 'Cancel', default: true}, {id: 'remove-pool', label: 'Remove and clear demands'}]);
    if (choice !== 'remove-pool') return;
    // The draft may have changed while the question was open: act on the current text.
    def = parse() ?? def; at = def.resources.findIndex(r => r.id === pool.id); if (at < 0) return;
   }
   def.resources.splice(at, 1);
   for (const s of def.steps) {
    if (!s.resources || !Object.hasOwn(s.resources, pool.id)) continue;
    delete s.resources[pool.id]; if (!Object.keys(s.resources).length) delete s.resources;
   }
   commit(def, '#tune-res-add', true, `Removed ${pool.name}`);
  }
  host.addEventListener('input', edit); host.addEventListener('change', edit); host.addEventListener('click', click);
  return {
   refresh: () => render(),
   setDiagnostics(list) { diagnostics = list; show(); return other; },
   setDisabled(disabled, reason) { const f = form(); if (f) f.disabled = disabled; host.dataset.disabled = disabled ? (reason ?? 'disabled') : ''; },
   focusField(path) { const c = path ? host.querySelector<HTMLElement>(`[data-path="${CSS.escape(path)}"]`) : host.querySelector<HTMLElement>('#tune-name'); (c ?? host.querySelector<HTMLElement>('#tune-name'))?.focus(); return !!c; },
   dispose() { host.removeEventListener('input', edit); host.removeEventListener('change', edit); host.removeEventListener('click', click); host.replaceChildren(); },
  };
 }
 root.LWProcessTuning = {create};
})(globalThis);
