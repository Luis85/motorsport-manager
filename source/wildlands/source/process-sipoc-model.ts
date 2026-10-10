/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-route.ts" />
/// <reference path="./process-time.ts" />
/**
 * Pure SIPOC model: Suppliers, Inputs, Process, Outputs, Customers derived from a detached definition and snapshot. No DOM,
 * session, clock or storage; the SIPOC lens draws it and the slide model reads its columns. Everything is derived, nothing is invented:
 * - SUPPLIERS and CUSTOMERS come from `definition.sipoc` (name plus what is supplied / received); absent, one muted placeholder asks the author to add them.
 * - INPUTS are external: fields in arrival `data` and arrival `draws`, plus `needs` fields that no step delivers through set/add/draws.
 *   A field is internal state, not an input, when steps add to it or set it and every arrival seeds the same constant (a counter from 0, a flag);
 *   a field the arrivals draw or seed with different values stays an input.
 *   Label is the label of a presence need (a need without a test; a test's label describes a condition, not the field), else outputs.label,
 *   else the field name; the example lists the distinct arrival values (and plain descriptions of draws); arrival inputs show the live arrivals.
 * - PROCESS is the main route (LWProcessRoute.walk: from start, first unconditional flow at decisions, a fork with its branches as one "in parallel" stage), start and end excluded.
 *   Steps group by `phase` (order of first appearance, unphased steps follow the phase before them) when phases exist, else consecutive units collapse into at most 7
 *   stages named by their first step plus "and N more steps". Off-route steps (rework) join the stage they flow into or out of. Each stage shows kind icons, step count,
 *   live in-progress, waiting and blocked sums of steps[].active, queued - held and held, a dashed "variant" marker when it holds a
 *   decision, rework loop or back edge, and `completed`: the distinct cases that left the stage (`reached` of the main-route step after
 *   it, plus ends reached only from the stage), never step visits.
 * - OUTPUTS are declared step `outputs`, fields delivered (set/add/draws) by the steps right before end steps, and one entry per end step (goal/lost outcome or reaching the end),
 *   with the end or declaring step's completed count.
 * - MEASURES: completed, in progress, mean cycle ('—' until a case finishes), mean age in progress, work cost, capacity cost, throughput per 100 minutes,
 *   conversion when known, tracked finish means when present. Durations are worded by LWProcessTime.span with the definition's
 *   display calendar (business days and weeks when `calendar` is set; exactly LWProcessTime.minutes without one).
 * The stage sums are the studio's work-state rule (LWProcessWorkState): `active` is working plus running work, `queued` is waiting
 *   work (queued minus held) and `held` is blocked work; the SIPOC lens words them with LWProcessWorkState.
 */
declare namespace LWProcessSipoc {
 interface Party {name: string; detail?: string; placeholder?: boolean;}
 interface Input {field: string; label: string; example: string | null; arrived: number | null;}
 /** `queued` excludes `held` (blocked after finishing); `completed` counts distinct cases that left the stage. */
 interface Stage {
  id: string; name: string; first: string; stepIds: string[]; kinds: LWProcess.Kind[]; steps: number;
  active: number; queued: number; held: number; completed: number; variant: boolean; parallel: boolean;
 }
 interface Output {id: string; label: string; detail: string; count: number | null; kind: 'declared' | 'delivered' | 'outcome';}
 interface Measure {id: string; label: string; value: string;}
 interface Model {suppliers: Party[]; inputs: Input[]; stages: Stage[]; outputs: Output[]; customers: Party[]; measures: Measure[];}
 interface ModelApi {model(definition: LWProcess.Definition, snapshot: LWProcess.Snapshot): Model;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessSipocModel?: LWProcessSipoc.ModelApi; LWProcessRoute: LWProcessRoute.Api; LWProcessTime: LWProcessTime.Api};
 type Step = LWProcess.Step;
 type Sipoc = {suppliers?: {name: string; supplies?: string}[]; customers?: {name: string; receives?: string}[]};
 const MAX_STAGES = 7, ENDS = new Set(['start', 'end']);
 const plural = (n: number, one: string, many = one + 's') => n + ' ' + (n === 1 ? one : many);
 const fieldsOf = (s: Step) => [...Object.keys(s.set ?? {}), ...Object.keys(s.add ?? {}), ...(s.draws ?? []).map(d => d.field)];
 /** Plain description of a random draw for the "example" line. */
 function describe(d: LWProcess.Draw): string {
  if (d.kind === 'chance') return `random, ${d.percent ?? 0}% chance`;
  if (d.kind === 'int') return `random, ${d.min ?? 0} to ${d.max ?? 0}`;
  return 'random: ' + (d.values ?? []).map(v => String(v.value)).join(' or ');
 }
 /** Distinct example values of one input, in arrival order: 'false, true'; at most four, then '…'. */
 const exampleOf = (list: string[]) => list.length > 4 ? list.slice(0, 4).join(', ') + ', …' : list.join(', ');
 /** Main route as units (LWProcessRoute): a fork with its branches and join is one unit, a decision attaches to the unit before it. */
 const route = (d: LWProcess.Definition): Step[][] => root.LWProcessRoute.walk(d).units;
 /** Assign route steps to stages by phase when any exist (LWProcessRoute.phases), else by balanced chunks of units. */
 function grouping(units: Step[][]): {name: string; steps: Step[]}[] {
  const all = root.LWProcessRoute.phases(units.flat());
  if (all) {
   if (all.length <= MAX_STAGES) return all;
   const tail = all.slice(MAX_STAGES - 1), keep = all.slice(0, MAX_STAGES - 1);
   return [...keep, {name: `${tail[0]!.name} and ${plural(tail.length - 1, 'more phase')}`, steps: tail.flatMap(g => g.steps)}];
  }
  const k = Math.min(MAX_STAGES, units.length), base = Math.floor(units.length / Math.max(1, k)), extra = units.length % Math.max(1, k), out: {name: string; steps: Step[]}[] = [];
  for (let i = 0, at = 0; i < k; i++) {
   const part = units.slice(at, at += base + (i < extra ? 1 : 0)), steps = part.flat(), first = steps[0]!;
   out.push({name: part.length > 1 ? `${first.name} and ${plural(steps.length - 1, 'more step')}` : first.name, steps});
  }
  return out;
 }
 function stagesOf(d: LWProcess.Definition, q: LWProcess.Snapshot): LWProcessSipoc.Stage[] {
  const units = route(d), groups = grouping(units), stageOf = new Map<string, number>(), pos = new Map<string, number>();
  groups.forEach((g, i) => g.steps.forEach(s => stageOf.set(s.id, i))); units.flat().forEach((s, i) => pos.set(s.id, i));
  const attached = new Set<string>(), floating = d.steps.filter(s => !ENDS.has(s.kind) && !stageOf.has(s.id));
  for (let moved = true; moved;) {
   moved = false;
   for (const s of floating) {
    if (stageOf.has(s.id)) continue;
    const target = d.flows.filter(f => f.from === s.id).map(f => stageOf.get(f.to)).find(x => x !== undefined) ?? d.flows.filter(f => f.to === s.id).map(f => stageOf.get(f.from)).find(x => x !== undefined);
    if (target !== undefined) { stageOf.set(s.id, target); attached.add(s.id); moved = true; }
   }
  }
  const back = new Set<number>(); for (const f of d.flows) if (pos.has(f.from) && pos.has(f.to) && pos.get(f.to)! <= pos.get(f.from)!) back.add(stageOf.get(f.from)!);
  const metric = new Map(q.steps.map(m => [m.id, m])), path = root.LWProcessRoute.walk(d).path, sideEnds = escalationEnds(d);
  return groups.map((g, i) => {
   const members = d.steps.filter(s => stageOf.get(s.id) === i);
   const sum = (key: 'active' | 'queued' | 'held') => members.reduce((n, s) => n + (metric.get(s.id)?.[key] ?? 0), 0);
   const held = sum('held');
   return {
    id: 'stage-' + (i + 1), name: g.name, first: g.steps[0]!.id, stepIds: members.map(s => s.id), kinds: [...new Set(members.map(s => s.kind))], steps: members.length,
    active: sum('active'), queued: sum('queued') - held, held, completed: left(d, path, new Set(members.map(s => s.id)), metric, sideEnds),
    variant: members.some(s => s.kind === 'decision' || attached.has(s.id)) || back.has(i), parallel: members.some(s => s.kind === 'fork'),
   };
  });
 }
 /**
  * Distinct cases that left a stage: those that reached the main-route step after the stage's last route step, plus those that
  * finished at an end step whose every incoming flow starts inside the stage (a rejection or other end of this stage) and that is
  * more than the end of an escalation path (escalationEnds). Summing
  * step completions instead would count rework visits, decisions and joins as extra cases.
  */
 function left(d: LWProcess.Definition, path: Step[], members: Set<string>, metric: Map<string, LWProcess.StepMetric>, sideEnds: Set<string>): number {
  let last = -1; path.forEach((s, i) => { if (members.has(s.id)) last = i; });
  const next = last >= 0 ? path[last + 1] : undefined, reached = (id: string) => metric.get(id)?.reached ?? 0;
  let n = next && !members.has(next.id) ? reached(next.id) : 0;
  for (const e of d.steps) {
   if (e.kind !== 'end' || e.id === next?.id || members.has(e.id) || sideEnds.has(e.id)) continue;
   const into = d.flows.filter(f => f.to === e.id);
   if (into.length && into.every(f => members.has(f.from))) n += reached(e.id);
  }
  return n;
 }
 /** End steps reached only through an escalating deadline path: the extra token ends there while its case carries on, so the case did not leave. */
 function escalationEnds(d: LWProcess.Definition): Set<string> {
  const by = new Map(d.steps.map(s => [s.id, s])), escalates = (f: LWProcess.Flow) => f.on === 'deadline' && by.get(f.from)?.deadline?.mode === 'escalate';
  const seen = new Set<string>([d.start]), queue = [d.start];
  for (let i = 0; i < queue.length; i++) {
   for (const f of d.flows) if (f.from === queue[i] && !escalates(f) && !seen.has(f.to)) { seen.add(f.to); queue.push(f.to); }
  }
  return new Set(d.steps.filter(s => s.kind === 'end' && !seen.has(s.id)).map(s => s.id));
 }
 function model(d: LWProcess.Definition, q: LWProcess.Snapshot): LWProcessSipoc.Model {
  const sipoc = (d as {sipoc?: Sipoc}).sipoc, delivered = new Set(d.steps.flatMap(fieldsOf)), needLabel = new Map<string, string>(), outLabel = new Map<string, string>(), done = new Map(q.steps.map(m => [m.id, m.completed]));
  // Only a presence need (no `op`) names its field; 'needsRework eq false' labelled 'Findings resolved' names a condition instead.
  for (const s of d.steps) {
   for (const n of s.needs ?? []) if (n.label && n.op === undefined && !needLabel.has(n.field)) needLabel.set(n.field, n.label);
   for (const o of s.outputs ?? []) if (o.label && !outLabel.has(o.field)) outLabel.set(o.field, o.label);
  }
  const labelOf = (field: string) => needLabel.get(field) ?? outLabel.get(field) ?? field, inputs = new Map<string, LWProcessSipoc.Input>();
  const examples = new Map<string, string[]>(), drawn = new Set<string>(), constant = new Map<string, Set<string>>(), note = (field: string, text: string) => {
   const list = examples.get(field) ?? examples.set(field, []).get(field)!; if (!list.includes(text)) list.push(text);
  };
  for (const a of d.arrivals) {
   for (const [field, value] of Object.entries(a.data)) {
    note(field, String(value)); (constant.get(field) ?? constant.set(field, new Set()).get(field)!).add(JSON.stringify(value));
   }
   for (const dr of a.draws ?? []) { note(dr.field, describe(dr)); drawn.add(dr.field); }
  }
  // Internal state: a field steps add to or set that every arrival seeds with one constant (a counter starting at 0, a flag starting false).
  // A field the arrivals draw or seed with different values stays an input even when a later step changes it.
  const changed = new Set(d.steps.flatMap(fieldsOf));
  const internal = (field: string) => changed.has(field) && !drawn.has(field) && (constant.get(field)?.size ?? 0) <= 1;
  for (const [field, list] of examples) {
   if (!internal(field)) inputs.set(field, {field, label: labelOf(field), example: exampleOf(list), arrived: q.metrics.arrived});
  }
  for (const s of d.steps) for (const n of s.needs ?? []) if (!delivered.has(n.field) && !inputs.has(n.field)) inputs.set(n.field, {field: n.field, label: labelOf(n.field), example: null, arrived: null});
  const outputs = new Map<string, LWProcessSipoc.Output>(), names = (ids: Step[]) => ids.map(s => s.name).join(', ');
  for (const s of d.steps) for (const o of s.outputs ?? []) {
   const known = outputs.get(o.field), count = done.get(s.id) ?? 0;
   if (known) { known.count = Math.max(known.count ?? 0, count); known.detail += ', ' + s.name; } else outputs.set(o.field, {id: 'out-' + o.field, label: o.label ?? needLabel.get(o.field) ?? o.field, detail: 'from ' + s.name, count, kind: 'declared'});
  }
  const ends = d.steps.filter(s => s.kind === 'end');
  for (const e of ends) {
   const before = d.steps.filter(s => d.flows.some(f => f.from === s.id && f.to === e.id) && !['decision', 'fork', 'join', 'start'].includes(s.kind));
   for (const field of new Set(before.flatMap(fieldsOf))) if (!outputs.has(field)) outputs.set(field, {id: 'out-' + field, label: labelOf(field), detail: 'delivered by ' + names(before.filter(s => fieldsOf(s).includes(field))), count: done.get(e.id) ?? 0, kind: 'delivered'});
  }
  const outcomes = ends.map<LWProcessSipoc.Output>(e => ({id: 'end-' + e.id, kind: 'outcome', count: done.get(e.id) ?? 0, label: e.outcome ? `${e.name}: ${e.outcome === 'goal' ? 'goal reached' : 'lost'}` : 'Reached ' + e.name, detail: e.outcome ? 'end outcome' : 'end of the process'}));
  const m = q.metrics, age = m.meanAgeMinutes, time = root.LWProcessTime, tracked = Object.values(m.tracked).filter(t => t.n > 0 && t.mean !== null);
  const units = (n: number) => String(Math.round(n * 100) / 100), measures: LWProcessSipoc.Measure[] = [
   {id: 'completed', label: 'Completed', value: String(m.completed)}, {id: 'active', label: 'In progress', value: String(m.active)},
   {id: 'cycle', label: 'Mean cycle', value: m.completed ? time.span(m.meanCycleMinutes, d.calendar) : '—'},
   {id: 'age', label: 'Mean age in progress', value: age === null || !Number.isFinite(age) ? '—' : time.span(age, d.calendar)},
   {id: 'cost', label: 'Work cost', value: units(m.cost)}, {id: 'capacity-cost', label: 'Capacity cost', value: units(m.capacityCost)},
   {id: 'throughput', label: 'Throughput per 100 min', value: String(q.minute > 0 ? Math.round(m.completed * 1000 / q.minute) / 10 : 0)},
  ];
  if (m.conversion !== null) measures.push({id: 'conversion', label: 'Conversion', value: m.conversion / 10 + '%'});
  for (const t of tracked) measures.push({id: 'tracked-' + t.label, label: t.label + ' (mean)', value: String(Math.round(t.mean! * 100) / 100)});
  return {
   suppliers: sipoc?.suppliers?.length ? sipoc.suppliers.map(s => ({name: s.name, ...(s.supplies ? {detail: s.supplies} : {})})) : [{name: 'Add suppliers in Edit process', placeholder: true}],
   inputs: [...inputs.values()], stages: stagesOf(d, q), outputs: [...outputs.values(), ...outcomes],
   customers: sipoc?.customers?.length ? sipoc.customers.map(c => ({name: c.name, ...(c.receives ? {detail: c.receives} : {})})) : [{name: 'Add customers in Edit process', placeholder: true}], measures,
  };
 }
 root.LWProcessSipocModel = {model};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessSipocModel;
})(globalThis);
