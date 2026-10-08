/// <reference path="./process-contracts.d.ts" />
/** Offline browser adapter: input/output, application commands, and detached scene views. */
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWContentProvider: LWContentProvider.Api; LWProcessApplication: LWProcessApp.Api; LWProcessCatalog: LWProcess.Catalog;
  LWProcessData: LWProcessData.Api; LWProcess2D: LWProcess2D.Api; LWProcess3D: LWProcess3D.Api; LWProcessTuning: LWProcessTuning.Api; LWProcessStepEditor: LWProcessStepEditor.Api; LWProcessDraft: LWProcessDraft.Api; LWProcessNeeds: LWProcessNeeds.Api; LWProcessBpmn: LWProcessBpmn.Api; LWProcessStudio?: unknown; __wildlandsReady?: boolean};
 const host = document.getElementById('process-shell'); if (!host) return;
 const pristine = '<!doctype html>\n' + document.documentElement.outerHTML;
 const esc = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
 const num = (n: number) => Number(n.toFixed(1)).toLocaleString();
 let app: LWProcessApp.Controller;
 try {const profile = root.LWContentProvider.get('process'); app = root.LWProcessApplication.create(profile.processes ?? profile.process);} catch (e) {host.textContent = 'Process could not load: ' + String(e); return;}
 host.innerHTML = `
 <header class="process-header"><div><h1 id="process-title"></h1><p id="process-subtitle">Wildlands · Process Studio</p></div>
 <label id="process-switch-label" class="process-switch" hidden>Process <select id="process-switch" aria-describedby="process-subtitle"></select></label><div class="process-file-actions">
 <button id="import">Import JSON or BPMN</button><button id="json">Export JSON</button><button id="bpmn">Export BPMN</button><button id="html">Download HTML</button><input type="file" id="file" accept=".json,.bpmn,.xml,application/json,application/xml,text/xml" hidden></div></header>
 <div class="process-toolbar" aria-label="Simulation controls"><button id="play" class="primary">Run simulation</button><button id="step">Step 1 min</button><button id="advance">Advance 30 min</button><button id="reset">Reset run</button>
 <label>Speed <select id="speed"><option value="1">1 min per tick</option><option value="5" selected>5 min per tick</option><option value="30">30 min per tick</option></select></label>
 <label>Run until <select id="horizon"><option value="1440">1 day (1,440 min)</option><option value="10080">1 week (10,080 min)</option><option value="43200">30 days (43,200 min)</option><option value="100000">Engine default (100,000 min)</option><option value="unlimited">Unlimited</option><option value="custom">Custom…</option></select></label>
 <label id="horizon-custom-label" hidden>Minutes <input id="horizon-custom" type="number" min="1" step="1" inputmode="numeric"></label><output id="clock" class="process-clock" aria-live="off"></output><span id="run-status"></span></div>
 <div id="message" class="process-message" role="status" aria-live="polite"></div>
 <div class="process-workspace">
 <section class="process-stage" aria-label="Simulation viewport"><div class="process-stagebar"><div><h2 id="scene-title">Process overview</h2><p id="scene-subtitle"></p></div>
 <div class="process-view-controls"><button id="mode-2d" aria-pressed="false">2D</button><button id="mode-3d" aria-pressed="true">3D</button><button id="frame">Frame view</button><button id="edit-step" aria-haspopup="dialog" hidden>Edit step…</button></div></div>
 <div id="viewport"><canvas id="canvas" aria-label="3D process scenes. Use the scene list for keyboard selection." tabindex="0"></canvas><div id="map" hidden></div></div>
 <div class="process-legend"><span><i class="active-dot"></i>Working</span><span><i class="queue-dot"></i>Waiting</span><span><i class="timer-dot"></i>Timer</span><span><i class="backlog-dot"></i>Backlog</span><span><i class="held-dot"></i>Blocked</span><span id="marker-count"></span><span id="camera-hint">Drag to orbit · Scroll to zoom</span></div>
 <div id="metrics" class="process-metrics" aria-label="Run metrics"></div><section id="process-data" aria-label="Process inputs and outputs"></section></section>
 <nav class="process-nav" aria-label="Process steps"><div class="process-panel-heading"><h2>Step scenes</h2><span id="step-count"></span></div>
 <button id="overview">Whole process</button><ol id="steps" class="process-steps"></ol><p class="process-note">Choose a step to enter its scene. Navigation keeps the run at the same minute.</p></nav>
 <aside class="process-inspector" aria-label="Scene inspector"><h2 id="inspector-title">Process overview</h2><div id="inspector"></div><h3>Shared resources</h3><div id="pools"></div><button id="report">Export run report</button></aside></div>
 <section class="process-bottom"><div class="process-bottom-nav"><button id="show-events" aria-pressed="true">Activity</button><button id="show-definition" aria-pressed="false">Definition editor</button><span>Simulation results depend on authored durations and capacities</span></div>
 <div id="events" class="process-events"></div><div id="editor" hidden><div id="tuning"></div><h3>Raw JSON draft</h3><p>Edit the JSON draft, validate, then apply to start a fresh paused run. Export your run report first if you need it.</p><label for="draft">Process definition</label><p id="draft-state" role="status"></p><textarea id="draft" spellcheck="false" aria-describedby="draft-state diagnostics"></textarea>
 <div class="process-editor-actions"><button id="validate">Validate draft</button><button id="apply">Apply draft & reset run</button><button id="export-draft">Export draft</button><button id="restore-draft">Restore active definition</button></div><pre id="diagnostics" role="status"></pre></div></section>`;
 const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
 const setHtml = (id: string, html: string): boolean => {const node = get(id); if (node.dataset.html === html) return false; node.dataset.html = html; node.innerHTML = html; return true;};
 let view = app.query(), three: LWProcess3D.Surface | null = null;
 const newMap = () => root.LWProcess2D.create(get('map'), id => command(() => app.select(id)));
 let svg = newMap();
 /** The single source of truth for the unapplied draft of every process (switching process never discards it). #draft mirrors it. */
 const draft = root.LWProcessDraft.create();
 const dataView = root.LWProcessData.create(get('process-data'));
 let stepEditor: LWProcessStepEditor.Surface;
 const tuning = root.LWProcessTuning.create(get('tuning'), () => draft.read(), text => draft.write(text, 'tuning'));
 let tuneTimer = 0, last = 0, elapsed = 0, frameId = 0, disposed = false, unavailable = '', previousStatus = '';
 let guidance = false;
 const status = (message: string, error = false) => {
  guidance = /^(Ready\.|Switched to|Run reset)/.test(message);
  get('message').textContent = message + (unavailable && message !== unavailable ? ' ' + unavailable : '');
  get('message').classList.toggle('error', error || !!unavailable); get('message').setAttribute('aria-live', error ? 'assertive' : 'polite');
 };
 const download = (name: string, data: string, type: string) => {
  const url = URL.createObjectURL(new Blob([data], {type})), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
 };
 function draftState(): void {
  const changed = draft.changed(), summary = changed ? draft.describeDiff() : '';
  const message = changed ? `${summary || 'Unapplied draft'}. Export JSON and Download HTML use the active definition. Export draft saves these edits.` : 'Draft matches the active definition.';
  if (get('draft-state').textContent !== message) get('draft-state').textContent = message;
  get('draft-state').classList.toggle('unapplied', changed);
 }
 draft.subscribe(e => {
  const area = get<HTMLTextAreaElement>('draft'); if (area.value !== e.text) area.value = e.text;
  area.removeAttribute('aria-invalid'); get('diagnostics').textContent = ''; draftState();
  if (e.source === 'raw') {clearTimeout(tuneTimer); tuneTimer = window.setTimeout(() => tuning.refresh(), 600);} else if (e.source !== 'tuning') tuning.refresh();
 });
 function rebuild(): void {
  three?.dispose(); three = null; unavailable = ''; dataView.reset();
  // A disposed renderer force-loses its context for good, so every rebuild draws on a fresh canvas element.
  const stale = get('canvas'); stale.replaceWith(stale.cloneNode(false));
  try {three = root.LWProcess3D.create(get<HTMLCanvasElement>('canvas'), app.query().definition, id => command(() => app.select(id)));}
  catch (e) {unavailable = '3D unavailable in this browser. The complete simulation is available in 2D.'; app.mode('2d'); status(unavailable, true);}
  draft.enter(app.query().active, app.query().definition);
 }
 function syncSwitch(): void {
  const many = view.processes.length > 1, select = get<HTMLSelectElement>('process-switch');
  get('process-switch-label').hidden = !many;
  get('process-subtitle').textContent = many ? `Wildlands · Process Studio · Process ${view.active + 1} of ${view.processes.length}. JSON, BPMN and report exports use this process; Download HTML keeps all.` : 'Wildlands · Process Studio';
  if (!many) return;
  const names = view.processes.map(p => p.name), label = (p: {id: string; name: string}) => names.filter(n => n === p.name).length > 1 ? `${p.name} (${p.id})` : p.name;
  setHtml('process-switch', view.processes.map((p, i) => `<option value="${i}">${esc(label(p))}</option>`).join('')); select.value = String(view.active);
 }
 function switchTo(index: number): void {
  draft.leave(); app.use(index); dataView.reset();
  svg.dispose(); svg = newMap(); rebuild();
  refresh(); status('Switched to ' + app.query().definition.name + '. Paused at minute 0.');
 }
 const operator = (n: LWProcess.Need) => root.LWProcessNeeds.describe(n);
 const works = (s: LWProcess.Step) => s.kind === 'task' || s.kind === 'machine' || s.kind === 'system', automated = (s: LWProcess.Step) => s.kind === 'machine' || s.kind === 'system';
 function needsHtml(step: LWProcess.Step): string {
  const delivered = [...Object.entries(step.set ?? {}).map(([k, v]) => `<li>${esc(k)} = ${esc(JSON.stringify(v))}</li>`), ...Object.entries(step.add ?? {}).map(([k, n]) => `<li>${n >= 0 ? '+' : '\u2212'}${Math.abs(n)} to ${esc(k)} (counter)</li>`)].join('');
  const deliveries = root.LWProcessNeeds.deliveries(view.definition, step.id), names = new Map(view.definition.steps.map(s => [s.id, s.name]));
  const needs = (step.needs ?? []).map((n, i) => { const from = deliveries[i]!, who = [...from.steps.map(id => names.get(id)!), ...from.arrivals ? ['case arrival'] : []];
   return `<li><strong>${esc(operator(n))}</strong>${n.label ? ' · ' + esc(n.label) : ''}<small>${who.length ? 'Delivered by ' + esc(who.join(', ')) : 'No earlier delivery'}</small></li>`; }).join('');
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
 function refresh(): void {
  const focused = document.activeElement as HTMLElement | null, focusedStep = focused?.dataset.step, focusedNext = focused?.dataset.next;
  view = app.query(); const {definition: d, snapshot: q, selected} = view, step = d.steps.find(s => s.id === selected);
  get('process-title').textContent = d.name; syncSwitch(); get('step-count').textContent = String(d.steps.length);
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
  get('overview').classList.toggle('selected', !selected); if (!selected) get('overview').setAttribute('aria-current', 'true'); else get('overview').removeAttribute('aria-current'); get('scene-title').textContent = step?.name ?? 'Process overview';
  get('scene-subtitle').textContent = step ? step.scene.id + ' · ' + step.kind : `${d.steps.length} connected scenes · ${num(q.metrics.arrived)} ${q.metrics.arrived === 1 ? "case" : "cases"} admitted`;
  get('inspector-title').textContent = step ? 'Scene details' : 'Process overview';
  const m = q.steps.find(m => m.id === selected);
  const inspectorHtml = step ? `<p>${esc(step.description ?? step.name)}</p>${automated(step) ? `<p class="process-auto">Runs automatically${step.technology ? ' on ' + esc(step.technology) : ''}. No people are needed.</p>` : ''}<dl>${timingHtml(step, m!)}<dt>${automated(step) ? 'Running / waiting' : 'Working / waiting'}</dt><dd>${m!.active} / ${m!.queued}</dd><dt>Completed visits</dt><dd>${num(m!.completed)}</dd><dt>Total queue time</dt><dd>${num(m!.waitMinutes)} min</dd><dt>Fixed cost per visit</dt><dd>${num(step.cost ?? 0)}</dd></dl>${needsHtml(step)}${outputsHtml(step, q)}${backlogHtml(step, q)}<h3>Next steps</h3>${d.flows.filter(f => f.from === step.id).map(f => `<button class="next-step" data-next="${esc(f.to)}">${esc(d.steps.find(s => s.id === f.to)!.name)}${f.label ? ' · ' + esc(f.label) : ''}</button>`).join('') || '<p>Process ends here.</p>'}`
   : `<p>${esc(d.description ?? 'Cases move through the process. Run the simulation to see work, queues and resource contention.')}</p><p>${d.flows.length} connections · revision ${d.revision}</p>`;
  if (setHtml('inspector', inspectorHtml)) {
   get('inspector').querySelectorAll<HTMLButtonElement>('[data-next]').forEach(b => b.onclick = () => command(() => app.select(b.dataset.next!)));
  }
  get('edit-step').hidden = !step;
  setHtml('pools', q.resources.map(p => `<div class="process-pool"><strong>${esc(d.resources.find(r => r.id === p.id)!.name)}</strong><span>${p.busy}/${p.capacity} busy · ${num(p.utilization * 100)}%</span><progress value="${p.busy}" max="${p.capacity}" aria-label="${esc(p.id)} busy capacity"></progress></div>`).join('') || '<p>No shared resources defined.</p>');
  setHtml('metrics', [['Completed', num(q.metrics.completed)], ['In progress', num(q.metrics.active)], ['Mean cycle', num(q.metrics.meanCycleMinutes) + ' min'], ['Simulated cost', num(q.metrics.cost)], ['Failed', num(q.metrics.failed)]].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join(''));
  setHtml('events', q.events.slice(-25).reverse().map(e => `<div><time>${num(e.minute)} min</time><span>${esc(e.caseId)}</span><strong>${esc(e.kind.replaceAll('-', ' '))}</strong><span>${esc(d.steps.find(s => s.id === e.stepId)?.name ?? e.detail)}${e.kind.startsWith('timer-') && e.detail ? ' · ' + esc(e.detail) : ''}</span></div>`).join('') || '<p>No work has arrived yet.</p>');
  get('canvas').hidden = view.mode !== '3d'; get('map').hidden = view.mode !== '2d';
  get('mode-2d').setAttribute('aria-pressed', String(view.mode === '2d')); get('mode-3d').setAttribute('aria-pressed', String(view.mode === '3d'));
  get<HTMLButtonElement>('mode-3d').disabled = !!unavailable; get('frame').title = view.mode === '2d' ? 'Reset map view (0)' : 'Reset camera (F)';
  get('camera-hint').textContent = view.mode === '3d' ? 'Drag to orbit · Right-drag or Shift-drag to pan · Scroll to zoom · Arrows / WASD / + − / F' : 'Drag to pan · Scroll or pinch to zoom · Arrows / + − / 0 · Select a scene on the map';
  const visibleTokens = q.tokens.filter(t => !selected || t.stepId === selected).length;
  get('marker-count').textContent = view.mode === '3d' && visibleTokens > 120 ? `Showing 120 of ${visibleTokens} work markers` : '';
  dataView.draw(view);
  if (view.mode === '2d') svg.draw(view);
  if (focusedStep) get('steps').querySelector<HTMLButtonElement>(`[data-step="${focusedStep}"]`)?.focus({preventScroll: true});
  if (focusedNext) {
   const target = get('inspector').querySelector<HTMLButtonElement>(`[data-next="${focusedNext}"]`) ?? get('steps').querySelector<HTMLButtonElement>(`[data-step="${view.selected}"]`);
   target?.focus({preventScroll: true});
  }
 }
 function command(action: () => void): boolean {try {action(); refresh(); return true;} catch (e) {status(String(e), true); return false;}}
 /** Names the simulated time after a manual clock command unless the run just stopped (refresh already explains that). */
 const announce = () => {const s = view.snapshot; if (!view.playing && s.status !== 'completed' && s.status !== 'limit' && s.status !== 'blocked') status('Advanced to minute ' + num(s.minute) + '.');};
 const on = (id: string, action: () => void) => {get(id).onclick = () => command(action);};
 on('play', () => app.play(!view.playing));
 get('step').onclick = () => {if (command(() => {app.play(false); app.advance(1);})) announce();};
 get('advance').onclick = () => {if (command(() => {app.play(false); app.advance(Math.max(1, Math.min(30, view.horizon === null ? 30 : view.horizon - view.snapshot.minute)));})) announce();};
 get<HTMLSelectElement>('process-switch').onchange = () => {try {switchTo(Number(get<HTMLSelectElement>('process-switch').value));} catch (e) {syncSwitch(); status(String(e), true);}};
 on('reset', () => {app.reset(); dataView.reset(); status('Run reset. Definition retained.');});
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
 on('overview', () => app.select(null)); on('mode-2d', () => app.mode('2d')); on('mode-3d', () => app.mode('3d')); on('frame', () => {if (view.mode === '2d') svg.frame(); else three?.frame();});
 on('json', () => download(view.definition.id + '.process.json', JSON.stringify(view.definition, null, 2), 'application/json'));
 on('bpmn', () => {download(view.definition.id + '.bpmn', root.LWProcessBpmn.export(view.definition), 'application/xml'); status('Exported BPMN 2.0 XML with diagram layout. Wildlands values are stored in a wl: extension; other tools may ignore them.');});
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
 on('import', () => get<HTMLInputElement>('file').click());
 get<HTMLInputElement>('file').onchange = async () => {
  const file = get<HTMLInputElement>('file').files?.[0]; if (!file) return;
  try {if (file.size > 8 * 1024 * 1024) throw Error('Choose a JSON or BPMN file smaller than 8 MiB.'); const text = await file.text();
   let notes = '';
   if (/\.(bpmn|xml)$/i.test(file.name) || text.trimStart().startsWith('<')) {
    const result = root.LWProcessBpmn.import(text);
    if (!result.ok) throw Error('BPMN needs changes before it can run: ' + result.diagnostics.map(e => e.path + ': ' + e.message).join(' '));
    app.replace(result.definition); notes = result.warnings.length ? ' ' + result.warnings.length + ' import note(s): ' + result.warnings.slice(0, 2).join(' ') + (result.warnings.length > 2 ? ' …' : '') : '';
   } else app.replace(JSON.parse(text) as unknown);
   rebuild(); refresh(); status('Imported ' + file.name + '. New run is paused.' + notes);}
  catch (e) {status('Import rejected; active process retained. ' + String(e), true);}
  get<HTMLInputElement>('file').value = '';
 };
 const showEditor = (yes: boolean) => {get('editor').hidden = !yes; get('events').hidden = yes; get('show-events').setAttribute('aria-pressed', String(!yes)); get('show-definition').setAttribute('aria-pressed', String(yes));};
 on('show-events', () => showEditor(false)); on('show-definition', () => {app.play(false); showEditor(true); tuning.refresh();});
 function checkDraft(): LWProcess.Definition | undefined {
  try {const result = root.LWProcessCatalog.validate(JSON.parse(draft.read()));
   get('diagnostics').textContent = result.ok ? 'Valid definition. Applying starts a fresh paused run.' : result.diagnostics.map(e => e.path + ': ' + e.message).join('\n');
   get('draft').setAttribute('aria-invalid', String(!result.ok));
   return result.ok ? result.definition : undefined;
  } catch (e) {get('draft').setAttribute('aria-invalid', 'true'); get('diagnostics').textContent = 'Invalid JSON: ' + String(e); return undefined;}
 }
 get<HTMLTextAreaElement>('draft').oninput = () => {get('diagnostics').textContent = ''; get('draft').removeAttribute('aria-invalid'); draft.write(get<HTMLTextAreaElement>('draft').value, 'raw'); draftState();};

 function applyDraft(): boolean {
  const d = checkDraft(); if (!d) return false;
  d.revision = Math.max(view.definition.revision + 1, d.revision); app.replace(d); rebuild(); status('Definition applied. New run is paused.'); return true;
 }
 on('validate', () => {checkDraft();}); on('apply', () => {applyDraft();});
 /** The step editor is modal: it pauses the run (a command, never a tick), edits only the draft, and the inert page cannot change selection or time while it is open. */
 function openStepEditor(): void {
  const id = view.selected; if (!id) return;
  if (draft.parse() && view.playing) command(() => app.play(false));
  if (stepEditor.open(id, get('edit-step'))) status('Editing a step. The run is paused while the editor is open.');
 }
 stepEditor = root.LWProcessStepEditor.create(host, {
  draft, notify: status, run: () => ({minute: app.query().snapshot.minute, cases: app.query().snapshot.cases.length}),
  apply: text => {draft.write(text, 'step-editor'); let ok = false; command(() => {ok = applyDraft();}); return ok;},
  focusFor: id => {const direct = get('edit-step'); return !direct.hidden && direct.getClientRects().length ? direct : get('steps').querySelector<HTMLElement>(`[data-step="${id}"]`);},
 });
 on('edit-step', () => openStepEditor());
 on('export-draft', () => {download(view.definition.id + '.draft.json', draft.read(), 'application/json'); status('Draft downloaded as written. Apply a valid draft to update the simulation.');});
 on('restore-draft', () => {draft.restore(); get('draft').removeAttribute('aria-invalid'); draftState(); get('diagnostics').textContent = 'Draft restored from the active definition.';});
 function animate(time: number): void {
  if (disposed) return; const delta = Math.min(.1, (time - last) / 1000 || 0); last = time;
  if (view.playing) {elapsed += delta; if (elapsed >= .35) {elapsed = 0; command(() => app.pulse(Number(get<HTMLSelectElement>('speed').value)));}} else elapsed = 0;
  if (view.mode === '3d') three?.draw(view, delta);
  frameId = requestAnimationFrame(animate);
 }
 rebuild(); refresh(); status(unavailable || 'Ready. Run the simulation, or choose a scene to inspect its work.', !!unavailable);
 root.LWProcessStudio = Object.freeze({query: () => app.query(), definition: () => app.query().definition, definitions: () => app.definitions()});
 root.__wildlandsReady = true;
 document.documentElement.dataset.wildlandsReady = 'process'; dispatchEvent(new CustomEvent('wildlands:ready', {detail: {host: 'process'}}));
 frameId = requestAnimationFrame(animate);
 window.addEventListener('pagehide', () => {disposed = true; cancelAnimationFrame(frameId); three?.dispose(); svg.dispose(); tuning.dispose(); stepEditor.dispose(); app.dispose();}, {once: true});
})(globalThis);
