/// <reference path="../process-contracts.d.ts" />
/** Offline acceptance: import atomicity, two projections, downloads and responsive geometry. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {launchBrowser, monitorContext, waitForReady, openArtifact, nextFrames} from './browser-harness';
import type {Page} from 'playwright';
const PROJECT = path.resolve(__dirname, '../..'), OUT = path.join(PROJECT, 'verification/v15');
const results: {name: string; passed: boolean; error?: string}[] = [];
async function check(name: string, work: () => Promise<void>): Promise<void> {try {await work(); results.push({name, passed: true});} catch (e) {results.push({name, passed: false, error: String(e)});}}
async function query(page: Page): Promise<{snapshot: LWProcess.Snapshot; definition: LWProcess.Definition; mode: string; selected: string | null; playing: boolean; horizon: number | null; active: number; processes: {id: string; name: string}[]}> {
 return page.evaluate(() => (globalThis as unknown as {LWProcessStudio: {query(): any}}).LWProcessStudio.query());
}
async function main(): Promise<void> {
 fs.mkdirSync(OUT, {recursive: true}); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'process-browser-'));
 const file = path.join(dir, 'process.html'), cli = path.join(PROJECT, '.generated/tools/wildlands-cli.cjs');
 const built = spawnSync(process.execPath, [cli, 'build-game', '--game', path.resolve(PROJECT, '../../docs/concepts/agency-delivery'), '--output', file], {encoding: 'utf8', timeout: 300000});
 assert.equal(built.status, 0, built.stderr + built.stdout);
 // The game folder is the authority for how many processes it holds and in which order.
 const gameDir = path.resolve(PROJECT, '../../docs/concepts/agency-delivery'), gameDefinitions = (JSON.parse(fs.readFileSync(path.join(gameDir, 'game.json'), 'utf8')) as {content: {definitions: string[]}}).content.definitions, COUNT = gameDefinitions.length;
 assert(COUNT >= 5, 'the agency game holds three business processes and two journeys');
 const fixtureUrls = ['https://localhost/process', 'https://localhost/exported', 'https://localhost/escaped', 'https://localhost/multi-exported', 'https://localhost/single'];
 const browser = await launchBrowser(), context = await browser.newContext({viewport: {width: 1440, height: 1060}}), diagnostics = monitorContext(context, {fixtureUrls}), page = await context.newPage();
 page.setDefaultTimeout(15000);
 try {
  await openArtifact(page, file, {url: fixtureUrls[0]!}); await waitForReady(page, {host: 'process'});
  // The Definition editor is a modal (dialog id "de"): these helpers open it from the header, leave it, restore the draft and apply through it.
  const defOpen = page.locator('dialog.de-dialog[open]');
  const openDef = async () => { await page.locator('#open-definition').click(); await defOpen.waitFor(); if (await page.locator('.de-tabs').isVisible()) await page.locator('#de-tab-json').click(); };
  const closeDef = async () => { if (await defOpen.count()) { await page.locator('#de-cancel').click(); await defOpen.waitFor({state: 'hidden'}); } };
  const restoreDef = async () => { await page.locator('#de-restore').click(); await page.locator('#de-restore-confirm').click(); };
  const applyDef = async () => { await page.locator('#de-apply').click(); const reset = page.locator('#de-apply-reset'); if (await reset.isVisible()) await reset.click(); await defOpen.waitFor({state: 'hidden'}); };
  // Exports live in the header's Export menu; Inputs & outputs is a collapsible panel that is closed below 1600px wide until opened.
  const exportVia = async (id: string) => { await page.locator('#export-menu').click(); await page.locator(id).click(); };
  const showIo = async () => { if (!(await page.locator('#io-panel').evaluate((d: HTMLDetailsElement) => d.open))) await page.locator('#io-panel > summary').click(); };
  await check('Process artifact starts paused with one selectable scene per step and real WebGL', async () => {
   const q = await query(page); assert.equal(q.snapshot.minute, 0); assert.equal(q.playing, false); assert.equal(q.mode, '3d');
   assert.equal(await page.locator('[data-step]').count(), q.definition.steps.length);
   assert.equal(await page.locator('#canvas').isVisible(), true);
   assert(await page.evaluate(() => !!(document.getElementById('canvas') as HTMLCanvasElement).getContext('webgl2')));
  });
  await check('2D and 3D scene navigation preserves the same simulation state', async () => {
   await page.locator('#advance').click(); const before = (await query(page)).snapshot;
   await page.locator('#mode-2d').click(); assert.equal(await page.locator('#map svg').count(), 1);
   await page.locator('[data-step="product-design"]').click(); assert.equal((await query(page)).selected, 'product-design');
   await page.locator('#mode-3d').click(); assert.deepEqual((await query(page)).snapshot, before);
   await page.locator('#overview').click();
  });
  await check('Both views display captured inputs, expected effects and observed outputs', async () => {
   await showIo(); await page.locator('#reset').click(); await page.locator('[data-step="discovery"]').click();
   assert.match(await page.locator('#process-data').innerText(), /Step inputs/);
   assert.match(await page.locator('#process-data').innerText(), /Expected changes/);
   const before = (await query(page)).snapshot;
   await page.locator('#mode-2d').click(); assert.deepEqual((await query(page)).snapshot, before);
   assert.match(await page.locator('#process-data').innerText(), /needsRework/);
   await page.locator('#advance').click(); assert.match(await page.locator('#process-data').innerText(), /Step outputs/);
   await page.locator('#process-written-toggle').click();
   await page.locator('#mode-3d').click(); await page.locator('#step').click();
   assert.equal(await page.locator('.process-written').evaluate((e: HTMLDetailsElement) => e.open), true);
   await page.locator('#mode-2d').click();
   await page.locator('#overview').click(); assert.match(await page.locator('#process-data').innerText(), /Process inputs/);
   for (let i = 0; i < 10; i++) if (!(await page.locator('#advance').isDisabled())) await page.locator('#advance').click();
   assert.match(await page.locator('#process-data').innerText(), /Process outputs/);
   assert.match(await page.locator('#message').innerText(), /Run completed.*Export the report/);
   assert.match(await page.locator('#play').getAttribute('title') ?? '', /reset/);
   const reworked = (await query(page)).snapshot.receipts.find(r => r.stepId === 'rework')!;
   await page.locator('#process-case').selectOption(reworked.caseId);
   await page.locator('[data-step="qa"]').click(); assert.equal(await page.locator('#process-visit option').count(), 3);
   await page.locator('#process-visit').selectOption({index: 1}); assert.match(await page.locator('#process-data').innerText(), /Completed/);
   await page.locator('#reset').click(); await page.locator('#overview').click(); await page.locator('#mode-3d').click();
  });
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
  await check('Cameras pan and zoom without ticking, run length is configurable and tuned values apply on request', async () => {
   await page.locator('#reset').click(); await page.locator('#overview').click(); const before = await query(page);
   await page.locator('#mode-3d').click(); const canvas = (await page.locator('#canvas').boundingBox())!;
   const shot = async () => (await page.locator('#canvas').screenshot()).toString('base64');
   const still = await shot(); await page.mouse.move(canvas.x + 300, canvas.y + 200); await page.mouse.down({button: 'right'}); await page.mouse.move(canvas.x + 200, canvas.y + 150, {steps: 4}); await page.mouse.up({button: 'right'});
   await nextFrames(page); assert.notEqual(await shot(), still); await page.locator('#frame').click();
   await page.locator('#mode-2d').click(); const box = (await page.locator('#map').boundingBox())!, viewBox = () => page.locator('#map svg').getAttribute('viewBox');
   const fitted = await viewBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.wheel(0, -500); const zoomed = await viewBox(); assert.notEqual(zoomed, fitted);
   await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 40, {steps: 4}); await page.mouse.up(); assert.notEqual(await viewBox(), zoomed);
   await page.locator('#frame').click(); assert.equal(await viewBox(), fitted); assert.deepEqual((await query(page)).snapshot, before.snapshot);
   await page.locator('#horizon').selectOption('unlimited'); assert.equal((await query(page)).horizon, null); await page.locator('#horizon').selectOption('1440'); assert.equal((await query(page)).horizon, 1440);
   await page.locator('[data-step="discovery"]').click(); await page.locator('#edit-step').click();
   await page.locator('#se-duration').fill('77'); await page.locator('#se-save').click();
   assert.deepEqual((await query(page)).definition, before.definition); assert.match(await page.evaluate(() => (document.getElementById('draft') as HTMLTextAreaElement).value), /"duration": 77/);
   await openDef(); await applyDef(); const applied = await query(page); assert.equal(applied.definition.steps.find(s => s.kind === 'task')!.duration, 77); assert.equal(applied.horizon, 1440); assert.equal(applied.snapshot.minute, 0);
   await page.locator('#horizon').selectOption('100000');
  });
  await check('Backlogs and step needs are visible in the inspector and editable in the tuning form', async () => {
   await page.locator('#reset').click(); const before = await query(page);
   await page.locator('[data-step="design-ready"]').click(); const backlog = await page.locator('#inspector').innerText(); assert.match(backlog, /Items \/ capacity/); assert.match(backlog, /Highest priority first/); assert.match(backlog, /Pull limit/);
   await page.locator('[data-step="implementation"]').click(); const needs = await page.locator('#inspector').innerText(); assert.match(needs, /Needs from earlier steps/); assert.match(needs, /requirementsReady = true/); assert.match(needs, /Delivered by Product design/);
   const draftOf = async () => JSON.parse(await page.evaluate(() => (document.getElementById('draft') as HTMLTextAreaElement).value)) as LWProcess.Definition;
   await page.locator('[data-step="design-ready"]').click(); await page.locator('#edit-step').click();
   await page.locator('#se-backlog-capacity').fill('2'); await page.locator('#se-backlog-order').selectOption('lifo'); assert.equal(await page.locator('#se-backlog-priority').count(), 0); await page.locator('#se-save').click();
   const lifo = (await draftOf()).steps.find(s => s.id === 'design-ready')!.backlog!; assert.equal(lifo.capacity, 2); assert.equal(lifo.order, 'lifo'); assert.equal(lifo.priority, undefined);
   await page.locator('[data-step="handover"]').click(); await page.locator('#edit-step').click();
   await page.locator('#se-add-need').click(); await page.locator('[data-bind="needs.2.field"]').fill('qaSignoff'); await page.locator('#se-save').click(); assert.equal((await draftOf()).steps[10]!.needs!.length, 3);
   await page.locator('#edit-step').click(); await page.locator('[data-act="remove-need"]').last().click(); await page.locator('#se-save').click(); assert.equal((await draftOf()).steps[10]!.needs!.length, 2);
   await page.locator('[data-step="design-ready"]').click(); await page.locator('#edit-step').click(); await page.locator('#se-backlog-on').uncheck(); await page.locator('#se-save').click(); assert.equal((await draftOf()).steps[5]!.backlog, undefined);
   assert.deepEqual((await query(page)).definition, before.definition); await openDef(); await restoreDef(); await closeDef();
  });
  await check('BPMN 2.0 export imports losslessly in the browser and foreign or unsupported BPMN reports explicit notes or rejects', async () => {
   await page.locator('#reset').click(); const before = await query(page);
   const pending = page.waitForEvent('download'); await exportVia('#bpmn'); const download = await pending, bpmnFile = path.join(dir, 'export.bpmn'); await download.saveAs(bpmnFile);
   const xml = fs.readFileSync(bpmnFile, 'utf8'); assert.match(xml, /<bpmn:definitions /); assert.match(xml, /<bpmndi:BPMNShape /); assert.equal(download.suggestedFilename(), before.definition.id + '.bpmn');
   await page.locator('#file').setInputFiles(bpmnFile); await page.waitForFunction(() => document.getElementById('message')!.textContent!.includes('Imported export.bpmn'));
   assert.deepEqual((await query(page)).definition, before.definition); assert.equal((await query(page)).snapshot.minute, 0);
   const model = 'xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"';
   const foreign = `<bpmn:definitions ${model}><bpmn:process id="P" name="Small"><bpmn:startEvent id="S"><bpmn:outgoing>A</bpmn:outgoing></bpmn:startEvent><bpmn:task id="T" name="Work"><bpmn:incoming>A</bpmn:incoming><bpmn:outgoing>B</bpmn:outgoing></bpmn:task><bpmn:endEvent id="E"/><bpmn:sequenceFlow id="A" sourceRef="S" targetRef="T"/><bpmn:sequenceFlow id="B" sourceRef="T" targetRef="E"/></bpmn:process></bpmn:definitions>`;
   await page.locator('#file').setInputFiles({name: 'small.bpmn', mimeType: 'application/xml', buffer: Buffer.from(foreign)});
   await page.waitForFunction(() => document.getElementById('message')!.textContent!.includes('Imported small.bpmn')); assert.match(await page.locator('#message').innerText(), /import note/);
   assert.equal((await query(page)).definition.name, 'Small'); assert.equal((await query(page)).definition.steps.length, 3);
   const kept = await query(page);
   await page.locator('#file').setInputFiles({name: 'nested.bpmn', mimeType: 'application/xml', buffer: Buffer.from(foreign.replace('<bpmn:endEvent', '<bpmn:subProcess id="X"/><bpmn:endEvent'))});
   await page.waitForFunction(() => document.getElementById('message')!.textContent!.includes('Import rejected')); assert.match(await page.locator('#message').innerText(), /subProcess X/); assert.deepEqual(await query(page), kept);
   await page.locator('#file').setInputFiles(bpmnFile); await page.waitForFunction(() => document.getElementById('process-title')!.textContent === 'Agency delivery lab');
  });
  await check('Keyboard scene selection retains focus across detached view refreshes', async () => {
   await page.locator('[data-step="discovery"]').focus(); await page.keyboard.press('Enter');
   assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.step), 'discovery');
   await page.locator('#mode-2d').click(); await page.locator('#process-map-discovery').focus(); await page.keyboard.press('Enter');
   assert.equal(await page.evaluate(() => document.activeElement?.id), 'process-map-discovery');
   await page.locator('#overview').click();
  });
  await check('Run and pause controls advance only the owned process clock', async () => {
   await page.locator('#reset').click(); const before = (await query(page)).snapshot.minute; await page.locator('#play').click();
   await page.waitForFunction(minute => (globalThis as unknown as {LWProcessStudio: {query(): {snapshot: {minute: number}}}}).LWProcessStudio.query().snapshot.minute > minute, before);
   await page.locator('#play').click(); assert.equal((await query(page)).playing, false);
   await page.locator('#step').click(); assert.equal((await query(page)).playing, false);
  });
  await check('Invalid JSON import preserves the active definition and run', async () => {
   const before = await query(page);
   await page.locator('#file').setInputFiles({name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"wrong"}')});
   await page.waitForFunction(() => document.getElementById('message')!.textContent!.includes('Import rejected'));
   assert.deepEqual(await query(page), before);
  });
  await check('Definition editor validates before applying and resets a valid edit explicitly', async () => {
   await openDef(); const before = await query(page);
   await page.locator('#draft').fill('{bad'); await page.locator('#de-apply').click(); assert.deepEqual((await query(page)).snapshot, before.snapshot);
   assert.equal(await defOpen.count(), 1, 'an invalid draft is refused and the editor stays open'); assert.equal(await page.locator('#de-status').getAttribute('role'), 'alert'); assert.match(await page.locator('#de-status').innerText(), /cannot be applied yet.*line 1, column 2/s);
   const d = before.definition; d.name = 'Reviewed agency process';
   await page.locator('#draft').fill(JSON.stringify(d)); await page.locator('#de-validate').click(); assert.match(await page.locator('#de-message').innerText(), /^Valid definition\. Applying starts a fresh paused run\.$/);
   await applyDef(); const next = await query(page); assert.equal(next.snapshot.minute, 0); assert.equal(next.definition.revision, before.definition.revision + 1); assert.equal(next.playing, false);
  });
  await check('Unapplied drafts export losslessly without changing the active process or retaining stale validation', async () => {
   await openDef(); const before = await query(page);
   await page.locator('#de-validate').click(); assert.match(await page.locator('#de-message').innerText(), /Valid definition/);
   const raw = '{\n  "unfinished":'; await page.locator('#draft').fill(raw);
   assert.equal(await page.locator('#de-message').innerText(), '', 'a stale validation result is cleared by the next edit'); assert.equal(await page.locator('#de-chip').innerText(), 'Unapplied draft');
   assert.match(await page.locator('#draft-state').innerText(), /Invalid JSON: line 2, column \d+/);
   await page.locator('#de-validate').click(); assert.equal(await page.locator('#draft').getAttribute('aria-invalid'), 'true');
   let pending = page.waitForEvent('download'); await page.locator('#de-export').click(); let saved = await pending;
   const draftFile = path.join(dir, 'unfinished.json'); await saved.saveAs(draftFile); assert.equal(fs.readFileSync(draftFile, 'utf8'), raw);
   await closeDef(); assert.match(await page.locator('#draft-chip').innerText(), /^Unapplied draft/);
   pending = page.waitForEvent('download'); await exportVia('#json'); saved = await pending;
   const activeFile = path.join(dir, 'active.json'); await saved.saveAs(activeFile); assert.deepEqual(JSON.parse(fs.readFileSync(activeFile, 'utf8')), before.definition);
   assert.deepEqual(await query(page), before);
   await openDef(); assert.equal(await page.locator('#draft').inputValue(), raw);
   await restoreDef(); assert.equal(await page.locator('#draft').getAttribute('aria-invalid'), null);
   assert.match(await page.locator('#draft-state').innerText(), /matches the running definition/); await closeDef(); assert.equal(await page.locator('#draft-chip').isHidden(), true);
  });
  await check('Browser exported JSON imports losslessly and report binds definition to observed metrics', async () => {
   let pending = page.waitForEvent('download'); await exportVia('#json'); let download = await pending; const jsonFile = path.join(dir, 'export.json'); await download.saveAs(jsonFile);
   const definition = (await query(page)).definition; assert.deepEqual(JSON.parse(fs.readFileSync(jsonFile, 'utf8')), definition);
   await page.locator('#advance').click(); pending = page.waitForEvent('download'); await exportVia('#report'); download = await pending; const reportFile = path.join(dir, 'report.json'); await download.saveAs(reportFile);
   const report = JSON.parse(fs.readFileSync(reportFile, 'utf8')); assert.equal(report.snapshot.minute, 30); assert.deepEqual(report.definition, definition);
   await page.locator('#file').setInputFiles(jsonFile); await page.waitForFunction(() => document.getElementById('message')!.textContent!.includes('Imported'));
   assert.deepEqual((await query(page)).definition, definition); assert.equal((await query(page)).snapshot.minute, 0);
  });
  await check('Downloaded self-contained HTML reopens offline with the edited definition and no requests', async () => {
   const pending = page.waitForEvent('download'); await exportVia('#html'); const download = await pending, exported = path.join(dir, 'exported.html'); await download.saveAs(exported);
   const other = await context.newPage(); await openArtifact(other, exported, {url: fixtureUrls[1]!}); await waitForReady(other, {host: 'process'});
   assert.deepEqual((await query(other)).definition, (await query(page)).definition); assert.equal((await query(other)).snapshot.minute, 0);
   assert.equal(await other.locator('#process-title').count(), 1); await other.close(); assert.deepEqual(diagnostics.requests, []);
  });
  await check('Imported text renders inertly and survives escaped standalone HTML export', async () => {
   const d = (await query(page)).definition; d.name = '</script><img src=x onerror=alert(1)>';
   await page.locator('#file').setInputFiles({name: 'text.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(d))});
   await page.waitForFunction(() => document.getElementById('process-title')!.textContent!.startsWith('</script>'));
   assert.equal(await page.locator('img').count(), 0); const pending = page.waitForEvent('download'); await exportVia('#html'); const download = await pending, escaped = path.join(dir, 'escaped.html'); await download.saveAs(escaped);
   const other = await context.newPage(); await openArtifact(other, escaped, {url: fixtureUrls[2]!}); await waitForReady(other, {host: 'process'}); assert.equal((await query(other)).definition.name, d.name); await other.close();
  });
  await check('Desktop and mobile reflow retain controls without horizontal overflow', async () => {
   await openArtifact(page, file, {url: fixtureUrls[0]!}); await waitForReady(page, {host: 'process'});
   await page.locator('[data-step="discovery"]').click(); await page.locator('#step').click(); await nextFrames(page);
   await page.screenshot({path: path.join(OUT, 'process-desktop.png'), fullPage: true});
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
   await page.setViewportSize({width: 390, height: 844}); await page.screenshot({path: path.join(OUT, 'process-mobile.png'), fullPage: true});
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
   await page.locator('#mode-2d').click(); assert.equal(await page.locator('#map').isVisible(), true);
   await page.screenshot({path: path.join(OUT, 'process-mobile-2d.png'), fullPage: true});
   await page.setViewportSize({width: 900, height: 900}); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
   const long = (await query(page)).definition; long.name = 'LongProcessName'.repeat(8); long.steps[0]!.name = 'LongStepName'.repeat(7);
   await page.locator('#file').setInputFiles({name: 'long-labels.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(long))});
   await page.waitForFunction(name => document.getElementById('process-title')!.textContent === name, long.name);
   await page.locator('[data-step]').first().click();
   for (const width of [1440, 900, 390]) {await page.setViewportSize({width, height: 900}); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);}
   await page.setViewportSize({width: 1440, height: 1060});
  });
  const switchTo = async (index: number) => {
   const select = page.locator('#process-switch'); await select.focus(); await select.selectOption(String(index));
   await page.waitForFunction(i => (globalThis as unknown as {LWProcessStudio: {query(): {active: number}}}).LWProcessStudio.query().active === i, index);
  };
  const allNames = async () => { const names: string[] = []; for (let i = 0; i < COUNT; i++) names.push(await nameOf(i)); return names; };
  const nameOf = (i: number) => page.evaluate(n => (globalThis as unknown as {LWProcessStudio: {definitions(): {name: string}[]}}).LWProcessStudio.definitions()[n]!.name, i);
  const applyDraft = async (change: (d: LWProcess.Definition) => void) => {
   await openDef(); const d = JSON.parse(await page.locator('#draft').inputValue()) as LWProcess.Definition; change(d);
   await page.locator('#draft').fill(JSON.stringify(d)); await applyDef();
  };
  await check('Process switch lists each process of a multi-process game, switches without ticking and stays hidden for one process', async () => {
   await openArtifact(page, file, {url: fixtureUrls[0]!}); await waitForReady(page, {host: 'process'});
   const first = await query(page); assert.equal(first.active, 0); assert.equal(first.processes.length, COUNT);
   assert.equal(await page.locator('#process-switch-label').isVisible(), true); assert.match(await page.locator('#process-switch-label').innerText(), /^Process/);
   assert.equal(await page.evaluate(() => (document.getElementById('process-switch') as HTMLSelectElement).labels![0]!.id), 'process-switch-label');
   assert.equal(await page.locator('#process-switch option').count(), COUNT); assert.equal(await page.locator('#process-switch').inputValue(), '0');
   assert.deepEqual(await page.locator('#process-switch option').allInnerTexts(), first.processes.map(p => p.name));
   assert.match(await page.locator('#process-subtitle').innerText(), new RegExp(`Process 1 of ${COUNT}$`));
   assert.equal(await page.locator('#process-title').innerText(), first.definition.name); assert.equal(await page.locator('[data-step]').count(), first.definition.steps.length);
   await page.locator('#mode-2d').click(); await page.locator('#horizon').selectOption('1440'); await page.locator('#advance').click(); await page.locator('[data-step="discovery"]').click();
   assert.equal((await query(page)).snapshot.minute, 30);
   await page.locator('#play').click(); await page.waitForFunction(() => (globalThis as unknown as {LWProcessStudio: {query(): {snapshot: {minute: number}}}}).LWProcessStudio.query().snapshot.minute > 30);
   await page.locator('#process-switch').focus(); await page.keyboard.press('ArrowDown');
   await page.waitForFunction(() => (globalThis as unknown as {LWProcessStudio: {query(): {active: number}}}).LWProcessStudio.query().active === 1);
   const second = await query(page); await nextFrames(page);
   assert.equal(second.processes[1]!.name, second.definition.name); assert.notEqual(second.definition.id, first.definition.id);
   assert.equal(second.snapshot.minute, 0); assert.equal(second.playing, false); assert.equal(second.selected, null); assert.equal(second.mode, '2d'); assert.equal(second.horizon, 1440);
   assert.equal((await query(page)).snapshot.minute, 0, 'Switching never ticks the new session');
   assert.equal(await page.locator('#process-title').innerText(), second.definition.name); assert.equal(await page.locator('[data-step]').count(), second.definition.steps.length);
   assert.notEqual(second.definition.steps.length, first.definition.steps.length);
   assert.equal(await page.evaluate(() => (globalThis as unknown as {LWProcessStudio: {definition(): {id: string}}}).LWProcessStudio.definition().id), second.definition.id);
   assert.equal(await page.evaluate(() => document.activeElement?.id), 'process-switch');
   assert.equal(await page.locator('#message').innerText(), `Switched to ${second.definition.name}. Paused at minute 0.`);
   assert.equal(await page.locator('#map svg').count(), 1); assert.match(await page.locator('#process-subtitle').innerText(), new RegExp(`Process 2 of ${COUNT}$`));
   await showIo(); assert.match(await page.locator('#process-data').innerText(), /Process inputs/);
   // A one-process game has no switch.
   const single = path.join(dir, 'single', 'agency-delivery'), singleHtml = path.join(dir, 'single.html'), source = gameDir;
   fs.cpSync(source, single, {recursive: true}); for (const extra of gameDefinitions.slice(1)) fs.rmSync(path.join(single, extra));
   const manifest = JSON.parse(fs.readFileSync(path.join(single, 'game.json'), 'utf8')); manifest.content = {definition: gameDefinitions[0]}; fs.writeFileSync(path.join(single, 'game.json'), JSON.stringify(manifest, null, 2) + '\n');
   const made = spawnSync(process.execPath, [cli, 'build-game', '--game', single, '--output', singleHtml], {encoding: 'utf8', timeout: 300000}); assert.equal(made.status, 0, made.stderr + made.stdout);
   const other = await context.newPage(); await openArtifact(other, singleHtml, {url: fixtureUrls[4]!}); await waitForReady(other, {host: 'process'});
   assert.equal(await other.locator('#process-switch-label').isVisible(), false); assert.equal(await other.locator('#process-subtitle').innerText(), 'Wildlands · Process Studio');
   assert.equal((await query(other)).processes.length, 1); await other.close();
  });
  await check('Editing one process survives switching away and back with its applied definition and unapplied draft', async () => {
   await openArtifact(page, file, {url: fixtureUrls[0]!}); await waitForReady(page, {host: 'process'});
   const original = await allNames(), before = await query(page);
   await applyDraft(d => {d.name = 'Edited agency';}); assert.equal((await query(page)).definition.revision, before.definition.revision + 1);
   await openDef(); const raw = '{\n  "unfinished":'; await page.locator('#draft').fill(raw); await closeDef();
   await switchTo(1); assert.equal(await page.locator('#process-title').innerText(), original[1]); assert.equal(await page.locator('#draft-chip').isHidden(), true);
   assert.equal(await page.locator('#process-switch option').first().innerText(), 'Edited agency'); assert.equal(await nameOf(0), 'Edited agency'); assert.equal((await query(page)).snapshot.minute, 0);
   // Import replaces only the active process, in place.
   const vendor = (await query(page)).definition; vendor.name = 'Imported vendor';
   await page.locator('#file').setInputFiles({name: 'vendor.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(vendor))});
   await page.waitForFunction(() => document.getElementById('message')!.textContent!.includes('Imported vendor.json'));
   assert.deepEqual(await page.locator('#process-switch option').allInnerTexts(), ['Edited agency', 'Imported vendor', ...original.slice(2)]); assert.equal((await query(page)).active, 1);
   await switchTo(0); assert.equal(await page.locator('#process-title').innerText(), 'Edited agency'); assert.equal((await query(page)).definition.revision, before.definition.revision + 1);
   assert.equal(await page.locator('#draft').inputValue(), raw); assert.match(await page.locator('#draft-chip').innerText(), /^Unapplied draft/);
   assert.equal((await query(page)).snapshot.minute, 0); assert.equal((await query(page)).playing, false);
  });
  await check('Downloaded HTML of a multi-process game reopens with every process in order and the applied edits', async () => {
   await openArtifact(page, file, {url: fixtureUrls[0]!}); await waitForReady(page, {host: 'process'});
   const names = await allNames(); await switchTo(1); await applyDraft(d => {d.name = 'Edited vendor';});
   const pending = page.waitForEvent('download'); await exportVia('#html'); const download = await pending, exported = path.join(dir, 'multi-exported.html'); await download.saveAs(exported);
   const text = fs.readFileSync(exported, 'utf8'); assert.equal(download.suggestedFilename(), 'wildlands-processes.html');
   assert.equal((text.match(/^window\.LWProcessDefinition = /gm) ?? []).length, 1); assert.equal((text.match(/^window\.LWProcessDefinitions = /gm) ?? []).length, 1);
   const other = await context.newPage(); await openArtifact(other, exported, {url: fixtureUrls[3]!}); await waitForReady(other, {host: 'process'});
   const reopened = await query(other); assert.deepEqual(reopened.processes.map(p => p.name), [names[0], 'Edited vendor', ...names.slice(2)]); assert.equal(reopened.active, 0); assert.equal(reopened.snapshot.minute, 0);
   assert.equal(reopened.definition.name, names[0]); assert.equal(await other.locator('#process-switch option').count(), COUNT);
   const listed = await other.evaluate(() => (globalThis as unknown as {LWProcessStudio: {definitions(): LWProcess.Definition[]}}).LWProcessStudio.definitions());
   assert.deepEqual(listed, await page.evaluate(() => (globalThis as unknown as {LWProcessStudio: {definitions(): LWProcess.Definition[]}}).LWProcessStudio.definitions()));
   await other.locator('#process-switch').selectOption('1'); await other.waitForFunction(() => document.getElementById('process-title')!.textContent === 'Edited vendor');
   assert.equal((await query(other)).snapshot.minute, 0); await other.close(); assert.deepEqual(diagnostics.requests, []);
  });
  await check('Process switch reflows at phone width without horizontal overflow and wraps long names', async () => {
   await openArtifact(page, file, {url: fixtureUrls[0]!}); await waitForReady(page, {host: 'process'});
   await switchTo(1); await applyDraft(d => {d.name = 'LongProcessName'.repeat(8);});
   for (const width of [390, 900, 1440]) {
    await page.setViewportSize({width, height: 900}); await nextFrames(page);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'width ' + width);
    const box = (await page.locator('#process-switch').boundingBox())!; assert(box.x >= 0 && box.x + box.width <= width, 'switch inside viewport at ' + width);
    assert.equal(await page.locator('#process-switch-label').isVisible(), true);
   }
   await page.setViewportSize({width: 390, height: 844}); await page.screenshot({path: path.join(OUT, 'process-switch-mobile.png'), fullPage: true});
   await switchTo(0); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
   await page.setViewportSize({width: 1440, height: 1060});
  });
  const timerFixture = (d: LWProcess.Definition) => {
   const scene = (id: string, x: number) => ({id: 'scene-' + id, position: [x, 0] as [number, number], color: '#91b9d5'});
   Object.assign(d, {id: 'timer-fixture', name: 'Timer fixture', description: 'Counter loop task, a duration timer, an until timer and an end.', start: 'begin', resources: [], arrivals: [{at: 0, count: 1, interval: 0, data: {}}],
    steps: [{id: 'begin', name: 'Begin', kind: 'start', scene: scene('begin', 0)}, {id: 'loop', name: 'Count a pass', kind: 'task', duration: 5, add: {iteration: 1}, scene: scene('loop', 14)},
     {id: 'wait', name: 'Wait for review window', kind: 'timer', duration: 30, add: {waits: 1}, scene: scene('wait', 28)}, {id: 'until', name: 'Hold until contract date', kind: 'timer', until: 200, scene: scene('until', 42)}, {id: 'finish', name: 'Finish', kind: 'end', scene: scene('finish', 56)}],
    flows: [{id: 'f1', from: 'begin', to: 'loop'}, {id: 'f2', from: 'loop', to: 'wait'}, {id: 'f3', from: 'wait', to: 'until'}, {id: 'f4', from: 'until', to: 'finish'}]});
  };
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
  const draftText = () => page.evaluate(() => (document.getElementById('draft') as HTMLTextAreaElement).value);
  const freshStudio = async () => { await openArtifact(page, file, {url: fixtureUrls[0]!}); await waitForReady(page, {host: 'process'}); };
  const dialogOpen = () => page.locator('dialog.pd-dialog[open]').count();
  const activeId = () => page.evaluate(() => document.activeElement?.id ?? '');
  await check('Step editor opens as a modal from the inspector, traps focus, closes with Escape and restores the invoker focus', async () => {
   await freshStudio(); await page.locator('[data-step="discovery"]').click();
   await page.locator('#edit-step').focus(); await page.keyboard.press('Enter');
   const dialog = page.getByRole('dialog', {name: 'Discovery'}); await dialog.waitFor(); assert.equal(await dialogOpen(), 1);
   assert.equal(await page.evaluate(() => document.querySelector('dialog.pd-dialog[open]')!.matches(':modal')), true);
   assert.equal(await page.locator('#se-title').innerText(), 'Discovery'); assert.equal(await page.locator('#se-chip').innerText(), 'task'); assert.equal(await page.locator('#se-meta').innerText(), 'discovery');
   assert.equal(await activeId(), 'se-name'); assert.equal((await query(page)).selected, 'discovery');
   await assert.rejects(page.locator('#play').click({timeout: 700}), 'the page behind the modal is inert');
   for (let i = 0; i < 70; i++) { await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => !!document.activeElement?.closest('dialog.pd-dialog')), true, 'forward Tab stays inside at ' + i); }
   for (let i = 0; i < 6; i++) { await page.keyboard.press('Shift+Tab'); assert.equal(await page.evaluate(() => !!document.activeElement?.closest('dialog.pd-dialog')), true, 'Shift+Tab stays inside'); }
   assert.equal(await page.getByRole('button', {name: 'Close'}).count(), 1);
   await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 0); assert.equal(await activeId(), 'edit-step');
   await page.locator('#edit-step').focus(); await page.keyboard.press('Enter'); await dialog.waitFor(); await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 0); assert.equal(await activeId(), 'edit-step');
   await page.locator('#edit-step').click(); await page.locator('#se-close').click(); assert.equal(await dialogOpen(), 0); assert.equal(await activeId(), 'edit-step');
   await page.locator('#overview').click(); assert.equal(await page.locator('#edit-step').isHidden(), true);
   // Opening from a running simulation pauses it and the clock stays put while the editor is open.
   await page.locator('[data-step="discovery"]').click(); await page.locator('#horizon').selectOption('1440'); await page.locator('#play').click();
   await page.waitForFunction(() => (globalThis as unknown as {LWProcessStudio: {query(): {snapshot: {minute: number}}}}).LWProcessStudio.query().snapshot.minute > 0);
   await page.locator('#edit-step').click(); await dialog.waitFor(); const frozen = await query(page); assert.equal(frozen.playing, false); await nextFrames(page, 45);
   assert.equal((await query(page)).snapshot.minute, frozen.snapshot.minute); assert.match(await page.locator('#se-subtitle').innerText(), /paused/);
   await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 0);
  });
  await check('Step editor edits timing, resources, completion effects and flow conditions and applies a fresh paused run', async () => {
   await freshStudio(); await page.locator('#advance').click(); assert.equal((await query(page)).snapshot.minute, 30); const before = await query(page);
   await page.locator('[data-step="discovery"]').click(); await page.locator('#edit-step').click();
   await page.locator('#se-name').fill('Discovery workshop'); await page.locator('#se-duration').fill('20'); await page.locator('#se-cost').fill('12');
   assert.match(await page.locator('#se-needs-summary').innerText(), /^Needs: 1 Product owner$/);
   await page.locator('dialog.pd-dialog[open]').getByLabel('Business analysts').fill('2'); assert.match(await page.locator('#se-needs-summary').innerText(), /^Needs: 1 Product owner, 2 Business analysts$/);
   await page.locator('#se-add-set').click(); await page.locator('[data-bind="set.1.key"]').fill('budgetApproved');
   await page.locator('#se-add-set').click(); await page.locator('[data-bind="set.2.key"]').fill('clientTone'); await page.locator('[data-bind="set.2.value.type"]').selectOption('text'); await page.locator('[data-bind="set.2.value.text"]').fill('calm');
   await page.locator('#se-add-add').click(); await page.locator('[data-bind="add.0.key"]').fill('attempts'); await page.locator('[data-bind="add.0.delta"]').fill('-2');
   await page.locator('#se-save').click(); assert.equal(await dialogOpen(), 0); assert.equal(await page.locator('#message').innerText(), 'Saved to the draft. Apply the draft to start a fresh run.');
   assert.deepEqual((await query(page)).definition, before.definition); assert.equal((await query(page)).snapshot.minute, 30);
   const saved = JSON.parse(await draftText()) as LWProcess.Definition, discovery = saved.steps[1]!;
   assert.equal(discovery.name, 'Discovery workshop'); assert.equal(discovery.duration, 20); assert.equal(discovery.cost, 12); assert.deepEqual(discovery.resources, {'product-owner': 1, 'business-analyst': 2});
   assert.deepEqual(discovery.set, {problemFramed: true, budgetApproved: true, clientTone: 'calm'}); assert.deepEqual(discovery.add, {attempts: -2});
   // A decision's conditions: compare with another field and save, then reopen, switch back to a value, reorder and apply. The draft also carries the discovery edits, which the modal announces.
   await page.locator('[data-step="review-gate"]').click(); await page.locator('#edit-step').click();
   assert.match(await page.locator('#se-flows-0-label').inputValue(), /Findings/); assert.equal(await page.locator('#se-flows-1-cond-on').isChecked(), false); assert.equal(await page.locator('[data-act="up"][data-i="0"]').isDisabled(), true);
   assert.match(await page.locator('dialog.pd-dialog[open]').innerText(), /Cannot move up/); assert.match(await page.locator('dialog.pd-dialog[open]').innerText(), /edit the raw JSON draft/);
   await page.locator('#se-flows-0-cond-mode-field').check(); await page.locator('#se-flows-0-cond-valueField').fill('reworkLimit'); await page.locator('#se-flows-0-cond-op').selectOption('lt'); await page.locator('#se-flows-0-cond-field').fill('reworks'); await page.locator('#se-save').click();
   const gate = (JSON.parse(await draftText()) as LWProcess.Definition).flows.find(f => f.id === 'review-gate-rework')!; assert.deepEqual(gate.when, {field: 'reworks', op: 'lt', valueField: 'reworkLimit'});
   await page.locator('#edit-step').click(); assert.equal(await page.locator('#se-banner').isVisible(), true); assert.equal(await page.locator('#se-flows-0-cond-mode-field').isChecked(), true);
   await page.locator('#se-flows-0-cond-mode-value').check(); await page.locator('#se-flows-0-cond-field').fill('needsRework'); await page.locator('#se-flows-0-cond-op').selectOption('eq'); assert.equal(await page.locator('#se-flows-0-cond-value-type').inputValue(), 'true');
   await page.locator('#se-flows-0-label').fill('Findings to fix'); await page.locator('[data-act="down"][data-i="0"]').click();
   assert.equal(await page.locator('#se-flows-1-label').inputValue(), 'Findings to fix'); assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.act), 'up');
   await page.locator('#se-apply').click(); assert.equal(await page.locator('#se-confirm').isVisible(), true, 'a run past minute 0 asks before it is discarded'); await page.locator('#se-apply-reset').click(); assert.equal(await dialogOpen(), 0);
   const applied = await query(page); assert.equal(applied.snapshot.minute, 0); assert.equal(applied.playing, false); assert.equal(applied.definition.revision, before.definition.revision + 1);
   assert.equal(applied.definition.steps[1]!.name, 'Discovery workshop'); assert.equal(applied.definition.steps[1]!.duration, 20);
   const out = applied.definition.flows.filter(f => f.from === 'review-gate'); assert.deepEqual(out.map(f => f.to), ['handover', 'rework']);
   assert.deepEqual(out[1]!.when, {field: 'needsRework', op: 'eq', value: true}); assert.equal(out[1]!.label, 'Findings to fix'); assert.equal(await page.locator('#message').innerText(), 'Definition applied. New run is paused.');
   assert.equal(await activeId(), ''); assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.step), 'review-gate', 'a fresh run clears the selection, so focus falls back to the step list item');
  });
  await check('Step editor shows engine diagnostics inline, keeps the draft on Cancel and asks before discarding changes', async () => {
   await freshStudio(); const before = await query(page), original = await draftText();
   await page.locator('[data-step="implementation"]').click(); await page.locator('#edit-step').click();
   assert.equal(await page.locator('#se-status').innerText(), '', 'no problems means no status line'); assert.equal(await page.locator('#se-duration').getAttribute('aria-invalid'), null);
   await page.locator('#se-duration').fill(''); assert.match(await page.locator('#se-err-duration').innerText(), /Task duration must be 1 or more/); assert.match(await page.locator('#se-status').innerText(), /1 problem in this step/); assert.equal(await page.locator('#se-duration').getAttribute('aria-invalid'), 'true');
   await page.locator('#se-save').waitFor(); await page.locator('#se-apply').click(); assert.equal(await page.locator('#se-apply-errors').isVisible(), true); assert.match(await page.locator('#se-apply-errors').innerText(), /duration/);
   assert.equal(await dialogOpen(), 1); assert.equal(await draftText(), original, 'a failed apply never writes the draft'); assert.deepEqual((await query(page)).snapshot, before.snapshot);
   await page.locator('#se-duration').fill('25'); assert.equal(await page.locator('#se-err-duration').innerText(), '');
   await page.locator('[data-bind="set.0.key"]').fill('built'); await page.locator('[data-bind="set.0.key"]').fill('');
   assert.match(await page.locator('#se-err-set').innerText(), /Name the field or remove this row/); assert.equal(await page.locator('#se-save').isDisabled(), true); assert.match(await page.locator('#se-reason').innerText(), /Fix the highlighted fields/);
   await page.locator('[data-bind="set.0.key"]').fill('built');
   await page.locator('[data-bind="needs.0.field"]').fill('ghostField'); assert.match(await page.locator('#se-err-needs-0').innerText(), /ghostField/);
   await page.locator('[data-bind="needs.0.field"]').press('Escape'); assert.equal(await dialogOpen(), 1);
   assert.equal(await page.locator('#se-confirm').isVisible(), true); assert.equal(await page.locator('#se-confirm-title').innerText(), 'Discard your changes to Implementation?'); assert.equal(await activeId(), 'se-keep');
   await page.keyboard.press('Escape'); assert.equal(await page.locator('#se-confirm').isHidden(), true); assert.equal(await dialogOpen(), 1); assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.bind), 'needs.0.field');
   await page.locator('#se-cancel').click(); assert.equal(await activeId(), 'se-keep'); await page.locator('#se-keep').click(); assert.equal(await activeId(), 'se-cancel'); assert.equal(await page.locator('[data-bind="needs.0.field"]').inputValue(), 'ghostField');
   await page.locator('#se-save').click(); assert.equal(await dialogOpen(), 0); assert.match(await draftText(), /ghostField/);
   await page.locator('#edit-step').click(); assert.match(await page.locator('#se-err-needs-0').innerText(), /ghostField/);
   await page.locator('#se-cancel').click(); assert.equal(await dialogOpen(), 0, 'Cancel with no new edits closes at once'); assert.match(await draftText(), /ghostField/);
   await page.locator('#edit-step').click(); await page.locator('#se-name').fill('Renamed only in the modal'); await page.locator('#se-close').click();
   assert.equal(await page.locator('#se-confirm').isVisible(), true); await page.locator('#se-discard').click(); assert.equal(await dialogOpen(), 0); assert.equal(await activeId(), 'edit-step');
   assert.doesNotMatch(await draftText(), /Renamed only/); assert.match(await draftText(), /ghostField/);
   await openDef(); await restoreDef(); assert.equal(await draftText(), original); await closeDef(); assert.deepEqual((await query(page)).definition, before.definition);
  });
  await check('Step editor reflows to a full-screen sheet at phone width without horizontal overflow', async () => {
   await freshStudio(); await page.locator('#mode-2d').click(); await page.setViewportSize({width: 390, height: 844}); await nextFrames(page);
   await page.locator('[data-step="review-gate"]').click(); await page.locator('#edit-step').click(); await page.locator('dialog.pd-dialog[open]').waitFor();
   const geometry = await page.evaluate(() => {
    const d = document.querySelector('dialog.pd-dialog[open]') as HTMLElement, r = d.getBoundingClientRect(), body = d.querySelector('.pd-body') as HTMLElement, foot = d.querySelector('.pd-foot')!.getBoundingClientRect(), head = d.querySelector('.pd-head')!.getBoundingClientRect();
    const wide = [...d.querySelectorAll<HTMLElement>('input, select, textarea, button')].filter(n => n.getBoundingClientRect().right > r.right + 0.5 || n.getBoundingClientRect().left < r.left - 0.5).map(n => n.id || n.dataset.bind || n.textContent);
    return {x: r.x, y: r.y, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight, page: document.documentElement.scrollWidth > innerWidth, own: d.scrollWidth > d.clientWidth, scrolls: body.scrollHeight > body.clientHeight, footBottom: foot.bottom, headTop: head.top, wide,
     label: parseFloat(getComputedStyle(d.querySelector('label')!).fontSize), help: parseFloat(getComputedStyle(d.querySelector('.se-help')!).fontSize), input: (d.querySelector('input[type=text]') as HTMLElement).getBoundingClientRect().height};
   });
   assert.deepEqual([geometry.x, geometry.y, geometry.w, geometry.h], [0, 0, geometry.vw, geometry.vh]); assert.equal(geometry.page, false); assert.equal(geometry.own, false); assert.deepEqual(geometry.wide, []);
   assert.equal(geometry.scrolls, true); assert.equal(geometry.headTop, 0); assert.equal(Math.round(geometry.footBottom), geometry.vh); assert(geometry.label >= 13 && geometry.help >= 12 && geometry.input >= 44, JSON.stringify(geometry));
   await page.screenshot({path: path.join(OUT, 'process-step-editor-mobile.png')});
   await page.locator('#se-flows-0-label').scrollIntoViewIfNeeded(); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
   await page.keyboard.press('Escape'); await page.setViewportSize({width: 1440, height: 1060}); await nextFrames(page);
   await page.locator('#edit-step').click(); const wide = (await page.locator('dialog.pd-dialog[open]').boundingBox())!; assert(wide.width <= 760 && wide.width > 600, 'desktop dialog is a centred sheet, not full screen'); assert(wide.x > 100);
   await page.screenshot({path: path.join(OUT, 'process-step-editor-desktop.png')}); await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 0);
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
  await check('Shared dialog funnels Escape, Close and backdrop through one dirty guard and restores focus', async () => {
   await freshStudio(); await page.locator('[data-step="discovery"]').click(); const original = await draftText();
   assert.equal(await page.locator('#edit-step').getAttribute('aria-haspopup'), 'dialog');
   const shellInert = () => page.evaluate(() => (document.getElementById('process-shell') as HTMLElement).inert), locked = () => page.evaluate(() => document.documentElement.classList.contains('pd-locked'));
   const open = async () => { await page.locator('#edit-step').focus(); await page.keyboard.press('Enter'); await page.locator('dialog.pd-dialog[open]').waitFor(); };
   const backdrop = () => page.mouse.click(4, 4), confirmShown = () => page.locator('#se-confirm').isVisible();
   await open(); assert.equal(await shellInert(), true); assert.equal(await locked(), true); assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflow), 'hidden');
   await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 0); assert.equal(await activeId(), 'edit-step'); assert.equal(await shellInert(), false); assert.equal(await locked(), false);
   await open(); await backdrop(); assert.equal(await dialogOpen(), 0, 'a clean dialog closes on a backdrop click'); assert.equal(await activeId(), 'edit-step');
   await open(); await page.locator('#se-name').fill('Changed title');
   await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 1); assert.equal(await confirmShown(), true); assert.equal(await activeId(), 'se-keep');
   await page.keyboard.press('Escape'); assert.equal(await confirmShown(), false); assert.equal(await dialogOpen(), 1); assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.bind), 'name');
   await page.locator('#se-close').click(); assert.equal(await confirmShown(), true); assert.equal(await activeId(), 'se-keep');
   await backdrop(); assert.equal(await confirmShown(), false, 'a backdrop click while the guard shows keeps editing'); assert.equal(await dialogOpen(), 1);
   await backdrop(); assert.equal(await confirmShown(), true, 'a backdrop click on a dirty dialog raises the same guard'); assert.equal(await dialogOpen(), 1);
   await page.locator('#se-discard').click(); assert.equal(await dialogOpen(), 0); assert.equal(await activeId(), 'edit-step'); assert.equal(await draftText(), original);
   // The invoker may be hidden by the time the dialog closes; focus then falls back to the step list item. Only one modal may be open.
   await open(); await page.evaluate(() => { (document.getElementById('edit-step') as HTMLElement).hidden = true; });
   const stacked = await page.evaluate(() => { const D = (globalThis as any).LWProcessDialog, second = D.create(document.body, {id: 'x', size: 'list', title: 'Second', actions: [], onAction() {}}), blocked = second.open() === false, active = D.active() !== null; second.dispose(); return {blocked, active}; });
   assert.deepEqual(stacked, {blocked: true, active: true}); await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 0);
   assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.step), 'discovery'); await page.evaluate(() => { (document.getElementById('edit-step') as HTMLElement).hidden = false; });
   const sizes = await page.evaluate(() => {
    const D = (globalThis as any).LWProcessDialog, make = (id: string, size: string, extra: object = {}) => D.create(document.body, {id, size, title: 'Probe ' + id, actions: [{id: 'ok', label: 'OK'}], onAction() {}, ...extra}), out: Record<string, unknown> = {};
    const form = make('f', 'form'); form.open(); out.form = form.el.getBoundingClientRect().width; form.close(); form.dispose();
    const wide = make('w', 'wide'); wide.body.insertAdjacentHTML('beforeend', '<div class="pd-split"><p>a</p><p>b</p></div>'); wide.open();
    out.wide = wide.el.getBoundingClientRect().width; out.columns = getComputedStyle(wide.body.querySelector('.pd-split')!).gridTemplateColumns.split(' ').length; wide.close(); wide.dispose();
    const list = make('l', 'list'); list.open(); out.list = list.el.getBoundingClientRect().width; list.close(); list.dispose();
    const ro = make('r', 'form', {readOnly: true}); ro.open(); out.readOnlyFocus = document.activeElement?.id; ro.close(); ro.dispose(); return out;
   });
   assert.equal(sizes.form, 760); assert.equal(sizes.wide, 1000); assert.equal(sizes.columns, 2); assert.equal(sizes.list, 640); assert.equal(sizes.readOnlyFocus, 'r-title');
  });
  await check('Draft store keeps one unapplied draft per process and reports the diff for Save to draft', async () => {
   await freshStudio();
   const pure = await page.evaluate(() => {
    const w = globalThis as any, store = w.LWProcessDraft.create(), def = JSON.parse(JSON.stringify(w.LWProcessStudio.definition())), other = JSON.parse(JSON.stringify(w.LWProcessStudio.definitions()[1])), events: string[] = [];
    store.enter(0, def); store.subscribe((e: {source: string}) => events.push(e.source));
    const next = JSON.parse(JSON.stringify(def)); next.steps[1].name += ' a'; next.steps[2].name += ' b'; next.steps[3].name += ' c'; next.resources[0].capacity += 1;
    store.write(JSON.stringify(next, null, 2), 'definition'); store.write(JSON.stringify(next, null, 2), 'definition');
    const out: Record<string, unknown> = {events: events.slice(), summary: store.describeDiff(), ignoring: store.diff({ignoreStep: def.steps[1].id}).steps, names: store.diff().changedSteps.map((s: {name: string}) => s.name).length};
    store.leave(); store.enter(1, other); out.otherClean = !store.changed() && store.describeDiff() === ''; store.enter(0, def); out.restored = store.read() === JSON.stringify(next, null, 2) && store.changed();
    store.write('{"unfinished":', 'raw'); out.invalid = store.diff().invalid; out.invalidText = store.describeDiff(); out.parsed = store.parse() === undefined;
    store.restore(); out.reset = !store.changed() && store.describeDiff() === ''; store.write(JSON.stringify(next), 'definition'); store.enter(0, next); out.applied = !store.changed(); return out;
   });
   assert.deepEqual(pure.events, ['definition']); assert.equal(pure.summary, 'Unapplied draft: 3 steps, 1 resource changed'); assert.equal(pure.ignoring, 2); assert.equal(pure.names, 3);
   assert.equal(pure.otherClean, true); assert.equal(pure.restored, true); assert.equal(pure.invalid, true); assert.equal(pure.invalidText, 'Unapplied draft: not valid process JSON yet'); assert.equal(pure.parsed, true); assert.equal(pure.reset, true); assert.equal(pure.applied, true);
   const unapplied = (n: string) => `Unapplied draft \u00b7 ${n}`, chip = () => page.locator('#draft-chip').innerText(), clean = () => page.locator('#draft-chip').isHidden();
   await page.locator('[data-step="discovery"]').click(); await page.locator('#edit-step').click(); await page.locator('#se-name').fill('Discovery workshop'); await page.locator('#se-save').click();
   assert.equal(await chip(), unapplied('1 step changed')); assert.match(await draftText(), /Discovery workshop/);
   await page.locator('#process-switch').selectOption('1'); await page.waitForFunction(() => (globalThis as unknown as {LWProcessStudio: {query(): {active: number}}}).LWProcessStudio.query().active === 1);
   assert.equal(await clean(), true); assert.doesNotMatch(await draftText(), /Discovery workshop/);
   const work = (await query(page)).definition.steps.find(s => s.kind === 'task')!;
   await page.locator(`[data-step="${work.id}"]`).click(); await page.locator('#edit-step').click(); await page.locator('#se-name').fill('Vendor edit'); await page.locator('#se-save').click();
   assert.equal(await chip(), unapplied('1 step changed')); assert.match(await draftText(), /Vendor edit/);
   await page.locator('#process-switch').selectOption('0'); await page.waitForFunction(() => (globalThis as unknown as {LWProcessStudio: {query(): {active: number}}}).LWProcessStudio.query().active === 0);
   assert.equal(await chip(), unapplied('1 step changed')); assert.match(await draftText(), /Discovery workshop/); assert.doesNotMatch(await draftText(), /Vendor edit/);
   await page.locator('#process-switch').selectOption('1'); await page.waitForFunction(() => (globalThis as unknown as {LWProcessStudio: {query(): {active: number}}}).LWProcessStudio.query().active === 1);
   assert.match(await draftText(), /Vendor edit/); await openDef(); await applyDef();
   assert.equal(await clean(), true); assert.equal((await query(page)).definition.steps.find(s => s.id === work.id)!.name, 'Vendor edit');
   await page.locator('#process-switch').selectOption('0'); await page.waitForFunction(() => (globalThis as unknown as {LWProcessStudio: {query(): {active: number}}}).LWProcessStudio.query().active === 0);
   assert.equal(await chip(), unapplied('1 step changed'));
  });
  const scene = (id: string, x: number) => ({id: 'scene-' + id, position: [x, 0] as [number, number], color: '#ffbb73'});
  const autoLine = () => ({format: 'wildlands-process', schemaVersion: 1, revision: 1, id: 'auto-line', name: 'Automated line', start: 'start',
   resources: [{id: 'crew', name: 'Operators', capacity: 2, costPerMinute: 1}, {id: 'welding', name: 'Welding cell', capacity: 2, costPerMinute: 2, kind: 'machine'}, {id: 'runners', name: 'CI runners', capacity: 3, costPerMinute: 1, kind: 'system'}],
   steps: [{id: 'start', name: 'Start', kind: 'start', scene: scene('start', 0)}, {id: 'prep', name: 'Prepare parts', kind: 'task', duration: 5, cost: 2, resources: {crew: 1}, set: {prepared: true}, scene: scene('prep', 14)},
    {id: 'weld', name: 'Weld frame', kind: 'machine', duration: 10, cost: 3, resources: {welding: 1}, technology: 'Robot arm', set: {welded: true}, outputs: [{field: 'welded', label: 'Welded part'}], scene: scene('weld', 28)},
    {id: 'verify', name: 'Verify build', kind: 'system', duration: 4, resources: {runners: 1}, add: {checks: 1}, technology: 'CI pipeline', outputs: [{field: 'checks'}], scene: scene('verify', 42)}, {id: 'end', name: 'Done', kind: 'end', scene: scene('end', 56)}],
   flows: [{id: 'f1', from: 'start', to: 'prep'}, {id: 'f2', from: 'prep', to: 'weld'}, {id: 'f3', from: 'weld', to: 'verify'}, {id: 'f4', from: 'verify', to: 'end'}], arrivals: [{at: 0, count: 2, interval: 0, data: {}}]});
  await check('Step editor edits machine and system steps with matching pool kinds, technology and declared outputs', async () => {
   await freshStudio(); const name = 'auto-line.json';
   await page.locator('#file').setInputFiles({name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(autoLine()))});
   await page.waitForFunction(n => document.getElementById('message')!.textContent!.includes('Imported ' + n), name);
   const dlg = page.locator('dialog.pd-dialog[open]'), openStep = async (id: string) => { await page.locator(`[data-step="${id}"]`).click(); await page.locator('#edit-step').click(); await dlg.waitFor(); };
   await openStep('weld'); assert.equal(await page.locator('#se-chip').innerText(), 'machine'); assert.equal(await page.locator('#se-h-automation').count(), 1);
   assert.equal(await page.locator('#se-technology').inputValue(), 'Robot arm'); assert.equal(await page.locator('#se-technology-count').innerText(), '9 / 80 characters');
   assert.equal(await dlg.getByLabel('Welding cell').count(), 1); assert.equal(await dlg.getByLabel('Operators').count(), 0); assert.equal(await dlg.getByLabel('CI runners').count(), 0);
   assert.equal(await page.locator('#se-pools-1-count-help').innerText(), '2 available · 0 = not needed'); assert.match(await dlg.innerText(), /Machine step duration/);
   await page.locator('#se-technology').fill('Laser welder'); assert.equal(await page.locator('#se-technology-count').innerText(), '12 / 80 characters');
   await page.locator('#se-add-output').click(); assert.equal(await activeId(), 'se-outputs-1-field'); await page.locator('#se-outputs-1-field').fill('checked');
   assert.match(await page.locator('#se-err-outputs-1').innerText(), /does not deliver it/); assert.equal(await page.locator('#se-outputs-1-field').getAttribute('aria-invalid'), 'true');
   assert.equal(await page.locator('#se-err-outputs-1 .se-err').count(), 1, 'one problem per field'); await page.locator('#se-status a[data-goto="se-outputs-1-field"]').click(); assert.equal(await activeId(), 'se-outputs-1-field');
   await page.locator('#se-add-add').click(); await page.locator('[data-bind="add.0.key"]').fill('checked'); assert.equal(await page.locator('#se-err-outputs-1').innerText(), ''); assert.equal(await page.locator('#se-outputs-1-field').getAttribute('aria-invalid'), null);
   await page.locator('#se-outputs-1-label').fill('Checks passed'); await page.locator('#se-save').click(); assert.equal(await dialogOpen(), 0);
   const saved = (JSON.parse(await draftText()) as LWProcess.Definition).steps.find(s => s.id === 'weld')!;
   assert.equal(saved.technology, 'Laser welder'); assert.deepEqual(saved.outputs, [{field: 'welded', label: 'Welded part'}, {field: 'checked', label: 'Checks passed'}]); assert.deepEqual(saved.add, {checked: 1}); assert.deepEqual(saved.resources, {welding: 1});
   await openStep('prep'); assert.equal(await page.locator('#se-chip').innerText(), 'task'); assert.equal(await page.locator('#se-h-automation').count(), 0); assert.equal(await page.locator('#se-technology').count(), 0);
   assert.equal(await dlg.getByLabel('Operators').count(), 1); assert.equal(await dlg.getByLabel('Welding cell').count(), 0); assert.equal(await dlg.getByLabel('CI runners').count(), 0); assert.equal(await page.locator('#se-h-outputs').count(), 1);
   await page.locator('#se-close').click(); assert.equal(await dialogOpen(), 0);
   await openStep('verify'); assert.equal(await page.locator('#se-chip').innerText(), 'system'); assert.equal(await page.locator('#se-technology').inputValue(), 'CI pipeline');
   assert.equal(await dlg.getByLabel('CI runners').count(), 1); assert.equal(await dlg.getByLabel('Operators').count(), 0); assert.equal(await dlg.getByLabel('Welding cell').count(), 0); await page.locator('#se-close').click();
   // A pool of the wrong kind is shown with its problem, and a missing kind is explained.
   const broken = autoLine(); broken.resources[1]!.kind = 'people'; await openDef(); await page.locator('#draft').fill(JSON.stringify(broken)); await closeDef();
   await openStep('weld'); assert.match(await page.locator('#se-no-pools').innerText(), /Add a machine pool in the Definition editor/);
   assert.equal(await page.locator('#se-pools-1-count').getAttribute('aria-invalid'), 'true'); assert.match(await page.locator('#se-err-pools-1').innerText(), /Welding cell is a people pool, but machine steps may use only machine pools/);
   await page.locator('#se-close').click(); assert.equal(await dialogOpen(), 0);
  });
  await check('Step editor confirms before applying over a run in progress and links errors to their fields', async () => {
   await freshStudio(); await page.locator('#advance').click(); const before = await query(page); assert.equal(before.snapshot.minute, 30);
   await page.locator('[data-step="discovery"]').click(); await page.locator('#edit-step').click(); await page.locator('#se-duration').fill('20'); await page.locator('#se-apply').click();
   assert.equal(await page.locator('#se-confirm').isVisible(), true); assert.match(await page.locator('#se-confirm-title').innerText(), /^Applying starts a fresh paused run and discards minute 30 \(\d+ cases?\)\. Export the run report first if you need it\.$/);
   assert.equal(await activeId(), 'se-back'); assert.equal(await page.locator('#se-apply-reset').innerText(), 'Apply and reset'); assert.deepEqual((await query(page)).definition, before.definition);
   await page.keyboard.press('Escape'); assert.equal(await page.locator('#se-confirm').isHidden(), true); assert.equal(await dialogOpen(), 1); assert.equal((await query(page)).snapshot.minute, 30);
   await page.locator('#se-apply').click(); await page.locator('#se-apply-reset').click(); assert.equal(await dialogOpen(), 0);
   const applied = await query(page); assert.equal(applied.snapshot.minute, 0); assert.equal(applied.definition.steps[1]!.duration, 20); assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.step), 'discovery');
   // Errors link to fields, each field shows one problem, and problems elsewhere in the draft are listed with names.
   await openDef(); const raw = JSON.parse(await draftText()) as LWProcess.Definition; delete raw.steps[1]!.duration; await page.locator('#draft').fill(JSON.stringify(raw)); await closeDef();
   await page.locator('[data-step="implementation"]').click(); await page.locator('#edit-step').click(); await page.locator('#se-duration').fill('');
   assert.equal(await page.locator('#se-err-duration .se-err').count(), 1); assert.equal(await page.locator('#se-duration').getAttribute('aria-invalid'), 'true');
   await page.locator('#se-status a[data-goto="se-duration"]').click(); assert.equal(await activeId(), 'se-duration');
   const elsewhere = await page.locator('#se-status').innerText(); assert.match(elsewhere, /1 problem in this step/); assert.match(elsewhere, /Task duration must be 1 or more/); assert.match(elsewhere, /Elsewhere in the draft \(1\)/); assert.match(elsewhere, /Discovery › duration/); assert.match(elsewhere, /Definition editor/);
   await page.locator('#se-add-set').click(); await page.locator('[data-bind="set.1.key"]').fill(''); assert.equal(await page.locator('[data-bind="set.1.key"]').getAttribute('aria-invalid'), 'true'); assert.match(await page.locator('#se-status').innerText(), /Value 2: Name the field or remove this row/);
   await page.locator('[data-bind="set.1.key"]').fill('extra'); await page.locator('#se-duration').fill('25'); assert.doesNotMatch(await page.locator('#se-status').innerText(), /in this step/);
   await page.locator('#se-apply').click(); assert.equal(await page.locator('#se-apply-errors').isVisible(), true); assert.match(await page.locator('#se-apply-errors').innerText(), /Discovery › duration/); assert.equal(await dialogOpen(), 1);
   await page.locator('#se-cancel').click(); await page.locator('#se-discard').click(); assert.equal(await dialogOpen(), 0);
   // An unparseable draft cannot be edited as a step: Edit step opens the Definition editor on the JSON syntax error instead.
   await openDef(); await page.locator('#draft').fill('{bad'); await closeDef(); await page.locator('#edit-step').click();
   assert.equal(await dialogOpen(), 1); assert.equal(await page.locator('#de-title').isVisible(), true); assert.equal(await page.locator('#se-title').isVisible(), false); assert.match(await page.locator('#draft-state').innerText(), /Invalid JSON: line 1, column 2/);
   await restoreDef(); await closeDef();
  });
  const automationFixture = (d: LWProcess.Definition) => {
   const scene = (id: string, x: number) => ({id: 'scene-' + id, position: [x, 0] as [number, number], color: '#91b9d5'});
   Object.assign(d, {id: 'automation-fixture', name: 'Automation fixture', description: 'A people task, a machine step and a system step.', start: 'begin', arrivals: [{at: 0, count: 4, interval: 0, data: {}}],
    resources: [{id: 'team', name: 'Team', capacity: 2, costPerMinute: 1}, {id: 'arm', name: 'Robot arm', capacity: 1, costPerMinute: 2, kind: 'machine'}, {id: 'ci', name: 'CI runners', capacity: 1, costPerMinute: 1, kind: 'system'}],
    steps: [{id: 'begin', name: 'Begin', kind: 'start', scene: scene('begin', 0)}, {id: 'plan', name: 'Plan the order', kind: 'task', duration: 10, resources: {team: 1}, scene: scene('plan', 14)},
     {id: 'pack', name: 'Pack boxes', kind: 'machine', technology: 'Robot arm', duration: 20, resources: {arm: 1}, scene: scene('pack', 28)}, {id: 'build', name: 'Build and test the release', kind: 'system', technology: 'CI/CD pipeline', duration: 20, resources: {ci: 1}, scene: scene('build', 42)},
     {id: 'finish', name: 'Finish', kind: 'end', scene: scene('finish', 56)}],
    flows: [{id: 'f1', from: 'begin', to: 'plan'}, {id: 'f2', from: 'plan', to: 'pack'}, {id: 'f3', from: 'pack', to: 'build'}, {id: 'f4', from: 'build', to: 'finish'}]});
  };
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
   await page.locator('button[aria-label="Zoom in"]').click(); await page.locator('button[aria-label="Zoom in"]').click(); assert.equal((await titles()).secondary, false, 'two small steps are still below the 9px secondary size');
   const long = await page.evaluate(() => { const d = (globalThis as any).LWProcessStudio.query().definition.steps.reduce((a: any, s: any) => s.name.length > a.name.length ? s : a); const g = document.getElementById('process-map-' + d.id)!; return {full: d.name, tip: g.querySelector('title')!.textContent, shown: g.querySelector('.pm-title')!.textContent!}; });
   assert.equal(long.tip, long.full); assert(long.full.length > 20 && long.shown.length < long.full.length && long.shown.includes('…'), 'long names are truncated with an ellipsis and keep the full name in the title');
   const idle = await page.evaluate(() => { const card = document.querySelector('#map svg .pm-card.pm-idle') as SVGRectElement; return {stroke: getComputedStyle(card).stroke, dash: getComputedStyle(card).strokeDasharray}; });
   assert.equal(idle.stroke, 'rgb(54, 65, 80)'); assert.notEqual(idle.dash, 'none');
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
  const dlgText = () => page.locator('dialog.pd-dialog[open]').innerText();
  const randomLine = () => ({format: 'wildlands-process', schemaVersion: 1, revision: 1, id: 'random-line', name: 'Random line', start: 'start',
   resources: [{id: 'crew', name: 'Operators', capacity: 2, costPerMinute: 1}],
   steps: [{id: 'start', name: 'Start', kind: 'start', scene: scene('start', 0)}, {id: 'pack', name: 'Pack order', kind: 'task', duration: 12, cost: 1, resources: {crew: 1}, set: {packed: true}, scene: scene('pack', 14)},
    {id: 'cool', name: 'Cool down', kind: 'timer', duration: 30, scene: scene('cool', 28)}, {id: 'dock', name: 'Dock hold', kind: 'timer', until: 400, scene: scene('dock', 42)},
    {id: 'gate', name: 'Quality gate', kind: 'decision', scene: scene('gate', 56)}, {id: 'repack', name: 'Repack', kind: 'task', duration: 6, resources: {crew: 1}, add: {reworks: 1}, scene: scene('repack', 70)}, {id: 'end', name: 'Done', kind: 'end', scene: scene('end', 84)}],
   flows: [{id: 'f1', from: 'start', to: 'pack'}, {id: 'f2', from: 'pack', to: 'cool'}, {id: 'f3', from: 'cool', to: 'dock'}, {id: 'f4', from: 'dock', to: 'gate'}, {id: 'f5', from: 'gate', to: 'repack', when: {chance: 20}}, {id: 'f6', from: 'gate', to: 'end'}, {id: 'f7', from: 'repack', to: 'end'}],
   arrivals: [{at: 0, count: 6, interval: 0, data: {}}]});
  const importRandom = async () => {
   await freshStudio(); const name = 'random-line.json';
   await page.locator('#file').setInputFiles({name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(randomLine()))});
   await page.waitForFunction(n => document.getElementById('message')!.textContent!.includes('Imported ' + n), name);
  };
  const openRandom = async (id: string) => { await page.locator(`[data-step="${id}"]`).click(); await page.locator('#edit-step').click(); await page.locator('dialog.pd-dialog[open]').waitFor(); };
  const savedStep = async (id: string) => (JSON.parse(await draftText()) as LWProcess.Definition).steps.find(s => s.id === id)!;
  await check('Step editor edits random timing, draws and chance routes and keeps them valid', async () => {
   await importRandom(); await openRandom('pack');
   assert.equal(await page.locator('#se-h-random-timing').count(), 1); assert.equal(await page.locator('#se-timing-dist').inputValue(), ''); assert.equal(await page.locator('#se-timing-min').count(), 0);
   await page.locator('#se-timing-dist').selectOption('uniform'); assert.equal(await page.locator('#se-timing-min').inputValue(), '6'); assert.equal(await page.locator('#se-timing-max').inputValue(), '18');
   await page.locator('#se-timing-min').fill('8'); await page.locator('#se-timing-max').fill('14'); assert.equal(await page.locator('#se-err-timing .se-err').count(), 0);
   // Random outcomes: chance, weighted choice and whole number rows.
   assert.equal(await page.locator('#se-h-random-outcomes').count(), 1); assert.match(await dlgText(), /applied when the step completes, after Set values and before counters/);
   await page.locator('#se-add-draw').click(); assert.equal(await activeId(), 'se-draws-0-field'); await page.locator('#se-draws-0-field').fill('defect'); await page.locator('#se-draws-0-percent').fill('12');
   await page.locator('#se-add-draw').click(); await page.locator('#se-draws-1-field').fill('defect'); assert.match(await page.locator('#se-err-draws-1').innerText(), /drawn twice/); assert.equal(await page.locator('#se-draws-1-field').getAttribute('aria-invalid'), 'true');
   await page.locator('#se-draws-1-field').fill('packed'); assert.match(await page.locator('#se-err-draws-1').innerText(), /also in Set a value/);
   await page.locator('#se-draws-1-field').fill('priority'); await page.locator('#se-draws-1-kind').selectOption('choice'); assert.equal(await page.locator('#se-draws-1-values-1-weight').count(), 1);
   await page.locator('#se-draws-1-values-0-value-text').fill('standard'); await page.locator('#se-draws-1-values-0-weight').fill('80'); await page.locator('#se-draws-1-values-1-value-text').fill('express'); await page.locator('#se-draws-1-values-1-weight').fill('20');
   assert.equal(await page.locator('[data-act="remove-choice"][data-i="1"][data-j="0"]').isDisabled(), true, 'a weighted choice keeps two values');
   await page.locator('#se-add-choice-1').click(); assert.equal(await page.locator('[data-act="remove-choice"][data-i="1"][data-j="2"]').isEnabled(), true); await page.locator('[data-act="remove-choice"][data-i="1"][data-j="2"]').click(); assert.equal(await page.locator('#se-draws-1-values-2-weight').count(), 0);
   await page.locator('#se-add-draw').click(); await page.locator('#se-draws-2-field').fill('size'); await page.locator('#se-draws-2-kind').selectOption('int'); await page.locator('#se-draws-2-min').fill('1'); await page.locator('#se-draws-2-max').fill('6');
   for (let i = 3; i < 8; i++) await page.locator('#se-add-draw').click(); assert.equal(await page.locator('#se-add-draw').isDisabled(), true); assert.match(await page.locator('#se-max-draws').innerText(), /At most 8/);
   for (let i = 7; i >= 3; i--) await page.locator(`[data-act="remove-draw"][data-i="${i}"]`).click(); assert.equal(await page.locator('#se-add-draw').isEnabled(), true); assert.equal(await activeId(), 'se-add-draw');
   assert.equal(await page.locator('#se-save').isEnabled(), true); await page.locator('#se-save').click(); assert.equal(await dialogOpen(), 0);
   const pack = await savedStep('pack'); assert.deepEqual(pack.timing, {dist: 'uniform', min: 8, max: 14}); assert.equal(pack.duration, 12);
   assert.deepEqual(pack.draws, [{field: 'defect', kind: 'chance', percent: 12}, {field: 'priority', kind: 'choice', values: [{value: 'standard', weight: 80}, {value: 'express', weight: 20}]}, {field: 'size', kind: 'int', min: 1, max: 6}]);
   // Chance routes are editable on a decision and show their share in the path summary.
   await openRandom('gate'); assert.equal(await page.locator('#se-h-random-timing').count(), 0); assert.equal(await page.locator('#se-h-random-outcomes').count(), 0);
   assert.deepEqual(await page.locator('#se-path-summary li').allInnerTexts(), ['20% of cases → Repack', 'Otherwise → Done']);
   assert.equal(await page.locator('#se-flows-0-cond-mode-chance').isChecked(), true); assert.equal(await page.locator('#se-flows-0-cond-chance').inputValue(), '20');
   await page.locator('#se-flows-0-cond-chance').fill('8'); assert.equal((await page.locator('#se-path-summary li').allInnerTexts())[0], '8% of cases → Repack');
   await page.locator('#se-flows-0-cond-chance').fill('0'); assert.match(await page.locator('#se-err-flows-0').innerText(), /whole percent from 1 to 99/); assert.equal(await page.locator('#se-save').isDisabled(), true);
   await page.locator('#se-flows-0-cond-mode-value').check(); assert.equal(await page.locator('#se-flows-0-cond-chance').count(), 0); assert.equal(await page.locator('#se-flows-0-cond-field').count(), 1);
   await page.locator('#se-flows-0-cond-mode-chance').check(); assert.equal(await page.locator('#se-flows-0-cond-chance').inputValue(), '0'); await page.locator('#se-flows-0-cond-chance').fill('8');
   await page.locator('#se-flows-1-cond-on').check(); await page.locator('#se-flows-1-cond-mode-chance').check(); await page.locator('#se-flows-1-cond-chance').fill('30');
   assert.match(await page.locator('#se-status').innerText(), /exactly one unconditional fallback/); await page.locator('#se-flows-1-cond-on').uncheck();
   await page.locator('#se-save').click(); const gate = (JSON.parse(await draftText()) as LWProcess.Definition).flows.filter(f => f.from === 'gate'); assert.deepEqual(gate.map(f => f.when), [{chance: 8}, undefined]);
   // The edited draft is accepted by the engine and a seeded run records realized durations and drawn values.
   const verdict = await page.evaluate(text => (globalThis as unknown as {LWProcessCatalog: LWProcess.Catalog}).LWProcessCatalog.validate(JSON.parse(text)).ok, await draftText()); assert.equal(verdict, true);
   await openRandom('pack'); await page.locator('#se-apply').click(); await page.waitForFunction(() => document.querySelectorAll('dialog.pd-dialog[open]').length === 0);
   for (let i = 0; i < 14; i++) if (!(await page.locator('#advance').isDisabled())) await page.locator('#advance').click();
   const run = (await query(page)).snapshot, packs = run.receipts.filter(r => r.stepId === 'pack');
   assert.ok(packs.length >= 4, 'several pack visits finished'); assert.ok(packs.every(r => r.duration !== undefined && r.duration === r.finished - r.started && r.duration >= 8 && r.duration <= 14));
   assert.ok(packs.every(r => typeof r.changes.defect === 'boolean' && ['standard', 'express'].includes(String(r.changes.priority)) && Number(r.changes.size) >= 1 && Number(r.changes.size) <= 6));
   assert.equal(run.receipts.filter(r => r.stepId === 'repack').every(r => r.duration === undefined), true, 'deterministic steps record no realized duration');
   await showIo(); await page.locator('[data-step="pack"]').click(); assert.match(await page.locator('#process-data').innerText(), /Took \d+ min \(planned 12\)/); assert.ok(await page.locator('#process-data .se-drawn').count() >= 3);
   await page.locator('[data-step="repack"]').click(); assert.doesNotMatch(await page.locator('#process-data').innerText(), /Took \d+ min/); assert.equal(await page.locator('#process-data .se-drawn').count(), 0);
  });
  await check('Step editor explains the planning duration next to random timing and rejects inconsistent distributions inline', async () => {
   await importRandom(); await openRandom('pack'); await page.locator('#se-timing-dist').selectOption('triangular');
   assert.equal(await page.locator('#se-timing-note').innerText(), 'Planning duration (12 min) stays the average shown in estimates; each visit draws its own time.');
   await page.locator('#se-duration').fill('20'); assert.match(await page.locator('#se-timing-note').innerText(), /Planning duration \(20 min\) stays the average/); await page.locator('#se-duration').fill('12');
   await page.locator('#se-timing-min').fill('20'); await page.locator('#se-timing-mode').fill('10'); await page.locator('#se-timing-max').fill('5');
   assert.match(await page.locator('#se-err-timing').innerText(), /minimum ≤ most likely ≤ maximum/); assert.equal(await page.locator('#se-timing-mode').getAttribute('aria-invalid'), 'true');
   assert.equal(await page.locator('#se-save').isDisabled(), true); assert.equal(await page.locator('#se-apply').isDisabled(), true);
   await page.locator('#se-timing-min').fill('4'); await page.locator('#se-timing-mode').fill('6'); await page.locator('#se-timing-max').fill('10'); assert.equal(await page.locator('#se-err-timing .se-err').count(), 0); assert.equal(await page.locator('#se-save').isEnabled(), true);
   await page.locator('#se-timing-dist').selectOption('uniform'); await page.locator('#se-timing-min').fill('9'); await page.locator('#se-timing-max').fill('4');
   assert.match(await page.locator('#se-err-timing').innerText(), /minimum \(9\) must not be above the maximum \(4\)/); assert.equal(await page.locator('#se-timing-min').getAttribute('aria-invalid'), 'true');
   await page.locator('#se-timing-dist').selectOption('exponential'); assert.equal(await page.locator('#se-timing-mean').inputValue(), '12'); await page.locator('#se-timing-max').fill('3');
   assert.match(await page.locator('#se-err-timing').innerText(), /cap \(3\) must not be below the mean \(12\)/); await page.locator('#se-timing-mean').fill('4'); await page.locator('#se-timing-max').fill('');
   assert.equal(await page.locator('#se-err-timing .se-err').count(), 0); await page.locator('#se-timing-max').fill('12'); await page.locator('#se-save').click();
   assert.deepEqual((await savedStep('pack')).timing, {dist: 'exponential', mean: 4, max: 12});
   // None removes the distribution again; the planning duration stays.
   await openRandom('pack'); await page.locator('#se-timing-dist').selectOption(''); assert.equal(await page.locator('#se-timing-note').count(), 0); await page.locator('#se-save').click(); assert.equal((await savedStep('pack')).timing, undefined); assert.equal((await savedStep('pack')).duration, 12);
   // Duration timers may be random; until timers and other kinds are not offered the section.
   await openRandom('cool'); assert.equal(await page.locator('#se-h-random-timing').count(), 1); await page.locator('#se-timing-dist').selectOption('exponential'); assert.equal(await page.locator('#se-timing-mean').inputValue(), '30'); await page.locator('#se-save').click();
   assert.deepEqual((await savedStep('cool')).timing, {dist: 'exponential', mean: 30});
   await openRandom('dock'); assert.equal(await page.locator('#se-h-random-timing').count(), 0); assert.equal(await page.locator('#se-h-random-outcomes').count(), 1); await page.locator('#se-close').click();
   await openRandom('start'); assert.equal(await page.locator('#se-h-random-timing').count(), 0); assert.equal(await page.locator('#se-h-random-outcomes').count(), 0); await page.locator('#se-close').click();
   // Engine diagnostics for timing and draws map to the editor fields as well.
   const mapped = await page.evaluate(() => {
    const g = globalThis as unknown as {LWProcessCatalog: LWProcess.Catalog; LWProcessStepModel: LWProcessStepModel.Api};
    const def = {...JSON.parse(JSON.stringify((globalThis as unknown as {LWProcessStudio: {query(): {definition: LWProcess.Definition}}}).LWProcessStudio.query().definition))} as LWProcess.Definition;
    const pack = def.steps.find(s => s.id === 'pack')!; pack.timing = {dist: 'uniform', min: 9, max: 4}; pack.draws = [{field: 'packed', kind: 'chance', percent: 12}, {field: 'x', kind: 'int', min: 5, max: 1}];
    return g.LWProcessStepModel.scope(def, 'pack', g.LWProcessCatalog.validate(def, true).diagnostics).map(i => i.key + '|' + i.message);
   });
   assert.ok(mapped.some(m => m.startsWith('timing|') && /min at most max/.test(m)), mapped.join('\n')); assert.ok(mapped.some(m => m.startsWith('draws.0.field|') && /one writer/.test(m))); assert.ok(mapped.some(m => m.startsWith('draws.1|') && /min at most max/.test(m)));
  });
  await check('Random view helpers describe distributions, draws, chance routes and arrival streams in plain language', async () => {
   await freshStudio();
   const out = await page.evaluate(() => {
    const v = (globalThis as unknown as {LWProcessRandomView: LWProcessRandomView.Api}).LWProcessRandomView;
    return [v.describeDist({dist: 'triangular', min: 4, mode: 6, max: 10}), v.describeDist({dist: 'uniform', min: 7, max: 11}), v.describeDist({dist: 'exponential', mean: 4, max: 12}), v.describeDist({dist: 'exponential', mean: 4}),
     v.describeTiming({duration: 12}), v.describeTiming({duration: 12, timing: {dist: 'uniform', min: 7, max: 11}}), v.describeTiming({until: 5}),
     v.describeDraw({field: 'defect', kind: 'chance', percent: 12}), v.describeDraw({field: 'priority', kind: 'choice', values: [{value: 'express', weight: 20}, {value: 'standard', weight: 80}]}),
     v.describeDraw({field: 'x', kind: 'int', min: 1, max: 6}), v.describeDraw({field: 'ok', kind: 'chance', percent: 30, whenTrue: 'pass', whenFalse: 'fail'}),
     v.describeWhen({chance: 8}), v.describeWhen({field: 'iteration', op: 'lt', valueField: 'iterations'} as unknown as LWProcess.Condition), v.describeWhen({field: 'priority', op: 'eq', value: 'express'}), v.describeWhen(undefined),
     v.describeArrival({at: 0, open: true, interval: 4, gap: {dist: 'exponential', mean: 4}, data: {}}), v.describeArrival({at: 10, until: 600, interval: 5, data: {}}), v.describeArrival({at: 0, count: 8, interval: 3, data: {}})];
   });
   assert.deepEqual(out, ['Random between 4 and 10 min, most often 6', 'Uniform 7–11 min', 'Exponential, mean 4 min (max 12)', 'Exponential, mean 4 min', 'Takes 12 min',
    'Planned 12 min (the average shown in estimates); each visit draws its own time: Uniform 7–11 min', '', 'Sets defect to true in 12% of cases, otherwise false', 'Sets priority to express (20%) or standard (80%)',
    'Sets x to a whole number from 1 to 6', 'Sets ok to pass in 30% of cases, otherwise fail', '8% of cases take this path', 'If iteration < iterations', 'If priority = "express"', 'Otherwise (no condition)',
    'Keeps arriving: every ~4 min, random gap (exponential, mean 4), first at minute 0', 'Until minute 600: every 5 min, first at minute 10', '8 cases: every 3 min, first at minute 0']);
  });
  const defOf = async () => JSON.parse(await draftText()) as LWProcess.Definition;
  const inSync = () => page.waitForFunction(() => document.getElementById('de-sync')!.textContent === 'Form in sync');
  await check('Definition editor opens as a modal from the header, pauses the run and applies a fresh paused run', async () => {
   await page.setViewportSize({width: 1440, height: 1060});
   await freshStudio();
   const opener = page.locator('#open-definition');
   assert.equal(await opener.innerText(), 'Edit process…'); assert.equal(await opener.getAttribute('aria-haspopup'), 'dialog');
   assert.equal(await page.evaluate(() => { const a = document.querySelector('.process-file-actions')!, kids = [...a.children].map(c => c.id); return kids.indexOf('open-definition') >= 0 && kids.indexOf('open-definition') < kids.indexOf('import'); }), true, 'the opener sits in the header actions before Import');
   assert.equal(await page.locator('#show-definition').count() + await page.locator('#editor').count(), 0, 'the bottom Definition tab and panel are gone'); assert.equal(await page.locator('#draft-chip').isHidden(), true);
   const before = await query(page); await page.locator('#horizon').selectOption('1440'); await page.locator('#play').click();
   await page.waitForFunction(() => (globalThis as unknown as {LWProcessStudio: {query(): {snapshot: {minute: number}}}}).LWProcessStudio.query().snapshot.minute > 0);
   await opener.focus(); await page.keyboard.press('Enter'); await defOpen.waitFor();
   assert.equal(await page.evaluate(() => document.querySelector('dialog.de-dialog')!.matches(':modal')), true); assert.equal(await page.getByRole('dialog', {name: 'Definition editor'}).count(), 1);
   assert.equal(await page.locator('#de-title').innerText(), 'Definition editor'); assert.equal(await page.locator('#de-subtitle').innerText(), `${before.definition.name} · revision ${before.definition.revision} · The run is paused while this window is open`);
   assert.equal(await page.locator('#de-chip').isHidden(), true); assert.equal(await activeId(), 'tune-name'); assert.equal(await page.locator('#de-sync').innerText(), 'Form in sync');
   const frozen = await query(page); assert.equal(frozen.playing, false); await nextFrames(page, 45); assert.equal((await query(page)).snapshot.minute, frozen.snapshot.minute, 'nothing ticks while the editor is open');
   await assert.rejects(page.locator('#play').click({timeout: 700}), 'the page behind the modal is inert');
   assert.equal(await page.evaluate(() => ['de-form-h', 'de-json-h'].every(id => document.getElementById(id)!.tagName === 'H3') && document.querySelectorAll('dialog.de-dialog section[aria-labelledby]').length >= 2 && document.getElementById('draft-state')!.getAttribute('role') === 'status'), true);
   await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 0); assert.equal(await activeId(), 'open-definition');
   await opener.click(); await page.locator('#tune-name').fill('Renamed by the form'); assert.equal(await page.locator('#de-chip').innerText(), 'Unapplied draft');
   await page.locator('#de-close').click(); assert.equal(await dialogOpen(), 0); assert.equal(await activeId(), 'open-definition');
   assert.equal(await page.locator('#draft-chip').innerText(), 'Unapplied draft · 1 process setting changed'); assert.equal((await query(page)).definition.name, before.definition.name, 'the running definition is untouched until Apply');
   await page.locator('#draft-chip').click(); await defOpen.waitFor(); await page.locator('#de-validate').click(); assert.equal(await page.locator('#de-message').innerText(), 'Valid definition. Applying starts a fresh paused run.');
   await page.locator('#de-apply').click(); assert.equal(await page.locator('#de-confirm').isVisible(), true, 'a run past minute 0 asks first'); await page.locator('#de-back').click(); await page.locator('#de-close').click();
   await page.locator('#reset').click(); await page.locator('#open-definition').click(); await defOpen.waitFor(); await page.locator('#de-apply').click(); await defOpen.waitFor({state: 'hidden'});
   const applied = await query(page); assert.equal(applied.definition.name, 'Renamed by the form'); assert.equal(applied.definition.revision, before.definition.revision + 1); assert.equal(applied.snapshot.minute, 0); assert.equal(applied.playing, false);
   assert.equal(await page.locator('#draft-chip').isHidden(), true); assert.equal(await activeId(), 'open-definition'); assert.match(await page.locator('#message').innerText(), /Definition applied\. New run is paused\./);
  });
  await check('Definition editor edits seed, resource kinds and arrival end rules, gaps and draws with inline problems', async () => {
   await page.setViewportSize({width: 1440, height: 1060});
   await freshStudio(); await openDef(); const seed = page.locator('#tune-seed'), arr = (id: string) => page.locator('#tune-arr-0-' + id), pool = page.locator('#tune-res-0-kind');
   assert.match(await page.locator('#tune-seed-help').innerText(), /Same seed, same run\. Change it to see another scenario/); assert.equal(await page.locator('label[for="tune-seed"]').innerText(), 'Seed');
   await seed.fill('42'); assert.equal((await defOf()).seed, 42); await seed.fill('1.5'); assert.equal((await defOf()).seed, 42, 'a fraction is not written');
   assert.match(await page.locator('#tune-seed-err').innerText(), /whole number/); assert.equal(await seed.getAttribute('aria-invalid'), 'true');
   await seed.fill('2147483648'); assert.match(await page.locator('#tune-seed-err').innerText(), /from 0 to 2,147,483,647/); assert.equal(await seed.getAttribute('aria-invalid'), 'true'); await inSync();
   await seed.fill('7'); assert.equal(await page.locator('#tune-seed-err').innerText(), ''); assert.equal(await seed.getAttribute('aria-invalid'), null); await seed.fill(''); assert.equal(Object.hasOwn(await defOf(), 'seed'), false);
   // Resource kind: written only when it is not people; the engine's own diagnostics speak.
   assert.equal(Object.hasOwn((await defOf()).resources[0]!, 'kind'), false); assert.deepEqual(await page.locator('#tune-res-0-kind option').allInnerTexts(), ['People', 'Machine', 'System']);
   await pool.selectOption('machine'); assert.equal((await defOf()).resources[0]!.kind, 'machine'); assert.match(await page.locator('#tune-res-0-kind-err').innerText(), /may demand only people pools/); assert.equal(await pool.getAttribute('aria-invalid'), 'true');
   assert.match(await page.locator('#diagnostics').innerText(), /may demand only people pools/); await pool.selectOption('system'); assert.equal((await defOf()).resources[0]!.kind, 'system');
   await pool.selectOption('people'); assert.equal(Object.hasOwn((await defOf()).resources[0]!, 'kind'), false); assert.equal(await page.locator('#diagnostics li').count(), 0);
   await page.locator('#tune-res-0-cap').fill('0'); assert.equal(await page.locator('#tune-res-0-cap').getAttribute('aria-invalid'), 'true'); assert.match(await page.locator('#tune-res-0-cap-err').innerText(), /from 1 to 1,000/); await page.locator('#tune-res-0-cap').fill('2'); assert.equal((await defOf()).resources[0]!.capacity, 2);
   // Arrival end rules.
   const first = (await defOf()).arrivals[0]!; assert.equal(await page.locator('#tune-arr-0-end-count').isChecked(), true);
   await arr('end-until').check(); let a = (await defOf()).arrivals[0]!; assert.equal(a.count, undefined); assert.equal(typeof a.until, 'number'); assert(a.until! > a.at); assert.equal(await arr('until').count(), 1);
   await arr('end-open').check(); a = (await defOf()).arrivals[0]!; assert.deepEqual([a.open, a.until, a.count], [true, undefined, undefined]); assert.equal(await arr('count').count(), 0);
   await arr('interval').fill('0'); assert.match(await page.locator('#tune-arr-0-interval-err').innerText(), /interval of at least 1 minute/); assert.equal(await arr('interval').getAttribute('aria-invalid'), 'true');
   await arr('interval').fill('10'); assert.equal(await page.locator('#tune-arr-0-interval-err').innerText(), ''); await arr('end-count').check(); a = (await defOf()).arrivals[0]!; assert.equal(a.open, undefined); assert.equal(typeof a.count, 'number');
   await arr('count').fill('201'); assert.match(await page.locator('#tune-arr-0-count-err').innerText(), /from 1 to 200/); await arr('count').fill(String(first.count ?? 3));
   // Random gap.
   assert.deepEqual(await arr('gap-dist').locator('option').allInnerTexts(), ['None (exact spacing)', 'Uniform (min to max)', 'Triangular (min, most likely, max)', 'Exponential (average, optional cap)', 'Normal (average and spread, optional bounds)', 'Erlang (phases and average)']);
   await arr('gap-dist').selectOption('uniform'); assert.equal((await defOf()).arrivals[0]!.gap!.dist, 'uniform'); await arr('gap-min').fill('9'); await arr('gap-max').fill('3');
   assert.match(await page.locator('#tune-arr-0-gap-group-err').innerText(), /min at most max/); assert.equal(await arr('gap-min').getAttribute('aria-invalid'), 'true'); await arr('gap-max').fill('12'); assert.equal(await page.locator('#tune-arr-0-gap-group-err').innerText(), '');
   await arr('gap-dist').selectOption('triangular'); assert.deepEqual(Object.keys((await defOf()).arrivals[0]!.gap!).sort(), ['dist', 'max', 'min', 'mode']); await arr('gap-dist').selectOption('exponential'); assert.deepEqual(Object.keys((await defOf()).arrivals[0]!.gap!).sort(), ['dist', 'mean']);
   assert.equal(await arr('gap-max').count(), 1); await arr('gap-dist').selectOption('none'); assert.equal((await defOf()).arrivals[0]!.gap, undefined);
   // Arrival data fields.
   await page.locator('[data-act="data-add"]').first().click(); let data = (await defOf()).arrivals[0]!.data; const added = Object.keys(data).at(-1)!; assert.equal(data[added], '');
   const idx = Object.keys(data).length - 1, rename = page.locator(`#tune-arr-0-data-${idx}-name`); await rename.fill('Bad name'); await rename.press('Tab'); assert.match(await page.locator(`#tune-arr-0-data-${idx}-name-err`).innerText(), /lowercase letter/); assert.equal(Object.hasOwn((await defOf()).arrivals[0]!.data, added), true);
   await rename.fill('urgency'); await rename.press('Tab'); data = (await defOf()).arrivals[0]!.data; assert.deepEqual(Object.keys(data).at(-1), 'urgency');
   await page.locator(`#tune-arr-0-data-${idx}-value-type`).selectOption('number'); await page.locator(`#tune-arr-0-data-${idx}-value`).fill('3'); assert.equal((await defOf()).arrivals[0]!.data.urgency, 3);
   await page.locator(`#tune-arr-0-data-${idx}-value-type`).selectOption('boolean'); assert.equal((await defOf()).arrivals[0]!.data.urgency, true); await page.locator('[data-act="data-remove"][data-name="urgency"]').click(); assert.equal(Object.hasOwn((await defOf()).arrivals[0]!.data, 'urgency'), false);
   // Arrival draws.
   await page.locator('[data-act="draw-add"]').first().click(); let draw = (await defOf()).arrivals[0]!.draws![0]!; assert.deepEqual([draw.kind, draw.percent], ['chance', 50]);
   await page.locator('#tune-arr-0-draw-0-percent').fill('100'); assert.match(await page.locator('#tune-arr-0-draw-0-percent-err').innerText(), /whole percent from 1 to 99/); await page.locator('#tune-arr-0-draw-0-percent').fill('30');
   await page.locator('#tune-arr-0-draw-0-true-type').selectOption('string'); await page.locator('#tune-arr-0-draw-0-true').fill('urgent'); await page.locator('#tune-arr-0-draw-0-false-type').selectOption('string'); await page.locator('#tune-arr-0-draw-0-false').fill('routine');
   draw = (await defOf()).arrivals[0]!.draws![0]!; assert.deepEqual([draw.percent, draw.whenTrue, draw.whenFalse], [30, 'urgent', 'routine']);
   await page.locator('#tune-arr-0-draw-0-kind').selectOption('choice'); draw = (await defOf()).arrivals[0]!.draws![0]!; assert.equal(draw.values!.length, 2); assert.equal(draw.percent, undefined);
   await page.locator('[data-act="value-add"]').first().click(); assert.equal((await defOf()).arrivals[0]!.draws![0]!.values!.length, 3); await page.locator('#tune-arr-0-draw-0-w0').fill('0'); assert.match(await page.locator('#tune-arr-0-draw-0-w0-err').innerText(), /from 1 to 1000/);
   await page.locator('#tune-arr-0-draw-0-w0').fill('5'); await page.locator('#tune-arr-0-draw-0-kind').selectOption('int'); draw = (await defOf()).arrivals[0]!.draws![0]!; assert.deepEqual([draw.min, draw.max, draw.values], [1, 10, undefined]);
   await page.locator('#tune-arr-0-draw-0-min').fill('20'); assert.match(await page.locator('#tune-arr-0-draw-0-err2').innerText(), /min at most max/); await page.locator('[data-act="draw-remove"]').first().click(); assert.equal((await defOf()).arrivals[0]!.draws, undefined);
   // Add and remove arrivals.
   await page.locator('#tune-arr-add').click(); const total = (await defOf()).arrivals.length; assert.equal(total, 3); await page.locator('[data-act="arr-remove"]').last().click(); await page.locator('[data-act="arr-remove"]').last().click(); assert.equal((await defOf()).arrivals.length, 1); assert.equal(await page.locator('[data-act="arr-remove"]').isDisabled(), true);
   await restoreDef(); await closeDef(); assert.equal(await page.locator('#draft-chip').isHidden(), true);
  });
  await check('Definition editor raw JSON reports line and column, lists every diagnostic and jumps to the offending text', async () => {
   await page.setViewportSize({width: 1440, height: 1060});
   await freshStudio(); await openDef(); const area = page.locator('#draft'), selection = () => page.evaluate(() => { const a = document.getElementById('draft') as HTMLTextAreaElement; return {text: a.value.slice(a.selectionStart, a.selectionEnd), start: a.selectionStart, active: document.activeElement?.id}; });
   await area.fill('{\n  "a": 1,\n  "b": [1 2]\n}'); assert.equal(await page.locator('#draft-state').innerText(), `Invalid JSON: line 3, column 11 · Expected ',' or ']' after the value`);
   assert.equal(await page.locator('#de-gutter .bad').innerText(), '3'); assert.equal(await page.locator('#de-format').isDisabled(), true); assert.equal(await area.getAttribute('aria-invalid'), 'true');
   await page.waitForFunction(() => document.getElementById('de-sync')!.textContent === 'Fix the JSON to use the form'); assert.equal(await page.locator('#tune-name').isDisabled(), true, 'the form is disabled while the JSON is invalid');
   await page.locator('#diagnostics button').click(); const syntax = await selection(); assert.equal(syntax.active, 'draft'); assert.equal(syntax.start, '{\n  "a": 1,\n  "b": [1 '.length); assert.equal(syntax.text, '2');
   // Every diagnostic the catalog returns is listed, labelled with the step name, and selects its text.
   const base = JSON.parse(JSON.stringify((await query(page)).definition)) as LWProcess.Definition; base.steps[1]!.duration = 0; base.resources[0]!.capacity = 0; delete (base.steps[2] as Partial<LWProcess.Step>).scene;
   await area.fill(JSON.stringify(base, null, 2)); await inSync();
   const expected = await page.evaluate(text => (globalThis as unknown as {LWProcessCatalog: LWProcess.Catalog}).LWProcessCatalog.validate(JSON.parse(text), true).diagnostics.map(d => d.path), await draftText());
   assert(expected.length >= 3, JSON.stringify(expected)); assert.equal(await page.locator('#diagnostics button').count(), expected.length); assert.equal(await page.locator('#de-diag-h').innerText(), `Problems (${expected.length})`);
   assert.deepEqual(await page.locator('#diagnostics button').evaluateAll(b => b.map(x => (x as HTMLElement).dataset.path)), expected); assert.match(await page.locator('#de-diag-note').innerText(), /Structure problems come first/);
   const entry = (path: string) => page.locator(`#diagnostics button[data-path="${path}"]`);
   assert.match(await entry('/steps/1/duration').innerText(), /^Discovery › duration\n/); await entry('/steps/1/duration').click(); const dur = await selection(); assert.match(dur.text, /^"duration": 0$/); assert.equal(dur.active, 'draft');
   await entry('/resources/0/capacity').click(); assert.match((await selection()).text, /^"capacity": 0$/); assert.match(await entry('/resources/0/capacity').innerText(), /^Resource .* › capacity/);
   await entry('/steps/2').click(); const block = await selection(); assert.equal(block.text, '{', 'a missing field selects the start of its block'); assert.match(await entry('/steps/2').innerText(), /Missing field: scene/);
   // With the structure repaired the relationship checks run and are listed too.
   const graph = JSON.parse(JSON.stringify((await query(page)).definition)) as LWProcess.Definition; graph.flows[0]!.to = 'nowhere'; graph.steps[1]!.resources = {ghost: 1};
   await area.fill(JSON.stringify(graph)); await inSync(); const expectedGraph = await page.evaluate(text => (globalThis as unknown as {LWProcessCatalog: LWProcess.Catalog}).LWProcessCatalog.validate(JSON.parse(text), true).diagnostics.length, await draftText());
   assert(expectedGraph >= 2); assert.equal(await page.locator('#diagnostics button').count(), expectedGraph); assert.doesNotMatch(await page.locator('#de-diag-note').innerText(), /Structure problems come first/);
   // Format, the diff summary and the gutter.
   await page.locator('#de-format').click(); assert.equal(await draftText(), JSON.stringify(JSON.parse(await draftText()), null, 2)); assert.equal(await page.locator('#de-diff').isVisible(), true);
   assert.match(await page.locator('#draft-state').innerText(), /^Unapplied draft: .*changed/); await page.locator('#de-diff summary').click(); assert.match(await page.locator('#de-diff-list').innerText(), /changed/);
   const gutter = await page.evaluate(() => new Promise<{lines: number; numbers: number; top: number; areaTop: number}>(resolve => { const a = document.getElementById('draft') as HTMLTextAreaElement, g = document.getElementById('de-gutter')!; a.scrollTop = 600; requestAnimationFrame(() => requestAnimationFrame(() => resolve({lines: a.value.split('\n').length, numbers: g.textContent!.split('\n').length, top: g.scrollTop, areaTop: a.scrollTop}))); }));
   assert.equal(gutter.lines, gutter.numbers); assert.equal(gutter.top, gutter.areaTop); assert(gutter.areaTop > 0);
   // Copy uses the clipboard and falls back to selecting everything.
   await page.evaluate(() => { (globalThis as any).copied = null; Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: (t: string) => { (globalThis as any).copied = t; return Promise.resolve(); }}}); });
   await page.locator('#de-copy').click(); assert.match(await page.locator('#de-copy-note').innerText(), /Copied/); assert.equal(await page.evaluate(() => (globalThis as any).copied === (document.getElementById('draft') as HTMLTextAreaElement).value), true);
   await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: () => Promise.reject(new Error('blocked'))}}));
   await page.locator('#de-copy').click(); assert.match(await page.locator('#de-copy-note').innerText(), /selected.*Ctrl\+C/); const all = await selection(); assert.equal(all.text, await draftText());
   const box = (await area.boundingBox())!, wide = await page.evaluate(() => getComputedStyle(document.getElementById('draft')!)); assert(box.height >= 320); assert.match(wide.fontFamily, /mono/i); assert.equal(await area.getAttribute('wrap'), 'off');
   await restoreDef(); await closeDef();
  });
  await check('Definition editor asks before restoring or applying over a run in progress', async () => {
   await page.setViewportSize({width: 1440, height: 1060});
   await freshStudio(); await page.locator('#advance').click(); const before = await query(page); assert.equal(before.snapshot.minute, 30);
   await openDef(); assert.equal(await page.locator('#de-restore').isDisabled(), true); assert.match(await page.locator('#de-reason').innerText(), /Restore is unavailable while the draft matches/);
   await page.locator('#tune-name').fill('Edited while running'); assert.equal(await page.locator('#de-restore').isDisabled(), false); const edited = await draftText();
   await page.locator('#de-restore').click(); assert.equal(await page.locator('#de-confirm').isVisible(), true); assert.equal(await page.locator('#de-confirm-title').innerText(), 'Replace the draft with the running definition?');
   assert.deepEqual(await page.locator('#de-choices button').allInnerTexts(), ['Download draft first', 'Restore', 'Keep draft']); assert.equal(await activeId(), 'de-keep');
   await page.keyboard.press('Escape'); assert.equal(await page.locator('#de-confirm').isHidden(), true); assert.equal(await dialogOpen(), 1); assert.equal(await draftText(), edited); assert.equal(await activeId(), 'de-restore');
   await page.locator('#de-restore').click(); const pending = page.waitForEvent('download'); await page.locator('#de-download-first').click(); const saved = await pending; const file2 = path.join(dir, 'before-restore.json'); await saved.saveAs(file2); assert.equal(fs.readFileSync(file2, 'utf8'), edited);
   assert.equal(await draftText(), edited, 'downloading does not restore'); await page.locator('#de-restore').click(); await page.locator('#de-keep').click(); assert.equal(await draftText(), edited);
   await restoreDef(); assert.equal(await draftText(), JSON.stringify(before.definition, null, 2)); assert.equal(await page.locator('#de-message').innerText(), 'Draft restored from the running definition.'); assert.equal(await page.locator('#de-restore').isDisabled(), true);
   // Applying past minute 0 names the minute that is discarded.
   await page.locator('#draft').fill('{bad'); await page.locator('#de-apply').click(); assert.equal(await page.locator('#de-status').getAttribute('role'), 'alert'); assert.equal(await page.locator('#de-confirm').isHidden(), true, 'an invalid draft is refused before asking'); assert.equal((await query(page)).snapshot.minute, 30);
   await page.locator('#tune-name').count(); await restoreDef(); await page.locator('#tune-name').fill('Applied over a run'); await page.locator('#de-apply').click();
   assert.equal(await page.locator('#de-confirm-title').innerText(), 'Applying starts a fresh paused run and discards minute 30. Export the run report first if you need it.'); assert.equal(await activeId(), 'de-back'); assert.equal(await page.locator('#de-apply-reset').innerText(), 'Apply and reset');
   assert.deepEqual((await query(page)).definition, before.definition); await page.keyboard.press('Escape'); assert.equal(await page.locator('#de-confirm').isHidden(), true); assert.equal(await dialogOpen(), 1); assert.equal((await query(page)).snapshot.minute, 30);
   await page.locator('#de-apply').click(); await page.locator('#de-back').click(); assert.equal((await query(page)).snapshot.minute, 30);
   await page.locator('#de-apply').click(); await page.locator('#de-apply-reset').click(); await defOpen.waitFor({state: 'hidden'});
   const after = await query(page); assert.equal(after.snapshot.minute, 0); assert.equal(after.definition.name, 'Applied over a run'); assert.equal(after.definition.revision, before.definition.revision + 1); assert.equal(await activeId(), 'open-definition');
  });
  await check('Definition editor reflows to a full sheet at phone width without horizontal overflow', async () => {
   await page.setViewportSize({width: 1440, height: 1060});
   await freshStudio(); await page.setViewportSize({width: 390, height: 844}); await nextFrames(page); await page.locator('#open-definition').click(); await defOpen.waitFor();
   const geometry = await page.evaluate(() => {
    const d = document.querySelector('dialog.de-dialog') as HTMLElement, r = d.getBoundingClientRect(), foot = d.querySelector('.pd-foot')!.getBoundingClientRect(), head = d.querySelector('.pd-head')!.getBoundingClientRect(), visible = (n: Element) => n.getClientRects().length > 0;
    const wide = [...d.querySelectorAll<HTMLElement>('input, select, textarea, button')].filter(n => visible(n) && (n.getBoundingClientRect().right > r.right + 0.5 || n.getBoundingClientRect().left < r.left - 0.5)).map(n => n.id || n.textContent);
    const small = [...d.querySelectorAll<HTMLElement>('input[type=text], input[type=number], select, textarea, button')].filter(n => visible(n) && n.getBoundingClientRect().height < 43.5).map(n => n.id || n.textContent);
    return {x: r.x, y: r.y, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight, page: document.documentElement.scrollWidth > innerWidth, own: d.scrollWidth > d.clientWidth, footBottom: foot.bottom, headTop: head.top, wide, small,
     tabs: visible(d.querySelector('.de-tabs')!), form: visible(d.querySelector('#de-pane-form')!), json: visible(d.querySelector('#de-pane-json')!)};
   });
   assert.deepEqual([geometry.x, geometry.y, geometry.w, geometry.h], [0, 0, geometry.vw, geometry.vh]); assert.equal(geometry.page, false); assert.equal(geometry.own, false); assert.deepEqual(geometry.wide, []); assert.deepEqual(geometry.small, [], 'touch targets are 44px');
   assert.equal(geometry.headTop, 0); assert.equal(Math.round(geometry.footBottom), geometry.vh); assert.deepEqual([geometry.tabs, geometry.form, geometry.json], [true, true, false]);
   await page.locator('#tune-arr-0').scrollIntoViewIfNeeded(); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); await page.screenshot({path: path.join(OUT, 'process-definition-mobile-form.png')});
   await page.locator('#de-tab-json').click(); assert.equal(await page.locator('#de-pane-json').isVisible(), true); assert.equal(await page.locator('#de-pane-form').isVisible(), false); assert.equal(await page.locator('#de-tab-json').getAttribute('aria-pressed'), 'true');
   assert((await page.locator('#draft').boundingBox())!.height >= 320); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); await page.screenshot({path: path.join(OUT, 'process-definition-mobile-json.png')});
   await page.setViewportSize({width: 800, height: 900}); await nextFrames(page); assert.equal(await page.locator('.de-tabs').isVisible(), true, 'tabs below 1000px'); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
   await page.setViewportSize({width: 1440, height: 1060}); await nextFrames(page);
   const columns = await page.evaluate(() => { const f = document.getElementById('de-pane-form')!.getBoundingClientRect(), j = document.getElementById('de-pane-json')!.getBoundingClientRect(), d = document.querySelector('dialog.de-dialog')!.getBoundingClientRect(); return {tabs: document.querySelector('.de-tabs')!.getClientRects().length, fx: f.x, jx: j.x, fw: f.width, jw: j.width, dw: d.width}; });
   assert.equal(columns.tabs, 0); assert(columns.fx < columns.jx && columns.fw > 300 && columns.jw > 300); assert(columns.dw <= 1000 && columns.dw > 900); await page.screenshot({path: path.join(OUT, 'process-definition-desktop.png')}); await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 0);
  });
  await check('Step editor routes to the Definition editor for an invalid draft', async () => {
   await page.setViewportSize({width: 1440, height: 1060});
   await freshStudio(); await openDef(); await page.locator('#draft').fill('{bad'); await closeDef(); await page.locator('[data-step="discovery"]').click();
   await page.locator('#edit-step').click(); await defOpen.waitFor(); assert.equal(await dialogOpen(), 1); assert.equal(await page.locator('#se-title').isVisible(), false); assert.equal(await activeId(), 'draft');
   assert.match(await page.locator('#draft-state').innerText(), /^Invalid JSON: line 1, column 2/); assert.equal(await page.evaluate(() => (document.getElementById('draft') as HTMLTextAreaElement).selectionStart), 1);
   await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 0); assert.equal(await activeId(), 'edit-step', 'focus returns to the button that was used'); await openDef(); await restoreDef(); await closeDef();
   // A valid draft with problems elsewhere: the step editor's link closes it and opens the Definition editor on the problem.
   await openDef(); const raw = await defOf(); delete raw.steps[1]!.duration; await page.locator('#draft').fill(JSON.stringify(raw)); await closeDef();
   await page.locator('[data-step="implementation"]').click(); await page.locator('#edit-step').click(); await page.locator('#se-name').waitFor(); await page.locator('#se-status [data-act="open-definition"]').click(); await defOpen.waitFor();
   assert.equal(await dialogOpen(), 1, 'one modal at a time'); assert.equal(await page.locator('#se-title').isVisible(), false); assert.equal(await activeId(), 'draft'); assert.match(await page.locator('#diagnostics').innerText(), /Discovery › duration/);
   await page.keyboard.press('Escape'); assert.equal(await activeId(), 'open-definition'); assert.equal(await dialogOpen(), 0);
   // A step editor with unsaved edits asks first; keeping them keeps the step editor, discarding opens the Definition editor.
   await page.locator('#edit-step').click(); await page.locator('#se-name').fill('Unsaved rename'); await page.locator('#se-status [data-act="open-definition"]').click();
   assert.equal(await page.locator('#se-confirm').isVisible(), true); await page.locator('#se-keep').click(); assert.equal(await dialogOpen(), 1); assert.equal(await page.locator('#se-title').isVisible(), true); assert.equal(await page.locator('#se-name').inputValue(), 'Unsaved rename');
   await page.locator('#se-status [data-act="open-definition"]').click(); await page.locator('#se-discard').click(); await defOpen.waitFor(); assert.equal(await dialogOpen(), 1); assert.doesNotMatch(await draftText(), /Unsaved rename/);
   await restoreDef(); await closeDef();
  });
  const journeyLine = () => ({format: 'wildlands-process', schemaVersion: 1, revision: 1, id: 'web-shop-journey', name: 'Web shop journey', genre: 'customer-journey', start: 'start',
   resources: [{id: 'crew', name: 'Support crew', capacity: 2, costPerMinute: 1}, {id: 'platform', name: 'Shop platform', capacity: 2, costPerMinute: 1, kind: 'system'}, {id: 'kiosk', name: 'Pickup kiosk', capacity: 1, costPerMinute: 1, kind: 'machine'}],
   steps: [{id: 'start', name: 'Start', kind: 'start', scene: scene('start', 0)},
    {id: 'ad', name: 'Sees an ad', kind: 'touchpoint', channel: 'social', phase: 'Awareness', emotion: 1, duration: 1, add: {mood: 1}, scene: scene('ad', 14)},
    {id: 'browse', name: 'Browses the shop', kind: 'touchpoint', channel: 'web', phase: 'Consideration', emotion: 1, duration: 3, resources: {platform: 1}, add: {mood: 1}, pain: 'Search results are slow.', scene: scene('browse', 28)},
    {id: 'intent', name: 'Wants to buy?', kind: 'decision', scene: scene('intent', 42)}, {id: 'checkout', name: 'Checks out', kind: 'touchpoint', channel: 'web', phase: 'Purchase', emotion: -1, duration: 4, add: {mood: -1}, scene: scene('checkout', 56)},
    {id: 'pack', name: 'Pack the order', kind: 'task', duration: 6, resources: {crew: 1}, set: {packed: true}, scene: scene('pack', 70)},
    {id: 'won', name: 'Parcel delivered', kind: 'end', scene: scene('won', 84)}, {id: 'lost', name: 'Left the shop', kind: 'end', scene: scene('lost', 98)}],
   flows: [{id: 'f1', from: 'start', to: 'ad'}, {id: 'f2', from: 'ad', to: 'browse'}, {id: 'f3', from: 'browse', to: 'intent'}, {id: 'f4', from: 'intent', to: 'lost', when: {chance: 30}}, {id: 'f5', from: 'intent', to: 'checkout'},
    {id: 'f6', from: 'checkout', to: 'pack'}, {id: 'f7', from: 'pack', to: 'won'}],
   arrivals: [{at: 0, count: 6, interval: 2, data: {}}]});
  const importJourney = async () => {
   await freshStudio(); const name = 'web-shop-journey.json';
   await page.locator('#file').setInputFiles({name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(journeyLine()))});
   await page.waitForFunction(n => document.getElementById('message')!.textContent!.includes('Imported ' + n), name);
  };
  await check('Step editor edits touchpoints with channels, phases, feelings, pain points and end outcomes', async () => {
   // The plain-language helpers are pure: words for feelings, channels and outcomes, and nothing for values outside the contract.
   const words = await page.evaluate(() => {
    const v = (globalThis as any).LWProcessRandomView;
    return {emotions: [-3, -2, -1, 0, 1, 2, 3, 4, 1.5, undefined].map(v.describeEmotion), channels: [...v.CHANNELS.map((c: [string, string]) => v.describeChannel(c[0])), v.describeChannel('fax'), v.describeChannel(undefined)], outcomes: [v.describeOutcome('goal'), v.describeOutcome('lost'), v.describeOutcome(undefined), v.describeOutcome('toString')]};
   });
   assert.deepEqual(words.emotions, ['Very frustrated', 'Frustrated', 'Slightly annoyed', 'Neutral', 'Pleased', 'Happy', 'Delighted', '', '', '']);
   assert.deepEqual(words.channels, ['Website', 'Mobile app', 'Physical store', 'Phone call', 'Chat', 'Email', 'Social media', 'Advertising', 'Delivery', 'Documents and forms', '', '']);
   assert.deepEqual(words.outcomes, ['Goal reached', 'Customer or user lost', '', '']);
   await importJourney(); const dlg = page.locator('dialog.pd-dialog[open]');
   const openStep = async (id: string) => { await page.locator(`[data-step="${id}"]`).click(); await page.locator('#edit-step').click(); await dlg.waitFor(); };
   // A touchpoint: Journey section, backstage pools of any kind with kind badges, no requirement and no technology.
   await openStep('browse'); assert.equal(await page.locator('#se-chip').innerText(), 'touchpoint'); assert.equal(await page.locator('#se-h-journey').innerText(), 'Journey');
   assert.equal(await page.locator('#se-h-people').innerText(), 'Backstage teams and systems (optional)'); assert.match(await page.locator('#se-h-people + .se-help').innerText(), /Customers and users are not a pool and never consume capacity/);
   assert.equal(await page.locator('#se-h-automation').count(), 0); assert.equal(await page.locator('#se-technology').count(), 0); assert.equal(await page.locator('#se-no-pools').count(), 0); assert.equal(await page.locator('#se-h-notes').count(), 0);
   assert.deepEqual(await page.locator('#se-h-people').locator('xpath=..').locator('.se-badge').allInnerTexts(), ['People', 'System', 'Machine']);
   assert.equal(await dlg.getByLabel('Support crew').count(), 1); assert.equal(await dlg.getByLabel('Shop platform').count(), 1); assert.equal(await dlg.getByLabel('Pickup kiosk').count(), 1);
   assert.match(await page.locator('#se-h-timing').innerText(), /Timing and cost/); assert.match(await dlg.innerText(), /Touchpoint duration/); assert.equal(await page.locator('#se-h-random-timing').count(), 1); assert.equal(await page.locator('#se-h-random-outcomes').count(), 1);
   assert.deepEqual(await page.locator('#se-channel option').allInnerTexts(), ['Not set', 'Website', 'Mobile app', 'Physical store', 'Phone call', 'Chat', 'Email', 'Social media', 'Advertising', 'Delivery', 'Documents and forms']);
   assert.deepEqual(await page.locator('#se-emotion option').allInnerTexts(), ['Not set', 'Very frustrated (-3)', 'Frustrated (-2)', 'Slightly annoyed (-1)', 'Neutral (0)', 'Pleased (+1)', 'Happy (+2)', 'Delighted (+3)']);
   assert.deepEqual([await page.locator('#se-channel').inputValue(), await page.locator('#se-emotion').inputValue(), await page.locator('#se-phase').inputValue(), await page.locator('#se-pain').inputValue(), await page.locator('#se-opportunity').inputValue()], ['web', '1', 'Consideration', 'Search results are slow.', '']);
   assert.deepEqual(await page.locator('#se-phase-list option').evaluateAll(o => o.map(n => (n as HTMLOptionElement).value)), ['Awareness', 'Consideration', 'Purchase']); assert.equal(await page.locator('#se-phase').getAttribute('list'), 'se-phase-list');
   assert.equal(await page.locator('#se-needs-summary').innerText(), 'Needs: 1 Shop platform');
   await page.locator('#se-channel').selectOption('mobile'); await page.locator('#se-emotion').selectOption('-2'); await page.locator('#se-phase').fill('Consideration'); await page.locator('#se-pain').fill('The cart empties when the app restarts.'); await page.locator('#se-opportunity').fill('Keep the cart for a week.');
   await dlg.getByLabel('Pickup kiosk').fill('1'); assert.equal(await page.locator('#se-needs-summary').innerText(), 'Needs: 1 Shop platform, 1 Pickup kiosk');
   // The engine's own problem shows beside the pool, in plain words, and blocks saving until it is fixed.
   await dlg.getByLabel('Pickup kiosk').fill('3'); assert.match(await page.locator('#se-err-pools-2').innerText(), /Pickup kiosk has only 1 available; ask for 1 or fewer/); assert.equal(await page.locator('#se-pools-2-count').getAttribute('aria-invalid'), 'true');
   await dlg.getByLabel('Pickup kiosk').fill('0'); assert.equal(await page.locator('#se-err-pools-2').innerText(), ''); await dlg.getByLabel('Shop platform').fill('0');
   assert.equal(await page.locator('#se-status').innerText(), '', 'a touchpoint with no backstage pool at all is valid: it never waits for capacity'); assert.equal(await page.locator('#se-save').isEnabled(), true);
   await page.locator('#se-save').click(); assert.equal(await dialogOpen(), 0);
   let browse = await savedStep('browse'); assert.deepEqual([browse.channel, browse.emotion, browse.phase, browse.pain, browse.opportunity, browse.resources, browse.kind], ['mobile', -2, 'Consideration', 'The cart empties when the app restarts.', 'Keep the cart for a week.', undefined, 'touchpoint']);
   // Clearing the notes removes the keys again instead of writing empty strings.
   await openStep('browse'); await page.locator('#se-channel').selectOption(''); await page.locator('#se-emotion').selectOption(''); await page.locator('#se-pain').fill('  '); await page.locator('#se-save').click();
   browse = await savedStep('browse'); for (const key of ['channel', 'emotion', 'pain'] as const) assert.equal(Object.hasOwn(browse, key), false, key + ' is removed when cleared');
   await openStep('ad'); assert.equal(await page.locator('#se-channel').inputValue(), 'social'); await page.locator('#se-channel').selectOption('phone'); await page.locator('#se-emotion').selectOption('3'); await page.locator('#se-save').click();
   // Every other kind keeps its own sections and gets collapsed Journey notes, so a business process can use phases too.
   await openStep('pack'); assert.equal(await page.locator('#se-chip').innerText(), 'task'); assert.equal(await page.locator('#se-h-journey').count(), 0); assert.equal(await page.locator('#se-channel').count(), 0); assert.equal(await page.locator('#se-outcome').count(), 0);
   assert.equal(await dlg.getByLabel('Shop platform').count(), 0, 'a task still demands only people pools'); assert.equal(await dlg.getByLabel('Support crew').count(), 1);
   assert.equal(await page.locator('#se-notes').evaluate((e: HTMLDetailsElement) => e.open), false); assert.equal(await page.locator('#se-h-notes').innerText(), 'Journey notes (optional)'); assert.equal(await page.locator('#se-phase').isVisible(), false);
   await page.locator('#se-h-notes').click(); assert.equal(await page.locator('#se-phase').isVisible(), true); await page.locator('#se-phase').fill('Fulfilment'); await page.locator('#se-emotion').selectOption('2'); await page.locator('#se-opportunity').fill('Pack within the hour.');
   await page.locator('#se-add-set').click(); assert.equal(await page.locator('#se-notes').evaluate((e: HTMLDetailsElement) => e.open), true, 'the notes stay open after the form is rebuilt'); assert.equal(await page.locator('#se-phase').inputValue(), 'Fulfilment');
   await page.locator('[data-bind="set.1.key"]').fill('boxed'); await page.locator('#se-save').click();
   const pack = await savedStep('pack'); assert.deepEqual([pack.phase, pack.emotion, pack.opportunity, pack.channel, pack.set], ['Fulfilment', 2, 'Pack within the hour.', undefined, {packed: true, boxed: true}]);
   // A start step gets notes but no outcome; end steps get the Outcome select.
   await openStep('start'); assert.equal(await page.locator('#se-notes').count(), 1); assert.equal(await page.locator('#se-outcome').count(), 0); await page.locator('#se-close').click();
   await openStep('won'); assert.equal(await page.locator('#se-h-outcome').innerText(), 'Outcome'); assert.deepEqual(await page.locator('#se-outcome option').allInnerTexts(), ['None', 'Goal reached', 'Customer or user lost']); assert.equal(await page.locator('#se-outcome').inputValue(), '');
   assert.equal(await page.locator('#se-h-notes').count(), 1); await page.locator('#se-outcome').selectOption('goal'); await page.locator('#se-save').click();
   await openStep('lost'); await page.locator('#se-outcome').selectOption('lost'); await page.locator('#se-save').click();
   assert.equal((await savedStep('won')).outcome, 'goal'); assert.equal((await savedStep('lost')).outcome, 'lost');
   await openStep('lost'); assert.equal(await page.locator('#se-outcome').inputValue(), 'lost'); await page.locator('#se-outcome').selectOption(''); await page.locator('#se-save').click(); assert.equal(Object.hasOwn(await savedStep('lost'), 'outcome'), false);
   await openStep('lost'); await page.locator('#se-outcome').selectOption('lost'); await page.locator('#se-save').click();
   // Applying through the Definition editor starts a fresh run, so the engine accepted the journey fields the editor wrote.
   await openDef(); await applyDef(); const applied = await query(page);
   assert.equal(await page.evaluate(d => (globalThis as any).LWProcessCatalog.validate(d).ok, applied.definition), true); assert.equal(applied.snapshot.minute, 0);
   const byId = (id: string) => applied.definition.steps.find(s => s.id === id)!;
   assert.deepEqual([byId('ad').channel, byId('ad').emotion, byId('won').outcome, byId('lost').outcome, byId('pack').phase], ['phone', 3, 'goal', 'lost', 'Fulfilment']); assert.equal(applied.definition.genre, 'customer-journey');
   await page.locator('#advance').click(); assert.equal((await query(page)).playing, false);
  });
  await check('Definition editor edits the process type and tracked measures with inline problems', async () => {
   await page.setViewportSize({width: 1440, height: 1060}); await importJourney(); await openDef();
   const genre = page.locator('#tune-genre'), track = (i: number, part: string) => page.locator(`#tune-track-${i}-${part}`), tracks = async () => (await defOf()).track;
   // Process type: three plain choices, each with its own one-sentence help; the default process is written as an absent key.
   assert.equal(await page.locator('label[for="tune-genre"]').innerText(), 'Process type'); assert.deepEqual(await page.locator('#tune-genre option').allInnerTexts(), ['Business process', 'Customer journey', 'User journey']); assert.equal(await genre.inputValue(), 'customer-journey');
   assert.match(await page.locator('#tune-genre-help').innerText(), /Cases are customers and steps are the touchpoints where they meet your business/); assert.match(await page.locator('#tune-genre-help').innerText(), /labels and the default view only/);
   await genre.selectOption('user-journey'); assert.equal((await defOf()).genre, 'user-journey'); assert.match(await page.locator('#tune-genre-help').innerText(), /Cases are users of a product or service/); assert.equal(await page.evaluate(() => document.activeElement?.id), 'tune-genre');
   await genre.selectOption('process'); assert.equal(Object.hasOwn(await defOf(), 'genre'), false); assert.match(await page.locator('#tune-genre-help').innerText(), /Cases are work items such as orders or tickets/); await genre.selectOption('customer-journey'); assert.equal((await defOf()).genre, 'customer-journey'); await inSync();
   // Tracked measures: the explanation, suggestions from fields the process already writes, and a bounded number of rows.
   assert.equal(await page.locator('#tune-h-track').innerText(), 'Tracked measures'); assert.equal(await page.locator('#tune-track-help').innerText(), 'The simulation averages these values when cases finish and at every step, to draw the measured curve. Choose up to 6 number fields, for example a mood score or a satisfaction rating.');
   assert.match(await page.locator('#tune-track-help').innerText(), /^The simulation averages these values when cases finish and at every step, to draw the measured curve/); assert.equal(await tracks(), undefined);
   assert.deepEqual(await page.locator('#tune-track-fields option').evaluateAll(o => o.map(n => (n as HTMLOptionElement).value)), ['mood', 'packed']);
   await page.locator('#tune-track-add').click(); assert.deepEqual(await tracks(), [{field: 'mood'}]); assert.equal(await page.evaluate(() => document.activeElement?.id), 'tune-track-0-field'); assert.equal(await track(0, 'field').getAttribute('list'), 'tune-track-fields');
   await track(0, 'label').fill('Mood'); assert.deepEqual(await tracks(), [{field: 'mood', label: 'Mood'}]); await track(0, 'label').fill(''); assert.deepEqual(await tracks(), [{field: 'mood'}]); await track(0, 'label').fill('Mood');
   // Inline problems: a repeated field is the engine's own message beside the row; a malformed name is explained.
   await page.locator('#tune-track-add').click(); assert.deepEqual((await tracks())!.map(t => t.field), ['mood', 'packed']); await track(1, 'field').fill('mood');
   assert.match(await page.locator('#tune-track-1-field-err').innerText(), /Tracked field mood is listed twice/); assert.equal(await track(1, 'field').getAttribute('aria-invalid'), 'true'); assert.match(await page.locator('#diagnostics').innerText(), /Tracked measure 2 › field/);
   assert.match(await page.locator('#tune-summary').innerText(), /1 problem in this form/);
   await track(1, 'field').fill('Bad name'); assert.match(await page.locator('#tune-track-1-field-err').innerText(), /Start with a lowercase letter/); assert.equal(await track(1, 'field').getAttribute('aria-invalid'), 'true');
   await track(1, 'field').fill('score'); assert.equal(await page.locator('#tune-track-1-field-err').innerText(), ''); assert.equal(await track(1, 'field').getAttribute('aria-invalid'), null); assert.equal(await page.locator('#diagnostics li').count(), 0);
   // At most six: the button disables with a visible reason, and removing a row enables it again.
   for (let i = 0; i < 4; i++) await page.locator('#tune-track-add').click();
   assert.equal((await tracks())!.length, 6); assert.equal(await page.locator('#tune-track-add').isDisabled(), true); assert.equal(await page.locator('#tune-track-full').innerText(), 'At most 6 measures are tracked.'); assert.equal(await page.locator('#tune-track-add').getAttribute('aria-describedby'), 'tune-track-full');
   assert.equal(await page.evaluate(d => (globalThis as any).LWProcessCatalog.validate(d).ok, await defOf()), true);
   await page.locator('[data-act="track-remove"][data-i="5"]').click(); assert.equal((await tracks())!.length, 5); assert.equal(await page.locator('#tune-track-add').isEnabled(), true); assert.equal(await page.locator('#tune-track-full').count(), 0);
   for (let i = 4; i >= 2; i--) await page.locator(`[data-act="track-remove"][data-i="${i}"]`).click();
   assert.deepEqual(await tracks(), [{field: 'mood', label: 'Mood'}, {field: 'score'}]); await page.locator('[data-act="track-remove"][data-i="1"]').click(); assert.equal(await page.evaluate(() => document.activeElement?.id), 'tune-track-add');
   // The Raw JSON pane names the new paths in plain words.
   const raw = JSON.parse(await draftText()) as Record<string, unknown>; raw.genre = 'funnel'; raw.track = [{field: 'Bad field'}]; await page.locator('#draft').fill(JSON.stringify(raw, null, 2));
   await page.waitForFunction(() => document.querySelectorAll('#diagnostics li').length > 0);
   const listed = await page.locator('#diagnostics').innerText(); assert.match(listed, /Process › process type/); assert.match(listed, /Tracked measure 1 › field/); assert.match(listed, /Expected one of process, customer-journey, user-journey/);
   await restoreDef(); await inSync();
   // Applying keeps the type and the measures, and the engine reports the tracked field under its label.
   await genre.selectOption('user-journey'); await page.locator('#tune-track-add').click(); await track(0, 'label').fill('Mood score'); await applyDef();
   const applied = await query(page); assert.deepEqual([applied.definition.genre, applied.definition.track], ['user-journey', [{field: 'mood', label: 'Mood score'}]]); assert.equal(await page.evaluate(d => (globalThis as any).LWProcessCatalog.validate(d).ok, applied.definition), true);
   for (let i = 0; i < 12 && !Object.hasOwn((await query(page)).snapshot.metrics.tracked, 'mood'); i++) await page.locator('#advance').click();
   assert.equal((await query(page)).snapshot.metrics.tracked.mood!.label, 'Mood score');
  });
  const actOpen = page.locator('dialog.act-dialog[open]'), actRows = () => page.locator('#act-rows tr');
  const feedFixture = (extra: object = {}) => ({format: 'wildlands-process', schemaVersion: 1, revision: 1, id: 'feed-line', name: 'Feed line', start: 'start',
   resources: [{id: 'crew', name: 'Operators', capacity: 2, costPerMinute: 1}],
   steps: [{id: 'start', name: 'Start', kind: 'start', scene: scene('start', 0)}, {id: 'work', name: '=1+1, "x"', kind: 'task', duration: 3, resources: {crew: 1}, scene: scene('work', 14)}, {id: 'end', name: 'Done', kind: 'end', scene: scene('end', 28)}],
   flows: [{id: 'f1', from: 'start', to: 'work'}, {id: 'f2', from: 'work', to: 'end'}], arrivals: [{at: 0, open: true, interval: 1, data: {}}], ...extra});
  const importJson = async (name: string, definition: object) => {
   await page.locator('#file').setInputFiles({name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(definition))});
   await page.waitForFunction(n => document.getElementById('message')!.textContent!.includes('Imported ' + n), name);
  };
  const importFeed = async (extra: object = {}) => { await freshStudio(); await importJson('feed-line.json', feedFixture(extra)); };
  await check('Activity opens as a modal from the toolbar, filters, links to steps and exports without pausing the run', async () => {
   await page.setViewportSize({width: 1440, height: 1060}); await freshStudio();
   const opener = page.locator('#open-activity');
   assert.equal(await opener.getAttribute('aria-haspopup'), 'dialog'); assert.match(await opener.innerText(), /^Activity/); assert.equal(await actOpen.count(), 0, 'the modal never opens by itself');
   assert.equal(await page.locator('#show-events').count() + await page.locator('.process-bottom').count() + await page.locator('#events').count(), 0, 'the bottom Activity tab, panel and 25-event list are gone');
   const placed = await page.evaluate(() => { const o = document.getElementById('open-activity')!, g = o.parentElement!, c = document.getElementById('clock')!.getBoundingClientRect(), b = o.getBoundingClientRect();
    return {group: g.className, before: [...g.children].indexOf(o) < [...g.children].indexOf(document.getElementById('clock')!.parentElement!), gap: c.left - b.right, sameRow: Math.abs(c.top + c.height / 2 - (b.top + b.height / 2)) < 20}; });
   assert.deepEqual([placed.group, placed.before, placed.gap >= 0 && placed.gap < 40, placed.sameRow], ['run-status', true, true, true], 'the opener sits immediately left of the clock');
   // Opening while the run plays does not pause it.
   await page.locator('#horizon').selectOption('1440'); await page.locator('#play').click();
   await page.waitForFunction(() => (globalThis as any).LWProcessStudio.query().snapshot.minute > 0);
   await opener.click(); await actOpen.waitFor(); assert.equal(await page.evaluate(() => document.querySelector('dialog.act-dialog')!.matches(':modal')), true); assert.equal(await page.getByRole('dialog', {name: 'Run activity'}).count(), 1);
   const running = await query(page); assert.equal(running.playing, true);
   await page.waitForFunction(m => (globalThis as any).LWProcessStudio.query().snapshot.minute > m, running.snapshot.minute); assert.equal((await query(page)).playing, true, 'the run keeps playing behind the modal');
   assert.deepEqual(await page.locator('#act-scroll thead th').allInnerTexts(), ['Minute', 'Case', 'Event', 'Step', 'Detail']); assert.match(await page.locator('#act-subtitle').innerText(), /^Minute [\d,]+ · (showing the latest \d+ of \d+ events|\d+ events)$/);
   assert.equal(await page.locator('#act-rows').evaluate(e => !e.closest('[aria-live]') && !e.closest('[role=status]')), true, 'the list itself is never a live region');
   assert.deepEqual(await page.locator('#act-scroll thead th').evaluateAll(h => h.map(x => getComputedStyle(x).position)), ['sticky', 'sticky', 'sticky', 'sticky', 'sticky']);
   assert.equal(await page.locator('#act-scroll').evaluate(e => getComputedStyle(e).overflowY), 'auto');
   await page.keyboard.press('Escape'); assert.equal(await activeId(), 'open-activity'); await page.locator('#play').click(); assert.equal((await query(page)).playing, false);
   // Filters over the retained events (newest first).
   await opener.click(); await actOpen.waitFor(); const events = (await query(page)).snapshot.events, cell = async (col: number) => page.locator(`#act-rows tr td:nth-child(${col})`).allInnerTexts();
   assert.equal(await actRows().count(), events.length); assert.deepEqual((await cell(1)).map(t => Number(t.replace(',', ''))), [...events].reverse().map(e => e.minute));
   const kinds = await page.locator('#act-kind option').allInnerTexts(); assert.equal(kinds[0], 'All kinds'); for (const k of ['arrived', 'started', 'entered']) assert(kinds.includes(k), k + ' in ' + kinds.join('|'));
   await page.locator('#act-kind').selectOption('started'); const started = events.filter(e => e.kind === 'started');
   assert.equal(await actRows().count(), started.length); assert.deepEqual([...new Set(await cell(3))], ['started']); assert.match(await page.locator('#act-subtitle').innerText(), new RegExp(`· ${started.length} match$`));
   await page.locator('#act-step').selectOption('discovery'); assert.deepEqual([...new Set(await page.locator('#act-rows .act-step').allInnerTexts())], ['Discovery']);
   await page.locator('#act-case').selectOption('case-0001'); assert.deepEqual([...new Set(await cell(2))], ['case-0001']);
   await page.locator('#act-clear').click(); assert.equal(await actRows().count(), events.length); assert.equal(await page.locator('#act-clear').isHidden(), true);
   await page.locator('#act-kind').selectOption('arrived'); await page.locator('#act-step').selectOption('discovery');
   assert.match(await page.locator('#act-rows').innerText(), /No events match these filters\. Clear filters/); assert.equal(await page.locator('#act-csv').isDisabled(), true); assert.equal(await page.locator('#act-json').isDisabled(), true); assert.match(await page.locator('#act-reason').innerText(), /no events to export/i);
   await page.locator('[data-act-clear]').click(); assert.equal(await actRows().count(), events.length);
   // A step name selects that step, closes the modal and moves focus to the step's list item.
   await page.locator('#act-step').selectOption('discovery'); await page.locator('#act-rows .act-step').first().click(); assert.equal(await actOpen.count(), 0);
   assert.equal((await query(page)).selected, 'discovery'); assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.step), 'discovery');
   // Exports respect the filters and are named after the process.
   await opener.click(); await actOpen.waitFor(); assert.equal(await page.locator('#act-step').inputValue(), 'discovery', 'filters are kept between openings');
   await page.locator('#act-step').selectOption(''); await page.locator('#act-kind').selectOption('started'); const id = (await query(page)).definition.id;
   let pending = page.waitForEvent('download'); await page.locator('#act-csv').click(); let saved = await pending; assert.equal(saved.suggestedFilename(), id + '.events.csv');
   const csvFile = path.join(dir, 'events.csv'); await saved.saveAs(csvFile); const lines = fs.readFileSync(csvFile, 'utf8').trim().split('\r\n');
   assert.equal(lines[0], 'minute,case,event,step_id,step,detail'); assert.equal(lines.length - 1, started.length); assert(lines.slice(1).every(l => l.split(',')[2] === 'started'));
   pending = page.waitForEvent('download'); await page.locator('#act-json').click(); saved = await pending; assert.equal(saved.suggestedFilename(), id + '.events.json');
   const jsonFile = path.join(dir, 'events.json'); await saved.saveAs(jsonFile); const exported = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
   assert.equal(exported.format, 'wildlands-process-events'); assert.equal(exported.process, id); assert.equal(exported.filters.kind, 'started'); assert.equal(exported.events.length, started.length);
   assert.deepEqual(exported.events.map((e: {minute: number}) => e.minute), started.map(e => e.minute), 'exported oldest first'); assert.equal(await actOpen.count(), 1, 'exporting keeps the modal open');
   await page.keyboard.press('Escape'); assert.equal(await activeId(), 'open-activity');
   // CSV is escaped (quotes, commas) and spreadsheet formulas are neutralised; an empty feed explains itself.
   await importFeed(); await page.locator('#step').click(); await opener.click(); await actOpen.waitFor(); await page.locator('#act-kind').selectOption('started');
   pending = page.waitForEvent('download'); await page.locator('#act-csv').click(); saved = await pending; const feedCsv = path.join(dir, 'feed.csv'); await saved.saveAs(feedCsv);
   const csv = fs.readFileSync(feedCsv, 'utf8'); assert(csv.includes(`"'=1+1, ""x"""`), csv); await page.keyboard.press('Escape');
   await importFeed({arrivals: [{at: 100, count: 1, interval: 0, data: {}}]}); await opener.click(); await actOpen.waitFor();
   assert.match(await page.locator('#act-rows').innerText(), /No events yet\. Run the simulation\./); assert.match(await page.locator('#act-subtitle').innerText(), /^Minute 0 · 0 events$/); assert.equal(await page.locator('#act-csv').isDisabled(), true); await page.keyboard.press('Escape');
  });
  await check('Activity freezes while scrolled and shows a new-events pill, the badge counts unseen events', async () => {
   await page.setViewportSize({width: 1440, height: 1060}); await importFeed();
   const opener = page.locator('#open-activity'), label = () => opener.getAttribute('aria-label');
   await page.locator('#step').click(); const few = await opener.innerText(); assert.match(few, /^Activity · \d+$/); const n = Number(few.split('· ')[1]); assert(n >= 1 && n < 99, few);
   assert.equal(await label(), `Activity, ${n} new event${n === 1 ? '' : 's'}`);
   await opener.click(); await actOpen.waitFor(); await page.keyboard.press('Escape'); assert.equal(await opener.innerText(), 'Activity', 'opening marks the events as seen'); assert.equal(await label(), 'Activity');
   await page.locator('#advance').click(); await page.locator('#advance').click(); assert.equal(await opener.innerText(), 'Activity · 99+'); assert.equal(await label(), 'Activity, more than 99 new events');
   await opener.click(); await actOpen.waitFor(); assert.match(await page.locator('#act-subtitle').innerText(), /showing the latest 128 of \d+ events/); assert.equal(await actRows().count(), 128);
   assert.equal(await page.locator('#act-note').isVisible(), true); assert.match(await page.locator('#act-note').innerText(), /Earlier events are not kept/); await page.keyboard.press('Escape'); assert.equal(await opener.innerText(), 'Activity');
   // Live: at the top the list follows the run; scrolled or with a filter focused it freezes and a status pill offers the update.
   await page.locator('#play').click(); await opener.click(); await actOpen.waitFor();
   const newest = () => page.locator('#act-rows tr td').first().innerText(), start = await newest();
   await page.waitForFunction(first => document.querySelector('#act-rows tr td')?.textContent !== first, start);
   assert.equal(await page.locator('.act-live').getAttribute('role'), 'status'); assert.equal(await page.locator('#act-new').isHidden(), true);
   await page.locator('#act-scroll').evaluate(e => { e.scrollTop = 240; });
   await page.locator('#act-new').waitFor(); assert.match(await page.locator('#act-new').innerText(), /^\d+ new events? — Show$/);
   const frozen = await page.locator('#act-rows').innerHTML(), count = Number((await page.locator('#act-new').innerText()).split(' ')[0]);
   await page.waitForFunction(c => Number(document.getElementById('act-new')!.textContent!.split(' ')[0]) > c, count); assert.equal(await page.locator('#act-rows').innerHTML(), frozen, 'a scrolled list does not move');
   assert(await page.locator('#act-scroll').evaluate(e => e.scrollTop) >= 200); assert.equal((await query(page)).playing, true);
   await page.locator('#act-new').click(); assert.equal(await page.locator('#act-new').isHidden(), true); assert.equal(await page.locator('#act-scroll').evaluate(e => e.scrollTop), 0); assert.notEqual(await newest(), start);
   await page.locator('#act-kind').focus(); await page.locator('#act-new').waitFor(); const held = await page.locator('#act-rows').innerHTML(); await page.waitForFunction(() => Number(document.getElementById('act-new')!.textContent!.split(' ')[0]) > 1);
   assert.equal(await page.locator('#act-rows').innerHTML(), held, 'a focused filter holds the list'); await page.locator('#act-done').focus(); await page.locator('#act-new').waitFor({state: 'hidden'});
   await page.keyboard.press('Escape');
   // The announcer: a visually hidden polite status that batches at most one sentence per five seconds.
   const announcer = page.locator('#feed-announcer'); assert.deepEqual([await announcer.getAttribute('role'), await announcer.getAttribute('aria-live'), await announcer.getAttribute('aria-atomic')], ['status', 'polite', 'true']);
   const box = (await announcer.boundingBox())!; assert(box.width <= 1 && box.height <= 1);
   await page.evaluate(() => { const w = globalThis as any, node = document.getElementById('feed-announcer')!; w.feed = []; new MutationObserver(() => w.feed.push({t: performance.now(), text: node.textContent})).observe(node, {childList: true, characterData: true, subtree: true}); });
   await page.waitForFunction(() => (globalThis as any).feed.length >= 2, undefined, {timeout: 25000}); const feed = await page.evaluate(() => (globalThis as any).feed as {t: number; text: string}[]);
   assert(feed[1]!.t - feed[0]!.t >= 4500, 'one announcement per ~5 s'); assert.match(feed[0]!.text, /^\d+ new events?, latest: case-\d+ \S/); await page.locator('#play').click();
  });
  await check('Header and toolbar fit one desktop viewport without document scrolling and keep exports in a menu', async () => {
   await page.setViewportSize({width: 1366, height: 768}); await freshStudio();
   const fits = () => page.evaluate(() => { const r = (s: string) => document.querySelector(s)!.getBoundingClientRect(), view = r('#viewport'), nav = r('.process-nav'), ins = r('.process-inspector');
    return {docH: document.documentElement.scrollHeight - innerHeight, docW: document.documentElement.scrollWidth - innerWidth, band: r('.process-toolbar').bottom, workspaceBottom: r('.process-workspace').bottom - innerHeight, viewH: view.height, viewW: view.width, navW: nav.width, insW: ins.width,
     navOverflow: getComputedStyle(document.querySelector('.process-nav')!).overflowY, insOverflow: getComputedStyle(document.querySelector('.process-inspector')!).overflowY, io: (document.getElementById('io-panel') as HTMLDetailsElement).open}; });
   for (const [width, height] of [[1366, 768], [1440, 900], [1920, 1080], [2560, 1080], [1100, 700]] as const) {
    await page.setViewportSize({width, height}); await nextFrames(page); const f = await fits(), at = `${width}x${height}`;
    assert(f.docH <= 0 && f.docW <= 0, 'the document does not scroll at ' + at + ' ' + JSON.stringify(f)); assert(f.band <= (width >= 1366 ? 110 : 160), `header and toolbar band is ${f.band}px at ${at}`);
    assert(Math.abs(f.workspaceBottom) <= 1, 'the workspace fills the rest at ' + at); assert(f.viewH >= 320 && f.viewW > f.navW && f.viewW > f.insW, 'the stage is the hero at ' + at + ' ' + JSON.stringify(f)); assert.deepEqual([f.navOverflow, f.insOverflow], ['auto', 'auto']);
    assert.equal(f.io, width >= 1600, 'Inputs & outputs opens by default only on wide screens (' + at + ')');
   }
   await page.setViewportSize({width: 1366, height: 768}); await nextFrames(page);
   const heights = await page.evaluate(() => ['process-switch', 'open-definition', 'import', 'export-menu', 'play', 'step', 'advance', 'reset', 'speed', 'horizon', 'seed', 'open-activity'].map(id => Math.round(document.getElementById(id)!.getBoundingClientRect().height)));
   assert.deepEqual([...new Set(heights)], [36], 'header and toolbar controls share one height');
   assert.equal(await page.locator('.process-toolbar button.primary').count(), 1); assert.equal(await page.locator('#play').getAttribute('class'), 'primary'); assert.match(await page.locator('#reset').getAttribute('class') ?? '', /ghost/);
   assert.equal(await page.locator('#message').evaluate(e => !!e.closest('.process-toolbar') || !e.closest('.process-stagebar')), false, 'the status line lives in the stage header'); assert.equal(await page.locator('#message').getAttribute('role'), 'status');
   assert.doesNotMatch(await page.locator('#process-subtitle').innerText(), /export/i);
   // Exports live in one menu.
   for (const id of ['#json', '#bpmn', '#report', '#html']) assert.equal(await page.locator(id).isHidden(), true, id + ' hides inside the closed menu');
   const trigger = page.locator('#export-menu'); assert.deepEqual([await trigger.getAttribute('aria-haspopup'), await trigger.getAttribute('aria-expanded'), await page.locator('#import').innerText()], ['menu', 'false', 'Import…']);
   await trigger.click(); assert.equal(await trigger.getAttribute('aria-expanded'), 'true'); assert.equal(await activeId(), 'json'); assert.match(await page.locator('#export-hint').innerText(), /use this process\. Download HTML keeps all \d+ processes/);
   assert.deepEqual(await page.locator('#export-items [role=menuitem]:visible').allInnerTexts(), ['Export JSON', 'Export BPMN', 'Export run report', 'Download HTML']);
   const focusAfter = async (key: string) => { await page.keyboard.press(key); return activeId(); };
   assert.deepEqual([await focusAfter('ArrowDown'), await focusAfter('End'), await focusAfter('ArrowDown'), await focusAfter('Home'), await focusAfter('ArrowUp')], ['bpmn', 'html', 'json', 'json', 'html']);
   await page.keyboard.press('Escape'); assert.equal(await activeId(), 'export-menu'); assert.equal(await trigger.getAttribute('aria-expanded'), 'false'); assert.equal(await page.locator('#json').isHidden(), true);
   await page.keyboard.press('ArrowDown'); assert.equal(await activeId(), 'json'); await page.keyboard.press('Escape'); await page.keyboard.press('ArrowUp'); assert.equal(await activeId(), 'html'); await page.keyboard.press('Escape');
   await trigger.click(); await page.locator('#scene-title').click(); assert.equal(await trigger.getAttribute('aria-expanded'), 'false', 'an outside click closes the menu');
   await trigger.focus(); await page.keyboard.press('Enter'); assert.equal(await activeId(), 'json'); let pending = page.waitForEvent('download'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); let saved = await pending;
   assert.match(saved.suggestedFilename(), /\.bpmn$/); assert.equal(await trigger.getAttribute('aria-expanded'), 'false', 'activating an item closes the menu'); assert.equal(await activeId(), 'export-menu');
   await trigger.click(); pending = page.waitForEvent('download'); await page.locator('#report').click(); saved = await pending; assert.match(saved.suggestedFilename(), /\.report\.json$/);
   // The primary button swaps its label; the stage keeps its place while the run plays.
   await page.locator('#play').click(); assert.equal(await page.locator('#play').innerText(), 'Pause'); await page.locator('#play').click(); assert.equal(await page.locator('#play').innerText(), 'Run simulation');
   // Inputs & outputs: remembered per session, with its own scroll.
   await page.setViewportSize({width: 1920, height: 1080}); await nextFrames(page); assert.equal((await fits()).io, true); assert.equal(await page.locator('#process-data').evaluate(e => getComputedStyle(e).overflowY), 'auto');
   await page.locator('#io-panel > summary').click(); assert.equal((await fits()).io, false); await page.setViewportSize({width: 1366, height: 768}); await page.setViewportSize({width: 2560, height: 1080}); await nextFrames(page); assert.equal((await fits()).io, false, 'the choice outlives resizing');
   // Choosing a step on the map scrolls its list item into view.
   await page.setViewportSize({width: 1366, height: 768}); await nextFrames(page); await page.locator('#mode-2d').click(); const last = (await query(page)).definition.steps.at(-1)!.id; await page.locator(`#process-map-${last}`).click({force: true});
   await page.waitForFunction(id => { const li = document.querySelector(`[data-step="${id}"]`)!.closest('li')!.getBoundingClientRect(), nav = document.querySelector('.process-nav')!.getBoundingClientRect(); return li.bottom <= nav.bottom + 1 && li.top >= nav.top; }, last);
   await page.locator('#mode-3d').click(); await page.locator('#overview').click(); await page.screenshot({path: path.join(OUT, 'process-desktop-fit.png')});
  });
  await check('Seed field starts a fresh paused run with the chosen seed', async () => {
   await page.setViewportSize({width: 1440, height: 1060}); await freshStudio();
   const seedBox = page.locator('#seed'), seedOf = async () => (await query(page)).snapshot.seed, wait = (n: number) => page.waitForFunction(v => (globalThis as any).LWProcessStudio.query().snapshot.seed === v, n);
   assert.equal(await page.locator('label.run-seed').innerText(), 'Seed'); assert.deepEqual([await seedBox.getAttribute('type'), await seedBox.getAttribute('min'), await seedBox.getAttribute('max')], ['number', '0', '2147483647']);
   assert.equal(await seedBox.inputValue(), String(await seedOf()));
   await page.locator('#advance').click(); assert.equal((await query(page)).snapshot.minute, 30);
   await seedBox.fill('7'); await seedBox.press('Enter'); await wait(7); const fresh = await query(page);
   assert.deepEqual([fresh.snapshot.minute, fresh.playing, fresh.snapshot.seed], [0, false, 7]); assert.equal(await page.locator('#message').innerText(), 'Seed 7 · fresh paused run'); assert.equal(await page.locator('#metrics .metric-seed').innerText(), 'Seed 7');
   assert.equal(fresh.definition.seed === 7, false, 'the definition keeps its own seed'); assert.match(await page.locator('#inspector').innerText(), /Seed\s*7 · set for this run/);
   await page.locator('#advance').click(); await page.locator('#reset').click(); assert.equal(await seedOf(), 7, 'reset keeps the chosen seed'); assert.equal(await seedBox.inputValue(), '7');
   // A running simulation stops; invalid seeds are refused and the field returns to the seed in use.
   await page.locator('#play').click(); await page.waitForFunction(() => (globalThis as any).LWProcessStudio.query().snapshot.minute > 0); await seedBox.fill('9'); await seedBox.press('Enter'); await wait(9); assert.deepEqual([(await query(page)).playing, (await query(page)).snapshot.minute], [false, 0]);
   for (const bad of ['-3', '1.5', '2147483648']) { await seedBox.fill(bad); await seedBox.press('Enter'); await page.waitForFunction(v => (document.getElementById('seed') as HTMLInputElement).value === v, '9'); assert.match(await page.locator('#message').innerText(), /Seed must be a whole number from 0 to 2,147,483,647/); assert.equal(await seedOf(), 9); }
   const report = async () => { const pending = page.waitForEvent('download'); await exportVia('#report'); const download = await pending, file = path.join(dir, 'seed-report.json'); await download.saveAs(file); return JSON.parse(fs.readFileSync(file, 'utf8')); };
   const exported = await report(); assert.equal(exported.snapshot.seed, 9); assert.equal(exported.definition.seed === 9, false);
   // Seeded randomness repeats: the same seed gives the same run, another seed another one.
   const random = {...randomLine(), id: 'seeded-line', name: 'Seeded line', seed: 11, arrivals: [{at: 0, count: 6, interval: 3, data: {}}]}; (random.steps[1] as any).timing = {dist: 'uniform', min: 6, max: 18}; (random.steps[1] as any).draws = [{field: 'defect', kind: 'chance', percent: 40}];
   await importJson('seeded-line.json', random); assert.equal(await seedBox.inputValue(), '11'); await page.locator('#horizon').selectOption('1440');
   const runOnce = async (seed: number) => { await seedBox.fill(String(seed)); await seedBox.press('Enter'); await wait(seed); for (let i = 0; i < 12; i++) await page.locator('#advance').click(); const q = (await query(page)).snapshot; return JSON.stringify({m: q.metrics, r: q.receipts.map(r => [r.stepId, r.started, r.finished, r.changes])}); };
   const first = await runOnce(12), other = await runOnce(13), again = await runOnce(12); assert.equal(first, again, 'same seed, same run'); assert.notEqual(first, other, 'another seed, another run');
   await importJson('feed-line.json', feedFixture()); assert.equal(await seedBox.inputValue(), '1', 'importing returns to the definition seed'); assert.equal(await seedOf(), 1);
  });
  await check('Phone layout keeps the run bar, step navigation and dialogs usable without horizontal overflow', async () => {
   await freshStudio(); const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
   const small = (selector: string) => page.evaluate(s => [...document.querySelectorAll<HTMLElement>(s)].filter(n => n.getClientRects().length && n.getBoundingClientRect().height < 43.5).map(n => n.id || n.textContent), selector);
   for (const [width, height] of [[320, 640], [390, 844], [768, 1024], [1100, 800]] as const) { await page.setViewportSize({width, height}); await nextFrames(page); assert.equal(await noOverflow(), true, `no horizontal overflow at ${width}`); }
   await page.setViewportSize({width: 390, height: 844}); await nextFrames(page);
   const bar = page.locator('.process-toolbar'); assert.equal(await bar.evaluate(e => getComputedStyle(e).position), 'sticky');
   await page.evaluate(() => window.scrollTo(0, 500)); assert(await page.evaluate(() => document.querySelector('.process-toolbar')!.getBoundingClientRect().top) <= 1, 'the run bar stays at the top while the page scrolls'); await page.evaluate(() => window.scrollTo(0, 0));
   for (const id of ['#play', '#step', '#open-activity', '#clock']) assert.equal(await page.locator(id).isVisible(), true, id); for (const id of ['#advance', '#reset', '#speed', '#horizon', '#seed']) assert.equal(await page.locator(id).isHidden(), true, id + ' sits under Run options');
   const toggle = page.locator('#run-options-toggle'); assert.deepEqual([await toggle.getAttribute('aria-expanded'), await toggle.innerText()], ['false', 'Run options ▾']); await toggle.click();
   for (const id of ['#advance', '#reset', '#speed', '#horizon', '#seed']) assert.equal(await page.locator(id).isVisible(), true, id); assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
   assert.deepEqual(await small('.process-toolbar button, .process-toolbar select, .process-toolbar input, .process-header button, .process-header select, .process-nav button'), [], 'touch targets are 44px'); await toggle.click(); assert.equal(await page.locator('#advance').isHidden(), true);
   await page.locator('#play').click(); assert.equal(await page.locator('#play').innerText(), 'Pause'); await page.locator('#play').click(); await page.locator('#step').click(); assert.equal((await query(page)).playing, false);
   // Compact header: Edit and an overflow menu holding Import and the exports.
   assert.equal(await page.locator('#open-definition').innerText(), 'Edit'); assert.equal(await page.locator('#export-menu').isHidden(), true); assert.equal(await page.locator('#import').isHidden(), true);
   await page.locator('#more-menu').click(); assert.deepEqual(await page.locator('#export-items [role=menuitem]:visible').allInnerTexts(), ['Import JSON or BPMN…', 'Export JSON', 'Export BPMN', 'Export run report', 'Download HTML']);
   const menuBox = (await page.locator('#export-popup').boundingBox())!; assert(menuBox.x >= 0 && menuBox.x + menuBox.width <= 390, 'the menu stays on screen'); await page.keyboard.press('Escape'); assert.equal(await activeId(), 'more-menu');
   // Steps are a horizontal scroller above the stage; the stage is about 45vh; the inspector and Inputs & outputs collapse.
   const layout = await page.evaluate(() => { const nav = document.querySelector('.process-nav')!.getBoundingClientRect(), view = document.getElementById('viewport')!.getBoundingClientRect(), steps = document.getElementById('steps')!;
    return {above: nav.bottom <= view.top + 1, scroller: steps.scrollWidth > document.querySelector('.process-nav')!.clientWidth, row: getComputedStyle(steps).display, viewH: view.height}; });
   assert.deepEqual([layout.above, layout.scroller, layout.row], [true, true, 'flex']); assert(layout.viewH >= 300 && layout.viewH <= 844 * .55, 'stage height ' + layout.viewH);
   await page.locator('#mode-2d').click(); const lastStep = (await query(page)).definition.steps.at(-1)!.id; await page.locator(`#process-map-${lastStep}`).click({force: true});
   await page.waitForFunction(id => { const li = document.querySelector(`[data-step="${id}"]`)!.closest('li')!.getBoundingClientRect(), nav = document.querySelector('.process-nav')!.getBoundingClientRect(); return li.right <= nav.right + 1 && li.left >= nav.left - 1; }, lastStep);
   const inspectorToggle = page.locator('#inspector-toggle'); assert.equal(await inspectorToggle.isVisible(), true); assert.equal(await page.locator('#inspector-body').isVisible(), true); await inspectorToggle.click(); assert.equal(await page.locator('#inspector-body').isHidden(), true); assert.equal(await inspectorToggle.getAttribute('aria-expanded'), 'false'); await inspectorToggle.click();
   assert.equal(await page.locator('#io-panel').evaluate((d: HTMLDetailsElement) => d.open), false); await page.locator('#io-panel > summary').click(); assert.equal(await page.locator('#process-data').isVisible(), true); assert.equal(await noOverflow(), true);
   assert.deepEqual(await small('.process-inspector button, #io-panel summary, .process-view-controls button'), [], 'inspector and stage targets are 44px');
   // Dialogs are full sheets at phone width, down to 320.
   for (const [width, height] of [[390, 844], [320, 640]] as const) {
    await page.setViewportSize({width, height}); await nextFrames(page);
    for (const [opener, dialogSelector, hint] of [['#open-activity', 'dialog.act-dialog[open]', 'activity'], ['#open-definition', 'dialog.de-dialog[open]', 'definition']] as const) {
     await page.locator(opener).click(); await page.locator(dialogSelector).waitFor();
     const g = await page.evaluate(sel => { const d = document.querySelector(sel) as HTMLElement, r = d.getBoundingClientRect(), foot = d.querySelector('.pd-foot')!.getBoundingClientRect(), wide = [...d.querySelectorAll<HTMLElement>('button, select, input, textarea')].filter(n => n.getClientRects().length && (n.getBoundingClientRect().right > r.right + .5 || n.getBoundingClientRect().left < r.left - .5)).map(n => n.id);
      return {box: [r.x, r.y, r.width, r.height], vw: innerWidth, vh: innerHeight, own: d.scrollWidth > d.clientWidth, footBottom: Math.round(foot.bottom), wide}; }, dialogSelector);
     assert.deepEqual(g.box, [0, 0, g.vw, g.vh], `${hint} is a full sheet at ${width}`); assert.deepEqual([g.own, g.wide, g.footBottom], [false, [], g.vh]); assert.equal(await noOverflow(), true);
     if (hint === 'activity') { assert((await actRows().count()) > 0); assert.deepEqual(await small('.act-dialog .act-controls select, .act-dialog .act-step, .act-dialog .pd-foot button'), [], 'activity targets are 44px'); const own = await page.locator('#act-scroll').evaluate(e => e.scrollWidth > e.clientWidth); assert.equal(own, false, 'rows reflow instead of scrolling sideways'); await page.screenshot({path: path.join(OUT, 'process-activity-mobile.png')}); }
     await page.keyboard.press('Escape'); assert.equal(await dialogOpen(), 0); assert.equal(await activeId(), opener.slice(1));
    }
   }
   await page.setViewportSize({width: 1440, height: 1060});
  });
  await check('Inspector shows random timing, outcomes, chance routes and the arrival stream in plain language', async () => {
   await page.setViewportSize({width: 1440, height: 1060}); await freshStudio();
   const long = 'A long walk through a random packing line. '.repeat(10).trim(), random = {...randomLine(), id: 'plain-random', name: 'Plain random', description: long, arrivals: [{at: 0, open: true, interval: 4, gap: {dist: 'exponential', mean: 4}, data: {}}, {at: 10, count: 8, interval: 3, data: {}}]};
   (random.steps[1] as any).timing = {dist: 'uniform', min: 7, max: 11}; (random.steps[1] as any).draws = [{field: 'defect', kind: 'chance', percent: 12}]; (random.resources[0] as any).capacity = 1;
   await importJson('plain-random.json', random); const text = () => page.locator('#inspector').innerText();
   const overview = await text(); assert.match(overview, /Arrivals/); assert.match(overview, /Keeps arriving: every ~4 min, random gap \(exponential, mean 4\), first at minute 0/); assert.match(overview, /8 cases: every 3 min, first at minute 10/);
   assert.match(overview, /Seed\s*1/); assert.match(overview, /Steps\s*7/);
   assert.equal(await page.evaluate(() => { const pools = document.getElementById('pools')!, inspector = document.getElementById('inspector')!; return !!(pools.compareDocumentPosition(inspector) & Node.DOCUMENT_POSITION_FOLLOWING) && document.getElementById('pools-title')!.textContent === 'Shared resources'; }), true, 'Shared resources come first');
   // The long description is clamped to three lines behind a More disclosure.
   const more = page.locator('#desc-more'); assert.equal(await more.isVisible(), true); assert.deepEqual([await more.innerText(), await more.getAttribute('aria-expanded')], ['More', 'false']);
   const lines = () => page.locator('#process-desc').evaluate(e => ({shown: e.clientHeight, full: e.scrollHeight, line: parseFloat(getComputedStyle(e).lineHeight)})); let l = await lines(); assert(l.shown <= l.line * 3 + 2 && l.full > l.shown, JSON.stringify(l));
   await more.click(); assert.deepEqual([await more.innerText(), await more.getAttribute('aria-expanded')], ['Less', 'true']); l = await lines(); assert(l.shown >= l.full - 1 && l.shown > l.line * 3, JSON.stringify(l)); await more.click(); assert.equal(await more.innerText(), 'More');
   await page.locator('[data-step="pack"]').click(); let detail = await text();
   assert.match(detail, /Random timing/); assert.match(detail, /Planned 12 min \(the average shown in estimates\); each visit draws its own time: Uniform 7–11 min/); assert.match(detail, /Random outcomes/); assert.match(detail, /Sets defect to true in 12% of cases, otherwise false/);
   await page.locator('[data-step="gate"]').click(); detail = await text(); const next = await page.locator('.next-step').allInnerTexts();
   assert.deepEqual(next, ['Repack\n20% of cases take this path', 'Done\nOtherwise, 80% of cases']);
   await page.locator('[data-step="repack"]').click(); detail = await text(); assert.doesNotMatch(detail, /Random timing|Random outcomes/); assert.match(detail, /Takes|Duration/);
   await page.locator('[data-step="pack"]').click(); assert.equal(await page.locator('.process-random').count(), 1);
   // Resource meters: 8px bars on a #2c3744 track, filled by utilisation, with the percentage beside the name.
   await page.locator('#horizon').selectOption('100000'); for (let i = 0; i < 4; i++) await page.locator('#advance').click();
   const meter = page.locator('#pools [role=meter]').first(), pct = Number(await meter.getAttribute('aria-valuenow')); assert(pct > 0 && pct <= 100); assert.equal(await meter.getAttribute('aria-label'), 'Operators utilisation'); assert.equal(await page.locator('#pools .pool-pct').first().innerText(), pct + '%');
   const bar = await meter.evaluate(e => ({h: e.getBoundingClientRect().height, track: getComputedStyle(e).backgroundColor, fill: getComputedStyle(e.firstElementChild!).backgroundColor, level: (e as HTMLElement).dataset.level}));
   assert.equal(bar.h, 8); assert.equal(bar.track, 'rgb(44, 55, 68)'); assert.equal(bar.fill, {ok: 'rgb(255, 187, 115)', warm: 'rgb(245, 158, 91)', hot: 'rgb(255, 122, 89)'}[bar.level as 'ok'], JSON.stringify(bar)); assert.equal(bar.level, pct >= 85 ? 'hot' : pct >= 70 ? 'warm' : 'ok');
   await page.locator('#overview').click();
  });
  // SIPOC lens: the pure model and the DOM lens mounted on a host beside the studio, fed by the studio controller's detached views.
  const mountSipoc = (def: object) => page.evaluate(d => {
   const w = globalThis as any, old = document.getElementById('sipoc-host'); old?.remove(); w.__sipoc?.dispose();
   const host = document.createElement('div'); host.id = 'sipoc-host'; host.style.cssText = 'width:100%;max-width:100%'; document.body.append(host); w.__picks = []; w.__def = d;
   w.__sipoc = w.LWProcessSipoc.create(host, (id: string | null) => w.__picks.push(id)); w.__sipoc.draw({...w.LWProcessStudio.query(), definition: d});
  }, def);
  const redrawSipoc = (selected: string | null = null) => page.evaluate(sel => { const w = globalThis as any; w.__sipoc.draw({...w.LWProcessStudio.query(), definition: w.__def, selected: sel}); }, selected);
  const unmountSipoc = () => page.evaluate(() => { const w = globalThis as any; w.__sipoc?.dispose(); document.getElementById('sipoc-host')?.remove(); });
  await check('SIPOC view derives suppliers, inputs, process stages, outputs and customers and shows live counts', async () => {
   await page.setViewportSize({width: 1440, height: 1060}); await freshStudio();
   const def = JSON.parse(JSON.stringify((await query(page)).definition)) as any, phase = (ids: string[], name: string) => ids.forEach(id => { def.steps.find((s: any) => s.id === id).phase = name; });
   phase(['discovery'], 'Discover'); phase(['design-split', 'product-design', 'architecture', 'design-ready'], 'Design'); phase(['implementation', 'qa', 'review-gate', 'rework'], 'Build'); phase(['handover'], 'Deliver');
   def.steps.find((s: any) => s.id === 'handover').outputs = [{field: 'delivery', label: 'Delivered feature'}]; def.steps.find((s: any) => s.id === 'discovery').needs = [{field: 'brief', label: 'Client brief'}];
   def.arrivals[0].draws = [{field: 'budget', kind: 'int', min: 1, max: 5}];
   def.sipoc = {suppliers: [{name: 'Client', supplies: 'brief and budget'}], customers: [{name: 'Product owner', receives: 'a working feature'}, {name: 'End users'}]};
   const model = (await page.evaluate(d => { const w = globalThis as any; return w.LWProcessSipoc.model(d, w.LWProcessStudio.query().snapshot); }, def)) as LWProcessSipoc.Model;
   assert.deepEqual(model.suppliers, [{name: 'Client', detail: 'brief and budget'}]); assert.deepEqual(model.customers, [{name: 'Product owner', detail: 'a working feature'}, {name: 'End users'}]);
   assert.deepEqual(model.inputs.map(i => i.field), ['needsRework', 'priority', 'budget', 'brief']); const byField = (f: string) => model.inputs.find(i => i.field === f)!;
   assert.equal(byField('priority').example, '2'); assert.equal(byField('budget').example, 'random, 1 to 5'); assert.deepEqual([byField('brief').label, byField('brief').arrived, byField('brief').example], ['Client brief', null, null]); assert.equal(byField('priority').arrived, 1);
   assert.deepEqual(model.stages.map(s => s.name), ['Discover', 'Design', 'Build', 'Deliver']); const stage = (n: string) => model.stages.find(s => s.name === n)!;
   assert.deepEqual([stage('Design').steps, stage('Design').parallel, stage('Design').variant, stage('Design').first], [4, true, false, 'design-split']);
   assert.deepEqual([stage('Build').steps, stage('Build').variant, stage('Discover').variant], [4, true, false]); assert(stage('Build').stepIds.includes('rework') && stage('Build').kinds.includes('decision'));
   assert.deepEqual(model.outputs.map(o => o.label), ['Delivered feature', 'Reached Delivered']); assert.deepEqual(model.measures.map(m => m.id).slice(0, 5), ['completed', 'active', 'cycle', 'cost', 'throughput']);
   await mountSipoc(def); const host = page.locator('#sipoc-host');
   assert.deepEqual(await host.locator('.sipoc-col > h3').allInnerTexts(), ['S\nSuppliers', 'I\nInputs', 'P\nProcess', 'O\nOutputs', 'C\nCustomers']);
   assert.equal(await host.locator('section.sipoc-col[aria-labelledby]').count(), 5); assert.equal(await host.locator('.sipoc-col-suppliers').innerText().then(t => /Client/.test(t) && /brief and budget/.test(t)), true);
   assert.deepEqual(await host.locator('.sipoc-stage').evaluateAll(b => b.map(x => x.getAttribute('aria-label'))), ['Stage Discover, 1 step, 1 in progress, 0 completed', 'Stage Design, 4 steps, 0 in progress, 0 completed', 'Stage Build, 4 steps, 0 in progress, 0 completed, has alternative paths', 'Stage Deliver, 1 step, 0 in progress, 0 completed']);
   assert.equal(await host.locator('.sipoc-tag-variant').count(), 1); assert.equal(await host.locator('.sipoc-stage', {hasText: 'in parallel'}).count(), 1); assert.match(await host.locator('.sipoc-col-inputs').innerText(), /Client brief/); assert.match(await host.locator('.sipoc-col-inputs').innerText(), /1 case arrived/);
   const unchanged = await host.evaluate(h => { const first = h.querySelector('.sipoc-grid'); (first as any).__mark = 1; return true; }); await redrawSipoc(); assert.equal(await host.evaluate(h => (h.querySelector('.sipoc-grid') as any).__mark), 1, 'identical view must not redraw'); assert(unchanged);
   await page.locator('#horizon').selectOption('100000'); await page.locator('#advance').click(); await page.waitForFunction(() => (globalThis as any).LWProcessStudio.query().snapshot.minute > 0); await page.locator('#advance').click(); await redrawSipoc();
   const live = await host.locator('.sipoc-stage').evaluateAll(b => b.map(x => x.getAttribute('aria-label')!)); assert(live.some(l => /[1-9]\d* in progress|[1-9]\d* completed/.test(l)), live.join('|'));
   assert.match(await host.locator('.sipoc-col-inputs').innerText(), /[1-9]\d* cases? arrived/); assert.notEqual(await host.locator('.sipoc-measure', {hasText: 'Mean cycle'}).count(), 0); assert.equal(await host.locator('.sipoc-measure', {hasText: 'In progress'}).locator('dd').innerText() !== '0' || (await query(page)).snapshot.metrics.active === 0, true);
   await host.locator('.sipoc-stage', {hasText: 'Design'}).click(); assert.deepEqual(await page.evaluate(() => (globalThis as any).__picks), ['design-split']);
   await redrawSipoc('design-split'); assert.equal(await host.locator('.sipoc-stage[aria-pressed=true]').count(), 1); assert.match((await host.locator('.sipoc-stage[aria-pressed=true]').getAttribute('aria-label'))!, /^Stage Design/);
   await unmountSipoc(); assert.equal(await page.locator('#sipoc-host').count(), 0);
  });
  await check('SIPOC view groups steps by phase, falls back for ungrouped processes and stays readable on phones', async () => {
   await page.setViewportSize({width: 1440, height: 1060}); await freshStudio();
   const agency = JSON.parse(JSON.stringify((await query(page)).definition)) as any; for (const s of agency.steps) delete s.phase; delete agency.sipoc;
   const long = {...agency, start: 's0', steps: Array.from({length: 11}, (_, i) => ({id: 's' + i, name: 'Step ' + i, kind: i === 10 ? 'end' : 'task', scene: {id: 'office', position: [i, 0], color: '#fff'}})), flows: Array.from({length: 10}, (_, i) => ({id: 'f' + i, from: 's' + i, to: 's' + (i + 1)})), arrivals: []};
   const sizes = await page.evaluate(([a, l]) => { const w = globalThis as any, q = w.LWProcessStudio.query().snapshot, A = w.LWProcessSipoc.model(a, q), L = w.LWProcessSipoc.model(l, q); return {agency: A.stages.map((s: any) => s.name), long: L.stages.map((s: any) => [s.name, s.steps]), suppliers: A.suppliers, customers: A.customers}; }, [agency, long]);
   assert(sizes.agency.length >= 3 && sizes.agency.length <= 7, sizes.agency.join()); assert.deepEqual(sizes.agency, ['Discovery', 'Plan together', 'Implementation', 'Quality review', 'Client handover']);
   assert.equal(sizes.long.length, 7); assert.equal(sizes.long.reduce((n: number, s: any) => n + s[1], 0), 10); assert(sizes.long.some((s: any) => /^Step \d+ and \d+ more steps?$/.test(s[0])), JSON.stringify(sizes.long));
   assert.deepEqual([sizes.suppliers[0].placeholder, sizes.suppliers[0].name, sizes.customers[0].name], [true, 'Add suppliers in Edit process', 'Add customers in Edit process']);
   await mountSipoc(agency); const host = page.locator('#sipoc-host'); assert.equal(await host.locator('.sipoc-stage').count(), sizes.agency.length);
   assert.match(await host.locator('.sipoc-col-suppliers').innerText(), /Add suppliers in Edit process/); assert.match(await host.locator('.sipoc-col-customers').innerText(), /Add customers in Edit process/);
   const phased = JSON.parse(JSON.stringify(agency)); phased.steps.forEach((s: any, i: number) => { s.phase = i < 4 ? 'Early' : 'Late'; });
   assert.deepEqual(await page.evaluate(p => (globalThis as any).LWProcessSipoc.model(p, (globalThis as any).LWProcessStudio.query().snapshot).stages.map((s: any) => s.name), phased), ['Early', 'Late']);
   await page.setViewportSize({width: 390, height: 844}); await nextFrames(page); await redrawSipoc();
   const geo = await page.evaluate(() => {
    const host = document.getElementById('sipoc-host')!, cols = [...host.querySelectorAll('.sipoc-col')].map(c => c.getBoundingClientRect()), scroll = host.querySelector('.sipoc-scroll') as HTMLElement;
    const sizes = [...host.querySelectorAll('*')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent!.trim())).map(e => parseFloat(getComputedStyle(e).fontSize));
    const buttons = [...host.querySelectorAll('.sipoc-stage')].map(b => b.getBoundingClientRect());
    return {stacked: cols.every((c, i) => i === 0 || (c.top >= cols[i - 1]!.bottom - 1 && Math.abs(c.left - cols[0]!.left) < 1)), pageOverflow: document.documentElement.scrollWidth > innerWidth, scrollOverflow: scroll.scrollWidth > scroll.clientWidth + 1, minFont: Math.min(...sizes),
     inside: buttons.every(b => b.left >= 0 && b.right <= innerWidth), ordered: buttons.every((b, i) => i === 0 || b.top > buttons[i - 1]!.top)};
   });
   assert.deepEqual(geo, {stacked: true, pageOverflow: false, scrollOverflow: false, minFont: geo.minFont, inside: true, ordered: true}); assert(geo.minFont >= 12, 'font ' + geo.minFont);
   await unmountSipoc(); await page.setViewportSize({width: 1440, height: 1060});
  });
  const journeyFixture = (d: LWProcess.Definition) => {
   const scene = (id: string, x: number, y = 0) => ({id: 'scene-' + id, position: [x, y] as [number, number], color: '#91b9d5'});
   const tp = (id: string, name: string, channel: string, phase: string, emotion: number, x: number, extra: Record<string, unknown> = {}) => ({id, name, kind: 'touchpoint', channel, phase, emotion, duration: 6, add: {mood: emotion}, scene: scene(id, x), ...extra});
   Object.assign(d, {id: 'journey-fixture', name: 'Journey fixture', genre: 'customer-journey', track: [{field: 'mood', label: 'Mood'}], start: 'start', resources: [{id: 'shop', name: 'Shop platform', capacity: 2, costPerMinute: 1, kind: 'system'}],
    steps: [{id: 'start', name: 'Visitor arrives', kind: 'start', phase: 'Awareness', emotion: 0, scene: scene('start', 0)}, tp('ad', 'Sees an advert', 'ads', 'Awareness', 1, 14, {pain: 'Adverts feel repetitive.'}),
     tp('browse', 'Browse the shop', 'web', 'Consideration', 1, 28, {pain: 'Search results are slow.', opportunity: 'Show best sellers first.'}), {id: 'intent', name: 'Interested?', kind: 'decision', phase: 'Consideration', scene: scene('intent', 42)},
     tp('support', 'Asks support in chat', 'chat', 'Consideration', -1, 56), tp('checkout', 'Checks out', 'web', 'Purchase', -2, 70, {resources: {shop: 1}, pain: 'Account creation is required.'}),
     {id: 'paid', name: 'Payment accepted?', kind: 'decision', phase: 'Purchase', scene: scene('paid', 84)}, tp('confirm', 'Reads the confirmation', 'email', 'Purchase', 2, 98), tp('delivery', 'Receives the parcel', 'delivery', 'Delivery', 3, 112, {duration: 10}),
     {id: 'won', name: 'Order delivered', kind: 'end', outcome: 'goal', phase: 'Delivery', scene: scene('won', 126)}, {id: 'lost', name: 'Left the shop', kind: 'end', outcome: 'lost', scene: scene('lost', 56, 14)}, tp('cart', 'Abandoned cart reminder', 'email', 'Purchase', -3, 84, {scene: scene('cart', 84, 14)})],
    flows: [{id: 'f1', from: 'start', to: 'ad'}, {id: 'f2', from: 'ad', to: 'browse'}, {id: 'f3', from: 'browse', to: 'intent'}, {id: 'f4', from: 'intent', to: 'lost', label: 'Bounces', when: {chance: 30}}, {id: 'f5', from: 'intent', to: 'support'}, {id: 'f6', from: 'support', to: 'checkout'},
     {id: 'f7', from: 'checkout', to: 'paid'}, {id: 'f8', from: 'paid', to: 'cart', when: {chance: 15}}, {id: 'f9', from: 'paid', to: 'confirm'}, {id: 'f10', from: 'cart', to: 'lost'}, {id: 'f11', from: 'confirm', to: 'delivery'}, {id: 'f12', from: 'delivery', to: 'won'}],
    arrivals: [{at: 0, count: 12, interval: 3, data: {mood: 0}}]});
  };
  const mountJourney = () => page.evaluate(() => {
   const w = globalThis as any; w.jsurface?.dispose(); document.getElementById('jtest')?.remove(); const host = document.createElement('div'); host.id = 'jtest'; document.body.append(host);
   w.jsel = []; w.jsurface = w.LWProcessJourney.create(host, (id: string | null) => w.jsel.push(id)); w.jsurface.draw(w.LWProcessStudio.query());
  });
  const redrawJourney = () => page.evaluate(() => (globalThis as any).jsurface.draw((globalThis as any).LWProcessStudio.query()));
  const journeyFacts = () => page.evaluate(() => {
   const text = (sel: string) => [...document.querySelectorAll(`#jtest ${sel}`)].map(n => n.textContent!.trim());
   return {phases: text('.jm-phase-name'), lanes: text('.jm-lane-name'), cards: document.querySelectorAll('#jtest .jm-card').length, branches: document.querySelectorAll('#jtest .jm-card.branch').length, faces: document.querySelectorAll('#jtest .jm-face').length,
    authored: document.querySelectorAll('#jtest .jm-line:not(.measured)').length, measured: document.querySelectorAll('#jtest .jm-line.measured').length, counts: text('.jm-funnel .jm-count').map(Number), pcts: text('.jm-funnel .jm-pct'),
    labels: [...document.querySelectorAll('#jtest .jm-card')].map(n => n.getAttribute('aria-label')!), summary: text('.jm-summary')[0]!, region: document.querySelector('#jtest [role=region]')?.getAttribute('aria-label')};
  });
  await check('Journey map lays out phases, touchpoints, emotion curve, pain points and live funnel counts', async () => {
   await freshStudio(); await applyDraft(journeyFixture); await page.locator('#mode-2d').click(); assert.equal((await query(page)).definition.id, 'journey-fixture');
   await mountJourney(); const route = ['start', 'ad', 'browse', 'intent', 'support', 'checkout', 'paid', 'confirm', 'delivery', 'won'];
   const idle = await journeyFacts(); assert.equal(idle.region, 'Journey map'); assert.deepEqual(idle.phases, ['Awareness', 'Consideration', 'Purchase', 'Delivery']);
   assert.deepEqual(idle.lanes, ['Phase', 'Touchpoints', 'Branches', 'Channel', 'Feeling', 'Pain points', 'Opportunities', 'Funnel']); assert.deepEqual([idle.cards, idle.branches, idle.faces], [12, 2, 7]);
   const before = await query(page); assert.equal(idle.authored, 1); assert.deepEqual(idle.counts, route.map(id => before.snapshot.steps.find(s => s.id === id)!.reached), 'funnel counts equal the snapshot before the first step');
   assert.equal(await page.locator('#jtest .jm-pain').filter({hasText: 'Search results are slow.'}).count(), 1); assert.equal(await page.locator('#jtest .jm-opp').filter({hasText: 'Show best sellers first.'}).count(), 1);
   await page.locator('#advance').click(); for (let i = 0; i < 12; i++) await page.locator('#step').click();
   const running = await query(page); await redrawJourney(); const live = await journeyFacts(); const reached = new Map(running.snapshot.steps.map(s => [s.id, s.reached]));
   assert.deepEqual(live.counts, route.map(id => reached.get(id))); assert(live.counts[0]! > idle.counts[0]! && live.counts[0]! >= live.counts.at(-1)!, 'the funnel follows the run');
   assert.deepEqual(live.pcts, route.map(id => `${Math.round(reached.get(id)! * 100 / reached.get('start')!)}% of start`)); assert.equal(live.measured, 1, 'measured curve appears once the tracked field has data');
   assert.match(live.labels.find(l => l.startsWith('Browse the shop'))!, new RegExp(`^Browse the shop, Website, phase Consideration, feeling \\+1, ${reached.get('browse')} reached$`));
   assert.match(live.labels.find(l => l.startsWith('Order delivered'))!, /^Order delivered, End, goal, phase Delivery, \d+ reached$/); assert.match(live.summary, new RegExp(`Goals ${running.snapshot.metrics.goals} · Lost ${running.snapshot.metrics.lost}`));
   await page.locator('#jtest .jm-lane-name', {hasText: 'Funnel'}).waitFor(); assert.match(await page.locator('#jtest .jm-badge.goal').innerText(), /^Goal · \d+$/); assert.match(await page.locator('#jtest .jm-badge.lost').innerText(), /^Lost · \d+$/);
   await page.locator('#jtest .jm-card[data-step="browse"]').click(); assert.equal(await page.evaluate(() => (globalThis as any).jsel.at(-1)), 'browse');
   await page.locator('#jtest .jm-card[data-step="ad"]').focus(); await page.keyboard.press('ArrowRight'); assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.step), 'browse');
   await page.keyboard.press('Enter'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Space'); assert.deepEqual(await page.evaluate(() => (globalThis as any).jsel.slice(-3)), ['browse', 'browse', 'intent']);
   await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => (globalThis as any).jsel.at(-1)), null);
   await page.evaluate(() => {const w = globalThis as any, v = w.LWProcessStudio.query(); v.selected = 'checkout'; w.jsurface.draw(v);}); assert.equal(await page.locator('#jtest .jm-card[aria-pressed=true]').getAttribute('data-step'), 'checkout');
   await page.setViewportSize({width: 390, height: 900}); await redrawJourney();
   const phone = await page.evaluate(() => { const sc = document.querySelector('#jtest .jm-scroll') as HTMLElement, small = [...document.querySelectorAll('#jtest *')].filter(n => n.tagName !== 'title' && [...n.childNodes].some(c => c.nodeType === 3 && c.textContent!.trim())).map(n => parseFloat(getComputedStyle(n).fontSize)); return {page: document.documentElement.scrollWidth > innerWidth, inner: sc.scrollWidth > sc.clientWidth, min: Math.min(...small)}; });
   assert.deepEqual([phone.page, phone.inner], [false, true], 'the map scrolls inside its own container'); assert(phone.min >= 12, `smallest map text is ${phone.min}px`);
   await page.locator('#jtest .jm-fit').click(); assert.equal(await page.locator('#jtest .jm-fit').getAttribute('aria-pressed'), 'true'); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
   await page.setViewportSize({width: 1440, height: 1060}); assert.equal((await query(page)).snapshot.minute, running.snapshot.minute, 'drawing the map never ticks the run');
   // A plain process has no phases: one column, and a long chain stays inside its own scroller.
   const plain = await page.evaluate(() => {
    const w = globalThis as any, steps = Array.from({length: 26}, (_, i) => ({id: 's' + i, name: 'Step ' + i, kind: i === 0 ? 'start' : i === 25 ? 'end' : 'task', scene: {id: 'sc' + i, position: [i * 14, 0], color: '#fff'}})), view = {definition: {format: 'wildlands-process', schemaVersion: 1, revision: 0, id: 'long', name: 'Long', start: 's0', resources: [], steps, arrivals: [], flows: steps.slice(1).map((s, i) => ({id: 'f' + i, from: 's' + i, to: s.id}))}, selected: null,
     snapshot: {steps: steps.map((s, i) => ({id: s.id, reached: 100 - i, tracked: {}})), metrics: {goals: 0, lost: 0, conversion: null}}};
    document.getElementById('jtest')?.remove(); w.jsurface.dispose(); const host = document.createElement('div'); host.id = 'jtest'; document.body.append(host); w.jsurface = w.LWProcessJourney.create(host, () => {}); w.jsurface.draw(view);
    return {phases: [...host.querySelectorAll('.jm-phase-name')].map(n => n.textContent), cards: host.querySelectorAll('.jm-card').length, measured: host.querySelectorAll('.jm-line.measured').length, last: host.querySelectorAll('.jm-funnel .jm-count')[25]!.textContent};
   });
   assert.deepEqual(plain, {phases: ['Process'], cards: 26, measured: 0, last: '75'});
   await page.evaluate(() => {(globalThis as any).jsurface.dispose(); document.getElementById('jtest')?.remove();});
  });
  const roomsFixture = (d: LWProcess.Definition) => {
   const scene = (id: string, x: number) => ({id: 'scene-' + id, position: [x, 0] as [number, number], color: '#91b9d5'}), channels = ['web', 'mobile', 'store', 'phone', 'chat', 'email', 'social', 'ads', 'delivery', 'document', ''], moods = [-3, -2, -1, 0, 1, 2, 3];
   const tps = channels.map((c, i) => ({id: 'tp-' + (c || 'generic'), name: 'Touchpoint ' + (c || 'generic'), kind: 'touchpoint', ...(c ? {channel: c} : {}), ...(i < 7 ? {emotion: moods[i]} : {}), duration: 600, scene: scene('tp-' + (c || 'generic'), 28 + i * 14)}));
   Object.assign(d, {id: 'room-fixture', name: 'Touchpoint rooms', start: 'start', resources: [], arrivals: [{at: 5, count: 1, interval: 0, data: {}}],
    steps: [{id: 'start', name: 'Start', kind: 'start', scene: scene('start', 0)}, {id: 'fan', name: 'Fan', kind: 'fork', join: 'merge', scene: scene('fan', 14)}, ...tps, {id: 'merge', name: 'Merge', kind: 'join', scene: scene('merge', 200)}, {id: 'end', name: 'Done', kind: 'end', outcome: 'goal', phase: 'Done', scene: scene('end', 214)}],
    flows: [{id: 'f0', from: 'start', to: 'fan'}, ...tps.map(t => ({id: 'b-' + t.id, from: 'fan', to: t.id})), ...tps.map(t => ({id: 'j-' + t.id, from: t.id, to: 'merge'})), {id: 'fe', from: 'merge', to: 'end'}]});
  };
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
  const modeOf = async () => (await query(page)).mode, minuteOf = async () => (await query(page)).snapshot.minute;
  const SIPOC_TITLE = 'SIPOC view: suppliers, inputs, process, outputs, customers', JOURNEY_TITLE = 'Journey map: stages, touchpoints, feeling, funnel';
  const lensState = (kind: 'sipoc' | 'journey') => page.evaluate(k => {
   const host = document.getElementById('lens')!, box = host.getBoundingClientRect(), shown = !host.hidden && box.width > 0;
   return {shown, sipoc: host.querySelectorAll('.sipoc').length, journey: host.querySelectorAll('.lw-journey').length, canvas: !document.getElementById('canvas')!.hidden, map: !document.getElementById('map')!.hidden, wanted: k, right: box.right, innerWidth};
  }, kind);
  await check('View lens follows the process type: SIPOC for processes, journey map for journeys, with the right default and selection', async () => {
   await page.setViewportSize({width: 1440, height: 1060}); await freshStudio();
   const journeyAt = (q: {definition: LWProcess.Definition}) => q.definition.genre === 'customer-journey' || q.definition.genre === 'user-journey';
   // The switcher is [2D] [3D] [lens] [Frame view]; a business process offers SIPOC only, with the stated title and pressed state.
   assert.deepEqual(await page.locator('.process-view-controls > button:not([hidden])').evaluateAll(b => b.map(x => x.id)), ['mode-2d', 'mode-3d', 'mode-lens', 'frame']);
   const lensButton = page.locator('#mode-lens'); assert.equal(await lensButton.innerText(), 'SIPOC'); assert.equal(await lensButton.getAttribute('title'), SIPOC_TITLE); assert.equal(await lensButton.getAttribute('aria-label'), SIPOC_TITLE);
   assert.equal(await lensButton.getAttribute('aria-pressed'), 'false'); assert.equal(await page.locator('#mode-3d').getAttribute('aria-pressed'), 'true'); assert.equal(await modeOf(), '3d');
   // Keyboard: the lens button is a plain pressed-state toggle, activated with Enter like 2D and 3D.
   await lensButton.focus(); await page.keyboard.press('Enter'); await page.waitForFunction(() => document.getElementById('mode-lens')!.getAttribute('aria-pressed') === 'true');
   assert.equal(await modeOf(), 'lens'); assert.equal(await page.locator('#mode-3d').getAttribute('aria-pressed'), 'false'); assert.equal(await page.evaluate(() => document.activeElement?.id), 'mode-lens');
   let state = await lensState('sipoc'); assert.equal(state.shown, true); assert.equal(state.sipoc, 1); assert.equal(state.journey, 0); assert.equal(state.canvas, false); assert.equal(state.map, false);
   assert.equal(await minuteOf(), 0, 'switching the view never ticks');
   // Selecting a stage in the lens selects its first step, shows it in the inspector and keeps the lens; Escape clears it.
   const stage = page.locator('#lens .sipoc-stage').first(); await stage.click();
   const selected = (await query(page)).selected; assert(selected, 'the lens selected a step'); assert.equal(await modeOf(), 'lens'); assert.equal(await page.locator('#inspector-title').innerText(), 'Scene details'); assert.equal(await minuteOf(), 0);
   assert.equal(await page.locator(`[data-step="${selected}"]`).getAttribute('aria-current'), 'step'); assert.equal(await page.locator('#lens .sipoc-stage.selected').count(), 1);
   await page.keyboard.press('Escape'); await page.waitForFunction(() => (globalThis as any).LWProcessStudio.query().selected === null);
   assert.equal(await page.locator('#inspector-title').innerText(), 'Process overview'); assert.equal(await modeOf(), 'lens');
   await page.locator('#lens .sipoc-scroll').evaluate(e => { e.scrollLeft = 40; }); await page.locator('#frame').click(); assert.equal(await page.locator('#lens .sipoc-scroll').evaluate(e => e.scrollLeft), 0);
   // Processes 1-3 are business processes: switching keeps the SIPOC lens. Processes 4-5 are journeys and open on their Journey map.
   const seen: string[] = [];
   for (let i = 0; i < COUNT; i++) {
    if (i > 0) await switchTo(i);
    const q = await query(page), journey = journeyAt(q); seen.push(journey ? 'journey' : 'sipoc'); await nextFrames(page);
    assert.equal(q.mode, 'lens', 'process ' + (i + 1)); assert.equal(q.snapshot.minute, 0); assert.equal(q.selected, null);
    state = await lensState(journey ? 'journey' : 'sipoc'); assert.equal(state.shown, true); assert.equal(state.sipoc, journey ? 0 : 1, 'SIPOC for process ' + (i + 1)); assert.equal(state.journey, journey ? 1 : 0, 'Journey map for process ' + (i + 1));
    assert.equal(await lensButton.innerText(), journey ? 'Journey map' : 'SIPOC'); assert.equal(await lensButton.getAttribute('title'), journey ? JOURNEY_TITLE : SIPOC_TITLE); assert.equal(await lensButton.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#mode-lens').count(), 1, 'only the matching lens is offered');
   }
   assert.deepEqual(seen, gameDefinitions.map((_, i) => i < 3 ? 'sipoc' : 'journey'));
   // On a journey, a card selects its step; the inspector shows it; Escape clears; nothing ticks.
   await switchTo(3); await nextFrames(page); const card = page.locator('#lens .jm-card').nth(1); await card.click(); const picked = (await query(page)).selected;
   assert(picked); assert.equal(await card.getAttribute('data-step'), picked); assert.equal(await page.locator('#inspector-title').innerText(), 'Scene details'); assert.equal(await minuteOf(), 0); assert.equal(await modeOf(), 'lens');
   await page.keyboard.press('Escape'); await page.waitForFunction(() => (globalThis as any).LWProcessStudio.query().selected === null); await page.locator('#frame').click();
   // The user's 2D choice is remembered across a journey: 2D on a journey, lens again, then back to a business process returns to 2D.
   await page.locator('#mode-2d').click(); assert.equal(await modeOf(), '2d'); assert.equal((await lensState('journey')).shown, false);
   await page.locator('#mode-lens').click(); await switchTo(4); assert.equal(await modeOf(), 'lens', 'a journey keeps its map when switching to another journey');
   await switchTo(0); assert.equal(await modeOf(), '2d', 'leaving a journey from its map returns to the last 2D or 3D choice'); assert.equal((await lensState('sipoc')).shown, false);
   await page.locator('#mode-3d').click(); await switchTo(3); assert.equal(await modeOf(), 'lens', 'a journey defaults to its map'); await page.locator('#mode-3d').click(); await switchTo(4); assert.equal(await modeOf(), '3d', 'an explicit 3D choice on a journey stays');
   await switchTo(0); assert.equal(await modeOf(), '3d'); assert.equal(await minuteOf(), 0);
   // Applying a draft that changes the process type swaps the lens, never the chosen view.
   await applyDraft(d => { d.genre = 'customer-journey'; }); assert.equal(await modeOf(), '3d', 'a 3D choice is not a lens and stays'); assert.equal(await lensButton.innerText(), 'Journey map'); assert.equal(await lensButton.getAttribute('title'), JOURNEY_TITLE);
   await lensButton.click(); state = await lensState('journey'); assert.equal(state.journey, 1); assert.equal(state.sipoc, 0);
   await applyDraft(d => { delete d.genre; }); assert.equal(await modeOf(), 'lens', 'the lens follows the new type'); state = await lensState('sipoc'); assert.equal(state.sipoc, 1); assert.equal(state.journey, 0); assert.equal(await lensButton.innerText(), 'SIPOC');
   await page.locator('#mode-3d').click(); assert.equal(await page.locator('#canvas').isVisible(), true); await lensButton.click(); await applyDraft(d => { d.name = 'Renamed agency'; }); assert.equal(await modeOf(), 'lens'); assert.equal((await lensState('sipoc')).sipoc, 1);
   // Phones: both lenses fit 390px with no page overflow.
   for (const index of [0, 3, 4]) {
    await switchTo(index); await page.setViewportSize({width: 390, height: 844}); await nextFrames(page);
    const q = await query(page); await page.locator('#mode-lens').click(); state = await lensState(q.definition.genre === 'process' || !q.definition.genre ? 'sipoc' : 'journey');
    assert.equal(state.shown, true); assert(state.right <= 390 + 1, `lens inside the viewport for process ${index + 1}`); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal page overflow for process ' + (index + 1));
    await page.setViewportSize({width: 1440, height: 1060});
   }
  });
  await check('Journey terminology, conversion and tracked measures appear for journey processes and not for business processes', async () => {
   await page.setViewportSize({width: 1440, height: 1060}); await freshStudio(); await showIo();
   const kpis = async () => Object.fromEntries(await page.locator('#metrics > div').evaluateAll(cells => cells.map(c => [c.querySelector('span')!.textContent, c.querySelector('strong')!.textContent])));
   const labelsOf = async () => Object.keys(await kpis());
   // A business process keeps its wording and shows no journey numbers, even after it has run.
   assert.deepEqual(await labelsOf(), ['Completed', 'In progress', 'Mean cycle', 'Simulated cost', 'Failed']); assert.equal(await page.locator('#steps-heading').innerText(), 'Step scenes');
   assert.equal(await page.locator('label[for="process-case"]').innerText(), 'Case'); assert.match(await page.locator('#scene-subtitle').innerText(), /\d cases? admitted$/);
   for (let i = 0; i < 6; i++) await page.locator('#advance').click();
   assert.deepEqual(await labelsOf(), ['Completed', 'In progress', 'Mean cycle', 'Simulated cost', 'Failed']); assert.doesNotMatch(await page.locator('#inspector').innerText(), /Process type|Tracked measures|Conversion/);
   await page.locator('#open-activity').click(); await page.locator('dialog.act-dialog[open]').waitFor(); assert.equal(await page.locator('#act-case-label').innerText(), 'Case'); assert.equal(await page.locator('#act-case option').first().innerText(), 'All cases'); await page.keyboard.press('Escape'); await page.locator('dialog.act-dialog[open]').waitFor({state: 'hidden'});
   // The two journeys: customers and users, journey headings, and conversion with tracked measures once cases have finished.
   for (const [index, one, many, label, tracked] of [[3, 'customer', 'customers', 'Customer journey', 'Customer sentiment'], [4, 'user', 'users', 'User journey', 'Sessions']] as const) {
    await switchTo(index); await showIo(); const def = (await query(page)).definition;
    assert.equal(await page.locator('#steps-heading').innerText(), 'Touchpoints and steps'); assert.equal(await page.locator('label[for="process-case"]').innerText(), one[0]!.toUpperCase() + one.slice(1));
    assert.match(await page.locator('#scene-subtitle').innerText(), new RegExp(`\\d ${one}s? admitted$`)); assert.deepEqual(await labelsOf(), ['Finished', 'In progress', 'Mean cycle', 'Simulated cost', 'Failed']);
    assert.match(await page.locator('#inspector').innerText(), new RegExp(`Process type\\s+${label}`)); assert.doesNotMatch(await page.locator('#inspector [aria-label="Arrival streams"]').innerText(), /\bcases?\b/i);
    for (let i = 0; i < 80; i++) { const m = (await query(page)).snapshot.metrics; if (m.goals + m.lost >= 3 && Object.values(m.tracked).every(t => t.n > 0)) break; await page.locator('#advance').click(); }
    const q = await query(page), m = q.snapshot.metrics; assert(m.goals + m.lost >= 3 && m.conversion !== null, 'the journey finished with outcomes'); assert.equal(q.snapshot.minute > 0, true);
    const cells = await kpis(), names = Object.keys(cells); assert.deepEqual(names.slice(0, 4), ['Finished', 'Goals', 'Lost', 'Conversion']);
    assert.equal(cells.Goals, String(m.goals)); assert.equal(cells.Lost, String(m.lost)); assert.equal(cells.Conversion, (m.conversion! / 10).toFixed(1) + '%');
    const extra = names.filter(n => n.endsWith(' (avg)')); assert.equal(extra.length, Math.min(2, def.track!.length)); assert(extra.includes(tracked + ' (avg)'), JSON.stringify(extra));
    for (const t of def.track!.slice(0, 2)) assert.equal(cells[(t.label ?? t.field) + ' (avg)'], String(Number(m.tracked[t.field]!.mean!.toFixed(2))));
    // Overview: every tracked measure with its average and range; activity names the cases with the journey word.
    assert.match(await page.locator('#inspector').innerText(), /Tracked measures/); for (const t of def.track!) assert.match(await page.locator('#inspector').innerText(), new RegExp(t.label ?? t.field));
    // Step inspector: phase, channel, feeling words, pain, opportunity, funnel numbers and the tracked average on entry.
    const touch = def.steps.find(s => s.kind === 'touchpoint' && s.channel && s.emotion !== undefined && s.pain && s.opportunity)!; await page.locator(`#steps [data-step="${touch.id}"]`).click();
    const text = await page.locator('#inspector').innerText(), metric = q.snapshot.steps.find(s => s.id === touch.id)!, v = (name: string) => page.evaluate(([n, c, e]) => { const api = (globalThis as any).LWProcessRandomView; return n === 'channel' ? api.describeChannel(c) : api.describeEmotion(e); }, [name, touch.channel, touch.emotion]);
    assert.match(text, new RegExp('Phase\\s+' + touch.phase)); assert.match(text, new RegExp('Channel\\s+' + (await v('channel')))); assert.match(text, new RegExp('Feeling\\s+' + (await v('feeling')))); assert.match(text, /Pain point/); assert.match(text, /Opportunity/);
    assert.match(text, new RegExp(`Reached\\s+[\\d,]+ ${many}`)); assert.match(text, /Entered\s+[\d,]+ times?/);
    const first = def.track![0]!, seen = (await query(page)).snapshot.steps.filter(s => s.tracked[first.field]?.n).map(s => s.id);
    if (seen.length) { await page.locator(`#steps [data-step="${seen[0]}"]`).click(); assert.match(await page.locator('#inspector').innerText(), new RegExp(`Average ${first.label ?? first.field} on entry\\s+-?[\\d.]+`)); }
    assert(metric.reached >= 0); const end = def.steps.find(s => s.kind === 'end' && s.outcome === 'goal')!; await page.locator(`#steps [data-step="${end.id}"]`).click(); assert.match(await page.locator('#inspector').innerText(), /Goal reached/);
    await page.locator('#overview').click(); await page.locator('#open-activity').click(); await page.locator('dialog.act-dialog[open]').waitFor();
    assert.equal(await page.locator('#act-case-label').innerText(), one[0]!.toUpperCase() + one.slice(1)); assert.equal(await page.locator('#act-case option').first().innerText(), 'All ' + many); await page.keyboard.press('Escape'); await page.locator('dialog.act-dialog[open]').waitFor({state: 'hidden'});
   }
   await switchTo(0); assert.deepEqual(await labelsOf(), ['Completed', 'In progress', 'Mean cycle', 'Simulated cost', 'Failed']); assert.equal(await page.locator('#steps-heading').innerText(), 'Step scenes'); assert.equal(await page.locator('label[for="process-case"]').innerText(), 'Case');
  });
  await check('Definition editor edits SIPOC suppliers and customers with inline problems and applies them', async () => {
   await page.setViewportSize({width: 1440, height: 1060}); await freshStudio(); await openDef();
   // The shipped agency process already names its suppliers and customers: the form shows exactly those rows.
   const shipped = (await defOf()).sipoc!; assert(shipped.suppliers?.length && shipped.customers?.length);
   for (const [list, key] of [['suppliers', 'supplies'], ['customers', 'receives']] as const) for (const [i, p] of shipped[list]!.entries()) { assert.equal(await page.locator(`#tune-sipoc-${list}-${i}-name`).inputValue(), p.name); assert.equal(await page.locator(`#tune-sipoc-${list}-${i}-detail`).inputValue(), p[key] ?? ''); }
   await closeDef(); await importFeed(); await openDef();
   const party = (list: 'suppliers' | 'customers', i: number, part: 'name' | 'detail') => page.locator(`#tune-sipoc-${list}-${i}-${part}`), sipoc = async () => (await defOf()).sipoc;
   assert.equal(await page.locator('#tune-h-sipoc').innerText(), 'Suppliers and customers (SIPOC)'); assert.match(await page.locator('#tune-sipoc-help').innerText(), /^Inputs, process stages and outputs are derived automatically from the process; only suppliers and customers need to be written\./);
   assert.equal(Object.hasOwn(await defOf(), 'sipoc'), false); assert.equal(await page.locator('#tune-sipoc-suppliers-add').innerText(), 'Add supplier'); assert.equal(await page.locator('#tune-sipoc-customers-add').innerText(), 'Add customer');
   // Adding writes sipoc with a unique default name, focuses the name and labels fields with their limits.
   await page.locator('#tune-sipoc-suppliers-add').click(); assert.deepEqual(await sipoc(), {suppliers: [{name: 'Supplier 1'}]}); assert.equal(await page.evaluate(() => document.activeElement?.id), 'tune-sipoc-suppliers-0-name');
   assert.equal(await page.locator('label[for="tune-sipoc-suppliers-0-name"]').innerText(), 'Name (up to 60 characters)'); assert.equal(await page.locator('label[for="tune-sipoc-suppliers-0-detail"]').innerText(), 'What they supply (optional, up to 160 characters)');
   assert.equal(await party('suppliers', 0, 'name').getAttribute('maxlength'), '60'); assert.equal(await party('suppliers', 0, 'detail').getAttribute('maxlength'), '160');
   await party('suppliers', 0, 'name').fill('Payment provider'); await party('suppliers', 0, 'detail').fill('Payment confirmation');
   await page.locator('#tune-sipoc-customers-add').click(); await party('customers', 0, 'name').fill('Shopper'); assert.equal(await page.locator('label[for="tune-sipoc-customers-0-detail"]').innerText(), 'What they receive (optional, up to 160 characters)'); await party('customers', 0, 'detail').fill('Ordered goods');
   assert.deepEqual(await sipoc(), {suppliers: [{name: 'Payment provider', supplies: 'Payment confirmation'}], customers: [{name: 'Shopper', receives: 'Ordered goods'}]}); await inSync();
   // An emptied detail removes the key; an emptied name is a problem beside the field.
   await party('suppliers', 0, 'detail').fill(''); assert.deepEqual((await sipoc())!.suppliers, [{name: 'Payment provider'}]); await party('suppliers', 0, 'detail').fill('Payment confirmation');
   await party('customers', 0, 'name').fill(''); assert.match(await page.locator('#tune-sipoc-customers-0-name-err').innerText(), /Use 1 to 60 characters/); assert.equal(await party('customers', 0, 'name').getAttribute('aria-invalid'), 'true'); await party('customers', 0, 'name').fill('Shopper');
   assert.equal(await page.locator('#tune-sipoc-customers-0-name-err').innerText(), '');
   // A repeated name is the engine's own problem, shown beside the second row and listed with its readable path.
   await page.locator('#tune-sipoc-suppliers-add').click(); assert.equal((await sipoc())!.suppliers![1]!.name, 'Supplier 2'); await party('suppliers', 1, 'name').fill('Payment provider');
   assert.match(await page.locator('#tune-sipoc-suppliers-1-name-err').innerText(), /Party Payment provider is listed twice/); assert.equal(await party('suppliers', 1, 'name').getAttribute('aria-invalid'), 'true'); assert.match(await page.locator('#diagnostics').innerText(), /Supplier 2 › name/);
   assert.match(await page.locator('#tune-summary').innerText(), /1 problem in this form/); await party('suppliers', 1, 'name').fill('Courier'); assert.equal(await page.locator('#tune-sipoc-suppliers-1-name-err').innerText(), ''); assert.equal(await page.locator('#diagnostics li').count(), 0);
   // At most eight per list, with a visible reason; the draft stays valid for the engine.
   for (let i = 0; i < 6; i++) await page.locator('#tune-sipoc-suppliers-add').click();
   assert.equal((await sipoc())!.suppliers!.length, 8); assert.equal(await page.locator('#tune-sipoc-suppliers-add').isDisabled(), true); assert.equal(await page.locator('#tune-sipoc-suppliers-full').innerText(), 'At most 8 suppliers are listed.'); assert.equal(await page.locator('#tune-sipoc-customers-add').isEnabled(), true);
   assert.equal(await page.evaluate(d => (globalThis as any).LWProcessCatalog.validate(d).ok, await defOf()), true);
   for (let i = 7; i >= 2; i--) await page.locator(`[data-act="sipoc-remove"][data-list="suppliers"][data-i="${i}"]`).click();
   assert.equal(await page.locator('#tune-sipoc-suppliers-add').isEnabled(), true); assert.deepEqual((await sipoc())!.suppliers!.map(p => p.name), ['Payment provider', 'Courier']);
   // Raw JSON names the new paths in plain words.
   const raw = JSON.parse(await draftText()) as Record<string, any>; raw.sipoc = {suppliers: [{name: 'A'}, {name: 'A'}]}; await page.locator('#draft').fill(JSON.stringify(raw, null, 2));
   await page.waitForFunction(() => document.querySelectorAll('#diagnostics li').length > 0); assert.match(await page.locator('#diagnostics').innerText(), /Supplier 2 › name/);
   raw.sipoc = {customers: [{name: 'B', receives: ''}]}; await page.locator('#draft').fill(JSON.stringify(raw, null, 2));
   await page.waitForFunction(() => /Customer 1 › receives/.test(document.getElementById('diagnostics')!.textContent!));
   await restoreDef(); await page.waitForFunction(() => !('sipoc' in JSON.parse((document.getElementById('draft') as HTMLTextAreaElement).value))); await inSync();
   // Removing every party removes the key; the focus returns to the Add button.
   await page.locator('#tune-sipoc-suppliers-add').click(); await page.locator('#tune-sipoc-customers-add').click(); await page.locator('[data-act="sipoc-remove"][data-list="suppliers"]').click(); assert.deepEqual(Object.keys((await sipoc())!), ['customers']);
   await page.locator('[data-act="sipoc-remove"][data-list="customers"]').click(); assert.equal(Object.hasOwn(await defOf(), 'sipoc'), false); assert.equal(await page.evaluate(() => document.activeElement?.id), 'tune-sipoc-customers-add');
   // Applying keeps the parties, and the SIPOC view lists them as suppliers and customers.
   await page.locator('#tune-sipoc-suppliers-add').click(); await party('suppliers', 0, 'name').fill('Fabric mill'); await party('suppliers', 0, 'detail').fill('Rolls of cloth');
   await page.locator('#tune-sipoc-customers-add').click(); await party('customers', 0, 'name').fill('Boutique'); await applyDef();
   const applied = await query(page); assert.deepEqual(applied.definition.sipoc, {suppliers: [{name: 'Fabric mill', supplies: 'Rolls of cloth'}], customers: [{name: 'Boutique'}]}); assert.equal(applied.snapshot.minute, 0);
   await page.locator('#mode-lens').click(); await page.waitForFunction(() => document.querySelectorAll('#lens .sipoc-col-suppliers .sipoc-card').length > 0);
   assert.match(await page.locator('#lens .sipoc-col-suppliers').innerText(), /Fabric mill[\s\S]*Rolls of cloth/); assert.match(await page.locator('#lens .sipoc-col-customers').innerText(), /Boutique/);
  });
  // BPMN-class fixture: `rich` carries inclusive fork conditions, instances and deadline paths; the plain variant is what the step editor starts from.
  const claimsDesk = (rich: boolean, lateFirst = false) => {
   const scene = (id: string, x: number, y = 0) => ({id: 'scene-' + id, position: [x, y] as [number, number], color: '#91b9d5'});
   const late = {id: 'approve-late', from: 'approve', to: 'notify', on: 'deadline'}, normal = {id: 'f7', from: 'approve', to: 'done'};
   return {format: 'wildlands-process', schemaVersion: 1, revision: 1, id: 'claims-desk', name: 'Claims desk', start: 'start', seed: 7,
    resources: [{id: 'clerks', name: 'Clerks', capacity: 3, costPerMinute: 1}, {id: 'auditors', name: 'Auditors', capacity: 2, costPerMinute: 2}],
    steps: [{id: 'start', name: 'Start', kind: 'start', scene: scene('start', 0)},
     {id: 'intake', name: 'Take in the claim', kind: 'task', duration: 8, timing: {dist: 'uniform', min: 4, max: 14}, resources: {clerks: 1}, set: {registered: true}, ...rich ? {deadline: {after: 11, mode: 'interrupt', flow: 'intake-late'}} : {}, scene: scene('intake', 14)},
     {id: 'route', name: 'Route the claim', kind: 'fork', join: 'merge', ...rich ? {mode: 'inclusive'} : {}, scene: scene('route', 28)},
     {id: 'insure', name: 'Check insurance', kind: 'task', duration: 5, resources: {clerks: 1}, set: {insuredChecked: true}, scene: scene('insure', 42, -8)}, {id: 'gift', name: 'Check gift wrap', kind: 'task', duration: 5, resources: {clerks: 1}, set: {wrapped: true}, scene: scene('gift', 42, 8)},
     {id: 'merge', name: 'Merge checks', kind: 'join', scene: scene('merge', 56)},
     {id: 'inspect', name: 'Inspect the lines', kind: 'task', duration: 4, resources: {auditors: 1}, set: {inspected: true}, ...rich ? {instances: {field: 'lines', mode: 'parallel'}} : {backlog: {capacity: 5}}, scene: scene('inspect', 70)},
     {id: 'approve', name: 'Approve the payout', kind: 'task', duration: 30, resources: {clerks: 1}, set: {approved: true}, deadline: {after: 20, mode: 'escalate', flow: 'approve-late'}, scene: scene('approve', 84)},
     {id: 'notify', name: 'Notify the manager', kind: 'task', duration: 15, resources: {clerks: 1}, scene: scene('notify', 98, 8)}, {id: 'alert', name: 'Escalated', kind: 'end', scene: scene('alert', 112, 8)}, {id: 'done', name: 'Paid out', kind: 'end', outcome: 'goal', scene: scene('done', 98, -4)},
     ...rich ? [{id: 'timeout', name: 'Timed out', kind: 'end', outcome: 'lost', scene: scene('timeout', 28, 12)}] : []],
    flows: [{id: 'f1', from: 'start', to: 'intake'}, ...rich ? [{id: 'intake-late', from: 'intake', to: 'timeout', on: 'deadline'}] : [], {id: 'f2', from: 'intake', to: 'route'},
     {id: 'to-insure', from: 'route', to: 'insure', ...rich ? {when: {field: 'insured', op: 'eq', value: true}} : {}}, {id: 'to-gift', from: 'route', to: 'gift', ...rich ? {when: {all: [{field: 'gift', op: 'eq', value: true}, {not: {field: 'insured', op: 'eq', value: true}}]}} : {}}, ...rich ? [{id: 'to-merge', from: 'route', to: 'merge'}] : [],
     {id: 'f3', from: 'insure', to: 'merge'}, {id: 'f4', from: 'gift', to: 'merge'}, {id: 'f5', from: 'merge', to: 'inspect'}, {id: 'f6', from: 'inspect', to: 'approve'}, ...lateFirst ? [late, normal] : [normal, late], {id: 'f8', from: 'notify', to: 'alert'}],
    arrivals: [{at: 0, count: 6, interval: 6, data: {lines: 3}, draws: [{field: 'insured', kind: 'chance', percent: 50}, {field: 'gift', kind: 'chance', percent: 50}]}]};
  };
  const importClaims = async (rich: boolean, lateFirst = false) => { await freshStudio(); await importJson('claims-desk.json', claimsDesk(rich, lateFirst)); };
  const catalogOk = (text: string) => page.evaluate(t => (globalThis as unknown as {LWProcessCatalog: LWProcess.Catalog}).LWProcessCatalog.validate(JSON.parse(t)).ok, text);
  const discard = async () => { await page.locator('#se-cancel').click(); const confirm = page.locator('#se-discard'); if (await confirm.count()) await confirm.click(); await page.waitForFunction(() => document.querySelectorAll('dialog.pd-dialog[open]').length === 0); };
  await check('Step editor edits inclusive forks, multiple instances, deadlines and combined conditions and keeps them valid', async () => {
   await importClaims(false); await openRandom('route');
   assert.equal(await page.locator('#se-h-branching').count(), 1); assert.equal(await page.locator('#se-branching').inputValue(), 'parallel'); assert.equal(await page.locator('#se-path-summary').count(), 0); assert.equal(await page.locator('#se-flows-0-cond-on').count(), 0);
   await page.locator('#se-branching').selectOption('inclusive'); assert.match(await page.locator('#se-branching-note').innerText(), /every branch whose condition is true/);
   assert.deepEqual(await page.locator('#se-path-summary li').allInnerTexts(), ['Otherwise (default branch) → Check insurance', 'Otherwise (default branch) → Check gift wrap']);
   assert.match(await page.locator('#se-status').innerText(), /at most one flow without a condition/);
   await page.locator('#se-flows-0-cond-on').check(); await page.locator('#se-flows-0-cond-field').fill('insured'); assert.equal((await page.locator('#se-path-summary li').allInnerTexts())[0], 'If insured = true → Check insurance');
   assert.doesNotMatch(await page.locator('#se-status').innerText(), /at most one flow without a condition/); assert.equal(await page.locator('#se-save').isEnabled(), true);
   // All of these / Any of these / Not: nested rows with real labels, a depth of three groups and at most eight tests.
   await page.locator('#se-flows-0-cond-mode-all').check(); assert.equal(await page.locator('#se-flows-0-cond-items-0-field').inputValue(), 'insured'); assert.equal(await page.locator('#se-flows-0-cond-items-1-field').count(), 1);
   assert.match(await page.locator('#se-err-flows-0').innerText(), /Name the case field to test/); assert.equal(await page.locator('#se-save').isDisabled(), true); assert.equal(await page.getByLabel('Case field to test (test 2)').count(), 1);
   await page.locator('#se-flows-0-cond-items-1-field').fill('gift'); await page.locator('#se-flows-0-cond-items-1-mode').selectOption('chance'); await page.locator('#se-flows-0-cond-items-1-chance').fill('8');
   assert.equal((await page.locator('#se-path-summary li').allInnerTexts())[0], 'If insured = true AND 8% of cases → Check insurance');
   await page.locator('#se-flows-0-cond-add').click(); assert.equal(await activeId(), 'se-flows-0-cond-items-2-field'); await page.locator('#se-flows-0-cond-items-2-mode').selectOption('any');
   await page.locator('#se-flows-0-cond-items-2-items-0-mode').selectOption('not'); assert.equal(await page.locator('#se-flows-0-cond-items-2-items-0-items-0-field').count(), 1);
   assert.deepEqual(await page.locator('#se-flows-0-cond-items-2-items-0-items-0-mode option').evaluateAll(o => o.map(x => (x as HTMLOptionElement).value)), ['value', 'field', 'chance'], 'a third-level group offers no further groups');
   await page.locator('#se-flows-0-cond-items-2-items-0-items-0-field').fill('vip'); await page.locator('#se-flows-0-cond-items-2-items-1-field').fill('region'); await page.locator('#se-flows-0-cond-items-2-items-1-value-type').selectOption('text'); await page.locator('#se-flows-0-cond-items-2-items-1-value-text').fill('eu');
   assert.equal((await page.locator('#se-path-summary li').allInnerTexts())[0], 'If insured = true AND 8% of cases AND (NOT vip = true OR region = "eu") → Check insurance'); assert.equal(await page.locator('#se-err-flows-0 .se-err').count(), 0);
   for (let i = 0; i < 4; i++) await page.locator('#se-flows-0-cond-add').click();
   assert.equal(await page.locator('#se-flows-0-cond-add').isDisabled(), true); assert.match(await page.locator('#se-flows-0-cond-max').innerText(), /At most 8 tests in a group and 8 in the whole condition/);
   for (let i = 6; i >= 3; i--) await page.locator(`[data-act="remove-cond"][data-path="flows.0.cond"][data-i="${i}"]`).click(); assert.equal(await page.locator('#se-flows-0-cond-add').isEnabled(), true); assert.equal(await page.locator('#se-flows-0-cond-items-3-field').count(), 0);
   await page.locator('#se-save').click(); assert.equal(await dialogOpen(), 0);
   const def = await defOf(), route = def.steps.find(s => s.id === 'route')!, when = def.flows.filter(f => f.from === 'route').map(f => f.when);
   assert.equal(route.mode, 'inclusive'); assert.deepEqual(when, [{all: [{field: 'insured', op: 'eq', value: true}, {chance: 8}, {any: [{not: {field: 'vip', op: 'eq', value: true}}, {field: 'region', op: 'eq', value: 'eu'}]}]}, undefined]); assert.equal(await catalogOk(await draftText()), true);
   // Back to parallel clears the conditions in the written draft; the saved inclusive draft reopens with its tree.
   await openRandom('route'); assert.equal(await page.locator('#se-branching').inputValue(), 'inclusive'); assert.equal((await page.locator('#se-path-summary li').allInnerTexts())[0]!.startsWith('If insured = true AND 8% of cases AND ('), true);
   await page.locator('#se-branching').selectOption('parallel'); assert.equal(await page.locator('#se-path-summary').count(), 0); await page.locator('#se-save').click(); assert.deepEqual((await defOf()).flows.filter(f => f.from === 'route').map(f => f.when), [undefined, undefined]); assert.equal((await defOf()).steps.find(s => s.id === 'route')!.mode, undefined);
   await openRandom('route'); await page.locator('#se-branching').selectOption('inclusive'); await page.locator('#se-flows-0-cond-on').check(); await page.locator('#se-flows-0-cond-field').fill('insured'); await page.locator('#se-save').click();
   // Multiple instances are blocked, with a visible reason, while a backlog exists.
   await openRandom('inspect'); assert.equal(await page.locator('#se-h-instances').count(), 1); assert.equal(await page.locator('#se-instances-kind').isDisabled(), true); assert.match(await page.locator('#se-instances-blocked').innerText(), /cannot be combined with a backlog/);
   assert.equal(await page.locator('#se-instances-kind').getAttribute('aria-describedby'), 'se-instances-blocked'); await page.locator('#se-backlog-on').uncheck(); assert.equal(await page.locator('#se-instances-kind').isEnabled(), true); assert.equal(await page.locator('#se-instances-blocked').count(), 0);
   await page.locator('#se-instances-kind').selectOption('count'); assert.equal(await page.locator('#se-instances-count').inputValue(), '3'); assert.equal(await page.locator('#se-instances-mode-parallel').isChecked(), true);
   await page.locator('#se-instances-count').fill('1'); assert.match(await page.locator('#se-err-instances').innerText(), /from 2 to 50/); assert.equal(await page.locator('#se-instances-count').getAttribute('aria-invalid'), 'true'); assert.equal(await page.locator('#se-save').isDisabled(), true);
   await page.locator('#se-instances-count').fill('60'); assert.match(await page.locator('#se-err-instances').innerText(), /from 2 to 50/); await page.locator('#se-instances-count').fill('4'); await page.locator('#se-instances-mode-sequential').check();
   assert.match(await page.locator('#se-instances-note').innerText(), /Runs 4 instances one after another/); await page.locator('#se-instances-kind').selectOption('field'); await page.locator('#se-instances-field').fill('Lines'); assert.match(await page.locator('#se-err-instances').innerText(), /lowercase letter/);
   await page.locator('#se-instances-field').fill('lines'); await page.locator('#se-instances-mode-parallel').check(); assert.match(await page.locator('#se-instances-note').innerText(), /one instance for each unit counted in case field "lines"/); await page.locator('#se-save').click();
   const inspect = (await defOf()).steps.find(s => s.id === 'inspect')!; assert.deepEqual(inspect.instances, {field: 'lines', mode: 'parallel'}); assert.equal(inspect.backlog, undefined);
   await openRandom('inspect'); await page.locator('#se-backlog-on').check(); assert.match(await page.locator('#se-status').innerText(), /cannot keep a backlog/); await page.locator('#se-backlog-on').uncheck(); await page.locator('#se-instances-kind').selectOption('none'); assert.equal(await page.locator('#se-instances-mode-parallel').count(), 0); await discard();
   // Deadlines: choose the deadline flow among the existing ones, random time, interrupt or escalate, with inline problems.
   await openRandom('approve'); assert.equal(await page.locator('#se-deadline-kind').inputValue(), 'after'); assert.equal(await page.locator('#se-deadline-after').inputValue(), '20'); assert.equal(await page.locator('#se-deadline-mode-escalate').isChecked(), true); assert.equal(await page.locator('#se-deadline-flow').inputValue(), 'approve-late');
   assert.deepEqual(await page.locator('#se-deadline-flow option').allInnerTexts(), ['Choose a flow', 'f7 → Paid out', 'approve-late → Notify the manager']); assert.match(await page.locator('#se-deadline-note').innerText(), /After 20 min of work the deadline escalates/);
   await page.locator('#se-deadline-after').fill('0'); assert.match(await page.locator('#se-err-deadline').innerText(), /from 1 to 100,000/); await page.locator('#se-deadline-after').fill('25'); assert.match(await page.locator('#se-deadline-note').innerText(), /After 25 min/);
   await page.locator('#se-deadline-kind').selectOption('timing'); assert.equal(await page.locator('#se-deadline-timing-dist').inputValue(), 'exponential'); assert.equal(await page.locator('#se-deadline-timing-mean').inputValue(), '15');
   await page.locator('#se-deadline-timing-dist').selectOption('normal'); assert.equal(await page.locator('#se-deadline-timing-sd').inputValue(), '4'); await page.locator('#se-deadline-timing-sd').fill('0'); assert.match(await page.locator('#se-err-deadline').innerText(), /spread.*from 1 to 100,000/);
   await page.locator('#se-deadline-timing-sd').fill('3'); await page.locator('#se-deadline-timing-min').fill('25'); await page.locator('#se-deadline-timing-max').fill('20'); assert.match(await page.locator('#se-err-deadline').innerText(), /minimum \(25\) must not be above the maximum \(20\)/); await page.locator('#se-deadline-timing-min').fill(''); await page.locator('#se-deadline-timing-max').fill('');
   await page.locator('#se-deadline-mode-interrupt').check(); await page.locator('#se-deadline-flow').selectOption('f7'); assert.match(await page.locator('#se-sections fieldset.se-deadline-path legend').innerText(), /to Paid out · deadline path/); await page.locator('#se-deadline-flow').selectOption('approve-late');
   await page.locator('#se-save').click(); const approve = (await defOf()); assert.deepEqual(approve.steps.find(s => s.id === 'approve')!.deadline, {timing: {dist: 'normal', mean: 15, sd: 3}, mode: 'interrupt', flow: 'approve-late'});
   assert.deepEqual(approve.flows.filter(f => f.from === 'approve').map(f => [f.id, f.on]), [['f7', undefined], ['approve-late', 'deadline']]);
   // A step with a single outgoing flow explains how to add the deadline flow in the JSON instead of offering one.
   await openRandom('notify'); await page.locator('#se-deadline-kind').selectOption('after'); assert.match(await page.locator('#se-deadline-noflow').innerText(), /only one outgoing flow/); assert.equal(await page.locator('#se-deadline-flow').count(), 0);
   assert.match(await page.locator('#se-err-deadline').innerText(), /second flow/); assert.equal(await page.locator('#se-save').isDisabled(), true); await page.locator('#se-deadline-help').click(); assert.equal(await page.locator('#se-deadline-help').getAttribute('aria-expanded'), 'true');
   assert.match(await page.locator('#se-deadline-hint').innerText(), /"on": "deadline"/); await page.locator('#se-deadline-kind').selectOption('none'); assert.equal(await page.locator('#se-err-deadline .se-err').count(), 0); await discard();
   // The saved draft is accepted by the engine and a seeded run records items and deadlines in the metrics.
   assert.equal(await catalogOk(await draftText()), true); await openRandom('approve'); await page.locator('#se-apply').click(); await page.waitForFunction(() => document.querySelectorAll('dialog.pd-dialog[open]').length === 0);
   for (let i = 0; i < 3; i++) await page.locator('#advance').click();
   const run = (await query(page)).snapshot, steps = new Map(run.steps.map(s => [s.id, s]));
   assert.ok(steps.get('inspect')!.items!.started >= 3 && steps.get('inspect')!.items!.finished >= 3, 'instances run as items'); assert.ok(steps.get('approve')!.deadlines!.interrupted > 0, 'approvals past the random deadline are interrupted'); assert.equal(steps.get('route')!.id, 'route');
  });
  await check('Random view and arrival editor describe and edit normal and Erlang distributions', async () => {
   await freshStudio();
   const out = await page.evaluate(() => {
    const v = (globalThis as unknown as {LWProcessRandomView: LWProcessRandomView.Api}).LWProcessRandomView, c = (f: string, op: LWProcess.Condition['op'], value: LWProcess.Scalar): LWProcess.Condition => ({field: f, op, value});
    return [v.describeDist({dist: 'normal', mean: 30, sd: 5}), v.describeDist({dist: 'normal', mean: 30, sd: 5, min: 20, max: 45}), v.describeDist({dist: 'normal', mean: 30, sd: 5, max: 40}), v.describeDist({dist: 'erlang', k: 3, mean: 30}), v.describeDist({dist: 'erlang', k: 1, mean: 30}),
     v.describeTiming({duration: 30, timing: {dist: 'normal', mean: 30, sd: 5}}), v.describeArrival({at: 0, open: true, interval: 10, gap: {dist: 'normal', mean: 10, sd: 2}, data: {}}), v.describeArrival({at: 0, open: true, interval: 10, gap: {dist: 'erlang', k: 3, mean: 10}, data: {}}),
     v.describeWhen({all: [c('amount', 'gte', 1000), {any: [c('region', 'eq', 'eu'), {not: c('vip', 'eq', true)}]}]}), v.describeWhen({not: {chance: 5}}), v.describeWhen({any: [{chance: 8}, c('a', 'lt', 3)]}), v.describeWhen({not: {all: [c('a', 'eq', 1), c('b', 'ne', 2)]}}),
     v.describeInstances({instances: {count: 3, mode: 'parallel'}}), v.describeInstances({instances: {field: 'lines', mode: 'sequential'}}), v.describeInstances({}),
     v.describeDeadline({deadline: {after: 20, mode: 'escalate', flow: 'x'}}), v.describeDeadline({deadline: {timing: {dist: 'exponential', mean: 4}, mode: 'interrupt', flow: 'x'}}), v.describeDeadline({}),
     v.describeFork({kind: 'fork'}), v.describeFork({kind: 'fork', mode: 'inclusive'}), v.describeFork({kind: 'task'})];
   });
   assert.deepEqual(out, ['Normal, mean 30 min, sd 5', 'Normal, mean 30 min, sd 5 (between 20 and 45)', 'Normal, mean 30 min, sd 5 (between 1 and 40)', 'Erlang, 3 phases, mean 30 min', 'Erlang, 1 phase, mean 30 min',
    'Planned 30 min (the average shown in estimates); each visit draws its own time: Normal, mean 30 min, sd 5', 'Keeps arriving: every ~10 min, random gap (normal, mean 10, sd 2), first at minute 0', 'Keeps arriving: every ~10 min, random gap (erlang, 3 phases, mean 10), first at minute 0',
    'If amount ≥ 1000 and (region = "eu" or not vip = true)', 'If not 5% of cases', 'If 8% of cases or a < 3', 'If not (a = 1 and b ≠ 2)',
    'Runs 3 instances in parallel: all are queued at once and start as capacity allows. The step completes once, when every instance is done.', 'Runs one instance for each unit counted in case field "lines" (1 to 50) one after another: each starts when the one before it is done. The step completes once, when every instance is done.', '',
    'After 20 min of work the deadline escalates: the work keeps going and the deadline path starts beside it.', 'After a random time of work (Exponential, mean 4 min) the deadline interrupts: the work is cancelled and the case takes the deadline path.', '',
    'Parallel fork: starts every branch at once, and its join waits for all of them.', 'Inclusive fork: starts every branch whose condition is true (the branch without a condition if none is), and its join waits for exactly those branches.', '']);
   // Step editor: normal needs mean and a spread of at least 1, optional bounds must leave a range; Erlang needs 1 to 32 phases.
   await importRandom(); await openRandom('pack'); await page.locator('#se-timing-dist').selectOption('normal'); assert.equal(await page.locator('#se-timing-mean').inputValue(), '12'); assert.equal(await page.locator('#se-timing-sd').inputValue(), '3');
   assert.equal(await page.locator('#se-timing-min').inputValue(), ''); assert.equal(await page.locator('#se-timing-max').getAttribute('placeholder'), 'Default mean + 6 × spread');
   await page.locator('#se-timing-sd').fill('0'); assert.match(await page.locator('#se-err-timing').innerText(), /spread.*from 1 to 100,000/); assert.equal(await page.locator('#se-timing-sd').getAttribute('aria-invalid'), 'true'); assert.equal(await page.locator('#se-save').isDisabled(), true); await page.locator('#se-timing-sd').fill('3');
   await page.locator('#se-timing-min').fill('40'); assert.match(await page.locator('#se-err-timing').innerText(), /minimum \(40\) must not be above the maximum \(30, the default of mean \+ 6 × sd\)/); await page.locator('#se-timing-max').fill('35'); assert.match(await page.locator('#se-err-timing').innerText(), /maximum \(35\)\./);
   await page.locator('#se-timing-min').fill('8'); await page.locator('#se-timing-max').fill('20'); assert.equal(await page.locator('#se-err-timing .se-err').count(), 0); await page.locator('#se-save').click(); assert.deepEqual((await savedStep('pack')).timing, {dist: 'normal', mean: 12, sd: 3, min: 8, max: 20});
   await openRandom('pack'); assert.equal(await page.locator('#se-timing-dist').inputValue(), 'normal'); assert.equal(await page.locator('#se-timing-min').inputValue(), '8'); await page.locator('#se-timing-dist').selectOption('erlang'); assert.equal(await page.locator('#se-timing-k').inputValue(), '3'); assert.equal(await page.locator('#se-timing-sd').count(), 0); assert.equal(await page.locator('#se-timing-min').count(), 0);
   for (const bad of ['0', '33']) { await page.locator('#se-timing-k').fill(bad); assert.match(await page.locator('#se-err-timing').innerText(), /phases from 1 to 32/); assert.equal(await page.locator('#se-timing-k').getAttribute('aria-invalid'), 'true'); }
   await page.locator('#se-timing-k').fill('2'); assert.equal(await page.locator('#se-err-timing .se-err').count(), 0); await page.locator('#se-save').click(); assert.deepEqual((await savedStep('pack')).timing, {dist: 'erlang', k: 2, mean: 12});
   await openRandom('pack'); await page.locator('#se-apply').click(); await page.waitForFunction(() => document.querySelectorAll('dialog.pd-dialog[open]').length === 0);
   for (let i = 0; i < 6; i++) await page.locator('#advance').click();
   const packs = (await query(page)).snapshot.receipts.filter(r => r.stepId === 'pack'); assert.ok(packs.length >= 4 && packs.every(r => r.duration !== undefined && r.duration >= 1 && r.duration === r.finished - r.started), 'Erlang visits record realized durations');
   // Definition editor: the arrival gap offers Normal and Erlang with local range checks and the engine's range message.
   await freshStudio(); await openDef(); const arr = (id: string) => page.locator('#tune-arr-0-' + id);
   assert.deepEqual(await arr('gap-dist').locator('option').allInnerTexts(), ['None (exact spacing)', 'Uniform (min to max)', 'Triangular (min, most likely, max)', 'Exponential (average, optional cap)', 'Normal (average and spread, optional bounds)', 'Erlang (phases and average)']);
   await arr('gap-dist').selectOption('normal'); let gap = (await defOf()).arrivals[0]!.gap!; assert.equal(gap.dist, 'normal'); assert.ok(gap.mean! >= 1 && gap.sd! >= 1); assert.equal(await arr('gap-sd').count(), 1); assert.equal(await arr('gap-min').count(), 1);
   await arr('gap-sd').fill('0'); assert.match(await page.locator('#tune-arr-0-gap-sd-err').innerText(), /from 1 to 100,000/); assert.equal(await arr('gap-sd').getAttribute('aria-invalid'), 'true'); await arr('gap-sd').fill('4');
   await arr('gap-min').fill('9'); await arr('gap-max').fill('3'); assert.match(await page.locator('#tune-arr-0-gap-group-err').innerText(), /min at most max/); await arr('gap-max').fill('20'); assert.equal(await page.locator('#tune-arr-0-gap-group-err').innerText(), '');
   gap = (await defOf()).arrivals[0]!.gap!; assert.deepEqual([gap.sd, gap.min, gap.max], [4, 9, 20]); await arr('gap-dist').selectOption('erlang'); gap = (await defOf()).arrivals[0]!.gap!; assert.deepEqual(Object.keys(gap).sort(), ['dist', 'k', 'mean']); assert.equal(gap.k, 3);
   await arr('gap-k').fill('40'); assert.match(await page.locator('#tune-arr-0-gap-k-err').innerText(), /from 1 to 32/); await arr('gap-k').fill('4'); assert.equal(await page.locator('#tune-arr-0-gap-k-err').innerText(), '');
   assert.equal(await arr('gap-dist').getAttribute('aria-invalid'), null); await applyDef(); const applied = await query(page); assert.deepEqual(applied.definition.arrivals[0]!.gap, {dist: 'erlang', k: 4, mean: applied.definition.arrivals[0]!.gap!.mean});
  });
  await check('Renderers show inclusive forks, multiple instances, deadline paths and escalated tokens and route views ignore deadline flows', async () => {
   await page.setViewportSize({width: 1440, height: 1060}); await importClaims(true, true); await page.locator('#mode-2d').click();
   for (let i = 0; i < 2; i++) await page.locator('#advance').click();
   const live = (await query(page)).snapshot; assert.ok(live.tokens.some(t => t.escalated) && live.tokens.some(t => t.item !== undefined && t.items === 3 || t.deadlineAt !== undefined), 'the seeded run holds escalated, item and deadline tokens'); assert.equal(live.minute, 60);
   const map = await page.evaluate(() => {
    const q = (s: string) => [...document.querySelectorAll<SVGElement>('#map svg ' + s)];
    return {deadline: q('.pm-edge-deadline').map(e => [e.dataset.flow, e.getAttribute('stroke'), e.getAttribute('stroke-dasharray'), e.getAttribute('class')]), plain: q('.pm-edge:not(.pm-edge-deadline):not(.pm-edge-conditional)').map(e => e.getAttribute('stroke')), tags: q('.pm-deadline-tag text').map(t => t.textContent),
     conditional: q('.pm-edge-conditional').map(e => [e.dataset.flow, e.getAttribute('class')?.includes('pm-edge-inclusive'), e.getAttribute('stroke')]), gateways: q('.pm-gateway-inclusive').length, instances: q('.pm-instances').map(p => p.textContent), clocks: q('.pm-deadline-badge').length,
     escalated: q('.pm-token-escalated').map(c => c.getAttribute('fill')), label: document.getElementById('process-map-route')!.getAttribute('aria-label')};
   });
   assert.deepEqual(map.deadline.map(d => d[0]).sort(), ['approve-late', 'intake-late']); assert.ok(map.deadline.every(d => d[2] && d[1] !== map.plain[0]), 'deadline flows are dashed in their own colour'); assert.deepEqual(map.deadline.map(d => d[3]).sort(), ['pm-edge pm-edge-deadline pm-edge-escalate', 'pm-edge pm-edge-deadline pm-edge-interrupt']);
   assert.deepEqual(map.tags.sort(), ['deadline · escalate', 'deadline · interrupt']); assert.deepEqual(map.conditional.map(c => c[0]).sort(), ['to-gift', 'to-insure']); assert.ok(map.conditional.every(c => c[1] === true && c[2] === '#c79871'), 'inclusive fork flows read like decision flows');
   assert.equal(map.gateways, 1); assert.match(map.label ?? '', /inclusive fork/); assert.equal(map.instances.length, 1); assert.match(map.instances[0] ?? '', /^x (3|lines)/); assert.equal(map.clocks, 2); assert.ok(map.escalated.length >= 1 && map.escalated.every(f => f === '#ff8a5c'), 'escalated tokens use their own marker colour');
   await page.locator('[data-step="inspect"]').click(); const inspectPill = await page.locator('#map svg .pm-instances').textContent(); assert.match(inspectPill ?? '', /^x (3|lines) · \d+ started · \d+ done$/); assert.match(await page.locator('#map svg g[role=button]').getAttribute('aria-label') ?? '', /instances parallel, \d+ items started, \d+ finished/);
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
   assert.ok(room.captions.some(c => /items \d+ started · \d+ done/.test(c) && /x lines/.test(c)), room.captions.join('\n')); assert.ok(room.captions.some(c => /\d+ escalated · 0 interrupted/.test(c) && /deadline 20 min escalate/.test(c))); assert.ok(room.markers.length >= 1 && room.markers.every(m => m === 'ff8a5c'), 'escalated markers have their own colour');
  });
  await check('Process browser lifecycle emits no runtime errors or network requests', async () => {
   assert.deepEqual(diagnostics.errors, []); assert.deepEqual(diagnostics.requests, []);
   assert.deepEqual(diagnostics.consoleProblems.filter(x => x.startsWith('error:')), []);
  });
 } finally {await context.close(); await browser.close(); fs.rmSync(dir, {recursive: true, force: true});}
}
main().catch(e => results.push({name: 'process browser harness', passed: false, error: String(e)})).finally(() => {
 fs.mkdirSync(OUT, {recursive: true}); const report = {passed: results.filter(r => r.passed).length, total: results.length, results};
 fs.writeFileSync(path.join(OUT, 'process-browser-results.json'), JSON.stringify(report, null, 2)); console.log(`${report.passed}/${report.total}`);
 if (!results.length || report.passed !== report.total) process.exitCode = 1;
});
