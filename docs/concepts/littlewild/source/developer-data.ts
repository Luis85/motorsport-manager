/// <reference path="./developer-contracts.d.ts" />
/* Defensive JSON boundary: inspect descriptors before copying, never invoke imported accessors. */
(function(inputRoot:unknown){
 'use strict';
 type Json=LittlewildDeveloper.Json;
 type Document=LittlewildDeveloper.Document;
 class DeveloperError extends Error implements LittlewildDeveloper.DeveloperError {
  readonly code:LittlewildDeveloper.ErrorCode;
  constructor(code:LittlewildDeveloper.ErrorCode,message:string){super(message);this.name='LittlewildDeveloperError';this.code=code;}
 }
 function fail(message:string):never{throw new DeveloperError('invalid-input',message);}
 function copy(value:unknown):Json {
  const ancestors=new Set<object>();let count=0;
  function visit(entry:unknown,depth:number):Json {
   if(++count>250000||depth>40)fail('Data exceeds the supported 250000 values / 40 levels.');
   if(entry===null||typeof entry==='boolean'||typeof entry==='string')return entry;
   if(typeof entry==='number'&&Number.isFinite(entry))return entry;
   if(typeof entry!=='object'||!entry)fail('Expected finite, plain JSON data.');
   if(ancestors.has(entry)||Object.getOwnPropertySymbols(entry).length)fail('Cycles and symbol properties are not supported.');
   const descriptors=Object.getOwnPropertyDescriptors(entry);
   ancestors.add(entry);
   try {
    if(Array.isArray(entry)){
     if(Object.keys(descriptors).length!==entry.length+1)fail('Expected a dense JSON array.');
     const out:Json[]=[];
     for(let index=0;index<entry.length;index++){
      const descriptor=descriptors[String(index)];
      if(!descriptor||!descriptor.enumerable||descriptor.get||descriptor.set)fail('Expected own JSON array values.');
      out.push(visit(descriptor.value,depth+1));
     }
     return out;
    }
    if(Object.getPrototypeOf(entry)!==Object.prototype)fail('Expected a plain JSON object.');
    const out:Document={};
    for(const [key,descriptor] of Object.entries(descriptors)){
     if(['__proto__','constructor','prototype'].includes(key)||!descriptor.enumerable||descriptor.get||descriptor.set)
      fail('Unsupported data property: '+key+'.');
     out[key]=visit(descriptor.value,depth+1);
    }
    return out;
   } finally {ancestors.delete(entry);}
  }
  return visit(value,0);
 }
 function record(value:unknown):Document {
  const checked=copy(value);
  if(checked===null||typeof checked!=='object'||Array.isArray(checked))fail('Expected a JSON object.');
  return checked;
 }
 function text(value:unknown,label:string):string {
  if(typeof value!=='string'||!value.trim()||[...value].length>160)fail(label+' must be a nonempty string (maximum 160 characters).');
  return value;
 }
 const api=Object.freeze({copy,record,text,DeveloperError});
 (inputRoot as {LWDeveloperData?:unknown}).LWDeveloperData=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
