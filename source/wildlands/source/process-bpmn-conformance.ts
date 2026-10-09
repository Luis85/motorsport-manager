/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-xml.ts" />
/// <reference path="./process-bpmn-conformance-model.ts" />
/// <reference path="./process-bpmn-conformance-values.ts" />
/**
 * BPMN 2.0 and BPSim 1.0 conformance check of an interchange file against the Wildlands rule tables
 * (`process-bpmn-conformance-model.ts`, `process-bpmn-conformance-bpsim.ts`); no schema file is shipped or read. It reads the
 * file with the in-repository XML reader and checks, like an XML Schema validator: every element is known in its namespace
 * and allowed at its position (ordered content, occurrences, choices and substitution groups, matched deterministically),
 * attributes are allowed, present when required and of the right type, ids are unique, id references and qualified-name
 * references resolve, and text appears only where the content is mixed or a value. `extensionElements` content is lax:
 * BPSim content is checked with the BPSim rules, Wildlands (`urn:wildlands:process:1`) and other foreign content is counted
 * in `unchecked`. An element of a covered namespace that the rules recognise but do not cover is listed in `notCovered` and
 * left unchecked. Structural, type and reference rules only: the BPMN specification's prose semantics are not checked.
 * Pure: the report is a detached value and nothing is imported, applied or stored.
 */
declare namespace LWProcessBpmnConformance {
 interface Problem {line?: number; path: string; code: string; message: string}
 interface Uncovered {line?: number; path: string; element: string; namespace: string; reason: string}
 /** Foreign extension content in one namespace that no rule describes (the Wildlands extension included): counted, never checked. */
 interface Unchecked {namespace: string; elements: number; note: string}
 /** `conforms` is true exactly when `errors` is empty; `notCovered` elements and `unchecked` content were not checked. */
 interface Report {conforms: boolean; errors: Problem[]; notCovered: Uncovered[]; unchecked: Unchecked[]; checked: number; rules: {bpmn: '2.0'; bpsim: '1.0'}}
 interface Api {validate(xml: string): Report}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessXml: LWProcessXml.Api; LWProcessBpmnValues: LWProcessBpmnValues.Api; LWProcessBpmnRulesModel: LWProcessBpmnRules.Api; LWProcessBpmnRulesBpsim: LWProcessBpmnRules.Api; LWProcessBpmnConformance?: LWProcessBpmnConformance.Api};
 type Table = LWProcessBpmnRules.Table; type Node = LWProcessXml.Located; type Problem = LWProcessBpmnConformance.Problem;
 const XSI = 'http://www.w3.org/2001/XMLSchema-instance', XML = 'http://www.w3.org/XML/1998/namespace', WL = 'urn:wildlands:process:1', MAX_ERRORS = 1000;
 /** Instance attributes any element may carry; xsi:nil is refused because no element of these rules is nillable. */
 const XSI_ALLOWED = ['type', 'schemaLocation', 'noNamespaceSchemaLocation'];
 interface Simple {simple: string; table: Table}
 interface Attr {name: string; type: string; table: Table; required: boolean}
 interface Type {name: string; ns: string; label: string; base?: Type; abstract: boolean; mixed: boolean; text?: Simple; content: Particle[]; attrs: Map<string, Attr>; open: '' | 'lax' | 'strict'; openNs: string; anonymous: boolean}
 interface Decl {ns: string; local: string; label: string; table: Table; typeName: string; head?: string; covered: boolean; abstract: boolean; members: Set<Decl>; parent?: Decl}
 type Occurs = {min: number; max: number};
 type Particle = Occurs & ({k: 'el'; decl: Decl} | {k: 'local'; ns: string; local: string; label: string; table: Table; typeName: string} | {k: 'seq' | 'alt'; items: Particle[]} | {k: 'any'; not: string | null; strict: boolean});
 interface Rules {decls: Map<string, Decl>; types: Map<string, Type>; locals: Set<string>; byPrefix: Map<string, Table>; known: Set<string>}
 const key = (ns: string, local: string) => ns + '\n' + local;
 let compiled: Rules | undefined;

 // ---------------------------------------------------------------- rule compilation (once, on first use)
 function compile(): Rules {
  const tables = [...root.LWProcessBpmnRulesModel.tables, ...root.LWProcessBpmnRulesBpsim.tables];
  const rules: Rules = {decls: new Map(), types: new Map(), locals: new Set(), byPrefix: new Map(tables.map(t => [t.prefix, t])), known: new Set(tables.map(t => t.ns))};
  for (const table of tables) for (const token of table.elements.split(/\s+/)) {
   const m = /^([~!]?)(\w+)(?:<([\w:]+))?(?:=(\w+))?$/.exec(token); if (!m) throw Error('Rule table ' + table.prefix + ': bad element entry ' + token);
   const local = m[2]!, head = m[3] && (m[3].includes(':') ? m[3] : table.prefix + ':' + m[3]);
   rules.decls.set(key(table.ns, local), {ns: table.ns, local, label: table.prefix + ':' + local, table, typeName: m[4] ?? table.typePrefix + (table.typePrefix ? local[0]!.toUpperCase() + local.slice(1) : local),
    ...head ? {head} : {}, covered: m[1] !== '~', abstract: m[1] === '!', members: new Set()});
  }
  const byLabel = new Map([...rules.decls.values()].map(d => [d.label, d]));
  for (const d of rules.decls.values()) {
   if (!d.abstract) d.members.add(d);
   for (let h = d.head ? byLabel.get(d.head) : undefined, guard = 0; h && guard < 16; h = h.head ? byLabel.get(h.head) : undefined, guard++) h.members.add(d);
  }
  compiled = rules;
  // Resolve everything once so a mistake in a table fails loudly here rather than on some later file.
  const resolve = (p: Particle): void => { if (p.k === 'local') typeOf(p.table, p.typeName); else if (p.k === 'seq' || p.k === 'alt') p.items.forEach(resolve); };
  for (const table of tables) for (const name of Object.keys(table.types)) { const t = typeOf(table, name); if (!isSimple(t)) t.content.forEach(resolve); }
  for (const d of rules.decls.values()) if (d.covered) typeOf(d.table, d.typeName);
  return rules;
 }
 const tableFor = (table: Table, ref: string): [Table, string] => {
  const colon = ref.indexOf(':'); if (colon < 0) return [table, ref];
  const other = compiled!.byPrefix.get(ref.slice(0, colon)); if (!other) throw Error('Rule table: unknown prefix in ' + ref);
  return [other, ref.slice(colon + 1)];
 };
 const occurs = (s: string): Occurs => s === '?' ? {min: 0, max: 1} : s === '*' ? {min: 0, max: Infinity} : s === '+' ? {min: 1, max: Infinity}
  : s ? {min: Number(/\d+/.exec(s)![0]), max: /,(\d+)/.exec(s) ? Number(/,(\d+)/.exec(s)![1]) : Infinity} : {min: 1, max: 1};
 function atom(table: Table, token: string): Particle {
  const m = /^(%(other|any)\.(lax|strict)|([\w:]+)(?:=([\w:]+))?)(\?|\*|\+|\{\d+,\d*\})?$/.exec(token); if (!m) throw Error('Rule table ' + table.prefix + ': bad particle ' + token);
  const o = occurs(m[6] ?? '');
  if (m[2]) return {k: 'any', not: m[2] === 'other' ? table.ns : null, strict: m[3] === 'strict', ...o};
  if (m[5]) { compiled!.locals.add(key(table.ns, m[4]!)); return {k: 'local', ns: table.ns, local: m[4]!, label: table.prefix + ':' + m[4], table, typeName: m[5], ...o}; }
  const [t, local] = tableFor(table, m[4]!), decl = compiled!.decls.get(key(t.ns, local)); if (!decl) throw Error('Rule table: unknown element ' + m[4]);
  return {k: 'el', decl, ...o};
 }
 function particles(table: Table, content: string): Particle[] {
  const tokens = content.match(/\(|\)(?:[?*+]|\{\d+,\d*\})?|\||[^\s()|]+/g) ?? [];
  const group = (i: number): [Particle, number] => {
   const branches: Particle[][] = [[]];
   while (i < tokens.length && !tokens[i]!.startsWith(')')) {
    const t = tokens[i]!;
    if (t === '|') { branches.push([]); i++; }
    else if (t === '(') { const [p, j] = group(i + 1); Object.assign(p, occurs(tokens[j]?.slice(1) ?? '')); branches.at(-1)!.push(p); i = j + 1; }
    else { branches.at(-1)!.push(atom(table, t)); i++; }
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
  const entry = t.types[name]; if (!entry) throw Error('Rule table ' + t.prefix + ': unknown type ' + name);
  const [baseRef, content, attributes, flags = ''] = entry, base = baseRef ? typeOf(t, baseRef) as Type : undefined;
  const type: Type = {name, ns: t.ns, label: t.prefix + ':' + name, abstract: /\babstract\b/.test(flags), mixed: /\bmixed\b/.test(flags) || !!base?.mixed, content: [], attrs: new Map(base?.attrs),
   open: /\bopen-strict\b/.test(flags) ? 'strict' : /\bopen\b/.test(flags) ? 'lax' : base?.open ?? '', openNs: /\bopen/.test(flags) ? t.ns : base?.openNs ?? '', anonymous: name.startsWith('_')};
  if (base) type.base = base;
  rules.types.set(key(t.ns, name), type);
  if (content.startsWith('=')) type.text = typeOf(t, content.slice(1)) as Simple;
  else type.content = [...base?.content ?? [], ...particles(t, content)];
  for (const a of attributes.split(/\s+/).filter(Boolean)) {
   const m = /^(\w+):(\w+)(!)?(?:=.*)?$/.exec(a); if (!m) throw Error('Rule table ' + t.prefix + ': bad attribute ' + a);
   type.attrs.set(m[1]!, {name: m[1]!, type: m[2]!, table: t, required: !!m[3]});
  }
  return type;
 }
 const isSimple = (t: Type | Simple): t is Simple => 'simple' in t;
 const labelOf = (p: Particle): string => p.k === 'el' ? p.decl.label + (p.decl.members.size > 1 || p.decl.abstract ? ' (or an element of its group)' : '') : p.k === 'local' ? p.label
  : p.k === 'any' ? (p.not === null ? 'any element' : 'an element of another namespace') : p.items.map(labelOf).join(p.k === 'alt' ? ' or ' : ', ');

 // ---------------------------------------------------------------- content matching
 const HARD = {};
 /** Assigns each child the particle it matches, left to right and committed (the tables are deterministic, like XML Schema), and reports the first position that cannot match. */
 function match(content: Particle[], kids: Node[], accepts: (p: Particle, n: Node) => boolean): {assign: (Particle | undefined)[]; ok: boolean; at: number; expected: Set<string>} {
  const assign: (Particle | undefined)[] = new Array(kids.length);
  let at = -1, expected = new Set<string>();
  const note = (i: number, p: Particle) => { if (i > at) { at = i; expected = new Set(); } if (i === at) expected.add(labelOf(p)); };
  const one = (p: Particle, i: number): number => {
   if (p.k === 'seq') { let j = i; for (const q of p.items) { const k = rep(q, j); if (k < 0) { if (j > i) throw HARD; return -1; } j = k; } return j; }
   if (p.k === 'alt') { let empty = false; for (const q of p.items) { const k = rep(q, i); if (k > i) return k; if (k === i) empty = true; } return empty ? i : -1; }
   if (i < kids.length && accepts(p, kids[i]!)) { assign[i] = p; return i + 1; }
   note(i, p); return -1;
  };
  const rep = (p: Particle, i: number): number => {
   let n = 0, j = i;
   while (n < p.max) { const k = one(p, j); if (k < 0) break; if (k === j) { n = p.max; break; } j = k; n++; }
   if (n < p.min) { if (j > i) throw HARD; return -1; }
   return j;
  };
  let end: number;
  try { end = rep({k: 'seq', items: content, min: 1, max: 1}, 0); } catch (e) { if (e !== HARD) throw e; end = -1; }
  const ok = end === kids.length;
  return {assign, ok, at: ok ? -1 : Math.max(at, end), expected};
 }

 // ---------------------------------------------------------------- validation
 function validate(xml: string): LWProcessBpmnConformance.Report {
  const rules = compiled ?? compile(), V = root.LWProcessBpmnValues;
  const errors: Problem[] = [], notCovered: LWProcessBpmnConformance.Uncovered[] = [], unchecked = new Map<string, number>();
  const ids = new Map<string, {line: number; label: string}>(), hidden = new Set<string>(), idrefs: {value: string; line: number; path: string; what: string}[] = [], refs: typeof idrefs = [];
  let checked = 0, target = '';
  const report = (): LWProcessBpmnConformance.Report => ({conforms: errors.length === 0, errors: errors.sort((a, b) => (a.line ?? Infinity) - (b.line ?? Infinity)), notCovered,
   unchecked: [...unchecked].map(([namespace, elements]) => ({namespace, elements, note: namespace === WL ? 'Wildlands process extension: read by the Wildlands importer, not schema-checked.' : 'Foreign extension content: allowed by BPMN, not checked.'})), checked, rules: {bpmn: '2.0', bpsim: '1.0'}});
  const fail = (at: {line: number} | undefined, path: string, code: string, message: string) => { if (errors.length < MAX_ERRORS) errors.push({...at ? {line: at.line} : {}, path, code, message}); };
  let doc: Node;
  try { doc = root.LWProcessXml.parse(xml, {positions: true}); } catch (e) { fail(undefined, '/', 'xml-malformed', 'The file is not well-formed XML: ' + (e instanceof Error ? e.message : String(e))); return report(); }
  const global = (n: Node) => rules.decls.get(key(n.ns, n.local));
  const accepts = (p: Particle, n: Node) => p.k === 'el' ? !!global(n) && p.decl.members.has(global(n)!) : p.k === 'local' ? n.ns === p.ns && n.local === p.local : p.k === 'any' && (p.not === null || n.ns !== '' && n.ns !== p.not);
  /** Ids inside content that is not checked still count as targets of references. */
  const hide = (n: Node) => { if (rules.known.has(n.ns) && n.attrs.id) hidden.add(n.attrs.id.trim()); n.children.forEach(hide); };
  function value(type: string, table: Table, raw: string, node: Node, path: string, what: string): void {
   const r = V.check(type, raw, table.simple);
   if (r.problem) { fail(node, path, r.enumeration ? 'value-enumeration' : 'value-invalid', `${what} must be ${r.problem}, not "${raw.length > 60 ? raw.slice(0, 60) + '…' : raw}".`); return; }
   if (type === 'id') {
    const seen = ids.get(r.value);
    if (seen) fail(node, path, 'id-duplicate', `${what} repeats the id "${r.value}" of ${seen.label} on line ${seen.line}; ids must be unique in the file.`); else ids.set(r.value, {line: node.line, label: node.name});
   } else if (type === 'idref') idrefs.push({value: r.value, line: node.line, path, what});
   else if (type === 'qname' || type === 'ref') {
    const q = V.qname(r.value)!;
    if (q.prefix && q.prefix !== 'xml' && !(q.prefix in node.scope)) fail(node, path, 'qname-prefix', `${what} uses the namespace prefix "${q.prefix}" in "${r.value}", but that prefix is not declared.`);
    else if (type === 'ref' && (!q.prefix || node.scope[q.prefix] === target)) refs.push({value: q.local, line: node.line, path, what});
   }
  }
  function element(node: Node, decl: Decl, path: string): void {
   if (decl.covered) { check(node, typeOf(decl.table, decl.typeName), path); return; }
   notCovered.push({line: node.line, path, element: node.name, namespace: node.ns, reason: 'BPMN 2.0 choreography, conversation, correlation and partner elements are recognised in their places but not checked.'}); hide(node);
  }
  function lax(node: Node, path: string, strict: boolean, nested = false): void {
   const decl = global(node);
   if (decl) { element(node, decl, path); return; }
   if (strict) { fail(node, path, 'element-undeclared', `${node.name} is not allowed here: only top-level elements of a known namespace (other than this one) may appear at this point.`); return; }
   if (!rules.known.has(node.ns)) unchecked.set(node.ns, (unchecked.get(node.ns) ?? 0) + 1);
   else if (!nested) notCovered.push({line: node.line, path, element: node.name, namespace: node.ns, reason: `${node.local} is not a top-level element of its namespace, so this extension content is not checked (XML Schema skips it).`});
   const at = paths(node, path); node.children.forEach((c, i) => lax(c, at[i]!, false, nested || rules.known.has(node.ns)));
  }
  /** XPath-like child paths: the qualified name as written, with a 1-based position among same-named siblings when there are several. */
  function paths(parent: Node, path: string): string[] {
   const total = new Map<string, number>(), seen = new Map<string, number>();
   for (const c of parent.children) total.set(c.name, (total.get(c.name) ?? 0) + 1);
   return parent.children.map(c => { const n = (seen.get(c.name) ?? 0) + 1; seen.set(c.name, n); return `${path}/${c.name}${total.get(c.name)! > 1 ? `[${n}]` : ''}`; });
  }
  function check(node: Node, declared: Type | Simple, path: string): void {
   checked++;
   let type = declared;
   const xsiType = Object.entries(node.attrs).find(([k]) => k.endsWith(':type') && node.scope[k.slice(0, -5)] === XSI)?.[1];
   if (xsiType !== undefined) {
    const q = V.qname(xsiType.trim()), ns = q && (q.prefix ? node.scope[q.prefix] : node.scope['']) || '', found = q && rules.types.get(key(ns, q.local));
    let derived = false; for (let t: Type | undefined = found; t && !isSimple(declared); t = t.base) if (t === declared) derived = true;
    if (found && !found.anonymous && derived) type = found;
    else fail(node, path, 'xsi-type-invalid', `xsi:type="${xsiType}" on ${node.name} does not name a ${isSimple(declared) ? 'type' : 'type derived from ' + declared.label} of these rules.`);
   }
   if (isSimple(type)) { simple(node, type, path); return; }
   if (type.abstract) { fail(node, path, 'element-abstract', `${node.name} has the abstract type ${type.label}; use a concrete element of its group (or name a concrete type with xsi:type).`); hide(node); return; }
   for (const [name, raw] of Object.entries(node.attrs)) {
    if (name === 'xmlns' || name.startsWith('xmlns:')) continue;
    const colon = name.indexOf(':'), prefix = colon < 0 ? '' : name.slice(0, colon), local = name.slice(colon + 1), ns = !prefix ? '' : prefix === 'xml' ? XML : node.scope[prefix], at = path + '/@' + name;
    if (ns === undefined) { fail(node, at, 'qname-prefix', `Attribute ${name} of ${node.name} uses an undeclared namespace prefix.`); continue; }
    if (ns === XSI) { if (!XSI_ALLOWED.includes(local)) fail(node, at, 'attribute-unknown', `${node.name} cannot carry xsi:${local}.`); continue; }
    const a = ns === '' ? type.attrs.get(local) : undefined;
    if (a) value(a.type, a.table, raw, node, at, `Attribute ${name} of ${node.name}`);
    else if (ns !== '' && type.open === 'strict' && ns !== type.openNs) fail(node, at, 'attribute-undeclared', `Attribute ${name} of ${node.name} is in a namespace no rule declares; only declared attributes of other namespaces may appear here.`);
    else if (ns === '' || !type.open || ns === type.openNs) fail(node, at, 'attribute-unknown', `${node.name} has no attribute ${name}. Allowed: ${[...type.attrs.keys()].join(', ') || 'none'}${type.open ? ' (and attributes of other namespaces)' : ''}.`);
   }
   for (const a of type.attrs.values()) if (a.required && !Object.hasOwn(node.attrs, a.name)) fail(node, path, 'attribute-missing', `${node.name} is missing the required attribute ${a.name} (${a.type}).`);
   const empty = !type.text && !type.content.length, text = node.text;
   if (type.text) value(type.text.simple, type.text.table, text, node, path, `The text of ${node.name}`);
   else if (!type.mixed && (empty ? text !== '' : /[^\t\n\r ]/.test(text))) fail(node, path, 'text-not-allowed', `${node.name} cannot contain text${empty ? ' or spaces: it must be empty' : ': only child elements are allowed'} (found "${text.trim().slice(0, 40)}").`);
   const kids = node.children;
   if (!kids.length && !type.content.length) return;
   const m = match(type.content, kids, accepts), at = paths(node, path);
   if (!m.ok) {
    const expected = [...m.expected].slice(0, 6).join('; ') || 'nothing more', order = type.content.map(labelOf).join(', ');
    const kid = kids[m.at], known = kid && rules.known.has(kid.ns) && !global(kid) && !rules.locals.has(key(kid.ns, kid.local));
    if (!kid) fail(node, path, 'element-missing', `${node.name} is missing a required child: expected ${expected}.`);
    else fail(kid, at[m.at]!, known ? 'element-unknown' : 'element-unexpected', known ? `${kid.name} is not an element of its namespace (${kid.ns}).`
     : `${kid.name} is not allowed at this position inside ${node.name}. Expected here: ${expected}.${order ? ` The children of ${node.name} come in this order: ${order}.` : ' It cannot contain child elements.'}`);
   }
   kids.forEach((kid, i) => {
    const p = m.assign[i];
    if (p?.k === 'local') check(kid, typeOf(p.table, p.typeName), at[i]!);
    else if (p?.k === 'any') lax(kid, at[i]!, p.strict);
    else if (global(kid)) element(kid, global(kid)!, at[i]!);
    else hide(kid);
   });
  }
  function simple(node: Node, type: Simple, path: string): void {
   for (const name of Object.keys(node.attrs)) if (!/^xmlns(:|$)/.test(name) && !(XSI_ALLOWED.includes(name.slice(name.indexOf(':') + 1)) && node.scope[name.slice(0, name.indexOf(':'))] === XSI)) fail(node, path + '/@' + name, 'attribute-unknown', `${node.name} holds a value and takes no attribute ${name}.`);
   if (node.children.length) { fail(node.children[0]!, paths(node, path)[0]!, 'element-unexpected', `${node.name} holds a value and cannot contain child elements.`); node.children.forEach(hide); }
   value(type.simple, type.table, node.text, node, path, `The value of ${node.name}`);
  }
  const top = global(doc);
  if (doc.ns === root.LWProcessBpmnRulesModel.tables[0]!.ns && doc.local === 'definitions') target = (doc.attrs.targetNamespace ?? '').trim();
  if (!top || top.abstract) fail(doc, '/' + doc.name, 'root-unknown', `The root element ${doc.name} (namespace ${doc.ns || 'none'}) is not a top-level element of BPMN 2.0 or BPSim 1.0; a BPMN file starts with bpmn:definitions.`);
  else element(doc, top, '/' + doc.name);
  for (const r of idrefs) if (!ids.has(r.value) && !hidden.has(r.value)) fail(r, r.path, 'idref-unresolved', `${r.what} names "${r.value}", but no element in the file has that id.`);
  for (const r of refs) if (!ids.has(r.value) && !hidden.has(r.value)) fail(r, r.path, 'reference-unresolved', `${r.what} refers to "${r.value}", but no element in the file has that id.`);
  return report();
 }
 root.LWProcessBpmnConformance = {validate};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessBpmnConformance;
})(globalThis);
