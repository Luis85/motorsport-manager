/// <reference path="./process-bpmn.ts" />
/**
 * Readers of the Wildlands extension elements (`urn:wildlands:process:1`) shared by the BPMN importer: scalars,
 * distributions, draws, conditions, journey notes, tracked fields, SIPOC parties and the display calendar. Shape is judged
 * here; ranges stay with the engine validator, except the display calendar, whose ranges are rejected here explicitly.
 */
declare namespace LWProcessBpmnExt {
 type X = LWProcessXml.Node;
 interface Api {
  /** Foreign documentation is trimmed and empty parts dropped; `exact` (a Wildlands export) keeps the text as written, an empty text included. */
  kids(n: X, local: string, ns?: string): X[]; documentation(n: X, exact?: boolean): string | undefined; extensions(n: X, local: string): X[]; first(n: X, local: string): X | undefined;
  typed(a: Record<string, string>): LWProcess.Scalar; sanitize(raw: string, taken: Set<string>, fallback: string): string;
  whole(a: Record<string, string>, name: string, where: string): number | undefined; onlyAttrs(n: X, allowed: string[], where: string): void;
  /** A required attribute that must be one of `values`. */
  oneOf<T extends string>(a: Record<string, string>, name: string, values: readonly T[], where: string): T;
  /** Rejects any Wildlands element or attribute that `context` (the kind of BPMN element carrying the extension) does not define. */
  vet(n: X, context: 'step' | 'process' | 'flow' | 'resource' | 'lane' | 'performer' | 'boundary', where: string): void;
  /** The containers an export marked as present but empty (`empty="set needs"`), each one of `allowed`. */
  empties<T extends string>(e: X | undefined, allowed: readonly T[], where: string): T[];
  /** Comparable text of the distribution parameters BPSim can carry (bounds of exponential and normal forms do not travel). */
  sig(d: LWProcess.Dist | undefined): string;
  OPS: readonly LWProcess.Op[];
  distOf(n: X, where: string): LWProcess.Dist; single(nodes: X[], what: string, where: string): X | undefined; drawsOf(nodes: X[], where: string): LWProcess.Draw[];
  chanceOf(ext: X | undefined, expression: X | undefined, where: string): LWProcess.ChanceCondition | undefined; whenOf(n: X, where: string): LWProcess.When;
  journeyOf(ext: X, step: LWProcess.Step, where: string): void; trackOf(proc: X, meta: X | undefined, definition: LWProcess.Definition): void;
  sipocOf(proc: X, definition: LWProcess.Definition): void;
  /** The display calendar from `<wl:process minutesPerDay daysPerWeek>`: both or neither, whole numbers in range. */
  calendarOf(meta: X | undefined, definition: LWProcess.Definition): void;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessBpmnExport: {vocabulary: LWProcessBpmn.Vocabulary}; LWProcessBpmnExt?: LWProcessBpmnExt.Api};
 const {MODEL, WL} = root.LWProcessBpmnExport.vocabulary;
 type X = LWProcessXml.Node;
 const kids = (n: X, local: string, ns = MODEL) => n.children.filter(c => c.local === local && c.ns === ns);
 const documentation = (n: X, exact = false) => { const docs = kids(n, 'documentation'); return exact ? docs.length ? docs.map(d => d.text).join('\n\n') : undefined : docs.map(d => d.text.trim()).filter(Boolean).join('\n\n') || undefined; };
 const extensions = (n: X, local: string) => kids(n, 'extensionElements').flatMap(e => e.children.filter(c => c.ns === WL && c.local === local));
 const first = (n: X, local: string) => extensions(n, local)[0];
 const typed = (a: Record<string, string>): LWProcess.Scalar => {
  const v = a.value ?? '', t = a.type ?? 'string';
  if (t === 'null') { if (v) throw Error('A null value must be empty, not "' + v + '".'); return null; }
  if (t === 'boolean') { if (v !== 'true' && v !== 'false') throw Error('A boolean value must be true or false, not "' + v + '".'); return v === 'true'; }
  if (t === 'number') { const n = Number(v); if (!v.trim() || !Number.isFinite(n)) throw Error('Invalid number: ' + v); return n; }
  if (t !== 'string') throw Error('Value type "' + t + '" must be string, number, boolean or null.');
  return v;
 };
 const sanitize = (raw: string, taken: Set<string>, fallback: string): string => {
  let id = raw.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60); if (!/^[a-z]/.test(id)) id = (fallback + '-' + id).replace(/-$/, '');
  let candidate = id, n = 2; while (taken.has(candidate)) candidate = id + '-' + n++;
  taken.add(candidate); return candidate;
 };
 const WHOLE = /^-?\d+$/;
 const whole = (a: Record<string, string>, name: string, where: string): number | undefined => {
  const v = a[name]; if (v === undefined) return undefined;
  if (!WHOLE.test(v)) throw Error(where + ': ' + name + ' "' + v + '" must be a whole number.');
  return Number(v);
 };
 const onlyAttrs = (n: X, allowed: string[], where: string) => { for (const k of Object.keys(n.attrs)) if (!allowed.includes(k)) throw Error(where + ': unknown attribute ' + k + '.'); };
 function oneOf<T extends string>(a: Record<string, string>, name: string, values: readonly T[], where: string): T {
  const v = a[name]; if (!values.includes(v as T)) throw Error(where + ': ' + name + ' "' + (v ?? '') + '" must be ' + values.join(' or ') + '.');
  return v as T;
 }
 const OPS = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'] as const;
 const DIST_ATTRS = ['dist', 'min', 'mode', 'max', 'mean', 'sd', 'k'], DRAW_ATTRS = ['field', 'kind', 'percent', 'min', 'max'], SCALAR = ['type', 'value'];
 /** Every Wildlands element and attribute an export writes, by the BPMN element that carries it; nested children are judged by their own readers. */
 const VOCABULARY: Record<string, Record<string, string[]>> = {
  step: {step: ['id', 'kind', 'duration', 'until', 'cost', 'join', 'technology', 'channel', 'outcome', 'phase', 'emotion', 'pain', 'opportunity', 'empty'], timing: DIST_ATTRS, instances: ['count', 'field', 'mode'],
   draw: DRAW_ATTRS, output: ['field', 'label'], add: ['name', 'delta'], set: ['name', ...SCALAR], need: ['field', 'op', 'label', ...SCALAR], backlog: ['capacity', 'order', 'priority', 'pull'], scene: ['id', 'x', 'y', 'color']},
  process: {process: ['id', 'revision', 'schema', 'seed', 'genre', 'minutesPerDay', 'daysPerWeek', 'empty'], track: ['field', 'label'],
   supplier: ['name', 'supplies'], customer: ['name', 'receives'], arrival: ['at', 'count', 'until', 'open', 'interval', 'empty']},
  flow: {flow: ['id'], when: ['combine', 'chance', 'field', 'op', 'valueField', ...SCALAR]}, resource: {resource: ['id', 'capacity', 'costPerMinute', 'kind']}, lane: {lane: ['resource']},
  performer: {demand: ['quantity']}, boundary: {deadline: ['mode', 'flow', 'after'], timing: DIST_ATTRS}};
 /** Elements whose own readers judge their attributes and children (with their own messages); `vet` only admits them here. */
 const NESTED = new Set(['draw', 'arrival', 'when', 'supplier', 'customer', 'track', 'timing']);
 function vet(n: X, context: string, where: string): void {
  for (const e of kids(n, 'extensionElements').flatMap(x => x.children.filter(c => c.ns === WL))) {
   const allowed = VOCABULARY[context]![e.local]; if (!allowed) throw Error(where + ': unknown Wildlands element ' + e.local + '.');
   if (NESTED.has(e.local)) continue;
   onlyAttrs(e, allowed, where + ' ' + e.local);
   const extra = e.children.find(c => !(e.local === 'scene' && c.ns === WL && c.local === 'asset')); if (extra) throw Error(where + ' ' + e.local + ': unknown element ' + extra.local + '.');
  }
 }
 function empties<T extends string>(e: X | undefined, allowed: readonly T[], where: string): T[] {
  const list = (e?.attrs.empty ?? '').split(' ').filter(Boolean) as T[];
  for (const k of list) if (!allowed.includes(k)) throw Error(where + ': empty "' + k + '" must name one of ' + allowed.join(', ') + '.');
  return list;
 }
 const sig = (d: LWProcess.Dist | undefined): string => !d ? '' : [d.dist, ...(d.dist === 'uniform' ? [d.min, d.max] : d.dist === 'triangular' ? [d.min, d.mode, d.max] : d.dist === 'normal' ? [d.mean, d.sd] : d.dist === 'erlang' ? [d.k, d.mean] : [d.mean])].join(':');
 const DISTS = ['uniform', 'triangular', 'exponential', 'normal', 'erlang'], DRAW_KINDS = ['chance', 'choice', 'int'];
 /** Reads `<wl:timing>` or `<wl:gap>`; the engine validator judges ranges, this judges shape. */
 function distOf(n: X, where: string): LWProcess.Dist {
  onlyAttrs(n, DIST_ATTRS, where);
  if (!DISTS.includes(n.attrs.dist ?? '')) throw Error(where + ': dist "' + (n.attrs.dist ?? '') + '" must be uniform, triangular, exponential, normal or erlang.');
  const out: LWProcess.Dist = {dist: n.attrs.dist as LWProcess.Dist['dist']};
  for (const k of ['min', 'mode', 'max', 'mean', 'sd', 'k'] as const) { const v = whole(n.attrs, k, where); if (v !== undefined) out[k] = v; }
  return out;
 }
 const single = (nodes: X[], what: string, where: string): X | undefined => { if (nodes.length > 1) throw Error(where + ': ' + nodes.length + ' ' + what + ' elements; at most one is allowed.'); return nodes[0]; };
 function drawsOf(nodes: X[], where: string): LWProcess.Draw[] {
  return nodes.map((n, i) => {
   const here = where + ' draw ' + (i + 1); onlyAttrs(n, DRAW_ATTRS, here);
   const kind = n.attrs.kind ?? ''; if (!DRAW_KINDS.includes(kind)) throw Error(here + ': kind "' + kind + '" must be chance, choice or int.');
   if (n.attrs.field === undefined) throw Error(here + ': field is required.');
   const draw: LWProcess.Draw = {field: n.attrs.field, kind: kind as LWProcess.Draw['kind']};
   for (const k of ['percent', 'min', 'max'] as const) { const v = whole(n.attrs, k, here); if (v !== undefined) draw[k] = v; }
   for (const c of n.children) if (c.ns !== WL || !['whenTrue', 'whenFalse', 'choice'].includes(c.local)) throw Error(here + ': unknown element ' + c.local + '.');
   for (const t of ['whenTrue', 'whenFalse'] as const) { const c = single(n.children.filter(x => x.local === t), t, here); if (c) { onlyAttrs(c, SCALAR, here + ' ' + t); draw[t] = typed(c.attrs); } }
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
 /** The exact condition of a flow: a comparison, a chance, or a nested `combine` (all, any, not) of them. */
 function whenOf(n: X, where: string): LWProcess.When {
  const combine = n.attrs.combine;
  if (combine !== undefined) {
   onlyAttrs(n, ['combine'], where);
   if (!['all', 'any', 'not'].includes(combine)) throw Error(where + ': combine "' + combine + '" must be all, any or not.');
   const parts = n.children.map(c => { if (c.ns !== WL || c.local !== 'when') throw Error(where + ': unknown element ' + c.local + '.'); return c; });
   if (!parts.length || combine === 'not' && parts.length !== 1) throw Error(where + ': ' + combine + ' needs ' + (combine === 'not' ? 'exactly one' : 'at least one') + ' condition.');
   const list = parts.map((c, i) => whenOf(c, where + ' ' + combine + ' ' + (i + 1)));
   return combine === 'not' ? {not: list[0]!} : combine === 'all' ? {all: list} : {any: list};
  }
  if (n.attrs.chance !== undefined) { onlyAttrs(n, ['chance'], where + ' chance'); return {chance: whole(n.attrs, 'chance', where)!}; }
  const field = n.attrs.valueField !== undefined; onlyAttrs(n, field ? ['field', 'op', 'valueField'] : ['field', 'op', ...SCALAR], where);
  if (!n.attrs.field) throw Error(where + ': field is required.');
  const op = oneOf(n.attrs, 'op', OPS, where);
  return field ? {field: n.attrs.field, op, valueField: n.attrs.valueField!} : {field: n.attrs.field, op, value: typed(n.attrs)};
 }
 const CHANNELS = ['web', 'mobile', 'store', 'phone', 'chat', 'email', 'social', 'ads', 'delivery', 'document'], GENRES = ['process', 'customer-journey', 'user-journey'], OUTCOMES = ['goal', 'lost'];
 /** Journey annotations of `<wl:step>`: channel, outcome and the phase/emotion/pain/opportunity notes. Shape is judged here; kind applicability stays with the engine validator. */
 function journeyOf(ext: X, step: LWProcess.Step, where: string): void {
  const a = ext.attrs;
  if (a.channel !== undefined) { if (!CHANNELS.includes(a.channel)) throw Error(where + ': channel "' + a.channel + '" must be ' + CHANNELS.join(', ') + '.'); step.channel = a.channel as LWProcess.Channel; }
  if (a.outcome !== undefined) { if (!OUTCOMES.includes(a.outcome)) throw Error(where + ': outcome "' + a.outcome + '" must be goal or lost.'); step.outcome = a.outcome as 'goal' | 'lost'; }
  const emotion = whole(a, 'emotion', where);
  if (emotion !== undefined) { if (emotion < -3 || emotion > 3) throw Error(where + ': emotion "' + emotion + '" must be between -3 and 3.'); step.emotion = emotion; }
  for (const k of ['phase', 'pain', 'opportunity'] as const) if (a[k] !== undefined) step[k] = a[k];
 }
 /** Process genre and tracked fields from `<wl:process>` and its `<wl:track>` siblings. */
 function trackOf(proc: X, meta: X | undefined, definition: LWProcess.Definition): void {
  const genre = meta?.attrs.genre;
  if (genre !== undefined) { if (!GENRES.includes(genre)) throw Error('Process: genre "' + genre + '" must be ' + GENRES.join(', ') + '.'); definition.genre = genre as LWProcess.Genre; }
  const track = extensions(proc, 'track').map((t, n): LWProcess.Track => {
   const where = 'Track ' + (n + 1); onlyAttrs(t, ['field', 'label'], where);
   if (!t.attrs.field) throw Error(where + ': field is required.');
   return {field: t.attrs.field, ...t.attrs.label !== undefined ? {label: t.attrs.label} : {}};
  });
  const seen = new Set<string>();
  for (const t of track) { if (seen.has(t.field)) throw Error('Track: duplicate field ' + t.field + '.'); seen.add(t.field); }
  if (track.length) definition.track = track;
 }
 /** SIPOC parties from `<wl:supplier>` / `<wl:customer>` siblings, in document order. Shape, length, duplicates and count are judged here; the engine validator repeats them as ranges. */
 function sipocOf(proc: X, definition: LWProcess.Definition): void {
  const read = (local: 'supplier' | 'customer', detail: 'supplies' | 'receives'): LWProcess.Party[] => {
   const seen = new Set<string>(), list = extensions(proc, local).map((e, n): LWProcess.Party => {
    const where = (local === 'supplier' ? 'Supplier ' : 'Customer ') + (n + 1); onlyAttrs(e, ['name', detail], where);
    if (e.children.length) throw Error(where + ': unknown element ' + e.children[0]!.local + '.');
    const name = e.attrs.name, note = e.attrs[detail];
    if (!name) throw Error(where + ': name is required.');
    if (name.length > 60) throw Error(where + ': name must be at most 60 characters.');
    if (note !== undefined && (note.length < 1 || note.length > 160)) throw Error(where + ': ' + detail + ' must be 1 to 160 characters.');
    if (seen.has(name)) throw Error(where + ': duplicate ' + local + ' name ' + name + '.'); seen.add(name);
    return {name, ...note !== undefined ? {[detail]: note} : {}};
   });
   if (list.length > 8) throw Error('SIPOC: at most 8 ' + local + 's are allowed; found ' + list.length + '.');
   return list;
  };
  const suppliers = read('supplier', 'supplies'), customers = read('customer', 'receives');
  if (suppliers.length || customers.length) definition.sipoc = {...suppliers.length ? {suppliers} : {}, ...customers.length ? {customers} : {}};
 }
 function calendarOf(meta: X | undefined, definition: LWProcess.Definition): void {
  if (!meta) return;
  const minutes = whole(meta.attrs, 'minutesPerDay', 'Process'), days = whole(meta.attrs, 'daysPerWeek', 'Process');
  if (minutes === undefined && days === undefined) return;
  if (minutes === undefined || days === undefined) throw Error('Process: a display calendar needs both minutesPerDay and daysPerWeek.');
  if (minutes < 1 || minutes > 1440) throw Error('Process: minutesPerDay "' + minutes + '" must be a whole number from 1 to 1440.');
  if (days < 1 || days > 7) throw Error('Process: daysPerWeek "' + days + '" must be a whole number from 1 to 7.');
  definition.calendar = {minutesPerDay: minutes, daysPerWeek: days};
 }
 root.LWProcessBpmnExt = {kids, documentation, extensions, first, typed, sanitize, whole, onlyAttrs, oneOf, vet, empties, sig, OPS, distOf, single,
  drawsOf, chanceOf, whenOf, journeyOf, trackOf, sipocOf, calendarOf};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessBpmnExt;
})(globalThis);
