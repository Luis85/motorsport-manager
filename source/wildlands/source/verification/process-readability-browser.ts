/// <reference path="../process-contracts.d.ts" />
/** Process Studio readability: large 2D maps, small map cues, instance wording, 3D captions, phone lenses and menus, short-window dialogs and plain-language step names, each layout also in the wider DejaVu Sans fallback font. */
import assert from 'node:assert/strict';
import {nextFrames} from './browser-harness';
import {query, runSuite} from './process-browser-fixture';
import {claimsDesk} from './process-browser-models';
import {mapLabelChecks} from './process-map-label-checks';
runSuite('process readability browser harness', 'process-readability-browser-results.json', async studio => {
 const {page, check, checkLifecycle, freshStudio, switchTo, importJson, importClaims, activeId, dialogOpen} = studio;
 const DEJAVU = '*{font-family:"DejaVu Sans",sans-serif !important}';
 const withFonts = async (work: (dejavu: boolean) => Promise<void>) => { for (const dejavu of [false, true]) { await freshStudio(); if (dejavu) await page.addStyleTag({content: DEJAVU}); await page.evaluate(() => document.fonts.ready); await work(dejavu); } };
 /** Screen facts of the 2D map: title size, overlaps between titles, titles leaving their card, and the numbers shown. */
 const mapFacts = () => page.evaluate(() => {
  const svg = document.querySelector('#map svg') as SVGSVGElement, a = svg.getScreenCTM()!.a, box = (e: Element) => e.getBoundingClientRect();
  const cards = [...svg.querySelectorAll<SVGGElement>('g[role=button]')], titles = cards.map(g => g.querySelector('.pm-title')!);
  const hit = (p: DOMRect, q: DOMRect) => p.left < q.right - .5 && q.left < p.right - .5 && p.top < q.bottom - .5 && q.top < p.bottom - .5;
  let overlaps = 0; titles.forEach((t, i) => titles.slice(i + 1).forEach(u => { if (hit(box(t), box(u))) overlaps++; }));
  const spill = cards.filter(g => { const t = box(g.querySelector('.pm-title')!), c = box(g.querySelector('rect.pm-card')!); return t.left < c.left - 1 || t.right > c.right + 1 || t.top < c.top - 1 || t.bottom > c.bottom + 1; }).map(g => g.id);
  const order = [...document.querySelectorAll('#steps .process-order')].map(n => n.textContent);
  return {px: Math.min(...titles.map(t => parseFloat(t.getAttribute('font-size')!) * a)), overlaps, spill, shown: titles.map(t => t.textContent), order, tips: cards.map(g => g.querySelector(':scope > title')!.textContent),
   names: (globalThis as any).LWProcessStudio.query().definition.steps.map((s: any) => s.name), hint: (document.getElementById('map-zoom-hint') as HTMLElement).hidden ? '' : document.getElementById('map-zoom-hint')!.textContent};
 });
 await check('2D maps with 20 or more steps stay legible on desktop and phone: numbered cards, no overlapping or spilling titles', async () => {
  for (const [width, height] of [[1440, 1060], [390, 844]] as const) {
   await page.setViewportSize({width, height});
   await withFonts(async dejavu => {
    await switchTo(4); await page.locator('#mode-2d').click(); await page.locator('#frame').click(); await nextFrames(page, 3);
    const f = await mapFacts(), at = `${width}x${height}${dejavu ? ' DejaVu' : ''}`;
    assert(f.names.length >= 30, 'the onboarding journey has 30+ steps');
    assert(f.px >= 10.9, `titles are ${f.px}px at ${at}`); assert.equal(f.overlaps, 0, 'no two titles overlap at ' + at); assert.deepEqual(f.spill, [], 'titles stay inside their cards at ' + at);
    assert.deepEqual(f.shown, f.order, 'zoomed out, cards show the two-digit number of the step list at ' + at); assert(f.tips.every((t, i) => t!.startsWith(f.names[i])), 'the full name stays in each card tooltip');
    assert.equal(f.hint, 'Zoom in for names');
    assert.equal(await page.locator('#map .process-map-key').innerText(), 'Card numbers match the step list', 'the key sits in the map dock');
    const label = await page.locator('#map svg g[role=button]').first().getAttribute('aria-label'); assert(label!.startsWith(f.names[0]), 'the accessible name keeps the step name');
    // Zooming in brings the names back, still at least 11px and without overlaps.
    for (let i = 0; i < 8 && (await mapFacts()).shown[0] === '01'; i++) await page.locator('button[aria-label="Zoom in"]').click();
    const zoomed = await mapFacts(); assert(zoomed.px >= 10.9 && zoomed.overlaps === 0 && zoomed.shown[0] !== '01', JSON.stringify(zoomed.shown.slice(0, 3)));
   });
  }
  await page.setViewportSize({width: 1440, height: 1060});
 });
 /** Each card's step name and its shown title lines; `cut` when the title breaks off inside a word (a hyphen break joins up again). */
 const labels = () => page.evaluate(() => {
  const names: string[] = (globalThis as any).LWProcessStudio.query().definition.steps.map((s: any) => s.name);
  return [...document.querySelectorAll('#map svg g[role=button]')].map((g, i) => {
   const lines = [...g.querySelectorAll('.pm-title tspan')].map(t => t.textContent!);
   const shown = lines.reduce((a, l) => a.endsWith('-') ? a.slice(0, -1) + l : a ? a + ' ' + l : l, '');
   const name = names[i]!, kept = shown.replace(/…$/, ''), whole = kept === name || shown.endsWith('…') && name.startsWith(kept) && name[kept.length] === ' ';
   return {name, shown, numbered: /^\d+$/.test(shown), complete: kept === name, cut: !whole};
  });
 });
 await check('2D map titles break only between words or at a hyphen, and the hovered or focused card shows its full name and counts', async () => {
  for (const [width, height] of [[1440, 1060], [1366, 768], [390, 844]] as const) {
   await page.setViewportSize({width, height});
   await withFonts(async dejavu => {
    const at = `${width}x${height}${dejavu ? ' DejaVu' : ''}`;
    await switchTo(6); await page.locator('#mode-2d').click(); await page.locator('#frame').click(); await nextFrames(page, 2);
    // Where the fitted map shows numbers, the hint button zooms to the first level with names.
    if ((await labels())[0]!.numbered) {
     assert.equal(await page.locator('#map-zoom-hint').innerText(), 'Zoom in for names'); await page.locator('#map-zoom-hint').click();
    }
    const shown = await labels(), f = await mapFacts();
    assert(shown.every(l => !l.numbered), 'names are shown at ' + at);
    assert.deepEqual(shown.filter(l => l.cut).map(l => l.shown), [], 'no title is cut inside a word at ' + at);
    assert.equal(f.overlaps, 0, 'no two titles overlap at ' + at); assert.deepEqual(f.spill, [], 'titles stay inside their cards at ' + at);
    const partial = shown.filter(l => !l.complete).map(l => l.shown);
    if (width === 1440) assert(shown.length - partial.length >= 15, `three-line titles show most names whole at ${at}: ${partial.join(' / ')}`);
   });
  }
  // The caption names the hovered card, else the focused one, with its counts; it never resizes the map.
  await page.setViewportSize({width: 1440, height: 1060}); await freshStudio(); await switchTo(6); await page.locator('#mode-2d').click();
  const caption = page.locator('#map-caption'), viewport = async () => (await page.locator('#viewport').boundingBox())!.height, before = await viewport();
  assert.equal(await caption.innerText(), 'Hover over or focus a card to read its full name and work counts.');
  await page.locator('#process-map-inception').focus();
  const full = await caption.evaluate(c => ({text: c.textContent, clipped: c.scrollWidth > c.clientWidth + 1}));
  assert.match(full.text!, /^Inception: vision, MVP scope and first backlog · task · 1 working · 0 waiting$/); assert.equal(full.clipped, false);
  const box = (await page.locator('#process-map-retro .pm-card').boundingBox())!; await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  assert.match(await caption.innerText(), /^Weekly retrospective · task · 0 working · 0 waiting$/, 'hover names the card under the pointer');
  await page.mouse.move(5, 5);
  const back = await page.waitForFunction(() => /^Inception: vision/.test(document.getElementById('map-caption')!.textContent!)).then(() => '', async () => {
   return `${await caption.innerText()} (focus on ${await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName)})`;
  });
  assert.equal(back, '', 'leaving the map returns to the focused card');
  assert.equal(await viewport(), before, 'the caption never resizes the map');
 });
 await check('Map zoom controls never cover a fitted card, Zoom in reaches names, and map text follows the root font size', async () => {
  for (const [width, height] of [[390, 844], [320, 640], [1366, 768]] as const) {
   await page.setViewportSize({width, height});
   for (const index of [0, 6]) {
    await freshStudio(); await switchTo(index); await page.locator('#mode-2d').click(); await page.locator('#frame').click(); await nextFrames(page, 2);
    const covered = await page.evaluate(() => {
     const d = document.querySelector('#map .process-map-dock')!.getBoundingClientRect();
     const under = (g: Element) => {
      const r = g.querySelector('.pm-card')!.getBoundingClientRect(); return r.left < d.right && d.left < r.right && r.top < d.bottom && d.top < r.bottom;
     };
     return [...document.querySelectorAll('#map svg [id^="process-map-"]')].filter(under).map(g => g.id);
    });
    assert.deepEqual(covered, [], `the map dock covers no card of process ${index + 1} at ${width}x${height}`);
   }
  }
  // A numbered map: its key sits in the map dock, and Zoom in for names zooms just far enough for names.
  await page.setViewportSize({width: 1440, height: 1060}); await freshStudio(); await switchTo(4);
  await page.locator('#mode-2d').click(); await page.locator('#frame').click(); assert.equal((await labels())[0]!.numbered, true);
  assert.equal(await page.locator('#map .process-map-key').innerText(), 'Card numbers match the step list');
  await page.locator('#map-zoom-hint').click(); assert.equal((await labels()).some(l => l.numbered), false, 'Zoom in for names shows names');
  assert.equal(await page.locator('#map .process-map-key').isHidden(), true, 'the key goes with the numbers');
  // A 24px root font (a larger browser text size) scales the map's minimum text and marker sizes with it.
  await freshStudio(); await page.addStyleTag({content: 'html{font-size:24px}'});
  await page.locator('#mode-2d').click(); await page.locator('#advance').click(); await page.locator('#frame').click(); await nextFrames(page, 2);
  // The larger text leaves the fitted map in its numbers layout; Zoom in for names reaches the layout that draws work markers.
  if (await page.locator('#map-zoom-hint').innerText() === 'Zoom in for names') { await page.locator('#map-zoom-hint').click(); await nextFrames(page, 2); }
  const big = await page.evaluate(() => {
   const svg = document.querySelector('#map svg') as SVGSVGElement, a = (e: Element) => (e as SVGGraphicsElement).getScreenCTM()!.a;
   const title = Math.min(...[...svg.querySelectorAll('.pm-title')].map(t => parseFloat(t.getAttribute('font-size')!) * svg.getScreenCTM()!.a));
   return {title, marks: [...svg.querySelectorAll('.pm-mark')].map(a)};
  });
  assert(big.title >= 16.4, `titles are ${big.title}px with a 24px root font`);
  assert(big.marks.length > 0 && big.marks.every(px => px >= 11.9), `markers are ${big.marks.join(', ')}px`);
 });
 await check('2D deadline tags, pills and the inclusive-fork marker hide unreadable text but keep a 12px cue with their wording', async () => {
  await page.setViewportSize({width: 1440, height: 1060});
  for (const dejavu of [false, true]) {
   await importClaims(true); if (dejavu) await page.addStyleTag({content: DEJAVU}); await page.locator('#mode-2d').click(); await page.locator('#advance').click(); await nextFrames(page, 3);
   const cues = await page.evaluate(() => {
    const svg = document.querySelector('#map svg') as SVGSVGElement, a = svg.getScreenCTM()!.a, shown = (t: Element) => getComputedStyle(t).display !== 'none';
    return [...svg.querySelectorAll('.pm-deadline-tag, .pm-pill, .pm-gateway')].map(g => ({cls: g.getAttribute('class'), h: g.getBoundingClientRect().height, tip: g.querySelector('title')?.textContent ?? '',
     text: [...g.querySelectorAll('text')].filter(shown).map(t => parseFloat(t.getAttribute('font-size')!) * a)}));
   });
   assert(cues.filter(c => /pm-deadline-tag/.test(c.cls!)).length === 2 && cues.filter(c => /pm-pill/.test(c.cls!)).length === 3 && cues.some(c => /pm-gateway/.test(c.cls!)), JSON.stringify(cues));
   for (const c of cues) {
    assert(c.h >= 11.5, `${c.cls} is ${c.h}px tall`); assert(c.text.every(px => px >= 9), `${c.cls} paints text below 9px: ${c.text}`);
    assert(/Deadline|instance|Inclusive/i.test(c.tip), `${c.cls} keeps its wording in a tooltip: ${c.tip}`);
   }
  }
 });
 await check('Instance pills and 3D captions read "× per case (field)" until items are live, then "× n"', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await importClaims(true); await page.locator('#mode-2d').click(); await page.locator('[data-step="inspect"]').click();
  assert.match(await page.locator('#map svg .pm-instances').textContent() ?? '', /^× per case \(lines\)/);
  // Step until the inspect step holds live items (3 lines per case), then the pill shows the live count.
  let live = false; for (let i = 0; i < 90 && !live; i++) { await page.locator('#step').click(); live = (await query(page)).snapshot.tokens.some(t => t.stepId === 'inspect' && t.items === 3); }
  assert(live, 'the run reaches live items'); assert.match(await page.locator('#map svg .pm-instances').textContent() ?? '', /^× 3 · \d+ started · \d+ done$/);
  assert.doesNotMatch(await page.locator('#map svg g[role=button]').getAttribute('aria-label') ?? '', /x lines/);
  const captions = await page.evaluate(() => {
   const w = globalThis as any, T = w.THREE, view = w.LWProcessStudio.query(), canvas = document.createElement('canvas'); canvas.style.cssText = 'width:400px;height:300px'; document.body.append(canvas);
   let captured: any; const Original = T.WebGLRenderer;
   T.WebGLRenderer = class extends Original {constructor(options: any) {super(options); const render = this.render; this.render = (scene: any, camera: any) => {captured = scene; return render.call(this, scene, camera);};}};
   const surface = w.LWProcess3D.create(canvas, view.definition, () => {});
   try { surface.draw(view, .01); const out: string[] = []; captured.traverse((o: any) => { if (o.userData.caption) out.push(o.userData.caption); }); return out; } finally {surface.dispose(); canvas.remove(); T.WebGLRenderer = Original;}
  });
  const inspect = captions.find(c => /per case \(lines\)/.test(c)) ?? ''; assert.match(inspect, /× 3 now · items \d+ started · \d+ done/); assert(!captions.some(c => /x lines/.test(c)), captions.join('\n'));
 });
 await check('3D front captions hang below the room and stay readable on a phone', async () => {
  await page.setViewportSize({width: 390, height: 844}); await importClaims(true); await page.locator('#mode-3d').click(); await page.locator('[data-step="inspect"]').click(); await nextFrames(page, 4);
  const caption = await page.evaluate(() => {
   const w = globalThis as any, T = w.THREE, canvas = document.getElementById('canvas') as HTMLCanvasElement, view = w.LWProcessStudio.query();
   let captured: any, camera: any; const Original = T.WebGLRenderer;
   T.WebGLRenderer = class extends Original {constructor(options: any) {super(options); const render = this.render; this.render = (s: any, c: any) => {captured = s; camera = c; return render.call(this, s, c);};}};
   const probe = document.createElement('canvas'); probe.style.cssText = `width:${canvas.clientWidth}px;height:${canvas.clientHeight}px`; document.body.append(probe);
   const surface = w.LWProcess3D.create(probe, view.definition, () => {});
   try {
    surface.draw(view, .01); let sprite: any; captured.traverse((o: any) => { if (o.userData.caption && o.parent.visible) sprite = o; });
    const top = sprite.getWorldPosition(new T.Vector3()), size = new T.Vector3(); sprite.getWorldScale(size); const bottom = top.clone().addScaledVector(new T.Vector3(0, 1, 0).applyQuaternion(camera.quaternion), -size.y);
    const px = (v: any) => { const p = v.clone().project(camera); return {x: (p.x + 1) / 2 * probe.clientWidth, y: (1 - p.y) / 2 * probe.clientHeight}; };
    const height = px(bottom).y - px(top).y, local = sprite.position;
    // The inspect room carries instances, so its caption font is 25 of the 128 canvas pixels.
    return {visible: sprite.visible, z: local.z, line: height / 128 * 25, inside: px(bottom).y <= probe.clientHeight + 1, scale: size.y / 1.2, w: probe.clientWidth, h: probe.clientHeight};
   } finally {surface.dispose(); probe.remove(); T.WebGLRenderer = Original;}
  });
  assert.equal(caption.visible, true); assert(caption.z > 4.7, 'the caption sits in front of the floor edge and the queue rail'); assert(caption.line >= 11.5, `caption lines are ${caption.line}px ` + JSON.stringify(caption)); assert.equal(caption.inside, true, 'the framed room keeps its caption in view ' + JSON.stringify(caption));
  await page.setViewportSize({width: 1440, height: 1060});
 });
 await check('Phone lenses grow with the page instead of scrolling inside a 45vh stage', async () => {
  await page.setViewportSize({width: 390, height: 844});
  await withFonts(async dejavu => {
   for (const index of [0, 3]) {
    await switchTo(index); await page.locator('#mode-lens').click(); await page.waitForSelector(index ? '#lens .lw-journey' : '#lens .sipoc-grid'); await nextFrames(page, 2);
    const f = await page.evaluate(() => { const l = document.getElementById('lens')!, v = document.getElementById('viewport')!, s = l.firstElementChild as HTMLElement, jm = l.querySelector('.jm-scroll') as HTMLElement | null;
     return {lens: l.scrollHeight - l.clientHeight, inner: s.scrollHeight - s.clientHeight, viewport: v.getBoundingClientRect().height, content: s.getBoundingClientRect().height, sideways: jm ? getComputedStyle(jm).overflowX : 'none', page: document.documentElement.scrollWidth > innerWidth}; });
    const at = `process ${index}${dejavu ? ' DejaVu' : ''}`;
    assert(f.lens <= 1 && f.inner <= 1, 'no vertical scroller inside the lens at ' + at + ' ' + JSON.stringify(f)); assert(f.viewport >= f.content - 1, 'the stage holds the whole lens at ' + at); assert(f.viewport > 844 * .45, 'the lens is taller than the 45vh stage at ' + at);
    assert.equal(f.page, false); if (index) assert.equal(f.sideways, 'auto', 'only the journey grid scrolls sideways');
   }
  });
  await page.setViewportSize({width: 1440, height: 1060}); await freshStudio();
  const desktop = await page.evaluate(() => getComputedStyle(document.getElementById('lens')!).position); assert.equal(desktop, 'absolute', 'desktop keeps the lens inside the stage');
 });
 await check('Phone overflow menu hint wraps above Import without overlapping it', async () => {
  for (const [width, height] of [[390, 844], [320, 640]] as const) {
   await page.setViewportSize({width, height});
   await withFonts(async () => {
    await page.locator('#more-menu').click();
    const f = await page.evaluate(() => { const hint = document.getElementById('export-hint')!, item = document.getElementById('import-item')!, h = hint.getBoundingClientRect(), i = item.getBoundingClientRect(); return {gap: i.top - h.bottom, clipped: hint.scrollHeight > hint.clientHeight + 1, clamp: getComputedStyle(hint).webkitLineClamp}; });
    assert(f.gap >= 0 && !f.clipped, JSON.stringify(f)); await page.keyboard.press('Escape');
   });
  }
  await page.setViewportSize({width: 1440, height: 1060});
 });
 /** Share of the focused control hidden under a sticky or fixed element of its dialog. */
 const obscured = () => page.evaluate(() => {
  const e = document.activeElement as HTMLElement, d = e.closest('dialog'); if (!d) return 0; const r = e.getBoundingClientRect(); if (!r.height) return 0;
  const cover = [...d.querySelectorAll<HTMLElement>('*')].filter(n => ['sticky', 'fixed'].includes(getComputedStyle(n).position) && !n.contains(e) && !e.contains(n) && n.getClientRects().length).map(n => n.getBoundingClientRect())
   .filter(s => r.top < s.bottom - 1 && r.bottom > s.top + 1 && r.left < s.right && r.right > s.left).map(s => (Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top)) / r.height);
  const view = d.getBoundingClientRect(), outside = r.bottom > view.bottom + 1 || r.top < view.top - 1;
  return Math.max(0, ...cover, outside ? 1 : 0);
 });
 await check('Dialogs become one scrolling sheet in short windows and never hide the focused field under sticky chrome', async () => {
  // 1366x768 at 200% zoom is a 683x384 CSS viewport; 1440x900 is a full desktop.
  for (const [width, height] of [[683, 384], [1440, 900]] as const) {
   await page.setViewportSize({width, height});
   await withFonts(async dejavu => {
    const at = `${width}x${height}${dejavu ? ' DejaVu' : ''}`;
    await page.locator('#open-definition').click(); await page.locator('dialog.de-dialog[open]').waitFor(); if (await page.locator('#de-tab-form').isVisible()) await page.locator('#de-tab-form').click();
    if (height < 560) {
     const sheet = await page.evaluate(() => { const d = document.querySelector('dialog.de-dialog') as HTMLElement, r = d.getBoundingClientRect(), body = d.querySelector('.pd-body') as HTMLElement; return {box: [r.x, r.y, r.width, r.height], vw: innerWidth, vh: innerHeight, own: d.scrollHeight > d.clientHeight, body: getComputedStyle(body).overflowY, head: getComputedStyle(d.querySelector('.pd-head')!).position, primary: getComputedStyle(d.querySelector('.pd-buttons .primary')!).position, primaryInView: d.querySelector('.pd-buttons .primary')!.getBoundingClientRect().bottom <= innerHeight}; });
     assert.deepEqual(sheet.box, [0, 0, sheet.vw, sheet.vh], 'full sheet at ' + at); assert.deepEqual([sheet.own, sheet.body, sheet.head, sheet.primary, sheet.primaryInView], [true, 'visible', 'static', 'sticky', true], 'the sheet scrolls as one page and only the primary action stays in view at ' + at);
    }
    await page.evaluate(() => { const f = [...document.querySelectorAll<HTMLElement>('#de-pane-form input, #de-pane-form select, #de-pane-form button')].filter(e => e.getClientRects().length && !(e as HTMLButtonElement).disabled); f.at(-1)!.focus(); });
    for (let i = 0; i < 40; i++) { await page.keyboard.press('Shift+Tab'); const share = await obscured(); assert(share <= .3, `${await activeId()} is ${Math.round(share * 100)}% hidden at ${at}`); }
    await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 0);
    // The step editor with a problem list: walking back from the footer never lands under the list.
    await page.locator('[data-step="discovery"]').click(); await page.locator('#edit-step').click(); await page.locator('dialog.pd-dialog[open]').waitFor();
    await page.locator('#se-name').fill(''); await page.locator('#se-duration').fill(''); await page.locator('#se-cancel').focus();
    for (let i = 0; i < 30; i++) { await page.keyboard.press('Shift+Tab'); const share = await obscured(); assert(share <= .3, `${await activeId()} is ${Math.round(share * 100)}% hidden at ${at}`); }
    await page.keyboard.press('Escape'); if (await page.locator('#se-discard').isVisible()) await page.locator('#se-discard').click(); assert.equal(await dialogOpen(), 0);
   });
  }
  await page.setViewportSize({width: 1440, height: 1060});
 });
 await check('Step editor explains an empty or too long step name in plain language', async () => {
  await page.setViewportSize({width: 1440, height: 1060}); await freshStudio(); await page.locator('[data-step="discovery"]').click(); await page.locator('#edit-step').click(); await page.locator('dialog.pd-dialog[open]').waitFor();
  await page.locator('#se-name').fill(''); assert.match(await page.locator('#se-status').innerText(), /Give the step a name \(1 to 120 characters\)/); assert.doesNotMatch(await page.locator('#se-status').innerText(), /invalid length or format/);
  assert.equal(await page.locator('#se-name').getAttribute('aria-invalid'), 'true');
  await page.locator('#se-name').fill('x'.repeat(121)); assert.match(await page.locator('#se-status').innerText(), /Step name must be 120 characters or fewer/);
  await page.locator('#se-name').fill('Discovery'); assert.equal(await page.locator('#se-name').getAttribute('aria-invalid'), null);
  await page.keyboard.press('Escape'); if (await page.locator('#se-discard').isVisible()) await page.locator('#se-discard').click(); assert.equal(await dialogOpen(), 0);
 });
 await mapLabelChecks(studio);
 await checkLifecycle('Process readability browser lifecycle emits no runtime errors or network requests');
});
