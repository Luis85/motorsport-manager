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
  /** 'Takes 12 min', or 'Planned 12 min (the average shown in estimates); each visit draws its own time: Uniform 7–11 min'. '' without a duration. */
  describeTiming(step: Pick<LWProcess.Step, 'duration' | 'until' | 'timing'>): string;
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
 function describeTiming(step: Pick<LWProcess.Step, 'duration' | 'until' | 'timing'>): string {
  if (step.duration === undefined) return '';
  if (!step.timing) return `Takes ${step.duration} min`;
  return `Planned ${step.duration} min (the average shown in estimates); each visit draws its own time: ${describeDist(step.timing)}`;
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
 root.LWProcessRandomView = {describeDist, describeTiming, describeDraw, describeWhen, describeInstances, describeDeadline, describeFork, describeArrival, scalar, describeEmotion, describeChannel, describeOutcome, EMOTIONS, CHANNELS};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessRandomView;
})(globalThis);
