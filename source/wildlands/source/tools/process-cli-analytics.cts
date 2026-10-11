/// <reference path="../process-contracts.d.ts" />
/// <reference path="../process-replicate.ts" />
/**
 * Run and analysis commands of the process CLI (Node only; owned by the process CLI): `run` with its optional streamed event log,
 * `replicate`, `compare` and the definition comparison shared by `diff` and `compare`. Option names, required options and flag
 * syntax are checked by the dispatcher (process-cli.cts); the numeric bounds here are checked before any file is read or any run
 * starts, so a bad `--minutes`, `--runs`, `--warmup` or replication plan exits 2 with a message that names the flag.
 * `--warmup W` (replicate and compare) adds the windowed KPIs "after minute W" (LWProcessReplicate); without it reports are unchanged.
 *
 * Run checkpoints (LWProcessCheckpoint): `run --checkpoint FILE` continues the run saved in FILE instead of starting at minute 0. The
 * file is read strictly and its fingerprint must equal the `--input` definition's (a mismatch names both); its seed and run length
 * are used, so `--seed` is refused with it, and `--minutes` more minutes must fit in its run length. The event log then holds the
 * events after the checkpoint minute. `run --checkpoint-out FILE` writes a checkpoint of the run where it ended (compact JSON),
 * which a later `--checkpoint` continues exactly as one longer run. Every refusal names its flag.
 */
import path from 'node:path';
import {catalog, runtime, replicate, diff} from '../process-sdk.cjs';
import {readJsonFile, writeJsonFile, writeTextFile} from './cli-io.cjs';
import {openEventLog, type LogFormat} from './process-event-log.cjs';
type Values = ReadonlyMap<string, string>;
type Success = (value: Record<string, unknown>) => void;
const checkpoints = () => (globalThis as unknown as {LWProcessCheckpoint: LWProcessCheckpoint.Api}).LWProcessCheckpoint;
const MINUTES = '--minutes must be a whole number from 1 to ' + runtime.limits.minutes + '.';
const RUNS = '--runs must be a whole number from 1 to ' + replicate.LIMITS.runs + '.';
/** Flag-named bounds of `--minutes` and `--runs` and the total replication work, checked before any file is read. */
export function checkBounds(command: string, values: Values): void {
 const minutes = values.get('--minutes'), runs = values.get('--runs');
 if (minutes !== undefined && (!/^\d+$/.test(minutes) || Number(minutes) < 1 || Number(minutes) > runtime.limits.minutes)) throw Error(MINUTES);
 if (runs !== undefined && (!/^\d+$/.test(runs) || Number(runs) < 1 || Number(runs) > replicate.LIMITS.runs)) throw Error(RUNS);
 const warmup = values.get('--warmup');
 if (warmup !== undefined && (!/^\d+$/.test(warmup) || Number(warmup) >= Number(minutes))) {
  throw Error('--warmup must be a whole number of minutes from 0 to ' + (Number(minutes) - 1) + ' (below --minutes).');
 }
 if (command === 'replicate' || command === 'compare') {
  // The definition seed is not known yet; a given --seed is checked in full, otherwise seed 0 checks only the work bound.
  const seed = values.has('--seed') ? Number(values.get('--seed')) : 0;
  replicate.plan({minutes: Number(minutes), runs: Number(runs), seed, ...warmupOption(values)}, undefined, command === 'compare' ? 2 : 1);
 }
 if (command === 'run') {
  const log = values.get('--event-log');
  if (values.has('--format') && log === undefined) throw Error('--format on run needs --event-log (it names the event log format).');
  if (values.has('--format') && !['csv', 'xes'].includes(values.get('--format')!)) throw Error('--format must be csv or xes on run.');
  if (log !== undefined && [values.get('--input'), values.get('--output')].some(other => other !== undefined && path.resolve(other) === path.resolve(log))) {
   throw Error('--event-log must not be the input or the report file.');
  }
  if (values.has('--checkpoint') && values.has('--seed')) throw Error('--seed cannot be combined with --checkpoint: the checkpoint carries its run seed.');
  const out = values.get('--checkpoint-out'), others = ['--input', '--output', '--event-log', '--checkpoint'].map(key => values.get(key));
  if (out !== undefined && others.some(other => other !== undefined && path.resolve(other) === path.resolve(out))) {
   throw Error('--checkpoint-out must not be the input, the report, the event log or the --checkpoint file.');
  }
 }
}
const seedOption = (values: Values) => values.has('--seed') ? {seed: Number(values.get('--seed'))} : {};
const warmupOption = (values: Values) => values.has('--warmup') ? {warmup: Number(values.get('--warmup'))} : {};
/** The checkpoint in `file`, read strictly and checked against `definition`; every refusal names `--checkpoint`. */
function readCheckpoint(definition: LWProcess.Definition, file: string): LWProcessCheckpoint.Checkpoint {
 const api = checkpoints();
 try {
  return api.verify(api.parse(readJsonFile(file, api.MAX_BYTES)), definition);
 } catch (error) {
  throw Error(`--checkpoint ${file}: ${error instanceof Error ? error.message : String(error)}`);
 }
}
/**
 * `process run`: one bounded run (fresh, or continued from `--checkpoint`), its report, with `--event-log` every engine event streamed
 * to a CSV or XES file, and with `--checkpoint-out` a checkpoint of where the run ended.
 */
export function runCommand(definition: LWProcess.Definition, file: string, values: Values, success: Success): void {
 const report = values.get('--output')!, logFile = values.get('--event-log'), format = (values.get('--format') ?? 'csv') as LogFormat;
 const from = values.get('--checkpoint'), resumed = from === undefined ? null : readCheckpoint(definition, from);
 const seed = resumed ? resumed.seed : values.has('--seed') ? Number(values.get('--seed')) : definition.seed ?? 1;
 const inputs = from === undefined ? [file] : [file, from], out = values.get('--checkpoint-out');
 const log = logFile === undefined ? null : openEventLog(logFile, format, definition, seed, [...inputs, report]);
 let published: ReturnType<NonNullable<typeof log>['close']> | null = null;
 try {
  const sink = log ? {onEvent: (event: LWProcess.Event) => log.write(event)} : {};
  const session = runtime.create(definition, resumed ? {horizon: resumed.runLength, restore: resumed.snapshot, ...sink} : {...seedOption(values), ...sink});
  try {
   const requested = Number(values.get('--minutes')), start = session.query().minute, length = session.horizon();
   if (length !== null && start + requested > length) {
    throw Error(`--minutes ${requested} goes past the checkpoint's run length: the run is at minute ${start} of ${length}, so at most`
     + ` ${length - start} more minutes can run.`);
   }
   const snapshot = session.advance(requested);
   const saved = out === undefined ? null
    : writeTextFile(out, JSON.stringify(checkpoints().create(definition, length, session.state())) + '\n', [...inputs, report]);
   if (log) published = log.close();
   const body = {format: 'wildlands-process-report', schemaVersion: 1, fingerprint: catalog.fingerprint(definition), definition, snapshot};
   const output = writeJsonFile(report, body, logFile === undefined ? inputs : [...inputs, logFile]);
   success({output, requestedMinutes: requested, seed: snapshot.seed, advancedMinutes: snapshot.minute - start, status: snapshot.status,
    metrics: snapshot.metrics, ...published ? {eventLog: published} : {}, ...resumed ? {checkpoint: {input: from, minute: start}} : {},
    ...saved ? {checkpointOut: {output: saved, minute: snapshot.minute}} : {}});
  } finally { session.dispose(); }
 } catch (error) {
  if (log && !published) log.abort();
  throw error;
 }
}
const options = (values: Values): LWProcessReplicate.Options =>
 ({minutes: Number(values.get('--minutes')), runs: Number(values.get('--runs')), ...seedOption(values), ...warmupOption(values)});
/** Prints the whole report, or writes it with `--output` and prints the file with the per-KPI statistics (no per-seed rows). */
function publish(report: {kpis: unknown[]; runs: number; seeds: number[]; format: string}, values: Values, inputs: string[], success: Success): void {
 if (!values.has('--output')) {
  success({report});
  return;
 }
 const output = writeJsonFile(values.get('--output')!, report, inputs);
 success({output, format: report.format, runs: report.runs, seeds: report.seeds, kpis: report.kpis});
}
/** `process replicate`: the definition over consecutive seeds with mean, sd, 95% interval and percentiles per KPI. */
export function replicateCommand(input: unknown, file: string, values: Values, success: Success): void {
 publish(replicate.replicate(input, options(values)), values, [file], success);
}
/** `process compare`: A and B over the same seeds, paired differences per KPI, plus the `process diff` report of the two files. */
export function compareCommand(input: unknown, file: string, other: unknown, reference: string, values: Values, success: Success): void {
 const changes = definitionDiff(input, file, other, reference);
 const report = {...replicate.compare(input, other, options(values)), diff: changes};
 publish(report, values, [file, reference], success);
}
/** What changed from `reference` to `file` (drafts allowed), exactly as `process diff` prints it without the envelope. */
export function definitionDiff(input: unknown, file: string, other: unknown, reference: string): Record<string, unknown> {
 const admit = (value: unknown, name: string) => {
  const checked = catalog.validate(value, true);
  if (!checked.acceptable) throw Error(name + ': ' + checked.diagnostics.map(e => e.path + ': ' + e.message).join('\n'));
  return checked.definition!;
 };
 // Compare key-sorted copies, like the fingerprint, so key order is never reported as a change.
 const canonical = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(canonical);
  if (v === null || typeof v !== 'object') return v;
  return Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical((v as Record<string, unknown>)[k])]));
 };
 const after = admit(input, file), before = admit(other, reference);
 const a = canonical(before) as LWProcess.Definition, b = canonical(after) as LWProcess.Definition, changes = diff.compare(a, b);
 const identity = (d: LWProcess.Definition, at: string) => ({file: at, id: d.id, revision: d.revision, fingerprint: catalog.fingerprint(d)});
 const identical = catalog.fingerprint(after) === catalog.fingerprint(before), revisionChanged = after.revision !== before.revision;
 const counted = changes.steps + changes.flows + changes.resources + changes.arrivals + changes.meta > 0;
 const revisionOnly = `Changes: revision only (${before.revision} to ${after.revision})`;
 const summary = counted ? diff.describe(changes, 'Changes') : revisionChanged ? revisionOnly : 'Changes: none';
 return {input: identity(after, file), against: identity(before, reference), identical, revisionChanged, summary,
  changes: {steps: changes.steps, flows: changes.flows, resources: changes.resources, arrivals: changes.arrivals, settings: changes.meta},
  changedSteps: changes.changedSteps, changedSettings: diff.settings(a, b), ...diff.detail(a, b)};
}
