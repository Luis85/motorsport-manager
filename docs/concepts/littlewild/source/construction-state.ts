/// <reference path="./construction-contracts.d.ts" />
/* Portable state integrity; blueprints are values and cannot inject mechanic code. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWConstructionDesigns:LWConstruction.DesignsApi;LWConstructionGeometry:LWConstruction.GeometryApi;LWInteriors:LWInterior.CatalogApi;LW:{APPROACHES:Record<string,{time:number}>};LWConstructionState?:unknown};
 const D=root.LWConstructionDesigns;
 const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
 function bad(message:string):never{throw Error('Construction save: '+message);}
 function validate(input:unknown,world:LWConstruction.World):LWConstruction.State|undefined{
  const places=[...world.buildings,...world.colony.creatures.flatMap(a=>a.orders)];
  if(input===undefined){if(places.some(p=>p.designId!==undefined))bad('missing authored blueprint state');return undefined;}
  if(!plain(input)||Object.keys(input).length!==3||Object.keys(input).some(k=>!['version','sequence','designs'].includes(k))||input.version!==1||typeof input.sequence!=='number'||!Number.isSafeInteger(input.sequence)||input.sequence<1||input.sequence>100001||!plain(input.designs)||Object.keys(input.designs).length>128)bad('invalid bounded state');
  let maximum=0;const designs:Record<string,LWConstruction.Design>={};
  for(const [id,value]of Object.entries(input.designs)){
   const index=Number(id.slice(7));if(!/^design-[1-9][0-9]*$/.test(id)||!Number.isSafeInteger(index)||index>=input.sequence)bad('invalid design identity');maximum=Math.max(maximum,index);
   if(!plain(value)||Object.keys(value).length!==6||Object.keys(value).some(k=>!['id','name','kind','layout','footprint','mapUnit'].includes(k))||value.id!==id)bad('invalid design record');
   const validated=D.validate({name:value.name,kind:value.kind,layout:value.layout,mapUnit:value.mapUnit},id);
   if(JSON.stringify(value.footprint)!==JSON.stringify(validated.footprint))bad('forged footprint');designs[id]=validated;
  }
  if(input.sequence<=maximum)bad('sequence would reuse an identity');
  for(const p of places)if(p.designId!==undefined){const design=typeof p.designId==='string'?designs[p.designId]:undefined;if(!design||p.kind!==design.kind)bad('unknown or mismatched design reference');}
  for(const a of world.colony.creatures)for(const o of a.orders){if(!o.designId)continue;
   if(!['build','upgrade'].includes(o.type)||!Number.isInteger(o.stage)||o.stage!<0||o.stage!>2||typeof o.progress!=='number'||!Number.isFinite(o.progress)||o.progress!<0||typeof o.paid!=='boolean')bad('invalid physical design stage');
   const duration=D.phases(designs[o.designId]!)[o.stage!]!.time*(root.LW.APPROACHES[o.approach||'balanced']?.time||1);if(o.progress!>duration||(!o.paid&&o.progress!==0))bad('invalid paid stage progress');
   if(o.type==='upgrade'){const b=world.buildings.find(b=>b.id===o.buildingId);if(!b||b.x!==o.x||b.y!==o.y||b.kind!==o.kind)bad('orphaned improvement');const prior=root.LWInteriors.forBuilding(world as unknown as LWInterior.World,b),design=designs[o.designId]!;const mismatch=D.preserve(prior,design.layout);if(mismatch)bad(mismatch);const scale=b.designId?designs[b.designId]!.mapUnit:{width:prior.floors[0]!.width,height:prior.floors[0]!.height};if(scale.width!==design.mapUnit.width||scale.height!==design.mapUnit.height)bad('changed exterior mapping scale');}
  }
  const state:LWConstruction.State={version:1,sequence:input.sequence,designs};
  const tiles=new Map<string,string>(),projects=world.colony.creatures.flatMap(a=>a.orders.filter(o=>o.type==='build'||o.type==='upgrade'&&o.designId));
  const reservations=[...world.buildings.map(b=>({owner:b.id,place:b})),...projects.map(o=>({owner:o.type==='upgrade'?o.buildingId!:o.id,place:{x:o.x!,y:o.y!,...(o.designId?{designId:o.designId}:{})}}))];
  for(const r of reservations)for(const p of root.LWConstructionGeometry.cells({...world,construction:state},r.place)){const key=p.x+','+p.y,owner=tiles.get(key);if(owner&&owner!==r.owner)bad('overlapping footprints');tiles.set(key,r.owner);}
  return D.copy(state);
 }
 root.LWConstructionState=Object.freeze({validate});if(typeof module!=='undefined'&&module.exports)module.exports=root.LWConstructionState;
})(globalThis);
