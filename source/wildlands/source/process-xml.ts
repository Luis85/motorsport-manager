/// <reference path="./process-contracts.d.ts" />
/** Minimal namespace-aware XML reader and writer helpers for BPMN interchange. DOCTYPE/entities, deep and oversized documents are rejected. */
declare namespace LWProcessXml {
 interface Node {ns: string; local: string; attrs: Record<string, string>; children: Node[]; text: string;}
 interface Api {parse(source: string): Node; escape(value: unknown): string;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessXml?: LWProcessXml.Api};
 const MAX_CHARS = 8 * 1024 * 1024, MAX_NODES = 200000, MAX_DEPTH = 64, ENTITY = /&(#x[0-9a-fA-F]+|#[0-9]+|lt|gt|amp|quot|apos);/g;
 const NAMED: Record<string, string> = {lt: '<', gt: '>', amp: '&', quot: '"', apos: "'"};
 function decode(value: string): string {
  if (value.replace(ENTITY, '').includes('&')) throw Error('Only the predefined XML entities and numeric character references are supported.');
  return value.replace(ENTITY, (_, e: string) => {
   if (NAMED[e]) return NAMED[e]!;
   const code = e[1] === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1));
   if (!Number.isInteger(code) || code < 1 || code > 0x10ffff || code >= 0xd800 && code < 0xe000) throw Error('Invalid character reference.');
   return String.fromCodePoint(code);
  });
 }
 const escape = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'}[c]!));
 function tagEnd(text: string, from: number): number {
  let quote = '';
  for (let i = from; i < text.length; i++) {
   const c = text[i]!;
   if (quote) { if (c === quote) quote = ''; } else if (c === '"' || c === "'") quote = c; else if (c === '>') return i;
  }
  throw Error('Unterminated tag.');
 }
 function parse(input: string): LWProcessXml.Node {
  if (typeof input !== 'string' || input.length > MAX_CHARS) throw Error('The XML document is missing or larger than 8 MiB.');
  const text = input.replace(/^﻿/, '');
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw Error('DOCTYPE and entity declarations are not allowed.');
  const stack: {node: LWProcessXml.Node; raw: string; scope: Record<string, string>}[] = [];
  let root: LWProcessXml.Node | undefined, i = 0, count = 0;
  while (i < text.length) {
   if (text[i] !== '<') {
    const next = text.indexOf('<', i), chunk = text.slice(i, next < 0 ? text.length : next), top = stack.at(-1);
    if (top) top.node.text += decode(chunk); else if (chunk.trim()) throw Error('Text outside the root element.');
    i = next < 0 ? text.length : next; continue;
   }
   if (text.startsWith('<!--', i)) { const j = text.indexOf('-->', i + 4); if (j < 0) throw Error('Unterminated comment.'); i = j + 3; continue; }
   if (text.startsWith('<![CDATA[', i)) {
    const j = text.indexOf(']]>', i + 9), top = stack.at(-1); if (j < 0 || !top) throw Error('Invalid CDATA section.');
    top.node.text += text.slice(i + 9, j); i = j + 3; continue;
   }
   if (text.startsWith('<?', i)) { const j = text.indexOf('?>', i + 2); if (j < 0) throw Error('Unterminated processing instruction.'); i = j + 2; continue; }
   const end = tagEnd(text, i + 1), body = text.slice(i + 1, end); i = end + 1;
   if (body.startsWith('/')) {
    const top = stack.pop(); if (!top || top.raw !== body.slice(1).trim()) throw Error('Mismatched closing tag: ' + body);
    continue;
   }
   const selfClosing = body.endsWith('/'), inner = selfClosing ? body.slice(0, -1) : body, name = /^[^\s/>]+/.exec(inner)?.[0];
   if (!name || !/^[A-Za-z_][\w.:-]*$/.test(name)) throw Error('Invalid element name.');
   const attrs: Record<string, string> = {}, scope = {...stack.at(-1)?.scope};
   const rest = inner.slice(name.length).replace(/\s*([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g, (_, key: string, a?: string, b?: string) => {
    const value = a ?? b ?? ''; if (value.includes('<')) throw Error('Attribute values cannot contain <.');
    if (Object.hasOwn(attrs, key)) throw Error('Duplicate attribute: ' + key);
    attrs[key] = decode(value); return '';
   });
   if (rest.trim()) throw Error('Malformed attributes on ' + name + '.');
   for (const [key, value] of Object.entries(attrs)) { if (key === 'xmlns') scope[''] = value; else if (key.startsWith('xmlns:')) scope[key.slice(6)] = value; }
   const colon = name.indexOf(':'), prefix = colon < 0 ? '' : name.slice(0, colon), local = colon < 0 ? name : name.slice(colon + 1);
   if (prefix && !Object.hasOwn(scope, prefix)) throw Error('Undeclared namespace prefix: ' + prefix);
   const node: LWProcessXml.Node = {ns: scope[prefix] ?? '', local, attrs, children: [], text: ''};
   if (++count > MAX_NODES || stack.length >= MAX_DEPTH) throw Error('The XML document is too large or deeply nested.');
   const parent = stack.at(-1);
   if (parent) parent.node.children.push(node); else if (root) throw Error('Multiple root elements.'); else root = node;
   if (!selfClosing) stack.push({node, raw: name, scope});
  }
  if (stack.length || !root) throw Error('The XML document is incomplete.');
  return root;
 }
 root.LWProcessXml = {parse, escape};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessXml;
})(globalThis);
