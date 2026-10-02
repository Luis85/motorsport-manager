/* Immutable, executable-free creature archetype catalog. Creature state is data; systems own behavior. */
(function(inputRoot: unknown){
 'use strict';

 type Plain=Record<string,unknown>;
 type Mode='founder'|'arrival';
 interface Binding{type:string;field:string;}
 interface Definition{
  format:'littlewild-creature';schemaVersion:1;id:string;name:string;description:string;defaultPersonality:string;
  personalities:readonly string[];names:readonly string[];
  movement:Readonly<{baseSpeed:number;bondThreshold:number;bondedSpeedBonus:number}>;
  rng:Readonly<{base:number;stride:number}>;
  state:Readonly<{personalFields:readonly string[];defaults:Plain;modes:Readonly<Record<Mode,Plain>>}>;
  ecs:Readonly<{components:readonly Binding[]}>;
 }
 interface Api{
  readonly revision:number;readonly defaultPersonality:string;readonly personalFields:readonly string[];readonly personalities:readonly string[];
  all():readonly Definition[];get(id:string):Definition|null;forPersonality(id:string):Definition|null;
  componentBindings(personality:string):readonly Binding[];seed(personality:string,mode:Mode,sequence:number):Plain;
 }
 interface Root{LWCreatureDefinitions?:unknown;LWCreatures?:Api;}

 const root=inputRoot as Root;
 const node=typeof module!=='undefined'&&module.exports;
 const source:unknown=root.LWCreatureDefinitions??(node?require('./creature-definitions.json'):undefined);
 const safeId=/^[a-z][a-z0-9_-]{0,60}$/;
 const safeField=/^[A-Za-z][A-Za-z0-9_]{0,60}$/;
 const safeComponent=/^[A-Z][A-Za-z0-9]{0,60}$/;
 const forbidden=new Set(['script','callback','execute','eval','sourceCode','modulePath','handler','command']);
 const requiredComponents=['Transform','Needs','Learning','Feelings','Inventory'] as const;
 const requiredDefaults=['name','personality','creature','bond','needs','inventory','allowance','skills','researched','training','orders','task','focus','cooldowns','memory','stats','stockTargets','practice','memories','wish','daily','learning','specializations','fieldStudies','buildPolicy','metrics','traits','rpg','equipment','equipQueue','questPlan','activeQuest','questHistory','needsDeposit','feelings','behavior','lastRoll','careVisual','salvage'] as const;

 const plain=(value:unknown):value is Plain=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
 const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
 const bounded=(value:unknown,low:number,high:number):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=low&&value<=high;
 const integer=(value:unknown,low:number,high:number):value is number=>bounded(value,low,high)&&Number.isSafeInteger(value);
 const fail=(message:string):never=>{throw Error('Creature definition: '+message);};

 function dataOnly(value:unknown,path:string,depth=0):void{
  if(depth>16)fail(path+' exceeds maximum nesting');
  if(Array.isArray(value)){value.forEach((entry,index)=>dataOnly(entry,path+'/'+index,depth+1));return;}
  if(plain(value)){for(const [key,entry] of Object.entries(value)){if(forbidden.has(key))fail(path+'/'+key+' is executable-shaped');dataOnly(entry,path+'/'+key,depth+1);}return;}
  if(value!==null&&typeof value!=='string'&&typeof value!=='boolean'&&!(typeof value==='number'&&Number.isFinite(value)))fail(path+' contains a non-JSON value');
 }
 function deepFreeze(value:unknown):void{
  if(!value||typeof value!=='object'||Object.isFrozen(value))return;
  Object.freeze(value);for(const entry of Object.values(value as Plain))deepFreeze(entry);
 }
 function merge(base:Plain,override:Plain):Plain{
  const out=clone(base);
  for(const [key,value] of Object.entries(override)){
   const current=out[key];
   out[key]=plain(current)&&plain(value)?merge(current,value):clone(value);
  }
  return out;
 }
 function validate(input:unknown):Definition{
  if(!plain(input))fail('entry must be an object');
  const raw=input as Plain;
  const rootKeys=['format','schemaVersion','id','name','description','defaultPersonality','personalities','names','movement','rng','state','ecs'];
  if(Object.keys(raw).length!==rootKeys.length||rootKeys.some(key=>!Object.hasOwn(raw,key)))fail('invalid root schema');
  const rawId=raw.id;
  if(raw.format!=='littlewild-creature'||raw.schemaVersion!==1||typeof rawId!=='string'||!safeId.test(rawId))fail('invalid identity');
  if(typeof raw.name!=='string'||!raw.name.trim()||raw.name.length>80||typeof raw.description!=='string'||!raw.description.trim()||raw.description.length>500)fail(rawId+' invalid display text');
  const personalityValues=raw.personalities;
  if(!Array.isArray(personalityValues)||!personalityValues.length||personalityValues.length>32||personalityValues.some((value:unknown)=>typeof value!=='string'||!safeId.test(value))||new Set(personalityValues).size!==personalityValues.length)fail(rawId+' invalid personalities');
  if(typeof raw.defaultPersonality!=='string'||!personalityValues.includes(raw.defaultPersonality))fail(rawId+' invalid default personality');
  const names=raw.names;
  if(!Array.isArray(names)||!names.length||names.length>64||names.some((value:unknown)=>typeof value!=='string'||!value.trim()||value.length>24)||new Set(names).size!==names.length)fail(rawId+' invalid name pool');
  if(!plain(raw.movement)||!bounded(raw.movement.baseSpeed,.05,8)||!bounded(raw.movement.bondThreshold,0,100)||!bounded(raw.movement.bondedSpeedBonus,0,4))fail(rawId+' invalid movement tuning');
  if(!plain(raw.rng)||!integer(raw.rng.base,0,4294967295)||!integer(raw.rng.stride,1,4294967295))fail(rawId+' invalid RNG tuning');
  if(!plain(raw.state))fail(rawId+' invalid state');
  const personalFields=raw.state.personalFields;
  if(!Array.isArray(personalFields)||!personalFields.length||personalFields.some((value:unknown)=>typeof value!=='string'||!safeField.test(value))||new Set(personalFields).size!==personalFields.length)fail(rawId+' invalid personal fields');
  if(!plain(raw.state.defaults)||!plain(raw.state.modes)||!plain(raw.state.modes.founder)||!plain(raw.state.modes.arrival))fail(rawId+' invalid state templates');
  const defaults=raw.state.defaults;
  for(const key of personalFields as string[])if(!Object.hasOwn(defaults,key))fail(rawId+' personal default missing '+key);
  for(const key of requiredDefaults)if(!Object.hasOwn(defaults,key))fail(rawId+' creature default missing '+key);
  if(!plain(raw.ecs)||!Array.isArray(raw.ecs.components)||raw.ecs.components.length<5||raw.ecs.components.length>32)fail(rawId+' invalid ECS bindings');
  const types=new Set<string>(),fields=new Set<string>();
  for(const inputBinding of raw.ecs.components){
   if(!plain(inputBinding))fail(rawId+' invalid ECS binding');
   const binding=inputBinding as Plain;
   if(Object.keys(binding).length!==2||typeof binding.type!=='string'||typeof binding.field!=='string'||!safeComponent.test(binding.type)||!Object.hasOwn(defaults,binding.field)||types.has(binding.type)||fields.has(binding.field))fail(rawId+' invalid or duplicate ECS binding');
   if(!plain(defaults[binding.field]))fail(rawId+' ECS field '+binding.field+' must default to an object');
   types.add(binding.type);fields.add(binding.field);
  }
  for(const type of requiredComponents)if(!types.has(type))fail(rawId+' missing ECS component '+type);
  dataOnly(raw,rawId);
  const value=clone(raw) as unknown as Definition;deepFreeze(value);return value;
 }

 if(!Array.isArray(source)||!source.length||source.length>32)fail('bundled definition list is missing or invalid');
 const definitions:Definition[]=(source as unknown[]).map(validate);
 const byId=new Map<string,Definition>(),byPersonality=new Map<string,Definition>();
 for(const definition of definitions){
  if(byId.has(definition.id))fail('duplicate creature '+definition.id);
  byId.set(definition.id,definition);
  for(const personality of definition.personalities){
   if(byPersonality.has(personality))fail('personality '+personality+' belongs to multiple creatures');
   byPersonality.set(personality,definition);
  }
 }
 const personalFields:readonly string[]=Object.freeze([...new Set<string>(definitions.flatMap(definition=>[...definition.state.personalFields]))]);
 const personalities:readonly string[]=Object.freeze([...byPersonality.keys()]);
 let revision=2166136261;
 for(const ch of JSON.stringify(definitions)){revision^=ch.charCodeAt(0);revision=Math.imul(revision,16777619);}
 revision>>>=0;

 function byProfile(personality:string):Definition{
  const definition=byPersonality.get(personality);
  if(!definition)return fail('unknown personality '+personality);
  return definition;
 }
 function all():readonly Definition[]{return definitions;}
 function get(id:string):Definition|null{return byId.get(id)||null;}
 function forPersonality(id:string):Definition|null{return byPersonality.get(id)||null;}
 function componentBindings(personality:string):readonly Binding[]{return byProfile(personality).ecs.components;}
 function seed(personality:string,mode:Mode,sequence:number):Plain{
  if(!Number.isSafeInteger(sequence)||sequence<0)fail('invalid creature sequence');
  const definition=byProfile(personality);
  const state=merge(definition.state.defaults,definition.state.modes[mode]);
  state.personality=personality;
  state.name=definition.names[sequence%definition.names.length]!;
  const rpg=state.rpg;
  if(!plain(rpg))return fail(definition.id+' missing RPG state');
  rpg.rng=(definition.rng.base+Math.imul(sequence,definition.rng.stride))>>>0;
  return state;
 }
 const first=definitions[0];
 if(!first)return fail('no creature definitions');
 const api:Api=Object.freeze({revision,defaultPersonality:first.defaultPersonality,personalFields,personalities,all,get,forPersonality,componentBindings,seed});
 root.LWCreatures=api;
 if(node)module.exports=api;
})(globalThis);
