/// <reference path="./wildlands-project-contracts.d.ts" />
/** Browser and terminal share one portable project admission boundary. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWScenarios:LWContentPorts.ScenarioApi;LWContent:LWContentPorts.ContentApi;WildlandsProject?:Wildlands.ProjectApi};
 const node=typeof module!=='undefined'&&module.exports;
 const X=(node?require('./scenario-runtime.js'):root.LWScenarios) as LWContentPorts.ScenarioApi;
 const C=root.LWContent,maxBytes=10*1024*1024;
 function record(input:unknown):Record<string,unknown>{
  const parsed=C.parse(input,maxBytes);
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Expected a project object.');
  return parsed as Record<string,unknown>;
 }
 function text(input:unknown,label:string,identifier=false):string{
  if(typeof input!=='string'||!input.trim()||input.length>(identifier?64:128)||(identifier&&!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(input)))throw Error(label+': expected '+(identifier?'an ASCII identifier of 1–64 characters.':'text of 1–128 characters.'));
  return input;
 }
 function checkedPack(input:unknown):LWContentPorts.ScenarioPack{
  const checked=X.validate(input);if(!checked.ok)throw Error(checked.errors.join('\n'));return checked.pack;
 }
 function selectedPack(id:string):LWContentPorts.ScenarioPack{
  const found=X.builtins().find(pack=>pack.id===id);if(!found)throw Error('Unknown scenario: '+id+'. Use wildlands scenarios.');return found;
 }
 function scene(pack:LWContentPorts.ScenarioPack,id:unknown):string{
  const selected=text(id??pack.scenes[0]?.id,'Scene ID',true);
  if(!pack.scenes.some(value=>value.id===selected))throw Error('Scene does not exist in this scenario: '+selected);return selected;
 }
 /** Opaque change identifier for the complete normalized project: every field,
  * including the whole pack, enters key-sorted canonical JSON. The content-library
  * fingerprint covers only library fields, so the project is wrapped as its
  * components under a format tag. Not a signature or authenticity proof. */
 function projectFingerprint(project:Wildlands.Project):string{
  return C.fingerprint({schemaVersion:project.schemaVersion,library:project.format,components:project});
 }
 function validate(input:unknown):Wildlands.Validation{
  try{
   const doc=record(input),fields=['format','schemaVersion','id','name','target','scenarioId','sceneId','pack'];
   if(doc.format!=='wildlands-project'||doc.schemaVersion!==1||doc.target!=='godot')throw Error('Expected wildlands-project schemaVersion 1 with target godot.');
   if(Object.keys(doc).length!==fields.length||fields.some(key=>!Object.hasOwn(doc,key)))throw Error('Project has missing or unknown fields.');
   const pack=checkedPack(doc.pack),scenarioId=text(doc.scenarioId,'Scenario ID',true);
   if(scenarioId!==pack.id)throw Error('Project scenarioId must match pack.id.');
   const project:Wildlands.Project={format:'wildlands-project',schemaVersion:1,id:text(doc.id,'Project ID',true),name:text(doc.name,'Project name'),target:'godot',scenarioId,sceneId:scene(pack,doc.sceneId),pack};
   return {ok:true,project,fingerprint:projectFingerprint(project),errors:[]};
  }catch(error){return {ok:false,errors:[error instanceof Error?error.message:String(error)]};}
 }
 function create(options:Wildlands.CreateOptions={}):Wildlands.Project{
  const config=record(options);
  if(Object.keys(config).some(key=>!['id','name','scenarioId','sceneId','pack'].includes(key)))throw Error('Create options have unknown fields.');
  const pack=checkedPack(config.pack??selectedPack(text(config.scenarioId??'littlewild','Scenario ID',true)));
  if(config.scenarioId!==undefined&&config.scenarioId!==pack.id)throw Error('Scenario ID must match the supplied pack.');
  const candidate={format:'wildlands-project',schemaVersion:1,id:config.id??'wildlands-prototype',name:config.name??pack.name,target:'godot',scenarioId:pack.id,sceneId:scene(pack,config.sceneId),pack};
  const checked=validate(candidate);if(!checked.ok)throw Error(checked.errors.join('\n'));return checked.project;
 }
 function select(input:unknown,scenarioId:string,sceneId?:string):Wildlands.Project{
  const checked=validate(input);if(!checked.ok)throw Error(checked.errors.join('\n'));
  const project=checked.project,pack=scenarioId===project.pack.id?project.pack:selectedPack(scenarioId);
  return create({id:project.id,name:project.name,pack,...(sceneId===undefined?{}:{sceneId})});
 }
 function capture(input:unknown,capturedPack:unknown,sceneId?:string):Wildlands.Project{
  const checked=validate(input);if(!checked.ok)throw Error(checked.errors.join('\n'));
  const project=checked.project,captured=checkedPack(capturedPack),pack=C.copy(project.pack),selected=sceneId??project.sceneId;
  if(captured.id!==pack.id)throw Error('Captured scenario identity must match the project.');
  scene(captured,selected);scene(pack,selected);
  // Native graph-less captures intentionally contain one playable scene. Project
  // capture retains the authored closure and updates only observed gameplay values.
  for(const value of captured.scenes){
   const authored=pack.scenes.find(row=>row.id===value.id);if(!authored)throw Error('Captured pack contains an unknown scene: '+value.id);
   authored.initialState=C.copy(value.initialState);
  }
  for(const value of captured.worlds){
   const index=pack.worlds.findIndex(row=>row.id===value.id);if(index<0)throw Error('Captured pack contains an unknown world: '+value.id);
   pack.worlds[index]=C.copy(value);
  }
  pack.libraries=C.copy(captured.libraries);pack.simulation=C.copy(captured.simulation);
  if(captured.resources)pack.resources=C.copy(captured.resources);
  if(captured.storytelling?.progress&&pack.storytelling)pack.storytelling.progress=C.copy(captured.storytelling.progress);
  return create({id:project.id,name:project.name,pack,sceneId:selected});
 }
 function scenarios():LittlewildDeveloper.ScenarioSummary[]{return X.builtins().map(pack=>({id:pack.id,name:pack.name,scenes:pack.scenes.map(value=>({id:value.id,name:value.name,worldId:value.worldId}))}));}
 function discover():Wildlands.Discovery{
  const string={type:'string'},project={'--project':string},output={'--output':string};
  return {name:'wildlands',protocolVersion:1,projectFormat:'wildlands-project',projectSchemaVersion:1,target:'godot',maxBytes,defaultScenario:'littlewild',scenarios:scenarios(),operations:[
   {operation:'discover',description:'Versioned machine-readable project, command and recipe discovery.',arguments:{},example:['discover']},
   {operation:'scenarios',description:'List built-in scenarios and scene IDs.',arguments:{},example:['scenarios']},
   {operation:'create',description:'Create a portable project from a built-in scenario or validated --pack JSON.',arguments:{...output,'--scenario':string,'--scene':string,'--pack':string,'--id':string,'--name':string},example:['create','--output','prototype.json']},
   {operation:'validate',description:'Validate the complete portable project without changing runtime state.',arguments:project,example:['validate','--project','prototype.json']},
   {operation:'inspect',description:'Inspect selected scene, project fingerprint and initial simulation snapshot.',arguments:project,example:['inspect','--project','prototype.json']},
   {operation:'scenario',description:'Select a scenario and scene in a new output document.',arguments:{...project,...output,'--scenario':string,'--scene':string},example:['scenario','--project','prototype.json','--scenario','office','--output','office.json']},
   {operation:'run',description:'Run a bounded allowlisted game recipe and capture the resulting project.',arguments:{...project,...output,'--recipe':string},example:['run','--project','prototype.json','--recipe','recipe.json','--output','played.json']},
   {operation:'edit',description:'Apply a bounded scene-editor recipe and export a validated project.',arguments:{...project,...output,'--recipe':string},example:['edit','--project','prototype.json','--recipe','edits.json','--output','edited.json']},
   {operation:'compile',description:'Compile a project to a runnable Godot directory (desktop Node runtime).',arguments:{...project,...output},example:['compile','--project','prototype.json','--output','godot-prototype']},
   {operation:'export',description:'Alias for compile.',arguments:{...project,...output},example:['export','--project','prototype.json','--output','godot-prototype']}
  ]};
 }
 const api:Wildlands.ProjectApi=Object.freeze({maxBytes,create,validate,select,capture,scenarios,discover});
 root.WildlandsProject=api;if(node)module.exports=api;
})(globalThis);
