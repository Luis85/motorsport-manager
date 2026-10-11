/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-checkpoint.ts" />
/**
 * CLI checks for `process run --checkpoint-out FILE` and `process run --checkpoint FILE` (business-process-checkpoint suite; loaded by
 * test-process-checkpoint.cts): a saved run continued by the CLI equals one longer run, the event log holds the events after the
 * checkpoint, and every refusal names its flag and writes nothing.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {catalog, runtime} from './process-sdk.cjs';
import {test, copy} from './test-process-helpers.cjs';
import {CSV_HEADER, csvRow} from './tools/process-event-log.cjs';
import {DEMOS, checkpoints} from './test-process-checkpoint-helpers.cjs';
const CLI = path.join(__dirname, 'tools/wildlands-cli.cjs');
type Json = Record<string, any>;
/** Runs `process ...` in a fresh directory holding the loan application demo as a.json. */
function workspace(work: (call: (args: string[], code?: number) => Json, dir: string) => void): void {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'process-checkpoint-'));
 try {
  fs.copyFileSync(path.join(DEMOS, 'loan-application.process.json'), path.join(dir, 'a.json'));
  const call = (args: string[], code = 0) => {
   const p = spawnSync(process.execPath, [CLI, 'process', ...args], {cwd: dir, encoding: 'utf8'});
   assert.equal(p.status, code, args.join(' ') + '\n' + p.stdout + p.stderr);
   return JSON.parse(p.stdout) as Json;
  };
  work(call, dir);
 } finally { fs.rmSync(dir, {recursive: true, force: true}); }
}
const OUT_CLASH = '--checkpoint-out must not be the input, the report, the event log or the --checkpoint file.';
const read = (dir: string, file: string) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as Json;
test('CLI run --checkpoint-out then --checkpoint continues exactly as one longer run; the event log holds the later events', () => workspace((call, dir) => {
 const d = read(dir, 'a.json') as LWProcess.Definition, names = new Map(d.steps.map(s => [s.id, s.name]));
 const first = call(['run', '--input', 'a.json', '--minutes', '400', '--output', 'first.json', '--seed', '7', '--checkpoint-out', 'at400.json']);
 assert.deepEqual(first.checkpointOut, {output: path.join(dir, 'at400.json'), minute: 400});
 const saved = checkpoints.parse(fs.readFileSync(path.join(dir, 'at400.json'), 'utf8'));
 assert.deepEqual([saved.process, saved.fingerprint, saved.seed, saved.minute, saved.runLength],
  [d.id, catalog.fingerprint(d), 7, 400, runtime.limits.minutes]);
 const next = call(['run', '--input', 'a.json', '--minutes', '350', '--output', 'second.json', '--checkpoint', 'at400.json', '--checkpoint-out', 'at750.json',
  '--event-log', 'later.csv']);
 assert.deepEqual([next.seed, next.advancedMinutes, next.checkpoint, next.checkpointOut.minute], [7, 350, {input: 'at400.json', minute: 400}, 750]);
 call(['run', '--input', 'a.json', '--minutes', '1500', '--output', 'third.json', '--checkpoint', 'at750.json']);
 call(['run', '--input', 'a.json', '--minutes', '2250', '--output', 'whole.json', '--seed', '7']);
 assert.deepEqual(read(dir, 'third.json').snapshot, read(dir, 'whole.json').snapshot, 'two continuations equal one run of 2,250 minutes');
 const events: LWProcess.Event[] = [], session = runtime.create(d, {seed: 7, onEvent: e => events.push(e)});
 session.advance(400); const before = events.length; session.advance(350);
 assert.deepEqual(read(dir, 'second.json').snapshot, session.query()); session.dispose();
 assert.equal(fs.readFileSync(path.join(dir, 'later.csv'), 'utf8'), CSV_HEADER + events.slice(before).map(e => csvRow(e, names)).join(''),
  'the event log holds exactly the events after the checkpoint minute');
}));
test('CLI process run checkpoint refusals name their flag, name both fingerprints on a mismatch and write nothing', () => workspace((call, dir) => {
 // The order fulfilment demo has an open arrival stream, so its run is still going at minute 99,000.
 fs.copyFileSync(path.join(DEMOS, 'order-fulfilment.process.json'), path.join(dir, 'b.json'));
 call(['run', '--input', 'b.json', '--minutes', '99000', '--output', 'r.json', '--checkpoint-out', 'late.json']);
 const d = read(dir, 'b.json') as LWProcess.Definition, edited = {...copy(d), revision: d.revision + 1};
 fs.writeFileSync(path.join(dir, 'edited.json'), JSON.stringify(edited));
 fs.writeFileSync(path.join(dir, 'broken.json'), '{"kind": "wildlands-process-checkpoint", "version": 1');
 const tampered = read(dir, 'late.json'); tampered.snapshot.clock.arrived += 1;
 fs.writeFileSync(path.join(dir, 'tampered.json'), JSON.stringify(tampered));
 const before = fs.readdirSync(dir).sort().join();
 const run = ['run', '--input', 'b.json', '--minutes', '10', '--output', 'out.json'];
 const errors: [string[], string | RegExp][] = [
  [[...run, '--checkpoint', 'late.json', '--seed', '3'], '--seed cannot be combined with --checkpoint: the checkpoint carries its run seed.'],
  [[...run, '--checkpoint-out', 'b.json'], OUT_CLASH],
  [[...run, '--checkpoint', 'late.json', '--checkpoint-out', './late.json'], OUT_CLASH],
  [[...run, '--checkpoint', 'missing.json'], /^--checkpoint missing\.json: /],
  [[...run, '--checkpoint', 'broken.json'], '--checkpoint broken.json: This file is not a run checkpoint: it is not valid JSON.'],
  [[...run, '--checkpoint', 'tampered.json'],
   /^--checkpoint tampered\.json: The checkpoint's run state is not valid for this process: snapshot\.cases do not match/],
  [['run', '--input', 'edited.json', '--minutes', '10', '--output', 'out.json', '--checkpoint', 'late.json'],
   `--checkpoint late.json: This checkpoint was saved from definition fingerprint ${catalog.fingerprint(d)}, but the applied definition of ${d.name} has`
   + ` fingerprint ${catalog.fingerprint(edited)}. Import or apply the definition the checkpoint was saved from, then load the checkpoint again.`],
  [['run', '--input', 'b.json', '--minutes', '1001', '--output', 'out.json', '--checkpoint', 'late.json'],
   '--minutes 1001 goes past the checkpoint\'s run length: the run is at minute 99000 of 100000, so at most 1000 more minutes can run.'],
 ];
 for (const [args, message] of errors) {
  const failed = call(args, 2);
  assert.equal(failed.errors.length, 1, args.join(' '));
  if (typeof message === 'string') assert.equal(failed.errors[0], message, args.join(' ')); else assert.match(failed.errors[0], message, args.join(' '));
 }
 assert.equal(fs.readdirSync(dir).sort().join(), before, 'refused runs write nothing');
 const usage = (spawnSync(process.execPath, [CLI, '--help'], {encoding: 'utf8'}).stdout);
 assert.match(usage, /process run --input FILE --minutes N --output FILE \[--seed S \| --checkpoint FILE\] \[--checkpoint-out FILE\]/);
}));
