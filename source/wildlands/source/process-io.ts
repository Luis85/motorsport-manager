/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-dom.ts" />
/// <reference path="./process-guard.ts" />
/// <reference path="./process-bpmn-dialog.ts" />
/**
 * File import and export for Process Studio: the Export menu items, Download HTML, the file picker, the BPMN import dialog hand-off and
 * the export notes.
 *
 *  - Exports name what they saved in the status line. JSON, BPMN and the run report use the running definition; while an unapplied
 *    draft exists the menu says so and offers Export draft JSON, which saves the draft exactly as written.
 *  - Export BPMN and Export BPMN with BPSim also say how many notes `LWProcessBpmn.fidelity(definition, {bpsim})` has about values that
 *    travel only in the Wildlands extension; Show export notes… (`#export-notes`, shown once an export had notes) lists them in a
 *    read-only dialog (LWProcessDialog id 'xn') that returns focus to the menu button.
 *  - A JSON file is checked before anything changes. A rejected file is summarised in plain language (what kind of problem, how
 *    many, and what file is expected) and changes nothing. A valid file that would discard a run past minute 0 or an unapplied
 *    draft asks first, starting on Cancel, in the same words as the BPMN import; while fewer than 8 processes are open the question
 *    also offers Add as a new process (`#ask-add`), which keeps the current process and its run. Cancel keeps everything and
 *    returns focus to the control that opened the file picker.
 *  - Import as a new process… (`#import-new`) picks a file that is added as a new process instead of replacing one: a JSON file at
 *    once, a BPMN file through the BPMN import dialog, whose hand-off then adds instead of replacing (its replace confirmation does
 *    not apply, since nothing is lost). It is disabled with its reason once 8 processes are open.
 *  - A BPMN or XML file opens the BPMN import dialog, which applies through the same replace (or add) path.
 *  - Download HTML writes every applied definition, including processes added in this page; a page built for one process gains the
 *    `LWProcessDefinitions` list when a second process exists, so it reopens with all of them.
 * Nothing here ticks or retains the simulation; `env.replace` and `env.add` are the studio's commands that start a fresh paused run.
 */
declare namespace LWProcessIO {
 interface Env {
  /** The studio root: dialogs make it inert while open. */
  host: HTMLElement;
  /** The latest detached view. */
  view(): LWProcessApp.View;
  /** Detached copies of every applied definition, in list order. */
  definitions(): LWProcess.Definition[];
  /** The page as it was first served, for Download HTML. */
  pristine: string;
  draft: LWProcessDraft.Store;
  status(message: string, error?: boolean): void;
  download(name: string, data: string, type: string): void;
  /** Replaces the running definition (a fresh paused run) and returns a sentence about what carried over ('' for nothing). Throws when refused. */
  replace(definition: unknown): string;
  /** Adds a definition as a new process and switches to it; returns a sentence about a renamed id ('' for none). Throws when refused. */
  add(definition: unknown): string;
  /** '' while another process can be added, else the plain reason. */
  canAdd(): string;
  ask(options: LWProcessGuard.AskOptions): Promise<boolean>;
  choose(options: LWProcessGuard.ChooseOptions): Promise<string>;
 }
 interface Surface {
  /** Updates the menu hint and the Export draft JSON item from the view and the draft. */
  sync(): void;
  dispose(): void;
 }
 interface Api {
  create(env: Env): Surface;
  /** The plain-language import rejection for a JSON text: a parse error or the catalog's diagnostics; '' when the text is a valid definition. */
  rejection(text: string): string;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessCatalog: LWProcess.Catalog; LWProcessBpmn: LWProcessBpmn.Api; LWProcessBpmnDialog: LWProcessBpmnDialog.Api;
  LWProcessRunBar: LWProcessRunBar.Api; LWProcessDialog: LWProcessDialog.Api; LWProcessDom: LWProcessDom.Api; LWProcessIO?: LWProcessIO.Api};
 const get = <T extends HTMLElement = HTMLElement>(id: string) => root.LWProcessDom.must<T>(id);
 const esc = (v: unknown) => root.LWProcessDialog.escape(v);
 const MAX_BYTES = 8 * 1024 * 1024, EXPECTED = 'Choose a .process.json exported from the studio, or a BPMN file.';
 const plural = (n: number, one: string) => `${n.toLocaleString()} ${one}${n === 1 ? '' : 's'}`;
 const clip = (text: string, max = 90) => text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
 /** Line and column of a JSON.parse failure, read from the engine's position when it gives one. */
 function where(text: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const at = /position (\d+)/.exec(message), lc = /line (\d+) column (\d+)/.exec(message);
  if (lc) return ` (line ${lc[1]}, column ${lc[2]})`;
  if (!at) return '';
  const before = text.slice(0, Number(at[1])), line = before.split('\n').length;
  return ` (line ${line}, column ${before.length - before.lastIndexOf('\n')})`;
 }
 function rejection(text: string): string {
  let input: unknown;
  try { input = JSON.parse(text); } catch (e) { return `Import rejected: the file is not valid JSON${where(text, e)}. ${EXPECTED}`; }
  const checked = root.LWProcessCatalog.validate(input);
  if (checked.ok) return '';
  const count = plural(checked.diagnostics.length, 'problem'), first = checked.diagnostics[0];
  const shaped = !!input && typeof input === 'object' && (input as {format?: unknown}).format === 'wildlands-process';
  if (!shaped) return `Import rejected: this file is not a Wildlands process (${count}). ${EXPECTED}`;
  const detail = first ? clip((first.path ? first.path + ': ' : '') + first.message) : '';
  return `Import rejected: this process has ${count}${detail ? '; first, ' + detail : ''}. Fix the file, then import it again.`;
 }
 /**
  * Download HTML: every applied definition in list order, the first one also as the single-definition global. The data globals are
  * whole lines of the page's data script, so the patterns are anchored to a line: the same words inside this module's own inlined
  * source never match.
  */
 const ONE = /^window\.LWProcessDefinition = [^\n]*;$/m, LIST = /^window\.LWProcessDefinitions = [^\n]*;$/m;
 function offlineHtml(pristine: string, defs: LWProcess.Definition[]): string {
  const safe = (value: unknown) => JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
  const many = defs.length > 1, list = 'window.LWProcessDefinitions = ' + safe(defs) + ';';
  // The first list entry stays the single-definition global, so a multi-process page reopens on its first process.
  let html = pristine.replace(ONE, () => 'window.LWProcessDefinition = ' + safe(defs[0]) + ';')
   .replace(/<meta name="wildlands-game-digest"[^>]*>/g, '');
  if (!many) return html.replace(/<title>[^<]*<\/title>/, () => '<title>' + esc(defs[0]!.name) + '</title>');
  // A page built for one process has no list yet: it gains one right after the single-definition global.
  if (LIST.test(html)) return html.replace(LIST, () => list);
  return html.replace(ONE, (line: string) => line + '\n' + list);
 }
 function create(env: LWProcessIO.Env): LWProcessIO.Surface {
  const save = (name: string, data: string, type: string, message: string) => { env.download(name, data, type); env.status(message); };
  const on = (id: string, action: () => void) => {
   get(id).onclick = () => { try { action(); } catch (e) { env.status('Export failed: ' + root.LWProcessRunBar.plain(e), true); } };
  };
  const shown = (n: HTMLElement | null) => !!n && n.getClientRects().length > 0;
  const trigger = () => [get('export-menu'), get('more-menu')].find(shown) ?? null;
  /** Notes of the last BPMN export: what only the Wildlands extension carries. */
  let notes: {file: string; list: string[]} = {file: '', list: []}, notesDialog: LWProcessDialog.Surface | null = null;
  function exportBpmn(bpsim: boolean): void {
   const d = env.view().definition, file = d.id + (bpsim ? '.bpsim.bpmn' : '.bpmn');
   const xml = root.LWProcessBpmn.export(d, bpsim ? {bpsim: true} : {}), list = root.LWProcessBpmn.fidelity(d, {bpsim});
   notes = {file, list}; get('export-notes').hidden = !list.length;
   const what = bpsim ? 'with a BPSim scenario in minutes' : 'with diagram layout';
   const count = list.length === 1 ? '1 note names values' : `${list.length} notes name values`;
   const said = list.length ? ` ${count} that travel only in the Wildlands extension; Show export notes in the Export menu lists them.`
    : ' Every value also travels in standard BPMN and BPSim.';
   save(file, xml, 'application/xml', `Exported BPMN 2.0 XML ${what} (${file}).${said}`);
  }
  function showNotes(): void {
   notesDialog ??= root.LWProcessDialog.create(document.body, {
    id: 'xn', size: 'list', title: 'Export notes', inertRoot: env.host, readOnly: true, actions: [], onAction: () => undefined,
   });
   const body = notesDialog.body.querySelector('.xn-notes') ?? notesDialog.body.appendChild(document.createElement('div'));
   body.className = 'xn-notes';
   body.innerHTML = `<p>These values of ${esc(notes.file)} travel only in the Wildlands extension (<code>wl:</code>), so a tool that drops it`
    + ` loses them:</p><ul>${notes.list.map(n => `<li>${esc(n)}</li>`).join('')}</ul>`;
   if (!notesDialog.open({subtitle: notes.file, invoker: trigger(), focusFallback: trigger})) env.status('Close the open window first.', true);
  }
  on('json', () => {
   const d = env.view().definition, name = d.id + '.process.json';
   save(name, JSON.stringify(d, null, 2), 'application/json', `Exported ${name} (the running definition).`);
  });
  on('draft-json', () => {
   const name = env.view().definition.id + '.draft.json';
   save(name, env.draft.read(), 'application/json', `Exported ${name}: the unapplied draft exactly as written. Apply a valid draft to update the simulation.`);
  });
  on('bpmn', () => exportBpmn(false));
  on('bpmn-bpsim', () => exportBpmn(true));
  get('export-notes').onclick = () => showNotes();
  on('report', () => {
   const v = env.view(), name = v.definition.id + '.report.json';
   const fingerprint = root.LWProcessCatalog.fingerprint(v.definition);
   const report = {format: 'wildlands-process-report', schemaVersion: 1, fingerprint, definition: v.definition, snapshot: v.snapshot};
   save(name, JSON.stringify(report, null, 2), 'application/json', `Exported ${name}: the run report at minute ${v.snapshot.minute.toLocaleString()}.`);
  });
  on('html', () => {
   const defs = env.definitions(), many = defs.length > 1;
   save((many ? 'wildlands-processes' : defs[0]!.id) + '.html', offlineHtml(env.pristine, defs), 'text/html', many
    ? `Downloaded an offline HTML with all ${defs.length} applied processes. It opens on ${defs[0]!.name} with a fresh paused run.`
    : 'Downloaded an offline HTML with the running definition. It opens with a fresh paused run.');
  });
  /** The control that opened the file picker gets focus back when a question or the BPMN dialog closes (the phone menu item returns to its trigger). */
  let importFrom: HTMLElement | null = null, adding = false;
  const opener = () => [importFrom, get('import'), get('more-menu')].find(shown) ?? null;
  const pick = (from: HTMLElement | null, add: boolean) => { importFrom = from; adding = add; get<HTMLInputElement>('file').click(); };
  get('import').onclick = () => pick(get('import'), false);
  get('import-item').onclick = () => pick(get('more-menu'), false);
  get('import-new').onclick = () => {
   const full = env.canAdd(); if (full) { env.status(full, true); return; }
   pick(trigger(), true);
  };
  /** The unapplied draft summary without its prefix ('1 step changed'), or '' when the draft matches the running definition. */
  const unapplied = () => env.draft.changed() ? env.draft.describeDiff().replace(/^Unapplied draft: /, '') : '';
  /** What replacing the running definition would discard: a run past minute 0 and the unapplied draft. */
  function losses(): string[] {
   const minute = env.view().snapshot.minute, draft = unapplied();
   return [minute > 0 ? `minute ${minute.toLocaleString()} of the current run` : '', draft ? `the unapplied draft (${draft})` : ''].filter(Boolean);
  }
  const added = (name: string, note: string) => env.status(`Imported ${name} as a new process. Its run is paused at minute 0.${note}`);
  async function importJson(name: string, text: string, add: boolean): Promise<void> {
   const refused = rejection(text);
   if (refused) { env.status(refused, true); return; }
   if (add) { added(name, env.add(JSON.parse(text) as unknown)); return; }
   const lost = losses(), process = env.view().definition.name;
   if (lost.length) {
    const message = `Importing ${name} replaces ${process} and discards ${lost.join(' and ')}. Export the run report or the draft first if you need them.`;
    const base = {title: `Replace ${process}?`, invoker: opener(), focusFallback: opener};
    // With room for another process the question also offers to keep this one and add the file beside it.
    const choices = [{id: 'cancel', label: 'Cancel'}, {id: 'add', label: 'Add as a new process'}, {id: 'go', label: 'Import and replace'}];
    const choice = env.canAdd() ? (await env.ask({...base, confirm: 'Import and replace', message}) ? 'go' : 'cancel')
     : await env.choose({...base, message: message + ` Add as a new process keeps ${process} and its run.`, choices});
    if (choice === 'add') { added(name, env.add(JSON.parse(text) as unknown)); return; }
    if (choice !== 'go') { env.status(`Import of ${name} cancelled. The process, its run and the draft are unchanged.`); return; }
   }
   const note = env.replace(JSON.parse(text) as unknown);
   env.status(`Imported ${name}. New run is paused.${note}`);
  }
  get<HTMLInputElement>('file').onchange = async () => {
   const input = get<HTMLInputElement>('file'), file = input.files?.[0], add = adding; adding = false; if (!file) return;
   try {
    if (file.size > MAX_BYTES) throw Error('the file is larger than 8 MiB. ' + EXPECTED);
    const text = await file.text();
    if (/\.(bpmn|xml)$/i.test(file.name) || text.trimStart().startsWith('<')) openBpmn(file.name, text, add);
    else await importJson(file.name, text, add);
   } catch (e) { env.status('Import rejected: ' + root.LWProcessRunBar.plain(e), true); }
   input.value = '';
  };
  /** True while the BPMN dialog was opened by Import as a new process: its hand-off adds instead of replacing. */
  let bpmnAdds = false;
  function openBpmn(name: string, text: string, add: boolean): void {
   bpmnAdds = add;
   if (!bpmnImport.open({name, text}, opener())) { bpmnAdds = false; throw Error('close the open window first.'); }
   const adds = 'Importing adds a new process with a fresh paused run. Nothing changes until you choose Import.';
   if (add) root.LWProcessDialog.active()?.setTitle('Import BPMN', adds);
  }
  /** Applies a definition from the BPMN import dialog exactly like a JSON import: a fresh paused run, never a tick. */
  const bpmnImport = root.LWProcessBpmnDialog.create(env.host, {
   // Adding loses nothing, so the dialog's replace confirmation has nothing to name.
   active: () => bpmnAdds ? {name: env.view().definition.name, minute: 0, draft: ''}
    : {name: env.view().definition.name, minute: env.view().snapshot.minute, draft: unapplied()},
   apply: (definition, name, warnings) => {
    let note = '';
    try { note = bpmnAdds ? env.add(definition) : env.replace(definition); } catch (e) {
     env.status('Import rejected: ' + root.LWProcessRunBar.plain(e), true); return false;
    }
    const more = warnings.length > 2 ? ' …' : '';
    const notes = warnings.length ? ' ' + warnings.length + ' import note(s): ' + warnings.slice(0, 2).join(' ') + more : '';
    if (bpmnAdds) env.status(`Imported ${name} as a new process. Its run is paused at minute 0.${notes}${note}`);
    else env.status('Imported ' + name + '. New run is paused.' + notes + note);
    bpmnAdds = false; return true;
   },
   focusFor: opener,
  });
  function sync(): void {
   const v = env.view(), many = v.processes.length > 1, draft = env.draft.changed(), full = env.canAdd();
   const base = many ? `JSON, BPMN and the run report use this process. Download HTML keeps all ${v.processes.length} processes.`
    : 'JSON, BPMN and the run report use the running definition. Download HTML saves an offline copy.';
   const hint = base + (draft ? ' Your unapplied draft is not included; Export draft JSON saves it as written.' : '') + (full ? ' ' + full : '');
   if (get('export-hint').textContent !== hint) get('export-hint').textContent = hint;
   get('draft-json').hidden = !draft;
  }
  return {sync, dispose() { bpmnImport.dispose(); notesDialog?.dispose(); notesDialog = null; }};
 }
 root.LWProcessIO = {create, rejection};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessIO;
})(globalThis);
