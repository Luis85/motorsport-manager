/// <reference path="./balancing-contracts.d.ts" />
/// <reference path="./engine-core-contracts.d.ts" />
/* Paid work completion and recovery effects use the captured profile of their owning engine. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as LWCorePorts.Root & {LW:LWCorePorts.Facade;LWSkillCompletions?:{finish(engine:LWCorePorts.SystemsEngine,t:LWCorePorts.Task,finishBase:(task:LWCorePorts.Task)=>void):void}};
 const B=(typeof module!=='undefined'&&module.exports?require('./balancing-rules.js'):(globalThis as unknown as {LWBalanceRules:LWBalanceRules.Api}).LWBalanceRules) as LWBalanceRules.Api;
 const {clamp}=root.LW;
 const {BUILDINGS,RES,RECIPES,DRILLS,SKILLS,STYLES}=root.LWContent.tables;
 const clone=<T>(value:T):T=>root.LWContent.copy(value);
 const CROP_RES:Record<string,string>={garden:'berries',grainplot:'grain',greenhouse:'herbs',orchard:'berries'};
 function finish(engine:LWCorePorts.SystemsEngine,t:LWCorePorts.Task,finishBase:(task:LWCorePorts.Task)=>void):void{
const s=engine.s,o=s.orders.find(o=>o.id===t.orderId),sk=engine.taskSkill(t);
  if(t.kind==='build'&&o){
   if(!o.paid){s.task=null;return;}
   const phases=engine.constructionPhases(o);engine.practiceSkill(sk,1+(o.approach==='careful'?1:0));s.metrics.stages++;engine.record('stage');s.memory.lastAchievement=s.simTime;
   if((o.stage||0)<phases.length-1){o.stage!++;o.progress=0;o.paid=false;engine.log(BUILDINGS[o.kind!]!.name+': '+phases[o.stage!-1]!.name.toLowerCase()+' complete. Next: '+phases[o.stage!]!.name.toLowerCase()+'.','plan');s.task=null;return;}
   const quality=engine.buildQuality(o);
   if(o.type==='upgrade'){
    const b=s.buildings.find(b=>b.kind===o.kind&&b.x===o.x&&b.y===o.y)!;b.level=o.targetLevel!;b!.quality=Math.max(b!.quality,quality);s.metrics.upgrades++;engine.record('upgrade');
    engine.remember('upgrade-'+b.kind+'-'+b.level,'Our '+BUILDINGS[b!.kind!]!.name.toLowerCase()+' grew',engine.upgradeEffect(b,b.level),'home');
   }else{
    const b={id:'b'+s.nextId++,kind:o.kind!,x:o.x!,y:o.y!,stock:CROP_RES[o.kind!]?B.forEngine(engine).production.cropInitialStock:0,regen:0,level:1,quality};s.buildings.push(b);s.stats.built++;engine.record('build:'+o.kind);engine.remember('build-'+o.kind,'Our '+BUILDINGS[o.kind!]!.name.toLowerCase(),'A '+engine.qualityName(quality).toLowerCase()+' place, made together.',BUILDINGS[o.kind!]!.icon);
   }
   s.orders=s.orders.filter(x=>x.id!==o.id);engine._blockedKey='';engine.xp('creature',B.forEngine(engine).completion.buildActorXp);engine.xp('player',B.forEngine(engine).completion.buildPlayerXp);engine.researchGain(B.forEngine(engine).completion.buildResearch);s.bond=clamp(s.bond+B.forEngine(engine).completion.buildBond,0,100);s.needs.joy=clamp(s.needs.joy+B.forEngine(engine).completion.buildJoy,0,100);
   engine.log(engine.orderName(o)+' completed. '+engine.qualityName(quality)+' · '+quality+' quality.','home');engine.emit('celebrate',engine.orderName(o)+' completed!');s.task=null;return;
  }
  if(t.kind==='practice'&&o){
   if(s.learning.practiceDay!==s.day){s.learning.practiceDay=s.day;s.learning.practicedToday={};}
   const d=DRILLS[o.skillId!]!;if(Object.entries(d.cost).every(([r,n])=>s.inventory[r!]!>=n)){
    for(const[r,n]of Object.entries(d.cost))s.inventory[r!]!-=n;
    const repeated=s.learning.practicedToday[o.skillId!]||0,points=(repeated<B.forEngine(engine).work.practiceFreshCount?B.forEngine(engine).work.freshPracticePoints:B.forEngine(engine).work.repeatedPracticePoints)+(engine.has('circle')?engine.buildingLevel('circle'):0)+(engine.specialization('mentor')?B.forEngine(engine).work.mentorPracticePoints:0);
    engine.practiceSkill(o.skillId!,points);s.learning.practicedToday[o.skillId!]=repeated+1;s.metrics.practices[o.skillId!]=(s.metrics.practices[o.skillId!]||0)+1;engine.record('practice:'+o.skillId);
    if(!repeated)engine.researchGain(B.forEngine(engine).work.firstPracticeResearch,'First '+SKILLS[o.skillId!]!.short+' drill today');engine.xp('creature',B.forEngine(engine).completion.practiceActorXp);engine.xp('player',B.forEngine(engine).completion.practicePlayerXp);s.memory.lastAchievement=s.simTime;
    o.done!++;o.progress=0;if(o.done!>=o.amount!)s.orders=s.orders.filter(x=>x.id!==o.id);engine.log('A '+SKILLS[o.skillId!]!.short.toLowerCase()+' drill: +'+points+' practice. '+(repeated<B.forEngine(engine).work.practiceFreshCount?'A fresh attempt.':'Repeating helps, but variety teaches more.'),'book');
   }else o.progress=0;s.task=null;return;
  }
  if(t.kind==='reflect'){s.learning.fatigue=Math.max(0,s.learning.fatigue-B.forEngine(engine).recovery.reflectFatigue);s.learning.recovering=s.learning.fatigue>B.forEngine(engine).work.fatigueResumeGate;s.needs.joy=clamp(s.needs.joy+B.forEngine(engine).recovery.reflectJoy,0,100);s.task=null;return;}
  if(t.kind==='eatbread'){if(s.inventory.bread!>0){s.inventory.bread!--;s.needs.food=clamp(s.needs.food+B.forEngine(engine).recovery.breadFood,0,100);s.needs.joy=clamp(s.needs.joy+B.forEngine(engine).recovery.breadJoy,0,100);}s.task=null;return;}
  if(t.kind==='usebalm'){if(s.inventory.balm!>0){s.inventory.balm!--;s.needs.comfort=clamp(s.needs.comfort+B.forEngine(engine).recovery.balmComfort,0,100);s.needs.joy=clamp(s.needs.joy+B.forEngine(engine).recovery.balmJoy,0,100);}s.task=null;return;}
  if(t.kind==='gather'&&t.nodeId?.startsWith('crop:')){
   const b=s.buildings.find(b=>'crop:'+b.id===t.nodeId);let amount=Math.min(b?.stock||0,B.forEngine(engine).production.cropGatherAmount+(b?.level||1)-1+(engine.specialization('gatherer')?B.forEngine(engine).production.gathererBonus:0));if(o?.type==='gather'&&o.resource===t.resource)amount=Math.min(amount,o.amount!-o.done!);
   if(amount>0){b!.stock-=amount;s.inventory[t.resource!]!+=amount;s.stats.gathered+=amount;engine.xp('creature',B.forEngine(engine).completion.cropActorXp);engine.xp('player',B.forEngine(engine).completion.cropPlayerXp);engine.practiceSkill('gardening');if(o?.type==='gather'&&o.resource===t.resource){o.done!+=amount;if(o.done!>=o.amount!)s.orders=s.orders.filter(x=>x.id!==o.id);}s.metrics.gathered[t.resource!]=(s.metrics.gathered[t.resource!]||0)+amount;engine.record('gather:'+t.resource,amount);engine.log('Harvested '+amount+' '+RES[t.resource!]!.name.toLowerCase()+' from our '+BUILDINGS[b!.kind!]!.name.toLowerCase()+'.','sprout');s.memory.lastAchievement=s.simTime;}s.task=null;return;
  }
  const beforeInv={...s.inventory},beforeCraft=s.stats.planksMade,beforeLevel=s.training?clone(s.training):null;
  const naturalNode=t.kind==='gather'?s.nodes.find(n=>n.id===t.nodeId):null;
  const hasCraftSupplies=t.kind==='craft'&&Object.entries(RECIPES[t.resource!]!.cost).every(([r,n])=>s.inventory[r!]!>=n);
  finishBase(t);
  if(t.kind==='train'&&beforeLevel&&s.skills[beforeLevel.id]){
   const style=STYLES[beforeLevel.style||'together'!]!;engine.practiceSkill(beforeLevel.id,style.practice);s.bond=clamp(s.bond+style.bond-B.forEngine(engine).completion.trainBond,0,100);s.needs.joy=clamp(s.needs.joy+style.joy-B.forEngine(engine).completion.trainJoy,0,100);s.metrics.lessons++;engine.record('lesson');
   s.training=s.learning.queue.shift()||null;
  }
  if(t.kind==='craft'&&hasCraftSupplies){let amount=RECIPES[t.resource!]!.amount;if(['meals','bread'].includes(t.resource!)&&engine.specialization('cook')){s.inventory[t.resource!]!++;amount++;}s.metrics.crafts[t.resource!]=(s.metrics.crafts[t.resource!]||0)+amount;engine.record('craft:'+t.resource,amount);}
  if(t.kind==='gather'){
   let amount=s.inventory[t.resource!]!-beforeInv[t.resource!]!;
   if(amount>0&&engine.specialization('gatherer')&&naturalNode?.stock!>0&&(!o||o.type!=='gather'||o.done!<o.amount!)){s.inventory[t.resource!]!++;naturalNode!.stock--;amount++;s.stats.gathered++;if(o?.type==='gather'&&o.resource===t.resource){o.done!++;if(o.done!>=o.amount!)s.orders=s.orders.filter(x=>x.id!==o.id);}}
   if(t.resource==='water'&&t.nodeId==='well'&&engine.buildingLevel('well')>1){let extra=engine.buildingLevel('well')-1;if(o?.type==='gather')extra=Math.max(0,Math.min(extra,o.amount!-o.done!));s.inventory.water!+=extra;amount+=extra;s.stats.gathered+=extra;if(o?.type==='gather'){o.done!+=extra;if(o.done!>=o.amount!)s.orders=s.orders.filter(x=>x.id!==o.id);}}
   s.metrics.gathered[t.resource!]=(s.metrics.gathered[t.resource!]||0)+amount;if(amount>0)engine.record('gather:'+t.resource,amount);
  }
  if(t.kind==='research'){const extra=(engine.has('observatory')?B.forEngine(engine).work.observatoryResearch:0)+Math.max(0,engine.buildingLevel('study')-1)+Math.max(0,engine.buildingLevel('observatory')-1)+(engine.specialization('thinker')?B.forEngine(engine).work.thinkerResearch:0);if(extra)engine.researchGain(extra,'Improved research places');engine.record('research');}
  if(t.kind==='explore'&&engine.specialization('explorer'))engine.researchGain(B.forEngine(engine).work.explorerResearch,'Field observer');
  if(t.kind==='deliver'&&o?.done)engine.record('deliver');
  if(t.kind==='rest'||t.kind==='warm'){
   const level=t.kind==='rest'?(engine.has('cottage')?engine.buildingLevel('cottage'):engine.buildingLevel('shelter')):engine.buildingLevel('fire');const extra=Math.max(0,level-1)*B.forEngine(engine).recovery.homePerLevel;
   s.needs.comfort=clamp(s.needs.comfort+extra+(engine.specialization('comfort')?B.forEngine(engine).recovery.comfortSpecialist:0),0,100);if(t.kind==='rest')s.needs.energy=clamp(s.needs.energy+extra,0,100);
  }
  if(t.kind==='play'&&engine.has('orchard'))s.needs.joy=clamp(s.needs.joy+B.forEngine(engine).recovery.reflectJoy,0,100);
 
 }
 const api=Object.freeze({finish});root.LWSkillCompletions=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
