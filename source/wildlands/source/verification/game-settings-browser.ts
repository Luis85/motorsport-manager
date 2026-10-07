import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {ACTION_TIMEOUT_MS,fixtureUrl,launchBrowser,monitorContext,openArtifact,READY_TIMEOUT_MS,TRANSITION_TIMEOUT_MS,waitForReady} from './browser-harness';

interface Settings {duels:boolean;quests:boolean;}
interface SettingsEngine {
 gameSettings():Settings;
 setGameSettings(patch:Partial<Settings>):{ok:true}|{ok:false;reason:string};
}
interface BrowserGlobals {
 Littlewild:{engine:SettingsEngine;open(modal:string):void};
 settingsIntentBackup?:SettingsEngine['setGameSettings'];
}
interface Result {name:string;passed:boolean;error?:string;}
const ROOT=path.resolve(__dirname,'../..');
// The colony play artifact carries the whole settings surface; the composite showcase adds nothing it needs.
const ARTIFACT=process.env.LITTLEWILD_GAME_SETTINGS_HTML||path.join(ROOT,'.generated/artifacts/colony-play.html');
const VIEWPORTS=[{width:1440,height:1000},{width:390,height:844}];
// Each viewport starts a fresh story: its own origin keeps the first page's saves out of the second.
const pageUrl=(viewport:{width:number}):string=>fixtureUrl('settings-'+viewport.width);
const OUT=process.env.LITTLEWILD_GAME_SETTINGS_OUT||path.join(ROOT,'verification','v15');
const results:Result[]=[];
let diagnostics:ReturnType<typeof monitorContext>;
async function check(name:string,work:()=>unknown|Promise<unknown>):Promise<void>{
 try{await work();results.push({name,passed:true});}
 catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}
}

async function main():Promise<void>{
 const browser=await launchBrowser();
 const context=await browser.newContext();
 diagnostics=monitorContext(context,{fixtureUrls:VIEWPORTS.map(pageUrl)});
 try{
  for(const viewport of VIEWPORTS){
   const page=await context.newPage();
   await page.setViewportSize(viewport);page.setDefaultTimeout(ACTION_TIMEOUT_MS);
   await openArtifact(page,ARTIFACT,{url:pageUrl(viewport)});
   await waitForReady(page,{host:'colony',timeout:READY_TIMEOUT_MS});
   await page.locator('[data-act=begin]').click({timeout:TRANSITION_TIMEOUT_MS});
   await page.evaluate(()=>(window as unknown as BrowserGlobals).Littlewild.open('settings'));

   await check('Native settings checkboxes start independently enabled at '+viewport.width+'px',async()=>{
    assert(await page.locator('#duels-setting').isChecked());
    assert(await page.locator('#quests-setting').isChecked());
    assert.equal(await page.getByRole('checkbox',{name:/^Friendly duels/}).count(),1);
    assert.equal(await page.getByRole('checkbox',{name:/^Quests/}).count(),1);
   });
   await check('Friendly duel label submits its own intent and preserves focus at '+viewport.width+'px',async()=>{
    await page.locator('label[for=duels-setting]').click();
    assert.equal(await page.locator('#duels-setting').isChecked(),false);
    assert.deepEqual(await page.evaluate(()=>(window as unknown as BrowserGlobals).Littlewild.engine.gameSettings()),{duels:false,quests:true});
    assert.equal(await page.evaluate(()=>document.activeElement?.id),'duels-setting');
   });
   await check('Quests keyboard toggle preserves the other setting and focus at '+viewport.width+'px',async()=>{
    await page.locator('#quests-setting').focus();await page.keyboard.press('Space');
    assert.equal(await page.locator('#quests-setting').isChecked(),false);
    assert.deepEqual(await page.evaluate(()=>(window as unknown as BrowserGlobals).Littlewild.engine.gameSettings()),{duels:false,quests:false});
    assert.equal(await page.evaluate(()=>document.activeElement?.id),'quests-setting');
    await page.keyboard.press('Space');
    assert(await page.locator('#quests-setting').isChecked());
    assert.equal(await page.evaluate(()=>(window as unknown as BrowserGlobals).Littlewild.engine.gameSettings().duels),false);
   });
   await check('Reopened settings retain query values, fit and readable explanations at '+viewport.width+'px',async()=>{
    await page.evaluate(()=>(window as unknown as BrowserGlobals).Littlewild.open('settings'));
    assert.equal(await page.locator('#duels-setting').isChecked(),false);
    assert(await page.locator('#quests-setting').isChecked());
    const measures=await page.locator('label[for=duels-setting],label[for=quests-setting]').evaluateAll(rows=>rows.map(row=>{
     const bounds=row.getBoundingClientRect(),input=row.querySelector('input')?.getBoundingClientRect();
     if(!input)throw Error('Missing native checkbox');
     return{left:bounds.left,right:bounds.right,height:bounds.height,inputWidth:input.width,inputRight:input.right,scroll:row.scrollWidth,client:row.clientWidth};
    }));
    assert.equal(measures.length,2);
    for(const row of measures){
     assert(row.left>=0&&row.right<=viewport.width);
     assert(row.height>=44);assert(row.inputWidth>=16);
     assert(row.inputRight<=row.right);assert(row.scroll<=row.client);
    }
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const contrasts=await page.locator('label[for=duels-setting] p,label[for=quests-setting] p').evaluateAll(elements=>{
     function channels(value:string):number[]{
      const values=value.match(/[\d.]+/g);if(!values)throw Error('Unrecognized computed color: '+value);
      return values.map(Number);
     }
     function luminance(values:number[]):number{
      const weights=[.2126,.7152,.0722];
      return values.slice(0,3).reduce((sum,value,index)=>{
       const channel=value/255,linear=channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4;
       return sum+linear*weights[index]!;
      },0);
     }
     return elements.map(element=>{
      const foreground=luminance(channels(getComputedStyle(element).color));
      let ancestor:Element|null=element;
      while(ancestor){
       const color=channels(getComputedStyle(ancestor).backgroundColor);
       if(color.length===3||color[3]===1){
        const background=luminance(color);
        return(Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05);
       }
       ancestor=ancestor.parentElement;
      }
      throw Error('Missing opaque settings surface');
     });
    });
    assert.equal(contrasts.length,2);
    for(const contrast of contrasts)assert(contrast>=4.5,'Explanation contrast '+contrast);
   });
   await check('Rejected intent fixture restores its checkbox and shows feedback at '+viewport.width+'px',async()=>{
    // Replace only the intent port to exercise rejection feedback without altering the story.
    await page.evaluate(()=>{
     const globals=window as unknown as BrowserGlobals;
     globals.settingsIntentBackup=globals.Littlewild.engine.setGameSettings;
     globals.Littlewild.engine.setGameSettings=()=>({ok:false,reason:'Review the current story first.'});
    });
    try{
     await page.locator('label[for=duels-setting]').click();
     assert.equal(await page.locator('#duels-setting').isChecked(),false);
     assert.deepEqual(await page.evaluate(()=>(window as unknown as BrowserGlobals).Littlewild.engine.gameSettings()),{duels:false,quests:true});
     assert.equal(await page.evaluate(()=>document.activeElement?.id),'duels-setting');
     assert(await page.getByText('Review the current story first.',{exact:true}).isVisible());
    }finally{
     await page.evaluate(()=>{
      const globals=window as unknown as BrowserGlobals;
      if(!globals.settingsIntentBackup)throw Error('Missing original settings intent');
      globals.Littlewild.engine.setGameSettings=globals.settingsIntentBackup;
      delete globals.settingsIntentBackup;
     });
    }
   });
   await page.keyboard.press('Tab');
   assert.equal(await page.evaluate(()=>document.activeElement?.id),'quests-setting');
   await page.locator('#duels-setting').scrollIntoViewIfNeeded();
   if(process.env.LITTLEWILD_CAPTURE_SCREENSHOTS==='1')await page.screenshot({path:path.join(OUT,'game-settings-'+viewport.width+'.png')});
   await page.close();
  }
 }catch(error){results.push({name:'Settings browser setup and capture',passed:false,error:String(error)});}
 finally{
  await context.close();await browser.close();
 }
 await check('Settings workflow has no page errors, console warnings/errors or external requests',()=>{
  assert.deepEqual(diagnostics.errors,[]);
  assert.deepEqual(diagnostics.consoleProblems,[]);
  assert.deepEqual(diagnostics.requests,[]);
 });
}

fs.mkdirSync(OUT,{recursive:true});
main().catch(error=>{results.push({name:'Settings browser execution',passed:false,error:String(error)});console.error(error);}).finally(()=>{
 const passed=results.filter(result=>result.passed).length;
 fs.writeFileSync(path.join(OUT,'game-settings-browser-results.json'),JSON.stringify({passed,total:results.length,results,...diagnostics},null,2)+'\n');
 console.log(`Settings browser: ${passed}/${results.length} passed.`);
 if(passed!==results.length)process.exitCode=1;
});
