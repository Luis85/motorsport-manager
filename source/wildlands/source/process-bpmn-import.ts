/// <reference path="./process-bpmn.ts" />
/** BPMN 2.0 import: start/end events, duration timer events, task variants, exclusive and parallel gateways, sequence flows and resources. Everything else is reported, never guessed. */
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessXml: LWProcessXml.Api; LWProcessCatalog: LWProcess.Catalog; LWProcessBpmnExport: {export(d: unknown): string; vocabulary: LWProcessBpmn.Vocabulary}; LWProcessBpmn?: LWProcessBpmn.Api};
 const {MODEL, DI, DC, WL, UNIT, OPS, COLORS} = root.LWProcessBpmnExport.vocabulary;
 type X = LWProcessXml.Node;
 const TASKS = new Set(['task', 'userTask', 'manualTask', 'businessRuleTask', 'serviceTask', 'scriptTask', 'sendTask', 'receiveTask']);
 const UNSUPPORTED = new Set(['subProcess', 'transaction', 'adHocSubProcess', 'callActivity', 'intermediateThrowEvent', 'boundaryEvent', 'inclusiveGateway', 'eventBasedGateway', 'complexGateway']);
 const IGNORED = new Set(['documentation', 'extensionElements', 'laneSet', 'textAnnotation', 'association', 'group', 'dataObject', 'dataObjectReference', 'dataStoreReference', 'property', 'ioSpecification', 'category']);
 const PERFORMERS = new Set(['performer', 'humanPerformer', 'potentialOwner', 'resourceRole']);
 const kids = (n: X, local: string, ns = MODEL) => n.children.filter(c => c.local === local && c.ns === ns);
 const documentation = (n: X) => kids(n, 'documentation').map(d => d.text.trim()).filter(Boolean).join('\n\n') || undefined;
 const extensions = (n: X, local: string) => kids(n, 'extensionElements').flatMap(e => e.children.filter(c => c.ns === WL && c.local === local));
 const first = (n: X, local: string) => extensions(n, local)[0];
 const typed = (a: Record<string, string>): LWProcess.Scalar => {
  const v = a.value ?? '', t = a.type ?? 'string';
  if (t === 'null') return null; if (t === 'boolean') return v === 'true'; if (t === 'number') { const n = Number(v); if (!Number.isFinite(n)) throw Error('Invalid number: ' + v); return n; } return v;
 };
 const sanitize = (raw: string, taken: Set<string>, fallback: string): string => {
  let id = raw.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60); if (!/^[a-z]/.test(id)) id = (fallback + '-' + id).replace(/-$/, '');
  let candidate = id, n = 2; while (taken.has(candidate)) candidate = id + '-' + n++;
  taken.add(candidate); return candidate;
 };
 interface Flow {xml: string; from: string; to: string; label?: string | undefined; when?: LWProcess.Condition | LWProcess.ChanceCondition | undefined; expression?: string | undefined; orig?: string | undefined; node: X;}
 interface Item {xml: string; kind: LWProcess.Kind; node: X; local: string; id: string; collapsed?: boolean; timer?: {duration?: number; until?: number} | undefined;}
 function condition(expression: string, where: string): LWProcess.Condition {
  const m = /^\s*(?:[$#]\{)?\s*([A-Za-z_]\w*)\s*(==|!=|>=|<=|>|<|eq|ne|gte|gt|ge|lte|lt|le)\s*(-?\d+(?:\.\d+)?|'[^']*'|"[^"]*"|[A-Za-z_]\w*)\s*\}?\s*$/.exec(expression);
  if (!m || !/^[a-z][a-zA-Z0-9_]{0,63}$/.test(m[1]!)) throw Error(where + ': unsupported condition "' + expression.trim() + '". Use field == value comparisons.');
  const raw = m[3]!, op = OPS[m[2]!] as LWProcess.Condition['op'];
  // A bare word that is not true/false/null names another case field; text values are always quoted.
  if (/^[A-Za-z_]/.test(raw) && !['true', 'false', 'null'].includes(raw)) {
   if (!/^[a-z][a-zA-Z0-9_]{0,63}$/.test(raw)) throw Error(where + ': unsupported condition "' + expression.trim() + '". Compare to a quoted text, a number, true, false, null or a field name.');
   return {field: m[1]!, op, valueField: raw} as unknown as LWProcess.Condition;
  }
  const value = raw === 'true' ? true : raw === 'false' ? false : raw === 'null' ? null : /^-?\d/.test(raw) ? Number(raw) : raw.slice(1, -1);
  return {field: m[1]!, op, value};
 }
 const WHOLE = /^-?\d+$/;
 const whole = (a: Record<string, string>, name: string, where: string): number | undefined => {
  const v = a[name]; if (v === undefined) return undefined;
  if (!WHOLE.test(v)) throw Error(where + ': ' + name + ' "' + v + '" must be a whole number.');
  return Number(v);
 };
 const onlyAttrs = (n: X, allowed: string[], where: string) => { for (const k of Object.keys(n.attrs)) if (!allowed.includes(k)) throw Error(where + ': unknown attribute ' + k + '.'); };
 const DISTS = ['uniform', 'triangular', 'exponential'], DRAW_KINDS = ['chance', 'choice', 'int'];
 /** Reads `<wl:timing>` or `<wl:gap>`; the engine validator judges ranges, this judges shape. */
 function distOf(n: X, where: string): LWProcess.Dist {
  onlyAttrs(n, ['dist', 'min', 'mode', 'max', 'mean'], where);
  if (!DISTS.includes(n.attrs.dist ?? '')) throw Error(where + ': dist "' + (n.attrs.dist ?? '') + '" must be uniform, triangular or exponential.');
  const out: LWProcess.Dist = {dist: n.attrs.dist as LWProcess.Dist['dist']};
  for (const k of ['min', 'mode', 'max', 'mean'] as const) { const v = whole(n.attrs, k, where); if (v !== undefined) out[k] = v; }
  return out;
 }
 const single = (nodes: X[], what: string, where: string): X | undefined => { if (nodes.length > 1) throw Error(where + ': ' + nodes.length + ' ' + what + ' elements; at most one is allowed.'); return nodes[0]; };
 function drawsOf(nodes: X[], where: string): LWProcess.Draw[] {
  return nodes.map((n, i) => {
   const here = where + ' draw ' + (i + 1); onlyAttrs(n, ['field', 'kind', 'percent', 'min', 'max'], here);
   const kind = n.attrs.kind ?? ''; if (!DRAW_KINDS.includes(kind)) throw Error(here + ': kind "' + kind + '" must be chance, choice or int.');
   if (n.attrs.field === undefined) throw Error(here + ': field is required.');
   const draw: LWProcess.Draw = {field: n.attrs.field, kind: kind as LWProcess.Draw['kind']};
   for (const k of ['percent', 'min', 'max'] as const) { const v = whole(n.attrs, k, here); if (v !== undefined) draw[k] = v; }
   for (const c of n.children) if (c.ns !== WL || !['whenTrue', 'whenFalse', 'choice'].includes(c.local)) throw Error(here + ': unknown element ' + c.local + '.');
   for (const t of ['whenTrue', 'whenFalse'] as const) { const c = single(n.children.filter(x => x.local === t), t, here); if (c) draw[t] = typed(c.attrs); }
   const values = n.children.filter(c => c.local === 'choice');
   if (values.length) draw.values = values.map(c => { onlyAttrs(c, ['type', 'value', 'weight'], here + ' choice'); const w = whole(c.attrs, 'weight', here + ' choice'); if (w === undefined) throw Error(here + ': choice needs a weight.'); return {value: typed(c.attrs), weight: w}; });
   return draw;
  });
 }
 /** Chance route from the extension, from the `${WL}#chance` expression, or both (which must agree). A chance never combines with a field comparison. */
 function chanceOf(ext: X | undefined, expression: X | undefined, where: string): LWProcess.ChanceCondition | undefined {
  const isChance = expression?.attrs.language === WL + '#chance', text = expression?.text.trim() ?? '';
  if (ext?.attrs.chance === undefined && !isChance) return undefined;
  if (ext && ext.attrs.chance !== undefined) onlyAttrs(ext, ['chance'], where + ' chance');
  if (expression && !isChance && text) throw Error(where + ': a chance route cannot also carry the field condition "' + text + '".');
  const fromExt = ext ? whole(ext.attrs, 'chance', where) : undefined;
  let fromText: number | undefined;
  if (isChance) { const m = /^(\d{1,3})%$/.exec(text); if (!m) throw Error(where + ': chance expression "' + text + '" must be a whole percent such as 15%.'); fromText = Number(m[1]); }
  if (fromExt !== undefined && fromText !== undefined && fromExt !== fromText) throw Error(where + ': chance extension ' + fromExt + ' disagrees with expression ' + fromText + '%.');
  return {chance: (fromExt ?? fromText)!};
 }
 /** Reads the single timer definition of an intermediate catch event: `PT{n}M` or `PT{n}H` durations only; the Wildlands extension restores exact values. */
 function timerOf(node: X, xmlId: string, errors: string[]): Item['timer'] {
  const defs = node.children.filter(c => c.ns === MODEL && c.local.endsWith('EventDefinition')), ext = first(node, 'step');
  if (defs.length !== 1 || defs[0]!.local !== 'timerEventDefinition') { errors.push('intermediateCatchEvent ' + xmlId + ' is not supported unless it has exactly one timerEventDefinition; ' + (defs.map(d => d.local).join(', ') || 'no event definition') + ' found.'); return undefined; }
  const forms = defs[0]!.children.filter(c => c.ns === MODEL), form = forms[0];
  const fail = (why: string) => { errors.push('Timer ' + xmlId + ' is not supported: ' + why); return undefined; };
  if (ext?.attrs.until !== undefined) return {until: Number(ext.attrs.until)};
  if (forms.length !== 1) return fail('define exactly one timeDuration.');
  if (form!.local !== 'timeDuration') return fail(form!.local + ' has no business-minute meaning; use timeDuration PT{n}M or PT{n}H.');
  const m = /^PT(\d+)([MH])$/.exec(form!.text.trim()), minutes = m ? Number(m[1]) * (m[2] === 'H' ? 60 : 1) : 0;
  if (!m || minutes < 1) return fail('duration "' + form!.text.trim() + '" must be PT{n}M or PT{n}H with n of at least 1.');
  return {duration: ext?.attrs.duration !== undefined ? Number(ext.attrs.duration) : minutes};
 }
 function importBpmn(source: string, options: {defaultDuration?: number} = {}): LWProcessBpmn.ImportResult {
  const warnings: string[] = [], errors: string[] = [], warn = (m: string) => { if (!warnings.includes(m)) warnings.push(m); };
  const doc = root.LWProcessXml.parse(source);
  if (doc.ns !== MODEL || doc.local !== 'definitions') throw Error('Expected a BPMN 2.0 definitions document.');
  const processes = kids(doc, 'process'); if (processes.length !== 1) throw Error('Import needs exactly one process; this file has ' + processes.length + '.');
  const proc = processes[0]!;
  // ------------------------------------------------------------ resources
  const taken = {steps: new Set<string>(), flows: new Set<string>(), resources: new Set<string>()}, resources = new Map<string, LWProcess.Resource>();
  for (const r of kids(doc, 'resource')) {
   const ext = first(r, 'resource'), xmlId = r.attrs.id ?? ''; if (!xmlId) continue;
   const id = ext?.attrs.id ?? sanitize(xmlId, taken.resources, 'resource'); taken.resources.add(id);
   resources.set(xmlId, {id, name: (r.attrs.name || id).slice(0, 120), capacity: Number(ext?.attrs.capacity ?? 1), costPerMinute: Number(ext?.attrs.costPerMinute ?? 0), ...ext?.attrs.kind !== undefined ? {kind: ext.attrs.kind as LWProcess.ResourceKind} : {}});
   if (!ext) warn('Resources have capacity 1 and no cost unless set in Wildlands.');
  }
  // ------------------------------------------------------------ nodes
  const items: Item[] = [], names = new Map<string, Item>();
  for (const child of proc.children) {
   if (child.ns !== MODEL) { warn('Ignored non-BPMN element ' + child.local + '.'); continue; }
   const local = child.local, xmlId = child.attrs.id;
   if (UNSUPPORTED.has(local)) { errors.push(local + (xmlId ? ' ' + xmlId : '') + ' is not supported; model it with tasks, exclusive gateways and parallel gateways.'); continue; }
   const kind: LWProcess.Kind | undefined = local === 'startEvent' ? 'start' : local === 'endEvent' ? 'end' : TASKS.has(local) ? 'task' : local === 'intermediateCatchEvent' ? 'timer' : local === 'exclusiveGateway' ? 'decision' : local === 'parallelGateway' ? 'fork' : undefined;
   if (!kind) { if (local !== 'sequenceFlow' && !IGNORED.has(local)) warn('Ignored element ' + local + '.'); continue; }
   if (!xmlId) { errors.push(local + ' needs an id.'); continue; }
   if (['startEvent', 'endEvent'].includes(local) && child.children.some(c => c.ns === MODEL && c.local.endsWith('EventDefinition'))) warn('Event definitions on ' + xmlId + ' are ignored; it is a plain event.');
   const automated = TASKS.has(local) && first(child, 'step')?.attrs.kind !== undefined;
   if (!automated && ['serviceTask', 'scriptTask', 'sendTask', 'receiveTask', 'businessRuleTask'].includes(local)) warn(local + ' ' + xmlId + ' imports as a timed task; no behaviour is executed.');
   const stepExt = first(child, 'step'), item: Item = {xml: xmlId, kind, node: child, local, id: stepExt?.attrs.id ?? sanitize(xmlId, taken.steps, kind)};
   if (stepExt?.attrs.id) { if (taken.steps.has(item.id)) errors.push('Duplicate Wildlands step id ' + item.id + '.'); taken.steps.add(item.id); }
   if (kind === 'timer') item.timer = timerOf(child, xmlId, errors);
   if (names.has(xmlId)) errors.push('Duplicate BPMN id ' + xmlId + '.'); names.set(xmlId, item); items.push(item);
  }
  let flows: Flow[] = kids(proc, 'sequenceFlow').map(f => {
   const ext = first(f, 'flow'), when = first(f, 'when'), exprNodes = kids(f, 'conditionExpression'), exprNode = exprNodes[0], expression = exprNode?.text, chance = (() => { if (exprNodes.length > 1) throw Error('Flow ' + (f.attrs.id ?? '') + ' has ' + exprNodes.length + ' conditionExpression elements; at most one is allowed.'); return chanceOf(when, exprNode, 'Flow ' + (f.attrs.id ?? '')); })();
   return {xml: f.attrs.id ?? '', from: f.attrs.sourceRef ?? '', to: f.attrs.targetRef ?? '', label: f.attrs.name || undefined, expression, orig: ext?.attrs.id, node: f,
    when: chance ?? (when ? (when.attrs.valueField !== undefined ? {field: when.attrs.field!, op: when.attrs.op, valueField: when.attrs.valueField} as unknown as LWProcess.Condition : {field: when.attrs.field!, op: when.attrs.op as LWProcess.Condition['op'], value: typed(when.attrs)}) : undefined)};
  });
  for (const f of flows) if (!f.xml || !names.has(f.from) || !names.has(f.to)) errors.push('Sequence flow ' + (f.xml || '(no id)') + ' must connect two supported nodes.');
  for (const f of flows) if (f.when?.chance !== undefined && names.get(f.from)!.local !== 'exclusiveGateway') errors.push('Flow ' + f.xml + ' is a chance route but leaves ' + f.from + ', which is not an exclusive gateway.');
  if (errors.length) throw Error(errors.join('\n'));
  // Exclusive gateways that merge (or only pass through) have no Wildlands step: re-point their inflows at the single continuation.
  const outOf = (id: string) => flows.filter(f => f.from === id), into = (id: string) => flows.filter(f => f.to === id);
  const passThrough = (i: Item) => (i.local === 'exclusiveGateway' || i.local === 'parallelGateway' && into(i.xml).length < 2 && outOf(i.xml).length < 2) && outOf(i.xml).length === 1 && !i.collapsed;
  for (let progress = true; progress;) {
   progress = false;
   for (const g of items.filter(passThrough)) {
    const o = outOf(g.xml)[0]!; if (o.to === g.xml) throw Error('Gateway ' + g.xml + ' loops onto itself.');
    for (const f of into(g.xml)) f.to = o.to;
    flows = flows.filter(f => f !== o); g.collapsed = true; progress = true; warn('Merge or pass-through gateway ' + g.xml + ' was folded into its flows; Wildlands steps accept several incoming flows.');
   }
  }
  const live = items.filter(i => !i.collapsed), flowIds = new Map<Flow, string>();
  for (const f of flows) { const id = f.orig ?? sanitize(f.xml, taken.flows, 'flow'); if (f.orig) taken.flows.add(id); flowIds.set(f, id); }
  // ------------------------------------------------------------ gateway roles
  for (const g of live.filter(i => i.local === 'parallelGateway')) {
   const nIn = into(g.xml).length, nOut = outOf(g.xml).length;
   if (nIn === 1 && nOut >= 2) g.kind = 'fork'; else if (nIn >= 2 && nOut === 1) g.kind = 'join'; else errors.push('Parallel gateway ' + g.xml + ' must split (1 in, 2+ out) or join (2+ in, 1 out).');
  }
  for (const i of live) {
   const n = outOf(i.xml).length;
   if (i.kind === 'timer' && n > 1) errors.push('Timer ' + i.xml + ' has ' + n + ' outgoing flows; use a parallel gateway to split work.');
   if (i.kind === 'task' && n > 1) errors.push('Task ' + i.xml + ' has ' + n + ' outgoing flows; use a parallel gateway to split work.');
   if (i.kind === 'start' && n !== 1) errors.push('The start event must have exactly one outgoing flow.');
   if (i.kind === 'decision' && n < 2) errors.push('Exclusive gateway ' + i.xml + ' needs two or more outgoing flows.');
  }
  if (live.filter(i => i.kind === 'start').length !== 1) errors.push('Exactly one start event is required.');
  if (errors.length) throw Error(errors.join('\n'));
  const joins = new Map<string, string>();
  for (const fork of live.filter(i => i.kind === 'fork')) {
   const declared = first(fork.node, 'step')?.attrs.join;
   if (declared) { const target = live.find(j => j.kind === 'join' && (j.id === declared)); if (!target) throw Error('Fork ' + fork.xml + ' names unknown join ' + declared + '.'); joins.set(fork.xml, target.xml); continue; }
   const ends = new Set<string>();
   for (const flow of outOf(fork.xml)) {
    let at = names.get(flow.to)!; const seen = new Set<string>();
    while ((at.kind === 'task' || at.kind === 'timer') && !seen.has(at.xml)) { seen.add(at.xml); at = names.get(outOf(at.xml)[0]?.to ?? '') ?? at; if (!outOf(at.xml).length) break; }
    ends.add(at.kind === 'join' ? at.xml : '?');
   }
   if (ends.size !== 1 || ends.has('?')) throw Error('Parallel branches of ' + fork.xml + ' must be task chains meeting at one parallel join.');
   joins.set(fork.xml, [...ends][0]!);
  }
  // ------------------------------------------------------------ layout
  const centers = new Map<string, [number, number]>();
  for (const shape of doc.children.filter(c => c.local === 'BPMNDiagram').flatMap(d => d.children.flatMap(p => p.children.filter(s => s.local === 'BPMNShape' && s.ns === DI)))) {
   const b = shape.children.find(c => c.local === 'Bounds' && c.ns === DC); if (b && shape.attrs.bpmnElement) centers.set(shape.attrs.bpmnElement, [Number(b.attrs.x) + Number(b.attrs.width) / 2, Number(b.attrs.y) + Number(b.attrs.height) / 2]);
  }
  const placed = new Map<string, [number, number]>();
  if (live.every(i => first(i.node, 'scene'))) live.forEach(i => { const s = first(i.node, 'scene')!; placed.set(i.xml, [Number(s.attrs.x), Number(s.attrs.y)]); });
  else if (live.every(i => centers.has(i.xml))) {
   const minX = Math.min(...live.map(i => centers.get(i.xml)![0])), minY = Math.min(...live.map(i => centers.get(i.xml)![1]));
   live.forEach(i => placed.set(i.xml, [Math.round((centers.get(i.xml)![0] - minX) / UNIT * 10) / 10, Math.round((centers.get(i.xml)![1] - minY) / UNIT * 10) / 10]));
  } else {
   warn('The file has no complete diagram layout; scenes were arranged automatically.');
   const depth = new Map<string, number>([[live.find(i => i.kind === 'start')!.xml, 0]]), queue = [...depth.keys()], rows = new Map<number, number>();
   while (queue.length) { const id = queue.shift()!; for (const f of outOf(id)) if (!depth.has(f.to)) { depth.set(f.to, depth.get(id)! + 1); queue.push(f.to); } }
   for (const i of live) { const x = depth.get(i.xml) ?? 0, row = rows.get(x) ?? 0; rows.set(x, row + 1); placed.set(i.xml, [x * 14, row * 12]); }
  }
  // ------------------------------------------------------------ definition
  const defaultDuration = options.defaultDuration ?? 5; let defaulted = 0;
  const steps: LWProcess.Step[] = live.map(i => {
   const ext = first(i.node, 'step'), scene = first(i.node, 'scene'), [x, y] = placed.get(i.xml)!, asset = scene && extensions(i.node, 'scene')[0]?.children.find(c => c.local === 'asset');
   const step: LWProcess.Step = {id: i.id, name: (i.node.attrs.name || i.xml).slice(0, 120), kind: i.kind,
    scene: {id: scene?.attrs.id ?? 'scene-' + i.id, position: [x, y], color: scene?.attrs.color ?? COLORS[i.kind]!, ...asset ? {asset: JSON.parse(asset.text) as object} : {}}};
   const description = documentation(i.node); if (description) step.description = description;
   if (i.kind === 'task') {
    if (ext?.attrs.duration) step.duration = Number(ext.attrs.duration); else { step.duration = defaultDuration; defaulted++; }
    const demand: Record<string, number> = {};
    for (const p of i.node.children.filter(c => c.ns === MODEL && PERFORMERS.has(c.local))) {
     const ref = kids(p, 'resourceRef')[0]?.text.trim(), r = resources.get(ref?.includes(':') ? ref.split(':').at(-1)! : ref ?? '');
     if (!r) throw Error('Task ' + i.xml + ' references an unknown resource ' + (ref ?? '(none)') + '.');
     demand[r.id] = Number(first(p, 'demand')?.attrs.quantity ?? 1) + (demand[r.id] ?? 0);
    }
    if (Object.keys(demand).length) step.resources = demand;
   }
   if (i.timer?.duration !== undefined) step.duration = i.timer.duration;
   if (i.timer?.until !== undefined) step.until = i.timer.until;
   if (ext?.attrs.cost) step.cost = Number(ext.attrs.cost);
   const set = extensions(i.node, 'set'); if (set.length) step.set = Object.fromEntries(set.map(s => [s.attrs.name!, typed(s.attrs)]));
   const adds = extensions(i.node, 'add'); if (adds.length) step.add = Object.fromEntries(adds.map(a => [a.attrs.name!, Number(a.attrs.delta)]));
   const needs = extensions(i.node, 'need'); if (needs.length) step.needs = needs.map(n => ({field: n.attrs.field!, ...n.attrs.op ? {op: n.attrs.op as LWProcess.Condition['op'], value: typed(n.attrs)} : {}, ...n.attrs.label ? {label: n.attrs.label} : {}}));
   const backlog = first(i.node, 'backlog'); if (backlog) step.backlog = {capacity: Number(backlog.attrs.capacity), ...backlog.attrs.order ? {order: backlog.attrs.order as 'fifo'} : {}, ...backlog.attrs.priority ? {priority: backlog.attrs.priority} : {}, ...backlog.attrs.pull ? {pull: Number(backlog.attrs.pull)} : {}};
   if (i.kind === 'task') {
    // Wildlands extension restores automated steps; the engine's admission rules then judge kind, pools and outputs.
    if (ext?.attrs.kind !== undefined) {
     step.kind = ext.attrs.kind as LWProcess.Kind;
     const expected = ext.attrs.kind === 'system' ? 'serviceTask' : ext.attrs.kind === 'machine' ? 'task' : undefined;
     if (expected && i.local !== expected) warn('Step ' + i.xml + ' is a ' + i.local + ' but its Wildlands extension says ' + ext.attrs.kind + '; the extension wins and admission checks apply.');
    }
    if (ext?.attrs.technology !== undefined) step.technology = ext.attrs.technology;
    const outputs = extensions(i.node, 'output'); if (outputs.length) step.outputs = outputs.map(o => ({field: o.attrs.field!, ...o.attrs.label !== undefined ? {label: o.attrs.label} : {}}));
   }
   const timing = single(extensions(i.node, 'timing'), 'timing', 'Step ' + i.xml); if (timing) step.timing = distOf(timing, 'Step ' + i.xml + ' timing');
   const draws = extensions(i.node, 'draw'); if (draws.length) step.draws = drawsOf(draws, 'Step ' + i.xml);
   if (i.kind === 'fork') step.join = live.find(j => j.xml === joins.get(i.xml))!.id;
   return step;
  });
  if (defaulted) warn(defaulted + ' task(s) had no duration and were given ' + defaultDuration + ' minutes; tune them in the editor.');
  const byXml = new Map(live.map(i => [i.xml, i]));
  const flowList: LWProcess.Flow[] = flows.map(f => ({id: flowIds.get(f)!, from: byXml.get(f.from)!.id, to: byXml.get(f.to)!.id, ...f.label ? {label: f.label.slice(0, 120)} : {}}));
  for (const g of live.filter(i => i.kind === 'decision')) {
   const mine = flows.filter(f => f.from === g.xml);
   const fallback = mine.find(f => f.xml === g.node.attrs.default) ?? (mine.filter(f => !f.when && !f.expression?.trim()).length === 1 ? mine.find(f => !f.when && !f.expression?.trim()) : undefined)
    ?? (() => { if (mine.some(f => !f.when && !f.expression?.trim())) throw Error('Exclusive gateway ' + g.xml + ' has several flows without a condition; mark one as the default flow.'); warn('Gateway ' + g.xml + ' had no default flow; its last flow is the fallback.'); return mine.at(-1)!; })();
   for (const f of mine) if (f !== fallback) {
    const target = flowList[flows.indexOf(f)]!;
    target.when = f.when ?? condition(f.expression ?? '', 'Flow ' + f.xml);
   }
  }
  for (const f of flows) if (f.expression?.trim() && byXml.get(f.from)!.kind !== 'decision') warn('Condition on flow ' + f.xml + ' is ignored; only exclusive gateways branch.');
  const arrivals = extensions(proc, 'arrival').map((a, n): LWProcess.Arrival => {
   const where = 'Arrival ' + (n + 1); onlyAttrs(a, ['at', 'count', 'until', 'open', 'interval'], where);
   for (const c of a.children) if (c.ns !== WL || !['gap', 'draw', 'data'].includes(c.local)) throw Error(where + ': unknown element ' + c.local + '.');
   const count = whole(a.attrs, 'count', where), until = whole(a.attrs, 'until', where), open = a.attrs.open;
   if (open !== undefined && open !== 'true') throw Error(where + ': open "' + open + '" must be true or absent.');
   const rules = [count, until, open].filter(v => v !== undefined).length;
   if (rules !== 1) throw Error(where + ': declare exactly one of count, until or open (found ' + rules + ').');
   const gap = single(a.children.filter(c => c.local === 'gap'), 'gap', where), draws = drawsOf(a.children.filter(c => c.local === 'draw'), where);
   return {at: whole(a.attrs, 'at', where) ?? NaN, ...count !== undefined ? {count} : {}, ...until !== undefined ? {until} : {}, ...open ? {open: true as const} : {}, interval: whole(a.attrs, 'interval', where) ?? NaN,
    ...gap ? {gap: distOf(gap, where + ' gap')} : {}, ...draws.length ? {draws} : {}, data: Object.fromEntries(a.children.filter(c => c.local === 'data').map(c => [c.attrs.name!, typed(c.attrs)]))};
  });
  if (!arrivals.length) { warn('No case arrivals were found; one case arrives at minute 0.'); arrivals.push({at: 0, count: 1, interval: 0, data: {}}); }
  const meta = first(proc, 'process'), idTaken = new Set<string>();
  const definition: LWProcess.Definition = {format: 'wildlands-process', schemaVersion: 1, revision: Number(meta?.attrs.revision ?? 0), id: meta?.attrs.id ?? sanitize(proc.attrs.id ?? 'imported-process', idTaken, 'process'),
   name: (proc.attrs.name || doc.attrs.name || proc.attrs.id || 'Imported process').slice(0, 120), start: live.find(i => i.kind === 'start')!.id,
   resources: [...resources.values()], steps, flows: flowList, arrivals, ...meta?.attrs.schema ? {$schema: meta.attrs.schema} : {}};
  const seed = meta ? whole(meta.attrs, 'seed', 'Process') : undefined; if (seed !== undefined) definition.seed = seed;
  const description = documentation(proc); if (description) definition.description = description;
  const checked = root.LWProcessCatalog.validate(definition, true);
  return {ok: checked.ok, acceptable: checked.acceptable, definition: checked.definition ?? undefined, diagnostics: checked.diagnostics, warnings};
 }
 root.LWProcessBpmn = {export: root.LWProcessBpmnExport.export, import: importBpmn};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessBpmn;
})(globalThis);
