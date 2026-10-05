/// <reference path="./rts-contracts.d.ts" />
/** Inert intent admission and canonical terrain projection for mission authoring. */
declare namespace LWRTSMissionEditorData {
 interface Api {
  admit(input:unknown):Record<string,unknown>;
  paint(mission:LWRTSData.Mission,patch:LWRTSData.TerrainPatch):LWRTSData.TerrainPatch[];
 }
}
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWRTSMissionEditorData?:LWRTSMissionEditorData.Api};
 function admit(input:unknown):Record<string,unknown> {
  let entries=0;
  const ancestors=new Set<object>();
  function visit(value:unknown,depth:number):void {
   if(++entries>110000||depth>26)throw Error('Editor intent exceeds supported complexity.');
   if(value===null||typeof value==='boolean')return;
   if(typeof value==='string'){
    if(value.length>1000)throw Error('Editor text exceeds supported length.');
    return;
   }
   if(typeof value==='number'&&Number.isFinite(value))return;
   if(typeof value!=='object'||value===null)throw Error('Editor intent accepts only plain JSON data.');
   const array=Array.isArray(value);
   if(array&&Object.getPrototypeOf(value)!==Array.prototype)throw Error('Editor intent accepts only ordinary JSON arrays.');
   if(!array&&![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error('Editor intent accepts only plain objects.');
   if(ancestors.has(value)||Object.getOwnPropertySymbols(value).length)throw Error('Editor intent contains a cycle or symbol.');
   ancestors.add(value);
   const descriptors=Object.getOwnPropertyDescriptors(value);
   if(array){
    const list=value as unknown[];
    if(list.length>4096||Object.keys(descriptors).length!==list.length+1)throw Error('Editor intent has an extended or oversized array.');
    for(let index=0;index<list.length;index++)if(!Object.hasOwn(descriptors,String(index)))throw Error('Editor intent has a sparse array.');
   }
   for(const [key,descriptor] of Object.entries(descriptors)){
    if(array&&key==='length')continue;
    if(['__proto__','constructor','prototype'].includes(key)||!descriptor.enumerable||descriptor.get||descriptor.set)throw Error('Editor intent contains executable or reserved properties.');
    visit(descriptor.value,depth+1);
   }
   ancestors.delete(value);
  }
  visit(input,0);
  if(input===null||typeof input!=='object'||Array.isArray(input))throw Error('Choose an editor command object.');
  return JSON.parse(JSON.stringify(input)) as Record<string,unknown>;
 }
 function paint(mission:LWRTSData.Mission,patch:LWRTSData.TerrainPatch):LWRTSData.TerrainPatch[] {
  const {x,y,width,height}=patch;
  if(![x,y,width,height].every(Number.isSafeInteger)||x<0||y<0||width<1||height<1||x+width>mission.width||y+height>mission.height)throw Error('Paint a whole rectangle inside the map.');
  const tiles=Array<string>(mission.width*mission.height).fill(mission.defaultTerrain);
  for(const rectangle of [...mission.terrain,patch]){
   for(let row=rectangle.y;row<rectangle.y+rectangle.height;row++){
    for(let column=rectangle.x;column<rectangle.x+rectangle.width;column++)tiles[row*mission.width+column]=rectangle.terrain;
   }
  }
  const output:LWRTSData.TerrainPatch[]=[];
  let previous=new Map<string,LWRTSData.TerrainPatch>();
  for(let row=0;row<mission.height;row++){
   const current=new Map<string,LWRTSData.TerrainPatch>();
   let column=0;
   while(column<mission.width){
    const start=column,terrain=tiles[row*mission.width+column]!;
    while(column<mission.width&&tiles[row*mission.width+column]===terrain)column++;
    if(terrain===mission.defaultTerrain)continue;
    const key=terrain+':'+start+':'+(column-start),prior=previous.get(key);
    if(prior){prior.height++;current.set(key,prior);}
    else {
     const rectangle={terrain,x:start,y:row,width:column-start,height:1};
     output.push(rectangle);current.set(key,rectangle);
     if(output.length>4096)throw Error('Terrain exceeds the 4096 patch catalog limit.');
    }
   }
   previous=current;
  }
  return output;
 }
 const api={admit,paint};root.LWRTSMissionEditorData=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
