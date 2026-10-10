/// <reference path="./process-contracts.d.ts" />
/**
 * Offline browser adapter: the studio shell, application commands, and detached scene views. The run bar and status line live in
 * LWProcessRunBar, the step list in LWProcessStepList, file import and export in LWProcessIO, and the leave/replace questions and
 * the page lifecycle in LWProcessGuard.
 */
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWContentProvider: LWContentProvider.Api; LWProcessApplication: LWProcessApp.Api; LWProcessCatalog: LWProcess.Catalog;
  LWProcessData: LWProcessData.Api; LWProcess2D: LWProcess2D.Api; LWProcess3D: LWProcess3D.Api; LWProcessStepEditor: LWProcessStepEditor.Api;
  LWProcessDefinitionEditor: LWProcessDefinitionEditor.Api; LWProcessDialog: LWProcessDialog.Api; LWProcessDraft: LWProcessDraft.Api;
  LWProcessActivity: LWProcessActivity.Api; LWProcessInspector: LWProcessInspector.Api; LWProcessMenu: LWProcessMenu.Api; LWProcessTerms: LWProcessTerms.Api;
  LWProcessLens: LWProcessLens.Api; LWProcessPresent: LWProcessPresent.Api; LWProcessRunBar: LWProcessRunBar.Api; LWProcessIO: LWProcessIO.Api;
  LWProcessGuard: LWProcessGuard.Api; LWProcessStepList: LWProcessStepList.Api; LWProcessStudio?: unknown; __wildlandsReady?: boolean};
 const host = document.getElementById('process-shell'); if (!host) return;
 const pristine = '<!doctype html>\n' + document.documentElement.outerHTML;
 const esc = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
 const num = (n: number) => Number(n.toFixed(1)).toLocaleString();
 let app: LWProcessApp.Controller;
 try {
  const profile = root.LWContentProvider.get('process'); app = root.LWProcessApplication.create(profile.processes ?? profile.process);
 } catch (e) {host.textContent = 'Process could not load: ' + String(e); return;}
 const item = (id: string, label: string, extra = '') => `<button id="${id}" role="menuitem" tabindex="-1"${extra}>${label}</button>`;
 const caret = '<span aria-hidden="true">▾</span>';
 host.innerHTML = `
 <header class="process-header"><div class="process-titles"><h1 id="process-title"></h1><p id="process-subtitle">Wildlands · Process Studio</p></div>
 <div class="process-file-actions">
  <label id="process-switch-label" class="process-switch" hidden>Process <select id="process-switch" aria-describedby="process-subtitle"></select></label>
  <button id="open-definition" aria-haspopup="dialog" aria-label="Edit process" title="Edit process…">Edit<span class="long"> process…</span></button>
  <button id="draft-chip" class="process-draft-chip" aria-haspopup="dialog" hidden></button>
  <button id="import" title="Import a process from a JSON or BPMN file">Import…</button>
  <div class="process-menu">
   <button id="export-menu" class="menu-long" aria-haspopup="menu" aria-expanded="false" aria-controls="export-items">Export ${caret}</button>
   <button id="more-menu" class="menu-short" aria-haspopup="menu" aria-expanded="false" aria-controls="export-items" aria-label="More actions">⋯</button>
   <div id="export-popup" class="process-menu-popup" hidden><p id="export-hint" class="menu-hint"></p>
    <div id="export-items" role="menu" aria-label="Import, present and export">
     ${item('import-item', 'Import JSON or BPMN…', ' class="menu-phone"')}
     ${item('present-item', 'Present slides', ' class="menu-phone" aria-haspopup="dialog"')}
     ${item('json', 'Export JSON')}${item('draft-json', 'Export draft JSON', ' hidden')}${item('bpmn', 'Export BPMN')}
     ${item('bpmn-bpsim', 'Export BPMN with BPSim')}${item('report', 'Export run report')}${item('html', 'Download HTML')}</div></div></div>
  <input type="file" id="file" accept=".json,.bpmn,.xml,application/json,application/xml,text/xml" hidden></div></header>
 ${root.LWProcessRunBar.markup()}
 <div class="process-workspace">
 <nav class="process-nav" aria-label="Process steps"><div class="process-sticky">
  <div class="process-panel-heading"><h2 id="steps-heading">Step scenes</h2><span id="step-count"></span></div>
  <button id="overview">Whole process</button></div>
  <ol id="steps" class="process-steps"></ol><p class="process-note">Choose a step to enter its scene. Navigation keeps the run at the same minute.</p></nav>
 <section class="process-stage" aria-label="Simulation viewport"><div class="process-stagebar">
  <div class="process-stagetitle"><h2 id="scene-title" tabindex="-1">Whole process</h2><p id="scene-subtitle"></p>
   <p id="message" class="process-message" role="status" aria-live="polite"></p></div>
  <div class="process-view-controls"><button id="back-overview" class="scene-back" hidden><span aria-hidden="true">← </span>Whole process</button>
   <button id="mode-2d" aria-pressed="false">2D</button><button id="mode-3d" aria-pressed="true">3D</button>
   <button id="mode-lens" aria-pressed="false">SIPOC</button>
   <button id="mode-present" aria-haspopup="dialog">Present</button><button id="frame">Frame view</button>
   <button id="edit-step" aria-haspopup="dialog" hidden>Edit step…</button></div></div>
 <div id="viewport">
  <canvas id="canvas" role="img" aria-label="3D process scenes. Use the scene list for keyboard selection." aria-describedby="camera-hint"
   tabindex="0"></canvas>
  <div id="map" hidden></div><div id="lens" hidden></div></div>
 <div class="process-legend"><span><i class="active-dot"></i>Working</span><span><i class="queue-dot"></i>Waiting</span><span><i class="timer-dot"></i>Timer</span><span><i class="backlog-dot"></i>Backlog</span><span><i class="held-dot"></i>Blocked</span><span id="marker-count"></span><span id="camera-hint">Drag to orbit · Scroll to zoom</span></div>
 <div id="metrics" class="process-metrics" role="group" aria-label="Run metrics"></div><p id="latest" class="process-latest"></p>
 <details id="io-panel" class="process-io"><summary>Inputs &amp; outputs</summary>
  <section id="process-data" aria-label="Process inputs and outputs"></section></details></section>
 <aside class="process-inspector" aria-label="Scene inspector"><div class="process-sticky"><h2 id="inspector-title">Process overview</h2>
  <button id="inspector-toggle" class="panel-toggle" aria-expanded="true" aria-controls="inspector-body">Details ${caret}</button></div>
  <div id="inspector-body"><section aria-labelledby="pools-title"><h3 id="pools-title">Shared resources</h3><div id="pools"></div></section>
  <div id="inspector"></div></div></aside></div>
 <div id="feed-announcer" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>`;
 const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
 const setHtml = (id: string, html: string): boolean => {
  const node = get(id); if (node.dataset.html === html) return false; node.dataset.html = html; node.innerHTML = html; return true;
 };
 let view = app.query(), three: LWProcess3D.Surface | null = null;
 const newMap = () => root.LWProcess2D.create(get('map'), id => command(() => app.select(id)));
 let svg = newMap();
 /** The SIPOC grid or Journey map, built on demand for the process type and drawn only while it is the chosen view. */
 const lens = root.LWProcessLens.create(get('lens'), id => command(() => app.select(id)));
 /** The single source of truth for the unapplied draft of every process (switching process never discards it). #draft mirrors it. */
 const draft = root.LWProcessDraft.create();
 const dataView = root.LWProcessData.create(get('process-data'));
 /** The Activity badge counts only new problems (failed work, blocked work, dropped arrivals); routine events never raise it. */
 const badge = (urgent: number) => {
  const max = root.LWProcessActivity.MAX_BADGE, count = get('activity-count'), text = urgent <= 0 ? '' : ' · ' + (urgent > max ? max + '+' : urgent);
  if (count.textContent === text) return;
  count.textContent = text; count.hidden = !text; count.classList.toggle('urgent', !!text);
  const many = urgent > max ? `more than ${max} new problems` : `${urgent} new problem${urgent === 1 ? '' : 's'}`;
  get('open-activity').setAttribute('aria-label', urgent <= 0 ? 'Activity' : 'Activity, ' + many);
 };
 /** The event feed, its announcer and the Activity modal. It reads detached views only and never pauses or ticks the run. */
 const activity = root.LWProcessActivity.create(host, {
  view: () => view, inertRoot: host, announcer: get('feed-announcer'), badge, save: (name, data, type) => download(name, data, type),
  select: id => {command(() => app.select(id));}, stepItem: id => get('steps').querySelector<HTMLElement>(`[data-step="${id}"]`),
 });
 const menu = root.LWProcessMenu.create({triggers: [get('export-menu'), get('more-menu')], popup: get('export-popup')});
 // The Inputs & outputs panel opens by default on wide screens only; a choice made by the user is remembered for the session (in memory, never
 // storage). The panel is drawn only while open; opening it draws the current view at once.
 const io = get<HTMLDetailsElement>('io-panel'), wide = matchMedia('(min-width:1600px)');
 let ioChoice: boolean | null = null, lastSelected: string | null | undefined, descOpen = false;
 io.open = wide.matches; io.querySelector('summary')!.addEventListener('click', () => {ioChoice = !io.open;});
 wide.addEventListener('change', () => {if (ioChoice === null) io.open = wide.matches;});
 io.addEventListener('toggle', () => {if (io.open) dataView.draw(view);});
 let stepEditor: LWProcessStepEditor.Surface;
 let definitionEditor: LWProcessDefinitionEditor.Surface;
 let last = 0, elapsed = 0, frameId = 0, disposed = false, suspended = false, unavailable = '';
 const bar = root.LWProcessRunBar.create({app, view: () => view, command, fresh: () => {dataView.reset(); activity.reset();}, notice: () => unavailable});
 const status = (message: string, error = false) => bar.status(message, error);
 const plain = root.LWProcessRunBar.plain;
 const download = (name: string, data: string, type: string) => {
  const url = URL.createObjectURL(new Blob([data], {type})), a = document.createElement('a');
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
 };
 /** Processes left with an unapplied draft (the draft store keeps their text); with the active draft they drive the leave-page guard. */
 const awayDrafts = new Set<number>();
 const guard = root.LWProcessGuard.create({
  inertRoot: host, unsaved: () => draft.changed() || awayDrafts.size > 0,
  suspend: () => {suspended = true; cancelAnimationFrame(frameId);},
  resume: () => {if (!suspended || disposed) return; suspended = false; last = 0; frameId = requestAnimationFrame(animate);},
  dispose: () => dispose(),
 });
 /** The toolbar chip names the unapplied draft ("Unapplied draft · 3 steps, 1 resource changed") and opens the Definition editor; hidden when clean. */
 function draftChip(): void {
  const chip = get('draft-chip'), text = draft.changed() ? draft.describeDiff().replace(': ', ' · ') : '';
  chip.hidden = !text; if (chip.textContent !== text) chip.textContent = text;
  chip.title = text ? 'Open the Definition editor to review, apply or restore this draft. Export JSON and Download HTML use the running definition.' : '';
 }
 function rebuild(): void {
  three?.dispose(); three = null; unavailable = ''; dataView.reset(); activity.reset(); lens.reset();
  // A disposed renderer force-loses its context for good, so every rebuild draws on a fresh canvas element.
  const stale = get('canvas'); stale.replaceWith(stale.cloneNode(false));
  try {three = root.LWProcess3D.create(get<HTMLCanvasElement>('canvas'), app.query().definition, id => command(() => app.select(id)));}
  catch (e) {unavailable = '3D unavailable in this browser. The complete simulation is available in 2D.'; if (app.query().mode === '3d') app.mode('2d'); status(unavailable, true);}
  draft.enter(app.query().active, app.query().definition);
 }
 /** Replaces the running definition (a fresh paused run) and says what carried over: the run seed and the selected step of the same process. */
 function replace(definition: unknown): string {
  const before = view, seed = before.snapshot.seed, override = seed !== (before.definition.seed ?? 1);
  app.replace(definition); rebuild(); refresh();
  const notes: string[] = [], same = view.definition.id === before.definition.id;
  const dropped = `Run seed ${seed} dropped; this run uses the definition seed ${view.snapshot.seed}.`;
  if (override) notes.push(view.snapshot.seed === seed ? `Run seed ${seed} kept.` : dropped);
  const gone = same && before.selected && !view.selected ? before.definition.steps.find(s => s.id === before.selected)?.name : undefined;
  if (gone) notes.push(`${gone} no longer exists, so the whole process is shown.`);
  return notes.length ? ' ' + notes.join(' ') : '';
 }
 const files = root.LWProcessIO.create({
  host, view: () => view, definitions: () => app.definitions(), pristine, draft, status, download, replace, ask: options => guard.ask(options),
 });
 draft.subscribe(() => {draftChip(); files.sync();});
 function syncSwitch(): void {
  const many = view.processes.length > 1, select = get<HTMLSelectElement>('process-switch'), names = view.processes.map(p => p.name);
  get('process-switch-label').hidden = !many;
  get('process-subtitle').textContent = 'Wildlands · Process Studio' + (many ? ` · Process ${view.active + 1} of ${view.processes.length}` : '');
  files.sync();
  if (!many) return;
  const label = (p: {id: string; name: string}) => names.filter(n => n === p.name).length > 1 ? `${p.name} (${p.id})` : p.name;
  setHtml('process-switch', view.processes.map((p, i) => `<option value="${i}">${esc(label(p))}</option>`).join('')); select.value = String(view.active);
 }
 function switchTo(index: number): void {
  const before = view, seed = before.snapshot.seed, override = seed !== (before.definition.seed ?? 1);
  if (draft.changed()) awayDrafts.add(before.active); else awayDrafts.delete(before.active);
  draft.leave(); app.use(index); awayDrafts.delete(index); dataView.reset();
  svg.dispose(); svg = newMap(); rebuild(); refresh();
  const note = override ? ` Run seed ${seed} applied only to ${before.definition.name}; this process uses its own seed ${view.snapshot.seed}.` : '';
  status(`Switched to ${view.definition.name}. Paused at minute 0.${note}`);
 }
 /** Switching discards the run in progress, so past minute 0 it asks first (Cancel restores the list and focus). Drafts are always kept. */
 async function requestSwitch(index: number): Promise<void> {
  const select = get<HTMLSelectElement>('process-switch'), q = view.snapshot, from = view.definition.name;
  if (index === view.active) return;
  if (q.minute > 0) {
   const target = view.processes[index]?.name ?? 'another process', cases = `${q.cases.length.toLocaleString()} ${q.cases.length === 1 ? 'case' : 'cases'}`;
   const kept = draft.changed() || awayDrafts.size ? ' Unapplied drafts are kept.' : '';
   const message = `Switching to ${target} discards minute ${q.minute.toLocaleString()} of the ${from} run (${cases}).`
    + ` Export the run report first if you need it.${kept}`;
   if (!await guard.ask({title: `Switch to ${target}?`, confirm: 'Switch process', invoker: select, message})) {
    select.value = String(view.active); status(`Stayed on ${from}. The run is unchanged.`); return;
   }
  }
  switchTo(index);
 }
 function refresh(): void {
  const focused = document.activeElement as HTMLElement | null, focusedStep = focused?.closest('#steps') ? focused.dataset.step : undefined;
  const focusedNext = focused?.dataset.next;
  view = app.query(); const {definition: d, snapshot: q, selected} = view, step = d.steps.find(s => s.id === selected), terms = root.LWProcessTerms.of(d);
  get('steps-heading').textContent = terms.stepsHeading;
  get('process-title').textContent = d.name; get('process-title').title = d.name; syncSwitch(); get('step-count').textContent = String(d.steps.length);
  bar.sync(view, focused);
  if (setHtml('steps', root.LWProcessStepList.markup(view))) {
   get('steps').querySelectorAll<HTMLButtonElement>('button').forEach(b => b.onclick = () => command(() => app.select(b.dataset.step!)));
  }
  if (lastSelected !== selected) {
   lastSelected = selected; root.LWProcessStepList.reveal(document.querySelector<HTMLElement>('.process-nav')!, get('steps'), selected);
  }
  get('overview').classList.toggle('selected', !selected);
  if (!selected) get('overview').setAttribute('aria-current', 'true'); else get('overview').removeAttribute('aria-current');
  get('scene-title').textContent = step?.name ?? 'Whole process'; get('back-overview').hidden = !step;
  const admitted = `${num(q.metrics.arrived)} ${q.metrics.arrived === 1 ? terms.one : terms.many} admitted`;
  get('scene-subtitle').textContent = step ? step.scene.id + ' · ' + step.kind : `${d.steps.length} connected scenes · ${admitted}`;
  get('inspector-title').textContent = step ? 'Scene details' : 'Process overview';
  if (setHtml('inspector', step ? root.LWProcessInspector.step(view, step) : root.LWProcessInspector.overview(view, descOpen))) inspectorBound();
  get('edit-step').hidden = !step;
  setHtml('pools', root.LWProcessInspector.pools(view));
  setHtml('metrics', root.LWProcessInspector.kpis(view) + `<small class="metric-seed">Seed ${q.seed}</small>`);
  activity.ingest(view); get('latest').textContent = activity.latest();
  if (view.mode !== 'lens' && !present.isOpen()) flat = view.mode;
  get('canvas').hidden = view.mode !== '3d'; get('map').hidden = view.mode !== '2d'; get('lens').hidden = view.mode !== 'lens';
  for (const mode of ['2d', '3d', 'lens'] as const) get('mode-' + mode).setAttribute('aria-pressed', String(view.mode === mode));
  const lensButton = get('mode-lens'); if (lensButton.textContent !== terms.lensLabel) lensButton.textContent = terms.lensLabel;
  lensButton.title = terms.lensTitle; lensButton.setAttribute('aria-label', terms.lensTitle);
  get<HTMLButtonElement>('mode-3d').disabled = !!unavailable;
  const frame = view.mode === 'lens' ? `Scroll the ${terms.lensLabel} back to the start` : view.mode === '2d' ? 'Reset map view (0)' : 'Reset camera (F)';
  get('frame').title = frame;
  hints(selected);
  const visibleTokens = q.tokens.filter(t => !selected || t.stepId === selected).length;
  get('marker-count').textContent = view.mode === '3d' && visibleTokens > 120 ? `Showing 120 of ${visibleTokens} work markers` : '';
  if (io.open) dataView.draw(view);
  if (view.mode === '2d') svg.draw(view); else if (view.mode === 'lens') lens.draw(view);
  if (focusedStep) get('steps').querySelector<HTMLButtonElement>(`[data-step="${focusedStep}"]`)?.focus({preventScroll: true});
  if (focusedNext) {
   const next = get('inspector').querySelector<HTMLButtonElement>(`[data-next="${focusedNext}"]`);
   (next ?? get('steps').querySelector<HTMLButtonElement>(`[data-step="${view.selected}"]`))?.focus({preventScroll: true});
  }
  present.follow(view.selected);
 }
 /** Binds the controls of freshly written inspector markup and measures the description clamp once. */
 function inspectorBound(): void {
  get('inspector').querySelectorAll<HTMLButtonElement>('[data-next]').forEach(b => b.onclick = () => command(() => app.select(b.dataset.next!)));
  const more = document.getElementById('desc-more');
  if (more) more.onclick = () => {
   descOpen = !descOpen; get('process-desc').classList.toggle('open', descOpen); more.textContent = descOpen ? 'Less' : 'More';
   more.setAttribute('aria-expanded', String(descOpen)); get('inspector').dataset.html = root.LWProcessInspector.overview(view, descOpen); fitDescription();
  };
  fitDescription();
 }
 /** Touch screens get touch wording; keyboard and mouse hints only where a fine pointer exists. Lens views draw no work markers: the legend hides. */
 function hints(selected: string | null): void {
  const touch = matchMedia('(pointer: coarse)').matches, back = selected && !touch ? ' · Escape returns to the whole process' : '';
  const orbit = touch ? 'Drag to orbit · Tap a room to enter it · Frame view resets the camera'
   : 'Drag to orbit · Right-drag or Shift-drag to pan · Scroll to zoom · Arrows / WASD / + − / F' + back;
  const map = touch ? 'Drag to pan · Pinch or + − to zoom · Tap a scene to select it'
   : 'Drag to pan · Scroll or pinch to zoom · Arrows / + − / 0 · Select a scene on the map' + back;
  const pick = touch ? 'Tap a step to inspect it' : 'Select a step to inspect it · Escape clears the selection';
  const text = view.mode === '3d' ? orbit : view.mode === '2d' ? map : pick;
  if (get('camera-hint').textContent !== text) get('camera-hint').textContent = text;
  document.querySelector<HTMLElement>('.process-legend')!.dataset.view = view.mode;
 }
 /** The process description is clamped to three lines; the More button appears only when something is hidden. */
 function fitDescription(): void {
  const p = document.getElementById('process-desc'), more = document.getElementById('desc-more') as HTMLButtonElement | null;
  if (p && more) more.hidden = !descOpen && p.scrollHeight <= p.clientHeight + 1;
 }
 // Measured when the overview markup changes, on More, on the panel toggle and when the inspector is resized; after layout settles and outside
 // the observer callback, so toggling More never loops the observer.
 const fit = new ResizeObserver(() => {requestAnimationFrame(fitDescription);}); fit.observe(get('inspector'));
 function command(action: () => void): boolean {
  bar.commandStart();
  try {action(); refresh(); bar.commandEnd(true); return true;} catch (e) {bar.commandEnd(false); status(plain(e), true); return false;}
 }
 const on = (id: string, action: () => void) => {get(id).onclick = () => command(action);};
 get<HTMLSelectElement>('process-switch').onchange = () => {
  requestSwitch(Number(get<HTMLSelectElement>('process-switch').value)).catch(e => {syncSwitch(); status(plain(e), true);});
 };
 get('inspector-toggle').onclick = () => {
  const collapsed = document.querySelector('.process-inspector')!.classList.toggle('collapsed');
  get('inspector-toggle').setAttribute('aria-expanded', String(!collapsed)); fitDescription();
 };
 get('open-activity').onclick = () => {activity.open(get('open-activity'));};
 on('overview', () => app.select(null)); on('mode-2d', () => app.mode('2d')); on('mode-3d', () => app.mode('3d')); on('mode-lens', () => app.mode('lens'));
 // The visible way back from a step at every width; focus lands on the stage heading, which then names the whole process.
 get('back-overview').onclick = () => {if (command(() => app.select(null))) get('scene-title').focus({preventScroll: true});};
 // Escape on the 2D map or the 3D scene returns to the whole process (the lens handles its own Escape; Present and dialogs come first).
 get('viewport').addEventListener('keydown', e => {
  if (e.key !== 'Escape' || e.defaultPrevented || !view.selected || view.mode === 'lens' || present.isOpen() || root.LWProcessDialog.active()) return;
  e.preventDefault(); command(() => app.select(null));
 });
 on('frame', () => {if (view.mode === '2d') svg.frame(); else if (view.mode === 'lens') lens.frame(); else three?.frame();});
 /** The catalog's strict verdict for the draft text; the Definition editor lists every diagnostic itself. */
 function checkDraft(): LWProcess.Definition | undefined {
  try {const result = root.LWProcessCatalog.validate(JSON.parse(draft.read())); return result.ok ? result.definition : undefined;} catch {return undefined;}
 }
 function applyDraft(): boolean {
  const d = checkDraft();
  if (!d) {status('The draft is not a valid definition, so nothing was applied. Open the Definition editor to see why.', true); return false;}
  d.revision = Math.max(view.definition.revision + 1, d.revision);
  const note = replace(d); status('Definition applied. New run is paused.' + note); return true;
 }
 const run = () => ({minute: app.query().snapshot.minute, cases: app.query().snapshot.cases.length});
 /** The step editor is modal: it pauses the run (a command, never a tick), edits only the draft, and the inert page cannot change selection or time. */
 function openStepEditor(): void {
  const id = view.selected; if (!id) return;
  // An unparseable draft cannot be edited as a step: the Definition editor opens on the JSON syntax error instead.
  if (!draft.parse()) {definitionEditor.open({invoker: get('edit-step'), focus: 'json'}); return;}
  if (view.playing) command(() => app.play(false));
  if (stepEditor.open(id, get('edit-step'))) bar.status('Editing a step. The run is paused while the editor is open.', false, true);
 }
 stepEditor = root.LWProcessStepEditor.create(host, {
  draft, notify: status, run,
  apply: text => {draft.write(text, 'step-editor'); let ok = false; command(() => {ok = applyDraft();}); return ok;},
  focusFor: id => {
   const direct = get('edit-step');
   return !direct.hidden && direct.getClientRects().length ? direct : get('steps').querySelector<HTMLElement>(`[data-step="${id}"]`);
  },
  openDefinition: () => root.LWProcessDefinitionEditor.handoff(root.LWProcessDialog.active(), () => {
   definitionEditor.open({invoker: get('open-definition'), focus: 'problems'});
  }),
 });
 on('edit-step', () => openStepEditor());
 /** The Definition editor is modal: it pauses the run (a command, never a tick) and edits only the draft; Apply goes through the step editor's path. */
 definitionEditor = root.LWProcessDefinitionEditor.create(host, {
  draft, active: () => ({name: view.definition.name, revision: view.definition.revision}), run,
  pause: () => {if (view.playing) command(() => app.play(false));},
  apply: text => {draft.write(text, 'definition'); let ok = false; command(() => {ok = applyDraft();}); return ok;},
  download: text => {
   download(view.definition.id + '.draft.json', text, 'application/json'); status('Draft downloaded as written. Apply a valid draft to update the simulation.');
  },
  focusFor: () => get('open-definition'),
 });
 const openDefinition = (button: HTMLElement) => {
  if (definitionEditor.open({invoker: button, focus: 'auto'})) bar.status('Editing the definition. The run is paused while the editor is open.', false, true);
 };
 get('open-definition').onclick = () => openDefinition(get('open-definition')); get('draft-chip').onclick = () => openDefinition(get('draft-chip'));
 // Closing an editor (a modal dialog's close event, captured because it does not bubble) restores the run guidance.
 const dialogClosed = (e: Event) => {if ((e.target as Element).matches?.('dialog.pd-dialog') && !root.LWProcessDialog.active()) bar.editorClosed();};
 document.addEventListener('close', dialogClosed, true);
 /**
  * Present mode: the slide deck of the active definition over the studio's own 2D map. Entering pauses a playing run (a command, never a tick);
  * leaving restores the view mode and selection and never resumes.
  */
 type Before = {mode: LWProcessApp.ViewMode; flat: LWProcessApp.ViewMode; selected: string | null};
 let flat: LWProcessApp.ViewMode = '3d', before: Before = {mode: flat, flat, selected: null};
 const present = root.LWProcessPresent.create(document.body, {
  inertRoot: host, map: get('map'),
  enter: () => {
   const paused = view.playing; if (paused) command(() => app.play(false));
   before = {mode: view.mode, flat, selected: view.selected}; command(() => app.mode('2d'));
   status(paused ? 'Presenting slides. The run is paused while you present.' : 'Presenting slides.'); return {view, paused};
  },
  show: step => {command(() => app.select(step)); svg.frame();},
  leave: paused => {
   const b = before; command(() => {if (b.mode === 'lens') app.mode(b.flat); app.mode(b.mode); app.select(b.selected);}); if (view.mode === '2d') svg.frame();
   status(paused ? 'Presentation closed. The run stays paused; choose Run simulation to continue.' : 'Presentation closed.');
  },
 });
 const shown = (n: HTMLElement | null) => !!n && n.getClientRects().length > 0;
 const startPresent = (invoker: HTMLElement) => {
  if (!present.open(invoker, () => [get('mode-present'), get('more-menu')].find(shown) ?? null)) status('Close the open window first.', true);
 };
 get('mode-present').onclick = () => startPresent(get('mode-present'));
 get('present-item').onclick = () => {menu.close(false); startPresent(get('more-menu'));};
 function animate(time: number): void {
  if (disposed || suspended) return; const delta = Math.min(.1, (time - last) / 1000 || 0); last = time;
  if (view.playing) {
   elapsed += delta;
   // A pulse is the owned clock, not a user command: it never clears an error the user has not acted on yet.
   if (elapsed >= .35) {elapsed = 0; try {app.pulse(bar.speed()); refresh();} catch (e) {status(plain(e), true);}}
  } else elapsed = 0;
  if (view.mode === '3d') three?.draw(view, delta);
  frameId = requestAnimationFrame(animate);
 }
 function dispose(): void {
  if (disposed) return; disposed = true; cancelAnimationFrame(frameId); fit.disconnect(); document.removeEventListener('close', dialogClosed, true);
  for (const surface of [present, three, svg, lens, definitionEditor, stepEditor, files, activity, menu, app]) surface?.dispose();
 }
 // Business processes open on the readable 2D map on a phone; 3D stays one press away. A journey keeps its Journey map.
 if (matchMedia('(max-width:650px)').matches && app.query().mode === '3d') app.mode('2d');
 rebuild(); refresh(); if (unavailable) status(unavailable, true);
 root.LWProcessStudio = Object.freeze({
  query: () => ({...app.query(), presenting: present.state()}), definition: () => app.query().definition, definitions: () => app.definitions(),
 });
 root.__wildlandsReady = true;
 document.documentElement.dataset.wildlandsReady = 'process'; dispatchEvent(new CustomEvent('wildlands:ready', {detail: {host: 'process'}}));
 frameId = requestAnimationFrame(animate);
})(globalThis);
