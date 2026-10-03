import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {type Page} from 'playwright';
import {launchBrowser,monitorContext} from './browser-harness';
interface Result {name:string;passed:boolean;error?:string;}
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'verification','v15');
const SHOTS=process.env.LITTLEWILD_SCREENSHOT_DIR??path.join(ROOT,'screenshots','office');
const results:Result[]=[];fs.mkdirSync(OUT,{recursive:true});
async function check(name:string,work:()=>unknown|Promise<unknown>):Promise<void>{
 try{await work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}
}
async function shot(p:Page,name:string):Promise<void>{if(process.env.LITTLEWILD_CAPTURE_SCREENSHOTS==='1'){fs.mkdirSync(SHOTS,{recursive:true});await p.screenshot({path:path.join(SHOTS,name+'.png'),animations:'disabled'});}}
async function launchScene(p:Page,pack:string,scene:string):Promise<void>{
 await p.evaluate("Littlewild.open('scenarios')");await p.locator('[data-scenario=select]').filter({hasText:pack}).click();
 await p.locator('[data-scenario=review][data-id='+scene+']').click();
 await p.evaluate("document.querySelector('[data-scenario=launch]').click();Littlewild.engine.s.paused=true;Littlewild.refresh()");
 await p.waitForTimeout(200);
}
async function main():Promise<void>{
 const browser=await launchBrowser(),context=await browser.newContext({viewport:{width:1440,height:900}}),diagnostics=monitorContext(context);
 try{
  const p=await context.newPage();p.setDefaultTimeout(5000);
  await p.setContent(fs.readFileSync(process.env.LITTLEWILD_BROWSER_ARTIFACT??path.join(ROOT,'littlewild.html'),'utf8'),{waitUntil:'load',timeout:30000});
  await p.waitForFunction(()=>!!(window as unknown as {Littlewild?:unknown}).Littlewild);await p.locator('[data-act=begin]').click();
  await check('Office is discoverable as a reviewed authored experience with three named residents',async()=>{
   await p.evaluate("Littlewild.open('scenarios')");await p.locator('[data-scenario=select]').filter({hasText:'Office'}).click();
   assert.match(await p.locator('.scenario-library').innerText(),/Angela.*Phil.*Marty/s);
   await p.locator('[data-scenario=review][data-id=operations-shift]').click();assert.match(await p.locator('.scenario-review').innerText(),/Angela, Phil, Marty/);
   await p.evaluate("document.querySelector('[data-scenario=launch]').click();Littlewild.engine.s.paused=true;Littlewild.refresh()");await p.waitForTimeout(200);
   assert.deepEqual(await p.evaluate('Littlewild.engine.creatures.map(c=>c.name)'),['Angela','Phil','Marty']);
  });
  await check('Office guidance uses its authored four-step team workflow and exact final step',async()=>{
   assert.match(await p.locator('#world-objective-title').innerText(),/Meet the team/);assert.match(await p.locator('#world-objective-caption').innerText(),/1 \/ 4/);
   await p.evaluate("Littlewild.open('v10-guide')");assert.equal(await p.locator('#guide-step option').count(),4);
   await p.locator('#guide-step').selectOption('3');assert.match(await p.locator('#guide-panel').innerText(),/Take the whole scenario with you/);
   await p.locator('#guide-step').selectOption('0');await p.locator('[data-guide=close]').click();
  });
  await check('Office uses the authored cutaway room and all installed furniture models',async()=>{
   const stage=await p.evaluate<{environment:{mode:string};sea:boolean;atmosphere:boolean;fog:unknown;nodes:string[];fixtures:{id:string;nodes:number}[];labels:string;brand:string}>(`(()=>{const w=Littlewild.world,s=Littlewild.engine.s;return {
    environment:w.environment,sea:w.sea.visible,atmosphere:w.atmosphere.hidden,fog:w.scene.fog,
    nodes:s.nodes.map(n=>n.id),fixtures:s.buildings.map(b=>({id:b.id,nodes:LWAssets.building(b.kind).models.world.nodes.length})),
    labels:w.labels.innerText,brand:document.title
   };})()`);
   assert.equal(stage.environment.mode,'indoor');assert.equal(stage.sea,false);assert.equal(stage.atmosphere,true);assert.equal(stage.fog,null);
   assert.deepEqual(stage.nodes,['receiving-blanks','cooler','snacks']);assert.match(await p.locator('.location-title').innerText(),/Office/);
   for(const id of ['office-warehouse','office-packing','office-dispatch','office-sales','office-break'])assert(stage.fixtures.some((b:{id:string;nodes:number})=>b.id===id&&b.nodes>0));
   assert.match(stage.labels,/Angela · Operations Specialist/);assert.match(stage.labels,/Phil · Sales Rep/);assert.match(stage.labels,/Marty · Warehouse Specialist/);
  });
  await check('Authored furniture is an actual model hierarchy and both renderers preserve domain state',async()=>{
   const evidence=await p.evaluate<{nodes:number;decor:number;environmentKey:string;hash:string;unchanged:boolean;names:string[];triangles:number}>(`(()=>{
    const before=JSON.stringify(Littlewild.engine.export());const asset=LWAssets.building('study');
    const count=nodes=>nodes.reduce((n,node)=>n+1+count(node.children||[]),0);
    const canvas=document.createElement('canvas');canvas.id='office-canvas-check';canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:1000';document.body.appendChild(canvas);
    const view=new LWArt.World2D(canvas,Littlewild.engine);view.draw(1,0);window.officeCanvasCheck=view;
    Littlewild.world.invalidate();Littlewild.world.draw(1,0);
    return {nodes:count(asset.models.world.nodes),decor:view.decor.length,environmentKey:view.environmentKey,hash:LWWorldProfile.hash,unchanged:before===JSON.stringify(Littlewild.engine.export()),names:view.nameTargets.map(t=>t.id),triangles:Littlewild.world.diagnostics().triangles};
   })()`);
   assert(evidence.nodes>=6,'Office desk must use furniture components, not a relabeled outdoor building.');assert.equal(evidence.decor,0);assert.equal(evidence.environmentKey,evidence.hash);assert.equal(evidence.unchanged,true);
   assert.deepEqual(evidence.names.sort(),['c1','c2','c3']);assert(evidence.triangles>100,'The installed indoor 3D stage must render real geometry.');await p.waitForTimeout(50);const capture=await p.evaluate<{pixel:number[];colors:number;png:string}>(`(()=>{const view=officeCanvasCheck;view.draw(1,0);const pixels=view.c.getImageData(0,0,view.canvas.width,view.canvas.height).data,colors=new Set();for(let i=0;i<pixels.length;i+=64)colors.add(pixels[i]+','+pixels[i+1]+','+pixels[i+2]);return {pixel:Array.from(pixels.slice(0,4)),colors:colors.size,png:view.canvas.toDataURL()};})()`);assert.deepEqual(capture.pixel,[220,227,232,255],'The Canvas preview must retain its authored background after resize.');assert(capture.colors>20,'The Canvas preview must visibly paint the room, furniture and residents.');if(process.env.LITTLEWILD_CAPTURE_SCREENSHOTS==='1'){fs.mkdirSync(SHOTS,{recursive:true});fs.writeFileSync(path.join(SHOTS,'office-canvas-desktop.png'),Buffer.from(capture.png.split(',')[1]!, 'base64'));}
  });
  await p.evaluate("document.getElementById('office-canvas-check')?.remove()");
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   await p.setViewportSize(viewport);await p.evaluate('Littlewild.world.home();Littlewild.world.invalidate();Littlewild.refresh()');await p.waitForTimeout(200);
   await check('Office controls and authored world remain usable at '+viewport.width+'px',async()=>{
    const fit=await p.evaluate<{overflow:boolean;canvas:boolean;labels:unknown}>(`(()=>{const c=document.getElementById('world').getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,canvas:c.width>100&&c.height>200,labels:Littlewild.world.labelLayer.diagnostics()};})()`);
    assert.equal(fit.overflow,false);assert.equal(fit.canvas,true);
    assert(await p.locator('[data-act=ci-open]').first().isVisible());
    const before=await p.evaluate('JSON.stringify(Littlewild.engine.export())');await p.locator('[data-act=ci-open]').first().click();
    assert(await p.locator('#ci-source').isVisible());assert.match(await p.locator('#ci-source').innerText(),/Angela.*Phil.*Marty/s);
    assert.equal(await p.evaluate('JSON.stringify(Littlewild.engine.export())'),before);await p.keyboard.press('Escape');
   });
   await shot(p,'office-'+viewport.width);
  }
  await p.setViewportSize({width:1440,height:900});
  await check('An ordinary onsite customer call keeps Phil physically present at his sales desk',async()=>{
   // Ordinary ticks find the opportunity, travel and start the authored quest; no view teleports or task injection.
   const onsite=await p.evaluate<{quest:boolean;onsite:boolean;distance:number}>(`(()=>{const e=Littlewild.engine;e.s.paused=false;for(let i=0;i<400&&!e.creatures.find(c=>c.name==='Phil').activeQuest;i++)e.step(.1);e.s.paused=true;Littlewild.refresh();const c=e.creatures.find(c=>c.name==='Phil'),b=e.s.buildings.find(b=>b.id==='office-sales');return {quest:!!c.activeQuest,onsite:LWSceneEnvironment.onsite(e.s,c),distance:Math.hypot(c.creature.x-b.x,c.creature.y-b.y)};})()`);
   assert.equal(onsite.quest,true);assert.equal(onsite.onsite,true);assert(onsite.distance<2);
   await p.waitForTimeout(200);assert.match(await p.locator('.v10-labels').innerText(),/Phil · Sales Rep/);
   assert.equal(await p.evaluate("Littlewild.world.actors.get('c2').root.visible"),true);await shot(p,'office-sales-call');
  });
  await check('Switching Office back to Littlewild resets installed scenery and cached Canvas terrain',async()=>{
   await launchScene(p,'Littlewild','charted-home');
   const restored=await p.evaluate<{indoor:unknown;sea:boolean;atmosphere:boolean;canvasDecor:number;canvasKey:string;labels:string}>(`(()=>{const view=officeCanvasCheck;view.engine=Littlewild.engine;view.draw(2,0);return {indoor:Littlewild.world.environment,sea:Littlewild.world.sea.visible,atmosphere:Littlewild.world.atmosphere.hidden,canvasDecor:view.decor.length,canvasKey:view.environmentKey,labels:Littlewild.world.labels.innerText};})()`);
   assert.equal(restored.indoor,null);assert.equal(restored.sea,true);assert.equal(restored.atmosphere,false);assert(restored.canvasDecor>0);assert.notEqual(restored.canvasKey,undefined);
   assert.doesNotMatch(restored.labels,/Operations Specialist|Sales Rep|Warehouse Specialist/);assert.match(await p.locator('#world-objective-title').innerText(),/A buddy, not a cursor/);await p.evaluate("Littlewild.open('v10-guide')");assert.equal(await p.locator('#guide-step option').count(),11);await p.locator('[data-guide=close]').click();
   await p.evaluate('officeCanvasCheck.observer.disconnect();delete window.officeCanvasCheck');
  });
  await check('Office desktop, mobile and scenario-switch flows have no console problems or network dependencies',()=>{assert.deepEqual(diagnostics.errors,[]);assert.deepEqual(diagnostics.consoleProblems,[]);assert.deepEqual(diagnostics.requests,[]);});
 }finally{await browser.close();}
 const report={passed:results.filter(r=>r.passed).length,total:results.length,results,...diagnostics};
 fs.writeFileSync(path.join(OUT,'office-browser-results.json'),JSON.stringify(report,null,2)+'\n');console.log(report.passed+'/'+report.total+' Office browser checks passed');if(results.some(r=>!r.passed))process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
