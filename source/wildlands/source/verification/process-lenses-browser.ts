/// <reference path="../process-contracts.d.ts" />
/** Process Studio lenses: plain-language random views, the SIPOC view, the journey map and the lens that follows the process type. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {nextFrames} from './browser-harness';
import {query, runSuite} from './process-browser-fixture';
import {randomLine, journeyFixture} from './process-browser-models';
runSuite('process lenses browser harness', 'process-lenses-browser-results.json', async studio => {
 const {page, gameDir, gameDefinitions, COUNT, check, checkLifecycle, freshStudio, showIo, switchTo, applyDraft, importJson} = studio;
 await check('Random view helpers describe distributions, draws, chance routes and arrival streams in plain language', async () => {
  await freshStudio();
  const out = await page.evaluate(() => {
   const v = (globalThis as unknown as {LWProcessRandomView: LWProcessRandomView.Api}).LWProcessRandomView;
   return [v.describeDist({dist: 'triangular', min: 4, mode: 6, max: 10}), v.describeDist({dist: 'uniform', min: 7, max: 11}), v.describeDist({dist: 'exponential', mean: 4, max: 12}), v.describeDist({dist: 'exponential', mean: 4}),
    v.describeTiming({duration: 12}), v.describeTiming({duration: 12, timing: {dist: 'uniform', min: 7, max: 11}}), v.describeTiming({until: 5}),
    v.describeTiming({duration: 9, timing: {dist: 'uniform', min: 7, max: 11}}),
    v.describeTiming({duration: 720, timing: {dist: 'triangular', min: 240, mode: 720, max: 1800}}),
    v.describeDraw({field: 'defect', kind: 'chance', percent: 12}), v.describeDraw({field: 'priority', kind: 'choice', values: [{value: 'express', weight: 20}, {value: 'standard', weight: 80}]}),
    v.describeDraw({field: 'x', kind: 'int', min: 1, max: 6}), v.describeDraw({field: 'ok', kind: 'chance', percent: 30, whenTrue: 'pass', whenFalse: 'fail'}),
    v.describeWhen({chance: 8}), v.describeWhen({field: 'iteration', op: 'lt', valueField: 'iterations'} as unknown as LWProcess.Condition), v.describeWhen({field: 'priority', op: 'eq', value: 'express'}), v.describeWhen(undefined),
    v.describeArrival({at: 0, open: true, interval: 4, gap: {dist: 'exponential', mean: 4}, data: {}}), v.describeArrival({at: 10, until: 600, interval: 5, data: {}}), v.describeArrival({at: 0, count: 8, interval: 3, data: {}})];
  });
  assert.deepEqual(out, ['Random between 4 and 10 min, most often 6', 'Uniform 7–11 min', 'Exponential, mean 4 min (max 12)', 'Exponential, mean 4 min', 'Takes 12 min',
   'Planned 12 min; draws average about 9 min; each visit draws its own time: Uniform 7–11 min', '',
   'Planned 9 min (the average shown in estimates); each visit draws its own time: Uniform 7–11 min',
   'Planned 720 min; draws average about 920 min; each visit draws its own time: Random between 240 and 1800 min, most often 720',
   'Sets defect to true in 12% of cases, otherwise false', 'Sets priority to express (20%) or standard (80%)',
   'Sets x to a whole number from 1 to 6', 'Sets ok to pass in 30% of cases, otherwise fail', '8% of cases take this path', 'If iteration < iterations', 'If priority = "express"', 'Otherwise (no condition)',
   'Keeps arriving: every ~4 min, random gap (exponential, mean 4), first at minute 0', 'Until minute 600: every 5 min, first at minute 10', '8 cases: every 3 min, first at minute 0']);
 });
 await check('Inspector shows random timing, outcomes, chance routes and the arrival stream in plain language', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await freshStudio();
  const long = 'A long walk through a random packing line. '.repeat(10).trim(), random = {...randomLine(), id: 'plain-random', name: 'Plain random', description: long, arrivals: [{at: 0, open: true, interval: 4, gap: {dist: 'exponential', mean: 4}, data: {}}, {at: 10, count: 8, interval: 3, data: {}}]};
  (random.steps[1] as any).timing = {dist: 'uniform', min: 7, max: 11}; (random.steps[1] as any).draws = [{field: 'defect', kind: 'chance', percent: 12}]; (random.resources[0] as any).capacity = 1;
  await importJson('plain-random.json', random); const text = () => page.locator('#inspector').innerText();
  const overview = await text(); assert.match(overview, /Arrivals/); assert.match(overview, /Keeps arriving: every ~4 min, random gap \(exponential, mean 4\), first at minute 0/); assert.match(overview, /8 cases: every 3 min, first at minute 10/);
  assert.match(overview, /Seed\s*1/); assert.match(overview, /Steps\s*7/);
  assert.equal(await page.evaluate(() => { const pools = document.getElementById('pools')!, inspector = document.getElementById('inspector')!; return !!(pools.compareDocumentPosition(inspector) & Node.DOCUMENT_POSITION_FOLLOWING) && document.getElementById('pools-title')!.textContent === 'Shared resources'; }), true, 'Shared resources come first');
  // The long description is clamped to three lines behind a More disclosure.
  const more = page.locator('#desc-more'); assert.equal(await more.isVisible(), true); assert.deepEqual([await more.innerText(), await more.getAttribute('aria-expanded')], ['More', 'false']);
  const lines = () => page.locator('#process-desc').evaluate(e => ({shown: e.clientHeight, full: e.scrollHeight, line: parseFloat(getComputedStyle(e).lineHeight)})); let l = await lines(); assert(l.shown <= l.line * 3 + 2 && l.full > l.shown, JSON.stringify(l));
  await more.click(); assert.deepEqual([await more.innerText(), await more.getAttribute('aria-expanded')], ['Less', 'true']); l = await lines(); assert(l.shown >= l.full - 1 && l.shown > l.line * 3, JSON.stringify(l)); await more.click(); assert.equal(await more.innerText(), 'More');
  await page.locator('[data-step="pack"]').click(); let detail = await text();
  assert.match(detail, /Random timing/); assert.match(detail, /Random outcomes/);
  const timing = /Planned 12 min; draws average about 9 min; each visit draws its own time: Uniform 7–11 min/;
  assert.match(detail, timing); assert.match(detail, /Sets defect to true in 12% of cases, otherwise false/);
  await page.locator('[data-step="gate"]').click(); detail = await text(); const next = await page.locator('.next-step').allInnerTexts();
  assert.deepEqual(next, ['Repack\n20% of cases take this path', 'Done\nOtherwise, 80% of cases']);
  await page.locator('[data-step="repack"]').click(); detail = await text(); assert.doesNotMatch(detail, /Random timing|Random outcomes/); assert.match(detail, /Takes|Duration/);
  await page.locator('[data-step="pack"]').click(); assert.equal(await page.locator('.process-random').count(), 1);
  // Resource meters: 8px bars on a #2c3744 track, filled by utilisation, with the percentage beside the name.
  await page.locator('#horizon').selectOption('100000'); for (let i = 0; i < 4; i++) await page.locator('#advance').click();
  const meter = page.locator('#pools [role=meter]').first(), pct = Number(await meter.getAttribute('aria-valuenow')); assert(pct > 0 && pct <= 100); assert.equal(await meter.getAttribute('aria-label'), 'Operators utilisation'); assert.equal(await page.locator('#pools .pool-pct').first().innerText(), pct + '%');
  const bar = await meter.evaluate(e => ({h: e.getBoundingClientRect().height, track: getComputedStyle(e).backgroundColor, fill: getComputedStyle(e.firstElementChild!).backgroundColor, level: (e as HTMLElement).dataset.level}));
  const busy = (await query(page)).snapshot.resources[0]!;
  const valuetext = `${pct}% average utilisation since minute 0${pct >= 85 ? ', nearly full' : ''}; ${busy.busy} of ${busy.capacity} busy now`;
  assert.equal(await meter.getAttribute('aria-valuetext'), valuetext);
  assert.equal(await page.locator('#pools .process-pool small').first().innerText(), `Average since minute 0 · ${busy.busy}/${busy.capacity} busy now`);
  const note = await page.locator('#pools .process-cost-note').innerText();
  assert.match(note, /^Work cost charges pools only for the minutes they work, plus fixed step costs\. Capacity cost charges every pool unit/);
  assert.equal(bar.h, 8); assert.equal(bar.track, 'rgb(44, 55, 68)'); assert.equal(bar.fill, {ok: 'rgb(255, 187, 115)', warm: 'rgb(245, 158, 91)', hot: 'rgb(255, 122, 89)'}[bar.level as 'ok'], JSON.stringify(bar)); assert.equal(bar.level, pct >= 85 ? 'hot' : pct >= 70 ? 'warm' : 'ok');
  await page.locator('#overview').click();
 });
 // SIPOC lens: the pure model and the DOM lens mounted on a host beside the studio, fed by the studio controller's detached views.
 const mountSipoc = (def: object) => page.evaluate(d => {
  const w = globalThis as any, old = document.getElementById('sipoc-host'); old?.remove(); w.__sipoc?.dispose();
  const host = document.createElement('div'); host.id = 'sipoc-host'; host.style.cssText = 'width:100%;max-width:100%'; document.body.append(host); w.__picks = []; w.__def = d;
  w.__sipoc = w.LWProcessSipoc.create(host, (id: string | null) => w.__picks.push(id)); w.__sipoc.draw({...w.LWProcessStudio.query(), definition: d});
 }, def);
 const redrawSipoc = (selected: string | null = null) => page.evaluate(sel => { const w = globalThis as any; w.__sipoc.draw({...w.LWProcessStudio.query(), definition: w.__def, selected: sel}); }, selected);
 const unmountSipoc = () => page.evaluate(() => { const w = globalThis as any; w.__sipoc?.dispose(); document.getElementById('sipoc-host')?.remove(); });
 await check('SIPOC view derives suppliers, inputs, process stages, outputs and customers and shows live counts', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await freshStudio();
  const def = JSON.parse(JSON.stringify((await query(page)).definition)) as any, phase = (ids: string[], name: string) => ids.forEach(id => { def.steps.find((s: any) => s.id === id).phase = name; });
  phase(['discovery'], 'Discover'); phase(['design-split', 'product-design', 'architecture', 'design-ready'], 'Design'); phase(['implementation', 'qa', 'review-gate', 'rework'], 'Build'); phase(['handover'], 'Deliver');
  def.steps.find((s: any) => s.id === 'handover').outputs = [{field: 'delivery', label: 'Delivered feature'}]; def.steps.find((s: any) => s.id === 'discovery').needs = [{field: 'brief', label: 'Client brief'}];
  def.arrivals[0].draws = [{field: 'budget', kind: 'int', min: 1, max: 5}];
  def.sipoc = {suppliers: [{name: 'Client', supplies: 'brief and budget'}], customers: [{name: 'Product owner', receives: 'a working feature'}, {name: 'End users'}]};
  const model = (await page.evaluate(d => { const w = globalThis as any; return w.LWProcessSipoc.model(d, w.LWProcessStudio.query().snapshot); }, def)) as LWProcessSipoc.Model;
  assert.deepEqual(model.suppliers, [{name: 'Client', detail: 'brief and budget'}]); assert.deepEqual(model.customers, [{name: 'Product owner', detail: 'a working feature'}, {name: 'End users'}]);
  assert.deepEqual(model.inputs.map(i => i.field), ['needsRework', 'priority', 'budget', 'brief']); const byField = (f: string) => model.inputs.find(i => i.field === f)!;
  const rework = byField('needsRework');
  assert.deepEqual([rework.label, rework.example], ['needsRework', 'false, true'], 'a need condition label never names the input');
  assert.equal(byField('priority').example, '2, 1'); assert.equal(byField('budget').example, 'random, 1 to 5'); assert.deepEqual([byField('brief').label, byField('brief').arrived, byField('brief').example], ['Client brief', null, null]); assert.equal(byField('priority').arrived, 1);
  assert.deepEqual(model.stages.map(s => s.name), ['Discover', 'Design', 'Build', 'Deliver']); const stage = (n: string) => model.stages.find(s => s.name === n)!;
  assert.deepEqual([stage('Design').steps, stage('Design').parallel, stage('Design').variant, stage('Design').first], [4, true, false, 'design-split']);
  assert.deepEqual([stage('Build').steps, stage('Build').variant, stage('Discover').variant], [4, true, false]); assert(stage('Build').stepIds.includes('rework') && stage('Build').kinds.includes('decision'));
  assert.deepEqual(model.outputs.map(o => o.label), ['Delivered feature', 'Reached Delivered']);
  assert.deepEqual(model.measures.map(m => m.id).slice(0, 7), ['completed', 'active', 'cycle', 'age', 'cost', 'capacity-cost', 'throughput']);
  const costs = model.measures.filter(m => ['cycle', 'cost', 'capacity-cost'].includes(m.id)).map(m => [m.label, m.value]);
  const started = (await query(page)).snapshot.metrics.cost;
  assert.deepEqual(costs, [['Mean cycle', '—'], ['Work cost', String(started)], ['Capacity cost', '0']], 'nothing has finished at minute 0');
  await mountSipoc(def); const host = page.locator('#sipoc-host');
  assert.deepEqual(await host.locator('.sipoc-col > h3').allInnerTexts(), ['S\nSuppliers', 'I\nInputs', 'P\nProcess', 'O\nOutputs', 'C\nCustomers']);
  assert.equal(await host.locator('section.sipoc-col[aria-labelledby]').count(), 5); assert.equal(await host.locator('.sipoc-col-suppliers').innerText().then(t => /Client/.test(t) && /brief and budget/.test(t)), true);
  // Stage work uses the studio's words (LWProcessWorkState): working people, waiting = queued minus held, blocked only when held.
  const stageLabels = await host.locator('.sipoc-stage').evaluateAll(b => b.map(x => x.getAttribute('aria-label')));
  assert.deepEqual(stageLabels, ['Stage Discover, 1 step, 1 working, 0 waiting, 0 completed',
   'Stage Design, 4 steps, 0 working, 0 waiting, 0 completed', 'Stage Build, 4 steps, 0 working, 0 waiting, 0 completed, has alternative paths',
   'Stage Deliver, 1 step, 0 working, 0 waiting, 0 completed']);
  assert.deepEqual(await host.locator('.sipoc-stage').first().locator('.sipoc-count').allInnerTexts(), ['1 working', '0 waiting', '0 completed']);
  assert.equal(await host.locator('.sipoc-tag-variant').count(), 1); assert.equal(await host.locator('.sipoc-stage', {hasText: 'in parallel'}).count(), 1); assert.match(await host.locator('.sipoc-col-inputs').innerText(), /Client brief/); assert.match(await host.locator('.sipoc-col-inputs').innerText(), /1 case arrived/);
  const unchanged = await host.evaluate(h => { const first = h.querySelector('.sipoc-grid'); (first as any).__mark = 1; return true; }); await redrawSipoc(); assert.equal(await host.evaluate(h => (h.querySelector('.sipoc-grid') as any).__mark), 1, 'identical view must not redraw'); assert(unchanged);
  await page.locator('#horizon').selectOption('100000'); await page.locator('#advance').click(); await page.waitForFunction(() => (globalThis as any).LWProcessStudio.query().snapshot.minute > 0); await page.locator('#advance').click(); await redrawSipoc();
  const live = await host.locator('.sipoc-stage').evaluateAll(b => b.map(x => x.getAttribute('aria-label')!));
  assert(live.some(l => /[1-9]\d* (working|waiting)|[1-9]\d* completed/.test(l)), live.join('|'));
  // A stage counts the cases that left it: never more than arrived, and Discover is left by exactly the cases that reached the design fork.
  const ran = await query(page);
  const after = await page.evaluate(d => {
   const w = globalThis as any; return w.LWProcessSipoc.model(d, w.LWProcessStudio.query().snapshot);
  }, def) as LWProcessSipoc.Model;
  assert(after.stages.every(s => s.completed <= ran.snapshot.metrics.arrived), JSON.stringify(after.stages.map(s => s.completed)));
  assert.equal(after.stages[0]!.completed, ran.snapshot.steps.find(s => s.id === 'design-split')!.reached);
  assert.match(await host.locator('.sipoc-col-inputs').innerText(), /[1-9]\d* cases? arrived/); assert.notEqual(await host.locator('.sipoc-measure', {hasText: 'Mean cycle'}).count(), 0); assert.equal(await host.locator('.sipoc-measure', {hasText: /^In progress/}).locator('dd').innerText() !== '0' || (await query(page)).snapshot.metrics.active === 0, true);
  await host.locator('.sipoc-stage', {hasText: 'Design'}).click(); assert.deepEqual(await page.evaluate(() => (globalThis as any).__picks), ['design-split']);
  await redrawSipoc('design-split'); assert.equal(await host.locator('.sipoc-stage[aria-pressed=true]').count(), 1); assert.match((await host.locator('.sipoc-stage[aria-pressed=true]').getAttribute('aria-label'))!, /^Stage Design/);
  await unmountSipoc(); assert.equal(await page.locator('#sipoc-host').count(), 0);
 });
 await check('SIPOC view groups steps by phase, falls back for ungrouped processes and stays readable on phones', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await freshStudio();
  const agency = JSON.parse(JSON.stringify((await query(page)).definition)) as any; for (const s of agency.steps) delete s.phase; delete agency.sipoc;
  const long = {...agency, start: 's0', steps: Array.from({length: 11}, (_, i) => ({id: 's' + i, name: 'Step ' + i, kind: i === 10 ? 'end' : 'task', scene: {id: 'office', position: [i, 0], color: '#fff'}})), flows: Array.from({length: 10}, (_, i) => ({id: 'f' + i, from: 's' + i, to: 's' + (i + 1)})), arrivals: []};
  const sizes = await page.evaluate(([a, l]) => { const w = globalThis as any, q = w.LWProcessStudio.query().snapshot, A = w.LWProcessSipoc.model(a, q), L = w.LWProcessSipoc.model(l, q); return {agency: A.stages.map((s: any) => s.name), long: L.stages.map((s: any) => [s.name, s.steps]), suppliers: A.suppliers, customers: A.customers}; }, [agency, long]);
  assert(sizes.agency.length >= 3 && sizes.agency.length <= 7, sizes.agency.join()); assert.deepEqual(sizes.agency, ['Discovery', 'Plan together', 'Implementation', 'Quality review', 'Client handover']);
  assert.equal(sizes.long.length, 7); assert.equal(sizes.long.reduce((n: number, s: any) => n + s[1], 0), 10); assert(sizes.long.some((s: any) => /^Step \d+ and \d+ more steps?$/.test(s[0])), JSON.stringify(sizes.long));
  assert.deepEqual([sizes.suppliers[0].placeholder, sizes.suppliers[0].name, sizes.customers[0].name], [true, 'Add suppliers in Edit process', 'Add customers in Edit process']);
  await mountSipoc(agency); const host = page.locator('#sipoc-host'); assert.equal(await host.locator('.sipoc-stage').count(), sizes.agency.length);
  assert.match(await host.locator('.sipoc-col-suppliers').innerText(), /Add suppliers in Edit process/); assert.match(await host.locator('.sipoc-col-customers').innerText(), /Add customers in Edit process/);
  const phased = JSON.parse(JSON.stringify(agency)); phased.steps.forEach((s: any, i: number) => { s.phase = i < 4 ? 'Early' : 'Late'; });
  assert.deepEqual(await page.evaluate(p => (globalThis as any).LWProcessSipoc.model(p, (globalThis as any).LWProcessStudio.query().snapshot).stages.map((s: any) => s.name), phased), ['Early', 'Late']);
  await page.setViewportSize({width: 390, height: 844}); await nextFrames(page); await redrawSipoc();
  const geo = await page.evaluate(() => {
   const host = document.getElementById('sipoc-host')!, cols = [...host.querySelectorAll('.sipoc-col')].map(c => c.getBoundingClientRect()), scroll = host.querySelector('.sipoc-scroll') as HTMLElement;
   const sizes = [...host.querySelectorAll('*')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent!.trim())).map(e => parseFloat(getComputedStyle(e).fontSize));
   const buttons = [...host.querySelectorAll('.sipoc-stage')].map(b => b.getBoundingClientRect());
   return {stacked: cols.every((c, i) => i === 0 || (c.top >= cols[i - 1]!.bottom - 1 && Math.abs(c.left - cols[0]!.left) < 1)), pageOverflow: document.documentElement.scrollWidth > innerWidth, scrollOverflow: scroll.scrollWidth > scroll.clientWidth + 1, minFont: Math.min(...sizes),
    inside: buttons.every(b => b.left >= 0 && b.right <= innerWidth), ordered: buttons.every((b, i) => i === 0 || b.top > buttons[i - 1]!.top)};
  });
  assert.deepEqual(geo, {stacked: true, pageOverflow: false, scrollOverflow: false, minFont: geo.minFont, inside: true, ordered: true}); assert(geo.minFont >= 12, 'font ' + geo.minFont);
  await unmountSipoc(); await page.setViewportSize({width: 1440, height: 1060});
 });
 const mountJourney = () => page.evaluate(() => {
  const w = globalThis as any; w.jsurface?.dispose(); document.getElementById('jtest')?.remove(); const host = document.createElement('div'); host.id = 'jtest'; document.body.append(host);
  w.jsel = []; w.jsurface = w.LWProcessJourney.create(host, (id: string | null) => w.jsel.push(id)); w.jsurface.draw(w.LWProcessStudio.query());
 });
 const redrawJourney = () => page.evaluate(() => (globalThis as any).jsurface.draw((globalThis as any).LWProcessStudio.query()));
 /** Every cell of the journey table sits inside one phase header's columns (aria-colindex/colspan), within aria-colcount. */
 const tableColumns = async () => {
  const t = await page.evaluate(() => {
   const grid = document.querySelector('#jtest [role=table]')!, all = (role: string) => [...grid.querySelectorAll(`[role=${role}]`)].map(range);
   function range(n: Element): [number, number] {
    const at = Number(n.getAttribute('aria-colindex')); return [at, at + Number(n.getAttribute('aria-colspan') ?? 1) - 1];
   }
   return {count: Number(grid.getAttribute('aria-colcount')), heads: all('columnheader'), cells: all('cell'), rows: all('rowheader')};
  });
  assert.deepEqual(t.heads[0], [1, 1]); assert.equal(t.heads.at(-1)![1], t.count, 'the last phase ends at aria-colcount');
  assert(t.rows.every(r => r[0] === 1 && r[1] === 1), 'lane names are column 1');
  // A cell lies inside one phase header's columns, or is the Feeling chart that spans every step column.
  const inside = (c: [number, number]) => t.heads.slice(1).some(h => c[0] >= h[0] && c[1] <= h[1]) || c[0] === 2 && c[1] === t.count;
  assert(t.cells.every(c => c[0] >= 2 && c[1] <= t.count && inside(c)), JSON.stringify(t));
 };
 /** Funnel cells: reached at the previous step = reached here + lost + still in progress, when no split rejoins later. */
 const funnelAdds = async (route: string[], reached: Map<string, number>, why: string) => {
  const cells = await page.evaluate(() => [...document.querySelectorAll('#jtest .jm-funnel')].map(c => {
   const text = (cls: string) => c.querySelector(cls)?.textContent ?? null;
   return {drop: text('.jm-drop')!, wip: text('.jm-wip'), split: text('.jm-split')};
  }));
  const facts = cells.map(c => {
   const lost = /\((\d+)\)$/.exec(c.drop);
   return {lost: lost ? Number(lost[1]) : 0, wip: c.wip, inProgress: c.wip ? Number(c.wip.split(' ')[0]) : 0, split: c.split, drop: c.drop};
  });
  assert.equal(facts[0]!.drop, 'entry point');
  for (let i = 1; i < route.length; i++) {
   const f = facts[i]!; assert(f.lost > 0 ? /^−\d+% lost \(\d+\)$/.test(f.drop) : f.drop === 'no drop-off', f.drop); assert.equal(f.split, null, why);
   assert.equal(reached.get(route[i - 1]!)!, reached.get(route[i]!)! + f.lost + f.inProgress, `${why}: ${route[i]} adds up`);
  }
  return facts;
 };
 const journeyFacts = () => page.evaluate(() => {
  const text = (sel: string) => [...document.querySelectorAll(`#jtest ${sel}`)].map(n => n.textContent!.trim());
  return {phases: text('.jm-phase-name'), lanes: text('.jm-lane-name'), cards: document.querySelectorAll('#jtest .jm-card').length, branches: document.querySelectorAll('#jtest .jm-card.branch').length, faces: document.querySelectorAll('#jtest .jm-face').length,
   authored: document.querySelectorAll('#jtest .jm-line:not(.measured)').length, measured: document.querySelectorAll('#jtest .jm-line.measured').length, counts: text('.jm-funnel .jm-count').map(Number), pcts: text('.jm-funnel .jm-pct'),
   labels: [...document.querySelectorAll('#jtest .jm-card')].map(n => n.getAttribute('aria-label')!), summary: text('.jm-summary')[0]!, region: document.querySelector('#jtest [role=region]')?.getAttribute('aria-label')};
 });
 await check('Journey map lays out phases, touchpoints, emotion curve, pain points and live funnel counts', async () => {
  await freshStudio(); await applyDraft(journeyFixture); await page.locator('#mode-2d').click(); assert.equal((await query(page)).definition.id, 'journey-fixture');
  await mountJourney(); const route = ['start', 'ad', 'browse', 'intent', 'support', 'checkout', 'paid', 'confirm', 'delivery', 'won'];
  const idle = await journeyFacts(); assert.equal(idle.region, 'Journey map'); assert.deepEqual(idle.phases, ['Awareness', 'Consideration', 'Purchase', 'Delivery']);
  assert.deepEqual(idle.lanes, ['Phase', 'Touchpoints', 'Branches', 'Channel', 'Feeling', 'Pain points', 'Opportunities', 'Funnel']); assert.deepEqual([idle.cards, idle.branches, idle.faces], [12, 2, 7]);
  const before = await query(page); assert.equal(idle.authored, 1); assert.deepEqual(idle.counts, route.map(id => before.snapshot.steps.find(s => s.id === id)!.reached), 'funnel counts equal the snapshot before the first step');
  assert.equal(await page.locator('#jtest .jm-pain').filter({hasText: 'Search results are slow.'}).count(), 1); assert.equal(await page.locator('#jtest .jm-opp').filter({hasText: 'Show best sellers first.'}).count(), 1);
  await page.locator('#advance').click(); for (let i = 0; i < 12; i++) await page.locator('#step').click();
  const running = await query(page); await redrawJourney(); const live = await journeyFacts(); const reached = new Map(running.snapshot.steps.map(s => [s.id, s.reached]));
  assert.deepEqual(live.counts, route.map(id => reached.get(id))); assert(live.counts[0]! > idle.counts[0]! && live.counts[0]! >= live.counts.at(-1)!, 'the funnel follows the run');
  assert.deepEqual(live.pcts, route.map(id => `${Math.round(reached.get(id)! * 100 / reached.get('start')!)}% of start`)); assert.equal(live.measured, 1, 'measured curve appears once the tracked field has data');
  await funnelAdds(route, reached, 'mid-run'); await tableColumns();
  // Work still in progress before a step is worded like the 2D cards: working, waiting (queued minus held) and blocked when held.
  const work = await page.evaluate(() => [...document.querySelectorAll('#jtest .jm-funnel')].map(c => ({
   wip: c.querySelector('.jm-wip')?.textContent ?? null, work: c.querySelector('.jm-work')?.textContent ?? null, label: c.getAttribute('aria-label')!})));
  assert(work.some(w => w.wip !== null), 'some cases are between two route steps mid-run');
  for (const w of work) {
   assert.equal(w.work !== null, w.wip !== null, 'work words appear exactly where cases are in progress');
   if (w.work !== null) {
    assert.match(w.work, /^\d+ working · \d+ waiting( · \d+ blocked)?$/, w.work);
    assert(w.label.includes(`still in progress before it (${w.work.split(' · ').join(', ')})`), w.label);
   }
  }
  assert.match(live.labels.find(l => l.startsWith('Browse the shop'))!, new RegExp(`^Browse the shop, Website, phase Consideration, feeling \\+1, ${reached.get('browse')} reached$`));
  assert.match(live.labels.find(l => l.startsWith('Order delivered'))!, /^Order delivered, End, goal, phase Delivery, \d+ reached$/); assert.match(live.summary, new RegExp(`Goals ${running.snapshot.metrics.goals} · Lost ${running.snapshot.metrics.lost}`));
  await page.locator('#jtest .jm-lane-name', {hasText: 'Funnel'}).waitFor(); assert.match(await page.locator('#jtest .jm-badge.goal').innerText(), /^Goal · \d+$/); assert.match(await page.locator('#jtest .jm-badge.lost').innerText(), /^Lost · \d+$/);
  await page.locator('#jtest .jm-card[data-step="browse"]').click(); assert.equal(await page.evaluate(() => (globalThis as any).jsel.at(-1)), 'browse');
  await page.locator('#jtest .jm-card[data-step="ad"]').focus(); await page.keyboard.press('ArrowRight'); assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.step), 'browse');
  await page.keyboard.press('Enter'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Space'); assert.deepEqual(await page.evaluate(() => (globalThis as any).jsel.slice(-3)), ['browse', 'browse', 'intent']);
  await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => (globalThis as any).jsel.at(-1)), null);
  await page.evaluate(() => {const w = globalThis as any, v = w.LWProcessStudio.query(); v.selected = 'checkout'; w.jsurface.draw(v);}); assert.equal(await page.locator('#jtest .jm-card[aria-pressed=true]').getAttribute('data-step'), 'checkout');
  await page.setViewportSize({width: 390, height: 900}); await redrawJourney();
  const phone = await page.evaluate(() => { const sc = document.querySelector('#jtest .jm-scroll') as HTMLElement, small = [...document.querySelectorAll('#jtest *')].filter(n => n.tagName !== 'title' && [...n.childNodes].some(c => c.nodeType === 3 && c.textContent!.trim())).map(n => parseFloat(getComputedStyle(n).fontSize)); return {page: document.documentElement.scrollWidth > innerWidth, inner: sc.scrollWidth > sc.clientWidth, min: Math.min(...small)}; });
  assert.deepEqual([phone.page, phone.inner], [false, true], 'the map scrolls inside its own container'); assert(phone.min >= 12, `smallest map text is ${phone.min}px`);
  await page.locator('#jtest .jm-fit').click(); assert.equal(await page.locator('#jtest .jm-fit').getAttribute('aria-pressed'), 'true'); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.setViewportSize({width: 1440, height: 1060}); assert.equal((await query(page)).snapshot.minute, running.snapshot.minute, 'drawing the map never ticks the run');
  // Finished run: nothing is in progress, so every gap between neighbouring steps is a loss, and a bounce is a loss only where it happened.
  for (let i = 0; i < 40 && (await query(page)).snapshot.status !== 'completed'; i++) await page.locator('#advance').click();
  const done = await query(page), final = new Map(done.snapshot.steps.map(s => [s.id, s.reached])); await redrawJourney();
  const finished = await funnelAdds(route, final, 'completed'); assert(finished.every(f => f.wip === null), 'a completed run has nothing in progress');
  assert.equal(finished[route.indexOf('support')]!.lost, final.get('lost')! - final.get('cart')!, 'bounces at "Interested?" are lost before support');
  assert.equal(finished[route.indexOf('confirm')]!.lost, final.get('cart')!, 'abandoned carts are lost after payment');
  // A plain process has no phases: one column, and a long chain stays inside its own scroller.
  const plain = await page.evaluate(() => {
   const w = globalThis as any, steps = Array.from({length: 26}, (_, i) => ({id: 's' + i, name: 'Step ' + i, kind: i === 0 ? 'start' : i === 25 ? 'end' : 'task', scene: {id: 'sc' + i, position: [i * 14, 0], color: '#fff'}})), view = {definition: {format: 'wildlands-process', schemaVersion: 1, revision: 0, id: 'long', name: 'Long', start: 's0', resources: [], steps, arrivals: [], flows: steps.slice(1).map((s, i) => ({id: 'f' + i, from: 's' + i, to: s.id}))}, selected: null,
    snapshot: {steps: steps.map((s, i) => ({id: s.id, reached: 100 - i, tracked: {}})), metrics: {goals: 0, lost: 0, conversion: null}}};
   document.getElementById('jtest')?.remove(); w.jsurface.dispose(); const host = document.createElement('div'); host.id = 'jtest'; document.body.append(host); w.jsurface = w.LWProcessJourney.create(host, () => {}); w.jsurface.draw(view);
   return {phases: [...host.querySelectorAll('.jm-phase-name')].map(n => n.textContent), cards: host.querySelectorAll('.jm-card').length, measured: host.querySelectorAll('.jm-line.measured').length, last: host.querySelectorAll('.jm-funnel .jm-count')[25]!.textContent};
  });
  assert.deepEqual(plain, {phases: ['Process'], cards: 26, measured: 0, last: '75'}); await tableColumns();
  // The onboarding demo: the email form loses no one to the social sign-up, which is a split that rejoins at the permissions prompt.
  const onboarding = JSON.parse(fs.readFileSync(path.join(gameDir, gameDefinitions.find(f => f.includes('onboarding'))!), 'utf8')) as LWProcess.Definition;
  const email = await page.evaluate(d => {
   // A separate detached run of the demo: the studio's own run never ticks here.
   const w = globalThis as any, s = w.LWProcessRuntime.create(d, {}), q = s.advance(600); s.dispose();
   w.jsurface.draw({definition: d, snapshot: q, selected: null});
   const labels = [...document.querySelectorAll('#jtest .jm-funnel')].map(c => c.getAttribute('aria-label')!);
   return {label: labels.find(l => l.startsWith('Fills in the email form'))!,
    split: [...document.querySelectorAll('#jtest .jm-split')].map(n => n.textContent)};
  }, onboarding);
  const rejoins = /^Fills in the email form: \d+ reached, \d+% of start, no drop-off, split after the previous step, rejoins at Sees the permissions prompt/;
  assert.match(email.label, rejoins, email.label);
  assert(email.split.includes('split, rejoins at Sees the permissions prompt'), JSON.stringify(email.split)); await tableColumns();
  await page.evaluate(() => {(globalThis as any).jsurface.dispose(); document.getElementById('jtest')?.remove();});
 });
 const modeOf = async () => (await query(page)).mode, minuteOf = async () => (await query(page)).snapshot.minute;
 const SIPOC_TITLE = 'SIPOC view: suppliers, inputs, process, outputs, customers', JOURNEY_TITLE = 'Journey map: stages, touchpoints, feeling, funnel';
 const lensState = (kind: 'sipoc' | 'journey') => page.evaluate(k => {
  const host = document.getElementById('lens')!, box = host.getBoundingClientRect(), shown = !host.hidden && box.width > 0;
  return {shown, sipoc: host.querySelectorAll('.sipoc').length, journey: host.querySelectorAll('.lw-journey').length, canvas: !document.getElementById('canvas')!.hidden, map: !document.getElementById('map')!.hidden, wanted: k, right: box.right, innerWidth};
 }, kind);
 await check('View lens follows the process type: SIPOC for processes, journey map for journeys, with the right default and selection', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await freshStudio();
  const journeyAt = (q: {definition: LWProcess.Definition}) => q.definition.genre === 'customer-journey' || q.definition.genre === 'user-journey';
  // The switcher is [2D] [3D] [lens] [Present] [Frame view]; a business process offers SIPOC only, with the stated title and pressed state.
  assert.deepEqual(await page.locator('.process-view-controls > button:not([hidden])').evaluateAll(b => b.map(x => x.id)), ['mode-2d', 'mode-3d', 'mode-lens', 'mode-present', 'frame']);
  const lensButton = page.locator('#mode-lens'); assert.equal(await lensButton.innerText(), 'SIPOC'); assert.equal(await lensButton.getAttribute('title'), SIPOC_TITLE); assert.equal(await lensButton.getAttribute('aria-label'), SIPOC_TITLE);
  assert.equal(await lensButton.getAttribute('aria-pressed'), 'false'); assert.equal(await page.locator('#mode-3d').getAttribute('aria-pressed'), 'true'); assert.equal(await modeOf(), '3d');
  // Keyboard: the lens button is a plain pressed-state toggle, activated with Enter like 2D and 3D.
  await lensButton.focus(); await page.keyboard.press('Enter'); await page.waitForFunction(() => document.getElementById('mode-lens')!.getAttribute('aria-pressed') === 'true');
  assert.equal(await modeOf(), 'lens'); assert.equal(await page.locator('#mode-3d').getAttribute('aria-pressed'), 'false'); assert.equal(await page.evaluate(() => document.activeElement?.id), 'mode-lens');
  let state = await lensState('sipoc'); assert.equal(state.shown, true); assert.equal(state.sipoc, 1); assert.equal(state.journey, 0); assert.equal(state.canvas, false); assert.equal(state.map, false);
  assert.equal(await minuteOf(), 0, 'switching the view never ticks');
  // Selecting a stage in the lens selects its first step, shows it in the inspector and keeps the lens; Escape clears it.
  const stage = page.locator('#lens .sipoc-stage').first(); await stage.click();
  const selected = (await query(page)).selected; assert(selected, 'the lens selected a step'); assert.equal(await modeOf(), 'lens'); assert.equal(await page.locator('#inspector-title').innerText(), 'Scene details'); assert.equal(await minuteOf(), 0);
  assert.equal(await page.locator(`[data-step="${selected}"]`).getAttribute('aria-current'), 'step'); assert.equal(await page.locator('#lens .sipoc-stage.selected').count(), 1);
  await page.keyboard.press('Escape'); await page.waitForFunction(() => (globalThis as any).LWProcessStudio.query().selected === null);
  assert.equal(await page.locator('#inspector-title').innerText(), 'Process overview'); assert.equal(await modeOf(), 'lens');
  await page.locator('#lens .sipoc-scroll').evaluate(e => { e.scrollLeft = 40; }); await page.locator('#frame').click(); assert.equal(await page.locator('#lens .sipoc-scroll').evaluate(e => e.scrollLeft), 0);
  // The game folder sets each process's type: business processes switch to their SIPOC lens and journeys open on their Journey map.
  // Leaving a journey map for a business process returns to the last flat view, so the lens is chosen again there.
  const seen: string[] = [];
  for (let i = 0; i < COUNT; i++) {
   if (i > 0) await switchTo(i);
   let q = await query(page); const journey = journeyAt(q);
   if (!journey && seen.at(-1) === 'journey') { assert.equal(q.mode, '3d', 'leaving a journey map returns to the last flat view'); await page.locator('#mode-lens').click(); q = await query(page); }
   seen.push(journey ? 'journey' : 'sipoc'); await nextFrames(page);
   assert.equal(q.mode, 'lens', 'process ' + (i + 1)); assert.equal(q.snapshot.minute, 0); assert.equal(q.selected, null);
   state = await lensState(journey ? 'journey' : 'sipoc'); assert.equal(state.shown, true); assert.equal(state.sipoc, journey ? 0 : 1, 'SIPOC for process ' + (i + 1)); assert.equal(state.journey, journey ? 1 : 0, 'Journey map for process ' + (i + 1));
   assert.equal(await lensButton.innerText(), journey ? 'Journey map' : 'SIPOC'); assert.equal(await lensButton.getAttribute('title'), journey ? JOURNEY_TITLE : SIPOC_TITLE); assert.equal(await lensButton.getAttribute('aria-pressed'), 'true');
   assert.equal(await page.locator('#mode-lens').count(), 1, 'only the matching lens is offered');
  }
  assert.deepEqual(seen, gameDefinitions.map(file => { const g = (JSON.parse(fs.readFileSync(path.join(gameDir, file), 'utf8')) as LWProcess.Definition).genre; return g === 'customer-journey' || g === 'user-journey' ? 'journey' : 'sipoc'; }));
  // On a journey, a card selects its step; the inspector shows it; Escape clears; nothing ticks.
  await switchTo(3); await nextFrames(page); const card = page.locator('#lens .jm-card').nth(1); await card.click(); const picked = (await query(page)).selected;
  assert(picked); assert.equal(await card.getAttribute('data-step'), picked); assert.equal(await page.locator('#inspector-title').innerText(), 'Scene details'); assert.equal(await minuteOf(), 0); assert.equal(await modeOf(), 'lens');
  await page.keyboard.press('Escape'); await page.waitForFunction(() => (globalThis as any).LWProcessStudio.query().selected === null); await page.locator('#frame').click();
  // The user's 2D choice is remembered across a journey: 2D on a journey, lens again, then back to a business process returns to 2D.
  await page.locator('#mode-2d').click(); assert.equal(await modeOf(), '2d'); assert.equal((await lensState('journey')).shown, false);
  await page.locator('#mode-lens').click(); await switchTo(4); assert.equal(await modeOf(), 'lens', 'a journey keeps its map when switching to another journey');
  await switchTo(0); assert.equal(await modeOf(), '2d', 'leaving a journey from its map returns to the last 2D or 3D choice'); assert.equal((await lensState('sipoc')).shown, false);
  await page.locator('#mode-3d').click(); await switchTo(3); assert.equal(await modeOf(), 'lens', 'a journey defaults to its map'); await page.locator('#mode-3d').click(); await switchTo(4); assert.equal(await modeOf(), '3d', 'an explicit 3D choice on a journey stays');
  await switchTo(0); assert.equal(await modeOf(), '3d'); assert.equal(await minuteOf(), 0);
  // Applying a draft that changes the process type swaps the lens, never the chosen view.
  await applyDraft(d => { d.genre = 'customer-journey'; }); assert.equal(await modeOf(), '3d', 'a 3D choice is not a lens and stays'); assert.equal(await lensButton.innerText(), 'Journey map'); assert.equal(await lensButton.getAttribute('title'), JOURNEY_TITLE);
  await lensButton.click(); state = await lensState('journey'); assert.equal(state.journey, 1); assert.equal(state.sipoc, 0);
  await applyDraft(d => { delete d.genre; }); assert.equal(await modeOf(), 'lens', 'the lens follows the new type'); state = await lensState('sipoc'); assert.equal(state.sipoc, 1); assert.equal(state.journey, 0); assert.equal(await lensButton.innerText(), 'SIPOC');
  await page.locator('#mode-3d').click(); assert.equal(await page.locator('#canvas').isVisible(), true); await lensButton.click(); await applyDraft(d => { d.name = 'Renamed agency'; }); assert.equal(await modeOf(), 'lens'); assert.equal((await lensState('sipoc')).sipoc, 1);
  // Phones: both lenses fit 390px with no page overflow.
  for (const index of [0, 3, 4]) {
   await switchTo(index); await page.setViewportSize({width: 390, height: 844}); await nextFrames(page);
   const q = await query(page); await page.locator('#mode-lens').click(); state = await lensState(q.definition.genre === 'process' || !q.definition.genre ? 'sipoc' : 'journey');
   assert.equal(state.shown, true); assert(state.right <= 390 + 1, `lens inside the viewport for process ${index + 1}`); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal page overflow for process ' + (index + 1));
   await page.setViewportSize({width: 1440, height: 1060});
  }
 });
 await check('Journey terminology, conversion and tracked measures appear for journey processes and not for business processes', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await freshStudio(); await showIo();
  const kpis = async () => Object.fromEntries(await page.locator('#metrics > div').evaluateAll(cells => cells.map(c => [c.querySelector('span')!.textContent, c.querySelector('strong')!.textContent])));
  const labelsOf = async () => Object.keys(await kpis());
  // The KPI strip: mean cycle beside the mean age of the cases in progress, then the work cost and the capacity-basis cost.
  const PROCESS_KPIS = ['Completed', 'In progress', 'Mean cycle', 'Mean age in progress', 'Work cost', 'Capacity cost', 'Failed'];
  const JOURNEY_KPIS = ['Finished', ...PROCESS_KPIS.slice(1)];
  // A business process keeps its wording and shows no journey numbers, even after it has run. Nothing has finished yet: Mean cycle is '—'.
  const fresh = await kpis(), m0 = (await query(page)).snapshot.metrics;
  const age0 = m0.meanAgeMinutes === null ? '—' : `${m0.meanAgeMinutes} min`;
  assert.deepEqual([fresh['Mean cycle'], fresh['Mean age in progress'], m0.completed], ['—', age0, 0]);
  assert.deepEqual(await labelsOf(), PROCESS_KPIS); assert.equal(await page.locator('#steps-heading').innerText(), 'Steps');
  assert.equal(await page.locator('label[for="process-case"]').innerText(), 'Case'); assert.match(await page.locator('#scene-subtitle').innerText(), /\d cases? admitted$/);
  for (let i = 0; i < 6; i++) await page.locator('#advance').click();
  const ran = (await query(page)).snapshot, after = await kpis(); assert(ran.metrics.completed > 0);
  assert.equal(after['Mean cycle'], Number(ran.metrics.meanCycleMinutes.toFixed(1)).toLocaleString() + ' min');
  assert.equal(after['Capacity cost'], Number(ran.metrics.capacityCost.toFixed(1)).toLocaleString());
  assert.deepEqual(await labelsOf(), PROCESS_KPIS); assert.doesNotMatch(await page.locator('#inspector').innerText(), /Process type|Tracked measures|Conversion/);
  await page.locator('#open-activity').click(); await page.locator('dialog.act-dialog[open]').waitFor(); assert.equal(await page.locator('#act-case-label').innerText(), 'Case'); assert.equal(await page.locator('#act-case option').first().innerText(), 'All cases'); await page.keyboard.press('Escape'); await page.locator('dialog.act-dialog[open]').waitFor({state: 'hidden'});
  // The two journeys: customers and users, journey headings, and conversion with tracked measures once cases have finished.
  for (const [index, one, many, label, tracked] of [[3, 'customer', 'customers', 'Customer journey', 'Customer sentiment'], [4, 'user', 'users', 'User journey', 'Sessions']] as const) {
   await switchTo(index); await showIo(); const def = (await query(page)).definition;
   assert.equal(await page.locator('#steps-heading').innerText(), 'Touchpoints and steps'); assert.equal(await page.locator('label[for="process-case"]').innerText(), one[0]!.toUpperCase() + one.slice(1));
   assert.match(await page.locator('#scene-subtitle').innerText(), new RegExp(`\\d ${one}s? admitted$`)); assert.deepEqual(await labelsOf(), JOURNEY_KPIS);
   assert.match(await page.locator('#inspector').innerText(), new RegExp(`Process type\\s+${label}`)); assert.doesNotMatch(await page.locator('#inspector [aria-label="Arrival streams"]').innerText(), /\bcases?\b/i);
   for (let i = 0; i < 80; i++) { const m = (await query(page)).snapshot.metrics; if (m.goals + m.lost >= 3 && Object.values(m.tracked).every(t => t.n > 0)) break; await page.locator('#advance').click(); }
   const q = await query(page), m = q.snapshot.metrics; assert(m.goals + m.lost >= 3 && m.conversion !== null, 'the journey finished with outcomes'); assert.equal(q.snapshot.minute > 0, true);
   const cells = await kpis(), names = Object.keys(cells); assert.deepEqual(names.slice(0, 4), ['Finished', 'Goals', 'Lost', 'Conversion']);
   assert.equal(cells.Goals, String(m.goals)); assert.equal(cells.Lost, String(m.lost)); assert.equal(cells.Conversion, (m.conversion! / 10).toFixed(1) + '%');
   const extra = names.filter(n => n.endsWith(' (avg)')); assert.equal(extra.length, Math.min(2, def.track!.length)); assert(extra.includes(tracked + ' (avg)'), JSON.stringify(extra));
   for (const t of def.track!.slice(0, 2)) assert.equal(cells[(t.label ?? t.field) + ' (avg)'], String(Number(m.tracked[t.field]!.mean!.toFixed(2))));
   // Overview: every tracked measure with its average and range; activity names the cases with the journey word.
   assert.match(await page.locator('#inspector').innerText(), /Tracked measures/); for (const t of def.track!) assert.match(await page.locator('#inspector').innerText(), new RegExp(t.label ?? t.field));
   // Step inspector: phase, channel, feeling words, pain, opportunity, funnel numbers and the tracked average on entry.
   const touch = def.steps.find(s => s.kind === 'touchpoint' && s.channel && s.emotion !== undefined && s.pain && s.opportunity)!; await page.locator(`#steps [data-step="${touch.id}"]`).click();
   const text = await page.locator('#inspector').innerText(), metric = q.snapshot.steps.find(s => s.id === touch.id)!, v = (name: string) => page.evaluate(([n, c, e]) => { const api = (globalThis as any).LWProcessRandomView; return n === 'channel' ? api.describeChannel(c) : api.describeEmotion(e); }, [name, touch.channel, touch.emotion]);
   assert.match(text, new RegExp('Phase\\s+' + touch.phase)); assert.match(text, new RegExp('Channel\\s+' + (await v('channel')))); assert.match(text, new RegExp('Feeling\\s+' + (await v('feeling')))); assert.match(text, /Pain point/); assert.match(text, /Opportunity/);
   assert.match(text, new RegExp(`Reached\\s+[\\d,]+ ${many}`)); assert.match(text, /Entered\s+[\d,]+ times?/);
   const first = def.track![0]!, seen = (await query(page)).snapshot.steps.filter(s => s.tracked[first.field]?.n).map(s => s.id);
   if (seen.length) { await page.locator(`#steps [data-step="${seen[0]}"]`).click(); assert.match(await page.locator('#inspector').innerText(), new RegExp(`Average ${first.label ?? first.field} on entry\\s+-?[\\d.]+`)); }
   assert(metric.reached >= 0); const end = def.steps.find(s => s.kind === 'end' && s.outcome === 'goal')!; await page.locator(`#steps [data-step="${end.id}"]`).click(); assert.match(await page.locator('#inspector').innerText(), /Goal reached/);
   await page.locator('#overview').click(); await page.locator('#open-activity').click(); await page.locator('dialog.act-dialog[open]').waitFor();
   assert.equal(await page.locator('#act-case-label').innerText(), one[0]!.toUpperCase() + one.slice(1)); assert.equal(await page.locator('#act-case option').first().innerText(), 'All ' + many); await page.keyboard.press('Escape'); await page.locator('dialog.act-dialog[open]').waitFor({state: 'hidden'});
  }
  await switchTo(0); assert.deepEqual(await labelsOf(), PROCESS_KPIS); assert.equal(await page.locator('#steps-heading').innerText(), 'Steps');
  assert.equal(await page.locator('label[for="process-case"]').innerText(), 'Case');
 });
 await checkLifecycle('Process lenses browser lifecycle emits no runtime errors or network requests');
});
