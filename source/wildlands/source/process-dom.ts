/// <reference path="./process-contracts.d.ts" />
/**
 * Checked element lookups for the Process Studio shell modules (ENG-17). The studio writes its own markup once, so a missing element is
 * a programming error: `must(id)` throws an Error that names the id instead of returning null behind an unchecked cast, and `maybe(id)`
 * is the explicit form for elements that may legitimately be absent (a control that only exists in some states). Pure DOM reads: no
 * session, clock, draft or storage.
 */
declare namespace LWProcessDom {
 interface Api {
  /** The element with this id; throws `Error('Process Studio: missing element #id')` when there is none. */
  must<T extends HTMLElement = HTMLElement>(id: string): T;
  /** The element with this id, or null when there is none. */
  maybe<T extends HTMLElement = HTMLElement>(id: string): T | null;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessDom?: LWProcessDom.Api};
 function maybe<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
 }
 function must<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = maybe<T>(id);
  if (!node) throw Error('Process Studio: missing element #' + id);
  return node;
 }
 root.LWProcessDom = {must, maybe};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessDom;
})(globalThis);
