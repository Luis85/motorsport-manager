/// <reference path="./process-bpmn.ts" />
/** BPSim 1.0 scenario reader for the BPMN importer. Times are converted to whole business minutes; a parameter it cannot express is reported and ignored, never guessed. */
declare namespace LWProcessBpmnBpsim {
 type X = LWProcessXml.Node;
 /** A duration in whole minutes: `mean` is the planning value, `dist` the distribution when the source was random. */
 interface Time {mean: number; dist?: LWProcess.Dist;}
 /** A BPSim `Property` of a start event: a constant case value, or a uniform whole-number range. */
 interface Prop {name: string; value?: LWProcess.Scalar; min?: number; max?: number;}
 interface Params {processing?: Time; wait?: Time; fixedCost?: number; unitCost?: number; quantity?: number; probability?: number; inter?: Time; count?: number; props: Prop[];}
 interface Data {scenario: {id: string; name: string}; scenarios: {id: string; name: string}[]; horizon: number | null; elements: Map<string, Params>;}
 interface Context {minutesPerDay: number; minutesPerHour: number; scenario?: string | undefined; warn(m: string): void;}
 interface Api {
  read(doc: X, c: Context): Data | undefined;
  scenarios(doc: X): {id: string; name: string}[];
  /** ISO-8601 duration (`P1DT2H30M`) in minutes (fractions allowed), or `undefined`; days count `minutesPerDay` business minutes. */
  duration(text: string, c: Pick<Context, 'minutesPerDay' | 'minutesPerHour'>): number | undefined;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessBpmnBpsim?: LWProcessBpmnBpsim.Api};
 type X = LWProcessXml.Node;
 const isBpsim = (n: X) => n.ns.startsWith('http://www.bpsim.org/');
 const lower = (n: X) => n.local.toLowerCase();
 const child = (n: X, name: string) => n.children.find(c => lower(c) === name.toLowerCase());
 function find(n: X, local: string, out: X[] = []): X[] { if (isBpsim(n) && n.local === local) out.push(n); for (const c of n.children) find(c, local, out); return out; }
 const scenarioList = (doc: X) => find(doc, 'BPSimData').flatMap(d => d.children.filter(c => isBpsim(c) && c.local === 'Scenario'));
 const label = (s: X) => ({id: s.attrs.id ?? '', name: s.attrs.name ?? s.attrs.id ?? ''});
 function duration(text: string, c: Pick<LWProcessBpmnBpsim.Context, 'minutesPerDay' | 'minutesPerHour'>): number | undefined {
  const m = /^P(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(text.trim());
  if (!m || m.slice(1).every(v => v === undefined) || /T$/.test(text.trim())) return undefined;
  const [w, d, h, min, s] = m.slice(1).map(v => v === undefined ? 0 : Number(v)) as [number, number, number, number, number];
  return (w * 5 + d) * c.minutesPerDay + h * c.minutesPerHour + min + s / 60;
 }
 const CONSTANT = ['ConstantParam', 'ConstantParameter', 'FloatingParameter', 'NumericParameter', 'DurationParameter'];
 const UNSUPPORTED = ['PoissonDistribution', 'GammaDistribution', 'LogNormalDistribution', 'WeibullDistribution', 'BetaDistribution', 'BinomialDistribution', 'TruncatedNormalDistribution', 'UserDistribution', 'ExpressionParameter', 'JavaScript'];
 function read(doc: X, c: LWProcessBpmnBpsim.Context): LWProcessBpmnBpsim.Data | undefined {
  const all = scenarioList(doc); if (!all.length) return undefined;
  const scenarios = all.map(label);
  const chosen = c.scenario === undefined ? all[0]! : all.find(s => s.attrs.id === c.scenario || s.attrs.name === c.scenario);
  if (!chosen) throw Error('BPSim scenario "' + c.scenario + '" was not found; the file has ' + scenarios.map(s => '"' + (s.id || s.name) + '"').join(', ') + '.');
  if (c.scenario === undefined && all.length > 1) c.warn('The file has ' + all.length + ' BPSim scenarios; the first, "' + (label(chosen).id || label(chosen).name) + '", is used. Choose another with the scenario option.');
  const ignored = new Map<string, Set<string>>(), skip = (what: string, ref: string) => { if (!ignored.has(what)) ignored.set(what, new Set()); ignored.get(what)!.add(ref); };
  const params = child(chosen, 'ScenarioParameters');
  const unitOf = (text: string | undefined, fallback: number): number => {
   const u = (text ?? '').toLowerCase();
   if (!u) return fallback;
   const table: Record<string, number> = {ms: 1 / 60000, s: 1 / 60, sec: 1 / 60, second: 1 / 60, seconds: 1 / 60, min: 1, mins: 1, minute: 1, minutes: 1, h: c.minutesPerHour, hr: c.minutesPerHour, hrs: c.minutesPerHour,
    hour: c.minutesPerHour, hours: c.minutesPerHour, d: c.minutesPerDay, day: c.minutesPerDay, days: c.minutesPerDay, wk: 5 * c.minutesPerDay, wks: 5 * c.minutesPerDay, week: 5 * c.minutesPerDay, weeks: 5 * c.minutesPerDay};
   if (Object.hasOwn(table, u)) return table[u]!;
   c.warn('BPSim time unit "' + text + '" is not supported; the scenario base unit applies.'); return fallback;
  };
  const baseNode = params && child(params, 'baseTimeUnit'), base = unitOf(params?.attrs.baseTimeUnit ?? baseNode?.attrs.value ?? baseNode?.text.trim(), 1);
  const valueOf = (n: X): string | undefined => n.attrs.value ?? n.children.find(k => k.attrs.value !== undefined)?.attrs.value ?? (n.text.trim() || undefined);
  const minutes = (x: number, ref: string): number | undefined => {
   if (!Number.isFinite(x) || x < 0) { c.warn('BPSim time of "' + ref + '" is not a positive number and is ignored.'); return undefined; }
   if (x < 1) { c.warn('BPSim time of "' + ref + '" is under one minute and is rounded up to 1 minute.'); return 1; }
   return Math.round(x);
  };
  const num = (n: X | undefined, ref: string, what: string): number | undefined => {
   const raw = n && valueOf(n.children[0] ?? n); if (raw === undefined) return undefined;
   const v = Number(raw); if (!Number.isFinite(v)) { c.warn('BPSim ' + what + ' of "' + ref + '" is not a number and is ignored.'); return undefined; } return v;
  };
  /** One time parameter wrapper (`ProcessingTime`, `WaitTime`, `InterTriggerTimer`, scenario `Duration`) -> whole minutes. */
  function time(wrapper: X, ref: string, what: string): LWProcessBpmnBpsim.Time | undefined {
   const body = wrapper.children[0]; if (!body) return undefined;
   const f = unitOf(body.attrs.timeUnit ?? wrapper.attrs.timeUnit, base), a = body.attrs, n = (k: string) => Number(a[k]);
   const m = (x: number) => minutes(x * f, ref), plan = (v: number | undefined, dist?: LWProcess.Dist): LWProcessBpmnBpsim.Time | undefined => v === undefined ? undefined : dist ? {mean: v, dist} : {mean: v};
   if (CONSTANT.includes(body.local)) {
    const raw = valueOf(body) ?? '', iso = body.local === 'DurationParameter' && /^P/.test(raw) ? duration(raw, c) : undefined;
    return plan(iso !== undefined ? minutes(iso, ref) : m(Number(raw)));
   }
   if (body.local === 'UniformDistribution') { const lo = m(n('min')), hi = m(n('max')); return lo === undefined || hi === undefined ? undefined : plan(Math.round((lo + hi) / 2), {dist: 'uniform', min: Math.min(lo, hi), max: Math.max(lo, hi)}); }
   if (body.local === 'TriangularDistribution') {
    const v = [m(n('min')), m(n('mode')), m(n('max'))]; if (v.some(x => x === undefined)) return undefined;
    const [lo, mo, hi] = (v as number[]).slice().sort((x, y) => x - y) as [number, number, number];
    return plan(Math.round((lo + mo + hi) / 3), {dist: 'triangular', min: lo, mode: mo, max: hi});
   }
   if (body.local === 'NegativeExponentialDistribution') { const mean = m(n('mean')); return plan(mean, mean === undefined ? undefined : {dist: 'exponential', mean}); }
   if (body.local === 'NormalDistribution') { const mean = m(n('mean')), sd = m(n('standardDeviation')); return mean === undefined || sd === undefined ? undefined : plan(mean, {dist: 'normal', mean, sd}); }
   if (body.local === 'ErlangDistribution') {
    const mean = m(n('mean')), k = Math.max(1, Math.min(32, Math.round(n('k')))); if (mean === undefined || !Number.isFinite(k)) return undefined;
    if (n('k') > 32 || n('k') < 1) c.warn('BPSim Erlang k of "' + ref + '" is limited to 1..32.');
    return plan(mean, {dist: 'erlang', k, mean});
   }
   c.warn('BPSim ' + (UNSUPPORTED.includes(body.local) ? body.local : 'parameter ' + body.local) + ' for ' + what + ' of "' + ref + '" is not supported; the default duration applies.'); return undefined;
  }
  const elements = new Map<string, LWProcessBpmnBpsim.Params>();
  for (const ep of chosen.children.filter(k => k.local === 'ElementParameters' && k.attrs.elementRef)) {
   const ref = ep.attrs.elementRef!, p: LWProcessBpmnBpsim.Params = elements.get(ref) ?? {props: []}; elements.set(ref, p);
   for (const group of ep.children) {
    for (const item of group.children) {
     const name = item.local;
     if (group.local === 'TimeParameters' && name === 'ProcessingTime') { const t = time(item, ref, name); if (t) p.processing = t; }
     else if (group.local === 'TimeParameters' && name === 'WaitTime') { const t = time(item, ref, name); if (t) p.wait = t; }
     else if (group.local === 'ControlParameters' && name === 'Probability') { const v = num(item, ref, name); if (v !== undefined) p.probability = v > 1 && v <= 100 ? v / 100 : v; }
     else if (group.local === 'ControlParameters' && name === 'InterTriggerTimer') { const t = time(item, ref, name); if (t) p.inter = t; }
     else if (group.local === 'ControlParameters' && name === 'TriggerCount') { const v = num(item, ref, name); if (v !== undefined) p.count = Math.round(v); }
     else if (group.local === 'ResourceParameters' && name === 'Quantity') { const v = num(item, ref, name); if (v !== undefined) p.quantity = Math.round(v); }
     else if (group.local === 'CostParameters' && name === 'FixedCost') { const v = num(item, ref, name); if (v !== undefined) p.fixedCost = v; }
     else if (group.local === 'CostParameters' && name === 'UnitCost') { const v = num(item, ref, name); if (v !== undefined) p.unitCost = v / unitOf(item.attrs.timeUnit ?? item.children[0]?.attrs.timeUnit, base); }
     else if (group.local === 'PropertyParameters' && name === 'Property' && item.attrs.name) {
      const body = item.children[0], v = body && valueOf(body);
      if (body && ['NumericParameter', 'FloatingParameter'].includes(body.local) && v !== undefined && Number.isFinite(Number(v))) p.props.push({name: item.attrs.name, value: Number(v)});
      else if (body && body.local === 'StringParameter' && v !== undefined) p.props.push({name: item.attrs.name, value: v});
      else if (body && body.local === 'BooleanParameter' && v !== undefined) p.props.push({name: item.attrs.name, value: v === 'true'});
      else if (body && body.local === 'UniformDistribution') p.props.push({name: item.attrs.name, min: Math.round(Number(body.attrs.min)), max: Math.round(Number(body.attrs.max))});
      else skip('PropertyParameters/Property', ref);
     } else skip(/^(Selection|SelectionCriteria|Priority|Interruptible)$/.test(name) || group.local === 'PriorityParameters' ? 'Selection/Priority' : group.local + '/' + name, ref);
    }
    if (!group.children.length && !['TimeParameters', 'ControlParameters', 'ResourceParameters', 'CostParameters', 'PropertyParameters'].includes(group.local)) skip(group.local, ref);
   }
  }
  for (const [what, refs] of ignored) c.warn('BPSim ' + what + ' parameters are ignored (' + [...refs].join(', ') + ').');
  let horizon: number | null = null;
  if (params) {
   const d = child(params, 'Duration'), t = d && time(d, 'scenario', 'Duration'); if (t) horizon = t.mean;
   const rep = child(params, 'Replication'), reps = params.attrs.replication ?? (rep && valueOf(rep));
   if (reps !== undefined) c.warn('BPSim replication ' + reps + ' is ignored: Wildlands runs one seeded run per command; vary the seed instead.');
  }
  return {scenario: label(chosen), scenarios, horizon, elements};
 }
 root.LWProcessBpmnBpsim = {read, scenarios: doc => scenarioList(doc).map(label), duration};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessBpmnBpsim;
})(globalThis);
