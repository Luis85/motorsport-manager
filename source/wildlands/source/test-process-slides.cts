/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-slides-contracts.d.ts" />
/** Slide model checks: demo coverage, pinned decks, an exact small fixture, determinism and detachment, and the shared SIPOC main route. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {catalog, runtime, slides} from './process-sdk.cjs';
import {test, copy, stepOf, flowOf} from './test-process-helpers.cjs';
import {claims, demos} from './test-process-slides-fixtures.cjs';
require('./process-renderer-sipoc.js');
const sipoc = (globalThis as unknown as {LWProcessSipoc: {model(d: LWProcess.Definition, q: LWProcess.Snapshot): unknown}}).LWProcessSipoc;
const route = (globalThis as unknown as {LWProcessRoute: LWProcessRoute.Api}).LWProcessRoute;

const sha = (text: string) => createHash('sha256').update(text).digest('hex');
/** Pinned LWProcessSipoc.model JSON of the seven demos (see the SIPOC check). */
const SIPOC_LENGTH = 41578, SIPOC_SHA = '6c1f38b83644cf1107b871161050ab2d0d4479a2b744e7ecff72cfc8ba1c743e';
const seeded = (d: LWProcess.Definition, minutes: number, seed: number) => { const s = runtime.create(d, {seed}); try { return s.advance(minutes); } finally { s.dispose(); } };
const deepFreeze = <T,>(v: T): T => { if (v && typeof v === 'object') { for (const x of Object.values(v)) deepFreeze(x); Object.freeze(v); } return v; };
/** A small claims desk: an interrupting deadline, a decision with a chance route, a parallel fork with a timer branch and three phases. */

test('Slides cover every demo step on exactly one step slide in contiguous, non-empty sections', () => {
 assert.equal(demos.length, 7);
 for (const [file, d] of demos) {
  const deck = slides.build(d), stepSlides = deck.slides.filter(s => s.kind === 'step');
  assert.deepEqual(stepSlides.map(s => s.step).sort(), d.steps.map(s => s.id).sort(), file + ': every step exactly once');
  assert(stepSlides.every(s => s.id === 'step-' + s.step), file);
  assert.equal(new Set(deck.slides.map(s => s.id)).size, deck.slides.length, file + ': unique slide ids');
  let at = 0;
  for (const section of deck.sections) {
   assert(section.count > 0, `${file}: section ${section.id} is not empty`); assert.equal(section.first, at, file); at += section.count;
   assert(deck.slides.slice(section.first, section.first + section.count).every(s => s.section === section.id), `${file}: ${section.id} owns its slides`);
  }
  assert.equal(at, deck.slides.length, file + ': sections cover every slide');
  assert.deepEqual([deck.sections[0]!.id, deck.sections.at(-1)!.id, deck.slides.slice(0, 3).map(s => s.kind), deck.slides.at(-1)!.kind], ['intro', 'summary', ['title', 'overview', 'resources'], 'summary'], file);
  assert(deck.slides.every(s => s.blocks.every(b => b.items.length > 0) && s.live === null), file + ': no empty blocks and no live facts without a snapshot');
  assert.equal(deck.format, 'wildlands-process-slides'); assert.equal(deck.schemaVersion, 1); assert.deepEqual(deck.process, {id: d.id, name: d.name, genre: d.genre ?? 'process', revision: d.revision});
 }
});

test('No bundled agency deck shows the "No description authored." placeholder on any slide or in its Markdown', () => {
 const placeholder = 'No description authored.';
 for (const [file, d] of demos) {
  assert.deepEqual(d.steps.filter(s => !s.description?.trim()).map(s => s.id), [], file + ': every step has a description');
  const deck = slides.build(d), missing = deck.slides.filter(s => JSON.stringify(s).includes(placeholder)).map(s => s.id);
  assert.deepEqual(missing, [], file + ': slides with the placeholder lead');
  assert(!slides.markdown(deck).includes(placeholder), file + ': Markdown export has no placeholder');
 }
});

const PINNED: Record<string, [number, string[], string[]]> = {
 'agency.process.json': [22, ['intro', 'phase-1', 'phase-2', 'phase-3', 'phase-4', 'phase-5', 'variants', 'summary'], ['Agency delivery lab', 'Overview', 'Resources', 'Discover', 'Project intake', 'Discovery', 'Design', 'Plan together', 'Product design', 'Technical design', 'Ready to build', 'Build', 'Implementation', 'Quality review', 'Review', 'Accepted?', 'Handover', 'Client handover', 'Delivered', 'Variants and other paths', 'Resolve findings', 'Summary']],
 'agile-vendor.process.json': [36, ['intro', 'phase-1', 'phase-2', 'phase-3', 'phase-4', 'phase-5', 'phase-6', 'variants', 'summary'], ['Agile vendor project', 'Overview', 'Resources', 'Initiate', 'Engagement won', 'Contractual kickoff date (not before)', 'Milestone 1 · Kickoff', 'Discovery with the customer', 'Plan', 'Plan together', 'Product design', 'Architecture runway', 'Product backlog ready', 'Milestone 2 · Roadmap agreed', 'Iterate', 'Iteration planning', 'Iteration', 'CI build and tests', 'Customer review window', 'Iteration retrospective', 'More iterations in this release?', 'Accept', 'Automated regression suite', 'Release acceptance testing (UAT)', 'UAT result', 'Release', 'Milestone · Release go-live', 'Automated deployment', 'Hypercare window', 'More releases?', 'Close', 'Final acceptance and handover', 'Project closed', 'Variants and other paths', 'Fix acceptance findings', 'Summary']],
 'customer-journey-webshop.process.json': [34, ['intro', 'phase-1', 'phase-2', 'phase-3', 'phase-4', 'phase-5', 'variants', 'summary'], ['Customer journey · Online shop', 'Overview', 'Resources', 'Awareness', 'Shopper sees an ad', 'Ad touchpoint', 'Searches and lands on the shop', 'Consideration', 'Browses products', 'Reads product reviews', 'Interested?', 'Purchase', 'Reviews cart and shipping cost', 'Cart abandoned?', 'Fills in the checkout form', 'Pays online', 'Payment failed?', 'Delivery', 'Receives the order confirmation email', 'Waits for the parcel', 'Unboxes the order', 'Problem with the order?', 'After-sales and loyalty', 'Receives the review request email', 'Comes back to buy again?', 'Happy customer', 'Variants and other paths', 'Left without buying', 'Chats with support about the payment', 'Calls support to return or exchange', 'Loyal repeat buyer', 'Payment solved?', 'Gave up on paying', 'Summary']],
 'delivery-release.process.json': [36, ['intro', 'phase-1', 'phase-2', 'phase-3', 'phase-4', 'phase-5', 'phase-6', 'variants', 'summary'], ['Weekly delivery and release train', 'Overview', 'Resources', 'Inception (0.1.0)', 'Product idea approved', 'Inception: vision, MVP scope and first backlog', 'Build the Hello World skeleton', 'Release 0.1.0: Hello World skeleton', 'Refine and plan', 'Weekly backlog refinement', 'Iteration planning', 'Iterate', 'Iteration runs', 'Implement the committed items', 'CI: build, test and merge', 'Daily stand-up and iteration day', 'Iteration closed', 'Review and retro', 'Weekly review with stakeholders', 'Stakeholder feedback', 'Weekly retrospective', 'Release 0.x.0', 'Release checks needed?', 'UX acceptance on staging', 'Rehearse the data migration', 'Release candidate ready', 'Release pipeline: tag 0.x.0 and deploy', 'MVP scope released?', 'MVP 1.0.0', 'Launch 1.0.0 (MVP)', '1.0.0 MVP live', 'Variants and other paths', 'Raise the impediment and swarm', 'Add the feedback to the MVP backlog', 'Impediment handled', 'Summary']],
 'loan-application.process.json': [30, ['intro', 'phase-1', 'phase-2', 'phase-3', 'phase-4', 'variants', 'summary'], ['Loan application (BPMN import)', 'Overview', 'Resources', 'Application', 'Application received', 'Submit application', 'Document check', 'Verify document', 'Archive documents', 'Fraud screening', 'Run fraud rules', 'Match watch lists', 'Credit decision', 'Score credit', 'Risk level?', 'Manual review', 'Review outcome?', 'Send rejection letter', 'Application rejected', 'Variants and other paths', 'Sign contract', 'Additional checks', 'Notify supervisor', 'Disburse funds', 'Verify income', 'Check employer', 'Checks done', 'SLA breach logged', 'Loan paid out', 'Summary']],
 'order-fulfilment.process.json': [23, ['intro', 'phase-1', 'phase-2', 'phase-3', 'phase-4', 'variants', 'summary'], ['Order fulfilment line', 'Overview', 'Resources', 'Order', 'Order received', 'Validate order', 'Fraud check', 'Prepare', 'Prepare in parallel', 'Pick items', 'Shipping documents', 'Ready to pack', 'Pack', 'Pack', 'Spot-check', 'Passed?', 'Ship', 'Label parcel', 'Notify customer', 'Delivered', 'Variants and other paths', 'Repack', 'Summary']],
 'user-journey-app-onboarding.process.json': [43, ['intro', 'phase-1', 'phase-2', 'phase-3', 'phase-4', 'phase-5', 'phase-6', 'variants', 'summary'], ['User journey · App onboarding', 'Overview', 'Resources', 'Discover', 'New user finds the app', 'Installs the app', 'Opens the app for the first time', 'Sign up', 'Sign-up method', 'Fills in the email form', 'Gives up the form?', 'Verify email', 'User clicks the link', 'Link works?', 'Onboard', 'Sees the permissions prompt', 'Reduced experience?', 'Sets up a profile', 'Takes the product tour?', 'Follows the product tour', 'Activate', 'Completes the first task', 'Retain', 'Waits until day 1', 'Receives the day-1 push reminder', 'Returns on day 2?', 'Uses the app in a weekly session', 'Used four times?', 'Monetise', 'Sees the upgrade offer', 'Subscribe?', 'Free active user', 'Variants and other paths', 'Signs up with a social account', 'Abandoned sign-up', 'Asks support chat for a new link', 'Sees the limited-mode notice', 'Churned after day 1', 'Waits until the next week', 'Subscribes on the web checkout', 'Receives the weekly digest', 'Subscriber', 'Summary']],
};
test('Slides pin the deck length, sections and ordered titles of every demo', () => {
 assert.deepEqual(demos.map(([file]) => file), Object.keys(PINNED));
 for (const [file, d] of demos) {
  const deck = slides.build(d), [count, sections, titles] = PINNED[file]!;
  assert.deepEqual([deck.slides.length, deck.sections.map(s => s.id), deck.slides.map(s => s.title)], [count, sections, titles], file);
 }
 const train = slides.build(demos.find(([file]) => file === 'delivery-release.process.json')![1]), at = (id: string) => train.slides.find(s => s.id === id)!;
 assert.deepEqual(at('step-build').concepts.map(c => c.id), ['multi-instance-parallel', 'deadline-escalate']); assert.deepEqual(at('step-mvp-check').concepts.map(c => c.id), ['decision', 'counter-loop']);
 assert.deepEqual(at('step-feedback').concepts.map(c => c.id), ['decision', 'chance-route']); assert.deepEqual(at('step-release-prep').concepts.map(c => c.id), ['inclusive-gateway']);
 assert.deepEqual(['step-impediment', 'step-reprioritise', 'step-impediment-handled'].map(id => at(id).subtitle), ['Task · Deadline path from “Implement the committed items”', 'Task · Decision alternative from “Stakeholder feedback”', 'End · Other end from “Raise the impediment and swarm”']);
 assert(at('title').blocks.some(b => b.heading === 'About the values'), 'the description says the values are synthetic');
 // The 259-word description is clamped to whole sentences of at most 60 words on the title slide and follows in full below.
 const description = demos.find(([file]) => file === 'delivery-release.process.json')![1].description!, lead = at('title').lead;
 assert(lead.split(/\s+/).length <= 60 && description.startsWith(lead) && /[.!?]$/.test(lead), lead);
 assert.deepEqual(at('title').blocks.find(b => b.heading === 'Process description')!.items, [description]);
 assert.equal(slides.build(demos[0]![1]).slides[0]!.lead, demos[0]![1].description, 'a short description is the whole lead, with no extra block');
 assert(!slides.build(demos[0]![1]).slides[0]!.blocks.some(b => b.heading === 'Process description'));
 assert(at('title').blocks.find(b => b.heading === 'How to read this deck')!.items.some(item => item.startsWith('Times are simulated business minutes (min)')));
 // Section slides count steps between the start and the end, as the overview's SIPOC stages do.
 const overview = train.slides[1]!.blocks.find(b => b.heading === 'Process')!.items;
 assert.equal(overview[0], 'Inception (0.1.0): 3 steps on the main route');
 assert.match(at('section-phase-1').lead, /^3 steps on the main route, from .* after the start “Product idea approved”\.$/);
 assert(!slides.build({...copy(demos[0]![1]), description: 'Plain words.'}).slides[0]!.blocks.some(b => b.heading === 'About the values'));
 const shop = slides.build(demos.find(([file]) => file === 'customer-journey-webshop.process.json')![1]);
 assert.equal(shop.slides[1]!.subtitle, 'Journey map: phases and touchpoints'); assert.equal(shop.slides.find(s => s.id === 'step-ad')!.blocks.at(-1)!.heading, 'Customer experience');
});

test('Slides explain a small fixture with a chance route, fork, deadline and timer in exact Markdown and JSON', () => {
 const d = claims(); assert.equal(catalog.validate(d).ok, true, JSON.stringify(catalog.validate(d).diagnostics));
 const deck = slides.build(d), text = slides.markdown(deck), golden = fs.readFileSync(path.join(__dirname, 'fixtures/process-slides-small-claims.md'), 'utf8');
 assert.equal(text, golden); assert(text.endsWith('\n') && !text.endsWith('\n\n'));
 assert.equal(sha(JSON.stringify(deck)), '97f58a20f8158e623e2e3968153fcfb222a3a7463c927811ae873db2ac31ed2c');
 assert.deepEqual(deck.sections.map(s => [s.id, s.kind, s.title, s.first, s.count]), [['intro', 'intro', 'Introduction', 0, 3], ['phase-1', 'phase', 'Intake', 3, 3], ['phase-2', 'phase', 'Decide', 6, 2], ['phase-3', 'phase', 'Payout', 8, 6], ['variants', 'variants', 'Variants and other paths', 14, 3], ['summary', 'summary', 'Summary', 17, 1]]);
 assert.deepEqual(deck.slides.map(s => s.step), [null, null, null, 'start', 'start', 'check', 'decide', 'decide', 'split', 'split', 'pay', 'cooling', 'joined', 'end', null, 'supervisor', 'rejected', null]);
 assert.deepEqual(deck.slides.find(s => s.id === 'step-decide')!.blocks.at(-1), {heading: 'Where it goes next', items: ['20% of cases take this path → “Claim rejected” (“Not covered”)', 'Otherwise (no condition) → “Pay and wait”, main route']});
});

test('Slides are deterministic, detached from frozen inputs and carry live facts only with a snapshot', () => {
 const d = deepFreeze(claims()), q = deepFreeze(seeded(claims(), 120, 4)), before = JSON.stringify([d, q]);
 const a = slides.build(d, q), b = slides.build(d, q);
 assert.equal(JSON.stringify(a), JSON.stringify(b)); assert.equal(slides.markdown(a), slides.markdown(b)); assert.equal(JSON.stringify([d, q]), before);
 assert.deepEqual(a.live, {minute: q.minute, seed: 4, status: q.status});
 // The run completed, so the waiting time is a total, not 'so far'; the heading names the unit.
 assert.equal(q.status, 'completed');
 assert.deepEqual(a.slides.find(s => s.id === 'step-joined')!.live, {heading: `One simulated run · business minute ${q.minute} · seed 4`,
  items: ['Entered 6 times by 3 cases', 'Completed 3 times', 'Now: 0 working, 0 waiting', 'Waiting time: 0 min in total']});
 const withLive = new Set(['title', 'resources', 'step', 'summary']);
 assert(a.slides.filter(s => withLive.has(s.kind)).every(s => s.live !== null) && a.slides.filter(s => !withLive.has(s.kind)).every(s => s.live === null));
 // Title 'Key results', the resources slide's pool utilisation and the summary name the most utilised pool and both costs.
 const pct = Math.round(q.resources[0]!.utilization * 100), at = (id: string) => a.slides.find(s => s.id === id)!.live!;
 assert.equal(at('title').heading, `Key results · One simulated run · business minute ${q.minute} · seed 4`);
 const busiest = `Most utilised pool: Claims clerks, ${pct}% on average since minute 0`;
 const cycle = `Mean cycle time: ${Math.round(q.metrics.meanCycleMinutes * 10) / 10} min`;
 assert.deepEqual(at('title').items, ['Run status: completed', 'Cases arrived: 3; completed: 3', cycle, `Work cost: ${q.metrics.cost} units`, busiest]);
 const busy = q.resources[0]!.busyMinutes;
 // A people pool's units are working (machine and system units are running), as on the studio's cards.
 const pool = `Claims clerks: ${pct}% average utilisation since minute 0, busy ${busy} min in total; 0 of 2 working now; 0 waiting at its steps`;
 assert.deepEqual(at('resources').items, [pool]);
 assert.deepEqual(at('summary').items.slice(-3), [`Work cost: ${q.metrics.cost} units`, `Capacity cost: ${2 * 1 * q.minute} units`, busiest]);
 assert.equal(q.metrics.capacityCost, 2 * 1 * q.minute, 'capacity cost charges both clerks for every minute');
 // A run with nothing finished says so instead of a 0 min mean cycle, and gives the mean age of the cases in progress.
 const early = seeded(claims(), 5, 4), first = slides.build(d, early).slides.find(s => s.id === 'summary')!.live!.items;
 assert.equal(early.metrics.completed, 0); assert(first.includes('Mean cycle time: none yet, no case has finished'), first.join('|'));
 assert(first.includes(`Mean age of the cases in progress: ${early.metrics.meanAgeMinutes} min`), first.join('|'));
 assert(first.includes('Run status: still running'));
 // The command-line tip is for Markdown readers only: the deck model never carries it, the Markdown ends with it.
 assert(!JSON.stringify(a).includes('process slides'));
 assert.match(slides.markdown(a), /_Reproduce with the command line: `bin\/wildlands process slides --input FILE --minutes N`[^\n]*_\n$/);
 assert(a.slides.find(s => s.id === 'step-check')!.live!.items.includes('Deadlines fired: 0 interrupted, 0 escalated'));
 // Mutating the deck never reaches the inputs or a later deck, and nothing in the deck is shared with them.
 const seen = new Set<unknown>(); const walk = (v: unknown) => { if (v && typeof v === 'object') { seen.add(v); Object.values(v).forEach(walk); } }; walk(d); walk(q);
 const shared: unknown[] = []; const scan = (v: unknown) => { if (v && typeof v === 'object') { if (seen.has(v)) shared.push(v); Object.values(v).forEach(scan); } }; scan(a); assert.equal(shared.length, 0);
 a.slides[0]!.blocks[0]!.items.push('changed'); a.sections.length = 0; a.process.name = 'changed'; assert.equal(JSON.stringify(slides.build(d, q)), JSON.stringify(b));
 const plain = slides.build(d), live = slides.build(d, q), strip = (deck: LWProcessSlides.Deck) => JSON.stringify({...deck, live: null, slides: deck.slides.map(s => ({...s, live: null}))});
 assert.equal(plain.live, null); assert.equal(strip(plain), strip(live)); assert.equal(slides.build(d, null).live, null);
});

test('SIPOC model is pinned for every demo, counts cases per stage and shares the LWProcessRoute main route with the slides', () => {
 // LWProcessSipoc.model for the 7 demos at minute 0 and after 1,440 minutes with seed 7. First pinned when the main route moved into
 // LWProcessRoute; re-pinned when stages began to count cases that left them, inputs dropped internal counters and need-condition labels,
 // and the measures gained '—' before a case finishes, the mean age in progress, work cost and capacity cost.
 const runs = demos.map(([file, d]) => {
  const s = runtime.create(d, {seed: 7});
  try { const q0 = s.query(), q1 = s.advance(1440); return [file, d, q1, sipoc.model(d, q0), sipoc.model(d, q1)] as const; } finally { s.dispose(); }
 });
 const text = JSON.stringify(Object.fromEntries(runs.map(([file, , , m0, m1]) => [file, [m0, m1]])));
 assert.equal(text.length, SIPOC_LENGTH); assert.equal(sha(text), SIPOC_SHA);
 const of = (file: string) => runs.find(r => r[0] === file)!, model = (file: string) => of(file)[4] as LWProcessSipoc.Model;
 for (const [file, , q, , m] of runs) {
  const stages = (m as LWProcessSipoc.Model).stages;
  assert(stages.every(s => s.completed <= q.metrics.arrived), file + ': a stage never counts more cases than arrived');
 }
 // Order fulfilment: the stage after 1,440 minutes counted cases (step completions summed to far more than the orders that arrived).
 const order = of('order-fulfilment.process.json'), prepare = model('order-fulfilment.process.json').stages.find(s => s.name === 'Prepare')!;
 assert.equal(prepare.completed, order[2].steps.find(s => s.id === 'pack')!.reached, 'Prepare is left by the orders that reached Pack');
 const fields = model('order-fulfilment.process.json').inputs.map(i => i.field);
 assert.deepEqual(fields, ['priority', 'defect'], 'counters seeded at 0 and added to are internal state');
 // Agency: a need that tests 'needsRework eq false' does not name the field, and the example lists every arrival value.
 const rework = model('agency.process.json').inputs.find(i => i.field === 'needsRework')!;
 assert.deepEqual([rework.label, rework.example], ['needsRework', 'false, true']);
 assert(model('delivery-release.process.json').inputs.some(i => i.field === 'mvpIncrements'), 'a drawn field stays an input although a step adds to it');
 // Delivery release has not finished a case after 1,440 minutes: mean cycle is '—' and the mean age of the one case in progress is shown.
 const measures = Object.fromEntries(model('delivery-release.process.json').measures.map(x => [x.id, x.value]));
 const trainCost = String(of('delivery-release.process.json')[2].metrics.cost);
 assert.deepEqual([measures.cycle, measures.age, measures.cost, measures['capacity-cost']], ['—', '1,440 min (≈ 24 h)', trainCost, '27360']);
 // Loan: the SLA escalation path ends at its own end while the application carries on, so it is not a second way out of the stage.
 const loan = of('loan-application.process.json'); assert.equal(model('loan-application.process.json').stages.at(-1)!.completed, loan[2].metrics.completed);
 for (const [file, d] of demos) {
  const walk = route.walk(d), deck = slides.build(d);
  assert.deepEqual(walk.units.flat().map(s => s.id), walk.path.filter(s => s.kind !== 'start' && s.kind !== 'end').map(s => s.id), file + ': units and path agree');
  assert.deepEqual(deck.slides.filter(s => s.kind === 'step' && s.section !== 'variants').map(s => s.step), walk.path.map(s => s.id), file + ': slides follow the SIPOC main route');
 }
});
