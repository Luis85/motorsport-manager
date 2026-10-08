/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-bpmn.ts" />
/** BPSim scenario writer for the BPMN export: processing and wait times, probabilities, arrival timing and pool quantities and costs, in minutes. Wildlands extension values stay authoritative on re-import. */
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessBpmnBpsimWrite?: {write(d: LWProcess.Definition, ids: LWProcessBpmn.Ids, add: (depth: number, line: string) => void): void}};
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
 function write(d: LWProcess.Definition, ids: LWProcessBpmn.Ids, add: Add): void {
  const first = d.arrivals[0], block = (ref: string, inner: (depth: number) => void) => { add(2, `<bpsim:ElementParameters elementRef="${ref}">`); inner(3); add(2, '</bpsim:ElementParameters>'); };
  add(0, '<bpsim:BPSimData>'); add(1, `<bpsim:Scenario id="Scenario_${d.id}" name="Wildlands simulation">`);
  if (first?.until === undefined) add(2, '<bpsim:ScenarioParameters baseTimeUnit="min"/>');
  else { add(2, '<bpsim:ScenarioParameters baseTimeUnit="min">'); add(3, `<bpsim:Duration><bpsim:DurationParameter value="PT${first.until - first.at}M"/></bpsim:Duration>`); add(2, '</bpsim:ScenarioParameters>'); }
  const wrap = (depth: number, group: string, name: string, inner: string) => { add(depth, `<bpsim:${group}>`); add(depth + 1, `<bpsim:${name}>${inner}</bpsim:${name}>`); add(depth, `</bpsim:${group}>`); };
  for (const s of d.steps) {
   const work = s.kind === 'task' || s.kind === 'touchpoint' || s.kind === 'machine' || s.kind === 'system', wait = s.kind === 'timer' && s.until === undefined;
   if (s.kind === 'start' && first && (first.gap || first.interval > 0 || first.count !== undefined)) {
    block(ids.node(s), depth => {
     add(depth, '<bpsim:ControlParameters>');
     if (first.gap || first.interval > 0) add(depth + 1, `<bpsim:InterTriggerTimer>${first.gap ? dist(first.gap) : constant('FloatingParameter', first.interval)}</bpsim:InterTriggerTimer>`);
     if (first.count !== undefined) add(depth + 1, `<bpsim:TriggerCount>${constant('NumericParameter', first.count)}</bpsim:TriggerCount>`);
     add(depth, '</bpsim:ControlParameters>');
    });
   } else if ((work || wait) && (s.duration !== undefined || s.timing)) {
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
    wrap(depth, 'ResourceParameters', 'Quantity', constant('NumericParameter', r.capacity));
    wrap(depth, 'CostParameters', 'UnitCost', constant('FloatingParameter', r.costPerMinute));
   });
  }
  add(1, '</bpsim:Scenario>'); add(0, '</bpsim:BPSimData>');
 }
 root.LWProcessBpmnBpsimWrite = {write};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessBpmnBpsimWrite;
})(globalThis);
