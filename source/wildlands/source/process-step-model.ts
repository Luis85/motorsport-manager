/// <reference path="./process-contracts.d.ts" />
/** Pure form model for one process step. It reads a step into editable strings and writes the edits back into a copy of a definition; it never touches the DOM, a session or storage. */
declare namespace LWProcessStepModel {
 type ValueType = 'text' | 'number' | 'true' | 'false' | 'null';
 /** A typed scalar kept as text so a half-typed number never changes its type. */
 interface Value {type: ValueType; text: string}
 interface SetRow {key: string; value: Value}
 interface AddRow {key: string; delta: string}
 interface NeedRow {field: string; op: string; value: Value; label: string}
 interface Backlog {on: boolean; capacity: string; order: 'fifo' | 'lifo' | 'priority'; priority: string; pull: string}
 interface Cond {on: boolean; field: string; op: string; mode: 'value' | 'field'; value: Value; valueField: string}
 interface FlowRow {id: string; to: string; toName: string; label: string; cond: Cond}
 interface Pool {id: string; name: string; capacity: number; count: string}
 interface Model {
  id: string; kind: LWProcess.Kind; name: string; description: string; mode: 'duration' | 'until'; duration: string; until: string; cost: string;
  pools: Pool[]; set: SetRow[]; add: AddRow[]; needs: NeedRow[]; backlog: Backlog | null; flows: FlowRow[];
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
  otherChanges(active: LWProcess.Definition, draft: LWProcess.Definition, stepId: string): boolean;
  needsSummary(model: Model): string;
  newValue(): Value;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessStepModel?: LWProcessStepModel.Api};
 const OPS: [string, string][] = [['eq', 'equals'], ['ne', 'is not'], ['gt', 'greater than'], ['gte', 'at least'], ['lt', 'less than'], ['lte', 'at most']];
 const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
 const newValue = (): LWProcessStepModel.Value => ({type: 'true', text: ''});
 const readValue = (v: LWProcess.Scalar | undefined): LWProcessStepModel.Value =>
  v === undefined ? newValue() : v === null ? {type: 'null', text: ''} : typeof v === 'boolean' ? {type: v ? 'true' : 'false', text: ''} : typeof v === 'number' ? {type: 'number', text: String(v)} : {type: 'text', text: v};
 const numeric = (text: string): number | undefined => text.trim() !== '' && Number.isFinite(Number(text)) ? Number(text) : undefined;
 const whole = (text: string): number | undefined => { const n = numeric(text); return n === undefined ? undefined : Math.round(n); };
 const writeValue = (v: LWProcessStepModel.Value): LWProcess.Scalar => v.type === 'true' ? true : v.type === 'false' ? false : v.type === 'null' ? null : v.type === 'number' ? numeric(v.text) ?? 0 : v.text;
 const assign = (target: Record<string, unknown>, key: string, value: unknown) => { if (value === undefined) delete target[key]; else target[key] = value; };
 function read(def: LWProcess.Definition, stepId: string): LWProcessStepModel.Model | undefined {
  const step = def.steps.find(s => s.id === stepId); if (!step) return undefined;
  const names = new Map(def.steps.map(s => [s.id, s.name]));
  const flows = def.flows.filter(f => f.from === stepId).map(f => ({id: f.id, to: f.to, toName: names.get(f.to) ?? f.to, label: f.label ?? '', cond: {
   on: !!f.when, field: f.when?.field ?? '', op: f.when?.op ?? 'eq', mode: f.when?.valueField !== undefined ? 'field' as const : 'value' as const,
   value: f.when?.valueField === undefined ? readValue(f.when?.value) : newValue(), valueField: f.when?.valueField ?? ''}}));
  const b = step.backlog;
  return {id: step.id, kind: step.kind, name: step.name, description: step.description ?? '', mode: step.until !== undefined ? 'until' : 'duration',
   duration: step.duration === undefined ? '' : String(step.duration), until: step.until === undefined ? '' : String(step.until), cost: step.cost === undefined ? '' : String(step.cost),
   pools: def.resources.map(r => ({id: r.id, name: r.name, capacity: r.capacity, count: String(step.resources?.[r.id] ?? 0)})),
   set: Object.entries(step.set ?? {}).map(([key, v]) => ({key, value: readValue(v)})), add: Object.entries(step.add ?? {}).map(([key, n]) => ({key, delta: String(n)})),
   needs: (step.needs ?? []).map(n => ({field: n.field, op: n.op ?? '', value: readValue(n.value), label: n.label ?? ''})),
   backlog: step.kind === 'task' || step.kind === 'join' ? {on: !!b, capacity: String(b?.capacity ?? 8), order: b?.order ?? 'fifo', priority: b?.priority ?? 'priority', pull: b?.pull === undefined ? '' : String(b.pull)} : null, flows};
 }
 function writeStep(step: LWProcess.Step, m: LWProcessStepModel.Model): void {
  const s = step as unknown as Record<string, unknown>, work = step.kind === 'task' || step.kind === 'timer';
  s.name = m.name; assign(s, 'description', m.description.trim() === '' ? undefined : m.description);
  if (step.kind === 'task') assign(s, 'duration', whole(m.duration));
  if (step.kind === 'timer') { assign(s, 'duration', m.mode === 'duration' ? whole(m.duration) : undefined); assign(s, 'until', m.mode === 'until' ? whole(m.until) : undefined); }
  if (step.kind === 'task') {
   assign(s, 'cost', whole(m.cost)); const used = m.pools.filter(p => (whole(p.count) ?? 0) > 0);
   assign(s, 'resources', used.length ? Object.fromEntries(used.map(p => [p.id, whole(p.count)!])) : undefined);
  }
  if (work) {
   assign(s, 'set', m.set.length ? Object.fromEntries(m.set.map(r => [r.key, writeValue(r.value)])) : undefined);
   assign(s, 'add', m.add.length ? Object.fromEntries(m.add.map(r => [r.key, whole(r.delta) ?? 0])) : undefined);
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
   if (step.kind === 'decision' || row.cond.on) {
    const c = row.cond;
    assign(f, 'when', !c.on ? undefined : c.mode === 'field' ? {field: c.field, op: c.op, valueField: c.valueField} : {field: c.field, op: c.op, value: writeValue(c.value)});
   }
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
  m.add.forEach((r, i) => { if (whole(r.delta) === undefined) out.push({key: `add.${i}.delta`, message: 'Enter a whole number.'}); });
  m.needs.forEach((n, i) => { if (n.op) value(`needs.${i}.value`, n.value); });
  m.flows.forEach((f, i) => { if (f.cond.on && f.cond.mode === 'value') value(`flows.${i}.cond.value`, f.cond.value); });
  return out;
 }
 const SEGMENTS: Record<string, string> = {name: 'name', description: 'description', duration: 'duration', until: 'until', cost: 'cost', resources: 'pools', set: 'set', add: 'add', needs: 'needs', backlog: 'backlog'};
 function scope(def: LWProcess.Definition, stepId: string, diagnostics: LWProcess.Diagnostic[]): LWProcessStepModel.Scoped[] {
  const index = def.steps.findIndex(s => s.id === stepId), own = def.flows.map((f, i) => f.from === stepId ? i : -1).filter(i => i >= 0), out: LWProcessStepModel.Scoped[] = [];
  for (const d of diagnostics) {
   const parts = d.path.split('/').filter(Boolean);
   if (parts[0] === 'steps' && Number(parts[1]) === index) {
    const seg = parts[2]; out.push({key: seg === undefined ? '' : seg === 'needs' && parts[3] !== undefined ? `needs.${parts[3]}` : SEGMENTS[seg] ?? '', message: d.message, path: d.path});
   } else if (parts[0] === 'flows' && own.includes(Number(parts[1]))) out.push({key: `flows.${own.indexOf(Number(parts[1]))}`, message: d.message, path: d.path});
  }
  return out;
 }
 function otherChanges(active: LWProcess.Definition, draft: LWProcess.Definition, stepId: string): boolean {
  const rest = (d: LWProcess.Definition) => JSON.stringify({...d, revision: 0, steps: d.steps.filter(s => s.id !== stepId), flows: d.flows.filter(f => f.from !== stepId)});
  return rest(active) !== rest(draft);
 }
 function needsSummary(m: LWProcessStepModel.Model): string {
  const used = m.pools.filter(p => (whole(p.count) ?? 0) > 0).map(p => `${whole(p.count)} ${p.name}`);
  return used.length ? 'Needs: ' + used.join(', ') : 'Needs: no shared people or equipment';
 }
 root.LWProcessStepModel = {OPS, read, write, problems, scope, otherChanges, needsSummary, newValue};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessStepModel;
})(globalThis);
