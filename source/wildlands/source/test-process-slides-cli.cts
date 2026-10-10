/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-slides-contracts.d.ts" />
/// <reference path="./process-draft.ts" />
/** CLI and authoring checks for repeated process work: `process slides`, process-setting edit operations and `process diff`. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {catalog, runtime, authoring, slides, diff} from './process-sdk.cjs';
import {test, base, copy, guard} from './test-process-helpers.cjs';
import {claims} from './test-process-slides.cjs';
require('./process-draft.js');
const draftApi = (globalThis as unknown as {LWProcessDraft: LWProcessDraft.Api}).LWProcessDraft;
const CLI = path.join(__dirname, 'tools/wildlands-cli.cjs'), GOLDEN = path.join(__dirname, 'fixtures/process-slides-small-claims.md');
type Json = Record<string, any>;
/** Runs `process ...` in a fresh directory holding the small-claims fixture as a.json. */
function workspace(work: (call: (args: string[], code?: number) => Json, raw: (args: string[]) => {status: number | null; stdout: string}, dir: string) => void): void {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'process-slides-'));
 try {
  fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify(claims(), null, 2));
  const raw = (args: string[]) => { const p = spawnSync(process.execPath, [CLI, 'process', ...args], {cwd: dir, encoding: 'utf8'}); return {status: p.status, stdout: p.stdout}; };
  const call = (args: string[], code = 0) => { const p = raw(args); assert.equal(p.status, code, args.join(' ') + '\n' + p.stdout); return JSON.parse(p.stdout) as Json; };
  work(call, raw, dir);
 } finally { fs.rmSync(dir, {recursive: true, force: true}); }
}
const spawnJson = (args: string[]) => JSON.parse(spawnSync(process.execPath, [CLI, 'process', ...args], {encoding: 'utf8'}).stdout) as Json;
const read = (dir: string, file: string) => fs.readFileSync(path.join(dir, file), 'utf8');
const seeded = (d: LWProcess.Definition, minutes: number, seed?: number) => { const s = runtime.create(d, seed === undefined ? {} : {seed}); try { return s.advance(minutes); } finally { s.dispose(); } };

test('CLI process slides emits JSON, prints Markdown, writes either file and adds live facts from one seeded bounded run', () => workspace((call, raw, dir) => {
 const d = claims(), deck = slides.build(d), golden = fs.readFileSync(GOLDEN, 'utf8');
 const json = call(['slides', '--input', 'a.json']); assert.equal(json.ok, true); assert.equal(json.format, 'json'); assert.deepEqual(json.deck, deck);
 const md = raw(['slides', '--input', 'a.json', '--format', 'md']); assert.equal(md.status, 0); assert.equal(md.stdout, golden);
 assert.deepEqual(call(['slides', '--input', 'a.json', '--output', 'deck.json']), {ok: true, protocolVersion: 1, output: path.join(dir, 'deck.json'), format: 'json', slides: 18, sections: 6, live: null});
 assert.deepEqual(JSON.parse(read(dir, 'deck.json')), deck);
 assert.equal(call(['slides', '--input', 'a.json', '--format', 'md', '--output', 'deck.md']).slides, 18); assert.equal(read(dir, 'deck.md'), golden);
 const live = call(['slides', '--input', 'a.json', '--minutes', '120', '--seed', '4', '--output', 'live.json']), q = seeded(d, 120, 4);
 assert.deepEqual(live.live, {minute: q.minute, seed: 4, status: q.status}); assert.deepEqual(JSON.parse(read(dir, 'live.json')), slides.build(d, q));
 assert.equal(call(['slides', '--input', 'a.json', '--minutes', '120']).deck.live.seed, 3, 'without --seed the definition seed is used, as in process run');
 const liveMd = raw(['slides', '--input', 'a.json', '--format', 'md', '--minutes', '120', '--seed', '4']).stdout; assert.equal(liveMd, slides.markdown(slides.build(d, q)));
 assert.equal(q.status, 'completed'); assert(liveMd.includes(`Live facts come from one simulated run: business minute ${q.minute}, seed 4, status completed.`));
 const train = path.resolve(__dirname, '../../../docs/concepts/agency-delivery/content/delivery-release.process.json');
 assert.equal(call(['slides', '--input', train]).deck.slides.length, 36);
}));

test('CLI process slides and diff reject bad arguments with exit 2 before writing files', () => workspace((call, _raw, dir) => {
 fs.writeFileSync(path.join(dir, 'bad.json'), '{}'); const before = fs.readdirSync(dir).sort().join();
 const bad: string[][] = [['slides'], ['slides', '--input', 'a.json', '--seed', '4'], ['slides', '--input', 'a.json', '--format', 'html'], ['slides', '--input', 'a.json', '--minutes', '1.5'],
  ['slides', '--input', 'a.json', '--minutes', '-3'], ['slides', '--input', 'a.json', '--minutes', '5', '--seed', '2147483648'], ['slides', '--input', 'a.json', '--bogus', '1'],
  ['slides', '--input', 'a.json', '--format'], ['slides', '--input', 'a.json', '--format', 'md', '--format', 'json'], ['slides', '--input', 'missing.json'], ['slides', '--input', 'bad.json', '--output', 'x.json'],
  ['slides', '--input', 'a.json', '--output', 'a.json'], ['slides', '--input', 'a.json', '--format', 'md', '--output', 'a.json'], ['diff', '--input', 'a.json'], ['diff', '--against', 'a.json'],
  ['diff', '--input', 'a.json', '--against', 'missing.json'], ['diff', '--input', 'a.json', '--against', 'bad.json'], ['diff', '--input', 'a.json', '--against', 'a.json', '--output', 'x.json']];
 for (const args of bad) { const r = call(args, 2); assert.equal(r.ok, false); assert.equal(r.code, 'process-operation-failed'); assert(r.errors.length, args.join(' ')); }
 assert.equal(fs.readdirSync(dir).sort().join(), before, 'rejected invocations write nothing');
 assert.deepEqual(JSON.parse(read(dir, 'a.json')), claims());
 const discovered = call(['discover']);
 assert.deepEqual(discovered.operations.filter((o: Json) => ['slides', 'diff'].includes(o.id)).map((o: Json) => [o.id, o.options]), [['slides', ['--input', '--format', '--minutes', '--seed', '--output']], ['diff', ['--input', '--against']]]);
}));

test('Guarded process-setting edits set and remove description, seed, genre, SIPOC and tracked fields all-or-nothing', () => {
 const d = base(), edit = (input: LWProcess.Definition, operations: unknown[]) => authoring.edit(input, guard(input, operations as LWProcess.Recipe['operations'])).definition;
 const sipoc = {suppliers: [{name: 'Client', supplies: 'Requests'}], customers: [{name: 'Team', receives: 'Results'}]}, track = [{field: 'mood', label: 'Mood'}];
 const set = edit(d, [{op: 'setDescription', value: 'Explained.'}, {op: 'setSeed', value: 9}, {op: 'setGenre', value: 'user-journey'}, {op: 'setSipoc', value: sipoc}, {op: 'setTrack', value: track}]);
 assert.deepEqual([set.revision, set.description, set.seed, set.genre, set.sipoc, set.track], [1, 'Explained.', 9, 'user-journey', sipoc, track]);
 assert.deepEqual(Object.keys(set), ['format', 'schemaVersion', 'revision', 'seed', 'id', 'name', 'description', 'start', 'genre', 'track', 'sipoc', 'resources', 'steps', 'flows', 'arrivals'], 'new fields follow the schema order; existing keys keep theirs');
 const changed = edit(set, [{op: 'setDescription', value: 'Again.'}, {op: 'setSeed', value: 0}, {op: 'setGenre', value: 'customer-journey'}]);
 assert.deepEqual([changed.description, changed.seed, changed.genre, changed.revision], ['Again.', 0, 'customer-journey', 2]);
 const removed = edit(changed, [{op: 'setDescription', value: null}, {op: 'setSeed', value: null}, {op: 'setGenre', value: 'process'}, {op: 'setSipoc', value: null}, {op: 'setTrack', value: null}]);
 assert.deepEqual(removed, {...d, revision: 3}); assert.equal(catalog.fingerprint({...removed, revision: 0}), catalog.fingerprint(d), 'removing every setting restores the untouched fingerprint');
 const invalid: unknown[][] = [[{op: 'setDescription', value: 'x'.repeat(4001)}], [{op: 'setDescription', value: 5}], [{op: 'setSeed', value: -1}], [{op: 'setSeed', value: 1.5}], [{op: 'setSeed', value: '7'}],
  [{op: 'setGenre', value: 'journey'}], [{op: 'setGenre', value: null}], [{op: 'setSipoc', value: {suppliers: [{name: ''}]}}], [{op: 'setSipoc', value: {partners: []}}],
  [{op: 'setSipoc', value: {customers: [{name: 'A'}, {name: 'A'}]}}], [{op: 'setTrack', value: [{field: 'bad name'}]}], [{op: 'setTrack', value: [1, 2, 3, 4, 5, 6, 7].map(i => ({field: 'f' + i}))}],
  [{op: 'setDescription', value: 'Fine.'}, {op: 'setSeed', value: -5}]];
 const frozen = JSON.stringify(d);
 for (const operations of invalid) assert.throws(() => edit(d, operations), Error, JSON.stringify(operations));
 assert.throws(() => edit(d, [{op: 'setSeed'}]), /needs a value/); assert.throws(() => edit(d, [{op: 'setSeed', id: 'x'}]), /Unknown operation field/);
 assert.equal(JSON.stringify(d), frozen, 'rejected edits change nothing');
 const Ajv = require('ajv'); const recipe = new Ajv({strict: false, allowUnionTypes: true}).compile(spawnJson(['schema', '--kind', 'recipe']).schema);
 assert(recipe(guard(d, [{op: 'setDescription', value: null}, {op: 'setSeed', value: 4}, {op: 'setGenre', value: 'process'}, {op: 'setSipoc', value: sipoc}, {op: 'setTrack', value: null}])), JSON.stringify(recipe.errors));
 assert(!recipe(guard(d, [{op: 'setGenre', value: null} as never])));
 assert.deepEqual(spawnJson(['discover']).editOperations.slice(-5), ['setDescription', 'setSeed', 'setSipoc', 'setTrack', 'setGenre']);
 workspace((call, _raw, dir) => {
  const a = claims(); fs.writeFileSync(path.join(dir, 'recipe.json'), JSON.stringify(guard(a, [{op: 'setDescription', value: null}, {op: 'setSeed', value: 11}])));
  const listing = fs.readdirSync(dir).sort().join(), dry = call(['edit', '--input', 'a.json', '--recipe', 'recipe.json', '--dry-run']);
  assert.equal(dry.dryRun, true); assert.equal(dry.definition.seed, 11); assert.equal(dry.definition.description, undefined); assert.equal(fs.readdirSync(dir).sort().join(), listing, 'a dry run writes nothing');
  call(['edit', '--input', 'a.json', '--recipe', 'recipe.json', '--output', 'b.json']); const b = JSON.parse(read(dir, 'b.json')) as LWProcess.Definition;
  assert.deepEqual([b.revision, b.seed, b.description], [2, 11, undefined]);
 });
});

test('CLI process diff reports changed steps, flows, resources, arrivals and settings with both identities; the draft summary is unchanged', () => workspace((call, _raw, dir) => {
 const a = claims(), b = copy(a);
 b.steps.find(s => s.id === 'pay')!.duration = 6; b.steps = b.steps.filter(s => s.id !== 'supervisor'); b.flows = b.flows.filter(f => f.from !== 'supervisor' && f.id !== 'check-late');
 delete b.steps.find(s => s.id === 'check')!.deadline; b.resources[0]!.capacity = 3; b.arrivals[0]!.count = 5; b.description = 'Changed.'; b.seed = 4; b.name = 'Claims desk'; b.revision = 7;
 fs.writeFileSync(path.join(dir, 'b.json'), JSON.stringify(b));
 const report = call(['diff', '--input', 'b.json', '--against', 'a.json']);
 assert.deepEqual(report, {ok: true, protocolVersion: 1, input: {file: 'b.json', id: 'small-claims', revision: 7, fingerprint: catalog.fingerprint(b)}, against: {file: 'a.json', id: 'small-claims', revision: 1, fingerprint: catalog.fingerprint(a)},
  identical: false, revisionChanged: true, summary: 'Changes: 3 steps, 2 flows, 1 resource, 1 arrival rule, 3 process settings changed', changes: {steps: 3, flows: 2, resources: 1, arrivals: 1, settings: 3},
  changedSteps: [{id: 'check', name: 'Check the claim', change: 'changed'}, {id: 'pay', name: 'Pay the claim', change: 'changed'}, {id: 'supervisor', name: 'Supervisor review', change: 'removed'}], changedSettings: ['description', 'name', 'seed']});
 const same = call(['diff', '--input', 'a.json', '--against', 'a.json']);
 assert.deepEqual([same.identical, same.summary, same.changes, same.changedSteps, same.changedSettings], [true, 'Changes: none', {steps: 0, flows: 0, resources: 0, arrivals: 0, settings: 0}, [], []]);
 // Key order is not a change (the fingerprint ignores it too); a revision-only bump is reported as such, never as "formatting only".
 const reordered = copy(a), first = reordered.steps[1]!; reordered.steps[1] = Object.fromEntries(Object.entries(first).reverse()) as typeof first; reordered.revision = 2;
 fs.writeFileSync(path.join(dir, 'c.json'), JSON.stringify(reordered));
 const bumped = call(['diff', '--input', 'c.json', '--against', 'a.json']);
 assert.deepEqual([bumped.identical, bumped.revisionChanged, bumped.summary, bumped.changes, bumped.changedSteps, bumped.changedSettings], [false, true, 'Changes: revision only (1 to 2)', {steps: 0, flows: 0, resources: 0, arrivals: 0, settings: 0}, [], []]);
 reordered.revision = 1; fs.writeFileSync(path.join(dir, 'c.json'), JSON.stringify(reordered));
 const sorted = call(['diff', '--input', 'c.json', '--against', 'a.json']);
 assert.deepEqual([sorted.identical, sorted.revisionChanged, sorted.summary, sorted.changedSteps], [true, false, 'Changes: none', []]);
 const store = draftApi.create(); store.enter(0, a); store.write(JSON.stringify(b, null, 2), 'test');
 assert.deepEqual(store.diff(), diff.compare(a, b)); assert.equal(store.describeDiff(), 'Unapplied draft: 3 steps, 2 flows, 1 resource, 1 arrival rule, 3 process settings changed');
 assert.deepEqual(store.diff({ignoreStep: 'pay'}), {steps: 2, flows: 2, resources: 1, arrivals: 1, meta: 3, invalid: false, changedSteps: [{id: 'check', name: 'Check the claim', change: 'changed'}, {id: 'supervisor', name: 'Supervisor review', change: 'removed'}]});
 store.write('{', 'test'); assert.equal(store.describeDiff(), 'Unapplied draft: not valid process JSON yet'); assert.equal(draftApi.describe(diff.empty(false), 'Draft'), 'Draft: formatting only');
}));
