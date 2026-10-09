/// <reference path="../process-contracts.d.ts" />
/** Process Studio shell: start, 2D/3D navigation, time controls, imports, exports, downloads and the process switch. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {waitForReady, openArtifact, nextFrames} from './browser-harness';
import {query, runSuite} from './process-browser-fixture';
import {randomLine, feedFixture} from './process-browser-models';
runSuite('process browser harness', 'process-browser-results.json', async studio => {
 const {page, context, diagnostics, dir, file, cli, gameDir, gameDefinitions, COUNT, fixtureUrls, check, checkLifecycle, freshStudio, defOpen, openDef, closeDef, restoreDef, applyDef, exportVia, showIo, switchTo, nameOf, allNames, applyDraft, importJson} = studio;
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
  await page.locator('#file').setInputFiles(bpmnFile); await page.locator('#bi-import').click(); await page.waitForFunction(() => document.getElementById('message')!.textContent!.includes('Imported export.bpmn'));
  assert.deepEqual((await query(page)).definition, before.definition); assert.equal((await query(page)).snapshot.minute, 0);
  const model = 'xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"';
  const foreign = `<bpmn:definitions ${model}><bpmn:process id="P" name="Small"><bpmn:startEvent id="S"><bpmn:outgoing>A</bpmn:outgoing></bpmn:startEvent><bpmn:task id="T" name="Work"><bpmn:incoming>A</bpmn:incoming><bpmn:outgoing>B</bpmn:outgoing></bpmn:task><bpmn:endEvent id="E"/><bpmn:sequenceFlow id="A" sourceRef="S" targetRef="T"/><bpmn:sequenceFlow id="B" sourceRef="T" targetRef="E"/></bpmn:process></bpmn:definitions>`;
  await page.locator('#file').setInputFiles({name: 'small.bpmn', mimeType: 'application/xml', buffer: Buffer.from(foreign)}); await page.locator('#bi-import').click();
  await page.waitForFunction(() => document.getElementById('message')!.textContent!.includes('Imported small.bpmn')); assert.match(await page.locator('#message').innerText(), /import note/);
  assert.equal((await query(page)).definition.name, 'Small'); assert.equal((await query(page)).definition.steps.length, 3);
  const kept = await query(page);
  await page.locator('#file').setInputFiles({name: 'nested.bpmn', mimeType: 'application/xml', buffer: Buffer.from(foreign.replace('<bpmn:endEvent', '<bpmn:subProcess id="X"/><bpmn:endEvent'))});
  await page.locator('dialog.bi-dialog[open]').waitFor(); await page.waitForFunction(() => document.getElementById('bi-preview')!.getAttribute('data-state') !== 'pending');
  assert.match(await page.locator('#bi-preview .bi-bad').innerText(), /subProcess X/); assert.equal(await page.locator('#bi-import').isDisabled(), true); await page.locator('#bi-cancel').click(); assert.deepEqual(await query(page), kept);
  await page.locator('#file').setInputFiles(bpmnFile); await page.locator('#bi-import').click(); await page.waitForFunction(() => document.getElementById('process-title')!.textContent === 'Agency delivery lab');
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
 await checkLifecycle('Process browser lifecycle emits no runtime errors or network requests');
});
