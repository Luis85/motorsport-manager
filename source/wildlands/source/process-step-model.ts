/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-step-logic.ts" />
/**
 * Pure form model for one process step. It reads a step into editable strings and writes the edits back into a copy of a
 * definition; it never touches the DOM, a session or storage. Work kinds are task (people pools), machine (machine pools),
 * system (system pools) and touchpoint (pools of any kind, optional); machine and system steps also carry a technology label, and
 * every work kind carries declared outputs. Every kind may carry journey notes (phase, feeling, pain point, opportunity), a
 * touchpoint adds a channel and an end step an outcome. Forks carry their branching mode (parallel or inclusive), work steps their multiple
 * instances and boundary deadline; the all/any/not condition tree, distributions and those fields are read, written and checked by LWProcessStepLogic.
 */
declare namespace LWProcessStepModel {
 type ValueType = 'text' | 'number' | 'true' | 'false' | 'null';
 /** A typed scalar kept as text so a half-typed number never changes its type. */
 interface Value {type: ValueType; text: string}
 interface SetRow {key: string; value: Value}
 interface AddRow {key: string; delta: string}
 interface NeedRow {field: string; op: string; value: Value; label: string}
 interface Backlog {on: boolean; capacity: string; order: 'fifo' | 'lifo' | 'priority'; priority: string; pull: string}
 /** `mode` 'chance' is a random share of cases: `chance` is the whole percent (1..99) as text. 'all', 'any' and 'not' are groups whose child rows are `items` (a `not` holds exactly one); `on` is meaningful on the top row only. */
 interface Cond {on: boolean; field: string; op: string; mode: 'value' | 'field' | 'chance' | 'all' | 'any' | 'not'; value: Value; valueField: string; chance: string; items?: Cond[]}
 interface FlowRow {id: string; to: string; toName: string; label: string; cond: Cond}
 /** `eligible` is true when this step's kind may demand the pool (people for tasks, machine for machine steps, system for system steps, any kind for touchpoints). */
 interface Pool {id: string; name: string; capacity: number; count: string; kind: LWProcess.ResourceKind; eligible: boolean}
 interface OutputRow {field: string; label: string}
 type DistKind = '' | LWProcess.Dist['dist'];
 /** Random timing kept as text; `dist` '' means none. `max` is the largest value (uniform, triangular), the optional cap (exponential) or the optional upper bound (normal, with the optional `min`); `sd` is the normal spread and `k` the Erlang phases. */
 interface Timing {dist: DistKind; min: string; mode: string; max: string; mean: string; sd: string; k: string}
 /** Multiple instances: `kind` 'count' (2..50) or 'field' (a case field holding 1..50), or 'none'. */
 interface Instances {kind: 'none' | 'count' | 'field'; count: string; field: string; mode: 'parallel' | 'sequential'}
 /** A boundary deadline: fixed minutes (`after`) or a random `timing`; `flow` is the id of the outgoing flow that becomes the deadline path. */
 interface Deadline {kind: 'none' | 'after' | 'timing'; after: string; timing: Timing; mode: 'interrupt' | 'escalate'; flow: string}
 interface ChoiceRow {value: Value; weight: string}
 /** One random case field; only the fields of its `kind` are written. */
 interface DrawRow {field: string; kind: LWProcess.Draw['kind']; percent: string; whenTrue: Value; whenFalse: Value; values: ChoiceRow[]; min: string; max: string}
 interface Model {
  id: string; kind: LWProcess.Kind; name: string; description: string; mode: 'duration' | 'until'; duration: string; until: string; cost: string; technology: string;
  pools: Pool[]; set: SetRow[]; add: AddRow[]; draws: DrawRow[]; timing: Timing; outputs: OutputRow[]; needs: NeedRow[]; backlog: Backlog | null; flows: FlowRow[];
  /** Forks only: how many branches start ('parallel' all, 'inclusive' those whose condition holds); null for other kinds. */
  branching: 'parallel' | 'inclusive' | null;
  /** Work steps only (null otherwise). */
  instances: Instances | null; deadline: Deadline | null;
  /** Journey notes as text: `emotion` is '' or a whole number -3..3; `channel` ('' or a channel id) is written on touchpoints only and `outcome` ('', goal or lost) on end steps only. */
  phase: string; emotion: string; channel: string; pain: string; opportunity: string; outcome: string;
  /** Phases already used by steps in the draft, in order of first use, for suggestions. Not written back. */
  phases: string[];
 }
 /** A message for a field in the model (`key` is the model path, e.g. `set.1.value`) that cannot be written faithfully. */
 interface Problem {key: string; message: string}
 /** An engine diagnostic scoped to this step. `key` is a model path prefix such as `duration`, `needs.2` or `flows.0`; '' is step-wide. */
 interface Scoped {key: string; message: string; path: string}
 interface Api {
  OPS: [string, string][];
  read(def: LWProcess.Definition, stepId: string): Model | undefined;
  write(def: LWProcess.Definition, stepId: string, model: Model): LWProcess.Definition;
  problems(model: Model): Problem[];
  scope(def: LWProcess.Definition, stepId: string, diagnostics: LWProcess.Diagnostic[]): Scoped[];
  /** Diagnostics that do not belong to this step (other steps, resources, arrivals), as readable text with the path translated to names. */
  elsewhere(def: LWProcess.Definition, stepId: string, diagnostics: LWProcess.Diagnostic[]): {where: string; message: string}[];
  /** 'Step name › duration' style text for a diagnostic path. */
  describePath(def: LWProcess.Definition, path: string): string;
  /** True for task, touchpoint, machine and system steps. */
  isWork(kind: LWProcess.Kind): boolean;
  /** The pool kind a work step may demand (people for a touchpoint, which also accepts the others: see acceptsPool). */
  poolKind(kind: LWProcess.Kind): LWProcess.ResourceKind;
  /** True when a step of this kind may demand a pool of that kind (touchpoints: any). */
  acceptsPool(kind: LWProcess.Kind, pool: LWProcess.ResourceKind): boolean;
  otherChanges(active: LWProcess.Definition, draft: LWProcess.Definition, stepId: string): boolean;
  needsSummary(model: Model): string;
  newValue(): Value;
  /** True when this model may carry random timing (work steps and duration timers). */
  timingAllowed(model: Model): boolean;
  /** Switches the distribution, filling empty parameters from the planning duration so the result is valid. `previous` is the kind it had. */
  chooseTiming(model: Model, dist: DistKind, previous?: DistKind): void;
  /** Switches a draw's kind and resets its parameters to a valid default. */
  chooseDraw(row: DrawRow, kind: LWProcess.Draw['kind']): void;
  newDraw(): DrawRow;
  /** 'Planning duration (12 min) stays the average shown in estimates; each visit draws its own time.' */
  timingNote(model: Model): string;
  /** True when this step is an inclusive fork (its flows carry conditions like a decision's). */
  inclusive(model: Model): boolean;
  /** Row limits shared by the model checks and the editor buttons. */
  LIMITS: {draws: number; choices: number; minChoices: number; phase: number; note: number};
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessStepModel?: LWProcessStepModel.Api; LWProcessLimits?: LWProcess.Limits; LWProcessStepLogic?: LWProcessStepLogic.Api};
 const OPS: [string, string][] = [['eq', 'equals'], ['ne', 'is not'], ['gt', 'greater than'], ['gte', 'at least'], ['lt', 'less than'], ['lte', 'at most']];
 const L = root.LWProcessStepLogic!, {numeric, whole, readValue, writeValue, newValue} = L;
 const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
 const isWork = (kind: LWProcess.Kind) => kind === 'task' || kind === 'touchpoint' || kind === 'machine' || kind === 'system';
 const poolKind = (kind: LWProcess.Kind): LWProcess.ResourceKind => kind === 'machine' ? 'machine' : kind === 'system' ? 'system' : 'people';
 const acceptsPool = (kind: LWProcess.Kind, pool: LWProcess.ResourceKind) => kind === 'touchpoint' || poolKind(kind) === pool;
 const assign = (target: Record<string, unknown>, key: string, value: unknown) => { if (value === undefined) delete target[key]; else target[key] = value; };
 const text = (n: number | undefined) => n === undefined ? '' : String(n);
 const readDraw = (d: LWProcess.Draw): LWProcessStepModel.DrawRow => ({field: d.field, kind: d.kind, percent: text(d.percent), whenTrue: readValue(Object.hasOwn(d, 'whenTrue') ? d.whenTrue : true), whenFalse: readValue(Object.hasOwn(d, 'whenFalse') ? d.whenFalse : false),
  values: (d.values ?? []).map(v => ({value: readValue(v.value), weight: String(v.weight)})), min: text(d.min), max: text(d.max)});
 const LIMITS = {draws: 8, choices: 12, minChoices: 2, phase: 40, note: 240};
 const timingAllowed = (m: LWProcessStepModel.Model) => isWork(m.kind) || m.kind === 'timer' && m.mode === 'duration';
 const chooseTiming = (m: LWProcessStepModel.Model, dist: LWProcessStepModel.DistKind, previous?: LWProcessStepModel.DistKind) => L.chooseDist(m.timing, whole(m.duration) ?? 1, dist, previous);
 function chooseDraw(r: LWProcessStepModel.DrawRow, kind: LWProcess.Draw['kind']): void {
  r.kind = kind;
  if (kind === 'chance') { r.percent = /^\d+$/.test(r.percent) ? r.percent : '10'; }
  else if (kind === 'choice' && r.values.length < 2) r.values = [{value: {type: 'text', text: 'A'}, weight: '1'}, {value: {type: 'text', text: 'B'}, weight: '1'}];
  else if (kind === 'int') { if (!/^-?\d+$/.test(r.min)) r.min = '1'; if (!/^-?\d+$/.test(r.max)) r.max = '6'; }
 }
 const newDraw = (): LWProcessStepModel.DrawRow => ({field: '', kind: 'chance', percent: '10', whenTrue: {type: 'true', text: ''}, whenFalse: {type: 'false', text: ''}, values: [], min: '1', max: '6'});
 const timingNote = (m: LWProcessStepModel.Model): string => `Planning duration (${m.duration.trim() === '' ? '?' : m.duration.trim()} min) stays the average shown in estimates; each visit draws its own time.`;
 function writeDraw(r: LWProcessStepModel.DrawRow): Record<string, unknown> {
  const out: Record<string, unknown> = {field: r.field, kind: r.kind};
  if (r.kind === 'chance') {
   out.percent = whole(r.percent) ?? 0;
   const yes = writeValue(r.whenTrue), no = writeValue(r.whenFalse);
   if (yes !== true) out.whenTrue = yes; if (no !== false) out.whenFalse = no;
  } else if (r.kind === 'choice') out.values = r.values.map(v => ({value: writeValue(v.value), weight: whole(v.weight) ?? 0}));
  else { out.min = whole(r.min) ?? 0; out.max = whole(r.max) ?? 0; }
  return out;
 }
 function read(def: LWProcess.Definition, stepId: string): LWProcessStepModel.Model | undefined {
  const step = def.steps.find(s => s.id === stepId); if (!step) return undefined;
  const names = new Map(def.steps.map(s => [s.id, s.name]));
  const flows = def.flows.filter(f => f.from === stepId).map(f => ({id: f.id, to: f.to, toName: names.get(f.to) ?? f.to, label: f.label ?? '', cond: L.readCond(f.on === 'deadline' ? undefined : f.when)}));
  const b = step.backlog;
  return {id: step.id, kind: step.kind, name: step.name, description: step.description ?? '', mode: step.until !== undefined ? 'until' : 'duration',
   duration: step.duration === undefined ? '' : String(step.duration), until: step.until === undefined ? '' : String(step.until), cost: step.cost === undefined ? '' : String(step.cost), technology: step.technology ?? '',
   pools: def.resources.map(r => ({id: r.id, name: r.name, capacity: r.capacity, count: String(step.resources?.[r.id] ?? 0), kind: r.kind ?? 'people', eligible: acceptsPool(step.kind, r.kind ?? 'people')})),
   draws: (step.draws ?? []).map(readDraw), timing: L.readTiming(step.timing),
   set: Object.entries(step.set ?? {}).map(([key, v]) => ({key, value: readValue(v)})), add: Object.entries(step.add ?? {}).map(([key, n]) => ({key, delta: String(n)})),
   outputs: (step.outputs ?? []).map(o => ({field: o.field, label: o.label ?? ''})),
   needs: (step.needs ?? []).map(n => ({field: n.field, op: n.op ?? '', value: readValue(n.value), label: n.label ?? ''})),
   phase: step.phase ?? '', emotion: step.emotion === undefined ? '' : String(step.emotion), channel: step.channel ?? '', pain: step.pain ?? '', opportunity: step.opportunity ?? '', outcome: step.outcome ?? '',
   phases: [...new Set(def.steps.flatMap(o => o.phase ? [o.phase] : []))],
   backlog: isWork(step.kind) || step.kind === 'join' ? {on: !!b, capacity: String(b?.capacity ?? 8), order: b?.order ?? 'fifo', priority: b?.priority ?? 'priority', pull: b?.pull === undefined ? '' : String(b.pull)} : null, flows,
   branching: step.kind === 'fork' ? (step.mode === 'inclusive' ? 'inclusive' : 'parallel') : null, instances: isWork(step.kind) ? L.readInstances(step) : null, deadline: isWork(step.kind) ? L.readDeadline(step) : null};
 }
 function writeStep(step: LWProcess.Step, m: LWProcessStepModel.Model): void {
  const s = step as unknown as Record<string, unknown>, work = isWork(step.kind), effects = work || step.kind === 'timer';
  s.name = m.name; assign(s, 'description', m.description.trim() === '' ? undefined : m.description);
  if (work) assign(s, 'duration', whole(m.duration));
  if (timingAllowed(m)) assign(s, 'timing', L.writeTiming(m.timing)); else if (step.kind === 'timer') delete s.timing;
  if (step.kind === 'timer') { assign(s, 'duration', m.mode === 'duration' ? whole(m.duration) : undefined); assign(s, 'until', m.mode === 'until' ? whole(m.until) : undefined); }
  if (work) {
   assign(s, 'cost', whole(m.cost)); const used = m.pools.filter(p => (whole(p.count) ?? 0) > 0);
   assign(s, 'resources', used.length ? Object.fromEntries(used.map(p => [p.id, whole(p.count)!])) : undefined);
   assign(s, 'outputs', m.outputs.length ? m.outputs.map(o => o.label.trim() === '' ? {field: o.field} : {field: o.field, label: o.label}) : undefined);
   if (m.instances) assign(s, 'instances', L.writeInstances(m.instances));
   if (m.deadline) assign(s, 'deadline', L.writeDeadline(m.deadline));
  }
  if (step.kind === 'fork') assign(s, 'mode', m.branching === 'inclusive' ? 'inclusive' : undefined);
  if (step.kind === 'machine' || step.kind === 'system') assign(s, 'technology', m.technology.trim() === '' ? undefined : m.technology.trim());
  assign(s, 'phase', m.phase.trim() === '' ? undefined : m.phase.trim()); assign(s, 'emotion', whole(m.emotion)); assign(s, 'pain', m.pain.trim() === '' ? undefined : m.pain); assign(s, 'opportunity', m.opportunity.trim() === '' ? undefined : m.opportunity);
  if (step.kind === 'touchpoint') assign(s, 'channel', m.channel === '' ? undefined : m.channel);
  if (step.kind === 'end') assign(s, 'outcome', m.outcome === '' ? undefined : m.outcome);
  if (effects) {
   assign(s, 'set', m.set.length ? Object.fromEntries(m.set.map(r => [r.key, writeValue(r.value)])) : undefined);
   assign(s, 'add', m.add.length ? Object.fromEntries(m.add.map(r => [r.key, whole(r.delta) ?? 0])) : undefined);
   assign(s, 'draws', m.draws.length ? m.draws.map(writeDraw) : undefined);
  }
  if (step.kind !== 'start') assign(s, 'needs', m.needs.length ? m.needs.map(n => {
   const need: Record<string, unknown> = {field: n.field}; if (n.op) { need.op = n.op; need.value = writeValue(n.value); } if (n.label.trim() !== '') need.label = n.label; return need;
  }) : undefined);
  if (m.backlog) assign(s, 'backlog', !m.backlog.on ? undefined : (() => {
   const b = m.backlog!, out: Record<string, unknown> = {capacity: whole(b.capacity) ?? 0, order: b.order};
   if (b.order === 'priority') out.priority = b.priority; if (step.kind === 'join' && whole(b.pull) !== undefined) out.pull = whole(b.pull); return out;
  })());
 }
 function write(def: LWProcess.Definition, stepId: string, m: LWProcessStepModel.Model): LWProcess.Definition {
  const next = clone(def), step = next.steps.find(s => s.id === stepId); if (!step) return next;
  writeStep(step, m);
  const slots = next.flows.flatMap((f, i) => f.from === stepId ? [i] : []), byId = new Map(next.flows.map(f => [f.id, f]));
  m.flows.forEach((row, k) => {
   const flow = byId.get(row.id); if (!flow || slots[k] === undefined) return; const f = flow as unknown as Record<string, unknown>;
   assign(f, 'label', row.label.trim() === '' ? undefined : row.label);
   const deadlineFlow = isWork(step.kind) && m.deadline !== null && L.isDeadlineFlow(m, row.id);
   if (isWork(step.kind)) assign(f, 'on', deadlineFlow ? 'deadline' : undefined);
   if (deadlineFlow) assign(f, 'when', undefined);
   else if (step.kind === 'decision' || step.kind === 'fork' || row.cond.on) assign(f, 'when', !row.cond.on || step.kind === 'fork' && m.branching !== 'inclusive' ? undefined : L.writeCond(row.cond));
   next.flows[slots[k]!] = flow;
  });
  return next;
 }
 function problems(m: LWProcessStepModel.Model): LWProcessStepModel.Problem[] {
  const out: LWProcessStepModel.Problem[] = [], value = (key: string, v: LWProcessStepModel.Value) => { if (v.type === 'number' && numeric(v.text) === undefined) out.push({key, message: 'Enter a number.'}); };
  const keys = (rows: {key: string}[], base: string) => rows.forEach((r, i) => {
   if (r.key.trim() === '') out.push({key: `${base}.${i}.key`, message: 'Name the field or remove this row.'});
   else if (rows.findIndex(o => o.key === r.key) !== i) out.push({key: `${base}.${i}.key`, message: `The field ${r.key} is listed twice.`});
  });
  keys(m.set, 'set'); keys(m.add, 'add'); m.set.forEach((r, i) => value(`set.${i}.value`, r.value));
  m.outputs.forEach((o, i) => {
   if (o.field.trim() === '') out.push({key: `outputs.${i}.field`, message: 'Name the output field or remove this row.'});
   else if (m.outputs.findIndex(x => x.field === o.field) !== i) out.push({key: `outputs.${i}.field`, message: `The output ${o.field} is listed twice.`});
  });
  if (m.technology.trim().length > 80) out.push({key: 'technology', message: 'Technology must be 80 characters or fewer.'});
  if (m.phase.trim().length > LIMITS.phase) out.push({key: 'phase', message: `Phase must be ${LIMITS.phase} characters or fewer.`});
  (['pain', 'opportunity'] as const).forEach(k => { if (m[k].trim().length > LIMITS.note) out.push({key: k, message: `${k === 'pain' ? 'Pain point' : 'Opportunity'} must be ${LIMITS.note} characters or fewer.`}); });
  m.add.forEach((r, i) => { if (whole(r.delta) === undefined) out.push({key: `add.${i}.delta`, message: 'Enter a whole number.'}); });
  m.needs.forEach((n, i) => { if (n.op) value(`needs.${i}.value`, n.value); });
  m.flows.forEach((f, i) => {
   if (f.cond.on && !L.isDeadlineFlow(m, f.id)) L.condProblems(f.cond, `flows.${i}.cond`, out);
  });
  if (timingAllowed(m)) L.distProblems(m.timing, 'timing', out);
  if (m.instances) L.instancesProblems(m.instances, out);
  L.deadlineProblems(m, out);
  m.draws.forEach((r, i) => drawProblems(m, r, i, out));
  return out;
 }
 const MAXM = () => root.LWProcessLimits?.minutes ?? 100000;
 const isInt = (t: string, lo: number, hi: number) => { const n = numeric(t); return n !== undefined && Number.isInteger(n) && n >= lo && n <= hi; };
 function drawProblems(m: LWProcessStepModel.Model, r: LWProcessStepModel.DrawRow, i: number, out: LWProcessStepModel.Problem[]): void {
  const at = (k: string, message: string) => out.push({key: `draws.${i}.${k}`, message}), name = r.field;
  if (name.trim() === '') at('field', 'Name the field or remove this row.');
  else if (!/^[a-z][a-zA-Z0-9_]{0,63}$/.test(name)) at('field', 'Start with a lowercase letter, then use letters, digits or underscores (up to 64 characters).');
  else if (m.draws.findIndex(o => o.field === name) !== i) at('field', `The field ${name} is drawn twice.`);
  else if (m.set.some(x => x.key === name)) at('field', `The field ${name} is also in Set a value; a field has one writer. Remove one of them.`);
  else if (r.kind !== 'int' && m.add.some(x => x.key === name)) at('field', `The field ${name} is also a counter; only a whole-number draw may feed a counter.`);
  if (r.kind === 'chance') {
   if (!isInt(r.percent, 1, 99)) at('percent', 'Enter a whole percent from 1 to 99.');
   [['whenTrue', r.whenTrue], ['whenFalse', r.whenFalse]].forEach(([k, v]) => { if ((v as LWProcessStepModel.Value).type === 'number' && numeric((v as LWProcessStepModel.Value).text) === undefined) at(`${k}.text`, 'Enter a number.'); });
   if (JSON.stringify(writeValue(r.whenTrue)) === JSON.stringify(writeValue(r.whenFalse))) at('whenFalse.type', 'The value for "yes" and the value for "no" must differ.');
  } else if (r.kind === 'choice') {
   r.values.forEach((v, j) => {
    if (!isInt(v.weight, 1, 1000)) at(`values.${j}.weight`, 'Enter a whole weight from 1 to 1,000.');
    if (v.value.type === 'number' && numeric(v.value.text) === undefined) at(`values.${j}.value.text`, 'Enter a number.');
    else if (r.values.findIndex(o => JSON.stringify(writeValue(o.value)) === JSON.stringify(writeValue(v.value))) !== j) at(`values.${j}.value.type`, 'Each value may appear once.');
   });
   if (r.values.length < LIMITS.minChoices || r.values.length > LIMITS.choices) at('values', `A weighted choice needs ${LIMITS.minChoices} to ${LIMITS.choices} values.`);
  } else {
   const lo = isInt(r.min, -1e9, 1e9), hi = isInt(r.max, -1e9, 1e9);
   if (!lo) at('min', 'Enter a whole number.'); if (!hi) at('max', 'Enter a whole number.');
   if (lo && hi && Number(r.min) > Number(r.max)) at('min', `The lowest (${r.min}) must not be above the highest (${r.max}).`);
  }
 }
 const SEGMENTS: Record<string, string> = {name: 'name', description: 'description', duration: 'duration', until: 'until', cost: 'cost', resources: 'pools', set: 'set', add: 'add', needs: 'needs', backlog: 'backlog', technology: 'technology', outputs: 'outputs', timing: 'timing', draws: 'draws', phase: 'phase', emotion: 'emotion', pain: 'pain', opportunity: 'opportunity', channel: 'channel', outcome: 'outcome', mode: 'branching', instances: 'instances', deadline: 'deadline'};
 const KIND_NAME: Partial<Record<LWProcess.Kind, [string, string]>> = {task: ['Task', 'Tasks'], touchpoint: ['Touchpoint', 'Touchpoints'], machine: ['Machine step', 'Machine steps'], system: ['System step', 'System steps'], timer: ['Timer', 'Timers']};
 const group = (n: number) => n.toLocaleString('en-US');
 /** Rewrites an engine diagnostic for this step into plain language that names the field and its allowed range. */
 function plain(def: LWProcess.Definition, step: LWProcess.Step, key: string, d: LWProcess.Diagnostic, parts: string[]): string {
  const kind = KIND_NAME[step.kind]?.[0] ?? 'Step', limits = root.LWProcessLimits, minutes = limits?.minutes ?? 100000, shape = d.code === 'shape', mapped = L.plain(key, d, parts);
  if (mapped) return mapped;
  if (key === 'duration') {
   const label = step.kind === 'timer' ? 'Wait duration' : `${kind} duration`;
   if (/positive whole-minute duration/.test(d.message)) return `${label} must be 1 or more`;
   if (shape) return `${label} must be a whole number from 1 to ${group(minutes)}`;
  }
  if (key === 'until' && shape) return `Wait-until minute must be a whole number from 1 to ${group(minutes - 1)}`;
  if (key === 'cost' && shape) return 'Fixed cost must be a whole number from 0 to 100,000,000';
  if (key === 'technology' && shape) return 'Technology must be 1 to 80 characters';
  if (key === 'phase' && shape) return `Phase must be 1 to ${LIMITS.phase} characters`;
  if (key === 'emotion' && shape) return 'Feeling must be a whole number from -3 to 3';
  if ((key === 'pain' || key === 'opportunity') && shape) return `${key === 'pain' ? 'Pain point' : 'Opportunity'} must be 1 to ${LIMITS.note} characters`;
  if (key === 'channel' && /only on touchpoint/.test(d.message)) return 'A channel can be set only on touchpoint steps';
  if (key === 'outcome' && /only on end/.test(d.message)) return 'An outcome can be set only on end steps';
  if (key === 'backlog' && shape && parts[3] === 'capacity') return `Backlog capacity must be a whole number from 1 to ${group(limits?.cases ?? 200)}`;
  if (key === 'backlog' && shape && parts[3] === 'pull') return `Pull limit must be a whole number from 1 to ${group(limits?.cases ?? 200)}`;
  if (key.startsWith('pools.') || key === 'pools') {
   const pool = def.resources.find(r => r.id === parts[3]);
   if (pool && /Demand exceeds/.test(d.message)) return `${pool.name} has only ${pool.capacity} available; ask for ${pool.capacity} or fewer`;
   if (pool && /may demand only/.test(d.message)) return `${pool.name} is a ${pool.kind ?? 'people'} pool, but ${(KIND_NAME[step.kind]?.[1] ?? 'Steps').toLowerCase()} may use only ${poolKind(step.kind)} pools. Set it to 0`;
   if (/must demand at least one/.test(d.message)) return `Choose at least one ${step.kind} pool and ask for 1 or more`;
  }
  return d.message;
 }
 function scope(def: LWProcess.Definition, stepId: string, diagnostics: LWProcess.Diagnostic[]): LWProcessStepModel.Scoped[] {
  const index = def.steps.findIndex(s => s.id === stepId), step = def.steps[index], own = def.flows.map((f, i) => f.from === stepId ? i : -1).filter(i => i >= 0), out: LWProcessStepModel.Scoped[] = [];
  for (const d of diagnostics) {
   const parts = d.path.split('/').filter(Boolean);
   if (step && parts[0] === 'steps' && Number(parts[1]) === index) {
    const seg = parts[2];
    let key = seg === undefined ? '' : seg === 'needs' && parts[3] !== undefined ? `needs.${parts[3]}` : seg === 'outputs' && parts[3] !== undefined ? `outputs.${parts[3]}` : seg === 'timing' || seg === 'draws' || seg === 'instances' || seg === 'deadline' ? parts.slice(2).join('.') : SEGMENTS[seg] ?? '';
    if (seg === 'resources' && parts[3] !== undefined) { const at = def.resources.findIndex(r => r.id === parts[3]); if (at >= 0) key = `pools.${at}`; }
    out.push({key, message: plain(def, step, key, d, parts), path: d.path});
   } else if (parts[0] === 'flows' && own.includes(Number(parts[1]))) out.push({key: `flows.${own.indexOf(Number(parts[1]))}`, message: d.message, path: d.path});
  }
  return out;
 }
 const FIELD: Record<string, string> = {name: 'name', description: 'description', duration: 'duration', until: 'wait-until minute', cost: 'fixed cost', resources: 'pools', set: 'values', add: 'counters', needs: 'needs', backlog: 'backlog', technology: 'technology', phase: 'phase', emotion: 'feeling', pain: 'pain point', opportunity: 'opportunity', channel: 'channel', outcome: 'outcome', outputs: 'declared outputs', timing: 'random timing', draws: 'random outcomes', percent: 'percent', weight: 'weight', scene: 'scene', kind: 'kind', capacity: 'capacity', costPerMinute: 'cost per minute', count: 'cases', interval: 'interval', at: 'first arrival', when: 'condition', label: 'label', from: 'source', to: 'target'};
 function describePath(def: LWProcess.Definition, path: string): string {
  const parts = path.split('/').filter(Boolean), tail = (rest: string[]) => rest.map((p, i) => i === 0 ? FIELD[p] ?? p : /^\d+$/.test(p) ? String(Number(p) + 1) : FIELD[p] ?? p).join(' ');
  const join = (head: string, rest: string[]) => rest.length ? `${head} › ${tail(rest)}` : head, i = Number(parts[1]);
  if (parts[0] === 'steps' && def.steps[i]) {
   const step = def.steps[i]!;
   if (parts[2] === 'resources' && parts[3]) return `${step.name} › ${def.resources.find(r => r.id === parts[3])?.name ?? parts[3]}`;
   return join(step.name, parts.slice(2));
  }
  if (parts[0] === 'flows' && def.flows[i]) { const f = def.flows[i]!, name = (id: string) => def.steps.find(s => s.id === id)?.name ?? id; return join(`Flow ${name(f.from)} to ${name(f.to)}`, parts.slice(2)); }
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
 function otherChanges(active: LWProcess.Definition, draft: LWProcess.Definition, stepId: string): boolean {
  const rest = (d: LWProcess.Definition) => JSON.stringify({...d, revision: 0, steps: d.steps.filter(s => s.id !== stepId), flows: d.flows.filter(f => f.from !== stepId)});
  return rest(active) !== rest(draft);
 }
 function needsSummary(m: LWProcessStepModel.Model): string {
  const used = m.pools.filter(p => (whole(p.count) ?? 0) > 0).map(p => `${whole(p.count)} ${p.name}`), none = m.kind === 'task' ? 'no shared people' : m.kind === 'touchpoint' ? 'no backstage teams or systems' : m.kind === 'machine' ? 'no equipment' : 'no systems';
  return used.length ? 'Needs: ' + used.join(', ') : 'Needs: ' + none;
 }
 root.LWProcessStepModel = {OPS, read, write, problems, scope, elsewhere, describePath, isWork, poolKind, acceptsPool, otherChanges, needsSummary, newValue, timingAllowed, chooseTiming, chooseDraw, newDraw, timingNote, inclusive: m => m.branching === 'inclusive', LIMITS};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessStepModel;
})(globalThis);
