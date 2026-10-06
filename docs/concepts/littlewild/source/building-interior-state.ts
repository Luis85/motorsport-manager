/// <reference path="./building-interior-contracts.d.ts" />
/* Save integrity for the one interior location authority, embedded beside physical jobs. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWInteriors:LWInterior.CatalogApi;LWWorkflowVenues:LWWorkflowVenue.Api;LWInteriorState?:unknown;LWInteriorPaths:{path(f:LWInterior.Floor,a:LWInterior.Point,b:LWInterior.Point):LWInterior.Point[]|null};LWGeography:{Grid:new(world:LWInterior.World)=>{pass(x:number,y:number):boolean;canStep(a:LWInterior.Point,b:LWInterior.Point):boolean}}};
 const C=root.LWInteriors;
 const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
 const finite=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 function bad(message:string):never{throw Error('Building interior save: '+message);}
 function exact(v:unknown,keys:string[]):asserts v is Record<string,unknown>{if(!plain(v)||Object.keys(v).length!==keys.length||Object.keys(v).some(k=>!keys.includes(k)))bad('invalid fields');}
 const empty=():LWInterior.State=>({version:1,catalog:C.copy(C.defaults),locations:{},visits:[],production:{},jobs:{}});
 function validate(input:unknown,world:LWInterior.World):LWInterior.State|undefined{
  if(input===undefined)return undefined;exact(input,['version','catalog','locations','visits','production','jobs']);
  if(input.version!==1||!plain(input.locations)||!plain(input.production)||!plain(input.jobs)||!Array.isArray(input.visits)||input.visits.length>world.colony.creatures.length)bad('invalid bounded state');
  const catalog=C.validate(input.catalog),actors=world.colony.creatures;
  const building=(id:unknown)=>world.buildings.find(b=>b.id===id);
  const floor=(id:unknown,floorId:unknown):LWInterior.Floor=>{const b=building(id);if(!b||typeof floorId!=='string')bad('unknown building or floor');const f=C.floor(C.forBuilding({...world,interiors:{...empty(),catalog}},b),floorId);if(!f)bad('unknown floor');return f;};
  const position=(v:Record<string,unknown>,f:LWInterior.Floor):void=>{if(!finite(v.x,0,f.width-1)||!finite(v.y,0,f.height-1)||f.cells&&!f.cells.some(p=>p.x===Math.round(v.x as number)&&p.y===Math.round(v.y as number)))bad('position outside floor');};
  if(Object.keys(input.locations).length>actors.length||Object.keys(input.production).length>world.buildings.length||Object.keys(input.jobs).length>world.buildings.length)bad('unbounded records');
  for(const [actorId,value]of Object.entries(input.locations)){
   exact(value,['buildingId','floorId','stationId','x','y','route','purpose']);const actor=actors.find(c=>c.id===actorId),b=building(value.buildingId),f=floor(value.buildingId,value.floorId);
   if(!actor||actor.activeQuest&&root.LWWorkflowVenues.buildingId(world,actorId,actor.activeQuest.questId)!==b?.id||!b||Math.hypot(actor.creature.x-b.x,actor.creature.y-b.y)>1.51||!['work','visit','exit'].includes(String(value.purpose))||!Array.isArray(value.route)||value.route.length>3200)bad('invalid physical location');position(value,f);
   if(!value.route.length&&(!Number.isInteger(value.x)||!Number.isInteger(value.y)))bad('stationary position between cells');
   if(value.stationId!==null&&!f.stations.some(s=>s.id===value.stationId&&s.x===value.x&&s.y===value.y))bad('unknown or misplaced station');
   let previous=f,previousPoint:LWInterior.Point={x:value.x as number,y:value.y as number};for(const waypoint of value.route){exact(waypoint,['floorId','x','y','seconds']);const next=floor(b.id,waypoint.floorId);position(waypoint,next);if(!finite(waypoint.seconds,.000001,60))bad('invalid route time');if(next.id!==previous.id&&!previous.stairs.some(s=>s.to===next.id&&s.x===previousPoint.x&&s.y===previousPoint.y&&s.arrival.x===waypoint.x&&s.arrival.y===waypoint.y&&(waypoint.seconds as number)<=s.seconds))bad('route skips stairs');if(next.id===previous.id){const point={x:waypoint.x as number,y:waypoint.y as number};const origin={x:Number.isInteger(previousPoint.x)?previousPoint.x:point.x+Math.sign(previousPoint.x-point.x),y:Number.isInteger(previousPoint.y)?previousPoint.y:point.y+Math.sign(previousPoint.y-point.y)},path=root.LWInteriorPaths.path(next,origin,point);if(path===null||path.length>1||(previousPoint.x!==point.x&&previousPoint.y!==point.y)||Math.abs(previousPoint.x-point.x)+Math.abs(previousPoint.y-point.y)>1.001||Math.abs((waypoint.seconds as number)-Math.hypot(previousPoint.x-point.x,previousPoint.y-point.y)/2)>.000001)bad('route skips indoor cells');previousPoint=point;}else previousPoint={x:waypoint.x as number,y:waypoint.y as number};previous=next;}
  }
  const grid=new root.LWGeography.Grid(world);
  const visiting=new Set<string>();for(const v of input.visits){
   exact(v,['actorId','buildingId','floorId','created','phase','path','hold']);const actor=actors.find(c=>c.id===v.actorId);floor(v.buildingId,v.floorId);
   if(!actor||actor.activeQuest||visiting.has(actor.id)||!finite(v.created,0,world.simTime)||!['queued','walk','inside'].includes(String(v.phase))||!finite(v.hold,0,8)||!Array.isArray(v.path)||v.path.length>400)bad('invalid visit');visiting.add(actor.id);
   for(const p of v.path){exact(p,['x','y']);if(!finite(p.x,-1000,1000)||!finite(p.y,-1000,1000)||!Number.isInteger(p.x)||!Number.isInteger(p.y))bad('invalid outdoor path');}
   if(v.phase!=='walk'&&v.path.length)bad('visit path outside walking phase');if(v.phase!=='inside'&&v.hold!==8)bad('visit dwell began before arrival');
   if(v.phase==='walk'){let previous:LWInterior.Point={x:Math.round(actor.creature.x),y:Math.round(actor.creature.y)};for(const point of v.path as LWInterior.Point[]){if(!(previous.x===point.x&&previous.y===point.y?grid.pass(point.x,point.y):grid.canStep(previous,point)))bad('blocked or disconnected visit path');previous=point;}const destination=building(v.buildingId)!;if(Math.hypot(previous.x-destination.x,previous.y-destination.y)>1.01)bad('visit does not reach building doorway');}
   if(v.phase==='inside'){const location=input.locations[actor.id];if(!plain(location)||location.buildingId!==v.buildingId||location.purpose!=='visit'||!(location.floorId===v.floorId||(location.route as LWInterior.Waypoint[]).at(-1)?.floorId===v.floorId))bad('visit has no matching interior location');}
  }
  for(const [buildingId,bindings]of Object.entries(input.production)){
   const b=building(buildingId);if(!b?.storage||!Array.isArray(bindings)||bindings.length>24)bad('invalid production bindings');const quantities:Record<string,number>={};
   for(const binding of bindings){exact(binding,['floorId','stationId','recipe','remaining']);const f=floor(buildingId,binding.floorId);if(!f.stations.some(s=>s.id===binding.stationId&&s.production)||typeof binding.recipe!=='string'||!finite(binding.remaining,1,12)||!Number.isInteger(binding.remaining))bad('invalid production station');quantities[binding.recipe]=(quantities[binding.recipe]||0)+binding.remaining;}
   for(const [recipe,n]of Object.entries(quantities))if(n>(b.storage.requests[recipe]||0))bad('station batches exceed physical request');
  }
  for(const [jobId,binding]of Object.entries(input.jobs)){
   exact(binding,['floorId','stationId','recipe']);const b=world.buildings.find(b=>b.storage?.job?.id===jobId);if(!b||b.storage!.job!.recipe!==binding.recipe)bad('orphaned paid station binding');const f=floor(b.id,binding.floorId);if(!f.stations.some(s=>s.id===binding.stationId&&s.production))bad('invalid paid station');const worker=b.storage!.job!.workerId,location=worker?input.locations[worker]:undefined;if(plain(location)&&location.purpose==='work'&&location.stationId!==null&&(location.floorId!==binding.floorId||location.stationId!==binding.stationId||location.buildingId!==b.id))bad('paid worker at a different station');
  }
  return C.copy(input as unknown as LWInterior.State);
 }
 root.LWInteriorState=Object.freeze({empty,validate});if(typeof module!=='undefined'&&module.exports)module.exports=root.LWInteriorState;
})(globalThis);
