/// <reference path="./process-bpmn-flow.ts" />
/// <reference path="./process-bpmn-bpsim.ts" />
/// <reference path="./process-bpmn-bpsim-write.ts" />
/** BPMN 2.0 import. Wildlands extension values are restored exactly; foreign BPMN is mapped onto simulatable steps (lanes, sub-processes, call activities, gateways, loops, boundary timers, expressions, BPSim) and every foreign element is reported. Unsupported constructs are rejected or dropped explicitly, never guessed. */
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessXml: LWProcessXml.Api; LWProcessCatalog: LWProcess.Catalog; LWProcessBpmnExport: {export(d: unknown, o?: {bpsim?: boolean}): string; vocabulary: LWProcessBpmn.Vocabulary}; LWProcessBpmnExt: LWProcessBpmnExt.Api;
  LWProcessBpmnBpsim: LWProcessBpmnBpsim.Api; LWProcessBpmnImportParts?: LWProcessBpmnParts.Api; LWProcessBpmnBpsimWrite?: LWProcessBpmnBpsimWrite.Api;
  LWProcessBpmn?: LWProcessBpmn.Api};
 const {MODEL} = root.LWProcessBpmnExport.vocabulary;
 type X = LWProcessXml.Node; type Resolved = LWProcessBpmn.Info['options'];
 const kids = (n: X, l: string, ns?: string) => root.LWProcessBpmnExt.kids(n, l, ns);
 const DEFAULTS: Resolved = {defaultDuration: 5, process: null, lanes: 'pools', defaultCapacity: 1, autoSystemPool: true, systemCapacity: 4, minutesPerDay: 480, minutesPerHour: 60, unsupported: 'reject', bpsim: true, scenario: null};
 /** Validates every option before any work; unknown options and out-of-range values throw. */
 function resolve(o: LWProcessBpmn.Options = {}): Resolved {
  const out: Resolved = {...DEFAULTS}, known = new Set(Object.keys(DEFAULTS));
  for (const k of Object.keys(o)) if (!known.has(k)) throw Error('Unknown import option: ' + k + '.');
  const whole = (name: 'defaultDuration' | 'defaultCapacity' | 'systemCapacity' | 'minutesPerDay' | 'minutesPerHour', low: number, high: number) => {
   const v = o[name]; if (v === undefined) return;
   if (!Number.isInteger(v) || v < low || v > high) throw Error('Option ' + name + ' must be a whole number from ' + low + ' to ' + high + '.');
   out[name] = v;
  };
  whole('defaultDuration', 1, 100000); whole('defaultCapacity', 1, 1000); whole('systemCapacity', 1, 1000); whole('minutesPerDay', 1, 1440); whole('minutesPerHour', 1, 60);
  if (o.lanes !== undefined) { if (o.lanes !== 'pools' && o.lanes !== 'ignore') throw Error('Option lanes must be pools or ignore.'); out.lanes = o.lanes; }
  if (o.unsupported !== undefined) { if (o.unsupported !== 'reject' && o.unsupported !== 'drop') throw Error('Option unsupported must be reject or drop.'); out.unsupported = o.unsupported; }
  for (const k of ['autoSystemPool', 'bpsim'] as const) if (o[k] !== undefined) { if (typeof o[k] !== 'boolean') throw Error('Option ' + k + ' must be true or false.'); out[k] = o[k]!; }
  for (const k of ['process', 'scenario'] as const) if (o[k] !== undefined) { if (typeof o[k] !== 'string' || !o[k]) throw Error('Option ' + k + ' must be a non-empty id or name.'); out[k] = o[k]!; }
  return out;
 }
 class Halt extends Error {}
 const empty = (o: Resolved): LWProcessBpmn.Info => ({process: null, processes: [], scenario: null, scenarios: [], horizon: null, options: o});
 function analyze(source: string, raw: LWProcessBpmn.Options = {}): LWProcessBpmn.ImportResult {
  const o = resolve(raw), warnings: string[] = [], rejections: LWProcessBpmn.Rejection[] = [], mapping: LWProcessBpmn.Mapping[] = [], info = empty(o);
  const warn = (m: string) => { if (!warnings.includes(m)) warnings.push(m); };
  const ctx: LWProcessBpmnGraph.Ctx = {o, processes: [], bps: undefined, warn, reject: (id, type, message) => { rejections.push({id, type, message}); },
   unsupported: (item, id, type, message) => { if (o.unsupported === 'drop') { warn(message + ' It was dropped.'); if (item) item.drop = true; } else rejections.push({id, type, message}); },
   note: (id, type, target, how) => { mapping.push({id, type, target, how}); }};
  const halt = () => { if (rejections.length) throw new Halt(); };
  let definition: LWProcess.Definition | undefined;
  try { definition = root.LWProcessBpmnImportParts!.run(source, ctx, info, halt); }
  catch (error) { if (!(error instanceof Halt)) for (const line of (error instanceof Error ? error.message : String(error)).split('\n')) rejections.push({id: '', type: 'import', message: line}); }
  if (rejections.length || !definition) return {ok: false, acceptable: false, definition: undefined, diagnostics: [], warnings, mapping, rejections, info};
  const checked = root.LWProcessCatalog.validate(definition, true);
  return {ok: checked.ok, acceptable: checked.acceptable, definition: checked.definition ?? undefined, diagnostics: checked.diagnostics, warnings, mapping, rejections, info};
 }
 function importBpmn(source: string, options: LWProcessBpmn.Options = {}): LWProcessBpmn.ImportResult {
  const r = analyze(source, options);
  if (r.rejections.length) throw Error(r.rejections.map(x => x.message).join('\n'));
  return r;
 }
 function inspect(source: string): LWProcessBpmn.Inspection {
  const doc = root.LWProcessXml.parse(source);
  if (doc.ns !== MODEL || doc.local !== 'definitions') throw Error('Expected a BPMN 2.0 definitions document.');
  const collab = kids(doc, 'collaboration')[0], refs = new Map((collab ? kids(collab, 'participant') : []).filter(p => p.attrs.processRef).map(p => [p.attrs.processRef!, p.attrs.name ?? p.attrs.id ?? ''] as const));
  const count = (n: X, into: Record<string, number>) => { for (const c of n.children) if (c.ns === MODEL && /(Task|Event|Gateway|Process|callActivity|Flow)$/.test(c.local) && c.local !== 'sequenceFlow') { into[c.local] = (into[c.local] ?? 0) + 1; count(c, into); } };
  const lanes = (n: X): string[] => kids(n, 'laneSet').flatMap(s => kids(s, 'lane').flatMap(l => [l.attrs.name ?? l.attrs.id ?? '', ...kids(l, 'childLaneSet').flatMap(c => kids(c, 'lane').map(x => x.attrs.name ?? x.attrs.id ?? ''))]));
  return {processes: kids(doc, 'process').map(p => { const constructs: Record<string, number> = {}; count(p, constructs); return {id: p.attrs.id ?? '', name: p.attrs.name || refs.get(p.attrs.id ?? '') || p.attrs.id || '', executable: p.attrs.isExecutable === 'true', lanes: lanes(p), constructs}; }),
   scenarios: root.LWProcessBpmnBpsim.scenarios(doc), participants: (collab ? kids(collab, 'participant') : []).map(p => ({id: p.attrs.id ?? '', name: p.attrs.name ?? p.attrs.id ?? '', process: p.attrs.processRef ?? null}))};
 }
 function fidelity(input: unknown, options: {bpsim?: boolean} = {}): string[] {
  const d = root.LWProcessCatalog.validate(input, true).definition;
  if (!d) throw Error('Only a structurally valid process definition can be exported.');
  if (!root.LWProcessBpmnBpsimWrite) throw Error('The BPSim writer is not loaded.');
  const notes = root.LWProcessBpmnBpsimWrite.notes(d, options.bpsim === true);
  // The display calendar has no BPMN or BPSim form: it travels only in the extension, with or without BPSim.
  if (d.calendar) {
   const {minutesPerDay, daysPerWeek} = d.calendar;
   notes.push(`The display calendar (${minutesPerDay} minutes per business day, ${daysPerWeek} days per week) is only in the Wildlands extension; `
    + 'it changes how times are shown, never a run.');
  }
  return notes;
 }
 root.LWProcessBpmn = {export: root.LWProcessBpmnExport.export, fidelity, import: importBpmn, analyze, inspect, options: resolve};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessBpmn;
})(globalThis);
