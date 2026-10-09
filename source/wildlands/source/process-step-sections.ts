/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-step-model.ts" />
/// <reference path="./process-step-logic-sections.ts" />
/**
 * Pure HTML for the step editor sections (basics, journey, outcome, timing and cost, automation, people or equipment, effects,
 * declared outputs, needs, backlog, flows and journey notes, plus branching for forks and multiple instances and a deadline for work steps). It renders a detached `LWProcessStepModel.Model` to a string and owns the stable element ids
 * (`se-<bind with dots as dashes>`) and error slots (`data-errs`); it never touches the DOM, a session or storage.
 */
declare namespace LWProcessStepSections {
 interface Opt {type?: 'number' | undefined; min?: number; max?: number; step?: string; help?: string; long?: boolean; desc?: string; placeholder?: string; autofocus?: boolean; maxlength?: number; counter?: string; badge?: string | undefined; list?: string | undefined}
 /** The shared control builders; the BPMN-class sections reuse them so every control keeps the `se-<bind>` id scheme and error slots. */
 interface Kit {
  esc(v: unknown): string; slug(bind: string): string; idOf(bind: string): string;
  field(bind: string, label: string, value: string, o?: Opt): string;
  /** `blocked` is the id of a visible explanation: the select is then disabled and described by it. */
  select(bind: string, label: string, options: [string, string][], value: string, rerender?: boolean, help?: string, blocked?: string): string;
  check(bind: string, label: string, on: boolean): string;
  radios(bind: string, legend: string, options: [string, string][], value: string): string;
  valueEditor(bind: string, v: LWProcessStepModel.Value, desc: string, about?: string): string;
  section(id: string, title: string, intro: string, body: string): string;
  button(act: string, label: string, i?: number, extra?: string, aria?: string): string;
  err(key: string): string;
 }
 interface Ui {notesOpen?: boolean; deadlineHelp?: boolean; canOpenDefinition?: boolean}
 interface Api {
  /** All sections for the model's kind, in reading order. `notesOpen` keeps the collapsed Journey notes expanded across re-renders. */
  render(model: LWProcessStepModel.Model, ui?: Ui): string;
  /** The ordered one-line summary items of the paths of a decision or inclusive fork ("If iteration < iterations AND 8% of cases → Planning"); '' for other kinds. */
  pathSummary(model: LWProcessStepModel.Model): string;
  idOf(bind: string): string;
  /** Live sentences by element id (instances, deadline, branching) for the editor to refresh while typing. */
  notes(model: LWProcessStepModel.Model): Record<string, string>;
  kit: Kit;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessStepModel: LWProcessStepModel.Api; LWProcessRandomView: LWProcessRandomView.Api; LWProcessStepLogicSections: LWProcessStepLogicSections.Api; LWProcessStepLogic: LWProcessStepLogic.Api; LWProcessStepSections?: LWProcessStepSections.Api};
 type M = LWProcessStepModel.Model;
 const esc = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
 const slug = (bind: string) => bind.replace(/\./g, '-'), idOf = (bind: string) => 'se-' + slug(bind);
 const TYPES: [string, string][] = [['text', 'Text'], ['number', 'Number'], ['true', 'True'], ['false', 'False'], ['null', 'Empty (null)']];
 const KIND_HELP: Record<string, string> = {task: 'Work done by people over time.', touchpoint: 'A moment where a customer or user meets your business, such as a web page, a phone call or a delivery.', machine: 'Work done automatically by physical equipment over time. No people are needed.', system: 'Work done automatically by software over time. No people are needed.',
  timer: 'Holds work without using people or equipment.', decision: 'Chooses one path for each case.', join: 'Waits for parallel paths to arrive.', fork: 'Starts parallel paths.', start: 'Where cases enter.', end: 'Where cases leave.'};
 const KIND_LABEL: Record<string, string> = {task: 'Task', touchpoint: 'Touchpoint', machine: 'Machine step', system: 'System step'};
 const err = (key: string) => `<div class="se-errs" data-errs="${key}" id="se-err-${slug(key)}"></div>`;
 type Opt = LWProcessStepSections.Opt;
 function field(bind: string, label: string, value: string, o: Opt = {}): string {
  const id = idOf(bind), desc = [o.help ? id + '-help' : '', o.counter ?? '', o.desc ?? ''].filter(Boolean).join(' '), ph = o.placeholder ? ` placeholder="${esc(o.placeholder)}"` : '';
  const attrs = `id="${id}" data-bind="${bind}"${desc ? ` aria-describedby="${desc}"` : ''}${ph}${o.autofocus ? ' autofocus' : ''}${o.list ? ` list="${o.list}" autocomplete="off"` : ''}`;
  const control = o.long ? `<textarea ${attrs} rows="${o.maxlength === undefined ? 3 : 2}" maxlength="${o.maxlength ?? 2000}">${esc(value)}</textarea>`
   : o.type === 'number' ? `<input ${attrs} type="number" inputmode="numeric" step="${o.step ?? '1'}"${o.min === undefined ? '' : ` min="${o.min}"`}${o.max === undefined ? '' : ` max="${o.max}"`} value="${esc(value)}">`
   : `<input ${attrs} type="text" maxlength="${o.maxlength ?? 256}" value="${esc(value)}">`;
  return `<div class="se-field"><label for="${id}">${esc(label)}${o.badge ? ` <span class="se-badge">${esc(o.badge)}</span>` : ''}</label>${control}${o.help ? `<p class="se-help" id="${id}-help">${esc(o.help)}</p>` : ''}${o.counter ? `<p class="se-help se-count" id="${o.counter}"></p>` : ''}</div>`;
 }
 const select = (bind: string, label: string, options: [string, string][], value: string, rerender = false, help = '', blocked = '') =>
  `<div class="se-field"><label for="${idOf(bind)}">${esc(label)}</label><select id="${idOf(bind)}" data-bind="${bind}"${rerender ? ' data-rerender' : ''}${blocked ? ` disabled aria-describedby="${blocked}"` : help ? ` aria-describedby="${idOf(bind)}-help"` : ''}>${options.map(([v, t]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>${help ? `<p class="se-help" id="${idOf(bind)}-help">${esc(help)}</p>` : ''}</div>`;
 const check = (bind: string, label: string, on: boolean) => `<label class="se-check"><input type="checkbox" id="${idOf(bind)}" data-bind="${bind}" data-rerender${on ? ' checked' : ''}> ${esc(label)}</label>`;
 const radios = (bind: string, legend: string, options: [string, string][], value: string) =>
  `<fieldset class="se-radios"><legend>${esc(legend)}</legend>${options.map(([v, t]) => `<label class="se-check"><input type="radio" name="${idOf(bind)}" id="${idOf(bind)}-${v}" data-bind="${bind}" data-rerender value="${v}"${v === value ? ' checked' : ''}> ${esc(t)}</label>`).join('')}</fieldset>`;
 const valueEditor = (bind: string, v: LWProcessStepModel.Value, desc: string, about = '') =>
  select(bind + '.type', 'Type of value' + about, TYPES, v.type, true) + (v.type === 'text' || v.type === 'number' ? field(bind + '.text', 'Value' + about, v.text, {type: v.type === 'number' ? 'number' : undefined, step: 'any', desc, placeholder: v.type === 'number' ? '0' : ''}) : '');
 const section = (id: string, title: string, intro: string, body: string) =>
  `<section class="se-section" aria-labelledby="se-h-${id}"><h3 id="se-h-${id}">${esc(title)}</h3>${intro ? `<p class="se-help">${esc(intro)}</p>` : ''}${body}</section>`;
 const button = (act: string, label: string, i?: number, extra = '', aria = '') => `<button type="button" data-act="${act}"${i === undefined ? '' : ` data-i="${i}"`}${aria ? ` aria-label="${esc(aria)}"` : ''}${extra}>${esc(label)}</button>`;
 const KIND_BADGE: Record<string, string> = {people: 'People', machine: 'Machine', system: 'System'};
 const work = (m: M) => root.LWProcessStepModel.isWork(m.kind);
 function basics(m: M): string {
  return section('basics', 'Basics', KIND_HELP[m.kind] ?? '', `<div class="se-grid">${field('name', 'Name', m.name, {desc: 'se-err-name', autofocus: true})}${field('description', 'Description', m.description, {long: true, desc: 'se-err-description'})}</div>${err('name')}${err('description')}`);
 }
 function timing(m: M): string {
  if (m.kind !== 'timer' && !work(m)) return '';
  if (work(m)) {
   const label = KIND_LABEL[m.kind]!;
   return section('timing', 'Timing and cost', m.kind === 'task' || m.kind === 'touchpoint' ? 'How long one visit takes and what each visit costs.' : 'How long one run takes and what each run costs.',
    `<div class="se-grid">${field('duration', `${label} duration (minutes, at least 1)`, m.duration, {type: 'number', min: 1, desc: 'se-err-duration', placeholder: '1'})}${field('cost', 'Fixed cost per visit (whole number, 0 or more)', m.cost, {type: 'number', min: 0, desc: 'se-err-cost', placeholder: '0'})}</div>${err('duration')}${err('cost')}`);
  }
  const value = m.mode === 'until' ? field('until', 'Absolute minute to wait until (at least 1)', m.until, {type: 'number', min: 1, desc: 'se-err-until', placeholder: '1'}) : field('duration', 'Wait duration (minutes, at least 1)', m.duration, {type: 'number', min: 1, desc: 'se-err-duration', placeholder: '1'});
  return section('timing', 'Timing', 'A timer holds work without using people, equipment or cost.', `${radios('mode', 'What does this timer wait for?', [['duration', 'Wait a duration'], ['until', 'Wait until a minute']], m.mode)}<div class="se-grid">${value}</div>${err(m.mode === 'until' ? 'until' : 'duration')}`);
 }
 function randomTiming(m: M): string {
  if (!root.LWProcessStepModel.timingAllowed(m)) return '';
  const t = m.timing;
  return section('random-timing', 'Random timing', 'Optional. Without it every visit takes exactly the planning duration. Times are whole minutes, repeatable for the same seed.',
   `${root.LWProcessStepLogicSections.dist('timing', t, 'se-err-timing', 'None: always the planning duration')}${t.dist ? `<p class="se-help" id="se-timing-note">${esc(root.LWProcessStepModel.timingNote(m))}</p>` : ''}${err('timing')}`);
 }
 function automation(m: M): string {
  if (m.kind !== 'machine' && m.kind !== 'system') return '';
  const eg = m.kind === 'machine' ? 'Robot arm or CNC mill' : 'CI/CD pipeline or API service';
  return section('automation', 'Automation', 'This step runs automatically. Nothing is executed or contacted; the numbers here are simulation assumptions.',
   `<div class="se-grid">${field('technology', 'Technology (optional)', m.technology, {desc: 'se-err-technology', maxlength: 80, counter: 'se-technology-count', help: `A label only, such as ${eg}.`})}</div>${err('technology')}`);
 }
 function people(m: M): string {
  if (!work(m)) return '';
  const kind = root.LWProcessStepModel.poolKind(m.kind), touch = m.kind === 'touchpoint', title = touch ? 'Backstage teams and systems (optional)' : m.kind === 'task' ? 'People and capacity' : m.kind === 'machine' ? 'Equipment' : 'Systems';
  const shown = m.pools.map((p, i) => ({p, i})).filter(({p}) => p.eligible || (Number(p.count) || 0) > 0);
  const eligible = m.pools.filter(p => p.eligible).length;
  const rows = shown.map(({p, i}) => `${field(`pools.${i}.count`, p.name, p.count, {type: 'number', min: 0, max: p.capacity, placeholder: '0', badge: touch ? KIND_BADGE[p.kind] : undefined, help: p.eligible ? `${p.capacity} available · 0 = not needed` : `This is a ${p.kind} pool, which a ${m.kind} step may not use. Set it to 0.`, desc: `se-err-pools-${i}`})}`.replace('</div>', `${err(`pools.${i}`)}</div>`)).join('');
  const none = !eligible ? `<p class="se-help se-empty" id="se-no-pools">${touch ? 'This process defines no shared pools, so nothing serves this touchpoint from backstage. That is fine; add a people, machine or system pool in the Definition editor if you want it to use capacity.' : kind === 'people' ? 'This process defines no shared people pool. Add one in the Definition editor.' : `This process has no ${kind} pool. Add a ${kind} pool in the Definition editor (set its kind to ${kind}) before this step can run.`}</p>` : '';
  const intro = touch ? 'Optional. Choose the people, machine or system pools that serve this interaction behind the scenes while it runs. Customers and users are not a pool and never consume capacity; with nothing chosen the touchpoint never waits.' : m.kind === 'task' ? 'How many of each shared people pool one visit holds while it is working.' : `How many of each ${kind} pool one run holds while it is working. Only ${kind} pools can be used here.`;
  return section('people', title, intro, `${none}${rows ? `<div class="se-grid">${rows}</div>` : ''}<p class="se-summary" id="se-needs-summary"></p>${err('pools')}`);
 }
 function effects(m: M): string {
  if (m.kind !== 'timer' && !work(m)) return '';
  const sets = m.set.map((r, i) => `<fieldset class="se-card"><legend>Value ${i + 1}</legend><div class="se-grid">${field(`set.${i}.key`, 'Field name', r.key, {desc: 'se-err-set'})}${valueEditor(`set.${i}.value`, r.value, 'se-err-set')}</div>${button('remove-set', 'Remove', i, '', `Remove value ${i + 1}${r.key ? ' ' + r.key : ''}`)}</fieldset>`).join('');
  const adds = m.add.map((r, i) => `<fieldset class="se-card"><legend>Counter ${i + 1}</legend><div class="se-grid">${field(`add.${i}.key`, 'Counter field name', r.key, {desc: 'se-err-add'})}${field(`add.${i}.delta`, 'Change (whole number, may be negative)', r.delta, {type: 'number', desc: 'se-err-add', placeholder: '1'})}</div>${button('remove-add', 'Remove', i, '', `Remove counter ${i + 1}${r.key ? ' ' + r.key : ''}`)}</fieldset>`).join('');
  return section('effects', 'When this step completes', 'Each case keeps these values for later steps, conditions and the run report.',
   `<h4>Set a value</h4>${sets || '<p class="se-help">No values are set.</p>'}${err('set')}${button('add-set', 'Add value', undefined, ' id="se-add-set"')}<h4>Change a counter</h4>${adds || '<p class="se-help">No counters change.</p>'}${err('add')}${button('add-add', 'Add counter', undefined, ' id="se-add-add"')}`);
 }
 const DRAW_KINDS: [string, string][] = [['chance', 'Chance (yes or no)'], ['choice', 'Weighted choice'], ['int', 'Whole number']];
 function drawBody(r: LWProcessStepModel.DrawRow, i: number): string {
  const b = `draws.${i}`, desc = `se-err-draws-${i}`, L = root.LWProcessStepModel.LIMITS;
  if (r.kind === 'chance') return `<div class="se-grid">${field(b + '.percent', 'Chance of yes (percent, 1 to 99)', r.percent, {type: 'number', min: 1, max: 99, desc, placeholder: '10'})}${valueEditor(b + '.whenTrue', r.whenTrue, desc, ' for yes')}${valueEditor(b + '.whenFalse', r.whenFalse, desc, ' for no')}</div>`;
  if (r.kind === 'int') return `<div class="se-grid">${field(b + '.min', 'Lowest (whole number)', r.min, {type: 'number', desc})}${field(b + '.max', 'Highest (whole number)', r.max, {type: 'number', desc})}</div>`;
  const rows = r.values.map((v, j) => `<fieldset class="se-card"><legend>Value ${j + 1}</legend><div class="se-grid">${valueEditor(`${b}.values.${j}.value`, v.value, desc, ` ${j + 1}`)}${field(`${b}.values.${j}.weight`, `Weight ${j + 1} (whole number, 1 to 1,000)`, v.weight, {type: 'number', min: 1, max: 1000, desc, placeholder: '1'})}</div>`
   + (r.values.length <= L.minChoices ? `${button('remove-choice', 'Remove', i, ` data-j="${j}" disabled aria-describedby="se-min-choices-${i}"`, `Remove value ${j + 1}`)}<span class="se-help" id="se-min-choices-${i}">A weighted choice needs at least ${L.minChoices} values.</span>` : button('remove-choice', 'Remove', i, ` data-j="${j}"`, `Remove value ${j + 1} of random field ${i + 1}`)) + '</fieldset>').join('');
  const full = r.values.length >= L.choices;
  return `${rows}${button('add-choice', 'Add value', i, ` id="se-add-choice-${i}"${full ? ` disabled aria-describedby="se-max-choices-${i}"` : ''}`, `Add value to random field ${i + 1}`)}${full ? `<span class="se-help" id="se-max-choices-${i}">At most ${L.choices} values.</span>` : ''}`;
 }
 function draws(m: M): string {
  if (m.kind !== 'timer' && !work(m)) return '';
  const L = root.LWProcessStepModel.LIMITS, full = m.draws.length >= L.draws;
  const rows = m.draws.map((r, i) => `<fieldset class="se-card"><legend>Random field ${i + 1}${r.field ? ' · ' + esc(r.field) : ''}</legend><div class="se-grid">${field(`draws.${i}.field`, 'Field name', r.field, {desc: `se-err-draws-${i}`})}${select(`draws.${i}.kind`, 'Kind of draw', DRAW_KINDS, r.kind, true)}</div>${drawBody(r, i)}${err(`draws.${i}`)}${button('remove-draw', 'Remove random field', i, '', `Remove random field ${i + 1}${r.field ? ' ' + r.field : ''}`)}</fieldset>`).join('');
  return section('random-outcomes', 'Random outcomes (draws)', 'Drawn values are applied when the step completes, after Set values and before counters. Each case draws its own value, repeatable for the same seed.',
   (rows || '<p class="se-help">No random fields.</p>') + button('add-draw', 'Add random field', undefined, ` id="se-add-draw"${full ? ' disabled aria-describedby="se-max-draws"' : ''}`) + (full ? `<span class="se-help" id="se-max-draws">At most ${L.draws} random fields per step.</span>` : ''));
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
 function flows(m: M): string {
  const note = 'Connections between steps are fixed here. To add or remove a flow, edit the raw JSON draft in the Definition editor.';
  if (!m.flows.length) return section('flows', 'Where work goes next', 'This step ends the process, so it has no outgoing flows. ' + note, '');
  const logic = root.LWProcessStepLogicSections, decision = m.kind === 'decision', inclusive = m.branching === 'inclusive', conditional = decision || inclusive, deadline = m.flows.some(f => root.LWProcessStepLogic.isDeadlineFlow(m, f.id));
  const rows = m.flows.map((f, k) => {
   const late = root.LWProcessStepLogic.isDeadlineFlow(m, f.id);
   const moves = decision && m.flows.length > 1 ? `<div class="se-actions">${button('up', 'Move up', k, k === 0 ? ' disabled aria-describedby="se-first"' : '')}${button('down', 'Move down', k, k === m.flows.length - 1 ? ' disabled aria-describedby="se-last"' : '')}<span class="se-help">${k === 0 ? 'Checked first. Cannot move up.' : k === m.flows.length - 1 ? 'Checked last. Cannot move down.' : `Position ${k + 1} of ${m.flows.length}.`}</span></div>` : '';
   const rule = late ? '<p class="se-help">This is the deadline path: it is taken when the deadline fires and takes no condition.</p>' : conditional || f.cond.on ? logic.condition(m, f, k) : '';
   return `<fieldset class="se-card${late ? ' se-deadline-path' : ''}"><legend>Path ${k + 1} of ${m.flows.length} · to ${esc(f.toName)}${late ? ' · deadline path' : ''}</legend>${field(`flows.${k}.label`, 'Label shown on this path', f.label)}${rule}${err(`flows.${k}`)}${moves}</fieldset>`;
  }).join('');
  const summary = conditional ? `<ol class="se-paths" id="se-path-summary" aria-label="${decision ? 'Order in which the paths are checked' : 'Branches and the conditions that start them'}">${logic.pathSummary(m)}</ol>` : '';
  const intro = (decision ? 'The first path whose condition matches wins, so order matters; the path without a condition is the fallback. ' : inclusive ? 'Every branch whose condition is true starts. The branch without a condition is the default: it starts only when no other branch matches. ' : '') + (deadline ? 'The deadline path is taken when the deadline fires. ' : '') + note;
  return section('flows', 'Where work goes next', intro, summary + rows);
 }
 const feelings = (): [string, string][] => [['', 'Not set'], ...root.LWProcessRandomView.EMOTIONS.map(([n, words]): [string, string] => [String(n), `${words} (${n > 0 ? '+' : ''}${n})`])];
 /** The shared journey fields. `touch` adds the channel. */
 function journeyFields(m: M, touch: boolean): string {
  const phases = m.phases.length ? `<datalist id="se-phase-list">${m.phases.map(p => `<option value="${esc(p)}"></option>`).join('')}</datalist>` : '', L = root.LWProcessStepModel.LIMITS;
  const channel = touch ? select('channel', 'Channel', [['', 'Not set'], ...root.LWProcessRandomView.CHANNELS], m.channel, false, 'Where the customer or user meets this step.') : '';
  return `<div class="se-grid">${field('phase', `Phase (optional, up to ${L.phase} characters)`, m.phase, {desc: 'se-err-phase', maxlength: L.phase, list: phases ? 'se-phase-list' : undefined, help: 'The stage this step belongs to, such as Awareness or Purchase. Steps with the same phase are grouped together.'})}${phases}${channel}`
   + `${select('emotion', 'Feeling (optional)', feelings(), m.emotion, false, 'How the customer or user is expected to feel after this step, from very frustrated to delighted.')}</div>${err('phase')}${touch ? err('channel') : ''}${err('emotion')}`
   + `<div class="se-grid">${field('pain', `Pain point (optional, up to ${L.note} characters)`, m.pain, {long: true, desc: 'se-err-pain', maxlength: L.note, help: 'What gets in the way here.'})}${field('opportunity', `Opportunity (optional, up to ${L.note} characters)`, m.opportunity, {long: true, desc: 'se-err-opportunity', maxlength: L.note, help: 'What could be improved here.'})}</div>${err('pain')}${err('opportunity')}`;
 }
 function journey(m: M): string {
  if (m.kind !== 'touchpoint') return '';
  return section('journey', 'Journey', 'Where this interaction sits in the customer or user journey. These notes are shown in the journey view and do not change how the simulation runs.', journeyFields(m, true));
 }
 function notes(m: M, open: boolean): string {
  if (m.kind === 'touchpoint') return '';
  const used = !!(m.phase || m.emotion || m.pain || m.opportunity);
  return `<section class="se-section" aria-labelledby="se-h-notes"><details class="se-notes" id="se-notes"${open || used ? ' open' : ''}><summary id="se-h-notes">Journey notes (optional)</summary><p class="se-help">Group this step into a phase and note how people feel, what hurts and what could be better. These notes do not change how the simulation runs.</p>${journeyFields(m, false)}</details></section>`;
 }
 function outcome(m: M): string {
  if (m.kind !== 'end') return '';
  return section('outcome', 'Outcome', 'Whether a case that reaches this step achieved what it came for. The run counts goals and losses and reports the conversion rate.',
   `<div class="se-grid">${select('outcome', 'Outcome', [['', 'None'], ['goal', root.LWProcessRandomView.describeOutcome('goal')], ['lost', root.LWProcessRandomView.describeOutcome('lost')]], m.outcome, false, 'With None, cases ending here are finished but count as neither a goal nor a loss.')}</div>${err('outcome')}`);
 }
 const render = (m: M, ui: LWProcessStepSections.Ui = {}) => [basics, root.LWProcessStepLogicSections.branching, outcome, journey, timing, randomTiming, automation, people, root.LWProcessStepLogicSections.instances, (x: M) => root.LWProcessStepLogicSections.deadline(x, ui), effects, draws, outputs, needs, backlog, (x: M) => notes(x, !!ui.notesOpen), flows].map(f => f(m)).join('');
 const pathSummary = (m: M) => root.LWProcessStepLogicSections.pathSummary(m);
 root.LWProcessStepSections = {render, pathSummary, idOf, notes: m => root.LWProcessStepLogicSections.notes(m), kit: {esc, slug, idOf, field, select, check, radios, valueEditor, section, button, err}};
})(globalThis);
