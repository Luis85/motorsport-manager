/// <reference path="./rts-contracts.d.ts" />
/** Strict inert catalog admission. No executable content or mutable authored records escape. */
(function(inputRoot:unknown) {
 'use strict';
 type RecordData=Record<string,unknown>;
 type Spec=string|Readonly<{[key:string]:Spec}>;
 interface Root { LWRTSCatalog?:LWRTSData.CatalogApi; LWRTSDefinitions?:unknown; }
 const root=inputRoot as Root;
 const node=typeof module!=='undefined'&&module.exports;
 const fail=(message:string):never=>{throw Error('RTS catalog: '+message);};
 const plain=(v:unknown):v is RecordData=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
 const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v)) as T;
 const idPattern=/^[a-z][a-z0-9_-]{0,63}$/;
 const movement='enum:land|water|air';
 const role='enum:worker|infantry|ranged|cavalry|siege|vehicle|naval|aircraft|creature';
 const named={id:'id',name:'text',description:'text'};
 const attack={damage:'positive',range:'positive',cooldown:'positive',projectileSpeed:'nonnegative',splash:'nonnegative',targets:'list:movement'};
 const specs:Record<string,Spec>={
  movement,role,attack,
  resources:{...named,color:'color',gatherRate:'positive'},
  units:{...named,role,movement,speed:'positive',hp:'positive',armor:'nonnegative',sight:'positive',radius:'positive',population:'integer',buildTime:'positive',cost:'cost',prerequisites:'list:id',attack:'nullable:attack',abilities:'list:id',color:'color',shape:'enum:person|horse|tank|boat|plane|animal',gatherRate:'nonnegative',carryCapacity:'integer',buildRate:'nonnegative'},
  buildings:{...named,hp:'positive',armor:'nonnegative',sight:'positive',footprint:{width:'whole',height:'whole'},buildTime:'positive',cost:'cost',produces:'list:id',researches:'list:id',storage:'list:id',population:'integer',power:'number',attack:'nullable:attack',color:'color'},
  factions:{...named,color:'color',units:'list:id',buildings:'list:id',technologies:'list:id',startingResources:'cost',ai:{enabled:'boolean',attackInterval:'positive',preferredUnit:'id'}},
  items:{...named,cost:'cost',ability:'id',charges:'whole'},
  technologies:{...named,cost:'cost',researchTime:'positive',prerequisites:'list:id',effects:'list:effect'},
  effect:{stat:'enum:damage|armor|speed|sight|gatherRate|maxHp',factor:'positive',roles:'list:role'},
  abilities:{...named,effect:'enum:heal|damage|repair|reveal',amount:'positive',radius:'nonnegative',range:'positive',cooldown:'positive',duration:'positive',cost:'cost'},
  terrain:{...named,color:'color',passable:'list:movement',speedFactor:'positive',cover:'nonnegative'},
  missions:{...named,width:'whole',height:'whole',playerFaction:'id',defaultTerrain:'id',spawns:'list:spawn',deposits:'list:deposit',items:'list:itemDrop',terrain:'list:patch',objectives:'list:objective',fog:'boolean',seed:'integer'},
  spawn:{archetype:'id',faction:'id',x:'nonnegative',y:'nonnegative',count:'whole'},
  deposit:{resource:'id',x:'nonnegative',y:'nonnegative',amount:'whole'},
  itemDrop:{item:'id',x:'nonnegative',y:'nonnegative'},
  patch:{terrain:'id',x:'integer',y:'integer',width:'whole',height:'whole'},
  objective:{...named,type:'enum:eliminate|stockpile|survive',target:'id',amount:'nonnegative'}
 };
 const kinds:LWRTSData.Kind[]=['resources','factions','units','buildings','items','technologies','abilities','terrain','missions'];
 const catalogSpec:Spec={format:'enum:wildlands-rts',schemaVersion:'enum-number:1',id:'id',name:'text',...Object.fromEntries(kinds.map(kind=>[kind,'list:'+kind]))};
 function dataOnly(value:unknown):void {
  let count=0;const ancestors=new Set<object>();
  function visit(entry:unknown,depth:number):void {
   if(++count>100000||depth>24)fail('content exceeds supported complexity');
   if(entry===null||typeof entry==='boolean'||typeof entry==='string'||(typeof entry==='number'&&Number.isFinite(entry)))return;
   if(!Array.isArray(entry)&&!plain(entry))fail('only plain JSON data is accepted');
   const object=entry as object;
   if(ancestors.has(object)||Object.getOwnPropertySymbols(object).length)fail('cycle or symbol property');
   ancestors.add(object);
   const descriptors=Object.getOwnPropertyDescriptors(object);
   if(Array.isArray(entry)&&(Object.keys(descriptors).length!==entry.length+1||Array.from({length:entry.length},(_,index)=>index).some(index=>!Object.hasOwn(descriptors,String(index)))))fail('sparse or extended array');
   for(const [key,descriptor] of Object.entries(descriptors)) {
    if(Array.isArray(entry)&&key==='length')continue;
    if(['__proto__','constructor','prototype'].includes(key)||!descriptor.enumerable||descriptor.get||descriptor.set)fail('reserved or executable property');
    visit(descriptor.value,depth+1);
   }
   ancestors.delete(object);
  }
  visit(value,0);
 }
 function check(value:unknown,spec:Spec,path:string):void {
  if(typeof spec!=='string') {
   if(!plain(value))fail(path+' must be an object');
   const record=value as RecordData;
   if(Object.keys(record).length!==Object.keys(spec).length)fail(path+' has unknown or missing fields');
   for(const [key,child] of Object.entries(spec)) {
    if(!Object.hasOwn(record,key))fail(path+' is missing '+key);
    check(record[key],child,path+'.'+key);
   }
   return;
  }
  if(spec.startsWith('list:')) {
   if(!Array.isArray(value)||value.length>4096)fail(path+' must be a bounded list');
   const entries=value as unknown[],child=spec.slice(5);
   entries.forEach((entry,index)=>check(entry,specs[child]??child,path+'['+index+']'));
   if(['id','movement','role'].includes(child)&&new Set(entries).size!==entries.length)fail(path+' contains duplicates');
   return;
  }
  if(spec.startsWith('nullable:')) {if(value!==null)check(value,specs[spec.slice(9)]!,path);return;}
  if(spec.startsWith('enum:')) {if(typeof value!=='string'||!spec.slice(5).split('|').includes(value))fail(path+' has unsupported value');return;}
  if(spec==='enum-number:1') {if(value!==1)fail(path+' has unsupported version');return;}
  if(spec==='cost') {
   if(!plain(value))fail(path+' must be a resource map');
   for(const [key,amount] of Object.entries(value as RecordData)) {check(key,'id',path);check(amount,'integer',path+'.'+key);}
   return;
  }
  if(spec==='boolean') {if(typeof value!=='boolean')fail(path+' must be boolean');return;}
  if(['id','text','color'].includes(spec)) {
   if(typeof value!=='string'||!value.trim()||value.length>(spec==='text'?1000:64))fail(path+' must be bounded text');
   const text=value as string;
   if(spec==='id'&&!idPattern.test(text))fail(path+' must be a stable ID');
   if(spec==='color'&&!/^#[0-9a-fA-F]{6}$/.test(text))fail(path+' must be a hex color');
   return;
  }
  if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>1000000)fail(path+' must be a bounded finite number');
  const number=value as number;
  if((spec==='positive'||spec==='whole')&&number<=0)fail(path+' must be positive');
  if((spec==='nonnegative'||spec==='integer')&&number<0)fail(path+' must be nonnegative');
  if((spec==='whole'||spec==='integer')&&!Number.isSafeInteger(number))fail(path+' must be integral');
 }
 function freeze(value:unknown):void {
  if(value===null||typeof value!=='object')return;
  Object.values(value).forEach(freeze);Object.freeze(value);
 }
 function validate(input:unknown):LWRTSData.Catalog {
  dataOnly(input);check(input,catalogSpec,'catalog');
  const catalog=clone(input) as LWRTSData.Catalog;
  const indexes=new Map<LWRTSData.Kind,Set<string>>();
  for(const kind of kinds) {
   const entries=catalog[kind];
   if(!entries.length&&!['items','technologies','abilities'].includes(kind))fail(kind+' must contain at least one definition');
   const ids=new Set(entries.map(entry=>entry.id));
   if(ids.size!==entries.length)fail('duplicate '+kind+' ID');
   indexes.set(kind,ids);
  }
  for(const id of indexes.get('units')!)if(indexes.get('buildings')!.has(id))fail('unit/building archetype ID collision '+id);
  const reference=(kind:LWRTSData.Kind,id:string,label:string):void=>{if(!indexes.get(kind)!.has(id))fail(label+' refers to unknown '+kind+'/'+id);};
  const cost=(values:LWRTSData.Cost,label:string):void=>{for(const id of Object.keys(values))reference('resources',id,label);};
  for(const unit of catalog.units) {cost(unit.cost,unit.id);unit.prerequisites.forEach(id=>reference('technologies',id,unit.id));unit.abilities.forEach(id=>reference('abilities',id,unit.id));}
  for(const building of catalog.buildings) {
   cost(building.cost,building.id);
   if(building.footprint.width>16||building.footprint.height>16)fail(building.id+' footprint exceeds supported size');
   building.produces.forEach(id=>reference('units',id,building.id));
   building.researches.forEach(id=>reference('technologies',id,building.id));
   building.storage.forEach(id=>reference('resources',id,building.id));
  }
  for(const faction of catalog.factions) {
   cost(faction.startingResources,faction.id);
   faction.units.forEach(id=>reference('units',id,faction.id));
   faction.buildings.forEach(id=>reference('buildings',id,faction.id));
   faction.technologies.forEach(id=>reference('technologies',id,faction.id));
   reference('units',faction.ai.preferredUnit,faction.id);
   if(!faction.units.includes(faction.ai.preferredUnit))fail(faction.id+' AI unit is unavailable to faction');
  }
  for(const item of catalog.items) {cost(item.cost,item.id);reference('abilities',item.ability,item.id);}
  for(const ability of catalog.abilities)cost(ability.cost,ability.id);
  for(const tech of catalog.technologies) {
   cost(tech.cost,tech.id);tech.prerequisites.forEach(id=>reference('technologies',id,tech.id));
  }
  const visited=new Set<string>(),active=new Set<string>();
  function visitTech(id:string):void {
   if(active.has(id))fail('cyclic technology prerequisites');
   if(visited.has(id))return;
   active.add(id);catalog.technologies.find(tech=>tech.id===id)!.prerequisites.forEach(visitTech);
   active.delete(id);visited.add(id);
  }
  catalog.technologies.forEach(tech=>visitTech(tech.id));
  for(const mission of catalog.missions) {
   if(mission.width<8||mission.height<8||mission.width>256||mission.height>256)fail(mission.id+' map dimensions must be 8–256');
   reference('factions',mission.playerFaction,mission.id);reference('terrain',mission.defaultTerrain,mission.id);
   if(!mission.spawns.some(spawn=>spawn.faction===mission.playerFaction))fail(mission.id+' must spawn the player faction');
   const inside=(x:number,y:number):void=>{if(x>=mission.width||y>=mission.height)fail(mission.id+' position outside map');};
   for(const spawn of mission.spawns) {
    reference('factions',spawn.faction,mission.id);inside(spawn.x,spawn.y);
    const unit=catalog.units.find(entry=>entry.id===spawn.archetype),building=catalog.buildings.find(entry=>entry.id===spawn.archetype);
    if(!unit&&!building)fail(mission.id+' unknown spawn archetype '+spawn.archetype);
    const faction=catalog.factions.find(entry=>entry.id===spawn.faction)!;
    if(!(unit?faction.units:faction.buildings).includes(spawn.archetype))fail(mission.id+' spawn not permitted for faction');
    if(spawn.count>100)fail(mission.id+' spawn count exceeds limit');
   }
   const actors=mission.spawns.reduce((sum,spawn)=>sum+spawn.count,0);
   if(actors>1000||actors+mission.deposits.length+mission.items.length+catalog.factions.length+1>1200)fail(mission.id+' exceeds entity limit');
   for(const deposit of mission.deposits) {reference('resources',deposit.resource,mission.id);inside(deposit.x,deposit.y);}
   for(const item of mission.items) {reference('items',item.item,mission.id);inside(item.x,item.y);}
   for(const patch of mission.terrain) {
    reference('terrain',patch.terrain,mission.id);inside(patch.x,patch.y);
    if(patch.x+patch.width>mission.width||patch.y+patch.height>mission.height)fail(mission.id+' terrain outside map');
   }
   validatePlacement(catalog,mission);
   for(const objective of mission.objectives) {
    if(objective.type==='eliminate')reference('factions',objective.target,objective.id);
    if(objective.type==='stockpile')reference('resources',objective.target,objective.id);
   }
  }
  freeze(catalog);return catalog;
 }
 function validatePlacement(catalog:LWRTSData.Catalog,mission:LWRTSData.Mission):void {
  const tiles=Array<string>(mission.width*mission.height).fill(mission.defaultTerrain);
  for(const patch of mission.terrain)for(let y=patch.y;y<patch.y+patch.height;y++)for(let x=patch.x;x<patch.x+patch.width;x++)tiles[y*mission.width+x]=patch.terrain;
  const terrain=new Map(catalog.terrain.map(entry=>[entry.id,entry]));
  const buildings:{id:string;x:number;y:number;width:number;height:number}[]=[];
  for(const spawn of mission.spawns) {
   const unit=catalog.units.find(entry=>entry.id===spawn.archetype),building=catalog.buildings.find(entry=>entry.id===spawn.archetype);
   for(let index=0;index<spawn.count;index++) {
    const x=spawn.x+(index%3)*.35,y=spawn.y+Math.floor(index/3)*.35;
    if(x>=mission.width||y>=mission.height)fail(mission.id+' expanded spawn outside map');
    if(unit&&!terrain.get(tiles[Math.floor(y)*mission.width+Math.floor(x)]!)!.passable.includes(unit.movement))fail(mission.id+' unit spawn on incompatible terrain');
    if(!building)continue;
    const width=building.footprint.width,height=building.footprint.height;
    if(x-width/2<0||y-height/2<0||x+width/2>mission.width||y+height/2>mission.height)fail(mission.id+' building footprint outside map');
    for(let row=Math.floor(y-height/2);row<Math.floor(y-height/2)+height;row++)for(let column=Math.floor(x-width/2);column<Math.floor(x-width/2)+width;column++) {
     if(!terrain.get(tiles[row*mission.width+column]!)!.passable.includes('land'))fail(mission.id+' building footprint on incompatible terrain');
    }
    if(buildings.some(other=>Math.abs(other.x-x)<(other.width+width)/2&&Math.abs(other.y-y)<(other.height+height)/2))fail(mission.id+' overlapping building footprints');
    if(mission.deposits.some(node=>Math.abs(node.x-x)<width/2+.5&&Math.abs(node.y-y)<height/2+.5))fail(mission.id+' building footprint overlaps a deposit');
    buildings.push({id:building.id,x,y,width,height});
   }
  }
 }
 const data=validate(root.LWRTSDefinitions??(node?require('./content/rts-demo.json'):undefined));
 const api:LWRTSData.CatalogApi=Object.freeze({data,defaults:data,validate,
  get<K extends LWRTSData.Kind>(kind:K,id:string):LWRTSData.Entry<K>|null {return data[kind].find(entry=>entry.id===id) as LWRTSData.Entry<K>??null;},
  all<K extends LWRTSData.Kind>(kind:K):LWRTSData.Catalog[K] {return data[kind];},
  clone:()=>clone(data)
 });
 root.LWRTSCatalog=api;if(node)module.exports=api;
})(globalThis);
