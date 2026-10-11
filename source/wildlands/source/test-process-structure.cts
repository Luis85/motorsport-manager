/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-structure.ts" />
/// <reference path="./process-layout.ts" />
/** Structural step editing (LWProcessStructure) and map placement (LWProcessLayout): pure draft operations of the studio editors. */
import assert from 'node:assert/strict';
import {catalog} from './process-sdk.cjs';
import {test, base, copy, agency} from './test-process-helpers.cjs';
require('./process-structure.js');
require('./process-layout.js');
const root = globalThis as unknown as {LWProcessStructure: LWProcessStructure.Api; LWProcessLayout: LWProcessLayout.Api};
const structure = root.LWProcessStructure, layout = root.LWProcessLayout;
const done = (r: LWProcessStructure.Result): LWProcessStructure.Done => {
 assert.equal(r.ok, true, r.ok ? '' : r.reason);
 return r as LWProcessStructure.Done;
};
const stepIn = (d: LWProcess.Definition, id: string) => d.steps.find(s => s.id === id)!;
const withPools = () => {
 const d = copy(agency);
 d.resources.push({id: 'robot', name: 'Robot', capacity: 2, costPerMinute: 1, kind: 'machine'});
 return d;
};

test('Structure adds a step of every kind with a unique id, scene, colour by kind, free grid cell and minimal fields', () => {
 const d = withPools(), colors: Record<string, string> = {task: '#ffbb73', touchpoint: '#ffbb73', machine: '#77b5a0', system: '#77b5a0',
  timer: '#91b9d5', decision: '#d6a2ce', fork: '#91b9d5', join: '#91b9d5', end: '#77b5a0'};
 assert.deepEqual(structure.KINDS.map(([k]) => k), ['task', 'machine', 'system', 'touchpoint', 'timer', 'decision', 'fork', 'join', 'end']);
 for (const [kind] of structure.KINDS) {
  const r = done(structure.add(d, {kind, name: 'Review it!', after: 'discovery'})), step = stepIn(r.definition, 'review-it');
  assert.equal(step.kind, kind);
  assert.equal(step.name, 'Review it!');
  assert.equal(step.scene.id, 'scene-review-it');
  assert.equal(step.scene.color, colors[kind], kind);
  assert.equal(r.label, 'Added step Review it!');
  assert.equal(r.stepId, 'review-it');
  assert.equal(r.definition.revision, d.revision, 'the draft keeps its revision; applying assigns the next one');
  assert.deepEqual(r.definition.steps.map(s => s.id).indexOf('review-it'), 2, 'placed after discovery in draft order');
  // discovery sits at [14, 0] and design-split at [28, 0], so the cell to the right is taken: the next free row is y + 10.
  assert.deepEqual(step.scene.position, [28, 10], kind);
  if (kind === 'task' || kind === 'touchpoint')
  assert.equal(step.duration, 5);
  if (kind === 'timer')
  assert.equal(step.duration, 60);
  if (kind === 'machine')
  assert.deepEqual([step.duration, step.resources], [5, {robot: 1}]);
  if (kind === 'fork')
  assert.equal(step.join, undefined, 'every join already belongs to a fork');
  assert(r.diagnostics.length > 0, 'an unconnected step is reported, not refused');
 }
 const system = done(structure.add(d, {kind: 'system', name: 'Ledger'}));
 assert.equal(stepIn(system.definition, 'ledger').resources, undefined);
 assert(system.notes.some(n => /no system pool/.test(n)), system.notes.join('\n'));
 assert(system.diagnostics.some(x => /must demand at least one system pool/.test(x.message)));
 // Without `after` the step goes right of the rightmost step and to the end of the draft order.
 assert.deepEqual(stepIn(system.definition, 'ledger').scene.position, [70, 0]);
 assert.equal(system.definition.steps.at(-1)!.id, 'ledger');
 // Ids are slugs, numbered when taken; a blank name reads "New <kind>"; a name that starts with a digit gets a letter first.
 const twice = done(structure.add(done(structure.add(d, {kind: 'task', name: 'QA'})).definition, {kind: 'task', name: 'QA'}));
 assert.deepEqual(twice.definition.steps.filter(s => s.name === 'QA').map(s => s.id), ['qa-2', 'qa-3']);
 assert.equal(stepIn(done(structure.add(d, {kind: 'timer', name: '  '})).definition, 'new-timer').name, 'New timer');
 assert.equal(structure.newId(d, '2nd check'), 'step-2nd-check');
 assert.equal(structure.newId(d, 'Ünïcode — name'), 'unicode-name');
 assert.equal(structure.colorOf('end', 'lost'), '#d9777f');
 const fork = done(structure.add(done(structure.add(d, {kind: 'join', name: 'Sync'})).definition, {kind: 'fork', name: 'Split'}));
 assert.equal(stepIn(fork.definition, 'split').join, 'sync', 'a new fork names the join no fork owns');
});

test('Structure inserts a new step into the single outgoing path of the step it follows', () => {
 const d = copy(agency);
 assert.deepEqual(structure.insertable(d, 'discovery'), {flow: 'discovery-design-split', to: 'design-split', toName: 'Plan together'});
 assert.equal(structure.insertable(d, 'review-gate'), null, 'a decision has two paths');
 assert.equal(structure.insertable(d, 'delivered'), null);
 const r = done(structure.add(d, {kind: 'task', name: 'Estimate', after: 'discovery', insert: true}));
 assert.deepEqual(r.definition.flows.filter(f => f.from === 'discovery' || f.from === 'estimate').map(f => [f.id, f.from, f.to]),
  [['discovery-design-split', 'discovery', 'estimate'], ['estimate-design-split', 'estimate', 'design-split']]);
 assert.deepEqual(r.diagnostics, [], 'an inserted task keeps the process valid');
 assert(catalog.validate(r.definition).ok);
 assert(r.notes.includes('Inserted Estimate between Discovery and Plan together.'), r.notes.join('\n'));
 // Without insert the paths stay as they were and the note says the step is not connected.
 const loose = done(structure.add(d, {kind: 'task', name: 'Estimate', after: 'discovery'}));
 assert.deepEqual(loose.definition.flows, d.flows);
 assert(loose.notes.some(n => /not connected yet/.test(n)));
 // A sample process from authoring.create: start → work → end; inserting an end step is never offered as an insert.
 const sample = base(), end = done(structure.add(sample, {kind: 'end', name: 'Lost', after: 'work', insert: true}));
 assert.deepEqual(end.definition.flows, sample.flows);
});

test('Structure duplicates a step without its paths under a numbered copy id and offset position', () => {
 const d = copy(agency), r = done(structure.duplicate(d, 'discovery')), dup = stepIn(r.definition, 'discovery-copy'), source = stepIn(d, 'discovery');
 assert.equal(dup.name, 'Discovery (copy)');
 assert.equal(dup.scene.id, 'scene-discovery-copy');
 assert.equal(r.label, 'Duplicated Discovery');
 assert.deepEqual({...dup, id: source.id, name: source.name, scene: source.scene}, source, 'every field is copied');
 assert.deepEqual(dup.scene.position, [14, 10]);
 assert.equal(r.definition.steps[2]!.id, 'discovery-copy');
 assert.deepEqual(r.definition.flows, d.flows, 'paths are not copied');
 assert.equal(r.stepId, 'discovery-copy');
 const again = done(structure.duplicate(r.definition, 'discovery'));
 assert(again.definition.steps.some(s => s.id === 'discovery-copy-2'));
 assert.deepEqual(stepIn(again.definition, 'discovery-copy-2').scene.position, [14, 30], 'the next free row: 20 is next to Client handover');
 assert.deepEqual(structure.duplicate(d, 'intake'), {ok: false, reason: 'A process has exactly one start step, so it cannot be duplicated.'});
 const fork = done(structure.duplicate(d, 'design-split'));
 assert.equal(stepIn(fork.definition, 'design-split-copy').join, undefined, 'a join belongs to exactly one fork');
});

test('Structure deletes a step with its paths, reconnects predecessors to the single target and refuses the start step', () => {
 const d = copy(agency), plan = structure.removal(d, 'qa');
 assert.deepEqual(plan.incoming.map(f => f.fromName), ['Implementation', 'Resolve findings']);
 assert.deepEqual(plan.outgoing.map(f => f.toName), ['Accepted?']);
 assert.deepEqual(plan.reconnect, {to: 'review-gate', toName: 'Accepted?', from: ['Implementation', 'Resolve findings']});
 assert.equal(plan.blocked, '');
 const joined = done(structure.remove(d, 'qa', {reconnect: true}));
 assert.equal(joined.label, 'Deleted step Quality review');
 assert.equal(joined.stepId, '');
 assert(!joined.definition.steps.some(s => s.id === 'qa'));
 const into = joined.definition.flows.filter(f => f.to === 'review-gate').map(f => [f.id, f.from]);
 assert.deepEqual(into, [['implementation-qa', 'implementation'], ['rework-qa', 'rework']]);
 assert.deepEqual(joined.diagnostics.map(x => x.code), ['needs'], 'the reconnected paths are valid; only the field QA delivered is missing');
 assert.deepEqual(joined.notes, ['Reconnected Implementation, Resolve findings to Accepted?.']);
 // A kept incoming path keeps its label and condition.
 const labelled = copy(d);
 labelled.flows.find(f => f.id === 'review-gate-rework')!.label = 'Fix it';
 const rework = done(structure.remove(labelled, 'rework', {reconnect: true})), kept = rework.definition.flows.find(f => f.id === 'review-gate-rework')!;
 assert.deepEqual([kept.to, kept.label, kept.when], ['qa', 'Fix it', labelled.flows.find(f => f.id === 'review-gate-rework')!.when]);
 const cut = done(structure.remove(d, 'qa'));
 assert(!cut.definition.flows.some(f => f.from === 'qa' || f.to === 'qa'));
 assert.deepEqual(cut.notes, ['Removed 3 paths: from Implementation, from Resolve findings, to Accepted?.']);
 assert(cut.diagnostics.length > 0, 'the disconnected draft is reported');
 assert.equal(structure.removal(d, 'review-gate').reconnect, null, 'a decision has two targets');
 assert.equal(structure.removal(d, 'intake').blocked, 'The start step cannot be deleted: every process needs one. Delete or change the other steps instead.');
 assert.deepEqual(structure.remove(d, 'intake'), {ok: false, reason: structure.removal(d, 'intake').blocked});
});

test('Structure changes a step kind, keeps valid fields and lists the dropped fields in plain words', () => {
 const d = withPools(), task = stepIn(d, 'discovery');
 assert(task.resources && task.set, 'the fixture task demands people and sets fields');
 assert.deepEqual(structure.drops(d, 'discovery', 'timer'), ['resource demands', 'fixed cost']);
 const timer = done(structure.changeKind(d, 'discovery', 'timer')), t = stepIn(timer.definition, 'discovery');
 assert.equal(t.kind, 'timer');
 assert.equal(t.duration, task.duration);
 assert.deepEqual(t.set, task.set);
 assert.equal(t.resources, undefined);
 assert.equal(t.scene.color, '#91b9d5', 'a default colour follows the kind');
 assert.equal(timer.label, 'Changed Discovery to a timer');
 assert.equal(timer.notes[0], 'Dropped resource demands, fixed cost.');
 const machine = done(structure.changeKind(d, 'discovery', 'machine')), m = stepIn(machine.definition, 'discovery');
 assert.deepEqual(m.resources, {robot: 1}, 'people pools are dropped and the first machine pool is used');
 assert(machine.notes[0]!.startsWith('Dropped the demand for Product owner'), machine.notes.join('\n'));
 const decision = done(structure.changeKind(d, 'qa', 'decision')), q = stepIn(decision.definition, 'qa');
 assert.deepEqual(Object.keys(q), ['id', 'name', 'kind', 'phase', 'scene', 'description', 'needs'], 'key order is kept');
 assert.deepEqual(decision.notes[0], 'Dropped duration, resource demands, set values.');
 const gate = done(structure.changeKind(d, 'review-gate', 'task'));
 assert.deepEqual(structure.drops(d, 'review-gate', 'task'), ['the conditions on its paths']);
 assert(!gate.definition.flows.some(f => f.from === 'review-gate' && f.when));
 assert.equal(stepIn(gate.definition, 'review-gate').duration, 5);
 assert.deepEqual(structure.changeKind(d, 'intake', 'task'), {ok: false, reason: 'The start step keeps its kind: every process needs exactly one start step.'});
 assert.deepEqual(structure.changeKind(d, 'qa', 'task'), {ok: false, reason: 'Quality review is already a task.'});
 // A deadline path loses its marker when the step stops being work.
 const late = copy(d);
 stepIn(late, 'qa').deadline = {after: 9, mode: 'escalate', flow: 'qa-late'};
 late.flows.push({id: 'qa-late', from: 'qa', to: 'delivered', on: 'deadline'});
 const waited = done(structure.changeKind(late, 'qa', 'join'));
 assert.equal(waited.definition.flows.find(f => f.id === 'qa-late')!.on, undefined);
 assert(structure.drops(late, 'qa', 'join').includes('deadline'));
 // setStart names a start step; other kinds are refused.
 assert.deepEqual(structure.setStart(d, 'qa'), {ok: false, reason: 'Only a start step can be the start of the process.'});
 const moved = copy(d);
 moved.start = 'nowhere';
 assert.equal(done(structure.setStart(moved, 'intake')).definition.start, 'intake');
});

const chain = (n: number): LWProcess.Definition => {
 const steps: LWProcess.Step[] = Array.from({length: n}, (_, i) => ({id: `s${i}`, name: `Step ${i}`, kind: i === 0 ? 'start' : i === n - 1 ? 'end' : 'task',
  ...i > 0 && i < n - 1 ? {duration: 5} : {}, scene: {id: `scene-${i}`, position: [(i * 37) % 90, (i * 13) % 40], color: '#ffbb73'}}));
 const flows = steps.slice(1).map((s, i) => ({id: `f${i}`, from: steps[i]!.id, to: s.id}));
 return {...copy(base()), id: 'chain', steps, flows};
};
test('Layout tidy is deterministic, one step per cell, left to right along the main route, with loops, forks and deadline branches below', () => {
 const d = copy(agency), placed = layout.positions(d), again = layout.positions(copy(d));
 assert.deepEqual(placed, again);
 const cells = Object.values(placed).map(p => p.join(','));
 assert.equal(new Set(cells).size, cells.length, 'no two steps share a cell');
 assert(Object.values(placed).every(([x, y]) => x * 2 === Math.round(x * 2) && y * 2 === Math.round(y * 2) && x % 14 === 0));
 const x = (id: string) => placed[id]![0], y = (id: string) => placed[id]![1];
 for (const [from, to] of [['intake', 'discovery'], ['discovery', 'design-split'], ['design-split', 'product-design'], ['design-ready', 'implementation'],
  ['implementation', 'qa'], ['qa', 'review-gate'], ['review-gate', 'handover'], ['handover', 'delivered']])
  assert(x(from!) < x(to!), from + ' before ' + to);
 assert.equal(x('product-design'), x('architecture'), 'fork branches share a layer');
 assert.notEqual(y('product-design'), y('architecture'));
 assert.equal(x('rework'), x('review-gate') + 14, 'the loop back edge rework → qa is ignored');
 assert.equal(y('intake'), 0);
 const tidied = layout.tidy(d);
 assert(tidied.moved > 0);
 assert.deepEqual(layout.tidy(tidied.definition).moved, 0, 'tidying twice moves nothing');
 assert.deepEqual(tidied.definition.flows, d.flows);
 assert(catalog.validate(tidied.definition).ok);
 // An escalation branch sits below every main row.
 const late = copy(d);
 stepIn(late, 'qa').deadline = {after: 9, mode: 'escalate', flow: 'qa-late'};
 late.steps.push({id: 'escalated', name: 'Escalated', kind: 'end', scene: {id: 'scene-escalated', position: [0, 0], color: '#d9777f'}});
 late.flows.push({id: 'qa-late', from: 'qa', to: 'escalated', on: 'deadline'});
 const branch = layout.positions(late), lowest = Math.max(...Object.entries(branch).filter(([id]) => id !== 'escalated').map(([, p]) => p[1]));
 assert(branch.escalated![1] > lowest, 'the deadline branch is below the main route');
 assert.equal(branch.escalated![0], branch.qa![0] + 14);
});
test('Layout lays out a 128-step process in bounded time and move rounds a dragged step to 0.5 within the bounds', () => {
 const big = chain(128), began = process.hrtime.bigint(), placed = layout.positions(big), ms = Number(process.hrtime.bigint() - began) / 1e6;
 assert(ms < 500, `128 steps laid out in ${ms} ms`);
 assert.deepEqual(placed.s127, [127 * 14, 0]);
 const moved = layout.move(agency, 'qa', [12.26, -3.74])!;
 assert.deepEqual(stepIn(moved, 'qa').scene.position, [12.5, -3.5]);
 assert.deepEqual(stepIn(agency, 'qa').scene.position, [42, 24], 'the input is untouched');
 assert.deepEqual(stepIn(layout.move(agency, 'qa', [20000, -20000])!, 'qa').scene.position, [10000, -10000]);
 assert.equal(layout.move(agency, 'missing', [0, 0]), undefined);
 assert.equal(layout.move(agency, 'qa', [NaN, 0]), undefined);
 assert.deepEqual(layout.GRID, {x: 14, y: 10});
});
