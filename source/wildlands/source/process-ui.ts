/// <reference path="./process-contracts.d.ts" />
/** Offline browser adapter: input/output, application commands, and detached scene views. */
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWContentProvider: LWContentProvider.Api; LWProcessApplication: LWProcessApp.Api; LWProcessCatalog: LWProcess.Catalog;
  LWProcessData: LWProcessData.Api; LWProcess2D: LWProcess2D.Api; LWProcess3D: LWProcess3D.Api; LWProcessStepEditor: LWProcessStepEditor.Api; LWProcessDefinitionEditor: LWProcessDefinitionEditor.Api; LWProcessDialog: LWProcessDialog.Api; LWProcessDraft: LWProcessDraft.Api; LWProcessBpmn: LWProcessBpmn.Api; LWProcessBpmnDialog: LWProcessBpmnDialog.Api; LWProcessActivity: LWProcessActivity.Api; LWProcessInspector: LWProcessInspector.Api; LWProcessMenu: LWProcessMenu.Api; LWProcessTerms: LWProcessTerms.Api; LWProcessLens: LWProcessLens.Api; LWProcessPresent: LWProcessPresent.Api; LWProcessStudio?: unknown; __wildlandsReady?: boolean};
 const host = document.getElementById('process-shell'); if (!host) return;
 const pristine = '<!doctype html>\n' + document.documentElement.outerHTML;
 const esc = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
 const num = (n: number) => Number(n.toFixed(1)).toLocaleString();
 let app: LWProcessApp.Controller;
 try {const profile = root.LWContentProvider.get('process'); app = root.LWProcessApplication.create(profile.processes ?? profile.process);} catch (e) {host.textContent = 'Process could not load: ' + String(e); return;}
 host.innerHTML = `
 <header class="process-header"><div class="process-titles"><h1 id="process-title"></h1><p id="process-subtitle">Wildlands · Process Studio</p></div>
 <div class="process-file-actions"><label id="process-switch-label" class="process-switch" hidden>Process <select id="process-switch" aria-describedby="process-subtitle"></select></label>
 <button id="open-definition" aria-haspopup="dialog" title="Edit process…">Edit<span class="long"> process…</span></button><button id="draft-chip" class="process-draft-chip" aria-haspopup="dialog" hidden></button><button id="import" title="Import a process from a JSON or BPMN file">Import…</button>
 <div class="process-menu"><button id="export-menu" class="menu-long" aria-haspopup="menu" aria-expanded="false" aria-controls="export-items">Export ▾</button><button id="more-menu" class="menu-short" aria-haspopup="menu" aria-expanded="false" aria-controls="export-items" aria-label="More actions">⋯</button>
  <div id="export-popup" class="process-menu-popup" hidden><p id="export-hint" class="menu-hint"></p><div id="export-items" role="menu" aria-label="Import, present and export">
  <button id="import-item" class="menu-phone" role="menuitem" tabindex="-1">Import JSON or BPMN…</button><button id="present-item" class="menu-phone" role="menuitem" tabindex="-1" aria-haspopup="dialog">Present slides</button><button id="json" role="menuitem" tabindex="-1">Export JSON</button><button id="bpmn" role="menuitem" tabindex="-1">Export BPMN</button><button id="bpmn-bpsim" role="menuitem" tabindex="-1">Export BPMN with BPSim</button><button id="report" role="menuitem" tabindex="-1">Export run report</button><button id="html" role="menuitem" tabindex="-1">Download HTML</button></div></div></div>
 <input type="file" id="file" accept=".json,.bpmn,.xml,application/json,application/xml,text/xml" hidden></div></header>
 <div class="process-toolbar" role="group" aria-label="Simulation controls"><div class="run-actions" role="group" aria-label="Run"><button id="play" class="primary">Run simulation</button><button id="step">Step 1 min</button><button id="advance">Advance 30 min</button><button id="reset" class="ghost">Reset run</button></div>
 <button id="run-options-toggle" class="options-toggle" aria-expanded="false" aria-controls="run-config">Run options ▾</button>
 <div id="run-config" class="run-config" role="group" aria-label="Run settings"><select id="speed" aria-label="Speed" title="Simulated minutes advanced on each tick while the run plays"><option value="1">Speed: 1 min</option><option value="5" selected>Speed: 5 min</option><option value="30">Speed: 30 min</option></select>
 <select id="horizon" aria-label="Run until" title="When the run stops"><option value="1440">Until: 1 day</option><option value="10080">Until: 1 week</option><option value="43200">Until: 30 days</option><option value="100000">Until: 100,000 min</option><option value="unlimited">Until: no limit</option><option value="custom">Until: custom…</option></select>
 <label id="horizon-custom-label" hidden>Minutes <input id="horizon-custom" type="number" min="1" step="1" inputmode="numeric"></label>
 <label class="run-seed" title="Random draws are a pure function of the seed. Changing it starts a fresh paused run.">Seed <input id="seed" type="number" min="0" max="2147483647" step="1" inputmode="numeric"></label></div>
 <div class="run-status" role="group" aria-label="Run status"><button id="open-activity" aria-haspopup="dialog" aria-label="Activity">Activity<span id="activity-count" class="act-count" aria-hidden="true" hidden></span></button><div class="run-readout"><output id="clock" class="process-clock" aria-live="off"></output><span id="run-status"></span></div></div></div>
 <div class="process-workspace">
 <nav class="process-nav" aria-label="Process steps"><div class="process-sticky"><div class="process-panel-heading"><h2 id="steps-heading">Step scenes</h2><span id="step-count"></span></div><button id="overview">Whole process</button></div><ol id="steps" class="process-steps"></ol><p class="process-note">Choose a step to enter its scene. Navigation keeps the run at the same minute.</p></nav>
 <section class="process-stage" aria-label="Simulation viewport"><div class="process-stagebar"><div class="process-stagetitle"><h2 id="scene-title">Process overview</h2><p id="scene-subtitle"></p><p id="message" class="process-message" role="status" aria-live="polite"></p></div>
 <div class="process-view-controls"><button id="mode-2d" aria-pressed="false">2D</button><button id="mode-3d" aria-pressed="true">3D</button><button id="mode-lens" aria-pressed="false">SIPOC</button><button id="mode-present" aria-haspopup="dialog">Present</button><button id="frame">Frame view</button><button id="edit-step" aria-haspopup="dialog" hidden>Edit step…</button></div></div>
 <div id="viewport"><canvas id="canvas" aria-label="3D process scenes. Use the scene list for keyboard selection." aria-describedby="camera-hint" tabindex="0"></canvas><div id="map" hidden></div><div id="lens" hidden></div></div>
 <div class="process-legend">${root.LWProcess2D.legend()}<span id="marker-count"></span><span id="camera-hint">Drag to orbit · Scroll to zoom</span></div>
 <div id="metrics" class="process-metrics" aria-label="Run metrics"></div><p id="latest" class="process-latest"></p>
 <details id="io-panel" class="process-io"><summary>Inputs &amp; outputs</summary><section id="process-data" aria-label="Process inputs and outputs"></section></details></section>
 <aside class="process-inspector" aria-label="Scene inspector"><div class="process-sticky"><h2 id="inspector-title">Process overview</h2><button id="inspector-toggle" class="panel-toggle" aria-expanded="true" aria-controls="inspector-body">Details ▾</button></div>
 <div id="inspector-body"><section aria-labelledby="pools-title"><h3 id="pools-title">Shared resources</h3><div id="pools"></div></section><div id="inspector"></div></div></aside></div>
 <div id="feed-announcer" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>`;
 const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
 const setHtml = (id: string, html: string): boolean => {const node = get(id); if (node.dataset.html === html) return false; node.dataset.html = html; node.innerHTML = html; return true;};
 let view = app.query(), three: LWProcess3D.Surface | null = null;
 const newMap = () => root.LWProcess2D.create(get('map'), id => command(() => app.select(id)));
 let svg = newMap();
 /** The SIPOC grid or Journey map, built on demand for the process type and drawn only while it is the chosen view. */
 const lens = root.LWProcessLens.create(get('lens'), id => command(() => app.select(id)));
 /** The single source of truth for the unapplied draft of every process (switching process never discards it). #draft mirrors it. */
 const draft = root.LWProcessDraft.create();
 const dataView = root.LWProcessData.create(get('process-data'));
 const badge = (n: number) => {
  const max = root.LWProcessActivity.MAX_BADGE, count = get('activity-count'), text = n <= 0 ? '' : ' \u00b7 ' + (n > max ? max + '+' : n);
  if (count.textContent === text) return;
  count.textContent = text; count.hidden = !text; get('open-activity').setAttribute('aria-label', n <= 0 ? 'Activity' : n > max ? `Activity, more than ${max} new events` : `Activity, ${n} new event${n === 1 ? '' : 's'}`);
 };
 /** The event feed, its announcer and the Activity modal. It reads detached views only and never pauses or ticks the run. */
 const activity = root.LWProcessActivity.create(host, {
  view: () => view, inertRoot: host, announcer: get('feed-announcer'), badge, save: (name, data, type) => download(name, data, type),
  select: id => {command(() => app.select(id));}, stepItem: id => get('steps').querySelector<HTMLElement>(`[data-step="${id}"]`),
 });
 const menu = root.LWProcessMenu.create({triggers: [get('export-menu'), get('more-menu')], popup: get('export-popup')});
 // The Inputs & outputs panel opens by default on wide screens only; a choice made by the user is remembered for the session (in memory, never storage).
 const io = get<HTMLDetailsElement>('io-panel'), wide = matchMedia('(min-width:1600px)');
 let ioChoice: boolean | null = null, lastSelected: string | null | undefined, descOpen = false;
 io.open = wide.matches; io.querySelector('summary')!.addEventListener('click', () => {ioChoice = !io.open;}); wide.addEventListener('change', () => {if (ioChoice === null) io.open = wide.matches;});
 let stepEditor: LWProcessStepEditor.Surface;
 let definitionEditor: LWProcessDefinitionEditor.Surface;
 let last = 0, elapsed = 0, frameId = 0, disposed = false, unavailable = '', previousStatus = '';
 let guidance = false;
 const status = (message: string, error = false) => {
  guidance = /^(Ready\.|Switched to|Run reset|Seed )/.test(message);
  get('message').textContent = message + (unavailable && message !== unavailable ? ' ' + unavailable : '');
  get('message').classList.toggle('error', error || !!unavailable); get('message').setAttribute('aria-live', error ? 'assertive' : 'polite');
 };
 const download = (name: string, data: string, type: string) => {
  const url = URL.createObjectURL(new Blob([data], {type})), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
 };
 /** The toolbar chip names the unapplied draft ("Unapplied draft · 3 steps, 1 resource changed") and opens the Definition editor; it is hidden when the draft matches the running definition. */
 function draftChip(): void {
  const chip = get('draft-chip'), text = draft.changed() ? draft.describeDiff().replace(': ', ' \u00b7 ') : '';
  chip.hidden = !text; if (chip.textContent !== text) chip.textContent = text;
  chip.title = text ? 'Open the Definition editor to review, apply or restore this draft. Export JSON and Download HTML use the running definition.' : '';
 }
 draft.subscribe(draftChip);
 function rebuild(): void {
  three?.dispose(); three = null; unavailable = ''; dataView.reset(); activity.reset(); lens.reset();
  // A disposed renderer force-loses its context for good, so every rebuild draws on a fresh canvas element.
  const stale = get('canvas'); stale.replaceWith(stale.cloneNode(false));
  try {three = root.LWProcess3D.create(get<HTMLCanvasElement>('canvas'), app.query().definition, id => command(() => app.select(id)));}
  catch (e) {unavailable = '3D unavailable in this browser. The complete simulation is available in 2D.'; if (app.query().mode === '3d') app.mode('2d'); status(unavailable, true);}
  draft.enter(app.query().active, app.query().definition);
 }
 function syncSwitch(): void {
  const many = view.processes.length > 1, select = get<HTMLSelectElement>('process-switch');
  get('process-switch-label').hidden = !many;
  get('process-subtitle').textContent = many ? `Wildlands · Process Studio · Process ${view.active + 1} of ${view.processes.length}` : 'Wildlands · Process Studio';
  get('export-hint').textContent = many ? `JSON, BPMN and the run report use this process. Download HTML keeps all ${view.processes.length} processes.` : 'JSON, BPMN and the run report use the running definition. Download HTML saves an offline copy.';
  if (!many) return;
  const names = view.processes.map(p => p.name), label = (p: {id: string; name: string}) => names.filter(n => n === p.name).length > 1 ? `${p.name} (${p.id})` : p.name;
  setHtml('process-switch', view.processes.map((p, i) => `<option value="${i}">${esc(label(p))}</option>`).join('')); select.value = String(view.active);
 }
 function switchTo(index: number): void {
  draft.leave(); app.use(index); dataView.reset();
  svg.dispose(); svg = newMap(); rebuild();
  refresh(); status('Switched to ' + app.query().definition.name + '. Paused at minute 0.');
 }
 const works = (s: LWProcess.Step) => s.kind === 'task' || s.kind === 'machine' || s.kind === 'system';
 function refresh(): void {
  const focused = document.activeElement as HTMLElement | null, focusedStep = focused?.closest('#steps') ? focused.dataset.step : undefined, focusedNext = focused?.dataset.next;
  view = app.query(); const {definition: d, snapshot: q, selected} = view, step = d.steps.find(s => s.id === selected), terms = root.LWProcessTerms.of(d);
  get('steps-heading').textContent = terms.stepsHeading;
  get('process-title').textContent = d.name; get('process-title').title = d.name; syncSwitch(); get('step-count').textContent = String(d.steps.length);
  get('clock').textContent = num(q.minute) + ' min' + (view.horizon === null ? ' · no limit' : ' of ' + num(view.horizon));
  syncHorizon(view.horizon); get('run-status').textContent = view.playing ? 'Running' : q.status === 'completed' ? 'Completed' : q.status === 'limit' ? 'Run limit reached' : q.status === 'blocked' ? 'Blocked' : 'Paused';
  get('play').textContent = view.playing ? 'Pause' : 'Run simulation';
  const stopped = q.status === 'completed' ? 'Run completed. Export the report or reset to run again.' : q.status === 'limit' ? 'Run limit reached. Export the report or reset the run.' : q.status === 'blocked' ? 'No work can advance. Inspect waiting steps and resources, or reset the run.' : '';
  let refocusReset = false;
  for (const id of ['play', 'step', 'advance']) {const control = get<HTMLButtonElement>(id); if (stopped && !control.disabled && focused === control) refocusReset = true; control.disabled = !!stopped; control.title = stopped;}
  if (refocusReset) get('reset').focus({preventScroll: true});
  if (stopped && previousStatus !== q.status) status(stopped);
  if (guidance && !stopped && q.minute > 0) status('Run started. Pause, step or choose a scene to inspect its work.');
  previousStatus = q.status;
  if (setHtml('steps', d.steps.map((s, i) => {const m = q.steps.find(m => m.id === s.id)!; return `<li><button data-step="${esc(s.id)}" class="process-step ${s.id === selected ? 'selected' : ''}"${s.id === selected ? ' aria-current="step"' : ''}><span class="process-order" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span><strong>${esc(s.name)}</strong><small>${esc(s.kind)}${m.active ? ' · ' + m.active + (works(s) && s.kind !== 'task' ? ' running' : ' working') : ''}${m.queued ? ' · ' + m.queued + ' waiting' : ''}${m.timers.waiting ? ' · ' + m.timers.waiting + ' on timer' : ''}</small></span><i style="background:${s.scene.color}"></i></button></li>`;}).join(''))) get('steps').querySelectorAll<HTMLButtonElement>('button').forEach(b => b.onclick = () => command(() => app.select(b.dataset.step!)));
  if (lastSelected !== selected) {lastSelected = selected; if (selected) get('steps').querySelector(`[data-step="${selected}"]`)?.closest('li')?.scrollIntoView({block: 'nearest', inline: 'nearest'});}
  get('overview').classList.toggle('selected', !selected); if (!selected) get('overview').setAttribute('aria-current', 'true'); else get('overview').removeAttribute('aria-current'); get('scene-title').textContent = step?.name ?? 'Process overview';
  get('scene-subtitle').textContent = step ? step.scene.id + ' · ' + step.kind : `${d.steps.length} connected scenes · ${num(q.metrics.arrived)} ${q.metrics.arrived === 1 ? terms.one : terms.many} admitted`;
  get('inspector-title').textContent = step ? 'Scene details' : 'Process overview';
  const inspectorHtml = step ? root.LWProcessInspector.step(view, step) : root.LWProcessInspector.overview(view, descOpen);
  if (setHtml('inspector', inspectorHtml)) {
   get('inspector').querySelectorAll<HTMLButtonElement>('[data-next]').forEach(b => b.onclick = () => command(() => app.select(b.dataset.next!)));
   const more = document.getElementById('desc-more'); if (more) more.onclick = () => {
    descOpen = !descOpen; get('process-desc').classList.toggle('open', descOpen); more.textContent = descOpen ? 'Less' : 'More'; more.setAttribute('aria-expanded', String(descOpen));
    get('inspector').dataset.html = root.LWProcessInspector.overview(view, descOpen); fitDescription();
   };
  }
  fitDescription();
  get('edit-step').hidden = !step;
  setHtml('pools', root.LWProcessInspector.pools(view));
  setHtml('metrics', root.LWProcessInspector.kpis(view) + `<small class="metric-seed">Seed ${q.seed}</small>`);
  const seedField = get<HTMLInputElement>('seed'); if (document.activeElement !== seedField && seedField.value !== String(q.seed)) seedField.value = String(q.seed);
  activity.ingest(view); get('latest').textContent = activity.latest();
  if (view.mode !== 'lens' && !present.isOpen()) flat = view.mode;
  get('canvas').hidden = view.mode !== '3d'; get('map').hidden = view.mode !== '2d'; get('lens').hidden = view.mode !== 'lens';
  for (const mode of ['2d', '3d', 'lens'] as const) get('mode-' + mode).setAttribute('aria-pressed', String(view.mode === mode));
  const lensButton = get('mode-lens'); if (lensButton.textContent !== terms.lensLabel) lensButton.textContent = terms.lensLabel;
  lensButton.title = terms.lensTitle; lensButton.setAttribute('aria-label', terms.lensTitle);
  get<HTMLButtonElement>('mode-3d').disabled = !!unavailable; get('frame').title = view.mode === 'lens' ? 'Scroll the ' + terms.lensLabel + ' back to the start' : view.mode === '2d' ? 'Reset map view (0)' : 'Reset camera (F)';
  // Touch screens get touch wording; keyboard and mouse hints only where a fine pointer exists.
  const touch = matchMedia('(pointer: coarse)').matches;
  get('camera-hint').textContent = view.mode === '3d' ? (touch ? 'Drag to orbit · Tap a room to enter it · Frame view resets the camera' : 'Drag to orbit · Right-drag or Shift-drag to pan · Scroll to zoom · Arrows / WASD / + − / F') : view.mode === 'lens' ? (touch ? 'Tap a step to inspect it' : 'Select a step to inspect it · Escape clears the selection') : touch ? 'Drag to pan · Pinch or + − to zoom · Tap a scene to select it' : 'Drag to pan · Scroll or pinch to zoom · Arrows / + − / 0 · Select a scene on the map';
  const visibleTokens = q.tokens.filter(t => !selected || t.stepId === selected).length;
  get('marker-count').textContent = view.mode === '3d' && visibleTokens > 120 ? `Showing 120 of ${visibleTokens} work markers` : '';
  dataView.draw(view);
  if (view.mode === '2d') svg.draw(view); else if (view.mode === 'lens') lens.draw(view);
  if (focusedStep) get('steps').querySelector<HTMLButtonElement>(`[data-step="${focusedStep}"]`)?.focus({preventScroll: true});
  if (focusedNext) {
   const target = get('inspector').querySelector<HTMLButtonElement>(`[data-next="${focusedNext}"]`) ?? get('steps').querySelector<HTMLButtonElement>(`[data-step="${view.selected}"]`);
   target?.focus({preventScroll: true});
  }
  present.follow(view.selected);
 }
 /** The process description is clamped to three lines; the More button appears only when something is hidden. */
 function fitDescription(): void {
  const p = document.getElementById('process-desc'), more = document.getElementById('desc-more') as HTMLButtonElement | null;
  if (p && more) more.hidden = !descOpen && p.scrollHeight <= p.clientHeight + 1;
 }
 function command(action: () => void): boolean {try {action(); refresh(); return true;} catch (e) {status(String(e), true); return false;}}
 /** Names the simulated time after a manual clock command unless the run just stopped (refresh already explains that). */
 const announce = () => {const s = view.snapshot; if (!view.playing && s.status !== 'completed' && s.status !== 'limit' && s.status !== 'blocked') status('Advanced to minute ' + num(s.minute) + '.');};
 const on = (id: string, action: () => void) => {get(id).onclick = () => command(action);};
 on('play', () => app.play(!view.playing));
 get('step').onclick = () => {if (command(() => {app.play(false); app.advance(1);})) announce();};
 get('advance').onclick = () => {if (command(() => {app.play(false); app.advance(Math.max(1, Math.min(30, view.horizon === null ? 30 : view.horizon - view.snapshot.minute)));})) announce();};
 get<HTMLSelectElement>('process-switch').onchange = () => {try {switchTo(Number(get<HTMLSelectElement>('process-switch').value));} catch (e) {syncSwitch(); status(String(e), true);}};
 on('reset', () => {app.reset(); dataView.reset(); activity.reset(); status('Run reset. Definition retained.');});
 /** A new seed starts a fresh paused run exactly like a reset (the engine validates the range and keeps the old run when it refuses). */
 get<HTMLInputElement>('seed').onchange = () => {
  const field = get<HTMLInputElement>('seed'), n = Number(field.value);
  if (field.value.trim() === '' || !Number.isInteger(n) || n < 0 || n > 2147483647) {status('Seed must be a whole number from 0 to 2,147,483,647.', true); field.value = String(view.snapshot.seed); return;}
  if (n === view.snapshot.seed) return;
  if (command(() => app.seed(n))) {dataView.reset(); activity.reset(); status(`Seed ${n} \u00b7 fresh paused run`);} else field.value = String(view.snapshot.seed);
 };
 get('run-options-toggle').onclick = () => {const bar = document.querySelector('.process-toolbar')!, open = bar.classList.toggle('options-open'); get('run-options-toggle').setAttribute('aria-expanded', String(open));};
 get('inspector-toggle').onclick = () => {const aside = document.querySelector('.process-inspector')!, collapsed = aside.classList.toggle('collapsed'); get('inspector-toggle').setAttribute('aria-expanded', String(!collapsed)); fitDescription();};
 get('open-activity').onclick = () => {activity.open(get('open-activity'));};
 const presets = new Set(['1440', '10080', '43200', '100000']);
 function syncHorizon(horizon: number | null): void {
  const select = get<HTMLSelectElement>('horizon'), custom = get<HTMLInputElement>('horizon-custom');
  if (document.activeElement === custom || document.activeElement === select && select.value === 'custom') return;
  select.value = horizon === null ? 'unlimited' : presets.has(String(horizon)) ? String(horizon) : 'custom';
  get('horizon-custom-label').hidden = select.value !== 'custom'; if (horizon !== null && select.value === 'custom') custom.value = String(horizon);
 }
 function applyHorizon(): void {
  const select = get<HTMLSelectElement>('horizon'), custom = get<HTMLInputElement>('horizon-custom');
  get('horizon-custom-label').hidden = select.value !== 'custom';
  if (select.value === 'custom') {const n = Number(custom.value); if (!custom.value) {custom.focus(); status('Enter a whole number of minutes for the custom run length.'); return;} command(() => app.horizon(n)); return;}
  command(() => app.horizon(select.value === 'unlimited' ? null : Number(select.value)));
  status(select.value === 'unlimited' ? 'Unlimited run length. The run still stops when all work is complete or blocked.' : 'Run length set to ' + num(Number(select.value)) + ' minutes.');
 }
 get<HTMLSelectElement>('horizon').onchange = applyHorizon; get<HTMLInputElement>('horizon-custom').onchange = applyHorizon;
 on('overview', () => app.select(null)); on('mode-2d', () => app.mode('2d')); on('mode-3d', () => app.mode('3d')); on('mode-lens', () => app.mode('lens'));
 on('frame', () => {if (view.mode === '2d') svg.frame(); else if (view.mode === 'lens') lens.frame(); else three?.frame();});
 on('json', () => download(view.definition.id + '.process.json', JSON.stringify(view.definition, null, 2), 'application/json'));
 on('bpmn', () => {download(view.definition.id + '.bpmn', root.LWProcessBpmn.export(view.definition), 'application/xml'); status('Exported BPMN 2.0 XML with diagram layout. Wildlands values are stored in a wl: extension; other tools may ignore them.');});
 on('bpmn-bpsim', () => {download(view.definition.id + '.bpsim.bpmn', root.LWProcessBpmn.export(view.definition, {bpsim: true}), 'application/xml'); status('Exported BPMN 2.0 XML with a BPSim scenario in minutes (times, costs, probabilities, arrivals and pool sizes). Wildlands values stay authoritative in the wl: extension.');});
 on('report', () => download(view.definition.id + '.report.json', JSON.stringify({format: 'wildlands-process-report', schemaVersion: 1, fingerprint: root.LWProcessCatalog.fingerprint(view.definition), definition: view.definition, snapshot: view.snapshot}, null, 2), 'application/json'));
 on('html', () => {
  const defs = app.definitions(), many = defs.length > 1, safe = (value: unknown) => JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
  // The first list entry stays the single-definition global, so a multi-process page reopens on its first process.
  let html = pristine.replace(/window\.LWProcessDefinition = [^\n]*;/, () => 'window.LWProcessDefinition = ' + safe(defs[0]) + ';')
   .replace(/<meta name="wildlands-game-digest"[^>]*>/g, '');
  if (many) html = html.replace(/window\.LWProcessDefinitions = [^\n]*;/, () => 'window.LWProcessDefinitions = ' + safe(defs) + ';');
  else html = html.replace(/<title>[^<]*<\/title>/, () => '<title>' + esc(defs[0]!.name) + '</title>');
  download((many ? 'wildlands-processes' : defs[0]!.id) + '.html', html, 'text/html');
  status(many ? `Downloaded an offline HTML with all ${defs.length} applied processes. It opens on ${defs[0]!.name} with a fresh paused run.` : 'Downloaded an offline HTML with the active definition. It opens with a fresh paused run.');
 });
 /** The control that opened the file picker gets focus back when the BPMN import dialog closes (the phone menu item returns to its trigger). */
 let importFrom: HTMLElement | null = null;
 const shown = (n: HTMLElement | null) => !!n && n.getClientRects().length > 0;
 const importOpener = () => [importFrom, get('import'), get('more-menu')].find(shown) ?? null;
 on('import', () => {importFrom = get('import'); get<HTMLInputElement>('file').click();}); on('import-item', () => {importFrom = get('more-menu'); get<HTMLInputElement>('file').click();});
 /** JSON replaces the active process at once; BPMN opens the import dialog, which applies through the same replace path. */
 get<HTMLInputElement>('file').onchange = async () => {
  const file = get<HTMLInputElement>('file').files?.[0]; if (!file) return;
  try {if (file.size > 8 * 1024 * 1024) throw Error('Choose a JSON or BPMN file smaller than 8 MiB.'); const text = await file.text();
   if (/\.(bpmn|xml)$/i.test(file.name) || text.trimStart().startsWith('<')) {if (!bpmnImport.open({name: file.name, text}, importOpener())) throw Error('Close the open window first.');}
   else {app.replace(JSON.parse(text) as unknown); rebuild(); refresh(); status('Imported ' + file.name + '. New run is paused.');}}
  catch (e) {status('Import rejected; active process retained. ' + String(e), true);}
  get<HTMLInputElement>('file').value = '';
 };
 /** Applies a definition from the BPMN import dialog exactly like a JSON import: a fresh paused run, never a tick. */
 const bpmnImport = root.LWProcessBpmnDialog.create(host, {
  active: () => ({name: view.definition.name, minute: app.query().snapshot.minute, draft: draft.changed() ? draft.describeDiff().replace(/^Unapplied draft: /, '') : ''}),
  apply: (definition, name, warnings) => {
   try {app.replace(definition); rebuild(); refresh();}
   catch (e) {status('Import rejected; active process retained. ' + String(e), true); return false;}
   status('Imported ' + name + '. New run is paused.' + (warnings.length ? ' ' + warnings.length + ' import note(s): ' + warnings.slice(0, 2).join(' ') + (warnings.length > 2 ? ' …' : '') : '')); return true;
  },
  focusFor: importOpener,
 });
 /** The catalog's strict verdict for the draft text; the Definition editor lists every diagnostic itself. */
 function checkDraft(): LWProcess.Definition | undefined {
  try {const result = root.LWProcessCatalog.validate(JSON.parse(draft.read())); return result.ok ? result.definition : undefined;} catch {return undefined;}
 }
 function applyDraft(): boolean {
  const d = checkDraft(); if (!d) {status('The draft is not a valid definition, so nothing was applied. Open the Definition editor to see why.', true); return false;}
  d.revision = Math.max(view.definition.revision + 1, d.revision); app.replace(d); rebuild(); status('Definition applied. New run is paused.'); return true;
 }
 /** The step editor is modal: it pauses the run (a command, never a tick), edits only the draft, and the inert page cannot change selection or time while it is open. */
 function openStepEditor(): void {
  const id = view.selected; if (!id) return;
  // An unparseable draft cannot be edited as a step: the Definition editor opens on the JSON syntax error instead.
  if (!draft.parse()) {definitionEditor.open({invoker: get('edit-step'), focus: 'json'}); return;}
  if (view.playing) command(() => app.play(false));
  if (stepEditor.open(id, get('edit-step'))) status('Editing a step. The run is paused while the editor is open.');
 }
 stepEditor = root.LWProcessStepEditor.create(host, {
  draft, notify: status, run: () => ({minute: app.query().snapshot.minute, cases: app.query().snapshot.cases.length}),
  apply: text => {draft.write(text, 'step-editor'); let ok = false; command(() => {ok = applyDraft();}); return ok;},
  focusFor: id => {const direct = get('edit-step'); return !direct.hidden && direct.getClientRects().length ? direct : get('steps').querySelector<HTMLElement>(`[data-step="${id}"]`);},
  openDefinition: () => root.LWProcessDefinitionEditor.handoff(root.LWProcessDialog.active(), () => {definitionEditor.open({invoker: get('open-definition'), focus: 'problems'});}),
 });
 on('edit-step', () => openStepEditor());
/** The Definition editor is modal: it pauses the run (a command, never a tick) and edits only the draft; Apply goes through the same path as the step editor. */
 definitionEditor = root.LWProcessDefinitionEditor.create(host, {
  draft, active: () => ({name: view.definition.name, revision: view.definition.revision}), run: () => ({minute: app.query().snapshot.minute, cases: app.query().snapshot.cases.length}),
  pause: () => {if (view.playing) command(() => app.play(false));},
  apply: text => {draft.write(text, 'definition'); let ok = false; command(() => {ok = applyDraft();}); return ok;},
  download: text => {download(view.definition.id + '.draft.json', text, 'application/json'); status('Draft downloaded as written. Apply a valid draft to update the simulation.');},
  focusFor: () => get('open-definition'),
 });
 const openDefinition = (button: HTMLElement) => {if (definitionEditor.open({invoker: button, focus: 'auto'})) status('Editing the definition. The run is paused while the editor is open.');};
 get('open-definition').onclick = () => openDefinition(get('open-definition')); get('draft-chip').onclick = () => openDefinition(get('draft-chip'));
 /** Present mode: the slide deck of the active definition over the studio's own 2D map. Entering pauses a playing run (a command, never a tick); leaving restores the view mode and selection and never resumes. */
 let flat: LWProcessApp.ViewMode = '3d', before: {mode: LWProcessApp.ViewMode; flat: LWProcessApp.ViewMode; selected: string | null} = {mode: flat, flat, selected: null};
 const present = root.LWProcessPresent.create(document.body, {
  inertRoot: host, map: get('map'),
  enter: () => {
   const paused = view.playing; if (paused) command(() => app.play(false));
   before = {mode: view.mode, flat, selected: view.selected}; command(() => app.mode('2d'));
   status(paused ? 'Presenting slides. The run is paused while you present.' : 'Presenting slides.'); return {view, paused};
  },
  show: step => {command(() => app.select(step)); svg.frame({neighbours: true});},
  leave: paused => {
   const b = before; command(() => {if (b.mode === 'lens') app.mode(b.flat); app.mode(b.mode); app.select(b.selected);}); svg.frame();
   status(paused ? 'Presentation closed. The run stays paused; choose Run simulation to continue.' : 'Presentation closed.');
  },
 });
 const startPresent = (invoker: HTMLElement) => {if (!present.open(invoker, () => [get('mode-present'), get('more-menu')].find(shown) ?? null)) status('Close the open window first.', true);};
 get('mode-present').onclick = () => startPresent(get('mode-present')); get('present-item').onclick = () => {menu.close(false); startPresent(get('more-menu'));};
 function animate(time: number): void {
  if (disposed) return; const delta = Math.min(.1, (time - last) / 1000 || 0); last = time;
  if (view.playing) {elapsed += delta; if (elapsed >= .35) {elapsed = 0; command(() => app.pulse(Number(get<HTMLSelectElement>('speed').value)));}} else elapsed = 0;
  if (view.mode === '3d') three?.draw(view, delta);
  frameId = requestAnimationFrame(animate);
 }
 rebuild(); refresh(); status(unavailable || 'Ready. Run the simulation, or choose a scene to inspect its work.', !!unavailable);
 root.LWProcessStudio = Object.freeze({query: () => ({...app.query(), presenting: present.state()}), definition: () => app.query().definition, definitions: () => app.definitions()});
 root.__wildlandsReady = true;
 document.documentElement.dataset.wildlandsReady = 'process'; dispatchEvent(new CustomEvent('wildlands:ready', {detail: {host: 'process'}}));
 frameId = requestAnimationFrame(animate);
 window.addEventListener('pagehide', () => {disposed = true; cancelAnimationFrame(frameId); present.dispose(); three?.dispose(); svg.dispose(); lens.dispose(); definitionEditor.dispose(); stepEditor.dispose(); bpmnImport.dispose(); activity.dispose(); menu.dispose(); app.dispose();}, {once: true});
})(globalThis);
