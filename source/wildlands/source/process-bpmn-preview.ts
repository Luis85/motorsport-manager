/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-bpmn.ts" />
/// <reference path="./process-bpmn-conformance.ts" />
/**
 * Read-only HTML for the BPMN import dialog (LWProcessBpmnDialog): what a file offers (`contents`, from `LWProcessBpmn.inspect`)
 * and what importing it with the chosen options would produce (`preview`, from `LWProcessBpmn.analyze`). Pure functions of
 * detached values: they never import, apply, tick or touch storage. Every string from the file is escaped. `standards` words the
 * file's BPMN 2.0 / BPSim 1.0 conformance report (from `LWProcessBpmnConformance.validate`) as one note that never blocks import.
 */
declare namespace LWProcessBpmnPreview {
 type Tone = 'ready' | 'blocked';
 interface Rendered {html: string; tone: Tone; headline: string}
 interface Api {
  /** Lanes, element counts and executability of one inspected process. */
  contents(process: LWProcessBpmn.Inspection['processes'][number] | undefined): string;
  /** Verdict, facts, rejections, problems, warnings and the mapping grouped by target (at most `ROWS` rows per group). `open` names the groups shown expanded. */
  preview(result: LWProcessBpmn.ImportResult, open: ReadonlySet<string>): Rendered;
  /** The Standards check line: conformance and elements checked, or the problem count with the first three problems; elements not covered are counted. */
  standards(report: LWProcessBpmnConformance.Report): string;
  /** Mapping rows rendered per group; the rest are counted in a last row, so a large file never floods the dialog. */
  readonly ROWS: number;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessBpmnPreview?: LWProcessBpmnPreview.Api};
 const esc = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
 const plural = (n: number, one: string, many = one + 's') => `${n.toLocaleString()} ${n === 1 ? one : many}`;
 /** `userTask` reads as "user task"; counts stay next to the full element name. */
 const words = (local: string) => local.replace(/([A-Z])/g, ' $1').toLowerCase();
 /** Mapping targets in reading order, each with a full heading. Unknown prefixes follow under their own name. */
 const ROWS = 200;
 const GROUPS: [string, string][] = [['step', 'Steps'], ['flow', 'Flows'], ['pool', 'Resource pools'], ['field', 'Case fields'], ['arrival', 'Arrivals'], ['sipoc', 'SIPOC suppliers and customers'], ['none', 'Folded, inlined or ignored']];
 function contents(p: LWProcessBpmn.Inspection['processes'][number] | undefined): string {
  if (!p) return '';
  const counts = Object.entries(p.constructs).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, n]) => `<li>${esc(words(k))}: ${n}</li>`).join('');
  return `<dl class="bi-facts"><dt>Executable</dt><dd>${p.executable ? 'Yes' : 'No'}</dd>`
   + `<dt>Lanes</dt><dd>${p.lanes.length ? `<ul class="bi-inline">${p.lanes.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : 'None'}</dd>`
   + `<dt>Elements</dt><dd>${counts ? `<ul class="bi-inline">${counts}</ul>` : 'None'}</dd></dl>`;
 }
 function verdict(r: LWProcessBpmn.ImportResult): {tone: LWProcessBpmnPreview.Tone; headline: string; detail: string} {
  if (r.rejections.length) {
   const fix = r.info.options.unsupported === 'reject' ? 'Fix the model, or choose “Drop them with a warning” under Unsupported constructs.' : 'Fix the model or change the options.';
   return {tone: 'blocked', headline: `Cannot import: ${plural(r.rejections.length, 'rejection')}.`, detail: fix};
  }
  if (!r.ok) return {tone: 'blocked', headline: `Cannot run: the imported definition has ${plural(r.diagnostics.length, 'problem')}.`, detail: 'The studio imports only a definition that can run. Fix the model or change the options.'};
  return {tone: 'ready', headline: 'Ready to import.', detail: 'Importing replaces the active process and starts a fresh paused run at minute 0.'};
 }
 function facts(r: LWProcessBpmn.ImportResult): string {
  const d = r.definition, yes = (v: boolean) => v ? 'Yes' : 'No', h = r.info.horizon;
  const horizon = h === null ? 'None in the file. Import keeps the current Run until setting.' : `${plural(h, 'minute')}, from the BPSim scenario duration. Import keeps the current Run until setting.`;
  const rows: [string, string][] = [['Runnable (ok)', yes(r.ok)], ['Acceptable as a draft', yes(r.acceptable)]];
  if (r.info.process) rows.push(['Process', esc(r.info.process.name || r.info.process.id)]);
  rows.push(['BPSim scenario', r.info.scenario ? esc(r.info.scenarios.find(s => s.id === r.info.scenario)?.name || r.info.scenario) : 'Not used']);
  if (d) rows.push(['Steps', String(d.steps.length)], ['Flows', String(d.flows.length)], ['Resource pools', d.resources.length ? d.resources.map(p => `${esc(p.name)} (${p.kind ?? 'people'}, capacity ${p.capacity})`).join(', ') : 'None'], ['Arrival rules', String(d.arrivals.length)]);
  rows.push(['Suggested run length', horizon]);
  return `<dl class="bi-facts">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
 }
 const list = (title: string, items: string[], cls: string) => items.length ? `<h4>${title} (${items.length})</h4><ul class="bi-list ${cls}">${items.map(i => `<li>${i}</li>`).join('')}</ul>` : '';
 function mapping(rows: LWProcessBpmn.Mapping[], open: ReadonlySet<string>): string {
  if (!rows.length) return '';
  const groups = new Map<string, LWProcessBpmn.Mapping[]>();
  for (const m of rows) {
   const key = m.target.includes(':') ? m.target.slice(0, m.target.indexOf(':')) : m.target, group = groups.get(key);
   if (group) group.push(m); else groups.set(key, [m]);
  }
  const order = [...GROUPS.filter(([k]) => groups.has(k)), ...[...groups.keys()].filter(k => !GROUPS.some(([g]) => g === k)).map(k => [k, k] as [string, string])];
  const table = (items: LWProcessBpmn.Mapping[]) => `<table class="bi-map"><thead><tr><th scope="col">Element in the file</th><th scope="col">Becomes</th><th scope="col">How</th></tr></thead><tbody>`
   + items.slice(0, ROWS).map(m => `<tr><td data-label="Element"><code>${esc(m.id || '(file)')}</code> <small>${esc(m.type)}</small></td><td data-label="Becomes">${m.target === 'none' ? 'Nothing simulated' : `<code>${esc(m.target.slice(m.target.indexOf(':') + 1))}</code>`}</td><td data-label="How">${esc(m.how)}</td></tr>`).join('')
   + (items.length > ROWS ? `<tr class="bi-more"><td colspan="3">… ${plural(items.length - ROWS, 'more entry', 'more entries')} not shown</td></tr>` : '')
   + '</tbody></table>';
  return `<h4>Mapping (${plural(rows.length, 'entry', 'entries')})</h4>` + order.map(([key, label]) => `<details class="bi-group" data-group="${esc(key)}"${open.has(key) ? ' open' : ''}><summary>${esc(label)} (${groups.get(key)!.length})</summary>${table(groups.get(key)!)}</details>`).join('');
 }
 function preview(r: LWProcessBpmn.ImportResult, open: ReadonlySet<string>): LWProcessBpmnPreview.Rendered {
  const v = verdict(r);
  const html = `<div class="bi-verdict" data-tone="${v.tone}"><strong>${esc(v.headline)}</strong> ${esc(v.detail)}</div>${facts(r)}`
   + list('Rejections', r.rejections.map(x => `${x.id ? `<code>${esc(x.id)}</code> ` : ''}<small>${esc(x.type)}</small> ${esc(x.message)}`), 'bi-bad')
   + list('Definition problems', r.diagnostics.map(x => `<code>${esc(x.path)}</code> ${esc(x.message)}`), 'bi-bad')
   + list('Warnings: assumptions made', r.warnings.map(esc), 'bi-warn') + mapping(r.mapping, open);
  return {html, tone: v.tone, headline: v.headline};
 }
 function standards(r: LWProcessBpmnConformance.Report): string {
  const checked = `${plural(r.checked, 'element')} checked${r.notCovered.length ? ` · ${plural(r.notCovered.length, 'element')} not covered by the check` : ''}`;
  const head = r.conforms ? `Conforms to BPMN 2.0 and BPSim 1.0 · ${checked}. It never blocks import.` : `${plural(r.errors.length, 'problem')} against BPMN 2.0 and BPSim 1.0 · ${checked}. This check never blocks import: the importer reads foreign BPMN leniently.`;
  const first = r.errors.slice(0, 3).map(e => `<li>${e.line ? `Line ${e.line}: ` : ''}${esc(e.message)}</li>`).join('') + (r.errors.length > 3 ? `<li>and ${plural(r.errors.length - 3, 'more problem')}</li>` : '');
  return `<p><strong>Standards check:</strong> ${head}</p>${first ? `<ul>${first}</ul>` : ''}`;
 }
 root.LWProcessBpmnPreview = {contents, preview, standards, ROWS};
})(globalThis);
