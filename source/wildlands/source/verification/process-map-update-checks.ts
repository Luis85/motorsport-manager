/// <reference path="../process-contracts.d.ts" />
/**
 * 2D map checks of the renderers suite (process-renderers-browser.ts calls `mapUpdateChecks`): keyed in-place updates across ticks,
 * the roving tab stop and its keys, drag-to-move through the `move` option, and outcome badge geometry. Each check acts through the
 * studio's controls or a throw-away map created with `LWProcess2D.create`, and asserts that nothing ticks or changes the definition.
 */
import assert from 'node:assert/strict';
import {nextFrames} from './browser-harness';
import {query, type Studio} from './process-browser-fixture';
import type {Page} from 'playwright';
import {encoding, waitingAt, badges, renderedFamilies} from './process-map-probe';

/**
 * Draws the studio's current view into a throw-away map in a host of the live map's size and compares the markup: whether they are
 * equal, the live card count and both viewBoxes (for the failure message).
 */
const freshDraw = (page: Page) => page.evaluate(() => {
 const w = globalThis as any, live = document.querySelector('#map svg')!, box = live.getBoundingClientRect();
 const host = document.createElement('div');
 host.style.cssText = `position:fixed;left:0;top:0;width:${box.width}px;height:${box.height}px`;
 document.body.append(host);
 const surface = w.LWProcess2D.create(host, () => {});
 try {
  const svg = host.querySelector('svg')!;
  svg.style.cssText = 'width:100%;height:100%;display:block';
  surface.draw(w.LWProcessStudio.query());
  return {equal: svg.innerHTML === live.innerHTML, cards: live.querySelectorAll('g[role=button]').length,
   live: live.getAttribute('viewBox'), fresh: svg.getAttribute('viewBox')};
 } finally { surface.dispose(); host.remove(); }
});

interface CameraView {box: string; size: [number, number]; strip: number; column: number}
/**
 * The live map's viewBox and svg size once the rendering update has run (a resize is redrawn before it is painted), and the room the
 * dock takes under or beside the map (LWProcessMapCamera reserves one of them, with a 6px gap, and centres the camera in the rest).
 */
async function camera(page: Page): Promise<CameraView> {
 await nextFrames(page, 2);
 return page.evaluate(() => {
  const svg = document.querySelector('#map svg')!, r = svg.getBoundingClientRect();
  const d = document.querySelector('#map .process-map-dock')!.getBoundingClientRect();
  return {box: svg.getAttribute('viewBox')!, size: [r.width, r.height] as [number, number], strip: r.bottom - d.top + 6, column: r.right - d.left + 6};
 });
}
/**
 * A kept camera: with the same svg size the exact same viewBox. After a real resize the same scale (pixels per world unit) and the
 * same world point at the middle of the area clear of the dock, so the reader's zoom and focus stay and only the edges of the view
 * follow the svg. The camera reserves the strip under the dock or the column beside it, whichever leaves the larger scale for the
 * whole map, and a resize may change that choice: the centre is kept for one of the two reservations before and after.
 */
function keptView(before: CameraView, after: CameraView, label: string): void {
 if (before.size[0] === after.size[0] && before.size[1] === after.size[1]) { assert.equal(after.box, before.box, label); return; }
 const view = (c: CameraView) => {
  const [x, y, w, h] = c.box.split(' ').map(Number) as [number, number, number, number], k = c.size[0] / w, [W, H] = c.size;
  return {kx: k, ky: H / h, centres: [[x + W / 2 / k, y + (H - c.strip) / 2 / k], [x + (W - c.column) / 2 / k, y + H / 2 / k]]};
 };
 const a = view(before), b = view(after), near = (p: number, q: number) => Math.abs(p - q) <= 1e-6 * Math.max(1, Math.abs(p));
 const where = `(svg ${before.size.join('x')} -> ${after.size.join('x')}, viewBox ${before.box} -> ${after.box})`;
 assert(near(a.kx, b.kx) && near(a.ky, b.ky), `${label}: the scale ${a.kx} became ${b.kx} ${where}`);
 const kept = a.centres.some(p => b.centres.some(q => near(p[0]!, q[0]!) && near(p[1]!, q[1]!)));
 assert(kept, `${label}: the centre moved ${JSON.stringify([a.centres, b.centres])} ${where}`);
}

export async function mapUpdateChecks(studio: Studio): Promise<void> {
 const {page, check, freshStudio, switchTo} = studio;
 const DEJAVU = '*{font-family:"DejaVu Sans",sans-serif !important}';
 await check('2D map refreshes in place: card groups keep their identity across ticks, only changed attributes mutate, '
  + 'and after many ticks the map matches a fresh draw', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await freshStudio(); await page.locator('#mode-2d').click();
  await page.evaluate(() => {
   const svg = document.querySelector('#map svg')!, w = globalThis as any;
   w.__cards = [...svg.querySelectorAll('g[role=button]')];
   w.__log = {svgChildren: 0, removedCards: 0, attributes: 0, unchanged: 0, texts: 0};
   w.__observer = new MutationObserver((list: MutationRecord[]) => {
    for (const m of list) {
     if (m.type === 'attributes') {
      w.__log.attributes++;
      if ((m.target as Element).getAttribute(m.attributeName!) === m.oldValue) w.__log.unchanged++;
     } else if (m.type === 'childList') {
      if (m.target === svg) w.__log.svgChildren += m.addedNodes.length + m.removedNodes.length;
      for (const n of m.removedNodes) if ((n as Element).matches?.('g[role=button]')) w.__log.removedCards++;
      if ([...m.addedNodes, ...m.removedNodes].some(n => n.nodeType === Node.TEXT_NODE)) w.__log.texts++;
     }
    }
   });
   w.__observer.observe(svg, {subtree: true, childList: true, attributes: true, attributeOldValue: true, characterData: true});
  });
  const before = (await query(page)).snapshot.minute;
  for (let i = 0; i < 5; i++) await page.locator('#step').click();
  const facts = await page.evaluate(() => {
   const w = globalThis as any, svg = document.querySelector('#map svg')!;
   w.__observer.takeRecords(); w.__observer.disconnect();
   const total = [...svg.querySelectorAll('*')].reduce((n, e) => n + e.attributes.length, 0);
   const kept = w.__cards.every((g: Element) => g.isConnected && document.getElementById(g.id) === g);
   return {...w.__log, total, kept};
  });
  assert.equal((await query(page)).snapshot.minute, before + 5, 'five ticks ran');
  assert.equal(facts.kept, true, 'every card group is the same element after five ticks');
  assert.deepEqual([facts.svgChildren, facts.removedCards, facts.unchanged], [0, 0, 0], JSON.stringify(facts));
  assert(facts.attributes > 0 && facts.attributes < facts.total / 2, `${facts.attributes} attribute writes for ${facts.total} attributes`);
  // Many more ticks, then the live map equals a map drawn fresh from the same view in a host of the same size.
  for (let i = 0; i < 3; i++) await page.locator('#advance').click();
  for (let i = 0; i < 8; i++) await page.locator('#step').click();
  await nextFrames(page, 2);
  const same = await freshDraw(page);
  assert.deepEqual({equal: same.equal, cards: same.cards}, {equal: true, cards: (await query(page)).definition.steps.length},
   'the patched map matches a fresh draw');
  const q = (await query(page)).snapshot, f = await encoding(page);
  for (const m of q.steps.filter(s => waitingAt(q, s.id) > 0)) {
   assert.equal(f.cards.find(c => c.id === m.id)!.counts.find(c => c.status === 'queued')?.text, String(waitingAt(q, m.id)), m.id);
  }
 });
 // Hosted CI has no Inter and draws in DejaVu Sans. There the run bar's guidance written during a clock command's refresh wraps the
 // stage heading onto another line until the clock's sentence replaces it after the refresh, so the map is drawn while the svg has a
 // passing size that is never painted. Framing for that size used to leave the map different from a fresh draw (and moved a zoomed
 // camera); the camera now frames for the size the last rendering update reported. A real resize is reported (and redrawn) before the
 // next paint, so each comparison waits for two frames. The stage can also really change size during a run (the KPI strip under the
 // map wraps to a second row when the outcome tiles appear): a kept camera then keeps its scale and the world point at its centre,
 // so only the viewBox edges move with the svg. Where the svg size did not change the viewBox must be exactly the same.
 await check('2D map framing does not depend on its history in DejaVu Sans: an untouched map matches a fresh draw after every '
  + 'tick and Fit to view, also with numbered cards, and a camera the reader zoomed or panned keeps its view across ticks', async () => {
  for (const index of [0, 4]) {
   await page.setViewportSize({width: 1440, height: 1060}); await freshStudio();
   await page.addStyleTag({content: DEJAVU}); await nextFrames(page, 2);
   if (index) await switchTo(index);
   await page.locator('#mode-2d').click(); await nextFrames(page, 2);
   const fonts = await renderedFamilies(page, ['#message', '#map svg .pm-title']);
   for (const [selector, families] of Object.entries(fonts)) {
    assert.deepEqual(families, ['DejaVu Sans'], `${selector} renders with ${families.join(', ') || 'no font'}; DejaVu Sans must be installed`);
   }
   const numbered = await page.evaluate(() => !(document.querySelector('#map .process-map-key') as HTMLElement).hidden);
   assert.equal(numbered, index === 4, `process ${index}: the number key shows exactly on the numbered map`);
   const matches = async (when: string) => {
    await nextFrames(page, 2);
    const f = await freshDraw(page);
    assert.equal(f.equal, true, `process ${index} ${when}: the live map (viewBox ${f.live}) matches a fresh draw (viewBox ${f.fresh})`);
   };
   await matches('after switching to 2D');
   const definition = JSON.stringify((await query(page)).definition);
   let minute = (await query(page)).snapshot.minute;
   const tick = async (control: string) => {
    await page.locator(control).click();
    const q = await query(page);
    assert(q.snapshot.minute > minute, `${control} advanced the run`); minute = q.snapshot.minute;
   };
   for (const control of ['#step', '#step', '#advance', '#step']) { await tick(control); await matches(`after ${control}`); }
   await page.locator('#frame').click(); await matches('after Fit to view');
   // A camera the reader moved is never re-framed by a tick.
   for (const keys of [['+'], ['+', 'ArrowRight']]) {
    await page.locator('#map svg').focus();
    for (const key of keys) await page.keyboard.press(key);
    // Two ticks, then a real window resize and back: the view is kept through each.
    const changes: [string, () => Promise<void>][] = [['#step', () => tick('#step')], ['#advance', () => tick('#advance')],
     ['a shorter window', () => page.setViewportSize({width: 1440, height: 1000})],
     ['the window back', () => page.setViewportSize({width: 1440, height: 1060})]];
    let kept = await camera(page);
    for (const [what, change] of changes) {
     await change();
     const now = await camera(page);
     keptView(kept, now, `process ${index}: ${keys.join(' ')} view kept after ${what}`); kept = now;
    }
    await page.locator('#frame').click(); await matches(`after ${keys.join(' ')}, ticks, resizes and Fit to view`);
   }
   assert.equal(JSON.stringify((await query(page)).definition), definition, 'framing never changes the definition');
  }
 });
 await check('2D map step cards are one roving tab stop: arrow keys move to the nearest card, Home and End reach the ends, '
  + 'Enter selects, and the map surface keeps its pan and zoom keys', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await freshStudio(); await page.locator('#mode-2d').click();
  const minute = (await query(page)).snapshot.minute;
  const stops = () => page.evaluate(() => [...document.querySelectorAll('#map svg g[role=button]')]
   .filter(g => g.getAttribute('tabindex') === '0').map(g => g.id.slice('process-map-'.length)));
  const active = () => page.evaluate(() => document.activeElement?.id.replace('process-map-', '') ?? '');
  assert.deepEqual(await stops(), ['intake'], 'only the start step is a tab stop');
  assert.equal(await page.locator('#map svg').getAttribute('tabindex'), '-1', 'the map surface is not a tab stop');
  await page.locator('#frame').focus(); await page.keyboard.press('Tab');
  assert.equal(await active(), 'intake', 'Tab enters the map at its tab stop');
  // The spatial rule: right along the row, up to the card above-right, down to the card straight below, End and Home.
  const walk: [string, string][] = [['ArrowRight', 'discovery'], ['ArrowRight', 'design-split'], ['ArrowUp', 'product-design'],
   ['ArrowDown', 'architecture'], ['End', 'delivered'], ['Home', 'intake'], ['ArrowLeft', 'intake']];
  for (const [key, to] of walk) {
   await page.keyboard.press(key);
   assert.equal(await active(), to, key); assert.deepEqual(await stops(), [to], 'the focused card holds the only tab stop');
  }
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => !!document.activeElement?.closest('#map svg g[role=button]')), false, 'Tab leaves the cards');
  await page.keyboard.press('Shift+Tab'); assert.equal(await active(), 'intake', 'Shift+Tab returns to the same card');
  // Shift+Arrow on a card pans; Enter selects and keeps focus; Escape returns to the whole process.
  const viewBox = () => page.locator('#map svg').getAttribute('viewBox');
  let box = await viewBox(); await page.keyboard.press('+'); assert.notEqual(await viewBox(), box, '+ zooms from a card');
  box = await viewBox(); await page.keyboard.press('Shift+ArrowLeft');
  assert.notEqual(await viewBox(), box, 'Shift+Arrow pans from a card'); assert.equal(await active(), 'intake');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
  assert.deepEqual([(await query(page)).selected, await active()], ['discovery', 'discovery']);
  await page.keyboard.press('Escape'); assert.equal((await query(page)).selected, null, 'Escape returns to the whole process');
  assert.deepEqual(await stops(), ['discovery'], 'the last focused card keeps the tab stop');
  // The surface: arrows pan and focus stays on it; moving focus to a card off screen brings it into view.
  await page.locator('#map svg').focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press('+');
  box = await viewBox(); await page.keyboard.press('ArrowRight');
  assert.notEqual(await viewBox(), box, 'arrows pan the surface');
  assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('#map svg')), true);
  await page.locator('#process-map-intake').focus(); await page.keyboard.press('End');
  const seen = await page.evaluate(() => {
   const r = document.activeElement!.querySelector('.pm-card')!.getBoundingClientRect(), s = document.querySelector('#map svg')!.getBoundingClientRect();
   return r.left >= s.left - 1 && r.right <= s.right + 1 && r.top >= s.top - 1 && r.bottom <= s.bottom + 1;
  });
  assert.equal(seen, true, 'a card focused by key is brought into view');
  assert.equal((await query(page)).snapshot.minute, minute, 'keyboard navigation never ticks');
 });
 await check('2D map cards move by drag or Alt+Arrow only with a move option, once per drop, without ticking or changing '
  + 'the definition; a click still selects and Escape cancels a drag', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await freshStudio();
  const before = await query(page);
  await page.evaluate(() => {
   const w = globalThis as any, host = document.createElement('div');
   host.id = 'move-probe'; host.style.cssText = 'position:fixed;left:0;top:0;width:900px;height:520px;z-index:50;background:#13181f';
   document.body.append(host);
   w.__moves = []; w.__picks = []; w.__view = w.LWProcessStudio.query(); w.__print = JSON.stringify(w.__view.definition);
   w.__surface = w.LWProcess2D.create(host, (id: string) => w.__picks.push(id), {move: (id: string, at: number[]) => w.__moves.push([id, at])});
   const svg = host.querySelector('svg')!; svg.style.cssText = 'width:100%;height:100%;display:block';
   w.__surface.draw(w.__view);
  });
  const card = (id: string) => page.evaluate(i => {
   const g = document.querySelector(`#move-probe #process-map-${i}`)!, r = g.querySelector('.pm-card')!.getBoundingClientRect();
   // Whole pixels, so the pointer travels exactly the distances the check computes with.
   const ppu = (document.querySelector('#move-probe svg') as SVGSVGElement).getScreenCTM()!.a;
   return {x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), ppu};
  }, id);
  const log = () => page.evaluate(() => ({moves: (globalThis as any).__moves, picks: (globalThis as any).__picks}));
  const qa = (await query(page)).definition.steps.find(s => s.id === 'qa')!.scene.position;
  let at = await card('qa');
  // A click and a 3px jitter select; neither moves.
  await page.mouse.click(at.x, at.y);
  await page.mouse.move(at.x, at.y); await page.mouse.down(); await page.mouse.move(at.x + 3, at.y); await page.mouse.up();
  assert.deepEqual(await log(), {moves: [], picks: ['qa', 'qa']});
  // A drag past the threshold moves the card with the pointer and reports one snapped position on drop.
  await page.mouse.move(at.x, at.y); await page.mouse.down(); await page.mouse.move(at.x + 60, at.y + 25, {steps: 6}); await page.mouse.up();
  const snap = (v: number) => Math.round(v * 2) / 2, expected = [snap(qa[0]! + 60 / at.ppu), snap(qa[1]! + 25 / at.ppu)];
  assert.deepEqual(await log(), {moves: [['qa', expected]], picks: ['qa', 'qa']}, 'one move per drop and no selection');
  const moved = await page.evaluate(([x, y]) => {
   const svg = document.querySelector('#move-probe svg') as SVGSVGElement, m = svg.getScreenCTM()!;
   const r = svg.querySelector('#process-map-qa .pm-card')!.getBoundingClientRect();
   return Math.hypot(r.left + r.width / 2 - (m.a * x! + m.e), r.top + r.height / 2 - (m.d * y! + m.f));
  }, expected);
  assert(moved < 1, `the card is drawn where it was dropped (${moved}px off)`);
  // Escape during a drag puts the card back and reports nothing.
  at = await card('implementation');
  await page.mouse.move(at.x, at.y); await page.mouse.down(); await page.mouse.move(at.x + 50, at.y, {steps: 5});
  await page.keyboard.press('Escape'); await page.mouse.up();
  const back = await card('implementation');
  assert(Math.abs(back.x - at.x) < 1 && (await log()).moves.length === 1, 'Escape cancels the drag');
  // Alt+Arrow is the keyboard alternative: one world unit per press.
  await page.locator('#move-probe #process-map-review-gate').focus(); await page.keyboard.press('Alt+ArrowRight'); await page.keyboard.press('Alt+ArrowUp');
  const gate = before.definition.steps.find(s => s.id === 'review-gate')!.scene.position;
  assert.deepEqual((await log()).moves.slice(1), [['review-gate', [gate[0]! + 1, gate[1]!]], ['review-gate', [gate[0]! + 1, gate[1]! - 1]]]);
  // Dragging the background still pans.
  const pan = await page.evaluate(() => document.querySelector('#move-probe svg')!.getAttribute('viewBox'));
  await page.mouse.move(880, 20); await page.mouse.down(); await page.mouse.move(820, 60, {steps: 4}); await page.mouse.up();
  assert.notEqual(await page.evaluate(() => document.querySelector('#move-probe svg')!.getAttribute('viewBox')), pan);
  const kept = await page.evaluate(() => {
   const w = globalThis as any; const same = JSON.stringify(w.__view.definition) === w.__print;
   w.__surface.dispose(); document.getElementById('move-probe')!.remove(); return same;
  });
  assert.equal(kept, true, 'the map never changes the definition it was given');
  assert.deepEqual((await query(page)).snapshot, before.snapshot, 'moving cards never ticks the run');
  // The studio map has the move option (AUTH-11): a card drag moves the card in the draft, never in the running definition.
  await page.locator('#mode-2d').click();
  assert.equal(await page.locator('#map svg').evaluate(s => s.classList.contains('movable')), true);
  const qaCard = (await page.locator('#process-map-qa .pm-card').boundingBox())!;
  await page.mouse.move(qaCard.x + qaCard.width / 2, qaCard.y + qaCard.height / 2); await page.mouse.down();
  await page.mouse.move(qaCard.x + qaCard.width / 2 + 40, qaCard.y + qaCard.height / 2, {steps: 4}); await page.mouse.up();
  assert.equal(await page.locator('#message').innerText(), 'Moved Quality review in the draft. Apply the draft to keep it.');
  const drafted = await page.evaluate(() => (JSON.parse((document.getElementById('draft') as HTMLTextAreaElement).value) as LWProcess.Definition)
   .steps.find(s => s.id === 'qa')!.scene.position);
  assert(drafted[0]! > qa[0]! && drafted[1] === qa[1], `the draft holds the moved card (${drafted.join()})`);
  assert.deepEqual([(await query(page)).definition, (await query(page)).snapshot], [before.definition, before.snapshot]);
 });
 await check('Outcome badges sit inside numbered and zoomed-out cards, clear of the number, the title and other cards, with a 12px glyph',
  async () => {
  for (const [width, height] of [[1440, 1060], [390, 844]] as const) {
   for (const dejavu of [false, true]) {
    await page.setViewportSize({width, height}); await freshStudio();
    if (dejavu) await page.addStyleTag({content: DEJAVU});
    await switchTo(4); await page.locator('#mode-2d').click(); await page.locator('#frame').click(); await nextFrames(page, 2);
    const at = `${width}x${height}${dejavu ? ' DejaVu' : ''}`;
    for (const stage of ['numbers', 'names']) {
     if (stage === 'names') { await page.locator('#map-zoom-hint').click(); await nextFrames(page, 2); }
     const found = await badges(page);
     assert.equal(found.length, 4, `four outcome badges at ${at}`);
     for (const b of found) {
      const where = `${b.id} (${stage}) at ${at}`;
      assert.equal(b.numbered, stage === 'numbers', where + ' layout');
      assert(b.h >= 11.9, `${where}: the badge is ${b.h}px tall`);
      assert.deepEqual([b.inside, b.onTitle, b.onOthers], [true, false, []], where);
     }
    }
   }
  }
 });
}
