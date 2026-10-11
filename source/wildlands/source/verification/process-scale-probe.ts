/**
 * In-page measurement helpers of the process-scale-browser suite. Every duration is measured inside the page with
 * `performance.now()`, from just before the action to the first animation frame after the condition holds, so the number covers
 * the synchronous work, layout and the frame the person sees, and not the test runner's round trips.
 *
 * `scaleInit` (an init script) records when the page signalled ready (`__readyAt`, milliseconds since navigation started) and wraps
 * `THREE.WebGLRenderer` as the page defines it, so the studio's one shared renderer is reachable (`__renderers`) and its draw calls
 * (`info.render.calls` of the last frame, scene and shadow passes) can be read without changing what it draws.
 */
import type {Page} from 'playwright';

/** Init script text; `__name` is the helper the TypeScript loader may wrap named functions with (the page has none). */
export const scaleInit = (): string => `(() => {
 const w = window;
 w.__renderers = [];
 addEventListener('wildlands:ready', () => { w.__readyAt = performance.now(); }, {once: true});
 let three;
 // The renderer class joins the module after it is assigned, so it is wrapped on the first read that finds it.
 const counted = () => {
  const Base = three && three.WebGLRenderer;
  if (typeof Base !== 'function' || Base.counted) return;
  class Counted extends Base {
   constructor(options) {
    super(options);
    w.__renderers.push(this);
   }
  }
  Counted.counted = true;
  if (Object.isFrozen(three)) three = Object.freeze({...three, WebGLRenderer: Counted});
  else three.WebGLRenderer = Counted;
 };
 Object.defineProperty(w, 'THREE', {configurable: true, enumerable: true, get: () => { counted(); return three; }, set: value => { three = value; }});
})();`;

/**
 * Clicks `#id`, then waits frame by frame (at most `frames`) until `selector` matches at least `count` elements, and returns the
 * milliseconds from the click to the first frame after that, or -1 when it never matched.
 */
export function timeClick(page: Page, id: string, selector: string, count = 1, frames = 600): Promise<number> {
 return page.evaluate(async ([target, wanted, minimum, limit]) => {
  const frame = () => new Promise<number>(resolve => requestAnimationFrame(t => resolve(t)));
  const start = performance.now();
  document.getElementById(target as string)!.click();
  for (let i = 0; i < (limit as number); i++) {
   await frame();
   if (document.querySelectorAll(wanted as string).length >= (minimum as number)) return performance.now() - start;
  }
  return -1;
 }, [id, selector, count, frames] as const);
}

/** Milliseconds between the next `count` animation frames: how long the page takes to paint again. */
export function frameGaps(page: Page, count = 3): Promise<number[]> {
 return page.evaluate(async n => {
  const frame = () => new Promise<number>(resolve => requestAnimationFrame(t => resolve(t)));
  const gaps: number[] = [];
  let last = await frame();
  for (let i = 0; i < n; i++) {
   const now = await frame();
   gaps.push(now - last);
   last = now;
  }
  return gaps;
 }, count);
}

/** Draw calls of the last frame of the studio's shared renderer (scene and shadow passes). */
export const drawCalls = (page: Page): Promise<number> =>
 page.evaluate(() => {
  const list = (window as unknown as {__renderers: {info: {render: {calls: number}}}[]}).__renderers;
  return list[list.length - 1]!.info.render.calls;
 });
