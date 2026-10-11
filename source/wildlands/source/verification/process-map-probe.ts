/// <reference path="../process-contracts.d.ts" />
/** Read-only probes of the 2D map that the renderers suite compares with the legend, and the fonts drawing it: no page mutation, no clock. */
import type {Page} from 'playwright';
/** Map cards and markers against the legend: colours, marker shapes, marker size, overlap with titles and the per-state counts. */
export const encoding = (page: Page) => page.evaluate(() => {
 const paint = (e: Element) => { const c = getComputedStyle(e); return c.fill === 'none' ? c.stroke : c.fill; };
 const a = (e: Element) => (e as SVGGraphicsElement).getScreenCTM()!.a;
 const key = Object.fromEntries([...document.querySelectorAll('.process-legend [data-legend]')].map(n => {
  const p = n.querySelector('path')!, c = getComputedStyle(p);
  return [n.getAttribute('data-legend'), {label: n.textContent, d: p.getAttribute('d'), paint: paint(p), dash: c.strokeDasharray, stroke: c.stroke}];
 }));
 const hit = (p: DOMRect, q: DOMRect) => p.left < q.right - .5 && q.left < p.right - .5 && p.top < q.bottom - .5 && q.top < p.bottom - .5;
 const cards = [...document.querySelectorAll<SVGGElement>('#map svg g[role=button]')].map(g => {
  const title = g.querySelector('.pm-title')!, box = title.getBoundingClientRect();
  const marks = [...g.querySelectorAll('.pm-mark')].map(m => ({status: m.getAttribute('data-status')!, d: m.getAttribute('d'), paint: paint(m), px: a(m),
   onTitle: hit(m.getBoundingClientRect(), box)}));
  const counts = [...g.querySelectorAll<SVGGElement>('.pm-count')].map(c => {
   const text = c.querySelector('text')!;
   return {status: c.dataset.status!, text: text.textContent, px: parseFloat(text.getAttribute('font-size')!) * a(text)};
  });
  const stroke = getComputedStyle(g.querySelector('.pm-card')!).stroke;
  const label = g.getAttribute('aria-label')!;
  return {id: g.id.slice('process-map-'.length), status: g.dataset.status!, stroke, label, title: title.textContent, marks, counts};
 });
 const conditional = [...document.querySelectorAll('#map svg .pm-edge-conditional')].map(e => getComputedStyle(e))
  .map(c => ({dash: c.strokeDasharray, stroke: c.stroke}));
 return {key, cards, conditional, hint: !(document.getElementById('map-zoom-hint') as HTMLElement).hidden};
});
/**
 * Outcome badges of the studio map: their on-screen height, whether the badge box stays inside its card, overlaps its own title or
 * list number, or overlaps any other card, and whether the card shows a list number.
 */
export const badges = (page: Page) => page.evaluate(() => {
 const hit = (p: DOMRect, q: DOMRect) => p.left < q.right - .5 && q.left < p.right - .5 && p.top < q.bottom - .5 && q.top < p.bottom - .5;
 const cards = [...document.querySelectorAll<SVGGElement>('#map svg g[role=button]')];
 return cards.filter(g => g.querySelector('.pm-outcome')).map(g => {
  const b = g.querySelector('.pm-outcome')!.getBoundingClientRect(), card = g.querySelector('.pm-card')!.getBoundingClientRect();
  const title = g.querySelector('.pm-title')!;
  const inside = b.left >= card.left - .5 && b.right <= card.right + .5 && b.top >= card.top - .5 && b.bottom <= card.bottom + .5;
  const others = cards.filter(o => o !== g && hit(b, o.querySelector('.pm-card')!.getBoundingClientRect())).map(o => o.id);
  return {id: g.id.slice('process-map-'.length), h: b.height, inside, onTitle: hit(b, title.getBoundingClientRect()), onOthers: others,
   numbered: /^\d+$/.test(title.textContent ?? '')};
 });
});
/** The platform fonts that really draw each selector's text (CDP), so a font check cannot pass on a host without the font. */
export async function renderedFamilies(page: Page, selectors: string[]): Promise<Record<string, string[]>> {
 const cdp = await page.context().newCDPSession(page), out: Record<string, string[]> = {};
 try {
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const {root} = await cdp.send('DOM.getDocument');
  for (const selector of selectors) {
   const {nodeId} = await cdp.send('DOM.querySelector', {nodeId: root.nodeId, selector});
   out[selector] = [...new Set((await cdp.send('CSS.getPlatformFontsForNode', {nodeId})).fonts.map(f => f.familyName))];
  }
 } finally { await cdp.detach(); }
 return out;
}
export const STATE = {active: 'Working', queued: 'Waiting', timer: 'Timer', backlog: 'Backlog', held: 'Blocked'} as const;
const OTHER = ['active', 'timer', 'backlog', 'held'];
export const waitingAt = (q: LWProcess.Snapshot, id: string) => q.tokens.filter(t => t.stepId === id && !OTHER.includes(t.status)).length;
