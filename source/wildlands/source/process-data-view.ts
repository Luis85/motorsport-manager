/// <reference path="./process-contracts.d.ts" />
/**
 * Shared, accessible I/O inspector. Reads detached observations; never predicts completed outputs. The studio draws it only while
 * the Inputs & outputs panel is open, and a draw that produces the same markup leaves the DOM untouched.
 */
declare namespace LWProcessData {
 interface Surface {draw(view: LWProcessApp.View): void; reset(): void;}
 interface Api {create(host: HTMLElement): Surface;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessData?: LWProcessData.Api; LWProcessRandomView?: LWProcessRandomView.Api; LWProcessTerms: LWProcessTerms.Api};
 const esc = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
 function fields(data: LWProcess.Fields, empty: string, drawn: ReadonlySet<string> = new Set()): string {
  const entries = Object.entries(data);
  return entries.length ? `<dl class="process-fields">${entries.map(([key, value]) => `<dt>${esc(key)}${drawn.has(key) ? ' <em class="se-drawn">drawn</em>' : ''}</dt><dd><code>${esc(JSON.stringify(value))}</code></dd>`).join('')}</dl>` : `<p class="process-empty">${empty}</p>`;
 }
 /** Task, machine and system steps run the same way: one visit, a receipt on completion. */
 const works = (step: LWProcess.Step | undefined): boolean => step?.kind === 'task' || step?.kind === 'machine' || step?.kind === 'system';
 const drawnFields = (step: LWProcess.Step | undefined): ReadonlySet<string> => new Set((step?.draws ?? []).map(d => d.field));
 /** Random timing and draws of a step as plain sentences; '' for deterministic steps. */
 function randomness(step: LWProcess.Step): string {
  const view = root.LWProcessRandomView, lines = [step.timing && view ? view.describeTiming(step) : '', view?.describeInstances(step) ?? '', view?.describeDeadline(step) ?? '', ...(view ? (step.draws ?? []).map(view.describeDraw) : [])].filter(Boolean);
  return lines.length ? `<ul class="process-adds" aria-label="Random behaviour">${lines.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '';
 }
 /** 'Took 9 min (planned 12)' when the receipt recorded a realized duration, plus the instance count of a multiple-instance visit. */
 const took = (step: LWProcess.Step, r: LWProcess.Receipt | undefined) => (r?.duration === undefined ? '' : ` · Took ${r.duration} min${step.duration === undefined ? '' : ` (planned ${step.duration})`}`) + (r?.instances === undefined ? '' : ` · ${r.instances} instances`);
 /** Which item and deadline a running token is on; '' for ordinary work. */
 const running = (t: LWProcess.Token | undefined) => (t?.item === undefined ? '' : ` · item ${t.item} of ${t.items}`) + (t?.deadlineAt === undefined ? '' : ` · deadline at minute ${t.deadlineAt}`) + (t?.escalated ? ' · escalated work' : '');
 const declared = (step: LWProcess.Step) => step.outputs?.length ? `<p class="process-declared">Declared outputs: ${step.outputs.map(o => esc(o.label ? `${o.label} (${o.field})` : o.field)).join(', ')}</p>` : '';
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
   const {definition: d, snapshot: q, selected} = view, step = d.steps.find(s => s.id === selected), t = root.LWProcessTerms.of(d);
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
    content = `<div class="process-io-columns"><section><h3>Scheduled inputs</h3>${d.arrivals.map(a => `<p>${a.count === undefined ? t.Many + (a.open ? " · open stream" : " · until minute " + a.until) : t.count(a.count)} · from ${a.at} min · every ${a.interval} min</p>${fields(a.data, 'No input fields defined.')}`).join('') || '<p>No arrivals defined.</p>'}</section><section><h3>Process outputs</h3><p>No ${t.many} have completed. Advance the simulation to observe outputs.</p></section></div>`;
   } else if (!step || !works(step) && step.kind !== 'timer') {
    content = `<div class="process-io-columns"><section><h3>Process inputs</h3><p>Captured on arrival · ${c.entered} min</p>${fields(c.input, `This ${t.one} arrived without input fields.`)}</section><section><h3>${c.status === 'completed' ? 'Process outputs' : `Current ${t.one} data`}</h3><p>${c.status === 'completed' ? 'Completed at ' + c.finished + ' min' : c.status === 'failed' ? 'Failed · ' + esc(c.error) : 'In progress · final outputs are not available yet'}</p>${fields(c.data, `No ${t.one} fields.`)}</section></div>`;
   } else {
    const timing = token?.status === 'timer' && !receipt, state = receipt ? `Completed · ${receipt.started}–${receipt.finished} min${took(step, receipt)}` : timing ? `Waiting on timer · due minute ${token!.due} (${Math.max(0, token!.due! - q.minute)} min left)` : token?.status === 'active' ? `${view.playing ? (step.kind === 'task' ? 'Working' : 'Running') : 'Paused'} · ${token.remaining} min remaining${running(token)}` : token ? 'Waiting · inputs will be captured when work starts' : `No retained visit for this ${t.one} at this step`;
    const progress = token?.status === 'active' && !receipt && !step.timing ? `<progress value="${step.duration! - token.remaining}" max="${step.duration}" aria-label="Step progress"></progress>` : '';
    content = `<p class="process-io-state">${state}</p>${progress}<div class="process-io-columns"><section><h3>${receipt || token?.input ? 'Step inputs' : `Current ${t.one} data`}</h3><p>${receipt || token?.input ? 'Captured when this visit started' : 'No started input snapshot for this visit'}</p>${fields(receipt?.input ?? token?.input ?? c.data, 'No input fields.')}</section><section><h3>${receipt ? 'Step outputs' : 'Expected changes'}</h3><p>${receipt ? 'Observed case data at ' + (step.kind === 'timer' ? 'firing' : 'completion') : 'Authored effects · applied only on ' + (step.kind === 'timer' ? 'firing' : 'completion')}</p>${fields(receipt?.output ?? step.set ?? {}, receipt ? 'No output fields.' : Object.keys(step.add ?? {}).length ? 'No fields set; counters change as listed below.' : 'No fields changed; case data passes through.', receipt ? drawnFields(step) : undefined)}${receipt ? '' : adds(step) + randomness(step)}${counters(step, receipt?.output ?? c.data)}${declared(step)}</section></div>`;
    if (receipt) content += `<details class="process-written" ${expanded ? 'open' : ''}><summary id="process-written-toggle">Fields written by this step</summary>${fields(receipt.changes, 'This step passed case data through unchanged.', drawnFields(step))}</details>`;
   }
   const cases = q.cases.map(c => `<option value="${esc(c.id)}" ${c.id === caseId ? 'selected' : ''}>${esc(c.id)} · ${c.status}</option>`).join('');
   const visitOptions = receipts.map(r => `<option value="${esc(r.id)}" ${r.id === receiptId ? 'selected' : ''}>`
    + `${r.started}–${r.finished} min · completed</option>`);
   const visit = (works(step) || step?.kind === 'timer') && receipts.length ? '<div class="process-visit"><label for="process-visit">Visit</label>'
    + `<select id="process-visit"><option value="">Latest / current visit</option>${visitOptions.join('')}</select></div>` : '';
   const retention = q.receiptsDropped ? `<p class="process-retention">Latest 128 task completions retained; ${q.receiptsDropped} earlier records omitted.`
    + ' Process inputs and final case outputs remain available.</p>' : '';
   const html = `<div class="process-data-heading"><div><label for="process-case">${t.One}</label><select id="process-case" ${c ? '' : 'disabled'}>`
    + `${cases || '<option>No arrivals yet</option>'}</select></div></div>${visit}${content}${retention}`;
   // Unchanged markup is left alone, so an open case list or a focused control survives a pulse that changed nothing here.
   if (host.dataset.html === html) return;
   host.dataset.html = html; host.innerHTML = html;
   host.querySelector<HTMLSelectElement>('#process-case')!.onchange = e => {caseId = (e.target as HTMLSelectElement).value; receiptId = ''; draw(latest);};
   const visits = host.querySelector<HTMLSelectElement>('#process-visit');
   if (visits) visits.onchange = e => {receiptId = (e.target as HTMLSelectElement).value; draw(latest);};
   if (focus) host.querySelector<HTMLElement>('#' + focus)?.focus({preventScroll: true});
  }
  return {draw, reset() {caseId = ''; receiptId = ''; inspection = ''; previousStep = null; delete host.dataset.html;}};
 }
 root.LWProcessData = {create};
})(globalThis);
