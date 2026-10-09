/// <reference path="./process-contracts.d.ts" />
/**
 * Menu button behaviour for Process Studio (the Export menu and the phone overflow menu share one popup).
 * Pure DOM wiring over markup the caller owns: trigger buttons (`aria-haspopup="menu"`, `aria-expanded`, `aria-controls`) and a
 * popup holding `[role="menuitem"]` buttons. Items that are not displayed (CSS) are skipped. Keys: Enter, Space and ArrowDown on a
 * trigger open the menu on the first item, ArrowUp on the last; inside the menu ArrowDown/ArrowUp wrap, Home/End jump, Escape closes
 * and returns focus to the trigger that opened it, Tab closes and lets focus move on from that trigger. Activating an item, pressing
 * a trigger again or a pointer press outside closes the menu. It never touches the simulation, the draft or storage.
 */
declare namespace LWProcessMenu {
 interface Options {
  /** Buttons that open the same popup; normally only one is displayed at a time. */
  triggers: HTMLElement[];
  popup: HTMLElement;
 }
 interface Surface {
  open(trigger?: HTMLElement): void;
  /** Hides the popup. Focus returns to the opening trigger when `returnFocus` is true (the default). */
  close(returnFocus?: boolean): void;
  isOpen(): boolean;
  dispose(): void;
 }
 interface Api {create(options: Options): Surface;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessMenu?: LWProcessMenu.Api};
 const shown = (n: HTMLElement) => n.getClientRects().length > 0 && !n.hasAttribute('disabled');
 function create(o: LWProcessMenu.Options): LWProcessMenu.Surface {
  const {popup, triggers} = o;
  let from: HTMLElement | null = null;
  const items = () => [...popup.querySelectorAll<HTMLElement>('[role="menuitem"]')].filter(shown);
  const isOpen = () => !popup.hidden;
  function close(returnFocus = true): void {
   if (!isOpen()) return;
   popup.hidden = true; for (const t of triggers) t.setAttribute('aria-expanded', 'false');
   const back = from; from = null; if (returnFocus) (back && shown(back) ? back : triggers.find(shown))?.focus();
  }
  function open(trigger?: HTMLElement, last = false): void {
   const opener = trigger ?? triggers.find(shown); if (!opener) return;
   from = opener; popup.hidden = false; for (const t of triggers) t.setAttribute('aria-expanded', String(t === opener));
   const list = items(); (last ? list.at(-1) : list[0])?.focus();
  }
  const onTrigger = (t: HTMLElement) => {
   t.addEventListener('click', () => { if (isOpen()) close(); else open(t); });
   t.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!isOpen()) open(t); else items()[0]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (!isOpen()) open(t, true); else items().at(-1)?.focus(); }
    else if (e.key === 'Escape' && isOpen()) { e.preventDefault(); close(); }
   });
  };
  triggers.forEach(onTrigger);
  popup.addEventListener('click', e => { if ((e.target as HTMLElement).closest('[role="menuitem"]')) close(); });
  popup.addEventListener('keydown', e => {
   const list = items(), at = list.indexOf(document.activeElement as HTMLElement);
   if (e.key === 'ArrowDown') { e.preventDefault(); list[(at + 1) % list.length]?.focus(); }
   else if (e.key === 'ArrowUp') { e.preventDefault(); list[(at <= 0 ? list.length : at) - 1]?.focus(); }
   else if (e.key === 'Home') { e.preventDefault(); list[0]?.focus(); }
   else if (e.key === 'End') { e.preventDefault(); list.at(-1)?.focus(); }
   else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
   else if (e.key === 'Tab') close();
  });
  const outside = (e: Event) => { const t = e.target as Node; if (isOpen() && !popup.contains(t) && !triggers.some(x => x.contains(t))) close(false); };
  document.addEventListener('pointerdown', outside, true);
  return {open: t => open(t), close, isOpen, dispose() { document.removeEventListener('pointerdown', outside, true); close(false); }};
 }
 root.LWProcessMenu = {create};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessMenu;
})(globalThis);
