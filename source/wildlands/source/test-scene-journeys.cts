/// <reference path="./scene-navigation-contracts.d.ts" />
/// <reference path="./building-interior-contracts.d.ts" />
// Portable story and journey persistence across scene navigation (split from scene-navigation; same check names).
import assert from 'node:assert/strict';
import {active,C,checks,launch,move,native,pack,root,sdk,X} from './test-support/scene-journeys.cjs';
const {test,finish}=checks(__dirname+'/scene-journeys-results.json');
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
finish();
