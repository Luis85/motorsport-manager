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
   await page.locator('#show-definition').click(); await page.locator('#tuning details:has(input[id^="tune-step-dur"])').first().locator('summary').click();
   const duration = page.locator('#tuning input[id^="tune-step-dur"]').first(); await duration.fill('77'); await duration.dispatchEvent('change');
   assert.deepEqual((await query(page)).definition, before.definition); assert.match(await page.locator('#draft').inputValue(), /"duration": 77/);
   await page.locator('#apply').click(); const applied = await query(page); assert.equal(applied.definition.steps.find(s => s.kind === 'task')!.duration, 77); assert.equal(applied.horizon, 1440); assert.equal(applied.snapshot.minute, 0);
   await page.locator('#horizon').selectOption('100000'); await page.locator('#show-events').click();
  });
  await check('Backlogs and step needs are visible in the inspector and editable in the tuning form', async () => {
   await page.locator('#reset').click(); const before = await query(page);
   await page.locator('[data-step="design-ready"]').click(); const backlog = await page.locator('#inspector').innerText(); assert.match(backlog, /Items \/ capacity/); assert.match(backlog, /Highest priority first/); assert.match(backlog, /Pull limit/);
   await page.locator('[data-step="implementation"]').click(); const needs = await page.locator('#inspector').innerText(); assert.match(needs, /Needs from earlier steps/); assert.match(needs, /requirementsReady = true/); assert.match(needs, /Delivered by Product design/);
   await page.locator('#overview').click(); await page.locator('#show-definition').click();
   const ready = page.locator('#tuning details', {hasText: 'Ready to build'}); await ready.locator('summary').click();
   const capacity = ready.locator('input[id^="tune-backlog-cap"]'); await capacity.fill('2'); await capacity.dispatchEvent('change');
   assert.equal(JSON.parse(await page.locator('#draft').inputValue()).steps.find((s: LWProcess.Step) => s.id === 'design-ready').backlog.capacity, 2);
   const order = page.locator('#tuning select[id^="tune-backlog-order"]'); await order.selectOption('lifo');
   const lifo = JSON.parse(await page.locator('#draft').inputValue()).steps.find((s: LWProcess.Step) => s.id === 'design-ready').backlog; assert.equal(lifo.order, 'lifo'); assert.equal(lifo.priority, undefined);
   await page.locator('#tuning details', {hasText: 'Ready to build'}).locator('input[id^="tune-backlog-field"]').count().then(n => assert.equal(n, 0));
   await page.locator('#tuning details', {hasText: 'Client handover'}).locator('summary').click();
   await page.locator('#tune-add-need-10').click(); assert.equal(JSON.parse(await page.locator('#draft').inputValue()).steps[10].needs.length, 3);
   await page.locator('#tuning details', {hasText: 'Client handover'}).locator('button', {hasText: 'Remove need'}).last().click(); assert.equal(JSON.parse(await page.locator('#draft').inputValue()).steps[10].needs.length, 2);
   await page.locator('#tune-backlog-5').uncheck(); assert.equal(JSON.parse(await page.locator('#draft').inputValue()).steps[5].backlog, undefined);
   assert.deepEqual((await query(page)).definition, before.definition); await page.locator('#restore-draft').click(); await page.locator('#show-events').click();
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
   await page.locator('#show-definition').click(); const before = await query(page);
   await page.locator('#draft').fill('{bad'); await page.locator('#apply').click(); assert.deepEqual((await query(page)).snapshot, before.snapshot);
   const d = before.definition; d.name = 'Reviewed agency process';
   await page.locator('#draft').fill(JSON.stringify(d)); await page.locator('#validate').click(); assert.match(await page.locator('#diagnostics').innerText(), /Valid definition/);
   await page.locator('#apply').click(); const next = await query(page); assert.equal(next.snapshot.minute, 0); assert.equal(next.definition.revision, before.definition.revision + 1); assert.equal(next.playing, false);
   await page.locator('#show-events').click();
  });
  await check('Unapplied drafts export losslessly without changing the active process or retaining stale validation', async () => {
   await page.locator('#show-definition').click(); const before = await query(page);
   await page.locator('#validate').click(); assert.match(await page.locator('#diagnostics').innerText(), /Valid definition/);
   const raw = '{\n  "unfinished":'; await page.locator('#draft').fill(raw);
   assert.equal(await page.locator('#diagnostics').innerText(), '');
   assert.match(await page.locator('#draft-state').innerText(), /Unapplied draft/);
   await page.locator('#validate').click(); assert.equal(await page.locator('#draft').getAttribute('aria-invalid'), 'true');
   let pending = page.waitForEvent('download'); await page.locator('#export-draft').click(); let saved = await pending;
   const draftFile = path.join(dir, 'unfinished.json'); await saved.saveAs(draftFile); assert.equal(fs.readFileSync(draftFile, 'utf8'), raw);
   pending = page.waitForEvent('download'); await page.locator('#json').click(); saved = await pending;
   const activeFile = path.join(dir, 'active.json'); await saved.saveAs(activeFile); assert.deepEqual(JSON.parse(fs.readFileSync(activeFile, 'utf8')), before.definition);
   assert.deepEqual(await query(page), before);
   await page.locator('#show-events').click(); await page.locator('#show-definition').click(); assert.equal(await page.locator('#draft').inputValue(), raw);
   await page.locator('#restore-draft').click(); assert.equal(await page.locator('#draft').getAttribute('aria-invalid'), null);
   assert.match(await page.locator('#draft-state').innerText(), /matches the active definition/); await page.locator('#show-events').click();
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
   await page.locator('#show-definition').click(); const d = JSON.parse(await page.locator('#draft').inputValue()) as LWProcess.Definition; change(d);
   await page.locator('#draft').fill(JSON.stringify(d)); await page.locator('#apply').click(); await page.locator('#show-events').click();
  };
  await check('Process switch lists each process of a multi-process game, switches without ticking and stays hidden for one process', async () => {
   await openArtifact(page, file, {url: fixtureUrls[0]!}); await waitForReady(page, {host: 'process'});
   const first = await query(page); assert.equal(first.active, 0); assert.equal(first.processes.length, 2);
   assert.equal(await page.locator('#process-switch-label').isVisible(), true); assert.match(await page.locator('#process-switch-label').innerText(), /^Process/);
   assert.equal(await page.evaluate(() => (document.getElementById('process-switch') as HTMLSelectElement).labels![0]!.id), 'process-switch-label');
   assert.equal(await page.locator('#process-switch option').count(), 2); assert.equal(await page.locator('#process-switch').inputValue(), '0');
   assert.deepEqual(await page.locator('#process-switch option').allInnerTexts(), first.processes.map(p => p.name));
   assert.match(await page.locator('#process-subtitle').innerText(), /Process 1 of 2/);
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
   assert.equal(await page.locator('#map svg').count(), 1); assert.match(await page.locator('#process-subtitle').innerText(), /Process 2 of 2/);
   assert.match(await page.locator('#process-data').innerText(), /Process inputs/);
   // A one-process game has no switch.
   const single = path.join(dir, 'single', 'agency-delivery'), singleHtml = path.join(dir, 'single.html'), source = path.resolve(PROJECT, '../../docs/concepts/agency-delivery');
   fs.cpSync(source, single, {recursive: true}); fs.rmSync(path.join(single, 'content/agile-vendor.process.json'));
   const manifest = JSON.parse(fs.readFileSync(path.join(single, 'game.json'), 'utf8')); manifest.content = {definition: 'content/agency.process.json'}; fs.writeFileSync(path.join(single, 'game.json'), JSON.stringify(manifest, null, 2) + '\n');
   const made = spawnSync(process.execPath, [cli, 'build-game', '--game', single, '--output', singleHtml], {encoding: 'utf8', timeout: 300000}); assert.equal(made.status, 0, made.stderr + made.stdout);
   const other = await context.newPage(); await openArtifact(other, singleHtml, {url: fixtureUrls[4]!}); await waitForReady(other, {host: 'process'});
   assert.equal(await other.locator('#process-switch-label').isVisible(), false); assert.equal(await other.locator('#process-subtitle').innerText(), 'Wildlands · Process Studio');
   assert.equal((await query(other)).processes.length, 1); await other.close();
  });
  await check('Editing one process survives switching away and back with its applied definition and unapplied draft', async () => {
   await openArtifact(page, file, {url: fixtureUrls[0]!}); await waitForReady(page, {host: 'process'});
   const original = [await nameOf(0), await nameOf(1)], before = await query(page);
   await applyDraft(d => {d.name = 'Edited agency';}); assert.equal((await query(page)).definition.revision, before.definition.revision + 1);
   await page.locator('#show-definition').click(); const raw = '{\n  "unfinished":'; await page.locator('#draft').fill(raw);
   await switchTo(1); assert.equal(await page.locator('#process-title').innerText(), original[1]); assert.match(await page.locator('#draft-state').innerText(), /matches the active definition/);
   assert.equal(await page.locator('#process-switch option').first().innerText(), 'Edited agency'); assert.equal(await nameOf(0), 'Edited agency'); assert.equal((await query(page)).snapshot.minute, 0);
   // Import replaces only the active process, in place.
   const vendor = (await query(page)).definition; vendor.name = 'Imported vendor';
   await page.locator('#file').setInputFiles({name: 'vendor.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(vendor))});
   await page.waitForFunction(() => document.getElementById('message')!.textContent!.includes('Imported vendor.json'));
   assert.deepEqual(await page.locator('#process-switch option').allInnerTexts(), ['Edited agency', 'Imported vendor']); assert.equal((await query(page)).active, 1);
   await switchTo(0); assert.equal(await page.locator('#process-title').innerText(), 'Edited agency'); assert.equal((await query(page)).definition.revision, before.definition.revision + 1);
   assert.equal(await page.locator('#draft').inputValue(), raw); assert.match(await page.locator('#draft-state').innerText(), /Unapplied draft/);
   assert.equal((await query(page)).snapshot.minute, 0); assert.equal((await query(page)).playing, false);
   await page.locator('#show-events').click();
  });
  await check('Downloaded HTML of a multi-process game reopens with every process in order and the applied edits', async () => {
   await openArtifact(page, file, {url: fixtureUrls[0]!}); await waitForReady(page, {host: 'process'});
   const names = [await nameOf(0), await nameOf(1)]; await switchTo(1); await applyDraft(d => {d.name = 'Edited vendor';});
   const pending = page.waitForEvent('download'); await page.locator('#html').click(); const download = await pending, exported = path.join(dir, 'multi-exported.html'); await download.saveAs(exported);
   const text = fs.readFileSync(exported, 'utf8'); assert.equal(download.suggestedFilename(), 'wildlands-processes.html');
   assert.equal((text.match(/^window\.LWProcessDefinition = /gm) ?? []).length, 1); assert.equal((text.match(/^window\.LWProcessDefinitions = /gm) ?? []).length, 1);
   const other = await context.newPage(); await openArtifact(other, exported, {url: fixtureUrls[3]!}); await waitForReady(other, {host: 'process'});
   const reopened = await query(other); assert.deepEqual(reopened.processes.map(p => p.name), [names[0], 'Edited vendor']); assert.equal(reopened.active, 0); assert.equal(reopened.snapshot.minute, 0);
   assert.equal(reopened.definition.name, names[0]); assert.equal(await other.locator('#process-switch option').count(), 2);
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
   await page.locator('#show-definition').click(); await page.locator('[data-step="wait"]').click();
   await page.locator('#tuning summary', {hasText: 'Wait for review window'}).click(); assert.equal(await page.locator('#tune-step-dur-2').inputValue(), '30');
   assert.equal(await page.locator('#tune-step-add-2-0').inputValue(), '1'); assert.equal(await page.locator('#tune-step-cost-2').count(), 0);
   await page.locator('#show-events').click();
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
