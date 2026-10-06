import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {launchBrowser,monitorContext} from './browser-harness';
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'verification','v15');
const results:{name:string;passed:boolean;error?:string}[]=[];
async function check(name:string,work:()=>Promise<void>):Promise<void>{try{await work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
async function main():Promise<void>{
 fs.mkdirSync(OUT,{recursive:true});const browser=await launchBrowser(),context=await browser.newContext({viewport:{width:1440,height:900}}),diagnostics=monitorContext(context);
 try{
  const page=await context.newPage();page.setDefaultTimeout(15000);
  await page.setContent(fs.readFileSync(path.join(ROOT,'littlewild.html'),'utf8'),{waitUntil:'load',timeout:30000});
  await page.waitForFunction(()=>!!(window as any).Littlewild&&!!(window as any).WildlandsPet);await page.locator('[data-act=begin]').click();
  await page.evaluate('Littlewild.engine.s.paused=true;Littlewild.refresh()');
  await check('Pet demo is discoverable and runs only its own application clock',async()=>{
   const before=await page.evaluate('JSON.stringify(Littlewild.engine.export())');
   const opener=page.locator('[data-wildlands-pet=open]');await opener.focus();await page.keyboard.press('Enter');
   assert(await page.locator('#pet-demo').isVisible());
   await page.waitForFunction(()=>(window as any).WildlandsPet.query().tick>=3);
   assert.equal(await page.evaluate('JSON.stringify(Littlewild.engine.export())'),before);
   await page.locator('[data-pet=pause]').click();assert.equal(await page.evaluate('WildlandsPet.status().paused'),true);
   const tick=await page.evaluate('WildlandsPet.query().tick');for(let i=0;i<10;i++)await page.evaluate('WildlandsPet.query()');
   await page.waitForTimeout(300);assert.equal(await page.evaluate('WildlandsPet.query().tick'),tick);
  });
  await check('The 3D room renders Scene Forge pet assets through WebGL',async()=>{
   await page.waitForFunction(()=>((window as any).WildlandsPet.renderer()?.frames??0)>2);
   const stats=await page.evaluate('WildlandsPet.renderer()') as {mode:string;model:string;triangles:number};
   assert.match(stats.mode,/WebGL/);assert.equal(stats.model,'mochi/egg');assert(stats.triangles>2000,'room, bed and egg meshes are drawn');
   const pixels=await page.locator('.pet-view').screenshot();assert(pixels.length>20000,'canvas is not blank');
   await page.screenshot({path:path.join(OUT,'pet-demo-egg.png')});
  });
  await check('Disabled care actions stay focusable and explain why',async()=>{
   const meal=page.locator('[data-pet-action=meal]');
   assert.equal(await meal.getAttribute('aria-disabled'),'true');
   assert.equal(await meal.locator('.pet-disabled-reason').textContent(),'The egg can only be cuddled or cleaned');
   await meal.focus();await page.keyboard.press('Enter');
   assert.equal(await page.locator('.pet-status').textContent(),'The egg can only be cuddled or cleaned.');
   const before=await page.evaluate('JSON.stringify(WildlandsPet.checkpoint())');
   assert.equal(await page.evaluate("WildlandsPet.command({kind:'care',action:'meal'}).ok"),false);
   assert.equal(await page.evaluate('JSON.stringify(WildlandsPet.checkpoint())'),before);
  });
  await check('Keyboard care intents hatch, feed and evolve the pet over application ticks',async()=>{
   const cuddle=page.locator('[data-pet-action=cuddle]');await cuddle.focus();await page.keyboard.press('Enter');
   assert.equal(await page.locator('.pet-status').textContent(),'Cuddle started.');
   await page.locator('[data-pet=speed]').selectOption('16');await page.locator('[data-pet=pause]').click();
   await page.waitForFunction(()=>(window as any).WildlandsPet.query().pet.stage==='baby',null,{timeout:60000});
   await page.locator('[data-pet=pause]').click();await page.locator('[data-pet=speed]').selectOption('1');await page.locator('[data-pet=pause]').click();
   await page.locator('[data-pet-action=meal]').focus();await page.keyboard.press('Enter');
   assert.equal(await page.evaluate('WildlandsPet.query().activity.action'),'meal');
   await page.waitForFunction(()=>(window as any).WildlandsPet.renderer().model==='mochi/baby');
   await page.waitForFunction(()=>((window as any).WildlandsPet.renderer().props as string[]).includes('pet-bowl'));
   await page.screenshot({path:path.join(OUT,'pet-demo-baby.png')});
  });
  await check('Checkpoints export and restore through the application boundary',async()=>{
   const saved=await page.evaluate('JSON.stringify(WildlandsPet.checkpoint())') as string;
   const download=page.waitForEvent('download');await page.locator('[data-pet-file=save]').click();
   assert.equal((await download).suggestedFilename(),'wildlands-pet.checkpoint.json');
   await page.locator('[data-pet-import-kind]').selectOption('checkpoint');
   const chooser=page.waitForEvent('filechooser');await page.locator('[data-pet-file=load]').click();
   await (await chooser).setFiles({name:'pet.json',mimeType:'application/json',buffer:Buffer.from(saved)});
   await page.waitForFunction(()=>/Imported/.test(document.querySelector('[data-pet-file-status]')?.textContent??''));
   assert.equal(await page.evaluate('JSON.stringify(WildlandsPet.checkpoint())'),saved);
   assert.equal(await page.evaluate('WildlandsPet.status().paused'),true);
  });
  await check('Starting over asks first, starts on Cancel and restores focus',async()=>{
   await page.locator('#pet-demo details summary',{hasText:'Name'}).click();
   await page.locator('[data-pet=restart-ask]').click();
   assert.equal(await page.evaluate('document.activeElement?.dataset.pet'),'restart-cancel');
   await page.keyboard.press('Enter');assert.equal(await page.evaluate('document.activeElement?.dataset.pet'),'restart-ask');
   assert.equal(await page.evaluate('WildlandsPet.query().pet.stage'),'baby');
  });
  await check('Returning to the colony restores focus and stops the pet clock',async()=>{
   await page.locator('[data-pet=exit]').click();assert.equal(await page.locator('#pet-mode').isHidden(),true);
   assert.equal(await page.evaluate('document.activeElement?.dataset.wildlandsPet'),'open');
   const tick=await page.evaluate('WildlandsPet.query().tick');await page.waitForTimeout(300);
   assert.equal(await page.evaluate('WildlandsPet.query().tick'),tick);
  });
  await check('Self-contained pet loading and interaction generate no script errors or network requests',async()=>{assert.deepEqual(diagnostics.errors,[]);assert.deepEqual(diagnostics.requests,[]);});
 }finally{await context.close();await browser.close();}
}
main().catch(error=>{results.push({name:'pet browser harness',passed:false,error:String(error)});}).finally(()=>{
 const passed=results.filter(r=>r.passed).length;fs.writeFileSync(path.join(OUT,'pet-browser-results.json'),JSON.stringify({passed,total:results.length,results},null,2));
 console.log(passed+'/'+results.length);if(passed!==results.length||!results.length)process.exitCode=1;
});
