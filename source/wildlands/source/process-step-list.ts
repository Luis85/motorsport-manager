/// <reference path="./process-contracts.d.ts" />
/**
 * The step list of Process Studio (the left column on desktop, a horizontal strip on a phone): markup from a detached view and
 * keeping the selected step in sight. Each item names the step, its kind and its live counts in the 2D card captions' words and
 * order: "N working" ("N running" for machine and system steps), "N waiting", "N blocked", "N on timer". Like the cards, held work
 * (finished here, waiting for room in the next backlog) is blocked, never waiting: waiting is `queued - held`. Its dot follows the
 * card border: the most urgent live state (blocked, working, waiting, timer, backlog) in the legend's colours, read from the work
 * markers with the map's own `LWProcessMapMarks.statusOf`, and absent for an idle step, so a step kind is never mistaken for a
 * state. Nothing here ticks, selects or touches a session; the studio binds the clicks.
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
 const root = inputRoot as {LWProcessStepList?: LWProcessStepList.Api; LWProcessMapMarks: LWProcessMapMarks.Api};
 const esc = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
 /** Card states in the order the map's card border picks them: blocked first, then working, waiting, timer and backlog. */
 const RANK: LWProcessMapMarks.Status[] = ['held', 'active', 'queued', 'timer', 'backlog'];
 /** The most urgent card state of the work at each step. */
 function states(q: LWProcess.Snapshot): Map<string, LWProcessMapMarks.Status> {
  const out = new Map<string, LWProcessMapMarks.Status>();
  for (const t of q.tokens) {
   const status = root.LWProcessMapMarks.statusOf(t), at = out.get(t.stepId);
   if (at === undefined || RANK.indexOf(status) < RANK.indexOf(at)) out.set(t.stepId, status);
  }
  return out;
 }
 /** The live counts after the kind, each with its separator; zero counts are left out. */
 function counts(s: LWProcess.Step, m: LWProcess.StepMetric): string {
  const automated = s.kind === 'machine' || s.kind === 'system', waiting = Math.max(0, m.queued - m.held);
  const parts = [m.active ? m.active + (automated ? ' running' : ' working') : '', waiting ? waiting + ' waiting' : '',
   m.held ? m.held + ' blocked' : '', m.timers.waiting ? m.timers.waiting + ' on timer' : ''];
  return parts.filter(Boolean).map(t => ' · ' + t).join('');
 }
 function markup(view: LWProcessApp.View): string {
  const {definition: d, snapshot: q, selected} = view, live = states(q);
  return d.steps.map((s, i) => {
   const m = q.steps.find(m => m.id === s.id)!, state = live.get(s.id), current = s.id === selected;
   const dot = state ? `<i data-state="${state}" aria-hidden="true"></i>` : '';
   const order = `<span class="process-order" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>`;
   return `<li><button data-step="${esc(s.id)}" class="process-step ${current ? 'selected' : ''}"${current ? ' aria-current="step"' : ''}>${order}`
    + `<span><strong>${esc(s.name)}</strong><small>${esc(s.kind)}${counts(s, m)}</small></span>${dot}</button></li>`;
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
