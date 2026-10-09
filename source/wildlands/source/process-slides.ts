/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-slides-contracts.d.ts" />
/// <reference path="./process-route.ts" />
/// <reference path="./process-sipoc-model.ts" />
/// <reference path="./process-slides-text.ts" />
/**
 * Pure slide model: turns one process definition (and optionally one snapshot) into a detached, deterministic deck that
 * explains the process step by step. No DOM, session, clock, storage or randomness; the inputs are copied first, never changed,
 * and the deck shares no object with them. Order: an intro section (title, overview, resources), one section per main-route
 * phase (or one "Main route" section), a variants section for steps off the main route, and a summary. Every step appears on
 * exactly one step slide and no section is empty. The main route and phase grouping are LWProcessRoute's (the SIPOC rule);
 * the SIPOC overview reads LWProcessSipocModel; wording lives in process-slides-text.ts.
 */
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessSlides?: LWProcessSlides.Api; LWProcessRoute: LWProcessRoute.Api; LWProcessSipocModel: LWProcessSipoc.ModelApi;
  LWProcessRandomView: LWProcessRandomView.Api; LWProcessTerms: LWProcessTerms.Api; LWProcessSlidesText: LWProcessSlidesText.Api};
 type Step = LWProcess.Step; type Slide = LWProcessSlides.Slide; type Block = LWProcessSlides.Block; type Section = LWProcessSlides.Section;
 const KINDS: LWProcess.Kind[] = ['start', 'task', 'touchpoint', 'machine', 'system', 'timer', 'decision', 'fork', 'join', 'end'];
 const SYNTHETIC = /\b(synthetic|illustrative)\b/i;
 const EMPTY_SNAPSHOT: LWProcess.Snapshot = {minute: 0, status: 'ready', cases: [], tokens: [], receipts: [], receiptsDropped: 0, steps: [], resources: [], events: [],
  metrics: {arrived: 0, completed: 0, failed: 0, dropped: 0, active: 0, cost: 0, meanCycleMinutes: 0, throughputPerHour: 0, goals: 0, lost: 0, conversion: null, tracked: {}}, seed: 0, retention: {finishedDropped: 0}};
 const detach = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
 const quote = (text: string) => `“${text}”`;
 const plural = (n: number, one: string, many = one + 's') => `${root.LWProcessSlidesText.number(n)} ${n === 1 ? one : many}`;
 const slide = (id: string, kind: LWProcessSlides.Kind, section: string, title: string, subtitle: string, lead: string, blocks: Block[], step: string | null = null): Slide =>
  ({id, kind, section, title, subtitle, lead, blocks: blocks.filter(b => b.items.length), concepts: [], live: null, step});
 /** Off-route steps, breadth-first from the main route in flow order, labelled by how they are first reached. */
 function variantsOf(d: LWProcess.Definition, path: Step[]): {step: Step; label: string; from: string | null}[] {
  const by = new Map(d.steps.map(s => [s.id, s])), main = new Set(path.map(s => s.id)), found = new Map<string, {label: string; from: string | null}>(), queue = [...path];
  const reach = (s: Step, f: LWProcess.Flow) => f.on === 'deadline' ? 'Deadline path' : s.kind === 'decision' ? 'Decision alternative' : s.kind === 'fork' ? (s.mode === 'inclusive' ? 'Inclusive branch' : 'Parallel branch') : 'Other path';
  for (let i = 0; i < queue.length; i++) {
   const s = queue[i]!;
   for (const f of d.flows.filter(x => x.from === s.id)) {
    const t = by.get(f.to); if (!t || main.has(t.id) || found.has(t.id)) continue;
    found.set(t.id, {label: t.kind === 'end' ? 'Other end' : main.has(s.id) ? reach(s, f) : found.get(s.id)!.label, from: s.name}); queue.push(t);
   }
  }
  const reached = queue.slice(path.length).map(step => ({step, ...found.get(step.id)!}));
  return [...reached, ...d.steps.filter(s => !main.has(s.id) && !found.has(s.id)).map(step => ({step, label: 'Other step', from: null}))];
 }
 /** Decisions with a flow back to an earlier step whose condition tests a field that some step adds to. */
 function counterLoops(d: LWProcess.Definition, order: Map<string, number>): Set<string> {
  const added = new Set(d.steps.flatMap(s => Object.keys(s.add ?? {}))), loops = new Set<string>();
  const fields = (w: LWProcess.When | undefined): string[] => !w ? [] : [...w.field !== undefined ? [w.field] : [], ...w.valueField !== undefined ? [w.valueField] : [], ...(w.all ?? w.any ?? []).flatMap(fields), ...fields(w.not)];
  for (const s of d.steps) if (s.kind === 'decision') for (const f of d.flows) {
   if (f.from === s.id && (order.get(f.to) ?? Infinity) < (order.get(s.id) ?? -1) && fields(f.when).some(x => added.has(x))) loops.add(s.id);
  }
  return loops;
 }
 function overview(d: LWProcess.Definition, terms: LWProcessTerms.Terms, path: Step[], groups: LWProcessRoute.Group[]): Slide {
  const text = root.LWProcessSlidesText, rv = root.LWProcessRandomView, last = path[path.length - 1];
  const ending = last?.kind === 'end' ? ` and the main route ends at ${quote(last.name)}` : ' and the main route loops back to an earlier step';
  const lead = `${terms.label} with ${plural(d.steps.length, 'step')}, ${text.number(path.length)} of them on the main route. ${terms.Many} start at ${quote(path[0]?.name ?? d.start)}${ending}.`;
  const arrivals: Block = {heading: `How ${terms.many} arrive`, items: d.arrivals.flatMap(a => [a.count === 1 && !a.gap ? `One ${terms.one} arrives at minute ${text.number(a.at)}.` : rv.describeArrival(a, terms) + '.',
   ...Object.entries(a.data).map(([field, value]) => `Each starts with ${field} = ${rv.scalar(value)}.`), ...(a.draws ?? []).map(dr => `Each arrival: ${rv.describeDraw(dr)}.`)])};
  if (terms.journey) {
   const main = new Set(path.map(s => s.id)), phased = groups.length ? groups : [{name: 'Journey', steps: path}];
   const blocks = phased.map(g => ({heading: g.name, items: [...g.steps.filter(s => s.kind === 'touchpoint'), ...d.steps.filter(s => !main.has(s.id) && s.kind === 'touchpoint' && s.phase === g.name)]
    .map(s => `${s.name}${s.channel ? ` (${rv.describeChannel(s.channel)})` : ''}${main.has(s.id) ? '' : ', on an alternative path'}`)})).map(b => b.items.length ? b : {heading: b.heading, items: ['No touchpoints in this phase.']});
   return slide('overview', 'overview', 'intro', 'Overview', 'Journey map: phases and touchpoints', lead, [...blocks, arrivals]);
  }
  const m = root.LWProcessSipocModel.model(d, EMPTY_SNAPSHOT), party = (p: LWProcessSipoc.Party, none: string) => p.placeholder ? none : p.detail ? `${p.name}: ${p.detail}` : p.name;
  return slide('overview', 'overview', 'intro', 'Overview', 'SIPOC: suppliers, inputs, process, outputs and customers', lead, [
   {heading: 'Suppliers', items: m.suppliers.map(p => party(p, 'No suppliers authored (add them in Edit process).'))},
   {heading: 'Inputs', items: m.inputs.length ? m.inputs.map(i => `${i.label}${i.label !== i.field ? ` (${i.field})` : ''}${i.example !== null ? `, for example ${i.example}` : ''}`) : ['No arrival data or external needs.']},
   {heading: 'Process', items: m.stages.map(s => `${s.name}: ${plural(s.steps, 'step')}${s.parallel ? ', in parallel' : ''}${s.variant ? ', with alternative paths' : ''}`)},
   {heading: 'Outputs', items: m.outputs.map(o => `${o.label}: ${o.detail}`)},
   {heading: 'Customers', items: m.customers.map(p => party(p, 'No customers authored (add them in Edit process).'))}, arrivals]);
 }
 function resources(d: LWProcess.Definition, terms: LWProcessTerms.Terms): Slide {
  const text = root.LWProcessSlidesText;
  if (!d.resources.length) return slide('resources', 'resources', 'intro', 'Resources', 'No resource pools', `This process has no resource pools, so no step ever waits for capacity.`, []);
  const users = (id: string) => d.steps.filter(s => Object.hasOwn(s.resources ?? {}, id)).map(s => s.name);
  const blocks = ['People', 'Machine', 'System'].map(kind => ({heading: kind === 'People' ? 'People' : kind + 's', items: d.resources.filter(r => text.poolKind(r) === kind).map(r => {
   const used = users(r.id);
   return `${r.name}: capacity ${text.number(r.capacity)}, cost ${text.number(r.costPerMinute)} per minute; ${used.length ? 'used by ' + used.join(', ') : 'not used by any step'}.`;
  })}));
  return slide('resources', 'resources', 'intro', 'Resources', plural(d.resources.length, 'resource pool'),
   `Pools are capacity slots: work starts when its pools have free units, otherwise the ${terms.one} waits in a queue. Costs are simulated units, not money.`, blocks);
 }
 function summary(d: LWProcess.Definition, terms: LWProcessTerms.Terms, path: Step[], phases: number, variants: number, snapshot: LWProcess.Snapshot | null): Slide {
  const text = root.LWProcessSlidesText, kinds = KINDS.map(k => [k, d.steps.filter(s => s.kind === k).length] as const).filter(([, n]) => n > 0);
  const random = d.arrivals.some(a => a.gap || a.draws?.length) || d.steps.some(s => s.timing || s.draws?.length || s.deadline?.timing) || d.flows.some(f => JSON.stringify(f.when ?? {}).includes('"chance"'));
  const tries = [`Choose Run simulation and watch ${terms.many} move along the main route; pause and select a step to inspect it.`,
   `Open the ${terms.lensLabel} view to see the same process as ${terms.lens === 'sipoc' ? 'suppliers, inputs, stages, outputs and customers' : 'phases, touchpoints, feelings and the funnel'}.`,
   ...d.resources.length ? ["Change a pool's capacity in Edit process and compare waiting time, cost and cycle time."] : [],
   ...d.steps.some(s => s.kind === 'decision') ? [`Change a decision's condition or chance and watch how many ${terms.many} take each route.`] : [],
   ...random ? ['Change the seed to see another run; the same seed always repeats the same run.'] : [],
   'From the command line: wildlands process run for a bounded run, or process slides --minutes N for these slides with live facts.'];
  const s = slide('summary', 'summary', 'summary', 'Summary', d.name, `${plural(d.steps.length, 'step')} in ${plural(phases, 'phase')}, ${plural(d.resources.length, 'resource pool')} and ${plural(variants, 'step')} off the main route.`, [
   {heading: 'Steps by kind', items: kinds.map(([k, n]) => text.kindCount(k, n))},
   {heading: 'Structure', items: [`Main route: ${plural(path.length, 'step')}.`, `Off the main route: ${plural(variants, 'step')}.`, `Arrival rules: ${text.number(d.arrivals.length)}.`, ...d.seed !== undefined ? [`Seed: ${d.seed}.`] : []]},
   {heading: 'Try in the studio', items: tries}]);
  if (snapshot) s.live = text.runLive(snapshot, terms);
  return s;
 }
 function build(input: LWProcess.Definition, rawSnapshot: LWProcess.Snapshot | null = null): LWProcessSlides.Deck {
  const d = detach(input), snapshot = rawSnapshot ? detach(rawSnapshot) : null, terms = root.LWProcessTerms.of(d), text = root.LWProcessSlidesText;
  const {path} = root.LWProcessRoute.walk(d), groups = root.LWProcessRoute.phases(path) ?? [], variants = variantsOf(d, path);
  const order = new Map([...path, ...variants.map(v => v.step)].map((s, i) => [s.id, i]));
  const mainFlows = new Set(path.map(s => root.LWProcessRoute.next(d, s.id)?.id).filter((id): id is string => id !== undefined));
  const context: LWProcessSlidesText.Context = {definition: d, terms, steps: new Map(d.steps.map(s => [s.id, s])), pools: new Map(d.resources.map(r => [r.id, r])), counterLoops: counterLoops(d, order), mainFlows};
  const metrics = new Map((snapshot?.steps ?? []).map(m => [m.id, m])), slides: Slide[] = [], sections: Section[] = [];
  const add = (section: Omit<Section, 'first' | 'count'>, list: Slide[]) => { sections.push({...section, first: slides.length, count: list.length}); slides.push(...list); };
  const stepSlide = (s: Step, section: string, subtitle: string): Slide => {
   const out = slide('step-' + s.id, 'step', section, s.name, subtitle, s.description ?? 'No description authored.', text.stepBlocks(s, context), s.id);
   out.concepts = text.concepts(s, context); if (snapshot) out.live = text.stepLive(metrics.get(s.id), snapshot, terms); return out;
  };
  const title = slide('title', 'title', 'intro', d.name, terms.label, d.description ?? 'No description authored.', [
   ...d.description && SYNTHETIC.test(d.description) ? [{heading: 'About the values', items: ['The description says these values are synthetic or illustrative: they are scenario assumptions, not measurements.']}] : [],
   {heading: 'How to read this deck', items: [`The overview and resources come first, then the main route ${groups.length ? 'phase by phase' : 'step by step'}${variants.length ? ', then every step off the main route' : ''}, then a summary.`,
    `Each step slide says what happens, who or what does it, how long it takes, what it needs and delivers, and where the ${terms.one} goes next.`]}]);
  add({id: 'intro', title: 'Introduction', kind: 'intro'}, [title, overview(d, terms, path, groups), resources(d, terms)]);
  const onRoute = new Set(path.map(s => s.id)), how = new Map(variants.map(v => [v.step.id, v.label.toLowerCase()]));
  const leaving = (steps: Step[]) => steps.flatMap(s => d.flows.filter(f => f.from === s.id && !onRoute.has(f.to)).map(f => `${s.name} → ${context.steps.get(f.to)?.name ?? f.to} (${how.get(f.to) ?? 'other path'})`));
  const sectionSlide = (id: string, name: string, subtitle: string, steps: Step[]) => slide('section-' + id, 'section', id, name, subtitle,
   steps.length === 1 ? `1 step on the main route: ${quote(steps[0]!.name)}.` : `${plural(steps.length, 'step')} on the main route, from ${quote(steps[0]!.name)} to ${quote(steps[steps.length - 1]!.name)}.`,
   [{heading: 'In this part', items: steps.map(s => `${s.name} (${text.kindLabel(s).toLowerCase()})`)}, {heading: 'Leaves the main route', items: leaving(steps)}], steps[0]!.id);
  if (groups.length) groups.forEach((g, i) => { const id = 'phase-' + (i + 1); add({id, title: g.name, kind: 'phase'}, [sectionSlide(id, g.name, `Phase ${i + 1} of ${groups.length}`, g.steps), ...g.steps.map(s => stepSlide(s, id, `${text.kindLabel(s)} · ${g.name}`))]); });
  else if (path.length) add({id: 'route', title: 'Main route', kind: 'route'}, [sectionSlide('route', 'Main route', 'No phases authored', path), ...path.map(s => stepSlide(s, 'route', `${text.kindLabel(s)} · main route`))]);
  if (variants.length) {
   const intro = slide('section-variants', 'section', 'variants', 'Variants and other paths', plural(variants.length, 'step') + ' off the main route',
    `These steps are reached only through a decision alternative, a branch, a deadline or another end; each slide says how.`, [{heading: 'Off the main route', items: variants.map(v => `${v.step.name}: ${v.label.toLowerCase()}${v.from ? ` from ${quote(v.from)}` : ''}`)}]);
   add({id: 'variants', title: 'Variants and other paths', kind: 'variants'}, [intro, ...variants.map(v => stepSlide(v.step, 'variants', `${text.kindLabel(v.step)} · ${v.label}${v.from ? ` from ${quote(v.from)}` : ''}`))]);
  }
  add({id: 'summary', title: 'Summary', kind: 'summary'}, [summary(d, terms, path, groups.length, variants.length, snapshot)]);
  return {format: 'wildlands-process-slides', schemaVersion: 1, process: {id: d.id, name: d.name, genre: terms.genre, revision: d.revision},
   live: snapshot ? {minute: snapshot.minute, seed: snapshot.seed, status: snapshot.status} : null, sections, slides};
 }
 function markdown(deck: LWProcessSlides.Deck): string {
  const lines = [`# ${deck.process.name}`, '', `Process \`${deck.process.id}\` · ${root.LWProcessTerms.of(deck.process.genre).label} · revision ${deck.process.revision} · ${plural(deck.slides.length, 'slide')}`];
  if (deck.live) lines.push('', `Live facts come from one simulated run: minute ${root.LWProcessSlidesText.number(deck.live.minute)}, seed ${deck.live.seed}, status ${deck.live.status}.`);
  const list = (b: Block) => ['', `**${b.heading}**`, '', ...b.items.map(item => `- ${item}`)];
  deck.sections.forEach((section, i) => {
   lines.push('', `## ${i + 1}. ${section.title}`);
   deck.slides.slice(section.first, section.first + section.count).forEach((s, j) => {
    lines.push('', `### Slide ${section.first + j + 1}: ${s.title}`);
    if (s.subtitle) lines.push('', `_${s.subtitle}_`);
    if (s.lead) lines.push('', s.lead);
    for (const b of s.blocks) lines.push(...list(b));
    if (s.concepts.length) lines.push(...list({heading: 'Concepts', items: s.concepts.map(c => `${c.name}: ${c.text}`)}));
    if (s.live) lines.push(...list(s.live));
   });
  });
  return lines.join('\n') + '\n';
 }
 root.LWProcessSlides = {build, markdown};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessSlides;
})(globalThis);
