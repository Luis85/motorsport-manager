/// <reference path="./process-contracts.d.ts" />
/**
 * Pure text helpers for the raw JSON draft: a strict JSON scanner that reports where a syntax error is (line and column, which
 * the engine's own messages do not give reliably), the source range of every value by JSON path, and readable labels for
 * diagnostic paths ("Discovery › duration"). Nothing here touches the DOM, the draft store or a session.
 */
declare namespace LWProcessJsonPath {
 /** A value's source range. `keyStart` is where its property name starts (the value start for array items and the root). */
 interface Span {start: number; end: number; keyStart: number}
 type Scan = {ok: true; spans: Map<string, Span>} | {ok: false; offset: number; message: string};
 interface Position {line: number; column: number}
 interface SyntaxProblem extends Position {offset: number; message: string}
 /** A character range to select, plus the 1-based line it starts on. */
 interface Range {start: number; end: number; line: number; exact: boolean}
 interface Api {
  /** Scans `text` as strict JSON. Paths are '/'-joined keys and indexes, like the catalog's diagnostics. */
  scan(text: string): Scan;
  position(text: string, offset: number): Position;
  /** The syntax problem of `text`, or null when it parses. Always carries line and column. */
  syntaxProblem(text: string): SyntaxProblem | null;
  /** The text to select for a diagnostic path: the property for a leaf, the first line of a block, else the nearest parent. */
  locate(text: string, path: string, scanned?: Scan): Range | null;
  /** "Step name › field", "Arrival 2 › gap › min", "Process › seed". `definition` is the parsed draft or anything else. */
  label(definition: unknown, path: string): string;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessJsonPath?: LWProcessJsonPath.Api};
 class Fail {constructor(readonly offset: number, readonly message: string) {}}
 const shown = (c: string) => c === '\n' ? 'a line break' : c === ' ' ? 'a space' : `'${c}'`;
 const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
 function scan(text: string): LWProcessJsonPath.Scan {
  const n = text.length, spans = new Map<string, LWProcessJsonPath.Span>(); let i = 0;
  const fail = (message: string, at = i): never => { throw new Fail(at, message); };
  const space = () => { while (i < n && (text[i] === ' ' || text[i] === '\t' || text[i] === '\n' || text[i] === '\r')) i++; };
  const string = (): void => {
   i++;
   for (;;) {
    const c = text[i]; if (c === undefined) fail('The text ends inside a string', n);
    if (c === '"') { i++; return; }
    if (c! < ' ') fail('A line break or control character inside a string must be written as \\n or \\u….');
    if (c === '\\') {
     const e = text[i + 1]; if (e === undefined || !'"\\/bfnrtu'.includes(e)) fail('Unknown escape after the backslash', i + 1);
     if (e === 'u') { if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) fail('\\u needs four hexadecimal digits', i + 2); i += 6; } else i += 2;
    } else i++;
   }
  };
  const value = (path: string, keyStart: number, depth: number): void => {
   space(); const start = i, c = text[i];
   if (depth > 200) fail('The JSON is nested too deeply');
   if (c === undefined) fail('The text ends where a value is expected', n);
   else if (c === '{') {
    i++; space();
    if (text[i] === '}') i++;
    else for (let first = true;; first = false) {
     space();
     if (text[i] !== '"') fail(!first && text[i] === '}' ? 'Remove the comma before }' : 'Expected a property name in double quotes');
     const ks = i; string(); const key = JSON.parse(text.slice(ks, i)) as string; space();
     if (text[i] !== ':') fail("Expected ':' after the property name");
     i++; value(path + '/' + key, ks, depth + 1); space();
     if (text[i] === ',') { i++; continue; }
     if (text[i] === '}') { i++; break; }
     fail(text[i] === undefined ? 'The text ends inside an object' : "Expected ',' or '}' after the value", text[i] === undefined ? n : i);
    }
   } else if (c === '[') {
    i++; space();
    if (text[i] === ']') i++;
    else for (let index = 0;; index++) {
     space(); if (text[i] === ']' && index > 0) fail('Remove the comma before ]');
     value(path + '/' + index, i, depth + 1); space();
     if (text[i] === ',') { i++; continue; }
     if (text[i] === ']') { i++; break; }
     fail(text[i] === undefined ? 'The text ends inside a list' : "Expected ',' or ']' after the value", text[i] === undefined ? n : i);
    }
   } else if (c === '"') string();
   else if (text.startsWith('true', i)) i += 4; else if (text.startsWith('false', i)) i += 5; else if (text.startsWith('null', i)) i += 4;
   else if (c === '-' || c >= '0' && c <= '9') { NUMBER.lastIndex = i; const m = NUMBER.exec(text); if (!m) fail('Not a valid number'); i += m![0].length; }
   else fail(`Unexpected ${shown(c)} where a value is expected`);
   spans.set(path, {start, end: i, keyStart});
  };
  try {
   value('', 0, 0); space(); if (i < n) fail(`Unexpected ${shown(text[i]!)} after the end of the JSON value`);
   return {ok: true, spans};
  } catch (e) { if (e instanceof Fail) return {ok: false, offset: e.offset, message: e.message}; throw e; }
 }
 function position(text: string, offset: number): LWProcessJsonPath.Position {
  const at = Math.max(0, Math.min(offset, text.length)), before = text.slice(0, at), line = before.split('\n').length;
  return {line, column: at - (before.lastIndexOf('\n') + 1) + 1};
 }
 function syntaxProblem(text: string): LWProcessJsonPath.SyntaxProblem | null {
  try { JSON.parse(text); return null; } catch (e) {
   const found = scan(text);
   if (!found.ok) return {offset: found.offset, message: found.message, ...position(text, found.offset)};
   // The scanner and the engine disagree (should not happen): fall back to the engine message and any position it carries.
   const raw = String((e as Error).message), at = /position (\d+)/.exec(raw), lc = /line (\d+) column (\d+)/.exec(raw), offset = at ? Number(at[1]) : 0;
   return {offset, message: raw.replace(/\s*in JSON at position \d+.*$/, '').replace(/\s*\(line \d+ column \d+\)/, ''), ...(lc ? {line: Number(lc[1]), column: Number(lc[2])} : position(text, offset))};
  }
 }
 function locate(text: string, path: string, scanned?: LWProcessJsonPath.Scan): LWProcessJsonPath.Range | null {
  const found = scanned ?? scan(text); if (!found.ok) return null;
  const parts = path.split('/').filter(Boolean);
  for (let keep = parts.length; keep >= 0; keep--) {
   const span = found.spans.get(keep ? '/' + parts.slice(0, keep).join('/') : ''); if (!span) continue;
   const exact = keep === parts.length, container = text[span.start] === '{' || text[span.start] === '[', lineEnd = text.indexOf('\n', span.keyStart);
   const end = container || !exact ? Math.min(span.end, lineEnd < 0 ? text.length : lineEnd) : span.end;
   return {start: span.keyStart, end: Math.max(end, span.keyStart), line: position(text, span.keyStart).line, exact};
  }
  return null;
 }
 /** Plain names for the journey fields, used in diagnostic labels such as "Checkout › feeling" or "Process › process type". */
 const NAMES: Record<string, string> = {genre: 'process type', track: 'tracked measures', phase: 'phase', emotion: 'feeling', pain: 'pain point', opportunity: 'opportunity', channel: 'channel', outcome: 'outcome'};
 function label(definition: unknown, path: string): string {
  const parts = path.split('/').filter(Boolean), d = (definition && typeof definition === 'object' ? definition : {}) as Record<string, unknown>;
  const list = (key: string) => (Array.isArray(d[key]) ? d[key] : []) as Record<string, unknown>[];
  const rest = (from: number) => parts.slice(from).map((p, at) => at === 0 ? NAMES[p] ?? p : p).join(' › '), join = (head: string, tail: string) => tail ? head + ' › ' + tail : head;
  const [section, raw] = parts, index = Number(raw);
  if (!section) return 'Process';
  if (section === 'sipoc') {
   const noun = raw === 'suppliers' ? 'Supplier' : raw === 'customers' ? 'Customer' : '', at = Number(parts[2]);
   if (!noun) return 'Suppliers and customers';
   return parts[2] === undefined ? noun + 's' : join(`${noun} ${Number.isInteger(at) ? at + 1 : parts[2]}`, parts.slice(3).join(' › '));
  }
  if (section === 'track' && raw !== undefined && Number.isInteger(index)) return join(`Tracked measure ${index + 1}`, rest(2));
  if (!['steps', 'flows', 'resources', 'arrivals'].includes(section) || raw === undefined || !Number.isInteger(index)) return join('Process', rest(0));
  const item = list(section)[index], name = (id: unknown) => String(list('steps').find(s => s.id === id)?.name ?? id);
  if (section === 'steps') return join(typeof item?.name === 'string' ? item.name : `Step ${index + 1}`, rest(2));
  if (section === 'flows') return join(item ? `Flow ${name(item.from)} → ${name(item.to)}` : `Flow ${index + 1}`, rest(2));
  if (section === 'resources') return join(typeof item?.name === 'string' ? `Resource ${item.name}` : `Resource ${index + 1}`, rest(2));
  return join(`Arrival ${index + 1}`, rest(2));
 }
 root.LWProcessJsonPath = {scan, position, syntaxProblem, locate, label};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessJsonPath;
})(globalThis);
