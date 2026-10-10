/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-random-view.ts" />
/// <reference path="./process-advice.ts" />
/** Whole-minute rounding advisories: the plain-language note, the non-blocking advisory list and its CLI output. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {catalog, advice} from './process-sdk.cjs';
import {test, agency, build, stepOf, flowOf, startEnd} from './test-process-helpers.cjs';
const view = (globalThis as unknown as {LWProcessRandomView: LWProcessRandomView.Api}).LWProcessRandomView;
const CLI = path.join(__dirname, 'tools/wildlands-cli.cjs');
const exponential = (mean: number): LWProcess.Dist => ({dist: 'exponential', mean});
/** A runnable process with a biased step timing, a biased deadline timing and a biased arrival gap, and one unbiased timing. */
function biased(): LWProcess.Definition {
 const quick = stepOf('quick', 'task', {duration: 2, timing: exponential(2), deadline: {mode: 'interrupt', flow: 'quick-late', timing: exponential(1)}});
 const steady = stepOf('steady', 'task', {duration: 10, timing: exponential(10)});
 const flows = [flowOf('start', 'quick'), flowOf('quick', 'steady'), flowOf('steady', 'end'), {id: 'quick-late', from: 'quick', to: 'end', on: 'deadline' as const}];
 return build(startEnd(quick, steady), flows, [{at: 0, count: 5, interval: 2, gap: exponential(2), data: {}}]);
}

test('Rounding notes flag short exponential means and stay silent when whole-minute draws match the mean', () => {
 const lead = 'Whole-minute rounding: an exponential distribution with mean ';
 assert.equal(view.roundingNote(exponential(1)), lead + '1 min draws about 1.4 min on average.');
 assert.equal(view.roundingNote(exponential(2)), lead + '2 min draws about 2.2 min on average.');
 // Mean 3 draws about 3.14 (4.7% above) and mean 10 about 10.04: within the 5% rule.
 assert(Math.abs(view.meanOf(exponential(3))! - 3.1397) < .001);
 assert.equal(view.roundingNote(exponential(3)), null);
 assert.equal(view.roundingNote(exponential(10)), null);
 // Whole values 1 and 2 are equally likely, so a uniform 1..2 averages exactly its mean of 1.5.
 assert.equal(view.meanOf({dist: 'uniform', min: 1, max: 2}), 1.5);
 assert.equal(view.authoredMean({dist: 'uniform', min: 1, max: 2}), 1.5);
 assert.equal(view.roundingNote({dist: 'uniform', min: 1, max: 2}), null);
 // Any distribution follows the same rule; averages that read alike at one decimal are told apart with two.
 assert.equal(view.roundingNote({dist: 'triangular', min: 1, mode: 1, max: 2}),
  'Whole-minute rounding: a triangular distribution with mean 1.33 min draws about 1.25 min on average.');
 assert.match(view.roundingNote({dist: 'exponential', mean: 4, max: 6})!, /^Whole-minute rounding and the declared bounds: an exponential distribution with mean 4 min/);
 assert.equal(view.roundingNote(undefined), null);
 assert.equal(view.roundingNote({dist: 'exponential'} as LWProcess.Dist), null);
});

test('Advisories list rounding bias by path, never block admission and are printed by validate and inspect', () => {
 const d = biased(), checked = catalog.validate(d);
 assert(checked.ok, JSON.stringify(checked.diagnostics));
 const expected = [
  {path: '/steps/1/timing', message: 'Whole-minute rounding: an exponential distribution with mean 2 min draws about 2.2 min on average.'},
  {path: '/steps/1/deadline/timing', message: 'Whole-minute rounding: an exponential distribution with mean 1 min draws about 1.4 min on average.'},
  {path: '/arrivals/0/gap', message: 'Whole-minute rounding: an exponential distribution with mean 2 min draws about 2.2 min on average.'}];
 assert.deepEqual(advice.advise(d), expected);
 assert.deepEqual(advice.advise(agency), []);
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'process-advice-'));
 try {
  const call = (args: string[], code: number) => {
   const p = spawnSync(process.execPath, [CLI, 'process', ...args], {cwd: dir, encoding: 'utf8'});
   assert.equal(p.status, code, p.stderr + p.stdout);
   return JSON.parse(p.stdout) as Record<string, any>;
  };
  fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify(d));
  const validated = call(['validate', '--input', 'a.json'], 0);
  assert.equal(validated.ok, true);
  assert.deepEqual(validated.diagnostics, []);
  assert.deepEqual(validated.advisories, expected);
  assert.deepEqual(call(['inspect', '--input', 'a.json'], 0).advisories, expected);
  // A draft with graph diagnostics still gets its advisories; a file that fails the schema gets none.
  const draft = {...d, steps: d.steps.filter(s => s.id !== 'steady')};
  fs.writeFileSync(path.join(dir, 'b.json'), JSON.stringify(draft));
  const loose = call(['validate', '--input', 'b.json', '--draft'], 0);
  assert.equal(loose.runnable, false);
  assert.deepEqual(loose.advisories, expected);
  fs.writeFileSync(path.join(dir, 'c.json'), '{}');
  assert.deepEqual(call(['validate', '--input', 'c.json'], 1).advisories, []);
 } finally {
  fs.rmSync(dir, {recursive: true, force: true});
 }
});
