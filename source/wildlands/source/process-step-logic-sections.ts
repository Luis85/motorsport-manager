/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-html.ts" />
/// <reference path="./process-step-model.ts" />
/// <reference path="./process-step-logic.ts" />
/// <reference path="./process-step-kit.ts" />
/// <reference path="./process-step-sections.ts" />
/**
 * Pure HTML for the BPMN-class step editor sections: the distribution editor (shared by a step's random timing and a deadline's
 * random time), Branching for forks, Multiple instances, Deadline, and the condition tree editor (value, another field, share of
 * cases, and the all/any/not groups) used for the paths of decisions and inclusive forks. It renders detached model values to
 * strings with the shared control kit (LWProcessStepKit) and the case-field suggestion lists of LWProcessStepSections, and escapes
 * its own text with LWProcessHtml; it never touches the DOM, a session or storage.
 */
declare namespace LWProcessStepLogicSections {
 interface Api {
  /** Distribution select and parameter fields for `prefix` ('timing' or 'deadline.timing'); `none` adds the "no distribution" choice. */
  dist(prefix: string, t: LWProcessStepModel.Timing, errId: string, none: string | null): string;
  branching(m: LWProcessStepModel.Model): string;
  instances(m: LWProcessStepModel.Model): string;
  deadline(m: LWProcessStepModel.Model): string;
  /** The condition editor for path `k` (checkbox, mode and the tests). */
  condition(m: LWProcessStepModel.Model, f: LWProcessStepModel.FlowRow, k: number): string;
  /** The ordered summary items of the paths of a decision or inclusive fork; '' for other steps. */
  pathSummary(m: LWProcessStepModel.Model): string;
  /**
   * Live explanation sentences by element id (`se-branching-note`, `se-instances-note`, `se-deadline-note`); only ids present in
   * `render` output matter.
   */
  notes(m: LWProcessStepModel.Model): Record<string, string>;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {
  LWProcessHtml: LWProcessHtml.Api; LWProcessStepModel: LWProcessStepModel.Api; LWProcessStepLogic: LWProcessStepLogic.Api;
  LWProcessRandomView: LWProcessRandomView.Api; LWProcessStepKit: LWProcessStepKit.Api; LWProcessStepSections: LWProcessStepSections.Api;
  LWProcessStepLogicSections?: LWProcessStepLogicSections.Api;
 };
 type M = LWProcessStepModel.Model;
 type Cond = LWProcessStepModel.Cond;
 type Flow = LWProcessStepModel.FlowRow;
 type Choices = [string, string][];
 const {esc} = root.LWProcessHtml;
 const kit = () => root.LWProcessStepKit, L = () => root.LWProcessStepLogic;
 const DISTS: Choices = [
  ['uniform', 'Uniform: any time between a minimum and a maximum'],
  ['triangular', 'Triangular: between a minimum and maximum, most often a likely time'],
  ['exponential', 'Exponential: many short times and a few long ones'],
  ['normal', 'Normal: a bell curve around a mean'],
  ['erlang', 'Erlang: a sum of k exponential phases, steadier than exponential'],
 ];
 const DIST_HELP: Record<string, string> = {
  normal: 'Times cluster around the mean; the spread (standard deviation) says how far they scatter. Each time is rounded to whole '
   + 'minutes and kept between the lowest and highest allowed.',
  erlang: 'The sum of k exponential phases with the given overall mean. More phases make the times more regular; one phase is exponential.',
 };
 /** The parameter fields of the chosen distribution ('' without one). */
 function params(prefix: string, t: LWProcessStepModel.Timing, errId: string): string {
  const param = (key: 'min' | 'mode' | 'max' | 'mean' | 'sd' | 'k', label: string, extra: LWProcessStepKit.Opt = {}) =>
   kit().field(`${prefix}.${key}`, label, t[key], {type: 'number', min: 1, desc: errId, placeholder: '1', ...extra});
  switch (t.dist) {
   case 'uniform':
    return param('min', 'Minimum (minutes)') + param('max', 'Maximum (minutes)');
   case 'triangular':
    return param('min', 'Minimum (minutes)') + param('mode', 'Most likely (minutes)') + param('max', 'Maximum (minutes)');
   case 'exponential':
    return param('mean', 'Mean (minutes)') + param('max', 'Cap (optional, minutes)', {placeholder: 'No cap'});
   case 'normal':
    return param('mean', 'Mean (minutes)') + param('sd', 'Spread: standard deviation (minutes, at least 1)')
     + param('min', 'Lowest allowed (optional, minutes)', {placeholder: 'Default 1'})
     + param('max', 'Highest allowed (optional, minutes)', {placeholder: 'Default mean + 6 × spread'});
   case 'erlang':
    return param('k', 'Phases k (whole number, 1 to 32)', {max: 32, placeholder: '3'}) + param('mean', 'Mean (minutes)');
   default:
    return '';
  }
 }
 function dist(prefix: string, t: LWProcessStepModel.Timing, errId: string, none: string | null): string {
  const k = kit(), fields = params(prefix, t, errId), help = DIST_HELP[t.dist];
  const choices: Choices = [...none === null ? [] : [['', none] as [string, string]], ...DISTS];
  return k.select(`${prefix}.dist`, 'Distribution', choices, t.dist, true)
   + (fields ? `<div class="se-grid">${fields}</div>` : '')
   + (help ? `<p class="se-help" id="se-${k.slug(prefix)}-help">${esc(help)}</p>` : '');
 }
 /** The sentence explaining a fork's branching (LWProcessRandomView.describeFork). */
 const forkNote = (m: M) => root.LWProcessRandomView.describeFork({kind: 'fork', ...m.branching === 'inclusive' ? {mode: 'inclusive' as const} : {}});
 const BRANCHING: Choices = [['parallel', 'Parallel (all branches)'], ['inclusive', 'Inclusive (every branch whose condition is true; default branch)']];
 function branching(m: M): string {
  if (m.branching === null) return '';
  const k = kit();
  const body = `${k.select('branching', 'Start', BRANCHING, m.branching, true)}<p class="se-help" id="se-branching-note">${esc(forkNote(m))}</p>`
   + k.err('branching');
  return k.section('branching', 'Branching', 'How many of the outgoing branches this fork starts. Both kinds end at the join named by the fork.', body);
 }
 const INSTANCE_KINDS: Choices = [['none', 'Once (no multiple instances)'], ['count', 'A fixed number of instances'],
  ['field', 'As many instances as a case field says']];
 const INSTANCE_MODES: Choices = [['parallel', 'In parallel: all instances queue at once'],
  ['sequential', 'One after another: each starts when the one before it is done']];
 /** The count or case-field control of multiple instances ('' for none). */
 function instanceValue(i: LWProcessStepModel.Instances): string {
  const k = kit();
  if (i.kind === 'count') {
   return k.field('instances.count', 'Number of instances (2 to 50)', i.count, {type: 'number', min: 2, max: 50, desc: 'se-err-instances', placeholder: '3'});
  }
  if (i.kind === 'field') {
   return k.field('instances.field', 'Case field holding the number of instances (a whole number from 1 to 50)', i.field, {desc: 'se-err-instances',
    list: root.LWProcessStepSections.LISTS.all, help: 'Read when a case enters the step; the case fails if it is missing or outside 1 to 50.'});
  }
  return '';
 }
 function instances(m: M): string {
  const i = m.instances;
  if (!i) return '';
  const k = kit(), blocked = !!m.backlog?.on && i.kind === 'none', value = instanceValue(i);
  const mode = i.kind === 'none' ? '' : k.radios('instances.mode', 'How do the instances run?', INSTANCE_MODES, i.mode);
  const why = blocked ? '<p class="se-help se-empty" id="se-instances-blocked">Multiple instances cannot be combined with a backlog. Turn off the '
   + 'backlog in the Backlog section to use them.</p>' : '';
  const note = i.kind === 'none' ? '' : `<p class="se-help" id="se-instances-note">${esc(notes(m)['se-instances-note'] ?? '')}</p>`;
  const kind = k.select('instances.kind', 'Run this step', INSTANCE_KINDS, i.kind, true, '', blocked ? 'se-instances-blocked' : '');
  const intro = 'Runs several items of this step for one case. Each instance asks for the step\'s people, equipment or systems and draws '
   + 'its own time; the step completes once, when every instance is done.';
  return k.section('instances', 'Multiple instances', intro,
   `${kind}${why}${value ? `<div class="se-grid">${value}</div>` : ''}${mode}${note}${k.err('instances')}`);
 }
 const DEADLINE_KINDS: Choices = [['none', 'No deadline'], ['after', 'After a fixed number of minutes of work'], ['timing', 'After a random time of work']];
 const DEADLINE_MODES: Choices = [['interrupt', 'Interrupt: cancel the work and take the deadline path'],
  ['escalate', 'Escalate: keep working and start the deadline path in parallel']];
 /** The choice of the deadline path, or the explanation that a deadline needs a second path. */
 function deadlineFlow(m: M, d: LWProcessStepModel.Deadline): string {
  if (m.flows.length <= 1) {
   return '<p class="se-help se-empty" id="se-deadline-noflow">This step has only one outgoing path, its normal route. A deadline needs a second path to take. '
    + 'Add one with <a href="#se-add-path-to" data-goto="se-add-path-to">Add path to…</a> under Where work goes next, then choose it here.</p>';
  }
  const options: Choices = [['', 'Choose a flow'], ...m.flows.map((f): [string, string] => [f.id, `${f.label || f.id} → ${f.toName}`])];
  return kit().select('deadline.flow', 'Which outgoing flow is the deadline path?', options, d.flow, true,
   'The other flow stays the normal route. Choosing a flow marks it as the deadline path.');
 }
 function deadline(m: M): string {
  const d = m.deadline;
  if (!d) return '';
  const k = kit();
  let body = '';
  if (d.kind !== 'none') {
   let time: string;
   if (d.kind === 'after') {
    const after = k.field('deadline.after', 'Minutes of work before the deadline fires (at least 1)', d.after,
     {type: 'number', min: 1, desc: 'se-err-deadline', placeholder: '1', help: 'Counted from when work starts; waiting in the queue does not count.'});
    time = `<div class="se-grid">${after}</div>`;
   } else time = dist('deadline.timing', d.timing, 'se-err-deadline', null);
   const mode = k.radios('deadline.mode', 'When the deadline fires', DEADLINE_MODES, d.mode);
   body = `${time}${mode}${deadlineFlow(m, d)}<p class="se-help" id="se-deadline-note">${esc(notes(m)['se-deadline-note'] ?? '')}</p>`;
  }
  const intro = 'Optional. A boundary timer on this step: if the work is still running after the set time, either cancel it (interrupt) or '
   + 'let it finish and start a second path beside it (escalate).';
  return k.section('deadline', 'Deadline', intro, `${k.select('deadline.kind', 'Deadline', DEADLINE_KINDS, d.kind, true)}${body}${k.err('deadline')}`);
 }
 function notes(m: M): Record<string, string> {
  const v = root.LWProcessRandomView, l = L(), out: Record<string, string> = {};
  const instances = m.instances && l.writeInstances(m.instances), deadline = m.deadline && l.writeDeadline(m.deadline);
  if (instances) out['se-instances-note'] = v.describeInstances({instances});
  if (deadline) out['se-deadline-note'] = v.describeDeadline({deadline});
  if (m.branching) out['se-branching-note'] = forkNote(m);
  return out;
 }
 // Conditions
 const ALL_KINDS: Choices = [['value', 'A value'], ['field', 'Another field'], ['chance', 'A share of cases (random)'], ['all', 'All of these'],
  ['any', 'Any of these'], ['not', 'Not (the opposite of)']];
 /** One test: a share of cases, or a case field compared with a value or another field. `about` names the test inside a group. */
 function leaf(c: Cond, b: string, desc: string, about: string): string {
  const k = kit();
  if (c.mode === 'chance') {
   const label = about ? `Share of cases${about} (percent, 1 to 99)` : 'Share of cases that take this path (percent, 1 to 99)';
   const help = about ? {} : {
    help: 'Each case draws its own random number, repeatable for the same seed. Paths are still checked in order and the first match wins.',
   };
   return `<div class="se-grid">${k.field(b + '.chance', label, c.chance, {type: 'number', min: 1, max: 99, placeholder: '10', desc, ...help})}</div>`;
  }
  const list = root.LWProcessStepSections.LISTS.after;
  const tested = k.field(b + '.field', 'Case field to test' + about, c.field, about ? {desc, list} : {list});
  const op = k.select(b + '.op', 'Condition' + about, root.LWProcessStepModel.OPS, c.op);
  const other = c.mode === 'field' ? k.field(b + '.valueField', 'Other case field to compare with' + about, c.valueField, about ? {desc, list} : {list})
   : k.valueEditor(b + '.value', c.value, desc, about);
  return `<div class="se-grid">${tested}${op}</div><div class="se-grid">${other}</div>`;
 }
 const GROUP_HELP: Record<string, string> = {all: 'True when every test below is true.', any: 'True when at least one test below is true.',
  not: 'True when the test below is false.'};
 /** A group of tests. `level` is 1 for the group chosen on the path; `top` is the whole condition (for the leaf budget). */
 function group(c: Cond, b: string, level: number, desc: string, top: Cond, number: string): string {
  const k = kit(), l = L(), items = c.items ?? [], single = c.mode === 'not';
  const full = items.length >= l.LIMITS.entries || l.leafCount(top) >= l.LIMITS.leaves;
  const kinds = ALL_KINDS.filter(([v]) => level < l.LIMITS.depth || !['all', 'any', 'not'].includes(v));
  const rows = items.map((x, j) => {
   const rb = `${b}.items.${j}`, label = `${number}${number ? '.' : ''}${j + 1}`, about = ` (test ${label})`;
   const options = kinds.some(([v]) => v === x.mode) ? kinds : ALL_KINDS;
   const inner = l.isGroup(x) ? group(x, rb, level + 1, desc, top, label) : leaf(x, rb, desc, about);
   const lone = !single && items.length <= 1;
   const remove = single ? ''
    : k.button('remove-cond', 'Remove', j, ` data-path="${b}"${lone ? ` disabled aria-describedby="${k.idOf(b)}-min"` : ''}`, `Remove test ${label}`);
   return `<fieldset class="se-card se-cond"><legend>Test ${label}</legend>${k.select(`${rb}.mode`, 'Kind of test' + about, options, x.mode, true)}`
    + `${inner}${remove}</fieldset>`;
  }).join('');
  let add = '';
  if (!single) {
   const disabled = full ? ` aria-describedby="${k.idOf(b)}-max" disabled` : '';
   add = k.button('add-cond', 'Add test', undefined, ` id="${k.idOf(b + '.add')}" data-path="${b}"${disabled}`,
    `Add a test to ${number ? 'group ' + number : 'this condition'}`);
   if (full) {
    add += `<span class="se-help" id="${k.idOf(b)}-max">At most ${l.LIMITS.entries} tests in a group and ${l.LIMITS.leaves} in the whole condition.</span>`;
   }
   if (items.length <= 1) add += `<span class="se-help" id="${k.idOf(b)}-min">A group needs at least one test.</span>`;
  }
  return `<div class="se-cond-group" role="group" aria-label="${esc(level === 1 ? 'Tests' : 'Group ' + number)}">`
   + `<p class="se-help">${esc(GROUP_HELP[c.mode] ?? '')}</p>${rows}${add}</div>`;
 }
 function condition(m: M, f: Flow, k: number): string {
  const kk = kit(), c = f.cond, b = `flows.${k}.cond`, fork = m.branching === 'inclusive';
  const ask = fork ? 'Start this branch only when a condition is met' : 'Take this path only when a condition is met';
  if (!c.on) {
   const fallback = fork ? 'No condition: this is the default branch, started only when no other branch condition is true.'
    : 'No condition: this is the fallback path, used when no other path matches.';
   return kk.check(b + '.on', ask, false) + `<p class="se-help">${fallback}</p>`;
  }
  const modes = kk.radios(b + '.mode', 'Decided by', ALL_KINDS, c.mode), desc = `se-err-flows-${k}`;
  return kk.check(b + '.on', ask, true) + modes + (L().isGroup(c) ? group(c, b, 1, desc, c, '') : leaf(c, b, desc, ''));
 }
 function pathSummary(m: M): string {
  const decision = m.kind === 'decision', inclusive = m.branching === 'inclusive';
  if (!decision && !inclusive) return '';
  const otherwise = inclusive ? 'Otherwise (default branch)' : 'Otherwise';
  return m.flows.filter(f => !L().isDeadlineFlow(m, f.id)).map(f => `<li>${esc(L().condSummary(f.cond, otherwise))} → ${esc(f.toName)}</li>`).join('');
 }
 root.LWProcessStepLogicSections = {dist, branching, instances, deadline, condition, pathSummary, notes};
})(globalThis);
