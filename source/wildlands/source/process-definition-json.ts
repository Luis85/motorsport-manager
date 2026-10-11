/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-html.ts" />
/// <reference path="./process-draft.ts" />
/// <reference path="./process-json-path.ts" />
/**
 * The "Raw JSON" pane of the Definition editor: the draft text in a monospace textarea with a synced line-number gutter, a status
 * line (matches / unapplied / invalid JSON with line and column), the catalog's diagnostics as buttons that select the offending
 * text, Format JSON, Copy and a summary of what changed. The textarea writes the shared draft on every input (source 'raw'); it
 * keeps no copy of the text. It never validates by itself: the editor hands the diagnostics in. Text from the draft and the
 * catalog reaches markup only through LWProcessHtml's `esc`.
 */
declare namespace LWProcessDefinitionJson {
 interface Surface {
  readonly textarea: HTMLTextAreaElement;
  /** Shows the draft: text (unless the textarea wrote it), gutter, status line, diff summary and the Format button. */
  render(source?: string): void;
  /** Lists the catalog's diagnostics (all it returned). `stage` tells whether relationship checks have run. */
  setDiagnostics(list: LWProcess.Diagnostic[], stage: 'structure' | 'graph' | 'none'): void;
  /** The syntax problem of the current text, or null. */
  syntax(): LWProcessJsonPath.SyntaxProblem | null;
  /** Selects the text a diagnostic path names and focuses the textarea. False when there is no such text. */
  jump(path: string): boolean;
  /** Selects the syntax error position and focuses the textarea. */
  jumpToSyntax(): boolean;
  focus(): void;
  dispose(): void;
 }
 interface Api {create(host: HTMLElement, draft: LWProcessDraft.Store): Surface;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessHtml: LWProcessHtml.Api; LWProcessJsonPath: LWProcessJsonPath.Api; LWProcessDefinitionJson?: LWProcessDefinitionJson.Api};
 const J = root.LWProcessJsonPath;
 const {esc} = root.LWProcessHtml;
 const CHANGE = {added: 'added', removed: 'removed', changed: 'changed'} as const;
 // The pane's fixed markup (nothing is interpolated); the line breaks and indents are part of it.
 const PANE = '<div class="de-pane-head"><h3 id="de-json-h" tabindex="-1">Raw JSON</h3><div class="de-tools">'
  + `<button type="button" id="de-format">Format JSON</button><button type="button" id="de-copy">Copy</button></div></div>
   <p class="de-state" id="draft-state" role="status"></p>
   <div class="de-editor"><pre class="de-gutter" id="de-gutter" aria-hidden="true">1</pre>`
  + '<textarea id="draft" wrap="off" spellcheck="false" autocomplete="off" autocapitalize="off" aria-labelledby="de-json-h" '
  + `aria-describedby="draft-state de-copy-note diagnostics"></textarea></div>
   <p class="de-note" id="de-copy-note" role="status"></p>
   <details class="de-diff" id="de-diff" hidden><summary id="de-diff-summary"></summary><ul id="de-diff-list"></ul></details>
   <section class="de-diagnostics" aria-labelledby="de-diag-h"><h4 id="de-diag-h" tabindex="-1">Problems</h4>`
  + '<p class="de-note" id="de-diag-note"></p><ol class="de-diags" id="diagnostics"></ol></section>';
 const STRUCTURE_FIRST = ' Structure problems come first: the catalog checks steps, flows and arrivals together only once the structure is '
  + 'valid, so more problems may appear after you fix these.';
 /** One catalog diagnostic as a button that selects the text it names (with its line when the path is found). */
 function diagnosticItem(text: string, parsed: unknown, scanned: LWProcessJsonPath.Scan, d: LWProcess.Diagnostic): string {
  const at = J.locate(text, d.path, scanned);
  const where = at ? `<small>line ${at.line}${at.exact ? '' : ', nearest block'}</small>` : '';
  return `<li><button type="button" class="de-diag" data-path="${esc(d.path)}"><strong>${esc(J.label(parsed, d.path))}</strong>`
   + `<span>${esc(d.message)}</span>${where}</button></li>`;
 }
 function create(host: HTMLElement, draft: LWProcessDraft.Store): LWProcessDefinitionJson.Surface {
  host.innerHTML = PANE;
  const q = <T extends HTMLElement = HTMLElement>(id: string) => host.querySelector<T>('#' + id)!;
  const area = q<HTMLTextAreaElement>('draft'), gutter = q('de-gutter'), format = q<HTMLButtonElement>('de-format'), state = q('draft-state');
  let problem: LWProcessJsonPath.SyntaxProblem | null = null, problemText = '\u0000', lines = 0, errorLine = 0;
  let diagnostics: LWProcess.Diagnostic[] = [], stage: 'structure' | 'graph' | 'none' = 'none', listed = '';
  const lineHeight = () => parseFloat(getComputedStyle(area).lineHeight) || 19;
  const syncGutter = () => {
   gutter.scrollTop = area.scrollTop;
  };
  function numbers(): void {
   const count = area.value.split('\n').length, bad = problem?.line ?? 0;
   if (count === lines && bad === errorLine) return;
   lines = count;
   errorLine = bad;
   gutter.style.width = `calc(${String(count).length}ch + 22px)`;
   gutter.innerHTML = Array.from({length: count}, (_, i) => i + 1 === bad ? `<span class="bad">${i + 1}</span>` : String(i + 1)).join('\n');
  }
  function syntax(): LWProcessJsonPath.SyntaxProblem | null {
   const text = draft.read();
   if (text !== problemText) {
    problemText = text;
    problem = J.syntaxProblem(text);
   }
   return problem;
  }
  function select(start: number, end: number, line: number): void {
   area.focus({preventScroll: true});
   area.setSelectionRange(start, end);
   area.scrollTop = Math.max(0, (line - 1) * lineHeight() - area.clientHeight / 3);
   area.scrollLeft = 0;
   syncGutter();
  }
  function listDiagnostics(): void {
   const text = draft.read(), bad = syntax(), list = q('diagnostics'), note = q('de-diag-note');
   let html = '', message = '';
   if (bad) {
    message = 'The text is not valid JSON yet, so the definition cannot be checked.';
    html = `<li><button type="button" class="de-diag" data-syntax="1"><strong>Line ${bad.line}, column ${bad.column}</strong>`
     + `<span>${esc(bad.message)}</span></button></li>`;
   } else if (!diagnostics.length) message = 'Valid definition. Applying starts a fresh paused run.';
   else {
    let parsed: unknown;
    try {
     parsed = JSON.parse(text);
    } catch {
     parsed = undefined;
    }
    const scanned = J.scan(text);
    html = diagnostics.map(d => diagnosticItem(text, parsed, scanned, d)).join('');
    message = `${diagnostics.length} ${diagnostics.length === 1 ? 'problem' : 'problems'}.` + (stage === 'structure' ? STRUCTURE_FIRST : '');
   }
   if (note.textContent !== message) note.textContent = message;
   if (listed !== html) {
    listed = html;
    list.innerHTML = html;
   }
   area.setAttribute('aria-invalid', String(!!bad || diagnostics.length > 0));
   if (!bad && !diagnostics.length) area.removeAttribute('aria-invalid');
   q('de-diag-h').textContent = bad ? 'Problem' : diagnostics.length ? `Problems (${diagnostics.length})` : 'Problems';
  }
  /** The status line: the syntax error, what changed, or that the draft matches. */
  function summaryOf(bad: LWProcessJsonPath.SyntaxProblem | null, changed: boolean): string {
   if (bad) return `Invalid JSON: line ${bad.line}, column ${bad.column} · ${bad.message}`;
   if (changed) return `${draft.describeDiff()}. The run keeps using the running definition until you apply.`;
   return 'Draft matches the running definition';
  }
  function render(source?: string): void {
   const text = draft.read();
   if (source !== 'raw' && area.value !== text) area.value = text;
   numbers();
   const bad = syntax(), changed = draft.changed();
   const summary = summaryOf(bad, changed);
   if (state.textContent !== summary) state.textContent = summary;
   state.classList.toggle('bad', !!bad);
   state.classList.toggle('unapplied', changed && !bad);
   format.disabled = !!bad;
   format.title = bad ? 'Fix the JSON syntax error first.' : '';
   const details = q<HTMLDetailsElement>('de-diff'), steps = bad || !changed ? [] : draft.diff().changedSteps;
   details.hidden = !steps.length;
   if (steps.length) {
    q('de-diff-summary').textContent = `Changed steps (${steps.length})`;
    const html = steps.map(s => `<li>${esc(s.name)} — ${CHANGE[s.change]}</li>`).join(''), ul = q('de-diff-list');
    if (ul.dataset.html !== html) {
     ul.dataset.html = html;
     ul.innerHTML = html;
    }
   }
   listDiagnostics();
  }
  function jump(path: string): boolean {
   const text = draft.read(), at = J.locate(text, path);
   if (!at) return false;
   select(at.start, at.end, at.line);
   return true;
  }
  function jumpToSyntax(): boolean {
   const bad = syntax();
   if (!bad) return false;
   select(bad.offset, Math.min(bad.offset + 1, area.value.length), bad.line);
   return true;
  }
  const onInput = () => {
   draft.write(area.value, 'raw');
   numbers();
  };
  function formatJson(): void {
   try {
    draft.write(JSON.stringify(JSON.parse(draft.read()), null, 2), 'format');
    q('de-copy-note').textContent = 'Formatted the JSON.';
   } catch {
    // The button is disabled for invalid JSON.
   }
  }
  async function copy(): Promise<void> {
   const note = q('de-copy-note');
   try {
    await navigator.clipboard.writeText(area.value);
    note.textContent = 'Copied the draft JSON to the clipboard.';
   } catch {
    area.focus();
    area.select();
    note.textContent = 'The browser blocked copying. The whole text is selected: press Ctrl+C (or Cmd+C) to copy it.';
   }
  }
  const onClick = async (e: MouseEvent) => {
   const t = e.target as HTMLElement, diag = t.closest<HTMLButtonElement>('button.de-diag');
   if (diag) {
    if (diag.dataset.syntax) jumpToSyntax();
    else if (!jump(diag.dataset.path!)) q('de-copy-note').textContent = 'That problem has no matching text in the draft.';
    return;
   }
   if (t.closest('#de-format') && !format.disabled) {
    formatJson();
    return;
   }
   if (t.closest('#de-copy')) await copy();
  };
  area.addEventListener('input', onInput);
  area.addEventListener('scroll', syncGutter);
  host.addEventListener('click', onClick);
  return {
   textarea: area, render, syntax, jump, jumpToSyntax, focus: () => area.focus(),
   setDiagnostics(list, kind) {
    diagnostics = list;
    stage = kind;
    listDiagnostics();
   },
   dispose() {
    area.removeEventListener('input', onInput);
    area.removeEventListener('scroll', syncGutter);
    host.removeEventListener('click', onClick);
    host.replaceChildren();
   },
  };
 }
 root.LWProcessDefinitionJson = {create};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessDefinitionJson;
})(globalThis);
