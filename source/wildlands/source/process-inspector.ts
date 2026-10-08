/// <reference path="./process-contracts.d.ts" />
/**
 * Inspector markup for Process Studio: the overview of the whole process, the details of one selected step and the shared
 * resource bars. Pure functions from a detached view (`LWProcessApp.View`) to escaped HTML strings; no DOM access, no session,
 * clock or storage. Random behaviour is worded by LWProcessRandomView so the inspector, the editors and the activity list agree.
 */
declare namespace LWProcessInspector {
 interface Api {
  /** Whole-process facts: description (clamped to three lines until `moreOpen`), counts, revision, seed and the arrival streams. */
  overview(view: LWProcessApp.View, moreOpen: boolean): string;
  /** One step: description, timing, random timing and outcomes, needs, outputs, backlog and the steps that can follow. */
  step(view: LWProcessApp.View, step: LWProcess.Step): string;
  /** The KPI strip cells under the stage: counts and cost, plus goals, lost, conversion and up to two tracked measures for journeys. HTML without the seed note. */
  kpis(view: LWProcessApp.View): string;
  /** Shared resources as utilisation meters. Colour is never the only signal: the percentage and the busy count are text. */
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
  cells.push(...outcomes, ['In progress', num(m.active)], ['Mean cycle', num(m.meanCycleMinutes) + ' min'], ['Simulated cost', num(m.cost)], ['Failed', num(m.failed)]);
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
 /** The next steps. A decision's routes also say how they are chosen; chance routes show their share and the fallback shows what is left. */
 function nextHtml(view: LWProcessApp.View, step: LWProcess.Step): string {
  const d = view.definition, out = d.flows.filter(f => f.from === step.id), v = root.LWProcessRandomView, many = root.LWProcessTerms.of(d).many;
  const chances = out.filter(f => typeof f.when?.chance === 'number'), conditions = out.filter(f => f.when && typeof f.when.chance !== 'number');
  const left = chances.length && !conditions.length ? 100 - chances.reduce((sum, f) => sum + (f.when!.chance as number), 0) : undefined;
  const how = (f: LWProcess.Flow) => step.kind !== 'decision' ? '' : f.when ? v.describeWhen(f.when, many) : left !== undefined ? `Otherwise, ${Math.round(left * 10) / 10}% of ${many}` : 'Otherwise';
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
 function step(view: LWProcessApp.View, s: LWProcess.Step): string {
  const q = view.snapshot, m = q.steps.find(m => m.id === s.id)!;
  return `<p>${esc(s.description ?? s.name)}</p>${automated(s) ? `<p class="process-auto">Runs automatically${s.technology ? ' on ' + esc(s.technology) : ''}. No people are needed.</p>` : ''}<dl>${timingHtml(s, m)}<dt>${automated(s) ? 'Running / waiting' : 'Working / waiting'}</dt><dd>${m.active} / ${m.queued}</dd><dt>Completed visits</dt><dd>${num(m.completed)}</dd><dt>Total queue time</dt><dd>${num(m.waitMinutes)} min</dd><dt>Fixed cost per visit</dt><dd>${num(s.cost ?? 0)}</dd></dl>${journeyHtml(view, s, m)}${randomHtml(s)}${needsHtml(view, s)}${outputsHtml(s, q)}${backlogHtml(s, q)}<h3>Next steps</h3>${nextHtml(view, s)}`;
 }
 function overview(view: LWProcessApp.View, moreOpen: boolean): string {
  const d = view.definition, seed = view.snapshot.seed, v = root.LWProcessRandomView, t = root.LWProcessTerms.of(d), tracked = trackedFinish(view);
  const text = d.description ?? `${t.Many} move through the process. Run the simulation to see work, queues and resource contention.`;
  return `<p id="process-desc" class="process-desc${moreOpen ? ' open' : ''}">${esc(text)}</p><button type="button" id="desc-more" class="process-more" aria-controls="process-desc" aria-expanded="${moreOpen}" hidden>${moreOpen ? 'Less' : 'More'}</button>
   <dl><dt>Steps</dt><dd>${d.steps.length}</dd><dt>Connections</dt><dd>${d.flows.length}</dd><dt>Revision</dt><dd>${d.revision}</dd><dt>Seed</dt><dd>${seed}${seed !== (d.seed ?? 1) ? ' · set for this run' : ''}</dd>${t.journey ? `<dt>Process type</dt><dd>${t.label}</dd>` : ''}</dl>${tracked.length ? `<h3>Tracked measures</h3><dl class="process-tracked">${tracked.map(x => `<dt>${esc(x.label)}</dt><dd>${dec(x.mean)} average · ${dec(x.min!)} to ${dec(x.max!)} · ${num(x.n)} ${x.n === 1 ? t.one : t.many}</dd>`).join('')}</dl>` : ''}
   <h3>Arrivals</h3>${d.arrivals.length ? `<ul class="process-adds" aria-label="Arrival streams">${d.arrivals.map(a => `<li>${esc(v.describeArrival(a, t))}</li>`).join('')}</ul>` : '<p>No arrivals defined.</p>'}`;
 }
 function pools(view: LWProcessApp.View): string {
  const d = view.definition;
  return view.snapshot.resources.map(p => {
   const name = d.resources.find(r => r.id === p.id)!.name, pct = Math.round(p.utilization * 100), level = pct >= 85 ? 'hot' : pct >= 70 ? 'warm' : 'ok';
   return `<div class="process-pool"><div class="pool-head"><strong>${esc(name)}</strong><span class="pool-pct">${pct}%</span></div><div class="pool-bar" data-level="${level}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-valuetext="${pct}% used${level === 'hot' ? ', nearly full' : ''}" aria-label="${esc(name)} utilisation"><i style="width:${Math.min(100, pct)}%"></i></div><small>${p.busy}/${p.capacity} busy now</small></div>`;
  }).join('') || '<p>No shared resources defined.</p>';
 }
 root.LWProcessInspector = {overview, step, kpis, pools};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessInspector;
})(globalThis);
