/// <reference path="../process-contracts.d.ts" />
/**
 * Shared fixture for the Process Studio browser suites (`process-browser.ts` and `process-*-browser.ts`).
 *
 * Every suite runs as its own process: it builds the agency game into its own temporary directory, launches
 * its own browser and opens the studio fresh, so no suite depends on another having run and parallel suites
 * never share a file. Checks inside one suite still run in order on one page; a check that needs a particular
 * studio state establishes it (fresh load, import, process switch, open dialog). After every check the page is
 * returned to the suite's desktop viewport with motion allowed, so a failed check cannot change the geometry
 * that later checks start from.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import type {BrowserContext, Page} from 'playwright';
import {launchBrowser, monitorContext, waitForReady, openArtifact} from './browser-harness';
import {claimsDesk, feedFixture, journeyLine, randomLine} from './process-browser-models';

export const PROJECT = path.resolve(__dirname, '../..'), OUT = path.join(PROJECT, 'verification/v15');
/** The game folder is the authority for how many processes it holds and in which order. */
export const GAME_DIR = path.resolve(PROJECT, '../../docs/concepts/agency-delivery');
export const CLI = path.join(PROJECT, '.generated/tools/wildlands-cli.cjs');
/** The viewport every suite starts at and every check returns to. */
export const DESKTOP = {width: 1440, height: 1060} as const;
/** Routed document URLs: the studio itself, then the pages that reopen downloaded or rebuilt artifacts. */
const FIXTURE_URLS = ['https://localhost/process', 'https://localhost/exported', 'https://localhost/escaped', 'https://localhost/multi-exported', 'https://localhost/single'] as const;

export interface StudioQuery {snapshot: LWProcess.Snapshot; definition: LWProcess.Definition; mode: string; selected: string | null; playing: boolean; horizon: number | null; active: number; processes: {id: string; name: string}[]; presenting: {index: number; count: number; id: string} | null}
export async function query(page: Page): Promise<StudioQuery> {
 return page.evaluate(() => (globalThis as unknown as {LWProcessStudio: {query(): any}}).LWProcessStudio.query());
}

/** Build a game folder into one self-contained HTML file with the generated CLI. */
export function buildGame(game: string, output: string): void {
 const built = spawnSync(process.execPath, [CLI, 'build-game', '--game', game, '--output', output], {encoding: 'utf8', timeout: 300000});
 assert.equal(built.status, 0, built.stderr + built.stdout);
}

/** Page-bound helpers shared by the suites; each one acts only through the studio's own controls and public query. */
function studioHelpers(page: Page, context: BrowserContext, file: string, count: number) {
 const freshStudio = async () => { await openArtifact(page, file, {url: FIXTURE_URLS[0]}); await waitForReady(page, {host: 'process'}); };
 // The Definition editor is a modal (dialog id "de"): these helpers open it from the header, leave it, restore the draft and apply through it.
 const defOpen = page.locator('dialog.de-dialog[open]');
 const openDef = async () => { await page.locator('#open-definition').click(); await defOpen.waitFor(); if (await page.locator('.de-tabs').isVisible()) await page.locator('#de-tab-json').click(); };
 const closeDef = async () => { if (await defOpen.count()) { await page.locator('#de-cancel').click(); await defOpen.waitFor({state: 'hidden'}); } };
 const restoreDef = async () => { await page.locator('#de-restore').click(); await page.locator('#de-restore-confirm').click(); };
 const applyDef = async () => { await page.locator('#de-apply').click(); const reset = page.locator('#de-apply-reset'); if (await reset.isVisible()) await reset.click(); await defOpen.waitFor({state: 'hidden'}); };
 // Exports live in the header's Export menu; Inputs & outputs is a collapsible panel that is closed below 1600px wide until opened.
 const exportVia = async (id: string) => { await page.locator('#export-menu').click(); await page.locator(id).click(); };
 // The panel draws on its toggle event, a task after the click, so wait for its content.
 const showIo = async () => {
  if (!(await page.locator('#io-panel').evaluate((d: HTMLDetailsElement) => d.open))) await page.locator('#io-panel > summary').click();
  await page.locator('#process-data > *').first().waitFor();
 };
 const draftText = () => page.evaluate(() => (document.getElementById('draft') as HTMLTextAreaElement).value);
 const defOf = async () => JSON.parse(await draftText()) as LWProcess.Definition;
 const inSync = () => page.waitForFunction(() => document.getElementById('de-sync')!.textContent === 'Form in sync');
 const dialogOpen = () => page.locator('dialog.pd-dialog[open]').count();
 const activeId = () => page.evaluate(() => document.activeElement?.id ?? '');
 // Switching or importing over a run past minute 0 (or an unapplied draft) asks first; these helpers answer with the confirming choice.
 const asked = page.locator('dialog.ask-dialog[open]');
 const confirmIfAsked = async () => { if (await asked.count()) { await page.locator('#ask-go').click(); await asked.waitFor({state: 'hidden'}); } };
 const switchTo = async (index: number) => {
  const select = page.locator('#process-switch'); await select.focus(); await select.selectOption(String(index));
  const active = (i: number) => (globalThis as unknown as {LWProcessStudio: {query(): {active: number}}}).LWProcessStudio.query().active === i;
  await page.waitForFunction(i => (globalThis as any).LWProcessStudio.query().active === i || !!document.querySelector('dialog.ask-dialog[open]'), index);
  await confirmIfAsked(); await page.waitForFunction(active, index);
 };
 const nameOf = (i: number) => page.evaluate(n => (globalThis as unknown as {LWProcessStudio: {definitions(): {name: string}[]}}).LWProcessStudio.definitions()[n]!.name, i);
 const allNames = async () => { const names: string[] = []; for (let i = 0; i < count; i++) names.push(await nameOf(i)); return names; };
 const applyDraft = async (change: (d: LWProcess.Definition) => void) => {
  await openDef(); const d = JSON.parse(await page.locator('#draft').inputValue()) as LWProcess.Definition; change(d);
  await page.locator('#draft').fill(JSON.stringify(d)); await applyDef();
 };
 const importJson = async (name: string, definition: object) => {
  await page.locator('#file').setInputFiles({name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(definition))});
  const settled = (n: string) => document.getElementById('message')!.textContent!.includes('Imported ' + n)
   || !!document.querySelector('dialog.ask-dialog[open]');
  await page.waitForFunction(settled, name);
  await confirmIfAsked(); await page.waitForFunction(n => document.getElementById('message')!.textContent!.includes('Imported ' + n), name);
 };
 const importFeed = async (extra: object = {}) => { await freshStudio(); await importJson('feed-line.json', feedFixture(extra)); };
 const importRandom = async () => {
  await freshStudio(); const name = 'random-line.json';
  await page.locator('#file').setInputFiles({name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(randomLine()))});
  await page.waitForFunction(n => document.getElementById('message')!.textContent!.includes('Imported ' + n), name);
 };
 const openRandom = async (id: string) => { await page.locator(`[data-step="${id}"]`).click(); await page.locator('#edit-step').click(); await page.locator('dialog.pd-dialog[open]').waitFor(); };
 const savedStep = async (id: string) => (JSON.parse(await draftText()) as LWProcess.Definition).steps.find(s => s.id === id)!;
 const importJourney = async () => {
  await freshStudio(); const name = 'web-shop-journey.json';
  await page.locator('#file').setInputFiles({name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(journeyLine()))});
  await page.waitForFunction(n => document.getElementById('message')!.textContent!.includes('Imported ' + n), name);
 };
 const importClaims = async (rich: boolean, lateFirst = false) => { await freshStudio(); await importJson('claims-desk.json', claimsDesk(rich, lateFirst)); };
 /**
  * Replaces the raw JSON draft the way a person does: select all, then one trusted Ctrl/Cmd+V, which is a single
  * `insertFromPaste` input event. `fill()` types multi-line text as one input event per line (thousands for a formatted
  * definition) and takes seconds per draft, enough to exceed action timeouts on a loaded runner. The real clipboard is
  * used even where a check has stubbed `navigator.clipboard`.
  */
 const pasteDraft = async (text: string) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(t => (Object.getOwnPropertyDescriptor(Navigator.prototype, 'clipboard')!.get!.call(navigator) as Clipboard).writeText(t), text);
  const area = page.locator('#draft'); await area.focus(); await area.press('ControlOrMeta+A'); await area.press('ControlOrMeta+V');
  await page.waitForFunction(t => (document.getElementById('draft') as HTMLTextAreaElement).value === t, text);
 };
 return {freshStudio, defOpen, openDef, closeDef, restoreDef, applyDef, exportVia, showIo, draftText, defOf, inSync, dialogOpen, activeId, switchTo, nameOf, allNames, applyDraft,
  importJson, importFeed, importRandom, openRandom, savedStep, importJourney, importClaims, pasteDraft};
}

export type Studio = ReturnType<typeof studioHelpers> & {
 page: Page; context: BrowserContext; diagnostics: {errors: string[]; consoleProblems: string[]; requests: string[]};
 /** This suite's private temporary directory and the studio HTML built into it. */
 dir: string; file: string; cli: string; gameDir: string; gameDefinitions: string[]; COUNT: number; fixtureUrls: readonly string[];
 check(name: string, work: () => Promise<void>): Promise<void>;
 /** The closing check of a suite: the whole page lifecycle produced no runtime errors, console errors or network requests. */
 checkLifecycle(name: string): Promise<void>;
};

/** Return the page to the desktop viewport (and, after a failure, to allowed motion) without touching an already matching page. */
async function restoreDesktop(page: Page, failed: boolean): Promise<void> {
 const size = page.viewportSize();
 if (!size || size.width !== DESKTOP.width || size.height !== DESKTOP.height) await page.setViewportSize(DESKTOP);
 if (failed) await page.emulateMedia({reducedMotion: 'no-preference'});
}

/**
 * Run one Process Studio browser suite: build, launch, open the studio, run `suite`, and write
 * `verification/v15/<resultFile>`. A failure outside any check is reported under `harness`.
 */
export function runSuite(harness: string, resultFile: string, suite: (studio: Studio) => Promise<void>): void {
 const results: {name: string; passed: boolean; error?: string}[] = [];
 const main = async (): Promise<void> => {
  fs.mkdirSync(OUT, {recursive: true}); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'process-browser-'));
  try {
   const file = path.join(dir, 'process.html'); buildGame(GAME_DIR, file);
   const gameDefinitions = (JSON.parse(fs.readFileSync(path.join(GAME_DIR, 'game.json'), 'utf8')) as {content: {definitions: string[]}}).content.definitions, COUNT = gameDefinitions.length;
   assert(COUNT >= 5, `the agency game holds at least five process definitions (game.json lists ${COUNT})`);
   const browser = await launchBrowser();
   try {
    const context = await browser.newContext({viewport: {...DESKTOP}}), diagnostics = monitorContext(context, {fixtureUrls: FIXTURE_URLS}), page = await context.newPage();
    page.setDefaultTimeout(15000);
    const check = async (name: string, work: () => Promise<void>) => {
     let failed = false;
     try {await work(); results.push({name, passed: true});} catch (e) {failed = true; results.push({name, passed: false, error: String(e)});}
     await restoreDesktop(page, failed);
    };
    const checkLifecycle = (name: string) => check(name, async () => {
     assert.deepEqual(diagnostics.errors, []); assert.deepEqual(diagnostics.requests, []);
     assert.deepEqual(diagnostics.consoleProblems.filter(x => x.startsWith('error:')), []);
    });
    await openArtifact(page, file, {url: FIXTURE_URLS[0]}); await waitForReady(page, {host: 'process'});
    await suite({...studioHelpers(page, context, file, COUNT), page, context, diagnostics, dir, file, cli: CLI, gameDir: GAME_DIR, gameDefinitions, COUNT, fixtureUrls: FIXTURE_URLS, check, checkLifecycle});
   } finally {await browser.close();}
  } finally {fs.rmSync(dir, {recursive: true, force: true});}
 };
 main().catch(e => results.push({name: harness, passed: false, error: String(e)})).finally(() => {
  fs.mkdirSync(OUT, {recursive: true}); const report = {passed: results.filter(r => r.passed).length, total: results.length, results};
  fs.writeFileSync(path.join(OUT, resultFile), JSON.stringify(report, null, 2)); console.log(`${report.passed}/${report.total}`);
  if (!results.length || report.passed !== report.total) process.exitCode = 1;
 });
}
