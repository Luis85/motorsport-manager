/// <reference path="./renderer-contracts.d.ts" />
/// <reference path="./scene-environment-ports.d.ts" />
/* Observation boundary: only selected scene values are copied, bounded and deeply frozen. */
(function(inputRoot:unknown){
 'use strict';
 interface Actor {id:string;name:string;archetype?:string;personality?:string;equipment?:unknown;activeQuest?:unknown;creature:{x:number;y:number};}
 interface Engine {s:LWEnvironmentPorts.RoleState & {simTime:number;nodes:unknown[];buildings:unknown[];estate?:{islands:{ix:number;iy:number}[]};terraform?:unknown;construction?:unknown;interiors?:unknown};creatures:Actor[];selected:Actor|null;buildingInterior?(id:string):unknown;terrainAt?(x:number,y:number):string;terrainHeight?(x:number,y:number):number;}
 interface Options {time:number;delta:number;running:boolean;alpha:number;camera:LittlewildRenderer.Camera;viewport:LittlewildRenderer.Viewport;presentation:unknown;interiorView?:{buildingId:string;floorId:string;surface:LittlewildRenderer.Surface|null}|null;}
 const root=inputRoot as {LWDeveloperData:{copy(value:unknown):LittlewildDeveloper.Json;record(value:unknown):LittlewildDeveloper.Document};LWAssets?:{get(category:string,id:string):unknown};LWCreatures?:{get(id:string):unknown};LWSceneEnvironment?:{read():unknown;onsite(state:LWEnvironmentPorts.RoleState,actor:Actor):boolean};LWRendererFrame?:unknown;};
 function freeze<T>(value:T):T {if(value&&typeof value==='object'){for(const nested of Object.values(value))freeze(nested);Object.freeze(value);}return value;}
 function objects(engine:Engine,values:unknown[]):LittlewildRenderer.ObjectRecord[]{
  if(values.length>4096)throw Error('Renderer scene exceeds 4096 objects per collection.');
  return values.map(value=>{const details=root.LWDeveloperData.record(value);if(typeof details.id!=='string'||typeof details.kind!=='string'||typeof details.x!=='number'||typeof details.y!=='number')throw Error('Invalid renderer scene object.');return{id:details.id,kind:details.kind,x:details.x,y:details.y,height:engine.terrainHeight?.(details.x,details.y)??0,details};});
 }
 function create(engine:Engine,options:Options):LittlewildRenderer.Frame {
  if(engine.creatures.length>64)throw Error('Renderer scene exceeds 64 actors.');
  const origins=(engine.s.estate?.islands||[{ix:0,iy:0}]).map(island=>({x:island.ix*23,y:island.iy*23}));if(origins.length>49)throw Error('Renderer scene exceeds the admitted 49 islands.');
  const tiles=origins.flatMap(origin=>Array.from({length:361},(_,index)=>{const x=origin.x+index%19,y=origin.y+Math.floor(index/19);return{x,y,ground:engine.terrainAt?.(x,y)||'grass',height:engine.terrainHeight?.(x,y)??0};}));
  const scene={version:1 as const,time:options.time,delta:options.delta,simTime:engine.s.simTime,running:options.running,alpha:options.alpha,
   camera:{...options.camera},viewport:{...options.viewport},actors:engine.creatures.map(actor=>({id:actor.id,name:actor.name,archetype:actor.archetype||'',visualAsset:String(definition(actor.archetype||'')?.visualAsset||''),personality:actor.personality||'',equipment:root.LWDeveloperData.record(actor.equipment||{}),x:actor.creature.x,y:actor.creature.y,height:engine.terrainHeight?.(actor.creature.x,actor.creature.y)??0,away:!!actor.activeQuest&&!root.LWSceneEnvironment?.onsite(engine.s,actor),selected:engine.selected?.id===actor.id})),
   nodes:objects(engine,engine.s.nodes),buildings:objects(engine,engine.s.buildings),tiles,terrain:root.LWDeveloperData.record(engine.s.terraform||{}),construction:root.LWDeveloperData.record(engine.s.construction||{}),interiors:root.LWDeveloperData.record(engine.s.interiors||{}),
   interiorView:options.interiorView??null,room:options.interiorView?interior(engine,options.interiorView.buildingId):null,environment:root.LWSceneEnvironment?.read()??null,presentation:root.LWDeveloperData.record(options.presentation)};
  return freeze(root.LWDeveloperData.copy(scene)) as unknown as LittlewildRenderer.Frame;
 }
 function id(value:string):string {if(typeof value!=='string'||!value.trim()||value.length>160)throw Error('Query ID must be a nonempty string up to 160 characters.');return value;}
 function definition(value:string):LittlewildDeveloper.Document|null {const data=root.LWCreatures?.get(id(value));return data?freeze(root.LWDeveloperData.record(data)):null;}
 function asset(category:'actor'|'building'|'item',value:string):LittlewildDeveloper.Document|null {if(!['actor','building','item'].includes(category))throw Error('Unknown asset category.');const data=root.LWAssets?.get(category,id(value));return data?freeze(root.LWDeveloperData.record(data)):null;}
 function interior(engine:Engine,value:string):LittlewildRenderer.Value<LittlewildDeveloper.BuildingInteriorSnapshot>|null {const data=engine.buildingInterior?.(id(value));return data?freeze(root.LWDeveloperData.copy(data)) as unknown as LittlewildRenderer.Value<LittlewildDeveloper.BuildingInteriorSnapshot>:null;}
 root.LWRendererFrame={create,interior,asset,definition};if(typeof module!=='undefined'&&module.exports)module.exports={create,interior,asset,definition};
})(globalThis);
