/// <reference path="../process-contracts.d.ts" />
/** Read-only probes of the 2D map that the renderers suite compares with the legend: no page mutation, no clock. */
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
export const STATE = {active: 'Working', queued: 'Waiting', timer: 'Timer', backlog: 'Backlog', held: 'Blocked'} as const;
const OTHER = ['active', 'timer', 'backlog', 'held'];
export const waitingAt = (q: LWProcess.Snapshot, id: string) => q.tokens.filter(t => t.stepId === id && !OTHER.includes(t.status)).length;
