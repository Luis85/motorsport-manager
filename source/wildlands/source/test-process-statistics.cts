/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-replicate.ts" />
/// <reference path="./process-dashboard-model.ts" />
/**
 * Exact statistics (business-process-analysis suite; loaded by test-process-analysis.cts): the exact Student t quantile of
 * LWProcessReplicate against independent reference values, and the intervals and What-if wording that use it.
 */
import assert from 'node:assert/strict';
import {replicate} from './process-sdk.cjs';
import {test, base} from './test-process-helpers.cjs';
for (const name of ['process-chart', 'process-dashboard-model', 'process-dashboard-window', 'process-dashboard-tiles', 'process-dashboard-flow',
 'process-dashboard-time', 'process-dashboard-quality', 'process-dashboard-panels', 'process-dashboard-journey', 'process-dashboard-focus',
 'process-dashboard-whatif']) {
 require(`./${name}.js`);
}
const root = globalThis as unknown as {LWProcessDashboardWhatIf: LWProcessDashboardWhatIf.Api};
/**
 * Two-sided 95% Student t quantiles to 6 decimals, cross-checked against an independent inversion of the regularised incomplete beta
 * function (Lentz continued fraction, 200 bisections). 2.024394 and 2.009575, sometimes quoted for 40 and 50 degrees of freedom,
 * are the quantiles of 38 and 49; those of 40 and 50 are 2.021075 and 2.008559.
 */
const REFERENCE: [number, number][] = [[1, 12.706205], [2, 4.302653], [3, 3.182446], [5, 2.570582], [7, 2.364624], [10, 2.228139],
 [20, 2.085963], [30, 2.042272], [31, 2.039513], [38, 2.024394], [40, 2.021075], [49, 2.009575], [50, 2.008559], [100, 1.983972],
 [120, 1.97993], [1000, 1.962339]];
/** The classic 3-decimal table that intervals with 1 to 30 degrees of freedom used and still use. */
const TABLE = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086,
 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];
const NORMAL = 1.959963984540054;

test('Student t quantiles are exact to 1e-6 for any whole df, also where the expansion takes over, and fall towards 1.959964', () => {
 for (const [df, t] of REFERENCE) assert(Math.abs(replicate.t95(df) - t) <= 1e-6, `df ${df}: ${replicate.t95(df)} against ${t}`);
 assert.deepEqual([...replicate.T95], TABLE, 'the exact quantiles rounded to 3 decimals are the classic table');
 for (let df = 1; df <= 30; df++) assert.equal(replicate.interval95(df), TABLE[df - 1], 'intervals keep the table up to 30 df: ' + df);
 for (const df of [31, 40, 120, 1000, 5000]) assert.equal(replicate.interval95(df), replicate.t95(df), 'the exact quantile from 31: ' + df);
 // Both sides of the switch from the series (up to 1,000) to the expansion (from 1,001), to 1e-9 of the incomplete beta reference.
 for (const [df, t] of [[999, 1.962341461], [1000, 1.962339081], [1001, 1.962336705], [2000, 1.961150826], [5000, 1.960438552]]) {
  assert(Math.abs(replicate.t95(df!) - t!) < 1e-9, `df ${df}: ${replicate.t95(df!)} against ${t}`);
 }
 let previous = Infinity;
 for (let df = 1; df <= 2000; df++) {
  const t = replicate.t95(df);
  assert(t < previous && t > NORMAL, 'strictly falling towards the normal quantile at ' + df);
  previous = t;
 }
 assert(Math.abs(replicate.t95(1000000) - NORMAL) < 3e-6 && replicate.t95(Infinity) === NORMAL);
 for (const bad of [0, -1, 1.5, NaN]) assert.throws(() => replicate.t95(bad), /whole number of at least 1/);
});

test('Replication intervals use the exact t quantile from 31 degrees of freedom and keep every pinned value up to 30', () => {
 const ones = (n: number) => Array.from({length: n}, (_, i) => i + 1);
 // 1..32: mean 16.5, sample sd √(32 × 33 / 12) = √88, 31 degrees of freedom; the old 1.96 gave a half-width of 3.250291.
 const half = 2.039513 * Math.sqrt(88) / Math.sqrt(32), s = replicate.summarize(ones(32));
 assert.deepEqual([s.n, s.mean, s.sd], [32, 16.5, 9.380832]);
 assert(Math.abs(s.ci95![0] - (16.5 - half)) < 2e-6 && Math.abs(s.ci95![1] - (16.5 + half)) < 2e-6, JSON.stringify(s.ci95));
 assert.deepEqual(s.ci95, [13.11785, 19.88215]);
 assert.deepEqual(replicate.summarize([2, 4, 4, 4, 5, 5, 7, 9]).ci95, [3.212228, 6.787772], 'df 7 keeps 2.365');
 assert.deepEqual(replicate.summarize([3, 1]).ci95, [-10.706, 14.706], 'df 1 keeps 12.706');
 const W = root.LWProcessDashboardWhatIf, report = replicate.replicate(base(), {minutes: 30, runs: 3});
 assert.match(W.result(report, 3).honesty, / Intervals use Student t quantiles for runs − 1 degrees of freedom \(to 3 decimals up to 30, exact beyond\)\. /);
});
