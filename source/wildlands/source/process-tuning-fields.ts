/// <reference path="./process-contracts.d.ts" />
/**
 * Markup and value helpers shared by the Definition editor's tuning form (process, resources) and its arrivals editor.
 * Every control carries `data-path` (the dot path it edits in the draft, e.g. `arrivals.0.gap.min`) and `data-kind`
 * (`int`, `text`, `choice`, `scalar-type`, `scalar`); every field has an error slot `data-errs` with the same key so the
 * engine's diagnostics can be shown beside it. Nothing here touches the DOM beyond building strings.
 */
declare namespace LWProcessTuningFields {
 type Scalar = LWProcess.Scalar;
 interface IntOptions {min: number; max: number; optional?: boolean; help?: string; unit?: string}
 interface Api {
  esc(v: unknown): string;
  /** A slug usable inside an element id. */
  slug(path: string): string;
  /** Wraps a control with label, optional help and the error slot for `path`. */
  field(id: string, label: string, control: string, path: string, help?: string, extra?: string): string;
  int(id: string, label: string, path: string, value: number | undefined, o: IntOptions): string;
  text(id: string, label: string, path: string, value: string | undefined, o?: {max?: number; help?: string; hint?: string; long?: boolean}): string;
  choice(id: string, label: string, path: string, value: string, options: [string, string][], help?: string): string;
  /** A typed value: a type select plus a value control. `optional` adds a "Not set" type. */
  scalar(id: string, label: string, path: string, value: Scalar | undefined, optional: boolean): string;
  /** The value written for a scalar editor change. `undefined` means remove the key. */
  coerce(type: string, current: Scalar | undefined, typed: string): Scalar | undefined;
  /** Diagnostic path '/arrivals/0/gap/min' to key 'arrivals.0.gap.min' (and the end-rule/horizon aliases). */
  keyOf(d: LWProcess.Diagnostic): string;
  /** Readable text for the catalog's terse shape messages, using the control's range or hint. */
  plain(message: string, control: Element | null): string;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessTuningFields?: LWProcessTuningFields.Api};
 const esc = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
 const slug = (path: string) => path.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
 function field(id: string, label: string, control: string, path: string, help = '', extra = ''): string {
  return `<div class="de-field ${extra}"><label for="${id}">${esc(label)}</label>${control}${help ? `<p class="de-help" id="${id}-help">${esc(help)}</p>` : ''}<div class="de-errs" id="${id}-err" data-errs="${esc(path)}"></div></div>`;
 }
 const describe = (id: string, help?: string) => `aria-describedby="${help ? id + '-help ' : ''}${id}-err"`;
 /**
  * Attribute text for a number taken from the draft. The draft is only shape-checked JSON, so a "number" may be any value a
  * person pasted: only a finite number is written, anything else becomes an empty attribute and never markup.
  */
 const num = (value: unknown): string => typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
 function int(id: string, label: string, path: string, value: number | undefined, o: LWProcessTuningFields.IntOptions): string {
  const unit = o.unit ? ` (${o.unit})` : '', range = `${o.min.toLocaleString('en-US')} to ${o.max.toLocaleString('en-US')}`;
  const attrs = `id="${id}" type="number" inputmode="numeric" step="1" min="${num(o.min)}" max="${num(o.max)}" data-path="${esc(path)}" data-kind="int"`;
  const input = `<input ${attrs}${o.optional ? ' data-optional="1"' : ''} value="${num(value)}" ${describe(id, o.help ?? range)}>`;
  return field(id, label + unit, input, path, o.help ?? `Whole number, ${range}.`);
 }
 function text(id: string, label: string, path: string, value: string | undefined, o: {max?: number; help?: string; hint?: string; long?: boolean} = {}): string {
  const attrs = `id="${id}" data-path="${esc(path)}" data-kind="text" maxlength="${o.max ?? 120}"${o.hint ? ` data-hint="${esc(o.hint)}"` : ''} ${describe(id, o.help)}`;
  return field(id, label, o.long ? `<textarea ${attrs} rows="3">${esc(value ?? '')}</textarea>` : `<input ${attrs} type="text" value="${esc(value ?? '')}">`, path, o.help);
 }
 function choice(id: string, label: string, path: string, value: string, options: [string, string][], help?: string): string {
  return field(id, label, `<select id="${id}" data-path="${esc(path)}" data-kind="choice" ${describe(id, help)}>${options.map(([v, name]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select>`, path, help);
 }
 const typeOf = (v: LWProcess.Scalar | undefined) => v === undefined ? 'unset' : v === null ? 'null' : typeof v === 'boolean' ? 'boolean' : typeof v === 'number' ? 'number' : 'string';
 function scalar(id: string, label: string, path: string, value: LWProcess.Scalar | undefined, optional: boolean): string {
  const type = typeOf(value), types: [string, string][] = [...optional ? [['unset', 'Not set'] as [string, string]] : [], ['string', 'Text'], ['number', 'Number'], ['boolean', 'Yes or no'], ['null', 'Empty']];
  const control = type === 'boolean' ? `<select id="${id}" data-path="${esc(path)}" data-kind="scalar" aria-label="${esc(label)} value"><option value="true"${value === true ? ' selected' : ''}>Yes</option><option value="false"${value === false ? ' selected' : ''}>No</option></select>`
   : type === 'number' ? `<input id="${id}" type="number" step="1" inputmode="numeric" data-path="${esc(path)}" data-kind="scalar" aria-label="${esc(label)} value" value="${num(value)}">`
   : type === 'string' ? `<input id="${id}" type="text" maxlength="256" data-path="${esc(path)}" data-kind="scalar" aria-label="${esc(label)} value" value="${esc(value as string)}">`
   : `<span class="de-none">${type === 'null' ? 'Empty (no value)' : 'Not set'}</span>`;
  return `<div class="de-field de-scalar"><span class="de-label" id="${id}-label">${esc(label)}</span><div class="de-pair"><select id="${id}-type" data-path="${esc(path)}" data-kind="scalar-type" aria-label="${esc(label)} type">${types.map(([v, name]) => `<option value="${v}"${v === type ? ' selected' : ''}>${name}</option>`).join('')}</select>${control}</div><div class="de-errs" id="${id}-err" data-errs="${esc(path)}"></div></div>`;
 }
 function coerce(type: string, current: LWProcess.Scalar | undefined, typed: string): LWProcess.Scalar | undefined {
  if (type === 'unset') return undefined;
  if (type === 'null') return null;
  if (type === 'boolean') return current === true || current === false ? current : true;
  if (type === 'number') return typeof current === 'number' ? current : Number.isFinite(Number(typed)) && typed.trim() !== '' ? Math.round(Number(typed)) : 0;
  return current === undefined || current === null ? typed : String(current);
 }
 function keyOf(d: LWProcess.Diagnostic): string {
  const key = d.path.split('/').filter(Boolean).join('.');
  if (/^arrivals\.\d+$/.test(key)) return /end rule/.test(d.message) ? key + '.end' : /horizon/.test(d.message) ? key + '.at' : key;
  return key;
 }
 function plain(message: string, control: Element | null): string {
  const el = control as HTMLInputElement | null;
  if (message === 'Number is out of range.') return el?.min ? `Enter a whole number from ${Number(el.min).toLocaleString('en-US')} to ${Number(el.max).toLocaleString('en-US')}.` : message;
  if (message === 'Expected integer.' || message === 'Expected number.') return 'Enter a whole number.';
  if (message === 'String has invalid length or format.') return el?.dataset.hint ?? (el?.maxLength && el.maxLength > 0 ? `Use 1 to ${el.maxLength} characters.` : message);
  return message;
 }
 root.LWProcessTuningFields = {esc, slug, field, int, text, choice, scalar, coerce, keyOf, plain};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessTuningFields;
})(globalThis);
