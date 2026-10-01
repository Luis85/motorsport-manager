/* Reusable experience boundary: definition libraries, world template, simulation
 * profile, composition archetype, and scene state. Validation is synchronous and
 * reversible. External JSON remains data and cannot register executable behavior. */
(function(root){
 'use strict';
 const node=typeof module!=='undefined'&&module.exports;
 const L=node?require('./simulation.cjs'):root.LW;
 const C=root.LWContent,A=root.LWAdventure,W=root.LWWorldContent,G=root.LWGrowth,P=root.LWWorldProfile;
 const R=node?require('./simulation-content.js'):root.LWSimulationContent;
 const shape=node?require('./scenario-shape.js'):root.LWScenarioShape;
 const schema=node?require('./content/scenario.schema.json'):root.LWScenarioSchema;
 const legacySchema=node?require('./content/scenario-v1.schema.json'):root.LWScenarioV1Schema;
 const builtin=node?[require('./content/littlewild.pack.json'),require('./content/emberworks.pack.json')]:root.LWScenarioPacks;
 const copy=C.copy,hash=value=>C.fingerprint({schemaVersion:1,components:value});
 const LEGACY_CONTEXT=['packId','name','version','sceneId','sceneName','worldId','presentation','world','tutorial'];
 const CONTEXT=['schemaVersion',...LEGACY_CONTEXT,'simulation'];
 function unique(entries,path){if(new Set(entries.map(entry=>entry.id)).size!==entries.length)throw Error(path+': duplicate IDs');}
 function validateShape(value,contract){const issues=shape(value,contract);if(issues.length)throw Error(issues.join('\n'));}
 function migratePack(input){
  const source=C.parse(input,8*1024*1024),sourceSchemaVersion=source?.schemaVersion;
  if(sourceSchemaVersion===2){validateShape(source,schema);return{pack:copy(source),sourceSchemaVersion,migrationNotes:[]};}
  if(sourceSchemaVersion!==1)throw Error('/schemaVersion: unsupported scenario-pack schema');
  validateShape(source,legacySchema);const pack=copy(source);pack.schemaVersion=2;pack.simulation=R.exportDefaults();
  for(const scene of pack.scenes){scene.ruleProfileId=R.defaultSelection.ruleProfile.id;scene.actorArchetypeId=R.defaultSelection.actorArchetype.id;}
  validateShape(pack,schema);
  return{pack,sourceSchemaVersion,migrationNotes:['Scenario pack schema 1 uses the standard ECS rule profile and standard creature composition archetype.']};
 }
 function checkWorld(world,library){
  validateShape(world,{...schema.$defs.world,$defs:schema.$defs});
  for(let i=0;i<19;i++)if(world.terrain[9][i]!=='.'||world.terrain[i][9]!=='.')throw Error('/worlds/'+world.id+': keep the central east/west and north/south paths open');
  const seen=new Set();
  for(const site of world.fixedSites){const key=site.x+','+site.y;if(seen.has(key))throw Error('/fixedSites: duplicate position '+key);
   if(!Object.hasOwn(library.nodes,site.kind)&&!library.nodes.some?.(node=>node.id===site.kind))throw Error('/fixedSites: unknown node '+site.kind);
   if(world.terrain[site.y][site.x]!=='.')throw Error('/fixedSites: site must be on land');seen.add(key);}
  const layout={estate:{islands:[{ix:0,iy:0}]},nodes:world.fixedSites,buildings:[]};
  P.withProfile(world,()=>{const grid=new root.LWGeography.Grid(layout);if(grid.flood({x:9,y:9}).size!==grid.cells.size||world.fixedSites.some(node=>!grid.approach(node)))throw Error('/fixedSites: blocking nodes disconnect this island or an authored site');});
  const queue=[[9,9]],connected=new Set(['9,9']);
  for(let head=0;head<queue.length;head++)for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const x=queue[head][0]+dx,y=queue[head][1]+dy,key=x+','+y;if(world.terrain[y]?.[x]==='.'&&!connected.has(key)){connected.add(key);queue.push([x,y]);}}
  if(connected.size!==world.terrain.join('').split('.').length-1)throw Error('/terrain: disconnected land');
 }
 function withLibraries(libraries,work){const previousA=copy(A.content);return C.registry.withLibrary(libraries.base,()=>{try{A.replace(libraries.adventure);return W.withLibrary(libraries.world,()=>G.withLibrary(libraries.growth,work));}finally{A.replace(previousA);}});}
 function selection(pack,scene){return R.resolve(pack.simulation,scene.ruleProfileId,scene.actorArchetypeId);}
 function context(pack,scene){return{schemaVersion:2,packId:pack.id,name:pack.name,version:pack.version,sceneId:scene.id,sceneName:scene.name,worldId:scene.worldId,
  presentation:copy(pack.presentation),world:copy(pack.worlds.find(world=>world.id===scene.worldId)),tutorial:copy(pack.tutorial),simulation:R.copySelection(selection(pack,scene))};}
 function contextPack(ctx,selected){return{format:'living-worlds-pack',schemaVersion:2,id:ctx.packId,version:ctx.version,name:ctx.name,description:'Saved experience',presentation:ctx.presentation,
  worlds:[ctx.world],scenes:[{id:ctx.sceneId,name:ctx.sceneName,description:'Saved scene',worldId:ctx.worldId,initialState:{},ruleProfileId:selected.ruleProfile.id,actorArchetypeId:selected.actorArchetype.id}],tutorial:ctx.tutorial,
  simulation:{format:'littlewild-simulation-content',schemaVersion:1,ruleProfiles:[selected.ruleProfile],compositionArchetypes:[selected.actorArchetype]},libraries:{base:{},adventure:{},world:{},growth:{}}};}
 function checkContext(input){
  if(!input||CONTEXT.some(key=>!Object.hasOwn(input,key))||Object.keys(input).some(key=>!CONTEXT.includes(key))||input.schemaVersion!==2)throw Error('Invalid experience context');
  const ctx=copy(input),selected=R.validateSelection(ctx.simulation);validateShape(contextPack(ctx,selected),schema);
  if(ctx.world.id!==ctx.worldId)throw Error('World identity mismatch');unique(ctx.tutorial,'/tutorial');ctx.simulation=R.copySelection(selected);return ctx;
 }
 function migrateContext(input){
  if(input?.schemaVersion===2)return{context:checkContext(input),migrationNotes:[]};
  if(!input||LEGACY_CONTEXT.some(key=>!Object.hasOwn(input,key))||Object.keys(input).some(key=>!LEGACY_CONTEXT.includes(key)))throw Error('Invalid legacy experience context');
  const ctx=copy(input),mini={format:'living-worlds-pack',schemaVersion:1,id:ctx.packId,version:ctx.version,name:ctx.name,description:'Saved experience',presentation:ctx.presentation,
   worlds:[ctx.world],scenes:[{id:ctx.sceneId,name:ctx.sceneName,description:'Saved scene',worldId:ctx.worldId,initialState:{}}],tutorial:ctx.tutorial,libraries:{base:{},adventure:{},world:{},growth:{}}};
  validateShape(mini,legacySchema);if(ctx.world.id!==ctx.worldId)throw Error('World identity mismatch');unique(ctx.tutorial,'/tutorial');
  return{context:checkContext({schemaVersion:2,...ctx,simulation:R.copySelection(R.defaultSelection)}),migrationNotes:['Portable experience 9 uses the standard ECS rule profile and standard creature composition archetype.']};
 }
 function checkSceneFields(state,path){
  const rootKeys=['version','seed','simTime','day','hour','started','speed','paused','player','rp','buildings','nodes','log','completedQuests','contractIndex','settings','ledger','nextId','colony','world','estate','progression','market','planning','atlas'];
  for(const key of Object.keys(state))if(!rootKeys.includes(key))throw Error(path+'/'+key+': unknown scene-state field');
  if(state.player&&typeof state.player==='object')for(const key of Object.keys(state.player))if(!['level','xp','coins'].includes(key))throw Error(path+'/player/'+key+': unknown player field');
 }
 function validate(input){
  try{
   const migrated=migratePack(input),pack=migrated.pack;validateShape(pack,schema);unique(pack.worlds,'/worlds');unique(pack.scenes,'/scenes');unique(pack.tutorial,'/tutorial');
   const simulation=R.validateSet(pack.simulation);pack.simulation=copy(simulation);
   const base=C.registry.prepare(pack.libraries.base);if(!base.ok)throw Error(base.errors.map(error=>error.path+': '+error.message).join('\n'));
   const adventure=A.validate(pack.libraries.adventure);if(!adventure.ok)throw Error(adventure.errors.join('\n'));
   withLibraries(pack.libraries,()=>{for(const world of pack.worlds)checkWorld(world,pack.libraries.world);for(const scene of pack.scenes){const ctx=context(pack,scene);if(!ctx.world)throw Error('/scenes/'+scene.id+': unknown world');checkSceneFields(scene.initialState,'/scenes/'+scene.id+'/initialState');
    const imported=P.withProfile(ctx.world,()=>L.Engine.import({app:'littlewild',version:8,state:scene.initialState}));R.apply(imported,ctx.simulation);
    if(C.stable(imported.export().state)!==C.stable(scene.initialState))throw Error('/scenes/'+scene.id+'/initialState: unknown or noncanonical state values; capture a current scene as a template');}});
   return{ok:true,errors:[],pack:copy(pack),fingerprint:hash(pack),sceneCount:pack.scenes.length,sourceSchemaVersion:migrated.sourceSchemaVersion,migrationNotes:migrated.migrationNotes};
  }catch(error){return{ok:false,errors:[error.message]};}
 }
 function prepareScene(pack,id){
  const checked=validate(pack);if(!checked.ok)throw Error(checked.errors.join('\n'));const scene=checked.pack.scenes.find(entry=>entry.id===id);if(!scene)throw Error('Choose a scene in this pack');
  const ctx=context(checked.pack,scene),engine=withLibraries(checked.pack.libraries,()=>P.withProfile(ctx.world,()=>L.Engine.import({app:'littlewild',version:8,state:scene.initialState})));
  R.apply(engine,ctx.simulation);engine.scenarioContext=ctx;return{...checked,sceneId:id,engine,context:ctx};
 }
 function commitScene(preview){
  if(!preview?.ok||hash(preview.pack)!==preview.fingerprint)throw Error('Scenario preview changed; review again');const fresh=prepareScene(preview.pack,preview.sceneId),libraries=fresh.pack.libraries;
  const previous={base:C.registry.export(),adventure:copy(A.content),world:copy(W.content),growth:copy(G.content)},priorWorld=P.current;
  try{C.registry.commit(C.registry.prepare(libraries.base));A.replace(libraries.adventure);W.replace(libraries.world);G.replace(libraries.growth);P.apply(fresh.context.world);}
  catch(error){C.registry.commit(C.registry.prepare(previous.base));A.replace(previous.adventure);W.replace(previous.world);G.replace(previous.growth);P.apply(priorWorld);throw error;}
  return fresh.engine;
 }
 function activate(engine){P.apply(engine.scenarioContext?.world||P.defaults);return engine;}
 function capture(engine){
  const ctx=engine.scenarioContext?checkContext(engine.scenarioContext):context(builtin[0],builtin[0].scenes[0]);if(!engine.scenarioContext)ctx.world=copy(P.defaults);
  const selected=engine.simulationSelection?R.copySelection(engine.simulationSelection):copy(ctx.simulation);
  return{format:'living-worlds-pack',schemaVersion:2,id:ctx.packId,version:ctx.version,name:ctx.name,description:'Editable scenario captured from this world. Launching creates a new story.',presentation:copy(ctx.presentation),worlds:[copy(ctx.world)],tutorial:copy(ctx.tutorial),
   simulation:{format:'littlewild-simulation-content',schemaVersion:1,ruleProfiles:[copy(selected.ruleProfile)],compositionArchetypes:[copy(selected.actorArchetype)]},
   scenes:[{id:ctx.sceneId,name:ctx.sceneName,description:'Captured starting state',worldId:ctx.worldId,initialState:engine.export().state,ruleProfileId:selected.ruleProfile.id,actorArchetypeId:selected.actorArchetype.id}],
   libraries:{base:C.registry.export(),adventure:copy(A.content),world:copy(W.content),growth:copy(G.content)}};
 }
 const api={validate,migratePack,prepareScene,commitScene,activate,capture,checkContext,migrateContext,checkWorld,hash,withLibraries,schema,legacySchema,
  builtins:()=>copy(builtin),defaultTutorial:()=>copy(builtin[0].tutorial),defaultPresentation:()=>copy(builtin[0].presentation),defaultSimulation:()=>R.exportDefaults()};
 root.LWScenarios=api;if(node)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
