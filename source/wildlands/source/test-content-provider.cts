/// <reference path="./content-provider-contracts.d.ts" />
/* Content-provider seam: engine modules load without a game, request content only through the one
 * installed profile, and the scenario catalog is injected rather than built in. Every check that
 * composes the engine runs in a fresh process so no earlier install or require cache leaks in. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';

const results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,work:()=>void):void{
 try{work();results.push({name,passed:true});}
 catch(error){results.push({name,passed:false,error:error instanceof Error?error.stack??error.message:String(error)});console.error('FAIL',name,error);}
}
/** Run `script` in a fresh Node process from the compiled output directory. */
function fresh(script:string):void{
 const run=spawnSync(process.execPath,['-e',"'use strict';const assert=require('node:assert/strict');\n"+script],{cwd:__dirname,encoding:'utf8',timeout:90000});
 if(run.error)throw run.error;
 assert.equal(run.status,0,run.stderr||run.stdout||'Fresh process exited without a result.');
}
/** Run the compiled provider in a browser-like realm (no CommonJS) after `globals` were declared; returns its profile or null. */
function adopted(globals:Record<string,unknown>={}):Record<string,unknown>|null{
 const context=vm.createContext({});
 for(const [name,value] of Object.entries(globals))context[name]=vm.runInContext('('+JSON.stringify(value)+')',context);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'content-provider.js'),'utf8'),context,{filename:'content-provider.js'});
 const profile=vm.runInContext('LWContentProvider.installed()?JSON.stringify(LWContentProvider.get()):"null"',context) as string;
 return JSON.parse(profile) as Record<string,unknown>|null;
}
const json=(file:string):unknown=>JSON.parse(fs.readFileSync(path.join(__dirname,file),'utf8'));

test('Engine modules load without an installed game and name the missing content on first request',()=>fresh(`
 const P=require('./content-provider.js'),L=require('./simulation.cjs');
 for(const name of ['scenario-runtime','scenario-story','story-codec','balancing-tools','creature-editor-fields','rts-catalog','pet-catalog','wildlands-project','engine-export'])require('./'+name+'.js');
 assert.equal(P.installed(),false);
 const missing=/no game content installed/;
 assert.throws(()=>new L.Engine(),missing);
 assert.throws(()=>require('./balancing-rules.js').defaults,missing);
 assert.throws(()=>require('./content-runtime.js').registry,/no game content installed \\(the content library requested\\)/);
 assert.throws(()=>require('./scenario-runtime.js').builtins(),/no game content installed \\(the scenario catalog requested\\)/);
 assert.throws(()=>require('./rts-catalog.js').data,missing);assert.throws(()=>require('./pet-catalog.js').defaults,missing);
 assert.throws(()=>global.LWAssets.all(),missing);assert.throws(()=>global.LWCreatures.all(),missing);
 assert.equal(Object.keys(require('./content-runtime.js').tables.RES).length,0);
`));

test('A later install admits every owned section in load order with unchanged canonical values',()=>fresh(`
 const P=require('./content-provider.js'),L=require('./simulation.cjs'),X=require('./scenario-runtime.js'),C=require('./content-runtime.js');
 const {profile}=require('./test-support/install-games.cjs'),data=require('./content/balancing.json');
 assert.equal(P.installed(),true);assert.equal(P.get(),profile);assert.equal(profile.id,'showcase');
 assert.equal(C.tables.RES.berries.price,data.libraries.base.components.items.find(d=>d.id==='berries').price);
 assert.deepEqual(require('./balancing-rules.js').defaults,data.simulation.rules.gameplay);
 assert.deepEqual(global.LWWorldProfile.current,data.world);assert.deepEqual(global.LWSimulationProfile.current.rules.actor,data.simulation.rules.actor);
 assert.deepEqual(X.builtins().map(p=>p.id),['littlewild','emberworks','office']);assert.equal(X.defaultId(),'littlewild');
 assert.equal(require('./rts-catalog.js').data.format,'wildlands-rts');assert.equal(require('./pet-catalog.js').defaults.format,'wildlands-pet');
 const engine=L.createWorldDemo();engine.s.started=true;for(let i=0;i<8;i++)engine.step(.25);assert.equal(engine.s.simTime,2);
`));

test('Profile admission rejects malformed, newer and second installs without invoking accessors',()=>{
 // This suite process never installs the showcase: the provider here is fresh and owned by this check.
 const P=require('./content-provider.js') as LWContentProvider.Api;
 assert.equal(P.version,1);assert.equal(P.installed(),false);
 assert.throws(()=>P.get('a test section'),/^Error: Wildlands: no game content installed \(a test section requested\)/);
 const base={format:'wildlands-content-profile',version:1,id:'demo'};
 for(const [input,pattern] of [
  [null,/profile must be a plain object/],[[],/profile must be a plain object/],
  [{...base,format:'other'},/format must be wildlands-content-profile/],
  [{...base,version:2},/version 2 is newer than this engine supports \(1\)/],[{...base,version:0},/positive integer/],
  [{...base,id:'Bad Id'},/id must be/],[{...base,extra:true},/unknown field extra/],
  [{...base,scenarios:{packs:[],defaultId:'a'}},/scenarios.packs must list/],
  [{...base,scenarios:{packs:[{id:'a'}],defaultId:'b'}},/defaultId must name one of the listed packs/],
  [{...base,scenarios:{packs:[{id:'a'}],defaultId:'a',canonicalId:'b'}},/canonicalId must name one of the listed packs/],
  [{...base,creatures:{definitions:[],script:'x'}},/creatures has unknown field script/]
 ] as const)assert.throws(()=>P.install(input),pattern);
 let reads=0;const accessor={...base};Object.defineProperty(accessor,'balancing',{enumerable:true,get(){reads++;return {};}});
 assert.throws(()=>P.install(accessor),/balancing must be an enumerable data field/);assert.equal(reads,0);assert.equal(P.installed(),false);
 const order:string[]=[];P.whenInstalled(()=>order.push('any'));P.whenInstalled(()=>order.push('rts'),'rts');P.whenInstalled(()=>order.push('balancing'),'balancing');
 assert.throws(()=>P.whenInstalled(()=>undefined,'unknown' as LWContentProvider.Section),/unknown section/);
 const first={...base,balancing:{tuned:true},scenarios:{packs:[{id:'a'},{id:'b'}],defaultId:'b'}},installed=P.install(first);
 assert.deepEqual(order,['any','balancing']);assert(Object.isFrozen(installed));assert(Object.isFrozen(installed.scenarios));
 assert.equal(installed.balancing,first.balancing);assert.deepEqual(installed.scenarios,{packs:[{id:'a'},{id:'b'}],defaultId:'b'});
 assert.equal(P.install(first),installed);assert.equal(P.install(installed),installed);
 assert.throws(()=>P.install({...base,id:'other'}),/game content is already installed \(demo\); a realm runs exactly one game/);
 P.whenInstalled(()=>order.push('late'));P.whenInstalled(()=>order.push('late-rts'),'rts');assert.deepEqual(order,['any','balancing','late']);
});

test('Browser artifacts adopt their declared data globals as the installed profile',()=>{
 assert.equal(adopted(),null);
 const packs=[{id:'emberworks'},{id:'littlewild'}];
 assert.deepEqual(adopted({LWGameProfile:{storage:{namespace:'wildlands.office'}},LWDefaultBalancing:{creatures:{}},LWContentSchema:{type:'object'},
  LWCreatureConfig:{format:'c'},LWCreatureDefinitions:[],LWAssetDefinitions:[],LWScenarioPacks:packs}),
  {format:'wildlands-content-profile',version:1,id:'office',storage:{namespace:'wildlands.office'},balancing:{creatures:{}},librarySchema:{type:'object'},
   creatures:{configuration:{format:'c'},definitions:[]},assets:[],scenarios:{packs,defaultId:'emberworks',canonicalId:'littlewild'}});
 assert.deepEqual(adopted({LWRTSDefinitions:{format:'wildlands-rts'}}),{format:'wildlands-content-profile',version:1,id:'embedded',rts:{format:'wildlands-rts'}});
 assert.deepEqual(adopted({LWPetDefinitions:{format:'wildlands-pet'},LWPetAssetDefinitions:[]})?.pet,{definitions:{format:'wildlands-pet'},assets:[]});
 assert.deepEqual(adopted({LWScenarioPacks:[{id:'custom'}]})?.scenarios,{packs:[{id:'custom'}],defaultId:'custom'});
 assert.equal(adopted({LWGameProfile:{storage:{namespace:'littlewild'}},LWScenarioPacks:[]})?.scenarios,undefined);
});

test('The injected scenario catalog orders built-ins and selects its declared default pack',()=>fresh(`
 const P=require('./content-provider.js'),{littlewildProfile}=require('./content-installers/littlewild-game.cjs'),base=littlewildProfile();
 const ember=require('./content/emberworks.pack.json'),office=require('./content/office.pack.json'),classic=require('./content/littlewild.pack.json'),before=JSON.stringify([ember,office,classic]);
 P.install({...base,id:'emberworks',scenarios:{packs:[ember,office,classic],defaultId:'emberworks',canonicalId:'littlewild'}});
 const X=require('./scenario-runtime.js'),{projects}=require('./wildlands-project-sdk.cjs');
 assert.deepEqual(X.builtins().map(p=>p.id),['emberworks','office','littlewild']);
 assert.equal(X.defaultId(),'emberworks');assert.equal(X.defaultPack().id,'emberworks');
 assert.deepEqual(X.defaultTutorial(),ember.tutorial);assert.deepEqual(X.defaultPresentation(),ember.presentation);
 assert.equal(projects.create().scenarioId,'emberworks');
 const refreshed=X.builtins().find(p=>p.id==='littlewild');
 assert.deepEqual(refreshed.simulation,require('./content/balancing.json').simulation);
 assert.equal(JSON.stringify([ember,office,classic]),before,'Installed profile data is never mutated by the scenario runtime.');
`));

test('Built artifacts run the content provider after their data globals and before every engine module',()=>{
 const directory=path.join(__dirname,'artifacts'),manifests=fs.readdirSync(directory).filter(file=>file.endsWith('.manifest.json')).sort();
 assert.deepEqual(manifests.map(file=>file.replace('.manifest.json','')),['colony-play','pet-play','rts-play','showcase','studio']);
 for(const file of manifests){
  const manifest=json(path.join('artifacts',file)) as {profile:string;segments:{kind:string;name:string}[]};
  const scripts=manifest.segments.filter(segment=>segment.kind!=='style');
  const firstScript=scripts.findIndex(segment=>segment.kind==='script');
  assert(scripts.slice(0,firstScript).every(segment=>segment.kind==='data'),manifest.profile+': data globals must precede every module');
  assert.equal(scripts[firstScript]?.name,'CONTENT_PROVIDER',manifest.profile+': the content provider must be the first module');
 }
});

const report={suite:'content-provider',passed:results.filter(result=>result.passed).length,total:results.length,results};
fs.writeFileSync(path.join(__dirname,'content-provider-results.json'),JSON.stringify(report,null,2)+'\n');
console.log(`${report.passed}/${report.total} content provider checks passed`);
if(report.passed!==report.total)process.exitCode=1;
