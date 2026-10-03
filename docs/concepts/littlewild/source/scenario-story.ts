/* Current portable story boundary.
 * The prototype has one story envelope: version 10. Scenario context is optional.
 */
(function(inputRoot: unknown){
 'use strict';

 type DataRecord=Record<string,unknown>;
 interface ExperienceContext extends DataRecord { simulation:unknown; world:unknown; }
 interface EngineLike {
  scenarioContext?:ExperienceContext;
  simulationProfile?:unknown;
  export():{state:unknown;[key:string]:unknown};
  [key:string]:unknown;
 }
 interface StoryDocument extends DataRecord {
  version:unknown;
  experience?:unknown;
  experienceFingerprint?:unknown;
  simulationFingerprint?:unknown;
  world?:unknown;
 }
 interface StoryPreview extends DataRecord {
  engine:EngineLike;
  experience:ExperienceContext|null;
  experienceFingerprint:string|null;
  simulationFingerprint:string;
  changesSimulation:boolean;
 }
 interface NativeStoryApi {
  readonly SAVE_LIMIT:number;
  encode(engine:EngineLike,savedAt?:string|null):DataRecord;
  inspect(input:unknown):StoryPreview;
  commit(preview:StoryPreview):EngineLike;
  applyContent(preview:unknown,engine:EngineLike,newStory?:boolean):EngineLike;
  applyAdventure(pack:unknown,engine:EngineLike,newStory?:boolean):EngineLike;
  applyWorld(pack:unknown,engine:EngineLike,newStory?:boolean):EngineLike;
  applyGrowth(pack:unknown,engine:EngineLike,newStory?:boolean):EngineLike;
  [key:string]:unknown;
 }
 interface ScenarioApi {
  checkContext(input:unknown):ExperienceContext;
  checkWorld(world:unknown,library:unknown):void;
  hash(input:unknown):string;
  activate(engine:EngineLike):void;
  transaction<T>(work:()=>T):T;
 }
 interface ProfileApi {
  readonly defaults:unknown;
  readonly hash:string;
  fingerprint(profile:unknown):string;
  withProfile<T>(profile:unknown,work:()=>T):T;
 }
 interface WorldProfileApi {
  readonly defaults:unknown;
  withProfile<T>(profile:unknown,work:()=>T):T;
 }
 interface ContentApi {
  fingerprint(value:unknown):string;
  copy<T>(value:T):T;
  stable(value:unknown):string|undefined;
  parse(input:unknown,limit:number):unknown;
 }
 interface ResourceApi {withResources<T>(input:unknown,work:()=>T):T;checkBindings(input:unknown,libraries:unknown):void;}
 interface LittlewildRoot {
  LWSceneNavigation:LWSceneNavigation.NavigationApi;
  LWScenarioResources?:ResourceApi;
  LWStory?:NativeStoryApi;
  LWScenarios?:ScenarioApi;
  LWWorldProfile?:WorldProfileApi;
  LWSimulationProfile?:ProfileApi;
  LWContent?:ContentApi;
 }
 const root=inputRoot as LittlewildRoot;
 const node=typeof module!=='undefined'&&module.exports;
 const story=(node?require('./story-codec.js'):root.LWStory) as NativeStoryApi|undefined;
 const scenarios=(node?require('./scenario-runtime.js'):root.LWScenarios) as ScenarioApi|undefined;
 const resources=root.LWScenarioResources!;
 const profiles=root.LWSimulationProfile,worldProfiles=root.LWWorldProfile,content=root.LWContent;
 if(!story||!scenarios||!profiles||!worldProfiles||!content)throw Error('Scenario story dependencies are missing.');
 const S:NativeStoryApi=story,X:ScenarioApi=scenarios,Profiles:ProfileApi=profiles,P:WorldProfileApi=worldProfiles,C:ContentApi=content;
 const native=Object.freeze({encode:S.encode.bind(S),inspect:S.inspect.bind(S),commit:S.commit.bind(S)});
 const reviewHash=(value:unknown):string=>C.fingerprint({schemaVersion:1,components:value});
 const reviews=new WeakMap<object,string>();
 const asRecord=(value:unknown,label:string):DataRecord=>{
  if(value===null||typeof value!=='object'||Array.isArray(value))throw Error(label+' must be an object.');
  return value as DataRecord;
 };
 const reviewOf=(preview:StoryPreview):string=>reviewHash({experience:preview.experience,
  experienceFingerprint:preview.experienceFingerprint,simulationFingerprint:preview.simulationFingerprint});

 function checkJourneyLibraries(doc:DataRecord,ctx:ExperienceContext):void{
  if(!ctx.journey)return;const journey=ctx.journey as LWSceneGraph.Journey;
  const envelopes=[['content','base'],['adventure','adventure'],['world','world'],['growth','growth']] as const;
  for(const [field,key]of envelopes)if(C.stable(asRecord(doc[field],'Story '+field+' envelope').library)!==C.stable(journey.pack.libraries[key]))throw Error('Story libraries must match the complete journey pack.');
 }
 S.encode=(engine:EngineLike,savedAt:string|null=null):DataRecord=>{
  const doc=native.encode(engine,savedAt);
  const simulation=engine.scenarioContext?.simulation??Profiles.defaults;
  if(engine.simulationProfile&&Profiles.fingerprint(engine.simulationProfile)!==Profiles.fingerprint(simulation))
   throw Error('Experience simulation does not match the engine profile; capture a scenario with the original context before saving.');
  if(engine.scenarioContext){
   const rawContext=C.copy(engine.scenarioContext);
   if(rawContext.journey)rawContext.journey=root.LWSceneNavigation.checkpoint(engine as unknown as LWContentPorts.ScenarioEngine);
   const ctx=X.checkContext(rawContext);
   const nativeState=asRecord(doc.state,'Native story state');
   if(nativeState.scenarioResources&&C.stable(nativeState.scenarioResources)!==C.stable(ctx.resources))throw Error('Story resources must match the complete experience catalogs.');
   doc.version=10;
   checkJourneyLibraries(doc,ctx);
   doc.experience=C.copy(ctx);
   if(ctx.journey)delete (doc.experience as ExperienceContext).resources;
   doc.experienceFingerprint=X.hash(ctx);
   doc.simulationFingerprint=Profiles.fingerprint(ctx.simulation);
  }
  return doc;
 };
 S.inspect=(input:unknown):StoryPreview=>{
  const doc=asRecord(C.parse(input,S.SAVE_LIMIT),'Portable story') as StoryDocument;
  if(doc.version!==10)throw Error('Only the current Littlewild story format (v10) is supported.');
  let ctx:ExperienceContext|null=null;
  if(doc.experience!==undefined&&doc.experience!==null){
   ctx=X.checkContext(doc.experience);
   if(X.hash(ctx)!==doc.experienceFingerprint)throw Error('Experience fingerprint does not match');
   if(doc.simulationFingerprint!==Profiles.fingerprint(ctx.simulation))throw Error('Simulation profile fingerprint does not match');
   const worldEnvelope=asRecord(doc.world,'World story envelope');
   X.checkWorld(ctx.world,worldEnvelope.library);
  }
  if(ctx)checkJourneyLibraries(doc,ctx);
  const savedState=asRecord(doc.state,'Native story state');
  if(ctx?.journey){
   const journey=ctx.journey as LWSceneGraph.Journey;
   const current=journey.pack.scenes.find(scene=>scene.id===ctx.sceneId)!;
   if(C.stable(journey.checkpoints[current.graph?.binding?.sourceSceneId??current.id])!==C.stable(root.LWSceneNavigation.normalizeState(savedState)))throw Error('Active scene checkpoint does not match native story state.');
  }
  if(savedState.scenarioResources&&C.stable(savedState.scenarioResources)!==C.stable(ctx?.resources))throw Error('Story resources must match the complete experience catalogs.');
  const preview=resources.withResources(ctx?.resources,()=>Profiles.withProfile(ctx?.simulation??Profiles.defaults,()=>P.withProfile(ctx?.world??P.defaults,
   ()=>native.inspect(doc)))) as StoryPreview;
  if(ctx){resources.checkBindings(ctx.resources,{base:preview.library,adventure:preview.adventure,world:preview.world,growth:preview.growth});preview.engine.scenarioContext=ctx;}
  preview.experience=ctx;
  preview.experienceFingerprint=ctx?X.hash(ctx):null;
  preview.simulationFingerprint=ctx?Profiles.fingerprint(ctx.simulation):Profiles.fingerprint(Profiles.defaults);
  preview.changesSimulation=Profiles.hash!==preview.simulationFingerprint;
  reviews.set(preview,reviewOf(preview));
  return preview;
 };
 S.commit=(preview:StoryPreview):EngineLike=>{
  if(!preview||reviews.get(preview)!==reviewOf(preview))throw Error('Experience review is stale');
  if(preview.experience&&X.hash(preview.experience)!==preview.experienceFingerprint)throw Error('Experience review is stale');
  const ctx=preview.experience?X.checkContext(preview.experience):null;
  if(ctx&&Profiles.fingerprint(ctx.simulation)!==preview.simulationFingerprint)throw Error('Simulation profile review is stale');
  return X.transaction(()=>{
   const engine=resources.withResources(ctx?.resources,()=>Profiles.withProfile(ctx?.simulation??Profiles.defaults,()=>P.withProfile(ctx?.world??P.defaults,()=>native.commit(preview))));
   if(ctx)engine.scenarioContext=ctx;
   X.activate(engine);return engine;
  });
 };

 for(const name of ['applyContent','applyAdventure','applyWorld','applyGrowth'] as const){
  const operation=S[name] as (pack:unknown,engine:EngineLike,newStory?:boolean)=>EngineLike;
  S[name]=(pack:unknown,engine:EngineLike,newStory=false):EngineLike=>{
   if(engine.scenarioContext?.journey)throw Error('Edit the complete journey pack in the World & Scene Editor and review a new scene before changing its catalogs.');
   const profile=engine.scenarioContext?.simulation??Profiles.defaults;
   const next=Profiles.withProfile(profile,()=>operation(pack,engine,newStory));
   if(engine.scenarioContext)next.scenarioContext=C.copy(engine.scenarioContext);
   return next;
  };
 }
 if(node)module.exports=S;
})(globalThis);
