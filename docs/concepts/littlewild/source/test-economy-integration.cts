'use strict';
/* Real-facade checks for the M4 authorization -> settlement -> presentation boundary. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const L=require('./simulation.cjs'),E=require('./ecs.js'),S=require('./story-codec.js');
const results=[];
function test(name,fn){try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL',name,error.message);}}
function demo(){const e=L.createWorldDemo();e.selectCreature(e.creatures[0].id);return e;}
test('Engine composes a transient economy ECS without changing the story shape',()=>{
 const e=demo(),runtime=e.economyRuntime();assert(runtime.world instanceof E.World);const out=e.export().state;
 assert(!Object.hasOwn(out,'economyEcs'));assert(!Object.hasOwn(out,'economy'));assert(!Object.hasOwn(out,'settlements'));
});
test('Facade XP settlement applies actor level, bond and character points once',()=>{
 const e=demo(),c=e.actor;c.creature.level=1;c.creature.xp=35;c.bond=10;c.rpg.cp=0;
 const r=e.xp('creature',2);assert.equal(r.state,'settled');assert.equal(c.creature.level,2);assert.equal(c.creature.xp,1);assert.equal(c.bond,12);
 assert.equal(c.rpg.cp,global.LWAdventure.content.rules.cpPerLevel);assert(e.drain().some(x=>x.type==='notice'));
});
test('Chapter command settles its complete reward once and leaves journaling outside ECS',()=>{
 const e=demo(),q={id:'integration-chapter',title:'Integration chapter',reward:{coins:7,rp:3,xp:2},checks:[['ready',()=>true]]};
 e.quest=()=>q;const coins=e.s.player.coins,rp=e.s.rp,logs=e.s.log.length;
 assert.equal(e.claimQuest().ok,true);assert.equal(e.s.player.coins,coins+7);assert.equal(e.s.rp,rp+3);assert(e.s.completedQuests.includes(q.id));assert(e.s.log.length>logs);
 const after=JSON.stringify({player:e.s.player,rp:e.s.rp,completed:e.s.completedQuests});assert.equal(e.claimQuest().ok,false);assert.equal(JSON.stringify({player:e.s.player,rp:e.s.rp,completed:e.s.completedQuests}),after);
});
test('Adventure return uses one reward settlement including village prestige',()=>{
 const e=demo(),c=e.actor,start={guide:e.s.player.coins,pocket:c.creature.coins,rp:e.s.rp,prestige:e.s.progression.prestige};
 c.activeQuest={questId:'meadow',name:'The test meadow',status:'returning',elapsed:10,duration:10,checkIndex:0,checks:[],required:1,successes:1,rolls:[],found:{},energy:1,energySpent:1,coins:20,research:3,started:12.345,returnRemaining:0,aborted:false,outcome:'Completed',offerId:'offer-economy-m4',islandId:'0,0',islandName:'Home',playerLevel:1,creatureLevel:1};
 assert.equal(e.returnQuest(),true);assert.equal(c.activeQuest,null);assert.equal(e.s.player.coins,start.guide+14);assert.equal(c.creature.coins,start.pocket+6);assert.equal(e.s.rp,start.rp+3);
 const expected=global.LWGrowth.content.rules.questPrestigeBase+global.LWAdventure.content.quests.find(q=>q.id==='meadow').tier*global.LWGrowth.content.rules.questPrestigePerTier;
 assert.equal(e.s.progression.prestige,start.prestige+expected);assert.equal(c.questHistory[0].prestigeReward,expected);
});
test('Growth research authorizes first and settles research plus XP before unlocking',()=>{
 const e=demo(),id='making-1',definition=global.LWGrowth.content.research.find(r=>r.id===id);delete e.s.progression.research[id];e.s.progression.features.making=0;e.s.rp=definition.cost;e.s.player.level=1;e.s.player.xp=0;
 const r=e.researchFeature(id);assert.equal(r.ok,true);assert.equal(e.s.rp,0);assert.equal(e.s.progression.research[id],true);assert.equal(e.s.progression.features.making,1);assert.equal(e.s.player.xp,2);
});
test('Prestige purchases spend only current prestige and preserve earned prestige',()=>{
 const e=demo(),offer=global.LWGrowth.content.shop[0],beforeEarned=e.s.progression.earnedPrestige,before=e.s.progression.prestige;e.s.player.level=Math.max(e.s.player.level,offer.playerLevel);
 const r=e.buyPrestigeItem(offer.id);assert.equal(r.ok,true);assert.equal(e.s.progression.prestige,before-offer.prestige);assert.equal(e.s.progression.earnedPrestige,beforeEarned);
});
test('Market sale settles cash and both XP rewards exactly once',()=>{
 const e=demo(),c=e.actor,b=e.s.buildings.find(x=>x.kind==='market');assert(b);c.creature.x=b.x;c.creature.y=b.y;b.marketInventory={wood:2};
 const q={id:'sale-900',item:'wood',amount:2,remaining:0,sold:0,transit:{},staged:{[b.id]:2},assignedId:c.id,status:'at-stall',paused:false,priority:1,unitPrice:5,created:0};e.s.market.orders.push(q);
 const task={kind:'market-sell',saleId:q.id,resource:q.item,buildingId:b.id,amount:2,target:{x:b.x,y:b.y},duration:1};c.task=task;const coins=e.s.player.coins,px=e.s.player.xp,ax=c.creature.xp;
 e.finishMarketTask(task);assert.equal(e.s.player.coins,coins+10);assert.equal(q.status,'done');assert.equal(q.sold,2);assert.equal(b.marketInventory.wood,0);assert.equal(e.s.player.xp,px+1);assert.equal(c.creature.xp,ax+1);
 e.finishMarketTask(task);assert.equal(e.s.player.coins,coins+10);
});
test('Economy ECS never binds the actor-scoped state proxy as shared component data',()=>{
 const e=demo();delete e.actor.socialIntent;const before=e.s.player.coins;
 assert.doesNotThrow(()=>e.settleEconomy({id:'root-state:shared',guide:1}));
 assert.equal(e.s.player.coins,before+1);
 const shared=e.economyRuntime().world.get('economy:shared','SharedEconomy');
 assert.strictEqual(shared.state,e.state);assert.notStrictEqual(shared.state,e.s);
});
test('Story roundtrip reconstructs settlement services and resumes deterministic rewards',()=>{
 const a=demo();a.settleEconomy({id:'roundtrip:seed',guide:3,research:2,actorXp:1},'Roundtrip seed');const restored=S.commit(S.inspect(S.encode(a)));
 assert.deepEqual(restored.export().state,a.export().state);assert(restored.economyRuntime().world instanceof E.World);
 a.settleEconomy({id:'roundtrip:next',guide:2,playerXp:1});restored.settleEconomy({id:'roundtrip:next',guide:2,playerXp:1});assert.deepEqual(restored.export().state,a.export().state);
});
const passed=results.filter(r=>r.passed).length;fs.writeFileSync(__dirname+'/economy-integration-results.json',JSON.stringify({passed,total:results.length,failed:results.length-passed,results},null,2)+'\n');console.log(`${passed}/${results.length} economy integration checks passed`);if(passed!==results.length)process.exitCode=1;
