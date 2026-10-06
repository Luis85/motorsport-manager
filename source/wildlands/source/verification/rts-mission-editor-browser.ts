import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type {Page} from 'playwright';
import {launchBrowser, monitorContext, READY_TIMEOUT_MS} from './browser-harness';

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'verification', 'v15');
const results: {name:string;passed:boolean;error?:string}[] = [];
async function check(name:string, work:()=>Promise<void>):Promise<void> {
 try {await work(); results.push({name, passed:true});}
 catch (error) {results.push({name, passed:false, error:String(error)}); console.error(name, error);}
}
const draft = (page:Page):Promise<LWRTSMissionEditor.Snapshot> => page.evaluate('WildlandsRTS.editorQuery()');
const match = (page:Page):Promise<string> => page.evaluate('JSON.stringify(WildlandsRTS.checkpoint())');
const action = (page:Page, name:string) => page.locator(`[data-editor="${name}"]`);
async function mapTool(page:Page, tool:string, values:Record<string,string>):Promise<void> {
 const form = page.locator('[data-editor-form="brush"]');
 await form.locator('[data-editor-tool]').selectOption(tool);
 for (const [name, value] of Object.entries(values)) {
  const field = form.locator(`[name="${name}"]`);
  if (await field.evaluate(element=>element.tagName==='SELECT')) await field.selectOption(value);
  else await field.fill(value);
 }
 await form.locator('[data-editor-apply]').click();
}
async function main():Promise<void> {
 fs.mkdirSync(OUT, {recursive:true});
 const browser = await launchBrowser();
 const context = await browser.newContext({viewport:{width:1440,height:900}, acceptDownloads:true});
 const diagnostics = monitorContext(context);
 try {
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  await page.setContent(fs.readFileSync(path.join(ROOT,'littlewild.html'),'utf8'), {waitUntil:'load',timeout:30000});
  await page.waitForFunction(()=>!!(window as any).Littlewild && !!(window as any).WildlandsRTS,null,{timeout:READY_TIMEOUT_MS});
  await page.locator('[data-act=begin]').click();
  await page.evaluate('Littlewild.engine.s.paused=true; Littlewild.refresh()');
  await page.locator('[data-wildlands-rts=open]').click();
  await page.locator('[data-rts=pause]').click();
  const retained = await match(page);
  const colony = await page.evaluate('JSON.stringify(Littlewild.engine.export())');
  await check('Mission editor navigation and detached reads preserve both game checkpoints', async()=>{
   const duplicateObjectives=await page.evaluate('const catalog=WildlandsRTS.catalog(); catalog.missions[0].objectives[1].id=catalog.missions[0].objectives[0].id; catalog');
   await page.locator('#rts-import-file').setInputFiles({name:'duplicate-objectives.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(duplicateObjectives))});
   await page.waitForFunction(()=>document.querySelector('[data-rts-file-status]')?.textContent?.includes('Imported and paused'));
   const rejectedLaunch=await match(page);
   await page.locator('[data-rts-file=editor]').click();
   assert(await page.locator('#rts-demo').isVisible(),'Rejected editor admission must retain the match controls');
   assert.equal(await page.locator('#rts-mission-editor').count(),0);
   assert((await page.locator('[data-rts-file-status]').textContent())?.includes('Objective IDs must be unique'));
   assert.equal(await match(page),rejectedLaunch);
   await page.locator('[data-rts-import-kind]').selectOption('checkpoint');
   await page.locator('#rts-import-file').setInputFiles({name:'retained.checkpoint.json',mimeType:'application/json',buffer:Buffer.from(retained)});
   await page.waitForFunction(()=>document.querySelector('[data-rts-file-status]')?.textContent?.includes('Imported and paused'));
   assert.equal(await match(page),retained);
   await page.locator('[data-rts-file=editor]').click();
   assert(await page.locator('#rts-mission-editor').isVisible());
   assert.equal(await page.locator('#rts-demo').count(), 0);
   for (let index=0;index<20;index++) await draft(page);
   await page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
   assert.equal(await match(page), retained);
   assert.equal(await page.evaluate('JSON.stringify(Littlewild.engine.export())'), colony);
   const before = await draft(page);
   await page.evaluate('const copy=WildlandsRTS.editorQuery(); copy.mission.name="tampered"; copy.catalog.units.length=0;');
   assert.deepEqual(await draft(page), before);
  });
  await check('Mission settings publish validated metadata and reject invalid map shrink atomically', async()=>{
   const form = page.locator('[data-editor-form=metadata]');
   await form.locator('xpath=ancestor::details').evaluate(element=>(element as HTMLDetailsElement).open=true);
   await form.locator('[name=name]').fill('Authored browser mission');
   await form.locator('[name=description]').fill('Terrain, units, resources and objectives authored through the editor.');
   await form.locator('[name=seed]').fill('73025');
   await form.locator('button[type=submit]').click();
   assert.equal((await draft(page)).mission.name, 'Authored browser mission');
   assert.equal((await draft(page)).mission.seed, 73025);
   const before = await draft(page);
   await form.locator('[name=width]').fill('8');
   await form.locator('button[type=submit]').click();
   assert.equal(await page.locator('.rts-editor-status').getAttribute('role'), 'alert');
   assert.deepEqual(await draft(page), before);
   await form.locator('[name=width]').fill('40');
   const clone = page.locator('[data-editor-form=clone]');
   await clone.locator('xpath=ancestor::details').evaluate(element=>(element as HTMLDetailsElement).open=true);
   await clone.locator('[name=id]').fill('browser-mission');
   await clone.locator('[name=name]').fill('Browser proving ground');
   await clone.locator('button[type=submit]').click();
   const cloned = await draft(page);
   assert.equal(cloned.mission.id, 'browser-mission');
   assert.equal(cloned.catalog.missions.length, 2);
   assert.deepEqual(cloned.catalog.missions.find(row=>row.id==='frontier'), before.mission);
   assert.equal(await match(page), retained);
  });
  await check('Keyboard terrain authoring shares validated map commands and undo redo history', async()=>{
   const before = await draft(page);
   await mapTool(page,'terrain',{terrain:'forest',x:'2',y:'2',width:'2',height:'1'});
   const painted = await draft(page);
   assert.equal(painted.revision, before.revision+1);
   assert(painted.mission.terrain.some(row=>row.terrain==='forest' && row.x===2 && row.y===2));
   await action(page,'undo').focus(); await page.keyboard.press('Enter');
   assert.deepEqual((await draft(page)).catalog, before.catalog);
   await action(page,'redo').focus(); await page.keyboard.press('Enter');
   assert.deepEqual((await draft(page)).catalog, painted.catalog);
   await mapTool(page,'terrain',{terrain:'road',x:'26',y:'2',width:'1',height:'1'});
   await page.locator('.rts-editor-map').focus();
   await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
   assert((await draft(page)).mission.terrain.some(row=>row.terrain==='road' && row.x<=27 && row.x+row.width>27 && row.y===2));
   const pointerBefore = (await draft(page)).revision;
   const canvas = page.locator('.rts-editor-map');
   const bounds = await canvas.boundingBox(); assert(bounds);
   await canvas.click({position:{x:bounds.width/2,y:bounds.height/2}});
   const brush = page.locator('[data-editor-form=brush]');
   const x = Number(await brush.locator('[name=x]').inputValue());
   const y = Number(await brush.locator('[name=y]').inputValue());
   const pointerAfter = await draft(page);
   assert.equal(pointerAfter.revision, pointerBefore+1);
   assert(pointerAfter.mission.terrain.some(row=>row.terrain==='road' && row.x<=x && row.x+row.width>x && row.y<=y && row.y+row.height>y));
   assert.equal(await match(page), retained);
  });
  await check('Spawn tools author units buildings and creatures while rejecting occupied geometry', async()=>{
   const before = (await draft(page)).mission.spawns.length;
   await mapTool(page,'spawns',{faction:'alliance',archetype:'worker',count:'1',x:'28',y:'5'});
   await mapTool(page,'spawns',{faction:'wildlife',archetype:'wolf',count:'1',x:'30',y:'5'});
   await mapTool(page,'spawns',{faction:'alliance',archetype:'tower',count:'1',x:'34',y:'5'});
   const accepted = await draft(page);
   assert.equal(accepted.mission.spawns.length, before+3);
   assert(accepted.mission.spawns.some(row=>row.archetype==='wolf' && row.faction==='wildlife' && row.x===30));
   await mapTool(page,'spawns',{faction:'alliance',archetype:'hq',count:'1',x:'5',y:'5'});
   assert.equal(await page.locator('.rts-editor-status').getAttribute('role'), 'alert');
   assert.deepEqual(await draft(page), accepted);
   assert.equal(await match(page), retained);
  });
  await check('Deposit item and objective forms retain authored records in the complete catalog', async()=>{
   await mapTool(page,'deposits',{resource:'ore',amount:'1234',x:'28',y:'7'});
   await mapTool(page,'items',{item:'beacon',x:'30',y:'7'});
   const form = page.locator('[data-editor-form=objective]');
   await form.locator('xpath=ancestor::details').evaluate(element=>(element as HTMLDetailsElement).open=true);
   await form.locator('[name=id]').fill('browser-survival');
   await form.locator('[name=name]').fill('Hold the frontier');
   await form.locator('[name=description]').fill('A bounded authored survival objective.');
   await form.locator('[name=type]').selectOption('survive');
   await form.locator('[name=amount]').fill('500');
   await form.locator('button[type=submit]').click();
   const snapshot = await draft(page);
   assert(snapshot.mission.deposits.some(row=>row.resource==='ore' && row.x===28 && row.amount===1234));
   assert(snapshot.mission.items.some(row=>row.item==='beacon' && row.x===30));
   assert(snapshot.mission.objectives.some(row=>row.id==='browser-survival' && row.type==='survive' && row.amount===500));
   assert.equal(snapshot.catalog.units.length, 9);
   assert.equal(snapshot.catalog.buildings.length, 9);
   assert.equal(await match(page), retained);
  });
  await check('Rejected editor JSON imports preserve the whole draft history and retained match', async()=>{
   const before = await draft(page);
   const oldFeedback = await page.locator('.rts-editor-status').textContent();
   await page.locator('#rts-import-file').setInputFiles({name:'invalid-editor.json',mimeType:'application/json',buffer:Buffer.from('{"format":"wildlands-rts","schemaVersion":99}')});
   await page.waitForFunction(previous=>{const status=document.querySelector('.rts-editor-status'); return status?.getAttribute('role')==='alert' && status.textContent!==previous;},oldFeedback);
   assert.deepEqual(await draft(page), before);
   assert.equal(await match(page), retained);
  });
  await check('Mission catalog download and validated import round-trip every authored family', async()=>{
   const expected = (await draft(page)).catalog;
   const downloadEvent = page.waitForEvent('download');
   await action(page,'export').click();
   const download = await downloadEvent;
   const location = await download.path();
   assert(location);
   const bytes = fs.readFileSync(location);
   assert.deepEqual(JSON.parse(bytes.toString('utf8')), expected);
   await page.locator('#rts-import-file').setInputFiles({name:download.suggestedFilename(),mimeType:'application/json',buffer:bytes});
   await page.waitForFunction(()=>document.querySelector('.rts-editor-status')?.textContent?.includes('Imported'));
   assert.deepEqual((await draft(page)).catalog, expected);
   assert.equal(await match(page), retained);
  });
  await check('Editor map remains rendered accessible and contained at desktop and mobile widths', async()=>{
   for (const viewport of [{width:1440,height:900},{width:390,height:844}]) {
    await page.setViewportSize(viewport);
    await page.evaluate('document.querySelector("#rts-mode").scrollTop=0');
    await page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    assert.equal(await page.evaluate('document.documentElement.scrollWidth<=innerWidth'), true);
    const canvas = page.locator('.rts-editor-map');
    assert.equal(await canvas.getAttribute('tabindex'), '0');
    assert(await canvas.getAttribute('aria-label'));
    const opaque = await canvas.evaluate(element=>{
     const canvas = element as HTMLCanvasElement;
     return canvas.getContext('2d')!.getImageData(Math.floor(canvas.width/2),Math.floor(canvas.height/2),1,1).data[3];
    });
    assert(opaque>0);
    const tools=await page.locator('[data-editor-tool]').boundingBox();
    assert(tools&&tools.y>=0&&tools.y+tools.height<=viewport.height,'The map tool selector must fit in the opening viewport');
    await page.screenshot({path:path.join(OUT,`rts-mission-editor-${viewport.width}.png`),fullPage:true,timeout:30000});
   }
  });
  await check('Editor return retires its surface restores focus and retains the draft on reopening', async()=>{
   await page.setViewportSize({width:1440,height:900});
   const before = await draft(page);
   await action(page,'exit').click();
   assert.equal(await page.locator('#rts-mission-editor').count(), 0);
   assert.equal(await page.locator('[data-rts-file=editor]').evaluate(element=>element===document.activeElement), true);
   assert.equal(await match(page), retained);
   await page.locator('[data-rts-file=editor]').click();
   assert.deepEqual(await draft(page), before);
   assert.equal(await page.locator('#rts-mission-editor').count(), 1);
  });
  await check('A file picker retained across editor exit cannot import into another lifecycle', async()=>{
   const before = await draft(page);
   const chooserEvent = page.waitForEvent('filechooser');
   await action(page,'import').click();
   const chooser = await chooserEvent;
   await action(page,'exit').click();
   await chooser.setFiles({name:'stale-editor.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(before.catalog))});
   await page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
   assert.equal(await match(page), retained);
   await page.locator('[data-rts-file=editor]').click();
   assert.deepEqual(await draft(page), before);
  });
  await check('Explicit editor play publishes the authored mission paused without colony changes or browser errors', async()=>{
   const expected = await draft(page);
   await action(page,'play').click();
   assert.equal(await page.locator('#rts-mission-editor').count(), 0);
   assert.equal(await page.locator('#rts-demo').count(), 1);
   assert.equal(await page.evaluate('WildlandsRTS.status().paused'), true);
   assert.equal(await page.evaluate('WildlandsRTS.query().tick'), 0);
   assert.equal(await page.evaluate('WildlandsRTS.status().mission'), expected.mission.id);
   assert.deepEqual(await page.evaluate('WildlandsRTS.catalog()'), expected.catalog);
   assert.notEqual(await match(page), retained);
   const started = await match(page);
   await page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
   assert.equal(await match(page), started);
   assert.equal(await page.evaluate('JSON.stringify(Littlewild.engine.export())'), colony);
   assert.deepEqual(diagnostics.errors, []);
   assert.deepEqual(diagnostics.requests, []);
  });
 } finally {await context.close(); await browser.close();}
}
main().catch(error=>{results.push({name:'Mission editor browser lifecycle',passed:false,error:String(error)});console.error(error);}).finally(()=>{
 const passed = results.filter(result=>result.passed).length;
 fs.writeFileSync(path.join(OUT,'rts-mission-editor-browser-results.json'),JSON.stringify({passed,total:results.length,results},null,2)+'\n');
 console.log(`${passed}/${results.length} mission editor browser checks passed`);
 if (passed!==results.length) process.exitCode=1;
});
