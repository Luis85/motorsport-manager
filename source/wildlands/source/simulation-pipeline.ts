/// <reference path="./balancing-contracts.d.ts" />
/* Deterministic high-level simulation schedule.
 * This module owns orchestration only: domain methods and ECS systems own mutations.
 * Actor-major order and the fixed-step clock remain compatibility contracts.
 */
(function(inputRoot: unknown){
 'use strict';

 interface ScheduleStep {
  readonly id: string;
  readonly scope: 'world' | 'actor';
  readonly order: number;
  readonly owner: string;
 }
 interface Archetype { simulationPipeline?: readonly string[]; }
 interface ResourceNode { stock:number; max:number; regen:number; kind:string; }
 interface Building { kind:string; regen:number; stock:number; level?:number; }
 interface Creature {
  id:string;
  daily:{day:number;bonded:number};
  allowance:{given:number;auto?:boolean};
  activeQuest?:unknown;
 }
 interface SimulationState {
  started:boolean;
  paused:boolean;
  simTime:number;
  hour:number;
  day:number;
  nodes:ResourceNode[];
  buildings:Building[];
 }
 interface EngineLike extends LWBalanceRules.Owner {
  s:SimulationState;
  _simulating?:boolean|undefined;
  _actor?:Creature|undefined;
  stepWorld?:((dt:number)=>void)|undefined;
  updateQuestBoard:()=>void;
  ecs:{sync:(creatures:Creature[])=>void};
  creatures:Creature[];
  newWish:()=>void;
  topUp:(automatic?:boolean)=>unknown;
  stepQuest:(dt:number)=>void;
  stepActor:(dt:number)=>void;
  interactionBusy?:(id:string)=>boolean;
  stepInteractionActor?:(dt:number)=>void;
  stepInteractions?:()=>void;
 }
 interface LittlewildFacade {
  CROP_RES:Record<string,unknown>;
  clamp(value:number,min:number,max:number):number;
  SimulationPipeline?:SimulationPipelineApi;
 }
 interface SimulationPipeline {
  readonly schedule:readonly ScheduleStep[];
  step(engine:EngineLike,dt:number):void;
 }
 interface SimulationPipelineApi {
  readonly schedule:readonly ScheduleStep[];
  create(archetype?:Archetype|null):SimulationPipeline;
 }
 interface LittlewildRoot { LW?:LittlewildFacade; LWSimulationPipeline?:SimulationPipelineApi; }
 const root=inputRoot as LittlewildRoot;
 const B=(typeof module!=='undefined'&&module.exports?require('./balancing-rules.js'):(globalThis as unknown as {LWBalanceRules:LWBalanceRules.Api}).LWBalanceRules) as LWBalanceRules.Api;
 const facade=root.LW;if(!facade)throw Error('Littlewild facade missing.');
 const L:LittlewildFacade=facade;

 const schedule:readonly ScheduleStep[]=Object.freeze([
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
  const state=engine.s;
  for(const node of state.nodes)if(node.stock<node.max){
   node.regen+=dt;
   const limit=node.kind==='berries'?LEGACY_FALLBACK.berryNodeRegenSeconds:LEGACY_FALLBACK.otherNodeRegenSeconds;
   if(node.regen>=limit){node.regen-=limit;node.stock=Math.min(node.max,node.stock+1);}
  }
  for(const building of state.buildings)if(L.CROP_RES[building.kind]){
   building.regen+=dt*(1+((building.level||1)-1)*LEGACY_FALLBACK.cropLevelRate);
   if(building.regen>=LEGACY_FALLBACK.cropCycleSeconds){
    building.regen-=LEGACY_FALLBACK.cropCycleSeconds;
    building.stock=Math.min(LEGACY_FALLBACK.cropOutputLimit,building.stock+
      (building.kind==='orchard'?LEGACY_FALLBACK.orchardYield:LEGACY_FALLBACK.otherCropYield)+((building.level||1)-1));
   }
  }
 }

 function create(archetype:Archetype|null=null):SimulationPipeline{
  if(archetype){
   const ids=schedule.map(step=>step.id),actual=archetype.simulationPipeline;
   if(!Array.isArray(actual)||actual.length!==ids.length||actual.some((id,index)=>id!==ids[index]))
    throw Error('Composition archetype does not match the simulation pipeline.');
  }
  function step(engine:EngineLike,dt:number):void{
   if(typeof dt!=='number'||!Number.isFinite(dt))return;
   const state=engine.s;if(!state.started||state.paused)return;
   dt=L.clamp(dt,0,.25);if(!dt)return;
   engine._simulating=true;const previous=engine._actor;
   try{
    state.simTime+=dt;state.hour+=dt*B.forEngine(engine).clock.hourRate;let newDay=false;
    if(state.hour>=24){state.hour-=24;state.day++;newDay=true;}
    if(engine.stepWorld)engine.stepWorld(dt);else fallbackWorld(engine,dt);
    engine.updateQuestBoard();engine.ecs.sync(engine.creatures);
    for(const creature of engine.creatures){
     engine._actor=creature;
     if(newDay){
      creature.daily={day:state.day,bonded:0};creature.allowance.given=0;engine.newWish();
      if(creature.allowance.auto&&!creature.activeQuest)engine.topUp(true);
     }
     if(creature.activeQuest){engine.stepQuest(dt);continue;}
     if(engine.interactionBusy?.(creature.id)&&engine.stepInteractionActor)engine.stepInteractionActor(dt);
     else engine.stepActor(dt);
    }
    // Paired interaction settlement closes the actor-simulation phase after actor-major physiology.
    engine.stepInteractions?.();
   }finally{engine._actor=previous;engine._simulating=false;}
  }
  return Object.freeze({schedule,step});
 }

 const api:SimulationPipelineApi=Object.freeze({schedule,create});
 root.LWSimulationPipeline=api;L.SimulationPipeline=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
