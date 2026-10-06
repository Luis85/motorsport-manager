/// <reference path="../balancing-tools-contracts.d.ts" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type {Page} from 'playwright';
import {launchBrowser,monitorContext,READY_TIMEOUT_MS,waitForReady} from './browser-harness';
const ROOT=path.resolve(__dirname,'../..'),ARTIFACT=process.env.LITTLEWILD_BROWSER_ARTIFACT||path.join(ROOT,'littlewild.html'),OUT=process.env.LITTLEWILD_BALANCING_OUT||path.join(ROOT,'verification','v15');
const results:{name:string;passed:boolean;error?:string}[]=[];
const touchTargets:{state:string;controls:{label:string;width:number;height:number}[]}[]=[];
async function mobileControls(page:Page,state:string):Promise<void>{
 const controls=await page.locator('.modal button.btn,.modal .v13-live-strip button,.modal [data-act=close-modal]').evaluateAll(buttons=>buttons.map(button=>{const box=button.getBoundingClientRect();return {label:button.getAttribute('aria-label')||button.textContent?.trim()||'',width:box.width,height:box.height};}).filter(box=>box.width>0&&box.height>0));
 touchTargets.push({state,controls});assert(controls.length>0);for(const control of controls)assert(control.width>=44&&control.height>=44,JSON.stringify(control));
}
async function check(name:string,work:()=>Promise<void>):Promise<void>{try{await work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
async function main():Promise<void>{
 fs.mkdirSync(OUT,{recursive:true});const browser=await launchBrowser(),context=await browser.newContext(),diagnostics=monitorContext(context);
 try{for(const width of [1440,390]){
  const page=await context.newPage();page.setDefaultTimeout(7000);await page.setViewportSize({width,height:width===1440?1000:844});await page.setContent(fs.readFileSync(ARTIFACT,'utf8'),{waitUntil:'load',timeout:30000});await waitForReady(page,{timeout:READY_TIMEOUT_MS});await page.locator('[data-act=begin]').click();await page.evaluate('Littlewild.engine.s.paused=true');
  const original=await page.evaluate('JSON.stringify(Littlewild.engine.export())');await page.evaluate('Littlewild.open("scenarios")');await page.locator('[data-scenario=balancing-editor]').click();
  await check('A delayed real JSON import cannot replace a newer numeric draft at '+width+'px',async()=>{
   const imported=await page.evaluate('(()=>{const pack=LWScenarios.capture(Littlewild.engine),draft=LWBalancing.capture(pack);draft.simulation.rules.gameplay.task.quietJoy=7;if(!LWBalancing.validate(draft,pack).ok)throw Error("The race fixture must be valid balancing JSON.");return JSON.stringify(draft);})()') as string;
   await page.evaluate('window.__balanceOriginalText=File.prototype.text;File.prototype.text=function(){const selected=this;return new Promise((resolve,reject)=>{window.__releaseBalanceImport=()=>window.__balanceOriginalText.call(selected).then(resolve,reject);});};');
   try{
    await page.locator('#balancing-import-file').setInputFiles({name:'delayed-balancing.json',mimeType:'application/json',buffer:Buffer.from(imported)});await page.waitForFunction('typeof window.__releaseBalanceImport==="function"');
    await page.locator('[name=quietJoy]').fill('13');await page.getByRole('button',{name:'Save values to draft',exact:true}).click();assert.equal(await page.locator('[name=quietJoy]').inputValue(),'13');
    await page.evaluate('window.__releaseBalanceImport()');assert.equal(await page.locator('[name=quietJoy]').inputValue(),'13');assert.equal(await page.evaluate('JSON.stringify(Littlewild.engine.export())'),original);
   }finally{await page.evaluate('File.prototype.text=window.__balanceOriginalText;delete window.__balanceOriginalText;delete window.__releaseBalanceImport;');}
  });
  await check('Protected balancing draft, numeric edit and change review at '+width+'px',async()=>{
   if(width===390){await mobileControls(page,'workshop');for(const navigation of await page.locator('.modal .workspace-nav,.modal .v6-workspace-context').all())assert.equal(await navigation.isVisible(),false);}
   assert(await page.getByRole('heading',{name:'Balancing workshop',exact:true}).isVisible());await page.locator('[name=quietJoy]').fill('13');await page.getByRole('button',{name:'Save values to draft',exact:true}).click();await page.locator('[data-balancing=review]').click();assert((await page.locator('[aria-label="Balance review"]').innerText()).includes('quietJoy'));assert.equal(await page.evaluate('JSON.stringify(Littlewild.engine.export())'),original);assert(await page.evaluate('document.documentElement.scrollWidth<=innerWidth'));
  });
  await check('Real seeded metric table preserves live state at '+width+'px',async()=>{
   await page.locator('[data-balancing=probe]').click();assert(await page.locator('[aria-label="Balance probe results"]').isVisible());assert.equal(await page.evaluate('JSON.stringify(Littlewild.engine.export())'),original);if(width===390)await mobileControls(page,'comparison');await page.locator('[aria-label="Balance probe results"]').scrollIntoViewIfNeeded();if(process.env.LITTLEWILD_CAPTURE_SCREENSHOTS==='1')await page.screenshot({path:path.join(OUT,'balancing-'+width+'-metrics.png')});
  });
  await check('Reviewed scene defaults to Cancel and preserves protected draft at '+width+'px',async()=>{
   await page.locator('[data-balancing=apply]').click();assert.equal(await page.evaluate('document.activeElement.dataset.scenario'),'cancel');if(width===390)await mobileControls(page,'complete-scene review');if(process.env.LITTLEWILD_CAPTURE_SCREENSHOTS==='1')await page.screenshot({path:path.join(OUT,'balancing-'+width+'-review.png')});await page.locator('[data-scenario=cancel]').click();assert(await page.getByRole('heading',{name:'Balancing workshop',exact:true}).isVisible());assert.equal(await page.evaluate('JSON.stringify(Littlewild.engine.export())'),original);await page.locator('[name=quietJoy]').scrollIntoViewIfNeeded();if(process.env.LITTLEWILD_CAPTURE_SCREENSHOTS==='1')await page.screenshot({path:path.join(OUT,'balancing-'+width+'-fields.png')});
  });await page.close();
 }
 await check('Standalone balancing has no browser errors or network requests',async()=>{assert.deepEqual(diagnostics.errors,[]);assert.deepEqual(diagnostics.consoleProblems,[]);assert.deepEqual(diagnostics.requests,[]);});
 }finally{await context.close();await browser.close();}
 const report={suite:'balancing-browser',passed:results.filter(r=>r.passed).length,total:results.length,results,diagnostics,touchTargets};fs.writeFileSync(path.join(OUT,'balancing-browser-results.json'),JSON.stringify(report,null,2)+'\n');console.log(`${report.passed}/${report.total} balancing browser checks passed`);if(results.some(r=>!r.passed))process.exitCode=1;
}
void main().catch(error=>{console.error(error);process.exitCode=1;});
