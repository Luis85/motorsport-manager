/// <reference path="./balancing-contracts.d.ts" />
/* A bounded inventory pairs each compiled tuner with actual domain source consumption. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWBalanceRules:LWBalanceRules.Api;LWContent:LWContentPorts.ContentApi;LWBalancingInventory?:{validate(input:unknown):unknown}};
 const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
 function validate(input:unknown):unknown{
  const data=root.LWContent.parse(input,256*1024);
  if(!object(data)||Object.keys(data).length!==4||data.format!=='littlewild-balancing-inventory'||data.schemaVersion!==1||!Array.isArray(data.tuners)||!data.tuners.length||data.tuners.length>1024||!Array.isArray(data.invariants)||!data.invariants.length||data.invariants.length>128)throw Error('Invalid balancing inventory.');
  const supported=new Set(root.LWBalanceRules.supported().map(row=>row.path)),found=new Set<string>();
  for(const row of data.tuners){
   if(!object(row)||Object.keys(row).length!==4||typeof row.path!=='string'||!supported.has(row.path)||typeof row.source!=='string'||!/^[-a-z]+\.ts$/.test(row.source)||typeof row.consumer!=='string'||!/^B\.forEngine\((this|engine)\)\.[a-zA-Z]+\.[a-zA-Z]+$/.test(row.consumer)||!Number.isSafeInteger(row.occurrences)||Number(row.occurrences)<1||Number(row.occurrences)>1024)throw Error('Invalid or unsupported inventory tuner.');
   if(row.path!==('/simulation/rules/gameplay/'+row.consumer.split('.').slice(-2).join('/')))throw Error('Inventory path and consumer disagree.');found.add(row.path);
  }
  if([...supported].some(path=>!found.has(path)))throw Error('A compiled tuner is missing a documented consumer.');
  for(const row of data.invariants)if(!object(row)||Object.keys(row).length!==2||typeof row.source!=='string'||!/^[-a-z]+\.ts$/.test(row.source)||typeof row.reason!=='string'||row.reason.length<24||row.reason.length>1000)throw Error('Invalid invariant source explanation.');
  return data;
 }
 const api=Object.freeze({validate});root.LWBalancingInventory=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
