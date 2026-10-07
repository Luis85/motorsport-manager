import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {launchBrowser,monitorContext,READY_TIMEOUT_MS,waitForReady} from './browser-harness';
interface Result {name:string;passed:boolean;error?:string;}
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'verification','v15');
const results:Result[]=[];fs.mkdirSync(OUT,{recursive:true});
async function check(name:string,work:()=>unknown|Promise<unknown>):Promise<void>{
 try{await work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}
}
async function main():Promise<void>{
 const browser=await launchBrowser(),context=await browser.newContext({viewport:{width:1440,height:900}}),diagnostics=monitorContext(context);
 try{
  const p=await context.newPage();p.setDefaultTimeout(5000);
  await p.setContent(fs.readFileSync(process.env.LITTLEWILD_BROWSER_ARTIFACT??path.join(ROOT,'.generated/artifacts/showcase.html'),'utf8'),{waitUntil:'load',timeout:30000});
  await waitForReady(p,{timeout:READY_TIMEOUT_MS});await p.locator('[data-act=begin]').click();
  await p.evaluate("Littlewild.open('scenarios')");await p.locator('[data-scenario=review][data-id=charted-home]').click();
  // Pause synchronously with scene installation, before the first decision frame.
  await p.evaluate("document.querySelector('[data-scenario=launch]').click();Littlewild.engine.s.paused=true;Littlewild.refresh()");
  await check('Player can discover the interaction workspace and named initiators',async()=>{
   await p.locator('[data-act=ci-open]').first().click();
   assert(await p.locator('#ci-source').isVisible());assert.match(await p.locator('#modal').innerText(),/Choose a shared moment/);
   assert.equal(await p.locator('#ci-source option').count(),4);
  });
  await check('Guide care intent targets the chosen creature through the shared command authority',async()=>{
   await p.locator('#ci-target').selectOption('c1');const food=await p.evaluate('Littlewild.engine.creatures[0].needs.food');
   await p.locator('[data-act=ci-request][data-id=care-feed]').click();
   assert((await p.evaluate('Littlewild.engine.creatures[0].needs.food') as number)>(food as number));
   assert.match(await p.locator('#ci-feedback').innerText(),/completed/);
  });
  await check('Creature invitations expose pending consent and then run seeded rounds autonomously',async()=>{
   await p.locator('#ci-source').selectOption('c1');await p.locator('#ci-target').selectOption('c2');
   const seekButton=await p.locator('[data-act=ci-seek-duel]').elementHandle();assert(seekButton);await p.waitForTimeout(120);assert(await seekButton.evaluate(el=>el.isConnected),'Unchanged interaction buttons must remain mounted across frame refreshes.');
   await p.locator('[data-act=ci-seek-duel]').click();assert.match(await p.locator('#ci-status').innerText(),/looking for a partner/);
   assert.equal(await p.evaluate('Littlewild.engine.interactionState().active.length'),0);
   await p.locator('[data-act=ci-cancel-duel-seek]').click();assert.equal(await p.evaluate('Littlewild.engine.interactionState().seeks.length'),0);
   await p.locator('[data-act=ci-stage-duel]').click();
   assert.match(await p.locator('#ci-status').innerText(),/Awaiting response/);
   const before=await p.evaluate('JSON.stringify(Littlewild.engine.export())');
   await p.evaluate('Littlewild.advance(10)');assert.equal(await p.evaluate('JSON.stringify(Littlewild.engine.export())'),before);
   await p.evaluate('Littlewild.engine.s.paused=false;Littlewild.advance(3.2);Littlewild.engine.s.paused=true;Littlewild.refresh()');
   assert.match(await p.locator('#ci-status').innerText(),/In progress.*Round 1/s);
   assert.match(await p.locator('#ci-status').innerText(),/End duel/);
   await p.locator('[data-ci-rounds] summary').click();assert.match(await p.locator('#ci-status').innerText(),/target|vs|margin/);
  });
  await check('Portable active-duel restore continues the same real browser rolls and settlement',async()=>{
   const equivalent=await p.evaluate(`(()=>{
    const checkpoint=Littlewild.snapshot();
    Littlewild.engine.s.paused=false;Littlewild.engine.advance(12);Littlewild.engine.s.paused=true;
    const expected=JSON.stringify(Littlewild.engine.export());
    const restored=LWStory.commit(LWStory.inspect(checkpoint));Littlewild.setEngine(restored);
    Littlewild.engine.s.paused=false;Littlewild.engine.advance(12);Littlewild.engine.s.paused=true;Littlewild.refresh();
    return expected===JSON.stringify(Littlewild.engine.export());
   })()`);
   assert.equal(equivalent,true);assert.match(await p.locator('#ci-status').innerText(),/Completed/);
  });
  await check('Creature world-object selection delegates exact-node gathering with no remote grant',async()=>{
   // The portable checkpoint is now registered in the library; admit a fresh authored pack for this independent flow.
   await p.evaluate("Littlewild.open('scenarios')");
   const fresh=await p.evaluate("LWScenarios.builtins().find(pack=>pack.id==='littlewild')");
   await p.locator('#scenario-import-file').setInputFiles({name:'fresh-littlewild.pack.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fresh))});
   await p.locator('#toasts .toast').filter({hasText:'Pack validated. Review a scene before starting it.'}).waitFor();
   await p.locator('[data-scenario=review][data-id=charted-home]').click();
   await p.evaluate("document.querySelector('[data-scenario=launch]').click();Littlewild.engine.s.paused=true;Littlewild.open('v10-interactions');Littlewild.refresh()");
   await p.locator('#ci-source').selectOption('c1');await p.locator('#ci-scope').selectOption('node');
   const node=await p.evaluate("Littlewild.engine.s.nodes.find(n=>n.kind==='wood'&&!Littlewild.engine.s.buildings.some(b=>b.x===n.x&&b.y===n.y)).id") as string;
   await p.locator('#ci-target').selectOption(node);const before=await p.evaluate('JSON.stringify(Littlewild.engine.creatures[0].inventory)');
   await p.locator('[data-act=ci-request][data-id=gather-at-node]').click();
   assert.equal(await p.evaluate('JSON.stringify(Littlewild.engine.creatures[0].inventory)'),before);
   assert.equal(await p.evaluate('Littlewild.engine.creatures[0].task.nodeId'),node);
   await p.locator('#ci-scope').selectOption('building');assert(await p.locator('#ci-target option').count()>0);
  });
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   await p.setViewportSize(viewport);await p.evaluate("Littlewild.open('v10-interactions')");
   await check('Interaction selectors fit and retain 44px targets at '+viewport.width+'px',async()=>{
    const fits=await p.evaluate("Array.from(document.querySelectorAll('.ci-selectors select')).every(el=>el.getBoundingClientRect().height>=44&&el.getBoundingClientRect().width<=document.getElementById('modal').clientWidth)&&document.documentElement.scrollWidth<=innerWidth");assert.equal(fits,true);
   });
   if(process.env.LITTLEWILD_CAPTURE_SCREENSHOTS==='1'){
    const shots=path.join(ROOT,'screenshots','interactions');fs.mkdirSync(shots,{recursive:true});await p.screenshot({path:path.join(shots,'interactions-'+viewport.width+'.png'),animations:'disabled'});
   }
  }
  await check('Interaction flows have no uncaught errors, console problems or external requests',()=>{assert.deepEqual(diagnostics.errors,[]);assert.deepEqual(diagnostics.consoleProblems,[]);assert.deepEqual(diagnostics.requests,[]);});
 }finally{await browser.close();}
 const report={passed:results.filter(r=>r.passed).length,total:results.length,results,...diagnostics};
 fs.writeFileSync(path.join(OUT,'interactions-browser-results.json'),JSON.stringify(report,null,2)+'\n');console.log(report.passed+'/'+report.total+' browser interaction checks passed');if(results.some(r=>!r.passed))process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
