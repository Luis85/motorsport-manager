// Historical regression adapted explicitly for v10 research, beds, physical stalls and door routing.
const V10=require('./test-v10-fixtures.cjs');
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const L=require('./simulation.cjs'),R=require('./rpg.js'),A=require('./adventure-content.js'),BT=require('./behavior-tree.js'),S=require('./story-codec.js'),C=require('./content-runtime.js');
const results=[];const test=(name,fn)=>{try{fn();results.push({name,passed:true});}catch(e){results.push({name,passed:false,error:e.stack});console.error('FAIL',name,e.message);}};
const clone=A.copy,canonical=e=>JSON.stringify(e.export()),fresh=()=>{const e=new L.Engine();e.s.started=true;e.s.paused=false;return e;},demo=()=>{const e=L.createColonyDemo();e.selectCreature('c1');return e;};
const run=(e,n)=>{for(let i=0;i<n*4;i++)e.step(.25);};
const until=(e,p,n=500)=>{for(let i=0;i<n*4;i++){if(p())return;e.step(.25);}assert(p(),'condition not reached in '+n+' simulated seconds');};
const count=e=>Object.fromEntries([...Object.keys(L.RES),...A.content.equipment.map(g=>g.id),'wooden_chest'].map(id=>[id,(e.s.colony.warehouse.inventory[id]||0)+e.creatures.reduce((n,c)=>n+(c.inventory[id]||0),0)]));
const readyQuest=e=>{e.selectCreature('c1');e.actor.task=null;e.actor.orders=[];e.actor.training=null;e.actor.learning.queue=[];Object.assign(e.actor.needs,{food:90,water:90,energy:90,comfort:80,joy:80});e.actor.feelings.anger=0;e.actor.inventory.berries=5;e.actor.inventory.water=5;assert(e.acceptQuest(e.s.colony.board.offers.find(o=>o.questId==='meadow').id).ok);assert(e.depart());return e.actor.activeQuest;};
const roundtrip=e=>{const before=canonical(e),aHash=A.hash,cHash=C.registry.hash,p=S.inspect(S.encode(e));assert.equal(A.hash,aHash);assert.equal(C.registry.hash,cHash);const restored=S.commit(p);assert.equal(canonical(restored),before);return restored;};
for(const [target,dice,success,critical]of [[10,[3,3,4],true,false],[10,[3,4,4],false,false],[3,[1,1,2],true,true],[2,[1,1,1],false,false],[15,[1,2,2],true,true],[14,[1,2,2],true,false],[16,[2,2,2],true,true],[15,[2,2,2],true,false],[15,[6,6,5],false,true],[16,[6,6,5],false,false],[25,[6,6,6],false,true],[5,[5,5,5],false,true]])test('3d6 target '+target+' roll '+dice.join('+'),()=>{let r=R.resolve(target,dice);assert.equal(r.success,success);assert.equal(r.critical,critical);});
test('Exact 3d6 probability at skill 10 is 108/216',()=>assert.equal(R.odds(10).success,.5));
test('Skill 16 never becomes certain',()=>assert.equal(R.odds(16).success,212/216));
test('Reject invalid dice',()=>assert.throws(()=>R.resolve(10,[0,1,2])));
for(const [p,expected]of [[1,9],[2,10],[4,11],[8,12],[12,13]])test('Average-skill point progression '+p,()=>assert.equal(R.skillLevel(10,'A',p),expected));
test('Skill default at zero points',()=>assert.equal(R.skillLevel(10,'A',0),5));
for(const [p,c]of [[0,1],[1,1],[2,2],[4,4],[8,4],[9,3]])test('Next skill-point cost '+p,()=>assert.equal(R.nextCost(p),c));
for(const [mult,level]of [[1,0],[1.01,1],[2.01,2],[3.01,3],[6.01,4]])test('Encumbrance boundary '+mult,()=>{const l=R.encumbrance(10,0);assert.equal(R.encumbrance(10,l.liftKg*1000*mult).level,level);});
test('Over maximum load detected',()=>assert(R.encumbrance(10,100000).overloaded));
test('RNG deterministic and independent of rendering',()=>assert.deepEqual(R.next(456),R.next(456)));
test('Default expansion validates',()=>assert(A.validate(A.content).ok));
test('Default tree validates',()=>assert(new BT(Object.fromEntries(A.ACTIONS.map(a=>[a,()=> 'failure']))).validate(A.content.behaviorTree)));
test('Behavior selector stops at first viable action',()=>{let calls=[];let b=new BT({a:()=>{calls.push('a');return 'failure';},b:()=>{calls.push('b');return 'running';},c:()=>{calls.push('c');return 'success';}});let tree={id:'root',name:'Root',type:'selector',children:['a','b','c'].map(id=>({id,name:id,type:'action',action:id}))};let r=b.tick(tree,{});assert.deepEqual(calls,['a','b']);assert.equal(r.status,'running');});
test('Behavior handler registry extends without planner edits',()=>{let b=new BT({});b.register('custom',()=> 'success');assert.equal(b.tick({id:'leaf',type:'action',action:'custom',name:'Custom'},{}).status,'success');assert.throws(()=>b.register('custom',()=> 'success'));});
test('Unknown JSON behavior rejected',()=>{let p=clone(A.content);p.behaviorTree.children[2].action='eval';assert(!A.validate(p).ok);});
test('Essential care cannot be removed from root priority',()=>{let p=clone(A.content);p.behaviorTree.children.reverse();assert(!A.validate(p).ok);});
test('Reject duplicate equipment IDs',()=>{let p=clone(A.content);p.equipment.push(clone(p.equipment[0]));assert(!A.validate(p).ok);});
test('Reject missing quest item reference',()=>{let p=clone(A.content);p.quests[0].cost.nope=1;assert(!A.validate(p).ok);});
test('Reject invalid negative item weight',()=>{let p=clone(A.content);p.weights.wood=-1;assert(!A.validate(p).ok);});
test('Reject executable code-like behavior',()=>{let p=clone(A.content);p.behaviorTree.children.push({id:'evil',name:'No',type:'script',code:'alert(1)'});assert(!A.validate(p).ok);});
test('Reject unsafe object keys',()=>assert.throws(()=>A.parse('{"__proto__":{"polluted":true}}')));
test('JSON hash is independent of key order',()=>assert.equal(A.hashOf({a:1,b:2}),A.hashOf({b:2,a:1})));
test('New stable equipment and quest IDs may be authored',()=>{let p=clone(A.content);p.equipment.push({...clone(p.equipment[0]),id:'custom_hat'});p.quests.push({...clone(p.quests[0]),id:'custom_quest'});assert(A.validate(p).ok);});
test('Fresh story receives physical starter warehouse',()=>{let e=fresh();assert(e.warehouse());assert(e.findPath(e.warehouse(),true));});
test('Migration conserves inventory totals',()=>{let legacy=new L.LegacyEngine();let before=clone(legacy.s.inventory),e=new L.Engine(legacy.s);for(const[id,n]of Object.entries(before))assert.equal(count(e)[id],n);});
test('Progressive recruitment charges 120 then 198',()=>{let e=V10.beds(fresh());e.s.player.coins=1000;assert.equal(e.purchasePrice(),120);assert.equal(e.purchaseCreature('maker').price,120);assert.equal(e.purchasePrice(),198);assert.equal(e.purchaseCreature('sunny').price,198);assert.equal(e.s.player.coins,682);});
test('New creature gets no duplicated stock or skills',()=>{let e=V10.beds(fresh());e.s.player.coins=300;e.s.skills.woodcraft=true;let c=e.purchaseCreature('maker').creature;assert.equal(Object.values(c.inventory).reduce((a,b)=>a+b,0),0);assert.deepEqual(c.skills,{});assert.notEqual(c.inventory,e.creatures[0].inventory);});
test('Multiple creatures require explicit selection',()=>{let e=demo();e.s.colony.selectedId=null;let s=canonical(e);assert(!e.care('bond').ok);assert(!e.request('wood').ok);assert.equal(canonical(e),s);});
test('Selected care affects only intended creature',()=>{let e=demo();e.selectCreature('c2');let pip=clone(e.creatures[0]);assert(e.care('bond').ok);assert.deepEqual(e.creatures[0],pip);assert(e.creatures[1].bond>22);});
test('One shared clock advances once with three creatures',()=>{let e=demo();let before=e.s.simTime;run(e,10);assert.equal(e.s.simTime-before,10);assert(e.creatures.every(c=>c.task));});
test('Actor scope restores after failed callback',()=>{let e=demo(),c=e.actor;assert.throws(()=>e.withActor('c2',()=>{throw Error('test');}));assert.equal(e.actor,c);});
test('Selection does not consume RNG or advance time',()=>{let e=demo(),rng=e.creatures.map(c=>c.rpg.rng),t=e.s.simTime;e.selectCreature('c2');e.selectCreature('c1');assert.deepEqual(e.creatures.map(c=>c.rpg.rng),rng);assert.equal(e.s.simTime,t);});
test('Insufficient recruitment coins leave state unchanged',()=>{let e=fresh();e.s.player.coins=0;let s=canonical(e);assert(!e.purchaseCreature('maker').ok);assert.equal(canonical(e),s);});
test('Food in warehouse cannot be remotely fed',()=>{let e=fresh();e.s.inventory.berries=0;e.s.inventory.meals=0;e.s.colony.warehouse.inventory.berries=10;let s=canonical(e);assert(!e.care('feed').ok);assert.equal(canonical(e),s);});
test('Remote warehouse withdrawal has no effect',()=>{let e=fresh();e.s.creature.x=17;e.s.creature.y=16;e.s.colony.warehouse.inventory.wood=3;let s=count(e);e.finishTask({kind:'withdraw',resource:'wood',amount:2});assert.deepEqual(count(e),s);assert.equal(e.s.inventory.wood,0);});
test('Actual walk and withdrawal conserves item ownership',()=>{let e=fresh();e.s.creature.x=17;e.s.creature.y=16;e.s.colony.warehouse.inventory.wood=3;e.s.stockTargets={};let before=count(e).wood;e.startTask(e.resourceTask('wood',null,false,2));until(e,()=>e.s.inventory.wood>=2,30);assert(e.at(e.warehouse()));assert.equal(count(e).wood,before);assert.equal(e.s.colony.warehouse.inventory.wood,1);});
test('Urgently hungry creature fetches then consumes own stock',()=>{let e=fresh();e.s.inventory.berries=0;e.s.colony.warehouse.inventory.berries=6;e.s.needs.food=5;e.s.creature.x=17;e.s.creature.y=16;until(e,()=>e.s.needs.food>30,90);assert(e.s.colony.warehouse.transfers.some(t=>t.direction==='out'&&t.items.berries));});
test('Empty warehouse has natural gathering fallback',()=>{let e=fresh();e.s.inventory.berries=0;e.s.colony.warehouse.inventory.berries=0;e.s.needs.food=5;until(e,()=>e.s.needs.food>30,160);assert(e.s.stats.gathered>0);});
test('Carried stock is not available for selling',()=>{let e=demo();e.s.colony.warehouse.inventory.wood=0;e.s.inventory.wood=3;let before=e.s.player.coins;assert(!e.sellItem('wood',1).ok);assert.equal(e.s.player.coins,before);});
test('Deposited listing stays pending until physical stall sale',()=>{let e=demo();e.s.colony.warehouse.inventory.wood=3;let stock=e.s.inventory.wood,coins=e.s.player.coins;assert(e.sellItem('wood',2).ok);assert.equal(e.s.colony.warehouse.inventory.wood,3);assert.equal(e.s.inventory.wood,stock);assert.equal(e.s.player.coins,coins);assert.equal(e.s.market.orders.at(-1).remaining,2);});
test('No player-side buy or transfer global stock',()=>{let e=demo();assert(!e.trade('wood','buy',1).ok);});
test('Remote deposit does not teleport stock',()=>{let e=fresh();e.s.creature.x=17;e.s.creature.y=16;e.s.inventory.wood=4;let w=e.s.colony.warehouse.inventory.wood;e.finishTask({kind:'deposit'});assert.equal(e.s.inventory.wood,4);assert.equal(e.s.colony.warehouse.inventory.wood,w);});
test('Warehouse deposit physically occurs and conserves count',()=>{let e=fresh();e.s.inventory.wood=4;let before=count(e).wood;e.startTask(e.depositTask());until(e,()=>e.s.inventory.wood===0,30);assert.equal(count(e).wood,before);assert(e.s.colony.warehouse.transfers.some(t=>t.direction==='in'));});
test('Equipment suggestion does not teleport inventory',()=>{let e=demo();e.selectCreature('c2');assert(e.requestEquipment('walking_boots').ok);assert.equal(e.s.inventory.walking_boots||0,0);assert.equal(e.actor.equipment.feet,null);});
test('Creature fetches equipment and wears its own instance',()=>{let e=demo();e.selectCreature('c2');e.actor.feelings.anger=0;assert(e.requestEquipment('walking_boots').ok);until(e,()=>e.creatures[1].equipment.feet==='walking_boots',120);assert(e.creatures[1].inventory.walking_boots>=1);});
test('One worn item counts only once in carried weight',()=>{let e=demo();let before=e.load().grams;e.unequip('head');assert.equal(e.load().grams,before);});
test('Equipment improves applicable check and route time',()=>{let e=demo();let q=A.content.quests[0],withGear=e.questForecast(q);e.actor.equipment=Object.fromEntries(A.slots.map(s=>[s,null]));let without=e.questForecast(q);assert(withGear.duration<without.duration);assert(withGear.checks.some((c,i)=>c.target>without.checks[i].target));});
test('A learned skill receives practice points without sharing',()=>{let e=demo(),other=clone(e.creatures[1].rpg);let before=e.actor.rpg.points.woodcraft;e.practiceSkill('woodcraft',8);assert(e.actor.rpg.points.woodcraft>before);assert.deepEqual(e.creatures[1].rpg,other);});
test('Level grants character points to that creature',()=>{let e=demo(),before=e.actor.rpg.cp;e.xp('creature',100);assert(e.actor.rpg.cp>before);assert.equal(e.creatures[1].rpg.cp,0);});
test('CP skill improvement deducts exact cost',()=>{let e=demo();e.actor.rpg.cp=20;let pts=e.actor.rpg.points.woodcraft,cost=R.nextCost(pts);assert(e.spendPoint('woodcraft').ok);assert.equal(e.actor.rpg.cp,20-cost);assert.equal(e.actor.rpg.points.woodcraft,pts+cost);});
test('Accepting quest spends no supplies or energy',()=>{let e=demo();let before=count(e),energy=e.s.needs.energy;assert(e.acceptQuest(e.s.colony.board.offers[0].id).ok);assert.deepEqual(count(e),before);assert.equal(e.s.needs.energy,energy);});
test('Quest cannot depart with only global provisions',()=>{let e=demo();e.s.inventory.berries=0;e.s.inventory.water=0;e.acceptQuest(e.s.colony.board.offers[0].id);assert.equal(e.depart(),false);assert(!e.actor.activeQuest);});
test('Departure charges personal provisions once',()=>{let e=demo();let q=readyQuest(e),definition=A.content.quests.find(t=>t.id===q.questId);for(const[id,n]of Object.entries(definition.cost))assert.equal(e.s.inventory[id],5-n);let before=clone(e.s.inventory);assert(!e.depart());assert.deepEqual(e.s.inventory,before);});
test('All creature commands blocked while questing',()=>{let e=demo();readyQuest(e);for(const op of [()=>e.care('feed'),()=>e.request('wood'),()=>e.requestEquipment('trail_cap'),()=>e.unequip('head'),()=>e.spendPoint('IQ'),()=>e.pauseStudy()]){let before=canonical(e);assert(!op().ok);assert.equal(canonical(e),before);}});
test('Quest snapshot remains fixed while personal needs decline',()=>{let e=demo(),q=readyQuest(e),targets=q.checks.map(c=>c.target);run(e,8);assert.deepEqual(q.checks.map(c=>c.target),targets);assert(q.energySpent>0);assert(e.s.needs.energy<90);});
test('Away creature has no world task; other creatures continue',()=>{let e=demo();readyQuest(e);run(e,10);assert.equal(e.creatures[0].task,null);assert(e.creatures[1].task);});
test('Quest outcome produces auditable dice and return report',()=>{let e=demo();readyQuest(e);until(e,()=>e.actor.questHistory.length>0,200);let report=e.actor.questHistory[0];assert.equal(report.rolls.length,3);assert.equal(report.successes,report.rolls.filter(r=>r.success).length);assert(e.actor.needsDeposit);assert.equal(report.delivered,false);assert.equal(e.s.creature.x,L.colony.GATE.x);});
test('Quest cargo is physically deposited after return',()=>{let e=demo();readyQuest(e);until(e,()=>e.actor.questHistory.length>0,200);let before=count(e);until(e,()=>e.actor.questHistory[0].delivered,90);assert(e.at(e.warehouse()));for(const[id,n]of Object.entries(e.s.inventory))if(!Object.values(e.actor.equipment).includes(id))assert.equal(n,0,'unworn '+id);for(const id of Object.keys(before))if(!['berries','water','meals','bread'].includes(id))assert(count(e)[id]>=before[id]);});
test('Recall costs four energy and has a return leg',()=>{let e=demo();readyQuest(e);run(e,8);let energy=e.s.needs.energy;assert(e.abortQuest().ok);assert.equal(e.s.needs.energy,energy-4);assert(e.actor.activeQuest);assert(!e.abortQuest().ok);run(e,7);assert(e.actor.activeQuest);run(e,2);assert(!e.actor.activeQuest);assert.equal(e.actor.questHistory[0].reward,0);});
test('Cooldown random director replenishes offers without interaction',()=>{let e=fresh();e.s.colony.board.offers=[];let before=e.s.colony.board.sequence;run(e,400);assert(e.s.colony.board.sequence>before);assert(e.s.colony.board.offers.length<=4);});
test('Trait makes personality visible through actual modifiers',()=>{let e=demo();e.selectCreature('c2');assert(e.traitEffects().length);let r=e.skillRating('woodwork');assert(r.modifiers.some(m=>/Handy/.test(m.name)));});
test('Feelings retain causal history and respond to reassurance',()=>{let e=demo();e.selectCreature('c2');e.changeFeeling('A difficult afternoon',-2,20);let anger=e.actor.feelings.anger;assert(e.care('soothe').ok);assert(e.actor.feelings.anger<anger);assert(e.actor.feelings.causes.some(c=>c.reason==='A reassuring moment'));});
test('Anger recovers autonomously and cannot prevent survival care',()=>{let e=fresh();e.actor.feelings.anger=85;e.s.needs.food=5;run(e,120);assert(e.s.needs.food>10);assert(e.actor.feelings.anger<85);});
test('Social meeting creates a persistent pair relationship',()=>{let e=demo();for(const c of e.creatures){c.task=null;c.training=null;c.learning.queue=[];c.orders=[];c.feelings.anger=0;Object.keys(c.needs).forEach(k=>c.needs[k]=90);}let task=e.socialTask();assert(task);e.startTask(task);until(e,()=>Object.keys(e.s.colony.relationships).length>0,100);let relationship=Object.values(e.s.colony.relationships)[0];assert.equal(relationship.meetings,1);assert(relationship.memories.length);});
test('Absent creature cannot join social meeting',()=>{let e=demo();readyQuest(e);e.selectCreature('c2');assert(!e.suggestSocial('c1').ok);});
test('Behavior trace explains actual running intention',()=>{let e=fresh();e.s.needs.water=10;e.decide();assert(e.actor.behavior.trace.some(n=>n.id==='essential'&&n.status==='running'));assert(e.actor.task.need);});
test('Blueprint cannot overlap another creature',()=>{let e=demo();assert(!e.canBuild(9,10));});
test('Two creatures cannot own the same improvement',()=>{let e=demo(),b=e.s.buildings.find(b=>b.kind==='shelter');e.actor.orders.push({id:'test',kind:'shelter',type:'upgrade',buildingId:b.id});e.selectCreature('c2');assert(!e.upgrade(b.id).ok);});
for(const [name,f]of [['fresh',fresh],['workshop',L.createWorkshopDemo],['community',demo]])test('Exact save roundtrip: '+name,()=>roundtrip(f()));
test('Exact save roundtrip mid-quest, before and after rolls',()=>{let e=demo();readyQuest(e);for(const duration of [2,14]){run(e,duration);e=roundtrip(e);}assert(e.actor.activeQuest);});
test('Quest return countdown restores exactly',()=>{let e=demo();readyQuest(e);run(e,3);e.abortQuest();let clone=roundtrip(e);run(e,3);run(clone,3);assert.equal(canonical(e),canonical(clone));});
test('Long-run three-creature save preserves deterministic continuation',()=>{let e=demo();run(e,1800);let restored=roundtrip(e);run(e,120);run(restored,120);assert.equal(canonical(e),canonical(restored));for(const c of e.creatures){assert(Object.values(c.needs).every(n=>Number.isFinite(n)&&n>=0&&n<=100));assert(Object.values(c.inventory).every(n=>Number.isInteger(n)&&n>=0));}});
for(const [name,mutation]of Object.entries({
 'unknown inventory item':s=>s.colony.creatures[0].inventory.mystery=1,
 'negative inventory':s=>s.colony.creatures[0].inventory.wood=-1,
 'duplicate creature':s=>s.colony.creatures.push(clone(s.colony.creatures[0])),
 'wrong equipment owner':s=>s.colony.creatures[1].equipment.head='trail_cap',
 'invalid needs':s=>s.colony.creatures[0].needs.food=-1,
 'missing learning map':s=>s.colony.creatures[0].learning=null,
 'unknown focus':s=>s.colony.creatures[0].focus='remote-control',
 'invalid allowance':s=>s.colony.creatures[0].allowance.limit=-2,
 'invalid behavior trace':s=>s.colony.creatures[0].behavior.trace='not-a-trace',
 'unknown resource node':s=>s.nodes[0].kind='dangerous-script',
 'missing warehouse':s=>s.buildings=s.buildings.filter(b=>b.kind!=='storehouse'),
 'invalid selection':s=>s.colony.selectedId='c99',
 'invalid next creature ID':s=>s.colony.nextCreatureId=2,
 'invalid shared money':s=>s.player.coins=-2,
 'invalid state journal':s=>s.log=[{text:{},time:0}],
 'invalid stock targets':s=>s.colony.creatures[0].stockTargets.nope=20,
 'invalid salvage':s=>s.colony.creatures[0].salvage=[{x:8,y:8,items:{wood:-1}}],
 'unknown personality':s=>s.colony.creatures[0].personality='nope',
 'invalid point values':s=>s.colony.creatures[0].rpg.points.woodcraft=999,
 'unknown relationship':s=>s.colony.relationships['c1|c99']={a:'c1',b:'c99',affinity:20,trust:20,memories:[]}
}))test('Reject malformed save: '+name,()=>{let e=demo(),doc=S.encode(e),before=canonical(e);mutation(doc.state);assert.throws(()=>S.inspect(doc));assert.equal(canonical(e),before);});
test('Definition import blocked during active quest and leaves content intact',()=>{let e=demo();readyQuest(e);let p=clone(A.content);p.equipment[0].name='Edited cap';let h=A.hash;assert.throws(()=>S.applyAdventure(p,e));assert.equal(A.hash,h);});
test('Definition import can explicitly create a new story',()=>{let e=demo(),old=clone(A.content),p=clone(old);p.equipment[0].name='Edited cap';try{let n=S.applyAdventure(p,e,true);assert.equal(n.creatures.length,1);assert.equal(A.content.equipment[0].name,'Edited cap');}finally{A.replace(old);}});
test('Import fingerprint mismatch rejected',()=>{let e=demo(),d=S.encode(e);d.adventure.fingerprint='00000000';assert.throws(()=>S.inspect(d));});

test('Fresh lesson learns through an actual 3d6 task',()=>{let e=fresh();e.s.rp=10;e.s.player.coins=100;assert(e.research('woodcraft').ok);assert(e.teach('woodcraft').ok);until(e,()=>e.actor.skills.woodcraft,400);assert(e.actor.rpg.rolls.some(r=>r.skill==='woodcraft'));assert.equal(e.creatures.length,1);});
test('Staged building gathers ingredients and completes',()=>{let e=fresh();for(const id of ['woodcraft','shelter']){e.s.skills[id]=true;e.s.researched[id]=true;e.actor.rpg.points[id]=8;}let plot;for(let y=6;y<14&&!plot;y++)for(let x=5;x<13&&!plot;x++)if(e.canBuild(x,y))plot={x,y};assert(e.place('shelter',plot.x,plot.y).ok);until(e,()=>e.has('shelter'),900);assert(e.s.stats.built>=1);assert(e.s.colony.warehouse.transfers.length||e.s.stats.gathered>0);});
test('Upgrade save and staged completion remain supported',()=>{let e=demo(),b=e.s.buildings.find(b=>b.kind==='shelter');assert(e.upgrade(b.id).ok);e=roundtrip(e);until(e,()=>e.s.buildings.find(x=>x.id===b.id).level===2,900);assert(e.s.metrics.upgrades>=1);});
test('Paid construction stage survives interruption and import',()=>{let e=demo(),plot;for(let y=6;y<14&&!plot;y++)for(let x=5;x<13&&!plot;x++)if(e.canBuild(x,y))plot={x,y};assert(e.place('workshop',plot.x,plot.y).ok);until(e,()=>e.s.orders[0]?.paid&&e.s.task?.kind==='build',600);let paid=e.s.orders[0].paid;assert(paid);e=roundtrip(e);let before=clone(e.s.inventory);e.s.task=null;e.decide();e.step(.25);assert.deepEqual(e.s.inventory,before);});
test('Stale direct crafting callback cannot consume or create items',()=>{let e=demo();e.s.inventory.wood=2;let stored=e.s.colony.warehouse.inventory.wood,before=e.s.inventory.planks;e.random=()=>.01;e.finishTask({kind:'craft',resource:'planks',label:'Craft planks'});assert.equal(e.s.inventory.planks,before);assert.equal(e.s.inventory.wood,2);assert.equal(e.s.colony.warehouse.inventory.wood,stored);});
test('Chest is unpacked physically, then its contents are stored',()=>{let e=demo();assert(e.requestUnpack().ok);until(e,()=>e.s.colony.warehouse.transfers.some(t=>t.direction==='in'&&Object.keys(t.items).some(id=>A.content.equipment.some(g=>g.id===id))),200);assert(e.s.colony.warehouse.inventory.wooden_chest===0);});
for(const file of ['fixtures/v1-market.json','fixtures/v2-scenario-grown.json','fixtures/v2-scenario-market.json','scenario-v3-grown.json'])test('Legacy migration: '+file,()=>{let doc=JSON.parse(fs.readFileSync(__dirname+'/'+file));let e=S.commit(S.inspect(doc));assert.equal(e.creatures.length,1);assert(e.warehouse());roundtrip(e);});
test('Story with selected talent survives save',()=>{let e=demo();e.actor.specializations.woodland='gatherer';roundtrip(e);});
test('UI focus and sourcing preferences survive save',()=>{let e=demo();e.actor.focus='cozy';e.actor.allowance.sourcing='gather';roundtrip(e);});
const passed=results.filter(r=>r.passed).length;fs.writeFileSync(__dirname+'/v10-regression-v5-test-results.json',JSON.stringify({suite:'Littlewild v5 new engine and contracts',passed,failed:results.length-passed,results},null,2));console.log(`${passed}/${results.length} checks passed`);if(passed<results.length)process.exitCode=1;
