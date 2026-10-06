/// <reference path="./renderer-data-contracts.d.ts" />
/* Domain-facing capability inventory, with no DOM, graphics library or executable factory. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWRendererCatalog?:LittlewildRenderer.Catalog;LWRendererCatalogRecords?:{add(metadata:LittlewildRenderer.Metadata):()=>void};};
 const entries=new Map<string,LittlewildRenderer.Metadata>();
 function add(metadata:LittlewildRenderer.Metadata):()=>void{
  const previous=entries.get(metadata.id),entry=Object.freeze({...metadata,capabilities:Object.freeze([...metadata.capabilities]),...(metadata.dimensions?{dimensions:Object.freeze([...metadata.dimensions])}:{})});
  entries.set(entry.id,entry);return()=>{if(entries.get(entry.id)===entry){if(previous)entries.set(entry.id,previous);else entries.delete(entry.id);}};
 }
 add({id:'basic',name:'Basic',description:'Built-in world renderer with graphics compatibility fallback.',capabilities:['camera','hit-test','terrain-preview','construction-preview','resource-lens','interiors'],dimensions:['2d','3d']});
 for(const [id,name] of [['pixi-2d','PixiJS 2D'],['excalibur-2d','ExcaliburJS 2D']])add({id:id!,name:name!,description:'Built-in library graphics adapter.',capabilities:['camera','hit-test','interiors','terrain-preview','construction-preview'],dimensions:['2d']});
 const api:LittlewildRenderer.Catalog=Object.freeze({list:()=>Object.freeze([...entries.values()])});root.LWRendererCatalog=api;root.LWRendererCatalogRecords={add};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
