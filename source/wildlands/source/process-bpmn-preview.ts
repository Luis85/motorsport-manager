/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-html.ts" />
/// <reference path="./process-bpmn.ts" />
/// <reference path="./process-bpmn-conformance.ts" />
/**
 * Read-only HTML for the BPMN import dialog (LWProcessBpmnDialog): what a file offers (`contents`, from `LWProcessBpmn.inspect`)
 * and what importing it with the chosen options would produce (`preview`, from `LWProcessBpmn.analyze`). Pure functions of
 * detached values: they never import, apply, tick or touch storage. Markup is built with LWProcessHtml's `html` template, so
 * every string from the file is escaped. `standards` words the file's BPMN 2.0 / BPSim 1.0 conformance report (from
 * `LWProcessBpmnConformance.validate`) as one note that never blocks import.
 */
declare namespace LWProcessBpmnPreview {
 type Tone = 'ready' | 'blocked';
 interface Rendered {html: string; tone: Tone; headline: string}
 interface Api {
  /** Lanes, element counts and executability of one inspected process. */
  contents(process: LWProcessBpmn.Inspection['processes'][number] | undefined): string;
  /**
   * Verdict, facts, rejections, problems, warnings and the mapping grouped by target (at most `ROWS` rows per group). `open`
   * names the groups shown expanded.
   */
  preview(result: LWProcessBpmn.ImportResult, open: ReadonlySet<string>): Rendered;
  /**
   * The Standards check line: conformance and elements checked, or the problem count with the first three problems; elements
   * not covered are counted.
   */
  standards(report: LWProcessBpmnConformance.Report): string;
  /** Mapping rows rendered per group; the rest are counted in a last row, so a large file never floods the dialog. */
  readonly ROWS: number;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessHtml: LWProcessHtml.Api; LWProcessBpmnPreview?: LWProcessBpmnPreview.Api};
 const {html, raw, join} = root.LWProcessHtml;
 type Safe = LWProcessHtml.Safe;
 const plural = (n: number, one: string, many = one + 's') => `${n.toLocaleString()} ${n === 1 ? one : many}`;
 /** `userTask` reads as "user task"; counts stay next to the full element name. */
 const words = (local: string) => local.replace(/([A-Z])/g, ' $1').toLowerCase();
 /** Mapping targets in reading order, each with a full heading. Unknown prefixes follow under their own name. */
 const ROWS = 200;
 const GROUPS: [string, string][] = [
  ['step', 'Steps'],
  ['flow', 'Flows'],
  ['pool', 'Resource pools'],
  ['field', 'Case fields'],
  ['arrival', 'Arrivals'],
  ['sipoc', 'SIPOC suppliers and customers'],
  ['none', 'Folded, inlined or ignored'],
 ];
 function contents(p: LWProcessBpmn.Inspection['processes'][number] | undefined): string {
  if (!p) return '';
  const counts = Object.entries(p.constructs)
   .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
   .map(([k, n]) => html`<li>${words(k)}: ${n}</li>`);
  const lanes = p.lanes.length ? html`<ul class="bi-inline">${p.lanes.map(l => html`<li>${l}</li>`)}</ul>` : 'None';
  const elements = counts.length ? html`<ul class="bi-inline">${counts}</ul>` : 'None';
  return String(join([
   html`<dl class="bi-facts"><dt>Executable</dt><dd>${p.executable ? 'Yes' : 'No'}</dd>`,
   html`<dt>Lanes</dt><dd>${lanes}</dd>`,
   html`<dt>Elements</dt><dd>${elements}</dd></dl>`,
  ]));
 }
 function verdict(r: LWProcessBpmn.ImportResult): {tone: LWProcessBpmnPreview.Tone; headline: string; detail: string} {
  if (r.rejections.length) {
   const fix = r.info.options.unsupported === 'reject'
    ? 'Fix the model, or choose “Drop them with a warning” under Unsupported constructs.'
    : 'Fix the model or change the options.';
   return {tone: 'blocked', headline: `Cannot import: ${plural(r.rejections.length, 'rejection')}.`, detail: fix};
  }
  if (!r.ok) {
   return {
    tone: 'blocked',
    headline: `Cannot run: the imported definition has ${plural(r.diagnostics.length, 'problem')}.`,
    detail: 'The studio imports only a definition that can run. Fix the model or change the options.',
   };
  }
  return {tone: 'ready', headline: 'Ready to import.', detail: 'Importing replaces the active process and starts a fresh paused run at minute 0.'};
 }
 /** The facts of an analysis as label and plain-text value pairs (escaped when rendered). */
 function facts(r: LWProcessBpmn.ImportResult): Safe {
  const d = r.definition, yes = (v: boolean) => v ? 'Yes' : 'No', h = r.info.horizon;
  const horizon = h === null
   ? 'None in the file. Import keeps the current Run until setting.'
   : `${plural(h, 'minute')}, from the BPSim scenario duration. Import keeps the current Run until setting.`;
  const rows: [string, string][] = [['Runnable (ok)', yes(r.ok)], ['Acceptable as a draft', yes(r.acceptable)]];
  if (r.info.process) rows.push(['Process', r.info.process.name || r.info.process.id]);
  const scenario = r.info.scenario ? r.info.scenarios.find(s => s.id === r.info.scenario)?.name || r.info.scenario : 'Not used';
  rows.push(['BPSim scenario', scenario]);
  if (d) {
   const pools = d.resources.length ? d.resources.map(p => `${p.name} (${p.kind ?? 'people'}, capacity ${p.capacity})`).join(', ') : 'None';
   rows.push(['Steps', String(d.steps.length)], ['Flows', String(d.flows.length)], ['Resource pools', pools], ['Arrival rules', String(d.arrivals.length)]);
  }
  rows.push(['Suggested run length', horizon]);
  return html`<dl class="bi-facts">${rows.map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl>`;
 }
 /** A titled list; each item is markup (`Safe`) or plain text. Empty lists print nothing. */
 function list(title: string, items: unknown[], cls: string): Safe | '' {
  if (!items.length) return '';
  return html`<h4>${title} (${items.length})</h4><ul class="bi-list ${cls}">${items.map(i => html`<li>${i}</li>`)}</ul>`;
 }
 const MAP_HEAD = raw('<table class="bi-map"><thead><tr><th scope="col">Element in the file</th><th scope="col">Becomes</th>'
  + '<th scope="col">How</th></tr></thead><tbody>');
 /** One mapping row: the element, what it becomes and how. */
 function row(m: LWProcessBpmn.Mapping): Safe {
  const becomes = m.target === 'none' ? 'Nothing simulated' : html`<code>${m.target.slice(m.target.indexOf(':') + 1)}</code>`;
  return join([
   html`<tr><td data-label="Element"><code>${m.id || '(file)'}</code> <small>${m.type}</small></td>`,
   html`<td data-label="Becomes">${becomes}</td><td data-label="How">${m.how}</td></tr>`,
  ]);
 }
 function table(items: LWProcessBpmn.Mapping[]): Safe {
  const more = items.length > ROWS
   ? html`<tr class="bi-more"><td colspan="3">… ${plural(items.length - ROWS, 'more entry', 'more entries')} not shown</td></tr>`
   : '';
  return join([MAP_HEAD, items.slice(0, ROWS).map(row), more, raw('</tbody></table>')]);
 }
 function mapping(rows: LWProcessBpmn.Mapping[], open: ReadonlySet<string>): Safe | '' {
  if (!rows.length) return '';
  const groups = new Map<string, LWProcessBpmn.Mapping[]>();
  for (const m of rows) {
   const key = m.target.includes(':') ? m.target.slice(0, m.target.indexOf(':')) : m.target, group = groups.get(key);
   if (group) group.push(m);
   else groups.set(key, [m]);
  }
  const unknown = [...groups.keys()].filter(k => !GROUPS.some(([g]) => g === k)).map(k => [k, k] as [string, string]);
  const order = [...GROUPS.filter(([k]) => groups.has(k)), ...unknown];
  const details = order.map(([key, label]) => {
   const items = groups.get(key)!, expanded = open.has(key) ? raw(' open') : '';
   return join([
    html`<details class="bi-group" data-group="${key}"${expanded}>`,
    html`<summary>${label} (${items.length})</summary>${table(items)}</details>`,
   ]);
  });
  return join([html`<h4>Mapping (${plural(rows.length, 'entry', 'entries')})</h4>`, details]);
 }
 function preview(r: LWProcessBpmn.ImportResult, open: ReadonlySet<string>): LWProcessBpmnPreview.Rendered {
  const v = verdict(r);
  const rejections = r.rejections.map(x => html`${x.id ? html`<code>${x.id}</code> ` : ''}<small>${x.type}</small> ${x.message}`);
  const problems = r.diagnostics.map(x => html`<code>${x.path}</code> ${x.message}`);
  const markup = join([
   html`<div class="bi-verdict" data-tone="${v.tone}"><strong>${v.headline}</strong> ${v.detail}</div>`,
   facts(r),
   list('Rejections', rejections, 'bi-bad'),
   list('Definition problems', problems, 'bi-bad'),
   list('Warnings: assumptions made', r.warnings, 'bi-warn'),
   mapping(r.mapping, open),
  ]);
  return {html: String(markup), tone: v.tone, headline: v.headline};
 }
 function standards(r: LWProcessBpmnConformance.Report): string {
  const uncovered = r.notCovered.length ? ` · ${plural(r.notCovered.length, 'element')} not covered by the check` : '';
  const checked = `${plural(r.checked, 'element')} checked${uncovered}`;
  const head = r.conforms
   ? `Conforms to BPMN 2.0 and BPSim 1.0 · ${checked}. It never blocks import.`
   : `${plural(r.errors.length, 'problem')} against BPMN 2.0 and BPSim 1.0 · ${checked}. `
    + 'This check never blocks import: the importer reads foreign BPMN leniently.';
  const first = r.errors.slice(0, 3).map(e => html`<li>${e.line ? `Line ${e.line}: ` : ''}${e.message}</li>`);
  if (r.errors.length > 3) first.push(html`<li>and ${plural(r.errors.length - 3, 'more problem')}</li>`);
  return String(html`<p><strong>Standards check:</strong> ${head}</p>${first.length ? html`<ul>${first}</ul>` : ''}`);
 }
 root.LWProcessBpmnPreview = {contents, preview, standards, ROWS};
})(globalThis);
