/// <reference path="./process-contracts.d.ts" />
/**
 * Offline browser adapter and composition root of Process Studio: it creates the application controller, writes the shell markup
 * (LWProcessShellMarkup), refreshes the detached scene views after every command and wires the owned modules together:
 *  - LWProcessRunBar: the run bar and the status line; LWProcessStepList: the step list;
 *  - LWProcessSlots: the Process selector, switching (each process keeps its own paused run) and adding processes;
 *  - LWProcessIO: file import and export; LWProcessGuard: the questions outside editors and the page lifecycle;
 *  - LWProcessRecovery: the opt-in recovery copy of unapplied drafts in browser storage (the studio's only storage use);
 *  - the editors binding below (step editor and Definition editor over the shared LWProcessDraft), the Present binding and the
 *    Dashboard binding (LWProcessDashboard, the stage's 'dashboard' view mode).
 * UI code emits commands through `command()` and renders detached values; only the animation loop's pulse and explicit clock
 * commands move time.
 */
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWContentProvider: LWContentProvider.Api; LWProcessApplication: LWProcessApp.Api; LWProcessCatalog: LWProcess.Catalog;
  LWProcessData: LWProcessData.Api; LWProcess2D: LWProcess2D.Api; LWProcess3D: LWProcess3D.Api; LWProcessStepEditor: LWProcessStepEditor.Api;
  LWProcessDefinitionEditor: LWProcessDefinitionEditor.Api; LWProcessDialog: LWProcessDialog.Api; LWProcessDraft: LWProcessDraft.Api;
  LWProcessActivity: LWProcessActivity.Api; LWProcessInspector: LWProcessInspector.Api; LWProcessMenu: LWProcessMenu.Api; LWProcessTerms: LWProcessTerms.Api;
  LWProcessLens: LWProcessLens.Api; LWProcessPresent: LWProcessPresent.Api; LWProcessRunBar: LWProcessRunBar.Api; LWProcessIO: LWProcessIO.Api;
  LWProcessGuard: LWProcessGuard.Api; LWProcessStepList: LWProcessStepList.Api; LWProcessDom: LWProcessDom.Api; LWProcessSlots: LWProcessSlots.Api;
  LWProcessRecovery: LWProcessRecovery.Api; LWProcessShellMarkup: LWProcessShellMarkup.Api; LWProcessSlidesText: LWProcessSlidesText.Api;
  LWProcessDashboard: LWProcessDashboard.Api; LWProcessStudio?: unknown; __wildlandsReady?: boolean};
 const host = root.LWProcessDom.maybe('process-shell'); if (!host) return;
 const pristine = '<!doctype html>\n' + document.documentElement.outerHTML;
 const num = (n: number) => Number(n.toFixed(1)).toLocaleString();
 let app: LWProcessApp.Controller, profile: LWContentProvider.Profile;
 try {
  profile = root.LWContentProvider.get('process'); app = root.LWProcessApplication.create(profile.processes ?? profile.process);
 } catch (e) {host.textContent = 'Process could not load: ' + String(e); return;}
 host.innerHTML = root.LWProcessShellMarkup.markup({runBar: root.LWProcessRunBar.markup(), legend: root.LWProcess2D.legend()});
 const get = <T extends HTMLElement = HTMLElement>(id: string) => root.LWProcessDom.must<T>(id);
 const setHtml = (id: string, html: string): boolean => {
  const node = get(id); if (node.dataset.html === html) return false; node.dataset.html = html; node.innerHTML = html; return true;
 };
 const shown = (n: HTMLElement | null) => !!n && n.getClientRects().length > 0;
 let view = app.query(), three: LWProcess3D.Surface | null = null, stage: LWProcess3D.Stage | null = null;
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
 // The Inputs & outputs panel opens by default on wide screens only; a choice made by the user is remembered for the session (in
 // memory, never storage). The panel is drawn only while open; opening it draws the current view at once.
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
 const guard = root.LWProcessGuard.create({
  inertRoot: host, unsaved: () => draft.changed() || slots.unsaved(),
  suspend: () => {suspended = true; cancelAnimationFrame(frameId);},
  resume: () => {if (!suspended || disposed) return; suspended = false; last = 0; frameId = requestAnimationFrame(animate);},
  dispose: () => dispose(),
 });
 /** The running definition a recovery copy belongs to; set on every rebuild (apply, import, switch), never per keystroke. */
 let running: LWProcessRecovery.Target = {id: '', name: '', fingerprint: ''};
 const recovery = root.LWProcessRecovery.create({
  namespace: profile.storage?.namespace ?? '', draft, target: () => running, choose: options => guard.choose(options), status,
  digest: document.querySelector('meta[name="wildlands-game-digest"]')?.getAttribute('content') ?? '',
 });
 /** The toolbar chip names the unapplied draft ("Unapplied draft · 3 steps, 1 resource changed") and opens the Definition editor; hidden when clean. */
 function draftChip(): void {
  const chip = get('draft-chip'), text = draft.changed() ? draft.describeDiff().replace(': ', ' · ') : '';
  chip.hidden = !text; if (chip.textContent !== text) chip.textContent = text;
  chip.title = text ? 'Open the Definition editor to review, apply or restore this draft. Export JSON and Download HTML use the running definition.' : '';
 }
 function rebuild(): void {
  three?.dispose(); three = null; unavailable = ''; dataView.reset(); activity.reset(); lens.reset(); dashboard.reset();
  // One WebGL renderer and canvas serve the page's lifetime; a rebuild replaces only the 3D scene.
  try {
   stage ??= root.LWProcess3D.stage(get<HTMLCanvasElement>('canvas'));
   three = root.LWProcess3D.create(stage, app.query().definition, id => command(() => app.select(id)));
  } catch {
   unavailable = '3D unavailable in this browser. The complete simulation is available in 2D.';
   if (app.query().mode === '3d') app.mode('2d');
   status(unavailable, true);
  }
  const now = app.query();
  running = {id: now.definition.id, name: now.definition.name, fingerprint: root.LWProcessCatalog.fingerprint(now.definition)};
  draft.enter(now.active, now.definition);
 }
 /** Replaces the running definition (a fresh paused run) and says what carried over: the run seed and the selected step of the same process. */
 function replace(definition: unknown): string {
  const before = view, seed = before.snapshot.seed, override = seed !== (before.definition.seed ?? 1), left = running;
  app.replace(definition); rebuild(); refresh();
  // The draft of the replaced definition was applied or discarded on purpose, so its recovery copy goes too.
  recovery.forget(left);
  const notes: string[] = [], same = view.definition.id === before.definition.id;
  const dropped = `Run seed ${seed} dropped; this run uses the definition seed ${view.snapshot.seed}.`;
  if (override) notes.push(view.snapshot.seed === seed ? `Run seed ${seed} kept.` : dropped);
  const gone = same && before.selected && !view.selected ? before.definition.steps.find(s => s.id === before.selected)?.name : undefined;
  if (gone) notes.push(`${gone} no longer exists, so the whole process is shown.`);
  return notes.length ? ' ' + notes.join(' ') : '';
 }
 const slots = root.LWProcessSlots.create({
  app, host, view: () => view, draft, recovery, status, changed: () => files.sync(),
  reopen: () => {dataView.reset(); svg.dispose(); svg = newMap(); rebuild(); refresh();},
 });
 const files = root.LWProcessIO.create({
  host, view: () => view, definitions: () => app.definitions(), pristine, draft, status, download, replace,
  add: definition => slots.add(definition), canAdd: () => slots.canAdd(), ask: options => guard.ask(options), choose: options => guard.choose(options),
 });
 draft.subscribe(() => {draftChip(); files.sync();});
 /** The selected step's subtitle: its kind in plain words and its phase when it has one; the whole process counts steps and cases. */
 function subtitle(d: LWProcess.Definition, step: LWProcess.Step | undefined, q: LWProcess.Snapshot, terms: LWProcessTerms.Terms): string {
  if (step) return root.LWProcessSlidesText.kindLabel(step) + (step.phase ? ' · ' + step.phase : '');
  const steps = `${d.steps.length} ${d.steps.length === 1 ? 'step' : 'steps'}`;
  return `${steps} · ${num(q.metrics.arrived)} ${q.metrics.arrived === 1 ? terms.one : terms.many} admitted`;
 }
 function refresh(): void {
  const focused = document.activeElement as HTMLElement | null, focusedStep = focused?.closest('#steps') ? focused.dataset.step : undefined;
  const focusedNext = focused?.dataset.next;
  view = app.query();
  const {definition: d, snapshot: q, selected} = view, step = d.steps.find(s => s.id === selected), terms = root.LWProcessTerms.of(d);
  get('steps-heading').textContent = terms.stepsHeading;
  get('process-title').textContent = d.name; get('process-title').title = d.name; slots.sync();
  get('step-count').textContent = String(d.steps.length);
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
  get('scene-subtitle').textContent = subtitle(d, step, q, terms);
  get('inspector-title').textContent = step ? 'Scene details' : 'Process overview';
  if (setHtml('inspector', step ? root.LWProcessInspector.step(view, step) : root.LWProcessInspector.overview(view, descOpen))) inspectorBound();
  get('edit-step').hidden = !step;
  setHtml('pools', root.LWProcessInspector.pools(view));
  setHtml('metrics', root.LWProcessInspector.kpis(view));
  activity.ingest(view); get('latest').textContent = activity.latest();
  if ((view.mode === '2d' || view.mode === '3d') && !present.isOpen()) flat = view.mode;
  get('canvas').hidden = view.mode !== '3d'; get('map').hidden = view.mode !== '2d'; get('lens').hidden = view.mode !== 'lens';
  get('dashboard').hidden = view.mode !== 'dashboard';
  for (const mode of ['2d', '3d', 'lens', 'dashboard'] as const) get('mode-' + mode).setAttribute('aria-pressed', String(view.mode === mode));
  const lensButton = get('mode-lens'); if (lensButton.textContent !== terms.lensLabel) lensButton.textContent = terms.lensLabel;
  lensButton.title = terms.lensTitle; lensButton.setAttribute('aria-label', terms.lensTitle);
  get<HTMLButtonElement>('mode-3d').disabled = !!unavailable;
  const lensFit = `Scroll the ${terms.lensLabel} back to the start`;
  const frameTitle = view.mode === 'dashboard' ? 'Scroll the dashboard back to its top' : view.mode === '2d' ? 'Fit the map to the view (0)' : 'Reset camera (F)';
  get('frame').title = view.mode === 'lens' ? lensFit : frameTitle;
  hints(selected);
  const visibleTokens = q.tokens.filter(t => !selected || t.stepId === selected).length;
  get('marker-count').textContent = view.mode === '3d' && visibleTokens > 120 ? `Showing 120 of ${visibleTokens} work markers` : '';
  if (io.open) dataView.draw(view);
  if (view.mode === '2d') svg.draw(view); else if (view.mode === 'lens') lens.draw(view); else if (view.mode === 'dashboard') dashboard.draw(view);
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
  const more = root.LWProcessDom.maybe('desc-more');
  if (more) more.onclick = () => {
   descOpen = !descOpen; get('process-desc').classList.toggle('open', descOpen); more.textContent = descOpen ? 'Less' : 'More';
   more.setAttribute('aria-expanded', String(descOpen));
   get('inspector').dataset.html = root.LWProcessInspector.overview(view, descOpen); fitDescription();
  };
  fitDescription();
 }
 /** Touch screens get touch wording; keyboard and mouse hints only where a fine pointer exists. Lens views draw no work markers: the legend hides. */
 function hints(selected: string | null): void {
  const touch = matchMedia('(pointer: coarse)').matches, back = selected && !touch ? ' · Escape returns to the whole process' : '';
  const orbit = touch ? 'Drag to orbit · Tap a room to enter it · Fit to view resets the camera'
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
  const p = root.LWProcessDom.maybe('process-desc'), more = root.LWProcessDom.maybe<HTMLButtonElement>('desc-more');
  if (p && more) more.hidden = !descOpen && p.scrollHeight <= p.clientHeight + 1;
 }
 // Measured when the overview markup changes, on More, on the panel toggle and when the inspector is resized; after layout settles and
 // outside the observer callback, so toggling More never loops the observer.
 const fit = new ResizeObserver(() => {requestAnimationFrame(fitDescription);}); fit.observe(get('inspector'));
 function command(action: () => void): boolean {
  bar.commandStart();
  try {action(); refresh(); bar.commandEnd(true); return true;} catch (e) {bar.commandEnd(false); status(plain(e), true); return false;}
 }
 const on = (id: string, action: () => void) => {get(id).onclick = () => command(action);};
 get('inspector-toggle').onclick = () => {
  const collapsed = document.querySelector('.process-inspector')!.classList.toggle('collapsed');
  get('inspector-toggle').setAttribute('aria-expanded', String(!collapsed)); fitDescription();
 };
 get('open-activity').onclick = () => {activity.open(get('open-activity'));};
 on('overview', () => app.select(null));
 on('mode-2d', () => app.mode('2d')); on('mode-3d', () => app.mode('3d')); on('mode-lens', () => app.mode('lens'));
 // The visible way back from a step at every width; focus lands on the stage heading, which then names the whole process.
 get('back-overview').onclick = () => {if (command(() => app.select(null))) get('scene-title').focus({preventScroll: true});};
 // Escape on the 2D map or the 3D scene returns to the whole process (the lens handles its own Escape; Present and dialogs come first).
 get('viewport').addEventListener('keydown', e => {
  if (e.key !== 'Escape' || e.defaultPrevented || !view.selected || view.mode === 'lens' || present.isOpen() || root.LWProcessDialog.active()) return;
  e.preventDefault(); command(() => app.select(null));
 });
 // Fit to view: the 2D map fits the whole process, the lens scrolls back to its start and the 3D camera returns to its frame.
 on('frame', () => {if (view.mode === '2d') svg.frame(); else if (view.mode === 'lens') lens.frame(); else if (view.mode === 'dashboard') dashboard.frame(); else three?.frame();});
 // ---- Dashboard binding (Package DB-UI): the per-process Dashboard view. It draws detached views only, holds no session, never
 // ticks; choosing a step is the same select command as on the map. The read-model reads (series, distributions, recent) are wired
 // here once the session offers them. ----
 const dashboard = root.LWProcessDashboard.create(get('dashboard'), {
  onSelect: id => {command(() => app.select(id));}, save: (name, data, type) => download(name, data, type), status: message => status(message),
  draft: () => ({text: draft.read(), changed: draft.changed() && !draft.same()}),
  validate: text => {try {const r = root.LWProcessCatalog.validate(JSON.parse(text)); return r.ok ? r.definition ?? null : null;} catch {return null;}},
  showLens: () => {command(() => app.mode('lens'));},
 });
 on('mode-dashboard', () => app.mode('dashboard'));
 get('dashboard-item').onclick = () => {menu.close(false); if (command(() => app.mode('dashboard'))) dashboard.focus();};
 // ---- end Dashboard binding ----
 // ---- Editors binding: the step editor and the Definition editor over the shared draft; Apply goes through `applyDraft`. ----
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
  openDefinition: back => root.LWProcessDefinitionEditor.handoff(root.LWProcessDialog.active(), () => {
   definitionEditor.open({invoker: get('open-definition'), focus: 'problems', back});
  }),
  exportReport: () => get('report').click(),
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
  exportReport: () => get('report').click(),
 });
 const openDefinition = (button: HTMLElement) => {
  if (definitionEditor.open({invoker: button, focus: 'auto'})) bar.status('Editing the definition. The run is paused while the editor is open.', false, true);
 };
 get('open-definition').onclick = () => openDefinition(get('open-definition')); get('draft-chip').onclick = () => openDefinition(get('draft-chip'));
 // Closing an editor (a modal dialog's close event, captured because it does not bubble) restores the run guidance.
 const dialogClosed = (e: Event) => {if ((e.target as Element).matches?.('dialog.pd-dialog') && !root.LWProcessDialog.active()) bar.editorClosed();};
 document.addEventListener('close', dialogClosed, true);
 // ---- Present binding ----
 /**
  * Present mode: the slide deck of the active definition over the studio's own 2D map. Entering pauses a playing run (a command, never
  * a tick); leaving restores the view mode and selection and never resumes.
  */
 type Before = {mode: LWProcessApp.ViewMode; flat: LWProcessApp.ViewMode; selected: string | null};
 let flat: LWProcessApp.ViewMode = '3d', before: Before = {mode: flat, flat, selected: null};
 const present = root.LWProcessPresent.create(document.body, {
  inertRoot: host, map: get('map'),
  enter: () => {
   const paused = view.playing; if (paused) command(() => app.play(false));
   before = {mode: view.mode, flat, selected: view.selected}; command(() => app.mode('2d'));
   status(paused ? 'Presenting slides. The run is paused while you present.' : 'Presenting slides.'); return {view, paused, draft: draft.changed()};
  },
  show: step => {command(() => app.select(step)); svg.frame({neighbours: true});},
  leave: paused => {
   const b = before; command(() => {if (b.mode === 'lens' || b.mode === 'dashboard') app.mode(b.flat); app.mode(b.mode); app.select(b.selected);}); svg.frame();
   status(paused ? 'Presentation closed. The run stays paused; choose Run simulation to continue.' : 'Presentation closed.');
  },
 });
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
  recovery.dispose();
  for (const surface of [present, three, stage, svg, lens, dashboard, definitionEditor, stepEditor, files, slots, activity, menu, app]) surface?.dispose();
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
 // A draft this browser kept for the opening process is offered once the studio is ready (never applied by itself).
 void recovery.offer(null, () => [get('draft-chip'), get('open-definition'), get('more-menu')].find(shown) ?? null);
})(globalThis);
