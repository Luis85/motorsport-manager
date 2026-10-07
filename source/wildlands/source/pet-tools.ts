/// <reference path="./pet-contracts.d.ts" />
/** Detached catalog inspection and bounded, explicit-clock Pocket Pet care experiments. */
declare namespace LWPetTools {
 type Policy='attentive'|'casual'|'snacker'|'neglect';
 interface Run {ok:boolean;policy:Policy;species:string;minutes:number;ticks:number;status:LWPetRuntime.Status;stage:string;form:string;mistakes:number;health:number;
  milestones:{minute:number;kind:string;message:string}[];commands:{accepted:number;rejected:number};checkpoint:LWPetRuntime.Checkpoint;}
 interface Api {
  discover():{operations:string[];policies:Policy[];limits:{minutes:number};speeds:string};
  catalog():LWPetData.Catalog;validate(input:unknown):{ok:boolean;errors:string[];catalog:LWPetData.Catalog|null};
  simulate(options:{policy:Policy;minutes:number;species?:string;catalog?:unknown}):Run;
 }
}
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWPet:LWPetRuntime.Api;LWPetCatalog:LWPetData.CatalogApi;LWPetTools?:LWPetTools.Api};
 const MAX_MINUTES=20160,POLICIES:LWPetTools.Policy[]=['attentive','casual','snacker','neglect'];
 const copy=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
 /** Deterministic caretakers. They only issue the same command intents a player can choose. */
 function decide(policy:LWPetTools.Policy,q:LWPetRuntime.Snapshot):LWPetRuntime.Command|null{
  if(policy==='neglect'||q.status!=='alive'||q.activity)return null;
  const n=Object.fromEntries(q.needs.map(need=>[need.id,need.value])) as Record<LWPetData.NeedId,number>;
  const can=(kind:LWPetData.ActionKind):string|null=>q.actions.find(a=>a.kind===kind&&a.enabled)?.id??null;
  // A casual caretaker keeps the pet fed and entertained but never manages bedtime,
  // so the pet repeatedly collapses from exhaustion: care mistakes without lethal neglect.
  const bedtime=policy!=='casual';
  if(q.pet.stage==='egg')return can('cuddle')?{kind:'care',action:can('cuddle')!}:null;
  if(q.sleeping)return q.lights&&bedtime?{kind:'sleep'}:null;
  if(q.sick&&can('medicine'))return {kind:'care',action:can('medicine')!};
  if(q.messes.length&&can('clean'))return {kind:'care',action:can('clean')!};
  if(bedtime&&n.energy<25&&q.lightsAction.enabled)return {kind:'sleep'};
  if(policy==='snacker'&&n.hunger<80&&can('treat'))return {kind:'care',action:can('treat')!};
  if(n.hunger<55&&can('feed'))return {kind:'care',action:can('feed')!};
  if(n.joy<55&&can('play'))return {kind:'care',action:can('play')!};
  if(n.joy<70&&can('cuddle'))return {kind:'care',action:can('cuddle')!};
  if(n.hygiene<50&&can('clean'))return {kind:'care',action:can('clean')!};
  return null;
 }
 function validate(input:unknown):{ok:boolean;errors:string[];catalog:LWPetData.Catalog|null}{
  try{return {ok:true,errors:[],catalog:copy(root.LWPetCatalog.validate(input))};}catch(error){return {ok:false,errors:[error instanceof Error?error.message:String(error)],catalog:null};}
 }
 function simulate(options:{policy:LWPetTools.Policy;minutes:number;species?:string;catalog?:unknown}):LWPetTools.Run{
  if(!options||!POLICIES.includes(options.policy))throw Error('Choose a policy: '+POLICIES.join(', ')+'.');
  if(!Number.isFinite(options.minutes)||options.minutes<1||options.minutes>MAX_MINUTES)throw Error('minutes must be from 1 to '+MAX_MINUTES+'.');
  const session=root.LWPet.create(options.catalog,options.species),perTick=session.catalog.rules.minutesPerSecond*root.LWPet.STEP;
  const ticks=Math.ceil(options.minutes/perTick),commands={accepted:0,rejected:0},milestones:LWPetTools.Run['milestones']=[];
  let last='';
  for(let tick=0;tick<ticks;tick++){
   const q=session.query();
   if(q.status!=='alive')break;
   const next=decide(options.policy,q);
   if(next){const result=session.command(next);result.ok?commands.accepted++:commands.rejected++;}
   session.step(1);
   // The diary is bounded, so new entries are those after the last one already read.
   const events=session.query().events,keys=events.map(event=>JSON.stringify(event)),fresh=events.slice(last?keys.lastIndexOf(last)+1:0);
   for(const event of fresh)if(['hatched','grew','evolved','sick','mistake','departed','exhausted'].includes(event.kind))milestones.push({minute:event.minute??0,kind:event.kind,message:event.message});
   if(keys.length)last=keys[keys.length-1]!;
   if(milestones.length>256)milestones.splice(0,milestones.length-256);
  }
  const q=session.query();
  return {ok:true,policy:options.policy,species:q.pet.species,minutes:Math.round(q.minute),ticks:q.tick,status:q.status,stage:q.pet.stage,form:q.pet.form,mistakes:q.pet.mistakes,health:q.health,milestones,commands,checkpoint:session.checkpoint()};
 }
 const api:LWPetTools.Api={
  discover:()=>({operations:['discover','catalog','validate','simulate'],policies:[...POLICIES],limits:{minutes:MAX_MINUTES},speeds:'Fixed 0.1 s ticks; catalog minutesPerSecond converts ticks to game minutes.'}),
  catalog:()=>copy(root.LWPetCatalog.defaults),validate,simulate
 };
 root.LWPetTools=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
