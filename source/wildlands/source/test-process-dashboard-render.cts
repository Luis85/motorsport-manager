/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-dashboard-whatif.ts" />
/// <reference path="./process-dashboard-html.ts" />
/**
 * Dashboard rendering and What-if checks, part of the business-process suite: the pure SVG primitives (1-2-5 ticks, escaping, finite
 * coordinates, named and keyboard-reachable marks), the panel markup contract (figure, caption, data table, step buttons, "Show all"),
 * the CSV export, and the What-if model: bounded inputs with plain reasons, replication and comparison results with intervals, the
 * honesty text and the no-randomness case. The markup is the same string the studio shows.
 */
import assert from 'node:assert/strict';
import {catalog, replicate} from './process-sdk.cjs';
import {test, copy} from './test-process-helpers.cjs';
import {demo, viewAt, poolless} from './test-process-dashboard.cjs';
for (const name of ['process-dashboard-html', 'process-dashboard-whatif']) require(`./${name}.js`);
const root = globalThis as unknown as {LWProcessChart: LWProcessChart.Api; LWProcessDashboardModel: LWProcessDashboardModel.Api;
 LWProcessDashboardHtml: LWProcessDashboardHtml.Api; LWProcessDashboardWhatIf: LWProcessDashboardWhatIf.Api};
const C = root.LWProcessChart, H = root.LWProcessDashboardHtml, W = root.LWProcessDashboardWhatIf, M = root.LWProcessDashboardModel;
const ctx = (expanded: string[] = []): LWProcessDashboardHtml.Context => ({width: 480, rem: 16, expanded: new Set(expanded)});
const panels = (m: LWProcessDashboardModel.Model) => m.sections.flatMap(s => s.panels);
const count = (html: string, pattern: RegExp) => (html.match(pattern) ?? []).length;

test('Chart primitives use 1-2-5 ticks from zero, compact labels and only finite, half-pixel coordinates', () => {
 assert.deepEqual(C.ticks(0), [0, 1]);
 assert.deepEqual(C.ticks(7), [0, 2, 4, 6, 8]);
 assert.deepEqual(C.ticks(1234), [0, 500, 1000, 1500]);
 assert.deepEqual(C.ticks(100), [0, 50, 100]);
 assert(C.ticks(97531).length <= 5);
 assert.deepEqual([C.compact(1284), C.compact(12900), C.compact(3100000), C.compact(2.25), C.compact(Number.NaN)], ['1,284', '12.9K', '3.1M', '2.3', '—']);
 const f = {width: 300, height: 160, title: 'T', id: 'x'};
 const svg = [C.lines(f, 16, [0, 60], [{label: 'a', values: [Number.NaN, 3], tone: 'wait'}], {step: true, axis: 'cases'}),
  C.histogram(f, 16, [{label: '0', count: 0, tip: 'none'}], new Map(), 'join', 'cases'), C.stack(f, [{label: 'a', value: 0, tone: 'work'}]),
  C.bullet(f, null, null, 100, 85, 'x'), C.dots(f, 16, [{label: 'a', mean: 1, low: 1, high: 1, p10: 1, p90: 1, tip: 't'}], true),
  C.columns(f, 16, [60], [{label: 'a', values: [0], tone: 'join'}], null, 'cases'), C.sparkline([], 50, 10, 'work')].join('');
 assert.doesNotMatch(svg, /NaN|undefined|Infinity/);
 for (const n of svg.match(/ (?:x|y|width|height|cx|cy)="([^"]+)"/g) ?? []) assert(/="-?\d+(\.5)?"/.test(n), n);
});

test('Chart marks carry escaped accessible names, are reachable by keyboard and sit in a named SVG group', () => {
 const name = 'A <b>"step"</b> & co';
 const svg = C.stack({width: 300, height: 28, title: name, id: 'db-x'}, [{label: name, value: 3, tone: 'work', glyph: 'active'},
  {label: 'b', value: 1, tone: 'wait'}]);
 assert(svg.startsWith('<svg class="db-chart" role="group" aria-labelledby="db-x" width="300" height="28" viewBox="0 0 300 28">'
  + '<title id="db-x">A &lt;b&gt;&quot;step&quot;&lt;/b&gt; &amp; co</title>'));
 assert.doesNotMatch(svg, /<b>/);
 assert.equal(count(svg, /tabindex="0" role="img" aria-label="[^"]+" data-tip="[^"]+"/g), 2);
 assert.match(svg, /aria-label="A &lt;b&gt;&quot;step&quot;&lt;\/b&gt; &amp; co: 75%"/);
 assert.match(svg, /class="db-glyph on-mark"/, 'a wide segment carries its state glyph');
 assert.match(C.key('wait', 'queued'), /aria-hidden="true"/);
 assert.match(C.meter(1, 2, 100, 'work'), /aria-hidden="true"/);
});

test('Every dashboard chart sits in a figure with a caption and a data table, and empty panels say why', () => {
 const views = [viewAt(demo('agency'), 0), viewAt(demo('order-fulfilment'), 900), viewAt(demo('customer-journey-webshop'), 300), viewAt(poolless(), 60)];
 for (const view of views) {
  for (const p of panels(M.build({view}))) {
   const html = H.panel(p, ctx()), where = `${view.definition.id}/${p.id}`;
   assert.match(html, new RegExp(`^<section class="db-panel" data-panel="${p.id}" aria-labelledby="db-h-${p.id}"><h3 id="db-h-${p.id}">`), where);
   if (p.empty !== null) { assert.match(html, /<p class="db-empty">[^<]+<\/p>/, where); continue; }
   if (!p.chart) continue;
   assert.match(html, /<figure class="db-figure">/, where);
   assert.match(html, /<figcaption>[^<]+<\/figcaption>/, where);
   if (p.chart.kind !== 'text') {
    const table = new RegExp('<details class="db-table"><summary>Data table</summary>'
     + '<div class="db-scroll" role="region" tabindex="0" aria-label="[^"]+"><table><caption>');
    assert.match(html, table, where);
    assert.match(html, /<th scope="col"/, where);
   }
   if (/<svg class="db-chart"/.test(html)) assert.match(html, /<title id="db-c-[^"]+">[^<]+<\/title>/, where);
  }
 }
});

test('Dashboard markup escapes authored names, makes step rows buttons and shortens long lists behind Show all', () => {
 const d = copy(demo('order-fulfilment'));
 d.steps[1]!.name = '<img src=x onerror=alert(1)>';
 const view = viewAt(catalog.admit(d), 900), m = M.build({view});
 const html = panels(m).map(p => H.panel(p, ctx())).join('') + H.tiles(m.tiles, 'Key figures') + H.strip(m.strip);
 assert.doesNotMatch(html, /<img/);
 const rows = panels(m).find(p => p.id === 'waiting')!;
 const buttons = H.panel(rows, ctx()).match(/<button type="button" class="db-row" data-select="[^"]+">/g) ?? [];
 assert(buttons.length > 0 && buttons.length <= H.ROWS);
 const many = Array.from({length: 13}, (_, i) => ({label: 'S' + i, detail: '', value: i, max: 13, tone: 'wait' as const}));
 const long: LWProcessDashboardModel.Panel = {...rows, chart: {kind: 'rows', title: 'Many', rows: many}};
 assert.match(H.panel(long, ctx()), /<button type="button" class="db-more" data-more="waiting" aria-expanded="false">Show all 13 rows<\/button>/);
 assert.equal(count(H.panel(long, ctx(['waiting'])), /<div class="db-row">/g), 13);
 const table = {caption: 'Series', head: ['Minute', 'n'], rows: Array.from({length: 30}, (_, i) => [String(i), '1']), numeric: [false, true], tail: true};
 const short = H.table(table, 'p', ctx());
 assert.match(short, /<caption>Series \(the latest 24 of 30 rows\)<\/caption>/);
 assert.match(short, /<th scope="row">6<\/th>/);
 assert.doesNotMatch(short, /<th scope="row">5<\/th>/);
 assert.match(H.table(table, 'p', ctx(['p-open'])), /<details class="db-table" open>/);
});

test('Dashboard tiles and strip mark problems with words and a hidden glyph, and the notice is a note', () => {
 const m = M.build({view: viewAt(demo('loan-application'), 600)});
 const tiles = H.tiles(m.tiles, 'Key figures'), strip = H.strip(m.strip);
 assert.match(tiles, /^<ul class="db-tiles" aria-label="Key figures">/);
 const problem = /<li class="db-tile problem" data-tile="problems"><span class="db-tile-label">Problems<\/span>.*<span aria-hidden="true">⚠ <\/span>/;
 if (m.tiles.some(t => t.problem)) assert.match(tiles, problem);
 assert.match(strip, /<p class="db-notice" role="note">One simulated run \(seed 7\) at business minute 600\./);
});

test('Dashboard CSV holds every panel table under its section and panel names, quoted where needed', () => {
 const m = M.build({view: viewAt(demo('order-fulfilment'), 900)});
 const table = {caption: 'Spread, "quoted"', head: ['Measure', 'Mean'], rows: [['Cost, total', '12']], numeric: [false, true]};
 const csv = H.csv(m, [{section: 'What-if', panel: 'Replications', table}]);
 assert(csv.startsWith('Dashboard,Order fulfilment line,minute 900\n\n'));
 const blocks = csv.trim().split('\n\n');
 assert.equal(blocks.length, 1 + panels(m).filter(p => p.table).length + 1);
 const waiting = 'Where time goes,Waiting by step\nWaiting by step\nStep,Share of waiting,Mean wait per start,Waiting now,Work starts,Busiest pool\n';
 assert(blocks.some(b => b.startsWith(waiting)));
 assert(csv.endsWith('What-if,Replications\n"Spread, ""quoted"""\nMeasure,Mean\n"Cost, total",12\n'));
});

test('What-if inputs are bounded with plain reasons, and a comparison needs a changed, valid draft', () => {
 const view = viewAt(demo('order-fulfilment'), 600), ok = {changed: true, valid: true};
 assert.deepEqual(W.defaults(view), {mode: 'spread', runs: 20, minutes: 600, seed: view.snapshot.seed});
 assert.equal(W.defaults(viewAt(demo('agency'), 0)).minutes, 100000);
 const problems = (i: Partial<LWProcessDashboardWhatIf.Inputs>, draft = ok) => W.check({...W.defaults(view), ...i}, view, draft).problems;
 assert.deepEqual(problems({runs: 1}), ['Runs must be a whole number from 2 to 50.']);
 assert.deepEqual(problems({runs: 51}), ['Runs must be a whole number from 2 to 50.']);
 assert.deepEqual(problems({runs: 2.5}), ['Runs must be a whole number from 2 to 50.']);
 assert.deepEqual(problems({minutes: 0}), ['Minutes per run must be a whole number from 1 to 100,000 (the run length).']);
 assert.deepEqual(problems({seed: 2147483640}), ['Seeds 2147483640 to 2147483659 pass the largest seed, 2,147,483,647.']);
 assert.deepEqual(problems({runs: 50, minutes: 30000}), ['This plan simulates 1,500,000 minutes; the limit is 1,000,000. Lower the runs or the minutes.']);
 assert.deepEqual(problems({mode: 'compare', runs: 50, minutes: 20000}),
  ['This plan simulates 2,000,000 minutes; the limit is 1,000,000. Lower the runs or the minutes.']);
 assert.equal(W.compareReason({changed: false, valid: false}),
  'The draft holds the running definition, so there is nothing to compare. Edit the process to compare a change.');
 assert.equal(W.compareReason({changed: true, valid: false}), 'Fix the draft before comparing: it is not a valid definition yet.');
 assert.deepEqual(problems({mode: 'compare'}, {changed: true, valid: false}), ['Fix the draft before comparing: it is not a valid definition yet.']);
 const good = W.check({...W.defaults(view), runs: 5}, view, ok);
 const plan = `Seeds ${view.snapshot.seed} to ${view.snapshot.seed + 4} · 5 × 600 minutes = 3,000 of at most 1,000,000 simulated minutes.`;
 assert.deepEqual([good.ok, good.plan, good.advice], [true, plan,
  'Intervals are wide with few runs.']);
});

test('What-if results show mean, 95% interval and percentiles per measure with the honesty text, also while partial', () => {
 const d = demo('order-fulfilment'), report = replicate.replicate(d, {minutes: 300, runs: 4}), r = W.result(report, 4);
 assert.equal(r.complete, true);
 assert.equal(r.flat, false);
 const done = r.kpis.find(k => k.id === 'completed')!, stats = report.kpis.find(k => k.id === 'completed')!;
 assert.deepEqual([done.n, done.mean, done.ci], [4, M.util.number(stats.mean!), `${M.util.number(stats.ci95![0])} to ${M.util.number(stats.ci95![1])}`]);
 assert.match(r.kpis.find(k => k.id.startsWith('utilization.'))!.mean, /^[\d.]+%$/);
 assert.match(r.honesty, /^Spread under the authored assumptions across 4 seeds \(\d+ to \d+\), measured at minute 300 of runs that start empty, /);
 assert.match(r.honesty, /, so start-up is included\. Intervals use Student t /);
 assert.match(r.honesty, /This is not a forecast\.$/);
 const html = W.markup(r, 480, 16);
 assert.match(html, /<p class="db-notice" role="note">Spread under the authored assumptions/);
 assert.equal(count(html, /<svg class="db-chart" role="group"/g), r.kpis.filter(k => k.interval).length);
 assert.match(html, /<details class="db-table"><summary>Data table<\/summary>/);
 const runner = replicate.replications(d, {minutes: 300, runs: 4});
 runner.step();
 const partial = W.result(runner.report(), runner.done());
 assert.deepEqual([partial.complete, partial.status], [false, 'Partial results (1 of 4 runs).']);
 assert.match(W.markup(partial, 480, 16), /^<p class="db-status">Partial results \(1 of 4 runs\)\.<\/p>/);
});

test('What-if comparisons word the paired difference from the draft side and say when there is no clear difference', () => {
 const a = demo('order-fulfilment'), b = copy(a);
 b.resources[0]!.capacity += 2;
 const r = W.result(replicate.compare(a, b, {minutes: 300, runs: 5}), 5);
 assert.equal(r.kind, 'compare');
 assert.match(r.honesty, /Both designs run on the same seeds, so they share random numbers wherever they agree\.$/);
 for (const k of r.kpis.filter(x => x.n > 1)) {
  const worded = /^(No clear difference in .+ at \d+ paired runs\.|.+ per run is .+ (lower|higher) with the draft than with the applied design \(95% interval)/;
  assert.match(k.sentence, worded, k.id);
 }
 assert.deepEqual(W.table(r).head, ['Measure (applied minus draft)', 'Mean difference', '95% interval', '10th · 50th · 90th percentile', 'Paired runs']);
 const same = W.result(replicate.compare(a, a, {minutes: 120, runs: 3}), 3);
 assert(same.kpis.filter(k => k.n > 0 && k.interval).every(k => /^No clear difference/.test(k.sentence)));
});

test('What-if over a process without random behaviour says every seed gives the same result instead of drawing intervals', () => {
 const r = W.result(replicate.replicate(demo('agency'), {minutes: 300, runs: 3}), 3), html = W.markup(r, 480, 16);
 assert.equal(r.flat, true);
 assert.match(html, /This process has no random behaviour; every seed gives the same result, so there is no spread to show\./);
 assert.doesNotMatch(html, /db-intervals/);
 const empty = W.result(replicate.replicate(demo('delivery-release'), {minutes: 60, runs: 2}), 2).kpis.find(k => k.id === 'meanCycleMinutes')!;
 assert.equal(empty.sentence, 'Mean cycle (minutes) is undefined in 2 runs where no case finished.');
});
