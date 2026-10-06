import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {launchBrowser,monitorContext,READY_TIMEOUT_MS} from './browser-harness';
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'verification','v15');
const results:{name:string;passed:boolean;error?:string}[]=[];
async function check(name:string,work:()=>Promise<void>):Promise<void>{try{await work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
async function main():Promise<void>{
 fs.mkdirSync(OUT,{recursive:true});const browser=await launchBrowser(),context=await browser.newContext({viewport:{width:1440,height:900}}),diagnostics=monitorContext(context);
 try{
  const page=await context.newPage();page.setDefaultTimeout(10000);
  await page.setContent(fs.readFileSync(path.join(ROOT,'littlewild.html'),'utf8'),{waitUntil:'load',timeout:30000});
  await page.waitForFunction(()=>!!(window as any).Littlewild&&!!(window as any).WildlandsRTS,null,{timeout:READY_TIMEOUT_MS});await page.locator('[data-act=begin]').click();
  await page.evaluate('Littlewild.engine.s.paused=true;Littlewild.refresh()');
  await check('RTS is discoverable and switching runs only the RTS application clock',async()=>{
   const before=await page.evaluate('JSON.stringify(Littlewild.engine.export())');
   await page.locator('[data-wildlands-rts=open]').click();assert(await page.locator('#rts-demo').isVisible());
   await page.waitForFunction(()=>(window as any).WildlandsRTS.query().tick>=3);
   assert.equal(await page.evaluate('JSON.stringify(Littlewild.engine.export())'),before);
   await page.locator('[data-rts=pause]').click();assert.equal(await page.evaluate('WildlandsRTS.status().paused'),true);
   const tick=await page.evaluate('WildlandsRTS.query().tick');
   for(let i=0;i<20;i++)await page.evaluate('WildlandsRTS.query()');
   assert.equal(await page.evaluate('WildlandsRTS.query().tick'),tick);
  });
  await check('Keyboard roster selection and battlefield order controls route into the ECS authority',async()=>{
   const disabledMove=page.locator('[data-rts=order][data-definition=move]');
   assert(await disabledMove.isDisabled());assert.equal(await disabledMove.locator('.rts-disabled-reason').textContent(),'Select your units first');
   assert((await disabledMove.getAttribute('aria-label'))?.includes('Select your units first'));
   const soldier=await page.evaluate("WildlandsRTS.query().entities.find(entity=>entity.definition==='rifleman'&&entity.faction==='alliance').id") as string;
   await page.locator('.rts-inspector details').first().evaluate(el=>(el as HTMLDetailsElement).open=true);
   await page.locator(`[data-rts=select][data-definition="${soldier}"]`).click();
   const canvas=page.locator('.rts-world');await canvas.focus();await page.keyboard.press('ArrowRight');
   assert.equal(await page.evaluate(`WildlandsRTS.query().entities.find(entity=>entity.id===${JSON.stringify(soldier)}).order`),'move');
   await page.keyboard.press('s');assert.equal(await page.evaluate(`WildlandsRTS.query().entities.find(entity=>entity.id===${JSON.stringify(soldier)}).order`),'stop');
   const before=await page.evaluate('JSON.stringify(WildlandsRTS.checkpoint())');
   assert.equal(await page.evaluate("WildlandsRTS.command({kind:'attack',faction:'alliance',entities:[],targetId:'missing'}).ok"),false);
   assert.equal(await page.evaluate('JSON.stringify(WildlandsRTS.checkpoint())'),before);
  });
  await check('Keyboard target and position form performs gather, build and ability intents without advancing time',async()=>{
   const worker=await page.evaluate("WildlandsRTS.query().entities.find(entity=>entity.definition==='worker'&&entity.faction==='alliance').id") as string;
   const deposit=await page.evaluate("WildlandsRTS.query().entities.find(entity=>entity.category==='resource').id") as string;
   const tick=await page.evaluate('WildlandsRTS.query().tick');
   await page.locator(`[data-rts=select][data-definition="${worker}"]`).focus();await page.keyboard.press('Enter');
   await page.locator('[data-rts=order][data-definition=gather]').focus();await page.keyboard.press('Enter');
   await page.locator('[data-rts-target]').selectOption(deposit);
   await page.locator('[data-rts-apply]').focus();await page.keyboard.press('Enter');
   assert.equal(await page.evaluate(`WildlandsRTS.query().entities.find(entity=>entity.id===${JSON.stringify(worker)}).order`),'gather');
   assert.equal(await page.locator('.rts-status').textContent(),'gather order accepted.');
   const hq=await page.evaluate("WildlandsRTS.query().entities.find(entity=>entity.definition==='hq'&&entity.faction==='alliance').id") as string;
   const before=await page.evaluate('JSON.stringify(WildlandsRTS.checkpoint())');
   await page.locator('[data-rts=order][data-definition=attack]').focus();await page.keyboard.press('Enter');
   await page.locator('[data-rts-target]').selectOption(hq);await page.locator('[data-rts-apply]').focus();await page.keyboard.press('Enter');
   assert.equal(await page.evaluate('JSON.stringify(WildlandsRTS.checkpoint())'),before);
   assert.equal(await page.locator('.rts-status').textContent(),'Choose a visible enemy.');
   await page.setViewportSize({width:1440,height:900});
   await page.locator('[data-rts=build][data-definition=house]').focus();await page.keyboard.press('Enter');
   await page.locator('[data-rts-target]').selectOption('');
   await page.locator('[data-rts-x]').fill('12');await page.locator('[data-rts-y]').fill('10');
   await page.locator('[data-rts-apply]').focus();await page.keyboard.press('Enter');
   assert.equal(await page.locator('.rts-status').textContent(),'Construction ordered.');
   assert(await page.evaluate("WildlandsRTS.query().entities.some(entity=>entity.definition==='house'&&entity.x===12&&entity.y===10&&entity.complete===false)"));
   const soldier=await page.evaluate("WildlandsRTS.query().entities.find(entity=>entity.definition==='rifleman'&&entity.faction==='alliance').id") as string;
   await page.locator(`[data-rts=select][data-definition="${soldier}"]`).focus();await page.keyboard.press('Enter');
   await page.locator('[data-rts=ability][data-definition=heal]').focus();await page.keyboard.press('Enter');
   await page.locator('[data-rts-target]').selectOption(soldier);await page.locator('[data-rts-apply]').focus();await page.keyboard.press('Enter');
   assert.equal(await page.locator('.rts-status').textContent(),'ability order accepted.');
   assert.equal(await page.evaluate('WildlandsRTS.query().tick'),tick);
  });
  await check('Selected production buildings expose authored training and technology commands',async()=>{
   const barracks=await page.evaluate("WildlandsRTS.query().entities.find(entity=>entity.definition==='barracks'&&entity.faction==='alliance').id") as string;
   await page.locator(`[data-rts=select][data-definition="${barracks}"]`).click();
   await page.locator('[data-rts=train][data-definition=rifleman]').click();
   assert.equal(await page.evaluate(`WildlandsRTS.query().entities.find(entity=>entity.id===${JSON.stringify(barracks)}).queue.length`),1);
   const hq=await page.evaluate("WildlandsRTS.query().entities.find(entity=>entity.definition==='hq'&&entity.faction==='alliance').id") as string;
   await page.locator(`[data-rts=select][data-definition="${hq}"]`).click();
   await page.locator('[data-rts=research][data-definition=logistics]').click();
   assert.equal(await page.evaluate(`WildlandsRTS.query().entities.find(entity=>entity.id===${JSON.stringify(hq)}).queue[0].definitionId`),'logistics');
  });
  await check('Rejected JSON imports preserve the complete running checkpoint; valid checkpoints round-trip paused',async()=>{
   const saved=await page.evaluate('WildlandsRTS.checkpoint()'),before=JSON.stringify(saved);
   await page.locator('[data-rts-import-kind]').selectOption('checkpoint');
   await page.locator('#rts-import-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"format":"wildlands-rts-checkpoint","version":999}')});
   await page.waitForFunction(()=>document.querySelector('[data-rts-file-status]')?.getAttribute('role')==='alert');
   assert.equal(await page.evaluate('JSON.stringify(WildlandsRTS.checkpoint())'),before);
   await page.locator('#rts-import-file').setInputFiles({name:'valid.json',mimeType:'application/json',buffer:Buffer.from(before)});
   await page.waitForFunction(()=>document.querySelector('[data-rts-file-status]')?.textContent?.startsWith('Imported'));
   assert.equal(await page.evaluate('JSON.stringify(WildlandsRTS.checkpoint())'),before);assert.equal(await page.evaluate('WildlandsRTS.status().paused'),true);
   await page.locator('[data-rts-import-kind]').selectOption('catalog');
   await page.locator('#rts-import-file').setInputFiles({name:'invalid-data.json',mimeType:'application/json',buffer:Buffer.from('{"script":"alert(1)"}')});
   await page.waitForFunction(()=>document.querySelector('[data-rts-file-status]')?.getAttribute('role')==='alert');
   assert.equal(await page.evaluate('JSON.stringify(WildlandsRTS.checkpoint())'),before);
  });
  await check('Isometric battlefield renders at desktop and mobile sizes with keyboard controls and no horizontal overflow',async()=>{
   for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    await page.setViewportSize(viewport);await page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    assert.equal(await page.evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
    assert.equal(await page.locator('.rts-world').getAttribute('tabindex'),'0');
    assert(await page.locator('.rts-world').getAttribute('aria-label'));
    const pixels=await page.locator('.rts-world').evaluate(canvas=>{const element=canvas as HTMLCanvasElement;return Array.from(element.getContext('2d')!.getImageData(Math.floor(element.width/2),Math.floor(element.height/2),1,1).data);});assert(pixels[3]!>0);
    await page.screenshot({path:path.join(OUT,viewport.width===390?'rts-mobile.png':'rts-desktop.png'),fullPage:true,timeout:30000});
   }
  });
  await check('Leaving RTS retires its surface, restores the invoker focus, and reopening retains a single checkpoint',async()=>{
   await page.setViewportSize({width:1440,height:900});const before=await page.evaluate('JSON.stringify(WildlandsRTS.checkpoint())');
   await page.locator('[data-rts=exit]').click();assert.equal(await page.locator('#rts-demo').count(),0);assert.equal(await page.evaluate('WildlandsRTS.status().active'),false);
   assert.equal(await page.locator('[data-wildlands-rts=open]').evaluate(el=>el===document.activeElement),true);
   await page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');assert.equal(await page.evaluate('JSON.stringify(WildlandsRTS.checkpoint())'),before);
   await page.locator('[data-wildlands-rts=open]').click();assert.equal(await page.locator('#rts-demo').count(),1);assert.equal(await page.evaluate('JSON.stringify(WildlandsRTS.checkpoint())'),before);
  });
  await check('Self-contained RTS loading and interaction generate no script errors or network requests',async()=>{assert.deepEqual(diagnostics.errors,[]);assert.deepEqual(diagnostics.requests,[]);});
 }finally{await context.close();await browser.close();}
}
main().catch(error=>{results.push({name:'RTS browser lifecycle',passed:false,error:String(error)});console.error(error);}).finally(()=>{
 const passed=results.filter(result=>result.passed).length;fs.writeFileSync(path.join(OUT,'rts-browser-results.json'),JSON.stringify({passed,total:results.length,results},null,2)+'\n');console.log(`${passed}/${results.length} RTS browser checks passed`);if(passed!==results.length)process.exitCode=1;
});
