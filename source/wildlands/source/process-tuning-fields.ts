/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-html.ts" />
/**
 * Markup and value helpers shared by the Definition editor's tuning form (process, resources) and its arrivals editor.
 * Every control carries `data-path` (the dot path it edits in the draft, e.g. `arrivals.0.gap.min`) and `data-kind`
 * (`int`, `text`, `choice`, `scalar-type`, `scalar`); every field has an error slot `data-errs` with the same key so the
 * engine's diagnostics can be shown beside it. Nothing here touches the DOM beyond building markup.
 * Markup is built with LWProcessHtml's `html` template (every value escaped; a number reaches `value`, `min` or `max` only
 * when it is finite) and returned as `LWProcessHtml.Safe`, so the tuning modules compose it with `html` without escaping it
 * twice. The rendered markup is the same as when each module escaped its own values.
 */
declare namespace LWProcessTuningFields {
 type Scalar = LWProcess.Scalar;
 type Safe = LWProcessHtml.Safe;
 interface IntOptions {min: number; max: number; optional?: boolean; help?: string; unit?: string}
 /** `kind` replaces the control's `data-kind` (default `text`); `attrs` adds attributes built with `html` (e.g. ` list="…"`). */
 interface TextOptions {max?: number; help?: string; hint?: string; long?: boolean; kind?: string; attrs?: Safe}
 interface Api {
  /** A slug usable inside an element id. */
  slug(path: string): string;
  /** Wraps a control with label, optional help and the error slot for `path`. */
  field(id: string, label: string, control: Safe, path: string, help?: string, extra?: string): Safe;
  int(id: string, label: string, path: string, value: number | undefined, o: IntOptions): Safe;
  text(id: string, label: string, path: string, value: string | undefined, o?: TextOptions): Safe;
  choice(id: string, label: string, path: string, value: string, options: [string, string][], help?: string): Safe;
  /** A typed value: a type select plus a value control. `optional` adds a "Not set" type. */
  scalar(id: string, label: string, path: string, value: Scalar | undefined, optional: boolean): Safe;
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
 const root = inputRoot as {LWProcessHtml: LWProcessHtml.Api; LWProcessTuningFields?: LWProcessTuningFields.Api};
 const {html, num} = root.LWProcessHtml;
 type Safe = LWProcessHtml.Safe;
 const slug = (path: string) => path.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
 function field(id: string, label: string, control: Safe, path: string, help = '', extra = ''): Safe {
  const helpText = help ? html`<p class="de-help" id="${id}-help">${help}</p>` : '';
  const errors = html`<div class="de-errs" id="${id}-err" data-errs="${path}"></div>`;
  return html`<div class="de-field ${extra}"><label for="${id}">${label}</label>${control}${helpText}${errors}</div>`;
 }
 const describe = (id: string, help?: string) => html`aria-describedby="${help ? id + '-help ' : ''}${id}-err"`;
 // Numbers taken from the draft go through `num`: the draft is only shape-checked JSON, so a "number" may be any value a person
 // pasted. Only a finite number is written; anything else becomes an empty attribute and never markup.
 function int(id: string, label: string, path: string, value: number | undefined, o: LWProcessTuningFields.IntOptions): Safe {
  const unit = o.unit ? ` (${o.unit})` : '', range = `${o.min.toLocaleString('en-US')} to ${o.max.toLocaleString('en-US')}`;
  const attrs = html`id="${id}" type="number" inputmode="numeric" step="1" min="${num(o.min)}" max="${num(o.max)}" data-path="${path}" data-kind="int"`;
  const input = html`<input ${attrs}${o.optional ? html` data-optional="1"` : ''} value="${num(value)}" ${describe(id, o.help ?? range)}>`;
  return field(id, label + unit, input, path, o.help ?? `Whole number, ${range}.`);
 }
 function text(id: string, label: string, path: string, value: string | undefined, o: LWProcessTuningFields.TextOptions = {}): Safe {
  const hint = o.hint ? html` data-hint="${o.hint}"` : '';
  const kind = html`data-kind="${o.kind ?? 'text'}"${o.attrs ?? ''}`;
  const attrs = html`id="${id}" data-path="${path}" ${kind} maxlength="${num(o.max ?? 120)}"${hint} ${describe(id, o.help)}`;
  const control = o.long ? html`<textarea ${attrs} rows="3">${value ?? ''}</textarea>` : html`<input ${attrs} type="text" value="${value ?? ''}">`;
  return field(id, label, control, path, o.help);
 }
 function choice(id: string, label: string, path: string, value: string, options: [string, string][], help?: string): Safe {
  const items = options.map(([v, name]) => html`<option value="${v}"${v === value ? html` selected` : ''}>${name}</option>`);
  return field(id, label, html`<select id="${id}" data-path="${path}" data-kind="choice" ${describe(id, help)}>${items}</select>`, path, help);
 }
 const typeOf = (v: LWProcess.Scalar | undefined) => v === undefined ? 'unset' : v === null ? 'null' : typeof v === 'boolean' ? 'boolean' : typeof v === 'number' ? 'number' : 'string';
 /** The value control of a scalar editor for its current type; a value that is not set or empty has only a note. */
 function scalarControl(id: string, label: string, path: string, value: LWProcess.Scalar | undefined, type: string): Safe {
  if (type === 'boolean') {
   const yes = value === true ? html` selected` : '', no = value === false ? html` selected` : '';
   const options = html`<option value="true"${yes}>Yes</option><option value="false"${no}>No</option>`;
   return html`<select id="${id}" data-path="${path}" data-kind="scalar" aria-label="${label} value">${options}</select>`;
  }
  if (type === 'number') {
   const bind = html`data-path="${path}" data-kind="scalar" aria-label="${label} value"`;
   return html`<input id="${id}" type="number" step="1" inputmode="numeric" ${bind} value="${num(value)}">`;
  }
  if (type === 'string') {
   return html`<input id="${id}" type="text" maxlength="256" data-path="${path}" data-kind="scalar" aria-label="${label} value" value="${value as string}">`;
  }
  return html`<span class="de-none">${type === 'null' ? 'Empty (no value)' : 'Not set'}</span>`;
 }
 function scalar(id: string, label: string, path: string, value: LWProcess.Scalar | undefined, optional: boolean): Safe {
  const type = typeOf(value), unset: [string, string][] = optional ? [['unset', 'Not set']] : [];
  const types: [string, string][] = [...unset, ['string', 'Text'], ['number', 'Number'], ['boolean', 'Yes or no'], ['null', 'Empty']];
  const options = types.map(([v, name]) => html`<option value="${v}"${v === type ? html` selected` : ''}>${name}</option>`);
  const select = html`<select id="${id}-type" data-path="${path}" data-kind="scalar-type" aria-label="${label} type">${options}</select>`;
  const pair = html`<div class="de-pair">${select}${scalarControl(id, label, path, value, type)}</div>`;
  const errors = html`<div class="de-errs" id="${id}-err" data-errs="${path}"></div>`;
  return html`<div class="de-field de-scalar"><span class="de-label" id="${id}-label">${label}</span>${pair}${errors}</div>`;
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
 root.LWProcessTuningFields = {slug, field, int, text, choice, scalar, coerce, keyOf, plain};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessTuningFields;
})(globalThis);
