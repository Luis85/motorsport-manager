/* Closed, compiled application extension plan. JSON never selects installers. */
(function(inputRoot:unknown){
 'use strict';
 interface Engine extends Function {prototype:Record<string,unknown>;import(input:unknown):unknown;}
 interface Adapter {install(engine:Engine):unknown;}
 type Role='LWCommandRouter'|'LWInteractionIntegration'|'LWGameSettings'|'LWScenarioWorkflow'|'LWScenarioResources'|'LWConstructionIntegration'|'LWTerraformIntegration'|'LWBuildingInteriorIntegration';
 interface Spec {readonly id:string;readonly role:Role;readonly after:readonly string[];readonly methods:readonly string[];readonly wraps:readonly string[];readonly staticMethods:readonly string[];readonly staticWraps:readonly string[];}
 interface Installed extends Spec {readonly predecessors:Readonly<Record<string,string>>;}
 interface Api {readonly manifest:readonly Spec[];install(engine:Engine,ids?:readonly string[]):readonly Installed[];describe(engine:Engine):readonly Installed[];}
 const root=inputRoot as Partial<Record<Role,Adapter>>&{LWApplicationAdapters?:Api};
 const adapters:Readonly<Record<Role,Adapter|undefined>>={
  get LWCommandRouter(){return root.LWCommandRouter;},get LWInteractionIntegration(){return root.LWInteractionIntegration;},
  get LWGameSettings(){return root.LWGameSettings;},get LWScenarioWorkflow(){return root.LWScenarioWorkflow;},
  get LWScenarioResources(){return root.LWScenarioResources;},get LWConstructionIntegration(){return root.LWConstructionIntegration;},
  get LWTerraformIntegration(){return root.LWTerraformIntegration;},get LWBuildingInteriorIntegration(){return root.LWBuildingInteriorIntegration;}
 };
 function spec(id:string,role:Role,after:readonly string[],methods:readonly string[],wraps:readonly string[],staticMethods:readonly string[]=[],staticWraps:readonly string[]=[]):Spec{
  return Object.freeze({id,role,after:Object.freeze([...after]),methods:Object.freeze([...methods]),wraps:Object.freeze([...wraps]),staticMethods:Object.freeze([...staticMethods]),staticWraps:Object.freeze([...staticWraps])});
 }
 const manifest:readonly Spec[]=Object.freeze([
  spec('commands','LWCommandRouter',[],['dispatchCommand'],[],['commandManifest']),
  spec('interactions','LWInteractionIntegration',['commands'],['interactionOptions','interactionState','interactionDefinitions','requestInteraction','respondInteraction','cancelInteraction','setInteractionLibrary','interactionBusy','stepInteractions','seekDuel','cancelDuelSeek','stageDuel','disableDuels','stepInteractionActor'],['care','interact','commandActor','startTask','acceptQuest','depart','suggestSocial','request','requestEquipment','teach','practice'],[],['import']),
  spec('settings','LWGameSettings',['interactions'],['setGameSettings','gameSettings'],['acceptQuest','questOfferIssue','questPlanIssue','depart','addOffer','offerForIsland','updateQuestBoard','gateIssue','handlers'],[],['import']),
  spec('scenario-workflow','LWScenarioWorkflow',['settings'],[],['handlers','returnQuest','startTask','stepWorld'],[],['import']),
  spec('scenario-resources','LWScenarioResources',['scenario-workflow'],[],[],[],['import']),
  spec('construction','LWConstructionIntegration',['scenario-resources'],['constructionOptions','previewBuildingDesign','buildingDesign','constructBuildingDesign','improveBuildingDesign'],['placementIssue','totalCost','constructionPhases','finishTask'],[],['import']),
  spec('terraform','LWTerraformIntegration',['construction'],['terrainAt','terrainHeight','terraformSnapshot','previewTerraform','applyTerraform'],[],[],['import']),
  spec('interiors','LWBuildingInteriorIntegration',['terraform','construction'],['buildingInterior','visitBuildingFloor','orderBuildingProduction'],['stepQuest','stepActor','startTask','finishTask','configureBuilding'],[],['import'])
 ]);
 const installed=new WeakMap<Engine,readonly Installed[]>(),started=new WeakSet<Engine>();
 function validate(engine:Engine,ids:readonly string[]):void{
  if(typeof engine!=='function'||!engine.prototype)throw Error('Application adapters require the composed engine facade.');
  if(started.has(engine))throw Error('Application adapters already installed or installation previously failed.');
  if(ids.length!==manifest.length||new Set(ids).size!==ids.length)throw Error('Application adapter manifest must name every adapter exactly once.');
  if(ids.some((id,index)=>id!==manifest[index]?.id))throw Error('Application adapter order does not match the compiled manifest.');
  const methods=new Set(Object.getOwnPropertyNames(engine.prototype)),statics=new Set(Object.getOwnPropertyNames(engine));
  for(const entry of manifest){
   const adapter=adapters[entry.role];if(!adapter||typeof adapter.install!=='function')throw Error('Missing application adapter role: '+entry.role);
   for(const name of entry.wraps){if(!methods.has(name)||typeof engine.prototype[name]!=='function')throw Error(entry.id+' requires method predecessor: '+name);}
   for(const name of entry.staticWraps){if(!statics.has(name)||typeof Reflect.get(engine,name)!=='function')throw Error(entry.id+' requires static predecessor: '+name);}
   for(const name of entry.methods){if(methods.has(name))throw Error('Application method already owned: '+name);methods.add(name);}
   for(const name of entry.staticMethods){if(statics.has(name))throw Error('Application static method already owned: '+name);statics.add(name);}
  }
 }
 function install(engine:Engine,ids:readonly string[]=manifest.map(entry=>entry.id)):readonly Installed[]{
  validate(engine,ids);started.add(engine);
  const owners=new Map<string,string>(),records:Installed[]=[];
  for(const entry of manifest){
   const predecessors:Record<string,string>={};
   for(const name of entry.wraps)predecessors[name]=owners.get(name)??'simulation-composition';
   for(const name of entry.staticWraps)predecessors['static:'+name]=owners.get('static:'+name)??'simulation-composition';
   const before=Object.getOwnPropertyDescriptors(engine.prototype),staticBefore=Object.getOwnPropertyDescriptors(engine);
   adapters[entry.role]!.install(engine);
   for(const [target,previous,allowed]of [[engine.prototype,before,[...entry.methods,...entry.wraps]],[engine,staticBefore,[...entry.staticMethods,...entry.staticWraps]]] as const){
    for(const name of new Set([...Object.getOwnPropertyNames(target),...Object.keys(previous)])){
     const descriptor=Object.getOwnPropertyDescriptor(target,name),prior=previous[name];
     if((descriptor?.value!==prior?.value||descriptor?.get!==prior?.get||descriptor?.set!==prior?.set||descriptor?.enumerable!==prior?.enumerable||descriptor?.configurable!==prior?.configurable||descriptor?.writable!==prior?.writable)&&!allowed.includes(name))throw Error(entry.id+' changed an undeclared method: '+name);
    }
    for(const name of allowed)if(Object.getOwnPropertyDescriptor(target,name)?.value===previous[name]?.value)throw Error(entry.id+' did not install declared method: '+name);
   }
   for(const name of [...entry.methods,...entry.wraps])owners.set(name,entry.id);
   for(const name of [...entry.staticMethods,...entry.staticWraps])owners.set('static:'+name,entry.id);
   records.push(Object.freeze({...entry,predecessors:Object.freeze(predecessors)}));
  }
  const result=Object.freeze(records);installed.set(engine,result);return result;
 }
 const api:Api=Object.freeze({manifest,install,describe:(engine:Engine)=>installed.get(engine)??Object.freeze([])});
 root.LWApplicationAdapters=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
