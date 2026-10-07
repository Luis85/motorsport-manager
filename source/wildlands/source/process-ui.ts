/// <reference path="./process-contracts.d.ts" />
/** Offline browser adapter: input/output, application commands, and detached scene views. */
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWContentProvider: LWContentProvider.Api; LWProcessApplication: LWProcessApp.Api; LWProcessCatalog: LWProcess.Catalog;
  LWProcessData: LWProcessData.Api; LWProcess2D: LWProcess2D.Api; LWProcess3D: LWProcess3D.Api; LWProcessStudio?: unknown; __wildlandsReady?: boolean};
 const host = document.getElementById('process-shell'); if (!host) return;
 const pristine = '<!doctype html>\n' + document.documentElement.outerHTML;
 const esc = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
 const num = (n: number) => Number(n.toFixed(1)).toLocaleString();
 let app: LWProcessApp.Controller;
 try {app = root.LWProcessApplication.create(root.LWContentProvider.get('process').process);} catch (e) {host.textContent = 'Process could not load: ' + String(e); return;}
 host.innerHTML = `
 <header class="process-header"><div><h1 id="process-title"></h1><p>Wildlands · Process Studio</p></div><div class="process-file-actions">
 <button id="import">Import JSON</button><button id="json">Export JSON</button><button id="html">Download HTML</button><input type="file" id="file" accept=".json,application/json" hidden></div></header>
 <div class="process-toolbar" aria-label="Simulation controls"><button id="play" class="primary">Run simulation</button><button id="step">Step 1 min</button><button id="advance">Advance 30 min</button><button id="reset">Reset run</button>
 <label>Speed <select id="speed"><option value="1">1 min / pulse</option><option value="5" selected>5 min / pulse</option><option value="30">30 min / pulse</option></select></label>
 <span id="clock" class="process-clock"></span><span id="run-status"></span></div>
 <div id="message" class="process-message" role="status" aria-live="polite"></div>
 <div class="process-workspace"><nav class="process-nav" aria-label="Process steps"><div class="process-panel-heading"><h2>Step scenes</h2><span id="step-count"></span></div>
 <button id="overview">Whole process</button><div id="steps"></div><p class="process-note">Choose a step to enter its scene. Navigation keeps the run at the same minute.</p></nav>
 <section class="process-stage" aria-label="Simulation viewport"><div class="process-stagebar"><div><h2 id="scene-title">Whole process</h2><p id="scene-subtitle"></p></div>
 <div class="process-view-controls"><button id="mode-2d" aria-pressed="false">2D</button><button id="mode-3d" aria-pressed="true">3D</button><button id="frame">Frame view</button></div></div>
 <div id="viewport"><canvas id="canvas" aria-label="3D process scenes. Use the scene list for keyboard selection." tabindex="0"></canvas><div id="map" hidden></div></div>
 <div class="process-legend"><span><i class="active-dot"></i>Working</span><span><i class="queue-dot"></i>Waiting</span><span id="marker-count"></span><span id="camera-hint">Drag to orbit · Scroll to zoom</span></div>
 <div id="metrics" class="process-metrics" aria-label="Run metrics"></div><section id="process-data" aria-label="Process inputs and outputs"></section></section>
 <aside class="process-inspector" aria-label="Scene inspector"><h2 id="inspector-title">Process overview</h2><div id="inspector"></div><h3>Shared resources</h3><div id="pools"></div><button id="report">Export run report</button></aside></div>
 <section class="process-bottom"><div class="process-bottom-nav"><button id="show-events" aria-pressed="true">Activity</button><button id="show-definition" aria-pressed="false">Definition editor</button><span>Simulation results depend on authored durations and capacities</span></div>
 <div id="events" class="process-events"></div><div id="editor" hidden><p>Edit the JSON draft, validate, then apply to start a fresh paused run. Export your run report first if you need it.</p><label for="draft">Process definition</label><textarea id="draft" spellcheck="false"></textarea>
 <div class="process-editor-actions"><button id="validate">Validate draft</button><button id="apply">Apply draft & reset run</button><button id="restore-draft">Restore active definition</button></div><pre id="diagnostics" role="status"></pre></div></section>`;
 const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
 let view = app.query(), three: LWProcess3D.Surface | null = null, svg = root.LWProcess2D.create(get('map'), id => command(() => app.select(id)));
 const dataView = root.LWProcessData.create(get('process-data'));
 let last = 0, elapsed = 0, frameId = 0, disposed = false, unavailable = '';
 const status = (message: string, error = false) => {
  get('message').textContent = message + (unavailable && message !== unavailable ? ' ' + unavailable : '');
  get('message').classList.toggle('error', error || !!unavailable);
 };
 const download = (name: string, data: string, type: string) => {
  const url = URL.createObjectURL(new Blob([data], {type})), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
 };
 function rebuild(): void {
  three?.dispose(); three = null; unavailable = ''; dataView.reset();
  try {three = root.LWProcess3D.create(get<HTMLCanvasElement>('canvas'), app.query().definition, id => command(() => app.select(id)));}
  catch (e) {unavailable = '3D unavailable in this browser. The complete simulation is available in 2D.'; app.mode('2d'); status(unavailable, true);}
  get<HTMLTextAreaElement>('draft').value = JSON.stringify(app.query().definition, null, 2);
 }
 function refresh(): void {
  const focused = document.activeElement as HTMLElement | null, focusedStep = focused?.dataset.step, focusedNext = focused?.dataset.next;
  view = app.query(); const {definition: d, snapshot: q, selected} = view, step = d.steps.find(s => s.id === selected);
  get('process-title').textContent = d.name; get('step-count').textContent = String(d.steps.length);
  get('clock').textContent = num(q.minute) + ' min'; get('run-status').textContent = view.playing ? 'Running' : q.status === 'completed' ? 'Finished' : q.status === 'limit' ? 'Run limit reached' : q.status === 'blocked' ? 'Blocked' : 'Paused';
  get('play').textContent = view.playing ? 'Pause' : 'Run simulation';
  for (const id of ['play', 'step', 'advance']) get<HTMLButtonElement>(id).disabled = ['completed', 'limit', 'blocked'].includes(q.status);
  get('steps').innerHTML = d.steps.map((s, i) => {const m = q.steps.find(m => m.id === s.id)!; return `<button data-step="${esc(s.id)}" class="process-step ${s.id === selected ? 'selected' : ''}" aria-current="${s.id === selected ? 'step' : 'false'}"><span class="process-order">${String(i + 1).padStart(2, '0')}</span><span><strong>${esc(s.name)}</strong><small>${esc(s.kind)}${m.active ? ' · ' + m.active + ' working' : ''}${m.queued ? ' · ' + m.queued + ' waiting' : ''}</small></span><i style="background:${s.scene.color}"></i></button>`;}).join('');
  get('steps').querySelectorAll<HTMLButtonElement>('button').forEach(b => b.onclick = () => command(() => app.select(b.dataset.step!)));
  get('overview').classList.toggle('selected', !selected); get('scene-title').textContent = step?.name ?? 'Whole process';
  get('scene-subtitle').textContent = step ? step.scene.id + ' · ' + step.kind : `${d.steps.length} connected scenes · ${q.metrics.arrived} cases admitted`;
  get('inspector-title').textContent = step ? 'Scene details' : 'Process overview';
  const m = q.steps.find(m => m.id === selected);
  get('inspector').innerHTML = step ? `<p>${esc(step.description ?? step.name)}</p><dl><dt>Duration</dt><dd>${step.duration ?? 0} min</dd><dt>Working / waiting</dt><dd>${m!.active} / ${m!.queued}</dd><dt>Completed visits</dt><dd>${m!.completed}</dd><dt>Total queue time</dt><dd>${m!.waitMinutes} min</dd><dt>Fixed cost per visit</dt><dd>${step.cost ?? 0}</dd></dl><h3>Next steps</h3>${d.flows.filter(f => f.from === step.id).map(f => `<button class="next-step" data-next="${esc(f.to)}">${esc(d.steps.find(s => s.id === f.to)!.name)}${f.label ? ' · ' + esc(f.label) : ''}</button>`).join('') || '<p>Process ends here.</p>'}`
   : `<p>${esc(d.description ?? 'Cases move through the process. Run the simulation to see work, queues and resource contention.')}</p><p>${d.flows.length} connections · revision ${d.revision}</p>`;
  get('inspector').querySelectorAll<HTMLButtonElement>('[data-next]').forEach(b => b.onclick = () => command(() => app.select(b.dataset.next!)));
  get('pools').innerHTML = q.resources.map(p => `<div class="process-pool"><strong>${esc(d.resources.find(r => r.id === p.id)!.name)}</strong><span>${p.busy}/${p.capacity} busy · ${num(p.utilization * 100)}%</span><progress value="${p.busy}" max="${p.capacity}" aria-label="${esc(p.id)} busy capacity"></progress></div>`).join('') || '<p>No shared resources defined.</p>';
  get('metrics').innerHTML = [['Completed', q.metrics.completed], ['In progress', q.metrics.active], ['Mean cycle', num(q.metrics.meanCycleMinutes) + ' min'], ['Simulated cost', num(q.metrics.cost)], ['Failed', q.metrics.failed]].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('');
  get('events').innerHTML = q.events.slice(-25).reverse().map(e => `<div><time>${e.minute} min</time><span>${esc(e.caseId)}</span><strong>${esc(e.kind.replaceAll('-', ' '))}</strong><span>${esc(d.steps.find(s => s.id === e.stepId)?.name ?? e.detail)}</span></div>`).join('') || '<p>No work has arrived yet.</p>';
  get('canvas').hidden = view.mode !== '3d'; get('map').hidden = view.mode !== '2d';
  get('mode-2d').setAttribute('aria-pressed', String(view.mode === '2d')); get('mode-3d').setAttribute('aria-pressed', String(view.mode === '3d'));
  get<HTMLButtonElement>('mode-3d').disabled = !!unavailable; get<HTMLButtonElement>('frame').disabled = view.mode === '2d'; get('frame').title = view.mode === '2d' ? 'The 2D map fits automatically.' : 'Reset camera (F)';
  get('camera-hint').textContent = view.mode === '3d' ? 'Drag to orbit · Scroll to zoom · Arrows / + − / F' : 'Select a scene on the map';
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
 function command(action: () => void): void {try {action(); refresh();} catch (e) {status(String(e), true);}}
 const on = (id: string, action: () => void) => {get(id).onclick = () => command(action);};
 on('play', () => app.play(!view.playing)); on('step', () => {app.play(false); app.advance(1);});
 on('advance', () => {app.play(false); app.advance(Math.min(30, 100000 - view.snapshot.minute));});
 on('reset', () => {app.reset(); dataView.reset(); status('Run reset. Definition retained.');});
 on('overview', () => app.select(null)); on('mode-2d', () => app.mode('2d')); on('mode-3d', () => app.mode('3d')); on('frame', () => three?.frame());
 on('json', () => download(view.definition.id + '.process.json', JSON.stringify(view.definition, null, 2), 'application/json'));
 on('report', () => download(view.definition.id + '.report.json', JSON.stringify({format: 'wildlands-process-report', schemaVersion: 1, fingerprint: root.LWProcessCatalog.fingerprint(view.definition), definition: view.definition, snapshot: view.snapshot}, null, 2), 'application/json'));
 on('html', () => {
  const encoded = JSON.stringify(view.definition).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
  const html = pristine.replace(/window\.LWProcessDefinition = [^\n]*;/, () => 'window.LWProcessDefinition = ' + encoded + ';')
   .replace(/<meta name="wildlands-game-digest"[^>]*>/g, '').replace(/<title>[^<]*<\/title>/, () => '<title>' + esc(view.definition.name) + '</title>');
  download(view.definition.id + '.html', html, 'text/html'); status('Downloaded an offline HTML with the active definition. It opens with a fresh paused run.');
 });
 on('import', () => get<HTMLInputElement>('file').click());
 get<HTMLInputElement>('file').onchange = async () => {
  const file = get<HTMLInputElement>('file').files?.[0]; if (!file) return;
  try {if (file.size > 8 * 1024 * 1024) throw Error('Choose a JSON file smaller than 8 MiB.'); const input = JSON.parse(await file.text()) as unknown;
   app.replace(input); rebuild(); refresh(); status('Imported ' + file.name + '. New run is paused.');}
  catch (e) {status('Import rejected; active process retained. ' + String(e), true);}
  get<HTMLInputElement>('file').value = '';
 };
 const showEditor = (yes: boolean) => {get('editor').hidden = !yes; get('events').hidden = yes; get('show-events').setAttribute('aria-pressed', String(!yes)); get('show-definition').setAttribute('aria-pressed', String(yes));};
 on('show-events', () => showEditor(false)); on('show-definition', () => {app.play(false); showEditor(true);});
 function checkDraft(): LWProcess.Definition | undefined {
  try {const result = root.LWProcessCatalog.validate(JSON.parse(get<HTMLTextAreaElement>('draft').value));
   get('diagnostics').textContent = result.ok ? 'Valid definition. Applying starts a fresh paused run.' : result.diagnostics.map(e => e.path + ': ' + e.message).join('\n');
   return result.ok ? result.definition : undefined;
  } catch (e) {get('diagnostics').textContent = 'Invalid JSON: ' + String(e); return undefined;}
 }
 on('validate', () => {checkDraft();}); on('apply', () => {const d = checkDraft(); if (!d) return; d.revision = Math.max(view.definition.revision + 1, d.revision); app.replace(d); rebuild(); status('Definition applied. New run is paused.');});
 on('restore-draft', () => {get<HTMLTextAreaElement>('draft').value = JSON.stringify(view.definition, null, 2); get('diagnostics').textContent = 'Draft restored from the active definition.';});
 function animate(time: number): void {
  if (disposed) return; const delta = Math.min(.1, (time - last) / 1000 || 0); last = time;
  if (view.playing) {elapsed += delta; if (elapsed >= .35) {elapsed = 0; command(() => app.pulse(Number(get<HTMLSelectElement>('speed').value)));}} else elapsed = 0;
  if (view.mode === '3d') three?.draw(view, delta);
  frameId = requestAnimationFrame(animate);
 }
 rebuild(); refresh(); status(unavailable || 'Ready. Run the simulation, or choose a scene to inspect its work.', !!unavailable);
 root.LWProcessStudio = Object.freeze({query: () => app.query(), definition: () => app.query().definition});
 root.__wildlandsReady = true;
 document.documentElement.dataset.wildlandsReady = 'process'; dispatchEvent(new CustomEvent('wildlands:ready', {detail: {host: 'process'}}));
 frameId = requestAnimationFrame(animate);
 window.addEventListener('pagehide', () => {disposed = true; cancelAnimationFrame(frameId); three?.dispose(); svg.dispose(); app.dispose();}, {once: true});
})(globalThis);
