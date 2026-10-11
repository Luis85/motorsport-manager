/// <reference path="./process-contracts.d.ts" />
/**
 * Inspector markup for Process Studio: the overview of the whole process, the details of one selected step and the shared
 * resource bars. Pure functions from a detached view (`LWProcessApp.View`) to escaped HTML strings; no DOM access, no session,
 * clock or storage. Random behaviour is worded by LWProcessRandomView so the inspector, the editors and the activity list agree.
 */
declare namespace LWProcessInspector {
 interface Api {
  /** Whole-process facts: description (clamped to three lines until `moreOpen`), counts, revision, seed, multiple-instance, deadline and inclusive-fork totals (only when present) and the arrival streams. */
  overview(view: LWProcessApp.View, moreOpen: boolean): string;
  /** One step: description, timing, branching, multiple instances and deadline (with their live counters), random timing and outcomes, needs, outputs, backlog and the steps that can follow. */
  step(view: LWProcessApp.View, step: LWProcess.Step): string;
  /**
   * The KPI strip cells under the stage: counts, mean cycle ('—' until a case finishes), mean age in progress, work cost and capacity cost,
   * plus goals, lost, conversion and up to two tracked measures for journeys. HTML without the seed note.
   */
  kpis(view: LWProcessApp.View): string;
  /**
   * Shared resources as utilisation meters, then one sentence on work and capacity cost. The percentage is the average utilisation
   * since minute 0 and the busy count is right now; both are text, so colour is never the only signal.
   */
  pools(view: LWProcessApp.View): string;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessNeeds: LWProcessNeeds.Api; LWProcessRandomView: LWProcessRandomView.Api; LWProcessTerms: LWProcessTerms.Api; LWProcessInspector?: LWProcessInspector.Api};
 const esc = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
 const num = (n: number) => Number(n.toFixed(1)).toLocaleString();
 const works = (s: LWProcess.Step) => s.kind === 'task' || s.kind === 'machine' || s.kind === 'system', automated = (s: LWProcess.Step) => s.kind === 'machine' || s.kind === 'system';
 /** Up to `limit` tracked finish averages with data, in the definition's declared order. */
 function trackedFinish(view: LWProcessApp.View) {
  const finish = view.snapshot.metrics.tracked;
  return (view.definition.track ?? []).flatMap(t => { const f = finish[t.field]; return f && f.n > 0 && f.mean !== null ? [{field: t.field, label: f.label, mean: f.mean, min: f.min, max: f.max, n: f.n}] : []; });
 }
 const dec = (n: number) => Number(n.toFixed(2)).toLocaleString();
 function kpis(view: LWProcessApp.View): string {
  const m = view.snapshot.metrics, t = root.LWProcessTerms.of(view.definition), cells: string[][] = [[t.finished, num(m.completed)]];
  const outcomes = m.goals + m.lost > 0 ? [['Goals', num(m.goals)], ['Lost', num(m.lost)], ['Conversion', (m.conversion! / 10).toFixed(1) + '%']] : [];
  // Mean cycle covers finished cases only: '—' until one finishes, with the mean age of the cases still in progress beside it.
  const age = m.meanAgeMinutes === null ? '—' : num(m.meanAgeMinutes) + ' min';
  const cycle = m.completed ? num(m.meanCycleMinutes) + ' min' : '—';
  cells.push(...outcomes, ['In progress', num(m.active)], ['Mean cycle', cycle], ['Mean age in progress', age]);
  cells.push(['Work cost', num(m.cost)], ['Capacity cost', num(m.capacityCost)], ['Failed', num(m.failed)]);
  if (m.dropped > 0) cells.push(['Dropped', num(m.dropped)]);
  cells.push(...trackedFinish(view).slice(0, 2).map(x => [esc(x.label) + ' (avg)', dec(x.mean)]));
  return cells.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('');
 }
 function needsHtml(view: LWProcessApp.View, step: LWProcess.Step): string {
  const delivered = [...Object.entries(step.set ?? {}).map(([k, v]) => `<li>${esc(k)} = ${esc(JSON.stringify(v))}</li>`), ...Object.entries(step.add ?? {}).map(([k, n]) => `<li>${n >= 0 ? '+' : '−'}${Math.abs(n)} to ${esc(k)} (counter)</li>`)].join('');
  const deliveries = root.LWProcessNeeds.deliveries(view.definition, step.id), names = new Map(view.definition.steps.map(s => [s.id, s.name]));
  const needs = (step.needs ?? []).map((n, i) => { const from = deliveries[i]!, who = [...from.steps.map(id => names.get(id)!), ...from.arrivals ? [root.LWProcessTerms.of(view.definition).one + ' arrival'] : []];
   return `<li><strong>${esc(root.LWProcessNeeds.describe(n))}</strong>${n.label ? ' · ' + esc(n.label) : ''}<small>${who.length ? 'Delivered by ' + esc(who.join(', ')) : 'No earlier delivery'}</small></li>`; }).join('');
  return (needs ? `<h3>Needs from earlier steps</h3><ul class="process-needs">${needs}</ul>` : '') + (delivered ? `<h3>Delivers</h3><ul class="process-needs">${delivered}</ul>` : '');
 }
 function timingHtml(step: LWProcess.Step, m: LWProcess.StepMetric): string {
  if (step.kind !== 'timer') return `<dt>${step.kind === 'machine' ? 'Cycle time' : step.kind === 'system' ? 'Run time' : 'Duration'}</dt><dd>${num(step.duration ?? 0)} min</dd>${step.technology ? `<dt>Technology</dt><dd>${esc(step.technology)}</dd>` : ''}`;
  const rule = step.until !== undefined ? `Until minute ${num(step.until)}` : `Wait ${num(step.duration ?? 0)} min`;
  return `<dt>Timer</dt><dd>${rule}</dd><dt>Status</dt><dd>${m.timers.waiting ? `Waiting on timer · ${m.timers.waiting} waiting, next due minute ${num(m.timers.nextDue!)}` : 'No timers waiting'}</dd>`;
 }
 function outputsHtml(step: LWProcess.Step, q: LWProcess.Snapshot): string {
  if (!step.outputs?.length) return '';
  const seen = [...q.receipts].reverse().find(r => r.stepId === step.id);
  return `<h3>Declared outputs</h3><ul class="process-needs">${step.outputs.map(o => `<li><strong>${esc(o.label ?? o.field)}</strong>${o.label ? ` · <code>${esc(o.field)}</code>` : ''}<small>${seen && Object.hasOwn(seen.output, o.field) ? 'Last observed: ' + esc(JSON.stringify(seen.output[o.field])) : 'Not observed yet'}</small></li>`).join('')}</ul>`;
 }
 function backlogHtml(step: LWProcess.Step, q: LWProcess.Snapshot): string {
  const b = step.backlog; if (!b) return '';
  const items = q.tokens.filter(t => t.stepId === step.id && (t.status === 'backlog' || works(step) && t.status === 'queued')).length, blocked = q.tokens.filter(t => t.status === 'held' && t.target === step.id).length;
  return `<h3>Backlog</h3><dl><dt>Items / capacity</dt><dd>${items} / ${b.capacity}</dd><dt>Order</dt><dd>${esc(b.order === 'priority' ? 'Highest ' + b.priority + ' first' : b.order === 'lifo' ? 'Newest first' : 'Oldest first')}</dd>${b.pull !== undefined ? `<dt>Pull limit</dt><dd>${b.pull} in next step</dd>` : ''}<dt>Blocked upstream</dt><dd>${blocked}</dd></dl>`;
 }
 /** 'Random timing' and 'Random outcomes' in the same sentences the editors use; '' for a deterministic step. */
 function randomHtml(step: LWProcess.Step): string {
  const v = root.LWProcessRandomView;
  return (step.timing ? `<h3>Random timing</h3><p class="process-random">${esc(v.describeTiming(step))}</p>` : '') +
   (step.draws?.length ? `<h3>Random outcomes</h3><ul class="process-adds">${step.draws.map(d => `<li>${esc(v.describeDraw(d))}</li>`).join('')}</ul>` : '');
 }
 /** The deadline flow in the 2D map's own words: 'Deadline path (escalates: the work keeps going)'. */
 const deadlinePath = (mode: LWProcess.Deadline['mode']) => `Deadline path (${mode === 'escalate' ? 'escalates: the work keeps going' : 'interrupts: the work is cancelled'})`;
 /**
  * The next steps. A decision's routes also say how they are chosen; chance routes show their share and the fallback shows what is left.
  * An inclusive fork's branches show their condition (each is tested on its own, so no shares are summed) and a deadline flow says it is the deadline path.
  */
 function nextHtml(view: LWProcessApp.View, step: LWProcess.Step): string {
  const d = view.definition, out = d.flows.filter(f => f.from === step.id), v = root.LWProcessRandomView, many = root.LWProcessTerms.of(d).many;
  const chances = out.filter(f => typeof f.when?.chance === 'number'), conditions = out.filter(f => f.when && typeof f.when.chance !== 'number');
  const left = chances.length && !conditions.length ? 100 - chances.reduce((sum, f) => sum + (f.when!.chance as number), 0) : undefined;
  const branch = (f: LWProcess.Flow) => f.when ? v.describeWhen(f.when, many) : 'Default branch: taken only when no condition is true';
  const how = (f: LWProcess.Flow) => f.on === 'deadline' && step.deadline ? deadlinePath(step.deadline.mode) : step.kind === 'fork' && step.mode === 'inclusive' ? branch(f) : step.kind !== 'decision' ? '' : f.when ? v.describeWhen(f.when, many) : left !== undefined ? `Otherwise, ${Math.round(left * 10) / 10}% of ${many}` : 'Otherwise';
  return out.map(f => { const reason = how(f);
   return `<button class="next-step" data-next="${esc(f.to)}">${esc(d.steps.find(s => s.id === f.to)!.name)}${f.label ? ' · ' + esc(f.label) : ''}${reason ? `<small>${esc(reason)}</small>` : ''}</button>`; }).join('') || '<p>Process ends here.</p>';
 }
 /** Journey annotations of a step (phase, channel, feeling, pain, opportunity, end outcome) and its funnel and tracked averages. '' when there is nothing to say. */
 function journeyHtml(view: LWProcessApp.View, s: LWProcess.Step, m: LWProcess.StepMetric): string {
  const v = root.LWProcessRandomView, t = root.LWProcessTerms.of(view.definition), rows: string[] = [], add = (k: string, value: string) => rows.push(`<dt>${k}</dt><dd>${value}</dd>`);
  if (s.phase) add('Phase', esc(s.phase));
  if (v.describeChannel(s.channel)) add('Channel', esc(v.describeChannel(s.channel)));
  if (v.describeEmotion(s.emotion)) add('Feeling', esc(v.describeEmotion(s.emotion)) + ' (' + (s.emotion! > 0 ? '+' : '') + s.emotion + ')');
  if (v.describeOutcome(s.outcome)) add('Ends as', `<span class="process-outcome ${esc(s.outcome)}">${esc(v.describeOutcome(s.outcome))}</span>`);
  if (t.journey) {add('Reached', `${num(m.reached)} ${m.reached === 1 ? t.one : t.many}`); add('Entered', `${num(m.entered)} ${m.entered === 1 ? 'time' : 'times'}`);}
  for (const x of view.definition.track ?? []) {const e = m.tracked[x.field]; if (e && e.n > 0 && e.mean !== null) add(`Average ${esc(x.label ?? x.field)} on entry`, dec(e.mean));}
  const notes = (s.pain ? `<h3>Pain point</h3><p>${esc(s.pain)}</p>` : '') + (s.opportunity ? `<h3>Opportunity</h3><p>${esc(s.opportunity)}</p>` : '');
  return (rows.length ? `<h3>${t.journey ? 'Journey' : 'Annotations'}</h3><dl class="process-journey">${rows.join('')}</dl>` : '') + notes;
 }
 const row = (label: string, value: string) => `<dt>${label}</dt><dd>${value}</dd>`;
 /**
  * BPMN-class behaviour of one step in the editors' sentences: fork branching and its join, multiple instances with the cumulative
  * item counters, the visits running now and the item count of the latest completed visit, and the boundary deadline with its
  * path, firing counters and the next pending deadline minute. '' for a step with none of them.
  */
 function logicHtml(view: LWProcessApp.View, s: LWProcess.Step, m: LWProcess.StepMetric): string {
  const v = root.LWProcessRandomView, d = view.definition, q = view.snapshot, name = (id: string | undefined) => d.steps.find(x => x.id === id)?.name;
  let html = '';
  if (s.kind === 'fork') html += `<h3>Branching</h3><p class="process-random">${esc(v.describeFork(s))}</p>${name(s.join) ? `<dl>${row('Joins at', esc(name(s.join)))}</dl>` : ''}`;
  if (s.instances) {
   const items = m.items ?? {started: 0, finished: 0}, last = [...q.receipts].reverse().find(r => r.stepId === s.id && r.instances !== undefined);
   const visits = new Set(q.tokens.filter(t => t.stepId === s.id && t.group !== undefined).map(t => t.group)).size;
   html += `<h3>Multiple instances</h3><p class="process-random">${esc(v.describeInstances(s))}</p><dl>${row('Items started', num(items.started))}${row('Items finished', num(items.finished))}${row('Visits in progress', num(visits))}${last ? row('Latest completed visit', `${num(last.instances!)} ${last.instances === 1 ? 'item' : 'items'}`) : ''}</dl>`;
  }
  if (s.deadline) {
   const fired = m.deadlines ?? {interrupted: 0, escalated: 0}, target = name(d.flows.find(f => f.id === s.deadline!.flow)?.to);
   const pending = q.tokens.filter(t => t.stepId === s.id && t.deadlineAt !== undefined).map(t => t.deadlineAt!);
   const next = pending.length ? row('Next deadline', `Minute ${num(Math.min(...pending))}${pending.length > 1 ? ` · ${pending.length} pending` : ''}`) : '';
   html += `<h3>Deadline</h3><p class="process-random">${esc(v.describeDeadline(s))}</p><dl>${target ? row('Deadline path to', esc(target)) : ''}${row('Escalated', num(fired.escalated))}${row('Interrupted', num(fired.interrupted))}${next}</dl>`;
  }
  return html;
 }
 /** 'Blocked after finishing': work done here that waits for room in the next step's backlog; shown when a next step has a backlog or work is blocked. */
 function blockedHtml(view: LWProcessApp.View, s: LWProcess.Step, m: LWProcess.StepMetric): string {
  const d = view.definition, next = d.flows.filter(f => f.from === s.id).map(f => d.steps.find(x => x.id === f.to));
  return next.some(x => x?.backlog) || m.held > 0 ? row('Blocked after finishing', `${num(m.held)} blocked · waiting for room in the next backlog`) : '';
 }
 function step(view: LWProcessApp.View, s: LWProcess.Step): string {
  const q = view.snapshot, m = q.steps.find(m => m.id === s.id)!, busy = (s.instances ? 'Items ' : '') + (automated(s) ? 'running / waiting' : 'working / waiting');
  return `<p>${esc(s.description ?? s.name)}</p>${automated(s) ? `<p class="process-auto">Runs automatically${s.technology ? ' on ' + esc(s.technology) : ''}. No people are needed.</p>` : ''}<dl>${timingHtml(s, m)}<dt>${busy[0]!.toUpperCase() + busy.slice(1)}</dt><dd>${m.active} / ${m.queued - m.held}</dd>${blockedHtml(view, s, m)}<dt>Completed visits</dt><dd>${num(m.completed)}</dd><dt>Total queue time</dt><dd>${num(m.waitMinutes)} min</dd><dt>Fixed cost per visit</dt><dd>${num(s.cost ?? 0)}</dd></dl>${journeyHtml(view, s, m)}${logicHtml(view, s, m)}${randomHtml(s)}${needsHtml(view, s)}${outputsHtml(s, q)}${backlogHtml(s, q)}<h3>Next steps</h3>${nextHtml(view, s)}`;
 }
 /** Counts of the BPMN-class steps with their cumulative item and deadline counters; '' when the process has none. */
 function logicSummary(view: LWProcessApp.View): string {
  const d = view.definition, metrics = new Map(view.snapshot.steps.map(m => [m.id, m])), many = (n: number, one: string) => `${num(n)} ${n === 1 ? one : one + 's'}`;
  const multi = d.steps.filter(s => s.instances), late = d.steps.filter(s => s.deadline), inclusive = d.steps.filter(s => s.kind === 'fork' && s.mode === 'inclusive');
  const total = (list: LWProcess.Step[], pick: (m: LWProcess.StepMetric) => number) => list.reduce((n, s) => n + pick(metrics.get(s.id)!), 0);
  const rows = [multi.length ? row('Multiple instances', `${many(multi.length, 'step')} · ${num(total(multi, m => m.items?.started ?? 0))} items started · ${num(total(multi, m => m.items?.finished ?? 0))} finished`) : '',
   late.length ? row('Deadlines', `${many(late.length, 'step')} · ${num(total(late, m => m.deadlines?.escalated ?? 0))} escalated · ${num(total(late, m => m.deadlines?.interrupted ?? 0))} interrupted`) : '',
   inclusive.length ? row('Inclusive forks', many(inclusive.length, 'fork')) : ''].join('');
  return rows ? `<h3>Instances, deadlines and forks</h3><dl class="process-tracked">${rows}</dl>` : '';
 }
 function overview(view: LWProcessApp.View, moreOpen: boolean): string {
  const d = view.definition, seed = view.snapshot.seed, v = root.LWProcessRandomView, t = root.LWProcessTerms.of(d), tracked = trackedFinish(view);
  const text = d.description ?? `${t.Many} move through the process. Run the simulation to see work, queues and resource contention.`;
  return `<p id="process-desc" class="process-desc${moreOpen ? ' open' : ''}">${esc(text)}</p><button type="button" id="desc-more" class="process-more" aria-controls="process-desc" aria-expanded="${moreOpen}" hidden>${moreOpen ? 'Less' : 'More'}</button>
   <dl><dt>Steps</dt><dd>${d.steps.length}</dd><dt>Connections</dt><dd>${d.flows.length}</dd><dt>Revision</dt><dd>${d.revision}</dd><dt>Seed</dt><dd>${seed}${seed !== (d.seed ?? 1) ? ' · set for this run' : ''}</dd>${t.journey ? `<dt>Process type</dt><dd>${t.label}</dd>` : ''}</dl>${tracked.length ? `<h3>Tracked measures</h3><dl class="process-tracked">${tracked.map(x => `<dt>${esc(x.label)}</dt><dd>${dec(x.mean)} average · ${dec(x.min!)} to ${dec(x.max!)} · ${num(x.n)} ${x.n === 1 ? t.one : t.many}</dd>`).join('')}</dl>` : ''}${logicSummary(view)}
   <h3>Arrivals</h3>${d.arrivals.length ? `<ul class="process-adds" aria-label="Arrival streams">${d.arrivals.map(a => `<li>${esc(v.describeArrival(a, t))}</li>`).join('')}</ul>` : '<p>No arrivals defined.</p>'}`;
 }
 /** One plain sentence under the meters that tells the two KPI costs apart. */
 const COST_NOTE = '<p class="process-cost-note">Work cost charges pools only for the minutes they work, plus fixed step costs. '
  + 'Capacity cost charges every pool unit for every minute, busy or idle. Both are simulated units, not money.</p>';
 function pools(view: LWProcessApp.View): string {
  const d = view.definition;
  const meters = view.snapshot.resources.map(p => {
   const name = d.resources.find(r => r.id === p.id)!.name, pct = Math.round(p.utilization * 100), level = pct >= 85 ? 'hot' : pct >= 70 ? 'warm' : 'ok';
   return `<div class="process-pool"><div class="pool-head"><strong>${esc(name)}</strong><span class="pool-pct">${pct}%</span></div><div class="pool-bar" data-level="${level}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-valuetext="${pct}% average utilisation since minute 0${level === 'hot' ? ', nearly full' : ''}; ${p.busy} of ${p.capacity} busy now" aria-label="${esc(name)} utilisation"><i style="width:${Math.min(100, pct)}%"></i></div><small>Average since minute 0 · ${p.busy}/${p.capacity} busy now</small></div>`;
  }).join('');
  return meters ? meters + COST_NOTE : '<p>No shared resources defined.</p>';
 }
 root.LWProcessInspector = {overview, step, kpis, pools};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessInspector;
})(globalThis);
