/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-replicate.ts" />
/// <reference path="./process-dashboard-whatif.ts" />
/**
 * The What-if section of the Dashboard (LWProcessDashboardWhatIfView): its form, the replication runner and its results. It runs
 * LWProcessReplicate on detached definitions only (the applied one from the view, and the validated draft for a comparison), so it
 * never touches the live run: every replication opens and disposes its own session. The work runs in slices between animation
 * frames with a time budget of about 12 ms (`advance(budget)` when the runner offers it, else one `step()` replication per frame),
 * never in a busy loop; progress shows in a progress bar and a polite status at most every 2 seconds, then "Replications complete".
 * Cancel stops after the current slice and keeps the partial results. `reset()` (process switch, apply, import) and `dispose()`
 * cancel a run and drop its results; a draft, definition or run-seed change after a run marks its results out of date.
 * Inputs are bounded (LWProcessDashboardWhatIf) and the Start button names why it is disabled. Nothing is written to storage.
 */
declare namespace LWProcessDashboardWhatIfView {
 interface Env {
  /** The unapplied draft text and whether it differs from the running definition (cheap; called on every sync). */
  draft(): {text: string; changed: boolean};
  /** The draft as a strictly valid definition, or null. Called once per distinct draft text. */
  validate(text: string): LWProcess.Definition | null;
 }
 interface Surface {
  readonly element: HTMLElement;
  sync(view: LWProcessApp.View, width: number, rem: number): void;
  running(): boolean;
  cancel(): void;
  reset(): void;
  /** The latest results as a table for the CSV export, or null. */
  table(): LWProcessDashboardModel.Table | null;
  dispose(): void;
 }
 interface Api {create(env: Env): Surface}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessReplicate: LWProcessReplicate.Api; LWProcessCatalog: LWProcess.Catalog;
  LWProcessDashboardWhatIf: LWProcessDashboardWhatIf.Api; LWProcessDashboardWhatIfView?: LWProcessDashboardWhatIfView.Api};
 type Inputs = LWProcessDashboardWhatIf.Inputs;
 type Mode = LWProcessDashboardWhatIf.Mode;
 type Report = LWProcessReplicate.Report | LWProcessReplicate.Comparison;
 /** A replication runner; `advance(budget)` and `dispose()` are optional additions of a sliced runner. */
 type Runner = LWProcessReplicate.Runner<Report> & {advance?(budget: number): boolean; dispose?(): void};
 /** What a result was computed from: the applied fingerprint, the draft fingerprint (comparisons) and the run seed. */
 interface Key {a: string; b: string | null; seed: number}
 interface Draft {changed: boolean; valid: boolean; definition: LWProcess.Definition | null; fingerprint: string}
 const SLICE_MS = 12, BUDGET = 1440, ANNOUNCE_MS = 2000;
 const STALE = '<p class="db-note db-stale" data-stale hidden>These results are out of date: the definition, the draft or the run seed changed since they ran. '
  + 'Run again to update them.</p>';
 const FORM = `<h2 id="db-s-whatif">What-if: spread across seeds</h2>
 <p class="db-question">How much do these numbers vary across seeds? Does the draft change them compared with the applied design?</p>
 <form class="db-form" novalidate><fieldset><legend>What to run</legend>
  <label><input type="radio" name="db-mode" value="spread" checked> Spread of the applied design</label>
  <label><input type="radio" name="db-mode" value="compare" aria-describedby="db-compare-why"> Applied design versus draft</label>
  <p id="db-compare-why" class="db-why"></p></fieldset>
  <div class="db-fields"><label>Runs <input id="db-runs" type="number" step="1" inputmode="numeric"></label>
  <label>Minutes per run <input id="db-minutes" type="number" step="1" inputmode="numeric"></label>
  <label>First seed <input id="db-seed" type="number" step="1" inputmode="numeric"></label></div>
  <p id="db-plan" class="db-plan"></p><p id="db-problems" class="db-why"></p>
  <div class="db-actions"><button type="submit" id="db-start" class="primary">Run seeds</button><button type="button" id="db-cancel" hidden>Cancel</button>
  <progress id="db-progress-bar" max="1" value="0" hidden></progress></div></form>
 <p id="db-progress" class="db-status" role="status" aria-live="polite"></p><div id="db-results"></div>`;
 function create(env: LWProcessDashboardWhatIfView.Env): LWProcessDashboardWhatIfView.Surface {
  const W = root.LWProcessDashboardWhatIf, el = document.createElement('section');
  el.className = 'db-section db-whatif';
  el.setAttribute('aria-labelledby', 'db-s-whatif');
  el.innerHTML = FORM;
  const $ = <T extends HTMLElement>(sel: string) => el.querySelector<T>(sel)!;
  const form = $<HTMLFormElement>('form'), runs = $<HTMLInputElement>('#db-runs'), minutes = $<HTMLInputElement>('#db-minutes');
  const seed = $<HTMLInputElement>('#db-seed'), start = $<HTMLButtonElement>('#db-start'), cancel = $<HTMLButtonElement>('#db-cancel');
  const live = $('#db-progress'), bar = $<HTMLProgressElement>('#db-progress-bar'), results = $('#db-results');
  const spread = $<HTMLInputElement>('input[value=spread]'), compare = $<HTMLInputElement>('input[value=compare]');
  let view: LWProcessApp.View | null = null, width = 600, rem = 16, dirty = new Set<string>(), frame = 0, announced = 0;
  let job: {runner: Runner; key: Key} | null = null, last: {result: LWProcessDashboardWhatIf.Result; key: Key} | null = null;
  let cached: {text: string; draft: Draft} | null = null;
  /** The draft's state; validation and fingerprint run once per distinct draft text. */
  function draft(): Draft {
   const d = env.draft();
   if (cached?.text !== d.text) {
    const definition = d.changed ? env.validate(d.text) : null;
    const fingerprint = definition ? root.LWProcessCatalog.fingerprint(definition) : '';
    cached = {text: d.text, draft: {changed: d.changed, valid: !!definition, definition, fingerprint}};
   }
   return {...cached.draft, changed: d.changed, valid: d.changed && cached.draft.valid};
  }
  const mode = (): Mode => compare.checked ? 'compare' : 'spread';
  const read = (): Inputs => ({mode: mode(), runs: Number(runs.value), minutes: Number(minutes.value), seed: Number(seed.value)});
  const keyOf = (v: LWProcessApp.View, d: Draft, m: Mode): Key =>
   ({a: root.LWProcessCatalog.fingerprint(v.definition), b: m === 'compare' ? d.fingerprint : null, seed: v.snapshot.seed});
  /** Sets a number field's bounds (finite numbers only) and, unless kept, its value. */
  function setNumber(input: HTMLInputElement, value: number, min: number, max: number, keep: boolean): void {
   input.min = String(min);
   input.max = String(max);
   if (!keep && Number.isFinite(value) && input.value !== String(value)) input.value = String(value);
  }
  function update(): void {
   if (!view) return;
   const d = draft(), why = W.compareReason(d);
   compare.disabled = !!why || !!job;
   $('#db-compare-why').textContent = why ?? 'Both designs run on the same seeds.';
   if (why && compare.checked) spread.checked = true;
   const c = W.check(read(), view, d), n = Number(runs.value);
   $('#db-plan').textContent = [c.plan, c.advice, view.playing ? 'Runs faster while the simulation is paused.' : ''].filter(Boolean).join(' ');
   $('#db-problems').textContent = c.problems.join(' ');
   start.disabled = !c.ok || !!job;
   start.title = job ? 'Replications are running.' : c.problems.join(' ');
   start.textContent = Number.isSafeInteger(n) && n > 0 ? `Run ${n} seeds` : 'Run seeds';
   for (const input of [runs, minutes, seed]) input.disabled = !!job;
   if (!last || job) return;
   const stale = JSON.stringify(keyOf(view, d, last.result.kind)) !== JSON.stringify(last.key);
   results.classList.toggle('stale', stale);
   const note = results.querySelector<HTMLElement>('[data-stale]');
   if (note) note.hidden = !stale;
  }
  function render(): void {
   if (job) last = {result: W.result(job.runner.report(), job.runner.done()), key: job.key};
   results.innerHTML = last ? STALE + W.markup(last.result, width, rem) : '';
  }
  function stop(message: string): void {
   if (!job) return;
   cancelAnimationFrame(frame);
   render();
   job.runner.dispose?.();
   job = null;
   live.textContent = message;
   bar.hidden = true;
   cancel.hidden = true;
   update();
  }
  /** One slice of work between frames: `advance` in budgets for about 12 ms, or one whole replication with `step()`. */
  function slice(): void {
   if (!job) return;
   const runner = job.runner, began = performance.now();
   try {
    while (runner.done() < runner.total && performance.now() - began < SLICE_MS) {
     if (!runner.advance) { runner.step(); break; }
     runner.advance(BUDGET);
    }
   } catch (e) {
    stop('Replications stopped: ' + String(e instanceof Error ? e.message : e));
    return;
   }
   const done = runner.done(), now = performance.now();
   bar.value = done / runner.total;
   if (done >= runner.total) {
    stop(runner.report().format === 'wildlands-process-comparison' ? 'Comparison complete.' : 'Replications complete.');
    return;
   }
   if (now - announced >= ANNOUNCE_MS) {
    announced = now;
    live.textContent = `${done} of ${runner.total} runs`;
    render();
   }
   frame = requestAnimationFrame(slice);
  }
  function begin(): void {
   if (!view || job) return;
   const d = draft(), inputs = read();
   if (!W.check(inputs, view, d).ok) { update(); return; }
   const options = {minutes: inputs.minutes, runs: inputs.runs, seed: inputs.seed, horizon: view.horizon};
   try {
    const R = root.LWProcessReplicate;
    const runner = inputs.mode === 'compare' && d.definition ? R.comparison(view.definition, d.definition, options) : R.replications(view.definition, options);
    job = {runner: runner as Runner, key: keyOf(view, d, inputs.mode)};
   } catch (err) {
    $('#db-problems').textContent = String(err instanceof Error ? err.message : err);
    return;
   }
   last = null;
   results.innerHTML = '';
   announced = performance.now();
   live.textContent = `0 of ${inputs.runs} runs`;
   bar.hidden = false;
   bar.value = 0;
   cancel.hidden = false;
   update();
   cancel.focus();
   frame = requestAnimationFrame(slice);
  }
  form.addEventListener('submit', e => { e.preventDefault(); begin(); });
  cancel.addEventListener('click', () => {
   const n = job?.runner.done() ?? 0, total = job?.runner.total ?? 0;
   stop(`Cancelled after ${n} of ${total} runs.`);
   start.focus();
  });
  for (const input of [runs, minutes, seed]) input.addEventListener('input', () => { dirty.add(input.id); update(); });
  el.addEventListener('change', e => { if ((e.target as HTMLInputElement).name === 'db-mode') update(); });
  return {
   element: el,
   sync(v, w, r) {
    const resized = Math.abs(w - width) > 1 || r !== rem, d = W.defaults(v), focused = document.activeElement;
    view = v; width = w; rem = r;
    if (!job) {
     setNumber(runs, d.runs, W.LIMITS.runsMin, W.LIMITS.runsMax, dirty.has(runs.id));
     setNumber(minutes, d.minutes, 1, W.maxMinutes(v), dirty.has(minutes.id) || focused === minutes);
     setNumber(seed, d.seed, 0, W.LIMITS.seed, dirty.has(seed.id) || focused === seed);
    }
    if (resized && last && !job) render();
    update();
   },
   running: () => !!job,
   cancel: () => stop('Replications cancelled.'),
   reset() {
    stop('Replications cancelled.');
    last = null;
    dirty = new Set();
    results.innerHTML = '';
    live.textContent = '';
   },
   table: () => last ? W.table(last.result) : null,
   dispose() { stop(''); last = null; el.remove(); },
  };
 }
 root.LWProcessDashboardWhatIfView = {create};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessDashboardWhatIfView;
})(globalThis);
