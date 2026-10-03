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
  visualAsset:string;
  physiology:Readonly<Record<'food'|'water'|'energy'|'comfort'|'joy'|'fatigue'|'recovery'|'social'|'anger',number>>;
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
  readonly configuration:Readonly<{format:'littlewild-creature-catalog';schemaVersion:1;defaultArchetype:string}>;
  readonly revision:number;
  readonly defaults:{configuration:Api['configuration'];definitions:readonly Definition[]};
  replace(input:unknown):void;
  withDefinitions<T>(input:unknown,work:()=>T):T;
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
 interface Root{LWCreatureConfig?:unknown;LWCreatureDefinitions?:unknown;LWCreatures?:Api;}

 const root=inputRoot as Root;
 const node=typeof module!=='undefined'&&module.exports;
 const authored:Api['defaults']={configuration:(root.LWCreatureConfig??(node?require('./creature-config.json'):undefined)) as Api['configuration'],definitions:(root.LWCreatureDefinitions??(node?require('./creature-definitions.json'):undefined)) as Definition[]};
 if(!authored.configuration||!authored.definitions)throw Error('Creature catalog configuration or definitions are missing.');
 const balancer=(node?require('./creature-balancing.js'):(globalThis as unknown as {LWCreatureBalancing:unknown}).LWCreatureBalancing) as {merge(base:Api['defaults'],overlay:unknown):Api['defaults']};
 const browserDocument=(globalThis as unknown as {LWDefaultBalancing?:{creatures:unknown}}).LWDefaultBalancing;
 if(!node&&browserDocument!==undefined&&(!browserDocument||typeof browserDocument!=='object'||!Object.hasOwn(browserDocument,'creatures')))throw Error('Creature balancing overlay is missing.');
 if((node||browserDocument!==undefined)&&(!balancer||typeof balancer.merge!=='function'))throw Error('Creature balancing merge helper is missing.');
 const overlay=node?require('./content/balancing.json').creatures:browserDocument?.creatures;
 const balanced=!node&&browserDocument===undefined?authored:balancer.merge(authored,overlay),source:unknown=balanced.definitions,configSource:unknown=balanced.configuration;
 const safeId=/^[a-z][a-z0-9_-]{0,60}$/;
 const safeField=/^[A-Za-z][A-Za-z0-9_]{0,60}$/;
 const safeComponent=/^[A-Z][A-Za-z0-9]{0,60}$/;
 const forbidden=new Set(['script','callback','execute','eval','sourceCode','modulePath','handler','command']);
 const requiredComponents={Transform:'creature',Needs:'needs',Learning:'learning',Feelings:'feelings',Inventory:'inventory'} as const;
 const sharedFields=new Set(['id','version','seed','simTime','day','hour','started','speed','paused','player','rp','buildings','nodes','log','completedQuests','contractIndex','settings','ledger','nextId','colony','world','estate','progression','market','planning','atlas']);
 const physiologyKeys=['food','water','energy','comfort','joy','fatigue','recovery','social','anger'] as const;
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
 const scalarText=(value:string):boolean=>{for(let i=0;i<value.length;i++){const unit=value.charCodeAt(i);if(unit>=0xd800&&unit<=0xdbff){const next=value.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))return false;}else if(unit>=0xdc00&&unit<=0xdfff)return false;}return true;};
 const textValue=(value:unknown,label:string,max:number,pattern?:RegExp):string=>{
  if(typeof value!=='string'||!value.trim()||!scalarText(value)||[...value].length>max||(pattern&&!pattern.test(value)))return fail('invalid '+label);
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
 function dataOnly(value:unknown,path:string):void{
  const ancestors=new Set<object>();let count=0;
  function visit(entry:unknown,label:string,depth:number):void{
   if(++count>20000||depth>16)fail(label+' exceeds supported complexity');
   if(typeof entry==='string'&&!scalarText(entry))fail(label+' contains invalid Unicode');
   if(entry===null||typeof entry==='string'||typeof entry==='boolean'||(typeof entry==='number'&&Number.isFinite(entry)))return;
   if(!Array.isArray(entry)&&!plain(entry))fail(label+' contains a non-JSON value');
   const object=entry as object;
   if(ancestors.has(object)||Object.getOwnPropertySymbols(object).length)fail(label+' contains non-JSON properties or a cycle');
   const descriptors=Object.getOwnPropertyDescriptors(object);
   if(Array.isArray(entry)&&(Object.keys(descriptors).length!==entry.length+1||Array.from({length:entry.length},(_,i)=>i).some(i=>!Object.hasOwn(descriptors,String(i)))))fail(label+' must be a dense JSON list');
   ancestors.add(object);
   for(const [key,descriptor] of Object.entries(descriptors)){
    if(Array.isArray(entry)&&key==='length')continue;
    if(!scalarText(key))fail(label+' contains invalid Unicode');
    if(forbidden.has(key)||['__proto__','constructor','prototype'].includes(key))fail(label+'/'+key+' is executable-shaped or reserved');
    if(!descriptor.enumerable||descriptor.get||descriptor.set)fail(label+'/'+key+' contains a non-JSON property');
    visit(descriptor.value,label+'/'+key,depth+1);
   }
   ancestors.delete(object);
  }
  visit(value,path,0);
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
  dataOnly(input,'definition');
  const raw=record(input,'creature definition');
  const rootKeys=['format','schemaVersion','id','name','description','defaultPersonality','personalities','names','movement','rng','state','ecs','visualAsset','physiology'];
  if(Object.keys(raw).length!==rootKeys.length||rootKeys.some(key=>!Object.hasOwn(raw,key)))fail('invalid root schema');
  if(raw.format!=='littlewild-creature'||raw.schemaVersion!==1)fail('invalid format/version');

  const id=textValue(raw.id,'creature ID',61,safeId);
  const name=textValue(raw.name,id+' name',80);
  const visualAsset=textValue(raw.visualAsset,id+' visual asset',61,safeId);
  const physiologySource=exact(raw.physiology,id+' physiology',physiologyKeys);
  const physiology={} as Record<typeof physiologyKeys[number],number>;
  for(const key of physiologyKeys)physiology[key]=numberValue(physiologySource[key],id+' physiology/'+key,0,4);
  const description=textValue(raw.description,id+' description',500);
  const personalities=stringList(raw.personalities,id+' personalities',1,32,value=>safeId.test(value));
  const defaultPersonality=textValue(raw.defaultPersonality,id+' default personality',61,safeId);
  if(!personalities.includes(defaultPersonality))fail(id+' default personality is not supported');
  const names=stringList(raw.names,id+' names',1,64,value=>value.trim().length>0&&[...value].length<=24);

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
  if(personalFields.some(field=>sharedFields.has(field)))fail(id+' actor field conflicts with shared world state');
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
   if(['Creature','Task','Activity','Intent'].includes(componentType))fail(id+' ECS binding conflicts with transient component '+componentType);
   if(types.has(componentType)||fields.has(field))fail(id+' duplicate ECS binding');
   if(!Object.hasOwn(defaults,field)||!plain(defaults[field]))fail(id+' ECS field '+field+' must reference an object default');
   types.add(componentType);fields.add(field);components.push({type:componentType,field});
  }
  for(const [type,field] of Object.entries(requiredComponents))if(!components.some(binding=>binding.type===type&&binding.field===field))fail(id+' missing or invalid ECS component '+type+'/'+field);
  for(const [mode,override] of [['founder',founder],['arrival',arrival]] as const){
   const state=merge(defaults,override);
   if(!plain(state.rpg))fail(id+' '+mode+' RPG state must be an object');
   for(const binding of components){
    const component=record(state[binding.field],id+' '+mode+' component '+binding.type);
    const numericKeys=binding.type==='Transform'?['x','y']:binding.type==='Needs'?['food','water','energy','comfort','joy']:binding.type==='Learning'?['fatigue','practiceDay']:binding.type==='Feelings'?['social','anger']:[];
    for(const key of numericKeys)numberValue(component[key],id+' '+mode+' '+binding.type+'/'+key,binding.type==='Transform'?-1000000:0,binding.type==='Transform'||key==='practiceDay'?1000000:100,key==='practiceDay');
    if(binding.type==='Learning'&&(!plain(component.practicedToday)||typeof component.recovering!=='boolean'||Number(component.practiceDay)<1))fail(id+' '+mode+' invalid learning state');
    if(binding.type==='Inventory')for(const [key,quantity] of Object.entries(component))numberValue(quantity,id+' '+mode+' inventory/'+key,0,Number.MAX_SAFE_INTEGER,true);
   }
  }
  const value:Definition={format:'littlewild-creature',schemaVersion:1,id,name,visualAsset,physiology:Object.freeze(physiology),description,defaultPersonality,
   personalities:Object.freeze(personalities),names:Object.freeze(names),movement,rng,
   state:Object.freeze({personalFields:Object.freeze(personalFields),defaults:clone(defaults),modes:Object.freeze({founder:clone(founder),arrival:clone(arrival)})}),
   ecs:Object.freeze({components:Object.freeze(components)})};
  deepFreeze(value);return value;
 }

 function prepare(input:unknown):{configuration:Api['configuration'];definitions:readonly Definition[];byId:Map<string,Definition>;revision:number}{
  dataOnly(input,'creature catalog');const snapshot=exact(input,'creature catalog',['configuration','definitions']);
  const config=exact(snapshot.configuration,'catalog configuration',['format','schemaVersion','defaultArchetype']);
  if(config.format!=='littlewild-creature-catalog'||config.schemaVersion!==1)fail('invalid catalog format/version');
  const defaultArchetype=textValue(config.defaultArchetype,'default archetype',61,safeId);
  const configuration=Object.freeze({format:'littlewild-creature-catalog' as const,schemaVersion:1 as const,defaultArchetype});
  const definitions:readonly Definition[]=Object.freeze(list(snapshot.definitions,'creature definitions',1,32).map(validate)),byId=new Map<string,Definition>();
  for(const definition of definitions){if(byId.has(definition.id))fail('duplicate creature '+definition.id);byId.set(definition.id,definition);}
  if(!byId.has(defaultArchetype))fail('unknown default creature '+defaultArchetype);
  let revision=2166136261;for(const ch of JSON.stringify([configuration,definitions])){revision^=ch.charCodeAt(0);revision=Math.imul(revision,16777619);}revision>>>=0;
  return {configuration,definitions,byId,revision};
 }
 let active=prepare({configuration:configSource,definitions:source});
 const defaults=clone({configuration:active.configuration,definitions:active.definitions});deepFreeze(defaults);
 const personalFields:readonly string[]=Object.freeze([...new Set(active.definitions.flatMap(definition=>[...definition.state.personalFields]))]);
 const personalities:readonly string[]=Object.freeze([...new Set(active.definitions.flatMap(definition=>[...definition.personalities]))]);
 function replace(input:unknown):void{
  const next=prepare(input);
  // Existing actor proxies and their compiled persistence/creation contract keep these fields.
  for(const def of next.definitions)if(def.state.personalFields.some(field=>!personalFields.includes(field))||personalFields.some(field=>!def.state.personalFields.includes(field)))fail('scenario creatures must retain the supported personal fields');
  active=next;
 }
 function withDefinitions<T>(input:unknown,work:()=>T):T{const previous=active;try{replace(input);const result=work();if(result&&typeof (result as {then?:unknown}).then==='function')throw Error('Creature scope must be synchronous.');return result;}finally{active=previous;}}
 function all():readonly Definition[]{return active.definitions;}
 function get(id:string):Definition|null{return active.byId.get(id)||null;}
 function definition(id:string):Definition{return active.byId.get(id)??fail('unknown creature archetype '+id);}
 function supports(archetype:string,personality:string):boolean{return !!active.byId.get(archetype)?.personalities.includes(personality);}
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
 const api:Api=Object.freeze({get configuration(){return active.configuration;},get revision(){return active.revision;},defaults,
  get defaultArchetype(){return active.configuration.defaultArchetype;},get defaultPersonality(){return definition(active.configuration.defaultArchetype).defaultPersonality;},
  personalFields,personalities,all,get,supports,componentBindings,seed,validate,replace,withDefinitions});
 root.LWCreatures=api;if(node)module.exports=api;
})(globalThis);
