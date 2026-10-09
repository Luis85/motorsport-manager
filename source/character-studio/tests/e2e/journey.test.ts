import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, type Page } from 'playwright';

const bin = resolve(import.meta.dirname, '../../../../bin/character-studio');
async function browserPath() {
  if (process.env.CHARACTER_STUDIO_CHROMIUM_PATH) return process.env.CHARACTER_STUDIO_CHROMIUM_PATH;
  try { await access('/usr/bin/chromium'); return '/usr/bin/chromium'; } catch { return undefined; }
}
async function start(project: string) {
  const child = spawn(process.execPath, [bin, 'serve', '--project', project, '--port', '0']);
  const announced = await new Promise<any>((accept, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Server did not start.')), 15000);
    child.stdout.on('data', chunk => {
      output += chunk;
      if (output.includes('\n')) { clearTimeout(timer); accept(JSON.parse(output.split('\n')[0])); }
    });
    child.once('error', reject);
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited ${code}. Output: ${output}`)); });
  });
  return {child, ...announced};
}
const click = (page: Page, action: string) => page.locator(`[data-action="${action}"]`).first().click();
const character = (page: Page) => page.evaluate(() => (window.characterStudio as any).inspect().character);

test('real browser creates, edits, imports, guards conflicts and reflows the companion journey', {timeout:120000}, async () => {
  const project = await mkdtemp(join(tmpdir(), 'character-ui-'));
  const server = await start(project);
  const browser = await chromium.launch({executablePath:await browserPath(), headless:true, args:['--no-sandbox']});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(server.url);
    await page.waitForFunction(() => !!window.characterStudio);
    await click(page, 'new:pip');
    await page.locator('#character-name').fill('Moss');
    await click(page, 'review');
    assert.match(await page.locator('#dialog-title').textContent() || '', /Moss/, 'first click commits a blurred text field and opens Review');
    await page.keyboard.press('Escape');
    const initial = await character(page);
    await click(page, 'chapter:3');
    const skill = await page.evaluate(() => (window.characterStudio as any).catalog().skills[0].id);
    await click(page, `skill:${skill}:1`);
    await click(page, 'chapter:1');
    const numeric = page.locator('[data-range="appearance.headSize"][type="number"]');
    await numeric.focus(); await numeric.press('ArrowUp'); await numeric.press('Tab');
    await click(page, 'mode:portrait');
    assert.equal(await page.locator('[data-action="mode:portrait"]').evaluate(el => el === document.activeElement), true);
    await click(page, 'mode:studio');
    await click(page, 'chapter:2');
    await click(page, 'lock:appearance.coat');
    const beforeRandom = await character(page);
    await click(page, 'randomize'); await click(page, 'randomize-scope:all');
    const randomized = await character(page);
    assert.equal(randomized.appearance.coat, beforeRandom.appearance.coat);
    assert.deepEqual(randomized.identity, initial.identity);
    assert.deepEqual(randomized.skills, beforeRandom.skills);
    await click(page, 'undo');
    assert.deepEqual(await character(page), beforeRandom);
    await click(page, 'review');
    await click(page, 'commit');
    await page.waitForFunction(() => document.querySelector('#save-status')?.textContent === 'Saved to disk');
    await page.locator('dialog [data-action="export"]').click();
    assert.equal(await page.locator('#dialog-title').evaluate(el => el === document.activeElement), true, 'nested replacement receives focus');
    await click(page, 'close');
    const created = await character(page);
    assert.equal(created.status, 'ready');
    const disk = await (await fetch(`${server.url}/api/characters/${created.id}`)).json();
    assert.equal(disk.character.identity.name, 'Moss');
    await click(page, 'chapter:0');
    await page.locator('#character-name').fill('Moss Again');
    await page.locator('#character-name').press('Tab');
    await click(page, 'save');
    assert.equal((await (await fetch(`${server.url}/api/characters/${created.id}`)).json()).character.identity.name, 'Moss');
    await click(page, 'review');
    assert.equal(await page.locator('[data-action="commit"]').textContent(), 'Apply changes');
    await click(page, 'commit');
    await page.waitForFunction(() => document.querySelector('#save-status')?.textContent === 'Saved to disk');
    await click(page, 'close');
    assert.equal((await (await fetch(`${server.url}/api/characters`)).json()).characters.length, 1);
    const beforeImport = await character(page);
    await page.locator('#import-file').setInputFiles({name:'moss.character.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(beforeImport))});
    assert.deepEqual(await character(page), beforeImport, 'import preview cannot mutate the current character');
    await page.keyboard.press('Escape');
    assert.deepEqual(await character(page), beforeImport);
    await page.locator('#import-file').setInputFiles({name:'moss.character.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(beforeImport))});
    await click(page, 'confirm-import');
    const imported = await character(page);
    assert.notEqual(imported.id, beforeImport.id);
    assert.equal(imported.status, 'draft');
    await click(page, 'collection');
    await click(page, `open:${beforeImport.id}`);
    const remote = await (await fetch(`${server.url}/api/characters/${beforeImport.id}`)).json();
    const rival = {...remote.character,identity:{...remote.character.identity,name:'Written by agent'}};
    const token = await page.evaluate(() => window.__STUDIO__!.token!);
    const written = await fetch(`${server.url}/api/characters/${rival.id}`, {method:'PUT',headers:{'content-type':'application/json','x-studio-token':token},body:JSON.stringify({character:rival,expectedRevision:remote.revision,expectedState:remote.stateHash})});
    assert.equal(written.status, 200);
    await page.locator('#character-name').fill('Browser draft');
    await page.locator('#character-name').press('Tab');
    await click(page, 'review'); await click(page, 'commit');
    await page.locator('[data-action="reload-disk"]').waitFor();
    assert.equal((await character(page)).identity.name, 'Browser draft');
    await click(page, 'reload-disk');
    assert.equal((await character(page)).identity.name, 'Written by agent');
    await click(page, 'collection');
    assert.ok(await page.getByText('Browser draft', {exact:true}).count());
    await click(page, `open:${rival.id}`);
    await page.setViewportSize({width:390,height:844});
    await click(page, 'preferences');
    await page.locator('[data-preference="large"]').check();
    await page.keyboard.press('Escape');
    const overflow = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).map(el => ({tag:el.tagName,cls:el.className,right:el.getBoundingClientRect().right})));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `mobile large text must not overflow horizontally: ${JSON.stringify(overflow)}`);
    assert.equal(await page.locator('[data-action="zoom:0.15"]').isVisible(), true, 'touch users retain zoom controls');
    await page.locator('[data-action="chapter:2"]').focus();
    await page.keyboard.press('Enter');
    assert.match(await page.locator('#editor-panel h2').textContent() || '', /Coat/);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close(); server.child.kill(); await rm(project,{recursive:true,force:true});
  }
});
