'use strict';
// An earned fresh story: no grants to coins, RP, prestige, levels, skills or inventory.
const L=require('./simulation.cjs'),S=require('./story-codec.js'),fs=require('node:fs'),assert=require('node:assert/strict');
const e=new L.Engine();e.s.started=true;e.s.paused=false;e.selectCreature('c1');
const milestones=[],record=(id)=>{if(!milestones.some(x=>x.id===id))milestones.push({id,seconds:Math.round(e.s.simTime),level:e.s.player.level,coins:e.s.player.coins,rp:e.s.rp,prestige:e.s.progression.prestige});};
const learn=['woodcraft','shelter','stonework','fiberwork','woodwork','tracking','commerce'];
const research=['discovery-1','feature-quests','community-1','feature-recruitment','feature-trade','community-2','blueprint-market','discovery-2','blueprint-map-table','feature-land'];
function plot(kind){for(let y=4;y<16;y++)for(let x=4;x<16;x++)if(!e.placementIssue(kind,x,y))return{x,y};}
for(let step=0;step<72000;step++){
 if(step%100===0){
  const c=e.creatures[0];e.selectCreature(c.id);
  if(!c.activeQuest){
   for(const id of learn){if(!c.skills[id]&&!c.training&&!c.learning.queue.length){if(!c.researched[id])e.research(id);if(c.researched[id]){const r=e.teach(id);if(r.ok)record('lesson-'+id);}break;}}
   for(const id of research){if(!e.s.progression.research[id]){const r=e.researchFeature(id);if(r.ok)record(id);break;}}
   for(const kind of ['shelter','bench','market','map_table']){if(!e.s.buildings.some(b=>b.kind===kind)&&!e.allOrders().some(o=>o.kind===kind)&&c.skills[L.BUILDINGS[kind].skill]){const p=plot(kind);if(p){const r=e.place(kind,p.x,p.y);if(r.ok)record('planned-'+kind);}}}
   if(e.unlocked('features','quests')&&c.skills.tracking&&!c.questPlan&&!c.training&&!c.learning.queue.length&&!c.orders.length){const offer=e.s.colony.board.offers.find(o=>o.questId==='meadow');if(offer&&e.acceptQuest(offer.id).ok)record('quest-accepted');}
   if(!c.training&&!c.learning.queue.length){for(const id of ['woodcraft','woodwork']){if(c.skills[id]&&(c.practice[id]||0)<16&&!c.orders.length)e.practice(id,1);}}
  }
  if(e.s.progression.prestige)record('earned-prestige');
  if(e.s.progression.slots===1&&e.unlockSlot().ok)record('unlocked-slot-2');
  if(e.s.progression.slots>1&&!e.freeHome()&&!e.allOrders().some(o=>o.type==='build'&&o.kind==='shelter')&&!c.activeQuest){const p=plot('shelter');if(p&&e.place('shelter',p.x,p.y).ok)record('second-shelter');}
  if(e.creatures.length===1&&e.purchaseCreature('maker').ok)record('recruited-second');
  if(e.s.buildings.some(b=>b.kind==='market')&&!e.s.market.orders.some(q=>!['done','cancelled'].includes(q.status))){const id=['herbs','wood','trail_cap'].find(id=>(e.s.colony.warehouse.inventory[id]||0)>=2);if(id)e.sellItem(id,2);}
  if(e.s.market.history.length)record('physical-market-sale');
  if(e.mapTable())record('built-map-table');
  if(e.s.estate.islands.length===1&&e.buyIsland(1,0).ok)record('bought-island');
 }
 e.step(.1);
 if(step%6000===5999){assert.doesNotThrow(()=>S.inspect(S.encode(e)));console.log('minute',Math.round(e.s.simTime/60),'Lv',e.s.player.level,'coins',e.s.player.coins,'RP',e.s.rp,'P',e.s.progression.prestige,'task',e.creatures[0].task?.label,'skills',Object.keys(e.creatures[0].skills).join(','));}
 if(milestones.some(x=>x.id==='bought-island')&&milestones.some(x=>x.id==='physical-market-sale')&&milestones.some(x=>x.id==='recruited-second'))break;
}
console.log(JSON.stringify(milestones,null,2));fs.writeFileSync(__dirname+'/v10-fresh-story.json',JSON.stringify(S.encode(e)));const required=['planned-shelter','planned-bench','earned-prestige','unlocked-slot-2','recruited-second','physical-market-sale','built-map-table','bought-island'];const results=required.map(id=>({name:id,passed:milestones.some(x=>x.id===id)}));fs.writeFileSync(__dirname+'/v10-fresh-results.json',JSON.stringify({passed:results.filter(x=>x.passed).length,total:results.length,seconds:e.s.simTime,milestones,results},null,2));assert(results.every(x=>x.passed),'Fresh progression did not reach every target');
