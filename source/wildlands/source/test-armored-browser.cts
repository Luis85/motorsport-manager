/** Integrated M0 browser scenarios. Software WebGL evidence is not hardware/fidelity approval. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {ARTIFACT_FIXTURE_URL, launchBrowser, monitorContext, openArtifact, waitForReady} from './verification/browser-harness.js';

const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'verification/v15');
const ARTIFACT=path.join(ROOT,'.generated/artifacts/armored-play.html');
const results:{name:string;passed:boolean;error?:string}[]=[];
async function check(name:string,work:()=>Promise<void>):Promise<void>{
 try{console.log('RUN '+name);await work();results.push({name,passed:true});console.log('PASS '+name);}
 catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}
}
async function main():Promise<void>{
 fs.mkdirSync(OUT,{recursive:true});
 const browser=await launchBrowser(),context=await browser.newContext({viewport:{width:1440,height:900}});
 const diagnostics=monitorContext(context,{fixtureUrls:[ARTIFACT_FIXTURE_URL]});
 try{
  await check('Armored compiled styles leave other templates unchanged',async()=>{
   const styles=Array.from(fs.readFileSync(ARTIFACT,'utf8').matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi),match=>match[1]??'').filter(css=>css.includes('--ap-ink'));
   assert.equal(styles.length,1,'The compiled artifact must contain its authored stylesheet');
   const css=styles[0];assert(css);
   const probe=await context.newPage();
   try{
    await probe.setViewportSize({width:390,height:500});await probe.emulateMedia({reducedMotion:'reduce'});
    await probe.setContent('<html data-wildlands-app="colony"><head><style>html{font-family:Arial;color-scheme:light}body{margin:8px;overflow:auto;background:white;color:black}button{border-radius:5px;padding:4px}button,input,select,canvas,kbd{transition:opacity 1s}</style></head><body><button class="primary">Other game</button><input type="range"><select><option>Other world</option></select><canvas></canvas><kbd>W</kbd><div hidden>Hidden</div><div class="ap-hud">Unrelated class reuse</div></body></html>');
    const snapshot=()=>probe.evaluate(()=>Array.from(document.querySelectorAll('html,body,button,input,select,canvas,kbd,div'),element=>{
     const style=getComputedStyle(element);return Array.from(style,key=>[key,style.getPropertyValue(key)]);
    }));
    const before=await snapshot();await probe.addStyleTag({content:css});
    assert.deepEqual(await snapshot(),before,'Armored CSS must not change any computed property in another template');
    await probe.evaluate(()=>document.documentElement.dataset.wildlandsApp='armored');
    assert.notDeepEqual(await snapshot(),before,'The same compiled styles must activate for the Armored host');
   }finally{await probe.close();}
  });
  const page=await context.newPage();page.setDefaultTimeout(15000);
  await openArtifact(page,ARTIFACT);await waitForReady(page,{host:'armored',timeout:60000});
  await check('Armored compiled artifact enters a mission through briefing and renders WebGL',async()=>{
   assert(await page.locator('[data-ap-screen=menu]').isVisible());
   await page.locator('[data-ap-screen=menu] [data-ap-action=briefing]').click();
   assert(await page.locator('[data-ap-screen=briefing]').isVisible());
   await page.locator('[data-ap-action=deploy]').click();
   await page.waitForFunction(()=>(window as any).WildlandsArmored.query().tick>0,{},{timeout:45000});
   assert(await page.locator('#armored-canvas').isVisible());
   assert(await page.locator('#armored-canvas').evaluate(canvas=>!!(canvas as HTMLCanvasElement).getContext('webgl2')));
   const snapshot=await page.evaluate(()=>(window as any).WildlandsArmored.query());
   assert.equal(snapshot.format,'wildlands-armored-snapshot');assert(snapshot.vehicles.length>=2);
   await page.screenshot({path:path.join(OUT,'armored-chase.png'),timeout:30000});
  });
  await check('Armored keyboard driving applies motor intent and moves the physical chassis',async()=>{
   const before=await page.evaluate(()=>{const q=(window as any).WildlandsArmored.query();return q.vehicles.find((v:any)=>v.id===q.controlled).transform.position;});
   await page.locator('#armored-canvas').focus();await page.keyboard.down('w');
   try{
    await page.waitForFunction(start=>{const q=(window as any).WildlandsArmored.query(),v=q.vehicles.find((v:any)=>v.id===q.controlled);return Math.hypot(v.transform.position.x-start.x,v.transform.position.z-start.z)>1;},before,{timeout:60000});
   }finally{await page.keyboard.up('w');}
   const body=await page.evaluate(()=>{const q=(window as any).WildlandsArmored.query();return q.vehicles.find((v:any)=>v.id===q.controlled).body;});
   assert(Number.isFinite(body.velocity.x)&&Number.isFinite(body.velocity.z));assert(body.contacts>0);
   await page.keyboard.down('Space');
   try{await page.waitForFunction(()=>{const q=(window as any).WildlandsArmored.query();return q.vehicles.find((v:any)=>v.id===q.controlled).motor.brake>0;});}
   finally{await page.keyboard.up('Space');}
  });
  await check('Armored pause and detached inspection preserve the authoritative checkpoint',async()=>{
   await page.locator('[data-ap-action=pause]').click();
   assert.equal(await page.evaluate(()=>(window as any).WildlandsArmored.status().paused),true);
   const before=await page.evaluate(()=>JSON.stringify((window as any).WildlandsArmored.checkpoint()));
   await page.evaluate(()=>{for(let i=0;i<20;i++){const value=(window as any).WildlandsArmored.query();value.vehicles[0].transform.position.x=-9999;}return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
   assert.equal(await page.evaluate(()=>JSON.stringify((window as any).WildlandsArmored.checkpoint()))===before,true,'The complete serialized checkpoint must remain byte-identical');
   await page.locator('[data-ap-action=resume]').click();
  });
  await check('Armored gunner and binocular camera switches retain one live canvas',async()=>{
   const canvas=await page.locator('#armored-canvas').elementHandle();assert(canvas);
   for(const mode of ['gunner','binocular','chase']){
    await page.locator(`[data-ap-camera=${mode}]`).click();
    assert.equal(await canvas.evaluate(element=>element===document.querySelector('#armored-canvas')),true);
    assert.equal(await page.locator('#armored-canvas').count(),1);
    if(mode==='gunner')await page.screenshot({path:path.join(OUT,'armored-gunner.png'),timeout:30000});
   }
   await canvas.dispose();
  });
  await check('Armored keyboard fire consumes ammunition once and enters reload',async()=>{
   const before=await page.evaluate(()=>{const q=(window as any).WildlandsArmored.query(),v=q.vehicles.find((v:any)=>v.id===q.controlled);return {id:v.id,ammo:v.weapon.ammo,reserves:v.weapon.reserves[v.weapon.ammo]};});
   await page.locator('#armored-canvas').focus();await page.keyboard.down('r');
   try{await page.waitForFunction(start=>{const v=(window as any).WildlandsArmored.query().vehicles.find((v:any)=>v.id===start.id);return v.weapon.reserves[start.ammo]<start.reserves;},before,{timeout:30000});}
   finally{await page.keyboard.up('r');}
   await page.evaluate(()=>(window as any).WildlandsArmored.control('pause'));
   const after=await page.evaluate((id:string)=>(window as any).WildlandsArmored.query().vehicles.find((v:any)=>v.id===id),before.id);
   assert.equal(after.weapon.reserves[before.ammo],before.reserves-1);assert(after.weapon.reload>0);
   await page.evaluate(()=>(window as any).WildlandsArmored.control('resume'));
  });
  await check('Armored platoon handover and two-stage hold order reach the same authority',async()=>{
   const next=await page.evaluate(()=>{const q=(window as any).WildlandsArmored.query();return q.vehicles.find((v:any)=>v.faction===q.playerFaction&&v.id!==q.controlled)?.id;});
   assert(next,'Mission needs a second friendly vehicle for platoon acceptance');
   await page.locator(`[data-ap-vehicle="${next}"]`).click();
   assert.equal(await page.evaluate(()=>(window as any).WildlandsArmored.query().controlled),next);
   await page.locator('[data-ap-action=orders]').click();await page.locator('[data-ap-order=follow]').click();
   await page.locator('[data-ap-recipient=all]').click();
   const followers=await page.evaluate(()=>{const q=(window as any).WildlandsArmored.query();return q.vehicles.filter((v:any)=>v.faction===q.playerFaction&&v.id!==q.controlled).map((v:any)=>v.order.kind);});
   assert(followers.length>0);assert(followers.every((order:string)=>order==='follow'));
   await page.locator('[data-ap-action=orders]').click();await page.locator('[data-ap-order=hold]').click();
   await page.locator('[data-ap-recipient=all]').click();
   const orders=await page.evaluate(()=>{const q=(window as any).WildlandsArmored.query();return q.vehicles.filter((v:any)=>v.faction===q.playerFaction).map((v:any)=>v.order.kind);});
   assert(orders.length>=2);assert(orders.every((order:string)=>order==='hold'));
  });
  await check('Armored checkpoint replacement rejects corruption and restores complete paused state',async()=>{
   await page.evaluate(()=>(window as any).WildlandsArmored.control('pause'));
   const saved=await page.evaluate(()=>(window as any).WildlandsArmored.checkpoint());
   const before=JSON.stringify(saved);
   await page.locator('[data-ap-screen=pause] [data-ap-action=save]').click();
   assert.equal(await page.evaluate(()=>localStorage.getItem('wildlands.armored-platoon.checkpoint.v1'))===before,true,'Save control must persist the authoritative checkpoint');
   await page.evaluate(()=>localStorage.setItem('wildlands.armored-platoon.checkpoint.v1','{"version":999}'));
   await page.locator('[data-ap-screen=pause] [data-ap-action=load]').click();
   assert.equal(await page.evaluate(()=>JSON.stringify((window as any).WildlandsArmored.checkpoint()))===before,true,'Rejected browser storage load must retain the match');
   await page.evaluate(value=>localStorage.setItem('wildlands.armored-platoon.checkpoint.v1',value),before);
   await page.locator('[data-ap-screen=pause] [data-ap-action=load]').click();
   assert.equal(await page.evaluate(()=>JSON.stringify((window as any).WildlandsArmored.checkpoint()))===before,true,'UI checkpoint load must retain complete state');
   const accepted=await page.evaluate(()=>{try{const result=(window as any).WildlandsArmored.restore({format:'wildlands-armored-checkpoint',version:999});return result!==false&&result?.ok!==false;}catch{return false;}});
   assert.equal(accepted,false);
   assert.equal(await page.evaluate(()=>JSON.stringify((window as any).WildlandsArmored.checkpoint()))===before,true,'The complete serialized checkpoint must remain byte-identical');
   await page.evaluate(value=>(window as any).WildlandsArmored.restore(value),saved);
   assert.equal(await page.evaluate(()=>JSON.stringify((window as any).WildlandsArmored.checkpoint()))===before,true,'The complete serialized checkpoint must remain byte-identical');
   assert.equal(await page.evaluate(()=>(window as any).WildlandsArmored.status().paused),true);
  });
  await check('Armored desktop and compact HUD retain accessible canvas without horizontal overflow',async()=>{
   await page.evaluate(()=>(window as any).WildlandsArmored.control('resume'));
   for(const viewport of [{width:1440,height:900},{width:1024,height:768}]){
    await page.setViewportSize(viewport);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await page.locator('#armored-canvas').getAttribute('tabindex'),'0');
    assert(await page.locator('#armored-canvas').getAttribute('aria-label'));
    await page.screenshot({path:path.join(OUT,`armored-${viewport.width}.png`),timeout:30000});
   }
  });
  // Observational small-screen capture; mobile input/play support is outside this desktop M0 claim.
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(OUT,'armored-phone-observation.png'),timeout:30000});
  await check('Armored offline play completes without script errors or external requests',async()=>{
   assert.deepEqual(diagnostics.errors,[]);assert.deepEqual(diagnostics.requests,[]);
  });
 }finally{await context.close();await browser.close();}
}
main().catch(error=>{results.push({name:'Armored browser lifecycle',passed:false,error:String(error)});console.error(error);}).finally(()=>{
 const passed=results.filter(result=>result.passed).length;
 fs.mkdirSync(OUT,{recursive:true});
 fs.writeFileSync(path.join(OUT,'armored-browser-results.json'),JSON.stringify({passed,total:results.length,results},null,2)+'\n');
 console.log(`${passed}/${results.length} Armored browser checks passed`);if(passed!==results.length)process.exitCode=1;
});
