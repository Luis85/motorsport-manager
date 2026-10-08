/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-xml.ts" />
/** BPMN 2.0 interchange for the supported process subset. Wildlands-only values travel in a namespaced extension, so export then import is lossless. */
declare namespace LWProcessBpmn {
 interface ImportResult {ok: boolean; acceptable: boolean; definition: LWProcess.Definition | undefined; diagnostics: LWProcess.Diagnostic[]; warnings: string[];}
 interface Api {export(definition: unknown): string; import(xml: string, options?: {defaultDuration?: number}): ImportResult;}
 /** Shared vocabulary of the export/import halves. */
 interface Vocabulary {MODEL: string; DI: string; DC: string; WL: string; UNIT: number; OPS: Record<string, string>; COLORS: Record<string, string>;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessXml: LWProcessXml.Api; LWProcessCatalog: LWProcess.Catalog; LWProcessBpmnExport?: {export(definition: unknown): string; vocabulary: LWProcessBpmn.Vocabulary}};
 const MODEL = 'http://www.omg.org/spec/BPMN/20100524/MODEL', DI = 'http://www.omg.org/spec/BPMN/20100524/DI', DC = 'http://www.omg.org/spec/DD/20100524/DC', DIAG = 'http://www.omg.org/spec/DD/20100524/DI';
 const WL = 'urn:wildlands:process:1', UNIT = 10, SIZE: Record<string, [number, number]> = {event: [36, 36], gateway: [50, 50], task: [100, 80]};
 const COLORS: Record<string, string> = {start: '#77b5a0', end: '#77b5a0', task: '#ffbb73', timer: '#ffbb73', decision: '#d6a2ce', fork: '#91b9d5', join: '#91b9d5'};
 const OPS: Record<string, string> = {'==': 'eq', eq: 'eq', '!=': 'ne', ne: 'ne', '>': 'gt', gt: 'gt', '>=': 'gte', ge: 'gte', gte: 'gte', '<': 'lt', lt: 'lt', '<=': 'lte', le: 'lte', lte: 'lte'};
 const SYMBOLS: Record<string, string> = {eq: '==', ne: '!=', gt: '>', gte: '>=', lt: '<', lte: '<='};
 const xml = () => root.LWProcessXml, esc = (v: unknown) => xml().escape(v);

 // ---------------------------------------------------------------- export
 /** Right-hand side of a flow condition: quoted text, a JSON literal, or a bare field name. A field named like a literal gets no expression (the extension still carries it), so a bare word is never ambiguous. */
 const conditionOperand = (c: LWProcess.Condition): string | undefined => c.valueField !== undefined ? (['true', 'false', 'null'].includes(c.valueField) ? undefined : c.valueField)
  : typeof c.value === 'string' ? "'" + esc(c.value.replaceAll("'", '')) + "'" : esc(JSON.stringify(c.value));
 /** Standard timer shape: duration is `PT{n}M`; an absolute business minute is a `timeDate` on a synthetic 1970-01-01T00:00Z epoch (the exact minute is in the Wildlands extension). */
 /** Calendar text for business minute `m` counted from 1970-01-01T00:00Z (pure integer arithmetic, no clock). */
 function epochInstant(m: number): string {
  const z = Math.floor(m / 1440) + 719468, era = Math.floor(z / 146097), doe = z - era * 146097, yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100)), mp = Math.floor((5 * doy + 2) / 153), day = doy - Math.floor((153 * mp + 2) / 5) + 1, month = mp < 10 ? mp + 3 : mp - 9, year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  const two = (n: number) => String(n).padStart(2, '0'), inDay = m % 1440;
  return `${year}-${two(month)}-${two(day)}T${two(Math.floor(inDay / 60))}:${two(inDay % 60)}:00Z`;
 }
 function timerDefinition(s: LWProcess.Step, add: (depth: number, line: string) => void): void {
  add(3, '<bpmn:timerEventDefinition>');
  if (s.until === undefined) add(4, `<bpmn:timeDuration xsi:type="bpmn:tFormalExpression">PT${s.duration}M</bpmn:timeDuration>`);
  else add(4, `<bpmn:timeDate xsi:type="bpmn:tFormalExpression">${epochInstant(s.until)}</bpmn:timeDate>`);
  add(3, '</bpmn:timerEventDefinition>');
 }
 /** Work steps run like tasks: task, machine and system. */
 const isWork = (s: LWProcess.Step) => s.kind === 'task' || s.kind === 'machine' || s.kind === 'system';
 const scalar = (name: string, v: LWProcess.Scalar) => `${name}type="${v === null ? 'null' : typeof v}" ${name}value="${esc(v === null ? '' : v)}"`.replace(/^ /, '');
 const attrs = (o: Record<string, unknown>) => Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
 const distAttrs = (x: LWProcess.Dist) => attrs({dist: x.dist, min: x.min, mode: x.mode, max: x.max, mean: x.mean});
 /** Random case fields as `<wl:draw>`; true/false results and choice values keep their exact scalar type. */
 function drawLines(draws: LWProcess.Draw[], depth: number, add: (depth: number, line: string) => void): void {
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
 function exportBpmn(input: unknown): string {
  const d = root.LWProcessCatalog.validate(input, true).definition;
  if (!d) throw Error('Only a structurally valid process definition can be exported.');
  const steps = new Map(d.steps.map(s => [s.id, s])), xs = d.steps.map(s => s.scene.position[0]), ys = d.steps.map(s => s.scene.position[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys), pid = 'Process_' + d.id;
  const nodeId = (s: LWProcess.Step) => (s.kind === 'start' ? 'StartEvent_' : s.kind === 'end' ? 'EndEvent_' : s.kind === 'timer' ? 'Event_' : isWork(s) ? 'Activity_' : 'Gateway_') + s.id;
  const out: string[] = [], add = (depth: number, line: string) => out.push(' '.repeat(depth * 2) + line);
  add(0, '<?xml version="1.0" encoding="UTF-8"?>');
  add(0, `<bpmn:definitions xmlns:bpmn="${MODEL}" xmlns:bpmndi="${DI}" xmlns:dc="${DC}" xmlns:di="${DIAG}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:wl="${WL}"` +
   attrs({id: 'Definitions_' + d.id, name: d.name, targetNamespace: 'urn:wildlands:process:' + d.id, exporter: 'Wildlands Process Studio', exporterVersion: '1'}) + '>');
  for (const r of d.resources) {
   add(1, `<bpmn:resource id="Resource_${r.id}" name="${esc(r.name)}">`); add(2, '<bpmn:extensionElements>');
   add(3, `<wl:resource id="${r.id}" capacity="${r.capacity}" costPerMinute="${r.costPerMinute}"${r.kind ? ` kind="${r.kind}"` : ''}/>`); add(2, '</bpmn:extensionElements>'); add(1, '</bpmn:resource>');
  }
  add(1, `<bpmn:process id="${pid}" name="${esc(d.name)}" isExecutable="false">`);
  if (d.description) add(2, `<bpmn:documentation>${esc(d.description)}</bpmn:documentation>`);
  add(2, '<bpmn:extensionElements>'); add(3, `<wl:process id="${d.id}" revision="${d.revision}"${d.$schema ? ` schema="${esc(d.$schema)}"` : ''}${d.seed !== undefined ? ` seed="${d.seed}"` : ''}/>`);
  for (const a of d.arrivals) {
   const inner = Object.keys(a.data).length > 0 || a.gap !== undefined || (a.draws?.length ?? 0) > 0;
   add(3, `<wl:arrival${attrs({at: a.at, count: a.count, until: a.until, open: a.open === undefined ? undefined : 'true', interval: a.interval})}${inner ? '>' : '/>'}`);
   if (inner) {
    if (a.gap) add(4, `<wl:gap${distAttrs(a.gap)}/>`);
    drawLines(a.draws ?? [], 4, add);
    for (const [k, v] of Object.entries(a.data)) add(4, `<wl:data name="${k}" ${scalar('', v)}/>`);
    add(3, '</wl:arrival>');
   }
  }
  add(2, '</bpmn:extensionElements>');
  for (const s of d.steps) {
   const element = s.kind === 'start' ? 'startEvent' : s.kind === 'end' ? 'endEvent' : s.kind === 'system' ? 'serviceTask' : isWork(s) ? 'task' : s.kind === 'timer' ? 'intermediateCatchEvent' : s.kind === 'decision' ? 'exclusiveGateway' : 'parallelGateway';
   const incoming = d.flows.filter(f => f.to === s.id), outgoing = d.flows.filter(f => f.from === s.id), fallback = s.kind === 'decision' ? outgoing.find(f => !f.when) : undefined;
   const gateway = isWork(s) || s.kind === 'timer' || s.kind === 'start' || s.kind === 'end' ? {} : {gatewayDirection: s.kind === 'join' ? 'Converging' : 'Diverging'};
   add(2, `<bpmn:${element}${attrs({id: nodeId(s), name: s.name, default: fallback ? 'Flow_' + fallback.id : undefined, ...gateway})}>`);
   if (s.description) add(3, `<bpmn:documentation>${esc(s.description)}</bpmn:documentation>`);
   add(3, '<bpmn:extensionElements>');
   add(4, `<wl:step id="${s.id}"${attrs({kind: s.kind === 'machine' || s.kind === 'system' ? s.kind : undefined, duration: s.duration, until: s.until, cost: s.cost, join: s.join, technology: s.technology})}/>`);
   if (s.timing) add(4, `<wl:timing${distAttrs(s.timing)}/>`);
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
    add(3, `<bpmn:performer id="Performer_${s.id}_${id}" name="${esc(d.resources.find(r => r.id === id)?.name ?? id)}">`);
    add(4, '<bpmn:extensionElements>'); add(5, `<wl:demand quantity="${quantity}"/>`); add(4, '</bpmn:extensionElements>');
    add(4, `<bpmn:resourceRef>Resource_${id}</bpmn:resourceRef>`); add(3, '</bpmn:performer>');
   }
   add(2, `</bpmn:${element}>`);
  }
  for (const f of d.flows) {
   add(2, `<bpmn:sequenceFlow id="Flow_${f.id}"${attrs({name: f.label, sourceRef: nodeId(steps.get(f.from)!), targetRef: nodeId(steps.get(f.to)!)})}>`);
   add(3, '<bpmn:extensionElements>'); add(4, `<wl:flow id="${f.id}"/>`);
   const when = f.when, chance = when?.chance, field = when && when.chance === undefined ? when : undefined;
   if (chance !== undefined) add(4, `<wl:when chance="${chance}"/>`);
   else if (field) add(4, `<wl:when field="${field.field}" op="${field.op}" ${field.valueField === undefined ? scalar('', field.value) : `valueField="${field.valueField}"`}/>`);
   add(3, '</bpmn:extensionElements>');
   // A chance has no standard expression syntax; it uses the BPMN `language` attribute with a Wildlands language URI and the plain text `15%`.
   if (chance !== undefined) add(3, `<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="${WL}#chance">${chance}%</bpmn:conditionExpression>`);
   const operand = field && conditionOperand(field);
   if (field && operand !== undefined) add(3, `<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">\${${field.field} ${esc(SYMBOLS[field.op])} ${operand}}</bpmn:conditionExpression>`);
   add(2, '</bpmn:sequenceFlow>');
  }
  add(1, '</bpmn:process>');
  const shape = (s: LWProcess.Step) => { const [w, h] = SIZE[isWork(s) ? 'task' : s.kind === 'start' || s.kind === 'end' || s.kind === 'timer' ? 'event' : 'gateway']!; return {w, h, cx: 150 + (s.scene.position[0] - minX) * UNIT, cy: 120 + (s.scene.position[1] - minY) * UNIT}; };
  add(1, '<bpmndi:BPMNDiagram id="Diagram_1">'); add(2, `<bpmndi:BPMNPlane id="Plane_1" bpmnElement="${pid}">`);
  for (const s of d.steps) {
   const b = shape(s); add(3, `<bpmndi:BPMNShape id="${nodeId(s)}_di" bpmnElement="${nodeId(s)}"${s.kind === 'decision' ? ' isMarkerVisible="true"' : ''}>`);
   add(4, `<dc:Bounds x="${b.cx - b.w / 2}" y="${b.cy - b.h / 2}" width="${b.w}" height="${b.h}"/>`); add(3, '</bpmndi:BPMNShape>');
  }
  const edge = (from: LWProcess.Step, to: LWProcess.Step) => {
   const a = shape(from), b = shape(to), dx = b.cx - a.cx, dy = b.cy - a.cy, clip = (s: typeof a, sign: number) => { const k = Math.max(Math.abs(dx) / (s.w / 2), Math.abs(dy) / (s.h / 2)) || 1; return [s.cx + sign * dx / k, s.cy + sign * dy / k] as const; };
   return [clip(a, 1), clip(b, -1)];
  };
  for (const f of d.flows) {
   add(3, `<bpmndi:BPMNEdge id="Flow_${f.id}_di" bpmnElement="Flow_${f.id}">`);
   for (const [x, y] of edge(steps.get(f.from)!, steps.get(f.to)!)) add(4, `<di:waypoint x="${Math.round(x * 10) / 10}" y="${Math.round(y * 10) / 10}"/>`);
   add(3, '</bpmndi:BPMNEdge>');
  }
  add(2, '</bpmndi:BPMNPlane>'); add(1, '</bpmndi:BPMNDiagram>'); add(0, '</bpmn:definitions>');
  return out.join('\n') + '\n';
 }
 root.LWProcessBpmnExport = {export: exportBpmn, vocabulary: {MODEL, DI, DC, WL, UNIT, OPS, COLORS}};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessBpmnExport;
})(globalThis);
