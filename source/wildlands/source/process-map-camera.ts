/// <reference path="./process-contracts.d.ts" />
/**
 * The presentation-only camera of the 2D process map (LWProcessMapCamera) and its dock. Zoom 1 is the fit of the map's world bounds
 * (`fit`); `cx`,`cy` is the centre in world units. The camera never ticks a run and never changes the definition.
 *  - The dock (zoom buttons and, while cards show numbers, their key) sits inside the map host, so it travels with the map into
 *    Present. The fitted map keeps clear of it: either a strip under the map or a column beside it is reserved, whichever leaves the
 *    larger scale.
 *  - Pointer: dragging the background pans, two pointers pinch-zoom, the wheel zooms about the pointer. The map routes pointer events
 *    here unless a card drag owns them (LWProcessMapDrag).
 *  - Keys (`keydown`): on the map surface Arrow keys pan by 60px; on a card only Shift+Arrow pans (plain arrows move between cards).
 *    `+`/`=` zoom in, `-` zooms out, `0` or `F` reset the framing, on the surface and on cards alike.
 */
declare namespace LWProcessMapCamera {
 /** The svg size (`W`,`H`) and the part the fitted map may use (`w`,`h`, from the top-left corner). */
 interface Area {W: number; H: number; w: number; h: number}
 interface Hooks {
  /** The camera moved: the map re-checks its layout for the new scale. */
  moved(): void;
  /** The map's own reset (button, 0 or F). */
  refit(): void;
 }
 interface Camera {
  fit: LWProcessMapFit.Box; zoom: number; cx: number; cy: number;
  /** Whether the camera still shows the framing the map chose (no pan or zoom since), so a resize frames again. */
  atFit: boolean;
  /** The card-number key in the dock. */
  readonly key: HTMLElement;
  area(): Area;
  /** Screen pixels per world unit. */
  scale(): number;
  clamp(): void;
  setViewBox(): void;
  zoomAt(factor: number, clientX?: number, clientY?: number): void;
  panBy(dx: number, dy: number): void;
  /** Pans the least distance that brings the world point `x`,`y` inside the usable area inset by `mx`,`my` pixels. */
  reveal(x: number, y: number, mx: number, my: number): void;
  down(e: PointerEvent): void;
  move(e: PointerEvent): void;
  up(e: PointerEvent): void;
  keydown(e: KeyboardEvent, onCard: boolean): boolean;
  dispose(): void;
 }
 interface Api {create(svg: SVGSVGElement, host: HTMLElement, hooks: Hooks): Camera}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessMapCamera?: LWProcessMapCamera.Api};
 const NUMBERS_KEY = 'Card numbers match the step list', DOCK_GAP = 6, PAN_STEP = 60, DRAG_START = 4;
 function create(svg: SVGSVGElement, host: HTMLElement, hooks: LWProcessMapCamera.Hooks): LWProcessMapCamera.Camera {
  const dock = document.createElement('div'), key = document.createElement('p'), controls = document.createElement('div');
  dock.className = 'process-map-dock';
  key.className = 'process-map-key'; key.textContent = NUMBERS_KEY; key.hidden = true;
  controls.className = 'process-map-controls';
  controls.setAttribute('role', 'group'); controls.setAttribute('aria-label', 'Map zoom');
  dock.append(key, controls); host.append(dock);
  const pointers = new Map<number, {x: number; y: number}>();
  let dragStart: {x: number; y: number} | null = null, panning = false, last = {x: 0, y: 0};
  const cam: LWProcessMapCamera.Camera = {
   fit: {x: 0, y: 0, w: 1, h: 1}, zoom: 1, cx: 0, cy: 0, atFit: false, key,
   area, scale, clamp, setViewBox, zoomAt, panBy, reveal, down, move, up, keydown, dispose,
  };
  function area(): LWProcessMapCamera.Area {
   const r = svg.getBoundingClientRect(), d = dock.getBoundingClientRect(), fit = cam.fit;
   if (r.width <= 2 || r.height <= 2) return {W: 900, H: 480, w: 900, h: 480};
   if (!d.width) return {W: r.width, H: r.height, w: r.width, h: r.height};
   const strip = Math.max(0, r.bottom - d.top + DOCK_GAP), column = Math.max(0, r.right - d.left + DOCK_GAP);
   const below = Math.min(r.width / fit.w, (r.height - strip) / fit.h), beside = Math.min((r.width - column) / fit.w, r.height / fit.h);
   const size = {W: r.width, H: r.height};
   if (below >= beside) return {...size, w: r.width, h: Math.max(1, r.height - strip)};
   return {...size, w: Math.max(1, r.width - column), h: r.height};
  }
  function scale(): number {
   const a = area();
   return Math.max(1e-6, Math.min(a.w / (cam.fit.w / cam.zoom), a.h / (cam.fit.h / cam.zoom)));
  }
  function clamp(): void {
   const fit = cam.fit;
   cam.zoom = Math.max(.5, Math.min(8, cam.zoom));
   cam.cx = Math.max(fit.x, Math.min(fit.x + fit.w, cam.cx));
   cam.cy = Math.max(fit.y, Math.min(fit.y + fit.h, cam.cy));
  }
  /** The camera centre sits at the middle of the usable area, so the dock corner stays clear at fit. */
  function setViewBox(): void {
   clamp();
   const a = area(), k = scale(), box = `${cam.cx - a.w / 2 / k} ${cam.cy - a.h / 2 / k} ${a.W / k} ${a.H / k}`;
   if (svg.getAttribute('viewBox') !== box) svg.setAttribute('viewBox', box);
  }
  function zoomAt(factor: number, clientX?: number, clientY?: number): void {
   const r = svg.getBoundingClientRect(), a = area();
   const mx = (clientX ?? r.left + a.w / 2) - r.left - a.w / 2, my = (clientY ?? r.top + a.h / 2) - r.top - a.h / 2;
   const before = scale(), wx = cam.cx + mx / before, wy = cam.cy + my / before;
   cam.zoom *= factor; clamp(); cam.atFit = false;
   const after = scale();
   cam.cx = wx - mx / after; cam.cy = wy - my / after;
   hooks.moved();
  }
  function panBy(dx: number, dy: number): void {
   const k = scale();
   cam.cx -= dx / k; cam.cy -= dy / k; cam.atFit = false;
   hooks.moved();
  }
  function reveal(x: number, y: number, mx: number, my: number): void {
   const a = area(), k = scale(), hw = Math.max(0, a.w / 2 - mx) / k, hh = Math.max(0, a.h / 2 - my) / k;
   const dx = x < cam.cx - hw ? x - (cam.cx - hw) : x > cam.cx + hw ? x - (cam.cx + hw) : 0;
   const dy = y < cam.cy - hh ? y - (cam.cy - hh) : y > cam.cy + hh ? y - (cam.cy + hh) : 0;
   if (!dx && !dy) return;
   cam.cx += dx; cam.cy += dy; cam.atFit = false;
   hooks.moved();
  }
  const wheel = (e: WheelEvent) => { e.preventDefault(); zoomAt(Math.exp(-e.deltaY * .0015), e.clientX, e.clientY); };
  function down(e: PointerEvent): void {
   if (e.button > 2) return;
   pointers.set(e.pointerId, {x: e.clientX, y: e.clientY}); last = {x: e.clientX, y: e.clientY};
   dragStart = pointers.size === 1 ? {x: e.clientX, y: e.clientY} : null; panning = pointers.size > 1;
   if (panning && !svg.hasPointerCapture(e.pointerId)) svg.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent): void {
   const known = pointers.get(e.pointerId);
   if (!known) return;
   if (pointers.size === 2) {
    const [a, b] = [...pointers.values()] as [{x: number; y: number}, {x: number; y: number}], before = Math.hypot(a.x - b.x, a.y - b.y);
    known.x = e.clientX; known.y = e.clientY;
    const after = Math.hypot(a.x - b.x, a.y - b.y);
    if (before > 0 && after > 0) zoomAt(after / before, (a.x + b.x) / 2, (a.y + b.y) / 2);
    return;
   }
   known.x = e.clientX; known.y = e.clientY;
   if (!panning && dragStart && Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y) > DRAG_START) {
    panning = true; svg.setPointerCapture(e.pointerId); svg.classList.add('panning');
   }
   if (panning) { panBy(e.clientX - last.x, e.clientY - last.y); last = {x: e.clientX, y: e.clientY}; }
  }
  function up(e: PointerEvent): void {
   pointers.delete(e.pointerId);
   if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
   if (!pointers.size) { panning = false; dragStart = null; svg.classList.remove('panning'); }
  }
  /** Pan and zoom keys; returns whether the key was the camera's. */
  function keydown(e: KeyboardEvent, onCard: boolean): boolean {
   if (e.ctrlKey || e.metaKey || e.altKey) return false;
   const pans: Record<string, [number, number]> = {ArrowLeft: [PAN_STEP, 0], ArrowRight: [-PAN_STEP, 0], ArrowUp: [0, PAN_STEP], ArrowDown: [0, -PAN_STEP]};
   if (e.key === '+' || e.key === '=') zoomAt(1.25);
   else if (e.key === '-') zoomAt(.8);
   else if (e.key === '0' || e.key.toLowerCase() === 'f') hooks.refit();
   else if (pans[e.key] && (!onCard || e.shiftKey)) panBy(...pans[e.key]!);
   else return false;
   e.preventDefault();
   return true;
  }
  svg.addEventListener('wheel', wheel, {passive: false});
  const buttons = [['Zoom in', '+', () => zoomAt(1.25)], ['Zoom out', '−', () => zoomAt(.8)], ['Reset map view', '⌂', () => hooks.refit()]] as const;
  for (const [name, text, action] of buttons) {
   const b = document.createElement('button');
   b.type = 'button'; b.textContent = text; b.title = name; b.setAttribute('aria-label', name);
   b.addEventListener('click', () => action());
   controls.append(b);
  }
  function dispose(): void { svg.removeEventListener('wheel', wheel); dock.remove(); }
  return cam;
 }
 root.LWProcessMapCamera = {create};
})(globalThis);
