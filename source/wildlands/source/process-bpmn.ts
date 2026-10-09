/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-xml.ts" />
/// <reference path="./process-bpmn-expr.ts" />
/** BPMN 2.0 interchange for the supported process subset. Wildlands-only values travel in a namespaced extension, so export then import is lossless; standard constructs are emitted too so other tools see them. */
declare namespace LWProcessBpmn {
 /** Import options; every one is optional. `unsupported: 'drop'` removes unsupported constructs with warnings instead of rejecting the file. */
 interface Options {
  defaultDuration?: number; process?: string; lanes?: 'pools' | 'ignore'; defaultCapacity?: number; autoSystemPool?: boolean; systemCapacity?: number;
  minutesPerDay?: number; minutesPerHour?: number; unsupported?: 'reject' | 'drop'; bpsim?: boolean; scenario?: string;
 }
 /** One foreign element and what it became: `target` is `step:<id>`, `flow:<id>`, `pool:<id>`, `field:<name>`, `arrival:<n>`, `sipoc:<name>` or `none`. */
 interface Mapping {id: string; type: string; target: string; how: string;}
 interface Rejection {id: string; type: string; message: string;}
 interface Info {
  process: {id: string; name: string} | null; processes: {id: string; name: string; executable: boolean}[]; scenario: string | null; scenarios: {id: string; name: string}[]; horizon: number | null;
  options: Required<Omit<Options, 'process' | 'scenario'>> & {process: string | null; scenario: string | null};
 }
 /** `ok` and `acceptable` follow the engine validator; both are false with no `definition` when `rejections` is not empty. */
 interface ImportResult {
  ok: boolean; acceptable: boolean; definition: LWProcess.Definition | undefined; diagnostics: LWProcess.Diagnostic[]; warnings: string[];
  mapping: Mapping[]; rejections: Rejection[]; info: Info;
 }
 /** What a file offers before importing it: processes (with lanes and construct counts), BPSim scenarios and participants. */
 interface Inspection {
  processes: {id: string; name: string; executable: boolean; lanes: string[]; constructs: Record<string, number>}[]; scenarios: {id: string; name: string}[];
  participants: {id: string; name: string; process: string | null}[];
 }
 interface Api {
  export(definition: unknown, options?: {bpsim?: boolean}): string;
  /** Throws an Error listing every rejection (one per line); otherwise returns the report. */
  import(xml: string, options?: Options): ImportResult;
  /** The same report without throwing for content problems: `rejections` lists them and `definition` is absent. */
  analyze(xml: string, options?: Options): ImportResult;
  /** Validates and completes an options object (defaults filled in); throws an Error naming the first invalid option. */
  options(options?: Options): Info['options'];
  inspect(xml: string): Inspection;
 }
 /** Shared vocabulary of the export/import halves. */
 interface Vocabulary {MODEL: string; DI: string; DC: string; WL: string; BPSIM: string; UNIT: number; OPS: Record<string, string>; COLORS: Record<string, string>;}
 /** Resolved BPMN ids of the exported elements, shared with the BPSim writer. */
 interface Ids {node(s: LWProcess.Step): string; flow(f: LWProcess.Flow): string; resource(r: LWProcess.Resource): string; process: string;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessXml: LWProcessXml.Api; LWProcessCatalog: LWProcess.Catalog; LWProcessBpmnExpr: LWProcessBpmnExpr.Api;
  LWProcessBpmnBpsimWrite?: {write(d: LWProcess.Definition, ids: LWProcessBpmn.Ids, add: (depth: number, line: string) => void): void};
  LWProcessBpmnExport?: {export(definition: unknown, options?: {bpsim?: boolean}): string; vocabulary: LWProcessBpmn.Vocabulary}};
 const MODEL = 'http://www.omg.org/spec/BPMN/20100524/MODEL', DI = 'http://www.omg.org/spec/BPMN/20100524/DI', DC = 'http://www.omg.org/spec/DD/20100524/DC', DIAG = 'http://www.omg.org/spec/DD/20100524/DI';
 const WL = 'urn:wildlands:process:1', BPSIM = 'http://www.bpsim.org/schemas/1.0', UNIT = 10, SIZE: Record<string, [number, number]> = {event: [36, 36], gateway: [50, 50], task: [100, 80]};
 const COLORS: Record<string, string> = {start: '#77b5a0', end: '#77b5a0', task: '#ffbb73', timer: '#ffbb73', decision: '#d6a2ce', fork: '#91b9d5', join: '#91b9d5'};
 const xml = () => root.LWProcessXml, esc = (v: unknown) => xml().escape(v);
 /** Expression text: only the characters XML requires are escaped, so quotes stay readable. */
 const code = (v: string) => xml().text(v, false);
 /** Names of containers that are present but empty; the extension lists them (`empty="..."`) so import restores them and the fingerprint holds. */
 const emptied = (o: object, keys: readonly string[]) => keys.filter(k => { const v = (o as Record<string, unknown>)[k]; return Array.isArray(v) ? !v.length : !!v && typeof v === 'object' && !Object.keys(v).length; }).join(' ') || undefined;

 // ---------------------------------------------------------------- export
 /** Calendar text for business minute `m` counted from 1970-01-01T00:00Z (pure integer arithmetic, no clock). */
 function epochInstant(m: number): string {
  const z = Math.floor(m / 1440) + 719468, era = Math.floor(z / 146097), doe = z - era * 146097, yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100)), mp = Math.floor((5 * doy + 2) / 153), day = doy - Math.floor((153 * mp + 2) / 5) + 1, month = mp < 10 ? mp + 3 : mp - 9, year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  const two = (n: number) => String(n).padStart(2, '0'), inDay = m % 1440;
  return `${year}-${two(month)}-${two(day)}T${two(Math.floor(inDay / 60))}:${two(inDay % 60)}:00Z`;
 }
 /** Standard timer shape: duration is `PT{n}M`; an absolute business minute is a `timeDate` on a synthetic 1970-01-01T00:00Z epoch (the exact minute is in the Wildlands extension). */
 function timerDefinition(s: LWProcess.Step, add: (depth: number, line: string) => void): void {
  add(3, '<bpmn:timerEventDefinition>');
  if (s.until === undefined) add(4, `<bpmn:timeDuration xsi:type="bpmn:tFormalExpression">PT${s.duration}M</bpmn:timeDuration>`);
  else add(4, `<bpmn:timeDate xsi:type="bpmn:tFormalExpression">${epochInstant(s.until)}</bpmn:timeDate>`);
  add(3, '</bpmn:timerEventDefinition>');
 }
 /** Work steps run like tasks: task, touchpoint, machine and system. */
 const isWork = (s: LWProcess.Step) => s.kind === 'task' || s.kind === 'touchpoint' || s.kind === 'machine' || s.kind === 'system';
 const scalar = (name: string, v: LWProcess.Scalar) => `${name}type="${v === null ? 'null' : typeof v}" ${name}value="${esc(v === null ? '' : v)}"`.replace(/^ /, '');
 const attrs = (o: Record<string, unknown>) => Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
 const distAttrs = (x: LWProcess.Dist) => attrs({dist: x.dist, min: x.min, mode: x.mode, max: x.max, mean: x.mean, sd: x.sd, k: x.k});
 /** Planning mean of a distribution in minutes, for tools that only know one standard duration. */
 const distMean = (x: LWProcess.Dist): number => Math.max(1, Math.round(x.dist === 'uniform' ? (x.min! + x.max!) / 2 : x.dist === 'triangular' ? (x.min! + x.mode! + x.max!) / 3 : x.mean!));
 type Add = (depth: number, line: string) => void;
 /** Random case fields as `<wl:draw>`; true/false results and choice values keep their exact scalar type. */
 function drawLines(draws: LWProcess.Draw[], depth: number, add: Add): void {
  for (const x of draws) {
   const head = `<wl:draw${attrs({field: x.field, kind: x.kind, percent: x.percent, min: x.min, max: x.max})}`;
   if (x.whenTrue === undefined && x.whenFalse === undefined && !x.values) { add(depth, head + '/>'); continue; }
   add(depth, head + '>');
   if (x.whenTrue !== undefined) add(depth + 1, `<wl:whenTrue ${scalar('', x.whenTrue)}/>`);
   if (x.whenFalse !== undefined) add(depth + 1, `<wl:whenFalse ${scalar('', x.whenFalse)}/>`);
   for (const v of x.values ?? []) add(depth + 1, `<wl:choice weight="${v.weight}" ${scalar('', v.value)}/>`);
   add(depth, '</wl:draw>');
  }
 }
 /** The exact condition in the extension: a leaf, a chance, or a nested `combine` of them. */
 function whenLines(when: LWProcess.When, depth: number, add: Add): void {
  const list = when.all ?? when.any, kind = when.all ? 'all' : when.any ? 'any' : when.not ? 'not' : undefined;
  if (kind) { add(depth, `<wl:when combine="${kind}">`); for (const c of list ?? [when.not!]) whenLines(c, depth + 1, add); add(depth, '</wl:when>'); }
  else if (when.chance !== undefined) add(depth, `<wl:when chance="${when.chance}"/>`);
  else if (when.field !== undefined) add(depth, `<wl:when field="${when.field}" op="${when.op}" ${when.valueField === undefined ? scalar('', when.value) : `valueField="${when.valueField}"`}/>`);
 }
 function exportBpmn(input: unknown, options: {bpsim?: boolean} = {}): string {
  const d = root.LWProcessCatalog.validate(input, true).definition;
  if (!d) throw Error('Only a structurally valid process definition can be exported.');
  const steps = new Map(d.steps.map(s => [s.id, s])), xs = d.steps.map(s => s.scene.position[0]), ys = d.steps.map(s => s.scene.position[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys), pid = 'Process_' + d.id, pools = new Map(d.resources.map(r => [r.id, r]));
  const inclusiveJoins = new Set(d.steps.filter(s => s.kind === 'fork' && s.mode === 'inclusive').map(s => s.join));
  const nodeId = (s: LWProcess.Step) => (s.kind === 'start' ? 'StartEvent_' : s.kind === 'end' ? 'EndEvent_' : s.kind === 'timer' ? 'Event_' : isWork(s) ? 'Activity_' : 'Gateway_') + s.id;
  const out: string[] = [], add: Add = (depth, line) => out.push(' '.repeat(depth * 2) + line), bpsim = options.bpsim === true;
  add(0, '<?xml version="1.0" encoding="UTF-8"?>');
  add(0, `<bpmn:definitions xmlns:bpmn="${MODEL}" xmlns:bpmndi="${DI}" xmlns:dc="${DC}" xmlns:di="${DIAG}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:wl="${WL}"${bpsim ? ` xmlns:bpsim="${BPSIM}"` : ''}` +
   attrs({id: 'Definitions_' + d.id, name: d.name, targetNamespace: 'urn:wildlands:process:' + d.id, exporter: 'Wildlands Process Studio', exporterVersion: '1'}) + '>');
  for (const r of d.resources) {
   add(1, `<bpmn:resource id="Resource_${r.id}" name="${esc(r.name)}">`); add(2, '<bpmn:extensionElements>');
   add(3, `<wl:resource id="${r.id}" capacity="${r.capacity}" costPerMinute="${r.costPerMinute}"${r.kind ? ` kind="${r.kind}"` : ''}/>`); add(2, '</bpmn:extensionElements>'); add(1, '</bpmn:resource>');
  }
  add(1, `<bpmn:process id="${pid}" name="${esc(d.name)}" isExecutable="false">`);
  if (d.description !== undefined) add(2, `<bpmn:documentation>${xml().text(d.description)}</bpmn:documentation>`);
  const processEmpty = emptied({track: d.track, sipoc: d.sipoc, suppliers: d.sipoc?.suppliers, customers: d.sipoc?.customers}, ['track', 'sipoc', 'suppliers', 'customers']);
  add(2, '<bpmn:extensionElements>'); add(3, `<wl:process id="${d.id}" revision="${d.revision}"${d.$schema ? ` schema="${esc(d.$schema)}"` : ''}${d.seed !== undefined ? ` seed="${d.seed}"` : ''}${d.genre !== undefined ? ` genre="${d.genre}"` : ''}${attrs({empty: processEmpty})}/>`);
  for (const t of d.track ?? []) add(3, `<wl:track${attrs({field: t.field, label: t.label})}/>`);
  for (const p of d.sipoc?.suppliers ?? []) add(3, `<wl:supplier${attrs({name: p.name, supplies: p.supplies})}/>`);
  for (const p of d.sipoc?.customers ?? []) add(3, `<wl:customer${attrs({name: p.name, receives: p.receives})}/>`);
  for (const a of d.arrivals) {
   const inner = Object.keys(a.data).length > 0 || a.gap !== undefined || (a.draws?.length ?? 0) > 0;
   add(3, `<wl:arrival${attrs({at: a.at, count: a.count, until: a.until, open: a.open === undefined ? undefined : 'true', interval: a.interval, empty: emptied(a, ['draws'])})}${inner ? '>' : '/>'}`);
   if (inner) {
    if (a.gap) add(4, `<wl:gap${distAttrs(a.gap)}/>`);
    drawLines(a.draws ?? [], 4, add);
    for (const [k, v] of Object.entries(a.data)) add(4, `<wl:data name="${k}" ${scalar('', v)}/>`);
    add(3, '</wl:arrival>');
   }
  }
  add(2, '</bpmn:extensionElements>');
  // Lanes: the first people pool a work step demands is its lane, so other tools show who does the work.
  const lanes = new Map<string, string[]>();
  for (const s of d.steps.filter(isWork)) { const pool = Object.keys(s.resources ?? {}).map(id => pools.get(id)).find(r => r !== undefined && (r.kind ?? 'people') === 'people'); if (pool) lanes.set(pool.id, [...lanes.get(pool.id) ?? [], nodeId(s)]); }
  if (lanes.size) {
   add(2, `<bpmn:laneSet id="LaneSet_${d.id}">`);
   for (const r of d.resources.filter(r => lanes.has(r.id))) {
    add(3, `<bpmn:lane id="Lane_${r.id}" name="${esc(r.name)}">`); add(4, '<bpmn:extensionElements>'); add(5, `<wl:lane resource="${r.id}"/>`); add(4, '</bpmn:extensionElements>');
    for (const ref of lanes.get(r.id)!) add(4, `<bpmn:flowNodeRef>${ref}</bpmn:flowNodeRef>`);
    add(3, '</bpmn:lane>');
   }
   add(2, '</bpmn:laneSet>');
  }
  const normal = (id: string) => d.flows.filter(f => f.from === id && f.on !== 'deadline');
  for (const s of d.steps) {
   const element = s.kind === 'start' ? 'startEvent' : s.kind === 'end' ? 'endEvent' : s.kind === 'system' ? 'serviceTask' : s.kind === 'touchpoint' ? 'userTask' : isWork(s) ? 'task' : s.kind === 'timer' ? 'intermediateCatchEvent' : s.kind === 'decision' ? 'exclusiveGateway'
    : s.kind === 'fork' ? (s.mode === 'inclusive' ? 'inclusiveGateway' : 'parallelGateway') : inclusiveJoins.has(s.id) ? 'inclusiveGateway' : 'parallelGateway';
   const incoming = d.flows.filter(f => f.to === s.id), outgoing = normal(s.id), fallback = s.kind === 'decision' || s.kind === 'fork' && s.mode === 'inclusive' ? outgoing.find(f => !f.when) : undefined;
   const gateway = isWork(s) || s.kind === 'timer' || s.kind === 'start' || s.kind === 'end' ? {} : {gatewayDirection: s.kind === 'join' ? 'Converging' : 'Diverging'};
   add(2, `<bpmn:${element}${attrs({id: nodeId(s), name: s.name, default: fallback ? 'Flow_' + fallback.id : undefined, ...gateway})}>`);
   if (s.description !== undefined) add(3, `<bpmn:documentation>${xml().text(s.description)}</bpmn:documentation>`);
   add(3, '<bpmn:extensionElements>');
   add(4, `<wl:step id="${s.id}"${attrs({kind: s.kind === 'machine' || s.kind === 'system' || s.kind === 'touchpoint' ? s.kind : undefined, duration: s.duration, until: s.until, cost: s.cost, join: s.join, technology: s.technology,
    channel: s.channel, outcome: s.outcome, phase: s.phase, emotion: s.emotion, pain: s.pain, opportunity: s.opportunity, empty: emptied(s, ['set', 'add', 'resources', 'needs', 'outputs', 'draws'])})}/>`);
   if (s.timing) add(4, `<wl:timing${distAttrs(s.timing)}/>`);
   if (s.instances) add(4, `<wl:instances${attrs({count: s.instances.count, field: s.instances.field, mode: s.instances.mode})}/>`);
   drawLines(s.draws ?? [], 4, add);
   for (const o of s.outputs ?? []) add(4, `<wl:output${attrs({field: o.field, label: o.label})}/>`);
   for (const [k, v] of Object.entries(s.add ?? {})) add(4, `<wl:add name="${k}" delta="${v}"/>`);
   for (const [k, v] of Object.entries(s.set ?? {})) add(4, `<wl:set name="${k}" ${scalar('', v)}/>`);
   for (const n of s.needs ?? []) add(4, `<wl:need field="${n.field}"${n.op ? ` op="${n.op}" ${scalar('', n.value ?? null)}` : ''}${n.label ? ` label="${esc(n.label)}"` : ''}/>`);
   if (s.backlog) add(4, `<wl:backlog${attrs({capacity: s.backlog.capacity, order: s.backlog.order, priority: s.backlog.priority, pull: s.backlog.pull})}/>`);
   add(4, `<wl:scene id="${esc(s.scene.id)}" x="${s.scene.position[0]}" y="${s.scene.position[1]}" color="${s.scene.color}"${s.scene.asset === undefined ? '/>' : '>'}`);
   if (s.scene.asset !== undefined) { add(5, `<wl:asset>${esc(JSON.stringify(s.scene.asset))}</wl:asset>`); add(4, '</wl:scene>'); }
   add(3, '</bpmn:extensionElements>');
   for (const f of incoming) add(3, `<bpmn:incoming>Flow_${f.id}</bpmn:incoming>`);
   for (const f of outgoing) add(3, `<bpmn:outgoing>Flow_${f.id}</bpmn:outgoing>`);
   if (s.kind === 'timer') timerDefinition(s, add);
   for (const [id, quantity] of Object.entries(s.resources ?? {})) {
    add(3, `<bpmn:performer id="Performer_${s.id}_${id}" name="${esc(pools.get(id)?.name ?? id)}">`);
    add(4, '<bpmn:extensionElements>'); add(5, `<wl:demand quantity="${quantity}"/>`); add(4, '</bpmn:extensionElements>');
    add(4, `<bpmn:resourceRef>Resource_${id}</bpmn:resourceRef>`); add(3, '</bpmn:performer>');
   }
   if (s.instances) {
    add(3, `<bpmn:multiInstanceLoopCharacteristics isSequential="${s.instances.mode === 'sequential'}">`);
    add(4, `<bpmn:loopCardinality xsi:type="bpmn:tFormalExpression">${s.instances.count !== undefined ? s.instances.count : '${' + s.instances.field + '}'}</bpmn:loopCardinality>`);
    add(3, '</bpmn:multiInstanceLoopCharacteristics>');
   }
   add(2, `</bpmn:${element}>`);
   if (s.deadline) {
    const dl = s.deadline, minutes = dl.after ?? distMean(dl.timing!);
    add(2, `<bpmn:boundaryEvent id="Boundary_${s.id}" name="Deadline" attachedToRef="${nodeId(s)}" cancelActivity="${dl.mode === 'interrupt'}">`);
    add(3, '<bpmn:extensionElements>'); add(4, `<wl:deadline${attrs({mode: dl.mode, flow: dl.flow, after: dl.after})}/>`);
    if (dl.timing) add(4, `<wl:timing${distAttrs(dl.timing)}/>`);
    add(3, '</bpmn:extensionElements>'); add(3, `<bpmn:outgoing>Flow_${dl.flow}</bpmn:outgoing>`);
    add(3, '<bpmn:timerEventDefinition>'); add(4, `<bpmn:timeDuration xsi:type="bpmn:tFormalExpression">PT${minutes}M</bpmn:timeDuration>`); add(3, '</bpmn:timerEventDefinition>');
    add(2, '</bpmn:boundaryEvent>');
   }
  }
  const source = (f: LWProcess.Flow) => f.on === 'deadline' ? 'Boundary_' + f.from : nodeId(steps.get(f.from)!);
  for (const f of d.flows) {
   add(2, `<bpmn:sequenceFlow id="Flow_${f.id}"${attrs({name: f.label, sourceRef: source(f), targetRef: nodeId(steps.get(f.to)!)})}>`);
   add(3, '<bpmn:extensionElements>'); add(4, `<wl:flow id="${f.id}"/>`);
   if (f.when) whenLines(f.when, 4, add);
   add(3, '</bpmn:extensionElements>');
   // A chance has no standard expression syntax; it uses the BPMN `language` attribute with a Wildlands language URI and the plain text `15%`.
   if (f.when?.chance !== undefined) add(3, `<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="${WL}#chance">${f.when.chance}%</bpmn:conditionExpression>`);
   const expression = f.when && f.when.chance === undefined ? root.LWProcessBpmnExpr.format(f.when) : undefined;
   if (expression !== undefined) add(3, `<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">\${${code(expression)}}</bpmn:conditionExpression>`);
   add(2, '</bpmn:sequenceFlow>');
  }
  add(1, '</bpmn:process>');
  const shape = (s: LWProcess.Step) => { const [w, h] = SIZE[isWork(s) ? 'task' : s.kind === 'start' || s.kind === 'end' || s.kind === 'timer' ? 'event' : 'gateway']!; return {w, h, cx: 150 + (s.scene.position[0] - minX) * UNIT, cy: 120 + (s.scene.position[1] - minY) * UNIT}; };
  add(1, '<bpmndi:BPMNDiagram id="Diagram_1">'); add(2, `<bpmndi:BPMNPlane id="Plane_1" bpmnElement="${pid}">`);
  for (const s of d.steps) {
   const b = shape(s); add(3, `<bpmndi:BPMNShape id="${nodeId(s)}_di" bpmnElement="${nodeId(s)}"${s.kind === 'decision' ? ' isMarkerVisible="true"' : ''}>`);
   add(4, `<dc:Bounds x="${b.cx - b.w / 2}" y="${b.cy - b.h / 2}" width="${b.w}" height="${b.h}"/>`); add(3, '</bpmndi:BPMNShape>');
   if (s.deadline) { add(3, `<bpmndi:BPMNShape id="Boundary_${s.id}_di" bpmnElement="Boundary_${s.id}">`); add(4, `<dc:Bounds x="${b.cx - 18}" y="${b.cy + b.h / 2 - 18}" width="36" height="36"/>`); add(3, '</bpmndi:BPMNShape>'); }
  }
  type Box = {w: number; h: number; cx: number; cy: number};
  const edge = (a: Box, b: Box) => {
   const dx = b.cx - a.cx, dy = b.cy - a.cy, clip = (s: Box, sign: number) => { const k = Math.max(Math.abs(dx) / (s.w / 2), Math.abs(dy) / (s.h / 2)) || 1; return [s.cx + sign * dx / k, s.cy + sign * dy / k] as const; };
   return [clip(a, 1), clip(b, -1)];
  };
  for (const f of d.flows) {
   const from = shape(steps.get(f.from)!), start: Box = f.on === 'deadline' ? {w: 36, h: 36, cx: from.cx, cy: from.cy + from.h / 2} : from;
   add(3, `<bpmndi:BPMNEdge id="Flow_${f.id}_di" bpmnElement="Flow_${f.id}">`);
   for (const [x, y] of edge(start, shape(steps.get(f.to)!))) add(4, `<di:waypoint x="${Math.round(x * 10) / 10}" y="${Math.round(y * 10) / 10}"/>`);
   add(3, '</bpmndi:BPMNEdge>');
  }
  add(2, '</bpmndi:BPMNPlane>'); add(1, '</bpmndi:BPMNDiagram>');
  if (bpsim) {
   if (!root.LWProcessBpmnBpsimWrite) throw Error('The BPSim writer is not loaded.');
   add(1, '<bpmn:relationship type="BPSimData">'); add(2, '<bpmn:extensionElements>');
   root.LWProcessBpmnBpsimWrite.write(d, {node: nodeId, flow: f => 'Flow_' + f.id, resource: r => 'Resource_' + r.id, process: pid}, (depth, line) => add(depth + 2, line));
   add(2, '</bpmn:extensionElements>'); add(2, `<bpmn:source>${pid}</bpmn:source>`); add(2, `<bpmn:target>${pid}</bpmn:target>`); add(1, '</bpmn:relationship>');
  }
  add(0, '</bpmn:definitions>');
  return out.join('\n') + '\n';
 }
 root.LWProcessBpmnExport = {export: exportBpmn, vocabulary: {MODEL, DI, DC, WL, BPSIM, UNIT, OPS: root.LWProcessBpmnExpr.OPS, COLORS}};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessBpmnExport;
})(globalThis);
