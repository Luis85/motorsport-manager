/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-step-model.ts" />
/// <reference path="./process-step-logic.ts" />
/**
 * Problems of the step editor's form model (owner: the authoring package; split out of LWProcessStepModel, which keeps reading
 * and writing the fields). Two kinds of problem:
 *  - local representation problems (`problems`): what no definition can express faithfully, such as a blank or repeated field name
 *    or a half-typed number; the editor blocks Save and Apply while there are any;
 *  - engine diagnostics scoped to one step (`scope`), rewritten in plain words that name the field and its range, and the rest of
 *    the draft's diagnostics (`elsewhere`) with their paths translated to names (`describePath`, "Discovery › duration").
 * Pure functions: no DOM, session or storage. The catalog alone decides validity; nothing here blocks typing.
 */
declare namespace LWProcessStepChecks {
 interface Api {
  problems(model: LWProcessStepModel.Model): LWProcessStepModel.Problem[];
  scope(def: LWProcess.Definition, stepId: string, diagnostics: LWProcess.Diagnostic[]): LWProcessStepModel.Scoped[];
  /** Diagnostics that do not belong to this step (other steps, resources, arrivals), as readable text with the path translated to names. */
  elsewhere(def: LWProcess.Definition, stepId: string, diagnostics: LWProcess.Diagnostic[]): {where: string; message: string}[];
  /** 'Step name › duration' style text for a diagnostic path. */
  describePath(def: LWProcess.Definition, path: string): string;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessStepModel: LWProcessStepModel.Api; LWProcessStepLogic: LWProcessStepLogic.Api;
  LWProcessLimits?: LWProcess.Limits; LWProcessStepChecks?: LWProcessStepChecks.Api};
 type M = LWProcessStepModel.Model;
 type Problem = LWProcessStepModel.Problem;
 const L = () => root.LWProcessStepLogic, model = () => root.LWProcessStepModel;
 function problems(m: M): Problem[] {
  const out: Problem[] = [], {numeric, whole} = L();
  const value = (key: string, v: LWProcessStepModel.Value) => {
   if (v.type === 'number' && numeric(v.text) === undefined) out.push({key, message: 'Enter a number.'});
  };
  const keys = (rows: {key: string}[], base: string) => rows.forEach((r, i) => {
   if (r.key.trim() === '') out.push({key: `${base}.${i}.key`, message: 'Name the field or remove this row.'});
   else if (rows.findIndex(o => o.key === r.key) !== i) out.push({key: `${base}.${i}.key`, message: `The field ${r.key} is listed twice.`});
  });
  keys(m.set, 'set');
  keys(m.add, 'add');
  m.set.forEach((r, i) => value(`set.${i}.value`, r.value));
  m.outputs.forEach((o, i) => {
   if (o.field.trim() === '') out.push({key: `outputs.${i}.field`, message: 'Name the output field or remove this row.'});
   else if (m.outputs.findIndex(x => x.field === o.field) !== i) {
    out.push({key: `outputs.${i}.field`, message: `The output ${o.field} is listed twice.`});
   }
  });
  const limits = model().LIMITS;
  if (m.technology.trim().length > 80) out.push({key: 'technology', message: 'Technology must be 80 characters or fewer.'});
  if (m.phase.trim().length > limits.phase) out.push({key: 'phase', message: `Phase must be ${limits.phase} characters or fewer.`});
  for (const k of ['pain', 'opportunity'] as const) {
   const name = k === 'pain' ? 'Pain point' : 'Opportunity';
   if (m[k].trim().length > limits.note) out.push({key: k, message: `${name} must be ${limits.note} characters or fewer.`});
  }
  m.add.forEach((r, i) => {
   if (whole(r.delta) === undefined) out.push({key: `add.${i}.delta`, message: 'Enter a whole number.'});
  });
  m.needs.forEach((n, i) => {
   if (n.field.trim() === '') out.push({key: `needs.${i}.field`, message: 'Name the field earlier steps must deliver, or remove this row.'});
   if (n.op) value(`needs.${i}.value`, n.value);
  });
  m.flows.forEach((f, i) => {
   if (f.cond.on && !L().isDeadlineFlow(m, f.id)) L().condProblems(f.cond, `flows.${i}.cond`, out);
  });
  if (model().timingAllowed(m)) L().distProblems(m.timing, 'timing', out);
  if (m.instances) L().instancesProblems(m.instances, out);
  L().deadlineProblems(m, out);
  m.draws.forEach((r, i) => drawProblems(m, r, i, out));
  return out;
 }
 const isInt = (t: string, lo: number, hi: number) => {
  const n = L().numeric(t);
  return n !== undefined && Number.isInteger(n) && n >= lo && n <= hi;
 };
 const same = (a: LWProcessStepModel.Value, b: LWProcessStepModel.Value) => JSON.stringify(L().writeValue(a)) === JSON.stringify(L().writeValue(b));
 function drawProblems(m: M, r: LWProcessStepModel.DrawRow, i: number, out: Problem[]): void {
  const at = (k: string, message: string) => out.push({key: `draws.${i}.${k}`, message}), name = r.field, {numeric} = L();
  if (name.trim() === '') at('field', 'Name the field or remove this row.');
  else if (!/^[a-z][a-zA-Z0-9_]{0,63}$/.test(name)) {
   at('field', 'Start with a lowercase letter, then use letters, digits or underscores (up to 64 characters).');
  } else if (m.draws.findIndex(o => o.field === name) !== i) at('field', `The field ${name} is drawn twice.`);
  else if (m.set.some(x => x.key === name)) {
   at('field', `The field ${name} is also in Set a value; a field has one writer. Remove one of them.`);
  } else if (r.kind !== 'int' && m.add.some(x => x.key === name)) {
   at('field', `The field ${name} is also a counter; only a whole-number draw may feed a counter.`);
  }
  if (r.kind === 'chance') {
   if (!isInt(r.percent, 1, 99)) at('percent', 'Enter a whole percent from 1 to 99.');
   for (const [k, v] of [['whenTrue', r.whenTrue], ['whenFalse', r.whenFalse]] as const) {
    if (v.type === 'number' && numeric(v.text) === undefined) at(`${k}.text`, 'Enter a number.');
   }
   if (same(r.whenTrue, r.whenFalse)) at('whenFalse.type', 'The value for "yes" and the value for "no" must differ.');
  } else if (r.kind === 'choice') {
   const limits = model().LIMITS;
   r.values.forEach((v, j) => {
    if (!isInt(v.weight, 1, 1000)) at(`values.${j}.weight`, 'Enter a whole weight from 1 to 1,000.');
    if (v.value.type === 'number' && numeric(v.value.text) === undefined) at(`values.${j}.value.text`, 'Enter a number.');
    else if (r.values.findIndex(o => same(o.value, v.value)) !== j) at(`values.${j}.value.type`, 'Each value may appear once.');
   });
   if (r.values.length < limits.minChoices || r.values.length > limits.choices) {
    at('values', `A weighted choice needs ${limits.minChoices} to ${limits.choices} values.`);
   }
  } else {
   const lo = isInt(r.min, -1e9, 1e9), hi = isInt(r.max, -1e9, 1e9);
   if (!lo) at('min', 'Enter a whole number.');
   if (!hi) at('max', 'Enter a whole number.');
   if (lo && hi && Number(r.min) > Number(r.max)) at('min', `The lowest (${r.min}) must not be above the highest (${r.max}).`);
  }
 }
 /** Engine step fields and the model key that edits them. */
 const SEGMENTS: Record<string, string> = {name: 'name', description: 'description', duration: 'duration', until: 'until', cost: 'cost',
  resources: 'pools', set: 'set', add: 'add', needs: 'needs', backlog: 'backlog', technology: 'technology', outputs: 'outputs',
  timing: 'timing', draws: 'draws', phase: 'phase', emotion: 'emotion', pain: 'pain', opportunity: 'opportunity', channel: 'channel',
  outcome: 'outcome', mode: 'branching', instances: 'instances', deadline: 'deadline'};
 const KIND_NAME: Partial<Record<LWProcess.Kind, [string, string]>> = {task: ['Task', 'Tasks'], touchpoint: ['Touchpoint', 'Touchpoints'],
  machine: ['Machine step', 'Machine steps'], system: ['System step', 'System steps'], timer: ['Timer', 'Timers']};
 const group = (n: number) => n.toLocaleString('en-US');
 /** Plain words for the step-wide, pool and backlog diagnostics; undefined keeps looking. */
 function plainShape(step: LWProcess.Step, key: string, d: LWProcess.Diagnostic, parts: string[]): string | undefined {
  const kind = KIND_NAME[step.kind]?.[0] ?? 'Step', limits = root.LWProcessLimits, minutes = limits?.minutes ?? 100000;
  const shape = d.code === 'shape', note = model().LIMITS.note;
  if (key === 'name' && shape) return step.name.trim() === '' ? 'Give the step a name (1 to 120 characters)' : 'Step name must be 120 characters or fewer';
  if (key === 'description' && shape) return 'Description must be 2,000 characters or fewer';
  if (key === 'duration') {
   const label = step.kind === 'timer' ? 'Wait duration' : `${kind} duration`;
   if (/positive whole-minute duration/.test(d.message)) return `${label} must be 1 or more`;
   if (shape) return `${label} must be a whole number from 1 to ${group(minutes)}`;
  }
  if (key === 'until' && shape) return `Wait-until minute must be a whole number from 1 to ${group(minutes - 1)}`;
  if (key === 'cost' && shape) return 'Fixed cost must be a whole number from 0 to 100,000,000';
  if (key === 'technology' && shape) return 'Technology must be 1 to 80 characters';
  if (key === 'phase' && shape) return `Phase must be 1 to ${model().LIMITS.phase} characters`;
  if (key === 'emotion' && shape) return 'Feeling must be a whole number from -3 to 3';
  if ((key === 'pain' || key === 'opportunity') && shape) return `${key === 'pain' ? 'Pain point' : 'Opportunity'} must be 1 to ${note} characters`;
  if (key === 'channel' && /only on touchpoint/.test(d.message)) return 'A channel can be set only on touchpoint steps';
  if (key === 'outcome' && /only on end/.test(d.message)) return 'An outcome can be set only on end steps';
  // The editor calls outgoing flows paths.
  if (key === '' && /outgoing flow/.test(d.message)) return d.message.replace(/(outgoing|deadline) flows?/g, x => x.replace('flow', 'path'));
  const cases = group(limits?.cases ?? 200);
  if (key === 'backlog' && shape && parts[3] === 'capacity') return `Backlog capacity must be a whole number from 1 to ${cases}`;
  if (key === 'backlog' && shape && parts[3] === 'pull') return `Pull limit must be a whole number from 1 to ${cases}`;
  return undefined;
 }
 /** Rewrites an engine diagnostic for this step into plain language that names the field and its allowed range. */
 function plain(def: LWProcess.Definition, step: LWProcess.Step, key: string, d: LWProcess.Diagnostic, parts: string[]): string {
  const mapped = L().plain(key, d, parts) ?? plainShape(step, key, d, parts);
  if (mapped) return mapped;
  if (key.startsWith('pools.') || key === 'pools') {
   const pool = def.resources.find(r => r.id === parts[3]);
   if (pool && /Demand exceeds/.test(d.message)) return `${pool.name} has only ${pool.capacity} available; ask for ${pool.capacity} or fewer`;
   if (pool && /may demand only/.test(d.message)) {
    const steps = (KIND_NAME[step.kind]?.[1] ?? 'Steps').toLowerCase(), wanted = model().poolKind(step.kind);
    return `${pool.name} is a ${pool.kind ?? 'people'} pool, but ${steps} may use only ${wanted} pools. Set it to 0`;
   }
   if (/must demand at least one/.test(d.message)) return `Choose at least one ${step.kind} pool and ask for 1 or more`;
  }
  return generic(d, parts) ?? d.message;
 }
 const NAME_HINT = 'Use a case field name that starts with a lowercase letter, then letters, digits or underscores (up to 64 characters)';
 /** Plain words for the catalog's terse structural messages, naming the field from the end of the diagnostic path. */
 function generic(d: LWProcess.Diagnostic, parts: string[]): string | undefined {
  if (d.code !== 'shape') return undefined;
  const last = parts[parts.length - 1] ?? '', what = FIELD[last] ?? (/^\d+$/.test(last) ? 'entry' : last || 'value');
  if (d.message === 'String has invalid length or format.') {
   const fieldName = ['field', 'valueField', 'priority'].includes(last) || (parts[2] === 'set' || parts[2] === 'add') && parts.length === 4;
   if (fieldName) return NAME_HINT;
   return last === 'label' ? 'The label must be 1 to 120 characters' : `The ${what} is empty, too long or not in the allowed format`;
  }
  if (d.message === 'Number is out of range.') return `The ${what} is outside the allowed range`;
  if (/^Expected (integer|number)/.test(d.message)) return `The ${what} must be a number`;
  return undefined;
 }
 /** The model key a step diagnostic path edits ('' for the whole step). */
 function keyOf(def: LWProcess.Definition, parts: string[]): string {
  const seg = parts[2];
  if (seg === undefined) return '';
  if ((seg === 'needs' || seg === 'outputs') && parts[3] !== undefined) return `${seg}.${parts[3]}`;
  if (seg === 'timing' || seg === 'draws' || seg === 'instances' || seg === 'deadline') return parts.slice(2).join('.');
  if (seg === 'resources' && parts[3] !== undefined) {
   const at = def.resources.findIndex(r => r.id === parts[3]);
   if (at >= 0) return `pools.${at}`;
  }
  return SEGMENTS[seg] ?? '';
 }
 function scope(def: LWProcess.Definition, stepId: string, diagnostics: LWProcess.Diagnostic[]): LWProcessStepModel.Scoped[] {
  const index = def.steps.findIndex(s => s.id === stepId), step = def.steps[index], out: LWProcessStepModel.Scoped[] = [];
  const own = def.flows.map((f, i) => f.from === stepId ? i : -1).filter(i => i >= 0);
  for (const d of diagnostics) {
   const parts = d.path.split('/').filter(Boolean);
   if (step && parts[0] === 'steps' && Number(parts[1]) === index) {
    const key = keyOf(def, parts);
    out.push({key, message: plain(def, step, key, d, parts), path: d.path});
   } else if (parts[0] === 'flows' && own.includes(Number(parts[1]))) {
    out.push({key: `flows.${own.indexOf(Number(parts[1]))}`, message: generic(d, parts) ?? d.message, path: d.path});
   }
  }
  return out;
 }
 const FIELD: Record<string, string> = {name: 'name', description: 'description', duration: 'duration', until: 'wait-until minute',
  cost: 'fixed cost', resources: 'pools', set: 'values', add: 'counters', needs: 'needs', backlog: 'backlog', technology: 'technology',
  phase: 'phase', emotion: 'feeling', pain: 'pain point', opportunity: 'opportunity', channel: 'channel', outcome: 'outcome',
  outputs: 'declared outputs', timing: 'random timing', draws: 'random outcomes', percent: 'percent', weight: 'weight', scene: 'scene',
  kind: 'kind', capacity: 'capacity', costPerMinute: 'cost per minute', count: 'cases', interval: 'interval', at: 'first arrival',
  when: 'condition', label: 'label', from: 'source', to: 'target'};
 function describePath(def: LWProcess.Definition, path: string): string {
  const parts = path.split('/').filter(Boolean), i = Number(parts[1]);
  const word = (p: string, first: boolean) => first ? FIELD[p] ?? p : /^\d+$/.test(p) ? String(Number(p) + 1) : FIELD[p] ?? p;
  const join = (head: string, rest: string[]) => rest.length ? `${head} › ${rest.map((p, k) => word(p, k === 0)).join(' ')}` : head;
  if (parts[0] === 'steps' && def.steps[i]) {
   const step = def.steps[i]!;
   if (parts[2] === 'resources' && parts[3]) return `${step.name} › ${def.resources.find(r => r.id === parts[3])?.name ?? parts[3]}`;
   return join(step.name, parts.slice(2));
  }
  if (parts[0] === 'flows' && def.flows[i]) {
   const f = def.flows[i]!, name = (id: string) => def.steps.find(s => s.id === id)?.name ?? id;
   return join(`Flow ${name(f.from)} to ${name(f.to)}`, parts.slice(2));
  }
  if (parts[0] === 'resources' && def.resources[i]) return join(`Pool ${def.resources[i]!.name}`, parts.slice(2));
  if (parts[0] === 'arrivals') return join(`Arrival ${i + 1}`, parts.slice(2));
  return parts.length ? join('Process', parts) : 'Process';
 }
 function elsewhere(def: LWProcess.Definition, stepId: string, diagnostics: LWProcess.Diagnostic[]): {where: string; message: string}[] {
  const mine = new Set(scope(def, stepId, diagnostics).map(i => i.path));
  return diagnostics.filter(d => !mine.has(d.path)).map(d => {
   const at = d.path.split('/').filter(Boolean), step = at[0] === 'steps' ? def.steps[Number(at[1])] : undefined;
   return {where: describePath(def, d.path), message: step ? scope(def, step.id, [d])[0]?.message ?? d.message : d.message};
  });
 }
 root.LWProcessStepChecks = {problems, scope, elsewhere, describePath};
})(globalThis);
