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
 const rest = (d: LWProcess.Definition) => { const {steps: _s, flows: _f, resources: _r, arrivals: _a, revision: _v, ...others} = d; return others as Record<string, unknown>; };
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
 function describe(c: LWProcessDiff.Changes, prefix = 'Unapplied draft'): string {
  if (c.invalid) return `${prefix}: not valid process JSON yet`;
  const parts = [c.steps && plural(c.steps, 'step'), c.flows && plural(c.flows, 'flow'), c.resources && plural(c.resources, 'resource'), c.arrivals && plural(c.arrivals, 'arrival rule'), c.meta && plural(c.meta, 'process setting')].filter(Boolean);
  return parts.length ? `${prefix}: ${parts.join(', ')} changed` : `${prefix}: formatting only`;
 }
 root.LWProcessDiff = {compare, settings, empty, describe};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessDiff;
})(globalThis);
