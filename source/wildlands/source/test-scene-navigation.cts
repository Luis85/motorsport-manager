/// <reference path="./renderer-data-contracts.d.ts" />
/// <reference path="./scene-navigation-contracts.d.ts" />
/// <reference path="./building-interior-contracts.d.ts" />
// Live scene navigation: transitions, entry gates, atomic rejection and the accepted-pack memo.
// Portable story/journey persistence checks run as the separate scene-journeys suite.
import assert from 'node:assert/strict';
import {active,C,checks,launch,move,N,native,pack,root,sdk,until,X} from './test-support/scene-journeys.cjs';
const {test,finish}=checks(__dirname+'/scene-navigation-results.json');
test('Resource-bearing lazy native owners preserve canonical checkpoint bytes without export mutation',()=>{
 const p=pack();
 for(const scene of p.scenes){delete scene.initialState.interiors;delete scene.initialState.creatureInteractions;delete scene.initialState.scenarioResources;}
 const engine=launch(p);assert(engine.s.scenarioResources);assert.equal(engine.s.interiors,undefined);assert(!Object.hasOwn(engine.s,'creatureInteractions'));
 engine.step(.1);assert(engine.s.interiors);assert(Object.hasOwn(engine.s,'creatureInteractions'));
 const live=C.copy(engine.s),keys=Object.keys(engine.s),before=engine.export();
 assert.equal(Object.keys(before.state).at(-1),'scenarioResources');assert.deepEqual(C.copy(engine.s),live);assert.deepEqual(Object.keys(engine.s),keys);
 const detached=engine.export();(detached.state.scenarioResources as LWContentPorts.Resources).assets.length=0;
 assert.deepEqual(C.copy(engine.s),live);assert.deepEqual(engine.export(),before);
 const reordered=C.copy(before),resources=reordered.state.scenarioResources;delete reordered.state.scenarioResources;
 reordered.state={scenarioResources:resources,...reordered.state};
 const imported=root.LW.Engine.import(reordered);assert.equal(JSON.stringify(imported.export()),JSON.stringify(before));
 const far=move(engine,'far'),returned=move(far,'home');assert.equal(JSON.stringify(returned.export()),JSON.stringify(before));
 const room=move(returned,'room');assert.equal(JSON.stringify(room.export()),JSON.stringify(before));
 const restored=root.LWStory.commit(root.LWStory.inspect(root.LWStory.encode(room)));assert.equal(JSON.stringify(restored.export()),JSON.stringify(before));
 assert.equal(JSON.stringify(move(restored,'home').export()),JSON.stringify(before));assert.deepEqual(C.copy(engine.s),live);assert.deepEqual(Object.keys(engine.s),keys);
});
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
test('Accepted pack validation is memoized by exact pack content and extension catalogs and hands out detached packs',()=>{
 const p=pack(),first=X.validate(p),second=X.validate(p);
 assert(first.ok&&second.ok);assert.deepEqual(second.pack,first.pack);assert.notEqual(second.pack,first.pack);assert.equal(second.fingerprint,first.fingerprint);assert.equal(second.sceneCount,first.sceneCount);
 first.pack.name='Mutated accepted copy';(first.pack.scenes[0]!.initialState.player as {coins:number}).coins=-5;
 const third=X.validate(p);assert(third.ok);assert.deepEqual(third.pack,second.pack);
 // Equal content in another key order is a different exact input: its accepted copy keeps that order.
 const reordered=Object.fromEntries(Object.entries(p).reverse()) as unknown as LWContentPorts.ScenarioPack,fourth=X.validate(reordered);
 assert(fourth.ok);assert.deepEqual(Object.keys(fourth.pack),Object.keys(reordered));const fifth=X.validate(p);assert(fifth.ok);assert.deepEqual(Object.keys(fifth.pack),Object.keys(p));
 // Editing the same input object is new content: an invalid edit is rejected, and restoring it is accepted again.
 const player=p.scenes[0]!.initialState.player as {coins:number},coins=player.coins;player.coins=-1;
 const rejected=X.validate(p);assert(!rejected.ok&&rejected.errors.length>0);player.coins=coins;assert(X.validate(p).ok);
 // Registering a renderer whose metadata excludes the authored dimension rejects the accepted pack until it is withdrawn.
 p.scenes[0]!.graph={...p.scenes[0]!.graph!,rendering:{dimension:'3d',rendererId:'memo-probe'}};
 assert(X.validate(p).ok,'An unregistered renderer ID remains portable data.');
 const records=(globalThis as unknown as {LWRendererCatalogRecords:{add(metadata:LittlewildRenderer.Metadata):()=>void}}).LWRendererCatalogRecords;
 const withdraw=records.add({id:'memo-probe',name:'Memo probe',description:'Two-dimensional extension metadata.',capabilities:[],dimensions:['2d']});
 try{const conflicting=X.validate(p);assert(!conflicting.ok);assert.match(conflicting.errors.join('\n'),/does not support dimension 3d/);}finally{withdraw();}
 assert(X.validate(p).ok);
});
finish();
