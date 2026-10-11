/// <reference path="../process-contracts.d.ts" />
/**
 * 2D map label and legend checks of the readability suite (process-readability-browser.ts calls `mapLabelChecks`): process 7 at
 * 1366 x 768 keeps its labels apart and readable, and at a 24px root font the legend folds into a Legend disclosure so the agency
 * map keeps its names. Every layout-sensitive step runs again with DejaVu Sans, the wider font of hosted CI.
 */
import assert from 'node:assert/strict';
import {nextFrames} from './browser-harness';
import {query, type Studio} from './process-browser-fixture';

/** Screen facts of every card label: size, overlaps with other labels and cards, card spacing and short words cut by a hyphen. */
const labelFacts = (page: Studio['page']) => page.evaluate(() => {
 const svg = document.querySelector('#map svg') as SVGSVGElement, a = svg.getScreenCTM()!.a;
 const names: string[] = (globalThis as any).LWProcessStudio.query().definition.steps.map((s: any) => s.name);
 const cards = [...svg.querySelectorAll<SVGGElement>('g[role=button]')], box = (e: Element) => e.getBoundingClientRect();
 const hit = (p: DOMRect, q: DOMRect) => p.left < q.right - .5 && q.left < p.right - .5 && p.top < q.bottom - .5 && q.top < p.bottom - .5;
 /** Whether two cards keep about 4px apart sideways or vertically (the numbered framing keeps exactly 4px). */
 const apart = (p: DOMRect, q: DOMRect) => Math.max(p.left - q.right, q.left - p.right) >= 3.5 || Math.max(p.top - q.bottom, q.top - p.bottom) >= 3.5;
 const items = cards.map((g, i) => ({id: g.id, title: g.querySelector('.pm-title')!, card: g.querySelector('.pm-card')!, name: names[i]!,
  lines: [...g.querySelectorAll('.pm-title tspan')].map(t => t.textContent!)}));
 const overlaps: string[] = [], onCards: string[] = [], close: string[] = [], cuts: string[] = [];
 items.forEach((p, i) => items.forEach((q, j) => {
  if (i === j) return;
  if (i < j && hit(box(p.title), box(q.title))) overlaps.push(`${p.id}/${q.id}`);
  if (hit(box(p.title), box(q.card))) onCards.push(`${p.id} on ${q.id}`);
  if (i < j && !apart(box(p.card), box(q.card))) close.push(`${p.id}/${q.id}`);
 }));
 // Walk each name along its lines: a line ending in a hyphen the name does not have at that place is a cut word.
 for (const {name, lines} of items) {
  if (/^\d+$/.test(lines.join(''))) continue;
  let pos = 0;
  lines.forEach((line, i) => {
   let text = line.endsWith('…') ? line.slice(0, -1) : line;
   const added = i < lines.length - 1 && text.endsWith('-') && name[pos + text.length - 1] !== '-';
   if (added) {
    text = text.slice(0, -1);
    const start = name.lastIndexOf(' ', pos + text.length) + 1, end = name.indexOf(' ', pos + text.length);
    cuts.push(name.slice(start, end < 0 ? undefined : end));
   }
   pos += text.length;
   if (name[pos] === ' ') pos++;
  });
 }
 return {px: Math.min(...items.map(t => parseFloat(t.title.getAttribute('font-size')!) * a)), overlaps, onCards, close, cuts,
  numbered: items.some(t => /^\d+$/.test(t.lines.join('')))};
});

export async function mapLabelChecks(studio: Studio): Promise<void> {
 const {page, check, freshStudio, switchTo} = studio;
 const DEJAVU = '*{font-family:"DejaVu Sans",sans-serif !important}';
 await check('Process 7 at 1366x768 keeps 2D card labels apart and readable: no overlapping labels or cards, no label under the minimum '
  + 'size and no short word cut, at fit and after Zoom in for names, also in DejaVu Sans', async () => {
  await page.setViewportSize({width: 1366, height: 768});
  for (const dejavu of [false, true]) {
   await freshStudio();
   if (dejavu) await page.addStyleTag({content: DEJAVU});
   await page.evaluate(() => document.fonts.ready);
   await switchTo(6); await page.locator('#mode-2d').click(); await page.locator('#frame').click(); await nextFrames(page, 2);
   for (const stage of ['fit', 'names']) {
    const hint = page.locator('#map-zoom-hint');
    if (stage === 'names' && await hint.isVisible() && await hint.innerText() === 'Zoom in for names') {
     await hint.click(); await nextFrames(page, 2);
    }
    const f = await labelFacts(page), at = `${stage}${dejavu ? ' DejaVu' : ''}`;
    if (stage === 'names') assert.equal(f.numbered, false, 'names are shown at ' + at);
    assert(f.px >= 10.9, `labels are ${f.px}px at ${at}`);
    assert.deepEqual([f.overlaps, f.onCards, f.close], [[], [], []], 'labels and cards keep apart at ' + at);
    assert.deepEqual(f.cuts.filter(w => w.length <= 10), [], 'no word of up to ten characters is cut at ' + at);
   }
  }
 });
 await check('At a 24px root font the legend folds into a Legend disclosure and the agency map keeps its names at 1440x1060; '
  + 'the default size keeps the complete legend', async () => {
  await page.setViewportSize({width: 1440, height: 1060});
  const legend = () => page.evaluate(() => {
   const row = document.querySelector('.process-legend')!, toggle = document.getElementById('legend-toggle')!;
   const shown = (e: Element) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
   const key = document.getElementById('legend-key')!, help = document.getElementById('legend-help')!;
   return {height: row.getBoundingClientRect().height, toggle: shown(toggle), expanded: toggle.getAttribute('aria-expanded'),
    entries: [...row.querySelectorAll('[data-legend]')].filter(shown).length, all: row.querySelectorAll('[data-legend]').length,
    above: key.getBoundingClientRect().bottom <= row.getBoundingClientRect().top + 1, help: shown(help) ? help.textContent : '',
    hint: document.getElementById('camera-hint')!.textContent};
  });
  for (const dejavu of [false, true]) {
   await freshStudio();
   if (dejavu) await page.addStyleTag({content: DEJAVU});
   await page.locator('#mode-2d').click();
   const normal = await legend(), at = dejavu ? ' in DejaVu Sans' : '';
   assert.deepEqual([normal.toggle, normal.entries, normal.all], [false, 7, 7], 'the default size shows the whole legend inline' + at);
   await page.addStyleTag({content: 'html{font-size:24px}'}); await page.locator('#frame').click(); await nextFrames(page, 2);
   const big = await legend(), labels = await page.locator('#map svg .pm-title').allTextContents();
   assert.deepEqual([big.toggle, big.expanded, big.entries, big.all], [true, 'false', 0, 7], 'the key folds behind Legend' + at);
   assert(big.height <= 80, `the legend row is ${big.height}px tall${at}`);
   assert(!labels.some(t => /^\d+$/.test(t)), 'the agency map keeps its names' + at + ': ' + labels.join(' / '));
   const minute = (await query(page)).snapshot.minute;
   await page.locator('#legend-toggle').click();
   const open = await legend();
   assert.deepEqual([open.expanded, open.entries, open.above, open.help], ['true', 7, true, open.hint], 'the popover shows the key' + at);
   await page.keyboard.press('Escape');
   assert.equal((await legend()).expanded, 'false');
   assert.equal(await page.evaluate(() => document.activeElement?.id), 'legend-toggle', 'Escape returns focus to Legend');
   assert.equal((await query(page)).snapshot.minute, minute, 'the legend never ticks');
   // Zoom in for details still works, and a numbered map still zooms in for names.
   await page.locator('#map-zoom-hint').click();
   assert.equal(await page.locator('#map-zoom-hint').isHidden(), true, 'Zoom in for details reaches the details');
   await switchTo(4); await page.locator('#mode-2d').click(); await page.locator('#frame').click();
   assert.equal(await page.locator('#map-zoom-hint').innerText(), 'Zoom in for names');
   await page.locator('#map-zoom-hint').click();
   assert(!(await page.locator('#map svg .pm-title').allTextContents()).some(t => /^\d+$/.test(t)), 'Zoom in for names shows names' + at);
  }
  // Forced colours keep the folded legend: the button and the samples in the popover.
  await page.emulateMedia({forcedColors: 'active'});
  try {
   await page.locator('#legend-toggle').click();
   const forced = await page.evaluate(() => [...document.querySelectorAll('.process-legend [data-legend] svg')]
    .map(s => [getComputedStyle(s).forcedColorAdjust, s.getClientRects().length > 0]));
   assert(forced.length === 7 && forced.every(([adjust, shown]) => adjust === 'none' && shown), JSON.stringify(forced));
   await page.locator('#legend-toggle').click();
  } finally { await page.emulateMedia({forcedColors: 'none'}); }
  // The lens view keeps only its hint, however large the text.
  await page.locator('#mode-lens').click();
  assert.deepEqual(await page.locator('.process-legend > :visible').evaluateAll(n => n.map(x => x.id)), ['camera-hint']);
 });
}
