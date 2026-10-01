/* Explicit composition root support for the Littlewild simulation facade.
 * Feature modules register data-only layer descriptors; no module replaces LW.Engine.
 * Finalization installs a deterministic method chain and constructor lifecycle once.
 */
(function(root){
 'use strict';
 const L=root.LW;
 if(!L?.Engine)throw Error('Engine composition requires the base engine.');
 const Facade=L.Engine,specs=new Map(),classes=new Map(),instances=new WeakSet(),THROUGH=Symbol('littlewild.engine.through');
 let ordered=[],finalized=false;
 const forbiddenStatic=new Set(['length','name','prototype','arguments','caller']);
 const copyDescriptor=(target,name,descriptor)=>Object.defineProperty(target,name,descriptor);
 function assertId(id){if(typeof id!=='string'||!/^[a-z][a-z0-9-]{1,47}$/.test(id))throw Error('Invalid engine layer ID.');}
 function register(spec){
  if(finalized)throw Error('Engine composition is already finalized.');
  if(!spec||typeof spec!=='object')throw Error('Invalid engine layer.');
  assertId(spec.id);if(specs.has(spec.id))throw Error('Duplicate engine layer: '+spec.id);
  if(!Number.isInteger(spec.order)||spec.order<0||spec.order>1000)throw Error('Invalid engine layer order.');
  if(typeof spec.define!=='function')throw Error('Engine layer '+spec.id+' requires define().');
  for(const hook of ['prepare','initialize','decorate','installFactories'])if(spec[hook]!==undefined&&typeof spec[hook]!=='function')throw Error('Invalid '+hook+' hook for '+spec.id+'.');
  specs.set(spec.id,Object.freeze({...spec}));return spec;
 }
 function methodForwarder(descriptor){
  const out={configurable:true,enumerable:!!descriptor.enumerable};
  if(typeof descriptor.value==='function'){out.writable=true;out.value=function(...args){return descriptor.value.apply(this,args);};}
  else if('value'in descriptor){out.writable=true;out.value=descriptor.value;}
  if(descriptor.get)out.get=function(){return descriptor.get.call(this);};
  if(descriptor.set)out.set=function(value){return descriptor.set.call(this,value);};
  return out;
 }
 function adapterFor(){
  class LayerBase extends Facade{}
  for(const [name,descriptor]of Object.entries(Object.getOwnPropertyDescriptors(Facade.prototype))){
   if(name==='constructor')continue;copyDescriptor(LayerBase.prototype,name,methodForwarder(descriptor));
  }
  for(const [name,descriptor]of Object.entries(Object.getOwnPropertyDescriptors(Facade))){
   if(forbiddenStatic.has(name))continue;copyDescriptor(LayerBase,name,methodForwarder(descriptor));
  }
  return LayerBase;
 }
 function install(spec){
  const Base=adapterFor(),Layer=spec.define(Base);
  if(typeof Layer!=='function'||!(Layer.prototype instanceof Base))throw Error('Layer '+spec.id+' must extend the supplied base.');
  if(spec.decorate)spec.decorate(Layer,Base,Facade);
  classes.set(spec.id,Layer);
  const instanceDescriptors=Object.getOwnPropertyDescriptors(Layer.prototype);
  for(const [name,descriptor]of Object.entries(instanceDescriptors))if(name!=='constructor')copyDescriptor(Facade.prototype,name,descriptor);
  const staticDescriptors=Object.getOwnPropertyDescriptors(Layer);
  for(const [name,descriptor]of Object.entries(staticDescriptors))if(!forbiddenStatic.has(name))copyDescriptor(Facade,name,descriptor);
 }
 function finalize(ids){
  if(finalized)return Facade;
  if(!Array.isArray(ids)||ids.length!==specs.size)throw Error('Composition root must name every engine layer exactly once.');
  const seen=new Set();ordered=ids.map(id=>{if(seen.has(id)||!specs.has(id))throw Error('Unknown or duplicate engine layer: '+id);seen.add(id);return specs.get(id);});
  const sorted=[...ordered].sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));
  if(sorted.some((spec,index)=>spec!==ordered[index]))throw Error('Composition root order does not match declared layer order.');
  for(const spec of ordered)install(spec);
  finalized=true;
  for(const spec of ordered)if(spec.installFactories)spec.installFactories({L,Engine:Facade,composition:api});
  Object.defineProperty(Facade,'composition',{configurable:false,enumerable:true,value:Object.freeze({layers:Object.freeze(ordered.map(s=>s.id))})});
  return Facade;
 }
 function limit(options={}){
  const id=options[THROUGH];
  if(id===undefined)return ordered.length;
  if(id==='base')return 0;
  const index=ordered.findIndex(spec=>spec.id===id);
  if(index<0)throw Error('Unknown engine composition boundary: '+String(id));
  return index+1;
 }
 function prepare(state,options){
  if(!finalized)return state;
  let value=root.LWActorStateView?.rootOf(state)??state;const count=limit(options);
  for(let i=count-1;i>=0;i--){const fn=ordered[i].prepare;if(fn){const next=fn(value,options||{});if(next!==undefined)value=next;}}
  return value;
 }
 function initialize(instance,state,options){
  if(!finalized||instances.has(instance))return instance;
  instances.add(instance);const count=limit(options),active=ordered.slice(0,count);
  instance.state=instance.s;
  for(const spec of active)if(spec.initialize)spec.initialize(instance,state,options||{});
  const layers=Object.freeze(active.map(s=>s.id));
  Object.defineProperty(instance,'composition',{configurable:false,enumerable:false,value:Object.freeze({layers,state:instance.state})});
  return instance;
 }
 function constructThrough(id,state,options={}){
  if(!finalized)throw Error('Engine composition is not finalized.');
  if(id!=='base'&&!classes.has(id))throw Error('Unknown engine composition boundary: '+String(id));
  const Target=id==='base'?Facade:classes.get(id),settings={...options};
  Object.defineProperty(settings,THROUGH,{value:id,enumerable:false});
  return new Target(state,settings);
 }
 function describe(){return Object.freeze({finalized,layers:Object.freeze(ordered.map(s=>({id:s.id,order:s.order})))});}
 const api=Object.freeze({register,finalize,prepare,initialize,constructThrough,describe,get finalized(){return finalized;},Engine:Facade});
 L.EngineComposition=api;root.LWEngineComposition=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
