/// <reference path="./interaction-contracts.d.ts" />
/* Authored safe conditions, rule clocks and player encouragement share one invitation path. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {
  LWInteractionRuntime:LWInteraction.Runtime;
  LWRPG:{next(seed:number):{seed:number;value:number}};
  LWGameSettings?:{allowed(engine:LWInteraction.Engine,key:'duels'|'quests'):boolean};
  LWInteractionTriggers?:unknown;
 };
 const R=root.LWInteractionRuntime;
 function decision(e:LWInteraction.Engine,state:LWInteraction.State):number{
  // Independent scheduling entropy never advances quests/world or actor skill-roll streams.
  const seed=state.rng??((e.s.colony.rng^0x9e3779b9)>>>0);
  const next=root.LWRPG.next(seed);state.rng=next.seed;return next.value;
 }
 function matches(c:LWInteraction.Creature,conditions:LWInteraction.Condition[]):boolean{
  return conditions.every(rule=>{
   const value=rule.metric==='idle'?(!c.task||['idle','explore'].includes(c.task.kind)):rule.metric==='trait'?c.traits:rule.metric==='personality'?c.personality:
    rule.metric==='bond'?c.bond:rule.metric==='anger'||rule.metric==='social'?c.feelings[rule.metric]:c.needs[rule.metric];
   if(rule.operator==='contains')return Array.isArray(value)&&value.includes(String(rule.value));
   if(rule.operator==='eq')return value===rule.value;
   return typeof value==='number'&&typeof rule.value==='number'&&(rule.operator==='gte'?value>=rule.value:value<=rule.value);
  });
 }
 function candidates(e:LWInteraction.Engine,definition:LWInteraction.Definition,rule:LWInteraction.Trigger|null,actorId:string|null):{sourceId:string;target:LWInteraction.Target}[]{
  const out:{sourceId:string;target:LWInteraction.Target}[]=[];
  for(const a of e.creatures){
   if(actorId&&a.id!==actorId)continue;if(rule&&!matches(a,rule.source))continue;
   for(const b of e.creatures){
    if(a.id===b.id||(rule&&(!matches(b,rule.target)||R.distance(e,a,b)>rule.maximumDistance||e.relationship(a.id,b.id).affinity<rule.minimumAffinity)))continue;
    const target:LWInteraction.Target={scope:'creature',id:b.id};if(!R.eligible(e,definition,a.id,target))out.push({sourceId:a.id,target});
   }
  }
  return out;
 }
 function seek(e:LWInteraction.Engine,actorId:unknown,definitionId:unknown=null,ruleId:unknown=null):LWInteraction.Result{
  if(root.LWGameSettings&&!root.LWGameSettings.allowed(e,'duels'))return {ok:false,reason:'Duels are disabled in Settings.'};
  const c=e.creatures.find(c=>c.id===actorId),current=R.state(e);
  if(!c||c.activeQuest)return {ok:false,reason:'Choose a creature who is home.'};
  if(R.busy(e,c.id))return {ok:false,reason:'Finish or cancel this creature’s interaction first.'};
  const rule=ruleId===null?null:current.library.triggers.find(r=>r.id===ruleId);
  if(ruleId!==null&&!rule)return {ok:false,reason:'Unknown duel trigger rule.'};
  const definition=definitionId===null?(rule?current.library.definitions.find(d=>d.id===rule.definitionId):current.library.definitions.find(d=>d.executor==='duel')):current.library.definitions.find(d=>d.id===definitionId&&d.executor==='duel');
  if(!definition||(rule&&rule.definitionId!==definition.id))return {ok:false,reason:'Choose a known duel profile compatible with the rule.'};
  const existing=current.seeks.find(v=>v.actorId===c.id);
  if(existing&&existing.definitionId===definition.id&&existing.ruleId===(rule?.id??null))return {ok:true};
  const s=e.s.creatureInteractions??(e.s.creatureInteractions=current),now=e.s.simTime;
  s.seeks=s.seeks.filter(v=>v.actorId!==c.id);s.seeks.push({actorId:c.id,definitionId:definition.id,ruleId:rule?.id??null,created:now,expires:now+300,nextSearchAt:now});return {ok:true};
 }
 function cancelSeek(e:LWInteraction.Engine,actorId:unknown):LWInteraction.Result{
  const s=e.s.creatureInteractions;if(!s||!s.seeks.some(v=>v.actorId===actorId))return {ok:false,reason:'This creature is not looking for a duel.'};
  s.seeks=s.seeks.filter(v=>v.actorId!==actorId);return {ok:true};
 }
 function step(e:LWInteraction.Engine):void{
  if(!e.s.started||e.s.paused)return;
  if(root.LWGameSettings&&!root.LWGameSettings.allowed(e,'duels'))return;
  const s=R.state(e),now=e.s.simTime;
  for(const intent of [...s.seeks]){
   const c=e.creatures.find(c=>c.id===intent.actorId);
   if(!c||c.activeQuest||now>=intent.expires){s.seeks=s.seeks.filter(v=>v!==intent);continue;}
   if(now<intent.nextSearchAt)continue;intent.nextSearchAt=now+1;
   const definition=s.library.definitions.find(d=>d.id===intent.definitionId)!,rule=intent.ruleId?s.library.triggers.find(r=>r.id===intent.ruleId)!:null;
   const choices=candidates(e,definition,rule,c.id);
   if(choices.length){const selected=choices[Math.floor(decision(e,s)*choices.length)]!;
    if(R.request(e,definition.id,selected.sourceId,selected.target).ok)s.seeks=s.seeks.filter(v=>v!==intent);
   }
  }
  const due=s.library.triggers.filter(rule=>now>=(s.triggerAt[rule.id]??0)).sort((a,b)=>b.priority-a.priority||(a.id<b.id?-1:a.id>b.id?1:0));
  for(const rule of due){
   s.triggerAt[rule.id]=now+rule.intervalSeconds;
   const definition=s.library.definitions.find(d=>d.id===rule.definitionId)!;
   // Autonomous is an authored profile permission; explicit seek and staging remain available.
   if(!definition.autonomous||rule.chancePercent===0)continue;
   const choices=candidates(e,definition,rule,null);if(!choices.length)continue;
   if(rule.chancePercent<100&&decision(e,s)*100>=rule.chancePercent)continue;
   const selected=choices[Math.floor(decision(e,s)*choices.length)]!;R.request(e,definition.id,selected.sourceId,selected.target);
  }
 }
 const api=Object.freeze({matches,candidates,seek,cancelSeek,step});root.LWInteractionTriggers=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
