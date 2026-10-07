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
  LWRenderers?:{list():readonly LittlewildDeveloper.RendererMetadata[];validate(input:unknown):LittlewildDeveloper.RendererValidation};
  LWAnimations?:{list():readonly LWAnimations.Metadata[];validate(input:unknown):readonly LWAnimations.Descriptor[]};LWEngineExport?:LWEngineExport.Api;LWBalancing?:LWBalancing.Api;LWDeveloperStorytelling?:LittlewildDeveloper.StorytellingTools;LWDeveloperCreatures?:LWCreatureEditor.Api;LWContent:LWContentPorts.ContentApi;LWExternalEditors?:LWExternalEditors.Api;
  LWAssets:AssetPort;LWDeveloper?:LittlewildDeveloper.Toolbox;
 };
 const D=root.LWDeveloperData;
 // Optional facets: a play-only artifact may omit the editors, export or renderer bundles.
 // Absent facets stay on the frozen toolbox but reject every use with an explicit reason.
 // Each facet names its global explicitly (no computed global lookup) and is resolved at use time.
 const FACETS={
  engineExport:{get:()=>root.LWEngineExport,label:'engine export',bundle:'export'},
  balancing:{get:()=>root.LWBalancing,label:'balancing tools',bundle:'editors'},
  storytelling:{get:()=>root.LWDeveloperStorytelling,label:'storytelling tools',bundle:'editors'},
  creatureEditor:{get:()=>root.LWDeveloperCreatures,label:'creature editor',bundle:'editors'},
  externalEditors:{get:()=>root.LWExternalEditors,label:'external editor exchange',bundle:'editors'},
  animations:{get:()=>root.LWAnimations,label:'animation discovery',bundle:'renderers'},
  renderers:{get:()=>root.LWRenderers,label:'renderer discovery',bundle:'renderers'}
 } as const;
 type FacetId=keyof typeof FACETS;
 interface Capability {id:FacetId;label:string;available:boolean;reason?:string;}
 const unavailableReason=(id:FacetId):string=>'The '+FACETS[id].label+' capability is unavailable in this build: the '+FACETS[id].bundle+' bundle is not included.';
 const unavailable=(id:FacetId):LittlewildDeveloper.DeveloperError=>new D.DeveloperError('operation-failed',unavailableReason(id));
 type FacetValue<K extends FacetId>=NonNullable<ReturnType<(typeof FACETS)[K]['get']>>;
 function facet<K extends FacetId>(id:K):FacetValue<K> {
  const value=FACETS[id].get();if(value===undefined)throw unavailable(id);
  return value as FacetValue<K>;
 }
 /** A stand-in whose every member access names the missing bundle instead of failing obscurely. */
 function absent<T extends object>(id:FacetId):T {
  return new Proxy(Object.freeze({}) as T,{get(_target,key){if(typeof key==='symbol'||key==='then'||key==='toJSON')return undefined;throw unavailable(id);}});
 }
 function capabilities():Capability[] {
  return (Object.keys(FACETS) as FacetId[]).map(id=>{
   const label=FACETS[id].label,present=FACETS[id].get()!==undefined;
   if(!present)return {id,label,available:false,reason:unavailableReason(id)};
   // Engine export also depends on the opt-in trusted engine-source payload.
   const payload=id==='engineExport'?root.LWEngineExport!.capability():{available:true};
   return payload.available?{id,label,available:true}:{id,label,available:false,reason:payload.reason??unavailableReason(id)};
  });
 }
 function category(value:unknown):Category {
  if(value!=='actor'&&value!=='building'&&value!=='item'&&value!=='pet')throw new D.DeveloperError('invalid-input','Asset category must be actor, building, item or pet.');
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
  list:()=>facet('renderers').list().map(value=>({...value,capabilities:[...value.capabilities],...(value.dimensions?{dimensions:[...value.dimensions]}:{})})),
  validate(input:unknown){
   try{const checked=facet('renderers').validate(D.record(input));return {...checked,errors:[...checked.errors],data:checked.data===null?null:{...checked.data,capabilities:[...checked.data.capabilities],...(checked.data.dimensions?{dimensions:[...checked.data.dimensions]}:{})}};}
   catch(error){return {ok:false,errors:[error instanceof Error?error.message:String(error)],data:null};}
  }
 });
 const animations:LittlewildDeveloper.AnimationDiscovery=Object.freeze({list:()=>root.LWContent.copy(facet('animations').list()),validate(input:unknown){try{return {ok:true,errors:[],data:root.LWContent.copy(facet('animations').validate(input))};}catch(error){return {ok:false,errors:[error instanceof Error?error.message:String(error)],data:null};}}});
 const externalEditors:LWExternalEditors.Api=Object.freeze({
  formats:()=>root.LWContent.copy(facet('externalEditors').formats()),
  detect:(input:unknown)=>facet('externalEditors').detect(input),
  export:(pack:unknown,sceneId:string,format:LWExternalEditors.Format)=>root.LWContent.copy(facet('externalEditors').export(pack,sceneId,format)),
  import:(input:unknown,options?:LWExternalEditors.Options)=>root.LWContent.copy(facet('externalEditors').import(input,options))
 });
 const {version,fixedStep,maxSteps,scenarios,commands,create,validateScenario,createScenario,
  createSceneEditor,reviewStory,openStory,creatures,validateCreature,interiors,validateInteriorCatalog,validateBuildingDesign,interactions,validateInteraction,validateInteractionLibrary}=root.LWDeveloperSession;
 const E=root.LWEngineExport,S=root.LWDeveloperStorytelling,C=root.LWDeveloperCreatures;
 const engineExport:LWEngineExport.Api=Object.freeze(E?{export:E.export,validate:E.validate,maxBytes:E.maxBytes,capability:E.capability}:{
  export:()=>Promise.reject(unavailable('engineExport')),validate:async()=>({ok:false as const,errors:[unavailableReason('engineExport')]}),maxBytes:0,
  capability:()=>({available:false,reason:unavailableReason('engineExport')})
 });
 const storytelling:LittlewildDeveloper.StorytellingTools=S?Object.freeze({inspect:S.inspect,createEditor:S.createEditor,createPlayback:S.createPlayback,sample:S.sample}):absent('storytelling');
 const api:LittlewildDeveloper.Toolbox&{capabilities():Capability[]}=Object.freeze({animations,engineExport,balancing:root.LWBalancing?Object.freeze(root.LWBalancing):absent<LWBalancing.Api>('balancing'),storytelling,
  createCreatureEditor:C?C.create:(input:unknown,selection:LWCreatureEditor.Selection)=>facet('creatureEditor').create(input,selection),
  validateCreaturePackage:C?C.validatePackage:(input:unknown,context?:{pack:LWContentPorts.ScenarioPack;selection:LWCreatureEditor.Selection})=>facet('creatureEditor').validatePackage(input,context),
  capabilities,failureCodes:()=>[...root.LWRuntimeResults.codes],version,fixedStep,maxSteps,scenarios,commands,
  create,validateScenario,createScenario,createSceneEditor,reviewStory,openStory,creatures,validateCreature,interiors,validateInteriorCatalog,validateBuildingDesign,interactions,validateInteraction,validateInteractionLibrary,assets,renderers,externalEditors});
 root.LWDeveloper=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
