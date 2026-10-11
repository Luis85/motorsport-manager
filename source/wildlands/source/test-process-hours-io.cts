/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-time.ts" />
/**
 * Opt-in working hours at the definition boundary: plain schema and semantic diagnostics, the `setWorkingHours` recipe and
 * `process diff` paths, the BPMN extension round trip with the BPSim calendar and fidelity notes, the CLI's validate, inspect and
 * discover, and the clock wording (LWProcessTime.hours, clock, closedUntil).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {catalog, authoring, bpmn, conformance, diff} from './process-sdk.cjs';
import {test, base, copy, agency, guard} from './test-process-helpers.cjs';
const time = (globalThis as unknown as {LWProcessTime: LWProcessTime.Api}).LWProcessTime;
const OFFICE: LWProcess.WorkingHours = {opensAt: 540, closesAt: 1020, daysPerWeek: 5};
const withHours = (d: LWProcess.Definition, h: unknown = OFFICE) => ({...copy(d), workingHours: h}) as LWProcess.Definition;
const CLI = path.join(__dirname, 'tools/wildlands-cli.cjs');

test('Working hours reject out-of-range values, a closing before the opening and a display calendar beside them', () => {
 const opens = 'Working hours need opensAt as a whole number of minutes after midnight from 0 to 1439 (540 is 09:00).';
 const closes = 'Working hours need closesAt as a whole number of minutes after midnight from 1 to 1440 (1020 is 17:00).';
 const days = 'Working hours need daysPerWeek as a whole number of working days from 1 to 7, counted from Monday.';
 const cases: [unknown, string, string][] = [
  [{...OFFICE, opensAt: -1}, '/workingHours/opensAt', opens], [{...OFFICE, opensAt: 1440}, '/workingHours/opensAt', opens],
  [{...OFFICE, opensAt: 540.5}, '/workingHours/opensAt', opens], [{...OFFICE, closesAt: 0}, '/workingHours/closesAt', closes],
  [{...OFFICE, closesAt: 1441}, '/workingHours/closesAt', closes], [{...OFFICE, closesAt: '17:00'}, '/workingHours/closesAt', closes],
  [{...OFFICE, daysPerWeek: 0}, '/workingHours/daysPerWeek', days], [{...OFFICE, daysPerWeek: 8}, '/workingHours/daysPerWeek', days],
  [{opensAt: 540, closesAt: 1020}, '/workingHours', 'Missing field: daysPerWeek'], [{...OFFICE, shift: 2}, '/workingHours', 'Unknown field: shift'],
  [null, '/workingHours', 'Expected object.'],
 ];
 for (const [h, where, message] of cases) {
  const checked = catalog.validate(withHours(base(), h), true);
  assert.equal(checked.acceptable, false, JSON.stringify(h));
  assert.deepEqual(checked.diagnostics, [{path: where, code: 'shape', message}], JSON.stringify(h));
 }
 const graph = (h: LWProcess.WorkingHours, extra: Partial<LWProcess.Definition> = {}) => catalog.validate({...withHours(base(), h), ...extra}, true);
 assert.deepEqual(graph({...OFFICE, closesAt: 540}).diagnostics, [{path: '/workingHours/closesAt', code: 'graph',
  message: 'Working hours need closesAt after opensAt: the day would close at minute 540 but opens at minute 540.'}]);
 const both = graph(OFFICE, {calendar: {minutesPerDay: 480, daysPerWeek: 5}});
 assert.equal(both.ok, false);
 assert.equal(both.acceptable, true, 'a draft may hold both while the author removes one');
 assert.deepEqual(both.diagnostics, [{path: '/workingHours', code: 'graph', message: 'A process with working hours cannot also have a display '
  + 'calendar: its times count elapsed minutes. Remove calendar or workingHours.'}]);
 for (const h of [{opensAt: 0, closesAt: 1, daysPerWeek: 1}, {opensAt: 0, closesAt: 1440, daysPerWeek: 7}, {opensAt: 1439, closesAt: 1440, daysPerWeek: 3}]) {
  assert(catalog.validate(withHours(base(), h)).ok, JSON.stringify(h));
 }
});

test('setWorkingHours recipe places the field after calendar in schema order, removes it with null and diffs by value path', () => {
 const entries = Object.entries(base());
 entries.splice(entries.findIndex(([k]) => k === 'resources'), 0, ['genre', 'customer-journey'], ['track', [{field: 'mood'}]]);
 const d = Object.fromEntries(entries) as LWProcess.Definition;
 const set = authoring.edit(d, guard(d, [{op: 'setWorkingHours', value: OFFICE}]));
 const keys = Object.keys(set.definition);
 assert.deepEqual(keys.slice(keys.indexOf('start')), ['start', 'genre', 'workingHours', 'track', 'resources', 'steps', 'flows', 'arrivals']);
 assert.deepEqual(set.definition.workingHours, OFFICE);
 const removed = authoring.edit(set.definition, guard(set.definition, [{op: 'setWorkingHours', value: null}]));
 assert.equal(removed.definition.workingHours, undefined);
 assert.equal(catalog.fingerprint({...removed.definition, revision: d.revision}), catalog.fingerprint(d));
 assert.throws(() => authoring.edit(d, guard(d, [{op: 'setWorkingHours', value: {...OFFICE, closesAt: 500}}])),
  /\/workingHours\/closesAt: Working hours need closesAt after opensAt/);
 const calendared = {...copy(d), calendar: {minutesPerDay: 480, daysPerWeek: 5}};
 assert.throws(() => authoring.edit(calendared, guard(calendared, [{op: 'setWorkingHours', value: OFFICE}])), /cannot also have a display calendar/);
 const before = base(), after = withHours(before);
 assert.deepEqual(diff.settings(before, after), ['workingHours']);
 assert.deepEqual(diff.detail(before, after).fields, [{path: '/workingHours/closesAt', after: 1020}, {path: '/workingHours/daysPerWeek', after: 5},
  {path: '/workingHours/opensAt', after: 540}]);
 assert.deepEqual(diff.detail(after, withHours(before, {...OFFICE, closesAt: 960})).fields, [{path: '/workingHours/closesAt', before: 1020, after: 960}]);
});

test('BPMN round trip carries working hours exactly, with a BPSim calendar, and rejects bad extension values', () => {
 const plain = copy(agency), timed = withHours(agency);
 for (const options of [{}, {bpsim: true}]) {
  const xml = bpmn.export(timed, options), back = bpmn.analyze(xml);
  assert.match(xml, /<wl:workingHours opensAt="540" closesAt="1020" daysPerWeek="5"\/>/);
  assert.deepEqual(back.warnings, [], JSON.stringify(options));
  assert.deepEqual(back.definition!.workingHours, OFFICE);
  assert.equal(catalog.fingerprint(back.definition), catalog.fingerprint(timed), JSON.stringify(options));
  assert.equal(bpmn.export(back.definition, options), xml);
  const report = conformance.validate(xml);
  assert(report.conforms, JSON.stringify(report.errors.slice(0, 3)));
  assert.doesNotMatch(bpmn.export(plain, options), /workingHours|bpsim:Calendar|validFor/);
 }
 const sim = bpmn.export(timed, {bpsim: true});
 assert.match(sim, /<bpsim:Calendar id="Calendar_agency-delivery" name="Working hours">BEGIN:VCALENDAR&#13;&#10;/);
 assert.match(sim, /DTSTART:19700105T090000&#13;&#10;DTEND:19700105T170000&#13;&#10;RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR&#13;&#10;END:VEVENT/);
 assert.match(sim, /<bpsim:Availability><bpsim:BooleanParameter value="true" validFor="Calendar_agency-delivery"\/><\/bpsim:Availability>/);
 assert.match(sim, /<bpsim:InterTriggerTimer><bpsim:[A-Za-z]+ [^>]*validFor="Calendar_agency-delivery"\/>/);
 assert.match(bpmn.export(withHours(agency, {opensAt: 0, closesAt: 1440, daysPerWeek: 7}), {bpsim: true}),
  /DTSTART:19700105T000000&#13;&#10;DTEND:19700106T000000&#13;&#10;RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU/);
 assert.deepEqual(bpmn.fidelity(timed, {bpsim: true}).slice(-1), ['The working hours (09:00–17:00, Monday to Friday) travel as a BPSim calendar on pool '
  + 'availability and arrival timing; that running work pauses and resumes, that arrivals count working minutes and that the run starts on Monday '
  + 'at opening are only in the Wildlands extension.']);
 assert.deepEqual(bpmn.fidelity(timed).slice(-1), ['The working hours (09:00–17:00, Monday to Friday) are only in the Wildlands extension; they pause '
  + 'work and arrivals outside them, so a tool without it runs every minute as working time.']);
 assert(!bpmn.fidelity(plain, {bpsim: true}).some(n => /working hours/.test(n)));
 const xml = bpmn.export(timed), reject = (text: string) => bpmn.analyze(text).rejections.map(r => r.message);
 assert.deepEqual(reject(xml.replace('opensAt="540"', 'opensAt="1440"')), ['Working hours: opensAt "1440" must be a whole number from 0 to 1439.']);
 assert.deepEqual(reject(xml.replace('daysPerWeek="5"/>', 'daysPerWeek="0"/>')), ['Working hours: daysPerWeek "0" must be a whole number from 1 to 7.']);
 assert.deepEqual(reject(xml.replace(' closesAt="1020"', '')), ['Working hours need opensAt, closesAt and daysPerWeek; closesAt is missing.']);
 assert.deepEqual(reject(xml.replace('opensAt="540"', 'opensAt="9h"')), ['Working hours: opensAt "9h" must be a whole number.']);
 assert.deepEqual(reject(xml.replace('daysPerWeek="5"/>', 'daysPerWeek="5" shift="2"/>')), ['Process workingHours: unknown attribute shift.']);
 const twice = xml.replace(/(<wl:workingHours[^>]*\/>)/, '$1$1');
 assert.deepEqual(reject(twice), ['Process: working hours may appear once; found 2.']);
 // Closing before opening is the engine's diagnostic, never repaired.
 const early = bpmn.analyze(xml.replace('closesAt="1020"', 'closesAt="500"'));
 assert.deepEqual(early.diagnostics.map(e => e.path), ['/workingHours/closesAt']);
 // A file that lost the extension keeps its BPSim calendar only as a warning: working hours come from the extension alone.
 const foreign = sim.replace(/\s*<wl:workingHours[^>]*\/>/, '');
 const read = bpmn.analyze(foreign);
 assert.equal(read.definition!.workingHours, undefined);
 assert(read.warnings.includes('BPSim calendars and resource availability are ignored; working hours are read only from the Wildlands extension.'));
});

test('Working hours wording: the hours, the run clock and Closed until', () => {
 assert.equal(time.hours(OFFICE), '09:00–17:00, Monday to Friday');
 assert.equal(time.hours({opensAt: 0, closesAt: 1440, daysPerWeek: 7}), '00:00–24:00, every day');
 assert.equal(time.hours({opensAt: 450, closesAt: 735, daysPerWeek: 1}), '07:30–12:15, Monday only');
 assert.equal(time.clock(0, OFFICE), 'Day 1 · Mon 09:00');
 assert.equal(time.clock(1470, OFFICE), 'Day 2 · Tue 09:30');
 assert.equal(time.closedUntil(450, OFFICE), '');
 assert.equal(time.closedUntil(480, OFFICE), 'Closed until Tue 09:00 on day 2');
 assert.equal(time.clock(6300, OFFICE), 'Day 5 · Fri 18:00');
 assert.equal(time.closedUntil(6300, OFFICE), 'Closed until Mon 09:00 on day 8');
 assert.equal(time.closedUntil(100, {opensAt: 0, closesAt: 1440, daysPerWeek: 7}), '');
});

test('CLI validate, inspect and discover know working hours', () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'process-hours-'));
 try {
  const call = (args: string[], status = 0) => {
   const p = spawnSync(process.execPath, [CLI, 'process', ...args], {cwd: dir, encoding: 'utf8'});
   assert.equal(p.status, status, p.stderr + p.stdout);
   return JSON.parse(p.stdout) as Record<string, any>;
  };
  const d = withHours(base());
  fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify(d));
  fs.writeFileSync(path.join(dir, 'b.json'), JSON.stringify(withHours(base(), {...OFFICE, closesAt: 480})));
  fs.writeFileSync(path.join(dir, 'c.json'), JSON.stringify(base()));
  assert.deepEqual(call(['validate', '--input', 'a.json']).diagnostics, []);
  assert.deepEqual(call(['validate', '--input', 'b.json'], 1).diagnostics.map((e: LWProcess.Diagnostic) => e.path), ['/workingHours/closesAt']);
  const inspected = call(['inspect', '--input', 'a.json']);
  assert.deepEqual(inspected.workingHours, {...OFFICE, hours: '09:00–17:00, Monday to Friday', start: 'Day 1 · Mon 09:00',
   clock: 'elapsed minutes; work and arrivals pause outside working hours'});
  assert.deepEqual(call(['inspect', '--input', 'b.json']).workingHours, {...OFFICE, closesAt: 480}, 'a draft keeps its values without words');
  assert(!('workingHours' in call(['inspect', '--input', 'c.json'])), 'inspect is unchanged without working hours');
  const discovered = call(['discover']);
  assert(discovered.editOperations.includes('setWorkingHours'));
  assert(discovered.notes.some((n: string) => /setWorkingHours/.test(n)));
  const ops = call(['schema', '--kind', 'recipe']).schema.properties.operations.items.oneOf as {properties: {op: {const: string}; value: unknown}}[];
  const fields = catalog.schema.properties as Record<string, unknown>;
  assert.deepEqual(ops.find(o => o.properties.op.const === 'setWorkingHours')?.properties.value, {oneOf: [fields.workingHours, {type: 'null'}]});
 } finally {
  fs.rmSync(dir, {recursive: true, force: true});
 }
});
