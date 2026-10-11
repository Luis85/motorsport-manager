/// <reference path="./image-data.ts" />
/** View-local GPU ownership for admitted static Three graphs. No global cache or network loading. */
namespace LWVisualResourceContract {
 export interface Disposable {dispose():void;}
 export interface Tree {traverse(visitor:(object:any)=>void):void;}
 export interface Parsed {object:any;resources:Disposable[];}
 export interface Api {
  disposeTrees(trees:readonly Tree[],extras?:readonly Disposable[]):void;
  parseObject(three:any,json:any):Parsed;
 }
}
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWImageData:LWImageDataContract.Api;LWVisualResources?:LWVisualResourceContract.Api};
 function disposeTrees(trees:readonly LWVisualResourceContract.Tree[],extras:readonly LWVisualResourceContract.Disposable[]=[]):void {
  const owned=new Set<LWVisualResourceContract.Disposable>();
  function resource(value:any):void {
   if(!value||typeof value.dispose!=='function'||owned.has(value))return;
   owned.add(value);
   if(value.isMaterial)for(const property of Object.values(value))if((property as any)?.isTexture)resource(property);
  }
  for(const value of extras)resource(value);
  for(const tree of trees)tree.traverse((object:any)=>{
   resource(object.geometry);
   for(const material of Array.isArray(object.material)?object.material:[object.material])resource(material);
  });
  const failures:unknown[]=[];
  for(const value of owned)try{value.dispose();}catch(error){failures.push(error);}
  if(failures.length)throw new AggregateError(failures,'Visual resource disposal failed');
 }
 /** Caller admits the complete JSON first. Typed image records cannot invoke an image decoder.
  * Staging one resource at a time retains ownership if a later Three parse step throws. */
 function parseObject(T:any,json:any):LWVisualResourceContract.Parsed {
  const parser=new T.ObjectLoader(),resources:LWVisualResourceContract.Disposable[]=[];
  const geometries:Record<string,any>={},textures:Record<string,any>={},materials:Record<string,any>={};
  const retain=(target:Record<string,any>,parsed:Record<string,any>)=>{
   for(const [id,value] of Object.entries(parsed)){target[id]=value;resources.push(value);}
  };
  try {
   for(const geometry of json.geometries)retain(geometries,parser.parseGeometries([geometry],{}));
   const images:Record<string,any>={};
   for(const image of json.images??[]){
    const value=image.url;
    // Defensive at realization too: never hand untrusted image strings to ObjectLoader.
    if(!value||typeof value!=='object'||Array.isArray(value)||value.type!=='Uint8Array'||value.width!==128||value.height!==128)throw Error('Expected admitted inline RGBA image');
    images[image.uuid]=new T.Source({data:root.LWImageData.decodeRGBA(value.data,value.encoding),width:value.width,height:value.height});
   }
   for(const texture of json.textures??[])retain(textures,parser.parseTextures([texture],images));
   for(const material of json.materials)retain(materials,parser.parseMaterials([material],textures));
   return {object:parser.parseObject(json.object,geometries,materials,textures,{}),resources};
  }catch(error){
   try{disposeTrees([],resources);}catch(cleanup){throw new AggregateError([error,cleanup],'Visual resource construction failed');}
   throw error;
  }
 }
 const api=Object.freeze({disposeTrees,parseObject});root.LWVisualResources=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
