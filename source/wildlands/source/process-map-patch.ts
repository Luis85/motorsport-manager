/// <reference path="./process-contracts.d.ts" />
/**
 * Keyed reconciliation of the 2D map's SVG (LWProcessMapPatch). The map builds a fresh, detached copy of its content on every
 * refresh; `children(live, fresh)` then makes the live element match it while keeping element identity, so a snapshot refresh only
 * mutates the attributes, text and markers that changed. Presentation only: it reads and writes the two subtrees it is given.
 *  - Children are matched by key: tag name plus the first stable identity attribute (`id`, `data-token`, `data-flow`, `data-status`,
 *    `data-k`), then by order among siblings with the same key. Card groups (`id`), edges and deadline tags (`data-flow`), work
 *    markers (`data-token`) and per-state count chips (`data-status`) therefore keep their elements across ticks.
 *  - A matched element gets only the attributes whose values differ set, removed attributes removed, and its text replaced only when
 *    it changed. Unmatched live children are removed and new fresh children are moved in, in order; existing nodes move only when the
 *    order changed. Listeners are never attached to drawn elements (the map delegates events), so moved-in nodes need no wiring.
 */
declare namespace LWProcessMapPatch {
 interface Api {
  /** Makes `live`'s children match `fresh`'s; `fresh` is consumed (its new nodes move into `live`). */
  children(live: Element, fresh: Element): void;
  keyOf(node: Element): string;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessMapPatch?: LWProcessMapPatch.Api};
 const IDENTITY = ['id', 'data-token', 'data-flow', 'data-status', 'data-k'];
 function keyOf(node: Element): string {
  for (const name of IDENTITY) {
   const value = node.getAttribute(name);
   if (value !== null) return `${node.tagName}|${name}=${value}`;
  }
  return node.tagName;
 }
 function attributes(live: Element, fresh: Element): void {
  for (const name of live.getAttributeNames()) if (!fresh.hasAttribute(name)) live.removeAttribute(name);
  for (const name of fresh.getAttributeNames()) {
   const value = fresh.getAttribute(name)!;
   if (live.getAttribute(name) !== value) live.setAttribute(name, value);
  }
 }
 function sync(live: Element, fresh: Element): void {
  attributes(live, fresh);
  if (!fresh.childElementCount) {
   const text = fresh.textContent ?? '';
   if (live.childElementCount || live.textContent !== text) live.textContent = text;
   return;
  }
  children(live, fresh);
 }
 function children(live: Element, fresh: Element): void {
  const pool = new Map<string, Element[]>();
  for (const child of [...live.children]) {
   const key = keyOf(child), list = pool.get(key);
   if (list) list.push(child); else pool.set(key, [child]);
  }
  // Text nodes only appear in leaf elements here (titles and text runs), which `sync` handles; containers hold elements only.
  for (const node of [...live.childNodes]) if (node.nodeType !== Node.ELEMENT_NODE) node.remove();
  const plan = [...fresh.children].map(next => {
   const reuse = pool.get(keyOf(next))?.shift();
   if (!reuse) return next;
   sync(reuse, next);
   return reuse;
  });
  for (const rest of pool.values()) for (const node of rest) node.remove();
  let cursor: Element | null = live.firstElementChild;
  for (const node of plan) {
   if (node === cursor) cursor = cursor.nextElementSibling;
   else live.insertBefore(node, cursor);
  }
 }
 root.LWProcessMapPatch = {children, keyOf};
})(globalThis);
