/// <reference path="../process-contracts.d.ts" />
/**
 * 3D room checks of the process renderers suite (process-renderers-browser.ts calls `roomChecks` once, in its own order): room
 * captions that ignore depth and draw last on a dark pill, and touchpoint rooms with a dedicated model and mood per channel that
 * animate only during playback. Every probe draws on a throw-away 3D surface on its own canvas, restores the renderer class and
 * leaves the studio's run untouched.
 */
import assert from 'node:assert/strict';
import {nextFrames} from './browser-harness';
import {query, type Studio} from './process-browser-fixture';
import {automationFixture, roomsFixture} from './process-browser-models';

export async function roomChecks(studio: Studio): Promise<void> {
 const {page, check, freshStudio, applyDraft} = studio;
 await check('3D room captions never sit under props', async () => {
  await freshStudio(); await applyDraft(automationFixture);
  const sprites = await page.evaluate(() => {
   const w = globalThis as any, T = w.THREE, view = w.LWProcessStudio.query(), canvas = document.createElement('canvas');
   canvas.style.cssText = 'width:400px;height:300px';
   document.body.append(canvas);
   let captured: any; const Original = T.WebGLRenderer;
   T.WebGLRenderer = class extends Original {
    constructor(options: any) {
     super(options);
     const render = this.render;
     this.render = (scene: any, camera: any) => {captured = scene; return render.call(this, scene, camera);};
    }
   };
   const surface = w.LWProcess3D.create(canvas, view.definition, () => {});
   try {
    surface.draw(view, .01); const found: any[] = [];
    captured.traverse((o: any) => {
     if (o.isSprite) {
      const c = o.material.map.image as HTMLCanvasElement, alpha = c.getContext('2d')!.getImageData(c.width / 2, 40, 1, 1).data[3];
      found.push({depthTest: o.material.depthTest, depthWrite: o.material.depthWrite, transparent: o.material.transparent, order: o.renderOrder, alpha});
     }
    });
    return {found, steps: view.definition.steps.length};
   } finally {surface.dispose(); canvas.remove(); T.WebGLRenderer = Original;}
  });
  assert.equal(sprites.found.length, sprites.steps * 2, 'one name pill and one front caption per room; the floating sub-label is folded into the caption');
  for (const s of sprites.found) assert.deepEqual([s.depthTest, s.depthWrite, s.transparent, s.order >= 20, s.alpha > 150], [false, false, true, true, true],
   'captions ignore depth, draw last and sit on a dark pill');
 });
 /**
  * Draws every named room in one throw-away 3D surface: text signs, mesh count, a fingerprint of the room's geometry, its mood sprites
  * and whether visible props moved while playing, froze when paused and left the run untouched.
  */
 const touchpointProbe = (ids: string[]) => page.evaluate(list => {
  const w = globalThis as any, T = w.THREE, view = w.LWProcessStudio.query(), before = JSON.stringify(view.snapshot), canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:400px;height:300px';
  document.body.append(canvas);
  let captured: any; const Original = T.WebGLRenderer;
  T.WebGLRenderer = class extends Original {
   constructor(options: any) {
    super(options);
    const render = this.render;
    this.render = (scene: any, camera: any) => {captured = scene; return render.call(this, scene, camera);};
   }
  };
  const surface = w.LWProcess3D.create(canvas, view.definition, () => {}), out: Record<string, any> = {};
  try {
   for (const id of list) {
    const shown = {...view, selected: id, playing: true};
    surface.draw(shown, .01);
    let station: any;
    captured.traverse((o: any) => {if (o.isGroup && o.userData.stepId === id) station = o;});
    const signs: string[] = [], moods: number[] = [], shape: string[] = []; let meshes = 0, hash = 0;
    const own = (o: any) => [o.position.x, o.position.y, o.position.z, o.scale.x, o.scale.y, o.scale.z, o.material.color?.getHexString()]
     .map(n => typeof n === 'number' ? Math.round(n * 100) : n).join(',');
    // Merged fixed furniture counts its pieces (userData.pieces) and contributes its piece fingerprint (userData.shape).
    station.traverse((o: any) => {
     if (o.userData.signText) signs.push(o.userData.signText);
     if (o.userData.mood) moods.push(o.userData.mood.level);
     if (o.userData.pieces !== undefined) {meshes += o.userData.pieces; shape.push('fixed ' + o.userData.shape);}
     else if (o.isMesh) {meshes++; shape.push(own(o));}
    });
    for (const ch of shape.sort().join(';')) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const pose = () => {
     const p: number[] = [];
     const walk = (o: any) => {
      if (!o.visible || o.isSprite) return;
      p.push(o.position.x, o.position.y, o.position.z, o.rotation.x, o.rotation.y, o.rotation.z, o.scale.x, o.scale.y, o.scale.z);
      o.children.forEach(walk);
     };
     walk(station);
     return p.map(n => Math.round(n * 1e5)).join(',');
    };
    const first = pose();
    surface.draw(shown, .1);
    const second = pose();
    shown.playing = false;
    surface.draw(shown, .1);
    const paused = pose();
    surface.draw(shown, .1);
    out[id] = {signs, moods, meshes, hash, moved: first !== second, frozen: second === paused && paused === pose(),
     unchanged: before === JSON.stringify(w.LWProcessStudio.query().snapshot)};
   }
   return out;
  } finally {surface.dispose(); canvas.remove(); T.WebGLRenderer = Original;}
 }, ids);
 await check('Touchpoint rooms render a dedicated model per channel and animate only during playback', async () => {
  await freshStudio(); await applyDraft(roomsFixture); assert.equal((await query(page)).definition.id, 'room-fixture');
  const labels: Record<string, string> = {web: 'Website', mobile: 'Mobile app', store: 'Store', phone: 'Phone', chat: 'Chat', email: 'Email',
   social: 'Social media', ads: 'Advertising', delivery: 'Delivery', document: 'Documents', generic: ''};
  const ids = Object.keys(labels).map(c => 'tp-' + c), levels = [-3, -2, -1, 0, 1, 2, 3];
  const check11 = (rooms: Record<string, any>, expected: {moved: boolean; label: string}) => ids.forEach((id, i) => {
   const room = rooms[id], c = id.slice(3);
   assert.deepEqual([room.moved, room.frozen, room.unchanged], [expected.moved, true, true], `${id}: ${expected.label}`);
   assert.deepEqual(room.signs, ['Touchpoint' + (labels[c] ? ' · ' + labels[c] : '')], id + ' sign');
   assert.deepEqual(room.moods, i < 7 ? [levels[i]] : [], id + ' mood face only when an emotion is authored');
   assert(room.meshes > 45 && room.meshes < 160, `${id} has a dedicated model with a bounded mesh count (${room.meshes})`);
  });
  const idle = await touchpointProbe(ids); check11(idle, {moved: false, label: 'a quiet idle room stays still even while the clock plays'});
  assert.equal(new Set(ids.map(id => idle[id].hash)).size, ids.length, 'every channel (and the generic kiosk) has its own model');
  await page.locator('#mode-2d').click();
  await page.locator('[data-step="tp-web"]').click();
  assert.match(await page.locator('#map svg').textContent() ?? '', /Idle/);
  assert.match(await page.locator('#map svg g[role=button]').getAttribute('aria-label') ?? '', /\(touchpoint, Website\)/);
  await page.locator('#mode-3d').click(); await page.locator('#overview').click(); await page.locator('#advance').click();
  for (let i = 0; i < 20 && !(await query(page)).snapshot.steps.filter(s => s.id.startsWith('tp-')).every(s => s.active > 0); i++)
   await page.locator('#step').click();
  assert((await query(page)).snapshot.steps.filter(s => s.id.startsWith('tp-')).every(s => s.active > 0), 'every touchpoint has a customer in it');
  const live = await touchpointProbe(ids); check11(live, {moved: true, label: 'animates while playing and freezes when paused'});
  await page.emulateMedia({reducedMotion: 'reduce'});
  const calm = await touchpointProbe(ids);
  await page.emulateMedia({reducedMotion: 'no-preference'});
  check11(calm, {moved: false, label: 'stays still with reduced motion'});
  await page.locator('#mode-2d').click(); await page.locator('[data-step="tp-chat"]').click(); const chat = await page.locator('#map svg').textContent() ?? '';
  assert.match(chat, /In this touchpoint/);
  assert.match(chat, /touchpoint · 600 min/);
  assert.doesNotMatch(chat, /Idle|Typing|Drafting|Building/);
  assert.match(await page.locator('#map svg g[role=button]').getAttribute('aria-label') ?? '',
   /\(touchpoint, Chat\).*1 in this touchpoint, 0 waiting for a team/);
  await page.locator('[data-step="end"]').click();
  assert.match(await page.locator('#map svg').textContent() ?? '', /Phase · Done/);
  assert.equal(await page.locator('#map svg .pm-outcome-goal').count(), 1);
  assert.match(await page.locator('#map svg g[role=button]').getAttribute('aria-label') ?? '', /\(end, goal\)/);
  await page.locator('#mode-3d').click(); await nextFrames(page); await page.locator('#overview').click(); await nextFrames(page);
 });
}
