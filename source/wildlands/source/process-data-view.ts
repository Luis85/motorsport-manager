/// <reference path="./process-contracts.d.ts" />
/** Shared, accessible I/O inspector. Reads detached observations; never predicts completed outputs. */
declare namespace LWProcessData {
 interface Surface {draw(view: LWProcessApp.View): void; reset(): void;}
 interface Api {create(host: HTMLElement): Surface;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessData?: LWProcessData.Api};
 const esc = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
 function fields(data: LWProcess.Fields, empty: string): string {
  const entries = Object.entries(data);
  return entries.length ? `<dl class="process-fields">${entries.map(([key, value]) => `<dt>${esc(key)}</dt><dd><code>${esc(JSON.stringify(value))}</code></dd>`).join('')}</dl>` : `<p class="process-empty">${empty}</p>`;
 }
 const addText = (add: Record<string, number> | undefined) => Object.entries(add ?? {}).map(([k, n]) => `${n >= 0 ? '+' : '\u2212'}${Math.abs(n)} to ${k}`);
 function adds(step: LWProcess.Step): string {const list = addText(step.add); return list.length ? `<ul class="process-adds" aria-label="Counter changes">${list.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '';}
 function counters(step: LWProcess.Step, data: LWProcess.Fields): string {
  const keys = Object.keys(step.add ?? {}); return keys.length ? `<p class="process-counters">Current counters: ${keys.map(k => `${esc(k)} = <code>${esc(JSON.stringify(data[k] ?? 0))}</code>`).join(', ')}</p>` : '';
 }
 function create(host: HTMLElement): LWProcessData.Surface {
  let caseId = '', receiptId = '', inspection = '', previousStep: string | null = null, latest: LWProcessApp.View;
  function draw(view: LWProcessApp.View): void {
   latest = view;
   const focus = host.contains(document.activeElement) ? (document.activeElement as HTMLElement).id : '';
   const {definition: d, snapshot: q, selected} = view, step = d.steps.find(s => s.id === selected);
   if (previousStep !== selected) {receiptId = ''; previousStep = selected;}
   const relevant = q.tokens.find(t => !selected || t.stepId === selected)?.caseId ?? [...q.receipts].reverse().find(r => !selected || r.stepId === selected)?.caseId;
   if (!q.cases.some(c => c.id === caseId)) caseId = relevant ?? q.cases[0]?.id ?? '';
   const c = q.cases.find(c => c.id === caseId);
   const receipts = q.receipts.filter(r => r.caseId === caseId && r.stepId === selected);
   const token = q.tokens.find(t => t.caseId === caseId && t.stepId === selected);
   if (!receipts.some(r => r.id === receiptId)) receiptId = '';
   const receipt = receiptId ? receipts.find(r => r.id === receiptId) : token ? undefined : receipts.at(-1);
   const nextInspection = JSON.stringify([caseId, selected, receipt?.id]);
   const expanded = inspection === nextInspection && !!host.querySelector<HTMLDetailsElement>('.process-written')?.open;
   inspection = nextInspection;
   let content: string;
   if (!c) {
    content = `<div class="process-io-columns"><section><h3>Scheduled inputs</h3>${d.arrivals.map(a => `<p>${a.count} case${a.count === 1 ? '' : 's'} · from ${a.at} min · every ${a.interval} min</p>${fields(a.data, 'No input fields defined.')}`).join('') || '<p>No arrivals defined.</p>'}</section><section><h3>Process outputs</h3><p>No cases have completed. Advance the simulation to observe outputs.</p></section></div>`;
   } else if (!step || step.kind !== 'task' && step.kind !== 'timer') {
    content = `<div class="process-io-columns"><section><h3>Process inputs</h3><p>Captured on arrival · ${c.entered} min</p>${fields(c.input, 'This case arrived without input fields.')}</section><section><h3>${c.status === 'completed' ? 'Process outputs' : 'Current case data'}</h3><p>${c.status === 'completed' ? 'Completed at ' + c.finished + ' min' : c.status === 'failed' ? 'Failed · ' + esc(c.error) : 'In progress · final outputs are not available yet'}</p>${fields(c.data, 'No case fields.')}</section></div>`;
   } else {
    const timing = token?.status === 'timer' && !receipt, state = receipt ? `Completed · ${receipt.started}–${receipt.finished} min` : timing ? `Waiting on timer · due minute ${token!.due} (${Math.max(0, token!.due! - q.minute)} min left)` : token?.status === 'active' ? `${view.playing ? 'Working' : 'Paused'} · ${token.remaining} min remaining` : token ? 'Waiting · inputs will be captured when work starts' : 'No retained visit for this case at this step';
    const progress = token?.status === 'active' && !receipt ? `<progress value="${step.duration! - token.remaining}" max="${step.duration}" aria-label="Step progress"></progress>` : '';
    content = `<p class="process-io-state">${state}</p>${progress}<div class="process-io-columns"><section><h3>${receipt || token?.input ? 'Step inputs' : 'Current case data'}</h3><p>${receipt || token?.input ? 'Captured when this visit started' : 'No started input snapshot for this visit'}</p>${fields(receipt?.input ?? token?.input ?? c.data, 'No input fields.')}</section><section><h3>${receipt ? 'Step outputs' : 'Expected changes'}</h3><p>${receipt ? 'Observed case data at ' + (step.kind === 'timer' ? 'firing' : 'completion') : 'Authored effects · applied only on ' + (step.kind === 'timer' ? 'firing' : 'completion')}</p>${fields(receipt?.output ?? step.set ?? {}, receipt ? 'No output fields.' : Object.keys(step.add ?? {}).length ? 'No fields set; counters change as listed below.' : 'No fields changed; case data passes through.')}${receipt ? '' : adds(step)}${counters(step, receipt?.output ?? c.data)}</section></div>`;
    if (receipt) content += `<details class="process-written" ${expanded ? 'open' : ''}><summary id="process-written-toggle">Fields written by this step</summary>${fields(receipt.changes, 'This step passed case data through unchanged.')}</details>`;
   }
   host.innerHTML = `<div class="process-data-heading"><h2>Inputs & outputs</h2><div><label for="process-case">Case</label><select id="process-case" ${c ? '' : 'disabled'}>${q.cases.map(c => `<option value="${esc(c.id)}" ${c.id === caseId ? 'selected' : ''}>${esc(c.id)} · ${c.status}</option>`).join('') || '<option>No arrivals yet</option>'}</select></div></div>${(step?.kind === 'task' || step?.kind === 'timer') && receipts.length ? `<div class="process-visit"><label for="process-visit">Visit</label><select id="process-visit"><option value="">Latest / current visit</option>${receipts.map(r => `<option value="${esc(r.id)}" ${r.id === receiptId ? 'selected' : ''}>${r.started}–${r.finished} min · completed</option>`).join('')}</select></div>` : ''}${content}${q.receiptsDropped ? `<p class="process-retention">Latest 128 task completions retained; ${q.receiptsDropped} earlier records omitted. Process inputs and final case outputs remain available.</p>` : ''}`;
   host.querySelector<HTMLSelectElement>('#process-case')!.onchange = e => {caseId = (e.target as HTMLSelectElement).value; receiptId = ''; draw(latest);};
   const visits = host.querySelector<HTMLSelectElement>('#process-visit');
   if (visits) visits.onchange = e => {receiptId = (e.target as HTMLSelectElement).value; draw(latest);};
   if (focus) host.querySelector<HTMLElement>('#' + focus)?.focus({preventScroll: true});
  }
  return {draw, reset() {caseId = ''; receiptId = ''; inspection = ''; previousStep = null;}};
 }
 root.LWProcessData = {create};
})(globalThis);
