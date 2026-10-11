/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-html.ts" />
/// <reference path="./process-dialog.ts" />
/// <reference path="./process-bpmn.ts" />
/// <reference path="./process-bpmn-preview.ts" />
/// <reference path="./process-bpmn-conformance.ts" />
/**
 * BPMN import dialog, built on the shared LWProcessDialog (id 'bi', size 'wide'). Picking a .bpmn/.xml file opens it instead of
 * importing at once: `LWProcessBpmn.inspect` fills the Process and BPSim scenario pickers and lists lanes and element counts;
 * every option field is validated with `LWProcessBpmn.options` and shows its own inline problem; a preview from
 * `LWProcessBpmn.analyze` (recomputed shortly after each change by a plain UI debounce, never a simulation clock) lists the
 * verdict, warnings, rejections with element ids and the mapping grouped by target. Import reuses that analysis of the shown options
 * (the file is never analysed again) and hands its definition to `env.apply`, the studio's existing replace path (a fresh paused run). When that discards
 * a run past minute 0 or an unapplied draft, the footer asks first, starting on Cancel. This module never ticks, holds no
 * session and never touches storage; Cancel, Close and Escape change nothing and return focus to the invoker. On open, the file is
 * also checked once with `LWProcessBpmnConformance.validate` and summarised in a Standards check note that never gates Import.
 * Markup is built with LWProcessHtml's `html` template, so the file name and every process and scenario name are escaped.
 */
declare namespace LWProcessBpmnDialog {
 interface Env {
  /** Detached facts the replace confirmation names: the active process, its run minute and the unapplied draft summary ('' when none). */
  active(): {name: string; minute: number; draft: string};
  /** Applies the imported definition through the studio's replace path; true when a fresh paused run started. */
  apply(definition: LWProcess.Definition, file: string, warnings: string[]): boolean;
  /** Where focus goes after closing when the invoker is gone or hidden. */
  focusFor(): HTMLElement | null;
 }
 interface File {name: string; text: string}
 interface Surface {
  /** Inspects the file and opens the dialog; false when another dialog is open. Throws when the text is not a BPMN 2.0 document. */
  open(file: File, invoker?: HTMLElement | null): boolean;
  isOpen(): boolean;
  close(): void;
  dispose(): void;
 }
 interface Api {create(host: HTMLElement, env: Env): Surface;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {
  LWProcessDialog: LWProcessDialog.Api;
  LWProcessHtml: LWProcessHtml.Api;
  LWProcessBpmn: LWProcessBpmn.Api;
  LWProcessBpmnPreview: LWProcessBpmnPreview.Api;
  LWProcessBpmnConformance: LWProcessBpmnConformance.Api;
  LWProcessBpmnDialog?: LWProcessBpmnDialog.Api;
 };
 const {html, join} = root.LWProcessHtml;
 type Safe = LWProcessHtml.Safe;
 const DEBOUNCE = 150;
 type NumberKey = 'defaultCapacity' | 'systemCapacity' | 'minutesPerDay' | 'defaultDuration';
 /** Whole-number options: key, element id, full label and help. Ranges come from LWProcessBpmn.options, which stays the validator. */
 const NUMBERS: [NumberKey, string, string, string][] = [
  ['defaultCapacity', 'bi-capacity', 'People per lane pool', 'Capacity of a people pool made from a lane without a BPSim quantity. 1 to 1,000.'],
  ['systemCapacity', 'bi-system-capacity', 'System pool capacity', 'Capacity of system pools made from lanes or Automation. 1 to 1,000.'],
  ['minutesPerDay', 'bi-day', 'Business minutes per day', 'Length of a BPMN or BPSim day; a week is 5 days. 1 to 1,440.'],
  ['defaultDuration', 'bi-duration', 'Default duration in minutes', 'For tasks and waits the file gives no time. 1 to 100,000.'],
 ];
 /** One labelled option: its control, its help line and its problem line (hidden until the field has a problem). */
 function field(id: string, label: string, control: Safe, help: string): Safe {
  return join([
   html`<div class="se-field"><label for="${id}">${label}</label>${control}`,
   html`<p class="se-help" id="${id}-help">${help}</p><p class="se-err" id="${id}-err" hidden></p></div>`,
  ]);
 }
 const numberInput = (id: string) => html`<input type="number" id="${id}" min="1" step="1" inputmode="numeric" aria-describedby="${id}-help ${id}-err">`;
 const PROCESS_SELECT = html`<select id="bi-process" autofocus aria-describedby="bi-process-help"></select>`;
 const SCENARIO_SELECT = html`<select id="bi-scenario" aria-describedby="bi-scenario-help"></select>`;
 const LANES_SELECT = join([
  html`<select id="bi-lanes" aria-describedby="bi-lanes-help">`,
  html`<option value="pools">Turn lanes into resource pools</option><option value="ignore">Ignore lanes</option></select>`,
 ]);
 const UNSUPPORTED_SELECT = join([
  html`<select id="bi-unsupported" aria-describedby="bi-unsupported-help">`,
  html`<option value="reject">Reject the file and list them</option>`,
  html`<option value="drop">Drop them with a warning each</option></select>`,
 ]);
 const OPTIONS_HEAD = join([
  html`<h3 id="bi-options-h">Import options</h3>`,
  html`<p class="se-help">The preview updates as you change them. Every option is checked before anything is imported.</p><div class="se-grid">`,
 ]);
 const BPSIM_CHECK = join([
  html`<label class="se-check"><input type="checkbox" id="bi-bpsim" aria-describedby="bi-bpsim-help"><span>Use BPSim simulation parameters`,
  html`<small class="se-help" id="bi-bpsim-help">Durations, probabilities, arrivals, capacities and costs from the chosen scenario.</small>`,
  html`</span></label>`,
 ]);
 const AUTO_CHECK = join([
  html`<label class="se-check"><input type="checkbox" id="bi-auto" aria-describedby="bi-auto-help">`,
  html`<span>Run service-type tasks on automated system pools`,
  html`<small class="se-help" id="bi-auto-help">Off keeps service, script and rule tasks as plain tasks.</small></span></label>`,
 ]);
 const PREVIEW_PANE = join([
  html`<section class="bi-pane" aria-labelledby="bi-preview-h"><div class="bi-pane-head"><h3 id="bi-preview-h">Preview</h3>`,
  html`<span class="de-sync" id="bi-state" role="status"></span></div><div id="bi-preview" data-state="pending"></div></section>`,
 ]);
 const LANES_HELP = 'Ignoring lanes lets tasks run without waiting for staff.';
 const FORM = String(html`<p class="bi-file" id="bi-file"></p><div class="bi-standards" id="bi-standards" role="note"></div><div class="pd-split bi-split">
  <section class="bi-pane" aria-labelledby="bi-source-h"><h3 id="bi-source-h">What to import</h3><div class="se-grid">
   ${field('bi-process', 'Process', PROCESS_SELECT, 'A call activity inlines the process it calls.')}
   ${field('bi-scenario', 'BPSim scenario', SCENARIO_SELECT, '')}</div>
   <div id="bi-contents"></div>
   ${OPTIONS_HEAD}
   ${field('bi-lanes', 'Lanes', LANES_SELECT, LANES_HELP)}
   ${field('bi-unsupported', 'Unsupported constructs', UNSUPPORTED_SELECT, 'Dropping bridges or prunes the flows around them.')}
   ${NUMBERS.map(([, id, label, help]) => field(id, label, numberInput(id), help))}</div>
   ${BPSIM_CHECK}
   ${AUTO_CHECK}</section>
  ${PREVIEW_PANE}</div>`);
 const NO_PREVIEW = '<p class="bi-verdict" data-tone="blocked"><strong>No preview.</strong> '
  + 'Fix the options marked with a problem to see what the import would produce.</p>';
 const message = (e: unknown) => e instanceof Error ? e.message : String(e);
 /** A picker label: the name with the id in brackets when they differ, else the id. */
 const pickerLabel = (p: {id: string; name: string}) => p.name && p.name !== p.id ? `${p.name} (${p.id})` : p.id;
 function create(host: HTMLElement, env: LWProcessBpmnDialog.Env): LWProcessBpmnDialog.Surface {
  const dialog = root.LWProcessDialog.create(host.ownerDocument.body, {
   id: 'bi', size: 'wide', title: 'Import BPMN', inertRoot: host, closeLabel: 'Close',
   actions: [{id: 'cancel', label: 'Cancel', cancel: true}, {id: 'import', label: 'Import', primary: true}],
   onAction: id => {
    if (id === 'import') void importNow();
   },
   onClose: () => {
    window.clearTimeout(timer);
    timer = 0;
    file = null;
    inspection = null;
    result = null;
   },
  });
  dialog.el.classList.add('bi-dialog');
  dialog.body.insertAdjacentHTML('beforeend', FORM);
  const q = <T extends HTMLElement = HTMLElement>(id: string) => dialog.el.querySelector<T>('#' + id)!;
  let file: LWProcessBpmnDialog.File | null = null;
  let inspection: LWProcessBpmn.Inspection | null = null;
  let result: LWProcessBpmn.ImportResult | null = null;
  let used: LWProcessBpmn.Options | null = null, timer = 0;
  const open = new Set<string>();
  const select = (id: string) => q<HTMLSelectElement>(id), box = (id: string) => q<HTMLInputElement>(id);
  /** Reads every field; a field the validator refuses carries its own message, with the API option name replaced by the field label. */
  function read(): {options: LWProcessBpmn.Options | null; errors: [string, string][]} {
   const errors: [string, string][] = [];
   const o: LWProcessBpmn.Options = {
    lanes: select('bi-lanes').value as 'pools' | 'ignore',
    unsupported: select('bi-unsupported').value as 'reject' | 'drop',
    bpsim: box('bi-bpsim').checked,
    autoSystemPool: box('bi-auto').checked,
   };
   const process = select('bi-process').value, scenario = select('bi-scenario').value;
   if (process) o.process = process;
   if (o.bpsim && scenario) o.scenario = scenario;
   for (const [key, id, label] of NUMBERS) {
    const raw = box(id).value.trim(), n = raw === '' ? NaN : Number(raw);
    try {
     root.LWProcessBpmn.options({[key]: n});
     o[key] = n;
    } catch (e) {
     errors.push([id, message(e).replace(/^Option \w+/, label)]);
    }
   }
   if (errors.length) return {options: null, errors};
   try {
    root.LWProcessBpmn.options(o);
   } catch (e) {
    return {options: null, errors: [['bi-process', message(e)]]};
   }
   return {options: o, errors};
  }
  function showErrors(errors: [string, string][]): void {
   for (const id of ['bi-process', ...NUMBERS.map(n => n[1])]) {
    const text = errors.find(([e]) => e === id)?.[1] ?? '', err = q(id + '-err');
    if (err.textContent !== text) err.textContent = text;
    err.hidden = !text;
    if (text) q(id).setAttribute('aria-invalid', 'true');
    else q(id).removeAttribute('aria-invalid');
   }
  }
  /** Why Import is unavailable ('' when it is not): invalid options, rejections in the preview, or a definition that cannot run. */
  function blocked(labels: string[]): string {
   if (labels.length) return `Import is unavailable until every option is valid. Fix: ${labels.join(', ')}.`;
   if (result?.rejections.length) {
    const n = result.rejections.length;
    const fix = result.info.options.unsupported === 'reject'
     ? 'Choose “Drop them with a warning” under Unsupported constructs, or fix the model.'
     : 'Fix the model or change the options.';
    return `Import is unavailable: the preview lists ${n} ${n === 1 ? 'rejection' : 'rejections'}. ${fix}`;
   }
   if (result && !result.ok) {
    const n = result.diagnostics.length;
    return `Import is unavailable: the imported definition has ${n} ${n === 1 ? 'problem' : 'problems'} and cannot run.`;
   }
   return '';
  }
  /** Import is enabled only for valid options whose preview is a runnable definition; otherwise the footer says why. */
  function gate(errors: [string, string][]): void {
   const labels = errors.map(([id]) => q(id).closest('.se-field')?.querySelector('label')?.textContent ?? id);
   const reason = blocked(labels);
   dialog.setActionState('import', {disabled: !!reason, reason});
  }
  function scenarioState(): void {
   const s = select('bi-scenario'), none = !inspection?.scenarios.length, off = !box('bi-bpsim').checked, help = q('bi-scenario-help');
   s.disabled = none || off;
   let text = 'Durations, probabilities, arrivals and pool sizes come from this scenario.';
   if (none) text = 'This file has no BPSim scenario. Durations and arrivals use the defaults.';
   else if (off) text = 'Turn on “Use BPSim simulation parameters” to choose a scenario.';
   if (help.textContent !== text) help.textContent = text;
  }
  /** Recomputes the preview now from the current fields. */
  function compute(): void {
   window.clearTimeout(timer);
   timer = 0;
   if (!file || !inspection) return;
   const {options, errors} = read(), view = q('bi-preview'), state = q('bi-state');
   showErrors(errors);
   scenarioState();
   const shown = inspection.processes.find(p => p.id === select('bi-process').value);
   q('bi-contents').innerHTML = root.LWProcessBpmnPreview.contents(shown);
   used = options;
   result = null;
   if (!options) {
    view.innerHTML = NO_PREVIEW;
    view.dataset.state = 'invalid';
    view.dataset.options = '';
    state.textContent = 'Options need changes';
    state.classList.add('bad');
    gate(errors);
    return;
   }
   try {
    result = root.LWProcessBpmn.analyze(file.text, options);
   } catch (e) {
    showErrors([['bi-process', message(e)]]);
    gate([['bi-process', '']]);
    return;
   }
   const rendered = root.LWProcessBpmnPreview.preview(result, open);
   dialog.preserveScroll(() => {
    view.innerHTML = rendered.html;
   });
   view.dataset.state = 'ready';
   view.dataset.options = JSON.stringify(options);
   state.textContent = rendered.tone === 'ready' ? 'Ready to import' : 'Cannot import yet';
   state.classList.toggle('bad', rendered.tone !== 'ready');
   gate(errors);
  }
  function schedule(): void {
   window.clearTimeout(timer);
   q('bi-preview').dataset.state = 'pending';
   const state = q('bi-state');
   state.textContent = 'Updating preview…';
   state.classList.remove('bad');
   timer = window.setTimeout(compute, DEBOUNCE);
  }
  dialog.body.addEventListener('input', e => {
   if ((e.target as HTMLElement).closest('.bi-pane')) schedule();
  });
  dialog.body.addEventListener('change', e => {
   if ((e.target as HTMLElement).matches('select, input[type=checkbox]')) compute();
  });
  dialog.body.addEventListener('toggle', e => {
   const d = e.target as HTMLElement;
   if (!d.matches?.('details.bi-group')) return;
   if ((d as HTMLDetailsElement).open) open.add(d.dataset.group!);
   else open.delete(d.dataset.group!);
  }, true);
  async function importNow(): Promise<void> {
   if (timer) compute();
   if (!file || !used || !result?.ok) return;
   const a = env.active();
   const lost = [
    a.minute > 0 ? `minute ${a.minute.toLocaleString()} of the current run` : '',
    a.draft ? `the unapplied draft (${a.draft})` : '',
   ].filter(Boolean);
   if (lost.length) {
    const question = `Importing replaces ${a.name} and discards ${lost.join(' and ')}. `
     + 'Export the run report or the draft first if you need them.';
    const choice = await dialog.confirm(question, [
     {id: 'keep', label: 'Cancel', default: true},
     {id: 'replace', label: 'Import and replace'},
    ], {escape: 'keep'});
    if (choice !== 'replace' || !dialog.isOpen() || !file || !used) return;
    if (timer) compute();
   }
   // `compute` sets `used` and `result` together, so the preview's analysis is exactly what `LWProcessBpmn.import(file, used)` would return.
   const imported = result;
   if (!imported?.ok || !imported.definition) {
    dialog.setStatus('<p><strong>The file can no longer be imported with these options.</strong> The preview lists why.</p>', 'alert');
    return;
   }
   dialog.setStatus('');
   if (env.apply(imported.definition, file.name, imported.warnings)) dialog.close('action');
   else dialog.setStatus('<p><strong>The definition could not be imported.</strong> See the status message on the page.</p>', 'alert');
  }
  /** The Standards check note: it informs and never gates the import, so even a failure of the check itself leaves the dialog usable. */
  function standardsNote(f: LWProcessBpmnDialog.File): void {
   const standards = q('bi-standards');
   try {
    const report = root.LWProcessBpmnConformance.validate(f.text);
    standards.innerHTML = root.LWProcessBpmnPreview.standards(report);
    standards.dataset.conforms = String(report.conforms);
   } catch (e) {
    standards.innerHTML = String(html`<p><strong>Standards check:</strong> unavailable (${message(e)}). It never blocks import.</p>`);
    delete standards.dataset.conforms;
   }
  }
  function fill(f: LWProcessBpmnDialog.File, inspected: LWProcessBpmn.Inspection): void {
   const d = root.LWProcessBpmn.options({}), processes = inspected.processes, first = processes.find(p => p.executable) ?? processes[0];
   const processOption = (p: LWProcessBpmn.Inspection['processes'][number]) => {
    return html`<option value="${p.id}">${pickerLabel(p)}${p.executable ? '' : ' · not executable'}</option>`;
   };
   select('bi-process').innerHTML = String(join(processes.map(processOption)));
   select('bi-process').value = first?.id ?? '';
   select('bi-scenario').innerHTML = inspected.scenarios.length
    ? String(join(inspected.scenarios.map(s => html`<option value="${s.id}">${pickerLabel(s)}</option>`)))
    : '<option value="">No BPSim scenario in this file</option>';
   select('bi-lanes').value = d.lanes;
   select('bi-unsupported').value = d.unsupported;
   box('bi-bpsim').checked = d.bpsim;
   box('bi-auto').checked = d.autoSystemPool;
   for (const [key, id] of NUMBERS) box(id).value = String(d[key]);
   const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
   const processCount = count(processes.length, 'process', 'processes');
   const scenarioCount = count(inspected.scenarios.length, 'BPSim scenario', 'BPSim scenarios');
   q('bi-file').innerHTML = String(html`File <strong>${f.name}</strong> · ${processCount} · ${scenarioCount}`);
   standardsNote(f);
   open.clear();
   dialog.setStatus('');
  }
  return {
   open(f, invoker) {
    if (dialog.isOpen() || root.LWProcessDialog.active()) return false;
    const inspected = root.LWProcessBpmn.inspect(f.text);
    if (!inspected.processes.length) throw Error('The file holds no BPMN process to import.');
    file = f;
    inspection = inspected;
    fill(f, inspected);
    compute();
    const a = env.active();
    return dialog.open({
     title: 'Import BPMN',
     subtitle: `Importing replaces ${a.name} with a fresh paused run. Nothing changes until you choose Import.`,
     chip: 'BPMN 2.0',
     meta: f.name,
     ...invoker === undefined ? {} : {invoker},
     focusFallback: env.focusFor,
    });
   },
   isOpen: () => dialog.isOpen(),
   close: () => dialog.close('programmatic'),
   dispose() {
    window.clearTimeout(timer);
    dialog.dispose();
   },
  };
 }
 root.LWProcessBpmnDialog = {create};
})(globalThis);
