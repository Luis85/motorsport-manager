/* Application authoring authority: bounded detached revisions and atomic pack exchange. */
(function(inputRoot:unknown){
 'use strict';
 interface Root {LWStorytellingValidation:{reconcile(before:LWContentPorts.ScenarioPack,next:LWContentPorts.ScenarioPack):void};LWCanvasAuthoring:LWCanvasAuthoring.Api;LW:{Engine:{import(input:unknown):LWContentPorts.ScenarioEngine}};LWWorldProfile:{withProfile<T>(profile:LWContentPorts.WorldProfile,work:()=>T):T};LWScenarioResources:{withResources<T>(resources:LWContentPorts.Resources|undefined,work:()=>T):T};LWContent:LWContentPorts.ContentApi;LWScenarios:LWContentPorts.ScenarioApi;LWSceneGraph:LWSceneGraph.Api;LWSceneEditor?:LWSceneEditor.Api;}
 const root=inputRoot as Root;
 const node=typeof module!=='undefined'&&module.exports;
 const X=(node?require('./scenario-runtime.js'):root.LWScenarios) as LWContentPorts.ScenarioApi;
 const G=(node?require('./scene-graph.js'):root.LWSceneGraph) as LWSceneGraph.Api;
 const copy=root.LWContent.copy;
 const record=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
 function accepted(input:unknown):LWContentPorts.ScenarioPack {
  const result=X.validate(input);
  if(!result.ok)throw Error(result.errors.join('\n'));
  return result.pack;
 }
 function create(input:unknown):LWSceneEditor.Session {
  let draft=accepted(input),revision=0;
  const previous:LWContentPorts.ScenarioPack[]=[],future:LWContentPorts.ScenarioPack[]=[];
  function change(edit:(next:LWContentPorts.ScenarioPack)=>void,validate=false):void {
   const next=copy(draft);edit(next);root.LWCanvasAuthoring.reconcile(draft,next);root.LWStorytellingValidation.reconcile(draft,next);
   if(validate)accepted(next);
   // JSON value preflight rejects functions, unsafe own keys and oversized drafts.
   root.LWContent.parse(next,8*1024*1024);
   previous.push(draft);if(previous.length>20)previous.shift();future.length=0;draft=next;revision++;
  }
  function selected(pack:LWContentPorts.ScenarioPack,id:string):LWContentPorts.Scene {
   const row=pack.scenes.find(scene=>scene.id===id);
   if(!row)throw Error('Choose an existing scene.');
   return row;
  }
  function entity(pack:LWContentPorts.ScenarioPack,sceneId:string,category:LWSceneEditor.Category,id:string):Record<string,unknown> {
   if(category==='props'){const prop=selected(pack,sceneId).graph?.props?.find(row=>row.id===id);if(!prop)throw Error('Choose an existing prop.');return prop as unknown as Record<string,unknown>;}
   const state=G.owner(pack,sceneId).initialState;
   const values=category==='creatures'?record(state.colony).creatures:state[category];
   const row=Array.isArray(values)?values.find(value=>record(value).id===id):undefined;
   if(!row)throw Error('Choose an existing entity.');
   return record(row);
  }
  function values(pack:LWContentPorts.ScenarioPack,sceneId:string,category:LWSceneEditor.Category):Record<string,unknown>[] {
   if(category==='props'){const scene=selected(pack,sceneId);scene.graph??={kind:'level'};scene.graph.props??=[];return scene.graph.props as unknown as Record<string,unknown>[];}
   const state=G.owner(pack,sceneId).initialState;
   const list=category==='creatures'?record(state.colony).creatures:state[category];
   if(!Array.isArray(list))throw Error('This scene has no '+category+' collection.');
   return list as Record<string,unknown>[];
  }
  function canonicalizeCreation(pack:LWContentPorts.ScenarioPack,sceneId:string):void {
   const source=G.owner(pack,sceneId),world=pack.worlds.find(world=>world.id===source.worldId)!;
   // Native reconstruction owns assignment/default normalization. Authoring never
   // duplicates housing/path rules or activates the detached imported engine.
   source.initialState=root.LWScenarioResources.withResources(pack.resources,()=>X.withRuntime(pack.libraries,pack.simulation,()=>root.LWWorldProfile.withProfile(world,
    ()=>root.LW.Engine.import({app:'littlewild',version:8,state:source.initialState}).export().state)));
  }
  const session:LWSceneEditor.Session={
   get revision(){return revision;},get canUndo(){return previous.length>0;},get canRedo(){return future.length>0;},
   snapshot:()=>copy(draft),export:()=>copy(accepted(draft)),validate:()=>X.validate(draft),
   replace(value){const next=accepted(value);change(pack=>{for(const key of Object.keys(pack))delete (pack as unknown as Record<string,unknown>)[key];Object.assign(pack,next);});},
   updateScene(id,patch){change(pack=>{if(patch.id&&patch.id!==id)throw Error('Scene IDs are stable; create a new scene to change identity.');Object.assign(selected(pack,id),copy(patch));});},
   updateWorld(id,patch){change(pack=>{const world=pack.worlds.find(row=>row.id===id);if(!world)throw Error('Choose an existing world.');if(patch.id&&patch.id!==id)throw Error('World IDs are stable.');Object.assign(world,copy(patch));});},
   addWorld(template,id,name){change(pack=>{if(pack.worlds.some(row=>row.id===id))throw Error('World ID already exists.');pack.worlds.push({...copy(template),id,name});},true);},
   addScene(template,id,worldId,parentId){change(pack=>{
    if(pack.scenes.some(row=>row.id===id))throw Error('Scene ID already exists.');
    const row={...copy(template),id,worldId};
    row.graph={...row.graph,kind:row.graph?.kind??'level'};
    if(parentId)row.graph.parentId=parentId;else delete row.graph.parentId;
    pack.scenes.push(row);
   },true);},
   removeScene(id){change(pack=>{
    if(pack.scenes.some(row=>row.graph?.parentId===id||row.graph?.binding?.sourceSceneId===id||row.graph?.connections?.some(link=>link.targetSceneId===id)))throw Error('Remove child scenes, bindings and connections before deleting this scene.');
    const index=pack.scenes.findIndex(row=>row.id===id);if(index<0)throw Error('Choose an existing scene.');pack.scenes.splice(index,1);
   },true);},
   removeWorld(id){change(pack=>{if(pack.scenes.some(row=>row.worldId===id))throw Error('Move or remove this world’s scenes before deleting it.');const at=pack.worlds.findIndex(row=>row.id===id);if(at<0)throw Error('Choose an existing world.');pack.worlds.splice(at,1);},true);},
   entities:sceneId=>G.entities(draft,sceneId),
   place(sceneId,category,id,x,y){change(pack=>{
    const scene=selected(pack,sceneId);
    if(category!=='props'&&scene.graph?.binding?.type==='interior')throw Error('Interior positions belong to the building layout and visit/work authority. Edit its construction design.');
    if(!Number.isInteger(x)||!Number.isInteger(y))throw Error('Choose a whole grid cell.');
    const bounds=scene.graph?.bounds;
    if(bounds&&(x<bounds.x||y<bounds.y||x>=bounds.x+bounds.width||y>=bounds.y+bounds.height))throw Error('Place the entity inside scene bounds.');
    const row=entity(pack,sceneId,category,id),point=category==='creatures'?record(row.creature):row;
    point.x=x;point.y=y;
   },true);},
   setEntity(sceneId,category,id,patch){change(pack=>{
    if(patch.id&&patch.id!==id)throw Error('Entity IDs are stable.');
    Object.assign(entity(pack,sceneId,category,id),copy(patch));
   },true);},
   addProp(sceneId,prop){change(pack=>{const list=values(pack,sceneId,'props');if(list.some(row=>row.id===prop.id))throw Error('Prop ID already exists.');list.push(copy(prop) as unknown as Record<string,unknown>);},true);},
   addEntity(sceneId,category,templateId,id,x,y){change(pack=>{
    const list=values(pack,sceneId,category);
    if(list.some(row=>row.id===id))throw Error('Entity ID already exists.');
    const row=copy(entity(pack,sceneId,category,templateId));row.id=id;
    if(category==='creatures'){
     row.name=id;row.task=null;row.orders=[];row.training=null;row.questPlan=null;row.activeQuest=null;row.homeId=null;row.eventInteractions=[];
     const state=G.owner(pack,sceneId).initialState,colony=record(state.colony),progression=record(state.progression);
     progression.slots=Math.max(Number(progression.slots),list.length+1);
     colony.purchased=Math.max(Number(colony.purchased),list.length+1);
     const sequence=/^c([0-9]+)$/.exec(id);if(sequence)colony.nextCreatureId=Math.max(Number(colony.nextCreatureId),Number(sequence[1])+1);
    }
    if(x!==undefined&&y!==undefined){const point=category==='creatures'?record(row.creature):row;point.x=x;point.y=y;}
    list.push(row);canonicalizeCreation(pack,sceneId);
   },true);},
   removeEntity(sceneId,category,id){change(pack=>{
    const list=values(pack,sceneId,category),at=list.findIndex(row=>row.id===id);
    if(at<0)throw Error('Choose an existing entity.');list.splice(at,1);
   },true);},
   undo(){const prior=previous.pop();if(prior){future.push(draft);draft=prior;revision++;}},
   redo(){const next=future.pop();if(next){previous.push(draft);draft=next;revision++;}}
  };
  return session;
 }
 const api:LWSceneEditor.Api={create};root.LWSceneEditor=api;if(node)module.exports=api;
})(globalThis);
