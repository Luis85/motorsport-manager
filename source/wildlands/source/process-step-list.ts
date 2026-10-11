/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-html.ts" />
/// <reference path="./process-work-state.ts" />
/**
 * The step list of Process Studio (the left column on desktop, a horizontal strip on a phone): markup from a detached view and
 * keeping the selected step in sight. Each item names the step, its kind and its live counts in the 2D card captions' words and
 * order: "N working" ("N running" for machine and system steps), "N waiting", "N blocked", "N on timer". The counts and the dot
 * come from the studio's one work-state derivation (LWProcessWorkState): held work (finished here, waiting for room in the next
 * backlog) is blocked, never waiting (waiting is `queued - held`), and the dot is the card border's state (the most urgent live
 * state: blocked, working, waiting, timer, backlog) in the legend's colours, absent for an idle step, so a step kind is never
 * mistaken for a state. Text is escaped with LWProcessHtml. Nothing here ticks, selects or touches a session; the studio binds
 * the clicks.
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
 const root = inputRoot as {LWProcessStepList?: LWProcessStepList.Api; LWProcessHtml: LWProcessHtml.Api; LWProcessWorkState: LWProcessWorkState.Api};
 /** The live counts after the kind, each with its separator; zero counts are left out. */
 function counts(s: LWProcess.Step, m: LWProcess.StepMetric): string {
  const work = root.LWProcessWorkState, n = work.step(m);
  const parts = [
   n.working ? n.working + ' ' + work.verb(s.kind) : '',
   n.waiting ? n.waiting + ' waiting' : '',
   n.blocked ? n.blocked + ' blocked' : '',
   n.timers ? n.timers + ' on timer' : '',
  ];
  return parts.filter(Boolean).map(t => ' · ' + t).join('');
 }
 function markup(view: LWProcessApp.View): string {
  const {definition: d, snapshot: q, selected} = view, {esc} = root.LWProcessHtml;
  const live = root.LWProcessWorkState.states(q.tokens);
  return d.steps.map((s, i) => {
   const m = q.steps.find(m => m.id === s.id)!, state = live.get(s.id), current = s.id === selected;
   const dot = state ? `<i data-state="${state}" aria-hidden="true"></i>` : '';
   const order = `<span class="process-order" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>`;
   const button = `<button data-step="${esc(s.id)}" class="process-step ${current ? 'selected' : ''}"${current ? ' aria-current="step"' : ''}>`;
   return `<li>${button}${order}`
    + `<span><strong>${esc(s.name)}</strong><small>${esc(s.kind)}${counts(s, m)}</small></span>${dot}</button></li>`;
  }).join('');
 }
 function reveal(nav: HTMLElement, list: HTMLElement, selected: string | null): void {
  const item = selected ? list.querySelector(`[data-step="${selected}"]`)?.closest('li') : null;
  if (nav.scrollWidth <= nav.clientWidth + 1) {
   item?.scrollIntoView({block: 'nearest', inline: 'nearest'});
   return;
  }
  if (!item) {
   nav.scrollLeft = 0;
   return;
  }
  const r = item.getBoundingClientRect(), n = nav.getBoundingClientRect(), pad = 16;
  if (r.left < n.left + pad) nav.scrollLeft -= n.left + pad - r.left;
  else if (r.right > n.right - pad) nav.scrollLeft += r.right - (n.right - pad);
 }
 root.LWProcessStepList = {markup, reveal};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessStepList;
})(globalThis);
