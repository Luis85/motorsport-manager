/// <reference path="../storytelling-data-contracts.d.ts" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type {Page} from 'playwright';
import {launchBrowser,monitorContext,READY_TIMEOUT_MS,waitForReady} from './browser-harness';
const ROOT=path.resolve(__dirname,'../..'),ARTIFACT=process.env.LITTLEWILD_BROWSER_ARTIFACT||path.join(ROOT,'littlewild.html'),OUT=process.env.LITTLEWILD_STORYTELLING_PLAYER_OUT||path.join(ROOT,'verification/v15');
const results:{name:string;passed:boolean;error?:string}[]=[];
async function test(name:string,work:()=>Promise<void>):Promise<void>{try{await work();results.push({name,passed:true});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
const native=(page:Page):Promise<string>=>page.evaluate('JSON.stringify(Littlewild.engine.export().state)') as Promise<string>;
async function setup(page:Page,gated=false,cueSwitch=false):Promise<void>{
 await page.setContent(fs.readFileSync(ARTIFACT,'utf8'),{waitUntil:'load',timeout:30000});await waitForReady(page,{timeout:READY_TIMEOUT_MS});await page.locator('[data-act=begin]').click();await page.evaluate('Littlewild.engine.s.paused=true;Littlewild.open("scenarios")');await page.locator('[data-scenario=editor]').click();
 await page.evaluate(({blocked,cueSwitch})=>{
  const root=window as unknown as {Littlewild:{scenarioUI:{editor:{session:LWSceneEditor.Session}};open(type:string):void}};
  const editor=root.Littlewild.scenarioUI.editor,pack=editor.session.snapshot(),first=pack.scenes[0]!;
  for(const scene of pack.scenes)delete scene.initialState.scenarioResources;
  first.initialState.paused=false;
  first.graph={kind:'level',rendering:{dimension:'3d',rendererId:'basic'},events:[{type:'play-cutscene',cutsceneId:'player-opening',once:true}],connections:[{id:'player-next',label:'Across worlds',targetSceneId:'player-remote',...(blocked?{requirements:[{type:'player-level' as const,minimum:100}]}:{})}]};
  pack.worlds.push({...structuredClone(pack.worlds[0]!),id:'player-world',name:'Story destination world'});
  pack.scenes.push({...structuredClone(first),id:'player-remote',name:'Story destination',worldId:'player-world',graph:{kind:'level',rendering:{dimension:'2d',rendererId:'basic'},connections:[{id:'player-back',label:'Return to first scene',targetSceneId:first.id}]}});
  const actor=editor.session.entities(first.id).find(entity=>entity.category==='creatures')!;
  pack.storytelling={version:1,storyboards:[],cutscenes:[{id:'player-opening',name:'Opening journey',sceneId:first.id,duration:4,skipPolicy:'finish',events:cueSwitch?[{id:'player-switch',time:1,event:{type:'scene-switch',connectionId:'player-next'}}]:[{id:'player-message',time:1,event:{type:'message',text:'A timed story cue before completion'}},{id:'player-pause',time:2,event:{type:'pause',paused:true}}],tracks:[{id:'player-motion',target:{category:'creatures',id:actor.id},property:'x',keyframes:[{time:0,value:actor.x},{time:4,value:actor.x+2}]}],onFinish:cueSwitch?[]:[{type:'scene-switch',connectionId:'player-next'}]},{id:'player-return',name:'Return journey',sceneId:'player-remote',duration:1,tracks:[],skipPolicy:'finish',onFinish:[{type:'scene-switch',connectionId:'player-back'}]}]};
  editor.session.replace(pack);root.Littlewild.open('scene-editor');
 },{blocked:gated,cueSwitch});
 await page.locator('[data-scene-editor=review]').click();await page.locator('[data-scenario=launch]').click();
}
async function main():Promise<void>{
 fs.mkdirSync(OUT,{recursive:true});const browser=await launchBrowser(),context=await browser.newContext({acceptDownloads:true}),diagnostics=monitorContext(context);
 try{
  const page=await context.newPage();page.setDefaultTimeout(20000);await page.setViewportSize({width:1440,height:1000});await setup(page);
  await test('Reviewed native launch plays the scene entry cutscene with a native simulation pause lease',async()=>{
   await page.waitForFunction(()=>{const root=window as unknown as {Littlewild:{scenarioUI:{storytelling:{isPresenting():boolean}}}};return root.Littlewild.scenarioUI.storytelling.isPresenting();});
   const before=await native(page);await page.waitForTimeout(600);assert.equal(await native(page),before,'Cinematic RAF must not advance native state or RNG.');
   assert.equal(await page.evaluate('Littlewild.engine.s.paused'),false,'Presentation preserves the native manual pause setting.');
  });
  await test('Timed message and pause cues execute during playback before completion review',async()=>{
   await page.locator('.toast').filter({hasText:'A timed story cue before completion'}).waitFor();assert.equal(await page.locator('[data-storytelling-player=accept]').count(),0);assert.equal(await page.evaluate('Littlewild.scenarioUI.storytelling.isPresenting()'),true);await page.waitForFunction(()=>{const root=window as unknown as {Littlewild:{engine:{s:{paused:boolean}}}};return root.Littlewild.engine.s.paused;});assert.equal(await page.locator('[data-storytelling-player=accept]').count(),0);
  });
  await test('Completion requests a Cancel-focused cross-world review; Cancel retains the active checkpoint',async()=>{
   await page.locator('[data-storytelling-player=cancel]').waitFor();assert.equal(await page.evaluate(()=>(document.activeElement as HTMLElement).dataset.storytellingPlayer),'cancel');const before=await native(page),scene=await page.evaluate('Littlewild.engine.scenarioContext.sceneId');await page.locator('[data-storytelling-player=cancel]').click();assert.equal(await page.evaluate('Littlewild.engine.scenarioContext.sceneId'),scene);assert.equal(await native(page),before);assert.equal(await page.locator('[data-storytelling-player=accept]').count(),0);
  });
  await test('Explicit Replay reopens the same reviewed connection and acceptance enters its other world',async()=>{
   await page.evaluate('Littlewild.world.manual=true;Object.assign(Littlewild.world.camera,{x:123,y:-77,z:1.7});Littlewild.world.invalidate()');await page.locator('[data-storytelling-player=replay]').click();await page.locator('[data-storytelling-player=skip]').click();await page.locator('[data-storytelling-player=cancel]').waitFor();await page.locator('[data-storytelling-player=accept]').click();await page.waitForFunction(()=>{const root=window as unknown as {Littlewild:{engine:{scenarioContext:{sceneId:string}}}};return root.Littlewild.engine.scenarioContext.sceneId==='player-remote';});assert.equal(await page.evaluate('Littlewild.engine.scenarioContext.worldId'),'player-world');const captured=await page.evaluate('LWScenarios.capture(Littlewild.engine)') as LWContentPorts.ScenarioPack;assert(captured.storytelling?.progress?.once.some(id=>id.endsWith('|player-opening')),JSON.stringify(captured.storytelling?.progress));assert(captured.storytelling?.progress?.completed.some(id=>id.endsWith('|player-opening')));
  });
  await test('Camera revisit is retained within one journey and reset when a new same-pack story starts',async()=>{
   const travelBack=async()=>{await page.evaluate('Littlewild.open("scenarios")');await page.locator('[data-storytelling-player=play][data-id=player-return]').click();await page.locator('[data-storytelling-player=skip]').click();await page.locator('[data-storytelling-player=cancel]').waitFor();await page.locator('[data-storytelling-player=accept]').click();};
   await travelBack();assert.deepEqual(await page.evaluate('({...Littlewild.world.camera})'),{x:123,y:-77,z:1.7},'Ordinary cinematic revisits keep their journey camera.');
   await page.evaluate('Littlewild.open("scenarios")');await page.locator('[data-scenario=editor]').click();await page.locator('[data-scene-editor=select-scene][data-id=player-remote]').click();await page.locator('[data-scene-editor=review]').click();await page.locator('[data-scenario=launch]').click();await travelBack();assert.notDeepEqual(await page.evaluate('({...Littlewild.world.camera})'),{x:123,y:-77,z:1.7},'A new same-pack story must not recover an old journey camera.');
  });
  await page.close();
  const gated=await context.newPage();gated.setDefaultTimeout(20000);await setup(gated,true);
  await test('Scene event entry requirements reject a cross-world request without adopting the destination',async()=>{
   await gated.evaluate('Littlewild.open("scenarios")');await gated.locator('[data-storytelling-player=skip]').click();assert.notEqual(await gated.evaluate('Littlewild.engine.scenarioContext.sceneId'),'player-remote');assert.equal(await gated.locator('[data-storytelling-player=accept]').count(),0);await gated.evaluate('Littlewild.open("scenarios")');assert(await gated.locator('[data-scenario=transition][data-id=player-next]').isDisabled());assert((await gated.locator('.scenario-connections').filter({has:gated.locator('[data-scenario=transition]')}).textContent())?.includes('100'));
  });
  await gated.close();
  const timed=await context.newPage();timed.setDefaultTimeout(20000);await setup(timed,false,true);
  await test('A timed scene-switch cue interrupts presentation with reviewed admission; Cancel preserves native state',async()=>{
   await timed.locator('[data-storytelling-player=cancel]').waitFor();const before=await native(timed),source=await timed.evaluate('Littlewild.engine.scenarioContext.sceneId');assert.equal(await timed.evaluate(()=>(document.activeElement as HTMLElement).dataset.storytellingPlayer),'cancel');await timed.locator('[data-storytelling-player=cancel]').click();assert.equal(await native(timed),before);assert.equal(await timed.evaluate('Littlewild.engine.scenarioContext.sceneId'),source);await timed.locator('[data-storytelling-player=resume]').click();assert.equal(await timed.locator('[data-storytelling-player=accept]').count(),0);
  });
  await timed.close();
 }finally{await context.close();await browser.close();}
 await test('Native storytelling browser proof has no page/console errors or external requests',async()=>{assert.deepEqual(diagnostics.errors,[]);assert.deepEqual(diagnostics.consoleProblems,[]);assert.deepEqual(diagnostics.requests,[]);});
 fs.writeFileSync(path.join(OUT,'storytelling-player-browser-results.json'),JSON.stringify({suite:'storytelling-player-browser',passed:results.filter(r=>r.passed).length,total:results.length,results,diagnostics},null,2)+'\n');
}
main().catch(error=>{results.push({name:'Native storytelling browser setup',passed:false,error:String(error)});console.error(error);}).finally(()=>{console.log(`Native storytelling browser: ${results.filter(r=>r.passed).length}/${results.length} passed.`);if(results.some(r=>!r.passed))process.exitCode=1;});
