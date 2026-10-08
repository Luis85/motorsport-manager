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
   await page.locator('#reset').click(); await page.locator('[data-step="discovery"]').click();
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
   const pending = page.waitForEvent('download'); await page.locator('#bpmn').click(); const download = await pending, bpmnFile = path.join(dir, 'export.bpmn'); await download.saveAs(bpmnFile);
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
   pending = page.waitForEvent('download'); await page.locator('#json').click(); saved = await pending;
   const activeFile = path.join(dir, 'active.json'); await saved.saveAs(activeFile); assert.deepEqual(JSON.parse(fs.readFileSync(activeFile, 'utf8')), before.definition);
   assert.deepEqual(await query(page), before);
   await openDef(); assert.equal(await page.locator('#draft').inputValue(), raw);
   await restoreDef(); assert.equal(await page.locator('#draft').getAttribute('aria-invalid'), null);
   assert.match(await page.locator('#draft-state').innerText(), /matches the running definition/); await closeDef(); assert.equal(await page.locator('#draft-chip').isHidden(), true);
  });
  await check('Browser exported JSON imports losslessly and report binds definition to observed metrics', async () => {
   let pending = page.waitForEvent('download'); await page.locator('#json').click(); let download = await pending; const jsonFile = path.join(dir, 'export.json'); await download.saveAs(jsonFile);
   const definition = (await query(page)).definition; assert.deepEqual(JSON.parse(fs.readFileSync(jsonFile, 'utf8')), definition);
   await page.locator('#advance').click(); pending = page.waitForEvent('download'); await page.locator('#report').click(); download = await pending; const reportFile = path.join(dir, 'report.json'); await download.saveAs(reportFile);
   const report = JSON.parse(fs.readFileSync(reportFile, 'utf8')); assert.equal(report.snapshot.minute, 30); assert.deepEqual(report.definition, definition);
   await page.locator('#file').setInputFiles(jsonFile); await page.waitForFunction(() => document.getElementById('message')!.textContent!.includes('Imported'));
   assert.deepEqual((await query(page)).definition, definition); assert.equal((await query(page)).snapshot.minute, 0);
  });
  await check('Downloaded self-contained HTML reopens offline with the edited definition and no requests', async () => {
   const pending = page.waitForEvent('download'); await page.locator('#html').click(); const download = await pending, exported = path.join(dir, 'exported.html'); await download.saveAs(exported);
   const other = await context.newPage(); await openArtifact(other, exported, {url: fixtureUrls[1]!}); await waitForReady(other, {host: 'process'});
   assert.deepEqual((await query(other)).definition, (await query(page)).definition); assert.equal((await query(other)).snapshot.minute, 0);
   assert.equal(await other.locator('#process-title').count(), 1); await other.close(); assert.deepEqual(diagnostics.requests, []);
  });
  await check('Imported text renders inertly and survives escaped standalone HTML export', async () => {
   const d = (await query(page)).definition; d.name = '</script><img src=x onerror=alert(1)>';
   await page.locator('#file').setInputFiles({name: 'text.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(d))});
   await page.waitForFunction(() => document.getElementById('process-title')!.textContent!.startsWith('</script>'));
   assert.equal(await page.locator('img').count(), 0); const pending = page.waitForEvent('download'); await page.locator('#html').click(); const download = await pending, escaped = path.join(dir, 'escaped.html'); await download.saveAs(escaped);
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
  });
  const switchTo = async (index: number) => {
   const select = page.locator('#process-switch'); await select.focus(); await select.selectOption(String(index));
   await page.waitForFunction(i => (globalThis as unknown as {LWProcessStudio: {query(): {active: number}}}).LWProcessStudio.query().active === i, index);
  };
  const nameOf = (i: number) => page.evaluate(n => (globalThis as unknown as {LWProcessStudio: {definitions(): {name: string}[]}}).LWProcessStudio.definitions()[n]!.name, i);
  const applyDraft = async (change: (d: LWProcess.Definition) => void) => {
   await openDef(); const d = JSON.parse(await page.locator('#draft').inputValue()) as LWProcess.Definition; change(d);
   await page.locator('#draft').fill(JSON.stringify(d)); await applyDef();
  };
  await check('Process switch lists each process of a multi-process game, switches without ticking and stays hidden for one process', async () => {
   await openArtifact(page, file, {url: fixtureUrls[0]!}); await waitForReady(page, {host: 'process'});
   const first = await query(page); assert.equal(first.active, 0); assert.equal(first.processes.length, 3);
   assert.equal(await page.locator('#process-switch-label').isVisible(), true); assert.match(await page.locator('#process-switch-label').innerText(), /^Process/);
   assert.equal(await page.evaluate(() => (document.getElementById('process-switch') as HTMLSelectElement).labels![0]!.id), 'process-switch-label');
   assert.equal(await page.locator('#process-switch option').count(), 3); assert.equal(await page.locator('#process-switch').inputValue(), '0');
   assert.deepEqual(await page.locator('#process-switch option').allInnerTexts(), first.processes.map(p => p.name));
   assert.match(await page.locator('#process-subtitle').innerText(), /Process 1 of 3/);
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
   assert.equal(await page.locator('#map svg').count(), 1); assert.match(await page.locator('#process-subtitle').innerText(), /Process 2 of 3/);
   assert.match(await page.locator('#process-data').innerText(), /Process inputs/);
   // A one-process game has no switch.
   const single = path.join(dir, 'single', 'agency-delivery'), singleHtml = path.join(dir, 'single.html'), source = path.resolve(PROJECT, '../../docs/concepts/agency-delivery');
   fs.cpSync(source, single, {recursive: true}); fs.rmSync(path.join(single, 'content/agile-vendor.process.json')); fs.rmSync(path.join(single, 'content/order-fulfilment.process.json'));
   const manifest = JSON.parse(fs.readFileSync(path.join(single, 'game.json'), 'utf8')); manifest.content = {definition: 'content/agency.process.json'}; fs.writeFileSync(path.join(single, 'game.json'), JSON.stringify(manifest, null, 2) + '\n');
   const made = spawnSync(process.execPath, [cli, 'build-game', '--game', single, '--output', singleHtml], {encoding: 'utf8', timeout: 300000}); assert.equal(made.status, 0, made.stderr + made.stdout);
   const other = await context.newPage(); await openArtifact(other, singleHtml, {url: fixtureUrls[4]!}); await waitForReady(other, {host: 'process'});
   assert.equal(await other.locator('#process-switch-label').isVisible(), false); assert.equal(await other.locator('#process-subtitle').innerText(), 'Wildlands · Process Studio');
   assert.equal((await query(other)).processes.length, 1); await other.close();
  });
  await check('Editing one process survives switching away and back with its applied definition and unapplied draft', async () => {
   await openArtifact(page, file, {url: fixtureUrls[0]!}); await waitForReady(page, {host: 'process'});
   const original = [await nameOf(0), await nameOf(1), await nameOf(2)], before = await query(page);
   await applyDraft(d => {d.name = 'Edited agency';}); assert.equal((await query(page)).definition.revision, before.definition.revision + 1);
   await openDef(); const raw = '{\n  "unfinished":'; await page.locator('#draft').fill(raw); await closeDef();
   await switchTo(1); assert.equal(await page.locator('#process-title').innerText(), original[1]); assert.equal(await page.locator('#draft-chip').isHidden(), true);
   assert.equal(await page.locator('#process-switch option').first().innerText(), 'Edited agency'); assert.equal(await nameOf(0), 'Edited agency'); assert.equal((await query(page)).snapshot.minute, 0);
   // Import replaces only the active process, in place.
   const vendor = (await query(page)).definition; vendor.name = 'Imported vendor';
   await page.locator('#file').setInputFiles({name: 'vendor.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(vendor))});
   await page.waitForFunction(() => document.getElementById('message')!.textContent!.includes('Imported vendor.json'));
   assert.deepEqual(await page.locator('#process-switch option').allInnerTexts(), ['Edited agency', 'Imported vendor', original[2]!]); assert.equal((await query(page)).active, 1);
   await switchTo(0); assert.equal(await page.locator('#process-title').innerText(), 'Edited agency'); assert.equal((await query(page)).definition.revision, before.definition.revision + 1);
   assert.equal(await page.locator('#draft').inputValue(), raw); assert.match(await page.locator('#draft-chip').innerText(), /^Unapplied draft/);
   assert.equal((await query(page)).snapshot.minute, 0); assert.equal((await query(page)).playing, false);
  });
  await check('Downloaded HTML of a multi-process game reopens with every process in order and the applied edits', async () => {
   await openArtifact(page, file, {url: fixtureUrls[0]!}); await waitForReady(page, {host: 'process'});
   const names = [await nameOf(0), await nameOf(1), await nameOf(2)]; await switchTo(1); await applyDraft(d => {d.name = 'Edited vendor';});
   const pending = page.waitForEvent('download'); await page.locator('#html').click(); const download = await pending, exported = path.join(dir, 'multi-exported.html'); await download.saveAs(exported);
   const text = fs.readFileSync(exported, 'utf8'); assert.equal(download.suggestedFilename(), 'wildlands-processes.html');
   assert.equal((text.match(/^window\.LWProcessDefinition = /gm) ?? []).length, 1); assert.equal((text.match(/^window\.LWProcessDefinitions = /gm) ?? []).length, 1);
   const other = await context.newPage(); await openArtifact(other, exported, {url: fixtureUrls[3]!}); await waitForReady(other, {host: 'process'});
   const reopened = await query(other); assert.deepEqual(reopened.processes.map(p => p.name), [names[0], 'Edited vendor', names[2]]); assert.equal(reopened.active, 0); assert.equal(reopened.snapshot.minute, 0);
   assert.equal(reopened.definition.name, names[0]); assert.equal(await other.locator('#process-switch option').count(), 3);
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
   assert.match(await page.locator('#process-data').innerText(), new RegExp(`Waiting on timer · due minute ${token.due}`));
   await page.locator('#mode-3d').click(); await nextFrames(page); await page.locator('#overview').click(); await nextFrames(page);
   await page.locator('[data-step="until"]').click(); assert.match(await page.locator('#inspector').innerText(), /Until minute 200/);
   await page.locator('[data-step="wait"]').click(); await nextFrames(page);
   const kinds = await page.evaluate(() => (globalThis as any).LWProcessRooms.theme({id: 'x', kind: 'timer'}).id); assert.equal(kinds, 'clock');
   assert.deepEqual((await query(page)).snapshot, before); assert.equal((await query(page)).playing, false);
   await page.locator('#mode-2d').click(); await page.locator('#overview').click(); assert.match(await page.locator('#events').innerText(), /timer started/);
   await page.setViewportSize({width: 390, height: 844}); await nextFrames(page);
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); await page.screenshot({path: path.join(OUT, 'process-timer-mobile.png'), fullPage: true});
   await page.setViewportSize({width: 1440, height: 1060});
  });
  await check('Counter effects and timer receipts appear in Inputs and outputs and the inspector', async () => {
   await page.locator('#reset').click(); await page.locator('#step').click(); await page.locator('[data-step="loop"]').click();
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
   await page.locator('[data-step="pack"]').click(); assert.match(await page.locator('#process-data').innerText(), /Took \d+ min \(planned 12\)/); assert.ok(await page.locator('#process-data .se-drawn').count() >= 3);
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
   assert.deepEqual(await arr('gap-dist').locator('option').allInnerTexts(), ['None (exact spacing)', 'Uniform (min to max)', 'Triangular (min, most likely, max)', 'Exponential (average, optional cap)']);
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
