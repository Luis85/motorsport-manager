/// <reference path="../process-contracts.d.ts" />
/** Process Studio renderers: 2D map and 3D rooms for actors, timers, machines, touchpoints, inclusive forks, instances and deadline paths. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {waitForReady, openArtifact, nextFrames} from './browser-harness';
import {query, OUT, runSuite} from './process-browser-fixture';
import {timerFixture, automationFixture, roomsFixture, claimsDesk, blockedLine} from './process-browser-models';
import {encoding, STATE, waitingAt} from './process-map-probe';
import {mapUpdateChecks} from './process-map-update-checks';
runSuite('process renderers browser harness', 'process-renderers-browser-results.json', async studio => {
 const {page, file, fixtureUrls, check, checkLifecycle, freshStudio, showIo, switchTo, applyDraft, importClaims, importJson, COUNT} = studio;
 await check('Actor joints animate only during playback, respect reduced motion, and do not tick the process', async () => {
  await page.locator('#reset').click();
  const exercise = async (reduced: boolean) => {
   await page.emulateMedia({reducedMotion: reduced ? 'reduce' : 'no-preference'});
   return page.evaluate(() => {
    const w = globalThis as any, T = w.THREE, view = w.LWProcessStudio.query(), before = JSON.stringify(view.snapshot);
    const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:400px;height:300px'; document.body.append(canvas);
    let captured: any; const OriginalRenderer = T.WebGLRenderer;
    T.WebGLRenderer = class extends OriginalRenderer {constructor(options: any) {super(options); const render = this.render; this.render = (scene: any, camera: any) => {captured = scene; return render.call(this, scene, camera);};}};
    const surface = w.LWProcess3D.create(canvas, view.definition, () => {});
    try {
     view.selected = 'discovery'; view.playing = true; surface.draw(view, .01);
     const actors: any[] = []; captured.traverse((o: any) => {if (o.userData.actor) actors.push(o);});
     const pose = () => actors[0].userData.hands[0].rotation.x;
     const first = pose(); surface.draw(view, .1); const moving = pose();
     view.playing = false; surface.draw(view, .1); const paused = pose(); surface.draw(view, .1);
     return {actors: actors.length, moved: first !== moving, frozen: moving === paused && paused === pose(), unchanged: before === JSON.stringify(w.LWProcessStudio.query().snapshot)};
    } finally {surface.dispose(); canvas.remove(); T.WebGLRenderer = OriginalRenderer;}
   });
  };
  assert.deepEqual(await exercise(false), {actors: 1, moved: true, frozen: true, unchanged: true});
  assert.deepEqual(await exercise(true), {actors: 1, moved: false, frozen: true, unchanged: true});
  await page.emulateMedia({reducedMotion: 'no-preference'});
 });
 await check('Timer steps render in 2D and 3D with due minutes, never crash and never read as blocked', async () => {
  await openArtifact(page, file, {url: fixtureUrls[0]!}); await waitForReady(page, {host: 'process'});
  await applyDraft(timerFixture); const loaded = await query(page); assert.equal(loaded.definition.id, 'timer-fixture');
  await page.locator('#horizon').selectOption('1440').catch(() => undefined);
  for (let i = 0; i < 40 && !(await query(page)).snapshot.tokens.some(t => t.status === 'timer'); i++) await page.locator('#step').click();
  let q = await query(page), token = q.snapshot.tokens.find(t => t.status === 'timer')!; assert(token, 'a timer token is pending'); assert.equal(token.stepId, 'wait'); assert.equal(typeof token.due, 'number');
  const metric = q.snapshot.steps.find(s => s.id === 'wait')!; assert.deepEqual(metric.timers, {waiting: 1, nextDue: token.due}); assert.equal(metric.queued, 0); assert.equal(metric.active, 0);
  assert.notEqual(q.snapshot.status, 'blocked'); assert.doesNotMatch(await page.locator('#run-status').innerText(), /Blocked/);
  assert.match(await page.locator('.process-legend').innerText(), /Timer/);
  assert.match(await page.locator('[data-step="wait"]').innerText(), /1 on timer/);
  const before = q.snapshot;
  await page.locator('#mode-2d').click();
  const group = page.locator('#process-map-wait'); assert.match(await group.getAttribute('aria-label') ?? '', new RegExp(`1 on timer, next due minute ${token.due}`));
  const textOf = (id: string) => page.evaluate(i => document.getElementById(i)!.textContent ?? '', id);
  assert.match(await textOf('process-map-wait'), /Waiting on timer/); assert.match(await textOf('process-map-wait'), /timer · 30 min/);
  assert.match(await textOf('process-map-until'), /until minute 200/);
  await page.locator('[data-step="wait"]').click();
  assert.match(await page.locator('#map svg').textContent() ?? '', new RegExp(`1 on timer, next due ${token.due}`));
  assert.match(await page.locator('#inspector').innerText(), new RegExp(`Waiting on timer · 1 waiting, next due minute ${token.due}`));
  assert.match(await page.locator('#inspector').innerText(), /Wait 30 min/);
  await showIo(); assert.match(await page.locator('#process-data').innerText(), new RegExp(`Waiting on timer · due minute ${token.due}`));
  await page.locator('#mode-3d').click(); await nextFrames(page); await page.locator('#overview').click(); await nextFrames(page);
  await page.locator('[data-step="until"]').click(); assert.match(await page.locator('#inspector').innerText(), /Until minute 200/);
  await page.locator('[data-step="wait"]').click(); await nextFrames(page);
  const kinds = await page.evaluate(() => (globalThis as any).LWProcessRooms.theme({id: 'x', kind: 'timer'}).id); assert.equal(kinds, 'clock');
  assert.deepEqual((await query(page)).snapshot, before); assert.equal((await query(page)).playing, false);
  await page.locator('#mode-2d').click(); await page.locator('#overview').click();
  await page.locator('#open-activity').click(); await page.locator('dialog.pd-dialog[open]').waitFor(); assert.match(await page.locator('#act-rows').innerText(), /timer started/); assert.match(await page.locator('#act-rows').innerText(), /Timer due minute \d+/); await page.keyboard.press('Escape');
  await page.setViewportSize({width: 390, height: 844}); await nextFrames(page);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); await page.screenshot({path: path.join(OUT, 'process-timer-mobile.png'), fullPage: true});
  await page.setViewportSize({width: 1440, height: 1060});
 });
 await check('Counter effects and timer receipts appear in Inputs and outputs and the inspector', async () => {
  await showIo(); await page.locator('#reset').click(); await page.locator('#step').click(); await page.locator('[data-step="loop"]').click();
  assert.match(await page.locator('#process-data').innerText(), /\+1 to iteration/); assert.match(await page.locator('#process-data').innerText(), /Current counters: iteration = 0/);
  assert.match(await page.locator('#inspector').innerText(), /\+1 to iteration \(counter\)/);
  for (let i = 0; i < 80 && (await query(page)).snapshot.status !== 'completed'; i++) { if (await page.locator('#advance').isDisabled()) break; await page.locator('#advance').click(); }
  const done = (await query(page)).snapshot; assert.equal(done.status, 'completed'); assert.equal(done.cases[0]!.data.iteration, 1); assert.equal(done.cases[0]!.data.waits, 1);
  const receipt = done.receipts.find(r => r.stepId === 'wait')!; assert.match(receipt.id, /:wait$/); assert.deepEqual(receipt.changes, {waits: 1});
  await page.locator('[data-step="loop"]').click(); assert.match(await page.locator('#process-data').innerText(), /Step outputs/); assert.match(await page.locator('#process-data').innerText(), /iteration/);
  await page.locator('[data-step="wait"]').click(); const text = await page.locator('#process-data').innerText();
  assert.match(text, /Completed · \d+–\d+ min/); assert.match(text, /Step inputs/); assert.match(text, /waits/); assert.equal(await page.locator('#process-visit option').count(), 2);
  await page.locator('#process-written-toggle').click(); assert.match(await page.locator('.process-written').innerText(), /waits/);
  await page.locator('[data-step="until"]').click(); assert.match(await page.locator('#process-data').innerText(), /Completed · \d+–\d+ min/);
  await page.locator('[data-step="wait"]').click(); await page.locator('#edit-step').click(); assert.equal(await page.locator('#se-duration').inputValue(), '30');
  assert.equal(await page.locator('[data-bind="add.0.delta"]').inputValue(), '1'); assert.equal(await page.locator('#se-cost').count(), 0);
  await page.locator('#se-close').click(); assert.equal(await page.locator('dialog.pd-dialog[open]').count(), 0);
 });
 await check('Selecting a step on the zoomed 2D map leaves no scaled focus ring around the card', async () => {
  await freshStudio(); await page.locator('#mode-2d').click(); const box = (await page.locator('#map').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.wheel(0, -600);
  await page.locator('[id^="process-map-"]').nth(4).click({force: true}); await page.waitForFunction(() => document.querySelectorAll('#map svg g[role=button]').length === 1);
  const ring = await page.evaluate(() => { const g = document.querySelector('#map svg g[role=button]') as SVGGElement, c = getComputedStyle(g), card = getComputedStyle(g.querySelector('rect')!); return {outline: c.outlineStyle, effect: card.vectorEffect}; });
  assert.equal(ring.outline, 'none', 'the browser focus outline on the step group must be off because the camera scales it into a huge circle');
  await page.locator('[id^="process-map-"]').first().focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
  const stroke = await page.evaluate(() => { const g = document.activeElement as SVGGElement, rect = g.querySelector('rect')!; return {vector: getComputedStyle(rect).vectorEffect, width: getComputedStyle(rect).strokeWidth}; });
  assert.equal(stroke.vector, 'non-scaling-stroke', 'the keyboard focus ring must keep a screen-sized stroke'); assert.equal(stroke.width, '3px');
 });
 /** Draws one room in a throw-away 3D surface and reports its text signs and whether its visible props moved between frames (playing), stayed put when paused, and left the run untouched. */
 const roomMotion = (stepId: string) => page.evaluate(id => {
  const w = globalThis as any, T = w.THREE, view = w.LWProcessStudio.query(), before = JSON.stringify(view.snapshot);
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:400px;height:300px'; document.body.append(canvas);
  let captured: any; const Original = T.WebGLRenderer;
  T.WebGLRenderer = class extends Original {constructor(options: any) {super(options); const render = this.render; this.render = (scene: any, camera: any) => {captured = scene; return render.call(this, scene, camera);};}};
  const surface = w.LWProcess3D.create(canvas, view.definition, () => {});
  try {
   view.selected = id; view.playing = true; surface.draw(view, .01);
   let station: any; captured.traverse((o: any) => {if (o.isGroup && o.userData.stepId === id) station = o;});
   const signs: string[] = []; let meshes = 0; station.traverse((o: any) => {if (o.userData.signText) signs.push(o.userData.signText); if (o.isMesh) meshes++;});
   const pose = () => {const out: number[] = []; const walk = (o: any) => {if (!o.visible || o.isSprite) return; out.push(o.position.x, o.position.y, o.position.z, o.rotation.x, o.rotation.y, o.rotation.z, o.scale.x, o.scale.y, o.scale.z); o.children.forEach(walk);}; walk(station); return out.map(n => Math.round(n * 1e5)).join(',');};
   const first = pose(); surface.draw(view, .1); const second = pose(); view.playing = false; surface.draw(view, .1); const paused = pose(); surface.draw(view, .1);
   return {signs, meshes, moved: first !== second, frozen: second === paused && paused === pose(), unchanged: before === JSON.stringify(w.LWProcessStudio.query().snapshot)};
  } finally {surface.dispose(); canvas.remove(); T.WebGLRenderer = Original;}
 }, stepId);
 await check('Machine and system rooms render dedicated models and animate only during playback', async () => {
  await freshStudio(); await applyDraft(automationFixture); assert.equal((await query(page)).definition.id, 'automation-fixture');
  const idle = {pack: await roomMotion('pack'), build: await roomMotion('build'), plan: await roomMotion('plan')};
  assert.deepEqual([idle.pack.moved, idle.build.moved, idle.pack.frozen, idle.build.frozen], [false, false, true, true], 'idle machine and system rooms stay quiet even while the clock plays');
  assert.deepEqual(idle.pack.signs, ['Robot arm']); assert.deepEqual(idle.build.signs, ['CI/CD pipeline']); assert.deepEqual(idle.plan.signs, []);
  for (const room of [idle.pack, idle.build]) assert(room.meshes > 40 && room.meshes < 160, `dedicated model with a bounded mesh count (${room.meshes})`);
  await page.locator('#advance').click(); for (let i = 0; i < 2; i++) await page.locator('#step').click();
  const running = (await query(page)).snapshot; assert.equal(running.minute, 32); assert(running.steps.find(s => s.id === 'pack')!.active > 0 && running.steps.find(s => s.id === 'build')!.active > 0);
  for (const id of ['pack', 'build'] as const) {
   const live = await roomMotion(id); assert.deepEqual([live.moved, live.frozen, live.unchanged], [true, true, true], id + ' animates while playing and freezes when paused');
   await page.emulateMedia({reducedMotion: 'reduce'}); const calm = await roomMotion(id); await page.emulateMedia({reducedMotion: 'no-preference'});
   assert.deepEqual([calm.moved, calm.frozen, calm.unchanged], [false, true, true], id + ' stays still with reduced motion');
  }
  await page.locator('#mode-2d').click(); await page.locator('[data-step="pack"]').click();
  const pack = await page.locator('#map svg').textContent() ?? ''; assert.match(pack, /Running automatically/); assert.match(pack, /machine · 20 min/); assert.match(pack, /Robot arm/); assert.doesNotMatch(pack, /Typing|Drafting|Building/);
  await page.locator('[data-step="build"]').click(); const build = await page.locator('#map svg').textContent() ?? ''; assert.match(build, /Running automatically/); assert.match(build, /system · 20 min/); assert.match(build, /CI\/CD pipeline/);
  assert.match(await page.locator('#map svg g[role=button]').getAttribute('aria-label') ?? '', /\(system, CI\/CD pipeline\)/);
  await page.locator('#mode-3d').click(); await nextFrames(page); await page.locator('#overview').click(); await nextFrames(page);
 });
 await check('2D map keeps titles legible at fit zoom and hides secondary text until zoomed', async () => {
  await freshStudio(); await switchTo(1); await page.locator('#mode-2d').click();
  const total = (await query(page)).definition.steps.length; await page.waitForFunction(n => document.querySelectorAll('#map svg .pm-title').length === n, total); assert(total >= 22);
  const titles = () => page.evaluate(() => { const svg = document.querySelector('#map svg') as SVGSVGElement, t = svg.querySelector('.pm-title') as SVGTextElement; return {px: parseFloat(t.getAttribute('font-size')!) * svg.getScreenCTM()!.a, box: t.getBoundingClientRect().height, secondary: [...svg.querySelectorAll('.pm-secondary')].some(n => getComputedStyle(n).display !== 'none'), hint: !(document.getElementById('map-zoom-hint') as HTMLElement).hidden, squeezed: svg.querySelectorAll('[textLength],[lengthAdjust]').length}; });
  const fitted = await titles(); assert(fitted.px >= 10.9, `title is ${fitted.px}px on screen at fit`); assert(fitted.box >= 10); assert.equal(fitted.secondary, false); assert.equal(fitted.hint, true); assert.equal(fitted.squeezed, 0);
  assert.equal(await page.evaluate(() => document.getElementById('map-zoom-hint')!.textContent), 'Zoom in for details');
  const box = (await page.locator('#map').boundingBox())!; await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 4 && !(await titles()).secondary; i++) await page.mouse.wheel(0, -500);
  await page.waitForFunction(() => [...document.querySelectorAll('#map svg .pm-secondary')].some(n => getComputedStyle(n).display !== 'none'));
  const zoomed = await titles(); assert(zoomed.px >= 10.9 && zoomed.secondary && !zoomed.hint, 'secondary lines appear and the hint goes once zoomed');
  await page.locator('button[aria-label="Reset map view"]').click(); await page.waitForFunction(() => ![...document.querySelectorAll('#map svg .pm-secondary')].some(n => getComputedStyle(n).display !== 'none'));
  assert.equal((await titles()).hint, true);
  // The hint is a real button: Enter zooms to the level where secondary text is readable, and focus moves on to the map.
  assert.equal(await page.locator('#map-zoom-hint').evaluate(b => b.tagName), 'BUTTON');
  await page.locator('#map-zoom-hint').focus(); await page.keyboard.press('Enter');
  const read = await titles(); assert(read.secondary && !read.hint, 'Zoom in for details zooms to readable secondary text');
  const onMap = await page.evaluate(() => document.activeElement === document.querySelector('#map svg'));
  assert.equal(onMap, true, 'focus moves from the hidden button to the map');
  await page.locator('button[aria-label="Reset map view"]').click(); assert.equal((await titles()).hint, true);
  await page.locator('button[aria-label="Zoom in"]').click(); await page.locator('button[aria-label="Zoom in"]').click(); assert.equal((await titles()).secondary, false, 'two small steps are still below the 9px secondary size');
  const long = await page.evaluate(() => {
   const d = (globalThis as any).LWProcessStudio.query().definition.steps.reduce((a: any, s: any) => s.name.length > a.name.length ? s : a);
   const g = document.getElementById('process-map-' + d.id)!, lines = [...g.querySelectorAll('.pm-title tspan')].map(t => t.textContent!);
   const shown = lines.reduce((a, l) => a.endsWith('-') ? a.slice(0, -1) + l : a ? a + ' ' + l : l, '');
   return {full: d.name, tip: g.querySelector('title')!.textContent, caption: g.dataset.caption, shown};
  });
  const kept = long.shown.replace(/…$/, '');
  const whole = kept === long.full || long.shown.endsWith('…') && long.full[kept.length] === ' ';
  assert.equal(long.tip, long.full);
  assert(long.full.length > 20 && long.full.startsWith(kept) && whole, 'a long name ends in an ellipsis only after a whole word: ' + long.shown);
  assert(long.caption!.startsWith(long.full + ' · '), 'the card caption carries the full name');
  // Idle cards: a dashed border in --axis, at least 3:1 against the stage.
  const idle = await page.evaluate(() => {
   const card = document.querySelector('#map svg g[data-status=idle] > .pm-card') as SVGRectElement, weights = [.2126, .7152, .0722];
   const linear = (v: number) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
   const lum = (c: string) => c.match(/\d+/g)!.slice(0, 3).map(v => linear(Number(v) / 255)).reduce((a, v, i) => a + v * weights[i]!, 0);
   const stroke = getComputedStyle(card).stroke, bg = getComputedStyle(document.body).backgroundColor;
   const [hi, lo] = [lum(stroke), lum(bg)].sort((a, b) => b - a) as [number, number];
   return {stroke, dash: getComputedStyle(card).strokeDasharray, contrast: (hi + .05) / (lo + .05)};
  });
  assert.equal(idle.stroke, 'rgb(106, 118, 132)'); assert.notEqual(idle.dash, 'none');
  assert(idle.contrast >= 3, `idle card border contrast is ${idle.contrast}`);
  assert.equal(await page.locator('#map svg').getAttribute('aria-describedby'), 'camera-hint'); assert.equal(await page.locator('#camera-hint').count(), 1);
  await page.locator('[id^="process-map-"]').first().focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
  const ring = await page.evaluate(() => { const g = document.activeElement as SVGGElement, outer = getComputedStyle(g.querySelector('.pm-focus-ring')!), card = getComputedStyle(g.querySelector('rect')!); return {display: outer.display, outer: outer.stroke, width: outer.strokeWidth, inner: card.stroke}; });
  assert.deepEqual(ring, {display: 'inline', outer: 'rgb(255, 255, 255)', width: '7px', inner: 'rgb(255, 187, 115)'});
 });
 await check('3D room captions never sit under props', async () => {
  await freshStudio(); await applyDraft(automationFixture);
  const sprites = await page.evaluate(() => {
   const w = globalThis as any, T = w.THREE, view = w.LWProcessStudio.query(), canvas = document.createElement('canvas'); canvas.style.cssText = 'width:400px;height:300px'; document.body.append(canvas);
   let captured: any; const Original = T.WebGLRenderer;
   T.WebGLRenderer = class extends Original {constructor(options: any) {super(options); const render = this.render; this.render = (scene: any, camera: any) => {captured = scene; return render.call(this, scene, camera);};}};
   const surface = w.LWProcess3D.create(canvas, view.definition, () => {});
   try {
    surface.draw(view, .01); const found: any[] = [];
    captured.traverse((o: any) => {if (o.isSprite) { const c = o.material.map.image as HTMLCanvasElement, alpha = c.getContext('2d')!.getImageData(c.width / 2, 40, 1, 1).data[3]; found.push({depthTest: o.material.depthTest, depthWrite: o.material.depthWrite, transparent: o.material.transparent, order: o.renderOrder, alpha});}});
    return {found, steps: view.definition.steps.length};
   } finally {surface.dispose(); canvas.remove(); T.WebGLRenderer = Original;}
  });
  assert.equal(sprites.found.length, sprites.steps * 2, 'one name pill and one front caption per room; the floating sub-label is folded into the caption');
  for (const s of sprites.found) assert.deepEqual([s.depthTest, s.depthWrite, s.transparent, s.order >= 20, s.alpha > 150], [false, false, true, true, true], 'captions ignore depth, draw last and sit on a dark pill');
 });
 /** Draws every named room in one throw-away 3D surface: text signs, mesh count, a fingerprint of the room's geometry, its mood sprites and whether visible props moved while playing, froze when paused and left the run untouched. */
 const touchpointProbe = (ids: string[]) => page.evaluate(list => {
  const w = globalThis as any, T = w.THREE, view = w.LWProcessStudio.query(), before = JSON.stringify(view.snapshot), canvas = document.createElement('canvas'); canvas.style.cssText = 'width:400px;height:300px'; document.body.append(canvas);
  let captured: any; const Original = T.WebGLRenderer;
  T.WebGLRenderer = class extends Original {constructor(options: any) {super(options); const render = this.render; this.render = (scene: any, camera: any) => {captured = scene; return render.call(this, scene, camera);};}};
  const surface = w.LWProcess3D.create(canvas, view.definition, () => {}), out: Record<string, any> = {};
  try {
   for (const id of list) {
    const shown = {...view, selected: id, playing: true}; surface.draw(shown, .01); let station: any; captured.traverse((o: any) => {if (o.isGroup && o.userData.stepId === id) station = o;});
    const signs: string[] = [], moods: number[] = [], shape: string[] = []; let meshes = 0, hash = 0;
    station.traverse((o: any) => {if (o.userData.signText) signs.push(o.userData.signText); if (o.userData.mood) moods.push(o.userData.mood.level); if (o.isMesh) {meshes++; shape.push([o.position.x, o.position.y, o.position.z, o.scale.x, o.scale.y, o.scale.z, o.material.color?.getHexString()].map(n => typeof n === 'number' ? Math.round(n * 100) : n).join(','));}});
    for (const ch of shape.sort().join(';')) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const pose = () => {const p: number[] = []; const walk = (o: any) => {if (!o.visible || o.isSprite) return; p.push(o.position.x, o.position.y, o.position.z, o.rotation.x, o.rotation.y, o.rotation.z, o.scale.x, o.scale.y, o.scale.z); o.children.forEach(walk);}; walk(station); return p.map(n => Math.round(n * 1e5)).join(',');};
    const first = pose(); surface.draw(shown, .1); const second = pose(); shown.playing = false; surface.draw(shown, .1); const paused = pose(); surface.draw(shown, .1);
    out[id] = {signs, moods, meshes, hash, moved: first !== second, frozen: second === paused && paused === pose(), unchanged: before === JSON.stringify(w.LWProcessStudio.query().snapshot)};
   }
   return out;
  } finally {surface.dispose(); canvas.remove(); T.WebGLRenderer = Original;}
 }, ids);
 await check('Touchpoint rooms render a dedicated model per channel and animate only during playback', async () => {
  await freshStudio(); await applyDraft(roomsFixture); assert.equal((await query(page)).definition.id, 'room-fixture');
  const labels: Record<string, string> = {web: 'Website', mobile: 'Mobile app', store: 'Store', phone: 'Phone', chat: 'Chat', email: 'Email', social: 'Social media', ads: 'Advertising', delivery: 'Delivery', document: 'Documents', generic: ''};
  const ids = Object.keys(labels).map(c => 'tp-' + c), levels = [-3, -2, -1, 0, 1, 2, 3];
  const check11 = (rooms: Record<string, any>, expected: {moved: boolean; label: string}) => ids.forEach((id, i) => {
   const room = rooms[id], c = id.slice(3); assert.deepEqual([room.moved, room.frozen, room.unchanged], [expected.moved, true, true], `${id}: ${expected.label}`);
   assert.deepEqual(room.signs, ['Touchpoint' + (labels[c] ? ' · ' + labels[c] : '')], id + ' sign'); assert.deepEqual(room.moods, i < 7 ? [levels[i]] : [], id + ' mood face only when an emotion is authored');
   assert(room.meshes > 45 && room.meshes < 160, `${id} has a dedicated model with a bounded mesh count (${room.meshes})`);
  });
  const idle = await touchpointProbe(ids); check11(idle, {moved: false, label: 'a quiet idle room stays still even while the clock plays'});
  assert.equal(new Set(ids.map(id => idle[id].hash)).size, ids.length, 'every channel (and the generic kiosk) has its own model');
  await page.locator('#mode-2d').click(); await page.locator('[data-step="tp-web"]').click(); assert.match(await page.locator('#map svg').textContent() ?? '', /Idle/);
  assert.match(await page.locator('#map svg g[role=button]').getAttribute('aria-label') ?? '', /\(touchpoint, Website\)/);
  await page.locator('#mode-3d').click(); await page.locator('#overview').click(); await page.locator('#advance').click();
  for (let i = 0; i < 20 && !(await query(page)).snapshot.steps.filter(s => s.id.startsWith('tp-')).every(s => s.active > 0); i++) await page.locator('#step').click();
  assert((await query(page)).snapshot.steps.filter(s => s.id.startsWith('tp-')).every(s => s.active > 0), 'every touchpoint has a customer in it');
  const live = await touchpointProbe(ids); check11(live, {moved: true, label: 'animates while playing and freezes when paused'});
  await page.emulateMedia({reducedMotion: 'reduce'}); const calm = await touchpointProbe(ids); await page.emulateMedia({reducedMotion: 'no-preference'}); check11(calm, {moved: false, label: 'stays still with reduced motion'});
  await page.locator('#mode-2d').click(); await page.locator('[data-step="tp-chat"]').click(); const chat = await page.locator('#map svg').textContent() ?? '';
  assert.match(chat, /In this touchpoint/); assert.match(chat, /touchpoint · 600 min/); assert.doesNotMatch(chat, /Idle|Typing|Drafting|Building/); assert.match(await page.locator('#map svg g[role=button]').getAttribute('aria-label') ?? '', /\(touchpoint, Chat\).*1 in this touchpoint, 0 waiting for a team/);
  await page.locator('[data-step="end"]').click(); assert.match(await page.locator('#map svg').textContent() ?? '', /Phase · Done/); assert.equal(await page.locator('#map svg .pm-outcome-goal').count(), 1); assert.match(await page.locator('#map svg g[role=button]').getAttribute('aria-label') ?? '', /\(end, goal\)/);
  await page.locator('#mode-3d').click(); await nextFrames(page); await page.locator('#overview').click(); await nextFrames(page);
 });
 await check('Renderers show inclusive forks, multiple instances, deadline paths and escalated tokens and route views ignore deadline flows', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await importClaims(true, true); await page.locator('#mode-2d').click();
  for (let i = 0; i < 2; i++) await page.locator('#advance').click();
  const live = (await query(page)).snapshot; assert.ok(live.tokens.some(t => t.escalated) && live.tokens.some(t => t.item !== undefined && t.items === 3 || t.deadlineAt !== undefined), 'the seeded run holds escalated, item and deadline tokens'); assert.equal(live.minute, 60);
  const map = await page.evaluate(() => {
   const q = (s: string) => [...document.querySelectorAll<SVGElement>('#map svg ' + s)];
   const css = (e: Element) => getComputedStyle(e), paint = (e: Element) => css(e).fill === 'none' ? css(e).stroke : css(e).fill;
   return {deadline: q('.pm-edge-deadline').map(e => [e.dataset.flow, css(e).stroke, css(e).strokeDasharray, e.getAttribute('class')]),
    plain: q('.pm-edge:not(.pm-edge-deadline):not(.pm-edge-conditional)').map(e => css(e).stroke), tags: q('.pm-deadline-tag text').map(t => t.textContent),
    conditional: q('.pm-edge-conditional').map(e => [e.dataset.flow, e.classList.contains('pm-edge-inclusive'), css(e).stroke, css(e).strokeDasharray]),
    gateways: q('.pm-gateway-inclusive').length, instances: q('.pm-instances').map(p => p.textContent), clocks: q('.pm-deadline-badge').length,
    escalated: q('.pm-token-escalated').map(paint), label: document.getElementById('process-map-route')!.getAttribute('aria-label')};
  });
  assert.deepEqual(map.deadline.map(d => d[0]).sort(), ['approve-late', 'intake-late']);
  assert.ok(map.deadline.every(d => d[2] !== 'none' && d[1] !== map.plain[0]), 'deadline flows are dashed in their own colour');
  assert.deepEqual(map.deadline.map(d => d[3]).sort(), ['pm-edge pm-edge-deadline pm-edge-escalate', 'pm-edge pm-edge-deadline pm-edge-interrupt']);
  assert.deepEqual(map.tags.sort(), ['deadline · escalate', 'deadline · interrupt']);
  assert.deepEqual(map.conditional.map(c => c[0]).sort(), ['to-gift', 'to-insure']);
  const decision = (c: (string | boolean | undefined)[]) => c[1] === true && c[2] === 'rgb(199, 152, 113)' && c[3] !== 'none' && c[3] !== map.deadline[0]![2];
  assert.ok(map.conditional.every(decision), 'inclusive fork flows read like decision flows: dashed, unlike deadline dots');
  assert.equal(map.gateways, 1); assert.match(map.label ?? '', /inclusive fork/);
  assert.equal(map.instances.length, 1); assert.match(map.instances[0] ?? '', /^× (3|per case \(lines\))/); assert.equal(map.clocks, 2);
  assert.ok(map.escalated.length >= 1 && map.escalated.every(f => f === 'rgb(255, 138, 92)'), 'escalated tokens use their own marker colour');
  await page.locator('[data-step="inspect"]').click(); const inspectPill = await page.locator('#map svg .pm-instances').textContent(); assert.match(inspectPill ?? '', /^× (3|per case \(lines\)) · \d+ started · \d+ done$/); assert.match(await page.locator('#map svg g[role=button]').getAttribute('aria-label') ?? '', /instances parallel, \d+ items started, \d+ finished/);
  await page.locator('[data-step="approve"]').click(); assert.match(await page.locator('#map svg .pm-deadline-badge').textContent() ?? '', /\d+ escalated · 0 interrupted/); assert.match(await page.locator('#map svg .pm-deadline-due').textContent() ?? '', /deadline at minute \d+/);
  // The data view reads the same facts.
  await showIo(); await page.locator('[data-step="approve"]').click(); await page.locator('#process-case').selectOption(live.tokens.find(t => t.stepId === 'approve' && t.deadlineAt !== undefined)!.caseId); assert.match(await page.locator('#process-data').innerText(), /After 20 min of work the deadline escalates/); assert.match(await page.locator('#process-data').innerText(), /deadline at minute \d+/); await page.locator('[data-step="inspect"]').click(); assert.match(await page.locator('#process-data').innerText(), /3 instances/);
  // Route views follow the normal flow however the deadline flow is listed.
  const routes = await page.evaluate(({early, late}) => {
   const w = globalThis as unknown as {LWProcessSipoc: LWProcessSipoc.Api; LWProcessJourney: LWProcessJourney.Api; LWProcessStudio: {query(): {snapshot: LWProcess.Snapshot; definition: LWProcess.Definition}}};
   const snapshot = w.LWProcessStudio.query().snapshot, journey = (definition: LWProcess.Definition) => {
    const host = document.createElement('div'); document.body.append(host); const surface = w.LWProcessJourney.create(host, () => {});
    try { surface.draw({definition, snapshot, selected: null} as unknown as LWProcessApp.View); return [...host.querySelectorAll('.jm-card')].map(c => [c.textContent, c.classList.contains('branch')]); } finally {surface.dispose(); host.remove();}
   };
   return {sipoc: [w.LWProcessSipoc.model(early, snapshot).stages, w.LWProcessSipoc.model(late, snapshot).stages], journey: [journey(early), journey(late)]};
  }, {early: claimsDesk(true, true) as unknown as LWProcess.Definition, late: claimsDesk(true, false) as unknown as LWProcess.Definition});
  assert.deepEqual(routes.sipoc[0], routes.sipoc[1], 'SIPOC stages do not depend on where the deadline flow is listed'); assert.ok(routes.sipoc[0]!.some(s => s.stepIds.includes('approve') && s.stepIds.includes('notify')), 'the escalation path joins the stage of its step');
  assert.deepEqual(routes.journey[0], routes.journey[1], 'journey main route does not depend on where the deadline flow is listed'); assert.ok(routes.journey[0]!.some(c => /Notify the manager/.test(String(c[0])) && c[1] === true), 'the deadline path is a branch, never the main route');
  // 3D: gateway marker, deadline arrow colours, item and deadline counters in the room caption and escalated markers.
  await page.locator('#overview').click(); await page.locator('#mode-3d').click(); await nextFrames(page);
  const room = await page.evaluate(() => {
   const w = globalThis as any, T = w.THREE, view = w.LWProcessStudio.query(), canvas = document.createElement('canvas'); canvas.style.cssText = 'width:400px;height:300px'; document.body.append(canvas);
   let captured: any; const Original = T.WebGLRenderer;
   T.WebGLRenderer = class extends Original {constructor(options: any) {super(options); const render = this.render; this.render = (scene: any, camera: any) => {captured = scene; return render.call(this, scene, camera);};}};
   const surface = w.LWProcess3D.create(canvas, view.definition, () => {});
   try {
    surface.draw(view, .01); const arrows: any[] = [], captions: string[] = [], markers: any[] = []; let glyphs = 0;
    captured.traverse((o: any) => {if (o.userData.flow !== undefined) arrows.push([o.userData.flow, o.userData.deadline, o.userData.color]); if (o.userData.caption) captions.push(o.userData.caption); if (o.userData.glyph === 'inclusive-fork') glyphs++; if (o.userData.escalated) markers.push(o.material.color.getHexString());});
    return {arrows: arrows.filter(a => a[1]), glyphs, captions, markers};
   } finally {surface.dispose(); canvas.remove(); T.WebGLRenderer = Original;}
  });
  assert.deepEqual(room.arrows.map(a => a[0]).sort(), ['approve-late', 'intake-late']); assert.deepEqual(room.arrows.map(a => a[2]).sort(), ['#e07a7a', '#e6b04a']); assert.equal(room.glyphs, 1);
  assert.ok(room.captions.some(c => /items \d+ started · \d+ done/.test(c) && /× per case \(lines\)/.test(c)), room.captions.join('\n')); assert.ok(room.captions.some(c => /\d+ escalated · 0 interrupted/.test(c) && /deadline 20 min escalate/.test(c))); assert.ok(room.markers.length >= 1 && room.markers.every(m => m === 'ff8a5c'), 'escalated markers have their own colour');
 });
 await check('Inspector describes multiple instances, deadlines and inclusive forks with their live counters without ticking', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await importClaims(true, true); await page.locator('#mode-2d').click();
  for (let i = 0; i < 2; i++) await page.locator('#advance').click();
  const before = (await query(page)).snapshot, metric = (id: string) => before.steps.find(s => s.id === id)!, text = () => page.locator('#inspector').innerText();
  const items = metric('inspect').items!, fired = metric('approve').deadlines!; assert.ok(items.started >= 3 && fired.escalated >= 1, 'the seeded run has started items and an escalation');
  // Multiple instances: the editor's sentence, cumulative item counters, the visits running now and items in the waiting row.
  await page.locator('[data-step="inspect"]').click(); let detail = await text();
  assert.match(detail, /Multiple instances/); assert.match(detail, /Runs one instance for each unit counted in case field "lines" \(1 to 50\) in parallel/);
  assert.match(detail, new RegExp(`Items started\\s+${items.started}\\b`)); assert.match(detail, new RegExp(`Items finished\\s+${items.finished}\\b`)); assert.match(detail, /Visits in progress\s+\d+/); assert.match(detail, /Items working \/ waiting\s+\d+ \/ \d+/);
  if (before.receipts.some(r => r.stepId === 'inspect')) assert.match(detail, /Latest completed visit\s+3 items/);
  assert.doesNotMatch(detail, /Deadline|Branching/);
  // Deadline: the sentence, the deadline path, both firing counters as in the 2D badge, the next pending minute and the marked next-step button.
  await page.locator('[data-step="approve"]').click(); detail = await text();
  assert.match(detail, /After 20 min of work the deadline escalates: the work keeps going and the deadline path starts beside it\./); assert.match(detail, /Deadline path to\s+Notify the manager/);
  assert.match(detail, new RegExp(`Escalated\\s+${fired.escalated}\\b`)); assert.match(detail, /Interrupted\s+0\b/); assert.doesNotMatch(detail, /Multiple instances|Items started/);
  const pending = before.tokens.filter(t => t.stepId === 'approve' && t.deadlineAt !== undefined).map(t => t.deadlineAt!);
  if (pending.length) assert.match(detail, new RegExp(`Next deadline\\s+Minute ${Math.min(...pending)}`)); else assert.doesNotMatch(detail, /Next deadline/);
  assert.deepEqual(await page.locator('.next-step').allInnerTexts(), ['Notify the manager\nDeadline path (escalates: the work keeps going)', 'Paid out']);
  await page.locator('[data-step="intake"]').click(); assert.match(await text(), /After 11 min of work the deadline interrupts: the work is cancelled and the case takes the deadline path\./);
  assert.match(await text(), /Deadline path to\s+Timed out/); assert.ok((await page.locator('.next-step').allInnerTexts()).includes('Timed out\nDeadline path (interrupts: the work is cancelled)'));
  // Inclusive fork: the sentence, its join and each branch's own condition; the branch without one is the default.
  await page.locator('[data-step="route"]').click(); detail = await text();
  assert.match(detail, /Branching/); assert.match(detail, /Inclusive fork: starts every branch whose condition is true/); assert.match(detail, /Joins at\s+Merge checks/);
  assert.deepEqual(await page.locator('.next-step').allInnerTexts(), ['Check insurance\nIf insured = true', 'Check gift wrap\nIf gift = true and not insured = true', 'Merge checks\nDefault branch: taken only when no condition is true']);
  // Steps without these features show nothing extra.
  for (const id of ['notify', 'merge', 'done']) { await page.locator(`[data-step="${id}"]`).click(); assert.doesNotMatch(await text(), /Multiple instances|Deadline|Branching|Items started|Escalated\s+\d/); }
  assert.deepEqual((await query(page)).snapshot, before, 'reading the inspector never ticks or mutates the run');
 });
 await check('Overview summarises instances, deadlines and inclusive forks only when the process has them', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await importClaims(true, true);
  for (let i = 0; i < 2; i++) await page.locator('#advance').click();
  const q = (await query(page)).snapshot, m = (id: string) => q.steps.find(s => s.id === id)!; await page.locator('#overview').click();
  const overview = await page.locator('#inspector').innerText(), esc = m('approve').deadlines!.escalated + m('intake').deadlines!.escalated, int = m('approve').deadlines!.interrupted + m('intake').deadlines!.interrupted;
  assert.match(overview, /Instances, deadlines and forks/); assert.match(overview, new RegExp(`Multiple instances\\s+1 step · ${m('inspect').items!.started} items started · ${m('inspect').items!.finished} finished`));
  assert.match(overview, new RegExp(`Deadlines\\s+2 steps · ${esc} escalated · ${int} interrupted`)); assert.match(overview, /Inclusive forks\s+1 fork/);
  assert.equal(await page.locator('#inspector dl.process-tracked dt').count(), 3, 'the summary uses the stacked label/value list');
  // The plain claims desk keeps one deadline and no instances or inclusive fork; the agency process has none of them.
  await importClaims(false); let plain = await page.locator('#inspector').innerText(); assert.match(plain, /Deadlines\s+1 step · 0 escalated · 0 interrupted/); assert.doesNotMatch(plain, /Multiple instances|Inclusive forks/);
  await freshStudio(); plain = await page.locator('#inspector').innerText(); assert.doesNotMatch(plain, /Instances, deadlines and forks/);
 });
 await check('Inspector escapes definition text in branching, instance and deadline sections', async () => {
  const hostile = '<img src=x onerror="window.__pwned=1">', def = claimsDesk(true, true) as any;
  def.steps.find((s: any) => s.id === 'notify').name = hostile; def.steps.find((s: any) => s.id === 'merge').name = hostile + ' join';
  await freshStudio(); await importJson('claims-hostile.json', def);
  await page.locator('[data-step="approve"]').click(); assert.match(await page.locator('#inspector').innerText(), /Deadline path to\s+<img src=x/);
  await page.locator('[data-step="route"]').click(); assert.match(await page.locator('#inspector').innerText(), /Joins at\s+<img src=x/);
  assert.equal(await page.locator('#inspector img').count(), 0); assert.equal(await page.evaluate(() => (globalThis as any).__pwned), undefined);
 });
 // Renderer lifecycle and on-demand drawing (3D performance): one renderer for the page, scenes freed on rebuild, frames only when something changes.
 await check('3D keeps one WebGL renderer and canvas across process switches, frees each scene, '
  + 'and redraws on demand at most 30 times a second while playing', async () => {
  await freshStudio(); await page.locator('#mode-3d').click(); await nextFrames(page);
  type Live = {renderers: number; geometries: number; textures: number; programs: number; same: boolean};
  await page.evaluate(() => { (globalThis as any).__canvas3d = document.getElementById('canvas'); });
  const facts = () => page.evaluate(() => {
   const w = globalThis as any; return {...w.LWProcess3D.live(), same: document.getElementById('canvas') === w.__canvas3d} as Live;
  });
  const first = await facts(); assert.equal(first.renderers, 1);
  assert(first.same && first.geometries > 0 && first.textures > 0 && first.programs > 0, JSON.stringify(first));
  // Every switch rebuilds the scene on the same renderer; back on the first process the GPU holds exactly what it held before.
  for (let round = 0; round < 3; round++) {
   for (let i = 1; i < COUNT; i++) { await switchTo(i); await nextFrames(page); assert.equal((await facts()).renderers, 1, 'process ' + i); }
   await switchTo(0); await nextFrames(page); assert.deepEqual(await facts(), first, 'round ' + round);
  }
  // A probe surface on its own canvas counts frames for fixed 10 ms draws; reduced motion is switched between its calls.
  const probe = (run: string) => page.evaluate(r => (globalThis as any).__probe[r](), run);
  await page.evaluate(() => {
   const w = globalThis as any, T = w.THREE, view = w.LWProcessStudio.query(), before = w.LWProcess3D.live().renderers;
   const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:400px;height:300px'; document.body.append(canvas);
   let renders = 0, type = -1; const Original = T.WebGLRenderer;
   T.WebGLRenderer = class extends Original {
    constructor(options: any) {
     super(options); const render = this.render;
     this.render = (s: any, c: any) => {renders++; type = this.shadowMap.type; return render.call(this, s, c);};
    }
   };
   const surface = w.LWProcess3D.create(canvas, view.definition, () => {}), during = w.LWProcess3D.live().renderers; T.WebGLRenderer = Original;
   const count = (v: any) => { const start = renders; for (let i = 0; i < 40; i++) surface.draw(v, .01); return renders - start; };
   w.__probe = {
    // 40 frames of 10 ms while playing: the snapshot frame, then one frame per 40 ms of animation (rooms move their props while the run plays).
    first: () => {
     const paused = count({...view, playing: false}), playing = count({...view, playing: true});
     return {paused, playing, shadow: type === T.PCFShadowMap, renderers: [before, during]};
    },
    // With reduced motion nothing animates, so a playing run draws only its new snapshot.
    reduced: () => count({...view, playing: true}),
    dispose: () => { surface.dispose(); canvas.remove(); delete w.__probe; },
   };
  });
  try {
   assert.deepEqual(await probe('first'), {paused: 1, playing: 10, shadow: true, renderers: [1, 2]});
   await page.emulateMedia({reducedMotion: 'reduce'}); assert.equal(await probe('reduced'), 1);
  } finally { await page.emulateMedia({reducedMotion: 'no-preference'}); await probe('dispose'); }
  assert.equal((await facts()).renderers, 1, 'a surface on its own canvas releases its renderer');
 });
 await check('2D card borders, work markers and the legend share one shape-coded state encoding, and zoomed-out cards count waiting work', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await freshStudio(); await page.locator('#mode-2d').click();
  for (let i = 0; i < 2; i++) await page.locator('#advance').click();
  const q = (await query(page)).snapshot, f = await encoding(page);
  assert.deepEqual(Object.keys(STATE).map(s => f.key[s]?.label), Object.values(STATE));
  assert.equal(new Set(Object.keys(STATE).map(s => f.key[s]!.d)).size, 5, 'each state has its own shape');
  assert.deepEqual([f.key.conditional?.label, f.key.deadline?.label], ['Conditional path', 'Deadline path']);
  assert(f.hint && f.cards.every(c => !/^\d+$/.test(c.title!)), 'the default framing shows names with details folded away');
  const busy = f.cards.filter(c => c.status !== 'idle');
  assert(busy.some(c => c.status === 'active') && busy.some(c => c.status === 'queued'), JSON.stringify(busy.map(c => c.status)));
  for (const c of busy) assert.equal(c.stroke, f.key[c.status]!.paint, `${c.id} border is the legend ${c.status} colour`);
  for (const c of f.cards) for (const m of c.marks) {
   assert.deepEqual([m.d, m.paint], [f.key[m.status]!.d, f.key[m.status]!.paint], `${c.id} marker matches the legend ${m.status} sample`);
   assert(m.px >= 7.9, `${c.id} marker is ${m.px}px`); assert.equal(m.onTitle, false, `${c.id} marker covers its title`);
  }
  // Every card with waiting work shows that count at the default framing, as readable text.
  const waiting = q.steps.filter(m => waitingAt(q, m.id) > 0); assert(waiting.length > 0);
  for (const m of waiting) {
   const chip = f.cards.find(c => c.id === m.id)!.counts.find(c => c.status === 'queued');
   assert.equal(chip?.text, String(waitingAt(q, m.id)), `${m.id} counts its waiting work`); assert(chip!.px >= 9, `${m.id} count is ${chip!.px}px`);
  }
  const sample = f.key.conditional!, dashed = f.conditional.every(e => e.dash === sample.dash && e.stroke === sample.stroke && e.dash !== 'none');
  assert(f.conditional.length > 0 && dashed, 'conditional paths are dashed like their legend sample');
  // Blocked work: a full backlog downstream holds finished work, which the card shows with the Blocked border, cross markers and words.
  await applyDraft(blockedLine); await page.locator('#mode-2d').click();
  for (let i = 0; i < 20 && !(await query(page)).snapshot.tokens.some(t => t.status === 'held'); i++) await page.locator('#step').click();
  const held = (await query(page)).snapshot.tokens.filter(t => t.status === 'held' && t.stepId === 'make').length; assert(held > 0, 'work is held');
  const blocked = await encoding(page), g = blocked.cards.find(c => c.id === 'make')!;
  // Held work is blocked, not waiting: the waiting count leaves it out (queued - held) and the blocked count follows it.
  const make = (await query(page)).snapshot.steps.find(s => s.id === 'make')!;
  assert.deepEqual([g.status, g.stroke], ['held', blocked.key.held!.paint]);
  assert.match(g.label, new RegExp(`, ${make.queued - held} waiting, ${held} blocked`));
  assert(g.marks.some(m => m.status === 'held' && m.d === f.key.held!.d), 'held work uses the cross marker');
  assert.equal(g.marks.filter(m => m.status === 'held').length, held, 'one blocked marker per held item');
  // Zoomed out, the counts row shows held work as its own blocked count.
  for (let i = 0; i < 12 && !(await page.locator('#process-map-make .pm-count').count()); i++) await page.locator('button[aria-label="Zoom out"]').click();
  const rows = (await encoding(page)).cards.find(c => c.id === 'make')!.counts.filter(c => c.status === 'held' || c.status === 'queued')
   .map(c => [c.status, c.text]);
  assert.deepEqual(rows, [['held', String(held)], ...make.queued > held ? [['queued', String(make.queued - held)]] : []], 'held work is a blocked count');
  await page.locator('#process-map-make').focus();
  const waits = `${make.queued - held} waiting · ${held} blocked`;
  assert.match(await page.locator('#map-caption').innerText(), new RegExp(`^Make the part · task · \\d+ working · ${waits}`));
 });
 await check('Present frames a step slide with its direct neighbours and keeps the card-number key beside a numbered map', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await freshStudio();
  const d = (await query(page)).definition, near = new Set(['design-ready']);
  for (const f of d.flows) { if (f.from === 'design-ready') near.add(f.to); if (f.to === 'design-ready') near.add(f.from); }
  await page.locator('#mode-2d').click(); await page.locator('#steps [data-step="design-ready"]').click();
  assert.equal(await page.locator('#map svg g[role=button]').count(), 1, 'the studio keeps its single-step scene');
  await page.locator('#mode-present').click(); await page.locator('#present[open]').waitFor();
  const framed = await page.evaluate(() => {
   const stage = document.getElementById('present-stage')!.getBoundingClientRect();
   return [...document.querySelectorAll<SVGGElement>('#present-stage g[role=button]')].map(g => {
    const r = g.querySelector('.pm-card')!.getBoundingClientRect();
    const inside = r.left >= stage.left - 1 && r.right <= stage.right + 1 && r.top >= stage.top - 1 && r.bottom <= stage.bottom + 1;
    return {id: g.id.slice('process-map-'.length), inside, current: g.getAttribute('aria-current')};
   });
  });
  assert.deepEqual(framed.map(f => f.id).sort(), [...near].sort(), 'the step slide shows the step and its direct neighbours');
  assert(framed.every(f => f.inside), JSON.stringify(framed)); assert.deepEqual(framed.filter(f => f.current === 'true').map(f => f.id), ['design-ready']);
  await page.locator('#present-stage #process-map-implementation').click();
  assert.equal((await query(page)).presenting!.id, 'step-implementation', 'a neighbour opens its own slide');
  await page.keyboard.press('Escape'); await page.locator('#present').waitFor({state: 'hidden'});
  assert.equal(await page.locator('#map svg g[role=button]').count(), 1, 'after Present the studio shows its single-step scene again');
  // A numbered whole-process map keeps its key inside the map that moved into Present.
  await switchTo(4); await page.locator('#mode-2d').click(); await page.locator('#overview').click();
  await page.locator('#mode-present').click(); await page.locator('#present[open]').waitFor();
  const key = await page.evaluate(() => {
   const k = document.querySelector<HTMLElement>('#present-stage .process-map-key')!;
   return {visible: !k.hidden && k.getClientRects().length > 0, text: k.textContent, first: document.querySelector('#present-stage .pm-title')!.textContent};
  });
  assert.deepEqual(key, {visible: true, text: 'Card numbers match the step list', first: '01'});
  await page.keyboard.press('Escape'); await page.locator('#present').waitFor({state: 'hidden'});
 });
 await mapUpdateChecks(studio);
 await checkLifecycle('Process renderers browser lifecycle emits no runtime errors or network requests');
});
