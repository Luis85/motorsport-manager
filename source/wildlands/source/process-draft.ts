/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-diff.ts" />
/**
 * Single source of truth for the UNAPPLIED draft text of each process in the studio.
 *
 * The draft is plain JSON text (so half-typed, invalid JSON is representable). The active definition is the applied one the
 * simulation runs; the draft never changes it. The store keeps one draft per process index, so switching process never
 * discards edits. It also keeps a bounded undo/redo history of the active process's draft, in memory only (the history is never
 * stored): typing from one source within a second is one step, and a labelled write (a removed row) is always its own step.
 * Nothing here touches the DOM, a session or storage. The opt-in recovery copy of the draft text in browser storage is
 * LWProcessRecovery's policy (`process-recovery.ts`): it subscribes to this store and writes the copy itself; a recovered copy comes
 * back through `write(text, 'recovery')`.
 *
 * Contract for every editor surface (step editor, Definition modal, Activity modal, raw JSON editor, tuning form, toolbar):
 *  - read the draft with `read()` or `parse()`; never keep a private copy of the draft text;
 *  - write with `write(text, source, label?)` where `source` names the writer (e.g. 'step-editor', 'definition', 'raw', 'tuning')
 *    and `label` optionally says what a structural edit did ('Removed Product owner'); a write that does not change the text is
 *    ignored and does not notify;
 *  - `undo()` and `redo()` step through the history and notify with source 'undo' or 'redo';
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
 interface Event {source: string; text: string; label?: string}
 interface Store {
  /** The unapplied draft text for the active process. */
  read(): string;
  /** Replaces the draft text. `source` identifies the writer for subscribers; `label` names a structural edit. Unchanged text is ignored. */
  write(text: string, source: string, label?: string): void;
  /** Goes back one history step; false when there is none. */
  undo(): boolean;
  /** Re-applies the last undone step; false when there is none (any new write clears the redo steps). */
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  /** The draft as a process definition shape (steps, flows, resources arrays) or undefined when it is not valid JSON of that shape. */
  parse(): LWProcess.Definition | undefined;
  /** The formatted JSON of the active (applied) definition. */
  activeText(): string;
  /** True when the draft text differs from the active text. */
  changed(): boolean;
  /**
   * True when `text` (default: the draft) holds the same definition as the active one, ignoring formatting and key order.
   * Invalid JSON is never the same. Editors use it to offer Apply only when applying would change something.
   */
  same(text?: string): boolean;
  diff(options?: DiffOptions): Changes;
  /** 'Unapplied draft: 3 steps, 1 resource changed', or '' when nothing differs. */
  describeDiff(options?: DiffOptions): string;
  subscribe(listener: (event: Event) => void): () => void;
  /** Resets the draft for process `index` to the active definition, restoring edits stashed by `leave()` for that process. Clears the history. */
  enter(index: number, active: LWProcess.Definition): void;
  /** Remembers the current draft so a later `enter()` of the same index restores it. Call before switching process. */
  leave(): void;
  /** Resets the draft to the active definition text. */
  restore(source?: string): void;
  index(): number;
 }
 interface Api {
  /** `clock` (milliseconds) only groups quick typing into one undo step; it defaults to the page's monotonic clock. */
  create(clock?: () => number): Store;
  /** Formats a change summary; `prefix` defaults to 'Unapplied draft'. */
  describe(changes: Changes, prefix?: string): string;
  format(definition: LWProcess.Definition): string;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessDraft?: LWProcessDraft.Api; LWProcessDiff: LWProcessDiff.Api};
 const format = (d: LWProcess.Definition) => JSON.stringify(d, null, 2);
 /** A value with every object's keys sorted, so two texts of one definition compare equal. */
 const canon = (v: unknown): unknown => Array.isArray(v) ? v.map(canon)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon((v as Record<string, unknown>)[k])])) : v;
 const canonical = (text: string): string | undefined => { try { return JSON.stringify(canon(JSON.parse(text))); } catch { return undefined; } };
 function shaped(text: string): LWProcess.Definition | undefined {
  try {
   const d = JSON.parse(text) as LWProcess.Definition;
   return d && typeof d === 'object' && Array.isArray(d.steps) && Array.isArray(d.flows) && Array.isArray(d.resources) ? d : undefined;
  } catch { return undefined; }
 }
 const EMPTY = (invalid: boolean): LWProcessDraft.Changes => root.LWProcessDiff.empty(invalid);
 const compare = (active: LWProcess.Definition, draft: LWProcess.Definition, o: LWProcessDraft.DiffOptions) => root.LWProcessDiff.compare(active, draft, o);
 const describe = (c: LWProcessDraft.Changes, prefix?: string): string => root.LWProcessDiff.describe(c, prefix);
 /** At most this many undo steps are kept; typing from one source within GROUP_MS is one step. */
 const HISTORY = 100, GROUP_MS = 1000, TYPING = new Set(['raw', 'tuning']);
 function create(clock: () => number = () => performance.now()): LWProcessDraft.Store {
  let at = 0, activeText = '', activeKey = '', activeDef: LWProcess.Definition | undefined, text = '';
  const stash = new Map<number, string>(), listeners = new Set<(event: LWProcessDraft.Event) => void>();
  let past: string[] = [], future: string[] = [], lastSource = '', lastAt = -Infinity;
  const notify = (source: string, label?: string) => { for (const fn of [...listeners]) fn(label === undefined ? {source, text} : {source, text, label}); };
  const set = (next: string, source: string, label?: string) => {
   if (next === text) return;
   const now = clock(), grouped = label === undefined && TYPING.has(source) && source === lastSource && now - lastAt < GROUP_MS && past.length > 0;
   if (!grouped) { past.push(text); if (past.length > HISTORY) past.shift(); }
   future = []; lastSource = label === undefined ? source : ''; lastAt = now; text = next; notify(source, label);
  };
  const step = (from: string[], to: string[], source: string) => {
   const back = from.pop(); if (back === undefined) return false;
   to.push(text); text = back; lastSource = ''; notify(source); return true;
  };
  const diff = (o: LWProcessDraft.DiffOptions = {}): LWProcessDraft.Changes => {
   const draft = shaped(text); if (!draft) return EMPTY(true);
   const active = activeDef ?? shaped(activeText); return active ? compare(active, draft, o) : EMPTY(false);
  };
  return {
   read: () => text, write: (next, source, label) => set(String(next), source, label), parse: () => shaped(text), activeText: () => activeText,
   changed: () => text !== activeText, undo: () => step(past, future, 'undo'), redo: () => step(future, past, 'redo'),
   canUndo: () => past.length > 0, canRedo: () => future.length > 0,
   diff, describeDiff: o => text === activeText ? '' : describe(diff(o)),
   same: (candidate = text) => candidate === activeText || canonical(candidate) === activeKey,
   subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
   enter(index, active) {
    at = index; activeDef = JSON.parse(JSON.stringify(active)) as LWProcess.Definition; activeText = format(activeDef); activeKey = canonical(activeText) ?? '';
    const kept = stash.get(index); stash.delete(index);
    text = kept !== undefined && kept !== activeText ? kept : activeText; past = []; future = []; lastSource = ''; notify('enter');
   },
   leave() { stash.set(at, text); },
   restore(source = 'restore') { set(activeText, source); },
   index: () => at,
  };
 }
 root.LWProcessDraft = {create, describe, format};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessDraft;
})(globalThis);
