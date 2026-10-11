/// <reference path="../process-contracts.d.ts" />
/// <reference path="../process-palette.ts" />
/**
 * Theme checks of the views, run by `process-theme-browser.ts`: the 3D scene re-colours once on a theme change (one frame in the
 * new clear colour, nothing rebuilt, the dark caption pills of the diorama and the camera kept; counted on a probe surface on its
 * own canvas, as the 3D checks do, and seen in the studio's own canvas); the theme lasts across Present, dialogs and process switches while Present, the
 * dialogs (step editor, Definition editor, a confirmation), the SIPOC and journey lenses, the Dashboard tooltip and the legend
 * follow it; Present and the Dashboard keep their light layouts at 1440 x 1060 and 390 x 844 in the default font and in DejaVu
 * Sans (what hosted CI renders, asserted through the platform fonts); and forced colours win over either theme.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type {Page} from 'playwright';
import {nextFrames} from './browser-harness';
import {query, type Studio} from './process-browser-fixture';
import {renderedFamilies} from './process-map-probe';

/** The page's theme as LWProcessPalette reads it, the toggle's checked state, its words and the computed colour scheme. */
export const themeState = (page: Page) => page.evaluate(() => {
 const item = document.getElementById('theme-item')!;
 return {scheme: (globalThis as unknown as {LWProcessPalette: LWProcessPalette.Api}).LWProcessPalette.scheme(),
  checked: item.getAttribute('aria-checked'), words: document.getElementById('theme-state')!.textContent,
  colorScheme: [getComputedStyle(document.documentElement).colorScheme, getComputedStyle(document.body).colorScheme]};
});

/** Choose a theme through the studio menu (the ⋯ menu on a phone) and close the menu again with Escape. */
export async function setTheme(page: Page, theme: LWProcessPalette.Scheme): Promise<void> {
 const trigger = page.locator('#export-menu:visible, #more-menu:visible').first();
 await trigger.click();
 await page.locator('#theme-item').waitFor();
 if ((await themeState(page)).scheme !== theme) await page.locator('#theme-item').click();
 await page.keyboard.press('Escape');
 await page.locator('#export-popup').waitFor({state: 'hidden'});
 assert.equal((await themeState(page)).scheme, theme);
 await nextFrames(page);
}

const DEJAVU = '*{font-family:"DejaVu Sans",sans-serif !important}';
const LIGHT_BG = [243, 245, 248], DARK_BG = [19, 24, 31];
const near = (a: readonly number[], b: readonly number[]) => a.every((v, i) => Math.abs(v - b[i]!) <= 3);

/** The studio canvas's top-left pixel (the clear colour; the canvas keeps its drawing buffer). */
const corner = (page: Page) => page.evaluate(() => {
 const c = document.createElement('canvas');
 c.width = 4;
 c.height = 4;
 const ctx = c.getContext('2d')!;
 ctx.drawImage(document.getElementById('canvas') as HTMLCanvasElement, 0, 0);
 return [...ctx.getImageData(2, 2, 1, 1).data.slice(0, 3)];
});

/** A probe surface on its own canvas whose renderer counts frames and keeps the scene and camera (see the renderers suite). */
const installProbe = (page: Page) => page.evaluate(() => {
 const w = globalThis as any, T = w.THREE, view = w.LWProcessStudio.query(), Original = T.WebGLRenderer;
 const canvas = document.createElement('canvas'), out: any = {renders: 0, canvas};
 canvas.style.cssText = 'position:fixed;left:0;top:0;width:400px;height:300px';
 document.body.append(canvas);
 T.WebGLRenderer = class extends Original {
  constructor(options: any) {
   super(options);
   out.renderer = this;
   const render = this.render;
   this.render = (scene: any, camera: any) => {
    out.renders++;
    out.scene = scene;
    out.camera = camera;
    return render.call(this, scene, camera);
   };
  }
 };
 try {
  out.surface = w.LWProcess3D.create(canvas, view.definition, () => {});
 } finally {
  T.WebGLRenderer = Original;
 }
 const paused = {...view, playing: false};
 w.__theme3d = out;
 /** Frames drawn by 40 draws of 10 ms on the paused view. */
 out.frames = () => {
  const start = out.renders;
  for (let i = 0; i < 40; i++) out.surface.draw(paused, .01);
  return out.renders - start;
 };
 /** Camera pose, clear colour, every caption texture's version and the mean lightness of the caption pills' opaque pixels. */
 out.facts = () => {
  const captions: any[] = [];
  out.scene.traverse((o: any) => { if (o.isSprite && o.renderOrder === 20 && o.material.map?.image?.width) captions.push(o.material.map); });
  let sum = 0, n = 0;
  for (const map of captions.slice(0, 6)) {
   const img = map.image as HTMLCanvasElement, d = img.getContext('2d')!.getImageData(0, 0, img.width, img.height).data;
   for (let i = 0; i < d.length; i += 4) if (d[i + 3]! > 200) { sum += (d[i]! + d[i + 1]! + d[i + 2]!) / 765; n++; }
  }
  const clear = out.renderer.getClearColor(new T.Color());
  return {pose: [...out.camera.position.toArray(), ...out.camera.quaternion.toArray()].map((v: number) => v.toFixed(5)).join(),
   clear: [clear.getHex() >> 16 & 255, clear.getHex() >> 8 & 255, clear.getHex() & 255],
   versions: captions.map(m => m.version), lightness: n ? sum / n : 0, live: w.LWProcess3D.live()};
 };
});
const probe = (page: Page, run: 'frames' | 'facts' | 'restyle') => page.evaluate(r => {
 const out = (globalThis as any).__theme3d;
 return r === 'restyle' ? out.surface.restyle() : out[r]();
}, run);

/** Whether the page or the element of `selector` scrolls sideways. */
const overflow = (page: Page, selector: string) => page.evaluate(s => {
 const el = document.querySelector(s)!, root = document.documentElement;
 return {page: root.scrollWidth > root.clientWidth + 1, element: el.scrollWidth > el.clientWidth + 1};
}, selector);
const colour = (page: Page, selector: string, property: string) => page.locator(selector).first()
 .evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property);

export async function themeViewChecks(studio: Studio): Promise<void> {
 const {page, check, freshStudio, switchTo} = studio;
 await check('A theme change re-colours the 3D scene once: one frame in the new clear colour, nothing rebuilt, captions and camera kept', async () => {
  await freshStudio();
  await page.locator('#mode-3d').click();
  await nextFrames(page, 3);
  const studioLive = await page.evaluate(() => (globalThis as any).LWProcess3D.live());
  assert(near(await corner(page), DARK_BG), 'the studio clears to the dark stage');
  await installProbe(page);
  try {
   assert.equal(await probe(page, 'frames'), 1, 'a paused scene draws once');
   const dark = await probe(page, 'facts');
   assert(near(dark.clear, DARK_BG) && dark.lightness < .3 && dark.versions.length > 0, JSON.stringify(dark));
   await setTheme(page, 'light');
   assert.equal(await probe(page, 'frames'), 0, 'a theme change alone draws nothing on a surface not told to restyle');
   await probe(page, 'restyle');
   assert.equal(await probe(page, 'frames'), 1, 'restyle draws exactly one frame');
   const light = await probe(page, 'facts');
   assert.equal(light.pose, dark.pose, 'the camera stays');
   assert.deepEqual(light.live, dark.live, 'nothing is rebuilt: the same geometries, textures and caption canvases');
   assert.deepEqual(light.versions, dark.versions, 'the caption textures are not redrawn');
   assert(near(light.clear, LIGHT_BG) && light.lightness < .3, 'light clear colour, dark caption pills ' + JSON.stringify(light));
   await setTheme(page, 'dark');
   await probe(page, 'restyle');
   assert.equal(await probe(page, 'frames'), 1);
   const back = await probe(page, 'facts');
   assert.deepEqual([back.pose, back.clear, back.lightness < .3], [dark.pose, dark.clear, true]);
  } finally {
   await page.evaluate(() => {
    const out = (globalThis as any).__theme3d;
    out?.surface.dispose();
    out?.canvas.remove();
    delete (globalThis as any).__theme3d;
   });
  }
  // The studio's own scene follows the toggle without a rebuild.
  await setTheme(page, 'light');
  await nextFrames(page, 3);
  assert(near(await corner(page), LIGHT_BG), 'the studio clears to the light stage');
  assert.deepEqual(await page.evaluate(() => (globalThis as any).LWProcess3D.live()), studioLive, 'the studio scene is not rebuilt');
 });

 await check('The light theme lasts across Present, dialogs and process switches, and Present, dialogs, lenses, tooltip and legend follow it',
  async () => {
   await freshStudio();
   await setTheme(page, 'light');
   const before = JSON.stringify((await query(page)).snapshot);
   const light = {bg: 'rgb(243, 245, 248)', panel: 'rgb(255, 255, 255)', text: 'rgb(23, 32, 43)', muted: 'rgb(79, 91, 106)'};
   // Present: the slide on the light stage, its header and footer on the panel; closing keeps the theme.
   await page.locator('#mode-present').click();
   await page.locator('dialog#present[open]').waitFor();
   assert.deepEqual([await colour(page, '#present', 'background-color'), await colour(page, '.present-head', 'background-color'),
    await colour(page, '#present', 'color')], [light.bg, light.panel, light.text]);
   await page.keyboard.press('Escape');
   await page.locator('dialog#present[open]').waitFor({state: 'hidden'});
   assert.equal((await themeState(page)).scheme, 'light', 'the theme survives Present');
   // The step editor and the Definition editor.
   await page.locator('#steps button[data-step]').nth(1).click();
   await page.locator('#edit-step').click();
   await page.locator('dialog.pd-dialog[open]').waitFor();
   assert.deepEqual([await colour(page, 'dialog.pd-dialog[open]', 'background-color'), await colour(page, 'dialog.pd-dialog[open] .pd-head',
    'background-color'), await colour(page, 'dialog.pd-dialog[open] .se-help', 'color')], [light.bg, light.panel, light.muted]);
   await page.keyboard.press('Escape');
   await page.locator('dialog.pd-dialog[open]').waitFor({state: 'hidden'});
   await studio.openDef();
   assert.equal(await colour(page, 'dialog.de-dialog[open]', 'background-color'), light.bg);
   await studio.closeDef();
   // A confirmation: importing over a run past minute 0 asks first; Cancel keeps everything.
   await page.locator('#advance').click();
   const running = JSON.stringify((await query(page)).snapshot);
   const file = fs.readFileSync(path.join(studio.gameDir, studio.gameDefinitions[1]!));
   await page.locator('#file').setInputFiles({name: 'other.json', mimeType: 'application/json', buffer: file});
   await page.locator('dialog.ask-dialog[open]').waitFor();
   assert.equal(await colour(page, 'dialog.ask-dialog[open]', 'background-color'), light.bg);
   await page.locator('#ask-cancel').click();
   await page.locator('dialog.ask-dialog[open]').waitFor({state: 'hidden'});
   assert.equal(JSON.stringify((await query(page)).snapshot), running);
   assert.notEqual(running, before, 'only the explicit advance moved the run');
   // The SIPOC lens and the legend.
   await page.locator('#back-overview').click();
   await page.locator('#mode-lens').click();
   await page.locator('#lens .sipoc-card').first().waitFor();
   assert.deepEqual([await colour(page, '#lens', 'background-color'), await colour(page, '#lens .sipoc', 'color'),
    await colour(page, '.process-legend', 'color')], [light.bg, light.text, light.muted]);
   // The Dashboard and its tooltip.
   await page.locator('#mode-dashboard').click();
   const mark = page.locator('#dashboard [data-tip][tabindex="0"]:visible').first();
   await mark.waitFor();
   await mark.focus();
   await page.locator('#dashboard .db-tip:not([hidden])').waitFor();
   assert.deepEqual([await colour(page, '#dashboard .db-tip', 'background-color'), await colour(page, '#dashboard .db-tip', 'color'),
    await colour(page, '#dashboard .db-panel', 'background-color')], [light.panel, light.text, light.panel]);
   // A process switch keeps the theme; the journey map's phase strips take the light phase colours.
   await page.locator('#mode-lens').click();
   await switchTo(3);
   assert.equal((await themeState(page)).scheme, 'light', 'the theme survives a process switch');
   await page.locator('#lens .jm-phase').first().waitFor();
   const phase = await colour(page, '#lens .jm-phase:not(.jm-corner)', 'border-top-color');
   assert.equal(phase, 'rgb(64, 136, 200)', 'the first phase strip is --phase-1 of the light theme');
   assert.equal(await colour(page, '#lens .jm-card', 'background-color'), light.panel);
   // The rebuilt 3D scene of the switched process starts light.
   await page.locator('#mode-3d').click();
   await nextFrames(page, 3);
   assert(near(await corner(page), LIGHT_BG), 'the rebuilt 3D scene clears to the light stage');
  });

 await check('Present and the Dashboard keep their light layouts at 1440x1060 and 390x844 without overflow, also in DejaVu Sans', async () => {
  for (const font of ['default', 'DejaVu Sans'] as const) {
   await page.setViewportSize({width: 1440, height: 1060});
   await freshStudio();
   if (font === 'DejaVu Sans') await page.addStyleTag({content: DEJAVU});
   await page.evaluate(() => document.fonts.ready);
   await setTheme(page, 'light');
   await page.locator('#advance').click();
   if (font === 'DejaVu Sans') {
    const families = await renderedFamilies(page, ['#process-title', '#frame', '#scene-title']);
    for (const [selector, used] of Object.entries(families)) assert.deepEqual(used, ['DejaVu Sans'], `${selector} renders with ${used.join(', ')}`);
   }
   for (const [width, height] of [[1440, 1060], [390, 844]] as const) {
    const at = `${width}x${height} ${font}`, phone = width < 651;
    await page.setViewportSize({width, height});
    await nextFrames(page, 3);
    const menu = async (item: string) => {
     await page.locator('#more-menu').click();
     await page.locator(item).click();
    };
    if (phone) await menu('#dashboard-item'); else await page.locator('#mode-dashboard').click();
    await page.locator('#dashboard .db-panel').first().waitFor();
    await nextFrames(page, 3);
    const wide = await page.locator('#dashboard :is(.db-panel,.db-whatif,.db-data,.db-strip)')
     .evaluateAll(list => list.filter(p => p.scrollWidth > p.clientWidth + 1).map(p => p.className));
    assert.deepEqual([await overflow(page, '#dashboard'), wide], [{page: false, element: false}, []], 'Dashboard at ' + at);
    if (phone) await menu('#present-item'); else await page.locator('#mode-present').click();
    await page.locator('dialog#present[open]').waitFor();
    for (const key of ['Home', 'PageDown', 'End']) {
     await page.keyboard.press(key);
     await nextFrames(page);
     const clipped = await page.locator('#present :is(h2,h3,p,li,button)').evaluateAll(list => list
      .filter(e => e.getClientRects().length > 0 && !e.closest('#map') && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).display !== 'inline')
      .map(e => e.id || (e.textContent ?? '').slice(0, 30)));
     assert.deepEqual([await overflow(page, '#present'), clipped], [{page: false, element: false}, []], `Present ${key} at ${at}`);
     assert.equal(await colour(page, '#present', 'background-color'), 'rgb(243, 245, 248)');
    }
    await page.keyboard.press('Escape');
    await page.locator('dialog#present[open]').waitFor({state: 'hidden'});
   }
  }
 });

 await check('Forced colours win over either theme: system colours alike in dark and light, state swatches and meters kept', async () => {
  await freshStudio();
  const sample = () => page.evaluate(() => {
   const css = (s: string) => getComputedStyle(document.querySelector(s)!);
   return {body: [css('body').color, css('body').backgroundColor], button: [css('#frame').color, css('#frame').borderTopColor],
    panel: css('.process-nav').backgroundColor, meter: css('.pool-bar').borderTopColor, swatch: css('.pool-bar i').forcedColorAdjust};
  });
  try {
   await page.emulateMedia({forcedColors: 'active'});
   await nextFrames(page);
   const dark = await sample();
   await setTheme(page, 'light');
   const light = await sample();
   assert.deepEqual(light, dark, 'the light tokens do not fight forced colours');
   assert.equal(light.swatch, 'none', 'meter fills keep their colour');
  } finally {
   await page.emulateMedia({forcedColors: 'none'});
  }
 });
}
