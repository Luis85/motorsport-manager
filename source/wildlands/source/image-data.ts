/** Bounded, canonical inline RGBA8 transport. Pure data: no images, URLs, DOM or GPU. */
namespace LWImageDataContract {
 export interface Api {
  validateRGBA(data:unknown,encoding?:unknown):number;
  decodeRGBA(data:unknown,encoding?:unknown):Uint8Array;
 }
}
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWImageData?:LWImageDataContract.Api};
 const BYTES=128*128*4,BASE64_LENGTH=87384;
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
 const digits=new Int16Array(128);digits.fill(-1);
 for(let i=0;i<alphabet.length;i++)digits[alphabet.charCodeAt(i)]=i;
 const fail=(message:string):never=>{throw Error('Inline RGBA: '+message);};
 /** Returns the decoded charge without allocating pixel storage. Padding bits must be zero. */
 function validateRGBA(data:unknown,encoding?:unknown):number {
  if(encoding==='base64'){
   if(typeof data!=='string'||data.length!==BASE64_LENGTH||!/^[A-Za-z0-9+/]{87381}[AQgw]==$/.test(data))fail('expected canonical base64 for exactly 65536 bytes');
   return BYTES;
  }
  if(encoding!==undefined)fail('unsupported encoding');
  if(!Array.isArray(data)||data.length!==BYTES)return fail('expected exactly 65536 RGBA bytes');
  const descriptors=Object.getOwnPropertyDescriptors(data);
  if(Object.keys(descriptors).length!==BYTES+1)fail('sparse or extended byte array');
  for(let i=0;i<BYTES;i++){
   const descriptor=descriptors[String(i)];
   if(!descriptor||!('value' in descriptor))fail('byte accessors are not data');
   const value=descriptor!.value;
   if(typeof value!=='number'||!Number.isInteger(value)||value<0||value>255)fail('invalid byte');
  }
  return BYTES;
 }
 function decodeRGBA(data:unknown,encoding?:unknown):Uint8Array {
  validateRGBA(data,encoding);
  if(encoding===undefined){
   const out=new Uint8Array(BYTES),values=data as number[];
   // Indexed copying never invokes a caller-supplied Symbol.iterator.
   for(let i=0;i<BYTES;i++)out[i]=values[i]!;
   return out;
  }
  const text=data as string,out=new Uint8Array(BYTES);let cursor=0;
  for(let i=0;i<text.length;i+=4){
   const a=digits[text.charCodeAt(i)]!,b=digits[text.charCodeAt(i+1)]!;
   const c=text[i+2]==='='?0:digits[text.charCodeAt(i+2)]!;
   const d=text[i+3]==='='?0:digits[text.charCodeAt(i+3)]!;
   out[cursor++]=(a<<2)|(b>>>4);
   if(cursor<BYTES)out[cursor++]=((b&15)<<4)|(c>>>2);
   if(cursor<BYTES)out[cursor++]=((c&3)<<6)|d;
  }
  return out;
 }
 const api=Object.freeze({validateRGBA,decodeRGBA});root.LWImageData=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
