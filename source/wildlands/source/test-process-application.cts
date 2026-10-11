/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-application.ts" />
/** Application controller contract: per-process run memory, Run to end and adding process slots (UX-9, UX-12, AUTH-2 slots). */
import assert from 'node:assert/strict';
import {catalog, runtime, authoring} from './process-sdk.cjs';
import {application, test, base, copy, agency} from './test-process-helpers.cjs';
require('./process-slots.js');
const slotsApi = (globalThis as unknown as {LWProcessSlots: {uniqueId(name: string, taken: string[]): string}}).LWProcessSlots;
/** A second admitted process with its own id and seed. */
const other = () => ({...authoring.create('second', 'Second'), seed: 5});
test('Each process keeps its own paused run across switches; switching never ticks and restores minute, snapshot, seed, selection and run length', () => {
 const app = application.create([agency, other()]);
 app.horizon(1440); app.seed(9); app.advance(45); app.select('discovery'); app.play(true);
 const left = app.query();
 app.use(1);
 const fresh = app.query();
 assert.deepEqual([fresh.active, fresh.snapshot.minute, fresh.selected, fresh.playing, fresh.horizon, fresh.snapshot.seed], [1, 0, null, false, 1440, 5]);
 app.horizon(null); app.advance(3); const second = app.query().snapshot;
 app.use(0);
 const back = app.query();
 assert.deepEqual(back.snapshot, left.snapshot, 'the same minute and the same snapshot');
 assert.deepEqual(
  [back.selected, back.horizon, back.playing, back.snapshot.seed],
  ['discovery', 1440, false, 9],
  'paused, with its seed, selection and run length',
 );
 app.pulse(30); assert.equal(app.query().snapshot.minute, 45, 'a paused run does not move on a pulse');
 app.use(1); assert.deepEqual(app.query().snapshot, second); assert.equal(app.query().horizon, null);
 // Reset, seed and replace act on the active slot only; the other run stays where it was.
 app.reset(); assert.equal(app.query().snapshot.minute, 0); app.use(0); assert.deepEqual(app.query().snapshot, left.snapshot);
 app.replace({...copy(agency), name: 'Edited agency', revision: agency.revision + 1}); app.use(1); app.use(0);
 assert.deepEqual([app.query().definition.name, app.query().snapshot.minute, app.query().snapshot.seed], ['Edited agency', 0, 9]);
 assert.throws(() => app.use(2), /Unknown process: 2/);
 app.dispose(); assert.throws(() => app.use(1), /disposed/);
});
test('Run to end is one bounded clock command that equals advancing the same minutes in steps '
 + 'and refuses without a run length or after the run stopped', () => {
 const app = application.create(agency); app.horizon(1440); app.play(true);
 const minutes = app.runToEnd(), ended = app.query();
 assert.equal(ended.playing, false, 'it pauses a playing run'); assert.equal(ended.snapshot.status, 'completed'); assert.equal(minutes, ended.snapshot.minute);
 const stepped = runtime.create(agency, {horizon: 1440});
 for (let at = 0; at < minutes; at += 30) stepped.advance(Math.min(30, minutes - at));
 assert.deepEqual(stepped.query(), ended.snapshot, 'the same minutes in steps give the same snapshot'); stepped.dispose();
 assert.throws(() => app.runToEnd(), /already stopped/); assert.deepEqual(app.query().snapshot, ended.snapshot);
 app.reset(); app.horizon(null); assert.throws(() => app.runToEnd(), /Set a run length to run to the end\./); assert.equal(app.query().snapshot.minute, 0);
 // An open stream never completes: it runs to the run length (limit) and stops there.
 const open = {...base(), arrivals: [{at: 0, interval: 7, data: {}, open: true}]} as unknown as LWProcess.Definition;
 const stream = application.create(open); stream.horizon(600);
 assert.equal(stream.runToEnd(), 600); assert.equal(stream.query().snapshot.status, 'limit');
 // A run length beyond one command stops at the engine's per-command limit and can be continued.
 const long = application.create(open); long.horizon(250000);
 assert.equal(long.runToEnd(), runtime.limits.minutes); assert.equal(long.query().snapshot.minute, runtime.limits.minutes);
 assert.equal(long.runToEnd(), runtime.limits.minutes); assert.equal(long.runToEnd(), 50000); assert.equal(long.query().snapshot.status, 'limit');
 for (const c of [app, stream, long]) c.dispose();
});
test('Adding a process admits a new slot up to eight with unique ids and leaves the active run untouched', () => {
 const app = application.create(agency); app.advance(30); const before = app.query();
 assert.equal(app.add(other()), 1); const after = app.query();
 assert.deepEqual([after.active, after.snapshot, after.processes.map(p => p.id)], [0, before.snapshot, [agency.id, 'second']]);
 assert.throws(() => app.add(other()), /A process with the id "second" is already open/); assert.equal(app.query().processes.length, 2);
 assert.throws(() => app.add({}), /.+/); assert.equal(app.query().processes.length, 2, 'an invalid definition is refused');
 for (let i = 3; i <= 8; i++) app.add(authoring.create('p' + i, 'P' + i));
 assert.equal(app.query().processes.length, application.MAX_PROCESSES);
 assert.throws(() => app.add(authoring.create('p9', 'P9')), /^Error: A studio holds at most 8 processes\.$/);
 app.use(7); assert.deepEqual([app.query().definition.id, app.query().snapshot.minute], ['p8', 0]);
 assert.deepEqual(app.definitions().map(d => catalog.fingerprint(d)).slice(0, 1), [catalog.fingerprint(agency)]);
 app.dispose();
 // The studio derives a new id from a name and never reuses a taken one.
 assert.equal(slotsApi.uniqueId('Order intake — Wave 2', []), 'order-intake-wave-2');
 assert.equal(slotsApi.uniqueId('Ölprozess', ['olprozess']), 'olprozess-2');
 assert.equal(slotsApi.uniqueId('42 ???', ['process', 'process-2']), 'process-3');
 assert.match(slotsApi.uniqueId('x'.repeat(200), []), /^x{56}$/);
});
