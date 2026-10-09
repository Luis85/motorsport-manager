/**
 * Developer tool (`npm run process:shots`): screenshot one process of a Wildlands process game at a chosen minute.
 *
 *   npm run process:shots -- --game DIR --process N --minute M --out DIR
 *
 * N is the 1-based index in the game's `content.definitions`. The game is built with the checked-in
 * `bin/wildlands build-game` into a temporary directory and opened in Playwright Chromium
 * (`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` when set). The tool acts only through the studio's own controls:
 * it selects the process, sets **Run until** to M, speed 30 and **Run simulation**, and waits on the public
 * `LWProcessStudio.query()` until the run stops (never a fixed sleep). It then captures desktop 2D, 3D and
 * lens, desktop Present (first slide and a step slide), the phone (390x844) studio and Present, and DejaVu Sans
 * variants of both Present views. Each capture records horizontal overflow and the widest offending elements;
 * console and page errors are collected. The JSON summary goes to stdout and OUT/shots.json.
 *
 * Exit codes: 0 every available capture was written, 1 a capture or the build failed, 2 invalid arguments.
 * Screenshots of a synthetic run are review material, not human usability or visual-quality validation.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {chromium, type Browser, type Page} from 'playwright';
import {openArtifact, waitForReady} from './browser-harness';

const REPO = path.resolve(__dirname, '../../../..');
const CLI = path.join(REPO, 'bin/wildlands');
const DESKTOP = {width: 1440, height: 1060} as const, PHONE = {width: 390, height: 844} as const;
const DEJAVU = '*{font-family:"DejaVu Sans",sans-serif !important}';
const PRESENT_UNAVAILABLE = 'Present mode not available in this build';
const MAX_MINUTE = 100000;

interface Args {game: string; process: number; minute: number; out: string; definitions: string[]}
interface Offender {element: string; left: number; right: number; width: number}
interface Overflow {scrollWidth: number; clientWidth: number; overflowing: boolean; offenders: Offender[]; dialog?: {scrollWidth: number; clientWidth: number; overflowing: boolean}}
interface Shot {name: string; path: string | null; viewport: string; font: 'default' | 'DejaVu Sans'; available: boolean; overflow: Overflow | null; detail?: Record<string, unknown>; error?: string}
interface Presenting {index: number; count: number; id: string}
interface StudioView {active: number; playing: boolean; horizon: number | null; mode: string; snapshot: {minute: number; status: string}; definition: {id: string; name: string; start: string; steps: {id: string}[]}; presenting?: Presenting | null}

class UsageError extends Error {}

/** Parse and validate every argument before any build or browser work; relative paths resolve against the caller's directory. */
function parseArgs(argv: string[]): Args {
 const known = new Set(['--game', '--process', '--minute', '--out']), seen = new Map<string, string>();
 for (let i = 0; i < argv.length; i += 2) {
  const flag = argv[i]!, value = argv[i + 1];
  if (!known.has(flag)) throw new UsageError(`Unknown option ${flag}. Usage: --game DIR --process N --minute M --out DIR`);
  if (seen.has(flag)) throw new UsageError(`Duplicate option ${flag}.`);
  if (value === undefined || value.startsWith('--')) throw new UsageError(`Option ${flag} needs a value.`);
  seen.set(flag, value);
 }
 for (const flag of known) if (!seen.has(flag)) throw new UsageError(`Missing option ${flag}. Usage: --game DIR --process N --minute M --out DIR`);
 const base = process.env.INIT_CWD ?? process.cwd(), game = path.resolve(base, seen.get('--game')!), out = path.resolve(base, seen.get('--out')!);
 const manifestPath = path.join(game, 'game.json');
 if (!fs.existsSync(manifestPath)) throw new UsageError(`--game ${game} has no game.json.`);
 let manifest: {template?: string; content?: {definition?: string; definitions?: string[]}};
 try {manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as typeof manifest;} catch (e) {throw new UsageError(`--game ${manifestPath} is not JSON: ${String(e)}`);}
 if (manifest.template !== 'process') throw new UsageError(`--game ${game} is not a process game (template ${String(manifest.template)}).`);
 const definitions = manifest.content?.definitions ?? (manifest.content?.definition ? [manifest.content.definition] : []);
 const whole = (flag: string, min: number, max: number): number => {
  const text = seen.get(flag)!, n = Number(text);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(n) || n < min || n > max) throw new UsageError(`${flag} must be a whole number from ${min} to ${max}, not "${text}".`);
  return n;
 };
 if (!definitions.length) throw new UsageError(`--game ${game} lists no process definitions.`);
 const index = whole('--process', 1, definitions.length), minute = whole('--minute', 0, MAX_MINUTE);
 if (fs.existsSync(out) && !fs.statSync(out).isDirectory()) throw new UsageError(`--out ${out} exists and is not a directory.`);
 if (!fs.existsSync(path.dirname(out))) throw new UsageError(`--out parent directory ${path.dirname(out)} does not exist.`);
 return {game, process: index, minute, out, definitions};
}

async function launch(): Promise<{browser: Browser; identity: Record<string, string>}> {
 const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
 const args = ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'];
 const browser = await chromium.launch({headless: true, ...(executablePath ? {executablePath} : {channel: 'chromium'}), args});
 const version = (name: string) => (createRequire(__filename)(`${name}/package.json`) as {version: string}).version;
 return {browser, identity: {node: process.version, playwright: version('playwright'), browser: browser.version(), selection: executablePath ? 'PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH' : 'bundled-desktop-chromium'}};
}

const query = (page: Page): Promise<StudioView> => page.evaluate(() => (globalThis as unknown as {LWProcessStudio: {query(): StudioView}}).LWProcessStudio.query());

/**
 * Document overflow plus the widest elements that end past the right edge without a clipping ancestor inside the
 * viewport; the open Present dialog is measured too. Functions evaluated in the page declare no named inner functions:
 * under tsx (esbuild keepNames) those would call a `__name` helper that does not exist in the page.
 */
function measureOverflow(page: Page): Promise<Overflow> {
 return page.evaluate(() => {
  const root = document.documentElement, width = root.clientWidth, offenders: Offender[] = [];
  for (const e of document.querySelectorAll('body *')) {
   const r = e.getBoundingClientRect(); if (!r.width || r.right <= width + 1) continue;
   let clipped = false;
   for (let p = e.parentElement; p && p !== document.body && !clipped; p = p.parentElement) {
    if (/^(hidden|clip|auto|scroll)$/.test(getComputedStyle(p).overflowX) && p.getBoundingClientRect().right <= width + 1) clipped = true;
   }
   if (!clipped) offenders.push({element: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + [...e.classList].slice(0, 2).map(c => '.' + c).join(''), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width)});
  }
  offenders.sort((a, b) => b.right - a.right || b.width - a.width).splice(5);
  const result: Overflow = {scrollWidth: root.scrollWidth, clientWidth: width, overflowing: root.scrollWidth > width, offenders};
  const dialog = document.querySelector<HTMLDialogElement>('dialog#present[open]');
  if (dialog) result.dialog = {scrollWidth: dialog.scrollWidth, clientWidth: dialog.clientWidth, overflowing: dialog.scrollWidth > dialog.clientWidth + 1};
  return result;
 });
}

/** Select the process and run it to the requested minute through the toolbar: Run until (custom), speed 30, Run, then Pause if still playing. */
async function reachMinute(page: Page, index: number, minute: number): Promise<Record<string, unknown>> {
 const switcher = page.locator('#process-switch');
 if (await switcher.isVisible()) {
  await switcher.selectOption(String(index));
  await page.waitForFunction(i => (globalThis as unknown as {LWProcessStudio: {query(): StudioView}}).LWProcessStudio.query().active === i, index);
 }
 if (minute === 0) return {horizonApplied: false, method: 'none (minute 0)'};
 await page.locator('#horizon').selectOption('custom');
 await page.locator('#horizon-custom').fill(String(minute));
 await page.locator('#horizon-custom').dispatchEvent('change');
 const horizonApplied = await page.waitForFunction(m => (globalThis as unknown as {LWProcessStudio: {query(): StudioView}}).LWProcessStudio.query().horizon === m, minute, {timeout: 5000}).then(() => true, () => false);
 await page.locator('#speed').selectOption('30');
 await page.locator('#play').click();
 // A pulse of 30 minutes runs every 0.35 s of animation time; allow three times that plus start-up.
 const timeout = Math.ceil(minute / 30) * 350 * 3 + 30000;
 await page.waitForFunction(m => {const q = (globalThis as unknown as {LWProcessStudio: {query(): StudioView}}).LWProcessStudio.query(); return !q.playing || q.snapshot.minute >= m;}, minute, {timeout, polling: 100});
 if ((await query(page)).playing) await page.locator('#play').click();
 await page.waitForFunction(() => !(globalThis as unknown as {LWProcessStudio: {query(): StudioView}}).LWProcessStudio.query().playing);
 return {horizonApplied, method: horizonApplied ? 'Run until custom + speed 30 + Run' : 'speed 30 + Run, paused once the clock reached the minute'};
}

async function settle(page: Page): Promise<void> {
 await page.evaluate(() => document.fonts.ready.then(() => undefined));
 // Three rendered frames (style, layout and paint run between them); not the harness helper, see measureOverflow.
 await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))));
}

function runShots(out: string, page: Page, errors: {at: string; kind: string; text: string}[]) {
 const shots: Shot[] = [];
 let at = 'load';
 page.on('console', m => {if (m.type() === 'error') errors.push({at, kind: 'console', text: m.text()});});
 page.on('pageerror', e => errors.push({at, kind: 'pageerror', text: String(e)}));
 const viewportName = () => {const v = page.viewportSize(); return v ? `${v.width}x${v.height}` : 'unknown';};
 /** Capture the viewport (never a lazy full-page stitch) and record its overflow; a failure is recorded, not thrown. */
 const capture = async (name: string, font: Shot['font'], prepare: () => Promise<Record<string, unknown> | void>) => {
  at = name; const file = path.join(out, name + '.png');
  try {
   const detail = (await prepare()) ?? {}; await settle(page);
   const overflow = await measureOverflow(page); await page.screenshot({path: file});
   shots.push({name, path: file, viewport: viewportName(), font, available: true, overflow, detail});
  } catch (e) {
   const unavailable = e instanceof Error && e.message === PRESENT_UNAVAILABLE;
   shots.push({name, path: null, viewport: viewportName(), font, available: !unavailable, overflow: null, error: e instanceof Error ? e.message : String(e)});
  }
 };
 const mode = async (id: string) => {
  const button = page.locator('#mode-' + id);
  if (await button.isDisabled()) throw new Error(`${id} view is disabled: ${await page.locator('#message').innerText()}`);
  await button.click(); if (id !== 'lens') await page.locator('#frame').click();
  return {mode: id, label: (await button.innerText()).trim(), status: (await page.locator('#message').innerText()).trim()};
 };
 const presentingOf = async () => (await query(page)).presenting ?? null;
 const slideDetail = async () => ({presenting: await presentingOf(), countText: (await page.locator('#present-count').innerText()).trim()});
 const enterPresent = async (phone: boolean) => {
  if (!(await page.locator(phone ? '#present-item' : '#mode-present').count())) throw new Error(PRESENT_UNAVAILABLE);
  if (phone) {await page.locator('#more-menu').click(); await page.locator('#export-popup').waitFor();}
  await page.locator(phone ? '#present-item' : '#mode-present').click();
  await page.locator('dialog#present[open]').waitFor();
  await page.waitForFunction(() => !!(globalThis as unknown as {LWProcessStudio: {query(): StudioView}}).LWProcessStudio.query().presenting);
  return slideDetail();
 };
 const exitPresent = async () => {
  if (!(await page.locator('dialog#present[open]').count())) return;
  await page.locator('#present-exit').click(); await page.locator('dialog#present[open]').waitFor({state: 'detached'});
 };
 /** Advance until the slide id names a step other than the start step (the slide model's id scheme is not assumed beyond ending in the step id). */
 const toStepSlide = async () => {
  const d = (await query(page)).definition, steps = d.steps.map(s => s.id).filter(id => id !== d.start), isStep = (id: string) => steps.some(s => id === s || id.endsWith('-' + s) || id.endsWith(':' + s) || id.endsWith('/' + s));
  for (let p = await presentingOf(); p && !isStep(p.id) && p.index < p.count - 1; p = await presentingOf()) {
   const before = p.index; await page.locator('#present-next').click();
   await page.waitForFunction(i => ((globalThis as unknown as {LWProcessStudio: {query(): StudioView}}).LWProcessStudio.query().presenting?.index ?? i) !== i, before);
  }
  const p = await presentingOf(); return {...await slideDetail(), stepSlide: !!p && isStep(p.id)};
 };
 const presentPair = async (suffix: string, font: Shot['font']) => {
  await page.setViewportSize(DESKTOP);
  await capture('desktop-present-first' + suffix, font, () => enterPresent(false));
  if (await page.locator('dialog#present[open]').count()) await capture('desktop-present-step' + suffix, font, toStepSlide);
  else shots.push({name: 'desktop-present-step' + suffix, path: null, viewport: viewportName(), font, available: false, overflow: null, error: PRESENT_UNAVAILABLE});
  await exitPresent();
  await page.setViewportSize(PHONE);
  await capture('phone-present' + suffix, font, () => enterPresent(true));
  await exitPresent(); await page.setViewportSize(DESKTOP);
 };
 return {shots, run: async () => {
  await capture('desktop-2d', 'default', () => mode('2d'));
  await capture('desktop-3d', 'default', () => mode('3d'));
  await capture('desktop-lens', 'default', () => mode('lens'));
  await presentPair('', 'default');
  await page.setViewportSize(PHONE);
  await capture('phone-studio', 'default', async () => ({...await mode('2d'), note: 'viewport capture of the top of the phone page'}));
  await page.setViewportSize(DESKTOP); await mode('2d');
  at = 'dejavu'; await page.addStyleTag({content: DEJAVU});
  await presentPair('-dejavu', 'DejaVu Sans');
 }};
}

async function main(): Promise<number> {
 let args: Args;
 try {args = parseArgs(process.argv.slice(2));} catch (e) {
  if (!(e instanceof UsageError)) throw e;
  process.stderr.write(JSON.stringify({ok: false, code: 'usage', message: e.message}) + '\n'); return 2;
 }
 fs.mkdirSync(args.out, {recursive: true});
 const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'process-shots-')), errors: {at: string; kind: string; text: string}[] = [];
 const summary: Record<string, unknown> = {ok: false, game: args.game, process: args.process, definition: args.definitions[args.process - 1], minuteRequested: args.minute, minuteReached: null, files: [], consoleErrors: errors};
 let browser: Browser | null = null;
 try {
  const html = path.join(temp, 'game.html');
  const built = spawnSync(process.execPath, [CLI, 'build-game', '--game', args.game, '--output', html], {encoding: 'utf8', timeout: 300000});
  if (built.status !== 0) throw new Error('bin/wildlands build-game failed: ' + (built.stderr || built.stdout).slice(0, 2000));
  const launched = await launch(); browser = launched.browser; summary.execution = launched.identity;
  const context = await browser.newContext({viewport: {...DESKTOP}, reducedMotion: 'reduce'}), page = await context.newPage();
  page.setDefaultTimeout(15000);
  const shots = runShots(args.out, page, errors);
  await openArtifact(page, html, {url: 'https://localhost/process'}); await waitForReady(page, {host: 'process'});
  summary.run = await reachMinute(page, args.process - 1, args.minute);
  const q = await query(page);
  Object.assign(summary, {processName: q.definition.name, processId: q.definition.id, minuteReached: q.snapshot.minute, runStatus: q.snapshot.status});
  await shots.run();
  summary.files = shots.shots;
  const present = shots.shots.filter(s => s.name.includes('present'));
  summary.present = present.every(s => !s.available) ? {available: false, message: PRESENT_UNAVAILABLE} : {available: true};
  summary.overflowing = shots.shots.filter(s => s.overflow && (s.overflow.overflowing || s.overflow.dialog?.overflowing)).map(s => s.name);
  summary.ok = shots.shots.every(s => !s.available || s.path !== null);
 } catch (e) {
  summary.error = e instanceof Error ? e.message : String(e);
 } finally {
  if (browser) await browser.close();
  fs.rmSync(temp, {recursive: true, force: true});
 }
 const text = JSON.stringify(summary, null, 2) + '\n';
 fs.writeFileSync(path.join(args.out, 'shots.json'), text); process.stdout.write(text);
 return summary.ok ? 0 : 1;
}

main().then(code => {process.exitCode = code;}, e => {process.stderr.write(String(e instanceof Error ? e.stack : e) + '\n'); process.exitCode = 1;});
