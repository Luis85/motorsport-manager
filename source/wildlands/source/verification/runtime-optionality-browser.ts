/* Runtime optionality seams in Chromium: the colony shell without template or editor bundles,
 * declared payload capabilities, standalone RTS/Pet pages, ready signals and per-game saves. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type {Page} from 'playwright';
import {ACTION_TIMEOUT_MS,fixtureUrl,launchBrowser,monitorContext,openArtifact,READY_TIMEOUT_MS,TRANSITION_TIMEOUT_MS,waitForReady} from './browser-harness';
import {INSERTS} from '../tools/build-inserts.cjs';
import {gameDirectory} from '../tools/game-folder.cjs';
const ROOT=path.resolve(__dirname,'../..'),SOURCE=path.join(ROOT,'source'),GENERATED=path.join(ROOT,'.generated'),OUT=path.join(ROOT,'verification','v15');
const results:{name:string;passed:boolean;error?:string}[]=[];
async function check(name:string,work:()=>Promise<void>):Promise<void>{try{await work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
/** The composite fixture: only the complete-shell check needs the colony with both template hosts mounted. */
const SHOWCASE=fs.readFileSync(path.join(ROOT,'.generated/artifacts/showcase.html'),'utf8');
/** The colony studio: every colony bundle (scenario library, editors, developer session, export payloads), no template hosts. */
const STUDIO=fs.readFileSync(path.join(ROOT,'.generated/artifacts/studio.html'),'utf8');
/** Each opened page gets its own origin, so no page inherits the save another page wrote on pagehide. */
const PAGE_URLS=Array.from({length:12},(_,index)=>fixtureUrl('optionality-'+(index+1)));
/** Simulate an artifact without a bundle: its module's global assignment is ignored. */
const absent=(names:readonly string[]):string=>`for(const name of ${JSON.stringify(names)})Object.defineProperty(window,name,{configurable:false,get(){return undefined;},set(){}});`;
const RECORD_READY="window.__readyEvents=[];addEventListener('wildlands:ready',event=>window.__readyEvents.push({host:event.detail.host,flag:window.__wildlandsReady===true}));";
const ready=(page:Page,host:string):Promise<void>=>waitForReady(page,{host,timeout:READY_TIMEOUT_MS});
const value=<T>(page:Page,script:string):Promise<T>=>page.evaluate(script) as Promise<T>;
const frames=(page:Page):Promise<unknown>=>page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');

/** Assemble a play-only page from the compiled modules of one template, in the closed build order. */
function playOnlyPage(prefix:string,extra:readonly string[],data:Record<string,unknown>,boot:string):string{
 const selected=INSERTS.filter(([marker])=>marker.startsWith(prefix)||extra.includes(marker));
 const style=selected.filter(([,,kind])=>kind==='style').map(([,file])=>'<style>'+fs.readFileSync(path.join(SOURCE,file),'utf8')+'</style>').join('\n');
 const scripts=selected.filter(([,,kind])=>kind==='script').map(([,file])=>{
  const text=fs.readFileSync(file.startsWith('../vendor/')?path.resolve(SOURCE,file):path.join(GENERATED,file),'utf8');
  return '<script>'+text.replace(/<\/script/gi,'<\\/script')+'</script>';
 }).join('\n');
 const declarations=Object.entries(data).map(([name,input])=>`window.${name}=${JSON.stringify(input).replaceAll('<','\\u003c')};`).join('\n');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${prefix}play-only</title>${style}</head><body><script>${declarations}</script>${scripts}<script>${boot}</script></body></html>`;
}
/** Remove compiled modules from the composite exactly as a profile without their bundle would. */
function withoutModules(html:string,files:readonly string[]):string{
 return files.reduce((page,file)=>{
  const text=fs.readFileSync(path.join(GENERATED,file),'utf8'),at=page.indexOf(text);
  assert(at>=0&&page.indexOf(text,at+1)<0,'Expected exactly one inlined copy of '+file);
  return page.slice(0,at)+page.slice(at+text.length);
 },html);
}
/** A game folder's catalog document (RTS Frontier, Pocket Pet). */
const catalog=(id:string,file:string):unknown=>JSON.parse(fs.readFileSync(path.join(gameDirectory(id),'content',file),'utf8'));

async function main():Promise<void>{
 fs.mkdirSync(OUT,{recursive:true});const browser=await launchBrowser(),context=await browser.newContext({viewport:{width:1440,height:900}}),diagnostics=monitorContext(context,{fixtureUrls:PAGE_URLS});
 // The probe script is served first in the document, ahead of every artifact module.
 const withInit=(init:string,html:string):string=>html.replace(/<head([^>]*)>/i,match=>match+'<script>'+init+'</script>');
 let opened=0;
 const open=async(init:string,html:string):Promise<Page>=>{
  const url=PAGE_URLS[opened++];if(!url)throw Error('Every opened page needs its own fixture origin; add more PAGE_URLS');
  const page=await context.newPage();page.setDefaultTimeout(ACTION_TIMEOUT_MS);page.on('pageerror',error=>console.error('pageerror',error));
  await openArtifact(page,'runtime-optionality page',{html:withInit(init,html),url});return page;
 };
 try{
  await check('The complete colony shell signals ready once, after its public APIs and optional hosts exist',async()=>{
   const page=await open(RECORD_READY,SHOWCASE);await ready(page,'colony');
   assert.deepEqual(await value(page,'window.__readyEvents'),[{host:'colony',flag:true}]);
   assert.equal(await value(page,'typeof Littlewild.engine==="object"&&typeof WildlandsRTS.query==="function"&&typeof WildlandsPet.query==="function"'),true);
   assert.equal(await page.locator('[data-wildlands-rts=open]').textContent(),'RTS demo');
   assert.equal(await page.locator('[data-wildlands-pet=open]').textContent(),'Pet demo');
   assert.equal(await page.locator('#modal [data-act=scenarios]').textContent(),'Worlds & scenarios · import your own ↗');
   const capabilities=await value<{id:string;available:boolean}[]>(page,'Wildlands.capabilities()');
   assert(capabilities.every(entry=>entry.available),JSON.stringify(capabilities));
   assert.deepEqual(capabilities.filter(entry=>entry.id.startsWith('app:')).map(entry=>entry.id),['app:rts','app:pet']);
   await page.close();
  });
  await check('The colony shell boots, runs and signals ready without the RTS and Pet template bundles',async()=>{
   // The studio is the colony with every bundle but the template hosts; the probe keeps them absent regardless.
   const page=await open(RECORD_READY+absent(['LWRTSHost','LWPetHost']),STUDIO);await ready(page,'colony');
   assert.deepEqual(await value(page,'window.__readyEvents'),[{host:'colony',flag:true}]);
   assert.equal(await page.locator('[data-wildlands-rts], [data-wildlands-pet], #rts-mode, #pet-mode').count(),0);
   assert.equal(await value(page,'typeof window.WildlandsRTS+"/"+typeof window.WildlandsPet'),'undefined/undefined');
   assert.equal(await value(page,'Wildlands.capabilities().some(entry=>entry.id.startsWith("app:"))'),false);
   // Inspection pauses (the opening guide) are a separate policy; this check observes the colony clock itself.
   await page.locator('[data-act=begin]').click({timeout:TRANSITION_TIMEOUT_MS});await page.evaluate('Littlewild.preferences.set(false);Littlewild.engine.s.paused=false;Littlewild.refresh()');
   const before=await value<number>(page,'Littlewild.engine.s.simTime');
   await page.waitForFunction(start=>(window as unknown as {Littlewild:{engine:{s:{simTime:number}}}}).Littlewild.engine.s.simTime>start,before);
   await page.close();
  });
  await check('The colony shell boots without the scenario library, developer session, workspace and template host bundles',async()=>{
   // The studio carries no template host modules; the four other modules are removed from it exactly once each.
   for(const file of ['rts-host.js','pet-host.js'])assert(!STUDIO.includes(fs.readFileSync(path.join(GENERATED,file),'utf8')),'The studio must not inline '+file);
   const html=withoutModules(STUDIO,['developer-session.js','developer-toolbox.js','scenario-ui.js','wildlands-ui.js']);
   const page=await open(RECORD_READY,html);await ready(page,'colony');
   assert.deepEqual(await value(page,'window.__readyEvents'),[{host:'colony',flag:true}]);
   assert.equal(await value(page,'[typeof LWScenarioUI,typeof LWDeveloperSession,typeof WildlandsUI,typeof LWRTSHost,typeof LWPetHost,typeof LWDeveloper].join()'),'undefined,undefined,undefined,undefined,undefined,undefined');
   assert.equal(await value(page,'Littlewild.ui.modal'),'welcome');
   // Neither the world menu nor the welcome modal offers the absent scenario library.
   assert.equal(await page.locator('#wildlands-workspace, [data-act=scenarios], [data-wildlands-rts], [data-wildlands-pet]').count(),0);
   assert.equal(await value(page,'Littlewild.scenarioUI'),null);
   assert.match((await value<{id:string;reason?:string}[]>(page,'Wildlands.capabilities()')).find(entry=>entry.id==='project')?.reason??'',/studio bundle is not included/);
   await page.locator('[data-act=begin]').click({timeout:TRANSITION_TIMEOUT_MS});await page.evaluate('Littlewild.preferences.set(false);Littlewild.engine.s.paused=false;Littlewild.refresh()');
   const before=await value<number>(page,'Littlewild.engine.s.simTime');
   await page.waitForFunction(start=>(window as unknown as {Littlewild:{engine:{s:{simTime:number}}}}).Littlewild.engine.s.simTime>start,before);
   await page.close();
  });
  await check('Standalone RTS keeps the mission editor launcher focusable with an explicit reason when its bundle is absent',async()=>{
   const html=playOnlyPage('RTS_',['CONTENT_PROVIDER','ECS','FILES'],{LWRTSDefinitions:catalog('rts-frontier','rts.json')},'LWRTSHost.standalone();');
   const page=await open('',withoutModules(html,['rts-mission-editor-ui.js']));await ready(page,'rts');
   const button=page.locator('[data-rts-file=editor]');
   assert.equal(await button.textContent(),'Mission editor');assert.equal(await button.getAttribute('aria-disabled'),'true');
   assert.equal(await page.locator('#'+await button.getAttribute('aria-describedby')).textContent(),'The mission editor is unavailable in this build: the RTS mission editor bundle is not included.');
   await button.focus();await page.keyboard.press('Enter');
   assert.equal(await page.locator('[data-rts-file-status]').textContent(),'The mission editor is unavailable in this build: the RTS mission editor bundle is not included.');
   assert(await page.locator('#rts-demo').isVisible());assert.equal(await page.locator('[data-rts=exit]').textContent(),'Close RTS demo');
   await page.close();
  });
  await check('Scenario library keeps editor launchers focusable with explicit reasons when the editors bundle is absent',async()=>{
   const page=await open(absent(['LWSceneEditorUI','LWCreatureEditorUI','LWBalancingUI','LWStorytellingPlayer']),STUDIO);await ready(page,'colony');
   assert.equal(await value(page,'Littlewild.scenarioUI.editor===null&&Littlewild.scenarioUI.creatureEditor===null&&Littlewild.scenarioUI.storytelling===null'),true);
   await page.locator('[data-act=begin]').click({timeout:TRANSITION_TIMEOUT_MS});await page.evaluate('Littlewild.open("scenarios")');
   for(const [tool,label,name] of [['editor','Open World & Scene Editor','World & Scene Editor'],['creature-editor','Open 3D Creature Editor','3D Creature Editor'],['balancing-editor','Open balancing workshop','Balancing workshop']] as const){
    const button=page.locator(`#modal [data-scenario="${tool}"]`);
    assert.equal(await button.textContent(),label);assert.equal(await button.getAttribute('aria-disabled'),'true');
    const reason=await button.getAttribute('aria-describedby');assert(reason);
    assert.equal(await page.locator('#'+reason).textContent(),name+' is unavailable in this build: the editors bundle is not included.');
    await button.focus();assert.equal(await button.evaluate(el=>el===document.activeElement),true);
    await page.keyboard.press('Enter');assert.equal(await value(page,'Littlewild.ui.modal'),'scenarios');
    await page.locator('.toast.error',{hasText:name+' is unavailable'}).first().waitFor();
   }
   const scenes=page.locator('[data-wildlands="scenes"]');
   assert.equal(await scenes.getAttribute('aria-disabled'),'true');
   await page.evaluate('Littlewild.ui.modal&&document.querySelector("[data-act=close]")?.click()');
   assert.equal(await value(page,'Wildlands.capabilities().filter(entry=>!entry.available).map(entry=>entry.id).join()'),'editor,creature-editor,balancing-editor,storytelling');
   await page.evaluate('Littlewild.engine.s.paused=false;Littlewild.refresh()');await frames(page);await frames(page);
   await page.close();
  });
  await check('Godot and engine export show explicit capability reasons when their payloads are absent',async()=>{
   const page=await open(absent(['WildlandsGodotRuntimeLoader','LWEngineSourceLoader']),STUDIO);await ready(page,'colony');
   const exportButton=page.locator('[data-wildlands="export"]');
   assert.equal(await exportButton.getAttribute('aria-disabled'),'true');
   assert.match(await page.locator('#'+await exportButton.getAttribute('aria-describedby')).textContent()??'',/trusted Godot runtime payload is not included/);
   const capabilities=await value<{id:string;available:boolean;reason?:string}[]>(page,'Wildlands.capabilities()');
   assert.match(capabilities.find(entry=>entry.id==='godot')?.reason??'',/Godot runtime payload is not included/);
   assert.match(capabilities.find(entry=>entry.id==='engine-export')?.reason??'',/engine-source payload is not included/);
   assert.equal(await value(page,'LWDeveloper.capabilities().find(entry=>entry.id==="engineExport").available'),false);
   assert.match(await value<string>(page,'Wildlands.compileGodot(Wildlands.project()).then(()=>"compiled",error=>error.message)'),/trusted Godot runtime payload is not included/);
   await page.locator('[data-act=begin]').click({timeout:TRANSITION_TIMEOUT_MS});await page.evaluate('Littlewild.scenarioUI.editor.open(Littlewild.scenarioUI.state.packs[0])');
   const engineButton=page.locator('[data-engine-export-download]');
   assert.equal(await engineButton.getAttribute('aria-disabled'),'true');assert.equal(await engineButton.textContent(),'Export engine JSON');
   assert.match(await page.locator('#engine-export-unavailable').textContent()??'',/trusted engine-source payload is not included/);
   await page.close();
  });
  await check('Separate game storage namespaces keep saves apart on one browser origin',async()=>{
   // Two artifacts served from one origin share localStorage, exactly like sibling files opened from file://.
   const origin='https://wildlands-artifacts.invalid',shared=await browser.newContext({viewport:{width:1440,height:900}}),requests:string[]=[],errors:string[]=[];
   shared.on('page',page=>{page.on('pageerror',error=>errors.push(String(error)));page.on('request',request=>requests.push(request.url()));});
   try{
    await shared.route(origin+'/**',route=>route.fulfill({status:200,contentType:'text/html',body:route.request().url().endsWith('/office.html')?withInit("window.LWGameProfile={storage:{namespace:'wildlands.office'}};",STUDIO):STUDIO}));
    const visit=async(file:string):Promise<Page>=>{const page=await shared.newPage();page.setDefaultTimeout(ACTION_TIMEOUT_MS);await page.goto(origin+'/'+file,{waitUntil:'load',timeout:60000});await ready(page,'colony');return page;};
    const first=await visit('littlewild.html');
    await first.locator('[data-act=begin]').click({timeout:TRANSITION_TIMEOUT_MS});await first.evaluate('Littlewild.save(true)');
    const legacy=await value<string|null>(first,'localStorage.getItem("littlewild.save.v5")');assert(legacy);await first.close();
    const second=await visit('office.html');
    assert.equal(await value(second,'Littlewild.engine.s.started'),false);assert.equal(await value(second,'Littlewild.ui.modal'),'welcome');
    await second.locator('[data-act=begin]').click({timeout:TRANSITION_TIMEOUT_MS});await second.evaluate('Littlewild.save(true)');
    assert(await value<string|null>(second,'localStorage.getItem("wildlands.office.save.v5")'));
    assert.equal(await value(second,'localStorage.getItem("littlewild.save.v5")'),legacy);
    assert.deepEqual(await value(second,'Object.keys(localStorage).filter(key=>key.endsWith(".save.v5")).sort()'),['littlewild.save.v5','wildlands.office.save.v5']);
    await second.close();
    const third=await visit('littlewild.html');
    assert.equal(await value(third,'Littlewild.engine.s.started'),true);await third.close();
    assert.deepEqual(errors,[]);assert(requests.every(url=>url.startsWith(origin+'/')),requests.join(', '));
   }finally{await shared.close();}
  });
  await check('Standalone RTS page runs its own frame loop without the colony shell and signals ready',async()=>{
   const html=playOnlyPage('RTS_',['CONTENT_PROVIDER','ECS','FILES'],{LWRTSDefinitions:catalog('rts-frontier','rts.json')},'LWRTSHost.standalone();');
   const page=await open(RECORD_READY,html);await ready(page,'rts');
   assert.deepEqual(await value(page,'window.__readyEvents'),[{host:'rts',flag:true}]);
   assert.equal(await value(page,'typeof window.Littlewild+"/"+!!document.getElementById("app")'),'undefined/false');
   assert(await page.locator('#rts-demo').isVisible());
   await page.waitForFunction(()=>(window as unknown as {WildlandsRTS:{query():{tick:number}}}).WildlandsRTS.query().tick>=3);
   await page.locator('[data-rts=pause]').click();const tick=await value<number>(page,'WildlandsRTS.query().tick');
   await frames(page);assert.equal(await value(page,'WildlandsRTS.query().tick'),tick);
   await page.locator('[data-rts=exit]').click();
   const launcher=page.locator('[data-wildlands-rts=open]');
   assert.equal(await launcher.textContent(),'Open the RTS demo');assert.equal(await launcher.evaluate(el=>el===document.activeElement),true);
   await page.keyboard.press('Enter');assert(await page.locator('#rts-demo').isVisible());assert.equal(await launcher.count(),0);
   assert.equal(await value(page,'LWRTSHost.standalone()===LWRTSHost.standalone()'),true);
   await page.close();
  });
  await check('Standalone Pocket Pet page runs its own frame loop without the colony shell and signals ready',async()=>{
   const definitions=JSON.parse(fs.readFileSync(path.join(GENERATED,'pet-asset-definitions.json'),'utf8')) as unknown;
   // The pet renderer admits its own definitions through the portable asset validator; they are the whole catalog.
   const html=playOnlyPage('PET_',['CONTENT_PROVIDER','ECS','FILES','THREE','ASSET_CATALOG','ASSET_RENDERER'],{LWAssetDefinitions:definitions,LWPetDefinitions:catalog('pocket-pet','pet.json'),LWPetAssetDefinitions:definitions},'LWPetHost.standalone();');
   const page=await open(RECORD_READY,html);await ready(page,'pet');
   assert.deepEqual(await value(page,'window.__readyEvents'),[{host:'pet',flag:true}]);
   assert.equal(await value(page,'typeof window.Littlewild+"/"+!!document.getElementById("app")'),'undefined/false');
   assert(await page.locator('#pet-demo').isVisible());assert.equal(await value(page,'WildlandsPet.status().active'),true);
   await page.waitForFunction(()=>(window as unknown as {WildlandsPet:{renderer():unknown}}).WildlandsPet.renderer()!==null);
   await page.locator('#pet-demo [data-pet-action]').first().waitFor();
   assert.equal(await page.locator('[data-pet=exit]').textContent(),'Close Pocket Pet');
   await page.evaluate('WildlandsPet.close()');
   const launcher=page.locator('[data-wildlands-pet=open]');
   assert.equal(await launcher.textContent(),'Open Pocket Pet');assert.equal(await launcher.evaluate(el=>el===document.activeElement),true);
   await launcher.click();assert.equal(await value(page,'WildlandsPet.status().active'),true);
   await page.close();
  });
  await check('Optional-bundle pages generate no script errors or network requests',async()=>{assert.deepEqual(diagnostics.errors,[]);assert.deepEqual(diagnostics.requests,[]);});
 }finally{await context.close();await browser.close();}
}
main().catch(error=>{results.push({name:'Runtime optionality browser lifecycle',passed:false,error:String(error)});console.error(error);}).finally(()=>{
 const passed=results.filter(result=>result.passed).length;fs.writeFileSync(path.join(OUT,'runtime-optionality-browser-results.json'),JSON.stringify({passed,total:results.length,results},null,2)+'\n');console.log(`${passed}/${results.length} runtime optionality browser checks passed`);if(passed!==results.length)process.exitCode=1;
});
