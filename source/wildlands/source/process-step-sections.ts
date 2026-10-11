/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-html.ts" />
/// <reference path="./process-step-model.ts" />
/// <reference path="./process-step-kit.ts" />
/// <reference path="./process-step-logic-sections.ts" />
/// <reference path="./process-step-flows.ts" />
/**
 * Pure HTML for the step editor sections (basics, journey, outcome, timing and cost, automation, people or equipment, effects,
 * declared outputs, needs, backlog, flows and journey notes, plus branching for forks and multiple instances and a deadline for
 * work steps). It renders a detached `LWProcessStepModel.Model` to a string with the control kit (LWProcessStepKit, which owns
 * the stable element ids `se-<bind with dots as dashes>` and the error slots `data-errs`); it never touches the DOM, a session or
 * storage. Free text it writes itself goes through LWProcessHtml's `esc`.
 */
declare namespace LWProcessStepSections {
 type Opt = LWProcessStepKit.Opt;
 /** The shared control builders (LWProcessStepKit), also reachable here as `kit`. */
 type Kit = LWProcessStepKit.Api;
 interface Ui extends LWProcessStepFlows.Ui {notesOpen?: boolean}
 interface Api {
  /** All sections for the model's kind, in reading order. `notesOpen` keeps the collapsed Journey notes expanded across re-renders. */
  render(model: LWProcessStepModel.Model, ui?: Ui): string;
  /**
   * The ordered one-line summary items of the paths of a decision or inclusive fork ("If iteration < iterations AND 8% of cases →
   * Planning"); '' for other kinds.
   */
  pathSummary(model: LWProcessStepModel.Model): string;
  idOf(bind: string): string;
  /** Live sentences by element id (instances, deadline, branching) for the editor to refresh while typing. */
  notes(model: LWProcessStepModel.Model): Record<string, string>;
  kit: Kit;
  /** Datalist ids of the case-field suggestions rendered with the sections. */
  LISTS: {earlier: string; after: string; all: string};
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {
  LWProcessHtml: LWProcessHtml.Api; LWProcessStepKit: LWProcessStepKit.Api; LWProcessStepModel: LWProcessStepModel.Api;
  LWProcessRandomView: LWProcessRandomView.Api; LWProcessStepLogicSections: LWProcessStepLogicSections.Api; LWProcessStepLogic: LWProcessStepLogic.Api;
  LWProcessStepFlows: LWProcessStepFlows.Api; LWProcessStepSections?: LWProcessStepSections.Api;
 };
 type M = LWProcessStepModel.Model;
 const {esc} = root.LWProcessHtml;
 const kit = root.LWProcessStepKit;
 const {idOf, field, select, check, radios, valueEditor, section, button, err} = kit;
 const KIND_HELP: Record<string, string> = {
  task: 'Work done by people over time.',
  touchpoint: 'A moment where a customer or user meets your business, such as a web page, a phone call or a delivery.',
  machine: 'Work done automatically by physical equipment over time. No people are needed.',
  system: 'Work done automatically by software over time. No people are needed.',
  timer: 'Holds work without using people or equipment.',
  decision: 'Chooses one path for each case.',
  join: 'Waits for parallel paths to arrive.',
  fork: 'Starts parallel paths.',
  start: 'Where cases enter.',
  end: 'Where cases leave.',
 };
 const KIND_LABEL: Record<string, string> = {task: 'Task', touchpoint: 'Touchpoint', machine: 'Machine step', system: 'System step'};
 const KIND_BADGE: Record<string, string> = {people: 'People', machine: 'Machine', system: 'System'};
 const work = (m: M) => root.LWProcessStepModel.isWork(m.kind);
 function basics(m: M): string {
  const name = field('name', 'Name', m.name, {desc: 'se-err-name', autofocus: true});
  const description = field('description', 'Description', m.description, {long: true, desc: 'se-err-description'});
  return section('basics', 'Basics', KIND_HELP[m.kind] ?? '', `<div class="se-grid">${name}${description}</div>${err('name')}${err('description')}`);
 }
 function timing(m: M): string {
  if (m.kind !== 'timer' && !work(m)) return '';
  if (work(m)) {
   const label = KIND_LABEL[m.kind]!;
   const intro = m.kind === 'task' || m.kind === 'touchpoint' ? 'How long one visit takes and what each visit costs.'
    : 'How long one run takes and what each run costs.';
   const duration = field('duration', `${label} duration (minutes, at least 1)`, m.duration,
    {type: 'number', min: 1, desc: 'se-err-duration', placeholder: '1'});
   const cost = field('cost', 'Fixed cost per visit (whole number, 0 or more)', m.cost, {type: 'number', min: 0, desc: 'se-err-cost', placeholder: '0'});
   return section('timing', 'Timing and cost', intro, `<div class="se-grid">${duration}${cost}</div>${err('duration')}${err('cost')}`);
  }
  const value = m.mode === 'until'
   ? field('until', 'Absolute minute to wait until (at least 1)', m.until, {type: 'number', min: 1, desc: 'se-err-until', placeholder: '1'})
   : field('duration', 'Wait duration (minutes, at least 1)', m.duration, {type: 'number', min: 1, desc: 'se-err-duration', placeholder: '1'});
  const modes: [string, string][] = [['duration', 'Wait a duration'], ['until', 'Wait until a minute']];
  const body = `${radios('mode', 'What does this timer wait for?', modes, m.mode)}<div class="se-grid">${value}</div>`
   + err(m.mode === 'until' ? 'until' : 'duration');
  return section('timing', 'Timing', 'A timer holds work without using people, equipment or cost.', body);
 }
 function randomTiming(m: M): string {
  if (!root.LWProcessStepModel.timingAllowed(m)) return '';
  const t = m.timing;
  // The whole-minute rounding note (LWProcessRandomView.roundingNote) of the distribution as it would be written, when it biases the mean.
  const rounding = t.dist ? root.LWProcessRandomView.roundingNote(root.LWProcessStepLogic.writeTiming(t)) : null;
  const note = rounding ? `<p class="se-help" id="se-timing-rounding">${esc(rounding)}</p>` : '';
  const plan = t.dist ? `<p class="se-help" id="se-timing-note">${esc(root.LWProcessStepModel.timingNote(m))}</p>` : '';
  const intro = 'Optional. Without it every visit takes exactly the planning duration. Times are whole minutes, repeatable for the same seed.';
  const editor = root.LWProcessStepLogicSections.dist('timing', t, 'se-err-timing', 'None: always the planning duration');
  return section('random-timing', 'Random timing', intro, `${editor}${plan}${note}${err('timing')}`);
 }
 function automation(m: M): string {
  if (m.kind !== 'machine' && m.kind !== 'system') return '';
  const eg = m.kind === 'machine' ? 'Robot arm or CNC mill' : 'CI/CD pipeline or API service';
  const intro = 'This step runs automatically. Nothing is executed or contacted; the numbers here are simulation assumptions.';
  const technology = field('technology', 'Technology (optional)', m.technology,
   {desc: 'se-err-technology', maxlength: 80, counter: 'se-technology-count', help: `A label only, such as ${eg}.`});
  return section('automation', 'Automation', intro, `<div class="se-grid">${technology}</div>${err('technology')}`);
 }
 const PEOPLE_TITLE: Record<string, string> = {touchpoint: 'Backstage teams and systems (optional)', task: 'People and capacity', machine: 'Equipment'};
 /** The explanation shown when no pool may serve the step. */
 function noPools(kind: LWProcess.ResourceKind, touch: boolean): string {
  if (touch) {
   return 'This process defines no shared pools, so nothing serves this touchpoint from backstage. That is fine; add a people, '
    + 'machine or system pool in the Definition editor if you want it to use capacity.';
  }
  if (kind === 'people') return 'This process defines no shared people pool. Add one in the Definition editor.';
  return `This process has no ${kind} pool. Add a ${kind} pool in the Definition editor (set its kind to ${kind}) before this step can run.`;
 }
 function peopleIntro(m: M, kind: LWProcess.ResourceKind): string {
  if (m.kind === 'touchpoint') {
   return 'Optional. Choose the people, machine or system pools that serve this interaction behind the scenes while it runs. '
    + 'Customers and users are not a pool and never consume capacity; with nothing chosen the touchpoint never waits.';
  }
  if (m.kind === 'task') return 'How many of each shared people pool one visit holds while it is working.';
  return `How many of each ${kind} pool one run holds while it is working. Only ${kind} pools can be used here.`;
 }
 /** One pool's demand field; its error slot sits inside the field. */
 function poolField(m: M, p: LWProcessStepModel.Pool, i: number): string {
  const touch = m.kind === 'touchpoint';
  const help = p.eligible ? `${p.capacity} available · 0 = not needed`
   : `This is a ${p.kind} pool, which a ${m.kind} step may not use. Set it to 0.`;
  const badge = touch ? KIND_BADGE[p.kind] : undefined;
  const control = field(`pools.${i}.count`, p.name, p.count,
   {type: 'number', min: 0, max: p.capacity, placeholder: '0', badge, help, desc: `se-err-pools-${i}`});
  return control.replace('</div>', `${err(`pools.${i}`)}</div>`);
 }
 function people(m: M): string {
  if (!work(m)) return '';
  const kind = root.LWProcessStepModel.poolKind(m.kind), touch = m.kind === 'touchpoint';
  const shown = m.pools.map((p, i) => ({p, i})).filter(({p}) => p.eligible || (Number(p.count) || 0) > 0);
  const eligible = m.pools.filter(p => p.eligible).length;
  const rows = shown.map(({p, i}) => poolField(m, p, i)).join('');
  const none = !eligible ? `<p class="se-help se-empty" id="se-no-pools">${noPools(kind, touch)}</p>` : '';
  const body = `${none}${rows ? `<div class="se-grid">${rows}</div>` : ''}<p class="se-summary" id="se-needs-summary"></p>${err('pools')}`;
  return section('people', PEOPLE_TITLE[m.kind] ?? 'Systems', peopleIntro(m, kind), body);
 }
 function setRow(r: LWProcessStepModel.SetRow, i: number): string {
  const key = field(`set.${i}.key`, 'Field name', r.key, {desc: 'se-err-set', list: LISTS.all});
  const value = valueEditor(`set.${i}.value`, r.value, 'se-err-set');
  const remove = button('remove-set', 'Remove', i, '', `Remove value ${i + 1}${r.key ? ' ' + r.key : ''}`);
  return `<fieldset class="se-card"><legend>Value ${i + 1}</legend><div class="se-grid">${key}${value}</div>${remove}</fieldset>`;
 }
 function addRow(r: LWProcessStepModel.AddRow, i: number): string {
  const key = field(`add.${i}.key`, 'Counter field name', r.key, {desc: 'se-err-add', list: LISTS.all});
  const delta = field(`add.${i}.delta`, 'Change (whole number, may be negative)', r.delta, {type: 'number', desc: 'se-err-add', placeholder: '1'});
  const remove = button('remove-add', 'Remove', i, '', `Remove counter ${i + 1}${r.key ? ' ' + r.key : ''}`);
  return `<fieldset class="se-card"><legend>Counter ${i + 1}</legend><div class="se-grid">${key}${delta}</div>${remove}</fieldset>`;
 }
 function effects(m: M): string {
  if (m.kind !== 'timer' && !work(m)) return '';
  const sets = m.set.map(setRow).join(''), adds = m.add.map(addRow).join('');
  const body = `<h4>Set a value</h4>${sets || '<p class="se-help">No values are set.</p>'}${err('set')}`
   + button('add-set', 'Add value', undefined, ' id="se-add-set"')
   + `<h4>Change a counter</h4>${adds || '<p class="se-help">No counters change.</p>'}${err('add')}`
   + button('add-add', 'Add counter', undefined, ' id="se-add-add"');
  return section('effects', 'When this step completes', 'Each case keeps these values for later steps, conditions and the run report.', body);
 }
 const DRAW_KINDS: [string, string][] = [['chance', 'Chance (yes or no)'], ['choice', 'Weighted choice'], ['int', 'Whole number']];
 /** One value of a weighted choice, with its Remove button (disabled while the choice has its minimum number of values). */
 function choiceRow(r: LWProcessStepModel.DrawRow, i: number, v: LWProcessStepModel.ChoiceRow, j: number): string {
  const b = `draws.${i}`, desc = `se-err-draws-${i}`, L = root.LWProcessStepModel.LIMITS;
  const value = valueEditor(`${b}.values.${j}.value`, v.value, desc, ` ${j + 1}`);
  const weight = field(`${b}.values.${j}.weight`, `Weight ${j + 1} (whole number, 1 to 1,000)`, v.weight,
   {type: 'number', min: 1, max: 1000, desc, placeholder: '1'});
  let remove = button('remove-choice', 'Remove', i, ` data-j="${j}"`, `Remove value ${j + 1} of random field ${i + 1}`);
  if (r.values.length <= L.minChoices) {
   remove = button('remove-choice', 'Remove', i, ` data-j="${j}" disabled aria-describedby="se-min-choices-${i}"`, `Remove value ${j + 1}`)
    + `<span class="se-help" id="se-min-choices-${i}">A weighted choice needs at least ${L.minChoices} values.</span>`;
  }
  return `<fieldset class="se-card"><legend>Value ${j + 1}</legend><div class="se-grid">${value}${weight}</div>${remove}</fieldset>`;
 }
 function drawBody(r: LWProcessStepModel.DrawRow, i: number): string {
  const b = `draws.${i}`, desc = `se-err-draws-${i}`, L = root.LWProcessStepModel.LIMITS;
  if (r.kind === 'chance') {
   const percent = field(b + '.percent', 'Chance of yes (percent, 1 to 99)', r.percent, {type: 'number', min: 1, max: 99, desc, placeholder: '10'});
   const yes = valueEditor(b + '.whenTrue', r.whenTrue, desc, ' for yes');
   const no = valueEditor(b + '.whenFalse', r.whenFalse, desc, ' for no');
   return `<div class="se-grid">${percent}${yes}${no}</div>`;
  }
  if (r.kind === 'int') {
   const low = field(b + '.min', 'Lowest (whole number)', r.min, {type: 'number', desc});
   const high = field(b + '.max', 'Highest (whole number)', r.max, {type: 'number', desc});
   return `<div class="se-grid">${low}${high}</div>`;
  }
  const rows = r.values.map((v, j) => choiceRow(r, i, v, j)).join('');
  const full = r.values.length >= L.choices;
  const add = button('add-choice', 'Add value', i, ` id="se-add-choice-${i}"${full ? ` disabled aria-describedby="se-max-choices-${i}"` : ''}`,
   `Add value to random field ${i + 1}`);
  return `${rows}${add}${full ? `<span class="se-help" id="se-max-choices-${i}">At most ${L.choices} values.</span>` : ''}`;
 }
 function drawCard(r: LWProcessStepModel.DrawRow, i: number): string {
  const legend = `Random field ${i + 1}${r.field ? ' · ' + esc(r.field) : ''}`;
  const name = field(`draws.${i}.field`, 'Field name', r.field, {desc: `se-err-draws-${i}`});
  const kind = select(`draws.${i}.kind`, 'Kind of draw', DRAW_KINDS, r.kind, true);
  const remove = button('remove-draw', 'Remove random field', i, '', `Remove random field ${i + 1}${r.field ? ' ' + r.field : ''}`);
  return `<fieldset class="se-card"><legend>${legend}</legend><div class="se-grid">${name}${kind}</div>${drawBody(r, i)}${err(`draws.${i}`)}${remove}`
   + '</fieldset>';
 }
 function draws(m: M): string {
  if (m.kind !== 'timer' && !work(m)) return '';
  const L = root.LWProcessStepModel.LIMITS, full = m.draws.length >= L.draws;
  const rows = m.draws.map(drawCard).join('');
  const intro = 'Drawn values are applied when the step completes, after Set values and before counters. Each case draws its own value, '
   + 'repeatable for the same seed.';
  const add = button('add-draw', 'Add random field', undefined, ` id="se-add-draw"${full ? ' disabled aria-describedby="se-max-draws"' : ''}`);
  const limit = full ? `<span class="se-help" id="se-max-draws">At most ${L.draws} random fields per step.</span>` : '';
  return section('random-outcomes', 'Random outcomes (draws)', intro, (rows || '<p class="se-help">No random fields.</p>') + add + limit);
 }
 function outputRow(o: LWProcessStepModel.OutputRow, i: number): string {
  const name = field(`outputs.${i}.field`, 'Output field', o.field, {desc: `se-err-outputs-${i}`});
  const label = field(`outputs.${i}.label`, 'Label (optional)', o.label);
  const remove = button('remove-output', 'Remove', i, '', `Remove output ${i + 1}${o.field ? ' ' + o.field : ''}`);
  return `<fieldset class="se-card"><legend>Output ${i + 1}</legend><div class="se-grid">${name}${label}</div>${err(`outputs.${i}`)}${remove}</fieldset>`;
 }
 function outputs(m: M): string {
  if (!work(m)) return '';
  const rows = m.outputs.map(outputRow).join('');
  const intro = 'The fields this step promises to deliver, shown to anyone reading the process. Each one must also be set or counted in '
   + '"When this step completes".';
  return section('outputs', 'Declared outputs', intro,
   (rows || '<p class="se-help">No outputs are declared.</p>') + err('outputs') + button('add-output', 'Add output', undefined, ' id="se-add-output"'));
 }
 function needRow(n: LWProcessStepModel.NeedRow, j: number): string {
  const name = field(`needs.${j}.field`, 'Field earlier steps must deliver', n.field, {desc: `se-err-needs-${j}`, list: LISTS.earlier});
  const op = select(`needs.${j}.op`, 'Condition', [['', 'Only that it is delivered'], ...root.LWProcessStepModel.OPS], n.op, true);
  const value = n.op ? valueEditor(`needs.${j}.value`, n.value, `se-err-needs-${j}`) : '';
  const label = field(`needs.${j}.label`, 'Label (optional)', n.label);
  const remove = button('remove-need', 'Remove', j, '', `Remove need ${j + 1}${n.field ? ' ' + n.field : ''}`);
  // The line break and indent inside the card are part of the rendered markup (kept byte for byte).
  return `<fieldset class="se-card"><legend>Need ${j + 1}</legend><div class="se-grid">${name}${op}
   ${value}${label}</div>${err(`needs.${j}`)}${remove}</fieldset>`;
 }
 function needs(m: M): string {
  if (m.kind === 'start') return '';
  const rows = m.needs.map(needRow).join('');
  const intro = 'This step waits until earlier steps have delivered these fields. A counter can only be required as delivered; the engine '
   + 'rejects a value test on a counter because its value cannot be proven.';
  return section('needs', 'Needs from earlier steps', intro,
   (rows || '<p class="se-help">No needs.</p>') + button('add-need', 'Add need', undefined, ' id="se-add-need"'));
 }
 const ORDERS: [string, string][] = [['fifo', 'Oldest first'], ['lifo', 'Newest first'], ['priority', 'Highest priority field first']];
 function backlog(m: M): string {
  const b = m.backlog;
  if (!b) return '';
  let body = '';
  if (b.on) {
   const capacity = field('backlog.capacity', 'Backlog capacity (1 to 200)', b.capacity,
    {type: 'number', min: 1, max: 200, placeholder: '8', desc: 'se-err-backlog'});
   const order = select('backlog.order', 'Order', ORDERS, b.order, true);
   const priority = b.order === 'priority' ? field('backlog.priority', 'Priority field (numeric case value)', b.priority) : '';
   const pull = m.kind === 'join' ? field('backlog.pull', 'Pull limit (work allowed in the next step; blank for no limit)', b.pull,
    {type: 'number', min: 1, max: 200, placeholder: 'No limit'}) : '';
   // The line break and indent inside the grid are part of the rendered markup (kept byte for byte).
   body = `<div class="se-grid">${capacity}${order}
   ${priority}${pull}</div>`;
  }
  const keep = check('backlog.on', 'Keep a backlog of waiting work', b.on);
  return section('backlog', 'Backlog', 'A bounded store of waiting work before this step.', keep + body + err('backlog'));
 }
 /** Suggestion lists for case-field names: delivered earlier (needs), usable by this step's conditions, and every known name. */
 const LISTS = {earlier: 'se-fields-earlier', after: 'se-fields-after', all: 'se-fields-all'} as const;
 const fieldLists = (m: M) => (Object.keys(LISTS) as (keyof typeof LISTS)[])
  .map(k => `<datalist id="${LISTS[k]}">${m.fieldNames[k].map(n => `<option value="${esc(n)}"></option>`).join('')}</datalist>`).join('');
 const feelings = (): [string, string][] => [
  ['', 'Not set'],
  ...root.LWProcessRandomView.EMOTIONS.map(([n, words]): [string, string] => [String(n), `${words} (${n > 0 ? '+' : ''}${n})`]),
 ];
 /** The shared journey fields. `touch` adds the channel. */
 function journeyFields(m: M, touch: boolean): string {
  const L = root.LWProcessStepModel.LIMITS;
  const phases = m.phases.length ? `<datalist id="se-phase-list">${m.phases.map(p => `<option value="${esc(p)}"></option>`).join('')}</datalist>` : '';
  const channel = touch
   ? select('channel', 'Channel', [['', 'Not set'], ...root.LWProcessRandomView.CHANNELS], m.channel, false, 'Where the customer or user meets this step.')
   : '';
  const phase = field('phase', `Phase (optional, up to ${L.phase} characters)`, m.phase, {desc: 'se-err-phase', maxlength: L.phase,
   list: phases ? 'se-phase-list' : undefined,
   help: 'The stage this step belongs to, such as Awareness or Purchase. Steps with the same phase are grouped together.'});
  const emotion = select('emotion', 'Feeling (optional)', feelings(), m.emotion, false,
   'How the customer or user is expected to feel after this step, from very frustrated to delighted.');
  const pain = field('pain', `Pain point (optional, up to ${L.note} characters)`, m.pain,
   {long: true, desc: 'se-err-pain', maxlength: L.note, help: 'What gets in the way here.'});
  const opportunity = field('opportunity', `Opportunity (optional, up to ${L.note} characters)`, m.opportunity,
   {long: true, desc: 'se-err-opportunity', maxlength: L.note, help: 'What could be improved here.'});
  return `<div class="se-grid">${phase}${phases}${channel}${emotion}</div>${err('phase')}${touch ? err('channel') : ''}${err('emotion')}`
   + `<div class="se-grid">${pain}${opportunity}</div>${err('pain')}${err('opportunity')}`;
 }
 function journey(m: M): string {
  if (m.kind !== 'touchpoint') return '';
  const intro = 'Where this interaction sits in the customer or user journey. These notes are shown in the journey view and do not change '
   + 'how the simulation runs.';
  return section('journey', 'Journey', intro, journeyFields(m, true));
 }
 function notes(m: M, open: boolean): string {
  if (m.kind === 'touchpoint') return '';
  const used = !!(m.phase || m.emotion || m.pain || m.opportunity);
  const help = 'Group this step into a phase and note how people feel, what hurts and what could be better. These notes do not change how '
   + 'the simulation runs.';
  return `<section class="se-section" aria-labelledby="se-h-notes"><details class="se-notes" id="se-notes"${open || used ? ' open' : ''}>`
   + `<summary id="se-h-notes">Journey notes (optional)</summary><p class="se-help">${help}</p>${journeyFields(m, false)}</details></section>`;
 }
 function outcome(m: M): string {
  if (m.kind !== 'end') return '';
  const view = root.LWProcessRandomView;
  const choices: [string, string][] = [['', 'None'], ['goal', view.describeOutcome('goal')], ['lost', view.describeOutcome('lost')]];
  const intro = 'Whether a case that reaches this step achieved what it came for. The run counts goals and losses and reports the conversion rate.';
  const control = select('outcome', 'Outcome', choices, m.outcome, false, 'With None, cases ending here are finished but count as neither a goal nor a loss.');
  return section('outcome', 'Outcome', intro, `<div class="se-grid">${control}</div>${err('outcome')}`);
 }
 function render(m: M, ui: LWProcessStepSections.Ui = {}): string {
  const logic = root.LWProcessStepLogicSections;
  const parts = [basics, logic.branching, outcome, journey, timing, randomTiming, automation, people, logic.instances, logic.deadline,
   effects, draws, outputs, needs, backlog, (x: M) => notes(x, !!ui.notesOpen), (x: M) => root.LWProcessStepFlows.render(x, ui), fieldLists];
  return parts.map(f => f(m)).join('');
 }
 const pathSummary = (m: M) => root.LWProcessStepLogicSections.pathSummary(m);
 root.LWProcessStepSections = {render, pathSummary, idOf, notes: m => root.LWProcessStepLogicSections.notes(m), LISTS, kit};
})(globalThis);
