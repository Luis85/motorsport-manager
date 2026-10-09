/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-tuning-fields.ts" />
/**
 * The SIPOC part of the Definition editor's tuning form: the named suppliers and customers of a process. Inputs, process stages and
 * outputs are derived from the process itself, so only the two outside parties are written. `markup` renders the rows with their
 * error slots; `act` applies Add and Remove to the detached draft object it is given and keeps `sipoc` out of the definition while
 * both lists are empty. Descriptive only: no runtime effect. Nothing here touches the DOM, the draft store or a session.
 */
declare namespace LWProcessTuningSipoc {
 interface Result {write: boolean; rerender: boolean; focus?: string}
 interface Api {
  /** The 'Suppliers and customers (SIPOC)' section. */
  markup(def: LWProcess.Definition): string;
  /** A click on an Add or Remove button of a party row; null for other buttons. */
  act(def: LWProcess.Definition, button: HTMLElement): Result | null;
  /** True for the optional detail path of a party (`sipoc.suppliers.0.supplies`), which is removed instead of written empty. */
  isDetail(path: string): boolean;
  /** The most parties per list. */
  LIMIT: number;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessTuningFields: LWProcessTuningFields.Api; LWProcessTuningSipoc?: LWProcessTuningSipoc.Api};
 const F = root.LWProcessTuningFields, esc = F.esc, LIMIT = 8;
 type Key = 'suppliers' | 'customers';
 const KINDS: Record<Key, {noun: string; heading: string; detail: 'supplies' | 'receives'; detailLabel: string; help: string; empty: string}> = {
  suppliers: {noun: 'Supplier', heading: 'Suppliers', detail: 'supplies', detailLabel: 'What they supply (optional, up to 160 characters)', help: 'Who or what provides the inputs, for example a payment provider.', empty: 'No suppliers are named.'},
  customers: {noun: 'Customer', heading: 'Customers', detail: 'receives', detailLabel: 'What they receive (optional, up to 160 characters)', help: 'Who receives the outputs, for example the shopper or the business.', empty: 'No customers are named.'},
 };
 const KEYS: Key[] = ['suppliers', 'customers'];
 function row(key: Key, p: LWProcess.Party, i: number): string {
  const k = KINDS[key], path = `sipoc.${key}.${i}`, id = `tune-sipoc-${key}-${i}`;
  return `<fieldset class="de-card" id="${id}" data-sipoc="${key}.${i}"><legend>${k.noun} ${i + 1}</legend><div class="de-errs" id="${id}-err" data-errs="${path}"></div>
   <div class="de-grid">${F.text(id + '-name', `Name (up to 60 characters)`, path + '.name', p.name, {max: 60})}
   ${F.text(id + '-detail', k.detailLabel, `${path}.${k.detail}`, p[k.detail], {max: 160})}</div>
   <button type="button" class="de-mini de-remove" data-act="sipoc-remove" data-list="${key}" data-i="${i}" aria-label="Remove ${k.noun.toLowerCase()} ${i + 1}${p.name ? ' ' + esc(p.name) : ''}">Remove</button></fieldset>`;
 }
 function list(def: LWProcess.Definition, key: Key): string {
  const k = KINDS[key], items = def.sipoc?.[key] ?? [], full = items.length >= LIMIT;
  return `<div class="de-sipoc-list" role="group" aria-labelledby="tune-sipoc-${key}-h"><h5 id="tune-sipoc-${key}-h">${k.heading}</h5><div class="de-errs" id="tune-sipoc-${key}-err" data-errs="sipoc.${key}"></div>
   <p class="de-help">${k.help}</p>${items.map((p, i) => row(key, p, i)).join('') || `<p class="de-help">${k.empty}</p>`}
   <button type="button" class="de-add" id="tune-sipoc-${key}-add" data-act="sipoc-add" data-list="${key}"${full ? ` disabled aria-describedby="tune-sipoc-${key}-full"` : ''}>Add ${k.noun.toLowerCase()}</button>${full ? `<span class="de-help" id="tune-sipoc-${key}-full">At most ${LIMIT} ${k.heading.toLowerCase()} are listed.</span>` : ''}</div>`;
 }
 function markup(def: LWProcess.Definition): string {
  return `<section class="de-sec" aria-labelledby="tune-h-sipoc"><h4 id="tune-h-sipoc" tabindex="-1">Suppliers and customers (SIPOC)</h4><div class="de-errs" id="tune-sipoc-err" data-errs="sipoc"></div>
   <p class="de-help" id="tune-sipoc-help">Inputs, process stages and outputs are derived automatically from the process; only suppliers and customers need to be written. They appear in the SIPOC view and change nothing in the simulation.</p>${KEYS.map(key => list(def, key)).join('')}</section>`;
 }
 function tidy(def: LWProcess.Definition): void {
  const s = def.sipoc; if (!s) return;
  for (const key of KEYS) if (!s[key]?.length) delete s[key];
  if (!Object.keys(s).length) delete def.sipoc;
 }
 function act(def: LWProcess.Definition, button: HTMLElement): Result | null {
  const what = button.dataset.act, key = button.dataset.list as Key | undefined;
  if (!key || !KEYS.includes(key)) return null;
  const k = KINDS[key];
  if (what === 'sipoc-add') {
   const items = ((def.sipoc ??= {})[key] ??= []);
   if (items.length >= LIMIT) return null;
   const taken = new Set(items.map(p => p.name)); let n = items.length + 1; while (taken.has(`${k.noun} ${n}`)) n++;
   items.push({name: `${k.noun} ${n}`}); return {write: true, rerender: true, focus: `#tune-sipoc-${key}-${items.length - 1}-name`};
  }
  if (what === 'sipoc-remove') {
   def.sipoc?.[key]?.splice(Number(button.dataset.i), 1); tidy(def);
   return {write: true, rerender: true, focus: `#tune-sipoc-${key}-add`};
  }
  return null;
 }
 type Result = LWProcessTuningSipoc.Result;
 root.LWProcessTuningSipoc = {markup, act, isDetail: path => /^sipoc\.(suppliers|customers)\.\d+\.(supplies|receives)$/.test(path), LIMIT};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessTuningSipoc;
})(globalThis);
