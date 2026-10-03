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
  readonly defaultArchetype:string;
  readonly defaultPersonality:string;
  readonly personalFields:readonly string[];
  readonly personalities:readonly string[];
  all():readonly Definition[];
  get(id:string):Definition|null;
  supports(archetype:string,personality:string):boolean;
  componentBindings(archetype:string):readonly Binding[];
  seed(archetype:string,personality:string,mode:Mode,sequence:number):Plain;
  validate(input:unknown):Definition;
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
 const requiredDefaults=['archetype','name','personality','creature','bond','needs','inventory','allowance','skills','researched','training','orders','task','focus','cooldowns','memory','stats','stockTargets','practice','memories','wish','daily','learning','specializations','fieldStudies','buildPolicy','metrics','traits','rpg','equipment','equipQueue','questPlan','activeQuest','questHistory','needsDeposit','feelings','behavior','lastRoll','careVisual','salvage','eventInteractions','interactionCooldowns'] as const;

 const plain=(value:unknown):value is Plain=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
 const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
 const fail=(message:string):never=>{throw Error('Creature definition: '+message);};
 const record=(value:unknown,label:string):Plain=>plain(value)?value:fail(label+' must be an object');
 const exact=(value:unknown,label:string,keys:readonly string[]):Plain=>{
  const out=record(value,label),actual=Object.keys(out);
  if(actual.length!==keys.length||keys.some(key=>!Object.hasOwn(out,key)))fail(label+' has unknown or missing fields');
  return out;
 };
 const list=(value:unknown,label:string,min=0,max=Number.MAX_SAFE_INTEGER):unknown[]=>{
  if(!Array.isArray(value)||value.length<min||value.length>max)return fail(label+' must be a list of '+min+'–'+max+' entries');
  return value;
 };
 const textValue=(value:unknown,label:string,max:number,pattern?:RegExp):string=>{
  if(typeof value!=='string'||!value.trim()||value.length>max||(pattern&&!pattern.test(value)))return fail('invalid '+label);
  return value;
 };
 const numberValue=(value:unknown,label:string,low:number,high:number,whole=false):number=>{
  if(typeof value!=='number'||!Number.isFinite(value)||value<low||value>high||(whole&&!Number.isSafeInteger(value)))return fail('invalid '+label);
  return value;
 };
 const stringList=(value:unknown,label:string,min:number,max:number,validate:(value:string)=>boolean):string[]=>{
  const values=list(value,label,min,max),out:string[]=[];
  for(const entry of values){if(typeof entry!=='string'||!validate(entry))return fail('invalid '+label+' entry');out.push(entry);}
  if(new Set(out).size!==out.length)return fail('duplicate '+label+' entry');
  return out;
 };
 function dataOnly(value:unknown,path:string,depth=0):void{
  if(depth>16)fail(path+' exceeds maximum nesting');
  if(Array.isArray(value)){value.forEach((entry,index)=>dataOnly(entry,path+'/'+index,depth+1));return;}
  if(plain(value)){for(const [key,entry] of Object.entries(value)){if(forbidden.has(key))fail(path+'/'+key+' is executable-shaped');dataOnly(entry,path+'/'+key,depth+1);}return;}
  if(value!==null&&typeof value!=='string'&&typeof value!=='boolean'&&!(typeof value==='number'&&Number.isFinite(value)))fail(path+' contains a non-JSON value');
 }
 function deepFreeze(value:unknown):void{
  if(!value||typeof value!=='object')return;
  for(const entry of Object.values(value as Plain))deepFreeze(entry);
  if(!Object.isFrozen(value))Object.freeze(value);
 }
 function merge(base:Plain,override:Plain):Plain{
  const out=clone(base);
  for(const [key,value] of Object.entries(override)){const current=out[key];out[key]=plain(current)&&plain(value)?merge(current,value):clone(value);}
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

  const movementSource=exact(raw.movement,id+' movement',['baseSpeed','bondThreshold','bondedSpeedBonus']);
  const movement=Object.freeze({
   baseSpeed:numberValue(movementSource.baseSpeed,id+' base speed',.05,8),
   bondThreshold:numberValue(movementSource.bondThreshold,id+' bond threshold',0,100),
   bondedSpeedBonus:numberValue(movementSource.bondedSpeedBonus,id+' bonded speed bonus',0,4)
  });
  const rngSource=exact(raw.rng,id+' RNG',['base','stride']);
  const rng=Object.freeze({
   base:numberValue(rngSource.base,id+' RNG base',0,4294967295,true),
   stride:numberValue(rngSource.stride,id+' RNG stride',1,4294967295,true)
  });

  const stateSource=exact(raw.state,id+' state',['personalFields','defaults','modes']);
  const personalFields=stringList(stateSource.personalFields,id+' personal fields',1,96,value=>safeField.test(value));
  const defaults=record(stateSource.defaults,id+' defaults');
  const modesSource=exact(stateSource.modes,id+' modes',['founder','arrival']);
  const founder=record(modesSource.founder,id+' founder mode'),arrival=record(modesSource.arrival,id+' arrival mode');
  for(const key of personalFields)if(!Object.hasOwn(defaults,key))fail(id+' personal default missing '+key);
  for(const key of Object.keys(defaults))if(!personalFields.includes(key))fail(id+' default is not actor-scoped: '+key);
  for(const key of requiredDefaults)if(!Object.hasOwn(defaults,key))fail(id+' creature default missing '+key);
  if(defaults.archetype!==id)fail(id+' default archetype must match its definition ID');
  if(defaults.personality!==defaultPersonality)fail(id+' default personality must match defaultPersonality');
  for(const [mode,values] of [['founder',founder],['arrival',arrival]] as const)for(const key of Object.keys(values))if(!personalFields.includes(key))fail(id+' '+mode+' override is not actor-scoped: '+key);

  const ecsSource=exact(raw.ecs,id+' ECS',['components']);
  const componentSources=list(ecsSource.components,id+' ECS components',5,32);
  const components:Binding[]=[],types=new Set<string>(),fields=new Set<string>();
  for(const inputBinding of componentSources){
   const binding=record(inputBinding,id+' ECS binding');
   if(Object.keys(binding).length!==2)fail(id+' ECS binding has unknown fields');
   const componentType=textValue(binding.type,id+' component type',61,safeComponent),field=textValue(binding.field,id+' component field',61,safeField);
   if(types.has(componentType)||fields.has(field))fail(id+' duplicate ECS binding');
   if(!Object.hasOwn(defaults,field)||!plain(defaults[field]))fail(id+' ECS field '+field+' must reference an object default');
   types.add(componentType);fields.add(field);components.push({type:componentType,field});
  }
  for(const type of requiredComponents)if(!types.has(type))fail(id+' missing ECS component '+type);

  dataOnly(raw,id);
  const value:Definition={format:'littlewild-creature',schemaVersion:1,id,name,description,defaultPersonality,
   personalities:Object.freeze(personalities),names:Object.freeze(names),movement,rng,
   state:Object.freeze({personalFields:Object.freeze(personalFields),defaults:clone(defaults),modes:Object.freeze({founder:clone(founder),arrival:clone(arrival)})}),
   ecs:Object.freeze({components:Object.freeze(components)})};
  deepFreeze(value);return value;
 }

 const sources=list(source,'bundled creature definitions',1,32);
 const definitions:readonly Definition[]=Object.freeze(sources.map(validate));
 const byId=new Map<string,Definition>();
 for(const definition of definitions){if(byId.has(definition.id))fail('duplicate creature '+definition.id);byId.set(definition.id,definition);}
 const first=definitions[0]??fail('no creature definitions');
 const fieldContract=JSON.stringify([...first.state.personalFields].sort());
 for(const definition of definitions)if(JSON.stringify([...definition.state.personalFields].sort())!==fieldContract)fail(definition.id+' must implement the shared actor-scoped field contract');
 const personalFields:readonly string[]=first.state.personalFields;
 const personalities:readonly string[]=Object.freeze([...new Set(definitions.flatMap(definition=>[...definition.personalities]))]);
 let revision=2166136261;for(const ch of JSON.stringify(definitions)){revision^=ch.charCodeAt(0);revision=Math.imul(revision,16777619);}revision>>>=0;

 function all():readonly Definition[]{return definitions;}
 function get(id:string):Definition|null{return byId.get(id)||null;}
 function definition(id:string):Definition{return byId.get(id)??fail('unknown creature archetype '+id);}
 function supports(archetype:string,personality:string):boolean{return !!byId.get(archetype)?.personalities.includes(personality);}
 function componentBindings(archetype:string):readonly Binding[]{return definition(archetype).ecs.components;}
 function seed(archetype:string,personality:string,mode:Mode,sequence:number):Plain{
  if(mode!=='founder'&&mode!=='arrival')fail('invalid creature mode');
  if(!Number.isSafeInteger(sequence)||sequence<0)fail('invalid creature sequence');
  const def=definition(archetype);if(!def.personalities.includes(personality))fail(archetype+' does not support personality '+personality);
  const state=merge(def.state.defaults,def.state.modes[mode]);
  state.archetype=def.id;state.personality=personality;state.name=def.names[sequence%def.names.length]!;
  const rpg=record(state.rpg,def.id+' RPG state');rpg.rng=(def.rng.base+Math.imul(sequence,def.rng.stride))>>>0;
  return state;
 }
 const api:Api=Object.freeze({revision,defaultArchetype:first.id,defaultPersonality:first.defaultPersonality,personalFields,personalities,all,get,supports,componentBindings,seed,validate});
 root.LWCreatures=api;if(node)module.exports=api;
})(globalThis);
