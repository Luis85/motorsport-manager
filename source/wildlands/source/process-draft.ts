/// <reference path="./process-contracts.d.ts" />
/**
 * Single source of truth for the UNAPPLIED draft text of each process in the studio.
 *
 * The draft is plain JSON text (so half-typed, invalid JSON is representable). The active definition is the applied one the
 * simulation runs; the draft never changes it. The store keeps one draft per process index, so switching process never
 * discards edits. Nothing here touches the DOM, a session or storage.
 *
 * Contract for every editor surface (step editor, Definition modal, Activity modal, raw JSON editor, tuning form, toolbar):
 *  - read the draft with `read()` or `parse()`; never keep a private copy of the draft text;
 *  - write with `write(text, source)` where `source` names the writer (e.g. 'step-editor', 'definition', 'raw', 'tuning');
 *    a write that does not change the text is ignored and does not notify;
 *  - `subscribe(fn)` is called synchronously after every change with `{source, text}` and returns an unsubscribe function;
 *    a subscriber must not write back unless it is changing the text for its own reason;
 *  - `changed()` and `describeDiff()` drive "Unapplied draft: ..." indicators; `diff({ignoreStep})` supports "other changes
 *    outside this step" banners;
 *  - after applying (or importing, or rebuilding) call `enter(index, activeDefinition)`, which resets the draft to the active
 *    definition and, when this process was left with unapplied edits, restores them; `restore()` resets to the active text.
 *  - a raw JSON `<textarea id="draft">` may mirror the store: set its value from `read()` on every notification whose source
 *    is not its own, and call `write(textarea.value, 'raw')` on input.
 */
declare namespace LWProcessDraft {
 /** How many entities differ between the active definition and the draft, and which steps changed. */
 interface Changes {
  steps: number; flows: number; resources: number; arrivals: number;
  /** Top-level process settings (name, description, start, ...) other than the revision. */
  meta: number;
  /** True when the draft is not parseable process JSON, so no counts are available. */
  invalid: boolean;
  changedSteps: {id: string; name: string; change: 'added' | 'removed' | 'changed'}[];
 }
 interface DiffOptions {
  /** Ignore this step and its outgoing flows, to report only changes outside it. */
  ignoreStep?: string;
 }
 interface Event {source: string; text: string}
 interface Store {
  /** The unapplied draft text for the active process. */
  read(): string;
  /** Replaces the draft text. `source` identifies the writer for subscribers. Unchanged text is ignored. */
  write(text: string, source: string): void;
  /** The draft as a process definition shape (steps, flows, resources arrays) or undefined when it is not valid JSON of that shape. */
  parse(): LWProcess.Definition | undefined;
  /** The formatted JSON of the active (applied) definition. */
  activeText(): string;
  /** True when the draft text differs from the active text. */
  changed(): boolean;
  diff(options?: DiffOptions): Changes;
  /** 'Unapplied draft: 3 steps, 1 resource changed', or '' when nothing differs. */
  describeDiff(options?: DiffOptions): string;
  subscribe(listener: (event: Event) => void): () => void;
  /** Resets the draft for process `index` to the active definition, restoring edits stashed by `leave()` for that process. */
  enter(index: number, active: LWProcess.Definition): void;
  /** Remembers the current draft so a later `enter()` of the same index restores it. Call before switching process. */
  leave(): void;
  /** Resets the draft to the active definition text. */
  restore(source?: string): void;
  index(): number;
 }
 interface Api {
  create(): Store;
  /** Formats a change summary; `prefix` defaults to 'Unapplied draft'. */
  describe(changes: Changes, prefix?: string): string;
  format(definition: LWProcess.Definition): string;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessDraft?: LWProcessDraft.Api};
 const format = (d: LWProcess.Definition) => JSON.stringify(d, null, 2);
 const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
 const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
 function shaped(text: string): LWProcess.Definition | undefined {
  try {
   const d = JSON.parse(text) as LWProcess.Definition;
   return d && typeof d === 'object' && Array.isArray(d.steps) && Array.isArray(d.flows) && Array.isArray(d.resources) ? d : undefined;
  } catch { return undefined; }
 }
 const EMPTY = (invalid: boolean): LWProcessDraft.Changes => ({steps: 0, flows: 0, resources: 0, arrivals: 0, meta: 0, invalid, changedSteps: []});
 function byId<T extends {id: string}>(list: T[]): Map<string, T> { return new Map(list.map(item => [item.id, item])); }
 function countById<T extends {id: string}>(before: T[], after: T[], skip: (item: T) => boolean = () => false): number {
  const a = byId(before.filter(i => !skip(i))), b = byId(after.filter(i => !skip(i)));
  let n = 0;
  for (const [id, item] of b) if (!a.has(id) || !same(a.get(id), item)) n++;
  for (const id of a.keys()) if (!b.has(id)) n++;
  return n;
 }
 function compare(active: LWProcess.Definition, draft: LWProcess.Definition, o: LWProcessDraft.DiffOptions): LWProcessDraft.Changes {
  const skip = o.ignoreStep, out = EMPTY(false);
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
  const rest = (d: LWProcess.Definition) => { const {steps: _s, flows: _f, resources: _r, arrivals: _a, revision: _v, ...others} = d; return others as Record<string, unknown>; };
  const left = rest(active), right = rest(draft);
  out.meta = [...new Set([...Object.keys(left), ...Object.keys(right)])].filter(k => !same(left[k], right[k])).length;
  return out;
 }
 function describe(c: LWProcessDraft.Changes, prefix = 'Unapplied draft'): string {
  if (c.invalid) return `${prefix}: not valid process JSON yet`;
  const parts = [c.steps && plural(c.steps, 'step'), c.flows && plural(c.flows, 'flow'), c.resources && plural(c.resources, 'resource'), c.arrivals && plural(c.arrivals, 'arrival rule'), c.meta && plural(c.meta, 'process setting')].filter(Boolean);
  return parts.length ? `${prefix}: ${parts.join(', ')} changed` : `${prefix}: formatting only`;
 }
 function create(): LWProcessDraft.Store {
  let at = 0, activeText = '', activeDef: LWProcess.Definition | undefined, text = '';
  const stash = new Map<number, string>(), listeners = new Set<(event: LWProcessDraft.Event) => void>();
  const notify = (source: string) => { for (const fn of [...listeners]) fn({source, text}); };
  const set = (next: string, source: string) => { if (next === text) return; text = next; notify(source); };
  const diff = (o: LWProcessDraft.DiffOptions = {}): LWProcessDraft.Changes => {
   const draft = shaped(text); if (!draft) return EMPTY(true);
   const active = activeDef ?? shaped(activeText); return active ? compare(active, draft, o) : EMPTY(false);
  };
  return {
   read: () => text, write: (next, source) => set(String(next), source), parse: () => shaped(text), activeText: () => activeText, changed: () => text !== activeText,
   diff, describeDiff: o => text === activeText ? '' : describe(diff(o)),
   subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
   enter(index, active) {
    at = index; activeDef = JSON.parse(JSON.stringify(active)) as LWProcess.Definition; activeText = format(activeDef);
    const kept = stash.get(index); stash.delete(index);
    text = kept !== undefined && kept !== activeText ? kept : activeText; notify('enter');
   },
   leave() { stash.set(at, text); },
   restore(source = 'restore') { set(activeText, source); },
   index: () => at,
  };
 }
 root.LWProcessDraft = {create, describe, format};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessDraft;
})(globalThis);
