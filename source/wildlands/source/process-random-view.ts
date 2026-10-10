/// <reference path="./process-contracts.d.ts" />
/**
 * Plain-language descriptions of the optional randomness features (timing distributions, drawn fields, chance routes and
 * arrival streams). `many` and `nouns` rename 'cases' for customer and user journeys; the default wording is unchanged. Pure functions over detached definition values: no DOM, session, clock or storage. Views and editors
 * share these sentences so a distribution reads the same in the inspector, the editor and the activity list.
 */
declare namespace LWProcessRandomView {
 interface Api {
  /** 'Uniform 7–11 min', 'Random between 4 and 10 min, most often 6', 'Exponential, mean 4 min (max 12)', 'Normal, mean 30 min, sd 5 (between 20 and 45)', 'Erlang, 3 phases, mean 30 min'. */
  describeDist(dist: LWProcess.Dist | undefined): string;
  /**
   * 'Takes 12 min'; with random timing 'Planned 9 min (the average shown in estimates); each visit draws its own time: Uniform 7–11 min',
   * or, when the draws average more than 5% away from the planned duration, 'Planned 12 min; draws average about 9 min; each visit draws
   * its own time: Uniform 7–11 min'. '' without a duration.
   */
  describeTiming(step: Pick<LWProcess.Step, 'duration' | 'until' | 'timing'>): string;
  /** Average whole-minute value of a distribution's draws, rounding and clamping included (triangular 240/720/1800: about 920); null when unknown. */
  meanOf(dist: LWProcess.Dist | undefined): number | null;
  /** 'Sets defect to true in 12% of cases, otherwise false'. */
  describeDraw(draw: LWProcess.Draw): string;
  /** 'If iteration < iterations', '8% of cases take this path', 'Otherwise (no condition)' or, for all/any/not combinators, 'If A and (B or not C)'. */
  describeWhen(when: LWProcess.When | undefined, many?: string): string;
  /** 'Runs 3 instances in parallel ...' or 'Runs one instance for each unit in case field "lines" ...'; '' without instances. */
  describeInstances(step: Pick<LWProcess.Step, 'instances'>): string;
  /** 'After 20 min of work the deadline escalates ...' or 'After a random time of work (Exponential, mean 4 min) the deadline interrupts ...'; '' without a deadline. */
  describeDeadline(step: Pick<LWProcess.Step, 'deadline'>): string;
  /** 'Parallel fork: ...' or 'Inclusive fork: ...'; '' for steps that are not forks. */
  describeFork(step: Pick<LWProcess.Step, 'kind' | 'mode'>): string;
  /** 'Keeps arriving: every ~4 min, random gap (exponential, mean 4), first at minute 0'. */
  describeArrival(arrival: LWProcess.Arrival, nouns?: {one: string; many: string}): string;
  /** 'true', 'express', 'empty'. */
  scalar(value: LWProcess.Scalar | undefined): string;
  /** The feeling -3..3 in plain words: 'Very frustrated', 'Neutral', 'Delighted'; '' for anything that is not a whole number from -3 to 3. */
  describeEmotion(emotion: number | undefined): string;
  /** The touchpoint channel in plain words: 'Website', 'Phone call', 'Documents and forms'; '' for an unknown or missing channel. */
  describeChannel(channel: string | undefined): string;
  /** 'Goal reached' or 'Customer or user lost'; '' without an outcome. */
  describeOutcome(outcome: string | undefined): string;
  /** Every feeling from -3 to 3 with its words, in order, for pickers. */
  EMOTIONS: [number, string][];
  /** Every channel with its plain label, in the engine's order, for pickers. */
  CHANNELS: [LWProcess.Channel, string][];
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessRandomView?: LWProcessRandomView.Api};
 const SYMBOL: Record<string, string> = {eq: '=', ne: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤'};
 const scalar = (v: LWProcess.Scalar | undefined): string => v === null ? 'empty' : v === undefined ? '?' : String(v);
 const num = (n: number | undefined): string => n === undefined || !Number.isFinite(n) ? '?' : String(n);
 const percent = (part: number, total: number): string => `${Math.round(part / total * 1000) / 10}%`;
 function describeDist(d: LWProcess.Dist | undefined): string {
  if (!d) return '';
  if (d.dist === 'uniform') return `Uniform ${num(d.min)}–${num(d.max)} min`;
  if (d.dist === 'triangular') return `Random between ${num(d.min)} and ${num(d.max)} min, most often ${num(d.mode)}`;
  if (d.dist === 'normal') return `Normal, mean ${num(d.mean)} min, sd ${num(d.sd)}${bounds(d)}`;
  if (d.dist === 'erlang') return `Erlang, ${phases(d.k)}, mean ${num(d.mean)} min`;
  return `Exponential, mean ${num(d.mean)} min${d.max === undefined ? '' : ` (max ${num(d.max)})`}`;
 }
 const phases = (k: number | undefined) => `${num(k)} ${k === 1 ? 'phase' : 'phases'}`;
 /** The clamp range of a normal distribution; shown only when the author declared a bound. */
 function bounds(d: LWProcess.Dist): string {
  if (d.min === undefined && d.max === undefined) return '';
  const high = d.max ?? (d.mean !== undefined && d.sd !== undefined ? Math.min(100000, d.mean + 6 * d.sd) : undefined);
  return ` (between ${num(d.min ?? 1)} and ${num(high)})`;
 }
 /** The same distribution as a gap between arrivals, without units. */
 function gapText(d: LWProcess.Dist): string {
  if (d.dist === 'uniform') return `uniform ${num(d.min)}–${num(d.max)}`;
  if (d.dist === 'triangular') return `triangular ${num(d.min)}–${num(d.max)}, most often ${num(d.mode)}`;
  if (d.dist === 'normal') return `normal, mean ${num(d.mean)}, sd ${num(d.sd)}${bounds(d)}`;
  if (d.dist === 'erlang') return `erlang, ${phases(d.k)}, mean ${num(d.mean)}`;
  return `exponential, mean ${num(d.mean)}${d.max === undefined ? '' : `, max ${num(d.max)}`}`;
 }
 // The engine's run limit in minutes: the highest value any draw can take (LWProcessLimits.minutes).
 const LIMIT = 100000;
 /** Standard normal CDF (Abramowitz and Stegun 7.1.26, error below 2e-7): enough for a displayed average. */
 function phi(z: number): number {
  const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + .3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
 }
 /** Erlang CDF with k phases of mean `mean / k` each. */
 function erlangCdf(x: number, k: number, mean: number): number {
  if (x <= 0) return 0;
  const rate = k / mean; let term = 1, sum = 0;
  for (let n = 0; n < k; n++) { sum += term; term *= rate * x / (n + 1); }
  return 1 - Math.exp(-rate * x) * sum;
 }
 /**
  * Expected value of a whole-minute value `clamp(round(X), low, high)` for a continuous X with CDF `cdf`, as process-random
  * samples it: E = low + Σ P(value > m) for m from low to high - 1, where P(value > m) = 1 - cdf(m + 0.5). Stops once the
  * tail is negligible, so even the 100,000-minute limit costs little.
  */
 function roundedMean(cdf: (x: number) => number, low: number, high: number): number {
  let mean = low;
  for (let m = low; m < high; m++) { const tail = 1 - cdf(m + .5); if (tail < 1e-9) break; mean += tail; }
  return mean;
 }
 /** The average a step's draws actually take, following process-random's sampling rules (rounding and clamping included); null when unknown. */
 function meanOf(d: LWProcess.Dist | undefined): number | null {
  if (!d) return null;
  const ok = (...values: (number | undefined)[]) => values.every(v => v !== undefined && Number.isFinite(v));
  if (d.dist === 'uniform') {
   if (!ok(d.min, d.max) || d.max! < d.min!) return null;
   const low = Math.max(1, d.min!), high = Math.min(LIMIT, d.max!), span = d.max! - d.min! + 1;
   // Whole values min..max are equally likely; values outside [low, high] are clamped onto the bound.
   let sum = 0; for (let v = d.min!; v <= d.max! && v - d.min! < 200000; v++) sum += Math.min(high, Math.max(low, v));
   return sum / span;
  }
  if (d.dist === 'triangular') {
   const min = d.min ?? 1, max = d.max ?? LIMIT, mode = d.mode ?? min, span = max - min;
   if (!ok(min, max, mode) || span < 0) return null;
   if (span === 0) return Math.max(1, Math.min(LIMIT, min));
   const cdf = (x: number) => x <= min ? 0 : x >= max ? 1 : x <= mode ? (x - min) ** 2 / (span * (mode - min)) : 1 - (max - x) ** 2 / (span * (max - mode));
   return roundedMean(cdf, Math.max(1, min), Math.min(LIMIT, max));
  }
  if (d.dist === 'normal') {
   if (!ok(d.mean, d.sd) || d.sd! <= 0) return null;
   return roundedMean(x => phi((x - d.mean!) / d.sd!), d.min ?? 1, Math.min(LIMIT, d.max ?? d.mean! + 6 * d.sd!));
  }
  if (d.dist === 'erlang') return ok(d.k, d.mean) && d.k! >= 1 && d.mean! > 0 ? roundedMean(x => erlangCdf(x, d.k!, d.mean!), 1, LIMIT) : null;
  const mean = d.mean ?? 1;
  return mean > 0 ? roundedMean(x => 1 - Math.exp(-x / mean), 1, Math.min(LIMIT, d.max ?? LIMIT)) : null;
 }
 /** A displayed average: whole minutes from 100 up, one decimal below. */
 const average = (n: number) => n >= 100 ? String(Math.round(n)) : String(Math.round(n * 10) / 10);
 function describeTiming(step: Pick<LWProcess.Step, 'duration' | 'until' | 'timing'>): string {
  if (step.duration === undefined) return '';
  if (!step.timing) return `Takes ${step.duration} min`;
  // The planned duration is what estimates use. When the draws average more than 5% away from it, say so instead of calling it the average.
  const mean = meanOf(step.timing), apart = mean !== null && step.duration > 0 && Math.abs(mean - step.duration) / step.duration > .05;
  const lead = apart ? `Planned ${step.duration} min; draws average about ${average(mean)} min`
   : `Planned ${step.duration} min (the average shown in estimates)`;
  return `${lead}; each visit draws its own time: ${describeDist(step.timing)}`;
 }
 function describeDraw(d: LWProcess.Draw): string {
  if (d.kind === 'chance') {
   const yes = Object.hasOwn(d, 'whenTrue') ? d.whenTrue : true, no = Object.hasOwn(d, 'whenFalse') ? d.whenFalse : false;
   return `Sets ${d.field} to ${scalar(yes)} in ${num(d.percent)}% of cases, otherwise ${scalar(no)}`;
  }
  if (d.kind === 'choice') {
   const values = d.values ?? [], total = values.reduce((sum, v) => sum + (Number.isFinite(v.weight) ? v.weight : 0), 0);
   return `Sets ${d.field} to ${values.map(v => `${scalar(v.value)} (${total > 0 ? percent(v.weight, total) : '?'})`).join(' or ')}`;
  }
  return `Sets ${d.field} to a whole number from ${num(d.min)} to ${num(d.max)}`;
 }
 /** One comparison or chance as a phrase without the leading 'If'. */
 function leafText(w: LWProcess.When, many: string): string {
  if (typeof w.chance === 'number') return `${w.chance}% of ${many}`;
  if (w.field === undefined) return '?';
  return `${w.field} ${SYMBOL[w.op] ?? w.op} ${w.valueField !== undefined ? w.valueField : typeof w.value === 'string' ? `"${w.value}"` : scalar(w.value)}`;
 }
 const isCombinator = (w: LWProcess.When) => w.all !== undefined || w.any !== undefined || w.not !== undefined;
 /** 'A and (B or not C)': a nested group of several tests is parenthesised, a single test is not. */
 function whenText(w: LWProcess.When, many: string, nested: boolean): string {
  if (w.not !== undefined) return 'not ' + whenText(w.not, many, true);
  const list = w.all ?? w.any;
  if (!list) return leafText(w, many);
  const text = list.map(x => whenText(x, many, true)).join(w.all ? ' and ' : ' or ');
  return nested && list.length > 1 ? `(${text})` : text;
 }
 function describeWhen(when: LWProcess.When | undefined, many = 'cases'): string {
  if (!when) return 'Otherwise (no condition)';
  if (isCombinator(when)) return 'If ' + whenText(when, many, false);
  if (typeof when.chance === 'number') return `${when.chance}% of ${many} take this path`;
  return 'If ' + leafText(when, many);
 }
 function describeInstances(step: Pick<LWProcess.Step, 'instances'>): string {
  const i = step.instances; if (!i) return '';
  const how = i.mode === 'sequential' ? 'one after another: each starts when the one before it is done' : 'in parallel: all are queued at once and start as capacity allows';
  const what = i.count !== undefined ? `${i.count} instances` : `one instance for each unit counted in case field "${i.field ?? '?'}" (1 to 50)`;
  return `Runs ${what} ${how}. The step completes once, when every instance is done.`;
 }
 function describeDeadline(step: Pick<LWProcess.Step, 'deadline'>): string {
  const d = step.deadline; if (!d) return '';
  const when = d.after !== undefined ? `After ${d.after} min of work` : `After a random time of work (${describeDist(d.timing) || '?'})`;
  return d.mode === 'interrupt' ? `${when} the deadline interrupts: the work is cancelled and the case takes the deadline path.` : `${when} the deadline escalates: the work keeps going and the deadline path starts beside it.`;
 }
 function describeFork(step: Pick<LWProcess.Step, 'kind' | 'mode'>): string {
  if (step.kind !== 'fork') return '';
  return step.mode === 'inclusive' ? 'Inclusive fork: starts every branch whose condition is true (the branch without a condition if none is), and its join waits for exactly those branches.' : 'Parallel fork: starts every branch at once, and its join waits for all of them.';
 }
 function describeArrival(a: LWProcess.Arrival, nouns = {one: 'case', many: 'cases'}): string {
  const lead = a.open ? 'Keeps arriving' : a.until !== undefined ? `Until minute ${a.until}` : `${num(a.count)} ${a.count === 1 ? nouns.one : nouns.many}`;
  const rhythm = a.gap ? `every ~${a.interval} min, random gap (${gapText(a.gap)})` : `every ${a.interval} min`;
  return `${lead}: ${rhythm}, first at minute ${a.at}`;
 }
 const EMOTIONS: [number, string][] = [[-3, 'Very frustrated'], [-2, 'Frustrated'], [-1, 'Slightly annoyed'], [0, 'Neutral'], [1, 'Pleased'], [2, 'Happy'], [3, 'Delighted']];
 const CHANNELS: [LWProcess.Channel, string][] = [['web', 'Website'], ['mobile', 'Mobile app'], ['store', 'Physical store'], ['phone', 'Phone call'], ['chat', 'Chat'], ['email', 'Email'], ['social', 'Social media'], ['ads', 'Advertising'], ['delivery', 'Delivery'], ['document', 'Documents and forms']];
 const OUTCOMES: Record<string, string> = {goal: 'Goal reached', lost: 'Customer or user lost'};
 const describeEmotion = (n: number | undefined): string => EMOTIONS.find(([value]) => value === n)?.[1] ?? '';
 const describeChannel = (channel: string | undefined): string => CHANNELS.find(([value]) => value === channel)?.[1] ?? '';
 const describeOutcome = (outcome: string | undefined): string => (outcome !== undefined && Object.hasOwn(OUTCOMES, outcome) ? OUTCOMES[outcome] : undefined) ?? '';
 root.LWProcessRandomView = {describeDist, describeTiming, meanOf, describeDraw, describeWhen, describeInstances, describeDeadline, describeFork,
  describeArrival, scalar, describeEmotion, describeChannel, describeOutcome, EMOTIONS, CHANNELS};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessRandomView;
})(globalThis);
