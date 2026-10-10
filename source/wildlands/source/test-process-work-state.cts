/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-slides-contracts.d.ts" />
/// <reference path="./process-work-state.ts" />
/// <reference path="./process-time.ts" />
/**
 * One wording for live work and durations across the slide deck and the SIPOC view: the studio's work-state words
 * (LWProcessWorkState: working or running, waiting = queued minus held, blocked = held) and the display calendar's business days
 * and weeks (LWProcessTime.span). Demos without a calendar keep their exact wording (their decks and SIPOC model stay pinned in
 * test-process-route.cts and test-process-slides.cts).
 */
import assert from 'node:assert/strict';
import {runtime, slides} from './process-sdk.cjs';
import {test, copy} from './test-process-helpers.cjs';
import {claims, demos} from './test-process-slides.cjs';
require('./process-renderer-sipoc.js');
const sipoc = (globalThis as unknown as {LWProcessSipoc: {model(d: LWProcess.Definition, q: LWProcess.Snapshot): LWProcessSipoc.Model}}).LWProcessSipoc;
const work = (globalThis as unknown as {LWProcessWorkState: LWProcessWorkState.Api}).LWProcessWorkState;
const time = (globalThis as unknown as {LWProcessTime: LWProcessTime.Api}).LWProcessTime;
const seeded = (d: LWProcess.Definition, minutes: number, seed: number) => {
 const s = runtime.create(d, {seed});
 try { return s.advance(minutes); } finally { s.dispose(); }
};
const demo = (file: string) => demos.find(([name]) => name === file)![1];
const live = (deck: LWProcessSlides.Deck, id: string) => deck.slides.find(s => s.id === id)!.live!.items;
const OLD_WORDS = /Now in progress|now waiting|busy now|blocked after finishing/;

test('Work-state words follow the studio in slides and SIPOC stages: working or running, waiting is queued minus held, blocked is held', () => {
 assert.deepEqual([work.verb('task'), work.verb('touchpoint'), work.verb('machine'), work.verb('system'), work.verb('timer')],
  ['working', 'working', 'running', 'running', 'working']);
 const none = {working: 0, running: 0, waiting: 0, blocked: 0, people: false, machines: false};
 assert.deepEqual(work.parts(none), ['0 working', '0 waiting'], 'a scope without work steps still says working and waiting');
 assert.deepEqual(work.parts({...none, running: 2, machines: true}), ['2 running', '0 waiting'], 'machines only: no working');
 assert.deepEqual(work.parts({working: 1, running: 2, waiting: 1200, blocked: 1, people: true, machines: true}, time.number),
  ['1 working', '2 running', '1,200 waiting', '1 blocked']);
 // Order fulfilment has people, machine and system steps: every step slide says its work now as the studio does.
 const d = demo('order-fulfilment.process.json'), q = seeded(d, 240, 7), deck = slides.build(d, q), metrics = new Map(q.steps.map(m => [m.id, m]));
 let running = 0;
 for (const s of d.steps) {
  const m = metrics.get(s.id)!, t = work.tally(d, q, [s.id]), held = m.held ?? 0;
  assert.deepEqual([t.working + t.running, t.waiting, t.blocked], [m.active, m.queued - held, held], s.id);
  assert.equal(t.running, s.kind === 'machine' || s.kind === 'system' ? m.active : 0, s.id + ': machine and system work is running');
  const now = `Now: ${work.parts(t, time.number).join(', ')}${held ? ' (blocked: waiting for room in the next backlog)' : ''}`;
  assert(live(deck, 'step-' + s.id).includes(now), `${s.id}: ${live(deck, 'step-' + s.id).join('|')}`);
  running += t.running;
 }
 assert(running > 0, 'the run has machine or system work in progress at minute 240');
 // Key results and the summary add the work at every step while cases are in progress; the resources slide words pool units by kind.
 assert(q.metrics.active > 0);
 const atSteps = `Now at the steps: ${work.parts(work.tally(d, q), time.number).join(', ')}`;
 assert(live(deck, 'title').includes(atSteps) && live(deck, 'summary').includes(atSteps), atSteps);
 const pools = live(deck, 'resources');
 for (const r of d.resources) {
  const line = pools.find(item => item.startsWith(r.name + ': '))!;
  assert.match(line, (r.kind ?? 'people') === 'people' ? / of \d+ working now; / : / of \d+ running now; /, line);
 }
 // A finished run has no work at the steps, so the key results stay short.
 const done = seeded(claims(), 600, 4), finished = slides.build(claims(), done);
 assert.equal(done.status, 'completed'); assert(!live(finished, 'title').some(item => item.startsWith('Now at the steps')));
 // SIPOC stages sum the same rule, and no live deck of a demo keeps the old wording.
 for (const [file, def] of demos) {
  const later = seeded(def, 1440, 7);
  for (const stage of sipoc.model(def, later).stages) {
   const t = work.tally(def, later, stage.stepIds);
   assert.deepEqual([t.working + t.running, t.waiting, t.blocked], [stage.active, stage.queued, stage.held], `${file}: ${stage.name}`);
  }
  assert.doesNotMatch(JSON.stringify(slides.build(def, later)), OLD_WORDS, file);
 }
});

test('Display calendar words slide and SIPOC durations in business days and weeks; without one the wording is unchanged', () => {
 const CALENDAR: LWProcess.Calendar = {minutesPerDay: 480, daysPerWeek: 5};
 const plain = claims(), cooling = plain.steps.find(s => s.id === 'cooling')!, pay = plain.steps.find(s => s.id === 'pay')!;
 cooling.duration = 2400; pay.duration = 960;
 const dated = {...copy(plain), calendar: CALENDAR} as LWProcess.Definition, block = (deck: LWProcessSlides.Deck, id: string, heading: string) =>
  deck.slides.find(s => s.id === id)!.blocks.find(b => b.heading === heading)!.items;
 const a = slides.build(plain), b = slides.build(dated);
 assert.deepEqual([block(a, 'step-cooling', 'How it works')[0], block(b, 'step-cooling', 'How it works')[0]],
  ['Waits 2,400 min.', 'Waits 2,400 min (5 business days).']);
 assert.deepEqual([block(a, 'step-pay', 'How long')[0], block(b, 'step-pay', 'How long')[0]], ['Takes 960 min.', 'Takes 960 min (2 business days).']);
 assert.deepEqual([block(a, 'step-check', 'How long')[0], block(b, 'step-check', 'How long')[0]], ['Takes 10 min.', 'Takes 10 min.'],
  'shorter than a business day: exactly minutes');
 const note = 'This process counts 480 min as one business day and 5 business days as one business week, '
  + 'so times of one business day or more also show business days or weeks.';
 assert.deepEqual([block(a, 'title', 'How to read this deck').includes(note), block(b, 'title', 'How to read this deck').includes(note)], [false, true]);
 // Live facts and SIPOC measures: the same run reads in business days or weeks with the calendar and in minutes without it.
 const q = seeded(plain, 4000, 4), m = q.metrics;
 assert.equal(q.status, 'completed'); assert(m.meanCycleMinutes > 2400, 'a case takes more than one business week');
 const cycle = (deck: LWProcessSlides.Deck) => live(deck, 'summary').find(item => item.startsWith('Mean cycle time: '));
 assert.deepEqual([cycle(slides.build(plain, q)), cycle(slides.build(dated, q))],
  [`Mean cycle time: ${time.minutes(m.meanCycleMinutes)}`, `Mean cycle time: ${time.span(m.meanCycleMinutes, CALENDAR)}`]);
 assert.match(cycle(slides.build(dated, q))!, /\(≈ 1 business week\)$/);
 const measure = (d: LWProcess.Definition) => sipoc.model(d, q).measures.find(x => x.id === 'cycle')!.value;
 assert.deepEqual([measure(plain), measure(dated)], [time.minutes(m.meanCycleMinutes), time.span(m.meanCycleMinutes, CALENDAR)]);
 const busy = (deck: LWProcessSlides.Deck) => live(deck, 'resources')[0]!;
 assert(busy(slides.build(dated, q)).includes(`busy ${time.span(q.resources[0]!.busyMinutes, CALENDAR)} in total`));
 // Only the duration words differ: removing the calendar gives back the plain deck byte for byte.
 const {calendar: _calendar, ...without} = dated;
 assert.equal(JSON.stringify(slides.build(without as LWProcess.Definition, q)), JSON.stringify(slides.build(plain, q)));
});
