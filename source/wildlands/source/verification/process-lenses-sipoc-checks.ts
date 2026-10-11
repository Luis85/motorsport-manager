/// <reference path="../process-contracts.d.ts" />
/**
 * SIPOC lens checks of the process lenses suite (process-lenses-browser.ts calls `sipocLensChecks` once, in its own order):
 * the pure SIPOC model (suppliers, inputs, stages, outputs, customers and measures) and the DOM lens mounted on a host beside
 * the studio, fed the studio controller's detached views; live stage counts, redraw only on change, stage selection, the
 * phase grouping and its fallback for ungrouped processes, and the stacked phone layout.
 */
import assert from 'node:assert/strict';
import {nextFrames} from './browser-harness';
import {query, type Studio} from './process-browser-fixture';

export async function sipocLensChecks(studio: Studio): Promise<void> {
 const {page, check, freshStudio} = studio;
 // SIPOC lens: the pure model and the DOM lens mounted on a host beside the studio, fed by the studio controller's detached views.
 const mountSipoc = (def: object) => page.evaluate(d => {
  const w = globalThis as any, old = document.getElementById('sipoc-host'); old?.remove(); w.__sipoc?.dispose();
  const host = document.createElement('div');
  host.id = 'sipoc-host';
  host.style.cssText = 'width:100%;max-width:100%';
  document.body.append(host);
  w.__picks = [];
  w.__def = d;
  w.__sipoc = w.LWProcessSipoc.create(host, (id: string | null) => w.__picks.push(id)); w.__sipoc.draw({...w.LWProcessStudio.query(), definition: d});
 }, def);
 const redrawSipoc = (selected: string | null = null) => page.evaluate(sel => {
  const w = globalThis as any;
  w.__sipoc.draw({...w.LWProcessStudio.query(), definition: w.__def, selected: sel});
 }, selected);
 const unmountSipoc = () => page.evaluate(() => { const w = globalThis as any; w.__sipoc?.dispose(); document.getElementById('sipoc-host')?.remove(); });
 await check('SIPOC view derives suppliers, inputs, process stages, outputs and customers and shows live counts', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await freshStudio();
  const def = JSON.parse(JSON.stringify((await query(page)).definition)) as any,
   phase = (ids: string[], name: string) => ids.forEach(id => { def.steps.find((s: any) => s.id === id).phase = name; });
  phase(['discovery'], 'Discover');
  phase(['design-split', 'product-design', 'architecture', 'design-ready'], 'Design');
  phase(['implementation', 'qa', 'review-gate', 'rework'], 'Build');
  phase(['handover'], 'Deliver');
  def.steps.find((s: any) => s.id === 'handover').outputs = [{field: 'delivery', label: 'Delivered feature'}];
  def.steps.find((s: any) => s.id === 'discovery').needs = [{field: 'brief', label: 'Client brief'}];
  def.arrivals[0].draws = [{field: 'budget', kind: 'int', min: 1, max: 5}];
  def.sipoc = {suppliers: [{name: 'Client', supplies: 'brief and budget'}],
   customers: [{name: 'Product owner', receives: 'a working feature'}, {name: 'End users'}]};
  const model = (await page.evaluate(d => {
   const w = globalThis as any;
   return w.LWProcessSipoc.model(d, w.LWProcessStudio.query().snapshot);
  }, def)) as LWProcessSipoc.Model;
  assert.deepEqual(model.suppliers, [{name: 'Client', detail: 'brief and budget'}]);
  assert.deepEqual(model.customers, [{name: 'Product owner', detail: 'a working feature'}, {name: 'End users'}]);
  assert.deepEqual(model.inputs.map(i => i.field), ['needsRework', 'priority', 'budget', 'brief']);
  const byField = (f: string) => model.inputs.find(i => i.field === f)!;
  const rework = byField('needsRework');
  assert.deepEqual([rework.label, rework.example], ['needsRework', 'false, true'], 'a need condition label never names the input');
  assert.equal(byField('priority').example, '2, 1');
  assert.equal(byField('budget').example, 'random, 1 to 5');
  assert.deepEqual([byField('brief').label, byField('brief').arrived, byField('brief').example], ['Client brief', null, null]);
  assert.equal(byField('priority').arrived, 1);
  assert.deepEqual(model.stages.map(s => s.name), ['Discover', 'Design', 'Build', 'Deliver']);
  const stage = (n: string) => model.stages.find(s => s.name === n)!;
  assert.deepEqual([stage('Design').steps, stage('Design').parallel, stage('Design').variant, stage('Design').first], [4, true, false, 'design-split']);
  assert.deepEqual([stage('Build').steps, stage('Build').variant, stage('Discover').variant], [4, true, false]);
  assert(stage('Build').stepIds.includes('rework') && stage('Build').kinds.includes('decision'));
  assert.deepEqual(model.outputs.map(o => o.label), ['Delivered feature', 'Reached Delivered']);
  assert.deepEqual(model.measures.map(m => m.id).slice(0, 7), ['completed', 'active', 'cycle', 'age', 'cost', 'capacity-cost', 'throughput']);
  const costs = model.measures.filter(m => ['cycle', 'cost', 'capacity-cost'].includes(m.id)).map(m => [m.label, m.value]);
  const started = (await query(page)).snapshot.metrics.cost;
  assert.deepEqual(costs, [['Mean cycle', '—'], ['Work cost', String(started)], ['Capacity cost', '0']], 'nothing has finished at minute 0');
  await mountSipoc(def); const host = page.locator('#sipoc-host');
  assert.deepEqual(await host.locator('.sipoc-col > h3').allInnerTexts(), ['S\nSuppliers', 'I\nInputs', 'P\nProcess', 'O\nOutputs', 'C\nCustomers']);
  assert.equal(await host.locator('section.sipoc-col[aria-labelledby]').count(), 5);
  assert.equal(await host.locator('.sipoc-col-suppliers').innerText().then(t => /Client/.test(t) && /brief and budget/.test(t)), true);
  // Stage work uses the studio's words (LWProcessWorkState): working people, waiting = queued minus held, blocked only when held.
  const stageLabels = await host.locator('.sipoc-stage').evaluateAll(b => b.map(x => x.getAttribute('aria-label')));
  assert.deepEqual(stageLabels, ['Stage Discover, 1 step, 1 working, 0 waiting, 0 completed',
   'Stage Design, 4 steps, 0 working, 0 waiting, 0 completed', 'Stage Build, 4 steps, 0 working, 0 waiting, 0 completed, has alternative paths',
   'Stage Deliver, 1 step, 0 working, 0 waiting, 0 completed']);
  assert.deepEqual(await host.locator('.sipoc-stage').first().locator('.sipoc-count').allInnerTexts(), ['1 working', '0 waiting', '0 completed']);
  assert.equal(await host.locator('.sipoc-tag-variant').count(), 1);
  assert.equal(await host.locator('.sipoc-stage', {hasText: 'in parallel'}).count(), 1);
  assert.match(await host.locator('.sipoc-col-inputs').innerText(), /Client brief/);
  assert.match(await host.locator('.sipoc-col-inputs').innerText(), /1 case arrived/);
  const unchanged = await host.evaluate(h => { const first = h.querySelector('.sipoc-grid'); (first as any).__mark = 1; return true; });
  await redrawSipoc();
  assert.equal(await host.evaluate(h => (h.querySelector('.sipoc-grid') as any).__mark), 1, 'identical view must not redraw');
  assert(unchanged);
  await page.locator('#horizon').selectOption('100000');
  await page.locator('#advance').click();
  await page.waitForFunction(() => (globalThis as any).LWProcessStudio.query().snapshot.minute > 0);
  await page.locator('#advance').click();
  await redrawSipoc();
  const live = await host.locator('.sipoc-stage').evaluateAll(b => b.map(x => x.getAttribute('aria-label')!));
  assert(live.some(l => /[1-9]\d* (working|waiting)|[1-9]\d* completed/.test(l)), live.join('|'));
  // A stage counts the cases that left it: never more than arrived, and Discover is left by exactly the cases that reached the design fork.
  const ran = await query(page);
  const after = await page.evaluate(d => {
   const w = globalThis as any; return w.LWProcessSipoc.model(d, w.LWProcessStudio.query().snapshot);
  }, def) as LWProcessSipoc.Model;
  assert(after.stages.every(s => s.completed <= ran.snapshot.metrics.arrived), JSON.stringify(after.stages.map(s => s.completed)));
  assert.equal(after.stages[0]!.completed, ran.snapshot.steps.find(s => s.id === 'design-split')!.reached);
  assert.match(await host.locator('.sipoc-col-inputs').innerText(), /[1-9]\d* cases? arrived/);
  assert.notEqual(await host.locator('.sipoc-measure', {hasText: 'Mean cycle'}).count(), 0);
  assert.equal(await host.locator('.sipoc-measure', {hasText: /^In progress/}).locator('dd').innerText() !== '0'
   || (await query(page)).snapshot.metrics.active === 0, true);
  await host.locator('.sipoc-stage', {hasText: 'Design'}).click(); assert.deepEqual(await page.evaluate(() => (globalThis as any).__picks), ['design-split']);
  await redrawSipoc('design-split');
  assert.equal(await host.locator('.sipoc-stage[aria-pressed=true]').count(), 1);
  assert.match((await host.locator('.sipoc-stage[aria-pressed=true]').getAttribute('aria-label'))!, /^Stage Design/);
  await unmountSipoc(); assert.equal(await page.locator('#sipoc-host').count(), 0);
 });
 await check('SIPOC view groups steps by phase, falls back for ungrouped processes and stays readable on phones', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await freshStudio();
  const agency = JSON.parse(JSON.stringify((await query(page)).definition)) as any; for (const s of agency.steps) delete s.phase; delete agency.sipoc;
  const long = {...agency, start: 's0',
   steps: Array.from({length: 11}, (_, i) => ({id: 's' + i, name: 'Step ' + i, kind: i === 10 ? 'end' : 'task',
    scene: {id: 'office', position: [i, 0], color: '#fff'}})),
   flows: Array.from({length: 10}, (_, i) => ({id: 'f' + i, from: 's' + i, to: 's' + (i + 1)})), arrivals: []};
  const sizes = await page.evaluate(([a, l]) => {
   const w = globalThis as any, q = w.LWProcessStudio.query().snapshot, A = w.LWProcessSipoc.model(a, q), L = w.LWProcessSipoc.model(l, q);
   return {agency: A.stages.map((s: any) => s.name), long: L.stages.map((s: any) => [s.name, s.steps]), suppliers: A.suppliers, customers: A.customers};
  }, [agency, long]);
  assert(sizes.agency.length >= 3 && sizes.agency.length <= 7, sizes.agency.join());
  assert.deepEqual(sizes.agency, ['Discovery', 'Plan together', 'Implementation', 'Quality review', 'Client handover']);
  assert.equal(sizes.long.length, 7);
  assert.equal(sizes.long.reduce((n: number, s: any) => n + s[1], 0), 10);
  assert(sizes.long.some((s: any) => /^Step \d+ and \d+ more steps?$/.test(s[0])), JSON.stringify(sizes.long));
  assert.deepEqual([sizes.suppliers[0].placeholder, sizes.suppliers[0].name, sizes.customers[0].name],
   [true, 'Add suppliers in Edit process', 'Add customers in Edit process']);
  await mountSipoc(agency); const host = page.locator('#sipoc-host'); assert.equal(await host.locator('.sipoc-stage').count(), sizes.agency.length);
  assert.match(await host.locator('.sipoc-col-suppliers').innerText(), /Add suppliers in Edit process/);
  assert.match(await host.locator('.sipoc-col-customers').innerText(), /Add customers in Edit process/);
  const phased = JSON.parse(JSON.stringify(agency)); phased.steps.forEach((s: any, i: number) => { s.phase = i < 4 ? 'Early' : 'Late'; });
  assert.deepEqual(await page.evaluate(
   p => (globalThis as any).LWProcessSipoc.model(p, (globalThis as any).LWProcessStudio.query().snapshot).stages.map((s: any) => s.name), phased),
  ['Early', 'Late']);
  await page.setViewportSize({width: 390, height: 844}); await nextFrames(page); await redrawSipoc();
  const geo = await page.evaluate(() => {
   const host = document.getElementById('sipoc-host')!, cols = [...host.querySelectorAll('.sipoc-col')].map(c => c.getBoundingClientRect()),
    scroll = host.querySelector('.sipoc-scroll') as HTMLElement;
   const sizes = [...host.querySelectorAll('*')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent!.trim()))
    .map(e => parseFloat(getComputedStyle(e).fontSize));
   const buttons = [...host.querySelectorAll('.sipoc-stage')].map(b => b.getBoundingClientRect());
   return {stacked: cols.every((c, i) => i === 0 || (c.top >= cols[i - 1]!.bottom - 1 && Math.abs(c.left - cols[0]!.left) < 1)),
    pageOverflow: document.documentElement.scrollWidth > innerWidth, scrollOverflow: scroll.scrollWidth > scroll.clientWidth + 1, minFont: Math.min(...sizes),
    inside: buttons.every(b => b.left >= 0 && b.right <= innerWidth), ordered: buttons.every((b, i) => i === 0 || b.top > buttons[i - 1]!.top)};
  });
  assert.deepEqual(geo, {stacked: true, pageOverflow: false, scrollOverflow: false, minFont: geo.minFont, inside: true, ordered: true});
  assert(geo.minFont >= 12, 'font ' + geo.minFont);
  await unmountSipoc(); await page.setViewportSize({width: 1440, height: 1060});
 });
}
