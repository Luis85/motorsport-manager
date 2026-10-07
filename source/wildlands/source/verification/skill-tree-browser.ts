import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {launchBrowser,monitorContext,READY_TIMEOUT_MS,waitForReady} from './browser-harness';
interface Globals {
 Littlewild:{open(id:string):void;engine:{s:{paused:boolean};actor:{id:string;creature:{level:number}};
  skillTreeState(id:string):LWSkillTrees.View[];attachSkillTree(id:string,definition:LWSkillTrees.Definition):{ok:boolean};grantSkillTreeXp(id:string,n:number):{ok:boolean};export():unknown}};
}
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'verification/v15');
const results:{name:string;passed:boolean;error?:string}[]=[];
async function check(name:string,work:()=>Promise<void>):Promise<void>{try{await work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
async function main():Promise<void>{
 fs.mkdirSync(OUT,{recursive:true});const browser=await launchBrowser(),context=await browser.newContext(),diagnostics=monitorContext(context);
 try{
  for(const viewport of[{width:1440,height:1000},{width:390,height:844}]){
   const page=await context.newPage();await page.setViewportSize(viewport);page.setDefaultTimeout(5000);
   await page.setContent(fs.readFileSync(path.join(ROOT,'.generated/artifacts/showcase.html'),'utf8'),{waitUntil:'load',timeout:30000});
   await waitForReady(page,{timeout:READY_TIMEOUT_MS});
   await page.locator('[data-act=begin]').click();await page.evaluate(()=>(window as unknown as Globals).Littlewild.open('training'));
   await page.locator('[data-act=v3-learn-tab][data-id=trees]').click();
   await check('Fresh tree displays earned-point gates at '+viewport.width+'px',async()=>{
    assert(await page.locator('.skill-tree-summary').innerText().then(t=>t.includes('0 points available')));
    assert(await page.locator('[data-skill-node=roots] button').isDisabled());
    assert.equal(await page.locator('.skill-tree-node').count(),5);
   });
   // Synthetic XP fixture isolates the actual unlock intent, focus, ranks and branch state.
   await page.evaluate(()=>{const e=(window as unknown as Globals).Littlewild.engine;e.s.paused=true;e.actor.creature.level=2;assertFixture(e.grantSkillTreeXp(e.actor.id,100).ok);function assertFixture(value:boolean){if(!value)throw Error('XP fixture failed');}});
   await page.evaluate(()=>(window as unknown as Globals).Littlewild.open('training'));
   await check('Keyboard unlock publishes a rank and keeps focus at '+viewport.width+'px',async()=>{
    const button=page.locator('[data-skill-node=roots] button');await button.focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>{const e=(window as unknown as Globals).Littlewild.engine;return e.skillTreeState(e.actor.id)[0]?.nodes[0]?.rank===1;});
    await page.waitForFunction(()=>document.activeElement?.getAttribute('data-skill-node')==='roots');
    assert(await page.locator('[data-skill-node=maker] button').isEnabled());
   });
   await check('Branch choice closes the alternative without spending its points at '+viewport.width+'px',async()=>{
    await page.locator('[data-skill-node=maker] button').click();
    assert(await page.locator('[data-skill-node=learner] button').isDisabled());
    assert((await page.locator('[data-skill-node=learner]').innerText()).includes('Another path in this branch is already chosen.'));
    const tree=await page.evaluate(()=>{const e=(window as unknown as Globals).Littlewild.engine;return e.skillTreeState(e.actor.id)[0]!;});
    assert.equal(tree.points,3);assert.equal(tree.nodes.find(n=>n.id==='learner')?.rank,0);
   });
   await check('Tree reads do not tick or change saved state at '+viewport.width+'px',async()=>{
    assert(await page.evaluate(()=>{const e=(window as unknown as Globals).Littlewild.engine,before=JSON.stringify(e.export());e.skillTreeState(e.actor.id);return before===JSON.stringify(e.export());}));
   });
   await check('Tree content fits and retains usable controls at '+viewport.width+'px',async()=>{
    await page.screenshot({path:path.join(OUT,'skill-tree-'+viewport.width+'.png'),fullPage:true});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const nodes=await page.locator('.skill-tree-node').evaluateAll(nodes=>nodes.map(n=>({scroll:n.scrollWidth,client:n.clientWidth,left:n.getBoundingClientRect().left,right:n.getBoundingClientRect().right,height:n.querySelector('button')!.getBoundingClientRect().height})));
    for(const node of nodes){assert(node.scroll<=node.client);assert(node.left>=0&&node.right<=viewport.width);assert(node.height>=44);}
    await page.screenshot({path:path.join(OUT,'skill-tree-'+viewport.width+'.png'),fullPage:true});
   });
   await check('Keyboard focus distinguishes trees sharing a node ID at '+viewport.width+'px',async()=>{
    await page.evaluate(()=>{
     const e=(window as unknown as Globals).Littlewild.engine;
     const definition:LWSkillTrees.Definition={version:1,id:'another-tree',name:'Another tree',description:'Keyboard regression fixture',xpPerPoint:20,nodes:[{id:'roots',name:'Another root',description:'One rank',cost:1,maxRank:1,minimumLevel:1,requires:[],effects:{workSpeed:.05}}]};
     if(!e.attachSkillTree(e.actor.id,definition).ok||!e.grantSkillTreeXp(e.actor.id,20).ok)throw Error('Second-tree fixture failed');
     (window as unknown as Globals).Littlewild.open('training');
    });
    const node=page.locator('[data-skill-tree=another-tree][data-skill-node=roots]');await node.locator('button').focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.activeElement?.getAttribute('data-skill-tree')==='another-tree'&&document.activeElement?.getAttribute('data-skill-node')==='roots');
    assert(await node.locator('button').isDisabled());
   });
   await page.close();
  }
  await check('Skill-tree browser emits no runtime errors or network requests',async()=>{assert.deepEqual(diagnostics.errors,[]);assert.deepEqual(diagnostics.consoleProblems,[]);assert.deepEqual(diagnostics.requests,[]);});
 }finally{await context.close();await browser.close();}
 const passed=results.filter(r=>r.passed).length;fs.writeFileSync(path.join(OUT,'skill-tree-browser-results.json'),JSON.stringify({passed,total:results.length,results},null,2)+'\n');console.log(`${passed}/${results.length} skill-tree browser checks passed`);if(passed!==results.length)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
