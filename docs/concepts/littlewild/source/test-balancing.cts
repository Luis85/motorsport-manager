/// <reference path="./balancing-tools-contracts.d.ts" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import {toolbox} from './developer-sdk.cjs';
const root=globalThis as unknown as {LWScenarios:LWContentPorts.ScenarioApi;LWAssets:{revision:number};LWCreatures:{revision:number};LWBalanceRules:LWBalanceRules.Api;LWDeveloperSession:{claimHost():{dispose():void}}};
const B=toolbox.balancing,copy=<T,>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
const results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,work:()=>void):void{try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error instanceof Error?error.stack??error.message:String(error)});console.error(name,error);}}
const base=root.LWScenarios.builtins().find(p=>p.id==='littlewild')!,sceneId=base.scenes[0]!.id;
const tuned=():LWBalancing.Document=>{const data=B.capture(base,sceneId);data.simulation.rules.gameplay!.care={...data.simulation.rules.gameplay!.care,feedBerry:65};return data;};
test('Canonical defaults drive default scenario libraries, profiles, catalogs and starting presets',()=>{
 const defaults=B.defaults();assert.deepEqual(base.libraries,defaults.libraries);assert.deepEqual(base.simulation,defaults.simulation);assert.deepEqual(base.scenes,defaults.startingScenes);assert.equal(base.worlds[0]!.id,defaults.world.id);assert(B.validate(defaults,base).ok);
});
test('Canonical raw overlay and effective captured documents satisfy the public authoring schema',()=>{
 const source=path.resolve(__dirname,'../source/content'),ajv=new Ajv2020({strict:false,allErrors:true});
 for(const file of ['library.schema.json','adventure.schema.json','world.schema.json','growth.schema.json','scenario.schema.json'])ajv.addSchema(JSON.parse(fs.readFileSync(path.join(__dirname,'content',file),'utf8')),'https://littlewild.local/'+file);
 const validate=ajv.compile(JSON.parse(fs.readFileSync(path.join(source,'balancing.schema.json'),'utf8')));assert(validate(JSON.parse(fs.readFileSync(path.join(__dirname,'content/balancing.json'),'utf8'))),JSON.stringify(validate.errors));assert(validate(B.defaults()),JSON.stringify(validate.errors));
});
test('All unknown values, types, numbers and accessors reject without executing or mutating input',()=>{
 const data=tuned(),before=copy(data),gameplay=data.simulation.rules.gameplay!;
 const bad=copy(data);(bad.simulation.rules.gameplay as unknown as Record<string,unknown>).ignoredKnob={x:1};assert.equal(B.validate(bad,base).ok,false);
 for(const value of [NaN,Infinity,'1',null,-999,101]){const malformed=copy(data);(malformed.simulation.rules.gameplay!.care as unknown as Record<string,unknown>).feedBerry=value;assert.equal(B.validate(malformed,base).ok,false);}
 let calls=0;const hostile={...gameplay};Object.defineProperty(hostile,'care',{enumerable:true,get(){calls++;throw Error('getter executed');}});assert.throws(()=>root.LWBalanceRules.validate(hostile));assert.equal(calls,0);
 assert.deepEqual(data,before);
});
test('Reviewed apply is atomic, private, stale safe and detached from all live authorities',()=>{
 const data=tuned(),before=copy(base),review=B.review(base,data);assert.equal(review.blocked,null);assert(review.changes.some(c=>c.path.endsWith('/care/feedBerry')));
 const changed=copy(base);changed.description+=' changed';assert.throws(()=>B.apply(changed,review),/changed/);assert.throws(()=>B.apply(base,{...review}),/original/);
 data.simulation.rules.gameplay!.care={...data.simulation.rules.gameplay!.care,feedBerry:1};const applied=B.apply(base,review);assert.equal(applied.simulation.rules.gameplay!.care.feedBerry,65);assert.deepEqual(base,before);assert.throws(()=>B.apply(base,review),/original/);
});
test('A tuned care rule changes real domain effects and survives checkpoint continuation',()=>{
 const data=tuned(),applied=B.apply(base,B.review(base,data)),game=toolbox.createScenario(applied,sceneId);
 let checkpoint:LittlewildDeveloper.Document;
 try{const actor=game.inspect().actors[0]!;const before=actor.needs.food!;assert(game.command({id:'care',actorId:actor.id,args:['feed']}).ok);assert.equal(game.inspect().actors[0]!.needs.food,Math.min(100,before+65));game.start();game.advance(.5);checkpoint=game.story();assert.equal((checkpoint.experience as unknown as LWContentPorts.ExperienceContext).simulation.rules.gameplay!.care.feedBerry,65);}
 finally{game.dispose();}
 const review=toolbox.reviewStory(checkpoint!);const restored=toolbox.openStory(review);try{restored.advance(.5);assert(Math.abs(restored.inspect().simTime-1)<1e-9);}finally{restored.dispose();}
});
test('Seeded real probes preserve active session state, catalogs and leases',()=>{
 const game=toolbox.create({scenarioId:'littlewild',sceneId});try{
  const before=game.story(),assets=root.LWAssets.revision,creatures=root.LWCreatures.revision;
  const config={sceneId,seed:111,steps:50,commands:[{id:'care',actorId:game.inspect().actors[0]!.id,args:['feed']}] as LittlewildDeveloper.Command[]};
  const first=B.probe(base,tuned(),config),second=B.probe(base,tuned(),config);assert.deepEqual(first,second);assert(first.delta.food>0);assert.deepEqual(game.story(),before);assert.equal(root.LWAssets.revision,assets);assert.equal(root.LWCreatures.revision,creatures);assert.equal(game.disposed,false);
  assert.throws(()=>B.probe(base,tuned(),{sceneId,seed:111,steps:36001}));assert.deepEqual(game.story(),before);
 }finally{game.dispose();}
 const lease=root.LWDeveloperSession.claimHost();try{assert(B.probe(base,tuned(),{sceneId,seed:111,steps:1}).baseline.actors>0);assert.throws(()=>toolbox.create({scenarioId:'littlewild'}),/host/);}finally{lease.dispose();}
});
test('Sweeps have a finite aggregate budget and expose invalid candidates as structured rows',()=>{
 const rows=B.sweep(base,tuned(),{sceneId,seed:111,steps:20,path:'/simulation/rules/gameplay/care/feedBerry',values:[20,65,101]});assert.equal(rows.length,3);assert(rows[0]!.probe);assert(rows[1]!.probe);assert.equal(rows[2]!.probe,null);assert(rows[2]!.errors[0]!.message.includes('feedBerry'));
 assert.throws(()=>B.sweep(base,tuned(),{sceneId,seed:111,steps:36000,path:'/simulation/rules/gameplay/care/feedBerry',values:[20,65]}),/72000/);
});
test('Starting presets use explicit new-story creation while normal apply preserves actor possessions',()=>{
 const data=B.capture(base,sceneId);(data.startingScenes[0]!.initialState.player as {coins:number}).coins+=30;assert(B.review(base,data).blocked?.includes('startingPack'));
 const next=B.startingPack(data,base);const game=toolbox.createScenario(next,sceneId);try{assert.equal(game.inspect().player.coins,116);}finally{game.dispose();}
});
test('Office bound floors retain native owner state and tuning applies to their actual workflow',()=>{
 const office=root.LWScenarios.builtins().find(p=>p.id==='office')!,home=office.scenes[0]!;home.graph={kind:'level',connections:[{id:'upstairs',label:'Packing floor',targetSceneId:'office-upper'}]};
 const bound:LWContentPorts.Scene={id:'office-upper',name:'Packing floor',description:'Native upstairs work',worldId:home.worldId,initialState:{},graph:{kind:'interior',parentId:home.id,binding:{type:'interior',sourceSceneId:home.id,buildingId:'office-packing',floorId:'upper'},connections:[{id:'home',label:'Office',targetSceneId:home.id}]}};office.scenes.push(bound);
 const data=B.capture(office,bound.id);data.simulation.rules.gameplay={...root.LWBalanceRules.defaults,policy:{...root.LWBalanceRules.defaults.policy,sellFraction:.8}};
 const review=B.review(office,data);assert.equal(review.blocked,null);const tuned=B.apply(office,review);assert.deepEqual(tuned.scenes.find(s=>s.id===bound.id)!.initialState,{});assert(root.LWScenarios.validate(tuned).ok);
 const probe=B.probe(office,data,{sceneId:bound.id,seed:111,steps:10});assert(probe.baseline.actors>0);assert.equal(probe.baseline.actors,probe.candidate.actors);
});
test('Fractional seconds and work caps are accepted, incoherent thresholds reject atomically',()=>{
 const data=B.capture(base,sceneId);data.simulation.rules.gameplay!.autonomy={...data.simulation.rules.gameplay!.autonomy,socialDuration:6.5,coolDuration:9.5};data.simulation.rules.gameplay!.work={...data.simulation.rules.gameplay!.work,maximumRate:2.5};data.simulation.rules.gameplay!.production={...data.simulation.rules.gameplay!.production,cropSeconds:80.5};assert(B.validate(data,base).ok);
 data.simulation.rules.gameplay!.modifiers={...data.simulation.rules.gameplay!.modifiers,tiredEnergy:90,lowEnergy:20};assert.equal(B.validate(data,base).ok,false);
});
test('An unchanged second-world capture produces no balancing diff or apply mutation',()=>{
 const two=copy(base),world=copy(two.worlds[0]!),scene=copy(two.scenes[0]!);world.id='second-world';world.name='Second world';two.worlds.push(world);scene.id='second-scene';scene.worldId=world.id;two.scenes.push(scene);assert(root.LWScenarios.validate(two).ok);
 const review=B.review(two,B.capture(two,scene.id));assert.equal(review.total,0);assert.equal(review.blocked,null);assert.deepEqual(B.apply(two,review),two);
});
test('Requested and active duel definitions cannot change while no-op balancing remains allowed',()=>{
 const game=toolbox.create({scenarioId:'littlewild',sceneId:'charted-home'});try{
  assert(game.command({id:'request-interaction',args:['friendly-duel','c1',{scope:'creature',id:'c2'}]}).ok);
  const pack=game.captureScenario(),data=B.capture(pack,'charted-home');const unchanged=B.review(pack,data);assert.equal(unchanged.total,0);assert.equal(unchanged.blocked,null);B.apply(pack,unchanged);
  const duel=data.interactions.definitions.find(d=>d.id==='friendly-duel')!;duel.duel={...duel.duel!,sourceEnergyPerRound:duel.duel!.sourceEnergyPerRound+1};
  const review=B.review(pack,data);assert(review.blocked?.includes('interactions'));assert.throws(()=>B.apply(pack,review),/interactions/);
 }finally{game.dispose();}
});
test('Unchanged captures preserve heterogeneous catalogs belonging to another native owner',()=>{
 const separate=copy(base),other=copy(separate.scenes[0]!);other.id='other-root';other.initialState=copy(separate.scenes.find(s=>s.id==='charted-home')!.initialState);separate.scenes.push(other);
 const first=B.capture(separate,sceneId),authored=B.capture(separate,other.id);const duel=authored.interactions.definitions.find(d=>d.id==='friendly-duel')!;duel.duel={...duel.duel!,responseSeconds:duel.duel!.responseSeconds+1};
 const changed=B.apply(separate,B.review(separate,authored)),review=B.review(changed,B.capture(changed,sceneId));assert.equal(review.total,0);assert.equal(review.blocked,null);assert.deepEqual(B.apply(changed,review),changed);assert.equal(first.sceneId,sceneId);
});
test('Missing optional gameplay remains compatible and preserves legacy profile fingerprints',()=>{
 const legacy=copy(base);delete legacy.simulation.rules.gameplay;assert(root.LWScenarios.validate(legacy).ok);const game=toolbox.createScenario(legacy,sceneId);try{const story=game.story(),review=toolbox.reviewStory(story);game.dispose();const restored=toolbox.openStory(review);try{assert.equal(restored.inspect().actors.length,1);}finally{restored.dispose();}}finally{game.dispose();}
});
const report={suite:'balancing',passed:results.filter(r=>r.passed).length,total:results.length,results};fs.writeFileSync(path.join(__dirname,'balancing-results.json'),JSON.stringify(report,null,2)+'\n');console.log(`${report.passed}/${report.total} balancing checks passed`);if(results.some(r=>!r.passed))process.exitCode=1;
