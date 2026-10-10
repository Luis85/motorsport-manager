/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-step-logic.ts" />
/// <reference path="./process-random-view.ts" />
/**
 * Pure form model for one process step. It reads a step into editable strings and writes the edits back into a copy of a
 * definition; it never touches the DOM, a session or storage. Work kinds are task (people pools), machine (machine pools),
 * system (system pools) and touchpoint (pools of any kind, optional); machine and system steps also carry a technology label, and
 * every work kind carries declared outputs. Every kind may carry journey notes (phase, feeling, pain point, opportunity), a
 * touchpoint adds a channel and an end step an outcome. Forks carry their branching mode (parallel or inclusive), work steps
 * their multiple instances and boundary deadline; the all/any/not condition tree, distributions and those fields are read,
 * written and checked by LWProcessStepLogic. The local representation checks and the plain-language engine diagnostics of the
 * model live in LWProcessStepChecks (process-step-checks.ts).
 */
declare namespace LWProcessStepModel {
 type ValueType = 'text' | 'number' | 'true' | 'false' | 'null';
 /** A typed scalar kept as text so a half-typed number never changes its type. */
 interface Value {type: ValueType; text: string}
 interface SetRow {key: string; value: Value}
 interface AddRow {key: string; delta: string}
 interface NeedRow {field: string; op: string; value: Value; label: string}
 interface Backlog {on: boolean; capacity: string; order: 'fifo' | 'lifo' | 'priority'; priority: string; pull: string}
 /**
  * `mode` 'chance' is a random share of cases: `chance` is the whole percent (1..99) as text. 'all', 'any' and 'not' are groups
  * whose child rows are `items` (a `not` holds exactly one); `on` is meaningful on the top row only.
  */
 interface Cond {
  on: boolean; field: string; op: string; mode: 'value' | 'field' | 'chance' | 'all' | 'any' | 'not';
  value: Value; valueField: string; chance: string; items?: Cond[];
 }
 interface FlowRow {id: string; to: string; toName: string; label: string; cond: Cond}
 /**
  * `eligible` is true when this step's kind may demand the pool (people for tasks, machine for machine steps, system for system
  * steps, any kind for touchpoints).
  */
 interface Pool {id: string; name: string; capacity: number; count: string; kind: LWProcess.ResourceKind; eligible: boolean}
 interface OutputRow {field: string; label: string}
 type DistKind = '' | LWProcess.Dist['dist'];
 /**
  * Random timing kept as text; `dist` '' means none. `max` is the largest value (uniform, triangular), the optional cap
  * (exponential) or the optional upper bound (normal, with the optional `min`); `sd` is the normal spread and `k` the Erlang phases.
  */
 interface Timing {dist: DistKind; min: string; mode: string; max: string; mean: string; sd: string; k: string}
 /** Multiple instances: `kind` 'count' (2..50) or 'field' (a case field holding 1..50), or 'none'. */
 interface Instances {kind: 'none' | 'count' | 'field'; count: string; field: string; mode: 'parallel' | 'sequential'}
 /** A boundary deadline: fixed minutes (`after`) or a random `timing`; `flow` is the id of the outgoing flow that becomes the deadline path. */
 interface Deadline {kind: 'none' | 'after' | 'timing'; after: string; timing: Timing; mode: 'interrupt' | 'escalate'; flow: string}
 interface ChoiceRow {value: Value; weight: string}
 /** One random case field; only the fields of its `kind` are written. */
 interface DrawRow {
  field: string; kind: LWProcess.Draw['kind']; percent: string; whenTrue: Value; whenFalse: Value; values: ChoiceRow[];
  min: string; max: string;
 }
 interface Model {
  id: string; kind: LWProcess.Kind; name: string; description: string; mode: 'duration' | 'until';
  duration: string; until: string; cost: string; technology: string;
  pools: Pool[]; set: SetRow[]; add: AddRow[]; draws: DrawRow[]; timing: Timing; outputs: OutputRow[]; needs: NeedRow[];
  backlog: Backlog | null; flows: FlowRow[];
  /** Forks only: how many branches start ('parallel' all, 'inclusive' those whose condition holds); null for other kinds. */
  branching: 'parallel' | 'inclusive' | null;
  /** Work steps only (null otherwise). */
  instances: Instances | null; deadline: Deadline | null;
  /**
   * Journey notes as text: `emotion` is '' or a whole number -3..3; `channel` ('' or a channel id) is written on touchpoints only
   * and `outcome` ('', goal or lost) on end steps only.
   */
  phase: string; emotion: string; channel: string; pain: string; opportunity: string; outcome: string;
  /** Phases already used by steps in the draft, in order of first use, for suggestions. Not written back. */
  phases: string[];
  /** Every step of the draft (id, name, kind) in draft order, for choosing where a path goes. Not written back. */
  others: {id: string; name: string; kind: LWProcess.Kind}[];
  /** Every flow id in the draft when the step was read, so a new path never reuses one. Not written back. */
  flowIds: string[];
  /** Case field names for suggestions: delivered before this step, available to its outgoing conditions, and every known one. Not written back. */
  fieldNames: {earlier: string[]; after: string[]; all: string[]};
 }
 /** A message for a field in the model (`key` is the model path, e.g. `set.1.value`) that cannot be written faithfully. */
 interface Problem {key: string; message: string}
 /** An engine diagnostic scoped to this step. `key` is a model path prefix such as `duration`, `needs.2` or `flows.0`; '' is step-wide. */
 interface Scoped {key: string; message: string; path: string}
 interface Api {
  OPS: [string, string][];
  read(def: LWProcess.Definition, stepId: string): Model | undefined;
  write(def: LWProcess.Definition, stepId: string, model: Model): LWProcess.Definition;
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
  /**
   * The note beside random timing, following the inspector's rule (LWProcessRandomView.meanOf): while the draws average within 5%
   * of the planning duration (or the average is unknown), 'Planning duration (12 min) stays the average shown in estimates; each
   * visit draws its own time.'; otherwise 'Planning duration 720 min; draws average about 920 min.'
   */
  timingNote(model: Model): string;
  /** True when this step is an inclusive fork (its flows carry conditions like a decision's). */
  inclusive(model: Model): boolean;
  /** Row limits shared by the model checks and the editor buttons. */
  LIMITS: {draws: number; choices: number; minChoices: number; phase: number; note: number};
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessStepModel?: LWProcessStepModel.Api; LWProcessLimits?: LWProcess.Limits;
  LWProcessStepLogic?: LWProcessStepLogic.Api; LWProcessRandomView?: LWProcessRandomView.Api};
 type M = LWProcessStepModel.Model;
 const OPS: [string, string][] = [['eq', 'equals'], ['ne', 'is not'], ['gt', 'greater than'], ['gte', 'at least'], ['lt', 'less than'],
  ['lte', 'at most']];
 const L = root.LWProcessStepLogic!, {whole, readValue, writeValue, newValue} = L;
 const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
 const isWork = (kind: LWProcess.Kind) => kind === 'task' || kind === 'touchpoint' || kind === 'machine' || kind === 'system';
 const poolKind = (kind: LWProcess.Kind): LWProcess.ResourceKind => kind === 'machine' ? 'machine' : kind === 'system' ? 'system' : 'people';
 const acceptsPool = (kind: LWProcess.Kind, pool: LWProcess.ResourceKind) => kind === 'touchpoint' || poolKind(kind) === pool;
 /** Sets an optional property, or removes it when `value` is undefined (absent, never an explicit undefined). */
 function put<T extends object, K extends keyof T>(target: T, key: K, value: Exclude<T[K], undefined> | undefined): void {
  if (value === undefined) delete target[key];
  else target[key] = value;
 }
 const text = (n: number | undefined) => n === undefined ? '' : String(n);
 const readDraw = (d: LWProcess.Draw): LWProcessStepModel.DrawRow => ({
  field: d.field, kind: d.kind, percent: text(d.percent),
  whenTrue: readValue(Object.hasOwn(d, 'whenTrue') ? d.whenTrue : true), whenFalse: readValue(Object.hasOwn(d, 'whenFalse') ? d.whenFalse : false),
  values: (d.values ?? []).map(v => ({value: readValue(v.value), weight: String(v.weight)})), min: text(d.min), max: text(d.max),
 });
 const LIMITS = {draws: 8, choices: 12, minChoices: 2, phase: 40, note: 240};
 const timingAllowed = (m: M) => isWork(m.kind) || m.kind === 'timer' && m.mode === 'duration';
 const chooseTiming = (m: M, dist: LWProcessStepModel.DistKind, previous?: LWProcessStepModel.DistKind) =>
  L.chooseDist(m.timing, whole(m.duration) ?? 1, dist, previous);
 function chooseDraw(r: LWProcessStepModel.DrawRow, kind: LWProcess.Draw['kind']): void {
  r.kind = kind;
  if (kind === 'chance') r.percent = /^\d+$/.test(r.percent) ? r.percent : '10';
  else if (kind === 'choice' && r.values.length < 2) {
   r.values = [{value: {type: 'text', text: 'A'}, weight: '1'}, {value: {type: 'text', text: 'B'}, weight: '1'}];
  } else if (kind === 'int') {
   if (!/^-?\d+$/.test(r.min)) r.min = '1';
   if (!/^-?\d+$/.test(r.max)) r.max = '6';
  }
 }
 const newDraw = (): LWProcessStepModel.DrawRow => ({field: '', kind: 'chance', percent: '10', whenTrue: {type: 'true', text: ''},
  whenFalse: {type: 'false', text: ''}, values: [], min: '1', max: '6'});
 /** A displayed average, as the inspector shows it: whole minutes from 100 up, one decimal below. */
 const average = (n: number) => n >= 100 ? String(Math.round(n)) : String(Math.round(n * 10) / 10);
 function timingNote(m: M): string {
  const planned = whole(m.duration), shown = m.duration.trim() === '' ? '?' : m.duration.trim();
  const mean = planned !== undefined && planned > 0 ? root.LWProcessRandomView?.meanOf(L.writeTiming(m.timing)) ?? null : null;
  // The planning duration is what estimates use; when the draws average more than 5% away from it, say so instead.
  if (mean !== null && planned !== undefined && Math.abs(mean - planned) / planned > .05) {
   return `Planning duration ${planned} min; draws average about ${average(mean)} min.`;
  }
  return `Planning duration (${shown} min) stays the average shown in estimates; each visit draws its own time.`;
 }
 function writeDraw(r: LWProcessStepModel.DrawRow): LWProcess.Draw {
  if (r.kind === 'chance') {
   const yes = writeValue(r.whenTrue), no = writeValue(r.whenFalse);
   return {field: r.field, kind: r.kind, percent: whole(r.percent) ?? 0, ...yes !== true ? {whenTrue: yes} : {}, ...no !== false ? {whenFalse: no} : {}};
  }
  if (r.kind === 'choice') {
   return {field: r.field, kind: r.kind, values: r.values.map(v => ({value: writeValue(v.value), weight: whole(v.weight) ?? 0}))};
  }
  return {field: r.field, kind: r.kind, min: whole(r.min) ?? 0, max: whole(r.max) ?? 0};
 }
 function readBacklog(step: LWProcess.Step): LWProcessStepModel.Backlog | null {
  if (!isWork(step.kind) && step.kind !== 'join') return null;
  const b = step.backlog;
  return {on: !!b, capacity: String(b?.capacity ?? 8), order: b?.order ?? 'fifo', priority: b?.priority ?? 'priority', pull: text(b?.pull)};
 }
 function read(def: LWProcess.Definition, stepId: string): M | undefined {
  const step = def.steps.find(s => s.id === stepId);
  if (!step) return undefined;
  const names = new Map(def.steps.map(s => [s.id, s.name]));
  const flows = def.flows.filter(f => f.from === stepId).map(f => ({id: f.id, to: f.to, toName: names.get(f.to) ?? f.to, label: f.label ?? '',
   cond: L.readCond(f.on === 'deadline' ? undefined : f.when)}));
  const pools = def.resources.map(r => ({id: r.id, name: r.name, capacity: r.capacity, count: String(step.resources?.[r.id] ?? 0),
   kind: r.kind ?? 'people', eligible: acceptsPool(step.kind, r.kind ?? 'people')}));
  return {
   id: step.id, kind: step.kind, name: step.name, description: step.description ?? '', mode: step.until !== undefined ? 'until' : 'duration',
   duration: text(step.duration), until: text(step.until), cost: text(step.cost), technology: step.technology ?? '',
   pools, draws: (step.draws ?? []).map(readDraw), timing: L.readTiming(step.timing),
   set: Object.entries(step.set ?? {}).map(([key, v]) => ({key, value: readValue(v)})),
   add: Object.entries(step.add ?? {}).map(([key, n]) => ({key, delta: String(n)})),
   outputs: (step.outputs ?? []).map(o => ({field: o.field, label: o.label ?? ''})),
   needs: (step.needs ?? []).map(n => ({field: n.field, op: n.op ?? '', value: readValue(n.value), label: n.label ?? ''})),
   phase: step.phase ?? '', emotion: text(step.emotion), channel: step.channel ?? '', pain: step.pain ?? '',
   opportunity: step.opportunity ?? '', outcome: step.outcome ?? '',
   phases: [...new Set(def.steps.flatMap(o => o.phase ? [o.phase] : []))],
   others: def.steps.map(o => ({id: o.id, name: o.name, kind: o.kind})), flowIds: def.flows.map(f => f.id), fieldNames: suggest(def, stepId),
   backlog: readBacklog(step), flows,
   branching: step.kind === 'fork' ? (step.mode === 'inclusive' ? 'inclusive' : 'parallel') : null,
   instances: isWork(step.kind) ? L.readInstances(step) : null, deadline: isWork(step.kind) ? L.readDeadline(step) : null,
  };
 }
 /** The case fields one step writes when it completes. */
 const writes = (s: LWProcess.Step) => [...Object.keys(s.set ?? {}), ...Object.keys(s.add ?? {}), ...(s.draws ?? []).map(d => d.field)];
 /** Field-name suggestions: arrival fields and the writes of steps upstream of `stepId` (earlier), plus its own writes (after), and all. */
 function fieldNames(def: LWProcess.Definition, stepId: string): M['fieldNames'] {
  const upstream = new Set<string>(), queue = [stepId];
  while (queue.length) {
   const at = queue.shift();
   for (const f of def.flows) {
    if (f.to !== at || upstream.has(f.from)) continue;
    upstream.add(f.from);
    queue.push(f.from);
   }
  }
  const arrivals = (def.arrivals ?? []).flatMap(a => [...Object.keys(a.data ?? {}), ...(a.draws ?? []).map(d => d.field)]);
  const own = def.steps.find(s => s.id === stepId), sorted = (names: string[]) => [...new Set(names.filter(n => typeof n === 'string' && n))].sort();
  const earlier = sorted([...arrivals, ...def.steps.filter(s => upstream.has(s.id)).flatMap(writes)]);
  const all = sorted([...arrivals, ...def.steps.flatMap(writes), ...(def.track ?? []).map(t => t.field)]);
  return {earlier, after: sorted([...earlier, ...own ? writes(own) : []]), all};
 }
 /** Suggestions are a convenience: a draft too malformed to scan simply offers none. */
 function suggest(def: LWProcess.Definition, stepId: string): M['fieldNames'] {
  try {
   return fieldNames(def, stepId);
  } catch {
   return {earlier: [], after: [], all: []};
  }
 }
 const blank = (value: string) => value.trim() === '' ? undefined : value;
 const trimmed = (value: string) => value.trim() === '' ? undefined : value.trim();
 /** Timing, cost, pools, outputs, instances and the deadline of work steps and timers. */
 function writeWork(step: LWProcess.Step, m: M): void {
  const work = isWork(step.kind);
  if (work) put(step, 'duration', whole(m.duration));
  if (timingAllowed(m)) put(step, 'timing', L.writeTiming(m.timing));
  else if (step.kind === 'timer') put(step, 'timing', undefined);
  if (step.kind === 'timer') {
   put(step, 'duration', m.mode === 'duration' ? whole(m.duration) : undefined);
   put(step, 'until', m.mode === 'until' ? whole(m.until) : undefined);
  }
  if (!work) return;
  put(step, 'cost', whole(m.cost));
  const used = m.pools.flatMap(p => {
   const n = whole(p.count) ?? 0;
   return n > 0 ? [[p.id, n] as const] : [];
  });
  put(step, 'resources', used.length ? Object.fromEntries(used) : undefined);
  put(step, 'outputs', m.outputs.length ? m.outputs.map(o => o.label.trim() === '' ? {field: o.field} : {field: o.field, label: o.label}) : undefined);
  if (m.instances) put(step, 'instances', L.writeInstances(m.instances));
  if (m.deadline) put(step, 'deadline', L.writeDeadline(m.deadline));
 }
 function writeStep(step: LWProcess.Step, m: M): void {
  step.name = m.name;
  put(step, 'description', blank(m.description));
  writeWork(step, m);
  if (step.kind === 'fork') put(step, 'mode', m.branching === 'inclusive' ? 'inclusive' : undefined);
  if (step.kind === 'machine' || step.kind === 'system') put(step, 'technology', trimmed(m.technology));
  put(step, 'phase', trimmed(m.phase));
  put(step, 'emotion', whole(m.emotion));
  put(step, 'pain', blank(m.pain));
  put(step, 'opportunity', blank(m.opportunity));
  // Channel and outcome come from fixed option lists; the catalog still validates whatever the draft holds.
  if (step.kind === 'touchpoint') put(step, 'channel', m.channel === '' ? undefined : m.channel as LWProcess.Channel);
  if (step.kind === 'end') put(step, 'outcome', m.outcome === '' ? undefined : m.outcome as 'goal' | 'lost');
  if (isWork(step.kind) || step.kind === 'timer') {
   put(step, 'set', m.set.length ? Object.fromEntries(m.set.map(r => [r.key, writeValue(r.value)])) : undefined);
   put(step, 'add', m.add.length ? Object.fromEntries(m.add.map(r => [r.key, whole(r.delta) ?? 0])) : undefined);
   put(step, 'draws', m.draws.length ? m.draws.map(writeDraw) : undefined);
  }
  if (step.kind !== 'start') {
   const need = (n: LWProcessStepModel.NeedRow): LWProcess.Need => ({field: n.field,
    ...n.op ? {op: n.op as LWProcess.Condition['op'], value: writeValue(n.value)} : {}, ...n.label.trim() !== '' ? {label: n.label} : {}});
   put(step, 'needs', m.needs.length ? m.needs.map(need) : undefined);
  }
  if (m.backlog) {
   const b = m.backlog, pull = step.kind === 'join' ? whole(b.pull) : undefined;
   const kept = {capacity: whole(b.capacity) ?? 0, order: b.order, ...b.order === 'priority' ? {priority: b.priority} : {},
    ...pull !== undefined ? {pull} : {}};
   put(step, 'backlog', b.on ? kept : undefined);
  }
 }
 function write(def: LWProcess.Definition, stepId: string, m: M): LWProcess.Definition {
  const next = clone(def), step = next.steps.find(s => s.id === stepId);
  if (!step) return next;
  writeStep(step, m);
  const slots = next.flows.flatMap((f, i) => f.from === stepId ? [i] : []), byId = new Map(next.flows.map(f => [f.id, f]));
  // Each row is an existing flow of this step (updated in place) or a path added in the editor; removed paths are dropped.
  const rows = m.flows.map(row => {
   const known = byId.get(row.id), flow: LWProcess.Flow = known && known.from === stepId ? known : {id: row.id, from: stepId, to: row.to};
   flow.to = row.to;
   put(flow, 'label', blank(row.label));
   const deadlineFlow = isWork(step.kind) && m.deadline !== null && L.isDeadlineFlow(m, row.id);
   if (isWork(step.kind)) put(flow, 'on', deadlineFlow ? 'deadline' : undefined);
   if (deadlineFlow) put(flow, 'when', undefined);
   else if (step.kind === 'decision' || step.kind === 'fork' || row.cond.on) {
    const unconditional = !row.cond.on || step.kind === 'fork' && m.branching !== 'inclusive';
    put(flow, 'when', unconditional ? undefined : L.writeCond(row.cond));
   }
   return flow;
  });
  // Same number of paths: keep each in its slot of the flow list. Otherwise the step's paths move together to where its first one was.
  if (rows.length === slots.length) rows.forEach((flow, k) => { next.flows[slots[k]!] = flow; });
  else {
   const at = slots[0] ?? next.flows.length;
   next.flows = next.flows.filter(f => f.from !== stepId);
   next.flows.splice(at, 0, ...rows);
  }
  return next;
 }
 function otherChanges(active: LWProcess.Definition, draft: LWProcess.Definition, stepId: string): boolean {
  const rest = (d: LWProcess.Definition) =>
   JSON.stringify({...d, revision: 0, steps: d.steps.filter(s => s.id !== stepId), flows: d.flows.filter(f => f.from !== stepId)});
  return rest(active) !== rest(draft);
 }
 const NONE: Partial<Record<LWProcess.Kind, string>> = {task: 'no shared people', touchpoint: 'no backstage teams or systems', machine: 'no equipment'};
 function needsSummary(m: M): string {
  const used = m.pools.filter(p => (whole(p.count) ?? 0) > 0).map(p => `${whole(p.count)} ${p.name}`);
  return 'Needs: ' + (used.length ? used.join(', ') : NONE[m.kind] ?? 'no systems');
 }
 root.LWProcessStepModel = {OPS, read, write, isWork, poolKind, acceptsPool, otherChanges, needsSummary, newValue, timingAllowed, chooseTiming,
  chooseDraw, newDraw, timingNote, inclusive: m => m.branching === 'inclusive', LIMITS};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessStepModel;
})(globalThis);
