/// <reference path="./process-contracts.d.ts" />
/**
 * In-dialog undo and redo for the step editor's form (owner: the authoring package). A bounded, in-memory history of form
 * snapshots (opaque strings, normally the JSON of the detached step model); it is never written to storage, starts when the
 * dialog loads a step and is dropped when the dialog closes or moves to another step.
 *
 * Contract: call `record(before, group)` with the snapshot from BEFORE a change. Changes with the same non-empty `group` (one
 * text field being typed into) within `GROUP_MS` of each other are one step; a change without a group (a removed row, a select,
 * an added path) is always its own step. `undo(current)` returns the snapshot to restore and keeps `current` for `redo`; any new
 * record clears the redo steps. At most `LIMIT` steps are kept. Pure apart from the injected clock; no DOM, session or storage.
 */
declare namespace LWProcessStepHistory {
 interface Entry {
  snapshot: string;
  /** What the change did ('Removed need 2'), shown when it is undone; '' for ordinary edits. */
  label: string;
  /** A selector of the control to focus after undoing it (the restored row); '' keeps the focus where it is. */
  focus: string;
 }
 interface History {
  record(before: string, group?: string, label?: string, focus?: string): void;
  /** The entry to restore, or undefined when there is nothing to undo. */
  undo(current: string): Entry | undefined;
  redo(current: string): Entry | undefined;
  canUndo(): boolean;
  canRedo(): boolean;
  reset(): void;
 }
 interface Api {
  /** `clock` (milliseconds) only groups quick typing; it defaults to the page's monotonic clock. */
  create(clock?: () => number): History;
  LIMIT: number;
  GROUP_MS: number;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessStepHistory?: LWProcessStepHistory.Api};
 const LIMIT = 100, GROUP_MS = 1000;
 function create(clock: () => number = () => performance.now()): LWProcessStepHistory.History {
  let past: LWProcessStepHistory.Entry[] = [], future: LWProcessStepHistory.Entry[] = [], lastGroup = '', lastAt = -Infinity;
  return {
   record(before, group = '', label = '', focus = '') {
    const now = clock(), grouped = group !== '' && group === lastGroup && now - lastAt < GROUP_MS && past.length > 0;
    if (!grouped) {
     past.push({snapshot: before, label, focus});
     if (past.length > LIMIT) past.shift();
    }
    future = [];
    lastGroup = group;
    lastAt = now;
   },
   undo(current) {
    const entry = past.pop();
    if (!entry) return undefined;
    future.push({snapshot: current, label: entry.label, focus: entry.focus});
    lastGroup = '';
    return entry;
   },
   redo(current) {
    const entry = future.pop();
    if (!entry) return undefined;
    past.push({snapshot: current, label: entry.label, focus: entry.focus});
    lastGroup = '';
    return entry;
   },
   canUndo: () => past.length > 0,
   canRedo: () => future.length > 0,
   reset() {
    past = [];
    future = [];
    lastGroup = '';
    lastAt = -Infinity;
   },
  };
 }
 root.LWProcessStepHistory = {create, LIMIT, GROUP_MS};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessStepHistory;
})(globalThis);
