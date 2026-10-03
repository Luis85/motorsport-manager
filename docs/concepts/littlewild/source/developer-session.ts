/// <reference path="./developer-contracts.d.ts" />
/* Application ownership for one process-global registry context and deterministic developer sessions. */
(function(inputRoot:unknown){
 'use strict';
 type Document=LittlewildDeveloper.Document;
 type Session=LittlewildDeveloper.Session;
 interface Engine {
  s:{started:boolean;paused:boolean;simTime:number};
  interactionOptions(sourceId:string,target:LittlewildDeveloper.InteractionTarget):LittlewildDeveloper.InteractionOption[];
  gameSettings():LittlewildDeveloper.GameSettings;
  interactionState():unknown;interactionDefinitions():unknown;
  step(dt:number):void;export():unknown;dispatchCommand(command:LittlewildDeveloper.Command):unknown;
 }
 interface ScenarioPort {
  builtins():unknown[];validate(input:unknown):{ok:boolean;errors:string[];pack?:unknown};
  prepareScene(pack:unknown,id:string):unknown;commitScene(preview:unknown):Engine;capture(engine:Engine):unknown;
 }
 interface StoryPort {inspect(input:unknown):{simulationFingerprint:string;experience?:{packId:string;sceneId:string}|null};commit(preview:unknown):Engine;encode(engine:Engine):unknown;}
 interface Root {
  LWDeveloperData:{record(value:unknown):Document;copy(value:unknown):LittlewildDeveloper.Json;text(value:unknown,label:string):string;
   DeveloperError:new(code:LittlewildDeveloper.ErrorCode,message:string)=>LittlewildDeveloper.DeveloperError};
  LWDeveloperCommands:{validate(input:unknown,scope:'actor'|'world'):LittlewildDeveloper.Command};
  LWCommandRouter:{manifest:readonly LittlewildDeveloper.CommandDefinition[]};
  LWScenarios:ScenarioPort;LWStory:StoryPort;
  LWInteractions:{all():unknown[];definition(input:unknown):unknown;validate(input:unknown):unknown};
  LWAssets:{readonly revision:number};
  LWCreatures:{readonly revision:number;all():unknown[];validate(input:unknown):unknown};
  LWContent:{registry:{hash:string}};LWAdventure:{hash:string};LWWorldContent:{hash:string};LWGrowth:{hash:string};
  LWSimulationProfile:{hash:string};LWWorldProfile:{hash:string};
  LWDeveloperSession?:unknown;
 }
 const root=inputRoot as Root,D=root.LWDeveloperData,X=root.LWScenarios,S=root.LWStory;
 let active:Session|null=null,hostActive=false;
 const reviews=new WeakMap<object,unknown>();
 function fail(code:LittlewildDeveloper.ErrorCode,message:string):never{throw new D.DeveloperError(code,message);}
 function available():void {
  if(hostActive)fail('session-active','A player host owns this runtime. Use the Node SDK or an isolated browser host.');
  if(active)fail('session-active','A developer session is active. Save and dispose it before opening another.');
 }
 function claimHost():{dispose():void} {
  available();hostActive=true;let disposed=false;
  return Object.freeze({dispose(){if(!disposed){disposed=true;hostActive=false;}}});
 }
 const signature=():string=>[root.LWContent.registry.hash,root.LWAdventure.hash,root.LWWorldContent.hash,
  root.LWGrowth.hash,root.LWSimulationProfile.hash,root.LWWorldProfile.hash,root.LWAssets.revision,root.LWCreatures.revision].join('|');
 const info=(envelope:Document):{scenarioId:string|null;sceneId:string|null}=>{
  const context=envelope.experience;
  if(!context||typeof context!=='object'||Array.isArray(context))return {scenarioId:null,sceneId:null};
  return {scenarioId:typeof context.packId==='string'?context.packId:null,sceneId:typeof context.sceneId==='string'?context.sceneId:null};
 };
 function validation(work:()=>unknown):LittlewildDeveloper.Validation {
  try{return {ok:true,errors:[],data:D.record(work())};}
  catch(error){return {ok:false,errors:[error instanceof Error?error.message:String(error)],data:null};}
 }
 function validateScenario(input:unknown):LittlewildDeveloper.Validation {
  return validation(()=>{const checked=X.validate(D.record(input));if(!checked.ok)throw Error(checked.errors.join('\n'));return checked.pack;});
 }
 function number(value:LittlewildDeveloper.Json|undefined,label:string):number {
  if(typeof value!=='number'||!Number.isFinite(value))return fail('operation-failed','Native '+label+' is unavailable.');
  return value;
 }
 function records(value:LittlewildDeveloper.Json|undefined):Document[] {
  if(!Array.isArray(value))return fail('operation-failed','Native collection is unavailable.');
  return value.map(D.record);
 }
 function numericMap(value:unknown):Record<string,number> {
  const record=D.record(value),out:Record<string,number>={};
  for(const [key,value] of Object.entries(record))out[key]=number(value,key);
  return out;
 }
 function session(initialEngine:Engine):Session {
  let engine:Engine|null=initialEngine;
  const installed=signature();let disposed=false;
  function guard():Engine {
   if(disposed)fail('session-disposed','This session is disposed. Create or open a new session.');
   if(signature()!==installed)fail('operation-failed','Runtime registries changed outside this session. Save earlier checkpoints, dispose, and reopen in an isolated host.');
   return engine??fail('session-disposed','This session is disposed.');
  }
  function save():Document{return D.record(guard().export());}
  function story():Document{return D.record(S.encode(guard()));}
  function inspect():LittlewildDeveloper.Snapshot {
   const state=D.record(save().state),colony=D.record(state.colony),context=info(story());
   const actors=records(colony.creatures).map(actor=>{
    const position=D.record(actor.creature);
    return {id:D.text(actor.id,'Actor ID'),name:D.text(actor.name,'Actor name'),
     archetype:D.text(actor.archetype,'Archetype'),personality:D.text(actor.personality,'Personality'),
     position:{x:number(position.x,'x'),y:number(position.y,'y')},needs:numericMap(actor.needs),
     task:actor.task===null?null:D.record(actor.task),inventory:numericMap(actor.inventory)};
   });
   return {simTime:number(state.simTime,'simulation time'),day:number(state.day,'day'),hour:number(state.hour,'hour'),
    started:state.started===true,paused:state.paused===true,actors,buildings:records(state.buildings),
    nodes:records(state.nodes),player:D.record(state.player),...context};
  }
  function step(count=1):LittlewildDeveloper.StepResult {
   const owned=guard();if(!Number.isSafeInteger(count)||count<0||count>36000)fail('invalid-input','step count must be an integer from 0 to 36000.');
   const before=owned.s.simTime;
   for(let index=0;index<count;index++)owned.step(.1);
   return {steps:count,advancedSeconds:owned.s.simTime-before,simTime:owned.s.simTime};
  }
  const facade:Session=Object.freeze({
   get disposed(){return disposed;},
   start(){const owned=guard();owned.s.started=true;owned.s.paused=false;},
   pause(){guard().s.paused=true;},resume(){guard().s.paused=false;},
   command(input:LittlewildDeveloper.Command):LittlewildDeveloper.CommandResult {
    const owned=guard();const raw=D.record(input),definition=root.LWCommandRouter.manifest.find(command=>command.id===raw.id);
    if(!definition)fail('invalid-input','Unknown command. Use toolbox.commands().');
    const envelope=root.LWDeveloperCommands.validate(raw,definition.scope);
    if(['cancel-plan','pause-plan','prioritize-plan'].includes(envelope.id)){
     const colony=D.record(D.record(save().state).colony),actor=records(colony.creatures).find(actor=>actor.id===envelope.actorId);
     if(!actor||!records(actor.orders).some(order=>order.id===envelope.args[0]))
      return {ok:false,reason:'This plan is no longer queued for that actor.',data:null};
    }
    const returned=owned.dispatchCommand(envelope),data=returned===undefined?null:D.copy(returned);
    const record=data!==null&&typeof data==='object'&&!Array.isArray(data)?data:null;
    const ok=record?.ok===false||data===false?false:true;
    const reason=record&&typeof record.reason==='string'?record.reason:undefined;
    return reason===undefined?{ok,data}:{ok,reason,data};
   },
   interactionOptions(sourceId:string,target:LittlewildDeveloper.InteractionTarget){
    const owned=guard(),id=D.text(sourceId,'Interaction initiator'),data=D.record(target);
    if(Object.keys(data).length!==2||!Object.hasOwn(data,'scope')||!Object.hasOwn(data,'id')||!['creature','building','node'].includes(String(data.scope)))fail('invalid-input','Invalid interaction target.');
    D.text(data.id,'Target ID');return owned.interactionOptions(id,data as unknown as LittlewildDeveloper.InteractionTarget).map(value=>D.record(value) as unknown as LittlewildDeveloper.InteractionOption);
   },
   settings(){return D.record(guard().gameSettings()) as unknown as LittlewildDeveloper.GameSettings;},
   interactions(){return D.record(guard().interactionState());},interactionDefinitions(){return D.record(guard().interactionDefinitions());},
   step,advance(seconds:number){
    guard();const count=Math.round(seconds*10);
    if(typeof seconds!=='number'||!Number.isFinite(seconds)||seconds<0||seconds>3600||Math.abs(count/10-seconds)>1e-9)
     fail('invalid-input','advance seconds must be a multiple of 0.1 from 0 to 3600.');
    return step(count);
   },inspect,save,story,
   captureScenario(){return D.record(X.capture(guard()));},
   dispose(){if(disposed)return;disposed=true;engine=null;if(active===facade)active=null;}
  });
  active=facade;return facade;
 }
 function createScenario(input:unknown,sceneId:string):Session {
  available();const pack=D.record(input),id=D.text(sceneId,'Scene ID');
  try{return session(X.commitScene(X.prepareScene(pack,id)));}
  catch(error){if(error instanceof D.DeveloperError)throw error;return fail('invalid-input',error instanceof Error?error.message:String(error));}
 }
 function scenarios():LittlewildDeveloper.ScenarioSummary[] {
  return X.builtins().map(input=>{
   const pack=D.record(input);
   return {id:D.text(pack.id,'Scenario ID'),name:D.text(pack.name,'Scenario name'),
    scenes:records(pack.scenes).map(scene=>({id:D.text(scene.id,'Scene ID'),name:D.text(scene.name,'Scene name'),worldId:D.text(scene.worldId,'World ID')}))};
  });
 }
 function create(options:LittlewildDeveloper.CreateOptions):Session {
  available();const checked=D.record(options);
  if(Object.keys(checked).some(key=>!['scenarioId','sceneId'].includes(key)))fail('invalid-input','Create options have unknown fields.');
  const id=D.text(checked.scenarioId,'Scenario ID'),pack=X.builtins().map(D.record).find(pack=>pack.id===id);
  if(!pack)fail('invalid-input','Unknown scenario: '+id+'. Use toolbox.scenarios().');
  const first=records(pack.scenes)[0];
  const sceneId=D.text(checked.sceneId??first?.id,'Scene ID');
  return createScenario(pack,sceneId);
 }
 function reviewStory(input:unknown):LittlewildDeveloper.StoryReview {
  try {
   const preview=S.inspect(typeof input==='string'?input:D.record(input));
   const review=Object.freeze({format:'littlewild-story-review' as const,version:10 as const,
    simulationFingerprint:preview.simulationFingerprint,scenarioId:preview.experience?.packId??null,sceneId:preview.experience?.sceneId??null});
   reviews.set(review,preview);return review;
  } catch(error){return fail('invalid-input',error instanceof Error?error.message:String(error));}
 }
 function openStory(review:LittlewildDeveloper.StoryReview):Session {
  available();const preview=reviews.get(review);
  if(!preview)fail('review-invalid','Review a current story with reviewStory() and pass its original review token.');
  try{const opened=session(S.commit(preview));reviews.delete(review);return opened;}
  catch(error){return fail('review-invalid',error instanceof Error?error.message:String(error));}
 }
 const api:LittlewildDeveloper.SessionApi&{claimHost:typeof claimHost}=Object.freeze({
  version:1,fixedStep:.1,maxSteps:36000,scenarios,
  commands:()=>root.LWCommandRouter.manifest.map(({id,scope,maxArgs,away})=>({id,scope,maxArgs,away})),
  create,validateScenario,createScenario,reviewStory,openStory,
  interactions:()=>root.LWInteractions.all().map(D.record),
  validateInteraction:(input:unknown)=>validation(()=>root.LWInteractions.definition(D.record(input))),
  validateInteractionLibrary:(input:unknown)=>validation(()=>root.LWInteractions.validate(D.record(input))),
  creatures:()=>root.LWCreatures.all().map(D.record),validateCreature:(input:unknown)=>validation(()=>root.LWCreatures.validate(D.record(input))),claimHost
 });
 root.LWDeveloperSession=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
