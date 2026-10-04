/// <reference path="./renderer-contracts.d.ts" />
/* Metadata and executable factories are separate. JSON can describe a renderer, never install one. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWRenderers?:LittlewildRenderer.Registry;LWRendererCatalogRecords:{add(metadata:LittlewildRenderer.Metadata):()=>void}};
 const capabilities:readonly LittlewildRenderer.Capability[]=['camera','hit-test','terrain-preview','construction-preview','resource-lens','interiors'];
 const basic:LittlewildRenderer.Metadata=Object.freeze({id:'basic',name:'Basic',description:'Built-in world renderer with graphics compatibility fallback.',capabilities:Object.freeze([...capabilities])});
 let nextGeneration=0;
 const entries=new Map<string,{metadata:LittlewildRenderer.Metadata;factory:LittlewildRenderer.Factory|LittlewildRenderer.AsyncFactory;async:boolean;generation:number}>();
 function metadata(input:unknown):LittlewildRenderer.Metadata {
  if(!input||typeof input!=='object'||Object.getPrototypeOf(input)!==Object.prototype)throw Error('Renderer metadata must be a plain object.');
  const descriptors=Object.getOwnPropertyDescriptors(input);
  if(Object.getOwnPropertySymbols(input).length||Object.keys(descriptors).some(key=>!['id','name','description','capabilities','dimensions'].includes(key)||descriptors[key]?.get||descriptors[key]?.set))throw Error('Unknown renderer metadata fields or accessors.');
  const value=input as Record<string,unknown>,id=value.id,name=value.name,description=value.description,caps=value.capabilities;
  if(typeof id!=='string'||!/^([a-z][a-z0-9-]{0,63})$/.test(id))throw Error('Renderer ID must use lowercase letters, digits and hyphens (1–64 characters).');
  if(typeof name!=='string'||!name.trim()||[...name].length>80||typeof description!=='string'||[...description].length>400)throw Error('Renderer name/description exceed their bounds.');
  if(!Array.isArray(caps)||Object.getPrototypeOf(caps)!==Array.prototype||caps.length>capabilities.length||Object.getOwnPropertySymbols(caps).length)throw Error('Renderer capabilities must be plain array values.');
  const capDescriptors=Object.getOwnPropertyDescriptors(caps),checked:LittlewildRenderer.Capability[]=[];
  if(Object.keys(capDescriptors).length!==caps.length+1)throw Error('Renderer capabilities must be dense plain array values.');
  for(let index=0;index<caps.length;index++){
   const descriptor=capDescriptors[String(index)];if(!descriptor||!descriptor.enumerable||descriptor.get||descriptor.set)throw Error('Renderer capabilities must be plain array values.');
   const value:unknown=descriptor.value;
   if(typeof value!=='string'||!capabilities.includes(value as LittlewildRenderer.Capability)||checked.includes(value as LittlewildRenderer.Capability))throw Error('Unknown or duplicate renderer capabilities.');
   checked.push(value as LittlewildRenderer.Capability);
  }
  let dimensions:LittlewildRenderer.Dimension[]|undefined;
  if(value.dimensions!==undefined){
   const input=value.dimensions;if(!Array.isArray(input)||Object.getPrototypeOf(input)!==Array.prototype||input.length<1||input.length>2||Object.getOwnPropertySymbols(input).length)throw Error('Renderer dimensions must be a plain bounded array.');
   const descriptors=Object.getOwnPropertyDescriptors(input);if(Object.keys(descriptors).length!==input.length+1)throw Error('Renderer dimensions must be dense.');dimensions=[];
   for(let index=0;index<input.length;index++){const entry=descriptors[String(index)];if(!entry||entry.get||entry.set||!entry.enumerable||(entry.value!=='2d'&&entry.value!=='3d')||dimensions.includes(entry.value))throw Error('Invalid renderer dimension.');dimensions.push(entry.value);}
  }
  return Object.freeze({id,name,description,capabilities:Object.freeze(checked),...(dimensions?{dimensions:Object.freeze(dimensions)}:{})});
 }
 function install(input:LittlewildRenderer.Metadata,factory:LittlewildRenderer.Factory|LittlewildRenderer.AsyncFactory,async:boolean){
  const checked=metadata(input);if(checked.id==='basic'||entries.has(checked.id))throw Error('Renderer ID is already registered.');
  if(typeof factory!=='function')throw Error('Renderer factory must be trusted executable code.');
  const withdraw=root.LWRendererCatalogRecords.add(checked),entry={metadata:checked,factory,async,generation:++nextGeneration};entries.set(checked.id,entry);
  return ()=>{if(entries.get(checked.id)===entry){entries.delete(checked.id);withdraw();}};
 }
 const api:LittlewildRenderer.Registry=Object.freeze({version:1,
  register(input:LittlewildRenderer.Metadata,factory:LittlewildRenderer.Factory){return install(input,factory,false);},
  registerAsync(input:LittlewildRenderer.Metadata,factory:LittlewildRenderer.AsyncFactory){return install(input,factory,true);},
  list(){return Object.freeze([basic,...[...entries.values()].map(entry=>entry.metadata)]);},
  generation(id:string){return id==='basic'?0:entries.get(id)?.generation??null;},
  validate(input:unknown){try{return {ok:true,errors:[],data:metadata(input)};}catch(error){return {ok:false,errors:[String(error instanceof Error?error.message:error)],data:null};}},
  create(id:string,context:LittlewildRenderer.Context){const entry=entries.get(id);if(!entry)throw Error('Unknown renderer: '+id+'.');if(entry.async)throw Error('Renderer requires selectRendererAsync: '+id+'.');return (entry.factory as LittlewildRenderer.Factory)(context);},
  async prepare(id:string,context:LittlewildRenderer.Context){const entry=entries.get(id);if(!entry)throw Error('Unknown renderer: '+id+'.');return entry.factory(context);}
 });
 root.LWRenderers=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
