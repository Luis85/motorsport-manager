/// <reference path="./process-contracts.d.ts" />
/**
 * Pure comparison of two process definitions by identity: which steps, flows, resources, arrival rules and top-level process
 * settings differ. Shared by the studio draft store (LWProcessDraft) and the `process diff` CLI command. No DOM, session,
 * clock or storage; inputs are only read. Values compare by their JSON text, so key order inside an entity counts as a change.
 */
declare namespace LWProcessDiff {
 /** How many entities differ between a reference (`before`) and a changed (`after`) definition, and which steps changed. */
 interface Changes {
  steps: number; flows: number; resources: number; arrivals: number;
  /** Top-level process settings (name, description, start, ...) other than the revision. */
  meta: number;
  /** True when the draft is not parseable process JSON, so no counts are available. */
  invalid: boolean;
  changedSteps: {id: string; name: string; change: 'added' | 'removed' | 'changed'}[];
 }
 type Change = 'added' | 'removed' | 'changed';
 /** One changed entity: steps, resources and flows by id; arrival rules by their 0-based position, named "Arrival rule <n>". */
 interface Entity {id: string; name: string; change: Change}
 interface Arrival {index: number; name: string; change: Change}
 /** One changed scalar value; `before` or `after` is absent when the value was added or removed. Paths use ids, and indexes inside lists. */
 interface Field {path: string; before?: LWProcess.Scalar; after?: LWProcess.Scalar}
 /** What changed, itemised for review: entities by id and every scalar value with its old and new value. */
 interface Detail {changedResources: Entity[]; changedFlows: Entity[]; changedArrivals: Arrival[]; fields: Field[];}
 interface Options {
  /** Ignore this step and its outgoing flows, to report only changes outside it. */
  ignoreStep?: string;
 }
 interface Api {
  compare(before: LWProcess.Definition, after: LWProcess.Definition, options?: Options): Changes;
  /** Names of the top-level settings counted by `meta`, sorted. */
  settings(before: LWProcess.Definition, after: LWProcess.Definition): string[];
  /** A zero summary; `invalid` marks a draft that is not process JSON. */
  empty(invalid: boolean): Changes;
  /** Changed resources, flows and arrival rules, and each changed scalar value (`/resources/developers/capacity` from 2 to 3). */
  detail(before: LWProcess.Definition, after: LWProcess.Definition): Detail;
  /** '3 steps, 1 resource changed' after the prefix, 'formatting only' when nothing differs. */
  describe(changes: Changes, prefix?: string): string;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessDiff?: LWProcessDiff.Api};
 const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
 const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
 const empty = (invalid: boolean): LWProcessDiff.Changes => ({steps: 0, flows: 0, resources: 0, arrivals: 0, meta: 0, invalid, changedSteps: []});
 function byId<T extends {id: string}>(list: T[]): Map<string, T> { return new Map(list.map(item => [item.id, item])); }
 function countById<T extends {id: string}>(before: T[], after: T[], skip: (item: T) => boolean = () => false): number {
  const a = byId(before.filter(i => !skip(i))), b = byId(after.filter(i => !skip(i)));
  let n = 0;
  for (const [id, item] of b) if (!a.has(id) || !same(a.get(id), item)) n++;
  for (const id of a.keys()) if (!b.has(id)) n++;
  return n;
 }
 /** The process settings of a definition: every top-level field except the lists and the revision. */
 function rest(d: LWProcess.Definition): Record<string, unknown> {
  const {steps: _s, flows: _f, resources: _r, arrivals: _a, revision: _v, ...others} = d;
  return others as Record<string, unknown>;
 }
 function settings(active: LWProcess.Definition, draft: LWProcess.Definition): string[] {
  const left = rest(active), right = rest(draft);
  return [...new Set([...Object.keys(left), ...Object.keys(right)])].filter(k => !same(left[k], right[k])).sort();
 }
 function compare(active: LWProcess.Definition, draft: LWProcess.Definition, o: LWProcessDiff.Options = {}): LWProcessDiff.Changes {
  const skip = o.ignoreStep, out = empty(false);
  const a = byId(active.steps.filter(s => s.id !== skip)), b = byId(draft.steps.filter(s => s.id !== skip));
  for (const [id, step] of b) {
   if (!a.has(id)) out.changedSteps.push({id, name: step.name, change: 'added'});
   else if (!same(a.get(id), step)) out.changedSteps.push({id, name: step.name, change: 'changed'});
  }
  for (const [id, step] of a) if (!b.has(id)) out.changedSteps.push({id, name: step.name, change: 'removed'});
  out.steps = out.changedSteps.length;
  out.flows = countById(active.flows, draft.flows, f => f.from === skip);
  out.resources = countById(active.resources, draft.resources);
  const arrivals = Math.max(active.arrivals?.length ?? 0, draft.arrivals?.length ?? 0);
  for (let i = 0; i < arrivals; i++) if (!same(active.arrivals?.[i], draft.arrivals?.[i])) out.arrivals++;
  out.meta = settings(active, draft).length;
  return out;
 }
 const scalar = (v: unknown): v is LWProcess.Scalar => v === null || typeof v !== 'object';
 /**
  * Every scalar difference below `path`; a whole object added or removed is reported by its entity, not value by value.
  * A top-level setting that is a flat record of scalars (the display calendar) has no entity, so `detail` compares an added
  * or removed one against an empty record and reports each value (`/calendar/minutesPerDay`).
  */
 function walk(path: string, a: unknown, b: unknown, out: LWProcessDiff.Field[]): void {
  if (same(a, b)) return;
  if ((a === undefined || scalar(a)) && (b === undefined || scalar(b))) {
   out.push({path, ...a === undefined ? {} : {before: a}, ...b === undefined ? {} : {after: b}}); return;
  }
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return;
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
  const keys = Array.isArray(a) ? Array.from({length: Math.max(a.length, (b as unknown[]).length)}, (_, i) => String(i))
   : [...new Set([...Object.keys(x), ...Object.keys(y)])].sort();
  for (const k of keys) walk(path + '/' + k, x[k], y[k], out);
 }
 function entities<T extends {id: string}>(before: T[], after: T[], name: (item: T) => string): LWProcessDiff.Entity[] {
  const a = byId(before), b = byId(after), out: LWProcessDiff.Entity[] = [];
  for (const [id, item] of b) {
   if (!a.has(id)) out.push({id, name: name(item), change: 'added'}); else if (!same(a.get(id), item)) out.push({id, name: name(item), change: 'changed'});
  }
  for (const [id, item] of a) if (!b.has(id)) out.push({id, name: name(item), change: 'removed'});
  return out;
 }
 function detail(before: LWProcess.Definition, after: LWProcess.Definition): LWProcessDiff.Detail {
  const fields: LWProcessDiff.Field[] = [], changedArrivals: LWProcessDiff.Arrival[] = [], n = Math.max(before.arrivals.length, after.arrivals.length);
  for (let i = 0; i < n; i++) {
   const a = before.arrivals[i], b = after.arrivals[i];
   if (!same(a, b)) changedArrivals.push({index: i, name: 'Arrival rule ' + (i + 1), change: !a ? 'added' : !b ? 'removed' : 'changed'});
  }
  const left = rest(before), right = rest(after);
  const flat = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(scalar);
  const side = (v: unknown, other: unknown) => v === undefined && flat(other) ? {} : v;
  for (const k of settings(before, after)) walk('/' + k, side(left[k], right[k]), side(right[k], left[k]), fields);
  for (const list of ['steps', 'resources', 'flows'] as const) {
   const a = byId<{id: string}>(before[list]), b = byId<{id: string}>(after[list]);
   for (const [id, item] of b) walk('/' + list + '/' + id, a.get(id), item, fields);
  }
  walk('/arrivals', before.arrivals, after.arrivals, fields);
  const changedFlows = entities(before.flows, after.flows, f => f.label ?? f.from + ' → ' + f.to);
  return {changedResources: entities(before.resources, after.resources, r => r.name), changedFlows, changedArrivals, fields};
 }
 function describe(c: LWProcessDiff.Changes, prefix = 'Unapplied draft'): string {
  if (c.invalid) return `${prefix}: not valid process JSON yet`;
  const parts = [
   c.steps && plural(c.steps, 'step'),
   c.flows && plural(c.flows, 'flow'),
   c.resources && plural(c.resources, 'resource'),
   c.arrivals && plural(c.arrivals, 'arrival rule'),
   c.meta && plural(c.meta, 'process setting'),
  ].filter(Boolean);
  return parts.length ? `${prefix}: ${parts.join(', ')} changed` : `${prefix}: formatting only`;
 }
 root.LWProcessDiff = {compare, settings, empty, detail, describe};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessDiff;
})(globalThis);
