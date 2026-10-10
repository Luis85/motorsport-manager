/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-checkpoint.ts" />
/**
 * Hostile and malformed run checkpoints (business-process-checkpoint suite; loaded by test-process-checkpoint.cts). Every case is a
 * file or value a person could hand the studio or the CLI: each one is refused with its plain reason, nothing is evaluated, no
 * prototype changes, accessors are never called, and a controller that refuses one keeps its run.
 */
import assert from 'node:assert/strict';
import {application, test, copy} from './test-process-helpers.cjs';
import {checkpoints, checkpointText, demo} from './test-process-checkpoint-helpers.cjs';
type Box = Record<string, any>;
/** Builds a hostile case from a fresh parse of the base checkpoint text (`change` edits the parsed value; returning text replaces it). */
type Case = [label: string, change: (c: Box, text: string) => string | void, expected: RegExp];
const top: Case[] = [
 ['larger than 16 MiB', () => ' '.repeat(16 * 1024 * 1024 + 1), /larger than 16 MiB/],
 ['not JSON', () => '{"kind": "wildlands-process-checkpoint",', /it is not valid JSON/],
 ['a JSON list', () => '[1, 2, 3]', /it is not a JSON object/],
 ['a __proto__ key', (_, text) => text.replace('{', '{"__proto__": {"polluted": "yes"}, '), /forbidden key __proto__/],
 ['a constructor key in case data', (c) => { c.snapshot.cases[0].data = JSON.parse('{"constructor": {"prototype": {"polluted": 1}}}'); },
  /forbidden key constructor/],
 ['a prototype key', (c) => { c.snapshot.ledger.prototype = 1; }, /forbidden key prototype/],
 ['nesting 40 levels deep', (c) => { c.snapshot.cases[0].data.deep = JSON.parse('['.repeat(40) + ']'.repeat(40)); }, /nested deeper than 24 levels/],
 ['an infinite number', (_, text) => text.replace('"minute":', '"minute":1e400,"ignored":'), /is not a finite number/],
 ['another kind', (c) => { c.kind = 'wildlands-process-report'; }, /its kind must be "wildlands-process-checkpoint"/],
 ['version 2', (c) => { c.version = 2; }, /has version 2; only version 1 can be read/],
 ['an unknown header field', (c) => { c.script = 'alert(1)'; }, /has an unknown field: script/],
 ['no snapshot', (c) => { delete c.snapshot; }, /missing its snapshot field/],
 ['a bad fingerprint', (c) => { c.fingerprint = '<img src=x>'; }, /fingerprint must be 16 hex digits/],
 ['a seed out of range', (c) => { c.seed = 2147483648; }, /seed must be a whole number from 0 to 2147483647/],
 ['a fractional minute', (c) => { c.minute = 1.5; }, /minute must be a whole number/],
 ['a run length before the minute', (c) => { c.runLength = 10; }, /run length must be null or a whole number/],
 ['a header minute the state does not hold', (c) => { c.minute += 1; }, /seed and minute do not match its run state/],
];
const state: Case[] = [
 ['a token at an unknown step', (c) => { c.snapshot.tokens[0].stepId = '__proto__x'; }, /snapshot\.tokens\[0\]\.stepId names no step of this process/],
 ['a token of no active case', (c) => { c.snapshot.tokens[0].caseId = 'case-0000'; }, /snapshot\.tokens\[0\]\.caseId names no active case/],
 ['an unknown token field', (c) => { c.snapshot.tokens[0].onclick = 'x'; }, /snapshot\.tokens\[0\]\.onclick is not a known field/],
 ['running work without time left', (c) => { c.snapshot.tokens.find((t: Box) => t.status === 'active').remaining = 0; },
  /is running work without time left, a start or an input/],
 ['pool units that running work does not hold', (c) => { c.snapshot.pools[0].busy += 1; },
  /snapshot\.pools\[0\]\.busy (does not match the running work|must be)/],
 ['a case the arrival counter never admitted', (c) => { c.snapshot.cases[0].id = 'case-9999'; }, /was never admitted/],
 ['a retirement queue with an extra case', (c) => { c.snapshot.finished.push('case-0999'); }, /must list exactly the retained finished cases/],
 ['clock counts that disagree with the cases', (c) => { c.snapshot.clock.arrived += 1; }, /do not match the clock|counts do not agree/],
 ['an event after the clock minute', (c) => { c.snapshot.events[0].minute = c.minute + 1; }, /snapshot\.events\[0\]\.minute must be a whole number from 0 to/],
 ['an object as a case field', (c) => { c.snapshot.cases[0].data.note = {html: '<b>'}; }, /must be text, a number, true, false or null/],
 ['an over-long case text', (c) => { c.snapshot.cases[0].data.note = 'x'.repeat(257); }, /must be text of at most 256 characters/],
 ['a missing arrival stream', (c) => { c.snapshot.streams.pop(); }, /snapshot\.streams must have \d+ entries/],
 ['a group no token belongs to', (c) => {
  c.snapshot.groups.push({id: 'token-99999999', count: 2, done: 0, started: null, input: null, visit: 1});
 }, /is beyond the token serial counter|hold a group no token belongs to/],
 ['a series sample off its grid', (c) => { c.snapshot.series.data[0] = 5; }, /sample 0 is not on the grid/],
 ['a series at the wrong level', (c) => { c.snapshot.series.level += 1; }, /must hold \d+ samples at level \d+/],
 ['running work without its ledger book', (c) => { c.snapshot.ledger.books = []; }, /has no book for case-\d+, which has running work/],
 ['a negative ledger total', (c) => { c.snapshot.ledger.wipArea = -1; }, /snapshot\.ledger\.wipArea must be a whole number/],
 ['a ledger list of the wrong length', (c) => { c.snapshot.ledger.cycles.push(0); }, /snapshot\.ledger\.cycles must have 17 entries/],
 ['an exact store that miscounts completed cases', (c) => { c.snapshot.ledger.exact.completed += 1; },
  /snapshot\.ledger\.exact\.completed must equal the completed cases of the clock/],
 ['an exact store over its 50,000-case bound', (c) => { c.snapshot.ledger.exact.limit = 50001; },
  /snapshot\.ledger\.exact\.limit must be a whole number from 1 to 50000/],
 ['an exact value the fine bins never counted', (c) => { c.snapshot.ledger.exact.cycle.values.push(7); },
  /snapshot\.ledger\.exact\.cycle\.values do not match the fine bins of the ledger/],
 ['an exact sorted prefix longer than its values', (c) => { c.snapshot.ledger.exact.cycle.ordered = c.snapshot.ledger.exact.cycle.values.length + 1; },
  /snapshot\.ledger\.exact\.cycle\.ordered must be a whole number from 0 to \d+/],
 ['an unknown snapshot field', (c) => { c.snapshot.extra = true; }, /snapshot\.extra is not a known field/],
 ['closed minutes in a process without working hours', (c) => { c.snapshot.ledger.closedBy = c.snapshot.ledger.failedAt.map(() => 0); },
  /snapshot\.ledger\.closedBy is not a known field/],
];
test('Hostile and malformed checkpoint files are refused with a plain reason, never pollute a prototype and leave a controller unchanged', () => {
 const d = demo('agency.process.json'), base = checkpointText(d, 120, {horizon: 6000});
 assert(checkpoints.parse(base).snapshot.tokens.some(t => t.status === 'active'), 'the base run has running work');
 const app = application.create(d);
 app.advance(30);
 const before = JSON.stringify(app.query());
 for (const [label, change, expected] of [...top, ...state]) {
  const value = JSON.parse(base) as Box, replaced = change(value, base), text = typeof replaced === 'string' ? replaced : JSON.stringify(value);
  assert.throws(() => checkpoints.verify(checkpoints.parse(text), d), (e: Error) => expected.test(e.message), label);
  let parsed: unknown = null;
  try { parsed = JSON.parse(text); } catch { /* not JSON: the studio never gets as far as the controller */ }
  if (parsed !== null) assert.throws(() => app.restore(parsed), Error, label + ' (controller)');
  assert.equal(JSON.stringify(app.query()), before, label + ': the controller keeps its run');
 }
 assert.equal(({} as Box).polluted, undefined); assert.equal(Object.prototype.hasOwnProperty.call(Object.prototype, 'polluted'), false);
 assert.equal(checkpoints.verify(checkpoints.parse(base), d).minute, 120, 'the base checkpoint itself is accepted');
 app.dispose();
});
test('Programmatic checkpoints are plain data only: accessors are never called and class instances are refused', () => {
 const d = demo('agency.process.json'), c = JSON.parse(checkpointText(d, 60)) as Box;
 let reads = 0;
 const trap = copy(c);
 Object.defineProperty(trap.snapshot, 'seed', {enumerable: true, get() { reads++; return c.snapshot.seed; }});
 assert.throws(() => checkpoints.verify(trap, d), /checkpoint\.snapshot\.seed is an accessor, not data/);
 assert.equal(reads, 0, 'the getter never ran');
 class Shaped { kind = 'wildlands-process-checkpoint'; }
 assert.throws(() => checkpoints.verify(Object.assign(new Shaped(), c), d), /checkpoint is not plain data/);
 const symbol = copy(c); (symbol as Record<symbol, unknown>)[Symbol('x')] = 1;
 assert.throws(() => checkpoints.verify(symbol, d), /has the forbidden key Symbol\(x\)/);
});
