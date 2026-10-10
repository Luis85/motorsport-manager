/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-xml.ts" />
/**
 * CLI checks for `process run --event-log`, `process replicate`, `process compare` and the flag-named `--minutes` bound
 * (business-process suite; loaded by test-process.cts after test-process-analytics.cts).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {catalog, runtime, replicate} from './process-sdk.cjs';
import {test, copy} from './test-process-helpers.cjs';
import {csvCell, csvRow, xesEvent, CSV_HEADER, timestamp} from './tools/process-event-log.cjs';
const CLI = path.join(__dirname, 'tools/wildlands-cli.cjs');
const ORDERS = path.resolve(__dirname, '../../../docs/concepts/agency-delivery/content/order-fulfilment.process.json');
const xml = (globalThis as unknown as {LWProcessXml: LWProcessXml.Api}).LWProcessXml;
type Json = Record<string, any>;
const sum = (values: number[]) => values.reduce((n, v) => n + v, 0);
/** Runs `process ...` in a fresh directory holding the order fulfilment demo as a.json. */
function workspace(work: (call: (args: string[], code?: number) => Json, dir: string) => void): void {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'process-analytics-'));
 try {
  fs.copyFileSync(ORDERS, path.join(dir, 'a.json'));
  const call = (args: string[], code = 0) => {
   const p = spawnSync(process.execPath, [CLI, 'process', ...args], {cwd: dir, encoding: 'utf8'});
   assert.equal(p.status, code, args.join(' ') + '\n' + p.stdout + p.stderr);
   return JSON.parse(p.stdout) as Json;
  };
  work(call, dir);
 } finally { fs.rmSync(dir, {recursive: true, force: true}); }
}
const definition = () => JSON.parse(fs.readFileSync(ORDERS, 'utf8')) as LWProcess.Definition;
/** Every event of one run, streamed through the runtime sink. */
function stream(d: LWProcess.Definition, chunks: number[], seed?: number): LWProcess.Event[] {
 const events: LWProcess.Event[] = [], s = runtime.create(d, {...seed === undefined ? {} : {seed}, onEvent: e => events.push(e)});
 try { for (const n of chunks) s.advance(n); } finally { s.dispose(); }
 return events;
}
/** RFC 4180 reader for the checks: quoted cells may hold commas, doubled quotes and line breaks. */
function parseCsv(text: string): string[][] {
 const rows: string[][] = [];
 let row: string[] = [], cell = '', quoted = false;
 for (let i = 0; i < text.length; i++) {
  const c = text[i]!;
  if (quoted) {
   if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c;
  } else if (c === '"') quoted = true;
  else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else cell += c;
 }
 return rows;
}
const attr = (node: LWProcessXml.Node, key: string) => node.children.find(c => c.attrs.key === key)?.attrs.value;

test('CLI process run streams every engine event to a CSV or XES event log without changing the run or its report', () => workspace((call, dir) => {
 const d = definition(), events = stream(d, [600]), names = new Map(d.steps.map(s => [s.id, s.name]));
 const plain = call(['run', '--input', 'a.json', '--minutes', '600', '--output', 'plain.json']);
 const csv = call(['run', '--input', 'a.json', '--minutes', '600', '--output', 'r.json', '--event-log', 'log.csv']);
 assert.deepEqual(csv.eventLog, {file: path.join(dir, 'log.csv'), format: 'csv', events: events.length});
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'r.json'), 'utf8')), JSON.parse(fs.readFileSync(path.join(dir, 'plain.json'), 'utf8')));
 assert.deepEqual({...csv, output: '', eventLog: null}, {...plain, output: '', eventLog: null});
 const text = fs.readFileSync(path.join(dir, 'log.csv'), 'utf8'), rows = parseCsv(text);
 assert.equal(text, CSV_HEADER + events.map(e => csvRow(e, names)).join(''), 'one row per streamed event, in engine order');
 assert(events.length > 10 * runtime.limits.events && rows.length === events.length + 1 && rows.every(r => r.length === 7));
 assert.deepEqual(rows[0], ['case_id', 'step_id', 'step_name', 'event', 'minute', 'timestamp', 'detail']);
 const e0 = events[0]!;
 assert.deepEqual(rows[1], [e0.caseId, e0.stepId, names.get(e0.stepId), e0.kind, '0', '1970-01-01T00:00:00Z', e0.detail]);
 const lines = (list: LWProcess.Event[]) => list.map(e => csvRow(e, names)).join('');
 assert.equal(lines(stream(d, Array.from({length: 60}, () => 10))), lines(events), 'chunked runs log the same');
 const xes = call(['run', '--input', 'a.json', '--minutes', '600', '--output', 'r2.json', '--event-log', 'log.xes', '--format', 'xes', '--seed', '5']);
 const seeded = stream(d, [600], 5), log = xml.parse(fs.readFileSync(path.join(dir, 'log.xes'), 'utf8'));
 assert.deepEqual([xes.eventLog.format, xes.eventLog.events, log.local, log.ns, log.attrs['xes.version']],
  ['xes', seeded.length, 'log', 'http://www.xes-standard.org/', '1849-2016']);
 const traces = log.children.filter(c => c.local === 'trace'), cases = [...new Set(seeded.map(e => e.caseId))];
 assert.deepEqual(traces.map(t => attr(t, 'concept:name')).sort(), [...cases].sort(), 'one trace per case');
 assert.equal(sum(traces.map(t => t.children.filter(c => c.local === 'event').length)), seeded.length, 'every event once');
 for (const t of traces) {
  const id = attr(t, 'concept:name')!, mine = seeded.filter(e => e.caseId === id), listed = t.children.filter(c => c.local === 'event');
  const facts = listed.map(e => [attr(e, 'wl:kind'), Number(attr(e, 'wl:minute')), attr(e, 'time:timestamp')]);
  assert.deepEqual(facts, mine.map(e => [e.kind, e.minute, timestamp(e.minute)]));
  assert.equal(attr(t, 'wl:status'), {completed: 'completed', failed: 'failed', 'arrival-dropped': 'dropped'}[mine.at(-1)!.kind] ?? 'active', id);
 }
 const started = traces.flatMap(t => t.children).find(e => attr(e, 'wl:kind') === 'started')!;
 assert.deepEqual([attr(started, 'lifecycle:transition'), attr(started, 'concept:name')], ['start', names.get(attr(started, 'wl:step')!)]);
 assert(fs.readdirSync(dir).every(f => !f.endsWith('.tmp')), 'no temporary file is left behind');
}));

test('Event log cells are escaped like the Activity CSV and XES refuses text XML 1.0 cannot represent', () => {
 assert.deepEqual(['=1+2', '+x', '-y', '@z', 'a,"b"', 'plain', -3].map(csvCell), ["'=1+2", "'+x", "'-y", "'@z", '"a,""b"""', 'plain', '-3']);
 const event: LWProcess.Event = {minute: 1441, kind: 'failed', caseId: 'case-0001', stepId: '', detail: 'Bad <value> & "quote"'};
 const parsed = xml.parse('<log>' + xesEvent(event, new Map()) + '</log>').children[0]!;
 assert.deepEqual([attr(parsed, 'concept:name'), attr(parsed, 'lifecycle:transition'), attr(parsed, 'wl:detail'), attr(parsed, 'time:timestamp')],
  ['failed', 'pi_abort', 'Bad <value> & "quote"', '1970-01-02T00:01:00Z']);
 assert.equal(attr(parsed, 'wl:step'), undefined, 'a case failure names no step');
 assert.throws(() => xesEvent({...event, detail: 'bell \u0007'}, new Map()), /XML 1\.0 cannot represent/);
});

test('CLI process replicate and compare print seeded reports or write them, and match the pure module', () => workspace((call, dir) => {
 const d = definition(), b = copy(d); b.resources[0]!.capacity += 1; b.revision += 1;
 fs.writeFileSync(path.join(dir, 'b.json'), JSON.stringify(b));
 const printed = call(['replicate', '--input', 'a.json', '--minutes', '240', '--runs', '3', '--seed', '9']);
 assert.deepEqual(printed.report, replicate.replicate(d, {minutes: 240, runs: 3, seed: 9}));
 const written = call(['replicate', '--input', 'a.json', '--minutes', '240', '--runs', '3', '--output', 'rep.json']);
 const file = JSON.parse(fs.readFileSync(path.join(dir, 'rep.json'), 'utf8'));
 const first = d.seed!;
 assert.deepEqual(file.seeds, [first, first + 1, first + 2], 'seeds start at the definition seed');
 assert.deepEqual(written, {ok: true, protocolVersion: 1, output: path.join(dir, 'rep.json'), format: 'wildlands-process-replications', runs: 3,
  seeds: file.seeds, kpis: file.kpis});
 const compared = call(['compare', '--input', 'b.json', '--against', 'a.json', '--minutes', '240', '--runs', '3']).report;
 const {ok: _ok, protocolVersion: _version, ...diff} = call(['diff', '--input', 'b.json', '--against', 'a.json']);
 assert.deepEqual(compared, {...replicate.compare(b, d, {minutes: 240, runs: 3}), diff});
 assert.equal(compared.diff.summary, 'Changes: 1 resource changed'); assert.deepEqual(compared.seeds, file.seeds, 'A\'s definition seed');
 const pool = 'utilization.' + d.resources[0]!.id;
 assert(compared.kpis.find(k => k.id === pool)!.difference.mean! < 0, 'more capacity lowers the pool\'s mean utilisation');
 call(['compare', '--input', 'b.json', '--against', 'a.json', '--minutes', '240', '--runs', '3', '--output', 'cmp.json']);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'cmp.json'), 'utf8')), compared);
}));

test('Process commands name --minutes, --runs and --format in their errors and refuse a clashing event log before writing', () => workspace((call, dir) => {
 fs.writeFileSync(path.join(dir, 'log.csv'), 'previous log\n');
 const before = fs.readdirSync(dir).sort().join(), minutes = '--minutes must be a whole number from 1 to ' + runtime.limits.minutes + '.';
 const commands: string[][] = [['run', '--input', 'a.json', '--output', 'r.json'], ['slides', '--input', 'a.json'],
  ['replicate', '--input', 'a.json', '--runs', '2'],
  ['compare', '--input', 'a.json', '--against', 'a.json', '--runs', '2']];
 for (const args of commands) for (const bad of ['0', '100001', '1.5', '-3', 'ten']) {
  assert.deepEqual(call([...args, '--minutes', bad], 2).errors, [minutes], args[0] + ' --minutes ' + bad);
 }
 const errors: [string[], string][] = [
  [['replicate', '--input', 'a.json', '--minutes', '10', '--runs', '0'], '--runs must be a whole number from 1 to 200.'],
  [['compare', '--input', 'a.json', '--against', 'a.json', '--minutes', '10', '--runs', '201'], '--runs must be a whole number from 1 to 200.'],
  [['replicate', '--input', 'a.json', '--minutes', '100000', '--runs', '11'],
   'A replication plan may simulate at most 1000000 minutes in total; this one needs 1100000.'],
  [['replicate', '--input', 'a.json', '--minutes', '10'], 'Missing --runs'],
  [['compare', '--input', 'a.json', '--minutes', '10', '--runs', '2'], 'Missing --against'],
  [['run', '--input', 'a.json', '--minutes', '10', '--output', 'r.json', '--format', 'xes'],
   '--format on run needs --event-log (it names the event log format).'],
  [['run', '--input', 'a.json', '--minutes', '10', '--output', 'r.json', '--event-log', 'x.log', '--format', 'json'], '--format must be csv or xes on run.'],
  [['slides', '--input', 'a.json', '--format', 'csv'], '--format must be json or md.'],
  [['run', '--input', 'a.json', '--minutes', '10', '--output', 'r.json', '--event-log', 'a.json'], '--event-log must not be the input or the report file.'],
  [['run', '--input', 'a.json', '--minutes', '10', '--output', 'log.csv', '--event-log', './log.csv'], '--event-log must not be the input or the report file.'],
  [['replicate', '--input', 'a.json', '--minutes', '10', '--runs', '2', '--event-log', 'x.csv'], 'Unknown or duplicate option: --event-log']];
 for (const [args, message] of errors) assert.deepEqual(call(args, 2).errors, [message], args.join(' '));
 fs.linkSync(path.join(dir, 'a.json'), path.join(dir, 'alias.json'));
 assert.deepEqual(call(['run', '--input', 'a.json', '--minutes', '10', '--output', 'r.json', '--event-log', 'alias.json'], 2).errors,
  ['Output must not overwrite an input file through an alias.']);
 fs.rmSync(path.join(dir, 'alias.json'));
 assert.equal(fs.readdirSync(dir).sort().join(), before, 'rejected invocations write nothing');
 assert.equal(fs.readFileSync(path.join(dir, 'log.csv'), 'utf8'), 'previous log\n');
 const discovered = call(['discover']).operations.filter((o: Json) => ['run', 'replicate', 'compare'].includes(o.id)).map((o: Json) => [o.id, o.options]);
 assert.deepEqual(discovered, [['run', ['--input', '--minutes', '--output', '--seed', '--event-log', '--format']],
  ['replicate', ['--input', '--minutes', '--runs', '--seed', '--output']], ['compare', ['--input', '--against', '--minutes', '--runs', '--seed', '--output']]]);
 assert.equal(catalog.fingerprint(JSON.parse(fs.readFileSync(path.join(dir, 'a.json'), 'utf8'))), catalog.fingerprint(definition()));
}));
