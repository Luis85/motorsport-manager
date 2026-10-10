/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-time.ts" />
/**
 * The optional display calendar (`calendar: {minutesPerDay, daysPerWeek}`): additive admission, plain rejections, unchanged
 * fingerprints and runs, the `setCalendar` recipe, `process diff` paths, BPMN round trips and the calendar-aware wording.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {catalog, runtime, authoring, bpmn, diff} from './process-sdk.cjs';
import {test, base, copy, agency, guard} from './test-process-helpers.cjs';
const time = (globalThis as unknown as {LWProcessTime: LWProcessTime.Api}).LWProcessTime;
const CALENDAR: LWProcess.Calendar = {minutesPerDay: 480, daysPerWeek: 5};
const withCalendar = (d: LWProcess.Definition, calendar: unknown = CALENDAR) => ({...copy(d), calendar}) as LWProcess.Definition;
const CLI = path.join(__dirname, 'tools/wildlands-cli.cjs');

test('Display calendar is optional and additive: fingerprints and runs are unchanged by it', () => {
 // Fingerprints of definitions without a calendar are those of the engine before the field existed.
 assert.equal(catalog.fingerprint(agency), 'b21c5344f7ef2ea2');
 assert.equal(catalog.fingerprint(base()), 'fadd71827b3f8936');
 const dated = withCalendar(agency), checked = catalog.validate(dated);
 assert(checked.ok, JSON.stringify(checked.diagnostics));
 assert.deepEqual(checked.definition!.calendar, CALENDAR);
 assert.notEqual(catalog.fingerprint(dated), catalog.fingerprint(agency), 'the fingerprint covers the calendar');
 assert.equal(catalog.fingerprint(withCalendar(agency, {daysPerWeek: 5, minutesPerDay: 480})), catalog.fingerprint(dated));
 // The run never reads the calendar: whole and chunked runs give the same snapshots with and without it.
 for (const minutes of [1, 37, 600, 2400]) {
  const plain = runtime.create(agency), timed = runtime.create(dated);
  try {
   assert.deepEqual(timed.advance(minutes), plain.advance(minutes), 'minute ' + minutes);
   assert.deepEqual(timed.advance(11), plain.advance(11));
  } finally {
   plain.dispose();
   timed.dispose();
  }
 }
});

test('Display calendar rejects non-integers, out-of-range values and unknown keys with plain diagnostics', () => {
 const day = 'The display calendar needs minutesPerDay as a whole number of minutes from 1 to 1440.';
 const week = 'The display calendar needs daysPerWeek as a whole number of days from 1 to 7.';
 const cases: [unknown, string, string][] = [
  [{minutesPerDay: 0, daysPerWeek: 5}, '/calendar/minutesPerDay', day], [{minutesPerDay: 1441, daysPerWeek: 5}, '/calendar/minutesPerDay', day],
  [{minutesPerDay: 480.5, daysPerWeek: 5}, '/calendar/minutesPerDay', day], [{minutesPerDay: '480', daysPerWeek: 5}, '/calendar/minutesPerDay', day],
  [{minutesPerDay: 480, daysPerWeek: 0}, '/calendar/daysPerWeek', week], [{minutesPerDay: 480, daysPerWeek: 8}, '/calendar/daysPerWeek', week],
  [{minutesPerDay: 480, daysPerWeek: 2.5}, '/calendar/daysPerWeek', week], [{minutesPerDay: 480}, '/calendar', 'Missing field: daysPerWeek'],
  [{minutesPerDay: 480, daysPerWeek: 5, hours: 8}, '/calendar', 'Unknown field: hours'], [null, '/calendar', 'Expected object.'],
 ];
 for (const [calendar, where, message] of cases) {
  const checked = catalog.validate(withCalendar(base(), calendar), true);
  assert.equal(checked.acceptable, false, JSON.stringify(calendar));
  assert.deepEqual(checked.diagnostics, [{path: where, code: 'shape', message}], JSON.stringify(calendar));
 }
 for (const calendar of [{minutesPerDay: 1, daysPerWeek: 1}, {minutesPerDay: 1440, daysPerWeek: 7}]) assert(catalog.validate(withCalendar(base(), calendar)).ok);
 // Other range messages keep their generic wording.
 const other = base();
 other.seed = -1;
 assert.equal(catalog.validate(other).diagnostics[0]!.message, 'Number is out of range.');
});

test('setCalendar recipe places the calendar in schema order, dry-runs through the CLI and removes it with null', () => {
 // A definition whose genre and track already sit in schema order, so the calendar has neighbours on both sides.
 const entries = Object.entries(base());
 entries.splice(entries.findIndex(([k]) => k === 'resources'), 0, ['genre', 'customer-journey'], ['track', [{field: 'mood'}]]);
 const d = Object.fromEntries(entries) as LWProcess.Definition;
 const set = authoring.edit(d, guard(d, [{op: 'setCalendar', value: CALENDAR}]));
 const keys = Object.keys(set.definition);
 assert.deepEqual(keys.slice(keys.indexOf('start')), ['start', 'genre', 'calendar', 'track', 'resources', 'steps', 'flows', 'arrivals']);
 assert.deepEqual(set.definition.calendar, CALENDAR);
 assert.equal(set.fingerprint, catalog.fingerprint(set.definition));
 const changed = authoring.edit(set.definition, guard(set.definition, [{op: 'setCalendar', value: {minutesPerDay: 450, daysPerWeek: 4}}]));
 assert.deepEqual(Object.keys(changed.definition), keys, 'replacing a value keeps the key order');
 const removed = authoring.edit(changed.definition, guard(changed.definition, [{op: 'setCalendar', value: null}]));
 assert.equal(removed.definition.calendar, undefined);
 assert.equal(catalog.fingerprint({...removed.definition, revision: d.revision}), catalog.fingerprint(d));
 assert.throws(() => authoring.edit(d, guard(d, [{op: 'setCalendar', value: {minutesPerDay: 0, daysPerWeek: 5}}])),
  /\/calendar\/minutesPerDay: The display calendar needs minutesPerDay as a whole number of minutes from 1 to 1440\./);
 assert.throws(() => authoring.edit(d, guard(d, [{op: 'setCalendar'} as unknown as LWProcess.Recipe['operations'][number]])), /needs a value/);
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'process-calendar-'));
 try {
  const call = (args: string[]) => {
   const p = spawnSync(process.execPath, [CLI, 'process', ...args], {cwd: dir, encoding: 'utf8'});
   assert.equal(p.status, 0, p.stderr + p.stdout);
   return JSON.parse(p.stdout) as Record<string, any>;
  };
  fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify(d));
  fs.writeFileSync(path.join(dir, 'recipe.json'), JSON.stringify(guard(d, [{op: 'setCalendar', value: CALENDAR}])));
  const dry = call(['edit', '--input', 'a.json', '--recipe', 'recipe.json', '--dry-run']);
  assert.equal(dry.dryRun, true);
  assert.deepEqual(dry.definition.calendar, CALENDAR);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['a.json', 'recipe.json'], 'a dry run writes nothing');
  assert(call(['discover']).editOperations.includes('setCalendar'));
  const ops = call(['schema', '--kind', 'recipe']).schema.properties.operations.items.oneOf as {properties: {op: {const: string}; value: unknown}}[];
  const op = ops.find(o => o.properties.op.const === 'setCalendar'), fields = catalog.schema.properties as Record<string, unknown>;
  assert.deepEqual(op?.properties.value, {oneOf: [fields.calendar, {type: 'null'}]});
 } finally {
  fs.rmSync(dir, {recursive: true, force: true});
 }
});

test('process diff reports a calendar change as a process setting with value paths', () => {
 const before = base(), after = withCalendar(before);
 assert.deepEqual(diff.settings(before, after), ['calendar']);
 assert.equal(diff.compare(before, after).meta, 1);
 assert.deepEqual(diff.detail(before, after).fields, [{path: '/calendar/daysPerWeek', after: 5}, {path: '/calendar/minutesPerDay', after: 480}]);
 assert.deepEqual(diff.detail(after, before).fields, [{path: '/calendar/daysPerWeek', before: 5}, {path: '/calendar/minutesPerDay', before: 480}]);
 const shorter = withCalendar(before, {minutesPerDay: 420, daysPerWeek: 5});
 assert.deepEqual(diff.detail(after, shorter).fields, [{path: '/calendar/minutesPerDay', before: 480, after: 420}]);
 assert.equal(diff.describe(diff.compare(after, shorter)), 'Unapplied draft: 1 process setting changed');
 // Other added settings are still reported as before: a whole SIPOC block has no value paths.
 assert.deepEqual(diff.detail(before, {...copy(before), sipoc: {suppliers: [{name: 'Mill'}]}}).fields, []);
});

test('BPMN round trip carries the display calendar exactly, with and without BPSim, and rejects bad values', () => {
 const plain = copy(agency), dated = withCalendar(agency);
 for (const options of [{}, {bpsim: true}]) {
  const xml = bpmn.export(dated, options), back = bpmn.import(xml);
  assert.match(xml, /<wl:process id="agency-delivery" revision="\d+"[^>]* minutesPerDay="480" daysPerWeek="5"/);
  assert(back.definition);
  assert.deepEqual(back.definition.calendar, CALENDAR);
  assert.equal(catalog.fingerprint(back.definition), catalog.fingerprint(dated), JSON.stringify(options));
  assert.equal(bpmn.export(back.definition, options), xml);
  // Without a calendar the export is the one of a definition that never had the field.
  const bare = bpmn.export(plain, options);
  assert.equal(bare, xml.replace(' minutesPerDay="480" daysPerWeek="5"', ''));
  assert.doesNotMatch(bare, /minutesPerDay|daysPerWeek/);
  assert.equal(bpmn.import(bare).definition!.calendar, undefined);
  const note = /display calendar \(480 minutes per business day, 5 days per week\) is only in the Wildlands extension/;
  assert(bpmn.fidelity(dated, options).some(n => note.test(n)));
  assert(!bpmn.fidelity(plain, options).some(n => /calendar/.test(n)));
 }
 const xml = bpmn.export(dated), reject = (text: string) => bpmn.analyze(text).rejections.map(r => r.message);
 assert.deepEqual(reject(xml.replace('minutesPerDay="480"', 'minutesPerDay="0"')), ['Process: minutesPerDay "0" must be a whole number from 1 to 1440.']);
 assert.deepEqual(reject(xml.replace('daysPerWeek="5"', 'daysPerWeek="8"')), ['Process: daysPerWeek "8" must be a whole number from 1 to 7.']);
 assert.deepEqual(reject(xml.replace('minutesPerDay="480"', 'minutesPerDay="8h"')), ['Process: minutesPerDay "8h" must be a whole number.']);
 assert.deepEqual(reject(xml.replace(' daysPerWeek="5"', '')), ['Process: a display calendar needs both minutesPerDay and daysPerWeek.']);
 // A foreign file never gains a calendar, whatever business-day option reads its durations.
 const foreign = fs.readFileSync(path.resolve(__dirname, '../examples/bpmn/support-ticket.bpmn'), 'utf8');
 for (const options of [{}, {minutesPerDay: 240}]) assert.equal(bpmn.import(foreign, options).definition!.calendar, undefined);
});

test('Calendar wording glosses business days and weeks and is exactly the minutes wording without a calendar', () => {
 for (const n of [0, 45, 119.5, 240, 2400, 19007, 100000]) {
  assert.equal(time.span(n), time.minutes(n));
  assert.equal(time.span(n, null), time.minutes(n));
  assert.equal(time.span(n, {minutesPerDay: Number.NaN, daysPerWeek: 5}), time.minutes(n));
 }
 const expected: [number, string][] = [[45, '45 min'], [479, '479 min (≈ 8 h)'], [480, '480 min (1 business day)'],
  [2000, '2,000 min (≈ 4.2 business days)'], [2400, '2,400 min (5 business days)'], [2401, '2,401 min (≈ 1 business week)'],
  [3600, '3,600 min (1.5 business weeks)'], [9600, '9,600 min (4 business weeks)']];
 for (const [n, text] of expected) assert.equal(time.span(n, CALENDAR), text, String(n));
 assert.equal(time.span(1440, {minutesPerDay: 1440, daysPerWeek: 7}), '1,440 min (1 business day)');
 assert.equal(time.span(720, {minutesPerDay: 60, daysPerWeek: 1}), '720 min (12 business weeks)');
});
