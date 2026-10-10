/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-kernel.ts" />
/// <reference path="./process-application.ts" />
/**
 * Engine fast-path checks of the business-process-readmodel suite (called by test-process-sweeps.cts; no result file of its own).
 *
 * The engine keeps an index of live tokens in id order (LWProcessKernel), groups joining tokens in one pass and caches the join
 * plan (LWProcessRouting), and steps the clock entity directly (LWProcessRuntime). These checks pin each against its reference:
 *  - the generated 128-step process of the scale suite (`verification/process-scale-models.ts`), advanced 10,000 minutes in one
 *    command, reproduces the SHA-256 of its snapshot, series, distributions and recent cases recorded with the engine before these
 *    fast paths (token lists rebuilt by a sorted world query, joins filtered per step, a queried scheduler step), and the same run
 *    in random chunks and through the application's Run to end gives exactly the same values;
 *  - the token index equals the world's sorted query after creations, an out-of-order id and removals.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {test, application} from './test-process-helpers.cjs';
import {reads, chunking} from './test-process-readmodel-helpers.cjs';
import {scaleProcess} from './verification/process-scale-models';
const root = globalThis as unknown as {LWECS: LWProcess.Ecs; LWProcessKernel: LWProcessKernel.Api};
/** Minutes run, and the SHA-256 of `{q, series, distributions, recent}` recorded with the reference engine (minute 9,054, completed). */
const MINUTES = 10000, REFERENCE = '2ee24238ce53f0fb0584ac6125269e346b6257eb3a6f152acaf41aef09fafde3';
const digest = (value: unknown) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function scaleChecks(): void {
 test('The generated 128-step process reproduces its reference run in one advance, in random chunks and through Run to end', () => {
  const d = scaleProcess(), whole = reads(d, [MINUTES]);
  assert.deepEqual([whole.q.minute, whole.q.status, whole.q.metrics.completed], [9054, 'completed', 300]);
  assert.equal(digest(whole), REFERENCE, 'the reference engine result');
  for (const seed of [1, 2]) assert.deepEqual(reads(d, chunking(MINUTES, seed * 104729, 1440)), whole, 'chunking ' + seed);
  const app = application.create(d);
  try {
   app.horizon(MINUTES);
   assert.equal(app.runToEnd(), 9054);
   assert.deepEqual({q: app.query().snapshot, series: app.series(), distributions: app.distributions(), recent: app.recent()}, whole);
  } finally { app.dispose(); }
 });

 test('The kernel token index equals the world query in id order after creations, an out-of-order id and removals', () => {
  const k = root.LWProcessKernel, world = new root.LWECS.World(), s = {world, tokenList: null} as unknown as LWProcess.State;
  const token = (n: number): LWProcess.Token => ({id: 'token-' + String(n).padStart(8, '0'), caseId: 'case-0001', stepId: 'a', entered: 0, started: null,
   input: null, remaining: 0, status: 'queued', fork: null, branch: null});
  const ids = () => k.tokens(s).map(t => t.id), query = () => world.query(['process-token']);
  const serials = (list: string[]) => list.map(id => Number(id.slice(6)));
  k.createToken(s, token(3));
  k.createToken(s, token(7));
  assert.deepEqual(ids(), query());
  k.createToken(s, token(9));
  assert.deepEqual(serials(ids()), [3, 7, 9]);
  k.createToken(s, token(5));
  assert.deepEqual(serials(ids()), [3, 5, 7, 9], 'an out-of-order id is placed in id order');
  assert.deepEqual(ids(), query());
  k.destroyToken(s, token(7).id);
  k.createToken(s, token(12));
  assert.deepEqual(serials(ids()), [3, 5, 9, 12]);
  assert.deepEqual(ids(), query());
  assert(k.tokens(s).every(t => world.get(t.id, 'process-token') === t), 'the listed tokens are the stored components');
 });
}
