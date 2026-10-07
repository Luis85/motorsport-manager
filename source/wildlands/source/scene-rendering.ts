/// <reference path="./renderer-contracts.d.ts" />
/// <reference path="./building-interior-contracts.d.ts" />
/* Detached observer projections for native scene owners. No Engine/import/tick occurs here. */
(function(inputRoot:unknown){
 'use strict';
 type Document=LittlewildDeveloper.Document;type Frame=LittlewildRenderer.Frame;
 interface Engine {scenarioContext?:LWContentPorts.ExperienceContext;export():{state:Record<string,unknown>};}
 interface Options {sceneId?:string;time:number;delta:number;running:boolean;alpha:number;camera:LittlewildRenderer.Camera;viewport:LittlewildRenderer.Viewport;presentation:unknown;interiorView?:{buildingId:string;floorId:string;surface:LittlewildRenderer.Surface|null}|null;}
 interface Source {frame(options:Options):Frame;asset(category:'actor'|'building'|'item',id:string):LittlewildRenderer.Value<Document>|null;definition(id:string):LittlewildRenderer.Value<Document>|null;}
 const root=inputRoot as {LWSceneGraph:LWSceneGraph.Api;LWInteriors:LWInterior.CatalogApi;LWDeveloperData:{copy(value:unknown):LittlewildDeveloper.Json;record(value:unknown):Document};LWRendererFrame:{create(engine:unknown,options:Options):Frame;asset(category:'actor'|'building'|'item',id:string):LittlewildRenderer.Value<Document>|null;definition(id:string):LittlewildRenderer.Value<Document>|null};LWWorkflowVenues:LWWorkflowVenue.Api;LWSceneRendering?:unknown;};
 const record=(value:unknown):Document=>value&&typeof value==='object'&&!Array.isArray(value)?value as Document:{};
 const rows=(value:unknown):Document[]=>Array.isArray(value)?value.map(record):[];
 function freeze<T>(value:T):T {if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
 const copy=<T>(value:T):T=>freeze(root.LWDeveloperData.copy(value)) as unknown as T;
 function source(engine:Engine,targetId:string):Source {
  const context=engine.scenarioContext,foundJourney=context?.journey;if(!context||!foundJourney)throw Error('Embedded scenes require an authored scene journey.');
  const journey:LWSceneGraph.Journey=foundJourney;const pack=journey.pack,target=pack.scenes.find(scene=>scene.id===targetId);if(!target)throw Error('Unknown embedded scene.');
  if(target.graph?.rendering?.dimension!=='2d')throw Error('Embedded scenes must be 2d.');
  const owner=root.LWSceneGraph.owner(pack,targetId),activeOwner=root.LWSceneGraph.owner(pack,context.sceneId),foundWorld=pack.worlds.find(world=>world.id===target.worldId);if(!foundWorld)throw Error('Embedded scene world is missing.');const world:LWContentPorts.WorldProfile=foundWorld;
  const binding=target.graph.binding,bounds=target.graph.bounds??(binding?.type==='island'?{x:binding.ix*23,y:binding.iy*23,width:19,height:19}:null);
  const within=(point:LittlewildRenderer.Point)=>!bounds||point.x>=bounds.x&&point.y>=bounds.y&&point.x<bounds.x+bounds.width&&point.y<bounds.y+bounds.height;
  function asset(category:'actor'|'building'|'item',id:string){const found=rows(pack.resources?.assets).find(asset=>asset.category===category&&asset.id===id);return found?copy(found):root.LWRendererFrame.asset(category,id);}
  function definition(id:string){const found=rows(pack.resources?.creatures.definitions).find(definition=>definition.id===id);return found?copy(found):root.LWRendererFrame.definition(id);}
  function room(state:Document):LittlewildRenderer.Room|null{
   if(binding?.type!=='interior')return null;const building=rows(state.buildings).find(value=>value.id===binding.buildingId);if(!building)return null;
   const layout=root.LWInteriors.forBuilding(state as unknown as LWInterior.CatalogWorld,building as unknown as LWInterior.CatalogBuilding),interiors=record(state.interiors),locations=record(interiors.locations);
   const actors=rows(record(state.colony).creatures).flatMap(actor=>{
    const location=record(locations[String(actor.id)]),quest=record(actor.activeQuest);if(location.buildingId!==building.id||actor.activeQuest&&root.LWWorkflowVenues.buildingId(state as unknown as LWWorkflowVenue.State,String(actor.id),quest.questId)!==building.id)return [];
    const task=record(actor.task),moving=rows(location.route).length>0,progress=Number(task.elapsed)/Number(task.duration),archetype=String(actor.archetype||'sproutling');
    return [{id:String(actor.id),name:String(actor.name),archetype,visualAsset:String(definition(archetype)?.visualAsset||''),floorId:String(location.floorId),x:Number(location.x),y:Number(location.y),stationId:location.stationId??null,action:moving?'Walking inside':String(quest.name||task.label||'Between tasks'),mood:'',moving,progress:!moving&&Number.isFinite(progress)?Math.min(1,progress):null,remainingSeconds:null,direction:Number(record(actor.creature).dir)||1,cargo:'',equipment:record(actor.equipment),cargoItems:Object.entries(record(actor.inventory)).filter(([,quantity])=>typeof quantity==='number'&&quantity>0).map(([id,quantity])=>({id,quantity})),transfer:false}];
   });
   const fixture=asset('building',String(building.kind)),model=world.environment?.mode==='indoor'?'world':record(fixture?.models).interior?'interior':record(fixture?.models).world?'world':'';
   return copy({buildingId:building.id,buildingName:building.kind,kind:building.kind,fixtureAsset:model?building.kind:'',fixtureModel:model,floors:layout.floors,actors,time:Number(state.simTime)||0,status:{label:'Observed scene',kind:'idle',detail:'Dormant checkpoint'},input:record(record(building.storage).input),output:record(record(building.storage).output),recipes:[],transfers:[],sceneProps:{floorId:binding.floorId,props:target!.graph?.props??[]}}) as unknown as LittlewildRenderer.Room;
  }
  function frame(options:Options):Frame {
   const interiorView=binding?.type==='interior'?{buildingId:binding.buildingId,floorId:binding.floorId,surface:null}:null;
   let baseline:Frame;
   if(owner.id===activeOwner.id)baseline=root.LWRendererFrame.create(engine,{...options,sceneId:target!.id,interiorView});
   else{
    const state=copy(journey.checkpoints[owner.id]??owner.initialState) as Document;
    const terrain=record(record(state.terraform).tiles),height=(x:number,y:number)=>Number(record(terrain[Math.round(x)+','+Math.round(y)]).height)||0;
    const object=(value:Document):LittlewildRenderer.ObjectRecord=>({id:String(value.id),kind:String(value.kind),x:Number(value.x),y:Number(value.y),height:height(Number(value.x),Number(value.y)),details:value});
    const islands=rows(record(state.estate).islands);if(islands.length>49)throw Error('Embedded scene exceeds 49 islands.');
    const tiles=(islands.length?islands:[{ix:0,iy:0}]).flatMap(island=>Array.from({length:361},(_,index)=>{const x=Number(island.ix)*23+index%19,y=Number(island.iy)*23+Math.floor(index/19),localX=((x%23)+23)%23,localY=((y%23)+23)%23;return{x,y,height:height(x,y),ground:String(record(terrain[x+','+y]).ground||(world!.terrain[localY]?.[localX]==='.'?'grass':'water'))};}));
    baseline={version:1,time:options.time,delta:options.delta,simTime:Number(state.simTime)||0,running:false,alpha:options.alpha,camera:options.camera,viewport:options.viewport,presentation:root.LWDeveloperData.record(options.presentation),props:[],
     actors:rows(record(state.colony).creatures).map(actor=>{const point=record(actor.creature),archetype=String(actor.archetype||'sproutling');return{id:String(actor.id),name:String(actor.name),archetype,visualAsset:String(definition(archetype)?.visualAsset||''),personality:String(actor.personality||''),equipment:record(actor.equipment),x:Number(point.x),y:Number(point.y),height:height(Number(point.x),Number(point.y)),selected:false,away:!!actor.activeQuest&&root.LWWorkflowVenues.buildingId(state as unknown as LWWorkflowVenue.State,String(actor.id),record(actor.activeQuest).questId)===null};}),
     nodes:rows(state.nodes).map(object),buildings:rows(state.buildings).map(object),tiles,terrain:record(state.terraform),construction:record(state.construction),interiors:record(state.interiors),environment:world.environment as unknown as Document??null,interiorView,room:room(state)};
   }
   return copy({...baseline,scene:{id:target!.id,name:target!.name,dimension:'2d' as const,kind:target!.graph?.kind??'level',bounds},camera:options.camera,viewport:options.viewport,props:binding?.type==='interior'?[]:target!.graph?.props??[],interiorView,room:baseline.room&&binding?.type==='interior'?{...baseline.room,sceneProps:{floorId:binding.floorId,props:target!.graph?.props??[]}}:baseline.room,tiles:baseline.tiles.filter(within),nodes:baseline.nodes.filter(within),buildings:baseline.buildings.filter(within),actors:baseline.actors.filter(within)});
  }
  return {frame,asset,definition};
 }
 root.LWSceneRendering={source};if(typeof module!=='undefined'&&module.exports)module.exports={source};
})(globalThis);
