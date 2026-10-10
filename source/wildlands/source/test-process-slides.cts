/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-slides-contracts.d.ts" />
/** Slide model checks: demo coverage, pinned decks, an exact small fixture, determinism and detachment, and the shared SIPOC main route. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {catalog, runtime, slides} from './process-sdk.cjs';
import {test, copy, stepOf, flowOf} from './test-process-helpers.cjs';
require('./process-renderer-sipoc.js');
const sipoc = (globalThis as unknown as {LWProcessSipoc: {model(d: LWProcess.Definition, q: LWProcess.Snapshot): unknown}}).LWProcessSipoc;
const route = (globalThis as unknown as {LWProcessRoute: LWProcessRoute.Api}).LWProcessRoute;

const CONTENT = path.resolve(__dirname, '../../../docs/concepts/agency-delivery/content');
export const demos = fs.readdirSync(CONTENT).filter(f => f.endsWith('.process.json')).sort().map(f => [f, JSON.parse(fs.readFileSync(path.join(CONTENT, f), 'utf8')) as LWProcess.Definition] as const);
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const seeded = (d: LWProcess.Definition, minutes: number, seed: number) => { const s = runtime.create(d, {seed}); try { return s.advance(minutes); } finally { s.dispose(); } };
const deepFreeze = <T,>(v: T): T => { if (v && typeof v === 'object') { for (const x of Object.values(v)) deepFreeze(x); Object.freeze(v); } return v; };
/** A small claims desk: an interrupting deadline, a decision with a chance route, a parallel fork with a timer branch and three phases. */
export function claims(): LWProcess.Definition {
 return {format: 'wildlands-process', schemaVersion: 1, revision: 1, seed: 3, id: 'small-claims', name: 'Small claims', description: 'A small claims desk used to check the slide model. All values are synthetic.', start: 'start',
  resources: [{id: 'clerks', name: 'Claims clerks', capacity: 2, costPerMinute: 1}],
  steps: [stepOf('start', 'start', {name: 'Claim received', phase: 'Intake'}, 0),
   stepOf('check', 'task', {name: 'Check the claim', phase: 'Intake', description: 'A clerk checks the claim form.', duration: 10, cost: 5, resources: {clerks: 1}, set: {checked: true}, deadline: {after: 15, mode: 'interrupt', flow: 'check-late'}}, 12),
   stepOf('supervisor', 'task', {name: 'Supervisor review', duration: 5, resources: {clerks: 1}, set: {checked: true}}, 24), stepOf('decide', 'decision', {name: 'Pay out?', phase: 'Decide'}, 36),
   stepOf('rejected', 'end', {name: 'Claim rejected'}, 48), stepOf('split', 'fork', {name: 'Pay and wait', phase: 'Payout', join: 'joined'}, 60),
   stepOf('pay', 'task', {name: 'Pay the claim', duration: 4, resources: {clerks: 1}, set: {paid: true}}, 72), stepOf('cooling', 'timer', {name: 'Cooling-off period', duration: 30}, 84),
   stepOf('joined', 'join', {name: 'Paid and closed'}, 96), stepOf('end', 'end', {name: 'Claim settled'}, 108)],
  flows: [flowOf('start', 'check'), flowOf('check', 'decide'), {id: 'check-late', from: 'check', to: 'supervisor', on: 'deadline'}, flowOf('supervisor', 'decide'),
   {id: 'decide-reject', from: 'decide', to: 'rejected', when: {chance: 20}, label: 'Not covered'}, flowOf('decide', 'split'), flowOf('split', 'pay'), flowOf('split', 'cooling'),
   flowOf('pay', 'joined'), flowOf('cooling', 'joined'), flowOf('joined', 'end')],
  arrivals: [{at: 0, count: 3, interval: 5, data: {}}]};
}

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
 assert(!slides.build({...copy(demos[0]![1]), description: 'Plain words.'}).slides[0]!.blocks.some(b => b.heading === 'About the values'));
 const shop = slides.build(demos.find(([file]) => file === 'customer-journey-webshop.process.json')![1]);
 assert.equal(shop.slides[1]!.subtitle, 'Journey map: phases and touchpoints'); assert.equal(shop.slides.find(s => s.id === 'step-ad')!.blocks.at(-1)!.heading, 'Customer experience');
});

test('Slides explain a small fixture with a chance route, fork, deadline and timer in exact Markdown and JSON', () => {
 const d = claims(); assert.equal(catalog.validate(d).ok, true, JSON.stringify(catalog.validate(d).diagnostics));
 const deck = slides.build(d), text = slides.markdown(deck), golden = fs.readFileSync(path.join(__dirname, 'fixtures/process-slides-small-claims.md'), 'utf8');
 assert.equal(text, golden); assert(text.endsWith('\n') && !text.endsWith('\n\n'));
 assert.equal(sha(JSON.stringify(deck)), '0942952b46f16aed254cb1b4ff5a9166df75e993f22722bf9ab5c6f7c06dd5aa');
 assert.deepEqual(deck.sections.map(s => [s.id, s.kind, s.title, s.first, s.count]), [['intro', 'intro', 'Introduction', 0, 3], ['phase-1', 'phase', 'Intake', 3, 3], ['phase-2', 'phase', 'Decide', 6, 2], ['phase-3', 'phase', 'Payout', 8, 6], ['variants', 'variants', 'Variants and other paths', 14, 3], ['summary', 'summary', 'Summary', 17, 1]]);
 assert.deepEqual(deck.slides.map(s => s.step), [null, null, null, 'start', 'start', 'check', 'decide', 'decide', 'split', 'split', 'pay', 'cooling', 'joined', 'end', null, 'supervisor', 'rejected', null]);
 assert.deepEqual(deck.slides.find(s => s.id === 'step-decide')!.blocks.at(-1), {heading: 'Where it goes next', items: ['20% of cases take this path → “Claim rejected” (“Not covered”)', 'Otherwise (no condition) → “Pay and wait”, main route']});
});

test('Slides are deterministic, detached from frozen inputs and carry live facts only with a snapshot', () => {
 const d = deepFreeze(claims()), q = deepFreeze(seeded(claims(), 120, 4)), before = JSON.stringify([d, q]);
 const a = slides.build(d, q), b = slides.build(d, q);
 assert.equal(JSON.stringify(a), JSON.stringify(b)); assert.equal(slides.markdown(a), slides.markdown(b)); assert.equal(JSON.stringify([d, q]), before);
 assert.deepEqual(a.live, {minute: q.minute, seed: 4, status: q.status});
 assert.deepEqual(a.slides.find(s => s.id === 'step-joined')!.live, {heading: `One simulated run · minute ${q.minute} · seed 4`, items: ['Entered 6 times by 3 cases', 'Completed 3 times', 'Now in progress: 0; now waiting: 0', 'Waiting time so far: 0 min in total']});
 assert(a.slides.filter(s => s.kind === 'step' || s.kind === 'summary').every(s => s.live !== null) && a.slides.filter(s => s.kind !== 'step' && s.kind !== 'summary').every(s => s.live === null));
 assert(a.slides.find(s => s.id === 'step-check')!.live!.items.includes('Deadlines fired: 0 interrupted, 0 escalated'));
 // Mutating the deck never reaches the inputs or a later deck, and nothing in the deck is shared with them.
 const seen = new Set<unknown>(); const walk = (v: unknown) => { if (v && typeof v === 'object') { seen.add(v); Object.values(v).forEach(walk); } }; walk(d); walk(q);
 const shared: unknown[] = []; const scan = (v: unknown) => { if (v && typeof v === 'object') { if (seen.has(v)) shared.push(v); Object.values(v).forEach(scan); } }; scan(a); assert.equal(shared.length, 0);
 a.slides[0]!.blocks[0]!.items.push('changed'); a.sections.length = 0; a.process.name = 'changed'; assert.equal(JSON.stringify(slides.build(d, q)), JSON.stringify(b));
 const plain = slides.build(d), live = slides.build(d, q), strip = (deck: LWProcessSlides.Deck) => JSON.stringify({...deck, live: null, slides: deck.slides.map(s => ({...s, live: null}))});
 assert.equal(plain.live, null); assert.equal(strip(plain), strip(live)); assert.equal(slides.build(d, null).live, null);
});

test('SIPOC model stays byte-identical after the main route moved into the shared LWProcessRoute', () => {
 // Pinned before the extraction: LWProcessSipoc.model for the 7 demos at minute 0 and after 1,440 minutes with seed 7.
 const models = Object.fromEntries(demos.map(([file, d]) => { const s = runtime.create(d, {seed: 7}); try { const q0 = s.query(), q1 = s.advance(1440); return [file, [sipoc.model(d, q0), sipoc.model(d, q1)]]; } finally { s.dispose(); } }));
 const text = JSON.stringify(models); assert.equal(text.length, 40242); assert.equal(sha(text), '08d7db73fa7bffc2380e869ec2373707d9bd24c50e1e118796f064d42f82850d');
 for (const [file, d] of demos) {
  const walk = route.walk(d), deck = slides.build(d);
  assert.deepEqual(walk.units.flat().map(s => s.id), walk.path.filter(s => s.kind !== 'start' && s.kind !== 'end').map(s => s.id), file + ': units and path agree');
  assert.deepEqual(deck.slides.filter(s => s.kind === 'step' && s.section !== 'variants').map(s => s.step), walk.path.map(s => s.id), file + ': slides follow the SIPOC main route');
 }
});
