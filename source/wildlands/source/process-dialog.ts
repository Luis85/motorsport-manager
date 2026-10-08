/// <reference path="./process-contracts.d.ts" />
/**
 * Shared modal dialog shell for Process Studio (step editor today; Definition and Activity editors later).
 * It owns every cross-cutting dialog behaviour so each editor only supplies content:
 *  - a native `<dialog>` opened with showModal, a Tab/Shift+Tab focus trap, `inert` on the studio root, body scroll lock;
 *  - ONE dirty guard: Escape, the header Close button, a `cancel` footer action and a backdrop click all call
 *    `requestClose(source)`. A clean dialog closes at once; a dirty one (`isDirty()` true) shows the in-footer confirm
 *    "Keep editing / Discard changes", which starts on Keep editing. Escape or a backdrop click while a confirm is
 *    showing chooses the confirm's `escape` choice (its default), so the guard can never discard by accident;
 *  - focus on open: the first `[autofocus]` control in the body, else the Close button (read-only dialogs focus the
 *    heading, which has tabindex -1); focus returns to the invoker on close, or to `focusFallback()` when the invoker was
 *    removed or hidden;
 *  - one modal at a time: `open()` returns false while another dialog of this module is open (no stacking). The caller
 *    should close the first dialog (`requestClose`) and open the next from its `onClose`;
 *  - sticky header and footer, a scrolling body whose position survives re-render (`preserveScroll`), size variants
 *    (`form` 760px, `wide` 1000px with a `.pd-split` two-column grid, `list` 640px) and a full-screen sheet with stacked
 *    full-width footer buttons at 650px and below. Motion is only used under prefers-reduced-motion: no-preference.
 *
 * Layout, from the top: header (title, subtitle, chip, meta, Close) / banner (sticky notice, hidden when empty) /
 * body (scrolls; its FIRST child is the reserved status region, so append content AFTER it) / footer (reason, confirm, actions).
 * Element ids derive from the dialog id: `${id}-title`, `-subtitle`, `-chip`, `-meta`, `-close`, `-banner`, `-body`,
 * `-status`, `-reason`, `-confirm`, `-confirm-title`, `-buttons`, one `-${actionId}` per footer action and one
 * `-${choiceId}` per confirm choice. All HTML strings passed to setBanner/setStatus must already be escaped (`escape`).
 * The dialog never touches simulation, draft or storage; it only reports intent through callbacks.
 */
declare namespace LWProcessDialog {
 type Size = 'form' | 'wide' | 'list';
 type CloseReason = 'close' | 'escape' | 'backdrop' | 'cancel' | 'discard' | 'action' | 'programmatic' | 'dispose';
 /** A footer button. `cancel` actions route through the dirty guard instead of calling onAction. */
 interface Action {id: string; label: string; primary?: boolean; cancel?: boolean; disabled?: boolean; reason?: string}
 interface Choice {id: string; label: string; default?: boolean}
 interface ConfirmOptions {
  /** Choice selected by Escape or a backdrop click while the confirm shows. Defaults to the default choice. */
  escape?: string;
 }
 interface Options {
  /** Unique element-id prefix, e.g. 'se'. */
  id: string;
  size: Size;
  title: string;
  subtitle?: string;
  /** Short label shown as a pill beside the title, e.g. the step kind. */
  chip?: string;
  /** Small monospace text after the chip, e.g. an identifier. */
  meta?: string;
  actions: Action[];
  /** Label of the header close button (default 'Close'). */
  closeLabel?: string;
  /** Read-only dialogs focus their heading on open instead of a control. */
  readOnly?: boolean;
  /** The element made inert while open (normally the studio root). */
  inertRoot?: HTMLElement | null;
  /** True when closing would lose edits. Consulted by every close path. */
  isDirty?(): boolean;
  /** Text of the discard confirm. */
  discardMessage?(): string;
  /** A non-cancel footer action was activated. The dialog does not close by itself; call close('action'). */
  onAction(id: string): void;
  /** Fired once after the dialog has closed, with the path that closed it. */
  onClose?(reason: CloseReason): void;
 }
 interface OpenOptions {
  title?: string; subtitle?: string; chip?: string; meta?: string;
  /** Receives focus again on close. Defaults to the element focused when open() is called. */
  invoker?: HTMLElement | null;
  /** Used when the invoker is gone or hidden at close time. */
  focusFallback?: () => HTMLElement | null;
 }
 interface Surface {
  readonly el: HTMLDialogElement;
  /** The scrolling body. Its first child is the status region; append editor content after it. */
  readonly body: HTMLElement;
  /** Opens the dialog; false when another dialog is open or this one already is. */
  open(options?: OpenOptions): boolean;
  /** Closes without consulting the dirty guard. */
  close(reason?: CloseReason): void;
  isOpen(): boolean;
  /** The single guarded close path used by Escape, Close, Cancel and the backdrop. */
  requestClose(source?: CloseReason): void;
  /** Updates the heading. An omitted argument keeps its text; an empty string clears it. */
  setTitle(title: string, subtitle?: string, chip?: string, meta?: string): void;
  /** Shows a sticky notice under the header; null or '' hides it. */
  setBanner(html: string | null, tone?: 'info' | 'warn'): void;
  /** Replaces the footer buttons. */
  setFooter(actions: Action[]): void;
  /** Enables or disables one footer button. Disabled reasons are listed in the footer and referenced with aria-describedby. */
  setActionState(id: string, state: {disabled: boolean; reason?: string}): void;
  /** Writes the status region (a live region). '' empties it. `role` is 'status' (polite) or 'alert' (assertive). */
  setStatus(html: string, role?: 'status' | 'alert'): void;
  /** Shows an in-footer confirm in place of the actions. Resolves with the chosen choice id. */
  confirm(message: string, choices: Choice[], options?: ConfirmOptions): Promise<string>;
  /** Runs `change`, then restores the body's scroll position. */
  preserveScroll(change: () => void): void;
  dispose(): void;
 }
 interface Api {
  create(host: HTMLElement, options: Options): Surface;
  /** The open dialog, if any. */
  active(): Surface | null;
  escape(value: unknown): string;
  /**
   * The one "apply over a run in progress" question of every editor: resolves true at once for a run at minute 0, otherwise shows the
   * in-footer confirm (Back first and default, then Apply and reset) and resolves true only for Apply and reset while `dialog` is still open.
   */
  confirmApplyOverRun(dialog: Surface, run: {minute: number; cases: number}): Promise<boolean>;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessDialog?: LWProcessDialog.Api};
 const esc = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
 const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], summary, [tabindex]:not([tabindex="-1"])';
 const visible = (n: HTMLElement | null): n is HTMLElement => !!n && n.isConnected && n.getClientRects().length > 0 && !n.closest('[hidden]') && !(n as HTMLButtonElement).disabled;
 let current: LWProcessDialog.Surface | null = null;
 function create(host: HTMLElement, o: LWProcessDialog.Options): LWProcessDialog.Surface {
  const id = o.id, dlg = document.createElement('dialog');
  dlg.className = `pd-dialog pd-${o.size}`; dlg.setAttribute('aria-labelledby', id + '-title'); dlg.setAttribute('aria-describedby', id + '-subtitle');
  dlg.innerHTML = `<div class="pd-head"><div class="pd-heading"><h2 id="${id}-title" tabindex="-1"></h2><p class="pd-subtitle" id="${id}-subtitle"></p><p class="pd-meta"><span class="pd-chip" id="${id}-chip"></span> <code id="${id}-meta"></code></p></div>
   <button type="button" class="pd-close" id="${id}-close"><span aria-hidden="true">×</span> ${esc(o.closeLabel ?? 'Close')}</button></div>
   <div class="pd-banner" id="${id}-banner" hidden></div>
   <div class="pd-body" id="${id}-body"><div class="pd-status" id="${id}-status" role="status"></div></div>
   <div class="pd-foot"><p class="pd-reason" id="${id}-reason"></p><div class="pd-confirm" id="${id}-confirm" role="alertdialog" aria-labelledby="${id}-confirm-title" hidden><p id="${id}-confirm-title"></p><div class="pd-actions" id="${id}-choices"></div></div><div class="pd-actions pd-buttons" id="${id}-buttons"></div></div>`;
  host.append(dlg);
  const q = <T extends HTMLElement = HTMLElement>(suffix: string) => dlg.querySelector<T>('#' + id + '-' + suffix)!;
  const body = q('body'), confirmBox = q('confirm'), buttons = q('buttons');
  let actions: LWProcessDialog.Action[] = o.actions.map(a => ({...a})), opened = false, invoker: HTMLElement | null = null, fallback: (() => HTMLElement | null) | undefined, escaped = false, escapedAt = -1e9, downOnBackdrop = false, lastFocus: HTMLElement | null = null;
  let pending: {resolve: (id: string) => void; escape: string; from: HTMLElement | null} | null = null, saved = '';
  const text = (suffix: string, value: string | undefined) => { if (value === undefined) return; const n = q(suffix); if (n.textContent !== value) n.textContent = value; n.hidden = value === ''; };
  const setTitle = (title: string, subtitle?: string, chip?: string, meta?: string) => { q('title').textContent = title; text('subtitle', subtitle); text('chip', chip); text('meta', meta); };
  function renderFooter(): void {
   buttons.innerHTML = actions.map(a => `<button type="button" id="${id}-${esc(a.id)}" data-pd-action="${esc(a.id)}"${a.primary ? ' class="primary"' : ''}${a.disabled ? ' disabled' : ''} aria-describedby="${id}-reason">${esc(a.label)}</button>`).join('');
   const reasons = [...new Set(actions.filter(a => a.disabled && a.reason).map(a => a.reason!))]; q('reason').textContent = reasons.join(' ');
  }
  function settle(choice: string, refocus = true): void {
   const p = pending; if (!p) return; pending = null; confirmBox.hidden = true; buttons.hidden = false;
   if (refocus) (visible(p.from) && dlg.contains(p.from) ? p.from : buttons.querySelector<HTMLElement>('button:not([disabled])') ?? q('close')).focus();
   p.resolve(choice);
  }
  function confirm(message: string, choices: LWProcessDialog.Choice[], options: LWProcessDialog.ConfirmOptions = {}): Promise<string> {
   if (pending) settle(pending.escape, false);
   const first = choices.find(c => c.default) ?? choices[0]!, active = document.activeElement as HTMLElement | null;
   q('confirm-title').textContent = message;
   q('choices').innerHTML = choices.map(c => `<button type="button" id="${id}-${esc(c.id)}" data-pd-choice="${esc(c.id)}"${c.default ? ' class="primary"' : ''}>${esc(c.label)}</button>`).join('');
   confirmBox.hidden = false; buttons.hidden = true; q<HTMLElement>(first.id).focus();
   return new Promise(resolve => { pending = {resolve, escape: options.escape ?? first.id, from: active && dlg.contains(active) && active !== q(first.id) ? active : null}; });
  }
  function close(reason: LWProcessDialog.CloseReason = 'programmatic'): void {
   if (!opened) return;
   if (pending) settle(pending.escape, false);
   opened = false; if (dlg.open) dlg.close();
   if (o.inertRoot) o.inertRoot.inert = false;
   document.documentElement.classList.remove('pd-locked'); if (current === surface) current = null;
   const target = visible(invoker) ? invoker : fallback?.() ?? null; invoker = null; target?.focus();
   o.onClose?.(reason);
  }
  function requestClose(source: LWProcessDialog.CloseReason = 'close'): void {
   if (!opened) return;
   if (pending) { settle(pending.escape); return; }
   if (!o.isDirty?.()) { close(source); return; }
   void confirm(o.discardMessage?.() ?? 'Discard your changes?', [{id: 'keep', label: 'Keep editing', default: true}, {id: 'discard', label: 'Discard changes'}]).then(choice => { if (choice === 'discard') close('discard'); });
  }
  renderFooter();
  const outside = (e: MouseEvent) => { const r = dlg.getBoundingClientRect(); return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom; };
  dlg.addEventListener('pointerdown', e => { downOnBackdrop = e.target === dlg && outside(e); });
  dlg.addEventListener('click', e => {
   const t = e.target as HTMLElement;
   if (t === dlg) { if (downOnBackdrop && outside(e)) requestClose('backdrop'); downOnBackdrop = false; return; }
   const choice = t.closest<HTMLButtonElement>('button[data-pd-choice]'), action = t.closest<HTMLButtonElement>('button[data-pd-action]');
   if (choice) settle(choice.dataset.pdChoice!);
   else if (t.closest(`#${id}-close`)) requestClose('close');
   else if (action && !action.disabled) { const a = actions.find(x => x.id === action.dataset.pdAction); if (a?.cancel) requestClose('cancel'); else o.onAction(action.dataset.pdAction!); }
  });
  dlg.addEventListener('keydown', e => {
   if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); escaped = true; escapedAt = performance.now(); setTimeout(() => { escaped = false; }, 0); requestClose('escape'); return; }
   if (e.key !== 'Tab') return;
   const list = [...dlg.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(n => n.getClientRects().length > 0 && !n.closest('[hidden]'));
   if (!list.length) { e.preventDefault(); return; }
   const first = list[0]!, last = list.at(-1)!, at = document.activeElement;
   if (e.shiftKey && (at === first || !dlg.contains(at))) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && (at === last || !dlg.contains(at))) { e.preventDefault(); first.focus(); }
  });
  dlg.addEventListener('cancel', e => { e.preventDefault(); if (!escaped) requestClose('escape'); });
  // Chrome's close watcher can close a modal natively on a repeated Escape without a cancelable `cancel` event. Treat that as the
  // same intent: a dirty or confirming dialog is shown again (so the guard still decides); a clean one closes normally.
  dlg.addEventListener('focusin', e => { lastFocus = e.target as HTMLElement; });
  dlg.addEventListener('close', () => {
   // A queued `close` event from an earlier close can arrive after the dialog was reopened; the dialog is open again then, so ignore it.
   if (!opened || dlg.open) return;
   const echo = performance.now() - escapedAt < 250;
   if (!echo && !pending && !o.isDirty?.()) { close('escape'); return; }
   dlg.showModal(); (lastFocus?.isConnected && dlg.contains(lastFocus) ? lastFocus : q('close')).focus();
   if (!echo) { if (pending) settle(pending.escape); else requestClose('escape'); }
  });
  const surface: LWProcessDialog.Surface = {
   el: dlg, body,
   open(options = {}) {
    if (opened || current) return false;
    const was = document.activeElement as HTMLElement | null;
    invoker = options.invoker !== undefined ? options.invoker : was && was !== document.body ? was : null; fallback = options.focusFallback;
    setTitle(options.title ?? o.title, options.subtitle ?? o.subtitle ?? '', options.chip ?? o.chip ?? '', options.meta ?? o.meta ?? '');
    renderFooter(); q('confirm').hidden = true; buttons.hidden = false; pending = null; opened = true; current = surface;
    if (o.inertRoot) o.inertRoot.inert = true;
    document.documentElement.classList.add('pd-locked'); dlg.showModal(); body.scrollTop = 0;
    (o.readOnly ? q('title') : dlg.querySelector<HTMLElement>('[autofocus]') ?? q('close')).focus();
    return true;
   },
   close, isOpen: () => opened, requestClose,
   setTitle,
   setBanner(html, tone = 'info') { const b = q('banner'); b.hidden = !html; b.dataset.tone = tone; if (b.dataset.html !== (html ?? '')) { b.dataset.html = html ?? ''; b.innerHTML = html ?? ''; } },
   setFooter(next) { actions = next.map(a => ({...a})); renderFooter(); },
   setActionState(actionId, state) {
    const a = actions.find(x => x.id === actionId); if (!a) return;
    a.disabled = state.disabled; if (state.reason === undefined) delete a.reason; else a.reason = state.reason; const button = q<HTMLButtonElement>(actionId), had = document.activeElement === button;
    button.disabled = state.disabled; const reasons = [...new Set(actions.filter(x => x.disabled && x.reason).map(x => x.reason!))].join(' ');
    if (q('reason').textContent !== reasons) q('reason').textContent = reasons;
    if (had && state.disabled) q('close').focus();
   },
   setStatus(html, role = 'status') {
    // Compare with the last string written, not innerHTML: the serialised DOM differs (entities), and re-writing would replace a link between mousedown and mouseup.
    const s = q('status'); if (s.getAttribute('role') !== role) s.setAttribute('role', role);
    if (s.dataset.html !== html) { s.dataset.html = html; s.innerHTML = html; }
   },
   confirm,
   preserveScroll(change) { saved = String(body.scrollTop); change(); body.scrollTop = Number(saved); },
   dispose() { close('dispose'); dlg.remove(); },
  };
  return surface;
 }
 async function confirmApplyOverRun(dialog: LWProcessDialog.Surface, run: {minute: number; cases: number}): Promise<boolean> {
  if (run.minute <= 0) return true;
  const cases = `${run.cases.toLocaleString()} ${run.cases === 1 ? 'case' : 'cases'}`;
  const choice = await dialog.confirm(`Applying starts a fresh paused run and discards minute ${run.minute.toLocaleString()} (${cases}). Export the run report first if you need it.`, [{id: 'back', label: 'Back', default: true}, {id: 'apply-reset', label: 'Apply and reset'}]);
  return choice === 'apply-reset' && dialog.isOpen();
 }
 root.LWProcessDialog = {create, active: () => current, escape: esc, confirmApplyOverRun};
})(globalThis);
