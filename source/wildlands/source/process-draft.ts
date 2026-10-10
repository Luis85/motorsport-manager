/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-diff.ts" />
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
 /** How many entities differ between the active definition and the draft, and which steps changed (LWProcessDiff). */
 type Changes = LWProcessDiff.Changes;
 type DiffOptions = LWProcessDiff.Options;
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
 const root = inputRoot as {LWProcessDraft?: LWProcessDraft.Api; LWProcessDiff: LWProcessDiff.Api};
 const format = (d: LWProcess.Definition) => JSON.stringify(d, null, 2);
 function shaped(text: string): LWProcess.Definition | undefined {
  try {
   const d = JSON.parse(text) as LWProcess.Definition;
   return d && typeof d === 'object' && Array.isArray(d.steps) && Array.isArray(d.flows) && Array.isArray(d.resources) ? d : undefined;
  } catch { return undefined; }
 }
 const EMPTY = (invalid: boolean): LWProcessDraft.Changes => root.LWProcessDiff.empty(invalid);
 const compare = (active: LWProcess.Definition, draft: LWProcess.Definition, o: LWProcessDraft.DiffOptions) => root.LWProcessDiff.compare(active, draft, o);
 const describe = (c: LWProcessDraft.Changes, prefix?: string): string => root.LWProcessDiff.describe(c, prefix);
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
