/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-dom.ts" />
/**
 * The run bar of Process Studio (Run, Step, Advance, Run to end, Reset, speed, run length, seed, clock) and the studio's one status line.
 *
 * Every control emits an application command through `env.command`; nothing here ticks, retains or mutates a session. The bar is
 * re-synchronised from each detached view after a refresh:
 *  - once the run stops (completed, limit or blocked) Run, Step, Advance and Run to end are disabled with their reason, Reset becomes
 *    the primary action (it stays visible on a phone, outside Run options) and takes focus from a control that was just disabled;
 *  - Advance names the minutes it will really advance near the run length; the clock keeps exact minutes and adds an hours gloss;
 *  - with a display calendar on the definition (`calendar: {minutesPerDay, daysPerWeek}`) the gloss reads in business days or weeks
 *    from one business day up (`LWProcessTime.span`: "≈ 4.2 business days"), and the Run until presets and the run-length sentence
 *    add the same reading ("Until: 1,440 min (3 business days)"). Below one business day, and without a calendar, every string is
 *    the plain one (hours gloss, "Until: 24 h (1,440 min)");
 *  - Run to end (`#run-end`, inside Run options on a phone) is one clock command, `app.runToEnd()`: it pauses a playing run first (like
 *    Step and Advance), advances without animation and refreshes once, then says "Ran to minute M: <status in plain words>.". It is
 *    disabled with its reason when the run has no run length ("Set a run length to run to the end.") or has stopped.
 *
 * Status line rules: a message is a note, an error, an editor notice or the run guidance. A note or editor notice gives way to
 * the guidance on the next state change (play or pause, a new run status, another process or revision, or a new minute while
 * paused); an error stays until the next successful command; an editor notice also gives way when the editor closes. The
 * guidance never names the minute, so the polite live region does not speak on every tick.
 */
declare namespace LWProcessRunBar {
 interface Env {
  app: LWProcessApp.Controller;
  /** The latest detached view (refreshed after every command). */
  view(): LWProcessApp.View;
  /** Runs an application command and refreshes; false when it was refused (the error is already shown). */
  command(action: () => void): boolean;
  /** Forgets per-run view state (the Inputs & outputs choice and the activity feed) after a fresh run started. */
  fresh(): void;
  /** A notice appended to every message, e.g. that 3D is unavailable; '' for none. */
  notice(): string;
 }
 interface Surface {
  /** Re-synchronises the controls and the status line from a refreshed view; `focused` is the element focused before the refresh. */
  sync(view: LWProcessApp.View, focused: HTMLElement | null): void;
  /** Writes the status line. `editor` marks a notice that lasts while an editor is open. */
  status(message: string, error?: boolean, editor?: boolean): void;
  /** Brackets a user command: an error on screen gives way to the guidance when the command succeeds without a message of its own. */
  commandStart(): void;
  commandEnd(ok: boolean): void;
  /** An editor or other dialog closed: an editor notice gives way to the guidance. */
  editorClosed(): void;
  /** Simulated minutes per tick while the run plays. */
  speed(): number;
 }
 interface Api {
  create(env: Env): Surface;
  /** The toolbar markup the studio shell places once. */
  markup(): string;
  /** Plain wording of an error: the message without a leading 'Error: ' or 'SyntaxError: ' label. */
  plain(error: unknown): string;
  /** The run status in plain words for a sentence: 'the run completed', 'the run length is reached', 'no work can advance (blocked)'. */
  outcome(snapshot: LWProcess.Snapshot): string;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessRunBar?: LWProcessRunBar.Api; LWProcessDom: LWProcessDom.Api; LWProcessTime: LWProcessTime.Api};
 const num = (n: number) => Number(n.toFixed(1)).toLocaleString();
 const get = <T extends HTMLElement = HTMLElement>(id: string) => root.LWProcessDom.must<T>(id);
 const plain = (error: unknown) => (error instanceof Error ? error.message : String(error)).replace(/^(\w*Error: )+/, '').trim();
 /** Preset run lengths in minutes with an hours reading; a working day is never implied. */
 const PRESETS: [number, string][] = [
  [1440, '24 h (1,440 min)'], [10080, '168 h (10,080 min)'], [43200, '720 h (43,200 min)'], [100000, '100,000 min (≈1,667 h)'],
 ];
 const SPEEDS: [number, string][] = [[1, '1 min'], [5, '5 min'], [30, '30 min'], [120, '2 h'], [1440, '24 h']];
 const STEP = 30;
 const NO_LENGTH = 'Set a run length to run to the end.';
 /** The business day or week reading of `minutes` under a display calendar ('≈ 4.2 business days'); '' below one business day or without one. */
 function business(minutes: number, calendar: LWProcess.Calendar | undefined): string {
  const time = root.LWProcessTime, span = time.span(minutes, calendar);
  return span === time.minutes(minutes) ? '' : span.slice(span.indexOf('(') + 1, -1);
 }
 /** A preset's Run until label: the plain label, or the business reading when the calendar has one for it. */
 const presetLabel = (minutes: number, plainLabel: string, calendar: LWProcess.Calendar | undefined) =>
  'Until: ' + (business(minutes, calendar) ? root.LWProcessTime.span(minutes, calendar) : plainLabel);
 function outcome(q: LWProcess.Snapshot): string {
  if (q.status === 'completed') return 'the run completed';
  if (q.status === 'limit') return 'the run length is reached';
  if (q.status === 'blocked') return 'no work can advance (blocked)';
  return 'paused at the 100,000-minute limit of one command; choose Run to end again to continue';
 }
 function markup(): string {
  const speeds = SPEEDS.map(([v, label]) => `<option value="${v}"${v === 5 ? ' selected' : ''}>Speed: ${label}</option>`).join('');
  const presets = PRESETS.map(([v, label]) => `<option value="${v}">${presetLabel(v, label, undefined)}</option>`).join('');
  return `<div class="process-toolbar" role="group" aria-label="Simulation controls">
  <div class="run-actions" role="group" aria-label="Run"><button id="play" class="primary">Run simulation</button><button id="step">Step 1 min</button>
   <button id="advance">Advance ${STEP} min</button><button id="run-end">Run to end</button>
   <button id="reset" class="ghost">Reset run</button></div>
  <button id="run-options-toggle" class="options-toggle" aria-expanded="false" aria-controls="run-config">`
   + `Run options <span aria-hidden="true">▾</span></button>
  <div id="run-config" class="run-config" role="group" aria-label="Run settings">
   <select id="speed" aria-label="Speed" title="Simulated time advanced on each tick while the run plays">${speeds}</select>
   <select id="horizon" aria-label="Run until" title="When the run stops">${presets}
    <option value="unlimited">Until: no limit</option><option value="custom">Until: custom…</option></select>
   <label id="horizon-custom-label" class="run-custom" hidden><input id="horizon-custom" type="number" min="1" step="1" inputmode="numeric"
    aria-label="Custom run length in minutes"> min</label>
   <label class="run-seed" title="Random draws are a pure function of the seed. Changing it starts a fresh paused run.">Seed
    <input id="seed" type="number" min="0" max="2147483647" step="1" inputmode="numeric"></label></div>
  <div class="run-status" role="group" aria-label="Run status">
   <button id="open-activity" aria-haspopup="dialog" aria-label="Activity">Activity<span id="activity-count" class="act-count" aria-hidden="true" hidden></span>
   </button>
   <div class="run-readout"><output id="clock" class="process-clock" aria-live="off"></output>
    <span class="run-sub"><span id="clock-hours" class="clock-gloss"></span><span id="run-status"></span></span></div>
  </div></div>`;
 }
 function create(env: LWProcessRunBar.Env): LWProcessRunBar.Surface {
  type Kind = 'guide' | 'note' | 'error' | 'editor';
  let kind: Kind = 'guide', stamp = '', pending = false, inCommand = 0, written = 0, previousStatus = '';
  const presets = new Set(PRESETS.map(([v]) => String(v)));
  /** What a note outlives: minutes advanced by a playing run do not count, so a message written while it plays stays until it pauses or stops. */
  const keyOf = (v: LWProcessApp.View) => [v.playing, v.snapshot.status, v.active, v.definition.id, v.definition.revision, v.playing ? '' : v.snapshot.minute]
   .join('|');
  const stoppedText = (status: string) => status === 'completed' ? 'Run completed. Export the report or reset to run again.'
   : status === 'limit' ? 'Run limit reached. Export the report or reset the run.'
   : status === 'blocked' ? 'No work can advance. Inspect waiting steps and resources, or reset the run.' : '';
  function guidance(v: LWProcessApp.View): string {
   const stopped = stoppedText(v.snapshot.status);
   if (stopped) return stopped;
   if (v.playing) return 'Run started. Pause, step or choose a scene to inspect its work.';
   if (v.snapshot.minute > 0) return 'Paused. Run, step or reset the run, or choose a scene to inspect its work.';
   return 'Ready. Run the simulation, or choose a scene to inspect its work.';
  }
  function write(message: string, error: boolean): void {
   const node = get('message'), notice = env.notice(), text = message + (notice && message !== notice ? ' ' + notice : '');
   if (node.textContent !== text) node.textContent = text;
   node.classList.toggle('error', error || !!notice); node.setAttribute('aria-live', error ? 'assertive' : 'polite');
  }
  function status(message: string, error = false, editor = false): void {
   kind = error ? 'error' : editor ? 'editor' : 'note'; written++; write(message, error);
   // Inside a command the view is refreshed after the action, so the state the message belongs to is read at that refresh.
   if (inCommand) pending = true; else stamp = keyOf(env.view());
  }
  function guide(v: LWProcessApp.View): void { kind = 'guide'; stamp = keyOf(v); write(guidance(v), false); }
  let before = 0;
  const commandStart = () => { inCommand++; if (inCommand === 1) before = written; };
  function commandEnd(ok: boolean): void {
   inCommand = Math.max(0, inCommand - 1); if (inCommand) return;
   if (pending) { pending = false; stamp = keyOf(env.view()); }
   if (ok && kind === 'error' && written === before) guide(env.view());
  }
  function syncHorizon(horizon: number | null): void {
   const select = get<HTMLSelectElement>('horizon'), custom = get<HTMLInputElement>('horizon-custom');
   if (document.activeElement === custom || document.activeElement === select && select.value === 'custom') return;
   select.value = horizon === null ? 'unlimited' : presets.has(String(horizon)) ? String(horizon) : 'custom';
   get('horizon-custom-label').hidden = select.value !== 'custom'; if (horizon !== null && select.value === 'custom') custom.value = String(horizon);
  }
  /** Rewrites the Run until preset labels when the display calendar of the shown process changes the words. */
  let presetWords = PRESETS.map(([v, label]) => presetLabel(v, label, undefined)).join('|');
  function syncPresets(calendar: LWProcess.Calendar | undefined): void {
   const labels = PRESETS.map(([v, label]) => presetLabel(v, label, calendar)), words = labels.join('|');
   if (words === presetWords) return;
   presetWords = words;
   const options = [...get<HTMLSelectElement>('horizon').options];
   PRESETS.forEach(([v], i) => { options.find(o => o.value === String(v))!.textContent = labels[i]!; });
  }
  /** "Run length set to 1,440 minutes (24 h)." with the business reading added under a display calendar. */
  function lengthSet(n: number): string {
   const gloss = [n >= 60 ? num(n / 60) + ' h' : '', business(n, env.view().definition.calendar)].filter(Boolean).join(', ');
   return `Run length set to ${num(n)} minutes${gloss ? ` (${gloss})` : ''}.`;
  }
  /** Minutes the Advance button moves: 30, or what is left before the run length. */
  const stride = (v: LWProcessApp.View) => Math.max(1, Math.min(STEP, v.horizon === null ? STEP : v.horizon - v.snapshot.minute));
  function sync(v: LWProcessApp.View, focused: HTMLElement | null): void {
   const q = v.snapshot, stopped = stoppedText(q.status), bar = document.querySelector('.process-toolbar')!;
   get('clock').textContent = num(q.minute) + ' min' + (v.horizon === null ? ' · no limit' : ' of ' + num(v.horizon));
   const days = business(q.minute, v.definition.calendar), hours = days || (q.minute >= 60 ? num(q.minute / 60) + ' h' : '');
   const gloss = get('clock-hours'); if (gloss.textContent !== hours) gloss.textContent = hours;
   syncPresets(v.definition.calendar); syncHorizon(v.horizon);
   const state = q.status === 'completed' ? 'Completed' : q.status === 'limit' ? 'Run limit reached' : q.status === 'blocked' ? 'Blocked' : 'Paused';
   get('run-status').textContent = v.playing ? 'Running' : state;
   get('play').textContent = v.playing ? 'Pause' : 'Run simulation';
   const advance = `Advance ${stopped ? STEP : stride(v)} min`; if (get('advance').textContent !== advance) get('advance').textContent = advance;
   let refocus = false;
   const toEnd = stopped || (v.horizon === null ? NO_LENGTH : '');
   const reasons: [string, string][] = [['play', stopped], ['step', stopped], ['advance', stopped], ['run-end', toEnd]];
   for (const [id, reason] of reasons) {
    const control = get<HTMLButtonElement>(id); if (reason && !control.disabled && focused === control) refocus = true;
    control.disabled = !!reason; control.title = reason;
   }
   // A stopped run's next step is Reset: it takes the primary emphasis, and on a phone it stays outside Run options.
   bar.classList.toggle('run-stopped', !!stopped); get('play').classList.toggle('primary', !stopped);
   get('reset').classList.toggle('primary', !!stopped); get('reset').classList.toggle('ghost', !stopped);
   if (refocus) get(stopped ? 'reset' : 'advance').focus({preventScroll: true});
   // On a phone Reset folds back under Run options once the run restarts: Run takes the focus it would otherwise lose.
   else if (!stopped && focused === get('reset') && !get('reset').getClientRects().length) get('play').focus({preventScroll: true});
   const seedField = get<HTMLInputElement>('seed');
   if (document.activeElement !== seedField && seedField.value !== String(q.seed)) seedField.value = String(q.seed);
   if (pending && inCommand) { stamp = keyOf(v); pending = false; }
   if (stopped && previousStatus !== q.status) { kind = 'note'; stamp = keyOf(v); write(stopped, false); }
   else if (kind !== 'error' && !pending && keyOf(v) !== stamp) guide(v);
   previousStatus = q.status;
  }
  /** Names the simulated time after a manual clock command unless the run just stopped (sync already explains that). */
  const announce = () => {
   const v = env.view(); if (!v.playing && !stoppedText(v.snapshot.status)) status('Advanced to minute ' + num(v.snapshot.minute) + '.');
  };
  const on = (id: string, action: () => void) => { get(id).onclick = () => { env.command(action); }; };
  on('play', () => env.app.play(!env.view().playing));
  get('step').onclick = () => { if (env.command(() => { env.app.play(false); env.app.advance(1); })) announce(); };
  get('advance').onclick = () => { if (env.command(() => { env.app.play(false); env.app.advance(stride(env.view())); })) announce(); };
  // One command and one refresh, however many minutes it covers; the sentence replaces the stopped-run note sync wrote.
  get('run-end').onclick = () => {
   if (env.command(() => { env.app.runToEnd(); })) {
    const q = env.view().snapshot; status(`Ran to minute ${num(q.minute)}: ${outcome(q)}.`);
   }
  };
  on('reset', () => { env.app.reset(); env.fresh(); status('Run reset. Definition retained.'); });
  /** A new seed starts a fresh paused run exactly like a reset (the engine validates the range and keeps the old run when it refuses). */
  get<HTMLInputElement>('seed').onchange = () => {
   const field = get<HTMLInputElement>('seed'), n = Number(field.value), seed = env.view().snapshot.seed;
   if (field.value.trim() === '' || !Number.isInteger(n) || n < 0 || n > 2147483647) {
    status('Seed must be a whole number from 0 to 2,147,483,647.', true); field.value = String(seed); return;
   }
   if (n === seed) return;
   if (env.command(() => env.app.seed(n))) { env.fresh(); status(`Seed ${n} · fresh paused run`); } else field.value = String(env.view().snapshot.seed);
  };
  get('run-options-toggle').onclick = () => {
   const open = document.querySelector('.process-toolbar')!.classList.toggle('options-open');
   get('run-options-toggle').setAttribute('aria-expanded', String(open));
  };
  function applyHorizon(): void {
   const select = get<HTMLSelectElement>('horizon'), custom = get<HTMLInputElement>('horizon-custom');
   get('horizon-custom-label').hidden = select.value !== 'custom';
   if (select.value === 'custom') {
    if (!custom.value) { custom.focus(); status('Enter a whole number of minutes for the custom run length.'); return; }
    const n = Number(custom.value);
    if (env.command(() => env.app.horizon(n))) status(lengthSet(n));
    return;
   }
   const value = select.value === 'unlimited' ? null : Number(select.value);
   if (!env.command(() => env.app.horizon(value))) return;
   if (value === null) status('Unlimited run length. The run still stops when all work is complete or blocked.');
   else status(lengthSet(value));
  }
  get<HTMLSelectElement>('horizon').onchange = applyHorizon; get<HTMLInputElement>('horizon-custom').onchange = applyHorizon;
  return {
   sync, status, commandStart, commandEnd,
   editorClosed() { if (kind === 'editor') guide(env.view()); },
   speed: () => Number(get<HTMLSelectElement>('speed').value),
  };
 }
 root.LWProcessRunBar = {create, markup, plain, outcome};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessRunBar;
})(globalThis);
