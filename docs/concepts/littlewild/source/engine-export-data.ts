/// <reference path="./engine-export-contracts.d.ts" />
/* A separate inert-text boundary, with descriptor preflight before reading values. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWEngineExportData?:LWEngineExport.Decoder};
 const maxBytes=64*1024*1024,encoder=new TextEncoder();
 function preflight(text:string):void{
  let offset=0,count=0;
  const whitespace=():void=>{while(/\s/.test(text[offset]??'')&&offset<text.length)offset++;};
  function string():string{const start=offset++;while(offset<text.length){const character=text[offset++]!;if(character==='"')return text.slice(start,offset);if(character==='\\')offset++;}throw Error('Truncated engine export JSON string.');}
  function value(depth:number):void{
   if(++count>250000||depth>40)throw Error('Engine export structure exceeds its bounds.');whitespace();const character=text[offset];
   if(character==='"'){string();return;}
   if(character==='{'||character==='['){offset++;whitespace();const end=character==='{'?'}':']',keys=new Set<string>();if(text[offset]===end){offset++;return;}
    while(offset<text.length){if(character==='{'){if(text[offset]!=='"')throw Error('Invalid engine export JSON field.');const key=JSON.parse(string()) as string;if(keys.has(key))throw Error('Duplicate engine export JSON field: '+key);keys.add(key);whitespace();if(text[offset++]!==':')throw Error('Invalid engine export JSON field.');}value(depth+1);whitespace();if(text[offset]===end){offset++;return;}if(text[offset++]!==',')throw Error('Invalid engine export JSON separator.');whitespace();}throw Error('Truncated engine export JSON container.');
   }
   const start=offset;while(offset<text.length&&!/[\s,}\]]/.test(text[offset]!))offset++;if(offset===start)throw Error('Invalid engine export JSON value.');
  }
  value(0);whitespace();if(offset!==text.length)throw Error('Trailing engine export JSON data.');
 }
 function parse(input:unknown):unknown{
  if(typeof input==='string'){if(input.length>maxBytes||encoder.encode(input).byteLength>maxBytes)throw Error('Engine export exceeds64MiB.');preflight(input);input=JSON.parse(input) as unknown;}
  let values=0,bytes=0;
  function visit(value:unknown,depth:number):unknown{
   if(++values>250000||depth>40)throw Error('Engine export structure exceeds its bounds.');
   if(value===null||typeof value==='boolean')return value;
   if(typeof value==='number'){if(!Number.isFinite(value))throw Error('Engine export numbers must be finite.');bytes+=8;return value;}
   if(typeof value==='string'){if(value.length>16*1024*1024)throw Error('Engine export text exceeds16MiB.');const size=encoder.encode(value).byteLength;if(size>16*1024*1024)throw Error('Engine export text exceeds16MiB.');bytes+=size;if(bytes>maxBytes)throw Error('Engine export exceeds64MiB.');return value;}
   if(typeof value!=='object')throw Error('Engine export contains a non-JSON value.');
   const array=Array.isArray(value),proto=Object.getPrototypeOf(value);
   if(proto!==(array?Array.prototype:Object.prototype)&&proto!==null)throw Error('Engine export requires plain JSON values.');
   if(array){const size=Object.getOwnPropertyDescriptor(value,'length');if(!size||!('value' in size)||typeof size.value!=='number'||size.value>250000)throw Error('Engine export arrays exceed their bounds.');}
   const ownKeys=Reflect.ownKeys(value);if(ownKeys.length>250001)throw Error('Engine export fields exceed their bounds.');
   const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);
   if(keys.some(key=>typeof key!=='string'))throw Error('Engine export cannot contain symbol fields.');
   for(const key of keys as string[]){const descriptor=descriptors[key]!;if(!('value' in descriptor)||(!descriptor.enumerable&&!(array&&key==='length')))throw Error('Engine export cannot contain accessors or hidden fields.');if(['__proto__','prototype','constructor'].includes(key))throw Error('Unsafe engine export field.');}
   if(array){const length=descriptors.length?.value as unknown;if(typeof length!=='number'||length>250000||keys.length!==length+1)throw Error('Engine export arrays must be dense and bounded.');const result:unknown[]=[];for(let i=0;i<length;i++){const d=descriptors[String(i)];if(!d)throw Error('Engine export arrays must be dense.');result.push(visit(d.value,depth+1));}return result;}
   const result:Record<string,unknown>={};for(const key of keys as string[]){bytes+=encoder.encode(key).byteLength;result[key]=visit(descriptors[key]!.value,depth+1);}if(bytes>maxBytes)throw Error('Engine export exceeds64MiB.');return result;
  }
  return visit(input,0);
 }
 function record(input:unknown):Record<string,unknown>{if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Expected an engine export JSON object.');return input as Record<string,unknown>;}
 function path(input:unknown):string{if(typeof input!=='string'||input.length>240||!input||input.startsWith('/')||input.includes('\\')||input.split('/').some(p=>!p||p==='.'||p==='..')||! /^[A-Za-z0-9_./@ -]+$/.test(input))throw Error('Unsafe engine export source path.');return input;}
 async function sha256(text:string):Promise<string>{const hash=await globalThis.crypto.subtle.digest('SHA-256',encoder.encode(text));return Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');}
 const api:LWEngineExport.Decoder={parse,record,path,sha256,maxBytes};root.LWEngineExportData=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
