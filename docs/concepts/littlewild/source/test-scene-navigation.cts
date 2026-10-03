/// <reference path="./scene-navigation-contracts.d.ts" />
/// <reference path="./building-interior-contracts.d.ts" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sdk=require('./developer-sdk.cjs') as {toolbox:LittlewildDeveloper.Toolbox};
require('./scene-navigation.js');
interface Native extends LWInterior.Engine {
 scenarioContext?:LWContentPorts.ExperienceContext;
 s:LWInterior.World & {scenarioResources?:LWContentPorts.Resources;settings:Record<string,boolean>;player:{coins:number};paused:boolean};
 advance(seconds:number):void;step(dt:number):void;export():{version:number;state:LWInterior.World & Record<string,unknown>};
 buildingInterior(id:string):{floors:{id:string}[]}|null;
 orderBuildingProduction(b:string,f:string,s:string,r:string,n:number):{ok:boolean};
}
const root=globalThis as unknown as {
 LW:{createWorldDemo():Native};LWScenarios:LWContentPorts.ScenarioApi;LWSceneNavigation:LWSceneNavigation.NavigationApi;
 LWContent:LWContentPorts.ContentApi;LWWorldProfile:{current:unknown};LWSimulationProfile:{current:unknown};
 LWStory:{encode(e:Native):Record<string,unknown>;inspect(input:unknown):unknown;commit(input:unknown):Native};
};
const X=root.LWScenarios,N=root.LWSceneNavigation,C=root.LWContent;
const results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,work:()=>void):void{try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
const native=(e:LWContentPorts.ScenarioEngine):Native=>e as Native;
const launch=(pack:LWContentPorts.ScenarioPack,id='home'):Native=>native(X.commitScene(X.prepareScene(pack,id)));
const move=(engine:Native,id:string):Native=>native(N.commit(engine,N.prepare(engine,id)));
function active():string{return C.stable({library:C.registry.export(),world:root.LWWorldProfile.current,simulation:root.LWSimulationProfile.current});}
function pack():LWContentPorts.ScenarioPack{
 X.commitScene(X.prepareScene(X.builtins()[0]!,'charted-home'));
 const p=X.capture(root.LW.createWorldDemo()),initial=C.copy(p.scenes[0]!.initialState),homeWorld=p.worlds[0]!;
 p.id='scene-journey-test';p.name='Journey tests';p.scenes=[];
 const farWorld=C.copy(homeWorld);farWorld.id='far-world';farWorld.name='Far world';
 farWorld.environment={mode:'indoor',background:'#eeeeee',floor:'#dddddd',alternateFloor:'#cccccc',wall:'#bbbbbb',trim:'#aaaaaa',camera:{center:[9,9],zoom:1}};
 p.worlds.push(farWorld);
 const home:LWContentPorts.Scene={id:'home',name:'Home',description:'Native shared home',worldId:homeWorld.id,initialState:initial,
  graph:{kind:'level',connections:[{id:'far',label:'Far world',targetSceneId:'far'},{id:'room',label:'Upper workshop',targetSceneId:'room'},{id:'island',label:'Home shore',targetSceneId:'shore'}]}};
 const building=(initial.buildings as {id:string;kind:string}[]).find(b=>b.kind==='bench')!;
 const farState=C.copy(initial);(farState.player as {coins:number}).coins=333;
 p.scenes.push(home,{id:'far',name:'Far world',description:'Separate native checkpoint',worldId:farWorld.id,initialState:farState,graph:{kind:'dungeon',connections:[{id:'home',label:'Return home',targetSceneId:'home'}]}},
  {id:'room',name:'Upper workshop',description:'Same workers and paid jobs',worldId:homeWorld.id,initialState:{},graph:{kind:'interior',parentId:'home',binding:{type:'interior',sourceSceneId:'home',buildingId:building.id,floorId:'upper'},connections:[{id:'home',label:'Back to map',targetSceneId:'home'}]}},
  {id:'shore',name:'Home shore',description:'Owned home island',worldId:homeWorld.id,initialState:{},graph:{kind:'island',parentId:'home',binding:{type:'island',sourceSceneId:'home',ix:0,iy:0},connections:[{id:'home',label:'Back to home',targetSceneId:'home'}]}});
 return p;
}
function until(engine:Native,condition:()=>boolean):void{for(let i=0;i<2400;i++){engine.step(.1);if(condition())return;}throw Error('Physical worker did not reach the paid job.');}

test('Cross-world reviews are detached and preserve unfinished state on revisits',()=>{
 const engine=launch(pack());engine.advance(5);const before=engine.export(),context=C.copy(engine.scenarioContext),registries=active();
 const preview=N.prepare(engine,'far');assert.equal(active(),registries);assert.deepEqual(engine.export(),before);assert.deepEqual(engine.scenarioContext,context);
 const far=native(N.commit(engine,preview));assert.equal(far.scenarioContext!.worldId,'far-world');assert.equal(far.s.player.coins,333);
 assert.deepEqual(engine.export(),before);assert.deepEqual(engine.scenarioContext,context);far.advance(7);
 const farState=far.export();const home=move(far,'home');assert.deepEqual(home.export(),before);
 assert.deepEqual(move(home,'far').export(),farState);assert.deepEqual(home.scenarioContext!.journey!.visited,['home','far']);
});
test('Bound floor entry and return preserve paid jobs, inventories, actor identities and time',()=>{
 const engine=launch(pack()),building=engine.s.buildings.find(b=>b.kind==='bench')!;
 for(const b of engine.s.buildings)if(b.storage)engine.configureBuilding(b.id,'clear',null);
 for(const actor of engine.creatures){actor.task=null;actor.orders=[];actor.training=null;actor.learning.queue=[];actor.stockTargets=Object.fromEntries(Object.keys(actor.stockTargets).map(id=>[id,0]));actor.needs.food=actor.needs.water=actor.needs.energy=95;}
 assert(engine.orderBuildingProduction(building.id,'upper','work','planks',1).ok);
 until(engine,()=>!!building.storage?.job&&building.storage.job.progress>0);
 const paid=engine.export(),room=move(engine,'room');assert.deepEqual(room.export(),paid);assert.deepEqual(N.target(room),{type:'interior',buildingId:building.id,floorId:'upper'});
 assert.deepEqual(Object.keys(room.scenarioContext!.journey!.checkpoints),['home']);assert.equal(room.scenarioContext!.journey!.checkpoints.room,undefined);
 room.step(.1);const progressed=room.export();assert.notDeepEqual(progressed,paid);
 const home=move(room,'home');assert.deepEqual(home.export(),progressed);assert.equal(N.target(home),null);assert.deepEqual(engine.export(),paid);
});
test('Island focus uses its owned native owner without replacing state or moving workers',()=>{
 const home=launch(pack()),before=home.export(),shore=move(home,'island');assert.deepEqual(shore.export(),before);assert.deepEqual(N.target(shore),{type:'island',ix:0,iy:0});
 assert.deepEqual(move(shore,'home').export(),before);
});
test('Native settings remain owned by each world; entry events apply once on admitted entry',()=>{
 const p=pack();p.scenes[0]!.graph!.connections![0]!.events=[{type:'message',text:'Arrived safely'},{type:'pause',paused:true}];
 const home=launch(p);home.s.settings.reducedMotion=true;const before=home.export(),preview=N.prepare(home,'far');assert.deepEqual(preview.messages,['Arrived safely']);assert.deepEqual(home.export(),before);
 const far=native(N.commit(home,preview));assert.equal(far.s.settings.reducedMotion,false);assert.equal(far.s.paused,true);assert.throws(()=>N.commit(home,preview),/stale/);
 assert.equal(move(far,'home').s.settings.reducedMotion,true);
});
test('Entry gates and missing connections reject without changing any active authority',()=>{
 const p=pack();p.scenes[1]!.graph!.requirements=[{type:'player-level',minimum:999}];const home=launch(p),before=home.export(),context=C.copy(home.scenarioContext),registries=active();
 assert.throws(()=>N.prepare(home,'far'),/level 999/);assert.throws(()=>N.prepare(home,'missing'),/choose a connection/);
 assert.deepEqual(home.export(),before);assert.deepEqual(home.scenarioContext,context);assert.equal(active(),registries);
});
test('Initial entry enforces native starting gates while transitions keep the reviewed source gate',()=>{
 const p=pack();p.scenes[1]!.graph!.requirements=[{type:'player-level',minimum:999}];p.scenes[1]!.graph!.events=[{type:'pause',paused:true},{type:'message',text:'Admitted source guide'}];
 const before=active();assert.throws(()=>launch(p,'far'),/level 999/);assert.equal(active(),before);
 assert.throws(()=>sdk.toolbox.createScenario(p,'far'),/level 999/);assert.equal(active(),before);
 const source=launch(p);(source.s.player as {level?:number}).level=999;
 const preview=N.prepare(source,'far');assert.deepEqual(preview.messages,['Admitted source guide']);const entered=native(N.commit(source,preview));
 assert.notEqual((entered.s.player as {level?:number}).level,999);assert.equal(entered.s.paused,true);
 const saved=root.LWStory.encode(entered),restored=root.LWStory.commit(root.LWStory.inspect(saved));assert.deepEqual(restored.export(),entered.export());
 const direct=pack();direct.scenes[0]!.graph!.events=[{type:'pause',paused:true},{type:'message',text:'Initial admission'}];
 const first=X.prepareScene(direct,'home');assert.deepEqual(first.messages,['Initial admission']);assert.equal(native(X.commitScene(first)).s.paused,true);
});
test('Live source changes, forged reviews and detached preview changes reject atomically',()=>{
 const mutations:((p:LWSceneNavigation.TransitionPreview)=>void)[]=[p=>p.messages.push('forged'),p=>p.scene.engine.scenarioContext!.sceneName='Forged',p=>p.scene.engine.export().state.player={coins:1},p=>{(native(p.scene.engine)).s.player.coins++;},p=>p.target={type:'island',ix:9,iy:9}];
 for(const mutate of mutations){const home=launch(pack()),preview=N.prepare(home,'far'),before=home.export(),registries=active();mutate(preview);
  // Mutating a detached export has no effect; the remaining edits corrupt review.
  if(mutations.indexOf(mutate)===2)assert.doesNotThrow(()=>N.commit(home,preview));
  else{assert.throws(()=>N.commit(home,preview),/stale/);assert.equal(active(),registries);}assert.deepEqual(home.export(),before);
 }
 const home=launch(pack()),preview=N.prepare(home,'far');home.step(.1);const current=home.export(),registries=active();assert.throws(()=>N.commit(home,preview),/stale/);assert.deepEqual(home.export(),current);assert.equal(active(),registries);
 const other=launch(pack());assert.throws(()=>N.commit(other,N.prepare(home,'far')),/stale/);
});
test('Failed transition activation restores all installed content and supports retry',()=>{
 const home=launch(pack()),preview=N.prepare(home,'far'),before=home.export(),context=C.copy(home.scenarioContext),registries=active(),activate=X.activate;
 X.activate=engine=>{activate(engine);throw Error('Injected transition activation failure');};
 try{assert.throws(()=>N.commit(home,preview),/Injected transition/);assert.deepEqual(home.export(),before);assert.deepEqual(home.scenarioContext,context);assert.equal(active(),registries);}
 finally{X.activate=activate;}
 assert.equal(native(N.commit(home,preview)).scenarioContext!.sceneId,'far');
});
test('Saved journey checkpoints reject unknown owners, missing states and corrupt native values',()=>{
 const home=launch(pack()),ctx=home.scenarioContext!,journey=ctx.journey!;
 for(const mutate of [(j:LWSceneGraph.Journey)=>j.visited.push('missing'),(j:LWSceneGraph.Journey)=>{delete j.checkpoints.home;},(j:LWSceneGraph.Journey)=>j.checkpoints.room=C.copy(j.checkpoints.home!),
  (j:LWSceneGraph.Journey)=>{j.checkpoints.home!.player={coins:'broken'};},(j:LWSceneGraph.Journey)=>{j.checkpoints.home!.journey={pack:{}};}]){
  const changed=C.copy(journey),registries=active();mutate(changed);assert.throws(()=>N.check(changed,ctx));assert.equal(active(),registries);
 }
 const changed=C.copy(ctx);changed.sceneName='Wrong';assert.throws(()=>N.check(journey,changed),/context does not match/);
});
test('Aggregate journey budget rejects excessive checkpoints before importing them',()=>{
 const home=launch(pack()),j=C.copy(home.scenarioContext!.journey!);j.checkpoints.home!.excess=new Array(200001).fill(0);
 const before=active();assert.throws(()=>N.check(j,home.scenarioContext!),/too deeply nested|aggregate checkpoint/);assert.equal(active(),before);
});
test('Portable stories and captures retain the complete graph and dormant world progress',()=>{
 let home=launch(pack());home.advance(3);const homeState=home.export();const far=move(home,'far');far.advance(4);const farState=far.export();
 const restored=root.LWStory.commit(root.LWStory.inspect(root.LWStory.encode(far)));assert.deepEqual(restored.export(),farState);assert.equal(restored.scenarioContext!.journey!.pack.scenes.length,4);
 home=move(restored,'home');assert.deepEqual(home.export(),homeState);const captured=X.capture(home);assert.equal(captured.worlds.length,2);assert.equal(captured.scenes.length,4);assert.equal(captured.scenes[2]!.initialState.player,undefined);
 assert.deepEqual(launch(captured,'far').export(),farState);const before=active(),doc=root.LWStory.encode(home),ctx=doc.experience as LWContentPorts.ExperienceContext;
 ctx.journey!.checkpoints.far!.player={coins:'corrupt'};doc.experienceFingerprint=X.hash(ctx);assert.throws(()=>root.LWStory.inspect(doc));assert.equal(active(),before);
});
test('Portable journey import rejects split current authority and rolls back failed activation',()=>{
 const far=move(launch(pack()),'far');far.advance(2);const saved=root.LWStory.encode(far),source=launch(pack()),before=source.export(),registries=active();
 const split=C.copy(saved),ctx=split.experience as LWContentPorts.ExperienceContext;
 (ctx.journey!.checkpoints.far!.player as {coins:number}).coins++;split.experienceFingerprint=X.hash(X.checkContext(ctx));
 assert.throws(()=>root.LWStory.inspect(split),/checkpoint|native state/i);assert.equal(active(),registries);
 const preview=root.LWStory.inspect(saved),activate=X.activate;
 X.activate=engine=>{activate(engine);throw Error('Injected journey import activation failure');};
 try{assert.throws(()=>root.LWStory.commit(preview),/Injected journey import/);assert.equal(active(),registries);assert.deepEqual(source.export(),before);}
 finally{X.activate=activate;}
 assert.deepEqual(root.LWStory.commit(preview).export(),far.export());
});
test('Full Office catalogs support independent cross-world work, upstairs views and exact SDK story revisits',()=>{
 const p=X.builtins().find(row=>row.id==='office')!,home=p.scenes[0]!,far=C.copy(home),world=C.copy(p.worlds[0]!);
 world.id='office-away';world.name='Second office';p.worlds.push(world);far.id='office-away';far.name='Second shift';far.worldId=world.id;
 home.graph={kind:'level',connections:[{id:'away',label:'Second office',targetSceneId:far.id},{id:'upstairs',label:'Packing floor',targetSceneId:'office-upper'}]};
 far.graph={kind:'level',connections:[{id:'home',label:'First office',targetSceneId:home.id}]};
 p.scenes.push(far,{id:'office-upper',name:'Packing floor',description:'Live native upstairs work',worldId:home.worldId,initialState:{},
  graph:{kind:'interior',parentId:home.id,binding:{type:'interior',sourceSceneId:home.id,buildingId:'office-packing',floorId:'upper'},connections:[{id:'home',label:'First office',targetSceneId:home.id}]}});
 const session=sdk.toolbox.createScenario(p,home.id);session.advance(2);const before=session.save();
 session.enterScene(session.reviewScene('upstairs'));assert.deepEqual(session.save(),before);assert.deepEqual(session.sceneTarget(),{type:'interior',buildingId:'office-packing',floorId:'upper'});
 session.enterScene(session.reviewScene('home'));session.enterScene(session.reviewScene('away'));session.advance(3);const away=session.save(),portable=session.story();session.dispose();
 const restored=sdk.toolbox.openStory(sdk.toolbox.reviewStory(portable));assert.deepEqual(restored.save(),away);
 const context=(portable.experience as LittlewildDeveloper.Document).journey as LittlewildDeveloper.Document;
 const checkpoints=context.checkpoints as LittlewildDeveloper.Document;
 for(const value of Object.values(checkpoints))assert.equal((value as LittlewildDeveloper.Document).scenarioResources,undefined);
 for(const selected of (context.pack as LittlewildDeveloper.Document).scenes as LittlewildDeveloper.Document[])assert.equal((selected.initialState as LittlewildDeveloper.Document).scenarioResources,undefined);
 restored.enterScene(restored.reviewScene('home'));assert.deepEqual(restored.save(),before);
 restored.enterScene(restored.reviewScene('away'));assert.deepEqual(restored.save(),away);restored.dispose();
});
test('Portable journey libraries cannot diverge from the pack and silently change on transition',()=>{
 const engine=launch(pack()),saved=root.LWStory.encode(engine);
 for(const envelope of ['content','adventure','world','growth']){
  const doc=C.copy(saved),library=(doc[envelope] as {library:Record<string,unknown>;fingerprint:string}).library;
  if(envelope==='content')((library.components as {items:{name:string}[]}).items[0]!).name='Split item';
  else if(envelope==='adventure')library.revision='5.9.0';
  else if(envelope==='world')library.name='Split world';
  else ((library.features as {name:string}[])[0]!).name='Split growth';
  (doc[envelope] as {fingerprint:string}).fingerprint=C.fingerprint(library);
  const before=active();assert.throws(()=>root.LWStory.inspect(doc),/journey.*librar|librar.*journey/i);assert.equal(active(),before);
 }
});
test('Whole portable capacity rejects a larger journey before replacing its live SDK engine',()=>{
 const p=pack(),home=p.scenes[0]!;
 for(let i=0;i<6;i++){
  const extra=C.copy(p.scenes[1]!);extra.id='extra-'+i;extra.name='Extra world '+i;
  extra.graph={kind:'level',connections:[{id:'home',label:'Return home',targetSceneId:'home'}]};p.scenes.push(extra);
  home.graph!.connections!.push({id:extra.id,label:extra.name,targetSceneId:extra.id});
 }
 assert(X.validate(p).ok);const session=sdk.toolbox.createScenario(p,'home');let rejected=false;
 for(const id of ['far',...Array.from({length:6},(_,i)=>'extra-'+i)]){
  const before=session.save(),context=session.inspect(),registries=active();
  try{session.enterScene(session.reviewScene(id));}
  catch(error){assert.match(String(error),/too deeply nested|too many values/i);assert.deepEqual(session.save(),before);assert.deepEqual(session.inspect(),context);assert.equal(active(),registries);rejected=true;break;}
  session.enterScene(session.reviewScene('home'));
 }
 assert(rejected,'Expected the shared portable capacity to bound accumulated owner checkpoints');
 const saved=session.save(),story=session.story();session.dispose();const restored=sdk.toolbox.openStory(sdk.toolbox.reviewStory(story));assert.deepEqual(restored.save(),saved);restored.dispose();
});
const report={passed:results.filter(r=>r.passed).length,total:results.length,results};
fs.writeFileSync(__dirname+'/scene-navigation-results.json',JSON.stringify(report,null,2));console.log(report.passed+'/'+report.total);if(report.passed!==report.total)process.exitCode=1;
