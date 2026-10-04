/// <reference path="../wildlands-project-contracts.d.ts" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type {Page} from 'playwright';
import {launchBrowser,monitorContext} from './browser-harness';

const ROOT=path.resolve(__dirname,'../..');
const OUT=path.join(ROOT,'verification/v15');
const FIXTURE='https://localhost/wildlands-workspace-proof';
const results:{name:string;passed:boolean;error?:string}[]=[];
let diagnostics:unknown;
async function check(name:string,work:()=>Promise<void>):Promise<void>{
 try{await work();results.push({name,passed:true});console.log('PASS '+name);}
 catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}
}
async function save(page:Page,width:number,label:string):Promise<Wildlands.Project>{
 const pending=page.waitForEvent('download');
 await page.locator('[data-wildlands="save"]').click();
 const download=await pending,destination=path.join(OUT,`wildlands-${label}-${width}.json`);
 assert(download.suggestedFilename().endsWith('.json'));
 await download.saveAs(destination);
 return JSON.parse(fs.readFileSync(destination,'utf8')) as Wildlands.Project;
}
async function main():Promise<void>{
 fs.mkdirSync(OUT,{recursive:true});
 const browser=await launchBrowser(),context=await browser.newContext({acceptDownloads:true});
 const observed=monitorContext(context);
 await context.route(FIXTURE,route=>route.fulfill({status:200,contentType:'text/html',body:fs.readFileSync(process.env.LITTLEWILD_BROWSER_ARTIFACT??path.join(ROOT,'littlewild.html'),'utf8')}));
 try{
  for(const width of [1440,390]){
   const page=await context.newPage();page.setDefaultTimeout(20000);
   await page.setViewportSize({width,height:width===390?844:1000});
   await page.addInitScript('localStorage.clear()');
   await page.goto(FIXTURE,{waitUntil:'load',timeout:60000});
   await page.waitForFunction('!!window.Littlewild&&!!window.WildlandsProject');
   await page.locator('[data-act="begin"]').click();
   await page.evaluate('Littlewild.engine.s.paused=true');
   await check(width+'px default showcase is a portable Littlewild project',async()=>{
    assert(await page.locator('#wildlands-workspace').isVisible());
    assert.match(await page.title(),/Wildlands/i);
    const project=await save(page,width,'default');
    assert.equal(project.format,'wildlands-project');assert.equal(project.target,'godot');
    assert.equal(project.scenarioId,'littlewild');assert.equal(project.pack.id,'littlewild');
    assert(project.pack.scenes.some(scene=>scene.id===project.sceneId));
    const authored=JSON.parse(fs.readFileSync(path.join(ROOT,'source/content/littlewild.pack.json'),'utf8')) as LWContentPorts.ScenarioPack;
    for(const scene of authored.scenes)assert(project.pack.scenes.some(value=>value.id===scene.id),'Missing authored scene '+scene.id);
    const builtinIds=await page.evaluate<string[]>('LWScenarios.builtins().find(pack=>pack.id==="littlewild").scenes.map(scene=>scene.id)');
    assert.deepEqual(project.pack.scenes.map(scene=>scene.id),builtinIds);
    const builtin=JSON.parse(await page.evaluate<string>('JSON.stringify(LWScenarios.builtins().find(pack=>pack.id==="littlewild"))')) as LWContentPorts.ScenarioPack;
    for(const scene of builtin.scenes.filter(scene=>scene.id!==project.sceneId))assert.deepEqual(project.pack.scenes.find(value=>value.id===scene.id),scene);
    assert.deepEqual(project.pack.storytelling,builtin.storytelling);
    const scenarios=await page.locator('#wildlands-scenario option').evaluateAll(options=>options.map(option=>(option as HTMLOptionElement).value));
    assert(scenarios.some(value=>value.startsWith('littlewild/')));
    assert(scenarios.some(value=>value.startsWith('office/')));
    assert(scenarios.some(value=>value.startsWith('emberworks/')));
   });
   await check(width+'px scenario review preserves the game until explicit launch',async()=>{
    // A retained Littlewild authoring draft must not replace the newly launched Office pack.
    await page.locator('[data-wildlands="scenes"]').click();
    await page.waitForFunction('!!Littlewild.scenarioUI.editor.session');
    await page.keyboard.press('Escape');
    const before=await page.evaluate('JSON.stringify(Littlewild.engine.export())');
    const office=await page.locator('#wildlands-scenario option').evaluateAll(options=>options.map(option=>(option as HTMLOptionElement).value).find(value=>value.startsWith('office/')));
    assert(office);await page.locator('#wildlands-scenario').selectOption(office);
    await page.locator('[data-wildlands="switch"]').click();
    assert.equal(await page.evaluate('JSON.stringify(Littlewild.engine.export())'),before);
    await page.locator('[data-scenario="launch"]').click();
    await page.evaluate('Littlewild.engine.s.paused=true');
    assert.deepEqual(await page.evaluate('Littlewild.engine.creatures.map(creature=>creature.name)'),['Angela','Phil','Marty']);
    const project=await save(page,width,'office');assert.equal(project.scenarioId,'office');
    assert.equal(project.sceneId,office.split('/')[1]);
   });
   await check(width+'px project rename and malformed import retain the current scenario',async()=>{
    await page.locator('#wildlands-project-name').fill('Agent authored office');
    const before=await save(page,width,'renamed');assert.equal(before.name,'Agent authored office');
    await page.locator('#wildlands-project-file').setInputFiles({name:'invalid.wildlands.json',mimeType:'application/json',buffer:Buffer.from('{')});
    await page.waitForFunction('document.querySelector("#wildlands-feedback").getAttribute("role")==="alert"');
    const after=await save(page,width,'after-invalid');assert.deepEqual(after,before);
   });
   await check(width+'px portable project import requires review and restores project identity',async()=>{
    const imported=JSON.parse(fs.readFileSync(path.join(OUT,`wildlands-default-${width}.json`),'utf8')) as Wildlands.Project;
    imported.name='Imported Littlewild showcase';imported.id='imported-showcase';
    const before=await page.evaluate('JSON.stringify(Littlewild.engine.export())');
    await page.locator('#wildlands-project-file').setInputFiles({name:'imported.wildlands.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});
    await page.waitForFunction('document.querySelector("#wildlands-feedback").textContent.includes("Project validated")');
    assert.equal(await page.evaluate('JSON.stringify(Littlewild.engine.export())'),before);
    await page.locator('[data-scenario="launch"]').click();await page.evaluate('Littlewild.engine.s.paused=true');
    const saved=await save(page,width,'imported');
    assert.equal(saved.name,imported.name);assert.equal(saved.id,imported.id);
    assert.equal(saved.scenarioId,'littlewild');assert.equal(saved.sceneId,imported.sceneId);
   });
   await check(width+'px export downloads a Godot ZIP and preserves the project',async()=>{
    const before=await save(page,width,'before-export');
    await page.locator('[data-wildlands-export-panel] summary').click();
    const pending=page.waitForEvent('download',{timeout:120000});
    await page.locator('[data-wildlands="export"]').click();
    const download=await pending,destination=path.join(OUT,'wildlands-godot-'+width+'.zip');
    assert.equal(download.suggestedFilename(),before.id+'.godot.zip');await download.saveAs(destination);
    const zip=fs.readFileSync(destination);assert.equal(zip.readUInt32LE(0),0x04034b50);
    assert(zip.includes(Buffer.from('project.godot')));assert(zip.includes(Buffer.from('wildlands.project.json')));
    assert.deepEqual(await save(page,width,'after-export'),before);
    if(process.env.LITTLEWILD_CAPTURE_SCREENSHOTS==='1')await page.screenshot({path:path.join(OUT,'wildlands-workspace-'+width+'.png'),fullPage:true});
   });
   await check(width+'px workspace has reachable controls without horizontal overflow',async()=>{
    assert.equal(await page.evaluate('document.documentElement.scrollWidth>innerWidth'),false);
    const before=await page.evaluate('JSON.stringify(Littlewild.engine.export())');
    const summary=page.locator('[data-wildlands-export-panel] summary');
    await summary.focus();await page.keyboard.press('Space');
    await page.waitForFunction('!document.querySelector("[data-wildlands-export-panel]").open');
    assert.equal(await page.evaluate('JSON.stringify(Littlewild.engine.export())'),before);
    await page.keyboard.press('Space');
    await page.waitForFunction('document.querySelector("[data-wildlands-export-panel]").open');
    assert.equal(await page.evaluate('JSON.stringify(Littlewild.engine.export())'),before);
    for(const selector of ['#wildlands-scenario','[data-wildlands="save"]','[data-wildlands="switch"]','[data-wildlands="export"]']){
     const bounds=await page.locator(selector).boundingBox();assert(bounds&&bounds.width>=44&&bounds.height>=44,selector+' '+JSON.stringify(bounds));
    }
   });
   await check(width+'px programmatic same-ID scenario replacement preserves its complete authoring closure',async()=>{
    const expected=await page.evaluate<{projectId:string;projectName:string;sceneIds:string[];sceneId:string;clipId:string;graph:unknown}>(`(()=>{
     const current=Wildlands.project(),pack=LWContent.copy(current.pack),home=pack.scenes.find(scene=>scene.id==='charted-home');
     if(!home)throw Error('Default Littlewild authored home is missing.');
     const custom=LWContent.copy(home);custom.id='agent-added-scene';custom.name='Agent added scene';custom.description='Programmatic authoring retains this exact graph.';
     custom.graph={kind:'level',rendering:{dimension:'3d',rendererId:'basic'}};pack.scenes.push(custom);
     const clip={id:'agent-added-clip',name:'Agent authored timeline',sceneId:custom.id,duration:2,skipPolicy:'cancel',tracks:[]};
     pack.storytelling=pack.storytelling||{version:1,cutscenes:[],storyboards:[]};pack.storytelling.cutscenes.push(clip);
     const checked=LWScenarios.validate(pack);if(!checked.ok)throw Error(checked.errors.join('\\n'));
     const engine=LWScenarios.commitScene(LWScenarios.prepareScene(checked.pack,custom.id));engine.s.paused=true;
     Littlewild.setEngine(engine);Littlewild.refresh();
     return {projectId:current.id,projectName:current.name,sceneIds:pack.scenes.map(scene=>scene.id),sceneId:custom.id,clipId:clip.id,graph:custom.graph};
    })()`);
    const saved=await save(page,width,'programmatic-scene');
    assert.equal(saved.id,expected.projectId);assert.equal(saved.name,expected.projectName);
    assert.equal(saved.sceneId,expected.sceneId);assert.deepEqual(saved.pack.scenes.map(scene=>scene.id),expected.sceneIds);
    assert.deepEqual(saved.pack.scenes.find(scene=>scene.id===expected.sceneId)!.graph,expected.graph);
    assert(saved.pack.storytelling?.cutscenes.some(clip=>clip.id===expected.clipId&&clip.sceneId===expected.sceneId));
   });
   await page.close();
  }
  await check('Wildlands workspace performs no external requests or script/console errors',async()=>{
   assert.deepEqual(observed.errors,[]);assert.deepEqual(observed.consoleProblems,[]);
   assert.equal(observed.requests.filter(url=>url===FIXTURE).length,2);
   assert.deepEqual(observed.requests.filter(url=>url!==FIXTURE),[]);
  });
 }finally{diagnostics=observed;await context.close();await browser.close();}
}
main().catch(error=>results.push({name:'Browser setup',passed:false,error:String(error)})).finally(()=>{
 fs.mkdirSync(OUT,{recursive:true});
 const report={suite:'wildlands-browser',passed:results.filter(row=>row.passed).length,total:results.length,results,diagnostics};
 fs.writeFileSync(path.join(OUT,'wildlands-browser-results.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));if(results.some(row=>!row.passed))process.exitCode=1;
});
