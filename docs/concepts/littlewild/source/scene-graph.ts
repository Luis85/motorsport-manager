/// <reference path="./renderer-data-contracts.d.ts" />
/* Pure authored topology and entity projections; no engine or renderer owns these values. */
(function(inputRoot:unknown){
 'use strict';
 interface Root {LWCanvasAuthoring:LWCanvasAuthoring.Api;LWAssets:{defaults:unknown[]};LWInteriors:{defaults:unknown};LWStorytellingValidation:{validate(pack:LWContentPorts.ScenarioPack):void};LWSceneGraph?:LWSceneGraph.Api;LWRendererCatalog:LittlewildRenderer.Catalog;}
 const root=inputRoot as Root;
 const authoring=(typeof module!=='undefined'&&module.exports?require('./canvas-authoring.js'):root.LWCanvasAuthoring) as LWCanvasAuthoring.Api;
 const record=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
 const rows=(value:unknown):Record<string,unknown>[]=>Array.isArray(value)?value.map(record):[];
 function scene(pack:LWContentPorts.ScenarioPack,id:string):LWContentPorts.Scene {
  const found=pack.scenes.find(s=>s.id===id);
  if(!found)throw Error('Unknown scene '+id+'.');
  return found;
 }
 function owner(pack:LWContentPorts.ScenarioPack,id:string):LWContentPorts.Scene {
  const selected=scene(pack,id);
  return selected.graph?.binding?scene(pack,selected.graph.binding.sourceSceneId):selected;
 }
 function layout(state:Record<string,unknown>,building:Record<string,unknown>):Record<string,unknown> {
  const design=record(record(record(state.construction).designs)[String(building.designId)]);
  if(design.layout)return record(design.layout);
  const catalog=record(record(state.interiors).catalog??root.LWInteriors.defaults);
  const id=record(catalog.bindings)[String(building.kind)]??catalog.fallback;
  return rows(catalog.layouts).find(row=>row.id===id)??{};
 }
 function validate(pack:LWContentPorts.ScenarioPack):void {
  authoring.validate(pack);
  (typeof module!=='undefined'&&module.exports?require('./storytelling-validation.js'):root.LWStorytellingValidation).validate(pack);
  const items=new Set([...pack.libraries.base.components.items.map(row=>row.id),...pack.libraries.adventure.equipment.map(row=>row.id)]);
  const buildings=new Set(pack.libraries.base.components.buildings.map(row=>row.id));
  const quests=new Set([...pack.libraries.adventure.quests.map(row=>row.id),...pack.libraries.base.components.chapters.map(row=>row.id)]);
  const checkRequirements=(requirements:LWSceneGraph.Requirement[]|undefined):void=>{
   for(const requirement of requirements??[]){
    if(requirement.type==='item'&&!items.has(requirement.itemId))throw Error('Scene requirement references unknown item '+requirement.itemId+'.');
    if(requirement.type==='building'&&!buildings.has(requirement.kind))throw Error('Scene requirement references unknown building '+requirement.kind+'.');
    if(requirement.type==='quest-complete'&&!quests.has(requirement.questId))throw Error('Scene requirement references unknown quest '+requirement.questId+'.');
   }
  };
  const visiting=new Set<string>(),visited=new Set<string>();
  function visitEmbed(id:string):void{if(visiting.has(id))throw Error('Embedded scene views contain a cycle.');if(visited.has(id))return;visiting.add(id);for(const embed of scene(pack,id).graph?.rendering?.embeds??[])visitEmbed(embed.sceneId);visiting.delete(id);visited.add(id);}
  for(const selected of pack.scenes)visitEmbed(selected.id);
  for(const selected of pack.scenes){
   const graph=selected.graph;
   if(!graph)continue;
   const ancestors=new Set([selected.id]);let current=selected;
   while(current.graph?.parentId){
    const parent=scene(pack,current.graph.parentId);
    if(parent.worldId!==selected.worldId)throw Error('Child scenes must stay inside their parent world.');
    if(ancestors.has(parent.id))throw Error('Scene hierarchy contains a cycle.');
    ancestors.add(parent.id);current=parent;
   }
   if(graph.rendering){const catalog=(typeof module!=='undefined'&&module.exports?require('./renderer-catalog.js'):root.LWRendererCatalog) as LittlewildRenderer.Catalog,metadata=catalog.list().find(row=>row.id===graph.rendering!.rendererId);if(metadata?.dimensions&&!metadata.dimensions.includes(graph.rendering.dimension))throw Error('Renderer '+metadata.id+' does not support dimension '+graph.rendering.dimension+'.');}
   const embedIds=new Set<string>();
   for(const embed of graph.rendering?.embeds??[]){
    const target=scene(pack,embed.sceneId);
    if(embedIds.has(embed.id))throw Error('Duplicate embedded view ID.');embedIds.add(embed.id);
    if(target.graph?.rendering?.dimension!=='2d')throw Error('Embedded views must reference a 2d scene.');
   }
   checkRequirements(graph.requirements);
   for(const trigger of graph.triggers??[])checkRequirements(trigger.requirements);
   const propIds=new Set<string>(),assets=rows(pack.resources?.assets??root.LWAssets.defaults);
   for(const prop of graph.props??[]){
    const asset=assets.find(row=>row.id===prop.assetId&&row.category===prop.category);
    if(propIds.has(prop.id))throw Error('Duplicate scene prop ID.');propIds.add(prop.id);
    if(!asset||!Object.hasOwn(record(asset.models),prop.model))throw Error('Scene prop references an unknown asset or model.');
    const bounds=graph.bounds;if(bounds&&(prop.x<bounds.x||prop.y<bounds.y||prop.x>=bounds.x+bounds.width||prop.y>=bounds.y+bounds.height))throw Error('Scene prop lies outside scene bounds.');
   }
   const connectionIds=new Set<string>();
   for(const link of graph.connections??[]){
    scene(pack,link.targetSceneId);checkRequirements(link.requirements);
    if(connectionIds.has(link.id))throw Error('Duplicate scene connection '+link.id+'.');
    connectionIds.add(link.id);
   }
   const bounds=graph.bounds;
   if(bounds&&graph.parentId&&graph.binding?.type!=='interior'){
    const parentBounds=scene(pack,graph.parentId).graph?.bounds;
    if(parentBounds&&(bounds.x<parentBounds.x||bounds.y<parentBounds.y||bounds.x+bounds.width>parentBounds.x+parentBounds.width||bounds.y+bounds.height>parentBounds.y+parentBounds.height))
     throw Error('Child scene bounds must fit inside parent bounds.');
   }
   const binding=graph.binding;
   if(!binding){if(graph.kind==='interior'||graph.kind==='island')throw Error('Interior and island scenes require a native authority binding.');continue;}
   if(binding.type!==graph.kind)throw Error('Scene kind must match its binding.');
   const source=scene(pack,binding.sourceSceneId);
   if(source.id===selected.id||source.graph?.binding)throw Error('Scene binding must reference an unbound source scene.');
   if(source.worldId!==selected.worldId)throw Error('A bound scene must share its source world.');
   if(!ancestors.has(source.id))throw Error('A bound scene must descend from its source scene.');
   if(Object.keys(selected.initialState).length)throw Error('Bound scenes use their source state; initialState must be empty.');
   if(binding.type==='island'){
    if(!rows(record(source.initialState.estate).islands).some(row=>row.ix===binding.ix&&row.iy===binding.iy))throw Error('Scene island binding references unowned land.');
   }else{
    const building=rows(source.initialState.buildings).find(row=>row.id===binding.buildingId);
    const floor=building?rows(layout(source.initialState,building).floors).find(floor=>floor.id===binding.floorId):undefined;
    if(!floor)throw Error('Scene interior binding references a missing building or floor.');
    if(bounds&&(bounds.x<0||bounds.y<0||bounds.x+bounds.width>Number(floor.width)||bounds.y+bounds.height>Number(floor.height)))throw Error('Interior scene bounds must fit inside its canonical floor.');
    for(const prop of graph.props??[])if(prop.x<0||prop.y<0||prop.x>=Number(floor.width)||prop.y>=Number(floor.height)||Array.isArray(floor.cells)&&!rows(floor.cells).some(cell=>cell.x===prop.x&&cell.y===prop.y))throw Error('Interior props must lie on a canonical floor cell.');
   }
  }
 }
 function sceneBounds(pack:LWContentPorts.ScenarioPack,id:string):LWSceneGraph.Bounds|undefined {
  const selected=scene(pack,id);if(selected.graph?.bounds)return structuredClone(selected.graph.bounds);
  const binding=selected.graph?.binding;
  if(binding?.type==='island')return {x:binding.ix*23,y:binding.iy*23,width:19,height:19};
  if(binding?.type==='interior'){
   const state=owner(pack,id).initialState,building=rows(state.buildings).find(row=>row.id===binding.buildingId);
   const floor=building?rows(layout(state,building).floors).find(row=>row.id===binding.floorId):undefined;
   if(!floor)throw Error('Scene interior binding references a missing building or floor.');
   return {x:0,y:0,width:Number(floor.width),height:Number(floor.height)};
  }
  return undefined;
 }
 function entities(pack:LWContentPorts.ScenarioPack,id:string):LWSceneGraph.Entity[] {
  const selected=scene(pack,id),state=owner(pack,id).initialState;
  const result:LWSceneGraph.Entity[]=[];
  for(const category of ['creatures','buildings','nodes'] as const){
   const values=category==='creatures'?record(state.colony).creatures:state[category];
   for(const data of rows(values)){
    const point=category==='creatures'?record(data.creature):data;
    result.push({id:String(data.id),name:String(data.name??data.kind??data.id),kind:String(data.kind??data.personality??'creature'),x:Number(point.x),y:Number(point.y),category,data:structuredClone(data)});
   }
  }
  for(const prop of selected.graph?.props??[])result.push({id:prop.id,name:prop.name,kind:prop.assetId,x:prop.x,y:prop.y,category:'props',data:structuredClone(prop) as unknown as Record<string,unknown>});
  const binding=selected.graph?.binding;
  if(binding?.type==='interior'){
   const locations=record(record(state.interiors).locations);
   const building=rows(state.buildings).find(row=>row.id===binding.buildingId)!;
   const floorId=binding.floorId;
   return result.filter(entity=>entity.category==='props'||(entity.category==='creatures'&&record(locations[entity.id]).buildingId===binding.buildingId&&record(locations[entity.id]).floorId===floorId))
    .map(entity=>entity.category==='props'?entity:({...entity,x:Number(record(locations[entity.id]).x),y:Number(record(locations[entity.id]).y)}));
  }
  const bounds=sceneBounds(pack,id);
  return bounds?result.filter(entity=>entity.x>=bounds.x&&entity.y>=bounds.y&&entity.x<bounds.x+bounds.width&&entity.y<bounds.y+bounds.height):result;
 }
 function entryIssue(requirements:LWSceneGraph.Requirement[]|undefined,state:Record<string,unknown>):string|null {
  for(const rule of requirements??[]){
   if(rule.type==='player-level'&&Number(record(state.player).level)<rule.minimum)return 'Guide level '+rule.minimum+' required.';
   if(rule.type==='quest-complete'&&!(Array.isArray(state.completedQuests)&&state.completedQuests.includes(rule.questId))&&!rows(record(state.colony).creatures).some(actor=>rows(actor.questHistory).some(report=>report.questId===rule.questId&&report.outcome==='Completed'))&&!rows(record(state.atlas).history).some(report=>report.questId===rule.questId&&report.outcome==='completed'))return 'Complete '+rule.questId+' before entering.';
   if(rule.type==='building'&&!rows(state.buildings).some(row=>row.kind===rule.kind))return 'A '+rule.kind+' building is required.';
   if(rule.type==='item'){
    const quantity=rows(record(state.colony).creatures).reduce((sum,actor)=>sum+Number(record(actor.inventory)[rule.itemId]??0),0);
    if(quantity<rule.quantity)return rule.quantity+' '+rule.itemId+' required across companion inventories.';
   }
  }
  return null;
 }
 const api:LWSceneGraph.Api={validate,owner,bounds:sceneBounds,entities,entryIssue};root.LWSceneGraph=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
