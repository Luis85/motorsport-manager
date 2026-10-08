/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-tuning-fields.ts" />
/**
 * The process type and tracked measures part of the Definition editor's tuning form. The process type is the definition's `genre`
 * (a display preset: terminology and default view, no runtime effect). Tracked measures are up to six case fields (`track`) that the
 * simulation averages when cases finish and at every step, to draw the measured curve. `markup` renders the controls with their
 * error slots; `special` and `act` apply the edits that need more than "set this path to this value" to the detached draft object
 * they are given. Nothing here touches the DOM, the draft store or a session.
 */
declare namespace LWProcessTuningTrack {
 interface Result {write: boolean; rerender: boolean; focus?: string; local?: [string, string]}
 interface Api {
  /** The Process type select with a one-sentence help for the selected type. */
  genreMarkup(def: LWProcess.Definition): string;
  /** The Tracked measures section. */
  trackMarkup(def: LWProcess.Definition): string;
  /** Field names found in set, add, draws and arrival data/draws, valid for tracking, sorted. */
  suggestions(def: LWProcess.Definition): string[];
  /** A change to the process type select; null when the control is not it. */
  special(def: LWProcess.Definition, el: HTMLElement): Result | null;
  /** A click on a tracked measure add/remove button; null for other buttons. */
  act(def: LWProcess.Definition, button: HTMLElement): Result | null;
  /** The most tracked measures a definition may have. */
  LIMIT: number;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessTuningFields: LWProcessTuningFields.Api; LWProcessTuningTrack?: LWProcessTuningTrack.Api};
 const F = root.LWProcessTuningFields, esc = F.esc, LIMIT = 6, NAME = /^[a-z][a-zA-Z0-9_]{0,63}$/;
 const HINT = 'Start with a lowercase letter, then letters, digits or underscores (up to 64).';
 const GENRES: [string, string, string][] = [
  ['process', 'Business process', 'Cases are work items such as orders or tickets, and steps are work that people, machines or systems do.'],
  ['customer-journey', 'Customer journey', 'Cases are customers and steps are the touchpoints where they meet your business, from first contact to their goal.'],
  ['user-journey', 'User journey', 'Cases are users of a product or service and steps are the interactions they take to get what they came for.'],
 ];
 const genreOf = (def: LWProcess.Definition) => GENRES.find(g => g[0] === def.genre) ?? GENRES[0]!;
 function genreMarkup(def: LWProcess.Definition): string {
  const [value, , help] = genreOf(def);
  return F.choice('tune-genre', 'Process type', 'genre', value, GENRES.map(([v, name]): [string, string] => [v, name]), help + ' It changes labels and the default view only; the simulation runs the same.');
 }
 function suggestions(def: LWProcess.Definition): string[] {
  const names = new Set<string>(), add = (key: string) => { if (NAME.test(key)) names.add(key); };
  for (const s of def.steps) { Object.keys(s.set ?? {}).forEach(add); Object.keys(s.add ?? {}).forEach(add); (s.draws ?? []).forEach(d => add(d.field)); }
  for (const a of def.arrivals ?? []) { Object.keys(a.data ?? {}).forEach(add); (a.draws ?? []).forEach(d => add(d.field)); }
  return [...names].sort();
 }
 function row(t: LWProcess.Track, i: number): string {
  const p = `track.${i}`, id = `tune-track-${i}`;
  return `<fieldset class="de-card" id="${id}" data-track="${i}"><legend>Measure ${i + 1}</legend><div class="de-errs" id="${id}-err" data-errs="${p}"></div>
   <div class="de-grid">${F.text(id + '-field', 'Case field to measure', p + '.field', t.field, {max: 64, hint: HINT, help: 'The name of a number kept on each case.'}).replace('<input ', '<input list="tune-track-fields" autocomplete="off" ')}
   ${F.text(id + '-label', 'Name shown (optional)', p + '.label', t.label, {max: 40, help: 'Up to 40 characters. Without it the field name is shown.'})}</div>
   <button type="button" class="de-mini de-remove" data-act="track-remove" data-i="${i}" aria-label="Remove measure ${i + 1}${t.field ? ' ' + esc(t.field) : ''}">Remove</button></fieldset>`;
 }
 function trackMarkup(def: LWProcess.Definition): string {
  const list = def.track ?? [], full = list.length >= LIMIT, names = suggestions(def);
  return `<section class="de-sec" aria-labelledby="tune-h-track"><h4 id="tune-h-track" tabindex="-1">Tracked measures</h4><div class="de-errs" id="tune-track-err" data-errs="track"></div>
   <p class="de-help" id="tune-track-help">The simulation averages these values when cases finish and at every step, to draw the measured curve. Choose up to ${LIMIT} number fields, for example a mood score or a satisfaction rating.</p>
   <datalist id="tune-track-fields">${names.map(n => `<option value="${esc(n)}"></option>`).join('')}</datalist>
   ${list.map(row).join('') || '<p class="de-help">No measures are tracked.</p>'}
   <button type="button" class="de-add" id="tune-track-add" data-act="track-add"${full ? ' disabled aria-describedby="tune-track-full"' : ''}>Add measure</button>${full ? `<span class="de-help" id="tune-track-full">At most ${LIMIT} measures are tracked.</span>` : ''}</section>`;
 }
 function special(def: LWProcess.Definition, el: HTMLElement): Result | null {
  if (el.dataset.path !== 'genre') return null;
  const value = (el as HTMLSelectElement).value;
  if (value === 'process') delete def.genre; else def.genre = value as LWProcess.Genre;
  return {write: true, rerender: true, focus: '#tune-genre'};
 }
 type Result = LWProcessTuningTrack.Result;
 function act(def: LWProcess.Definition, button: HTMLElement): Result | null {
  const what = button.dataset.act;
  if (what === 'track-add') {
   const list = (def.track ??= []);
   if (list.length >= LIMIT) return null;
   const taken = new Set(list.map(t => t.field)), pick = suggestions(def).find(n => !taken.has(n));
   let n = list.length + 1; while (taken.has('measure' + n)) n++;
   list.push({field: pick ?? 'measure' + n}); return {write: true, rerender: true, focus: `#tune-track-${list.length - 1}-field`};
  }
  if (what === 'track-remove') {
   def.track?.splice(Number(button.dataset.i), 1); if (!def.track?.length) delete def.track;
   return {write: true, rerender: true, focus: '#tune-track-add'};
  }
  return null;
 }
 root.LWProcessTuningTrack = {genreMarkup, trackMarkup, suggestions, special, act, LIMIT};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessTuningTrack;
})(globalThis);
