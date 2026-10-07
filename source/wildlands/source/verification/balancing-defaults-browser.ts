/** Real isolated build regression for canonical JSON and authored creature folder consumption. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {launchBrowser,monitorContext,READY_TIMEOUT_MS,waitForReady} from './browser-harness';
import {gameDirectory} from '../tools/game-folder.cjs';
const ROOT=path.resolve(__dirname,'../..'),OUT=process.env.LITTLEWILD_BALANCING_OUT||path.join(ROOT,'verification','v15');
interface Balance {libraries:{base:{components:{items:{id:string;price:number}[];recipes:{id:string;cost:Record<string,number>}[]}}};simulation:{rules:{actor:{needs:{foodWork:number}}}};startingScenes:{initialState:{player:{coins:number}}}[];creatures:{definitions:{movement:{baseSpeed:number}}[]};}
interface Creature {id:string;name:string;visualAsset:string;movement:{baseSpeed:number};state:{defaults:{archetype:string}};}
interface Definition {id:string;creature:Creature;visual:{id:string;name:string};}
const read=<T>(file:string):T=>JSON.parse(fs.readFileSync(file,'utf8')) as T;
const write=(file:string,value:unknown):void=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
const results:{name:string;passed:boolean;error?:string}[]=[];
let diagnostics:ReturnType<typeof monitorContext>|undefined;
async function check(name:string,work:()=>Promise<void>|void):Promise<void>{try{await work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
async function main():Promise<void>{
 fs.mkdirSync(OUT,{recursive:true});const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'littlewild-balance-defaults-'));
 try{
  for(const name of ['source','vendor'])fs.cpSync(path.join(ROOT,name),path.join(temporary,name),{recursive:true});for(const name of ['package.json','tsconfig.json','tsconfig.sdk.json','tsconfig.strict.json'])fs.copyFileSync(path.join(ROOT,name),path.join(temporary,name));fs.symlinkSync(path.join(ROOT,'node_modules'),path.join(temporary,'node_modules'),'dir');
  // The Littlewild game folder is copied beside the isolated project and selected with WILDLANDS_GAMES_DIR.
  const games=path.join(temporary,'games');fs.cpSync(gameDirectory('littlewild'),path.join(games,'littlewild'),{recursive:true});const env={...process.env,WILDLANDS_GAMES_DIR:games};
  const file=path.join(games,'littlewild/content/balancing.json'),balance=read<Balance>(file);
  balance.simulation.rules.actor.needs.foodWork=.29;balance.startingScenes[0]!.initialState.player.coins=103;write(file,balance);
  const itemFile=path.join(games,'littlewild/assets/items/berries/definition.json'),item=read<{item:{price:number}}>(itemFile);item.item.price=13;write(itemFile,item);
  const recipeFile=path.join(games,'littlewild/assets/items/planks/definition.json'),recipe=read<{recipe:{cost:{wood:number}}}>(recipeFile);recipe.recipe.cost.wood=7;write(recipeFile,recipe);
  const newItemFolder=path.join(games,'littlewild/assets/items/proof_plank');fs.cpSync(path.join(games,'littlewild/assets/items/planks'),newItemFolder,{recursive:true});
  const newItemFile=path.join(newItemFolder,'definition.json'),newItem=read<{id:string;item:{id:string};visual:{id:string};recipe:{id:string;output:string}}>(newItemFile);newItem.id='proof_plank';newItem.item.id=newItem.visual.id=newItem.recipe.id=newItem.recipe.output=newItem.id;write(newItemFile,newItem);
  const folder=path.join(games,'littlewild/assets/creatures/sproutling'),definitionFile=path.join(folder,'definition.json'),definition=read<Definition>(definitionFile),creature=definition.creature;
  creature.name='Folder proof sprout';creature.movement.baseSpeed=2.3;write(definitionFile,definition);
  const added=path.join(games,'littlewild/assets/creatures/proofling');fs.cpSync(folder,added,{recursive:true});definition.id='proofling';definition.visual.id='proofling';definition.visual.name='Added proof asset';creature.id='proofling';creature.name='Added proof creature';creature.visualAsset='proofling';creature.state.defaults.archetype='proofling';write(path.join(added,'definition.json'),definition);
  await check('Isolated edited canonical JSON builds with an added authored creature folder',()=>{const build=spawnSync(process.execPath,['--import','tsx','source/build.ts'],{cwd:temporary,env,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});assert.equal(build.status,0,build.stdout+build.stderr);});
  if(results[0]!.passed){
   const script=path.join(temporary,'proof.cjs');fs.writeFileSync(script,`const assert=require('node:assert/strict'),{toolbox}=require('./.generated/developer-sdk.cjs');const p=LWScenarios.builtins().find(p=>p.id==='littlewild'),e=LWScenarios.prepareScene(p,'first-morning').engine,c=e.creatures[0];assert.equal(LWContent.tables.RES.berries.price,13);assert.equal(LWContent.tables.RECIPES.planks.cost.wood,7);assert.equal(e.s.player.coins,103);assert.equal(LWCreatures.get('sproutling').name,'Folder proof sprout');assert.equal(LWCreatures.get('sproutling').movement.baseSpeed,2.3);assert(LWCreatures.get('proofling'));assert(LWContent.tables.RES.proof_plank);assert(LWAssets.item('proof_plank'));const office=LWScenarios.builtins().find(p=>p.id==='office'),beforeContext=LWContent.fingerprint(LWContent.registry.current);assert.throws(()=>LWScenarios.withLibraries(office.libraries,()=>{assert(!LWContent.tables.RES.proof_plank);throw Error('scope-proof');}),/scope-proof/);assert.equal(LWContent.fingerprint(LWContent.registry.current),beforeContext);assert(LWContent.tables.RES.proof_plank);c.task={kind:'gather',phase:'work',duration:100,elapsed:0};const before=c.needs.food;e.ecs.step(c,.1,{day:e.s.day,socialPreference:0,loadLevel:0,hasShelter:true});assert(Math.abs(c.needs.food-(before-.029))<1e-9);`);
   await check('Built Node defaults use changed prices, recipes, need effects, starts and folder identities',()=>{const node=spawnSync(process.execPath,[script],{cwd:temporary,encoding:'utf8',timeout:30000,maxBuffer:1024*1024});assert.equal(node.status,0,node.stderr);});
   await check('Standalone browser defaults use the same changed values and actual native need effects',async()=>{
    const browser=await launchBrowser(),context=await browser.newContext();diagnostics=monitorContext(context);try{const page=await context.newPage();await page.setContent(fs.readFileSync(path.join(temporary,'littlewild.html'),'utf8'),{waitUntil:'load'});await waitForReady(page,{timeout:READY_TIMEOUT_MS});await page.locator('[data-act=begin]').click();
     const values=await page.evaluate(`(()=>{const p=LWScenarios.builtins().find(p=>p.id==='littlewild'),e=LWScenarios.prepareScene(p,'first-morning').engine,c=e.creatures[0],before=c.needs.food;c.task={kind:'gather',phase:'work',duration:100,elapsed:0};e.ecs.step(c,.1,{day:e.s.day,socialPreference:0,loadLevel:0,hasShelter:true});return {price:LWContent.tables.RES.berries.price,recipe:LWContent.tables.RECIPES.planks.cost.wood,coins:e.s.player.coins,name:LWCreatures.get('sproutling').name,speed:LWCreatures.get('sproutling').movement.baseSpeed,added:!!LWCreatures.get('proofling'),addedItem:!!LWContent.tables.RES.proof_plank&&!!LWAssets.item('proof_plank'),decay:before-c.needs.food}})()` ) as {decay:number};assert(Math.abs(values.decay-.029)<1e-9);assert.deepEqual({...values,decay:.029},{price:13,recipe:7,coins:103,name:'Folder proof sprout',speed:2.3,added:true,addedItem:true,decay:.029});assert.deepEqual(diagnostics.errors,[]);assert.deepEqual(diagnostics.consoleProblems,[]);assert.deepEqual(diagnostics.requests,[]);
    }finally{await context.close();await browser.close();}
   });
   await check('Invalid canonical defaults fail the build without replacing the existing artifact',()=>{
    const artifact=path.join(temporary,'littlewild.html'),before=fs.readFileSync(artifact);balance.simulation.rules.actor.needs.foodWork=-1;write(file,balance);const build=spawnSync(process.execPath,['--import','tsx','source/build.ts'],{cwd:temporary,env,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});assert.notEqual(build.status,0);assert.deepEqual(fs.readFileSync(artifact),before);
   });
  }
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
 const report={suite:'balancing-defaults-browser',passed:results.filter(r=>r.passed).length,total:results.length,results,...diagnostics};write(path.join(OUT,'balancing-defaults-browser-results.json'),report);console.log(`${report.passed}/${report.total} canonical default build checks passed`);if(results.some(r=>!r.passed))process.exitCode=1;
}
void main().catch(error=>{console.error(error);process.exitCode=1;});
