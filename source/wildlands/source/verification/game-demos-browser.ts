/**
 * Game folder demos built by the engine CLI (`wildlands build-game`). Each suite run builds the
 * Littlewild, RTS Frontier and Pocket Pet folders with the checkout's compiled CLI (byte-identical
 * to bin/wildlands, see tools/cli-bundle.cts), then opens every artifact from file:// in its own
 * context with no network: it must boot its own game under its own storage namespace, publish the
 * shared ready signal and make no request. The studio is built on demand the same way.
 *
 * The published demos (repository `demos/`, written only by `npm run build:demos`) are opened the
 * same way, one check per game: the file must match `demos/manifest.json`, boot only its own game
 * and keep every storage key inside its game's namespace (Littlewild keeps the legacy keys).
 * Whether they are current with the engine and folders is `npm run check:demos`.
 * Registered in source/verification/suites.json.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {launchBrowser, monitorContext, READY_TIMEOUT_MS, waitForReady} from './browser-harness';
import {createHash} from 'node:crypto';
import {gameDirectory, gamesRoot} from '../tools/game-folder.cjs';
import {gameFolders} from '../tools/game-build.cjs';
import type {Browser, Page} from 'playwright';

const ROOT = path.resolve(__dirname, '../..'), CLI = path.resolve(__dirname, '../tools/wildlands-cli.cjs');
/** Repository demos/ (source/wildlands/../../demos). */
const DEMOS = path.resolve(ROOT, '../../demos');
const OUT = process.env.WILDLANDS_GAME_DEMOS_OUT ?? path.join(ROOT, 'verification', 'v15');
const results: {name: string; passed: boolean; error?: string}[] = [];
/** The artifacts' CSP forbids string predicates, so waits pass functions reading this page global. */
type PlayGlobal = {WildlandsPlay: {game: {query(): {tick: number}; renderer(): {frames?: number} | null}}};
interface PublishedDemo {id: string; template: string; output: string; bytes: number; sha256: string; budgetBytes: number; gameDigest: string; engine: string;}
interface GameJson {id: string; template: string; presentation: {title: string}; storage: {namespace: string}; targets: {html: {output: string; budgetBytes: number}}; content: {packs?: string[]}}
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
  const context = await browser.newContext({viewport: {width: 1280, height: 860}}), diagnostics = monitorContext(context);
  const id = (path.dirname(demo.file) === DEMOS ? 'published-' : '') + path.basename(demo.file, '.html');
  try {
    const page = await context.newPage(), url = pathToFileURL(demo.file).href, local: string[] = [];
    page.setDefaultTimeout(15000);
    // The harness records network requests; a self-contained file must not load other local files either.
    page.on('request', request => { if (request.url() !== url && /^(?:file|https?):/.test(request.url())) local.push(request.url()); });
    await page.goto(url, {waitUntil: 'load', timeout: 60000});
    assert.equal(await page.locator('meta[name=wildlands-engine]').getAttribute('content'), demo.engine);
    assert.equal(await page.locator('meta[name=wildlands-game-digest]').getAttribute('content'), demo.digest);
    await work(page);
    await page.screenshot({path: path.join(OUT, `game-demo-${id}.png`)});
    assert.deepEqual(diagnostics.errors, [], `${id} page errors`);
    assert.deepEqual(diagnostics.consoleProblems.filter(problem => problem.startsWith('error:')), [], `${id} console errors`);
    assert.deepEqual(diagnostics.requests, [], `${id} network requests`);
    assert.deepEqual(local, [], `${id} requests`);
  } finally { await context.close(); }
}

const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;
/** Every storage key the page holds; a game writes only inside its own namespace. */
const storageKeys = (page: Page): Promise<string[]> => page.evaluate('Object.keys(localStorage).sort()') as Promise<string[]>;
function namespaced(keys: readonly string[], namespace: string): void {
  const prefix = namespace + '.';
  assert.deepEqual(keys.filter(key => !key.startsWith(prefix)), [], `storage keys outside ${namespace}`);
}

/** The published demo of a game folder as demos/manifest.json records it. */
function published(manifest: {demos: PublishedDemo[]}, id: string): {file: string; engine: string; digest: string} {
  const entry = manifest.demos.find(demo => demo.id === id);
  assert(entry, `demos/manifest.json lists ${id}`);
  return {file: path.join(DEMOS, path.posix.basename(entry.output)), engine: entry.engine, digest: entry.gameDigest};
}

/** A published colony demo: only its own packs, no template hosts, saves inside its namespace. */
async function colonyDemo(page: Page, game: GameJson, folder: string): Promise<void> {
  await waitForReady(page, {host: 'colony', timeout: READY_TIMEOUT_MS});
  const title = await page.title();
  assert(title.endsWith(game.presentation.title), `${title} names ${game.presentation.title}`);
  assert.equal(await page.evaluate('LWContentProvider.get().id+"/"+LWGameProfile.storage.namespace'), game.id + '/' + game.storage.namespace);
  assert.equal(await page.evaluate('[typeof LWRTSHost,typeof LWPetHost,typeof LWScenarioUI,typeof LWDeveloper].join()'), 'undefined,undefined,undefined,undefined');
  const packs = (game.content.packs ?? []).map(file => readJson<{id: string}>(path.join(folder, file)).id);
  assert.equal(await page.evaluate('LWScenarios.builtins().map(pack=>pack.id).join()'), packs.join());
  await page.locator('[data-act=begin]').click();
  const before = await page.evaluate('Littlewild.engine.s.simTime') as number;
  await page.evaluate('Littlewild.advance(5)');
  assert((await page.evaluate('Littlewild.engine.s.simTime') as number) > before, 'explicit advance moves the colony clock');
  await page.evaluate('Littlewild.save(true)');
  const keys = await storageKeys(page), legacy = game.storage.namespace === 'littlewild';
  // Littlewild keeps the exact legacy save keys; every other game saves under its own namespace only.
  assert(keys.includes(legacy ? 'littlewild.save.v5' : game.storage.namespace + '.save.v5'), `${game.id} save key in ${keys.join()}`);
  if (!legacy) assert(!keys.includes('littlewild.save.v5'), 'no legacy Littlewild save');
  namespaced(keys, game.storage.namespace);
}

/** A published RTS or Pocket Pet demo: only its own host runs, under its own namespace. */
async function templateDemo(page: Page, game: GameJson): Promise<void> {
  const app = game.template, other = app === 'rts' ? 'LWPetHost' : 'LWRTSHost';
  await waitForReady(page, {host: app, timeout: READY_TIMEOUT_MS});
  assert.equal(await page.evaluate(`WildlandsPlay.ready===true&&WildlandsPlay.app===${JSON.stringify(app)}`), true);
  assert.equal(await page.evaluate('LWContentProvider.get().id+"/"+LWGameProfile.storage.namespace'), game.id + '/' + game.storage.namespace);
  assert.equal(await page.evaluate(`[typeof Littlewild,typeof ${other},typeof LWScenarios].join()`), 'undefined,undefined,undefined');
  if (app === 'rts') {
    if (await page.evaluate('WildlandsPlay.game.status().paused')) await page.locator('[data-rts="pause"]').click();
    const tick = await page.evaluate('WildlandsPlay.game.query().tick') as number;
    await page.waitForFunction(start => (globalThis as unknown as PlayGlobal).WildlandsPlay.game.query().tick > start, tick);
  } else await page.waitForFunction(() => ((globalThis as unknown as PlayGlobal).WildlandsPlay.game.renderer()?.frames ?? 0) > 2);
  namespaced(await storageKeys(page), game.storage.namespace);
}

/** One check per published demo, after the manifest check; titles name the game and its storage. */
async function publishedChecks(browser: Browser): Promise<void> {
  const folders = gameFolders(gamesRoot()), games = new Map(folders.map(folder => [path.basename(folder), readJson<GameJson>(path.join(folder, 'game.json'))]));
  let manifest: {format: string; engine: string; demos: PublishedDemo[]} = {format: '', engine: '', demos: []};
  await check('Published demos/manifest.json lists one byte-identical demo per game folder within its play budget', async () => {
    manifest = readJson(path.join(DEMOS, 'manifest.json'));
    assert.equal(manifest.format, 'wildlands-demos');
    assert.deepEqual(manifest.demos.map(demo => demo.id), [...games.keys()], 'one demo per game folder, in id order');
    assert.deepEqual(fs.readdirSync(DEMOS).filter(name => name.endsWith('.html')).sort(), manifest.demos.map(demo => path.posix.basename(demo.output)).sort(), 'no orphan demo');
    for (const demo of manifest.demos) {
      const game = games.get(demo.id)!, bytes = fs.readFileSync(path.join(DEMOS, path.posix.basename(demo.output)));
      assert.equal(demo.output, game.targets.html.output); assert.equal(demo.template, game.template); assert.equal(demo.engine, manifest.engine);
      assert.equal(demo.budgetBytes, game.targets.html.budgetBytes);
      assert.equal(bytes.length, demo.bytes, `${demo.id} bytes`); assert(demo.bytes <= demo.budgetBytes, `${demo.id} within its budget`);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), demo.sha256, `${demo.id} sha256`);
    }
  });
  const names: Record<string, string> = {
   'littlewild': 'Published Littlewild demo boots only Littlewild from file:// and keeps the legacy littlewild save keys',
   'emberworks': 'Published Emberworks demo boots only Emberworks from file:// under the wildlands.emberworks storage namespace',
   'office': 'Published Office demo boots only Office from file:// under the wildlands.office storage namespace',
   'rts-frontier': 'Published RTS Frontier demo boots only its RTS match from file:// under the wildlands.rts-frontier storage namespace',
   'pocket-pet': 'Published Pocket Pet demo boots only its pet room from file:// under the wildlands.pocket-pet storage namespace'
  };
  assert.deepEqual(Object.keys(names).sort(), [...games.keys()], 'every game folder has a published-demo check');
  for (const [id, name] of Object.entries(names)) {
    const game = games.get(id)!, folder = gameDirectory(id);
    await check(name, () => withDemo(browser, published(manifest, id), page => game.template === 'colony' ? colonyDemo(page, game, folder) : templateDemo(page, game)));
  }
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'wildlands-game-demos-'));
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
      await withDemo(browser, build(gameDirectory('rts-frontier'), path.join(work, 'rts-frontier.html')), async page => {
        await waitForReady(page, {host: 'rts', timeout: READY_TIMEOUT_MS});
        assert.equal(await page.evaluate('WildlandsPlay.ready===true&&WildlandsPlay.app==="rts"'), true);
        assert.equal(await page.evaluate('LWGameProfile.storage.namespace'), 'wildlands.rts-frontier');
        if (await page.evaluate('WildlandsPlay.game.status().paused')) await page.locator('[data-rts="pause"]').click();
        const tick = await page.evaluate('WildlandsPlay.game.query().tick') as number;
        await page.waitForFunction(start => (globalThis as unknown as PlayGlobal).WildlandsPlay.game.query().tick > start, tick);
      });
      await withDemo(browser, build(gameDirectory('pocket-pet'), path.join(work, 'pocket-pet.html')), async page => {
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
    await publishedChecks(browser);
  } finally { await browser.close(); fs.rmSync(work, {recursive: true, force: true}); }
}

main().catch(error => { results.push({name: 'game demos browser harness', passed: false, error: String(error)}); }).finally(() => {
  const passed = results.filter(result => result.passed).length;
  fs.mkdirSync(OUT, {recursive: true});
  fs.writeFileSync(path.join(OUT, 'game-demos-browser-results.json'), JSON.stringify({passed, total: results.length, results}, null, 2));
  console.log(passed + '/' + results.length);
  if (passed !== results.length || !results.length) process.exitCode = 1;
});
