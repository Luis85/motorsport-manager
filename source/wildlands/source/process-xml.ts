/// <reference path="./process-contracts.d.ts" />
/**
 * Minimal namespace-aware XML reader and writer helpers for BPMN interchange. DOCTYPE/entities, characters XML 1.0 forbids,
 * deep and oversized documents are rejected; reading is linear in the document size.
 */
declare namespace LWProcessXml {
 interface Node {ns: string; local: string; attrs: Record<string, string>; children: Node[]; text: string;}
 /**
  * A node read with `{positions: true}`: also its 1-based start line, its qualified name as written and its in-scope namespace
  * bindings (prefix to URI, '' for the default namespace; inherited bindings come through the prototype chain).
  */
 interface Located extends Node {line: number; name: string; scope: Readonly<Record<string, string>>; children: Located[];}
 interface Api {
  /** Without options the nodes carry exactly the five fields of `Node`; `{positions: true}` adds `line`, `name` and `scope` (still one linear pass). */
  parse(source: string): Node;
  parse(source: string, options: {positions: true}): Located;
  /**
   * Attribute value: markup characters, quotes, tabs and line breaks become references (so no reader normalizes them); throws on
   * a character XML 1.0 cannot represent.
   */
  escape(value: unknown): string;
  /**
   * Element text: markup characters (and quotes unless `quotes` is false) and carriage returns become references; newlines and
   * tabs stay readable. Throws like `escape`.
   */
  text(value: unknown, quotes?: boolean): string;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessXml?: LWProcessXml.Api};
 const MAX_CHARS = 8 * 1024 * 1024;
 const MAX_NODES = 200000;
 const MAX_DEPTH = 64;
 const ENTITY = /&(#x[0-9a-fA-F]+|#[0-9]+|lt|gt|amp|quot|apos);/g;
 const DECLARATION = /^(DOCTYPE|ENTITY|ELEMENT|ATTLIST|NOTATION)/i;
 const NAMED: Record<string, string> = {lt: '<', gt: '>', amp: '&', quot: '"', apos: "'"};
 /** Characters outside the XML 1.0 `Char` production: C0 controls other than tab, line feed and carriage return, U+FFFE, U+FFFF and unpaired surrogates. */
 const ILLEGAL = /[\x00-\x08\x0B\x0C\x0E-\x1F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
 /** True for a code point outside the XML 1.0 `Char` production, which a character reference may not name. */
 function forbidden(code: number): boolean {
  if (code < 0x9 || code === 0xb || code === 0xc || code > 0xd && code < 0x20) return true;
  if (code === 0xfffe || code === 0xffff) return true;
  return code >= 0xd800 && code < 0xe000 || code > 0x10ffff;
 }
 const hex = (c: string) => 'U+' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0');
 function decode(value: string): string {
  if (value.replace(ENTITY, '').includes('&')) throw Error('Only the predefined XML entities and numeric character references are supported.');
  return value.replace(ENTITY, (_, e: string) => {
   if (NAMED[e]) return NAMED[e]!;
   const code = e[1] === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1));
   if (!Number.isInteger(code) || forbidden(code)) throw Error('Invalid character reference.');
   return String.fromCodePoint(code);
  });
 }
 const REFS: Record<string, string> = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;', '\t': '&#9;', '\n': '&#10;', '\r': '&#13;'};
 function legal(value: unknown): string {
  const s = String(value), bad = ILLEGAL.exec(s);
  if (bad) {
   const shown = s.slice(0, 40).replace(ILLEGAL, '?') + (s.length > 40 ? '...' : '');
   throw Error('The text "' + shown + '" contains the character ' + hex(bad[0]) + ', which XML 1.0 cannot represent; remove it before exporting.');
  }
  return s;
 }
 const escape = (value: unknown) => legal(value).replace(/[&<>"'\t\n\r]/g, c => REFS[c]!);
 const text = (value: unknown, quotes = true) => legal(value).replace(quotes ? /[&<>"'\r]/g : /[&<>\r]/g, c => REFS[c]!);
 function tagEnd(source: string, from: number): number {
  let quote = '';
  for (let i = from; i < source.length; i++) {
   const c = source[i]!;
   if (quote) { if (c === quote) quote = ''; } else if (c === '"' || c === "'") quote = c; else if (c === '>') return i;
  }
  throw Error('Unterminated tag.');
 }
 // Sticky (anchored at lastIndex) tokens: every attribute is read left to right once, so no input makes the reader backtrack.
 const SPACE = /\s*/y, ATTR_NAME = /[^\s=]+/y;
 const skip = (s: string, at: number) => { SPACE.lastIndex = at; SPACE.exec(s); return SPACE.lastIndex; };
 function attributes(inner: string, from: number, name: string): Record<string, string> {
  const attrs: Record<string, string> = {}, malformed = () => Error('Malformed attributes on ' + name + '.');
  for (let at = skip(inner, from); at < inner.length; at = skip(inner, at)) {
   ATTR_NAME.lastIndex = at; const key = ATTR_NAME.exec(inner)?.[0]; if (!key) throw malformed();
   let i = skip(inner, ATTR_NAME.lastIndex); if (inner[i] !== '=') throw malformed();
   i = skip(inner, i + 1); const quote = inner[i]; if (quote !== '"' && quote !== "'") throw malformed();
   const close = inner.indexOf(quote, i + 1); if (close < 0) throw malformed();
   const value = inner.slice(i + 1, close); if (value.includes('<')) throw Error('Attribute values cannot contain <.');
   if (Object.hasOwn(attrs, key)) throw Error('Duplicate attribute: ' + key);
   attrs[key] = decode(value); at = close + 1;
  }
  return attrs;
 }
 type Scope = Record<string, string>;
 function parse(input: string, options?: {positions?: boolean}): LWProcessXml.Node {
  if (typeof input !== 'string' || input.length > MAX_CHARS) throw Error('The XML document is missing or larger than 8 MiB.');
  const source = input.replace(/^﻿/, '');
  const bad = ILLEGAL.exec(source); if (bad) throw Error('The XML document contains the character ' + hex(bad[0]) + ', which XML 1.0 does not allow.');
  // A namespace scope inherits its parent's declarations through the prototype chain: an element copies nothing unless it declares a prefix.
  const stack: {node: LWProcessXml.Node; raw: string; scope: Scope}[] = [], empty = Object.create(null) as Scope;
  let root: LWProcessXml.Node | undefined, i = 0, count = 0;
  // Positions are opt-in: lines are counted once, from the previous element start to this one, so the pass stays linear.
  const positions = options?.positions === true; let line = 1, counted = 0;
  const lineAt = (at: number) => { for (let k = counted; k < at; k++) if (source.charCodeAt(k) === 10) line++; counted = at; return line; };
  while (i < source.length) {
   if (source[i] !== '<') {
    const next = source.indexOf('<', i), chunk = source.slice(i, next < 0 ? source.length : next), parent = stack.at(-1);
    if (parent) parent.node.text += decode(chunk); else if (chunk.trim()) throw Error('Text outside the root element.');
    i = next < 0 ? source.length : next; continue;
   }
   if (source.startsWith('<!--', i)) {
    const j = source.indexOf('-->', i + 4);
    if (j < 0) throw Error('Unterminated comment.');
    i = j + 3;
    continue;
   }
   if (source.startsWith('<![CDATA[', i)) {
    const j = source.indexOf(']]>', i + 9), parent = stack.at(-1); if (j < 0 || !parent) throw Error('Invalid CDATA section.');
    parent.node.text += source.slice(i + 9, j); i = j + 3; continue;
   }
   if (source.startsWith('<?', i)) {
    const j = source.indexOf('?>', i + 2);
    if (j < 0) throw Error('Unterminated processing instruction.');
    i = j + 2;
    continue;
   }
   // Any other markup declaration is refused as a token, so a comment or CDATA section that only mentions <!DOCTYPE is still read.
   if (source.startsWith('<!', i)) {
    throw Error(DECLARATION.test(source.slice(i + 2, i + 10)) ? 'DOCTYPE and entity declarations are not allowed.' : 'Invalid markup declaration.');
   }
   const start = i, end = tagEnd(source, i + 1), body = source.slice(i + 1, end); i = end + 1;
   if (body.startsWith('/')) {
    const closed = stack.pop(); if (!closed || closed.raw !== body.slice(1).trim()) throw Error('Mismatched closing tag: ' + body);
    continue;
   }
   const selfClosing = body.endsWith('/'), inner = selfClosing ? body.slice(0, -1) : body, name = /^[^\s/>]+/.exec(inner)?.[0];
   if (!name || !/^[A-Za-z_][\w.:-]*$/.test(name)) throw Error('Invalid element name.');
   const attrs = attributes(inner, name.length, name);
   const inherited = stack.at(-1)?.scope ?? empty; let scope = inherited;
   for (const [key, value] of Object.entries(attrs)) {
    if (key !== 'xmlns' && !key.startsWith('xmlns:')) continue;
    if (scope === inherited) scope = Object.create(inherited) as Scope;
    scope[key === 'xmlns' ? '' : key.slice(6)] = value;
   }
   const colon = name.indexOf(':'), prefix = colon < 0 ? '' : name.slice(0, colon), local = colon < 0 ? name : name.slice(colon + 1);
   if (prefix && !(prefix in scope)) throw Error('Undeclared namespace prefix: ' + prefix);
   const node: LWProcessXml.Node = {ns: scope[prefix] ?? '', local, attrs, children: [], text: ''};
   if (positions) Object.assign(node, {line: lineAt(start), name, scope});
   if (++count > MAX_NODES || stack.length >= MAX_DEPTH) throw Error('The XML document is too large or deeply nested.');
   const parent = stack.at(-1);
   if (parent) parent.node.children.push(node); else if (root) throw Error('Multiple root elements.'); else root = node;
   if (!selfClosing) stack.push({node, raw: name, scope});
  }
  if (stack.length || !root) throw Error('The XML document is incomplete.');
  return root;
 }
 root.LWProcessXml = {parse: parse as LWProcessXml.Api['parse'], escape, text};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessXml;
})(globalThis);
