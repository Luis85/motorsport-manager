/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-step-model.ts" />
/// <reference path="./process-step-checks.ts" />
/**
 * How the step editor shows problems (owner: the authoring package; split out of LWProcessStepEditor): it collects the local
 * representation problems and the catalog's diagnostics of the candidate definition (LWProcessStepChecks), writes one message per
 * field into the field's error slot (`data-errs`) with `aria-invalid` on its control, opens the collapsed Journey notes when one of
 * their fields has a problem, and builds the status list ("2 problems in this step" as links that focus the field, then
 * "Elsewhere in the draft") and the refusal shown when Apply is refused. It reads the dialog body it is given; it never writes the
 * draft, ticks or touches storage. All markup it returns is escaped.
 */
declare namespace LWProcessStepProblems {
 interface Item extends LWProcessStepModel.Scoped {local: boolean}
 interface Found {items: Item[]; elsewhere: {where: string; message: string}[]; text: string}
 interface Context {
  body: HTMLElement;
  model(): LWProcessStepModel.Model;
  stepId(): string;
  candidate(): LWProcess.Definition;
 }
 interface View {
  /** Problems of the candidate: in this step (local first, then the catalog's in plain words), elsewhere, and its text. */
  check(): Found;
  /** Writes each problem into its field's slot and marks the controls. */
  place(items: Item[]): void;
  /** The status region's markup ('' without problems); `open` adds the Open the Definition editor button to the elsewhere group. */
  status(found: Found, open: boolean): string;
  /** "The draft cannot be applied yet." with the same keyed list; `diagnostics` are the catalog's when nothing else is known. */
  refusal(found: Found, diagnostics: LWProcess.Diagnostic[]): string;
 }
 interface Api {create(context: Context): View}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessCatalog: LWProcess.Catalog; LWProcessStepChecks: LWProcessStepChecks.Api;
  LWProcessStepProblems?: LWProcessStepProblems.Api};
 type Item = LWProcessStepProblems.Item;
 const esc = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
 const LABELS: [RegExp, (n: number) => string][] = [[/^set\.(\d+)/, n => `Value ${n}`], [/^add\.(\d+)/, n => `Counter ${n}`],
  [/^outputs\.(\d+)/, n => `Output ${n}`], [/^needs\.(\d+)/, n => `Need ${n}`], [/^flows\.(\d+)/, n => `Path ${n}`],
  [/^draws\.(\d+)/, n => `Random field ${n}`], [/^pools\.(\d+)/, () => ''], [/^instances/, () => 'Multiple instances'], [/^deadline/, () => 'Deadline'],
  [/^branching/, () => 'Branching']];
 const JOURNEY: Record<string, string> = {phase: 'Phase', emotion: 'Feeling', pain: 'Pain point', opportunity: 'Opportunity', channel: 'Channel',
  outcome: 'Outcome'};
 const overlap = (a: string, b: string) => a === b || a.startsWith(b + '.') || b.startsWith(a + '.');
 const label = (key: string) => {
  for (const [re, name] of LABELS) {
   const m = re.exec(key);
   if (m) return name(Number(m[1]) + 1);
  }
  return JOURNEY[key] ?? (key === 'technology' ? 'Technology' : key.startsWith('timing') ? 'Random timing' : '');
 };
 const otherList = (rows: {where: string; message: string}[]) =>
  `<ul class="se-problems">${rows.map(e => `<li>${esc(e.where)}: ${esc(e.message)}</li>`).join('')}</ul>`;
 function create(c: LWProcessStepProblems.Context): LWProcessStepProblems.View {
  const checks = () => root.LWProcessStepChecks;
  // Keys come from diagnostic paths, which may name keys a person typed into the JSON: escape them for the selector.
  const control = (key: string) => key ? c.body.querySelector<HTMLElement>(`[data-bind="${CSS.escape(key)}"]`)
   ?? c.body.querySelector<HTMLElement>(`[data-bind^="${CSS.escape(key + '.')}"]`) : null;
  const link = (i: Item) => {
   const field = control(i.key), name = label(i.key), message = (name && i.local ? name + ': ' : '') + i.message;
   return field?.id ? `<a href="#${field.id}" data-goto="${field.id}">${esc(message)}</a>` : esc(message);
  };
  const listOf = (items: Item[]) => `<ul class="se-problems">${items.map(i => `<li>${link(i)}</li>`).join('')}</ul>`;
  function check(): LWProcessStepProblems.Found {
   let diagnostics: LWProcess.Diagnostic[] = [];
   const next = c.candidate(), stepId = c.stepId();
   try {
    diagnostics = root.LWProcessCatalog.validate(next, true).diagnostics;
   } catch (e) {
    diagnostics = [{path: '/', code: 'data', message: String(e)}];
   }
   const local: Item[] = checks().problems(c.model()).map(p => ({key: p.key, message: p.message, path: '', local: true}));
   const engine: Item[] = checks().scope(next, stepId, diagnostics).filter(i => !local.some(l => overlap(l.key, i.key)))
    .map(i => ({...i, local: false}));
   const items = [...local, ...engine].filter((i, at, all) => all.findIndex(o => o.key === i.key && o.message === i.message) === at);
   return {items, elsewhere: checks().elsewhere(next, stepId, diagnostics), text: JSON.stringify(next, null, 2)};
  }
  function place(items: Item[]): void {
   for (const slot of c.body.querySelectorAll<HTMLElement>('[data-errs]')) {
    const key = slot.dataset.errs!, mine = items.filter(i => i.key === key || i.key.startsWith(key + '.'));
    const html = mine.map(i => `<p class="se-err">${esc(i.message)}</p>`).join('');
    if ((slot.dataset.html ?? '') !== html) {
     slot.dataset.html = html;
     slot.innerHTML = html;
    }
   }
   const notes = c.body.querySelector<HTMLDetailsElement>('#se-notes');
   if (notes && items.some(i => i.key in JOURNEY)) notes.open = true;
   const marked = new Set<HTMLElement>();
   for (const i of items) {
    const field = control(i.key);
    if (field) marked.add(field);
   }
   c.body.querySelectorAll<HTMLElement>('[aria-invalid]').forEach(n => { if (!marked.has(n)) n.removeAttribute('aria-invalid'); });
   marked.forEach(n => n.setAttribute('aria-invalid', 'true'));
  }
  function status(found: LWProcessStepProblems.Found, open: boolean): string {
   const {items, elsewhere} = found, count = `${items.length} ${items.length === 1 ? 'problem' : 'problems'} in this step`;
   let html = items.length ? `<p class="pd-status-title"><strong>${count}</strong></p>${listOf(items)}` : '';
   if (!elsewhere.length) return html;
   const button = open ? '<button type="button" data-act="open-definition">Open the Definition editor</button>' : 'Open the Definition editor to fix them.';
   html += `<p class="pd-status-title"><strong>Elsewhere in the draft (${elsewhere.length})</strong></p>${otherList(elsewhere)}`
    + `<p class="se-help">These are outside this step. ${button} They do not stop Save to draft, but Apply and reset run needs a valid draft.</p>`;
   return html;
  }
  function refusal(found: LWProcessStepProblems.Found, diagnostics: LWProcess.Diagnostic[]): string {
   const {items, elsewhere} = found, count = items.length + elsewhere.length;
   const list = count ? (items.length ? listOf(items) : '') + (elsewhere.length ? otherList(elsewhere) : '')
    : otherList(diagnostics.map(d => ({where: checks().describePath(c.candidate(), d.path), message: d.message})));
   const these = Math.max(count, diagnostics.length) === 1 ? 'this problem' : 'these problems';
   return `<p><strong>The draft cannot be applied yet.</strong> Fix ${these} and try again.</p>${list}`;
  }
  return {check, place, status, refusal};
 }
 root.LWProcessStepProblems = {create};
})(globalThis);
