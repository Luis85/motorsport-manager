/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-checkpoint.ts" />
/**
 * Entry of the business-process-checkpoint suite: run checkpoints (LWProcessCheckpoint, LWProcessEngineState and
 * LWProcessCheckpointCheck). A restored run must equal an uninterrupted run exactly on every demo (snapshot, later events, series,
 * distributions, recent cases and saved state), also when continued in chunks and when a restored run is saved again; the
 * controller exports without ticking and restores as one command that never ticks; refusals change nothing. Hostile files are
 * checked in test-process-checkpoint-hostile.cts and the CLI flags in test-process-checkpoint-cli.cts.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {catalog, runtime} from './process-sdk.cjs';
import {application, results, test, copy} from './test-process-helpers.cjs';
import {checkpoints, checkpointText, demo, demoFiles, reads} from './test-process-checkpoint-helpers.cjs';

test('Checkpoint restore equals an uninterrupted run on every demo, seed and minute: snapshot, later events, series and the read model', () => {
 const files = demoFiles();
 assert.equal(files.length, 7, 'the agency game holds seven process demos');
 for (const file of files) {
  const d = demo(file);
  for (const [seed, minute] of [[1, 3], [7, 600], [4242, 2500]] as const) {
   const label = `${file} seed ${seed} at minute ${minute}`, early: LWProcess.Event[] = [], late: LWProcess.Event[] = [];
   const whole = runtime.create(d, {seed, horizon: 20000, onEvent: e => early.push(e)});
   whole.advance(minute);
   const text = JSON.stringify(checkpoints.create(d, whole.horizon(), whole.state())), saved = checkpoints.verify(checkpoints.parse(text), d);
   const restored = runtime.create(d, {horizon: saved.runLength, restore: saved.snapshot, onEvent: e => late.push(e)});
   assert.equal(reads(restored), reads(whole), label + ': restored as saved');
   const before = early.length;
   whole.advance(6000 - minute);
   for (let left = 6000 - minute; left > 0; left -= 997) restored.advance(Math.min(997, left));
   assert.equal(reads(restored), reads(whole), label + ': continued in chunks to minute 6000');
   assert.deepEqual(late, early.slice(before), label + ': the same events after the restore, and only those');
   whole.dispose(); restored.dispose();
  }
 }
});
test('A restored run saved again equals the checkpoint of the uninterrupted run, and a chain of restores equals one run', () => {
 const d = demo('loan-application.process.json'), straight = runtime.create(d, {seed: 11, horizon: null});
 straight.advance(1200);
 const at1200 = JSON.stringify(checkpoints.create(d, null, straight.state()));
 let session = runtime.create(d, {seed: 11, horizon: null});
 for (const [from, to] of [[0, 500], [500, 1200]] as const) {
  session.advance(to - from);
  const text = JSON.stringify(checkpoints.create(d, null, session.state()));
  session.dispose();
  session = runtime.create(d, {horizon: null, restore: checkpoints.verify(checkpoints.parse(text), d).snapshot});
 }
 assert.equal(JSON.stringify(checkpoints.create(d, null, session.state())), at1200, 'the same file, byte for byte');
 straight.advance(5000); session.advance(5000);
 assert.equal(reads(session), reads(straight));
 session.dispose(); straight.dispose();
});
test('A checkpoint file has the version-1 header and keeps the run options: seed, run length, case caps and series on or off', () => {
 const d = demo('order-fulfilment.process.json'), text = checkpointText(d, 777, {seed: 31, horizon: 3000, retained: 40, active: 120});
 const c = checkpoints.parse(text);
 assert.deepEqual(Object.keys(c), ['kind', 'version', 'process', 'fingerprint', 'seed', 'minute', 'runLength', 'snapshot']);
 assert.deepEqual([c.kind, c.version, c.process, c.fingerprint, c.seed, c.minute, c.runLength],
  ['wildlands-process-checkpoint', 1, d.id, catalog.fingerprint(d), 31, 777, 3000]);
 assert.deepEqual([c.snapshot.seed, c.snapshot.active, c.snapshot.retained, c.snapshot.series?.every, c.snapshot.series?.points], [31, 120, 40, 60, 480]);
 const restored = runtime.create(d, {horizon: 3000, restore: checkpoints.verify(c, d).snapshot});
 const whole = runtime.create(d, {seed: 31, horizon: 3000, retained: 40, active: 120});
 whole.advance(3000); restored.advance(2223);
 assert.equal(reads(restored), reads(whole), 'caps and seed come from the file');
 assert.equal(restored.query().status, 'limit');
 const plain = checkpointText(d, 300, {series: false, horizon: null});
 const off = runtime.create(d, {horizon: null, restore: checkpoints.verify(checkpoints.parse(plain), d).snapshot});
 assert.equal(off.series(), null, 'a run without series stays without');
 assert.equal(checkpoints.parse(plain).runLength, null);
 for (const s of [restored, whole, off]) s.dispose();
});
test('The controller exports a checkpoint without ticking and restores it as one command paused at its minute with its seed and run length', () => {
 const agency = demo('agency.process.json'), other = demo('loan-application.process.json');
 const app = application.create([agency, other]);
 app.horizon(5000); app.seed(9); app.advance(130); app.select('discovery'); app.play(true);
 const before = app.query(), saved = app.checkpoint();
 assert.deepEqual(app.query(), before, 'exporting is a query: nothing moved, the run is still playing');
 assert.deepEqual([saved.process, saved.minute, saved.seed, saved.runLength], [agency.id, 130, 9, 5000]);
 app.use(1); app.advance(45); const second = app.query().snapshot; app.use(0);
 app.horizon(null); app.seed(null); app.advance(300);
 app.restore(JSON.parse(JSON.stringify(saved)));
 const back = app.query();
 assert.deepEqual(back.snapshot, before.snapshot, 'the run is exactly the saved one');
 assert.deepEqual([back.playing, back.horizon, back.selected, back.snapshot.seed], [false, 5000, 'discovery', 9]);
 app.reset(); assert.equal(app.query().snapshot.seed, 9, 'the run seed stays with the process like a seed chosen with seed()');
 app.restore(saved); app.advance(70);
 const straight = application.create(agency); straight.horizon(5000); straight.seed(9); straight.advance(200);
 assert.deepEqual(app.query().snapshot, straight.query().snapshot, 'continuing equals one uninterrupted run');
 app.use(1); assert.deepEqual(app.query().snapshot, second, 'another process keeps its own run');
 const plain = application.create(agency); plain.advance(40); const own = plain.checkpoint(); plain.seed(3); plain.restore(own);
 plain.reset(); assert.equal(plain.query().snapshot.seed, agency.seed ?? 1, 'a checkpoint on the definition seed leaves no override');
 for (const c of [app, straight, plain]) c.dispose();
 assert.throws(() => app.checkpoint(), /disposed/); assert.throws(() => app.restore(saved), /disposed/);
});
test('Restoring refuses another process, another definition naming both fingerprints, and a bad run state, and changes nothing', () => {
 const agency = demo('agency.process.json'), app = application.create(agency);
 app.advance(90);
 const saved = app.checkpoint(), before = app.query();
 const loan = checkpointText(demo('loan-application.process.json'), 50);
 assert.throws(() => app.restore(JSON.parse(loan)), /^Error: This checkpoint belongs to the process loan-application, not to agency-delivery\.$/);
 const edited = {...copy(agency), revision: agency.revision + 1, name: 'Agency (edited)'};
 app.replace(edited); app.advance(90); const changed = app.query();
 const message = `This checkpoint was saved from definition fingerprint ${catalog.fingerprint(agency)}, but the applied definition of Agency (edited) has`
  + ` fingerprint ${catalog.fingerprint(edited)}. Import or apply the definition the checkpoint was saved from, then load the checkpoint again.`;
 assert.throws(() => app.restore(saved), (e: Error) => e.message === message);
 assert.deepEqual(app.query(), changed, 'a refused checkpoint changes nothing');
 app.replace(agency); app.advance(90);
 const broken = copy(saved); broken.snapshot.tokens[0]!.stepId = 'nowhere';
 assert.throws(() => app.restore(broken), /^Error: The checkpoint's run state is not valid for this process: snapshot\.tokens\[0\]\.stepId names no step/);
 assert.deepEqual(app.query().snapshot, before.snapshot);
 app.dispose();
});
test('A session restore takes its seed, caps and series from the saved state, refuses those options, and emits only later events', () => {
 const d = demo('order-fulfilment.process.json'), saved = checkpoints.parse(checkpointText(d, 240, {seed: 5}));
 for (const option of [{seed: 5}, {active: 10}, {retained: 10}, {series: false as const}]) {
  assert.throws(() => runtime.create(d, {restore: saved.snapshot, ...option}), /takes its seed, case caps and series from the saved state/);
 }
 const events: LWProcess.Event[] = [], session = runtime.create(d, {restore: checkpoints.verify(saved, d).snapshot, onEvent: e => events.push(e)});
 assert.equal(events.length, 0, 'creating a restored session settles nothing');
 assert.equal(session.query().minute, 240);
 session.advance(500);
 assert(events.length > 0 && events.every(e => e.minute > 240), 'the sink sees the later events');
 assert.throws(() => runtime.create(d, {restore: {}}), /snapshot\.seed is missing/);
 session.dispose();
});
/** One case a minute, 1-4 minutes of work, then a 70% goal: past 50,000 completed cases within about 50,000 minutes. */
function flood(): LWProcess.Definition {
 const at = (id: string, kind: LWProcess.Kind, x: number, extra: Partial<LWProcess.Step> = {}): LWProcess.Step =>
  ({id, name: id, kind, scene: {id: 'scene-' + id, position: [x, 0], color: '#ffbb73'}, ...extra});
 return {format: 'wildlands-process', schemaVersion: 1, revision: 0, id: 'flood', name: 'Flood', start: 'in', resources: [],
  steps: [at('in', 'start', 0), at('work', 'task', 12, {duration: 3, timing: {dist: 'uniform', min: 1, max: 4}}), at('pick', 'decision', 24),
   at('won', 'end', 36, {outcome: 'goal'}), at('gone', 'end', 48, {outcome: 'lost'})],
  flows: [{id: 'f1', from: 'in', to: 'work'}, {id: 'f2', from: 'work', to: 'pick'}, {id: 'f3', from: 'pick', to: 'won', when: {chance: 70}},
   {id: 'f4', from: 'pick', to: 'gone'}],
  arrivals: [{at: 0, interval: 1, open: true, data: {}}]};
}
test('Exact lead-time percentiles, whole run and per outcome, survive a checkpoint before and past the 50,000-case bound', () => {
 const d = flood(), whole = runtime.create(d, {horizon: null});
 const restore = (text: string) => runtime.create(d, {horizon: null, restore: checkpoints.verify(checkpoints.parse(text), d).snapshot});
 whole.advance(30000);
 assert.equal(whole.distributions().percentiles!.cycle.exact, true, 'a read sorts the values kept so far');
 whole.advance(19990);
 const before = JSON.stringify(checkpoints.create(d, null, whole.state())), exact = checkpoints.parse(before).snapshot.ledger.exact;
 assert(exact.cycle.ordered > 0 && exact.cycle.ordered < exact.cycle.values.length && exact.outcomes !== null, 'a sorted prefix and new values');
 assert.equal(exact.cycle.values.length, whole.query().metrics.completed);
 const early = restore(before);
 assert.equal(reads(early), reads(whole), 'restored below the bound');
 whole.advance(200); early.advance(200);
 const percentiles = whole.distributions().percentiles!;
 assert.deepEqual([percentiles.cycle.exact, percentiles.byOutcome!.goal.exact], [false, false], 'the run passed the bound');
 assert.equal(reads(early), reads(whole), 'continued past the bound');
 const past = JSON.stringify(checkpoints.create(d, null, whole.state()));
 assert.deepEqual(checkpoints.parse(past).snapshot.ledger.exact.cycle.values, [], 'past the bound nothing is kept');
 const late = restore(past);
 whole.advance(500); late.advance(500);
 assert.equal(reads(late), reads(whole), 'restored past the bound');
 for (const s of [whole, early, late]) s.dispose();
});
require('./test-process-checkpoint-hostile.cjs');
require('./test-process-checkpoint-cli.cjs');
const report = {suite: 'business-process-checkpoint', passed: results.filter(r => r.passed).length, total: results.length, results};
fs.writeFileSync(path.join(__dirname, 'process-checkpoint-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`${report.passed}/${report.total} process checkpoint checks passed`);
for (const r of results) if (!r.passed) console.error(r.name, r.error);
if (report.passed !== report.total) process.exitCode = 1;
