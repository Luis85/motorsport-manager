/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-slides-contracts.d.ts" />
/// <reference path="./process-time.ts" />
/// <reference path="./process-random-view.ts" />
/// <reference path="./process-terms.ts" />
/// <reference path="./process-work-state.ts" />
/**
 * Wording of the process slide deck (LWProcessSlides): what one step slide says, the concept explainers and the read-only
 * live facts of one simulated run. Pure functions over detached values: no DOM, session, clock, storage or randomness.
 * Sentences come from the definition only; LWProcessRandomView supplies the shared phrases for timing, draws, conditions,
 * instances, deadlines, forks, channels, feelings and outcomes, and LWProcessTerms the nouns (cases, customers, users).
 * Live work states use the studio's words through LWProcessWorkState: "working" (people) or "running" (machines and systems),
 * "waiting" (queued minus held) and "blocked" (held), as on the 2D cards, the 3D captions and the step list. Durations are worded
 * by LWProcessTime.span with the definition's display calendar, so a process with `calendar` also reads in business days and
 * weeks; without one the wording is exactly LWProcessTime.minutes.
 */
declare namespace LWProcessSlidesText {
 /** What a step slide may know about the rest of the process. */
 interface Context {
  definition: LWProcess.Definition; terms: LWProcessTerms.Terms;
  /** Step id to step, and pool id to pool. */
  steps: Map<string, LWProcess.Step>; pools: Map<string, LWProcess.Resource>;
  /** Decision ids that close a counter loop. */
  counterLoops: Set<string>;
  /** Flow ids the main route follows. */
  mainFlows: Set<string>;
 }
 interface Api {
  /** 'Task', 'Machine step', 'Inclusive gateway', ... */
  kindLabel(step: LWProcess.Step): string;
  /** '6 tasks', '1 decision'. */
  kindCount(kind: LWProcess.Kind, n: number): string;
  stepBlocks(step: LWProcess.Step, context: Context): LWProcessSlides.Block[];
  concepts(step: LWProcess.Step, context: Context): LWProcessSlides.Concept[];
  /** 'One simulated run · business minute 1,440 · seed 7'. */
  liveHeading(snapshot: LWProcess.Snapshot): string;
  /** The run status in plain words: 'not started', 'still running', 'completed', 'blocked' or 'stopped at the time limit'. */
  statusText(snapshot: Pick<LWProcess.Snapshot, 'status'>): string;
  /**
   * One step's counters: its work now in the studio's words ('Now: 2 working, 3 waiting, 1 blocked …'), with blocked work said apart
   * from waiting work, and its waiting time; a completed run drops 'so far'.
   */
  stepLive(metric: LWProcess.StepMetric | undefined, snapshot: LWProcess.Snapshot, context: Context, step: LWProcess.Step): LWProcessSlides.Block;
  /**
   * The summary's run facts: status, counts, the work now at the steps while cases are in progress, mean cycle ('none yet' until a
   * case finishes), mean age, work and capacity cost, the most utilised pool.
   */
  runLive(snapshot: LWProcess.Snapshot, terms: LWProcessTerms.Terms, definition: LWProcess.Definition): LWProcessSlides.Block;
  /** The title slide's short 'Key results' block (heading starts 'Key results · '), with the work now at the steps while cases are in progress. */
  keyResults(snapshot: LWProcess.Snapshot, terms: LWProcessTerms.Terms, definition: LWProcess.Definition): LWProcessSlides.Block;
  /**
   * The resources slide's live facts: per pool, most utilised first, its utilisation, its units working (people) or running (machines
   * and systems) now and the work waiting and blocked at its steps.
   */
  resourcesLive(snapshot: LWProcess.Snapshot, definition: LWProcess.Definition): LWProcessSlides.Block;
  /** Whole numbers with thousands separators ('119,928'); other numbers keep their decimals (LWProcessTime.number). */
  number(n: number): string;
  /** 'People', 'Machine' or 'System'. */
  poolKind(pool: LWProcess.Resource): string;
  /** A duration in business minutes with the definition's display calendar (LWProcessTime.span). */
  span(minutes: number, definition: LWProcess.Definition): string;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessSlidesText?: LWProcessSlidesText.Api; LWProcessRandomView: LWProcessRandomView.Api; LWProcessTime: LWProcessTime.Api;
  LWProcessWorkState: LWProcessWorkState.Api};
 type Step = LWProcess.Step; type Ctx = LWProcessSlidesText.Context; type Block = LWProcessSlides.Block;
 const view = () => root.LWProcessRandomView, time = () => root.LWProcessTime;
 const KIND: Record<LWProcess.Kind, [string, string, string]> = {
  start: ['Start', 'start step', 'start steps'], task: ['Task', 'task', 'tasks'], touchpoint: ['Touchpoint', 'touchpoint', 'touchpoints'],
  machine: ['Machine step', 'machine step', 'machine steps'], system: ['System step', 'system step', 'system steps'], timer: ['Timer', 'timer', 'timers'],
  decision: ['Decision', 'decision', 'decisions'], fork: ['Fork', 'fork', 'forks'], join: ['Join', 'join', 'joins'], end: ['End', 'end step', 'end steps'],
 };
 const WORK = new Set<LWProcess.Kind>(['task', 'touchpoint', 'machine', 'system']);
 const POOL_KIND: Record<LWProcess.ResourceKind, string> = {people: 'People', machine: 'Machine', system: 'System'};
 const number = (n: number): string => time().number(n);
 const span = (n: number, d: LWProcess.Definition): string => time().span(n, d.calendar);
 /** True when the definition has a display calendar, so durations gain business days or weeks. */
 const dated = (d: LWProcess.Definition) => d.calendar !== undefined;
 const quote = (text: string) => `“${text}”`;
 const nameOf = (c: Ctx, id: string) => c.steps.get(id)?.name ?? id;
 const kindLabel = (s: Step): string => s.kind === 'fork' ? (s.mode === 'inclusive' ? 'Inclusive gateway' : 'Parallel fork') : KIND[s.kind]?.[0] ?? s.kind;
 const kindCount = (kind: LWProcess.Kind, n: number): string => `${number(n)} ${KIND[kind]?.[n === 1 ? 1 : 2] ?? kind}`;
 const poolKind = (pool: LWProcess.Resource): string => POOL_KIND[pool.kind ?? 'people'];
 const block = (heading: string, items: string[]): Block[] => items.length ? [{heading, items}] : [];
 /** Ends a phrase as a sentence. */
 const sentence = (text: string) => /[.!?]$/.test(text) ? text : text + '.';
 /** The kind-specific sentences of steps nobody works on. */
 function howItWorks(s: Step, c: Ctx): string[] {
  const {one, many} = c.terms, rv = view();
  if (s.kind === 'start') return [`Each ${one} begins here on arrival; no time passes and nobody works on it.`];
  if (s.kind === 'end') return [`The ${one} finishes here.`, ...s.outcome ? [`Outcome: ${rv.describeOutcome(s.outcome)}.`] : []];
  if (s.kind === 'decision') {
   const fallback = c.definition.flows.some(f => f.from === s.id && !f.when && f.on !== 'deadline');
   return [
    `Takes no time: the ${one} follows the first route below whose condition holds, checked in order.`,
    ...fallback ? ['The route without a condition is taken when no other applies.'] : [],
   ];
  }
  if (s.kind === 'fork') return [rv.describeFork(s), ...s.join ? [`Its join is ${quote(nameOf(c, s.join))}.`] : []];
  if (s.kind === 'join') {
   const fork = c.definition.steps.find(f => f.kind === 'fork' && f.join === s.id);
   const waits = fork
    ? `Waits until the branches started by ${quote(fork.name)} have arrived, then continues as one ${one}.`
    : `Waits for the branches of its fork, then continues as one ${one}.`;
   return [waits, ...s.backlog ? [backlogText(s, many)] : []];
  }
  if (s.kind === 'timer') {
   if (s.until !== undefined) return [`Waits until minute ${number(s.until)} of the run; nobody works on it and no capacity is used.`];
   const plain = `Waits ${number(s.duration ?? 0)} min`, waits = dated(c.definition) ? `Waits ${span(s.duration ?? 0, c.definition)}` : plain;
   return [s.timing ? rv.describeTiming(s, c.definition.calendar) : waits, 'Nobody works on it and no capacity is used.'];
  }
  return [];
 }
 /** The order a backlog releases its work in: 'oldest first', 'newest first' or 'by priority field ...'. */
 function backlogOrder(b: NonNullable<Step['backlog']>): string {
  if (b.order === 'lifo') return 'newest first';
  if (b.order === 'priority') return `by priority field ${b.priority ?? '?'}`;
  return 'oldest first';
 }
 function backlogText(s: Step, many: string): string {
  const b = s.backlog!, order = backlogOrder(b);
  const pull = b.pull !== undefined ? `; releases work while the next task has fewer than ${number(b.pull)} in progress` : '';
  return `Backlog: at most ${number(b.capacity)} ${many} wait here, taken ${order}${pull}.`;
 }
 function who(s: Step, c: Ctx): string[] {
  const entries = Object.entries(s.resources ?? {}), items = entries.map(([id, units]) => {
   const pool = c.pools.get(id);
   if (!pool) return `${id}: ${number(units)} units`;
   const each = `${number(units)} ${units === 1 ? 'unit' : 'units'} for each ${s.instances ? 'instance' : 'visit'}`;
   return `${pool.name} (${poolKind(pool).toLowerCase()}, capacity ${number(pool.capacity)}): ${each}`;
  });
  if (!entries.length) {
   items.push(s.kind === 'touchpoint'
    ? `No staff or system pool: the ${c.terms.one} acts alone and it never waits for capacity.`
    : 'No resource pool: it never waits for capacity.');
  }
  if (entries.length > 1) items.push('It starts only when every listed pool has a free unit at the same time.');
  if (s.technology) items.push(`Technology: ${s.technology}.`);
  return items;
 }
 function howLong(s: Step, c: Ctx): string[] {
  // A fixed duration reads in business days or weeks under a display calendar, and so do random timing and a deadline
  // through the shared phrases (LWProcessRandomView with the definition's calendar).
  const fixed = !s.timing && s.duration !== undefined && dated(c.definition) ? `Takes ${span(s.duration, c.definition)}` : '';
  const rv = view(), calendar = c.definition.calendar, items = [fixed || rv.describeTiming(s, calendar) || 'No duration authored.'];
  if (s.cost !== undefined) {
   const each = s.instances ? 'instance' : 'visit';
   items.push(`Fixed cost: ${number(s.cost)} simulated units for each ${each}; pools add their cost per minute while they work.`);
  }
  if (s.instances) items.push(rv.describeInstances(s));
  if (s.deadline) items.push(rv.describeDeadline(s, calendar));
  if (s.backlog) items.push(backlogText(s, c.terms.many));
  return items;
 }
 function needs(s: Step): string[] {
  const rv = view(), items = (s.needs ?? []).map(n => {
   const test = n.op !== undefined ? rv.describeWhen({field: n.field, op: n.op, value: n.value ?? null}).replace(/^If /, '') : '';
   if (n.label) return test ? `${n.label}: ${test}` : `${n.label}: field ${n.field} must be delivered earlier`;
   return test ? `Requires ${test}` : `Field ${n.field} must be delivered earlier`;
  });
  if (s.instances?.field !== undefined) items.push(`Reads the number of instances from field ${s.instances.field}.`);
  return items;
 }
 function delivers(s: Step): string[] {
  const rv = view(), items: string[] = [];
  for (const [field, value] of Object.entries(s.set ?? {})) items.push(`Sets ${field} to ${rv.scalar(value)}`);
  for (const d of s.draws ?? []) items.push(rv.describeDraw(d));
  for (const [field, n] of Object.entries(s.add ?? {})) items.push(n < 0 ? `Subtracts ${number(-n)} from ${field}` : `Adds ${number(n)} to ${field}`);
  for (const o of s.outputs ?? []) items.push(`Declared output: ${o.label ? `${o.label} (${o.field})` : o.field}`);
  return items;
 }
 function next(s: Step, c: Ctx): string[] {
  const rv = view(), flows = c.definition.flows.filter(f => f.from === s.id), several = flows.filter(f => f.on !== 'deadline').length > 1;
  return flows.map(f => {
   const target = quote(nameOf(c, f.to));
   const main = several && s.kind === 'decision' && c.mainFlows.has(f.id) ? ', main route' : '';
   const label = f.label ? ` (${quote(f.label)})` : '';
   if (f.on === 'deadline') return `Deadline path → ${target}${label}`;
   if (s.kind === 'decision') return `${rv.describeWhen(f.when, c.terms.many)} → ${target}${label}${main}`;
   if (s.kind === 'fork' && s.mode === 'inclusive') {
    const condition = f.when ? rv.describeWhen(f.when, c.terms.many) : 'When no other branch applies';
    return `${condition} → ${target}${label}`;
   }
   if (s.kind === 'fork') return `Branch → ${target}${label}`;
   return `Next → ${target}${label}`;
  });
 }
 function experience(s: Step, c: Ctx): Block[] {
  const rv = view(), items: string[] = [];
  if (s.channel) items.push(`Channel: ${rv.describeChannel(s.channel)}`);
  if (s.emotion !== undefined) items.push(`Expected feeling: ${rv.describeEmotion(s.emotion) || '?'} (${s.emotion > 0 ? '+' : ''}${s.emotion})`);
  if (s.pain) items.push(`Pain point: ${s.pain}`);
  if (s.opportunity) items.push(`Opportunity: ${s.opportunity}`);
  return block(c.terms.journey ? `${c.terms.One} experience` : 'Notes', items);
 }
 function stepBlocks(s: Step, c: Ctx): Block[] {
  const work = WORK.has(s.kind);
  return [
   ...block('How it works', howItWorks(s, c).map(sentence)),
   ...work ? block('Who or what does it', who(s, c).map(sentence)) : [],
   ...work ? block('How long', howLong(s, c).map(sentence)) : [],
   ...block('What it needs', needs(s).map(sentence)),
   ...block('What it delivers', delivers(s).map(sentence)),
   ...block('Where it goes next', next(s, c)),
   ...experience(s, c),
  ];
 }
 const CONCEPTS: [string, string, (s: Step, c: Ctx) => boolean, (t: LWProcessTerms.Terms) => string][] = [
  ['touchpoint', 'Touchpoint', s => s.kind === 'touchpoint',
   t => `A touchpoint is a moment where the ${t.one} interacts with the organisation on a channel such as a website or a phone call. `
    + `It runs like a task; staff or systems behind it are optional.`],
  ['machine-step', 'Machine step', s => s.kind === 'machine',
   () => 'A machine step is work done by equipment such as a robot arm or a packing line. '
    + 'It runs like a task but uses machine pools only; no real device is contacted.'],
  ['system-step', 'System step', s => s.kind === 'system',
   () => 'A system step is work done by software such as a CI pipeline or an API. '
    + 'It runs like a task but uses system pools only; no real system is contacted.'],
  ['timer', 'Timer', s => s.kind === 'timer',
   t => `A timer only waits: nobody works and no capacity is used, so any number of ${t.many} can wait at the same time.`],
  ['decision', 'Decision', s => s.kind === 'decision',
   t => `A decision takes no time. It checks its routes in order and sends the ${t.one} along the first one whose condition holds; `
    + `the route without a condition catches the rest.`],
  ['chance-route', 'Chance route', (s, c) => c.definition.flows.some(f => f.from === s.id && hasChance(f.when)),
   t => `A chance route is taken by a share of ${t.many}, like a roll of the dice. `
    + `Every ${t.one} gets its own draw from the run's seed, so the same seed always repeats the same run.`],
  ['counter-loop', 'Counter loop', (s, c) => c.counterLoops.has(s.id),
   t => `A counter loop repeats earlier steps: a step adds to a counter field, `
    + `and this decision sends the ${t.one} back while the counter has not reached its limit.`],
  ['parallel-fork', 'Parallel fork', s => s.kind === 'fork' && s.mode !== 'inclusive',
   t => `A parallel fork starts all of its branches at the same moment. The ${t.one} continues only when every branch has reached the join.`],
  ['inclusive-gateway', 'Inclusive gateway', s => s.kind === 'fork' && s.mode === 'inclusive',
   () => 'An inclusive gateway starts every branch whose condition holds, so one, several or all of them. '
    + 'Its join waits for exactly the branches that were started.'],
  ['join', 'Join', s => s.kind === 'join', t => `A join collects the branches started by its fork and lets the ${t.one} continue once they have all arrived.`],
  ['multi-instance-parallel', 'Multiple instances in parallel', s => s.instances?.mode === 'parallel',
   t => `The same work runs several times for one ${t.one}, all at once as far as capacity allows. The step is done when every instance is done.`],
  ['multi-instance-sequential', 'Multiple instances one after another', s => s.instances?.mode === 'sequential',
   t => `The same work runs several times for one ${t.one}, one instance after the other. The step is done when the last instance is done.`],
  ['deadline-escalate', 'Escalating deadline', s => s.deadline?.mode === 'escalate',
   () => 'An escalating deadline starts an extra path when the work runs late, while the work itself carries on to its normal next step.'],
  ['deadline-interrupt', 'Interrupting deadline', s => s.deadline?.mode === 'interrupt',
   t => `An interrupting deadline cancels the work when it runs late and sends the ${t.one} down the deadline path instead.`],
  ['backlog', 'Backlog', s => s.backlog !== undefined,
   () => 'A backlog is a bounded store of waiting work at the step. When it is full, earlier work holds until there is room again; '
    + 'it adds no capacity of its own.'],
 ];
 function hasChance(w: LWProcess.When | undefined): boolean {
  if (!w) return false;
  if (typeof w.chance === 'number') return true;
  return (w.all ?? w.any ?? []).some(hasChance) || (w.not !== undefined && hasChance(w.not));
 }
 const concepts = (s: Step, c: Ctx): LWProcessSlides.Concept[] => CONCEPTS
  .filter(([, , applies]) => applies(s, c))
  .map(([id, name, , text]) => ({id, name, text: text(c.terms)}));
 /** The run status in plain words: 'still running', 'completed', 'blocked', 'stopped at the time limit', 'not started'. */
 const STATUS: Record<LWProcess.Snapshot['status'], string> = {
  ready: 'not started', running: 'still running', completed: 'completed', blocked: 'blocked', limit: 'stopped at the time limit',
 };
 const statusText = (q: Pick<LWProcess.Snapshot, 'status'>): string => STATUS[q.status] ?? q.status;
 const liveHeading = (q: LWProcess.Snapshot): string => `One simulated run · business minute ${number(q.minute)} · seed ${q.seed}`;
 const units = (n: number) => number(Math.round(n * 100) / 100);
 /** The work now at some steps in the studio's words: '2 working, 1 running, 3 waiting, 1 blocked'. */
 const workNow = (d: LWProcess.Definition, q: LWProcess.Snapshot, stepIds?: string[]) =>
  root.LWProcessWorkState.parts(root.LWProcessWorkState.tally(d, q, stepIds), number).join(', ');
 function stepLive(m: LWProcess.StepMetric | undefined, q: LWProcess.Snapshot, c: Ctx, s: Step): Block {
  if (!m) return {heading: liveHeading(q), items: ['No facts for this step in this run.']};
  const t = c.terms, wait = span(m.waitMinutes, c.definition);
  // Blocked work finished here and is held; the inspector says the same: 'N blocked · waiting for room in the next backlog'.
  const blocked = m.held ? ' (blocked: waiting for room in the next backlog)' : '';
  const items = [`Entered ${number(m.entered)} ${m.entered === 1 ? 'time' : 'times'} by ${number(m.reached)} ${m.reached === 1 ? t.one : t.many}`,
   `Completed ${number(m.completed)} ${m.completed === 1 ? 'time' : 'times'}`, `Now: ${workNow(c.definition, q, [s.id])}${blocked}`,
   q.status === 'completed' ? `Waiting time: ${wait} in total` : `Waiting time so far: ${wait} in total`];
  if (m.timers.waiting) items.push(`Waiting on the timer now: ${number(m.timers.waiting)}`);
  if (m.items) items.push(`Instances started: ${number(m.items.started)}; finished: ${number(m.items.finished)}`);
  if (m.deadlines) items.push(`Deadlines fired: ${number(m.deadlines.interrupted)} interrupted, ${number(m.deadlines.escalated)} escalated`);
  return {heading: liveHeading(q), items};
 }
 /** Pools with their names, most utilised first (ties keep the definition order). */
 function ranked(q: LWProcess.Snapshot, d: LWProcess.Definition): {name: string; metric: LWProcess.PoolMetric; pct: number}[] {
  const names = new Map(d.resources.map(r => [r.id, r.name]));
  return q.resources.map((metric, i) => ({name: names.get(metric.id) ?? metric.id, metric, pct: Math.round(metric.utilization * 100), i}))
   .sort((a, b) => b.pct - a.pct || a.i - b.i);
 }
 const busiest = (q: LWProcess.Snapshot, d: LWProcess.Definition): string[] => {
  const top = ranked(q, d)[0]; return top ? [`Most utilised pool: ${top.name}, ${top.pct}% on average since minute 0`] : [];
 };
 /** The mean cycle time, or 'none yet' before any case finishes (a 0 min mean would read as instant work). */
 const cycle = (m: LWProcess.Snapshot['metrics'], t: LWProcessTerms.Terms, d: LWProcess.Definition) =>
  m.completed ? span(m.meanCycleMinutes, d) : `none yet, no ${t.one} has finished`;
 /** The work now at every step, only while cases are in progress (a finished run has none). */
 const atSteps = (q: LWProcess.Snapshot, d: LWProcess.Definition): string[] => q.metrics.active ? [`Now at the steps: ${workNow(d, q)}`] : [];
 function runLive(q: LWProcess.Snapshot, t: LWProcessTerms.Terms, d: LWProcess.Definition): Block {
  const m = q.metrics;
  const items = [`Run status: ${statusText(q)}`, `${t.Many} arrived: ${number(m.arrived)}`, `${t.finished}: ${number(m.completed)}`];
  items.push(`In progress: ${number(m.active)}`, ...atSteps(q, d));
  if (m.failed) items.push(`Failed: ${number(m.failed)}`);
  items.push(`Mean cycle time: ${cycle(m, t, d)}`);
  if (m.meanAgeMinutes !== null) items.push(`Mean age of the ${t.many} in progress: ${span(m.meanAgeMinutes, d)}`);
  items.push(`Work cost: ${units(m.cost)} units`, `Capacity cost: ${units(m.capacityCost)} units`, ...busiest(q, d));
  if (m.conversion !== null) items.push(`Conversion: ${m.conversion / 10}%`);
  for (const tracked of Object.values(m.tracked)) if (tracked.mean !== null) items.push(`${tracked.label} at the finish: mean ${tracked.mean}`);
  return {heading: liveHeading(q), items};
 }
 /** The title slide's 'Key results' of one run: arrivals, finished, cycle time, work cost and the most utilised pool. */
 function keyResults(q: LWProcess.Snapshot, t: LWProcessTerms.Terms, d: LWProcess.Definition): Block {
  const m = q.metrics, counts = `${t.Many} arrived: ${number(m.arrived)}; ${t.finished.toLowerCase()}: ${number(m.completed)}`;
  return {heading: `Key results · ${liveHeading(q)}`,
   items: [`Run status: ${statusText(q)}`, counts, ...atSteps(q, d), `Mean cycle time: ${cycle(m, t, d)}`, `Work cost: ${units(m.cost)} units`,
    ...busiest(q, d)]};
 }
 /** Live facts of the resources slide: every pool's average utilisation, busy units now and the work waiting at the steps that use it. */
 function resourcesLive(q: LWProcess.Snapshot, d: LWProcess.Definition): Block {
  const kinds = new Map(d.resources.map(r => [r.id, r.kind ?? 'people']));
  const at = (id: string) => root.LWProcessWorkState.tally(d, q, d.steps.filter(s => Object.hasOwn(s.resources ?? {}, id)).map(s => s.id));
  return {heading: liveHeading(q), items: ranked(q, d).map(({name, metric, pct}) => {
   // Units of a people pool are working; machine and system units are running, as on the studio's cards.
   const work = at(metric.id), verb = kinds.get(metric.id) === 'people' ? 'working' : 'running';
   return `${name}: ${pct}% average utilisation since minute 0, busy ${span(metric.busyMinutes, d)} in total; `
    + `${number(metric.busy)} of ${number(metric.capacity)} ${verb} now; ${number(work.waiting)} waiting`
    + `${work.blocked ? ` and ${number(work.blocked)} blocked` : ''} at its steps`;
  })};
 }
 root.LWProcessSlidesText = {kindLabel, kindCount, stepBlocks, concepts, liveHeading, statusText, stepLive, runLive, keyResults, resourcesLive,
  number, poolKind, span};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessSlidesText;
})(globalThis);
