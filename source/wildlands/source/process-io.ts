/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-guard.ts" />
/// <reference path="./process-bpmn-dialog.ts" />
/**
 * File import and export for Process Studio: the Export menu items, Download HTML, the file picker and the BPMN import dialog.
 *
 *  - Exports name what they saved in the status line. JSON, BPMN and the run report use the running definition; while an unapplied
 *    draft exists the menu says so and offers Export draft JSON, which saves the draft exactly as written.
 *  - A JSON file is checked before anything changes. A rejected file is summarised in plain language (what kind of problem, how
 *    many, and what file is expected) and changes nothing. A valid file that would discard a run past minute 0 or an unapplied
 *    draft asks first, starting on Cancel, in the same words as the BPMN import; Cancel keeps everything and returns focus.
 *  - A BPMN or XML file opens the BPMN import dialog, which applies through the same replace path.
 * Nothing here ticks or retains the simulation; `env.replace` is the studio's command that starts a fresh paused run.
 */
declare namespace LWProcessIO {
 interface Env {
  /** The studio root: the BPMN dialog makes it inert while open. */
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
  ask(options: LWProcessGuard.AskOptions): Promise<boolean>;
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
  LWProcessRunBar: LWProcessRunBar.Api; LWProcessIO?: LWProcessIO.Api};
 const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
 const esc = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
 const MAX_BYTES = 8 * 1024 * 1024, EXPECTED = 'Choose a .process.json exported from the studio, or a BPMN file.';
 const plural = (n: number, one: string) => `${n.toLocaleString()} ${one}${n === 1 ? '' : 's'}`;
 const clip = (text: string, max = 90) => text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
 /** Line and column of a JSON.parse failure, read from the engine's position when it gives one. */
 function where(text: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error), at = /position (\d+)/.exec(message), lc = /line (\d+) column (\d+)/.exec(message);
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
 function create(env: LWProcessIO.Env): LWProcessIO.Surface {
  const save = (name: string, data: string, type: string, message: string) => { env.download(name, data, type); env.status(message); };
  const on = (id: string, action: () => void) => {
   get(id).onclick = () => { try { action(); } catch (e) { env.status('Export failed: ' + root.LWProcessRunBar.plain(e), true); } };
  };
  on('json', () => {
   const d = env.view().definition, name = d.id + '.process.json';
   save(name, JSON.stringify(d, null, 2), 'application/json', `Exported ${name} (the running definition).`);
  });
  on('draft-json', () => {
   const name = env.view().definition.id + '.draft.json';
   save(name, env.draft.read(), 'application/json', `Exported ${name}: the unapplied draft exactly as written. Apply a valid draft to update the simulation.`);
  });
  on('bpmn', () => {
   const d = env.view().definition;
   save(d.id + '.bpmn', root.LWProcessBpmn.export(d), 'application/xml',
    'Exported BPMN 2.0 XML with diagram layout. Wildlands values are stored in a wl: extension; other tools may ignore them.');
  });
  on('bpmn-bpsim', () => {
   const d = env.view().definition;
   save(d.id + '.bpsim.bpmn', root.LWProcessBpmn.export(d, {bpsim: true}), 'application/xml',
    'Exported BPMN 2.0 XML with a BPSim scenario in minutes. Wildlands values stay authoritative in the wl: extension.');
  });
  on('report', () => {
   const v = env.view(), name = v.definition.id + '.report.json';
   const fingerprint = root.LWProcessCatalog.fingerprint(v.definition);
   const report = {format: 'wildlands-process-report', schemaVersion: 1, fingerprint, definition: v.definition, snapshot: v.snapshot};
   save(name, JSON.stringify(report, null, 2), 'application/json', `Exported ${name}: the run report at minute ${v.snapshot.minute.toLocaleString()}.`);
  });
  on('html', () => {
   const defs = env.definitions(), many = defs.length > 1;
   const safe = (value: unknown) => JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
   // The first list entry stays the single-definition global, so a multi-process page reopens on its first process.
   let html = env.pristine.replace(/window\.LWProcessDefinition = [^\n]*;/, () => 'window.LWProcessDefinition = ' + safe(defs[0]) + ';')
    .replace(/<meta name="wildlands-game-digest"[^>]*>/g, '');
   if (many) html = html.replace(/window\.LWProcessDefinitions = [^\n]*;/, () => 'window.LWProcessDefinitions = ' + safe(defs) + ';');
   else html = html.replace(/<title>[^<]*<\/title>/, () => '<title>' + esc(defs[0]!.name) + '</title>');
   save((many ? 'wildlands-processes' : defs[0]!.id) + '.html', html, 'text/html', many
    ? `Downloaded an offline HTML with all ${defs.length} applied processes. It opens on ${defs[0]!.name} with a fresh paused run.`
    : 'Downloaded an offline HTML with the running definition. It opens with a fresh paused run.');
  });
  /** The control that opened the file picker gets focus back when a question or the BPMN dialog closes (the phone menu item returns to its trigger). */
  let importFrom: HTMLElement | null = null;
  const shown = (n: HTMLElement | null) => !!n && n.getClientRects().length > 0;
  const opener = () => [importFrom, get('import'), get('more-menu')].find(shown) ?? null;
  const pick = (from: HTMLElement) => { importFrom = from; get<HTMLInputElement>('file').click(); };
  get('import').onclick = () => pick(get('import')); get('import-item').onclick = () => pick(get('more-menu'));
  /** The unapplied draft summary without its prefix ('1 step changed'), or '' when the draft matches the running definition. */
  const unapplied = () => env.draft.changed() ? env.draft.describeDiff().replace(/^Unapplied draft: /, '') : '';
  /** What replacing the running definition would discard: a run past minute 0 and the unapplied draft. */
  function losses(): string[] {
   const minute = env.view().snapshot.minute, draft = unapplied();
   return [minute > 0 ? `minute ${minute.toLocaleString()} of the current run` : '', draft ? `the unapplied draft (${draft})` : ''].filter(Boolean);
  }
  async function importJson(name: string, text: string): Promise<void> {
   const refused = rejection(text);
   if (refused) { env.status(refused, true); return; }
   const lost = losses(), process = env.view().definition.name;
   if (lost.length) {
    const yes = await env.ask({title: `Replace ${process}?`, confirm: 'Import and replace', invoker: opener(), focusFallback: opener,
     message: `Importing ${name} replaces ${process} and discards ${lost.join(' and ')}. Export the run report or the draft first if you need them.`});
    if (!yes) { env.status(`Import of ${name} cancelled. The process, its run and the draft are unchanged.`); return; }
   }
   const note = env.replace(JSON.parse(text) as unknown);
   env.status(`Imported ${name}. New run is paused.${note}`);
  }
  get<HTMLInputElement>('file').onchange = async () => {
   const input = get<HTMLInputElement>('file'), file = input.files?.[0]; if (!file) return;
   try {
    if (file.size > MAX_BYTES) throw Error('the file is larger than 8 MiB. ' + EXPECTED);
    const text = await file.text();
    if (/\.(bpmn|xml)$/i.test(file.name) || text.trimStart().startsWith('<')) {
     if (!bpmnImport.open({name: file.name, text}, opener())) throw Error('close the open window first.');
    } else await importJson(file.name, text);
   } catch (e) { env.status('Import rejected: ' + root.LWProcessRunBar.plain(e), true); }
   input.value = '';
  };
  /** Applies a definition from the BPMN import dialog exactly like a JSON import: a fresh paused run, never a tick. */
  const bpmnImport = root.LWProcessBpmnDialog.create(env.host, {
   active: () => ({name: env.view().definition.name, minute: env.view().snapshot.minute, draft: unapplied()}),
   apply: (definition, name, warnings) => {
    let note = '';
    try { note = env.replace(definition); } catch (e) { env.status('Import rejected: ' + root.LWProcessRunBar.plain(e), true); return false; }
    const notes = warnings.length ? ' ' + warnings.length + ' import note(s): ' + warnings.slice(0, 2).join(' ') + (warnings.length > 2 ? ' …' : '') : '';
    env.status('Imported ' + name + '. New run is paused.' + notes + note); return true;
   },
   focusFor: opener,
  });
  function sync(): void {
   const v = env.view(), many = v.processes.length > 1, draft = env.draft.changed();
   const base = many ? `JSON, BPMN and the run report use this process. Download HTML keeps all ${v.processes.length} processes.`
    : 'JSON, BPMN and the run report use the running definition. Download HTML saves an offline copy.';
   const hint = base + (draft ? ' Your unapplied draft is not included; Export draft JSON saves it as written.' : '');
   if (get('export-hint').textContent !== hint) get('export-hint').textContent = hint;
   get('draft-json').hidden = !draft;
  }
  return {sync, dispose() { bpmnImport.dispose(); }};
 }
 root.LWProcessIO = {create, rejection};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessIO;
})(globalThis);
