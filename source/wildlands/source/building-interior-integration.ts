/// <reference path="./building-interior-contracts.d.ts" />
/* Install domain capabilities after composition without altering the trusted simulation schedule. */
(function(inputRoot:unknown){
 'use strict';
 interface Constructor extends Function {prototype:Record<string,unknown>;import(input:unknown):unknown;}
 const root=inputRoot as {
  LWInteriorRuntime:{step(e:LWInterior.Engine,dt:number):boolean;onsite(e:LWInterior.Engine,dt:number):boolean;visit(e:LWInterior.Engine,a:unknown,b:unknown,f:unknown):LWPhysicalPorts.ActionResult;order(e:LWInterior.Engine,b:unknown,f:unknown,s:unknown,r:unknown,n:unknown):LWPhysicalPorts.ActionResult;bindJob(e:LWInterior.Engine,t:LWInterior.Task):void};
  LWWorkflowVenues:LWWorkflowVenue.Api;
  LWInteriorState:{validate(input:unknown,world:LWInterior.World):LWInterior.State|undefined};
  LWContent:{parse(input:unknown,limit:number):unknown};LWBuildingInteriorIntegration?:unknown;LWBuildingInteriorProjector:{snapshot(e:LWInterior.Engine,id:string):LWInterior.Snapshot|null};
 };
 const R=root.LWInteriorRuntime;
 function clean(e:LWInterior.Engine):void{
  const state=e.s.interiors;if(!state)return;
  for(const id of Object.keys(state.jobs))if(!e.s.buildings.some(b=>b.storage?.job?.id===id))delete state.jobs[id];
  for(const actorId of Object.keys(state.locations)){const actor=e.creatures.find(c=>c.id===actorId);if(!actor||actor.activeQuest&&root.LWWorkflowVenues.buildingId(e.s,actorId,actor.activeQuest.questId)!==state.locations[actorId]!.buildingId)delete state.locations[actorId];}
  state.visits=state.visits.filter(v=>e.creatures.some(c=>c.id===v.actorId&&!c.activeQuest));
 }
 function install(Engine:Constructor):void{
  const p=Engine.prototype,step=p.stepActor as LWInterior.Engine['stepActor'],start=p.startTask as LWInterior.Engine['startTask'],finish=p.finishTask as LWInterior.Engine['finishTask'],configure=p.configureBuilding as LWInterior.Engine['configureBuilding'],quest=p.stepQuest as LWInterior.Engine['stepQuest'];
  Object.assign(p,{
   buildingInterior(this:LWInterior.Engine,id:unknown){return typeof id==='string'?root.LWBuildingInteriorProjector.snapshot(this,id):null;},
   visitBuildingFloor(this:LWInterior.Engine,a:unknown,b:unknown,f:unknown){return R.visit(this,a,b,f);},
   orderBuildingProduction(this:LWInterior.Engine,b:unknown,f:unknown,s:unknown,r:unknown,n:unknown){return R.order(this,b,f,s,r,n);},
   stepQuest(this:LWInterior.Engine,dt:number){clean(this);if(!R.onsite(this,dt))quest.call(this,dt);clean(this);},
   stepActor(this:LWInterior.Engine,dt:number){clean(this);if(!R.step(this,dt))step.call(this,dt);clean(this);},
   startTask(this:LWInterior.Engine,t:LWPhysicalPorts.Draft|null){const result=start.call(this,t);if(result&&this.actor.task?.buffered)R.bindJob(this,this.actor.task);return result;},
   finishTask(this:LWInterior.Engine,t:LWInterior.Task){finish.call(this,t);clean(this);},
   configureBuilding(this:LWInterior.Engine,id:string,command:string,value:unknown){const result=configure.call(this,id,command,value);if(result.ok&&command==='clear'&&this.s.interiors)delete this.s.interiors.production[id];return result;}
  });
  const importer=Engine.import;
  Engine.import=function(input:unknown):unknown{
   const doc=root.LWContent.parse(input,12*1024*1024) as {state?:LWInterior.World};
   if(doc.state)root.LWInteriorState.validate(doc.state.interiors,doc.state);
   const result=Reflect.apply(importer,this,[doc]) as LWInterior.Engine;
   root.LWInteriorState.validate(result.s.interiors,result.s);return result;
  };
 }
 root.LWBuildingInteriorIntegration=Object.freeze({install});if(typeof module!=='undefined'&&module.exports)module.exports=root.LWBuildingInteriorIntegration;
})(globalThis);
