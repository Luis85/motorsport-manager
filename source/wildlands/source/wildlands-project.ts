/// <reference path="./wildlands-project-contracts.d.ts" />
/**
 * Browser and terminal share one portable project admission boundary.
 *
 * schemaVersion 2 projects embed their game: the colony sections of the content profile installed
 * when they were written. The realm that admits a project must run that game (the CLI installs the
 * embedded profile first; a browser artifact runs its own). schemaVersion 1 documents carry no game
 * and stay readable against an installed game; every document this module writes is version 2.
 */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWScenarios:LWContentPorts.ScenarioApi;LWContent:LWContentPorts.ContentApi;LWContentProvider:LWContentProvider.Api;WildlandsProject?:Wildlands.ProjectApi};
 const node=typeof module!=='undefined'&&module.exports;
 const X=(node?require('./scenario-runtime.js'):root.LWScenarios) as LWContentPorts.ScenarioApi;
 const P=(node?require('./content-provider.js'):root.LWContentProvider) as LWContentProvider.Api;
 const C=root.LWContent,maxBytes=10*1024*1024;
 /** Value budget of a whole project: its pack plus the embedded game profile (content documents allow 60,000). */
 const maxNodes=1000000;
 /** Profile sections a project embeds; RTS and Pocket Pet catalogs are not project content. */
 const EMBEDDED=['format','version','id','storage','balancing','librarySchema','creatures','assets','scenarios'] as const;
 const FIELDS={1:['format','schemaVersion','id','name','target','scenarioId','sceneId','pack'],2:['format','schemaVersion','id','name','target','scenarioId','sceneId','pack','game']} as const;
 const NO_GAME='No game is installed. Create projects from a game folder (wildlands create --game DIR); see docs/reference/wildlands-cli.md.';
 function record(input:unknown):Record<string,unknown>{
  const parsed=C.parse(input,maxBytes,maxNodes);
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
  installed();const found=X.builtins().find(pack=>pack.id===id);if(!found)throw Error('Unknown scenario: '+id+'. Use wildlands scenarios --game DIR.');return found;
 }
 function scene(pack:LWContentPorts.ScenarioPack,id:unknown):string{
  const selected=text(id??pack.scenes[0]?.id,'Scene ID',true);
  if(!pack.scenes.some(value=>value.id===selected))throw Error('Scene does not exist in this scenario: '+selected);return selected;
 }
 /** Opaque change identifier for the complete normalized project: every field,
  * including the whole pack, enters key-sorted canonical JSON. The content-library
  * fingerprint covers only library fields, so the project is wrapped as its
  * components under a format tag. A version 2 document's embedded game is part
  * of it. Not a signature or authenticity proof. */
 function projectFingerprint(project:Wildlands.AnyProject):string{
  return C.fingerprint({schemaVersion:project.schemaVersion,library:project.format,components:project},maxNodes);
 }
 /** The installed game, which every pack is validated against. */
 function installed():LWContentProvider.Profile{if(!P.installed())throw Error(NO_GAME);return P.get('project');}
 /** Detached colony sections of the installed profile (the game a new project embeds). */
 function embeddedGame():Wildlands.ProjectGame{
  const profile=installed() as unknown as Record<string,unknown>;
  if(!profile.scenarios)throw Error('The installed game ('+String(profile.id)+') has no scenario catalog; projects need a colony game.');
  const sections=Object.fromEntries(EMBEDDED.filter(key=>profile[key]!==undefined).map(key=>[key,profile[key]]));
  return {id:profile.id as string,profile:JSON.parse(JSON.stringify(sections)) as LWContentProvider.Profile};
 }
 /** Closed envelope of an embedded game; section contents are admitted by the provider and their owners. */
 function game(input:unknown):Wildlands.ProjectGame{
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Project game must be an object {id, profile}.');
  const value=input as Record<string,unknown>,profile=value.profile as Record<string,unknown>|undefined;
  if(Object.keys(value).length!==2||!Object.hasOwn(value,'id')||!Object.hasOwn(value,'profile'))throw Error('Project game has missing or unknown fields.');
  const id=text(value.id,'Project game ID',true);
  if(!profile||typeof profile!=='object'||Array.isArray(profile))throw Error('Project game profile must be an object.');
  if(profile.format!=='wildlands-content-profile'||profile.version!==1||profile.id!==id)throw Error('Project game profile must be a wildlands-content-profile version 1 whose id is '+id+'.');
  const unknown=Object.keys(profile).filter(key=>!(EMBEDDED as readonly string[]).includes(key));
  if(unknown.length)throw Error('Project game profile has fields a project does not embed: '+unknown.join(', ')+'.');
  if(!profile.scenarios)throw Error('Project game profile has no scenario catalog.');
  const realm=installed();
  if(realm.id!==id)throw Error('This project embeds the game '+id+', but this runtime runs '+realm.id+'. Open it where its own game is installed (the CLI installs the embedded game).');
  return {id,profile:profile as unknown as LWContentProvider.Profile};
 }
 function validate(input:unknown):Wildlands.Validation{
  try{
   const doc=record(input),version=doc.schemaVersion;
   if(doc.format!=='wildlands-project'||(version!==1&&version!==2)||doc.target!=='godot')throw Error('Expected wildlands-project schemaVersion 2 (or legacy 1) with target godot.');
   const fields=FIELDS[version];
   if(Object.keys(doc).length!==fields.length||fields.some(key=>!Object.hasOwn(doc,key)))throw Error('Project has missing or unknown fields.');
   const embedded=version===2?game(doc.game):null;
   const pack=checkedPack(doc.pack),scenarioId=text(doc.scenarioId,'Scenario ID',true);
   if(scenarioId!==pack.id)throw Error('Project scenarioId must match pack.id.');
   const base={format:'wildlands-project' as const,id:text(doc.id,'Project ID',true),name:text(doc.name,'Project name'),target:'godot' as const,scenarioId,sceneId:scene(pack,doc.sceneId),pack};
   const project:Wildlands.AnyProject=embedded?{...base,schemaVersion:2,game:embedded}:{...base,schemaVersion:1};
   return {ok:true,project,fingerprint:projectFingerprint(project),errors:[]};
  }catch(error){return {ok:false,errors:[error instanceof Error?error.message:String(error)]};}
 }
 function create(options:Wildlands.CreateOptions={}):Wildlands.Project{
  const config=record(options);
  if(Object.keys(config).some(key=>!['id','name','scenarioId','sceneId','pack'].includes(key)))throw Error('Create options have unknown fields.');
  const embedded=embeddedGame();
  const pack=checkedPack(config.pack??selectedPack(text(config.scenarioId??X.defaultId(),'Scenario ID',true)));
  if(config.scenarioId!==undefined&&config.scenarioId!==pack.id)throw Error('Scenario ID must match the supplied pack.');
  const candidate={format:'wildlands-project',schemaVersion:2,id:config.id??'wildlands-prototype',name:config.name??pack.name,target:'godot',scenarioId:pack.id,sceneId:scene(pack,config.sceneId),pack,game:embedded};
  const checked=validate(candidate);if(!checked.ok)throw Error(checked.errors.join('\n'));return checked.project as Wildlands.Project;
 }
 function upgrade(input:unknown):Wildlands.Project{
  const checked=validate(input);if(!checked.ok)throw Error(checked.errors.join('\n'));
  const project=checked.project;
  return project.schemaVersion===2?project:create({id:project.id,name:project.name,pack:project.pack,sceneId:project.sceneId});
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
 function scenarios():LittlewildDeveloper.ScenarioSummary[]{installed();return X.builtins().map(pack=>({id:pack.id,name:pack.name,scenes:pack.scenes.map(value=>({id:value.id,name:value.name,worldId:value.worldId}))}));}
 function discover():Wildlands.Discovery{
  const string={type:'string'},project={'--project':string},output={'--output':string},legacy={'--game':{type:'string',description:'game folder; only for schemaVersion 1 projects'}},game={'--game':string};
  const current=P.installed()&&P.get().scenarios?{id:P.get().id,defaultScenario:X.defaultId(),scenarios:scenarios()}:null;
  return {name:'wildlands',protocolVersion:1,projectFormat:'wildlands-project',projectSchemaVersion:2,legacySchemaVersions:[1],target:'godot',maxBytes,game:current,operations:[
   {operation:'discover',description:'Versioned machine-readable project, command and recipe discovery; --game adds that game and its scenarios.',arguments:{'--game':string},example:['discover']},
   {operation:'scenarios',description:'List the scenario packs and scene IDs of a game folder.',arguments:game,example:['scenarios','--game','docs/concepts/littlewild']},
   {operation:'create',description:'Create a portable schemaVersion 2 project from a game folder scenario or a validated --pack JSON; the game is embedded.',arguments:{...game,...output,'--scenario':string,'--scene':string,'--pack':string,'--id':string,'--name':string},example:['create','--game','docs/concepts/littlewild','--output','prototype.json']},
   {operation:'validate',description:'Validate the complete portable project without changing runtime state.',arguments:{...project,...legacy},example:['validate','--project','prototype.json']},
   {operation:'inspect',description:'Inspect selected scene, project fingerprint and initial simulation snapshot.',arguments:{...project,...legacy},example:['inspect','--project','prototype.json']},
   {operation:'scenario',description:'Select another scenario of the embedded game and a scene in a new output document.',arguments:{...project,...output,'--scenario':string,'--scene':string,...legacy},example:['scenario','--project','prototype.json','--scenario','littlewild','--scene','charted-home','--output','home.json']},
   {operation:'run',description:'Run a bounded allowlisted game recipe and capture the resulting project.',arguments:{...project,...output,'--recipe':string,...legacy},example:['run','--project','prototype.json','--recipe','recipe.json','--output','played.json']},
   {operation:'edit',description:'Apply a bounded scene-editor recipe and export a validated project.',arguments:{...project,...output,'--recipe':string,...legacy},example:['edit','--project','prototype.json','--recipe','edits.json','--output','edited.json']},
   {operation:'upgrade',description:'Rewrite a schemaVersion 1 project as schemaVersion 2 with its game folder embedded.',arguments:{...project,...output,...game},example:['upgrade','--project','legacy.json','--game','docs/concepts/littlewild','--output','prototype.json']},
   {operation:'compile',description:'Compile a project to a runnable Godot directory (desktop Node runtime).',arguments:{...project,...output,'--with-engine-sources':{type:'boolean'},...legacy},example:['compile','--project','prototype.json','--output','godot-prototype']},
   {operation:'export',description:'Alias for compile.',arguments:{...project,...output,'--with-engine-sources':{type:'boolean'},...legacy},example:['export','--project','prototype.json','--output','godot-prototype']},
   {operation:'validate-game',description:'Validate a game folder: closed inventory, manifest, profile and the engine runtime validators.',arguments:game,example:['validate-game','--game','docs/concepts/littlewild']},
   {operation:'inspect-game',description:'Summarize a game folder: manifest, inventory, digest and profile section sizes.',arguments:game,example:['inspect-game','--game','docs/concepts/littlewild']},
   {operation:'build-game',description:'Build a self-contained HTML artifact of a game folder (play by default, studio on demand) or check one for freshness.',arguments:{...game,'--output':string,'--check':string,'--profile':{type:'string',enum:['play','studio']}},example:['build-game','--game','docs/concepts/littlewild','--output','demos/littlewild.html']}
  ]};
 }
 const api:Wildlands.ProjectApi=Object.freeze({maxBytes,create,validate,select,capture,upgrade,scenarios,discover});
 root.WildlandsProject=api;if(node)module.exports=api;
})(globalThis);
