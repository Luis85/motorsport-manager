/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-step-model.ts" />
/// <reference path="./process-step-logic.ts" />
/// <reference path="./process-step-sections.ts" />
/**
 * Pure HTML for the BPMN-class step editor sections: the distribution editor (shared by a step's random timing and a deadline's
 * random time), Branching for forks, Multiple instances, Deadline, and the condition tree editor (value, another field, share of
 * cases, and the all/any/not groups) used for the paths of decisions and inclusive forks. It renders detached model values to
 * strings with the shared control kit of LWProcessStepSections; it never touches the DOM, a session or storage.
 */
declare namespace LWProcessStepLogicSections {
 interface Ui {deadlineHelp?: boolean; canOpenDefinition?: boolean}
 interface Api {
  /** Distribution select and parameter fields for `prefix` ('timing' or 'deadline.timing'); `none` adds the "no distribution" choice. */
  dist(prefix: string, t: LWProcessStepModel.Timing, errId: string, none: string | null): string;
  branching(m: LWProcessStepModel.Model): string;
  instances(m: LWProcessStepModel.Model): string;
  deadline(m: LWProcessStepModel.Model, ui: Ui): string;
  /** The condition editor for path `k` (checkbox, mode and the tests). */
  condition(m: LWProcessStepModel.Model, f: LWProcessStepModel.FlowRow, k: number): string;
  /** The ordered summary items of the paths of a decision or inclusive fork; '' for other steps. */
  pathSummary(m: LWProcessStepModel.Model): string;
  /** Live explanation sentences by element id (`se-branching-note`, `se-instances-note`, `se-deadline-note`); only ids present in `render` output matter. */
  notes(m: LWProcessStepModel.Model): Record<string, string>;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessStepModel: LWProcessStepModel.Api; LWProcessStepLogic: LWProcessStepLogic.Api; LWProcessRandomView: LWProcessRandomView.Api; LWProcessStepSections: LWProcessStepSections.Api; LWProcessStepLogicSections?: LWProcessStepLogicSections.Api};
 type M = LWProcessStepModel.Model; type Cond = LWProcessStepModel.Cond; type Flow = LWProcessStepModel.FlowRow;
 const kit = () => root.LWProcessStepSections.kit, L = () => root.LWProcessStepLogic;
 const DISTS: [string, string][] = [['uniform', 'Uniform: any time between a minimum and a maximum'], ['triangular', 'Triangular: between a minimum and maximum, most often a likely time'], ['exponential', 'Exponential: many short times and a few long ones'],
  ['normal', 'Normal: a bell curve around a mean'], ['erlang', 'Erlang: a sum of k exponential phases, steadier than exponential']];
 const DIST_HELP: Record<string, string> = {normal: 'Times cluster around the mean; the spread (standard deviation) says how far they scatter. Each time is rounded to whole minutes and kept between the lowest and highest allowed.',
  erlang: 'The sum of k exponential phases with the given overall mean. More phases make the times more regular; one phase is exponential.'};
 function dist(prefix: string, t: LWProcessStepModel.Timing, errId: string, none: string | null): string {
  const k = kit(), num = (key: 'min' | 'mode' | 'max' | 'mean' | 'sd' | 'k', label: string, extra: LWProcessStepSections.Opt = {}) => k.field(`${prefix}.${key}`, label, t[key], {type: 'number', min: 1, desc: errId, placeholder: '1', ...extra});
  const params = t.dist === 'uniform' ? num('min', 'Minimum (minutes)') + num('max', 'Maximum (minutes)')
   : t.dist === 'triangular' ? num('min', 'Minimum (minutes)') + num('mode', 'Most likely (minutes)') + num('max', 'Maximum (minutes)')
   : t.dist === 'exponential' ? num('mean', 'Mean (minutes)') + num('max', 'Cap (optional, minutes)', {placeholder: 'No cap'})
   : t.dist === 'normal' ? num('mean', 'Mean (minutes)') + num('sd', 'Spread: standard deviation (minutes, at least 1)') + num('min', 'Lowest allowed (optional, minutes)', {placeholder: 'Default 1'}) + num('max', 'Highest allowed (optional, minutes)', {placeholder: 'Default mean + 6 × spread'})
   : t.dist === 'erlang' ? num('k', 'Phases k (whole number, 1 to 32)', {max: 32, placeholder: '3'}) + num('mean', 'Mean (minutes)') : '';
  const help = DIST_HELP[t.dist];
  return `${k.select(`${prefix}.dist`, 'Distribution', [...none === null ? [] : [['', none] as [string, string]], ...DISTS], t.dist, true)}${params ? `<div class="se-grid">${params}</div>` : ''}${help ? `<p class="se-help" id="se-${k.slug(prefix)}-help">${k.esc(help)}</p>` : ''}`;
 }
 function branching(m: M): string {
  if (m.branching === null) return '';
  const k = kit(), choices: [string, string][] = [['parallel', 'Parallel (all branches)'], ['inclusive', 'Inclusive (every branch whose condition is true; default branch)']];
  return k.section('branching', 'Branching', 'How many of the outgoing branches this fork starts. Both kinds end at the join named by the fork.', `${k.select('branching', 'Start', choices, m.branching, true)}<p class="se-help" id="se-branching-note">${k.esc(root.LWProcessRandomView.describeFork({kind: 'fork', ...m.branching === 'inclusive' ? {mode: 'inclusive' as const} : {}}))}</p>${k.err('branching')}`);
 }
 function instances(m: M): string {
  const i = m.instances; if (!i) return '';
  const k = kit(), blocked = !!m.backlog?.on && i.kind === 'none';
  const kinds: [string, string][] = [['none', 'Once (no multiple instances)'], ['count', 'A fixed number of instances'], ['field', 'As many instances as a case field says']];
  const value = i.kind === 'count' ? k.field('instances.count', 'Number of instances (2 to 50)', i.count, {type: 'number', min: 2, max: 50, desc: 'se-err-instances', placeholder: '3'})
   : i.kind === 'field' ? k.field('instances.field', 'Case field holding the number of instances (a whole number from 1 to 50)', i.field, {desc: 'se-err-instances', help: 'Read when a case enters the step; the case fails if it is missing or outside 1 to 50.'}) : '';
  const mode = i.kind === 'none' ? '' : k.radios('instances.mode', 'How do the instances run?', [['parallel', 'In parallel: all instances queue at once'], ['sequential', 'One after another: each starts when the one before it is done']], i.mode);
  const why = blocked ? '<p class="se-help se-empty" id="se-instances-blocked">Multiple instances cannot be combined with a backlog. Turn off the backlog in the Backlog section to use them.</p>' : '';
  return k.section('instances', 'Multiple instances', 'Runs several items of this step for one case. Each instance asks for the step\'s people, equipment or systems and draws its own time; the step completes once, when every instance is done.',
   `${k.select('instances.kind', 'Run this step', kinds, i.kind, true, '', blocked ? 'se-instances-blocked' : '')}${why}${value ? `<div class="se-grid">${value}</div>` : ''}${mode}${i.kind === 'none' ? '' : `<p class="se-help" id="se-instances-note">${k.esc(notes(m)['se-instances-note'] ?? '')}</p>`}${k.err('instances')}`);
 }
 function deadline(m: M, ui: LWProcessStepLogicSections.Ui): string {
  const d = m.deadline; if (!d) return '';
  const k = kit(), kinds: [string, string][] = [['none', 'No deadline'], ['after', 'After a fixed number of minutes of work'], ['timing', 'After a random time of work']];
  let body = '';
  if (d.kind !== 'none') {
   const time = d.kind === 'after' ? `<div class="se-grid">${k.field('deadline.after', 'Minutes of work before the deadline fires (at least 1)', d.after, {type: 'number', min: 1, desc: 'se-err-deadline', placeholder: '1', help: 'Counted from when work starts; waiting in the queue does not count.'})}</div>` : dist('deadline.timing', d.timing, 'se-err-deadline', null);
   const mode = k.radios('deadline.mode', 'When the deadline fires', [['interrupt', 'Interrupt: cancel the work and take the deadline path'], ['escalate', 'Escalate: keep working and start the deadline path in parallel']], d.mode);
   const options: [string, string][] = [['', 'Choose a flow'], ...m.flows.map((f): [string, string] => [f.id, `${f.label || f.id} → ${f.toName}`])];
   const flow = m.flows.length > 1 ? k.select('deadline.flow', 'Which outgoing flow is the deadline path?', options, d.flow, true, 'The other flow stays the normal route. Choosing a flow marks it as the deadline path.')
    : `<p class="se-help se-empty" id="se-deadline-noflow">This step has only one outgoing flow, its normal route. A deadline needs a second flow for the deadline path.</p>${k.button('deadline-help', ui.deadlineHelp ? 'Hide how to add the flow' : 'How do I add the flow?', undefined, ` id="se-deadline-help" aria-expanded="${!!ui.deadlineHelp}" aria-controls="se-deadline-hint"`)}${ui.deadlineHelp ? hint(m, ui) : ''}`;
   body = `${time}${mode}${flow}<p class="se-help" id="se-deadline-note">${k.esc(notes(m)['se-deadline-note'] ?? '')}</p>`;
  }
  return k.section('deadline', 'Deadline', 'Optional. A boundary timer on this step: if the work is still running after the set time, either cancel it (interrupt) or let it finish and start a second path beside it (escalate).', `${k.select('deadline.kind', 'Deadline', kinds, d.kind, true)}${body}${k.err('deadline')}`);
 }
 function hint(m: M, ui: LWProcessStepLogicSections.Ui): string {
  const k = kit(), json = `{"id": "${m.id}-late", "from": "${m.id}", "to": "<id of an existing step>", "on": "deadline"}`;
  return `<div class="se-hint" id="se-deadline-hint" role="note"><p>The step editor does not add flows. In the Definition editor, open the JSON text and add this entry to "flows", pointing "to" at the step the deadline path should reach. Then come back and choose it here.</p><pre><code>${k.esc(json)}</code></pre>${ui.canOpenDefinition ? k.button('open-definition', 'Open the Definition editor') : ''}</div>`;
 }
 function notes(m: M): Record<string, string> {
  const v = root.LWProcessRandomView, l = L(), out: Record<string, string> = {};
  if (m.instances && m.instances.kind !== 'none') out['se-instances-note'] = v.describeInstances({instances: l.writeInstances(m.instances) as unknown as LWProcess.Instances});
  if (m.deadline && m.deadline.kind !== 'none') out['se-deadline-note'] = v.describeDeadline({deadline: l.writeDeadline(m.deadline) as unknown as LWProcess.Deadline});
  if (m.branching) out['se-branching-note'] = v.describeFork({kind: 'fork', ...m.branching === 'inclusive' ? {mode: 'inclusive' as const} : {}});
  return out;
 }
 // Conditions
 const ALL_KINDS: [string, string][] = [['value', 'A value'], ['field', 'Another field'], ['chance', 'A share of cases (random)'], ['all', 'All of these'], ['any', 'Any of these'], ['not', 'Not (the opposite of)']];
 function leaf(c: Cond, b: string, desc: string, about: string): string {
  const k = kit();
  if (c.mode === 'chance') return `<div class="se-grid">${k.field(b + '.chance', about ? `Share of cases${about} (percent, 1 to 99)` : 'Share of cases that take this path (percent, 1 to 99)', c.chance, {type: 'number', min: 1, max: 99, placeholder: '10', desc, ...about ? {} : {help: 'Each case draws its own random number, repeatable for the same seed. Paths are still checked in order and the first match wins.'}})}</div>`;
  return `<div class="se-grid">${k.field(b + '.field', 'Case field to test' + about, c.field, about ? {desc} : {})}${k.select(b + '.op', 'Condition' + about, root.LWProcessStepModel.OPS, c.op)}</div>`
   + (c.mode === 'field' ? `<div class="se-grid">${k.field(b + '.valueField', 'Other case field to compare with' + about, c.valueField, about ? {desc} : {})}</div>` : `<div class="se-grid">${k.valueEditor(b + '.value', c.value, desc, about)}</div>`);
 }
 const GROUP_HELP: Record<string, string> = {all: 'True when every test below is true.', any: 'True when at least one test below is true.', not: 'True when the test below is false.'};
 /** A group of tests. `level` is 1 for the group chosen on the path; `top` is the whole condition (for the leaf budget). */
 function group(c: Cond, b: string, level: number, desc: string, top: Cond, number: string): string {
  const k = kit(), l = L(), items = c.items ?? [], full = items.length >= l.LIMITS.entries || l.leafCount(top) >= l.LIMITS.leaves, single = c.mode === 'not';
  const kinds = ALL_KINDS.filter(([v]) => level < l.LIMITS.depth || !['all', 'any', 'not'].includes(v));
  const rows = items.map((x, j) => {
   const rb = `${b}.items.${j}`, label = `${number}${number ? '.' : ''}${j + 1}`, about = ` (test ${label})`;
   const options = kinds.some(([v]) => v === x.mode) ? kinds : ALL_KINDS;
   const inner = l.isGroup(x) ? group(x, rb, level + 1, desc, top, label) : leaf(x, rb, desc, about);
   const lone = !single && items.length <= 1, remove = single ? '' : `${k.button('remove-cond', 'Remove', j, ` data-path="${b}"${lone ? ` disabled aria-describedby="${k.idOf(b)}-min"` : ''}`, `Remove test ${label}`)}`;
   return `<fieldset class="se-card se-cond"><legend>Test ${label}</legend>${k.select(`${rb}.mode`, 'Kind of test' + about, options, x.mode, true)}${inner}${remove}</fieldset>`;
  }).join('');
  const add = single ? '' : `${k.button('add-cond', 'Add test', undefined, ` id="${k.idOf(b + '.add')}" data-path="${b}"${full ? ` aria-describedby="${k.idOf(b)}-max" disabled` : ''}`, `Add a test to ${number ? 'group ' + number : 'this condition'}`)}${full ? `<span class="se-help" id="${k.idOf(b)}-max">At most ${l.LIMITS.entries} tests in a group and ${l.LIMITS.leaves} in the whole condition.</span>` : ''}${items.length <= 1 && !single ? `<span class="se-help" id="${k.idOf(b)}-min">A group needs at least one test.</span>` : ''}`;
  return `<div class="se-cond-group" role="group" aria-label="${k.esc(level === 1 ? 'Tests' : 'Group ' + number)}"><p class="se-help">${k.esc(GROUP_HELP[c.mode] ?? '')}</p>${rows}${add}</div>`;
 }
 function condition(m: M, f: Flow, k: number): string {
  const kk = kit(), c = f.cond, b = `flows.${k}.cond`, fork = m.branching === 'inclusive', ask = fork ? 'Start this branch only when a condition is met' : 'Take this path only when a condition is met';
  if (!c.on) return kk.check(b + '.on', ask, false) + `<p class="se-help">${fork ? 'No condition: this is the default branch, started only when no other branch condition is true.' : 'No condition: this is the fallback path, used when no other path matches.'}</p>`;
  const modes = kk.radios(b + '.mode', 'Decided by', ALL_KINDS, c.mode), desc = `se-err-flows-${k}`;
  return kk.check(b + '.on', ask, true) + modes + (L().isGroup(c) ? group(c, b, 1, desc, c, '') : leaf(c, b, desc, ''));
 }
 function pathSummary(m: M): string {
  const decision = m.kind === 'decision', inclusive = m.branching === 'inclusive';
  if (!decision && !inclusive) return '';
  return m.flows.filter(f => !L().isDeadlineFlow(m, f.id)).map(f => `<li>${kit().esc(L().condSummary(f.cond, inclusive ? 'Otherwise (default branch)' : 'Otherwise'))} → ${kit().esc(f.toName)}</li>`).join('');
 }
 root.LWProcessStepLogicSections = {dist, branching, instances, deadline, condition, pathSummary, notes};
})(globalThis);
