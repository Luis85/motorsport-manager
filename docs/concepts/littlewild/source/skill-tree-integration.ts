/// <reference path="./application-records.d.ts" />
/// <reference path="./engine-core-contracts.d.ts" />
/// <reference path="./skill-tree-contracts.d.ts" />
/* The composed engine owns attachment and progress; the pure rules stage detached values. */
(function(inputRoot:unknown){
 'use strict';
 interface Owner {skillTrees?:LWSkillTrees.Progress[];level:number;}
 interface Actor {id:string;skillTrees?:LWSkillTrees.Progress[];creature:{level:number};}
 interface Host {
  s:{player:Owner;colony?:{creatures:Actor[]}};actor?:Actor;_actor?:Actor;
  settleEconomy(input:LWCorePorts.EconomySpec,label?:string|null):LWCorePorts.EconomyResult;
  workRate(task:LWCorePorts.Task):number;learningRate(style?:string):number;
  purchaseCreature(personality:string,archetype?:string):LWRuntime.Result;
  attachSkillTree(targetId:string,definition:unknown):LWRuntime.Result;
  unlockSkillTreeNode(targetId:string,treeId:string,nodeId:string):LWRuntime.Result;
  skillTreeState(targetId:string):LWSkillTrees.View[];
  grantSkillTreeXp(targetId:string,amount:number):LWRuntime.Result;
 }
 interface Constructor extends Function {prototype:Host;import(input:unknown):Host;}
 const root=inputRoot as {LWSkillTrees:LWSkillTrees.Api;LWContent:{parse(input:unknown,limit?:number):unknown};LWActorStateView:{rootOf(state:unknown):unknown};LWSkillTreeIntegration?:typeof api};
 const rules=root.LWSkillTrees;
 function state(engine:Host):Host['s']{return root.LWActorStateView.rootOf(engine.s) as Host['s'];}
 function owner(engine:Host,targetId:string):{holder:Pick<Owner,'skillTrees'>;level:number}{
  const s=state(engine);
  if(targetId==='player')return {holder:s.player,level:s.player.level};
  const actor=s.colony?.creatures.find(c=>c.id===targetId);
  if(!actor)throw Error('Choose an existing player or creature for this skill tree.');
  return {holder:actor,level:actor.creature.level};
 }
 function validateState(input:unknown):void{
  if(input===undefined||input===null)return;
  const s=input as Partial<Host['s']>;
  if(s.player?.skillTrees!==undefined)rules.validateProgress(s.player.skillTrees,s.player.level);
  for(const actor of s.colony?.creatures??[])if(actor.skillTrees!==undefined)rules.validateProgress(actor.skillTrees,actor.creature.level);
 }
 function mutate(engine:Host,targetId:string,work:(input:unknown,level:number)=>LWSkillTrees.Progress[]):LWRuntime.Result{
  try{const value=owner(engine,targetId),next=work(value.holder.skillTrees,value.level);value.holder.skillTrees=next;return {ok:true};}
  catch(error){return {ok:false,reason:error instanceof Error?error.message:String(error)};}
 }
 function bonus(engine:Host,effect:LWSkillTrees.Effect):number{
  return Math.min(1,rules.bonus(state(engine).player.skillTrees,effect)+rules.bonus(engine.actor?.skillTrees,effect));
 }
 function install(input:Function):void{
  const Engine=input as Constructor,p=Engine.prototype;
  p.attachSkillTree=function(targetId,definition){return mutate(this,targetId,input=>rules.attach(input,definition));};
  p.unlockSkillTreeNode=function(targetId,treeId,nodeId){return mutate(this,targetId,(input,level)=>rules.unlock(input,treeId,nodeId,level));};
  p.skillTreeState=function(targetId){const value=owner(this,targetId);return rules.inspect(value.holder.skillTrees,value.level);};
  p.grantSkillTreeXp=function(targetId,amount){return mutate(this,targetId,input=>rules.award(input,amount));};
  const settle=p.settleEconomy;
  p.settleEconomy=function(spec,label){
   // Prepare before settlement, publish only if its economic authority accepted the reward.
   const player=state(this).player,actor=this._actor??this.actor;
   const playerNext=player.skillTrees&&typeof spec.playerXp==='number'&&Number.isSafeInteger(spec.playerXp)&&spec.playerXp>0&&spec.playerXp<=1_000_000_000?rules.award(player.skillTrees,spec.playerXp):undefined;
   const actorNext=actor?.skillTrees&&typeof spec.actorXp==='number'&&Number.isSafeInteger(spec.actorXp)&&spec.actorXp>0&&spec.actorXp<=1_000_000_000?rules.award(actor.skillTrees,spec.actorXp):undefined;
   const result=settle.call(this,spec,label);
   if(result.ok){if(playerNext)player.skillTrees=playerNext;if(actorNext&&actor)actor.skillTrees=actorNext;}
   return result;
  };
  const work=p.workRate,learn=p.learningRate;
  p.workRate=function(task){const base=work.call(this,task);return task.kind==='train'?base:base*(1+bonus(this,'workSpeed'));};
  p.learningRate=function(style){return learn.call(this,style)*(1+bonus(this,'learningSpeed'));};
  const purchase=p.purchaseCreature;
  p.purchaseCreature=function(personality,archetype){
   const trees=state(this).colony?.creatures[0]?.skillTrees;
   const template=trees?.find(p=>p.definition.id==='littlewild-growth')?.definition;
   const next=template?rules.attach([],template):undefined;
   const result=purchase.call(this,personality,archetype);
   if(result.ok&&next){const actor=state(this).colony?.creatures.at(-1);if(actor)actor.skillTrees=next;}
   return result;
  };
  const importer=Engine.import;
  Engine.import=function(input){
   const envelope=root.LWContent.parse(input,2*1024*1024) as {state?:unknown};validateState(envelope.state);
   return importer.call(this,envelope);
  };
 }
 const api=Object.freeze({validateState,install});root.LWSkillTreeIntegration=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
