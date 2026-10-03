/// <reference path="./interaction-contracts.d.ts" />
/* Pure data validation. Executable capabilities are selected by a small compiled enum. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {
  LWContent:{parse(input:unknown,limit:number):unknown;fingerprint(input:unknown):string;tables:{SKILLS:Record<string,unknown>;RES:Record<string,unknown>}};
  LWInteractionLibrary?:unknown;LWInteractions?:LWInteraction.Catalog;
 };
 const node=typeof module!=='undefined'&&module.exports;
 const C=(node?require('./content-runtime.js'):root.LWContent) as typeof root.LWContent;
 const seed=node?require('./content/balancing.json').interactions as unknown:root.LWInteractionLibrary;
 const copy=<T>(value:T):T=>C.parse(value,2*1024*1024) as T;
 function object(value:unknown,keys:readonly string[],label:string):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid '+label+'.');
  const data=value as Record<string,unknown>,actual=Object.keys(data);
  if(actual.length!==keys.length||actual.some(key=>!keys.includes(key)))throw Error('Unknown or missing '+label+' fields.');
  return data;
 }
 function text(value:unknown,label:string,max=200):string{
  if(typeof value!=='string'||!value.trim()||[...value].length>max||/[\u0000-\u001f<>]/.test(value))throw Error('Invalid '+label+'.');
  return value;
 }
 function identity(value:unknown,label:string):string{
  const id=text(value,label,64);if(!/^[a-z][a-z0-9-]*$/.test(id))throw Error('Invalid '+label+'.');return id;
 }
 function number(value:unknown,min:number,max:number,label:string,whole=false):number{
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(whole&&!Number.isInteger(value)))throw Error('Invalid '+label+'.');return value;
 }
 function bool(value:unknown,label:string):boolean{if(typeof value!=='boolean')throw Error('Invalid '+label+'.');return value;}
 function list<T extends string>(value:unknown,allowed:readonly T[],label:string):T[]{
  if(!Array.isArray(value)||!value.length||value.length>allowed.length||new Set(value).size!==value.length||value.some(v=>!allowed.includes(v)))throw Error('Invalid '+label+'.');
  return [...value] as T[];
 }
 function effects(value:unknown):LWInteraction.Effects{
  const data=object(value,['joy','energy','social','anger','bond'],'interaction effects');
  return {joy:number(data.joy,-100,100,'joy'),energy:number(data.energy,-100,100,'energy'),
   social:number(data.social,-100,100,'social'),anger:number(data.anger,-100,100,'anger'),bond:number(data.bond,-100,100,'bond')};
 }
 function definition(input:unknown):LWInteraction.Definition{
  const d=object(copy(input),['id','label','description','executor','sources','targets','targetKinds','range','cooldown','minimumEnergy','maximumAnger','requireIdle','cost','effects','action','autonomous','duel'],'interaction definition');
  const executor=d.executor;
  if(executor!=='effects'&&executor!=='duel'&&executor!=='care'&&executor!=='social'&&executor!=='world-task')throw Error('Unknown interaction executor.');
  const sources=list(d.sources,['player','creature'],'interaction sources'),targets=list(d.targets,['creature','building','node'],'interaction targets');
  if(!Array.isArray(d.targetKinds)||d.targetKinds.length>64||new Set(d.targetKinds).size!==d.targetKinds.length)throw Error('Invalid target kinds.');
  const targetKinds=d.targetKinds.map(value=>text(value,'target kind',64));
  const cost=object(d.cost,['energy','items'],'interaction cost');
  if(!cost.items||typeof cost.items!=='object'||Array.isArray(cost.items)||Object.keys(cost.items).length>16)throw Error('Invalid item costs.');
  const items:Record<string,number>={};
  for(const [id,amount]of Object.entries(cost.items)){
   if(!Object.hasOwn(C.tables.RES,id))throw Error('Unknown interaction cost item '+id+'.');
   items[id]=number(amount,1,99,'item cost',true);
  }
  const effect=object(d.effects,['source','target'],'interaction effect recipients');
  let duel:LWInteraction.Definition['duel']=null;
  if(executor==='duel'){
   const rules=object(d.duel,['skill','sourceModifier','targetModifier','scoring','sourceEnergyPerRound','targetEnergyPerRound','maxRounds','pointsToWin','roundSeconds','responseSeconds'],'duel profile');
   const skill=text(rules.skill,'duel skill',64);
   if(!['DX','IQ','ST','HT','Per','Will','social'].includes(skill)&&!Object.hasOwn(C.tables.SKILLS,skill))throw Error('Unknown duel skill.');
   if(rules.scoring!=='success-margin'&&rules.scoring!=='margin')throw Error('Unknown duel scoring rule.');
   duel={skill,sourceModifier:number(rules.sourceModifier,-10,10,'source modifier',true),targetModifier:number(rules.targetModifier,-10,10,'target modifier',true),scoring:rules.scoring,
    sourceEnergyPerRound:number(rules.sourceEnergyPerRound,0,10,'source round energy'),targetEnergyPerRound:number(rules.targetEnergyPerRound,0,10,'target round energy'),
    maxRounds:number(rules.maxRounds,1,20,'maximum rounds',true),pointsToWin:number(rules.pointsToWin,1,10,'winning points',true),
    roundSeconds:number(rules.roundSeconds,.5,30,'round seconds'),responseSeconds:number(rules.responseSeconds,.1,30,'response seconds')};
   if(duel.pointsToWin>duel.maxRounds)throw Error('Winning score exceeds round limit.');
   if(sources.length!==1||sources[0]!=='creature'||targets.length!==1||targets[0]!=='creature'||!d.requireIdle)throw Error('Duels need two available creatures.');
  }else if(d.duel!==null)throw Error('Only a duel can carry a duel profile.');
  const action=d.action===null?null:text(d.action,'care action',64);
  if(executor==='care'){
   if(!['feed','water','bond','praise','soothe','space'].includes(action??'')||sources.length!==1||sources[0]!=='player'||targets.length!==1||targets[0]!=='creature')throw Error('Invalid legacy care adapter.');
  }else if(executor==='world-task'){
   if(action!=='gather'||sources.length!==1||sources[0]!=='creature'||targets.length!==1||targets[0]!=='node'||!d.requireIdle)throw Error('Invalid physical gathering adapter.');
  }else if(action!==null)throw Error('Only a compiled task or care adapter can select an action.');
  if(executor==='social'&&(sources.length!==1||sources[0]!=='creature'||targets.length!==1||targets[0]!=='creature'))throw Error('Social needs two creatures.');
  const autonomous=bool(d.autonomous,'autonomous');
  if(autonomous&&(executor!=='duel'||!sources.includes('creature')))throw Error('Autonomous definitions must be friendly duels.');
  const sourceEffects=effects(effect.source),targetEffects=effects(effect.target);
  // Legacy adapters keep their existing cost/cooldown/effect authority; prohibit a second charge.
  if(executor==='care'||executor==='social'||executor==='world-task'){
   if(cost.energy!==0||Object.keys(items).length||Object.values(sourceEffects).some(Boolean)||Object.values(targetEffects).some(Boolean)||d.cooldown!==0)throw Error('Legacy adapters cannot add costs, cooldowns or effects.');
  }
  if(sources.includes('player')&&(cost.energy!==0||Object.keys(items).length||Object.values(sourceEffects).some(Boolean)))throw Error('The guide has no creature inventory or needs.');
  if(targets.some(scope=>scope!=='creature')&&Object.values(targetEffects).some(Boolean))throw Error('World targets do not own creature feelings.');
  return {id:identity(d.id,'interaction ID'),label:text(d.label,'interaction label'),description:text(d.description,'description',1000),executor,sources,targets,targetKinds,
   range:number(d.range,0,100,'range'),cooldown:number(d.cooldown,0,86400,'cooldown'),minimumEnergy:number(d.minimumEnergy,0,100,'minimum energy'),
   maximumAnger:number(d.maximumAnger,0,100,'maximum anger'),requireIdle:bool(d.requireIdle,'requireIdle'),cost:{energy:number(cost.energy,0,50,'energy cost'),items},
   effects:{source:sourceEffects,target:targetEffects},action,autonomous,duel};
 }
 function validate(input:unknown):LWInteraction.Library{
  const data=object(copy(input),['format','schemaVersion','id','version','definitions','triggers'],'interaction library');
  if(data.format!=='littlewild-interactions'||data.schemaVersion!==1)throw Error('Unsupported interaction library.');
  if(!Array.isArray(data.definitions)||!data.definitions.length||data.definitions.length>60)throw Error('Invalid interaction definitions.');
  const definitions=data.definitions.map(definition);
  if(new Set(definitions.map(d=>d.id)).size!==definitions.length)throw Error('Duplicate interaction definition.');
  if(!Array.isArray(data.triggers)||data.triggers.length>32)throw Error('Invalid duel triggers.');
  function conditions(input:unknown):LWInteraction.Condition[]{
   if(!Array.isArray(input)||input.length>16)throw Error('Invalid trigger conditions.');
   return input.map(value=>{
    const c=object(value,['metric','operator','value'],'condition');
    const metric=c.metric as LWInteraction.Metric,operator=c.operator as LWInteraction.Condition['operator'];
    if(['energy','food','water','joy','anger','social','bond'].includes(metric)){
     if(!['gte','lte','eq'].includes(operator))throw Error('Invalid numeric condition operator.');number(c.value,0,100,'condition value');
    }else if(metric==='personality'||metric==='trait'){
     if(operator!==(metric==='trait'?'contains':'eq'))throw Error('Invalid identity condition operator.');text(c.value,'condition identity',64);
    }else if(metric==='idle'){
     if(operator!=='eq')throw Error('Invalid idle condition operator.');bool(c.value,'idle condition');
    }else throw Error('Unknown trigger metric.');
    return {metric,operator,value:c.value as number|string|boolean};
   });
  }
  const triggers:LWInteraction.Trigger[]=data.triggers.map(value=>{
   const r=object(value,['id','definitionId','priority','intervalSeconds','chancePercent','source','target','maximumDistance','minimumAffinity'],'duel trigger');
   if(!definitions.some(d=>d.id===r.definitionId&&d.executor==='duel'))throw Error('Trigger needs a known duel definition.');
   return {id:identity(r.id,'trigger ID'),definitionId:r.definitionId as string,priority:number(r.priority,0,100,'trigger priority',true),
    intervalSeconds:number(r.intervalSeconds,.5,3600,'trigger interval'),chancePercent:number(r.chancePercent,0,100,'trigger chance'),
    source:conditions(r.source),target:conditions(r.target),maximumDistance:number(r.maximumDistance,0,100,'trigger distance'),minimumAffinity:number(r.minimumAffinity,-100,100,'trigger affinity')};
  });
  if(new Set(triggers.map(r=>r.id)).size!==triggers.length)throw Error('Duplicate trigger ID.');
  return {format:'littlewild-interactions',schemaVersion:1,id:identity(data.id,'library ID'),version:number(data.version,1,100000,'library version',true),
   definitions,triggers};
 }
 const defaults=validate(seed);
 const fingerprint=(input:unknown):string=>C.fingerprint({schemaVersion:1,components:input});
 const api:LWInteraction.Catalog=Object.freeze({get defaults(){return copy(defaults);},all:()=>copy(defaults.definitions),validate,definition,copy,fingerprint});
 root.LWInteractions=api;if(node)module.exports=api;
})(globalThis);
