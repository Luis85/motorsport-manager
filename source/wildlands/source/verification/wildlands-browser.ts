/// <reference path="../wildlands-project-contracts.d.ts" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type {Page} from 'playwright';
import {launchBrowser,monitorContext,READY_TIMEOUT_MS,waitForReady} from './browser-harness';
import {artifactPath} from './browser-pages';

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
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-wildlands="save"]').click()]);
 const destination=path.join(OUT,`wildlands-${label}-${width}.json`);
 assert(download.suggestedFilename().endsWith('.json'));
 await download.saveAs(destination);
 return JSON.parse(fs.readFileSync(destination,'utf8')) as Wildlands.Project;
}
function projectFromZip(bytes:Buffer):Wildlands.Project {
 for(let offset=0;offset+30<=bytes.length&&bytes.readUInt32LE(offset)===0x04034b50;){
  assert.equal(bytes.readUInt16LE(offset+8),0,'Godot project entries use stored ZIP data');
  const size=bytes.readUInt32LE(offset+18),nameLength=bytes.readUInt16LE(offset+26),extraLength=bytes.readUInt16LE(offset+28);
  const start=offset+30+nameLength+extraLength,end=start+size;
  assert(end<=bytes.length,'Truncated Godot ZIP entry');
  if(bytes.toString('utf8',offset+30,offset+30+nameLength)==='wildlands.project.json')return JSON.parse(bytes.toString('utf8',start,end)) as Wildlands.Project;
  offset=end;
 }
 throw Error('Godot ZIP is missing its portable project');
}
async function main():Promise<void>{
 fs.mkdirSync(OUT,{recursive:true});
 const browser=await launchBrowser(),context=await browser.newContext({acceptDownloads:true});
 const observed=monitorContext(context);
 await context.route(FIXTURE,route=>route.fulfill({status:200,contentType:'text/html',body:fs.readFileSync(artifactPath(ROOT,'studio'),'utf8')}));
 try{
  for(const width of [1440,390]){
   const page=await context.newPage();page.setDefaultTimeout(20000);
   await page.setViewportSize({width,height:width===390?844:1000});
   await page.addInitScript('localStorage.clear()');
   await page.goto(FIXTURE,{waitUntil:'load',timeout:60000});
   await waitForReady(page,{timeout:READY_TIMEOUT_MS,host:'colony'});
   await page.waitForFunction(()=>{
    const runtime=window as unknown as {Littlewild?:unknown;WildlandsProject?:unknown};
    return !!runtime.Littlewild&&!!runtime.WildlandsProject;
   });
   await page.locator('[data-act="begin"]').click();
   await page.evaluate('Littlewild.engine.s.paused=true');
   await check(width+'px default showcase is a portable Littlewild project',async()=>{
    assert(await page.locator('#wildlands-workspace').isVisible());
    assert.match(await page.title(),/Wildlands/i);
    const project=await save(page,width,'default');
    assert.equal(project.format,'wildlands-project');assert.equal(project.target,'godot');
    assert.equal(project.scenarioId,'littlewild');assert.equal(project.pack.id,'littlewild');
    assert(project.pack.scenes.some(scene=>scene.id===project.sceneId));
    const authored=JSON.parse(fs.readFileSync(path.join(ROOT,'.generated/content/littlewild.pack.json'),'utf8')) as LWContentPorts.ScenarioPack;
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
    await page.waitForFunction(()=>!!(window as unknown as {Littlewild:{scenarioUI:{editor:{session:unknown}}}}).Littlewild.scenarioUI.editor.session);
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
    await page.waitForFunction(()=>document.querySelector('#wildlands-feedback')?.getAttribute('role')==='alert');
    const after=await save(page,width,'after-invalid');assert.deepEqual(after,before);
   });
   await check(width+'px portable project import requires review and restores project identity',async()=>{
    const imported=JSON.parse(fs.readFileSync(path.join(OUT,`wildlands-default-${width}.json`),'utf8')) as Wildlands.Project;
    imported.name='Imported Littlewild showcase';imported.id='imported-showcase';
    const before=await page.evaluate('JSON.stringify(Littlewild.engine.export())');
    await page.locator('#wildlands-project-file').setInputFiles({name:'imported.wildlands.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});
    await page.waitForFunction(()=>document.querySelector('#wildlands-feedback')?.textContent?.includes('Project validated'));
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
    await page.waitForFunction(()=>!document.querySelector<HTMLDetailsElement>('[data-wildlands-export-panel]')!.open);
    assert.equal(await page.evaluate('JSON.stringify(Littlewild.engine.export())'),before);
    await page.keyboard.press('Space');
    await page.waitForFunction(()=>document.querySelector<HTMLDetailsElement>('[data-wildlands-export-panel]')!.open);
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
   await check(width+'px same-ID same-scene replacement supersedes the retained draft in project save and Godot export',async()=>{
    await page.locator('[data-wildlands="scenes"]').click();
    const draft=await page.evaluate<string>(`(()=>{
     const editor=Littlewild.scenarioUI.editor,session=editor.session,id=Littlewild.engine.scenarioContext.sceneId;
     session.updateScene(id,{name:'Unapplied authoring draft'});
     const before=JSON.stringify(session.export()),time=Littlewild.engine.s.simTime;Littlewild.refresh();
     Littlewild.engine.s.paused=false;Littlewild.advance(0.2);Littlewild.engine.s.paused=true;
     if(Littlewild.engine.s.simTime<=time)throw Error('Gameplay continuation did not advance.');
     if(editor.session!==session||JSON.stringify(session.export())!==before)throw Error('Ordinary continuation discarded authoring edits.');
     const continued=LWScenarios.commitScene(LWScenarios.prepareScene(LWContent.copy(Littlewild.engine.scenarioContext.journey.pack),id));continued.s.paused=true;
     Littlewild.setEngine(continued);Littlewild.refresh();
     if(editor.session!==session||JSON.stringify(session.export())!==before)throw Error('An unchanged admitted authoring closure discarded the draft.');
     return before;
    })()`);
    await page.keyboard.press('Escape');
    const retained=await save(page,width,'retained-draft');assert.deepEqual(retained.pack,JSON.parse(draft));
    const pendingProject={...retained,id:'superseded-review-'+width,name:'Superseded pending project'};
    await page.locator('#wildlands-project-file').setInputFiles({name:'pending.wildlands.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(pendingProject))});
    await page.waitForFunction(()=>document.querySelector('#wildlands-feedback')?.textContent?.includes('Project validated'));
    const expected=JSON.parse(await page.evaluate<string>(`(()=>{
     const engine=Littlewild.engine,id=engine.scenarioContext.sceneId,pack=LWScenarios.capture(engine),scene=pack.scenes.find(value=>value.id===id);
     scene.name='Replacement authored scene';scene.description='Same IDs, newly admitted authoring ownership.';
     scene.graph={...scene.graph,rendering:{dimension:'2d',rendererId:'basic'},events:[{type:'message',text:'Replacement graph is authoritative.'}]};
     const clip=pack.storytelling.cutscenes.find(value=>value.sceneId===id);
     if(!clip)throw Error('Retained timeline fixture is missing.');clip.name='Replacement timeline';clip.duration=3;
     pack.resources=pack.resources||LWScenarioResources.defaults();
     const asset=pack.resources.assets.find(value=>value.category==='item'&&value.id==='herbs');
     if(!asset)throw Error('Authored asset fixture is missing.');asset.name='Replacement authored herbs';
     const next=LWScenarios.commitScene(LWScenarios.prepareScene(pack,id));next.s.paused=true;
     const admitted=LWScenarios.capture(next);Littlewild.setEngine(next);Littlewild.refresh();
     if(Littlewild.scenarioUI.editor.session!==null)throw Error('The previous authored draft still owns this replacement.');
     return JSON.stringify(admitted);
    })()`)) as LWContentPorts.ScenarioPack;
    assert.equal(expected.id,(JSON.parse(draft) as LWContentPorts.ScenarioPack).id);
    assert.deepEqual(expected.scenes.map(scene=>scene.id),(JSON.parse(draft) as LWContentPorts.ScenarioPack).scenes.map(scene=>scene.id));
    assert.deepEqual(JSON.parse(await page.evaluate<string>('JSON.stringify(Wildlands.project().pack)')),expected);
    await page.keyboard.press('Escape');
    const saved=await save(page,width,'same-scene-replacement');assert.deepEqual(saved.pack,expected);
    assert.equal(saved.id,retained.id);assert.equal(saved.name,retained.name);
    const [download]=await Promise.all([page.waitForEvent('download',{timeout:120000}),page.locator('[data-wildlands="export"]').click()]);
    const destination=path.join(OUT,'wildlands-same-scene-'+width+'.zip');
    assert.equal(download.suggestedFilename(),saved.id+'.godot.zip');await download.saveAs(destination);
    assert.deepEqual(projectFromZip(fs.readFileSync(destination)),saved);
    assert.deepEqual(await save(page,width,'after-same-scene-export'),saved);
    await page.locator('[data-wildlands="scenes"]').click();
    const sameObject=JSON.parse(await page.evaluate<string>(`(()=>{
     const engine=Littlewild.engine,id=engine.scenarioContext.sceneId;
     Littlewild.scenarioUI.editor.session.updateScene(id,{description:'Another retained draft'});
     const pack=LWScenarios.capture(engine);pack.storytelling.cutscenes.find(clip=>clip.sceneId===id).name='Same-object admitted timeline';
     const admitted=LWScenarios.commitScene(LWScenarios.prepareScene(pack,id));admitted.s.paused=true;
     engine.scenarioContext=admitted.scenarioContext;engine.s=admitted.s;
     Littlewild.setEngine(engine);Littlewild.refresh();
     if(Littlewild.engine!==engine||Littlewild.scenarioUI.editor.session!==null)throw Error('Same-object admission retained the previous draft.');
     return JSON.stringify(LWScenarios.capture(engine));
    })()`)) as LWContentPorts.ScenarioPack;
    await page.keyboard.press('Escape');
    assert.deepEqual((await save(page,width,'same-object-replacement')).pack,sameObject);
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
