/// <reference path="./interaction-contracts.d.ts" />
/* One paired interaction authority: eligibility, consent, costs, effects and bounded sparring. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {
  LWInteractionSpace:{distance(locations:unknown,a:LWInteraction.Creature,b:LWInteraction.Creature):number};
  LWInteractions:LWInteraction.Catalog;
  LWInteractionState:{empty(time:number):LWInteraction.State;target(input:unknown):LWInteraction.Target};
  LWWorldContent:{node(id:string):{id:string;resource:string;mode:string;seconds:number;skill:string|null;direct:boolean}|undefined};
  LWWorldTasks:{gather(node:{id:string;x:number;y:number;stock:number},rule:{id:string;resource:string;mode:string;seconds:number},names:{item:string},orderId:string|null):unknown};
  LW:{colony:{item(id:string):{name:string}|undefined}};
  LWInteractionDuelRules:{winner(profile:LWInteraction.DuelProfile,a:LWInteraction.Roll,b:LWInteraction.Roll,source:string,target:string):string|null};
  LWInteractionTriggers?:{step(engine:LWInteraction.Engine):void};
  LWGameSettings?:{allowed(engine:LWInteraction.Engine,key:'duels'|'quests'):boolean};
  LWInteractionRuntime?:LWInteraction.Runtime;
 };
 const C=root.LWInteractions,S=root.LWInteractionState;
 const fail=(reason:string):LWInteraction.Result=>({ok:false,reason});
 const clamp=(n:number):number=>Math.max(0,Math.min(100,n));
 const creature=(e:LWInteraction.Engine,id:string):LWInteraction.Creature|undefined=>e.creatures.find(c=>c.id===id);
 const resting=(c:LWInteraction.Creature):boolean=>!c.task||['idle','explore'].includes(c.task.kind);
 function state(e:LWInteraction.Engine):LWInteraction.State{return e.s.creatureInteractions??S.empty(e.s.simTime);}
 function owned(e:LWInteraction.Engine):LWInteraction.State{if(!e.s.creatureInteractions)e.s.creatureInteractions=S.empty(e.s.simTime);return e.s.creatureInteractions;}
 function busy(e:LWInteraction.Engine,id:string):boolean{return state(e).active.some(r=>r.sourceId===id||(r.target.scope==='creature'&&r.target.id===id));}
 function position(e:LWInteraction.Engine,t:LWInteraction.Target):{x:number;y:number;kind?:string}|undefined{
  return t.scope==='creature'?creature(e,t.id)?.creature:t.scope==='building'?e.s.buildings.find(b=>b.id===t.id):e.s.nodes.find(n=>n.id===t.id);
 }
 const distance=(e:LWInteraction.Engine,a:LWInteraction.Creature,b:LWInteraction.Creature):number=>root.LWInteractionSpace.distance(e.s.interiors?.locations,a,b);
 function eligibility(e:LWInteraction.Engine,d:LWInteraction.Definition,sourceId:string,t:LWInteraction.Target,ownId:string|null=null,consent=false):string|null{
  if(d.executor==='duel'&&root.LWGameSettings&&!root.LWGameSettings.allowed(e,'duels'))return 'Duels are disabled in Settings.';
  if(!d.sources.includes(sourceId==='player'?'player':'creature')||!d.targets.includes(t.scope))return 'This interaction does not support these participants.';
  const source=sourceId==='player'?null:creature(e,sourceId),target=t.scope==='creature'?creature(e,t.id):null,p=position(e,t);
  if((sourceId!=='player'&&!source)||!p||(t.scope==='creature'&&!target))return 'Choose known participants in this world.';
  if(sourceId===t.id)return 'Choose another creature.';
  if(d.targetKinds.length&&!d.targetKinds.includes(p.kind??''))return 'This world object does not support that interaction.';
  for(const c of [source,target])if(c){
   if(c.activeQuest)return c.name+' is away.';
   if(state(e).active.some(r=>r.id!==ownId&&(r.sourceId===c.id||r.target.id===c.id)))return c.name+' already has a pending or active interaction.';
   if(d.executor!=='care'&&(c===source||consent)&&(c.needs.energy<d.minimumEnergy||c.feelings.anger>d.maximumAnger||c.needs.food<15||c.needs.water<15))return c.name+' needs care or a little rest first.';
   if(d.requireIdle&&!resting(c))return c.name+' is busy with another task.';
  }
  if(source&&target&&!Number.isFinite(distance(e,source,target)))return 'Meet on the same floor and finish indoor travel first.';
  if(source&&(target?distance(e,source,target):Math.hypot(source.creature.x-p.x,source.creature.y-p.y))>d.range)return 'Move within '+d.range+' tiles first.';
  if((state(e).cooldowns[sourceId+':'+d.id]??0)>e.s.simTime)return 'Let the last moment settle before trying again.';
  if(d.executor==='duel'&&(state(e).cooldowns[t.id+':'+d.id]??0)>e.s.simTime)return 'Let this friend’s last duel settle before trying again.';
  if(source){
   if(source.needs.energy<d.minimumEnergy+d.cost.energy)return source.name+' needs more energy.';
   for(const [id,n]of Object.entries(d.cost.items))if((source.inventory[id]??0)<n)return source.name+' needs '+n+' '+id+' in their satchel.';
  }
  if(d.executor==='care'&&target)return e.commandActor(target.id,()=>e.careIssue(d.action!)) as string|null;
  if(d.executor==='world-task'){
   const node=e.s.nodes.find(n=>n.id===t.id)!,rule=root.LWWorldContent.node(node.kind);
   if(!rule?.direct||!e.nodeAvailable(node)||e.s.buildings.some(b=>b.x===node.x&&b.y===node.y))return 'This node cannot be gathered directly.';
   const issue=e.gateIssue('items',rule.resource);if(issue)return issue;
   if(rule.skill&&!source?.skills[rule.skill])return 'Learn '+rule.skill+' before gathering here.';
   const physical=e.withActor(source!,()=>e.reachable(node)&&e.room(rule.resource)>0);
   if(!physical)return 'This node needs a reachable approach and room in the satchel.';
  }
  return null;
 }
 function options(e:LWInteraction.Engine,sourceId:string,input:unknown):LWInteraction.Option[]{
  let t:LWInteraction.Target;try{t=S.target(C.copy(input));}catch{return [];}
  const out=state(e).library.definitions.filter(d=>d.sources.includes(sourceId==='player'?'player':'creature')&&d.targets.includes(t.scope)).map(d=>{
   const reason=eligibility(e,d,sourceId,t);return {id:d.id,label:d.label,description:d.description,available:reason===null,reason};
  });
  const target=t.scope==='creature'?creature(e,t.id):null;
  if(sourceId==='player'&&target)for(const d of e.interactions(target)){
   const reason=busy(e,target.id)?target.name+' already has a pending or active interaction.':e.commandActor(target.id,()=>e.interactionReason(target,d.instance)) as string|null;
   out.push({id:'growth:'+d.instance,label:d.label,description:d.description??'An authored creature-care moment.',available:reason===null,reason});
  }
  return C.copy(out);
 }
 function effect(c:LWInteraction.Creature|null|undefined,values:LWInteraction.Effects):void{
  if(!c)return;
  c.needs.joy=clamp(c.needs.joy+values.joy);c.needs.energy=clamp(c.needs.energy+values.energy);
  c.feelings.social=clamp(c.feelings.social+values.social);c.feelings.anger=clamp(c.feelings.anger+values.anger);c.bond=clamp(c.bond+values.bond);
 }
 function charge(e:LWInteraction.Engine,d:LWInteraction.Definition,sourceId:string):void{
  const c=creature(e,sourceId);if(!c)return;c.needs.energy-=d.cost.energy;
  for(const [id,n]of Object.entries(d.cost.items))c.inventory[id]=(c.inventory[id]??0)-n;
 }
 function apply(e:LWInteraction.Engine,d:LWInteraction.Definition,r:LWInteraction.Record):void{
  effect(creature(e,r.sourceId),d.effects.source);if(r.target.scope==='creature')effect(creature(e,r.target.id),d.effects.target);
 }
 function finish(e:LWInteraction.Engine,r:LWInteraction.Record,status:LWInteraction.Status,reason:string|null):void{
  const s=owned(e);r.status=status;r.reason=reason;s.active=s.active.filter(v=>v.id!==r.id);s.history.unshift(r);s.history=s.history.slice(0,60);
  e.withActor(creature(e,r.sourceId)??creature(e,r.target.id)??e.actor,()=>e.log((creature(e,r.sourceId)?.name??'Guide')+' · '+s.library.definitions.find(d=>d.id===r.definitionId)!.label+' · '+(reason??status),'heart'));
  e.emit('interaction',reason??status,{interactionId:r.id,actorId:r.sourceId==='player'?r.target.id:r.sourceId,target:r.target});
 }
 function cooldown(e:LWInteraction.Engine,d:LWInteraction.Definition,r:LWInteraction.Record):void{
  const s=owned(e);s.cooldowns[r.sourceId+':'+d.id]=e.s.simTime+d.cooldown;
  if(d.executor==='duel')s.cooldowns[r.target.id+':'+d.id]=e.s.simTime+d.cooldown;
 }
 function request(e:LWInteraction.Engine,definitionId:unknown,sourceId:unknown,input:unknown):LWInteraction.Result{
  if(typeof definitionId!=='string'||typeof sourceId!=='string')return fail('Choose a known interaction and initiator.');
  let t:LWInteraction.Target;try{t=S.target(C.copy(input));}catch{return fail('Choose a valid target.');}
  // Growth definitions retain event instances, inventory effects and expiry in their existing authority.
  if(definitionId.startsWith('growth:')){
   if(sourceId!=='player'||t.scope!=='creature')return fail('Growth care needs the guide and a creature.');
   const c=creature(e,t.id),id=definitionId.slice(7);if(!c)return fail('Unknown creature.');
   if(busy(e,c.id))return fail(c.name+' already has a pending or active interaction.');
   const issue=e.commandActor(c.id,()=>e.interactionReason(c,id)) as string|null;if(issue)return fail(issue);
   return e.commandActor(c.id,()=>e.interact(c.id,id)) as LWInteraction.Result;
  }
  const d=state(e).library.definitions.find(d=>d.id===definitionId);if(!d)return fail('Unknown interaction definition.');
  const issue=eligibility(e,d,sourceId,t);if(issue)return fail(issue);
  if(state(e).active.length>=16||state(e).sequence>=1e9)return fail('The interaction limit is reached.');
  if(d.executor==='care'){
   const c=creature(e,t.id)!;const result=e.commandActor(c.id,()=>e.care(d.action!)) as LWInteraction.Result;
   if(!result.ok)return result;
  }
  if(d.executor==='social'){
   const result=e.commandActor(sourceId,()=>e.suggestSocial(t.id)) as LWInteraction.Result;if(!result.ok)return result;
  }
  if(d.executor==='world-task'){
   const c=creature(e,sourceId)!,node=e.s.nodes.find(n=>n.id===t.id)!,rule=root.LWWorldContent.node(node.kind)!;
   const task=root.LWWorldTasks.gather(node,rule,{item:root.LW.colony.item(rule.resource)!.name},null);
   const accepted=e.withActor(c,()=>{
    // Only leisure may yield. Existing task authority validates path and owns physical settlement.
    return e.startTask(task);
   });
   if(!accepted)return fail('The creature could not begin gathering at this node.');
  }
  const s=owned(e),now=e.s.simTime;
  const r:LWInteraction.Record={id:'interaction-'+s.sequence++,definitionId:d.id,sourceId,target:t,status:d.executor==='duel'?'requested':'completed',created:now,
   respondAt:now+(d.duel?.responseSeconds??0),expires:now+30+(d.duel?d.duel.roundSeconds*d.duel.maxRounds:0),nextRoundAt:0,round:0,scores:[0,0],winnerId:null,reason:null,rounds:[]};
  if(d.executor==='duel'){
   s.active.push(r);e.withActor(creature(e,sourceId)!,()=>e.log(creature(e,sourceId)!.name+' asked '+creature(e,t.id)!.name+' for '+d.label+'.','heart'));
  }else{charge(e,d,sourceId);apply(e,d,r);cooldown(e,d,r);finish(e,r,d.executor==='social'||d.executor==='world-task'?'delegated':'completed',d.executor==='world-task'?'The creature will walk over and gather into their satchel.':d.executor==='social'?'The companions will make time for each other.':'A shared moment.');}
  return {ok:true,interactionId:r.id,...(d.executor==='world-task'||d.executor==='social'?{taskStarted:true}:{})};
 }
 function respond(e:LWInteraction.Engine,id:unknown,actorId:string,accept:unknown):LWInteraction.Result{
  const r=state(e).active.find(r=>r.id===id);if(!r||r.status!=='requested'||r.target.id!==actorId||typeof accept!=='boolean')return fail('This creature has no matching request to answer.');
  if(!accept){finish(e,r,'declined','The invitation was declined.');return {ok:true,interactionId:r.id};}
  const d=state(e).library.definitions.find(d=>d.id===r.definitionId)!;
  const issue=eligibility(e,d,r.sourceId,r.target,r.id,true);
  if(issue){finish(e,r,'declined',issue);return {ok:false,reason:issue};}
  if(e.s.simTime>=r.expires){finish(e,r,'expired','The invitation expired.');return fail('The invitation expired.');}
  // Only harmless leisure tasks can yield; the existing interruption authority owns cleanup.
  for(const c of [creature(e,r.sourceId)!,creature(e,r.target.id)!])if(c.task)e.interruptActor(c);
  charge(e,d,r.sourceId);cooldown(e,d,r);r.status='active';r.nextRoundAt=e.s.simTime+d.duel!.roundSeconds;
  e.withActor(creature(e,r.target.id)!,()=>e.log(creature(e,r.target.id)!.name+' accepted. A friendly duel begins.','heart'));return {ok:true,interactionId:r.id};
 }
 function cancel(e:LWInteraction.Engine,id:unknown):LWInteraction.Result{
  const r=state(e).active.find(r=>r.id===id);if(!r)return fail('This interaction has already ended.');
  finish(e,r,'cancelled','The guide ended the interaction.');return {ok:true,interactionId:r.id};
 }
 function roll(e:LWInteraction.Engine,c:LWInteraction.Creature,skill:string,modifier:number,label:string):LWInteraction.Roll{
  const r=e.withActor(c,()=>e.check(skill,modifier,label));
  return {target:r.target,dice:[...r.dice],total:r.total,margin:r.margin,success:r.success,critical:r.critical,outcome:r.outcome};
 }
 function step(e:LWInteraction.Engine):void{
  if(!e.s.started||e.s.paused)return;
  if(root.LWGameSettings&&!root.LWGameSettings.allowed(e,'duels')){
   const existing=e.s.creatureInteractions;
   if(existing){for(const r of [...existing.active])finish(e,r,'cancelled','Duels were disabled in Settings.');existing.seeks=[];}
   return;
  }
  const s=owned(e),now=e.s.simTime;
  for(const r of [...s.active]){
   const d=s.library.definitions.find(d=>d.id===r.definitionId)!,a=creature(e,r.sourceId),b=creature(e,r.target.id);
   if(!a||!b||a.activeQuest||b.activeQuest){finish(e,r,'cancelled','A participant is unavailable.');continue;}
   if(r.status==='requested'){
    if(now>=r.expires){finish(e,r,'expired','The invitation expired.');continue;}
    if(now>=r.respondAt){
     const issue=eligibility(e,d,r.sourceId,r.target,r.id,true);
     // Consent is a needs/temper policy, not an involuntary dice check or player-selection gate.
     if(issue)finish(e,r,'declined',issue);else respond(e,r.id,b.id,true);
    }
    continue;
   }
   if(a.needs.food<15||a.needs.water<15||b.needs.food<15||b.needs.water<15||a.needs.energy<15||b.needs.energy<15||Math.hypot(a.creature.x-b.creature.x,a.creature.y-b.creature.y)>d.range){finish(e,r,'cancelled','The companions need care or are too far apart.');continue;}
   if(now<r.nextRoundAt)continue;
   if(a.needs.energy<15+d.duel!.sourceEnergyPerRound||b.needs.energy<15+d.duel!.targetEnergyPerRound){finish(e,r,'cancelled','The companions need a rest before another round.');continue;}
   a.needs.energy-=d.duel!.sourceEnergyPerRound;b.needs.energy-=d.duel!.targetEnergyPerRound;
   const sourceRoll=roll(e,a,d.duel!.skill,d.duel!.sourceModifier,d.label),targetRoll=roll(e,b,d.duel!.skill,d.duel!.targetModifier,d.label);
   const winnerId=root.LWInteractionDuelRules.winner(d.duel!,sourceRoll,targetRoll,a.id,b.id);
   r.round++;if(winnerId===a.id)r.scores[0]++;else if(winnerId===b.id)r.scores[1]++;
   r.rounds.push({number:r.round,time:now,sourceRoll,targetRoll,winnerId});r.nextRoundAt=now+d.duel!.roundSeconds;
   if(r.scores.some(n=>n>=d.duel!.pointsToWin)||r.round>=d.duel!.maxRounds){
    r.winnerId=r.scores[0]===r.scores[1]?null:r.scores[0]>r.scores[1]?a.id:b.id;
    apply(e,d,r);finish(e,r,'completed',r.winnerId?creature(e,r.winnerId)!.name+' won the friendly duel.':'The friendly duel ended in a draw.');
   }
  }
  for(const [key,until]of Object.entries(s.cooldowns))if(until<=now)delete s.cooldowns[key];
  // Rule-specific clocks and encouragement intents own challenge generation.
 }
 function setLibrary(e:LWInteraction.Engine,input:unknown):LWInteraction.Result{
  let library:LWInteraction.Library;try{library=C.validate(input);}catch(error){return fail(error instanceof Error?error.message:String(error));}
  const current=state(e),fingerprint=C.fingerprint(library);
  if(fingerprint===current.fingerprint&&JSON.stringify(library)===JSON.stringify(C.validate(current.library)))return {ok:true};
  if(current.active.length)return fail('Finish or cancel active interactions before replacing definitions.');
  const s=owned(e);s.library=library;s.fingerprint=fingerprint;s.history=[];s.cooldowns={};
  s.triggerAt=Object.fromEntries(library.triggers.map(rule=>[rule.id,e.s.simTime+rule.intervalSeconds]));s.seeks=[];
  return {ok:true};
 }
 const api:LWInteraction.Runtime=Object.freeze({state,options,request,respond,cancel,step,busy,setLibrary,distance,eligible:eligibility});
 root.LWInteractionRuntime=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
