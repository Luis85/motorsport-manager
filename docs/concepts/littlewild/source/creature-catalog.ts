/* Immutable, executable-free creature archetype catalog. Creature state is data; systems own behavior. */
(function(inputRoot: unknown){
 'use strict';
 type Plain=Record<string,unknown>;type Mode='founder'|'arrival';interface Binding{type:string;field:string;}
 interface Definition{format:'littlewild-creature';schemaVersion:1;id:string;name:string;description:string;defaultPersonality:string;personalities:readonly string[];names:readonly string[];movement:Readonly<{baseSpeed:number;bondThreshold:number;bondedSpeedBonus:number}>;rng:Readonly<{base:number;stride:number}>;state:Readonly<{personalFields:readonly string[];defaults:Plain;modes:Readonly<Record<Mode,Plain>>}>;ecs:Readonly<{components:readonly Binding[]}>;}
 interface Api{readonly revision:number;readonly defaultPersonality:string;readonly personalFields:readonly string[];readonly personalities:readonly string[];all():readonly Definition[];get(id:string):Definition|null;forPersonality(id:string):Definition|null;componentBindings(personality:string):readonly Binding[];seed(personality:string,mode:Mode,sequence:number):Plain;}
 interface Root{LWCreatureDefinitions?:unknown;LWCreatures?:Api;}const root=inputRoot as Root,node=typeof module!=='undefined'&&module.exports;
 const source=root.LWCreatureDefinitions??(node?require('./creature-definitions.json'):undefined);
 const safeId=/^[a-z][a-z0-9_-]{0,60}$/,safeField=/^[A-Za-z][A-Za-z0-9_]{0,60}$/,safeComponent=/^[A-Z][A-Za-z0-9]{0,60}$/;
 const forbidden=new Set(['script','callback','execute','eval','sourceCode','modulePath','handler','command']);
 const requiredComponents=['Transform','Needs','Learning','Feelings','Inventory'] as const;
 const requiredDefaults=['name','personality','creature','bond','needs','inventory','allowance','skills','researched','training','orders','task','focus','cooldowns','memory','stats','stockTargets','practice','memories','wish','daily','learning','specializations','fieldStudies','buildPolicy','metrics','traits','rpg','equipment','equipQueue','questPlan','activeQuest','questHistory','needsDeposit','feelings','behavior','lastRoll','careVisual','salvage'] as const;
 const plain=(v:unknown):v is Plain=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
 const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v)) as T;
 const bounded=(v:unknown,low:number,high:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=low&&v<=high;
 const integer=(v:unknown,low:number,high:number):v is number=>bounded(v,low,high)&&Number.isSafeInteger(v);
 const fail=(message:string):never=>{throw Error('Creature definition: '+message);};
 function dataOnly(v:unknown,path:string,depth=0):void{if(depth>16)fail(path+' exceeds maximum nesting');if(Array.isArray(v)){v.forEach((entry,index)=>dataOnly(entry,path+'/'+index,depth+1));return;}if(plain(v)){for(const [key,entry] of Object.entries(v)){if(forbidden.has(key))fail(path+'/'+key+' is executable-shaped');dataOnly(entry,path+'/'+key,depth+1);}return;}if(v!==null&&typeof v!=='string'&&typeof v!=='boolean'&&!(typeof v==='number'&&Number.isFinite(v)))fail(path+' contains a non-JSON value');}
 function deepFreeze(v:unknown):void{if(!v||typeof v!=='object'||Object.isFrozen(v))return;Object.freeze(v);for(const entry of Object.values(v as Plain))deepFreeze(entry);}
 function merge(base:Plain,override:Plain):Plain{const out=clone(base);for(const [key,value] of Object.entries(override)){const current=out[key];out[key]=plain(current)&&plain(value)?merge(current,value):clone(value);}return out;}
 function validate(raw:unknown):Definition{
  if(!plain(raw))fail('entry must be an object');const rootKeys=['format','schemaVersion','id','name','description','defaultPersonality','personalities','names','movement','rng','state','ecs'];
  if(Object.keys(raw).length!==rootKeys.length||rootKeys.some(key=>!Object.hasOwn(raw,key)))fail('invalid root schema');
  if(raw.format!=='littlewild-creature'||raw.schemaVersion!==1||typeof raw.id!=='string'||!safeId.test(raw.id))fail('invalid identity');
  if(typeof raw.name!=='string'||!raw.name.trim()||raw.name.length>80||typeof raw.description!=='string'||!raw.description.trim()||raw.description.length>500)fail(raw.id+' invalid display text');
  if(!Array.isArray(raw.personalities)||!raw.personalities.length||raw.personalities.length>32||raw.personalities.some(value=>typeof value!=='string'||!safeId.test(value))||new Set(raw.personalities).size!==raw.personalities.length)fail(raw.id+' invalid personalities');
  if(typeof raw.defaultPersonality!=='string'||!raw.personalities.includes(raw.defaultPersonality))fail(raw.id+' invalid default personality');
  if(!Array.isArray(raw.names)||!raw.names.length||raw.names.length>64||raw.names.some(value=>typeof value!=='string'||!value.trim()||value.length>24)||new Set(raw.names).size!==raw.names.length)fail(raw.id+' invalid name pool');
  if(!plain(raw.movement)||!bounded(raw.movement.baseSpeed,.05,8)||!bounded(raw.movement.bondThreshold,0,100)||!bounded(raw.movement.bondedSpeedBonus,0,4))fail(raw.id+' invalid movement tuning');
  if(!plain(raw.rng)||!integer(raw.rng.base,0,4294967295)||!integer(raw.rng.stride,1,4294967295))fail(raw.id+' invalid RNG tuning');
  if(!plain(raw.state)||!Array.isArray(raw.state.personalFields)||!raw.state.personalFields.length||raw.state.personalFields.some(value=>typeof value!=='string'||!safeField.test(value))||new Set(raw.state.personalFields).size!==raw.state.personalFields.length)fail(raw.id+' invalid personal fields');
  if(!plain(raw.state.defaults)||!plain(raw.state.modes)||!plain(raw.state.modes.founder)||!plain(raw.state.modes.arrival))fail(raw.id+' invalid state templates');
  for(const key of raw.state.personalFields)if(!Object.hasOwn(raw.state.defaults,key))fail(raw.id+' personal default missing '+key);
  for(const key of requiredDefaults)if(!Object.hasOwn(raw.state.defaults,key))fail(raw.id+' creature default missing '+key);
  if(!plain(raw.ecs)||!Array.isArray(raw.ecs.components)||raw.ecs.components.length<5||raw.ecs.components.length>32)fail(raw.id+' invalid ECS bindings');
  const types=new Set<string>(),fields=new Set<string>();for(const binding of raw.ecs.components){if(!plain(binding)||Object.keys(binding).length!==2||typeof binding.type!=='string'||typeof binding.field!=='string'||!safeComponent.test(binding.type)||!Object.hasOwn(raw.state.defaults,binding.field)||types.has(binding.type)||fields.has(binding.field))fail(raw.id+' invalid or duplicate ECS binding');if(!plain(raw.state.defaults[binding.field]))fail(raw.id+' ECS field '+binding.field+' must default to an object');types.add(binding.type);fields.add(binding.field);}
  for(const type of requiredComponents)if(!types.has(type))fail(raw.id+' missing ECS component '+type);dataOnly(raw,raw.id);const value=clone(raw) as unknown as Definition;deepFreeze(value);return value;
 }
 if(!Array.isArray(source)||!source.length||source.length>32)fail('bundled definition list is missing or invalid');
 const definitions=source.map(validate),byId=new Map<string,Definition>(),byPersonality=new Map<string,Definition>();for(const definition of definitions){if(byId.has(definition.id))fail('duplicate creature '+definition.id);byId.set(definition.id,definition);for(const personality of definition.personalities){if(byPersonality.has(personality))fail('personality '+personality+' belongs to multiple creatures');byPersonality.set(personality,definition);}}
 const personalFields=Object.freeze([...new Set(definitions.flatMap(definition=>definition.state.personalFields))]),personalities=Object.freeze([...byPersonality.keys()]);let revision=2166136261;for(const ch of JSON.stringify(definitions)){revision^=ch.charCodeAt(0);revision=Math.imul(revision,16777619);}revision>>>=0;
 function byProfile(personality:string):Definition{const definition=byPersonality.get(personality);if(!definition)fail('unknown personality '+personality);return definition;}
 const api:Api=Object.freeze({revision,defaultPersonality:definitions[0]!.defaultPersonality,personalFields,personalities,all:()=>definitions,get:value=>byId.get(value)||null,forPersonality:value=>byPersonality.get(value)||null,componentBindings:personality=>byProfile(personality).ecs.components,seed(personality,mode,sequence){if(!Number.isSafeInteger(sequence)||sequence<0)fail('invalid creature sequence');if(mode!=='founder'&&mode!=='arrival')fail('invalid spawn mode');const definition=byProfile(personality),state=merge(definition.state.defaults,definition.state.modes[mode]);state.personality=personality;state.name=definition.names[sequence%definition.names.length]!;const rpg=state.rpg;if(!plain(rpg))fail(definition.id+' missing RPG state');rpg.rng=(definition.rng.base+Math.imul(sequence,definition.rng.stride))>>>0;return state;}});
 root.LWCreatures=api;if(node)module.exports=api;
})(globalThis);
