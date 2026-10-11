/// <reference path="../process-contracts.d.ts" />
/**
 * Shared helpers of the process-hostile-browser and process-hostile-editors-browser suites (ENG-16): the probed studio page, the
 * hostile import, the clean-page assertion, the probe's positive control and the detached-run comparison that proves a view never
 * ticked. Checks live in the companion modules `process-hostile-views-checks.ts` and `process-hostile-dialog-checks.ts` (views)
 * and `process-hostile-editor-checks.ts` and `process-hostile-io-checks.ts` (editors and files).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type {Page} from 'playwright';
import {waitForReady} from './browser-harness';
import {query, type Studio} from './process-browser-fixture';
import {hostileDefinition} from './process-hostile-models';
import {CLEAN, probeSource, readProbe, serveWithPolicy} from './process-hostile-probe';

export type Kit = Awaited<ReturnType<typeof hostileKit>>;

/** Text as the HTML parser keeps it: a carriage return (alone or before a line feed) becomes a line feed. */
export const norm = (text: string): string => text.replace(/\r\n?/g, '\n');
/** Escapes text for a RegExp. */
export const literal = (text: string): RegExp => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

/** Builds the kit on the suite's studio: every page of the context is probed and the studio is served with the policy. */
export async function hostileKit(studio: Studio) {
 const {page, context, file, fixtureUrls} = studio;
 await context.addInitScript({content: probeSource()});
 await serveWithPolicy(page, fixtureUrls[0]!, fs.readFileSync(file, 'utf8'));
 const process = hostileDefinition('process');
 const journey = hostileDefinition('customer-journey', 'hostile-journey', 'JOURNEY');
 /** Asserts that nothing hostile ran, was reported by the policy, threw or became an element on `on` since it loaded. */
 const clean = async (where: string, on: Page = page) => {
  const facts = await readProbe(on);
  assert.deepEqual(facts, CLEAN, where + ': ' + JSON.stringify(facts));
 };
 /** The live run as JSON: equal before and after a visit means the visit never ticked or changed it. */
 const live = async (on: Page = page) => JSON.stringify((await query(on)).snapshot);
 /** Imports `definition` through the studio's Import… file input into a fresh studio and waits for the import message. */
 const importDefinition = async (definition: LWProcess.Definition, name = definition.id + '.json') => {
  await studio.freshStudio();
  await page.locator('#file').setInputFiles({name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(definition))});
  await page.waitForFunction(n => document.getElementById('message')!.textContent!.startsWith('Imported ' + n), name);
  assert.equal((await query(page)).definition.name, definition.name, 'the imported definition is the hostile one');
 };
 /** Runs the active process to its end with the explicit clock command (a run length of 1,440 minutes). */
 const runToEnd = async () => {
  await page.locator('#horizon').selectOption('1440');
  await page.locator('#run-end').click();
  await page.waitForFunction(() => (globalThis as any).LWProcessStudio.query().snapshot.status !== 'ready');
 };
 /** Selects step `id` from the step list and waits for the selection. */
 const select = async (id: string) => {
  await page.locator(`#steps [data-step="${id}"]`).click();
  await page.waitForFunction(s => (globalThis as any).LWProcessStudio.query().selected === s, id);
 };
 /** Reloads the studio page and waits for it to be ready (the probe and policy apply again). */
 const ready = (on: Page) => waitForReady(on, {host: 'process'});
 /**
  * The probe's positive control: markup the test itself inserts (`<img onerror>` on an empty data URL, so no request) is seen
  * running, reported by the policy (as an info line, not a console error), recorded as an image element and as an error event,
  * so a clean result elsewhere means nothing ran. The studio is then reloaded with a fresh probe.
  */
 const selfTest = async () => {
  await studio.freshStudio();
  await clean('a fresh studio');
  await page.evaluate(() => {
   const holder = document.createElement('div');
   holder.id = 'probe-control';
   document.body.append(holder);
   holder.innerHTML = '<img src="data:," onerror="__hit(99)">';
  });
  await page.waitForFunction(() => (globalThis as any).__probe.hits.includes(99) && (globalThis as any).__probe.csp.length > 0);
  const facts = await readProbe(page);
  assert.deepEqual([facts.hits, facts.errors, facts.scanned], [[99], ['error'], ['<img>']]);
  assert(facts.nodes.includes('<img>'), 'the observer recorded the image');
  assert.match(facts.csp.join('\n'), /^script-src-attr inline/, 'the report-only policy reports the inline handler');
  await studio.freshStudio();
  await clean('the reloaded studio');
 };
 return {process, journey, clean, live, importDefinition, runToEnd, select, ready, selfTest};
}
