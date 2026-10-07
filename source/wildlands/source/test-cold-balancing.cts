// Tests run the composite showcase game: install its content profile before any engine module loads.
import './test-support/install-games.cjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

// Each case gets a real fresh process: no SDK, prior suite or require-cache side effects.
const results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,source:string):void{
 try{
  // A fresh process installs the bundled showcase game first, as every Node entry point must.
  const run=spawnSync(process.execPath,['-e',"const assert=require('node:assert/strict');require('./test-support/install-games.cjs');\n"+source],{cwd:__dirname,encoding:'utf8',timeout:60000});
  if(run.error)throw run.error;
  assert.equal(run.status,0,run.stderr||run.stdout||'Fresh process exited without a result.');
  results.push({name,passed:true});
 }catch(error){results.push({name,passed:false,error:error instanceof Error?error.stack??error.message:String(error)});}
}
test('Pure rules read canonical tuners without an ambient runtime',`
 const B=require('./balancing-rules.js'),data=require('./content/balancing.json');
 assert.deepEqual(B.defaults,data.simulation.rules.gameplay);
 assert(B.supported().some(row=>row.path==='/simulation/rules/gameplay/care/feedBerry'));
 assert.equal(B.forEngine({}),B.defaults);
`);
for(const [moduleName,section]of [['adventure-content','adventure'],['world-content','world'],['growth-content','growth']] as const){
 test('Cold '+moduleName+' reads and validates its canonical library',`
  const C=require('./${moduleName}.js'),data=require('./content/balancing.json').libraries.${section};
  assert.deepEqual(C.content,data);assert.equal(C.validate(data).ok,true);
 `);
}
test('Cold content and world profile expose canonical values without changing authored placement policy',`
 const C=require('./content-runtime.js'),data=require('./content/balancing.json'),P=require('./world-profile.js');
 assert.equal(C.tables.RES.berries.price,data.libraries.base.components.items.find(d=>d.id==='berries').price);
 assert.deepEqual(P.current,data.world);assert.equal(P.current.placementPolicy,data.world.placementPolicy);
`);
for(const [moduleName,key]of [['actor-ecs','actor'],['economy-ecs','economy']] as const){
 test('Cold '+moduleName+' creates its canonical deterministic ECS rules',`
  const C=require('./${moduleName}.js'),data=require('./content/balancing.json').simulation.rules.${key};
  assert.deepEqual(C.create().rules,data);
 `);
}
test('Creature overlay initializes its JSON boundary and preserves authored identities',`
 const M=require('./creature-balancing.js'),definitions=require('./creature-definitions.json'),configuration=require('./creature-config.json');
 const base={configuration,definitions},before=JSON.stringify(base),id=definitions[0].id;
 const tuned=M.merge(base,{format:'littlewild-creature-balancing',schemaVersion:1,definitions:[{id,movement:{baseSpeed:2.3}}]});
 assert.equal(tuned.definitions[0].movement.baseSpeed,2.3);assert.equal(tuned.definitions[0].visualAsset,definitions[0].visualAsset);
 assert.deepEqual(tuned.definitions[0].ecs,definitions[0].ecs);assert.equal(JSON.stringify(base),before);
 assert.throws(()=>M.merge(base,{format:'littlewild-creature-balancing',schemaVersion:1,definitions:[{id,identity:'replacement'}]}));
`);
test('Creature catalog cold load produces a detached canonical actor seed',`
 const C=require('./creature-catalog.js'),raw=require('./creature-definitions.json');
 assert.deepEqual(C.all().map(d=>d.id),raw.map(d=>d.id));
 const actor=C.seed(C.defaultArchetype,C.defaultPersonality,'founder',0),next=C.seed(C.defaultArchetype,C.defaultPersonality,'founder',0);
 actor.needs.energy=0;assert.notEqual(next.needs.energy,0);assert.equal(actor.archetype,C.defaultArchetype);
`);
test('Bare browser manifests remain valid while present incomplete balancing documents reject',`
 const vm=require('node:vm'),fs=require('node:fs'),source=fs.readFileSync('./content-provider.js','utf8')+'\\n'+fs.readFileSync('./creature-catalog.js','utf8');
 const authored=JSON.stringify({configuration:require('./creature-config.json'),definitions:require('./creature-definitions.json')});
 function realm(balance){const context=vm.createContext({});vm.runInContext('const authored=JSON.parse('+JSON.stringify(authored)+');LWCreatureConfig=authored.configuration;LWCreatureDefinitions=authored.definitions;',context);if(balance!==undefined)vm.runInContext('LWDefaultBalancing=JSON.parse('+JSON.stringify(JSON.stringify(balance))+');',context);return context;}
 const bare=realm();vm.runInContext(source,bare);assert(bare.LWCreatures.all().length>0);assert(Object.isFrozen(bare.LWCreatures.all()));
 assert.throws(()=>vm.runInContext(source,realm({})),/overlay is missing/);
 assert.throws(()=>vm.runInContext(source,realm({creatures:null})),/merge helper is missing/);
 const sparse=realm();vm.runInContext('delete LWCreatureDefinitions[0];LWCreatureDefinitions.extra={};',sparse);assert.throws(()=>vm.runInContext(source,sparse),/dense/);
`);
test('Interior catalog cold load validates actual connectivity and owns detached floors',`
 const C=require('./building-interior-catalog.js'),P=require('./building-interior-paths.js'),data=require('./content/balancing.json').interiors;
 assert.deepEqual(C.defaults,data);const floor=C.defaults.layouts[0].floors[0];
 assert.deepEqual(P.path(floor,floor.door,floor.door),[]);
 const malformed=JSON.parse(JSON.stringify(data));malformed.layouts[0].floors[0].door.x=-1;
 assert.throws(()=>C.validate(malformed));assert.deepEqual(C.defaults,data);
`);
test('Interaction catalog cold load resolves canonical skills, resources and fingerprints',`
 const C=require('./interaction-catalog.js'),data=require('./content/balancing.json').interactions;
 assert.deepEqual(C.all(),data.definitions);assert(C.all().some(d=>d.executor==='duel'));
 const changed=JSON.parse(JSON.stringify(data));changed.definitions.find(d=>d.executor==='duel').cooldown+=1;
 assert.notEqual(C.fingerprint(C.validate(changed)),C.fingerprint(C.validate(data)));
`);
test('Inventory validator cold load verifies every compiled tuner',`
 const I=require('./balancing-inventory.js'),data=require('./content/balancing-inventory.json');
 assert.deepEqual(I.validate(data),data);
 const malformed=JSON.parse(JSON.stringify(data));malformed.tuners[0].path='/simulation/rules/gameplay/unknown/value';
 assert.throws(()=>I.validate(malformed));
`);
test('Physical transfer proposals cold load retain canonical duration and destination',`
 const T=require('./world-tasks.js'),B=require('./balancing-rules.js');
 const task=T.transfer('stockbuilding',{id:'workshop',x:4,y:5},'wood',2,null,{item:'Wood',building:'Workshop'});
 assert.equal(task.duration,B.defaults.production.transferSeconds);assert.deepEqual(task.target,{x:4,y:5});assert.equal(task.amount,2);
`);
test('Read-only work rates cold load use the owning profile rather than ambient defaults',`
 const W=require('./systems-work-rates.js'),B=require('./balancing-rules.js'),rules=JSON.parse(JSON.stringify(B.defaults));
 rules.work.stationPerLevel=.17;
 const text=W.upgradeEffect({simulationProfile:{rules:{gameplay:rules}}},{kind:'workshop',level:1},2);
 assert(text.includes('17%'),text);assert.equal(B.defaults.work.stationPerLevel,require('./content/balancing.json').simulation.rules.gameplay.work.stationPerLevel);
`);
test('Authored construction pricing reads explicitly supplied tuning after minimal data setup',`
 const C=require('./content-runtime.js');global.LW={BUILDINGS:C.tables.BUILDINGS,RES:C.tables.RES};require('./building-interior-catalog.js');
 const D=require('./construction-designs.js'),B=require('./balancing-rules.js'),rules=JSON.parse(JSON.stringify(B.defaults));
 const catalog=global.LWInteriors.defaults,layout=catalog.layouts.find(l=>l.id===catalog.fallback),kind=Object.keys(C.tables.BUILDINGS)[0];
 const design=D.validate({name:'Cold authored place',kind,layout});
 const first=D.phases(design,{simulationProfile:{rules:{gameplay:rules}}});
 rules.construction.cellSeconds+=1;const tuned=D.phases(design,{simulationProfile:{rules:{gameplay:rules}}});assert(tuned[0].time>first[0].time);
 assert(first.length>0);assert(first.every(phase=>Number.isFinite(phase.time)&&phase.time>0));assert(Object.keys(D.cost(design,{simulationProfile:{rules:{gameplay:rules}}})).length>0);
`);
for(const moduleName of ['engine-task-completion','engine-companion','colony-activity','colony-adventures','colony-logistics','colony-task-completion']){
 test('Cold '+moduleName+' resolves rules before the composed facade installs it',`
  const helper=require('./${moduleName}.js');assert.equal(typeof helper.install,'function');
  assert.equal(global.LWBalanceRules,require('./balancing-rules.js'));
  const L=require('./simulation.cjs'),engine=L.createWorldDemo();engine.s.started=true;
  for(let i=0;i<20;i++)engine.step(.25);
  assert.equal(engine.s.simTime,5);assert(Number.isFinite(engine.creatures[0].needs.food));
 `);
}
test('The composed SDK still captures canonical defaults and restores the same owned state',`
 const {toolbox}=require('./developer-sdk.cjs'),game=toolbox.create({scenarioId:'littlewild',sceneId:'charted-home'});
 const before=game.story(),balance=toolbox.balancing.capture(game.captureScenario(),'charted-home');
 assert.equal(balance.simulation.rules.gameplay.care.feedBerry,require('./balancing-rules.js').defaults.care.feedBerry);
 assert.deepEqual(game.story(),before);game.dispose();
 const restored=toolbox.openStory(toolbox.reviewStory(before));assert.deepEqual(restored.story(),before);restored.dispose();
`);
const report={suite:'cold-balancing',passed:results.filter(r=>r.passed).length,total:results.length,results};
fs.writeFileSync(path.join(__dirname,'cold-balancing-results.json'),JSON.stringify(report,null,2)+'\n');
console.log(`${report.passed}/${report.total} cold balancing checks passed`);
for(const result of results)if(!result.passed)console.error(result.name,result.error);
if(report.passed!==report.total)process.exitCode=1;
