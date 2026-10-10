/// <reference path="./process-contracts.d.ts" />
/**
 * The step list of Process Studio (the left column on desktop, a horizontal strip on a phone): markup from a detached view and
 * keeping the selected step in sight. Each item names the step, its kind and its live counts; its dot shows the step's live state
 * in the legend's colours (blocked, working, timer, backlog, waiting) and is absent for an idle step, so a step kind is never
 * mistaken for a state. Nothing here ticks, selects or touches a session; the studio binds the clicks.
 */
declare namespace LWProcessStepList {
 interface Api {
  /** The list items for `#steps`. */
  markup(view: LWProcessApp.View): string;
  /** Keeps the selected step (or, with none, the start of the strip) in view: a phone strip scrolls sideways only, so the page never jumps. */
  reveal(nav: HTMLElement, list: HTMLElement, selected: string | null): void;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessStepList?: LWProcessStepList.Api};
 const esc = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
 const works = (s: LWProcess.Step) => s.kind === 'task' || s.kind === 'machine' || s.kind === 'system';
 /** Token states in the legend's order of urgency. */
 const RANK = ['held', 'active', 'timer', 'backlog', 'queued'];
 function states(q: LWProcess.Snapshot): Map<string, {state: string; held: number}> {
  const out = new Map<string, {state: string; held: number}>();
  for (const t of q.tokens) {
   const at = out.get(t.stepId) ?? {state: '', held: 0}, rank = RANK.indexOf(t.status);
   if (t.status === 'held') at.held++;
   if (rank >= 0 && (!at.state || rank < RANK.indexOf(at.state))) at.state = t.status;
   out.set(t.stepId, at);
  }
  return out;
 }
 function markup(view: LWProcessApp.View): string {
  const {definition: d, snapshot: q, selected} = view, live = states(q);
  return d.steps.map((s, i) => {
   const m = q.steps.find(m => m.id === s.id)!, now = live.get(s.id), current = s.id === selected;
   const counts = [m.active ? m.active + (works(s) && s.kind !== 'task' ? ' running' : ' working') : '', m.queued ? m.queued + ' waiting' : '',
    m.timers.waiting ? m.timers.waiting + ' on timer' : '', now?.held ? now.held + ' blocked' : ''].filter(Boolean).map(t => ' · ' + t).join('');
   const dot = now?.state ? `<i data-state="${now.state}" aria-hidden="true"></i>` : '';
   const order = `<span class="process-order" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>`;
   return `<li><button data-step="${esc(s.id)}" class="process-step ${current ? 'selected' : ''}"${current ? ' aria-current="step"' : ''}>${order}`
    + `<span><strong>${esc(s.name)}</strong><small>${esc(s.kind)}${counts}</small></span>${dot}</button></li>`;
  }).join('');
 }
 function reveal(nav: HTMLElement, list: HTMLElement, selected: string | null): void {
  const item = selected ? list.querySelector(`[data-step="${selected}"]`)?.closest('li') : null;
  if (nav.scrollWidth <= nav.clientWidth + 1) { item?.scrollIntoView({block: 'nearest', inline: 'nearest'}); return; }
  if (!item) { nav.scrollLeft = 0; return; }
  const r = item.getBoundingClientRect(), n = nav.getBoundingClientRect(), pad = 16;
  if (r.left < n.left + pad) nav.scrollLeft -= n.left + pad - r.left; else if (r.right > n.right - pad) nav.scrollLeft += r.right - (n.right - pad);
 }
 root.LWProcessStepList = {markup, reveal};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessStepList;
})(globalThis);
