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
  const initialMission=await page.evaluate(()=>(window as any).WildlandsArmored.checkpoint());
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
  // Explicit bounded UI fixture: one missing round at the authored depot. Enemy
  // ammunition is empty to isolate service from combat. No progress, elapsed ticks,
  // completion event or transferred stock is injected; the application clock owns them.
  async function supplyFixture():Promise<{id:string;ammo:string;rounds:number;stocks:any;depotId:string;name:string;seconds:number}>{
   await page.setViewportSize({width:1440,height:900});
   const fixture=await page.evaluate(original=>{
    const save=structuredClone(original),state=save.entities.find((e:any)=>e.id==='armored-state').components['armored-state'];
    const mission=save.catalog.missions.find((m:any)=>m.id===save.missionId),depot=mission.supplies.find((d:any)=>d.faction===mission.playerFaction);
    const vehicle=save.entities.find((e:any)=>e.id===state.controlled).components;
    const definition=save.catalog.vehicles.find((v:any)=>v.id===vehicle['armored-identity'].definition);
    vehicle['armored-transform'].position={...depot.position,y:depot.position.y+definition.groundClearance};
    vehicle['armored-previous']=structuredClone(vehicle['armored-transform']);
    vehicle['armored-body'].velocity={x:0,y:0,z:0};vehicle['armored-body'].yawVelocity=0;
    vehicle['armored-motor']={throttle:0,steer:0,brake:1,cruise:0};
    const weapon=vehicle['armored-weapon'];weapon.reserves[weapon.ammo]--;
    for(const entity of save.entities){const c=entity.components;if(c['armored-identity']?.faction!==mission.playerFaction&&c['armored-weapon'])for(const ammo of Object.keys(c['armored-weapon'].reserves))c['armored-weapon'].reserves[ammo]=0;}
    (window as any).WildlandsArmored.restore(save);
    return {id:state.controlled,ammo:weapon.ammo,rounds:weapon.reserves[weapon.ammo],stocks:structuredClone(depot.ammunition),depotId:depot.id,name:depot.name,seconds:depot.transferSeconds};
   },initialMission);
   await page.locator('[data-ap-action=resume]').click();await page.locator('#armored-canvas').focus();await page.keyboard.down('Space');
   await page.waitForFunction(id=>{const q=(window as any).WildlandsArmored.query();return q.vehicles.find((v:any)=>v.id===id).motor.brake===1;},fixture.id);
   return fixture;
  }
  await check('Armored bounded depot fixture shows stock and progress and U cancels without transferring supplies',async()=>{
   const previous=await page.evaluate(()=>(window as any).WildlandsArmored.checkpoint());
   try{
    const fixture=await supplyFixture();
    assert(await page.locator('[data-ap-service]').isVisible());
    await page.waitForFunction(name=>document.querySelector('[data-ap-depot-name]')?.textContent?.includes(name),fixture.name);
    const stocks=await page.locator('[data-ap-supply-stocks]').innerText();
    for(const count of Object.values(fixture.stocks))assert(stocks.includes(String(count)));
    await page.locator('[data-ap-action=resupply]').click();
    await page.waitForFunction(()=>{const el=document.querySelector('[data-ap-supply-progress]');return el&&!el.hasAttribute('hidden')&&Number(el.getAttribute('aria-valuenow'))>0;});
    assert.match(await page.locator('[data-ap-action=resupply]').innerText(),/Cancel transfer/i);
    const active=await page.evaluate(id=>{const q=(window as any).WildlandsArmored.query();return q.vehicles.find((v:any)=>v.id===id).supply;},fixture.id);
    assert(active.remaining>0&&active.remaining<fixture.seconds);assert.equal(active.depotId,fixture.depotId);
    await page.locator('#armored-canvas').focus();await page.keyboard.press('u');
    await page.waitForFunction(id=>{const q=(window as any).WildlandsArmored.query();return q.vehicles.find((v:any)=>v.id===id).supply.remaining===0;},fixture.id);
    const after=await page.evaluate(()=>(window as any).WildlandsArmored.query());
    assert.equal(after.vehicles.find((v:any)=>v.id===fixture.id).weapon.reserves[fixture.ammo],fixture.rounds);
    assert.deepEqual(after.depots.find((d:any)=>d.id===fixture.depotId).ammunition,fixture.stocks);
    assert.equal(after.events.filter((e:any)=>e.kind==='resupply-cancelled'&&e.entityId===fixture.id).length,1);
    assert.equal(after.events.some((e:any)=>e.kind==='resupply-completed'),false);
    await page.waitForFunction(()=>document.querySelector('[data-ap-supply-progress]')?.hasAttribute('hidden'));
   }finally{await page.keyboard.up('Space');await page.evaluate(save=>(window as any).WildlandsArmored.restore(save),previous);}
  });
  await check('Armored bounded depot fixture completes on the application clock and conserves displayed ammunition',async()=>{
   const previous=await page.evaluate(()=>(window as any).WildlandsArmored.checkpoint());
   try{
    const fixture=await supplyFixture();await page.locator('[data-ap-action=resupply]').click();
    await page.waitForFunction(id=>(window as any).WildlandsArmored.query().events.some((e:any)=>e.kind==='resupply-completed'&&e.entityId===id),fixture.id,{timeout:90000});
    const after=await page.evaluate(()=>(window as any).WildlandsArmored.query());
    const started=after.events.find((e:any)=>e.kind==='resupply-started'&&e.entityId===fixture.id),completed=after.events.filter((e:any)=>e.kind==='resupply-completed'&&e.entityId===fixture.id);
    assert.equal(completed.length,1);assert(completed[0].tick-started.tick>=Math.ceil(fixture.seconds*60)-1);
    const vehicle=after.vehicles.find((v:any)=>v.id===fixture.id);assert.equal(vehicle.supply.remaining,0);assert.equal(vehicle.weapon.reserves[fixture.ammo],fixture.rounds+1);
    const expected={...fixture.stocks,[fixture.ammo]:fixture.stocks[fixture.ammo]-1};
    assert.deepEqual(after.depots.find((d:any)=>d.id===fixture.depotId).ammunition,expected);
    await page.waitForFunction(rounds=>document.querySelector('[data-ap-reserves]')?.textContent===String(rounds),fixture.rounds+1);
    await page.waitForFunction(()=>document.querySelector('[data-ap-feedback]')?.textContent?.includes('Supplies transferred'));
    assert((await page.locator('[data-ap-supply-stocks]').innerText()).includes(String(expected[fixture.ammo])));
    assert.match(await page.locator('[data-ap-action=resupply]').innerText(),/Resupply/i);
   }finally{await page.keyboard.up('Space');await page.evaluate(save=>(window as any).WildlandsArmored.restore(save),previous);}
  });
  // Interaction fixtures retain the installed catalog and normal application clock.
  // Only damage and enemy ammunition are staged; no input outcome is injected.
  async function interactionFixture(kind:'intact'|'destroyed-ally'|'lost-gunner'='intact'):Promise<{controlled:string;destroyed:string}> {
   await page.setViewportSize({width:1440,height:900});
   const fixture=await page.evaluate(({original,kind})=>{
    const save=structuredClone(original),state=save.entities.find((e:any)=>e.id==='armored-state').components['armored-state'];
    const mission=save.catalog.missions.find((m:any)=>m.id===save.missionId);
    const allies=save.entities.filter((e:any)=>e.components['armored-identity']?.faction===mission.playerFaction&&e.id!==state.controlled);
    let destroyed='';
    if(kind==='destroyed-ally'){
     const ally=allies[0];if(!ally)throw Error('Fixture requires an allied recipient');destroyed=ally.id;
     const damage=ally.components['armored-damage'];damage.status='destroyed';
     for(const key of Object.keys(damage.components))damage.components[key]=0;
     for(const key of Object.keys(damage.crew))damage.crew[key]=0;
    }
    if(kind==='lost-gunner'){
     const damage=save.entities.find((e:any)=>e.id===state.controlled).components['armored-damage'];
     damage.crew.gunner=0;damage.status='disabled';
    }
    for(const entity of save.entities){const c=entity.components;if(c['armored-identity']?.faction!==mission.playerFaction&&c['armored-weapon'])for(const ammo of Object.keys(c['armored-weapon'].reserves))c['armored-weapon'].reserves[ammo]=0;}
    (window as any).WildlandsArmored.restore(save);return {controlled:state.controlled,destroyed};
   },{original:initialMission,kind});
   await page.locator('[data-ap-action=resume]').click();
   await page.waitForFunction(()=>(window as any).WildlandsArmored.query().tick>0);
   return fixture;
  }
  await check('Armored HUD focus releases held motor and fire intentions',async()=>{
   const previous=await page.evaluate(()=>(window as any).WildlandsArmored.checkpoint());
   try{
    await interactionFixture();await page.locator('#armored-canvas').focus();
    await page.keyboard.down('w');await page.keyboard.down('a');await page.keyboard.press('c');
    await page.waitForFunction(()=>{const q=(window as any).WildlandsArmored.query(),v=q.vehicles.find((v:any)=>v.id===q.controlled);return v.motor.throttle===1&&v.motor.steer===1&&v.motor.cruise>0;});
    // Stage the held trigger through the public command, then move actual DOM focus
    // synchronously so no intervening simulation tick can consume the trigger.
    const release=await page.evaluate(()=>{
     const app=(window as any).WildlandsArmored,q=app.query();
     const accepted=app.command({kind:'fire',entityId:q.controlled,pressed:true});
     const before=app.query().vehicles.find((v:any)=>v.id===q.controlled);
     (document.querySelector('[data-ap-camera="gunner"]') as HTMLButtonElement).focus();
     const after=app.query().vehicles.find((v:any)=>v.id===q.controlled);
     return {accepted,before:{motor:before.motor,trigger:before.weapon.trigger},after:{motor:after.motor,trigger:after.weapon.trigger}};
    });
    assert.equal(release.accepted.ok,true);assert.equal(release.before.trigger,true);
    assert.equal(release.before.motor.throttle,1);assert.equal(release.before.motor.steer,1);assert(release.before.motor.cruise>0);
    assert.deepEqual(release.after,{motor:{throttle:0,steer:0,brake:1,cruise:0},trigger:false});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const held=await page.evaluate(()=>{const q=(window as any).WildlandsArmored.query();return q.vehicles.find((v:any)=>v.id===q.controlled);});
    assert.equal(held.motor.throttle,0);assert.equal(held.motor.steer,0);assert.equal(held.motor.cruise,0);assert.equal(held.weapon.trigger,false);
   }finally{await page.keyboard.up('w');await page.keyboard.up('a');await page.evaluate(save=>(window as any).WildlandsArmored.restore(save),previous);}
  });
  await check('Armored order keyboard journey preserves traversal recipient focus and cancellation',async()=>{
   const previous=await page.evaluate(()=>(window as any).WildlandsArmored.checkpoint());
   try{
    await interactionFixture();await page.locator('#armored-canvas').focus();await page.keyboard.press('Tab');
    assert(await page.locator('[data-ap-orders]').isVisible());
    assert.equal(await page.locator('[data-ap-action=orders]').getAttribute('aria-expanded'),'true');
    assert.equal(await page.locator('[data-ap-order=follow]').evaluate(el=>el===document.activeElement),true);
    await page.keyboard.press('Tab');
    assert(await page.locator('[data-ap-orders]').isVisible());
    assert.equal(await page.locator('[data-ap-order=hold]').evaluate(el=>el===document.activeElement),true);
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('[data-ap-recipient=all]').evaluate(el=>el===document.activeElement),true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('[data-ap-orders]').isVisible(),false);
    assert.equal(await page.locator('[data-ap-action=orders]').getAttribute('aria-expanded'),'false');
    assert.equal(await page.locator('#armored-canvas').evaluate(el=>el===document.activeElement),true);
    assert.equal(await page.evaluate(()=>(window as any).WildlandsArmored.status().paused),false);
    await page.locator('[data-ap-camera=chase]').focus();await page.keyboard.press('Tab');
    assert.equal(await page.locator('[data-ap-camera=gunner]').evaluate(el=>el===document.activeElement),true);
    assert.equal(await page.locator('[data-ap-orders]').isVisible(),false);
   }finally{await page.evaluate(save=>(window as any).WildlandsArmored.restore(save),previous);}
  });
  await check('Armored whole platoon orders exclude destroyed recipients and reach surviving allies',async()=>{
   const previous=await page.evaluate(()=>(window as any).WildlandsArmored.checkpoint());
   try{
    const fixture=await interactionFixture('destroyed-ally');
    await page.waitForFunction(id=>(document.querySelector(`[data-ap-vehicle="${id}"]`) as HTMLButtonElement)?.disabled,fixture.destroyed);
    const before=await page.evaluate(()=>(window as any).WildlandsArmored.query());
    const survivors=before.vehicles.filter((v:any)=>v.faction===before.playerFaction&&v.id!==before.controlled&&v.damage.status!=='destroyed');
    assert(survivors.length>0,'Fixture needs a surviving allied recipient');
    await page.locator('[data-ap-action=orders]').click();await page.locator('[data-ap-order=follow]').click();
    assert.equal(await page.locator(`[data-ap-recipient="${fixture.destroyed}"]`).count(),0);
    await page.locator('[data-ap-recipient=all]').click();
    const after=await page.evaluate(()=>(window as any).WildlandsArmored.query());
    for(const survivor of survivors)assert.equal(after.vehicles.find((v:any)=>v.id===survivor.id).order.kind,'follow');
    assert.deepEqual(after.vehicles.find((v:any)=>v.id===fixture.destroyed).order,before.vehicles.find((v:any)=>v.id===fixture.destroyed).order);
    assert.match(await page.locator('[data-ap-feedback]').innerText(),/FOLLOW sent to the platoon/);
   }finally{await page.evaluate(save=>(window as any).WildlandsArmored.restore(save),previous);}
  });
  await check('Armored HUD presents authoritative action reasons and selected camera state',async()=>{
   const previous=await page.evaluate(()=>(window as any).WildlandsArmored.checkpoint());
   try{
    await interactionFixture('lost-gunner');
    await page.waitForFunction(()=>document.querySelector('[data-ap-load-status]')?.textContent==='UNAVAILABLE');
    const actions=await page.evaluate(()=>{const q=(window as any).WildlandsArmored.query();return q.vehicles.find((v:any)=>v.id===q.controlled).actions;});
    assert.equal(actions.aim.available,false);assert.equal(actions.fire.available,false);assert(actions.fire.reason);
    const status=await page.locator('[data-ap-station-status]').innerText();assert(status.includes(actions.aim.reason));assert(status.includes(actions.fire.reason));
    for(const action of ['repair','resupply']){
     const button=page.locator(`[data-ap-action="${action}"]`);
     assert.equal(await button.getAttribute('aria-disabled'),String(!actions[action].available));
     if(!actions[action].available){assert.equal(await button.getAttribute('title'),actions[action].reason);await button.focus();await page.keyboard.press('Enter');assert.equal(await page.locator('[data-ap-feedback]').innerText(),actions[action].reason);}
    }
    for(const mode of ['gunner','binocular','chase']){
     await page.locator(`[data-ap-camera="${mode}"]`).click();
     const selected=page.locator('[data-ap-camera][aria-pressed="true"]');assert.equal(await selected.count(),1);assert.equal(await selected.getAttribute('data-ap-camera'),mode);
    }
   }finally{await page.evaluate(save=>(window as any).WildlandsArmored.restore(save),previous);}
  });
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
