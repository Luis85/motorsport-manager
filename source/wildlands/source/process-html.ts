/// <reference path="./process-contracts.d.ts" />
/**
 * The one HTML escaping module of Process Studio (LWProcessHtml, presentation, loaded before every other studio view). Views
 * that build markup as strings for `innerHTML` use it instead of a local escaper. Pure functions: no DOM, session, clock or
 * storage.
 *
 * Contract:
 * - `esc(value)` is text for an element body or a quoted attribute: `String(value)` with the five HTML characters `& < > " '`
 *   replaced by `&amp; &lt; &gt; &quot; &#39;` (the same output as the escapers it replaces, so `esc(undefined)` is
 *   'undefined').
 * - `attr(value)` is a value for a double-quoted attribute: `esc` of the value, and '' for `null` or `undefined`.
 * - `num(value)` is a number for an attribute such as `value`, `min` or `max`: only a finite `number` is written (`String`
 *   of it); anything else (NaN, ±Infinity, a numeric string, null, an object) is '' and never markup. Draft values are only
 *   shape-checked JSON, so a "number" may be any text a person pasted.
 * - `html` is a tagged template whose result is a `Safe` value. The literal parts are trusted source text; every
 *   interpolation is escaped with `esc`, except a `Safe` value, which is inserted as it is. `null` and `undefined` insert
 *   nothing (use a ternary for conditional markup: `false` prints 'false'). An array inserts each item by the same rule,
 *   joined without a separator; `join(items, separator)` adds one. Interpolations are always placed inside quoted
 *   attributes or element bodies, never as attribute names, unquoted values, URLs or `<script>` text; a `style` value may
 *   only interpolate a number the view computed itself (a meter width), never a value from a definition or a run.
 * - `raw(markup)` marks a string that is already markup (a constant, or the output of an older string builder that escapes
 *   its own values) as `Safe`. It is the only way to trust a plain string, so a reviewer can find every trusted string by
 *   searching for `raw(`.
 * - A `Safe` value is a frozen object made only by `html`, `raw` and `join`; `isSafe` recognises it by identity, so an
 *   object that merely looks like one (`{html: '<b>'}`, a copy, a subclass) is escaped like any other value. `String(safe)`
 *   and `safe.html` give its markup.
 */
declare namespace LWProcessHtml {
 /** Markup made by `html`, `raw` or `join`; never constructed directly. */
 interface Safe {
  readonly html: string;
  toString(): string;
 }
 interface Api {
  /** The five HTML characters escaped; the same output as the escapers it replaces. */
  esc(value: unknown): string;
  /** A double-quoted attribute value: `esc(value)`, or '' for null and undefined. */
  attr(value: unknown): string;
  /** A finite number as attribute text; '' for anything else. */
  num(value: unknown): string;
  /** Tagged template: every interpolation is escaped unless it is a `Safe` value (arrays join their items by the same rule). */
  html(strings: TemplateStringsArray, ...values: unknown[]): Safe;
  /** Trusts a string that is already markup. */
  raw(markup: string): Safe;
  /** Items inserted by the `html` rule with an escaped (or `Safe`) separator between them. */
  join(items: readonly unknown[], separator?: unknown): Safe;
  /** True only for a value made by `html`, `raw` or `join`. */
  isSafe(value: unknown): value is Safe;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessHtml?: LWProcessHtml.Api};
 const ENTITIES: Record<string, string> = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
 const esc = (value: unknown): string => String(value).replace(/[&<>"']/g, c => ENTITIES[c]!);
 const attr = (value: unknown): string => value === null || value === undefined ? '' : esc(value);
 const num = (value: unknown): string => typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
 /** Every Safe value ever made; membership, not shape, makes a value trusted. */
 const made = new WeakSet<object>();
 function safe(markup: string): LWProcessHtml.Safe {
  const value: LWProcessHtml.Safe = Object.freeze({html: markup, toString: () => markup});
  made.add(value);
  return value;
 }
 const isSafe = (value: unknown): value is LWProcessHtml.Safe => typeof value === 'object' && value !== null && made.has(value);
 /** One interpolation as markup. */
 function part(value: unknown): string {
  if (isSafe(value)) return value.html;
  if (Array.isArray(value)) return value.map(part).join('');
  if (value === null || value === undefined) return '';
  return esc(value);
 }
 function html(strings: TemplateStringsArray, ...values: unknown[]): LWProcessHtml.Safe {
  let out = strings[0] ?? '';
  for (let i = 0; i < values.length; i++) out += part(values[i]) + (strings[i + 1] ?? '');
  return safe(out);
 }
 const raw = (markup: string): LWProcessHtml.Safe => safe(String(markup));
 const join = (items: readonly unknown[], separator: unknown = ''): LWProcessHtml.Safe => safe(items.map(part).join(part(separator)));
 root.LWProcessHtml = Object.freeze({esc, attr, num, html, raw, join, isSafe});
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessHtml;
})(globalThis);
