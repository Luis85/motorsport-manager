/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-step-model.ts" />
/**
 * Pure HTML for the step editor sections (basics, timing and cost, automation, people or equipment, effects, declared outputs,
 * needs, backlog and flows). It renders a detached `LWProcessStepModel.Model` to a string and owns the stable element ids
 * (`se-<bind with dots as dashes>`) and error slots (`data-errs`); it never touches the DOM, a session or storage.
 */
declare namespace LWProcessStepSections {
 interface Api {
  /** All sections for the model's kind, in reading order. */
  render(model: LWProcessStepModel.Model): string;
  /** The ordered one-line summary items of a decision's paths ("If iteration < iterations → Planning"); '' for other kinds. */
  pathSummary(model: LWProcessStepModel.Model): string;
  idOf(bind: string): string;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessStepModel: LWProcessStepModel.Api; LWProcessStepSections?: LWProcessStepSections.Api};
 type M = LWProcessStepModel.Model;
 const esc = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
 const slug = (bind: string) => bind.replace(/\./g, '-'), idOf = (bind: string) => 'se-' + slug(bind);
 const TYPES: [string, string][] = [['text', 'Text'], ['number', 'Number'], ['true', 'True'], ['false', 'False'], ['null', 'Empty (null)']];
 const KIND_HELP: Record<string, string> = {task: 'Work done by people over time.', machine: 'Work done automatically by physical equipment over time. No people are needed.', system: 'Work done automatically by software over time. No people are needed.',
  timer: 'Holds work without using people or equipment.', decision: 'Chooses one path for each case.', join: 'Waits for parallel paths to arrive.', fork: 'Starts parallel paths.', start: 'Where cases enter.', end: 'Where cases leave.'};
 const KIND_LABEL: Record<string, string> = {task: 'Task', machine: 'Machine step', system: 'System step'};
 const SYMBOL: Record<string, string> = {eq: '=', ne: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤'};
 const err = (key: string) => `<div class="se-errs" data-errs="${key}" id="se-err-${slug(key)}"></div>`;
 interface Opt {type?: 'number' | undefined; min?: number; max?: number; step?: string; help?: string; long?: boolean; desc?: string; placeholder?: string; autofocus?: boolean; maxlength?: number; counter?: string}
 function field(bind: string, label: string, value: string, o: Opt = {}): string {
  const id = idOf(bind), desc = [o.help ? id + '-help' : '', o.counter ?? '', o.desc ?? ''].filter(Boolean).join(' '), ph = o.placeholder ? ` placeholder="${esc(o.placeholder)}"` : '';
  const attrs = `id="${id}" data-bind="${bind}"${desc ? ` aria-describedby="${desc}"` : ''}${ph}${o.autofocus ? ' autofocus' : ''}`;
  const control = o.long ? `<textarea ${attrs} rows="3" maxlength="2000">${esc(value)}</textarea>`
   : o.type === 'number' ? `<input ${attrs} type="number" inputmode="numeric" step="${o.step ?? '1'}"${o.min === undefined ? '' : ` min="${o.min}"`}${o.max === undefined ? '' : ` max="${o.max}"`} value="${esc(value)}">`
   : `<input ${attrs} type="text" maxlength="${o.maxlength ?? 256}" value="${esc(value)}">`;
  return `<div class="se-field"><label for="${id}">${esc(label)}</label>${control}${o.help ? `<p class="se-help" id="${id}-help">${esc(o.help)}</p>` : ''}${o.counter ? `<p class="se-help se-count" id="${o.counter}"></p>` : ''}</div>`;
 }
 const select = (bind: string, label: string, options: [string, string][], value: string, rerender = false) =>
  `<div class="se-field"><label for="${idOf(bind)}">${esc(label)}</label><select id="${idOf(bind)}" data-bind="${bind}"${rerender ? ' data-rerender' : ''}>${options.map(([v, t]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>`;
 const check = (bind: string, label: string, on: boolean) => `<label class="se-check"><input type="checkbox" id="${idOf(bind)}" data-bind="${bind}" data-rerender${on ? ' checked' : ''}> ${esc(label)}</label>`;
 const radios = (bind: string, legend: string, options: [string, string][], value: string) =>
  `<fieldset class="se-radios"><legend>${esc(legend)}</legend>${options.map(([v, t]) => `<label class="se-check"><input type="radio" name="${idOf(bind)}" id="${idOf(bind)}-${v}" data-bind="${bind}" data-rerender value="${v}"${v === value ? ' checked' : ''}> ${esc(t)}</label>`).join('')}</fieldset>`;
 const valueEditor = (bind: string, v: LWProcessStepModel.Value, desc: string) =>
  select(bind + '.type', 'Type of value', TYPES, v.type, true) + (v.type === 'text' || v.type === 'number' ? field(bind + '.text', 'Value', v.text, {type: v.type === 'number' ? 'number' : undefined, step: 'any', desc, placeholder: v.type === 'number' ? '0' : ''}) : '');
 const section = (id: string, title: string, intro: string, body: string) =>
  `<section class="se-section" aria-labelledby="se-h-${id}"><h3 id="se-h-${id}">${esc(title)}</h3>${intro ? `<p class="se-help">${esc(intro)}</p>` : ''}${body}</section>`;
 const button = (act: string, label: string, i?: number, extra = '', aria = '') => `<button type="button" data-act="${act}"${i === undefined ? '' : ` data-i="${i}"`}${aria ? ` aria-label="${esc(aria)}"` : ''}${extra}>${esc(label)}</button>`;
 const work = (m: M) => root.LWProcessStepModel.isWork(m.kind);
 function basics(m: M): string {
  return section('basics', 'Basics', KIND_HELP[m.kind] ?? '', `<div class="se-grid">${field('name', 'Name', m.name, {desc: 'se-err-name', autofocus: true})}${field('description', 'Description', m.description, {long: true, desc: 'se-err-description'})}</div>${err('name')}${err('description')}`);
 }
 function timing(m: M): string {
  if (m.kind !== 'timer' && !work(m)) return '';
  if (work(m)) {
   const label = KIND_LABEL[m.kind]!;
   return section('timing', 'Timing and cost', m.kind === 'task' ? 'How long one visit takes and what each visit costs.' : 'How long one run takes and what each run costs.',
    `<div class="se-grid">${field('duration', `${label} duration (minutes, at least 1)`, m.duration, {type: 'number', min: 1, desc: 'se-err-duration', placeholder: '1'})}${field('cost', 'Fixed cost per visit (whole number, 0 or more)', m.cost, {type: 'number', min: 0, desc: 'se-err-cost', placeholder: '0'})}</div>${err('duration')}${err('cost')}`);
  }
  const value = m.mode === 'until' ? field('until', 'Absolute minute to wait until (at least 1)', m.until, {type: 'number', min: 1, desc: 'se-err-until', placeholder: '1'}) : field('duration', 'Wait duration (minutes, at least 1)', m.duration, {type: 'number', min: 1, desc: 'se-err-duration', placeholder: '1'});
  return section('timing', 'Timing', 'A timer holds work without using people, equipment or cost.', `${radios('mode', 'What does this timer wait for?', [['duration', 'Wait a duration'], ['until', 'Wait until a minute']], m.mode)}<div class="se-grid">${value}</div>${err(m.mode === 'until' ? 'until' : 'duration')}`);
 }
 function automation(m: M): string {
  if (m.kind !== 'machine' && m.kind !== 'system') return '';
  const eg = m.kind === 'machine' ? 'Robot arm or CNC mill' : 'CI/CD pipeline or API service';
  return section('automation', 'Automation', 'This step runs automatically. Nothing is executed or contacted; the numbers here are simulation assumptions.',
   `<div class="se-grid">${field('technology', 'Technology (optional)', m.technology, {desc: 'se-err-technology', maxlength: 80, counter: 'se-technology-count', help: `A label only, such as ${eg}.`})}</div>${err('technology')}`);
 }
 function people(m: M): string {
  if (!work(m)) return '';
  const kind = root.LWProcessStepModel.poolKind(m.kind), title = m.kind === 'task' ? 'People and capacity' : m.kind === 'machine' ? 'Equipment' : 'Systems';
  const shown = m.pools.map((p, i) => ({p, i})).filter(({p}) => p.eligible || (Number(p.count) || 0) > 0);
  const eligible = m.pools.filter(p => p.eligible).length;
  const rows = shown.map(({p, i}) => `${field(`pools.${i}.count`, p.name, p.count, {type: 'number', min: 0, max: p.capacity, placeholder: '0', help: p.eligible ? `${p.capacity} available · 0 = not needed` : `This is a ${p.kind} pool, which a ${m.kind} step may not use. Set it to 0.`, desc: `se-err-pools-${i}`})}`.replace('</div>', `${err(`pools.${i}`)}</div>`)).join('');
  const none = !eligible ? `<p class="se-help se-empty" id="se-no-pools">${kind === 'people' ? 'This process defines no shared people pool. Add one in the Definition editor.' : `This process has no ${kind} pool. Add a ${kind} pool in the Definition editor (set its kind to ${kind}) before this step can run.`}</p>` : '';
  const intro = m.kind === 'task' ? 'How many of each shared people pool one visit holds while it is working.' : `How many of each ${kind} pool one run holds while it is working. Only ${kind} pools can be used here.`;
  return section('people', title, intro, `${none}${rows ? `<div class="se-grid">${rows}</div>` : ''}<p class="se-summary" id="se-needs-summary"></p>${err('pools')}`);
 }
 function effects(m: M): string {
  if (m.kind !== 'timer' && !work(m)) return '';
  const sets = m.set.map((r, i) => `<fieldset class="se-card"><legend>Value ${i + 1}</legend><div class="se-grid">${field(`set.${i}.key`, 'Field name', r.key, {desc: 'se-err-set'})}${valueEditor(`set.${i}.value`, r.value, 'se-err-set')}</div>${button('remove-set', 'Remove', i, '', `Remove value ${i + 1}${r.key ? ' ' + r.key : ''}`)}</fieldset>`).join('');
  const adds = m.add.map((r, i) => `<fieldset class="se-card"><legend>Counter ${i + 1}</legend><div class="se-grid">${field(`add.${i}.key`, 'Counter field name', r.key, {desc: 'se-err-add'})}${field(`add.${i}.delta`, 'Change (whole number, may be negative)', r.delta, {type: 'number', desc: 'se-err-add', placeholder: '1'})}</div>${button('remove-add', 'Remove', i, '', `Remove counter ${i + 1}${r.key ? ' ' + r.key : ''}`)}</fieldset>`).join('');
  return section('effects', 'When this step completes', 'Each case keeps these values for later steps, conditions and the run report.',
   `<h4>Set a value</h4>${sets || '<p class="se-help">No values are set.</p>'}${err('set')}${button('add-set', 'Add value', undefined, ' id="se-add-set"')}<h4>Change a counter</h4>${adds || '<p class="se-help">No counters change.</p>'}${err('add')}${button('add-add', 'Add counter', undefined, ' id="se-add-add"')}`);
 }
 function outputs(m: M): string {
  if (!work(m)) return '';
  const rows = m.outputs.map((o, i) => `<fieldset class="se-card"><legend>Output ${i + 1}</legend><div class="se-grid">${field(`outputs.${i}.field`, 'Output field', o.field, {desc: `se-err-outputs-${i}`})}${field(`outputs.${i}.label`, 'Label (optional)', o.label)}</div>${err(`outputs.${i}`)}${button('remove-output', 'Remove', i, '', `Remove output ${i + 1}${o.field ? ' ' + o.field : ''}`)}</fieldset>`).join('');
  return section('outputs', 'Declared outputs', 'The fields this step promises to deliver, shown to anyone reading the process. Each one must also be set or counted in "When this step completes".',
   (rows || '<p class="se-help">No outputs are declared.</p>') + err('outputs') + button('add-output', 'Add output', undefined, ' id="se-add-output"'));
 }
 function needs(m: M): string {
  if (m.kind === 'start') return '';
  const rows = m.needs.map((n, j) => `<fieldset class="se-card"><legend>Need ${j + 1}</legend><div class="se-grid">${field(`needs.${j}.field`, 'Field earlier steps must deliver', n.field, {desc: `se-err-needs-${j}`})}${select(`needs.${j}.op`, 'Condition', [['', 'Only that it is delivered'], ...root.LWProcessStepModel.OPS], n.op, true)}
   ${n.op ? valueEditor(`needs.${j}.value`, n.value, `se-err-needs-${j}`) : ''}${field(`needs.${j}.label`, 'Label (optional)', n.label)}</div>${err(`needs.${j}`)}${button('remove-need', 'Remove', j, '', `Remove need ${j + 1}${n.field ? ' ' + n.field : ''}`)}</fieldset>`).join('');
  return section('needs', 'Needs from earlier steps', 'This step waits until earlier steps have delivered these fields. A counter can only be required as delivered; the engine rejects a value test on a counter because its value cannot be proven.',
   (rows || '<p class="se-help">No needs.</p>') + button('add-need', 'Add need', undefined, ' id="se-add-need"'));
 }
 function backlog(m: M): string {
  const b = m.backlog; if (!b) return '';
  const body = b.on ? `<div class="se-grid">${field('backlog.capacity', 'Backlog capacity (1 to 200)', b.capacity, {type: 'number', min: 1, max: 200, placeholder: '8', desc: 'se-err-backlog'})}${select('backlog.order', 'Order', [['fifo', 'Oldest first'], ['lifo', 'Newest first'], ['priority', 'Highest priority field first']], b.order, true)}
   ${b.order === 'priority' ? field('backlog.priority', 'Priority field (numeric case value)', b.priority) : ''}${m.kind === 'join' ? field('backlog.pull', 'Pull limit (work allowed in the next step; blank for no limit)', b.pull, {type: 'number', min: 1, max: 200, placeholder: 'No limit'}) : ''}</div>` : '';
  return section('backlog', 'Backlog', 'A bounded store of waiting work before this step.', check('backlog.on', 'Keep a backlog of waiting work', b.on) + body + err('backlog'));
 }
 const show = (v: LWProcessStepModel.Value): string => v.type === 'text' ? `"${v.text}"` : v.type === 'number' ? v.text || '0' : v.type === 'null' ? 'empty' : v.type;
 function pathSummary(m: M): string {
  if (m.kind !== 'decision') return '';
  return m.flows.map(f => {
   const c = f.cond, rule = c.chance !== undefined ? `With a chance of ${Math.round(c.chance * 1000) / 10}%` : !c.on ? 'Otherwise' : `If ${c.field || '(field)'} ${SYMBOL[c.op] ?? c.op} ${c.mode === 'field' ? c.valueField || '(field)' : show(c.value)}`;
   return `<li>${esc(rule)} → ${esc(f.toName)}</li>`;
  }).join('');
 }
 function condition(f: LWProcessStepModel.FlowRow, k: number): string {
  const c = f.cond, b = `flows.${k}.cond`;
  if (c.chance !== undefined) return `<p class="se-help">This path is taken with a chance of ${Math.round(c.chance * 1000) / 10}%. Chance paths are edited in the Definition editor.</p>`;
  if (!c.on) return check(b + '.on', 'Take this path only when a condition is met', false) + '<p class="se-help">No condition: this is the fallback path, used when no other path matches.</p>';
  return check(b + '.on', 'Take this path only when a condition is met', true) + `<div class="se-grid">${field(b + '.field', 'Case field to test', c.field)}${select(b + '.op', 'Condition', root.LWProcessStepModel.OPS, c.op)}</div>`
   + radios(b + '.mode', 'Compare with', [['value', 'A value'], ['field', 'Another field']], c.mode)
   + (c.mode === 'field' ? `<div class="se-grid">${field(b + '.valueField', 'Other case field to compare with', c.valueField)}</div>` : `<div class="se-grid">${valueEditor(b + '.value', c.value, `se-err-flows-${k}`)}</div>`);
 }
 function flows(m: M): string {
  const note = 'Connections between steps are fixed here. To add or remove a flow, edit the raw JSON draft in the Definition editor.';
  if (!m.flows.length) return section('flows', 'Where work goes next', 'This step ends the process, so it has no outgoing flows. ' + note, '');
  const decision = m.kind === 'decision', rows = m.flows.map((f, k) => {
   const moves = decision && m.flows.length > 1 ? `<div class="se-actions">${button('up', 'Move up', k, k === 0 ? ' disabled aria-describedby="se-first"' : '')}${button('down', 'Move down', k, k === m.flows.length - 1 ? ' disabled aria-describedby="se-last"' : '')}<span class="se-help">${k === 0 ? 'Checked first. Cannot move up.' : k === m.flows.length - 1 ? 'Checked last. Cannot move down.' : `Position ${k + 1} of ${m.flows.length}.`}</span></div>` : '';
   return `<fieldset class="se-card"><legend>Path ${k + 1} of ${m.flows.length} · to ${esc(f.toName)}</legend>${field(`flows.${k}.label`, 'Label shown on this path', f.label)}${decision || f.cond.on ? condition(f, k) : ''}${err(`flows.${k}`)}${moves}</fieldset>`;
  }).join('');
  const summary = decision ? `<ol class="se-paths" id="se-path-summary" aria-label="Order in which the paths are checked">${pathSummary(m)}</ol>` : '';
  return section('flows', 'Where work goes next', (decision ? 'The first path whose condition matches wins, so order matters; the path without a condition is the fallback. ' : '') + note, summary + rows);
 }
 const render = (m: M) => [basics, timing, automation, people, effects, outputs, needs, backlog, flows].map(f => f(m)).join('');
 root.LWProcessStepSections = {render, pathSummary, idOf};
})(globalThis);
