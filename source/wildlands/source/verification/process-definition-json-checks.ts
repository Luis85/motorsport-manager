/// <reference path="../process-contracts.d.ts" />
/**
 * Companion of process-definition-browser.ts (the suite over its size budget once reflowed): the Definition editor's raw JSON pane,
 * with syntax errors by line and column, every catalog diagnostic as a link to its text, Format, the diff summary, the gutter and
 * Copy with its clipboard fallback. Registered under the `process-definition-browser` suite; the suite entry calls `rawJsonChecks`
 * right after `arrivalChecks`, so the check order is unchanged.
 */
import assert from 'node:assert/strict';
import {query, type Studio} from './process-browser-fixture';

/** Raw JSON line and column errors, the diagnostics list with jumps to the offending text, Format, gutter and Copy. */
export async function rawJsonChecks(studio: Studio): Promise<void> {
 const {page, check, freshStudio, openDef, closeDef, restoreDef, draftText, inSync, pasteDraft} = studio;
 await check('Definition editor raw JSON reports line and column, lists every diagnostic and jumps to the offending text', async () => {
  await page.setViewportSize({width: 1440, height: 1060});
  await freshStudio();
  await openDef();
  const area = page.locator('#draft'),
   selection = () =>
    page.evaluate(() => {
     const a = document.getElementById('draft') as HTMLTextAreaElement;
     return {text: a.value.slice(a.selectionStart, a.selectionEnd), start: a.selectionStart, active: document.activeElement?.id};
    });
  await area.fill('{\n  "a": 1,\n  "b": [1 2]\n}');
  assert.equal(await page.locator('#draft-state').innerText(), `Invalid JSON: line 3, column 11 · Expected ',' or ']' after the value`);
  assert.equal(await page.locator('#de-gutter .bad').innerText(), '3');
  assert.equal(await page.locator('#de-format').isDisabled(), true);
  assert.equal(await area.getAttribute('aria-invalid'), 'true');
  await page.waitForFunction(() => document.getElementById('de-sync')!.textContent === 'Fix the JSON to use the form');
  assert.equal(await page.locator('#tune-name').isDisabled(), true, 'the form is disabled while the JSON is invalid');
  await page.locator('#diagnostics button').click();
  const syntax = await selection();
  assert.equal(syntax.active, 'draft');
  assert.equal(syntax.start, '{\n  "a": 1,\n  "b": [1 '.length);
  assert.equal(syntax.text, '2');
  // Every diagnostic the catalog returns is listed, labelled with the step name, and selects its text.
  const base = JSON.parse(JSON.stringify((await query(page)).definition)) as LWProcess.Definition;
  base.steps[1]!.duration = 0;
  base.resources[0]!.capacity = 0;
  delete (base.steps[2] as Partial<LWProcess.Step>).scene;
  await pasteDraft(JSON.stringify(base, null, 2)); await inSync();
  const expected = await page.evaluate(
   text => (globalThis as unknown as {LWProcessCatalog: LWProcess.Catalog}).LWProcessCatalog.validate(JSON.parse(text), true).diagnostics.map(d => d.path),
   await draftText()
  );
  assert(expected.length >= 3, JSON.stringify(expected));
  assert.equal(await page.locator('#diagnostics button').count(), expected.length);
  assert.equal(await page.locator('#de-diag-h').innerText(), `Problems (${expected.length})`);
  assert.deepEqual(await page.locator('#diagnostics button').evaluateAll(b => b.map(x => (x as HTMLElement).dataset.path)), expected);
  assert.match(await page.locator('#de-diag-note').innerText(), /Structure problems come first/);
  const entry = (path: string) => page.locator(`#diagnostics button[data-path="${path}"]`);
  assert.match(await entry('/steps/1/duration').innerText(), /^Discovery › duration\n/);
  await entry('/steps/1/duration').click();
  const dur = await selection();
  assert.match(dur.text, /^"duration": 0$/);
  assert.equal(dur.active, 'draft');
  await entry('/resources/0/capacity').click();
  assert.match((await selection()).text, /^"capacity": 0$/);
  assert.match(await entry('/resources/0/capacity').innerText(), /^Resource .* › capacity/);
  await entry('/steps/2').click();
  const block = await selection();
  assert.equal(block.text, '{', 'a missing field selects the start of its block');
  assert.match(await entry('/steps/2').innerText(), /Missing field: scene/);
  // With the structure repaired the relationship checks run and are listed too.
  const graph = JSON.parse(JSON.stringify((await query(page)).definition)) as LWProcess.Definition;
  graph.flows[0]!.to = 'nowhere';
  graph.steps[1]!.resources = {ghost: 1};
  await area.fill(JSON.stringify(graph));
  await inSync();
  const expectedGraph = await page.evaluate(
   text => (globalThis as unknown as {LWProcessCatalog: LWProcess.Catalog}).LWProcessCatalog.validate(JSON.parse(text), true).diagnostics.length,
   await draftText()
  );
  assert(expectedGraph >= 2);
  assert.equal(await page.locator('#diagnostics button').count(), expectedGraph);
  assert.doesNotMatch(await page.locator('#de-diag-note').innerText(), /Structure problems come first/);
  // Format, the diff summary and the gutter.
  await page.locator('#de-format').click();
  assert.equal(await draftText(), JSON.stringify(JSON.parse(await draftText()), null, 2));
  assert.equal(await page.locator('#de-diff').isVisible(), true);
  assert.match(await page.locator('#draft-state').innerText(), /^Unapplied draft: .*changed/);
  await page.locator('#de-diff summary').click();
  assert.match(await page.locator('#de-diff-list').innerText(), /changed/);
  const gutter = await page.evaluate(
   () =>
    new Promise<{lines: number; numbers: number; top: number; areaTop: number}>(resolve => {
     const a = document.getElementById('draft') as HTMLTextAreaElement, g = document.getElementById('de-gutter')!;
     a.scrollTop = 600;
     requestAnimationFrame(() =>
      requestAnimationFrame(() =>
       resolve({lines: a.value.split('\n').length, numbers: g.textContent!.split('\n').length, top: g.scrollTop, areaTop: a.scrollTop})
      )
     );
    })
  );
  assert.equal(gutter.lines, gutter.numbers); assert.equal(gutter.top, gutter.areaTop); assert(gutter.areaTop > 0);
  // Copy uses the clipboard and falls back to selecting everything.
  await page.evaluate(() => {
   (globalThis as any).copied = null;
   Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
     writeText: (t: string) => {
      (globalThis as any).copied = t;
      return Promise.resolve();
     }
    }
   });
  });
  await page.locator('#de-copy').click();
  assert.match(await page.locator('#de-copy-note').innerText(), /Copied/);
  assert.equal(await page.evaluate(() => (globalThis as any).copied === (document.getElementById('draft') as HTMLTextAreaElement).value), true);
  await page.evaluate(() =>
   Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: () => Promise.reject(new Error('blocked'))}})
  );
  await page.locator('#de-copy').click();
  assert.match(await page.locator('#de-copy-note').innerText(), /selected.*Ctrl\+C/);
  const all = await selection();
  assert.equal(all.text, await draftText());
  const box = (await area.boundingBox())!, wide = await page.evaluate(() => getComputedStyle(document.getElementById('draft')!));
  assert(box.height >= 320);
  assert.match(wide.fontFamily, /mono/i);
  assert.equal(await area.getAttribute('wrap'), 'off');
  await restoreDef(); await closeDef();
 });
}
