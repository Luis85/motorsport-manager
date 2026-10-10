/// <reference path="./process-contracts.d.ts" />
/**
 * The reader's view controls of Present mode (LWProcessPresentView), owned by LWProcessPresent (`process-present.ts`), which
 * inserts `controls` into the dialog's header actions and `hint` into its footer. Presentation only: neither control ever ticks
 * the run, rebuilds the deck or moves the slide, and both keep focus where it is.
 *  - **Full screen** (`#present-fullscreen`, `aria-pressed`, shortcut F): the Fullscreen API on the page root. A `<dialog>` cannot
 *    be the fullscreen element (the Fullscreen standard's element ready check refuses it), so the root goes full screen and the
 *    modal Present dialog, which covers the whole window from the top layer, then covers the whole screen. `fullscreenchange`
 *    keeps the pressed state, the title and the key hint true whoever changed it (the browser's own exit included) and says so in
 *    the dialog's live region. A refused request is announced and leaves the button unpressed. Leaving Present leaves a full screen
 *    that Present entered.
 *  - Unavailable (no API, or `document.fullscreenEnabled` false, as in a frame embedded without full-screen permission): the button
 *    stays focusable with `aria-disabled="true"` and its reason as the title; a press or F says the reason in the live region.
 *  - Escape: the first Escape while full screen only leaves full screen; the dialog stays open on its slide. Browsers normally keep
 *    that key from the page; where it does reach the page (headless Chromium), `escape()` leaves full screen and tells the dialog
 *    not to close. A key event dated at or before the last exit from full screen is the key that caused that exit, so it does not
 *    close the dialog either.
 *  - F (either case, no modifier) toggles full screen, except while focus is in a text field or in the map, whose own F fits it.
 *  - **Wide text** (`#present-wide`, `aria-pressed`): a wider slide column beside a narrower map (`data-text="wide"` on the dialog;
 *    the split is in process-present.css). It applies where slide and map sit side by side; narrow and short windows stack them
 *    and hide the control. The choice lasts for the page, across opens.
 *  - The footer key hint (`#present-keys`) names the paging keys, F while full screen is available, and what Escape does now.
 */
declare namespace LWProcessPresentView {
 interface Surface {
  /** Present opened: reads full-screen availability and syncs both controls and the key hint. */
  open(): void;
  /** Present is closing: leaves a full screen it entered. */
  close(): void;
  /** F: toggles full screen (or says why it is unavailable). True when the key was used. */
  key(e: KeyboardEvent): boolean;
  /** An Escape keydown or a dialog cancel: true when it only left full screen (or caused that exit) and must not close Present. */
  escape(e: Event): boolean;
  dispose(): void;
 }
 interface Api {
  /** Header buttons (Wide text, Full screen), inserted before Exit. */
  readonly controls: string;
  /** The footer key hint, between Previous and Next. */
  readonly hint: string;
  create(dlg: HTMLDialogElement, map: HTMLElement, announce: (text: string) => void): Surface;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessPresentView?: LWProcessPresentView.Api};
 const controls = '<button type="button" id="present-wide" aria-pressed="false" title="A wider slide column beside a narrower map">Wide text</button>'
  + '<button type="button" id="present-fullscreen" aria-pressed="false" aria-keyshortcuts="F">Full screen</button>';
 const hint = '<p id="present-keys" class="present-keys"></p>';
 const TEXT_FIELD = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
 const PAGING = 'Arrow keys or Page Up and Page Down change slides';
 /** Why full screen cannot be used on this page, or '' when it can. */
 function unavailable(): string {
  const page = document.documentElement as Partial<Pick<HTMLElement, 'requestFullscreen'>>;
  if (typeof page.requestFullscreen !== 'function' || typeof document.exitFullscreen !== 'function') {
   return 'Full screen is not available: this browser does not offer it to pages.';
  }
  if (!document.fullscreenEnabled) return 'Full screen is not available: this page is embedded without permission to use full screen.';
  return '';
 }
 function create(dlg: HTMLDialogElement, map: HTMLElement, announce: (text: string) => void): LWProcessPresentView.Surface {
  const button = dlg.querySelector<HTMLButtonElement>('#present-fullscreen')!, wide = dlg.querySelector<HTMLButtonElement>('#present-wide')!;
  const keys = dlg.querySelector<HTMLElement>('#present-keys')!;
  /** Why full screen is unavailable ('' when available), whether Present entered it, when it was last left, and the width choice. */
  let reason = '', entered = false, leftAt = -Infinity, active = false, wideText = false;
  const full = () => !!document.fullscreenElement;
  function sync(): void {
   const on = full();
   button.setAttribute('aria-pressed', String(on));
   if (reason) {
    button.setAttribute('aria-disabled', 'true');
    button.title = reason;
   } else {
    button.removeAttribute('aria-disabled');
    button.title = on ? 'Leave full screen (F or Escape)' : 'Show the presentation on the whole screen (F)';
   }
   const escape = reason ? 'Escape exits' : on ? 'F or Escape leaves full screen' : 'F full screen · Escape exits';
   keys.textContent = `${PAGING} · ${escape}`;
  }
  function leave(): void {
   if (full()) document.exitFullscreen().catch(() => undefined);
  }
  function toggle(): void {
   if (reason) { announce(reason); return; }
   if (full()) { leave(); return; }
   entered = true;
   document.documentElement.requestFullscreen().catch(() => {
    entered = false;
    if (active) { sync(); announce('The browser did not allow full screen.'); }
   });
  }
  function changed(e: Event): void {
   if (!full()) { leftAt = e.timeStamp; entered = false; }
   if (!active) return;
   sync();
   announce(full() ? 'Full screen. Press F or Escape to leave it.' : 'Full screen off.');
  }
  function applyWide(): void {
   wide.setAttribute('aria-pressed', String(wideText));
   if (wideText) dlg.dataset.text = 'wide'; else delete dlg.dataset.text;
  }
  button.addEventListener('click', toggle);
  wide.addEventListener('click', () => { wideText = !wideText; applyWide(); });
  document.addEventListener('fullscreenchange', changed);
  return {
   open() { active = true; reason = unavailable(); sync(); applyWide(); },
   close() {
    active = false;
    if (entered) leave();
    entered = false;
   },
   key(e) {
    if (e.key !== 'f' && e.key !== 'F') return false;
    const target = e.target as Element | null;
    if (target && (target.closest?.(TEXT_FIELD) || map.contains(target))) return false;
    e.preventDefault();
    toggle();
    return true;
   },
   escape(e) {
    if (full()) { leave(); return true; }
    return e.timeStamp <= leftAt;
   },
   dispose() { active = false; document.removeEventListener('fullscreenchange', changed); },
  };
 }
 root.LWProcessPresentView = {controls, hint, create};
})(globalThis);
