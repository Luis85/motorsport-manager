/* Deterministic high-level simulation schedule.
 * This module owns orchestration only: domain methods and ECS systems own mutations.
 * Actor-major order and the fixed-step clock remain compatibility contracts.
 */
(function(root){
 'use strict';
 const L=root.LW;
 const schedule=Object.freeze([
  Object.freeze({id:'clock',scope:'world',order:10,owner:'simulation-pipeline'}),
  Object.freeze({id:'world',scope:'world',order:20,owner:'world-simulation'}),
  Object.freeze({id:'quest-board',scope:'world',order:30,owner:'cartography'}),
  Object.freeze({id:'actor-daily',scope:'actor',order:40,owner:'colony'}),
  Object.freeze({id:'actor-quest',scope:'actor',order:50,owner:'adventure'}),
  Object.freeze({id:'actor-simulation',scope:'actor',order:60,owner:'actor-ecs'})
 ]);
 function fallbackWorld(engine,dt){
  const s=engine.s;
  for(const node of s.nodes)if(node.stock<node.max){
   node.regen+=dt;const limit=node.kind==='berries'?18:24;
   if(node.regen>=limit){node.regen-=limit;node.stock=Math.min(node.max,node.stock+1);}
  }
  for(const b of s.buildings)if(L.CROP_RES[b.kind]){
   b.regen+=dt*(1+((b.level||1)-1)*.1);
   if(b.regen>=80){b.regen-=80;b.stock=Math.min(12,b.stock+(b.kind==='orchard'?6:4)+((b.level||1)-1));}
  }
 }
 function create(){
  function step(engine,dt){
   if(typeof dt!=='number'||!Number.isFinite(dt))return;
   const s=engine.s;if(!s.started||s.paused)return;
   dt=L.clamp(dt,0,.25);if(!dt)return;
   engine._simulating=true;const previous=engine._actor;
   try{
    s.simTime+=dt;s.hour+=dt*.05;let newDay=false;
    if(s.hour>=24){s.hour-=24;s.day++;newDay=true;}
    if(engine.stepWorld)engine.stepWorld(dt);else fallbackWorld(engine,dt);
    engine.updateQuestBoard();engine.ecs.sync(engine.creatures);
    for(const c of engine.creatures){
     engine._actor=c;
     if(newDay){
      c.daily={day:s.day,bonded:0};c.allowance.given=0;engine.newWish();
      if(c.allowance.auto&&!c.activeQuest)engine.topUp(true);
     }
     if(c.activeQuest){engine.stepQuest(dt);continue;}
     engine.stepActor(dt);
    }
   }finally{engine._actor=previous;engine._simulating=false;}
  }
  return Object.freeze({schedule,step});
 }
 const api=Object.freeze({schedule,create});root.LWSimulationPipeline=api;L.SimulationPipeline=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
