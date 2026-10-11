/// <reference path="./process-bpmn-graph.ts" />
/// <reference path="./process-bpmn-bpsim.ts" />
/** Last stage of the BPMN import: case arrivals (Wildlands extension, else BPSim start timing, else one case), SIPOC from message flows, the definition itself, and the summary warnings and mapping entries of the report. */
declare namespace LWProcessBpmnTail {
 interface Parts {
  steps: LWProcess.Step[]; flows: LWProcess.Flow[]; resources: LWProcess.Resource[]; net: LWProcessBpmnGraph.Net; start: LWProcessBpmnGraph.Item | undefined;
  bp(ref: string): LWProcessBpmnBpsim.Params | undefined; used: Set<string>;
 }
 interface Api {finish(ctx: LWProcessBpmnGraph.Ctx, doc: LWProcessXml.Node, proc: LWProcessXml.Node, collab: LWProcessXml.Node | undefined, participants: LWProcessXml.Node[], p: Parts): LWProcess.Definition;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessCatalog: LWProcess.Catalog; LWProcessBpmnExport: {vocabulary: LWProcessBpmn.Vocabulary}; LWProcessBpmnExt: LWProcessBpmnExt.Api; LWProcessBpmnExpr: LWProcessBpmnExpr.Api; LWProcessBpmnTail?: LWProcessBpmnTail.Api};
 type X = LWProcessXml.Node; type Ctx = LWProcessBpmnGraph.Ctx; type Parts = LWProcessBpmnTail.Parts;
 const E = () => root.LWProcessBpmnExt, kids = (n: X, l: string) => E().kids(n, l), first = (n: X, l: string) => E().first(n, l), extensions = (n: X, l: string) => E().extensions(n, l);
 /** Arrival entries: the Wildlands extension first; the BPSim start-event timing (and its properties as case data) only when the file declares none. */
 function arrivalsOf(ctx: Ctx, proc: X, p: Parts): LWProcess.Arrival[] {
  const ext = E(), arrivals = extensions(proc, 'arrival').map((a, n): LWProcess.Arrival => {
   const where = 'Arrival ' + (n + 1); ext.onlyAttrs(a, ['at', 'count', 'until', 'open', 'interval', 'empty'], where);
   for (const c of a.children) if (c.ns !== root.LWProcessBpmnExport.vocabulary.WL || !['gap', 'draw', 'data'].includes(c.local)) throw Error(where + ': unknown element ' + c.local + '.');
   const count = ext.whole(a.attrs, 'count', where), until = ext.whole(a.attrs, 'until', where), open = a.attrs.open;
   if (open !== undefined && open !== 'true') throw Error(where + ': open "' + open + '" must be true or absent.');
   const rules = [count, until, open].filter(v => v !== undefined).length;
   if (rules !== 1) throw Error(where + ': declare exactly one of count, until or open (found ' + rules + ').');
   const gap = ext.single(a.children.filter(c => c.local === 'gap'), 'gap', where), draws = ext.drawsOf(a.children.filter(c => c.local === 'draw'), where), data = a.children.filter(c => c.local === 'data');
   for (const c of data) ext.onlyAttrs(c, ['name', 'type', 'value'], where + ' data');
   const emptyDraws = ext.empties(a, ['draws'] as const, where).length > 0; if (emptyDraws && draws.length) throw Error(where + ': draws is marked empty but has entries.');
   return {at: ext.whole(a.attrs, 'at', where) ?? NaN, ...count !== undefined ? {count} : {}, ...until !== undefined ? {until} : {}, ...open ? {open: true as const} : {}, interval: ext.whole(a.attrs, 'interval', where) ?? NaN,
    ...gap ? {gap: ext.distOf(gap, where + ' gap')} : {}, ...draws.length || emptyDraws ? {draws} : {}, data: Object.fromEntries(data.map(c => [c.attrs.name!, ext.typed(c.attrs)]))};
  });
  const sp = p.start ? p.bp(p.start.xml) : undefined, startId = p.start?.xml ?? '';
  let derived: LWProcess.Arrival | undefined;
  if (sp && (sp.inter || sp.count !== undefined || sp.props.length)) {
   const data: LWProcess.Fields = {}, draws: LWProcess.Draw[] = [];
   for (const prop of sp.props) {
    const field = prop.name.replace(/^./, c => c.toLowerCase());
    if (!/^[a-z][a-zA-Z0-9_]{0,63}$/.test(field) || field in data || draws.some(d => d.field === field)) { ctx.warn('BPSim property "' + prop.name + '" is not a usable case field name or repeats; it is ignored.'); continue; }
    if (prop.value !== undefined) data[field] = prop.value; else draws.push({field, kind: 'int', min: Math.min(prop.min!, prop.max!), max: Math.max(prop.min!, prop.max!)});
    ctx.note(startId, 'bpsim:Property', 'field:' + field, prop.value !== undefined ? 'case data ' + JSON.stringify(prop.value) : 'random whole number ' + prop.min + '..' + prop.max + ' per case');
   }
   const timed = sp.inter !== undefined || sp.count !== undefined, horizon = ctx.bps?.horizon ?? null;
   if (!timed) derived = {at: 0, count: 1, interval: 0, data, ...draws.length ? {draws} : {}};
   else {
    const count = sp.count !== undefined && sp.count >= 1 ? Math.min(200, sp.count) : undefined, interval = Math.max(sp.inter ? 1 : 0, sp.inter?.mean ?? 0);
    if (sp.count !== undefined && sp.count > 200) ctx.warn('BPSim TriggerCount ' + sp.count + ' is limited to 200 cases; use an open stream for longer runs.');
    const rule = count !== undefined ? {count} : horizon !== null && horizon > 0 ? {until: horizon} : {open: true as const};
    derived = {at: 0, ...rule, interval, ...sp.inter?.dist ? {gap: sp.inter.dist} : {}, ...draws.length ? {draws} : {}, data};
    // Extension arrivals win, so the open-stream advice only applies when the BPSim stream is the one imported.
    if ('open' in rule && !arrivals.length) ctx.warn('The BPSim start event ' + startId + ' defines an open arrival stream (no TriggerCount or scenario Duration); give each run a minute horizon.');
    if (sp.count !== undefined) ctx.note(startId, 'bpsim:TriggerCount', 'arrival:1', 'count ' + count);
    if (horizon !== null) ctx.note('scenario', 'bpsim:Duration', 'until' in rule ? 'arrival:1' : 'none', 'horizon hint of ' + horizon + ' min' + ('until' in rule ? ' (arrival stream ends at ' + horizon + ')' : ''));
    ctx.note(startId, 'bpsim:InterTriggerTimer', 'arrival:1', (sp.inter?.dist ? sp.inter.dist.dist + ' gap, mean ' + sp.inter.mean : 'every ' + interval) + ' min; ' + ('count' in rule ? 'TriggerCount ' + rule.count : 'until' in rule ? 'scenario Duration ' + rule.until + ' min' : 'open stream'));
   }
  }
  if (arrivals.length) {
   // Compared as BPSim can carry them: the distribution parameters BPSim has, the end rule, and the constant interval when neither side draws gaps.
   const a = arrivals[0]!, rule = (x: LWProcess.Arrival) => x.count !== undefined ? 'count ' + x.count : x.until !== undefined ? 'until ' + x.until : 'open';
   if (derived && sp && (sp.inter || sp.count !== undefined) && (ext.sig(a.gap) !== ext.sig(derived.gap) || rule(a) !== rule(derived) || sp.inter !== undefined && !a.gap && !derived.gap && a.interval !== derived.interval))
    ctx.warn('BPSim start-event timing disagrees with the Wildlands arrivals; the arrivals win.');
   return arrivals;
  }
  if (derived) return [derived];
  ctx.warn('No case arrivals were found; one case arrives at minute 0.');
  return [{at: 0, count: 1, interval: 0, data: {}}];
 }
 /** Counterparty participants of message flows become SIPOC suppliers (flows into the process) and customers (flows out of it). */
 function sipocFrom(ctx: Ctx, doc: X, proc: X, collab: X | undefined, participants: X[], definition: LWProcess.Definition): void {
  const flows = collab ? kids(collab, 'messageFlow') : []; if (!flows.length) return;
  const owner = new Map<string, string>(), walk = (n: X, pid: string) => { for (const c of n.children) { if (c.attrs.id) owner.set(c.attrs.id, pid); walk(c, pid); } };
  for (const p of kids(doc, 'process')) walk(p, p.attrs.id ?? '');
  const who = (ref: string) => participants.find(x => x.attrs.id === ref) ?? participants.find(x => x.attrs.processRef === owner.get(ref)), mine = participants.find(x => x.attrs.processRef === proc.attrs.id);
  const name = (x: X) => (x.attrs.name || x.attrs.id || 'Participant').slice(0, 60), suppliers: LWProcess.Party[] = [], customers: LWProcess.Party[] = [], others = new Set<string>();
  for (const m of flows) {
   const s = who(m.attrs.sourceRef ?? ''), t = who(m.attrs.targetRef ?? ''), note = m.attrs.name && m.attrs.name.length <= 160 ? m.attrs.name : undefined;
   for (const x of [s, t]) if (x && x !== mine) others.add(name(x));
   let target = 'none', how = 'ignored: message flows are not simulated';
   if (mine && t === mine && s && s !== mine && !suppliers.some(x => x.name === name(s)) && suppliers.length < 8) { suppliers.push({name: name(s), ...note ? {supplies: note} : {}}); target = 'sipoc:' + name(s); how = 'ignored; the sending participant becomes a SIPOC supplier'; }
   else if (mine && s === mine && t && t !== mine && !customers.some(x => x.name === name(t)) && customers.length < 8) { customers.push({name: name(t), ...note ? {receives: note} : {}}); target = 'sipoc:' + name(t); how = 'ignored; the receiving participant becomes a SIPOC customer'; }
   ctx.note(m.attrs.id ?? '(no id)', 'messageFlow', target, how);
  }
  ctx.warn('Message flows are ignored (' + flows.length + '); counterparties: ' + ([...others].join(', ') || 'none') + '.');
  if (!definition.sipoc && (suppliers.length || customers.length)) definition.sipoc = {...suppliers.length ? {suppliers} : {}, ...customers.length ? {customers} : {}};
 }
 function finish(ctx: Ctx, doc: X, proc: X, collab: X | undefined, participants: X[], p: Parts): LWProcess.Definition {
  const ext = E(), meta = first(proc, 'process'); ext.vet(proc, 'process', 'Process');
  const idTaken = new Set<string>(), arrivals = arrivalsOf(ctx, proc, p), start = p.net.items.find(i => i.kind === 'start')!;
  const definition: LWProcess.Definition = {format: 'wildlands-process', schemaVersion: 1, revision: (meta && ext.whole(meta.attrs, 'revision', 'Process')) ?? 0, id: meta?.attrs.id ?? ext.sanitize(proc.attrs.id ?? 'imported-process', idTaken, 'process'),
   name: (proc.attrs.name || doc.attrs.name || proc.attrs.id || 'Imported process').slice(0, 120), start: start.id!, resources: p.resources, steps: p.steps, flows: p.flows, arrivals, ...meta?.attrs.schema ? {$schema: meta.attrs.schema} : {}};
  // The extension seed wins; a BPSim scenario seed alone (a tool that dropped the extension) still repeats the same run.
  const seed = meta ? ext.whole(meta.attrs, 'seed', 'Process') : undefined, bpsimSeed = ctx.bps?.seed ?? null;
  if (seed !== undefined) definition.seed = seed; else if (bpsimSeed !== null) definition.seed = bpsimSeed;
  if (seed !== undefined && bpsimSeed !== null && seed !== bpsimSeed) {
   ctx.warn('BPSim seed ' + bpsimSeed + ' disagrees with the Wildlands seed ' + seed + '; the extension wins.');
  }
  ext.trackOf(proc, meta, definition); ext.sipocOf(proc, definition); sipocFrom(ctx, doc, proc, collab, participants, definition);
  const description = ext.documentation(proc, meta !== undefined); if (description !== undefined) definition.description = description.slice(0, 4000);
  for (const k of ext.empties(meta, ['track', 'sipoc', 'suppliers', 'customers'] as const, 'Process')) {
   if (k === 'track') { if (definition.track) throw Error('Process: track is marked empty but has entries.'); definition.track = []; continue; }
   const sipoc = definition.sipoc ??= {};
   if (k !== 'sipoc') { if (sipoc[k]) throw Error('Process: ' + k + ' is marked empty but has entries.'); sipoc[k] = []; }
  }
  // ---------------------------------------------------------------- report
  for (const [type, ids] of p.net.ignored) ctx.warn('Ignored ' + ids.length + ' ' + type + ' element' + (ids.length === 1 ? '' : 's') + ' (' + ids.slice(0, 6).join(', ') + (ids.length > 6 ? ', ...' : '') + '): no simulation behaviour.');
  const ids = new Set<string>(), collect = (n: X) => { if (n.attrs.id) ids.add(n.attrs.id); n.children.forEach(collect); }; collect(doc);
  for (const ref of ctx.bps?.elements.keys() ?? []) if (!ids.has(ref)) ctx.warn('BPSim parameters for "' + ref + '" match no element of the file and are ignored.');
  const stepById = new Map(p.steps.map(s => [s.id, s] as const)), flowById = new Map<string, LWProcess.Flow>();
  // The first flow of an id wins, as a duplicate id is reported by validation later.
  for (const f of p.flows) if (!flowById.has(f.id)) flowById.set(f.id, f);
  for (const i of p.net.items) {
   const s = stepById.get(i.id!)!, pools = Object.keys(s.resources ?? {}).join(', ');
   const how = i.how || (s.kind === 'start' ? 'start event' : s.kind === 'end' ? (s.outcome === 'lost' ? 'end event with outcome "lost"' : 'end event') : s.kind === 'timer' ? 'timer step' + (s.timing ? ' with ' + s.timing.dist + ' timing' : '')
    : s.kind === 'decision' ? (i.gateway === 'event' ? 'event-based gateway -> decision (race simulated by chance)' : 'exclusive gateway -> decision') : s.kind === 'fork' ? (s.mode === 'inclusive' ? 'inclusive gateway -> inclusive fork' : 'parallel gateway -> fork')
    : s.kind === 'join' ? 'converging gateway -> join' : s.kind + ' step' + (pools ? ' demanding ' + pools : '') + (s.timing ? ' with ' + s.timing.dist + ' timing' : ''));
   ctx.note(i.xml, i.local, 'step:' + s.id, how);
  }
  for (const e of p.net.edges) {
   const f = flowById.get(e.id!)!, w = f.when, text = w ? (w.chance !== undefined ? 'chance ' + w.chance + '%' : root.LWProcessBpmnExpr.format(w) ?? 'condition from the extension') : undefined;
   ctx.note(e.xml, 'sequenceFlow', 'flow:' + f.id, f.on ? 'deadline flow (' + stepById.get(f.from)!.deadline!.mode + ')' : text ? 'conditional flow: ' + text : 'flow');
  }
  return definition;
 }
 root.LWProcessBpmnTail = {finish};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessBpmnTail;
})(globalThis);
