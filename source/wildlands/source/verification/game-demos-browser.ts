/**
 * Game folder demos built by the engine CLI (`wildlands build-game`). Each suite run builds the
 * Littlewild folder and RTS / Pocket Pet fixture folders with the checkout's compiled CLI (byte-
 * identical to bin/wildlands, see tools/cli-bundle.cts), then opens every artifact from file:// in
 * its own context with no network: it must boot its own game under its own storage namespace,
 * publish the shared ready signal and make no request. The studio is built on demand the same way.
 * Registered in source/verification/suites.json.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {launchBrowser, monitorContext, READY_TIMEOUT_MS, waitForReady} from './browser-harness';
import {gameDirectory} from '../tools/game-folder.cjs';
import {gamesFixtureRoot, templateGame} from '../test-support/game-fixtures.cjs';
import type {Browser, Page} from 'playwright';

const ROOT = path.resolve(__dirname, '../..'), CLI = path.resolve(__dirname, '../tools/wildlands-cli.cjs');
const OUT = process.env.WILDLANDS_GAME_DEMOS_OUT ?? path.join(ROOT, 'verification', 'v15');
const results: {name: string; passed: boolean; error?: string}[] = [];
/** The artifacts' CSP forbids string predicates, so waits pass functions reading this page global. */
type PlayGlobal = {WildlandsPlay: {game: {query(): {tick: number}; renderer(): {frames?: number} | null}}};
async function check(name: string, work: () => Promise<void>): Promise<void> {
  try { await work(); results.push({name, passed: true}); } catch (error) { results.push({name, passed: false, error: String(error)}); console.error(name, error); }
}

/** Build one game folder with the compiled engine CLI; returns the artifact path and the CLI summary. */
function build(folder: string, file: string, profile: 'play' | 'studio' = 'play'): {file: string; engine: string; digest: string} {
  const child = spawnSync(process.execPath, [CLI, 'build-game', '--game', folder, '--output', file, '--profile', profile], {encoding: 'utf8', timeout: 300000, maxBuffer: 16 * 1024 * 1024});
  const summary = JSON.parse(child.stdout || '{}') as {ok?: boolean; engine?: string; digest?: string};
  assert.equal(child.status, 0, child.stderr + child.stdout); assert.equal(summary.ok, true);
  return {file, engine: summary.engine!, digest: summary.digest!};
}

/** Open one CLI-built artifact by file URL in a fresh context; the work runs while diagnostics are observed. */
async function withDemo(browser: Browser, demo: {file: string; engine: string; digest: string}, work: (page: Page) => Promise<void>): Promise<void> {
  const context = await browser.newContext({viewport: {width: 1280, height: 860}}), diagnostics = monitorContext(context), id = path.basename(demo.file, '.html');
  try {
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    await page.goto(pathToFileURL(demo.file).href, {waitUntil: 'load', timeout: 60000});
    assert.equal(await page.locator('meta[name=wildlands-engine]').getAttribute('content'), demo.engine);
    assert.equal(await page.locator('meta[name=wildlands-game-digest]').getAttribute('content'), demo.digest);
    await work(page);
    await page.screenshot({path: path.join(OUT, `game-demo-${id}.png`)});
    assert.deepEqual(diagnostics.errors, [], `${id} page errors`);
    assert.deepEqual(diagnostics.consoleProblems.filter(problem => problem.startsWith('error:')), [], `${id} console errors`);
    assert.deepEqual(diagnostics.requests, [], `${id} network requests`);
  } finally { await context.close(); }
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'wildlands-game-demos-')), games = gamesFixtureRoot('wildlands-demo-games-');
  const browser = await launchBrowser();
  try {
    const littlewild = gameDirectory('littlewild');
    await check('CLI-built Littlewild demo boots from file:// with its own game profile and no requests', () => withDemo(browser, build(littlewild, path.join(work, 'littlewild.html')), async page => {
      await waitForReady(page, {host: 'colony', timeout: READY_TIMEOUT_MS});
      assert.match(await page.title(), /Littlewild/);
      // A play demo carries no editors, developer session, export or template bundles.
      assert.equal(await page.evaluate('[typeof LWScenarioUI,typeof LWDeveloper,typeof WildlandsUI,typeof LWRTSHost,typeof LWPetHost].join()'), 'undefined,undefined,undefined,undefined,undefined');
      assert.equal(await page.evaluate('LWScenarios.builtins().map(pack=>pack.id).join()'), 'littlewild');
      await page.locator('[data-act=begin]').click();
      const before = await page.evaluate('Littlewild.engine.s.simTime') as number;
      await page.evaluate('Littlewild.advance(5)');
      assert((await page.evaluate('Littlewild.engine.s.simTime') as number) > before, 'explicit advance moves the colony clock');
      // The littlewild game keeps its legacy save keys.
      await page.evaluate('Littlewild.save(true)');
      assert.equal(await page.evaluate('LWGameProfile.storage.namespace+"/"+(localStorage.getItem("littlewild.save.v5")!==null)'), 'littlewild/true');
    }));
    await check('CLI-built RTS and Pocket Pet demos boot standalone under their own storage namespaces', async () => {
      await withDemo(browser, build(templateGame('rts', games), path.join(work, 'rts-frontier.html')), async page => {
        await waitForReady(page, {host: 'rts', timeout: READY_TIMEOUT_MS});
        assert.equal(await page.evaluate('WildlandsPlay.ready===true&&WildlandsPlay.app==="rts"'), true);
        assert.equal(await page.evaluate('LWGameProfile.storage.namespace'), 'wildlands.rts-frontier');
        if (await page.evaluate('WildlandsPlay.game.status().paused')) await page.locator('[data-rts="pause"]').click();
        const tick = await page.evaluate('WildlandsPlay.game.query().tick') as number;
        await page.waitForFunction(start => (globalThis as unknown as PlayGlobal).WildlandsPlay.game.query().tick > start, tick);
      });
      await withDemo(browser, build(templateGame('pet', games), path.join(work, 'pocket-pet.html')), async page => {
        await waitForReady(page, {host: 'pet', timeout: READY_TIMEOUT_MS});
        assert.equal(await page.evaluate('WildlandsPlay.ready===true&&WildlandsPlay.app==="pet"'), true);
        assert.equal(await page.evaluate('LWGameProfile.storage.namespace'), 'wildlands.pocket-pet');
        await page.waitForFunction(() => ((globalThis as unknown as PlayGlobal).WildlandsPlay.game.renderer()?.frames ?? 0) > 2);
      });
    });
    await check('CLI-built studio boots the colony with editors and export tools on demand', () => withDemo(browser, build(littlewild, path.join(work, 'studio.html'), 'studio'), async page => {
      await waitForReady(page, {host: 'colony', timeout: READY_TIMEOUT_MS});
      assert.equal(await page.evaluate('typeof Littlewild+"/"+typeof Wildlands'), 'object/object');
      await page.locator('[data-act=begin]').click();
      assert.equal(await page.evaluate('typeof LWDeveloper'), 'object');
      assert.equal(await page.evaluate('WildlandsGodot.capability().available'), true);
    }));
  } finally { await browser.close(); fs.rmSync(work, {recursive: true, force: true}); fs.rmSync(games, {recursive: true, force: true}); }
}

main().catch(error => { results.push({name: 'game demos browser harness', passed: false, error: String(error)}); }).finally(() => {
  const passed = results.filter(result => result.passed).length;
  fs.mkdirSync(OUT, {recursive: true});
  fs.writeFileSync(path.join(OUT, 'game-demos-browser-results.json'), JSON.stringify({passed, total: results.length, results}, null, 2));
  console.log(passed + '/' + results.length);
  if (passed !== results.length || !results.length) process.exitCode = 1;
});
