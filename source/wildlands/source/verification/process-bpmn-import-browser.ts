/// <reference path="../process-contracts.d.ts" />
/** Offline acceptance for the studio's BPMN import dialog and the BPSim export: inspect, options, preview, import parity, cancel and phone fit. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {launchBrowser, monitorContext, waitForReady, openArtifact, nextFrames} from './browser-harness';
import type {Page} from 'playwright';
const PROJECT = path.resolve(__dirname, '../..'), OUT = path.join(PROJECT, 'verification/v15'), EXAMPLES = path.join(PROJECT, 'examples/bpmn');
const SUITE = 'process-bpmn-import-browser';
const results: {name: string; passed: boolean; error?: string}[] = [];
async function check(name: string, work: () => Promise<void>): Promise<void> {try {await work(); results.push({name, passed: true});} catch (e) {results.push({name, passed: false, error: String(e)});}}
type Options = Record<string, string | number | boolean>;
/** The options the dialog starts with for the two examples: the API defaults plus the picked process and scenario. */
const DEFAULTS = {lanes: 'pools', unsupported: 'reject', bpsim: true, autoSystemPool: true, defaultCapacity: 1, systemCapacity: 4, minutesPerDay: 480, defaultDuration: 5};
const example = (name: string) => fs.readFileSync(path.join(EXAMPLES, name), 'utf8');
/** Fingerprint and counts of `LWProcessBpmn.import(xml, options)` computed in the page itself, outside the dialog. */
function expected(page: Page, xml: string, options: Options): Promise<{fingerprint: string; warnings: number; mapping: number; horizon: number | null; rejections: string[]}> {
 return page.evaluate(([x, o]) => {
  const w = globalThis as unknown as {LWProcessBpmn: LWProcessBpmn.Api; LWProcessCatalog: LWProcess.Catalog};
  const a = w.LWProcessBpmn.analyze(x, o as LWProcessBpmn.Options);
  return {fingerprint: a.definition ? w.LWProcessCatalog.fingerprint(w.LWProcessBpmn.import(x, o as LWProcessBpmn.Options).definition!) : '', warnings: a.warnings.length, mapping: a.mapping.length, horizon: a.info.horizon, rejections: a.rejections.map(r => r.id)};
 }, [xml, options] as const);
}
function active(page: Page): Promise<{fingerprint: string; minute: number; playing: boolean; name: string}> {
 return page.evaluate(() => {
  const w = globalThis as unknown as {LWProcessStudio: {query(): LWProcessApp.View}; LWProcessCatalog: LWProcess.Catalog}, q = w.LWProcessStudio.query();
  return {fingerprint: w.LWProcessCatalog.fingerprint(q.definition), minute: q.snapshot.minute, playing: q.playing, name: q.definition.name};
 });
}
async function main(): Promise<void> {
 fs.mkdirSync(OUT, {recursive: true}); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'process-bpmn-import-browser-'));
 const file = path.join(dir, 'process.html'), cli = path.join(PROJECT, '.generated/tools/wildlands-cli.cjs');
 const built = spawnSync(process.execPath, [cli, 'build-game', '--game', path.resolve(PROJECT, '../../docs/concepts/agency-delivery'), '--output', file], {encoding: 'utf8', timeout: 300000});
 assert.equal(built.status, 0, built.stderr + built.stdout);
 const url = 'https://localhost/process-bpmn-import';
 const browser = await launchBrowser(), context = await browser.newContext({viewport: {width: 1440, height: 900}}), diagnostics = monitorContext(context, {fixtureUrls: [url]}), page = await context.newPage();
 page.setDefaultTimeout(15000);
 try {
  const fresh = async () => { await openArtifact(page, file, {url}); await waitForReady(page, {host: 'process'}); };
  const dlg = page.locator('dialog.bi-dialog[open]');
  const activeId = () => page.evaluate(() => document.activeElement?.id ?? '');
  /** The preview is recomputed by a short UI debounce; wait for its explicit state instead of a duration. */
  const settled = () => page.waitForFunction(() => { const v = document.getElementById('bi-preview'); return !!v && v.dataset.state !== 'pending'; });
  const used = async () => JSON.parse(await page.locator('#bi-preview').getAttribute('data-options') || 'null') as Options | null;
  const pick = async (name: string, buffer?: string) => {
   await page.locator('#file').setInputFiles(buffer === undefined ? path.join(EXAMPLES, name) : {name, mimeType: 'application/xml', buffer: Buffer.from(buffer)});
   await dlg.waitFor(); await settled();
  };
  const viaButton = async (opener: string, item: string | null, source: string) => {
   const chooser = page.waitForEvent('filechooser'); await page.locator(opener).click(); if (item) await page.locator(item).click();
   await (await chooser).setFiles(source); await dlg.waitFor(); await settled();
  };
  const importAndWait = async (name: string) => { await page.locator('#bi-import').click(); await dlg.waitFor({state: 'hidden'}); await page.waitForFunction(n => document.getElementById('message')!.textContent!.startsWith('Imported ' + n + '. New run is paused.'), name); };
  const groupCounts = () => page.locator('#bi-preview details.bi-group > summary').allInnerTexts();

  await check('BPMN import dialog: loan-application.bpmn inspect, preview and import give the LWProcessBpmn.import fingerprint as a paused run at minute 0', async () => {
   await fresh(); await page.locator('#advance').click(); assert.equal((await active(page)).minute, 30);
   const xml = example('loan-application.bpmn'); await pick('loan-application.bpmn');
   assert.equal(await activeId(), 'bi-process', 'focus starts on the Process picker');
   assert.deepEqual(await page.locator('#bi-process option').allInnerTexts(), ['Loan application (Process_Loan)', 'Fraud screening (Process_Fraud) · not executable']);
   assert.deepEqual(await page.locator('#bi-scenario option').allInnerTexts(), ['Base case (illustrative) (Scenario_Base)']); assert.equal(await page.locator('#bi-scenario').isEnabled(), true);
   const contents = await page.locator('#bi-contents').innerText();
   for (const text of ['Customer', 'Bank clerk', 'Credit engine', 'user task: 7', 'service task: 4', 'call activity: 1']) assert.match(contents, new RegExp(text), text);
   const options = {...DEFAULTS, process: 'Process_Loan', scenario: 'Scenario_Base'}; assert.deepEqual(await used(), options);
   const want = await expected(page, xml, options), preview = await page.locator('#bi-preview').innerText();
   assert.match(preview, /Ready to import\./); assert.match(preview, /Runnable \(ok\)\s*Yes/); assert.match(preview, /Acceptable as a draft\s*Yes/); assert.match(preview, /Suggested run length\s*960 minutes/);
   assert.equal(want.horizon, 960); assert.equal(await page.locator('#bi-preview .bi-warn li').count(), want.warnings);
   const groups = await groupCounts(); assert.deepEqual(groups.map(g => g.replace(/ \(\d+\)$/, '')), ['Steps', 'Flows', 'Resource pools', 'Case fields', 'Arrivals', 'SIPOC suppliers and customers', 'Folded, inlined or ignored']);
   assert.equal(groups.reduce((n, g) => n + Number(/\((\d+)\)$/.exec(g)![1]), 0), want.mapping, 'every mapping entry is listed once');
   await page.locator('#bi-preview details[data-group="step"] > summary').click(); assert.match(await page.locator('#bi-preview details[data-group="step"] table').innerText(), /Task_Review/);
   // Replacing a run past minute 0 asks first, starting on Cancel; Escape keeps everything.
   await page.locator('#bi-import').click(); await page.locator('#bi-confirm').waitFor();
   assert.equal(await activeId(), 'bi-keep'); assert.match(await page.locator('#bi-confirm-title').innerText(), /discards minute 30 of the current run/);
   await page.keyboard.press('Escape'); assert.equal(await page.locator('#bi-confirm').isHidden(), true); assert.equal(await dlg.count(), 1); assert.equal((await active(page)).minute, 30);
   await page.locator('#bi-import').click(); await page.locator('#bi-replace').click(); await dlg.waitFor({state: 'hidden'});
   const now = await active(page); assert.deepEqual([now.fingerprint, now.minute, now.playing, now.name], [want.fingerprint, 0, false, 'Loan application']);
   assert.match(await page.locator('#message').innerText(), /^Imported loan-application\.bpmn\. New run is paused\. \d+ import note/); assert.equal(await activeId(), 'import', 'focus returns to Import…');
  });
  await check('BPMN import dialog: support-ticket.bpmn imports with changed options to the LWProcessBpmn.import fingerprint as a paused run at minute 0', async () => {
   await fresh(); const xml = example('support-ticket.bpmn'); await pick('support-ticket.bpmn');
   assert.deepEqual(await page.locator('#bi-process option').allInnerTexts(), ['Support ticket (Process_Ticket)']); assert.match(await page.locator('#bi-contents').innerText(), /Support agent[\s\S]*Specialist[\s\S]*Automation/);
   assert.match(await page.locator('#bi-preview').innerText(), /Suggested run length\s*None in the file/);
   await page.locator('#bi-capacity').fill('2'); await settled(); await page.locator('#bi-day').fill('600'); await settled(); await page.locator('#bi-auto').uncheck(); await settled();
   const options = {...DEFAULTS, process: 'Process_Ticket', scenario: 'Scenario_Base', defaultCapacity: 2, minutesPerDay: 600, autoSystemPool: false}; assert.deepEqual(await used(), options);
   const want = await expected(page, xml, options), plain = await expected(page, xml, {}); assert.notEqual(want.fingerprint, plain.fingerprint, 'the options reach the import');
   assert.equal(await page.locator('#bi-preview .bi-warn li').count(), want.warnings);
   await importAndWait('support-ticket.bpmn'); assert.equal(await page.locator('#bi-confirm').isHidden(), true, 'a fresh run with no draft needs no confirmation');
   const now = await active(page); assert.deepEqual([now.fingerprint, now.minute, now.playing], [want.fingerprint, 0, false]);
  });
  await check('BPMN import dialog: the loan file without BPSim is rejected with Import disabled and a reason, and Drop makes it importable', async () => {
   await fresh(); const before = await active(page), xml = example('loan-application.bpmn'); await pick('loan-application.bpmn');
   await page.locator('#bi-bpsim').uncheck(); await settled();
   assert.equal(await page.locator('#bi-scenario').isDisabled(), true); assert.match(await page.locator('#bi-scenario-help').innerText(), /Turn on “Use BPSim simulation parameters”/);
   const rejected = {...DEFAULTS, process: 'Process_Loan', bpsim: false}; assert.deepEqual(await used(), rejected);
   const want = await expected(page, xml, rejected); assert.deepEqual(want.rejections, ['Gw_Risk', 'Gw_Review']);
   const bad = await page.locator('#bi-preview .bi-bad li').allInnerTexts(); assert.equal(bad.length, 2); assert.match(bad[0]!, /^Gw_Risk exclusiveGateway .*mark one as the default flow/); assert.match(bad[1]!, /^Gw_Review /);
   assert.match(await page.locator('#bi-preview .bi-verdict').innerText(), /Cannot import: 2 rejections\./); assert.equal(await page.locator('#bi-import').isDisabled(), true);
   assert.equal(await page.locator('#bi-reason').innerText(), 'Import is unavailable: the preview lists 2 rejections. Choose “Drop them with a warning” under Unsupported constructs, or fix the model.');
   assert.equal(await page.locator('#bi-import').getAttribute('aria-describedby'), 'bi-reason');
   await page.locator('#bi-unsupported').selectOption('drop'); await settled();
   const dropped = {...rejected, unsupported: 'drop'}; assert.deepEqual(await used(), dropped); const wantDrop = await expected(page, xml, dropped); assert.deepEqual(wantDrop.rejections, []);
   assert.equal(await page.locator('#bi-import').isEnabled(), true); assert.equal(await page.locator('#bi-reason').innerText(), ''); assert.match(await page.locator('#bi-preview .bi-verdict').innerText(), /Ready to import\./);
   assert.match(await page.locator('#bi-preview .bi-warn').innerText(), /Gateway Gw_Risk has unconditioned flows; they share equal chances in drop mode\./); assert.equal((await active(page)).fingerprint, before.fingerprint, 'nothing changes before Import');
   await importAndWait('loan-application.bpmn'); const now = await active(page); assert.deepEqual([now.fingerprint, now.minute, now.playing], [wantDrop.fingerprint, 0, false]);
  });
  await check('BPMN import dialog validates each option inline with LWProcessBpmn.options and names why Import is disabled', async () => {
   await fresh(); await pick('support-ticket.bpmn'); const field = page.locator('#bi-capacity');
   const message = await page.evaluate(() => { try { (globalThis as unknown as {LWProcessBpmn: LWProcessBpmn.Api}).LWProcessBpmn.options({defaultCapacity: 0}); return ''; } catch (e) { return (e as Error).message; } });
   assert.equal(message, 'Option defaultCapacity must be a whole number from 1 to 1000.');
   for (const value of ['0', '2.5', '', '1001']) {
    await field.fill(value); await settled();
    assert.equal(await field.getAttribute('aria-invalid'), 'true', value); assert.equal(await page.locator('#bi-capacity-err').innerText(), 'People per lane pool must be a whole number from 1 to 1000.');
    assert.equal(await page.locator('#bi-import').isDisabled(), true); assert.equal(await page.locator('#bi-reason').innerText(), 'Import is unavailable until every option is valid. Fix: People per lane pool.');
    assert.match(await page.locator('#bi-preview').innerText(), /No preview\./); assert.equal(await page.locator('#bi-preview').getAttribute('data-state'), 'invalid');
   }
   assert.match(await field.getAttribute('aria-describedby') ?? '', /bi-capacity-err/);
   await page.locator('#bi-day').fill('0'); await settled(); assert.equal(await page.locator('#bi-reason').innerText(), 'Import is unavailable until every option is valid. Fix: People per lane pool, Business minutes per day.');
   await field.fill('3'); await page.locator('#bi-day').fill('480'); await settled();
   assert.equal(await field.getAttribute('aria-invalid'), null); assert.equal(await page.locator('#bi-capacity-err').isHidden(), true); assert.equal(await page.locator('#bi-import').isEnabled(), true);
   await page.locator('#bi-cancel').click(); await dlg.waitFor({state: 'hidden'});
  });
  await check('BPMN import dialog: Escape, Cancel and Close keep the active process and run and restore focus to the invoker', async () => {
   await fresh(); await page.locator('#advance').click(); const before = await active(page), source = path.join(EXAMPLES, 'loan-application.bpmn');
   for (const how of ['Escape', '#bi-cancel', '#bi-close']) {
    await viaButton('#import', null, source); assert.equal(await activeId(), 'bi-process');
    await page.keyboard.press('Tab'); assert.equal(await activeId(), 'bi-scenario', 'Tab follows the reading order'); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Shift+Tab'); assert.equal(await activeId(), 'bi-close');
    await page.locator('#bi-capacity').fill('7'); await settled();
    if (how === 'Escape') await page.keyboard.press('Escape'); else await page.locator(how).click();
    await dlg.waitFor({state: 'hidden'}); assert.equal(await activeId(), 'import', how + ' returns focus to Import…'); assert.deepEqual(await active(page), before, how + ' changes nothing');
   }
   // A running simulation keeps running: cancelling never pauses, ticks or replaces.
   await page.locator('#play').click(); await viaButton('#import', null, source); await page.locator('#bi-cancel').click(); await dlg.waitFor({state: 'hidden'});
   const after = await active(page); assert.deepEqual([after.fingerprint, after.playing], [before.fingerprint, true]); await page.locator('#play').click();
  });
  await check('Export BPMN with BPSim downloads XML with a BPSim scenario that re-imports through the dialog to the same definition', async () => {
   await fresh(); const before = await active(page);
   await page.locator('#export-menu').click(); const items = await page.locator('#export-items [role=menuitem]:visible').allInnerTexts(); assert.equal(items[items.indexOf('Export BPMN') + 1], 'Export BPMN with BPSim');
   const pending = page.waitForEvent('download'); await page.locator('#bpmn-bpsim').click(); const download = await pending, saved = path.join(dir, 'bpsim.bpmn'); await download.saveAs(saved);
   const id = await page.evaluate(() => (globalThis as unknown as {LWProcessStudio: {definition(): LWProcess.Definition}}).LWProcessStudio.definition().id); assert.equal(download.suggestedFilename(), id + '.bpsim.bpmn');
   const xml = fs.readFileSync(saved, 'utf8'); assert.match(xml, /<bpmn:relationship type="BPSimData">/); assert.match(xml, /<bpsim:Scenario /); assert.match(xml, /xmlns:bpsim="http:\/\/www\.bpsim\.org\/schemas\/1\.0"/);
   assert.match(await page.locator('#message').innerText(), /Exported BPMN 2\.0 XML with a BPSim scenario/);
   await pick('bpsim.bpmn', xml); assert.equal(await page.locator('#bi-scenario').isEnabled(), true); assert.equal(await page.locator('#bi-scenario option').count(), 1);
   assert.doesNotMatch(await page.locator('#bi-preview').innerText(), /BPSim scenario\s*Not used/); const options = await used(); assert.ok(options && options.scenario, 'the scenario is used');
   const want = await expected(page, xml, options!); assert.equal(want.fingerprint, before.fingerprint, 'the BPSim export re-imports to the same fingerprint');
   await importAndWait('bpsim.bpmn'); const now = await active(page); assert.deepEqual([now.fingerprint, now.minute, now.playing], [before.fingerprint, 0, false]);
  });
  await check('BPMN import dialog fits the 390x844 phone sheet without horizontal overflow and keeps every control reachable, also with DejaVu Sans injected', async () => {
   await page.setViewportSize({width: 390, height: 844}); await fresh();
   await viaButton('#more-menu', '#import-item', path.join(EXAMPLES, 'loan-application.bpmn'));
   const box = (await page.locator('dialog.bi-dialog').boundingBox())!; assert.deepEqual([box.x, box.width, box.height], [0, 390, 844], 'a full-screen sheet');
   for (const g of await page.locator('#bi-preview details.bi-group').all()) if (!(await g.evaluate((d: HTMLDetailsElement) => d.open))) await g.locator('summary').click();
   const measure = () => page.evaluate(() => {
    const d = document.querySelector<HTMLDialogElement>('dialog.bi-dialog')!, body = d.querySelector<HTMLElement>('.pd-body')!, W = innerWidth;
    const wide = [...d.querySelectorAll<HTMLElement>('*')].filter(n => { const r = n.getBoundingClientRect(); return r.width > 0 && (r.right > W + .5 || r.left < -.5); }).map(n => n.id || n.className || n.tagName);
    const controls = [...d.querySelectorAll<HTMLElement>('select, input, button, summary')].filter(n => n.getClientRects().length && !n.closest('[hidden]'));
    const unreachable: string[] = [], small: string[] = [];
    for (const n of controls) {
     n.scrollIntoView({block: 'center'}); const r = n.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
     if (!hit || !(n === hit || n.contains(hit) || hit.contains(n) && hit.tagName === 'LABEL')) unreachable.push(n.id || n.textContent!.trim().slice(0, 30));
     const target = n.matches('input[type=checkbox]') ? n.closest('label')! : n; if (target.getBoundingClientRect().height < 43.5) small.push(n.id || n.textContent!.trim().slice(0, 30));
    }
    body.scrollTop = 0;
    return {wide: wide.slice(0, 6), docFits: document.documentElement.scrollWidth <= W, bodyFits: body.scrollWidth <= body.clientWidth, unreachable, small, controls: controls.length};
   });
   for (const font of ['default', 'DejaVu Sans']) {
    if (font !== 'default') { await page.addStyleTag({content: '*{font-family:"DejaVu Sans",sans-serif !important}'}); await nextFrames(page); }
    const m = await measure(); assert.ok(m.controls >= 20, 'controls found: ' + m.controls);
    assert.deepEqual([m.wide, m.docFits, m.bodyFits], [[], true, true], font + ': no horizontal overflow'); assert.deepEqual(m.unreachable, [], font + ': every control can be reached'); assert.deepEqual(m.small, [], font + ': touch targets are 44px');
   }
   const footer = await page.locator('#bi-buttons button').evaluateAll(list => list.map(b => Math.round(b.getBoundingClientRect().width))); assert.ok(footer.every(w => w >= 340), 'footer buttons are full width ' + footer);
   await page.locator('#bi-cancel').click(); await dlg.waitFor({state: 'hidden'}); assert.equal(await activeId(), 'more-menu', 'focus returns to the menu that opened it');
   await page.setViewportSize({width: 1440, height: 900});
  });
  await check('BPMN import browser lifecycle emits no runtime errors or network requests', async () => {
   assert.deepEqual(diagnostics.errors, []); assert.deepEqual(diagnostics.requests, []);
   assert.deepEqual(diagnostics.consoleProblems.filter(x => x.startsWith('error:')), []);
  });
 } finally {await context.close(); await browser.close(); fs.rmSync(dir, {recursive: true, force: true});}
}
main().catch(e => results.push({name: 'process BPMN import browser harness', passed: false, error: String(e)})).finally(() => {
 fs.mkdirSync(OUT, {recursive: true}); const report = {suite: SUITE, passed: results.filter(r => r.passed).length, total: results.length, results};
 fs.writeFileSync(path.join(OUT, 'process-bpmn-import-browser-results.json'), JSON.stringify(report, null, 2)); console.log(`${report.passed}/${report.total}`);
 if (!results.length || report.passed !== report.total) process.exitCode = 1;
});
