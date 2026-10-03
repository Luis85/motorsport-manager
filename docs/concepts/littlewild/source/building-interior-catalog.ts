/// <reference path="./building-interior-data-contracts.d.ts" />
/* Bounded, portable interior layouts. Definitions contain geometry and stable IDs only. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWInteriorDefinitions?:unknown;LWInteriors?:LWInterior.CatalogApi;LWContent:{parse(input:unknown,limit:number):unknown};LWInteriorPaths:{validate(f:LWInterior.Floor):void;path(f:LWInterior.Floor,a:LWInterior.Point,b:LWInterior.Point):LWInterior.Point[]|null}};
 const copy=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
 const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
 const finite=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-z][a-z0-9_-]{0,47}$/.test(v);
 function bad(message:string):never{throw Error('Building interiors: '+message);}
 function fields(v:unknown,keys:string[],label:string,optional:string[]=[]):asserts v is Record<string,unknown>{if(!plain(v)||keys.some(k=>!Object.hasOwn(v,k))||Object.keys(v).some(k=>!keys.includes(k)&&!optional.includes(k)))bad('invalid '+label);}
 function point(v:unknown,width:number,height:number):void{fields(v,['x','y'],'point');if(!finite(v.x,0,width-1)||!finite(v.y,0,height-1)||!Number.isInteger(v.x)||!Number.isInteger(v.y))bad('point outside floor');}
 function validate(raw:unknown):LWInterior.Catalog{
  const input=root.LWContent.parse(raw,2*1024*1024);
  fields(input,['version','layouts','bindings','fallback'],'catalog');
  if(input.version!==1||!Array.isArray(input.layouts)||input.layouts.length<1||input.layouts.length>32||!plain(input.bindings)||Object.keys(input.bindings).length>128)bad('invalid catalog bounds');
  const layoutIds=new Set<string>();
  for(const layout of input.layouts){
   fields(layout,['id','label','floors'],'layout');if(!id(layout.id)||layoutIds.has(layout.id)||typeof layout.label!=='string'||[...layout.label].length>80||!Array.isArray(layout.floors)||layout.floors.length<1||layout.floors.length>8)bad('invalid layout');layoutIds.add(layout.id);
   const floorIds=new Set<string>();
   for(const floor of layout.floors){
    fields(floor,['id','label','width','height','door','stairs','stations'],'floor',['cells','edges']);if(!id(floor.id)||floorIds.has(floor.id)||typeof floor.label!=='string'||[...floor.label].length>80||!finite(floor.width,4,20)||!Number.isInteger(floor.width)||!finite(floor.height,4,20)||!Number.isInteger(floor.height)||!Array.isArray(floor.stairs)||floor.stairs.length>8||!Array.isArray(floor.stations)||floor.stations.length>24)bad('invalid floor');floorIds.add(floor.id);point(floor.door,floor.width,floor.height);
    if(floor.cells!==undefined){if(!Array.isArray(floor.cells)||floor.cells.length<4||floor.cells.length>400)bad('invalid floor cells');const seen=new Set<string>();for(const cell of floor.cells){point(cell,floor.width,floor.height);const p=cell as LWInterior.Point;if(!Number.isInteger(p.x)||!Number.isInteger(p.y)||seen.has(p.x+','+p.y))bad('invalid cell');seen.add(p.x+','+p.y);}}
    if(floor.edges!==undefined){if(!Array.isArray(floor.edges)||floor.edges.length>1600)bad('invalid floor edges');const seen=new Set<string>();for(const edge of floor.edges){fields(edge,['x','y','side','kind'],'edge');point({x:edge.x,y:edge.y},floor.width,floor.height);if(!Number.isInteger(edge.x)||!Number.isInteger(edge.y)||!['n','e','s','w'].includes(String(edge.side))||!['wall','window','door'].includes(String(edge.kind))||seen.has(edge.x+','+edge.y+','+edge.side))bad('invalid edge');seen.add(edge.x+','+edge.y+','+edge.side);}}
    const stations=new Set<string>();for(const station of floor.stations){fields(station,['id','label','kind','production','x','y'],'station');if(!id(station.id)||stations.has(station.id)||typeof station.label!=='string'||[...station.label].length>80||!['workbench','storage','desk','hearth','bed','planter'].includes(String(station.kind))||typeof station.production!=='boolean')bad('invalid station');stations.add(station.id);point({x:station.x,y:station.y},floor.width,floor.height);}
   }
   for(const floor of layout.floors)root.LWInteriorPaths.validate(floor as LWInterior.Floor);
   for(const floor of layout.floors){const f=floor as unknown as LWInterior.Floor;for(const stair of f.stairs){fields(stair,['x','y','to','arrival','seconds'],'stairs');const destination=layout.floors.find((v:unknown)=>plain(v)&&v.id===stair.to) as LWInterior.Floor|undefined;if(!destination||destination.id===f.id||!finite(stair.seconds,.5,15))bad('invalid stair connection');point({x:stair.x,y:stair.y},f.width,f.height);point(stair.arrival,destination.width,destination.height);if(!root.LWInteriorPaths.path(destination,destination.door,stair.arrival as LWInterior.Point))bad('unreachable stair arrival');}}
   for(const start of floorIds){const connected=new Set([start]);for(let i=0;i<layout.floors.length;i++)for(const floor of layout.floors as LWInterior.Floor[])if(connected.has(floor.id))for(const stair of floor.stairs)connected.add(stair.to);if(connected.size!==floorIds.size)bad('disconnected floors');}
  }
  if(typeof input.fallback!=='string'||!layoutIds.has(input.fallback))bad('missing fallback layout');for(const [kind,layout]of Object.entries(input.bindings))if(!id(kind)||typeof layout!=='string'||!layoutIds.has(layout))bad('invalid binding');
  return copy(input as unknown as LWInterior.Catalog);
 }
 const defaults=validate(root.LWInteriorDefinitions??require('./content/balancing.json').interiors);
 function freeze(value:unknown):void{if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}}
 freeze(defaults);
 const layout=(catalog:LWInterior.Catalog,kind:string):LWInterior.Layout=>catalog.layouts.find(l=>l.id===(catalog.bindings[kind]||catalog.fallback))!;
 const floor=(definition:LWInterior.Layout,id:string):LWInterior.Floor|null=>definition.floors.find(f=>f.id===id)||null;
 const forBuilding=(world:LWInterior.CatalogWorld,building:LWInterior.CatalogBuilding):LWInterior.Layout=>building.designId&&world.construction?.designs[building.designId]?world.construction.designs[building.designId]!.layout:layout(world.interiors?.catalog||defaults,building.kind);
 root.LWInteriors=Object.freeze({defaults,validate,layout,floor,forBuilding,copy});if(typeof module!=='undefined'&&module.exports)module.exports=root.LWInteriors;
})(globalThis);
