/// <reference path="./building-interior-contracts.d.ts" />
/* Indoor travel gates the existing task, using the ordinary simulation clock and actor records. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWInteriors:LWInterior.CatalogApi;LWWorkflowVenues:LWWorkflowVenue.Api;LWInteriorState:{empty():LWInterior.State};LWInteriorRuntime?:unknown;LWInteriorPaths:{path(f:LWInterior.Floor,from:LWInterior.Point,to:LWInterior.Point):LWInterior.Point[]|null};LWGeography:{Grid:new(world:LWInterior.World)=>{pass(x:number,y:number):boolean;canStep(a:LWInterior.Point,b:LWInterior.Point):boolean}}};
 const C=root.LWInteriors;
 const state=(e:LWInterior.Engine):LWInterior.State=>e.s.interiors??(e.s.interiors=root.LWInteriorState.empty());
 const fail=(reason:string):LWPhysicalPorts.ActionResult=>({ok:false,reason});
 const definition=(e:LWInterior.Engine,b:LWPhysicalPorts.Building)=>C.forBuilding(e.s,b);
 function floorPath(layout:LWInterior.Layout,from:string,to:string):LWInterior.Stair[]{
  const queue:{id:string;path:LWInterior.Stair[]}[]=[{id:from,path:[]}],seen=new Set([from]);
  while(queue.length){const v=queue.shift()!;if(v.id===to)return v.path;for(const stair of C.floor(layout,v.id)!.stairs)if(!seen.has(stair.to)){seen.add(stair.to);queue.push({id:stair.to,path:[...v.path,stair]});}}
  throw Error('No connected floor route.');
 }
 function route(layout:LWInterior.Layout,location:LWInterior.Location,to:string,point:LWInterior.Point):LWInterior.Waypoint[]{
  const result:LWInterior.Waypoint[]=[];let p:LWInterior.Point=location,floorId=location.floorId;
  const add=(next:LWInterior.Point):void=>{const points=root.LWInteriorPaths.path(C.floor(layout,floorId)!,p,next);if(!points)throw Error('Unreachable indoor destination.');for(const step of points){const seconds=Math.hypot(step.x-p.x,step.y-p.y)/2;if(seconds>.001)result.push({...step,floorId,seconds});p=step;}};
  for(const stair of floorPath(layout,floorId,to)){add(stair);result.push({...stair.arrival,floorId:stair.to,seconds:stair.seconds});floorId=stair.to;p=stair.arrival;}
  add(point);return result;
 }
 function move(location:LWInterior.Location,dt:number):void{
  let remaining=dt;while(remaining>0&&location.route.length){const next=location.route[0]!,used=Math.min(remaining,next.seconds);if(next.floorId===location.floorId){const fraction=next.seconds>0?used/next.seconds:1;location.x+=(next.x-location.x)*fraction;location.y+=(next.y-location.y)*fraction;}next.seconds-=used;remaining-=used;if(next.seconds<=.000001){location.floorId=next.floorId;location.x=next.x;location.y=next.y;location.route.shift();}else break;}
 }
 function enter(e:LWInterior.Engine,b:LWPhysicalPorts.Building,floorId:string,stationId:string|null,purpose:LWInterior.Location['purpose']):LWInterior.Location{
  const layout=definition(e,b),ground=layout.floors[0]!,f=C.floor(layout,floorId)!;
  const current=state(e).locations[e.actor.id],location=current?.buildingId===b.id?current:{buildingId:b.id,floorId:ground.id,...ground.door,stationId:null,route:[],purpose};
  location.purpose=purpose;location.stationId=null;const dest=f.stations.find(s=>s.id===stationId)||f.door;location.route=route(layout,location,floorId,dest);state(e).locations[e.actor.id]=location;return location;
 }
 function bindJob(e:LWInterior.Engine,t:LWInterior.Task):void{
  const b=e.s.buildings.find(b=>b.id===t.buildingId),job=b?.storage?.job;if(!job||state(e).jobs[job.id])return;
  const queue=state(e).production[b!.id]||[],binding=queue.find(q=>q.recipe===job.recipe),ground=definition(e,b!).floors[0]!,station=ground.stations.find(s=>s.production);
  if(binding){state(e).jobs[job.id]={floorId:binding.floorId,stationId:binding.stationId,recipe:binding.recipe};binding.remaining--;state(e).production[b!.id]=queue.filter(q=>q.remaining>0);}
  else if(station)state(e).jobs[job.id]={floorId:ground.id,stationId:station.id,recipe:job.recipe};
 }
 function destination(e:LWInterior.Engine,t:LWInterior.Task,b:LWPhysicalPorts.Building):{floorId:string;stationId:string|null}{
  const binding=t.jobId&&state(e).jobs[t.jobId];if(binding)return binding;
  const floor=definition(e,b).floors[0]!,id=['stockbuilding','collectbuilding','emptybuilding','withdraw','deposit','market-pickup','market-deliver','market-sell'].includes(t.kind)?null:floor.stations[0]?.id;
  return {floorId:floor.id,stationId:id||null};
 }
 function exit(e:LWInterior.Engine,location:LWInterior.Location,dt:number):boolean{
  const b=e.s.buildings.find(b=>b.id===location.buildingId);if(!b){delete state(e).locations[e.actor.id];return false;}
  if(location.purpose!=='exit'){const layout=definition(e,b),ground=layout.floors[0]!;location.purpose='exit';location.stationId=null;location.route=route(layout,location,ground.id,ground.door);}
  if(location.route.length){e.stepInteractionActor(dt);move(location,dt);return true;}
  delete state(e).locations[e.actor.id];return false;
 }
 function step(e:LWInterior.Engine,dt:number):boolean{
  const s=state(e),actor=e.actor,t=actor.task,location=s.locations[actor.id];
  for(const id of Object.keys(s.jobs))if(!e.s.buildings.some(b=>b.storage?.job?.id===id))delete s.jobs[id];
  const visit=s.visits.find(v=>v.actorId===actor.id);
  if(visit&&visit.phase==='queued'&&(!t||t.kind==='idle')){
   if(location&&location.buildingId!==visit.buildingId)return exit(e,location,dt);
   const b=e.s.buildings.find(b=>b.id===visit.buildingId)!;const path=e.findPath(b,true);if(path===null){s.visits=s.visits.filter(v=>v!==visit);return false;}actor.task=null;visit.path=path;visit.phase='walk';
  }
  if(visit&&visit.phase!=='queued'){
   e.stepInteractionActor(dt);
   if(Object.values(actor.needs).slice(0,3).some(n=>n<8)){s.visits=s.visits.filter(v=>v!==visit);return true;}
   const b=e.s.buildings.find(b=>b.id===visit.buildingId)!;
   if(visit.phase==='walk'){
    const p=visit.path[0];if(p){const grid=new root.LWGeography.Grid(e.s),from={x:Math.round(actor.creature.x),y:Math.round(actor.creature.y)};if(!(from.x===p.x&&from.y===p.y?grid.pass(p.x,p.y):grid.canStep(from,p))){s.visits=s.visits.filter(v=>v!==visit);return true;}const a=actor.creature,dx=p.x-a.x,dy=p.y-a.y,d=Math.hypot(dx,dy),speed=(1.65+(actor.bond>=65?.15:0))*dt;if(dx)a.dir=dx>0?1:-1;if(d<=speed){a.x=p.x;a.y=p.y;visit.path.shift();}else{a.x+=dx/d*speed;a.y+=dy/d*speed;}return true;}
    if(!e.at(b)){s.visits=s.visits.filter(v=>v!==visit);return true;}enter(e,b,visit.floorId,null,'visit');visit.phase='inside';return true;
   }
   const current=s.locations[actor.id]!;if(current.route.length)move(current,dt);else{visit.hold=Math.max(0,visit.hold-dt);if(!visit.hold)s.visits=s.visits.filter(v=>v!==visit);}return true;
  }
  const b=t?.target&&e.s.buildings.find(b=>b.x===t.target!.x&&b.y===t.target!.y);
  if(location&&(!t||t.phase==='walk'||!b||b.id!==location.buildingId))return exit(e,location,dt);
  if(!t||t.phase!=='work'||!b||!e.at(b)||t.kind==='build')return false;
  bindJob(e,t);const dest=destination(e,t,b),current=location||enter(e,b,dest.floorId,dest.stationId,'work');
  if(current.purpose==='exit')return exit(e,current,dt);
  const floor=C.floor(definition(e,b),dest.floorId)!,point=floor.stations.find(s=>s.id===dest.stationId)||floor.door;
  if(!current.route.length&&current.floorId===dest.floorId&&Math.hypot(current.x-point.x,current.y-point.y)<.001){current.stationId=dest.stationId;return false;}
  if(current.route.length){e.stepInteractionActor(dt);move(current,dt);if(!current.route.length)current.stationId=dest.stationId;return true;}
  const arriving=enter(e,b,dest.floorId,dest.stationId,'work');e.stepInteractionActor(dt);move(arriving,dt);return true;
 }
 function onsite(e:LWInterior.Engine,dt:number):boolean {
  const actor=e.actor,id=root.LWWorkflowVenues.buildingId(e.s,actor.id,actor.activeQuest?.questId),b=e.s.buildings.find(b=>b.id===id);
  if(!b||!e.at(b))return false;
  const floor=definition(e,b).floors[0]!,station=floor.stations[0],point=station||floor.door,location=e.s.interiors?.locations[actor.id];
  const current=location?.buildingId===b.id?location:enter(e,b,floor.id,station?.id||null,'work');
  if(!current.route.length&&(current.floorId!==floor.id||Math.hypot(current.x-point.x,current.y-point.y)>.001))enter(e,b,floor.id,station?.id||null,'work');
  if(current.route.length){e.stepInteractionActor(dt);move(current,dt);return true;}
  current.purpose='work';current.stationId=station?.id||null;return false;
 }
 function visit(e:LWInterior.Engine,actorId:unknown,buildingId:unknown,floorId:unknown):LWPhysicalPorts.ActionResult{
  if(typeof actorId!=='string'||typeof buildingId!=='string'||typeof floorId!=='string')return fail('Choose a creature, building and floor.');
  const actor=e.creatures.find(c=>c.id===actorId),b=e.s.buildings.find(b=>b.id===buildingId);if(!actor||!b||!C.floor(C.forBuilding(e.s,b),floorId))return fail('That creature, building or floor is unavailable.');
  return e.commandActor(actorId,()=>{if(!e.findPath(b,true))return fail('This building needs a reachable doorway.');if(e.s.interiors?.visits.some(v=>v.actorId===actorId))return fail('Finish this floor visit before requesting another.');state(e).visits.push({actorId,buildingId,floorId,created:e.s.simTime,phase:'queued',path:[],hold:8});return {ok:true};});
 }
 function order(e:LWInterior.Engine,buildingId:unknown,floorId:unknown,stationId:unknown,recipe:unknown,batches:unknown):LWPhysicalPorts.ActionResult{
  if(typeof buildingId!=='string'||typeof floorId!=='string'||typeof stationId!=='string'||typeof recipe!=='string'||typeof batches!=='number'||!Number.isInteger(batches)||batches<1||batches>12)return fail('Choose a workstation, recipe and 1–12 batches.');
  const b=e.s.buildings.find(b=>b.id===buildingId),f=b&&C.floor(C.forBuilding(e.s,b),floorId);if(!b?.storage||!f?.stations.some(s=>s.id===stationId&&s.production)||!e.recipe(b,recipe))return fail('This floor workstation cannot produce that recipe.');
  const r=e.recipe(b,recipe)!,issue=e.gateIssue(r.kind==='craft'?'recipes':'items',recipe);if(issue)return fail(issue);
  const queue=e.s.interiors?.production[buildingId]||[];if(queue.length>=24)return fail('Finish queued workstation orders first.');
  const result=e.configureBuilding(buildingId,'batch',{recipe,amount:batches});if(!result.ok)return result;
  state(e).production[buildingId]=[...queue,{floorId,stationId,recipe,remaining:batches}];return result;
 }
 root.LWInteriorRuntime=Object.freeze({state,step,onsite,visit,order,bindJob,route});if(typeof module!=='undefined'&&module.exports)module.exports=root.LWInteriorRuntime;
})(globalThis);
