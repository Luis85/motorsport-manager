/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-bpmn.ts" />
/**
 * BPSim scenario writer for the BPMN export: processing and wait times, probabilities, arrival timing, the first arrival rule's constant case
 * data and whole-number draws as start-event properties, the seed, and pool quantities and costs, in minutes. Wildlands extension values stay
 * authoritative on re-import. `notes` names, in plain words, what a tool that drops the extension loses.
 *
 * Working hours: BPSim can say when resources are available and when arrivals are timed, but not that running work pauses and
 * resumes. The scenario gains one `Calendar` (an iCalendar VEVENT from Monday 5 January 1970 at the opening time to the closing
 * time, repeated weekly on the working days by an RRULE), each pool's `Availability` is `true` valid for that calendar, and the
 * first arrival's InterTriggerTimer value is valid for it too. The exact hours and their run semantics stay in `<wl:workingHours>`,
 * and a note names what only the extension carries.
 */
declare namespace LWProcessBpmnBpsimWrite {
 interface Api {
  write(d: LWProcess.Definition, ids: LWProcessBpmn.Ids, add: (depth: number, line: string) => void): void;
  /** Fidelity notes for an export with (`bpsim`) or without BPSim: the values only the Wildlands extension carries. Empty when nothing is lost. */
  notes(d: LWProcess.Definition, bpsim: boolean): string[];
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessXml: LWProcessXml.Api; LWProcessHours: LWProcessHours.Api; LWProcessBpmnBpsimWrite?: LWProcessBpmnBpsimWrite.Api};
 type Add = (depth: number, line: string) => void;
 const num = (n: number) => String(Number(n.toFixed(6)));
 const constant = (name: string, n: number) => `<bpsim:${name} value="${num(n)}"/>`;
 /** One distribution element; the BPSim vocabulary has no bounds for exponential or normal, so only the shape parameters travel. */
 function dist(x: LWProcess.Dist): string {
  if (x.dist === 'uniform') return `<bpsim:UniformDistribution min="${x.min}" max="${x.max}"/>`;
  if (x.dist === 'triangular') return `<bpsim:TriangularDistribution min="${x.min}" mode="${x.mode}" max="${x.max}"/>`;
  if (x.dist === 'exponential') return `<bpsim:NegativeExponentialDistribution mean="${x.mean}"/>`;
  if (x.dist === 'normal') return `<bpsim:NormalDistribution mean="${x.mean}" standardDeviation="${x.sd}"/>`;
  return `<bpsim:ErlangDistribution k="${x.k}" mean="${x.mean}"/>`;
 }
 /** Marginal probability of each flow of a decision whose non-default flows are all plain chance routes tried in order (the default takes the rest). */
 function shares(flows: LWProcess.Flow[]): Map<string, number> | undefined {
  const chances = flows.filter(f => f.when), fallback = flows.find(f => !f.when);
  if (!fallback || !chances.length || chances.some(f => f.when!.chance === undefined)) return undefined;
  const out = new Map<string, number>(); let rest = 1;
  for (const f of chances) { const p = f.when!.chance! / 100; out.set(f.id, rest * p); rest *= 1 - p; }
  out.set(fallback.id, rest);
  return out;
 }
 /** A constant case value as a BPSim parameter; `null` has no BPSim form. */
 function parameter(v: LWProcess.Scalar): string | undefined {
  if (typeof v === 'number') return Number.isInteger(v) ? `<bpsim:NumericParameter value="${v}"/>` : `<bpsim:FloatingParameter value="${v}"/>`;
  if (typeof v === 'boolean') return `<bpsim:BooleanParameter value="${v}"/>`;
  return typeof v === 'string' ? `<bpsim:StringParameter value="${root.LWProcessXml.escape(v)}"/>` : undefined;
 }
 /** Start-event properties the importer reads back as the arrival's case data (constants) and whole-number draws (uniform ranges). */
 function properties(a: LWProcess.Arrival): string[] {
  const out: string[] = [], named = new Set<string>();
  const prop = (name: string, inner: string) => { named.add(name); out.push(`<bpsim:Property name="${name}">${inner}</bpsim:Property>`); };
  for (const [name, v] of Object.entries(a.data)) { const p = parameter(v); if (p) prop(name, p); }
  for (const x of a.draws ?? []) if (x.kind === 'int' && !named.has(x.field)) prop(x.field, `<bpsim:UniformDistribution min="${x.min}" max="${x.max}"/>`);
  return out;
 }
 /** Names in reading order, the first four in full and the rest counted, so a note stays one readable sentence. */
 const list = (names: string[], noun: string) => {
  const unique = [...new Set(names)], rest = unique.length - 4;
  return rest > 0 ? unique.slice(0, 4).join(', ') + ' and ' + rest + ' more ' + noun + (rest === 1 ? '' : 's') : unique.join(', ');
 };
 const ONLY = 'only in the Wildlands extension';
 /** What arrival rule 1 loses in BPSim: later rules, a later start, and case fields that are neither constants nor whole-number draws. */
 function arrivalNotes(d: LWProcess.Definition, out: string[]): void {
  const first = d.arrivals[0], n = d.arrivals.length; if (!first) return;
  if (n > 1) out.push(`BPSim carries arrival rule 1 of ${n}; ${n === 2 ? 'rule 2 is' : `rules 2 to ${n} are`} ${ONLY}.`);
  if (first.at > 0) out.push(`Arrival rule 1 starts at minute ${first.at}; BPSim starts it at minute 0.`);
  const draws = first.draws ?? [], carried = new Set(Object.keys(first.data).filter(k => first.data[k] !== null));
  for (const x of draws) if (x.kind === 'int') carried.add(x.field);
  const lost = [...Object.keys(first.data), ...draws.map(x => x.field)].filter(k => !carried.has(k));
  const fields = list(lost, 'field'), one = new Set(lost).size === 1;
  const subject = one ? `Case field ${fields} of arrival rule 1 is` : `Case fields ${fields} of arrival rule 1 are`;
  if (lost.length) out.push(`${subject} ${ONLY}; BPSim properties carry constants and whole-number ranges.`);
 }
 const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
 /** iCalendar local date-time of minute `m` after midnight on Monday 5 January 1970 (1440 is the next midnight). */
 const local = (m: number) => `197001${String(5 + Math.floor(m / 1440)).padStart(2, '0')}T${String(Math.floor(m % 1440 / 60)).padStart(2, '0')}`
  + `${String(m % 60).padStart(2, '0')}00`;
 /** The working hours as one weekly VEVENT, lines joined by CRLF character references so the text survives XML line-end handling. */
 function calendar(d: LWProcess.Definition, h: LWProcess.WorkingHours): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Wildlands//Process Studio//EN', 'BEGIN:VEVENT', `UID:working-hours@${d.id}`,
   'DTSTAMP:19700105T000000Z', `DTSTART:${local(h.opensAt)}`, `DTEND:${local(h.closesAt)}`,
   `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY.slice(0, h.daysPerWeek).join(',')}`, 'END:VEVENT', 'END:VCALENDAR'].join('&#13;&#10;');
 }
 /** What working hours lose without the extension, with BPSim (a calendar on availability and arrivals) or without it. */
 function hoursNote(d: LWProcess.Definition, bpsim: boolean): string | null {
  if (!d.workingHours) return null;
  const said = `The working hours (${root.LWProcessHours.describe(d.workingHours)})`;
  if (!bpsim) return `${said} are ${ONLY}; they pause work and arrivals outside them, so a tool without it runs every minute as working time.`;
  return `${said} travel as a BPSim calendar on pool availability and arrival timing; that running work pauses and resumes, that arrivals `
   + `count working minutes and that the run starts on Monday at opening are ${ONLY}.`;
 }
 function notes(d: LWProcess.Definition, bpsim: boolean): string[] {
  const out: string[] = [], steps = (has: (s: LWProcess.Step) => unknown) => list(d.steps.filter(has).map(s => s.name), 'step');
  const add = (names: string, text: (names: string) => string) => { if (names) out.push(text(names)); };
  if (bpsim) arrivalNotes(d, out);
  else out.push(`Without BPSim, case arrivals, durations, probabilities, pool sizes and costs are ${ONLY}; export with BPSim to carry them.`);
  const writes = (s: LWProcess.Step) => Object.keys(s.set ?? {}).length || Object.keys(s.add ?? {}).length || s.draws?.length;
  add(steps(writes), x => `Case fields and counters written by ${x} are ${ONLY}, so conditions that read them behave differently without it.`);
  add(steps(s => s.needs?.length || s.outputs?.length), x => `Needs and declared outputs of ${x} are ${ONLY}.`);
  add(steps(s => s.until !== undefined), x => `Timers of ${x} wait until an absolute minute, which is ${ONLY}; other tools see a 1970 calendar date.`);
  add(steps(s => s.deadline?.timing), x => `Random deadline timing of ${x} is ${ONLY}; BPMN carries its mean.`);
  add(steps(s => s.backlog), x => `Backlogs of ${x} are ${ONLY}.`);
  add(list(d.resources.filter(r => r.kind && r.kind !== 'people').map(r => r.name), 'pool'), x => `Pool kinds of ${x} are ${ONLY}.`);
  const hours = hoursNote(d, bpsim);
  if (hours) out.push(hours);
  return out;
 }
 function write(d: LWProcess.Definition, ids: LWProcessBpmn.Ids, add: Add): void {
  const first = d.arrivals[0];
  const block = (ref: string, inner: (depth: number) => void) => {
   add(2, `<bpsim:ElementParameters elementRef="${ref}">`);
   inner(3);
   add(2, '</bpsim:ElementParameters>');
  };
  add(0, '<bpsim:BPSimData>');
  add(1, `<bpsim:Scenario id="Scenario_${d.id}" name="Wildlands simulation">`);
  // The scenario Duration is the simulated span from the scenario start (minute 0), so an `until` stream ends at that absolute
  // minute; the importer reads it back as `until`.
  // The run seed travels as the BPSim scenario seed, so a tool without the extension still repeats the same run.
  const head = `<bpsim:ScenarioParameters baseTimeUnit="min"${d.seed === undefined ? '' : ` seed="${d.seed}"`}`;
  if (first?.until === undefined) add(2, head + '/>');
  else {
   add(2, head + '>');
   add(3, `<bpsim:Duration><bpsim:DurationParameter value="PT${first.until}M"/></bpsim:Duration>`);
   add(2, '</bpsim:ScenarioParameters>');
  }
  const wrap = (depth: number, group: string, name: string, inner: string) => {
   add(depth, `<bpsim:${group}>`);
   add(depth + 1, `<bpsim:${name}>${inner}</bpsim:${name}>`);
   add(depth, `</bpsim:${group}>`);
  };
  const timed = !!first && (!!first.gap || first.interval > 0 || first.count !== undefined), props = first ? properties(first) : [];
  const hours = d.workingHours, cal = `Calendar_${d.id}`, valid = (value: string) => hours ? value.replace('/>', ` validFor="${cal}"/>`) : value;
  /** Arrival timing as control parameters and the case data as properties, in the order BPSim declares the groups. */
  const arrival = (a: LWProcess.Arrival, depth: number) => {
   if (timed) {
    add(depth, '<bpsim:ControlParameters>');
    const gap = a.gap ? dist(a.gap) : constant('FloatingParameter', a.interval);
    if (a.gap || a.interval > 0) add(depth + 1, `<bpsim:InterTriggerTimer>${valid(gap)}</bpsim:InterTriggerTimer>`);
    if (a.count !== undefined) add(depth + 1, `<bpsim:TriggerCount>${constant('NumericParameter', a.count)}</bpsim:TriggerCount>`);
    add(depth, '</bpsim:ControlParameters>');
   }
   if (props.length) {
    add(depth, '<bpsim:PropertyParameters>');
    for (const line of props) add(depth + 1, line);
    add(depth, '</bpsim:PropertyParameters>');
   }
  };
  for (const s of d.steps) {
   const work = s.kind === 'task' || s.kind === 'touchpoint' || s.kind === 'machine' || s.kind === 'system', wait = s.kind === 'timer' && s.until === undefined;
   if (s.kind === 'start' && first && (timed || props.length)) block(ids.node(s), depth => arrival(first, depth));
   else if ((work || wait) && (s.duration !== undefined || s.timing)) {
    block(ids.node(s), depth => {
     wrap(depth, 'TimeParameters', work ? 'ProcessingTime' : 'WaitTime', s.timing ? dist(s.timing) : constant('FloatingParameter', s.duration!));
     if (work && s.cost !== undefined) wrap(depth, 'CostParameters', 'FixedCost', constant('FloatingParameter', s.cost));
    });
   }
   if (s.kind === 'decision' || s.kind === 'fork' && s.mode === 'inclusive') {
    const flows = d.flows.filter(f => f.from === s.id && f.on !== 'deadline'), marginal = s.kind === 'decision' ? shares(flows) : undefined;
    for (const f of flows) {
     const p = marginal ? marginal.get(f.id) : s.kind === 'fork' && f.when?.chance !== undefined ? f.when.chance / 100 : undefined;
     if (p !== undefined) block(ids.flow(f), depth => wrap(depth, 'ControlParameters', 'Probability', constant('FloatingParameter', p)));
    }
   }
  }
  for (const r of d.resources) {
   block(ids.resource(r), depth => {
    if (!hours) wrap(depth, 'ResourceParameters', 'Quantity', constant('NumericParameter', r.capacity));
    else {
     // BPSim orders Availability before Quantity within ResourceParameters.
     add(depth, '<bpsim:ResourceParameters>');
     add(depth + 1, `<bpsim:Availability>${valid('<bpsim:BooleanParameter value="true"/>')}</bpsim:Availability>`);
     add(depth + 1, `<bpsim:Quantity>${constant('NumericParameter', r.capacity)}</bpsim:Quantity>`);
     add(depth, '</bpsim:ResourceParameters>');
    }
    wrap(depth, 'CostParameters', 'UnitCost', constant('FloatingParameter', r.costPerMinute));
   });
  }
  if (hours) add(2, `<bpsim:Calendar id="${cal}" name="Working hours">${calendar(d, hours)}</bpsim:Calendar>`);
  add(1, '</bpsim:Scenario>'); add(0, '</bpsim:BPSimData>');
 }
 root.LWProcessBpmnBpsimWrite = {write, notes};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessBpmnBpsimWrite;
})(globalThis);
