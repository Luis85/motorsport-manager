/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-tuning-fields.ts" />
/**
 * The arrivals part of the Definition editor's tuning form: end rule (count, until, open), first arrival, planning interval,
 * the optional random gap, arrival data fields and arrival draws. `markup` renders one arrival; `special` and `act` apply the
 * edits that change structure (they mutate the detached draft object they are given and never touch the DOM or the draft store).
 */
declare namespace LWProcessTuningArrivals {
 /** What the form should do after an edit: write the draft, rebuild the markup, move focus, or show a local problem instead. */
 interface Result {write: boolean; rerender: boolean; focus?: string; local?: [string, string]}
 interface Api {
  markup(a: LWProcess.Arrival, index: number, total: number): string;
  /** Edits that need more than "set this path to this value"; null when the control is a plain field. */
  special(def: LWProcess.Definition, el: HTMLElement): Result | null;
  /** A click on an add/remove button (`data-act`). */
  act(def: LWProcess.Definition, button: HTMLElement): Result | null;
  newArrival(): LWProcess.Arrival;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessTuningFields: LWProcessTuningFields.Api; LWProcessTuningArrivals?: LWProcessTuningArrivals.Api};
 const F = root.LWProcessTuningFields, esc = F.esc, MINUTES = 100000;
 type Result = LWProcessTuningArrivals.Result;
 const NAME = /^[a-z][a-zA-Z0-9_]{0,63}$/, SAFE = /^[A-Za-z0-9_]+$/, NAME_HINT = 'Start with a lowercase letter, then letters, digits or underscores (up to 64).';
 const DISTS: [string, string][] = [['none', 'None (exact spacing)'], ['uniform', 'Uniform (min to max)'], ['triangular', 'Triangular (min, most likely, max)'], ['exponential', 'Exponential (average, optional cap)']];
 const KINDS: [string, string][] = [['chance', 'Chance (happens or not)'], ['choice', 'Weighted choice'], ['int', 'Whole number in a range']];
 const mins = (id: string, label: string, path: string, value: number | undefined, extra: {optional?: boolean; help?: string} = {}) => F.int(id, label, path, value, {min: 1, max: MINUTES, unit: 'minutes', ...extra});
 function gap(a: LWProcess.Arrival, p: string, id: string): string {
  const g = a.gap, d = g?.dist ?? 'none';
  const params = d === 'uniform' ? mins(id + '-min', 'Shortest gap', p + '.gap.min', g?.min) + mins(id + '-max', 'Longest gap', p + '.gap.max', g?.max)
   : d === 'triangular' ? mins(id + '-min', 'Shortest gap', p + '.gap.min', g?.min) + mins(id + '-mode', 'Most likely gap', p + '.gap.mode', g?.mode) + mins(id + '-max', 'Longest gap', p + '.gap.max', g?.max)
   : d === 'exponential' ? mins(id + '-mean', 'Average gap', p + '.gap.mean', g?.mean) + mins(id + '-max', 'Longest gap (optional cap)', p + '.gap.max', g?.max, {optional: true}) : '';
  return F.choice(id + '-dist', 'Random gap between arrivals', p + '.gap.dist', d, DISTS, 'With a random gap, the planning interval above is the average spacing and each gap is drawn from this distribution.')
   + (params ? `<div class="de-grid de-gap-params" role="group" aria-label="Random gap values (minutes)">${params}</div>` : '') + `<div class="de-errs" id="${id}-group-err" data-errs="${esc(p)}.gap"></div>`;
 }
 function dataRows(a: LWProcess.Arrival, p: string, id: string): string {
  const rows = Object.entries(a.data ?? {}).map(([name, value], n) => {
   const key = `${p}.data.${name}`, rid = `${id}-data-${n}`;
   if (!SAFE.test(name)) return `<div class="de-row"><p class="de-help">Field "${esc(name)}" has characters the form cannot edit. Change it in Raw JSON.</p></div>`;
   return `<div class="de-row">${F.text(rid + '-name', 'Field name', key, name, {max: 64, hint: NAME_HINT}).replace('data-kind="text"', 'data-kind="data-name" data-from="' + esc(name) + '" data-i="' + n + '"')}${F.scalar(rid + '-value', 'Value', key, value, false)}<button type="button" class="de-mini" data-act="data-remove" data-name="${esc(name)}" aria-label="Remove field ${esc(name)}">Remove</button></div>`;
  }).join('');
  return `<h5 id="${id}-data-h">Case data given at arrival</h5><p class="de-help">Each case starts with these fields; steps can read them in needs and conditions.</p>${rows}<button type="button" class="de-add" data-act="data-add">Add data field</button>`;
 }
 function draws(a: LWProcess.Arrival, p: string, id: string): string {
  const rows = (a.draws ?? []).map((d, k) => {
   const dp = `${p}.draws.${k}`, did = `${id}-draw-${k}`;
   const body = d.kind === 'chance' ? `<div class="de-grid">${F.int(did + '-percent', 'Chance of happening', dp + '.percent', d.percent, {min: 0, max: 100, unit: '%'})}${F.scalar(did + '-true', 'Value when it happens', dp + '.whenTrue', d.whenTrue, true)}${F.scalar(did + '-false', 'Value when it does not', dp + '.whenFalse', d.whenFalse, true)}</div>`
    : d.kind === 'int' ? `<div class="de-grid">${F.int(did + '-min', 'Lowest value', dp + '.min', d.min, {min: -1000000000, max: 1000000000})}${F.int(did + '-max', 'Highest value', dp + '.max', d.max, {min: -1000000000, max: 1000000000})}</div>`
    : `<div class="de-values">${(d.values ?? []).map((v, j) => `<div class="de-row">${F.scalar(`${did}-v${j}`, `Choice ${j + 1}`, `${dp}.values.${j}.value`, v.value, false)}${F.int(`${did}-w${j}`, `Weight of choice ${j + 1}`, `${dp}.values.${j}.weight`, v.weight, {min: 1, max: 1000, help: 'Higher weight, more often.'})}<button type="button" class="de-mini" data-act="value-remove" data-k="${k}" data-j="${j}" aria-label="Remove choice ${j + 1}">Remove</button></div>`).join('')}<button type="button" class="de-add" data-act="value-add" data-k="${k}">Add choice</button></div><div class="de-errs" id="${did}-values-err" data-errs="${dp}.values"></div>`;
   return `<fieldset class="de-card de-sub"><legend>Random field ${k + 1}</legend><div class="de-grid">${F.text(did + '-field', 'Field name', dp + '.field', d.field, {max: 64, hint: NAME_HINT})}${F.choice(did + '-kind', 'Kind of draw', dp + '.kind', d.kind, KINDS)}</div>${body}<div class="de-errs" id="${did}-err2" data-errs="${dp}"></div><button type="button" class="de-mini" data-act="draw-remove" data-k="${k}">Remove random field ${k + 1}</button></fieldset>`;
  }).join('');
  return `<h5 id="${id}-draws-h">Random case fields</h5><p class="de-help">Each arriving case gets these fields drawn from the seed. The same seed gives the same values.</p>${rows}<button type="button" class="de-add" data-act="draw-add">Add random field</button>`;
 }
 function markup(a: LWProcess.Arrival, i: number, total: number): string {
  const p = `arrivals.${i}`, id = `tune-arr-${i}`, rule = a.open ? 'open' : a.until !== undefined ? 'until' : 'count';
  const ends: [string, string][] = [['count', 'Fixed number of cases'], ['until', 'Until a minute'], ['open', 'Keeps arriving (open stream)']];
  const radios = `<fieldset class="de-radios" id="${id}-end-set" aria-describedby="${id}-end-err"><legend>How this stream ends</legend>${ends.map(([v, name]) => `<label class="de-radio"><input type="radio" name="${id}-end" id="${id}-end-${v}" data-path="${p}.end" data-kind="end" value="${v}"${rule === v ? ' checked' : ''}> ${esc(name)}</label>`).join('')}<div class="de-errs" id="${id}-end-err" data-errs="${p}.end"></div></fieldset>`;
  const value = rule === 'count' ? F.int(id + '-count', 'Number of cases', p + '.count', a.count, {min: 1, max: 200, unit: 'cases'})
   : rule === 'until' ? F.int(id + '-until', 'Last arrival minute', p + '.until', a.until, {min: 1, max: MINUTES, unit: 'minutes', help: 'Cases stop arriving after this minute. It must be later than the first arrival.'})
   : '<p class="de-help">Cases keep arriving for as long as the run lasts. The run length (Run until) ends it.</p>';
  return `<fieldset class="de-card" id="${id}" data-arrival="${i}"><legend>Arrival ${i + 1}</legend><div class="de-errs" id="${id}-err" data-errs="${p}"></div>${radios}<div class="de-grid">${value}${F.int(id + '-at', 'First arrival', p + '.at', a.at, {min: 0, max: MINUTES, unit: 'minute'})}${F.int(id + '-interval', 'Planning interval', p + '.interval', a.interval, {min: 0, max: MINUTES, unit: 'minutes', help: 'Exact time between arrivals, or the average when a random gap is chosen. 0 means all at once.'})}</div>${gap(a, p, id + '-gap')}${dataRows(a, p, id)}${draws(a, p, id)}<button type="button" class="de-mini de-remove" data-act="arr-remove" data-i="${i}"${total < 2 ? ' disabled title="A process needs at least one arrival."' : ''}>Remove arrival ${i + 1}</button></fieldset>`;
 }
 const unique = (taken: Iterable<string>, base: string) => { const set = new Set(taken); let n = 1; while (set.has(base + n)) n++; return base + n; };
 const DEFAULTS: Record<string, () => LWProcess.Draw> = {
  chance: () => ({field: '', kind: 'chance', percent: 50, whenTrue: true, whenFalse: false}),
  choice: () => ({field: '', kind: 'choice', values: [{value: 'a', weight: 1}, {value: 'b', weight: 1}]}),
  int: () => ({field: '', kind: 'int', min: 1, max: 10}),
 };
 const newArrival = (): LWProcess.Arrival => ({at: 0, count: 5, interval: 10, data: {}});
 function special(def: LWProcess.Definition, el: HTMLElement): Result | null {
  const path = el.dataset.path ?? '', kind = el.dataset.kind, parts = path.split('.'), a = def.arrivals?.[Number(parts[1])];
  if (parts[0] !== 'arrivals' || !a) return null;
  const id = `tune-arr-${parts[1]}`;
  if (kind === 'end') {
   const v = (el as HTMLInputElement).value, after = Math.max(a.at + Math.max(a.interval, 1) * 10, a.at + 1);
   const keep = {at: a.at, interval: a.interval, gap: a.gap, draws: a.draws, data: a.data}; for (const k of Object.keys(a)) delete (a as unknown as Record<string, unknown>)[k];
   Object.assign(a, {at: keep.at}, v === 'count' ? {count: 5} : v === 'until' ? {until: Math.min(after, MINUTES)} : {open: true}, {interval: keep.interval}, keep.gap ? {gap: keep.gap} : {}, keep.draws ? {draws: keep.draws} : {}, {data: keep.data});
   return {write: true, rerender: true, focus: `#${id}-end-${v}`};
  }
  if (kind === 'choice' && parts[2] === 'gap') {
   const v = (el as HTMLSelectElement).value;
   if (v === 'none') delete a.gap; else a.gap = v === 'uniform' ? {dist: 'uniform', min: 1, max: Math.max(a.interval * 2, 2)} : v === 'triangular' ? {dist: 'triangular', min: 1, mode: Math.max(a.interval, 1), max: Math.max(a.interval * 2, 2)} : {dist: 'exponential', mean: Math.max(a.interval, 1)};
   if (v !== 'none' && a.interval < 1) a.interval = Math.max(a.gap!.mean ?? a.gap!.mode ?? a.gap!.max ?? 1, 1);
   return {write: true, rerender: true, focus: `#${id}-gap-dist`};
  }
  if (kind === 'choice' && parts[2] === 'draws' && parts[4] === 'kind') {
   const k = Number(parts[3]), d = a.draws?.[k]; if (!d) return null;
   a.draws![k] = {...DEFAULTS[(el as HTMLSelectElement).value]!(), field: d.field}; return {write: true, rerender: true, focus: `#${id}-draw-${k}-kind`};
  }
  if (kind === 'data-name') {
   const from = el.dataset.from!, name = (el as HTMLInputElement).value, data = a.data;
   if (name === from) return {write: false, rerender: false};
   if (!NAME.test(name)) return {write: false, rerender: false, local: [path, name ? NAME_HINT : 'Name the field, or remove this row.']};
   if (Object.hasOwn(data, name)) return {write: false, rerender: false, local: [path, `A field named ${name} already exists.`]};
   a.data = Object.fromEntries(Object.entries(data).map(([k, v]) => [k === from ? name : k, v])); return {write: true, rerender: true, focus: `#${id}-data-${el.dataset.i}-name`};
  }
  return null;
 }
 function act(def: LWProcess.Definition, button: HTMLElement): Result | null {
  const what = button.dataset.act, i = Number(button.closest<HTMLElement>('[data-arrival]')?.dataset.arrival ?? button.dataset.i), a = def.arrivals?.[i], k = Number(button.dataset.k), j = Number(button.dataset.j);
  if (what === 'arr-add') { def.arrivals.push(newArrival()); return {write: true, rerender: true, focus: `#tune-arr-${def.arrivals.length - 1}-count`}; }
  if (!a) return null;
  if (what === 'arr-remove') { def.arrivals.splice(i, 1); return {write: true, rerender: true, focus: '#tune-arr-add'}; }
  if (what === 'data-add') { const name = unique(Object.keys(a.data), 'field'); a.data[name] = ''; return {write: true, rerender: true, focus: `#tune-arr-${i}-data-${Object.keys(a.data).length - 1}-name`}; }
  if (what === 'data-remove') { delete a.data[button.dataset.name!]; return {write: true, rerender: true, focus: `#tune-arr-${i}-data-h`}; }
  if (what === 'draw-add') { (a.draws ??= []).push({...DEFAULTS.chance!(), field: unique((a.draws ?? []).map(d => d.field).concat(Object.keys(a.data)), 'random')}); return {write: true, rerender: true, focus: `#tune-arr-${i}-draw-${a.draws.length - 1}-field`}; }
  if (what === 'draw-remove') { a.draws?.splice(k, 1); if (!a.draws?.length) delete a.draws; return {write: true, rerender: true, focus: `#tune-arr-${i}-draws-h`}; }
  if (what === 'value-add') { const d = a.draws?.[k]; if (!d) return null; (d.values ??= []).push({value: unique(d.values.map(v => String(v.value)), 'choice'), weight: 1}); return {write: true, rerender: true, focus: `#tune-arr-${i}-draw-${k}-v${d.values.length - 1}-type`}; }
  if (what === 'value-remove') { a.draws?.[k]?.values?.splice(j, 1); return {write: true, rerender: true, focus: `#tune-arr-${i}-draw-${k}-kind`}; }
  return null;
 }
 root.LWProcessTuningArrivals = {markup, special, act, newArrival};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessTuningArrivals;
})(globalThis);
