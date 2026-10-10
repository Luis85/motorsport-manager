/// <reference path="./process-contracts.d.ts" />
/** Closed structural validation, JSON-only admission, semantic diagnostics and content identity. */
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessSchema: Record<string, unknown>; LWProcessGraph: {check(d: LWProcess.Definition): LWProcess.Diagnostic[]};
  LWAssets: {validate(input: unknown): unknown}; LWProcessCatalog?: LWProcess.Catalog};
 // Captured once so later mutation of the global cannot alter admission rules.
 const schema = root.LWProcessSchema, graph = root.LWProcessGraph;
 type Schema = Record<string, unknown>;
 const definitions = schema.definitions as Record<string, Schema>;
 const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
 function safe(input: unknown): void {
  const ancestors = new Set<object>(); let count = 0, strings = 0;
  const visit = (value: unknown, depth: number): void => {
   if (++count > 300000 || depth > 40) throw Error('Definition exceeds the data complexity limit.');
   if (typeof value === 'string') { strings += value.length; if (strings > 4000000) throw Error('Definition text is too large.'); return; }
   if (value === null || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return;
   if (!value || typeof value !== 'object' || !Array.isArray(value) && ![null, Object.prototype].includes(Object.getPrototypeOf(value))) throw Error('Only finite JSON values are allowed.');
   if (ancestors.has(value) || Object.getOwnPropertySymbols(value).length) throw Error('Cyclic or symbolic data is not allowed.');
   ancestors.add(value);
   const descriptors = Object.getOwnPropertyDescriptors(value);
   if (Array.isArray(value) && (Object.keys(descriptors).length !== value.length + 1 || Array.from({length: value.length}, (_, i) => String(i)).some(i => !Object.hasOwn(descriptors, i)))) throw Error('Arrays must be dense.');
   for (const [key, descriptor] of Object.entries(descriptors)) {
    if (Array.isArray(value) && key === 'length') continue;
    if (['__proto__', 'constructor', 'prototype'].includes(key) || descriptor.get || descriptor.set || !descriptor.enumerable) throw Error('Unsafe data field: ' + key);
    visit(descriptor.value, depth + 1);
   }
   ancestors.delete(value);
  };
  visit(input, 0);
 }
 /** Plain names of the top-level lists, so a definition over a limit is told the limit and its own count. */
 const LISTS: Record<string, [string, string]> = {
  '/steps': ['step', 'steps'], '/flows': ['flow', 'flows'], '/resources': ['resource pool', 'resource pools'], '/arrivals': ['arrival rule', 'arrival rules']};
 function lengthMessage(path: string, length: number, schema: Schema): string {
  const min = Number(schema.minItems ?? 0), max = Number(schema.maxItems ?? Infinity), words = LISTS[path], n = (k: number) => k.toLocaleString('en-US');
  if (!words) return 'Array length is out of range: ' + (length > max ? 'at most ' + n(max) : 'at least ' + n(min)) + ' entries, found ' + n(length) + '.';
  const [one, many] = words, plural = (k: number) => n(k) + ' ' + (k === 1 ? one : many);
  if (length > max) return `A process holds at most ${plural(max)}; this one has ${n(length)}.`;
  return `A process needs at least ${plural(min)}; this one has ${n(length)}.`;
 }
 function shape(value: unknown, node: Schema, path: string, errors: LWProcess.Diagnostic[]): void {
  // Only the local `#/definitions/<name>` reference form exists; it makes recursive condition combinators expressible.
  const schema = typeof node.$ref === 'string' ? definitions[node.$ref.slice('#/definitions/'.length)]! : node;
  const fail = (message: string) => { if (errors.length < 100) errors.push({path, code: 'shape', message}); };
  if ('const' in schema && value !== schema.const) fail('Expected ' + String(schema.const) + '.');
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) fail('Expected one of ' + schema.enum.join(', ') + '.');
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  if (types.length && !types.includes(type) && !(type === 'number' && Number.isInteger(value) && types.includes('integer'))) { fail('Expected ' + types.join(' or ') + '.'); return; }
  if (typeof value === 'number' && (value < Number(schema.minimum ?? -Infinity) || value > Number(schema.maximum ?? Infinity))) fail('Number is out of range.');
  if (typeof value === 'string' && (value.length < Number(schema.minLength ?? 0) || value.length > Number(schema.maxLength ?? Infinity) || typeof schema.pattern === 'string' && !new RegExp(schema.pattern).test(value))) fail('String has invalid length or format.');
  if (Array.isArray(value)) {
   if (value.length < Number(schema.minItems ?? 0) || value.length > Number(schema.maxItems ?? Infinity)) fail(lengthMessage(path, value.length, schema));
   if (schema.items) value.forEach((v, i) => shape(v, schema.items as Schema, path + '/' + i, errors));
  } else if (value && typeof value === 'object') {
   const record = value as Record<string, unknown>, properties = schema.properties as Record<string, Schema> | undefined;
   for (const key of (schema.required ?? []) as string[]) if (!Object.hasOwn(record, key)) fail('Missing field: ' + key);
   if (Object.keys(record).length > Number(schema.maxProperties ?? Infinity)) fail('Too many fields.');
   for (const [key, v] of Object.entries(record)) {
    if (schema.propertyNames) shape(key, schema.propertyNames as Schema, path + '/' + key, errors);
    if (properties && Object.hasOwn(properties, key)) shape(v, properties[key]!, path + '/' + key, errors);
    else if (schema.additionalProperties === false) fail('Unknown field: ' + key);
    else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') shape(v, schema.additionalProperties as Schema, path + '/' + key, errors);
   }
  }
 }
 function validate(input: unknown, draft = false): LWProcess.Validation {
  const diagnostics: LWProcess.Diagnostic[] = [];
  try { safe(input); } catch (e) { return {ok: false, acceptable: false, diagnostics: [{path: '/', code: 'data', message: String(e)}]}; }
  shape(input, schema, '', diagnostics);
  if (diagnostics.length) return {ok: false, acceptable: false, diagnostics};
  const definition = copy(input as LWProcess.Definition);
  definition.steps.forEach((step, index) => {
   if (step.scene.asset !== undefined) try { const asset = root.LWAssets.validate(step.scene.asset) as {models: Record<string, unknown>};
    if (!Object.hasOwn(asset.models, 'world')) throw Error('Scene assets require a world model.'); }
   catch (e) { diagnostics.push({path: '/steps/' + index + '/scene/asset', code: 'asset', message: String(e)}); }
  });
  if (diagnostics.length) return {ok: false, acceptable: false, diagnostics};
  diagnostics.push(...graph.check(definition));
  return {ok: !diagnostics.length, acceptable: draft || !diagnostics.length, diagnostics, definition};
 }
 function admit(input: unknown): LWProcess.Definition {
  const checked = validate(input);
  if (!checked.ok) throw Error(checked.diagnostics.map(e => e.path + ': ' + e.message).join('\n'));
  return checked.definition!;
 }
 function fingerprint(input: unknown): string {
  safe(input);
  const canonical = (v: unknown): string => Array.isArray(v) ? '[' + v.map(canonical).join(',') + ']' : v && typeof v === 'object'
   ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical((v as Record<string, unknown>)[k])).join(',') + '}' : JSON.stringify(v);
  const text = canonical(input); let a = 2166136261, b = 2246822519;
  for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b ^ text.charCodeAt(i), 3266489917); }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
 }
 root.LWProcessCatalog = {schema: copy(schema), validate, admit, fingerprint};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessCatalog;
})(globalThis);
