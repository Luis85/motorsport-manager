/// <reference path="./content-provider-contracts.d.ts" />
/// <reference path="./balancing-tools-contracts.d.ts" />
/* Review transactions edit detached whole packs; no active registries or host leases are acquired. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWContentProvider?:LWContentProvider.Api;LWContent:LWContentPorts.ContentApi;LWScenarios:LWContentPorts.ScenarioApi;LWSceneGraph:LWSceneGraph.Api;LWSimulationProfile:{validate(input:unknown):LWContentPorts.SimulationProfile};LWScenarioResources:{validate(input:unknown):LWContentPorts.Resources;defaults():LWContentPorts.Resources};LWInteractions:LWInteraction.Catalog;LWInteriors:LWInterior.CatalogApi;LWBalancingCore?:LWBalancing.Core};
 const C=root.LWContent,X=root.LWScenarios,node=typeof module!=='undefined'&&module.exports;
 const Content=(node?require('./content-provider.js'):root.LWContentProvider) as LWContentProvider.Api;
 const game=(what:string):LWContentProvider.Profile=>Content.get(what);
 const reviews=new WeakMap<object,{base:string;candidate:LWContentPorts.ScenarioPack}>();
 const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
 const hash=(v:unknown):string=>C.fingerprint({schemaVersion:1,components:v});
 function pack(input:unknown):LWContentPorts.ScenarioPack{const checked=X.validate(input);if(!checked.ok)throw Error(checked.errors.join('\n'));return checked.pack;}
 function decodeBalance(input:unknown):LWBalancing.Document{
  const data=C.parse(input,12*1024*1024),keys=['format','schemaVersion','libraries','simulation','world','creatures','interactions','interiors','startingScenes','sceneId'];
  if(!object(data)||Object.keys(data).length!==keys.length||keys.some(k=>!Object.hasOwn(data,k))||data.format!=='littlewild-balancing'||data.schemaVersion!==1||typeof data.sceneId!=='string')throw Error('Expected a complete littlewild-balancing schema-1 document.');
  if(object(data.creatures)&&data.creatures.format==='littlewild-creature-balancing'){
   const creatures=game('authored creature definitions').creatures,authored={configuration:creatures?.configuration,definitions:creatures?.definitions as unknown[]};
   const balancer=(node?require('./creature-balancing.js'):(globalThis as unknown as {LWCreatureBalancing:unknown}).LWCreatureBalancing) as {merge(base:LWContentPorts.Resources['creatures'],overlay:unknown):LWContentPorts.Resources['creatures']};data.creatures=balancer.merge(authored,data.creatures);
  }
  const checked=data as unknown as LWBalancing.Document;
  checked.simulation=root.LWSimulationProfile.validate(checked.simulation);
  checked.interactions=X.withRuntime(checked.libraries,checked.simulation,()=>root.LWInteractions.validate(checked.interactions));
  checked.interiors=root.LWInteriors.validate(checked.interiors);
  return C.copy(checked);
 }
 function defaults():LWBalancing.Document{return decodeBalance(game('canonical balancing defaults').balancing);}
 function baseline():LWContentPorts.ScenarioPack{const canonical=game('the canonical balancing scenario').scenarios?.canonicalId,value=canonical===undefined?undefined:X.builtins().find(p=>p.id===canonical);if(!value)throw Error('Default balancing scenario unavailable.');return C.copy(value);}
 function capture(input:unknown,sceneId?:string):LWBalancing.Document{
  const value=pack(input),scene=value.scenes.find(s=>s.id===(sceneId??value.scenes[0]?.id));if(!scene)throw Error('Choose a scene in this pack.');
  const world=value.worlds.find(w=>w.id===scene.worldId);if(!world)throw Error('Scene world missing.');
  const defaultsDoc=defaults(),state=root.LWSceneGraph.owner(value,scene.id).initialState;
  const interactions=object(state.creatureInteractions)?state.creatureInteractions.library:undefined;
  const interiors=object(state.interiors)?state.interiors.catalog:undefined;
  return decodeBalance({format:'littlewild-balancing',schemaVersion:1,sceneId:scene.id,libraries:value.libraries,simulation:value.simulation,world,startingScenes:value.scenes,creatures:value.resources?.creatures??defaultsDoc.creatures,interactions:interactions??defaultsDoc.interactions,interiors:interiors??defaultsDoc.interiors});
 }
 function candidate(inputPack:unknown,input:unknown):LWContentPorts.ScenarioPack{
  const value=pack(inputPack),data=decodeBalance(input);
  value.libraries=C.copy(data.libraries);value.simulation=C.copy(data.simulation);
  const matching=value.worlds.find(w=>w.id===data.world.id);if(!matching)throw Error('/world: keep an existing world ID from the complete pack.');
  value.worlds=value.worlds.map(w=>w.id===data.world.id?C.copy(data.world):w);
  const fallback=root.LWScenarioResources.defaults();
  if(value.resources||C.stable(data.creatures)!==C.stable(fallback.creatures))value.resources={...(value.resources??fallback),creatures:C.copy(data.creatures)};
  const inherited=defaults(),target=root.LWSceneGraph.owner(value,data.sceneId);
  if(target.worldId!==data.world.id)throw Error('/sceneId: choose a scene belonging to the tuned world.');
  // Runtime initialization can seed absence; authored snapshots keep all clocks/records intact.
  for(const scene of value.scenes){
   if(scene.id!==target.id||scene.graph?.binding)continue;
   const state=scene.initialState;
   const time=typeof state.simTime==='number'?state.simTime:0;
   const clocks=object(state.creatureInteractions)&&object(state.creatureInteractions.triggerAt)?state.creatureInteractions.triggerAt:{};
   const triggerAt=Object.fromEntries(data.interactions.triggers.map(rule=>[rule.id,clocks[rule.id]??time+rule.intervalSeconds]));
   if(state.creatureInteractions||C.stable(data.interactions)!==C.stable(inherited.interactions))state.creatureInteractions={...(object(state.creatureInteractions)?state.creatureInteractions:{version:1,sequence:1,active:[],history:[],cooldowns:{},seeks:[]}),library:C.copy(data.interactions),fingerprint:root.LWInteractions.fingerprint(data.interactions),triggerAt};
   if(object(state.interiors))state.interiors={...state.interiors,catalog:C.copy(data.interiors)};
   else if(C.stable(data.interiors)!==C.stable(inherited.interiors))state.interiors={version:1,catalog:C.copy(data.interiors),locations:{},visits:[],production:{},jobs:{}};
  }
  for(const scene of value.scenes)if(scene.initialState.scenarioResources)scene.initialState.scenarioResources=C.copy(value.resources);
  return pack(value);
 }
 function startingPack(input:unknown,template:unknown=baseline()):LWContentPorts.ScenarioPack{
  const data=decodeBalance(input),value=pack(template);value.scenes=C.copy(data.startingScenes);return candidate(value,data);
 }
 function validate(input:unknown,inputPack:unknown=baseline()):LWBalancing.Validation{
  try{candidate(inputPack,input);return {ok:true,errors:[],data:decodeBalance(input)};}
  catch(error){return {ok:false,errors:[{path:'/',code:'invalid-balancing',message:error instanceof Error?error.message:String(error)}],data:null};}
 }
 function diff(before:unknown,after:unknown):{changes:LWBalancing.Change[];total:number;truncated:boolean}{
  const a=C.parse(before,12*1024*1024),b=C.parse(after,12*1024*1024),changes:LWBalancing.Change[]=[];let total=0;
  function visit(left:unknown,right:unknown,path:string):void{
   if(C.stable(left)===C.stable(right))return;
   if(object(left)&&object(right)||Array.isArray(left)&&Array.isArray(right)){
    const l=left as Record<string,unknown>,r=right as Record<string,unknown>;
    for(const key of [...new Set([...Object.keys(l),...Object.keys(r)])].sort())visit(l[key],r[key],path+'/'+key.replace(/~/g,'~0').replace(/\//g,'~1'));
   }else{total++;if(changes.length<256)changes.push({path:path||'/',before:left??null,after:right??null});}
  }
  visit(a,b,'');return {changes,total,truncated:total>changes.length};
 }
 function committed(value:LWContentPorts.ScenarioPack):boolean{
  return value.scenes.some(scene=>{
   const state=scene.initialState,colony=object(state.colony)?state.colony:{};
   const actors=Array.isArray(colony.creatures)?colony.creatures:[];
   const buildings=Array.isArray(state.buildings)?state.buildings:[];
   const interaction=object(state.creatureInteractions)?state.creatureInteractions:{};
   if(Array.isArray(interaction.active)&&interaction.active.length)return true;
   const interiors=object(state.interiors)?state.interiors:{};
   if(object(interiors.jobs)&&Object.keys(interiors.jobs).length||object(interiors.production)&&Object.values(interiors.production).some(rows=>Array.isArray(rows)&&rows.length))return true;
   return actors.some(actor=>object(actor)&&(actor.task!==null&&actor.task!==undefined||!!actor.activeQuest||Array.isArray(actor.orders)&&actor.orders.some(order=>object(order)&&!!order.paid)))||buildings.some(b=>object(b)&&object(b.storage)&&!!b.storage.job)||object(state.market)&&Array.isArray(state.market.orders)&&state.market.orders.some(q=>object(q)&&!['done','cancelled'].includes(String(q.status)));
  });
 }
 function review(inputPack:unknown,input:unknown):LWBalancing.Review{
  const base=pack(inputPack),data=decodeBalance(input),next=candidate(base,data),summary=diff(base,next);
  const startingChange=C.stable(base.scenes)!==C.stable(data.startingScenes);
  const token:LWBalancing.Review=Object.freeze({format:'littlewild-balancing-review',baseFingerprint:hash(base),candidateFingerprint:hash(next),...summary,changes:Object.freeze(summary.changes),blocked:startingChange?'Starting scene edits require startingPack() to create a new story.':summary.total&&committed(base)?'Finish committed tasks, paid production, quests, sales and pending or active interactions before changing balancing.':null});
  reviews.set(token,{base:hash(base),candidate:next});return token;
 }
 function apply(inputPack:unknown,review:LWBalancing.Review):LWContentPorts.ScenarioPack{
  const prepared=reviews.get(review);if(!prepared)throw Error('Use the original balancing review token.');
  if(hash(pack(inputPack))!==prepared.base)throw Error('The complete pack changed; review balancing again.');
  if(review.blocked)throw Error(review.blocked);reviews.delete(review);return C.copy(prepared.candidate);
 }
 const api:LWBalancing.Core=Object.freeze({defaults,startingPack,capture,validate,review,apply,diff,candidate});root.LWBalancingCore=api;if(node)module.exports=api;
})(globalThis);
