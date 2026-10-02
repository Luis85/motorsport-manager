'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),L=require('./simulation.cjs'),S=require('./story-codec.js');
const C=global.LWGrowth,A=global.LWAdventure,B=global.LWContent,G=global.LWGeography,P=global.LWPlanner;
const results=[],copy=C.clone,snap=e=>JSON.stringify(e.export());
function test(name,fn){const t=performance.now();try{fn();results.push({name,passed:true,ms:performance.now()-t});}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL',name,error.stack);}}
function clean(){const e=L.createWorldDemo();e.s.started=true;e.s.paused=false;e.selectCreature('c1');for(const c of e.creatures){Object.assign(c,{task:null,orders:[],training:null,equipQueue:[],questPlan:null,activeQuest:null,stockTargets:{},socialIntent:null});c.learning.queue=[];c.learning.paused=true;c.feelings.anger=0;c.feelings.coolingUntil=0;for(const n in c.needs)c.needs[n]=95;}for(const b of e.s.buildings)if(b.storage)Object.assign(b.storage,{job:null,requests:{},targets:{}});return e;}
function rich(){const e=clean();e.s.player.level=20;e.s.player.coins=1e7;e.s.progression.prestige=e.s.progression.earnedPrestige=1e7;return e;}
function reject(e,fn){const before=snap(e);const r=fn();assert.equal(r.ok,false);assert.equal(snap(e),before);return r;}
function restored(e){return S.commit(S.inspect(S.encode(e)));}
function advance(e,s){for(let i=0;i<s*10;i++)e.step(.1);}
function start(e,id){const offer=e.s.colony.board.offers.find(o=>o.id===id||o.questId===id);assert(offer);const q=A.content.quests.find(q=>q.id===offer.questId);for(const[k,n]of Object.entries(q.cost))e.actor.inventory[k]=n+1;for(const slot in e.actor.equipment){const item=e.actor.equipment[slot];if(item)e.actor.inventory[item]=1;}e.actor.needs.energy=100;e.actor.equipQueue=[];assert(e.acceptQuest(offer.id).ok);assert(e.depart());return e.actor.activeQuest;}
function closeCheckpoints(e,success=true){const q=e.actor.activeQuest;q.elapsed=q.duration;q.checkIndex=q.checks.length;q.successes=success?q.checks.length:0;q.rolls=q.checks.map(c=>({dice:success?[1,1,1]:[6,6,6],total:success?3:18,target:c.target,margin:c.target-(success?3:18),success,outcome:success?'Critical success':'Critical failure'}));q.outcome=success?'Completed':'A partial discovery';q.status='returning';q.returnRemaining=0;return q;}
function packBad(edit){const p=copy(C.content);edit(p);const v=C.validate(p);assert(!v.ok);return v;}
function saveBad(edit){const e=rich(),d=S.encode(e),before=snap(e),hash=C.hash;edit(d.state);assert.throws(()=>S.inspect(d));assert.equal(snap(e),before);assert.equal(C.hash,hash);}

test('Runtime and independent schema agree on Growth schema 2',()=>{assert.equal(C.content.schemaVersion,2);assert(C.validate(C.content).ok);assert.equal(C.content.research.length,58);});
test('A new story has one owned-island clock without a map table',()=>{const e=new L.Engine();assert.equal(e.export().version,8);assert.deepEqual(Object.keys(e.s.atlas.clocks),['0,0']);assert.equal(e.mapTable(),null);});
test('Every repeated scenario factory produces the current canonical engine',()=>{for(let i=0;i<3;i++)for(const key of ['createWorldDemo','createColonyDemo','createWorkshopDemo']){const e=L[key]();assert(e instanceof L.Engine);assert(e.s.atlas);assert.equal(e.export().version,8);assert.doesNotThrow(()=>restored(e));}});
test('Only the authored world example receives a completed map table',()=>{assert(L.createWorldDemo().mapTable());assert(!L.createColonyDemo().mapTable());assert(!new L.Engine().mapTable());});
test('Map-table blueprint has finite material costs and research requirements',()=>{assert.deepEqual(L.BUILDINGS.map_table.cost,{planks:4,wood:4});assert.equal(C.content.requirements.buildings.map_table.research,'blueprint-map-table');assert(!new L.Engine().unlocked('buildings','map_table'));});
test('Wealth and old land research alone cannot bypass construction',()=>{const e=rich();e.s.buildings=e.s.buildings.filter(b=>b.kind!=='map_table');assert.match(reject(e,()=>e.buyIsland(1,0)).reason,/map table/i);assert.match(e.mapAccessIssue(),/blueprint is known/);});
test('A map-table building order is not an operational table',()=>{const e=rich(),b=e.mapTable();e.s.buildings=e.s.buildings.filter(x=>x!==b);assert(e.place('map_table',b.x,b.y).ok);assert.match(e.mapAccessIssue(),/Finish/);reject(e,()=>e.buyIsland(1,0));});
test('A completed map table grants map access but not free islands',()=>{const e=clean();assert.equal(e.mapAccessIssue(),null);assert.equal(e.s.estate.islands.length,1);});
test('Missing land research still blocks buying with a completed map table',()=>{const e=rich();delete e.s.progression.research['feature-land'];reject(e,()=>e.buyIsland(1,0));});
test('Blocked map-table approaches are reported instead of granting access',()=>{const e=rich(),b=e.mapTable();for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]])e.s.buildings.push({id:'b'+e.s.nextId++,kind:'shelter',x:b.x+dx,y:b.y+dy,level:1});assert.equal(e.mapTable(),null);assert.match(e.mapAccessIssue(),/approach/);reject(e,()=>e.buyIsland(1,0));});
test('Repeated map inspection is observational, including all random streams',()=>{const e=rich(),before=snap(e);for(let n=0;n<20;n++)for(const i of G.frontier(e.s)){e.islandProfile(i.ix,i.iy);e.landQuote(i.ix,i.iy);e.islandPurchaseIssue(i.ix,i.iy);}assert.equal(snap(e),before);});
test('Every biome carries an explicit level and valid quest pool',()=>{const e=rich(),seen=new Set();for(let x=-4;x<=4;x++)for(let y=-4;y<=4;y++){const p=e.islandProfile(x,y);seen.add(p.biome);assert(p.questIds.length>=2);assert(p.questIds.every(id=>A.content.quests.some(q=>q.id===id)));assert(p.minimumLevel>=1);}assert.equal(seen.size,4);});
test('Farther islands add visible guide-level requirements',()=>{const e=rich();for(let x=1;x<4;x++){const p=e.islandProfile(x,0),b=C.content.cartography.biomes.find(b=>b.id===p.biome);assert.equal(p.minimumLevel,Math.max(C.content.rules.landLevel,b.minimumLevel)+x-1);}});
test('Individual island level requirements reject atomically',()=>{const e=rich(),i=G.frontier(e.s).find(i=>e.landQuote(i.ix,i.iy).level>4);assert(i);e.s.player.level=4;assert.match(reject(e,()=>e.buyIsland(i.ix,i.iy)).reason,/requires guide level/);});
test('Malformed coordinates cannot change an island purchase',()=>{for(const xy of [[NaN,0],[Infinity,0],[1.5,0],[49,0],['1',0]]){const e=rich();reject(e,()=>e.buyIsland(...xy));}});
test('Insufficient coin balance leaves prestige and topology untouched',()=>{const e=rich();e.s.player.coins=0;reject(e,()=>e.buyIsland(1,0));});
test('Insufficient prestige leaves coins and topology untouched',()=>{const e=rich();e.s.progression.prestige=0;reject(e,()=>e.buyIsland(1,0));});
test('An adjacent purchase commits exactly its reviewed price and one clock',()=>{const e=rich(),q=e.landQuote(1,0);assert(e.buyIsland(1,0,q).ok);assert.equal(e.s.player.coins,1e7-q.coins);assert.equal(e.s.progression.prestige,1e7-q.prestige);assert.deepEqual(Object.keys(e.s.atlas.clocks).sort(),['0,0','1,0']);assert.equal(G.bridges(e.s).length,1);});
test('A stale quote after another purchase rejects without a second debit',()=>{const e=rich(),q=e.landQuote(0,1);assert(e.buyIsland(1,0).ok);assert.match(reject(e,()=>e.buyIsland(0,1,q)).reason,/stale/);});
test('A stale quote after content revision rejects before debit',()=>{const e=rich(),q=e.landQuote(1,0),p=copy(C.content);p.revision='test-new-revision';C.withLibrary(p,()=>assert.match(reject(e,()=>e.buyIsland(1,0,q)).reason,/stale/));});
test('Duplicate purchase creates neither another receipt nor another bridge',()=>{const e=rich();e.buyIsland(1,0);reject(e,()=>e.buyIsland(1,0));});
test('New island resources do not teleport to inventories',()=>{const e=rich(),inventory=copy(e.creatures.map(c=>c.inventory)),warehouse=copy(e.s.colony.warehouse.inventory);e.buyIsland(1,0);assert.deepEqual(e.creatures.map(c=>c.inventory),inventory);assert.deepEqual(e.s.colony.warehouse.inventory,warehouse);});
test('An island purchase opens one invitation from that island’s pool',()=>{const e=rich();e.buyIsland(1,0);const o=e.s.colony.board.offers.filter(o=>o.islandId==='1,0');assert.equal(o.length,1);assert(e.islandProfile(1,0).questIds.includes(o[0].questId));});
test('Template reuse across islands does not reuse invitation identity',()=>{const e=rich();e.buyIsland(1,0);e.s.colony.board.offers=[];assert(e.addOffer('meadow','fixture','0,0'));assert(e.addOffer('meadow','fixture','1,0'));assert.equal(new Set(e.s.colony.board.offers.map(q=>q.offerId)).size,2);assert.doesNotThrow(()=>restored(e));});
test('An unowned island cannot inject an invitation',()=>{const e=rich(),before=snap(e);assert.equal(e.addOffer('meadow','fixture','8,8'),false);assert.equal(snap(e),before);});
test('Duplicate same-island invitations are rejected without sequence growth',()=>{const e=rich(),o=e.s.colony.board.offers[0],before=snap(e);assert.equal(e.addOffer(o.questId,'fixture',o.islandId),false);assert.equal(snap(e),before);});
test('Invitation cooldowns do not consume a creature’s GURPS RNG',()=>{const e=rich(),before=e.creatures.map(c=>c.rpg.rng);e.s.colony.board.offers=[];e.s.atlas.clocks['0,0'].nextAt=0;e.updateQuestBoard();assert.deepEqual(e.creatures.map(c=>c.rpg.rng),before);});
test('Per-island director does not create early opportunities',()=>{const e=rich();e.s.colony.board.offers=[];const before=snap(e);e.updateQuestBoard();assert.equal(e.s.colony.board.offers.length,0);assert.deepEqual(e.s.atlas,JSON.parse(before).state.atlas);});
test('Expired invitations are removed without replacing them before cooldown',()=>{const e=rich();for(const o of e.s.colony.board.offers)o.expires=e.s.simTime;e.updateQuestBoard();assert.equal(e.s.colony.board.offers.length,0);});
test('Random misses have a bounded guaranteed next invitation',()=>{const p=copy(C.content);p.cartography.eventChance=0;p.cartography.guaranteedAfterMisses=2;C.withLibrary(p,()=>{const e=rich();e.s.colony.board.offers=[];assert(!e.offerForIsland('0,0'));assert(!e.offerForIsland('0,0'));assert(e.offerForIsland('0,0'));assert.equal(e.s.atlas.clocks['0,0'].misses,0);});});
test('Pending or active island journey suppresses additional island cycles',()=>{const e=rich();start(e,'meadow');e.s.colony.board.offers=[];assert(!e.offerForIsland('0,0',true));});
test('New invitations enforce current guide-level requirements',()=>{const e=rich();e.buyIsland(1,0);const o=e.s.colony.board.offers.find(o=>o.islandId==='1,0');e.s.player.level=1;assert.match(reject(e,()=>e.acceptQuest(o.id)).reason,/Guide level/);});
test('Island invitations enforce the individual creature’s level',()=>{const e=rich();e.s.colony.board.offers=[];e.addOffer('ruins','fixture');e.actor.creature.level=1;assert.match(reject(e,()=>e.acceptQuest(e.s.colony.board.offers[0].id)).reason,/creature level/);});
test('Accepting an invitation copies its origin but consumes no provisions',()=>{const e=rich(),o=e.s.colony.board.offers.find(o=>o.questId==='meadow'),before=copy(e.actor.inventory);assert(e.acceptQuest(o.id).ok);assert.equal(e.actor.questPlan.islandId,o.islandId);assert.equal(e.actor.questPlan.offerId,o.id);assert.deepEqual(e.actor.inventory,before);});
test('Departure snapshots origin and charges carried provisions only once',()=>{const e=rich(),q=start(e,'meadow'),before=snap(e);assert.equal(q.islandId,'0,0');assert(q.offerId.startsWith('offer'));assert.equal(e.depart(),false);assert.equal(snap(e),before);});
test('An away creature cannot be fed or equipped through its context',()=>{const e=rich();start(e,'meadow');reject(e,()=>e.care('feed'));reject(e,()=>e.requestEquipment('trail_cap'));});
test('Pending quests retain island requirements in planner rows',()=>{const e=rich(),o=e.s.colony.board.offers.find(o=>o.questId==='meadow');e.acceptQuest(o.id);const row=P.rows(e).find(r=>r.type==='quest');assert(row);assert.match(row.detail,/Mossmeadow/);});
test('Reassignment cannot bypass the recipient’s expedition level',()=>{const e=rich();e.s.colony.board.offers=[];e.addOffer('ruins','fixture');e.actor.creature.level=5;e.acceptQuest(e.s.colony.board.offers[0].id);e.creatures[1].creature.level=1;const row=P.rows(e).find(r=>r.type==='quest');reject(e,()=>P.act(e,row.key,'assign','c2'));});
test('Paused quest plans survive exact portable round-trip',()=>{const e=rich(),o=e.s.colony.board.offers.find(o=>o.questId==='meadow');e.acceptQuest(o.id);const row=P.rows(e).find(r=>r.type==='quest');assert(P.act(e,row.key,'pause').ok);const r=restored(e);assert.equal(snap(r),snap(e));assert(r.actor.questPlan.paused);});
test('Early return callback cannot settle an unfinished quest',()=>{const e=rich();start(e,'meadow');const before=snap(e);assert.equal(e.returnQuest(),false);assert.equal(snap(e),before);});
test('Return travel time must elapse before rewards',()=>{const e=rich();start(e,'meadow');closeCheckpoints(e);e.actor.activeQuest.returnRemaining=2;const before=snap(e);assert(!e.returnQuest());assert.equal(snap(e),before);});
test('All checkpoints must finish before normal quest settlement',()=>{const e=rich();start(e,'meadow');closeCheckpoints(e);e.actor.activeQuest.checkIndex--;assert(!e.returnQuest());});
test('Completed quest records origin and prestige exactly once',()=>{const e=rich();start(e,'meadow');const q=closeCheckpoints(e),p=e.s.progression.prestige;assert(e.returnQuest());assert(e.s.progression.prestige>p);assert.equal(e.s.atlas.history[0].offerId,q.offerId);assert.equal(e.s.atlas.history[0].outcome,'completed');const before=snap(e);assert(!e.returnQuest());assert.equal(snap(e),before);});
test('Partial outcomes do not grant success prestige',()=>{const e=rich();start(e,'meadow');closeCheckpoints(e,false);const p=e.s.progression.prestige;assert(e.returnQuest());assert.equal(e.s.progression.prestige,p);assert.equal(e.s.atlas.history[0].outcome,'partial');});
test('A recall returns no success reward and records a recalled journey',()=>{const e=rich();start(e,'meadow');const p=e.s.progression.prestige;assert(e.abortQuest().ok);advance(e,20);assert.equal(e.actor.activeQuest,null);assert.equal(e.s.progression.prestige,p);assert.equal(e.s.atlas.history[0].outcome,'recalled');});
test('Live checkpoints and independent island clocks restore deterministically',()=>{const a=rich();a.buyIsland(1,0);start(a,'meadow');advance(a,7);const b=restored(a);for(let i=0;i<1000;i++){a.step(.1);b.step(.1);}assert.equal(snap(a),snap(b));assert(a.s.atlas.history.length);});
test('Two live journeys on different islands remain independently owned',()=>{const e=rich();e.buyIsland(1,0);const off=e.s.colony.board.offers.find(o=>o.islandId==='1,0');start(e,'meadow');e.selectCreature('c2');e.actor.creature.level=5;start(e,off.id);advance(e,15);assert.equal(e.creatures.filter(c=>c.activeQuest).length,2);assert.equal(snap(restored(e)),snap(e));});
for(const [name,edit] of [
 ['missing owned-island clock',s=>delete s.atlas.clocks['0,0']],
 ['clock for unowned island',s=>s.atlas.clocks['7,7']={nextAt:120,misses:0,rng:1}],
 ['non-finite clock',s=>s.atlas.clocks['0,0'].nextAt=NaN],
 ['zero RNG state',s=>s.atlas.clocks['0,0'].rng=0],
 ['duplicate invitation identity',s=>s.colony.board.offers.push(copy(s.colony.board.offers[0]))],
 ['stale identity sequence',s=>s.colony.board.sequence=0],
 ['unowned invitation origin',s=>s.colony.board.offers[0].islandId='9,9'],
 ['negative island level',s=>s.colony.board.offers[0].playerLevel=-1],
 ['oversized retained history',s=>s.atlas.history=Array(257).fill({})]
])test('Malformed save rejects '+name+' without changing live state',()=>saveBad(edit));
test('Premature returning quest is rejected on save import',()=>{const e=rich();start(e,'meadow');e.actor.activeQuest.status='returning';assert.throws(()=>S.inspect(S.encode(e)),/incomplete expedition/);});
test('A settled receipt cannot also be active after import',()=>{const e=rich();start(e,'meadow');const q=copy(closeCheckpoints(e));e.returnQuest();e.actor.activeQuest=q;assert.throws(()=>S.inspect(S.encode(e)),/still active/);});
test('A saved creature cannot prepare and travel at the same time',()=>{const e=rich();start(e,'meadow');e.actor.questPlan={...copy(e.actor.activeQuest),offerId:'legacy-conflicting'};assert.throws(()=>S.inspect(S.encode(e)),/simultaneously/);});
for(const [name,edit] of [
 ['empty quest pool',p=>p.cartography.biomes[0].questIds=[]],
 ['unknown quest reference',p=>p.cartography.biomes[0].questIds=['not-a-quest']],
 ['duplicate quest reference',p=>p.cartography.biomes[0].questIds=['meadow','meadow']],
 ['duplicate biome identity',p=>p.cartography.biomes[1].id=p.cartography.biomes[0].id],
 ['empty biome description',p=>p.cartography.biomes[0].description=''],
 ['negative cooldown',p=>p.cartography.cooldown=-1],
 ['probability above one',p=>p.cartography.eventChance=1.1],
 ['invalid map building',p=>p.cartography.tableBuilding='shelter'],
 ['missing map research',p=>p.research=p.research.filter(r=>r.id!=='blueprint-map-table')],
 ['unsafe endgame prices',p=>{p.rules.landGrowth=4;p.rules.maxIslands=100;}]
])test('Runtime content validation rejects '+name,()=>packBad(edit));
test('An Adventure update cannot remove a quest referenced by island content',()=>{const e=clean(),p=copy(A.content),before=snap(e),a=A.hash,g=C.hash;p.quests=p.quests.filter(q=>q.id!=='stars');assert.throws(()=>S.applyAdventure(p,e,true),/reference|quest/);assert.equal(A.hash,a);assert.equal(C.hash,g);assert.equal(snap(e),before);});
test('Authored world example repeatedly round-trips without adding another table',()=>{const a=rich(),n=a.s.buildings.length;let e=a;for(let i=0;i<4;i++)e=restored(e);assert.equal(e.s.buildings.length,n);assert.equal(e.s.buildings.filter(b=>b.kind==='map_table').length,1);});
const passed=results.filter(r=>r.passed).length;fs.writeFileSync(__dirname+'/v11-domain-results.json',JSON.stringify({suite:'v11 cartography and hardening',passed,total:results.length,results},null,2));console.log(passed+'/'+results.length+' checks passed');if(passed!==results.length)process.exitCode=1;
