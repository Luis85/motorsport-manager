/// <reference path="./interaction-contracts.d.ts" />
/* Checkpoint integrity for the paired interaction lifecycle; no repair of recorded state. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWInteractionSpace:{distance(locations:unknown,a:{id:string;creature:LWRuntime.Point},b:{id:string;creature:LWRuntime.Point}):number};LWInteractions:LWInteraction.Catalog;LWInteractionState?:unknown};
 const C=root.LWInteractions;
 function empty(time:number):LWInteraction.State{
  const library=C.defaults;
  return {version:1,library,fingerprint:C.fingerprint(library),sequence:1,active:[],history:[],cooldowns:{},
   triggerAt:Object.fromEntries(library.triggers.map(rule=>[rule.id,time+rule.intervalSeconds])),seeks:[]};
 }
 function fail(message:string):never{throw Error('Creature interactions: '+message+'.');}
 const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
 const finite=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 const whole=(v:unknown,min:number,max:number):v is number=>finite(v,min,max)&&Number.isSafeInteger(v);
 function exact(value:unknown,keys:string[],label:string):asserts value is Record<string,unknown>{
  if(!plain(value)||Object.keys(value).length!==keys.length||Object.keys(value).some(key=>!keys.includes(key)))fail('invalid '+label);
 }
 function target(value:unknown):LWInteraction.Target{
  exact(value,['scope','id'],'target');
  if(!['creature','building','node'].includes(String(value.scope))||typeof value.id!=='string'||value.id.length>96||!/^[a-zA-Z0-9_:.-]+$/.test(value.id))fail('invalid target identity');
  return value as unknown as LWInteraction.Target;
 }
 function validate(input:unknown,world:unknown):LWInteraction.State|undefined{
  if(input===undefined)return undefined;
  const data=C.copy(input),keys=['version','library','fingerprint','sequence','active','history','cooldowns','triggerAt','seeks'];
  if(plain(data)&&Object.hasOwn(data,'rng'))keys.push('rng');exact(data,keys,'state');
  if(Object.hasOwn(data,'rng')&&!whole(data.rng,0,4294967295))fail('invalid decision RNG seed');
  if(!plain(world)||!finite(world.simTime,0,1e12)||!plain(world.colony)||!Array.isArray(world.colony.creatures))fail('invalid world context');
  const locations=plain(world.interiors)?world.interiors.locations:undefined;
  const time=world.simTime,creatures=world.colony.creatures as {id:string;creature:LWRuntime.Point;task:unknown;activeQuest?:unknown}[];
  const known=(id:unknown):id is string=>typeof id==='string'&&creatures.some(c=>c.id===id);
  if(data.version!==1||!whole(data.sequence,1,1e9))fail('invalid sequence or version');
  const library=C.validate(data.library);
  if(data.fingerprint!==C.fingerprint(library))fail('library fingerprint mismatch');
  if(!Array.isArray(data.active)||data.active.length>16||!Array.isArray(data.history)||data.history.length>60||!plain(data.cooldowns)||Object.keys(data.cooldowns).length>(creatures.length+1)*library.definitions.length)fail('invalid bounded collections');
  if(!plain(data.triggerAt)||Object.keys(data.triggerAt).length!==library.triggers.length)fail('invalid rule clocks');
  for(const [id,until]of Object.entries(data.triggerAt)){
   const rule=library.triggers.find(r=>r.id===id);if(!rule||!finite(until,0,time+rule.intervalSeconds+.001))fail('invalid rule clock');
  }
  if(!Array.isArray(data.seeks)||data.seeks.length>creatures.length)fail('invalid search intents');
  if(plain(world.settings)&&world.settings.duels===false&&(data.active.length||data.seeks.length))fail('disabled duels have active invitations or searches');
  const seekers=new Set<string>();
  for(const intent of data.seeks){
   exact(intent,['actorId','definitionId','ruleId','created','expires','nextSearchAt'],'search intent');
   if(!known(intent.actorId)||seekers.has(intent.actorId)||!library.definitions.some(d=>d.id===intent.definitionId&&d.executor==='duel')||
    (intent.ruleId!==null&&!library.triggers.some(r=>r.id===intent.ruleId&&r.definitionId===intent.definitionId))||
    !finite(intent.created,0,time+.001)||intent.expires!==intent.created+300||!finite(intent.nextSearchAt,intent.created,time+1.001))fail('invalid search intent');
   seekers.add(intent.actorId);
  }
  for(const [key,value]of Object.entries(data.cooldowns)){
   const split=key.indexOf(':'),actor=key.slice(0,split),id=key.slice(split+1),d=library.definitions.find(d=>d.id===id);
   if(split<1||!d||(actor!=='player'&&!known(actor))||!finite(value,0,time+d.cooldown+.001))fail('invalid cooldown');
  }
  const ids=new Set<string>(),locks=new Set<string>();let largest=0;
  function record(value:unknown,active:boolean):LWInteraction.Record{
   exact(value,['id','definitionId','sourceId','target','status','created','respondAt','expires','nextRoundAt','round','scores','winnerId','reason','rounds'],'lifecycle record');
   const d=library.definitions.find(d=>d.id===value.definitionId),t=target(value.target);
   if(typeof value.id!=='string'||!/^interaction-[1-9]\d*$/.test(value.id)||ids.has(value.id)||!d||(value.sourceId!=='player'&&!known(value.sourceId)))fail('invalid lifecycle identity');
   const sequence=Number(value.id.slice(12));if(!whole(sequence,1,1e9))fail('invalid lifecycle sequence');
   ids.add(value.id);largest=Math.max(largest,sequence);
   if(!d.targets.includes(t.scope)||!d.sources.includes(value.sourceId==='player'?'player':'creature')||value.sourceId===t.id)fail('invalid participants');
   if(t.scope==='creature'&&!known(t.id))fail('unknown target creature');
   if(active){
    if(!['requested','active'].includes(String(value.status))||d.executor!=='duel'||!d.duel)fail('invalid active status');
    for(const id of [value.sourceId,t.id]){
     if(typeof id!=='string'||locks.has(id))fail('overlapping pair lock');locks.add(id);
     const c=creatures.find(c=>c.id===id);if(!c||c.activeQuest||(value.status==='active'&&c.task))fail('unavailable locked creature');
    }
    if(t.scope!=='creature'||!known(value.sourceId))fail('invalid duel participants');
    if(root.LWInteractionSpace.distance(locations,creatures.find(c=>c.id===value.sourceId)!,creatures.find(c=>c.id===t.id)!)>d.range)fail('active duel participants occupy incompatible spaces');
   }else if(!['completed','delegated','declined','cancelled','expired'].includes(String(value.status)))fail('invalid history status');
   if(!finite(value.created,0,time+.001)||!finite(value.respondAt,value.created,value.created+30)||!finite(value.expires,value.created,value.created+1000)||
    !finite(value.nextRoundAt,0,time+30+.001)||!whole(value.round,0,d.duel?.maxRounds??0)||!Array.isArray(value.scores)||value.scores.length!==2||value.scores.some(n=>!whole(n,0,value.round as number))||
    !Array.isArray(value.rounds)||value.rounds.length!==value.round||(value.winnerId!==null&&value.winnerId!==value.sourceId&&value.winnerId!==t.id)||
    (value.reason!==null&&(typeof value.reason!=='string'||value.reason.length>300)))fail('invalid lifecycle progress');
   const scores:[number,number]=[0,0];let previous=value.created;
   for(let i=0;i<value.rounds.length;i++){
    if(d.duel&&scores.some(n=>n>=d.duel!.pointsToWin))fail('rounds continued after settlement');
    const r=value.rounds[i];exact(r,['number','time','sourceRoll','targetRoll','winnerId'],'round');
    if(r.number!==i+1||!finite(r.time,previous,time+.001))fail('invalid round chronology');previous=r.time;
    for(const key of ['sourceRoll','targetRoll']){
     const roll=r[key];exact(roll,['target','dice','total','margin','success','critical','outcome'],'roll');
     if(!finite(roll.target,-1000,1000)||!Number.isInteger(roll.target)||!Array.isArray(roll.dice)||roll.dice.length!==3||roll.dice.some(n=>!whole(n,1,6)))fail('invalid dice');
     const api=(inputRoot as {LWRPG:{resolve(target:number,dice:number[]):LWInteraction.Roll}}).LWRPG;
     if(JSON.stringify(api.resolve(roll.target,roll.dice as number[]))!==JSON.stringify(roll)){
      // Key order is not an integrity property.
      const resolved=api.resolve(roll.target,roll.dice as number[]);
      for(const field of ['total','margin','success','critical','outcome'] as const)if(resolved[field]!==roll[field])fail('inconsistent roll');
     }
    }
    const a=r.sourceRoll as unknown as LWInteraction.Roll,b=r.targetRoll as unknown as LWInteraction.Roll;
    const rules=(inputRoot as {LWInteractionDuelRules:{winner(profile:LWInteraction.DuelProfile,a:LWInteraction.Roll,b:LWInteraction.Roll,source:string,target:string):string|null}}).LWInteractionDuelRules;
    const winner=rules.winner(d.duel!,a,b,value.sourceId as string,t.id);
    if(r.winnerId!==winner)fail('inconsistent round winner');
    if(winner===value.sourceId)scores[0]++;else if(winner===t.id)scores[1]++;
   }
   const recordedScores=value.scores as number[];
   if(scores.some((n,i)=>n!==recordedScores[i]))fail('inconsistent scores');
   if(value.status==='requested'&&(value.round!==0||value.nextRoundAt!==0||value.winnerId!==null))fail('progress before acceptance');
   if(value.status==='active'&&(!d.duel||value.round>=d.duel.maxRounds||scores.some(n=>n>=d.duel!.pointsToWin)||value.winnerId!==null))fail('settled duel still active');
   if(['declined','expired'].includes(String(value.status))&&(value.round!==0||value.nextRoundAt!==0||value.winnerId!==null))fail('unaccepted request has played rounds');
   if(value.status==='cancelled'&&value.winnerId!==null)fail('cancelled duel has a winner');
   if(value.status==='completed'&&d.executor==='duel'){
    if(!d.duel||(!scores.some(n=>n>=d.duel!.pointsToWin)&&value.round!==d.duel.maxRounds))fail('duel completed before settlement');
    const winner=scores[0]===scores[1]?null:scores[0]>scores[1]?value.sourceId:t.id;
    if(value.winnerId!==winner)fail('inconsistent duel winner');
   }else if(d.executor!=='duel'&&((value.status!==((d.executor==='social'||d.executor==='world-task')?'delegated':'completed'))||value.round!==0||value.winnerId!==null))fail('invalid moment settlement');
   return value as unknown as LWInteraction.Record;
  }
  const active=data.active.map(value=>record(value,true)),history=data.history.map(value=>record(value,false));
  if(data.sequence<=largest)fail('sequence collision');
  return {version:1,library,fingerprint:data.fingerprint as string,sequence:data.sequence,active,history,cooldowns:data.cooldowns as {[key:string]:number},
   triggerAt:data.triggerAt as {[key:string]:number},seeks:data.seeks as unknown as LWInteraction.Seek[],...(data.rng===undefined?{}:{rng:data.rng as number})};
 }
 root.LWInteractionState=Object.freeze({empty,target,validate});
 if(typeof module!=='undefined'&&module.exports)module.exports=root.LWInteractionState;
})(globalThis);
