/// <reference path="../scene-editor-ui-contracts.d.ts" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {launchBrowser,monitorContext,READY_TIMEOUT_MS,waitForReady} from './browser-harness';
import type {Page} from 'playwright';
interface Result {name:string;passed:boolean;error?:string;}
const ROOT=path.resolve(__dirname,'../..');
const ARTIFACT=process.env.LITTLEWILD_BROWSER_ARTIFACT||path.join(ROOT,'.generated/artifacts/showcase.html');
const OUT=process.env.LITTLEWILD_SCENE_EDITOR_OUT||path.join(ROOT,'verification','v15');
const SHOTS=process.env.LITTLEWILD_SCREENSHOT_DIR||OUT;
const results:Result[]=[];let rawDiagnostics:unknown=null;
async function check(name:string,work:()=>Promise<void>):Promise<void>{try{await work();results.push({name,passed:true});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
async function value<T=unknown>(page:Page,expression:string):Promise<T>{return page.evaluate(expression) as Promise<T>;}
async function open(page:Page):Promise<void>{await page.evaluate('Littlewild.engine.s.paused=true;Littlewild.open("scenarios")');await page.locator('[data-scenario="editor"]').click();}
async function select(page:Page,type:string,id:string):Promise<void>{const compact=page.locator('[data-scene-editor-field=selection]');if(await compact.isVisible())await compact.selectOption(type+':'+id);else await page.locator(`[data-scene-editor="select-${type}"][data-id="${id}"]`).first().click();}
async function snapshot(page:Page):Promise<string>{return value<string>(page,'JSON.stringify(Littlewild.engine.export())');}
async function main():Promise<void>{
 const browser=await launchBrowser(),context=await browser.newContext({acceptDownloads:true}),diagnostics=monitorContext(context);
 try{
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
   const p=await context.newPage();p.setDefaultTimeout(7000);await p.setViewportSize(viewport);await p.setContent(fs.readFileSync(ARTIFACT,'utf8'),{waitUntil:'load',timeout:30000});
   await waitForReady(p,{timeout:READY_TIMEOUT_MS});await p.locator('[data-act="begin"]').click();await open(p);
   const suffix=' at '+viewport.width+'px',original=await snapshot(p);
   await check('Editor opens the separate pack draft with navigable worlds and scenes'+suffix,async()=>{
    assert(await p.getByRole('heading',{name:'World & Scene Editor',exact:true}).isVisible());assert.equal(await p.locator('[data-scene-editor="select-world"]').count(),1);assert(await p.locator('[data-scene-editor="select-scene"]').count()>=2);
    assert.equal(await snapshot(p),original);assert(await value(p,'document.documentElement.scrollWidth<=innerWidth'));
   });
   await check('Delayed real pack import preserves a newer scene draft and history'+suffix,async()=>{
    const before=await value<LWContentPorts.ScenarioPack>(p,'Littlewild.scenarioUI.editor.session.snapshot()');await p.evaluate('window.__sceneOriginalText=File.prototype.text;File.prototype.text=function(){const selected=this;return new Promise((resolve,reject)=>{window.__releaseSceneImport=()=>window.__sceneOriginalText.call(selected).then(resolve,reject);});};');
    try{
     await p.locator('#scene-editor-import').setInputFiles({name:'delayed.pack.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(before))});await p.waitForFunction('typeof window.__releaseSceneImport==="function"');
     const form=p.locator('[data-scene-editor-form="scene"]');await form.locator('[name=name]').fill('Later scene edit');await form.locator('[data-scene-editor="submit"]').click();
     const newer=await value<LWContentPorts.ScenarioPack>(p,'Littlewild.scenarioUI.editor.session.snapshot()'),revision=await value(p,'Littlewild.scenarioUI.editor.session.revision');assert.equal(newer.scenes[0]!.name,'Later scene edit');await p.evaluate('window.__releaseSceneImport()');assert.deepEqual(await value(p,'Littlewild.scenarioUI.editor.session.snapshot()'),newer);assert.equal(await value(p,'Littlewild.scenarioUI.editor.session.revision'),revision);assert.equal(await snapshot(p),original);
     await p.locator('[data-scene-editor="undo"]').click();assert.deepEqual(await value(p,'Littlewild.scenarioUI.editor.session.snapshot()'),before);
    }finally{await p.evaluate('File.prototype.text=window.__sceneOriginalText;delete window.__sceneOriginalText;delete window.__releaseSceneImport;');}
   });
   await check('World terrain and resource generation have visual controls'+suffix,async()=>{
    await select(p,'world','mossmeadow');const form=p.locator('[data-scene-editor-form="world"]');await form.locator('[name=name]').fill('Edited meadow');await form.locator('[name=resource-wood]').fill('12');await form.locator('[data-scene-editor="submit"]').click();
    assert.equal(await value(p,'Littlewild.scenarioUI.editor.session.snapshot().worlds[0].name'),'Edited meadow');assert.equal(await value(p,'Littlewild.scenarioUI.editor.session.snapshot().worlds[0].resourceCounts.wood'),12);assert.equal(await snapshot(p),original);await p.locator('[data-scene-editor="undo"]').click();
   });
   await check('Direct grid placement and keyboard tile focus mutate only the draft'+suffix,async()=>{
    await select(p,'scene','first-morning');await p.locator('[data-scene-editor-field="entity"]').selectOption('c1');await p.locator('[data-scene-editor="move"]').click();const tile=p.locator('.scene-editor-cell[data-x="9"][data-y="9"]');await tile.scrollIntoViewIfNeeded();await tile.click();
    assert.deepEqual(await value(p,'(()=>{const c=Littlewild.scenarioUI.editor.session.entities("first-morning").find(e=>e.id==="c1");return [c.x,c.y]})()'),[9,9]);assert.equal(await snapshot(p),original);
    await p.locator('.scene-editor-cell[data-x="0"][data-y="0"]').focus();await p.keyboard.press('ArrowRight');assert.equal(await p.evaluate(()=> (document.activeElement as HTMLElement).dataset.x),'1');await p.locator('[data-scene-editor="undo"]').click();
   });
   await check('Canonical inventory inspector retains supported items and history'+suffix,async()=>{
    const form=p.locator('[data-scene-editor-form="entity"]');await form.locator('[name=name]').fill('Editor Pip');await form.locator('[data-inventory-item=berries]').fill('7');await form.locator('[data-scene-editor="submit"]').click();
    assert.equal(await value(p,'Littlewild.scenarioUI.editor.session.entities("first-morning").find(e=>e.id==="c1").data.inventory.berries'),7);assert.equal(await snapshot(p),original);await p.locator('[data-scene-editor="undo"]').click();await p.locator('[data-scene-editor="redo"]').click();
   });
   await check('Visual connection, entry requirement and event rows author typed metadata'+suffix,async()=>{
    const form=p.locator('[data-scene-editor-form="scene"]');await form.getByText('Bounds & connections',{exact:true}).click();await form.locator('[data-scene-editor="add-connection"]').click();await form.locator('[name=connection-id]').fill('to-home');await form.locator('[name=connection-label]').fill('Visit charted home');await form.locator('[name=connection-target]').selectOption('charted-home');
    await form.getByText('Requirements & events',{exact:true}).click();await form.locator('[data-scene-editor="add-requirement"]').click();await form.locator('[name=requirement-minimum]').fill('1');await form.locator('[data-scene-editor="add-event"]').click();await form.locator('[name=event-text]').fill('Entered the edited morning.');await form.locator('[data-scene-editor="submit"]').click();
    const graph=await value<LWSceneGraph.Metadata>(p,'Littlewild.scenarioUI.editor.session.snapshot().scenes[0].graph');assert.equal(graph.connections?.[0]?.targetSceneId,'charted-home');assert.deepEqual(graph.requirements,[{type:'player-level',minimum:1}]);assert.deepEqual(graph.events,[{type:'message',text:'Entered the edited morning.'}]);assert.equal(await snapshot(p),original);
   });
   await check('Decorative props use canonical asset/model choices and direct placement'+suffix,async()=>{
    await p.locator('[data-scene-editor-field="category"]').selectOption('props');const form=p.locator('[data-scene-editor-form="prop-add"]');await form.locator('[name=newId]').fill('garden-wood');await form.locator('[name=name]').fill('Garden wood');await form.locator('[name=assetId]').selectOption('item/wood');await form.locator('[name=model]').selectOption('world');await form.locator('[name=x]').fill('1');await form.locator('[name=y]').fill('1');await form.getByRole('button',{name:'Add prop to draft'}).click();
    await p.locator('[data-scene-editor="move"]').click();await p.locator('.scene-editor-cell[data-x="2"][data-y="1"]').click();const prop=await value<LWSceneGraph.Prop>(p,'Littlewild.scenarioUI.editor.session.snapshot().scenes[0].graph.props[0]');assert.equal(prop.category,'item');assert.equal(prop.assetId,'wood');assert.equal(prop.x,2);assert.equal(await snapshot(p),original);
   });
   await check('Bound child scene creation uses source authority and stable floor IDs'+suffix,async()=>{
    await select(p,'scene','charted-home');await p.locator('[data-scene-editor="new-child"]').click();const form=p.locator('[data-scene-editor-form="create"]');await form.locator('[name=name]').fill('Home interior');await form.locator('[name=id]').fill('home-interior');await form.locator('[name=kind]').selectOption('interior');await form.locator('[name=binding-building]').fill('b2');await form.locator('[name=binding-floor]').fill('ground');await form.getByRole('button',{name:'Create draft scene'}).click();
    const scene=await value<LWContentPorts.Scene>(p,'Littlewild.scenarioUI.editor.session.snapshot().scenes.find(s=>s.id==="home-interior")');assert.equal(scene.graph?.parentId,'charted-home');assert(scene.graph?.binding?.type==='interior');assert.equal(scene.graph.binding.floorId,'ground');assert.deepEqual(scene.initialState,{});assert(await p.locator('.scene-editor-cell').first().isDisabled());assert.equal(await snapshot(p),original);
   });
   await check('Canonical rectangular floors and explicitly authored holes project correct placement cells'+suffix,async()=>{
    const masks=await value<{rectangleEnabled:number;holesEnabled:number}>(p,'(()=>{const editor=Littlewild.scenarioUI.editor,p=editor.session.snapshot(),s=p.scenes.find(s=>s.id==="charted-home"),b=s.initialState.buildings.find(b=>b.id==="b2"),floor=LWInteriors.forBuilding(s.initialState,b).floors.find(f=>f.id==="ground"),state={...editor.state,category:"props"};const render=interior=>{const div=document.createElement("div");div.innerHTML=LWSceneEditorView.render({pack:p,state,entities:[],revision:editor.session.revision,esc:v=>String(v??""),interior});return div.querySelectorAll(".scene-editor-cell:not([disabled])").length};return {rectangleEnabled:render({...floor,cells:undefined}),holesEnabled:render({...floor,cells:[{x:0,y:0}]})}})()');assert(masks.rectangleEnabled>1);assert.equal(masks.holesEnabled,1);
    const stride=await value<boolean>(p,'(()=>{const session=Littlewild.scenarioUI.editor.session,p=session.snapshot(),s=p.scenes.find(s=>s.id==="first-morning");s.graph={kind:"island",binding:{type:"island",sourceSceneId:"charted-home",ix:1,iy:0}};p.worlds[0].terrain[0]="~..................";const div=document.createElement("div");div.innerHTML=LWSceneEditorView.render({pack:p,state:{...Littlewild.scenarioUI.editor.state,selection:{type:"scene",id:s.id}},entities:[],revision:0,esc:v=>String(v??"")});return Array.from(div.querySelectorAll(".scene-editor-cell")).find(cell=>cell.dataset.x==="23"&&cell.dataset.y==="0").classList.contains("is-water")})()');assert(stride);
   });
   await check('Invalid import is atomic and presents recovery guidance'+suffix,async()=>{
    const before=await value(p,'JSON.stringify(Littlewild.scenarioUI.editor.session.snapshot())');await p.locator('#scene-editor-import').setInputFiles({name:'broken.pack.json',mimeType:'application/json',buffer:Buffer.from('{invalid')});await p.locator('.scene-editor-feedback.is-error').waitFor();assert.equal(await value(p,'JSON.stringify(Littlewild.scenarioUI.editor.session.snapshot())'),before);assert.equal(await snapshot(p),original);
   });
   await check('Full pack export includes the bound child and canonical item edit'+suffix,async()=>{
    const downloadEvent=p.waitForEvent('download');await p.locator('[data-scene-editor="export"]').click();const download=await downloadEvent;assert(download.suggestedFilename().endsWith('.pack.json'));const location=await download.path();assert(location);const pack=JSON.parse(fs.readFileSync(location,'utf8')) as LWContentPorts.ScenarioPack;assert(pack.scenes.some((s)=>s.id==='home-interior'));assert.equal(((pack.scenes.find((s)=>s.id==='first-morning')!.initialState.colony as {creatures:{inventory:{berries:number}}[]}).creatures[0]!.inventory.berries),7);assert(pack.libraries&&pack.worlds&&pack.simulation);
   });
   await check('Review cancellation preserves draft revision and active story'+suffix,async()=>{
    await select(p,'scene','first-morning');const revision=await value(p,'Littlewild.scenarioUI.editor.session.revision');await p.locator('[data-scene-editor="review"]').click();assert(await p.locator('[data-scenario="launch"]').isVisible());assert.equal(await snapshot(p),original);await p.locator('[data-scenario="cancel"]').click();assert.equal(await value(p,'Littlewild.scenarioUI.editor.session.revision'),revision);assert(await p.locator('.scene-editor').isVisible());
   });
   await check('Closing and reopening retains the draft; another pack requires explicit replacement'+suffix,async()=>{
    const before=await value(p,'JSON.stringify(Littlewild.scenarioUI.editor.session.snapshot())');await p.locator('[data-act="close-modal"]').first().click();await p.evaluate('Littlewild.open("scenarios")');await p.locator('[data-scenario="editor"]').click();assert.equal(await value(p,'JSON.stringify(Littlewild.scenarioUI.editor.session.snapshot())'),before);
    await p.evaluate('Littlewild.open("scenarios")');await p.locator('[data-scenario="select"]').filter({hasText:'Emberworks'}).click();await p.locator('[data-scenario="editor"]').click();assert.equal(await p.evaluate(()=>(document.activeElement as HTMLElement).dataset.sceneEditor),'cancel-replace');await p.locator('[data-scene-editor="cancel-replace"]').click();assert.equal(await value(p,'JSON.stringify(Littlewild.scenarioUI.editor.session.snapshot())'),before);
   });
   await check('Deletion confirmation initially focuses Cancel'+suffix,async()=>{
    await p.locator('[data-scene-editor="confirm-scene"]').click();assert.equal(await p.evaluate(()=>(document.activeElement as HTMLElement).dataset.sceneEditor),'cancel-delete');await p.locator('[data-scene-editor="cancel-delete"]').click();
   });
   await p.locator('.scene-editor').evaluate(el=>{el.scrollTop=0;});await p.locator('#modal').evaluate(el=>{el.scrollTop=0;});
   await p.locator('[data-scene-editor-field=entity]').selectOption('c1');
   if(process.env.LITTLEWILD_CAPTURE_SCREENSHOTS==='1'){await p.waitForFunction(()=>document.querySelector('[data-time-label]')?.textContent?.includes('Paused by you'));fs.mkdirSync(SHOTS,{recursive:true});await p.screenshot({path:path.join(SHOTS,'scene-editor-'+viewport.width+'.png'),animations:'disabled'});}
   if(viewport.width===390&&process.env.LITTLEWILD_CAPTURE_SCREENSHOTS==='1'){await p.locator('.scene-editor-spatial').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(SHOTS,'scene-editor-mobile-layout.png'),animations:'disabled'});}
   if(viewport.width===1440){
    await check('Authored pack launches only after review and instantiates its actual 3D prop asset',async()=>{
     await p.evaluate('(()=>{const session=Littlewild.scenarioUI.editor.session,p=session.snapshot(),first=p.scenes.find(s=>s.id==="first-morning"),home=p.scenes.find(s=>s.id==="charted-home"),room=p.scenes.find(s=>s.id==="home-interior");session.addWorld(p.worlds[0],"remote-world","Remote meadow");session.addScene({...first,name:"Remote morning",graph:{kind:"level",connections:[{id:"back-to-first",targetSceneId:"first-morning",label:"Return to morning"}]}},"remote-morning","remote-world");session.updateScene(first.id,{graph:{...first.graph,connections:[...(first.graph.connections||[]),{id:"to-remote",targetSceneId:"remote-morning",label:"Travel to remote meadow"}]}});session.updateScene(home.id,{graph:{...home.graph,kind:"level",connections:[{id:"to-room",targetSceneId:room.id,label:"Visit workshop"},{id:"to-first",targetSceneId:first.id,label:"Return to morning"}]}});session.updateScene(room.id,{graph:{...room.graph,connections:[{id:"back-to-home",targetSceneId:home.id,label:"Return outside"}]}});window.sceneEditorAssetCalls=[];const original=LWAssetRenderer;window.LWAssetRenderer={...original,create(...args){const result=original.create.apply(original,args);const [kit,parent,category,id,model,options]=args;if(category==="item"&&id==="wood"&&model==="world"&&options?.position?.[0]===2&&options?.position?.[2]===1)window.sceneEditorAssetCalls.push({category,id,model,rendered:!!result});return result;}};Littlewild.open("scene-editor")})()');
     await p.locator('[data-scene-editor="review"]').click();await p.locator('[data-scenario="launch"]').click();await p.evaluate('Littlewild.engine.s.paused=true;Littlewild.refresh()');assert.equal(await value(p,'Littlewild.engine.scenarioContext.sceneId'),'first-morning');assert.equal(await value(p,'Littlewild.engine.creatures[0].name'),'Editor Pip');await p.waitForFunction(()=>(window as unknown as {sceneEditorAssetCalls:unknown[]}).sceneEditorAssetCalls.length>0,{},{timeout:15000});assert.deepEqual(await value(p,'sceneEditorAssetCalls[0]'),{category:'item',id:'wood',model:'world',rendered:true});
    });
    await check('Cross-world connection review cancellation preserves native state and camera',async()=>{
     await p.evaluate('window.sceneEditorFirstCheckpoint=JSON.stringify(Littlewild.engine.export().state);window.sceneEditorCamera=JSON.stringify(Littlewild.world.camera);Littlewild.open("scenarios")');await p.locator('[data-scenario="transition"][data-id="to-remote"]').click();assert.equal(await value(p,'JSON.stringify(Littlewild.engine.export().state)'),await value(p,'sceneEditorFirstCheckpoint'));await p.locator('[data-scenario="cancel-transition"]').click();assert.equal(await value(p,'JSON.stringify(Littlewild.world.camera)'),await value(p,'sceneEditorCamera'));
    });
    await check('Cross-world committed travel and return restore the native checkpoint and camera',async()=>{
     await p.locator('[data-scenario="transition"][data-id="to-remote"]').click();await p.locator('[data-scenario="enter"]').click({timeout:15000});await p.evaluate('Littlewild.engine.s.paused=true;Littlewild.refresh()');assert.equal(await value(p,'Littlewild.engine.scenarioContext.world.id'),'remote-world');await p.evaluate('Littlewild.open("scenarios")');await p.locator('[data-scenario="transition"][data-id="back-to-first"]').click();await p.locator('[data-scenario="enter"]').click({timeout:15000});await p.evaluate('Littlewild.engine.s.paused=true;Littlewild.refresh()');assert.equal(await value(p,'JSON.stringify(Littlewild.engine.export().state)'),await value(p,'sceneEditorFirstCheckpoint'));assert.equal(await value(p,'JSON.stringify(Littlewild.world.camera)'),await value(p,'sceneEditorCamera'));
    });
    await check('Bound interior travel and portable restore open the canonical floor and preserve source state',async()=>{
     await p.evaluate('Littlewild.open("scenarios")');await p.locator('[data-scenario="transition"][data-id="to-home"]').click();await p.locator('[data-scenario="enter"]').click({timeout:15000});await p.evaluate('Littlewild.engine.s.paused=true;Littlewild.refresh();window.sceneEditorHomeCheckpoint=JSON.stringify(Littlewild.engine.export().state);Littlewild.open("scenarios")');await p.locator('[data-scenario="transition"][data-id="to-room"]').click();await p.locator('[data-scenario="enter"]').click({timeout:15000});assert(await p.locator('#building-interior').isVisible());assert.equal(await value(p,'Littlewild.interiors.state.floorId'),'ground');assert.equal(await value(p,'JSON.stringify(Littlewild.engine.export().state)'),await value(p,'sceneEditorHomeCheckpoint'));await p.evaluate('(()=>{const saved=Littlewild.snapshot();Littlewild.interiors.close(false);Littlewild.setEngine(LWStory.commit(LWStory.inspect(saved)))})()');assert(await p.locator('#building-interior').isVisible());assert.equal(await value(p,'Littlewild.interiors.state.floorId'),'ground');assert.equal(await value(p,'JSON.stringify(Littlewild.engine.export().state)'),await value(p,'sceneEditorHomeCheckpoint'));await p.evaluate('Littlewild.interiors.close(false);Littlewild.open("scenarios")');await p.locator('[data-scenario="transition"][data-id="back-to-home"]').click();await p.locator('[data-scenario="enter"]').click({timeout:15000});assert.equal(await value(p,'JSON.stringify(Littlewild.engine.export().state)'),await value(p,'sceneEditorHomeCheckpoint'));
    });
   }
   await p.close();
  }
 }finally{await context.close();await browser.close();}
 rawDiagnostics=diagnostics;
 await check('Editor browser execution has no page errors, console warnings or external requests',async()=>{assert.deepEqual(diagnostics.errors,[]);assert.deepEqual(diagnostics.consoleProblems,[]);assert.deepEqual(diagnostics.requests,[]);});
}
fs.mkdirSync(OUT,{recursive:true});
main().catch(error=>{results.push({name:'Editor browser setup',passed:false,error:String(error)});console.error(error);}).finally(()=>{const passed=results.filter(r=>r.passed).length;fs.writeFileSync(path.join(OUT,'scene-editor-browser-results.json'),JSON.stringify({passed,total:results.length,results,diagnostics:rawDiagnostics},null,2)+'\n');console.log(`Scene editor browser: ${passed}/${results.length} passed.`);if(passed!==results.length)process.exitCode=1;});
