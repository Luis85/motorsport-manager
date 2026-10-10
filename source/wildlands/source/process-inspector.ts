/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-html.ts" />
/// <reference path="./process-time.ts" />
/// <reference path="./process-advice.ts" />
/**
 * Inspector markup for Process Studio: the overview of the whole process, the details of one selected step and the shared
 * resource bars. Pure functions from a detached view (`LWProcessApp.View`) to HTML strings built with LWProcessHtml's `html`
 * template (every value from the definition or the run is escaped); no DOM access, no session, clock or storage. Random
 * behaviour is worded by LWProcessRandomView so the inspector, the editors and the activity list agree.
 *
 * Durations (step durations, waits, mean cycle and mean age) are worded by `LWProcessTime.span` with the definition's display
 * calendar, so they read '240 min (≈ 4 h)' or, with a calendar, '2,400 min (5 business days)'; clock points ('Until minute
 * 200', 'next due minute 45') stay minutes. The random timing, deadline and arrival sentences of LWProcessRandomView get the
 * same calendar, so their planned durations, deadline times and arrival gaps read the same way. The read model's analytics are
 * shown where they answer a question, kept short (the Dashboard view holds the full analytics): per work step the mean wait
 * per start ('—' before the first start) and the work cost split into fixed cost and pool-minute cost; per pool the work cost
 * against the capacity cost and the idle cost (capacity cost − work cost); in the overview the throughput per business hour
 * ('—' at minute 0) and, when `LWProcessAdvice.advise` reports any, a short Notes list. A step with random timing adds its
 * whole-minute rounding note (`LWProcessRandomView.roundingNote`) beside Random timing.
 */
declare namespace LWProcessInspector {
 interface Api {
  /**
   * Whole-process facts: description (clamped to three lines until `moreOpen`), counts, revision, seed, throughput per business
   * hour, tracked measures, multiple-instance, deadline and inclusive-fork totals (only when present), modelling notes (only
   * when there are any) and the arrival streams.
   */
  overview(view: LWProcessApp.View, moreOpen: boolean): string;
  /**
   * One step: description, timing, work counts, queue time, mean wait per start and work cost (work steps), branching, multiple
   * instances and deadline (with their live counters), random timing with its rounding note and outcomes, needs, outputs,
   * backlog and the steps that can follow.
   */
  step(view: LWProcessApp.View, step: LWProcess.Step): string;
  /**
   * The KPI strip cells under the stage: counts, mean cycle ('—' until a case finishes), mean age in progress, work cost and capacity cost,
   * plus goals, lost, conversion and up to two tracked measures for journeys. HTML without the seed note. Times use the display calendar.
   */
  kpis(view: LWProcessApp.View): string;
  /**
   * Shared resources as utilisation meters, each with its work cost against its capacity cost and the idle cost, then one sentence
   * on work and capacity cost. The percentage is the average utilisation since minute 0 and the busy count is right now; both are
   * text, so colour is never the only signal.
   */
  pools(view: LWProcessApp.View): string;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessNeeds: LWProcessNeeds.Api; LWProcessRandomView: LWProcessRandomView.Api; LWProcessTerms: LWProcessTerms.Api;
  LWProcessHtml: LWProcessHtml.Api; LWProcessTime: LWProcessTime.Api; LWProcessAdvice: LWProcessAdvice.Api; LWProcessInspector?: LWProcessInspector.Api};
 type Safe = LWProcessHtml.Safe;
 // Resolved per call, so the module can be loaded before LWProcessHtml in Node checks.
 const html = (strings: TemplateStringsArray, ...values: unknown[]): Safe => root.LWProcessHtml.html(strings, ...values);
 const num = (n: number) => Number(n.toFixed(1)).toLocaleString();
 /** A duration in the definition's words (LWProcessTime.span with its display calendar). */
 const span = (d: LWProcess.Definition, n: number) => root.LWProcessTime.span(n, d.calendar);
 const works = (s: LWProcess.Step) => s.kind === 'task' || s.kind === 'machine' || s.kind === 'system';
 const automated = (s: LWProcess.Step) => s.kind === 'machine' || s.kind === 'system';
 /** Steps whose work starts are counted by the ledger: they have a mean wait per start and a work cost. */
 const working = (s: LWProcess.Step) => works(s) || s.kind === 'touchpoint';
 /** Up to `limit` tracked finish averages with data, in the definition's declared order. */
 function trackedFinish(view: LWProcessApp.View) {
  const finish = view.snapshot.metrics.tracked;
  return (view.definition.track ?? []).flatMap(t => {
   const f = finish[t.field];
   return f && f.n > 0 && f.mean !== null ? [{field: t.field, label: f.label, mean: f.mean, min: f.min, max: f.max, n: f.n}] : [];
  });
 }
 const dec = (n: number) => Number(n.toFixed(2)).toLocaleString();
 function kpis(view: LWProcessApp.View): string {
  const m = view.snapshot.metrics, d = view.definition, t = root.LWProcessTerms.of(d), cells: [string, string][] = [[t.finished, num(m.completed)]];
  const conversion = (m.conversion! / 10).toFixed(1) + '%';
  const outcomes: [string, string][] = m.goals + m.lost > 0 ? [['Goals', num(m.goals)], ['Lost', num(m.lost)], ['Conversion', conversion]] : [];
  // Mean cycle covers finished cases only: '—' until one finishes, with the mean age of the cases still in progress beside it.
  const age = m.meanAgeMinutes === null ? '—' : span(d, m.meanAgeMinutes);
  const cycle = m.completed ? span(d, m.meanCycleMinutes) : '—';
  cells.push(...outcomes, ['In progress', num(m.active)], ['Mean cycle', cycle], ['Mean age in progress', age]);
  cells.push(['Work cost', num(m.cost)], ['Capacity cost', num(m.capacityCost)], ['Failed', num(m.failed)]);
  if (m.dropped > 0) cells.push(['Dropped', num(m.dropped)]);
  cells.push(...trackedFinish(view).slice(0, 2).map((x): [string, string] => [x.label + ' (avg)', dec(x.mean)]));
  return String(html`${cells.map(([label, value]) => html`<div><span>${label}</span><strong>${value}</strong></div>`)}`);
 }
 function needsHtml(view: LWProcessApp.View, step: LWProcess.Step): Safe {
  const delivered = [...Object.entries(step.set ?? {}).map(([k, v]) => html`<li>${k} = ${JSON.stringify(v)}</li>`),
   ...Object.entries(step.add ?? {}).map(([k, n]) => html`<li>${n >= 0 ? '+' : '−'}${Math.abs(n)} to ${k} (counter)</li>`)];
  const deliveries = root.LWProcessNeeds.deliveries(view.definition, step.id), names = new Map(view.definition.steps.map(s => [s.id, s.name]));
  const needs = (step.needs ?? []).map((n, i) => {
   const from = deliveries[i]!, arrival = from.arrivals ? [root.LWProcessTerms.of(view.definition).one + ' arrival'] : [];
   const who = [...from.steps.map(id => names.get(id)!), ...arrival], source = who.length ? 'Delivered by ' + who.join(', ') : 'No earlier delivery';
   return html`<li><strong>${root.LWProcessNeeds.describe(n)}</strong>${n.label ? ' · ' + n.label : ''}<small>${source}</small></li>`;
  });
  const wanted = needs.length ? html`<h3>Needs from earlier steps</h3><ul class="process-needs">${needs}</ul>` : '';
  return html`${wanted}${delivered.length ? html`<h3>Delivers</h3><ul class="process-needs">${delivered}</ul>` : ''}`;
 }
 function timingHtml(d: LWProcess.Definition, step: LWProcess.Step, m: LWProcess.StepMetric): Safe {
  if (step.kind !== 'timer') {
   const label = step.kind === 'machine' ? 'Cycle time' : step.kind === 'system' ? 'Run time' : 'Duration';
   return html`${row(label, span(d, step.duration ?? 0))}${step.technology ? row('Technology', step.technology) : ''}`;
  }
  const rule = step.until !== undefined ? `Until minute ${num(step.until)}` : `Wait ${span(d, step.duration ?? 0)}`;
  const status = m.timers.waiting ? `Waiting on timer · ${m.timers.waiting} waiting, next due minute ${num(m.timers.nextDue!)}` : 'No timers waiting';
  return html`${row('Timer', rule)}${row('Status', status)}`;
 }
 function outputsHtml(step: LWProcess.Step, q: LWProcess.Snapshot): Safe | '' {
  if (!step.outputs?.length) return '';
  const seen = [...q.receipts].reverse().find(r => r.stepId === step.id);
  const items = step.outputs.map(o => {
   const observed = seen && Object.hasOwn(seen.output, o.field) ? 'Last observed: ' + JSON.stringify(seen.output[o.field]) : 'Not observed yet';
   return html`<li><strong>${o.label ?? o.field}</strong>${o.label ? html` · <code>${o.field}</code>` : ''}<small>${observed}</small></li>`;
  });
  return html`<h3>Declared outputs</h3><ul class="process-needs">${items}</ul>`;
 }
 function backlogHtml(step: LWProcess.Step, q: LWProcess.Snapshot): Safe | '' {
  const b = step.backlog;
  if (!b) return '';
  const items = q.tokens.filter(t => t.stepId === step.id && (t.status === 'backlog' || works(step) && t.status === 'queued')).length;
  const blocked = q.tokens.filter(t => t.status === 'held' && t.target === step.id).length;
  const order = b.order === 'priority' ? 'Highest ' + b.priority + ' first' : b.order === 'lifo' ? 'Newest first' : 'Oldest first';
  const pull = b.pull !== undefined ? row('Pull limit', `${b.pull} in next step`) : '';
  return html`<h3>Backlog</h3><dl>${row('Items / capacity', `${items} / ${b.capacity}`)}${row('Order', order)}${pull}${row('Blocked upstream', blocked)}</dl>`;
 }
 /**
  * 'Random timing' (with its whole-minute rounding note) and 'Random outcomes' in the same sentences the editors use; '' for a
  * deterministic step. The timing sentence words its durations with the definition's display calendar.
  */
 function randomHtml(d: LWProcess.Definition, step: LWProcess.Step): Safe {
  const v = root.LWProcessRandomView, rounding = step.timing ? v.roundingNote(step.timing) : null;
  const note = rounding ? html`<p class="process-rounding">${rounding}</p>` : '';
  const timing = step.timing ? html`<h3>Random timing</h3><p class="process-random">${v.describeTiming(step, d.calendar)}</p>${note}` : '';
  const outcomes = (step.draws ?? []).map(d => html`<li>${v.describeDraw(d)}</li>`);
  const draws = outcomes.length ? html`<h3>Random outcomes</h3><ul class="process-adds">${outcomes}</ul>` : '';
  return html`${timing}${draws}`;
 }
 /** The deadline flow in the 2D map's own words: 'Deadline path (escalates: the work keeps going)'. */
 const deadlinePath = (mode: LWProcess.Deadline['mode']) =>
  `Deadline path (${mode === 'escalate' ? 'escalates: the work keeps going' : 'interrupts: the work is cancelled'})`;
 /**
  * The next steps. A decision's routes also say how they are chosen; chance routes show their share and the fallback shows what is
  * left. An inclusive fork's branches show their condition (each is tested on its own, so no shares are summed) and a deadline flow
  * says it is the deadline path.
  */
 function nextHtml(view: LWProcessApp.View, step: LWProcess.Step): Safe {
  const d = view.definition, out = d.flows.filter(f => f.from === step.id), v = root.LWProcessRandomView, many = root.LWProcessTerms.of(d).many;
  const chances = out.filter(f => typeof f.when?.chance === 'number'), conditions = out.filter(f => f.when && typeof f.when.chance !== 'number');
  const left = chances.length && !conditions.length ? 100 - chances.reduce((sum, f) => sum + (f.when!.chance as number), 0) : undefined;
  const branch = (f: LWProcess.Flow) => f.when ? v.describeWhen(f.when, many) : 'Default branch: taken only when no condition is true';
  const how = (f: LWProcess.Flow): string => {
   if (f.on === 'deadline' && step.deadline) return deadlinePath(step.deadline.mode);
   if (step.kind === 'fork' && step.mode === 'inclusive') return branch(f);
   if (step.kind !== 'decision') return '';
   if (f.when) return v.describeWhen(f.when, many);
   return left !== undefined ? `Otherwise, ${Math.round(left * 10) / 10}% of ${many}` : 'Otherwise';
  };
  const buttons = out.map(f => {
   const reason = how(f), target = d.steps.find(s => s.id === f.to)!.name;
   const why = reason ? html`<small>${reason}</small>` : '';
   return html`<button class="next-step" data-next="${f.to}">${target}${f.label ? ' · ' + f.label : ''}${why}</button>`;
  });
  return buttons.length ? html`${buttons}` : html`<p>Process ends here.</p>`;
 }
 /**
  * Journey annotations of a step (phase, channel, feeling, pain, opportunity, end outcome) and its funnel and tracked averages.
  * '' when there is nothing to say.
  */
 function journeyHtml(view: LWProcessApp.View, s: LWProcess.Step, m: LWProcess.StepMetric): Safe {
  const v = root.LWProcessRandomView, t = root.LWProcessTerms.of(view.definition), rows: Safe[] = [];
  const add = (k: string, value: unknown) => rows.push(row(k, value));
  if (s.phase) add('Phase', s.phase);
  if (v.describeChannel(s.channel)) add('Channel', v.describeChannel(s.channel));
  if (v.describeEmotion(s.emotion)) add('Feeling', v.describeEmotion(s.emotion) + ' (' + (s.emotion! > 0 ? '+' : '') + s.emotion + ')');
  if (v.describeOutcome(s.outcome)) add('Ends as', html`<span class="process-outcome ${s.outcome}">${v.describeOutcome(s.outcome)}</span>`);
  if (t.journey) {
   add('Reached', `${num(m.reached)} ${m.reached === 1 ? t.one : t.many}`);
   add('Entered', `${num(m.entered)} ${m.entered === 1 ? 'time' : 'times'}`);
  }
  for (const x of view.definition.track ?? []) {
   const e = m.tracked[x.field];
   if (e && e.n > 0 && e.mean !== null) add(`Average ${x.label ?? x.field} on entry`, dec(e.mean));
  }
  const pain = s.pain ? html`<h3>Pain point</h3><p>${s.pain}</p>` : '', chance = s.opportunity ? html`<h3>Opportunity</h3><p>${s.opportunity}</p>` : '';
  return html`${rows.length ? html`<h3>${t.journey ? 'Journey' : 'Annotations'}</h3><dl class="process-journey">${rows}</dl>` : ''}${pain}${chance}`;
 }
 /** One label and value of a description list; the value is escaped unless it is already markup. */
 const row = (label: string, value: unknown) => html`<dt>${label}</dt><dd>${value}</dd>`;
 /**
  * BPMN-class behaviour of one step in the editors' sentences: fork branching and its join, multiple instances with the cumulative
  * item counters, the visits running now and the item count of the latest completed visit, and the boundary deadline with its
  * path, firing counters and the next pending deadline minute. '' for a step with none of them.
  */
 function logicHtml(view: LWProcessApp.View, s: LWProcess.Step, m: LWProcess.StepMetric): Safe {
  const v = root.LWProcessRandomView, d = view.definition, q = view.snapshot, name = (id: string | undefined) => d.steps.find(x => x.id === id)?.name;
  const parts: Safe[] = [];
  if (s.kind === 'fork') {
   const join = name(s.join) ? html`<dl>${row('Joins at', name(s.join))}</dl>` : '';
   parts.push(html`<h3>Branching</h3><p class="process-random">${v.describeFork(s)}</p>${join}`);
  }
  if (s.instances) {
   const items = m.items ?? {started: 0, finished: 0}, last = [...q.receipts].reverse().find(r => r.stepId === s.id && r.instances !== undefined);
   const visits = new Set(q.tokens.filter(t => t.stepId === s.id && t.group !== undefined).map(t => t.group)).size;
   const latest = last ? row('Latest completed visit', `${num(last.instances!)} ${last.instances === 1 ? 'item' : 'items'}`) : '';
   const done = html`${row('Items started', num(items.started))}${row('Items finished', num(items.finished))}`;
   const counts = html`${done}${row('Visits in progress', num(visits))}${latest}`;
   parts.push(html`<h3>Multiple instances</h3><p class="process-random">${v.describeInstances(s)}</p><dl>${counts}</dl>`);
  }
  if (s.deadline) {
   const fired = m.deadlines ?? {interrupted: 0, escalated: 0}, target = name(d.flows.find(f => f.id === s.deadline!.flow)?.to);
   const pending = q.tokens.filter(t => t.stepId === s.id && t.deadlineAt !== undefined).map(t => t.deadlineAt!);
   const next = pending.length ? row('Next deadline', `Minute ${num(Math.min(...pending))}${pending.length > 1 ? ` · ${pending.length} pending` : ''}`) : '';
   const path = target ? row('Deadline path to', target) : '';
   const counts = html`${path}${row('Escalated', num(fired.escalated))}${row('Interrupted', num(fired.interrupted))}${next}`;
   parts.push(html`<h3>Deadline</h3><p class="process-random">${v.describeDeadline(s, d.calendar)}</p><dl>${counts}</dl>`);
  }
  return html`${parts}`;
 }
 /**
  * 'Blocked after finishing': work done here that waits for room in the next step's backlog; shown when a next step has a backlog
  * or work is blocked.
  */
 function blockedHtml(view: LWProcessApp.View, s: LWProcess.Step, m: LWProcess.StepMetric): Safe | '' {
  const d = view.definition, next = d.flows.filter(f => f.from === s.id).map(f => d.steps.find(x => x.id === f.to));
  return next.some(x => x?.backlog) || m.held > 0 ? row('Blocked after finishing', `${num(m.held)} blocked · waiting for room in the next backlog`) : '';
 }
 /**
  * Mean wait per start ('—' before the first start) and the work cost so far, split into the fixed cost charged at each start and
  * the cost of the pool minutes worked here (the read model's `meanWaitMinutes`, `fixedCost` and `workCost`); '' for other steps.
  */
 function analyticsHtml(d: LWProcess.Definition, s: LWProcess.Step, m: LWProcess.StepMetric): Safe | '' {
  if (!working(s)) return '';
  const wait = m.meanWaitMinutes === null ? '—' : span(d, m.meanWaitMinutes);
  const cost = `${num(m.workCost)} = ${num(m.fixedCost)} fixed + ${num(m.workCost - m.fixedCost)} for pool minutes`;
  return html`${row('Mean wait per start', wait)}${row('Work cost', cost)}`;
 }
 function step(view: LWProcessApp.View, s: LWProcess.Step): string {
  const d = view.definition, q = view.snapshot, m = q.steps.find(m => m.id === s.id)!;
  const busy = (s.instances ? 'Items ' : '') + (automated(s) ? 'running / waiting' : 'working / waiting');
  const auto = automated(s) ? html`<p class="process-auto">Runs automatically${s.technology ? ' on ' + s.technology : ''}. No people are needed.</p>` : '';
  const counts = row(busy[0]!.toUpperCase() + busy.slice(1), `${m.active} / ${m.queued - m.held}`);
  const facts = html`${timingHtml(d, s, m)}${counts}${blockedHtml(view, s, m)}${row('Completed visits', num(m.completed))}`;
  const costs = html`${row('Total queue time', span(d, m.waitMinutes))}${analyticsHtml(d, s, m)}${row('Fixed cost per visit', num(s.cost ?? 0))}`;
  const sections = html`${journeyHtml(view, s, m)}${logicHtml(view, s, m)}${randomHtml(d, s)}${needsHtml(view, s)}${outputsHtml(s, q)}${backlogHtml(s, q)}`;
  return String(html`<p>${s.description ?? s.name}</p>${auto}<dl>${facts}${costs}</dl>${sections}<h3>Next steps</h3>${nextHtml(view, s)}`);
 }
 /** Counts of the BPMN-class steps with their cumulative item and deadline counters; '' when the process has none. */
 function logicSummary(view: LWProcessApp.View): Safe | '' {
  const d = view.definition, metrics = new Map(view.snapshot.steps.map(m => [m.id, m]));
  const many = (n: number, one: string) => `${num(n)} ${n === 1 ? one : one + 's'}`;
  const multi = d.steps.filter(s => s.instances), late = d.steps.filter(s => s.deadline);
  const inclusive = d.steps.filter(s => s.kind === 'fork' && s.mode === 'inclusive');
  const total = (list: LWProcess.Step[], pick: (m: LWProcess.StepMetric) => number) => list.reduce((n, s) => n + pick(metrics.get(s.id)!), 0);
  const items = () => {
   const started = num(total(multi, m => m.items?.started ?? 0)), finished = num(total(multi, m => m.items?.finished ?? 0));
   return `${many(multi.length, 'step')} · ${started} items started · ${finished} finished`;
  };
  const deadlines = () => {
   const escalated = num(total(late, m => m.deadlines?.escalated ?? 0)), interrupted = num(total(late, m => m.deadlines?.interrupted ?? 0));
   return `${many(late.length, 'step')} · ${escalated} escalated · ${interrupted} interrupted`;
  };
  const rows = [
   multi.length ? row('Multiple instances', items()) : '',
   late.length ? row('Deadlines', deadlines()) : '',
   inclusive.length ? row('Inclusive forks', many(inclusive.length, 'fork')) : '',
  ].filter(Boolean);
  return rows.length ? html`<h3>Instances, deadlines and forks</h3><dl class="process-tracked">${rows}</dl>` : '';
 }
 /** Where an advisory points, in the definition's words: 'Review, random timing', 'Arrival 1, random gap'. */
 function adviceAt(d: LWProcess.Definition, path: string): string {
  const step = /^\/steps\/(\d+)\/(deadline\/)?timing$/.exec(path), arrival = /^\/arrivals\/(\d+)\/gap$/.exec(path);
  if (step) return `${d.steps[Number(step[1])]?.name ?? 'A step'}, ${step[2] ? 'deadline time' : 'random timing'}`;
  return arrival ? `Arrival ${Number(arrival[1]) + 1}, random gap` : 'The process';
 }
 /** The non-blocking modelling notes of LWProcessAdvice as a short list; '' when there are none. */
 function notesHtml(d: LWProcess.Definition): Safe | '' {
  const notes = root.LWProcessAdvice.advise(d);
  if (!notes.length) return '';
  const items = notes.map(n => html`<li>${adviceAt(d, n.path)}: ${n.message}</li>`);
  return html`<h3>Notes</h3><ul class="process-adds process-notes" aria-label="Modelling notes">${items}</ul>`;
 }
 function overview(view: LWProcessApp.View, moreOpen: boolean): string {
  const d = view.definition, seed = view.snapshot.seed, v = root.LWProcessRandomView, t = root.LWProcessTerms.of(d), tracked = trackedFinish(view);
  const text = d.description ?? `${t.Many} move through the process. Run the simulation to see work, queues and resource contention.`;
  // Completed cases per 60 business minutes since minute 0: '1 case finished per business hour', '0.5 cases …', '—' at minute 0.
  const perHour = view.snapshot.metrics.throughputPerHour, rate = perHour === null ? '' : dec(perHour);
  const throughput = perHour === null ? '—' : `${rate} ${rate === '1' ? t.one : t.many} finished per business hour`;
  const seedText = `${seed}${seed !== (d.seed ?? 1) ? ' · set for this run' : ''}`;
  const facts = html`${row('Steps', d.steps.length)}${row('Connections', d.flows.length)}${row('Revision', d.revision)}${row('Seed', seedText)}`;
  const kind = t.journey ? row('Process type', t.label) : '';
  const measures = tracked.map(x => row(x.label, `${dec(x.mean)} average · ${dec(x.min!)} to ${dec(x.max!)} · ${num(x.n)} ${x.n === 1 ? t.one : t.many}`));
  const streams = d.arrivals.map(a => html`<li>${v.describeArrival(a, t, d.calendar)}</li>`);
  const arrivals = streams.length ? html`<ul class="process-adds" aria-label="Arrival streams">${streams}</ul>` : html`<p>No arrivals defined.</p>`;
  const toggle = html`type="button" id="desc-more" class="process-more" aria-controls="process-desc" aria-expanded="${moreOpen}" hidden`;
  const more = html`<button ${toggle}>${moreOpen ? 'Less' : 'More'}</button>`;
  const measured = tracked.length ? html`<h3>Tracked measures</h3><dl class="process-tracked">${measures}</dl>` : '';
  return String(html`<p id="process-desc" class="process-desc${moreOpen ? ' open' : ''}">${text}</p>${more}
   <dl>${facts}${row('Throughput', throughput)}${kind}</dl>${measured}${logicSummary(view)}${notesHtml(d)}
   <h3>Arrivals</h3>${arrivals}`);
 }
 /** One plain sentence under the meters that tells the two KPI costs apart. */
 const COST_NOTE = '<p class="process-cost-note">Work cost charges pools only for the minutes they work, plus fixed step costs. '
  + 'Capacity cost charges every pool unit for every minute, busy or idle. Both are simulated units, not money. '
  + 'Idle cost is capacity cost minus work cost.</p>';
 function pools(view: LWProcessApp.View): string {
  const d = view.definition;
  const meters = view.snapshot.resources.map(p => {
   const name = d.resources.find(r => r.id === p.id)!.name, pct = Math.round(p.utilization * 100), level = pct >= 85 ? 'hot' : pct >= 70 ? 'warm' : 'ok';
   const text = `${pct}% average utilisation since minute 0${level === 'hot' ? ', nearly full' : ''}; ${p.busy} of ${p.capacity} busy now`;
   const meter = html`role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-valuetext="${text}" aria-label="${name} utilisation"`;
   const bar = html`<div class="pool-bar" data-level="${level}" ${meter}><i style="width:${Math.min(100, pct)}%"></i></div>`;
   const cost = `Work cost ${num(p.workCost)} of ${num(p.capacityCost)} capacity cost · idle cost ${num(p.capacityCost - p.workCost)}`;
   const head = html`<div class="pool-head"><strong>${name}</strong><span class="pool-pct">${pct}%</span></div>`;
   const now = html`<small>Average since minute 0 · ${p.busy}/${p.capacity} busy now</small>`;
   return html`<div class="process-pool">${head}${bar}${now}<div class="pool-cost"><small>${cost}</small></div></div>`;
  });
  return meters.length ? String(html`${meters}`) + COST_NOTE : '<p>No shared resources defined.</p>';
 }
 root.LWProcessInspector = {overview, step, kpis, pools};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessInspector;
})(globalThis);
