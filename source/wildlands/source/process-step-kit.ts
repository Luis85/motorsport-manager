/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-html.ts" />
/// <reference path="./process-step-model.ts" />
/**
 * The step editor's control kit (owner: the authoring package; split out of LWProcessStepSections): the pure builders of every
 * form control the step editor sections render (field, select, check, radios, typed value editor, section, button and error slot).
 * It owns the stable element id scheme (`se-<bind with dots as dashes>`) and the error slots (`data-errs`, id `se-err-<key>`), so
 * the basic, BPMN-class (LWProcessStepLogicSections) and path (LWProcessStepFlows) sections all build controls the editor,
 * its problems view and its undo history can find again. It renders strings only; it never touches the DOM, a session or storage.
 *
 * Escaping: every free-text value goes through LWProcessHtml (`esc`), and only finite numbers reach `value`, `min` and `max` of a
 * number input (`num` for bounds, `numberValue` for the form text), because a draft is only shape-checked JSON.
 */
declare namespace LWProcessStepKit {
 interface Opt {
  type?: 'number' | undefined; min?: number; max?: number; step?: string; help?: string; long?: boolean; desc?: string;
  placeholder?: string; autofocus?: boolean; maxlength?: number; counter?: string; badge?: string | undefined; list?: string | undefined;
 }
 interface Api {
  /** LWProcessHtml's `esc`, kept on the kit for the sections that build markup with it. */
  esc(v: unknown): string; slug(bind: string): string; idOf(bind: string): string;
  field(bind: string, label: string, value: string, o?: Opt): string;
  /** `blocked` is the id of a visible explanation: the select is then disabled and described by it. */
  select(bind: string, label: string, options: [string, string][], value: string, rerender?: boolean, help?: string, blocked?: string): string;
  check(bind: string, label: string, on: boolean): string;
  radios(bind: string, legend: string, options: [string, string][], value: string): string;
  valueEditor(bind: string, v: LWProcessStepModel.Value, desc: string, about?: string): string;
  section(id: string, title: string, intro: string, body: string): string;
  button(act: string, label: string, i?: number, extra?: string, aria?: string): string;
  err(key: string): string;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessHtml: LWProcessHtml.Api; LWProcessStepKit?: LWProcessStepKit.Api};
 type Opt = LWProcessStepKit.Opt;
 const {esc, num} = root.LWProcessHtml;
 const slug = (bind: string) => bind.replace(/\./g, '-'), idOf = (bind: string) => 'se-' + slug(bind);
 const TYPES: [string, string][] = [['text', 'Text'], ['number', 'Number'], ['true', 'True'], ['false', 'False'], ['null', 'Empty (null)']];
 /** A min or max attribute. Bounds may come from the draft (a pool's capacity), so only a finite number is written. */
 const bound = (name: string, n: unknown) => num(n) ? ` ${name}="${num(n)}"` : '';
 /**
  * The value of a number input: the form text when it reads as a finite number, else ''. The text comes from a draft that is
  * only shape-checked JSON, so anything else (pasted markup, "NaN") never reaches the attribute; a browser would show '' for it
  * anyway.
  */
 const numberValue = (text: string) => text.trim() !== '' && Number.isFinite(Number(text)) ? esc(text) : '';
 const err = (key: string) => `<div class="se-errs" data-errs="${key}" id="se-err-${slug(key)}"></div>`;
 /** The control of a field: a textarea for long text, a number input or a text input. */
 function control(attrs: string, value: string, o: Opt): string {
  if (o.long) return `<textarea ${attrs} rows="${o.maxlength === undefined ? 3 : 2}" maxlength="${o.maxlength ?? 2000}">${esc(value)}</textarea>`;
  if (o.type === 'number') {
   return `<input ${attrs} type="number" inputmode="numeric" step="${o.step ?? '1'}"${bound('min', o.min)}${bound('max', o.max)}`
    + ` value="${numberValue(value)}">`;
  }
  return `<input ${attrs} type="text" maxlength="${o.maxlength ?? 256}" value="${esc(value)}">`;
 }
 function field(bind: string, label: string, value: string, o: Opt = {}): string {
  const id = idOf(bind);
  const desc = [o.help ? id + '-help' : '', o.counter ?? '', o.desc ?? ''].filter(Boolean).join(' ');
  const ph = o.placeholder ? ` placeholder="${esc(o.placeholder)}"` : '';
  const attrs = `id="${id}" data-bind="${bind}"${desc ? ` aria-describedby="${desc}"` : ''}${ph}${o.autofocus ? ' autofocus' : ''}`
   + (o.list ? ` list="${o.list}" autocomplete="off"` : '');
  const badge = o.badge ? ` <span class="se-badge">${esc(o.badge)}</span>` : '';
  const help = o.help ? `<p class="se-help" id="${id}-help">${esc(o.help)}</p>` : '';
  const counter = o.counter ? `<p class="se-help se-count" id="${o.counter}"></p>` : '';
  return `<div class="se-field"><label for="${id}">${esc(label)}${badge}</label>${control(attrs, value, o)}${help}${counter}</div>`;
 }
 function select(bind: string, label: string, options: [string, string][], value: string, rerender = false, help = '', blocked = ''): string {
  const id = idOf(bind);
  let described = '';
  if (blocked) described = ` disabled aria-describedby="${blocked}"`;
  else if (help) described = ` aria-describedby="${id}-help"`;
  const items = options.map(([v, t]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(t)}</option>`).join('');
  return `<div class="se-field"><label for="${id}">${esc(label)}</label>`
   + `<select id="${id}" data-bind="${bind}"${rerender ? ' data-rerender' : ''}${described}>${items}</select>`
   + (help ? `<p class="se-help" id="${id}-help">${esc(help)}</p>` : '') + '</div>';
 }
 const check = (bind: string, label: string, on: boolean) =>
  `<label class="se-check"><input type="checkbox" id="${idOf(bind)}" data-bind="${bind}" data-rerender${on ? ' checked' : ''}> ${esc(label)}</label>`;
 function radios(bind: string, legend: string, options: [string, string][], value: string): string {
  const id = idOf(bind);
  const items = options.map(([v, t]) => `<label class="se-check"><input type="radio" name="${id}" id="${id}-${v}" data-bind="${bind}" data-rerender`
   + ` value="${v}"${v === value ? ' checked' : ''}> ${esc(t)}</label>`).join('');
  return `<fieldset class="se-radios"><legend>${esc(legend)}</legend>${items}</fieldset>`;
 }
 /** A typed scalar: its type select, plus a text or number field for text and number values. */
 function valueEditor(bind: string, v: LWProcessStepModel.Value, desc: string, about = ''): string {
  const type = select(bind + '.type', 'Type of value' + about, TYPES, v.type, true);
  if (v.type !== 'text' && v.type !== 'number') return type;
  const number = v.type === 'number';
  return type + field(bind + '.text', 'Value' + about, v.text, {type: number ? 'number' : undefined, step: 'any', desc, placeholder: number ? '0' : ''});
 }
 const section = (id: string, title: string, intro: string, body: string) =>
  `<section class="se-section" aria-labelledby="se-h-${id}"><h3 id="se-h-${id}">${esc(title)}</h3>`
  + (intro ? `<p class="se-help">${esc(intro)}</p>` : '') + `${body}</section>`;
 function button(act: string, label: string, i?: number, extra = '', aria = ''): string {
  const index = i === undefined ? '' : ` data-i="${i}"`;
  const name = aria ? ` aria-label="${esc(aria)}"` : '';
  return `<button type="button" data-act="${act}"${index}${name}${extra}>${esc(label)}</button>`;
 }
 root.LWProcessStepKit = {esc, slug, idOf, field, select, check, radios, valueEditor, section, button, err};
})(globalThis);
