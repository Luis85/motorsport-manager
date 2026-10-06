/// <reference path="./building-interior-contracts.d.ts" />
/* Detached display values; observing a room never creates locations or ticks the colony. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWSceneProps?:{room(engine:unknown,buildingId:string):{floorId:string;props:LWSceneGraph.Prop[]}|null};LWInteriors:LWInterior.CatalogApi;LWWorkflowVenues:LWWorkflowVenue.Api;LW:{BUILDINGS:Record<string,{name:string}>;colony:{item(id:string):{name:string}}};LWBuildingInteriorProjector?:unknown;LWWorldProfile:{current:{environment?:{mode:string}}};LWAssets:{hasModel(category:string,id:string,model:string):boolean};LWCreatures:{get(id:string):{visualAsset:string}}};
 const C=root.LWInteriors;
 function snapshot(e:LWInterior.Engine,buildingId:string):LWInterior.Snapshot|null{
  const b=e.s.buildings.find(b=>b.id===buildingId);if(!b)return null;
  const layout=C.forBuilding(e.s,b),locations=e.s.interiors?.locations||{},transfers=e.s.world.transfers.filter(t=>t.buildingId===b.id).slice(0,8);
  const actors:LWInterior.ActorView[]=e.creatures.flatMap(actor=>{
   const location=locations[actor.id];if(!location||location.buildingId!==b.id||actor.activeQuest&&root.LWWorkflowVenues.buildingId(e.s,actor.id,actor.activeQuest.questId)!==b.id)return [];
   const t=actor.task,q=actor.activeQuest,visit=e.s.interiors?.visits.find(v=>v.actorId===actor.id),moving=location.route.length>0;
   const cargo=Object.entries(actor.inventory).filter(([,n])=>n>0).slice(0,3).map(([id,n])=>n+' '+root.LW.colony.item(id).name).join(', ');
   return [{id:actor.id,name:actor.name,archetype:actor.archetype||'sproutling',visualAsset:root.LWCreatures.get(actor.archetype||'sproutling').visualAsset,floorId:location.floorId,x:location.x,y:location.y,stationId:location.stationId,action:moving?(location.purpose==='exit'?'Leaving the room':'Walking inside'):visit?'Visiting this floor':q?`${q.name} · ${q.status}`:t?.label||'Between tasks',mood:e.mood(actor),progress:!moving&&q?Math.min(1,q.elapsed/q.duration):!moving&&t?.phase==='work'?Math.min(1,t.elapsed/t.duration):null,remainingSeconds:moving?location.route.reduce((n,p)=>n+p.seconds,0):q?q.status==='returning'?Math.max(0,q.returnRemaining):Math.max(0,q.duration-q.elapsed):t?.phase==='work'?Math.max(0,(t.duration-t.elapsed)/e.withActor(actor,()=>e.workRate(t))):null,moving,direction:actor.creature.dir||1,cargo,transfer:transfers.some(tr=>tr.actorId===actor.id&&e.s.simTime-tr.time<3)}];
  });
  const st=b.storage;
  const fixtureModel=root.LWWorldProfile.current.environment?.mode==='indoor'?'world':root.LWAssets.hasModel('building',b.kind,'interior')?'interior':'';
  const sceneProps=root.LWSceneProps?.room(e,buildingId);
  return C.copy({...(sceneProps?{sceneProps}:{}),fixtureAsset:fixtureModel?b.kind:'',fixtureModel,buildingId:b.id,buildingName:(b.designId&&e.s.construction?.designs[b.designId]?.name)||root.LW.BUILDINGS[b.kind]?.name||b.kind,kind:b.kind,floors:layout.floors,actors,time:e.s.simTime,status:e.buildingStatus(b),input:st?.input||{},output:st?.output||{},recipes:e.buildingRecipes(b).filter(r=>!e.gateIssue(r.kind==='craft'?'recipes':'items',r.id)).map(r=>({id:r.id,name:root.LW.colony.item(r.output).name,amount:r.amount,time:r.time,cost:r.cost,skill:r.skill,queued:st?.requests[r.id]||0})),transfers});
 }
 root.LWBuildingInteriorProjector=Object.freeze({snapshot});if(typeof module!=='undefined'&&module.exports)module.exports=root.LWBuildingInteriorProjector;
})(globalThis);
