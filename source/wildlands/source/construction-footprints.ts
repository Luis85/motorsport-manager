/// <reference path="./runtime-contracts.d.ts" />
/* Pure occupied-cell projection shared by physical grids and construction policies. */
(function(inputRoot:unknown){
 'use strict';
 interface Place extends LWRuntime.Point {designId?:string;}
 interface Order {type:string;designId?:string;x?:number;y?:number;}
 interface World {
  construction?:{designs:Record<string,{footprint:LWRuntime.Point[]}>};
  buildings:Place[];colony?:{creatures:{orders:Order[]}[]};
 }
 interface Api {cells(world:World,place:Place):LWRuntime.Point[];blockers(world:World):LWRuntime.Point[];}
 const root=inputRoot as {LWConstructionFootprints?:Api};
 function cells(world:World,place:Place):LWRuntime.Point[]{
  const footprint=place.designId?world.construction?.designs[place.designId]?.footprint:undefined;
  return (footprint||[{x:0,y:0}]).map(point=>({x:place.x+point.x,y:place.y+point.y}));
 }
 function blockers(world:World):LWRuntime.Point[]{
  return [...world.buildings.flatMap(building=>cells(world,building)),...(world.colony?.creatures||[])
   .flatMap(actor=>actor.orders.filter(order=>['build','upgrade'].includes(order.type)&&order.designId&&order.x!==undefined&&order.y!==undefined)
    .flatMap(order=>cells(world,{x:order.x!,y:order.y!,designId:order.designId!})))];
 }
 root.LWConstructionFootprints=Object.freeze({cells,blockers});
 if(typeof module!=='undefined'&&module.exports)module.exports=root.LWConstructionFootprints;
})(globalThis);
