/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-xml.ts" />
/// <reference path="./process-bpmn-conformance-model.ts" />
/// <reference path="./process-bpmn-conformance-values.ts" />
/**
 * Compiled conformance rules for `LWProcessBpmnConformance` (LWProcessBpmnSchema, definition context): it compiles the rule
 * tables of `process-bpmn-conformance-model.ts` and `process-bpmn-conformance-bpsim.ts` once, on first use, into element
 * declarations with their substitution groups, named types (base, content particles, attributes, openness) and the local
 * element names, resolving every reference so a mistake in a table fails loudly at compilation rather than on some later file.
 * `match` assigns the children of one element to the particles of its content model, left to right and committed, as XML
 * Schema's deterministic content models allow, and reports the first position where nothing fits with what was expected
 * there. It reads no file and holds no state but the compiled tables, which never change after compilation.
 */
declare namespace LWProcessBpmnSchema {
 type Table = LWProcessBpmnRules.Table;
 type Node = LWProcessXml.Located;
 /** A simple value type: built in, or an enumeration of `table`. */
 interface Simple {simple: string; table: Table}
 interface Attr {name: string; type: string; table: Table; required: boolean}
 interface Type {
  name: string;
  ns: string;
  label: string;
  base?: Type;
  abstract: boolean;
  mixed: boolean;
  text?: Simple;
  content: Particle[];
  attrs: Map<string, Attr>;
  open: '' | 'lax' | 'strict';
  openNs: string;
  anonymous: boolean;
 }
 interface Decl {
  ns: string;
  local: string;
  label: string;
  table: Table;
  typeName: string;
  head?: string;
  covered: boolean;
  abstract: boolean;
  members: Set<Decl>;
  parent?: Decl;
 }
 type Occurs = {min: number; max: number};
 type Particle = Occurs & (
  | {k: 'el'; decl: Decl}
  | {k: 'local'; ns: string; local: string; label: string; table: Table; typeName: string}
  | {k: 'seq' | 'alt'; items: Particle[]}
  | {k: 'any'; not: string | null; strict: boolean}
 );
 /** Declarations and types keyed by `key(namespace, local name)`; `locals` holds the local element names of each table. */
 interface Rules {decls: Map<string, Decl>; types: Map<string, Type>; locals: Set<string>; byPrefix: Map<string, Table>; known: Set<string>}
 /** The particle each child matched; when `ok` is false, `at` is the first child (or the end) where nothing fits and `expected` what would. */
 interface Matched {assign: (Particle | undefined)[]; ok: boolean; at: number; expected: Set<string>}
 interface Api {
  /** The compiled rules (compiled on the first call). */
  rules(): Rules;
  /** The map key of a namespace and a local name. */
  key(ns: string, local: string): string;
  /** A named type of a table, or a simple value type (built in or a table enumeration). */
  typeOf(table: Table, ref: string): Type | Simple;
  isSimple(t: Type | Simple): t is Simple;
  /** What a particle expects, in the words of an error message. */
  labelOf(p: Particle): string;
  match(content: Particle[], kids: Node[], accepts: (p: Particle, n: Node) => boolean): Matched;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {
  LWProcessBpmnValues: LWProcessBpmnValues.Api;
  LWProcessBpmnRulesModel: LWProcessBpmnRules.Api;
  LWProcessBpmnRulesBpsim: LWProcessBpmnRules.Api;
  LWProcessBpmnSchema?: LWProcessBpmnSchema.Api;
 };
 type Table = LWProcessBpmnRules.Table;
 type Node = LWProcessXml.Located;
 type Simple = LWProcessBpmnSchema.Simple;
 type Type = LWProcessBpmnSchema.Type;
 type Occurs = LWProcessBpmnSchema.Occurs;
 type Particle = LWProcessBpmnSchema.Particle;
 type Rules = LWProcessBpmnSchema.Rules;
 type Matched = LWProcessBpmnSchema.Matched;
 const key = (ns: string, local: string) => ns + '\n' + local;
 let compiled: Rules | undefined;

 // ---------------------------------------------------------------- rule compilation (once, on first use)
 function compile(): Rules {
  const tables = [...root.LWProcessBpmnRulesModel.tables, ...root.LWProcessBpmnRulesBpsim.tables];
  const rules: Rules = {
   decls: new Map(),
   types: new Map(),
   locals: new Set(),
   byPrefix: new Map(tables.map(t => [t.prefix, t])),
   known: new Set(tables.map(t => t.ns)),
  };
  for (const table of tables) for (const token of table.elements.split(/\s+/)) {
   const m = /^([~!]?)(\w+)(?:<([\w:]+))?(?:=(\w+))?$/.exec(token);
   if (!m) throw Error('Rule table ' + table.prefix + ': bad element entry ' + token);
   const local = m[2]!, head = m[3] && (m[3].includes(':') ? m[3] : table.prefix + ':' + m[3]);
   const typeName = m[4] ?? table.typePrefix + (table.typePrefix ? local[0]!.toUpperCase() + local.slice(1) : local);
   rules.decls.set(key(table.ns, local), {
    ns: table.ns,
    local,
    label: table.prefix + ':' + local,
    table,
    typeName,
    ...head ? {head} : {},
    covered: m[1] !== '~',
    abstract: m[1] === '!',
    members: new Set(),
   });
  }
  const byLabel = new Map([...rules.decls.values()].map(d => [d.label, d]));
  for (const d of rules.decls.values()) {
   if (!d.abstract) d.members.add(d);
   // Every head up the substitution chain admits this element (bounded, so a cyclic table cannot hang).
   let h = d.head ? byLabel.get(d.head) : undefined;
   for (let guard = 0; h && guard < 16; guard++) {
    h.members.add(d);
    h = h.head ? byLabel.get(h.head) : undefined;
   }
  }
  compiled = rules;
  // Resolve everything once so a mistake in a table fails loudly here rather than on some later file.
  const resolve = (p: Particle): void => {
   if (p.k === 'local') typeOf(p.table, p.typeName);
   else if (p.k === 'seq' || p.k === 'alt') p.items.forEach(resolve);
  };
  for (const table of tables) for (const name of Object.keys(table.types)) {
   const t = typeOf(table, name);
   if (!isSimple(t)) t.content.forEach(resolve);
  }
  for (const d of rules.decls.values()) if (d.covered) typeOf(d.table, d.typeName);
  return rules;
 }
 const tableFor = (table: Table, ref: string): [Table, string] => {
  const colon = ref.indexOf(':');
  if (colon < 0) return [table, ref];
  const other = compiled!.byPrefix.get(ref.slice(0, colon));
  if (!other) throw Error('Rule table: unknown prefix in ' + ref);
  return [other, ref.slice(colon + 1)];
 };
 /** Occurrences from a particle suffix: `?`, `*`, `+`, `{m,n}` or `{m,}`; no suffix means exactly once. */
 function occurs(s: string): Occurs {
  if (s === '?') return {min: 0, max: 1};
  if (s === '*') return {min: 0, max: Infinity};
  if (s === '+') return {min: 1, max: Infinity};
  if (!s) return {min: 1, max: 1};
  const upper = /,(\d+)/.exec(s);
  return {min: Number(/\d+/.exec(s)![0]), max: upper ? Number(upper[1]) : Infinity};
 }
 function atom(table: Table, token: string): Particle {
  const m = /^(%(other|any)\.(lax|strict)|([\w:]+)(?:=([\w:]+))?)(\?|\*|\+|\{\d+,\d*\})?$/.exec(token);
  if (!m) throw Error('Rule table ' + table.prefix + ': bad particle ' + token);
  const o = occurs(m[6] ?? '');
  if (m[2]) return {k: 'any', not: m[2] === 'other' ? table.ns : null, strict: m[3] === 'strict', ...o};
  if (m[5]) {
   compiled!.locals.add(key(table.ns, m[4]!));
   return {k: 'local', ns: table.ns, local: m[4]!, label: table.prefix + ':' + m[4], table, typeName: m[5], ...o};
  }
  const [t, local] = tableFor(table, m[4]!), decl = compiled!.decls.get(key(t.ns, local));
  if (!decl) throw Error('Rule table: unknown element ' + m[4]);
  return {k: 'el', decl, ...o};
 }
 function particles(table: Table, content: string): Particle[] {
  const tokens = content.match(/\(|\)(?:[?*+]|\{\d+,\d*\})?|\||[^\s()|]+/g) ?? [];
  const group = (i: number): [Particle, number] => {
   const branches: Particle[][] = [[]];
   while (i < tokens.length && !tokens[i]!.startsWith(')')) {
    const t = tokens[i]!;
    if (t === '|') {
     branches.push([]);
     i++;
    } else if (t === '(') {
     const [p, j] = group(i + 1);
     Object.assign(p, occurs(tokens[j]?.slice(1) ?? ''));
     branches.at(-1)!.push(p);
     i = j + 1;
    } else {
     branches.at(-1)!.push(atom(table, t));
     i++;
    }
   }
   const seq = (items: Particle[]): Particle => items.length === 1 && branches.length > 1 ? items[0]! : {k: 'seq', items, min: 1, max: 1};
   return [branches.length > 1 ? {k: 'alt', items: branches.map(seq), min: 1, max: 1} : seq(branches[0]!), i];
  };
  const [top] = group(0);
  return top.k === 'seq' && top.min === 1 && top.max === 1 ? top.items : [top];
 }
 /** A named type of a table, or a simple value type (built in or a table enumeration). */
 function typeOf(table: Table, ref: string): Type | Simple {
  const [t, name] = tableFor(table, ref), rules = compiled!, cached = rules.types.get(key(t.ns, name));
  if (cached) return cached;
  if (root.LWProcessBpmnValues.builtin(name) || t.simple?.[name] !== undefined) return {simple: name, table: t};
  const entry = t.types[name];
  if (!entry) throw Error('Rule table ' + t.prefix + ': unknown type ' + name);
  const [baseRef, content, attributes, flags = ''] = entry, base = baseRef ? typeOf(t, baseRef) as Type : undefined;
  const type: Type = {
   name,
   ns: t.ns,
   label: t.prefix + ':' + name,
   abstract: /\babstract\b/.test(flags),
   mixed: /\bmixed\b/.test(flags) || !!base?.mixed,
   content: [],
   attrs: new Map(base?.attrs),
   open: openness(flags, base),
   openNs: /\bopen/.test(flags) ? t.ns : base?.openNs ?? '',
   anonymous: name.startsWith('_'),
  };
  if (base) type.base = base;
  rules.types.set(key(t.ns, name), type);
  if (content.startsWith('=')) type.text = typeOf(t, content.slice(1)) as Simple;
  else type.content = [...base?.content ?? [], ...particles(t, content)];
  for (const a of attributes.split(/\s+/).filter(Boolean)) {
   const m = /^(\w+):(\w+)(!)?(?:=.*)?$/.exec(a);
   if (!m) throw Error('Rule table ' + t.prefix + ': bad attribute ' + a);
   type.attrs.set(m[1]!, {name: m[1]!, type: m[2]!, table: t, required: !!m[3]});
  }
  return type;
 }
 /** Foreign attributes a type admits: `open-strict` only declared ones, `open` any; otherwise as its base. */
 function openness(flags: string, base: Type | undefined): Type['open'] {
  if (/\bopen-strict\b/.test(flags)) return 'strict';
  if (/\bopen\b/.test(flags)) return 'lax';
  return base?.open ?? '';
 }
 const isSimple = (t: Type | Simple): t is Simple => 'simple' in t;
 /** What a particle expects, in the words of an error message. */
 function labelOf(p: Particle): string {
  if (p.k === 'el') return p.decl.label + (p.decl.members.size > 1 || p.decl.abstract ? ' (or an element of its group)' : '');
  if (p.k === 'local') return p.label;
  if (p.k === 'any') return p.not === null ? 'any element' : 'an element of another namespace';
  return p.items.map(labelOf).join(p.k === 'alt' ? ' or ' : ', ');
 }

 // ---------------------------------------------------------------- content matching
 const HARD = {};
 /**
  * Assigns each child the particle it matches, left to right and committed (the tables are deterministic, like XML Schema), and
  * reports the first position that cannot match.
  */
 function match(content: Particle[], kids: Node[], accepts: (p: Particle, n: Node) => boolean): Matched {
  const assign: (Particle | undefined)[] = new Array(kids.length);
  let at = -1, expected = new Set<string>();
  const note = (i: number, p: Particle) => {
   if (i > at) {
    at = i;
    expected = new Set();
   }
   if (i === at) expected.add(labelOf(p));
  };
  const one = (p: Particle, i: number): number => {
   if (p.k === 'seq') {
    let j = i;
    for (const q of p.items) {
     const k = rep(q, j);
     if (k < 0) {
      if (j > i) throw HARD;
      return -1;
     }
     j = k;
    }
    return j;
   }
   if (p.k === 'alt') {
    let empty = false;
    for (const q of p.items) {
     const k = rep(q, i);
     if (k > i) return k;
     if (k === i) empty = true;
    }
    return empty ? i : -1;
   }
   if (i < kids.length && accepts(p, kids[i]!)) {
    assign[i] = p;
    return i + 1;
   }
   note(i, p);
   return -1;
  };
  const rep = (p: Particle, i: number): number => {
   let n = 0, j = i;
   while (n < p.max) {
    const k = one(p, j);
    if (k < 0) break;
    if (k === j) {
     n = p.max;
     break;
    }
    j = k;
    n++;
   }
   if (n < p.min) {
    if (j > i) throw HARD;
    return -1;
   }
   return j;
  };
  let end: number;
  try {
   end = rep({k: 'seq', items: content, min: 1, max: 1}, 0);
  } catch (e) {
   if (e !== HARD) throw e;
   end = -1;
  }
  const ok = end === kids.length;
  return {assign, ok, at: ok ? -1 : Math.max(at, end), expected};
 }

 root.LWProcessBpmnSchema = {rules: () => compiled ?? compile(), key, typeOf, isSimple, labelOf, match};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessBpmnSchema;
})(globalThis);
