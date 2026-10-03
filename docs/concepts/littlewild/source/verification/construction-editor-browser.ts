/// <reference path="../construction-contracts.d.ts" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {launchBrowser,monitorContext} from './browser-harness';

interface BrowserEngine {
 s:LWConstruction.World & {paused:boolean};
 creatures:LWApplication.Actor[];
 export():unknown;
 constructionOptions():LWConstruction.Options;
 buildingDesign(id:string):LWConstruction.Draft|null;
 previewBuildingDesign(input:unknown,buildingId?:string):LWConstruction.Preview;
 constructBuildingDesign(input:unknown,x:unknown,y:unknown):LWPhysicalPorts.ActionResult;
 improveBuildingDesign(id:unknown,input:unknown):LWPhysicalPorts.ActionResult;
 actor:LWApplication.Actor;
 dispatchCommand(input:unknown):LWPhysicalPorts.ActionResult;
}
interface BrowserGlobals {
 Littlewild:{engine:BrowserEngine;buildPanel:{open():void};refresh():void};
 LWConstructionEditor:{open(id?:string):boolean};
 LWConstructionGeometry:{issue(e:BrowserEngine,d:LWConstruction.Design,x:number,y:number):string|null};
 editorObserved?:{preview:LWConstruction.Preview|null;commands:unknown[]};
}
const PROJECT=path.resolve(__dirname,'../..');
const ARTIFACT=process.env.LITTLEWILD_CONSTRUCTION_HTML||path.join(PROJECT,'littlewild.html');
const OUT=process.env.LITTLEWILD_CONSTRUCTION_OUT||path.join(PROJECT,'verification','v15');
const results:{name:string;passed:boolean;error?:string}[]=[];
async function check(name:string,work:()=>Promise<void>):Promise<void>{
 try{await work();results.push({name,passed:true});}
 catch(error){results.push({name,passed:false,error:String(error)});}
}
async function main():Promise<void>{
 fs.mkdirSync(OUT,{recursive:true});
 const browser=await launchBrowser(),context=await browser.newContext(),diagnostics=monitorContext(context);
 try{
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
   const page=await context.newPage();await page.setViewportSize(viewport);page.setDefaultTimeout(7000);
   await page.setContent(fs.readFileSync(ARTIFACT,'utf8'),{waitUntil:'load'});
   await page.waitForFunction(()=>!!(window as unknown as BrowserGlobals).Littlewild);
   await page.locator('[data-act=begin]').click();
   if(!await page.evaluate(()=>(window as unknown as BrowserGlobals).Littlewild.engine.s.paused))await page.locator('#pause-button').click();
   await page.evaluate(()=>{
    const g=window as unknown as BrowserGlobals,engine=g.Littlewild.engine;
    g.editorObserved={preview:null,commands:[]};
    const preview=engine.previewBuildingDesign.bind(engine),construct=engine.constructBuildingDesign.bind(engine),improve=engine.improveBuildingDesign.bind(engine);
    engine.previewBuildingDesign=function(input,buildingId){const value=preview(input,buildingId);g.editorObserved!.preview=value;return value;};
    engine.constructBuildingDesign=function(input,x,y){g.editorObserved!.commands.push({id:'construct-design',actorId:engine.actor.id,args:[input,x,y]});return construct(input,x,y);};
    engine.improveBuildingDesign=function(id,input){g.editorObserved!.commands.push({id:'improve-design',actorId:engine.actor.id,args:[id,input]});return improve(id,input);};
    g.Littlewild.buildPanel.open();
   });
   await page.locator('[data-build=design]').click();
   await check('Draft drawing leaves world state unchanged at '+viewport.width+'px',async()=>{
    const before=await page.evaluate(()=>JSON.stringify((window as unknown as BrowserGlobals).Littlewild.engine.export()));
    await page.locator('#design-name').fill('Willow workshop');await page.locator('#design-name').press('Tab');
    await page.locator('[data-tool=window]').click();await page.locator('#design-side').selectOption('n');await page.locator('[data-cell="2,0"]').click();
    await page.locator('[data-tool=station]').click();await page.locator('[data-cell="3,3"]').click();
    await page.locator('[data-design=add]').click();
    assert.equal(await page.evaluate(()=>JSON.stringify((window as unknown as BrowserGlobals).Littlewild.engine.export())),before);
    const preview=await page.evaluate(()=>(window as unknown as BrowserGlobals).editorObserved!.preview);
    assert(preview?.ok);assert.equal(preview.design.layout.floors.length,2);
    assert(preview.design.layout.floors[0]!.stairs.some(stair=>stair.to===preview.design.layout.floors[1]!.id));
    assert(preview.design.layout.floors[1]!.stairs.some(stair=>stair.to===preview.design.layout.floors[0]!.id));
    assert(preview.cost.wood!>0);assert.equal(await page.locator('.design-cost').count(),1);
   });
   await check('Keyboard painting and cancel retain the draft at '+viewport.width+'px',async()=>{
    await page.locator('[data-tool=floor]').click();await page.locator('[data-cell="5,5"]').focus();await page.keyboard.press('Enter');
    assert.equal(await page.locator('[data-cell="5,5"]').getAttribute('class'),'design-cell  ');
    await page.keyboard.press('Escape');assert(await page.locator('#construction-editor').isHidden());
    await page.evaluate(()=>(window as unknown as BrowserGlobals).LWConstructionEditor.open());
    assert.equal(await page.locator('#design-name').inputValue(),'Willow workshop');
    assert.equal(await page.locator('[data-cell="5,5"]').getAttribute('class'),'design-cell  ');
    await page.locator('[data-cell="5,5"]').click();
   });
   await check('Designer fits and offers named focusable controls at '+viewport.width+'px',async()=>{
    const dimensions=await page.locator('#construction-editor').evaluate(element=>{const box=element.getBoundingClientRect();return {left:box.left,right:box.right,width:innerWidth,scroll:element.scrollWidth,client:element.clientWidth};});
    assert(dimensions.left>=0&&dimensions.right<=dimensions.width);assert(dimensions.scroll<=dimensions.client);
    assert.equal(await page.getByRole('button',{name:'Add floor',exact:true}).count(),1);
    await page.locator('[data-tool=station]').focus();assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-tool')),'station');
    await page.locator('[data-floor=ground]').click();
    await page.screenshot({path:path.join(OUT,`construction-editor-${viewport.width===1440?'desktop':'mobile'}.png`),fullPage:true});
   });
   await check('Actual routed construction reserves its entire footprint at '+viewport.width+'px',async()=>{
    const site=await page.evaluate(()=>{
     const g=window as unknown as BrowserGlobals,preview=g.editorObserved!.preview;if(!preview?.ok)throw Error('Expected valid draft');
     for(let y=2;y<=16;y++)for(let x=2;x<=16;x++)if(!g.LWConstructionGeometry.issue(g.Littlewild.engine,preview.design,x,y))return {x,y};
     throw Error('No valid foundation found in fresh world');
    });
    await page.locator('#design-x').fill(String(site.x));await page.locator('#design-x').press('Tab');
    await page.locator('#design-y').fill(String(site.y));await page.locator('#design-y').press('Tab');
    const before=await page.evaluate(()=>(window as unknown as BrowserGlobals).Littlewild.engine.creatures.reduce((n,a)=>n+a.orders.length,0));
    await page.locator('[data-design=submit]').click();
    assert(await page.locator('#construction-editor').isHidden());
    const after=await page.evaluate(()=>{
     const g=window as unknown as BrowserGlobals,orders=g.Littlewild.engine.creatures.flatMap(a=>a.orders) as LWConstruction.Order[],command=g.editorObserved!.commands.at(-1) as {id:string;actorId:string;args:unknown[]};
     const order=orders.find(o=>o.designId);return {orders:orders.length,command,design:order?.designId?g.Littlewild.engine.s.construction?.designs[order.designId]:null};
    });
    assert.equal(after.orders,before+1);assert.equal(after.command.id,'construct-design');assert(after.command.actorId);assert.equal(after.command.args[1],site.x);assert.equal(after.command.args[2],site.y);assert(after.design);assert.equal(after.design.footprint.length,4);
   });
   await check('Improvement protects existing stations and emits its routed command at '+viewport.width+'px',async()=>{
    const id=await page.evaluate(()=>{
     const g=window as unknown as BrowserGlobals,e=g.Littlewild.engine;
     const building=e.constructionOptions().buildings.find(b=>{const d=e.buildingDesign(b.id);return d&&e.previewBuildingDesign(d).ok;});
     if(!building)throw Error('No existing blueprint can be improved');g.LWConstructionEditor.open(building.id);return building.id;
    });
    assert(await page.locator('#design-kind').isDisabled());assert(await page.locator('#design-width').isDisabled());
    await page.locator('[data-design=add]').click();await page.locator('[data-design=submit]').click();
    const command=await page.evaluate(()=>(window as unknown as BrowserGlobals).editorObserved!.commands.at(-1)) as {id:string;args:unknown[]};
    assert.equal(command.id,'improve-design');assert.equal(command.args[0],id);
   });
   await page.close();
  }
  results.push({name:'No page errors during designer interactions',passed:diagnostics.errors.length===0,...(diagnostics.errors.length?{error:diagnostics.errors.join('\n')}:{})});
 }finally{await browser.close();}
 const report={passed:results.filter(result=>result.passed).length,total:results.length,results};fs.writeFileSync(path.join(OUT,'construction-editor-browser-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(report.passed!==report.total)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
