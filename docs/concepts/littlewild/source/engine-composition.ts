/* Explicit composition root support for the Littlewild simulation facade.
 * Feature modules register data-only layer descriptors; no module replaces LW.Engine.
 * Finalization installs a deterministic method chain and constructor lifecycle once.
 */
(function(inputRoot: unknown){
 'use strict';

 type DataRecord=Record<PropertyKey,unknown>;
 type CompositionOptions=Record<PropertyKey,unknown>;
 interface EngineInstance extends DataRecord { s:unknown; state?:unknown; }
 interface DynamicConstructor extends Function {
  new(state?:unknown,options?:CompositionOptions):EngineInstance;
  prototype:DataRecord;
 }
 interface LayerSpec {
  id:string;
  order:number;
  define(Base:DynamicConstructor):DynamicConstructor;
  prepare?:(state:unknown,options:CompositionOptions)=>unknown;
  initialize?:(instance:EngineInstance,state:unknown,options:CompositionOptions)=>void;
  decorate?:(Layer:DynamicConstructor,Base:DynamicConstructor,Facade:DynamicConstructor)=>void;
  installFactories?:(context:FactoryContext)=>void;
 }
 interface FactoryContext { L:LittlewildFacade; Engine:DynamicConstructor; composition:CompositionApi; }
 interface CompositionDescription { finalized:boolean; layers:readonly {id:string;order:number}[]; }
 interface CompositionApi {
  register(spec:LayerSpec):LayerSpec;
  finalize(ids:readonly string[]):DynamicConstructor;
  prepare(state:unknown,options?:CompositionOptions):unknown;
  initialize(instance:EngineInstance,state:unknown,options?:CompositionOptions):EngineInstance;
  constructThrough(id:string,state?:unknown,options?:CompositionOptions):EngineInstance;
  describe():Readonly<CompositionDescription>;
  readonly finalized:boolean;
  readonly Engine:DynamicConstructor;
 }
 interface ActorStateViewApi { rootOf(value:unknown):unknown; }
 interface LittlewildFacade { Engine:DynamicConstructor; EngineComposition?:CompositionApi; }
 interface LittlewildRoot { LW?:LittlewildFacade; LWActorStateView?:ActorStateViewApi; LWEngineComposition?:CompositionApi; }
 const root=inputRoot as LittlewildRoot;
 const facadeRoot=root.LW;
 if(!facadeRoot?.Engine)throw Error('Engine composition requires the base engine.');
 const L:LittlewildFacade=facadeRoot,Facade:DynamicConstructor=L.Engine;
 const specs=new Map<string,Readonly<LayerSpec>>(),classes=new Map<string,DynamicConstructor>(),instances=new WeakSet<object>(),THROUGH=Symbol('littlewild.engine.through');
 let ordered:Readonly<LayerSpec>[]=[],finalized=false;
 const forbiddenStatic=new Set(['length','name','prototype','arguments','caller']);
 const copyDescriptor=(target:object,name:PropertyKey,descriptor:PropertyDescriptor):void=>{Object.defineProperty(target,name,descriptor);};
 function restoreDescriptors(target:object,before:PropertyDescriptorMap):void{
  for(const name of Reflect.ownKeys(target))if(!Object.hasOwn(before,name))Reflect.deleteProperty(target,name);
  Object.defineProperties(target,before);
 }
 function assertId(id:unknown):asserts id is string{if(typeof id!=='string'||!/^[a-z][a-z0-9-]{1,47}$/.test(id))throw Error('Invalid engine layer ID.');}
 function register(spec:LayerSpec):LayerSpec{
  if(finalized)throw Error('Engine composition is already finalized.');
  if(!spec||typeof spec!=='object')throw Error('Invalid engine layer.');
  assertId(spec.id);if(specs.has(spec.id))throw Error('Duplicate engine layer: '+spec.id);
  if(!Number.isInteger(spec.order)||spec.order<0||spec.order>1000)throw Error('Invalid engine layer order.');
  if(typeof spec.define!=='function')throw Error('Engine layer '+spec.id+' requires define().');
  for(const hook of ['prepare','initialize','decorate','installFactories'] as const)
   if(spec[hook]!==undefined&&typeof spec[hook]!=='function')throw Error('Invalid '+hook+' hook for '+spec.id+'.');
  specs.set(spec.id,Object.freeze({...spec}));return spec;
 }
 function methodForwarder(descriptor:PropertyDescriptor):PropertyDescriptor{
  const out:PropertyDescriptor={configurable:true,enumerable:!!descriptor.enumerable};
  if(typeof descriptor.value==='function'){
   const method=descriptor.value as (...args:unknown[])=>unknown;
   out.writable=true;out.value=function(this:unknown,...args:unknown[]){return Reflect.apply(method,this,args);};
  } else if('value'in descriptor){out.writable=true;out.value=descriptor.value;}
  if(descriptor.get){const getter=descriptor.get;out.get=function(this:unknown){return Reflect.apply(getter,this,[]);};}
  if(descriptor.set){const setter=descriptor.set;out.set=function(this:unknown,value:unknown){Reflect.apply(setter,this,[value]);};}
  return out;
 }
 function adapterFor():DynamicConstructor{
  const LayerBase=class extends Facade{};
  for(const [name,descriptor]of Object.entries(Object.getOwnPropertyDescriptors(Facade.prototype))){
   if(name==='constructor')continue;copyDescriptor(LayerBase.prototype,name,methodForwarder(descriptor));
  }
  for(const [name,descriptor]of Object.entries(Object.getOwnPropertyDescriptors(Facade))){
   if(forbiddenStatic.has(name))continue;copyDescriptor(LayerBase,name,methodForwarder(descriptor));
  }
  return LayerBase as DynamicConstructor;
 }
 function install(spec:Readonly<LayerSpec>):void{
  const Base=adapterFor(),Layer=spec.define(Base);
  if(typeof Layer!=='function'||!(Layer.prototype instanceof Base))throw Error('Layer '+spec.id+' must extend the supplied base.');
  if(spec.decorate)spec.decorate(Layer,Base,Facade);
  classes.set(spec.id,Layer);
  const instanceDescriptors=Object.getOwnPropertyDescriptors(Layer.prototype);
  for(const [name,descriptor]of Object.entries(instanceDescriptors))if(name!=='constructor')copyDescriptor(Facade.prototype,name,{...descriptor,configurable:true});
  const staticDescriptors=Object.getOwnPropertyDescriptors(Layer);
  for(const [name,descriptor]of Object.entries(staticDescriptors))if(!forbiddenStatic.has(name))copyDescriptor(Facade,name,{...descriptor,configurable:true});
 }
 function finalize(ids:readonly string[]):DynamicConstructor{
  if(finalized)return Facade;
  if(!Array.isArray(ids)||ids.length!==specs.size)throw Error('Composition root must name every engine layer exactly once.');
  const seen=new Set<string>();
  const proposed=ids.map(id=>{if(seen.has(id)||!specs.has(id))throw Error('Unknown or duplicate engine layer: '+id);seen.add(id);return specs.get(id)!;});
  const sorted=[...proposed].sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));
  if(sorted.some((spec,index)=>spec!==proposed[index]))throw Error('Composition root order does not match declared layer order.');
  const prior=ordered,prototypeDescriptors=Object.getOwnPropertyDescriptors(Facade.prototype),
   staticDescriptors=Object.getOwnPropertyDescriptors(Facade),facadeDescriptors=Object.getOwnPropertyDescriptors(L);
  ordered=proposed;
  try{
   for(const spec of ordered)install(spec);
   finalized=true;
   for(const spec of ordered)if(spec.installFactories)spec.installFactories({L,Engine:Facade,composition:api});
   Object.defineProperty(Facade,'composition',{configurable:false,enumerable:true,value:Object.freeze({layers:Object.freeze(ordered.map(spec=>spec.id))})});
  }catch(error){
   // A retry must start from the original facade, including predecessor methods and factories.
   finalized=false;ordered=prior;classes.clear();
   restoreDescriptors(Facade.prototype,prototypeDescriptors);restoreDescriptors(Facade,staticDescriptors);restoreDescriptors(L,facadeDescriptors);
   throw error;
  }
  return Facade;
 }
 function limit(options:CompositionOptions={}):number{
  const id=options[THROUGH];
  if(id===undefined)return ordered.length;
  if(id==='base')return 0;
  if(typeof id!=='string')throw Error('Invalid engine composition boundary.');
  const index=ordered.findIndex(spec=>spec.id===id);
  if(index<0)throw Error('Unknown engine composition boundary: '+id);
  return index+1;
 }
 function prepare(state:unknown,options:CompositionOptions={}):unknown{
  if(!finalized)return state;
  let value=root.LWActorStateView?.rootOf(state)??state;const count=limit(options);
  for(let i=count-1;i>=0;i--){const fn=ordered[i]?.prepare;if(fn){const next=fn(value,options);if(next!==undefined)value=next;}}
  return value;
 }
 function initialize(instance:EngineInstance,state:unknown,options:CompositionOptions={}):EngineInstance{
  if(!finalized||instances.has(instance))return instance;
  instances.add(instance);const count=limit(options),active=ordered.slice(0,count);
  instance.state=instance.s;
  for(const spec of active)if(spec.initialize)spec.initialize(instance,state,options);
  const layers=Object.freeze(active.map(spec=>spec.id));
  Object.defineProperty(instance,'composition',{configurable:false,enumerable:false,value:Object.freeze({layers,state:instance.state})});
  return instance;
 }
 function constructThrough(id:string,state?:unknown,options:CompositionOptions={}):EngineInstance{
  if(!finalized)throw Error('Engine composition is not finalized.');
  if(id!=='base'&&!classes.has(id))throw Error('Unknown engine composition boundary: '+id);
  const Target=id==='base'?Facade:classes.get(id)!;
  const settings:CompositionOptions={...options};
  Object.defineProperty(settings,THROUGH,{value:id,enumerable:false});
  return new Target(state,settings);
 }
 function describe():Readonly<CompositionDescription>{return Object.freeze({finalized,layers:Object.freeze(ordered.map(spec=>({id:spec.id,order:spec.order})))});}
 const api:CompositionApi=Object.freeze({register,finalize,prepare,initialize,constructThrough,describe,get finalized(){return finalized;},Engine:Facade});
 L.EngineComposition=api;root.LWEngineComposition=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
