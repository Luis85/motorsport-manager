/// <reference path="./content-provider-contracts.d.ts" />
/// <reference path="./balancing-contracts.d.ts" />
/* Versioned, data-only ECS rule profiles and compiled composition archetypes.
 * JSON may tune validated numeric rules and select a known compiled schedule. It cannot
 * register components, systems, handlers, commands, callbacks, modules or source code.
 */
(function(inputRoot: unknown){
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
 }
 interface Profile {
  format:string;
  schemaVersion:number;
  id:string;
  version:number;
  name:string;
  description:string;
  rules:{actor:unknown;economy:unknown;gameplay?:LWBalanceRules.Rules|undefined};
  archetype:Archetype;
 }
 interface RuntimeWithScheduler {scheduler:{systems:readonly {id:string}[]};}
 interface ActorRuntime extends RuntimeWithScheduler {
  dynamics:{systems:readonly {id:string}[]};
  activity:{systems:readonly {id:string}[]};
 }
 interface ContentApi {
  parse(input:unknown,limit:number):unknown;
  fingerprint(input:unknown):string;
 }
 interface ActorModule {
  create(rules:unknown):ActorRuntime;
  validateRules(input:unknown):unknown;
 }
 interface WorldModule { create():RuntimeWithScheduler; }
 interface EconomyModule {
  create(rules:unknown):RuntimeWithScheduler;
  validateRules(input:unknown):unknown;
 }
 interface PipelineApi { readonly schedule:readonly {id:string}[]; }
 interface CompositionApi { readonly finalized?:boolean; describe():{layers:readonly {id:string}[]}; }
 interface SimulationProfileApi {
  validate(input:unknown):Profile;
  fingerprint(profile:unknown):string;
  apply(profile:unknown):string;
  withProfile<T>(profile:unknown,work:()=>T):T;
  assertRuntime(profile?:unknown):Profile;
  readonly expected:Readonly<ExpectedArchetype>;
  readonly defaults:Profile;
  readonly current:Profile;
  readonly hash:string;
 }
 interface ExpectedArchetype {
  engineLayers:readonly string[];
  simulationPipeline:readonly string[];
  actorDynamics:readonly string[];
  actorActivity:readonly string[];
  worldTransactions:readonly string[];
  economyTransactions:readonly string[];
 }
 interface LittlewildRoot {
  LWContent?:ContentApi;
  LWActorECS?:ActorModule;
  LWWorldECS?:WorldModule;
  LWEconomyECS?:EconomyModule;
  LWSimulationPipeline?:PipelineApi;
  LWContentProvider?:LWContentProvider.Api;
  LWEngineComposition?:CompositionApi;
  LWSimulationProfile?:SimulationProfileApi;
 }
 const root=inputRoot as LittlewildRoot;
 const node=typeof module!=='undefined'&&module.exports;
 const content=(node?require('./content-runtime.js'):root.LWContent) as ContentApi|undefined;
 const actorModule=(node?require('./actor-ecs.js'):root.LWActorECS) as ActorModule|undefined;
 const worldModule=(node?require('./world-ecs.js'):root.LWWorldECS) as WorldModule|undefined;
 const economyModule=(node?require('./economy-ecs.js'):root.LWEconomyECS) as EconomyModule|undefined;
 const pipeline=(node?require('./simulation-pipeline.js'):root.LWSimulationPipeline) as PipelineApi|undefined;
 const provider=(node?require('./content-provider.js'):root.LWContentProvider) as LWContentProvider.Api|undefined;
 if(!content||!actorModule||!worldModule||!economyModule||!pipeline||!provider)
  throw Error('Simulation profile dependencies are missing.');
 const C:ContentApi=content,Actor:ActorModule=actorModule,World:WorldModule=worldModule,Economy:EconomyModule=economyModule,Pipeline:PipelineApi=pipeline;
 const Content:LWContentProvider.Api=provider;
 const dig=(value:unknown,...keys:string[]):unknown=>keys.reduce<unknown>((at,key)=>at!==null&&typeof at==='object'?(at as Record<string,unknown>)[key]:undefined,value);
 /** The installed game's default simulation profile document. */
 function defaultSource():unknown{
  const source=dig(Content.get('the default simulation profile').balancing,'simulation');
  if(source===undefined)throw Error('Simulation profile dependencies are missing.');
  return source;
 }
 const Balance=(node?require('./balancing-rules.js'): (globalThis as unknown as {LWBalanceRules:LWBalanceRules.Api}).LWBalanceRules) as LWBalanceRules.Api;
 const MAX_BYTES=256*1024;
 const own=(object:Record<string,unknown>,key:string):boolean=>Object.prototype.hasOwnProperty.call(object,key);
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
 const exact:(value:unknown,keys:readonly string[],label:string)=>asserts value is Record<string,unknown> =
  (value,keys,label)=>{
   if(!plain(value)||Object.keys(value).length!==keys.length||keys.some(key=>!own(value,key)))
    throw Error('Invalid '+label+' schema.');
  };
 const list=(value:unknown,label:string,max=32):string[]=>{
  if(!Array.isArray(value)||!value.length||value.length>max||new Set(value).size!==value.length||value.some(entry=>!identity(entry)))
   throw Error('Invalid '+label+'.');
  return [...value] as string[];
 };
 const same=(a:readonly string[],b:readonly string[]):boolean=>a.length===b.length&&a.every((value,index)=>value===b[index]);
 const systemIds=(runtime:RuntimeWithScheduler):readonly string[]=>Object.freeze(runtime.scheduler.systems.map(system=>system.id));
 const isPromiseLike=(value:unknown):value is PromiseLike<unknown>=>value!==null&&
  (typeof value==='object'||typeof value==='function')&&typeof (value as {then?:unknown}).then==='function';

 function defaultRules(value:unknown):{actor:unknown;economy:unknown}{
  if(!plain(value)||!plain(value.rules)||!own(value.rules,'actor')||!own(value.rules,'economy'))
   throw Error('Default simulation profile is missing rule data.');
  return {actor:value.rules.actor,economy:value.rules.economy};
 }
 // The compiled archetype is observed from reference runtimes built with the game's default rules.
 let expectedArchetype:Readonly<ExpectedArchetype>|null=null;
 function expected():Readonly<ExpectedArchetype>{
  if(expectedArchetype)return expectedArchetype;
 const seedRules=defaultRules(defaultSource());
 const referenceActor=Actor.create(seedRules.actor);
 const referenceWorld=World.create();
 const referenceEconomy=Economy.create(seedRules.economy);
 return expectedArchetype=freeze({
  engineLayers:['systems','colony','world-simulation','village','planner','cartography'],
  simulationPipeline:Pipeline.schedule.map(step=>step.id),
  actorDynamics:referenceActor.dynamics.systems.map(system=>system.id),
  actorActivity:referenceActor.activity.systems.map(system=>system.id),
  worldTransactions:systemIds(referenceWorld),
  economyTransactions:systemIds(referenceEconomy)
 });
 }

 function validate(input:unknown):Profile{
  const raw=C.parse(input,MAX_BYTES);
  exact(raw,['format','schemaVersion','id','version','name','description','rules','archetype'],'simulation profile');
  if(raw.format!=='littlewild-simulation-profile'||raw.schemaVersion!==1||raw.version!==1||!identity(raw.id)||
   typeof raw.name!=='string'||!raw.name.trim()||[...raw.name].length>100||
   typeof raw.description!=='string'||!raw.description.trim()||[...raw.description].length>500)
   throw Error('Invalid simulation profile identity.');

  const rules=raw.rules;
  if(!plain(rules)||!own(rules,'actor')||!own(rules,'economy')||Object.keys(rules).some(key=>!['actor','economy','gameplay'].includes(key)))throw Error('Invalid simulation rule profile.');
  const gameplay=rules.gameplay===undefined?undefined:Balance.validate(rules.gameplay);
  const actor=Actor.validateRules(rules.actor),economy=Economy.validateRules(rules.economy);
  const sourceArchetype=raw.archetype;
  exact(sourceArchetype,['id','version','engineLayers','simulationPipeline','actorDynamics','actorActivity','worldTransactions','economyTransactions'],'composition archetype');
  if(sourceArchetype.id!=='living-world-v1'||sourceArchetype.version!==1)throw Error('Unsupported composition archetype identity.');

  const archetype:Archetype={
   id:sourceArchetype.id,
   version:sourceArchetype.version,
   engineLayers:list(sourceArchetype.engineLayers,'composition archetype engineLayers',16),
   simulationPipeline:list(sourceArchetype.simulationPipeline,'composition archetype simulationPipeline'),
   actorDynamics:list(sourceArchetype.actorDynamics,'composition archetype actorDynamics'),
   actorActivity:list(sourceArchetype.actorActivity,'composition archetype actorActivity'),
   worldTransactions:list(sourceArchetype.worldTransactions,'composition archetype worldTransactions'),
   economyTransactions:list(sourceArchetype.economyTransactions,'composition archetype economyTransactions')
  };
  const EXPECTED=expected();
  for(const key of Object.keys(EXPECTED) as Array<keyof ExpectedArchetype>){
   if(!same(archetype[key],EXPECTED[key]))throw Error('Unsupported composition archetype '+key+'.');
  }

  return freeze({
   format:raw.format,
   schemaVersion:raw.schemaVersion,
   id:raw.id,
   version:raw.version,
   name:raw.name,
   description:raw.description,
   rules:freeze({actor,economy,...(gameplay?{gameplay}:{})}),
   archetype:freeze(archetype)
  });
 }

 function fingerprint(profile:unknown):string{return C.fingerprint({schemaVersion:1,components:validate(profile)});}
 // Admitted on first use or as soon as a game is installed; apply() may replace the active profile.
 let defaultProfile:Profile|null=null,active:Profile|null=null,revision='';
 function defaults():Profile{
  if(defaultProfile)return defaultProfile;
  const checked=validate(defaultSource());
  if(active===null){active=checked;revision=fingerprint(checked);}
  return defaultProfile=checked;
 }
 const current=():Profile=>{defaults();return active!;};

 function assertRuntime(profile:unknown=current()):Profile{
  const checked=validate(profile),composition=root.LWEngineComposition;
  if(composition?.finalized){
   const layers=composition.describe().layers.map(layer=>layer.id);
   if(!same(layers,checked.archetype.engineLayers))throw Error('Active composition archetype does not match the compiled engine.');
  }
  if(!same(Pipeline.schedule.map(step=>step.id),checked.archetype.simulationPipeline))
   throw Error('Active composition archetype does not match the compiled simulation pipeline.');
  return checked;
 }

 function apply(profile:unknown):string{
  const checked=assertRuntime(profile);active=checked;revision=fingerprint(checked);return revision;
 }
 function withProfile<T>(profile:unknown,work:()=>T):T{
  if(typeof work!=='function')throw Error('Simulation profile work callback required.');
  const prior=current(),priorHash=revision;
  try{
   apply(profile);const result=work();
   if(isPromiseLike(result))throw Error('Simulation profile callback must be synchronous.');
   return result;
  }finally{active=prior;revision=priorHash;}
 }

 const api:SimulationProfileApi=Object.freeze({
  validate,fingerprint,apply,withProfile,assertRuntime,get expected(){return expected();},get defaults(){return defaults();},
  get current(){return current();},get hash(){defaults();return revision;}
 });
 Content.whenInstalled(()=>{defaults();},'balancing');
 root.LWSimulationProfile=api;
 if(node)module.exports=api;
})(globalThis);
