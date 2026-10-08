/// <reference path="./process-contracts.d.ts" />
/** Form editor over the unapplied JSON draft. It only edits draft text; applying still goes through catalog admission and resets the run. */
declare namespace LWProcessTuning {
 interface Surface {refresh(): void; dispose(): void;}
 interface Api {create(host: HTMLElement, read: () => string, write: (text: string) => void): Surface;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessTuning?: LWProcessTuning.Api};
 const esc = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
 const MAX = 100000, num = (id: string, label: string, path: string, value: number | undefined, min: number, max: number) =>
  `<label for="${id}">${esc(label)}<input id="${id}" type="number" inputmode="numeric" data-path="${esc(path)}" data-kind="int" min="${min}" max="${max}" step="1" value="${value ?? ''}"></label>`;
 const text = (id: string, label: string, path: string, value: string | undefined, long = false) =>
  `<label for="${id}">${esc(label)}${long ? `<textarea id="${id}" rows="2" maxlength="2000" data-path="${esc(path)}" data-kind="text">${esc(value ?? '')}</textarea>` : `<input id="${id}" type="text" maxlength="256" data-path="${esc(path)}" data-kind="text" value="${esc(value ?? '')}">`}</label>`;
 function markup(d: LWProcess.Definition): string {
  const res = d.resources.map((r, i) => `<fieldset><legend>${esc(r.name)}</legend>${text('tune-res-name-' + i, 'Name', `resources.${i}.name`, r.name)}${num('tune-res-cap-' + i, 'Capacity', `resources.${i}.capacity`, r.capacity, 1, 1000)}${num('tune-res-cost-' + i, 'Cost per minute', `resources.${i}.costPerMinute`, r.costPerMinute, 0, MAX)}</fieldset>`).join('') || '<p>No shared resources defined.</p>';
  const arrivals = d.arrivals.map((a, i) => `<fieldset><legend>Arrival ${i + 1}</legend>${num('tune-arr-at-' + i, 'First arrival (minute)', `arrivals.${i}.at`, a.at, 0, MAX)}${num('tune-arr-count-' + i, 'Cases', `arrivals.${i}.count`, a.count, 1, 200)}${num('tune-arr-int-' + i, 'Interval (minutes)', `arrivals.${i}.interval`, a.interval, 0, MAX)}</fieldset>`).join('') || '<p>No arrivals defined.</p>';
  return `<h3>Tune values</h3><p class="process-note">Edit process-level numbers and names here. Changes update the draft below; apply it to start a fresh paused run.</p>
   <fieldset><legend>Process</legend>${text('tune-name', 'Name', 'name', d.name)}${text('tune-desc', 'Description', 'description', d.description, true)}</fieldset>
   <h4>Shared resources</h4>${res}<h4>Steps</h4><p class="process-note">Select a step and choose Edit step to change its definition.</p><h4>Case arrivals</h4>${arrivals}`;
 }
 function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.'); let at: any = target;
  for (const key of keys.slice(0, -1)) at = at[key];
  const last = keys.at(-1)!;
  if (value === undefined) delete at[last]; else at[last] = value;
 }
 function create(host: HTMLElement, read: () => string, write: (text: string) => void): LWProcessTuning.Surface {
  const change = (e: Event) => {
   const input = e.target as HTMLInputElement | HTMLTextAreaElement; if (!input.dataset.path) return;
   let draft: any; try {draft = JSON.parse(read());} catch {refresh(); return;}
   let value: unknown;
   if (input.dataset.kind === 'int') {
    const n = input.value === '' ? NaN : Number(input.value);
    if (!Number.isFinite(n)) {input.setAttribute('aria-invalid', 'true'); return;}
    input.removeAttribute('aria-invalid'); value = Math.round(n);
   } else value = input.value === '' && /\.(description|label)$/.test(input.dataset.path) ? undefined : input.value;
   setPath(draft, input.dataset.path, value); write(JSON.stringify(draft, null, 2));
  };
  let shown = '';
  function refresh(): void {
   const focused = (document.activeElement as HTMLElement | null)?.id;
   let draft: LWProcess.Definition; try {draft = JSON.parse(read()) as LWProcess.Definition; if (!Array.isArray(draft.steps) || !Array.isArray(draft.resources) || !Array.isArray(draft.arrivals)) throw Error('shape');}
   catch {shown = ''; host.innerHTML = '<p class="process-note" role="status">The draft is not valid JSON yet. Fix it below or restore the active definition to use the form.</p>'; return;}
   const html = markup(draft); if (html === shown && host.childElementCount) return; shown = html; host.innerHTML = html;
   if (focused && host.contains(document.getElementById(focused))) document.getElementById(focused)!.focus({preventScroll: true});
  }
  host.addEventListener('change', change);
  return {refresh, dispose() {host.removeEventListener('change', change); host.replaceChildren();}};
 }
 root.LWProcessTuning = {create};
})(globalThis);
