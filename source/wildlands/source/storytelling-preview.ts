/// <reference path="./storytelling-render-contracts.d.ts" />
/* Editor preview projects authored values directly. No temporary engine or registry swap. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWScenarioResources:{defaults():LWContentPorts.Resources};LWInteriors:LWInterior.CatalogApi;LWContent:LWContentPorts.ContentApi;LWSceneGraph:LWSceneGraph.Api;LWStorytellingPreview?:unknown};
 const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
 const rows=(value:unknown):Record<string,unknown>[]=>Array.isArray(value)?value.map(record):[];
 function freeze<T>(value:T):T{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
 function create(pack:LWContentPorts.ScenarioPack,sceneId:string):LWStorytelling.PreviewSource {
  const draft=freeze(root.LWContent.copy(pack)),scene=draft.scenes.find(row=>row.id===sceneId);if(!scene)throw Error('Choose an existing scene.');
  const world=draft.worlds.find(row=>row.id===scene.worldId)!;
  const entities=root.LWSceneGraph.entities(draft,sceneId),bounds=root.LWSceneGraph.bounds(draft,sceneId)??null;
  const state=root.LWSceneGraph.owner(draft,sceneId).initialState,terrain=record(record(state.terraform).tiles);
  const height=(x:number,y:number):number=>Number(record(terrain[Math.round(x)+','+Math.round(y)]).height)||0;
  // Default catalogs are immutable authored data, independent of the active story's replacements.
  const resources=freeze(draft.resources??root.LWScenarioResources.defaults());
  const assets=rows(resources.assets),definitions=rows(resources.creatures.definitions);
  function room():LittlewildRenderer.Room|null {
   const binding=scene!.graph?.binding;if(binding?.type!=='interior')return null;
   const building=rows(state.buildings).find(row=>row.id===binding.buildingId)!;
   const layout=root.LWInteriors.forBuilding(state as unknown as LWInterior.CatalogWorld,building as unknown as LWInterior.CatalogBuilding);
   const asset=assets.find(row=>row.category==='building'&&row.id===building.kind),model=record(asset?.models).interior?'interior':'world';
   const actors=entities.filter(row=>row.category==='creatures').map(row=>{
    const archetype=String(row.data.archetype||'sproutling'),definition=definitions.find(row=>row.id===archetype);
    return {id:row.id,name:row.name,archetype,visualAsset:String(definition?.visualAsset||''),floorId:binding.floorId,x:row.x,y:row.y,stationId:null,action:'Cutscene preview',mood:'',progress:null,remainingSeconds:null,moving:false,direction:1,cargo:'',transfer:false,equipment:record(row.data.equipment) as LittlewildDeveloper.Document};
   });
   return {buildingId:binding.buildingId,buildingName:String(building.kind),kind:String(building.kind),fixtureAsset:asset?String(building.kind):'',fixtureModel:asset?model:'',floors:layout.floors,actors,time:Number(state.simTime)||0,status:{label:'Preview',kind:'idle',detail:'Detached authored scene'},input:{},output:{},recipes:[],transfers:[],sceneProps:{floorId:binding.floorId,props:scene!.graph?.props??[]}};
  }
  function frame(options:{camera:LittlewildRenderer.Camera;viewport:LittlewildRenderer.Viewport;time:number;delta:number}):LittlewildRenderer.Frame {
   const object=(entity:LWSceneGraph.Entity):LittlewildRenderer.ObjectRecord=>({id:entity.id,kind:entity.kind,x:entity.x,y:entity.y,height:height(entity.x,entity.y),details:entity.data as LittlewildDeveloper.Document});
   const islands=rows(record(state.estate).islands);
   const tiles=(islands.length?islands:[{ix:0,iy:0}]).flatMap(island=>Array.from({length:361},(_,index)=>{
    const x=Number(island.ix)*23+index%19,y=Number(island.iy)*23+Math.floor(index/19),localX=((x%23)+23)%23,localY=((y%23)+23)%23;
    return {x,y,height:height(x,y),ground:String(record(terrain[x+','+y]).ground||(world.terrain[localY]?.[localX]==='.'?'grass':'water'))};
   })).filter(tile=>!bounds||tile.x>=bounds.x&&tile.y>=bounds.y&&tile.x<bounds.x+bounds.width&&tile.y<bounds.y+bounds.height);
   return {version:1,scene:{id:scene!.id,name:scene!.name,dimension:scene!.graph?.rendering?.dimension??'3d',kind:scene!.graph?.kind??'level',bounds},
    ...options,simTime:Number(state.simTime)||0,running:false,alpha:1,presentation:draft.presentation as unknown as LittlewildDeveloper.Document,camera:{...options.camera},viewport:{...options.viewport},
    actors:entities.filter(row=>row.category==='creatures').map(row=>{const archetype=String(row.data.archetype||'sproutling'),definition=definitions.find(row=>row.id===archetype);return {id:row.id,name:row.name,archetype,visualAsset:String(definition?.visualAsset||''),personality:String(row.data.personality||''),equipment:record(row.data.equipment) as LittlewildDeveloper.Document,x:row.x,y:row.y,height:height(row.x,row.y),selected:false,away:false};}),
    buildings:entities.filter(row=>row.category==='buildings').map(object),nodes:entities.filter(row=>row.category==='nodes').map(object),props:scene!.graph?.props??[],tiles,
    terrain:record(state.terraform) as LittlewildDeveloper.Document,construction:record(state.construction) as LittlewildDeveloper.Document,interiors:record(state.interiors) as LittlewildDeveloper.Document,environment:world.environment as unknown as LittlewildDeveloper.Document??null,interiorView:scene!.graph?.binding?.type==='interior'?{buildingId:scene!.graph.binding.buildingId,floorId:scene!.graph.binding.floorId,surface:null}:null,room:room()};
  }
  return {frame,asset:(category,id)=>assets.find(row=>row.category===category&&row.id===id) as LittlewildDeveloper.Document??null,definition:id=>definitions.find(row=>row.id===id) as LittlewildDeveloper.Document??null};
 }
 const api={create};root.LWStorytellingPreview=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
