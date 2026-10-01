/* Deterministic high-level simulation schedule.
 * This module owns orchestration only: domain methods and ECS systems own mutations.
 * Actor-major order and the fixed-step clock remain compatibility contracts.
 */
(function(root: any){
 'use strict';

 interface ScheduleStep {
  readonly id: string;
  readonly scope: 'world' | 'actor';
  readonly order: number;
  readonly owner: string;
 }
 interface Archetype {
  simulationPipeline?: readonly string[];
 }
 interface EngineLike {
  s: any;
  _simulating?: boolean;
  _actor?: any;
  stepWorld?: (dt: number) => void;
  updateQuestBoard: () => void;
  ecs: { sync: (creatures: any[]) => void };
  creatures: any[];
  newWish: () => void;
  topUp: (automatic?: boolean) => unknown;
  stepQuest: (dt: number) => void;
  stepActor: (dt: number) => void;
 }

 const L:any=root.LW;
 const schedule: readonly ScheduleStep[]=Object.freeze([
  Object.freeze({id:'clock',scope:'world',order:10,owner:'simulation-pipeline'}),
  Object.freeze({id:'world',scope:'world',order:20,owner:'world-simulation'}),
  Object.freeze({id:'quest-board',scope:'world',order:30,owner:'cartography'}),
  Object.freeze({id:'actor-daily',scope:'actor',order:40,owner:'colony'}),
  Object.freeze({id:'actor-quest',scope:'actor',order:50,owner:'adventure'}),
  Object.freeze({id:'actor-simulation',scope:'actor',order:60,owner:'actor-ecs'})
 ]);

 // Compatibility-only behavior for partial historical engine construction.
 // Fully composed runtime instances own world progression in world-simulation.ts.
 const LEGACY_FALLBACK=Object.freeze({
  berryNodeRegenSeconds:18,
  otherNodeRegenSeconds:24,
  cropCycleSeconds:80,
  cropLevelRate:.1,
  cropOutputLimit:12,
  orchardYield:6,
  otherCropYield:4
 });

 function fallbackWorld(engine:EngineLike,dt:number):void{
  const s=engine.s;
  for(const node of s.nodes)if(node.stock<node.max){
   node.regen+=dt;
   const limit=node.kind==='berries'?LEGACY_FALLBACK.berryNodeRegenSeconds:LEGACY_FALLBACK.otherNodeRegenSeconds;
   if(node.regen>=limit){node.regen-=limit;node.stock=Math.min(node.max,node.stock+1);}
  }
  for(const building of s.buildings)if(L.CROP_RES[building.kind]){
   building.regen+=dt*(1+((building.level||1)-1)*LEGACY_FALLBACK.cropLevelRate);
   if(building.regen>=LEGACY_FALLBACK.cropCycleSeconds){
    building.regen-=LEGACY_FALLBACK.cropCycleSeconds;
    building.stock=Math.min(LEGACY_FALLBACK.cropOutputLimit,building.stock+
      (building.kind==='orchard'?LEGACY_FALLBACK.orchardYield:LEGACY_FALLBACK.otherCropYield)+((building.level||1)-1));
   }
  }
 }

 function create(archetype:Archetype|null=null){
  if(archetype){
   const ids=schedule.map(step=>step.id),actual=archetype.simulationPipeline;
   if(!Array.isArray(actual)||actual.length!==ids.length||actual.some((id,index)=>id!==ids[index]))
    throw Error('Composition archetype does not match the simulation pipeline.');
  }
  function step(engine:EngineLike,dt:number):void{
   if(typeof dt!=='number'||!Number.isFinite(dt))return;
   const s=engine.s;if(!s.started||s.paused)return;
   dt=L.clamp(dt,0,.25);if(!dt)return;
   engine._simulating=true;const previous=engine._actor;
   try{
    s.simTime+=dt;s.hour+=dt*.05;let newDay=false;
    if(s.hour>=24){s.hour-=24;s.day++;newDay=true;}
    if(engine.stepWorld)engine.stepWorld(dt);else fallbackWorld(engine,dt);
    engine.updateQuestBoard();engine.ecs.sync(engine.creatures);
    for(const creature of engine.creatures){
     engine._actor=creature;
     if(newDay){
      creature.daily={day:s.day,bonded:0};creature.allowance.given=0;engine.newWish();
      if(creature.allowance.auto&&!creature.activeQuest)engine.topUp(true);
     }
     if(creature.activeQuest){engine.stepQuest(dt);continue;}
     engine.stepActor(dt);
    }
   }finally{engine._actor=previous;engine._simulating=false;}
  }
  return Object.freeze({schedule,step});
 }

 const api=Object.freeze({schedule,create});
 root.LWSimulationPipeline=api;L.SimulationPipeline=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
