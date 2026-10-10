/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-engine-state.ts" />
/// <reference path="./process-checkpoint-check.ts" />
/**
 * Run checkpoints (LWProcessCheckpoint), owned by the process-definition context: a paused run saved as one JSON file and read back
 * strictly. The studio's Export run checkpoint… / Load checkpoint… and the CLI's `process run --checkpoint-out` / `--checkpoint`
 * use this module; it never touches files, storage or a clock itself.
 *
 * File format (version 1), one JSON object with exactly these fields:
 *   {"kind": "wildlands-process-checkpoint", "version": 1, "process": "<definition id>", "fingerprint": "<16 hex digits>",
 *    "seed": <run seed>, "minute": <clock minute>, "runLength": <whole minutes, or null for no run length>,
 *    "snapshot": <the complete engine state, LWProcessEngineState.Saved>}
 * `fingerprint` is LWProcessCatalog.fingerprint of the applied definition the run belongs to. `seed` and `minute` repeat the
 * snapshot's values for people and tools reading the file; they must agree with it. The definition itself is not included: a
 * checkpoint continues a run of a definition the reader already has, and the fingerprint proves it is the same one.
 *
 * Read model: the snapshot carries the complete ledger and series (see LWProcessEngineState), so a restored run's measurements
 * continue from minute 0 exactly as an uninterrupted run's would; nothing restarts at the checkpoint minute and nothing is made up.
 *
 * Reading untrusted text is two steps, so a caller can name the process before the full check:
 *  - `parse(text)`: at most `MAX_BYTES` characters, valid JSON, plain data only (LWProcessCheckpointCheck.plain: no accessors and no
 *    `__proto__`, `constructor` or `prototype` key at any depth, bounded depth and size), the known kind and version, and a header of
 *    the right types (process id, fingerprint, seed 0..2,147,483,647, minute, run length null or 1 or more and not before the
 *    minute). Unknown fields are refused. It never evaluates anything.
 *  - `verify(checkpoint, definition)`: the checkpoint names this definition's id and its fingerprint equals the definition's
 *    (a mismatch names both), and the snapshot passes LWProcessCheckpointCheck.state against the definition and agrees with the
 *    header's seed and minute. It returns a detached checked copy that a session can restore (RunOptions.restore).
 * Every refusal is an Error with a plain sentence; nothing is changed by reading.
 */
declare namespace LWProcessCheckpoint {
 interface Checkpoint {
  kind: 'wildlands-process-checkpoint'; version: 1; process: string; fingerprint: string; seed: number; minute: number;
  runLength: number | null; snapshot: LWProcessEngineState.Saved;
 }
 interface Api {
  readonly KIND: 'wildlands-process-checkpoint';
  readonly VERSION: 1;
  /** Longest checkpoint text read, in characters (16 MiB). */
  readonly MAX_BYTES: number;
  /** A detached checkpoint of a run of `definition` whose saved state is `snapshot` (Session.state()) and whose run length is `runLength`. */
  create(definition: LWProcess.Definition, runLength: number | null, snapshot: LWProcessEngineState.Saved): Checkpoint;
  /** Strict structural reading of untrusted text (see the header); the snapshot is checked against a definition by `verify`. */
  parse(text: string): Checkpoint;
  /** Checks a parsed (or any untrusted) checkpoint against the applied `definition`; returns a detached checked copy. */
  verify(checkpoint: unknown, definition: LWProcess.Definition): Checkpoint;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 type Checkpoint = LWProcessCheckpoint.Checkpoint;
 const root = inputRoot as {LWProcessCatalog: LWProcess.Catalog; LWProcessCheckpointCheck: LWProcessCheckpointCheck.Api;
  LWProcessCheckpoint?: LWProcessCheckpoint.Api};
 const KIND = 'wildlands-process-checkpoint', VERSION = 1, MAX_BYTES = 16 * 1024 * 1024, MAX_SEED = 2147483647;
 const FIELDS = ['kind', 'version', 'process', 'fingerprint', 'seed', 'minute', 'runLength', 'snapshot'];
 const ID = /^[a-z][a-z0-9-]{0,63}$/, FINGERPRINT = /^[0-9a-f]{16}$/;
 const whole = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
 function create(definition: LWProcess.Definition, runLength: number | null, snapshot: LWProcessEngineState.Saved): Checkpoint {
  const copy = JSON.parse(JSON.stringify(snapshot)) as LWProcessEngineState.Saved;
  return {kind: KIND, version: VERSION, process: definition.id, fingerprint: root.LWProcessCatalog.fingerprint(definition), seed: copy.seed,
   minute: copy.clock.minute, runLength, snapshot: copy};
 }
 /** The header checks shared by `parse` and `verify`, on a value already known to be plain data. */
 function header(value: unknown): Checkpoint {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw Error('This file is not a run checkpoint: it is not a JSON object.');
  const c = value as Record<string, unknown>;
  if (c.kind !== KIND) throw Error(`This file is not a Wildlands run checkpoint: its kind must be "${KIND}".`);
  if (c.version !== VERSION) throw Error(`This run checkpoint has version ${JSON.stringify(c.version)}; only version ${VERSION} can be read.`);
  const unknown = Object.keys(c).filter(key => !FIELDS.includes(key)), missing = FIELDS.filter(key => !Object.hasOwn(c, key));
  if (unknown.length) throw Error(`This run checkpoint has an unknown field: ${unknown[0]!.slice(0, 64)}.`);
  if (missing.length) throw Error(`This run checkpoint is missing its ${missing[0]} field.`);
  if (typeof c.process !== 'string' || !ID.test(c.process)) throw Error('The checkpoint\'s process must be a process id.');
  if (typeof c.fingerprint !== 'string' || !FINGERPRINT.test(c.fingerprint)) throw Error('The checkpoint\'s fingerprint must be 16 hex digits.');
  if (!whole(c.seed, 0, MAX_SEED)) throw Error(`The checkpoint's seed must be a whole number from 0 to ${MAX_SEED}.`);
  if (!whole(c.minute, 0)) throw Error('The checkpoint\'s minute must be a whole number of minutes (0 or more).');
  if (c.runLength !== null && !whole(c.runLength, Math.max(1, c.minute as number))) {
   throw Error('The checkpoint\'s run length must be null or a whole number of minutes, at least 1 and not before its minute.');
  }
  if (c.snapshot === null || typeof c.snapshot !== 'object' || Array.isArray(c.snapshot)) throw Error('The checkpoint\'s snapshot must be an object.');
  return c as unknown as Checkpoint;
 }
 function parse(text: string): Checkpoint {
  if (typeof text !== 'string') throw Error('A run checkpoint is read from text.');
  if (text.length > MAX_BYTES) throw Error('This file is larger than 16 MiB, the largest run checkpoint that is read.');
  let value: unknown;
  try { value = JSON.parse(text.replace(/^﻿/, '')); } catch { throw Error('This file is not a run checkpoint: it is not valid JSON.'); }
  return header(root.LWProcessCheckpointCheck.plain(value, 'checkpoint'));
 }
 function verify(checkpoint: unknown, definition: LWProcess.Definition): Checkpoint {
  const c = header(root.LWProcessCheckpointCheck.plain(checkpoint, 'checkpoint'));
  if (c.process !== definition.id) throw Error(`This checkpoint belongs to the process ${c.process}, not to ${definition.id}.`);
  const fingerprint = root.LWProcessCatalog.fingerprint(definition);
  if (c.fingerprint !== fingerprint) {
   throw Error(`This checkpoint was saved from definition fingerprint ${c.fingerprint}, but the applied definition of ${definition.name} has`
    + ` fingerprint ${fingerprint}. Import or apply the definition the checkpoint was saved from, then load the checkpoint again.`);
  }
  let snapshot: LWProcessEngineState.Saved;
  try { snapshot = root.LWProcessCheckpointCheck.state(definition, c.snapshot); } catch (e) {
   throw Error('The checkpoint\'s run state is not valid for this process: ' + (e instanceof Error ? e.message : String(e)));
  }
  if (snapshot.seed !== c.seed || snapshot.clock.minute !== c.minute) throw Error('The checkpoint\'s seed and minute do not match its run state.');
  return {...c, snapshot};
 }
 root.LWProcessCheckpoint = {KIND, VERSION, MAX_BYTES, create, parse, verify};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessCheckpoint;
})(globalThis);
