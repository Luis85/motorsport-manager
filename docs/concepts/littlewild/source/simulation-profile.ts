/* Versioned, data-only ECS rule profiles and compiled composition archetypes.
 * JSON may tune validated numeric rules and select a known compiled schedule. It cannot
 * register components, systems, handlers, commands, callbacks, modules or source code.
 */
(function(root){
 'use strict';
 const node=typeof module!=='undefined'&&module.exports;
 const C=node?require('./content-runtime.js'):root.LWContent;
 const Actor=node?require('./actor-ecs.js'):root.LWActorECS;
 const World=node?require('./world-ecs.js'):root.LWWorldECS;
 const Economy=node?require('./economy-ecs.js'):root.LWEconomyECS;
 const Pipeline=node?require('./simulation-pipeline.js'):root.LWSimulationPipeline;
 const DEFAULT=node?require('./content/simulation-profile.json'):root.LWDefaultSimulationProfile;
 const MAX_BYTES=256*1024;
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&[Object.prototype,null].includes(Object.getPrototypeOf(o));
 const identity=s=>typeof s==='string'&&/^[a-z][a-z0-9-]{0,63}$/.test(s);
 const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
 const exact=(value,keys,label)=>{if(!plain(value)||Object.keys(value).length!==keys.length||keys.some(k=>!own(value,k)))throw Error('Invalid '+label+' schema.');};
 const list=(value,label,max=32)=>{if(!Array.isArray(value)||!value.length||value.length>max||new Set(value).size!==value.length||value.some(x=>!identity(x)))throw Error('Invalid '+label+'.');return value;};
 const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
 function systemIds(runtime){return Object.freeze(runtime.scheduler.systems.map(system=>system.id));}
 const referenceActor=Actor.create(DEFAULT.rules.actor),referenceWorld=World.create(),referenceEconomy=Economy.create(DEFAULT.rules.economy);
 const EXPECTED=freeze({
  engineLayers:['systems','colony','world-simulation','village','planner','cartography'],
  simulationPipeline:Pipeline.schedule.map(step=>step.id),
  actorDynamics:referenceActor.dynamics.systems.map(system=>system.id),
  actorActivity:referenceActor.activity.systems.map(system=>system.id),
  worldTransactions:systemIds(referenceWorld),
  economyTransactions:systemIds(referenceEconomy)
 });
 function validate(input){
  const raw=C.parse(input,MAX_BYTES);
  exact(raw,['format','schemaVersion','id','version','name','description','rules','archetype'],'simulation profile');
  if(raw.format!=='littlewild-simulation-profile'||raw.schemaVersion!==1||raw.version!==1||!identity(raw.id)||
   typeof raw.name!=='string'||!raw.name.trim()||raw.name.length>100||typeof raw.description!=='string'||!raw.description.trim()||raw.description.length>500)
   throw Error('Invalid simulation profile identity.');
  exact(raw.rules,['actor','economy'],'simulation rule profile');
  const actor=Actor.validateRules(raw.rules.actor),economy=Economy.validateRules(raw.rules.economy),a=raw.archetype;
  exact(a,['id','version','engineLayers','simulationPipeline','actorDynamics','actorActivity','worldTransactions','economyTransactions'],'composition archetype');
  if(!identity(a.id)||a.version!==1)throw Error('Invalid composition archetype identity.');
  for(const key of Object.keys(EXPECTED)){
   list(a[key],'composition archetype '+key,key==='engineLayers'?16:32);
   if(!same(a[key],EXPECTED[key]))throw Error('Unsupported composition archetype '+key+'.');
  }
  return freeze({...raw,rules:freeze({actor,economy}),archetype:freeze({...a})});
 }
 function fingerprint(profile){return C.fingerprint({schemaVersion:1,components:validate(profile)});}
 const defaults=validate(DEFAULT);let active=defaults,revision=fingerprint(defaults);
 function assertRuntime(profile=active){
  const checked=validate(profile),composition=root.LWEngineComposition;
  if(composition?.finalized){
   const layers=composition.describe().layers.map(layer=>layer.id);
   if(!same(layers,checked.archetype.engineLayers))throw Error('Active composition archetype does not match the compiled engine.');
  }
  if(!same(Pipeline.schedule.map(step=>step.id),checked.archetype.simulationPipeline))throw Error('Active composition archetype does not match the compiled simulation pipeline.');
  return checked;
 }
 function apply(profile){const checked=assertRuntime(profile);active=checked;revision=fingerprint(checked);return revision;}
 function withProfile(profile,work){if(typeof work!=='function')throw Error('Simulation profile work callback required.');const prior=active,priorHash=revision;try{apply(profile);const result=work();if(result&&['object','function'].includes(typeof result)&&typeof result.then==='function')throw Error('Simulation profile callback must be synchronous.');return result;}finally{active=prior;revision=priorHash;}}
 const api=Object.freeze({validate,fingerprint,apply,withProfile,assertRuntime,expected:EXPECTED,defaults,get current(){return active;},get hash(){return revision;}});
 root.LWSimulationProfile=api;if(node)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
