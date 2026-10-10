/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-step-model.ts" />
/**
 * Pure form logic behind the step editor for the BPMN-class step fields: random timing (including normal and Erlang), the
 * all/any/not condition tree, multiple instances and boundary deadlines. Everything here works on detached form values (text
 * as typed) and returns plain JSON for the definition; it never touches the DOM, a session or storage. The model, the section
 * markup and the editor share these functions so one rule has one owner.
 */
declare namespace LWProcessStepLogic {
 type Problem = LWProcessStepModel.Problem;
 interface Api {
  numeric(text: string): number | undefined;
  whole(text: string): number | undefined;
  newValue(): LWProcessStepModel.Value;
  readValue(v: LWProcess.Scalar | undefined): LWProcessStepModel.Value;
  writeValue(v: LWProcessStepModel.Value): LWProcess.Scalar;
  /** Text-form of a distribution; `dist` '' means none. */
  readTiming(t: LWProcess.Dist | undefined): LWProcessStepModel.Timing;
  writeTiming(t: LWProcessStepModel.Timing): LWProcess.Dist | undefined;
  /** Fills empty parameters from `base` minutes so the chosen distribution is valid. `previous` tells a switch from another kind (normal bounds are then cleared). */
  chooseDist(t: LWProcessStepModel.Timing, base: number, dist: LWProcessStepModel.DistKind, previous?: LWProcessStepModel.DistKind): void;
  /** Local checks of a distribution; keys are `<prefix>.<parameter>`. */
  distProblems(t: LWProcessStepModel.Timing, prefix: string, out: Problem[]): void;
  /** One new comparison row. */
  newLeaf(): LWProcessStepModel.Cond;
  readCond(when: unknown): LWProcessStepModel.Cond;
  writeCond(c: LWProcessStepModel.Cond): LWProcess.When;
  /** After the mode of `c` was set to its new value: keeps or creates the child rows. `previous` is the mode it had. */
  chooseCondMode(c: LWProcessStepModel.Cond, previous: LWProcessStepModel.Cond['mode']): void;
  condProblems(c: LWProcessStepModel.Cond, base: string, out: Problem[]): void;
  /** 'If iteration < iterations AND 8% of cases' / 'Otherwise' / '8% of cases'. */
  condSummary(c: LWProcessStepModel.Cond, otherwise?: string): string;
  isGroup(c: LWProcessStepModel.Cond): boolean;
  leafCount(c: LWProcessStepModel.Cond): number;
  /** The condition at a dot path such as `flows.0.cond.items.1`, or undefined. */
  condAt(target: unknown, path: string): LWProcessStepModel.Cond | undefined;
  /** The text-form distribution at a dot path (`timing` or `deadline.timing`), or undefined. */
  timingAt(model: LWProcessStepModel.Model, path: string): LWProcessStepModel.Timing | undefined;
  readInstances(step: LWProcess.Step): LWProcessStepModel.Instances;
  writeInstances(i: LWProcessStepModel.Instances): LWProcess.Instances | undefined;
  instancesProblems(i: LWProcessStepModel.Instances, out: Problem[]): void;
  readDeadline(step: LWProcess.Step): LWProcessStepModel.Deadline;
  writeDeadline(d: LWProcessStepModel.Deadline): LWProcess.Deadline | undefined;
  /** After the deadline kind changed: fills minutes, a distribution and the deadline flow with working defaults. */
  chooseDeadline(m: LWProcessStepModel.Model): void;
  deadlineProblems(m: LWProcessStepModel.Model, out: Problem[]): void;
  /** True when this flow row of the model is the deadline path. */
  isDeadlineFlow(m: LWProcessStepModel.Model, flowId: string): boolean;
  /** Plain-language rewrite of an engine diagnostic for the BPMN-class fields, or undefined to keep the engine text. */
  plain(key: string, d: LWProcess.Diagnostic, parts: string[]): string | undefined;
  LIMITS: {depth: number; leaves: number; entries: number; instancesMin: number; instancesMax: number; phases: number};
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessLimits?: LWProcess.Limits; LWProcessStepLogic?: LWProcessStepLogic.Api};
 type Timing = LWProcessStepModel.Timing; type Cond = LWProcessStepModel.Cond; type Out = LWProcessStepLogic.Problem[];
 const LIMITS = {depth: 3, leaves: 8, entries: 8, instancesMin: 2, instancesMax: 50, phases: 32};
 const SYMBOL: Record<string, string> = {eq: '=', ne: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤'};
 const FIELD = /^[a-z][a-zA-Z0-9_]{0,63}$/, FIELD_HINT = 'Start with a lowercase letter, then use letters, digits or underscores (up to 64 characters).';
 const numeric = (text: string): number | undefined => text.trim() !== '' && Number.isFinite(Number(text)) ? Number(text) : undefined;
 const whole = (text: string): number | undefined => { const n = numeric(text); return n === undefined ? undefined : Math.round(n); };
 const text = (n: number | undefined) => n === undefined ? '' : String(n);
 const group = (n: number) => n.toLocaleString('en-US');
 const MAXM = () => root.LWProcessLimits?.minutes ?? 100000;
 const isInt = (t: string, lo: number, hi: number) => { const n = numeric(t); return n !== undefined && Number.isInteger(n) && n >= lo && n <= hi; };
 const newValue = (): LWProcessStepModel.Value => ({type: 'true', text: ''});
 const readValue = (v: LWProcess.Scalar | undefined): LWProcessStepModel.Value =>
  v === undefined ? newValue() : v === null ? {type: 'null', text: ''} : typeof v === 'boolean' ? {type: v ? 'true' : 'false', text: ''} : typeof v === 'number' ? {type: 'number', text: String(v)} : {type: 'text', text: v};
 const writeValue = (v: LWProcessStepModel.Value): LWProcess.Scalar => v.type === 'true' ? true : v.type === 'false' ? false : v.type === 'null' ? null : v.type === 'number' ? numeric(v.text) ?? 0 : v.text;
 const show = (v: LWProcessStepModel.Value): string => v.type === 'text' ? `"${v.text}"` : v.type === 'number' ? v.text || '0' : v.type === 'null' ? 'empty' : v.type;
 // Distributions
 const readTiming = (t: LWProcess.Dist | undefined): Timing => ({dist: t?.dist ?? '', min: text(t?.min), mode: text(t?.mode), max: text(t?.max), mean: text(t?.mean), sd: text(t?.sd), k: text(t?.k)});
 function writeTiming(t: Timing): LWProcess.Dist | undefined {
  const n = (s: string) => whole(s) ?? 0;
  if (t.dist === 'uniform') return {dist: 'uniform', min: n(t.min), max: n(t.max)};
  if (t.dist === 'triangular') return {dist: 'triangular', min: n(t.min), mode: n(t.mode), max: n(t.max)};
  if (t.dist === 'exponential') return t.max.trim() === '' ? {dist: 'exponential', mean: n(t.mean)} : {dist: 'exponential', mean: n(t.mean), max: n(t.max)};
  if (t.dist === 'normal') return {dist: 'normal', mean: n(t.mean), sd: n(t.sd), ...t.min.trim() === '' ? {} : {min: n(t.min)}, ...t.max.trim() === '' ? {} : {max: n(t.max)}};
  if (t.dist === 'erlang') return {dist: 'erlang', k: n(t.k), mean: n(t.mean)};
  return undefined;
 }
 function chooseDist(t: Timing, base: number, dist: LWProcessStepModel.DistKind, previous?: LWProcessStepModel.DistKind): void {
  const d = Math.max(1, base); t.dist = dist;
  const fill = (key: 'min' | 'mode' | 'max' | 'mean' | 'sd' | 'k', value: number) => { if (!/^\d+$/.test(t[key].trim())) t[key] = String(Math.max(1, value)); };
  if (dist === 'uniform') { fill('min', Math.round(d * 0.5)); fill('max', Math.round(d * 1.5)); }
  else if (dist === 'triangular') { fill('min', Math.round(d * 0.5)); fill('mode', d); fill('max', Math.round(d * 1.5)); }
  else if (dist === 'exponential') fill('mean', d);
  else if (dist === 'normal') { if (previous !== undefined && previous !== 'normal') { t.min = ''; t.max = ''; } fill('mean', d); fill('sd', Math.round(d * 0.25)); }
  else if (dist === 'erlang') { fill('mean', d); fill('k', 3); }
 }
 function distProblems(t: Timing, prefix: string, out: Out): void {
  if (!t.dist) return;
  const range = `Enter a whole number of minutes from 1 to ${group(MAXM())}.`, bad = new Set<string>(), at = (k: string, message: string) => { bad.add(k); out.push({key: `${prefix}.${k}`, message}); };
  const keys = t.dist === 'uniform' ? ['min', 'max'] : t.dist === 'triangular' ? ['min', 'mode', 'max'] : ['mean'] as string[];
  for (const k of keys) if (!isInt(t[k as 'min'], 1, MAXM())) at(k, range);
  if (t.dist === 'exponential' && t.max.trim() !== '' && !isInt(t.max, 1, MAXM())) at('max', range);
  if (t.dist === 'normal') {
   if (!isInt(t.sd, 1, MAXM())) at('sd', `The spread (standard deviation) must be a whole number of minutes from 1 to ${group(MAXM())}.`);
   for (const k of ['min', 'max'] as const) if (t[k].trim() !== '' && !isInt(t[k], 1, MAXM())) at(k, range);
  }
  if (t.dist === 'erlang' && !isInt(t.k, 1, LIMITS.phases)) at('k', `Enter a whole number of phases from 1 to ${LIMITS.phases}.`);
  if (bad.size) return;
  const n = (k: 'min' | 'mode' | 'max' | 'mean' | 'sd') => Number(t[k]);
  if (t.dist === 'uniform' && n('min') > n('max')) at('min', `The minimum (${n('min')}) must not be above the maximum (${n('max')}).`);
  if (t.dist === 'triangular' && !(n('min') <= n('mode') && n('mode') <= n('max'))) at('mode', `A triangular time needs minimum ≤ most likely ≤ maximum (now ${n('min')}, ${n('mode')}, ${n('max')}).`);
  if (t.dist === 'exponential' && t.max.trim() !== '' && n('mean') > n('max')) at('max', `The cap (${n('max')}) must not be below the mean (${n('mean')}).`);
  if (t.dist === 'normal') {
   const low = t.min.trim() === '' ? 1 : n('min'), explicit = t.max.trim() !== '', high = explicit ? n('max') : Math.min(MAXM(), n('mean') + 6 * n('sd'));
   if (low > high) at(t.min.trim() !== '' ? 'min' : 'max', `The minimum (${low}) must not be above the maximum (${high}${explicit ? '' : ', the default of mean + 6 × sd'}).`);
  }
 }
 // Conditions: a leaf compares a field or draws a share of cases; all/any hold 1..8 rows, not holds one. `items` exists on groups only.
 const newLeaf = (): Cond => ({on: true, field: '', op: 'eq', mode: 'value', value: newValue(), valueField: '', chance: '10'});
 const isGroup = (c: Cond) => c.mode === 'all' || c.mode === 'any' || c.mode === 'not';
 function readCond(when: unknown): Cond {
  const w = when as Record<string, unknown> | undefined, base = newLeaf(); base.on = !!w;
  if (!w) return base;
  if (Array.isArray(w.all)) return {...base, mode: 'all', items: w.all.map(readCond)};
  if (Array.isArray(w.any)) return {...base, mode: 'any', items: w.any.map(readCond)};
  if (w.not !== undefined) return {...base, mode: 'not', items: [readCond(w.not)]};
  if (typeof w.chance === 'number') return {...base, mode: 'chance', chance: String(w.chance)};
  const other = w.valueField !== undefined;
  return {...base, field: String(w.field ?? ''), op: String(w.op ?? 'eq'), mode: other ? 'field' : 'value', value: other ? newValue() : readValue(w.value as LWProcess.Scalar | undefined), valueField: other ? String(w.valueField) : ''};
 }
 function writeCond(c: Cond): LWProcess.When {
  if (c.mode === 'all') return {all: (c.items ?? []).map(writeCond)};
  if (c.mode === 'any') return {any: (c.items ?? []).map(writeCond)};
  if (c.mode === 'not') return {not: writeCond(c.items?.[0] ?? newLeaf())};
  if (c.mode === 'chance') return {chance: whole(c.chance) ?? 0};
  // The form offers only the six operators; the engine still validates whatever text a field carries.
  const op = c.op as LWProcess.Condition['op'];
  if (c.mode !== 'field') return {field: c.field, op, value: writeValue(c.value)};
  // A field-to-field comparison carries no `value`, which the contract's single Condition shape cannot express yet.
  const other: Omit<LWProcess.Condition, 'value'> = {field: c.field, op, valueField: c.valueField};
  return other as LWProcess.Condition;
 }
 function chooseCondMode(c: Cond, previous: Cond['mode']): void {
  const was = previous === 'all' || previous === 'any' || previous === 'not';
  if (!isGroup(c)) { delete c.items; return; }
  if (!was) { const leaf: Cond = {...c, mode: previous, on: true}; delete leaf.items; c.items = c.mode === 'not' ? [leaf] : [leaf, newLeaf()]; return; }
  const items = c.items ?? [];
  if (c.mode === 'not' && items.length !== 1) c.items = [{...newLeaf(), mode: previous, items}];
  else if (!items.length) c.items = [newLeaf()];
 }
 const leafCount = (c: Cond): number => isGroup(c) ? (c.items ?? []).reduce((n, x) => n + leafCount(x), 0) : 1;
 function condProblems(c: Cond, base: string, out: Out, level = 1): void {
  const at = (k: string, message: string) => out.push({key: k ? `${base}.${k}` : base, message});
  if (isGroup(c)) {
   const items = c.items ?? [];
   if (level > LIMITS.depth) at('', `Conditions nest at most ${LIMITS.depth} groups deep. Remove a level.`);
   if (!items.length) at('', 'Add at least one test to this group.');
   if (items.length > LIMITS.entries) at('', `A group holds at most ${LIMITS.entries} tests.`);
   items.forEach((x, j) => condProblems(x, `${base}.items.${j}`, out, level + 1));
   if (level === 1 && leafCount(c) > LIMITS.leaves) at('', `A condition has at most ${LIMITS.leaves} tests in all; remove some.`);
   return;
  }
  if (c.mode === 'chance') { const n = numeric(c.chance); if (n === undefined || !Number.isInteger(n) || n < 1 || n > 99) at('chance', 'Enter a whole percent from 1 to 99.'); return; }
  if (c.field.trim() === '') at('field', 'Name the case field to test.');
  if (c.mode === 'field') { if (c.valueField.trim() === '') at('valueField', 'Name the other case field to compare with.'); }
  else if (c.value.type === 'number' && numeric(c.value.text) === undefined) at('value', 'Enter a number.');
 }
 function leafSummary(c: Cond): string {
  if (c.mode === 'chance') return `${c.chance.trim() || '(percent)'}% of cases`;
  return `${c.field || '(field)'} ${SYMBOL[c.op] ?? c.op} ${c.mode === 'field' ? c.valueField || '(field)' : show(c.value)}`;
 }
 function groupSummary(c: Cond, nested: boolean): string {
  if (!isGroup(c)) return leafSummary(c);
  const items = c.items ?? [];
  if (c.mode === 'not') return 'NOT ' + (items[0] ? groupSummary(items[0], true) : '(condition)');
  const text = items.map(x => groupSummary(x, true)).join(c.mode === 'all' ? ' AND ' : ' OR ');
  return nested && items.length > 1 ? `(${text})` : text;
 }
 const condSummary = (c: Cond, otherwise = 'Otherwise'): string => !c.on ? otherwise : c.mode === 'chance' ? leafSummary(c) : 'If ' + groupSummary(c, false);
 function condAt(target: unknown, path: string): Cond | undefined {
  let at = target as Record<string, unknown> | undefined;
  for (const key of path.split('.')) at = at?.[key] as Record<string, unknown> | undefined;
  return at as unknown as Cond | undefined;
 }
 const timingAt = (m: LWProcessStepModel.Model, path: string): Timing | undefined => path === 'timing' ? m.timing : path === 'deadline.timing' ? m.deadline?.timing : undefined;
 // Multiple instances
 const readInstances = (step: LWProcess.Step): LWProcessStepModel.Instances => ({kind: step.instances?.count !== undefined ? 'count' : step.instances?.field !== undefined ? 'field' : 'none', count: step.instances?.count === undefined ? '3' : String(step.instances.count), field: step.instances?.field ?? '', mode: step.instances?.mode ?? 'parallel'});
 const writeInstances = (i: LWProcessStepModel.Instances): LWProcess.Instances | undefined => i.kind === 'none' ? undefined : i.kind === 'count' ? {count: whole(i.count) ?? 0, mode: i.mode} : {field: i.field, mode: i.mode};
 function instancesProblems(i: LWProcessStepModel.Instances, out: Out): void {
  if (i.kind === 'count' && !isInt(i.count, LIMITS.instancesMin, LIMITS.instancesMax)) out.push({key: 'instances.count', message: `Enter a whole number of instances from ${LIMITS.instancesMin} to ${LIMITS.instancesMax}.`});
  if (i.kind === 'field' && !FIELD.test(i.field)) out.push({key: 'instances.field', message: i.field.trim() === '' ? 'Name the case field that holds the number of instances.' : FIELD_HINT});
 }
 // Boundary deadlines
 const readDeadline = (step: LWProcess.Step): LWProcessStepModel.Deadline => ({kind: !step.deadline ? 'none' : step.deadline.after !== undefined ? 'after' : 'timing', after: text(step.deadline?.after), timing: readTiming(step.deadline?.timing), mode: step.deadline?.mode ?? 'interrupt', flow: step.deadline?.flow ?? ''});
 function writeDeadline(d: LWProcessStepModel.Deadline): LWProcess.Deadline | undefined {
  if (d.kind === 'none') return undefined;
  return d.kind === 'after' ? {after: whole(d.after) ?? 0, mode: d.mode, flow: d.flow} : {timing: writeTiming(d.timing) ?? {dist: 'exponential', mean: 1}, mode: d.mode, flow: d.flow};
 }
 function chooseDeadline(m: LWProcessStepModel.Model): void {
  const d = m.deadline; if (!d || d.kind === 'none') return;
  const base = Math.max(1, Math.round((whole(m.duration) ?? 2) / 2));
  if (d.kind === 'after' && !/^\d+$/.test(d.after.trim())) d.after = String(base);
  if (d.kind === 'timing' && !d.timing.dist) chooseDist(d.timing, base, 'exponential');
  if (!m.flows.some(f => f.id === d.flow)) d.flow = m.flows.length > 1 ? m.flows[m.flows.length - 1]!.id : '';
 }
 function deadlineProblems(m: LWProcessStepModel.Model, out: Out): void {
  const d = m.deadline; if (!d || d.kind === 'none') return;
  if (d.kind === 'after' && !isInt(d.after, 1, MAXM())) out.push({key: 'deadline.after', message: `Enter a whole number of minutes from 1 to ${group(MAXM())}.`});
  if (d.kind === 'timing') { if (!d.timing.dist) out.push({key: 'deadline.timing.dist', message: 'Choose a distribution for the random deadline.'}); else distProblems(d.timing, 'deadline.timing', out); }
  if (m.flows.length < 2) out.push({key: 'deadline.flow', message: 'A deadline needs a second path leaving this step for the deadline to take. Add one with Add path to… under Where work goes next.'});
  else if (!m.flows.some(f => f.id === d.flow)) out.push({key: 'deadline.flow', message: 'Choose which outgoing flow is the deadline path.'});
 }
 const isDeadlineFlow = (m: LWProcessStepModel.Model, flowId: string) => !!m.deadline && m.deadline.kind !== 'none' && m.deadline.flow === flowId;
 function plain(key: string, d: LWProcess.Diagnostic, parts: string[]): string | undefined {
  const shape = d.code === 'shape', last = parts[parts.length - 1];
  if (key === 'instances' && /exactly one of count/.test(d.message)) return 'Choose a fixed number of instances (2 to 50) or a case field that holds 1 to 50.';
  if (key === 'instances.count' && shape) return `The number of instances must be a whole number from ${LIMITS.instancesMin} to ${LIMITS.instancesMax}`;
  if (key === 'instances.field' && shape) return FIELD_HINT.replace('Start', 'The case field name must start').replace(', then use', ' and then use');
  if (key === 'backlog' && /multi-instance step cannot declare a backlog/.test(d.message)) return 'A step with multiple instances cannot keep a backlog. Turn off the backlog or the instances.';
  if (key === 'deadline' && /exactly one of after/.test(d.message)) return 'Choose either a fixed number of minutes or a random time for the deadline.';
  if (key === 'deadline.after' && shape) return `Deadline minutes must be a whole number from 1 to ${group(MAXM())}`;
  if (key === 'deadline.flow' && /exactly one flow/.test(d.message)) return 'Exactly one flow leaving this step must be the deadline path, next to the normal flow. Choose it here, or add a second path with Add path to… under Where work goes next.';
  if (key.endsWith('timing.sd')) return `The spread (sd) must be a whole number of minutes from 1 to ${group(MAXM())}`;
  if (last === 'k' && /timing/.test(key)) return `Phases (k) must be a whole number from 1 to ${LIMITS.phases}`;
  return undefined;
 }
 root.LWProcessStepLogic = {numeric, whole, newValue, readValue, writeValue, readTiming, writeTiming, chooseDist, distProblems, newLeaf, readCond, writeCond, chooseCondMode, condProblems, condSummary, isGroup, leafCount, condAt, timingAt,
  readInstances, writeInstances, instancesProblems, readDeadline, writeDeadline, chooseDeadline, deadlineProblems, isDeadlineFlow, plain, LIMITS};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessStepLogic;
})(globalThis);
