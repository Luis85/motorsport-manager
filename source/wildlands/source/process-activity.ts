/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-dialog.ts" />
/// <reference path="./process-html.ts" />
/**
 * Run activity for Process Studio: the event feed tracker, a polite batched announcer and the Activity modal, built on the shared
 * LWProcessDialog (id 'act', size 'list'). It only reads detached views the studio hands to `ingest`; it never ticks, pauses or
 * retains the simulation, and it never touches the draft or storage.
 *
 * The engine keeps its latest 128 events in a sliding window without sequence numbers, so the tracker numbers them itself: every
 * `ingest` finds how far the new window overlaps the previous one and counts only the appended events. That gives the opener's
 * badge (problems not yet shown in the modal: failed work, blocked work and dropped arrivals; routine events never raise it), the
 * "latest N of M" subtitle and the "N new events" pill. If more than a whole window arrives between two ingests the exact count is
 * a lower bound and the list says earlier events are not kept.
 *
 * Live behaviour while the modal is open: the list re-renders on a pulse only when it is scrolled to the top and no filter or row
 * control has focus. Otherwise it freezes and a status pill "N new events - Show" re-renders on request. The list itself is never
 * a live region; the separate announcer says at most one batched sentence every five seconds, and failures, blocked work and
 * dropped arrivals immediately.
 *
 * Each process slot keeps its own tracker (its retained rows, the counts above and what the modal already showed). `slot(index)`
 * puts the active one aside and restores the chosen slot's, or starts empty for a slot not seen before, so switching back to a kept
 * run restores its feed silently: the restored events are not counted again, the badge shows only that run's unseen problems and
 * nothing is announced. Pending announcements of the slot left behind are dropped. `reset()` forgets the active slot's tracker only.
 *
 * Markup is built with LWProcessHtml's `html` template, so every case id, step name, event kind and detail is escaped.
 */
declare namespace LWProcessActivity {
 interface Env {
  /** The detached view of the running process, read whenever the list renders or exports. */
  view(): LWProcessApp.View;
  /** The element made inert while the modal is open (the studio root). */
  inertRoot: HTMLElement;
  /** A visually hidden polite live region for the batched announcements. */
  announcer: HTMLElement;
  /** Selects a step in the studio. A command, never a tick. */
  select(stepId: string): void;
  /** The element that receives focus after a step was chosen in the list. */
  stepItem(stepId: string): HTMLElement | null;
  /** Called whenever the number of problem events (failed, blocked, dropped arrival) not yet shown changes. */
  badge(problems: number): void;
  save(name: string, data: string, type: string): void;
 }
 interface Surface {
  /** Feeds the tracker (and the open list) after every studio refresh. */
  ingest(view: LWProcessApp.View): void;
  open(invoker?: HTMLElement | null): boolean;
  isOpen(): boolean;
  /** Events appended since the modal last showed them. */
  unseen(): number;
  /** Problem events (failed, blocked, dropped arrival) appended since the modal last showed them. */
  problems(): number;
  /** 'Latest: 120 min · case-0007 · failed · Quality review', or '' without events. */
  latest(): string;
  /** Forgets the active slot's tracker (a new run started). */
  reset(): void;
  /** Keeps the active slot's tracker and restores the tracker of process slot `index` (empty when new); announces nothing. */
  slot(index: number): void;
  dispose(): void;
 }
 interface Api {
  create(host: HTMLElement, env: Env): Surface;
  /** Plain wording of an engine event kind: 'finished-task' becomes 'finished task', 'held' becomes 'blocked'. */
  kindText(kind: string): string;
  /** The largest unseen-problem count the opener badge shows as a number; more reads as `${MAX_BADGE}+`. */
  MAX_BADGE: number;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessDialog: LWProcessDialog.Api; LWProcessActivity?: LWProcessActivity.Api; LWProcessTerms: LWProcessTerms.Api;
  LWProcessHtml: LWProcessHtml.Api};
 const {html, join} = root.LWProcessHtml;
 const KIND: Record<string, string> = {
  arrived: 'arrived', 'arrival-dropped': 'arrival dropped', entered: 'entered', started: 'started', 'finished-task': 'finished task',
  'timer-started': 'timer started', 'timer-fired': 'timer fired', routed: 'routed', joined: 'joined', backlogged: 'backlogged',
  pulled: 'pulled in', held: 'blocked', completed: 'completed', failed: 'failed',
 };
 const ORDER = Object.keys(KIND), URGENT = new Set(['failed', 'held', 'arrival-dropped']), NO_STEP = '__none', BATCH_MS = 5000, MAX_BADGE = 99;
 const kindText = (kind: string) => KIND[kind] ?? kind.replaceAll('-', ' ');
 const keyOf = (e: LWProcess.Event) => `${e.minute}|${e.kind}|${e.caseId}|${e.stepId}|${e.detail}`;
 const num = (n: number) => Number(n.toFixed(1)).toLocaleString();
 const stepName = (d: LWProcess.Definition, id: string) => d.steps.find(s => s.id === id)?.name ?? '';
 /** The readable detail of an event: a timer's due minute, why an arrival was dropped, which route was taken. */
 function detailText(d: LWProcess.Definition, e: LWProcess.Event): string {
  if (e.kind === 'timer-started') return e.detail.startsWith('due ') ? 'Timer due minute ' + e.detail.slice(4) : e.detail;
  if (e.kind === 'arrival-dropped') return 'Arrival dropped: ' + (e.detail || 'system full');
  if (e.kind === 'routed') {
   const f = d.flows.find(x => x.id === e.detail);
   if (f?.label) return 'Route: ' + f.label;
   return e.detail ? 'Route ' + e.detail : '';
  }
  if (e.kind === 'pulled') return e.detail ? 'Pulled into ' + (stepName(d, e.detail) || e.detail) : '';
  return e.detail;
 }
 const sentence = (d: LWProcess.Definition, e: LWProcess.Event) => `${e.caseId} ${kindText(e.kind)} ${stepName(d, e.stepId) || e.detail}`.trim();
 /** Spreadsheet-safe CSV: RFC 4180 quoting, and text that a spreadsheet would run as a formula gets a leading apostrophe. */
 function cell(v: string | number): string {
  const s = String(v), safe = typeof v === 'string' && /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  return /[",\r\n]/.test(safe) ? '"' + safe.replaceAll('"', '""') + '"' : safe;
 }
 /** The filter controls, the new-events pill, the truncation note and the empty events table of the Activity modal. */
 const CONTROLS = `<div class="act-controls" role="group" aria-label="Filter events">
    <label>Kind <select id="act-kind"></select></label><label>Step <select id="act-step"></select></label>`
  + `<label><span id="act-case-label">Case</span> <select id="act-case"></select></label>`
  + `<button type="button" id="act-clear" hidden>Clear filters</button></div>
   <div class="act-live" role="status"><button type="button" id="act-new" class="act-pill" hidden></button></div>
   <p class="act-note" id="act-note" hidden>Earlier events are not kept. The run holds its latest 128 events; the metrics cover the whole run.</p>
   <div class="act-scroll" id="act-scroll" tabindex="0" role="region" aria-label="Events, newest first">
    <table class="act-table" role="table" aria-label="Run events, newest first"><thead role="rowgroup"><tr role="row">`
  + `<th role="columnheader" scope="col">Minute</th><th role="columnheader" scope="col" id="act-col-case">Case</th>`
  + `<th role="columnheader" scope="col">Event</th><th role="columnheader" scope="col">Step</th>`
  + `<th role="columnheader" scope="col">Detail</th></tr></thead><tbody id="act-rows" role="rowgroup"></tbody></table></div>`;
 /** One event as a table row, newest first; problem kinds are marked, and a step name is a button that selects the step. */
 function eventRow(d: LWProcess.Definition, e: LWProcess.Event): LWProcessHtml.Safe {
  const step = stepName(d, e.stepId), tone = URGENT.has(e.kind) ? html` class="act-bad"` : '';
  const stepCell = step ? html`<button type="button" class="act-step" data-act-step="${e.stepId}">${step}</button>` : '—';
  return join([
   html`<tr role="row"${tone}><td role="cell" data-label="Minute">${num(e.minute)}</td>`,
   html`<td role="cell" data-label="${root.LWProcessTerms.of(d).One}">${e.caseId}</td>`,
   html`<td role="cell" data-label="Event">${kindText(e.kind)}</td><td role="cell" data-label="Step">${stepCell}</td>`,
   html`<td role="cell" data-label="Detail">${detailText(d, e)}</td></tr>`,
  ]);
 }
 type Row = {seq: number; event: LWProcess.Event};
 function create(host: HTMLElement, env: LWProcessActivity.Env): LWProcessActivity.Surface {
  let rows: Row[] = [], keys: string[] = [], total = 0, seen = 0, rendered = 0, lastMinute = 0, pending = 0;
  let newest: LWProcess.Event | undefined, spoke = -Infinity;
  let speak = 0, signature = '';
  /** Problem events (URGENT kinds) counted like `total`, `seen` and `rendered`; only these raise the opener badge. */
  let urgentTotal = 0, urgentSeen = 0, urgentRendered = 0;
  const filter = {kind: '', step: '', caseId: ''};
  const dialog = root.LWProcessDialog.create(host.ownerDocument.body, {
   id: 'act', size: 'list', title: 'Run activity', inertRoot: env.inertRoot, closeLabel: 'Close',
   actions: [{id: 'csv', label: 'Export CSV'}, {id: 'json', label: 'Export JSON'}, {id: 'done', label: 'Close', cancel: true}],
   onAction: id => { if (id === 'csv' || id === 'json') exportRows(id); },
   onClose: reason => {
    seen = rendered;
    urgentSeen = urgentRendered;
    q('rows').innerHTML = '';
    signature = '';
    env.badge(problems());
    if (reason === 'action' && chosen) {
     const id = chosen;
     chosen = '';
     env.stepItem(id)?.focus();
    }
   },
  });
  let chosen = '';
  dialog.el.classList.add('act-dialog');
  dialog.body.insertAdjacentHTML('beforeend', CONTROLS);
  const q = <T extends HTMLElement = HTMLElement>(id: string) => dialog.el.querySelector<T>('#act-' + id)!;
  const unseen = () => total - seen, problems = () => urgentTotal - urgentSeen;
  const stepMatches = (e: LWProcess.Event) => !filter.step || (filter.step === NO_STEP ? e.stepId === '' : e.stepId === filter.step);
  const filtered = () => rows.filter(r => (!filter.kind || r.event.kind === filter.kind) && stepMatches(r.event)
   && (!filter.caseId || r.event.caseId === filter.caseId));
  const active = () => !!(filter.kind || filter.step || filter.caseId);
  /** True when a live re-render would not disturb the reader: the list is at its top and no filter or row control has focus. */
  const calm = () => q('scroll').scrollTop <= 1 && !q('rows').contains(document.activeElement)
   && !dialog.el.querySelector('.act-controls')!.contains(document.activeElement);
  function options(select: HTMLSelectElement, all: string, entries: [string, string][], value: string): void {
   const sig = JSON.stringify([all, entries, value]);
   if (select.dataset.sig !== sig) {
    select.dataset.sig = sig;
    select.innerHTML = String(html`<option value="">${all}</option>${entries.map(([v, l]) => html`<option value="${v}">${l}</option>`)}`);
    select.value = value;
   }
  }
  /** Event kinds in the engine's order, unknown kinds last in alphabetical order. */
  const rank = (kind: string) => ORDER.indexOf(kind) + 1 || 99;
  function controls(d: LWProcess.Definition): void {
   const kinds = [...new Set(rows.map(r => r.event.kind))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
   if (filter.kind && !kinds.includes(filter.kind)) kinds.push(filter.kind);
   const ids = new Set(rows.map(r => r.event.stepId));
   const steps: [string, string][] = d.steps.filter(s => ids.has(s.id) || s.id === filter.step).map(s => [s.id, s.name]);
   if (ids.has('') || filter.step === NO_STEP) steps.push([NO_STEP, 'No step']);
   const cases = [...new Set(rows.map(r => r.event.caseId))].sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));
   if (filter.caseId && !cases.includes(filter.caseId)) cases.push(filter.caseId);
   options(q<HTMLSelectElement>('kind'), 'All kinds', kinds.map(k => [k, kindText(k)]), filter.kind);
   options(q<HTMLSelectElement>('step'), 'All steps', steps, filter.step);
   const t = root.LWProcessTerms.of(d);
   for (const id of ['case-label', 'col-case']) if (q(id).textContent !== t.One) q(id).textContent = t.One;
   options(q<HTMLSelectElement>('case'), 'All ' + t.many, cases.map(c => [c, c]), filter.caseId);
   q('clear').hidden = !active();
  }
  function pill(): void {
   const n = total - rendered, b = q('new'), text = n > 0 ? `${n} new event${n === 1 ? '' : 's'} — Show` : '';
   if (b.textContent !== text) b.textContent = text;
   b.hidden = n <= 0;
  }
  /** Draws the list. A live call (not `force`) is skipped, leaving the pill, unless the reader is not mid-task. */
  function render(force: boolean): void {
   if (!dialog.isOpen()) return;
   if (!force && !calm()) {
    pill();
    return;
   }
   const view = env.view(), d = view.definition, shown = filtered(), truncated = total > rows.length;
   rendered = total;
   seen = total;
   urgentRendered = urgentSeen = urgentTotal;
   env.badge(0);
   controls(d);
   const count = truncated ? `showing the latest ${rows.length} of ${total} events` : `${total} ${total === 1 ? 'event' : 'events'}`;
   dialog.setTitle('Run activity', `Minute ${num(view.snapshot.minute)} · ${count}${active() ? ` · ${shown.length} match` : ''}`);
   q('note').hidden = !truncated;
   const empty = rows.length
    ? html`No events match these filters. <button type="button" class="act-link" data-act-clear>Clear filters</button>`
    : 'No events yet. Run the simulation.';
   const markup = shown.length
    ? [...shown].reverse().map(({event: e}) => eventRow(d, e)).join('')
    : String(html`<tr role="row"><td role="cell" colspan="5" class="act-empty">${empty}</td></tr>`);
   if (markup !== signature) {
    signature = markup;
    q('rows').innerHTML = markup;
   }
   if (force) q('scroll').scrollTop = 0;
   const none = {disabled: true, reason: 'There are no events to export.'};
   for (const id of ['csv', 'json']) dialog.setActionState(id, shown.length ? {disabled: false} : none);
   pill();
  }
  function exportRows(kind: 'csv' | 'json'): void {
   const view = env.view(), d = view.definition, shown = filtered(), name = d.id + '.events.' + kind;
   if (kind === 'json') {
    const events = shown.map(({event: e}) => ({minute: e.minute, case: e.caseId, event: e.kind, stepId: e.stepId, step: stepName(d, e.stepId),
     detail: e.detail}));
    const document = {format: 'wildlands-process-events', schemaVersion: 1, process: d.id, seed: view.snapshot.seed, minute: view.snapshot.minute,
     eventsSeen: total, eventsRetained: rows.length, filters: {...filter}, order: 'oldest first', events};
    env.save(name, JSON.stringify(document, null, 2), 'application/json');
   } else {
    const line = (e: LWProcess.Event) => [e.minute, cell(e.caseId), cell(e.kind), cell(e.stepId), cell(stepName(d, e.stepId)), cell(e.detail)].join(',');
    const lines = ['minute,case,event,step_id,step,detail', ...shown.map(({event: e}) => line(e))];
    env.save(name, lines.join('\r\n') + '\r\n', 'text/csv');
   }
  }
  function say(text: string): void {
   spoke = performance.now();
   pending = 0;
   env.announcer.textContent = text;
  }
  function flush(): void {
   speak = 0;
   if (pending > 0 && newest) say(`${pending} new event${pending === 1 ? '' : 's'}, latest: ${sentence(env.view().definition, newest)}`);
  }
  function announce(added: LWProcess.Event[], d: LWProcess.Definition): void {
   const urgent = added.filter(e => URGENT.has(e.kind)), rest = added.length - urgent.length;
   if (urgent.length) say(urgent.length === 1 ? sentence(d, urgent[0]!) : `${urgent.length} problems, latest: ${sentence(d, urgent.at(-1)!)}`);
   if (rest > 0) {
    pending += rest;
    newest = added.filter(e => !URGENT.has(e.kind)).at(-1);
   }
   if (pending > 0 && !speak) {
    const wait = Math.max(0, spoke + BATCH_MS - performance.now());
    if (wait === 0) flush();
    else speak = window.setTimeout(flush, wait);
   }
  }
  function wipe(): void {
   rows = [];
   keys = [];
   total = 0;
   seen = 0;
   urgentTotal = 0;
   urgentSeen = 0;
   urgentRendered = 0;
   rendered = 0;
   lastMinute = 0;
   pending = 0;
   newest = undefined;
   signature = '';
   window.clearTimeout(speak);
   speak = 0;
   env.announcer.textContent = '';
  }
  function ingest(view: LWProcessApp.View): void {
   const events = view.snapshot.events, next = events.map(keyOf);
   if (view.snapshot.minute < lastMinute) wipe();
   lastMinute = view.snapshot.minute;
   let added = next.length;
   if (keys.length && next.length === keys.length && next[0] === keys[0] && next.at(-1) === keys.at(-1)) added = 0;
   else if (keys.length) for (let s = 0; s <= keys.length; s++) {
    const overlap = keys.length - s; if (overlap > next.length) continue;
    if (overlap === 0 || keys.slice(s).every((k, i) => k === next[i])) { added = next.length - overlap; break; }
   }
   total += added; keys = next; rows = events.map((event, i) => ({seq: total - events.length + 1 + i, event}));
   if (added > 0) {
    const fresh = events.slice(events.length - added); urgentTotal += fresh.filter(e => URGENT.has(e.kind)).length; announce(fresh, view.definition);
   }
   env.badge(problems()); render(false);
  }
  /** The trackers of the slots left behind, by slot index; the active slot's tracker lives in the variables above. */
  type Kept = {rows: Row[]; keys: string[]; total: number; seen: number; rendered: number; lastMinute: number; urgent: [number, number, number]};
  const kept = new Map<number, Kept>();
  let slotIndex = -1;
  function slot(index: number): void {
   if (index === slotIndex) return;
   if (slotIndex >= 0) kept.set(slotIndex, {rows, keys, total, seen, rendered, lastMinute, urgent: [urgentTotal, urgentSeen, urgentRendered]});
   slotIndex = index; wipe(); filter.kind = filter.step = filter.caseId = '';
   const back = kept.get(index);
   if (back) {
    ({rows, keys, total, seen, rendered, lastMinute} = back);
    [urgentTotal, urgentSeen, urgentRendered] = back.urgent;
   }
   env.badge(problems());
  }
  dialog.body.addEventListener('change', e => {
   const t = e.target as HTMLSelectElement;
   if (t.id === 'act-kind') filter.kind = t.value;
   else if (t.id === 'act-step') filter.step = t.value;
   else if (t.id === 'act-case') filter.caseId = t.value;
   else return;
   render(true);
  });
  dialog.body.addEventListener('click', e => {
   const t = e.target as HTMLElement, step = t.closest<HTMLElement>('[data-act-step]');
   if (t.closest('#act-new')) {
    render(true);
    q('new').blur();
    q('scroll').focus({preventScroll: true});
   } else if (t.closest('#act-clear') || t.closest('[data-act-clear]')) {
    filter.kind = filter.step = filter.caseId = '';
    render(true);
    q('kind').focus();
   } else if (step) {
    chosen = step.dataset.actStep!;
    env.select(chosen);
    dialog.close('action');
   }
  });
  return {
   ingest, slot, isOpen: () => dialog.isOpen(), unseen, problems,
   open(invoker) { if (!dialog.open({invoker: invoker ?? null})) return false; render(true); return true; },
   latest() {
    const e = rows.at(-1)?.event;
    if (!e) return '';
    const step = stepName(env.view().definition, e.stepId);
    return `Latest: ${num(e.minute)} min · ${e.caseId} · ${kindText(e.kind)}${step ? ' · ' + step : ''}`;
   },
   reset() { wipe(); filter.kind = filter.step = filter.caseId = ''; env.badge(0); },
   dispose() { window.clearTimeout(speak); dialog.dispose(); },
  };
 }
 root.LWProcessActivity = {create, kindText, MAX_BADGE};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessActivity;
})(globalThis);
