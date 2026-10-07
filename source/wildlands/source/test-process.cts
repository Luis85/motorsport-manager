/// <reference path="./process-contracts.d.ts" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import {catalog, runtime, authoring} from './process-sdk.cjs';
require('./process-application.js');
const application = (globalThis as unknown as {LWProcessApplication: LWProcessApp.Api}).LWProcessApplication;
const results: {name: string; passed: boolean; error?: string}[] = [];
function test(name: string, work: () => void): void {try {work(); results.push({name, passed: true});} catch (e) {results.push({name, passed: false, error: String(e)});}}
const base = () => authoring.create('sample', 'Sample');
const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const agency = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../docs/concepts/agency-delivery/content/agency.process.json'), 'utf8')) as LWProcess.Definition;
function guard(d: LWProcess.Definition, operations: LWProcess.Recipe['operations']): LWProcess.Recipe {return {expectedRevision: d.revision, expectedFingerprint: catalog.fingerprint(d), operations};}
const run = (d: LWProcess.Definition, minutes: number) => {const s = runtime.create(d); try {return s.advance(minutes);} finally {s.dispose();}};

test('One task completes at its declared business minute with detached read queries', () => {
 const s = runtime.create(base()), first = s.query(); first.cases[0]!.data.changed = true;
 assert.equal(s.query().minute, 0); assert.equal(s.query().cases[0]!.data.changed, undefined);
 assert.equal(s.advance(4).metrics.completed, 0); const q = s.advance(1);
 assert.equal(q.minute, 5); assert.equal(q.metrics.meanCycleMinutes, 5); assert.equal(q.metrics.completed, 1); s.dispose(); assert.throws(() => s.query());
});
test('Process inputs and per-visit outputs remain detached after later changes', () => {
 const d = base(); d.arrivals[0]!.data = {approved: false, note: '<input>', empty: null, count: 0}; d.steps[1]!.set = {approved: true};
 const session = runtime.create(d), first = session.query();
 assert.deepEqual(first.tokens[0]!.input, d.arrivals[0]!.data); first.tokens[0]!.input!.approved = 'tampered';
 const q = session.advance(5); assert.equal(q.cases[0]!.input.approved, false); assert.equal(q.cases[0]!.data.approved, true);
 assert.equal(q.receipts[0]!.input.approved, false); assert.equal(q.receipts[0]!.output.approved, true);
 assert.deepEqual(q.receipts[0]!.changes, {approved: true}); assert.equal(q.receipts[0]!.started, 0); assert.equal(q.receipts[0]!.finished, 5);
 q.receipts[0]!.output.approved = 'tampered'; assert.equal(session.query().receipts[0]!.output.approved, true); session.dispose();
});
test('Queued visits have no captured inputs or completed outputs until started', () => {
 const d = base(); d.resources = [{id: 'worker', name: 'Worker', capacity: 1, costPerMinute: 0}]; d.steps[1]!.resources = {worker: 1}; d.arrivals[0]!.count = 2;
 const session = runtime.create(d); assert.equal(session.query().tokens[1]!.input, null); assert.equal(session.query().receipts.length, 0);
 const q = session.advance(5); assert.equal(q.receipts.length, 1); assert.equal(q.tokens[0]!.started, 5); assert.deepEqual(q.tokens[0]!.input, {}); session.dispose();
});
test('Rework and parallel visits retain actual start data and explicit writes', () => {
 const q = run(agency, 500), rework = q.receipts.find(r => r.stepId === 'rework')!;
 assert.equal(rework.input.needsRework, true); assert.equal(rework.output.needsRework, false);
 const repeated = q.receipts.filter(r => r.caseId === rework.caseId && r.stepId === 'qa');
 assert.equal(repeated.length, 2); assert.notEqual(repeated[0]!.id, repeated[1]!.id);
 const ux = q.receipts.find(r => r.stepId === 'ux')!, tech = q.receipts.find(r => r.stepId === 'architecture')!;
 assert.deepEqual(ux.changes, {uxReady: true}); assert.deepEqual(tech.changes, {techReady: true});
 assert.equal(ux.input.uxReady, undefined); assert.equal(tech.input.techReady, undefined);
});
test('Completion history is bounded without dropping process inputs or final outputs', () => {
 const d = base(); d.arrivals[0]!.count = 200; d.arrivals[0]!.data = {request: 'kept'}; d.steps[1]!.set = {done: true};
 const q = run(d, 5); assert.equal(q.receipts.length, 128); assert.equal(q.receiptsDropped, 72);
 assert.equal(q.cases.length, 200); assert(q.cases.every(c => c.input.request === 'kept' && c.data.done));
});
test('FIFO shared capacity produces exact queue times, utilization and costs', () => {
 const d = base(); d.resources = [{id: 'worker', name: 'Worker', capacity: 1, costPerMinute: 2}];
 d.steps[1]!.resources = {worker: 1}; d.steps[1]!.cost = 7; d.arrivals[0]!.count = 2;
 const q = run(d, 20); assert.equal(q.minute, 10); assert.equal(q.metrics.completed, 2); assert.equal(q.metrics.cost, 34);
 assert.equal(q.steps.find(s => s.id === 'work')!.waitMinutes, 5); assert.equal(q.resources[0]!.busyMinutes, 10); assert.equal(q.resources[0]!.utilization, 1);
 assert.deepEqual(q.cases.map(c => c.finished), [5, 10]);
});
test('Multiple resources allocate atomically and never exceed capacity', () => {
 const d = base(); d.resources = [{id: 'a', name: 'A', capacity: 2, costPerMinute: 1}, {id: 'b', name: 'B', capacity: 1, costPerMinute: 1}];
 d.steps[1]!.resources = {a: 2, b: 1}; d.arrivals[0]!.count = 3;
 const s = runtime.create(d); for (let i = 0; i < 15; i++) {const q = s.query(); assert(q.resources.every(r => r.busy <= r.capacity)); s.advance(1);}
 const q = s.query(); assert.equal(q.metrics.cost, 45); assert.equal(q.metrics.completed, 3); assert(q.resources.every(r => !r.busy)); s.dispose();
});
test('Future arrivals and zero interval batches preserve authored arrival order', () => {
 const d = base(); d.arrivals = [{at: 10, count: 2, interval: 0, data: {label: 'batch'}}, {at: 0, count: 1, interval: 0, data: {label: 'first'}}];
 const s = runtime.create(d); assert.equal(s.query().cases[0]!.data.label, 'first');
 assert.equal(s.advance(9).metrics.arrived, 1); assert.equal(s.advance(1).metrics.arrived, 3); assert.equal(s.advance(5).metrics.completed, 3); s.dispose();
});
test('Agency parallel joins and rework complete with exact deterministic evidence', () => {
 const q = run(agency, 500); assert.equal(q.minute, 189); assert.equal(q.metrics.completed, 6); assert.equal(q.metrics.failed, 0); assert.equal(q.metrics.cost, 1536);
 assert.equal(q.steps.find(s => s.id === 'design-ready')!.completed, 6); assert.equal(q.steps.find(s => s.id === 'qa')!.completed, 9);
 assert.equal(q.steps.find(s => s.id === 'rework')!.completed, 3); assert(q.cases.every(c => c.data.uxReady && c.data.techReady && !c.data.needsRework));
});
test('Chunked clock commands and one bounded run produce identical snapshots', () => {
 const whole = run(agency, 150), s = runtime.create(agency); for (let i = 0; i < 15; i++) s.advance(10);
 assert.deepEqual(s.query(), whole); s.dispose();
});
test('Decisions take matching rules before fallback regardless of fallback position', () => {
 const d = copy(agency); const fallback = d.flows.findIndex(f => f.from === 'review-gate' && !f.when); d.flows.unshift(d.flows.splice(fallback, 1)[0]!);
 const q = run(d, 500); assert.equal(q.steps.find(s => s.id === 'rework')!.completed, 3);
});
test('Missing condition fields choose fallback and numeric comparisons are typed', () => {
 const d = copy(agency); d.arrivals.forEach(a => a.data = {}); const q = run(d, 500); assert.equal(q.steps.find(s => s.id === 'rework')!.completed, 0);
 const graph = (globalThis as unknown as {LWProcessGraph: {matches(data: LWProcess.Fields, c: LWProcess.Condition): boolean}}).LWProcessGraph;
 for (const op of ['gt', 'gte', 'lt', 'lte'] as const) assert.equal(graph.matches({value: '5'}, {field: 'value', op, value: 3}), false);
 assert.equal(graph.matches({}, {field: 'missing', op: 'ne', value: true}), false);
});
test('Zero-work routing loops fail explicitly within the transition budget', () => {
 const d = base(); d.steps[1]!.kind = 'decision'; delete d.steps[1]!.duration;
 d.flows.push({id: 'repeat', from: 'work', to: 'work', when: {field: 'again', op: 'eq', value: true}}); d.arrivals[0]!.data.again = true;
 const s = runtime.create(d), q = s.query(); assert.equal(q.metrics.failed, 1); assert.equal(q.tokens.length, 0); assert.match(q.cases[0]!.error!, /2048/); s.dispose();
});
test('Bounded run limits and rejected clock commands preserve state', () => {
 const d = base(); d.steps[1]!.duration = 100000; d.arrivals[0]!.at = 1;
 const s = runtime.create(d), before = s.query(); for (const n of [0, -1, .5, NaN, Infinity, 100001]) assert.throws(() => s.advance(n));
 assert.deepEqual(s.query(), before); assert.equal(s.advance(100000).status, 'limit'); assert.throws(() => s.advance(1)); s.dispose();
});
test('Run horizon is configurable per session, defaults to the engine limit and may be unlimited', () => {
 const d = base(); d.steps[1]!.duration = 100000; d.arrivals[0]!.at = 1;
 const short = runtime.create(d, {horizon: 10}); assert.equal(short.horizon(), 10); assert.throws(() => short.advance(11)); assert.equal(short.advance(10).status, 'limit');
 short.setHorizon(null); assert.equal(short.advance(5).status, 'running'); assert.throws(() => short.setHorizon(0)); assert.throws(() => short.setHorizon(1.5)); short.dispose();
 const open = runtime.create(d, {horizon: null}); assert.equal(open.advance(100000).minute, 100000); assert.equal(open.query().status, 'running'); assert.equal(open.advance(100000).status, 'completed'); open.dispose();
 const fixed = runtime.create(d); assert.equal(fixed.horizon(), runtime.limits.minutes); assert.equal(fixed.advance(100000).status, 'limit'); fixed.dispose();
});
test('Malformed, unknown and unsafe JSON values never pass admission', () => {
 for (const value of [null, [], {...base(), surprise: true}, {...base(), revision: NaN}, {...base(), format: 'bpmn'}]) assert.equal(catalog.validate(value).ok, false);
 const d = base(); Object.defineProperty(d, 'name', {get() {throw Error('getter executed');}, enumerable: true});
 assert(!catalog.validate(d).diagnostics.some(e => e.message.includes('getter executed')));
 const unsafe = JSON.parse(JSON.stringify(base()).replace('"data":{}', '"data":{"__proto__":true}'));
 assert.equal(catalog.validate(unsafe).ok, false);
});
test('Dangling links, duplicate IDs and scene identities are rejected', () => {
 for (const mutate of [(d: LWProcess.Definition) => {d.flows[0]!.to = 'missing';}, (d: LWProcess.Definition) => {d.steps[1]!.id = 'start';}, (d: LWProcess.Definition) => {d.steps[1]!.scene.id = d.steps[0]!.scene.id;}]) {
  const d = base(); mutate(d); assert.equal(catalog.validate(d).ok, false);
 }
});
test('Unreachable work and paths with no end are rejected', () => {
 const d = base(); d.steps.push({...copy(d.steps[1]!), id: 'orphan', scene: {...d.steps[1]!.scene, id: 'scene-orphan'}}); d.flows.push({id: 'orphan-end', from: 'orphan', to: 'end'});
 assert.equal(catalog.validate(d).ok, false); d.flows[1]!.to = 'work'; assert(catalog.validate(d).diagnostics.some(e => e.message.includes('route to an end')));
});
test('Impossible resources and invalid task fields are rejected before execution', () => {
 const d = base(); d.steps[1]!.resources = {missing: 1}; assert.equal(catalog.validate(d).ok, false);
 delete d.steps[1]!.resources; d.steps[0]!.duration = 1; assert.equal(catalog.validate(d).ok, false);
});
test('Parallel region rejects branch overlap, nested controls and conflicting writes', () => {
 for (const mutate of [(d: LWProcess.Definition) => {d.steps.find(s => s.id === 'architecture')!.set = {uxReady: true};},
  (d: LWProcess.Definition) => {d.flows.find(f => f.id === 'design-split-architecture')!.to = 'ux';},
  (d: LWProcess.Definition) => {const s = d.steps.find(s => s.id === 'ux')!; s.kind = 'decision'; delete s.duration; delete s.resources; delete s.set;}]) {
  const d = copy(agency); mutate(d); assert.equal(catalog.validate(d).ok, false);
 }
});
test('Scene Forge exports are admitted as world assets and executable asset fields reject', () => {
 assert(agency.steps.every(s => s.scene.asset)); assert.equal(catalog.validate(agency).ok, true);
 const d = copy(agency); (d.steps[0]!.scene.asset as Record<string, unknown>).script = 'alert(1)'; assert.equal(catalog.validate(d).ok, false);
});
test('Fingerprint ignores object key order and tracks complete definition changes', () => {
 const d = base(); const reordered = Object.fromEntries(Object.entries(d).reverse()); assert.equal(catalog.fingerprint(d), catalog.fingerprint(reordered));
 d.steps[1]!.duration!++; assert.notEqual(catalog.fingerprint(d), catalog.fingerprint(base()));
});
test('Guarded edits validate atomically and stale guards preserve input', () => {
 const d = base(), before = copy(d); const result = authoring.edit(d, guard(d, [{op: 'rename', value: 'Edited'}]));
 assert.equal(result.definition.revision, 1); assert.equal(result.definition.name, 'Edited'); assert.deepEqual(d, before);
 assert.throws(() => authoring.edit(result.definition, guard(d, [{op: 'rename', value: 'Stale'}])));
 assert.throws(() => authoring.edit(d, guard(d, [{op: 'rename', value: 'Would change'}, {op: 'removeStep', id: 'work'}]))); assert.deepEqual(d, before);
});
test('Incremental drafts retain explicit diagnostics and become runnable when connected', () => {
 const d = base(), added = {...copy(d.steps[1]!), id: 'extra', scene: {...d.steps[1]!.scene, id: 'scene-extra'}};
 const draft = authoring.edit(d, guard(d, [{op: 'putStep', value: added}]), true);
 assert(draft.diagnostics.length); assert.throws(() => runtime.create(draft.definition));
 const complete = authoring.edit(draft.definition, guard(draft.definition, [{op: 'putFlow', value: {id: 'work-end', from: 'work', to: 'extra'}}, {op: 'putFlow', value: {id: 'extra-end', from: 'extra', to: 'end'}}]));
 assert.equal(run(complete.definition, 20).minute, 10);
});
test('Scene and renderer navigation leaves the authoritative run untouched', () => {
 const app = application.create(agency); app.advance(30); const q = app.query().snapshot;
 app.select('ux'); app.mode('2d'); app.select('qa'); app.mode('3d'); assert.deepEqual(app.query().snapshot, q);
 app.dispose();
});
test('Rejected imports preserve session and definition; valid import starts paused', () => {
 const app = application.create(agency); app.advance(30); const previous = app.query();
 assert.throws(() => app.replace({})); assert.deepEqual(app.query(), previous);
 app.replace(base()); assert.equal(app.query().snapshot.minute, 0); assert.equal(app.query().playing, false); app.dispose();
});
test('Definition JSON Schema and runtime agree on structural fixtures', () => {
 const Ajv = require('ajv'); const ajv = new Ajv({strict: false, allowUnionTypes: true}); const validate = ajv.compile(catalog.schema);
 for (const d of [base(), agency]) assert(validate(d), JSON.stringify(validate.errors));
 for (const field of ['name', 'revision', 'steps', 'flows', 'resources']) {const d = base() as unknown as Record<string, unknown>; delete d[field]; assert(!validate(d)); assert(!catalog.validate(d).ok);}
});
test('CLI agent workflow supports create, dry-run, guarded edit, inspect and bounded run', () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'process-tools-'));
 try {
  const cli = path.join(__dirname, 'tools/wildlands-cli.cjs');
  const call = (args: string[], code = 0) => {const p = spawnSync(process.execPath, [cli, 'process', ...args], {cwd: dir, encoding: 'utf8'}); assert.equal(p.status, code, p.stderr + p.stdout); return JSON.parse(p.stdout) as Record<string, any>;};
  const created = call(['create', '--id', 'sample', '--output', 'a.json']); const d = JSON.parse(fs.readFileSync(path.join(dir, 'a.json'), 'utf8')) as LWProcess.Definition;
  assert.equal(call(['inspect', '--input', 'a.json']).fingerprint, created.fingerprint);
  fs.writeFileSync(path.join(dir, 'recipe.json'), JSON.stringify(guard(d, [{op: 'rename', value: 'Agent workflow'}])));
  const dry = call(['edit', '--input', 'a.json', '--recipe', 'recipe.json', '--dry-run']); assert(dry.dryRun); assert.equal(fs.readdirSync(dir).length, 2);
  call(['edit', '--input', 'a.json', '--recipe', 'recipe.json', '--output', 'b.json']);
  const report = call(['run', '--input', 'b.json', '--minutes', '20', '--output', 'report.json']); assert.equal(report.advancedMinutes, 5);
  call(['run', '--input', 'b.json', '--minutes', '20', '--output', 'b.json'], 2);
  fs.linkSync(path.join(dir, 'b.json'), path.join(dir, 'alias.json')); call(['run', '--input', 'b.json', '--minutes', '20', '--output', 'alias.json'], 2);
  assert(call(['schema', '--kind', 'recipe']).schema); assert.equal(call(['discover']).operations.length, 10);
 } finally {fs.rmSync(dir, {recursive: true, force: true});}
});
test('Scene Forge attachment requires exact edit guards and retains compiled geometry', () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'process-attach-'));
 try {
  const d = base(); fs.writeFileSync(path.join(dir, 'process.json'), JSON.stringify(d));
  fs.writeFileSync(path.join(dir, 'asset.json'), JSON.stringify({visual: agency.steps[1]!.scene.asset}));
  const args = ['process', 'attach', '--input', 'process.json', '--asset', 'asset.json', '--step', 'work', '--expected-revision', '0', '--expected-fingerprint', catalog.fingerprint(d), '--output', 'new.json'];
  const p = spawnSync(process.execPath, [path.join(__dirname, 'tools/wildlands-cli.cjs'), ...args], {cwd: dir, encoding: 'utf8'}); assert.equal(p.status, 0, p.stdout);
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'new.json'), 'utf8')) as LWProcess.Definition; assert.deepEqual(saved.steps[1]!.scene.asset, agency.steps[1]!.scene.asset);
 } finally {fs.rmSync(dir, {recursive: true, force: true});}
});
test('CLI rejects bad arguments before work, forges once, builds html and guards outputs', () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'process-cli-'));
 try {
  const cli = path.join(__dirname, 'tools/wildlands-cli.cjs');
  const call = (args: string[], code = 0) => {const p = spawnSync(process.execPath, [cli, 'process', ...args], {cwd: dir, encoding: 'utf8'}); assert.equal(p.status, code, args.join(' ') + p.stderr + p.stdout); return JSON.parse(p.stdout) as Record<string, any>;};
  const list = () => fs.readdirSync(dir).sort().join();
  const d = base(); fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify(d));
  fs.writeFileSync(path.join(dir, 'recipe.json'), JSON.stringify(guard(d, [{op: 'rename', value: 'X'}])));
  const before = list(), guards = ['--expected-fingerprint', catalog.fingerprint(d)], attach = ['attach', '--input', 'a.json', '--asset', 'a.json', '--step', 'work', ...guards];
  const bad: string[][] = [['bogus'], ['create', '--id', 'x', '--bogus', '1', '--output', 'x.json'], ['create', '--id', 'x', '--id', 'y', '--output', 'x.json'], ['create', '--id'],
   ['create', '--output', 'x.json'], ['edit', '--input', 'a.json', '--recipe', 'recipe.json', '--dry-run', '--output', 'x.json'], ['edit', '--input', 'a.json', '--recipe', 'recipe.json'],
   ['build', '--input', 'a.json', '--output', 'x.txt'], ['run', '--input', 'a.json', '--minutes', 'ten', '--output', 'x.json'], ['run', '--input', 'a.json', '--minutes', '-1', '--output', 'x.json'],
   [...attach, '--expected-revision', 'one', '--output', 'x.json'], [...attach, '--expected-revision', '0'], [...attach, '--expected-revision', '0', '--dry-run', '--output', 'x.json'],
   ['schema', '--kind', 'other'], ['forge', '--input', 'a.json', '--output', 'missing/parent']];
  for (const args of bad) {const r = call(args, 2); assert.equal(r.ok, false); assert.equal(r.code, 'process-operation-failed'); assert(r.errors.length);}
  assert.equal(list(), before, 'rejected invocations write nothing');
  for (const flag of ['--help', '-h']) assert.deepEqual(call([flag]).operations, call(['discover']).operations);
  assert.deepEqual(call(['discover']).editOperations, ((call(['schema', '--kind', 'recipe']).schema.properties.operations.items.oneOf as {properties: {op: {const: string}}}[]).map(o => o.properties.op.const)));
  call(['forge', '--input', 'a.json', '--output', 'forged']); assert(JSON.parse(fs.readFileSync(path.join(dir, 'forged/forge.project.json'), 'utf8')).scenes);
  assert(fs.readFileSync(path.join(dir, 'forged/README.md'), 'utf8').includes(JSON.stringify(path.join(dir, 'forged'))));
  call(['forge', '--input', 'a.json', '--output', 'forged'], 2);
  assert.equal(call(['build', '--input', 'a.json', '--output', 'p.html']).ok, true); assert(fs.readFileSync(path.join(dir, 'p.html'), 'utf8').startsWith('<!'));
  fs.writeFileSync(path.join(dir, 'bad.json'), '{}'); const invalid = call(['validate', '--input', 'bad.json'], 1); assert.equal(invalid.ok, false); assert.equal(invalid.code, undefined);
  fs.symlinkSync('a.json', path.join(dir, 'link.json')); call(['run', '--input', 'a.json', '--minutes', '5', '--output', 'link.json'], 2);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'a.json'), 'utf8')), d);
 } finally {fs.rmSync(dir, {recursive: true, force: true});}
});
test('Diagnostics use step-index pointers, strict ok, draft acceptability and the arrival horizon', () => {
 const dup = base(); dup.steps[1]!.scene.id = dup.steps[0]!.scene.id;
 assert(catalog.validate(dup).diagnostics.some(e => e.path === '/steps/1/scene/id'));
 const orphan = base(); orphan.steps.push({...copy(orphan.steps[1]!), id: 'orphan', scene: {...orphan.steps[1]!.scene, id: 'scene-orphan'}});
 const draft = catalog.validate(orphan, true); assert.equal(draft.ok, false); assert.equal(draft.acceptable, true);
 assert(draft.diagnostics.every(e => /^\/(steps|flows|arrivals|start)(\/\d+)?/.test(e.path)) && draft.diagnostics.some(e => e.path === '/steps/3'));
 assert.equal(catalog.validate(orphan).acceptable, false); assert.equal(catalog.validate(null, true).acceptable, false);
 const late = base(); late.arrivals[0]!.at = runtime.limits.minutes; assert.equal(catalog.validate(late).ok, false);
 late.arrivals[0]!.at = runtime.limits.minutes - 1; assert.equal(catalog.validate(late).ok, true); assert.equal(runtime.limits.receipts, 128);
 for (const op of [{}, {op: 5}, {op: null, value: 1}]) { const d = base(); assert.throws(() => authoring.edit(d, guard(d, [op as never])), /Invalid operation 0/); }
});
const report = {suite: 'business-process', passed: results.filter(r => r.passed).length, total: results.length, results};
fs.writeFileSync(path.join(__dirname, 'process-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`${report.passed}/${report.total} process checks passed`); for (const r of results) if (!r.passed) console.error(r.name, r.error);
if (report.passed !== report.total) process.exitCode = 1;
