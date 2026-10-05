/// <reference path="./rts-economy-contracts.d.ts" />
/* Queues reserve costs and population once; completion publishes ECS entities. */
(function(inputRoot:unknown){
 'use strict';
 type Context=LWRTSEconomyTypes.Context;
 type Bank=LWRTSEconomyTypes.Bank;
 type Production=LWRTSEconomyTypes.Production;
 type Kind=LWRTSEconomyTypes.Kind;
 type Owner=LWRTSEconomyTypes.Owner;
 type Building=LWRTSEconomyTypes.Building;
 type Position=LWRTSEconomyTypes.Position;
 type Command=LWRTSEconomyTypes.Command;
 const root=inputRoot as {LWRTSProduction?:LWRTSEconomyTypes.ProductionAPI};
 function bank(context:Context,faction:string):Bank|undefined {
  const id=context.world.query(['rts-faction']).find(entity=>
   context.world.get<Owner>(entity,'rts-owner')?.faction===faction || entity==='rts-faction:'+faction);
  return id?context.world.get<Bank>(id,'rts-faction'):undefined;
 }
 function totals(context:Context,faction:string):{population:number;populationCap:number;power:number}{
  const result={population:0,populationCap:0,power:0};
  for(const entity of context.world.query(['rts-owner','rts-kind'])){
   if(context.world.get<Owner>(entity,'rts-owner')!.faction!==faction)continue;
   const kind=context.world.get<Kind>(entity,'rts-kind')!;
   const health=context.world.get(entity,'rts-health');if(health&&Number(health.hp)<=0)continue;
   if(kind.category==='unit')result.population+=context.catalog.get('units',kind.definition)?.population || 0;
   const building=context.world.get<Building>(entity,'rts-building');
   if(building?.complete){const definition=context.catalog.get('buildings',kind.definition);result.populationCap+=definition?.population || 0;result.power+=definition?.power || 0;}
   result.population+=(context.world.get<Production>(entity,'rts-production')?.queue || []).reduce((sum,item)=>sum+(item.spawnedId&&context.world.entities.has(item.spawnedId)?0:item.population),0);
  }
  return result;
 }
 function refresh(context:Context):void {
  for(const id of context.world.query(['rts-faction'])){
   const state=context.world.get<Bank>(id,'rts-faction')!;
   const faction=context.world.get<Owner>(id,'rts-owner')?.faction || id.replace(/^rts-faction:/,'');
   Object.assign(state,totals(context,faction));
  }
 }
 // The scheduler has flushed deferred spawns before this boundary. Retire publication
 // markers only now, so population stays reserved throughout the fixed step.
 function completeStep(context:Context):void {
  for(const id of context.world.query(['rts-production'])) {
   const production=context.world.get<Production>(id,'rts-production')!;
   production.queue=production.queue.filter(entry=>!entry.published);
  }
  refresh(context);
 }
 const affordable=(state:Bank,cost:LWRTSData.Cost):boolean=>Object.entries(cost).every(([key,value])=>(state.resources[key] || 0)>=value);
 function spend(state:Bank,cost:LWRTSData.Cost,multiplier=1):void {
  for(const [key,value]of Object.entries(cost))state.resources[key]=(state.resources[key] || 0)-value*multiplier;
 }
 function command(context:Context,input:Command):LWRTSEconomyTypes.Result|null {
  if(!['train','research','cancel'].includes(input.kind))return null;
  const id=input.entityId || input.entities?.[0] || input.entityIds?.[0] || '';
  const world=context.world,owner=world.get<Owner>(id,'rts-owner'),kind=world.get<Kind>(id,'rts-kind');
  const building=world.get<Building>(id,'rts-building'),queue=world.get<Production>(id,'rts-production');
  if(!owner||!kind||!building?.complete||!queue)return {ok:false,message:'Select a completed production building.'};
  if(input.faction&&owner.faction!==input.faction)return {ok:false,message:'The building belongs to another faction.'};
  const state=bank(context,owner.faction),definition=context.catalog.get('buildings',kind.definition);
  if(!state||!definition)return {ok:false,message:'Missing faction or building definition.'};
  if(input.kind==='cancel'){
   const index=input.index ?? 0;if(!Number.isInteger(index)||index<0||index>=queue.queue.length)return {ok:false,message:'Unknown queue entry.'};
   const entry=queue.queue[index]!;if(entry.published)return {ok:false,message:'Completed production cannot be cancelled.'};spend(state,entry.cost,-1);queue.queue.splice(index,1);refresh(context);
   context.emit({kind:'queue-cancelled',entityId:id,definitionId:entry.definitionId});return {ok:true,message:'Accepted.'};
  }
  const definitionId=input.definitionId || input.definition || '';
  const item=input.kind==='train'?context.catalog.get('units',definitionId):context.catalog.get('technologies',definitionId);
  const allowed=input.kind==='train'?definition.produces:definition.researches;
  if(!item||!allowed.includes(definitionId))return {ok:false,message:'This building cannot produce that definition.'};
  const faction=context.catalog.get('factions',owner.faction);
  if(!faction || !(input.kind==='train'?faction.units:faction.technologies).includes(definitionId))return {ok:false,message:'That definition is unavailable to this faction.'};
  if(queue.queue.length>=20)return {ok:false,message:'Production queue is full.'};
  if(input.kind==='research'){
   const technology=item as LWRTSData.Technology;
   const pending=world.query(['rts-production','rts-owner']).some(entity=>world.get<Owner>(entity,'rts-owner')!.faction===owner.faction && world.get<Production>(entity,'rts-production')!.queue.some(entry=>entry.kind==='technology'&&entry.definitionId===definitionId));
   if(state.technologies.includes(definitionId)||pending)return {ok:false,message:'Technology is already researched or queued.'};
   if(!technology.prerequisites.every(tech=>state.technologies.includes(tech)))return {ok:false,message:'Technology prerequisites are missing.'};
  }
  if(input.kind==='train'&&!(item as LWRTSData.Unit).prerequisites.every(tech=>state.technologies.includes(tech)))return {ok:false,message:'Unit technology prerequisites are missing.'};
  const population=input.kind==='train'?(item as LWRTSData.Unit).population:0;
  const usage=totals(context,owner.faction);
  if(usage.power<0)return {ok:false,message:'Restore power before starting production.'};
  if(usage.population+population>usage.populationCap)return {ok:false,message:'Build more population capacity.'};
  if(!affordable(state,item.cost))return {ok:false,message:'Insufficient resources.'};
  const total=input.kind==='train'?(item as LWRTSData.Unit).buildTime:(item as LWRTSData.Technology).researchTime;
  spend(state,item.cost);queue.queue.push({kind:input.kind==='train'?'unit':'technology',definitionId,remaining:total,total,cost:{...item.cost},population});
  refresh(context);context.emit({kind:'production-queued',entityId:id,definitionId});return {ok:true,message:'Accepted.'};
 }
 function exitPosition(context:Context,id:string,unit:LWRTSData.Unit):Position|null {
  const origin=context.world.get<Position>(id,'rts-position')!;
  const candidates:Position[]=[];
  for(let y=0;y<context.map.height;y++)for(let x=0;x<context.map.width;x++){
   const terrain=context.catalog.get('terrain',context.map.tiles[y*context.map.width+x] || '');
   if(!terrain?.passable.includes(unit.movement) || (unit.movement!=='air'&&context.map.blocked.includes(x+','+y)))continue;
   const occupied=context.world.query(['rts-unit','rts-position']).some(entity=>{const position=context.world.get<Position>(entity,'rts-position')!;const existing=context.world.get(entity,'rts-unit')!;return Math.hypot(position.x-x-.5,position.y-y-.5)<unit.radius+Number(existing.radius);});
   if(!occupied)candidates.push({x:x+.5,y:y+.5});
  }
  return candidates.sort((a,b)=>Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(b.x-origin.x,b.y-origin.y) || a.y-b.y || a.x-b.x)[0] || null;
 }
 function register(scheduler:LWRTSEconomyTypes.Scheduler,context:Context):void {
  scheduler.register({id:'rts-production',phase:'simulate',order:50,query:['rts-production','rts-building','rts-owner','rts-position'],update(world,id,dt){
   const building=world.get<Building>(id,'rts-building')!,queue=world.get<Production>(id,'rts-production')!;
   if(!building.complete)return;
   while(queue.queue[0]?.published)queue.queue.shift();
   if(!queue.queue.length)return;
   const owner=world.get<Owner>(id,'rts-owner')!,state=bank(context,owner.faction);if(!state||state.power<0)return;
   const head=queue.queue[0]!;head.remaining=Math.max(0,head.remaining-dt);if(head.remaining>1e-9)return;
   if(head.kind==='technology'){state.technologies.push(head.definitionId);context.emit({kind:'technology-completed',faction:owner.faction,definitionId:head.definitionId});}
   else {if(world.entities.size+world.pendingStructural>=1200)return;const definition=context.catalog.get('units',head.definitionId);if(!definition)return;const position=exitPosition(context,id,definition);if(!position)return;head.spawnedId=context.spawn(head.definitionId,owner.faction,position.x,position.y);context.emit({kind:'unit-trained',faction:owner.faction,definitionId:head.definitionId});}
   head.published=true;
  }});
  scheduler.register({id:'rts.ai-production',phase:'pre',order:20,query:['rts-faction','rts-owner'],update(world,id){
   const owner=world.get<Owner>(id,'rts-owner')!,faction=context.catalog.get('factions',owner.faction);
   const tick=world.get<LWRTSRuntime.State>('rts-state','rts-state')?.tick || 0;
   if(!faction?.ai.enabled||tick%Math.max(1,Math.round(faction.ai.attackInterval/.1))!==0)return;
   for(const entity of world.query(['rts-production','rts-building','rts-owner','rts-kind'])){
    if(world.get<Owner>(entity,'rts-owner')!.faction!==owner.faction||!world.get<Building>(entity,'rts-building')!.complete||world.get<Production>(entity,'rts-production')!.queue.length)continue;
    const definition=context.catalog.get('buildings',world.get<Kind>(entity,'rts-kind')!.definition);
    if(definition?.produces.includes(faction.ai.preferredUnit))command(context,{kind:'train',faction:owner.faction,entityId:entity,definitionId:faction.ai.preferredUnit});
   }
  }});
  scheduler.register({id:'rts.population',phase:'post',order:90,query:['rts-faction'],update(_world,id){
   if(id===context.world.query(['rts-faction'])[0])refresh(context);
  }});
 }
 const api:LWRTSEconomyTypes.ProductionAPI=Object.freeze({register,command,completeStep,refresh,bank});root.LWRTSProduction=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
