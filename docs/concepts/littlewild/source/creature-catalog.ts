/* Immutable, executable-free creature archetype catalog. Creature state is data; systems own behavior. */
(function(inputRoot: unknown){
 'use strict';

 type Plain=Record<string,unknown>;
 type Mode='founder'|'arrival';
 interface Binding{type:string;field:string;}
 interface Definition{
  format:'littlewild-creature';
  schemaVersion:1;
  id:string;
  name:string;
  description:string;
  defaultPersonality:string;
  personalities:readonly string[];
  names:readonly string[];
  movement:Readonly<{baseSpeed:number;bondThreshold:number;bondedSpeedBonus:number}>;
  rng:Readonly<{base:number;stride:number}>;
  state:Readonly<{personalFields:readonly string[];defaults:Plain;modes:Readonly<Record<Mode,Plain>>}>;
  ecs:Readonly<{components:readonly Binding[]}>;
 }
 interface Api{
  readonly revision:number;
  readonly defaultPersonality:string;
  readonly personalFields:readonly string[];
  readonly personalities:readonly string[];
  all():readonly Definition[];
  get(id:string):Definition|null;
  forPersonality(id:string):Definition|null;
  componentBindings(personality:string):readonly Binding[];
  seed(personality:string,mode:Mode,sequence:number):Plain;
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
 const fail=(message:string):never=>{throw Error('Creature definition: '+message);};
 const record=(value:unknown,label:string):Plain=>plain(value)?value:fail(label+' must be an object');
 const list=(value:unknown,label:string,min=0,max=Number.MAX_SAFE_INTEGER):unknown[]=>{
  if(!Array.isArray(value)||value.length<min||value.length>max) return fail(label+' must be a list of '+min+'–'+max+' entries');
  return value;
 };
 const textValue=(value:unknown,label:string,max:number,pattern?:RegExp):string=>{
  if(typeof value!=='string'||!value.trim()||value.length>max||(pattern&&!pattern.test(value))) return fail('invalid '+label);
  return value;
 };
 const numberValue=(value:unknown,label:string,low:number,high:number,whole=false):number=>{
  if(typeof value!=='number'||!Number.isFinite(value)||value<low||value>high||(whole&&!Number.isSafeInteger(value))) return fail('invalid '+label);
  return value;
 };
 const stringList=(value:unknown,label:string,min:number,max:number,validate:(value:string)=>boolean):string[]=>{
  const values=list(value,label,min,max),out:string[]=[];
  for(const entry of values){
   if(typeof entry!=='string'||!validate(entry)) return fail('invalid '+label+' entry');
   out.push(entry);
  }
  if(new Set(out).size!==out.length) return fail('duplicate '+label+' entry');
  return out;
 };

 function dataOnly(value:unknown,path:string,depth=0):void{
  if(depth>16)fail(path+' exceeds maximum nesting');
  if(Array.isArray(value)){value.forEach((entry,index)=>dataOnly(entry,path+'/'+index,depth+1));return;}
  if(plain(value)){
   for(const [key,entry] of Object.entries(value)){
    if(forbidden.has(key))fail(path+'/'+key+' is executable-shaped');
    dataOnly(entry,path+'/'+key,depth+1);
   }
   return;
  }
  if(value!==null&&typeof value!=='string'&&typeof value!=='boolean'&&!(typeof value==='number'&&Number.isFinite(value)))fail(path+' contains a non-JSON value');
 }
 function deepFreeze(value:unknown):void{
  if(!value||typeof value!=='object')return;
  for(const entry of Object.values(value as Plain))deepFreeze(entry);
  if(!Object.isFrozen(value))Object.freeze(value);
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
  const raw=record(input,'creature definition');
  const rootKeys=['format','schemaVersion','id','name','description','defaultPersonality','personalities','names','movement','rng','state','ecs'];
  if(Object.keys(raw).length!==rootKeys.length||rootKeys.some(key=>!Object.hasOwn(raw,key)))fail('invalid root schema');
  if(raw.format!=='littlewild-creature'||raw.schemaVersion!==1)fail('invalid format/version');

  const id=textValue(raw.id,'creature ID',61,safeId);
  const name=textValue(raw.name,id+' name',80);
  const description=textValue(raw.description,id+' description',500);
  const personalities=stringList(raw.personalities,id+' personalities',1,32,value=>safeId.test(value));
  const defaultPersonality=textValue(raw.defaultPersonality,id+' default personality',61,safeId);
  if(!personalities.includes(defaultPersonality))fail(id+' default personality is not supported');
  const names=stringList(raw.names,id+' names',1,64,value=>value.trim().length>0&&value.length<=24);

  const movementSource=record(raw.movement,id+' movement');
  const movement=Object.freeze({
   baseSpeed:numberValue(movementSource.baseSpeed,id+' base speed',.05,8),
   bondThreshold:numberValue(movementSource.bondThreshold,id+' bond threshold',0,100),
   bondedSpeedBonus:numberValue(movementSource.bondedSpeedBonus,id+' bonded speed bonus',0,4)
  });

  const rngSource=record(raw.rng,id+' RNG');
  const rng=Object.freeze({
   base:numberValue(rngSource.base,id+' RNG base',0,4294967295,true),
   stride:numberValue(rngSource.stride,id+' RNG stride',1,4294967295,true)
  });

  const stateSource=record(raw.state,id+' state');
  const personalFields=stringList(stateSource.personalFields,id+' personal fields',1,96,value=>safeField.test(value));
  const defaults=record(stateSource.defaults,id+' defaults');
  const modesSource=record(stateSource.modes,id+' modes');
  const founder=record(modesSource.founder,id+' founder mode');
  const arrival=record(modesSource.arrival,id+' arrival mode');
  if(Object.keys(modesSource).length!==2)fail(id+' modes must be founder and arrival only');
  for(const key of personalFields)if(!Object.hasOwn(defaults,key))fail(id+' personal default missing '+key);
  for(const key of requiredDefaults)if(!Object.hasOwn(defaults,key))fail(id+' creature default missing '+key);
  for(const [mode,values] of [['founder',founder],['arrival',arrival]] as const){
   for(const key of Object.keys(values))if(!personalFields.includes(key))fail(id+' '+mode+' override is not actor-scoped: '+key);
  }

  const ecsSource=record(raw.ecs,id+' ECS');
  const componentSources=list(ecsSource.components,id+' ECS components',5,32);
  const components:Binding[]=[],types=new Set<string>(),fields=new Set<string>();
  for(const inputBinding of componentSources){
   const binding=record(inputBinding,id+' ECS binding');
   if(Object.keys(binding).length!==2)fail(id+' ECS binding has unknown fields');
   const componentType=textValue(binding.type,id+' component type',61,safeComponent);
   const field=textValue(binding.field,id+' component field',61,safeField);
   if(types.has(componentType)||fields.has(field))fail(id+' duplicate ECS binding');
   if(!Object.hasOwn(defaults,field)||!plain(defaults[field]))fail(id+' ECS field '+field+' must reference an object default');
   types.add(componentType);fields.add(field);components.push({type:componentType,field});
  }
  for(const type of requiredComponents)if(!types.has(type))fail(id+' missing ECS component '+type);

  dataOnly(raw,id);
  const value:Definition={
   format:'littlewild-creature',schemaVersion:1,id,name,description,defaultPersonality,
   personalities:Object.freeze(personalities),names:Object.freeze(names),movement,rng,
   state:Object.freeze({personalFields:Object.freeze(personalFields),defaults:clone(defaults),modes:Object.freeze({founder:clone(founder),arrival:clone(arrival)})}),
   ecs:Object.freeze({components:Object.freeze(components)})
  };
  deepFreeze(value);
  return value;
 }

 const sources=list(source,'bundled creature definitions',1,32);
 const definitions:Definition[]=sources.map(validate);
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
  return definition??fail('unknown personality '+personality);
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
  const rpg=record(state.rpg,definition.id+' RPG state');
  rpg.rng=(definition.rng.base+Math.imul(sequence,definition.rng.stride))>>>0;
  return state;
 }
 const first=definitions[0]??fail('no creature definitions');
 const api:Api=Object.freeze({revision,defaultPersonality:first.defaultPersonality,personalFields,personalities,all,get,forPersonality,componentBindings,seed});
 root.LWCreatures=api;
 if(node)module.exports=api;
})(globalThis);
