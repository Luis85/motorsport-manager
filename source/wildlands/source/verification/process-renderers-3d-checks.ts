/// <reference path="../process-contracts.d.ts" />
/**
 * 3D checks of the process renderers suite (process-renderers-browser.ts calls `run3dChecks` once, in its own order): the
 * draw-call budget of a generated 128-step process with merged rooms that stay selectable, captioned and switch between their
 * idle and working variants; caption canvases sized to their text and freed on a process switch; compact markers in the 2D
 * state shapes and colours; and held work counted as blocked in room captions. Every check draws on throw-away surfaces on its
 * own canvas (`installProbe`), navigates without ticking and leaves the studio's run as it found it.
 */
import assert from 'node:assert/strict';
import {nextFrames} from './browser-harness';
import {query} from './process-browser-fixture';
import type {Studio} from './process-browser-fixture';
import {blockedLine} from './process-browser-models';

/**
 * Draw calls (scene and shadow passes) of one overview frame of `bigProcess` at 1200 x 800 CSS pixels after 90 minutes of work.
 * Measured at 7,473 before static rooms were merged and shadow casters reduced, and at 1,174 after.
 */
export const DRAW_CALL_BUDGET = 1500;
/** Shadow-casting meshes shown in that frame: 7,045 of 7,219 meshes cast before, 436 of 1,045 after (actors and large props). */
export const CASTER_BUDGET = 500;
/** The caption canvases of the old renderer: two 640 x 128 canvases per step. */
const OLD_CAPTION_PIXELS = 2 * 640 * 128;

/** A generated 128-step line (the definition maximum) through every room family, with 60 cases arriving a minute apart. */
export function bigProcess(): LWProcess.Definition {
 const kinds = ['task', 'task', 'machine', 'task', 'system', 'timer', 'task', 'touchpoint'] as const;
 const channels = ['web', 'mobile', 'store', 'phone', 'chat', 'email', 'social', 'ads', 'delivery', 'document'] as const;
 const scene = (i: number) => ({id: 'scene-' + i, position: [(i % 12) * 14, Math.floor(i / 12) * 14] as [number, number], color: '#91b9d5'});
 const steps: LWProcess.Step[] = [{id: 's0', name: 'Start', kind: 'start', scene: scene(0)}];
 for (let i = 1; i < 127; i++) {
  const kind = kinds[i % kinds.length]!, step: LWProcess.Step = {id: 's' + i, name: 'Step number ' + i, kind, scene: scene(i)};
  if (kind === 'timer') step.duration = 5;
  else step.duration = 3 + i % 7;
  if (kind === 'task') step.resources = {crew: 1};
  if (kind === 'machine') Object.assign(step, {resources: {robots: 1}, technology: 'Robot ' + i});
  if (kind === 'system') Object.assign(step, {resources: {servers: 1}, technology: 'Service ' + i});
  if (kind === 'touchpoint') step.channel = channels[i % channels.length]!;
  steps.push(step);
 }
 steps.push({id: 's127', name: 'Done', kind: 'end', scene: scene(127)});
 return {format: 'wildlands-process', schemaVersion: 1, revision: 1, id: 'big-line', name: 'Big line', start: 's0',
  resources: [{id: 'crew', name: 'Crew', capacity: 40, costPerMinute: 1}, {id: 'robots', name: 'Robots', kind: 'machine', capacity: 20, costPerMinute: 1},
   {id: 'servers', name: 'Servers', kind: 'system', capacity: 20, costPerMinute: 1}],
  arrivals: [{at: 0, count: 60, interval: 1, data: {}}], steps, flows: steps.slice(1).map((s, i) => ({id: 'f' + i, from: steps[i]!.id, to: s.id})),
 } as unknown as LWProcess.Definition;
}

/**
 * Installs `globalThis.__probe3d(definition, css)`: a surface on its own canvas (fixed at the top left, above the studio, sized by
 * `css`) whose renderer, last scene and camera are captured, with `picked` holding the steps a click selected, `station(id)` the
 * room group of a step and `dispose` cleaning up.
 */
async function installProbe(page: Studio['page']): Promise<void> {
 await page.evaluate(() => {
  const w = globalThis as any;
  w.__probe3d = (definition: unknown, css: string) => {
   const T = w.THREE, Original = T.WebGLRenderer, canvas = document.createElement('canvas'), out: any = {picked: [], canvas};
   canvas.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;' + css;
   document.body.append(canvas);
   T.WebGLRenderer = class extends Original {
    constructor(options: any) {
     super(options);
     out.renderer = this;
     const render = this.render;
     this.render = (scene: any, camera: any) => {
      out.scene = scene;
      out.camera = camera;
      return render.call(this, scene, camera);
     };
    }
   };
   try {
    out.surface = w.LWProcess3D.create(canvas, definition, (id: string) => out.picked.push(id));
   } finally {
    T.WebGLRenderer = Original;
   }
   out.station = (id: string) => {
    let g: any;
    out.scene.traverse((o: any) => {if (o.isGroup && o.userData.stepId === id) g = o;});
    return g;
   };
   out.dispose = () => {
    out.surface.dispose();
    canvas.remove();
   };
   return out;
  };
 });
}

export async function run3dChecks(studio: Studio): Promise<void> {
 const {page, check, freshStudio, applyDraft, switchTo, COUNT} = studio;
 await check('3D draws a generated 128-step process within its draw-call budget, and the merged rooms stay selectable, '
  + 'captioned and switch between their idle and working variants', async () => {
  await freshStudio(); await installProbe(page);
  const before = await query(page);
  const first = await page.evaluate((definition: any) => {
   const w = globalThis as any, session = w.LWProcessRuntime.create(definition), early = session.advance(90);
   const p = w.__probe3d(definition, 'width:1200px;height:800px'), T = w.THREE;
   p.surface.draw({definition, snapshot: early, selected: null, playing: false}, .01);
   const calls = p.renderer.info.render.calls;
   const shown = (o: any) => {
    for (let q = o; q; q = q.parent) if (!q.visible) return false;
    return true;
   };
   let casters = 0, merged = 0, markerCasters = 0;
   p.scene.traverse((o: any) => {
    if (o.isMesh && o.castShadow && shown(o)) casters++;
    if (o.userData.merged === 'stations') merged++;
    if (o.userData.token && o.castShadow) markerCasters++;
   });
   const metric = (id: string) => early.steps.find((m: any) => m.id === id);
   const busy = definition.steps.find((s: any) => s.kind === 'task' && metric(s.id).active > 0).id;
   const quiet = definition.steps.find((s: any) => s.kind === 'task' && metric(s.id).active === 0 && !metric(s.id).timers.waiting).id;
   const variant = (id: string) => {
    const v: Record<string, boolean> = {};
    p.station(id).traverse((o: any) => {if (o.userData.variant) v[o.userData.variant] = o.visible;});
    return [v.live, v.idle];
   };
   const captions = definition.steps.map((s: any) => {
    const sprites = p.station(s.id).children.filter((c: any) => c.isSprite && !c.userData.mood);
    return sprites.length === 2 && sprites.some((c: any) => /\S/.test(c.userData.caption ?? ''));
   });
   const target = definition.steps[66], v = new T.Vector3(target.scene.position[0], 0, target.scene.position[1]).project(p.camera);
   const rect = p.canvas.getBoundingClientRect();
   w.__big = {p, session, busy, quiet, variant, definition};
   return {calls, casters, merged, markerCasters, busy: variant(busy), quiet: variant(quiet), captions: captions.every(Boolean), target: target.id,
    x: rect.left + (v.x + 1) / 2 * rect.width, y: rect.top + (1 - v.y) / 2 * rect.height, steps: definition.steps.length};
  }, bigProcess());
  try {
   assert.equal(first.steps, 128);
   assert(first.calls <= DRAW_CALL_BUDGET, `${first.calls} draw calls (budget ${DRAW_CALL_BUDGET})`);
   assert(first.merged > 0 && first.merged <= 6, `every room's fixed furniture shares ${first.merged} merged meshes`);
   assert(first.casters <= CASTER_BUDGET, `${first.casters} shadow casters (budget ${CASTER_BUDGET})`);
   assert.equal(first.markerCasters, 0, 'compact markers cast no shadow');
   assert(first.captions, 'every room has its name pill and a worded front caption');
   assert.deepEqual([first.busy, first.quiet], [[true, false], [false, true]], 'a working room shows its working variant, an idle room its idle one');
   await page.mouse.click(first.x, first.y);
   const late = await page.evaluate(() => {
    const w = globalThis as any, {p, session, busy, quiet, variant, definition} = w.__big, snapshot = session.advance(6000);
    p.surface.draw({definition, snapshot, selected: null, playing: false}, .01);
    const done = snapshot.steps.find((m: any) => m.id === busy).active === 0;
    return {picked: p.picked, busy: variant(busy), quiet: variant(quiet), done};
   });
   assert.deepEqual(late.picked, [first.target], 'a click on a room selects it');
   assert(late.done, 'the busy room has finished its work');
   assert.deepEqual([late.busy, late.quiet], [[false, true], [false, true]], 'a room that finished its work returns to its idle variant');
  } finally {
   await page.evaluate(() => {
    const w = globalThis as any;
    w.__big?.p.dispose();
    w.__big?.session.dispose();
    delete w.__big;
   });
  }
  assert.deepEqual((await query(page)).snapshot, before.snapshot, 'drawing and picking never tick the studio run');
 });
 await check('3D caption canvases fit their text, hold at least half fewer pixels than two 640 x 128 canvases per step, '
  + 'and return to their baseline after a process switch', async () => {
  await freshStudio(); await page.locator('#mode-3d').click(); await nextFrames(page);
  const held = () => page.evaluate(() => {
   const l = (globalThis as any).LWProcess3D.live() as LWProcess3D.Live;
   return {canvases: l.captionCanvases, pixels: l.captionPixels};
  });
  const steps = async () => (await query(page)).definition.steps.length;
  const agency = await held(), n = await steps();
  assert.equal(agency.canvases, 2 * n, 'one name pill and one front caption per room');
  assert(agency.pixels <= n * OLD_CAPTION_PIXELS * .5, `${agency.pixels} caption pixels against ${n * OLD_CAPTION_PIXELS} before`);
  for (let i = 1; i < COUNT; i++) {
   await switchTo(i); await nextFrames(page);
   const other = await held(), m = await steps();
   assert.equal(other.canvases, 2 * m, 'process ' + i + ' holds only its own captions');
   assert(other.pixels < m * OLD_CAPTION_PIXELS * .6, `process ${i}: ${other.pixels} caption pixels`);
  }
  await switchTo(0); await nextFrames(page);
  assert.deepEqual(await held(), agency, 'back on the first process the captions hold what they held before');
  await installProbe(page);
  const sizes = await page.evaluate(() => {
   const w = globalThis as any, view = w.LWProcessStudio.query(), p = w.__probe3d(view.definition, 'width:400px;height:300px');
   try {
    p.surface.draw(view, .01); const found: number[][] = [];
    p.scene.traverse((o: any) => {if (o.isSprite && !o.userData.mood) found.push([o.material.map.image.width, o.material.map.image.height]);});
    return found;
   } finally {p.dispose();}
  });
  for (const [w, h] of sizes) assert(w! % 32 === 0 && h! % 16 === 0 && w! <= 640 && h! <= 128 && w! > 0 && h! > 0, `${w} x ${h} caption canvas`);
  assert.deepEqual(await held(), agency, 'a disposed probe surface frees its caption canvases');
 });
 await check('3D compact markers use the 2D state shapes and legend colours: one shared geometry per work state, '
  + 'and escalated markers keep their own colour', async () => {
  await freshStudio(); await installProbe(page);
  const found = await page.evaluate(() => {
   const w = globalThis as any, view = w.LWProcessStudio.query(), step = view.definition.steps.find((s: any) => s.kind === 'task');
   const token = (n: number, status: string, escalated = false) =>
    ({id: 'probe-' + n, caseId: 'case-' + n, stepId: step.id, status, remaining: 1, input: null, ...escalated ? {escalated: true} : {}});
   const statuses = ['active', 'active', 'active', 'active', 'active', 'queued', 'queued', 'timer', 'timer', 'backlog', 'backlog', 'held', 'held'];
   const tokens = [...statuses.map((s, i) => token(i, s)), token(20, 'active', true), token(21, 'held', true)];
   const p = w.__probe3d(view.definition, 'width:400px;height:300px');
   try {
    p.surface.draw({...view, snapshot: {...view.snapshot, tokens}, selected: null, playing: false}, .01);
    const markers: any[] = [];
    p.scene.traverse((o: any) => {
     if (!o.userData.token) return;
     markers.push({status: o.userData.status, shape: o.userData.shape, named: o.geometry.userData.shape, geometry: o.geometry.uuid,
      colour: '#' + o.material.color.getHexString(), escalated: o.userData.escalated});
    });
    const css = getComputedStyle(document.body), tokenOf = {active: '--accent', queued: '--state-queue', timer: '--state-timer',
     backlog: '--state-backlog', held: '--danger', escalated: '--escalated'} as Record<string, string>;
    const colours = Object.fromEntries(Object.entries(tokenOf).map(([k, v]) => [k, css.getPropertyValue(v).trim().toLowerCase()]));
    const legend = [...document.querySelectorAll('.process-legend [data-legend]')].map(n => n.getAttribute('data-legend')).slice(0, 5);
    return {markers, colours, legend, shapes: w.LWProcess3DMarkers.SHAPES};
   } finally {p.dispose();}
  });
  const shapes: Record<string, string> = found.shapes;
  assert.deepEqual({...shapes}, {active: 'disc', queued: 'ring', timer: 'hourglass', backlog: 'square', held: 'cross'});
  assert.deepEqual(found.legend, Object.keys(shapes), 'the 3D shapes follow the legend order');
  const plain = found.markers.filter(m => !m.escalated), escalated = found.markers.filter(m => m.escalated);
  assert.deepEqual(plain.map(m => m.status).sort(), ['active', 'active', 'backlog', 'backlog', 'held', 'held', 'queued', 'queued', 'timer', 'timer'],
   'three working tokens sit at desks; the rest are compact markers');
  for (const status of Object.keys(shapes)) {
   const all = found.markers.filter(m => m.status === status);
   assert.equal(new Set(all.map(m => m.geometry)).size, 1, status + ' markers share one geometry');
   assert(all.every(m => m.shape === shapes[status] && m.named === shapes[status]), status + ' markers are ' + shapes[status]);
  }
  assert.equal(new Set(found.markers.map(m => m.geometry)).size, 5, 'each work state has its own shape');
  for (const m of plain) assert.equal(m.colour, found.colours[m.status], `${m.status} marker is the legend colour`);
  assert.deepEqual(escalated.map(m => [m.status, m.colour]).sort(), [['active', found.colours.escalated], ['held', found.colours.escalated]]);
 });
 await check('3D room captions count held work as blocked, not as waiting', async () => {
  await freshStudio(); await applyDraft(blockedLine); await installProbe(page);
  for (let i = 0; i < 20 && !(await query(page)).snapshot.tokens.some(t => t.status === 'held'); i++) await page.locator('#step').click();
  const q = await query(page), make = q.snapshot.steps.find(s => s.id === 'make')!;
  assert(make.held > 0, 'work is held at the make step');
  const caption = await page.evaluate(() => {
   const w = globalThis as any, view = w.LWProcessStudio.query(), p = w.__probe3d(view.definition, 'width:400px;height:300px');
   try {
    p.surface.draw(view, .01); let text = '';
    p.station('make').traverse((o: any) => {if (o.userData.caption) text = o.userData.caption;});
    return text;
   } finally {p.dispose();}
  });
  const state = caption.split(' | ')[0]!, waiting = make.queued - make.held;
  assert.match(state, new RegExp(`(^| · )${make.held} blocked$`), caption);
  // A working step always names its waiting count (also 0); otherwise only waiting work is named.
  if (waiting || make.active) assert.match(state, new RegExp(`(^| · )${waiting} waiting( · |$)`), caption);
  else assert.doesNotMatch(state, /waiting/, caption);
  const words = await page.evaluate(() => {
   const c = (globalThis as any).LWProcess3DCaptions, timers = {waiting: 0};
   const metric = (active: number, queued: number, held: number) => ({active, queued, held, timers, completed: 0, reached: 0});
   const step = (kind: string, extra = {}) => ({id: 'x', name: 'X', kind, ...extra});
   return [c.status(step('task'), metric(2, 4, 1), 0), c.status(step('task'), metric(0, 2, 2), 0), c.status(step('task'), metric(0, 3, 0), 0),
    c.status(step('touchpoint'), metric(1, 3, 1), 0), c.status(step('task', {backlog: {capacity: 2}}), metric(1, 1, 1), 1)];
  });
  assert.deepEqual(words, ['2 working · 3 waiting · 1 blocked', '2 blocked', '3 waiting', '1 in this touchpoint · 2 waiting · 1 blocked',
   'Backlog 1/2 · 1 working · 1 blocked']);
 });
}
