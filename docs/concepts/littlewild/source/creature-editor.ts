/// <reference path="./creature-editor-contracts.d.ts" />
/// <reference path="./skill-tree-contracts.d.ts" />
/* Detached bounded revisions; domain validators remain the only acceptance authority. */
(function(inputRoot:unknown){
 'use strict';
 type Data=LWCreatureEditor.Data;
 interface Catalog<T>{validate(input:unknown):T;}
 interface Root {LWContent:LWContentPorts.ContentApi;LWScenarios:LWContentPorts.ScenarioApi;LWSceneGraph:LWSceneGraph.Api;LWAssets:Catalog<LWCreatureEditor.Appearance>;LWCreatures:Catalog<LWCreatureEditor.Definition>&{optionalPersonalFields:readonly string[]};LWSkillTrees:LWSkillTrees.Api;LW:{Engine:{import(input:unknown):LWContentPorts.ScenarioEngine}};LWWorldProfile:{withProfile<T>(profile:LWContentPorts.WorldProfile,work:()=>T):T};LWScenarioResources:{snapshot():LWContentPorts.Resources;withResources<T>(resources:LWContentPorts.Resources|undefined,work:()=>T):T};LWCreatureEditorFields:{fields(value:LWCreatureEditor.Package):LWCreatureEditor.Field[]};LWCreatureEditor?:LWCreatureEditor.Api;}
 const root=inputRoot as Root,node=typeof module!=='undefined'&&module.exports;
 const X=(node?require('./scenario-runtime.js'):root.LWScenarios) as LWContentPorts.ScenarioApi;
 const G=(node?require('./scene-graph.js'):root.LWSceneGraph) as LWSceneGraph.Api;
 const A=(node?require('./asset-catalog.js'):root.LWAssets) as Catalog<LWCreatureEditor.Appearance>;
 const D=(node?require('./creature-catalog.js'):root.LWCreatures) as Root['LWCreatures'];
 if(node&&!root.LWSkillTrees)require('./skill-trees.js');
 const F=(node?require('./creature-editor-fields.js'):root.LWCreatureEditorFields) as Root['LWCreatureEditorFields'];
 const C=root.LWContent,copy=C.copy;
 const record=(value:unknown):Data=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Data:{};
 function accepted(input:unknown):LWContentPorts.ScenarioPack {const check=X.validate(input);if(!check.ok)throw Error(check.errors.join('\n'));return check.pack;}
 function references(pack:LWContentPorts.ScenarioPack):unknown[]{return copy(pack.resources?.assets.filter(row=>record(row).category==='item')??[]);}
 function actor(pack:LWContentPorts.ScenarioPack,selection:LWCreatureEditor.Selection):Data {
  const list=record(G.owner(pack,selection.sceneId).initialState.colony).creatures;
  const value=Array.isArray(list)?list.find(row=>record(row).id===selection.instanceId):undefined;
  if(!value)throw Error('Choose an existing companion in this scene.');return record(value);
 }
 function readPackage(input:unknown):LWCreatureEditor.Package {
  const value=record(C.parse(input,2*1024*1024)),keys=['format','schemaVersion','gameplayDefinition','appearanceManifest','assetReferences','selectedInstance'];
  if(Object.keys(value).some(key=>!keys.includes(key))||value.format!=='littlewild-creature-package'||value.schemaVersion!==1||!Array.isArray(value.assetReferences))throw Error('Use a version 1 Littlewild creature package with gameplay, appearance and asset references.');
  const definition=D.validate(value.gameplayDefinition),appearance=A.validate(value.appearanceManifest);
  if(appearance.category!=='actor'||definition.visualAsset!==appearance.id)throw Error('Creature visualAsset must select its package appearance manifest.');
  const appearances=record(appearance.behaviors.appearances);
  for(const personality of definition.personalities)if(!appearances[personality])throw Error('The appearance must support personality '+personality+'.');
  const refs=value.assetReferences.map(ref=>A.validate(ref));
  const identities=new Set([appearance.category+':'+appearance.id]);
  for(const ref of refs){const key=String(ref.category)+':'+ref.id;if(identities.has(key))throw Error('Duplicate package asset reference: '+key);identities.add(key);}
  if(value.selectedInstance!==undefined){
   const selected=record(value.selectedInstance);
   if(!selected.id||selected.archetype!==definition.id||!definition.personalities.includes(String(selected.personality)))throw Error('Selected companion identity must match this archetype and personality.');
   const defaults={...definition.state.defaults,...selected};delete defaults.id;
   // Instance progress is validated separately and never becomes an archetype default.
   for(const field of D.optionalPersonalFields)delete defaults[field];
   if(selected.skillTrees!==undefined)root.LWSkillTrees.validateProgress(selected.skillTrees,Number(record(selected.creature).level));
   if(selected.lastCuriosity!==undefined&&(typeof selected.lastCuriosity!=='number'||!Number.isFinite(selected.lastCuriosity)||selected.lastCuriosity<0))throw Error('Curiosity time must be a nonnegative finite timestamp.');
   D.validate({...definition,defaultPersonality:selected.personality,state:{...definition.state,defaults,modes:{founder:{},arrival:{}}}});
  }
  return copy(value) as unknown as LWCreatureEditor.Package;
 }
 function install(pack:LWContentPorts.ScenarioPack,value:LWCreatureEditor.Package,selection:LWCreatureEditor.Selection):void {
  const resources=pack.resources??copy(root.LWScenarioResources.snapshot());pack.resources=resources;
  const defs=resources.creatures.definitions,index=defs.findIndex(row=>record(row).id===value.gameplayDefinition.id);
  if(index<0)defs.push(copy(value.gameplayDefinition));else defs[index]=copy(value.gameplayDefinition);
  for(const asset of [value.appearanceManifest,...value.assetReferences]){
   const row=record(asset),at=resources.assets.findIndex(item=>record(item).id===row.id&&record(item).category===row.category);
   if(at<0)resources.assets.push(copy(asset));else resources.assets[at]=copy(asset);
  }
  if(value.selectedInstance){if(!selection.instanceId||value.selectedInstance.id!==selection.instanceId)throw Error('Imported companion ID must match the selected companion. Import archetype packages without an instance to reuse them.');const current=actor(pack,selection);for(const key of Object.keys(current))delete current[key];Object.assign(current,copy(value.selectedInstance));}
  // Embedded native catalogs and fingerprints must describe the same authored resources.
  for(const scene of pack.scenes)if(scene.initialState.scenarioResources)scene.initialState.scenarioResources=copy(resources);
 }
 function nativeInstance(pack:LWContentPorts.ScenarioPack,value:LWCreatureEditor.Package,selection:LWCreatureEditor.Selection):void {if(!value.selectedInstance)return;const source=G.owner(pack,selection.sceneId),world=pack.worlds.find(row=>row.id===source.worldId)!;const nativeState=root.LWScenarioResources.withResources(pack.resources,()=>X.withRuntime(pack.libraries,pack.simulation,()=>root.LWWorldProfile.withProfile(world,()=>root.LW.Engine.import({app:'littlewild',version:8,state:source.initialState}).export().state)));const canonical=record(nativeState.colony).creatures;const native=Array.isArray(canonical)?canonical.find(row=>record(row).id===selection.instanceId):undefined;if(C.stable(native)!==C.stable(value.selectedInstance))throw Error('Native companion validation would normalize or discard values. Keep its canonical fields and supported component values.');}
 function validatePackage(input:unknown,context?:{pack:LWContentPorts.ScenarioPack;selection:LWCreatureEditor.Selection}):LWCreatureEditor.Validation {
  try{const value=readPackage(input);if(context)context=copy(context);if(value.selectedInstance&&!context)throw Error('A selected companion package requires a captured scene context for native state validation.');if(context){const pack=copy(context.pack);install(pack,value,context.selection);accepted(pack);nativeInstance(pack,value,context.selection);}return {ok:true,errors:[],package:value};}catch(error){return {ok:false,errors:[error instanceof Error?error.message:String(error)]};}
 }
 function create(input:unknown,requested:LWCreatureEditor.Selection):LWCreatureEditor.Session {
  let pack=accepted(input),selection=copy(requested),revision=0;
  pack.resources??=copy(root.LWScenarioResources.snapshot());
  let definition=pack.resources.creatures.definitions.find(row=>record(row).id===selection.archetypeId);
  if(!definition)throw Error('Choose an existing creature archetype.');
  G.owner(pack,selection.sceneId);
  const visual=pack.resources.assets.find(row=>record(row).category==='actor'&&record(row).id===record(definition).visualAsset);
  let draft=readPackage({format:'littlewild-creature-package',schemaVersion:1,gameplayDefinition:definition,appearanceManifest:visual,assetReferences:references(pack),...(selection.instanceId?{selectedInstance:actor(pack,selection)}:{})});
  const previous:{pack:LWContentPorts.ScenarioPack;draft:LWCreatureEditor.Package;selection:LWCreatureEditor.Selection}[]=[],future:typeof previous=[];
  function commit(next:LWCreatureEditor.Package,nextSelection=selection):void {
   const checked=readPackage(next),nextPack=copy(pack);install(nextPack,checked,nextSelection);accepted(nextPack);nativeInstance(nextPack,checked,nextSelection);
   previous.push({pack,draft,selection});if(previous.length>20)previous.shift();future.length=0;pack=nextPack;draft=checked;selection=copy(nextSelection);revision++;
  }
  function selectVisual(next:LWCreatureEditor.Package,id:string):void {const found=pack.resources!.assets.find(row=>record(row).category==='actor'&&record(row).id===id);if(!found)throw Error('Choose an existing validated actor visual asset.');next.appearanceManifest=copy(found) as LWCreatureEditor.Appearance;}
  function identity(next:LWCreatureEditor.Package):LWCreatureEditor.Selection {if(next.selectedInstance&&next.selectedInstance.archetype!==next.gameplayDefinition.id){const def=pack.resources!.creatures.definitions.find(row=>record(row).id===next.selectedInstance!.archetype);if(!def)throw Error('Choose an existing validated archetype for this companion.');next.gameplayDefinition=copy(def) as LWCreatureEditor.Definition;selectVisual(next,next.gameplayDefinition.visualAsset);}return {...selection,archetypeId:next.gameplayDefinition.id};}
  function patch(target:'gameplayDefinition'|'appearanceManifest'|'selectedInstance',value:Data):void {
   value=copy(value);const next=copy(draft);if(!next[target])throw Error('Select an actual companion to edit its current values.');
   if(target==='gameplayDefinition'&&value.id!==undefined&&value.id!==draft.gameplayDefinition.id)throw Error('Use Create archetype to give a copy a new stable identity.');
   if(target==='selectedInstance'&&value.id!==undefined&&value.id!==selection.instanceId)throw Error('Companion IDs are stable.');
   Object.assign(next[target]!,copy(value));if(target==='gameplayDefinition'&&typeof value.visualAsset==='string')selectVisual(next,value.visualAsset);commit(next,identity(next));
  }
  function travel(from:typeof previous,to:typeof previous):void {const next=from.pop();if(!next)return;to.push({pack,draft,selection});pack=next.pack;draft=next.draft;selection=next.selection;revision++;}
  const session:LWCreatureEditor.Session={get revision(){return revision;},get canUndo(){return previous.length>0;},get canRedo(){return future.length>0;},get selection(){return copy(selection);},snapshot:()=>copy(draft),fields:()=>F.fields(draft),exportPackage:()=>copy(readPackage(draft)),exportScenario:()=>copy(pack),
   select(nextSelection){nextSelection=copy(nextSelection);G.owner(pack,nextSelection.sceneId);const resource=pack.resources!,def=resource.creatures.definitions.find(row=>record(row).id===nextSelection.archetypeId);if(!def)throw Error('Choose an existing archetype.');const visual=resource.assets.find(row=>record(row).category==='actor'&&record(row).id===record(def).visualAsset);commit(readPackage({format:'littlewild-creature-package',schemaVersion:1,gameplayDefinition:def,appearanceManifest:visual,assetReferences:references(pack),...(nextSelection.instanceId?{selectedInstance:actor(pack,nextSelection)}:{})}),nextSelection);},
   updateDefinition:value=>patch('gameplayDefinition',value),updateAppearance:value=>patch('appearanceManifest',value),updateInstance:value=>patch('selectedInstance',value),
   setField(id,value){const field=F.fields(draft).find(row=>row.id===id);if(!field)throw Error('Choose a supported authored field.');const next=copy(draft),target=field.target==='definition'?next.gameplayDefinition:next.selectedInstance;if(!target)throw Error('Select a companion.');let row:Data=target;for(const key of field.path.slice(0,-1)){const nextRow=row[key];if(nextRow===null||typeof nextRow!=='object'||Array.isArray(nextRow))throw Error('This authored field path is absent from the selected value.');row=nextRow as Data;}const key=field.path.at(-1)!;row[key]=copy(value);if(field.target==='definition'&&field.path.join('.')==='visualAsset')selectVisual(next,String(value));commit(next,identity(next));},
   importPackage(value){const next=readPackage(value);commit(next,{sceneId:selection.sceneId,archetypeId:next.gameplayDefinition.id,...(next.selectedInstance&&selection.instanceId?{instanceId:selection.instanceId}:{})});},
   duplicateArchetype(id,name){if(pack.resources!.creatures.definitions.some(row=>record(row).id===id)||pack.resources!.assets.some(row=>record(row).category==='actor'&&record(row).id===id))throw Error('This archetype or actor asset ID already exists. Choose a new stable ID.');const next=copy(draft);next.gameplayDefinition.id=id;next.gameplayDefinition.name=name;next.gameplayDefinition.state.defaults.archetype=id;next.gameplayDefinition.visualAsset=id;next.appearanceManifest.id=id;next.appearanceManifest.name=name;delete next.selectedInstance;commit(next,{sceneId:selection.sceneId,archetypeId:id});},
   undo:()=>travel(previous,future),redo:()=>travel(future,previous)
  };return session;
 }
 const api:LWCreatureEditor.Api={create,validatePackage};root.LWCreatureEditor=api;if(node)module.exports=api;
})(globalThis);
