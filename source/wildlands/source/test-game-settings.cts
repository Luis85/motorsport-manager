/// <reference path="./application-records.d.ts" />
/// <reference path="./content-contracts.d.ts" />
/// <reference path="./interaction-contracts.d.ts" />
// Tests run the composite showcase game: install its content profile before any engine module loads.
import './test-support/install-games.cjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {toolbox,type Session,type Document} from './developer-sdk.cjs';
interface Preferences {sound:boolean;follow:boolean;reducedMotion:boolean;highContrast:boolean;duels?:boolean;quests?:boolean;}
interface State extends LWApplication.State {settings:Preferences;seed:number;}
interface Save {app:string;version:number;state:State;}
interface Native {
 s:State;creatures:LWApplication.Actor[];actor:LWApplication.Actor;
 export():Save;gameSettings():{duels:boolean;quests:boolean};setGameSettings(input:unknown):LWInteraction.Result;
 selectCreature(id:string):unknown;acceptQuest(id:string):LWInteraction.Result;depart():boolean;
 addOffer(id:string,source:string,islandId?:string):boolean;offerForIsland(id:string,guaranteed?:boolean):boolean;
 updateQuestBoard():void;handlers():Record<string,()=>string>;abortQuest():LWInteraction.Result;step(dt:number):void;
 requestInteraction(id:string,source:string,target:LWInteraction.Target):LWInteraction.Result;
 stageDuel(id:string,a:string,b:string):LWInteraction.Result;seekDuel(id:string):LWInteraction.Result;
 interactionState():LWInteraction.State;interactionBusy(id:string):boolean;stepInteractions():void;
 dispatchCommand(command:unknown):LWInteraction.Result;
}
const root=globalThis as unknown as {
 LW:{Engine:{new(state?:State):Native;import(input:unknown):Native};createWorldDemo():Native};
 LWAdventure:LWContentPorts.AdventureApi;LWGrowth:LWContentPorts.GrowthApi;
 LWStory:{encode(engine:Native):Document;inspect(input:unknown):{engine:Native};commit(preview:unknown):Native};
};
const results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,work:()=>void):void{try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:String(error)});console.error(name,error);}}
const copy=<T,>(v:T):T=>JSON.parse(JSON.stringify(v)) as T;
const snapshot=(e:Native):string=>JSON.stringify(e.export());
function clean():Native{
 const e=root.LW.createWorldDemo();e.selectCreature('c1');e.s.paused=true;e.s.started=true;
 for(const c of e.creatures){c.task=null;c.orders=[];c.questPlan=null;c.activeQuest=null;c.equipQueue=[];c.training=null;c.learning.queue=[];c.learning.paused=true;for(const key of Object.keys(c.needs))c.needs[key as keyof typeof c.needs]=100;c.feelings.anger=0;}
 return e;
}
function quest(e:Native):LWApplication.Quest{
 e.s.player.level=20;
 for(const r of root.LWGrowth.content.research){e.s.progression.research[r.id]=true;if(r.grants)e.s.progression.features[r.grants.feature]=Math.max(e.s.progression.features[r.grants.feature]||0,r.grants.rank);}
 const offer=e.s.colony.board.offers[0]!;assert(offer);
 const definition=root.LWAdventure.content.quests.find(q=>q.id===offer.questId)!;
 for(const [id,n] of Object.entries(definition.cost))e.actor.inventory[id]=n+2;
 e.actor.needs.energy=100;assert(e.acceptQuest(offer.id).ok);assert(e.depart());assert(e.actor.activeQuest);return e.actor.activeQuest;
}
function withSession(work:(g:Session)=>void):void{
 const g=toolbox.create({scenarioId:'littlewild',sceneId:'charted-home'});
 try{work(g);}finally{g.dispose();}
}

test('Legacy defaults and detached queries do not normalize preferences or start time',()=>{
 const e=clean(),before=snapshot(e);assert.deepEqual(e.gameSettings(),{duels:true,quests:true});
 const view=e.gameSettings();view.duels=false;assert.equal(e.gameSettings().duels,true);
 for(const input of [{},{duels:true},{quests:true},{duels:true,quests:true}])assert(e.setGameSettings(input).ok);
 assert.equal(snapshot(e),before);assert.equal(Object.hasOwn(e.s.settings,'duels'),false);
});
test('Flags are independent, usable paused and do not alter audio/accessibility/RNG',()=>{
 const e=clean(),before=copy(e.s),preferences=copy(e.s.settings);
 assert(e.setGameSettings({duels:false}).ok);assert.deepEqual(e.gameSettings(),{duels:false,quests:true});
 assert.equal(e.s.seed,before.seed);assert.equal(e.s.colony.rng,before.colony.rng);assert.equal(e.s.simTime,before.simTime);
 assert.equal(e.s.paused,true);assert.deepEqual(e.creatures.map(c=>c.rpg.rng),before.colony.creatures.map(c=>c.rpg.rng));
 assert.deepEqual({...e.s.settings,duels:undefined}, {...preferences,duels:undefined});
 assert(e.setGameSettings({quests:false}).ok);assert.deepEqual(e.gameSettings(),{duels:false,quests:false});
 assert(e.setGameSettings({duels:true}).ok);assert.deepEqual(e.gameSettings(),{duels:true,quests:false});
 assert(e.setGameSettings({quests:true}).ok);assert.deepEqual(e.gameSettings(),{duels:true,quests:true});
});
test('Malformed patches reject atomically and never execute a getter',()=>{
 const e=clean(),before=snapshot(e);let reads=0;
 const accessor=Object.defineProperty({},'duels',{enumerable:true,get(){reads++;return false;}});
 const hidden=Object.defineProperty({},'quests',{value:false});
 for(const input of [null,[],false,{duels:0},{quests:'false'},{duels:false,quests:null},{duels:false,sound:true},accessor,hidden,{[Symbol('duels')]:false},Object.create({duels:false})]){
  assert.equal(e.setGameSettings(input).ok,false);assert.equal(snapshot(e),before);
 }
 assert.equal(reads,0);
});
test('Disabling duels cancels pending and active pairs and clears seek locks without a round',()=>{
 for(const active of [false,true]){
  const e=clean();assert(e.requestInteraction('friendly-duel','c1',{scope:'creature',id:'c2'}).ok);
  if(active){e.s.paused=false;for(let n=0;n<12;n++)e.step(.1);e.s.paused=true;assert.equal(e.interactionState().active[0]!.status,'active');}
  const before=copy(e.export()),rounds=e.interactionState().active[0]!.rounds.length;
  assert(e.setGameSettings({duels:false}).ok);assert.equal(e.interactionState().active.length,0);
  assert.equal(e.interactionState().history[0]!.status,'cancelled');assert.equal(e.interactionState().history[0]!.rounds.length,rounds);
  assert.equal(e.interactionBusy('c1'),false);assert.equal(e.interactionBusy('c2'),false);
  assert.deepEqual(e.creatures.map(c=>c.inventory),before.state.colony.creatures.map(c=>c.inventory));
  assert.equal(e.s.simTime,before.state.simTime);assert.equal(e.s.colony.rng,before.state.colony.rng);
  const stopped=snapshot(e);assert(e.setGameSettings({duels:false}).ok);assert.equal(snapshot(e),stopped);
 }
 const e=clean();assert(e.seekDuel('c1').ok);assert(e.interactionState().seeks.length);
 assert(e.setGameSettings({duels:false}).ok);assert.equal(e.interactionState().seeks.length,0);
});
test('Disabled direct requests, staging, seeking and automatic rules cannot start duels',()=>{
 const e=clean();assert(e.setGameSettings({duels:false}).ok);const before=snapshot(e);
 assert.equal(e.requestInteraction('friendly-duel','c1',{scope:'creature',id:'c2'}).ok,false);
 assert.equal(e.stageDuel('friendly-duel','c1','c2').ok,false);assert.equal(e.seekDuel('c1').ok,false);
 e.stepInteractions();assert.equal(snapshot(e),before);
 assert(e.setGameSettings({duels:true}).ok);assert.equal(e.interactionState().active.length,0);
 assert(e.requestInteraction('friendly-duel','c1',{scope:'creature',id:'c2'}).ok);
});
test('Disabled quests gate invitations, acceptance and prepared automatic departures without consuming supplies',()=>{
 const e=clean();quest(e);
 const e2=clean();e2.s.player.level=20;for(const [id,value] of Object.entries(e.s.progression.features))e2.s.progression.features[id]=value;e2.s.progression.research=copy(e.s.progression.research);
 const offer=e2.s.colony.board.offers[0]!;assert(e2.acceptQuest(offer.id).ok);const inventory=copy(e2.actor.inventory);
 assert(e2.setGameSettings({quests:false}).ok);const stopped=snapshot(e2);
 assert.equal(e2.depart(),false);assert.equal(e2.handlers().quest!(),'failure');
 assert.equal(e2.acceptQuest(offer.id).ok,false);assert.equal(e2.addOffer('meadow','fixture','0,0'),false);assert.equal(e2.offerForIsland('0,0',true),false);
 e2.updateQuestBoard();assert.equal(snapshot(e2),stopped);assert.deepEqual(e2.actor.inventory,inventory);assert(e2.actor.questPlan);
 assert(e2.setGameSettings({quests:true}).ok);assert(e2.actor.questPlan);assert.equal(e2.actor.activeQuest,null);
});
test('Turning quests off recalls away actors through timed return once, keeping finds and spent provisions',()=>{
 const e=clean(),q=quest(e),actor=e.actor,packed=copy(actor.inventory),position=copy(actor.creature),energy=actor.needs.energy;
 q.found.wood=2;actor.inventory.wood=(actor.inventory.wood||0)+2;
 assert(e.setGameSettings({quests:false}).ok);assert.equal(q.status,'returning');assert.equal(q.aborted,true);assert.equal(q.outcome,'Recalled');assert(q.returnRemaining>0);
 assert.equal(actor.needs.energy,energy-root.LWAdventure.content.rules.abortEnergy);assert.deepEqual(actor.creature,position);
 assert.equal(actor.inventory.wood,(packed.wood||0)+2);for(const [id,n] of Object.entries(packed))if(id!=='wood')assert.equal(actor.inventory[id],n);
 const held=snapshot(e),remaining=q.returnRemaining;assert(e.setGameSettings({quests:false}).ok);e.step(100);assert.equal(snapshot(e),held);assert.equal(q.returnRemaining,remaining);
 assert(e.setGameSettings({quests:true}).ok);assert.equal(q.status,'returning');assert.equal(q.returnRemaining,remaining);
 const prestige=e.s.progression.prestige;e.s.paused=false;for(let i=0;i<500&&actor.activeQuest;i++)e.step(.1);
 assert.equal(actor.activeQuest,null);assert.equal(e.s.progression.prestige,prestige);assert.equal(actor.questHistory[0]!.aborted,true);
});
test('Quest recall authorizes every away actor without selection and preserves actors already returning',()=>{
 const e=clean();quest(e);const first=e.actor;e.selectCreature('c2');quest(e);const second=e.actor;
 assert(e.abortQuest().ok);const returning=copy(second.activeQuest),energy=second.needs.energy;
 e.s.colony.selectedId=null;assert(e.setGameSettings({quests:false}).ok);
 assert.equal(first.activeQuest!.status,'returning');assert.equal(first.activeQuest!.aborted,true);
 assert.deepEqual(second.activeQuest,returning);assert.equal(second.needs.energy,energy);assert.equal(e.s.colony.selectedId,null);
});
test('Native/portable saves persist flags and accept missing legacy flags without replacing other preferences',()=>{
 const e=clean();e.s.settings.sound=true;e.s.settings.highContrast=true;assert(e.setGameSettings({duels:false,quests:false}).ok);
 for(const restored of [root.LW.Engine.import(e.export()),root.LWStory.inspect(root.LWStory.encode(e)).engine]){
  assert.deepEqual(restored.gameSettings(),{duels:false,quests:false});assert.equal(restored.s.settings.sound,true);assert.equal(restored.s.settings.highContrast,true);
 }
 const legacy=e.export();delete legacy.state.settings.duels;delete legacy.state.settings.quests;
 const restored=root.LW.Engine.import(legacy);assert.deepEqual(restored.gameSettings(),{duels:true,quests:true});assert.equal(restored.s.settings.sound,true);
});
test('Imports reject disabled activities with unreturned quests or retained duel locks atomically',()=>{
 const e=clean();quest(e);const save=e.export(),before=snapshot(e);save.state.settings.quests=false;
 assert.throws(()=>root.LW.Engine.import(save));assert.throws(()=>new root.LW.Engine(save.state));assert.equal(snapshot(e),before);
 assert(e.setGameSettings({quests:false}).ok);assert.doesNotThrow(()=>root.LW.Engine.import(e.export()));
 for(const seek of [false,true]){
  const paired=clean();if(seek)assert(paired.seekDuel('c1').ok);else assert(paired.requestInteraction('friendly-duel','c1',{scope:'creature',id:'c2'}).ok);
  const invalid=paired.export(),live=snapshot(paired);invalid.state.settings.duels=false;
  assert.throws(()=>root.LW.Engine.import(invalid));assert.throws(()=>new root.LW.Engine(invalid.state));assert.equal(snapshot(paired),live);
  assert(paired.setGameSettings({duels:false}).ok);assert.doesNotThrow(()=>root.LW.Engine.import(paired.export()));
 }
});
test('Raw constructor, native and portable imports reject nonboolean flags before hydration and preserve the live story',()=>{
 const e=clean(),before=snapshot(e);
 for(const key of ['duels','quests'])for(const value of [null,0,'false',{},[]]){
  const native=copy(e.export()),portable=root.LWStory.encode(e);
  Object.assign(native.state.settings,{[key]:value});
  const state=portable.state as Document;Object.assign(state.settings as Document,{[key]:value});
  const unhydrated=JSON.stringify(native.state);assert.throws(()=>new root.LW.Engine(native.state));assert.equal(JSON.stringify(native.state),unhydrated);
  assert.throws(()=>root.LW.Engine.import(native));assert.throws(()=>root.LWStory.inspect(portable));assert.equal(snapshot(e),before);
 }
 let reads=0;const accessor=copy(e.export().state);
 Object.defineProperty(accessor.settings,'duels',{enumerable:true,get(){reads++;return false;}});
 assert.throws(()=>new root.LW.Engine(accessor));assert.equal(reads,0);
 const outer=copy(e.export().state);Object.defineProperty(outer,'settings',{enumerable:true,get(){reads++;return e.s.settings;}});
 assert.throws(()=>new root.LW.Engine(outer));assert.equal(reads,0);assert.equal(snapshot(e),before);
});
test('Typed SDK settings query/update preserves session isolation and accepts empty/no-op patches',()=>withSession(g=>{
 const before=g.save(),view=g.settings();assert.deepEqual(view,{duels:true,quests:true});
 Object.assign(view,{duels:false});assert.deepEqual(g.settings(),{duels:true,quests:true});assert.deepEqual(g.save(),before);
 assert(g.command({id:'set-game-settings',args:[{}]}).ok);assert.deepEqual(g.save(),before);
 assert(g.command({id:'set-game-settings',args:[{duels:false}]}).ok);assert.deepEqual(g.settings(),{duels:false,quests:true});
 assert.throws(()=>g.command({id:'set-game-settings',actorId:'c1',args:[{quests:false}]} as unknown as LittlewildDeveloper.Command));
 const save=g.save();assert.throws(()=>g.command({id:'set-game-settings',args:[{duels:0}]} as unknown as LittlewildDeveloper.Command));assert.deepEqual(g.save(),save);
}));
test('Disposed and competing sessions cannot query or change game preferences',()=>{
 const g=toolbox.create({scenarioId:'littlewild',sceneId:'charted-home'});
 try{const before=g.save();assert.throws(()=>toolbox.create({scenarioId:'emberworks'}));assert.deepEqual(g.save(),before);}finally{g.dispose();}
 assert.throws(()=>g.settings());assert.throws(()=>g.command({id:'set-game-settings',args:[{quests:false}]}));
});
fs.writeFileSync(__dirname+'/game-settings-results.json',JSON.stringify({passed:results.filter(r=>r.passed).length,total:results.length,results},null,2));
console.log(results.filter(r=>r.passed).length+'/'+results.length+' game settings checks passed.');
if(results.some(r=>!r.passed))process.exit(1);
