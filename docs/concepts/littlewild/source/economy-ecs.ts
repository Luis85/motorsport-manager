/* Deterministic economy, reward and progression settlement.
 * Domain commands authorize intent and choose reward amounts. This module only validates
 * invariant-safe deltas, applies them atomically, and returns a presentation-neutral outbox.
 * Existing save records remain authoritative; the ECS and duplicate cache are transient.
 */
(function(inputRoot: unknown){
 'use strict';

 type ComponentData=Record<string,unknown>;
 interface EconomyRules {
  format:'littlewild-economy-rules';
  schemaVersion:1;
  xp:Readonly<{base:number;perLevel:number;playerResearchPerLevel:number;actorBondPerLevel:number}>;
  income:Readonly<{pocketShare:number}>;
  limits:Readonly<{balance:number;delta:number;level:number;stat:number}>;
 }
 interface LevelRecord extends ComponentData { coins:number;level:number;xp:number; }
 interface StatsRecord extends ComponentData { [key:string]:number; }
 interface ProgressionRecord extends ComponentData { prestige:number;earnedPrestige:number; }
 interface RpgRecord extends ComponentData { cp:number; }
 interface ActorRecord extends ComponentData { id:string;creature:LevelRecord;bond:number;stats:StatsRecord;rpg?:RpgRecord; }
 interface EconomyState extends ComponentData {
  player:LevelRecord;creature:LevelRecord;bond:number;rp:number;stats:StatsRecord;
  completedQuests:string[];progression?:ProgressionRecord;
 }
 interface SettlementDeltas { guide:number;pocket:number;research:number;playerXp:number;actorXp:number;prestige:number;earnedPrestige:number; }
 interface SettlementSpec { id:string;deltas:SettlementDeltas;stats:StatsRecord;chapterId:string|null;actorCpPerLevel:number; }
 interface SettlementComponent extends ComponentData { spec:SettlementSpec; }
 interface SharedEconomyComponent extends ComponentData { state:EconomyState; }
 interface WalletComponent extends ComponentData { record:LevelRecord; }
 interface LevelProgressComponent extends ComponentData { record:LevelRecord;who:'player'|'actor'; }
 interface ActorStatsComponent extends ComponentData { record:StatsRecord; }
 interface ActorStateComponent extends ComponentData { record:ActorRecord|EconomyState; }
 interface ActorRpgComponent extends ComponentData { record:RpgRecord; }
 interface PrestigeComponent extends ComponentData { record:ProgressionRecord; }
 interface SettlementValues { guide:number;pocket:number;research:number;prestige:number;earnedPrestige:number; }
 interface SettlementPlan {
  player:LevelRecord;actor:LevelRecord;shared:EconomyState;prestige:ProgressionRecord|null;
  actorStats:StatsRecord;values:SettlementValues;
 }
 type SettlementState='pending'|'duplicate'|'blocked'|'planned'|'settled';
 interface SettlementOutcome extends ComponentData {
  ok:boolean;state:SettlementState;duplicate:boolean;levelUps:Array<{who:'player'|'actor';level:number}>;
  levelResearch:number;actorCp:number;chapterAdded:string|null;deltas:SettlementDeltas|null;stats:StatsRecord|null;plan?:SettlementPlan;
 }
 interface SettlementContext { entityId:string;actorId:string; }
 interface SystemSpec<C> { id:string;phase:'pre'|'simulate'|'post';order:number;query:readonly string[];update(world:WorldApi,id:string,dt:number,context:C):void; }
 interface WorldApi {
  readonly entities:ReadonlySet<string>;
  create(id:string):string;destroy(id:string):boolean;remove(id:string,type:string):boolean;has(id:string,...types:string[]):boolean;
  set<T extends ComponentData>(id:string,type:string,data:T):T;
  get<T extends ComponentData=ComponentData>(id:string,type:string):T|undefined;
 }
 interface SchedulerApi { readonly systems:readonly {id:string}[];register<C>(spec:SystemSpec<C>):SchedulerApi;step<C>(world:WorldApi,dt:number,context:C):void; }
 interface EcsApi { World:new()=>WorldApi;Scheduler:new()=>SchedulerApi; }
 interface ContentApi { parse(input:unknown,limit:number):unknown;copy<T>(value:T):T; }
 interface EconomyRuntime {
  readonly world:WorldApi;readonly scheduler:SchedulerApi;readonly rules:EconomyRules;
  settle(state:unknown,actor:unknown,input:unknown):SettlementOutcome;
  splitIncome(amount:number):{guide:number;pocket:number};
  threshold(level:number):number;
 }
 interface EconomyApi { create(rules?:unknown):EconomyRuntime;validateRules(input:unknown):EconomyRules; }
 interface LittlewildRoot { LWECS?:EcsApi;LWContent?:ContentApi;LWEconomyRules?:unknown;LWEconomyECS?:EconomyApi; }
 const root=inputRoot as LittlewildRoot;
 const node=typeof module!=='undefined'&&module.exports;
 const ecs=(node?require('./ecs.js'):root.LWECS) as EcsApi|undefined;
 const content=(node?require('./content-runtime.js'):root.LWContent) as ContentApi|undefined;
 const DEFAULT=node?require('./content/economy-rules.json') as unknown:root.LWEconomyRules;
 if(!ecs||!content||DEFAULT===undefined)throw Error('Economy ECS dependencies are missing.');
 const E:EcsApi=ecs,C:ContentApi=content;
 const own=(object:object,key:PropertyKey):boolean=>Object.prototype.hasOwnProperty.call(object,key);
 const plain=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
 const clone=<T>(value:T):T=>C.copy(value);
 const identity=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z][a-zA-Z0-9._:-]{0,95}$/.test(value);
 const finite=(value:unknown,min:number,max:number):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
 const integer=(value:unknown,min:number,max:number):value is number=>typeof value==='number'&&Number.isInteger(value)&&value>=min&&value<=max;
 const exact=(value:unknown,fields:readonly string[],label:string):Record<string,unknown>=>{
  if(!plain(value)||Object.keys(value).length!==fields.length||fields.some(field=>!own(value,field)))throw Error('Invalid '+label+' schema.');
  return value;
 };
 const required=<T extends ComponentData>(world:WorldApi,id:string,type:string):T=>{
  const value=world.get<T>(id,type);if(!value)throw Error('Missing ECS component: '+type);return value;
 };
 function validateRules(input:unknown):EconomyRules{
  const rules=exact(C.parse(input,64*1024),['format','schemaVersion','xp','income','limits'],'economy rules');
  const xp=exact(rules.xp,['base','perLevel','playerResearchPerLevel','actorBondPerLevel'],'economy XP rules');
  const income=exact(rules.income,['pocketShare'],'economy income rules');
  const limits=exact(rules.limits,['balance','delta','level','stat'],'economy limit rules');
  if(rules.format!=='littlewild-economy-rules'||rules.schemaVersion!==1||
   !integer(xp.base,1,100000)||!integer(xp.perLevel,0,100000)||!integer(xp.playerResearchPerLevel,0,100)||!finite(xp.actorBondPerLevel,0,100)||
   !finite(income.pocketShare,0,1)||!integer(limits.balance,1,Number.MAX_SAFE_INTEGER)||!integer(limits.delta,1,limits.balance)||
   !integer(limits.level,1,1000000)||!integer(limits.stat,1,Number.MAX_SAFE_INTEGER))throw Error('Invalid economy rules.');
  return Object.freeze({format:'littlewild-economy-rules',schemaVersion:1,
   xp:Object.freeze({base:xp.base,perLevel:xp.perLevel,playerResearchPerLevel:xp.playerResearchPerLevel,actorBondPerLevel:xp.actorBondPerLevel}),
   income:Object.freeze({pocketShare:income.pocketShare}),limits:Object.freeze({balance:limits.balance,delta:limits.delta,level:limits.level,stat:limits.stat})});
 }
 function create(rules:unknown=DEFAULT):EconomyRuntime{
  const tuning=validateRules(rules),world=new E.World(),scheduler=new E.Scheduler(),completed=new Set<string>();let serial=0;
  const threshold=(level:number):number=>{if(!integer(level,1,tuning.limits.level))throw Error('Invalid economy level.');return tuning.xp.base+level*tuning.xp.perLevel;};
  const component=<T extends ComponentData>(id:string,type:string,data:T):T=>{
   if(!world.entities.has(id))world.create(id);return world.set(id,type,data);
  };
  function records(stateInput:unknown,actorInput:unknown):{state:EconomyState;actor:ActorRecord|null;actorId:string;actorRecord:LevelRecord;actorStats:StatsRecord}{
   if(!plain(stateInput))throw Error('Invalid economy state.');
   const state=stateInput as unknown as EconomyState;
   if(!plain(state.player)||!integer(state.player.coins,0,tuning.limits.balance)||!integer(state.player.level,1,tuning.limits.level)||!integer(state.player.xp,0,tuning.limits.balance)||
    !integer(state.rp,0,tuning.limits.balance)||!Array.isArray(state.completedQuests))throw Error('Invalid shared economy state.');
   let actor:ActorRecord|null=null;
   if(actorInput!==undefined&&actorInput!==null){if(!plain(actorInput))throw Error('Invalid actor economy state.');actor=actorInput as unknown as ActorRecord;}
   const actorRecord=actor?.creature||state.creature,actorStats=actor?.stats||state.stats;
   if(!plain(actorRecord)||!integer(actorRecord.coins,0,tuning.limits.balance)||!integer(actorRecord.level,1,tuning.limits.level)||!integer(actorRecord.xp,0,tuning.limits.balance)||!plain(actorStats))throw Error('Invalid actor economy state.');
   if(actor&&!identity(actor.id))throw Error('Invalid actor identity.');
   const actorId=actor?'actor:'+actor.id:'actor:legacy';
   component<SharedEconomyComponent>('economy:shared','SharedEconomy',{state});
   component<WalletComponent>('economy:player','Wallet',{record:state.player});component<LevelProgressComponent>('economy:player','LevelProgress',{record:state.player,who:'player'});
   const actorState:ActorRecord|EconomyState=actor||state;if(!finite(actorState.bond,0,100))throw Error('Invalid actor bond state.');
   component<WalletComponent>(actorId,'Wallet',{record:actorRecord});component<LevelProgressComponent>(actorId,'LevelProgress',{record:actorRecord,who:'actor'});component<ActorStatsComponent>(actorId,'ActorStats',{record:actorStats});component<ActorStateComponent>(actorId,'ActorState',{record:actorState});
   if(actor?.rpg){if(!plain(actor.rpg)||!integer(actor.rpg.cp??0,0,tuning.limits.stat))throw Error('Invalid actor RPG progression.');component<ActorRpgComponent>(actorId,'ActorRpg',{record:actor.rpg});}else if(world.has(actorId,'ActorRpg'))world.remove(actorId,'ActorRpg');
   if(state.progression){if(!plain(state.progression)||!integer(state.progression.prestige,0,tuning.limits.balance)||!integer(state.progression.earnedPrestige,state.progression.prestige,tuning.limits.balance))throw Error('Invalid prestige state.');component<PrestigeComponent>('economy:village','Prestige',{record:state.progression});}
   else if(world.has('economy:village','Prestige'))world.remove('economy:village','Prestige');
   return {state,actor,actorId,actorRecord,actorStats};
  }
  function normalize(input:unknown):SettlementSpec{
   if(!plain(input))throw Error('Invalid economy settlement.');
   const rawId=input.id||'settlement:'+(++serial);if(!identity(rawId))throw Error('Invalid settlement ID.');
   const delta=(key:string):unknown=>input[key]===undefined?0:input[key];
   const rawDeltas={guide:delta('guide'),pocket:delta('pocket'),research:delta('research'),playerXp:delta('playerXp'),actorXp:delta('actorXp'),prestige:delta('prestige'),earnedPrestige:delta('earnedPrestige')};
   for(const [key,value] of Object.entries(rawDeltas))if(!integer(value,key.endsWith('Xp')?0:-tuning.limits.delta,tuning.limits.delta))throw Error('Invalid settlement delta: '+key);
   const deltas=rawDeltas as SettlementDeltas;if(deltas.earnedPrestige<0)throw Error('Earned prestige cannot decrease.');
   const rawStats=input.stats===undefined?{}:input.stats;if(!plain(rawStats)||Object.entries(rawStats).some(([key,value])=>!identity(key)||!integer(value,-tuning.limits.delta,tuning.limits.delta)))throw Error('Invalid settlement stats.');
   const stats={...rawStats} as StatsRecord;
   const chapterId=input.chapterId??null;if(chapterId!==null&&!identity(chapterId))throw Error('Invalid chapter ID.');
   const cpPerLevel=input.actorCpPerLevel??0;if(!integer(cpPerLevel,0,100))throw Error('Invalid actor level reward.');
   return {id:rawId,deltas,stats,chapterId,actorCpPerLevel:cpPerLevel};
  }
  scheduler.register<SettlementContext>({id:'settlement-plan',phase:'pre',order:10,query:['Settlement','SettlementOutcome'],update(current,id,_dt,ctx){
   const spec=required<SettlementComponent>(current,id,'Settlement').spec,out=required<SettlementOutcome>(current,id,'SettlementOutcome'),shared=required<SharedEconomyComponent>(current,'economy:shared','SharedEconomy').state;
   const player=required<WalletComponent>(current,'economy:player','Wallet').record,actor=required<WalletComponent>(current,ctx.actorId,'Wallet').record,actorStats=required<ActorStatsComponent>(current,ctx.actorId,'ActorStats').record;
   const prestige=current.get<PrestigeComponent>('economy:village','Prestige')?.record||null,d=spec.deltas;
   if(completed.has(spec.id)||(spec.chapterId!==null&&shared.completedQuests.includes(spec.chapterId))){out.state='duplicate';out.duplicate=true;return;}
   const values={guide:player.coins+d.guide,pocket:actor.coins+d.pocket,research:shared.rp+d.research,prestige:(prestige?.prestige||0)+d.prestige,earnedPrestige:(prestige?.earnedPrestige||0)+d.earnedPrestige};
   if(!integer(values.guide,0,tuning.limits.balance)||!integer(values.pocket,0,tuning.limits.balance)||!integer(values.research,0,tuning.limits.balance)||
    ((d.prestige!==0||d.earnedPrestige!==0)&&(!prestige||!integer(values.prestige,0,tuning.limits.balance)||!integer(values.earnedPrestige,values.prestige,tuning.limits.balance)))){out.state='blocked';return;}
   for(const [key,amount] of Object.entries(spec.stats)){const currentValue=actorStats[key]??0;if(!integer(currentValue,-tuning.limits.stat,tuning.limits.stat)||!integer(currentValue+amount,-tuning.limits.stat,tuning.limits.stat)){out.state='blocked';return;}}
   out.plan={player,actor,shared,prestige,actorStats,values};out.state='planned';
  }});
  scheduler.register<SettlementContext>({id:'wallet-settlement',phase:'simulate',order:10,query:['Settlement','SettlementOutcome'],update(current,id){const out=required<SettlementOutcome>(current,id,'SettlementOutcome');if(out.state!=='planned'||!out.plan)return;out.plan.player.coins=out.plan.values.guide;out.plan.actor.coins=out.plan.values.pocket;}});
  function addStat(stats:StatsRecord,key:string,amount:number):void{
   const value=stats[key]??0,next=value+amount;
   if(!integer(value,-tuning.limits.stat,tuning.limits.stat)||!integer(next,-tuning.limits.stat,tuning.limits.stat))throw Error('Statistic limit exceeded.');
   stats[key]=next;
  }
  scheduler.register<SettlementContext>({id:'shared-research-settlement',phase:'simulate',order:20,query:['Settlement','SettlementOutcome'],update(current,id){const spec=required<SettlementComponent>(current,id,'Settlement').spec,out=required<SettlementOutcome>(current,id,'SettlementOutcome');if(out.state!=='planned'||!out.plan)return;out.plan.shared.rp=out.plan.values.research;if(spec.deltas.research>0)addStat(out.plan.actorStats,'researchEarned',spec.deltas.research);}});
  scheduler.register<SettlementContext>({id:'xp-progression',phase:'simulate',order:30,query:['Settlement','SettlementOutcome'],update(current,id,_dt,ctx){
   const spec=required<SettlementComponent>(current,id,'Settlement').spec,out=required<SettlementOutcome>(current,id,'SettlementOutcome');if(out.state!=='planned'||!out.plan)return;
   const apply=(entityId:string,amount:number):number=>{const progress=required<LevelProgressComponent>(current,entityId,'LevelProgress'),record=progress.record;let levels=0;if(!Number.isSafeInteger(record.xp+amount))throw Error('Experience limit exceeded.');record.xp+=amount;while(record.xp>=threshold(record.level)){record.xp-=threshold(record.level);record.level++;levels++;if(record.level>tuning.limits.level)throw Error('Level limit exceeded.');out.levelUps.push({who:progress.who,level:record.level});}return levels;};
   const playerLevels=apply('economy:player',spec.deltas.playerXp),actorLevels=apply(ctx.actorId,spec.deltas.actorXp);
   if(playerLevels){const bonus=playerLevels*tuning.xp.playerResearchPerLevel;if(out.plan.shared.rp+bonus>tuning.limits.balance)throw Error('Research limit exceeded.');out.plan.shared.rp+=bonus;addStat(out.plan.actorStats,'researchEarned',bonus);out.levelResearch=bonus;}
   if(actorLevels){const actorState=required<ActorStateComponent>(current,ctx.actorId,'ActorState').record;actorState.bond=Math.max(0,Math.min(100,actorState.bond+actorLevels*tuning.xp.actorBondPerLevel));if(current.has(ctx.actorId,'ActorRpg')){const rpg=required<ActorRpgComponent>(current,ctx.actorId,'ActorRpg').record,cp=actorLevels*spec.actorCpPerLevel;if(!integer((rpg.cp||0)+cp,0,tuning.limits.stat))throw Error('Character point limit exceeded.');rpg.cp=(rpg.cp||0)+cp;out.actorCp=cp;}}
  }});
  scheduler.register<SettlementContext>({id:'prestige-settlement',phase:'simulate',order:40,query:['Settlement','SettlementOutcome'],update(current,id){const out=required<SettlementOutcome>(current,id,'SettlementOutcome');if(out.state!=='planned'||!out.plan?.prestige)return;out.plan.prestige.prestige=out.plan.values.prestige;out.plan.prestige.earnedPrestige=out.plan.values.earnedPrestige;}});
  scheduler.register<SettlementContext>({id:'stat-settlement',phase:'simulate',order:50,query:['Settlement','SettlementOutcome'],update(current,id){const spec=required<SettlementComponent>(current,id,'Settlement').spec,out=required<SettlementOutcome>(current,id,'SettlementOutcome');if(out.state!=='planned'||!out.plan)return;for(const[key,amount]of Object.entries(spec.stats))addStat(out.plan.actorStats,key,amount);}});
  scheduler.register<SettlementContext>({id:'chapter-settlement',phase:'simulate',order:60,query:['Settlement','SettlementOutcome'],update(current,id){const spec=required<SettlementComponent>(current,id,'Settlement').spec,out=required<SettlementOutcome>(current,id,'SettlementOutcome');if(out.state!=='planned'||!out.plan||!spec.chapterId)return;out.plan.shared.completedQuests.push(spec.chapterId);out.chapterAdded=spec.chapterId;}});
  scheduler.register<SettlementContext>({id:'settlement-outbox',phase:'post',order:10,query:['Settlement','SettlementOutcome'],update(current,id){const spec=required<SettlementComponent>(current,id,'Settlement').spec,out=required<SettlementOutcome>(current,id,'SettlementOutcome');if(out.state!=='planned')return;completed.add(spec.id);out.state='settled';out.ok=true;out.deltas={...spec.deltas};out.stats={...spec.stats};delete out.plan;}});
  function settle(stateInput:unknown,actorInput:unknown,input:unknown):SettlementOutcome{
   const spec=normalize(input),binding=records(stateInput,actorInput),state=binding.state,actor=binding.actor,id='settlement:'+spec.id.replace(/[^a-zA-Z0-9._:-]/g,'_');
   if(world.entities.has(id))world.destroy(id);world.create(id);world.set<SettlementComponent>(id,'Settlement',{spec});
   const out:SettlementOutcome={ok:false,state:'pending',duplicate:false,levelUps:[],levelResearch:0,actorCp:0,chapterAdded:null,deltas:null,stats:null};world.set(id,'SettlementOutcome',out);
   const actorState=required<ActorStateComponent>(world,binding.actorId,'ActorState').record;const snapshot={player:clone(state.player),actor:clone(binding.actorRecord),bond:actorState.bond,rp:state.rp,stats:clone(binding.actorStats),completed:[...state.completedQuests],progression:state.progression?clone(state.progression):null,rpg:actor?.rpg?clone(actor.rpg):null};
   try{scheduler.step(world,.001,{entityId:id,actorId:binding.actorId});}
   catch(error){Object.assign(state.player,snapshot.player);Object.assign(binding.actorRecord,snapshot.actor);actorState.bond=snapshot.bond;state.rp=snapshot.rp;for(const key of Object.keys(binding.actorStats))delete binding.actorStats[key];Object.assign(binding.actorStats,snapshot.stats);state.completedQuests.splice(0,state.completedQuests.length,...snapshot.completed);if(snapshot.progression&&state.progression)Object.assign(state.progression,snapshot.progression);if(snapshot.rpg&&actor?.rpg)Object.assign(actor.rpg,snapshot.rpg);world.destroy(id);throw error;}
   world.destroy(id);return out;
  }
  function splitIncome(amount:number):{guide:number;pocket:number}{if(!integer(amount,0,tuning.limits.delta))throw Error('Invalid income amount.');const pocket=Math.floor(amount*tuning.income.pocketShare);return {guide:amount-pocket,pocket};}
  return Object.freeze({world,scheduler,rules:tuning,settle,splitIncome,threshold});
 }
 const api:EconomyApi=Object.freeze({create,validateRules});root.LWEconomyECS=api;if(node)module.exports=api;
})(globalThis);
