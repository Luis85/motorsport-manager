// Tests run the composite showcase game: install its content profile before any engine module loads.
import './test-support/install-games.cjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import { analyzeRuntime, resolveRuntimeDependency, physicalCodeLines } from './tools/architecture-analysis.cjs';

const Production = require('./world-production.js');
const Tasks = require('./world-tasks.js');
const Geography = require('./island-geometry.js');
const root = globalThis as unknown as { LWWorldProfile: { current: { placementPolicy: string; fixedSites: Array<{ kind: string; x: number; y: number }> }; withProfile<T>(profile: unknown, work: () => T): T } };
const results: Array<{ name: string; passed: boolean; error?: string }> = [];
function test(name: string, work: () => void): void {
  try { work(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error instanceof Error ? error.message : String(error) }); }
}
const analyze = (text: string) => analyzeRuntime('fixture.ts', text);

for (const [name, code] of [
  ['ES import', "import value from './world-ui.js';"],
  ['ES export', "export {value} from './world-ui.js';"],
  ['TS import equals', "import ui = require('./world-ui.js');"],
  ['dynamic import literal', "import('./world-ui.js');"],
  ['require comments', "require /* edge */ ('./world-ui.js');"],
  ['require alias', "const load=require; load('./world-ui.js');"],
  ['module.require alias', "const load=module.require; load('./world-ui.js');"],
  ['global require', "globalThis.require('./world-ui.js');"]
]) test('Architecture detects ' + name, () => assert.deepEqual(analyze(code!).dependencies, ['./world-ui.js']));
for (const code of ["require(target);", "import(target);", "const load=require; load(target);", "require.call(null,target);"]) {
  test('Architecture rejects unresolved edge: ' + code, () => assert(analyze(code).dependencies.includes(null)));
}
for (const code of [
  "globalThis['LWUI'].show();", "const environment=globalThis; environment.LWUI.show();",
  "const {LWUI: view}=globalThis; view.show();", "(function(env){env.LWUI.show();})(globalThis);",
  "const first=second; const second=third; const third=globalThis; first.LWUI.show();"
]) test('Architecture finds global through alias: ' + code, () => assert(analyze(code).globals.some(entry => entry.name === 'LWUI')));
test('Architecture resolves a long comma-declared ambient alias chain', () => {
  const aliases=Array.from({length:12},(_,index)=>'alias'+index+'='+(index===11?'globalThis':'alias'+(index+1)));
  assert(analyze('const '+aliases.join(',')+'; alias0.LWUI.show();').globals.some(entry=>entry.name==='LWUI'));
});
test('Architecture finds bracket exports', () => assert.deepEqual(analyze("root['LWUI']={};").globals, [{ name: 'LWUI', write: true }]));
test('Architecture rejects computed ambient globals', () => assert.equal(analyze('const env=globalThis; env[key].run();').dynamicGlobals, 1));
for (const code of [
  'Date();', 'const Clock=Date; Clock();', 'const Clock=globalThis.Date; Clock();',
  'const {Date: Clock}=globalThis; Clock();', '(function(Clock){Clock();})(Date);',
  'const env=globalThis; env["Date"]();', 'const Clock=Date; new Clock();',
  'new globalThis.Date();', 'Date.call(null);', 'const clock=Date; clock.apply(null,[]);',
  'Math ["random"] ();', 'const now=Date.now; now();', 'const {now}=performance; now();',
  'const env=globalThis; env.document.body;', 'new Date();', 'crypto["getRandomValues"](buffer);'
]) test('Architecture detects platform alias: ' + code, () => assert(analyze(code).platform.length > 0));
test('Architecture permits deterministic Date parsers and explicit UTC conversion',()=>{
 assert.deepEqual(analyze("Date.parse('2026-01-01'); Date.UTC(2026,0,1);").platform,[]);
});
test('Architecture ignores comments strings and erased contracts', () => {
  const analysis=analyze("// require('./world-ui.js') document.body\nconst message='Math.random()'; interface Port {document:string;} type Sample=any;");
  assert.deepEqual(analysis.dependencies,[]);assert.deepEqual(analysis.globals,[]);assert.deepEqual(analysis.platform,[]);
});
test('Architecture resolves runtime paths without basename collisions or escapes', () => {
  const owned=new Set(['world-ui.ts','engine.ts','simulation.cts']);
  assert.equal(resolveRuntimeDependency('engine.ts','./world-ui.js',owned),'world-ui.ts');
  assert.equal(resolveRuntimeDependency('engine.ts','./world-ui',owned),'world-ui.ts');
  assert.equal(resolveRuntimeDependency('engine.ts','./simulation.cjs',owned),'simulation.cts');
  assert.equal(resolveRuntimeDependency('engine.ts','./nested/world-ui.js',owned),null);
  assert.equal(resolveRuntimeDependency('engine.ts','../world-ui.js',owned),null);
});
test('Architecture catches composition accessed with brackets', () => assert(analyze("const composition=root.LW['EngineComposition']; composition.register({});").composition.includes('EngineComposition')));

test('The actual architecture policy rejects asset-catalog DOM/platform and presentation dependencies',()=>{
 const project=path.resolve(__dirname,'..'),fixture=fs.mkdtempSync(path.join(os.tmpdir(),'littlewild-asset-policy-'));
 interface PolicyResult {passed:number;total:number;results:{name:string;passed:boolean;error?:string}[];}
 try{
  // Run the real checker against an isolated source tree and its actual ownership map.
  fs.cpSync(path.join(project,'source'),path.join(fixture,'source'),{recursive:true});
  fs.copyFileSync(path.join(project,'tsconfig.strict.json'),path.join(fixture,'tsconfig.strict.json'));
  fs.symlinkSync(path.join(project,'node_modules'),path.join(fixture,'node_modules'),'junction');
  const tools=path.join(fixture,'.generated','tools');fs.mkdirSync(tools,{recursive:true});
  const checkerFiles=['architecture-check.cjs','architecture-analysis.cjs','architecture-data.cjs','architecture-contracts.cjs',
   'definition-source.cjs','bundled-content.cjs','bundled-assets.cjs','bundled-library-schema.cjs','artifact-profiles.cjs','build-inserts.cjs',
   'game-folder.cjs','game-manifest.cjs'];
  for(const file of checkerFiles)fs.copyFileSync(path.join(__dirname,'tools',file),path.join(tools,file));
  // game-folder.cjs requires the compiled engine schemas (content/*.schema.json) relative to itself.
  fs.cpSync(path.join(__dirname,'content'),path.join(fixture,'.generated','content'),{recursive:true});
  const map=JSON.parse(fs.readFileSync(path.join(fixture,'source','architecture','domain-map.json'),'utf8')) as {contexts:{layer:string;files:string[]}[]};
  assert.equal(map.contexts.find(context=>context.files.includes('asset-catalog.ts'))?.layer,'domain');
  const run=():{status:number|null;report:PolicyResult}=>{
   // The isolated tree has no repository around it: point it at the real game folders.
   const process=spawnSync(globalThis.process.execPath,[path.join(tools,'architecture-check.cjs')],{cwd:fixture,encoding:'utf8',timeout:15000,env:{...globalThis.process.env,WILDLANDS_GAMES_DIR:(require('./tools/game-folder.cjs') as typeof import('./tools/game-folder.cjs')).gamesRoot()}});
   assert.ifError(process.error);assert.equal(process.signal,null,process.stderr);
   return {status:process.status,report:JSON.parse(fs.readFileSync(path.join(fixture,'.generated','typescript-architecture-results.json'),'utf8')) as PolicyResult};
  };
  const baseline=run();assert.equal(baseline.status,0);assert.equal(baseline.report.passed,baseline.report.total);
  const catalog=path.join(fixture,'source','asset-catalog.ts'),original=fs.readFileSync(catalog,'utf8');
  for(const [injection,reason] of [
   ['const device=globalThis; device.document.body; device.fetch("/asset");','asset-catalog.ts: platform/nondeterministic API'],
   ['require("./world-ui.js");','asset-catalog.ts -> world-ui.ts (presentation)'],
   ['globalThis.LWSceneEnvironment.current();','asset-catalog.ts (domain) -> LWSceneEnvironment / scene-environment.ts (presentation)']
  ]){
   fs.writeFileSync(catalog,original+'\n'+injection+'\n');const failure=run();
   assert.equal(failure.status,1);assert(failure.report.results.some(result=>!result.passed&&result.error?.includes(reason!)),JSON.stringify(failure.report));
   assert(failure.report.results.find(result=>result.name==='DDD domain map owns every runtime module exactly once')?.passed);
  }
 }finally{fs.rmSync(fixture,{recursive:true,force:true});}
});

test('Physical code accounting excludes trivia and preserves runtime string lines', () => {
  assert.equal(physicalCodeLines('fixture.ts','// header\n/* prose\n * prose */\n\n'),0);
  assert.equal(physicalCodeLines('fixture.ts','const a=1; // comment\n\nconst b=2;'),2);
  assert.equal(physicalCodeLines('fixture.ts','const text=`first\n\n// runtime text\nlast`;'),4);
  assert.equal(physicalCodeLines('fixture.ts','interface Port {\n  value: string;\n}'),3);
  assert.equal(physicalCodeLines('fixture.ts','const a=1; /* prose\nprose */ const b=2;'),2);
});

const recipe={id:'planks',output:'planks',cost:{wood:2},amount:1,time:5,skill:'woodwork',kind:'craft',depletion:0};
function productionFixture() {
  const building={kind:'bench',x:9,y:9,level:1,storage:{input:{wood:2},output:{},enabled:true,job:null,requests:{planks:1},targets:{}}};
  const queries={creatures:[{id:'c1',name:'Fern',skills:{woodwork:true},activeQuest:null}],originatingOrder:()=>null,
    nodeAt:()=>null,nodeAvailable:()=>false,buildingRecipes:()=>[recipe],demandStock:()=>0,substrateIssue:()=>null,
    remaining:()=>0,capacity:()=>10,skillName:()=> 'Woodwork',itemName:()=> 'Wood'};
  return {building,queries,profile:{inputCapacity:10,outputCapacity:10}};
}
test('Production recipes preserve craft equipment and substrate definition order', () => {
  const p={inputCapacity:5,outputCapacity:6,production:{output:'water',cost:{},amount:2,seconds:3,skill:'care',depletion:0}};
  const definitions={a:{station:'bench',cost:{wood:1},amount:1,time:4,skill:'woodwork'},ignored:{station:'kiln',cost:{},amount:1,time:2,skill:'fire'}};
  const equipment=[{id:'axe',recipe:{station:'bench',cost:{wood:2},time:6,skill:'woodwork'}}];
  const before=JSON.stringify({definitions,equipment,p});
  assert.deepEqual(Production.recipes({kind:'bench'},definitions,equipment,p).map((r:{id:string})=>r.id),['a','axe','water']);
  assert.equal(JSON.stringify({definitions,equipment,p}),before);
});
test('Production capacity preserves independent level gains and unknown defaults', () => {
  assert.equal(Production.capacity({level:3},'input',{inputCapacity:7,outputCapacity:9}),15);
  assert.equal(Production.capacity({level:3},'output',{inputCapacity:7,outputCapacity:9}),21);
  assert.equal(Production.capacity({},'input',null),0);
});
test('Production status is observational and distinguishes ready supply pause and skill', () => {
  const f=productionFixture(),before=JSON.stringify(f);
  assert.equal(Production.status(f.queries,f.building,f.profile).kind,'ready');
  assert.equal(JSON.stringify(f),before);
  f.building.storage.input.wood=0;
  assert.equal(Production.status(f.queries,f.building,f.profile).kind,'supply');
  f.queries.creatures[0]!.skills.woodwork=false;
  assert.equal(Production.status(f.queries,f.building,f.profile).label,'Needs a skilled creature');
  f.building.storage.enabled=false;
  assert.equal(Production.status(f.queries,f.building,f.profile).label,'Paused');
});
test('Production status retains interrupted paid job and plan precedence', () => {
  const f=productionFixture(),job={recipe:'planks',workerId:'c1',progress:2,duration:5};
  const building={...f.building,storage:{...f.building.storage,job}};
  assert.equal(Production.status(f.queries,building,f.profile).detail,'Fern · 40% of this attempt.');
  assert.equal(Production.status({...f.queries,originatingOrder:()=>({paused:true})},building,f.profile).label,'Plan paused');
  assert.equal(Production.status({...f.queries,creatures:[]},building,f.profile).label,'Waiting for a creature');
});
test('Production status preserves substrate and full output precedence', () => {
  const f=productionFixture(),profile={...f.profile,requiresNode:'ore'};
  assert.equal(Production.status(f.queries,f.building,profile).label,'Missing required node');
  assert.equal(Production.status({...f.queries,nodeAt:()=>({kind:'ore',stock:0})},f.building,profile).label,'Node exhausted');
  const building={...f.building,storage:{...f.building.storage,output:{planks:10}}};
  assert.equal(Production.status(f.queries,building,f.profile).label,'Output full');
});
test('Physical transfer proposals are detached and retain optional supply intents', () => {
  const building={id:'bench1',x:4,y:5},before=JSON.stringify(building);
  const task=Tasks.transfer('stockbuilding',building,'wood',0,null,{item:'Wood',building:'Workbench'},{recipeId:'planks'});
  assert.equal(task.amount,1);assert.equal(task.recipeId,'planks');assert.equal(task.label,'Bringing wood to workbench');
  assert.equal(task.duration,require('./balancing-rules.js').defaults.production.transferSeconds);
  assert.equal(Tasks.transfer('stockbuilding',building,'wood',1,null,{item:'Wood',building:'Workbench'},{},9).duration,9);
  task.target.x=10;assert.equal(JSON.stringify(building),before);
});
test('Physical production proposals preserve paid progress and newly proposed duration', () => {
  const building={id:'bench1',x:4,y:5},recipe={kind:'produce',output:'planks',time:5},names={item:'Planks',building:'Workbench'};
  const job={id:'paid1',duration:7,progress:3};
  const task=Tasks.work(building,recipe,job,'order1',names);
  assert.equal(task.duration,7);assert.equal(task.elapsed,3);assert.equal(task.jobId,'paid1');
  assert.equal(task.label,'Tending planks · Workbench');assert.equal(job.progress,3);
  assert.equal(Tasks.work(building,recipe,null,null,names).duration,5);
});
test('Topology keeps bridge ownership separate from terrain', () => {
  const initial={estate:{islands:[{ix:0,iy:0}]},nodes:[],buildings:[]};
  assert.equal(Geography.terrain(20,9),'grass');assert.equal(Geography.available(initial,20,9),false);
  const expanded={...initial,estate:{islands:[{ix:0,iy:0},{ix:1,iy:0}]}};
  assert.equal(Geography.available(expanded,20,9),true);assert.equal(Geography.bridges(expanded).length,1);
  assert.equal(Geography.available(expanded,20.5,9),false);
  assert.deepEqual(Geography.cell(-1,-1),{ix:-1,iy:-1,x:22,y:22});
});
test('Topology route cache returns detached paths and caches failed routes', () => {
  const state={estate:{islands:[{ix:0,iy:0},{ix:1,iy:0}]},nodes:[],buildings:[]},grid=new Geography.Grid(state);
  const route=grid.path({x:9,y:9},{x:32,y:9});assert(route && route.length);
  const expected=JSON.stringify(route);route[0].x=100000;
  assert.equal(JSON.stringify(grid.path({x:9,y:9},{x:32,y:9})),expected);
  assert.equal(grid.path({x:9,y:9},{x:0,y:0}),null);
  assert.equal(grid.path({x:NaN,y:9},{x:32,y:9}),null);
});
test('Topology invalidates cached blocker positions and keeps estate origins stable', () => {
  const state={estate:{islands:[{ix:0,iy:0}]},nodes:[],buildings:[] as Array<{x:number;y:number}>};
  const first=Geography.grid(state);assert.equal(Geography.grid(state),first);
  state.buildings.push({x:9,y:9});assert.notEqual(Geography.grid(state),first);
  assert.deepEqual(Geography.frontier(state).map((i:{id:string})=>i.id),['0,-1','-1,0','1,0','0,1']);
});
test('Topology generation preserves deterministic node identity and authored sites', () => {
  const definitions={node:()=>({quantity:10})};
  const profile=JSON.parse(JSON.stringify(root.LWWorldProfile.current));profile.placementPolicy='reserved-sites';
  root.LWWorldProfile.withProfile(profile,()=>{
    const first=Geography.generatedNodes(-2,3,definitions),second=Geography.generatedNodes(-2,3,definitions);
    assert.deepEqual(first,second);assert.equal(new Set(first.map((n:{id:string})=>n.id)).size,first.length);
    for(const site of root.LWWorldProfile.current.fixedSites) {
      assert(first.some((n:{kind:string;x:number;y:number})=>n.kind===site.kind&&n.x===site.x-46&&n.y===site.y+69));
    }
  });
});

const report={passed:results.filter(r=>r.passed).length,total:results.length,failed:results.filter(r=>!r.passed).length,results};
fs.writeFileSync(path.join(__dirname,'architecture-policy-results.json'),JSON.stringify(report,null,2)+'\n');
console.log(`${report.passed}/${report.total} architecture and production policy checks passed`);
for(const result of results)if(!result.passed)console.error(result.name+': '+result.error);
if(report.failed)process.exitCode=1;
