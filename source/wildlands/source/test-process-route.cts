/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-slides-contracts.d.ts" />
/// <reference path="./process-route.ts" />
/**
 * The shared main-route walk (LWProcessRoute): one walker for the SIPOC view, the slide deck and the journey map, with the fork
 * rule as an explicit option. Moving the journey map's own walk into LWProcessRoute must change nothing: every demo deck and its
 * Markdown stay byte-identical (the SIPOC model keeps its pin in test-process-slides.cts) and the journey map's route of every
 * demo is the one it drew before.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {slides} from './process-sdk.cjs';
import {test} from './test-process-helpers.cjs';
import {claims, demos} from './test-process-slides-fixtures.cjs';
const route = (globalThis as unknown as {LWProcessRoute: LWProcessRoute.Api}).LWProcessRoute;
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
/** JSON of [file, deck, Markdown] for the seven demos without a snapshot, pinned before the journey map's walk moved here. */
const DECKS_LENGTH = 363938, DECKS_SHA = 'bd2d756d22516ff827ae6fe0ea33a750ac8c2b71d42a99acc84ddd304e0d7ba2';
/** The journey map's main route of every demo, as its own walk drew it before it used LWProcessRoute ('first-branch' forks). */
const JOURNEY_ROUTES: Record<string, string[]> = {
 'agency.process.json': ['intake', 'discovery', 'design-split', 'product-design', 'design-ready', 'implementation', 'qa', 'review-gate', 'handover',
  'delivered'],
 'agile-vendor.process.json': ['intake', 'kickoff-date', 'kickoff', 'discovery', 'plan-split', 'product-design', 'backlog-ready', 'roadmap',
  'sprint-planning', 'sprint', 'ci-build', 'sprint-review', 'retrospective', 'more-iterations', 'regression-suite', 'release-uat', 'uat-result',
  'release-go-live', 'auto-deploy', 'hypercare', 'more-releases', 'handover', 'closed'],
 'customer-journey-webshop.process.json': ['shopper-sees-ad', 'ad', 'landing', 'browse', 'reviews', 'interested', 'cart', 'cart-abandoned', 'checkout',
  'payment', 'payment-failed', 'confirmation', 'delivery', 'unboxing', 'problem', 'review-request', 'repeat', 'happy'],
 'delivery-release.process.json': ['idea', 'inception', 'skeleton', 'skeleton-release', 'refinement', 'planning', 'iteration', 'build', 'ci-checks',
  'iteration-done', 'review', 'feedback', 'retro', 'release-prep', 'release-ready', 'release-pipeline', 'mvp-check', 'mvp-launch', 'mvp-live'],
 'loan-application.process.json': ['start-received', 'task-submit', 'sub-docs-task-verify', 'sub-docs-task-archive', 'call-fraud-task-rules',
  'call-fraud-task-lists', 'task-score', 'gw-risk', 'task-review', 'gw-review', 'task-rejectnotice', 'end-rejected'],
 'order-fulfilment.process.json': ['order-received', 'validate-order', 'fraud-check', 'prepare', 'pick-items', 'ready-to-pack', 'pack', 'spot-check',
  'passed', 'label-parcel', 'notify-customer', 'delivered'],
 'user-journey-app-onboarding.process.json': ['new-user', 'install', 'first-open', 'method', 'email-form', 'form-gives-up', 'verify-email', 'click-link',
  'link-works', 'permissions', 'limited', 'profile', 'tour-skip', 'tour', 'first-task', 'day-one-wait', 'day-one-push', 'returns', 'weekly',
  'more-weeks', 'offer', 'subscribe', 'free-user'],
};
const ids = (steps: readonly LWProcess.Step[]) => steps.map(s => s.id);

test('Shared route walk keeps every demo deck byte-identical and gives the journey map its pinned first-branch route', () => {
 const text = JSON.stringify(demos.map(([file, d]) => { const deck = slides.build(d); return [file, deck, slides.markdown(deck)]; }));
 assert.equal(text.length, DECKS_LENGTH); assert.equal(sha(text), DECKS_SHA);
 assert.deepEqual(demos.map(([file]) => file), Object.keys(JOURNEY_ROUTES));
 for (const [file, d] of demos) {
  const walk = route.walk(d), before = JSON.stringify(d);
  assert.deepEqual(ids(route.mainRoute(d)), ids(walk.path), file + ': the default fork rule is the expanding walk');
  assert.deepEqual(ids(route.mainRoute(d, {forks: 'expand'})), ids(walk.path), file);
  assert.deepEqual(ids(route.mainRoute(d, {forks: 'first-branch'})), JOURNEY_ROUTES[file], file + ': the journey map route is unchanged');
  assert.equal(JSON.stringify(d), before, file + ': the walk never changes the definition');
 }
 // The two rules differ only at a fork: 'expand' walks every branch up to the join, 'first-branch' keeps the first branch only.
 const d = claims();
 assert.deepEqual(ids(route.mainRoute(d)), ['start', 'check', 'decide', 'split', 'pay', 'cooling', 'joined', 'end']);
 assert.deepEqual(ids(route.mainRoute(d, {forks: 'first-branch'})), ['start', 'check', 'decide', 'split', 'pay', 'joined', 'end']);
 assert.throws(() => route.mainRoute(d, {forks: 'all' as never}), /Unknown fork rule: all/);
});
