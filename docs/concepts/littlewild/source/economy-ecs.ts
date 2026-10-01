/* Deterministic economy, reward and progression settlement.
 * Domain commands authorize intent and choose reward amounts. This module only validates
 * invariant-safe deltas, applies them atomically, and returns a presentation-neutral outbox.
 * Existing save records remain authoritative; the ECS and duplicate cache are transient.
 */
(function(root){
 'use strict';
 const node=typeof module!=='undefined'&&module.exports;
 const E=node?require('./ecs.js'):root.LWECS;
 const C=node?require('./content-runtime.js'):root.LWContent;
 const DEFAULT=node?require('./content/economy-rules.json'):root.LWEconomyRules;
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
 const clone=x=>C.copy(x);
 const identity=s=>typeof s==='string'&&/^[a-zA-Z][a-zA-Z0-9._:-]{0,95}$/.test(s);
 const finite=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
 const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
 function validateRules(input){
  const r=C.parse(input,64*1024),keys=(o,list)=>plain(o)&&Object.keys(o).length===list.length&&list.every(k=>own(o,k));
  if(!keys(r,['format','schemaVersion','xp','income','limits'])||r.format!=='littlewild-economy-rules'||r.schemaVersion!==1||
   !keys(r.xp,['base','perLevel','playerResearchPerLevel','actorBondPerLevel'])||!keys(r.income,['pocketShare'])||
   !keys(r.limits,['balance','delta','level','stat']))throw Error('Invalid economy rules schema.');
  if(!integer(r.xp.base,1,100000)||!integer(r.xp.perLevel,0,100000)||!integer(r.xp.playerResearchPerLevel,0,100)||
   !finite(r.xp.actorBondPerLevel,0,100)||!finite(r.income.pocketShare,0,1)||
   !integer(r.limits.balance,1,Number.MAX_SAFE_INTEGER)||!integer(r.limits.delta,1,r.limits.balance)||
   !integer(r.limits.level,1,1000000)||!integer(r.limits.stat,1,Number.MAX_SAFE_INTEGER))throw Error('Invalid economy rules.');
  return Object.freeze({...r,xp:Object.freeze(r.xp),income:Object.freeze(r.income),limits:Object.freeze(r.limits)});
 }
 function create(rules=DEFAULT){
  const tuning=validateRules(rules),world=new E.World(),scheduler=new E.Scheduler(),completed=new Set();let serial=0;
  const threshold=level=>tuning.xp.base+level*tuning.xp.perLevel;
  const component=(id,type,data)=>{if(!world.entities.has(id))world.create(id);const current=world.get(id,type);if(current){Object.assign(current,data);return current;}return world.set(id,type,data);};
  function records(state,actor){
   if(!plain(state)||!plain(state.player)||!integer(state.player.coins,0,tuning.limits.balance)||
    !integer(state.player.level,1,tuning.limits.level)||!integer(state.player.xp,0,tuning.limits.balance)||
    !integer(state.rp,0,tuning.limits.balance)||!plain(state.stats)||!Array.isArray(state.completedQuests))throw Error('Invalid economy state.');
   const actorRecord=actor?.creature||state.creature,actorStats=actor?.stats||state.stats;
   if(!plain(actorRecord)||!integer(actorRecord.coins,0,tuning.limits.balance)||!integer(actorRecord.level,1,tuning.limits.level)||
    !integer(actorRecord.xp,0,tuning.limits.balance)||!plain(actorStats))throw Error('Invalid actor economy state.');
   if(actor!==undefined&&actor!==null&&!identity(actor.id))throw Error('Invalid actor identity.');
   const actorId=actor?'actor:'+actor.id:'actor:legacy';
   component('economy:shared','SharedEconomy',{state});
   component('economy:player','Wallet',{record:state.player});component('economy:player','LevelProgress',{record:state.player,who:'player'});
   const actorState=actor||state;if(!finite(actorState.bond,0,100))throw Error('Invalid actor bond state.');
   component(actorId,'Wallet',{record:actorRecord});component(actorId,'LevelProgress',{record:actorRecord,who:'actor'});component(actorId,'ActorStats',{record:actorStats});component(actorId,'ActorState',{record:actorState});
   if(actor?.rpg){if(!plain(actor.rpg)||!integer(actor.rpg.cp??0,0,tuning.limits.stat))throw Error('Invalid actor RPG progression.');component(actorId,'ActorRpg',{record:actor.rpg});}else if(world.has(actorId,'ActorRpg'))world.remove(actorId,'ActorRpg');
   if(state.progression){if(!plain(state.progression)||!integer(state.progression.prestige,0,tuning.limits.balance)||
    !integer(state.progression.earnedPrestige,state.progression.prestige,tuning.limits.balance))throw Error('Invalid prestige state.');component('economy:village','Prestige',{record:state.progression});}
   else if(world.has('economy:village','Prestige'))world.remove('economy:village','Prestige');
   return {actorId,actorRecord,actorStats};
  }
  function normalize(spec){
   if(!plain(spec))throw Error('Invalid economy settlement.');
   const id=spec.id||'settlement:'+(++serial);if(!identity(id))throw Error('Invalid settlement ID.');
   const delta=k=>spec[k]===undefined?0:spec[k];
   const deltas={guide:delta('guide'),pocket:delta('pocket'),research:delta('research'),playerXp:delta('playerXp'),actorXp:delta('actorXp'),prestige:delta('prestige'),earnedPrestige:delta('earnedPrestige')};
   for(const [k,n]of Object.entries(deltas))if(!integer(n,k.endsWith('Xp')?0:-tuning.limits.delta,tuning.limits.delta))throw Error('Invalid settlement delta: '+k);
   if(deltas.earnedPrestige<0)throw Error('Earned prestige cannot decrease.');
   const stats=spec.stats===undefined?{}:spec.stats;if(!plain(stats)||Object.entries(stats).some(([k,n])=>!identity(k)||!integer(n,-tuning.limits.delta,tuning.limits.delta)))throw Error('Invalid settlement stats.');
   const chapterId=spec.chapterId??null;if(chapterId!==null&&!identity(chapterId))throw Error('Invalid chapter ID.');
   const cpPerLevel=spec.actorCpPerLevel??0;if(!integer(cpPerLevel,0,100))throw Error('Invalid actor level reward.');
   return {id,deltas,stats:{...stats},chapterId,actorCpPerLevel:cpPerLevel};
  }
  scheduler.register({id:'settlement-plan',phase:'pre',order:10,query:['Settlement','SettlementOutcome'],update(w,id,dt,ctx){
   const spec=w.get(id,'Settlement').spec,out=w.get(id,'SettlementOutcome'),shared=w.get('economy:shared','SharedEconomy').state;
   const player=w.get('economy:player','Wallet').record,actor=w.get(ctx.actorId,'Wallet').record,actorStats=w.get(ctx.actorId,'ActorStats').record;
   const prestige=w.get('economy:village','Prestige')?.record||null,d=spec.deltas;
   if(completed.has(spec.id)||spec.chapterId&&shared.completedQuests.includes(spec.chapterId)){out.state='duplicate';out.duplicate=true;return;}
   const values={guide:player.coins+d.guide,pocket:actor.coins+d.pocket,research:shared.rp+d.research,prestige:(prestige?.prestige||0)+d.prestige,earnedPrestige:(prestige?.earnedPrestige||0)+d.earnedPrestige};
   if(!integer(values.guide,0,tuning.limits.balance)||!integer(values.pocket,0,tuning.limits.balance)||!integer(values.research,0,tuning.limits.balance)||
    (d.prestige||d.earnedPrestige)&&(!prestige||!integer(values.prestige,0,tuning.limits.balance)||!integer(values.earnedPrestige,values.prestige,tuning.limits.balance))){out.state='blocked';return;}
   for(const [k,n]of Object.entries(spec.stats)){const current=actorStats[k]??0;if(!integer(current,-tuning.limits.stat,tuning.limits.stat)||!integer(current+n,-tuning.limits.stat,tuning.limits.stat)){out.state='blocked';return;}}
   out.plan={player,actor,shared,prestige,actorStats,values};out.state='planned';
  }});
  scheduler.register({id:'wallet-settlement',phase:'simulate',order:10,query:['Settlement','SettlementOutcome'],update(w,id){const spec=w.get(id,'Settlement').spec,out=w.get(id,'SettlementOutcome');if(out.state!=='planned')return;out.plan.player.coins=out.plan.values.guide;out.plan.actor.coins=out.plan.values.pocket;}});
  scheduler.register({id:'shared-research-settlement',phase:'simulate',order:20,query:['Settlement','SettlementOutcome'],update(w,id){const spec=w.get(id,'Settlement').spec,out=w.get(id,'SettlementOutcome');if(out.state!=='planned')return;out.plan.shared.rp=out.plan.values.research;if(spec.deltas.research>0)out.plan.actorStats.researchEarned=(out.plan.actorStats.researchEarned||0)+spec.deltas.research;}});
  scheduler.register({id:'xp-progression',phase:'simulate',order:30,query:['Settlement','SettlementOutcome'],update(w,id,dt,ctx){
   const spec=w.get(id,'Settlement').spec,out=w.get(id,'SettlementOutcome');if(out.state!=='planned')return;
   const apply=(entityId,amount)=>{const p=w.get(entityId,'LevelProgress').record,who=w.get(entityId,'LevelProgress').who;let levels=0;p.xp+=amount;while(p.xp>=threshold(p.level)){p.xp-=threshold(p.level);p.level++;levels++;if(p.level>tuning.limits.level)throw Error('Level limit exceeded.');out.levelUps.push({who,level:p.level});}return levels;};
   const playerLevels=apply('economy:player',spec.deltas.playerXp),actorLevels=apply(ctx.actorId,spec.deltas.actorXp);
   if(playerLevels){const bonus=playerLevels*tuning.xp.playerResearchPerLevel;if(out.plan.shared.rp+bonus>tuning.limits.balance)throw Error('Research limit exceeded.');out.plan.shared.rp+=bonus;out.plan.actorStats.researchEarned=(out.plan.actorStats.researchEarned||0)+bonus;out.levelResearch=bonus;}
   if(actorLevels){const actorState=w.get(ctx.actorId,'ActorState').record;actorState.bond=Math.max(0,Math.min(100,actorState.bond+actorLevels*tuning.xp.actorBondPerLevel));if(w.has(ctx.actorId,'ActorRpg')){const r=w.get(ctx.actorId,'ActorRpg').record,cp=actorLevels*spec.actorCpPerLevel;if(!integer((r.cp||0)+cp,0,tuning.limits.stat))throw Error('Character point limit exceeded.');r.cp=(r.cp||0)+cp;out.actorCp=cp;}}
  }});
  scheduler.register({id:'prestige-settlement',phase:'simulate',order:40,query:['Settlement','SettlementOutcome'],update(w,id){const out=w.get(id,'SettlementOutcome');if(out.state!=='planned'||!out.plan.prestige)return;out.plan.prestige.prestige=out.plan.values.prestige;out.plan.prestige.earnedPrestige=out.plan.values.earnedPrestige;}});
  scheduler.register({id:'stat-settlement',phase:'simulate',order:50,query:['Settlement','SettlementOutcome'],update(w,id){const spec=w.get(id,'Settlement').spec,out=w.get(id,'SettlementOutcome');if(out.state!=='planned')return;for(const[k,n]of Object.entries(spec.stats))out.plan.actorStats[k]=(out.plan.actorStats[k]||0)+n;}});
  scheduler.register({id:'chapter-settlement',phase:'simulate',order:60,query:['Settlement','SettlementOutcome'],update(w,id){const spec=w.get(id,'Settlement').spec,out=w.get(id,'SettlementOutcome');if(out.state!=='planned'||!spec.chapterId)return;out.plan.shared.completedQuests.push(spec.chapterId);out.chapterAdded=spec.chapterId;}});
  scheduler.register({id:'settlement-outbox',phase:'post',order:10,query:['Settlement','SettlementOutcome'],update(w,id){const spec=w.get(id,'Settlement').spec,out=w.get(id,'SettlementOutcome');if(out.state!=='planned')return;completed.add(spec.id);out.state='settled';out.ok=true;out.deltas={...spec.deltas};out.stats={...spec.stats};delete out.plan;}});
  function settle(state,actor,input){
   const spec=normalize(input),binding=records(state,actor),id='settlement:'+spec.id.replace(/[^a-zA-Z0-9._:-]/g,'_');
   if(world.entities.has(id))world.destroy(id);world.create(id);world.set(id,'Settlement',{spec});
   const out={ok:false,state:'pending',duplicate:false,levelUps:[],levelResearch:0,actorCp:0,chapterAdded:null,deltas:null,stats:null};world.set(id,'SettlementOutcome',out);
   const actorState=world.get(binding.actorId,'ActorState').record;const snapshot={player:clone(state.player),actor:clone(binding.actorRecord),bond:actorState.bond,rp:state.rp,stats:clone(binding.actorStats),completed:[...state.completedQuests],progression:state.progression?clone(state.progression):null,rpg:actor?.rpg?clone(actor.rpg):null};
   try{scheduler.step(world,.001,{entityId:id,actorId:binding.actorId});}
   catch(error){Object.assign(state.player,snapshot.player);Object.assign(binding.actorRecord,snapshot.actor);actorState.bond=snapshot.bond;state.rp=snapshot.rp;for(const k of Object.keys(binding.actorStats))delete binding.actorStats[k];Object.assign(binding.actorStats,snapshot.stats);state.completedQuests.splice(0,state.completedQuests.length,...snapshot.completed);if(snapshot.progression)Object.assign(state.progression,snapshot.progression);if(snapshot.rpg)Object.assign(actor.rpg,snapshot.rpg);world.destroy(id);throw error;}
   world.destroy(id);return out;
  }
  function splitIncome(amount){if(!integer(amount,0,tuning.limits.delta))throw Error('Invalid income amount.');const pocket=Math.floor(amount*tuning.income.pocketShare);return {guide:amount-pocket,pocket};}
  return Object.freeze({world,scheduler,rules:tuning,settle,splitIncome,threshold});
 }
 const api=Object.freeze({create,validateRules});root.LWEconomyECS=api;if(node)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
