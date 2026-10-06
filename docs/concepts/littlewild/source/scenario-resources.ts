/// <reference path="./content-contracts.d.ts" />
/* Executable-free catalogs form one reversible context; simulation never loads authored code. */
(function(inputRoot:unknown){
 'use strict';
 type Resources=LWContentPorts.Resources;
 interface Assets {readonly defaults:readonly unknown[];all():readonly unknown[];replace(input:unknown):void;withDefinitions<T>(input:unknown,work:()=>T):T;actor(id:string):{behaviors?:{appearances?:Record<string,unknown>}}|null;building(id:string):unknown;item(id:string):unknown;}
 interface Creatures {readonly defaults:Resources['creatures'];readonly configuration:unknown;all():readonly {id:string;visualAsset:string;personalities:readonly string[]}[];replace(input:unknown):void;withDefinitions<T>(input:unknown,work:()=>T):T;}
 interface Constructor extends Function {prototype:Record<string,unknown>;import(input:unknown):unknown;}
 interface Root {LWAssets?:Assets;LWCreatures?:Creatures;LWContent:LWContentPorts.ContentApi;LWScenarioResources?:typeof api;}
 const root=inputRoot as Root,node=typeof module!=='undefined'&&module.exports;
 const C=(node?require('./content-runtime.js'):root.LWContent) as LWContentPorts.ContentApi;
 const assets=(node?require('./asset-catalog.js'):root.LWAssets) as Assets,creatures=(node?require('./creature-catalog.js'):root.LWCreatures) as Creatures;
 function snapshot():Resources{return C.copy({assets:[...assets.all()],creatures:{configuration:creatures.configuration,definitions:[...creatures.all()]}});}
 const defaults=():Resources=>C.copy({assets:[...assets.defaults],creatures:creatures.defaults});
 function withResources<T>(input:Resources|undefined,work:()=>T):T{
  const resources=input??defaults();
  return assets.withDefinitions(resources.assets,()=>creatures.withDefinitions(resources.creatures,()=>{
   for(const def of creatures.all()){
    const visual=assets.actor(def.visualAsset);
    if(!visual||def.personalities.some(id=>!visual.behaviors?.appearances?.[id]))throw Error('Scenario creature visual/profile missing: '+def.id);
   }
   return work();
  }));
 }
 function validate(input:unknown):Resources{
  const value=C.copy(input);
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==2||!Object.hasOwn(value,'assets')||!Object.hasOwn(value,'creatures'))throw Error('Scenario resources need complete assets and creatures catalogs.');
  const resources=value as Resources;
  withResources(resources,()=>undefined);return resources;
 }
 function apply(input:Resources|undefined):void{
  const next=input??defaults();withResources(next,()=>undefined);
  const previous=snapshot();try{assets.replace(next.assets);creatures.replace(next.creatures);}catch(error){assets.replace(previous.assets);creatures.replace(previous.creatures);throw error;}
 }
 function checkBindings(resources:Resources|undefined,libraries:LWContentPorts.Libraries):void{
  if(!resources)return;
  withResources(resources,()=>{
   for(const b of libraries.base.components.buildings)if(!assets.building(b.id))throw Error('Scenario is missing building visual: '+b.id);
   for(const id of [...libraries.base.components.items.map(i=>i.id),...libraries.adventure.equipment.map(e=>e.id)])if(!assets.item(id))throw Error('Scenario is missing item visual: '+id);
   for(const def of creatures.all())for(const id of def.personalities)if(!libraries.adventure.personalities.some(p=>p.id===id))throw Error('Scenario creature personality missing: '+id);
  });
 }
 function install(Engine:Constructor):void{
  const exporter=Engine.prototype.export as (this:unknown,...args:unknown[])=>{state:Record<string,unknown>};
  Engine.prototype.export=function(this:unknown,...args:unknown[]){
   const doc=exporter.apply(this,args),state=doc.state;
   // The resource envelope is serialized last, after lazy native owners. Only the detached export changes.
   if(Object.hasOwn(state,'scenarioResources')){const resources=state.scenarioResources;delete state.scenarioResources;state.scenarioResources=resources;}
   return doc;
  };
  const importer=Engine.import;
  Engine.import=function(input:unknown):unknown{
   const doc=C.parse(input,12*1024*1024) as {state?:{scenarioResources?:Resources}};
   if(!doc?.state?.scenarioResources)return Reflect.apply(importer,this,[doc]);
   const resources=validate(doc.state.scenarioResources);
   return withResources(resources,()=>Reflect.apply(importer,this,[doc]));
  };
 }
 const api=Object.freeze({snapshot,defaults,validate,withResources,apply,checkBindings,install});root.LWScenarioResources=api;if(node)module.exports=api;
})(globalThis);
