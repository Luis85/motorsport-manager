/// <reference path="./runtime-contracts.d.ts" />
/* Paired interactions use authoritative room locations while preserving outdoor map distances. */
(function(inputRoot:unknown){
 'use strict';
 interface Actor {id:string;creature:LWRuntime.Point;}
 interface Room extends LWRuntime.Point {buildingId:string;floorId:string;moving:boolean;}
 const plain=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
 function room(locations:Record<string,unknown>,id:string):Room|null|false{
  const entry=Object.getOwnPropertyDescriptor(locations,id);if(!entry)return null;
  if(entry.get||entry.set||!plain(entry.value))return false;
  const fields=Object.getOwnPropertyDescriptors(entry.value),get=(key:string):unknown=>{const d=fields[key];return d&&!d.get&&!d.set?d.value:undefined;};
  const x=get('x'),y=get('y'),buildingId=get('buildingId'),floorId=get('floorId'),route=get('route');
  if(typeof x!=='number'||!Number.isFinite(x)||typeof y!=='number'||!Number.isFinite(y)||typeof buildingId!=='string'||typeof floorId!=='string'||!Array.isArray(route))return false;
  return {x,y,buildingId,floorId,moving:route.length>0};
 }
 function distance(locations:unknown,a:Actor,b:Actor):number{
  if(locations!==undefined&&!plain(locations))return Infinity;
  const first=locations===undefined?null:room(locations,a.id),second=locations===undefined?null:room(locations,b.id);
  if(first===false||second===false)return Infinity;
  if(first||second){if(!first||!second||first.buildingId!==second.buildingId||first.floorId!==second.floorId||first.moving||second.moving)return Infinity;return Math.hypot(first.x-second.x,first.y-second.y);}
  const value=Math.hypot(a.creature.x-b.creature.x,a.creature.y-b.creature.y);return Number.isFinite(value)?value:Infinity;
 }
 const api=Object.freeze({distance});
 (inputRoot as {LWInteractionSpace?:typeof api}).LWInteractionSpace=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
