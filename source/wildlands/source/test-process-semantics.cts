/// <reference path="./process-contracts.d.ts" />
/** BPMN-class simulation semantics: normal and Erlang timing, condition combinators, inclusive forks, multi-instance steps and boundary deadlines. */
import assert from 'node:assert/strict';
import {catalog, runtime} from './process-sdk.cjs';
import {test, copy} from './test-process-helpers.cjs';
// Shared fixtures for the BPMN-class simulation semantics checks.
import {S, F, C, ONE, W, pool, cases, sim, invalid, M, stepM, events, rng, graph, inclusive, items, guarded} from './test-process-semantics-fixtures.cjs';

test('Normal and Erlang distributions are deterministic, bounded and independent of advance chunking', () => {
 const draws = (seed: number, dist: LWProcess.Dist, n = 4000) => Array.from({length: n}, (_, i) => rng.sample(seed, 't|' + i, dist));
 const stats = (xs: number[]) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return {sum: xs.reduce((a, b) => a + b, 0), sd: Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length)}; };
 const normal: LWProcess.Dist = {dist: 'normal', mean: 30, sd: 5}, erlang: LWProcess.Dist = {dist: 'erlang', k: 4, mean: 30};
 assert.deepEqual(draws(7, normal, 8), [35, 33, 31, 29, 28, 27, 37, 26]); assert.deepEqual(draws(7, erlang, 8), [48, 6, 25, 12, 12, 19, 38, 25]); assert.deepEqual(draws(8, normal, 8), [39, 27, 28, 31, 24, 31, 37, 32]);
 { const [n, e, c] = [stats(draws(7, normal)), stats(draws(7, erlang)), stats(draws(7, {dist: 'normal', mean: 30, sd: 5, min: 25, max: 33}))]; assert.deepEqual([n.sum, e.sum, c.sum], [119176, 121357, 117826]); assert(n.sd > 4.9 && n.sd < 5.2 && e.sd > 14.7 && e.sd < 15.3 && c.sd > 3 && c.sd < 3.2); }
 const xs = draws(7, {dist: 'normal', mean: 30, sd: 5, min: 25, max: 33}); assert.deepEqual([Math.min(...xs), Math.max(...xs)], [25, 33]);
 const wide = draws(7, {dist: 'normal', mean: 10, sd: 50}); assert.deepEqual([Math.min(...wide), Math.max(...wide)], [1, 170]);
 assert.deepEqual(draws(7, {dist: 'normal', mean: 100000, sd: 100000}, 50).every(v => v >= 1 && v <= 100000), true);
 assert.deepEqual(draws(7, {dist: 'erlang', k: 32, mean: 100000}, 50).every(v => v >= 1 && v <= 100000), true);
 assert.deepEqual(JSON.stringify(draws(7, normal, 50)) === JSON.stringify(draws(7, normal, 50)), true);
 const d = W([S('start', 'start'), S('work', 'task', {duration: 20, timing: {dist: 'normal', mean: 20, sd: 4}, resources: {staff: 1}}), S('wait', 'timer', {duration: 10, timing: {dist: 'erlang', k: 3, mean: 10}}), S('end', 'end')],
  [F('a', 'start', 'work'), F('b', 'work', 'wait'), F('c', 'wait', 'end')], [{at: 0, open: true, interval: 6, gap: {dist: 'erlang', k: 2, mean: 6}, data: {}}], [pool('staff', 3)], 11);
 const whole = JSON.stringify(sim(d, 600, [600], {horizon: null}));
 for (const chunks of [[1], [7, 33, 250]]) assert.equal(JSON.stringify(sim(d, 600, chunks, {horizon: null})), whole);
 assert.notEqual(JSON.stringify(sim(d, 600, [600], {horizon: null, seed: 12})), whole);
 const q = JSON.parse(whole) as LWProcess.Snapshot; assert.deepEqual([M(q), q.receipts.filter(r => r.stepId === 'work').map(r => r.duration).slice(0, 12), q.receipts.filter(r => r.stepId === 'wait').map(r => r.duration).slice(0, 12)], [{minute: 600, arrived: 99, completed: 89, failed: 0, cost: 1774}, [23, 20, 24, 19, 22, 18, 26, 14, 18, 9, 17, 17], [5, 6, 9, 6, 7, 8, 3, 14, 5, 2, 7, 14]]);
 assert.deepEqual(q.receipts.filter(r => r.stepId === 'work').every(r => r.duration! >= 1 && r.duration! <= 44), true);
});

test('Condition combinators all, any and not route cases exactly and validate strictly', () => {
 const routes = [C({all: [{field: 'region', op: 'eq', value: 'eu'}, {field: 'score', op: 'gte', value: 50}]}), C({any: [{field: 'vip', op: 'eq', value: true}, {not: {field: 'region', op: 'eq', value: 'eu'}}]}), C({not: {field: 'score', op: 'lt', value: 10}}), undefined];
 const decide = (arrivals: LWProcess.Arrival[], when: (LWProcess.Condition | undefined)[] = routes, extra: Partial<LWProcess.Step>[] = []) => W([S('start', 'start'), S('pick', 'decision'),
  ...when.map((_, i) => S('r' + i, 'task', {duration: 1, set: {via: 'r' + i}, ...extra[i] ?? {}})), S('end', 'end')],
  [F('s-p', 'start', 'pick'), ...when.flatMap((w, i) => [F('to-r' + i, 'pick', 'r' + i, w ? {when: w} : {}), F('r' + i + '-end', 'r' + i, 'end')])], arrivals);
 const table = cases({region: 'eu', score: 80, vip: false}, {region: 'eu', score: 20, vip: false}, {region: 'us', score: 5, vip: false}, {region: 'eu', score: 5, vip: true}, {region: 'eu', score: 5, vip: false}, {vip: false}, {region: 'eu'});
 const q = sim(decide(table), 10); assert.deepEqual(q.cases.map(c => c.data.via), ['r0', 'r2', 'r1', 'r1', 'r3', 'r1', 'r2']);
 assert.deepEqual(q.cases.map(c => c.data.via), ['r0', 'r2', 'r1', 'r1', 'r3', 'r1', 'r2']);
 assert.equal(q.metrics.completed, 7);
 // Truth table of the evaluator, including a missing field under `not`, nesting to the depth limit and lazy chance leaves.
 const ev = (data: LWProcess.Fields, when: unknown) => graph.evaluate(data, when, () => { throw Error('no chance leaf expected'); });
 assert.equal(ev({}, {not: {field: 'a', op: 'eq', value: 1}}), true); assert.equal(ev({}, {field: 'a', op: 'eq', value: 1}), false);
 assert.equal(ev({a: 1}, {all: [{field: 'a', op: 'eq', value: 1}, {field: 'b', op: 'eq', value: 1}]}), false); assert.equal(ev({a: 1}, {any: [{field: 'a', op: 'eq', value: 1}, {field: 'b', op: 'eq', value: 1}]}), true);
 assert.equal(ev({a: 1, b: 2}, {all: [{any: [{not: {field: 'a', op: 'gt', valueField: 'b'}}]}]}), true);
 const asked: string[] = []; const recorder = (path: string, percent: number) => { asked.push(path + '@' + percent); return false; };
 assert.equal(graph.evaluate({t: 'gold'}, {any: [{field: 't', op: 'eq', value: 'gold'}, {chance: 30}]}, recorder), true); assert.deepEqual(asked, []);
 assert.equal(graph.evaluate({t: 'basic'}, {any: [{field: 't', op: 'eq', value: 'gold'}, {all: [{chance: 30}, {not: {chance: 40}}]}]}, recorder), false); assert.deepEqual(asked, ['1.0@30']);
 assert.equal(graph.evaluate({}, {chance: 25}, recorder), false); assert.deepEqual(asked, ['1.0@30', '@25']);
 // A chance leaf draws from its own keyed stream, so the cases routed by chance never depend on whether an earlier leaf short-circuited.
 const stream = (first: LWProcess.Fields[keyof LWProcess.Fields], seed?: number) => W([S('start', 'start'), S('pick', 'decision'), S('hit', 'task', {duration: 1, set: {via: 'hit'}}), S('miss', 'task', {duration: 1, set: {via: 'miss'}}), S('end', 'end')],
  [F('s-p', 'start', 'pick'), F('to-hit', 'pick', 'hit', {when: C({any: [{field: 'tier', op: 'eq', value: first}, {chance: 30}]})}), F('to-miss', 'pick', 'miss'), F('h-e', 'hit', 'end'), F('m-e', 'miss', 'end')],
  [{at: 0, count: 80, interval: 1, data: {}, draws: [{field: 'tier', kind: 'choice', values: [{value: 'gold', weight: 1}, {value: 'basic', weight: 3}]}]}], [], seed);
 const withGold = sim(stream('gold'), 200), noGold = sim(stream('platinum'), 200);
 for (let i = 0; i < 80; i++) { const a = withGold.cases[i]!, b = noGold.cases[i]!; assert.equal(a.data.tier, b.data.tier); if (a.data.tier !== 'gold') assert.equal(a.data.via, b.data.via); else assert.equal(a.data.via, 'hit'); }
 assert.deepEqual([stepM(withGold, 'hit').completed, stepM(noGold, 'hit').completed, withGold.cases.filter(c => c.data.tier === 'gold').length], [32, 21, 17]);
 const whole = JSON.stringify(sim(stream('gold'), 200)); assert.equal(JSON.stringify(sim(stream('gold'), 200, [1])), whole); assert.equal(JSON.stringify(sim(stream('gold'), 200, [13, 77])), whole);
 assert.notEqual(JSON.stringify(sim(stream('gold', 5), 200).cases.map(c => c.data.via)), JSON.stringify(withGold.cases.map(c => c.data.via)));
 // The top-level chance keeps its original key, so a plain chance route is unchanged by the combinator support.
 const plain = decide([{at: 0, count: 40, interval: 0, data: {}}], [C({chance: 40}), undefined]);
 assert.equal(JSON.stringify(sim(plain, 10).cases.map(c => c.data.via)), JSON.stringify(sim(plain, 10, [1]).cases.map(c => c.data.via)));
 assert.equal(sim(plain, 10).cases.filter(c => c.data.via === 'r0').length, 21);
 // Strict admission.
 const one = (when: unknown) => { const d = decide(ONE, [C(when), undefined]); return d; };
 assert.equal(catalog.validate(one({all: [{any: [{not: {field: 'a', op: 'eq', value: 1}}]}]})).ok, true);
 assert.equal(catalog.validate(one({all: [{field: 'a', op: 'eq', value: 1}, {chance: 10}]})).ok, true);
 const Ajv = require('ajv'), validate = new Ajv({strict: false, allowUnionTypes: true}).compile(catalog.schema); assert(validate(one({any: [{not: {chance: 5}}, {field: 'a', op: 'lt', valueField: 'b'}]})), JSON.stringify(validate.errors));
 assert.match(invalid(one({all: []})), /\/flows\/1\/when\/all The all combinator needs a non-empty list of conditions/);
 assert.match(invalid(one({any: [], })), /\/flows\/1\/when\/any The any combinator needs a non-empty list of conditions/);
 assert.match(invalid(one({all: [{chance: 10}], any: [{chance: 10}]})), /\/flows\/1\/when A condition uses exactly one form: a field comparison, chance, all, any or not/);
 assert.match(invalid(one({all: [{chance: 10}], field: 'a', op: 'eq', value: 1})), /exactly one form: a field comparison, chance, all, any or not/);
 assert.match(invalid(one({all: [{field: 'a', op: 'eq', value: 1, chance: 10}]})), /\/when\/all\/0 A condition uses exactly one form: chance, or field/);
 assert.match(invalid(one({all: [{all: [{all: [{all: [{chance: 10}]}]}]}]})), /\/when\/all\/0\/all\/0\/all\/0 Conditions nest at most 3 combinators deep/);
 assert.match(invalid(one({all: Array.from({length: 8}, () => ({any: [{chance: 10}, {chance: 20}]}))})), /A condition has at most 8 leaves/);
 assert.equal(catalog.validate(one({all: Array.from({length: 8}, () => ({chance: 10}))})).ok, true);
 assert.match(invalid(one({all: Array.from({length: 9}, () => ({chance: 10}))})), /Array length is out of range/);
 assert.match(invalid(one({not: [{chance: 10}]})), /\/when\/not Expected object/);
 assert.match(invalid(one({not: {chance: 100}})), /\/when\/not\/chance A chance route needs a whole percent from 1 to 99/);
 assert.match(invalid(one({all: [{field: 'a', op: 'eq'}]})), /\/when\/all\/0 A condition compares to exactly one of a value or another case field/);
 assert.match(invalid(one({all: [{op: 'eq', value: 1}]})), /\/when\/all\/0 A condition needs a field and an operator, or a chance percent/);
 assert.match(invalid(one({all: [{field: 'a', op: 'eq', value: 1, extra: 1}]})), /Unknown field: extra/);
 const task = W([S('start', 'start'), S('t', 'task', {duration: 1}), S('end', 'end')], [F('a', 'start', 't', {when: C({all: [{chance: 10}]})}), F('b', 't', 'end')]);
 assert.match(invalid(task), /\/flows\/0\/when Only decisions have conditions/);
 const fixed = decide(ONE, [C({any: [{field: 'a', op: 'eq', value: 1}, {field: 'b', op: 'eq', value: 1}]}), undefined]); assert.equal(catalog.fingerprint(fixed), catalog.fingerprint(copy(fixed)));
});

test('Inclusive forks activate every matching branch and the join waits for exactly those', () => {
 const d = inclusive(); assert.deepEqual(catalog.validate(d).diagnostics, []);
 const mid = (() => { const s = runtime.create(d); try { return s.advance(1); } finally { s.dispose(); } })();
 assert.deepEqual(mid.tokens.map(t => [t.caseId, t.stepId, t.status, t.branch, t.expected]), [['case-0001', 'a', 'active', 'f-a', 2], ['case-0001', 'b', 'active', 'f-b', 2], ['case-0002', 'a', 'active', 'f-a', 1], ['case-0003', 'c', 'timer', 'f-c', 1], ['case-0004', 'c', 'timer', 'f-c', 1]]);
 const q = sim(d, 30); assert.deepEqual([M(q), q.cases.map(c => [c.id, c.finished, c.status, Object.keys(c.data).filter(k => k.endsWith('Done')).join('+')]), events(q, 'forked').map(e => [e.caseId, e.detail]), events(q, 'joined').map(e => [e.minute, e.caseId]),
  [q.resources[0]!.busy, q.resources[0]!.busyMinutes], q.tokens.length, ['a', 'b', 'c', 'join'].map(id => stepM(q, id).completed)], [{minute: 5, arrived: 4, completed: 4, failed: 0, cost: 25}, [['case-0001', 5, 'completed', 'aDone+bDone'], ['case-0002', 3, 'completed', 'aDone'], ['case-0003', 2, 'completed', 'cDone'], ['case-0004', 2, 'completed', 'cDone']], [['case-0001', 'f-a,f-b'], ['case-0002', 'f-a'], ['case-0003', 'f-c'], ['case-0004', 'f-c']], [[2, 'case-0003'], [2, 'case-0004'], [3, 'case-0002'], [5, 'case-0001']], [0, 11], 0, [2, 1, 2, 4]]);
 for (const chunks of [[1], [2, 5, 9]]) assert.deepEqual(sim(d, 30, chunks), q);
 // Needs: a field delivered on only some activated branches is not guaranteed after the join; fields before the fork and parallel forks are.
 const needs = (steps: Partial<LWProcess.Step>) => { const x = inclusive({steps: [S('prep', 'task', {duration: 1, set: {prepared: true}})]}); Object.assign(x.steps.find(s => s.id === 'end')!, steps); return x; };
 assert.match(invalid(needs({needs: [{field: 'aDone'}]})), /\/needs\/0 Needs aDone delivered, but it is delivered only on some routes; possible values: true, not delivered/);
 assert.equal(catalog.validate(needs({needs: [{field: 'prepared'}]})).ok, true);
 const parallel = inclusive(); delete parallel.steps.find(s => s.id === 'fork')!.mode; for (const f of parallel.flows) delete f.when;
 assert.equal(catalog.validate(copy(parallel)).ok, true); parallel.steps.find(s => s.id === 'end')!.needs = [{field: 'aDone'}, {field: 'bDone'}, {field: 'cDone'}]; assert.equal(catalog.validate(parallel).ok, true);
 // No matching flow and no default fails the case explicitly and releases everything.
 const none = inclusive({data: [{express: false, insured: false}, {express: true, insured: false}], flows: {c: {when: C({field: 'late', op: 'eq', value: true})}}}); assert.deepEqual(catalog.validate(none).diagnostics, []);
 const f = sim(none, 20); assert.deepEqual([M(f), f.cases.map(c => [c.status, c.error, c.finished]), [f.resources[0]!.busy, f.resources[0]!.busyMinutes], f.tokens.length], [{minute: 3, arrived: 2, completed: 1, failed: 1, cost: 7}, [['failed', 'Inclusive fork "fork" matched no outgoing flow.', 0], ['completed', null, 3]], [0, 3], 0]);
 // A branch without steps (default flow straight to the join) and chance conditions on inclusive flows.
 const skip = (seed?: number) => W([S('start', 'start'), S('fork', 'fork', {join: 'join', mode: 'inclusive'}), S('a', 'task', {duration: 2, set: {aDone: true}}), S('b', 'task', {duration: 3, set: {bDone: true}}), S('join', 'join'), S('end', 'end')],
  [F('s-f', 'start', 'fork'), F('f-a', 'fork', 'a', {when: C({chance: 40})}), F('f-b', 'fork', 'b', {when: C({any: [{chance: 30}, {field: 'rush', op: 'eq', value: true}]})}), F('f-j', 'fork', 'join'), F('a-j', 'a', 'join'), F('b-j', 'b', 'join'), F('j-e', 'join', 'end')],
  [{at: 0, count: 100, interval: 1, data: {}}], [], seed);
 const s0 = sim(skip(), 300); assert.deepEqual(catalog.validate(skip()).diagnostics, []);
 assert.deepEqual([M(s0), ['a', 'b', 'join'].map(id => stepM(s0, id).completed), s0.cases.filter(c => c.data.aDone && c.data.bDone).length, s0.cases.filter(c => !c.data.aDone && !c.data.bDone).length], [{minute: 100, arrived: 100, completed: 100, failed: 0, cost: 0}, [43, 34, 100], 16, 39]);
 assert.equal(JSON.stringify(sim(skip(), 300, [1])), JSON.stringify(s0)); assert.equal(JSON.stringify(sim(skip(), 300, [17, 64])), JSON.stringify(s0));
 assert.notEqual(JSON.stringify(sim(skip(9), 300).cases.map(c => c.data)), JSON.stringify(s0.cases.map(c => c.data)));
});

test('Multi-instance steps run parallel and sequential items with per-item resources and one completion', () => {
 const expected = {
  parallel: {finish: 8, wait: 4, start: [['token-00000001', 'active', 1], ['token-00000002', 'active', 2], ['token-00000003', 'queued', 3]], counts: [1, 2], first: 2,
   events: ['0 started item 1 of 3', '0 started item 2 of 3', '4 finished-task item 1 of 3', '4 finished-task item 2 of 3', '4 started item 3 of 3', '8 finished-task item 3 of 3'], utilization: .75},
  sequential: {finish: 12, wait: 0, start: [['token-00000001', 'active', 1]], counts: [0, 1], first: 1,
   events: ['0 started item 1 of 3', '4 finished-task item 1 of 3', '4 started item 2 of 3', '8 finished-task item 2 of 3', '8 started item 3 of 3', '12 finished-task item 3 of 3'], utilization: .5},
 };
 for (const mode of ['parallel', 'sequential'] as const) {
  const d = items({count: 3, mode}), want = expected[mode]; assert.deepEqual(catalog.validate(d).diagnostics, []);
  const s = runtime.create(d), first = s.query();
  // Items are separate tokens that share a visit group; `queued` and `active` count items.
  assert.deepEqual(first.tokens.map(t => [t.id, t.status, t.item]), want.start); assert(first.tokens.every(t => t.items === 3 && t.group === 'token-00000001'));
  assert.deepEqual([stepM(first, 't').queued, stepM(first, 't').active, stepM(first, 't').items, stepM(first, 't').visits], [want.counts[0], want.counts[1], {started: want.first, finished: 0}, 1]);
  const one = s.advance(1); assert.deepEqual([one.tokens.map(t => [t.status, t.item]), one.metrics.cost], [want.start.map(t => [t[1], t[2]]), mode === 'parallel' ? 22 : 11]);
  for (let i = 0; i < 40 && s.query().status !== 'completed'; i++) { const r = s.advance(1); assert(r.resources[0]!.busy <= 2); }
  const q = s.query(); s.dispose();
  assert.deepEqual(M(q), {minute: want.finish, arrived: 1, completed: 1, failed: 0, cost: 42});
  assert.deepEqual(q.receipts, [{id: 'token-00000001@0', caseId: 'case-0001', stepId: 't', started: 0, finished: want.finish, input: {}, output: {done: true, n: 1}, changes: {done: true, n: 1}, instances: 3}]);
  assert.deepEqual([stepM(q, 't').completed, stepM(q, 't').waitMinutes, stepM(q, 't').items, q.resources[0]!.busyMinutes, q.resources[0]!.utilization], [1, want.wait, {started: 3, finished: 3}, 12, want.utilization]);
  assert.deepEqual(q.events.filter(e => e.stepId === 't' && (e.kind === 'started' || e.kind === 'finished-task')).map(e => e.minute + ' ' + e.kind + ' ' + e.detail), want.events);
  assert.deepEqual(q.cases[0]!.data, {done: true, n: 1}); assert.equal(q.tokens.length, 0);
 }
 // Capacity gates every item; two cases with sequential items re-enter the queue after each item, so they interleave.
 const inter = sim(items({count: 2, mode: 'sequential'}, {duration: 3}, 1, cases({}, {})), 40);
 assert.deepEqual([M(inter), events(inter, 'started').filter(e => e.stepId === 't').map(e => [e.minute, e.caseId, e.detail]), inter.receipts.map(r => [r.caseId, r.started, r.finished])], [{minute: 12, arrived: 2, completed: 2, failed: 0, cost: 52}, [[0, 'case-0001', 'item 1 of 2'], [3, 'case-0002', 'item 1 of 2'], [6, 'case-0001', 'item 2 of 2'], [9, 'case-0002', 'item 2 of 2']], [['case-0001', 0, 9], ['case-0002', 3, 12]]]);
 // Each item draws its own timing keyed by its index; a visit's realized time does not depend on contention.
 const timed = (mode: 'parallel' | 'sequential', capacity: number) => sim(items({count: 4, mode}, {timing: {dist: 'uniform', min: 2, max: 9}}, capacity, cases({}, {})), 80);
 const itemTimes = (q: LWProcess.Snapshot, caseId: string) => {
  const at = (kind: string) => { const m = new Map<number, number>(); for (const e of events(q, kind)) if (e.caseId === caseId && e.stepId === 't') m.set(Number(e.detail.split(' ')[1]), e.minute); return m; };
  const begun = at('started'), ended = at('finished-task'); return [...begun.keys()].sort().map(i => ended.get(i)! - begun.get(i)!);
 };
 const wide = timed('parallel', 8), narrow = timed('parallel', 1); assert.deepEqual([M(wide), wide.receipts.map(r => [r.caseId, r.started, r.finished, r.duration, r.instances]), M(narrow), narrow.receipts.map(r => [r.caseId, r.started, r.finished, r.duration])], [{minute: 8, arrived: 2, completed: 2, failed: 0, cost: 115}, [['case-0001', 0, 6, 6, 4], ['case-0002', 0, 8, 8, 4]], {minute: 35, arrived: 2, completed: 2, failed: 0, cost: 115}, [['case-0001', 0, 14, 14], ['case-0002', 14, 35, 21]]]);
 assert.deepEqual([itemTimes(wide, 'case-0001'), itemTimes(narrow, 'case-0001'), itemTimes(wide, 'case-0002'), itemTimes(narrow, 'case-0002')], [[6, 3, 2, 3], [6, 3, 2, 3], [4, 3, 6, 8], [4, 3, 6, 8]]);
 assert.deepEqual(itemTimes(wide, 'case-0001'), itemTimes(narrow, 'case-0001')); assert.deepEqual(itemTimes(wide, 'case-0002'), itemTimes(narrow, 'case-0002'));
 // The item count may come from the case data when the step is entered; unusable values fail the case explicitly.
 const dyn = sim(items({field: 'n', mode: 'parallel'}, {}, 2, cases({n: 3}, {n: 1}, {n: 0}, {n: 51}, {}, {n: 'x'}, {n: 2.5})), 60);
 assert.deepEqual([M(dyn), dyn.cases.map(c => [c.status, c.error]), dyn.resources[0]!.busy, dyn.tokens.length, stepM(dyn, 't').items], [{minute: 8, arrived: 7, completed: 2, failed: 5, cost: 56}, [['completed', null], ['completed', null], ['failed', 'Step "t" needs case field n as a whole number from 1 to 50 for its instances, but it holds 0.'], ['failed', 'Step "t" needs case field n as a whole number from 1 to 50 for its instances, but it holds 51.'], ['failed', 'Step "t" needs case field n as a whole number from 1 to 50 for its instances, but it is not set.'], ['failed', 'Step "t" needs case field n as a whole number from 1 to 50 for its instances, but it holds "x".'], ['failed', 'Step "t" needs case field n as a whole number from 1 to 50 for its instances, but it holds 2.5.']], 0, 0, {started: 4, finished: 4}]);
 // Draws, set and add apply once per visit; the visit is not repeated per item.
 const draws = sim(items({count: 3, mode: 'sequential'}, {draws: [{field: 'roll', kind: 'int', min: 1, max: 1000000}]}, 3), 40);
 assert.deepEqual([draws.receipts.length, draws.receipts[0]!.changes, draws.cases[0]!.data], [1, {done: true, roll: 50164, n: 1}, {done: true, roll: 50164, n: 1}]);
 assert.deepEqual(sim(items({count: 3, mode: 'sequential'}, {draws: [{field: 'roll', kind: 'int', min: 1, max: 1000000}]}, 3), 40, [1]), draws);
 // Retention does not change the exact totals; chunked advances equal one advance.
 const stream = items({count: 3, mode: 'parallel'}, {timing: {dist: 'exponential', mean: 4, max: 12}}, 4, [{at: 0, count: 30, interval: 1, data: {}}], 3);
 const all = sim(stream, 400, [400], {retained: 200}), few = sim(stream, 400, [400], {retained: 2});
 assert.deepEqual([few.metrics, few.steps, few.resources], [all.metrics, all.steps, all.resources]); assert.equal(few.retention.finishedDropped, 28);
 assert.deepEqual(sim(stream, 400, [1], {retained: 200}), all); assert.deepEqual(sim(stream, 400, [7, 61, 3], {retained: 200}), all);
 assert.notDeepEqual(sim({...stream, seed: 4}, 400).metrics, all.metrics);
 assert.deepEqual([M(all), [stepM(all, 't').visits, stepM(all, 't').waitMinutes], stepM(all, 't').items, all.resources[0]!.busyMinutes], [{minute: 90, arrived: 30, completed: 30, failed: 0, cost: 1256}, [30, 2435], {started: 90, finished: 90}, 356]);
});

test('Boundary deadlines interrupt or escalate work, release resources and keep results deterministic', () => {
 const intr = guarded({after: 4}); assert.deepEqual(catalog.validate(intr).diagnostics, []);
 const q = sim(intr, 100); assert.deepEqual([M(q), q.cases.map(c => [c.finished, c.data]), stepM(q, 't').deadlines, stepM(q, 't').waitMinutes, [q.resources[0]!.busy, q.resources[0]!.busyMinutes], q.events.filter(e => ['started', 'deadline-interrupt'].includes(e.kind)).map(e => [e.minute, e.kind, e.caseId, e.stepId, e.detail].join(' ')), q.receipts.map(r => r.stepId)], [{minute: 11, arrived: 2, completed: 2, failed: 0, cost: 26}, [[7, {late: true}], [11, {late: true}]], {interrupted: 2, escalated: 0}, 4, [0, 8], ['0 started case-0001 t ', '4 deadline-interrupt case-0001 t dl', '4 started case-0002 t ', '4 started case-0001 late ', '8 deadline-interrupt case-0002 t dl', '8 started case-0002 late '], ['late', 'late']]);
 for (const chunks of [[1], [3, 5]]) assert.deepEqual(sim(intr, 100, chunks), q);
 const edge = sim(guarded({after: 10}), 100); assert.deepEqual([M(edge), stepM(edge, 't').deadlines, edge.cases.map(c => c.data), events(edge, 'deadline-interrupt').length], [{minute: 20, arrived: 2, completed: 2, failed: 0, cost: 50}, {interrupted: 0, escalated: 0}, [{done: true}, {done: true}], 0]);
 const esc = guarded({after: 4, mode: 'escalate'}, {}, {outcomes: true}); assert.deepEqual(catalog.validate(esc).diagnostics, []);
 const e = sim(esc, 100); assert.deepEqual([M(e), e.metrics.goals, e.metrics.lost, e.metrics.conversion, e.cases.map(c => [c.finished, c.data]), stepM(e, 't').deadlines, e.events.filter(x => ['deadline-escalate', 'completed'].includes(x.kind)).map(x => [x.minute, x.kind, x.caseId, x.stepId].join(' '))], [{minute: 20, arrived: 2, completed: 2, failed: 0, cost: 50}, 2, 0, 1000, [[10, {late: true, done: true}], [20, {late: true, done: true}]], {interrupted: 0, escalated: 2}, ['4 deadline-escalate case-0001 t', '10 completed case-0001 end', '14 deadline-escalate case-0002 t', '20 completed case-0002 end']]);
 for (const chunks of [[1], [3, 5]]) assert.deepEqual(sim(esc, 100, chunks), e);
 // The case finishes with its last token even when the escalation outlasts the main route.
 const slow = sim(guarded({after: 4, mode: 'escalate'}, {}, {late: {duration: 30}, outcomes: true, arrivals: cases({})}), 100); assert.deepEqual([M(slow), slow.metrics.goals, slow.metrics.lost, slow.cases.map(c => c.finished), slow.metrics.meanCycleMinutes], [{minute: 34, arrived: 1, completed: 1, failed: 0, cost: 25}, 1, 0, [34], 34]);
 // Random deadlines are keyed by case and visit, so contention does not change when a given case times out.
 const random = (capacity: number) => sim(guarded({timing: {dist: 'uniform', min: 1, max: 9}}, {}, {capacity, arrivals: [{at: 0, count: 6, interval: 0, data: {}}], seed: 5}), 200);
 const waited = (q: LWProcess.Snapshot, id: string) => { const begun = events(q, 'started').find(x => x.caseId === id && x.stepId === 't')!.minute, hit = events(q, 'deadline-interrupt').find(x => x.caseId === id); return hit ? hit.minute - begun : null; };
 const tight = random(1), loose = random(6); assert.deepEqual([M(tight), M(loose), ['case-0001', 'case-0002', 'case-0003', 'case-0004', 'case-0005', 'case-0006'].map(id => [waited(tight, id), waited(loose, id)])], [{minute: 33, arrived: 6, completed: 6, failed: 0, cost: 90}, {minute: 12, arrived: 6, completed: 6, failed: 0, cost: 90}, [[6, 6], [1, 1], [4, 4], [1, 1], [9, 9], [9, 9]]]);
 for (const id of ['case-0001', 'case-0002', 'case-0003', 'case-0004', 'case-0005', 'case-0006']) assert.equal(waited(tight, id), waited(loose, id));
 assert.deepEqual(random(1), tight); assert.deepEqual(sim(guarded({timing: {dist: 'uniform', min: 1, max: 9}}, {}, {capacity: 1, arrivals: [{at: 0, count: 6, interval: 0, data: {}}], seed: 5}), 200, [1]), tight);
 assert.notDeepEqual(sim(guarded({timing: {dist: 'uniform', min: 1, max: 9}}, {}, {capacity: 1, arrivals: [{at: 0, count: 6, interval: 0, data: {}}], seed: 6}), 200).metrics, tight.metrics);
 // Multi-instance: each item has its own clock; an interrupt cancels the whole visit once, an escalation is spawned per late item.
 const multi = (mode: 'interrupt' | 'escalate', how: 'parallel' | 'sequential') => guarded({after: 4, mode}, {instances: {count: 3, mode: how}}, {capacity: 3, arrivals: cases({})});
 const mi = sim(multi('interrupt', 'parallel'), 100), me = sim(multi('escalate', 'parallel'), 100), ms = sim(multi('interrupt', 'sequential'), 100), mse = sim(multi('escalate', 'sequential'), 100);
 assert.deepEqual([mi, me, ms, mse].map(x => [M(x), stepM(x, 't').deadlines, stepM(x, 't').items, x.resources[0]!.busy, x.resources[0]!.busyMinutes, x.cases[0]!.data, x.cases[0]!.finished, x.receipts.map(r => r.stepId + ':' + (r.instances ?? '-'))]), [[{minute: 7, arrived: 1, completed: 1, failed: 0, cost: 39}, {interrupted: 1, escalated: 0}, {started: 3, finished: 0}, 0, 12, {late: true}, 7, ['late:-']], [{minute: 10, arrived: 1, completed: 1, failed: 0, cost: 75}, {interrupted: 0, escalated: 3}, {started: 3, finished: 3}, 0, 30, {late: true, done: true}, 10, ['late:-', 'late:-', 'late:-', 't:3']], [{minute: 7, arrived: 1, completed: 1, failed: 0, cost: 13}, {interrupted: 1, escalated: 0}, {started: 1, finished: 0}, 0, 4, {late: true}, 7, ['late:-']], [{minute: 30, arrived: 1, completed: 1, failed: 0, cost: 75}, {interrupted: 0, escalated: 3}, {started: 3, finished: 3}, 0, 30, {late: true, done: true}, 30, ['late:-', 'late:-', 'late:-', 't:3']]]);
 for (const mode of ['interrupt', 'escalate'] as const) assert.deepEqual(sim(multi(mode, 'parallel'), 100, [1]), mode === 'interrupt' ? mi : me);
 // Escalations per case are bounded: a rework loop that escalates on every pass fails the case on the 17th.
 const loop = W([S('start', 'start'), S('work', 'task', {duration: 3, add: {pass: 1}, deadline: {after: 1, mode: 'escalate', flow: 'dl'}}), S('gate', 'decision'), S('mgr', 'task', {duration: 1}), S('end', 'end'), S('stop', 'end')],
  [F('a', 'start', 'work'), F('b', 'work', 'gate'), F('again', 'gate', 'work', {when: {field: 'pass', op: 'lt', value: 30}}), F('done', 'gate', 'end'), F('dl', 'work', 'mgr', {on: 'deadline'}), F('c', 'mgr', 'stop')]);
 assert.deepEqual(catalog.validate(loop).diagnostics, []);
 const b = sim(loop, 200); assert.deepEqual([M(b), b.cases[0]!.error, stepM(b, 'work').deadlines, b.tokens.length], [{minute: 49, arrived: 1, completed: 0, failed: 1, cost: 0}, 'Case spawned more than 16 escalations.', {interrupted: 0, escalated: 17}, 0]);
 // Exact totals survive retention; the same stream is identical in any chunking.
 const stream = guarded({after: 3}, {timing: {dist: 'exponential', mean: 6, max: 20}}, {capacity: 2, arrivals: [{at: 0, count: 40, interval: 2, data: {}}], seed: 8});
 const all = sim(stream, 1000, [1000], {retained: 200}), few = sim(stream, 1000, [1000], {retained: 2});
 assert.deepEqual([few.metrics, few.steps, few.resources], [all.metrics, all.steps, all.resources]); assert.deepEqual(sim(stream, 1000, [9, 41], {retained: 200}), all);
 assert.deepEqual([M(all), stepM(all, 't').deadlines, stepM(all, 't').completed, all.resources[0]!.busyMinutes], [{minute: 80, arrived: 40, completed: 40, failed: 0, cost: 382}, {interrupted: 19, escalated: 0}, 21, 91]);
 // An escalating deadline inside a parallel branch spawns a separate token; the join still waits only for the branch tokens.
 const branch = W([S('start', 'start'), S('fork', 'fork', {join: 'join'}), S('a', 'task', {duration: 6, deadline: {after: 2, mode: 'escalate', flow: 'dl'}}), S('b', 'task', {duration: 3}), S('join', 'join'), S('alert', 'task', {duration: 1, set: {alerted: true}}), S('end', 'end'), S('end2', 'end')],
  [F('s-f', 'start', 'fork'), F('f-a', 'fork', 'a'), F('f-b', 'fork', 'b'), F('a-j', 'a', 'join'), F('b-j', 'b', 'join'), F('j-e', 'join', 'end'), F('dl', 'a', 'alert', {on: 'deadline'}), F('al-e', 'alert', 'end2')]);
 assert.deepEqual(catalog.validate(branch).diagnostics, []);
 const r = sim(branch, 30); assert.deepEqual([M(r), r.cases[0]!.data, r.cases[0]!.finished, events(r, 'joined').map(x => x.minute), stepM(r, 'a').deadlines, r.tokens.length], [{minute: 6, arrived: 1, completed: 1, failed: 0, cost: 0}, {alerted: true}, 6, [6], {interrupted: 0, escalated: 1}, 0]);
 assert.deepEqual(sim(branch, 30, [1]), r);
});

test('Inclusive, multi-instance and deadline definitions are rejected explicitly when malformed', () => {
 const edit = (d: LWProcess.Definition, change: (x: LWProcess.Definition) => void) => { const x = copy(d); change(x); return invalid(x); };
 const stepIn = (x: LWProcess.Definition, id: string) => x.steps.find(v => v.id === id)!, flowIn = (x: LWProcess.Definition, id: string) => x.flows.find(v => v.id === id)!;
 // Inclusive forks.
 const inc = inclusive();
 assert.match(edit(inc, x => { delete flowIn(x, 'f-a').when; }), /\/steps\/1 An inclusive fork allows at most one flow without a condition \(its default flow\)/);
 assert.match(edit(inc, x => { delete stepIn(x, 'fork').mode; }), /\/flows\/1\/when Only decisions have conditions/);
 assert.match(edit(inc, x => { stepIn(x, 'a').mode = 'inclusive'; }), /\/steps\/2\/mode Only forks declare a mode/);
 assert.match(edit(inc, x => { (stepIn(x, 'fork') as {mode: string}).mode = 'parallel'; }), /\/steps\/1\/mode Expected one of inclusive/);
 assert.match(edit(inc, x => { stepIn(x, 'a').set = {bDone: true}; }), /Inclusive branches cannot both write bDone/);
 assert.match(edit(inc, x => { x.steps.push(S('gate', 'decision')); flowIn(x, 'f-a').to = 'gate'; x.flows.push(F('g-a', 'gate', 'a'), F('g-b', 'gate', 'b', {when: C({chance: 50})})); }), /Inclusive branches must be disjoint chains of work steps/);
 assert.match(edit(inc, x => { x.flows = x.flows.filter(f => f.id !== 'f-c'); }), /Join has incoming work outside its fork/);
 assert.match(edit(inc, x => { const j = stepIn(x, 'join'); delete (j as {join?: string}).join; stepIn(x, 'fork').join = 'end'; }), /A fork must name an existing join step/);
 // Multi-instance steps.
 const mi = items({count: 3, mode: 'parallel'}), inst = (x: LWProcess.Definition) => stepIn(x, 't');
 assert.match(edit(mi, x => { inst(x).instances = {count: 3, field: 'n', mode: 'parallel'}; }), /\/steps\/1\/instances Instances need exactly one of count \(2 to 50\) or field/);
 assert.match(edit(mi, x => { inst(x).instances = {mode: 'parallel'}; }), /\/steps\/1\/instances Instances need exactly one of count/);
 assert.match(edit(mi, x => { inst(x).instances = {count: 1, mode: 'parallel'}; }), /\/steps\/1\/instances\/count Number is out of range/);
 assert.match(edit(mi, x => { inst(x).instances = {count: 51, mode: 'parallel'}; }), /\/instances\/count Number is out of range/);
 assert.match(edit(mi, x => { inst(x).instances = {count: 2} as never; }), /\/instances Missing field: mode/);
 assert.match(edit(mi, x => { inst(x).instances = {count: 2, mode: 'random' as never}; }), /\/instances\/mode Expected one of parallel, sequential/);
 assert.match(edit(mi, x => { inst(x).instances = {field: 'Bad Name', mode: 'parallel'}; }), /\/instances\/field String has invalid length or format/);
 assert.match(edit(mi, x => { inst(x).backlog = {capacity: 2}; }), /\/steps\/1\/backlog A multi-instance step cannot declare a backlog/);
 assert.match(edit(mi, x => { stepIn(x, 'start').instances = {count: 2, mode: 'parallel'}; }), /\/steps\/0 Only work steps .* declare work/);
 assert.match(edit(W([S('start', 'start'), S('wait', 'timer', {duration: 5, instances: {count: 2, mode: 'parallel'}}), S('end', 'end')], [F('a', 'start', 'wait'), F('b', 'wait', 'end')]), () => undefined), /\/steps\/1\/instances Only work steps \(task, touchpoint, machine, system\) take instances; timers do not/);
 // Boundary deadlines.
 const dl = guarded({after: 4}), esc = guarded({after: 4, mode: 'escalate'}, {}, {outcomes: true}), deadline = (x: LWProcess.Definition) => stepIn(x, 't').deadline!;
 assert.match(edit(dl, x => { delete deadline(x).after; }), /\/steps\/1\/deadline A deadline needs exactly one of after \(whole minutes\) or timing/);
 assert.match(edit(dl, x => { deadline(x).timing = {dist: 'uniform', min: 1, max: 3}; }), /\/steps\/1\/deadline A deadline needs exactly one of after/);
 assert.match(edit(dl, x => { delete (deadline(x) as {after?: number}).after; deadline(x).timing = {dist: 'uniform', min: 5, max: 3}; }), /\/steps\/1\/deadline\/timing A uniform distribution needs min at most max/);
 assert.match(edit(dl, x => { deadline(x).after = 0; }), /\/steps\/1\/deadline\/after Number is out of range/);
 assert.match(edit(dl, x => { (deadline(x) as {mode: string}).mode = 'cancel'; }), /\/deadline\/mode Expected one of interrupt, escalate/);
 assert.match(edit(dl, x => { deadline(x).flow = 'b'; }), /\/steps\/1\/deadline\/flow A deadline needs exactly one flow leaving this step marked on "deadline", and deadline.flow must name it/);
 assert.match(edit(dl, x => { delete flowIn(x, 'dl').on; }), /\/steps\/1\/deadline\/flow A deadline needs exactly one flow leaving this step marked on "deadline"/);
 assert.match(edit(dl, x => { delete stepIn(x, 't').deadline; }), /\/flows\/2\/on A flow marked on "deadline" must leave a work step whose deadline names it/);
 assert.match(edit(dl, x => { x.flows.push(F('dl2', 't', 'late', {on: 'deadline'})); }), /\/flows\/4\/on A flow marked on "deadline" must leave a work step whose deadline names it/);
 assert.match(edit(dl, x => { (flowIn(x, 'dl') as {on: string}).on = 'timeout'; }), /\/flows\/2\/on Expected one of deadline/);
 assert.match(edit(dl, x => { flowIn(x, 'dl').when = C({chance: 10}); }), /\/flows\/2\/when A deadline flow takes no condition/);
 assert.match(edit(W([S('start', 'start'), S('wait', 'timer', {duration: 5, deadline: {after: 2, mode: 'interrupt', flow: 'dl'}}), S('end', 'end')], [F('a', 'start', 'wait'), F('b', 'wait', 'end'), F('dl', 'wait', 'end', {on: 'deadline'})]), () => undefined), /\/steps\/1\/deadline Only work steps \(task, touchpoint, machine, system\) take deadline; timers do not/);
 assert.match(edit(esc, x => { flowIn(x, 'c').to = 'end'; x.steps = x.steps.filter(s => s.id !== 'end2'); }), /\/steps\/1\/deadline The escalation path must not share steps with the normal route \(shared: end\)/);
 assert.match(edit(esc, x => { flowIn(x, 'dl').to = 'end'; x.steps = x.steps.filter(s => s.id !== 'late' && s.id !== 'end2'); x.flows = x.flows.filter(f => f.id !== 'c'); }), /The escalation path must not share steps with the normal route \(shared: end\)/);
 assert.match(edit(esc, x => { stepIn(x, 'late').deadline = {after: 1, mode: 'escalate', flow: 'dl2'}; stepIn(x, 'late').resources = {w: 1}; x.steps.push(S('end3', 'end'), S('late2', 'task', {duration: 1})); x.flows.push(F('dl2', 'late', 'late2', {on: 'deadline'}), F('c2', 'late2', 'end3')); }), /An escalated token cannot be escalated again, but step "late" on the escalation path declares an escalating deadline/);
 const branch = W([S('start', 'start'), S('fork', 'fork', {join: 'join'}), S('a', 'task', {duration: 6, deadline: {after: 2, mode: 'interrupt', flow: 'dl'}}), S('b', 'task', {duration: 3}), S('join', 'join'), S('alert', 'task', {duration: 1}), S('end', 'end')],
  [F('s-f', 'start', 'fork'), F('f-a', 'fork', 'a'), F('f-b', 'fork', 'b'), F('a-j', 'a', 'join'), F('b-j', 'b', 'join'), F('j-e', 'join', 'end'), F('dl', 'a', 'alert', {on: 'deadline'}), F('al-e', 'alert', 'end')]);
 assert.match(invalid(branch), /\/steps\/2\/deadline\/mode A step inside a parallel or inclusive region can only escalate; an interrupt would strand the join/);
 // Distributions.
 const dist = (timing: unknown) => edit(guarded({after: 4}), x => { stepIn(x, 't').timing = timing as LWProcess.Dist; });
 assert.match(dist({dist: 'normal', mean: 10}), /\/steps\/1\/timing\/sd A normal distribution needs sd as a whole number of minutes from 1 to 100000/);
 assert.match(dist({dist: 'normal', mean: 10, sd: 0}), /\/timing\/sd Number is out of range/);
 assert.match(dist({dist: 'normal', mean: 10, sd: 2, k: 3}), /\/timing\/k A normal distribution does not take k/);
 assert.match(dist({dist: 'normal', mean: 10, sd: 2, mode: 3}), /\/timing\/mode A normal distribution does not take mode/);
 assert.match(dist({dist: 'normal', mean: 10, sd: 2, min: 12, max: 5}), /\/steps\/1\/timing A normal distribution needs min at most max/);
 assert.match(dist({dist: 'normal', mean: 10, sd: 1, min: 50}), /A normal distribution needs min at most max \(max defaults to mean \+ 6 sd, at most 100000\)/);
 assert.match(dist({dist: 'normal', mean: 10, sd: 2, max: 0}), /\/timing\/max Number is out of range/);
 assert.match(dist({dist: 'erlang', mean: 10}), /\/timing\/k An erlang distribution needs k as a whole number from 1 to 32/);
 assert.match(dist({dist: 'erlang', mean: 10, k: 33}), /\/timing\/k Number is out of range/);
 assert.match(dist({dist: 'erlang', k: 3, mean: 10, sd: 2}), /\/timing\/sd An erlang distribution does not take sd/);
 assert.match(dist({dist: 'erlang', k: 3, mean: 10, max: 20}), /\/timing\/max An erlang distribution does not take max/);
 assert.match(dist({dist: 'erlang', k: 3}), /\/timing\/mean An erlang distribution needs mean/);
 assert.match(dist({dist: 'uniform', min: 1, max: 3, sd: 1}), /\/timing\/sd A uniform distribution does not take sd/);
 for (const ok of [{dist: 'normal', mean: 10, sd: 2}, {dist: 'normal', mean: 100000, sd: 100000, min: 5}, {dist: 'erlang', k: 1, mean: 10}, {dist: 'erlang', k: 32, mean: 100000}]) assert.equal(catalog.validate(copy(guarded({after: 4}, {timing: ok as LWProcess.Dist}))).ok, true);
 // Rejections never touch the schema contract of existing definitions: defaults and fingerprints stay the same.
 const plain = W([S('start', 'start'), S('t', 'task', {duration: 4}), S('end', 'end')], [F('a', 'start', 't'), F('b', 't', 'end')]);
 assert.equal(catalog.validate(plain).ok, true); assert.equal(catalog.fingerprint(plain), catalog.fingerprint(copy(plain)));
});
