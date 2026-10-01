/* Versioned, data-only ECS rule profiles and compiled composition archetypes.
 * JSON may tune validated numeric rules and select a known compiled schedule. It cannot
 * register components, systems, handlers, commands, callbacks, modules or source code.
 */
(function(root:any){
 'use strict';

 interface Archetype {
  id:string;
  version:number;
  engineLayers:string[];
  simulationPipeline:string[];
  actorDynamics:string[];
  actorActivity:string[];
  worldTransactions:string[];
  economyTransactions:string[];
  [key:string]:unknown;
 }
 interface Profile {
  format:string;
  schemaVersion:number;
  id:string;
  version:number;
  name:string;
  description:string;
  rules:{actor:unknown;economy:unknown};
  archetype:Archetype;
  [key:string]:unknown;
 }
 interface RuntimeWithScheduler {scheduler:{systems:Array<{id:string}>};}
 interface ActorRuntime extends RuntimeWithScheduler {
  dynamics:{systems:Array<{id:string}>};
  activity:{systems:Array<{id:string}>};
 }

 const node=typeof module!=='undefined'&&module.exports;
 const C:any=node?require('./content-runtime.js'):root.LWContent;
 const Actor:any=node?require('./actor-ecs.js'):root.LWActorECS;
 const World:any=node?require('./world-ecs.js'):root.LWWorldECS;
 const Economy:any=node?require('./economy-ecs.js'):root.LWEconomyECS;
 const Pipeline:any=node?require('./simulation-pipeline.js'):root.LWSimulationPipeline;
 const DEFAULT:any=node?require('./content/simulation-profile.json'):root.LWDefaultSimulationProfile;
 const MAX_BYTES=256*1024;
 const own=(object:Record<string,unknown>,key:string)=>Object.prototype.hasOwnProperty.call(object,key);
 const plain=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
  [Object.prototype,null].includes(Object.getPrototypeOf(value));
 const identity=(value:unknown):value is string=>typeof value==='string'&&/^[a-z][a-z0-9-]{0,63}$/.test(value);
 const freeze=<T>(value:T):T=>{
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
   Object.values(value as Record<string,unknown>).forEach(entry=>freeze(entry));
   Object.freeze(value);
  }
  return value;
 };
 const exact=(value:unknown,keys:readonly string[],label:string):asserts value is Record<string,unknown>=>{
  if(!plain(value)||Object.keys(value).length!==keys.length||keys.some(key=>!own(value,key)))
   throw Error('Invalid '+label+' schema.');
 };
 const list=(value:unknown,label:string,max=32):string[]=>{
  if(!Array.isArray(value)||!value.length||value.length>max||new Set(value).size!==value.length||value.some(entry=>!identity(entry)))
   throw Error('Invalid '+label+'.');
  return value as string[];
 };
 const same=(a:readonly string[],b:readonly string[])=>a.length===b.length&&a.every((value,index)=>value===b[index]);
 const systemIds=(runtime:RuntimeWithScheduler)=>Object.freeze(runtime.scheduler.systems.map(system=>system.id));

 const referenceActor=Actor.create(DEFAULT.rules.actor) as ActorRuntime;
 const referenceWorld=World.create() as RuntimeWithScheduler;
 const referenceEconomy=Economy.create(DEFAULT.rules.economy) as RuntimeWithScheduler;
 const EXPECTED=freeze({
  engineLayers:['systems','colony','world-simulation','village','planner','cartography'],
  simulationPipeline:(Pipeline.schedule as Array<{id:string}>).map(step=>step.id),
  actorDynamics:referenceActor.dynamics.systems.map(system=>system.id),
  actorActivity:referenceActor.activity.systems.map(system=>system.id),
  worldTransactions:systemIds(referenceWorld),
  economyTransactions:systemIds(referenceEconomy)
 });

 function validate(input:unknown):Profile{
  const raw=C.parse(input,MAX_BYTES) as unknown;
  exact(raw,['format','schemaVersion','id','version','name','description','rules','archetype'],'simulation profile');
  if(raw.format!=='littlewild-simulation-profile'||raw.schemaVersion!==1||raw.version!==1||!identity(raw.id)||
   typeof raw.name!=='string'||!raw.name.trim()||raw.name.length>100||
   typeof raw.description!=='string'||!raw.description.trim()||raw.description.length>500)
   throw Error('Invalid simulation profile identity.');

  exact(raw.rules,['actor','economy'],'simulation rule profile');
  const actor=Actor.validateRules(raw.rules.actor),economy=Economy.validateRules(raw.rules.economy),archetype=raw.archetype;
  exact(archetype,['id','version','engineLayers','simulationPipeline','actorDynamics','actorActivity','worldTransactions','economyTransactions'],'composition archetype');
  if(!identity(archetype.id)||archetype.version!==1)throw Error('Invalid composition archetype identity.');

  for(const key of Object.keys(EXPECTED) as Array<keyof typeof EXPECTED>){
   const values=list(archetype[key],'composition archetype '+key,key==='engineLayers'?16:32);
   if(!same(values,EXPECTED[key]))throw Error('Unsupported composition archetype '+key+'.');
  }

  return freeze({...raw,rules:freeze({actor,economy}),archetype:freeze({...archetype})}) as Profile;
 }

 function fingerprint(profile:unknown):string{return C.fingerprint({schemaVersion:1,components:validate(profile)});}
 const defaults=validate(DEFAULT);
 let active=defaults,revision=fingerprint(defaults);

 function assertRuntime(profile:unknown=active):Profile{
  const checked=validate(profile),composition:any=root.LWEngineComposition;
  if(composition?.finalized){
   const layers=(composition.describe().layers as Array<{id:string}>).map(layer=>layer.id);
   if(!same(layers,checked.archetype.engineLayers))throw Error('Active composition archetype does not match the compiled engine.');
  }
  if(!same((Pipeline.schedule as Array<{id:string}>).map(step=>step.id),checked.archetype.simulationPipeline))
   throw Error('Active composition archetype does not match the compiled simulation pipeline.');
  return checked;
 }

 function apply(profile:unknown):string{
  const checked=assertRuntime(profile);active=checked;revision=fingerprint(checked);return revision;
 }
 function withProfile<T>(profile:unknown,work:()=>T):T{
  if(typeof work!=='function')throw Error('Simulation profile work callback required.');
  const prior=active,priorHash=revision;
  try{
   apply(profile);const result=work();
   if(result&&['object','function'].includes(typeof result)&&typeof (result as any).then==='function')
    throw Error('Simulation profile callback must be synchronous.');
   return result;
  }finally{active=prior;revision=priorHash;}
 }

 const api=Object.freeze({
  validate,fingerprint,apply,withProfile,assertRuntime,expected:EXPECTED,defaults,
  get current(){return active;},get hash(){return revision;}
 });
 root.LWSimulationProfile=api;
 if(node)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
