/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-dom.ts" />
/// <reference path="./process-dialog.ts" />
/// <reference path="./process-draft.ts" />
/// <reference path="./process-recovery.ts" />
/// <reference path="./process-run-bar.ts" />
/**
 * Process slots of the studio shell: the Process selector, switching between processes, and adding a process (New process… and the
 * add half of Import). Owner of the slot-level user flows; the application controller owns the slots and their runs.
 *
 *  - Switching keeps every run: the run left behind is paused where it is and the chosen process's run comes back exactly
 *    (`LWProcessApp.Controller.use`), so nothing is discarded and nothing is asked. It never ticks. The status says where the run
 *    is ("Switched to X. Its run is at minute 120 (paused)."), and that a run seed stays with its process. The selector keeps focus.
 *    After a switch, a saved recovery draft of that process may be offered (LWProcessRecovery).
 *  - Unapplied drafts of processes left behind stay in the draft store; `unsaved()` counts them for the leave-page guard.
 *  - New process… (`#new-process` in the Export/⋯ menu) asks for a name in a small dialog built on LWProcessDialog (id 'np'; Cancel,
 *    Escape and Close create nothing), creates the starter definition (`LWProcessAuthoring.create`) with an id made from the name
 *    (`uniqueId`), adds it and switches to it. Import as a new process and the Add choice of the import question use `add()`, which
 *    renames a clashing id (`<id>-2`, `-3`, …) instead of refusing it. Both are disabled with the reason "A studio holds at most 8
 *    processes." once 8 processes are open (`aria-disabled`, so the reason stays reachable).
 * Nothing here ticks, retains a session or touches storage.
 */
declare namespace LWProcessSlots {
 interface Env {
  app: LWProcessApp.Controller;
  /** The studio root, made inert while the New process dialog is open. */
  host: HTMLElement;
  view(): LWProcessApp.View;
  draft: LWProcessDraft.Store;
  recovery: LWProcessRecovery.Surface;
  status(message: string, error?: boolean): void;
  /** Rebuilds the scene views for the newly active process and refreshes (never ticks). */
  reopen(): void;
  /** Called after the selector or the slot count changed (the Export menu hint follows). */
  changed(): void;
 }
 interface Surface {
  /** Re-synchronises the selector, the header subtitle and the New process items from the view. */
  sync(): void;
  /** Switches to a process (never ticks) and offers its saved recovery draft. */
  switchTo(index: number): Promise<void>;
  /** Adds a definition as a new process and switches to it; returns a note about a renamed id ('' when none). Throws when refused. */
  add(definition: unknown): string;
  /** '' while another process can be added, else the plain reason. */
  canAdd(): string;
  /** True while a process other than the active one holds an unapplied draft. */
  unsaved(): boolean;
  dispose(): void;
 }
 interface Api {
  create(env: Env): Surface;
  /** A process id made from `name` (lowercase letters, digits and hyphens, starting with a letter) that is not in `taken`. */
  uniqueId(name: string, taken: string[]): string;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessSlots?: LWProcessSlots.Api; LWProcessDom: LWProcessDom.Api; LWProcessDialog: LWProcessDialog.Api;
  LWProcessAuthoring: LWProcess.Authoring; LWProcessApplication: LWProcessApp.Api; LWProcessRunBar: LWProcessRunBar.Api};
 const get = <T extends HTMLElement = HTMLElement>(id: string) => root.LWProcessDom.must<T>(id);
 const esc = (v: unknown) => root.LWProcessDialog.escape(v);
 const FULL = 'A studio holds at most 8 processes.';
 function uniqueId(name: string, taken: string[]): string {
  const slug = name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^[^a-z]+|-+$/g, '').slice(0, 56).replace(/-+$/, '');
  const base = slug || 'process', used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
 }
 function create(env: LWProcessSlots.Env): LWProcessSlots.Surface {
  /** Processes left with an unapplied draft (the draft store keeps their text). */
  const away = new Set<number>();
  const canAdd = () => env.view().processes.length >= root.LWProcessApplication.MAX_PROCESSES ? FULL : '';
  function sync(): void {
   const view = env.view(), many = view.processes.length > 1, select = get<HTMLSelectElement>('process-switch');
   const names = view.processes.map(p => p.name);
   get('process-switch-label').hidden = !many;
   get('process-subtitle').textContent = 'Wildlands · Process Studio' + (many ? ` · Process ${view.active + 1} of ${view.processes.length}` : '');
   const full = canAdd();
   for (const id of ['new-process', 'import-new']) {
    const item = get(id);
    if (full) item.setAttribute('aria-disabled', 'true'); else item.removeAttribute('aria-disabled');
    item.title = full;
   }
   env.changed();
   if (!many) return;
   const label = (p: {id: string; name: string}) => names.filter(n => n === p.name).length > 1 ? `${p.name} (${p.id})` : p.name;
   const html = view.processes.map((p, i) => `<option value="${i}">${esc(label(p))}</option>`).join('');
   if (select.dataset.html !== html) { select.dataset.html = html; select.innerHTML = html; }
   select.value = String(view.active);
  }
  /** Where the run stands, in words: "at minute 0." or "at minute 120 (paused)." */
  function where(q: LWProcess.Snapshot): string {
   if (q.minute === 0) return 'at minute 0.';
   const stopped = ['completed', 'blocked', 'limit'].includes(q.status);
   return `at minute ${q.minute.toLocaleString()} (${stopped ? root.LWProcessRunBar.outcome(q) : 'paused'}).`;
  }
  async function switchTo(index: number): Promise<void> {
   const before = env.view();
   if (index === before.active) return;
   const seed = before.snapshot.seed, override = seed !== (before.definition.seed ?? 1);
   env.recovery.flush();
   if (env.draft.changed()) away.add(before.active); else away.delete(before.active);
   env.draft.leave(); env.app.use(index); away.delete(index); env.reopen();
   const view = env.view();
   const note = override && view.snapshot.seed !== seed ? ` Run seed ${seed} stays with ${before.definition.name}; this run uses seed ${view.snapshot.seed}.` : '';
   env.status(`Switched to ${view.definition.name}. Its run is ${where(view.snapshot)}${note}`);
   const select = get<HTMLSelectElement>('process-switch');
   await env.recovery.offer(select, () => get('process-switch'));
  }
  function add(definition: unknown): string {
   const full = canAdd(); if (full) throw Error(FULL);
   const copy = JSON.parse(JSON.stringify(definition)) as LWProcess.Definition, taken = env.view().processes.map(p => p.id);
   let note = '';
   if (copy && typeof copy === 'object' && typeof copy.id === 'string' && taken.includes(copy.id)) {
    const id = uniqueId(copy.id, taken); note = ` Its id is ${id} because ${copy.id} is already open.`; copy.id = id;
   }
   const index = env.app.add(copy);
   void switchTo(index);
   return note;
  }
  /** The New process dialog: a name field, Cancel (the default way out; nothing is created) and Create process. */
  let dialog: LWProcessDialog.Surface | null = null;
  function build(): LWProcessDialog.Surface {
   const d = root.LWProcessDialog.create(document.body, {
    id: 'np', size: 'list', title: 'New process', inertRoot: env.host,
    actions: [{id: 'cancel', label: 'Cancel', cancel: true}, {id: 'create', label: 'Create process', primary: true}],
    onAction: id => { if (id === 'create') createNamed(); },
   });
   const form = document.createElement('div'); form.className = 'np-form';
   form.innerHTML = '<label for="np-name">Process name</label><input id="np-name" type="text" maxlength="120" autocomplete="off" autofocus'
    + ' aria-describedby="np-help"><p id="np-help">The new process starts with three steps: Intake, Deliver work and Handover. Edit it with'
    + ' Edit process… afterwards.</p>';
   d.body.append(form);
   get<HTMLInputElement>('np-name').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); createNamed(); } });
   return d;
  }
  function createNamed(): void {
   const field = get<HTMLInputElement>('np-name'), name = field.value.trim();
   if (!name) { dialog!.setStatus('<p><strong>Enter a name for the new process.</strong></p>', 'alert'); field.focus(); return; }
   try {
    const id = uniqueId(name, env.view().processes.map(p => p.id));
    const index = env.app.add(root.LWProcessAuthoring.create(id, name));
    dialog!.close('action');
    void switchTo(index).then(() => env.status(`Created ${name} as a new process. Its run is paused at minute 0.`));
   } catch (e) {
    dialog!.setStatus(`<p><strong>${esc(root.LWProcessRunBar.plain(e))}</strong></p>`, 'alert');
   }
  }
  const shown = (n: HTMLElement | null) => !!n && n.getClientRects().length > 0;
  const trigger = () => [get('export-menu'), get('more-menu')].find(shown) ?? null;
  get('new-process').onclick = () => {
   const full = canAdd(); if (full) { env.status(FULL, true); return; }
   dialog ??= build();
   get<HTMLInputElement>('np-name').value = ''; dialog.setStatus('');
   if (!dialog.open({invoker: trigger(), focusFallback: trigger})) env.status('Close the open window first.', true);
  };
  get<HTMLSelectElement>('process-switch').onchange = () => {
   switchTo(Number(get<HTMLSelectElement>('process-switch').value)).catch(e => { sync(); env.status(root.LWProcessRunBar.plain(e), true); });
  };
  return {
   sync, switchTo, add, canAdd,
   unsaved: () => away.size > 0,
   dispose() { dialog?.dispose(); dialog = null; },
  };
 }
 root.LWProcessSlots = {create, uniqueId};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessSlots;
})(globalThis);
