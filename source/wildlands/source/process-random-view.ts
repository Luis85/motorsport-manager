/// <reference path="./process-contracts.d.ts" />
/**
 * Plain-language descriptions of the optional randomness features (timing distributions, drawn fields, chance routes and
 * arrival streams). Pure functions over detached definition values: no DOM, session, clock or storage. Views and editors
 * share these sentences so a distribution reads the same in the inspector, the editor and the activity list.
 */
declare namespace LWProcessRandomView {
 interface Api {
  /** 'Uniform 7–11 min', 'Random between 4 and 10 min, most often 6', 'Exponential, mean 4 min (max 12)'. */
  describeDist(dist: LWProcess.Dist | undefined): string;
  /** 'Takes 12 min', or 'Planned 12 min (the average shown in estimates); each visit draws its own time: Uniform 7–11 min'. '' without a duration. */
  describeTiming(step: Pick<LWProcess.Step, 'duration' | 'until' | 'timing'>): string;
  /** 'Sets defect to true in 12% of cases, otherwise false'. */
  describeDraw(draw: LWProcess.Draw): string;
  /** 'If iteration < iterations', '8% of cases take this path' or 'Otherwise (no condition)'. */
  describeWhen(when: LWProcess.Flow['when']): string;
  /** 'Keeps arriving: every ~4 min, random gap (exponential, mean 4), first at minute 0'. */
  describeArrival(arrival: LWProcess.Arrival): string;
  /** 'true', 'express', 'empty'. */
  scalar(value: LWProcess.Scalar | undefined): string;
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
  return `Exponential, mean ${num(d.mean)} min${d.max === undefined ? '' : ` (max ${num(d.max)})`}`;
 }
 /** The same distribution as a gap between arrivals, without units. */
 function gapText(d: LWProcess.Dist): string {
  if (d.dist === 'uniform') return `uniform ${num(d.min)}–${num(d.max)}`;
  if (d.dist === 'triangular') return `triangular ${num(d.min)}–${num(d.max)}, most often ${num(d.mode)}`;
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
 function describeWhen(when: LWProcess.Flow['when']): string {
  if (!when) return 'Otherwise (no condition)';
  if (typeof when.chance === 'number') return `${when.chance}% of cases take this path`;
  const c = when as LWProcess.Condition;
  return `If ${c.field} ${SYMBOL[c.op] ?? c.op} ${c.valueField !== undefined ? c.valueField : typeof c.value === 'string' ? `"${c.value}"` : scalar(c.value)}`;
 }
 function describeArrival(a: LWProcess.Arrival): string {
  const lead = a.open ? 'Keeps arriving' : a.until !== undefined ? `Until minute ${a.until}` : `${num(a.count)} ${a.count === 1 ? 'case' : 'cases'}`;
  const rhythm = a.gap ? `every ~${a.interval} min, random gap (${gapText(a.gap)})` : `every ${a.interval} min`;
  return `${lead}: ${rhythm}, first at minute ${a.at}`;
 }
 root.LWProcessRandomView = {describeDist, describeTiming, describeDraw, describeWhen, describeArrival, scalar};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessRandomView;
})(globalThis);
