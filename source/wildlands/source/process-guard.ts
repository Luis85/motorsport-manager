/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-dialog.ts" />
/**
 * Work protection for Process Studio: the questions asked outside an editor (importing JSON over a run in progress or an unapplied
 * draft, offering a saved recovery draft), the reload/close guard for unapplied drafts, and the page lifecycle.
 *
 *  - `ask()` and `choose()` open a small modal built on the shared LWProcessDialog (id 'ask'). It starts on the first, safe choice
 *    (Cancel, or the caller's first choice such as Not now); Escape, Close and a backdrop click all choose it, and focus returns to the
 *    invoker (or `focusFallback`) when it closes. Choice buttons have the ids `ask-<choice id>`. `ask()` resolves true only for the
 *    confirming choice (`ask-go`); `choose()` resolves the chosen id. Neither pauses, ticks or changes anything itself; the caller
 *    acts on the answer.
 *  - While `unsaved()` is true, `beforeunload` asks the browser to confirm leaving. This module writes nothing to storage; the
 *    automatic recovery copy of a draft is LWProcessRecovery's storage policy (`process-recovery.ts`).
 *  - `pagehide` with `persisted` (the page enters the back/forward cache) only suspends the animation loop and `pageshow` resumes it;
 *    a page that is really unloaded is disposed for good.
 */
declare namespace LWProcessGuard {
 interface AskOptions {
  title: string;
  /** The full question, naming what would be lost. */
  message: string;
  /** Label of the confirming choice, e.g. 'Import and replace'. Cancel is always offered first. */
  confirm: string;
  /** Receives focus again when the question closes. */
  invoker: HTMLElement | null;
  /** Used when the invoker is gone or hidden at close time. */
  focusFallback?: () => HTMLElement | null;
 }
 interface ChooseOptions extends Omit<AskOptions, 'confirm'> {
  /** The choices in order; the first is the safe default (focused, and chosen by Escape, Close or a backdrop click). */
  choices: {id: string; label: string}[];
 }
 interface Env {
  /** The studio root, made inert while a question shows. */
  inertRoot: HTMLElement;
  /** True while any process holds an unapplied draft. */
  unsaved(): boolean;
  /** The page entered the back/forward cache: stop the animation loop but keep everything alive. */
  suspend(): void;
  /** The page came back from the back/forward cache. */
  resume(): void;
  /** The page is unloaded for good. */
  dispose(): void;
 }
 interface Surface {
  /** Resolves true for the confirming choice, false for Cancel or when another dialog is already open. */
  ask(options: AskOptions): Promise<boolean>;
  /** Resolves the chosen id; the first choice when the question is dismissed or another dialog is already open. */
  choose(options: ChooseOptions): Promise<string>;
  dispose(): void;
 }
 interface Api {create(env: Env): Surface;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessDialog: LWProcessDialog.Api; LWProcessGuard?: LWProcessGuard.Api};
 function create(env: LWProcessGuard.Env): LWProcessGuard.Surface {
  let dialog: LWProcessDialog.Surface | null = null, disposed = false;
  const question = () => {
   if (dialog) return dialog;
   dialog = root.LWProcessDialog.create(document.body, {
    id: 'ask', size: 'list', title: '', inertRoot: env.inertRoot, readOnly: true, actions: [], onAction: () => undefined,
   });
   dialog.el.classList.add('ask-dialog');
   return dialog;
  };
  async function choose(o: LWProcessGuard.ChooseOptions): Promise<string> {
   const d = question(), safe = o.choices[0]!.id;
   const opened = d.open({title: o.title, subtitle: '', invoker: o.invoker, ...o.focusFallback ? {focusFallback: o.focusFallback} : {}});
   if (!opened) return safe;
   const choices = o.choices.map((c, i) => ({id: c.id, label: c.label, default: i === 0}));
   const choice = await d.confirm(o.message, choices, {escape: safe});
   if (d.isOpen()) d.close(choice === safe ? 'cancel' : 'action');
   return choice;
  }
  const ask = async (o: LWProcessGuard.AskOptions): Promise<boolean> => {
   const {confirm, ...rest} = o;
   return await choose({...rest, choices: [{id: 'cancel', label: 'Cancel'}, {id: 'go', label: confirm}]}) === 'go';
  };
  const beforeUnload = (e: BeforeUnloadEvent) => {
   if (!env.unsaved()) return;
   // Both forms: preventDefault for current browsers, returnValue for older ones. The browser writes its own wording.
   e.preventDefault(); e.returnValue = '';
  };
  const pageHide = (e: PageTransitionEvent) => {
   if (e.persisted) { env.suspend(); return; }
   dispose(); env.dispose();
  };
  const pageShow = (e: PageTransitionEvent) => { if (e.persisted && !disposed) env.resume(); };
  function dispose(): void {
   if (disposed) return; disposed = true;
   window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('pagehide', pageHide); window.removeEventListener('pageshow', pageShow);
   dialog?.dispose(); dialog = null;
  }
  window.addEventListener('beforeunload', beforeUnload); window.addEventListener('pagehide', pageHide); window.addEventListener('pageshow', pageShow);
  return {ask, choose, dispose};
 }
 root.LWProcessGuard = {create};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessGuard;
})(globalThis);
