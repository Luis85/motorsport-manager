/// <reference path="./animation-data-contracts.d.ts" />
/* Pure preset descriptors. Domain validation sees IDs and bounds, never executable draw callbacks. */
(function(inputRoot:unknown){
 'use strict';
 type Entry=LWAnimations.Metadata&{readonly parameters:readonly {readonly key:string;readonly min?:number;readonly max?:number}[]};
 const root=inputRoot as {LWAnimationCatalog?:{list():readonly Entry[]};LWAnimationCatalogRecords?:{add(metadata:LWAnimations.Metadata):()=>void};};
 const parameters=Object.freeze([{key:'x',min:-10000,max:10000},{key:'y',min:-10000,max:10000},{key:'radius',min:1,max:1000},{key:'count',min:1,max:128},{key:'color'},{key:'seed',min:0,max:4294967295}].map(value=>Object.freeze(value))),entries=new Map<string,Entry>();
 function add(metadata:LWAnimations.Metadata):()=>void{const entry=Object.freeze({...metadata,parameters});entries.set(entry.id,entry);return()=>{if(entries.get(entry.id)===entry)entries.delete(entry.id);};}
 for(const [id,name] of [['sparkles','Sparkles'],['orbit','Orbit'],['ripple','Ripple']])add({id:id!,name:name!,description:'Deterministic p5 presentation preset.',source:'source/renderer-animations.ts'});
 root.LWAnimationCatalog={list:()=>Object.freeze([...entries.values()])};root.LWAnimationCatalogRecords={add};
})(globalThis);
