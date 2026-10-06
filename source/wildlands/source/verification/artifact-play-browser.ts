/**
 * Smoke checks for the play and studio artifacts written by `npm run build` to
 * .generated/artifacts/. Each artifact opens from file:// in its own context with no network,
 * boots its own game and advances only through its own application clock.
 * Not yet registered in the gate: the suite registry is owned by the test-infrastructure phase.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {launchBrowser, monitorContext} from './browser-harness';
import type {Browser, Page} from 'playwright';

const ROOT = path.resolve(__dirname, '../..'), ARTIFACTS = path.join(ROOT, '.generated', 'artifacts');
const OUT = process.env.WILDLANDS_ARTIFACT_PLAY_OUT ?? path.join(ROOT, 'verification', 'v15');
const PAYLOADS = ['LWEngineSourceLoader', 'WildlandsGodotRuntimeLoader', 'WildlandsGodotTemplates'];
const results: {name: string; passed: boolean; error?: string}[] = [];
/** The artifacts' CSP forbids string predicates, so waits pass functions reading this page global. */
type PlayGlobal = {WildlandsPlay: {game: {query(): {tick: number}; renderer(): {frames?: number} | null}}};
async function check(name: string, work: () => Promise<void>): Promise<void> {
  try { await work(); results.push({name, passed: true}); } catch (error) { results.push({name, passed: false, error: String(error)}); console.error(name, error); }
}

/** Open one artifact by file URL in a fresh context; the work runs while diagnostics are observed. */
async function withArtifact(browser: Browser, id: string, work: (page: Page) => Promise<void>): Promise<void> {
  const file = path.join(ARTIFACTS, id + '.html');
  const html = fs.readFileSync(file, 'utf8');
  // Play artifacts never carry export payloads; the studio keeps them for its export tools.
  for (const payload of PAYLOADS) assert.equal(html.includes('window.' + payload + ' = '), !id.endsWith('-play'), `${id} payload ${payload}`);
  const context = await browser.newContext({viewport: {width: 1280, height: 860}}), diagnostics = monitorContext(context);
  try {
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    await page.goto(pathToFileURL(file).href, {waitUntil: 'load', timeout: 60000});
    await work(page);
    await page.screenshot({path: path.join(OUT, `artifact-${id}.png`)});
    assert.deepEqual(diagnostics.errors, [], `${id} page errors`);
    assert.deepEqual(diagnostics.consoleProblems.filter(problem => problem.startsWith('error:')), [], `${id} console errors`);
    assert.deepEqual(diagnostics.requests, [], `${id} network requests`);
  } finally { await context.close(); }
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  const browser = await launchBrowser();
  try {
    await check('RTS play artifact boots standalone, advances its match and offers a resume after exit', () => withArtifact(browser, 'rts-play', async page => {
      await page.waitForFunction(() => (globalThis as {WildlandsPlay?: {ready: boolean}}).WildlandsPlay?.ready === true);
      assert(await page.locator('#rts-mode').isVisible());
      assert.equal(await page.locator('[data-rts-file="editor"]').isHidden(), true, 'mission editor control is hidden without its bundle');
      if (await page.evaluate('WildlandsPlay.game.status().paused')) await page.locator('[data-rts="pause"]').click();
      const tick = await page.evaluate('WildlandsPlay.game.query().tick') as number;
      await page.waitForFunction(start => (globalThis as unknown as PlayGlobal).WildlandsPlay.game.query().tick > start, tick);
      await page.locator('[data-rts=exit]').click();
      await page.locator('#play-resume').waitFor({state: 'visible'});
      await page.locator('#play-resume').click();
      assert.equal(await page.evaluate('WildlandsPlay.game.status().active'), true);
    }));
    await check('Pet play artifact boots standalone and renders the WebGL room', () => withArtifact(browser, 'pet-play', async page => {
      await page.waitForFunction(() => (globalThis as {WildlandsPlay?: {ready: boolean}}).WildlandsPlay?.ready === true);
      assert(await page.locator('#pet-demo').isVisible());
      await page.waitForFunction(() => ((globalThis as unknown as PlayGlobal).WildlandsPlay.game.renderer()?.frames ?? 0) > 2);
      const stats = await page.evaluate('WildlandsPlay.game.renderer()') as {mode: string; triangles: number};
      assert.match(stats.mode, /WebGL/); assert(stats.triangles > 2000, 'room and pet meshes are drawn');
      await page.waitForFunction(() => (globalThis as unknown as PlayGlobal).WildlandsPlay.game.query().tick >= 3);
    }));
    await check('Colony play artifact boots the colony and starts a story', () => withArtifact(browser, 'colony-play', async page => {
      await page.waitForFunction(() => !!(globalThis as {Littlewild?: unknown}).Littlewild);
      await page.locator('[data-act=begin]').click();
      const before = await page.evaluate('Littlewild.engine.s.simTime') as number;
      await page.evaluate('Littlewild.advance(5)');
      assert((await page.evaluate('Littlewild.engine.s.simTime') as number) > before, 'explicit advance moves the colony clock');
    }));
    await check('Studio artifact boots the colony with editors and export tools', () => withArtifact(browser, 'studio', async page => {
      await page.waitForFunction(() => !!(globalThis as {Littlewild?: unknown; Wildlands?: unknown}).Littlewild && !!(globalThis as {Wildlands?: unknown}).Wildlands);
      await page.locator('[data-act=begin]').click();
      assert.equal(await page.evaluate('typeof LWDeveloper'), 'object');
    }));
  } finally { await browser.close(); }
}

main().catch(error => { results.push({name: 'artifact play browser harness', passed: false, error: String(error)}); }).finally(() => {
  const passed = results.filter(result => result.passed).length;
  fs.mkdirSync(OUT, {recursive: true});
  fs.writeFileSync(path.join(OUT, 'artifact-play-browser-results.json'), JSON.stringify({passed, total: results.length, results}, null, 2));
  console.log(passed + '/' + results.length);
  if (passed !== results.length || !results.length) process.exitCode = 1;
});
