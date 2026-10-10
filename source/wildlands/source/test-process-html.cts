/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-html.ts" />
/// <reference path="./process-inspector.ts" />
/**
 * LWProcessHtml, the one escaping module of the studio views, and the inspector values built on it: every interpolation escaped,
 * trust only through a genuine `Safe` value, non-finite numbers refused, the migrated modules free of local escapers, and the
 * inspector's analytics, advisories and calendar wording for a pinned run.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {runtime} from './process-sdk.cjs';
import {test, agency, build, stepOf, flowOf, startEnd} from './test-process-helpers.cjs';
require('./process-html.js');
require('./process-inspector.js');
const H = (globalThis as unknown as {LWProcessHtml: LWProcessHtml.Api}).LWProcessHtml;
const inspector = (globalThis as unknown as {LWProcessInspector: LWProcessInspector.Api}).LWProcessInspector;
const {html, raw, join, esc, attr, num, isSafe} = H;
const HOSTILE = '"><img src=x onerror="globalThis.__pwned = 1">\'&';
/** The escaper every migrated module carried before (kept here as the reference output). */
const legacy = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));

test('LWProcessHtml escapes the five HTML characters exactly as the local escapers it replaces', () => {
 assert.equal(esc(`<a href="x">Tom & Jerry's</a>`), '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;');
 for (const v of [HOSTILE, 'plain', '', 0, -1.5, NaN, true, null, undefined, {}, ['<b>', 2], '&amp;']) assert.equal(esc(v), legacy(v), String(v));
 assert.equal(attr(HOSTILE), legacy(HOSTILE));
 assert.deepEqual([attr(null), attr(undefined), attr(0), attr(false)], ['', '', '0', 'false'], 'attr leaves out only null and undefined');
});

test('LWProcessHtml html escapes every interpolation and trusts only Safe values made by html, raw or join', () => {
 const evil = {toString: () => '<script>x()</script>'};
 const out = String(html`<p title="${HOSTILE}">${HOSTILE}${42}${evil}${[HOSTILE, 7]}${null}${undefined}${false}</p>`);
 assert.equal(out, `<p title="${legacy(HOSTILE)}">${legacy(HOSTILE)}42${legacy(evil)}${legacy(HOSTILE)}7false</p>`);
 assert.doesNotMatch(out, /<img|<script/, 'no element can be created from an interpolated value');
 // Nested html and raw markup are inserted as they are, and arrays join their items by the same rule.
 const inner = html`<b>${HOSTILE}</b>`;
 assert.equal(String(html`<i>${inner}</i>`), `<i><b>${legacy(HOSTILE)}</b></i>`, 'a Safe value is not escaped twice');
 assert.equal(String(html`${[inner, '<u>', raw('<hr>')]}`), `<b>${legacy(HOSTILE)}</b>&lt;u&gt;<hr>`);
 assert.equal(String(join([html`<b>1</b>`, '<2>'], ', ')), '<b>1</b>, &lt;2&gt;');
 assert.equal(String(join(['a', 'b'], html`<br>`)), 'a<br>b');
 assert.equal(`${inner}`, inner.html, 'String() and .html give the same markup');
 // Only values this module made are trusted: look-alikes, copies, prototypes and plain strings are escaped.
 const forged = [{html: '<b>forged</b>', toString: () => '<b>forged</b>'}, {...inner}, Object.create(inner), {html: '<b>'}];
 for (const f of forged) {
  assert.equal(isSafe(f), false);
  assert.doesNotMatch(String(html`${f}`), /<b>/, 'a value that only looks Safe is escaped');
 }
 assert.equal(isSafe(inner) && isSafe(raw('<i>')) && isSafe(join([])), true);
 assert.equal(isSafe('<b>'), false); assert.equal(String(html`${'<b>'}`), '&lt;b&gt;');
 assert.equal(Object.isFrozen(inner), true); assert.throws(() => { (inner as {html: string}).html = '<img>'; }, TypeError, 'Safe markup cannot be rewritten');
 assert.equal(Object.isFrozen(H), true, 'the module cannot be replaced piecemeal');
});

test('LWProcessHtml num admits only finite numbers for value, min and max attributes', () => {
 assert.deepEqual([num(0), num(-3.5), num(1000), num(2147483647), num(1e21)], ['0', '-3.5', '1000', '2147483647', '1e+21']);
 for (const v of [NaN, Infinity, -Infinity, '5', HOSTILE, null, undefined, true, {valueOf: () => 4}, [3], 10n]) assert.equal(num(v), '', String(v));
 assert.equal(String(html`<input value="${num(HOSTILE)}" min="${num(1)}">`), '<input value="" min="1">');
});

test('Tune values and the inspector carry no local escaper; the remaining escapers are listed', () => {
 const dir = path.resolve(__dirname, '../source'), local = /replace\(\/\[&<>"'\]\/g|LWProcessDialog\.escape\(|\besc = F\.esc/;
 const migrated = ['process-tuning.ts', 'process-tuning-fields.ts', 'process-tuning-arrivals.ts', 'process-tuning-track.ts', 'process-tuning-sipoc.ts',
  'process-tuning-calendar.ts', 'process-inspector.ts', 'process-data-view.ts', 'process-definition-structure.ts'];
 for (const file of migrated) {
  const text = fs.readFileSync(path.join(dir, file), 'utf8');
  assert.doesNotMatch(text, local, file + ' has no local escaper'); assert.match(text, /LWProcessHtml/, file + ' uses LWProcessHtml');
 }
 // The modules a later wave still migrates; the list shrinks as they move, and a new local escaper fails here.
 const remaining = fs.readdirSync(dir).filter(f => /^process-.*\.ts$/.test(f) && f !== 'process-html.ts' && local.test(fs.readFileSync(path.join(dir, f), 'utf8'))).sort();
 assert.deepEqual(remaining, ['process-activity.ts', 'process-bpmn-dialog.ts', 'process-bpmn-preview.ts',
  'process-io.ts', 'process-present.ts', 'process-slots.ts', 'process-step-list.ts']);
});

/** A small pinned process: one task on a 2-unit pool with a fixed cost, a biased exponential timing and a display calendar. */
function pinned(calendar?: LWProcess.Calendar): LWProcess.Definition {
 const work = stepOf('work', 'task', {name: 'Review <b>', duration: 2, cost: 7, resources: {crew: 1}, timing: {dist: 'exponential', mean: 2}});
 const d = build(startEnd(work), [flowOf('start', 'work'), flowOf('work', 'end')], [{at: 0, count: 6, interval: 1, data: {}}],
  [{id: 'crew', name: 'Crew & co', capacity: 2, costPerMinute: 2}]);
 return calendar ? {...d, calendar} : d;
}

test('The inspector shows mean wait, the work cost split, pool idle cost, throughput and notes from the read model', () => {
 const d = pinned(), s = runtime.create(d);
 try {
  const zero = {definition: d, snapshot: s.query(), selected: null} as unknown as LWProcessApp.View;
  assert.match(inspector.overview(zero, false), /<dt>Throughput<\/dt><dd>—<\/dd>/, 'no throughput at minute 0');
  const q = s.advance(30), view = {...zero, snapshot: q} as LWProcessApp.View, m = q.steps.find(x => x.id === 'work')!, pool = q.resources[0]!;
  assert(m.starts > 0 && q.metrics.completed > 0, 'the pinned run has started and finished work');
  const step = inspector.step(view, d.steps[1]!), one = (n: number) => Number(n.toFixed(1)).toLocaleString();
  assert.match(step, new RegExp(`<dt>Mean wait per start</dt><dd>${one(m.meanWaitMinutes!)} min</dd>`));
  assert.match(step, new RegExp(`<dt>Work cost</dt><dd>${one(m.workCost)} = ${one(m.fixedCost)} fixed \\+ ${one(m.workCost - m.fixedCost)} for pool minutes</dd>`));
  assert.match(step, /<p class="process-rounding">Whole-minute rounding: an exponential distribution with mean 2 min draws about 2\.2 min on average\.<\/p>/);
  assert.match(step, /<p>Review &lt;b&gt;<\/p>/, 'the step name is text');
  const pools = inspector.pools(view);
  assert.match(pools, new RegExp(`Work cost ${one(pool.workCost)} of ${one(pool.capacityCost)} capacity cost · idle cost ${one(pool.capacityCost - pool.workCost)}`));
  assert.match(pools, /<strong>Crew &amp; co<\/strong>/); assert.match(pools, /Idle cost is capacity cost minus work cost\./);
  const overview = inspector.overview(view, false), rate = Number(q.metrics.throughputPerHour!.toFixed(2)).toLocaleString();
  assert.match(overview, new RegExp(`<dt>Throughput</dt><dd>${rate} ${rate === '1' ? 'case' : 'cases'} finished per business hour</dd>`));
  assert.match(overview, /<h3>Notes<\/h3><ul class="process-adds process-notes" aria-label="Modelling notes"><li>Review &lt;b&gt;, random timing: Whole-minute rounding/);
  // A step without random timing or work starts shows neither the note nor the work analytics.
  const start = inspector.step(view, d.steps[0]!); assert.doesNotMatch(start, /Mean wait per start|process-rounding|Work cost/);
  const plain = {...d, steps: d.steps.map(x => x.id === 'work' ? {...x, timing: undefined} : x)};
  assert.doesNotMatch(inspector.overview({...view, definition: plain} as LWProcessApp.View, false), /<h3>Notes<\/h3>/, 'no Notes heading without advisories');
 } finally {
  s.dispose();
 }
});

test('Inspector and KPI times use the display calendar: business days and weeks beside minutes', () => {
 const plain = agency, s = runtime.create(plain);
 try {
  // A one-hour business day makes the agency run's cycle (over 120 minutes) span business days.
  const q = s.advance(300), m = q.metrics, cal = {minutesPerDay: 60, daysPerWeek: 5};
  assert(m.completed > 0 && m.meanCycleMinutes >= 120, 'the agency run finishes cases after more than two business days');
  const time = (globalThis as unknown as {LWProcessTime: LWProcessTime.Api}).LWProcessTime;
  const kpi = (d: LWProcess.Definition) => inspector.kpis({definition: d, snapshot: q, selected: null} as unknown as LWProcessApp.View);
  const without = kpi(plain), withCal = kpi({...plain, calendar: cal});
  assert.match(without, new RegExp(`<span>Mean cycle</span><strong>${time.span(m.meanCycleMinutes).replace(/[().]/g, '\\$&')}</strong>`));
  assert.match(without, /<span>Mean cycle<\/span><strong>[\d,.]+ min \(≈ [\d,.]+ h\)<\/strong>/, 'without a calendar, long times gloss hours');
  assert.match(withCal, /<span>Mean cycle<\/span><strong>[\d,.]+ min \((≈ )?[\d.]+ business (days?|weeks?)\)<\/strong>/, 'with a calendar, business days or weeks');
  const busy = plain.steps.find(x => (q.steps.find(y => y.id === x.id)?.waitMinutes ?? 0) >= 60)!;
  const detail = inspector.step({definition: {...plain, calendar: cal}, snapshot: q, selected: busy.id} as unknown as LWProcessApp.View, busy);
  const wait = q.steps.find(y => y.id === busy.id)!.waitMinutes;
  assert(detail.includes(`<dt>Total queue time</dt><dd>${time.span(wait, cal)}</dd>`), 'queue time in business days');
  assert.match(time.span(wait, cal), /business days?\)$/);
 } finally {
  s.dispose();
 }
});
