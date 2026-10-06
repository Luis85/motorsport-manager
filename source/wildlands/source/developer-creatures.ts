/// <reference path="./developer-contracts.d.ts" />
/* Public authoring sessions own detached packages and never receive a live engine. */
(function(inputRoot:unknown){
 'use strict';
 interface Root {LWContent:LWContentPorts.ContentApi;LWCreatureEditor:LWCreatureEditor.Api;LWDeveloperCreatures?:LWCreatureEditor.Api;}
 const root=inputRoot as Root,copy=root.LWContent.copy;
 function create(input:unknown,selection:LWCreatureEditor.Selection):LWCreatureEditor.Session {
  const owned=root.LWCreatureEditor.create(input,copy(selection));
  return Object.freeze({
   get revision(){return owned.revision;},get canUndo(){return owned.canUndo;},get canRedo(){return owned.canRedo;},get selection(){return copy(owned.selection);},
   snapshot:()=>copy(owned.snapshot()),fields:()=>copy(owned.fields()),exportPackage:()=>copy(owned.exportPackage()),exportScenario:()=>copy(owned.exportScenario()),
   select:(value:LWCreatureEditor.Selection)=>owned.select(copy(value)),setField:(id:string,value:unknown)=>owned.setField(id,copy(value)),
   updateDefinition:(patch:LWCreatureEditor.Data)=>owned.updateDefinition(copy(patch)),updateAppearance:(patch:LWCreatureEditor.Data)=>owned.updateAppearance(copy(patch)),updateInstance:(patch:LWCreatureEditor.Data)=>owned.updateInstance(copy(patch)),
   importPackage:(value:unknown)=>owned.importPackage(value),duplicateArchetype:(id:string,name:string)=>owned.duplicateArchetype(id,name),undo:()=>owned.undo(),redo:()=>owned.redo()
  });
 }
 const api:LWCreatureEditor.Api={create,validatePackage:(input,context)=>copy(root.LWCreatureEditor.validatePackage(input,context===undefined?undefined:copy(context)))};
 root.LWDeveloperCreatures=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
