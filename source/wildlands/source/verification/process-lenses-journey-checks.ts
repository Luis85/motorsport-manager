/// <reference path="../process-contracts.d.ts" />
/**
 * Journey map lens checks of the process lenses suite (process-lenses-browser.ts calls `journeyMapChecks` once, in its own
 * order): the Journey map mounted on a host beside the studio and fed the studio controller's detached views; its phases,
 * touchpoint lanes, feeling curve, pain points and opportunities; funnel counts that add up mid-run and after the run; the
 * table columns, keyboard selection and phone layout; a plain process and a split that rejoins in the onboarding demo.
 * Drawing the map never ticks the studio's run.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {query, type Studio} from './process-browser-fixture';
import {journeyFixture} from './process-browser-models';

export async function journeyMapChecks(studio: Studio): Promise<void> {
 const {page, gameDir, gameDefinitions, check, freshStudio, applyDraft} = studio;
 const mountJourney = () => page.evaluate(() => {
  const w = globalThis as any;
  w.jsurface?.dispose();
  document.getElementById('jtest')?.remove();
  const host = document.createElement('div');
  host.id = 'jtest';
  document.body.append(host);
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
  return {phases: text('.jm-phase-name'), lanes: text('.jm-lane-name'), cards: document.querySelectorAll('#jtest .jm-card').length,
   branches: document.querySelectorAll('#jtest .jm-card.branch').length, faces: document.querySelectorAll('#jtest .jm-face').length,
   authored: document.querySelectorAll('#jtest .jm-line:not(.measured)').length, measured: document.querySelectorAll('#jtest .jm-line.measured').length,
   counts: text('.jm-funnel .jm-count').map(Number), pcts: text('.jm-funnel .jm-pct'),
   labels: [...document.querySelectorAll('#jtest .jm-card')].map(n => n.getAttribute('aria-label')!), summary: text('.jm-summary')[0]!,
   region: document.querySelector('#jtest [role=region]')?.getAttribute('aria-label')};
 });
 await check('Journey map lays out phases, touchpoints, emotion curve, pain points and live funnel counts', async () => {
  await freshStudio();
  await applyDraft(journeyFixture);
  await page.locator('#mode-2d').click();
  assert.equal((await query(page)).definition.id, 'journey-fixture');
  await mountJourney(); const route = ['start', 'ad', 'browse', 'intent', 'support', 'checkout', 'paid', 'confirm', 'delivery', 'won'];
  const idle = await journeyFacts();
  assert.equal(idle.region, 'Journey map');
  assert.deepEqual(idle.phases, ['Awareness', 'Consideration', 'Purchase', 'Delivery']);
  assert.deepEqual(idle.lanes, ['Phase', 'Touchpoints', 'Branches', 'Channel', 'Feeling', 'Pain points', 'Opportunities', 'Funnel']);
  assert.deepEqual([idle.cards, idle.branches, idle.faces], [12, 2, 7]);
  const before = await query(page);
  assert.equal(idle.authored, 1);
  assert.deepEqual(idle.counts, route.map(id => before.snapshot.steps.find(s => s.id === id)!.reached),
   'funnel counts equal the snapshot before the first step');
  assert.equal(await page.locator('#jtest .jm-pain').filter({hasText: 'Search results are slow.'}).count(), 1);
  assert.equal(await page.locator('#jtest .jm-opp').filter({hasText: 'Show best sellers first.'}).count(), 1);
  await page.locator('#advance').click(); for (let i = 0; i < 12; i++) await page.locator('#step').click();
  const running = await query(page);
  await redrawJourney();
  const live = await journeyFacts();
  const reached = new Map(running.snapshot.steps.map(s => [s.id, s.reached]));
  assert.deepEqual(live.counts, route.map(id => reached.get(id)));
  assert(live.counts[0]! > idle.counts[0]! && live.counts[0]! >= live.counts.at(-1)!, 'the funnel follows the run');
  assert.deepEqual(live.pcts, route.map(id => `${Math.round(reached.get(id)! * 100 / reached.get('start')!)}% of start`));
  assert.equal(live.measured, 1, 'measured curve appears once the tracked field has data');
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
  assert.match(live.labels.find(l => l.startsWith('Browse the shop'))!,
   new RegExp(`^Browse the shop, Website, phase Consideration, feeling \\+1, ${reached.get('browse')} reached$`));
  assert.match(live.labels.find(l => l.startsWith('Order delivered'))!, /^Order delivered, End, goal, phase Delivery, \d+ reached$/);
  assert.match(live.summary, new RegExp(`Goals ${running.snapshot.metrics.goals} · Lost ${running.snapshot.metrics.lost}`));
  await page.locator('#jtest .jm-lane-name', {hasText: 'Funnel'}).waitFor();
  assert.match(await page.locator('#jtest .jm-badge.goal').innerText(), /^Goal · \d+$/);
  assert.match(await page.locator('#jtest .jm-badge.lost').innerText(), /^Lost · \d+$/);
  await page.locator('#jtest .jm-card[data-step="browse"]').click(); assert.equal(await page.evaluate(() => (globalThis as any).jsel.at(-1)), 'browse');
  await page.locator('#jtest .jm-card[data-step="ad"]').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.step), 'browse');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  assert.deepEqual(await page.evaluate(() => (globalThis as any).jsel.slice(-3)), ['browse', 'browse', 'intent']);
  await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => (globalThis as any).jsel.at(-1)), null);
  await page.evaluate(() => {const w = globalThis as any, v = w.LWProcessStudio.query(); v.selected = 'checkout'; w.jsurface.draw(v);});
  assert.equal(await page.locator('#jtest .jm-card[aria-pressed=true]').getAttribute('data-step'), 'checkout');
  await page.setViewportSize({width: 390, height: 900}); await redrawJourney();
  const phone = await page.evaluate(() => {
   const sc = document.querySelector('#jtest .jm-scroll') as HTMLElement,
    small = [...document.querySelectorAll('#jtest *')]
     .filter(n => n.tagName !== 'title' && [...n.childNodes].some(c => c.nodeType === 3 && c.textContent!.trim()))
     .map(n => parseFloat(getComputedStyle(n).fontSize));
   return {page: document.documentElement.scrollWidth > innerWidth, inner: sc.scrollWidth > sc.clientWidth, min: Math.min(...small)};
  });
  assert.deepEqual([phone.page, phone.inner], [false, true], 'the map scrolls inside its own container');
  assert(phone.min >= 12, `smallest map text is ${phone.min}px`);
  await page.locator('#jtest .jm-fit').click();
  assert.equal(await page.locator('#jtest .jm-fit').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.setViewportSize({width: 1440, height: 1060});
  assert.equal((await query(page)).snapshot.minute, running.snapshot.minute, 'drawing the map never ticks the run');
  // Finished run: nothing is in progress, so every gap between neighbouring steps is a loss, and a bounce is a loss only where it happened.
  for (let i = 0; i < 40 && (await query(page)).snapshot.status !== 'completed'; i++) await page.locator('#advance').click();
  const done = await query(page), final = new Map(done.snapshot.steps.map(s => [s.id, s.reached])); await redrawJourney();
  const finished = await funnelAdds(route, final, 'completed'); assert(finished.every(f => f.wip === null), 'a completed run has nothing in progress');
  assert.equal(finished[route.indexOf('support')]!.lost, final.get('lost')! - final.get('cart')!, 'bounces at "Interested?" are lost before support');
  assert.equal(finished[route.indexOf('confirm')]!.lost, final.get('cart')!, 'abandoned carts are lost after payment');
  // A plain process has no phases: one column, and a long chain stays inside its own scroller.
  const plain = await page.evaluate(() => {
   const w = globalThis as any,
    steps = Array.from({length: 26}, (_, i) => ({id: 's' + i, name: 'Step ' + i, kind: i === 0 ? 'start' : i === 25 ? 'end' : 'task',
     scene: {id: 'sc' + i, position: [i * 14, 0], color: '#fff'}})),
    view = {definition: {format: 'wildlands-process', schemaVersion: 1, revision: 0, id: 'long', name: 'Long', start: 's0', resources: [], steps,
     arrivals: [], flows: steps.slice(1).map((s, i) => ({id: 'f' + i, from: 's' + i, to: s.id}))}, selected: null,
    snapshot: {steps: steps.map((s, i) => ({id: s.id, reached: 100 - i, tracked: {}})), metrics: {goals: 0, lost: 0, conversion: null}}};
   document.getElementById('jtest')?.remove();
   w.jsurface.dispose();
   const host = document.createElement('div');
   host.id = 'jtest';
   document.body.append(host);
   w.jsurface = w.LWProcessJourney.create(host, () => {});
   w.jsurface.draw(view);
   return {phases: [...host.querySelectorAll('.jm-phase-name')].map(n => n.textContent), cards: host.querySelectorAll('.jm-card').length,
    measured: host.querySelectorAll('.jm-line.measured').length, last: host.querySelectorAll('.jm-funnel .jm-count')[25]!.textContent};
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
}
