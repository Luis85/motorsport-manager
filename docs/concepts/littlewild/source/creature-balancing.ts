/// <reference path="./content-contracts.d.ts" />
/* Archetype identity/visual/ECS grammar belongs to asset folders; this overlay tunes numeric seed data. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWContent:LWContentPorts.ContentApi;LWCreatureBalancing?:{merge(base:LWContentPorts.Resources['creatures'],overlay:unknown):LWContentPorts.Resources['creatures']}};
 const C=root.LWContent,record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
 function merge(base:LWContentPorts.Resources['creatures'],input:unknown):LWContentPorts.Resources['creatures']{
  const overlay=C.parse(input,2*1024*1024),catalog=C.copy(base);
  if(!record(overlay)||Object.keys(overlay).length!==3||overlay.format!=='littlewild-creature-balancing'||overlay.schemaVersion!==1||!Array.isArray(overlay.definitions)||overlay.definitions.length>32)throw Error('Invalid creature balancing overlay.');
  const seen=new Set<string>();
  function tune(target:Record<string,unknown>,patch:Record<string,unknown>,path:string):void{
   for(const [key,value]of Object.entries(patch)){
    if(!Object.hasOwn(target,key))throw Error('Unknown creature balancing field '+path+'/'+key);
    if(typeof value==='number'||typeof value==='boolean'){
     if(typeof target[key]!==typeof value)throw Error('Creature balancing type differs at '+path+'/'+key);target[key]=value;
    }else if(record(value)&&record(target[key]))tune(target[key],value,path+'/'+key);
    else throw Error('Creature balancing may tune only numeric and Boolean seed fields: '+path+'/'+key);
   }
  }
  for(const definition of overlay.definitions){
   if(!record(definition)||typeof definition.id!=='string'||seen.has(definition.id)||Object.keys(definition).some(key=>!['id','movement','physiology','rng','state'].includes(key)))throw Error('Invalid creature balancing definition.');
   seen.add(definition.id);const target=catalog.definitions.find(d=>record(d)&&d.id===definition.id);if(!record(target))throw Error('Creature balancing references an unauthored archetype: '+definition.id);
   for(const group of ['movement','physiology','rng','state'])if(Object.hasOwn(definition,group)){
    if(!record(definition[group])||!record(target[group]))throw Error('Invalid creature balancing group.');tune(target[group],definition[group],'/creatures/'+definition.id+'/'+group);
   }
  }
  return catalog;
 }
 const api=Object.freeze({merge});root.LWCreatureBalancing=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
