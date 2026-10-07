/* Saved activity preferences. Queries and no-op patches do not advance or normalize a world. */
(function(inputRoot:unknown){
 'use strict';
 interface Settings {duels:boolean;quests:boolean;}
 interface SavedPreferences {duels?:boolean;quests?:boolean;}
 interface Actor {id:string;activeQuest:{status:string}|null;}
 interface Result {ok:boolean;reason?:string;}
 interface Host {
  s:{settings:SavedPreferences};creatures:readonly Actor[];
  disableDuels():void;abortQuest():Result;
  commandActor<T>(id:string,action:()=>T,options:{away:boolean}):T|Result;
 }
 interface Methods {
  setGameSettings(input:unknown):Result;gameSettings():Settings;
  acceptQuest(...args:unknown[]):unknown;depart(...args:unknown[]):unknown;
  addOffer(...args:unknown[]):unknown;offerForIsland(...args:unknown[]):unknown;
  updateQuestBoard(...args:unknown[]):unknown;
  questOfferIssue(...args:unknown[]):unknown;questPlanIssue(...args:unknown[]):unknown;
  gateIssue(...args:unknown[]):unknown;
  handlers():Record<string,()=>string>;
 }
 interface Constructor extends Function {prototype:Host&Methods;import(input:unknown):Host;}
 interface Root {
  LWContent:{parse(input:unknown,limit?:number):unknown};
  LWGameSettings?:typeof api;
 }
 const root=inputRoot as Root,keys=['duels','quests'] as const;
 const disabled='Quests are turned off in Settings.';
 function object(value:unknown):value is Record<string,unknown>{
  return !!value&&typeof value==='object'&&!Array.isArray(value)&&
   [Object.prototype,null].includes(Object.getPrototypeOf(value) as object|null);
 }
 function ownValue(value:object,key:string):unknown{
  const d=Object.getOwnPropertyDescriptor(value,key);
  if(d&&(d.get||d.set||!d.enumerable))throw Error('Game settings must contain ordinary saved values.');
  return d?.value;
 }
 function validateState(state:unknown):void{
  if(state===undefined||state===null)return;
  if(!object(state))throw Error('Game settings require an ordinary state object.');
  const settings=ownValue(state,'settings');
  if(settings===undefined)return;
  if(!object(settings))throw Error('Saved settings must be an object.');
  for(const key of keys){
   const value=ownValue(settings,key);
   if(Object.hasOwn(settings,key)&&typeof value!=='boolean')throw Error('Saved '+key+' setting must be Boolean.');
   if(!Object.hasOwn(settings,key)&&key in settings)throw Error('Saved game settings must be owned values.');
  }
  // Accepted settings transitions have already cancelled duels and recalled expeditions.
  // Reject contradictory imported snapshots instead of leaving paused actors indefinitely locked.
  if(ownValue(settings,'duels')===false){
   const interactions=ownValue(state,'creatureInteractions');
   if(object(interactions))for(const key of ['active','seeks']){
    const entries=ownValue(interactions,key);
    if(Array.isArray(entries)&&entries.length)throw Error('Disabled duels cannot retain active sessions or seeking intents.');
   }
  }
  if(ownValue(settings,'quests')===false){
   const colony=ownValue(state,'colony'),actors=object(colony)?ownValue(colony,'creatures'):undefined;
   const check=(actor:unknown):void=>{
    if(!object(actor))return;
    const quest=ownValue(actor,'activeQuest');
    if(object(quest)&&ownValue(quest,'status')!=='returning')throw Error('Disabled quests must complete their recalled return.');
   };
   check(state);
   if(Array.isArray(actors))for(let index=0;index<actors.length;index++)check(ownValue(actors,String(index)));
  }
 }
 function current(engine:Pick<Host,'s'>):Settings{
  return {duels:engine.s.settings.duels??true,quests:engine.s.settings.quests??true};
 }
 function allowed(engine:Pick<Host,'s'>,key:keyof Settings):boolean{return current(engine)[key];}
 function patch(input:unknown):Partial<Settings>{
  if(!object(input)||Object.getOwnPropertySymbols(input).length)throw Error('Choose Boolean duels or quests settings.');
  const result:Partial<Settings>={};
  for(const key of Object.getOwnPropertyNames(input)){
   if(key!=='duels'&&key!=='quests')throw Error('Only duels and quests can be changed here.');
   const value=ownValue(input,key);
   if(typeof value!=='boolean')throw Error('Choose a Boolean '+key+' setting.');
   result[key]=value;
  }
  return result;
 }
 function apply(engine:Host,input:unknown):Result{
  let change:Partial<Settings>;
  try{change=patch(input);}catch(error){return {ok:false,reason:error instanceof Error?error.message:String(error)};}
  const before=current(engine),after={...before,...change};
  if(after.duels===before.duels&&after.quests===before.quests)return {ok:true};
  // Preference changes invoke the existing cancellation/recall authority, never a simulation tick.
  if(before.duels&&!after.duels)engine.disableDuels();
  if(before.quests&&!after.quests){
   for(const actor of engine.creatures)if(actor.activeQuest&&actor.activeQuest.status!=='returning'){
    const result=engine.commandActor(actor.id,()=>engine.abortQuest(),{away:true});
    if(!result.ok)throw Error('Quest recall failed: '+(result.reason||actor.id));
   }
  }
  for(const key of keys)if(after[key]!==before[key])engine.s.settings[key]=after[key];
  return {ok:true};
 }
 function install(input:Function):void{
  const Engine=input as Constructor,target=Engine.prototype;
  target.setGameSettings=function(value:unknown){return apply(this,value);};
  target.gameSettings=function(){return current(this);};
  // The final facade is the common authority for direct calls, commands, planners and the atlas.
  for(const key of ['acceptQuest','questOfferIssue','questPlanIssue','depart','addOffer','offerForIsland','updateQuestBoard'] as const){
   const original=target[key];
   if(typeof original!=='function')throw Error('Missing quest settings authority: '+key);
   target[key]=function(...args:unknown[]){
    if(!allowed(this,'quests')){
     if(key==='acceptQuest')return {ok:false,reason:disabled};
     if(key==='questOfferIssue'||key==='questPlanIssue')return disabled;
     return key==='updateQuestBoard'?undefined:false;
    }
    return original.apply(this,args);
   };
  }
  const gate=target.gateIssue;
  target.gateIssue=function(...args:unknown[]){
   return args[0]==='features'&&args[1]==='quests'&&!allowed(this,'quests')?disabled:gate.apply(this,args);
  };
  const handlers=target.handlers;
  target.handlers=function(){
   const result=handlers.call(this),quest=result.quest;
   if(quest)result.quest=()=>allowed(this,'quests')?quest():'failure';
   return result;
  };
  const importer=Engine.import;
  Engine.import=function(input:unknown){
   const copy=root.LWContent.parse(input,2*1024*1024);
   if(object(copy)&&Object.hasOwn(copy,'state'))validateState(ownValue(copy,'state'));
   return importer.call(this,copy);
  };
 }
 const api=Object.freeze({current,allowed,validateState,apply,install});root.LWGameSettings=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
