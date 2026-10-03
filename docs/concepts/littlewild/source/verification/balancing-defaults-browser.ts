/** Real isolated build regression for canonical JSON and authored creature folder consumption. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {launchBrowser,monitorContext} from './browser-harness';
const ROOT=path.resolve(__dirname,'../..'),OUT=process.env.LITTLEWILD_BALANCING_OUT||path.join(ROOT,'verification','v15');
interface Balance {libraries:{base:{components:{items:{id:string;price:number}[];recipes:{id:string;cost:Record<string,number>}[]}}};simulation:{rules:{actor:{needs:{foodWork:number}}}};startingScenes:{initialState:{player:{coins:number}}}[];creatures:{definitions:{movement:{baseSpeed:number}}[]};}
interface Creature {id:string;name:string;visualAsset:string;state:{defaults:{archetype:string}};}
const read=<T>(file:string):T=>JSON.parse(fs.readFileSync(file,'utf8')) as T;
const write=(file:string,value:unknown):void=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
const results:{name:string;passed:boolean;error?:string}[]=[];
let diagnostics:ReturnType<typeof monitorContext>|undefined;
async function check(name:string,work:()=>Promise<void>|void):Promise<void>{try{await work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
async function main():Promise<void>{
 fs.mkdirSync(OUT,{recursive:true});const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'littlewild-balance-defaults-'));
 try{
  for(const name of ['source','vendor'])fs.cpSync(path.join(ROOT,name),path.join(temporary,name),{recursive:true});for(const name of ['package.json','tsconfig.json','tsconfig.sdk.json','tsconfig.strict.json'])fs.copyFileSync(path.join(ROOT,name),path.join(temporary,name));fs.symlinkSync(path.join(ROOT,'node_modules'),path.join(temporary,'node_modules'),'dir');
  const file=path.join(temporary,'source/content/balancing.json'),balance=read<Balance>(file);
  balance.libraries.base.components.items.find(i=>i.id==='berries')!.price=13;balance.libraries.base.components.recipes.find(i=>i.id==='planks')!.cost.wood=7;balance.simulation.rules.actor.needs.foodWork=.29;balance.startingScenes[0]!.initialState.player.coins=103;balance.creatures.definitions[0]!.movement.baseSpeed=2.3;write(file,balance);
  const folder=path.join(temporary,'source/assets/creatures/sproutling'),creature=read<Creature>(path.join(folder,'creature.json'));creature.name='Folder proof sprout';write(path.join(folder,'creature.json'),creature);
  const added=path.join(temporary,'source/assets/creatures/proofling');fs.cpSync(folder,added,{recursive:true});const asset=read<{id:string;name:string}>(path.join(added,'asset.json'));asset.id='proofling';asset.name='Added proof asset';write(path.join(added,'asset.json'),asset);creature.id='proofling';creature.name='Added proof creature';creature.visualAsset='proofling';creature.state.defaults.archetype='proofling';write(path.join(added,'creature.json'),creature);
  await check('Isolated edited canonical JSON builds with an added authored creature folder',()=>{const build=spawnSync(process.execPath,['--import','tsx','source/build.ts'],{cwd:temporary,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});assert.equal(build.status,0,build.stdout+build.stderr);});
  if(results[0]!.passed){
   const script=path.join(temporary,'proof.cjs');fs.writeFileSync(script,`const assert=require('node:assert/strict'),{toolbox}=require('./.generated/developer-sdk.cjs');const p=LWScenarios.builtins().find(p=>p.id==='littlewild'),e=LWScenarios.prepareScene(p,'first-morning').engine,c=e.creatures[0];assert.equal(LWContent.tables.RES.berries.price,13);assert.equal(LWContent.tables.RECIPES.planks.cost.wood,7);assert.equal(e.s.player.coins,103);assert.equal(LWCreatures.get('sproutling').name,'Folder proof sprout');assert.equal(LWCreatures.get('sproutling').movement.baseSpeed,2.3);assert(LWCreatures.get('proofling'));c.task={kind:'gather',phase:'work',duration:100,elapsed:0};const before=c.needs.food;e.ecs.step(c,.1,{day:e.s.day,socialPreference:0,loadLevel:0,hasShelter:true});assert(Math.abs(c.needs.food-(before-.029))<1e-9);`);
   await check('Built Node defaults use changed prices, recipes, need effects, starts and folder identities',()=>{const node=spawnSync(process.execPath,[script],{cwd:temporary,encoding:'utf8',timeout:30000,maxBuffer:1024*1024});assert.equal(node.status,0,node.stderr);});
   await check('Standalone browser defaults use the same changed values and actual native need effects',async()=>{
    const browser=await launchBrowser(),context=await browser.newContext();diagnostics=monitorContext(context);try{const page=await context.newPage();await page.setContent(fs.readFileSync(path.join(temporary,'littlewild.html'),'utf8'),{waitUntil:'load'});await page.waitForFunction(()=>!!(globalThis as unknown as {Littlewild?:unknown}).Littlewild);await page.locator('[data-act=begin]').click();
     const values=await page.evaluate(`(()=>{const p=LWScenarios.builtins().find(p=>p.id==='littlewild'),e=LWScenarios.prepareScene(p,'first-morning').engine,c=e.creatures[0],before=c.needs.food;c.task={kind:'gather',phase:'work',duration:100,elapsed:0};e.ecs.step(c,.1,{day:e.s.day,socialPreference:0,loadLevel:0,hasShelter:true});return {price:LWContent.tables.RES.berries.price,recipe:LWContent.tables.RECIPES.planks.cost.wood,coins:e.s.player.coins,name:LWCreatures.get('sproutling').name,speed:LWCreatures.get('sproutling').movement.baseSpeed,added:!!LWCreatures.get('proofling'),decay:before-c.needs.food}})()` ) as {decay:number};assert(Math.abs(values.decay-.029)<1e-9);assert.deepEqual({...values,decay:.029},{price:13,recipe:7,coins:103,name:'Folder proof sprout',speed:2.3,added:true,decay:.029});assert.deepEqual(diagnostics.errors,[]);assert.deepEqual(diagnostics.consoleProblems,[]);assert.deepEqual(diagnostics.requests,[]);
    }finally{await context.close();await browser.close();}
   });
   await check('Invalid canonical defaults fail the build without replacing the existing artifact',()=>{
    const artifact=path.join(temporary,'littlewild.html'),before=fs.readFileSync(artifact);balance.simulation.rules.actor.needs.foodWork=-1;write(file,balance);const build=spawnSync(process.execPath,['--import','tsx','source/build.ts'],{cwd:temporary,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});assert.notEqual(build.status,0);assert.deepEqual(fs.readFileSync(artifact),before);
   });
  }
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
 const report={suite:'balancing-defaults-browser',passed:results.filter(r=>r.passed).length,total:results.length,results,...diagnostics};write(path.join(OUT,'balancing-defaults-browser-results.json'),report);console.log(`${report.passed}/${report.total} canonical default build checks passed`);if(results.some(r=>!r.passed))process.exitCode=1;
}
void main().catch(error=>{console.error(error);process.exitCode=1;});
