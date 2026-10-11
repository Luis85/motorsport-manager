/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-xml.ts" />
/// <reference path="./process-bpmn-conformance-model.ts" />
/// <reference path="./process-bpmn-conformance-values.ts" />
/// <reference path="./process-bpmn-conformance-schema.ts" />
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
 * Pure: the report is a detached value and nothing is imported, applied or stored. The tables are compiled, and each element's
 * children matched to its content model, by `LWProcessBpmnSchema` (`process-bpmn-conformance-schema.ts`); this module owns the
 * walk over the file, the value, attribute and reference checks and the wording of every problem.
 */
declare namespace LWProcessBpmnConformance {
 interface Problem {line?: number; path: string; code: string; message: string}
 interface Uncovered {line?: number; path: string; element: string; namespace: string; reason: string}
 /** Foreign extension content in one namespace that no rule describes (the Wildlands extension included): counted, never checked. */
 interface Unchecked {namespace: string; elements: number; note: string}
 /** `conforms` is true exactly when `errors` is empty; `notCovered` elements and `unchecked` content were not checked. */
 interface Report {
  conforms: boolean;
  errors: Problem[];
  notCovered: Uncovered[];
  unchecked: Unchecked[];
  checked: number;
  rules: {bpmn: '2.0'; bpsim: '1.0'};
 }
 interface Api {validate(xml: string): Report}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {
  LWProcessXml: LWProcessXml.Api;
  LWProcessBpmnValues: LWProcessBpmnValues.Api;
  LWProcessBpmnRulesModel: LWProcessBpmnRules.Api;
  LWProcessBpmnSchema: LWProcessBpmnSchema.Api;
  LWProcessBpmnConformance?: LWProcessBpmnConformance.Api;
 };
 type Table = LWProcessBpmnRules.Table;
 type Node = LWProcessXml.Located;
 type Problem = LWProcessBpmnConformance.Problem;
 type Simple = LWProcessBpmnSchema.Simple;
 type Type = LWProcessBpmnSchema.Type;
 type Decl = LWProcessBpmnSchema.Decl;
 type Particle = LWProcessBpmnSchema.Particle;
 type Matched = LWProcessBpmnSchema.Matched;
 const XSI = 'http://www.w3.org/2001/XMLSchema-instance';
 const XML = 'http://www.w3.org/XML/1998/namespace';
 const WL = 'urn:wildlands:process:1';
 const MAX_ERRORS = 1000;
 /** Instance attributes any element may carry; xsi:nil is refused because no element of these rules is nillable. */
 const XSI_ALLOWED = ['type', 'schemaLocation', 'noNamespaceSchemaLocation'];
 /** An id or qualified-name reference, resolved against the ids of the file once every element was read. */
 interface Reference {value: string; line: number; path: string; what: string}
 const {key, typeOf, isSimple, labelOf, match} = root.LWProcessBpmnSchema;

 // ---------------------------------------------------------------- validation
 const uncheckedNote = (namespace: string) => namespace === WL
  ? 'Wildlands process extension: read by the Wildlands importer, not schema-checked.'
  : 'Foreign extension content: allowed by BPMN, not checked.';
 const NOT_COVERED = 'BPMN 2.0 choreography, conversation, correlation and partner elements are recognised in their places but not checked.';
 /** An allowed xsi instance attribute (`xsi:type`, `xsi:schemaLocation`, ...) under a prefix bound to the XSI namespace. */
 function xsiAllowed(node: Node, name: string): boolean {
  const colon = name.indexOf(':');
  return XSI_ALLOWED.includes(name.slice(colon + 1)) && node.scope[name.slice(0, colon)] === XSI;
 }
 function validate(xml: string): LWProcessBpmnConformance.Report {
  const rules = root.LWProcessBpmnSchema.rules(), V = root.LWProcessBpmnValues;
  const errors: Problem[] = [], notCovered: LWProcessBpmnConformance.Uncovered[] = [], unchecked = new Map<string, number>();
  const ids = new Map<string, {line: number; label: string}>(), hidden = new Set<string>();
  const idrefs: Reference[] = [], refs: Reference[] = [];
  let checked = 0, target = '';
  const report = (): LWProcessBpmnConformance.Report => ({
   conforms: errors.length === 0,
   errors: errors.sort((a, b) => (a.line ?? Infinity) - (b.line ?? Infinity)),
   notCovered,
   unchecked: [...unchecked].map(([namespace, elements]) => ({namespace, elements, note: uncheckedNote(namespace)})),
   checked,
   rules: {bpmn: '2.0', bpsim: '1.0'},
  });
  const fail = (at: {line: number} | undefined, path: string, code: string, message: string) => {
   if (errors.length < MAX_ERRORS) errors.push({...at ? {line: at.line} : {}, path, code, message});
  };
  let doc: Node;
  try {
   doc = root.LWProcessXml.parse(xml, {positions: true});
  } catch (e) {
   fail(undefined, '/', 'xml-malformed', 'The file is not well-formed XML: ' + (e instanceof Error ? e.message : String(e)));
   return report();
  }
  const global = (n: Node) => rules.decls.get(key(n.ns, n.local));
  const accepts = (p: Particle, n: Node) => {
   if (p.k === 'el') return !!global(n) && p.decl.members.has(global(n)!);
   if (p.k === 'local') return n.ns === p.ns && n.local === p.local;
   return p.k === 'any' && (p.not === null || n.ns !== '' && n.ns !== p.not);
  };
  /** Ids inside content that is not checked still count as targets of references. */
  const hide = (n: Node) => {
   if (rules.known.has(n.ns) && n.attrs.id) hidden.add(n.attrs.id.trim());
   n.children.forEach(hide);
  };
  function value(type: string, table: Table, raw: string, node: Node, path: string, what: string): void {
   const r = V.check(type, raw, table.simple);
   if (r.problem) {
    const shown = raw.length > 60 ? raw.slice(0, 60) + '…' : raw;
    fail(node, path, r.enumeration ? 'value-enumeration' : 'value-invalid', `${what} must be ${r.problem}, not "${shown}".`);
    return;
   }
   if (type === 'id') {
    const seen = ids.get(r.value);
    if (seen) {
     const message = `${what} repeats the id "${r.value}" of ${seen.label} on line ${seen.line}; ids must be unique in the file.`;
     fail(node, path, 'id-duplicate', message);
    } else {
     ids.set(r.value, {line: node.line, label: node.name});
    }
   } else if (type === 'idref') {
    idrefs.push({value: r.value, line: node.line, path, what});
   } else if (type === 'qname' || type === 'ref') {
    const q = V.qname(r.value)!;
    if (q.prefix && q.prefix !== 'xml' && !(q.prefix in node.scope)) {
     const message = `${what} uses the namespace prefix "${q.prefix}" in "${r.value}", but that prefix is not declared.`;
     fail(node, path, 'qname-prefix', message);
    } else if (type === 'ref' && (!q.prefix || node.scope[q.prefix] === target)) {
     refs.push({value: q.local, line: node.line, path, what});
    }
   }
  }
  function element(node: Node, decl: Decl, path: string): void {
   if (decl.covered) {
    check(node, typeOf(decl.table, decl.typeName), path);
    return;
   }
   notCovered.push({line: node.line, path, element: node.name, namespace: node.ns, reason: NOT_COVERED});
   hide(node);
  }
  function lax(node: Node, path: string, strict: boolean, nested = false): void {
   const decl = global(node);
   if (decl) {
    element(node, decl, path);
    return;
   }
   if (strict) {
    fail(node, path, 'element-undeclared', `${node.name} is not allowed here: `
     + 'only top-level elements of a known namespace (other than this one) may appear at this point.');
    return;
   }
   if (!rules.known.has(node.ns)) {
    unchecked.set(node.ns, (unchecked.get(node.ns) ?? 0) + 1);
   } else if (!nested) {
    const reason = `${node.local} is not a top-level element of its namespace, so this extension content is not checked (XML Schema skips it).`;
    notCovered.push({line: node.line, path, element: node.name, namespace: node.ns, reason});
   }
   const at = paths(node, path);
   node.children.forEach((c, i) => lax(c, at[i]!, false, nested || rules.known.has(node.ns)));
  }
  /** XPath-like child paths: the qualified name as written, with a 1-based position among same-named siblings when there are several. */
  function paths(parent: Node, path: string): string[] {
   const total = new Map<string, number>(), seen = new Map<string, number>();
   for (const c of parent.children) total.set(c.name, (total.get(c.name) ?? 0) + 1);
   return parent.children.map(c => {
    const n = (seen.get(c.name) ?? 0) + 1;
    seen.set(c.name, n);
    return `${path}/${c.name}${total.get(c.name)! > 1 ? `[${n}]` : ''}`;
   });
  }
  function check(node: Node, declared: Type | Simple, path: string): void {
   checked++;
   let type = declared;
   const xsiType = Object.entries(node.attrs).find(([k]) => k.endsWith(':type') && node.scope[k.slice(0, -5)] === XSI)?.[1];
   if (xsiType !== undefined) {
    const q = V.qname(xsiType.trim());
    const ns = q && (q.prefix ? node.scope[q.prefix] : node.scope['']) || '';
    const found = q && rules.types.get(key(ns, q.local));
    let derived = false;
    for (let t: Type | undefined = found; t && !isSimple(declared); t = t.base) if (t === declared) derived = true;
    if (found && !found.anonymous && derived) {
     type = found;
    } else {
     const wanted = isSimple(declared) ? 'type' : 'type derived from ' + declared.label;
     fail(node, path, 'xsi-type-invalid', `xsi:type="${xsiType}" on ${node.name} does not name a ${wanted} of these rules.`);
    }
   }
   if (isSimple(type)) {
    simple(node, type, path);
    return;
   }
   if (type.abstract) {
    fail(node, path, 'element-abstract', `${node.name} has the abstract type ${type.label}; `
     + 'use a concrete element of its group (or name a concrete type with xsi:type).');
    hide(node);
    return;
   }
   for (const [name, raw] of Object.entries(node.attrs)) attribute(node, type, name, raw, path);
   for (const a of type.attrs.values()) {
    if (a.required && !Object.hasOwn(node.attrs, a.name)) {
     fail(node, path, 'attribute-missing', `${node.name} is missing the required attribute ${a.name} (${a.type}).`);
    }
   }
   const empty = !type.text && !type.content.length, text = node.text;
   if (type.text) {
    value(type.text.simple, type.text.table, text, node, path, `The text of ${node.name}`);
   } else if (!type.mixed && (empty ? text !== '' : /[^\t\n\r ]/.test(text))) {
    const rule = empty ? ' or spaces: it must be empty' : ': only child elements are allowed';
    fail(node, path, 'text-not-allowed', `${node.name} cannot contain text${rule} (found "${text.trim().slice(0, 40)}").`);
   }
   const kids = node.children;
   if (!kids.length && !type.content.length) return;
   const m = match(type.content, kids, accepts), at = paths(node, path);
   if (!m.ok) misplaced(node, type, m, at, path);
   kids.forEach((kid, i) => {
    const p = m.assign[i];
    if (p?.k === 'local') check(kid, typeOf(p.table, p.typeName), at[i]!);
    else if (p?.k === 'any') lax(kid, at[i]!, p.strict);
    else if (global(kid)) element(kid, global(kid)!, at[i]!);
    else hide(kid);
   });
  }
  /** One attribute of a checked element: namespace declarations pass, xsi attributes are limited, the rest are typed or refused. */
  function attribute(node: Node, type: Type, name: string, raw: string, path: string): void {
   if (name === 'xmlns' || name.startsWith('xmlns:')) return;
   const colon = name.indexOf(':'), prefix = colon < 0 ? '' : name.slice(0, colon), local = name.slice(colon + 1);
   const ns = !prefix ? '' : prefix === 'xml' ? XML : node.scope[prefix], at = path + '/@' + name;
   if (ns === undefined) {
    fail(node, at, 'qname-prefix', `Attribute ${name} of ${node.name} uses an undeclared namespace prefix.`);
    return;
   }
   if (ns === XSI) {
    if (!XSI_ALLOWED.includes(local)) fail(node, at, 'attribute-unknown', `${node.name} cannot carry xsi:${local}.`);
    return;
   }
   const a = ns === '' ? type.attrs.get(local) : undefined;
   if (a) {
    value(a.type, a.table, raw, node, at, `Attribute ${name} of ${node.name}`);
   } else if (ns !== '' && type.open === 'strict' && ns !== type.openNs) {
    fail(node, at, 'attribute-undeclared', `Attribute ${name} of ${node.name} is in a namespace no rule declares; `
     + 'only declared attributes of other namespaces may appear here.');
   } else if (ns === '' || !type.open || ns === type.openNs) {
    const allowed = [...type.attrs.keys()].join(', ') || 'none';
    const others = type.open ? ' (and attributes of other namespaces)' : '';
    fail(node, at, 'attribute-unknown', `${node.name} has no attribute ${name}. Allowed: ${allowed}${others}.`);
   }
  }
  /** Reports where the children of `node` stop matching its content: a missing child, an unknown element or one out of order. */
  function misplaced(node: Node, type: Type, m: Matched, at: string[], path: string): void {
   const expected = [...m.expected].slice(0, 6).join('; ') || 'nothing more', order = type.content.map(labelOf).join(', ');
   const kid = node.children[m.at];
   if (!kid) {
    fail(node, path, 'element-missing', `${node.name} is missing a required child: expected ${expected}.`);
    return;
   }
   if (rules.known.has(kid.ns) && !global(kid) && !rules.locals.has(key(kid.ns, kid.local))) {
    fail(kid, at[m.at]!, 'element-unknown', `${kid.name} is not an element of its namespace (${kid.ns}).`);
    return;
   }
   const sequence = order ? ` The children of ${node.name} come in this order: ${order}.` : ' It cannot contain child elements.';
   const message = `${kid.name} is not allowed at this position inside ${node.name}. Expected here: ${expected}.${sequence}`;
   fail(kid, at[m.at]!, 'element-unexpected', message);
  }
  function simple(node: Node, type: Simple, path: string): void {
   for (const name of Object.keys(node.attrs)) {
    if (/^xmlns(:|$)/.test(name) || xsiAllowed(node, name)) continue;
    fail(node, path + '/@' + name, 'attribute-unknown', `${node.name} holds a value and takes no attribute ${name}.`);
   }
   if (node.children.length) {
    const message = `${node.name} holds a value and cannot contain child elements.`;
    fail(node.children[0]!, paths(node, path)[0]!, 'element-unexpected', message);
    node.children.forEach(hide);
   }
   value(type.simple, type.table, node.text, node, path, `The value of ${node.name}`);
  }
  const top = global(doc);
  if (doc.ns === root.LWProcessBpmnRulesModel.tables[0]!.ns && doc.local === 'definitions') {
   target = (doc.attrs.targetNamespace ?? '').trim();
  }
  if (!top || top.abstract) {
   fail(doc, '/' + doc.name, 'root-unknown', `The root element ${doc.name} (namespace ${doc.ns || 'none'}) is not a top-level element `
    + 'of BPMN 2.0 or BPSim 1.0; a BPMN file starts with bpmn:definitions.');
  } else {
   element(doc, top, '/' + doc.name);
  }
  for (const r of idrefs) {
   if (ids.has(r.value) || hidden.has(r.value)) continue;
   fail(r, r.path, 'idref-unresolved', `${r.what} names "${r.value}", but no element in the file has that id.`);
  }
  for (const r of refs) {
   if (ids.has(r.value) || hidden.has(r.value)) continue;
   fail(r, r.path, 'reference-unresolved', `${r.what} refers to "${r.value}", but no element in the file has that id.`);
  }
  return report();
 }
 root.LWProcessBpmnConformance = {validate};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessBpmnConformance;
})(globalThis);
