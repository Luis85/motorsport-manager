/// <reference path="./process-contracts.d.ts" />
/** Interchange, admission and authoring surfaces: BPMN in/out, validation, guarded edits, application sessions, schema and the process CLI. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import {catalog, runtime, authoring, bpmn} from './process-sdk.cjs';
import {application, test, base, copy, agency, guard, run} from './test-process-helpers.cjs';

const M = 'xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"';
const foreign = (body: string, extra = '') => `<?xml version="1.0"?><bpmn:definitions ${M} id="Definitions_1">${extra}<bpmn:process id="Process_Order.1" name="Order handling">${body}</bpmn:process></bpmn:definitions>`;
const flow = (id: string, from: string, to: string, inner = '') => `<bpmn:sequenceFlow id="${id}" sourceRef="${from}" targetRef="${to}">${inner}</bpmn:sequenceFlow>`;
test('BPMN export is well-formed, standards-shaped and imports back losslessly', () => {
 const xml = bpmn.export(agency), again = bpmn.import(xml);
 assert(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')); assert.match(xml, /<bpmn:definitions [^>]*xmlns:bpmn="http:\/\/www\.omg\.org\/spec\/BPMN\/20100524\/MODEL"/);
 for (const tag of ['startEvent', 'endEvent', 'task', 'exclusiveGateway', 'parallelGateway', 'sequenceFlow', 'performer', 'resource', 'BPMNShape', 'BPMNEdge', 'conditionExpression']) assert(xml.includes('<' + (/^BPMN/.test(tag) ? 'bpmndi:' : tag === 'conditionExpression' || tag === 'resource' || tag === 'performer' ? 'bpmn:' : 'bpmn:') + tag), tag);
 assert.deepEqual(again.warnings, []); assert.equal(again.ok, true); assert.deepEqual(again.definition, agency); assert.equal(catalog.fingerprint(again.definition), catalog.fingerprint(agency));
 assert.equal(bpmn.export(again.definition), xml);
 const ids = [...xml.matchAll(/<(?:bpmn|bpmndi):\w+[^>]*?\sid="([^"]+)"/g)].map(m => m[1]); assert.equal(new Set(ids).size, ids.length, 'BPMN ids must be unique');
 const refs = [...xml.matchAll(/(?:sourceRef|targetRef|bpmnElement)="([^"]+)"/g)].map(m => m[1]!); assert(refs.every(r => ids.includes(r)), 'every reference resolves');
 const withAsset = copy(agency); assert(withAsset.steps.some(st => st.scene.asset)); assert.deepEqual(bpmn.import(bpmn.export(withAsset)).definition!.steps.map(st => st.scene.asset), withAsset.steps.map(st => st.scene.asset));
});
test('Foreign BPMN imports with defaults, folded merges, parsed conditions, inferred joins and diagram layout', () => {
 const xml = foreign(`<bpmn:startEvent id="Start_1" name="Request"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
  <bpmn:exclusiveGateway id="Merge_1"/><bpmn:userTask id="Review" name="Review request"><bpmn:performer><bpmn:resourceRef>Res_Clerk</bpmn:resourceRef></bpmn:performer></bpmn:userTask>
  <bpmn:exclusiveGateway id="Valid" name="Valid?" default="F_fix"/><bpmn:serviceTask id="Fix" name="Fix data"/><bpmn:parallelGateway id="Split"/><bpmn:task id="Pack" name="Pack"/><bpmn:task id="Bill" name="Bill"/>
  <bpmn:parallelGateway id="Sync"/><bpmn:endEvent id="Done" name="Done"/><bpmn:laneSet id="Lanes"/>
  ${flow('F1', 'Start_1', 'Merge_1')}${flow('F2', 'Merge_1', 'Review')}${flow('F3', 'Review', 'Valid')}
  ${flow('F_ok', 'Valid', 'Split', '<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">${approved == true}</bpmn:conditionExpression>')}${flow('F_fix', 'Valid', 'Fix')}${flow('F_back', 'Fix', 'Merge_1')}
  ${flow('P1', 'Split', 'Pack')}${flow('P2', 'Split', 'Bill')}${flow('P3', 'Pack', 'Sync')}${flow('P4', 'Bill', 'Sync')}${flow('F9', 'Sync', 'Done')}`,
  '<bpmn:resource id="Res_Clerk" name="Clerk"/>');
 const r = bpmn.import(xml); assert(r.acceptable, JSON.stringify(r.diagnostics)); const d = r.definition!;
 assert.equal(d.id, 'process-order-1'); assert.equal(d.name, 'Order handling'); assert.equal(d.start, 'start-1');
 assert.deepEqual(d.steps.map(s => [s.id, s.kind]), [['start-1', 'start'], ['review', 'task'], ['valid', 'decision'], ['fix', 'system'], ['split', 'fork'], ['pack', 'task'], ['bill', 'task'], ['sync', 'join'], ['done', 'end']]);
 assert.deepEqual(d.steps.find(s => s.id === 'fix')!.resources, {automation: 1}); assert.deepEqual(d.resources.find(x => x.id === 'automation'), {id: 'automation', name: 'Automation', capacity: 4, costPerMinute: 1, kind: 'system'});
 assert.equal(d.steps.find(s => s.id === 'split')!.join, 'sync'); assert.deepEqual(d.steps.find(s => s.id === 'review')!.resources, {'res-clerk': 1}); assert.equal(d.steps.find(s => s.id === 'fix')!.duration, 5);
 assert.deepEqual(d.flows.find(f => f.id === 'f-ok')!.when, {field: 'approved', op: 'eq', value: true}); assert.equal(d.flows.find(f => f.id === 'f-fix')!.when, undefined);
 assert.equal(d.flows.find(f => f.id === 'f-back')!.to, 'review'); assert(!d.steps.some(s => s.id === 'merge-1'));
 assert(r.warnings.some(w => /folded/.test(w))); assert(r.warnings.some(w => /no duration/.test(w))); assert(r.warnings.some(w => /serviceTask/.test(w))); assert(r.warnings.some(w => /arrivals/.test(w)));
 assert.equal(d.arrivals.length, 1); const ok = catalog.validate(d); assert(!ok.diagnostics.length || r.ok === false);
 const shaped = xml.replace('</bpmn:process>', '</bpmn:process><bpmndi:BPMNDiagram id="D"><bpmndi:BPMNPlane id="P" bpmnElement="Process_Order.1">' + ['Start_1', 'Review', 'Valid', 'Fix', 'Split', 'Pack', 'Bill', 'Sync', 'Done'].map((id, i) => `<bpmndi:BPMNShape id="${id}_di" bpmnElement="${id}"><dc:Bounds x="${100 + i * 150}" y="${100 + i % 2 * 100}" width="100" height="80"/></bpmndi:BPMNShape>`).join('') + '</bpmndi:BPMNPlane></bpmndi:BPMNDiagram>');
 const laid = bpmn.import(shaped).definition!; assert.deepEqual(laid.steps.map(s => s.scene.position), [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => [i * 15, i % 2 * 10]));
});
test('BPMN import rejects unsupported behaviour, hostile XML and unreadable conditions explicitly', () => {
 const start = '<bpmn:startEvent id="S"><bpmn:outgoing>A</bpmn:outgoing></bpmn:startEvent><bpmn:endEvent id="E"/>';
 assert.throws(() => bpmn.import(foreign(start + '<bpmn:subProcess id="Sub"/><bpmn:boundaryEvent id="B" attachedToRef="Sub"/>' + flow('A', 'S', 'E'))), /subProcess Sub is not supported[\s\S]*boundaryEvent B/);
 assert.throws(() => bpmn.import(foreign(start + '<bpmn:inclusiveGateway id="I"/>' + flow('A', 'S', 'E'))), /inclusiveGateway I/);
 assert.throws(() => bpmn.import('<!DOCTYPE x [<!ENTITY a "b">]><x/>'), /DOCTYPE/); assert.throws(() => bpmn.import('<bpmn:definitions'), /Unterminated|Undeclared|incomplete/);
 assert.throws(() => bpmn.import(`<a xmlns="x">&bogus;</a>`), /entities|Expected a BPMN/); assert.throws(() => bpmn.import('<a xmlns="x"/>'), /Expected a BPMN 2.0/);
 assert.throws(() => bpmn.import(foreign(start + '<bpmn:exclusiveGateway id="G"/><bpmn:endEvent id="E2"/>' + flow('A', 'S', 'G') + flow('B', 'G', 'E', '<bpmn:conditionExpression>x.y(1)</bpmn:conditionExpression>') + flow('C', 'G', 'E2'))), /unsupported condition/);
 assert.throws(() => bpmn.import(foreign('<bpmn:startEvent id="S"/><bpmn:startEvent id="S2"/>')), /start/);
 assert.throws(() => bpmn.import(foreign(start + '<bpmn:task id="T"/>' + flow('A', 'S', 'T') + flow('B', 'T', 'E') + flow('C', 'T', 'E'))), /outgoing flows/);
 assert.throws(() => bpmn.import(foreign('') + foreign('')), /Multiple root|Text outside/);
 const two = '<bpmn:definitions ' + M + '>' + '<bpmn:process id="A"/><bpmn:process id="B"/></bpmn:definitions>';
 assert.throws(() => bpmn.import(two), /Exactly one start event is required/); assert.throws(() => bpmn.import(two, {process: 'C'}), /Process "C" was not found/);
 // The rejection concerns the chosen process only: A is selected (the first) and B is reported as not imported, never merged.
 const chosen = bpmn.analyze(two); assert.equal(chosen.info.process!.id, 'A'); assert(chosen.warnings.some(w => /Not imported: "B"/.test(w)), JSON.stringify(chosen.warnings));
 const other = bpmn.analyze(two, {process: 'B'}); assert.equal(other.info.process!.id, 'B'); assert(other.warnings.some(w => /Not imported: "A"/.test(w)));
 assert(bpmn.analyze(two).warnings.some(w => /has 2 processes; "A" was imported/.test(w)));
 const draft = bpmn.import(foreign('<bpmn:startEvent id="S"><bpmn:outgoing>A</bpmn:outgoing></bpmn:startEvent><bpmn:task id="T"/>' + flow('A', 'S', 'T'))); assert.equal(draft.ok, false); assert(draft.acceptable);
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
 for (const mutate of [(d: LWProcess.Definition) => {d.steps.find(s => s.id === 'architecture')!.set = {requirementsReady: true};},
  (d: LWProcess.Definition) => {d.flows.find(f => f.id === 'design-split-architecture')!.to = 'product-design';},
  (d: LWProcess.Definition) => {const s = d.steps.find(s => s.id === 'product-design')!; s.kind = 'decision'; delete s.duration; delete s.resources; delete s.set;}]) {
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
 app.select('product-design'); app.mode('2d'); app.select('qa'); app.mode('3d'); assert.deepEqual(app.query().snapshot, q);
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
  assert(call(['schema', '--kind', 'recipe']).schema); assert.equal(call(['discover']).operations.length, 12);
  call(['export-bpmn', '--input', 'b.json', '--output', 'b.bpmn']); call(['export-bpmn', '--input', 'b.json', '--output', 'b.txt'], 2); call(['export-bpmn', '--input', 'b.json', '--output', 'b.bpmn'], 0);
  const imported = call(['import-bpmn', '--input', 'b.bpmn', '--output', 'c.json']); assert.equal(imported.runnable, true); assert.deepEqual(imported.warnings, []);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'c.json'), 'utf8')), JSON.parse(fs.readFileSync(path.join(dir, 'b.json'), 'utf8')));
  fs.writeFileSync(path.join(dir, 'bad.bpmn'), '<?xml version="1.0"?><!DOCTYPE x><x/>'); call(['import-bpmn', '--input', 'bad.bpmn', '--output', 'd.json'], 2); assert(!fs.existsSync(path.join(dir, 'd.json')));
  call(['import-bpmn', '--input', 'b.bpmn', '--output', 'b.bpmn'], 2);
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
