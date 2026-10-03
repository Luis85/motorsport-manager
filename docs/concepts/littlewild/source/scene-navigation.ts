/// <reference path="./scene-navigation-contracts.d.ts" />
/* One active native engine; journey checkpoints are detached, dormant values.
 * Review and admission stay synchronous and restore all temporary libraries. */
(function(inputRoot:unknown){
 'use strict';
 interface Root {LWContent:LWContentPorts.ContentApi;LWScenarios:LWContentPorts.ScenarioApi;LWSceneGraph:LWSceneGraph.Api;LWSceneNavigation?:LWSceneNavigation.NavigationApi;}
 interface InteriorEngine extends LWContentPorts.ScenarioEngine {buildingInterior?(id:string):{floors:{id:string}[]}|null;}
 interface Review {source:LWContentPorts.ScenarioEngine;sourceHash:string;previewHash:string;journey:LWSceneGraph.Journey;}
 const root=inputRoot as Root,C=root.LWContent;
 const node=typeof module!=='undefined'&&module.exports;
 const graph=(node?require('./scene-graph.js'):root.LWSceneGraph) as LWSceneGraph.Api;
 const reviews=new WeakMap<object,Review>();
 const scenarios=():LWContentPorts.ScenarioApi=>root.LWScenarios;
 const record=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 const fail=(message:string):never=>{throw Error('Scene journey: '+message);};
 function bounded(input:unknown):LWSceneGraph.Journey{
  const parsed=C.parse(input,8*1024*1024);
  let count=0;
  function visit(value:unknown):void{
   if(++count>200000)fail('aggregate checkpoint value limit exceeded');
   if(value&&typeof value==='object')for(const item of Object.values(value))visit(item);
  }
  visit(parsed);
  if(!record(parsed)||Object.keys(parsed).some(key=>!['pack','checkpoints','visited','storytelling'].includes(key))||!Object.hasOwn(parsed,'pack')||!record(parsed.checkpoints)||!Array.isArray(parsed.visited))fail('invalid saved journey');
  return parsed as unknown as LWSceneGraph.Journey;
 }
 function accepted(pack:unknown):LWContentPorts.ScenarioPack{
  const checked=scenarios().validate(pack);
  if(!checked.ok)return fail(checked.errors.join('\n'));
  return checked.pack;
 }
 function scene(pack:LWContentPorts.ScenarioPack,id:string):LWContentPorts.Scene{
  return pack.scenes.find(s=>s.id===id)??fail('unknown scene '+id);
 }
 function owner(pack:LWContentPorts.ScenarioPack,id:string):LWContentPorts.Scene{return graph.owner(pack,id);}
 function normalizeState(state:Record<string,unknown>):Record<string,unknown>{
  const normalized=C.copy(state);delete normalized.scenarioResources;return normalized;
 }
 function compactPack(pack:LWContentPorts.ScenarioPack):LWContentPorts.ScenarioPack{
  const compact=C.copy(pack);
  for(const selected of compact.scenes)delete selected.initialState.scenarioResources;
  return compact;
 }
 function patched(journey:LWSceneGraph.Journey):LWContentPorts.ScenarioPack{
  const pack=C.copy(journey.pack);
  for(const [id,state]of Object.entries(journey.checkpoints))scene(pack,id).initialState=C.copy(state);
  return pack;
 }
 function snapshot(engine:LWContentPorts.ScenarioEngine):Record<string,unknown>{return normalizeState(engine.export().state);}
 function portableBudget(engine:LWContentPorts.ScenarioEngine,journey:LWSceneGraph.Journey):void{
  const experience={...engine.scenarioContext,journey};delete experience.resources;
  const libraries=journey.pack.libraries,envelope=(library:unknown)=>({fingerprint:'0000000000000000',library});
  // Bound the whole eventual story, rather than admitting a journey that the
  // native story/SDK boundary cannot inspect after replacing its live engine.
  C.parse({app:'littlewild',version:10,savedAt:'2000-01-01T00:00:00.000Z',state:engine.export().state,
   content:envelope(libraries.base),adventure:envelope(libraries.adventure),world:envelope(libraries.world),growth:envelope(libraries.growth),
   experience,experienceFingerprint:'0000000000000000',simulationFingerprint:'0000000000000000',envelopeReserve:Array(64).fill(0)},8*1024*1024);
 }
 function sourceHash(engine:LWContentPorts.ScenarioEngine):string{return scenarios().hash({state:scenarios().hash(engine.export().state),context:scenarios().hash(engine.scenarioContext)});}
 function previewHash(preview:LWSceneNavigation.TransitionPreview):string{
  return scenarios().hash({connectionId:preview.connectionId,sourceSceneId:preview.sourceSceneId,sceneId:preview.sceneId,sceneName:preview.sceneName,
   target:preview.target,messages:preview.messages,scene:{pack:scenarios().hash(preview.scene.pack),fingerprint:preview.scene.fingerprint,sceneId:preview.scene.sceneId,messages:preview.scene.messages,
    state:scenarios().hash(preview.scene.engine.export().state),context:scenarios().hash(preview.scene.context),engineContext:scenarios().hash(preview.scene.engine.scenarioContext)}});
 }
 function check(input:unknown,context:LWContentPorts.ExperienceContext):LWSceneGraph.Journey{
  const journey=bounded(input),pack=accepted(journey.pack),current=scene(pack,context.sceneId);
  if(!pack.scenes.some(s=>s.graph))fail('saved journey requires an authored graph');
  if(pack.scenes.some(s=>Object.hasOwn(s.initialState,'scenarioResources')))fail('journey scene resources belong to its pack catalog');
  const expected={packId:pack.id,name:pack.name,version:pack.version,sceneName:current.name,worldId:current.worldId,
   world:pack.worlds.find(w=>w.id===current.worldId),simulation:pack.simulation,presentation:pack.presentation,tutorial:pack.tutorial,resources:pack.resources};
  const actual={packId:context.packId,name:context.name,version:context.version,sceneName:context.sceneName,worldId:context.worldId,
   world:context.world,simulation:context.simulation,presentation:context.presentation,tutorial:context.tutorial,resources:context.resources};
  if(C.stable(expected)!==C.stable(actual))fail('saved context does not match the journey scene');
  if(journey.visited.length>pack.scenes.length||new Set(journey.visited).size!==journey.visited.length||
   journey.visited.some(id=>typeof id!=='string'||!pack.scenes.some(s=>s.id===id))||!journey.visited.includes(current.id))fail('invalid visited scenes');
  for(const [id,state]of Object.entries(journey.checkpoints)){
   const source=scene(pack,id);
   if(source.graph?.binding||!record(state)||!journey.visited.some(v=>owner(pack,v).id===id))fail('checkpoint has no visited native owner');
   if(Object.hasOwn(state,'scenarioResources'))fail('checkpoint resources belong to its pack catalog');
  }
  for(const id of journey.visited)if(!Object.hasOwn(journey.checkpoints,owner(pack,id).id))fail('visited scene is missing its checkpoint');
  if(journey.storytelling!==undefined){
   const story=journey.storytelling;
   if(!record(story)||story.version!==1||Object.keys(story).length!==4)return fail('invalid storytelling progress');
   for(const field of ['once','triggers','completed'] as const){
    const ids=story[field];if(!Array.isArray(ids)||ids.length>1024||new Set(ids).size!==ids.length)return fail('invalid storytelling progress IDs');
    for(const key of ids){
     if(typeof key!=='string'||key.length>129)return fail('invalid storytelling progress key');
     const [sceneId,id,...rest]=key.split('|'),selected=pack.scenes.find(row=>row.id===sceneId);
     if(rest.length||!selected||!id)return fail('unknown storytelling progress scene');
     if(field==='triggers'?!selected.graph?.triggers?.some(row=>row.id===id):!pack.storytelling?.cutscenes.some(row=>row.id===id&&row.sceneId===sceneId))return fail('unknown storytelling progress reference');
    }
   }
  }
  // Full pack validation checks every owner checkpoint once, under its own world
  // and libraries. Native state cannot embed another journey/context recursively.
  accepted(patched({...journey,pack}));
  return C.copy({...journey,pack});
 }
 function start(engine:LWContentPorts.ScenarioEngine,pack:LWContentPorts.ScenarioPack,id:string):void{
  if(!engine.scenarioContext)return fail('scene context is missing');
  if(!pack.scenes.some(s=>s.graph))return;
  const journey:LWSceneGraph.Journey={...(pack.storytelling?.progress?{storytelling:C.copy(pack.storytelling.progress)}:{}),pack:compactPack(pack),checkpoints:{[owner(pack,id).id]:snapshot(engine)},visited:[id]};
  portableBudget(engine,journey);
  engine.scenarioContext.journey=bounded(journey);
 }
 function liveJourney(engine:LWContentPorts.ScenarioEngine):LWSceneGraph.Journey{
  const context=engine.scenarioContext;
  if(!context?.journey)return fail('this story has no scene connections');
  return check(context.journey,context);
 }
 function checkpoint(engine:LWContentPorts.ScenarioEngine):LWSceneGraph.Journey{
  const journey=liveJourney(engine);
  journey.checkpoints[owner(journey.pack,engine.scenarioContext!.sceneId).id]=snapshot(engine);
  return bounded(journey);
 }
 function capture(engine:LWContentPorts.ScenarioEngine):LWContentPorts.ScenarioPack|null{
  if(!engine.scenarioContext?.journey)return null;
  const journey=checkpoint(engine);
  const captured=patched(journey);if(journey.storytelling){captured.storytelling??={version:1,cutscenes:[],storyboards:[]};captured.storytelling.progress=C.copy(journey.storytelling);}
  return accepted(captured);
 }
 function bindingTarget(engine:LWContentPorts.ScenarioEngine,pack:LWContentPorts.ScenarioPack,id:string):LWSceneGraph.BindingTarget|null{
  const binding=scene(pack,id).graph?.binding;
  if(!binding)return null;
  if(binding.type==='island'){
   const state=snapshot(engine),estate=record(state.estate)?state.estate:null;
   if(!Array.isArray(estate?.islands)||!estate.islands.some(i=>record(i)&&i.ix===binding.ix&&i.iy===binding.iy))fail('bound island is no longer owned');
   return {type:'island',ix:binding.ix,iy:binding.iy};
  }
  const room=(engine as InteriorEngine).buildingInterior?.(binding.buildingId),floor=room?.floors.find(f=>f.id===binding.floorId);
  if(!floor)return fail('bound building floor is unavailable');
  return {type:'interior',buildingId:binding.buildingId,floorId:floor.id};
 }
 function target(engine:LWContentPorts.ScenarioEngine):LWSceneGraph.BindingTarget|null{
  const context=engine.scenarioContext;
  return context?.journey?bindingTarget(engine,context.journey.pack,context.sceneId):null;
 }
 function connectionIssue(engine:LWContentPorts.ScenarioEngine,id:string):string|null{
  try{
   const context=engine.scenarioContext;if(!context?.journey)return 'This story has no scene connections.';
   const journey=bounded(context.journey),source=scene(journey.pack,context.sceneId),connection=source.graph?.connections?.find(c=>c.id===id);
   if(!connection)return 'Choose a connection in the active scene.';
   const state=snapshot(engine),destination=scene(journey.pack,connection.targetSceneId);
   const issue=graph.entryIssue([...(connection.requirements??[]),...(destination.graph?.requirements??[])],state);if(issue)return issue;
   journey.checkpoints[owner(journey.pack,source.id).id]=state;
   graph.validate(patched(journey));return null;
  }catch(error){return error instanceof Error?error.message:String(error);}
 }
 function prepare(engine:LWContentPorts.ScenarioEngine,connectionId:string):LWSceneNavigation.TransitionPreview{
  const journey=liveJourney(engine),sourceId=engine.scenarioContext!.sceneId,source=scene(journey.pack,sourceId);
  const connection=source.graph?.connections?.find(c=>c.id===connectionId)??fail('choose a connection in the active scene');
  const destination=scene(journey.pack,connection.targetSceneId),state=snapshot(engine);
  const issue=graph.entryIssue([...(connection.requirements||[]),...(destination.graph?.requirements||[])],state);
  if(issue)fail(issue);
  journey.checkpoints[owner(journey.pack,sourceId).id]=state;
  if(!journey.visited.includes(destination.id))journey.visited.push(destination.id);
  const pack=patched(journey),destinationOwner=owner(pack,destination.id);
  // Settings, paid jobs, inventory, time and RNG belong to each owner's native
  // checkpoint. Camera and selected room remain detached presentation intent.
  const prepared=scenarios().prepareScene(pack,destination.id,state,connection.events??[]);
  journey.checkpoints[destinationOwner.id]=snapshot(prepared.engine);
  bounded(journey);
  prepared.context.journey=C.copy(journey);prepared.engine.scenarioContext=prepared.context;
  portableBudget(prepared.engine,journey);
  const preview={connectionId,sourceSceneId:sourceId,sceneId:destination.id,sceneName:destination.name,
   target:bindingTarget(prepared.engine,pack,destination.id),messages:C.copy(prepared.messages),scene:prepared};
  reviews.set(preview,{source:engine,sourceHash:sourceHash(engine),previewHash:previewHash(preview),journey:C.copy(journey)});
  return preview;
 }
 function commit(engine:LWContentPorts.ScenarioEngine,preview:LWSceneNavigation.TransitionPreview):LWContentPorts.ScenarioEngine{
  const review=preview&&reviews.get(preview);
  if(!review||review.source!==engine||review.sourceHash!==sourceHash(engine)||review.previewHash!==previewHash(preview))return fail('transition review is stale; review again');
  const next=scenarios().transaction(()=>{
   const value=scenarios().commitScene(preview.scene);
   value.scenarioContext!.journey=C.copy(review.journey);
   // Activation is still in the enclosing transaction, including failed hooks.
   scenarios().activate(value);
   bindingTarget(value,review.journey.pack,preview.sceneId);
   return value;
  });
  reviews.delete(preview);
  return next;
 }
 const api:LWSceneNavigation.NavigationApi={start,check,checkpoint,normalizeState,capture,target,connectionIssue,prepare,commit};
 root.LWSceneNavigation=api;if(node)module.exports=api;
})(globalThis);
