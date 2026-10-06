/// <reference path="./developer-contracts.d.ts" />
/* Developer-facing composition; asset queries stay outside the simulation application layer. */
(function(inputRoot:unknown){
 'use strict';
 type Category=LittlewildDeveloper.AssetCategory;
 type Document=LittlewildDeveloper.Document;
 interface AssetPort {all():unknown[];get(category:Category,id:string):unknown;validate(input:unknown):unknown;}
 const root=inputRoot as {
  LWDeveloperSession:LittlewildDeveloper.SessionApi;
  LWDeveloperData:{record(value:unknown):Document;text(value:unknown,label:string):string;DeveloperError:new(code:LittlewildDeveloper.ErrorCode,message:string)=>LittlewildDeveloper.DeveloperError};
  LWRuntimeResults:LWRuntime.ResultsApi;
  LWRenderers:{list():readonly LittlewildDeveloper.RendererMetadata[];validate(input:unknown):LittlewildDeveloper.RendererValidation};
  LWAnimations:{list():readonly LWAnimations.Metadata[];validate(input:unknown):readonly LWAnimations.Descriptor[]};LWEngineExport:LWEngineExport.Api;LWBalancing:LWBalancing.Api;LWDeveloperStorytelling:LittlewildDeveloper.StorytellingTools;LWDeveloperCreatures:LWCreatureEditor.Api;LWContent:LWContentPorts.ContentApi;LWExternalEditors:LWExternalEditors.Api;
  LWAssets:AssetPort;LWDeveloper?:LittlewildDeveloper.Toolbox;
 };
 const D=root.LWDeveloperData;
 function category(value:unknown):Category {
  if(value!=='actor'&&value!=='building'&&value!=='item')throw new D.DeveloperError('invalid-input','Asset category must be actor, building or item.');
  return value;
 }
 const assets:LittlewildDeveloper.AssetApi=Object.freeze({
  list(filter?:Category){
   const selected=filter===undefined?null:category(filter);
   return root.LWAssets.all().map(D.record).filter(asset=>!selected||asset.category===selected).map(asset=>({
    category:category(asset.category),id:D.text(asset.id,'Asset ID'),name:D.text(asset.name,'Asset name'),models:Object.keys(D.record(asset.models))
   }));
  },
  get(family:Category,id:string){
   const found=root.LWAssets.get(category(family),D.text(id,'Asset ID'));return found?D.record(found):null;
  },
  validate(input:unknown){
   try{return {ok:true,errors:[],data:D.record(root.LWAssets.validate(D.record(input)))};}
   catch(error){return {ok:false,errors:[error instanceof Error?error.message:String(error)],data:null};}
  }
 });
 const renderers:LittlewildDeveloper.RendererDiscovery=Object.freeze({
  list:()=>root.LWRenderers.list().map(value=>({...value,capabilities:[...value.capabilities],...(value.dimensions?{dimensions:[...value.dimensions]}:{})})),
  validate(input:unknown){
   try{const checked=root.LWRenderers.validate(D.record(input));return {...checked,errors:[...checked.errors],data:checked.data===null?null:{...checked.data,capabilities:[...checked.data.capabilities],...(checked.data.dimensions?{dimensions:[...checked.data.dimensions]}:{})}};}
   catch(error){return {ok:false,errors:[error instanceof Error?error.message:String(error)],data:null};}
  }
 });
 const animations:LittlewildDeveloper.AnimationDiscovery=Object.freeze({list:()=>root.LWContent.copy(root.LWAnimations.list()),validate(input:unknown){try{return {ok:true,errors:[],data:root.LWContent.copy(root.LWAnimations.validate(input))};}catch(error){return {ok:false,errors:[error instanceof Error?error.message:String(error)],data:null};}}});
 const externalEditors:LWExternalEditors.Api=Object.freeze({
  formats:()=>root.LWContent.copy(root.LWExternalEditors.formats()),
  detect:(input:unknown)=>root.LWExternalEditors.detect(input),
  export:(pack:unknown,sceneId:string,format:LWExternalEditors.Format)=>root.LWContent.copy(root.LWExternalEditors.export(pack,sceneId,format)),
  import:(input:unknown,options?:LWExternalEditors.Options)=>root.LWContent.copy(root.LWExternalEditors.import(input,options))
 });
 const {version,fixedStep,maxSteps,scenarios,commands,create,validateScenario,createScenario,
  createSceneEditor,reviewStory,openStory,creatures,validateCreature,interiors,validateInteriorCatalog,validateBuildingDesign,interactions,validateInteraction,validateInteractionLibrary}=root.LWDeveloperSession;
 const api:LittlewildDeveloper.Toolbox=Object.freeze({animations,engineExport:Object.freeze({export:root.LWEngineExport.export,validate:root.LWEngineExport.validate,maxBytes:root.LWEngineExport.maxBytes}),balancing:Object.freeze(root.LWBalancing),storytelling:Object.freeze({inspect:root.LWDeveloperStorytelling.inspect,createEditor:root.LWDeveloperStorytelling.createEditor,createPlayback:root.LWDeveloperStorytelling.createPlayback,sample:root.LWDeveloperStorytelling.sample}),createCreatureEditor:root.LWDeveloperCreatures.create,validateCreaturePackage:root.LWDeveloperCreatures.validatePackage,failureCodes:()=>[...root.LWRuntimeResults.codes],version,fixedStep,maxSteps,scenarios,commands,
  create,validateScenario,createScenario,createSceneEditor,reviewStory,openStory,creatures,validateCreature,interiors,validateInteriorCatalog,validateBuildingDesign,interactions,validateInteraction,validateInteractionLibrary,assets,renderers,externalEditors});
 root.LWDeveloper=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
