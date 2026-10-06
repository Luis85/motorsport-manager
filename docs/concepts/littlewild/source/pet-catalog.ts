/// <reference path="./pet-contracts.d.ts" />
/** Strict inert Pocket Pet catalog admission. Values are bounded; references are resolved before use. */
(function(inputRoot:unknown){
 'use strict';
 type Plain=Record<string,unknown>;
 interface Asset {id?:unknown;category?:unknown;models?:unknown;}
 const root=inputRoot as {LWPetCatalog?:LWPetData.CatalogApi;LWPetDefinitions?:unknown;LWPetAssetDefinitions?:unknown};
 const node=typeof module!=='undefined'&&module.exports;
 const fail=(message:string):never=>{throw Error('Pet catalog: '+message);};
 const plain=(v:unknown):v is Plain=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
 const copy=<T>(v:T):T=>JSON.parse(JSON.stringify(v)) as T;
 const ID=/^[a-z][a-z0-9_-]{0,63}$/,NEEDS=['hunger','joy','energy','hygiene'] as const,STAGES=['egg','baby','teen','adult'] as const;
 const KINDS=['feed','treat','play','clean','cuddle','medicine'],SLOTS=['hat','face','neck','back'],EFFECTS=[...NEEDS,'health'];
 function fields(value:unknown,keys:readonly string[],path:string):Plain{
  if(!plain(value))fail(path+' must be an object');
  const record=value as Plain;
  for(const key of Object.keys(record))if(!keys.includes(key))fail(path+' has unknown field '+key);
  for(const key of keys)if(!Object.hasOwn(record,key))fail(path+' is missing '+key);
  return record;
 }
 function id(value:unknown,path:string):string{if(typeof value!=='string'||!ID.test(value))fail(path+' must be a lowercase ID');return value as string;}
 function text(value:unknown,path:string,max=240):string{if(typeof value!=='string'||!value.trim()||[...value].length>max)fail(path+' must be text up to '+max+' characters');return value as string;}
 function num(value:unknown,path:string,min:number,max:number):number{
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)fail(path+' must be a number from '+min+' to '+max);return value as number;
 }
 function list(value:unknown,path:string,min:number,max:number):unknown[]{
  if(!Array.isArray(value)||value.length<min||value.length>max)fail(path+' must list '+min+'–'+max+' entries');return value as unknown[];
 }
 function unique(values:readonly string[],path:string):void{if(new Set(values).size!==values.length)fail(path+' IDs must be unique');}
 function spot(value:unknown,path:string):void{const s=fields(value,['x','z'],path);num(s.x,path+'.x',-2.2,2.2);num(s.z,path+'.z',-2.2,2.2);}
 /** Optional presentation cross-check: pet assets are bundled beside the catalog in the browser build. */
 function assets():Map<string,Set<string>>|null{
  const raw=root.LWPetAssetDefinitions??(node?(():unknown=>{try{return require('./pet-asset-definitions.json') as unknown;}catch{return undefined;}})():undefined);
  if(!Array.isArray(raw))return null;
  return new Map((raw as Asset[]).filter(a=>a&&a.category==='pet'&&typeof a.id==='string'&&plain(a.models)).map(a=>[a.id as string,new Set(Object.keys(a.models as Plain))]));
 }
 function validate(input:unknown):LWPetData.Catalog{
  let data:unknown;try{data=copy(input);}catch{fail('must be JSON data');}
  const catalog=fields(data,['format','schemaVersion','id','name','description','rules','scene','needs','species','stages','actions','economy','skins','items'],'catalog');
  if(catalog.format!=='wildlands-pet'||catalog.schemaVersion!==1)fail('unsupported format');
  id(catalog.id,'id');text(catalog.name,'name',80);text(catalog.description,'description',600);
  const rules=fields(catalog.rules,['minutesPerSecond','startHour','maxWeight','minWeight','startWeight','messHygienePerHour','maxMesses','sleepEnergyPerHour','wakeEnergy','snackLimit','snackWindowMinutes','sickHygieneBelow','sickAfterMinutes','healthLossPerHour','healthGainPerHour','sickHealthLossPerHour','mistakeAfterMinutes','lightsOnSleepJoyPerHour','eggWarmMinutes'],'rules');
  num(rules.minutesPerSecond,'rules.minutesPerSecond',.1,60);num(rules.startHour,'rules.startHour',0,23.99);
  const minWeight=num(rules.minWeight,'rules.minWeight',1,99),maxWeight=num(rules.maxWeight,'rules.maxWeight',minWeight,999);
  num(rules.startWeight,'rules.startWeight',minWeight,maxWeight);num(rules.maxMesses,'rules.maxMesses',0,8);
  if(!Number.isInteger(rules.maxMesses)||!Number.isInteger(rules.snackLimit))fail('rules counts must be whole numbers');
  num(rules.snackLimit,'rules.snackLimit',1,20);num(rules.wakeEnergy,'rules.wakeEnergy',10,100);num(rules.sickHygieneBelow,'rules.sickHygieneBelow',0,100);
  for(const key of ['messHygienePerHour','sleepEnergyPerHour','healthLossPerHour','healthGainPerHour','sickHealthLossPerHour','lightsOnSleepJoyPerHour'])num(rules[key],'rules.'+key,0,500);
  num(rules.eggWarmMinutes,'rules.eggWarmMinutes',0,240);
  for(const key of ['snackWindowMinutes','sickAfterMinutes','mistakeAfterMinutes'])num(rules[key],'rules.'+key,1,1440);
  const needs=list(catalog.needs,'needs',4,4).map((value,i)=>{
   const need=fields(value,['id','name','description','start','decayPerHour','sleepFactor','warnBelow'],'needs['+i+']');
   if(!NEEDS.includes(need.id as typeof NEEDS[number]))fail('needs['+i+'] must be one of '+NEEDS.join(', '));
   text(need.name,'needs['+i+'].name',40);text(need.description,'needs['+i+'].description');num(need.start,'needs['+i+'].start',0,100);
   num(need.decayPerHour,'needs['+i+'].decayPerHour',0,500);num(need.sleepFactor,'needs['+i+'].sleepFactor',0,2);num(need.warnBelow,'needs['+i+'].warnBelow',0,100);
   return need.id as string;
  });
  unique(needs,'needs');
  const index=assets();
  const species=list(catalog.species,'species',1,16).map((value,i)=>{
   const entry=fields(value,['id','name','description','asset'],'species['+i+']');
   text(entry.name,'species['+i+'].name',40);text(entry.description,'species['+i+'].description');
   return {id:id(entry.id,'species['+i+'].id'),asset:id(entry.asset,'species['+i+'].asset')};
  });
  unique(species.map(s=>s.id),'species');
  const stages=list(catalog.stages,'stages',4,4).map((value,i)=>{
   const stage=fields(value,['id','name','minutes','decayFactor','models'],'stages['+i+']');
   if(stage.id!==STAGES[i])fail('stages must be '+STAGES.join(', ')+' in order');
   text(stage.name,'stages['+i+'].name',40);num(stage.decayFactor,'stages['+i+'].decayFactor',0,5);
   num(stage.minutes,'stages['+i+'].minutes',i===3?0:1,i===3?0:100000);
   let previous=-1;
   const forms=list(stage.models,'stages['+i+'].models',1,6).map((form,j)=>{
    const f=fields(form,['id','name','model','maxMistakes','description'],'stages['+i+'].models['+j+']');
    id(f.id,'form id');text(f.name,'form name',40);text(f.description,'form description');
    if(typeof f.model!=='string'||!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(f.model))fail('form model must be an asset model name');
    const limit=num(f.maxMistakes,'form maxMistakes',0,999);if(!Number.isInteger(limit)||limit<=previous)fail('stage '+String(stage.id)+' forms must have increasing whole maxMistakes');previous=limit;
    return f.model as string;
   });
   if(previous!==999)fail('stage '+String(stage.id)+' needs a final form with maxMistakes 999');
   return forms;
  });
  if(index)for(const s of species){
   const models=index.get(s.asset);if(!models)throw Error('Pet catalog: species '+s.id+' references a missing pet asset '+s.asset);
   for(const model of stages.flat())if(!models.has(model))fail('pet asset '+s.asset+' has no model '+model);
  }
  const scene=fields(catalog.scene,['room','bed','mess','sparkle','pet','bedSpot','messSpots'],'scene');
  for(const key of ['room','bed','mess','sparkle']){const asset=id(scene[key],'scene.'+key);if(index&&!index.get(asset)?.has('world'))fail('scene.'+key+' references a missing world model '+asset);}
  for(const key of ['pet','bedSpot'])spot(scene[key],'scene.'+key);
  list(scene.messSpots,'scene.messSpots',rules.maxMesses as number,8).forEach((value,i)=>spot(value,'scene.messSpots['+i+']'));
  const actions=list(catalog.actions,'actions',1,24).map((value,i)=>{
   const action=fields(value,['id','name','description','kind','prop','minutes','coins','effects','weight','digestMinutes','stages'],'actions['+i+']');
   if(!Number.isInteger(num(action.coins,'actions['+i+'].coins',0,100)))fail('actions['+i+'].coins must be a whole number');
   text(action.name,'actions['+i+'].name',40);text(action.description,'actions['+i+'].description');
   if(typeof action.kind!=='string'||!KINDS.includes(action.kind))fail('actions['+i+'].kind must be one of '+KINDS.join(', '));
   const prop=id(action.prop,'actions['+i+'].prop');if(index&&!index.get(prop)?.has('world'))fail('actions['+i+'] references a missing prop '+prop);
   num(action.minutes,'actions['+i+'].minutes',1,240);num(action.weight,'actions['+i+'].weight',-5,5);num(action.digestMinutes,'actions['+i+'].digestMinutes',0,600);
   if(!plain(action.effects))fail('actions['+i+'].effects must be an object');
   for(const [key,amount] of Object.entries(action.effects as Plain)){if(!EFFECTS.includes(key))fail('actions['+i+'] has unknown effect '+key);num(amount,'actions['+i+'].effects.'+key,-100,100);}
   const allowed=list(action.stages,'actions['+i+'].stages',1,4);
   if(allowed.some(stage=>!STAGES.includes(stage as typeof STAGES[number])))fail('actions['+i+'] lists an unknown stage');unique(allowed as string[],'actions['+i+'].stages');
   return id(action.id,'actions['+i+'].id');
  });
  unique(actions,'actions');
  const economy=fields(catalog.economy,['currency','startCoins','growthCoins','maxCoins'],'economy');
  text(economy.currency,'economy.currency',24);
  const maxCoins=num(economy.maxCoins,'economy.maxCoins',1,1e6);
  for(const key of ['startCoins','growthCoins']){if(!Number.isInteger(num(economy[key],'economy.'+key,0,maxCoins)))fail('economy.'+key+' must be a whole number');}
  if(!Number.isInteger(maxCoins))fail('economy.maxCoins must be a whole number');
  const speciesIds=new Set(species.map(s=>s.id));
  function price(value:unknown,path:string):void{
   const record=plain(value)?value:fail(path+' must be an object');
   if(record.currency==='coins'){fields(record,['currency','amount'],path);if(!Number.isInteger(num(record.amount,path+'.amount',0,maxCoins)))fail(path+'.amount must be a whole number');}
   else if(record.currency==='premium'){fields(record,['currency','sku'],path);if(typeof record.sku!=='string'||!/^[a-z][a-z0-9_.-]{2,63}$/.test(record.sku))fail(path+'.sku must be a store product ID');}
   else fail(path+'.currency must be coins or premium');
  }
  const skins=list(catalog.skins,'skins',1,32).map((value,i)=>{
   const skin=fields(value,['id','name','description','species','materials','price'],'skins['+i+']');
   text(skin.name,'skins['+i+'].name',40);text(skin.description,'skins['+i+'].description');price(skin.price,'skins['+i+'].price');
   const allowed=list(skin.species,'skins['+i+'].species',0,16);if(allowed.some(id=>typeof id!=='string'||!speciesIds.has(id)))fail('skins['+i+'] lists an unknown species');
   if(!plain(skin.materials)||Object.keys(skin.materials).length>12)fail('skins['+i+'].materials must map up to 12 material roles');
   for(const [role,color] of Object.entries(skin.materials as Plain))if(!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(role)||typeof color!=='string'||!/^#[0-9a-f]{6}$/i.test(color))fail('skins['+i+'] has an invalid material '+role);
   return id(skin.id,'skins['+i+'].id');
  });
  const first=(catalog.skins as Plain[])[0]!;
  if(Object.keys(first.materials as Plain).length||(first.species as unknown[]).length||(first.price as Plain).currency!=='coins'||(first.price as Plain).amount!==0)fail('the first skin must be the free species default with no material changes');
  const items=list(catalog.items,'items',0,64).map((value,i)=>{
   const item=fields(value,['id','name','description','slot','asset','price'],'items['+i+']');
   text(item.name,'items['+i+'].name',40);text(item.description,'items['+i+'].description');price(item.price,'items['+i+'].price');
   if(typeof item.slot!=='string'||!SLOTS.includes(item.slot))fail('items['+i+'].slot must be one of '+SLOTS.join(', '));
   const asset=id(item.asset,'items['+i+'].asset');if(index&&!index.get(asset)?.has('world'))fail('items['+i+'] references a missing accessory '+asset);
   return id(item.id,'items['+i+'].id');
  });
  unique([...skins,...items],'skin and item product');
  return deepFreeze(data as LWPetData.Catalog);
 }
 function deepFreeze<T>(value:T):T{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))deepFreeze(child);}return value;}
 const raw=root.LWPetDefinitions??(node?require('./content/pet-demo.json') as unknown:undefined);
 const api:LWPetData.CatalogApi=Object.freeze({defaults:validate(raw),validate});
 root.LWPetCatalog=api;
 if(node)module.exports=api;
})(globalThis);
