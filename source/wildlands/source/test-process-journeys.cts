/// <reference path="./process-contracts.d.ts" />
/** Customer and user journeys: touchpoints, outcomes, funnel and tracked metrics, the journey examples and SIPOC. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {catalog, runtime, authoring} from './process-sdk.cjs';
import {test, base, copy, guard, run, stepOf, flowOf, build, startEnd} from './test-process-helpers.cjs';

/**
 * Web-shop funnel: ad -> browse -> 30% bounce | cart -> checkout -> 20% payment loss | delivery -> goal. `mood` starts as a drawn -1..1
 * and changes by counters.
 */
function journey(extra: Partial<LWProcess.Definition> = {}): LWProcess.Definition {
 const chance = (percent: number) => ({chance: percent}) as unknown as LWProcess.Condition;
 const d = build([stepOf('start', 'start', {phase: 'Awareness'}),
  stepOf('ad', 'touchpoint', {name: 'Sees ad', channel: 'social', phase: 'Awareness', emotion: 1, duration: 1, add: {mood: 1},
   opportunity: 'Show the price in the ad.'}),
  stepOf('browse', 'touchpoint', {name: 'Browses shop', channel: 'web', phase: 'Consideration', emotion: 1, duration: 3, add: {mood: 1},
   pain: 'Search results are slow.'}),
  stepOf('intent', 'decision', {phase: 'Consideration'}),
  stepOf('cart', 'touchpoint', {name: 'Fills cart', channel: 'web', phase: 'Purchase', emotion: 0, duration: 2}),
  stepOf('checkout', 'touchpoint', {name: 'Checks out', channel: 'web', phase: 'Purchase', emotion: -1, duration: 4, resources: {shop: 1}, add: {mood: -1},
   pain: 'Account creation is required.'}),
  stepOf('pay', 'decision', {phase: 'Purchase'}),
  stepOf('delivery', 'touchpoint', {name: 'Gets parcel', channel: 'delivery', phase: 'Delivery', emotion: 2, duration: 10,
   timing: {dist: 'uniform', min: 6, max: 14}, add: {mood: 2}}),
  stepOf('won', 'end', {name: 'Delivered', outcome: 'goal', phase: 'Delivery'}), stepOf('lost', 'end', {name: 'Abandoned', outcome: 'lost'})],
  [flowOf('start', 'ad'), flowOf('ad', 'browse'), flowOf('browse', 'intent'), flowOf('intent', 'lost', chance(30)), flowOf('intent', 'cart'),
   flowOf('cart', 'checkout'), flowOf('checkout', 'pay'), flowOf('pay', 'lost', chance(20)), flowOf('pay', 'delivery'), flowOf('delivery', 'won')],
  [{at: 0, until: 400, interval: 2, data: {}, draws: [{field: 'mood', kind: 'int', min: -1, max: 1}]}],
  [{id: 'shop', name: 'Shop platform', capacity: 2, costPerMinute: 1, kind: 'system'}]);
 return catalog.admit({...d, id: 'web-shop', name: 'Web shop', genre: 'customer-journey',
  track: [{field: 'mood', label: 'Mood'}, {field: 'missing'}], ...extra});
}
const full = (d: LWProcess.Definition, chunks: number[] = [1600], options: LWProcess.RunOptions = {retained: 5000}) => {
 const s = runtime.create(d, options);
 try { for (const n of chunks) s.advance(n); return s.query(); } finally { s.dispose(); }
};
const roundMean = (values: number[]) => Math.round(values.reduce((a, b) => a + b, 0) / values.length * 1000) / 1000;
const FUNNEL = {cart: 149, goals: 120, conversion: 600, finishMean: 2.4, adMean: -0.055, checkoutMean: 1.94, deliveryMean: 0.958};
test('Touchpoints, phases, emotions and end outcomes validate and run like work steps with exact funnel metrics', () => {
 const d = journey(); assert.equal(catalog.validate(d).ok, true, JSON.stringify(catalog.validate(d).diagnostics));
 const q = full(d), step = (id: string) => q.steps.find(x => x.id === id)!, N = 200;
 assert.equal(q.status, 'completed'); assert.equal(q.metrics.arrived, N); assert.equal(q.metrics.completed, N); assert.equal(q.metrics.failed, 0);
 // Funnel: reached counts distinct cases, entered every visit; both equal the visits here because no step repeats.
 for (const id of ['start', 'ad', 'browse', 'intent']) { assert.equal(step(id).reached, N); assert.equal(step(id).entered, N); }
 const afterIntent = step('cart').reached; assert(afterIntent > 0 && afterIntent < N);
 assert.equal(step('checkout').reached, afterIntent);
 assert.equal(step('pay').reached, afterIntent);
 assert.equal(step('delivery').reached, step('won').reached);
 assert.equal(step('lost').reached, N - step('won').reached); assert.equal(q.steps.every(x => x.entered === x.visits && x.reached === x.entered), true);
 assert.equal(q.metrics.goals, step('won').reached); assert.equal(q.metrics.lost, step('lost').reached); assert.equal(q.metrics.goals + q.metrics.lost, N);
 assert.equal(q.metrics.conversion, Math.floor((2000 * q.metrics.goals + N) / (2 * N)));
 assert.equal(q.metrics.conversion, Math.round(q.metrics.goals * 1000 / N));
 assert.deepEqual([afterIntent, q.metrics.goals, q.metrics.lost, q.metrics.conversion], [FUNNEL.cart, FUNNEL.goals, N - FUNNEL.goals, FUNNEL.conversion]);
 // Touchpoints queue, wait for pools, charge cost and write receipts like tasks; delivery records its realized timing.
 const receipt = q.receipts.filter(r => r.stepId === 'delivery');
 assert(receipt.length > 0 && receipt.every(r => r.duration! >= 6 && r.duration! <= 14 && r.finished - r.started === r.duration));
 assert.equal(step('ad').completed, N);
 assert.equal(q.resources.find(r => r.id === 'shop')!.busyMinutes, 4 * afterIntent);
 assert.equal(q.steps.find(x => x.id === 'browse')!.waitMinutes, 0);
 const events = (id: string) => [...new Set(q.events.filter(e => e.stepId === id).map(e => e.kind))];
 assert.deepEqual(events('ad'), ['entered', 'started', 'finished-task']);
 // A touchpoint with no resources never waits; one with a system pool queues behind its capacity.
 const crowd = run(build(startEnd(stepOf('talk', 'touchpoint', {duration: 5, channel: 'phone'})), [flowOf('start', 'talk'), flowOf('talk', 'end')],
  [{at: 0, count: 5, interval: 0, data: {}}]), 5);
 assert.equal(crowd.metrics.completed, 5); assert.equal(crowd.steps.find(x => x.id === 'talk')!.waitMinutes, 0);
 const people = build(startEnd(stepOf('talk', 'touchpoint', {duration: 5, resources: {agent: 1}, channel: 'chat'})),
  [flowOf('start', 'talk'), flowOf('talk', 'end')], [{at: 0, count: 2, interval: 0, data: {}}], [{id: 'agent', name: 'Agent', capacity: 1, costPerMinute: 1}]);
 assert.equal(catalog.validate(people).ok, true); assert.equal(run(people, 20).steps.find(x => x.id === 'talk')!.waitMinutes, 5);
 const split = build([stepOf('start', 'start'), stepOf('fan', 'fork', {join: 'sync'}),
  stepOf('mail', 'touchpoint', {duration: 2, channel: 'email', set: {mailed: true}}),
  stepOf('sms', 'touchpoint', {duration: 3, resources: {bot: 1}, channel: 'mobile'}), stepOf('sync', 'join'), stepOf('end', 'end', {outcome: 'goal'})],
  [flowOf('start', 'fan'), flowOf('fan', 'mail'), flowOf('fan', 'sms'), flowOf('mail', 'sync'), flowOf('sms', 'sync'), flowOf('sync', 'end')], undefined,
  [{id: 'bot', name: 'Messaging system', capacity: 1, costPerMinute: 0, kind: 'system'}]);
 const s2 = run(split, 10);
 assert.equal(s2.metrics.completed, 1);
 assert.equal(s2.metrics.goals, 1);
 assert.equal(s2.metrics.lost, 0);
 assert.equal(s2.metrics.conversion, 1000);
 // No outcome counted for a process without outcomes; conversion is null then, and a genre never changes the run.
 const plain = run(base(), 20);
 assert.deepEqual([plain.metrics.goals, plain.metrics.lost, plain.metrics.conversion], [0, 0, null]);
 assert.deepEqual(plain.metrics.tracked, {});
 assert.deepEqual(plain.steps[1]!.tracked, {});
 const other = journey({genre: 'user-journey'}), ungenred = (() => { const x = copy(d); delete x.genre; return x; })();
 assert.equal(JSON.stringify(full(other)), JSON.stringify(q));
 assert.equal(JSON.stringify(full(ungenred)), JSON.stringify(q));
 assert.notEqual(catalog.fingerprint(other), catalog.fingerprint(d));
 const lostOnly = run(build(startEnd(), [flowOf('start', 'end')]), 5); assert.equal(lostOnly.metrics.conversion, null);
 const rounding = (g: number, l: number) => Math.floor((2000 * g + g + l) / (2 * (g + l)));
 assert.deepEqual([rounding(1, 2), rounding(2, 1), rounding(1, 7), rounding(1, 1)], [333, 667, 125, 500]);
});
test('Tracked fields aggregate exactly at case finish and at step entry, even when finished cases are pruned', () => {
 const d = journey(), whole = full(d), kept = whole.cases, N = 200; assert.equal(kept.length, N);
 const mood = kept.filter(c => c.status === 'completed').map(c => c.data.mood as number), start = kept.map(c => c.input.mood as number);
 const fin = whole.metrics.tracked.mood!;
 assert.equal(fin.label, 'Mood');
 assert.equal(fin.n, N);
 assert.equal(fin.mean, roundMean(mood));
 assert.equal(fin.min, Math.min(...mood));
 assert.equal(fin.max, Math.max(...mood));
 assert.deepEqual(whole.metrics.tracked.missing, {label: 'missing', n: 0, mean: null, min: null, max: null});
 const entry = (id: string) => whole.steps.find(x => x.id === id)!.tracked;
 // Reference means recomputed from the retained cases: counters add 1 at the ad and browse, -1 at checkout, +2 at delivery.
 assert.deepEqual(entry('ad').mood, {n: N, mean: roundMean(start)});
 assert.deepEqual(entry('browse').mood, {n: N, mean: roundMean(start.map(x => x + 1))});
 assert.deepEqual(entry('intent').mood, {n: N, mean: roundMean(start.map(x => x + 2))});
 assert.deepEqual(entry('start').mood, {n: N, mean: roundMean(start)}); assert.deepEqual(entry('ad').missing, {n: 0, mean: null});
 assert.equal(entry('won').mood!.n, whole.metrics.goals); assert.equal(entry('lost').mood!.n, whole.metrics.lost);
 // A case that reaches the goal ends with its drawn mood plus 3 (ad +1, browse +1, checkout -1, delivery +2); a lost case never reached delivery.
 const delivered = kept.filter(c => c.transitions === 9), wonMood = delivered.map(c => c.data.mood as number);
 assert.equal(wonMood.length, whole.metrics.goals); assert.deepEqual(entry('won').mood, {n: whole.metrics.goals, mean: roundMean(wonMood)});
 assert.equal(entry('delivery').mood!.mean, roundMean(wonMood.map(x => x - 2))); assert.equal(entry('pay').mood!.n, entry('cart').mood!.n);
 assert.deepEqual([fin.mean, entry('ad').mood!.mean, entry('checkout').mood!.mean, entry('delivery').mood!.mean],
  [FUNNEL.finishMean, FUNNEL.adMean, FUNNEL.checkoutMean, FUNNEL.deliveryMean]);
 // Pruning and chunking change nothing: only the retained `cases` differ.
 const strip = (q: LWProcess.Snapshot) => JSON.stringify({...q, cases: [], retention: null}), reference = strip(whole);
 for (const retained of [1, 10, 200]) {
  const q = full(d, [1600], {retained});
  assert.equal(strip(q), reference);
  assert.equal(q.retention.finishedDropped, N - retained);
  assert.equal(q.cases.length, retained);
 }
 for (const chunks of [[1600], [1, 1, 1598], [7, 13, 100, 480, 1000], Array.from({length: 1600}, () => 1)]) {
  assert.equal(JSON.stringify(full(d, chunks)), JSON.stringify(whole));
  assert.equal(strip(full(d, chunks, {retained: 3})), reference);
 }
 const mid = full(d, [100], {retained: 2}), early = full(d, [100]);
 assert.equal(strip(mid), strip(early));
 assert(mid.metrics.tracked.mood!.n < N && mid.metrics.tracked.mood!.n > 0);
 // Non-numeric and unset values are ignored; tracking needs no declared deliveries.
 const text = journey({track: [{field: 'seg'}]});
 text.arrivals[0]!.data = {seg: 'vip'};
 assert.deepEqual(full(text).metrics.tracked.seg, {label: 'seg', n: 0, mean: null, min: null, max: null});
 assert.equal(catalog.validate(text).ok, true);
 const noTrack = journey();
 delete noTrack.track;
 const flat = full(noTrack);
 assert.deepEqual(flat.metrics.tracked, {});
 assert.equal(flat.metrics.goals, whole.metrics.goals);
 const fractions = journey({track: [{field: 'score'}]});
 fractions.arrivals[0]!.draws = [{field: 'score', kind: 'choice',
  values: [{value: 1, weight: 1}, {value: 2, weight: 1}, {value: 2.5, weight: 1}, {value: 'x', weight: 1}]}];
 const scored = full(fractions), seen = scored.cases.map(c => c.input.score).filter(v => typeof v === 'number') as number[];
 assert.equal(scored.metrics.tracked.score!.n, seen.length);
 assert.equal(scored.metrics.tracked.score!.mean, roundMean(seen));
 assert.equal(scored.metrics.tracked.score!.max, 2.5);
});
test('Journey definitions are rejected explicitly when malformed', () => {
 const bad = (mutate: (d: LWProcess.Definition) => void) => {
  const d = copy(journey());
  mutate(d);
  const v = catalog.validate(d);
  assert.equal(v.ok, false);
  return v.diagnostics.map(x => x.path + ' ' + x.code + ' ' + x.message).join('|');
 };
 const at = (d: LWProcess.Definition, id: string) => d.steps.find(x => x.id === id)!, raw = (v: unknown) => v as never;
 assert.match(bad(d => { (d as unknown as {genre: string}).genre = 'funnel'; }), /\/genre shape Expected one of process, customer-journey, user-journey/);
 for (const genre of ['process', 'customer-journey', 'user-journey'] as const) assert.equal(catalog.validate(journey({genre})).ok, true);
 assert.match(bad(d => { d.track = [{field: 'mood'}, {field: 'mood'}]; }), /\/track\/1\/field graph Tracked field mood is listed twice/);
 assert.match(bad(d => { d.track = Array.from({length: 7}, (_, i) => ({field: 'f' + i})); }), /\/track shape Array length is out of range/);
 assert.match(bad(d => { d.track = [{field: 'Bad field'}]; }), /\/track\/0\/field shape String has invalid length or format/);
 assert.match(bad(d => { d.track = [{field: 'mood', label: 'x'.repeat(41)}]; }), /\/track\/0\/label shape/);
 assert.match(bad(d => { d.track = [{field: 'mood', label: ''}]; }), /\/track\/0\/label shape/);
 assert.match(bad(d => { d.track = raw([{field: 'mood', color: 'red'}]); }), /\/track\/0 shape Unknown field: color/);
 assert.match(bad(d => { d.track = raw({field: 'mood'}); }), /\/track shape Expected array/);
 assert.match(bad(d => { d.track = raw([{label: 'No field'}]); }), /\/track\/0 shape Missing field: field/);
 assert.equal(catalog.validate(journey({track: Array.from({length: 6}, (_, i) => ({field: 'f' + i, label: 'x'.repeat(40)}))})).ok, true);
 assert.match(bad(d => { at(d, 'ad').phase = ''; }), /\/steps\/1\/phase shape/);
 assert.match(bad(d => { at(d, 'ad').phase = 'x'.repeat(41); }), /\/steps\/1\/phase shape/);
 assert.match(bad(d => { at(d, 'ad').phase = raw(5); }), /\/steps\/1\/phase shape Expected string/);
 assert.match(bad(d => { at(d, 'ad').emotion = 4; }), /\/steps\/1\/emotion shape Number is out of range/);
 assert.match(bad(d => { at(d, 'ad').emotion = -4; }), /\/steps\/1\/emotion shape Number is out of range/);
 assert.match(bad(d => { at(d, 'ad').emotion = 1.5; }), /\/steps\/1\/emotion shape Expected integer/);
 assert.match(bad(d => { at(d, 'ad').emotion = raw('2'); }), /\/steps\/1\/emotion shape Expected integer/);
 assert.match(bad(d => { at(d, 'ad').pain = 'x'.repeat(241); }), /\/steps\/1\/pain shape/);
 assert.match(bad(d => { at(d, 'ad').opportunity = ''; }), /\/steps\/1\/opportunity shape/);
 assert.match(bad(d => { at(d, 'ad').pain = raw(1); }), /\/steps\/1\/pain shape Expected string/);
 for (const edge of [-3, 3]) {
  const ok = journey();
  at(ok, 'ad').emotion = edge;
  at(ok, 'ad').pain = 'x'.repeat(240);
  at(ok, 'ad').opportunity = 'y'.repeat(240);
  at(ok, 'ad').phase = 'z'.repeat(40);
  assert.equal(catalog.validate(ok).ok, true);
 }
 assert.match(bad(d => { at(d, 'cart').channel = raw('fax'); }),
  /\/steps\/4\/channel shape Expected one of web, mobile, store, phone, chat, email, social, ads, delivery, document/);
 for (const channel of ['web', 'mobile', 'store', 'phone', 'chat', 'email', 'social', 'ads', 'delivery', 'document'] as const) {
  const ok = journey();
  at(ok, 'cart').channel = channel;
  assert.equal(catalog.validate(ok).ok, true);
 }
 assert.match(bad(d => { at(d, 'intent').channel = 'web'; }), /\/steps\/3\/channel graph A channel is declared only on touchpoint steps/);
 assert.match(bad(d => { at(d, 'won').channel = 'web'; }), /\/steps\/8\/channel graph A channel is declared only on touchpoint steps/);
 assert.match(bad(d => { at(d, 'cart').kind = 'task'; }), /\/steps\/4\/channel graph A channel is declared only on touchpoint steps/);
 assert.match(bad(d => { at(d, 'cart').outcome = 'goal'; }), /\/steps\/4\/outcome graph An outcome \(goal or lost\) is declared only on end steps/);
 assert.match(bad(d => { at(d, 'intent').outcome = 'lost'; }), /\/steps\/3\/outcome graph An outcome/);
 assert.match(bad(d => { at(d, 'won').outcome = raw('won'); }), /\/steps\/8\/outcome shape Expected one of goal, lost/);
 assert.match(bad(d => { delete at(d, 'cart').duration; }), /\/steps\/4\/duration graph Touchpoints need a positive whole-minute duration/);
 assert.match(bad(d => { at(d, 'cart').duration = 0; }), /\/steps\/4\/duration shape/);
 assert.match(bad(d => { at(d, 'cart').until = 5; }), /\/steps\/4\/until graph Only timers wait until a minute/);
 assert.match(bad(d => { at(d, 'cart').technology = 'CMS'; }), /\/steps\/4\/technology graph Technology is declared only on machine and system steps/);
 assert.match(bad(d => { at(d, 'cart').resources = {missing: 1}; }), /\/steps\/4\/resources\/missing graph Uses pool "missing", which is not defined\./);
 assert.match(bad(d => { at(d, 'checkout').resources = {shop: 3}; }), /\/steps\/5\/resources\/shop graph Demand exceeds the available pool/);
 assert.match(bad(d => { d.flows.push({id: 'extra', from: 'cart', to: 'lost'}); }),
  /\/steps\/4 graph A touchpoint needs exactly 1 outgoing flow; this one has 2\./);
 assert.match(bad(d => { at(d, 'cart').timing = {dist: 'uniform', min: 5, max: 2}; }), /\/steps\/4\/timing graph A uniform distribution needs min at most max/);
 assert.match(bad(d => { at(d, 'cart').draws = [{field: 'x', kind: 'int', min: 3, max: 1}]; }),
  /\/steps\/4\/draws\/0 graph An int draw needs whole min and max/);
 assert.match(bad(d => {
  at(d, 'cart').set = {a: 1};
  at(d, 'cart').draws = [{field: 'a', kind: 'int', min: 1, max: 2}];
 }), /\/steps\/4\/draws\/0\/field graph Draw field a is also given a fixed value/);
 assert.match(bad(d => { at(d, 'cart').add = {}; }), /\/steps\/4\/add graph Name at least one counter field/);
 assert.match(bad(d => { at(d, 'cart').outputs = [{field: 'ghost'}]; }), /\/steps\/4\/outputs\/0 graph Step "Fills cart" declares output ghost/);
 assert.match(bad(d => { at(d, 'cart').backlog = {capacity: 2, order: 'priority'}; }), /\/steps\/4\/backlog\/priority graph Priority order needs/);
 assert.match(bad(d => { at(d, 'start').timing = {dist: 'uniform', min: 1, max: 2}; }), /\/steps\/0 graph Only work steps/);
 assert.match(bad(d => { at(d, 'cart').needs = [{field: 'never'}]; }), /\/steps\/4\/needs\/0 needs Needs never delivered/);
 // Tasks keep the people-only rule; touchpoints accept pools of any kind, annotations are allowed on every kind and shape errors come before graph errors.
 const tasked = journey();
 at(tasked, 'checkout').kind = 'task';
 delete at(tasked, 'checkout').channel;
 assert.match(catalog.validate(tasked).diagnostics.map(x => x.message).join('|'), /Tasks may demand only people pools, but "shop" is a system pool/);
 const annotated = journey();
 for (const s of annotated.steps) Object.assign(s, {phase: 'P', emotion: -2, pain: 'p', opportunity: 'o'});
 assert.equal(catalog.validate(annotated).ok, true, JSON.stringify(catalog.validate(annotated).diagnostics));
 assert.equal(JSON.stringify(full(annotated).metrics), JSON.stringify(full(journey()).metrics));
 assert.notEqual(catalog.fingerprint(annotated), catalog.fingerprint(journey()));
 const mixed = bad(d => { at(d, 'ad').emotion = 9; at(d, 'cart').channel = 'web'; at(d, 'intent').channel = 'web'; });
 assert.match(mixed, /emotion shape/);
 assert.doesNotMatch(mixed, /graph/);
 const viaGraph = bad(d => { at(d, 'intent').channel = 'web'; at(d, 'won').outcome = 'goal'; at(d, 'cart').outcome = 'lost'; });
 assert.match(viaGraph, /\/steps\/3\/channel graph/);
 assert.match(viaGraph, /\/steps\/4\/outcome graph/);
 assert.throws(() => runtime.create(raw({...journey(), genre: 'x'})), /\/genre: Expected one of/);
 assert.throws(() => authoring.edit(journey(), guard(journey(), [{op: 'putStep', value: {...at(journey(), 'cart'), emotion: 7}}])), /emotion/);
 const edited = authoring.edit(journey(), guard(journey(), [{op: 'putStep', value: {...at(journey(), 'cart'), emotion: -3, phase: 'Buy', pain: 'Slow'}}]));
 assert.equal(edited.definition.steps[4]!.emotion, -3);
});
const journeyFile = (name: string) => JSON.parse(
 fs.readFileSync(path.resolve(__dirname, '../../../docs/concepts/agency-delivery/content/' + name + '.process.json'), 'utf8')) as LWProcess.Definition;
/** Advances a journey example in chunks, checking the shared invariants after every chunk. */
const journeyRun = (d: LWProcess.Definition, minutes: number, chunks: number[], options: LWProcess.RunOptions = {horizon: null}) => {
 const s = runtime.create(d, options);
 try {
  let q = s.query();
  for (let done = 0, i = 0; done < minutes; i++) {
   const n = Math.min(chunks[i % chunks.length]!, minutes - done);
   q = s.advance(n);
   done += n;
   assert(q.metrics.active <= runtime.limits.active, 'active within the limit');
   assert.equal(q.metrics.failed, 0);
   assert.equal(q.metrics.dropped, 0);
   assert.equal(q.status, 'running');
   for (const r of q.resources) assert(r.busy <= r.capacity, `${r.id} within capacity at ${q.minute}`);
  }
  return q;
 } finally { s.dispose(); }
};
const journeyAdmitted = (d: LWProcess.Definition, genre: string, seed: number, ids: string[]) => {
 const admission = catalog.validate(d);
 assert.equal(admission.ok, true);
 assert.deepEqual(admission.diagnostics, []);
 assert.equal(d.genre, genre);
 assert.equal(d.seed, seed);
 assert(d.steps.every(x => !x.scene.asset));
 assert(d.steps.every(x => typeof x.phase === 'string' && x.phase.length > 0), 'every step has a phase');
 assert.equal(d.arrivals.length, 1);
 assert.equal(d.arrivals[0]!.open, true);
 assert.deepEqual(d.steps.filter(x => x.kind === 'end').map(x => x.id).filter(id => ids.includes(id)), ids);
 const touch = d.steps.filter(x => x.kind === 'touchpoint');
 assert(touch.length >= 10);
 assert(touch.every(x => Number.isInteger(x.emotion) && x.emotion! >= -3 && x.emotion! <= 3 && typeof x.channel === 'string'),
  'touchpoints carry emotion and channel');
 assert(d.steps.filter(x => x.kind !== 'touchpoint').every(x => x.channel === undefined), 'channel only on touchpoints');
 assert(d.steps.filter(x => x.kind === 'end').every(x => x.outcome === 'goal' || x.outcome === 'lost'));
};
const step = (q: LWProcess.Snapshot, id: string) => q.steps.find(x => x.id === id)!;
test('Customer journey webshop keeps steady random demand with exact funnel, conversion and sentiment metrics', () => {
 const shop = journeyFile('customer-journey-webshop'); journeyAdmitted(shop, 'customer-journey', 20261001, ['happy', 'loyal', 'left', 'payment-lost']);
 assert.deepEqual(shop.track, [{field: 'sentiment', label: 'Customer sentiment'}]);
 assert.equal(shop.arrivals[0]!.gap!.dist, 'exponential');
 assert.deepEqual(shop.resources.map(r => [r.id, r.kind, r.capacity]), [['agents', 'people', 3], ['gateway', 'system', 4], ['warehouse', 'machine', 3]]);
 assert.deepEqual(new Set(shop.steps.map(x => x.phase)), new Set(['Awareness', 'Consideration', 'Purchase', 'Delivery', 'After-sales and loyalty']));
 const whole = journeyRun(shop, 1000, [1000]); const m = whole.metrics; assert.equal(whole.seed, 20261001); assert.equal(whole.minute, 1000);
 assert.deepEqual([m.arrived, m.completed, m.failed, m.dropped, m.active, m.goals, m.lost, m.conversion], [338, 334, 0, 0, 4, 173, 161, 518]);
 assert.equal(m.goals + m.lost, m.completed);
 assert(m.conversion! >= 100 && m.conversion! <= 600, 'conversion reads realistically');
 assert.deepEqual(m.tracked.sentiment, {label: 'Customer sentiment', n: 334, mean: 4.749, min: 0, max: 7});
 assert.deepEqual(['shopper-sees-ad', 'reviews', 'interested', 'cart', 'checkout', 'payment', 'support-chat', 'confirmation', 'delivery', 'problem', 'returns',
  'happy', 'loyal', 'left', 'payment-lost'].map(id => step(whole, id).reached), [338, 337, 337, 233, 176, 176, 9, 175, 174, 173, 20, 109, 64, 160, 1]);
 assert.deepEqual([step(whole, 'payment').entered, step(whole, 'support-chat').entered], [185, 10]);
 assert.deepEqual([step(whole, 'browse').tracked.sentiment, step(whole, 'unboxing').tracked.sentiment], [{n: 338, mean: 1}, {n: 173, mean: 3.948}]);
 assert.equal(step(whole, 'interested').reached - step(whole, 'cart').reached,
  step(whole, 'left').reached - (step(whole, 'cart-abandoned').reached - step(whole, 'checkout').reached), 'drop-off is the difference of reached');
 assert.deepEqual(whole.resources.map(r => [r.id, r.busyMinutes]), [['agents', 240], ['gateway', 363], ['warehouse', 2051]]);
 const reference = JSON.stringify(whole);
 assert.equal(JSON.stringify(journeyRun(shop, 1000, [1])), reference);
 assert.equal(JSON.stringify(journeyRun(shop, 1000, [7, 33, 250])), reference);
 const other = journeyRun(shop, 1000, [1000], {horizon: null, seed: 7});
 assert.equal(other.seed, 7);
 assert.notEqual(JSON.stringify(other), reference);
 assert.deepEqual([other.metrics.arrived, other.metrics.goals, other.metrics.lost, other.metrics.conversion, other.metrics.tracked.sentiment!.mean],
  [342, 169, 167, 503, 4.717]);
 const long = journeyRun(shop, 5000, [100]), lm = long.metrics;
 assert.equal(long.minute, 5000);
 assert(lm.arrived > m.arrived * 4 && lm.goals > m.goals * 4 && lm.lost > m.lost * 4, 'counts keep growing');
 assert.deepEqual([lm.arrived, lm.completed, lm.goals, lm.lost, lm.conversion, lm.active, lm.tracked.sentiment!.mean], [1647, 1635, 806, 829, 493, 12, 4.622]);
 assert(lm.conversion! >= 100 && lm.conversion! <= 600);
});
test('User journey app onboarding runs steady random users through system steps, timers and counters with exact outcomes', () => {
 const app = journeyFile('user-journey-app-onboarding'); journeyAdmitted(app, 'user-journey', 20261002, ['subscriber', 'free-user', 'gave-up', 'churned']);
 assert.deepEqual(app.track, [{field: 'sentiment', label: 'Sentiment'}, {field: 'sessions', label: 'Sessions'}]);
 assert.equal(app.arrivals[0]!.gap!.dist, 'uniform');
 assert.deepEqual(app.resources.map(r => [r.id, r.kind]), [['support', 'people'], ['notifications', 'system'], ['verification', 'system']]);
 assert.deepEqual(new Set(app.steps.map(x => x.phase)), new Set(['Discover', 'Sign up', 'Onboard', 'Activate', 'Retain', 'Monetise']));
 assert.deepEqual(app.steps.filter(x => x.kind === 'system').map(x => x.id), ['verify-email']);
 assert.deepEqual(app.steps.filter(x => x.kind === 'timer').map(x => x.id), ['click-link', 'day-one-wait', 'week-wait']);
 const whole = journeyRun(app, 1000, [1000]); const m = whole.metrics; assert.equal(whole.seed, 20261002);
 assert.deepEqual([m.arrived, m.completed, m.failed, m.dropped, m.active, m.goals, m.lost, m.conversion], [207, 172, 0, 0, 35, 46, 126, 267]);
 assert(m.conversion! >= 100 && m.conversion! <= 600, 'conversion reads realistically');
 assert.deepEqual(m.tracked.sentiment, {label: 'Sentiment', n: 172, mean: 6.244, min: 1, max: 11});
 assert.deepEqual(m.tracked.sessions, {label: 'Sessions', n: 172, mean: 1.721, min: 0, max: 4}, 'the sessions counter bounds the weekly loop at four');
 assert.deepEqual(['install', 'method', 'social-signup', 'email-form', 'verify-email', 'permissions', 'limited-notice', 'first-task', 'weekly', 'offer',
  'subscriber', 'free-user', 'gave-up', 'churned'].map(id => step(whole, id).reached), [207, 205, 81, 124, 110, 190, 49, 190, 70, 46, 3, 43, 14, 112]);
 assert.deepEqual([step(whole, 'verify-email').entered, step(whole, 'weekly').entered], [122, 177]);
 assert(step(whole, 'weekly').entered > step(whole, 'weekly').reached, 'the weekly loop re-enters');
 assert.deepEqual(whole.resources.map(r => [r.id, r.busyMinutes]), [['support', 87], ['notifications', 289], ['verification', 122]]);
 assert.equal(step(whole, 'verify-email').completed, 122);
 assert(whole.receipts.filter(r => r.stepId === 'day-one-wait').every(r => r.duration! >= 15 && r.duration! <= 25),
  'day-1 waits are timers with a bounded random duration');
 assert(whole.receipts.filter(r => r.stepId === 'click-link').length > 0
  && whole.cases.every(c => typeof c.input.source === 'string' && typeof c.input.device === 'string'));
 const reference = JSON.stringify(whole);
 assert.equal(JSON.stringify(journeyRun(app, 1000, [1])), reference);
 assert.equal(JSON.stringify(journeyRun(app, 1000, [7, 33, 250])), reference);
 const other = journeyRun(app, 1000, [1000], {horizon: null, seed: 7});
 assert.equal(other.seed, 7);
 assert.notEqual(JSON.stringify(other), reference);
 assert.deepEqual([other.metrics.arrived, other.metrics.goals, other.metrics.lost, other.metrics.conversion, other.metrics.tracked.sessions!.mean],
  [207, 59, 119, 331, 1.882]);
 const long = journeyRun(app, 5000, [100]), lm = long.metrics;
 assert.equal(long.minute, 5000);
 assert(lm.arrived > m.arrived * 4 && lm.goals > m.goals * 4 && lm.lost > m.lost * 4, 'counts keep growing');
 assert.deepEqual([lm.arrived, lm.completed, lm.goals, lm.lost, lm.conversion, lm.active, lm.tracked.sentiment!.mean, lm.tracked.sessions!.mean],
  [1015, 987, 379, 608, 384, 28, 6.588, 2.064]);
 assert(lm.conversion! >= 100 && lm.conversion! <= 600);
});
test('SIPOC description validates strictly and never changes a run', () => {
 const base = journey(), described = journey({sipoc: {suppliers: [{name: 'Warehouse', supplies: 'Stock'}, {name: 'Ad agency'}],
  customers: [{name: 'Shopper', receives: 'Parcel'}]}});
 assert.equal(JSON.stringify(full(described)), JSON.stringify(full(base)));
 assert.equal(JSON.stringify(full(described, [3, 40, 1557])), JSON.stringify(full(base)));
 assert.notEqual(catalog.fingerprint(described), catalog.fingerprint(base)); assert.equal(catalog.validate(journey({sipoc: {}})).ok, true);
 const bad = (sipoc: unknown) => {
  const v = catalog.validate({...copy(base), sipoc} as LWProcess.Definition);
  assert.equal(v.ok, false);
  return v.diagnostics.map(x => x.path + ' ' + x.message).join('|');
 };
 assert.match(bad({vendors: []}), /\/sipoc/);
 assert.match(bad({suppliers: [{name: 'A', receives: 'x'}]}), /\/sipoc/);
 assert.match(bad({suppliers: [{name: 'x'.repeat(61)}]}), /\/sipoc\/suppliers\/0\/name/);
 assert.match(bad({customers: [{name: 'A', receives: 'x'.repeat(161)}]}), /\/sipoc\/customers\/0\/receives/);
 assert.match(bad({suppliers: [{name: ''}]}), /\/sipoc\/suppliers\/0\/name/);
 const nine = Array.from({length: 9}, (_, i) => ({name: 'P' + i}));
 assert.match(bad({suppliers: nine}), /\/sipoc\/suppliers/);
 assert.match(bad({customers: nine}), /\/sipoc\/customers/);
 assert.equal(catalog.validate(journey({sipoc: {suppliers: nine.slice(0, 8)}})).ok, true);
 assert.match(bad({suppliers: [{name: 'A'}, {name: 'B'}, {name: 'A'}]}), /\/sipoc\/suppliers\/2\/name/);
 assert.match(bad({customers: [{name: 'C'}, {name: 'C'}]}), /\/sipoc\/customers\/1\/name/);
 assert.equal(catalog.validate(journey({sipoc: {suppliers: [{name: 'Same'}], customers: [{name: 'Same'}]}})).ok, true);
});
