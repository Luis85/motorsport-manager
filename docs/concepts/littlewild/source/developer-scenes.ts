/// <reference path="./developer-contracts.d.ts" />
/* Detached draft adapter and scene discovery; trusted transition engines stay private. */
(function(inputRoot:unknown){
 'use strict';
 interface Root {
  LWContent:LWContentPorts.ContentApi;LWSceneEditor:LWSceneEditor.Api;LWSceneNavigation:LWSceneNavigation.NavigationApi;
  LWSceneProps:{read(engine:LWContentPorts.ScenarioEngine):LWSceneGraph.Prop[]};
  LWDeveloperScenes?:unknown;
 }
 const root=inputRoot as Root,copy=root.LWContent.copy;
 function create(input:unknown):LittlewildDeveloper.SceneEditor {
  const owned=root.LWSceneEditor.create(input);
  return Object.freeze({
   get revision(){return owned.revision;},get canUndo(){return owned.canUndo;},get canRedo(){return owned.canRedo;},
   snapshot:()=>copy(owned.snapshot()),export:()=>copy(owned.export()),validate:()=>copy(owned.validate()),
   replace:(value:unknown)=>owned.replace(value),
   updateScene:(id:string,patch:Partial<LWContentPorts.Scene>)=>owned.updateScene(id,copy(patch)),
   updateWorld:(id:string,patch:Partial<LWContentPorts.WorldProfile>)=>owned.updateWorld(id,copy(patch)),
   addWorld:(template:LWContentPorts.WorldProfile,id:string,name:string)=>owned.addWorld(copy(template),id,name),
   addScene:(template:LWContentPorts.Scene,id:string,worldId:string,parentId?:string)=>owned.addScene(copy(template),id,worldId,parentId),
   removeScene:(id:string)=>owned.removeScene(id),removeWorld:(id:string)=>owned.removeWorld(id),
   entities:(id:string)=>copy(owned.entities(id)),
   place:(sceneId:string,category:LWSceneEditor.Category,id:string,x:number,y:number)=>owned.place(sceneId,category,id,x,y),
   setEntity:(sceneId:string,category:LWSceneEditor.Category,id:string,patch:Record<string,unknown>)=>owned.setEntity(sceneId,category,id,copy(patch)),
   addProp:(sceneId:string,prop:LWSceneGraph.Prop)=>owned.addProp(sceneId,copy(prop)),
   addEntity:(sceneId:string,category:LWSceneEditor.Category,templateId:string,id:string,x?:number,y?:number)=>owned.addEntity(sceneId,category,templateId,id,x,y),
   removeEntity:(sceneId:string,category:LWSceneEditor.Category,id:string)=>owned.removeEntity(sceneId,category,id),
   undo:()=>owned.undo(),redo:()=>owned.redo()
  });
 }
 function connections(engine:LWContentPorts.ScenarioEngine):LittlewildDeveloper.SceneConnection[] {
  const context=engine.scenarioContext,pack=context?.journey?.pack;
  const source=pack?.scenes.find(scene=>scene.id===context?.sceneId);
  return (source?.graph?.connections??[]).map(link=>{
   const reason=root.LWSceneNavigation.connectionIssue(engine,link.id);
   return {id:link.id,label:link.label,targetSceneId:link.targetSceneId,available:reason===null,reason};
  });
 }
 const api={create,connections,props:(engine:LWContentPorts.ScenarioEngine)=>copy(root.LWSceneProps.read(engine))};
 root.LWDeveloperScenes=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
