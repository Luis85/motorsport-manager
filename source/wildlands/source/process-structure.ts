/// <reference path="./process-contracts.d.ts" />
/**
 * Structural step editing (owner: the authoring package): turns one structural intent (add, duplicate, delete a step, change its
 * kind, make a step the start) into a NEW draft definition. Each operation builds a revision/fingerprint guarded recipe and applies
 * it through `LWProcessAuthoring.edit(input, recipe, true)` in draft mode, so a result may still carry graph diagnostics (an
 * unconnected step, a decision with one path); they are returned with the result and the catalog alone judges validity.
 *
 * Contract:
 *  - pure: no DOM, session, clock or storage; the same input and intent always give the same result;
 *  - every result keeps the input's `revision` (applying assigns the next one) and returns a removal-style `label`
 *    ("Added step Review", "Deleted step Review", "Changed Review to a timer") the caller passes to `LWProcessDraft.write`, so the
 *    Definition editor's undo history covers it, plus `notes`: plain sentences about what was dropped, removed or reconnected;
 *  - a refused intent returns `{ok: false, reason}` and changes nothing (deleting the start step, a draft with structural
 *    problems, a full process);
 *  - new steps get a unique id from the name (a slug, numbered when taken), the scene id `scene-<id>`, a colour by kind, a position
 *    in the next free grid cell right of the `after` step (x steps of 14, y offsets of ±10 when a cell is occupied) and the kind's
 *    minimal fields (task and touchpoint `duration: 5`, timer `duration: 60`, machine and system `duration: 5` and one unit of the first
 *    pool of their kind when there is one, a fork the first join no fork owns). New steps are placed after `after` in draft order.
 */
declare namespace LWProcessStructure {
 type AddKind = 'task' | 'touchpoint' | 'machine' | 'system' | 'timer' | 'decision' | 'fork' | 'join' | 'end';
 interface Done {
  ok: true;
  definition: LWProcess.Definition;
  /** The catalog's draft diagnostics of the new definition. */
  diagnostics: LWProcess.Diagnostic[];
  /** What the edit did, for the draft history: "Added step Review". */
  label: string;
  /** The step to show next: the added or duplicated step, the changed step, or '' after a delete. */
  stepId: string;
  /** Plain sentences: dropped fields, removed and reconnected paths, things the catalog will report. */
  notes: string[];
 }
 interface Refused {ok: false; reason: string}
 type Result = Done | Refused;
 interface AddOptions {
  kind: AddKind;
  /** Display name; blank gives "New <kind>". */
  name: string;
  /** Place the step right of this step (and after it in draft order). Default: right of the rightmost step, at the end. */
  after?: string | undefined;
  /** Insert into the single outgoing path of `after` (after → new → old target). Ignored when `insertable` says no. */
  insert?: boolean;
 }
 /** What deleting a step would do, for the confirm. `reconnect` is set when every predecessor can be pointed at one target. */
 interface Removal {
  blocked: string;
  name: string;
  incoming: {id: string; from: string; fromName: string}[];
  outgoing: {id: string; to: string; toName: string; deadline: boolean}[];
  reconnect: {to: string; toName: string; from: string[]} | null;
 }
 interface Api {
  /** The kinds a new step may have, with their labels, in menu order. */
  KINDS: [AddKind, string][];
  /** The colour a step of this kind gets (a lost end is red). */
  colorOf(kind: LWProcess.Kind, outcome?: string): string;
  /** A unique step id for `name`: a slug, numbered when taken, short enough for its scene id. */
  newId(definition: LWProcess.Definition, name: string): string;
  /** The free grid cell right of `after` (or of the rightmost step). */
  freeCell(definition: LWProcess.Definition, after?: string): [number, number];
  /** The single outgoing (non-deadline) path of `after` a new step could be inserted into, or null. */
  insertable(definition: LWProcess.Definition, after: string): {flow: string; to: string; toName: string} | null;
  add(definition: LWProcess.Definition, options: AddOptions): Result;
  duplicate(definition: LWProcess.Definition, stepId: string): Result;
  removal(definition: LWProcess.Definition, stepId: string): Removal;
  remove(definition: LWProcess.Definition, stepId: string, options?: {reconnect?: boolean}): Result;
  /** The fields a change to `kind` would drop, in plain words ("people demands", "the conditions on its paths"). */
  drops(definition: LWProcess.Definition, stepId: string, kind: AddKind): string[];
  /** Why the kind of this step cannot change ('' when it can). */
  kindBlocked(definition: LWProcess.Definition, stepId: string): string;
  changeKind(definition: LWProcess.Definition, stepId: string, kind: AddKind): Result;
  /** Names a start-kind step as the process start (useful when `start` names a missing or wrong step). */
  setStart(definition: LWProcess.Definition, stepId: string): Result;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessAuthoring: LWProcess.Authoring; LWProcessCatalog: LWProcess.Catalog; LWProcessStructure?: LWProcessStructure.Api};
 type D = LWProcess.Definition;
 type Op = LWProcess.Recipe['operations'][number];
 const KINDS: [LWProcessStructure.AddKind, string][] = [['task', 'Task'], ['machine', 'Machine step'], ['system', 'System step'],
  ['touchpoint', 'Touchpoint'], ['timer', 'Timer'], ['decision', 'Decision'], ['fork', 'Fork'], ['join', 'Join'], ['end', 'End']];
 /** "a timer", "an end step": the kind as it reads in a label. */
 const A_KIND: Record<LWProcess.Kind, string> = {start: 'a start step', task: 'a task', touchpoint: 'a touchpoint', machine: 'a machine step',
  system: 'a system step', timer: 'a timer', decision: 'a decision', fork: 'a fork', join: 'a join', end: 'an end step'};
 const COLORS: Record<LWProcess.Kind, string> = {start: '#77b5a0', end: '#77b5a0', task: '#ffbb73', touchpoint: '#ffbb73', fork: '#91b9d5',
  join: '#91b9d5', timer: '#91b9d5', decision: '#d6a2ce', machine: '#77b5a0', system: '#77b5a0'};
 const LOST = '#d9777f', GRID_X = 14, GRID_Y = 10, BOUND = 10000, ID_MAX = 58, NAME_MAX = 120;
 const colorOf = (kind: LWProcess.Kind, outcome?: string) => kind === 'end' && outcome === 'lost' ? LOST : COLORS[kind];
 const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
 const isWork = (k: LWProcess.Kind) => k === 'task' || k === 'touchpoint' || k === 'machine' || k === 'system';
 const WORK = ['duration', 'cost', 'resources', 'set', 'add', 'needs', 'backlog', 'outputs', 'timing', 'draws', 'instances', 'deadline'];
 /** The kind-specific fields each kind may carry (every kind also keeps id, name, kind, scene, description and journey notes). */
 const ALLOWED: Record<LWProcess.Kind, string[]> = {
  task: WORK, touchpoint: [...WORK, 'channel'], machine: [...WORK, 'technology'], system: [...WORK, 'technology'],
  timer: ['duration', 'until', 'timing', 'set', 'add', 'draws', 'needs'], decision: ['needs'], fork: ['mode', 'join', 'needs'],
  join: ['backlog', 'needs'], end: ['needs', 'outcome'], start: [],
 };
 const CONDITIONS = 'the conditions on its paths';
 const COMMON = new Set(['id', 'name', 'kind', 'scene', 'description', 'phase', 'emotion', 'pain', 'opportunity']);
 const WORDS: Record<string, string> = {duration: 'duration', until: 'wait-until minute', cost: 'fixed cost', resources: 'resource demands',
  set: 'set values', add: 'counters', needs: 'needs', backlog: 'backlog', outputs: 'declared outputs', timing: 'random timing',
  draws: 'random outcomes', instances: 'multiple instances', deadline: 'deadline', technology: 'technology label', mode: 'branching mode',
  join: 'join step', channel: 'channel', outcome: 'outcome'};
 const stepOf = (d: D, id: string) => d.steps.find(s => s.id === id);
 const nameOf = (d: D, id: string) => stepOf(d, id)?.name ?? id;
 function slug(name: string): string {
  const base = name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const lead = /^[a-z]/.test(base) ? base : base ? 'step-' + base : 'step';
  return lead.slice(0, ID_MAX).replace(/-+$/, '');
 }
 /** A unique id among the steps (and a unique `scene-<id>` among the scenes). */
 function newId(d: D, name: string): string {
  const ids = new Set(d.steps.map(s => s.id)), scenes = new Set(d.steps.map(s => s.scene?.id)), base = slug(name);
  const taken = (id: string) => ids.has(id) || scenes.has('scene-' + id);
  let id = base;
  for (let n = 2; taken(id); n++) id = `${base.slice(0, ID_MAX - String(n).length - 1).replace(/-+$/, '')}-${n}`;
  return id;
 }
 /** A flow id `<from>-<to>`, numbered when taken. */
 function flowId(d: D, from: string, to: string, extra: string[] = []): string {
  const taken = new Set([...d.flows.map(f => f.id), ...extra]), base = `${from}-${to}`.slice(0, 64).replace(/-+$/, '');
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base.slice(0, 64 - String(n).length - 1).replace(/-+$/, '')}-${n}`;
  return id;
 }
 const clamp = (n: number) => Math.min(BOUND, Math.max(-BOUND, n));
 const positionOf = (s: LWProcess.Step | undefined): [number, number] => {
  const p = s?.scene?.position;
  return Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) ? [p[0], p[1]] : [0, 0];
 };
 /** The first unoccupied cell at column `x`, trying `y`, then y+10, y-10, y+20, ... (a step within half a cell occupies it). */
 function cellNear(d: D, x: number, y: number, skip = ''): [number, number] {
  const occupied = (cx: number, cy: number) => d.steps.some(s => s.id !== skip
   && Math.abs(positionOf(s)[0] - cx) < GRID_X / 2 && Math.abs(positionOf(s)[1] - cy) < GRID_Y / 2);
  for (let k = 0; k < 64; k++) {
   const dy = k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * GRID_Y, cy = clamp(y + dy);
   if (!occupied(clamp(x), cy)) return [clamp(x), cy];
  }
  return [clamp(x), clamp(y)];
 }
 function freeCell(d: D, after?: string): [number, number] {
  const from = after ? stepOf(d, after) : undefined;
  if (from) {
   const [x, y] = positionOf(from);
   return cellNear(d, x + GRID_X, y);
  }
  const right = d.steps.reduce<LWProcess.Step | undefined>((best, s) => !best || positionOf(s)[0] > positionOf(best)[0] ? s : best, undefined);
  const [x, y] = positionOf(right);
  return cellNear(d, right ? x + GRID_X : 0, right ? y : 0);
 }
 const normalOut = (d: D, id: string) => d.flows.filter(f => f.from === id && f.on !== 'deadline');
 function insertable(d: D, after: string): {flow: string; to: string; toName: string} | null {
  const out = normalOut(d, after), from = stepOf(d, after);
  if (!from || from.kind === 'end' || out.length !== 1) return null;
  return {flow: out[0]!.id, to: out[0]!.to, toName: nameOf(d, out[0]!.to)};
 }
 /** Moves step `id` to just after step `after` in draft order (draft order drives Previous and Next step); a pure reorder. */
 function placeAfter(d: D, id: string, after: string | undefined): void {
  const at = d.steps.findIndex(s => s.id === id), anchor = after ? d.steps.findIndex(s => s.id === after) : -1;
  if (at < 0 || anchor < 0) return;
  const [step] = d.steps.splice(at, 1);
  d.steps.splice(d.steps.findIndex(s => s.id === after) + 1, 0, step!);
 }
 /** Applies `operations` through the guarded authoring edit (draft mode), then an optional pure reorder; keeps the input revision. */
 function run(input: D, operations: Op[], label: string, stepId: string, notes: string[], order?: [string, string | undefined]): LWProcessStructure.Result {
  let edited: D;
  try {
   const base = root.LWProcessCatalog.validate(input, true);
   if (!base.acceptable) return {ok: false, reason: refusal(base.diagnostics.map(e => e.path + ': ' + e.message).join('\n'))};
   const recipe = {expectedRevision: base.definition!.revision, expectedFingerprint: root.LWProcessCatalog.fingerprint(base.definition), operations};
   edited = root.LWProcessAuthoring.edit(base.definition, recipe, true).definition;
  } catch (e) { return {ok: false, reason: refusal(String(e instanceof Error ? e.message : e))}; }
  edited.revision = input.revision;
  if (order) placeAfter(edited, order[0], order[1]);
  const checked = root.LWProcessCatalog.validate(edited, true);
  return {ok: true, definition: edited, diagnostics: checked.diagnostics, label, stepId, notes};
 }
 /** The first problem in plain words; structural problems of the draft itself point to the Definition editor. */
 function refusal(message: string): string {
  const first = message.split('\n')[0]!.replace(/^\/[^:]*: /, '');
  return /at most/.test(first) ? first : `The draft has a problem the editor cannot work around (${first}). Fix it in the Definition editor first.`;
 }
 /** The kind's minimal fields on `step` (kept when present): durations, a pool of a machine or system step's kind, a fork's join. */
 function minimal(d: D, step: LWProcess.Step, notes: string[]): void {
  if (isWork(step.kind) && step.duration === undefined) step.duration = 5;
  if (step.kind === 'timer' && step.duration === undefined && step.until === undefined) step.duration = 60;
  if (step.kind === 'machine' || step.kind === 'system') {
   const pool = d.resources.find(r => (r.kind ?? 'people') === step.kind);
   if (!Object.keys(step.resources ?? {}).length) {
    if (pool) step.resources = {[pool.id]: 1};
    else notes.push(`This process has no ${step.kind} pool yet, so the catalog reports that ${step.name} needs one. Add a ${step.kind} pool.`);
   }
  }
  if (step.kind === 'fork' && step.join === undefined) {
   const owned = new Set(d.steps.flatMap(s => s.kind === 'fork' && s.join ? [s.join] : []));
   const free = d.steps.find(s => s.kind === 'join' && !owned.has(s.id));
   if (free) step.join = free.id;
   else notes.push(`A fork names the join where its branches meet; add a join step for ${step.name}.`);
  }
 }
 function add(d: D, o: LWProcessStructure.AddOptions): LWProcessStructure.Result {
  if (!KINDS.some(([k]) => k === o.kind)) return {ok: false, reason: 'Choose the kind of step to add.'};
  if (o.after && !stepOf(d, o.after)) return {ok: false, reason: 'That step is not in the draft.'};
  const label = KINDS.find(([k]) => k === o.kind)![1], name = (o.name.trim() || 'New ' + label.toLowerCase()).slice(0, NAME_MAX);
  const id = newId(d, name), notes: string[] = [];
  const step: LWProcess.Step = {id, name, kind: o.kind, scene: {id: 'scene-' + id, position: freeCell(d, o.after), color: colorOf(o.kind)}};
  minimal(d, step, notes);
  const operations: Op[] = [{op: 'putStep', value: step}], into = o.after && o.insert && o.kind !== 'end' ? insertable(d, o.after) : null;
  if (into) {
   const old = d.flows.find(f => f.id === into.flow)!;
   operations.push({op: 'putFlow', value: {...clone(old), to: id}}, {op: 'putFlow', value: {id: flowId(d, id, into.to), from: id, to: into.to}});
   notes.push(`Inserted ${name} between ${nameOf(d, o.after!)} and ${into.toName}.`);
  } else if (o.kind !== 'end' || !o.after) notes.push(`${name} is not connected yet: add a path to it and from it.`);
  else notes.push(`${name} is not connected yet: add a path to it.`);
  return run(d, operations, `Added step ${name}`, id, notes, [id, o.after ?? d.steps.at(-1)?.id]);
 }
 function duplicate(d: D, stepId: string): LWProcessStructure.Result {
  const source = stepOf(d, stepId);
  if (!source) return {ok: false, reason: 'That step is not in the draft.'};
  if (source.kind === 'start') return {ok: false, reason: 'A process has exactly one start step, so it cannot be duplicated.'};
  const name = `${source.name} (copy)`.slice(0, NAME_MAX), copy = clone(source), notes = ['The copy has no paths yet: add a path to it and from it.'];
  const id = newId(d, slug(source.id) + '-copy');
  const [x, y] = positionOf(source);
  copy.id = id;
  copy.name = name;
  copy.scene = {...copy.scene, id: 'scene-' + id, position: cellNear(d, x, y + GRID_Y)};
  // A deadline names one of the original's paths and a join belongs to exactly one fork, so neither is copied.
  if (copy.deadline) {
   delete copy.deadline;
   notes.push('Its deadline was not copied, because a deadline names one of the step’s own paths.');
  }
  if (copy.join !== undefined) {
   delete copy.join;
   minimal(d, copy, notes);
  }
  return run(d, [{op: 'putStep', value: copy}], `Duplicated ${source.name}`, id, notes, [id, stepId]);
 }
 function removal(d: D, stepId: string): LWProcessStructure.Removal {
  const step = stepOf(d, stepId), name = step?.name ?? stepId;
  const incoming = d.flows.filter(f => f.to === stepId && f.from !== stepId).map(f => ({id: f.id, from: f.from, fromName: nameOf(d, f.from)}));
  const outgoing = d.flows.filter(f => f.from === stepId).map(f => ({id: f.id, to: f.to, toName: nameOf(d, f.to), deadline: f.on === 'deadline'}));
  const targets = [...new Set(outgoing.filter(f => !f.deadline && f.to !== stepId).map(f => f.to))];
  const blocked = !step ? 'That step is not in the draft.' : step.kind === 'start' || d.start === stepId
   ? 'The start step cannot be deleted: every process needs one. Delete or change the other steps instead.' : '';
  const sources = incoming.filter(f => f.from !== targets[0]);
  const reconnect = !blocked && targets.length === 1 && sources.length
   ? {to: targets[0]!, toName: nameOf(d, targets[0]!), from: [...new Set(sources.map(f => f.fromName))]} : null;
  return {blocked, name, incoming, outgoing, reconnect};
 }
 function remove(d: D, stepId: string, o: {reconnect?: boolean} = {}): LWProcessStructure.Result {
  const plan = removal(d, stepId);
  if (plan.blocked) return {ok: false, reason: plan.blocked};
  const operations: Op[] = [{op: 'removeStep', id: stepId}], notes: string[] = [], to = o.reconnect ? plan.reconnect : null;
  for (const f of d.flows.filter(x => x.from === stepId || x.to === stepId)) {
   const keep = to && f.to === stepId && f.from !== stepId && f.from !== to.to;
   if (keep) operations.push({op: 'putFlow', value: {...clone(f), to: to.to}});
   else operations.push({op: 'removeFlow', id: f.id});
  }
  if (to) notes.push(`Reconnected ${to.from.join(', ')} to ${to.toName}.`);
  const removed = plan.incoming.filter(f => !to || f.from === to.to).map(f => `from ${f.fromName}`)
   .concat(plan.outgoing.filter(f => f.to !== stepId && !(to && !f.deadline && f.to === to.to)).map(f => `to ${f.toName}`));
  if (removed.length) notes.push(`Removed ${removed.length === 1 ? 'the path' : `${removed.length} paths`}: ${removed.join(', ')}.`);
  return run(d, operations, `Deleted step ${plan.name}`, '', notes);
 }
 function kindBlocked(d: D, stepId: string): string {
  const step = stepOf(d, stepId);
  if (!step) return 'That step is not in the draft.';
  return step.kind === 'start' ? 'The start step keeps its kind: every process needs exactly one start step.' : '';
 }
 /** The changed step and flows for kind `kind`, and the plain words of everything dropped. */
 interface Converted {step: LWProcess.Step; flows: LWProcess.Flow[]; dropped: string[]; notes: string[]}
 function convert(d: D, stepId: string, kind: LWProcessStructure.AddKind): Converted {
  const old = stepOf(d, stepId)!, step = clone(old), dropped: string[] = [], allowed = new Set(ALLOWED[kind]), notes: string[] = [];
  const record = step as unknown as Record<string, unknown>;
  for (const key of Object.keys(record)) {
   if (COMMON.has(key) || allowed.has(key)) continue;
   delete record[key];
   dropped.push(WORDS[key] ?? key);
  }
  step.kind = kind;
  if (kind === 'timer' && step.until !== undefined && step.timing) {
   delete step.timing;
   dropped.push(WORDS.timing!);
  }
  if (step.resources && kind !== 'touchpoint' && isWork(kind)) {
   const want = kind === 'task' ? 'people' : kind, pools = new Map(d.resources.map(r => [r.id, r.kind ?? 'people']));
   const gone = Object.keys(step.resources).filter(id => pools.get(id) !== want);
   for (const id of gone) {
    delete step.resources[id];
    dropped.push(`the demand for ${d.resources.find(r => r.id === id)?.name ?? id}`);
   }
   if (!Object.keys(step.resources).length) delete step.resources;
  }
  if (step.scene.color === colorOf(old.kind, old.outcome)) step.scene = {...step.scene, color: colorOf(kind, step.outcome)};
  minimal(d, step, notes);
  const conditional = kind === 'decision' || kind === 'fork' && step.mode === 'inclusive';
  const flows = d.flows.filter(f => f.from === stepId).flatMap(f => {
   const next = clone(f);
   let changed = false;
   if (next.on === 'deadline' && !isWork(kind)) {
    delete next.on;
    changed = true;
   }
   if (next.when && !conditional) {
    delete next.when;
    changed = true;
    if (!dropped.includes(CONDITIONS)) dropped.push(CONDITIONS);
   }
   return changed ? [next] : [];
  });
  return {step, flows, dropped, notes};
 }
 function drops(d: D, stepId: string, kind: LWProcessStructure.AddKind): string[] {
  return kindBlocked(d, stepId) || stepOf(d, stepId)?.kind === kind ? [] : convert(d, stepId, kind).dropped;
 }
 function changeKind(d: D, stepId: string, kind: LWProcessStructure.AddKind): LWProcessStructure.Result {
  const blocked = kindBlocked(d, stepId);
  if (blocked) return {ok: false, reason: blocked};
  if (!KINDS.some(([k]) => k === kind)) return {ok: false, reason: 'Choose the new kind of step.'};
  const old = stepOf(d, stepId)!;
  if (old.kind === kind) return {ok: false, reason: `${old.name} is already ${A_KIND[kind]}.`};
  const {step, flows, dropped, notes} = convert(d, stepId, kind);
  if (dropped.length) notes.unshift(`Dropped ${dropped.join(', ')}.`);
  const operations: Op[] = [{op: 'putStep', value: step}, ...flows.map((value): Op => ({op: 'putFlow', value}))];
  return run(d, operations, `Changed ${old.name} to ${A_KIND[kind]}`, stepId, notes);
 }
 function setStart(d: D, stepId: string): LWProcessStructure.Result {
  const step = stepOf(d, stepId);
  if (!step) return {ok: false, reason: 'That step is not in the draft.'};
  if (step.kind !== 'start') return {ok: false, reason: 'Only a start step can be the start of the process.'};
  if (d.start === stepId) return {ok: false, reason: `${step.name} is already the start of the process.`};
  return run(d, [{op: 'setStart', value: stepId}], `Made ${step.name} the start step`, stepId, []);
 }
 root.LWProcessStructure = {KINDS, colorOf, newId, freeCell, insertable, add, duplicate, removal, remove, drops, kindBlocked, changeKind, setStart};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessStructure;
})(globalThis);
